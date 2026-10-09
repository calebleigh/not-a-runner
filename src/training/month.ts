// The Plan tab's month calendar: one cell per day, with what was planned and how it went.
import { addDays, dayKey, parseDayKey, sameDay } from "./calendar";
import { dayAt } from "./model";
import { extrasFor } from "./stats";
import type { CardioKind, Model } from "./types";

export type CellStatus = "done" | "part" | "missed" | "up" | "rest" | "extra" | "out";
export interface MonthCell {
  date: Date;
  /** Plan week and day, when the date is inside the plan. */
  w: number;
  d: number;
  /** In the month being shown (the grid pads with the days around it). */
  inMonth: boolean;
  kind: CardioKind;
  status: CellStatus;
  today: boolean;
  race: boolean;
}

/** Monday-first weeks covering `month` (0-11) of `year`. */
export function monthGrid(model: Model, year: number, month: number): MonthCell[][] {
  const { spec, state, today } = model;
  const first = new Date(year, month, 1);
  let d0 = addDays(first, -((first.getDay() + 6) % 7));
  const rows: MonthCell[][] = [];
  while (rows.length < 6 && (d0.getMonth() === month || d0 < first)) {
    const row: MonthCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(d0, i);
      const [w, d] = parseDayKey(dayKey(spec, date));
      const inPlan = w >= 1 && w <= spec.weeks;
      const day = inPlan ? dayAt(model, w, d) : undefined;
      const xs = inPlan ? extrasFor(state, w, d) : [];
      let status: CellStatus, kind: CardioKind = "rest";
      if (!inPlan) status = xs.length ? "extra" : "out";
      else if (!day || day.c.kind === "rest") status = xs.length ? "extra" : "rest";
      else {
        kind = day.c.kind;
        const cd = !!state.done[day.ids[0]], sd = day.ids[1] ? !!state.done[day.ids[1]] : true;
        status = cd && sd ? "done" : cd || sd ? "part" : date < today && !sameDay(date, today) ? "missed" : "up";
      }
      row.push({ date, w, d, inMonth: date.getMonth() === month, kind, status, today: sameDay(date, today), race: !!spec.race && sameDay(date, spec.race) });
    }
    rows.push(row);
    d0 = addDays(d0, 7);
  }
  return rows;
}

/** The months the plan covers, as [year, month] from start to race day (or the last week). */
export function planMonths(model: Model): [number, number][] {
  const { spec } = model;
  const end = spec.race ?? addDays(spec.start, spec.weeks * 7 - 1);
  const out: [number, number][] = [];
  for (let y = spec.start.getFullYear(), m = spec.start.getMonth(); y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth()); m === 11 ? (y++, m = 0) : m++) out.push([y, m]);
  return out;
}
