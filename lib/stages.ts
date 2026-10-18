// The life roadmap as a sequence of stages. One stage gets your focus at a time; later stages stay locked
// until the current one is stable. Stage 0 holds "always on" things (health, faith, relationships) that are never gated.

export type Stage = { id: number; name: string; short: string; icon: string; focus: string; stable: string; months: number };

export const STAGES: Stage[] = [
  { id: 1, name: "Stabilize", short: "Stabilize", icon: "shield", months: 1.5, focus: "Know your numbers, protect your runway, rebuild a minimum daily routine, and set up the job search.", stable: "Baseline entered, obligations dated, routine held for 3 weeks, job search running." },
  { id: 2, name: "Secure income", short: "Income", icon: "briefcase", months: 3, focus: "Land stable income. Targeted applications, interviews, follow-ups. Keep the routine and basic fitness.", stable: "An offer accepted and a start date confirmed." },
  { id: 3, name: "Financial footing", short: "Footing", icon: "piggy", months: 9, focus: "Cover essentials every month, build a 1-month emergency fund, then clear high-cost debt.", stable: "Card debt cleared and 3 to 6 months of essentials saved." },
  { id: 4, name: "Grow", short: "Grow", icon: "trending", months: 18, focus: "Grow career and skills (e.g. PMP), start content, take a fully pre-funded trip.", stable: "Higher income, a credential earned, a steady publishing habit." },
  { id: 5, name: "Build assets", short: "Assets", icon: "home", months: 36, focus: "A home, a vehicle, a first business. Only funded from surplus, never from your safety net.", stable: "Assets affordable on income, safety net intact." },
  { id: 6, name: "Freedom", short: "Freedom", icon: "mountain", months: 48, focus: "Financial independence, travel, the life you designed for 2035.", stable: "Choice over how you spend your time." },
];

/** Stage for the starter milestones (by title). */
export const TEMPLATE_STAGE: Record<string, number> = {
  "Financial baseline entered and verified": 1,
  "Rent, renewals and other lump-sum dates confirmed": 1,
  "Job search system live": 1,
  "Minimum Day completed on 14 of 21 days": 1,
  "Day-30 review: pipeline conversion and spending": 1,
  "20 targeted applications and 10 outreach messages": 2,
  "Day-60 review: adjust targeting and alternatives": 2,
  "12 weeks of 3 workouts per week": 2,
  "Day-90 review: reset priorities": 2,
  "Stable income secured": 2,
  "Emergency fund: 1 month of essentials": 3,
  "High-cost card debt cleared": 3,
  "Emergency fund: 3 to 6 months of essentials": 3,
  "Personal brand: 1 publish per week for 12 weeks": 4,
  "First wishlist trip, fully pre-funded": 4,
  "Earn the PMP certification": 4,
  "First paying customer for a validated idea": 5,
  "Land title verified and construction budget drafted": 5,
  "Modern home built": 5,
  "Own an affordable vehicle": 5,
  "Financial independence": 6,
  "Japan, Portugal, Italy, Switzerland": 6,
  "Personal brand: 10K followers": 6,
  "Healthy, stable romantic relationship": 0,
};

/** Default stage for a new milestone, by pillar key. */
export const PILLAR_STAGE: Record<string, number> = { discipline: 1, career: 2, health: 2, finance: 3, content: 4, travel: 4, business: 5, home: 5, relationships: 0 };

export type Pace = "consistent" | "current" | "drifting";

/**
 * Illustrative projection (not a forecast). Position = stage number (0..6, fractional within a stage).
 * Each month you advance pace/months-of-current-stage. Below half pace, momentum erodes after 2 months
 * (routine slips, runway shrinks) and position slowly declines.
 */
export function project(startPos: number, pace: number, months: number, durations = STAGES.map((s) => s.months)) {
  const out: number[] = [];
  let pos = startPos;
  for (let i = 0; i < months; i++) {
    out.push(Math.round(pos * 100) / 100);
    if (pace >= 0.5 || i < 2) {
      const stage = Math.min(5, Math.floor(pos));
      pos = Math.min(6, pos + pace / durations[stage]);
    } else {
      pos = Math.max(0, pos - 0.06);
    }
  }
  return out;
}

export function firstMonthReaching(series: number[], level: number) {
  const i = series.findIndex((v) => v >= level);
  return i === -1 ? null : i;
}
