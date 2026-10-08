// Birthday math. Dates are local calendar days; a Feb 29 birthday is celebrated Feb 28 in other years.
import { daysBetween, startOfDay } from "./calendar";

export function parseBirthday(s: string | undefined): { y: number; m: number; d: number } | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? { y, m: mo, d } : null;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** The birthday's date in a given year. */
function birthdayIn(b: { m: number; d: number }, year: number): Date {
  return b.m === 1 && b.d === 29 && !isLeap(year) ? new Date(year, 1, 28) : new Date(year, b.m, b.d);
}

export interface BirthdayInfo { age: number; daysUntil: number; isToday: boolean; turning: number }

export function birthdayInfo(birthday: string | undefined, now: Date): BirthdayInfo | null {
  const b = parseBirthday(birthday);
  if (!b) return null;
  const today = startOfDay(now);
  if (today < new Date(b.y, b.m, b.d)) return null;
  const y = today.getFullYear();
  const thisYear = birthdayIn(b, y);
  const passed = today >= thisYear;
  const age = y - b.y - (passed ? 0 : 1);
  const next = today > thisYear ? birthdayIn(b, y + 1) : thisYear;
  const daysUntil = daysBetween(today, next);
  return { age, daysUntil, isToday: daysUntil === 0, turning: daysUntil === 0 ? age : age + 1 };
}

/** True when `date` is the birthday (Feb 29 birthdays fall on Feb 28 in other years). */
export function isBirthdayOn(birthday: string | undefined, date: Date): boolean {
  const b = parseBirthday(birthday);
  if (!b) return false;
  const day = birthdayIn(b, date.getFullYear());
  return day.getMonth() === date.getMonth() && day.getDate() === date.getDate() && date.getFullYear() >= b.y;
}
