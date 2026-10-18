"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import clsx from "clsx";

export type ThemePref = "light" | "dark" | "system";
import { THEME_KEY as KEY } from "@/lib/theme-boot";

function apply(p: ThemePref) {
  const dark = p === "dark" || (p === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("light", !dark);
}

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [pref, setPref] = useState<ThemePref>("light");
  useEffect(() => {
    let p: ThemePref = "light";
    try { p = (localStorage.getItem(KEY) as ThemePref) || "light"; } catch {}
    setPref(p);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { try { if ((localStorage.getItem(KEY) || "light") === "system") apply("system"); } catch {} };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const choose = (p: ThemePref) => {
    setPref(p);
    try { localStorage.setItem(KEY, p); } catch {}
    apply(p);
  };
  const opts: { v: ThemePref; label: string; Icon: typeof Sun }[] = [
    { v: "light", label: "Light", Icon: Sun },
    { v: "dark", label: "Dark", Icon: Moon },
    { v: "system", label: "System", Icon: Monitor },
  ];
  return (
    <div className="inline-flex rounded-lg border border-ink-600 bg-ink-950/50 p-0.5" role="radiogroup" aria-label="Theme">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          role="radio"
          aria-checked={pref === v}
          title={label}
          onClick={() => choose(v)}
          className={clsx("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors", pref === v ? "bg-ink-700 text-fog-100" : "text-fog-400 hover:text-fog-100")}
        >
          <Icon size={13} />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
