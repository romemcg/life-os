"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Star, CalendarClock, MoreHorizontal, Repeat, Pencil, ArrowUpToLine } from "lucide-react";
import clsx from "clsx";
import { type Row } from "@/lib/client";
import { doToday } from "./useDayPlan";
import { PillarDot, Badge } from "./ui";
import { LinkChips } from "./LinkPicker";
import { TrackChip } from "./TaskLog";
import { isRecurring, describeRule } from "@/lib/recurrence";
import { relativeDay, addDays, agoDay } from "@/lib/dates";

export function TaskRow({
  task,
  today,
  done,
  pillarColor,
  reasons,
  starred,
  onToggle,
  onStar,
  onReschedule,
  onEdit,
  onPull,
  suggested,
  weekCount,
}: {
  task: Row;
  today: string;
  done?: boolean;
  pillarColor?: string;
  reasons?: string[];
  starred?: boolean;
  onToggle?: () => void;
  onStar?: () => void;
  onReschedule?: (to?: string) => void;
  onEdit?: () => void;
  onPull?: () => void;
  suggested?: boolean;
  weekCount?: number;
}) {
  const [menu, setMenu] = useState(false);
  const [burst, setBurst] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [menu]);
  const recurring = isRecurring(task);
  const overdue = !recurring && task.due_date && task.due_date < today && !done;
  return (
    <div className={clsx("group relative flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-all duration-200 hover:bg-ink-850", done && "opacity-55")}>
      {onToggle ? (
        <button
          onClick={() => { if (!done) setBurst((b) => b + 1); onToggle(); }}
          aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          key={burst}
          className={clsx("mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-all duration-200", burst > 0 && "pop ring-pulse", done ? "border-transparent text-white shadow-sm shadow-teal-500/40" : "border-ink-600 text-transparent hover:border-teal-500 hover:bg-teal-500/10 hover:text-teal-500/60")}
          style={done ? { background: pillarColor && /^#[0-9a-f]{6}$/i.test(pillarColor) ? pillarColor : "rgb(var(--teal-500))" } : undefined}
        >
          <Check size={13} strokeWidth={3.2} />
        </button>
      ) : (
        <span role="img" aria-label={done ? "Done" : "Open"} className={clsx("mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-dashed", done ? "border-teal-500/60 text-teal-400" : "border-ink-600")}>
          {done && <Check size={13} strokeWidth={3} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={clsx("text-[14px] font-medium leading-5 transition-colors", done && "text-fog-400 line-through decoration-fog-500/70")}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-fog-400">
          <PillarDot color={pillarColor} />
          {task.scheduled_time && <span className="tabnum">{task.scheduled_time}</span>}
          <span className="tabnum">{task.duration_min ?? 30} min</span>
          {recurring ? (
            <span className="inline-flex items-center gap-1"><Repeat size={11} />{describeRule(task.recurrence)}{weekCount != null && <span className="tabnum"> · {weekCount} this week</span>}</span>
          ) : done && task.completed_at ? (
            <span>Done {agoDay(String(task.completed_at).slice(0, 10), today)}</span>
          ) : task.due_date ? (
            <span className={overdue ? "text-amber-300" : ""}>{relativeDay(task.due_date, today)}</span>
          ) : !done ? (
            <span>Anytime</span>
          ) : null}
          {suggested && !done && <Badge tone="teal" title="Picked by the planner for your day mode">Suggested</Badge>}
          {task.priority === 1 && <Badge tone="teal">P1</Badge>}
          {task.essential && <Badge tone="gray">Essential</Badge>}
          {task.deep && <Badge tone="blue">Focus</Badge>}
          {!done && <LinkChips task={task} />}
          {task.log_to && <TrackChip task={task} />}
          {(task.reschedule_count ?? 0) >= 3 && <Badge tone="amber" title="Consider shrinking, splitting or dropping it">Moved {task.reschedule_count}×</Badge>}
        </div>
        {reasons && reasons.length > 0 && <div className="mt-1 hidden text-[10px] text-fog-500 group-hover:block">Why: {reasons.join(" · ")}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onPull && (
          <button className="btn-ghost p-1.5" title="Pull into today" aria-label="Pull into today" onClick={onPull}><ArrowUpToLine size={15} /></button>
        )}
        {onEdit && !done && (
          <button className="btn-ghost p-1.5 opacity-60 group-hover:opacity-100" title="Edit task" aria-label={`Edit "${task.title}"`} onClick={onEdit}><Pencil size={14} /></button>
        )}
        {onStar && !done && (
          <button className={clsx("btn-ghost p-1.5", starred ? "text-amber-300" : "opacity-60 group-hover:opacity-100")} title="Top 3" aria-label="Toggle top 3" onClick={onStar}>
            <Star size={15} fill={starred ? "currentColor" : "none"} />
          </button>
        )}
        {!done && onReschedule && (
          <div className="relative" ref={menuRef}>
            <button className="btn-ghost p-1.5 opacity-60 group-hover:opacity-100" aria-label="More" onClick={() => setMenu((m) => !m)}><MoreHorizontal size={15} /></button>
            {menu && (
              <div className="fade-up absolute right-0 top-8 z-20 w-52 rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
                {!recurring && task.due_date && task.due_date > today && (
                  <MenuItem icon={<ArrowUpToLine size={14} />} onClick={() => { setMenu(false); doToday(task.id, today); }}>Do it today</MenuItem>
                )}
                <MenuItem icon={<CalendarClock size={14} />} onClick={() => { setMenu(false); onReschedule(); }}>{recurring ? "Skip today" : "Move to tomorrow"}</MenuItem>
                {!recurring && <MenuItem icon={<CalendarClock size={14} />} onClick={() => { setMenu(false); onReschedule(addDays(today, 7)); }}>Move to next week</MenuItem>}
                {!recurring && (
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fog-300 hover:bg-ink-700">
                    <CalendarClock size={14} /> Pick date
                    <input type="date" aria-label="Pick a date" className="ml-auto w-[105px] bg-transparent text-xs" onChange={(e) => { if (e.target.value) { setMenu(false); onReschedule(e.target.value); } }} />
                  </label>
                )}
                {onEdit && <MenuItem icon={<Pencil size={14} />} onClick={() => { setMenu(false); onEdit(); }}>Edit task</MenuItem>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fog-300 hover:bg-ink-700" onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
