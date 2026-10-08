// To-do list: the user's own items plus the gear list, with gear due dates from the plan.
import { addDays } from "./calendar";
import type { GearItem } from "./data";
import { gearFor } from "./spec";
import type { Model } from "./types";

export interface TodoItem {
  /** "g:<gear key>" or "t:<todo id>". */
  key: string;
  kind: "gear" | "custom";
  text: string;
  done: boolean;
  /** Gear only. */
  gear?: GearItem & { week: number };
  due?: Date;
  status: "overdue" | "due" | "soon" | "later" | "none";
}

export interface TodoLists {
  /** Open items to deal with now: gear due now or within two weeks, and the user's own items. */
  now: TodoItem[];
  /** Gear for later in the plan. */
  later: TodoItem[];
  /** Owned gear and finished items, most recent first. */
  done: TodoItem[];
}

export function todoLists(model: Model): TodoLists {
  const { state, spec, curWeek } = model;
  const gear = gearFor(spec).map((g): TodoItem => {
    const done = !!state.gear[g.k];
    const status = done ? "none" : g.week < curWeek ? "overdue" : g.week === curWeek ? "due" : g.week <= curWeek + 2 ? "soon" : "later";
    return { key: `g:${g.k}`, kind: "gear", text: g.name, done, gear: g, due: addDays(spec.start, (g.week - 1) * 7), status };
  });
  const mine = Object.entries(state.todos)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id, t]): TodoItem => ({ key: `t:${id}`, kind: "custom", text: t.text, done: !!t.done, status: "none" }));

  const open = (x: TodoItem) => !x.done;
  const now = [
    ...gear.filter((g) => open(g) && (g.status === "overdue" || g.status === "due")),
    ...mine.filter(open),
    ...gear.filter((g) => open(g) && g.status === "soon"),
  ];
  const doneAt = (x: TodoItem) => (x.kind === "custom" ? state.todos[x.key.slice(2)].done ?? 0 : 0);
  return {
    now,
    later: gear.filter((g) => open(g) && g.status === "later"),
    done: [...mine.filter((x) => x.done), ...gear.filter((g) => g.done)].sort((a, b) => doneAt(b) - doneAt(a)),
  };
}
