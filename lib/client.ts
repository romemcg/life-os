"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TableName } from "./schema";
import { todayIn } from "./dates";

// Tiny data layer: fetch + cross-component invalidation by table name.
const listeners = new Map<string, Set<() => void>>();
function emit(table: string) {
  listeners.get(table)?.forEach((fn) => fn());
  // Milestone status follows its tasks on the server, so task/project changes refresh milestones too.
  if (table === "tasks" || table === "projects") listeners.get("milestones")?.forEach((fn) => fn());
  // Spending and card payments move balances on the server.
  if (table === "expenses" || table === "debt_payments") for (const t of ["accounts", "debts", "balance_snapshots"]) listeners.get(t)?.forEach((fn) => fn());
  // Trackers and tasks mirror each other on the server, so refresh the other side too.
  if (["task_completions", "habit_checkins", "reading_log", "learning_log", "bible_log", "meditations"].includes(table))
    for (const t of ["task_completions", "habit_checkins", "tasks", "milestones"]) if (t !== table) listeners.get(t)?.forEach((fn) => fn());
}
function on(table: string, fn: () => void) {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table)!.add(fn);
  return () => {
    listeners.get(table)!.delete(fn);
  };
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error || `Request failed (${r.status})`);
  return body as T;
}

export type Row = Record<string, any> & { id: number; created_at: string; updated_at: string; archived: boolean };

export const api = {
  list: <T = Row>(table: TableName, q: Record<string, string | number | boolean | undefined> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, String(v));
    return req<T[]>(`/api/data/${table}?${p}`);
  },
  create: async <T = Row>(table: TableName, data: Record<string, unknown>) => {
    const r = await req<T>(`/api/data/${table}`, { method: "POST", body: JSON.stringify(data) });
    emit(table);
    return r;
  },
  update: async <T = Row>(table: TableName, id: number, data: Record<string, unknown>) => {
    const r = await req<T>(`/api/data/${table}/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    emit(table);
    return r;
  },
  remove: async (table: TableName, id: number) => {
    await req(`/api/data/${table}/${id}`, { method: "DELETE" });
    emit(table);
  },
  settings: () => req<Record<string, string>>(`/api/settings`),
  saveSettings: async (s: Record<string, unknown>) => {
    const r = await req<Record<string, string>>(`/api/settings`, { method: "PUT", body: JSON.stringify(s) });
    emit("settings");
    return r;
  },
  invalidate: emit,
};

export function useList<T = Row>(table: TableName, q: Record<string, string | number | boolean | undefined> = {}) {
  const key = JSON.stringify(q);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .list<T>(table, JSON.parse(key))
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [table, key]);
  useEffect(() => {
    load();
    return on(table, load);
  }, [load, table]);
  return { rows, loading, error, reload: load };
}

const DEFAULTS: Record<string, string> = { birth_date: "1997-03-14", timezone: "Asia/Dubai", currency: "AED", day_mode: "standard" };

export function useSettings() {
  const [s, setS] = useState<Record<string, string> | null>(null);
  const load = useCallback(() => {
    api.settings().then(setS).catch(() => setS({}));
  }, []);
  useEffect(() => {
    load();
    return on("settings", load);
  }, [load]);
  const merged = useMemo(() => ({ ...DEFAULTS, ...(s ?? {}) }), [s]);
  return { settings: merged, ready: s !== null, save: api.saveSettings };
}

/** Today's date in the configured time zone, refreshed every minute (handles midnight rollover). */
export function useToday(tz: string) {
  const [d, setD] = useState(() => todayIn(tz));
  useEffect(() => {
    setD(todayIn(tz));
    const t = setInterval(() => setD(todayIn(tz)), 60_000);
    return () => clearInterval(t);
  }, [tz]);
  return d;
}

export function money(n: number | null | undefined, cur = "AED", digits = 0) {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${cur} ${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
