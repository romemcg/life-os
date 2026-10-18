import "server-only";
import type Database from "better-sqlite3";
import { getSettings, insertRow, fromDb } from "./db";
import { todayIn, weekRange, addDays, ageOn, monthRange } from "./dates";
import { summarize, simulate, type Account, type Debt, type Cashflow, type Obligation } from "./finance";
import { candidatesFor, planDay, type DayMode, type TaskLike } from "./priority";
import { isRecurring } from "./recurrence";

export const COACH_MODELS = [
  { id: "claude-haiku-5-5", label: "Haiku (fast, lowest cost)" },
  { id: "claude-sonnet-5-5", label: "Sonnet (deeper thinking, higher cost)" },
];

export function apiKey(db: Database.Database): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const r = db.prepare(`SELECT value FROM settings WHERE key='anthropic_api_key'`).get() as { value: string } | undefined;
  return r?.value || null;
}

type R = Record<string, any>;
const all = (db: Database.Database, sql: string, ...a: unknown[]) => db.prepare(sql).all(...a) as R[];

/** A compact, factual snapshot of the user's LIFE OS. Only what is recorded; gaps are stated as gaps. */
export function buildContext(db: Database.Database): string {
  const s = getSettings(db);
  const tz = s.timezone || "Asia/Dubai";
  const today = todayIn(tz);
  const [mon, sun] = weekRange(today);
  const lines: string[] = [];
  lines.push(`Today: ${today}. Age ${ageOn(s.birth_date || "1997-03-14", today)}. Life phase: ${s.life_phase || "-"}. Plan day ${Math.max(1, Math.round((Date.parse(today) - Date.parse(s.start_date || today)) / 864e5) + 1)} of 90 (started ${s.start_date}).`);

  // Today plan
  const tasks = all(db, `SELECT * FROM tasks WHERE archived=0`).map((r) => fromDb("tasks", r)) as (TaskLike & R)[];
  const comps = all(db, `SELECT task_id, kind FROM task_completions WHERE date=?`, today);
  const handled = new Set(comps.map((c) => c.task_id as number));
  const weights = new Map(all(db, `SELECT id, stage_weight FROM pillars`).map((p) => [p.id as number, Number(p.stage_weight ?? 0.5)]));
  const pillarName = new Map(all(db, `SELECT id, name FROM pillars`).map((p) => [p.id as number, p.name as string]));
  const journal = db.prepare(`SELECT mode FROM journal WHERE date=? AND archived=0`).get(today) as R | undefined;
  const mode = ((journal?.mode as DayMode) || (s.day_mode as DayMode) || "standard") as DayMode;
  const plan = planDay(candidatesFor(tasks, today, handled), { today, mode, pillarWeight: (id) => (id ? weights.get(id) ?? 0.5 : 0.5) });
  const doneToday = tasks.filter((t) => (!isRecurring(t) && t.status === "done" && String(t.completed_at ?? "").startsWith(today))).length + comps.filter((c) => c.kind !== "skipped").length;
  lines.push(`\nTODAY (${mode} mode): ${doneToday} done. Planned: ${plan.planned.map((p) => `${p.task.title}${p.task.due_date && p.task.due_date < today && !isRecurring(p.task) ? " (overdue)" : ""}`).join("; ") || "nothing"}.`);
  const overdue = tasks.filter((t) => !isRecurring(t) && t.status === "open" && t.due_date && t.due_date < today);
  if (overdue.length) lines.push(`Overdue one-off tasks: ${overdue.length} (${overdue.slice(0, 5).map((t) => t.title).join("; ")}).`);
  const next7 = tasks.filter((t) => !isRecurring(t) && t.status === "open" && t.due_date && t.due_date > today && t.due_date <= addDays(today, 7));
  if (next7.length) lines.push(`Due in next 7 days: ${next7.slice(0, 8).map((t) => `${t.title} (${t.due_date})`).join("; ")}.`);

  // Projects
  const projects = all(db, `SELECT * FROM projects WHERE archived=0 AND status='active'`);
  if (projects.length) lines.push(`\nACTIVE PROJECTS: ${projects.map((p) => {
    const ts = tasks.filter((t) => t.project_id === p.id && !isRecurring(t));
    return `${p.title} [${ts.filter((t) => t.status === "done").length}/${ts.length} tasks; weekly: ${p.weekly_commitment ?? "-"}]`;
  }).join("; ")}.`);

  // Finance
  const acc = all(db, `SELECT * FROM accounts WHERE archived=0`).map((r) => fromDb("accounts", r)) as unknown as Account[];
  const debts = all(db, `SELECT * FROM debts WHERE archived=0`) as unknown as Debt[];
  const cfs = all(db, `SELECT * FROM cashflows WHERE archived=0`).map((r) => fromDb("cashflows", r)) as unknown as Cashflow[];
  const obs = all(db, `SELECT * FROM obligations WHERE archived=0`) as unknown as Obligation[];
  const f = summarize(acc, debts, cfs, s.currency || "AED");
  if (!acc.length || !cfs.some((c) => c.kind === "essential")) lines.push(`\nFINANCES: baseline NOT entered yet (accounts: ${acc.length}, debts: ${debts.length}, monthly items: ${cfs.length}). Do not estimate figures.`);
  else {
    const sim = simulate({ start: today, months: 36, cash: f.cashAccessible, debts, incomeNow: f.income, essential: f.essential, discretionary: f.discretionary, obligations: obs, strategy: "minimum" });
    lines.push(`\nFINANCES (AED, as entered): accessible cash ${f.cashAccessible}, debt ${f.debtTotal}, minimums ${f.minPayments}/mo, income ${f.income}/mo, essential ${f.essential}/mo, discretionary ${f.discretionary}/mo, net ${f.netMonthly}/mo. Status-quo cash below zero: ${sim.runOutMonth ?? "not within 36 months"}.${f.warnings.length ? " Gaps: " + f.warnings.join(" ") : ""}`);
  }
  const dueSoon = obs.filter((o) => o.status !== "paid" && o.due_date && o.due_date <= addDays(today, 21));
  if (dueSoon.length) lines.push(`Payments due within 21 days: ${dueSoon.map((o) => `${o.name} ${o.amount} on ${o.due_date}`).join("; ")}.`);
  const [ms, me] = monthRange(today);
  const spend = db.prepare(`SELECT COALESCE(SUM(amount),0) t, COALESCE(SUM(CASE WHEN essential=0 OR essential IS NULL THEN amount END),0) d FROM expenses WHERE archived=0 AND date BETWEEN ? AND ?`).get(ms, me) as R;
  lines.push(`Logged spending this month: ${Math.round(spend.t)} (discretionary ${Math.round(spend.d)}).`);

  // Career
  const apps = all(db, `SELECT company, position, stage, applied_date, next_action, next_action_due FROM applications WHERE archived=0`);
  const sentWeek = apps.filter((a) => a.applied_date && a.applied_date >= mon && a.applied_date <= sun).length;
  const stages = apps.reduce((m: R, a) => ((m[a.stage] = (m[a.stage] ?? 0) + 1), m), {});
  lines.push(`\nCAREER: ${apps.length} applications tracked (${Object.entries(stages).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}). This week: ${sentWeek}/${s.weekly_app_target || 8} applications.`);
  const fu = apps.filter((a) => a.next_action_due && a.next_action_due <= today && !["rejected", "withdrawn"].includes(a.stage));
  if (fu.length) lines.push(`Follow-ups due: ${fu.map((a) => `${a.company} (${a.next_action ?? "follow up"})`).join("; ")}.`);
  const active = apps.filter((a) => ["screening", "interview", "final", "offer"].includes(a.stage));
  if (active.length) lines.push(`Active processes: ${active.map((a) => `${a.company} ${a.position} [${a.stage}]`).join("; ")}.`);

  // Habits
  const routines = all(db, `SELECT id, title, recurrence FROM tasks WHERE archived=0 AND COALESCE(recurrence,'none') <> 'none' AND COALESCE(status,'open') <> 'dropped'`);
  const rc = all(db, `SELECT task_id FROM task_completions WHERE archived=0 AND kind <> 'skipped' AND date BETWEEN ? AND ?`, mon, sun);
  lines.push(`\nROUTINES this week (done / repeat rule): ${routines.map((h) => `${h.title} ${rc.filter((c) => c.task_id === h.id).length} (${h.recurrence})`).join("; ") || "none"}.`);

  // Reading
  const book = db.prepare(`SELECT * FROM books WHERE archived=0 AND (status='reading' OR (month=? AND status='planned')) ORDER BY CASE status WHEN 'reading' THEN 0 ELSE 1 END LIMIT 1`).get(today.slice(0, 7)) as R | undefined;
  if (book) lines.push(`\nREADING: ${book.title} by ${book.author ?? "?"} (${book.status}${book.pages_total ? `, page ${book.current_page ?? 0}/${book.pages_total}` : ""}).`);

  const learning = all(db, `SELECT title, kind, status, hours_logged, est_hours, gate FROM learning_items WHERE archived=0 AND status IN ('in_progress','planned')`);
  if (learning.length) lines.push(`LEARNING: in progress: ${learning.filter((l) => l.status === "in_progress").map((l) => `${l.title} (${Math.round(l.hours_logged ?? 0)}/${l.est_hours ?? "?"} h)`).join("; ") || "none"}. Planned: ${learning.filter((l) => l.status === "planned").map((l) => `${l.title}${l.gate === "income" ? " [after income]" : ""}`).join("; ")}.`);
  const held = all(db, `SELECT title FROM learning_items WHERE archived=0 AND status='done' AND kind='certification'`);
  if (held.length) lines.push(`Credentials held: ${held.map((h) => h.title).join("; ")}.`);

  // People (no scoring)
  const people = all(db, `SELECT id, name, rhythm_days FROM people WHERE archived=0`);
  if (people.length) {
    const last = new Map(all(db, `SELECT person_id, MAX(date) d FROM connections WHERE archived=0 AND kind IN ('call','message','met','quality_time') AND date<=? GROUP BY person_id`, today).map((r) => [r.person_id, r.d]));
    const due = people.filter((p) => p.rhythm_days && (!last.get(p.id) || (Date.parse(today) - Date.parse(last.get(p.id))) / 864e5 >= p.rhythm_days));
    if (due.length) lines.push(`People it may be nice to reach out to: ${due.map((p) => p.name).join(", ")}.`);
  }

  // Recent check-ins
  const recent = all(db, `SELECT date, time, energy, mood, win, blocker FROM check_ins WHERE archived=0 AND date>=? ORDER BY date DESC, time DESC LIMIT 8`, addDays(today, -7));
  if (recent.length) lines.push(`\nRECENT CHECK-INS: ${recent.map((j) => `${j.date} ${j.time ?? ""}: energy ${j.energy ?? "-"}, mood ${j.mood ?? "-"}${j.win ? `, win "${j.win}"` : ""}${j.blocker ? `, blocker "${j.blocker}"` : ""}`).join(" | ")}.`);
  lines.push(`\nPillar weights now: ${[...pillarName.entries()].map(([id, n]) => `${n} ${weights.get(id)}`).join(", ")}.`);
  return lines.join("\n");
}

export const SYSTEM = `You are the Coach inside LIFE OS, a personal life execution app. You know the user only through the LIFE OS snapshot and the conversation: their stage, milestones, tasks, habits, finances, applications and check-ins.

How to respond:
- Lead with the answer or the next action. Be concise: usually 2 to 6 short sentences or a few bullets.
- Be warm but honest. Challenge weak assumptions. No guilt, no hype, no motivational filler, no flattery.
- Use ONLY the LIFE OS snapshot and the conversation as facts about the user. Never invent numbers, progress or events. If data is missing, say so and suggest entering it.
- For money questions give factual options and trade-offs; you are not a licensed financial adviser, so do not tell them which investment or trade to make.
- Do not give medical diagnoses. Do not set deadlines on finding love.
- Never use em dashes. Use plain punctuation.
- When it helps, use the tools to add a task or log spending, then confirm in one line what you did. Only take an action when the user asks for it or clearly agrees.`;

export const TOOLS = [
  {
    name: "add_task",
    description: "Add a task to the user's LIFE OS. Use small, startable tasks (5 to 90 minutes).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        duration_min: { type: "integer" },
        priority: { type: "integer", enum: [1, 2, 3], description: "1 high, 3 low" },
        project_title: { type: "string", description: "Optional: exact title of an active project to link." },
      },
      required: ["title"],
    },
  },
  {
    name: "log_expense",
    description: "Log money the user spent, in AED.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        category: { type: "string" },
        essential: { type: "boolean" },
        method: { type: "string", enum: ["cash", "debit", "credit"], description: "How it was paid: cash, debit card or credit card." },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
      required: ["amount", "category"],
    },
  },
];

export function runTool(db: Database.Database, name: string, input: R): { ok: boolean; summary: string } {
  const today = todayIn(getSettings(db).timezone || "Asia/Dubai");
  try {
    if (name === "add_task") {
      const project = input.project_title ? (db.prepare(`SELECT id, pillar_id, milestone_id FROM projects WHERE title = ? AND archived=0`).get(input.project_title) as R | undefined) : undefined;
      const due = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date ?? "") ? input.due_date : today;
      insertRow(db, "tasks", {
        title: String(input.title).slice(0, 200), due_date: due, duration_min: input.duration_min ?? 25, priority: input.priority ?? 2,
        recurrence: "none", status: "open", reschedule_count: 0, source: "coach",
        project_id: project?.id ?? null, pillar_id: project?.pillar_id ?? null, milestone_id: project?.milestone_id ?? null,
      });
      return { ok: true, summary: `Added task "${input.title}" for ${due}${project ? ` in ${input.project_title}` : ""}` };
    }
    if (name === "log_expense") {
      const amount = Number(input.amount);
      if (!(amount > 0)) return { ok: false, summary: "Amount must be positive" };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "") ? input.date : today;
      insertRow(db, "expenses", { date, amount, category: String(input.category || "Other").slice(0, 60), essential: !!input.essential, method: ["cash", "debit", "credit"].includes(String(input.method)) ? String(input.method) : null });
      return { ok: true, summary: `Logged AED ${amount} for ${input.category} on ${date}` };
    }
    return { ok: false, summary: `Unknown tool ${name}` };
  } catch (e) {
    return { ok: false, summary: (e as Error).message };
  }
}
