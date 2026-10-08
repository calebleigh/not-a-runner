import { describe, expect, it } from "vitest";
import { computeModel, emptyState, weekFrac, weekProgress } from "./index";

const NOW = new Date(2026, 9, 9, 12); // Fri of week 1

describe("week progress", () => {
  it("counts cardio for progress and strength on its own", () => {
    const s = emptyState();
    for (const d of [0, 1, 2, 3, 4]) s.done[`1-${d}-c`] = 1;
    s.done["1-0-s"] = 1;
    const m = computeModel(s, NOW), w = m.weeks[0];
    expect(weekProgress(s, w)).toEqual({ cardioDone: 5, cardioTotal: 5, strengthDone: 1, strengthTotal: 5 });
    expect(weekFrac(s, w)).toBe(1);
  });

  it("doesn't count light stretch days as strength", () => {
    const m = computeModel(emptyState(), new Date(2027, 4, 5));
    const w = m.weeks[29]; // Become a runner: Friday is a stretch
    expect(weekProgress(m.state, w).strengthTotal).toBe(4);
  });

  it("drops strength from the plan when turned off", () => {
    const s = emptyState();
    s.settings.strength = false;
    const m = computeModel(s, NOW);
    expect(m.weeks.every((w) => w.days.every((d) => d.st === null && d.ids.length === 1))).toBe(true);
    expect(weekProgress(s, m.weeks[0]).strengthTotal).toBe(0);
  });
});
