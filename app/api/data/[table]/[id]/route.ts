import { syncTrackersOnDelete, applyMoney, MONEY_TABLES, getDb, updateRow, fromDb } from "@/lib/db";
import { isTable } from "@/lib/schema";
import { json, err, snapshotBalances } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { table, id } = await ctx.params;
  if (!isTable(table)) return err("Unknown table", 404);
  const n = Number(id);
  if (!Number.isInteger(n)) return err("Bad id");
  try {
    const body = await req.json();
    const db = getDb();
    const changed = updateRow(db, table, n, body ?? {});
    if (!changed && Object.keys(body ?? {}).length) {
      const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(n);
      if (!exists) return err("Not found", 404);
    }
    if (table === "accounts" || table === "debts" || table === "expenses" || table === "debt_payments") snapshotBalances();
    return json(fromDb(table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(n) as Record<string, unknown>));
  } catch (e) {
    return err(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { table, id } = await ctx.params;
  if (!isTable(table)) return err("Unknown table", 404);
  const n = Number(id);
  const db = getDb();
  const del = db.transaction(() => {
    syncTrackersOnDelete(db, table, n);
    if (MONEY_TABLES.has(table)) applyMoney(db, table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(n) as Record<string, any>, -1);
    if (table === "tasks") db.prepare(`DELETE FROM task_completions WHERE task_id=?`).run(n);
    if (table === "habits") db.prepare(`DELETE FROM habit_checkins WHERE habit_id=?`).run(n);
    if (table === "applications") {
      db.prepare(`DELETE FROM interviews WHERE application_id=?`).run(n);
    }
    if (table === "projects") db.prepare(`UPDATE tasks SET project_id=NULL WHERE project_id=?`).run(n);
    if (table === "milestones") {
      // Tasks stay in their life area, just without a milestone.
      db.prepare(`UPDATE tasks SET milestone_id=NULL WHERE milestone_id=?`).run(n);
      db.prepare(`UPDATE projects SET milestone_id=NULL WHERE milestone_id=?`).run(n);
      db.prepare(`UPDATE habits SET milestone_id=NULL WHERE milestone_id=?`).run(n);
    }
    if (table === "learning_items") db.prepare(`DELETE FROM learning_log WHERE item_id=?`).run(n);
    if (table === "books") db.prepare(`DELETE FROM reading_log WHERE book_id=?`).run(n);
    if (table === "people") db.prepare(`DELETE FROM connections WHERE person_id=?`).run(n);
    return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(n).changes;
  });
  const changes = del();
  if (table === "accounts" || table === "debts" || table === "expenses" || table === "debt_payments") snapshotBalances();
  return changes ? json({ ok: true }) : err("Not found", 404);
}
