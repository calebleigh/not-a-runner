// Totals, calories, steps and race predictions. Calories are estimates (MET x kg x hours).
import { effKind, idParts, sortedLogs } from "./adapt";
import { dateOf, parseDayKey } from "./calendar";
import { dayAt } from "./model";
import { specOf } from "./spec";
import type { Extra, ExtraKind, Log, Model, State, Strength, Week } from "./types";

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

/**
 * Extra activity types. Walk and bike use the speed-based calorie rates; the others use a fixed
 * MET (moderate effort). Only on-foot types estimate steps. `bucket` is where their miles count in Stats.
 */
export const EXTRA_KINDS: Record<ExtraKind, { label: string; onFoot: boolean; met?: number; bucket: "walk" | "bike" | "other" }> = {
  walk: { label: "Walk", onFoot: true, bucket: "walk" },
  bike: { label: "Bike", onFoot: false, bucket: "bike" },
  hike: { label: "Hike", onFoot: true, met: 6, bucket: "walk" },
  elliptical: { label: "Elliptical", onFoot: false, met: 5, bucket: "other" },
  swim: { label: "Swim", onFoot: false, met: 6, bucket: "other" },
  row: { label: "Row", onFoot: false, met: 7, bucket: "other" },
  skate: { label: "Skate", onFoot: false, met: 7.5, bucket: "other" },
  other: { label: "Other", onFoot: false, met: 4, bucket: "other" },
};
export const extraKind = (k: string) => EXTRA_KINDS[k as ExtraKind] ?? EXTRA_KINDS.other;

export function extraCal(state: State, x: Extra, week?: number): number {
  const k = extraKind(x.kind);
  if (!k.met) return cardioCal(state, x.kind === "bike" ? "bike" : "walk", x, week);
  return x.time ? Math.round(k.met * bodyLb(state, week) * 0.4536 * x.time / 3600) : 0;
}

export interface Totals { walk: number; run: number; bike: number; other: number; cal: number; secs: number }

export function totals(model: Model, inR: DateRange = ALL): Totals {
  const { state } = model;
  const t: Totals = { walk: 0, run: 0, bike: 0, other: 0, cal: 0, secs: 0 };
  for (const [id, l] of Object.entries(state.logs)) {
    const p = idParts(id);
    if (!inR(dateOf(model.spec, p.w, p.d))) continue;
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
    if (!inR(dateOf(model.spec, w, dd))) continue;
    for (const x of arr) {
      t[extraKind(x.kind).bucket] += x.dist || 0;
      t.secs += x.time || 0;
      t.cal += extraCal(state, x, w);
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
  for (const x of extrasFor(state, n, d)) if (extraKind(x.kind).onFoot) t += x.steps || Math.round((x.dist || 0) * STEP_STRIDE.walk);
  return t;
}

export interface DayCardio { dist: number; secs: number; cal: number; extras: number; plannedDone: boolean }

/** Everything cardio on one day: the planned session (if done) plus extra activities. */
export function dayCardio(model: Model, w: number, d: number): DayCardio {
  const { state } = model;
  const id = `${w}-${d}-c`, lg = state.done[id] ? state.logs[id] : undefined, xs = extrasFor(state, w, d);
  const out: DayCardio = { dist: 0, secs: 0, cal: 0, extras: xs.length, plannedDone: !!state.done[id] };
  if (lg) {
    const e = effKind(state, w, d);
    out.dist += lg.dist || 0;
    out.secs += lg.time || 0;
    out.cal += e ? cardioCal(state, statKind(e.kind), lg, w) : 0;
  }
  for (const x of xs) { out.dist += x.dist || 0; out.secs += x.time || 0; out.cal += extraCal(state, x, w); }
  out.dist = Math.round(out.dist * 100) / 100;
  return out;
}

export function stepStats(state: State, inR: DateRange = ALL) {
  const spec = specOf(state);
  let sum = 0, days = 0, best = 0;
  for (const [k, v] of Object.entries(state.steps)) {
    const [n, d] = parseDayKey(k);
    if (!inR(dateOf(spec, n, d))) continue;
    sum += v;
    days++;
    if (v > best) best = v;
  }
  return { sum, days, best, avg: days ? Math.round(sum / days) : 0 };
}

/**
 * Progress counts cardio only; strength is tracked on its own so skipping it never drags the week down.
 * Rest and race-day "sessions" count once marked done, like any other cardio slot.
 */
export function weekProgress(state: State, w: Week) {
  const cardio = w.days.map((x) => x.ids[0]), strength = w.days.filter((x) => x.st && !x.st.light).map((x) => x.ids[1]);
  const done = (ids: string[]) => ids.filter((i) => state.done[i]).length;
  return { cardioDone: done(cardio), cardioTotal: cardio.length, strengthDone: done(strength), strengthTotal: strength.length };
}

/** Share of the week's cardio done, 0 to 1. */
export function weekFrac(state: State, w: Week): number {
  const p = weekProgress(state, w);
  return p.cardioTotal ? p.cardioDone / p.cardioTotal : 0;
}

/** 1 when the day's cardio is done, else 0 (strength doesn't count toward progress). */
export function dayDoneFrac(model: Model, w: number, d: number): number {
  const day = dayAt(model, w, d);
  return day && model.state.done[day.ids[0]] ? 1 : 0;
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

export interface SumUp { steps: number; miles: number; secs: number }

/** Steps, miles and active time for the plan week, the calendar month and all time (Home's totals card). */
export function homeTotals(model: Model): Record<"week" | "lastWeek" | "month" | "all", SumUp> {
  const { today, curWeek, spec } = model;
  const weekOf = (w: number): DateRange => (d) => d >= dateOf(spec, w, 0) && d <= dateOf(spec, w, 6);
  const inWeek = weekOf(curWeek);
  const inMonth: DateRange = (d) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  const sum = (r: DateRange): SumUp => {
    const t = totals(model, r);
    return { steps: stepStats(model.state, r).sum, miles: Math.round((t.walk + t.run + t.bike + t.other) * 10) / 10, secs: t.secs };
  };
  return { week: sum(inWeek), lastWeek: sum(weekOf(curWeek - 1)), month: sum(inMonth), all: sum(ALL) };
}

/** Round numbers worth celebrating, per lifetime total. */
export const MILESTONES = {
  steps: [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000],
  miles: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000],
  hours: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
} as const;
export type MilestoneKind = keyof typeof MILESTONES;
export interface Milestone { kind: MilestoneKind; target: number; left: number; frac: number }

/** The next milestone for each total that has one left, closest to done first. */
export function nextMilestones(t: { steps: number; miles: number; hours: number }): Milestone[] {
  const out: Milestone[] = [];
  for (const kind of Object.keys(MILESTONES) as MilestoneKind[]) {
    const v = t[kind], ladder: readonly number[] = MILESTONES[kind];
    const i = ladder.findIndex((m) => m > v);
    if (i < 0) continue;
    const from = i ? ladder[i - 1] : 0, target = ladder[i];
    out.push({ kind, target, left: target - v, frac: (v - from) / (target - from) });
  }
  return out.sort((a, b) => b.frac - a.frac);
}
