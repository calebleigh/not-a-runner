// Notifications for the bell in the header: today's nudges plus to-dos that need attention.
import { coachTips, type TipAction } from "./coach";
import { todoLists } from "./todo";
import type { Model } from "./types";

export interface Note {
  /** Stable for the day, so "seen" survives reloads but a new day's nudge is new again. */
  key: string;
  kind: "tip" | "adjust" | "todo";
  text: string;
  action?: { label: string; to: TipAction | { type: "todo" } };
}

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function notifications(model: Model, now: Date): Note[] {
  const day = ymd(model.today), out: Note[] = [];
  for (const t of coachTips(model, now.getHours())) {
    out.push({ key: `${day}:${t.t}`, kind: t.adj ? "adjust" : "tip", text: t.t, action: t.a && t.action ? { label: t.a, to: t.action } : undefined });
  }
  const { now: open } = todoLists(model);
  for (const it of open) {
    if (it.status === "overdue") out.push({ key: `${day}:od:${it.key}`, kind: "todo", text: `Overdue: ${it.text}`, action: { label: "View", to: { type: "todo" } } });
    else if (it.due && it.status === "due" && it.due.getTime() <= model.today.getTime()) out.push({ key: `${day}:due:${it.key}`, kind: "todo", text: `Due today: ${it.text}`, action: { label: "View", to: { type: "todo" } } });
  }
  return out;
}
