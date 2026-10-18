// Single source of truth for the data model.
// Every table automatically gets: id, created_at, updated_at, archived.
// The generic CRUD API only accepts tables and columns listed here.

export type ColType = "text" | "int" | "real" | "bool" | "json";

export interface TableDef {
  columns: Record<string, ColType>;
  required?: string[];
  orderBy?: string;
}

export const TABLES = {
  pillars: {
    columns: { key: "text", name: "text", vision: "text", color: "text", stage_weight: "real", sort: "int" },
    required: ["name"],
    orderBy: "sort, id",
  },
  vision_items: {
    columns: { pillar_id: "int", title: "text", description: "text", image: "text", sort: "int" },
    required: ["title"],
    orderBy: "sort, id",
  },
  milestones: {
    columns: {
      pillar_id: "int",
      title: "text",
      description: "text",
      weekly_commitment: "text",
      // committed | conditional | aspirational
      kind: "text",
      target_date: "text",
      prerequisites: "text",
      est_budget_aed: "real",
      est_effort: "text",
      progress: "int",
      dependencies: "text",
      risks: "text",
      next_action: "text",
      // not_started | in_progress | blocked | done | dropped
      status: "text",
      // 1 high .. 3 low
      priority: "int",
      // template | user
      source: "text",
      completed_at: "text",
      // roadmap stage 0..6 (see lib/stages.ts); 0 = always-on, never gated
      stage: "int",
    },
    required: ["title"],
    orderBy: "COALESCE(target_date,'9999'), priority, id",
  },
  projects: {
    // status: active | paused | done | dropped
    columns: { pillar_id: "int", milestone_id: "int", title: "text", outcome: "text", weekly_commitment: "text", status: "text", start_date: "text", target_date: "text", notes: "text", source: "text" },
    required: ["title"],
    orderBy: "CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, COALESCE(target_date,'9999'), id",
  },
  tasks: {
    columns: {
      title: "text",
      description: "text",
      duration_min: "int",
      // 1 high .. 3 low
      priority: "int",
      due_date: "text",
      scheduled_time: "text",
      pillar_id: "int",
      milestone_id: "int",
      project_id: "int",
      // optional tracker this task feeds: book:current | book:<id> | learning:<id> | habit:<id>
      log_to: "text",
      // none | daily | weekdays | weekly:1,3,5 (0=Sun) | monthly:15
      recurrence: "text",
      // true = part of the Minimum Day
      essential: "bool",
      // true = needs deep focus (only auto-planned on Deep Work days)
      deep: "bool",
      // open | done | dropped  (for one-off tasks)
      status: "text",
      completed_at: "text",
      reschedule_count: "int",
      source: "text",
    },
    required: ["title"],
    orderBy: "COALESCE(due_date,'9999'), priority, id",
  },
  task_completions: {
    columns: { task_id: "int", date: "text", kind: "text" }, // kind: done | skipped
    required: ["task_id", "date"],
    orderBy: "date DESC",
  },
  habits: {
    columns: { pillar_id: "int", milestone_id: "int", name: "text", target_per_week: "int", minimum_version: "text", active: "bool", sort: "int" },
    required: ["name"],
    orderBy: "sort, id",
  },
  habit_checkins: {
    columns: { habit_id: "int", date: "text", value: "real", note: "text" },
    required: ["habit_id", "date"],
    orderBy: "date DESC",
  },
  metrics: {
    // optional body / sleep metrics, user-entered only
    columns: { date: "text", kind: "text", value: "real", unit: "text", note: "text" },
    required: ["date", "kind", "value"],
    orderBy: "date DESC",
  },
  applications: {
    columns: {
      company: "text",
      position: "text",
      source: "text",
      applied_date: "text",
      cv_version: "text",
      contact: "text",
      // saved | applied | screening | interview | final | offer | rejected | withdrawn
      stage: "text",
      next_action: "text",
      next_action_due: "text",
      compensation: "text",
      location: "text",
      url: "text",
      email: "text",
      cv_link: "text",
      // main contact / referrer, a row in contacts
      contact_id: "int",
      fit: "int",
      notes: "text",
    },
    required: ["company", "position"],
    orderBy: "COALESCE(next_action_due,'9999'), id DESC",
  },
  contacts: {
    columns: { name: "text", company: "text", role: "text", email: "text", channel: "text", relationship: "text", last_contact: "text", next_followup: "text", notes: "text" },
    required: ["name"],
    orderBy: "COALESCE(next_followup,'9999'), id",
  },
  interviews: {
    columns: { application_id: "int", date: "text", round: "text", prep_done: "bool", notes: "text", outcome: "text" },
    required: ["application_id"],
    orderBy: "date DESC",
  },
  accounts: {
    // cash | bank | savings | investment
    columns: { name: "text", type: "text", currency: "text", balance: "real", as_of: "text", provenance: "text", accessible: "bool" },
    required: ["name", "balance"],
    orderBy: "id",
  },
  debts: {
    columns: {
      name: "text", type: "text", balance: "real", apr: "real", min_payment: "real", due_day: "int", as_of: "text", provenance: "text", notes: "text",
      // latest statement: amount to pay this cycle, when it arrived, when it's due, and how much has been paid towards it
      statement_amount: "real", statement_date: "text", statement_due: "text", statement_paid: "real",
    },
    required: ["name", "balance"],
    orderBy: "id",
  },
  debt_payments: {
    // a payment to a card or loan; lowers the debt and, if an account is given, that account's balance
    columns: { debt_id: "int", account_id: "int", date: "text", amount: "real", note: "text" },
    required: ["debt_id", "date", "amount"],
    orderBy: "date DESC, id DESC",
  },
  cashflows: {
    // recurring monthly items. kind: income | essential | discretionary
    columns: { name: "text", kind: "text", amount: "real", provenance: "text", due_day: "int", active: "bool", notes: "text" },
    required: ["name", "kind", "amount"],
    orderBy: "CASE kind WHEN 'income' THEN 0 WHEN 'essential' THEN 1 ELSE 2 END, id",
  },
  obligations: {
    // one-off lump sums (visa renewal, deposit, annual fees)
    columns: { name: "text", amount: "real", due_date: "text", status: "text", provenance: "text", notes: "text" },
    required: ["name", "amount"],
    orderBy: "COALESCE(due_date,'9999'), id",
  },
  expenses: {
    // method: cash | debit | credit. account_id (cash/debit) or debt_id (credit card) says where it came from.
    columns: { date: "text", amount: "real", category: "text", essential: "bool", note: "text", method: "text", account_id: "int", debt_id: "int" },
    required: ["date", "amount"],
    orderBy: "date DESC, id DESC",
  },
  balance_snapshots: {
    // auto-recorded when balances change; powers net-worth trend with real data only
    columns: { date: "text", cash: "real", debt: "real" },
    required: ["date"],
    orderBy: "date",
  },
  scenarios: {
    columns: { name: "text", params: "json" },
    required: ["name"],
    orderBy: "id",
  },
  journal: {
    columns: { date: "text", mode: "text", energy: "int", top3: "json", pinned: "json", reflection: "text", win: "text", blocker: "text" },
    required: ["date"],
    orderBy: "date DESC",
  },
  reviews: {
    // weekly | monthly
    columns: { kind: "text", period_start: "text", period_end: "text", answers: "json", stats: "json" },
    required: ["kind", "period_start"],
    orderBy: "period_start DESC",
  },
  people: {
    // circle: family | friend | partner | mentor | community | other
    // rhythm_days: how often you'd like to be in touch (a gentle nudge, never a deadline)
    columns: { name: "text", circle: "text", rhythm_days: "int", birthday: "text", location: "text", what_matters: "text", notes: "text", sort: "int" },
    required: ["name"],
    orderBy: "CASE circle WHEN 'partner' THEN 0 WHEN 'family' THEN 1 WHEN 'friend' THEN 2 ELSE 3 END, name",
  },
  connections: {
    // kind: call | message | met | quality_time | plan | reflection
    // person_id null = self reflection or a social plan without a specific person
    columns: { person_id: "int", date: "text", kind: "text", note: "text", feeling: "int" },
    required: ["date", "kind"],
    orderBy: "date DESC, id DESC",
  },
  books: {
    // month: 'YYYY-MM' slot in the one-book-a-month plan. status: planned | reading | finished | abandoned
    columns: { title: "text", author: "text", month: "text", status: "text", pages_total: "int", current_page: "int", started: "text", finished: "text", rating: "int", takeaways: "text", why: "text", pillar_id: "int", source: "text" },
    required: ["title"],
    orderBy: "COALESCE(month,'9999'), id",
  },
  reading_log: {
    columns: { book_id: "int", date: "text", pages: "int", minutes: "int", note: "text" },
    required: ["book_id", "date"],
    orderBy: "date DESC, id DESC",
  },
  check_ins: {
    // Many per day. time: 'HH:MM' local. mood: 1-5. tags: e.g. ["anxious","productive"]
    columns: { date: "text", time: "text", energy: "int", mood: "int", win: "text", blocker: "text", reflection: "text", gratitude: "text", tags: "json" },
    required: ["date"],
    orderBy: "date DESC, time DESC, id DESC",
  },
  bible_log: {
    // one row per completed plan reading. day_index is 0-based within the plan
    columns: { date: "text", plan: "text", day_index: "int", passage: "text", note: "text" },
    required: ["date", "plan", "day_index"],
    orderBy: "date DESC, id DESC",
  },
  meditations: {
    // kind: silent | breathing | prayer | body_scan | walking
    columns: { date: "text", time: "text", minutes: "real", kind: "text", note: "text" },
    required: ["date", "minutes"],
    orderBy: "date DESC, id DESC",
  },
  text_cache: {
    columns: { key: "text", text: "text", reference: "text", translation: "text" },
    required: ["key"],
    orderBy: "id",
  },
  learning_items: {
    // kind: certification | language | course | skill
    // status: idea | planned | in_progress | done | paused | dropped   (done = earned / completed)
    // gate: now (free or low cost, start anytime) | income (start once income is stable) | later
    columns: {
      kind: "text", title: "text", provider: "text", status: "text", priority: "int", gate: "text",
      cost_note: "text", cost_aed: "real", est_hours: "real", hours_logged: "real",
      level_current: "text", level_target: "text", start_date: "text", target_date: "text", completed_date: "text",
      expires: "text", credential_id: "text", url: "text", why: "text", next_step: "text", pillar_id: "int", source: "text",
    },
    required: ["kind", "title"],
    orderBy: "CASE status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 WHEN 'idea' THEN 2 WHEN 'paused' THEN 3 WHEN 'done' THEN 4 ELSE 5 END, priority, id",
  },
  learning_log: {
    columns: { item_id: "int", date: "text", minutes: "int", note: "text" },
    required: ["item_id", "date"],
    orderBy: "date DESC, id DESC",
  },
  chat_messages: {
    // role: user | assistant. meta: actions the coach took
    columns: { role: "text", content: "text", meta: "json" },
    required: ["role", "content"],
    orderBy: "id",
  },
} satisfies Record<string, TableDef>;

export type TableName = keyof typeof TABLES;

export function isTable(name: string): name is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, name);
}

export const SQL_TYPES: Record<ColType, string> = {
  text: "TEXT",
  int: "INTEGER",
  real: "REAL",
  bool: "INTEGER",
  json: "TEXT",
};
