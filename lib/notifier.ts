// Desktop notifications for timed tasks. Runs inside the LIFE OS server process (see instrumentation.ts),
// so it works whenever the app is running, even with the browser closed. macOS only (uses osascript);
// on any other platform, or on a hosted demo, it does nothing.
import { execFile } from "node:child_process";
import { getDb, getSettings } from "./db";
import { occursOn } from "./recurrence";
import { DEFAULT_TZ } from "./dates";

type TaskRow = { id: number; title: string; scheduled_time: string; duration_min: number | null; recurrence: string | null; due_date: string | null; created_at: string | null; status: string | null };

const TICK_MS = 30_000;
const WINDOW_MIN = 3; // fire if we are within 3 minutes after the target (covers sleep/wake and slow ticks)

export const notifySupported = () => process.platform === "darwin" && !process.env.VERCEL && process.env.LIFEOS_DEMO !== "1";

/** Show a native macOS notification. Text is passed as argv, never interpolated into the script. */
export function sendNotification(title: string, body: string, subtitle = ""): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!notifySupported()) return reject(new Error("Desktop notifications are only available when LIFE OS runs on a Mac."));
    const script = [
      "on run argv",
      'display notification (item 2 of argv) with title (item 1 of argv) subtitle (item 3 of argv) sound name "Glass"',
      "end run",
    ];
    execFile("osascript", [...script.flatMap((l) => ["-e", l]), title, body, subtitle], { timeout: 10_000 }, (e) => (e ? reject(e) : resolve()));
  });
}

function localNow(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: Number(g("hour")) * 60 + Number(g("minute")) };
}
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const to12 = (hhmm: string) => { const m = toMin(hhmm); const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

const sent = new Set<string>();

/** Tasks that occur today, have a time, and are not done or skipped. Exported for tests and the status endpoint. */
export function dueToday(date: string): TaskRow[] {
  const db = getDb();
  const rows = db.prepare(`SELECT id, title, scheduled_time, duration_min, recurrence, due_date, created_at, status FROM tasks WHERE archived = 0 AND scheduled_time IS NOT NULL AND scheduled_time != ''`).all() as TaskRow[];
  const closed = new Set((db.prepare(`SELECT task_id FROM task_completions WHERE archived = 0 AND date = ?`).all(date) as { task_id: number }[]).map((r) => r.task_id));
  return rows.filter((t) => occursOn(t, date) && !closed.has(t.id) && (t.recurrence && t.recurrence !== "none" ? true : (t.status ?? "open") === "open"));
}

export function tick() {
  const s = getSettings(getDb());
  if (s.notify_enabled === "0") return;
  const lead = Math.max(0, Math.min(60, Number(s.notify_lead_min ?? 5) || 0));
  const { date, minutes } = localNow(s.timezone || DEFAULT_TZ);
  for (const t of dueToday(date)) {
    const target = toMin(t.scheduled_time) - lead;
    const key = `${date}|${t.id}|${t.scheduled_time}|${lead}`;
    if (minutes < target || minutes >= target + WINDOW_MIN || sent.has(key)) continue;
    sent.add(key);
    const when = lead === 0 ? "Starting now" : `In ${lead} min, at ${to12(t.scheduled_time)}`;
    const dur = t.duration_min ? ` · ${t.duration_min} min` : "";
    sendNotification("LIFE OS", t.title, `${when}${dur}`).catch(() => {});
  }
  if (sent.size > 500) sent.clear();
}

export function startNotifier() {
  const g = globalThis as unknown as { __lifeosNotifier?: NodeJS.Timeout };
  if (g.__lifeosNotifier || !notifySupported()) return;
  const run = () => { try { tick(); } catch { /* never crash the server over a reminder */ } };
  g.__lifeosNotifier = setInterval(run, TICK_MS);
  g.__lifeosNotifier.unref?.();
  setTimeout(run, 5_000);
}
