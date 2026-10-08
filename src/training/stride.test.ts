import { describe, expect, it } from "vitest";
import { emptyState } from "./types";
import { DEFAULT_STRIDE, stepsToMiles, strideFor } from "./stride";

describe("stride length", () => {
  it("uses an average stride until it has learned yours", () => {
    expect(strideFor(emptyState(), "walk")).toEqual({ meters: DEFAULT_STRIDE.walk, learned: false });
  });

  it("learns from GPS workouts with steps, walking and walk/run separately", () => {
    const s = emptyState();
    // 1 mile in 2,300 steps: a 0.70 m stride.
    s.logs["1-0-c"] = { dist: 1, steps: 2300, time: 1200, at: 1, route: "x", kind: "walk" };
    s.extras["1-2"] = [{ kind: "walk", dist: 0.5, steps: 1150, time: 600, route: "y" }];
    s.logs["1-1-c"] = { dist: 0.8, steps: 1300, time: 600, at: 1, route: "z", kind: "run" };
    const walk = strideFor(s, "walk");
    expect(walk.learned).toBe(true);
    expect(walk.meters).toBeCloseTo(0.7, 2);
    expect(strideFor(s, "run").learned).toBe(false); // only 1,300 steps of walk/run so far
  });

  it("ignores workouts without GPS and impossible readings", () => {
    const s = emptyState();
    s.logs["1-0-c"] = { dist: 2, steps: 5000, time: 1200, at: 1 }; // typed in, no route
    s.logs["1-1-c"] = { dist: 5, steps: 200, time: 1200, at: 1, route: "x", kind: "walk" }; // 40 m strides
    expect(strideFor(s, "walk").learned).toBe(false);
  });

  it("turns steps into miles", () => {
    expect(stepsToMiles(2235, { meters: 0.72, learned: false })).toBeCloseTo(1, 1);
  });
});
