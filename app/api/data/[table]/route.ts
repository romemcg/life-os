import { getDb, insertRow, fromDb } from "@/lib/db";
import { TABLES, isTable } from "@/lib/schema";
import { json, err, snapshotBalances } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  if (!isTable(table)) return err("Unknown table", 404);
  const url = new URL(req.url);
  const cols = TABLES[table].columns as Record<string, string>;
  const where: string[] = [];
  const args: unknown[] = [];
  if (url.searchParams.get("archived") !== "1") where.push("archived = 0");
  for (const [k, v] of url.searchParams) {
    if (cols[k]) {
      where.push(`${k} = ?`);
      args.push(cols[k] === "bool" ? (v === "true" || v === "1" ? 1 : 0) : v);
    }
  }
  // optional date window on a 'date' column
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (cols.date && from) { where.push("date >= ?"); args.push(from); }
  if (cols.date && to) { where.push("date <= ?"); args.push(to); }
  const sql = `SELECT * FROM ${table}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY ${TABLES[table].orderBy ?? "id"}`;
  const rows = getDb().prepare(sql).all(...args) as Record<string, unknown>[];
  return json(rows.map((r) => fromDb(table, r)));
}

export async function POST(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  if (!isTable(table)) return err("Unknown table", 404);
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return err("Body must be an object");
    const db = getDb();
    const id = insertRow(db, table, body);
    if (table === "accounts" || table === "debts" || table === "expenses" || table === "debt_payments") snapshotBalances();
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown>;
    return json(fromDb(table, row), 201);
  } catch (e) {
    return err(e);
  }
}
