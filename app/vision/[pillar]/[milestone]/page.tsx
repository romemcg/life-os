"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Plus, Pencil, Repeat, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { PageHeader, Card, Progress, Badge, Empty, useToast } from "@/components/ui";
import { RecordForm } from "@/components/RecordForm";
import { TaskRow } from "@/components/TaskRow";
import { taskFields, milestoneFields, statusTone, MILESTONE_STATUS } from "@/components/shared";
import { useTrackOptions } from "@/components/TaskLog";
import { weekRoutineProgress, useTree, tasksOf, stageName, Crumbs } from "@/components/vision";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { fmtDate, ageOn, weekRange } from "@/lib/dates";
import { isRecurring } from "@/lib/recurrence";

export default function MilestonePage() {
  const { pillar, milestone } = useParams<{ pillar: string; milestone: string }>();
  const pid = Number(pillar);
  const loose = milestone === "none";
  const mid = loose ? null : Number(milestone);
  const t = useTree();
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const comps = useList("task_completions", { date: today });
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const [msEdit, setMsEdit] = useState<Row | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const { toast, node } = useToast();
  const track = useTrackOptions();

  const router = useRouter();
  const m = mid ? t.milestones.find((x) => x.id === mid) ?? null : null;
  // If the milestone was moved to another life area, follow it.
  useEffect(() => { if (m && m.pillar_id && m.pillar_id !== pid) router.replace(`/vision/${m.pillar_id}/${m.id}`); }, [m, pid, router]);
  const p = t.pillars.find((x) => x.id === pid);
  const list = tasksOf(m, pid, t.tasks, t.projects);
  const doneToday = new Set(comps.rows.filter((c) => c.kind !== "skipped").map((c) => c.task_id as number));
  const routines = list.filter((x) => isRecurring(x));
  const todo = list.filter((x) => !isRecurring(x) && x.status === "open").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (a.priority ?? 2) - (b.priority ?? 2));
  const done = list.filter((x) => !isRecurring(x) && x.status === "done").sort((a, b) => String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")));
  const prog = m ? t.progressOf(m) : null;
  const [wkMon] = weekRange(today);
  const weekComps = useList("task_completions", { from: wkMon, to: today });
  const ongoing = m ? (m.stage ?? 2) === 0 : false;
  const wk = weekRoutineProgress(list, weekComps.rows, today);

  const pillarOpts = t.pillars.map((x) => ({ value: x.id as number, label: x.name as string }));
  const msOpts = t.milestones.filter((x) => x.status !== "dropped").map((x) => ({ value: x.id as number, label: `${t.pillars.find((pp) => pp.id === x.pillar_id)?.name ?? "No area"} · ${x.title}` }));
  const backHref = pid ? `/vision/${pid}` : "/vision";

  if (!t.loading && mid && !m) return <Empty>That milestone no longer exists. <Link href={backHref} className="underline">Back</Link></Empty>;

  function row(task: Row, isDone: boolean) {
    return (
      <div key={task.id} className="flex items-start">
        <div className="min-w-0 flex-1">
          <TaskRow
            task={task}
            today={today}
            done={isDone}
            pillarColor={p?.color as string}
            onEdit={() => setEdit(task)}
          />
        </div>
        <div className="pt-2.5">
          {confirmDel === task.id ? (
            <button className="btn-danger px-2 py-1 text-xs" autoFocus onBlur={() => setConfirmDel(null)} onClick={async () => { await api.remove("tasks", task.id); setConfirmDel(null); toast("Task deleted"); }}>Delete?</button>
          ) : (
            <button className="btn-ghost p-1.5 text-fog-500 hover:text-rose-300" aria-label={`Delete "${task.title}"`} title="Delete" onClick={() => setConfirmDel(task.id)}><Trash2 size={14} /></button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Crumbs items={[{ label: "Vision", href: "/vision" }, ...(p ? [{ label: p.name as string, href: `/vision/${pid}` }] : [{ label: "No life area" }]), { label: m ? (m.title as string) : "Not in a milestone" }]} />
      <PageHeader
        title={m ? (m.title as string) : "Tasks not in a milestone"}
        subtitle={m ? (m.description as string) || "" : "Edit a task and choose a milestone to move it there."}
        actions={
          <>
            {m && <button className="btn-outline" onClick={() => setMsEdit(m)}><Pencil size={14} /> Edit milestone</button>}
            <button className="btn-primary" onClick={() => setEdit({ pillar_id: pid || null, milestone_id: mid, due_date: today, recurrence: "none", priority: 2, duration_min: 25, status: "open", source: "user" })}><Plus size={15} /> Task</button>
          </>
        }
      />

      {m && prog && (
        <div className="card card-pad mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-[11px] muted">{stageName(m.stage)}</div>
            <div className="mt-1 flex items-center gap-2"><Badge tone={statusTone(m.status)}>{MILESTONE_STATUS.find((s) => s.value === m.status)?.label}</Badge><span className="text-xs muted">{m.target_date ? `${fmtDate(m.target_date, { year: true })} · age ${ageOn(settings.birth_date, m.target_date)}` : "When ready"}</span></div>
          </div>
          <div>
            <div className="text-[11px] muted">{ongoing ? "This week" : "Progress"}</div>
            {ongoing ? (
              <>
                <div className="mt-1.5 flex items-center gap-2"><Progress value={wk.pct} color={p?.color as string} className="flex-1" /><span className="text-xs tabnum">{wk.done}/{wk.planned} this week</span></div>
                <div className="mt-1 text-xs tabnum">Today: {wk.todayDone}/{wk.todayPlanned} routines</div>
                <div className="mt-1 text-[10px] text-fog-500">Ongoing, so it never completes. The bar counts routine ticks since Monday against those planned since Monday.</div>
              </>
            ) : (
              <>
                <div className="mt-1.5 flex items-center gap-2"><Progress value={prog.pct} color={p?.color as string} className="flex-1" /><span className="text-xs tabnum">{prog.total ? `${prog.done}/${prog.total} tasks` : `${prog.pct}%`}</span></div>
                <div className="mt-1 text-[10px] text-fog-500">{prog.total ? "Completes by itself when the last one-off task is done. Routines don't count here." : "No tasks yet, so progress is set by hand."}</div>
              </>
            )}
          </div>
          <div>
            <div className="text-[11px] muted">Weekly commitment</div>
            <div className="mt-1 flex items-start gap-1.5 text-sm"><Repeat size={13} className="mt-0.5 shrink-0 text-fog-500" />{m.weekly_commitment || <span className="muted">Not set. Add it with Edit milestone.</span>}</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`To do (${todo.length})`}>
          {todo.length === 0 ? (
            m && done.length === 0 && m.status !== "done" ? (
              <div className="space-y-2">
                <p className="text-sm muted">No tasks yet, so nothing shows in Today and progress can only be set by hand.</p>
                <button className="btn-outline text-xs" onClick={() => setEdit({ title: m.title, pillar_id: pid || null, milestone_id: mid, due_date: m.target_date ?? today, recurrence: "none", priority: 2, duration_min: 45, status: "open", source: "user" })}>
                  <Plus size={13} /> Add it as one task{m.target_date ? ` on ${fmtDate(m.target_date)}` : ""}
                </button>
                <p className="text-[11px] text-fog-500">Good for one-off goals like a review. You can rename it before saving.</p>
              </div>
            ) : <p className="text-sm muted">Nothing open. Add the next small step.</p>
          ) : <div className="-mx-2 divide-y divide-ink-800">{todo.map((x) => row(x, false))}</div>}
        </Card>
        <Card title={`Routines (${routines.length})`}>
          {routines.length === 0 ? <p className="text-sm muted">No repeating tasks. Set Repeat on a task to make it a routine.</p> : <div className="-mx-2 divide-y divide-ink-800">{routines.map((x) => row(x, doneToday.has(x.id)))}</div>}
          {routines.length > 0 && <p className="mt-2 text-[11px] text-fog-500">Tick these in Today.{ongoing ? "" : " Routines don't block the milestone from completing."}</p>}
        </Card>
      </div>

      {done.length > 0 && (
        <div className="mt-4">
          <button className="flex items-center gap-1 text-xs text-fog-400 hover:text-fog-100" onClick={() => setShowDone((v) => !v)}>
            {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Done ({done.length})
          </button>
          {showDone && <div className="card mt-2 divide-y divide-ink-800 px-2">{done.map((x) => row(x, true))}</div>}
        </div>
      )}

      <RecordForm table="tasks" open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit task" : "New task"} initial={edit} fields={taskFields(pillarOpts, msOpts, [], track.opts)} allowArchive
        onSaved={(r) => { if (edit?.id && (r.milestone_id !== edit.milestone_id || r.pillar_id !== edit.pillar_id)) toast("Moved. Find it under its new milestone."); }} />
      <RecordForm table="milestones" open={!!msEdit} onClose={() => setMsEdit(null)} title="Edit milestone" initial={msEdit} fields={milestoneFields(pillarOpts)} allowArchive
        transform={(v) => ({ ...v, completed_at: v.status === "done" ? (msEdit?.completed_at ?? today) : null })} />
      {node}
    </div>
  );
}
