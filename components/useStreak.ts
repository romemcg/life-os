"use client";
import { useMemo } from "react";
import { useList } from "@/lib/client";
import { addDays } from "@/lib/dates";

/**
 * Consistency from real activity only.
 * A day counts when at least one task was completed (routine tick or one-off task done) or a check-in was logged.
 * Skipped routines never count. Nothing is estimated.
 */
export function useStreak(today: string, days = 84) {
  const from = addDays(today, -(days + 400));
  const comps = useList("task_completions", { from, to: today });
  const tasks = useList("tasks");
  const checks = useList("check_ins", { from, to: today });

  return useMemo(() => {
    const count = new Map<string, number>();
    const bump = (d: string | null | undefined, n = 1) => { if (d) count.set(d, (count.get(d) ?? 0) + n); };
    for (const c of comps.rows) if (c.kind !== "skipped") bump(c.date as string);
    for (const t of tasks.rows) if (t.status === "done" && t.completed_at) bump(String(t.completed_at).slice(0, 10));
    const checkDays = new Set(checks.rows.map((c) => c.date as string));
    for (const d of checkDays) if (!count.has(d)) count.set(d, 0);
    const active = (d: string) => count.has(d);

    // Current streak: consecutive active days ending today, or ending yesterday if today is still open.
    const todayDone = active(today);
    let cur = 0;
    let d = todayDone ? today : addDays(today, -1);
    while (active(d)) { cur++; d = addDays(d, -1); }

    // Best streak across everything loaded.
    const sorted = [...count.keys()].sort();
    let best = 0, run = 0, prev = "";
    for (const day of sorted) {
      run = prev && addDays(prev, 1) === day ? run + 1 : 1;
      best = Math.max(best, run);
      prev = day;
    }

    const grid: { date: string; n: number; active: boolean }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      grid.push({ date, n: count.get(date) ?? 0, active: active(date) });
    }
    const last7 = grid.slice(-7).filter((g) => g.active).length;
    const last30 = grid.slice(-30).filter((g) => g.active).length;
    const totalDone = [...count.values()].reduce((a, b) => a + b, 0);
    return { current: cur, best: Math.max(best, cur), todayDone, grid, last7, last30, totalDone, loading: comps.loading || tasks.loading };
  }, [comps.rows, tasks.rows, checks.rows, today, days, comps.loading, tasks.loading]);
}
