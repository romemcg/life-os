import { getDb, getSettings } from "@/lib/db";
import { json, err } from "@/lib/server";
import { dueToday, notifySupported, sendNotification } from "@/lib/notifier";
import { todayIn, DEFAULT_TZ } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status: whether reminders can run here and which timed tasks are still ahead today. */
export async function GET() {
  try {
    const s = getSettings(getDb());
    const today = todayIn(s.timezone || DEFAULT_TZ);
    return json({ supported: notifySupported(), enabled: s.notify_enabled !== "0", lead: Number(s.notify_lead_min ?? 5), today: dueToday(today).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)).map((t) => ({ id: t.id, title: t.title, time: t.scheduled_time })) });
  } catch (e) {
    return err(e);
  }
}

/** Send a test notification so the user can allow it in macOS settings. */
export async function POST() {
  try {
    await sendNotification("LIFE OS", "Reminders are working. You'll get one before each timed task.", "Test notification");
    return json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
