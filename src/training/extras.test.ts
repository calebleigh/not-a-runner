import { describe, expect, it } from "vitest";
import { canUseAsCardio, computeModel, emptyState, totals, applyExtraAsCardio } from "./index";
import type { Extra } from "./types";

const walk: Extra = { kind: "walk", dist: 1.5, time: 1800, label: "Evening walk" };
const bike: Extra = { kind: "bike", dist: 6, time: 1500 };

describe("using an extra as the day's cardio", () => {
  it("moves the extra into the cardio slot and keeps the others", () => {
    const s = emptyState();
    s.extras["1-2"] = [walk, bike];
    expect(applyExtraAsCardio(s, 1, 2, 1, bike, "bike", { dist: 6, time: 1500, feel: "ok" }, 5)).toBe(true);
    expect(s.extras["1-2"]).toEqual([walk]);
    expect(s.done["1-2-c"]).toBe(1);
    expect(s.logs["1-2-c"]).toEqual({ dist: 6, time: 1500, feel: "ok", at: 5 });
    expect(s.swaps["1-2-c"]).toBeUndefined();
  });

  it("swaps the session to match the extra's kind", () => {
    const s = emptyState();
    s.extras["1-2"] = [walk];
    applyExtraAsCardio(s, 1, 2, 0, walk, "bike", { dist: 1.5, time: 1800, feel: "easy" }, 1);
    expect(s.swaps["1-2-c"]).toBe("walk");
    expect(s.extras["1-2"]).toBeUndefined();
    // Counted once, as walking.
    const t = totals(computeModel(s, new Date(2026, 9, 9)));
    expect(t.walk).toBe(1.5);
    expect(t.bike).toBe(0);
  });

  it("does nothing if the extra changed", () => {
    const s = emptyState();
    s.extras["1-2"] = [bike];
    expect(applyExtraAsCardio(s, 1, 2, 0, walk, "bike", { feel: "ok" }, 1)).toBe(false);
    expect(s.done).toEqual({});
  });

  it("is only offered for open cardio slots", () => {
    const s = emptyState();
    expect(canUseAsCardio(s, 1, 2, "bike")).toBe(true);
    expect(canUseAsCardio(s, 52, 5, "race")).toBe(false);
    expect(canUseAsCardio(s, 1, 6, undefined)).toBe(false);
    s.done["1-2-c"] = 1;
    expect(canUseAsCardio(s, 1, 2, "bike")).toBe(false);
  });
});
