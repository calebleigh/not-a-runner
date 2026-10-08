// Weekly streak: weeks in a row where most of the planned cardio got done. Weekly on purpose:
// rest days are part of the plan, so a missed day never breaks it; only a mostly missed week does.
import { weekProgress } from "./stats";
import type { Model } from "./types";

/** Share of a week's planned cardio that keeps the streak going (3 of 5, 2 of 3, 3 of 4). */
export const STREAK_SHARE = 0.6;

export interface Streak {
  /** Weeks in a row, ending with this week if it's already met, otherwise last week. */
  current: number;
  best: number;
  /** This week: done so far, and how many it takes. */
  thisWeek: { done: number; need: number; met: boolean };
  /** The last few weeks, oldest first, for the little row of marks. */
  recent: { week: number; met: boolean; current: boolean }[];
}

export function streakOf(model: Model): Streak {
  const { state, weeks, curWeek, rawWeek } = model;
  const met = (n: number) => {
    const w = weeks[n - 1];
    if (!w) return false;
    const p = weekProgress(state, w);
    return p.cardioTotal > 0 && p.cardioDone >= Math.ceil(p.cardioTotal * STREAK_SHARE);
  };
  const started = rawWeek >= 1;
  const last = started ? Math.min(curWeek, weeks.length) : 0;

  // This week counts once it's met; until then it can't break the streak.
  let current = 0;
  for (let n = met(last) ? last : last - 1; n >= 1 && met(n); n--) current++;

  let best = 0, run = 0;
  for (let n = 1; n <= last; n++) {
    run = met(n) ? run + 1 : n === last ? run : 0;
    best = Math.max(best, run);
  }

  const p = last ? weekProgress(state, weeks[last - 1]) : { cardioDone: 0, cardioTotal: 0 };
  const need = Math.ceil(p.cardioTotal * STREAK_SHARE);
  const recent = [];
  for (let n = Math.max(1, last - 7); n <= last; n++) recent.push({ week: n, met: met(n), current: n === last });
  return { current, best: Math.max(best, current), thisWeek: { done: p.cardioDone, need, met: last > 0 && met(last) }, recent };
}
