"use client";
import { useEffect, useMemo, useState } from "react";
import { Sun, Moon, Check, ChevronLeft, ChevronRight, Clock, Repeat, CalendarDays, Plus } from "lucide-react";
import clsx from "clsx";
import { useList, api, type Row } from "@/lib/client";
import { addDays, weekRange, fmtDate, diffDays } from "@/lib/dates";
import { isRecurring, occursOn, describeRule } from "@/lib/recurrence";
import { usePillars, taskFields } from "./shared";
import { RecordForm } from "./RecordForm";
import { QuickTask } from "./QuickTask";
import { completeTask, uncompleteTask } from "./useDayPlan";

type Plan = { planned: { task: Row }[]; later: { task: Row }[]; doneToday: Row[]; completions: Row[]; loading: boolean };
type Item = { task: Row; done: boolean };

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const toHHMM = (n: number) => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((n % 60) + 60) % 60).padStart(2, "0")}`;
const fmtDur = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}` : `${n} min`);
function to12(t: string) { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; }

function useNowMin(tz: string) {
  const calc = () => { try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); return toMin(p); } catch { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); } };
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { setN(calc()); const t = setInterval(() => setN(calc()), 30000); return () => clearInterval(t); }, [tz]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}

/** Calendar-style view of a day: wake to bedtime, timed tasks in order, free gaps, and a live "now" line. */
export function DayTimeline({ today, plan, tz, settings, save }: { today: string; plan: Plan; tz: string; settings: Record<string, string>; save: (s: Record<string, unknown>) => Promise<unknown> }) {
  const [sel, setSel] = useState(today);
  useEffect(() => setSel(today), [today]);
  const [mon] = weekRange(sel);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(mon, i)), [mon]);
  const allTasks = useList("tasks");
  const weekComps = useList("task_completions", { from: week[0], to: week[6] });
  const { byId, options: pillarOpts } = usePillars();
  const milestones = useList("milestones");
  const msOpts = milestones.rows.map((m) => ({ value: m.id, label: m.title as string }));
  const [quick, setQuick] = useState<{ time?: string } | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const now = useNowMin(tz);
  const isToday = sel === today;
  const wake = settings.wake_time || "07:00";
  const bed = settings.bed_time || "23:00";

  // Tasks for the selected day.
  const items: Item[] = useMemo(() => {
    if (isToday) return [...plan.planned, ...plan.later].map((s) => ({ task: s.task, done: false })).concat(plan.doneToday.map((t) => ({ task: t, done: true })));
    return allTasks.rows.filter((t) => !t.archived && t.status !== "dropped").flatMap((t) => {
      if (isRecurring(t)) {
        const created = String(t.created_at ?? "").slice(0, 10);
        if ((created && sel < created) || !occursOn(t, sel)) return [];
        return [{ task: t, done: weekComps.rows.some((c) => c.task_id === t.id && c.date === sel && c.kind !== "skipped") }];
      }
      if (t.due_date === sel || String(t.completed_at ?? "").slice(0, 10) === sel) return [{ task: t, done: t.status === "done" }];
      return [];
    });
  }, [isToday, plan, allTasks.rows, weekComps.rows, sel]);

  const timed = items.filter((i) => i.task.scheduled_time).sort((a, b) => toMin(a.task.scheduled_time) - toMin(b.task.scheduled_time));
  const anytime = items.filter((i) => !i.task.scheduled_time);

  const dayDone = (d: string) => {
    const n = weekComps.rows.filter((c) => c.date === d && c.kind !== "skipped").length + allTasks.rows.filter((t) => t.status === "done" && String(t.completed_at ?? "").slice(0, 10) === d).length;
    return n;
  };

  async function toggle(i: Item) {
    if (!isToday) return;
    if (i.done) await uncompleteTask(i.task, today, plan.completions);
    else await completeTask(i.task, today);
  }

  // Build the ordered event list with gaps and the now marker.
  type Ev = { kind: "wake" | "bed" | "task" | "gap" | "now"; at: number; end?: number; item?: Item };
  const events: Ev[] = [];
  const wakeM = toMin(wake), bedM = toMin(bed) <= wakeM ? toMin(bed) + 1440 : toMin(bed);
  events.push({ kind: "wake", at: wakeM });
  let cursor = wakeM;
  for (const it of timed) {
    const at = toMin(it.task.scheduled_time);
    const end = at + Number(it.task.duration_min ?? 30);
    if (at - cursor >= 30) events.push({ kind: "gap", at: cursor, end: at });
    events.push({ kind: "task", at, end, item: it });
    cursor = Math.max(cursor, end);
  }
  if (bedM - cursor >= 30) events.push({ kind: "gap", at: cursor, end: bedM });
  events.push({ kind: "bed", at: bedM });
  if (isToday && now != null) {
    const nowAdj = now < wakeM - 120 ? now + 1440 : now;
    // A gap that contains "now" is split, so the line sits inside it and the free time ahead is accurate.
    const g = events.findIndex((e) => e.kind === "gap" && e.at < nowAdj && (e.end ?? e.at) > nowAdj);
    if (g !== -1) {
      const gap = events[g];
      const parts: Ev[] = [];
      if (nowAdj - gap.at >= 15) parts.push({ kind: "gap", at: gap.at, end: nowAdj });
      if ((gap.end ?? nowAdj) - nowAdj >= 15) parts.push({ kind: "gap", at: nowAdj, end: gap.end });
      events.splice(g, 1, ...parts);
    }
    let idx = events.findIndex((e) => e.at > nowAdj || (e.kind === "gap" && e.at === nowAdj));
    if (idx === -1) idx = events.length;
    events.splice(idx, 0, { kind: "now", at: nowAdj });
  }

  // Free time still ahead (for today: only after now).
  const from = isToday && now != null ? (now < wakeM - 120 ? now + 1440 : now) : -Infinity;
  const freeMin = events.filter((e) => e.kind === "gap").reduce((n, e) => n + Math.max(0, (e.end ?? e.at) - Math.max(e.at, from)), 0);
  const canAdd = sel >= today;
  const roundUp = (m: number) => { const base = isToday && now != null ? Math.max(m, now) : m; return Math.ceil(base / 15) * 15; };
  const nextSlot = () => { const g = events.find((e) => e.kind === "gap" && (e.end ?? 0) > roundUp(e.at)); return g ? toHHMM(roundUp(g.at)) : ""; };
  const plannedMin = timed.reduce((n, i) => n + Number(i.task.duration_min ?? 30), 0);

  return (
    <div>
      {/* Week strip */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight">{fmtDate(sel, { year: false }).replace(/^\w+,\s*/, "")} <span className="text-teal-300">{sel.slice(0, 4)}</span></h3>
        <div className="flex items-center gap-1">
          {!isToday && <button className="btn-ghost px-2 py-1 text-xs font-semibold text-teal-300" onClick={() => setSel(today)}>Today</button>}
          {canAdd && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setQuick({ time: nextSlot() })}><Plus size={14} />Add task</button>}
          <button className="btn-ghost p-1.5" aria-label="Previous week" onClick={() => setSel(addDays(sel, -7))}><ChevronLeft size={16} /></button>
          <button className="btn-ghost p-1.5" aria-label="Next week" onClick={() => setSel(addDays(sel, 7))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-7 gap-1">
        {week.map((d) => {
          const on = d === sel, isT = d === today, n = dayDone(d);
          return (
            <button key={d} onClick={() => setSel(d)} aria-pressed={on} aria-label={fmtDate(d, { weekday: true })} className="group flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors hover:bg-ink-850">
              <span className={clsx("text-[11px] font-semibold", isT ? "text-teal-300" : "muted")}>{fmtDate(d, { weekday: true }).slice(0, 2)}</span>
              <span className={clsx("grid h-10 w-10 place-items-center rounded-full text-[15px] font-semibold tabnum transition-all",
                isT ? "bg-teal-500 text-white shadow-md shadow-teal-500/30" : on ? "ring-2 ring-teal-500 text-teal-300" : "text-fog-100 group-hover:bg-ink-800")}>{Number(d.slice(8))}</span>
              <span className="flex h-1.5 gap-0.5">{n > 0 && Array.from({ length: Math.min(3, Math.ceil(n / 3)) }).map((_, k) => <span key={k} className="h-1.5 w-1.5 rounded-full bg-teal-500" />)}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2.5 py-1 font-medium"><CalendarDays size={12} />{timed.length} scheduled · {fmtDur(plannedMin)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-1 font-medium text-teal-300"><Clock size={12} />{fmtDur(freeMin)} free{isToday ? " left" : ""}</span>
        {!isToday && <span className="muted">{diffDays(today, sel) < 0 ? "Past day · view only" : "Upcoming · view only"}</span>}
      </div>

      {/* Timeline */}
      <ol className="relative">
        {events.map((e, k) => {
          if (e.kind === "now") return (
            <li key="now" className="relative my-1 flex items-center gap-2 py-1" aria-label="Now">
              <span className="w-[68px] shrink-0 text-right text-[11px] font-bold tabnum text-rose-500">{to12(toHHMM(e.at))}</span>
              <span className="relative z-10 ml-[3px] h-3 w-3 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
              <span className="h-0.5 flex-1 rounded-full bg-rose-500/70" />
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">NOW</span>
            </li>
          );
          if (e.kind === "gap") {
            const len = (e.end ?? e.at) - e.at;
            const past = isToday && now != null && (e.end ?? 0) <= (now < wakeM - 120 ? now + 1440 : now);
            return (
              <li key={`g${k}`} className={clsx("flex items-stretch gap-3", past && "opacity-40")}>
                <span className="w-[68px] shrink-0" />
                <span className="relative flex w-3 justify-center"><span className="w-px border-l border-dashed border-ink-600" /></span>
                {canAdd && !past ? (
                  <button onClick={() => setQuick({ time: toHHMM(roundUp(e.at)) })} className="group my-1 flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-transparent px-2 py-1.5 text-left transition-all hover:border-teal-500/50 hover:bg-teal-500/5" aria-label={`Add a task at ${toHHMM(roundUp(e.at))}`}>
                    <span className="text-[11px] muted">Available to plan</span>
                    <span className="text-sm font-bold text-teal-300">{fmtDur(len)}</span>
                    <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] tabnum muted">{toHHMM(e.at)}–{toHHMM(e.end ?? e.at)}</span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-300 opacity-70 transition-opacity group-hover:opacity-100"><Plus size={12} />Add here</span>
                  </button>
                ) : (
                  <span className="flex flex-1 flex-wrap items-center gap-x-3 px-2 py-2.5">
                    <span className="text-[11px] muted">{past ? "Free time" : "Available to plan"}</span>
                    <span className="text-sm font-bold text-teal-300">{fmtDur(len)}</span>
                    <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] tabnum muted">{toHHMM(e.at)}–{toHHMM(e.end ?? e.at)}</span>
                  </span>
                )}
              </li>
            );
          }
          if (e.kind === "wake" || e.kind === "bed") {
            const wakeEv = e.kind === "wake";
            return <AnchorRow key={e.kind} wakeEv={wakeEv} time={wakeEv ? wake : bed} onSave={(t) => save(wakeEv ? { wake_time: t } : { bed_time: t })} />;
          }
          const it = e.item!; const t = it.task;
          const p = byId.get(t.pillar_id); const color = (p?.color as string) ?? "#94a3b8";
          const nowA = now != null ? (now < wakeM - 120 ? now + 1440 : now) : null;
          const live = isToday && nowA != null && e.at <= nowA && nowA < (e.end ?? e.at) && !it.done;
          const late = isToday && nowA != null && (e.end ?? e.at) <= nowA && !it.done;
          return (
            <li key={`t${t.id}`} className="flex items-stretch gap-3 py-1">
              <div className="flex w-[68px] shrink-0 flex-col items-end justify-center text-right">
                <span className={clsx("text-[12px] font-semibold tabnum", late ? "text-amber-300" : "")}>{to12(t.scheduled_time)}</span>
                <span className="mt-0.5 rounded-full border border-ink-700 px-1.5 text-[10px] font-medium tabnum muted">{fmtDur(Number(t.duration_min ?? 30))}</span>
              </div>
              <div className="relative flex w-3 shrink-0 flex-col items-center">
                <span className="w-0.5 flex-1" style={{ background: `${color}55` }} />
                <span className="my-1 h-3 w-3 rounded-full ring-4" style={{ background: color, ["--tw-ring-color" as string]: `${color}26` }} />
                <span className="w-0.5 flex-1" style={{ background: `${color}55` }} />
              </div>
              <div className={clsx("card group flex min-w-0 flex-1 items-center gap-3 p-3 transition-all", live && "ring-2 ring-teal-500/60", it.done && "opacity-60")}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
                  {isRecurring(t) ? <Repeat size={16} /> : <CalendarDays size={16} />}
                </span>
                <div role="button" tabIndex={0} title="Edit task" onClick={() => setEdit(t)} onKeyDown={(ev) => { if (ev.key === "Enter") setEdit(t); }} className="min-w-0 flex-1 cursor-pointer">
                  <div className={clsx("truncate text-sm font-semibold group-hover:text-teal-300", it.done && "line-through decoration-fog-500")}>{t.title}</div>
                  <div className="truncate text-[11px] muted">{toHHMM(e.at)}–{toHHMM(e.end ?? e.at)} · {(p?.name as string) ?? "No area"}{isRecurring(t) ? ` · ${describeRule(t.recurrence)}` : ""}</div>
                  {live && <div className="mt-0.5 text-[11px] font-semibold text-teal-300">Happening now</div>}
                </div>
                {isToday ? (
                  <button onClick={() => toggle(it)} aria-label={it.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                    className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90", it.done ? "border-transparent text-white" : "border-ink-600 text-transparent hover:border-teal-500 hover:text-teal-500/60")}
                    style={it.done ? { background: color } : undefined}><Check size={15} strokeWidth={3} /></button>
                ) : it.done ? <Check size={16} className="text-teal-500" /> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Untimed */}
      {anytime.length > 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-ink-600 p-3">
          <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Anytime today</span><span className="text-[11px] muted">Give a task a time to place it on the timeline</span></div>
          <ul className="space-y-1">
            {anytime.map((it) => <AnytimeRow key={it.task.id} it={it} color={(byId.get(it.task.pillar_id)?.color as string) ?? "#94a3b8"} canTick={isToday} onToggle={() => toggle(it)} onEdit={() => setEdit(it.task)} />)}
          </ul>
        </div>
      )}

      <QuickTask open={!!quick} onClose={() => setQuick(null)} date={sel} today={today} time={quick?.time} timed={timed.map((i) => i.task)} />
      <RecordForm table="tasks" open={!!edit} onClose={() => setEdit(null)} title="Edit task" initial={edit} fields={taskFields(pillarOpts, msOpts)} allowArchive />
    </div>
  );
}

function AnchorRow({ wakeEv, time, onSave }: { wakeEv: boolean; time: string; onSave: (t: string) => void }) {
  const [edit, setEdit] = useState(false);
  return (
    <li className="flex items-stretch gap-3 py-1">
      <div className="flex w-[68px] shrink-0 items-center justify-end text-[12px] font-semibold tabnum">{to12(time)}</div>
      <div className="flex w-3 shrink-0 flex-col items-center justify-center"><span className={clsx("h-3 w-3 rounded-full ring-4", wakeEv ? "bg-amber-400 ring-amber-400/25" : "bg-indigo-500 ring-indigo-500/25")} /></div>
      <div className="card flex flex-1 items-center gap-3 p-3" style={{ background: wakeEv ? "linear-gradient(90deg, rgba(251,191,36,0.12), transparent 60%)" : "linear-gradient(90deg, rgba(99,102,241,0.12), transparent 60%)" }}>
        <span className={clsx("grid h-10 w-10 place-items-center rounded-xl", wakeEv ? "bg-amber-400/20 text-amber-500" : "bg-indigo-500/15 text-indigo-500")}>{wakeEv ? <Sun size={18} /> : <Moon size={18} />}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{wakeEv ? "Wake up" : "Wind down and sleep"}</div>
          {edit ? (
            <input type="time" autoFocus defaultValue={time} className="input mt-1 w-32 py-1 text-xs" onBlur={(e) => { setEdit(false); if (e.target.value && e.target.value !== time) onSave(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          ) : (
            <button className="text-[11px] muted hover:text-teal-300 hover:underline" onClick={() => setEdit(true)}>{wakeEv ? "Wake-up" : "Bedtime"} set to {to12(time)} · change</button>
          )}
        </div>
      </div>
    </li>
  );
}

function AnytimeRow({ it, color, canTick, onToggle, onEdit }: { it: Item; color: string; canTick: boolean; onToggle: () => void; onEdit: () => void }) {
  const [setting, setSetting] = useState(false);
  const t = it.task;
  return (
    <li className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-ink-850">
      {canTick ? (
        <button onClick={onToggle} aria-label={it.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} className={clsx("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all", it.done ? "border-transparent text-white" : "border-ink-600 text-transparent hover:border-teal-500")} style={it.done ? { background: color } : undefined}><Check size={11} strokeWidth={3.2} /></button>
      ) : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <button onClick={onEdit} title="Edit task" className={clsx("min-w-0 flex-1 truncate text-left text-sm hover:text-teal-300", it.done && "text-fog-400 line-through")}>{t.title}</button>
      <span className="text-[10px] tabnum muted">{fmtDur(Number(t.duration_min ?? 30))}</span>
      {!it.done && (setting ? (
        <input type="time" autoFocus aria-label={`Time for ${t.title}`} className="input w-28 py-0.5 text-xs" onBlur={async (e) => { setSetting(false); if (e.target.value) await api.update("tasks", t.id, { scheduled_time: e.target.value }); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      ) : (
        <button className="inline-flex items-center gap-1 rounded-full border border-ink-700 px-2 py-0.5 text-[11px] font-medium text-fog-400 transition-colors hover:border-teal-500 hover:text-teal-300" onClick={() => setSetting(true)}><Plus size={11} />Time</button>
      ))}
    </li>
  );
}
