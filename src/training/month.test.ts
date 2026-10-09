import { describe, expect, it } from "vitest";
import { computeModel, emptyState, monthGrid, planMonths } from "./index";

const WEEK3 = new Date(2026, 9, 21); // Wed of week 3

describe("month calendar", () => {
  it("lays the month out in Monday-first weeks with plan status", () => {
    const s = emptyState();
    let m = computeModel(s, WEEK3);
    const done = m.weeks[2].days[0];
    s.done[done.ids[0]] = 1;
    if (done.ids[1]) s.done[done.ids[1]] = 1;
    m = computeModel(s, WEEK3);
    const g = monthGrid(m, 2026, 9);
    expect(g.every((r) => r.length === 7 && r[0].date.getDay() === 1)).toBe(true);
    const cells = g.flat().filter((c) => c.inMonth);
    expect(cells).toHaveLength(31);
    const at = (dt: Date) => cells.find((c) => c.date.getTime() === dt.getTime())!;
    expect(at(done.date).status).toBe("done");
    expect(at(WEEK3).today).toBe(true);
    // A planned session earlier in the plan that wasn't done counts as missed; later ones are up next.
    const past = m.weeks[1].days[0], next = m.weeks[3].days[0];
    expect(at(past.date).status).toBe("missed");
    expect(at(next.date).status).toBe("up");
    expect(at(next.date).kind).toBe(next.c.kind);
  });

  it("covers the plan's months, start to race", () => {
    const m = computeModel(emptyState(), WEEK3);
    const ms = planMonths(m);
    expect(ms[0]).toEqual([m.spec.start.getFullYear(), m.spec.start.getMonth()]);
    expect(ms.length).toBeGreaterThan(10);
  });
});
