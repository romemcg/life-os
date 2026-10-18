"use client";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Circle, CheckCircle2, Lock, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader, Badge, Progress, Empty, PillarDot, clsx } from "@/components/ui";
import { RoadmapMap } from "@/components/RoadmapMap";
import { milestoneProgress } from "@/lib/progress";
import { usePillars } from "@/components/shared";
import { useSettings, useToday, useList, type Row } from "@/lib/client";
import { ageOn, fmtDate, addDays } from "@/lib/dates";

export default function RoadmapPage() {
  return (
    <Suspense>
      <Roadmap />
    </Suspense>
  );
}

function Roadmap() {
  const router = useRouter();
  // Roadmap is for seeing the order; milestones open in Vision, where they are edited.
  const openMs = (m: Partial<Row>) => router.push(`/vision/${m.pillar_id ?? 0}/${m.id}`);
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const { byId } = usePillars();
  const ms = useList("milestones");
  const tasks = useList("tasks");
  const projects = useList("projects");
  const [showAll, setShowAll] = useState(false);
  const birth = settings.birth_date;

  return (
    <div>
      <PageHeader
        title="Roadmap"
        subtitle="The order you'll work through your life plan, from now to 2035. Vision is what you want in each area. Roadmap is what comes first, what waits, and roughly when you get there."
        actions={<Link href="/vision" className="btn-outline">Add or edit milestones</Link>}
      />

      <RoadmapMap milestones={ms.rows} tasks={tasks.rows} projects={projects.rows} byId={byId} birth={birth} today={today} progressOf={(m) => milestoneProgress(m, tasks.rows, projects.rows)} onOpen={openMs} />

      <div className="mt-4">
        <button className="flex items-center gap-1 text-sm text-fog-400 hover:text-fog-100" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? <ChevronDown size={15} /> : <ChevronRight size={15} />}Every milestone by date
        </button>
        {showAll && (
          <div className="mt-3">
            <PlanView items={ms.rows} all={ms.rows} tasks={tasks.rows} projects={projects.rows} byId={byId} birth={birth} today={today} startDate={settings.start_date || today} onOpen={openMs} />
          </div>
        )}
      </div>
    </div>
  );
}

function PlanView({ items, all, tasks, projects, byId, birth, today, startDate, onOpen }: { items: Row[]; all: Row[]; tasks: Row[]; projects: Row[]; byId: Map<number, Row>; birth: string; today: string; startDate: string; onOpen: (m: Row) => void }) {
  const ninety = addDays(startDate > today ? startDate : today, 90);
  const open = items.filter((m) => !["done", "dropped"].includes(m.status));
  const doneList = all.filter((m) => m.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const dated = open.filter((m) => m.target_date).sort((a, b) => a.target_date.localeCompare(b.target_date));
  const next90 = dated.filter((m) => m.target_date <= ninety);
  const laterByYear = new Map<string, Row[]>();
  for (const m of dated.filter((m) => m.target_date > ninety)) laterByYear.set(m.target_date.slice(0, 4), [...(laterByYear.get(m.target_date.slice(0, 4)) ?? []), m]);
  const whenReady = open.filter((m) => !m.target_date && m.kind !== "aspirational").sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
  const someday = open.filter((m) => !m.target_date && m.kind === "aspirational");
  const [showDone, setShowDone] = useState(false);

  const Section = ({ title, hint, rows, icon }: { title: string; hint?: string; rows: Row[]; icon?: React.ReactNode }) => rows.length === 0 ? null : (
    <section className="card fade-up overflow-hidden">
      <div className="flex items-baseline gap-2 border-b border-ink-800 px-4 py-3 sm:px-5">
        {icon}<h2 className="text-sm font-semibold">{title}</h2><span className="text-xs muted">{rows.length}</span>
        {hint && <span className="ml-auto hidden text-[11px] muted sm:inline">{hint}</span>}
      </div>
      <ul className="divide-y divide-ink-800">
        {rows.map((m) => <PlanRow key={m.id} m={m} p={byId.get(m.pillar_id)} prog={milestoneProgress(m, tasks, projects)} birth={birth} today={today} onOpen={() => onOpen(m)} />)}
      </ul>
    </section>
  );

  return (
    <div className="space-y-4">
      <Section title="Next 90 days" hint={`to ${fmtDate(ninety)}`} rows={next90} />
      {[...laterByYear.entries()].map(([y, rows]) => <Section key={y} title={y} hint={`age ${ageOn(birth, `${y}-06-30`)} mid-year`} rows={rows} />)}
      <Section title="When ready" hint="Unlocks when prerequisites are met" rows={whenReady} icon={<Lock size={13} className="text-amber-300" />} />
      <Section title="Someday" hint="Aspirations, no deadline by design" rows={someday} icon={<Sparkles size={13} className="text-violet-300" />} />
      {open.length === 0 && <Empty>No open milestones match the filters.</Empty>}
      {doneList.length > 0 && (
        <div>
          <button className="text-xs text-fog-400 hover:text-fog-100" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : "Show"} completed ({doneList.length})</button>
          {showDone && <ul className="card mt-2 divide-y divide-ink-800">{doneList.map((m) => <PlanRow key={m.id} m={m} p={byId.get(m.pillar_id)} prog={milestoneProgress(m, tasks, projects)} birth={birth} today={today} onOpen={() => onOpen(m)} />)}</ul>}
        </div>
      )}
    </div>
  );
}

function PlanRow({ m, p, prog, birth, today, onOpen }: { m: Row; p?: Row; prog: ReturnType<typeof milestoneProgress>; birth: string; today: string; onOpen: () => void }) {
  const done = m.status === "done";
  const late = m.target_date && m.target_date < today && !done;
  const ready = !done && prog.auto && prog.total > 0 && prog.done === prog.total;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={clsx("mt-0.5 shrink-0", done ? "text-teal-400" : "text-fog-500")} role="img" aria-label={done ? "Done" : "Open"}>
          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <button className={clsx("text-left text-sm font-medium leading-snug hover:text-teal-200", done && "line-through muted")} onClick={onOpen}>{m.title}</button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] muted">
            <span className="inline-flex items-center gap-1"><PillarDot color={p?.color} />{p?.name}</span>
            {m.target_date ? <span className={clsx(late && "text-amber-300")}>{fmtDate(m.target_date)} · age {ageOn(birth, m.target_date)}{late ? " · past date" : ""}</span> : m.prerequisites ? <span>Needs: {m.prerequisites}</span> : null}
            {m.status === "blocked" && <Badge tone="rose">Blocked</Badge>}
            {m.priority === 1 && !done && <span className="text-teal-300">P1</span>}
          </div>
          {!done && m.next_action && <div className="mt-1 text-xs text-fog-300"><span className="text-fog-500">Next: </span>{m.next_action}</div>}

        </div>
      </div>
      {m.kind !== "aspirational" && (
        <div className="w-full shrink-0 pl-8 sm:w-40 sm:pl-0">
          <div className="mb-1 flex justify-between text-[10px] muted"><span>{prog.auto ? `${prog.done}/${prog.total} tasks` : "set manually"}</span><span>{prog.pct}%</span></div>
          <Progress value={prog.pct} color={p?.color} />
        </div>
      )}
    </li>
  );
}
