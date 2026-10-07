import { describe, expect, it } from "vitest";
import { adaptFor, convert, BIKE_SWAP_CAP, RUN_SWAP_CAP, WALK_SWAP_CAP, MILE_TESTS, computeModel, dateOf, emptyState, computeAdapt } from "./index";
import type { Log, State } from "./types";

const NOW = new Date(2027, 2, 10, 9); // week 23

describe("plan", () => {
  it("gives the identical plan for the same inputs", () => {
    const s = emptyState();
    s.gear.kettlebell = 1;
    s.swaps["20-1-c"] = "bike";
    expect(JSON.stringify(computeModel(s, NOW).weeks)).toBe(JSON.stringify(computeModel(structuredClone(s), NOW).weeks));
  });

  it("has 52 weeks, weekdays only, with race day on the final Saturday", () => {
    const { weeks } = computeModel(emptyState(), NOW);
    expect(weeks).toHaveLength(52);
    weeks.slice(0, 51).forEach((w) => expect(w.days).toHaveLength(5));
    const race = weeks[51].days[5];
    expect(race.c.kind).toBe("race");
    expect(race.date.toDateString()).toBe("Sat Oct 02 2027");
  });

  it("places mile tests on Mondays of weeks 14, 27, 40, 49", () => {
    const { weeks } = computeModel(emptyState(), NOW);
    for (const n of MILE_TESTS) expect(weeks[n - 1].days[0].c.kind).toBe("test");
  });

  it("tapers the long run in the last weeks before the race", () => {
    const { weeks } = computeModel(emptyState(), NOW);
    const longMi = (n: number) => parseFloat(weeks[n - 1].days[4].c.t.replace(/[^\d.]/g, ""));
    expect(longMi(49)).toBeGreaterThan(longMi(50));
    expect(longMi(50)).toBeGreaterThan(longMi(51));
  });

  it("keeps swapped sessions within their caps", () => {
    const { weeks } = computeModel(emptyState(), NOW);
    for (const w of weeks) for (const day of w.days) {
      if (day.c.kind === "rest" || day.c.kind === "race") continue;
      expect(convert(day.c, "bike").m).toBeLessThanOrEqual(BIKE_SWAP_CAP);
      expect(convert(day.c, "walk").m).toBeLessThanOrEqual(WALK_SWAP_CAP);
      expect(convert(day.c, "run").m).toBeLessThanOrEqual(RUN_SWAP_CAP);
    }
  });

  it("makes an on-foot session 1.5x longer on the bike, rounded to 5", () => {
    const c = convert({ t: "Walk/run 30 min", d: "", m: 30, kind: "run" }, "bike");
    expect(c).toMatchObject({ t: "Bike 45 min", m: 45, kind: "bike", orig: "Walk/run 30 min" });
  });
});

describe("adaptation", () => {
  const strengthLogs = (s: State, feels: Log["feel"][], week = 20) =>
    feels.forEach((feel, i) => { s.done[`${week}-${i}-s`] = 1; s.logs[`${week}-${i}-s`] = { feel, at: 1 }; });

  it("steps strength up after three strong sessions", () => {
    const s = emptyState();
    strengthLogs(s, ["easy", "easy", "easy"]);
    const a = computeAdapt(s);
    expect(a.str).toBe(1);
    expect(a.msg.str).toBe("Stepped up after strong sessions in week 20.");
  });

  it("eases back after two tough sessions out of three", () => {
    const s = emptyState();
    strengthLogs(s, ["hard", "ok", "hard"]);
    expect(computeAdapt(s).str).toBe(-1);
  });

  it("only steps running up once", () => {
    const s = emptyState();
    // Week 30 Monday, Wednesday and Friday are on-foot. Six fast easy sessions.
    for (const w of [30, 31]) for (const d of [0, 2, 4]) s.logs[`${w}-${d}-c`] = { dist: 3, time: 3 * 600, feel: "easy", at: 1 };
    expect(computeAdapt(s).run).toBe(1);
  });

  it("counts a high heart rate against an on-foot session", () => {
    const s = emptyState();
    for (const d of [0, 2, 4]) s.logs[`30-${d}-c`] = { feel: "easy", hr: 160, at: 1 };
    expect(computeAdapt(s).run).toBe(0);
  });

  it("holds running back when on-foot sessions keep going to the bike", () => {
    const s = emptyState();
    // Weeks 22 and 23 have walk/run on Tue and Thu. Swap four of them.
    for (const id of ["22-1-c", "22-3-c", "23-1-c", "23-3-c"]) s.swaps[id] = "bike";
    const m = computeModel(s, new Date(2027, 2, 12)); // Fri of week 23
    expect(m.foot.swapped).toBe(4);
    const ctx = { state: s, curWeek: m.curWeek, adapt: m.adapt, foot: m.foot };
    expect(adaptFor(ctx, m.curWeek, "run")).toBe(-1);
  });

  it("never changes past weeks", () => {
    const s = emptyState();
    strengthLogs(s, ["easy", "easy", "easy"], 10);
    const base = computeModel(emptyState(), NOW), adj = computeModel(s, NOW);
    expect(adj.adapt.str).toBe(1);
    for (let n = 1; n < base.curWeek; n++) expect(adj.weeks[n - 1]).toEqual(base.weeks[n - 1]);
    expect(adj.weeks[base.curWeek].days[0].st).not.toEqual(base.weeks[base.curWeek].days[0].st);
  });

  it("dates match the plan calendar", () => {
    expect(dateOf(1, 0).toDateString()).toBe("Mon Oct 05 2026");
  });
});
