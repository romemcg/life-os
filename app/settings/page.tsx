"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Upload, Plus, Pencil } from "lucide-react";
import { PageHeader, Card, PillarDot, useToast } from "@/components/ui";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { RecordForm } from "@/components/RecordForm";
import { PILLAR_FIELDS } from "@/components/shared";
import { ageOn, isISODate } from "@/lib/dates";
import { ThemeToggle } from "@/components/ThemeToggle";

const FIELDS: { key: string; label: string; type?: string; help?: string }[] = [
  { key: "display_name", label: "Name" },
  { key: "birth_date", label: "Date of birth", type: "date", help: "Ages everywhere are calculated from this full date." },
  { key: "start_date", label: "Plan start date", type: "date", help: "Day 1 of the 90-day plan." },
  { key: "timezone", label: "Time zone", help: "IANA name, e.g. Asia/Dubai" },
  { key: "currency", label: "Base currency", help: "Accounts in other currencies are excluded from totals (no conversion)." },
  { key: "life_phase", label: "Current life phase" },
  { key: "wake_time", label: "Target wake time", type: "time" },
  { key: "weekly_app_target", label: "Weekly application target", type: "number" },
  { key: "weekly_outreach_target", label: "Weekly outreach target", type: "number" },
  { key: "cash_buffer", label: "Default cash buffer for scenarios", type: "number" },
];

export default function SettingsPage() {
  const { settings, ready, save } = useSettings();
  const today = useToday(settings.timezone);
  const pillars = useList("pillars");
  const [pillarEdit, setPillarEdit] = useState<Partial<Row> | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const { toast, node } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ready) setV(settings); }, [ready, settings]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isISODate(v.birth_date) || !isISODate(v.start_date)) return toast("Dates must be valid", "err");
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone });
    } catch {
      return toast("Unknown time zone", "err");
    }
    const out: Record<string, string> = {};
    for (const f of FIELDS) out[f.key] = v[f.key] ?? "";
    await save(out);
    toast("Settings saved");
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("Importing REPLACES all current data with the backup. Export first if unsure. Continue?")) return;
    try {
      const text = await file.text();
      const r = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      toast("Backup restored. Reloading…");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle={ready ? `Age today: ${ageOn(settings.birth_date, today)}` : " "} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile & planning">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.key === "life_phase" ? "sm:col-span-2" : ""}>
                <label className="label" htmlFor={`s-${f.key}`}>{f.label}</label>
                <input id={`s-${f.key}`} className="input" type={f.type ?? "text"} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                {f.help && <p className="mt-1 text-[11px] text-fog-500">{f.help}</p>}
              </div>
            ))}
            <div className="flex justify-end sm:col-span-2"><button className="btn-primary">Save</button></div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Appearance">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm muted">Light, dark, or follow your Mac&apos;s setting. Saved on this device.</p>
              <ThemeToggle />
            </div>
          </Card>
          <Card title="Life areas (pillars)" action={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPillarEdit({ color: "#4fb8ab", stage_weight: 0.5, sort: pillars.rows.length })}><Plus size={14} /> Add</button>}>
            <p className="mb-3 text-xs muted">Rename, recolour or describe an area with the pencil. The slider sets how much it pulls on your day right now; changes apply immediately to Today.</p>
            <ul className="space-y-2.5">
              {pillars.rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <PillarDot color={p.color} />
                  <span className="w-40 shrink-0 truncate" title={p.vision ?? undefined}>{p.name}</span>
                  <input type="range" min={0} max={1} step={0.1} className="flex-1" value={p.stage_weight ?? 0.5} aria-label={`${p.name} weight`} onChange={(e) => api.update("pillars", p.id, { stage_weight: Number(e.target.value) })} />
                  <span className="w-8 text-right text-xs tabnum muted">{Number(p.stage_weight ?? 0.5).toFixed(1)}</span>
                  <button className="btn-ghost p-1" aria-label={`Edit ${p.name}`} onClick={() => setPillarEdit(p)}><Pencil size={14} /></button>
                </li>
              ))}
            </ul>
          </Card>
          <RecordForm table="pillars" open={!!pillarEdit} onClose={() => setPillarEdit(null)} title={pillarEdit?.id ? "Edit life area" : "New life area"} initial={pillarEdit} fields={PILLAR_FIELDS} allowDelete={false} allowArchive />

          <Card title="Backup & data">
            <p className="text-sm text-fog-300">Everything lives in one SQLite file on this computer (default <code className="rounded bg-ink-800 px-1 text-xs">data/life-os.db</code>). Nothing is sent anywhere.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn-outline" href="/api/export"><Download size={15} /> Export JSON backup</a>
              <button className="btn-outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> Restore from backup</button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
            </div>
            <p className="mt-2 text-[11px] text-fog-500">Export weekly and keep a copy somewhere safe (encrypted drive or password-protected archive): it contains your financial data.</p>
          </Card>
        </div>
      </div>
      {node}
    </div>
  );
}
