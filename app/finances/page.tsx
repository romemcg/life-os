"use client";
import { useMemo, useState, Suspense } from "react";
import { Plus, Pencil, Check } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ReferenceLine, Legend } from "recharts";
import { PageHeader, Card, Stat, Badge, Empty, Segmented, Provenance, clsx } from "@/components/ui";
import { RecordForm, type Field } from "@/components/RecordForm";
import { useFinance } from "@/components/useFinance";
import { SpendingHistory } from "@/components/Spending";
import { StatementCell } from "@/components/Statement";
import { useSearchParams } from "next/navigation";
import { useSettings, useToday, useList, api, money, type Row } from "@/lib/client";
import { simulate, emergencyFundTarget, monthsToTarget, totalCostOfOwnership, type Strategy, type Debt, type Obligation } from "@/lib/finance";
import { addMonths, fmtDate, fmtMonth, monthRange, ageOn } from "@/lib/dates";

const PROV = [{ value: "actual", label: "Actual (confirmed)" }, { value: "estimate", label: "Estimate" }];
const FORMS: Record<string, { title: string; fields: Field[] }> = {
  accounts: {
    title: "Account",
    fields: [
      { name: "name", label: "Name", required: true, placeholder: "e.g. Main bank, Cash" },
      { name: "balance", label: "Balance", type: "number", required: true, half: true },
      { name: "currency", label: "Currency", half: true, placeholder: "AED" },
      { name: "type", label: "Type", type: "select", options: ["cash", "bank", "savings", "investment"].map((v) => ({ value: v, label: v })), half: true },
      { name: "as_of", label: "As of", type: "date", half: true },
      { name: "provenance", label: "Data quality", type: "select", options: PROV, half: true },
      { name: "accessible", label: "Accessible for living costs", type: "checkbox", half: true },
    ],
  },
  debts: {
    title: "Debt",
    fields: [
      { name: "name", label: "Name", required: true, placeholder: "e.g. Card A" },
      { name: "type", label: "Type", type: "select", options: ["credit card", "personal loan", "family loan", "other"].map((v) => ({ value: v, label: v })), half: true },
      { name: "balance", label: "Outstanding balance", type: "number", required: true, half: true },
      { name: "apr", label: "APR / profit rate (% per year)", type: "number", half: true, help: "Leave blank if unknown; you'll get a warning instead of a guess." },
      { name: "min_payment", label: "Minimum monthly payment", type: "number", half: true },
      { name: "due_day", label: "Due day of month", type: "number", half: true, min: 1, max: 31 },
      { name: "as_of", label: "As of", type: "date", half: true },
      { name: "provenance", label: "Data quality", type: "select", options: PROV, half: true },
      { name: "notes", label: "Notes (fees, restructuring options)", type: "textarea" },
    ],
  },
  cashflows: {
    title: "Monthly item",
    fields: [
      { name: "name", label: "Name", required: true, placeholder: "e.g. Rent, Groceries, Salary" },
      { name: "kind", label: "Type", type: "select", required: true, half: true, options: [{ value: "income", label: "Income" }, { value: "essential", label: "Essential expense" }, { value: "discretionary", label: "Discretionary expense" }] },
      { name: "amount", label: "Amount per month", type: "number", required: true, half: true },
      { name: "due_day", label: "Due day", type: "number", half: true },
      { name: "provenance", label: "Data quality", type: "select", options: PROV, half: true },
      { name: "active", label: "Active", type: "checkbox" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  obligations: {
    title: "One-off obligation",
    fields: [
      { name: "name", label: "Name", required: true, placeholder: "e.g. Visa renewal, deposit" },
      { name: "amount", label: "Amount", type: "number", required: true, half: true },
      { name: "due_date", label: "Due date", type: "date", half: true },
      { name: "status", label: "Status", type: "select", half: true, options: [{ value: "pending", label: "Pending" }, { value: "paid", label: "Paid" }] },
      { name: "provenance", label: "Data quality", type: "select", options: PROV, half: true },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
};
const DEFAULTS: Record<string, Record<string, unknown>> = {
  accounts: { currency: "AED", type: "bank", provenance: "actual", accessible: true },
  debts: { type: "credit card", provenance: "actual" },
  cashflows: { kind: "essential", provenance: "actual", active: true },
  obligations: { status: "pending", provenance: "actual" },
};

const AXIS = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false };
const TT = { contentStyle: { background: "var(--chart-tip-bg)", border: "1px solid var(--chart-tip-border)", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "var(--chart-label)" } };
const k = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`);

export default function FinancesPage() {
  return (
    <Suspense fallback={null}>
      <FinancesInner />
    </Suspense>
  );
}

function FinancesInner() {
  const { settings, save } = useSettings();
  const today = useToday(settings.timezone);
  const cur = settings.currency;
  const fin = useFinance(today, cur);
  const params = useSearchParams();
  const [tab, setTab] = useState<"actuals" | "spending" | "scenarios">(params.get("tab") === "spending" ? "spending" : params.get("tab") === "scenarios" ? "scenarios" : "actuals");
  const [form, setForm] = useState<{ table: keyof typeof FORMS; initial: Partial<Row> } | null>(null);
  const add = (table: keyof typeof FORMS) => setForm({ table, initial: { ...DEFAULTS[table], as_of: today } });

  return (
    <div>
      <PageHeader
        title="Finances"
        subtitle={<>All figures in {cur}. Actuals are what you enter; projections are labeled scenarios, never guarantees.</>}
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: "actuals", label: "Actuals" }, { value: "spending", label: "Spending" }, { value: "scenarios", label: "Scenarios" }]} />}
      />
      {tab === "spending" ? <SpendingHistory today={today} cur={cur} /> : tab === "actuals" ? <Actuals fin={fin} today={today} cur={cur} settings={settings} save={save} onAdd={add} onEdit={(table, r) => setForm({ table, initial: r })} /> : <Scenarios fin={fin} today={today} cur={cur} settings={settings} />}
      {form && (
        <RecordForm
          table={form.table as never}
          open
          onClose={() => setForm(null)}
          title={`${form.initial.id ? "Edit" : "Add"} ${FORMS[form.table].title.toLowerCase()}`}
          fields={FORMS[form.table].fields}
          initial={form.initial}
        />
      )}
    </div>
  );
}

type Fin = ReturnType<typeof useFinance>;

function Actuals({ fin, today, cur, settings, save, onAdd, onEdit }: { fin: Fin; today: string; cur: string; settings: Record<string, string>; save: (s: Record<string, unknown>) => Promise<unknown>; onAdd: (t: keyof typeof FORMS) => void; onEdit: (t: keyof typeof FORMS, r: Row) => void }) {
  const s = fin.summary;
  const runIdx = fin.statusQuo.rows.findIndex((r) => r.cash < 0);
  const [mStart, mEnd] = monthRange(today);
  const expenses = useList("expenses", { from: mStart, to: mEnd });
  const snaps = useList("balance_snapshots");
  const efMonths = Number(settings.ef_months || 3);
  const efTarget = emergencyFundTarget(efMonths, s.essential, s.minPayments);
  const efSaved = fin.accounts.filter((a) => a.type === "savings" && (a.currency || cur) === cur).reduce((t, a) => t + Number(a.balance || 0), 0);
  const efEta = monthsToTarget(efSaved, efTarget, s.netMonthly);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses.rows) m.set(e.category || "Other", (m.get(e.category || "Other") ?? 0) + (e.amount as number));
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [expenses.rows]);
  const monthSpend = expenses.rows.reduce((t, e) => t + (e.amount as number), 0);
  const monthDisc = expenses.rows.filter((e) => !e.essential).reduce((t, e) => t + (e.amount as number), 0);

  return (
    <div className="space-y-4">
      {!fin.loading && !fin.hasBaseline && (
        <div className="card card-pad border-amber-400/30">
          <div className="text-sm font-medium text-amber-200">Start here: enter your current baseline</div>
          <p className="mt-1 text-sm muted">Older figures in your notes are unreconciled snapshots, so nothing is pre-filled. Enter what's true today; mark anything uncertain as an Estimate.</p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-fog-300">
            <li>Each cash/bank balance</li>
            <li>Each debt: balance, APR, minimum payment</li>
            <li>Monthly income (if any) and essential costs: rent, food, transport, telecom, family support</li>
            <li>One-off obligations with exact dates: visa, deposits, fees</li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card card-pad"><Stat label="Accessible cash" value={money(s.cashAccessible, cur)} hint={s.cashTotal !== s.cashAccessible ? `${money(s.cashTotal, cur)} total` : undefined} /></div>
        <div className="card card-pad"><Stat label="Total debt" value={money(s.debtTotal, cur)} hint={`${money(s.minPayments, cur)}/mo minimums`} /></div>
        <div className="card card-pad"><Stat label="Net worth" value={money(s.netWorth, cur)} tone={s.netWorth < 0 ? "bad" : "neutral"} hint="Cash − debt (assets not tracked)" /></div>
        <div className="card card-pad"><Stat label="Net cash flow / mo" value={money(s.netMonthly, cur)} tone={s.netMonthly < 0 ? "bad" : "good"} hint={`Income ${money(s.income, cur)}`} /></div>
        <div className="card card-pad"><Stat label="Runway (status quo)" value={!fin.hasBaseline ? "–" : runIdx === -1 ? "60+ months" : runIdx === 0 ? "< 1 month" : `${runIdx} months`} tone={runIdx !== -1 && runIdx < 3 ? "bad" : runIdx !== -1 && runIdx < 6 ? "warn" : "neutral"} hint={fin.statusQuo.runOutMonth ? `Cash < 0 in ${fmtMonth(fin.statusQuo.runOutMonth)}` : "Includes one-off obligations"} /></div>
        <div className="card card-pad"><Stat label="Simple runway" value={Number.isFinite(s.simpleRunwayMonths) ? `${s.simpleRunwayMonths.toFixed(1)} mo` : "Not burning"} hint="Cash ÷ monthly burn" /></div>
        <div className="card card-pad"><Stat label="Debt-to-income" value={s.debtToIncome == null ? "No income" : `${Math.round(s.debtToIncome * 100)}%`} hint="Minimums ÷ income" /></div>
        <div className="card card-pad"><Stat label="Savings rate" value={s.savingsRate == null ? "No income" : `${Math.round(s.savingsRate * 100)}%`} hint="Net flow ÷ income" /></div>
      </div>

      {[...s.warnings, ...fin.statusQuo.warnings].length > 0 && (
        <Card title="Data gaps">
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200/90">{[...s.warnings, ...fin.statusQuo.warnings].map((w, i) => <li key={i}>{w}</li>)}</ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ItemTable title="Accounts" table="accounts" rows={fin.accounts} onAdd={onAdd} onEdit={onEdit} cols={[
          { h: "Name", r: (x) => <>{x.name}{x.accessible === false && <span className="ml-1 text-[10px] muted">(locked)</span>}</> },
          { h: "Balance", r: (x) => <span className="tabnum">{money(x.balance, x.currency || cur)}</span>, right: true },
          { h: "As of", r: (x) => <span className="muted">{x.as_of ? fmtDate(x.as_of, { year: false }) : "–"}</span> },
          { h: "", r: (x) => <Provenance value={x.provenance} /> },
        ]} />
        <ItemTable title="Debts" table="debts" rows={fin.debts} onAdd={onAdd} onEdit={onEdit} cols={[
          { h: "Name", r: (x) => x.name },
          { h: "Balance", r: (x) => <span className="tabnum">{money(x.balance, cur)}</span>, right: true },
          { h: "APR", r: (x) => (x.apr == null ? <Badge tone="amber">missing</Badge> : <span className="tabnum">{x.apr}%</span>), right: true },
          { h: "Min/mo", r: (x) => (x.min_payment == null ? <Badge tone="amber">missing</Badge> : <span className="tabnum">{money(x.min_payment, cur)}</span>), right: true },
          { h: "This statement", r: (x) => <StatementCell debt={x} accounts={fin.accounts} today={today} cur={cur} />, right: true },
        ]} />
        <ItemTable title="Monthly income & spending" table="cashflows" rows={fin.cashflows} onAdd={onAdd} onEdit={onEdit} cols={[
          { h: "Item", r: (x) => <span className={x.active === false ? "line-through muted" : ""}>{x.name}</span> },
          { h: "Type", r: (x) => <Badge tone={x.kind === "income" ? "teal" : x.kind === "essential" ? "blue" : "violet"}>{x.kind}</Badge> },
          { h: "Per month", r: (x) => <span className="tabnum">{money(x.amount, cur)}</span>, right: true },
          { h: "", r: (x) => <Provenance value={x.provenance} /> },
        ]} footer={<div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs muted"><span>Essential {money(s.essential, cur)}</span><span>Discretionary {money(s.discretionary, cur)}</span><span>Minimums {money(s.minPayments, cur)}</span></div>} />
        <ItemTable title="One-off obligations" table="obligations" rows={fin.obligations} onAdd={onAdd} onEdit={onEdit} cols={[
          { h: "Item", r: (x) => <span className={x.status === "paid" ? "line-through muted" : ""}>{x.name}</span> },
          { h: "Due", r: (x) => <span className={clsx("tabnum", x.status !== "paid" && x.due_date && x.due_date < today ? "text-rose-300" : "")}>{x.due_date ? fmtDate(x.due_date) : <Badge tone="amber">date?</Badge>}</span> },
          { h: "Amount", r: (x) => <span className="tabnum">{money(x.amount, cur)}</span>, right: true },
          { h: "", r: (x) => x.status === "paid" ? <Badge tone="teal">Paid</Badge> : <button className="btn-ghost px-1.5 py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); api.update("obligations", x.id, { status: "paid" }); }}><Check size={12} /> Paid</button> },
        ]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Status-quo projection (scenario)">
          {!fin.hasBaseline ? <Empty>Enter balances and monthly items to see the projection.</Empty> : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fin.statusQuo.rows.slice(0, 24).map((r) => ({ m: fmtMonth(r.month), Cash: r.cash, Debt: r.debt }))} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="m" {...AXIS} interval={5} />
                    <YAxis {...AXIS} tickFormatter={k} width={40} />
                    <Tooltip {...TT} formatter={(v: number) => money(v, cur)} />
                    <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Cash" stroke="#4fb8ab" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Debt" stroke="#e0a36a" strokeWidth={2} dot={false} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-fog-500">If nothing changes: current income, current spending, minimum payments only, one-off obligations on their due dates. Use Scenarios to test a job start or cuts.</p>
            </>
          )}
        </Card>
        <Card title={`Spending this month · ${money(monthSpend, cur)}`} action={<span className="text-xs muted">{monthDisc ? `${money(monthDisc, cur)} discretionary` : ""}</span>}>
          {byCat.length === 0 ? <Empty>Log spending from the Today page; it builds this view.</Empty> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCat} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" {...AXIS} tickFormatter={k} />
                  <YAxis type="category" dataKey="name" {...AXIS} width={96} />
                  <Tooltip {...TT} formatter={(v: number) => money(v, cur)} cursor={{ fill: "var(--chart-cursor)" }} />
                  <Bar dataKey="value" fill="#4fb8ab" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Emergency fund">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="muted">Target</span>
            <select className="input w-auto" value={efMonths} onChange={(e) => save({ ef_months: e.target.value })} aria-label="Months of essentials">
              {[1, 2, 3, 6].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
            </select>
            <span className="muted">of essentials + minimums =</span>
            <span className="font-semibold tabnum">{money(efTarget, cur)}</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="muted">Set aside</span>
            <span className="font-semibold tabnum">{money(efSaved, cur)}</span>
            <span className="muted">({efTarget > 0 ? Math.round((efSaved / efTarget) * 100) : 0}%)</span>
          </div>
          <p className="mt-2 text-sm text-fog-300">
            {!fin.hasBaseline ? "Needs essential costs first." : efSaved >= efTarget ? "Target reached." : efEta == null ? "Not reachable at current cash flow. Income comes first (see Scenarios)." : `About ${efEta} months at the current net cash flow.`}
          </p>
          <p className="mt-1 text-[11px] text-fog-500">Only accounts of type “savings” count. Your everyday bank balance and cash are runway for living costs, not an emergency fund. When you start one, add it as a savings account.</p>
        </Card>
        <Card title="Net worth trend (actual)">
          {snaps.rows.length < 2 ? <Empty>Builds automatically each day you update balances. No estimates are plotted.</Empty> : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snaps.rows.map((r) => ({ d: fmtDate(r.date, { year: false }), "Net worth": (r.cash as number) - (r.debt as number) }))}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="d" {...AXIS} />
                  <YAxis {...AXIS} tickFormatter={k} width={40} />
                  <Tooltip {...TT} formatter={(v: number) => money(v, cur)} />
                  <Line type="monotone" dataKey="Net worth" stroke="#6aa3ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ItemTable({ title, table, rows, cols, onAdd, onEdit, footer }: { title: string; table: keyof typeof FORMS; rows: Row[]; cols: { h: string; r: (x: Row) => React.ReactNode; right?: boolean }[]; onAdd: (t: keyof typeof FORMS) => void; onEdit: (t: keyof typeof FORMS, r: Row) => void; footer?: React.ReactNode }) {
  return (
    <Card title={title} action={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => onAdd(table)}><Plus size={14} /> Add</button>}>
      {rows.length === 0 ? <Empty>None entered.</Empty> : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] muted">{cols.map((c, i) => <th key={i} className={clsx("px-1 pb-1.5 font-medium", c.right && "text-right")}>{c.h}</th>)}<th /></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="cursor-pointer border-t border-ink-800 hover:bg-ink-850" onClick={() => onEdit(table, x)}>
                  {cols.map((c, i) => <td key={i} className={clsx("px-1 py-2", c.right && "text-right")}>{c.r(x)}</td>)}
                  <td className="w-6 px-1 text-fog-500"><Pencil size={12} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="mt-2 border-t border-ink-800 pt-2">{footer}</div>}
    </Card>
  );
}

// ---------------- Scenarios ----------------
function Scenarios({ fin, today, cur, settings }: { fin: Fin; today: string; cur: string; settings: Record<string, string> }) {
  const s = fin.summary;
  const [jobStart, setJobStart] = useState(addMonths(today.slice(0, 7) + "-01", 2));
  const [salary, setSalary] = useState(15000);
  const [noJob, setNoJob] = useState(false);
  const [essPct, setEssPct] = useState(0);
  const [discPct, setDiscPct] = useState(0);
  const [extra, setExtra] = useState(1000);
  const [buffer, setBuffer] = useState(Number(settings.cash_buffer || 5000));
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [horizon, setHorizon] = useState(48);

  const base = {
    start: today,
    months: horizon,
    cash: s.cashAccessible,
    debts: fin.debts as unknown as Debt[],
    incomeNow: s.income,
    essential: s.essential * (1 + essPct / 100),
    discretionary: s.discretionary * (1 + discPct / 100),
    obligations: fin.obligations as unknown as Obligation[],
    extraPayment: extra,
    cashBuffer: buffer,
  };
  const scen = useMemo(() => {
    const mk = (offset: number, mult: number) => (noJob ? null : { startDate: addMonths(jobStart, offset), netSalary: Math.round(salary * mult) });
    return {
      conservative: simulate({ ...base, strategy, job: mk(2, 0.85) }),
      baseline: simulate({ ...base, strategy, job: mk(0, 1) }),
      optimistic: simulate({ ...base, strategy, job: mk(-1, 1.1) }),
      noIncome: simulate({ ...base, strategy: "minimum", job: null }),
      avalanche: simulate({ ...base, strategy: "avalanche", job: mk(0, 1) }),
      snowball: simulate({ ...base, strategy: "snowball", job: mk(0, 1) }),
      minimum: simulate({ ...base, strategy: "minimum", job: mk(0, 1) }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(base), jobStart, salary, noJob, strategy]);

  const chart = scen.baseline.rows.map((r, i) => ({
    m: fmtMonth(r.month),
    Conservative: scen.conservative.rows[i].cash,
    Baseline: r.cash,
    Optimistic: scen.optimistic.rows[i].cash,
    "No new income": scen.noIncome.rows[i].cash,
    "Debt (baseline)": r.debt,
  }));
  const age30 = "2029-05-01";
  const at = (sim: ReturnType<typeof simulate>, month: string) => sim.rows.find((r) => r.month === month);

  if (!fin.hasBaseline)
    return <Empty>Scenarios need your baseline (balances, debts, monthly costs). Enter it under Actuals first; nothing here is pre-filled.</Empty>;

  const Row2 = ({ label, sim }: { label: string; sim: ReturnType<typeof simulate> }) => {
    const a30 = at(sim, age30);
    return (
      <tr className="border-t border-ink-800">
        <td className="py-2 pr-2">{label}</td>
        <td className={clsx("py-2 pr-2 tabnum", sim.runOutMonth ? "text-rose-300" : "text-teal-300")}>{sim.runOutMonth ? fmtMonth(sim.runOutMonth) : "Doesn't run out"}</td>
        <td className={clsx("py-2 pr-2 text-right tabnum", sim.minCash < 0 && "text-rose-300")}>{money(sim.minCash, cur)}</td>
        <td className="py-2 pr-2 tabnum">{sim.debtFreeMonth ? `${fmtMonth(sim.debtFreeMonth)} (age ${ageOn(settings.birth_date, sim.debtFreeMonth)})` : sim.missedFrom ? `Minimums missed from ${fmtMonth(sim.missedFrom)}` : `Not within ${horizon} mo`}</td>
        <td className="py-2 pr-2 text-right tabnum">{money(sim.totalInterest, cur)}</td>
        <td className="py-2 text-right tabnum">{a30 ? money(a30.cash - a30.debt, cur) : "–"}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <Card title="Assumptions you control">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Job starts (baseline)</label>
            <input type="month" className="input" value={jobStart.slice(0, 7)} disabled={noJob} onChange={(e) => e.target.value && setJobStart(e.target.value + "-01")} />
            <label className="mt-1.5 flex items-center gap-2 text-xs muted"><input type="checkbox" checked={noJob} onChange={(e) => setNoJob(e.target.checked)} /> No job in horizon</label>
          </div>
          <Slider label="Net monthly salary" value={salary} set={setSalary} min={5000} max={40000} step={500} fmt={(v) => money(v, cur)} disabled={noJob} hint="Assumption, not a forecast" />
          <Slider label="Essential costs change" value={essPct} set={setEssPct} min={-40} max={20} step={5} fmt={(v) => `${v > 0 ? "+" : ""}${v}% (${money(s.essential * (1 + v / 100), cur)})`} />
          <Slider label="Discretionary change" value={discPct} set={setDiscPct} min={-100} max={50} step={5} fmt={(v) => `${v > 0 ? "+" : ""}${v}% (${money(s.discretionary * (1 + v / 100), cur)})`} />
          <Slider label="Extra debt payment / mo" value={extra} set={setExtra} min={0} max={10000} step={250} fmt={(v) => money(v, cur)} />
          <Slider label="Cash buffer kept" value={buffer} set={setBuffer} min={0} max={50000} step={1000} fmt={(v) => money(v, cur)} hint="Extra payments only above this" />
          <div>
            <label className="label">Repayment strategy</label>
            <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
              <option value="avalanche">Avalanche (highest rate first)</option>
              <option value="snowball">Snowball (smallest balance first)</option>
              <option value="minimum">Minimums only</option>
            </select>
          </div>
          <div>
            <label className="label">Horizon</label>
            <select className="input" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>{[24, 36, 48, 60, 96].map((h) => <option key={h} value={h}>{h} months</option>)}</select>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-fog-500">Negative cash = a shortfall you would need to bridge (savings, family, restructuring), not money you have. Conservative = start 2 months later at 85% of salary. Optimistic = 1 month earlier at 110%. These bands are sensitivity checks you can change, not predictions.</p>
      </Card>

      <Card title="Cash under each scenario">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="m" {...AXIS} interval={Math.ceil(horizon / 8)} />
              <YAxis {...AXIS} tickFormatter={k} width={44} />
              <Tooltip {...TT} formatter={(v: number) => money(v, cur)} />
              <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
              <Line dataKey="No new income" stroke="#f87171" strokeWidth={1.5} dot={false} strokeDasharray="5 4" />
              <Line dataKey="Conservative" stroke="#c7b37f" strokeWidth={1.5} dot={false} />
              <Line dataKey="Baseline" stroke="#4fb8ab" strokeWidth={2.5} dot={false} />
              <Line dataKey="Optimistic" stroke="#6aa3ff" strokeWidth={1.5} dot={false} />
              <Line dataKey="Debt (baseline)" stroke="#e0a36a" strokeWidth={1.5} dot={false} strokeDasharray="2 3" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-[11px] muted"><th className="pb-1.5 font-medium">Scenario</th><th className="pb-1.5 font-medium">Cash below zero</th><th className="pb-1.5 text-right font-medium" title="Most negative point = how much bridging you would need">Lowest cash</th><th className="pb-1.5 font-medium">Debt-free</th><th className="pb-1.5 text-right font-medium">Interest paid</th><th className="pb-1.5 text-right font-medium">Net worth at 30</th></tr></thead>
            <tbody>
              <Row2 label="No new income" sim={scen.noIncome} />
              <Row2 label="Conservative" sim={scen.conservative} />
              <Row2 label="Baseline" sim={scen.baseline} />
              <Row2 label="Optimistic" sim={scen.optimistic} />
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Avalanche vs snowball (baseline income)">
          {fin.debts.length === 0 ? <Empty>No debts entered.</Empty> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] muted"><th className="pb-1.5 font-medium">Strategy</th><th className="pb-1.5 font-medium">Debt-free</th><th className="pb-1.5 text-right font-medium">Interest</th></tr></thead>
              <tbody>
                {(["avalanche", "snowball", "minimum"] as const).map((k2) => (
                  <tr key={k2} className="border-t border-ink-800">
                    <td className="py-2 capitalize">{k2 === "minimum" ? "Minimums only" : k2}</td>
                    <td className="py-2 tabnum">{scen[k2].debtFreeMonth ? fmtMonth(scen[k2].debtFreeMonth!) : `Not within ${horizon} mo`}</td>
                    <td className="py-2 text-right tabnum">{money(scen[k2].totalInterest, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {scen.avalanche.payoffs.length > 0 && <p className="mt-2 text-xs muted">Avalanche payoff order: {scen.avalanche.payoffs.map((p) => `${p.name} (${fmtMonth(p.month)})`).join(" → ")}</p>}
          {fin.debts.some((d) => d.apr == null) && <p className="mt-2 text-xs text-amber-200">Some debts have no APR, so this comparison is incomplete.</p>}
        </Card>
        <TcoCard cur={cur} />
      </div>

      <Card title="How these numbers are calculated">
        <ul className="list-disc space-y-1 pl-5 text-xs text-fog-400">{scen.baseline.assumptions.map((a) => <li key={a}>{a}</li>)}<li>Starting point: accessible cash {money(s.cashAccessible, cur)}, current monthly items and debts exactly as entered under Actuals.</li></ul>
        {[...new Set([...scen.baseline.warnings, ...s.warnings])].length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200">{[...new Set([...scen.baseline.warnings, ...s.warnings])].map((w) => <li key={w}>{w}</li>)}</ul>}
      </Card>
    </div>
  );
}

function Slider({ label, value, set, min, max, step, fmt, hint, disabled }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string; hint?: string; disabled?: boolean }) {
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <label className="label flex justify-between"><span>{label}</span></label>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
      <div className="text-sm font-medium tabnum">{fmt(value)}</div>
      {hint && <div className="text-[11px] text-fog-500">{hint}</div>}
    </div>
  );
}

function TcoCard({ cur }: { cur: string }) {
  const [p, setP] = useState({ price: 70000, downPayment: 14000, apr: 3.5, termMonths: 48, annualRunning: 9000, years: 5, resalePct: 40 });
  const r = totalCostOfOwnership(p);
  const f = (key: keyof typeof p, label: string) => (
    <div key={key}><label className="label" htmlFor={`tco-${key}`}>{label}</label><input id={`tco-${key}`} className="input" type="number" value={p[key]} onChange={(e) => setP({ ...p, [key]: Number(e.target.value) })} /></div>
  );
  return (
    <Card title="Vehicle: total cost of ownership (scenario)">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {f("price", "Price")}{f("downPayment", "Down payment")}{f("apr", "Loan rate %")}
        {f("termMonths", "Term (months)")}{f("annualRunning", "Running cost / yr")}{f("years", "Years kept")}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Loan payment" value={money(r.monthlyPayment, cur)} />
        <Stat label="True cost / mo" value={money(r.perMonth, cur)} />
        <Stat label="Total cost" value={money(r.total, cur)} />
      </div>
      <p className="mt-2 text-[11px] text-fog-500">Example inputs are placeholders; replace them. Running cost should include insurance, registration, fuel, maintenance and parking. Resale assumed {p.resalePct}%.</p>
    </Card>
  );
}
