"use client";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { clsx } from "@/components/ui";

// Colour-coded "Your week" card. Each row is judged against where you should be TODAY,
// so a short bar on Monday is not a failure.
export type Status = "on" | "watch" | "behind" | "none";

export type PulseRow = {
  href: string;
  label: string;
  Icon: LucideIcon;
  done: number;
  target: number;      // full target for the period (or max score)
  expected: number;    // where you should be by today; for scores, unused
  kind?: "count" | "score";
  unit?: string;       // shown after the number, e.g. "pages"
  hint: string;        // one plain line: what it means or what to do
  status: Status;
};

const S: Record<Status, { label: string; bar: string; chip: string; icon: string; hint: string }> = {
  on: { label: "On track", bar: "#13a08f", chip: "border-teal-500/30 bg-teal-500/10 text-teal-300", icon: "bg-teal-500/10 text-teal-300", hint: "muted" },
  watch: { label: "Watch", bar: "#e0a020", chip: "border-amber-400/30 bg-amber-400/10 text-amber-300", icon: "bg-amber-400/10 text-amber-300", hint: "text-amber-300" },
  behind: { label: "Behind", bar: "#e0445e", chip: "border-rose-400/30 bg-rose-400/10 text-rose-300", icon: "bg-rose-400/10 text-rose-300", hint: "text-rose-300" },
  none: { label: "Not started", bar: "#9aa8a8", chip: "border-ink-700 bg-ink-800 text-fog-300", icon: "bg-ink-800 text-fog-400", hint: "muted" },
};
const SCORE_LABEL: Record<Status, string> = { on: "Good", watch: "Moderate", behind: "Low", none: "No data" };

/** Pace status: done vs expected-by-today. */
export function paceStatus(done: number, expected: number, target: number): Status {
  if (target <= 0) return "none";
  if (done >= target) return "on";
  if (expected <= 0) return done > 0 ? "on" : "none";
  const r = done / expected;
  return r >= 1 ? "on" : r >= 0.5 ? "watch" : "behind";
}
export function scoreStatus(avg: number | null): Status {
  if (avg === null) return "none";
  return avg >= 3.5 ? "on" : avg >= 2.5 ? "watch" : "behind";
}

const pct = (n: number, d: number) => (d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0);

export function WeekPulse({ rows, range, dayOfWeek }: { rows: PulseRow[]; range: string; dayOfWeek: number }) {
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="h-section">Your week</h2>
          <span className="text-xs muted">{range} · day {dayOfWeek} of 7</span>
        </div>
        <div className="flex gap-1.5">
          {(["on", "watch", "behind"] as Status[]).map((s) => count(s) ? (
            <span key={s} className={clsx("rounded-md border px-2 py-0.5 text-[11px] font-medium", S[s].chip)}>{count(s)} {S[s].label.toLowerCase()}</span>
          ) : null)}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] muted">
        {(["on", "watch", "behind"] as Status[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: S[s].bar }} />{S[s].label}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-0.5 rounded bg-fog-400" />Where you should be today</span>
      </div>

      <ul className="mt-2">
        {rows.map((r) => {
          const st = S[r.status];
          const score = r.kind === "score";
          return (
            <li key={r.label} className="border-t border-ink-700/70">
              <Link href={r.href} className="group grid grid-cols-[32px_minmax(0,1fr)_84px] items-center gap-3 py-3">
                <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", st.icon)}><r.Icon size={16} aria-hidden /></span>

                <span className="min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium group-hover:text-teal-300">{r.label}</span>
                    <span className={clsx("truncate text-xs", st.hint)} title={r.hint}>{r.hint}</span>
                  </span>
                  {score ? (
                    <span className="mt-1.5 flex gap-1" aria-hidden>
                      {Array.from({ length: r.target }, (_, i) => (
                        <span key={i} className="h-2 flex-1 rounded-full bg-ink-700/70" style={i < Math.round(r.done) ? { background: st.bar } : undefined} />
                      ))}
                    </span>
                  ) : (
                    <span className="relative mt-1.5 block h-2 rounded-full bg-ink-700/70" role="progressbar" aria-valuenow={r.done} aria-valuemax={r.target} aria-label={`${r.label}: ${r.done} of ${r.target}, ${st.label}`}>
                      <span className="block h-2 rounded-full transition-all duration-700 ease-out" style={{ width: `${pct(r.done, r.target)}%`, background: st.bar }} />
                      {r.expected > 0 && r.expected < r.target && (
                        <span className="absolute -top-[3px] h-3.5 w-0.5 rounded bg-fog-400" style={{ left: `${pct(r.expected, r.target)}%` }} title="Where you should be today" />
                      )}
                    </span>
                  )}
                </span>

                <span className="text-right">
                  <span className="block text-base font-semibold tabnum leading-tight">
                    {score ? r.done.toFixed(1) : r.done}<span className="text-xs font-normal muted"> / {r.target}{r.unit ? ` ${r.unit}` : ""}</span>
                  </span>
                  <span className={clsx("mt-1 inline-block rounded-md border px-1.5 py-px text-[10.5px] font-medium", st.chip)}>{score ? SCORE_LABEL[r.status] : st.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
