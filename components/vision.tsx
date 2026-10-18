"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useList, api, type Row } from "@/lib/client";
import { STAGES } from "@/lib/stages";
import { milestoneProgress } from "@/lib/progress";
import { isRecurring, occurrencesBetween } from "@/lib/recurrence";
import { weekRange } from "@/lib/dates";

/** Resize client-side so the database stays small; returns a JPEG data URL. */
export async function resizeImage(file: File, max = 1200): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read that image"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The area's picture lives on its vision card (one per area). */
export async function setAreaImage(pillar: Row, image: string, cards: Row[]) {
  const card = cards.find((v) => v.pillar_id === pillar.id);
  if (card) await api.update("vision_items", card.id, { image });
  else await api.create("vision_items", { title: pillar.name, pillar_id: pillar.id, image });
}

/** Current roadmap stage: the first stage whose milestones are not all done. */
export function currentStage(milestones: Row[]) {
  const live = milestones.filter((m) => m.status !== "dropped");
  for (const s of STAGES) {
    const list = live.filter((m) => (m.stage ?? 2) === s.id);
    if (!(list.length > 0 && list.every((m) => m.status === "done"))) return s.id;
  }
  return STAGES[STAGES.length - 1].id;
}

export function stageName(id?: number | null) {
  if (id === 0) return "Always on";
  const s = STAGES.find((x) => x.id === (id ?? 2));
  return s ? `Stage ${s.id} · ${s.name}` : "";
}

/** Tasks that belong to a milestone: directly, or through one of its old projects. */
export function tasksOf(m: Row | null, pillarId: number, tasks: Row[], projects: Row[]) {
  if (!m) return tasks.filter((t) => !t.milestone_id && (t.pillar_id ?? null) === (pillarId || null) && !(t.project_id && projects.some((p) => p.id === t.project_id && p.milestone_id)));
  const projIds = new Set(projects.filter((p) => p.milestone_id === m.id).map((p) => p.id));
  return tasks.filter((t) => t.milestone_id === m.id || (t.project_id && projIds.has(t.project_id) && !t.milestone_id));
}

export function nextTask(list: Row[]) {
  return list
    .filter((t) => !isRecurring(t) && t.status === "open")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (a.priority ?? 2) - (b.priority ?? 2))[0];
}

export function useTree() {
  const pillars = useList("pillars");
  const milestones = useList("milestones");
  const tasks = useList("tasks");
  const projects = useList("projects");
  const cards = useList("vision_items");
  const loading = pillars.loading || milestones.loading || tasks.loading;
  return useMemo(() => {
    const live = tasks.rows.filter((t) => !t.archived && t.status !== "dropped");
    const ms = milestones.rows.filter((m) => !m.archived);
    return {
      loading,
      pillars: pillars.rows,
      milestones: ms,
      tasks: live,
      projects: projects.rows,
      cards: cards.rows,
      stage: currentStage(ms),
      progressOf: (m: Row) => milestoneProgress(m, live, projects.rows),
    };
  }, [pillars.rows, milestones.rows, tasks.rows, projects.rows, cards.rows, loading]);
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-fog-400">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} className="text-fog-500" />}
          {it.href ? <Link href={it.href} className="hover:text-fog-100 hover:underline">{it.label}</Link> : <span className="text-fog-200">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Always-on milestones are ongoing: measured by this week's routines (done vs planned so far), never "complete". */
export function weekRoutineProgress(list: Row[], weekComps: Row[], today: string) {
  const [mon] = weekRange(today);
  const routines = list.filter((t) => isRecurring(t));
  const planned = routines.reduce((n, t) => n + occurrencesBetween(t, mon, today), 0);
  const ids = new Set(routines.map((t) => t.id));
  const done = weekComps.filter((c) => c.kind !== "skipped" && ids.has(c.task_id) && c.date >= mon && c.date <= today).length;
  const todayPlanned = routines.filter((t) => occurrencesBetween(t, today, today) > 0).length;
  const todayDone = weekComps.filter((c) => c.kind !== "skipped" && ids.has(c.task_id) && c.date === today).length;
  return { done, planned, todayDone, todayPlanned, pct: planned ? Math.min(100, Math.round((done / planned) * 100)) : 0, routines: routines.length };
}
