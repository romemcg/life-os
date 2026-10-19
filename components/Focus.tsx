"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, SkipForward, Bell, Check, Timer, Coffee, X } from "lucide-react";
import { clsx, Segmented } from "@/components/ui";
import { api, useList, useSettings, useToday, type Row } from "@/lib/client";
import { todayIn } from "@/lib/dates";
import { completeTask } from "@/components/useDayPlan";
import { focus, leftMs, fmtClock, minutesOf, readFocus, useFocus, PRESETS, PHASE_LABEL, PHASE_COLOR, ROUNDS, type PresetKey } from "@/lib/focus";

// ---------- sound + notification ----------
function chime(kind: "focus" | "break") {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "focus" ? [660, 880, 1100] : [880, 660];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.55);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}
function notify(title: string, body: string) {
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, silent: true }); } catch {}
}

/** Mounted once in the layout: finishes phases, logs focus sessions, updates the tab title. */
export function FocusEngine() {
  const { settings } = useSettings();
  const tz = settings.timezone;
  const { s, now } = useFocus();
  const baseTitle = useRef<string>("");
  useEffect(() => { baseTitle.current = document.title.replace(/^\d\d:\d\d · .*? · /, ""); }, []);

  useEffect(() => {
    if (!s) return;
    if (s.status === "running") document.title = `${fmtClock(leftMs(s, now))} · ${PHASE_LABEL[s.phase]} · ${baseTitle.current || "LIFE OS"}`;
    else if (baseTitle.current) document.title = baseTitle.current;
    if (s.status !== "running" || !s.endsAt || now < s.endsAt) return;
    // Re-read so two open tabs don't both finish the same phase.
    const cur = readFocus();
    if (cur.status !== "running" || cur.endsAt !== s.endsAt) return;
    const done = focus.advance(true);
    if (done.phase === "focus") {
      const start = new Date(done.startedAt ?? Date.now() - minutesOf(done) * 60_000);
      const hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz || undefined }).format(start);
      api.create("focus_sessions", { date: todayIn(tz, start), start_time: hhmm, minutes: minutesOf(done), task_id: done.taskId, label: done.taskLabel || null }).catch(() => {});
      chime("focus");
      notify("Focus session done", done.taskLabel ? `Nice work on "${done.taskLabel}". Take a break.` : "Nice work. Take a break.");
    } else {
      chime("break");
      notify("Break over", "Ready for the next focus session?");
    }
  }, [s, now, tz]);
  return null;
}

/** Small countdown shown in the navigation while a timer is active. */
export function FocusPill({ className }: { className?: string }) {
  const { s, now } = useFocus();
  if (!s || s.status === "idle") return null;
  const color = PHASE_COLOR[s.phase];
  return (
    <Link href="/today#focus" className={clsx("inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold tabnum", className)} style={{ borderColor: `${color}55`, background: `${color}14`, color }} title={`${PHASE_LABEL[s.phase]}${s.taskLabel ? `: ${s.taskLabel}` : ""}`}>
      <span className={clsx("h-2 w-2 rounded-full", s.status === "running" && "animate-pulse")} style={{ background: color }} />
      {fmtClock(leftMs(s, now))}
      <span className="font-medium opacity-80">{s.status === "paused" ? "Paused" : s.phase === "focus" ? "Focus" : "Break"}</span>
    </Link>
  );
}

/** The focus timer card on the Today screen. */
export function FocusCard({ planned, anchor }: { planned: Row[]; anchor?: boolean }) {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const { s, now } = useFocus();
  const sessions = useList("focus_sessions", { date: today });

  if (!s) return <section className="card card-pad h-[360px]" />;
  const total = minutesOf(s) * 60_000;
  const left = leftMs(s, now);
  const frac = total ? 1 - left / total : 0;
  const color = PHASE_COLOR[s.phase];
  const running = s.status === "running";
  const minsToday = Math.round(sessions.rows.reduce((t, r) => t + Number(r.minutes || 0), 0));
  const task = planned.find((t) => t.id === s.taskId);
  const R = 70, C = 2 * Math.PI * R;

  const start = () => {
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
    focus.start();
  };

  return (
    <section id={anchor ? "focus" : undefined} className="card card-pad scroll-mt-24">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="h-section flex items-center gap-2 whitespace-nowrap"><Timer size={17} className="text-teal-300" />Focus timer</h2>
        <Segmented<PresetKey> size="sm" value={s.preset} onChange={(v) => focus.setPreset(v)} options={(Object.keys(PRESETS) as PresetKey[]).map((k) => ({ value: k, label: <span className="whitespace-nowrap tabnum">{PRESETS[k].label}</span> }))} />
      </div>

      {s.justFinished && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs text-teal-300">
          <Bell size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{s.justFinished === "focus" ? `Session saved. Time for a ${s.phase === "long" ? "long" : "short"} break.` : "Break over. Ready when you are."}</span>
          {s.justFinished === "focus" && task && (
            <button className="inline-flex items-center gap-1 font-semibold hover:underline" onClick={() => { completeTask(task, today); focus.setTask(null, ""); focus.dismiss(); }}><Check size={13} />Mark task done</button>
          )}
          <button aria-label="Dismiss" onClick={() => focus.dismiss()}><X size={14} /></button>
        </div>
      )}

      <div className="flex flex-col items-center">
        <div className="mb-3 inline-flex gap-1 rounded-full bg-ink-800/70 p-1 text-[11px] font-medium">
          {(["focus", "short", "long"] as const).map((p) => (
            <button key={p} disabled={running} onClick={() => focus.setPhase(p)} className={clsx("rounded-full px-2.5 py-1 transition", s.phase === p ? "text-white" : "text-fog-400 hover:text-fog-100 disabled:hover:text-fog-400")} style={s.phase === p ? { background: PHASE_COLOR[p] } : undefined}>
              {PHASE_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="relative h-[168px] w-[168px]">
          <svg viewBox="0 0 168 168" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="84" cy="84" r={R} fill="none" strokeWidth="10" className="stroke-ink-700/70" />
            <circle cx="84" cy="84" r={R} fill="none" strokeWidth="10" strokeLinecap="round" stroke={color} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-live="off">
            <span className="text-[38px] font-bold leading-none tabnum tracking-tight">{fmtClock(left)}</span>
            <span className="mt-1.5 text-xs font-medium" style={{ color }}>{s.status === "paused" ? "Paused" : PHASE_LABEL[s.phase]}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5" aria-label={`Session ${s.round + 1} of ${ROUNDS}`} title="A long break comes after 4 focus sessions">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span key={i} className="h-1.5 w-6 rounded-full" style={{ background: i < s.round ? PHASE_COLOR.focus : "rgb(var(--ink-700))" }} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Reset" title="Reset" onClick={() => focus.reset()}><RotateCcw size={17} className="mx-auto" /></button>
          <button className="btn-primary h-12 min-w-[132px] rounded-full text-[15px]" onClick={() => (running ? focus.pause() : start())}>
            {running ? <><Pause size={17} />Pause</> : <><Play size={17} />{s.status === "paused" ? "Resume" : s.phase === "focus" ? "Start focus" : "Start break"}</>}
          </button>
          <button className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Skip to next" title={s.phase === "focus" ? "Skip to break" : "Skip break"} onClick={() => focus.advance(false)}><SkipForward size={17} className="mx-auto" /></button>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-[11px] muted">Working on</span>
        <select className="input w-full text-sm" value={s.taskId ?? ""} onChange={(e) => { const t = planned.find((x) => x.id === Number(e.target.value)); focus.setTask(t ? t.id : null, t ? String(t.title) : ""); }}>
          <option value="">Nothing specific</option>
          {planned.map((t) => <option key={t.id} value={t.id}>{String(t.title)}</option>)}
        </select>
      </label>

      <div className="mt-3 flex items-center justify-between border-t border-ink-700/70 pt-3 text-xs muted">
        <span className="inline-flex items-center gap-1.5"><Coffee size={13} />Today</span>
        <span className="tabnum"><b className="font-semibold text-fog-100">{sessions.rows.length}</b> session{sessions.rows.length === 1 ? "" : "s"} · <b className="font-semibold text-fog-100">{minsToday}</b> min focused</span>
      </div>
    </section>
  );
}
