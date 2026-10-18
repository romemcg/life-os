import { getDb, insertRow, getSettings } from "@/lib/db";
import { json, err } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSLATIONS: Record<string, string> = { web: "World English Bible", kjv: "King James Version" };

// GET /api/bible?ref=John 3:16  (or a chapter like "John 3"). Public-domain text from bible-api.com, cached locally.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = (url.searchParams.get("ref") ?? "").trim().slice(0, 80);
  if (!/^[1-3]?\s?[A-Za-z ]+\s\d+(:\d+(-\d+)?)?$/.test(ref)) return err("Bad reference");
  const db = getDb();
  const tr = (url.searchParams.get("t") || getSettings(db).bible_translation || "web").toLowerCase();
  if (!TRANSLATIONS[tr]) return err("Unknown translation");
  const key = `${tr}|${ref.toLowerCase()}`;
  const hit = db.prepare(`SELECT text, reference, translation FROM text_cache WHERE key = ?`).get(key) as { text: string; reference: string; translation: string } | undefined;
  if (hit) return json({ ...hit, cached: true });
  try {
    const r = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${tr}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return err(r.status === 404 ? "Passage not found" : `Bible service error (${r.status})`, 502);
    const b = (await r.json()) as { reference: string; text?: string; verses?: { verse: number; text: string }[]; translation_name?: string };
    const text = b.verses?.length && b.verses.length > 3
      ? b.verses.map((v) => `${v.verse} ${v.text.trim()}`).join(" ")
      : (b.text ?? "").replace(/\s+/g, " ").trim();
    const out = { text, reference: b.reference, translation: b.translation_name ?? TRANSLATIONS[tr] };
    insertRow(db, "text_cache", { key, ...out });
    return json(out);
  } catch {
    return err("Couldn't reach the Bible text service. You're probably offline; the reference is shown so you can read it in your own Bible.", 502);
  }
}
