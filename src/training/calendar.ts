// Calendar math works in whole local days so daylight saving never shifts a date.
// Plan dates come from the spec (start date, number of weeks, race day).
import type { PlanSpec } from "./spec";

type Cal = Pick<PlanSpec, "start" | "weeks" | "raceDay">;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Whole days from a to b, ignoring time of day and DST. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

export const sameDay = (a: Date, b: Date) => daysBetween(a, b) === 0;

/** Date of plan week w (1-based), day d (0 = Monday). */
export const dateOf = (spec: Pick<PlanSpec, "start">, w: number, d: number) => addDays(spec.start, (w - 1) * 7 + d);

/** "w-d" key for a calendar date. */
export function dayKey(spec: Pick<PlanSpec, "start">, dt: Date): string {
  const off = daysBetween(spec.start, dt);
  const n = Math.floor(off / 7) + 1;
  return `${n}-${off - (n - 1) * 7}`;
}

export function parseDayKey(key: string): [number, number] {
  const [w, d] = key.split("-").map(Number);
  return [w, d];
}

export interface TodayInfo {
  rawWeek: number;
  curWeek: number;
  dow: number;
  isWeekend: boolean;
  todayIdx: number;
}

export function todayInfo(spec: Cal, today: Date): TodayInfo {
  const rawWeek = Math.floor(daysBetween(spec.start, today) / 7) + 1;
  const curWeek = clamp(rawWeek, 1, spec.weeks);
  const dow = (today.getDay() + 6) % 7;
  const isWeekend = dow > 4 && !(curWeek === spec.weeks && dow === spec.raceDay);
  const todayIdx = rawWeek < 1 ? 0 : Math.min(dow, curWeek === spec.weeks ? Math.max(4, spec.raceDay) : 4);
  return { rawWeek, curWeek, dow, isWeekend, todayIdx };
}
