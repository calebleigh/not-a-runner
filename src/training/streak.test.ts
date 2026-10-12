import { describe, expect, it } from "vitest";
import { computeModel, emptyState, streakOf } from "./index";
import type { State } from "./types";

// Week 1 starts Mon Oct 5, 2026; the owner's plan has cardio Monday to Friday, weekends off.
const at = (week: number, day: number) => new Date(2026, 9, 5 + (week - 1) * 7 + day, 12);
const did = (s: State, w: number, ...days: number[]) => { for (const d of days) s.done[`${w}-${d}-c`] = 1; };
const k = (s: State, w: number, d: number) => streakOf(computeModel(s, at(w, d)));

describe("day streak", () => {
  it("counts every day from the first to the latest, rest days included", () => {
    const s = emptyState();
    did(s, 1, 0, 1, 2, 3, 4); did(s, 2, 0, 1, 2, 3, 4);
    const r = k(s, 2, 4);
    expect(r.current).toBe(12); // Mon wk 1 to Fri wk 2
    expect(r.flames).toBe(3);
    expect(r.today).toBe(true);
  });

  it("today being open doesn't cost a flame", () => {
    const s = emptyState();
    did(s, 1, 0, 1);
    const r = k(s, 1, 2);
    expect(r).toMatchObject({ current: 2, flames: 3, today: false });
  });

  it("burns down a layer per missed training day, and doing something fills it back up", () => {
    const s = emptyState();
    did(s, 1, 0);
    expect(k(s, 1, 2).flames).toBe(2); // missed Tuesday
    expect(k(s, 1, 3).flames).toBe(1); // and Wednesday
    did(s, 1, 3);
    expect(k(s, 1, 3)).toMatchObject({ flames: 3, current: 4 });
  });

  it("goes out on the third missed training day, but best remembers", () => {
    const s = emptyState();
    did(s, 1, 0, 1, 2, 3, 4);
    expect(k(s, 2, 3).flames).toBe(0); // missed Mon, Tue, Wed of week 2
    expect(k(s, 2, 3).current).toBe(0);
    expect(k(s, 2, 3).best).toBe(5);
    did(s, 2, 4);
    expect(k(s, 2, 4)).toMatchObject({ current: 1, best: 5, flames: 3 });
  });

  it("rest days never count against you", () => {
    const s = emptyState();
    did(s, 1, 4); // Friday, then a weekend off
    expect(k(s, 2, 0).flames).toBe(3); // Monday, still open
    expect(k(s, 2, 2).flames).toBe(1); // missed Mon and Tue
  });

  it("hitting the step goal keeps a day", () => {
    const s = emptyState();
    s.settings.stepGoal = 8000;
    did(s, 1, 0);
    s.steps["1-1"] = 9000;
    s.steps["1-2"] = 3000; // short of the goal
    expect(k(s, 1, 3)).toMatchObject({ current: 2, flames: 2 });
  });

  it("is zero before the plan starts and with nothing logged", () => {
    expect(streakOf(computeModel(emptyState(), new Date(2026, 9, 1))).current).toBe(0);
    expect(k(emptyState(), 3, 2)).toMatchObject({ current: 0, flames: 0 });
  });
});
