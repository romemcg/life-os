"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Flame, Trophy } from "lucide-react";
import clsx from "clsx";
import { fmtDate } from "@/lib/dates";

/** Large animated progress ring for hero sections. */
export function BigRing({ value, size = 132, stroke = 11, children, track = "rgba(255,255,255,0.18)", color = "#fff" }: {
  value: number; size?: number; stroke?: number; children?: ReactNode; track?: string; color?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value || 0)))); return () => cancelAnimationFrame(t); }, [value]);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(value)}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 1s cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.35))" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Small pill: current streak with a living flame. */
export function StreakPill({ current, todayDone, className, onHero }: { current: number; todayDone: boolean; className?: string; onHero?: boolean }) {
  const label = current === 0 ? "Start a streak today" : `${current}-day streak`;
  return (
    <span
      title={todayDone ? "Today counts. Keep it going tomorrow." : current ? "Complete one task today to keep it alive." : "Complete any task to start."}
      className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", onHero ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-ink-900 text-fog-300 ring-1 ring-ink-700", className)}
    >
      <Flame size={14} className={clsx(current > 0 ? "flame text-orange-500" : "text-fog-500", onHero && "!text-amber-200")} fill={current > 0 ? "currentColor" : "none"} />
      {label}
      {current > 0 && !todayDone && <span className={clsx("rounded-full px-1.5 text-[10px]", onHero ? "bg-amber-300/30" : "bg-orange-500/10 text-orange-600")}>at risk</span>}
    </span>
  );
}

/** "Don't break the chain": one square per day, Monday-first columns. */
export function ChainCalendar({ grid, current, best, last30, today }: {
  grid: { date: string; n: number; active: boolean }[]; current: number; best: number; last30: number; today: string;
}) {
  const max = Math.max(1, ...grid.map((g) => g.n));
  // Pad so columns are calendar weeks (Mon..Sun).
  const first = new Date(grid[0]?.date + "T00:00:00");
  const pad = ((first.getDay() + 6) % 7);
  const cells: ({ date: string; n: number; active: boolean } | null)[] = [...Array(pad).fill(null), ...grid];
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const shade = (g: { n: number; active: boolean }) => {
    if (!g.active) return "rgb(var(--ink-800))";
    const t = g.n === 0 ? 0.25 : 0.35 + 0.65 * (g.n / max);
    return `rgb(var(--teal-500) / ${t.toFixed(2)})`;
  };
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Metric icon={<Flame size={16} className={clsx(current > 0 && "flame")} />} value={current} label="Current streak" tone="flame" />
        <Metric icon={<Trophy size={16} className="text-amber-500" />} value={best} label="Best streak" />
        <Metric value={`${last30}/30`} label="Active days" />
      </div>
      <div className="grid gap-[3px] sm:gap-1" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((w, i) => (
          <div key={i} className="grid gap-[3px] sm:gap-1">
            {w.map((g, j) => g ? (
              <div
                key={g.date}
                title={`${fmtDate(g.date, { weekday: true })}: ${g.active ? `${g.n} done` : "no activity"}`}
                className={clsx("aspect-square max-h-7 w-full rounded-[5px] transition-transform duration-150 hover:scale-125", g.date === today && "ring-2 ring-teal-500 ring-offset-2 ring-offset-[rgb(var(--ink-900))]")}
                style={{ background: shade(g) }}
              />
            ) : <div key={`p${j}`} className="aspect-square max-h-7 w-full" />)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] muted">
        Less {[0, 0.35, 0.6, 0.8, 1].map((t, i) => <span key={i} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: t ? `rgb(var(--teal-500) / ${t})` : "rgb(var(--ink-800))" }} />)} More
      </div>
    </div>
  );
}

function Metric({ icon, value, label, tone }: { icon?: ReactNode; value: ReactNode; label: string; tone?: "flame" }) {
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-850/60 px-3 py-2.5">
      <div className={clsx("flex items-center gap-1.5 text-xl font-bold tabnum tracking-tight", tone === "flame" && "text-orange-500")}>{icon}{value}</div>
      <div className="text-[11px] muted">{label}</div>
    </div>
  );
}

const COLORS = ["#2563eb", "#6366f1", "#f59e0b", "#ec4899", "#22c55e", "#0ea5e9"];
/** Brief celebratory burst. Renders nothing when reduced motion is preferred. */
export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<{ id: number; style: React.CSSProperties }[]>([]);
  useEffect(() => {
    if (!fire) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const list = Array.from({ length: 70 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, dist = 140 + Math.random() * 260;
      return { id: fire * 1000 + i, style: {
        left: "50%", top: "40%", background: COLORS[i % COLORS.length],
        ["--dx" as string]: `${Math.cos(a) * dist}px`, ["--dy" as string]: `${Math.sin(a) * dist + 160}px`, ["--rot" as string]: `${Math.random() * 720 - 360}deg`,
        animationDelay: `${Math.random() * 120}ms`,
      } as React.CSSProperties };
    });
    setPieces(list);
    const t = setTimeout(() => setPieces([]), 1500);
    return () => clearTimeout(t);
  }, [fire]);
  if (!pieces.length) return null;
  return <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>{pieces.map((p) => <span key={p.id} className="confetti-piece" style={p.style} />)}</div>;
}

export function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
