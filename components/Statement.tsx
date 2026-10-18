"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Banknote } from "lucide-react";
import { RecordForm } from "./RecordForm";
import { Badge } from "./ui";
import { money, type Row } from "@/lib/client";
import { fmtDate, relativeDay, diffDays } from "@/lib/dates";

/** What's left to pay on the latest statement. */
export function statementLeft(d: Row) {
  const amt = Number(d.statement_amount) || 0;
  return Math.max(0, Math.round((amt - (Number(d.statement_paid) || 0)) * 100) / 100);
}

/** Statement column for a card: log this cycle's statement, record a payment. */
export function StatementCell({ debt, accounts, today, cur }: { debt: Row; accounts: Row[]; today: string; cur: string }) {
  const [stmt, setStmt] = useState(false);
  const [pay, setPay] = useState(false);
  const has = debt.statement_amount != null && Number(debt.statement_amount) > 0;
  const left = statementLeft(debt);
  const due = debt.statement_due as string | null;
  const tone = !has ? "gray" : left === 0 ? "teal" : due && diffDays(today, due) <= 0 ? "rose" : due && diffDays(today, due) <= 3 ? "amber" : "blue";
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const acctOpts = accounts.filter((a) => a.type !== "investment").map((a) => ({ value: a.id as number, label: `${a.name} (${money(a.balance, a.currency || cur)})` }));

  return (
    <div onClick={stop} className="flex flex-col items-end gap-1">
      {has ? (
        <Badge tone={tone as never} title={`Statement ${debt.statement_date ? `of ${fmtDate(debt.statement_date)}` : ""}: ${money(debt.statement_amount, cur, 2)}`}>
          {left === 0 ? "Paid" : `${money(left, cur, 2)}${due ? ` · ${relativeDay(due, today)}` : ""}`}
        </Badge>
      ) : (
        <span className="text-[11px] muted">No statement</span>
      )}
      <div className="flex gap-1">
        <button className="btn-ghost px-1.5 py-0.5 text-[11px]" title="Log this cycle's statement" onClick={() => setStmt(true)}><FileText size={11} /> Statement</button>
        <button className="btn-ghost px-1.5 py-0.5 text-[11px]" title="Record a payment to this card" onClick={() => setPay(true)}><Banknote size={11} /> Pay</button>
      </div>
      {typeof document !== "undefined" && createPortal(
        <>
          <RecordForm
            table="debts"
            open={stmt}
            onClose={() => setStmt(false)}
            title={`Statement · ${debt.name}`}
            initial={{ ...debt, statement_date: debt.statement_amount ? debt.statement_date : today }}
            allowDelete={false}
            fields={[
              { name: "statement_amount", label: "Amount to pay this statement", type: "number", required: true, half: true, help: "The figure on the statement you plan to pay (minimum or full)." },
              { name: "statement_due", label: "Payment due date", type: "date", half: true },
              { name: "statement_date", label: "Statement date", type: "date", half: true },
              { name: "balance", label: "Outstanding balance on the statement", type: "number", half: true, help: "Optional. Updates the card's balance to the statement figure." },
            ]}
            transform={(v) => ({ ...v, statement_paid: debt.statement_date === v.statement_date ? debt.statement_paid ?? 0 : 0, as_of: v.statement_date ?? today })}
          />
          <RecordForm
            table="debt_payments"
            open={pay}
            onClose={() => setPay(false)}
            title={`Pay · ${debt.name}`}
            initial={{ debt_id: debt.id, date: today, amount: left || undefined, account_id: acctOpts[0]?.value }}
            allowDelete={false}
            fields={[
              { name: "amount", label: "Amount paid", type: "number", required: true, half: true },
              { name: "date", label: "Date", type: "date", required: true, half: true },
              { name: "account_id", label: "Paid from", type: "select", options: acctOpts, help: "That account's balance goes down by the same amount. The card's debt goes down too." },
              { name: "note", label: "Note" },
            ]}
          />
        </>,
        document.body
      )}
    </div>
  );
}
