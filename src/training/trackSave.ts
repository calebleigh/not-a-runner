// Saving a tracked workout: into a planned session, or as an extra activity for the day.
import { dayKey } from "./calendar";
import { dayAt } from "./model";
import { encodeRoute, thinRoute, trackStats, type Track } from "./track";
import type { Feel, Model, State } from "./types";

export interface SaveTrackInput {
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

/** Distance and time to save. Without GPS distance (indoors), the full time counts. */
export function trackResult(track: Track, finishedAt: number) {
  const s = trackStats(track, finishedAt);
  const dist = Math.round(s.miles * 100) / 100;
  return { dist, time: dist >= 0.05 ? s.movingS : s.elapsedS, stats: s };
}

/** Writes the workout into `draft`. Returns where it went. */
export function saveTrack(draft: State, model: Model, x: SaveTrackInput): "session" | "extra" {
  const { dist, time } = trackResult(x.track, x.finishedAt);
  const route = x.track.route.length > 1 ? encodeRoute(thinRoute(x.track.route, 10)) : undefined;
  const day = x.target ? dayAt(model, x.target.w, x.target.d) : undefined;
  if (day) {
    const id = day.ids[0];
    draft.done[id] = 1;
    draft.logs[id] = { ...(dist >= 0.05 ? { dist } : {}), time, ...(x.feel ? { feel: x.feel } : {}), at: x.finishedAt, ...(route ? { route } : {}) };
    return "session";
  }
  const key = dayKey(model.spec, x.date);
  const kind = x.track.kind === "bike" ? "bike" : "walk";
  draft.extras[key] = [...(draft.extras[key] || []), {
    id: x.newId(), kind, dist, time, at: x.finishedAt,
    ...(x.track.kind === "run" ? { label: "Walk/run" } : {}), ...(route ? { route } : {}),
  }];
  return "extra";
}
