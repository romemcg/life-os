import { addDays, daysInMonth, dow, diffDays } from "./dates";

export interface RecurringLike {
  recurrence?: string | null;
  due_date?: string | null; // for recurring tasks: start date (inclusive)
  created_at?: string | null;
  status?: string | null;
}

export type Rule =
  | { type: "none" }
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; days: number[] }
  | { type: "monthly"; day: number }
  // flexible: any N days in the week. Offered every day until N are done that week.
  | { type: "times"; n: number };

export function parseRule(r?: string | null): Rule {
  if (!r || r === "none") return { type: "none" };
  if (r === "daily") return { type: "daily" };
  if (r === "weekdays") return { type: "weekdays" };
  if (r.startsWith("weekly:")) {
    const days = r
      .slice(7)
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    return days.length ? { type: "weekly", days: Array.from(new Set(days)).sort() } : { type: "none" };
  }
  if (r.startsWith("times:")) {
    const n = Number(r.slice(6));
    return Number.isInteger(n) && n >= 1 && n <= 7 ? (n === 7 ? { type: "daily" } : { type: "times", n }) : { type: "none" };
  }
  if (r.startsWith("monthly:")) {
    const day = Number(r.slice(8));
    return Number.isInteger(day) && day >= 1 && day <= 31 ? { type: "monthly", day } : { type: "none" };
  }
  return { type: "none" };
}

export function isRecurring(t: RecurringLike) {
  return parseRule(t.recurrence).type !== "none";
}

function startOf(t: RecurringLike): string | null {
  return t.due_date || (t.created_at ? t.created_at.slice(0, 10) : null);
}

/** Does a recurring task occur on `date`? (One-off tasks: true only on their due date.) */
export function occursOn(t: RecurringLike, date: string): boolean {
  const rule = parseRule(t.recurrence);
  if (rule.type === "none") return t.due_date === date;
  if (t.status === "dropped") return false;
  const start = startOf(t);
  if (start && date < start) return false;
  const wd = dow(date);
  switch (rule.type) {
    case "daily":
    case "times":
      return true;
    case "weekdays":
      return wd >= 1 && wd <= 5; // UAE work week Mon-Fri
    case "weekly":
      return rule.days.includes(wd);
    case "monthly": {
      const [y, m, d] = date.split("-").map(Number);
      return d === Math.min(rule.day, daysInMonth(y, m));
    }
  }
}

/** Target per week for a flexible rule, else null. */
export function timesPerWeek(t: RecurringLike): number | null {
  const r = parseRule(t.recurrence);
  return r.type === "times" ? r.n : null;
}

/** Number of planned occurrences in [from, to] inclusive. Flexible rules count N per 7 days. */
export function occurrencesBetween(t: RecurringLike, from: string, to: string): number {
  if (diffDays(from, to) < 0) return 0;
  const tw = timesPerWeek(t);
  if (tw != null) {
    let days = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) if (occursOn(t, d)) days++;
    return Math.min(days, Math.round((days / 7) * tw)) || (days ? 1 : 0);
  }
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (occursOn(t, d)) n++;
  return n;
}

export function describeRule(r?: string | null): string {
  const rule = parseRule(r);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (rule.type) {
    case "none":
      return "One-off";
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return rule.days.map((d) => names[d]).join(", ");
    case "monthly":
      return `Monthly on day ${rule.day}`;
    case "times":
      return `${rule.n}× a week`;
  }
}
