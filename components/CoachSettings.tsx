"use client";
import { useEffect, useState } from "react";
import { Card } from "./ui";
import { api } from "@/lib/client";

export function CoachSettings({ toast }: { toast: (s: string, t?: "ok" | "err") => void }) {
  const [st, setSt] = useState<{ configured: boolean; keySource: string | null; keyHint: string | null; model: string; models: { id: string; label: string }[] } | null>(null);
  const [key, setKey] = useState("");
  const load = () => fetch("/api/coach", { cache: "no-store" }).then((r) => r.json()).then(setSt);
  useEffect(() => { load(); }, []);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/coach/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const b = await r.json();
    if (!r.ok) return toast(b.error, "err");
    setKey("");
    toast("Coach key saved");
    load();
  }
  async function removeKey() {
    if (!confirm("Remove the saved API key? The Coach will stop working until you add one again.")) return;
    await fetch("/api/coach/key", { method: "DELETE" });
    load();
  }

  return (
    <div id="coach">
      <Card title="Coach (AI chat)">
        {!st ? <p className="text-sm muted">Loading…</p> : (
          <div className="space-y-3 text-sm">
            <p className="text-fog-300">
              {st.configured ? <>Connected <span className="muted">({st.keySource === "env" ? "from ANTHROPIC_API_KEY" : `key ${st.keyHint}`})</span>.</> : "Not set up."}{" "}
              The Coach uses your own Anthropic API key (pay-as-you-go, separate from a Claude subscription). Create one at console.anthropic.com. You can set a monthly spend limit there.
            </p>
            {st.keySource !== "env" && (
              <form onSubmit={saveKey} className="flex gap-2">
                <input type="password" autoComplete="off" className="input" placeholder={st.configured ? "Replace key (sk-ant-…)" : "Paste API key (sk-ant-…)"} value={key} onChange={(e) => setKey(e.target.value)} aria-label="Anthropic API key" />
                <button className="btn-primary" disabled={!key}>Save</button>
              </form>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs muted" htmlFor="coach-model">Model</label>
              <select id="coach-model" className="input w-auto" value={st.model} onChange={async (e) => { await api.saveSettings({ coach_model: e.target.value }); load(); }}>
                {st.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              {st.configured && st.keySource === "settings" && <button className="btn-danger ml-auto text-xs" onClick={removeKey}>Remove key</button>}
            </div>
            <p className="text-[11px] text-fog-500">The key is stored only in this Mac&apos;s LIFE OS database. It is never shown in the browser or included in backups. Each message sends your question and a short summary of your LIFE OS data to Anthropic.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
