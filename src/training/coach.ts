import { pctTxt } from "./adapt";
import { START, addDays, dayKey } from "./calendar";
import { GEAR, milestones } from "./data";
import { phaseOf } from "./plan";
import type { Model } from "./types";

export type TipAction = { type: "steps"; date: Date } | { type: "profile" };
export interface Tip { t: string; a?: string; action?: TipAction; adj?: boolean }

/** The single most useful nudge for today. `hour` is the current local hour. */
export function coachTip(model: Model, hour: number): Tip | undefined {
  const { state, today, curWeek, foot, adapt } = model;
  const tips: Tip[] = [];
  const yd = addDays(today, -1);
  if (yd >= START && state.steps[dayKey(yd)] == null) tips.push({ t: "You haven't logged yesterday's steps.", a: "Add", action: { type: "steps", date: yd } });
  if (hour >= 18 && state.steps[dayKey(today)] == null) tips.push({ t: "End of the day. How many steps today?", a: "Add", action: { type: "steps", date: today } });
  if (phaseOf(curWeek) >= 1 && foot.swapped >= 2) tips.push({ t: `${foot.swapped} of your last ${foot.planned} runs went to the bike. Your legs need time on your feet for 13.1.` });
  const due = GEAR.filter((g) => g.wk <= curWeek && !state.gear[g.k] && g.need);
  if (due.length) tips.push({ t: `Gear due: ${due[0].name}${due.length > 1 ? ` and ${due.length - 1} more` : ""}.`, a: "View", action: { type: "profile" } });
  if (milestones[curWeek]) tips.push({ t: milestones[curWeek] });
  const a: string[] = [];
  if (adapt.run) a.push(`running ${pctTxt(adapt.run)}`);
  if (adapt.bike) a.push(`biking ${pctTxt(adapt.bike)}`);
  if (adapt.str) a.push(`strength ${adapt.str > 0 ? "harder" : "easier"}`);
  if (a.length) tips.push({ t: "Plan adjusted from your logs: " + a.join(", ") + ".", adj: true });
  return tips[0];
}
