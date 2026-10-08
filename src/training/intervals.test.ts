import { describe, expect, it } from "vitest";
import { intervalAt, intervalCue, intervalPlan } from "./intervals";
import { intervals } from "./data";

const DESC = "Walk 5 min to warm up, then jog 1.5 min, walk 2 min, 6 rounds.";

describe("interval coaching", () => {
  it("turns instructions into a schedule", () => {
    const p = intervalPlan(DESC)!;
    expect(p.rounds).toBe(6);
    expect(p.segments[0]).toEqual({ kind: "warmup", secs: 300 });
    expect(p.segments[1]).toEqual({ kind: "jog", secs: 90, round: 1 });
    expect(p.segments[2]).toEqual({ kind: "walk", secs: 120, round: 1 });
    expect(p.segments.filter((s) => s.kind === "jog").length).toBe(6);
    expect(p.segments.filter((s) => s.kind === "walk").length).toBe(5);
    expect(p.segments.at(-1)!.kind).toBe("cooldown");
  });

  it("knows where you are and how long is left", () => {
    const p = intervalPlan(DESC)!;
    expect(intervalAt(p, 0)).toMatchObject({ segment: { kind: "warmup" }, left: 300 });
    expect(intervalAt(p, 300)).toMatchObject({ segment: { kind: "jog", round: 1 }, left: 90 });
    expect(intervalAt(p, 400)).toMatchObject({ segment: { kind: "walk", round: 1 }, left: 110 });
    const end = 300 + 6 * 90 + 5 * 120;
    expect(intervalAt(p, end - 1).segment).toMatchObject({ kind: "jog", round: 6 });
    expect(intervalAt(p, end).segment.kind).toBe("cooldown");
    expect(intervalAt(p, end + 999).left).toBeNull();
  });

  it("reads every interval in the plan, and nothing else", () => {
    for (const iv of intervals) expect(intervalPlan(`Walk 5 min to warm up, then ${iv}.`), iv).not.toBeNull();
    expect(intervalPlan("Easy pace: you can talk in full sentences.")).toBeNull();
  });

  it("speaks plainly", () => {
    const p = intervalPlan(DESC)!;
    expect(intervalCue(p, p.segments[1])).toBe("Jog now, 1.5 minutes. Round 1 of 6.");
    expect(intervalCue(p, p.segments[2])).toBe("Walk now, 2 minutes.");
    expect(intervalCue(p, p.segments.at(-2)!)).toBe("Last one. Jog now, 1.5 minutes.");
    expect(intervalCue(intervalPlan("jog 1 min, walk 2 min, 7 rounds")!, { kind: "jog", secs: 60, round: 1 })).toBe("Jog now, 1 minute. Round 1 of 7.");
  });
});
