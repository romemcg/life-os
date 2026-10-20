"use client";
import clsx from "clsx";
import { useId } from "react";

/** LIFE OS mark, drawn in the same circuit style as the MG icon on mark-gomez.vercel.app:
 *  navy tile, sky-to-blue gradient stroke, small consistent steps rising to a node (2035). */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="LIFE OS logo">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38BDF8" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0F2347" /><stop offset="1" stopColor="#081329" /></linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#b${id})`} stroke={`url(#g${id})`} strokeWidth="2.5" />
      <path d="M13 48h9V39h9V30h9V21h6" fill="none" stroke={`url(#g${id})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#E0F2FE"><circle cx="13" cy="48" r="3" /><circle cx="31" cy="39" r="2.6" /></g>
      <circle cx="50" cy="17" r="4.5" fill="#38BDF8" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="font-display block text-[19px] font-semibold tracking-[-0.03em] text-fog-100">Life OS<span className="text-teal-400">.</span></span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-fog-500">Project 2035</span>
      </span>
    </span>
  );
}
