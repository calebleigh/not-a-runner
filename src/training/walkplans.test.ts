import { describe, expect, it } from "vitest";
import { computeModel, emptyState, type Model, type PlanProfile } from "./index";

const NOW = new Date(2026, 9, 7);
const walker = (p: Partial<PlanProfile>): PlanProfile => ({
  goal: "walk", startDate: "2026-10-05", startLevel: "cant_run_mile", days: [0, 1, 2, 3, 4, 5, 6], hasBike: false, impactSensitive: false, walkMin: 20, ...p,
});
function model(p: PlanProfile, strength = false): Model {
  const s = emptyState();
  s.plan = { profile: p };
  if (!strength) s.settings.strength = false;
  return computeModel(s, NOW);
}
const sessions = (m: Model) => m.weeks.flatMap((w) => w.days.map((d) => d.c));

describe("walking plans", () => {
  it("a daily walk is the same walk every chosen day, all year, and never runs", () => {
    const m = model(walker({ walkMin: 30 }));
    expect(m.weeks).toHaveLength(52);
    expect(m.weeks[0].days).toHaveLength(7);
    expect(new Set(sessions(m).map((c) => c.t))).toEqual(new Set(["Walk 30 min"]));
    expect(m.spec.mileTests).toEqual([]);
    expect(m.spec.raceName).toBe("Daily walk");
  });

  it("walk more grows slowly from where you start, with easier weeks, and never runs", () => {
    const m = model(walker({ goal: "walkmore", walkMin: 15, days: [0, 2, 4, 5] }));
    const all = sessions(m);
    expect(all.every((c) => c.kind === "walk")).toBe(true);
    expect(m.weeks[0].days.map((d) => d.c.t)).toEqual(["Walk 15 min", "Walk 15 min", "Walk 15 min", "Long walk 25 min"]);
    const short = m.weeks.map((w) => w.days[0].c.m);
    expect(short[51]).toBeGreaterThan(short[0]);
    expect(Math.max(...short)).toBeLessThanOrEqual(60);
    expect(short[23]).toBeLessThan(short[22]); // every 4th week is easier (once walks are long enough to show it)
    for (let i = 1; i < short.length; i++) if ((i + 1) % 4 && i % 4) expect(short[i]).toBeGreaterThanOrEqual(short[i - 1]);
    expect(Math.max(...all.map((c) => c.m))).toBeLessThanOrEqual(90);
  });

  it("strength is optional and gentle when on", () => {
    expect(model(walker({})).weeks[0].days.every((d) => !d.st)).toBe(true);
    const st = model(walker({}), true).weeks[20].days.map((d) => d.st);
    expect(st.every(Boolean)).toBe(true);
  });
});
