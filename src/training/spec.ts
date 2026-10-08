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

export interface PlanSpec {
  profile: PlanProfile;
  /** Monday of week 1. */
  start: Date;
  race: Date | null;
  raceName: string;
  weeks: number;
  phases: Phase[];
  mileTests: number[];
  /** Weekday index of race day in the final week. */
  raceDay: number;
  milestones: Record<number, string>;
}

export function parseYmd(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

export function buildSpec(profile: PlanProfile): PlanSpec {
  const start = parseYmd(profile.startDate)!;
  const race = parseYmd(profile.raceDate);
  return {
    profile,
    start,
    race,
    raceName: profile.raceName || "Your race",
    weeks: 52,
    phases,
    mileTests: MILE_TESTS,
    raceDay: race ? (race.getDay() + 6) % 7 : -1,
    milestones,
  };
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
