import { describe, expect, it } from "vitest";
import { autoPauseStep, gpsMoved } from "./index";

describe("auto-pause", () => {
  const base = { now: 100_000, lastMoveAt: 100_000, secs: 15, status: "recording" as const, autoPaused: false, moved: false };
  it("pauses after the set time without movement, not before", () => {
    expect(autoPauseStep({ ...base, now: 114_000 })).toBeNull();
    expect(autoPauseStep({ ...base, now: 115_000 })).toBe("pause");
    expect(autoPauseStep({ ...base, now: 999_000, secs: 0 })).toBeNull();
  });
  it("resumes an auto-pause on movement, never a pause you tapped", () => {
    expect(autoPauseStep({ ...base, status: "paused", autoPaused: true, moved: true })).toBe("resume");
    expect(autoPauseStep({ ...base, status: "paused", autoPaused: true, moved: false })).toBeNull();
    expect(autoPauseStep({ ...base, status: "paused", autoPaused: false, moved: true })).toBeNull();
  });
  it("tells walking from GPS wobble", () => {
    const a = { lat: 37, lon: -113, t: 0, acc: 5 };
    const walk = { lat: 37 + 12 / 111_000, lon: -113, t: 10_000, acc: 5 };
    const wobble = { lat: 37 + 3 / 111_000, lon: -113, t: 10_000, acc: 5 };
    expect(gpsMoved(a, walk, "walk")).toBe(true);
    expect(gpsMoved(a, wobble, "walk")).toBe(false);
    expect(gpsMoved(a, walk, "bike")).toBe(false);
  });
});
