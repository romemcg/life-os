"use client";
import { useMemo, useState } from "react";
import { BookOpen, GraduationCap, Repeat } from "lucide-react";
import { useList, api, type Row } from "@/lib/client";

/**
 * A task can feed a tracker: log_to = "book:current" | "book:<id>" | "learning:<id>" | "habit:<id>".
 * Ticking the task in Today then asks for the details (pages, minutes, note) and saves them there.
 */
export function useTrackOptions() {
  const books = useList("books");
  const items = useList("learning_items");
  const habits = useList("habits", { active: true });
  return useMemo(() => {
    const KIND: Record<string, string> = { certification: "Certification", language: "Language", course: "Course", skill: "Life skill" };
    const opts: { value: string; label: string }[] = [
      { value: "book:current", label: "Book · whichever book I'm reading" },
      { value: "bible", label: "Bible reading (Morning plan)" },
      { value: "meditation", label: "Meditation (Morning timer)" },
    ];
    for (const b of books.rows.filter((b) => !["finished", "abandoned"].includes(b.status))) opts.push({ value: `book:${b.id}`, label: `Book · ${b.title}` });
    for (const i of items.rows.filter((i) => !["done", "dropped"].includes(i.status))) opts.push({ value: `learning:${i.id}`, label: `${KIND[i.kind as string] ?? "Learning"} · ${i.title}` });
    return { opts, books: books.rows, items: items.rows, habits: habits.rows };
  }, [books.rows, items.rows, habits.rows]);
}

export function resolveTarget(logTo: string | null | undefined, src: { books: Row[]; items: Row[]; habits: Row[] }) {
  if (!logTo) return null;
  const [kind, ref] = logTo.split(":");
  if (kind === "book") {
    const b = ref === "current" ? src.books.find((x) => x.status === "reading") ?? src.books.find((x) => x.status === "planned") : src.books.find((x) => x.id === Number(ref));
    return b ? { kind: "book" as const, row: b, label: b.title as string } : { kind: "book" as const, row: null, label: "your current book" };
  }
  if (kind === "learning") {
    const i = src.items.find((x) => x.id === Number(ref));
    return i ? { kind: "learning" as const, row: i, label: i.title as string } : null;
  }
  if (kind === "bible") return { kind: "bible" as const, row: null, label: "Bible reading" };
  if (kind === "meditation") return { kind: "meditation" as const, row: null, label: "Meditation" };
  if (kind === "habit") {
    const h = src.habits.find((x) => x.id === Number(ref));
    return h ? { kind: "habit" as const, row: h, label: h.name as string } : null;
  }
  return null;
}

/** Small label under a task: where its log goes. */
export function TrackChip({ task }: { task: Row }) {
  const src = useTrackOptions();
  const t = resolveTarget(task.log_to as string, src);
  if (!t) return null;
  const Icon = t.kind === "book" ? BookOpen : t.kind === "learning" ? GraduationCap : Repeat;
  if (t.kind === "habit") return null; // internal link that keeps old habit history in sync
  return <span className="inline-flex items-center gap-1 text-teal-300/90"><Icon size={11} />Logs to {t.label}</span>;
}

/** Called right after a linked task is ticked. Habits are checked automatically; books and learning ask for details. */
export async function autoLog(task: Row, today: string, src: { books: Row[]; items: Row[]; habits: Row[] }) {
  const t = resolveTarget(task.log_to as string, src);
  if (!t || t.kind === "habit") return { prompt: false, message: "" };
  if (t.kind === "bible") return { prompt: false, message: "Ticked. Open Morning to read and log today's chapter." };
  if (t.kind === "meditation") return { prompt: false, message: "Ticked. Morning has the guided timer if you want it." };
  return { prompt: !!t && !!t.row, message: t && !t.row ? "No book is marked as reading, so nothing was logged. Pick one in Learning." : "" };
}

export function LogPrompt({ task, today, onDone }: { task: Row; today: string; onDone: (msg?: string) => void }) {
  const src = useTrackOptions();
  const t = resolveTarget(task.log_to as string, src);
  const [page, setPage] = useState("");
  const [minutes, setMinutes] = useState(String(task.duration_min ?? ""));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  if (!t || !t.row) return null;
  const b = t.row;
  const cur = (b.current_page as number) ?? 0;
  const total = b.pages_total as number | null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const mins = minutes ? Number(minutes) : null;
    if (t!.kind === "book") {
      const p = page ? Number(page) : null;
      if (p != null && (!Number.isFinite(p) || p <= cur)) return setErr(`Enter the page you reached (more than ${cur}).`);
      if (p != null && total && p > total) return setErr(`This book has ${total} pages.`);
      await api.create("reading_log", { book_id: b.id, date: today, pages: p != null ? p - cur : null, minutes: mins, note: note || null });
      await api.update("books", b.id, { ...(p != null ? { current_page: p } : {}), status: total && p != null && p >= total ? "finished" : "reading", started: b.started ?? today, ...(total && p != null && p >= total ? { finished: today } : {}) });
      onDone(p != null ? `Logged ${p - cur} pages of ${b.title}` : `Logged reading time for ${b.title}`);
    } else {
      await api.create("learning_log", { item_id: b.id, date: today, minutes: mins, note: note || null });
      if (b.status === "planned" || b.status === "idea") await api.update("learning_items", b.id, { status: "in_progress" });
      onDone(`Logged ${mins ?? 0} min on ${b.title}`);
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-teal-500/40 bg-teal-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm">
        {t.kind === "book" ? <BookOpen size={15} className="text-teal-300" /> : <GraduationCap size={15} className="text-teal-300" />}
        <span>Log <span className="font-medium">{task.title}</span> to <span className="font-medium">{t.label}</span></span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {t.kind === "book" && (
          <label className="text-[11px] muted">Page reached{total ? ` (of ${total})` : ""}
            <input className="input mt-0.5 w-28" inputMode="numeric" placeholder={`> ${cur}`} value={page} onChange={(e) => setPage(e.target.value)} />
          </label>
        )}
        <label className="text-[11px] muted">Minutes
          <input className="input mt-0.5 w-20" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="min-w-[10rem] flex-1 text-[11px] muted">Note (optional)
          <input className="input mt-0.5" placeholder={t.kind === "book" ? "One idea worth keeping" : "What you covered"} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="btn-primary">Save</button>
        <button type="button" className="btn-ghost" onClick={() => onDone()}>Skip</button>
      </div>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
    </form>
  );
}
