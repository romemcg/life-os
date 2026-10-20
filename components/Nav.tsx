"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { House, Sun, Map, Briefcase, Wallet, Sprout, Settings, Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { StreakPill } from "./Consistency";
import { useStreak } from "./useStreak";
import { useSettings, useToday } from "@/lib/client";
import { FocusPill } from "./Focus";

type Sub = { href: string; label: string };
type Group = { label: string; href: string; icon: typeof Sun; subs?: Sub[] };

/** Six places. Related screens are tabs inside one place. */
export const GROUPS: Group[] = [
  { label: "Home", href: "/", icon: House },
  { label: "Today", href: "/today", icon: Sun, subs: [{ href: "/morning", label: "Morning" }, { href: "/today", label: "Plan" }, { href: "/check-ins", label: "Check-ins" }] },
  { label: "Vision", href: "/vision", icon: Map, subs: [{ href: "/vision", label: "Vision" }, { href: "/roadmap", label: "Roadmap" }] },
  { label: "Career", href: "/career", icon: Briefcase },
  { label: "Money", href: "/finances", icon: Wallet },
  { label: "Growth", href: "/learning", icon: Sprout, subs: [{ href: "/learning", label: "Learning" }, { href: "/habits", label: "Health" }, { href: "/relationships", label: "Relationships" }] },
];
const MOBILE = ["Home", "Vision", "Today", "Career", "Money"];

const matches = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
export function groupFor(path: string) {
  return GROUPS.find((g) => (g.subs ? g.subs.some((s) => matches(path, s.href)) : matches(path, g.href)));
}

function Links({ onClick }: { onClick?: () => void }) {
  const path = usePathname();
  const active = groupFor(path);
  return (
    <nav className="flex flex-col gap-1">
      {GROUPS.map((g) => {
        const on = active === g;
        const Icon = g.icon;
        return (
          <Link key={g.label} href={g.href} onClick={onClick} aria-current={on ? "page" : undefined} className={clsx("relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[15px] transition-all duration-200", on ? "bg-teal-400/10 font-semibold text-teal-300 ring-1 ring-teal-400/20" : "font-medium text-fog-400 hover:bg-fog-100/[0.06] hover:text-fog-100")}>
                        <Icon size={19} strokeWidth={on ? 2.3 : 1.9} />
            {g.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Tabs for the screens inside the current place (e.g. Today → Morning · Plan · Check-ins). */
export function SubNav() {
  const path = usePathname();
  const g = groupFor(path);
  if (!g?.subs) return null;
  return (
    <div className="mb-6 -mt-1 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-ink-700/80 bg-ink-900/80 p-1 shadow-[var(--shadow-card)] backdrop-blur">
      {g.subs.map((s) => {
        const on = matches(path, s.href);
        return (
          <Link key={s.href} href={s.href} className={clsx("whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200", on ? "bg-fog-100 text-ink-900" : "text-fog-400 hover:bg-fog-100/[0.07] hover:text-fog-100")}>
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const active = groupFor(path);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-700/80 side-surface px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-8 flex-1 overflow-y-auto"><Links /></div>
        <div className="space-y-3 px-1">
          <FocusPill className="w-full justify-center" />
          <SideStreak />
          <Link href="/settings" className={clsx("flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-sm", path === "/settings" ? "text-fog-100" : "text-fog-400 hover:text-fog-100")}><Settings size={16} />Settings</Link>
          <ThemeToggle compact />
          <p className="px-0.5 text-[11px] text-fog-500">Local-first. Your data stays on this machine.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-700/60 bg-ink-950/80 px-4 py-3 backdrop-blur-md lg:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <FocusPill />
          <button className="btn-ghost p-1.5" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="fade-up flex h-full w-72 flex-col overflow-y-auto border-r border-ink-700 bg-ink-900 px-4 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between"><Brand /><button className="btn-ghost p-1" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <Links onClick={() => setOpen(false)} />
            <div className="mt-auto space-y-3 px-1 pt-6">
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 text-sm text-fog-400"><Settings size={16} />Settings</Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 items-end rounded-2xl border border-ink-700/70 bg-ink-900/90 px-1 shadow-2xl backdrop-blur-xl lg:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {MOBILE.map((label) => GROUPS.find((g) => g.label === label)!).map((g) => {
          const Icon = g.icon;
          const on = active === g;
          if (g.label === "Today") return (
            <Link key={g.label} href={g.href} className="flex flex-col items-center pb-1.5">
              <span className={clsx("-mt-5 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-md ring-4 ring-ink-950 transition-transform active:scale-95", on ? "scale-105" : "")} style={{ background: "rgb(var(--teal-400))" }}><Icon size={22} /></span>
              <span className={clsx("mt-1 text-[10px] font-semibold", on ? "text-teal-300" : "text-fog-400")}>Today</span>
            </Link>
          );
          return (
            <Link key={g.label} href={g.href} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors", on ? "text-teal-300" : "text-fog-400")}>
              <Icon size={19} strokeWidth={on ? 2.4 : 2} />
              {g.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="px-1" aria-label="LIFE OS home">
      <Logo />
    </Link>
  );
}

function SideStreak() {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const st = useStreak(today, 7);
  if (st.loading) return null;
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-850/70 p-3">
      <StreakPill current={st.current} todayDone={st.todayDone} />
      <div className="mt-2.5 flex gap-1" aria-label="Last 7 days">
        {st.grid.map((g) => <span key={g.date} title={g.date} className={clsx("h-1.5 flex-1 rounded-full", g.active ? "bg-teal-500" : "bg-ink-700")} />)}
      </div>
      <p className="mt-1.5 text-[10px] muted">{st.last7} of last 7 days active</p>
    </div>
  );
}
