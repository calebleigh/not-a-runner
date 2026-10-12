// Day streak: days in a row of doing something, forgiving on purpose. Any workout (planned, extra or
// strength) or hitting the step goal keeps a day. Rest days never count against you, and it takes 3
// missed training days in a row to put it out. The flame shows how many of those are left, and doing
// something brings it straight back to full.
import { activities } from "./insights";
import { addDays, dayKey, parseDayKey, sameDay } from "./calendar";
import { dayAt } from "./model";
import type { Model } from "./types";

/** Missed training days in a row that put a streak out (also the flame's layers). */
export const STREAK_GRACE = 3;

export interface Streak {
  /** Days from the streak's first active day to its latest one (rest and missed days in between count). */
  current: number;
  best: number;
  /** Flame layers left (0 is out): the full 3, less each training day missed since you last did something. */
  flames: number;
  /** Today already counts. */
  today: boolean;
  /** The last week, oldest first, for the little row of marks. */
  recent: { date: Date; active: boolean; rest: boolean; today: boolean }[];
}

const DAY = 864e5;
const span = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY) + 1;

export function streakOf(model: Model): Streak {
  const { state, spec, today } = model;
  const active = new Set(activities(model).map((a) => a.date.getTime()));
  const goal = state.settings.stepGoal;
  if (goal) for (const [k, v] of Object.entries(state.steps)) if (v >= goal) { const [w, d] = parseDayKey(k); active.add(addDays(spec.start, (w - 1) * 7 + d).getTime()); }
  const isActive = (d: Date) => active.has(d.getTime());
  const isRest = (d: Date) => {
    const [w, n] = parseDayKey(dayKey(spec, d));
    const day = w >= 1 && w <= spec.weeks ? dayAt(model, w, n) : undefined;
    return !day || day.c.kind === "rest";
  };

  let start: Date | null = null, last: Date | null = null, misses = 0, best = 0;
  for (let d = spec.start; d <= today; d = addDays(d, 1)) {
    if (isActive(d)) { start ??= d; last = d; misses = 0; continue; }
    // Today is still open, so it can't count as a miss yet.
    if (!start || sameDay(d, today) || isRest(d)) continue;
    if (++misses >= STREAK_GRACE) { best = Math.max(best, span(start, last!)); start = last = null; misses = 0; }
  }
  const current = start && last ? span(start, last) : 0;
  const recent = [];
  for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); recent.push({ date: d, active: isActive(d), rest: isRest(d), today: i === 0 }); }
  return { current, best: Math.max(best, current), flames: start ? STREAK_GRACE - misses : 0, today: isActive(today), recent };
}
