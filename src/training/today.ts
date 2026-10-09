// The Today tab: what's on for today (session, strength, steps, weigh-in, to-dos due) and what's done.
import { dayKey } from "./calendar";
import { FEEL, hms, kfmt } from "./format";
import { todayDay } from "./model";
import { EXTRA_KINDS, cardioCal, extraCal, extraKind, statKind } from "./stats";
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

/** One thing logged today, as a card: what it was, its numbers, and the details you entered. */
export interface TodayLog {
  key: string;
  kind: "cardio" | "strength" | "steps" | "weigh" | "extra";
  /** For the icon. */
  icon: "walk" | "run" | "bike" | "strength" | "steps" | "weigh" | "extra";
  title: string;
  /** Big numbers: "2.1" "mi". */
  stats: { v: string; u: string }[];
  /** Smaller details: how it felt, steps, heart rate, calories, indoors. */
  tags: string[];
  route?: string;
  /** When it was logged (ms), if known. */
  at?: number;
  /** For extras: which one of the day's list. */
  index?: number;
}

const KIND_LABEL = { walk: "Walk", run: "Run", bike: "Bike" } as const;
const speed = (kind: string, time?: number, dist?: number) =>
  !time || !dist ? null : kind === "bike" ? { v: (dist / (time / 3600)).toFixed(1), u: "mph" } : { v: hms(time / dist), u: "/mi" };

/** Everything logged today, one card each: the session, strength, extras, steps and the weigh-in. */
export function todayLogs(model: Model): TodayLog[] {
  const { state, today, dow, curWeek } = model;
  const out: TodayLog[] = [];
  const day = todayDay(model), w = curWeek;
  if (day && day.c.kind !== "rest" && state.done[day.ids[0]]) {
    const lg = state.logs[day.ids[0]], kind = lg?.kind ?? statKind(day.c.kind);
    const stats = lg ? [lg.dist ? { v: String(lg.dist), u: "mi" } : null, lg.time ? { v: hms(lg.time), u: "time" } : null, speed(kind, lg.time, lg.dist)] : [];
    const cal = cardioCal(state, kind, lg, w), other = kind !== statKind(day.c.kind);
    out.push({
      // Logged as something else than planned (a walk on a bike day): say what it was, and for what.
      key: day.ids[0], kind: "cardio", icon: kind, title: other ? KIND_LABEL[kind] : day.c.t, stats: stats.filter((x) => x != null),
      tags: lg ? [other ? `For ${day.c.t}` : "", lg.feel ? `Felt ${FEEL[lg.feel].toLowerCase()}` : "", lg.steps ? `${kfmt(lg.steps)} steps` : "", lg.hr ? `${lg.hr} bpm` : "", cal ? `~${cal} cal` : "", lg.indoor ? "Indoors" : lg.route ? "GPS" : "", lg.hc ? "Health Connect" : ""].filter(Boolean) : ["Checked off"],
      route: lg?.route, at: lg?.at || undefined,
    });
  }
  if (day?.st && state.done[day.ids[1]]) {
    out.push({ key: day.ids[1], kind: "strength", icon: "strength", title: day.st.title, stats: [{ v: String(day.st.min), u: "min" }], tags: ["Strength"] });
  }
  (state.extras[dayKey(model.spec, today)] || []).forEach((x, i) => {
    const k = extraKind(x.kind), cal = extraCal(state, x, w);
    out.push({
      key: x.id ?? `x${i}`, kind: "extra", icon: x.kind === "bike" ? "bike" : x.kind === "walk" || x.kind === "hike" ? "walk" : "extra",
      title: x.label || k.label,
      stats: [x.dist ? { v: String(x.dist), u: "mi" } : null, x.time ? { v: hms(x.time), u: "time" } : null, speed(x.kind, x.time, x.dist)].filter((v) => v != null),
      tags: ["Extra", x.label ? k.label : "", x.steps ? `${kfmt(x.steps)} steps` : "", cal ? `~${cal} cal` : "", x.indoor ? "Indoors" : x.route ? "GPS" : ""].filter(Boolean),
      route: x.route, at: x.at, index: i,
    });
  });
  const steps = state.steps[dayKey(model.spec, today)] || 0, goal = state.settings.stepGoal;
  if (steps) out.push({ key: "steps", kind: "steps", icon: "steps", title: "Steps", stats: [{ v: kfmt(steps), u: "steps" }], tags: goal ? [`${Math.round((100 * steps) / goal)}% of ${kfmt(goal)}`] : [] });
  const wv = dow === 0 ? state.weights[curWeek] : undefined;
  if (wv) out.push({ key: "weigh", kind: "weigh", icon: "weigh", title: "Weigh-in", stats: [{ v: String(wv), u: "lb" }], tags: [] });
  return out;
}
