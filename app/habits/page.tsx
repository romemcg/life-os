"use client";
import { useMemo, useState } from "react";
import { Plus, Pencil, Flame } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader, Card, Badge, Empty, PillarDot, clsx } from "@/components/ui";
import { RecordForm, type Field } from "@/components/RecordForm";
import { usePillars, habitFields } from "@/components/shared";
import { useSettings, useToday, useList, type Row } from "@/lib/client";
import { addDays, eachDay, fmtDate, weekRange } from "@/lib/dates";

const WEEKS = 12;
const METRIC_KINDS = [
  { value: "sleep_hours", label: "Sleep (hours)", unit: "h" },
  { value: "workout_min", label: "Workout (minutes)", unit: "min" },
  { value: "weight", label: "Body weight", unit: "kg" },
  { value: "waist", label: "Waist", unit: "cm" },
  { value: "steps", label: "Steps", unit: "" },
];

export default function HabitsPage() {
  const { settings } = useSettings();
  const today = useToday(settings.timezone);
  const { options: pillarOpts, byId } = usePillars();
  const habits = useList("habits");
  const [mon] = weekRange(today);
  const from = addDays(mon, -7 * (WEEKS - 1));
  const checks = useList("habit_checkins", { from, to: today });
  const metrics = useList("metrics");
  const [hForm, setHForm] = useState<Partial<Row> | null>(null);
  const [mForm, setMForm] = useState<Partial<Row> | null>(null);
  const days = useMemo(() => eachDay(from, addDays(mon, 6)), [from, mon]);

  const HABIT_FIELDS: Field[] = habitFields(pillarOpts);

  return (
    <div>
      <PageHeader
        title="Health"
        subtitle="Body and sleep numbers you choose to log. Your routines (workouts, cooking, sleep) live as tasks in Vision and are ticked in Today."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Body & sleep metrics (optional)" className="lg:col-span-2" action={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => setMForm({ date: today, kind: "sleep_hours" })}><Plus size={14} /> Log</button>}>
          <MetricCharts rows={metrics.rows} onEdit={setMForm} />
          <p className="mt-2 text-[11px] text-fog-500">Stored only on this machine. Track trends, not daily fluctuations. No targets are set for you.</p>
        </Card>
        <Card title="Fitness milestones (behaviour-based)">
          <ol className="space-y-2 text-sm">
            {[
              ["30 days", "3 sessions/week in 3 of 4 weeks; walking on rest days"],
              ["60 days", "Same plan held through a bad week; progressive loads logged"],
              ["90 days", "12 weeks mostly on target; review photos/measurements once"],
              ["180 days", "Training is default, not effort; meal plan routine stable"],
              ["365 days", "A year of mostly-on-target weeks; set the next block with a coach or plan"],
            ].map(([d, t]) => (
              <li key={d} className="flex gap-3"><span className="w-16 shrink-0 text-xs font-medium text-teal-300">{d}</span><span className="text-fog-300">{t}</span></li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-fog-500">Deliberately no weight or physique targets. Get medical advice before major diet or training changes.</p>
        </Card>
      </div>

      <RecordForm
        table="metrics"
        open={!!mForm}
        onClose={() => setMForm(null)}
        title={mForm?.id ? "Edit entry" : "Log metric"}
        initial={mForm}
        fields={[
          { name: "date", label: "Date", type: "date", required: true, half: true },
          { name: "kind", label: "Metric", type: "select", required: true, half: true, options: METRIC_KINDS.map((k) => ({ value: k.value, label: k.label })) },
          { name: "value", label: "Value", type: "number", required: true, half: true },
          { name: "note", label: "Note", half: true },
        ]}
        transform={(v) => ({ ...v, unit: METRIC_KINDS.find((k) => k.value === v.kind)?.unit })}
      />
    </div>
  );
}

function MetricCharts({ rows, onEdit }: { rows: Row[]; onEdit: (r: Row) => void }) {
  const kinds = METRIC_KINDS.filter((k) => rows.some((r) => r.kind === k.value));
  if (!kinds.length) return <Empty>Nothing logged. Sleep hours and workout minutes are the most useful to start with.</Empty>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {kinds.map((k) => {
        const data = rows.filter((r) => r.kind === k.value).sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
        const last = data[data.length - 1];
        return (
          <div key={k.value}>
            <div className="mb-1 flex items-baseline justify-between text-xs"><span className="text-fog-300">{k.label}</span><button className="tabnum muted hover:text-fog-100" onClick={() => onEdit(last)}>latest {last.value}{k.unit} · {fmtDate(last.date, { year: false })}</button></div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.map((r) => ({ d: fmtDate(r.date, { year: false }), v: r.value }))}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="d" hide />
                  <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} width={30} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "var(--chart-tip-bg)", border: "1px solid var(--chart-tip-border)", borderRadius: 8, fontSize: 12 }} />
                  <Line dataKey="v" name={k.label} stroke="#2563eb" strokeWidth={2} dot={data.length < 15} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

