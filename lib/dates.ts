// Date helpers on plain 'YYYY-MM-DD' strings (calendar dates, no time-zone drift).

export const DEFAULT_TZ = "Asia/Dubai";

export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function toUTC(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;
}

export function addDays(iso: string, n: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function diffDays(a: string, b: string): number {
  // b - a in days
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function dow(iso: string): number {
  return toUTC(iso).getUTCDay(); // 0 = Sunday
}

export function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/** Age in completed years on a given date, using the full birth date (not birth year alone). */
export function ageOn(birth: string, on: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Monday-start week. Returns [monday, sunday]. */
export function weekRange(iso: string): [string, string] {
  const offset = (dow(iso) + 6) % 7; // Mon=0 .. Sun=6
  const mon = addDays(iso, -offset);
  return [mon, addDays(mon, 6)];
}

export function monthRange(iso: string): [string, string] {
  const [y, m] = iso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  return [start, `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth(y, m)).padStart(2, "0")}`];
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDate(iso?: string | null, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!iso) return "No date";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const base = `${d} ${MONTHS[m - 1]}${opts.year === false ? "" : " " + y}`;
  return opts.weekday ? `${DAYS[dow(iso)]}, ${base}` : base;
}

export function fmtMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function relativeDay(iso: string, today: string): string {
  const n = diffDays(today, iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days overdue`;
  if (n < 7) return `In ${n} days`;
  return fmtDate(iso);
}

/** Past-tense relative label: "today", "yesterday", "5 days ago", then a date. */
export function agoDay(iso: string, today: string): string {
  const n = diffDays(iso, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 30) return `${n} days ago`;
  return `on ${fmtDate(iso)}`;
}
