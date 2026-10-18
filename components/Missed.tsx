"use client";
import { useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useList } from "@/lib/client";
import { addDays, fmtDate } from "@/lib/dates";
import { isRecurring, occursOn, timesPerWeek } from "@/lib/recurrence";
import { Card } from "./ui";
import { usePillars } from "./shared";

const DAYS = 7;
type Status = "done" | "missed" | "skipped" | "off";

/**
 * Read-only pattern of the last 7 days per routine (recurring task).
 * Shows only routines that slipped at least once, worst first, so the one that keeps slipping is obvious.
 * One-off tasks that slip stay in today's plan as overdue, because they can still be done.
 */
export function MissedCard({ today }: { today: string }) {
  const from = addDays(today, -DAYS);
  const to = addDays(today, -1);
  const tasks = useList("tasks");
  const comps = useList("task_completions", { from, to });
  const { byId } = usePillars();
  const [all, setAll] = useState(false);
  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, -(DAYS - i))), [today]);

  const rows = useMemo(() => {
    const out: { id: number; title: string; color?: string; days: Status[]; missed: number; scheduled: number }[] = [];
    for (const t of tasks.rows) {
      if (!isRecurring(t) || t.archived || t.status === "dropped") continue;
      if (timesPerWeek(t) != null) continue; // "any N days a week" can't be missed on a particular day
      const created = String(t.created_at ?? "").slice(0, 10);
      const days: Status[] = dates.map((d) => {
        if ((created && d < created) || !occursOn(t, d)) return "off";
        const c = comps.rows.find((x) => x.task_id === t.id && x.date === d);
        return !c ? "missed" : c.kind === "skipped" ? "skipped" : "done";
      });
      const missed = days.filter((s) => s === "missed").length;
      const scheduled = days.filter((s) => s !== "off").length;
      if (missed + days.filter((s) => s === "skipped").length > 0) out.push({ id: t.id, title: t.title as string, color: byId.get(t.pillar_id)?.color as string | undefined, days, missed, scheduled });
    }
    return out.sort((a, b) => b.missed / b.scheduled - a.missed / a.scheduled || b.missed - a.missed);
  }, [tasks.rows, comps.rows, dates, byId]);

  const loading = tasks.loading || comps.loading;
  const totalMissed = rows.reduce((n, r) => n + r.missed, 0);
  const shown = all ? rows : rows.slice(0, 5);
  const dot: Record<Status, string> = {
    done: "bg-teal-500",
    missed: "bg-rose-400",
    skipped: "bg-ink-600",
    off: "bg-transparent border border-dashed border-ink-700",
  };

  return (
    <Card title="Routines · last 7 days" action={!loading && totalMissed > 0 ? <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">{totalMissed} missed</span> : null}>
      {loading ? <div className="space-y-2"><div className="skeleton h-6" /><div className="skeleton h-6" /></div> : rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-teal-500/10 p-3 text-sm text-teal-300"><Sparkles size={18} />Every routine was done this week.</div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-end gap-[5px] pr-0.5 text-[10px] font-semibold text-fog-500" aria-hidden>
            {dates.map((d) => <span key={d} className="w-3.5 text-center">{fmtDate(d, { weekday: true }).slice(0, 1)}</span>)}
          </div>
          <ul className="space-y-2.5">
            {shown.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: r.color ?? "rgb(var(--ink-600))" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.title}</span>
                  <span className="block text-[10px] muted">{r.scheduled - r.missed - r.days.filter((s) => s === "skipped").length} of {r.scheduled} done</span>
                </span>
                <span className="flex shrink-0 gap-[5px]">
                  {r.days.map((s, i) => <span key={i} title={`${fmtDate(dates[i], { weekday: true })}: ${s === "off" ? "not scheduled" : s}`} className={clsx("h-3.5 w-3.5 rounded-full", dot[s])} />)}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 5 && <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:underline" onClick={() => setAll((v) => !v)}><ChevronDown size={13} className={clsx("transition-transform", all && "rotate-180")} />{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-800 pt-2.5 text-[10px] muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" />Done</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Missed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ink-600" />Skipped</span>
            <span className="ml-auto">A pattern to notice, not a debt to repay.</span>
          </div>
        </>
      )}
    </Card>
  );
}
