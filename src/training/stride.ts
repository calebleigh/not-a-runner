// Stride length: turns steps into distance for indoor tracking. Learned from outdoor (GPS) workouts
// that recorded both distance and steps; average strides until there's enough to go on.
import type { State } from "./types";

/** Average adult stride in meters, used until the app has learned yours. */
export const DEFAULT_STRIDE = { walk: 0.72, run: 0.95 } as const;
/** How many steps of GPS-measured workouts it takes to trust the learned stride. */
const ENOUGH_STEPS = 1500;
const METERS_PER_MILE = 1609.344;

export interface Stride { meters: number; learned: boolean }

/** Your stride for walking or walk/run, from GPS workouts with step counts. */
export function strideFor(state: State, kind: "walk" | "run"): Stride {
  let m = 0, steps = 0;
  const add = (dist?: number, n?: number, k?: string, route?: string) => {
    if (!route || !dist || !n || n < 100) return;
    if ((k === "run") !== (kind === "run")) return;
    const s = (dist * METERS_PER_MILE) / n;
    if (s < 0.3 || s > 2) return; // a bad reading; ignore
    m += dist * METERS_PER_MILE;
    steps += n;
  };
  for (const log of Object.values(state.logs)) add(log.dist, log.steps, log.kind, log.route);
  for (const list of Object.values(state.extras)) for (const x of list) add(x.dist, x.steps, x.label === "Walk/run" ? "run" : "walk", x.route);
  if (steps < ENOUGH_STEPS) return { meters: DEFAULT_STRIDE[kind], learned: false };
  return { meters: Math.round((m / steps) * 1000) / 1000, learned: true };
}

/** Miles from a step count. */
export const stepsToMiles = (steps: number, stride: Stride) => (steps * stride.meters) / METERS_PER_MILE;
