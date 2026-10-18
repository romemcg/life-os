import { getDb, getSettings } from "@/lib/db";
import { TABLES } from "@/lib/schema";
import { todayIn } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const data: Record<string, unknown[]> = {};
  for (const t of Object.keys(TABLES)) data[t] = db.prepare(`SELECT * FROM ${t} ORDER BY id`).all();
  const settings = getSettings(db);
  delete settings.anthropic_api_key; // secrets never leave the machine in backups
  const body = JSON.stringify({ app: "life-os", version: 1, exported_at: new Date().toISOString(), settings, data }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="life-os-backup-${todayIn(settings.timezone || "Asia/Dubai")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
