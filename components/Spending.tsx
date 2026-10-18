"use client";
import { useMemo, useState } from "react";
import { Plus, Banknote, CreditCard, Landmark, Trash2, ShoppingCart, Bike, UtensilsCrossed, Car, Home, Zap, Smartphone, HeartPulse, Sparkles, Users, Receipt, CircleDot, Check } from "lucide-react";
import clsx from "clsx";
import { useList, api, money, type Row } from "@/lib/client";
import { fmtDate, fmtMonth, monthRange, addMonths } from "@/lib/dates";
import { Card, Segmented, Empty } from "./ui";

export type Method = "cash" | "debit" | "credit";
export const METHODS: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "debit", label: "Debit card", icon: Landmark },
  { value: "credit", label: "Credit card", icon: CreditCard },
];
export const CAT_META: Record<string, { icon: typeof Banknote; color: string }> = {
  Groceries: { icon: ShoppingCart, color: "#22c55e" },
  "Food delivery": { icon: Bike, color: "#f97316" },
  "Eating out": { icon: UtensilsCrossed, color: "#f59e0b" },
  Transport: { icon: Car, color: "#0ea5e9" },
  Rent: { icon: Home, color: "#6366f1" },
  Utilities: { icon: Zap, color: "#eab308" },
  Telecom: { icon: Smartphone, color: "#8b5cf6" },
  Health: { icon: HeartPulse, color: "#f43f5e" },
  "Personal care": { icon: Sparkles, color: "#ec4899" },
  "Family support": { icon: Users, color: "#14b09e" },
  Fees: { icon: Receipt, color: "#64748b" },
};
export const catMeta = (c?: string | null) => CAT_META[c ?? ""] ?? { icon: CircleDot, color: "#94a3b8" };
const QUICK = ["Groceries", "Food delivery", "Eating out", "Transport", "Telecom", "Personal care"];

export function CatIcon({ category, size = 34 }: { category?: string | null; size?: number }) {
  const m = catMeta(category);
  return <span className="grid shrink-0 place-items-center rounded-xl" style={{ width: size, height: size, background: `${m.color}1f`, color: m.color }}><m.icon size={size * 0.47} /></span>;
}
export const CATEGORIES = ["Groceries", "Food delivery", "Eating out", "Transport", "Rent", "Utilities", "Telecom", "Health", "Personal care", "Family support", "Fees", "Other"];

/** Where the money came from: accounts for cash/debit, debts (cards) for credit. */
export function useSources() {
  const accounts = useList("accounts");
  const debts = useList("debts");
  return useMemo(() => {
    const forMethod = (m: Method) =>
      m === "credit"
        ? debts.rows.filter((d) => !d.type || d.type === "credit card").map((d) => ({ key: `d${d.id}`, label: d.name as string }))
        : accounts.rows.filter((a) => (m === "cash" ? a.type === "cash" : a.type !== "cash" && a.type !== "investment")).map((a) => ({ key: `a${a.id}`, label: a.name as string }));
    const labelOf = (e: Row) => {
      if (e.debt_id) return (debts.rows.find((d) => d.id === e.debt_id)?.name as string) ?? null;
      if (e.account_id) return (accounts.rows.find((a) => a.id === e.account_id)?.name as string) ?? null;
      return null;
    };
    return { forMethod, labelOf };
  }, [accounts.rows, debts.rows]);
}

export function methodLabel(m?: string | null) {
  return METHODS.find((x) => x.value === m)?.label ?? "Not set";
}

/** Quick add: amount, category, how it was paid, and which card or account. */
export function SpendForm({ date, compact }: { date: string; compact?: boolean }) {
  const { forMethod } = useSources();
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("");
  const [method, setMethod] = useState<Method>("debit");
  const [source, setSource] = useState("");
  const [essential, setEssential] = useState(false);
  const [day, setDay] = useState(date);
  const sources = forMethod(method);
  // only one cash pot or one account for this method: use it, so the balance moves
  const effectiveSource = source || (sources.length === 1 ? sources[0].key : "");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) return;
    await api.create("expenses", {
      date: compact ? date : day,
      amount: n,
      category: cat || "Other",
      essential,
      method,
      account_id: effectiveSource.startsWith("a") ? Number(effectiveSource.slice(1)) : null,
      debt_id: effectiveSource.startsWith("d") ? Number(effectiveSource.slice(1)) : null,
    });
    setAmount("");
    setCat("");
  }

  const n = Number(amount);
  const [flash, setFlash] = useState(false);
  return (
    <form onSubmit={async (e) => { await add(e); if (n > 0) { setFlash(true); setTimeout(() => setFlash(false), 1800); } }} className="space-y-3">
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-ink-700 bg-ink-850/60 px-3.5 py-2 transition-all focus-within:border-teal-500 focus-within:bg-ink-900 focus-within:ring-4 focus-within:ring-teal-500/10">
          <span className="text-xs font-semibold muted">AED</span>
          <input className="w-full min-w-0 bg-transparent text-xl font-bold tabnum tracking-tight placeholder:font-medium placeholder:text-fog-500 focus:outline-none" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        </label>
        {!compact && <input className="input w-40" type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" />}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
        {QUICK.map((c) => {
          const m = catMeta(c); const on = cat === c;
          return (
            <button key={c} type="button" role="radio" aria-checked={on} onClick={() => setCat(on ? "" : c)}
              className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95", on ? "shadow-sm" : "border-ink-700 bg-ink-850/60 text-fog-300 hover:-translate-y-0.5 hover:border-ink-600")}
              style={on ? { borderColor: m.color, background: `${m.color}1f`, color: m.color } : undefined}>
              <m.icon size={13} style={on ? undefined : { color: m.color }} />{c}
            </button>
          );
        })}
        <input className={clsx("min-w-[7rem] flex-1 rounded-full border bg-ink-850/60 px-3 py-1 text-xs focus:border-teal-500 focus:outline-none", cat && !QUICK.includes(cat) ? "border-teal-500 text-teal-300" : "border-ink-700")} list="exp-cats" placeholder="Other category…" value={QUICK.includes(cat) ? "" : cat} onChange={(e) => setCat(e.target.value)} aria-label="Other category" />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {METHODS.map((m) => {
          const on = method === m.value;
          return (
            <button key={m.value} type="button" aria-pressed={on} onClick={() => { setMethod(m.value); setSource(""); }}
              className={clsx("flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95", on ? "border-teal-500 bg-teal-500/10 text-teal-300" : "border-ink-700 text-fog-400 hover:border-ink-600 hover:text-fog-100")}>
              <m.icon size={14} />{m.label.replace(" card", "")}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto min-w-0 flex-1 py-1.5 text-xs" value={effectiveSource} onChange={(e) => setSource(e.target.value)} aria-label="Paid from">
          <option value="">{sources.length ? "Which one? (optional)" : method === "credit" ? "No cards added in Money" : "No accounts added in Money"}</option>
          {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button type="button" aria-pressed={essential} onClick={() => setEssential((v) => !v)}
          className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all", essential ? "border-sky-400/50 bg-sky-400/10 text-sky-300" : "border-ink-700 text-fog-400 hover:text-fog-100")}>
          {essential && <Check size={12} strokeWidth={3} />}Essential
        </button>
      </div>

      <button className="btn-primary w-full" disabled={!(n > 0)}>
        {flash ? <><Check size={15} strokeWidth={3} />Logged</> : <><Plus size={15} />{n > 0 ? `Add ${money(n, "AED", 2)}${cat ? ` · ${cat}` : ""}` : "Add spending"}</>}
      </button>
      <datalist id="exp-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
    </form>
  );
}

/** Full spending history for the Money tab: month picker, method filter, totals by method and category. */
export function SpendingHistory({ today, cur }: { today: string; cur: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState<"all" | Method>("all");
  const [mStart, mEnd] = monthRange(`${month}-01`);
  const { rows, loading } = useList("expenses", { from: mStart, to: mEnd });
  const { labelOf, forMethod } = useSources();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(today.slice(0, 7) + "-01", -i).slice(0, 7));

  const shown = rows.filter((r) => filter === "all" || r.method === filter);
  const total = rows.reduce((t, r) => t + (r.amount as number), 0);
  const byMethod = [...METHODS.map((m) => m.value), null].map((m) => ({ m, sum: rows.filter((r) => (r.method ?? null) === m).reduce((t, r) => t + (r.amount as number), 0) })).filter((x) => x.sum > 0);
  const byDay = useMemo(() => {
    const g = new Map<string, Row[]>();
    for (const r of shown) g.set(r.date as string, [...(g.get(r.date as string) ?? []), r]);
    return [...g.entries()];
  }, [shown]);

  return (
    <div className="space-y-4">
      <Card title="Add spending">
        <SpendForm date={today} />
      </Card>

      <Card
        title="Spending history"
        action={
          <select className="input w-auto py-1 text-xs" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m + "-01")}</option>)}
          </select>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-ink-700 px-3 py-2"><div className="text-[11px] muted">Total</div><div className="font-semibold tabnum">{money(total, cur, 2)}</div></div>
          {byMethod.map((x) => (
            <div key={x.m ?? "none"} className="rounded-lg border border-ink-700 px-3 py-2"><div className="text-[11px] muted">{methodLabel(x.m)}</div><div className="font-semibold tabnum">{money(x.sum, cur, 2)}</div></div>
          ))}
        </div>
        <div className="mb-2">
          <Segmented<"all" | Method> size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, ...METHODS.map((m) => ({ value: m.value, label: m.label }))]} />
        </div>
        {loading ? (
          <p className="py-4 text-sm muted">Loading…</p>
        ) : shown.length === 0 ? (
          <Empty>No spending logged {filter === "all" ? "" : `by ${methodLabel(filter).toLowerCase()} `}in {fmtMonth(mStart)}.</Empty>
        ) : (
          <div className="space-y-3">
            {byDay.map(([d, list]) => (
              <div key={d}>
                <div className="flex items-center justify-between border-b border-ink-800 pb-1 text-xs muted">
                  <span>{fmtDate(d, { weekday: true })}</span>
                  <span className="tabnum">{money(list.reduce((t, r) => t + (r.amount as number), 0), cur, 2)}</span>
                </div>
                <ul className="divide-y divide-ink-800">
                  {list.map((r) => {
                    const M = METHODS.find((m) => m.value === r.method);
                    const src = labelOf(r);
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                        <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink-800", !M && "text-fog-500")}>{M ? <M.icon size={14} /> : "?"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.category}{r.note ? ` · ${r.note}` : ""}</span>
                          <span className="block text-[11px] muted">{methodLabel(r.method)}{src ? ` · ${src}` : ""}{r.essential ? " · essential" : " · discretionary"}</span>
                        </span>
                        <select className="input w-auto py-0.5 text-[11px]" value={(r.method as string) ?? ""} aria-label="Change payment method" onChange={(e) => api.update("expenses", r.id, { method: e.target.value || null, account_id: null, debt_id: null })}>
                          <option value="">Not set</option>
                          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        {r.method && (
                          <select
                            className={clsx("input w-auto max-w-[9rem] py-0.5 text-[11px]", !r.account_id && !r.debt_id && "border-amber-400/50 text-amber-300")}
                            value={r.debt_id ? `d${r.debt_id}` : r.account_id ? `a${r.account_id}` : ""}
                            aria-label="Paid from which card or account"
                            onChange={(e) => { const v = e.target.value; api.update("expenses", r.id, { account_id: v.startsWith("a") ? Number(v.slice(1)) : null, debt_id: v.startsWith("d") ? Number(v.slice(1)) : null }); }}
                          >
                            <option value="">Which one?</option>
                            {forMethod(r.method as Method).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </select>
                        )}
                        <span className="w-24 text-right tabnum">{money(r.amount, cur, 2)}</span>
                        <button className="btn-ghost p-1 text-fog-500 hover:text-rose-300" aria-label="Delete expense" onClick={() => api.remove("expenses", r.id)}><Trash2 size={14} /></button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-fog-500">When an entry says which card or account paid, that balance updates automatically: cash and debit lower the account, credit raises the card&apos;s debt. Entries marked in amber don&apos;t say which one yet, so they haven&apos;t moved any balance. Deleting or changing an entry corrects the balance.</p>
      </Card>
    </div>
  );
}
