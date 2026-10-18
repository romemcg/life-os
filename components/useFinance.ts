"use client";
import { useMemo } from "react";
import { useList } from "@/lib/client";
import { summarize, simulate, type Account, type Debt, type Cashflow, type Obligation } from "@/lib/finance";

export function useFinance(today: string, currency = "AED") {
  const accounts = useList("accounts");
  const debts = useList("debts");
  const cashflows = useList("cashflows");
  const obligations = useList("obligations");
  const loading = accounts.loading || debts.loading || cashflows.loading || obligations.loading;

  return useMemo(() => {
    const acc = accounts.rows as unknown as Account[];
    const dbt = debts.rows as unknown as Debt[];
    const cf = cashflows.rows as unknown as Cashflow[];
    const ob = obligations.rows as unknown as Obligation[];
    const s = summarize(acc, dbt, cf, currency);
    // Status-quo runway: current income/spending, minimum payments, one-off obligations included.
    const sim = simulate({
      start: today,
      months: 60,
      cash: s.cashAccessible,
      debts: dbt,
      incomeNow: s.income,
      essential: s.essential,
      discretionary: s.discretionary,
      obligations: ob,
      strategy: "minimum",
    });
    const pendingObligations = ob.filter((o) => o.status !== "paid");
    return {
      loading,
      summary: s,
      statusQuo: sim,
      accounts: accounts.rows,
      debts: debts.rows,
      cashflows: cashflows.rows,
      obligations: obligations.rows,
      pendingObligations,
      hasBaseline: acc.length > 0 && cf.some((c) => c.kind === "essential"),
    };
  }, [accounts.rows, debts.rows, cashflows.rows, obligations.rows, today, currency, loading]);
}
