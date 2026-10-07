import type { CardioKind, Extra, Log, State } from "./types";

/** An extra can stand in for a day's planned cardio unless that slot is rest, race day, or already done. */
export function canUseAsCardio(state: State, w: number, d: number, planned: CardioKind | undefined): boolean {
  return !!planned && planned !== "rest" && planned !== "race" && !state.done[`${w}-${d}-c`];
}

/**
 * Moves extra #index on day w-d into that day's cardio slot: logs it, removes the extra,
 * and swaps the session to match (a walk logged on a bike day counts as a walk).
 * Mutates `draft`. Returns false if the extra is no longer there.
 */
export function applyExtraAsCardio(draft: State, w: number, d: number, index: number, expected: Extra, planned: CardioKind, log: Omit<Log, "at">, at: number): boolean {
  const key = `${w}-${d}`, list = draft.extras[key] || [];
  if (JSON.stringify(list[index]) !== JSON.stringify(expected)) return false;
  const id = `${w}-${d}-c`;
  const rest = list.filter((_, i) => i !== index);
  if (rest.length) draft.extras[key] = rest;
  else delete draft.extras[key];
  if (expected.kind === "bike" && planned !== "bike") draft.swaps[id] = "bike";
  else if (expected.kind === "walk" && planned !== "walk") draft.swaps[id] = "walk";
  draft.logs[id] = { ...log, at };
  draft.done[id] = 1;
  return true;
}
