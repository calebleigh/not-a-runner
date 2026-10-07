import { computeAdapt, computeFoot } from "./adapt";
import { startOfDay, todayInfo } from "./calendar";
import { buildWeeks } from "./plan";
import type { Day, Model, State } from "./types";

/** Everything the UI needs, derived from state and today's date. Pure. */
export function computeModel(state: State, now: Date): Model {
  const today = startOfDay(now);
  const info = todayInfo(today);
  const foot = computeFoot(state, today, info.curWeek);
  const adapt = computeAdapt(state);
  const weeks = buildWeeks({ state, curWeek: info.curWeek, adapt, foot });
  return { state, today, ...info, foot, adapt, weeks };
}

export function dayAt(model: Model, w: number, d: number): Day | undefined {
  return model.weeks[w - 1]?.days[d];
}

/** Today's planned day, or null on weekends and before the plan starts. */
export function todayDay(model: Model): Day | null {
  return model.rawWeek >= 1 && !model.isWeekend ? model.weeks[model.curWeek - 1].days[model.todayIdx] : null;
}
