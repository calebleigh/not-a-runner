import { describe, expect, it } from "vitest";
import { computeModel, emptyState, streakOf } from "./index";
import type { State } from "./types";

// Week 1 starts Mon Oct 5, 2026; the owner's plan has five cardio days a week.
const at = (week: number, day: number) => new Date(2026, 9, 5 + (week - 1) * 7 + day, 12);
const doWeek = (s: State, w: number, n: number) => { for (let d = 0; d < n; d++) s.done[`${w}-${d}-c`] = 1; };

describe("weekly streak", () => {
  it("counts weeks in a row with at least 3 of 5 sessions", () => {
    const s = emptyState();
    doWeek(s, 1, 5); doWeek(s, 2, 3); doWeek(s, 3, 4);
    const k = streakOf(computeModel(s, at(4, 1)));
    expect(k.current).toBe(3);
    expect(k.best).toBe(3);
    expect(k.thisWeek).toEqual({ done: 0, need: 3, met: false });
  });

  it("a week in progress doesn't break it, and joins it once met", () => {
    const s = emptyState();
    doWeek(s, 1, 3); doWeek(s, 2, 3);
    expect(streakOf(computeModel(s, at(3, 0))).current).toBe(2);
    doWeek(s, 3, 3);
    expect(streakOf(computeModel(s, at(3, 3))).current).toBe(3);
  });

  it("a mostly missed week resets it, but best remembers", () => {
    const s = emptyState();
    doWeek(s, 1, 5); doWeek(s, 2, 5); doWeek(s, 3, 2); doWeek(s, 4, 3);
    const k = streakOf(computeModel(s, at(5, 2)));
    expect(k.current).toBe(1);
    expect(k.best).toBe(2);
    expect(k.recent.map((r) => r.met)).toEqual([true, true, false, true, false]);
  });

  it("is zero before the plan starts and with nothing logged", () => {
    expect(streakOf(computeModel(emptyState(), new Date(2026, 9, 1))).current).toBe(0);
    expect(streakOf(computeModel(emptyState(), at(3, 2))).current).toBe(0);
  });
});
