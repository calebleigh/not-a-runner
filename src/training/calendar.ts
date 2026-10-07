// Calendar math works in whole local days so daylight saving never shifts a date.

export const START = new Date(2026, 9, 5); // Mon Oct 5, 2026
export const RACE = new Date(2027, 9, 2);
export const WEEKS = 52;

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
export const dateOf = (w: number, d: number) => addDays(START, (w - 1) * 7 + d);

/** "w-d" key for a calendar date. */
export function dayKey(dt: Date): string {
  const off = daysBetween(START, dt);
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

export function todayInfo(today: Date): TodayInfo {
  const rawWeek = Math.floor(daysBetween(START, today) / 7) + 1;
  const curWeek = clamp(rawWeek, 1, WEEKS);
  const dow = (today.getDay() + 6) % 7;
  const isWeekend = dow > 4 && !(curWeek === WEEKS && dow === 5);
  const todayIdx = rawWeek < 1 ? 0 : Math.min(dow, curWeek === WEEKS ? 5 : 4);
  return { rawWeek, curWeek, dow, isWeekend, todayIdx };
}
