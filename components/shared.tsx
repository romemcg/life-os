"use client";
import { useMemo } from "react";
import { useList, type Row } from "@/lib/client";
import type { Field } from "./RecordForm";
import { STAGES } from "@/lib/stages";

export function usePillars() {
  const { rows } = useList("pillars");
  return useMemo(() => {
    const byId = new Map<number, Row>(rows.map((p) => [p.id, p]));
    return { pillars: rows, byId, options: rows.map((p) => ({ value: p.id, label: p.name as string })) };
  }, [rows]);
}

export const PRIORITY_OPTIONS = [
  { value: 1, label: "P1 · High" },
  { value: 2, label: "P2 · Medium" },
  { value: 3, label: "P3 · Low" },
];

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "times:6", label: "6 days a week (any days)" },
  { value: "times:5", label: "5 days a week (any days)" },
  { value: "times:4", label: "4 days a week (any days)" },
  { value: "times:3", label: "3 days a week (any days)" },
  { value: "times:2", label: "2 days a week (any days)" },
  { value: "weekly:1,3,5", label: "Mon, Wed, Fri" },
  { value: "weekly:2,4", label: "Tue, Thu" },
  { value: "weekly:0", label: "Weekly (Sunday)" },
  { value: "weekly:6", label: "Weekly (Saturday)" },
  { value: "monthly:1", label: "Monthly (1st)" },
  { value: "monthly:25", label: "Monthly (25th)" },
];

type Opt = { value: number; label: string };
export function taskFields(pillarOpts: Opt[], milestoneOpts: Opt[], projectOpts: Opt[] = [], trackOpts: { value: string; label: string }[] = []): Field[] {
  return [
    { name: "title", label: "Task", required: true, placeholder: "Small enough to start in 2 minutes" },
    { name: "description", label: "Notes", type: "textarea" },
    { name: "pillar_id", label: "Life area", type: "select", options: pillarOpts, half: true },
    { name: "milestone_id", label: "Milestone", type: "select", options: milestoneOpts, half: true, help: "Change these to move the task." },
    ...(projectOpts.length ? [{ name: "project_id", label: "Project", type: "select" as const, options: projectOpts }] : []),
    { name: "due_date", label: "Due / start date", type: "date", half: true, help: "For recurring tasks this is the start date." },
    { name: "scheduled_time", label: "Time (places it on your timeline)", type: "time", half: true },
    { name: "recurrence", label: "Repeat", type: "select", options: RECURRENCE_OPTIONS, half: true },
    { name: "duration_min", label: "Minutes", type: "number", half: true, min: 1 },
    { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, half: true },
    { name: "essential", label: "Essential (part of Minimum Day)", type: "checkbox", half: true },
    { name: "deep", label: "Needs deep focus", type: "checkbox", half: true },
    ...(trackOpts.length ? [{ name: "log_to", label: "Track it in", type: "select" as const, options: trackOpts, help: "Optional. When you tick it in Today, you can log pages, minutes or a note there (a habit is checked automatically)." }] : []),
  ];
}

export const MILESTONE_KINDS = [
  { value: "committed", label: "Committed" },
  { value: "conditional", label: "Conditional" },
  { value: "aspirational", label: "Aspirational" },
];
export const MILESTONE_STATUS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "dropped", label: "Dropped" },
];

export function milestoneFields(pillarOpts: { value: number; label: string }[]): Field[] {
  return [
    { name: "title", label: "Milestone", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "weekly_commitment", label: "Weekly commitment", placeholder: "e.g. 8 tailored applications and 5 outreach messages" },
    { name: "pillar_id", label: "Life area", type: "select", options: pillarOpts, half: true, help: "Change this to move the milestone to another area." },
    { name: "kind", label: "Type", type: "select", options: MILESTONE_KINDS, half: true, required: true },
    { name: "stage", label: "Roadmap stage", type: "select", half: true, options: [{ value: 0, label: "Always on (never locked)" }, ...STAGES.map((s) => ({ value: s.id, label: `${s.id}. ${s.name}` }))] },
    { name: "target_date", label: "Target date", type: "date", half: true, help: "Leave empty for conditional/aspirational goals." },
    { name: "status", label: "Status", type: "select", options: MILESTONE_STATUS, half: true, help: "With tasks, it completes by itself when the last one is done (except Always on milestones, which are ongoing)." },
    { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, half: true },
    { name: "progress", label: "Progress %", type: "number", half: true, min: 0, max: 100, help: "Only used when no tasks are linked." },
    { name: "prerequisites", label: "Prerequisites", type: "textarea" },
    { name: "next_action", label: "Next action" },
    { name: "est_budget_aed", label: "Estimated budget (AED)", type: "number", half: true },
    { name: "est_effort", label: "Estimated effort", half: true, placeholder: "e.g. 3 h/week" },
    { name: "dependencies", label: "Dependencies", half: true },
    { name: "risks", label: "Risks", half: true },
  ];
}

export function kindTone(kind?: string) {
  return kind === "committed" ? "teal" : kind === "conditional" ? "amber" : "violet";
}
export function statusTone(s?: string) {
  return s === "done" ? "teal" : s === "in_progress" ? "blue" : s === "blocked" ? "rose" : "gray";
}

export const PILLAR_COLORS = [
  { value: "#4fb8ab", label: "Teal" }, { value: "#6aa3ff", label: "Blue" }, { value: "#c7b37f", label: "Gold" },
  { value: "#7fd18a", label: "Green" }, { value: "#e08fb0", label: "Pink" }, { value: "#b48ef0", label: "Purple" },
  { value: "#f0a36a", label: "Orange" }, { value: "#8fb8c9", label: "Slate" }, { value: "#d9d36a", label: "Yellow" },
  { value: "#ef7f7f", label: "Red" },
];
export const PILLAR_FIELDS: Field[] = [
  { name: "name", label: "Life area name", required: true },
  { name: "color", label: "Colour", type: "select", options: PILLAR_COLORS, half: true },
  { name: "stage_weight", label: "Weight today (0 to 1)", type: "number", half: true, min: 0, max: 1, step: "0.1", help: "How strongly this area pulls on your daily plan." },
  { name: "vision", label: "What success looks like", type: "textarea" },
];

export function habitFields(pillarOpts: Opt[], milestoneOpts: Opt[] = []): Field[] {
  return [
    { name: "name", label: "Habit", required: true },
    { name: "minimum_version", label: "Minimum version (for hard days)", placeholder: "The 2-minute version" },
    { name: "pillar_id", label: "Life area", type: "select", options: pillarOpts, half: true },
    ...(milestoneOpts.length ? [{ name: "milestone_id", label: "Milestone it supports", type: "select" as const, options: milestoneOpts, half: true, help: "Optional. Shows the habit on that milestone's page." }] : []),
    { name: "target_per_week", label: "Target days / week", type: "number", min: 1, max: 7, half: true, help: "7 = daily. Only daily habits show as missed." },
    { name: "active", label: "Active", type: "checkbox", half: true },
  ];
}
