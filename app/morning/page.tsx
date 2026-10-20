"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Pause, Play, RotateCcw, Wind, Flame } from "lucide-react";
import { PageHeader, Card, Progress, Stat, Segmented, useToast, clsx } from "@/components/ui";
import { VerseCard, usePassage } from "@/components/Verse";
import { DailyBite } from "@/components/DailyBite";
import { useSettings, useToday, useList, api } from "@/lib/client";
import { getPlan, label, PLANS } from "@/lib/bible";
import { addDays, fmtDate, weekRange } from "@/lib/dates";

async function tickHabit(name: string, date: string) {
  const habits = await api.list("habits", { active: true });
  const h = habits.find((x) => x.name === name);
  if (!h) return false;
  const existing = await api.list("habit_checkins", { habit_id: h.id, date });
  if (!existing.length) await api.create("habit_checkins", { habit_id: h.id, date, value: 1 });
  return true;
}

export default function MorningPage() {
  const { settings, save } = useSettings();
  const today = useToday(settings.timezone);
  const tr = settings.bible_translation || "web";
  return (
    <div>
      <PageHeader
        title="Morning"
        subtitle="A quiet start before the day's tasks: scripture, reading, stillness."
        actions={<Segmented value={tr} onChange={(t) => save({ bible_translation: t })} size="sm" options={[{ value: "web", label: "WEB" }, { value: "kjv", label: "KJV" }]} />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <VerseCard today={today} translation={tr} />
          <DailyBite today={today} />
          <ReadingPlan today={today} translation={tr} settings={settings} save={save} />
        </div>
        <div className="space-y-4">
          <Meditation today={today} tz={settings.timezone} />
          <MorningStats today={today} />
        </div>
      </div>
    </div>
  );
}

function ReadingPlan({ today, translation, settings, save }: { today: string; translation: string; settings: Record<string, string>; save: (s: Record<string, unknown>) => Promise<unknown> }) {
  const planId = settings.bible_plan || "gospels";
  const plan = useMemo(() => getPlan(planId), [planId]);
  const log = useList("bible_log", { plan: planId });
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [showText, setShowText] = useState(false);
  const { toast, node } = useToast();

  const done = new Set(log.rows.map((r) => r.day_index as number));
  const next = plan.days.findIndex((_, i) => !done.has(i));
  const finished = next === -1;
  const doneToday = log.rows.filter((r) => r.date === today);
  const passage = finished ? null : label(plan.days[next]);
  // fetch inline text only for single-chapter readings to keep it light
  const single = !finished && plan.days[next].length === 1 ? passage : null;
  const text = usePassage(showText ? single : null, translation);

  async function markRead() {
    await api.create("bible_log", { date: today, plan: planId, day_index: next, passage, note: note.trim() || null });
    const ticked = await tickHabit("Morning Bible reading", today);
    setNote("");
    setShowText(false);
    toast(`${passage} done${ticked ? " · habit ticked" : ""}`);
  }

  return (
    <Card title="Bible reading" action={<button className="text-xs text-teal-300 hover:underline" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Change plan"}</button>}>
      {open && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {Object.values(PLANS).map((p) => {
            const pl = p();
            return (
              <button key={pl.id} onClick={async () => { await save({ bible_plan: pl.id }); setOpen(false); }} className={clsx("rounded-lg border p-3 text-left text-sm", pl.id === planId ? "border-teal-500/50 bg-teal-500/5" : "border-ink-700 hover:border-ink-600")}>
                <div className="font-medium">{pl.name}</div>
                <div className="mt-0.5 text-xs muted">{pl.blurb}</div>
              </button>
            );
          })}
          <p className="text-[11px] text-fog-500 sm:col-span-2">Switching keeps your progress in each plan. Missed days never pile up: you simply continue from where you stopped.</p>
        </div>
      )}
      <div className="mb-1 flex justify-between text-xs"><span className="text-fog-300">{plan.name}</span><span className="tabnum muted">{done.size} / {plan.days.length}</span></div>
      <Progress value={(done.size / plan.days.length) * 100} />
      {finished ? (
        <p className="mt-4 text-sm text-teal-300">Plan complete. Choose another plan to keep going.</p>
      ) : (
        <div className="mt-4">
          <div className="text-xs muted">Reading {next + 1}{doneToday.length ? " (bonus)" : ""}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            <span className="text-xl font-semibold">{passage}</span>
            {single && <button className="inline-flex items-center gap-1 text-xs text-teal-300 hover:underline" onClick={() => setShowText((v) => !v)}>{showText ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{showText ? "Hide text" : "Read here"}</button>}
          </div>
          {showText && (
            <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-ink-700 bg-ink-850/50 p-4 font-serif text-[15px] leading-relaxed text-fog-100">
              {text.loading ? <span className="muted">Loading…</span> : text.error ? <span className="muted">{text.error}</span> : <>{text.text}<div className="mt-2 font-sans text-xs muted">{text.translation}</div></>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1"><label className="label" htmlFor="bnote">One line to remember (optional)</label><input id="bnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What stood out to you?" /></div>
            <button className="btn-primary" onClick={markRead}><Check size={15} /> Mark as read</button>
          </div>
          {doneToday.length > 0 && <p className="mt-2 text-xs text-teal-300">Today: {doneToday.map((d) => d.passage).join(", ")} ✓</p>}
        </div>
      )}
      {log.rows.filter((r) => r.note).length > 0 && (
        <details className="mt-4 border-t border-ink-800 pt-3 text-sm">
          <summary className="cursor-pointer text-xs muted">Your notes ({log.rows.filter((r) => r.note).length})</summary>
          <ul className="mt-2 space-y-1.5">{log.rows.filter((r) => r.note).slice(0, 20).map((r) => <li key={r.id}><span className="text-xs muted">{fmtDate(r.date, { year: false })} · {r.passage}: </span>{r.note}</li>)}</ul>
        </details>
      )}
      {node}
    </Card>
  );
}

const KINDS = [
  { value: "silent", label: "Silent" },
  { value: "breathing", label: "Breathing" },
  { value: "prayer", label: "Prayer" },
  { value: "body_scan", label: "Body scan" },
];

function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.6, 1.2].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 528;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 1.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 1.5);
    });
  } catch {}
}

function Meditation({ today, tz }: { today: string; tz: string }) {
  const [mins, setMins] = useState(10);
  const [kind, setKind] = useState("silent");
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const startRef = useRef<number>(0);
  const { toast, node } = useToast();
  const { rows } = useList("meditations", { date: today });

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l === null) return l;
        if (l <= 1) { clearInterval(t); setRunning(false); finish(mins); return 0; }
        return l - 1;
      });
      setPhase((p) => (p + 1) % 16);
    }, 1000);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish(minutes: number) {
    chime();
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    await api.create("meditations", { date: today, time, minutes: Math.max(1, Math.round(minutes * 10) / 10), kind });
    const ticked = await tickHabit("Meditate", today);
    toast(`Meditation logged${ticked ? " · habit ticked" : ""}`);
    setLeft(null);
  }
  function start() { startRef.current = Date.now(); setLeft(mins * 60); setPhase(0); setRunning(true); }
  async function stopEarly() {
    setRunning(false);
    const done = (mins * 60 - (left ?? 0)) / 60;
    if (done >= 1) await finish(done); else setLeft(null);
  }

  const total = mins * 60;
  const pct = left === null ? 0 : ((total - left) / total) * 100;
  const mm = String(Math.floor((left ?? total) / 60)).padStart(2, "0");
  const ss = String((left ?? total) % 60).padStart(2, "0");
  const breath = ["Breathe in", "Breathe in", "Breathe in", "Breathe in", "Hold", "Hold", "Hold", "Hold", "Breathe out", "Breathe out", "Breathe out", "Breathe out", "Hold", "Hold", "Hold", "Hold"][phase];
  const scale = phase < 4 ? 0.7 + (phase + 1) * 0.075 : phase < 8 ? 1 : phase < 12 ? 1 - (phase - 7) * 0.075 : 0.7;

  return (
    <Card title="Meditation">
      <div className="flex flex-col items-center">
        <div className="relative my-2 grid h-44 w-44 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(var(--ink-700))" strokeWidth="3" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(var(--teal-400))" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 289} 289`} style={{ transition: "stroke-dasharray 1s linear" }} />
          </svg>
          <div className="grid h-28 w-28 place-items-center rounded-full bg-teal-500/10 transition-transform duration-1000 ease-in-out" style={{ transform: `scale(${running && kind === "breathing" ? scale : 1})` }}>
            <div className="text-center">
              <div className="text-2xl font-semibold tabnum">{mm}:{ss}</div>
              {running && kind === "breathing" && <div className="text-[11px] text-teal-300">{breath}</div>}
            </div>
          </div>
        </div>
        {left === null ? (
          <>
            <div className="flex flex-wrap justify-center gap-1">{[3, 5, 10, 15, 20].map((m) => <button key={m} onClick={() => setMins(m)} className={clsx("rounded-full border px-3 py-1 text-xs font-semibold transition-colors", mins === m ? "border-fog-100 bg-fog-100 text-ink-900" : "border-ink-600 text-fog-300 hover:border-fog-400")}>{m} min</button>)}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">{KINDS.map((k) => <button key={k.value} onClick={() => setKind(k.value)} className={clsx("chip px-2.5 py-1 transition-colors", kind === k.value ? "border-fog-100 bg-fog-100 text-ink-900" : "border-ink-600 text-fog-300 hover:border-fog-400")}>{k.value === "breathing" && <Wind size={11} />}{k.label}</button>)}</div>
            <button className="btn-primary mt-3" onClick={start}><Play size={15} /> Begin</button>
            {kind === "breathing" && <p className="mt-2 text-center text-[11px] muted">Box breathing: in 4, hold 4, out 4, hold 4.</p>}
          </>
        ) : (
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => setRunning((r) => !r)}>{running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button>
            <button className="btn-ghost" onClick={stopEarly}><RotateCcw size={14} /> End now</button>
          </div>
        )}
      </div>
      {rows.length > 0 && <p className="mt-3 text-center text-xs text-teal-300">Today: {rows.reduce((s, r) => s + (r.minutes ?? 0), 0)} min across {rows.length} session{rows.length === 1 ? "" : "s"}</p>}
      {node}
    </Card>
  );
}

function MorningStats({ today }: { today: string }) {
  const med = useList("meditations", { from: addDays(today, -29), to: today });
  const bib = useList("bible_log", {});
  const [mon, sun] = weekRange(today);
  const medWeek = med.rows.filter((r) => r.date >= mon && r.date <= sun).reduce((s, r) => s + (r.minutes ?? 0), 0);
  const days = new Set(bib.rows.map((r) => r.date as string));
  let streak = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) streak++;
  return (
    <Card title="Your mornings">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Reading streak" value={<span className="inline-flex items-center gap-1">{streak}<Flame size={14} className="text-amber-300" /></span>} hint="days in a row" />
        <Stat label="Readings done" value={bib.rows.length} />
        <Stat label="Meditation this week" value={`${Math.round(medWeek)} min`} />
        <Stat label="Last 30 days" value={`${Math.round(med.rows.reduce((s, r) => s + (r.minutes ?? 0), 0))} min`} />
      </div>
      <p className="mt-3 text-[11px] text-fog-500">Both tick your habits automatically. A missed morning isn&apos;t a failure; just pick up the next reading.</p>
    </Card>
  );
}

