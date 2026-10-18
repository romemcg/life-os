import "server-only";
import { NextResponse } from "next/server";
import { getDb, insertRow, now } from "./db";
import { todayIn } from "./dates";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function err(e: unknown, status = 400) {
  const msg = e instanceof Error ? e.message : String(e);
  return json({ error: msg }, status);
}

/** Records today's total cash/debt so the net-worth trend uses real entered data only. */
export function snapshotBalances() {
  const db = getDb();
  const tz = (db.prepare(`SELECT value FROM settings WHERE key='timezone'`).get() as { value: string } | undefined)?.value;
  const today = todayIn(tz || "Asia/Dubai");
  const cash = (db.prepare(`SELECT COALESCE(SUM(balance),0) v FROM accounts WHERE archived=0 AND (currency IS NULL OR UPPER(currency)='AED')`).get() as { v: number }).v;
  const debt = (db.prepare(`SELECT COALESCE(SUM(balance),0) v FROM debts WHERE archived=0`).get() as { v: number }).v;
  const existing = db.prepare(`SELECT id FROM balance_snapshots WHERE date=?`).get(today) as { id: number } | undefined;
  if (existing) db.prepare(`UPDATE balance_snapshots SET cash=?, debt=?, updated_at=? WHERE id=?`).run(cash, debt, now(), existing.id);
  else insertRow(db, "balance_snapshots", { date: today, cash, debt });
}
