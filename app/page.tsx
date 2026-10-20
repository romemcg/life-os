"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleAlert, ChevronDown, Lock, Wallet, HeartPulse, Briefcase, Sunrise, Repeat, Send, BookOpen, Zap } from "lucide-react";
import { WeekPulse, paceStatus, scoreStatus, type PulseRow } from "@/components/WeekPulse";
import { StreakPill, ChainCalendar, greeting } from "@/components/Consistency";
import { useStreak } from "@/components/useStreak";
import { Card, Progress, PillarDot, clsx } from "@/components/ui";
import { Climb } from "@/components/Climb";
import { useSettings, useToday, useList, money, type Row } from "@/lib/client";
import { useFinance } from "@/components/useFinance";
import { useDayPlan, completeTask } from "@/components/useDayPlan";
import { usePillars } from "@/components/shared";
import { Upcoming } from "@/components/widgets";
import { Evidence } from "@/components/Evidence";
import { TaskRow } from "@/components/TaskRow";
import { milestoneProgress } from "@/lib/progress";
import { STAGES } from "@/lib/stages";
import { isRecurring, occurrencesBetween } from "@/lib/recurrence";
import { ageOn, fmtDate, fmtMonth, weekRange, addDays, diffDays } from "@/lib/dates";
import { emergencyFundTarget } from "@/lib/finance";
import type { DayMode } from "@/lib/priority";

type Signal = { level: "bad" | "warn"; text: string; href: string };

export default function Dashboard() {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const cur = settings.currency;
  const [mon, sun] = weekRange(today);
  const fin = useFinance(today, cur);
  const journal = useList("journal", { date: today });
  const entry = journal.rows[0];
  const mode = ((entry?.mode as DayMode) || (settings.day_mode as DayMode) || "standard") as DayMode;
  const pinned = useMemo(() => ((entry?.pinned as number[]) ?? []), [entry]);
  const plan = useDayPlan(today, mode, pinned);
  const { pillars, byId } = usePillars();
  const ms = useList("milestones");
  const projects = useList("projects");
  const weekComps = useList("task_completions", { from: mon, to: today });
  const apps = useList("applications");
  const bible = useList("bible_log", { from: mon, to: sun });
  const meds = useList("meditations", { from: mon, to: sun });
  const checkIns = useList("check_ins", { from: mon, to: sun });
  const books = useList("books");
  const conns = useList("connections", { from: mon, to: sun });

  // ---- roadmap stage
  const progressOf = (m: Row) => milestoneProgress(m, plan.allTasks, projects.rows);
  const live = ms.rows.filter((m) => m.status !== "dropped");
  const stages = STAGES.map((s) => {
    const list = live.filter((m) => (m.stage ?? 2) === s.id);
    return { ...s, list, pct: list.length ? Math.round(list.reduce((a, m) => a + progressOf(m).pct, 0) / list.length) : 100, isStable: list.length > 0 && list.every((m) => m.status === "done") };
  });
  const curIdx = Math.max(0, stages.findIndex((s) => !s.isStable));
  const stage = stages[curIdx];
  const focus = stage.list.filter((m) => m.status !== "done").sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"))[0];

  // ---- this week donuts
  const plannedToday = plan.planned.length + plan.doneToday.length;
  // Routines = recurring tasks. Done this week vs planned so far this week.
  const routines = plan.allTasks.filter((t) => isRecurring(t) && !t.archived && t.status !== "dropped");
  const routineTarget = routines.reduce((n, t) => n + occurrencesBetween(t, mon, today), 0);
  const routineIds = new Set(routines.map((t) => t.id));
  const routineDone = weekComps.rows.filter((c) => c.kind !== "skipped" && routineIds.has(c.task_id)).length;
  const appsWeek = apps.rows.filter((a) => a.applied_date && a.applied_date >= mon && a.applied_date <= sun).length;
  const appTarget = Number(settings.weekly_app_target || 8);
  const bibleDays = new Set(bible.rows.map((r) => r.date)).size;
  const medDays = new Set(meds.rows.map((r) => r.date)).size;
  const energy = checkIns.rows.map((c) => c.energy).filter((x) => x != null) as number[];
  const avgEnergy = energy.length ? energy.reduce((a, b) => a + b, 0) / energy.length : null;
  const book = books.rows.find((b) => b.status === "reading") ?? books.rows.find((b) => b.month === today.slice(0, 7));

  // ---- life areas (pillars): progress of milestones in unlocked stages
  const areas = pillars.map((p) => {
    const mine = live.filter((m) => m.pillar_id === p.id);
    // Ring and label describe the same set: milestones open to you now (this stage and earlier, plus always-on).
    const unlocked = mine.filter((m) => (m.stage ?? 2) <= stage.id);
    const always = mine.length > 0 && mine.every((m) => (m.stage ?? 2) === 0) && p.key === "relationships";
    const firstStage = Math.min(...mine.map((m) => m.stage ?? 9));
    const nowDone = unlocked.filter((m) => m.status === "done").length;
    // Ring = share of this stage's milestones that are done, so it always matches the "x/y done" label.
    const pct = unlocked.length ? Math.round((nowDone / unlocked.length) * 100) : null;
    const nextOpen = unlocked.filter((m) => m.status !== "done").sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"))[0];
    const nextPct = nextOpen ? progressOf(nextOpen).pct : null;
    return { p, pct, nextPct, locked: !always && unlocked.length === 0 && mine.length > 0, always, firstStage, nowDone, nowTotal: unlocked.length, total: mine.length };
  });

  // ---- money
  const s = fin.summary;
  // Emergency fund = money set aside in savings accounts, not the bank balance you live on.
  const efSaved = fin.accounts.filter((a) => a.type === "savings" && (a.currency || cur) === cur).reduce((t, a) => t + Number(a.balance || 0), 0);
  const efStep1 = emergencyFundTarget(1, s.essential, s.minPayments);
  const efMonthsGoal = efSaved >= efStep1 ? Math.max(1, Number(settings.ef_months || 3)) : 1;
  const efTarget = emergencyFundTarget(efMonthsGoal, s.essential, s.minPayments);
  const runIdx = fin.statusQuo.rows.findIndex((r) => r.cash < 0);

  // ---- risk signals (only the important ones)
  const signals: Signal[] = [];
  if (!fin.loading) {
    if (!fin.hasBaseline) signals.push({ level: "bad", text: "Financial baseline not entered yet. Runway can't be calculated.", href: "/finances" });
    else if (runIdx !== -1 && runIdx < 3) signals.push({ level: "bad", text: `Cash runs out around ${fmtMonth(fin.statusQuo.runOutMonth!)} at current spending.`, href: "/finances" });
    const soon = fin.pendingObligations.filter((o) => o.due_date && o.due_date <= addDays(today, 14));
    if (soon.length) signals.push({ level: "warn", text: `${soon.length} payment(s) due within 14 days: ${money(soon.reduce((t, o) => t + o.amount, 0), cur)}.`, href: "/finances" });
  }
  const overdueFU = apps.rows.filter((a) => a.next_action_due && a.next_action_due < today && !["rejected", "withdrawn", "offer"].includes(a.stage)).length;
  if (overdueFU) signals.push({ level: "warn", text: `${overdueFU} career follow-up(s) overdue.`, href: "/career" });

  const top3 = (() => {
    const open = plan.planned.map((p) => p.task as Row);
    const ids: number[] = ((entry?.top3 as number[]) ?? []).filter((id) => open.some((t) => t.id === id));
    for (const t of open) if (ids.length < 3 && !ids.includes(t.id)) ids.push(t.id);
    return ids.map((id) => open.find((t) => t.id === id)!);
  })();
  const day = diffDays(settings.start_date || today, today) + 1;
  const streak = useStreak(today, 84);
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    try { setHour(Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: settings.timezone || undefined }).format(new Date()))); }
    catch { setHour(new Date().getHours()); }
  }, [settings.timezone]);
  const first = String(settings.display_name || "").split(" ")[0];
  const todayPct = plannedToday ? Math.round((plan.doneToday.length / plannedToday) * 100) : 0;

  const left = plannedToday - plan.doneToday.length;
  const message = plannedToday === 0 ? "Nothing planned yet. Open today to choose your mode." : todayPct >= 100 ? "Today's plan is done. Rest counts too." : `${left} thing${left === 1 ? "" : "s"} left today.`;
  const climbStages = stages.map((s, i) => ({ id: s.id, name: s.name, short: s.short, pct: s.list.length ? s.pct : 0, state: (i < curIdx ? "done" : i === curIdx ? "now" : "later") as "done" | "now" | "later" }));
  const stageDone = stage.list.filter((m) => m.status === "done").length;
  const openAreas = areas.filter((a) => !a.locked).length;

  const actions = [
    { href: "/morning", label: "Morning", sub: "Verse, reading, breathe", Icon: Sunrise },
    { href: "/check-ins", label: "Check in", sub: "Energy, mood, one win", Icon: HeartPulse },
    { href: "/today", label: "Log spending", sub: "Takes 10 seconds", Icon: Wallet },
    { href: "/career", label: "Career", sub: `${appsWeek} of ${appTarget} applications this week`, Icon: Briefcase },
  ];
  // ---- your week: each row judged against where you should be by today
  const dow = diffDays(mon, today) + 1;
  const paceBy = (target: number) => Math.floor((target * dow) / 7);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const routineDueBefore = routines.reduce((n, t) => n + occurrencesBetween(t, mon, addDays(today, -1)), 0);
  const mornTarget = 11; // 6 Bible readings + 5 meditations a week
  const mornDone = Math.min(bibleDays, 6) + Math.min(medDays, 5);
  const appsExp = paceBy(appTarget);
  const monthDays = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const bookTotal = Number(book?.pages_total || 0);
  const bookPage = Number(book?.current_page || 0);
  const bookExp = Math.floor((bookTotal * Number(today.slice(8, 10))) / monthDays);
  const catchUp = (gap: number, w: string) => `${plural(gap, w)} today to catch up`;
  const weekRows: PulseRow[] = [
    { href: "/today", label: "Routines", Icon: Repeat, done: routineDone, target: routineTarget, expected: routineDueBefore,
      status: paceStatus(routineDone, routineDueBefore, routineTarget),
      hint: !routineTarget ? "None due yet" : routineDone >= routineTarget ? "All due so far are done" : `${routineTarget - routineDone} still due so far` },
    { href: "/morning", label: "Mornings", Icon: Sunrise, done: mornDone, target: mornTarget, expected: paceBy(mornTarget),
      status: paceStatus(mornDone, paceBy(mornTarget), mornTarget),
      hint: `${plural(bibleDays, "reading")}, ${plural(medDays, "meditation")}` },
    { href: "/career", label: "Applications", Icon: Send, done: appsWeek, target: appTarget, expected: appsExp,
      status: paceStatus(appsWeek, appsExp, appTarget),
      hint: appsWeek >= appTarget ? "Weekly target hit" : appsWeek < appsExp ? `Send ${catchUp(appsExp - appsWeek, "application").replace(/ applications?/, "")}` : `${appTarget - appsWeek} to go this week` },
    { href: "/learning?tab=books", label: "Reading", Icon: BookOpen, done: bookPage, target: bookTotal, expected: bookExp,
      status: book ? paceStatus(bookPage, bookExp, bookTotal) : "none",
      hint: !book ? "No book yet" : bookPage < bookExp ? `${bookExp - bookPage} pages behind · ${book.title}` : String(book.title) },
    { href: "/check-ins", label: "Energy", Icon: Zap, kind: "score", done: avgEnergy ?? 0, target: 5, expected: 0,
      status: scoreStatus(avgEnergy),
      hint: avgEnergy === null ? "No check-ins yet" : `Average of ${plural(energy.length, "check-in")}` },
  ];

  return (
    <div>
      <section className="hero mb-4 p-5 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-stretch">
          <div className="flex flex-col">
            <p className="text-sm text-white/70">{fmtDate(today, { weekday: true })}{day >= 1 && day <= 90 ? `, day ${day} of 90` : ""}</p>
            <div className="mt-6 md:mt-auto">
            <h1 className="text-[34px] font-semibold leading-[1.1] text-white sm:text-[44px]">{hour === null ? " " : `${greeting(hour)}${first ? `, ${first}` : ""}.`}</h1>
            <p className="mt-2 text-base text-white/80">{message}</p>
            <div className="mt-5 max-w-sm">
              <div className="mb-1.5 flex justify-between text-xs text-white/70"><span>Today</span><span className="tabnum">{plan.doneToday.length} of {plannedToday} done</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#7dd3fc] transition-all duration-1000" style={{ width: `${todayPct}%` }} /></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/today" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0a162e] transition hover:-translate-y-0.5 hover:bg-white/90 active:scale-[0.98]">Open today</Link>
              {!streak.loading && <StreakPill current={streak.current} todayDone={streak.todayDone} onHero />}
            </div>
            </div>
          </div>
          <Climb stages={climbStages} ageAtEnd={ageOn(settings.birth_date, "2035-12-31")} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/15 pt-4 text-sm">
          <span className="font-display text-base font-semibold">Stage {stage.id} of {STAGES.length}: {stage.name}</span>
          <span className="text-white/70">{stageDone} of {stage.list.length} milestones done</span>
          {focus && <Link href="/roadmap" className="min-w-0 flex-1 truncate text-white/85 hover:text-white sm:text-right">Next: {focus.title}</Link>}
        </div>
      </section>

      {signals.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3" role="status">
          <ul className="space-y-1.5">
            {signals.map((sg, i) => {
              const Icon = sg.level === "bad" ? AlertTriangle : CircleAlert;
              return (
                <li key={i}><Link href={sg.href} className="flex items-start gap-2 text-sm hover:underline"><Icon size={16} className={clsx("mt-0.5 shrink-0", sg.level === "bad" ? "text-rose-400" : "text-amber-300")} /><span className="text-fog-100">{sg.text}</span></Link></li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {actions.map((q) => (
          <Link key={q.label} href={q.href} className="card card-hover flex items-center gap-3 px-3.5 py-3">
            <q.Icon size={20} className="shrink-0 text-teal-400" strokeWidth={1.9} />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{q.label}</span><span className="block truncate text-xs muted">{q.sub}</span></span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Today's top 3" action={<Link href="/today" className="text-sm font-medium text-teal-300 hover:underline">Open full plan</Link>}>
            {top3.length === 0 ? <p className="text-sm muted">{plan.doneToday.length ? "Planned tasks are done. Rest is part of the plan." : "Nothing planned for today. Open today to choose your mode."}</p> : (
              <div className="-mx-2">{top3.map((t) => <TaskRow key={t.id} task={t} today={today} pillarColor={byId.get(t.pillar_id)?.color} onToggle={() => completeTask(t, today)} />)}</div>
            )}
          </Card>

          <div className="lg:hidden"><Upcoming today={today} days={7} /></div>

          <WeekPulse rows={weekRows} range={`${fmtDate(mon, { year: false })} to ${fmtDate(sun, { year: false })}`} dayOfWeek={dow} />

          <details className="group border-t border-ink-700/80 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span><h2 className="h-section inline">Life areas</h2><span className="ml-2 text-xs muted">{openAreas} of {areas.length} open in this stage</span></span>
              <ChevronDown size={18} className="shrink-0 text-fog-400 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="mt-2">
              {areas.map((a) => (
                <li key={a.p.id} className="border-t border-ink-700/70 first:border-t-0">
                  <Link href={a.always ? "/relationships" : `/vision/${a.p.id}`} className="flex items-center gap-3 py-2.5 hover:text-teal-300">
                    <PillarDot color={a.p.color} />
                    <span className="min-w-0 flex-1 truncate text-sm">{a.p.name}</span>
                    {a.locked ? <span className="inline-flex items-center gap-1 text-xs text-fog-500"><Lock size={11} />Opens at stage {a.firstStage}</span>
                      : a.always ? <span className="text-xs text-fog-400">Always on, {conns.rows.length} connection{conns.rows.length === 1 ? "" : "s"} this week</span>
                      : <><Progress className="w-20 sm:w-28" value={a.pct ?? 0} color={a.p.color} /><span className="w-14 shrink-0 text-right text-xs tabnum muted">{a.nowDone} of {a.nowTotal}</span></>}
                  </Link>
                </li>
              ))}
              <li className="border-t border-ink-700/70">
                <Link href="/finances" className="flex items-center gap-3 py-2.5 hover:text-teal-300">
                  <PillarDot color="#3b82f6" />
                  <span className="min-w-0 flex-1 truncate text-sm">Emergency fund</span>
                  {!fin.hasBaseline ? <span className="text-xs muted">Enter your baseline first</span> : <><Progress className="w-20 sm:w-28" value={efTarget > 0 ? (efSaved / efTarget) * 100 : 0} color="#3b82f6" /><span className="w-24 shrink-0 truncate text-right text-xs tabnum muted sm:w-40">{efSaved > 0 ? `${money(efSaved, cur)} of ${money(efTarget, cur)}` : `Goal ${money(efTarget, cur)}`}</span></>}
                </Link>
              </li>
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-fog-500"><Lock size={11} />Locked areas belong to later stages. They need no energy yet.</p>
          </details>

          <Card title="Consistency" action={<span className="hidden text-xs muted sm:inline">Days with at least one thing done, last 12 weeks</span>}>
            <ChainCalendar grid={streak.grid} current={streak.current} best={streak.best} last30={streak.last30} today={today} />
          </Card>
        </div>

        <div className="hidden space-y-6 lg:block">
          <Upcoming today={today} days={7} />
        </div>
      </div>

      <div className="mt-6"><Evidence today={today} /></div>
    </div>
  );
}
