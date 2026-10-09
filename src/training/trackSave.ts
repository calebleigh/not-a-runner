// Saving a tracked workout: into a planned session, or as an extra activity for the day.
import { dayKey } from "./calendar";
import { dayAt } from "./model";
import { stepsToMiles, strideFor } from "./stride";
import { encodeRoute, thinRoute, trackStats, type Track } from "./track";
import type { Feel, Model, State } from "./types";

export interface TrackExtras {
  /** Indoors: no GPS; distance comes from steps (or what you type). */
  indoor?: boolean;
  steps?: number;
  /** Distance you typed (miles), e.g. from a treadmill. Replaces the measured or estimated one. */
  miles?: number;
}

export interface SaveTrackInput extends TrackExtras {
  track: Track;
  /** When Finish was tapped. */
  finishedAt: number;
  feel?: Feel;
  /** A planned session (week and day), or null for an extra activity on `date`. */
  target: { w: number; d: number } | null;
  /** The day the workout was done (for extras). */
  date: Date;
  /** Extra activities need an id. */
  newId: () => string;
}

/**
 * Distance and time to save. Outdoors: GPS distance and moving time. Indoors: steps times your
 * stride, and the full time. Either way, a typed distance wins, and without any distance the full
 * time counts.
 */
export function trackResult(state: State, track: Track, finishedAt: number, x: TrackExtras = {}) {
  const s = trackStats(track, finishedAt);
  const fromSteps = x.indoor && x.steps && track.kind !== "bike" ? stepsToMiles(x.steps, strideFor(state, track.kind === "run" ? "run" : "walk")) : 0;
  const measured = x.indoor ? fromSteps : s.miles;
  const miles = x.miles != null && x.miles >= 0 ? x.miles : measured;
  const dist = Math.round(miles * 100) / 100;
  // With auto-pause the clock already leaves out stops, so it's what you saw that gets saved.
  const time = !track.autoPause && !x.indoor && x.miles == null && dist >= 0.05 ? s.movingS : s.elapsedS;
  return { dist, time, estimated: !!x.indoor && x.miles == null && dist > 0, stats: s };
}

/** Writes the workout into `draft`. Returns where it went. */
export function saveTrack(draft: State, model: Model, x: SaveTrackInput): "session" | "extra" {
  const { dist, time } = trackResult(draft, x.track, x.finishedAt, x);
  const route = !x.indoor && x.track.route.length > 1 ? encodeRoute(thinRoute(x.track.route, 10)) : undefined;
  const steps = x.steps && x.steps > 0 ? x.steps : undefined;
  const extra = { ...(route ? { route } : {}), ...(steps ? { steps } : {}), ...(x.indoor ? { indoor: true } : {}) };
  const day = x.target ? dayAt(model, x.target.w, x.target.d) : undefined;
  if (day) {
    const id = day.ids[0];
    draft.done[id] = 1;
    draft.logs[id] = { ...(dist >= 0.05 ? { dist } : {}), time, ...(x.feel ? { feel: x.feel } : {}), at: x.finishedAt, kind: x.track.kind, ...extra };
    return "session";
  }
  const key = dayKey(model.spec, x.date);
  const kind = x.track.kind === "bike" ? "bike" : "walk";
  draft.extras[key] = [...(draft.extras[key] || []), {
    id: x.newId(), kind, dist, time, at: x.finishedAt,
    ...(x.track.kind === "run" ? { label: "Walk/run" } : {}), ...extra,
  }];
  return "extra";
}
