import { describe, expect, it } from "vitest";
import { computeModel, dayGrade, dayKey, emptyState, monthGrid, planMonths } from "./index";

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

  it("grades a day: cardio done is good, everything done is great", () => {
    const s = emptyState();
    const day = computeModel(s, WEEK3).weeks[2].days.find((d) => d.ids[1])!;
    const grade = () => dayGrade(computeModel(s, WEEK3), day, day.date);
    expect(grade()).toBeNull();
    s.done[day.ids[1]!] = 1;
    expect(grade()).toBeNull(); // strength alone isn't a done day
    delete s.done[day.ids[1]!];
    s.done[day.ids[0]] = 1;
    expect(grade()).toBe("good");
    s.done[day.ids[1]!] = 1;
    expect(grade()).toBe("great");
    s.settings.stepGoal = 8000;
    expect(grade()).toBe("good"); // the step goal counts too, once set
    s.steps[dayKey(computeModel(s, WEEK3).spec, day.date)] = 8200;
    expect(grade()).toBe("great");
    expect(monthGrid(computeModel(s, WEEK3), 2026, 9).flat().find((c) => c.date.getTime() === day.date.getTime())).toMatchObject({ status: "done", great: true });
  });

  it("covers the plan's months, start to race", () => {
    const m = computeModel(emptyState(), WEEK3);
    const ms = planMonths(m);
    expect(ms[0]).toEqual([m.spec.start.getFullYear(), m.spec.start.getMonth()]);
    expect(ms.length).toBeGreaterThan(10);
  });
});
