import { describe, expect, it } from "vitest";
import { OWNER_PROFILE, computeModel, emptyState, type Model, type PlanProfile } from "./index";

const NOW = new Date(2026, 9, 7);
/** "YYYY-MM-DD" for the Saturday of plan week `w` (week 1 starts Mon Oct 5, 2026). */
const raceIn = (w: number) => {
  const d = new Date(2026, 9, 5 + (w - 1) * 7 + 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const profile = (p: Partial<PlanProfile>): PlanProfile => ({ ...OWNER_PROFILE, raceName: "Test Race", ...p });
function model(p: PlanProfile): Model {
  const s = emptyState();
  s.plan = { profile: p };
  return computeModel(s, NOW);
}
const runMinutes = (m: Model) => m.weeks.map((w) => w.days.filter((x) => ["run", "long", "test"].includes(x.c.kind)).reduce((a, x) => a + x.c.m, 0));
const longMiles = (m: Model) => m.weeks.flatMap((w) => w.days.filter((x) => x.c.kind === "long").map((x) => parseFloat(x.c.t.replace(/[^\d.]/g, ""))));

const GRID: PlanProfile[] = [];
for (const goal of ["5k", "10k", "half", "full"] as const)
  for (const startLevel of ["cant_run_mile", "run_1_mile", "run_3_miles", "run_6_plus"] as const)
    for (const weeks of [10, 20, 34, 52])
      for (const impactSensitive of [true, false])
        GRID.push(profile({ goal, startLevel, impactSensitive, raceDate: raceIn(weeks) }));

describe("plan generator", () => {
  it("gives the identical plan for the same profile", () => {
    for (const p of GRID.filter((_, i) => i % 9 === 0)) {
      expect(JSON.stringify(model(p).weeks)).toBe(JSON.stringify(model({ ...p }).weeks));
    }
  });

  it("ends every race plan on race day, after a taper", () => {
    for (const p of GRID) {
      const m = model(p), last = m.weeks[m.weeks.length - 1];
      const race = last.days.find((x) => x.c.kind === "race")!;
      expect(race.date.toDateString(), JSON.stringify(p)).toBe(new Date(p.raceDate + "T00:00").toDateString());
      expect(m.spec.canon.slice(-3)).toEqual([50, 51, 52]);
      // The two weeks before race week ease off.
      const vol = runMinutes(m), n = vol.length;
      if (n >= 6) expect(vol[n - 2]).toBeLessThan(Math.max(...vol.slice(0, n - 3)));
    }
  });

  it("never grows weekly running time more than about 10% over the best week so far", () => {
    for (const p of GRID) {
      const vol = runMinutes(model(p));
      let best = 0;
      vol.forEach((v, i) => {
        // 12.5% allows for rounding sessions to 5 minutes or half miles.
        if (best > 0) expect(v, `${JSON.stringify(p)} week ${i + 1}`).toBeLessThanOrEqual(best * 1.125 + 1);
        best = Math.max(best, v);
      });
    }
  });

  it("scales the race and the long runs to the goal", () => {
    const peak = (goal: PlanProfile["goal"]) => Math.max(...longMiles(model(profile({ goal, raceDate: raceIn(52) }))));
    expect(peak("5k")).toBeLessThanOrEqual(5);
    expect(peak("10k")).toBeGreaterThan(peak("5k"));
    expect(peak("half")).toBe(11);
    // The 10% rule keeps a beginner's marathon long run growing gently; it peaks in the mid to high teens.
    expect(peak("full")).toBeGreaterThanOrEqual(16);
    const raceTitle = (goal: PlanProfile["goal"]) => model(profile({ goal, raceDate: raceIn(30) })).weeks.at(-1)!.days.find((x) => x.c.kind === "race")!.c.t;
    expect(raceTitle("5k")).toBe("Race day: 3.1 miles");
    expect(raceTitle("full")).toBe("Race day: 26.2 miles");
  });

  it("turns bike sessions into walks without a bike", () => {
    const m = model(profile({ hasBike: false, raceDate: raceIn(40) }));
    expect(m.weeks.flatMap((w) => w.days).some((x) => x.c.kind === "bike")).toBe(false);
  });

  it("schedules sessions only on the chosen days, with the long one last", () => {
    for (const days of [[1, 3, 5], [0, 2, 4, 6], [0, 1, 2, 3, 4, 5]]) {
      const m = model(profile({ days, raceDate: raceIn(40) }));
      for (const w of m.weeks.slice(0, -1)) {
        expect(w.days.map((x) => x.d)).toEqual(days);
        const long = w.days.find((x) => x.c.kind === "long");
        if (long) expect(long.d).toBe(days[days.length - 1]);
      }
      // With three days, the long session survives.
      if (days.length === 3) expect(longMiles(m).length).toBeGreaterThan(5);
    }
  });

  it("starts later in the template for runners who already have miles", () => {
    expect(model(profile({ startLevel: "cant_run_mile", raceDate: raceIn(30) })).spec.canon[0]).toBeLessThanOrEqual(2);
    expect(model(profile({ startLevel: "run_3_miles", raceDate: raceIn(30) })).spec.canon[0]).toBeGreaterThanOrEqual(21);
  });

  it("spends longer on the bike-heavy phases for sore knees", () => {
    const firstRun = (impactSensitive: boolean) => model(profile({ impactSensitive, raceDate: raceIn(40) })).spec.canon.findIndex((c) => c >= 14);
    expect(firstRun(true)).toBeGreaterThan(firstRun(false));
  });

  it("warns when the race is too soon for the goal", () => {
    expect(model(profile({ goal: "half", raceDate: raceIn(10) })).spec.warnings.length).toBe(1);
    expect(model(profile({ goal: "5k", raceDate: raceIn(10) })).spec.warnings).toEqual([]);
  });

  it("caps a far-off race at 52 weeks", () => {
    const m = model(profile({ raceDate: raceIn(70) }));
    expect(m.spec.weeks).toBe(52);
    expect(m.weeks.at(-1)!.days.find((x) => x.c.kind === "race")!.date.toDateString()).toBe(new Date(raceIn(70) + "T00:00").toDateString());
  });

  it("builds a fitness plan with no race and no taper", () => {
    const m = model(profile({ goal: "fitness", raceDate: undefined }));
    expect(m.spec.weeks).toBe(52);
    expect(m.spec.race).toBeNull();
    expect(Math.max(...m.spec.canon)).toBeLessThanOrEqual(39);
    expect(m.weeks.flatMap((w) => w.days).some((x) => x.c.kind === "race" || x.c.kind === "rest")).toBe(false);
  });
});
