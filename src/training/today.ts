// The Today tab: what's on for today (session, strength, steps, weigh-in, to-dos due) and what's done.
import { dayKey } from "./calendar";
import { hms, kfmt } from "./format";
import { todayDay } from "./model";
import { EXTRA_KINDS } from "./stats";
import type { Extra, Model } from "./types";

export type TodayKind = "cardio" | "strength" | "steps" | "weigh" | "todo";
export interface TodayTask {
  key: string;
  kind: TodayKind;
  title: string;
  detail: string;
  done: boolean;
  /** For to-dos: the to-do's id. */
  todoId?: string;
}
export interface TodayList {
  tasks: TodayTask[];
  /** Extra activities logged today. A bonus: they don't count toward the total. */
  extras: Extra[];
  done: number;
  total: number;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (ms: number, d: Date) => ymd(new Date(ms)) === ymd(d);

export function todayList(model: Model): TodayList {
  const { state, today, rawWeek, dow, curWeek } = model;
  const tasks: TodayTask[] = [];
  const day = todayDay(model);
  if (day && day.c.kind !== "rest") {
    const id = day.ids[0], lg = state.logs[id], done = !!state.done[id];
    const parts = done && lg ? [lg.dist ? `${lg.dist} mi` : "", lg.time ? hms(lg.time) : ""].filter(Boolean) : [];
    tasks.push({ key: id, kind: "cardio", title: day.c.t, detail: done ? parts.join(", ") || "Done" : day.c.d, done });
  }
  if (day?.st) {
    const done = !!state.done[day.ids[1]];
    tasks.push({ key: day.ids[1], kind: "strength", title: day.st.title, detail: `Strength, ${day.st.min} min`, done });
  }
  const steps = state.steps[dayKey(model.spec, today)] || 0, goal = state.settings.stepGoal;
  if (goal) tasks.push({ key: "steps", kind: "steps", title: `${kfmt(goal)} steps`, detail: steps ? `${kfmt(steps)} so far` : "None logged yet", done: steps >= goal });
  else tasks.push({ key: "steps", kind: "steps", title: "Log your steps", detail: steps ? `${kfmt(steps)} steps` : "From your phone or watch", done: steps > 0 });
  if (dow === 0 && rawWeek >= 1) {
    const wv = state.weights[curWeek];
    tasks.push({ key: "weigh", kind: "weigh", title: "Weigh in", detail: wv ? `${wv} lb` : "Monday check-in", done: !!wv });
  }
  // Your own to-dos that are due today or overdue, and ones you checked off today.
  const t0 = ymd(today);
  for (const [id, t] of Object.entries(state.todos).sort((a, b) => a[1].at - b[1].at)) {
    const due = t.due && t.due <= t0;
    if (t.done ? sameDay(t.done, today) && (due || !t.due) : due) {
      tasks.push({ key: `t:${id}`, kind: "todo", title: t.text, detail: !t.due ? "To-do" : t.due < t0 ? "Overdue" : "Due today", done: !!t.done, todoId: id });
    }
  }
  const done = tasks.filter((x) => x.done).length;
  return { tasks, extras: state.extras[dayKey(model.spec, today)] || [], done, total: tasks.length };
}

/** "Walk, 1.2 mi, 24:10" for an extra on the Today list. */
export const extraLine = (x: Extra) => ({
  title: x.label || EXTRA_KINDS[x.kind].label,
  detail: [x.dist ? `${x.dist} mi` : "", x.time ? hms(x.time) : "", x.steps ? `${kfmt(x.steps)} steps` : ""].filter(Boolean).join(", ") || "Logged",
});
