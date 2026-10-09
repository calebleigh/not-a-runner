// Importing from the phone's health store (Health Connect on Android, Apple Health later).
// Steps fill in each day, weigh-ins fill in each week, and workouts land on the planned session
// they match or become extra activities. A session you logged yourself is never replaced without
// asking: that comes back as a conflict.
import { dayKey, parseDayKey, startOfDay } from "./calendar";
import { dayAt } from "./model";
import type { CardioKind, ExtraKind, Log, Model, State } from "./types";

export type HealthKind = ExtraKind | "run";

/** A workout from the health store, already in the app's terms. */
export interface HealthWorkout {
  /** The health store's id for it. */
  id: string;
  kind: HealthKind;
  /** Start and end (ms). */
  start: number;
  end: number;
  /** Active time (s). */
  time: number;
  miles?: number;
  /** Average heart rate. */
  hr?: number;
  /** The app that recorded it, e.g. "Samsung Health". */
  source?: string;
}

export interface HealthData {
  steps: { date: Date; steps: number }[];
  workouts: HealthWorkout[];
  /** Weigh-ins in pounds. */
  weights: { at: number; lb: number }[];
}

/** A workout that matches a session you already logged yourself. */
export interface HealthConflict {
  workout: HealthWorkout;
  w: number;
  d: number;
  title: string;
}

/** What this device has already imported (kept on the device, not synced). */
export interface HealthMemory {
  /** Workouts already handled (id -> end time), so they're not imported or asked about twice. */
  handled: Record<string, number>;
  /** The weigh-in last imported for each week. A different number there means you typed one. */
  weights: Record<string, number>;
  /** Workouts waiting for an answer. */
  pending: HealthConflict[];
}

export const emptyHealthMemory = (): HealthMemory => ({ handled: {}, weights: {}, pending: [] });

export interface HealthImportResult {
  stepDays: number;
  workouts: number;
  weights: number;
  /** New conflicts found in this import. */
  conflicts: number;
}

/** Workouts shorter than this are ignored (a walk to the car isn't training). */
export const MIN_WORKOUT_S = 5 * 60;

/** The health store's workout type, mapped to the app's kinds. Others (strength, yoga, sports) are skipped. */
export function healthKindOf(type: string): HealthKind | null {
  const t = type.toLowerCase();
  if (t === "running" || t === "runningtreadmill" || t === "trackandfield") return "run";
  if (t === "walking" || t === "wheelchairwalkpace") return "walk";
  if (t === "hiking" || t === "snowshoeing") return "hike";
  if (t === "cycling" || t === "bikingstationary" || t === "handcycling" || t === "distancecycling") return "bike";
  if (t === "elliptical" || t === "stairclimbing" || t === "stairclimbingmachine" || t === "stairs") return "elliptical";
  if (t.startsWith("swimming")) return "swim";
  if (t === "rowing" || t === "rowingmachine") return "row";
  if (t === "skating" || t === "skatingsports" || t === "iceskating") return "skate";
  return null;
}

/** Whether a workout of this kind counts for a planned session of that kind. */
export function fitsSession(planned: CardioKind, kind: HealthKind): boolean {
  if (planned === "rest") return false;
  if (planned === "bike") return kind === "bike";
  if (planned === "walk") return kind === "walk" || kind === "hike" || kind === "run";
  // Walk/run, long, test and race days: a band may file a walk/run as either.
  return kind === "run" || kind === "walk";
}

const SLACK = 10 * 60 * 1000;

/** Whether a log (ending at `at`, lasting `time` s) is the same outing as this workout. */
function sameOuting(at: number | undefined, time: number | undefined, w: HealthWorkout): boolean {
  if (!at) return false;
  const end = at, start = at - (time || 0) * 1000;
  return start - SLACK < w.end && end + SLACK > w.start;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function logFrom(w: HealthWorkout): Log {
  return {
    ...(w.miles && w.miles >= 0.05 ? { dist: round2(w.miles) } : {}),
    time: Math.round(w.time),
    ...(w.hr ? { hr: Math.round(w.hr) } : {}),
    at: w.end,
    kind: w.kind === "bike" ? "bike" : w.kind === "run" ? "run" : "walk",
    hc: w.id,
  };
}

/** "w-d" key, or null when the date is outside the plan. */
function planKey(model: Model, date: Date): string | null {
  const key = dayKey(model.spec, date);
  const [w] = parseDayKey(key);
  return w >= 1 && w <= model.spec.weeks ? key : null;
}

/** Whether the day already holds this workout (imported before, or the same outing logged by hand or tracked). */
function alreadyThere(state: State, model: Model, key: string, w: HealthWorkout): boolean {
  const [wk, d] = parseDayKey(key);
  const day = dayAt(model, wk, d);
  const log = day ? state.logs[day.ids[0]] : undefined;
  if (log && (log.hc === w.id || sameOuting(log.at, log.time, w))) return true;
  return (state.extras[key] || []).some((x) => x.id === `hc-${w.id}` || sameOuting(x.at, x.time, w));
}

function addExtra(draft: State, key: string, w: HealthWorkout) {
  const kind: ExtraKind = w.kind === "run" ? "walk" : w.kind;
  draft.extras[key] = [...(draft.extras[key] || []), {
    id: `hc-${w.id}`, kind, dist: round2(w.miles || 0), time: Math.round(w.time), at: w.end,
    ...(w.kind === "run" ? { label: "Run" } : w.source ? { label: w.source } : {}),
  }];
}

/**
 * Brings health data into `draft`. Steps: the bigger of what's there and what came in. Weigh-ins:
 * the week's latest, unless you typed a different one. Workouts: onto the day's planned session when
 * it fits and is empty, otherwise an extra activity. A session you logged yourself becomes a conflict.
 */
export function importHealth(draft: State, model: Model, data: HealthData, mem: HealthMemory): HealthImportResult {
  const r: HealthImportResult = { stepDays: 0, workouts: 0, weights: 0, conflicts: 0 };

  for (const s of data.steps) {
    const key = planKey(model, s.date);
    const n = Math.round(s.steps);
    if (!key || n <= 0 || (draft.steps[key] || 0) >= n) continue;
    draft.steps[key] = n;
    r.stepDays++;
  }

  const latest = new Map<number, { at: number; lb: number }>();
  for (const x of data.weights) {
    const key = planKey(model, new Date(x.at));
    if (!key) continue;
    const [w] = parseDayKey(key);
    const cur = latest.get(w);
    if (!cur || x.at > cur.at) latest.set(w, x);
  }
  for (const [w, x] of latest) {
    const lb = Math.round(x.lb * 10) / 10;
    const have = draft.weights[w], last = mem.weights[w];
    if (have === lb) { mem.weights[w] = lb; continue; }
    if (have != null && have !== last) continue; // typed by hand
    draft.weights[w] = lb;
    mem.weights[w] = lb;
    r.weights++;
  }

  const pendingIds = new Set(mem.pending.map((p) => p.workout.id));
  for (const w of [...data.workouts].sort((a, b) => a.start - b.start)) {
    if (mem.handled[w.id] || pendingIds.has(w.id) || w.time < MIN_WORKOUT_S) continue;
    const date = startOfDay(new Date(w.start));
    const key = planKey(model, date);
    if (!key) continue;
    if (alreadyThere(draft, model, key, w)) { mem.handled[w.id] = w.end; continue; }
    const [wk, d] = parseDayKey(key);
    const day = dayAt(model, wk, d);
    const id = day?.ids[0];
    if (day && id && fitsSession(day.c.kind, w.kind)) {
      const log = draft.logs[id];
      if (!log || (!log.dist && !log.time)) {
        draft.done[id] = 1;
        draft.logs[id] = { ...logFrom(w), ...(log?.feel ? { feel: log.feel } : {}) };
        mem.handled[w.id] = w.end;
        r.workouts++;
        continue;
      }
      if (!log.hc) {
        mem.pending.push({ workout: w, w: wk, d, title: day.c.t });
        pendingIds.add(w.id);
        r.conflicts++;
        continue;
      }
    }
    addExtra(draft, key, w);
    mem.handled[w.id] = w.end;
    r.workouts++;
  }
  return r;
}

export type ConflictChoice = "replace" | "extra" | "skip";

/** Answers a conflict: replace your log with the workout, keep both (the workout as an extra), or ignore it. */
export function resolveConflict(draft: State, model: Model, c: HealthConflict, choice: ConflictChoice, mem: HealthMemory) {
  mem.pending = mem.pending.filter((p) => p.workout.id !== c.workout.id);
  mem.handled[c.workout.id] = c.workout.end;
  if (choice === "skip") return;
  const day = dayAt(model, c.w, c.d);
  const key = `${c.w}-${c.d}`;
  if (choice === "replace" && day) {
    const old = draft.logs[day.ids[0]];
    draft.done[day.ids[0]] = 1;
    draft.logs[day.ids[0]] = { ...logFrom(c.workout), ...(old?.feel ? { feel: old.feel } : {}) };
    return;
  }
  addExtra(draft, key, c.workout);
}

/** Drops memory older than the import window, so it doesn't grow forever. */
export function trimHealthMemory(mem: HealthMemory, now: number, keepDays = 60) {
  const cut = now - keepDays * 86400000;
  for (const [id, end] of Object.entries(mem.handled)) if (end < cut) delete mem.handled[id];
  mem.pending = mem.pending.filter((p) => p.workout.end >= cut);
}
