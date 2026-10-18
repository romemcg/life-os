"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle, Lightbulb } from "lucide-react";
import { BITES, BITE_STYLE, biteIndexFor } from "@/lib/bites";

/** Bite-size daily reading: one per day, browsable. */
export function DailyBite({ today }: { today: string }) {
  const base = biteIndexFor(today);
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(0);
  const i = ((base + offset) % BITES.length + BITES.length) % BITES.length;
  const b = BITES[i];
  const st = BITE_STYLE[b.cat];
  const go = (d: number) => { setOffset((o) => o + d); setAnim((a) => a + 1); };

  return (
    <section className="card fade-up relative overflow-hidden p-5" style={{ background: `linear-gradient(160deg, ${st.color}1c, transparent 55%), rgb(var(--ink-900) / 0.85)` }}>
      <span className="pointer-events-none absolute -right-3 -top-4 select-none text-[84px] leading-none opacity-[0.12]" aria-hidden>{st.emoji}</span>
      <div className="relative flex items-center justify-between gap-2">
        <span className="eyebrow inline-flex items-center gap-1.5"><Lightbulb size={13} />{offset === 0 ? "Today's read" : "Another read"} · 1 min</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${st.color}22`, color: st.color }}>{st.emoji} {b.cat}</span>
      </div>
      <div key={anim} className="fade-up relative">
        <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight">{b.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-fog-300">{b.body}</p>
        <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: `${st.color}40`, background: `${st.color}12` }}>
          <div className="text-[11px] font-semibold" style={{ color: st.color }}>Try today</div>
          <p className="mt-0.5 text-sm font-medium">{b.try}</p>
        </div>
      </div>
      <div className="relative mt-4 flex items-center gap-1">
        <button className="btn-ghost p-1.5" aria-label="Previous read" onClick={() => go(-1)}><ChevronLeft size={16} /></button>
        <button className="btn-ghost p-1.5" aria-label="Next read" onClick={() => go(1)}><ChevronRight size={16} /></button>
        <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => go(1 + Math.floor(Math.random() * (BITES.length - 1)))}><Shuffle size={13} />Surprise me</button>
        <span className="flex-1" />
        {offset !== 0 && <button className="text-xs font-medium hover:underline" style={{ color: st.color }} onClick={() => { setOffset(0); setAnim((a) => a + 1); }}>Back to today&apos;s</button>}
      </div>
    </section>
  );
}
