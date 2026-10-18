// Demo mode (LIFEOS_DEMO=1): a fictional person, about five weeks into the plan, so every screen has something to show.
// Every name, company, number and note below is invented. Nothing here comes from a real person.
import type Database from "better-sqlite3";
import type { TableName } from "./schema";

type Insert = (db: Database.Database, table: TableName, row: Record<string, unknown>) => number;

const iso = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// Small deterministic generator so the demo looks the same on every machine.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export function seedDemo(db: Database.Database, insert: Insert) {
  const rand = rng(2026);
  const id = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { id: number } | undefined)?.id ?? null;
  const set = db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)`);
  const ts = new Date().toISOString();
  set.run("life_phase", "Secure income", ts);
  set.run("start_date", iso(-25), ts);

  // ---- timeline: the starter plan is dated from today, so move it back 25 days and finish what is already past
  db.prepare(`UPDATE tasks SET due_date = date(due_date, '-25 days') WHERE due_date IS NOT NULL`).run();
  db.prepare(`UPDATE milestones SET target_date = date(target_date, '-25 days') WHERE target_date IS NOT NULL`).run();
  db.prepare(`UPDATE tasks SET status='done', completed_at=due_date WHERE COALESCE(recurrence,'none')='none' AND due_date IS NOT NULL AND due_date < ?`).run(iso(0));
  // keep a few tasks open so the in-progress milestones read as in progress
  const keep: [string, number][] = [["Shortlist 10 roles posted in the last 7 days that fit your tracks", 1], ["Draft 5 networking messages to former colleagues", 2], ["Plan 5 home-cooked meals and a grocery list", 2], ["Set a target wake time and a phone-off time", 0]];
  for (const [title, off] of keep) db.prepare(`UPDATE tasks SET status='open', completed_at=NULL, due_date=? WHERE title=?`).run(iso(off), title);
  const prog = (title: string, progress: number) => db.prepare(`UPDATE milestones SET status='in_progress', progress=? WHERE title=? AND status<>'done'`).run(progress, title);
  prog("Minimum Day completed on 14 of 21 days", 70);
  prog("20 targeted applications and 10 outreach messages", 60);
  prog("12 weeks of 3 workouts per week", 30);

  // ---- career
  const contacts: [string, string, string, string, string, string, number, number | null, string][] = [
    ["Priya Nair", "Talent Partners", "Technical recruiter", "LinkedIn", "Recruiter", "priya.nair@example.com", -3, 4, "Placed two product managers in Dubai last year. Prefers a short update on Fridays."],
    ["Daniel Okoye", "Northwind Analytics", "Senior Product Manager", "Email", "Former colleague", "daniel.okoye@example.com", -9, 6, "Offered to refer me and to review my case study."],
    ["Sara Haddad", "Helio Mobility", "Head of Programme Delivery", "LinkedIn", "Hiring manager", "sara.haddad@example.com", -5, 2, "Screening call went well. Asked about multi-vendor delivery."],
    ["Lucas Meyer", "Orbit Payments", "Product Director", "Event", "Alumni", "lucas.meyer@example.com", -12, null, "Met at a fintech meetup. Final round is with him."],
    ["Mei Tan", "Independent", "Product leadership coach", "Phone/WhatsApp", "Friend", "mei.tan@example.com", -20, 10, "Monthly catch-up. Good at sharpening my interview stories."],
  ];
  const cid: Record<string, number> = {};
  for (const c of contacts) cid[c[0]] = insert(db, "contacts", { name: c[0], company: c[1], role: c[2], channel: c[3], relationship: c[4], email: c[5], last_contact: iso(c[6]), next_followup: c[7] == null ? null : iso(c[7]), notes: c[8] });

  type A = [string, string, string, number | null, string, string | null, string | null, number, number | null, string, string | null];
  const apps: A[] = [
    ["Orbit Payments", "Product Manager, Growth", "final", -18, "Dubai", "AED 38k + allowances", "Lucas Meyer", 5, 2, "Final panel on Thursday", "Prepare the pricing case and two growth stories."],
    ["Northwind Analytics", "Product Manager, Platform", "interview", -12, "Dubai", "AED 34k + allowances", "Daniel Okoye", 4, 3, "Case study round", "Referral from a former colleague."],
    ["Helio Mobility", "Technical Program Manager", "screening", -8, "Abu Dhabi", "AED 36k", "Sara Haddad", 4, 1, "Send thank-you and availability", "Recruiter screen done; hiring manager next."],
    ["Cobalt Cloud", "Senior Business Analyst", "applied", -6, "Remote (GCC)", "AED 28k", null, 3, 4, "Follow up with recruiter", null],
    ["Lumen Health", "Product Owner", "applied", -5, "Dubai", "AED 30k", "Priya Nair", 3, -1, "Follow up (overdue)", "Applied through the recruiter."],
    ["Quartz Energy", "Project Manager", "rejected", -21, "Dubai", null, null, 2, null, "", "Closed: needed 8+ years in oil and gas."],
    ["Kestrel Labs", "Technical Product Manager", "offer", -26, "Dubai", "AED 35k + allowances", null, 4, 3, "Reply to the offer", "Verbal offer. Waiting for the written terms."],
    ["Meridian Logistics", "PMO Lead", "saved", null, "Dubai", null, null, 3, 5, "Tailor CV and apply", "Posted 2 days ago."],
    ["Atlas Retail Tech", "Product Manager", "saved", null, "Dubai", null, null, 3, 6, "Find a referral first", null],
  ];
  const aid: Record<string, number> = {};
  for (const a of apps) {
    aid[a[0]] = insert(db, "applications", {
      company: a[0], position: a[1], stage: a[2], applied_date: a[3] == null ? null : iso(a[3]), location: a[4], compensation: a[5], contact: null,
      contact_id: a[6] ? cid[a[6]] : null, fit: a[7], next_action_due: a[8] == null ? null : iso(a[8]), next_action: a[9], notes: a[10],
      source: a[3] == null ? "Job board" : "LinkedIn", cv_version: a[2] === "saved" ? null : "PM-v2", url: `https://example.com/jobs/${a[0].toLowerCase().replace(/[^a-z]+/g, "-")}`,
    });
  }
  const ints: [string, number, string, boolean, string, string | null][] = [
    ["Orbit Payments", -9, "Recruiter screen", true, "Advanced", "Clear story on growth experiments."],
    ["Orbit Payments", -4, "Hiring manager", true, "Advanced", "Asked about prioritisation under uncertainty."],
    ["Orbit Payments", 2, "Final panel", false, "", "Pricing case plus two stakeholder stories."],
    ["Northwind Analytics", -3, "Hiring manager", true, "Positive", "Strong on platform thinking; probe on data depth."],
    ["Northwind Analytics", 3, "Case study", false, "", null],
    ["Helio Mobility", -4, "Recruiter screen", true, "Advanced", "Multi-vendor delivery was the main topic."],
  ];
  for (const i of ints) insert(db, "interviews", { application_id: aid[i[0]], date: iso(i[1]), round: i[2], prep_done: i[3], outcome: i[4], notes: i[5] });

  // ---- finances (all figures invented)
  const main = insert(db, "accounts", { name: "Main current account", type: "bank", currency: "AED", balance: 29500, as_of: iso(-1), provenance: "actual", accessible: true });
  insert(db, "accounts", { name: "Savings", type: "savings", currency: "AED", balance: 9400, as_of: iso(-1), provenance: "actual", accessible: true });
  insert(db, "accounts", { name: "Cash", type: "cash", currency: "AED", balance: 600, as_of: iso(-1), provenance: "actual", accessible: true });
  const card = insert(db, "debts", { name: "Credit card", type: "credit card", balance: 11400, apr: 29.9, min_payment: 600, due_day: 12, as_of: iso(-1), provenance: "actual", statement_amount: 1450, statement_date: iso(-8), statement_due: iso(4), statement_paid: 600 });
  insert(db, "debts", { name: "Personal loan", type: "personal loan", balance: 8200, apr: 8.5, min_payment: 420, due_day: 25, as_of: iso(-1), provenance: "actual" });
  const cf: [string, string, number, number | null][] = [
    ["Consulting retainer", "income", 12000, 28], ["Rent", "essential", 4800, 1], ["Utilities", "essential", 450, 5], ["Mobile and internet", "essential", 250, 8],
    ["Groceries", "essential", 1500, null], ["Transport", "essential", 450, null], ["Subscriptions", "discretionary", 200, 15], ["Eating out", "discretionary", 500, null],
  ];
  for (const c of cf) insert(db, "cashflows", { name: c[0], kind: c[1], amount: c[2], provenance: "actual", due_day: c[3], active: true });
  insert(db, "obligations", { name: "Residency renewal", amount: 1800, due_date: iso(24), status: "pending", provenance: "actual" });
  insert(db, "obligations", { name: "Annual card fee", amount: 400, due_date: iso(40), status: "pending", provenance: "actual" });
  const cats: [string, number, number, boolean][] = [["Groceries", 40, 140, true], ["Eating out", 35, 110, false], ["Transport", 12, 45, true], ["Food delivery", 30, 70, false], ["Health", 60, 160, true], ["Personal care", 50, 120, false]];
  for (let d = -33; d <= 0; d++) {
    const n = rand() < 0.35 ? 0 : rand() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const [cat, lo, hi, ess] = cats[Math.floor(rand() * cats.length)];
      insert(db, "expenses", { date: iso(d), amount: Math.round(lo + rand() * (hi - lo)), category: cat, essential: ess, method: "debit", account_id: main });
    }
  }
  for (const m of [1, 2, 3, 4]) insert(db, "expenses", { date: iso(-m * 8), amount: 120 + m * 15, category: "Eating out", essential: false, method: "credit", debt_id: card });
  insert(db, "expenses", { date: iso(-28), amount: 4800, category: "Rent", essential: true, method: "debit", account_id: main });
  insert(db, "expenses", { date: iso(0), amount: 4800, category: "Rent", essential: true, method: "debit", account_id: main });
  for (let w = 7; w >= 0; w--) insert(db, "balance_snapshots", { date: iso(-w * 5), cash: 21000 + (7 - w) * 780 + Math.round(rand() * 400), debt: 21800 - (7 - w) * 410 });

  // ---- habits, check-ins, tasks
  const habits = db.prepare(`SELECT id, name, target_per_week FROM habits WHERE archived=0`).all() as { id: number; name: string; target_per_week: number }[];
  for (const h of habits) {
    const p = Math.min(0.92, 0.45 + h.target_per_week / 12);
    for (let d = -34; d <= 0; d++) if (rand() < p) insert(db, "habit_checkins", { habit_id: h.id, date: iso(d), value: 1 });
  }
  const win = ["Sent two tailored applications", "Finished the case study outline", "Walked 40 minutes before work", "Cooked at home all day", "Had a good practice interview with Mei", "Cleared the inbox", "Reviewed spending with no surprises"];
  const block = ["Low energy after a late night", "Waiting on a recruiter reply", "Hard to start the second application", "Too many tabs open", "", "", ""];
  for (let d = -20; d <= 0; d++) {
    insert(db, "check_ins", { date: iso(d), time: "21:00", energy: 2 + Math.floor(rand() * 4), mood: 3 + Math.floor(rand() * 3), win: win[Math.floor(rand() * win.length)], blocker: block[Math.floor(rand() * block.length)] || null });
  }
  const daily = db.prepare(`SELECT id FROM tasks WHERE recurrence IN ('daily','weekdays') AND archived=0`).all() as { id: number }[];
  for (const t of daily) for (let d = -21; d < 0; d++) if (rand() < 0.78) insert(db, "task_completions", { task_id: t.id, date: iso(d), kind: "done" });

  // ---- reading, learning, people, body
  const book = (title: string) => id(`SELECT id FROM books WHERE title=?`, title);
  const b1 = book("Atomic Habits"), b2 = book("The Psychology of Money");
  if (b1) db.prepare(`UPDATE books SET status='finished', pages_total=320, current_page=320, started=?, finished=?, rating=5, takeaways='Environment beats willpower. Make the minimum version tiny.' WHERE id=?`).run(iso(-30), iso(-4), b1);
  if (b2) {
    db.prepare(`UPDATE books SET status='reading', pages_total=256, current_page=96, started=?  WHERE id=?`).run(iso(-3), b2);
    for (let d = -3; d <= 0; d++) insert(db, "reading_log", { book_id: b2, date: iso(d), pages: 20 + Math.floor(rand() * 14), minutes: 25 });
  }
  if (b1) for (let d = -30; d <= -4; d += 2) insert(db, "reading_log", { book_id: b1, date: iso(d), pages: 22 + Math.floor(rand() * 20), minutes: 30 });
  const li = id(`SELECT id FROM learning_items WHERE title LIKE 'Power BI fundamentals%'`);
  if (li) {
    db.prepare(`UPDATE learning_items SET status='in_progress', hours_logged=6.5, start_date=? WHERE id=?`).run(iso(-18), li);
    for (let d = -18; d <= 0; d += 3) insert(db, "learning_log", { item_id: li, date: iso(d), minutes: 40 + Math.floor(rand() * 30) });
  }
  const people: [string, string, number, string, string][] = [
    ["Maya", "family", 7, "Calls on Sundays. Studying for her exams.", "Manila"], ["Jonas", "friend", 14, "Climbing partner. Moving cities next year.", "Dubai"],
    ["Elena", "friend", 21, "Old university friend. Easy to lose touch with.", "Lisbon"], ["Dad", "family", 7, "Likes a short voice note.", "Manila"],
  ];
  for (const [i, p] of people.entries()) {
    const pid = insert(db, "people", { name: p[0], circle: p[1], rhythm_days: p[2], what_matters: p[3], location: p[4], sort: i });
    for (let d = -(p[2] - 2); d >= -30; d -= p[2]) insert(db, "connections", { person_id: pid, date: iso(d), kind: d % 2 ? "call" : "message", feeling: 4 });
  }
  for (let w = 0; w < 6; w++) insert(db, "metrics", { date: iso(-w * 7), kind: "weight", value: 77.4 - (5 - w) * 0.3 + (w === 3 ? 0.2 : 0), unit: "kg" });
  for (let d = -12; d <= 0; d += 2) insert(db, "meditations", { date: iso(d), time: "07:10", minutes: 5 + Math.floor(rand() * 6), kind: "breathing" });
  set.run("demo_seeded", "1", ts);
}
