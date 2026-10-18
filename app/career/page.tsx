"use client";
import { useMemo, useState } from "react";
import { Plus, ChevronRight, ExternalLink, PhoneCall, Check } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader, Card, Stat, Badge, Empty, Segmented, clsx } from "@/components/ui";
import { RecordForm, type Field } from "@/components/RecordForm";
import { useSettings, useToday, useList, api, type Row } from "@/lib/client";
import { fmtDate, relativeDay, weekRange, addDays, diffDays } from "@/lib/dates";
import { AppBoard, AppTable, FunnelStrip, STAGE_META, CLOSED } from "@/components/JobViews";

const STAGES = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "final", label: "Final round" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];
const OPEN = ["saved", "applied", "screening", "interview", "final", "offer"];
const RESPONDED = ["screening", "interview", "final", "offer"];
const INTERVIEWED = ["interview", "final", "offer"];

const SOURCES = ["LinkedIn", "Referral", "Company site", "Recruiter", "Job board", "Other"];
/** Order follows how you scan a lead: company, location, status, role, salary, link, contact, email. */
function appFields(contacts: Row[], cvs: string[]): Field[] {
  return [
    { name: "company", label: "Company", required: true, half: true },
    { name: "location", label: "Location", half: true, placeholder: "Dubai, Abu Dhabi, remote…" },
    { name: "stage", label: "Status", type: "select", options: STAGES, half: true },
    { name: "position", label: "Role / position", required: true, half: true },
    { name: "compensation", label: "Salary package", half: true, placeholder: "e.g. AED 30k + allowances" },
    { name: "url", label: "Job link", type: "url", half: true },
    { name: "contact_id", label: "Main contact (from Network)", type: "select", half: true, options: contacts.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ` · ${c.company}` : ""}` })), help: "Referrer or recruiter. Shows on the Network tab too." },
    { name: "email", label: "Contact email", type: "text", half: true, placeholder: "Falls back to the contact's email" },
    { name: "contact", label: "Other contact (not in Network)", half: true },
    { name: "source", label: "Source", half: true, suggestions: SOURCES },
    { name: "cv_version", label: "CV used", half: true, placeholder: "e.g. PMO-v3", suggestions: cvs },
    { name: "cv_link", label: "CV file link", type: "url", half: true, placeholder: "Drive or Dropbox link" },
    { name: "applied_date", label: "Applied on", type: "date", half: true },
    { name: "fit", label: "Fit (1–5)", type: "number", half: true, min: 1, max: 5 },
    { name: "next_action", label: "Next action", half: true, placeholder: "Follow up with recruiter" },
    { name: "next_action_due", label: "Next action due", type: "date", half: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
}
const CONTACT_FIELDS: Field[] = [
  { name: "name", label: "Name", required: true, half: true },
  { name: "company", label: "Company", half: true },
  { name: "role", label: "Role", half: true },
  { name: "email", label: "Email", half: true },
  { name: "channel", label: "Channel", type: "select", half: true, options: ["LinkedIn", "Email", "Phone/WhatsApp", "Event", "Referral"].map((v) => ({ value: v, label: v })) },
  { name: "relationship", label: "Relationship", type: "select", half: true, options: ["Former colleague", "Recruiter", "Hiring manager", "Alumni", "Friend", "New contact"].map((v) => ({ value: v, label: v })) },
  { name: "last_contact", label: "Last contact", type: "date", half: true },
  { name: "next_followup", label: "Next follow-up", type: "date", half: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

type Tab = "pipeline" | "contacts" | "interviews" | "insights";

/** Same urgency colours as Next 7 days: due/overdue red, tomorrow amber, within 3 days blue. */
function followTone(date: string, today: string): "rose" | "amber" | "blue" | "gray" {
  const n = diffDays(today, date);
  return n <= 0 ? "rose" : n === 1 ? "amber" : n <= 3 ? "blue" : "gray";
}

export default function CareerPage() {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const apps = useList("applications");
  const contacts = useList("contacts");
  // One touchpoint updates everything about that company: the contact and any open application there.
  async function logTouch(c: Row) {
    const next = addDays(today, 7);
    await api.update("contacts", c.id, { last_contact: today, next_followup: next });
    const co = String(c.company ?? "").trim().toLowerCase();
    if (!co) return;
    const open = apps.rows.filter((a) => String(a.company ?? "").trim().toLowerCase() === co && !["rejected", "withdrawn", "offer", "accepted"].includes(a.stage));
    for (const a of open) await api.update("applications", a.id, { next_action: a.next_action || "Follow up", next_action_due: next });
  }
  const interviews = useList("interviews");
  const [tab, setTab] = useState<Tab>("pipeline");
  const [appForm, setAppForm] = useState<Partial<Row> | null>(null);
  const [contactForm, setContactForm] = useState<Partial<Row> | null>(null);
  const [intForm, setIntForm] = useState<Partial<Row> | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [pipeView, setPipeView] = useState<"board" | "table">("board");
  const [intView, setIntView] = useState<"table" | "board">("table");
  const cvs = useMemo(() => [...new Set(apps.rows.map((a) => String(a.cv_version ?? "").trim()).filter(Boolean))], [apps.rows]);
  // Interviews follow the pipeline: anything at screening or later, plus anything with a logged interview.
  const interviewApps = useMemo(
    () => apps.rows.filter((a) => ["screening", "interview", "final", "offer"].includes(a.stage) || interviews.rows.some((i) => i.application_id === a.id)),
    [apps.rows, interviews.rows],
  );
  const openApp = (a: Row) => setAppForm(a);

  const m = useMemo(() => {
    const sent = apps.rows.filter((a) => a.stage !== "saved");
    const responded = sent.filter((a) => RESPONDED.includes(a.stage)).length + sent.filter((a) => a.stage === "rejected" && interviews.rows.some((i) => i.application_id === a.id)).length;
    const interviewed = new Set([...sent.filter((a) => INTERVIEWED.includes(a.stage)).map((a) => a.id), ...interviews.rows.map((i) => i.application_id)]).size;
    const offers = sent.filter((a) => a.stage === "offer").length;
    const pct = (n: number) => (sent.length ? `${Math.round((n / sent.length) * 100)}%` : "–");
    return { sent: sent.length, responded, interviewed, offers, pct };
  }, [apps.rows, interviews.rows]);

  const nextActions = apps.rows
    .filter((a) => OPEN.includes(a.stage) && (a.next_action || a.next_action_due))
    .sort((a, b) => (a.next_action_due ?? "9999").localeCompare(b.next_action_due ?? "9999"));
  const day = diffDays(settings.start_date || today, today) + 1;

  return (
    <div>
      <PageHeader
        title="Career"
        subtitle="Quality over volume. Every lead here is one you entered; nothing is assumed active."
        actions={
          <>
            <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: "pipeline", label: "Pipeline" }, { value: "contacts", label: "Network" }, { value: "interviews", label: "Interviews" }, { value: "insights", label: "Insights" }]} />
            {tab === "contacts" ? (
              <button className="btn-primary" onClick={() => setContactForm({ last_contact: today })}><Plus size={15} /> Contact</button>
            ) : tab === "interviews" ? (
              <button className="btn-primary" onClick={() => setIntForm({ date: today, prep_done: false })} disabled={!apps.rows.length}><Plus size={15} /> Interview</button>
            ) : (
              <button className="btn-primary" onClick={() => setAppForm({ stage: "applied", applied_date: today, next_action: "Follow up", next_action_due: addDays(today, 7) })}><Plus size={15} /> Application</button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card card-pad"><Stat label="Applications sent" value={m.sent} /></div>
        <div className="card card-pad"><Stat label="Response rate" value={m.pct(m.responded)} hint={`${m.responded} responded`} /></div>
        <div className="card card-pad"><Stat label="Interview rate" value={m.pct(m.interviewed)} hint={`${m.interviewed} interviewed`} /></div>
        <div className="card card-pad"><Stat label="Offers" value={m.offers} tone={m.offers ? "good" : "neutral"} /></div>
        <div className="card card-pad col-span-2 sm:col-span-1"><Stat label="Follow-ups due" value={nextActions.filter((a) => a.next_action_due && a.next_action_due <= today).length} tone={nextActions.some((a) => a.next_action_due && a.next_action_due < today) ? "warn" : "neutral"} /></div>
      </div>

      {tab === "pipeline" && (
        <div className="space-y-4">
          {apps.rows.length === 0 && !apps.loading && (
            <Empty action={<button className="btn-outline" onClick={() => setAppForm({ stage: "saved" })}>Add your first lead</button>}>
              Start by re-entering any leads that are genuinely still open (status confirmed by you). Historical leads from earlier chats are not imported.
            </Empty>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1"><FunnelStrip apps={apps.rows} stages={OPEN} /></div>
            <Segmented<"board" | "table"> value={pipeView} onChange={setPipeView} options={[{ value: "board", label: "Board" }, { value: "table", label: "Table" }]} />
          </div>
          {pipeView === "board" ? (
            <AppBoard apps={apps.rows} stages={OPEN} today={today} contacts={contacts.rows} onOpen={openApp} />
          ) : (
            <AppTable apps={apps.rows.filter((a) => OPEN.includes(a.stage))} today={today} contacts={contacts.rows} onOpen={openApp} />
          )}
          <div>
            <button className="text-xs text-fog-400 hover:text-fog-100" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "Hide" : "Show"} closed ({apps.rows.filter((a) => !OPEN.includes(a.stage)).length})</button>
            {showClosed && <div className="mt-2"><AppBoard apps={apps.rows} stages={CLOSED} today={today} contacts={contacts.rows} onOpen={openApp} /></div>}
          </div>
          <Card title="Next actions">
            {nextActions.length === 0 ? <p className="text-sm muted">No pending actions.</p> : (
              <ul className="divide-y divide-ink-800">
                {nextActions.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1"><span className="font-medium">{a.company}</span> <span className="muted">· {a.next_action || "Next step"}</span></div>
                    {a.next_action_due && <Badge tone={a.next_action_due < today ? "amber" : a.next_action_due === today ? "teal" : "gray"}>{relativeDay(a.next_action_due, today)}</Badge>}
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => api.update("applications", a.id, { next_action: null, next_action_due: null })}>Done</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "contacts" && (
        <Card title="Network & follow-ups">
          {contacts.rows.length === 0 ? <Empty>Add former colleagues, recruiters and hiring managers. Log each genuine touchpoint; it counts toward the weekly outreach target.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="text-left text-[11px] muted"><th className="pb-1.5 font-medium">Name</th><th className="pb-1.5 font-medium">Company</th><th className="pb-1.5 font-medium">Linked jobs</th><th className="pb-1.5 font-medium">Last contact</th><th className="pb-1.5 font-medium">Next follow-up</th><th className="pb-1.5 text-right font-medium">Log a touchpoint</th></tr></thead>
                <tbody>
                  {contacts.rows.map((c) => (
                    <tr key={c.id} className="border-t border-ink-800 hover:bg-ink-850">
                      <td className="cursor-pointer py-2 pr-2" onClick={() => setContactForm(c)}><div className="font-medium">{c.name}</div><div className="text-[11px] muted">{[c.role, c.relationship].filter(Boolean).join(" · ")}</div>{c.email && <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-teal-500 hover:underline">{c.email}</a>}</td>
                      <td className="py-2 pr-2">{c.company || "–"}</td>
                      <td className="py-2 pr-2"><LinkedJobs c={c} apps={apps.rows} /></td>
                      <td className="py-2 pr-2 tabnum">{c.last_contact ? fmtDate(c.last_contact, { year: false }) : "–"}</td>
                      <td className="py-2 pr-2">{c.next_followup ? <Badge tone={followTone(c.next_followup, today)}>{relativeDay(c.next_followup, today)}</Badge> : "–"}</td>
                      <td className="py-2 text-right">
                        {c.last_contact === today ? (
                          <span className="inline-flex items-center gap-1 text-xs text-teal-300"><Check size={12} /> Logged today</span>
                        ) : (
                          <button className="btn-outline px-2 py-1 text-xs" title="Sets last contact to today and the next follow-up to 7 days from now" onClick={() => logTouch(c)}><PhoneCall size={12} /> I contacted them today</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "interviews" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1"><FunnelStrip apps={interviewApps} stages={["screening", "interview", "final", "offer", ...CLOSED]} /></div>
            <Segmented<"table" | "board"> value={intView} onChange={setIntView} options={[{ value: "table", label: "Table" }, { value: "board", label: "Board" }]} />
          </div>
          {interviewApps.length === 0 ? (
            <Empty>Applications that reach screening or later appear here automatically, with every interview you log against them.</Empty>
          ) : intView === "table" ? (
            <AppTable apps={interviewApps} today={today} contacts={contacts.rows} interviews={interviews.rows} onOpen={openApp} onLogInterview={(a) => setIntForm({ application_id: a.id, date: today, prep_done: false })} />
          ) : (
            <AppBoard apps={interviewApps} stages={["screening", "interview", "final", "offer", ...(interviewApps.some((a) => CLOSED.includes(a.stage)) ? ["rejected"] : [])]} today={today} contacts={contacts.rows} onOpen={openApp} />
          )}
          <details className="card card-pad">
            <summary className="cursor-pointer text-sm font-medium">Prep checklist</summary>
            <ul className="mt-3 grid gap-1.5 text-sm text-fog-300 sm:grid-cols-2">
              {["Re-read the job description; map 3 requirements to real stories", "One STAR story each: delivery under pressure, stakeholder conflict, technical trade-off", "Numbers you can verify (no invented metrics)", "Why this company, why this role, why now", "2–3 questions about team, success in 90 days, delivery process", "Logistics: link, location, ID, quiet room, charged phone"].map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />{x}</li>)}
            </ul>
          </details>
        </div>
      )}

      {tab === "insights" && <Insights apps={apps.rows} today={today} day={day} m={m} />}


      <RecordForm table="applications" open={!!appForm} onClose={() => setAppForm(null)} title={appForm?.id ? "Edit application" : "New application"} fields={appFields(contacts.rows, cvs)} initial={appForm} allowArchive />
      <RecordForm table="contacts" open={!!contactForm} onClose={() => setContactForm(null)} title={contactForm?.id ? "Edit contact" : "New contact"} fields={CONTACT_FIELDS} initial={contactForm} />
      <RecordForm
        table="interviews"
        open={!!intForm}
        onClose={() => setIntForm(null)}
        title={intForm?.id ? "Edit interview" : "Log interview"}
        initial={intForm}
        onSaved={(i) => {
          const a = apps.rows.find((x) => x.id === i.application_id);
          if (a && ["saved", "applied"].includes(a.stage)) api.update("applications", a.id, { stage: /recruit|screen|hr/i.test(String(i.round ?? "")) ? "screening" : "interview", ...(a.applied_date ? {} : { applied_date: today }) });
        }}
        fields={[
          { name: "application_id", label: "Application", type: "select", required: true, options: apps.rows.map((a) => ({ value: a.id, label: `${a.company} · ${a.position}` })) },
          { name: "date", label: "Date", type: "date", half: true },
          { name: "round", label: "Round", half: true, placeholder: "Recruiter, HM, panel, case…" },
          { name: "prep_done", label: "Prep done", type: "checkbox" },
          { name: "outcome", label: "Outcome", type: "select", options: ["Pending", "Advanced", "Rejected", "Offer"].map((v) => ({ value: v, label: v })) },
          { name: "notes", label: "Notes: questions asked, what to improve", type: "textarea" },
        ]}
      />
    </div>
  );
}

function LinkedJobs({ c, apps }: { c: Row; apps: Row[] }) {
  const mine = apps.filter((a) => a.contact_id === c.id);
  const co = String(c.company ?? "").trim().toLowerCase();
  const suggest = co ? apps.filter((a) => !a.contact_id && String(a.company ?? "").trim().toLowerCase() === co) : [];
  const free = apps.filter((a) => a.contact_id !== c.id && !suggest.includes(a) && !["rejected", "withdrawn"].includes(a.stage));
  const label = (a: Row) => `${a.company} · ${a.position}`;
  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {mine.map((a) => {
        const m = STAGE_META[a.stage] ?? STAGE_META.saved;
        return (
          <span key={a.id} className="chip" style={{ color: m.color, background: `${m.color}1c`, borderColor: `${m.color}55` }} title={`${label(a)} (${m.label})`}>
            {a.company}
            <button aria-label="Unlink" className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => api.update("applications", a.id, { contact_id: null })}>×</button>
          </span>
        );
      })}
      {suggest.map((a) => (
        <button key={a.id} className="chip border-dashed" title="Same company. Click to link this contact to the application." onClick={() => api.update("applications", a.id, { contact_id: c.id })}>
          + Link {a.company}
        </button>
      ))}
      {free.length > 0 && (
        <select className="rounded-md border border-ink-700 bg-transparent px-1 py-0.5 text-[11px] text-fog-400" value="" aria-label="Link to a job" onChange={(e) => e.target.value && api.update("applications", Number(e.target.value), { contact_id: c.id })}>
          <option value="">{mine.length || suggest.length ? "Link another…" : "Link to a job…"}</option>
          {free.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
        </select>
      )}
    </div>
  );
}

function Insights({ apps, today, day, m }: { apps: Row[]; today: string; day: number; m: { sent: number; responded: number; interviewed: number; offers: number } }) {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const [mon, sun] = weekRange(addDays(today, -7 * (7 - i)));
    return { w: fmtDate(mon, { year: false }), Applications: apps.filter((a) => a.applied_date && a.applied_date >= mon && a.applied_date <= sun).length };
  });
  const byCv = useMemo(() => {
    const g = new Map<string, { sent: number; resp: number }>();
    for (const a of apps.filter((x) => x.stage !== "saved")) {
      const k = a.cv_version || "(not recorded)";
      const v = g.get(k) ?? { sent: 0, resp: 0 };
      v.sent++;
      if (RESPONDED.includes(a.stage)) v.resp++;
      g.set(k, v);
    }
    return [...g.entries()];
  }, [apps]);
  const respRate = m.sent ? m.responded / m.sent : null;
  const checkpoint = day >= 90 ? 90 : day >= 60 ? 60 : day >= 30 ? 30 : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Applications per week">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="w" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={24} />
              <Tooltip contentStyle={{ background: "var(--chart-tip-bg)", border: "1px solid var(--chart-tip-border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--chart-cursor)" }} />
              <Bar dataKey="Applications" fill="#6aa3ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Response rate by CV version">
        {byCv.length === 0 ? <p className="text-sm muted">Record a CV version on each application to compare.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] muted"><th className="pb-1.5 font-medium">CV</th><th className="pb-1.5 text-right font-medium">Sent</th><th className="pb-1.5 text-right font-medium">Responses</th><th className="pb-1.5 text-right font-medium">Rate</th></tr></thead>
            <tbody>{byCv.map(([k, v]) => <tr key={k} className="border-t border-ink-800"><td className="py-1.5">{k}</td><td className="py-1.5 text-right tabnum">{v.sent}</td><td className="py-1.5 text-right tabnum">{v.resp}</td><td className="py-1.5 text-right tabnum">{Math.round((v.resp / v.sent) * 100)}%</td></tr>)}</tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] text-fog-500">Small samples mislead. Treat differences under ~10 applications per version as noise.</p>
      </Card>
      <Card title="Checkpoint guidance" className="lg:col-span-2">
        <p className="mb-2 text-sm muted">Day {Math.max(day, 1)} of the 90-day plan. {checkpoint ? `Day-${checkpoint} checkpoint reached.` : "First checkpoint at day 30."}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { d: 30, title: "Day 30", body: "If response rate < 10% after 20+ tailored applications: rewrite headline and top third of the CV for one track, and shift 30% of effort from cold applications to referrals." },
            { d: 60, title: "Day 60", body: "If interviews aren't converting: run mock interviews on the rounds where you drop out. If no interviews: widen to adjacent roles (PMO specialist, project coordinator, technical support, presales) and contract/temp work." },
            { d: 90, title: "Day 90", body: "If no offer: prioritise any income that protects runway and residency (contract, freelance IoT/PM work, short-term roles) while continuing a reduced targeted search." },
          ].map((c) => (
            <div key={c.d} className={clsx("rounded-lg border p-3 text-sm", checkpoint === c.d ? "border-teal-500/50 bg-teal-500/5" : "border-ink-700")}>
              <div className="mb-1 font-medium">{c.title}</div>
              <div className="text-xs leading-relaxed text-fog-300">{c.body}</div>
            </div>
          ))}
        </div>
        {respRate !== null && m.sent >= 10 && <p className="mt-3 text-sm text-fog-300">Current response rate: <span className="font-semibold">{Math.round(respRate * 100)}%</span> across {m.sent} applications.</p>}
      </Card>
    </div>
  );
}
