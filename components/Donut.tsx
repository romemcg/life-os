import clsx from "clsx";
import { Lock } from "lucide-react";
import Link from "next/link";

/** Accessible progress ring. value 0..100 (null = no data). */
export function Donut({ value, label, sub, color = "rgb(var(--teal-500))", size = 88, locked, center, href }: {
  value: number | null; label: string; sub?: React.ReactNode; color?: string; size?: number; locked?: boolean; center?: React.ReactNode; href?: string;
}) {
  const r = 42, c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const body = (
    <div className={clsx("flex flex-col items-center text-center", href && "group rounded-2xl p-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-ink-850")}>
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${locked ? "locked" : value === null ? "no data" : `${Math.round(v)}%`}`}>
        <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--ink-800))" strokeWidth="10" />
          {!locked && value !== null && v > 0 && (
            <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 1s cubic-bezier(.2,.7,.2,1)", filter: `drop-shadow(0 2px 4px ${color}55)` }} />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          {locked ? <Lock size={18} className="text-fog-500" /> : center ?? <span className="text-lg font-semibold tabnum">{value === null ? "–" : `${Math.round(v)}%`}</span>}
        </div>
      </div>
      <div className="mt-2 text-xs font-semibold leading-tight">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] leading-tight muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
