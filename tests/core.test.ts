import { describe, it, expect } from "vitest";
import { ageOn, addMonths, weekRange, todayIn, isISODate, addDays, diffDays } from "@/lib/dates";
import { occursOn, occurrencesBetween, parseRule } from "@/lib/recurrence";
import { summarize, simulate, compareStrategies, emergencyFundTarget, monthsToTarget, totalCostOfOwnership } from "@/lib/finance";
import { planDay, candidatesFor, scoreTask, type TaskLike } from "@/lib/priority";

describe("dates", () => {
  it("age uses the full birth date", () => {
    expect(ageOn("1997-03-14", "2026-10-15")).toBe(29);
    expect(ageOn("1997-03-14", "2027-03-13")).toBe(29);
    expect(ageOn("1997-03-14", "2027-03-14")).toBe(30);
    expect(ageOn("1997-03-14", "2035-12-31")).toBe(38);
    expect(ageOn("2000-02-29", "2001-02-28")).toBe(0);
    expect(ageOn("2000-02-29", "2001-03-01")).toBe(1);
  });
  it("month arithmetic clamps to month end", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
    expect(addMonths("2026-10-01", -10)).toBe("2025-12-01");
  });
  it("weeks start Monday", () => {
    expect(weekRange("2026-10-15")).toEqual(["2026-10-12", "2026-10-18"]); // Thu
    expect(weekRange("2026-10-18")).toEqual(["2026-10-12", "2026-10-18"]); // Sun
  });
  it("today in Dubai crosses midnight correctly", () => {
    expect(todayIn("Asia/Dubai", new Date("2026-10-15T21:30:00Z"))).toBe("2026-10-16");
    expect(todayIn("Asia/Dubai", new Date("2026-10-15T19:30:00Z"))).toBe("2026-10-15");
  });
  it("validates ISO dates", () => {
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(diffDays("2026-10-15", addDays("2026-10-15", 90))).toBe(90);
  });
});

describe("recurrence", () => {
  const start = "2026-10-15";
  it("weekdays skip Sat/Sun", () => {
    const t = { recurrence: "weekdays", due_date: start };
    expect(occursOn(t, "2026-10-16")).toBe(true); // Fri
    expect(occursOn(t, "2026-10-17")).toBe(false); // Sat
    expect(occursOn(t, "2026-10-14")).toBe(false); // before start
    expect(occurrencesBetween(t, "2026-10-12", "2026-10-18")).toBe(2); // Thu, Fri
  });
  it("weekly days and monthly clamp", () => {
    expect(occursOn({ recurrence: "weekly:0", due_date: start }, "2026-10-18")).toBe(true);
    expect(occursOn({ recurrence: "monthly:31", due_date: start }, "2026-11-30")).toBe(true);
    expect(occursOn({ recurrence: "monthly:31", due_date: start }, "2027-02-28")).toBe(true);
    expect(parseRule("weekly:9").type).toBe("none");
  });
  it("one-off occurs only on due date", () => {
    expect(occursOn({ recurrence: "none", due_date: start }, start)).toBe(true);
    expect(occursOn({ recurrence: "none", due_date: start }, "2026-10-16")).toBe(false);
  });
});

describe("finance", () => {
  it("summarizes without inventing values and flags gaps", () => {
    const s = summarize(
      [{ name: "Bank", balance: 10000 }, { name: "PHP", balance: 5000, currency: "PHP" }],
      [{ name: "Card", balance: 20000, apr: null, min_payment: 1000 }],
      [{ name: "Rent", kind: "essential", amount: 2500 }, { name: "Food", kind: "discretionary", amount: 500 }]
    );
    expect(s.cashTotal).toBe(10000);
    expect(s.netMonthly).toBe(-4000);
    expect(s.simpleRunwayMonths).toBe(2.5);
    expect(s.debtToIncome).toBeNull();
    expect(s.warnings.join(" ")).toMatch(/interest rate missing/);
    expect(s.warnings.join(" ")).toMatch(/not in AED/);
  });

  it("runway: cash runs out in the right month, lump sums included", () => {
    const r = simulate({ start: "2026-10-15", months: 12, cash: 10000, debts: [], incomeNow: 0, essential: 3000, discretionary: 0, strategy: "minimum",
      obligations: [{ name: "Visa", amount: 2000, due_date: "2026-11-20" }] });
    // Oct: 7000, Nov: 2000, Dec: -1000
    expect(r.rows[1].cash).toBe(2000);
    expect(r.runOutMonth).toBe("2026-12-01");
  });

  it("job scenario: salary starts the month after start month", () => {
    const r = simulate({ start: "2026-10-01", months: 4, cash: 1000, debts: [], incomeNow: 0, essential: 0, discretionary: 0, strategy: "minimum",
      job: { startDate: "2026-11-10", netSalary: 15000 } });
    expect(r.rows.map((x) => x.income)).toEqual([0, 0, 15000, 15000]);
  });

  it("amortization matches closed-form interest for a single debt", () => {
    const r = simulate({ start: "2027-01-01", months: 120, cash: 1e9, debts: [{ name: "Card", balance: 10000, apr: 12, min_payment: 500 }], incomeNow: 0, essential: 0, discretionary: 0, strategy: "minimum" });
    // n = -ln(1 - rB/P)/ln(1+r) = 22.43 -> final (23rd) payment in month index 22
    expect(r.debtFreeMonth).toBe(addMonths("2027-01-01", 22));
    // closed form: 22.43 x 500 - 10000 = ~1215
    expect(r.totalInterest).toBeGreaterThan(1200);
    expect(r.totalInterest).toBeLessThan(1230);
  });

  it("avalanche never pays more interest than snowball", () => {
    const base = { start: "2027-01-01", months: 120, cash: 100000, incomeNow: 0, essential: 0, discretionary: 0, extraPayment: 1000, cashBuffer: 0,
      debts: [{ name: "Low-rate big", balance: 8000, apr: 10, min_payment: 200 }, { name: "High-rate small", balance: 3000, apr: 36, min_payment: 100 }, { name: "Mid", balance: 5000, apr: 24, min_payment: 150 }] };
    const c = compareStrategies(base);
    expect(c.avalanche.totalInterest).toBeLessThanOrEqual(c.snowball.totalInterest);
    expect(c.minimum.totalInterest).toBeGreaterThan(c.avalanche.totalInterest);
    expect(c.snowball.payoffs[0].name).toBe("High-rate small"); // smallest balance first
    expect(c.avalanche.debtFreeMonth! <= c.minimum.debtFreeMonth!).toBe(true);
  });

  it("extra payments respect the cash buffer", () => {
    const r = simulate({ start: "2027-01-01", months: 1, cash: 3000, debts: [{ name: "Card", balance: 10000, apr: 0, min_payment: 500 }], incomeNow: 0, essential: 0, discretionary: 0, strategy: "avalanche", extraPayment: 5000, cashBuffer: 2000 });
    expect(r.rows[0].cash).toBe(2000);
    expect(r.rows[0].debt).toBe(9000);
  });

  it("warns when minimum does not cover interest", () => {
    const r = simulate({ start: "2027-01-01", months: 2, cash: 0, debts: [{ name: "Card", balance: 30000, apr: 40, min_payment: 900 }], incomeNow: 0, essential: 0, discretionary: 0, strategy: "minimum" });
    expect(r.warnings[0]).toMatch(/does not cover/);
  });

  it("cannot pay minimums from money that doesn't exist", () => {
    const r = simulate({ start: "2027-01-01", months: 3, cash: 500, debts: [{ name: "Card", balance: 5000, apr: 0, min_payment: 400 }], incomeNow: 0, essential: 0, discretionary: 0, strategy: "minimum" });
    expect(r.rows.map((x) => x.debt)).toEqual([4600, 4500, 4500]);
    expect(r.missedFrom).toBe("2027-02-01");
    expect(r.debtFreeMonth).toBeNull();
    expect(r.rows[2].cash).toBe(0);
  });

  it("targets and TCO", () => {
    expect(emergencyFundTarget(3, 4000, 1000)).toBe(15000);
    expect(monthsToTarget(1000, 15000, 2000)).toBe(7);
    expect(monthsToTarget(0, 100, 0)).toBeNull();
    const t = totalCostOfOwnership({ price: 60000, downPayment: 60000, apr: 0, termMonths: 1, annualRunning: 6000, years: 5, resalePct: 40 });
    expect(t.total).toBe(60000 + 30000 - 24000);
  });
});

describe("priority + planner", () => {
  const today = "2026-10-15";
  const w = () => 0.5;
  const mk = (o: Partial<TaskLike> & { id: number }): TaskLike => ({ title: `t${o.id}`, status: "open", recurrence: "none", duration_min: 30, priority: 2, ...o });
  const tasks: TaskLike[] = [
    mk({ id: 1, due_date: "2026-10-10", priority: 1, essential: true }),
    mk({ id: 2, due_date: today, essential: true }),
    mk({ id: 3, due_date: "2026-11-01" }),
    mk({ id: 4, recurrence: "weekdays", due_date: "2026-10-01", duration_min: 90, deep: true, priority: 1 }),
    mk({ id: 5, due_date: today, priority: 3 }),
    mk({ id: 6, due_date: today }),
    mk({ id: 7, due_date: today, essential: true, duration_min: 10 }),
    mk({ id: 8, due_date: today, deep: true, duration_min: 90 }),
    mk({ id: 9 }), // undated: never auto-planned
  ];

  it("candidates exclude future and completed recurring", () => {
    const c = candidatesFor(tasks, today, new Set([4]));
    expect(c.map((t) => t.id).sort()).toEqual([1, 2, 5, 6, 7, 8, 9]);
  });

  it("minimum day: essentials only, max 3, max 60 min", () => {
    const p = planDay(candidatesFor(tasks, today, new Set()), { today, pillarWeight: w, mode: "minimum" });
    expect(p.planned.length).toBeLessThanOrEqual(3);
    expect(p.minutes).toBeLessThanOrEqual(60);
    expect(p.planned.every((s) => s.task.essential)).toBe(true);
  });

  it("standard day never overloads and caps deep work", () => {
    const p = planDay(candidatesFor(tasks, today, new Set()), { today, pillarWeight: w, mode: "standard" });
    expect(p.planned.length).toBeLessThanOrEqual(5);
    expect(p.minutes).toBeLessThanOrEqual(240);
    expect(p.planned.filter((s) => s.task.deep).length).toBeLessThanOrEqual(1);
    expect(p.planned.some((s) => s.task.id === 9)).toBe(false);
    expect(p.planned.length + p.later.length).toBe(8);
  });

  it("overdue P1 outranks a future P3 and explains why", () => {
    const a = scoreTask(tasks[0], { today, pillarWeight: w, mode: "standard" });
    const b = scoreTask(tasks[4], { today, pillarWeight: w, mode: "standard" });
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.reasons.join(" ")).toMatch(/Overdue 5d/);
  });
});

import { BOOKS, getPlan, label, verseRefFor, VERSE_REFS } from "@/lib/bible";
describe("bible plans", () => {
  it("has 66 books and 1,189 chapters (929 OT + 260 NT)", () => {
    expect(BOOKS.length).toBe(66);
    const total = BOOKS.reduce((s, b) => s + b[1], 0);
    expect(total).toBe(1189);
    expect(BOOKS.slice(39).reduce((s, b) => s + b[1], 0)).toBe(260);
  });
  it("plans cover every chapter exactly once", () => {
    expect(getPlan("gospels").days.length).toBe(89);
    expect(getPlan("nt").days.length).toBe(260);
    expect(getPlan("wisdom").days.length).toBe(181);
    const y = getPlan("year");
    expect(y.days.length).toBe(365);
    expect(y.days.flat().length).toBe(1189);
  });
  it("labels ranges", () => {
    expect(label([{ book: "John", ch: 3 }, { book: "John", ch: 4 }])).toBe("John 3–4");
    expect(label([{ book: "Genesis", ch: 50 }, { book: "Exodus", ch: 1 }])).toBe("Genesis 50; Exodus 1");
    expect(VERSE_REFS).toContain(verseRefFor("2026-10-15"));
  });
});

import { project, firstMonthReaching } from "@/lib/stages";
describe("roadmap projection", () => {
  it("consistent effort climbs, drifting declines", () => {
    const c = project(0.5, 1, 60), d = project(0.5, 0.3, 60);
    expect(c[59]).toBeGreaterThan(c[0]);
    expect(d[59]).toBeLessThan(d[2]);
    expect(firstMonthReaching(c, 2)).not.toBeNull();
    expect(firstMonthReaching(d, 2)).toBeNull();
    expect(Math.max(...c)).toBeLessThanOrEqual(6);
    expect(Math.min(...d)).toBeGreaterThanOrEqual(0);
  });
});
