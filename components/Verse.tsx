"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sunrise } from "lucide-react";
import clsx from "clsx";
import { verseRefFor } from "@/lib/bible";

export function usePassage(ref: string | null, translation: string) {
  const [st, setSt] = useState<{ text?: string; reference?: string; translation?: string; error?: string; loading: boolean }>({ loading: !!ref });
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    setSt({ loading: true });
    fetch(`/api/bible?ref=${encodeURIComponent(ref)}&t=${translation}`)
      .then(async (r) => ({ ok: r.ok, b: await r.json() }))
      .then(({ ok, b }) => alive && setSt(ok ? { ...b, loading: false } : { error: b.error, loading: false }))
      .catch(() => alive && setSt({ error: "Offline", loading: false }));
    return () => { alive = false; };
  }, [ref, translation]);
  return st;
}

export function VerseCard({ today, translation, compact }: { today: string; translation: string; compact?: boolean }) {
  const ref = verseRefFor(today);
  const v = usePassage(ref, translation);
  return (
    <section className={clsx("card fade-up relative overflow-hidden", compact ? "p-4" : "p-5 sm:p-6")}>
      <div className="flex items-center gap-2 text-xs font-semibold text-fog-400"><Sunrise size={14} className="text-teal-400" />Verse of the day</div>
      {v.loading ? <p className="mt-3 text-sm muted">Loading…</p> : v.error ? (
        <p className="mt-3 text-lg font-medium">{ref}<span className="mt-1 block text-xs font-normal muted">{v.error}</span></p>
      ) : (
        <>
          <blockquote className={clsx("mt-3 font-serif leading-relaxed text-fog-100", compact ? "text-base" : "text-lg sm:text-xl")}>&ldquo;{v.text}&rdquo;</blockquote>
          <div className="mt-2 text-sm text-teal-300">{v.reference} <span className="text-xs muted">· {v.translation}</span></div>
        </>
      )}
      {compact && <Link href="/morning" className="mt-3 inline-block text-xs text-teal-300 hover:underline">Open Morning</Link>}
    </section>
  );
}

