"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, Lock, Repeat, ArrowRight, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader, Progress, Badge, Empty, clsx } from "@/components/ui";
import { RecordForm } from "@/components/RecordForm";
import { PILLAR_FIELDS, milestoneFields, statusTone, MILESTONE_STATUS } from "@/components/shared";
import { weekRoutineProgress, useTree, tasksOf, nextTask, stageName, Crumbs } from "@/components/vision";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { fmtDate, ageOn, relativeDay, weekRange } from "@/lib/dates";

// Where each area's numbers are logged. Tasks can feed these via "Track it in".
const TRACKERS: Record<string, { label: string; href: string }[]> = {
  discipline: [{ label: "Learning", href: "/learning" }, { label: "Books", href: "/learning?tab=books" }, { label: "Habits & Health", href: "/habits" }],
  health: [{ label: "Habits & Health", href: "/habits" }],
  finance: [{ label: "Money", href: "/finances" }, { label: "Spending", href: "/finances?tab=spending" }],
  career: [{ label: "Career", href: "/career" }, { label: "Certifications", href: "/learning?tab=certification" }],
  relationships: [{ label: "Relationships", href: "/relationships" }],
};

export default function AreaPage() {
  const { pillar } = useParams<{ pillar: string }>();
  const pid = Number(pillar);
  const t = useTree();
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const [msEdit, setMsEdit] = useState<Partial<Row> | null>(null);
  const [areaEdit, setAreaEdit] = useState<Row | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [wkMon] = weekRange(today);
  const weekComps = useList("task_completions", { from: wkMon, to: today });

  const p = t.pillars.find((x) => x.id === pid);
  const pillarOpts = t.pillars.map((x) => ({ value: x.id as number, label: x.name as string }));
  const ms = t.milestones
    .filter((m) => m.pillar_id === pid && m.status !== "dropped")
    .sort((a, b) => (a.stage ?? 2) - (b.stage ?? 2) || (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"));
  const open = ms.filter((m) => m.status !== "done");
  const done = ms.filter((m) => m.status === "done");
  const loose = tasksOf(null, pid, t.tasks, t.projects);

  if (!t.loading && !p) return <Empty>That life area doesn&apos;t exist. <Link href="/vision" className="underline">Back to Vision</Link></Empty>;

  function Card({ m }: { m: Row }) {
    const prog = t.progressOf(m);
    const ongoing = (m.stage ?? 2) === 0;
    const wk = weekRoutineProgress(tasksOf(m, pid, t.tasks, t.projects), weekComps.rows, today);
    const list = tasksOf(m, pid, t.tasks, t.projects);
    const nt = nextTask(list);
    const routines = list.filter((x) => (x.recurrence ?? "none") !== "none").length;
    const locked = (m.stage ?? 2) !== 0 && (m.stage ?? 2) > t.stage && m.status !== "done";
    const isDone = m.status === "done";
    return (
      <div className={clsx("group relative flex flex-col rounded-xl border bg-ink-900/40 p-4 transition-colors hover:border-teal-500/50", isDone ? "border-ink-800 opacity-75" : "border-ink-700")}>
        <Link href={`/vision/${pid}/${m.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={`Open ${m.title}`} />
        <div className="relative z-10 flex items-start gap-2 pointer-events-none">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fog-400">
              {locked && <Lock size={11} />}
              <span>{stageName(m.stage)}</span>
              <Badge tone={statusTone(m.status)}>{MILESTONE_STATUS.find((s) => s.value === m.status)?.label ?? m.status}</Badge>
            </div>
            <h3 className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold leading-snug">
              {isDone && <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-teal-400" />}
              {m.title}
            </h3>
            <div className="mt-1 text-[11px] muted">{m.target_date ? `${fmtDate(m.target_date, { year: true })} · age ${ageOn(settings.birth_date, m.target_date)}` : "When ready"}</div>
          </div>
          <div className="pointer-events-auto flex shrink-0 gap-0.5 opacity-70 group-hover:opacity-100">
            <button className="btn-ghost p-1.5" aria-label={`Edit ${m.title}`} title="Edit or move" onClick={() => setMsEdit(m)}><Pencil size={14} /></button>
            {confirmDel === m.id ? (
              <button className="btn-danger px-2 py-1 text-xs" onClick={async () => { await api.remove("milestones", m.id); setConfirmDel(null); }} onBlur={() => setConfirmDel(null)} autoFocus>Delete?</button>
            ) : (
              <button className="btn-ghost p-1.5 hover:text-rose-300" aria-label={`Delete ${m.title}`} title="Delete" onClick={() => setConfirmDel(m.id)}><Trash2 size={14} /></button>
            )}
          </div>
        </div>
        <div className="relative z-10 mt-3 flex items-center gap-2 pointer-events-none">
          <Progress value={ongoing ? wk.pct : prog.pct} color={p?.color as string} className="flex-1" />
          <span className="text-[11px] tabnum muted">{ongoing ? `Today ${wk.todayDone}/${wk.todayPlanned} · week ${wk.done}/${wk.planned}` : prog.total ? `${prog.done}/${prog.total} tasks` : `${prog.pct}%`}</span>
        </div>
        <div className="relative z-10 mt-3 space-y-1.5 text-xs pointer-events-none">
          <div className="flex items-start gap-1.5"><Repeat size={12} className="mt-0.5 shrink-0 text-fog-500" /><span className={m.weekly_commitment ? "text-fog-300" : "text-fog-500"}>{m.weekly_commitment || "No weekly commitment set"}</span></div>
          <div className="flex items-start gap-1.5"><ArrowRight size={12} className="mt-0.5 shrink-0 text-fog-500" />
            {nt ? <span className="text-fog-300">Next: {nt.title}{nt.due_date && <span className={nt.due_date < today ? " text-amber-300" : " muted"}> · {relativeDay(nt.due_date, today)}</span>}</span> : <span className="text-fog-500">{isDone ? "All tasks done" : "No open tasks"}{routines ? ` · ${routines} routine${routines === 1 ? "" : "s"}` : ""}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Crumbs items={[{ label: "Vision", href: "/vision" }, { label: (p?.name as string) ?? "…" }]} />
      <PageHeader
        title={(p?.name as string) ?? " "}
        subtitle={(p?.vision as string) ?? ""}
        actions={
          <>
            {p && <button className="btn-outline" onClick={() => setAreaEdit(p)}><Pencil size={14} /> Edit area</button>}
            <button className="btn-primary" onClick={() => setMsEdit({ pillar_id: pid, kind: "committed", status: "not_started", priority: 2, progress: 0, stage: t.stage, source: "user" })}><Plus size={15} /> Milestone</button>
          </>
        }
      />

      {p && TRACKERS[p.key as string] && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="muted">Trackers for this area:</span>
          {TRACKERS[p.key as string].map((x) => <Link key={x.href} href={x.href} className="rounded-full border border-ink-700 px-2.5 py-1 hover:border-teal-500/60 hover:text-teal-200">{x.label}</Link>)}
        </div>
      )}

      {t.loading ? null : open.length === 0 && done.length === 0 ? (
        <Empty>No milestones yet. Add the first outcome you want in this area.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{open.map((m) => <Card key={m.id} m={m} />)}</div>
      )}

      {loose.length > 0 && (
        <Link href={`/vision/${pid}/none`} className="card card-pad mt-3 block text-sm hover:border-teal-500/50">
          <span className="font-medium">{loose.length} task{loose.length === 1 ? "" : "s"} not in a milestone</span>
          <span className="ml-2 muted">Open to move them into one.</span>
        </Link>
      )}


      {done.length > 0 && (
        <div className="mt-5">
          <button className="flex items-center gap-1 text-xs text-fog-400 hover:text-fog-100" onClick={() => setShowDone((v) => !v)}>
            {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Completed ({done.length})
          </button>
          {showDone && <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{done.map((m) => <Card key={m.id} m={m} />)}</div>}
        </div>
      )}

      <RecordForm table="milestones" open={!!msEdit} onClose={() => setMsEdit(null)} title={msEdit?.id ? "Edit milestone" : "New milestone"} initial={msEdit} fields={milestoneFields(pillarOpts)} allowArchive
        transform={(v) => ({ ...v, completed_at: v.status === "done" ? (msEdit?.completed_at ?? today) : null })} />
      <RecordForm table="pillars" open={!!areaEdit} onClose={() => setAreaEdit(null)} title="Edit life area" initial={areaEdit} fields={PILLAR_FIELDS} allowDelete={false} allowArchive />
    </div>
  );
}
