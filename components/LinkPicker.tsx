"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Target, FolderKanban } from "lucide-react";
import { useList, api, type Row } from "@/lib/client";

type Opts = { pillars: Row[]; milestones: Row[]; projects: Row[] };
const Ctx = createContext<Opts | null>(null);

/** Loads pillars, milestones and projects once so every task row can show and change its links. */
export function LinkOptionsProvider({ children }: { children: React.ReactNode }) {
  const pillars = useList("pillars");
  const milestones = useList("milestones");
  const projects = useList("projects");
  const value = useMemo(
    () => ({
      pillars: pillars.rows,
      milestones: milestones.rows.filter((m) => m.status !== "dropped"),
      projects: projects.rows.filter((p) => p.status !== "dropped"),
    }),
    [pillars.rows, milestones.rows, projects.rows]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Inline chips under a task: milestone and project. Click to change pillar, milestone or project. */
export function LinkChips({ task }: { task: Row }) {
  const o = useContext(Ctx);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  // Close on outside click or Escape. Not on mouse leave: native dropdowns count as leaving and would close it mid-choice.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  if (!o) return null;
  const ms = o.milestones.find((m) => m.id === task.milestone_id);
  const pr = o.projects.find((p) => p.id === task.project_id);
  const pillarId = (task.pillar_id as number | null) ?? null;
  const msOpts = o.milestones.filter((m) => !pillarId || m.pillar_id === pillarId);
  const prOpts = o.projects.filter((p) => (!pillarId || p.pillar_id === pillarId || !p.pillar_id) && (!task.milestone_id || !p.milestone_id || p.milestone_id === task.milestone_id));

  async function set(patch: Record<string, number | null>) {
    // Keep the chain consistent: a project implies its milestone and pillar; a milestone implies its pillar.
    if ("project_id" in patch && patch.project_id) {
      const p = o!.projects.find((x) => x.id === patch.project_id);
      if (p?.milestone_id) patch.milestone_id = p.milestone_id as number;
      if (p?.pillar_id) patch.pillar_id = p.pillar_id as number;
    }
    if ("milestone_id" in patch && patch.milestone_id) {
      const m = o!.milestones.find((x) => x.id === patch.milestone_id);
      if (m?.pillar_id) patch.pillar_id = m.pillar_id as number;
    }
    if ("pillar_id" in patch) {
      if (ms && ms.pillar_id !== patch.pillar_id && !("milestone_id" in patch)) patch.milestone_id = null;
      if (pr && pr.pillar_id && pr.pillar_id !== patch.pillar_id && !("project_id" in patch)) patch.project_id = null;
    }
    await api.update("tasks", task.id, patch);
  }

  const num = (v: string) => (v ? Number(v) : null);

  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[22rem] items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-ink-700 hover:text-fog-100"
        title="Change pillar, milestone or project"
        aria-label={`Links for ${task.title}: change pillar, milestone or project`}
      >
        {ms || pr ? (
          <>
            {ms && <span className="inline-flex min-w-0 items-center gap-1"><Target size={11} className="shrink-0" /><span className="truncate">{ms.title as string}</span></span>}
            {pr && <span className="inline-flex min-w-0 items-center gap-1"><FolderKanban size={11} className="shrink-0" /><span className="truncate">{pr.title as string}</span></span>}
          </>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-300/90"><Link2 size={11} />Link to milestone</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-30 w-72 space-y-2 rounded-lg border border-ink-600 bg-ink-850 p-3 shadow-xl">
          <label className="block text-[11px] muted">Pillar
            <select className="input mt-0.5 py-1 text-xs" value={pillarId ?? ""} onChange={(e) => set({ pillar_id: num(e.target.value) })}>
              <option value="">No life area</option>
              {o.pillars.map((p) => <option key={p.id} value={p.id}>{p.name as string}</option>)}
            </select>
          </label>
          <label className="block text-[11px] muted">Milestone
            <select className="input mt-0.5 py-1 text-xs" value={(task.milestone_id as number) ?? ""} onChange={(e) => set({ milestone_id: num(e.target.value) })}>
              <option value="">None</option>
              {msOpts.map((m) => <option key={m.id} value={m.id}>{m.title as string}</option>)}
            </select>
          </label>
          <label className="block text-[11px] muted">Project
            <select className="input mt-0.5 py-1 text-xs" value={(task.project_id as number) ?? ""} onChange={(e) => set({ project_id: num(e.target.value) })}>
              <option value="">None</option>
              {prOpts.map((p) => <option key={p.id} value={p.id}>{p.title as string}</option>)}
            </select>
          </label>
          <p className="text-[10px] text-fog-500">Choosing a project fills in its milestone and pillar. Progress rolls up automatically.</p>
          <button className="btn-outline w-full py-1 text-xs" onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </span>
  );
}
