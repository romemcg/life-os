"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import clsx from "clsx";
import { Card } from "./ui";
import { useSettings } from "@/lib/client";

type Status = { supported: boolean; enabled: boolean; lead: number; today: { id: number; title: string; time: string }[] };
const LEADS = [0, 5, 10, 15];

/** Settings card: desktop reminders before each timed task (macOS, while LIFE OS is running). */
export function ReminderSettings() {
  const { settings, save } = useSettings();
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/notify").then((r) => r.json()).then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); }, []);

  const enabled = settings.notify_enabled !== "0";
  const lead = Number(settings.notify_lead_min ?? 5);
  const set = async (patch: Record<string, string>) => { await save(patch); load(); };
  const test = async () => {
    setMsg("Sending…");
    const r = await fetch("/api/notify", { method: "POST" });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Sent. If nothing appeared, allow notifications for Script Editor in System Settings → Notifications." : b.error || "Could not send.");
  };

  if (st && !st.supported) {
    return (
      <Card title="Task reminders">
        <p className="text-sm muted">Desktop reminders work when LIFE OS runs on your Mac. They are switched off in this hosted version.</p>
      </Card>
    );
  }

  return (
    <Card title="Task reminders" action={
      <button role="switch" aria-checked={enabled} aria-label="Task reminders" onClick={() => set({ notify_enabled: enabled ? "0" : "1" })}
        className={clsx("relative h-6 w-11 rounded-full transition-colors", enabled ? "bg-teal-400" : "bg-ink-600")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} />
      </button>
    }>
      <p className="text-sm text-fog-300">A Mac notification pops up before every task that has a time on your Today timeline. Works with the browser closed, as long as LIFE OS is running.</p>
      <div className={clsx("mt-3 flex flex-wrap items-center gap-2", !enabled && "pointer-events-none opacity-50")}>
        <span className="text-xs font-semibold text-fog-400">Remind me</span>
        {LEADS.map((n) => (
          <button key={n} onClick={() => set({ notify_lead_min: String(n) })}
            className={clsx("rounded-full px-3 py-1 text-xs font-semibold transition-colors", lead === n ? "bg-fog-100 text-ink-900" : "border border-ink-600 text-fog-300 hover:border-teal-400/60")}>
            {n === 0 ? "At start time" : `${n} min before`}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-outline px-3 py-1.5 text-xs" onClick={test} disabled={!enabled}>{enabled ? <Bell size={14} /> : <BellOff size={14} />} Send a test</button>
        {msg && <span className="text-[11px] text-fog-400">{msg}</span>}
      </div>
      {st && enabled && (
        <p className="mt-3 text-[11px] text-fog-500">
          {st.today.length ? `Today: ${st.today.length} timed ${st.today.length === 1 ? "task" : "tasks"} not done yet (${st.today.slice(0, 3).map((t) => `${t.time} ${t.title}`).join(", ")}${st.today.length > 3 ? "…" : ""}).` : "No timed tasks left today. Give a task a time on Today to get a reminder."}
        </p>
      )}
    </Card>
  );
}
