import { getDb, getSettings, now } from "@/lib/db";
import { json, err } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["birth_date", "start_date", "timezone", "currency", "life_phase", "day_mode", "weekly_app_target", "weekly_outreach_target", "wake_time", "display_name", "ef_months", "cash_buffer", "rel_values", "rel_boundaries", "rel_partner", "coach_model", "bible_plan", "bible_translation", "meditation_default"]);

export async function GET() {
  const s = getSettings(getDb());
  delete s.seeded;
  delete s.anthropic_api_key;
  return json(s);
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const db = getDb();
    const stmt = db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)`);
    db.transaction(() => {
      for (const [k, v] of Object.entries(body)) {
        if (!ALLOWED.has(k)) throw new Error(`Unknown setting ${k}`);
        stmt.run(k, v == null ? "" : String(v).slice(0, 500), now());
      }
    })();
    return GET();
  } catch (e) {
    return err(e);
  }
}
