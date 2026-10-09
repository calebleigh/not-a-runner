import { describe, expect, it } from "vitest";
import { autoPauseWake, shouldAutoPause } from "./index";

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
});
