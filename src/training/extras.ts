import { effKind } from "./adapt";
import { dateOf, dayKey } from "./calendar";
import { statKind } from "./stats";
import type { CardioKind, Day, Extra, ExtraKind, Log, Model, State, SwapKind } from "./types";

/** Extra types that can fill a planned cardio slot (counted as a walk or a ride). */
export const CARDIO_EXTRA_KINDS: ExtraKind[] = ["walk", "hike", "bike"];

/** An extra can stand in for a day's planned cardio unless that slot is rest, race day, or already done. */
export function canUseAsCardio(state: State, w: number, d: number, planned: CardioKind | undefined): boolean {
  return !!planned && planned !== "rest" && planned !== "race" && !state.done[`${w}-${d}-c`];
}

/**
 * Weekend make-ups: the earliest session this week that was missed before day d (not done, not rest
 * or race day). An extra logged on d can fill it.
 */
export function makeUpTarget(model: Model, w: number, d: number): Day | null {
  const week = model.weeks[w - 1];
  if (!week) return null;
  return week.days.find((x) => x.d < d && !model.state.done[x.ids[0]] && x.c.kind !== "rest" && x.c.kind !== "race") ?? null;
}

/**
 * Moves extra #index on day w-d into a cardio slot: day `targetD` of the same week (the same day by
 * default; an earlier missed day for a make-up). Logs it, removes the extra, and swaps the session
 * to match (a walk logged on a bike day counts as a walk).
 * Mutates `draft`. Returns false if the extra is no longer there.
 */
export function applyExtraAsCardio(draft: State, w: number, d: number, index: number, expected: Extra, planned: CardioKind, log: Omit<Log, "at">, at: number, targetD = d): boolean {
  const key = `${w}-${d}`, list = draft.extras[key] || [];
  if (JSON.stringify(list[index]) !== JSON.stringify(expected)) return false;
  const id = `${w}-${targetD}-c`;
  const rest = list.filter((_, i) => i !== index);
  if (rest.length) draft.extras[key] = rest;
  else delete draft.extras[key];
  if (expected.kind === "bike" && planned !== "bike") draft.swaps[id] = "bike";
  else if ((expected.kind === "walk" || expected.kind === "hike") && planned !== "walk") draft.swaps[id] = "walk";
  draft.logs[id] = { ...log, at };
  draft.done[id] = 1;
  return true;
}

/**
 * Changing what a logged session was (say, a bike day that was really a walk). "swap" keeps it as
 * the day's session and swaps the session to match; "extra" moves it out as an extra activity, so
 * the planned session is open again. Mutates `draft`.
 */
export function changeLoggedKind(draft: State, model: Model, w: number, d: number, to: SwapKind, how: "swap" | "extra", newId: () => string): void {
  const id = `${w}-${d}-c`, lg = draft.logs[id];
  const e = effKind(draft, w, d);
  if (!e || !draft.done[id]) return;
  if (how === "swap") {
    if (to === statKind(e.base)) delete draft.swaps[id];
    else draft.swaps[id] = to;
    if (lg?.kind) lg.kind = to;
    return;
  }
  const key = dayKey(model.spec, dateOf(model.spec, w, d));
  draft.extras[key] = [...(draft.extras[key] || []), {
    id: newId(), kind: to === "bike" ? "bike" : "walk", dist: lg?.dist || 0, time: lg?.time || 0, at: lg?.at || Date.now(),
    ...(to === "run" ? { label: "Walk/run" } : {}),
    ...(lg?.steps ? { steps: lg.steps } : {}), ...(lg?.route ? { route: lg.route } : {}), ...(lg?.indoor ? { indoor: true } : {}),
  }];
  delete draft.done[id];
  delete draft.logs[id];
  delete draft.swaps[id];
}
