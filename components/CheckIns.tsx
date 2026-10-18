"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Trophy, Construction, Heart, NotebookPen, Clock, ChevronDown, Check, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { Card } from "./ui";
import { api, useList, type Row } from "@/lib/client";

export const FEELINGS: { name: string; emoji: string; tone: "pos" | "neg" }[] = [
  { name: "Calm", emoji: "😌", tone: "pos" },
  { name: "Focused", emoji: "🎯", tone: "pos" },
  { name: "Productive", emoji: "⚡", tone: "pos" },
  { name: "Grateful", emoji: "🙏", tone: "pos" },
  { name: "Motivated", emoji: "🔥", tone: "pos" },
  { name: "Tired", emoji: "😴", tone: "neg" },
  { name: "Anxious", emoji: "😟", tone: "neg" },
  { name: "Stressed", emoji: "😣", tone: "neg" },
  { name: "Lonely", emoji: "🫥", tone: "neg" },
  { name: "Overwhelmed", emoji: "🌊", tone: "neg" },
];
export const feeling = (t: string) => FEELINGS.find((f) => f.name === t);

export const MOOD = [
  { n: 1, emoji: "😞", label: "Rough", color: "#f43f5e" },
  { n: 2, emoji: "😕", label: "Low", color: "#f97316" },
  { n: 3, emoji: "😐", label: "Okay", color: "#eab308" },
  { n: 4, emoji: "🙂", label: "Good", color: "#22c55e" },
  { n: 5, emoji: "😄", label: "Great", color: "#14b09e" },
];
export const ENERGY = [
  { n: 1, label: "Drained", color: "#f43f5e" },
  { n: 2, label: "Low", color: "#f97316" },
  { n: 3, label: "Steady", color: "#eab308" },
  { n: 4, label: "Good", color: "#22c55e" },
  { n: 5, label: "Charged", color: "#6366f1" },
];

function nowHHMM(tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

/** Five signal bars, filled up to n. */
export function Bars({ n, color, size = 14 }: { n: number; color: string; size?: number }) {
  return (
    <span className="inline-flex items-end gap-[2px]" style={{ height: size }} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="w-[3px] rounded-full transition-colors" style={{ height: `${20 + i * 16}%`, background: i <= n ? color : "rgb(var(--ink-600))" }} />
      ))}
    </span>
  );
}

function Picker({ label, value, onChange, kind }: { label: string; value: number | null; onChange: (n: number | null) => void; kind: "mood" | "energy" }) {
  const opts = kind === "mood" ? MOOD : ENERGY;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[15px] font-semibold tracking-tight">{label}</span>
        <span className="text-xs font-medium" style={{ color: value ? opts[value - 1].color : undefined }}>{value ? opts[value - 1].label : <span className="muted">Tap one</span>}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="radiogroup" aria-label={label}>
        {opts.map((o) => {
          const on = value === o.n;
          return (
            <button key={o.n} type="button" role="radio" aria-checked={on} aria-label={`${label}: ${o.label}`} onClick={() => onChange(on ? null : o.n)}
              className={clsx("group flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5 transition-all duration-200 active:scale-95", on ? "scale-[1.04] shadow-lg" : "border-ink-700 bg-ink-850/60 hover:-translate-y-0.5 hover:border-ink-600 hover:bg-ink-850")}
              style={on ? { borderColor: o.color, background: `${o.color}1f`, boxShadow: `0 8px 18px -10px ${o.color}` } : undefined}>
              {"emoji" in o
                ? <span className={clsx("text-2xl leading-none transition-transform sm:text-[28px]", on ? "scale-110" : "grayscale-[60%] group-hover:grayscale-0")}>{(o as (typeof MOOD)[number]).emoji}</span>
                : <span className="grid h-7 place-items-center"><Bars n={o.n} color={on ? o.color : "rgb(var(--fog-500))"} size={22} /></span>}
              <span className={clsx("text-[10px] font-medium", on ? "" : "muted")} style={on ? { color: o.color } : undefined}>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Prompt({ icon, color, label, value, onChange, placeholder, multiline }: { icon: React.ReactNode; color: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <label className="flex gap-3 rounded-2xl border border-ink-700 bg-ink-850/50 p-3 transition-all focus-within:border-teal-500 focus-within:bg-ink-900 focus-within:ring-4 focus-within:ring-teal-500/10">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-fog-300">{label}</span>
        {multiline
          ? <textarea className="mt-0.5 w-full resize-none bg-transparent text-sm text-fog-100 placeholder:text-fog-500 focus:outline-none" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          : <input className="mt-0.5 w-full bg-transparent text-sm text-fog-100 placeholder:text-fog-500 focus:outline-none" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
      </span>
    </label>
  );
}

/** Add or edit one check-in. Multiple check-ins per day are allowed. */
export function CheckInForm({ date, tz, initial, onDone, compact }: { date: string; tz: string; initial?: Row | null; onDone?: () => void; compact?: boolean }) {
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [win, setWin] = useState<string>(initial?.win ?? "");
  const [blocker, setBlocker] = useState<string>(initial?.blocker ?? "");
  const [reflection, setReflection] = useState<string>(initial?.reflection ?? "");
  const [gratitude, setGratitude] = useState<string>(initial?.gratitude ?? "");
  const [tags, setTags] = useState<string[]>((initial?.tags as string[]) ?? []);
  const [time, setTime] = useState<string>(initial?.time ?? nowHHMM(tz));
  const [more, setMore] = useState<boolean>(!!(initial?.gratitude || initial?.reflection));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const empty = !energy && !mood && !win.trim() && !blocker.trim() && !reflection.trim() && !gratitude.trim() && !tags.length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (empty) return;
    setBusy(true);
    const data = { date: initial?.date ?? date, time, energy, mood, win: win.trim() || null, blocker: blocker.trim() || null, reflection: reflection.trim() || null, gratitude: gratitude.trim() || null, tags };
    if (initial?.id) await api.update("check_ins", initial.id, data);
    else await api.create("check_ins", data);
    setBusy(false);
    if (!initial?.id) {
      setEnergy(null); setMood(null); setWin(""); setBlocker(""); setReflection(""); setGratitude(""); setTags([]); setTime(nowHHMM(tz)); setMore(false);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    }
    onDone?.();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Picker label="How's your mood?" kind="mood" value={mood} onChange={setMood} />
        <Picker label="How's your energy?" kind="energy" value={energy} onChange={setEnergy} />
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">What are you feeling? <span className="font-normal muted">Pick any</span></div>
        <div className="flex flex-wrap gap-1.5">
          {FEELINGS.map((f) => {
            const on = tags.includes(f.name);
            return (
              <button key={f.name} type="button" aria-pressed={on} onClick={() => setTags((s) => (on ? s.filter((x) => x !== f.name) : [...s, f.name]))}
                className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95",
                  on ? (f.tone === "pos" ? "border-teal-500/50 bg-teal-500/15 text-teal-300 shadow-sm" : "border-rose-400/50 bg-rose-400/15 text-rose-300 shadow-sm") : "border-ink-700 bg-ink-850/60 text-fog-300 hover:-translate-y-0.5 hover:border-ink-600")}>
                <span className="text-sm leading-none">{f.emoji}</span>{f.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Prompt icon={<Trophy size={15} />} color="#14b09e" label="One thing that went right" value={win} onChange={setWin} placeholder="Evidence, not vibes" />
        <Prompt icon={<Construction size={15} />} color="#f97316" label="What got in the way" value={blocker} onChange={setBlocker} placeholder="Name it, then let it go" />
        {more && <>
          {!compact && <Prompt icon={<Heart size={15} />} color="#ec4899" label="Grateful for" value={gratitude} onChange={setGratitude} placeholder="Small things count" />}
          <div className={clsx(!compact && "sm:col-span-1", compact && "sm:col-span-2")}><Prompt icon={<NotebookPen size={15} />} color="#6366f1" label="Reflection / notes" value={reflection} onChange={setReflection} multiline /></div>
        </>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!more && <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setMore(true)}><ChevronDown size={14} />{compact ? "Add a note" : "Add gratitude or a note"}</button>}
        <label className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850/60 px-2.5 py-1 text-xs muted"><Clock size={12} /><input type="time" aria-label="Time" className="bg-transparent text-xs text-fog-300 focus:outline-none" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <span className="flex-1" />
        {saved && <span className="fade-up inline-flex items-center gap-1 text-xs font-semibold text-teal-300" role="status"><Check size={14} strokeWidth={3} />Checked in</span>}
        {onDone && initial?.id && <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>}
        <button className="btn-primary px-5" disabled={busy || empty}>{initial?.id ? "Save changes" : "Check in"}</button>
      </div>
    </form>
  );
}

/** One check-in as a timeline entry. */
export function CheckInItem({ c, tz, showDate, last }: { c: Row; tz: string; showDate?: boolean; last?: boolean }) {
  const [editing, setEditing] = useState(false);
  const m = c.mood ? MOOD[c.mood - 1] : null;
  const en = c.energy ? ENERGY[c.energy - 1] : null;
  if (editing) return <div className="card card-pad"><CheckInForm date={c.date} tz={tz} initial={c} onDone={() => setEditing(false)} /></div>;
  const lines: [React.ReactNode, string, string][] = [];
  if (c.win) lines.push([<Trophy key="w" size={13} />, "#14b09e", c.win]);
  if (c.blocker) lines.push([<Construction key="b" size={13} />, "#f97316", c.blocker]);
  if (c.gratitude) lines.push([<Heart key="g" size={13} />, "#ec4899", c.gratitude]);
  return (
    <div className="group relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-ink-900 text-xl shadow-sm" style={{ borderColor: m?.color ?? "rgb(var(--ink-700))" }} title={m ? `Mood: ${m.label}` : "No mood logged"}>{m?.emoji ?? <NotebookPen size={15} className="text-fog-400" />}</span>
        {!last && <span className="mt-1 w-0.5 flex-1 rounded-full bg-ink-700" />}
      </div>
      <div className="card mb-3 min-w-0 flex-1 p-3.5 transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold tabnum text-fog-100">{showDate ? `${c.date} · ` : ""}{c.time ?? ""}</span>
          {m && <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: `${m.color}1f`, color: m.color }}>{m.label} mood</span>}
          {en && <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium" style={{ background: `${en.color}1a`, color: en.color }}><Bars n={en.n} color={en.color} size={11} />{en.label}</span>}
          <span className="flex-1" />
          <button className="btn-ghost p-1.5 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100" aria-label="Edit check-in" onClick={() => setEditing(true)}><Pencil size={13} /></button>
          <button className="btn-ghost p-1.5 opacity-0 transition-opacity hover:text-rose-500 focus:opacity-100 group-hover:opacity-100" aria-label="Delete check-in" onClick={() => confirm("Delete this check-in?") && api.remove("check_ins", c.id)}><Trash2 size={13} /></button>
        </div>
        {((c.tags as string[]) ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {((c.tags as string[]) ?? []).map((t) => { const f = feeling(t); return <span key={t} className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", f?.tone === "neg" ? "bg-rose-400/10 text-rose-300" : "bg-teal-500/10 text-teal-300")}>{f?.emoji} {t}</span>; })}
          </div>
        )}
        {(lines.length > 0 || c.reflection) && (
          <div className="mt-2.5 space-y-1.5 text-sm">
            {lines.map(([icon, color, text], i) => <p key={i} className="flex gap-2"><span className="mt-0.5 shrink-0" style={{ color }}>{icon}</span><span>{text}</span></p>)}
            {c.reflection && <p className="whitespace-pre-wrap rounded-xl bg-ink-850 px-3 py-2 text-[13px] italic text-fog-300">{c.reflection}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Card for the Today page: add a check-in and see today's. */
export function TodayCheckIns({ today, tz }: { today: string; tz: string }) {
  const { rows } = useList("check_ins", { date: today });
  return (
    <Card title={<span className="inline-flex items-center gap-2">How are you, right now?{rows.length > 0 && <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-300">{rows.length} today</span>}</span>}
      action={<Link href="/check-ins" className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:underline">History <ArrowRight size={12} /></Link>}>
      <CheckInForm date={today} tz={tz} compact />
      {rows.length > 0 && <div className="mt-5 border-t border-ink-800 pt-4">{rows.map((c, i) => <CheckInItem key={c.id} c={c} tz={tz} last={i === rows.length - 1} />)}</div>}
    </Card>
  );
}
