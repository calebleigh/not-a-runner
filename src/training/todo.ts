// To-do list: the user's own items plus the gear list, with gear due dates from the plan.
import { addDays, daysBetween } from "./calendar";
import type { GearItem } from "./data";
import { gearFor, parseYmd } from "./spec";
import type { Model } from "./types";

export interface TodoItem {
  /** "g:<gear key>" or "t:<todo id>". */
  key: string;
  kind: "gear" | "custom";
  text: string;
  done: boolean;
  /** Gear only. */
  gear?: GearItem & { week: number };
  /** Gear always has one; the user's own items only when they set one. */
  due?: Date;
  status: "overdue" | "due" | "soon" | "later" | "none";
}

export interface TodoLists {
  /** Open items to deal with now: anything due within two weeks or overdue, and undated items. */
  now: TodoItem[];
  /** Open items due more than two weeks out. */
  later: TodoItem[];
  /** Owned gear and finished items, most recent first. */
  done: TodoItem[];
}

export function todoLists(model: Model): TodoLists {
  const { state, spec, curWeek, today } = model;
  const gear = gearFor(spec).map((g): TodoItem => {
    const done = !!state.gear[g.k];
    const status = done ? "none" : g.week < curWeek ? "overdue" : g.week === curWeek ? "due" : g.week <= curWeek + 2 ? "soon" : "later";
    return { key: `g:${g.k}`, kind: "gear", text: g.name, done, gear: g, due: addDays(spec.start, (g.week - 1) * 7), status };
  });
  const mine = Object.entries(state.todos)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id, t]): TodoItem => {
      const due = parseYmd(t.due) ?? undefined, n = due ? daysBetween(today, due) : null;
      const status = t.done || n === null ? "none" : n < 0 ? "overdue" : n <= 7 ? "due" : n <= 14 ? "soon" : "later";
      return { key: `t:${id}`, kind: "custom", text: t.text, done: !!t.done, due, status };
    });

  const open = [...gear, ...mine].filter((x) => !x.done);
  const byDate = (a: TodoItem, b: TodoItem) => a.due!.getTime() - b.due!.getTime();
  const pick = (...s: TodoItem["status"][]) => open.filter((x) => s.includes(x.status) && x.due).sort(byDate);
  const doneAt = (x: TodoItem) => (x.kind === "custom" ? state.todos[x.key.slice(2)].done ?? 0 : 0);
  return {
    // Overdue and due now by date, then undated items in the order they were added, then due soon.
    now: [...pick("overdue", "due"), ...open.filter((x) => x.status === "none"), ...pick("soon")],
    later: pick("later"),
    done: [...mine.filter((x) => x.done), ...gear.filter((g) => g.done)].sort((a, b) => doneAt(b) - doneAt(a)),
  };
}
