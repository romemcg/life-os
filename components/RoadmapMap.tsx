"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { Shield, Briefcase, PiggyBank, TrendingUp, Home, Mountain, Lock, CheckCircle2, Circle, Infinity as InfinityIcon, ChevronRight, ChevronDown, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { Card, Progress, PillarDot } from "./ui";
import { useList, type Row } from "@/lib/client";
import { STAGES, project, firstMonthReaching } from "@/lib/stages";
import { addDays, addMonths, ageOn, fmtDate, fmtMonth, diffDays } from "@/lib/dates";
import { occurrencesBetween, isRecurring } from "@/lib/recurrence";

const ICONS: Record<string, typeof Shield> = { shield: Shield, briefcase: Briefcase, piggy: PiggyBank, trending: TrendingUp, home: Home, mountain: Mountain };

type Prog = { pct: number; auto: boolean; done: number; total: number };
type StageState = "done" | "now" | "next" | "later";

/**
 * The roadmap answers three questions, top to bottom:
 * 1. Where am I right now, and what do I do next?
 * 2. What is the path to 2035, in order?
 * 3. Roughly when do I get to each stage, at the pace I am actually keeping?
 */
export function RoadmapMap({ milestones, tasks, byId, birth, today, progressOf, onOpen }: {
  milestones: Row[]; tasks: Row[]; projects: Row[]; byId: Map<number, Row>; birth: string; today: string;
  progressOf: (m: Row) => Prog; onOpen: (m: Row) => void;
}) {
  const live = milestones.filter((m) => m.status !== "dropped");
  const stageInfo = STAGES.map((s) => {
    const ms = live.filter((m) => (m.stage ?? 2) === s.id);
    const done = ms.filter((m) => m.status === "done").length;
    const pct = ms.length ? Math.round(ms.reduce((a, m) => a + progressOf(m).pct, 0) / ms.length) : 0;
    return { ...s, ms, done, pct, isStable: ms.length > 0 && done === ms.length };
  });
  const currentIdx = Math.max(0, stageInfo.findIndex((s) => !s.isStable));
  const current = stageInfo[currentIdx];
  const stateOf = (i: number): StageState => (i < currentIdx ? "done" : i === currentIdx ? "now" : i === currentIdx + 1 ? "next" : "later");

  // Pace: your last 14 days of habits and routines, or full consistency until there is enough data.
  const c = useConsistency(today, tasks);
  const enough = c.score !== null && c.daysTracked >= 5;
  const currentPace = enough ? Math.max(0.15, Math.min(1.1, c.score! / 0.8)) : null;
  const horizon = Math.max(12, Math.round(diffDays(today, "2035-12-31") / 30.44));
  const startPos = currentIdx + current.pct / 100;
  const start = today.slice(0, 7) + "-01";
  const series = useMemo(() => ({
    consistent: project(startPos, 1, horizon),
    current: currentPace !== null ? project(startPos, currentPace, horizon) : null,
    drifting: project(startPos, 0.3, horizon),
  }), [startPos, horizon, currentPace]);
  const est = series.current ?? series.consistent;
  const monthAt = (s: number[] | null, level: number) => {
    if (!s) return null;
    const i = firstMonthReaching(s, level);
    return i === null ? null : addMonths(start, i);
  };

  return (
    <div className="space-y-4">
      <NowCard s={current} birth={birth} today={today} byId={byId} progressOf={progressOf} onOpen={onOpen} finishBy={monthAt(est, current.id)} />
      <Path stageInfo={stageInfo} stateOf={stateOf} current={current} birth={birth} today={today} byId={byId} progressOf={progressOf} onOpen={onOpen}
        window={(i) => ({ from: i <= currentIdx ? null : monthAt(est, i), to: monthAt(est, i + 1) })} paceLabel={enough ? "your current pace" : "full consistency"} />
      <WhenCard series={series} c={c} enough={enough} start={start} birth={birth} startPos={startPos} horizon={horizon} currentIdx={currentIdx} monthAt={monthAt} />
      <AlwaysOn ms={live.filter((m) => (m.stage ?? 2) === 0)} byId={byId} onOpen={onOpen} />
    </div>
  );
}

const when = (d: string | null, birth: string) => (d ? `${fmtMonth(d)} (age ${ageOn(birth, d)})` : "after 2035");

/* ---------- 1. Right now ---------- */

function NowCard({ s, birth, today, byId, progressOf, onOpen, finishBy }: {
  s: (typeof STAGES)[number] & { ms: Row[]; done: number; pct: number }; birth: string; today: string; byId: Map<number, Row>;
  progressOf: (m: Row) => Prog; onOpen: (m: Row) => void; finishBy: string | null;
}) {
  const Icon = ICONS[s.icon];
  const open = s.ms.filter((m) => m.status !== "done").sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999") || (a.priority ?? 2) - (b.priority ?? 2));
  const focus = open[0];
  const p = focus ? byId.get(focus.pillar_id) : undefined;
  return (
    <section className="card fade-up overflow-hidden border-teal-500/40">
      <div className="bg-teal-500/5 p-4 sm:p-6">
        <p className="eyebrow text-teal-300">Right now · Stage {s.id} of {STAGES.length}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/15 text-teal-400"><Icon size={20} /></span>
          <h2 className="text-xl font-semibold">{s.name}</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-fog-300">{s.focus}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-xs muted"><span>{s.done} of {s.ms.length} milestones done</span><span>{s.pct}%</span></div>
            <Progress value={s.pct} />
            <p className="mt-2 text-xs muted"><span className="text-fog-400">You move on when: </span>{s.stable}</p>
          </div>
          <div className="text-xs muted sm:text-right">
            {finishBy ? <>At this pace you finish this stage around <b className="text-fog-100">{when(finishBy, birth)}</b>.</> : null}
          </div>
        </div>
      </div>
      {focus ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-800 px-4 py-3 sm:px-6">
          <span className="text-xs font-semibold text-teal-300">Do this next</span>
          <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(focus)}>
            <span className="flex items-center gap-1.5 text-sm font-medium hover:text-teal-200"><PillarDot color={p?.color} />{focus.title}</span>
            <span className="block text-xs muted">
              {focus.next_action ? focus.next_action : "Open it to add the first task."}
              {focus.target_date ? ` · by ${fmtDate(focus.target_date)}` : ""}
              {focus.target_date && focus.target_date < today ? " (past date)" : ""}
            </span>
          </button>
          <Link href="/today" className="btn-primary text-xs">Plan it in Today <ArrowRight size={13} /></Link>
        </div>
      ) : (
        <div className="border-t border-ink-800 px-4 py-3 text-sm muted sm:px-6">No open milestones in this stage. Add one in <Link href="/vision" className="underline">Vision</Link> and set its stage to {s.id}.</div>
      )}
    </section>
  );
}

/* ---------- 2. The path ---------- */

function Path({ stageInfo, stateOf, current, birth, today, byId, progressOf, onOpen, window, paceLabel }: {
  stageInfo: ((typeof STAGES)[number] & { ms: Row[]; done: number; pct: number })[]; stateOf: (i: number) => StageState;
  current: { id: number; name: string }; birth: string; today: string; byId: Map<number, Row>; progressOf: (m: Row) => Prog; onOpen: (m: Row) => void;
  window: (i: number) => { from: string | null; to: string | null }; paceLabel: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const LABEL: Record<StageState, string> = { done: "Done", now: "You are here", next: "Up next", later: "Later" };
  return (
    <Card title="The path to 2035" action={<span className="text-[11px] muted">Dates estimated at {paceLabel}</span>}>
      <p className="-mt-1 mb-4 text-sm text-fog-300">Six stages, done in order. Only the current one needs your energy. The rest wait, so home, car and business don&apos;t compete with getting a job.</p>
      <ol className="relative">
        {stageInfo.map((s, i) => {
          const st = stateOf(i);
          const Icon = ICONS[s.icon];
          const w = window(i);
          const expanded = openId === s.id;
          const last = i === stageInfo.length - 1;
          return (
            <li key={s.id} className="relative pl-14">
              {!last && <span className={clsx("absolute left-[21px] top-11 h-[calc(100%-2.75rem)] w-0.5", st === "done" ? "bg-teal-500" : "bg-ink-700")} aria-hidden />}
              <span className={clsx("absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full border-2",
                st === "done" && "border-teal-500 bg-teal-500 text-white",
                st === "now" && "border-teal-500 bg-ink-900 text-teal-400 shadow-[0_0_0_6px_rgba(47,154,142,0.15)]",
                (st === "next" || st === "later") && "border-ink-600 bg-ink-850 text-fog-500")}>
                {st === "done" ? <CheckCircle2 size={20} /> : <Icon size={18} />}
              </span>
              <button className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 pb-1 text-left" onClick={() => setOpenId(expanded ? null : s.id)} aria-expanded={expanded}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={clsx("text-sm font-semibold", st === "later" && "text-fog-400")}>{s.id}. {s.name}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", st === "now" ? "bg-teal-500/15 text-teal-300" : st === "done" ? "bg-sky-500/10 text-sky-300" : "bg-ink-800 text-fog-400")}>{LABEL[st]}</span>
                  </div>
                  <p className={clsx("mt-0.5 text-xs", st === "later" ? "text-fog-500" : "text-fog-300")}>{s.focus}</p>
                </div>
                <div className="shrink-0 text-right text-[11px] muted">
                  {st === "done" ? "Completed" : st === "now" ? <>Until ~{w.to ? fmtMonth(w.to) : "2035+"}</> : <>{w.from ? `${fmtMonth(w.from)} (age ${ageOn(birth, w.from)})` : "After 2035"}{s.id === STAGES.length ? " onward" : ""}</>}
                  <div className="mt-0.5 flex items-center justify-end gap-0.5 text-fog-400">{s.ms.length} milestone{s.ms.length === 1 ? "" : "s"} {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</div>
                </div>
              </button>
              <div className={clsx("pb-6", expanded && "pt-2")}>
                {expanded && (
                  <div className="rounded-xl border border-ink-700">
                    {(st === "next" || st === "later") && <p className="flex items-center gap-1.5 border-b border-ink-800 px-3 py-2 text-xs muted"><Lock size={12} />Starts after Stage {current.id}: {current.name} is done. Nothing to do here yet.</p>}
                    <ul className="divide-y divide-ink-800">
                      {s.ms.map((m) => {
                        const p = byId.get(m.pillar_id);
                        const isDone = m.status === "done";
                        const prog = progressOf(m);
                        return (
                          <li key={m.id}>
                            <button className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-850" onClick={() => onOpen(m)}>
                              <span className={isDone ? "text-teal-400" : "text-fog-500"}>{isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}</span>
                              <span className="min-w-0 flex-1">
                                <span className={clsx("block text-sm", isDone && "line-through muted")}>{m.title}</span>
                                <span className="flex flex-wrap items-center gap-x-2 text-[11px] muted">
                                  <span className="inline-flex items-center gap-1"><PillarDot color={p?.color} />{p?.name}</span>
                                  {m.target_date ? <span className={clsx(m.target_date < today && !isDone && "text-amber-300")}>{fmtDate(m.target_date)} · age {ageOn(birth, m.target_date)}</span> : m.prerequisites ? <span>Needs: {m.prerequisites}</span> : null}
                                </span>
                              </span>
                              {st === "now" && !isDone && <span className="hidden w-20 sm:block"><Progress value={prog.pct} color={p?.color} /></span>}
                              <ChevronRight size={14} className="text-fog-500" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                      {s.ms.length === 0 && <li className="px-3 py-2 text-sm muted">No milestones yet. Add one in Vision and set its stage to {s.id}.</li>}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ---------- 3. When do I get there ---------- */

function WhenCard({ series, c, enough, start, birth, startPos, horizon, currentIdx, monthAt }: {
  series: { consistent: number[]; current: number[] | null; drifting: number[] }; c: ReturnType<typeof useConsistency>; enough: boolean;
  start: string; birth: string; startPos: number; horizon: number; currentIdx: number; monthAt: (s: number[] | null, level: number) => string | null;
}) {
  const [chart, setChart] = useState(false);
  const upcoming = STAGES.filter((s) => s.id > currentIdx + 1);
  const data = series.consistent.map((v, i) => ({ m: fmtMonth(addMonths(start, i)), Consistent: v, "Your current pace": series.current?.[i] ?? null, Drifting: series.drifting[i] }));
  return (
    <Card title="When will I get there?">
      <p className="-mt-1 mb-3 text-sm text-fog-300">
        Your daily consistency decides how fast you move through the stages.{" "}
        {enough
          ? <>Over the last 14 days you kept <b>{Math.round(c.score! * 100)}%</b> of your habits and routines.</>
          : <>Tick habits and routines for about 5 days and your own pace appears here. Until then, dates assume full consistency.</>}
      </p>
      {upcoming.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="text-left text-[11px] muted"><th className="pb-1.5 font-medium">You reach</th>{series.current && <th className="pb-1.5 font-medium text-sky-300">At your pace</th>}<th className="pb-1.5 font-medium text-teal-300">If fully consistent</th><th className="pb-1.5 font-medium text-rose-300">If you drift</th></tr></thead>
            <tbody>
              {upcoming.map((s) => (
                <tr key={s.id} className="border-t border-ink-800">
                  <td className="py-1.5">{s.id}. {s.name}</td>
                  {series.current && <td className="py-1.5 tabnum">{when(monthAt(series.current, s.id - 1), birth)}</td>}
                  <td className="py-1.5 tabnum">{when(monthAt(series.consistent, s.id - 1), birth)}</td>
                  <td className="py-1.5 tabnum text-rose-300/90">{when(monthAt(series.drifting, s.id - 1), birth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-fog-500">A rough guide, not a promise. &ldquo;Drift&rdquo; means doing about a third of what you plan. Real dates also depend on the job market and your actual numbers.</p>
      <button className="mt-2 text-xs text-fog-400 hover:text-fog-100" onClick={() => setChart((v) => !v)}>{chart ? "Hide chart" : "Show as a chart"}</button>
      {chart && (
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="m" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} interval={Math.ceil(horizon / 8)} />
              <YAxis domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} width={64}
                tickFormatter={(v: number) => (v === 0 ? "Start" : STAGES[v - 1]?.short ?? "")} />
              <Tooltip contentStyle={{ background: "var(--chart-tip-bg)", border: "1px solid var(--chart-tip-border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => { const s = Math.min(5, Math.floor(v)); return v >= 6 ? "Freedom reached" : `Stage ${s + 1}: ${STAGES[s].name}`; }} />
              <ReferenceLine y={startPos} stroke="var(--chart-axis)" strokeDasharray="3 3" />
              {series.current && <Line dataKey="Your current pace" stroke="#6aa3ff" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
              <Line dataKey="Consistent" stroke="#2f9a8e" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="Drifting" stroke="#e05d6f" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ---------- Always on ---------- */

function AlwaysOn({ ms, byId, onOpen }: { ms: Row[]; byId: Map<number, Row>; onOpen: (m: Row) => void }) {
  return (
    <Card title="Alongside every stage">
      <div className="flex items-start gap-2 text-sm">
        <InfinityIcon size={16} className="mt-0.5 shrink-0 text-violet-300" />
        <p className="flex-1 text-fog-300">Health basics, faith, family and friends never wait for a stage. Keep them at a steady minimum through Habits, Morning and Relationships.</p>
      </div>
      {ms.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{ms.map((m) => <li key={m.id}><button onClick={() => onOpen(m)} className="chip border-ink-600 px-2.5 py-1 text-xs text-fog-300 hover:text-fog-100"><PillarDot color={byId.get(m.pillar_id)?.color} />{m.title}</button></li>)}</ul>}
    </Card>
  );
}

/** How consistent have you actually been? Last 14 days of habits vs targets and routine tasks vs planned. */
function useConsistency(today: string, tasks: Row[]) {
  const from = addDays(today, -13);
  const habits = useList("habits", { active: true });
  const checks = useList("habit_checkins", { from, to: today });
  const comps = useList("task_completions", { from, to: today });
  return useMemo(() => {
    const habitTarget = habits.rows.reduce((s, h) => s + Math.min(7, h.target_per_week ?? 7) * 2, 0);
    const habitPct = habitTarget ? Math.min(1, checks.rows.length / habitTarget) : null;
    const rec = tasks.filter((t) => isRecurring(t) && !t.archived && t.status !== "dropped");
    const yesterday = addDays(today, -1);
    const planned = rec.reduce((s, t) => s + occurrencesBetween(t, from, yesterday), 0);
    const done = comps.rows.filter((c) => c.kind !== "skipped" && c.date < today).length;
    const routinePct = planned ? Math.min(1, done / planned) : null;
    const parts = [habitPct, routinePct].filter((x) => x !== null) as number[];
    const daysTracked = new Set([...checks.rows.map((c) => c.date), ...comps.rows.map((c) => c.date)]).size;
    return { score: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null, habitPct, routinePct, daysTracked };
  }, [habits.rows, checks.rows, comps.rows, tasks, today, from]);
}
