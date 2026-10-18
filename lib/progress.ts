type Row = Record<string, any>;

/** Progress for a milestone: automatic from linked one-off tasks (directly or via its projects); manual otherwise. */
export function milestoneProgress(m: Row, tasks: Row[], projects: Row[]) {
  const projIds = new Set(projects.filter((p) => p.milestone_id === m.id).map((p) => p.id));
  const linked = tasks.filter((t) => (t.milestone_id === m.id || (!t.milestone_id && t.project_id && projIds.has(t.project_id))) && (t.recurrence ?? "none") === "none" && t.status !== "dropped" && !t.archived);
  if (m.status === "done") return { pct: 100, auto: linked.length > 0, done: linked.filter((t) => t.status === "done").length, total: linked.length };
  if (!linked.length) return { pct: m.progress ?? 0, auto: false, done: 0, total: 0 };
  const done = linked.filter((t) => t.status === "done").length;
  return { pct: Math.round((done / linked.length) * 100), auto: true, done, total: linked.length };
}

