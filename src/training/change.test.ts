import { describe, expect, it } from "vitest";
import { OWNER_PROFILE, changePlan, changeWeek, computeModel, emptyState } from "./index";

const NOW = new Date(2026, 10, 18); // Wed of week 7
const strip = (o: unknown) => JSON.parse(JSON.stringify(o));

describe("changing the plan", () => {
  it("rebuilds only future weeks; earlier weeks keep their sessions", () => {
    const s = emptyState();
    const before = computeModel(s, NOW);
    s.plan = changePlan(s, { ...OWNER_PROFILE, days: [1, 3, 5] }, 7);
    const after = computeModel(s, NOW);
    for (let n = 1; n <= 6; n++) expect(strip(after.weeks[n - 1])).toEqual(strip(before.weeks[n - 1]));
    expect(after.weeks[6].days.map((x) => x.d)).toEqual([1, 3, 5]);
    expect(after.weeks[30].days.map((x) => x.d)).toEqual([1, 3, 5]);
  });

  it("starts with next week when cardio is already logged this week", () => {
    const s = emptyState();
    expect(changeWeek(s, 7, 7)).toBe(7);
    s.done["7-0-c"] = 1;
    expect(changeWeek(s, 7, 7)).toBe(8);
    expect(changeWeek(s, 1, 0)).toBe(1);
  });

  it("keeps logs on frozen weeks attached to their sessions", () => {
    const s = emptyState();
    s.done["2-4-c"] = 1;
    s.logs["2-4-c"] = { dist: 4, time: 1500, feel: "ok", at: 1 };
    s.plan = changePlan(s, { ...OWNER_PROFILE, days: [0, 2, 4] }, 7);
    const m = computeModel(s, NOW);
    expect(m.weeks[1].days.find((x) => x.d === 4)!.ids).toContain("2-4-c");
  });

  it("stacks later changes on top of earlier ones", () => {
    const s = emptyState();
    s.plan = changePlan(s, { ...OWNER_PROFILE, days: [1, 3, 5] }, 7);
    s.plan = changePlan(s, { ...OWNER_PROFILE, days: [0, 2, 4, 6] }, 12);
    expect(s.plan.earlier!.map((e) => [e.untilWeek, e.profile.days])).toEqual([[6, [0, 1, 2, 3, 4]], [11, [1, 3, 5]]]);
    const m = computeModel(s, NOW);
    expect(m.weeks[5].days.map((x) => x.d)).toEqual([0, 1, 2, 3, 4]);
    expect(m.weeks[8].days.map((x) => x.d)).toEqual([1, 3, 5]);
    expect(m.weeks[15].days.map((x) => x.d)).toEqual([0, 2, 4, 6]);
  });

  it("redoing a change in the same week replaces it instead of stacking", () => {
    const s = emptyState();
    s.plan = changePlan(s, { ...OWNER_PROFILE, days: [1, 3, 5] }, 7);
    s.plan = changePlan(s, { ...OWNER_PROFILE, days: [1, 3, 5, 6] }, 7);
    expect(s.plan.earlier!.length).toBe(1);
    expect(s.plan.profile.days).toEqual([1, 3, 5, 6]);
  });

  it("never moves the start date", () => {
    const s = emptyState();
    s.plan = changePlan(s, { ...OWNER_PROFILE, startDate: "2027-01-04", raceName: "New" }, 7);
    expect(s.plan.profile.startDate).toBe(OWNER_PROFILE.startDate);
    expect(computeModel(s, NOW).spec.start.toDateString()).toBe("Mon Oct 05 2026");
  });

  it("moving the race later stretches the remaining weeks", () => {
    const s = emptyState();
    s.plan = changePlan(s, { ...OWNER_PROFILE, goal: "10k", raceName: "Spring 10K", raceDate: "2027-04-24" }, 7);
    const m = computeModel(s, NOW);
    expect(m.spec.weeks).toBe(29);
    expect(m.weeks.at(-1)!.days.find((x) => x.c.kind === "race")!.c.t).toBe("Race day: 6.2 miles");
  });
});
