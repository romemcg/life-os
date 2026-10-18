"use client";
import { useEffect, useRef, useState } from "react";
import type { TableName } from "@/lib/schema";
import { api, type Row } from "@/lib/client";
import { Modal } from "./ui";
import { Trash2, Archive } from "lucide-react";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "textarea" | "checkbox" | "url";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  half?: boolean;
  suggestions?: string[];
  step?: string;
  min?: number;
  max?: number;
  rows?: number;
};

export function RecordForm({
  table,
  open,
  onClose,
  title,
  fields,
  initial,
  onSaved,
  allowDelete = true,
  allowArchive = false,
  transform,
  extraAction,
  wide,
}: {
  table: TableName;
  open: boolean;
  onClose: () => void;
  title: string;
  fields: Field[];
  initial?: Partial<Row> | null;
  onSaved?: (row: Row) => void;
  allowDelete?: boolean;
  allowArchive?: boolean;
  transform?: (v: Record<string, unknown>) => Record<string, unknown>;
  /** Second submit button: saves, then runs (e.g. "Build CV"). */
  extraAction?: { label: string; run: (row: Row) => void };
  wide?: boolean;
}) {
  const thenRef = useRef<((row: Row) => void) | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = !!initial?.id;

  useEffect(() => {
    if (open) {
      setValues({ ...(initial ?? {}) });
      setError(null);
    }
  }, [open, initial]);

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const then = thenRef.current;
    thenRef.current = null;
    for (const f of fields) {
      const v = values[f.name];
      if (f.required && (v === undefined || v === null || v === "")) return setError(`${f.label} is required`);
      if (f.type === "number" && v !== undefined && v !== null && v !== "" && !Number.isFinite(Number(v))) return setError(`${f.label} must be a number`);
    }
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      let v = values[f.name];
      if (f.type === "number" && v !== "" && v != null) v = Number(v);
      if (f.type === "select" && f.options && typeof f.options[0]?.value === "number" && v !== "" && v != null) v = Number(v);
      payload[f.name] = v === "" ? null : v;
    }
    // keep hidden defaults passed in `initial` for new records
    if (!editing && initial) for (const [k, v] of Object.entries(initial)) if (!(k in payload)) payload[k] = v;
    setBusy(true);
    try {
      const data = transform ? transform(payload) : payload;
      const row = editing ? await api.update(table, initial!.id!, data) : await api.create(table, data);
      onSaved?.(row as Row);
      onClose();
      then?.(row as Row);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!initial?.id || !confirm("Delete permanently? This cannot be undone.")) return;
    await api.remove(table, initial.id);
    onClose();
  }
  async function archive() {
    if (!initial?.id) return;
    await api.update(table, initial.id, { archived: true });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide={wide}>
      <form ref={formRef} onSubmit={submit} className="grid grid-cols-2 gap-3">
        {fields.map((f) => {
          const v = values[f.name];
          const common = { id: `f-${f.name}`, className: "input", placeholder: f.placeholder };
          return (
            <div key={f.name} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm text-fog-300">
                  <input type="checkbox" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} />
                  {f.label}
                </label>
              ) : (
                <>
                  <label className="label" htmlFor={`f-${f.name}`}>
                    {f.label}
                    {f.required && <span className="text-teal-400"> *</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea {...common} rows={f.rows ?? 3} value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} />
                  ) : f.type === "select" ? (
                    <select {...common} value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...common}
                      type={f.type ?? "text"}
                      step={f.step ?? (f.type === "number" ? "any" : undefined)}
                      min={f.min}
                      max={f.max}
                      inputMode={f.type === "number" ? "decimal" : undefined}
                      value={(v as string | number) ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      list={f.suggestions ? `dl-${f.name}` : undefined}
                    />
                  )}
                  {f.suggestions && <datalist id={`dl-${f.name}`}>{f.suggestions.map((o) => <option key={o} value={o} />)}</datalist>}
                </>
              )}
              {f.help && <p className="mt-1 text-[11px] text-fog-500">{f.help}</p>}
            </div>
          );
        })}
        {error && <p className="col-span-2 text-sm text-rose-300">{error}</p>}
        <div className="col-span-2 mt-1 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {editing && allowArchive && (
              <button type="button" className="btn-ghost" onClick={archive}><Archive size={14} /> Archive</button>
            )}
            {editing && allowDelete && (
              <button type="button" className="btn-danger" onClick={del}><Trash2 size={14} /> Delete</button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            {extraAction && <button type="button" className="btn-outline" disabled={busy} onClick={() => { thenRef.current = extraAction.run; formRef.current?.requestSubmit(); }}>{extraAction.label}</button>}
            <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save" : "Add"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
