import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { TABLES, SQL_TYPES, type TableName, type ColType } from "./schema";
import { seed, seedV2, seedV3, seedV4, seedV5, seedV6, seedV7 } from "./seed";
import { seedDemo } from "./demo";

declare global {
  // eslint-disable-next-line no-var
  var __lifeosDb: Database.Database | undefined;
}

// Hosted demo (Vercel): fictional data in a throwaway database under /tmp, rebuilt on every cold start.
export const IS_DEMO = process.env.LIFEOS_DEMO === "1" || !!process.env.VERCEL;

export function dbPath() {
  if (process.env.LIFEOS_DB_PATH) return path.resolve(process.env.LIFEOS_DB_PATH);
  return process.env.VERCEL ? "/tmp/life-os-demo.db" : path.resolve("./data/life-os.db");
}

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  for (const [name, def] of Object.entries(TABLES)) {
    db.exec(
      `CREATE TABLE IF NOT EXISTS ${name} (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0)`
    );
    const existing = new Set((db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]).map((c) => c.name));
    for (const [col, type] of Object.entries(def.columns as Record<string, ColType>)) {
      if (!existing.has(col)) db.exec(`ALTER TABLE ${name} ADD COLUMN ${col} ${SQL_TYPES[type]}`);
    }
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tc_task ON task_completions(task_id, date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hc_habit ON habit_checkins(habit_id, date)`);
}

export function getDb(): Database.Database {
  if (globalThis.__lifeosDb) return globalThis.__lifeosDb;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  const seeded = db.prepare(`SELECT value FROM settings WHERE key='seeded'`).get() as { value: string } | undefined;
  if (!seeded) {
    db.transaction(() => {
      seed(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seeded','1',?)`).run(now());
    })();
  }
  const v2 = db.prepare(`SELECT value FROM settings WHERE key='seed_v2'`).get();
  if (!v2) {
    db.transaction(() => {
      seedV2(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v2','1',?)`).run(now());
    })();
  }
  const v3 = db.prepare(`SELECT value FROM settings WHERE key='seed_v3'`).get();
  if (!v3) {
    db.transaction(() => {
      seedV3(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v3','1',?)`).run(now());
    })();
  }
  const v4 = db.prepare(`SELECT value FROM settings WHERE key='seed_v4'`).get();
  if (!v4) {
    db.transaction(() => {
      seedV4(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v4','1',?)`).run(now());
    })();
  }
  const v5 = db.prepare(`SELECT value FROM settings WHERE key='seed_v5'`).get();
  if (!v5) {
    db.transaction(() => {
      seedV5(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v5','1',?)`).run(now());
    })();
  }
  const v6 = db.prepare(`SELECT value FROM settings WHERE key='seed_v6'`).get();
  if (!v6) {
    db.transaction(() => {
      seedV6(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v6','1',?)`).run(now());
    })();
  }
  const v7 = db.prepare(`SELECT value FROM settings WHERE key='seed_v7'`).get();
  if (!v7) {
    db.transaction(() => {
      seedV7(db, insertRow);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v7','1',?)`).run(now());
    })();
  }
  const v8 = db.prepare(`SELECT value FROM settings WHERE key='seed_v8'`).get();
  if (!v8) {
    db.transaction(() => {
      // Projects merge into milestones: carry each project's weekly commitment and outcome onto its milestone.
      db.exec(`
        UPDATE milestones SET weekly_commitment = (SELECT p.weekly_commitment FROM projects p WHERE p.milestone_id = milestones.id AND p.weekly_commitment IS NOT NULL AND p.archived = 0 ORDER BY p.id LIMIT 1)
          WHERE weekly_commitment IS NULL;
        UPDATE milestones SET description = (SELECT p.outcome FROM projects p WHERE p.milestone_id = milestones.id AND p.outcome IS NOT NULL AND p.archived = 0 ORDER BY p.id LIMIT 1)
          WHERE (description IS NULL OR description = '') AND EXISTS (SELECT 1 FROM projects p WHERE p.milestone_id = milestones.id AND p.outcome IS NOT NULL AND p.archived = 0);
      `);
      db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v8','1',?)`).run(now());
    })();
  }
  const v9 = db.prepare(`SELECT value FROM settings WHERE key='seed_v9'`).get();
  if (!v9) {
    db.transaction(() => habitsToRoutines(db))();
    db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('seed_v9','1',?)`).run(now());
  }
  // Demo mode: a fictional person with five weeks of history (see lib/demo.ts). Never touches a real database.
  if (IS_DEMO && !db.prepare(`SELECT 1 FROM settings WHERE key='demo_seeded'`).get()) {
    db.transaction(() => seedDemo(db, insertRow))();
  }
  fillTaskLinks(db);
  syncMilestones(db);
  globalThis.__lifeosDb = db;
  return db;
}

export function now() {
  return new Date().toISOString();
}

// ---------- row (de)serialization ----------
export function toDb(table: TableName, input: Record<string, unknown>) {
  const cols = TABLES[table].columns as Record<string, ColType>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "archived") {
      out.archived = v ? 1 : 0;
      continue;
    }
    const t = cols[k];
    if (!t) continue; // silently drop unknown keys
    if (v === undefined) continue;
    if (v === null || v === "") {
      out[k] = null;
      continue;
    }
    switch (t) {
      case "bool":
        out[k] = v ? 1 : 0;
        break;
      case "int": {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`${k} must be a number`);
        out[k] = Math.round(n);
        break;
      }
      case "real": {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`${k} must be a number`);
        out[k] = n;
        break;
      }
      case "json":
        out[k] = JSON.stringify(v);
        break;
      default:
        out[k] = String(v).slice(0, 2_000_000);
    }
  }
  return out;
}

export function fromDb(table: TableName, row: Record<string, unknown>) {
  const cols = TABLES[table].columns as Record<string, ColType>;
  const out: Record<string, unknown> = { ...row, archived: !!row.archived };
  for (const [k, t] of Object.entries(cols)) {
    if (t === "bool") out[k] = row[k] == null ? null : !!row[k];
    if (t === "json" && typeof row[k] === "string") {
      try {
        out[k] = JSON.parse(row[k] as string);
      } catch {
        out[k] = null;
      }
    }
  }
  return out;
}

export function insertRow(db: Database.Database, table: TableName, input: Record<string, unknown>) {
  const data = toDb(table, input);
  for (const r of TABLES[table].required ?? []) {
    if (data[r] == null) throw new Error(`${r} is required`);
  }
  const ts = now();
  const keys = Object.keys(data);
  const info = db
    .prepare(
      `INSERT INTO ${table} (created_at, updated_at${keys.map((k) => ", " + k).join("")}) VALUES (?, ?${keys.map(() => ", ?").join("")})`
    )
    .run(ts, ts, ...keys.map((k) => data[k]));
  const newId = Number(info.lastInsertRowid);
  if (table === "tasks") fillTaskLinks(db);
  syncTrackersOnInsert(db, table, data);
  if (MONEY_TABLES.has(table)) applyMoney(db, table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(newId) as Record<string, any>, 1);
  if (table === "tasks" || table === "milestones" || table === "projects" || TRACKER_TABLES.has(table)) syncMilestones(db);
  return newId;
}

export function updateRow(db: Database.Database, table: TableName, id: number, input: Record<string, unknown>) {
  const data = toDb(table, input);
  const keys = Object.keys(data);
  if (!keys.length) return 0;
  const before = MONEY_TABLES.has(table) ? (db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, any> | undefined) : undefined;
  const info = db
    .prepare(`UPDATE ${table} SET updated_at = ?${keys.map((k) => `, ${k} = ?`).join("")} WHERE id = ?`)
    .run(now(), ...keys.map((k) => data[k]), id);
  if (before) {
    // re-apply: undo the old effect on balances, then apply the edited one
    applyMoney(db, table, before, -1);
    applyMoney(db, table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, any>, 1);
  }
  if (table === "tasks") fillTaskLinks(db);
  if (table === "tasks" || table === "milestones" || table === "projects") syncMilestones(db);
  return info.changes;
}

export function getSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** A task in a project or milestone belongs to that life area too: fill missing links upward. Idempotent. */
export function fillTaskLinks(db: Database.Database) {
  db.exec(`
    UPDATE tasks SET milestone_id = (SELECT milestone_id FROM projects WHERE projects.id = tasks.project_id)
      WHERE milestone_id IS NULL AND project_id IS NOT NULL AND (SELECT milestone_id FROM projects WHERE projects.id = tasks.project_id) IS NOT NULL;
    UPDATE tasks SET pillar_id = COALESCE((SELECT pillar_id FROM projects WHERE projects.id = tasks.project_id), (SELECT pillar_id FROM milestones WHERE milestones.id = tasks.milestone_id))
      WHERE pillar_id IS NULL AND (project_id IS NOT NULL OR milestone_id IS NOT NULL);
  `);
}

/**
 * One source of truth for milestones that have tasks: done exactly when every linked one-off task is done.
 * Linked = task on the milestone directly or through one of its projects. Routines (recurring tasks) never block.
 * Milestones with no linked one-off tasks stay manual. Raw SQL so it never re-triggers itself.
 */
export function syncMilestones(db: Database.Database) {
  const rows = db.prepare(`
    SELECT m.id, m.status, m.completed_at,
      COUNT(t.id) AS total,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
      MAX(CASE WHEN t.status = 'done' THEN t.completed_at END) AS last_done
    FROM milestones m
    JOIN tasks t ON (t.milestone_id = m.id OR (t.milestone_id IS NULL AND t.project_id IN (SELECT id FROM projects WHERE milestone_id = m.id)))
      AND COALESCE(t.recurrence, 'none') = 'none' AND COALESCE(t.status, 'open') <> 'dropped' AND COALESCE(t.archived, 0) = 0
    WHERE COALESCE(m.archived, 0) = 0 AND COALESCE(m.status, '') <> 'dropped' AND COALESCE(m.stage, 2) <> 0 -- always-on milestones are ongoing, never auto-closed
    GROUP BY m.id
  `).all() as { id: number; status: string | null; completed_at: string | null; total: number; done: number; last_done: string | null }[];
  const ts = now();
  const close = db.prepare(`UPDATE milestones SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?`);
  const reopen = db.prepare(`UPDATE milestones SET status = ?, completed_at = NULL, updated_at = ? WHERE id = ?`);
  for (const r of rows) {
    const all = r.total > 0 && r.done === r.total;
    if (all && r.status !== "done") close.run(String(r.last_done ?? ts).slice(0, 10), ts, r.id);
    else if (!all && r.status === "done") reopen.run(r.done > 0 ? "in_progress" : "not_started", ts, r.id);
    else if (!all && r.status === "not_started" && r.done > 0) reopen.run("in_progress", ts, r.id);
  }
}

// ---------- Tracker sync: one action, every place agrees ----------
// A task's log_to links it to a tracker. Logging in the tracker ticks the task for that day;
// ticking the task records the habit history. Raw SQL, so nothing re-triggers itself.
const TRACKER_TABLES = new Set(["task_completions", "habit_checkins", "reading_log", "learning_log", "bible_log", "meditations"]);

function completeLinked(db: Database.Database, where: string, args: unknown[], date: string) {
  const ts = now();
  const tasks = db.prepare(`SELECT id, recurrence, status FROM tasks WHERE archived = 0 AND COALESCE(status,'open') <> 'dropped' AND (${where})`).all(...args) as { id: number; recurrence: string | null; status: string | null }[];
  for (const t of tasks) {
    if ((t.recurrence ?? "none") !== "none") {
      const has = db.prepare(`SELECT 1 FROM task_completions WHERE task_id = ? AND date = ? AND archived = 0`).get(t.id, date);
      if (!has) db.prepare(`INSERT INTO task_completions (created_at, updated_at, task_id, date, kind) VALUES (?, ?, ?, ?, 'done')`).run(ts, ts, t.id, date);
    } else if (t.status === "open") {
      db.prepare(`UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?`).run(date, ts, t.id);
    }
  }
}

export function syncTrackersOnInsert(db: Database.Database, table: string, d: Record<string, unknown>) {
  if (!TRACKER_TABLES.has(table)) return;
  const date = String(d.date ?? "").slice(0, 10);
  if (!date) return;
  if (table === "task_completions" && d.kind !== "skipped") {
    const t = db.prepare(`SELECT log_to FROM tasks WHERE id = ?`).get(d.task_id) as { log_to: string | null } | undefined;
    const ref = t?.log_to ?? "";
    if (ref.startsWith("habit:")) {
      const hid = Number(ref.slice(6));
      const has = db.prepare(`SELECT 1 FROM habit_checkins WHERE habit_id = ? AND date = ? AND archived = 0`).get(hid, date);
      if (!has) db.prepare(`INSERT INTO habit_checkins (created_at, updated_at, habit_id, date, value) VALUES (?, ?, ?, ?, 1)`).run(now(), now(), hid, date);
    }
  }
  if (table === "habit_checkins") completeLinked(db, `log_to = ?`, [`habit:${d.habit_id}`], date);
  if (table === "reading_log") completeLinked(db, `log_to = ? OR log_to = 'book:current'`, [`book:${d.book_id}`], date);
  if (table === "learning_log") completeLinked(db, `log_to = ?`, [`learning:${d.item_id}`], date);
  if (table === "bible_log") completeLinked(db, `log_to = 'bible'`, [], date);
  if (table === "meditations") completeLinked(db, `log_to = 'meditation'`, [], date);
}

/** Before a delete: undo the mirrored record so unticking in one place unticks the other. */
export function syncTrackersOnDelete(db: Database.Database, table: string, id: number) {
  if (table === "task_completions") {
    const c = db.prepare(`SELECT c.date, t.log_to FROM task_completions c JOIN tasks t ON t.id = c.task_id WHERE c.id = ?`).get(id) as { date: string; log_to: string | null } | undefined;
    if (c?.log_to?.startsWith("habit:")) db.prepare(`DELETE FROM habit_checkins WHERE habit_id = ? AND date = ?`).run(Number(c.log_to.slice(6)), c.date);
  }
  if (table === "habit_checkins") {
    const h = db.prepare(`SELECT habit_id, date FROM habit_checkins WHERE id = ?`).get(id) as { habit_id: number; date: string } | undefined;
    if (h) db.prepare(`DELETE FROM task_completions WHERE date = ? AND task_id IN (SELECT id FROM tasks WHERE log_to = ?)`).run(h.date, `habit:${h.habit_id}`);
  }
}

/**
 * Habits become routines: one recurring task per active habit, with its tick history copied
 * into task completions. Reading, Bible and meditation routines are linked to their trackers.
 * The habit rows are paused (kept only as history), so there is one list of things to do.
 */
export function habitsToRoutines(db: Database.Database) {
  const habits = db.prepare(`SELECT * FROM habits WHERE archived = 0 AND active = 1`).all() as Record<string, any>[];
  const ts = now();
  const today = ts.slice(0, 10);
  for (const h of habits) {
    const name = String(h.name);
    const n = Number(h.target_per_week) || 7;
    const log_to = /bible/i.test(name) ? "bible" : /meditat/i.test(name) ? "meditation" : /^read/i.test(name) ? "book:current" : null;
    const minutes = /^read/i.test(name) ? 20 : /bible/i.test(name) ? 15 : 10;
    const first = (db.prepare(`SELECT MIN(date) d FROM habit_checkins WHERE habit_id = ? AND archived = 0`).get(h.id) as { d: string | null }).d;
    const start = first && first < today ? first : String(h.created_at ?? ts).slice(0, 10);
    const info = db.prepare(
      `INSERT INTO tasks (created_at, updated_at, title, description, pillar_id, milestone_id, recurrence, due_date, duration_min, priority, status, source, log_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 'open', 'habit', ?)`
    ).run(ts, ts, name, h.minimum_version ? `Minimum version on hard days: ${h.minimum_version}` : null, h.pillar_id ?? null, h.milestone_id ?? null, n >= 7 ? "daily" : `times:${n}`, start, minutes, log_to);
    const tid = Number(info.lastInsertRowid);
    const dates = db.prepare(`SELECT DISTINCT date FROM habit_checkins WHERE habit_id = ? AND archived = 0`).all(h.id) as { date: string }[];
    for (const d of dates) db.prepare(`INSERT INTO task_completions (created_at, updated_at, task_id, date, kind) VALUES (?, ?, ?, ?, 'done')`).run(ts, ts, tid, d.date);
    db.prepare(`UPDATE habits SET active = 0, updated_at = ? WHERE id = ?`).run(ts, h.id);
  }
}

// ---------- Money sync: spending and payments move the balances ----------
export const MONEY_TABLES = new Set(["expenses", "debt_payments"]);

/** sign = 1 to apply, -1 to undo. Spending lowers an account or raises a card; a payment lowers the card and the paying account. */
export function applyMoney(db: Database.Database, table: string, r: Record<string, any> | undefined, sign: 1 | -1) {
  if (!r || r.archived) return;
  const amt = Number(r.amount) || 0;
  if (!amt) return;
  const ts = now();
  const day = String(r.date ?? ts).slice(0, 10);
  const acct = db.prepare(`UPDATE accounts SET balance = ROUND(balance - ?, 2), as_of = MAX(COALESCE(as_of, ''), ?), updated_at = ? WHERE id = ?`);
  if (table === "expenses") {
    if (r.account_id) acct.run(sign * amt, day, ts, r.account_id);
    if (r.debt_id) db.prepare(`UPDATE debts SET balance = ROUND(balance + ?, 2), as_of = MAX(COALESCE(as_of, ''), ?), updated_at = ? WHERE id = ?`).run(sign * amt, day, ts, r.debt_id);
  }
  if (table === "debt_payments") {
    db.prepare(`UPDATE debts SET balance = ROUND(MAX(0, balance - ?), 2), statement_paid = ROUND(COALESCE(statement_paid, 0) + ?, 2), as_of = MAX(COALESCE(as_of, ''), ?), updated_at = ? WHERE id = ?`).run(sign * amt, sign * amt, day, ts, r.debt_id);
    if (r.account_id) acct.run(sign * amt, day, ts, r.account_id);
  }
}
