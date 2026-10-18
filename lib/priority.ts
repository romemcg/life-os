// Transparent priority engine and day planner. Every score comes with reasons.
import { diffDays } from "./dates";
import { occursOn, isRecurring } from "./recurrence";

export interface TaskLike {
  id: number;
  title?: string;
  priority?: number | null;
  due_date?: string | null;
  duration_min?: number | null;
  pillar_id?: number | null;
  recurrence?: string | null;
  essential?: boolean | null;
  deep?: boolean | null;
  status?: string | null;
  reschedule_count?: number | null;
  created_at?: string | null;
  archived?: boolean;
}

export type DayMode = "minimum" | "standard" | "deep";

export const MODES: Record<DayMode, { label: string; maxTasks: number; maxMinutes: number; maxDeep: number; blurb: string }> = {
  minimum: { label: "Minimum Day", maxTasks: 3, maxMinutes: 60, maxDeep: 0, blurb: "Essentials only. Protect the streak, not the output." },
  standard: { label: "Standard Day", maxTasks: 5, maxMinutes: 240, maxDeep: 1, blurb: "A balanced, realistic day with one focus block." },
  deep: { label: "Deep Work Day", maxTasks: 6, maxMinutes: 360, maxDeep: 3, blurb: "Fewer switches, longer focus blocks." },
};

export interface ScoreCtx {
  today: string;
  pillarWeight: (pillarId?: number | null) => number; // 0..1
  mode: DayMode;
}

export function scoreTask(t: TaskLike, ctx: ScoreCtx): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  const p = t.priority ?? 2;
  const pBase = p === 1 ? 30 : p === 2 ? 18 : 8;
  s += pBase;
  reasons.push(`P${p} +${pBase}`);

  const w = ctx.pillarWeight(t.pillar_id);
  const pw = Math.round(w * 25);
  if (pw) {
    s += pw;
    reasons.push(`Life-stage weight +${pw}`);
  }

  if (isRecurring(t)) {
    if (occursOn(t, ctx.today)) {
      s += 15;
      reasons.push("Scheduled today +15");
    }
  } else if (t.due_date) {
    const d = diffDays(ctx.today, t.due_date);
    if (d < 0) {
      const v = Math.min(30, 20 + -d * 2);
      s += v;
      reasons.push(`Overdue ${-d}d +${v}`);
    } else if (d === 0) {
      s += 20;
      reasons.push("Due today +20");
    } else if (d <= 3) {
      s += 10;
      reasons.push("Due within 3 days +10");
    }
  }

  if (t.essential) {
    s += 10;
    reasons.push("Essential +10");
  }
  const dur = t.duration_min ?? 30;
  if (t.deep && ctx.mode === "deep") {
    s += 8;
    reasons.push("Deep-work day fit +8");
  } else if (dur > 60 && ctx.mode !== "deep") {
    s -= 6;
    reasons.push("Long task on a lighter day -6");
  }
  if ((t.reschedule_count ?? 0) >= 3) reasons.push("Moved 3+ times: shrink it, split it or drop it");
  return { score: s, reasons };
}

/** Candidate tasks for a date: open one-offs due on/before date (or undated), and recurring tasks occurring that date. */
export function candidatesFor<T extends TaskLike>(tasks: T[], date: string, doneRecurring: Set<number>): T[] {
  return tasks.filter((t) => {
    if (t.archived) return false;
    if (isRecurring(t)) return t.status !== "dropped" && occursOn(t, date) && !doneRecurring.has(t.id);
    return t.status === "open" && (!t.due_date || t.due_date <= date);
  });
}

/** Choose a realistic plan within the mode's capacity. Everything else is "Later", never deleted. */
export function planDay<T extends TaskLike>(cands: T[], ctx: ScoreCtx) {
  const mode = MODES[ctx.mode];
  const scored = cands
    .map((t) => ({ task: t, ...scoreTask(t, ctx) }))
    .sort((a, b) => b.score - a.score || (a.task.duration_min ?? 30) - (b.task.duration_min ?? 30));
  const planned: typeof scored = [];
  const later: typeof scored = [];
  let minutes = 0;
  let deep = 0;
  for (const s of scored) {
    const dur = s.task.duration_min ?? 30;
    const isUndatedOneOff = !isRecurring(s.task) && !s.task.due_date;
    const fitsMode = ctx.mode === "minimum" ? !!s.task.essential : true;
    const deepOk = !s.task.deep || deep < mode.maxDeep;
    const fits = planned.length < mode.maxTasks && minutes + dur <= mode.maxMinutes;
    if (fitsMode && deepOk && fits && !isUndatedOneOff) {
      planned.push(s);
      minutes += dur;
      if (s.task.deep) deep++;
    } else later.push(s);
  }
  return { planned, later, minutes };
}
