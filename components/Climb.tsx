"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import clsx from "clsx";

export type ClimbStage = { id: number; name: string; short: string; pct: number; state: "done" | "now" | "later" };

const DEEP = "#0a3337";

/**
 * The 2035 climb: six stair-steps, one per roadmap stage. Finished steps are filled, the current one fills as you
 * make progress, later ones wait. Heights come from CSS variables so the same markup works from phone to desktop.
 */
export function Climb({ stages, ageAtEnd }: { stages: ClimbStage[]; ageAtEnd: number }) {
  const last = stages.length - 1;
  return (
    <Link href="/roadmap" aria-label="Open the roadmap" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/60">
      <ol className="flex items-end gap-1.5 pt-14 [--b:34px] [--u:22px] sm:gap-2 sm:[--b:46px] sm:[--u:30px]">
        {stages.map((s, i) => {
          const fill = s.state === "done" ? 100 : s.state === "now" ? Math.max(s.pct, 6) : 0;
          const onLight = s.state === "done" || (s.state === "now" && s.pct >= 78);
          return (
            <li
              key={s.id}
              className="relative min-w-0 flex-1"
              style={{ height: `calc(var(--u) * ${i + 1} + var(--b))` }}
              aria-label={`Stage ${s.id}, ${s.name}, ${s.state === "done" ? "finished" : s.state === "now" ? `current, ${s.pct}% done` : "not started"}`}
              title={`${s.id}. ${s.name}`}
            >
              <div className={clsx("climb-step absolute inset-0 overflow-hidden rounded-t-xl bg-gradient-to-b from-white/[0.12] to-white/[0.05]", s.state === "now" && "ring-1 ring-sun/70")} style={{ "--i": i } as CSSProperties}>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-[#a6eadc] to-[#74cfbd] transition-[height] duration-1000" style={{ height: `${fill}%` }} />
              </div>
              <div className="climb-marker pointer-events-none absolute inset-x-0 top-1.5 px-0.5 text-center" style={{ color: onLight ? DEEP : s.state === "now" ? "#fff" : "rgba(255,255,255,0.5)", animationDelay: `${i * 90 + 500}ms` }}>
                <div className="num text-lg leading-none sm:text-[22px]">{s.id}</div>
                <div className="mt-1 hidden truncate text-[11px] font-medium sm:block">{s.short}</div>
                {i === last && <div className="hidden text-[10px] opacity-80 sm:block">age {ageAtEnd}</div>}
              </div>
              {s.state === "now" && (
                <div className="climb-marker pointer-events-none absolute inset-x-0 bottom-full mb-2 flex flex-col items-center gap-1" style={{ animationDelay: "950ms" }}>
                  <span className={clsx("whitespace-nowrap rounded-full bg-sun px-2.5 py-1 text-[11px] font-semibold shadow-sm", i === 0 ? "self-start" : i === last ? "self-end" : "self-center")} style={{ color: DEEP }}>
                    You are here
                  </span>
                  <span className="beacon h-2.5 w-2.5 rounded-full bg-sun" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    <div className="mt-2 flex justify-between text-xs text-white/60" aria-hidden><span>Now</span><span>2035</span></div>
    </Link>
  );
}
