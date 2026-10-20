"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Phone, MessageCircle, Users, Heart, CalendarHeart, Cake, Feather } from "lucide-react";
import { PageHeader, Card, Badge, Empty, Segmented, useToast, clsx } from "@/components/ui";
import { RecordForm, type Field } from "@/components/RecordForm";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { addDays, diffDays, fmtDate, relativeDay, weekRange, isISODate, agoDay } from "@/lib/dates";

const CIRCLES = [
  { value: "partner", label: "Partner" },
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "mentor", label: "Mentor" },
  { value: "community", label: "Community" },
  { value: "other", label: "Other" },
];
const KINDS: { value: string; label: string; icon: typeof Phone }[] = [
  { value: "call", label: "Call", icon: Phone },
  { value: "message", label: "Message", icon: MessageCircle },
  { value: "met", label: "Met up", icon: Users },
  { value: "quality_time", label: "Quality time", icon: Heart },
  { value: "plan", label: "Plan", icon: CalendarHeart },
  { value: "reflection", label: "Reflection", icon: Feather },
];
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;
const KindIcon = ({ k, size = 13 }: { k: string; size?: number }) => {
  const I = KINDS.find((x) => x.value === k)?.icon ?? Heart;
  return <I size={size} />;
};
const MEANINGFUL = ["call", "met", "quality_time", "message"];

/** Next occurrence of a birthday (stored as a full date; only month/day used). */
function nextBirthday(birthday: string, today: string): string | null {
  if (!isISODate(birthday)) return null;
  const [, m, d] = birthday.split("-");
  const y = Number(today.slice(0, 4));
  for (const yr of [y, y + 1]) {
    let iso = `${yr}-${m}-${d}`;
    if (!isISODate(iso)) iso = `${yr}-02-28`; // 29 Feb in non-leap years
    if (iso >= today) return iso;
  }
  return null;
}

const PERSON_FIELDS: Field[] = [
  { name: "name", label: "Name", required: true, half: true },
  { name: "circle", label: "Circle", type: "select", options: CIRCLES, half: true },
  { name: "rhythm_days", label: "Hope to be in touch every (days)", type: "number", half: true, min: 1, help: "A gentle nudge, not a deadline. Leave empty for none." },
  { name: "birthday", label: "Birthday", type: "date", half: true, help: "Only month and day are used." },
  { name: "location", label: "Where they are", half: true, placeholder: "e.g. Manila, Dubai" },
  { name: "what_matters", label: "What matters to them right now", type: "textarea", placeholder: "Their exams, a new job, a health worry… so you remember to ask" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export default function RelationshipsPage() {
  const { settings, save } = useSettings();
  const today = useToday(settings.timezone);
  const people = useList("people");
  const conns = useList("connections");
  const [pForm, setPForm] = useState<Partial<Row> | null>(null);
  const [cForm, setCForm] = useState<Partial<Row> | null>(null);
  const [tab, setTab] = useState<"people" | "moments" | "values">("people");
  const { toast, node } = useToast();

  const last = useMemo(() => {
    const m = new Map<number, Row>();
    for (const c of conns.rows) if (c.person_id && MEANINGFUL.includes(c.kind) && c.date <= today && !m.has(c.person_id)) m.set(c.person_id, c);
    return m;
  }, [conns.rows, today]);

  const [mon, sun] = weekRange(today);
  const thisWeek = conns.rows.filter((c) => c.date >= mon && c.date <= sun && MEANINGFUL.includes(c.kind));
  const plans = conns.rows.filter((c) => c.kind === "plan" && c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const birthdays = people.rows
    .map((p) => ({ p, next: p.birthday ? nextBirthday(p.birthday, today) : null }))
    .filter((x) => x.next && diffDays(today, x.next) <= 30)
    .sort((a, b) => a.next!.localeCompare(b.next!));
  const nudges = people.rows
    .filter((p) => p.rhythm_days)
    .map((p) => {
      const l = last.get(p.id);
      const since = l ? diffDays(l.date, today) : null;
      return { p, since, due: since === null || since >= (p.rhythm_days as number) };
    })
    .filter((x) => x.due)
    .sort((a, b) => (b.since ?? 9999) - (a.since ?? 9999));

  async function quickLog(person: Row, kind: string) {
    await api.create("connections", { person_id: person.id, date: today, kind });
    toast(`${kindLabel(kind)} with ${person.name} logged`);
  }

  const grouped = CIRCLES.map((c) => ({ ...c, people: people.rows.filter((p) => (p.circle || "other") === c.value) })).filter((g) => g.people.length);

  return (
    <div>
      <PageHeader
        title="Relationships"
        subtitle="People, not metrics. Gentle reminders to stay close, with no scores and no deadlines on love."
        actions={
          <>
            <Segmented value={tab} onChange={setTab} options={[{ value: "people", label: "People" }, { value: "moments", label: "Moments" }, { value: "values", label: "Values" }]} />
            {tab === "people" && <button className="btn-primary" onClick={() => setPForm({ circle: "family" })}><Plus size={15} /> Person</button>}
            {tab === "moments" && <button className="btn-primary" onClick={() => setCForm({ date: today, kind: "call" })}><Plus size={15} /> Moment</button>}
          </>
        }
      />

      {tab === "people" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {people.rows.length === 0 && !people.loading && (
              <Empty action={<button className="btn-outline" onClick={() => setPForm({ circle: "family" })}>Add someone</button>}>
                Start with the 3 to 5 people you most want to stay close to. Add how often you&apos;d like to be in touch, and what&apos;s going on in their life so you remember to ask.
              </Empty>
            )}
            {grouped.map((g) => (
              <Card key={g.value} title={g.label}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.people.map((p) => {
                    const l = last.get(p.id);
                    const since = l ? diffDays(l.date, today) : null;
                    const nb = p.birthday ? nextBirthday(p.birthday, today) : null;
                    const nudge = p.rhythm_days && (since === null || since >= p.rhythm_days);
                    return (
                      <div key={p.id} className="rounded-lg border border-ink-700 p-3">
                        <div className="flex items-start gap-2">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-800 text-xs font-semibold text-fog-300">{String(p.name).slice(0, 1).toUpperCase()}</div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{p.name}</div>
                            <div className="text-[11px] muted">
                              {l ? `${kindLabel(l.kind)} ${agoDay(l.date, today)}` : "No contact logged yet"}
                              {p.location ? ` · ${p.location}` : ""}
                            </div>
                          </div>
                          <button className="btn-ghost p-1" aria-label={`Edit ${p.name}`} onClick={() => setPForm(p)}><Pencil size={12} /></button>
                        </div>
                        {p.what_matters && <p className="mt-2 text-xs text-fog-300">Ask about: {p.what_matters}</p>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {nudge && <Badge tone="amber">{since === null ? "Reach out when you can" : `It's been ${since} days`}</Badge>}
                          {nb && diffDays(today, nb) <= 30 && <Badge tone="violet"><Cake size={11} />{relativeDay(nb, today)}</Badge>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(["call", "message", "met"] as const).map((k) => (
                            <button key={k} className="btn-ghost px-2 py-1 text-xs" onClick={() => quickLog(p, k)} title={`Log a ${kindLabel(k).toLowerCase()} today`}><KindIcon k={k} size={12} />{kindLabel(k)}</button>
                          ))}
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setCForm({ person_id: p.id, date: today, kind: "quality_time" })}><Plus size={12} />More</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Card title="This week">
              <div className="text-sm text-fog-300">{thisWeek.length ? `${thisWeek.length} meaningful connection${thisWeek.length === 1 ? "" : "s"} logged.` : "No connections logged yet this week."}</div>
              <p className="mt-1 text-[11px] text-fog-500">Not a score. One real conversation beats ten checked boxes.</p>
            </Card>
            <Card title="Might be nice to reach out">
              {nudges.length === 0 ? <p className="text-sm muted">{people.rows.some((p) => p.rhythm_days) ? "You're in touch with everyone at the rhythm you hoped for." : "Set a rhythm on someone to get gentle nudges here."}</p> : (
                <ul className="space-y-2">
                  {nudges.slice(0, 6).map(({ p, since }) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-[11px] muted">{since === null ? "not yet" : `${since}d`}</span>
                      <button className="btn-ghost px-1.5 py-0.5 text-xs" onClick={() => quickLog(p, "message")}><MessageCircle size={12} />Done</button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Coming up">
              {birthdays.length === 0 && plans.length === 0 ? <p className="text-sm muted">No birthdays in the next 30 days and no plans yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {birthdays.map(({ p, next }) => <li key={`b${p.id}`} className="flex items-center gap-2"><Cake size={14} className="text-fog-400" /><span className="flex-1">{p.name}&apos;s birthday</span><Badge tone="violet">{relativeDay(next!, today)}</Badge></li>)}
                  {plans.map((c) => <li key={c.id} className="flex items-center gap-2"><CalendarHeart size={14} className="text-teal-300" /><span className="min-w-0 flex-1 truncate">{c.note || "Plan"}{c.person_id ? ` · ${people.rows.find((p) => p.id === c.person_id)?.name ?? ""}` : ""}</span><Badge>{relativeDay(c.date, today)}</Badge></li>)}
                </ul>
              )}
              <button className="mt-3 btn-outline w-full text-xs" onClick={() => setCForm({ date: addDays(today, 3), kind: "plan" })}><CalendarHeart size={13} /> Make a plan</button>
            </Card>
          </div>
        </div>
      )}

      {tab === "moments" && <Moments conns={conns.rows} people={people.rows} today={today} onEdit={setCForm} />}
      {tab === "values" && <Values settings={settings} save={save} toast={toast} />}

      <RecordForm table="people" open={!!pForm} onClose={() => setPForm(null)} title={pForm?.id ? `Edit ${pForm.name}` : "Add someone"} fields={PERSON_FIELDS} initial={pForm} />
      <RecordForm
        table="connections"
        open={!!cForm}
        onClose={() => setCForm(null)}
        title={cForm?.id ? "Edit moment" : "Log a moment"}
        initial={cForm}
        fields={[
          { name: "kind", label: "Type", type: "select", required: true, half: true, options: KINDS.map((k) => ({ value: k.value, label: k.label })) },
          { name: "date", label: "Date", type: "date", required: true, half: true, help: "Future date = a plan." },
          { name: "person_id", label: "With", type: "select", options: people.rows.map((p) => ({ value: p.id, label: p.name as string })), help: "Optional, e.g. leave empty for a self reflection." },
          { name: "note", label: "Note", type: "textarea", placeholder: "What you talked about, what you noticed, what you want to remember" },
          { name: "feeling", label: "How did it feel? (1 to 5, optional)", type: "number", min: 1, max: 5 },
        ]}
      />
      {node}
    </div>
  );
}

function Moments({ conns, people, today, onEdit }: { conns: Row[]; people: Row[]; today: string; onEdit: (r: Row) => void }) {
  const [filter, setFilter] = useState("");
  const rows = conns.filter((c) => c.date <= today && (!filter || c.kind === filter));
  return (
    <Card title="Moments" action={
      <select className="input w-auto py-1 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter moments">
        <option value="">All</option>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
    }>
      {rows.length === 0 ? <Empty>Nothing logged yet. Moments you log show up here as a simple timeline you can look back on.</Empty> : (
        <ol className="relative space-y-3 border-l border-ink-700 pl-4">
          {rows.slice(0, 60).map((c) => {
            const p = people.find((x) => x.id === c.person_id);
            return (
              <li key={c.id} className="relative">
                <span className="absolute -left-[22px] top-1 grid h-3 w-3 place-items-center rounded-full border border-ink-600 bg-ink-900" />
                <button className="w-full text-left" onClick={() => onEdit(c)}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 text-fog-300"><KindIcon k={c.kind} />{kindLabel(c.kind)}</span>
                    {p && <span className="font-medium">{p.name}</span>}
                    <span className="text-[11px] muted">{fmtDate(c.date)}</span>
                    {c.feeling ? <span className="text-[11px] muted">· felt {c.feeling}/5</span> : null}
                  </div>
                  {c.note && <p className="mt-0.5 text-sm text-fog-300">{c.note}</p>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function Values({ settings, save, toast }: { settings: Record<string, string>; save: (s: Record<string, unknown>) => Promise<unknown>; toast: (s: string) => void }) {
  const [v, setV] = useState({ rel_values: "", rel_boundaries: "", rel_partner: "" });
  useEffect(() => setV({ rel_values: settings.rel_values ?? "", rel_boundaries: settings.rel_boundaries ?? "", rel_partner: settings.rel_partner ?? "" }), [settings.rel_values, settings.rel_boundaries, settings.rel_partner]);
  const fields: { k: keyof typeof v; label: string; hint: string }[] = [
    { k: "rel_values", label: "What I value in the people close to me", hint: "e.g. honesty, showing up, humour, respect for my time" },
    { k: "rel_boundaries", label: "My boundaries", hint: "What I will and won't accept, and how I'll say it calmly" },
    { k: "rel_partner", label: "What a healthy partnership looks like to me", hint: "Mutual respect, emotional safety, shared direction. Written for clarity, not as a checklist or a deadline." },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Values & boundaries" className="lg:col-span-2">
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.k}>
              <label className="label" htmlFor={f.k}>{f.label}</label>
              <textarea id={f.k} className="input" rows={3} placeholder={f.hint} value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={async () => { await save(v); toast("Saved"); }}>Save</button></div>
      </Card>
      <Card title="Reflection prompts">
        <ul className="space-y-2 text-sm text-fog-300">
          {[
            "Who gave me energy this week, and who drained it?",
            "Is there a conversation I've been avoiding?",
            "Did I hold a boundary kindly? Where did I let one slide?",
            "Who would appreciate hearing from me today?",
            "What do I want more of in my social life next month?",
          ].map((q) => <li key={q} className={clsx("rounded-lg border border-ink-700 px-3 py-2")}>{q}</li>)}
        </ul>
        <p className="mt-3 text-[11px] text-fog-500">Write answers as a Reflection moment so they stay in your timeline.</p>
      </Card>
    </div>
  );
}
