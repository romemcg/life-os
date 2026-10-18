// First-run seed. Only PLANS and TEMPLATES are seeded (source = 'template').
// No balances, achievements, applications or metrics are ever invented.
import type Database from "better-sqlite3";
import type { TableName } from "./schema";

type Insert = (db: Database.Database, table: TableName, row: Record<string, unknown>) => number;


// Starter dates are written for a plan that starts on 2026-10-15 and shifted to the day the database is created.
const ORIGIN = Date.UTC(2026, 9, 15);
const START = new Date().toISOString().slice(0, 10);
const shiftDays = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.now() + (Date.UTC(y, m - 1, d) - ORIGIN)).toISOString().slice(0, 10);
};
const shiftMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date();
  const total = n.getUTCFullYear() * 12 + n.getUTCMonth() + (y * 12 + (m - 1) - (2026 * 12 + 9));
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

export const PILLARS = [
  { key: "finance", name: "Financial Independence", color: "#4fb8ab", stage_weight: 1.0, vision: "Debt-free, emergency fund, reliable income, responsible investing over time." },
  { key: "career", name: "Career", color: "#6aa3ff", stage_weight: 1.0, vision: "Stable employment in technical product / delivery work and growing earning power." },
  { key: "discipline", name: "Discipline & Learning", color: "#c7b37f", stage_weight: 0.8, vision: "Daily structure, reading, focus, journaling, rest and sustainable consistency." },
  { key: "health", name: "Health & Appearance", color: "#7fd18a", stage_weight: 0.8, vision: "Athletic, sustainable physique; sleep, nutrition, skin, hair and personal style." },
  { key: "relationships", name: "Relationships & Family", color: "#e08fb0", stage_weight: 0.5, vision: "Healthy relationship, reciprocal boundaries, supportive friends, regular family contact." },
  { key: "business", name: "Entrepreneurship", color: "#b48ef0", stage_weight: 0.3, vision: "Validate low-cost AI/automation, IoT or digital-product ideas; first paying customers before scaling." },
  { key: "content", name: "Personal Brand", color: "#f0a36a", stage_weight: 0.3, vision: "Personal brand documenting life, tech, career, growth and travel." },
  { key: "home", name: "Home & Car", color: "#8fb8c9", stage_weight: 0.2, vision: "A modern home and an affordable vehicle, when affordable." },
  { key: "travel", name: "Travel", color: "#d9d36a", stage_weight: 0.2, vision: "Japan, Portugal, Italy, Switzerland as resources permit." },
];

export function seed(db: Database.Database, insert: Insert) {
  const set = db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)`);
  const ts = new Date().toISOString();
  const settings: Record<string, string> = {
    birth_date: "1997-03-14",
    start_date: START,
    timezone: "Asia/Dubai",
    currency: "AED",
    life_phase: "Stabilize: income, cash, routine",
    day_mode: "standard",
    weekly_app_target: "8",
    weekly_outreach_target: "5",
    wake_time: "07:00",
  };
  for (const [k, v] of Object.entries(settings)) set.run(k, v, ts);

  const pid: Record<string, number> = {};
  PILLARS.forEach((p, i) => (pid[p.key] = insert(db, "pillars", { ...p, sort: i })));

  // Vision board placeholders (no images until the user uploads them)
  PILLARS.forEach((p, i) =>
    insert(db, "vision_items", { pillar_id: pid[p.key], title: p.name, description: p.vision, sort: i })
  );

  type M = {
    p: string; title: string; kind: "committed" | "conditional" | "aspirational"; date?: string; pri?: number;
    pre?: string; next?: string; risks?: string; effort?: string; desc?: string;
  };
  const milestones: M[] = [
    { p: "finance", title: "Financial baseline entered and verified", kind: "committed", date: shiftDays("2026-10-17"), pri: 1, effort: "1 hour", next: "Enter every balance, debt (APR, minimum, due day) and essential cost in Finances.", desc: "Replaces historical, unreconciled figures with dated actuals." },
    { p: "finance", title: "Rent, renewals and other lump-sum dates confirmed", kind: "committed", date: shiftDays("2026-10-18"), pri: 1, effort: "30 min", next: "Add each one-off obligation with exact amount and due date.", risks: "Missed residency deadline; late fees." },
    { p: "career", title: "Job search system live", kind: "committed", date: shiftDays("2026-10-21"), pri: 1, effort: "3 hours", next: "Mark every historical lead active or closed; record CV v1.", desc: "Tracker current, 2 role tracks chosen, CV versions recorded." },
    { p: "discipline", title: "Minimum Day completed on 14 of 21 days", kind: "committed", date: shiftDays("2026-11-05"), pri: 2, effort: "15 min/day", next: "Pick a wake time you can keep 5 days out of 7." },
    { p: "career", title: "20 targeted applications and 10 outreach messages", kind: "committed", date: shiftDays("2026-11-14"), pri: 1, effort: "~8 h/week", next: "Shortlist roles posted in the last 7 days that match track A or B.", desc: "Quality over volume: each application tailored." },
    { p: "discipline", title: "Day-30 review: pipeline conversion and spending", kind: "committed", date: shiftDays("2026-11-14"), pri: 1, effort: "1 hour", next: "Complete weekly reviews so the 30-day review has data." },
    { p: "career", title: "Day-60 review: adjust targeting and alternatives", kind: "committed", date: shiftDays("2026-12-14"), pri: 1, effort: "1 hour", pre: "Day-30 review done", next: "If responses < 10%, test adjacent roles (PMO, coordinator, technical support)." },
    { p: "health", title: "12 weeks of 3 workouts per week", kind: "committed", date: shiftDays("2027-01-07"), pri: 2, effort: "3 x 45 min/week", next: "Schedule this week's 3 sessions." },
    { p: "discipline", title: "Day-90 review: reset priorities", kind: "committed", date: shiftDays("2027-01-13"), pri: 1, effort: "2 hours", pre: "Day-60 review done", next: "Decide if business/content work can start." },
    { p: "career", title: "Stable income secured", kind: "conditional", pri: 1, pre: "Offer accepted and start date confirmed", next: "Run the job-search weekly targets.", risks: "Runway ends before start date." },
    { p: "finance", title: "Emergency fund: 1 month of essentials", kind: "conditional", pri: 1, pre: "Positive monthly cash flow", next: "Set target in Finances once essentials are entered." },
    { p: "finance", title: "High-cost card debt cleared", kind: "conditional", pri: 1, pre: "Stable income; verified APRs", next: "Compare avalanche vs snowball in Finances.", desc: "Date is calculated in Finances from your real figures." },
    { p: "finance", title: "Emergency fund: 3 to 6 months of essentials", kind: "conditional", pri: 2, pre: "Card debt cleared" },
    { p: "business", title: "First paying customer for a validated idea", kind: "conditional", pri: 3, pre: "Essentials covered for 3 consecutive months; 5 customer interviews", next: "Keep an idea backlog; no spend until prerequisites are met." },
    { p: "content", title: "Personal brand: 1 publish per week for 12 weeks", kind: "conditional", pri: 3, pre: "Minimum routine stable for 4 weeks" },
    { p: "travel", title: "First wishlist trip, fully pre-funded", kind: "conditional", pri: 3, pre: "No card debt; 3-month emergency fund; travel savings covers 100% of budget" },
    { p: "home", title: "Land title verified and construction budget drafted", kind: "conditional", pri: 3, pre: "Title documents reviewed; 6-month emergency fund", risks: "Title and legal status must be verified first." },
    { p: "home", title: "Modern home built", kind: "aspirational", pri: 3, pre: "Construction budget funded or financed affordably" },
    { p: "home", title: "Own an affordable vehicle", kind: "aspirational", pri: 3, pre: "Total cost of ownership < agreed share of income" },
    { p: "finance", title: "Financial independence", kind: "aspirational", pri: 3 },
    { p: "relationships", title: "Healthy, stable romantic relationship", kind: "aspirational", pri: 3, desc: "No deadline by design. Track actions you control: social plans, boundaries, reflection." },
    { p: "travel", title: "Japan, Portugal, Italy, Switzerland", kind: "aspirational", pri: 3 },
    { p: "content", title: "Personal brand: 10K followers", kind: "aspirational", pri: 3, desc: "A goal, not a forecast." },
  ];
  const mid: Record<string, number> = {};
  for (const m of milestones) {
    mid[m.title] = insert(db, "milestones", {
      pillar_id: pid[m.p], title: m.title, description: m.desc, kind: m.kind, target_date: m.date, priority: m.pri ?? 2,
      prerequisites: m.pre, next_action: m.next, risks: m.risks, est_effort: m.effort, progress: 0, status: "not_started", source: "template",
    });
  }

  type T = { t: string; p: string; m?: string; d?: string; min: number; pri: number; rec?: string; ess?: boolean; deep?: boolean; time?: string; desc?: string };
  const tasks: T[] = [
    // recurring
    { t: "Pick today's top 3", p: "discipline", min: 5, pri: 1, rec: "daily", ess: true, time: "07:30" },
    { t: "Log today's spending", p: "finance", min: 5, pri: 1, rec: "daily", ess: true, time: "21:00" },
    { t: "Application block: 2 tailored applications or 1 application + 1 outreach", p: "career", m: "20 targeted applications and 10 outreach messages", min: 90, pri: 1, rec: "weekdays", deep: true, time: "09:30" },
    { t: "Interview practice: rehearse one STAR story aloud", p: "career", min: 25, pri: 2, rec: "weekly:1,3,5", time: "14:00" },
    { t: "Weekly review", p: "discipline", min: 30, pri: 1, rec: "weekly:0", ess: true, time: "18:00" },
    // Days 1-7
    { t: "Enter every cash and bank balance in Finances", p: "finance", m: "Financial baseline entered and verified", d: shiftDays("2026-10-15"), min: 20, pri: 1, ess: true },
    { t: "Enter every debt: balance, APR, minimum payment, due day", p: "finance", m: "Financial baseline entered and verified", d: shiftDays("2026-10-15"), min: 30, pri: 1, ess: true },
    { t: "Confirm rent, visa costs and exact due dates; add as obligations", p: "finance", m: "Rent, renewals and other lump-sum dates confirmed", d: shiftDays("2026-10-16"), min: 30, pri: 1, ess: true },
    { t: "Record latest verified CV as CV v1 in Career", p: "career", m: "Job search system live", d: shiftDays("2026-10-16"), min: 20, pri: 2 },
    { t: "Review historical leads; mark each active or closed", p: "career", m: "Job search system live", d: shiftDays("2026-10-17"), min: 45, pri: 1, desc: "Go through every lead from your notes and email. Do not assume any are still active." },
    { t: "Set a target wake time and a phone-off time", p: "discipline", d: shiftDays("2026-10-17"), min: 10, pri: 2 },
    { t: "Plan 5 home-cooked meals and a grocery list", p: "health", d: shiftDays("2026-10-18"), min: 30, pri: 2 },
    { t: "If minimums aren't covered: ask card issuer about hardship/restructuring", p: "finance", d: shiftDays("2026-10-19"), min: 30, pri: 2, desc: "Only needed if the runway shows minimum payments are at risk." },
    { t: "Choose 2 role tracks; write 3 STAR stories from real experience", p: "career", m: "Job search system live", d: shiftDays("2026-10-19"), min: 60, pri: 1, deep: true },
    { t: "Shortlist 10 roles posted in the last 7 days that fit your tracks", p: "career", d: shiftDays("2026-10-20"), min: 45, pri: 1 },
    { t: "Draft 5 networking messages to former colleagues", p: "career", d: shiftDays("2026-10-21"), min: 40, pri: 2 },
  ];
  for (const t of tasks) {
    insert(db, "tasks", {
      title: t.t, description: t.desc, pillar_id: pid[t.p], milestone_id: t.m ? mid[t.m] : null, due_date: t.d ?? null,
      duration_min: t.min, priority: t.pri, recurrence: t.rec ?? "none", essential: !!t.ess, deep: !!t.deep,
      scheduled_time: t.time, status: "open", reschedule_count: 0, source: "template",
    });
  }

  const habits = [
    { p: "discipline", name: "Up at target wake time", tpw: 5, min: "Out of bed within 15 minutes of target" },
    { p: "health", name: "Move 30 minutes", tpw: 4, min: "10-minute walk" },
    { p: "health", name: "Cooked at home (no delivery)", tpw: 5, min: "One simple home meal" },
    { p: "discipline", name: "Read 20 minutes", tpw: 5, min: "Read 2 pages" },
    { p: "discipline", name: "Phone-free first hour", tpw: 5, min: "Phone-free first 15 minutes" },
    { p: "relationships", name: "Meaningful contact with family or a friend", tpw: 2, min: "Send one genuine message" },
  ];
  habits.forEach((h, i) =>
    insert(db, "habits", { pillar_id: pid[h.p], name: h.name, target_per_week: h.tpw, minimum_version: h.min, active: true, sort: i })
  );
}

/** v2: starter projects linked to existing template milestones/tasks. Runs once, also on existing databases. */
export function seedV2(db: Database.Database, insert: Insert) {
  const ms = (title: string) => (db.prepare(`SELECT id, pillar_id FROM milestones WHERE title = ?`).get(title) as { id: number; pillar_id: number } | undefined);
  const pillar = (key: string) => (db.prepare(`SELECT id FROM pillars WHERE key = ?`).get(key) as { id: number } | undefined)?.id ?? null;
  const projects: { title: string; milestone?: string; also?: string[]; pillar: string; outcome: string; weekly: string; target?: string }[] = [
    { title: "Rebuild my financial baseline", milestone: "Financial baseline entered and verified", also: ["Rent, renewals and other lump-sum dates confirmed"], pillar: "finance", outcome: "Every balance, debt and obligation is known, dated and visible in one place.", weekly: "Log spending daily; update balances every Sunday", target: shiftDays("2026-10-21") },
    { title: "Run a structured job search", milestone: "20 targeted applications and 10 outreach messages", also: ["Job search system live"], pillar: "career", outcome: "A stable role in technical product, delivery or PMO work.", weekly: "8 tailored applications and 5 genuine outreach messages", target: shiftDays("2027-01-13") },
    { title: "Rebuild my daily routine", milestone: "Minimum Day completed on 14 of 21 days", pillar: "discipline", outcome: "A routine that survives bad days.", weekly: "Minimum Day on at least 5 days; weekly review every Sunday", target: shiftDays("2026-11-05") },
    { title: "Rebuild my fitness routine", milestone: "12 weeks of 3 workouts per week", pillar: "health", outcome: "Training is the default, not an effort.", weekly: "3 planned workouts and 5 home-cooked days", target: shiftDays("2027-01-07") },
    { title: "Stay close to the people who matter", pillar: "relationships", outcome: "Regular, unhurried contact with family and friends.", weekly: "One family call and one genuine message to a friend" },
  ];
  const today = new Date().toISOString().slice(0, 10);
  for (const p of projects) {
    const m = p.milestone ? ms(p.milestone) : undefined;
    const id = insert(db, "projects", { title: p.title, outcome: p.outcome, weekly_commitment: p.weekly, pillar_id: m?.pillar_id ?? pillar(p.pillar), milestone_id: m?.id ?? null, status: "active", start_date: today, target_date: p.target ?? null, source: "template" });
    for (const t of [p.milestone, ...(p.also ?? [])]) {
      const mm = t ? ms(t) : undefined;
      if (mm) db.prepare(`UPDATE tasks SET project_id = ? WHERE milestone_id = ? AND project_id IS NULL`).run(id, mm.id);
    }
    // template tasks with no milestone, matched by pillar and title
    const links: Record<string, string[]> = {
      "Rebuild my financial baseline": ["Log today's spending", "If minimums aren't covered: ask card issuer about hardship/restructuring"],
      "Run a structured job search": ["Interview practice: rehearse one STAR story aloud", "Shortlist 10 roles posted in the last 7 days that fit your tracks", "Draft 5 networking messages to former colleagues"],
      "Rebuild my daily routine": ["Pick today's top 3", "Weekly review", "Set a target wake time and a phone-off time"],
      "Rebuild my fitness routine": ["Plan 5 home-cooked meals and a grocery list"],
    };
    for (const title of links[p.title] ?? []) db.prepare(`UPDATE tasks SET project_id = ? WHERE title = ? AND project_id IS NULL AND source = 'template'`).run(id, title);
  }
}

/** v3: a suggested one-book-a-month plan (Oct 2026 to Sep 2027). Swap any of them; page counts are left for you to fill in. */
export const BOOK_PLAN: { month: string; title: string; author: string; pillar: string; why: string }[] = [
  { month: shiftMonth("2026-10"), title: "Atomic Habits", author: "James Clear", pillar: "discipline", why: "Rebuilding routine: small habits, environment design, identity." },
  { month: shiftMonth("2026-11"), title: "The Psychology of Money", author: "Morgan Housel", pillar: "finance", why: "Behaviour around money while you stabilise finances." },
  { month: shiftMonth("2026-12"), title: "Designing Your Life", author: "Bill Burnett & Dave Evans", pillar: "career", why: "Structured way to explore career paths and prototype options." },
  { month: shiftMonth("2027-01"), title: "Never Split the Difference", author: "Chris Voss", pillar: "career", why: "Negotiation skills for offers, salary and everyday conversations." },
  { month: shiftMonth("2027-02"), title: "Deep Work", author: "Cal Newport", pillar: "discipline", why: "Focus and fewer distractions; supports Deep Work days." },
  { month: shiftMonth("2027-03"), title: "The Mom Test", author: "Rob Fitzpatrick", pillar: "business", why: "Low-cost customer interviews before building any business idea." },
  { month: shiftMonth("2027-04"), title: "Nonviolent Communication", author: "Marshall B. Rosenberg", pillar: "relationships", why: "Clearer, kinder conversations and boundaries." },
  { month: shiftMonth("2027-05"), title: "Inspired", author: "Marty Cagan", pillar: "career", why: "Product management craft for your next role." },
  { month: shiftMonth("2027-06"), title: "Man's Search for Meaning", author: "Viktor E. Frankl", pillar: "discipline", why: "Purpose and resilience through hard seasons." },
  { month: shiftMonth("2027-07"), title: "I Will Teach You to Be Rich", author: "Ramit Sethi", pillar: "finance", why: "Practical systems for saving, spending and investing once income is stable." },
  { month: shiftMonth("2027-08"), title: "Show Your Work!", author: "Austin Kleon", pillar: "content", why: "Sharing your journey for your personal brand without overthinking it." },
  { month: shiftMonth("2027-09"), title: "Meditations", author: "Marcus Aurelius", pillar: "discipline", why: "Calm, perspective and self-discipline. Short daily reading." },
];
export function seedV3(db: Database.Database, insert: Insert) {
  const pillar = (key: string) => (db.prepare(`SELECT id FROM pillars WHERE key = ?`).get(key) as { id: number } | undefined)?.id ?? null;
  for (const b of BOOK_PLAN) insert(db, "books", { ...b, pillar: undefined, pillar_id: pillar(b.pillar), status: "planned", source: "suggested" });
}

/** v4: learning hub suggestions. Costs and requirements change: every paid item says to check the official site. */
type L = { kind: string; title: string; provider?: string; status?: string; priority: number; gate: string; why: string; next_step?: string; pillar: string; cost_note?: string; est_hours?: number; level_current?: string; level_target?: string; url?: string; credential_id?: string; source?: string };
export const LEARNING_PLAN: L[] = [
  // Already earned (example entries)
  { kind: "certification", title: "Professional Scrum Master I (PSM I)", provider: "Scrum.org", status: "done", priority: 2, gate: "now", pillar: "career", why: "Shows you know how modern product teams work.", next_step: "Record the expiry date and renewal requirements.", source: "records" },
  { kind: "certification", title: "Google Data Analytics Certificate", provider: "Coursera", status: "done", priority: 3, gate: "now", pillar: "career", why: "Backs your analytics and reporting skills.", next_step: "Record the credential ID and expiry date.", source: "records" },
  // Certifications to pursue
  { kind: "certification", title: "PMP (Project Management Professional)", provider: "PMI", status: "planned", priority: 1, gate: "income", pillar: "career", est_hours: 120, url: "https://www.pmi.org", why: "The most recognised credential for PMO, delivery and programme roles in the UAE.", next_step: "Confirm eligibility on pmi.org (project experience + 35 contact hours). Start the 35 hours with free or low-cost material now; pay the exam once income is stable.", cost_note: "Exam fee plus training hours; check current price on pmi.org" },
  { kind: "certification", title: "PRINCE2 Foundation", provider: "PeopleCert / AXELOS", status: "idea", priority: 2, gate: "income", pillar: "career", est_hours: 25, url: "https://www.peoplecert.org", why: "Widely requested in UAE government and semi-government PMO roles.", next_step: "Compare against PMP for your target employers before paying for both.", cost_note: "Check current exam and course price" },
  { kind: "certification", title: "Microsoft Power BI Data Analyst (PL-300)", provider: "Microsoft", status: "planned", priority: 1, gate: "now", pillar: "career", est_hours: 60, url: "https://learn.microsoft.com/credentials/", why: "Proves the Power BI reporting skill in your PMO positioning. Learning path is free; only the exam is paid.", next_step: "Start the free Microsoft Learn path for Power BI; book the exam when income allows.", cost_note: "Free learning path; exam fee applies (check Microsoft Learn)" },
  { kind: "certification", title: "Professional Scrum Product Owner I (PSPO I)", provider: "Scrum.org", status: "idea", priority: 2, gate: "income", pillar: "career", est_hours: 20, url: "https://www.scrum.org", why: "Fast, respected credential for Product Owner roles.", next_step: "Read the free Scrum Guide and take Scrum.org's free open assessments first.", cost_note: "Assessment fee; check scrum.org" },
  { kind: "certification", title: "PgMP (Program Management Professional)", provider: "PMI", status: "idea", priority: 3, gate: "later", pillar: "career", why: "Long-term step towards programme leadership once you have PMP and more programme experience.", next_step: "Revisit after PMP." },
  // Languages
  { kind: "language", title: "Spanish", provider: "Free apps, YouTube, Instituto Cervantes (DELE exam later)", status: "planned", priority: 2, gate: "now", pillar: "career", level_current: "A0", level_target: "B1", est_hours: 400, why: "Supports travel and future relocation options. B1 is a realistic working-conversation goal.", next_step: "15 minutes a day; log minutes here." },
  { kind: "language", title: "Arabic (Gulf / everyday)", provider: "Free apps, community classes", status: "idea", priority: 3, gate: "now", pillar: "relationships", level_current: "A0", level_target: "A2", est_hours: 200, why: "Everyday life in the UAE and goodwill with colleagues.", next_step: "Learn greetings, numbers and workplace phrases first." },
  // Courses and skills (free or low cost first)
  { kind: "course", title: "Power BI fundamentals (Microsoft Learn)", provider: "Microsoft Learn (free)", status: "planned", priority: 1, gate: "now", pillar: "career", est_hours: 15, url: "https://learn.microsoft.com/training/", why: "Foundation for PL-300 and immediately usable in interviews and portfolio.", next_step: "Complete the first module this week." },
  { kind: "course", title: "35 hours of project management education (for PMP)", provider: "Choose a low-cost PMI-recognised option", status: "idea", priority: 2, gate: "now", pillar: "career", est_hours: 35, why: "Required for PMP eligibility and useful for PMO interviews now.", next_step: "Shortlist options and confirm they count towards PMP before paying." },
  { kind: "skill", title: "SQL for analysis", provider: "Free courses", status: "idea", priority: 2, gate: "now", pillar: "career", est_hours: 30, why: "Moves your foundational SQL to confident querying for BA and PMO reporting.", next_step: "Practise on a free interactive SQL course." },
  { kind: "skill", title: "AI tools for product and PMO work", provider: "Free courses and practice", status: "in_progress", priority: 2, gate: "now", pillar: "career", est_hours: 20, why: "Turn hands-on use of AI tools into a documented skill and portfolio piece.", next_step: "Write up one case study from a real project." },
  { kind: "skill", title: "Public speaking (Toastmasters, Dubai)", provider: "Toastmasters clubs", status: "idea", priority: 2, gate: "income", pillar: "discipline", why: "Builds interview confidence and presentation skill; community and friendships too.", next_step: "Visit a club as a guest (usually free) before joining." },
  { kind: "skill", title: "Cook 10 healthy, cheap home meals", provider: "Free recipes", status: "planned", priority: 2, gate: "now", pillar: "health", est_hours: 10, why: "Cuts food delivery spending and supports your fitness goals.", next_step: "Learn 1 new meal per week; note it here." },
  { kind: "course", title: "First aid and CPR", provider: "Red Crescent or accredited providers", status: "idea", priority: 3, gate: "income", pillar: "health", est_hours: 8, why: "A life skill that protects family and friends.", next_step: "Check course dates and fees when finances allow." },
  { kind: "skill", title: "Personal finance and budgeting", provider: "Books in your reading plan + LIFE OS", status: "in_progress", priority: 1, gate: "now", pillar: "finance", why: "Directly supports debt payoff and runway decisions.", next_step: "Complete the Finances baseline in LIFE OS." },
];
export function seedV4(db: Database.Database, insert: Insert) {
  const pillar = (key: string) => (db.prepare(`SELECT id FROM pillars WHERE key = ?`).get(key) as { id: number } | undefined)?.id ?? null;
  for (const l of LEARNING_PLAN) {
    const { pillar: pk, source, ...rest } = l;
    insert(db, "learning_items", { ...rest, status: l.status ?? "idea", hours_logged: 0, pillar_id: pillar(pk), source: source ?? "suggested" });
  }
}

/** v5: move any single daily check-in saved in the journal into the new multi check-in log (nothing is lost). */
export function seedV5(db: Database.Database, insert: Insert) {
  const rows = db.prepare(`SELECT date, energy, win, blocker, reflection, updated_at FROM journal WHERE archived=0 AND (energy IS NOT NULL OR win IS NOT NULL OR blocker IS NOT NULL OR reflection IS NOT NULL)`).all() as Record<string, any>[];
  for (const r of rows) {
    if (!r.energy && !r.win && !r.blocker && !r.reflection) continue;
    insert(db, "check_ins", { date: r.date, time: "21:00", energy: r.energy, win: r.win, blocker: r.blocker, reflection: r.reflection });
  }
}

/** v6: morning habits for Bible reading and meditation (only if not already present). */
export function seedV6(db: Database.Database, insert: Insert) {
  const pid = (db.prepare(`SELECT id FROM pillars WHERE key='discipline'`).get() as { id: number } | undefined)?.id ?? null;
  const has = (n: string) => !!db.prepare(`SELECT 1 FROM habits WHERE name = ?`).get(n);
  const n = (db.prepare(`SELECT COUNT(*) c FROM habits`).get() as { c: number }).c;
  if (!has("Morning Bible reading")) insert(db, "habits", { pillar_id: pid, name: "Morning Bible reading", target_per_week: 6, minimum_version: "Read today's verse", active: true, sort: n });
  if (!has("Meditate")) insert(db, "habits", { pillar_id: pid, name: "Meditate", target_per_week: 5, minimum_version: "3 slow breaths", active: true, sort: n + 1 });
  const set = db.prepare(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)`);
  const ts = new Date().toISOString();
  set.run("bible_plan", "gospels", ts);
  set.run("bible_translation", "web", ts);
}

/** v7: put every milestone into a roadmap stage, and add a PMP milestone to the Grow stage. */
import { TEMPLATE_STAGE, PILLAR_STAGE } from "./stages";
export function seedV7(db: Database.Database, insert: Insert) {
  const career = (db.prepare(`SELECT id FROM pillars WHERE key='career'`).get() as { id: number } | undefined)?.id ?? null;
  if (!db.prepare(`SELECT 1 FROM milestones WHERE title = ?`).get("Earn the PMP certification"))
    insert(db, "milestones", { pillar_id: career, title: "Earn the PMP certification", kind: "conditional", priority: 2, status: "not_started", progress: 0, source: "template", prerequisites: "Stable income; 35 hours of PM education done", next_action: "Use free material in Learning to prepare.", stage: 4 });
  const rows = db.prepare(`SELECT m.id, m.title, m.stage, p.key FROM milestones m LEFT JOIN pillars p ON p.id = m.pillar_id`).all() as { id: number; title: string; stage: number | null; key: string | null }[];
  const upd = db.prepare(`UPDATE milestones SET stage = ? WHERE id = ?`);
  for (const r of rows) if (r.stage == null) upd.run(TEMPLATE_STAGE[r.title] ?? PILLAR_STAGE[r.key ?? ""] ?? 2, r.id);
}
