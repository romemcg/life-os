"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { BatteryLow, Zap, Target, PartyPopper } from "lucide-react";
import { BigRing, StreakPill, Confetti } from "@/components/Consistency";
import { useStreak } from "@/components/useStreak";
import { PageHeader, Card, Segmented, Badge, Progress, Empty, useToast, PillarDot, clsx } from "@/components/ui";
import { RecordForm } from "@/components/RecordForm";
import { TaskRow } from "@/components/TaskRow";
import { usePillars, taskFields } from "@/components/shared";
import { useDayPlan, completeTask, uncompleteTask, rescheduleTask } from "@/components/useDayPlan";
import { DayBoard } from "@/components/DayBoard";
import { DayTimeline } from "@/components/DayTimeline";
import { DailyBite } from "@/components/DailyBite";
import { MissedCard } from "@/components/Missed";
import { SpendForm, useSources, methodLabel, CatIcon } from "@/components/Spending";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { WeeklyTargets, Upcoming } from "@/components/widgets";
import { TodayCheckIns } from "@/components/CheckIns";
import { VerseCard } from "@/components/Verse";
import { useSettings, useToday, useList, api, money, type Row } from "@/lib/client";
import { MODES, type DayMode } from "@/lib/priority";
import { ageOn, fmtDate, weekRange, addDays, relativeDay } from "@/lib/dates";

export default function TodayPage() {
  const { settings, ready, save } = useSettings();
  const [view, setView] = useState<"timeline" | "areas">("timeline");
  useEffect(() => { try { const v = localStorage.getItem("lifeos-today-view"); if (v === "areas" || v === "timeline") setView(v); } catch {} }, []);
  const chooseView = (v: "timeline" | "areas") => { setView(v); try { localStorage.setItem("lifeos-today-view", v); } catch {} };
  const today = useToday(settings.timezone);
  const journal = useList("journal", { date: today });
  const entry = journal.rows[0];
  const mode = ((entry?.mode as DayMode) || (settings.day_mode as DayMode) || "standard") as DayMode;
  const pinned = useMemo(() => ((entry?.pinned as number[]) ?? []), [entry]);
  const plan = useDayPlan(today, mode, pinned);
  const { pillars, options: pillarOpts } = usePillars();
  const milestones = useList("milestones");
  const msOpts = milestones.rows.map((m) => ({ value: m.id, label: m.title as string }));
  const projectsList = useList("projects", { status: "active" });
  const projOpts = projectsList.rows.map((p) => ({ value: p.id, label: p.title as string }));
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const { toast, node } = useToast();

  async function saveJournal(patch: Record<string, unknown>) {
    if (entry) await api.update("journal", entry.id, patch);
    else await api.create("journal", { date: today, mode, ...patch });
  }

  // Top 3 = your starred tasks that are still open in today's plan, topped up by the engine's ranking.
  const top3: number[] = useMemo(() => {
    const open = plan.planned.map((p) => p.task.id);
    const chosen = ((entry?.top3 as number[]) ?? []).filter((id) => open.includes(id));
    for (const id of open) if (chosen.length < 3 && !chosen.includes(id)) chosen.push(id);
    return chosen;
  }, [entry, plan.planned]);

  function toggleStar(id: number) {
    const cur = new Set(top3);
    if (cur.has(id)) cur.delete(id);
    else {
      if (cur.size >= 3) return toast("Top 3 is full. Unstar one first.", "err");
      cur.add(id);
    }
    saveJournal({ top3: [...cur] });
  }

  const capacity = MODES[mode];
  const streak = useStreak(today, 7);
  const planned = plan.planned.length + plan.doneToday.length;
  const left = plan.planned.length;
  const pct = planned ? Math.round((plan.doneToday.length / planned) * 100) : 0;
  const allDone = !plan.loading && planned > 0 && left === 0;

  // Celebrate once per day when the plan is finished in this session (not on page load).
  const [fire, setFire] = useState(0);
  const wasDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (plan.loading) return;
    if (wasDone.current === false && allDone) {
      const key = `lifeos-celebrated-${today}`;
      let seen = false;
      try { seen = !!sessionStorage.getItem(key); sessionStorage.setItem(key, "1"); } catch {}
      if (!seen) { setFire((f) => f + 1); toast("Day plan complete. That is how streaks are built."); }
    }
    wasDone.current = allDone;
  }, [allDone, plan.loading, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const modeCards: { value: DayMode; Icon: typeof Zap; color: string }[] = [
    { value: "minimum", Icon: BatteryLow, color: "#f59e0b" },
    { value: "standard", Icon: Zap, color: "#14b09e" },
    { value: "deep", Icon: Target, color: "#6366f1" },
  ];
  return (
    <div>
      <section className="hero fade-up mb-5 p-5 sm:p-7">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <BigRing value={pct} size={124}>
            {allDone ? <PartyPopper size={34} /> : <div><div className="text-[28px] font-bold leading-none tabnum">{plan.doneToday.length}<span className="text-base text-white/60">/{planned}</span></div><div className="mt-1 text-[11px] text-white/70">done</div></div>}
          </BigRing>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/75">{ready ? <>Age {ageOn(settings.birth_date, today)}, {settings.life_phase}</> : "\u00a0"}</p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">{fmtDate(today, { weekday: true })}</h1>
            <p className="mt-1 text-sm text-white/80">
              {plan.loading ? "\u00a0" : planned === 0 ? "Nothing planned. Add tasks in Vision, or enjoy a light day." : allDone ? "Everything planned is done. Anything more is a bonus." : left === 1 ? "One thing left. Finish strong." : `${left} things left in your ${capacity.label.toLowerCase()}.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!streak.loading && <StreakPill current={streak.current} todayDone={streak.todayDone} onHero />}
              <span className="hero-chip">{capacity.maxTasks} tasks · {capacity.maxMinutes} min max</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-5">
        <p className="eyebrow mb-2">How much energy do you have today?</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Day mode">
          {modeCards.map(({ value, Icon, color }) => {
            const m = MODES[value];
            const on = mode === value;
            return (
              <button key={value} role="radio" aria-checked={on} onClick={() => saveJournal({ mode: value })}
                className={clsx("card card-hover relative p-3 text-left sm:p-4", on && "ring-2")}
                style={on ? { borderColor: color, ["--tw-ring-color" as string]: `${color}40` } : undefined}>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-md transition-transform" style={{ background: on ? color : "rgb(var(--ink-600))", boxShadow: on ? `0 6px 14px -6px ${color}` : "none" }}><Icon size={17} /></span>
                <div className="mt-2 text-sm font-semibold">{m.label.replace(" Day", "")}</div>
                <div className="hidden text-[11px] leading-snug muted sm:block">{m.blurb}</div>
                <div className="mt-1 text-[10px] tabnum muted sm:hidden">{m.maxTasks} tasks</div>
                {on && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 0 4px ${color}30` }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="lg:hidden"><DailyBite today={today} /></div>
          <Card title={view === "timeline" ? "Your day" : "Everything for today"} action={<Segmented<"timeline" | "areas"> size="sm" value={view} onChange={chooseView} options={[{ value: "timeline", label: "Timeline" }, { value: "areas", label: "By area" }]} />}>
            {view === "timeline"
              ? <DayTimeline today={today} plan={plan} tz={settings.timezone} settings={settings} save={save} />
              : <DayBoard today={today} plan={plan} pillars={pillars} minimal={mode === "minimum"} />}
          </Card>

          <TodayCheckIns today={today} tz={settings.timezone} />
        </div>

        <div className="space-y-4">
          <div className="hidden lg:block"><DailyBite today={today} /></div>
          <VerseCard today={today} translation={settings.bible_translation || "web"} compact />
          <MissedCard today={today} />
          <SpendingToday today={today} currency={settings.currency} />
          <WeeklyTargets today={today} settings={settings} />
          <Upcoming today={today} />
        </div>
      </div>

      <RecordForm
        table="tasks"
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit task" : "New task"}
        initial={edit}
        fields={taskFields(pillarOpts, msOpts, projOpts)}
        allowArchive
      />
      {node}
      <Confetti fire={fire} />
    </div>
  );
}

function SpendingToday({ today, currency }: { today: string; currency: string }) {
  const { rows } = useList("expenses", { date: today });
  const { labelOf } = useSources();
  const total = rows.reduce((s, r) => s + (r.amount as number), 0);
  const essential = rows.filter((r) => r.essential).reduce((s, r) => s + (r.amount as number), 0);
  return (
    <Card title="Spent today" action={<Link href="/finances?tab=spending" className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:underline">History <ArrowRight size={12} /></Link>}>
      <div className="mb-4 flex items-end justify-between rounded-2xl bg-ink-850/70 px-4 py-3">
        <div>
          <div className="text-[11px] muted">Total today</div>
          <div className="text-2xl font-bold tabnum tracking-tight">{money(total, currency, 2)}</div>
        </div>
        {rows.length > 0 && <div className="text-right text-[11px] muted"><div>{rows.length} item{rows.length === 1 ? "" : "s"}</div><div><span className="text-sky-300">{money(essential, currency, 0)}</span> essential</div></div>}
      </div>
      {rows.length > 0 && (
        <ul className="mb-4 space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="group flex items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-ink-850">
              <CatIcon category={r.category} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.category}</span>
                <span className="block truncate text-[11px] muted">{methodLabel(r.method)}{labelOf(r) ? ` · ${labelOf(r)}` : ""}</span>
              </span>
              <span className="text-sm font-semibold tabnum">{money(r.amount, currency, 2)}</span>
              <button className="grid h-6 w-6 place-items-center rounded-full text-fog-500 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100" aria-label={`Remove ${r.category}`} onClick={() => api.remove("expenses", r.id)}><X size={13} /></button>
            </li>
          ))}
        </ul>
      )}
      <SpendForm date={today} compact />
    </Card>
  );
}
