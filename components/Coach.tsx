"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquareText, X, Send, Trash2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";

type Msg = { id?: number; role: "user" | "assistant"; content: string; meta?: { actions?: { ok: boolean; summary: string }[] } | null };
type State = { configured: boolean; messages: Msg[] };

const STARTERS = [
  "What should I focus on today?",
  "How long will my money last?",
  "I only have 1 hour and low energy. What's the minimum?",
  "Help me plan my job search this week",
];

/** Tiny safe formatter: paragraphs, bullets and **bold**. No HTML injection. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l)))
          return <ul key={i} className="list-disc space-y-0.5 pl-4">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>)}</ul>;
        return <p key={i} className="whitespace-pre-wrap">{inline(b)}</p>;
      })}
    </div>
  );
}

export function Coach() {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<State | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const path = usePathname();

  const load = () => fetch("/api/coach", { cache: "no-store" }).then((r) => r.json()).then(setSt).catch(() => setSt({ configured: false, messages: [] }));
  useEffect(() => { if (open) { load(); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [st?.messages.length, busy, open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setSt((s) => (s ? { ...s, messages: [...s.messages, { role: "user", content: msg }] } : s));
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setSt((s) => (s ? { ...s, messages: [...s.messages, { role: "assistant", content: body.reply, meta: body.actions?.length ? { actions: body.actions } : null }] } : s));
      if (body.actions?.length) ["tasks", "expenses", "task_completions"].forEach((t) => api.invalidate(t));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm("Clear the whole conversation?")) return;
    await fetch("/api/coach", { method: "DELETE" });
    load();
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-28 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-500/30 transition hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
          style={{ background: "linear-gradient(135deg, #6366f1, rgb(var(--teal-500)))" }}
          aria-label="Open Coach"
        >
          <MessageSquareText size={18} /> <span className="hidden sm:inline">Coach</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 lg:bg-transparent" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-label="Coach"
            className="fade-up flex h-full w-full flex-col border-l border-ink-700 bg-ink-900 shadow-2xl sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
              <Sparkles size={16} className="text-teal-400" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Coach</div>
                <div className="text-[11px] muted">Sees your LIFE OS data. Can add tasks and log spending.</div>
              </div>
              {st?.messages.length ? <button className="btn-ghost p-1.5" onClick={clear} aria-label="Clear conversation" title="Clear conversation"><Trash2 size={15} /></button> : null}
              <button className="btn-ghost p-1.5" onClick={() => setOpen(false)} aria-label="Close Coach"><X size={17} /></button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
              {st && !st.configured ? (
                <div className="rounded-xl border border-ink-700 p-4">
                  <div className="font-medium">Set up the Coach</div>
                  <p className="mt-1 text-fog-300">The Coach uses Claude through the Anthropic API. You need your own API key, which is pay-as-you-go and billed separately from a Claude subscription. Short chats on the Haiku model typically cost a fraction of a cent each.</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-fog-300">
                    <li>Create a key at console.anthropic.com → API keys.</li>
                    <li>Paste it in Settings → Coach. It stays on this Mac.</li>
                  </ol>
                  {path !== "/settings" && <Link href="/settings#coach" onClick={() => setOpen(false)} className="btn-primary mt-3 inline-flex">Open Settings</Link>}
                </div>
              ) : st && st.messages.length === 0 ? (
                <div>
                  <p className="text-fog-300">Ask anything about your plan, money, job search or week. I&apos;ll only use what&apos;s recorded in LIFE OS.</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {STARTERS.map((s) => (
                      <button key={s} className="rounded-lg border border-ink-700 px-3 py-2 text-left text-fog-300 hover:border-teal-500/50 hover:text-fog-100" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : (
                st?.messages.map((m, i) => (
                  <div key={m.id ?? `t${i}`} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={clsx("max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed", m.role === "user" ? "rounded-br-md bg-teal-500 text-ink-950" : "rounded-bl-md bg-ink-800 text-fog-100")}>
                      {m.role === "assistant" ? <Rich text={m.content} /> : <span className="whitespace-pre-wrap">{m.content}</span>}
                      {m.meta?.actions?.map((a, j) => (
                        <div key={j} className={clsx("mt-2 flex items-start gap-1.5 rounded-md px-2 py-1 text-xs", a.ok ? "bg-teal-500/10 text-teal-300" : "bg-rose-400/10 text-rose-300")}>
                          {a.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}{a.summary}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {busy && (
                <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md bg-ink-800 px-4 py-3"><span className="inline-flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-fog-400" style={{ animationDelay: `${d * 120}ms` }} />)}</span></div></div>
              )}
              {error && <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
              <div ref={endRef} />
            </div>

            {st?.configured && (
              <form className="border-t border-ink-700 p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    className="input max-h-32 min-h-[40px] resize-none"
                    placeholder="Ask the Coach…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    aria-label="Message"
                  />
                  <button className="btn-primary h-10 px-3" disabled={busy || !input.trim()} aria-label="Send"><Send size={16} /></button>
                </div>
                <p className="mt-1.5 text-[10px] text-fog-500">Your question and a summary of your LIFE OS data are sent to Anthropic to answer. Not financial or medical advice.</p>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
