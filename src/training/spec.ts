// The training profile (onboarding answers) and the plan spec built from it.
// The spec holds everything that used to be a fixed constant: start and race dates, number of weeks,
// phase boundaries and mile test weeks. Step 1 of Stage 2 supports the owner's profile shape exactly;
// the generator generalizes buildSpec next.
import { MILE_TESTS, milestones, phases, type Phase } from "./data";
import type { State } from "./types";

export type RaceGoal = "5k" | "10k" | "half" | "full" | "fitness";
export type StartLevel = "cant_run_mile" | "run_1_mile" | "run_3_miles" | "run_6_plus";

export interface PlanProfile {
  goal: RaceGoal;
  raceName?: string;
  /** "YYYY-MM-DD"; required unless the goal is fitness. */
  raceDate?: string;
  /** "YYYY-MM-DD", a Monday: week 1, day 0. */
  startDate: string;
  startLevel: StartLevel;
  /** Training weekdays, 0 = Monday. */
  days: number[];
  hasBike: boolean;
  /** Sore knees or joints: leans on bike and walking longer. */
  impactSensitive: boolean;
}

/** The plan the app was built around. Existing data without a profile uses this. */
export const OWNER_PROFILE: PlanProfile = {
  goal: "half",
  raceName: "St. George Half",
  raceDate: "2027-10-02",
  startDate: "2026-10-05",
  startLevel: "cant_run_mile",
  days: [0, 1, 2, 3, 4],
  hasBike: true,
  impactSensitive: true,
};

/** A training session slot: weekday d (0 = Monday) and its role in the template week. */
export interface Slot {
  d: number;
  /** 0 to 4: the template weekday it plays (4 = the long session); 5 = an extra easy session; -1 = race day. */
  role: number;
}

export interface PlanSpec {
  profile: PlanProfile;
  /** Monday of week 1. */
  start: Date;
  race: Date | null;
  raceName: string;
  weeks: number;
  /** Plan weeks in each of the 4 phases (a skipped phase is empty: from > to). */
  phases: Phase[];
  mileTests: number[];
  /** Weekday index of race day in the final week, or -1 with no race. */
  raceDay: number;
  milestones: Record<number, string>;
  /** For each plan week, the template week (1 to 52) it follows. */
  canon: number[];
  /** For each plan week, its sessions in weekday order. */
  slots: Slot[][];
  /** Long-run distances scale by this (1 for a half marathon). */
  longScale: number;
  /** Shorter runs scale by this. */
  shortScale: number;
  raceMiles: number;
  /** Things the onboarding screen should point out, like a race that's very soon. */
  warnings: string[];
  /**
   * Most a week's running time may grow over the best week so far (1.1 = 10%), or null for the
   * template itself (the owner's plan), which is kept exactly as written.
   */
  volumeCap: number | null;
}

export function parseYmd(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const weeksFrom = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / (7 * 86400000));

/** Template phase (0 to 3) of a template week. */
export const canonPhase = (c: number) => phases.findIndex((p) => c >= p.from && c <= p.to);

export const GOALS_INFO: Record<RaceGoal, { label: string; miles: number; peakLong: number; shortScale: number; minWeeks: number }> = {
  "5k": { label: "5K", miles: 3.1, peakLong: 4, shortScale: 0.85, minWeeks: 8 },
  "10k": { label: "10K", miles: 6.2, peakLong: 7, shortScale: 0.95, minWeeks: 10 },
  half: { label: "Half marathon", miles: 13.1, peakLong: 11, shortScale: 1, minWeeks: 16 },
  full: { label: "Marathon", miles: 26.2, peakLong: 20, shortScale: 1.15, minWeeks: 20 },
  fitness: { label: "Fitness", miles: 0, peakLong: 6, shortScale: 1, minWeeks: 0 },
};

/** How far into the template each starting level begins. */
const LEVEL_OFFSET: Record<StartLevel, number> = { cant_run_mile: 0, run_1_mile: 7, run_3_miles: 20, run_6_plus: 27 };

/** Which template roles to drop first when training fewer than 5 days, by template phase. */
const DROP_ORDER = [[2, 0, 1, 3], [2, 0, 1, 3], [3, 1, 2, 0], [3, 1, 2, 0]];

/**
 * Spread `count` plan weeks over template weeks `from`..`to`. Each template week has a weight
 * (how long it should take); plan weeks are placed evenly along the cumulative weight.
 * Equal weights and equal lengths give an exact one-to-one map.
 */
function spread(from: number, to: number, count: number, weight: (c: number) => number): number[] {
  if (count <= 0) return [];
  if (to < from) return Array(count).fill(Math.max(1, to));
  const cs: number[] = [], cum: number[] = [];
  let total = 0;
  for (let c = from; c <= to; c++) { total += weight(c); cs.push(c); cum.push(total); }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * total;
    out.push(cs[cum.findIndex((x) => x >= t - 1e-9)]);
  }
  return out;
}

export function buildSpec(profile: PlanProfile): PlanSpec {
  const g = GOALS_INFO[profile.goal];
  const isRace = profile.goal !== "fitness";
  const race = isRace ? parseYmd(profile.raceDate) : null;
  const warnings: string[] = [];
  let start = mondayOf(parseYmd(profile.startDate) ?? new Date());
  let weeks = 52;
  if (race) {
    const raceMonday = mondayOf(race);
    weeks = weeksFrom(start, raceMonday) + 1;
    if (weeks > 52) { start = new Date(raceMonday.getFullYear(), raceMonday.getMonth(), raceMonday.getDate() - 51 * 7); weeks = 52; }
    if (weeks < g.minWeeks) warnings.push(`That's ${Math.max(weeks, 0)} weeks away. A ${g.label} plan usually needs at least ${g.minWeeks}. This plan gets you to the finish, but a later race would be easier on your body.`);
    weeks = Math.max(weeks, 4);
  }
  const offset = LEVEL_OFFSET[profile.startLevel];
  // Sore knees take the template at its own pace; otherwise the bike-heavy early phases go faster.
  const weight = (c: number) => (profile.impactSensitive ? 1 : c <= 13 ? 0.7 : c <= 26 ? 0.85 : 1);
  const canon = race
    ? [...spread(offset + 1, 49, weeks - 3, weight), 50, 51, 52]
    : spread(offset + 1, 39, weeks, weight);

  // Phase ranges in plan weeks.
  const plan = phases.map((p) => {
    const ns = canon.map((c, i) => (canonPhase(c) === phases.indexOf(p) ? i + 1 : 0)).filter(Boolean);
    return { ...p, from: ns.length ? ns[0] : 0, to: ns.length ? ns[ns.length - 1] : -1 };
  });
  // A mile test lands on the first plan week that reaches each template test week.
  const mileTests = MILE_TESTS.filter((t) => t > offset + 1).map((t) => canon.findIndex((c) => c >= t) + 1).filter((n, i, a) => n > 0 && a.indexOf(n) === i);

  // Sessions: the template's five roles on the chosen days, the long one on the last day.
  const days = [...new Set(profile.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const raceDay = race ? (race.getDay() + 6) % 7 : -1;
  const slots = canon.map((c, i): Slot[] => {
    const n = i + 1;
    if (race && n === weeks) {
      const before = days.filter((d) => d < raceDay);
      const roles = [0, 1, 2, 3, 4].slice(0, before.length);
      // Fewer days than the template's race week: keep the easy shakeouts, drop the rest days.
      return [...before.map((d, j) => ({ d, role: roles[j] })), { d: raceDay, role: -1 }];
    }
    const p = Math.max(0, canonPhase(c));
    let roles = [0, 1, 2, 3];
    for (const r of DROP_ORDER[p]) if (roles.length + 1 > days.length) roles = roles.filter((x) => x !== r);
    const ordered = days.length > 5 ? [...roles, 5, 4] : [...roles, 4];
    return days.slice(0, ordered.length).map((d, j) => ({ d, role: ordered[j] }));
  });

  const owner = profile.raceName === OWNER_PROFILE.raceName && race !== null;
  return {
    profile,
    start,
    race,
    raceName: profile.raceName || (isRace ? `Your ${g.label}` : "Fitness"),
    weeks,
    phases: plan,
    mileTests,
    raceDay,
    milestones: owner ? milestones : genericMilestones(canon),
    canon,
    slots,
    longScale: g.peakLong / 11,
    shortScale: g.shortScale,
    raceMiles: g.miles,
    warnings,
    volumeCap: profile.goal === "half" && canon.every((c, i) => c === i + 1) ? null : 1.1,
  };
}

/** Milestone tips for any plan, placed at the matching template weeks. */
function genericMilestones(canon: number[]): Record<number, string> {
  const at: Record<number, string> = {
    1: "This week: decide what time of day you'll train, and keep it the same.",
    19: "Optional: find a local 5K and walk/run it just to see a finish line.",
    26: "This week: register for your race if you haven't yet.",
    44: "On your long session this week, test your race-day shoes, clothes and fuel.",
  };
  const out: Record<number, string> = {};
  for (const [c, t] of Object.entries(at)) {
    const n = canon.findIndex((x) => x >= +c) + 1;
    if (n > 0 && !out[n]) out[n] = t;
  }
  return out;
}

const cache = new Map<string, PlanSpec>();

/** The spec for a state's profile (the owner profile when none is saved). Cached per profile. */
export function specOf(state: Pick<State, "plan">): PlanSpec {
  const profile = state.plan?.profile ?? OWNER_PROFILE;
  const key = JSON.stringify(profile);
  let s = cache.get(key);
  if (!s) {
    s = buildSpec(profile);
    cache.set(key, s);
  }
  return s;
}
