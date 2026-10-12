// Auto-pause: the clock stops when you stop moving and starts again when you move. Movement is new
// steps, or GPS distance. Pure, so the rules are the same everywhere and easy to test.
//
// The phone's step counter reports late (in bursts, and not at all while the phone is locked), so a
// pause can be a mistake. When it ends, the steps and distance during it tell which it was: moving
// the whole time means the pause is erased, as if it never happened.
import { meters, type Fix, type TrackKind } from "./track";

/** Choices for the setting, in seconds (0 is off). */
export const AUTO_PAUSE_CHOICES = [0, 5, 10, 15, 30] as const;
export const AUTO_PAUSE_DEFAULT = 15;

/** Time to pause: `secs` without movement (0 is off). */
export function shouldAutoPause(o: { now: number; lastMoveAt: number; secs: number }): boolean {
  return !!o.secs && o.now - o.lastMoveAt >= o.secs * 1000;
}

/** Steps a second, and meters a second, that mean you kept going through the whole pause. */
const KEPT_STEPS = 1;
const KEPT_MPS: Record<TrackKind, number> = { walk: 0.6, run: 0.6, bike: 2 };

/**
 * Ending an auto-pause, given the steps and meters since it began: "erase" when you were moving the
 * whole time (it was a mistake), "resume" when you start again after a real stop, null to stay paused.
 */
export function autoPauseWake(o: { pausedS: number; steps: number; meters: number; kind: TrackKind }): "erase" | "resume" | null {
  const s = Math.max(o.pausedS, 1);
  if ((o.steps >= 3 && o.steps >= s * KEPT_STEPS) || (o.meters >= 10 && o.meters >= s * KEPT_MPS[o.kind])) return "erase";
  if (o.steps >= 3 || o.meters >= 10) return "resume";
  return null;
}

/** How far back GPS looks to judge whether you're moving, and how many fixes to keep for it. */
export const MOVE_WINDOW_MS = 20_000;
const MIN_SPAN_MS = 4_000;
const MOVING_MPS: Record<TrackKind, number> = { walk: 0.45, run: 0.45, bike: 1.2 };

/** The recent fixes worth keeping (the last 20 seconds), with this one added. */
export function keepRecent(recent: Fix[] | undefined, f: Fix): Fix[] {
  return [...(recent ?? []), f].filter((x) => x.t >= f.t - MOVE_WINDOW_MS && x.t <= f.t);
}

/**
 * Moving by GPS: the newest fix is clearly away from where you were a few seconds ago. Standing
 * still, GPS drifts a few meters at a time; that stays under both the fixes' own error and a
 * walking speed, so it never counts.
 */
export function gpsMoving(recent: Fix[], kind: TrackKind): boolean {
  if (recent.length < 2) return false;
  const b = recent[recent.length - 1];
  const a = recent.find((x) => b.t - x.t <= MOVE_WINDOW_MS);
  if (!a || b.t - a.t < MIN_SPAN_MS) return false;
  const d = meters(a, b), need = Math.min(Math.max((a.acc ?? 10) + (b.acc ?? 10), 8), 25);
  return d >= need && d / ((b.t - a.t) / 1000) >= MOVING_MPS[kind];
}

/**
 * Time to auto-pause, everything considered. `background` is the app out of sight where nothing
 * keeps it going (the website): steps stop arriving there, so indoors it waits, and outdoors GPS
 * alone gets at least 30 seconds. The Android app keeps counting steps and ticking in a pocket, so
 * it judges the same way whether it's open or not.
 */
export function autoPauseDue(o: { now: number; lastMoveAt: number; secs: number; kind: TrackKind; indoor: boolean; background: boolean }): boolean {
  if (!o.secs) return false;
  if (o.background && o.indoor) return false;
  const secs = o.background && o.kind !== "bike" ? Math.max(o.secs, 30) : o.secs;
  return shouldAutoPause({ now: o.now, lastMoveAt: o.lastMoveAt, secs });
}

/** Steps so far, and when that count arrived. */
export interface StepMark { t: number; n: number }
/** How far back steps are judged: a few steps in this long is walking; one or two is fidgeting. */
export const STEP_WINDOW_MS = 6_000;
const MOVING_STEPS = 3;

/** The step counts worth keeping: this one, plus enough before it to look back a full window. */
export function keepSteps(log: StepMark[] | undefined, e: StepMark): StepMark[] {
  const all = [...(log ?? []), e], cut = e.t - STEP_WINDOW_MS;
  let base = 0;
  for (let i = 0; i < all.length; i++) if (all[i].t <= cut) base = i;
  return all.slice(base);
}

/**
 * Moving by steps: at least 3 in the last few seconds. Shifting your weight or turning around
 * while you stand counts a step or two, and that shouldn't keep a pause from starting.
 */
export function stepsMoving(log: StepMark[]): boolean {
  if (log.length < 2) return false;
  const last = log[log.length - 1], cut = last.t - STEP_WINDOW_MS;
  let base = log[0];
  for (const x of log) if (x.t <= cut) base = x;
  return last.n - base.n >= MOVING_STEPS;
}
