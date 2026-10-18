"use client";
import { useList, money } from "@/lib/client";
import { addDays, fmtDate } from "@/lib/dates";
import { Card } from "./ui";
import { CheckCircle2 } from "lucide-react";

/** "Evidence That I'm Becoming Better": only counts things actually recorded in the app. */
export function Evidence({ today, days = 30 }: { today: string; days?: number }) {
  const from = addDays(today, -(days - 1));
  const tasks = useList("tasks", { status: "done" });
  const comps = useList("task_completions", { from, to: today });
  const checkins = useList("habit_checkins", { from, to: today });
  const ms = useList("milestones", { status: "done" });
  const apps = useList("applications");
  const interviews = useList("interviews");
  const snaps = useList("balance_snapshots");
  const journal = useList("check_ins", { from, to: today });

  const doneOneOff = tasks.rows.filter((t) => (t.completed_at ?? "") >= from).length;
  const doneRecurring = comps.rows.filter((c) => c.kind !== "skipped").length;
  const appsSent = apps.rows.filter((a) => a.applied_date && a.applied_date >= from && a.applied_date <= today).length;
  const ints = interviews.rows.filter((i) => i.date && i.date >= from && i.date <= today).length;
  const msDone = ms.rows.filter((m) => (m.completed_at ?? m.updated_at ?? "").slice(0, 10) >= from);
  const activeDays = new Set([...comps.rows.map((c) => c.date), ...checkins.rows.map((c) => c.date), ...journal.rows.filter((j) => j.win || j.reflection || j.energy).map((j) => j.date)]).size;
  const wins = journal.rows.filter((j) => j.win).slice(0, 4);

  const first = snaps.rows[0];
  const last = snaps.rows[snaps.rows.length - 1];
  const debtDrop = first && last && first.id !== last.id ? (first.debt as number) - (last.debt as number) : null;

  const items: string[] = [];
  if (doneOneOff + doneRecurring) items.push(`${doneOneOff + doneRecurring} task${doneOneOff + doneRecurring === 1 ? "" : "s"} completed`);
  if (activeDays) items.push(`Showed up on ${activeDays} of the last ${days} days`);
  if (appsSent) items.push(`${appsSent} application${appsSent === 1 ? "" : "s"} sent`);
  if (ints) items.push(`${ints} interview${ints === 1 ? "" : "s"}`);
  if (debtDrop && debtDrop > 0) items.push(`Debt down ${money(debtDrop)} since ${fmtDate(first.date)}`);
  for (const m of msDone) items.push(`Milestone reached: ${m.title}`);

  return (
    <Card title={`Evidence I'm becoming better, last ${days} days`}>
      {items.length === 0 ? (
        <p className="text-sm muted">Nothing recorded yet. Evidence appears here as you complete tasks, check in habits and log applications. Nothing is estimated.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-teal-400" />{t}</li>
          ))}
        </ul>
      )}
      {wins.length > 0 && (
        <div className="mt-3 border-t border-ink-800 pt-3">
          <div className="mb-1 text-[11px] muted">Recent wins you logged</div>
          <ul className="space-y-1 text-sm text-fog-300">{wins.map((w) => <li key={w.id}>“{w.win}” <span className="text-[11px] text-fog-500">{fmtDate(w.date, { year: false })}</span></li>)}</ul>
        </div>
      )}
    </Card>
  );
}
