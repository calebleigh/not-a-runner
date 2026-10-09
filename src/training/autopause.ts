// Auto-pause: the clock stops when you stop moving and starts again when you move. Movement is new
// steps, or GPS distance. Pure, so the rules are the same everywhere and easy to test.
import { meters, type Fix, type TrackKind } from "./track";

/** Choices for the setting, in seconds (0 is off). */
export const AUTO_PAUSE_CHOICES = [0, 10, 15, 30] as const;
export const AUTO_PAUSE_DEFAULT = 15;

/**
 * What to do now: "pause" after `secs` without movement (only while recording), "resume" once
 * you move again (only out of an auto-pause, never a pause you tapped yourself).
 */
export function autoPauseStep(o: { now: number; lastMoveAt: number; secs: number; status: "recording" | "paused"; autoPaused: boolean; moved: boolean }): "pause" | "resume" | null {
  if (!o.secs) return null;
  if (o.status === "paused") return o.autoPaused && o.moved ? "resume" : null;
  return o.now - o.lastMoveAt >= o.secs * 1000 ? "pause" : null;
}

/** Is a GPS fix (compared with the one before) real movement? Wobble while standing isn't. */
export function gpsMoved(prev: Fix | null, f: Fix, kind: TrackKind): boolean {
  if (!prev || f.t <= prev.t) return false;
  const d = meters(prev, f), v = d / ((f.t - prev.t) / 1000);
  return d >= Math.min(Math.max(f.acc ?? 10, 6), 20) && v >= (kind === "bike" ? 1.5 : 0.6);
}
