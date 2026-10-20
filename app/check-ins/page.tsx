"use client";
import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Search, CalendarCheck, MessageCircleHeart } from "lucide-react";
import { PageHeader, Card, Empty, Segmented } from "@/components/ui";
import { CheckInForm, CheckInItem, MOOD, ENERGY, Bars, feeling } from "@/components/CheckIns";
import { useSettings, useToday, useList } from "@/lib/client";
import { addDays, fmtDate, eachDay } from "@/lib/dates";

export default function CheckInsPage() {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [q, setQ] = useState("");
  const from = range === "all" ? "0000-01-01" : addDays(today, -(Number(range) - 1));
  const { rows, loading } = useList("check_ins", { from, to: today });

  const filtered = rows.filter((c) => !q || [c.win, c.blocker, c.reflection, c.gratitude, ...((c.tags as string[]) ?? [])].join(" ").toLowerCase().includes(q.toLowerCase()));
  const byDay = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const c of filtered) m.set(c.date, [...(m.get(c.date) ?? []), c]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const avg = (k: "energy" | "mood") => {
    const v = rows.map((r) => r[k]).filter((x) => x != null) as number[];
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const mAvg = avg("mood");
  const eAvg = avg("energy");
  const chart = useMemo(() => {
    const days = range === "all" ? [...new Set(rows.map((r) => r.date))].sort() : eachDay(from, today);
    return days.map((d) => {
      const r = rows.filter((x) => x.date === d);
      const mean = (k: "energy" | "mood") => { const v = r.map((x) => x[k]).filter((x) => x != null) as number[]; return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
      return { d: fmtDate(d, { year: false }), Energy: mean("energy"), Mood: mean("mood") };
    });
  }, [rows, from, today, range]);
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) for (const t of (r.tags as string[]) ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  return (
    <div>
      <PageHeader title="Check-ins" subtitle="Log as many as you like through the day. Patterns show up over weeks, not days." actions={<Segmented value={range} onChange={setRange} size="sm" options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "all", label: "All" }]} />} />
      <div className="stagger mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<MessageCircleHeart size={18} />} color="#64748b" label="Check-ins" value={rows.length} />
        <Tile icon={<CalendarCheck size={18} />} color="#64748b" label="Days checked in" value={new Set(rows.map((r) => r.date)).size} />
        <Tile icon={<span className="text-xl leading-none">{mAvg != null ? MOOD[Math.round(mAvg) - 1].emoji : "·"}</span>} color={mAvg != null ? MOOD[Math.round(mAvg) - 1].color : "#94a3b8"} label="Average mood" value={mAvg != null ? mAvg.toFixed(1) : "–"} hint={mAvg != null ? MOOD[Math.round(mAvg) - 1].label : undefined} soft />
        <Tile icon={eAvg != null ? <Bars n={Math.round(eAvg)} color={ENERGY[Math.round(eAvg) - 1].color} size={18} /> : <span>·</span>} color={eAvg != null ? ENERGY[Math.round(eAvg) - 1].color : "#94a3b8"} label="Average energy" value={eAvg != null ? eAvg.toFixed(1) : "–"} hint={eAvg != null ? ENERGY[Math.round(eAvg) - 1].label : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card><CheckInForm date={today} tz={settings.timezone} /></Card>
          <label className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900/80 px-3.5 py-2.5 shadow-sm focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10">
            <Search size={16} className="text-fog-500" />
            <input className="w-full bg-transparent text-sm placeholder:text-fog-500 focus:outline-none" placeholder="Search wins, blockers, notes, feelings" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search check-ins" />
          </label>
          {loading ? <div className="space-y-3"><div className="skeleton h-20" /><div className="skeleton h-20" /></div> : byDay.length === 0 ? <Empty>No check-ins in this range yet. Your first one takes 10 seconds.</Empty> : byDay.map(([d, list]) => (
            <section key={d} className="fade-up">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">{d === today ? "Today" : fmtDate(d, { weekday: true })}</h3>
                <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] font-medium muted">{list.length}</span>
                <span className="h-px flex-1 bg-ink-700" />
              </div>
              <div>{list.map((c, i) => <CheckInItem key={c.id} c={c} tz={settings.timezone} last={i === list.length - 1} />)}</div>
            </section>
          ))}
        </div>
        <div className="space-y-4">
          <Card title="Mood and energy" action={<span className="flex items-center gap-3 text-[11px] muted"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2563eb]" />Mood</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#6366f1]" />Energy</span></span>}>
            {rows.length < 2 ? <p className="text-sm muted">Your trend appears after a few check-ins.</p> : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ left: -10, right: 4, top: 6 }}>
                    <defs>
                      <linearGradient id="gMood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity={0.35} /><stop offset="1" stopColor="#2563eb" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gEnergy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" stopOpacity={0.25} /><stop offset="1" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="d" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[1, 5]} ticks={[1, 3, 5]} stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ background: "var(--chart-tip-bg)", border: "1px solid var(--chart-tip-border)", borderRadius: 12, fontSize: 12 }} />
                    <Area dataKey="Mood" type="monotone" stroke="#2563eb" strokeWidth={2.5} fill="url(#gMood)" connectNulls dot={{ r: 3, fill: "#2563eb" }} />
                    <Area dataKey="Energy" type="monotone" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gEnergy)" connectNulls dot={{ r: 3, fill: "#0ea5e9" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card title="Most common feelings">
            {tagCounts.length === 0 ? <p className="text-sm muted">Tap feelings when you check in to see patterns.</p> : (
              <ul className="space-y-2.5">{tagCounts.map(([t, n]) => { const f = feeling(t); const c = f?.tone === "neg" ? "#f43f5e" : "#2563eb"; return (
                <li key={t}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="flex items-center gap-1.5"><span>{f?.emoji}</span>{t}</span><span className="text-xs font-semibold tabnum muted">{n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(n / tagCounts[0][1]) * 100}%`, background: `linear-gradient(90deg, ${c}99, ${c})` }} /></div>
                </li>); })}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, color, label, value, hint, soft }: { icon: React.ReactNode; color: string; label: string; value: React.ReactNode; hint?: string; soft?: boolean }) {
  return (
    <div className="card card-hover flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}1f`, color }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none tracking-tight tabnum">{value}</div>
        <div className="mt-1 truncate text-[11px] muted">{label}{hint ? <span style={{ color }}> · {hint}</span> : null}</div>
      </div>
    </div>
  );
}
