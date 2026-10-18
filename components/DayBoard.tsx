"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Lock, Repeat } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { useList, api, type Row } from "@/lib/client";
import { weekRange, fmtDate } from "@/lib/dates";
import { STAGES } from "@/lib/stages";
import { isRecurring } from "@/lib/recurrence";
import { TaskRow } from "./TaskRow";
import { Progress, Badge } from "./ui";
import { completeTask, uncompleteTask } from "./useDayPlan";
import { LogPrompt, autoLog, useTrackOptions } from "./TaskLog";

type Scored = { task: Row; score: number; reasons: string[] };
type Plan = { planned: Scored[]; later: Scored[]; doneToday: Row[]; completions: Row[]; allTasks: Row[]; weekCounts?: Map<number, number>; loading: boolean };

/** Order inside an area: overdue, timed, due today, routines, anytime. */
function rank(t: Row, today: string) {
  if (!isRecurring(t) && t.due_date && t.due_date < today) return 0;
  if (t.scheduled_time) return 1;
  if (!isRecurring(t) && t.due_date === today) return 2;
  if (isRecurring(t)) return 3;
  return 4;
}

/**
 * Everything that can be done today, grouped by life area.
 * Covers routines (recurring tasks and habits) and one day tasks (overdue, due today, undated).
 * Areas that belong to a later roadmap stage are folded away unless they already have work today.
 */
export function DayBoard({ today, plan, pillars, minimal }: {
  today: string;
  plan: Plan;
  pillars: Row[];
  minimal: boolean;
}) {
  const milestones = useList("milestones");
  const [showLater, setShowLater] = useState(false);
  const track = useTrackOptions();
  const [logFor, setLogFor] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  // Linked trackers (habit history, Bible plan, meditation) are kept in sync by the server.
  const untick = (task: Row) => uncompleteTask(task, today, plan.completions);
  async function tick(task: Row) {
    await completeTask(task, today);
    if (!task.log_to) return;
    const r = await autoLog(task, today, track);
    if (r.prompt) setLogFor(task);
    setNote(r.message);
  }

  // Current roadmap stage, same rule as the dashboard: first stage not fully done.
  const lockedPillars = useMemo(() => {
    const live = milestones.rows.filter((m) => m.status !== "dropped");
    const stages = STAGES.map((s) => {
      const list = live.filter((m) => (m.stage ?? 2) === s.id);
      return { id: s.id, stable: list.length > 0 && list.every((m) => m.status === "done") };
    });
    const cur = stages.find((s) => !s.stable)?.id ?? STAGES[STAGES.length - 1].id;
    const locked = new Map<number, number>();
    for (const p of pillars) {
      const mine = live.filter((m) => m.pillar_id === p.id);
      if (!mine.length) continue;
      const open = mine.some((m) => (m.stage ?? 2) === 0 || (m.stage ?? 2) <= cur);
      if (!open) locked.set(p.id, Math.min(...mine.map((m) => m.stage ?? 9)));
    }
    return locked;
  }, [milestones.rows, pillars]);

  const suggested = new Set(plan.planned.map((s) => s.task.id));
  const known = new Set(pillars.map((p) => p.id as number));
  const area = (r: Row) => { const id = (r.pillar_id as number | null) ?? null; return id != null && known.has(id) ? id : null; };
  const open: Scored[] = [...plan.planned, ...plan.later];

  const groups = [...pillars.map((p) => ({ id: p.id as number | null, p })), { id: null as number | null, p: null as Row | null }].map(({ id, p }) => {
    const tasks = open.filter((s) => area(s.task) === id).sort((a, b) => rank(a.task, today) - rank(b.task, today) || b.score - a.score);
    const done = plan.doneToday.filter((t) => area(t) === id);
    const total = tasks.length + done.length;
    const complete = done.length;
    return { id, p, tasks, done, total, complete, lockedAt: id != null ? lockedPillars.get(id) : undefined };
  });

  const active = groups.filter((g) => g.p && (g.lockedAt === undefined || g.total > 0));
  const unassigned = groups.find((g) => !g.p)!;
  const later = groups.filter((g) => g.p && g.lockedAt !== undefined && g.total === 0);
  const all = groups.reduce((a, g) => a + g.total, 0);
  const allDone = groups.reduce((a, g) => a + g.complete, 0);
  const minutesLeft = open.reduce((m, s) => m + ((s.task.duration_min as number) ?? 30), 0);

  function Section({ g }: { g: (typeof groups)[number] }) {
    const color = (g.p?.color as string) ?? "#8c97ad";
    return (
      <section className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/70 transition-shadow duration-200 hover:shadow-md">
        <header className="flex items-center gap-2.5 border-b border-ink-800 px-3.5 py-3" style={{ background: /^#[0-9a-f]{6}$/i.test(color) ? `linear-gradient(90deg, ${color}14, transparent 70%)` : undefined }}>
          <span className="h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 0 3px ${color}26` }} aria-hidden />
          <h3 className="text-sm font-semibold">{g.p ? (g.p.name as string) : "No life area"}</h3>
          {g.lockedAt !== undefined && <Badge tone="gray" title="This area belongs to a later stage">Stage {g.lockedAt}</Badge>}
          {g.total > 0 && g.complete === g.total ? <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-300"><Check size={12} strokeWidth={3} />Done</span> : <span className="ml-auto text-xs font-medium tabnum muted">{g.complete}/{g.total}</span>}
          <div className="w-20"><Progress value={g.total ? (g.complete / g.total) * 100 : 0} color={color} /></div>
        </header>
        <div className="px-1 py-1">
          {g.total === 0 && <p className="px-2 py-2 text-xs muted">Nothing for today.</p>}
          {!g.p && g.tasks.length > 0 && <p className="px-2 pt-1 text-[11px] text-amber-300">These have no life area yet. Give them one in <Link href="/vision" className="underline">Vision</Link> so they count towards your roadmap.</p>}
          <div className="divide-y divide-ink-800">
            {g.tasks.map((s) => (
              <TaskRow
                key={s.task.id}
                task={s.task}
                today={today}
                pillarColor={color}
                reasons={s.reasons}
                suggested={suggested.has(s.task.id)}
                weekCount={isRecurring(s.task) ? plan.weekCounts?.get(s.task.id) ?? 0 : undefined}
                onToggle={() => tick(s.task)}
              />
            ))}
            {g.done.map((t) => (
              <TaskRow key={`d${t.id}`} task={t} today={today} done pillarColor={color} weekCount={isRecurring(t) ? plan.weekCounts?.get(t.id) ?? 0 : undefined} onToggle={() => untick(t)} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs muted">
        <span className="font-medium text-fog-100 tabnum">{allDone} of {all} done</span>
        <span className="tabnum">{minutesLeft} min of tasks left</span>
        <span>Suggested = what the planner would pick for your day mode{minimal ? " (essentials only)" : ""}.</span>
        <Link href="/vision" className="ml-auto text-teal-300 hover:underline">Add, edit or move tasks in Vision</Link>
      </div>
      {logFor && <LogPrompt task={logFor} today={today} onDone={(msg) => { setLogFor(null); setNote(msg ?? ""); }} />}
      {note && !logFor && <p className="rounded-lg bg-ink-850 px-3 py-2 text-xs text-teal-300" role="status">{note} <button className="ml-2 text-fog-500 hover:text-fog-100" onClick={() => setNote("")}>×</button></p>}
      {plan.loading ? (
        <div className="py-6 text-center text-sm muted">Loading…</div>
      ) : (
        <>
          {active.map((g) => <Section key={g.id} g={g} />)}
          {unassigned.total > 0 && <Section g={unassigned} />}
          {later.length > 0 && (
            <div>
              <button className="flex items-center gap-1 text-xs text-fog-400 hover:text-fog-100" onClick={() => setShowLater((v) => !v)}>
                {showLater ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Lock size={12} /> Later stages ({later.length}) · nothing needed from these yet
              </button>
              {showLater && <div className="mt-2 space-y-3">{later.map((g) => <Section key={g.id} g={g} />)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
