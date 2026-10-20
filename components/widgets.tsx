"use client";
import { Card, Progress, Badge, PillarDot } from "./ui";
import { usePillars } from "./shared";
import { useList, api } from "@/lib/client";
import { doToday } from "./useDayPlan";
import { ArrowUpToLine, CalendarDays, Send, Users, Trophy } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { weekRange, addDays, relativeDay, diffDays } from "@/lib/dates";

export function WeeklyTargets({ today, settings }: { today: string; settings: Record<string, string> }) {
  const [mon, sun] = weekRange(today);
  const apps = useList("applications");
  const contacts = useList("contacts");
  const appsThisWeek = apps.rows.filter((a) => a.applied_date && a.applied_date >= mon && a.applied_date <= sun).length;
  const outreach = contacts.rows.filter((c) => c.last_contact && c.last_contact >= mon && c.last_contact <= sun).length;
  const at = Number(settings.weekly_app_target || 8);
  const ot = Number(settings.weekly_outreach_target || 5);
  const daysLeft = diffDays(today, sun);
  const items = [
    { label: "Targeted applications", icon: Send, n: appsThisWeek, t: at, color: "#2563eb", href: "/career" },
    { label: "Networking and outreach", icon: Users, n: outreach, t: ot, color: "#6366f1", href: "/career" },
  ];
  return (
    <Card title="This week's targets" action={<span className="text-[11px] muted">{daysLeft === 0 ? "Last day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</span>}>
      <div className="space-y-3">
        {items.map((i) => {
          const hit = i.n >= i.t;
          const pct = Math.min(100, (i.n / i.t) * 100);
          return (
            <Link key={i.label} href={i.href} className={clsx("block rounded-2xl border p-3 transition-all hover:-translate-y-0.5", hit ? "border-transparent" : "border-ink-700 bg-ink-850/50")} style={hit ? { background: `${i.color}14`, borderColor: `${i.color}40` } : undefined}>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: i.color }}>{hit ? <Trophy size={16} /> : <i.icon size={16} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-fog-300">{i.label}</div>
                  <div className="flex items-baseline gap-1"><span className="text-xl font-bold tabnum tracking-tight">{i.n}</span><span className="text-xs tabnum muted">/ {i.t}</span></div>
                </div>
                {hit ? <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: i.color }}>{i.n > i.t ? `+${i.n - i.t} over` : "Target hit"}</span>
                  : <span className="text-[11px] font-medium muted">{i.t - i.n} to go</span>}
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: i.color }} /></div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/** Urgency colour: overdue/today red, tomorrow amber, within 3 days blue, later grey. */
function dueTone(date: string, today: string): "rose" | "amber" | "blue" | "gray" {
  const n = diffDays(today, date);
  if (n <= 0) return "rose";
  if (n === 1) return "amber";
  if (n <= 3) return "blue";
  return "gray";
}

export function Upcoming({ today, days = 7 }: { today: string; days?: number }) {
  const end = addDays(today, days);
  const tasks = useList("tasks", { status: "open" });
  const obligations = useList("obligations");
  const apps = useList("applications");
  const ms = useList("milestones");
  const contacts = useList("contacts");
  const people = useList("people");
  const conns = useList("connections", { kind: "plan" });
  const debts = useList("debts");
  const { byId } = usePillars();
  const bday = (b: string) => {
    const md = b.slice(5);
    for (const y of [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) {
      const iso = `${y}-${md}`;
      if (iso >= today) return iso;
    }
    return null;
  };
  const items = [
    ...tasks.rows.filter((t) => (t.recurrence ?? "none") === "none" && t.due_date && t.due_date > today && t.due_date <= end).map((t) => ({ date: t.due_date as string, label: t.title as string, kind: "Task", color: byId.get(t.pillar_id)?.color, taskId: t.id as number })),
    ...obligations.rows.filter((o) => o.status !== "paid" && o.due_date && o.due_date <= end).map((o) => ({ date: o.due_date as string, label: `${o.name} · AED ${Number(o.amount).toLocaleString()}`, kind: "Payment", color: "#f87171" })),
    ...apps.rows.filter((a) => a.next_action_due && a.next_action_due <= end && !["rejected", "withdrawn"].includes(a.stage)).map((a) => ({ date: a.next_action_due as string, label: `${a.company}: ${a.next_action || "next step"}`, kind: "Career", color: "#6aa3ff" })),
    ...contacts.rows.filter((c) => c.next_followup && c.next_followup <= end).map((c) => ({ date: c.next_followup as string, label: `Follow up: ${c.name}`, kind: "Contact", color: "#6aa3ff" })),
    ...ms.rows.filter((m) => m.target_date && m.target_date >= today && m.target_date <= end && m.status !== "done").map((m) => ({ date: m.target_date as string, label: m.title as string, kind: "Milestone", color: byId.get(m.pillar_id)?.color })),
    ...people.rows.filter((p) => p.birthday && /^\d{4}-\d{2}-\d{2}$/.test(p.birthday)).map((p) => ({ date: bday(p.birthday) as string, label: `${p.name}'s birthday`, kind: "Birthday", color: "#e08fb0" })).filter((x) => x.date && x.date <= end),
    ...debts.rows.filter((d) => d.statement_due && d.statement_due <= end && Number(d.statement_amount) - (Number(d.statement_paid) || 0) > 0.009).map((d) => ({ date: d.statement_due as string, label: `${d.name} statement · AED ${(Number(d.statement_amount) - (Number(d.statement_paid) || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, kind: "Payment", color: "#f87171" })),
    ...conns.rows.filter((c) => c.date >= today && c.date <= end).map((c) => ({ date: c.date as string, label: c.note || "Social plan", kind: "Plan", color: "#e08fb0" })),
  ].sort((a, b) => a.date.localeCompare(b.date)) as { date: string; label: string; kind: string; color?: string; taskId?: number }[];
  return (
    <Card title={`Next ${days} days`}>
      {items.length === 0 ? (
        <p className="text-sm muted">No deadlines.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 10).map((i, k) => (
            <li key={k} className="flex items-start gap-2 text-sm">
              <PillarDot color={i.color} className="mt-1.5" />
              <div className="min-w-0 flex-1"><div className="truncate">{i.label}</div><div className="text-[11px] muted">{i.kind}</div></div>
              <Badge tone={dueTone(i.date, today)}>{relativeDay(i.date, today)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
