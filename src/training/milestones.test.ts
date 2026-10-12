import { describe, expect, it } from "vitest";
import { milestoneCue, milestoneMarks, milesText, minutesText, MILESTONES_DEFAULT as P } from "./milestones";

const zero = { mi: 0, min: 0, steps: 0 };

describe("milestones", () => {
  it("says nothing until one is reached", () => {
    expect(milestoneCue(P, zero, { miles: 0.9, elapsedS: 299, steps: 999 })).toBeNull();
  });

  it("speaks each as it's reached, once", () => {
    const a = milestoneCue(P, zero, { miles: 1.01, elapsedS: 120, steps: 400 })!;
    expect(a.text).toBe("1 mile");
    expect(milestoneCue(P, a.marks, { miles: 1.2, elapsedS: 130, steps: 500 })).toBeNull();
    const b = milestoneCue(P, a.marks, { miles: 1.3, elapsedS: 300, steps: 1000 })!;
    expect(b.text).toBe("5 minutes. 1,000 steps");
  });

  it("only says the newest after a jump", () => {
    expect(milestoneCue(P, zero, { miles: 4.1, elapsedS: 0, steps: 3200 })!.text).toBe("4 miles. 3,000 steps");
  });

  it("skips what's off", () => {
    expect(milestoneCue({ mi: 0, min: 10, steps: 0, pause: 0 }, zero, { miles: 3, elapsedS: 600, steps: 9000 })!.text).toBe("10 minutes");
  });

  it("starts from where a reopened workout is", () => {
    const marks = milestoneMarks(P, { miles: 2.5, elapsedS: 1500, steps: 4200 });
    expect(milestoneCue(P, marks, { miles: 2.6, elapsedS: 1510, steps: 4300 })).toBeNull();
  });

  it("reads plainly", () => {
    expect(milesText(0.5)).toBe("Half a mile");
    expect(milesText(2.5)).toBe("2.5 miles");
    expect(minutesText(5)).toBe("5 minutes");
    expect(minutesText(60)).toBe("1 hour");
    expect(minutesText(75)).toBe("1 hour 15 minutes");
    expect(minutesText(120)).toBe("2 hours");
  });
});
