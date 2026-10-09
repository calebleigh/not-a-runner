import { describe, expect, it } from "vitest";
import { computeModel, emptyState, todayDay, todayList, todayLogs } from "./index";

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

  it("makes a card for each thing logged today, with what was entered", () => {
    const s = emptyState();
    const m0 = computeModel(s, WEEK3), day = todayDay(m0)!;
    expect(todayLogs(m0)).toEqual([]);
    s.done[day.ids[0]] = 1;
    s.logs[day.ids[0]] = { dist: 2, time: 1500, at: 5, feel: "easy", steps: 4100, kind: "walk", route: "abc" };
    s.steps["3-2"] = 6000;
    s.extras["3-2"] = [{ kind: "hike", dist: 1, time: 600, label: "Trail", at: 9 }, { kind: "bike", dist: 3, time: 900 }];
    const l = todayLogs(computeModel(s, WEEK3));
    expect(l.map((x) => x.kind)).toEqual(["cardio", "extra", "extra", "steps"]);
    expect(l[0]).toMatchObject({ icon: "walk", route: "abc", at: 5, stats: [{ v: "2", u: "mi" }, { v: "25:00", u: "time" }, { v: "12:30", u: "/mi" }] });
    // A walk logged on a bike day: titled for what it was.
    expect(l[0].title).toBe("Walk");
    expect(l[0].tags.slice(0, 3)).toEqual([`For ${day.c.t}`, "Felt easy", "4,100 steps"]);
    expect(l[1]).toMatchObject({ title: "Trail", index: 0, icon: "walk" });
    expect(l[1].tags.slice(0, 2)).toEqual(["Extra", "Hike"]);
    expect(l[2].stats[2]).toEqual({ v: "12.0", u: "mph" });
    expect(l[3].stats).toEqual([{ v: "6,000", u: "steps" }]);
  });

  it("adds the weigh-in on Mondays", () => {
    const l = todayList(computeModel(emptyState(), new Date(2026, 9, 19)));
    expect(l.tasks.find((t) => t.kind === "weigh")).toMatchObject({ done: false });
  });
});
