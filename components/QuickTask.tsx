"use client";
import { useEffect, useMemo, useState } from "react";
import { Clock, Repeat, AlertTriangle, Star } from "lucide-react";
import clsx from "clsx";
import { Modal } from "./ui";
import { useList, api, type Row } from "@/lib/client";
import { fmtDate } from "@/lib/dates";
import { doToday } from "./useDayPlan";

const DURATIONS = [15, 25, 30, 45, 60, 90, 120];
const REPEATS = [
  { value: "none", label: "Just this day" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly:1,3,5", label: "Mon · Wed · Fri" },
];
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const fmtDur = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}` : `${n}m`);

/**
 * Add a task straight into a day's timeline. It is a normal task, so it also shows in Vision
 * under the life area and milestone you pick.
 */
export function QuickTask({ open, onClose, date, today, time, timed }: {
  open: boolean; onClose: () => void; date: string; today: string; time?: string; timed: Row[];
}) {
  const pillars = useList("pillars");
  const milestones = useList("milestones");
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(time ?? "");
  const [dur, setDur] = useState(30);
  const [pillar, setPillar] = useState<number | null>(null);
  const [ms, setMs] = useState<number | "">("");
  const [repeat, setRepeat] = useState("none");
  const [essential, setEssential] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(""); setAt(time ?? ""); setDur(30); setMs(""); setRepeat("none"); setEssential(false); } }, [open, time]);

  const msOpts = useMemo(() => milestones.rows.filter((m) => m.status !== "dropped" && m.status !== "done" && (!pillar || m.pillar_id === pillar)), [milestones.rows, pillar]);
  const clash = useMemo(() => {
    if (!at) return null;
    const s = toMin(at), e = s + dur;
    return timed.find((t) => { const ts = toMin(t.scheduled_time), te = ts + Number(t.duration_min ?? 30); return s < te && ts < e; }) ?? null;
  }, [at, dur, timed]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const row = await api.create("tasks", {
      title: title.trim(), scheduled_time: at || null, duration_min: dur, pillar_id: pillar, milestone_id: ms || null,
      due_date: date, recurrence: repeat, essential, status: "open", priority: 2, source: "user",
    });
    // A one-off added for today always counts in today's plan, even when the plan is full.
    if (date === today && repeat === "none" && row?.id) await doToday(row.id, today);
    setBusy(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add to ${date === today ? "today" : fmtDate(date, { weekday: true })}`}>
      <form onSubmit={save} className="space-y-4">
        <input autoFocus className="w-full rounded-2xl border border-ink-700 bg-ink-850/60 px-4 py-3 text-base font-semibold placeholder:font-normal placeholder:text-fog-500 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          placeholder="What will you do?" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task" />

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-fog-300"><Clock size={13} />When and how long</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input type="time" className="input w-32 py-1.5" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Start time" />
            {DURATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setDur(d)} className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium tabnum transition-all active:scale-95", dur === d ? "border-teal-500 bg-teal-500/10 text-teal-300" : "border-ink-700 text-fog-400 hover:border-ink-600")}>{fmtDur(d)}</button>
            ))}
          </div>
          {!at && <p className="mt-1 text-[11px] muted">No time = it goes to "Anytime today" under the timeline.</p>}
          {clash && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-300"><AlertTriangle size={12} />Overlaps with "{clash.title}" at {clash.scheduled_time}</p>}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-fog-300">Life area</div>
          <div className="flex flex-wrap gap-1.5">
            {pillars.rows.map((p) => {
              const on = pillar === p.id;
              return (
                <button key={p.id} type="button" onClick={() => { setPillar(on ? null : p.id); setMs(""); }}
                  className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95", on ? "shadow-sm" : "border-ink-700 text-fog-300 hover:border-ink-600")}
                  style={on ? { borderColor: p.color, background: `${p.color}1f`, color: p.color } : undefined}>
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Milestone (optional)</span>
            <select className="input" value={ms} onChange={(e) => setMs(e.target.value ? Number(e.target.value) : "")}>
              <option value="">None</option>
              {msOpts.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label inline-flex items-center gap-1"><Repeat size={12} />Repeat</span>
            <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              {REPEATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={essential} onClick={() => setEssential((v) => !v)} className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all", essential ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : "border-ink-700 text-fog-400")}>
            <Star size={12} fill={essential ? "currentColor" : "none"} />Essential (keeps it on Minimum days)
          </button>
          <span className="flex-1" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary px-5" disabled={busy || !title.trim()}>Add{at ? ` at ${at}` : ""}</button>
        </div>
        <p className="text-[11px] muted">Saved as a normal task, so it also appears in Vision{pillar ? " under this life area" : ""}{ms ? " and milestone" : ""}.</p>
      </form>
    </Modal>
  );
}
