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
    <section className="card fade-up relative overflow-hidden p-5">
      <div className="relative flex items-center justify-between gap-2">
        <span className="eyebrow inline-flex items-center gap-1.5"><Lightbulb size={13} />{offset === 0 ? "Today's read" : "Another read"} · 1 min</span>
        <span className="chip border-ink-700 text-fog-400"><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{b.cat}</span>
      </div>
      <div key={anim} className="fade-up relative">
        <h3 className="mt-3 text-lg font-semibold leading-snug">{b.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-fog-300">{b.body}</p>
        <div className="mt-4 border-l-2 border-teal-400 pl-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-500">Try today</div>
          <p className="mt-0.5 text-sm font-medium">{b.try}</p>
        </div>
      </div>
      <div className="relative mt-4 flex items-center gap-1">
        <button className="btn-ghost p-1.5" aria-label="Previous read" onClick={() => go(-1)}><ChevronLeft size={16} /></button>
        <button className="btn-ghost p-1.5" aria-label="Next read" onClick={() => go(1)}><ChevronRight size={16} /></button>
        <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => go(1 + Math.floor(Math.random() * (BITES.length - 1)))}><Shuffle size={13} />Surprise me</button>
        <span className="flex-1" />
        {offset !== 0 && <button className="text-xs font-medium text-teal-400 hover:underline" onClick={() => { setOffset(0); setAnim((a) => a + 1); }}>Back to today&apos;s</button>}
      </div>
    </section>
  );
}
