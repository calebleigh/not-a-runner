import { describe, expect, it } from "vitest";
import { computeModel, emptyState, todayDay, todayList } from "./index";

const WEEK3 = new Date(2026, 9, 21); // Wed of week 3

describe("today list", () => {
  it("lists today's session, steps and to-dos due, and counts what's done", () => {
    const s = emptyState();
    s.todos.a = { text: "PT visit", at: 1, due: "2026-10-21" };
    s.todos.b = { text: "Later thing", at: 2, due: "2026-10-30" };
    s.todos.c = { text: "Old thing", at: 3, due: "2026-10-19" };
    const m = computeModel(s, WEEK3);
    const l = todayList(m);
    const day = todayDay(m)!;
    expect(l.tasks[0]).toMatchObject({ kind: "cardio", title: day.c.t, done: false });
    expect(l.tasks.filter((t) => t.kind === "todo").map((t) => [t.title, t.detail])).toEqual([["PT visit", "Due today"], ["Old thing", "Overdue"]]);
    expect(l.tasks.some((t) => t.kind === "weigh")).toBe(false);
    expect(l.done).toBe(0);

    s.done[day.ids[0]] = 1;
    s.logs[day.ids[0]] = { dist: 2, time: 1500, at: 1 };
    s.todos.a.done = WEEK3.getTime() + 3600_000;
    s.settings.stepGoal = 8000;
    s.steps["3-2"] = 9000;
    s.extras["3-2"] = [{ kind: "hike", dist: 1, time: 600 }];
    const l2 = todayList(computeModel(s, WEEK3));
    expect(l2.tasks[0]).toMatchObject({ done: true, detail: "2 mi, 25:00" });
    expect(l2.tasks.find((t) => t.kind === "steps")).toMatchObject({ title: "8,000 steps", done: true });
    expect(l2.extras).toHaveLength(1);
    expect(l2.done).toBe(3);
  });

  it("adds the weigh-in on Mondays", () => {
    const l = todayList(computeModel(emptyState(), new Date(2026, 9, 19)));
    expect(l.tasks.find((t) => t.kind === "weigh")).toMatchObject({ done: false });
  });
});
