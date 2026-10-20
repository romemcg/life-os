"use client";
import type { CSSProperties, ReactNode } from "react";
import { ExternalLink, Mail, MapPin, UserRound, Clock, FileText, Plus } from "lucide-react";
import { clsx } from "./ui";
import { api, type Row } from "@/lib/client";
import { diffDays, fmtDate, relativeDay } from "@/lib/dates";

/** One colour per stage so status reads at a glance, on the board, in tables and in the funnel strip. */
export const STAGE_META: Record<string, { label: string; color: string }> = {
  saved: { label: "Saved", color: "#64748b" },
  applied: { label: "Applied", color: "#2563eb" },
  screening: { label: "Screening", color: "#7c3aed" },
  interview: { label: "Interview", color: "#d97706" },
  final: { label: "Final round", color: "#ea580c" },
  offer: { label: "Offer", color: "#059669" },
  rejected: { label: "Rejected", color: "#dc2626" },
  withdrawn: { label: "Withdrawn", color: "#6b7280" },
};
export const PIPE_ORDER = ["saved", "applied", "screening", "interview", "final", "offer"];
export const CLOSED = ["rejected", "withdrawn"];

const tint = (c: string, a = "1c"): CSSProperties => ({ color: c, background: `${c}${a}`, borderColor: `${c}55` });

export function StageChip({ stage }: { stage: string }) {
  const m = STAGE_META[stage] ?? { label: stage, color: "#64748b" };
  return <span className="chip" style={tint(m.color)}>{m.label}</span>;
}

/** Six pips from Saved to Offer: how far along this application is. */
export function StagePips({ stage }: { stage: string }) {
  const idx = PIPE_ORDER.indexOf(stage);
  const m = STAGE_META[stage];
  return (
    <div className="flex items-center gap-1" aria-label={`Stage ${m?.label ?? stage}`}>
      {PIPE_ORDER.map((s, i) => (
        <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: idx >= i && idx >= 0 ? "rgb(var(--teal-400))" : "rgb(var(--ink-700) / 0.8)" }} />
      ))}
    </div>
  );
}

export function ageDays(a: Row, today: string): number | null {
  const d = a.applied_date || (a.created_at ? String(a.created_at).slice(0, 10) : "");
  return d ? Math.max(0, diffDays(d, today)) : null;
}
export function ageText(n: number) {
  return n === 0 ? "today" : n < 14 ? `${n}d` : `${Math.round(n / 7)}w`;
}

/** Age since applied. Fresh is green, ageing amber, stale red, only while nothing has moved past screening. */
export function AgeChip({ a, today }: { a: Row; today: string }) {
  const n = ageDays(a, today);
  if (n === null) return null;
  const waiting = ["saved", "applied", "screening"].includes(a.stage);
  const color = CLOSED.includes(a.stage) ? "#6b7280" : !waiting ? "#2563eb" : n <= 7 ? "#059669" : n <= 14 ? "#d97706" : "#dc2626";
  const verb = a.stage === "saved" ? "Saved" : "Applied";
  return (
    <span className="chip tabnum" style={tint(color)} title={`${verb} ${n} day${n === 1 ? "" : "s"} ago`}>
      <Clock size={10} /> {ageText(n)}
    </span>
  );
}

export function contactOf(a: Row, contacts: Row[]): { name: string; email?: string; linked: boolean } | null {
  const c = a.contact_id ? contacts.find((x) => x.id === a.contact_id) : null;
  if (c) return { name: c.name, email: c.email || undefined, linked: true };
  const t = String(a.contact ?? "").trim();
  return t ? { name: t, linked: false } : null;
}

const money = (s: unknown) => {
  const t = String(s ?? "").trim();
  return t && !/^(ns|n\/a|na|-|–)$/i.test(t) ? t : "";
};

function IconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="text-fog-500 hover:text-teal-400" aria-label={label} title={label}>
      {children}
    </a>
  );
}

/** Proportional strip: how many applications sit in each stage. */
export function FunnelStrip({ apps, stages }: { apps: Row[]; stages: string[] }) {
  const counts = stages.map((s) => ({ s, n: apps.filter((a) => a.stage === s).length }));
  const total = counts.reduce((x, c) => x + c.n, 0);
  if (!total) return null;
  return (
    <div className="card card-pad">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {counts.filter((c) => c.n).map((c) => (
          <div key={c.s} style={{ flex: c.n, background: STAGE_META[c.s].color }} title={`${STAGE_META[c.s].label}: ${c.n}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {counts.map((c) => (
          <span key={c.s} className={clsx("inline-flex items-center gap-1.5", !c.n && "opacity-50")}>
            <span className="h-2 w-2 rounded-full" style={{ background: STAGE_META[c.s].color }} />
            {STAGE_META[c.s].label} <b className="tabnum">{c.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Latest CV version for an application: label and status (Ready / Blocked). */
export function AppCard({ a, today, contacts, onOpen }: { a: Row; today: string; contacts: Row[]; onOpen: () => void }) {
  const m = STAGE_META[a.stage] ?? STAGE_META.saved;
  const idx = PIPE_ORDER.indexOf(a.stage);
  const next = idx >= 0 && idx < PIPE_ORDER.length - 1 ? PIPE_ORDER[idx + 1] : null;
  const ct = contactOf(a, contacts);
  const email = a.email || (ct?.email ?? "");
  const pay = money(a.compensation);
  return (
    <div className="group rounded-xl border border-ink-700/80 bg-ink-900 p-3 text-sm shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:border-ink-600">
      <button className="block w-full text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 font-semibold leading-snug">{a.company}</div>
          <AgeChip a={a} today={today} />
        </div>
        {a.location && <div className="mt-0.5 flex items-center gap-1 text-[11px] muted"><MapPin size={10} />{a.location}</div>}
        <div className="mt-1 text-xs leading-snug">{a.position}</div>
        {pay && <div className="mt-0.5 text-[11px] font-medium tabnum text-fog-300">{pay}</div>}
        <div className="mt-2"><StagePips stage={a.stage} /></div>
        <div className="mt-2 flex flex-wrap gap-1">
          {ct && <span className="chip" title={ct.linked ? "Linked from your network" : "Contact (not in your network)"}><UserRound size={10} />{ct.name}</span>}
          {(a.cv_version || a.cv_link) && <span className="chip"><FileText size={10} />{a.cv_version || "CV"}</span>}
          {a.next_action_due && !CLOSED.includes(a.stage) && <span className="chip" style={a.next_action_due < today ? tint("#d97706") : undefined}>{relativeDay(a.next_action_due, today)}</span>}
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {a.url && <IconLink href={a.url} label="Open job link"><ExternalLink size={13} /></IconLink>}
          {email && <IconLink href={`mailto:${email}`} label={`Email ${email}`}><Mail size={13} /></IconLink>}
        </div>
        {next && !CLOSED.includes(a.stage) && (
          <button className="text-[11px] font-medium text-fog-400 hover:text-teal-400" onClick={() => api.update("applications", a.id, { stage: next, ...(a.stage === "saved" && !a.applied_date ? { applied_date: today } : {}) })}>
            → {STAGE_META[next].label}
          </button>
        )}
      </div>
    </div>
  );
}

const GRID: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
  5: "md:grid-cols-3 xl:grid-cols-5",
  6: "md:grid-cols-3 xl:grid-cols-6",
  7: "md:grid-cols-3 xl:grid-cols-7",
};

export function AppBoard({ apps, stages, today, contacts, onOpen }: { apps: Row[]; stages: string[]; today: string; contacts: Row[]; onOpen: (a: Row) => void }) {
  return (
    <div className={clsx("grid gap-3", GRID[stages.length] ?? GRID[6])}>
      {stages.map((s) => {
        const col = apps.filter((a) => a.stage === s);
        const m = STAGE_META[s];
        return (
          <div key={s} className="rounded-2xl border border-ink-700/60 bg-ink-800/40 p-2">
            <div className="mb-2 flex items-center justify-between px-1.5 pt-0.5 text-xs font-semibold text-fog-100">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: m.color }} />{m.label}</span>
              <span className="tabnum rounded-full bg-ink-900 px-1.5 py-0.5 text-[11px] text-fog-400 ring-1 ring-ink-700">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((a) => <AppCard key={a.id} a={a} today={today} contacts={contacts} onOpen={() => onOpen(a)} />)}
              {!col.length && <div className="px-1 py-3 text-center text-[11px] muted">Nothing here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Company, location, status, role, salary, job link, contact, email, then age and CV. */
export function AppTable({ apps, today, contacts, interviews, onOpen, onLogInterview }: { apps: Row[]; today: string; contacts: Row[]; interviews?: Row[]; onOpen: (a: Row) => void; onLogInterview?: (a: Row) => void }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="text-left text-[11px] muted">
            {["Company", "Location", "Status", "Role", "Salary", "Link", "Contact", "Email", "Open", "CV"].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
            {interviews && <th className="px-3 py-2.5 font-medium">Interviews</th>}
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => {
            const m = STAGE_META[a.stage] ?? STAGE_META.saved;
            const ct = contactOf(a, contacts);
            const email = a.email || ct?.email || "";
            const mine = (interviews ?? []).filter((i) => i.application_id === a.id).sort((x, y) => String(y.date ?? "").localeCompare(String(x.date ?? "")));
            const upcoming = mine.find((i) => i.date && i.date >= today);
            const last = upcoming ?? mine[0];
            return (
              <tr key={a.id} className="cursor-pointer border-t border-ink-800 hover:bg-ink-850" onClick={() => onOpen(a)}>
                <td className="px-3 py-2.5 font-semibold">{a.company}</td>
                <td className="px-3 py-2.5 muted">{a.location || "–"}</td>
                <td className="px-3 py-2.5"><StageChip stage={a.stage} /></td>
                <td className="max-w-[240px] px-3 py-2.5">{a.position}</td>
                <td className="px-3 py-2.5 tabnum">{money(a.compensation) || <span className="muted">–</span>}</td>
                <td className="px-3 py-2.5">{a.url ? <IconLink href={a.url} label="Open job link"><ExternalLink size={14} /></IconLink> : <span className="muted">–</span>}</td>
                <td className="px-3 py-2.5">{ct ? <span className={clsx("inline-flex items-center gap-1", !ct.linked && "muted")}><UserRound size={12} />{ct.name}</span> : <span className="muted">–</span>}</td>
                <td className="px-3 py-2.5">{email ? <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="text-teal-500 hover:underline">{email}</a> : <span className="muted">–</span>}</td>
                <td className="px-3 py-2.5"><AgeChip a={a} today={today} /></td>
                <td className="px-3 py-2.5">{a.cv_version || (a.cv_link ? "CV" : <span className="muted">–</span>)}</td>
                {interviews && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {last ? (
                        <div className="text-xs">
                          <div className="tabnum">{last.date ? fmtDate(last.date, { year: false }) : "No date"}{last.round ? ` · ${last.round}` : ""}</div>
                          <div className="muted">{last.outcome || (upcoming ? (upcoming.prep_done ? "Prepped" : "Prep needed") : "Pending")}{mine.length > 1 ? ` · ${mine.length} rounds` : ""}</div>
                        </div>
                      ) : (
                        <span className="text-xs muted">None logged</span>
                      )}
                      {onLogInterview && (
                        <button className="btn-ghost px-1.5 py-1 text-xs" title="Log an interview" onClick={(e) => { e.stopPropagation(); onLogInterview(a); }}><Plus size={12} /></button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
