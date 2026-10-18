// Transparent personal-finance calculations. Pure functions, no I/O.
// Rule: missing inputs are reported as warnings, never silently invented.
import { addMonths } from "./dates";

export interface Account { name: string; balance: number; currency?: string | null; accessible?: boolean | null; archived?: boolean }
export interface Debt { id?: number; name: string; balance: number; apr?: number | null; min_payment?: number | null; archived?: boolean }
export interface Cashflow { name: string; kind: string; amount: number; active?: boolean | null; archived?: boolean }
export interface Obligation { name: string; amount: number; due_date?: string | null; status?: string | null; archived?: boolean }

const live = <T extends { archived?: boolean }>(xs: T[]) => xs.filter((x) => !x.archived);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(accounts: Account[], debts: Debt[], cashflows: Cashflow[], baseCurrency = "AED") {
  const warnings: string[] = [];
  const acc = live(accounts);
  const inBase = acc.filter((a) => !a.currency || a.currency.toUpperCase() === baseCurrency);
  const foreign = acc.filter((a) => a.currency && a.currency.toUpperCase() !== baseCurrency);
  if (foreign.length)
    warnings.push(`${foreign.length} account(s) not in ${baseCurrency} are excluded (no conversion rate entered).`);
  const cashTotal = inBase.reduce((s, a) => s + (a.balance || 0), 0);
  const cashAccessible = inBase.filter((a) => a.accessible !== false).reduce((s, a) => s + (a.balance || 0), 0);

  const dl = live(debts);
  const debtTotal = dl.reduce((s, d) => s + (d.balance || 0), 0);
  const minPayments = dl.reduce((s, d) => s + (d.min_payment || 0), 0);
  for (const d of dl) {
    if (d.apr == null) warnings.push(`"${d.name}": interest rate missing; payoff dates exclude interest.`);
    if (d.min_payment == null) warnings.push(`"${d.name}": minimum payment missing; cash flow understates outflows.`);
  }

  const cf = live(cashflows).filter((c) => c.active !== false);
  const sum = (k: string) => cf.filter((c) => c.kind === k).reduce((s, c) => s + (c.amount || 0), 0);
  const income = sum("income");
  const essential = sum("essential");
  const discretionary = sum("discretionary");
  const netMonthly = income - essential - discretionary - minPayments;
  const burn = Math.max(0, -netMonthly);

  return {
    cashTotal: r2(cashTotal),
    cashAccessible: r2(cashAccessible),
    debtTotal: r2(debtTotal),
    netWorth: r2(cashTotal - debtTotal),
    income: r2(income),
    essential: r2(essential),
    discretionary: r2(discretionary),
    minPayments: r2(minPayments),
    netMonthly: r2(netMonthly),
    burn: r2(burn),
    /** months of runway at current burn, ignoring one-off obligations. Infinity if not burning. */
    simpleRunwayMonths: burn > 0 ? cashAccessible / burn : Infinity,
    debtToIncome: income > 0 ? minPayments / income : null,
    savingsRate: income > 0 ? netMonthly / income : null,
    hasData: acc.length + dl.length + cf.length > 0,
    warnings,
  };
}

export function emergencyFundTarget(months: number, essential: number, minPayments: number) {
  return r2(months * (essential + minPayments));
}

/** Months needed to reach target saving `perMonth`. null if never. */
export function monthsToTarget(current: number, target: number, perMonth: number): number | null {
  if (current >= target) return 0;
  if (perMonth <= 0) return null;
  return Math.ceil((target - current) / perMonth);
}

export type Strategy = "minimum" | "avalanche" | "snowball";

export interface SimInput {
  start: string; // first day of month 0
  months: number;
  cash: number;
  debts: Debt[];
  incomeNow: number; // current recurring monthly income
  job?: { startDate: string; netSalary: number } | null;
  essential: number;
  discretionary: number;
  obligations?: Obligation[];
  strategy: Strategy;
  extraPayment?: number; // extra monthly amount toward debt (only paid if cash stays above buffer)
  cashBuffer?: number;
}

export interface SimRow { month: string; income: number; outflow: number; interest: number; debtPaid: number; cash: number; debt: number }

export function simulate(input: SimInput) {
  const warnings: string[] = [];
  const debts = live(input.debts).map((d) => ({ name: d.name, bal: Math.max(0, d.balance || 0), apr: d.apr ?? 0, min: d.min_payment ?? 0, paidAt: null as string | null }));
  let cash = input.cash;
  const rows: SimRow[] = [];
  const obligations = live(input.obligations ?? []).filter((o) => o.status !== "paid" && o.due_date);
  const startMonth = input.start.slice(0, 7) + "-01";
  // Assumption: first salary arrives one month after the job start month.
  const salaryFrom = input.job ? addMonths(input.job.startDate.slice(0, 7) + "-01", 1) : null;
  let runOutMonth: string | null = null;
  let debtFreeMonth: string | null = debts.every((d) => d.bal <= 0.005) ? startMonth : null;
  let totalInterest = 0;
  let missedFrom: string | null = null;
  let minCash = input.cash;
  const payoffs: { name: string; month: string }[] = [];

  for (const d of debts) {
    if (d.bal > 0 && d.min > 0 && d.min <= (d.bal * d.apr) / 1200)
      warnings.push(`"${d.name}": minimum payment does not cover monthly interest; balance grows on minimums alone.`);
  }

  for (let i = 0; i < input.months; i++) {
    const month = addMonths(startMonth, i);
    const next = addMonths(startMonth, i + 1);
    const salary = salaryFrom && month >= salaryFrom ? input.job!.netSalary : 0;
    const income = input.incomeNow + salary;
    const lump = obligations.filter((o) => o.due_date! >= month && o.due_date! < next).reduce((s, o) => s + o.amount, 0);
    // Overdue obligations (before the simulation start) are charged in month 0.
    const overdue = i === 0 ? obligations.filter((o) => o.due_date! < month).reduce((s, o) => s + o.amount, 0) : 0;
    const outflow = input.essential + input.discretionary + lump + overdue;
    cash += income - outflow;

    let interest = 0;
    let paid = 0;
    let freed = 0;
    for (const d of debts) {
      if (d.bal <= 0.005) {
        freed += d.min;
        continue;
      }
      const int = (d.bal * d.apr) / 1200;
      d.bal += int;
      interest += int;
      // Minimums can only be paid from cash actually available; shortfalls are recorded, not hidden.
      const due = Math.min(d.min, d.bal);
      const pay = Math.min(due, Math.max(0, cash));
      if (pay < due - 0.005 && !missedFrom) missedFrom = month;
      d.bal -= pay;
      cash -= pay;
      paid += pay;
    }

    if (input.strategy !== "minimum") {
      let pool = Math.min((input.extraPayment ?? 0) + freed, Math.max(0, cash - (input.cashBuffer ?? 0)));
      const order = debts
        .filter((d) => d.bal > 0.005)
        .sort((a, b) => (input.strategy === "avalanche" ? b.apr - a.apr || a.bal - b.bal : a.bal - b.bal || b.apr - a.apr));
      for (const d of order) {
        if (pool <= 0) break;
        const pay = Math.min(pool, d.bal);
        d.bal -= pay;
        pool -= pay;
        cash -= pay;
        paid += pay;
      }
    }

    for (const d of debts) {
      if (d.bal <= 0.005 && !d.paidAt) {
        d.bal = 0;
        d.paidAt = month;
        payoffs.push({ name: d.name, month });
      }
    }
    totalInterest += interest;
    const debt = debts.reduce((s, d) => s + d.bal, 0);
    if (runOutMonth === null && cash < 0) runOutMonth = month;
    minCash = Math.min(minCash, cash);
    if (debtFreeMonth === null && debt <= 0.005) debtFreeMonth = month;
    rows.push({ month, income: r2(income), outflow: r2(outflow), interest: r2(interest), debtPaid: r2(paid), cash: r2(cash), debt: r2(debt) });
  }

  if (missedFrom) warnings.push(`Cash can't cover minimum payments from ${missedFrom.slice(0, 7)}; missed payments mean fees and credit damage in reality.`);
  return { rows, runOutMonth, debtFreeMonth, missedFrom, minCash: r2(minCash), totalInterest: r2(totalInterest), payoffs, warnings, assumptions: [
    "Monthly steps; interest = balance x APR / 12 (APR in %).",
    "Minimum payments are paid first, but only from available cash; a shortfall is flagged, not borrowed.",
    "Extra payments only come from cash above the buffer.",
    "Freed-up minimums roll into the extra payment (avalanche/snowball).",
    "Job scenario: first salary arrives one month after the start month.",
    "One-off obligations are charged in the month they fall due; overdue ones in month 1.",
    "No inflation, raises or investment returns are assumed.",
  ] };
}

export function compareStrategies(base: Omit<SimInput, "strategy">) {
  const av = simulate({ ...base, strategy: "avalanche" });
  const sn = simulate({ ...base, strategy: "snowball" });
  const mn = simulate({ ...base, strategy: "minimum" });
  return { avalanche: av, snowball: sn, minimum: mn };
}

/** Total cost of ownership for a vehicle or similar asset over `years`. */
export function totalCostOfOwnership(p: { price: number; downPayment: number; apr: number; termMonths: number; annualRunning: number; years: number; resalePct: number }) {
  const principal = Math.max(0, p.price - p.downPayment);
  const r = p.apr / 1200;
  const payment = principal === 0 ? 0 : r === 0 ? principal / p.termMonths : (principal * r) / (1 - Math.pow(1 + r, -p.termMonths));
  const financePaid = payment * Math.min(p.termMonths, p.years * 12);
  const interest = payment * p.termMonths - principal;
  const resale = p.price * (p.resalePct / 100);
  const total = p.downPayment + financePaid + p.annualRunning * p.years - resale;
  return { monthlyPayment: r2(payment), totalInterest: r2(interest), total: r2(total), perMonth: r2(total / (p.years * 12)) };
}
