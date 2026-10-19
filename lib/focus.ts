"use client";
import { useEffect, useState } from "react";

// Focus timer state lives in localStorage with an absolute end time,
// so it keeps counting when you switch screens, reload, or close the tab.
export type Phase = "focus" | "short" | "long";
export type PresetKey = "classic" | "deep" | "quick";
export const PRESETS: Record<PresetKey, { label: string; focus: number; short: number; long: number }> = {
  classic: { label: "25/5", focus: 25, short: 5, long: 15 },
  deep: { label: "50/10", focus: 50, short: 10, long: 20 },
  quick: { label: "15/3", focus: 15, short: 3, long: 10 },
};
export const ROUNDS = 4; // long break after this many focus sessions

export type FocusState = {
  phase: Phase;
  status: "idle" | "running" | "paused";
  endsAt: number | null;   // ms epoch while running
  remaining: number;       // ms left while idle or paused
  preset: PresetKey;
  round: number;           // focus sessions finished in the current cycle (0..3)
  startedAt: number | null;
  taskId: number | null;
  taskLabel: string;
  justFinished: Phase | null; // shown once after a phase ends
};

const KEY = "lifeos-focus";
export const minutesOf = (s: Pick<FocusState, "phase" | "preset">) => PRESETS[s.preset][s.phase];
const fresh = (preset: PresetKey = "classic"): FocusState => ({
  phase: "focus", status: "idle", endsAt: null, remaining: PRESETS[preset].focus * 60_000, preset, round: 0,
  startedAt: null, taskId: null, taskLabel: "", justFinished: null,
});

const subs = new Set<() => void>();
export function readFocus(): FocusState {
  try { const v = localStorage.getItem(KEY); if (v) return { ...fresh(), ...JSON.parse(v) }; } catch {}
  return fresh();
}
export function writeFocus(next: FocusState) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  subs.forEach((f) => f());
}
const patch = (p: Partial<FocusState>) => writeFocus({ ...readFocus(), ...p });

export function leftMs(s: FocusState, now = Date.now()) {
  return s.status === "running" && s.endsAt ? Math.max(0, s.endsAt - now) : s.remaining;
}

export const focus = {
  start() {
    const s = readFocus();
    if (s.status === "running") return;
    patch({ status: "running", endsAt: Date.now() + s.remaining, startedAt: s.startedAt ?? Date.now(), justFinished: null });
  },
  pause() {
    const s = readFocus();
    if (s.status !== "running") return;
    patch({ status: "paused", remaining: leftMs(s), endsAt: null });
  },
  reset() {
    const s = readFocus();
    patch({ status: "idle", endsAt: null, startedAt: null, remaining: minutesOf(s) * 60_000, justFinished: null });
  },
  setPreset(preset: PresetKey) {
    const s = readFocus();
    if (s.status === "running") return;
    patch({ preset, status: "idle", endsAt: null, startedAt: null, remaining: PRESETS[preset][s.phase] * 60_000 });
  },
  setPhase(phase: Phase) {
    const s = readFocus();
    patch({ phase, status: "idle", endsAt: null, startedAt: null, remaining: PRESETS[s.preset][phase] * 60_000, justFinished: null });
  },
  setTask(taskId: number | null, taskLabel: string) { patch({ taskId, taskLabel }); },
  dismiss() { patch({ justFinished: null }); },
  /** Move to the next phase. Returns the finished state (for logging) if a focus session ended. */
  advance(completed: boolean): FocusState {
    const s = readFocus();
    let round = s.round, phase: Phase;
    if (s.phase === "focus") {
      if (completed) round += 1;
      phase = round >= ROUNDS ? "long" : "short";
      if (phase === "long") round = 0;
    } else phase = "focus";
    writeFocus({ ...s, phase, round, status: "idle", endsAt: null, startedAt: null, remaining: PRESETS[s.preset][phase] * 60_000, justFinished: completed ? s.phase : null });
    return s;
  },
};

/** Live focus state; re-renders every second while running. */
export function useFocus() {
  const [s, setS] = useState<FocusState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const load = () => setS(readFocus());
    load();
    subs.add(load);
    const onStore = (e: StorageEvent) => { if (e.key === KEY) load(); };
    window.addEventListener("storage", onStore);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { subs.delete(load); window.removeEventListener("storage", onStore); clearInterval(t); };
  }, []);
  return { s, now };
}

export const fmtClock = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
export const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };
export const PHASE_COLOR: Record<Phase, string> = { focus: "#13a08f", short: "#3b8fd9", long: "#7c5cd6" };
