"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Flame, Play, Pause, X, Check, Lock, Zap, BookOpen, Languages, Award, GraduationCap, Wrench, Trophy } from "lucide-react";
import { api, type Row } from "@/lib/client";
import { addDays, weekRange } from "@/lib/dates";
import { clsx } from "./ui";

export const KIND_COLOR: Record<string, string> = { book: "#1d4ed8", certification: "#d97706", language: "#7c3aed", course: "#2563eb", skill: "#db2777" };
const KIND_ICON: Record<string, typeof Award> = { book: BookOpen, certification: Award, language: Languages, course: GraduationCap, skill: Wrench };
const LEVELS = ["Curious", "Starter", "Steady", "Consistent", "Focused", "Sharp", "Scholar", "Expert", "Master"];
const DAILY_GOAL = 25;

export type Target = { key: string; kind: string; row: Row; title: string };

/** Everything here is computed from logged minutes. Nothing is estimated. */
export function useLearnStats(today: string, log: Row[], bookLog: Row[], items: Row[], books: Row[]) {
  return useMemo(() => {
    const byDay = new Map<string, number>();
    for (const l of [...log, ...bookLog]) if (l.date) byDay.set(l.date, (byDay.get(l.date) ?? 0) + (l.minutes ?? 0));
    const active = (d: string) => byDay.has(d);
    let cur = 0;
    let d = active(today) ? today : addDays(today, -1);
    while (active(d)) { cur++; d = addDays(d, -1); }
    const days = [...byDay.keys()].sort();
    let best = 0, run = 0, prev = "";
    for (const day of days) { run = prev && addDays(prev, 1) === day ? run + 1 : 1; best = Math.max(best, run); prev = day; }
    const totalMin = [...byDay.values()].reduce((a, b) => a + b, 0);
    const finished = items.filter((i) => i.status === "done").length + books.filter((b) => b.status === "finished").length;
    const xp = totalMin + finished * 50;
    const level = Math.floor(Math.sqrt(xp / 60)) + 1;
    const from = (level - 1) ** 2 * 60;
    const to = level ** 2 * 60;
    const [mon, sun] = weekRange(today);
    let week = 0;
    for (const [dd, m] of byDay) if (dd >= mon && dd <= sun) week += m;
    const last14 = Array.from({ length: 14 }, (_, i) => { const date = addDays(today, i - 13); return { date, min: byDay.get(date) ?? 0, on: active(date) }; });
    return { cur, best: Math.max(best, cur), totalMin, xp, level, lvlName: LEVELS[Math.min(level - 1, LEVELS.length - 1)], pct: Math.round(((xp - from) / (to - from)) * 100), toNext: to - xp, week, todayMin: byDay.get(today) ?? 0, todayOn: active(today), last14, finished };
  }, [today, log, bookLog, items, books]);
}

export function Ring({ pct, size = 64, stroke = 7, color = "#1d4ed8", track = "rgb(var(--ink-700) / .7)", children }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: track }} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ stroke: color, transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Short celebration burst. Remount with a new key to replay. */
export function Confetti({ k }: { k: number }) {
  if (!k) return null;
  const cols = ["#f2c14e", "#7dd3fc", "#ff8a65", "#a78bfa", "#60a5fa", "#fff"];
  return (
    <div key={k} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 97) % 100}%`, background: cols[i % cols.length], animationDelay: `${(i % 9) * 40}ms`, ["--dx" as string]: `${((i * 53) % 200) - 100}px`, ["--rot" as string]: `${(i * 67) % 720}deg` }} />
      ))}
    </div>
  );
}

/** Log minutes against a book or a learning item, keeping their totals and status in step. */
export async function logMinutes(t: Target, minutes: number, today: string) {
  if (t.kind === "book") {
    await api.create("reading_log", { book_id: t.row.id, date: today, minutes });
    if (t.row.status === "planned") await api.update("books", t.row.id, { status: "reading", started: t.row.started ?? today });
  } else {
    await api.create("learning_log", { item_id: t.row.id, date: today, minutes });
    await api.update("learning_items", t.row.id, {
      hours_logged: Math.round(((t.row.hours_logged ?? 0) + minutes / 60) * 100) / 100,
      ...(["idea", "planned", "paused"].includes(t.row.status) ? { status: "in_progress", start_date: t.row.start_date ?? today } : {}),
    });
  }
}

function Focus({ targets, onDone }: { targets: Target[]; onDone: (t: Target, min: number) => void }) {
  const [key, setKey] = useState(targets[0]?.key ?? "");
  const [dur, setDur] = useState(25);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [leftMs, setLeftMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const t = targets.find((x) => x.key === key) ?? targets[0];

  useEffect(() => { if (!targets.find((x) => x.key === key) && targets[0]) setKey(targets[0].key); }, [targets, key]);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("lifeos.focus") || "null");
      if (s?.endAt && s.endAt > Date.now() - 6 * 3600e3) { setKey(s.key); setDur(s.dur); setEndAt(s.endAt); }
    } catch {}
  }, []);
  const finish = useCallback(() => {
    try { localStorage.removeItem("lifeos.focus"); } catch {}
    setEndAt(null);
    if (t) onDone(t, dur);
  }, [t, dur, onDone]);
  useEffect(() => {
    if (!endAt || paused) return;
    const tick = () => { const l = endAt - Date.now(); setLeftMs(Math.max(0, l)); if (l <= 0) finish(); };
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [endAt, paused, finish]);

  const start = () => {
    const e = Date.now() + dur * 60e3;
    setEndAt(e); setPaused(false); setLeftMs(dur * 60e3);
    try { localStorage.setItem("lifeos.focus", JSON.stringify({ key, dur, endAt: e })); } catch {}
  };
  const stop = () => { setEndAt(null); setPaused(false); try { localStorage.removeItem("lifeos.focus"); } catch {} };
  const togglePause = () => {
    if (!endAt) return;
    if (!paused) { setPaused(true); }
    else { const e = Date.now() + leftMs; setEndAt(e); setPaused(false); try { localStorage.setItem("lifeos.focus", JSON.stringify({ key, dur, endAt: e })); } catch {} }
  };

  const running = !!endAt;
  const total = dur * 60e3;
  const mm = Math.floor(leftMs / 60e3), ss = Math.floor((leftMs % 60e3) / 1000);
  if (!t) return <div className="text-sm muted">Add a book or a learning item to start a focus session.</div>;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Ring pct={running ? ((total - leftMs) / total) * 100 : 0} size={168} stroke={11} color="rgb(var(--teal-400))">
        {running ? <div className="num text-5xl tabular-nums">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</div> : <div><div className="num text-6xl leading-none">{dur}</div><div className="mt-1 text-sm muted">minutes</div></div>}
      </Ring>
      {!running && (
        <>
          <select value={key} onChange={(e) => setKey(e.target.value)} className="input w-full text-base" aria-label="What to focus on">
            {targets.map((x) => <option key={x.key} value={x.key} className="">{x.title}</option>)}
          </select>
          <div className="flex gap-1.5">
            {[15, 25, 45].map((m) => <button key={m} onClick={() => setDur(m)} className={clsx("rounded-full border px-4 py-1.5 text-sm font-medium", dur === m ? "border-fog-100 bg-fog-100 text-ink-900" : "border-ink-600 text-fog-300 hover:border-fog-400")}>{m} min</button>)}
          </div>
          <button onClick={start} className="btn-primary px-7 py-3 text-base"><Play size={15} fill="currentColor" /> Start focus session</button>
        </>
      )}
      {running && (
        <>
          <div className="text-base">Focusing on <b>{t.title}</b></div>
          <div className="flex gap-2">
            <button onClick={togglePause} className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 px-4 py-2 text-sm hover:bg-ink-850">{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "Resume" : "Pause"}</button>
            <button onClick={() => { if (confirm("End this session without logging it?")) stop(); }} className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 px-4 py-2 text-sm hover:bg-ink-850"><X size={14} /> Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

export function LearnHero({ s, targets, onDone }: { s: ReturnType<typeof useLearnStats>; targets: Target[]; onDone: (t: Target, min: number) => void }) {
  const left = Math.max(0, DAILY_GOAL - s.todayMin);
  const line = s.todayMin >= DAILY_GOAL
    ? "Today's goal is done. Anything more is a bonus."
    : s.cur > 0 && !s.todayOn
      ? `Log anything today to keep your ${s.cur}-day streak alive.`
      : s.cur === 0 && s.totalMin === 0
        ? "Start with 15 minutes. That is the whole job today."
        : `${left} more minute${left === 1 ? "" : "s"} completes today.`;
  const max = Math.max(30, ...s.last14.map((d) => d.min));
  return (
    <section className="relative overflow-hidden rounded-3xl border border-ink-700/60 p-5 sm:p-8" style={{ background: "rgb(var(--ink-900))", boxShadow: "var(--shadow-card)" }}>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className={clsx("grid h-20 w-20 shrink-0 place-items-center rounded-3xl shadow-md", s.cur > 0 ? "bg-orange-500/10 text-orange-500" : "bg-ink-800 text-fog-400")}>
              <Flame size={40} className={s.cur > 0 ? "flame" : ""} />
            </div>
            <div className="min-w-0">
              <div className="num text-6xl leading-none sm:text-7xl">{s.cur}<span className="ml-2 text-2xl text-fog-400">day streak</span></div>
              <div className="mt-2 text-sm muted">Best {s.best} {s.best === 1 ? "day" : "days"} · {Math.round((s.totalMin / 60) * 10) / 10} hours learned in total</div>
            </div>
          </div>
          <p className="text-xl leading-snug sm:text-2xl" style={{ fontFamily: "var(--font-display)" }}>{line}</p>

          <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-4">
              <Ring pct={(s.week / 150) * 100} size={104} stroke={10} color="#1d4ed8">
                <div className="text-center leading-tight"><div className="num text-3xl">{s.week}</div><div className="text-xs muted">of 150</div></div>
              </Ring>
              <div className="text-sm"><div className="font-semibold">This week</div><div className="muted">minutes learned</div></div>
            </div>
            <div>
              <div className="flex h-20 items-end gap-1.5" role="img" aria-label="Last 14 days of learning minutes">
                {s.last14.map((d, i) => (
                  <div key={d.date} className="flex-1" title={`${d.date}: ${d.min} min`}>
                    <div className="w-full rounded-md transition-all" style={{ height: `${Math.max(6, Math.round((d.min / max) * 80))}px`, background: d.on ? (d.min >= DAILY_GOAL ? "rgb(var(--teal-400))" : "rgb(var(--teal-400) / .35)") : "rgb(var(--ink-700) / .8)", outline: i === 13 ? "2px solid rgb(var(--ink-600))" : "none", outlineOffset: 1 }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-xs muted"><span>14 days ago</span><span>solid = 25 min goal hit · today</span></div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm"><span className="inline-flex items-center gap-1.5 font-semibold"><Zap size={15} className="text-teal-400" /> Level {s.level}, {s.lvlName}</span><span className="muted">{s.toNext} XP to level {s.level + 1}</span></div>
            <div className="h-3.5 overflow-hidden rounded-full bg-ink-700/70"><div className="h-full rounded-full bg-teal-400 transition-all duration-1000" style={{ width: `${Math.max(4, s.pct)}%` }} /></div>
            <div className="mt-1.5 text-xs muted">1 minute of learning = 1 XP. Finishing a book or course = 50 XP.</div>
          </div>
        </div>
        <div className="rounded-3xl border border-ink-700/70 bg-ink-850 p-6"><Focus targets={targets} onDone={onDone} /></div>
      </div>
    </section>
  );
}

export function Quest({ t, today, onLogged, onFocus }: { t: Target; today: string; onLogged: (t: Target, m: number) => void; onFocus?: () => void }) {
  const color = KIND_COLOR[t.kind] ?? KIND_COLOR.skill;
  const Icon = KIND_ICON[t.kind] ?? Wrench;
  const r = t.row;
  const isBook = t.kind === "book";
  const pct = isBook ? (r.pages_total ? Math.round(((r.current_page ?? 0) / r.pages_total) * 100) : 0) : r.est_hours ? Math.min(100, Math.round(((r.hours_logged ?? 0) / r.est_hours) * 100)) : 0;
  const sub = isBook ? (r.pages_total ? `Page ${r.current_page ?? 0} of ${r.pages_total}` : r.author || "Book of the month") : r.est_hours ? `${Math.round((r.hours_logged ?? 0) * 10) / 10} of ~${r.est_hours} hours` : `${Math.round((r.hours_logged ?? 0) * 10) / 10} hours so far`;
  const quick = async (m: number) => { await logMinutes(t, m, today); onLogged(t, m); };
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center gap-3">
        <Ring pct={pct} size={64} stroke={6} color="rgb(var(--teal-400))"><Icon size={20} className="text-fog-400" /></Ring>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-500"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{t.kind}</div>
          <div className="truncate text-base font-semibold leading-snug" title={t.title}>{t.title}</div>
          <div className="text-sm muted">{sub}</div>
        </div>
        <div className="num text-2xl text-fog-100">{pct}<span className="text-sm text-fog-400">%</span></div>
      </div>
      {t.kind === "language" && (r.level_current || r.level_target) && <div className="mt-3 flex items-center gap-1.5 text-sm"><span className="chip border-ink-700 text-fog-300">{r.level_current ?? "?"}</span><span className="muted">to</span><span className="chip border-ink-700 text-fog-100">{r.level_target ?? "?"}</span></div>}
      {!isBook && r.next_step && <p className="mt-3 line-clamp-2 text-sm text-fog-300"><span className="text-fog-500">Next: </span>{r.next_step}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {[10, 25].map((m) => <button key={m} onClick={() => quick(m)} className="btn-outline px-3.5 py-1.5 text-xs">+{m} min</button>)}
        {onFocus && <button onClick={onFocus} className="ml-auto inline-flex items-center gap-1 text-sm font-medium muted hover:text-fog-100"><Play size={11} /> Focus</button>}
      </div>
    </div>
  );
}

type Badge_ = { id: string; title: string; hint: string; done: boolean; progress: string };
export function Trophies({ s, items, books }: { s: ReturnType<typeof useLearnStats>; items: Row[]; books: Row[] }) {
  const hours = s.totalMin / 60;
  const fin = books.filter((b) => b.status === "finished").length;
  const doneItems = items.filter((i) => i.status === "done").length;
  const list: Badge_[] = [
    { id: "first", title: "First step", hint: "Log your first session", done: s.totalMin > 0, progress: s.totalMin > 0 ? "Unlocked" : "0 of 1" },
    { id: "s3", title: "3 day streak", hint: "Learn 3 days in a row", done: s.best >= 3, progress: `${Math.min(s.best, 3)} of 3` },
    { id: "s7", title: "One full week", hint: "7 days in a row", done: s.best >= 7, progress: `${Math.min(s.best, 7)} of 7` },
    { id: "s30", title: "Unstoppable", hint: "30 days in a row", done: s.best >= 30, progress: `${Math.min(s.best, 30)} of 30` },
    { id: "h5", title: "5 hours in", hint: "5 hours of learning", done: hours >= 5, progress: `${Math.min(5, Math.round(hours * 10) / 10)} of 5 h` },
    { id: "h25", title: "25 hours", hint: "25 hours of learning", done: hours >= 25, progress: `${Math.min(25, Math.round(hours * 10) / 10)} of 25 h` },
    { id: "h100", title: "100 hours", hint: "100 hours of learning", done: hours >= 100, progress: `${Math.min(100, Math.round(hours))} of 100 h` },
    { id: "b1", title: "Bookworm", hint: "Finish a book", done: fin >= 1, progress: `${Math.min(fin, 1)} of 1` },
    { id: "b3", title: "Reader", hint: "Finish 3 books", done: fin >= 3, progress: `${Math.min(fin, 3)} of 3` },
    { id: "c1", title: "Finisher", hint: "Complete a course, skill or certification", done: doneItems >= 1, progress: `${Math.min(doneItems, 1)} of 1` },
  ];
  const got = list.filter((b) => b.done).length;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="h-section">Trophies</h2><span className="text-xs muted">{got} of {list.length} unlocked</span></div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((b) => (
          <div key={b.id} className={clsx("rounded-2xl border p-3 text-center transition-transform", b.done ? "border-teal-400/40 bg-ink-900 hover:-translate-y-0.5" : "border-ink-700 bg-ink-900 opacity-70")} title={b.hint}>
            <div className={clsx("mx-auto grid h-10 w-10 place-items-center rounded-full", b.done ? "bg-teal-400/10 text-teal-400" : "bg-ink-700/70 text-fog-500")}>{b.done ? <Trophy size={18} /> : <Lock size={15} />}</div>
            <div className="mt-2 text-base font-semibold leading-tight">{b.title}</div>
            <div className="mt-1 text-xs muted">{b.done ? <span className="inline-flex items-center gap-0.5 text-teal-500"><Check size={11} />Unlocked</span> : b.progress}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
