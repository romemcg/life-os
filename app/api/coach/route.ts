import { getDb, insertRow, getSettings, fromDb } from "@/lib/db";
import { apiKey, buildContext, SYSTEM, TOOLS, runTool, COACH_MODELS } from "@/lib/coach";
import { json, err } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM chat_messages WHERE archived=0 ORDER BY id DESC LIMIT 60`).all() as Record<string, unknown>[];
  const key = apiKey(db);
  return json({
    configured: !!key,
    keySource: process.env.ANTHROPIC_API_KEY ? "env" : key ? "settings" : null,
    keyHint: key ? `…${key.slice(-4)}` : null,
    model: getSettings(db).coach_model || COACH_MODELS[0].id,
    models: COACH_MODELS,
    messages: rows.reverse().map((r) => fromDb("chat_messages", r)),
  });
}

export async function DELETE() {
  getDb().prepare(`DELETE FROM chat_messages`).run();
  return json({ ok: true });
}

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

export async function POST(req: Request) {
  const db = getDb();
  const key = apiKey(db);
  if (!key) return err("Coach is not set up yet. Add your Anthropic API key in Settings → Coach.", 503);
  let message = "";
  try {
    message = String((await req.json())?.message ?? "").trim().slice(0, 4000);
  } catch {}
  if (!message) return err("Empty message");

  insertRow(db, "chat_messages", { role: "user", content: message });
  const history = (db.prepare(`SELECT role, content FROM chat_messages WHERE archived=0 ORDER BY id DESC LIMIT 16`).all() as { role: string; content: string }[]).reverse();
  // the API requires the first message to be from the user
  while (history.length && history[0].role !== "user") history.shift();

  const model = getSettings(db).coach_model || COACH_MODELS[0].id;
  const system = `${SYSTEM}\n\nLIFE OS SNAPSHOT (live data, as recorded by the user):\n${buildContext(db)}`;
  const messages: { role: string; content: unknown }[] = history.map((m) => ({ role: m.role, content: m.content }));
  const actions: { ok: boolean; summary: string }[] = [];
  let reply = "";

  try {
    for (let step = 0; step < 4; step++) {
      const r = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1024, system, tools: TOOLS, messages }),
      });
      const body = await r.json();
      if (!r.ok) {
        const msg = body?.error?.message || `API error ${r.status}`;
        return err(r.status === 401 ? "The API key was rejected. Check it in Settings → Coach." : msg, 502);
      }
      const content = body.content as Block[];
      reply += content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const uses = content.filter((b) => b.type === "tool_use");
      if (body.stop_reason !== "tool_use" || !uses.length) break;
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: uses.map((u) => {
          const res = runTool(db, u.name!, u.input ?? {});
          actions.push(res);
          return { type: "tool_result", tool_use_id: u.id, content: res.summary, is_error: !res.ok };
        }),
      });
      if (reply) reply += "\n\n";
    }
  } catch (e) {
    return err(`Couldn't reach the Coach service (${(e as Error).message}). Check your internet connection.`, 502);
  }

  reply = reply.trim() || (actions.length ? "Done." : "Sorry, I didn't get a reply. Try again.");
  insertRow(db, "chat_messages", { role: "assistant", content: reply, meta: actions.length ? { actions } : null });
  return json({ reply, actions });
}
