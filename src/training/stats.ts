// Totals, calories, steps and race predictions. Calories are estimates (MET x kg x hours).
import { effKind, idParts, sortedLogs } from "./adapt";
import { dateOf, parseDayKey } from "./calendar";
import { dayAt } from "./model";
import type { Extra, Log, Model, State, Strength, Week } from "./types";

export const DEFAULT_WEIGHT_LB = 195;
export const STEPS_PER_MI = 2250;
export const STEP_STRIDE = { walk: 2250, run: 1800 };

export type DateRange = (d: Date) => boolean;
const ALL: DateRange = () => true;

/** Most recent weigh-in at or before a week, else the starting weight. */
export function bodyLb(state: State, week?: number): number {
  const ws = Object.entries(state.weights)
    .map(([w, v]) => [+w, v] as const)
    .filter(([w]) => !week || w <= week)
    .sort((a, b) => a[0] - b[0]);
  return ws.length ? ws[ws.length - 1][1] : state.settings.startWt || DEFAULT_WEIGHT_LB;
}

export function cardioCal(state: State, kind: "bike" | "walk" | "run", lg: Pick<Log, "dist" | "time"> | undefined, week?: number): number {
  if (!lg || !lg.time) return 0;
  const kg = bodyLb(state, week) * 0.4536, hrs = lg.time / 3600, sp = lg.dist ? lg.dist / hrs : 0;
  let met: number;
  if (kind === "bike") met = !sp ? 5.5 : sp < 10 ? 4 : sp < 12 ? 6 : sp < 14 ? 8 : 10;
  else met = !sp ? (kind === "walk" ? 3.5 : 6.5) : sp < 3 ? 3 : sp < 3.5 ? 3.5 : sp < 4 ? 4.3 : sp < 4.5 ? 5 : sp < 5 ? 6.5 : sp < 6 ? 8.3 : 9.8;
  return Math.round(met * kg * hrs);
}

export function strengthCal(state: State, st: Strength | null | undefined, week?: number): number {
  return st && !st.light ? Math.round(3.5 * bodyLb(state, week) * 0.4536 * st.min / 60) : 0;
}

export const statKind = (k: string): "bike" | "walk" | "run" => (k === "bike" ? "bike" : k === "walk" ? "walk" : "run");

export interface Totals { walk: number; run: number; bike: number; cal: number; secs: number }

export function totals(model: Model, inR: DateRange = ALL): Totals {
  const { state } = model;
  const t: Totals = { walk: 0, run: 0, bike: 0, cal: 0, secs: 0 };
  for (const [id, l] of Object.entries(state.logs)) {
    const p = idParts(id);
    if (!inR(dateOf(p.w, p.d))) continue;
    if (p.t === "s") {
      if (state.done[id]) {
        const st = dayAt(model, p.w, p.d)?.st;
        t.cal += strengthCal(state, st, p.w);
        t.secs += (st && !st.light ? st.min : 0) * 60;
      }
      continue;
    }
    const e = effKind(state, p.w, p.d);
    if (!e) continue;
    const k = statKind(e.kind);
    t[k] += l.dist || 0;
    t.secs += l.time || 0;
    t.cal += cardioCal(state, k, l, p.w);
  }
  for (const [key, arr] of Object.entries(state.extras)) {
    const [w, dd] = parseDayKey(key);
    if (!inR(dateOf(w, dd))) continue;
    for (const x of arr) {
      t[x.kind] += x.dist || 0;
      t.secs += x.time || 0;
      t.cal += cardioCal(state, x.kind, x, w);
    }
  }
  return t;
}

export const extrasFor = (state: State, n: number, d: number): Extra[] => state.extras[`${n}-${d}`] || [];

/** Steps implied by logged on-foot sessions that day, to split the daily total. */
export function loggedFootSteps(state: State, n: number, d: number): number {
  let t = 0;
  const lg = state.logs[`${n}-${d}-c`];
  if (lg && lg.dist && d < 6) {
    const e = effKind(state, n, d);
    if (e && e.kind !== "bike") t += Math.round(lg.dist * (e.kind === "walk" ? STEP_STRIDE.walk : STEP_STRIDE.run));
  }
  for (const x of extrasFor(state, n, d)) if (x.kind !== "bike") t += x.steps || Math.round((x.dist || 0) * STEP_STRIDE.walk);
  return t;
}

export function stepStats(state: State, inR: DateRange = ALL) {
  let sum = 0, days = 0, best = 0;
  for (const [k, v] of Object.entries(state.steps)) {
    const [n, d] = parseDayKey(k);
    if (!inR(dateOf(n, d))) continue;
    sum += v;
    days++;
    if (v > best) best = v;
  }
  return { sum, days, best, avg: days ? Math.round(sum / days) : 0 };
}

export function weekFrac(state: State, w: Week): number {
  const ids = w.days.flatMap((x) => x.ids);
  return ids.filter((i) => state.done[i]).length / ids.length;
}

export function dayDoneFrac(model: Model, w: number, d: number): number {
  const day = dayAt(model, w, d);
  if (!day) return 0;
  return day.ids.filter((i) => model.state.done[i]).length / day.ids.length;
}

/** Logged cardio with distance and time that counts toward race times. */
export function runLogs(state: State): [string, Log][] {
  return sortedLogs(state).filter(([id, l]) => {
    const p = idParts(id);
    if (p.t !== "c" || !l.dist || !l.time) return false;
    const e = effKind(state, p.w, p.d);
    return !!e && ["run", "test", "long", "race", "walk"].includes(e.kind);
  });
}

export function bestFor(state: State, dist: number): number | null {
  let best: number | null = null;
  for (const [, l] of runLogs(state)) {
    if (l.dist! >= dist * 0.97) {
      const t = l.time! * dist / l.dist!;
      if (best === null || t < best) best = t;
    }
  }
  return best;
}

/** Riegel prediction from the best of the last 8 sessions of a mile or more. */
export function predict(state: State, dist: number): number | null {
  const rl = runLogs(state).filter(([, l]) => l.dist! >= 1).slice(-8);
  let best: number | null = null;
  for (const [, l] of rl) {
    const t = l.time! * Math.pow(dist / l.dist!, 1.06);
    if (best === null || t < best) best = t;
  }
  return best;
}

/** Cardio logs with a time, oldest first. */
export const timedCardioLogs = (state: State) => sortedLogs(state).filter(([id, l]) => idParts(id).t === "c" && l.time);
