// Stats screen: every logged activity as one list, then periods, totals, trends, consistency,
// breakdowns and records over whatever slice the filters pick. Pure.
import { effKind, idParts } from "./adapt";
import { addDays, dateOf, daysBetween, parseDayKey, startOfDay } from "./calendar";
import { dayAt } from "./model";
import { cardioCal, extraCal, extraKind, statKind, strengthCal } from "./stats";
import type { Feel, Model } from "./types";

export type ActType = "walk" | "run" | "bike" | "strength" | "other";
export const ACT_TYPES: [ActType, string][] = [["walk", "Walk"], ["run", "Walk/run"], ["bike", "Bike"], ["strength", "Strength"], ["other", "Other"]];

export type ActTarget = { kind: "cardio" | "strength"; w: number; d: number } | { kind: "extra"; date: Date };

export interface Activity {
  key: string;
  type: ActType;
  date: Date;
  title: string;
  dist: number;
  secs: number;
  cal: number;
  hr?: number;
  feel?: Feel;
  route?: string;
  source: "plan" | "extra";
  target: ActTarget;
  /** For ordering within a day. */
  at: number;
}

/** Everything done: planned cardio (done or timed), planned strength (done) and extras. Oldest first. */
export function activities(model: Model): Activity[] {
  const { state, spec } = model, out: Activity[] = [];
  const cardioIds = new Set([...Object.keys(state.logs), ...Object.keys(state.done)].filter((id) => idParts(id).t === "c"));
  for (const id of cardioIds) {
    const { w, d } = idParts(id), day = dayAt(model, w, d), e = effKind(state, w, d), lg = state.logs[id];
    if (!day || !e || e.kind === "rest") continue;
    if (!state.done[id] && !lg?.time) continue;
    const k = statKind(e.kind);
    out.push({
      key: id, type: k, date: day.date, title: day.c.t, dist: lg?.dist || 0, secs: lg?.time || 0, cal: cardioCal(state, k, lg, w),
      hr: lg?.hr, feel: lg?.feel, route: lg?.route, source: "plan", target: { kind: "cardio", w, d }, at: lg?.at && lg.at > 1 ? lg.at : day.date.getTime(),
    });
  }
  for (const id of Object.keys(state.done)) {
    const { w, d, t } = idParts(id);
    if (t !== "s") continue;
    const day = dayAt(model, w, d), st = day?.st;
    if (!day || !st || st.light) continue;
    out.push({
      key: id, type: "strength", date: day.date, title: st.title, dist: 0, secs: st.min * 60, cal: strengthCal(state, st, w),
      feel: state.logs[id]?.feel, source: "plan", target: { kind: "strength", w, d }, at: state.logs[id]?.at || day.date.getTime() + 1,
    });
  }
  for (const [dk, list] of Object.entries(state.extras)) {
    const [w, d] = parseDayKey(dk), date = dateOf(spec, w, d);
    list.forEach((x, i) => {
      const k = extraKind(x.kind), type: ActType = k.bucket === "walk" ? "walk" : k.bucket === "bike" ? "bike" : "other";
      out.push({
        key: x.id || `x-${dk}-${i}`, type, date, title: x.label ? `${k.label}: ${x.label}` : k.label, dist: x.dist || 0, secs: x.time || 0,
        cal: extraCal(state, x, w), route: x.route, source: "extra", target: { kind: "extra", date }, at: x.at ?? date.getTime() + 2 + i,
      });
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.at - b.at);
}

/** Steps by day (start-of-day ms). */
export function stepsByDay(model: Model): Map<number, number> {
  const m = new Map<number, number>();
  for (const [k, v] of Object.entries(model.state.steps)) {
    if (!v) continue;
    const [w, d] = parseDayKey(k);
    m.set(dateOf(model.spec, w, d).getTime(), v);
  }
  return m;
}

// Periods ---------------------------------------------------------------------------------------

export type PeriodKind = "week" | "month" | "quarter" | "year" | "all";
export const PERIODS: [PeriodKind, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "3 mo"], ["year", "Year"], ["all", "All"]];

export interface Period { kind: PeriodKind; offset: number; start: Date; /** Exclusive. */ end: Date; label: string }

const MON = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);

/**
 * A calendar period: this one at offset 0, earlier ones at negative offsets. "3 mo" is the three
 * calendar months ending with the current one. `first` is where all time begins.
 */
export function periodOf(kind: PeriodKind, today: Date, offset: number, first: Date): Period {
  const t = startOfDay(today);
  if (kind === "all") return { kind, offset: 0, start: startOfDay(first < t ? first : t), end: addDays(t, 1), label: "All time" };
  if (kind === "week") {
    const start = addDays(MON(t), 7 * offset), end = addDays(start, 7), last = addDays(end, -1);
    const label = offset === 0 ? "This week" : offset === -1 ? "Last week"
      : start.getMonth() === last.getMonth() ? `${fmt(start, { month: "short", day: "numeric" })} to ${last.getDate()}` : `${fmt(start, { month: "short", day: "numeric" })} to ${fmt(last, { month: "short", day: "numeric" })}`;
    return { kind, offset, start, end, label };
  }
  if (kind === "month") {
    const start = new Date(t.getFullYear(), t.getMonth() + offset, 1), end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { kind, offset, start, end, label: fmt(start, { month: "long", year: "numeric" }) };
  }
  if (kind === "quarter") {
    const end = new Date(t.getFullYear(), t.getMonth() + 1 + 3 * offset, 1), start = new Date(end.getFullYear(), end.getMonth() - 3, 1), last = addDays(end, -1);
    const label = start.getFullYear() === last.getFullYear()
      ? `${fmt(start, { month: "short" })} to ${fmt(last, { month: "short", year: "numeric" })}`
      : `${fmt(start, { month: "short", year: "numeric" })} to ${fmt(last, { month: "short", year: "numeric" })}`;
    return { kind, offset, start, end, label };
  }
  const start = new Date(t.getFullYear() + offset, 0, 1);
  return { kind, offset, start, end: new Date(start.getFullYear() + 1, 0, 1), label: String(start.getFullYear()) };
}

/** Is there an earlier period with anything in range (on or after `first`)? */
export const canGoBack = (p: Period, first: Date) => p.kind !== "all" && p.start > startOfDay(first);

export const inPeriod = (p: Period) => (d: Date) => d >= p.start && d < p.end;

// Totals ----------------------------------------------------------------------------------------

export interface Summary { miles: number; secs: number; workouts: number; cal: number; steps: number; activeDays: number }

export function summarize(acts: Activity[], steps: Map<number, number>, p: Period): Summary {
  const r = inPeriod(p), days = new Set<number>();
  const s: Summary = { miles: 0, secs: 0, workouts: 0, cal: 0, steps: 0, activeDays: 0 };
  for (const a of acts) {
    if (!r(a.date)) continue;
    s.miles += a.dist; s.secs += a.secs; s.cal += a.cal; s.workouts++;
    days.add(a.date.getTime());
  }
  for (const [ms, v] of steps) if (r(new Date(ms))) s.steps += v;
  s.miles = Math.round(s.miles * 10) / 10;
  s.activeDays = days.size;
  return s;
}

/** Change from `before` to `now` as a fraction, or null when there's nothing to compare with. */
export const change = (now: number, before: number): number | null => (before > 0 ? (now - before) / before : null);

// Trend chart -----------------------------------------------------------------------------------

export interface Bucket { start: Date; end: Date; label: string }
export type Metric = "miles" | "time" | "workouts" | "steps";

/** Bars for a period: days for a week or month, weeks for 3 months (or a short all time), months otherwise. */
export function bucketsOf(p: Period): Bucket[] {
  const out: Bucket[] = [];
  const span = daysBetween(p.start, p.end);
  const by = p.kind === "week" || p.kind === "month" ? "day" : p.kind === "quarter" || (p.kind === "all" && span <= 120) ? "week" : "month";
  if (by === "day") {
    for (let d = p.start; d < p.end; d = addDays(d, 1)) out.push({ start: d, end: addDays(d, 1), label: p.kind === "week" ? "MTWTFSS"[(d.getDay() + 6) % 7] : String(d.getDate()) });
  } else if (by === "week") {
    for (let d = MON(p.start); d < p.end; d = addDays(d, 7)) out.push({ start: d, end: addDays(d, 7), label: fmt(d, { month: "short", day: "numeric" }) });
  } else {
    for (let d = new Date(p.start.getFullYear(), p.start.getMonth(), 1); d < p.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      out.push({ start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1), label: fmt(d, { month: "short" }) });
    }
  }
  return out;
}

export function seriesOf(acts: Activity[], steps: Map<number, number>, bs: Bucket[], metric: Metric): number[] {
  return bs.map((b) => {
    const r = (d: Date) => d >= b.start && d < b.end;
    if (metric === "steps") { let n = 0; for (const [ms, v] of steps) if (r(new Date(ms))) n += v; return n; }
    let n = 0;
    for (const a of acts) if (r(a.date)) n += metric === "miles" ? a.dist : metric === "time" ? a.secs : 1;
    return metric === "miles" ? Math.round(n * 10) / 10 : n;
  });
}

// Consistency -----------------------------------------------------------------------------------

export interface Consistency {
  /** Each day in the period up to today: active minutes (0 for none). */
  days: { date: Date; mins: number }[];
  activeDays: number;
  /** Days so far in the period. */
  dayCount: number;
  /** Longest run of active days in a row within the period. */
  bestRun: number;
  /** Active days in a row ending today (or yesterday, if today is still open). */
  currentRun: number;
  /** Planned cardio sessions in the period up to today, and how many were done. */
  planned: number;
  plannedDone: number;
}

export function consistency(model: Model, acts: Activity[], p: Period): Consistency {
  const today = model.today, stop = p.end < addDays(today, 1) ? p.end : addDays(today, 1);
  const mins = new Map<number, number>();
  for (const a of acts) mins.set(a.date.getTime(), (mins.get(a.date.getTime()) || 0) + Math.max(1, Math.round(a.secs / 60)));
  const days: Consistency["days"] = [];
  let bestRun = 0, run = 0;
  for (let d = p.start; d < stop; d = addDays(d, 1)) {
    const m = mins.get(d.getTime()) || 0;
    days.push({ date: d, mins: m });
    run = m ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  let currentRun = 0;
  for (let d = mins.has(today.getTime()) ? today : addDays(today, -1); mins.has(d.getTime()); d = addDays(d, -1)) currentRun++;
  let planned = 0, plannedDone = 0;
  for (const w of model.weeks) for (const day of w.days) {
    if (day.c.kind === "rest" || day.date < p.start || day.date >= stop) continue;
    planned++;
    if (model.state.done[day.ids[0]]) plannedDone++;
  }
  return { days, activeDays: days.filter((x) => x.mins).length, dayCount: days.length, bestRun, currentRun, planned, plannedDone };
}

// Breakdown -------------------------------------------------------------------------------------

export interface TypeShare { type: ActType; miles: number; secs: number; count: number }

export function breakdown(acts: Activity[]): TypeShare[] {
  return ACT_TYPES.map(([type]) => {
    const xs = acts.filter((a) => a.type === type);
    return { type, miles: Math.round(xs.reduce((n, a) => n + a.dist, 0) * 10) / 10, secs: xs.reduce((n, a) => n + a.secs, 0), count: xs.length };
  }).filter((x) => x.count);
}

export function feelCounts(acts: Activity[]): Record<Feel, number> {
  const c: Record<Feel, number> = { easy: 0, ok: 0, hard: 0 };
  for (const a of acts) if (a.feel) c[a.feel]++;
  return c;
}

// Records ---------------------------------------------------------------------------------------

export interface Record_ { key: string; label: string; value: string; detail: string; act?: Activity }

const paceTxt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const dur = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`; };
const when = (d: Date) => fmt(d, { month: "short", day: "numeric", year: "numeric" });

/** Bests within these activities (and these days' steps). */
export function recordsOf(acts: Activity[], steps: Map<number, number>, inR: (d: Date) => boolean): Record_[] {
  const out: Record_[] = [];
  const top = (xs: Activity[], score: (a: Activity) => number) => xs.reduce<Activity | null>((b, a) => (score(a) > (b ? score(b) : -Infinity) ? a : b), null);
  const far = top(acts.filter((a) => a.dist > 0), (a) => a.dist);
  if (far) out.push({ key: "far", label: "Farthest", value: `${far.dist.toFixed(2)} mi`, detail: `${far.title}, ${when(far.date)}`, act: far });
  const long = top(acts.filter((a) => a.secs > 0 && a.type !== "strength"), (a) => a.secs);
  if (long) out.push({ key: "long", label: "Longest session", value: dur(long.secs), detail: `${long.title}, ${when(long.date)}`, act: long });
  const foot = top(acts.filter((a) => (a.type === "run" || a.type === "walk") && a.dist >= 1 && a.secs), (a) => -a.secs / a.dist);
  if (foot) out.push({ key: "pace", label: "Fastest pace", value: `${paceTxt(foot.secs / foot.dist)} /mi`, detail: `${foot.title}, ${when(foot.date)}`, act: foot });
  const ride = top(acts.filter((a) => a.type === "bike" && a.dist >= 2 && a.secs), (a) => a.dist / a.secs);
  if (ride) out.push({ key: "mph", label: "Fastest ride", value: `${(ride.dist / (ride.secs / 3600)).toFixed(1)} mph`, detail: `${ride.title}, ${when(ride.date)}`, act: ride });
  const byDay = new Map<number, number>(), byWeek = new Map<number, number>();
  for (const a of acts) {
    if (!a.dist) continue;
    byDay.set(a.date.getTime(), (byDay.get(a.date.getTime()) || 0) + a.dist);
    const wk = MON(a.date).getTime();
    byWeek.set(wk, (byWeek.get(wk) || 0) + a.dist);
  }
  const best = (m: Map<number, number>) => [...m].reduce<[number, number] | null>((b, x) => (!b || x[1] > b[1] ? x : b), null);
  const bd = best(byDay), bw = best(byWeek);
  if (bd) out.push({ key: "day", label: "Biggest day", value: `${bd[1].toFixed(1)} mi`, detail: when(new Date(bd[0])) });
  if (bw) out.push({ key: "week", label: "Biggest week", value: `${bw[1].toFixed(1)} mi`, detail: `Week of ${fmt(new Date(bw[0]), { month: "short", day: "numeric" })}` });
  const sd = best(new Map([...steps].filter(([ms]) => inR(new Date(ms)))));
  if (sd) out.push({ key: "steps", label: "Most steps", value: sd[1].toLocaleString("en-US"), detail: when(new Date(sd[0])) });
  return out;
}

// Speed and heart rate --------------------------------------------------------------------------

export interface SpeedPoint { date: Date; value: number; hr?: number; act: Activity }

/** Pace (seconds per mile) for walks and walk/runs, or mph for rides, one point per session. */
export function speedSeries(acts: Activity[], kind: "foot" | "bike"): SpeedPoint[] {
  return acts
    .filter((a) => (kind === "bike" ? a.type === "bike" : a.type === "run" || a.type === "walk") && a.dist >= 0.5 && a.secs > 0)
    .map((a) => ({ date: a.date, value: kind === "bike" ? a.dist / (a.secs / 3600) : a.secs / a.dist, hr: a.hr, act: a }));
}
