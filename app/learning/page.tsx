"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Pencil, Award, Languages, GraduationCap, Wrench, BookOpen, Clock, ExternalLink, Lock, CheckCircle2, Play } from "lucide-react";
import { PageHeader, Card, Badge, Progress, Empty, Stat, PillarDot, Segmented, useToast, clsx } from "@/components/ui";
import { RecordForm, type Field } from "@/components/RecordForm";
import { BooksTab } from "@/components/BooksTab";
import { LearnHero, Quest, Trophies, Confetti, useLearnStats, logMinutes, type Target } from "@/components/LearnHero";
import { usePillars, PRIORITY_OPTIONS } from "@/components/shared";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { fmtDate, relativeDay, monthRange, diffDays } from "@/lib/dates";

type Tab = "overview" | "books" | "certification" | "language" | "growth";
const STATUS = [
  { value: "idea", label: "Idea" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done / earned" },
  { value: "dropped", label: "Dropped" },
];
const GATES = [
  { value: "now", label: "Start now (free or low cost)" },
  { value: "income", label: "After income is stable (paid)" },
  { value: "later", label: "Later" },
];
const KIND_META: Record<string, { label: string; icon: typeof Award }> = {
  certification: { label: "Certification", icon: Award },
  language: { label: "Language", icon: Languages },
  course: { label: "Course", icon: GraduationCap },
  skill: { label: "Life skill", icon: Wrench },
};
const CEFR = ["A0", "A1", "A2", "B1", "B2", "C1", "C2", "Native"].map((v) => ({ value: v, label: v }));
const statusTone = (s?: string) => (s === "in_progress" ? "teal" : s === "done" ? "blue" : s === "planned" ? "violet" : s === "paused" ? "amber" : "gray");

function fieldsFor(kind: string, pillarOpts: { value: number; label: string }[]): Field[] {
  const base: Field[] = [
    { name: "title", label: kind === "language" ? "Language" : "Title", required: true },
    { name: "provider", label: kind === "language" ? "How you'll learn" : "Provider", half: true },
    { name: "kind", label: "Type", type: "select", half: true, options: Object.entries(KIND_META).map(([v, m]) => ({ value: v, label: m.label })) },
    { name: "status", label: "Status", type: "select", options: STATUS, half: true },
    { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, half: true },
    { name: "gate", label: "When", type: "select", options: GATES, half: true },
    { name: "pillar_id", label: "Supports pillar", type: "select", options: pillarOpts, half: true },
  ];
  const lang: Field[] = [
    { name: "level_current", label: "Current level", type: "select", options: CEFR, half: true },
    { name: "level_target", label: "Target level", type: "select", options: CEFR, half: true },
  ];
  const cert: Field[] = [
    { name: "credential_id", label: "Credential / licence no.", half: true },
    { name: "expires", label: "Expires / renewal", type: "date", half: true },
  ];
  return [
    ...base,
    ...(kind === "language" ? lang : []),
    { name: "est_hours", label: "Estimated hours", type: "number", half: true, min: 0 },
    { name: "target_date", label: kind === "certification" ? "Target exam date" : "Target date", type: "date", half: true },
    { name: "cost_aed", label: "Cost (AED, if known)", type: "number", half: true, min: 0 },
    { name: "cost_note", label: "Cost note", half: true, placeholder: "e.g. free path, exam paid" },
    ...(kind === "certification" ? cert : []),
    { name: "completed_date", label: "Completed / earned on", type: "date", half: true },
    { name: "url", label: "Link", type: "url", half: true },
    { name: "why", label: "Why it matters", type: "textarea" },
    { name: "next_step", label: "Next step", placeholder: "The smallest next action" },
  ];
}

export default function LearningPage() {
  return (
    <Suspense>
      <Learning />
    </Suspense>
  );
}

function Learning() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "overview";
  const setTab = (t: Tab) => router.replace(`/learning?tab=${t}`, { scroll: false });
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const items = useList("learning_items");
  const log = useList("learning_log");
  const books = useList("books");
  const bookLog = useList("reading_log");
  const { byId, options: pillarOpts } = usePillars();
  const [form, setForm] = useState<Partial<Row> | null>(null);
  const [logFor, setLogFor] = useState<Row | null>(null);
  const { toast, node } = useToast();
  const [burst, setBurst] = useState(0);
  const ls = useLearnStats(today, log.rows, bookLog.rows, items.rows, books.rows);
  const targets = useMemo<Target[]>(() => {
    const out: Target[] = [];
    const b = books.rows.find((x) => x.status === "reading") ?? books.rows.find((x) => x.month === today.slice(0, 7) && x.status === "planned");
    if (b) out.push({ key: `book:${b.id}`, kind: "book", row: b, title: b.title });
    for (const i of items.rows) if (i.status === "in_progress") out.push({ key: `item:${i.id}`, kind: i.kind, row: i, title: i.title });
    return out;
  }, [books.rows, items.rows, today]);
  const celebrate = (t: Target, m: number) => { setBurst((n) => n + 1); toast(`+${m} XP · ${t.title}`); };
  const finishSession = async (t: Target, m: number) => { await logMinutes(t, m, today); celebrate(t, m); };

  const [mStart, mEnd] = monthRange(today);
  const stats = useMemo(() => {
    const minutes = log.rows.filter((l) => l.date >= mStart && l.date <= mEnd).reduce((s, l) => s + (l.minutes ?? 0), 0) + bookLog.rows.filter((l) => l.date >= mStart && l.date <= mEnd).reduce((s, l) => s + (l.minutes ?? 0), 0);
    const year = today.slice(0, 4);
    return {
      hoursMonth: Math.round((minutes / 60) * 10) / 10,
      active: items.rows.filter((i) => i.status === "in_progress").length + books.rows.filter((b) => b.status === "reading").length,
      doneYear: items.rows.filter((i) => i.status === "done" && (i.completed_date ?? "").startsWith(year)).length + books.rows.filter((b) => b.status === "finished" && (b.finished ?? "").startsWith(year)).length,
      earned: items.rows.filter((i) => i.kind === "certification" && i.status === "done").length,
    };
  }, [log.rows, bookLog.rows, items.rows, books.rows, mStart, mEnd, today]);

  const newItem = (kind: string) => setForm({ kind, status: "planned", priority: 2, gate: "now", hours_logged: 0, source: "user", ...(kind === "language" ? { level_current: "A0", level_target: "B1" } : {}) });

  return (
    <div>
      <PageHeader
        title="Learn"
        subtitle="Show up for 25 minutes. Streaks, levels and trophies do the rest."
        actions={
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            size="sm"
            options={[
              { value: "overview", label: "Overview" },
              { value: "books", label: "Books" },
              { value: "certification", label: "Certifications" },
              { value: "language", label: "Languages" },
              { value: "growth", label: "Skills & courses" },
            ]}
          />
        }
      />

      {tab !== "books" && tab !== "overview" && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card card-pad"><Stat label="Learning hours this month" value={stats.hoursMonth} hint="Logged minutes, all items and books" /></div>
          <div className="card card-pad"><Stat label="In progress" value={stats.active} /></div>
          <div className="card card-pad"><Stat label={`Completed in ${today.slice(0, 4)}`} value={stats.doneYear} /></div>
          <div className="card card-pad"><Stat label="Certifications held" value={stats.earned} hint="Add any you already have" /></div>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-5">
          <LearnHero s={ls} targets={targets} onDone={finishSession} />
          <section>
            <div className="mb-2 flex items-center justify-between"><h2 className="h-section">Your quests</h2><span className="text-xs muted">Tap +10 or +25 right after you study</span></div>
            {targets.length === 0 ? <Empty>Start a book or one learning item below. It becomes a quest here.</Empty> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{targets.map((t) => <Quest key={t.key} t={t} today={today} onLogged={celebrate} />)}</div>
            )}
          </section>
          <Trophies s={ls} items={items.rows} books={books.rows} />
          <Overview items={items.rows} books={books.rows} today={today} byId={byId} onOpen={setForm} onLog={setLogFor} goTab={setTab} />
        </div>
      )}
      {tab === "books" && <BooksTab />}
      {tab === "certification" && <ItemList kind={["certification"]} title="Certifications" items={items.rows} byId={byId} today={today} onOpen={setForm} onLog={setLogFor} onAdd={() => newItem("certification")} emptyText="Add certifications you hold and the ones you want." />}
      {tab === "language" && <ItemList kind={["language"]} title="Languages" items={items.rows} byId={byId} today={today} onOpen={setForm} onLog={setLogFor} onAdd={() => newItem("language")} emptyText="Add languages you speak and the ones you're learning." />}
      {tab === "growth" && <ItemList kind={["course", "skill"]} title="Skills & courses" items={items.rows} byId={byId} today={today} onOpen={setForm} onLog={setLogFor} onAdd={() => newItem("skill")} emptyText="Anything that improves your life: courses, practical skills, health, money." />}

      {form && (
        <RecordForm
          table="learning_items"
          open
          onClose={() => setForm(null)}
          title={form.id ? `Edit ${KIND_META[form.kind as string]?.label.toLowerCase() ?? "item"}` : `Add ${KIND_META[form.kind as string]?.label.toLowerCase() ?? "item"}`}
          fields={fieldsFor(String(form.kind ?? "skill"), pillarOpts)}
          initial={form}
          allowArchive
          transform={(v) => ({ ...v, completed_date: v.status === "done" ? (v.completed_date || today) : v.completed_date, start_date: v.status === "in_progress" && !form.start_date ? today : form.start_date })}
        />
      )}
      <RecordForm
        table="learning_log"
        open={!!logFor}
        onClose={() => setLogFor(null)}
        title={logFor ? `Log time: ${logFor.title}` : ""}
        initial={logFor ? { item_id: logFor.id, date: today, minutes: 25 } : null}
        allowDelete={false}
        fields={[
          { name: "minutes", label: "Minutes", type: "number", required: true, half: true, min: 1 },
          { name: "date", label: "Date", type: "date", required: true, half: true },
          { name: "note", label: "What you covered (optional)" },
        ]}
        onSaved={async (row) => {
          if (!logFor) return;
          await api.update("learning_items", logFor.id, {
            hours_logged: Math.round(((logFor.hours_logged ?? 0) + (row.minutes ?? 0) / 60) * 100) / 100,
            ...(["idea", "planned", "paused"].includes(logFor.status) ? { status: "in_progress", start_date: logFor.start_date ?? today } : {}),
          });
          toast(`Logged ${row.minutes} min on ${logFor.title}`);
        }}
      />
      {node}
      <Confetti k={burst} />
    </div>
  );
}

type ListProps = { items: Row[]; byId: Map<number, Row>; today: string; onOpen: (r: Row) => void; onLog: (r: Row) => void };

function ItemCard({ i, byId, today, onOpen, onLog, compact }: ListProps & { i: Row; compact?: boolean }) {
  const meta = KIND_META[i.kind] ?? KIND_META.skill;
  const Icon = meta.icon;
  const pillar = byId.get(i.pillar_id);
  const pct = i.est_hours ? Math.min(100, Math.round(((i.hours_logged ?? 0) / i.est_hours) * 100)) : null;
  const locked = i.gate === "income" && i.status !== "done" && i.status !== "in_progress";
  const expiresSoon = i.expires && diffDays(today, i.expires) <= 90;
  return (
    <div className={clsx("card card-pad fade-up flex flex-col", i.status === "done" && "opacity-90")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] muted">
        <Icon size={13} className="text-fog-400" />{meta.label}
        {pillar && <><span>·</span><PillarDot color={pillar.color} />{pillar.name}</>}
        <span className="flex-1" />
        <Badge tone={statusTone(i.status)}>{STATUS.find((s) => s.value === i.status)?.label ?? i.status}</Badge>
        {i.priority === 1 && i.status !== "done" && <Badge tone="teal">P1</Badge>}
        <button className="btn-ghost p-1" aria-label={`Edit ${i.title}`} onClick={() => onOpen(i)}><Pencil size={12} /></button>
      </div>
      <div className="font-semibold leading-snug">{i.title}</div>
      {i.provider && <div className="text-xs muted">{i.provider}</div>}
      {i.kind === "language" && (i.level_current || i.level_target) && (
        <div className="mt-2 flex items-center gap-2 text-xs"><Badge>{i.level_current ?? "?"}</Badge><span className="muted">→</span><Badge tone="teal">{i.level_target ?? "?"}</Badge></div>
      )}
      {!compact && i.why && <p className="mt-2 text-sm text-fog-300">{i.why}</p>}
      {i.status !== "done" && i.next_step && <p className="mt-2 text-xs"><span className="text-fog-500">Next: </span>{i.next_step}</p>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] muted">
        {locked && <span className="inline-flex items-center gap-1 text-amber-300"><Lock size={11} />After income is stable</span>}
        {i.gate === "now" && i.status !== "done" && <span className="text-teal-300">Free or low cost to start</span>}
        {(i.cost_aed || i.cost_note) && <span>{i.cost_aed ? `AED ${Number(i.cost_aed).toLocaleString()}` : ""}{i.cost_aed && i.cost_note ? " · " : ""}{i.cost_note ?? ""}</span>}
        {i.target_date && i.status !== "done" && <span className={clsx(i.target_date < today && "text-amber-300")}>Target {relativeDay(i.target_date, today)}</span>}
        {i.status === "done" && i.completed_date && <span className="inline-flex items-center gap-1"><CheckCircle2 size={11} className="text-teal-400" />{fmtDate(i.completed_date)}</span>}
        {i.expires && <span className={clsx(expiresSoon && "text-amber-300")}>Renew by {fmtDate(i.expires)}</span>}
        {i.url && <a href={i.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-fog-100"><ExternalLink size={11} />Official site</a>}
      </div>
      {i.status !== "done" && (
        <div className="mt-auto pt-3">
          {pct !== null && (
            <>
              <div className="mb-1 flex justify-between text-[11px] muted"><span>{Math.round((i.hours_logged ?? 0) * 10) / 10} of ~{i.est_hours} h</span><span>{pct}%</span></div>
              <Progress value={pct} color={pillar?.color} />
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onLog(i)}><Clock size={12} />Log time</button>
            {["idea", "planned", "paused"].includes(i.status) && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => api.update("learning_items", i.id, { status: "in_progress", start_date: i.start_date ?? today })}><Play size={12} />Start</button>}
            {i.status === "in_progress" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => api.update("learning_items", i.id, { status: "done", completed_date: today })}><CheckCircle2 size={12} />{i.kind === "certification" ? "Earned" : "Done"}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemList({ kind, title, items, onAdd, emptyText, ...rest }: ListProps & { kind: string[]; title: string; onAdd: () => void; emptyText: string }) {
  const [showDone, setShowDone] = useState(true);
  const mine = items.filter((i) => kind.includes(i.kind) && i.status !== "dropped");
  const held = mine.filter((i) => i.status === "done");
  const open = mine.filter((i) => i.status !== "done");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="h-section">{title}</h2>
        <button className="btn-primary" onClick={onAdd}><Plus size={15} /> Add</button>
      </div>
      {mine.length === 0 ? <Empty>{emptyText}</Empty> : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{open.map((i) => <ItemCard key={i.id} i={i} items={items} {...rest} />)}</div>
          {held.length > 0 && (
            <div>
              <button className="mb-2 text-xs text-fog-400 hover:text-fog-100" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : "Show"} {kind.includes("certification") ? "held" : kind.includes("language") ? "spoken" : "completed"} ({held.length})</button>
              {showDone && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{held.map((i) => <ItemCard key={i.id} i={i} items={items} compact {...rest} />)}</div>}
            </div>
          )}
        </>
      )}
      {kind.includes("certification") && <p className="text-[11px] text-fog-500">Fees, eligibility rules and exam formats change. Check the official site before paying. Your full certifications list from your CV isn&apos;t stored here yet; add each one as Done / earned.</p>}
    </div>
  );
}

function Overview({ items, books, today, byId, onOpen, onLog, goTab }: ListProps & { books: Row[]; goTab: (t: Tab) => void }) {
  const active = items.filter((i) => i.status === "in_progress");
  const nowFree = items.filter((i) => i.gate === "now" && ["planned", "idea"].includes(i.status)).sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
  const afterIncome = items.filter((i) => i.gate === "income" && !["done", "dropped", "in_progress"].includes(i.status)).sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
  const book = books.find((b) => b.status === "reading") ?? books.find((b) => b.month === today.slice(0, 7));
  const upcoming = items.filter((i) => (i.target_date && i.status !== "done" && i.target_date >= today) || (i.expires && diffDays(today, i.expires) <= 120)).sort((a, b) => (a.target_date ?? a.expires).localeCompare(b.target_date ?? b.expires));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Start now: free or low cost">
          {nowFree.length === 0 ? <p className="text-sm muted">Nothing waiting.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">{nowFree.slice(0, 6).map((i) => <ItemCard key={i.id} i={i} items={items} byId={byId} today={today} onOpen={onOpen} onLog={onLog} compact />)}</div>
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="After income is stable">
          {afterIncome.length === 0 ? <p className="text-sm muted">None.</p> : (
            <ul className="space-y-2 text-sm">
              {afterIncome.map((i) => (
                <li key={i.id}><button className="flex w-full items-center gap-2 text-left hover:text-teal-200" onClick={() => onOpen(i)}><Lock size={13} className="shrink-0 text-amber-300" /><span className="min-w-0 flex-1 truncate">{i.title}</span>{i.priority === 1 && <Badge tone="teal">P1</Badge>}</button></li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-fog-500">Paid exams wait so they don&apos;t compete with rent, visa or debt payments. Prepare with free material now so you&apos;re ready to book.</p>
        </Card>
        <Card title="Dates">
          {upcoming.length === 0 ? <p className="text-sm muted">No exam dates or renewals set.</p> : (
            <ul className="space-y-2 text-sm">{upcoming.slice(0, 6).map((i) => <li key={i.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{i.title}</span><Badge>{i.target_date && i.status !== "done" ? relativeDay(i.target_date, today) : `Renew ${fmtDate(i.expires)}`}</Badge></li>)}</ul>
          )}
        </Card>
        <Card title="Add">
          <div className="grid grid-cols-2 gap-2">
            {(["certification", "language", "course", "skill"] as const).map((k) => {
              const M = KIND_META[k];
              return <button key={k} className="btn-outline text-xs" onClick={() => onOpen({ kind: k, status: "planned", priority: 2, gate: "now", hours_logged: 0, source: "user" } as unknown as Row)}><M.icon size={13} />{M.label}</button>;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
