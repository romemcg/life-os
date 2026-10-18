"use client";
import { useMemo, useState } from "react";
import { Plus, Pencil, BookOpen, CheckCircle2, Star, BookMarked } from "lucide-react";
import { Card, Badge, Progress, Empty, Stat, PillarDot, useToast, clsx } from "@/components/ui";
import { RecordForm, type Field } from "@/components/RecordForm";
import { usePillars } from "@/components/shared";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { addMonths, diffDays, fmtDate, fmtMonth, monthRange } from "@/lib/dates";

const STATUS = [
  { value: "planned", label: "Planned" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "abandoned", label: "Set aside" },
];
const tone = (s?: string) => (s === "reading" ? "teal" : s === "finished" ? "blue" : s === "abandoned" ? "gray" : "violet");

export function BooksTab() {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const books = useList("books");
  const log = useList("reading_log");
  const habits = useList("habits");
  const { byId, options: pillarOpts } = usePillars();
  const [form, setForm] = useState<Partial<Row> | null>(null);
  const [finishing, setFinishing] = useState<Row | null>(null);
  const { toast, node } = useToast();

  const month = today.slice(0, 7);
  const [mStart, mEnd] = monthRange(today);
  const current = books.rows.find((b) => b.status === "reading") ?? books.rows.find((b) => b.month === month && b.status === "planned");

  // 12-month shelf starting from the plan start month
  const startMonth = (settings.start_date || today).slice(0, 7) + "-01";
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startMonth, i).slice(0, 7));

  const stats = useMemo(() => {
    const thisMonth = log.rows.filter((l) => l.date >= mStart && l.date <= mEnd);
    const year = today.slice(0, 4);
    return {
      pages: thisMonth.reduce((s, l) => s + (l.pages ?? 0), 0),
      minutes: thisMonth.reduce((s, l) => s + (l.minutes ?? 0), 0),
      days: new Set(thisMonth.map((l) => l.date)).size,
      finishedYear: books.rows.filter((b) => b.status === "finished" && (b.finished ?? "").startsWith(year)).length,
      finishedAll: books.rows.filter((b) => b.status === "finished").length,
    };
  }, [log.rows, books.rows, mStart, mEnd, today]);

  const FIELDS: Field[] = [
    { name: "title", label: "Title", required: true, half: true },
    { name: "author", label: "Author", half: true },
    { name: "month", label: "Month slot", type: "select", half: true, options: months.map((m) => ({ value: m, label: fmtMonth(m + "-01") })), help: "One book per month." },
    { name: "status", label: "Status", type: "select", options: STATUS, half: true },
    { name: "pages_total", label: "Total pages", type: "number", half: true, min: 1, help: "Check your copy; used to pace the month." },
    { name: "current_page", label: "Current page", type: "number", half: true, min: 0 },
    { name: "pillar_id", label: "Supports pillar", type: "select", options: pillarOpts },
    { name: "why", label: "Why this book now", type: "textarea" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm muted">One book a month, read with intent and remembered through your own takeaways.</p>
        <button className="btn-primary" onClick={() => setForm({ status: "planned", month: months.find((m) => !books.rows.some((b) => b.month === m && b.status !== "abandoned")) ?? month, source: "user" })}><Plus size={15} /> Book</button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card card-pad"><Stat label="Pages this month" value={stats.pages} /></div>
        <div className="card card-pad"><Stat label="Reading days this month" value={stats.days} hint={stats.minutes ? `${stats.minutes} min logged` : undefined} /></div>
        <div className="card card-pad"><Stat label={`Finished in ${today.slice(0, 4)}`} value={stats.finishedYear} /></div>
        <div className="card card-pad"><Stat label="Finished in total" value={stats.finishedAll} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {current ? (
            <CurrentBook b={current} today={today} log={log.rows.filter((l) => l.book_id === current.id)} pillar={byId.get(current.pillar_id)} readHabit={habits.rows.find((h) => /read/i.test(h.name) && h.active)} onEdit={() => setForm(current)} onFinish={() => setFinishing(current)} toast={toast} />
          ) : (
            <Empty action={<button className="btn-outline" onClick={() => setForm({ status: "reading", month, started: today, source: "user" })}>Choose this month&apos;s book</button>}>No book for {fmtMonth(today)} yet.</Empty>
          )}

          <Card title="12-month shelf">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {months.map((m) => {
                const b = books.rows.find((x) => x.month === m && x.status !== "abandoned") ?? books.rows.find((x) => x.month === m);
                const isNow = m === month;
                const past = m < month;
                return (
                  <button
                    key={m}
                    onClick={() => setForm(b ?? { month: m, status: "planned", source: "user" })}
                    className={clsx("flex min-h-[112px] flex-col rounded-lg border p-2.5 text-left transition-colors hover:border-ink-600", isNow ? "border-teal-500/50 bg-teal-500/5" : "border-ink-700")}
                  >
                    <div className="flex items-center justify-between text-[11px]"><span className={clsx("font-medium", isNow ? "text-teal-300" : "muted")}>{fmtMonth(m + "-01")}</span>{b && <Badge tone={tone(b.status)}>{STATUS.find((s) => s.value === b.status)?.label}</Badge>}</div>
                    {b ? (
                      <>
                        <div className={clsx("mt-1.5 text-sm font-medium leading-snug", b.status === "abandoned" && "line-through muted")}>{b.title}</div>
                        <div className="text-[11px] muted">{b.author}</div>
                        {b.pages_total ? <Progress className="mt-auto" value={((b.current_page ?? 0) / b.pages_total) * 100} color={byId.get(b.pillar_id)?.color} /> : null}
                        {b.status === "finished" && b.rating ? <div className="mt-1 flex text-amber-300">{Array.from({ length: b.rating }, (_, i) => <Star key={i} size={11} fill="currentColor" />)}</div> : null}
                      </>
                    ) : (
                      <div className="mt-2 text-xs muted">{past ? "No book" : "Pick a book"}</div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-fog-500">Suggested books are a starting point, chosen to match your current priorities. Swap any of them. Library, e-book or second-hand copies keep this free or cheap.</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Takeaways library">
            {books.rows.filter((b) => b.status === "finished").length === 0 ? <p className="text-sm muted">When you finish a book, write 3 takeaways. They collect here so the reading stays with you.</p> : (
              <ul className="space-y-3">
                {books.rows.filter((b) => b.status === "finished").sort((a, b) => (b.finished ?? "").localeCompare(a.finished ?? "")).map((b) => (
                  <li key={b.id}>
                    <div className="flex items-center gap-1.5 text-sm font-medium"><BookMarked size={13} className="text-teal-400" />{b.title}</div>
                    <div className="text-[11px] muted">{b.finished ? fmtDate(b.finished) : ""}</div>
                    {b.takeaways && <p className="mt-1 whitespace-pre-wrap text-xs text-fog-300">{b.takeaways}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="How to make it stick">
            <ul className="space-y-1.5 text-sm text-fog-300">
              <li>About 10 pages a day finishes most books in a month.</li>
              <li>Read at the same time daily, e.g. before bed instead of the phone.</li>
              <li>Note one idea per session; it makes the takeaways easy.</li>
              <li>It&apos;s fine to set a book aside if it isn&apos;t serving you. Pick the next one.</li>
            </ul>
          </Card>
        </div>
      </div>

      <RecordForm
        table="books"
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit book" : "Add a book"}
        fields={FIELDS}
        initial={form}
        transform={(v) => ({ ...v, started: v.status === "reading" && !form?.started ? today : form?.started, finished: v.status === "finished" ? (form?.finished ?? today) : null })}
      />
      <RecordForm
        table="books"
        open={!!finishing}
        onClose={() => setFinishing(null)}
        title={finishing ? `Finished: ${finishing.title}` : ""}
        initial={finishing ? { ...finishing } : null}
        fields={[
          { name: "rating", label: "Rating (1 to 5)", type: "number", min: 1, max: 5, half: true },
          { name: "takeaways", label: "Your 3 takeaways", type: "textarea", placeholder: "1. …\n2. …\n3. …" },
        ]}
        allowDelete={false}
        transform={(v) => ({ ...v, status: "finished", finished: today, current_page: finishing?.pages_total ?? finishing?.current_page })}
        onSaved={() => toast("Nice. Book finished and takeaways saved.")}
      />
      {node}
    </div>
  );
}

function CurrentBook({ b, today, log, pillar, readHabit, onEdit, onFinish, toast }: { b: Row; today: string; log: Row[]; pillar?: Row; readHabit?: Row; onEdit: () => void; onFinish: () => void; toast: (s: string, t?: "ok" | "err") => void }) {
  const [page, setPage] = useState("");
  const [minutes, setMinutes] = useState("");
  const [, mEnd] = monthRange(today);
  const total = b.pages_total as number | null;
  const cur = (b.current_page as number) ?? 0;
  const left = total ? Math.max(0, total - cur) : null;
  const daysLeft = diffDays(today, mEnd) + 1;
  const pace = left != null ? Math.ceil(left / Math.max(1, daysLeft)) : null;
  const readToday = log.filter((l) => l.date === today).reduce((s, l) => s + (l.pages ?? 0), 0);

  async function logReading(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(page);
    if (!Number.isFinite(p) || p <= cur) return toast(`Enter the page you reached (more than ${cur}).`, "err");
    if (total && p > total) return toast(`This book has ${total} pages.`, "err");
    await api.create("reading_log", { book_id: b.id, date: today, pages: p - cur, minutes: minutes ? Number(minutes) : null });
    await api.update("books", b.id, { current_page: p, status: "reading", started: b.started ?? today });
    // counts toward the reading habit, once per day
    if (readHabit) {
      const existing = await api.list("habit_checkins", { habit_id: readHabit.id, date: today });
      if (!existing.length) await api.create("habit_checkins", { habit_id: readHabit.id, date: today, value: 1 });
    }
    setPage("");
    setMinutes("");
    toast(`Logged ${p - cur} pages${readHabit ? " and checked your reading habit" : ""}`);
    if (total && p >= total) onFinish();
  }

  return (
    <Card title={b.status === "reading" ? "Reading now" : `${fmtMonth(today)}'s book`} action={<button className="btn-ghost p-1" aria-label="Edit book" onClick={onEdit}><Pencil size={14} /></button>}>
      <div className="flex gap-4">
        <div className="hidden h-28 w-20 shrink-0 flex-col justify-end rounded-md p-2 sm:flex" style={{ background: `linear-gradient(160deg, ${pillar?.color ?? "#4fb8ab"}, #156e66)` }}>
          <BookOpen size={18} className="text-white/80" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight">{b.title}</div>
          <div className="text-sm muted">{b.author}</div>
          {pillar && <div className="mt-1 flex items-center gap-1.5 text-[11px] muted"><PillarDot color={pillar.color} />{pillar.name}</div>}
          {b.why && <p className="mt-2 text-sm text-fog-300">{b.why}</p>}
        </div>
      </div>

      {b.status === "planned" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => api.update("books", b.id, { status: "reading", started: today })}>Start reading</button>
          <span className="text-xs muted">Add the total pages (pencil) to get a daily pace.</span>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs"><span className="text-fog-300">{total ? `Page ${cur} of ${total}` : `Page ${cur}`}</span><span className="muted">{total ? `${Math.round((cur / total) * 100)}%` : <button className="underline" onClick={onEdit}>Add total pages</button>}</span></div>
            <Progress value={total ? (cur / total) * 100 : 0} color={pillar?.color} />
            {pace != null && left! > 0 && <p className="mt-2 text-xs muted">About <span className="font-semibold text-fog-100">{pace} pages a day</span> finishes it by {fmtDate(mEnd, { year: false })} ({daysLeft} day{daysLeft === 1 ? "" : "s"} left).{readToday ? ` ${readToday} read today.` : ""}</p>}
          </div>
          <form onSubmit={logReading} className="mt-3 flex flex-wrap items-end gap-2">
            <div><label className="label" htmlFor="rp">I&apos;m now on page</label><input id="rp" className="input w-28" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} placeholder={String(cur + 10)} /></div>
            <div><label className="label" htmlFor="rm">Minutes (optional)</label><input id="rm" className="input w-24" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
            <button className="btn-primary">Log reading</button>
            <button type="button" className="btn-ghost" onClick={onFinish}><CheckCircle2 size={14} /> Finished</button>
            <button type="button" className="btn-ghost text-xs" onClick={async () => { await api.update("books", b.id, { status: "abandoned" }); toast("Set aside. Pick the next book whenever you're ready."); }}>Set aside</button>
          </form>
        </>
      )}
    </Card>
  );
}
