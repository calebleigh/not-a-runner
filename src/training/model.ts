import { computeAdapt, computeFoot } from "./adapt";
import { startOfDay, todayInfo } from "./calendar";
import { buildWeeks } from "./plan";
import { specAt, specOf, type PlanSpec } from "./spec";
import type { Day, Model, State } from "./types";

/** Everything the UI needs, derived from state and today's date. Pure. */
export function computeModel(state: State, now: Date): Model {
  const spec = effectiveSpec(state);
  const today = startOfDay(now);
  const info = todayInfo(spec, today);
  const foot = computeFoot(state, today, info.curWeek);
  const adapt = computeAdapt(state);
  const weeks = buildWeeks({ spec, state, curWeek: info.curWeek, adapt, foot });
  return { state, spec, today, ...info, foot, adapt, weeks };
}

/** The current spec, with each week's sessions taken from the answers that week was built from. */
function effectiveSpec(state: State): PlanSpec {
  const spec = specOf(state);
  if (!state.plan?.earlier?.length) return spec;
  const at = (i: number) => specAt(state, i + 1);
  return { ...spec, slots: spec.slots.map((s, i) => at(i).slots[i] ?? s), canon: spec.canon.map((c, i) => at(i).canon[i] ?? c) };
}

export function dayAt(model: Model, w: number, d: number): Day | undefined {
  return model.weeks[w - 1]?.days.find((x) => x.d === d);
}

/** Today's planned day, or null on weekends and before the plan starts. */
export function todayDay(model: Model): Day | null {
  return model.rawWeek >= 1 && !model.isWeekend ? dayAt(model, model.curWeek, model.todayIdx) ?? null : null;
}
