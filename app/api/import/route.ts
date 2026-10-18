import { getDb, now } from "@/lib/db";
import { TABLES, isTable } from "@/lib/schema";
import { json, err } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Replaces ALL data with the contents of a LIFE OS export file. Runs in one transaction.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body?.app !== "life-os" || typeof body.data !== "object") throw new Error("Not a LIFE OS export file");
    const db = getDb();
    db.transaction(() => {
      for (const t of Object.keys(TABLES)) db.prepare(`DELETE FROM ${t}`).run();
      // keep the API key and other secrets; replace everything else
      for (const [t, rows] of Object.entries(body.data as Record<string, Record<string, unknown>[]>)) {
        if (!isTable(t) || !Array.isArray(rows)) continue;
        const allowed = new Set(["id", "created_at", "updated_at", "archived", ...Object.keys(TABLES[t].columns)]);
        for (const r of rows) {
          const keys = Object.keys(r).filter((k) => allowed.has(k));
          if (!keys.includes("created_at")) { keys.push("created_at"); r.created_at = now(); }
          if (!keys.includes("updated_at")) { keys.push("updated_at"); r.updated_at = now(); }
          db.prepare(`INSERT INTO ${t} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((k) => r[k] as never));
        }
      }
      const set = db.prepare(`INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)`);
      for (const [k, v] of Object.entries((body.settings ?? {}) as Record<string, string>)) if (k !== "anthropic_api_key") set.run(k, String(v), now());
      set.run("seeded", "1", now());
    })();
    return json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
