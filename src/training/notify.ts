// Notifications for the bell in the header: what was missed, today's nudges, and to-dos that need
// attention. Missed things come first: they're the ones you can still fix.
import { addDays, dayKey, startOfDay } from "./calendar";
import { coachTips, type TipAction } from "./coach";
import { DN, kfmt } from "./format";
import { dayAt } from "./model";
import { todoLists } from "./todo";
import type { Model } from "./types";

export type NoteAction = TipAction | { type: "todo" } | { type: "day"; w: number; d: number } | { type: "weigh" };

export interface Note {
  /** Stable for the day, so "seen" survives reloads but a new day's note is new again. */
  key: string;
  kind: "missed" | "tip" | "adjust" | "todo";
  text: string;
  action?: { label: string; to: NoteAction };
}

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export function notifications(model: Model, now: Date): Note[] {
  const { state, spec, today, curWeek, rawWeek } = model;
  const day = ymd(today), out: Note[] = [];
  const started = rawWeek >= 1;
  const dow = (today.getDay() + 6) % 7;

  if (started) {
    // Sessions earlier this week that weren't logged.
    const missedStrength: { d: number; w: number }[] = [];
    for (let d = 0; d < dow; d++) {
      const x = dayAt(model, curWeek, d);
      if (!x) continue;
      if (!state.done[x.ids[0]]) {
        out.push({ key: `${day}:miss:${x.ids[0]}`, kind: "missed", text: `Missed ${DN[d]}: ${x.c.t}`, action: { label: "Log", to: { type: "day", w: curWeek, d } } });
      }
      if (x.st && !x.st.light && x.ids[1] && !state.done[x.ids[1]]) missedStrength.push({ d, w: curWeek });
    }
    if (missedStrength.length) {
      const first = missedStrength[0];
      out.push({
        key: `${day}:miss:str:${missedStrength.map((m) => m.d).join("")}`, kind: "missed",
        text: `Strength not logged for ${list(missedStrength.map((m) => DN[m.d]))}`, action: { label: "Log", to: { type: "day", ...first } },
      });
    }

    // Days in the last week with no steps.
    const noSteps: Date[] = [];
    for (let i = 7; i >= 1; i--) {
      const dt = addDays(today, -i);
      if (dt >= startOfDay(spec.start) && state.steps[dayKey(spec, dt)] == null) noSteps.push(dt);
    }
    if (noSteps.length) {
      const last = noSteps.at(-1)!;
      const names = noSteps.map((dt) => (dt.getTime() === addDays(today, -1).getTime() ? "yesterday" : DN[(dt.getDay() + 6) % 7]));
      out.push({ key: `${day}:nosteps:${noSteps.length}`, kind: "missed", text: `No steps logged for ${list(names)}`, action: { label: "Add", to: { type: "steps", date: last } } });
    }

    // Step goal: yesterday came in under it.
    const goal = state.settings.stepGoal, yd = addDays(today, -1);
    const ySteps = yd >= startOfDay(spec.start) ? state.steps[dayKey(spec, yd)] : undefined;
    if (goal && ySteps != null && ySteps < goal) out.push({ key: `${day}:goal`, kind: "missed", text: `Yesterday: ${kfmt(ySteps)} of ${kfmt(goal)} steps` });

    // This week's Monday weigh-in.
    if (state.weights[curWeek] == null) out.push({ key: `${day}:weigh:${curWeek}`, kind: "missed", text: "No weigh-in this week yet", action: { label: "Weigh in", to: { type: "weigh" } } });
  }

  // Today's nudges (the steps one is covered above).
  for (const t of coachTips(model, now.getHours())) {
    if (t.action?.type === "steps" && t.action.date.getTime() < today.getTime()) continue;
    out.push({ key: `${day}:${t.t}`, kind: t.adj ? "adjust" : "tip", text: t.t, action: t.a && t.action ? { label: t.a, to: t.action } : undefined });
  }

  const { now: open } = todoLists(model);
  for (const it of open) {
    if (it.status === "overdue") out.push({ key: `${day}:od:${it.key}`, kind: "todo", text: `Overdue: ${it.text}`, action: { label: "View", to: { type: "todo" } } });
    else if (it.kind === "custom" && it.due && it.due.getTime() === today.getTime()) out.push({ key: `${day}:due:${it.key}`, kind: "todo", text: `Due today: ${it.text}`, action: { label: "View", to: { type: "todo" } } });
    else if (it.kind === "gear" && it.status === "due") out.push({ key: `${day}:due:${it.key}`, kind: "todo", text: `Due this week: ${it.text}`, action: { label: "View", to: { type: "todo" } } });
  }
  return out;
}
