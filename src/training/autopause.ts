// Auto-pause: the clock stops when you stop moving and starts again when you move. Movement is new
// steps, or GPS distance. Pure, so the rules are the same everywhere and easy to test.
//
// The phone's step counter reports late (in bursts, and not at all while the phone is locked), so a
// pause can be a mistake. When it ends, the steps and distance during it tell which it was: moving
// the whole time means the pause is erased, as if it never happened.
import type { TrackKind } from "./track";

/** Choices for the setting, in seconds (0 is off). */
export const AUTO_PAUSE_CHOICES = [0, 10, 15, 30] as const;
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
