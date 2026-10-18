import { getDb, now } from "@/lib/db";
import { json, err } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stores the key in the local database only. It is never returned to the browser or included in exports.
export async function POST(req: Request) {
  const key = String((await req.json().catch(() => ({})))?.key ?? "").trim();
  if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) return err("That doesn't look like an Anthropic API key (it starts with sk-ant-).");
  getDb().prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('anthropic_api_key',?,?)`).run(key, now());
  return json({ ok: true, keyHint: `…${key.slice(-4)}` });
}

export async function DELETE() {
  getDb().prepare(`DELETE FROM settings WHERE key='anthropic_api_key'`).run();
  return json({ ok: true });
}
