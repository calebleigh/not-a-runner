import { describe, expect, it } from "vitest";
import { changeLoggedKind, computeModel, effKind, emptyState } from "./index";

const WEEK3 = new Date(2026, 9, 21); // Wed of week 3

/** A done bike session this week, logged by the tracker. */
function bikeDay() {
  const s = emptyState();
  let m = computeModel(s, WEEK3);
  const day = m.weeks[2].days.find((x) => x.c.kind === "bike")!;
  const id = day.ids[0];
  s.done[id] = 1;
  s.logs[id] = { dist: 1.2, time: 1500, at: 5, steps: 2600, kind: "bike" };
  m = computeModel(s, WEEK3);
  return { s, m, day, id };
}

describe("changing what a logged session was", () => {
  it("swaps the session to a walk and keeps the log", () => {
    const { s, m, day, id } = bikeDay();
    changeLoggedKind(s, m, 3, day.d, "walk", "swap", () => "x");
    expect(s.swaps[id]).toBe("walk");
    expect(s.done[id]).toBe(1);
    expect(s.logs[id]).toMatchObject({ dist: 1.2, steps: 2600, kind: "walk" });
    expect(effKind(s, 3, day.d)!.kind).toBe("walk");
    // And back again: the swap goes away.
    changeLoggedKind(s, computeModel(s, WEEK3), 3, day.d, "bike", "swap", () => "x");
    expect(s.swaps[id]).toBeUndefined();
  });

  it("moves it out as an extra walk and reopens the session", () => {
    const { s, m, day, id } = bikeDay();
    changeLoggedKind(s, m, 3, day.d, "walk", "extra", () => "new1");
    expect(s.done[id]).toBeUndefined();
    expect(s.logs[id]).toBeUndefined();
    expect(s.extras[`3-${day.d}`]).toEqual([{ id: "new1", kind: "walk", dist: 1.2, time: 1500, at: 5, steps: 2600 }]);
  });
});
