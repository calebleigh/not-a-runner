import { describe, expect, it } from "vitest";
import { autoPauseDue, autoPauseWake, gpsMoving, keepRecent, keepSteps, shouldAutoPause, stepsMoving, type Fix, type StepMark } from "./index";

describe("auto-pause", () => {
  it("pauses after the set time without movement, not before", () => {
    const base = { now: 100_000, lastMoveAt: 100_000, secs: 15 };
    expect(shouldAutoPause({ ...base, now: 114_000 })).toBe(false);
    expect(shouldAutoPause({ ...base, now: 115_000 })).toBe(true);
    expect(shouldAutoPause({ ...base, now: 999_000, secs: 0 })).toBe(false);
  });
  it("erases a pause you walked through (steps reported late)", () => {
    expect(autoPauseWake({ pausedS: 20, steps: 34, meters: 0, kind: "walk" })).toBe("erase");
    expect(autoPauseWake({ pausedS: 40, steps: 0, meters: 50, kind: "walk" })).toBe("erase");
  });
  it("resumes after a real stop, and waits for more than a stray step", () => {
    expect(autoPauseWake({ pausedS: 60, steps: 4, meters: 0, kind: "walk" })).toBe("resume");
    expect(autoPauseWake({ pausedS: 60, steps: 0, meters: 12, kind: "bike" })).toBe("resume");
    expect(autoPauseWake({ pausedS: 60, steps: 1, meters: 0, kind: "walk" })).toBeNull();
    expect(autoPauseWake({ pausedS: 1, steps: 2, meters: 0, kind: "walk" })).toBeNull();
  });

  // About 1.1 m per 0.00001 degrees of latitude.
  const at = (t: number, north: number, acc = 5): Fix => ({ lat: 37 + north / 111195, lon: -113.5, t: t * 1000, acc });
  const feed = (fixes: Fix[]) => fixes.reduce<Fix[]>((r, f) => keepRecent(r, f), []);
  it("doesn't count GPS drift while standing still as moving", () => {
    // Wandering 3 to 6 meters around one spot, a fix a second.
    const drift = Array.from({ length: 30 }, (_, i) => at(i, [0, 3, -2, 6, 1, -4, 5, 2][i % 8]));
    for (let i = 5; i <= 30; i++) expect(gpsMoving(feed(drift.slice(0, i)), "walk")).toBe(false);
  });
  it("counts walking, even slowly, as moving", () => {
    const walk = Array.from({ length: 20 }, (_, i) => at(i, i * 0.9));
    expect(gpsMoving(feed(walk), "walk")).toBe(true);
    // A bike crawling at walking pace isn't riding yet.
    expect(gpsMoving(feed(walk), "bike")).toBe(false);
  });
  it("needs a few seconds of fixes, and forgets old ones", () => {
    expect(gpsMoving(feed([at(0, 0), at(2, 20)]), "walk")).toBe(false);
    const r = feed([at(0, 0), at(10, 30), at(40, 30)]);
    expect(r.length).toBe(1);
  });
  it("needs more distance when the fixes are rough", () => {
    expect(gpsMoving(feed([at(0, 0, 12), at(10, 15, 12)]), "walk")).toBe(false);
    expect(gpsMoving(feed([at(0, 0, 12), at(10, 26, 12)]), "walk")).toBe(true);
  });
  it("pauses indoors on steps alone, open or in a pocket on the phone", () => {
    const o = { now: 116_000, lastMoveAt: 100_000, secs: 15, kind: "walk" as const, indoor: true, background: false };
    expect(autoPauseDue(o)).toBe(true);
    expect(autoPauseDue({ ...o, now: 110_000 })).toBe(false);
    // The website out of sight hears no steps, so it can't tell.
    expect(autoPauseDue({ ...o, background: true })).toBe(false);
    // Outdoors there, GPS alone waits at least 30 seconds.
    expect(autoPauseDue({ ...o, indoor: false, background: true })).toBe(false);
    expect(autoPauseDue({ ...o, indoor: false, background: true, now: 130_000 })).toBe(true);
  });
  const steps = (events: [number, number][]) => events.reduce<StepMark[]>((log, [t, n]) => keepSteps(log, { t: t * 1000, n }), []);
  it("counts walking as moving, but not a stray step or two while standing", () => {
    // Walking: two steps a second.
    expect(stepsMoving(steps([[0, 0], [1, 2], [2, 4]]))).toBe(true);
    // Standing for half a minute, then shifting your weight once, then again 10 seconds later.
    expect(stepsMoving(steps([[0, 100], [30, 101]]))).toBe(false);
    expect(stepsMoving(steps([[0, 100], [30, 101], [40, 102]]))).toBe(false);
    // Starting to walk again after standing: moving within a couple of steps.
    expect(stepsMoving(steps([[0, 100], [30, 101], [31, 103]]))).toBe(true);
    // A late batch from the step counter still counts.
    expect(stepsMoving(steps([[0, 100], [30, 112]]))).toBe(true);
  });
  it("keeps only what it needs to look back", () => {
    const log = steps(Array.from({ length: 60 }, (_, i) => [i, i * 2] as [number, number]));
    expect(log.length).toBeLessThanOrEqual(8);
    expect(stepsMoving(log)).toBe(true);
  });
});
