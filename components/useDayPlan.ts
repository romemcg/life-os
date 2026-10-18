"use client";
import { useMemo } from "react";
import { useList, api, type Row } from "@/lib/client";
import { candidatesFor, planDay, type DayMode } from "@/lib/priority";
import { isRecurring, occursOn, timesPerWeek } from "@/lib/recurrence";
import { addDays, weekRange } from "@/lib/dates";

export function useDayPlan(today: string, mode: DayMode, pinned: number[] = []) {
  const tasks = useList("tasks");
  const comps = useList("task_completions", { date: today });
  const [mon] = weekRange(today);
  const week = useList("task_completions", { from: mon, to: today });
  const pillars = useList("pillars");

  return useMemo(() => {
    const weight = new Map<number, number>(pillars.rows.map((p) => [p.id, Number(p.stage_weight ?? 0.5)]));
    const handled = new Set<number>(comps.rows.map((c) => c.task_id as number));
    const doneRecurring = new Set<number>(comps.rows.filter((c) => c.kind !== "skipped").map((c) => c.task_id as number));
    const all = tasks.rows;
    const weekCounts = new Map<number, number>();
    for (const c of week.rows) if (c.kind !== "skipped") weekCounts.set(c.task_id as number, (weekCounts.get(c.task_id as number) ?? 0) + 1);
    // flexible "N days a week" routines drop out of today once the week's target is met
    const cands = candidatesFor(all, today, handled).filter((t) => {
      const n = timesPerWeek(t);
      return n == null || (weekCounts.get(t.id) ?? 0) < n;
    });
    const ctx = { today, mode, pillarWeight: (id?: number | null) => (id ? weight.get(id) ?? 0.5 : 0.5) };
    const plan = planDay(cands, ctx);
    // user pins override the engine: pinned tasks move into the plan
    if (pinned.length) {
      const moved = plan.later.filter((s) => pinned.includes(s.task.id));
      plan.later = plan.later.filter((s) => !pinned.includes(s.task.id));
      plan.planned = [...plan.planned, ...moved];
      plan.minutes += moved.reduce((s, m) => s + (m.task.duration_min ?? 30), 0);
    }
    const doneToday = all.filter(
      (t) => (isRecurring(t) && doneRecurring.has(t.id) && occursOn(t, today)) || (!isRecurring(t) && t.status === "done" && String(t.completed_at ?? "").slice(0, 10) === today)
    );
    return { ...plan, doneToday, weekCounts, loading: tasks.loading || comps.loading, allTasks: all, completions: comps.rows };
  }, [tasks.rows, comps.rows, week.rows, pillars.rows, today, mode, pinned, tasks.loading, comps.loading]);
}

export async function completeTask(t: Row, today: string) {
  if (isRecurring(t)) await api.create("task_completions", { task_id: t.id, date: today, kind: "done" });
  else await api.update("tasks", t.id, { status: "done", completed_at: today });
  api.invalidate("task_completions");
}

export async function uncompleteTask(t: Row, today: string, completions: Row[]) {
  if (isRecurring(t)) {
    const c = completions.find((c) => c.task_id === t.id && c.date === today);
    if (c) await api.remove("task_completions", c.id);
  } else await api.update("tasks", t.id, { status: "open", completed_at: null });
}

/** Missed-task recovery: move without breaking the roadmap. */
export async function rescheduleTask(t: Row, today: string, to?: string) {
  if (isRecurring(t)) {
    await api.create("task_completions", { task_id: t.id, date: today, kind: "skipped" });
    return;
  }
  await api.update("tasks", t.id, { due_date: to ?? addDays(today, 1), reschedule_count: (t.reschedule_count ?? 0) + 1 });
}

/** "Do it today": set the date to today and pin it so it always shows in today's plan, even when the plan is full. */
export async function doToday(taskId: number, today: string) {
  await api.update("tasks", taskId, { due_date: today });
  const [entry] = await api.list("journal", { date: today });
  const pinned = new Set<number>(((entry?.pinned as number[]) ?? []));
  pinned.add(taskId);
  if (entry) await api.update("journal", entry.id, { pinned: [...pinned] });
  else await api.create("journal", { date: today, pinned: [...pinned] });
}
