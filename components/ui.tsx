"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";

export { clsx };

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h-title">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("card", pad && "card-pad", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? <h2 className="h-section">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const c = tone === "good" ? "text-teal-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-fog-100";
  return (
    <div className="min-w-0">
      <div className="text-xs muted">{label}</div>
      <div className={clsx("mt-0.5 truncate text-lg font-semibold tabnum", c)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-fog-500">{hint}</div>}
    </div>
  );
}

export function Progress({ value, className, color = "#4fb8ab" }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-ink-700/70", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${v}%`, background: /^#[0-9a-f]{6}$/i.test(color) ? `linear-gradient(90deg, ${color}b3, ${color})` : `linear-gradient(90deg, rgb(var(--teal-400)), ${color})` }} />
    </div>
  );
}

const TONES: Record<string, string> = {
  teal: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  blue: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  gray: "border-ink-700 bg-ink-800 text-fog-300",
};
export function Badge({ children, tone = "gray", className, title }: { children: ReactNode; tone?: keyof typeof TONES; className?: string; title?: string }) {
  return <span title={title} className={clsx("chip", TONES[tone], className)}>{children}</span>;
}

export function PillarDot({ color, className }: { color?: string; className?: string }) {
  return <span className={clsx("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: color || "var(--chart-axis)" }} />;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850/50 px-4 py-8 text-center text-sm muted">
      <div>{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  // Portal to <body>: cards use backdrop blur, which would otherwise trap a fixed overlay inside the card.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx("fade-up max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-ink-700 bg-ink-900 p-6 shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-xl border border-ink-700 bg-ink-800/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx("rounded-lg font-medium transition-all duration-200", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm", value === o.value ? "bg-ink-900 text-fog-100 shadow-sm ring-1 ring-ink-700" : "text-fog-400 hover:text-fog-100")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div role="status" className={clsx("fade-up fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full border px-5 py-2.5 text-sm font-medium shadow-2xl backdrop-blur lg:bottom-8", msg.tone === "ok" ? "border-teal-500/40 bg-ink-900/95 text-teal-300" : "border-rose-400/40 bg-ink-900/95 text-rose-300")}>
      {msg.text}
    </div>
  ) : null;
  return { toast: (text: string, tone: "ok" | "err" = "ok") => setMsg({ text, tone }), node };
}

/** Provenance chip: separates actual vs estimated vs aspirational data. */
export function Provenance({ value }: { value?: string | null }) {
  if (!value || value === "actual") return <Badge tone="teal" title="Confirmed actual figure">Actual</Badge>;
  if (value === "estimate") return <Badge tone="amber" title="Estimate - confirm when you can">Estimate</Badge>;
  return <Badge tone="violet">{value}</Badge>;
}
