import { describe, expect, it } from "vitest";
import { applyExtraAsCardio, computeModel, dayCardio, emptyState, extraCal, loggedFootSteps, totals } from "./index";
import type { Extra } from "./types";

const NOW = new Date(2026, 9, 7, 18); // Wed of week 1
const walk: Extra = { kind: "walk", dist: 2, time: 2400 };
const swim: Extra = { kind: "swim", dist: 0.5, time: 1800 };
const hike: Extra = { kind: "hike", dist: 3, time: 4500 };

describe("extra activity types", () => {
  it("uses a fixed rate for the new types and the speed rates for walk and bike", () => {
    const s = emptyState();
    s.settings.startWt = 200;
    // 6 MET x 90.7 kg x 0.5 h
    expect(extraCal(s, swim, 1)).toBe(Math.round(6 * 200 * 0.4536 * 0.5));
    expect(extraCal(s, { kind: "elliptical", dist: 0, time: 0 }, 1)).toBe(0);
    expect(extraCal(s, walk, 1)).toBeGreaterThan(0);
  });

  it("only estimates steps for walking and hiking", () => {
    const s = emptyState();
    s.extras["1-2"] = [walk, swim, hike, { kind: "row", dist: 2, time: 1200 }];
    expect(loggedFootSteps(s, 1, 2)).toBe(2 * 2250 + 3 * 2250);
  });

  it("puts miles in the right Stats bucket", () => {
    const s = emptyState();
    s.extras["1-2"] = [walk, swim, hike, { kind: "bike", dist: 6, time: 1500 }];
    const t = totals(computeModel(s, NOW));
    expect(t.walk).toBe(5);
    expect(t.bike).toBe(6);
    expect(t.other).toBe(0.5);
  });

  it("lets a hike fill a planned session as a walk", () => {
    const s = emptyState();
    s.extras["1-2"] = [hike];
    expect(applyExtraAsCardio(s, 1, 2, 0, hike, "bike", { dist: 3, time: 4500, feel: "ok" }, 1)).toBe(true);
    expect(s.swaps["1-2-c"]).toBe("walk");
  });
});

describe("day totals", () => {
  it("adds the planned session and every extra", () => {
    const s = emptyState();
    s.done["1-2-c"] = 1;
    s.logs["1-2-c"] = { dist: 1.02, time: 1440, feel: "ok", at: 1 };
    s.extras["1-2"] = [walk, hike];
    const d = dayCardio(computeModel(s, NOW), 1, 2);
    expect(d).toMatchObject({ dist: 6.02, secs: 1440 + 2400 + 4500, extras: 2, plannedDone: true });
    expect(d.cal).toBeGreaterThan(0);
  });

  it("ignores a log that isn't marked done", () => {
    const s = emptyState();
    s.logs["1-2-c"] = { dist: 1, time: 600, at: 1 };
    expect(dayCardio(computeModel(s, NOW), 1, 2)).toMatchObject({ dist: 0, plannedDone: false });
  });
});
