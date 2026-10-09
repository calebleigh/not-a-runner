import { describe, expect, it } from "vitest";
import {
  activities, breakdown, bucketsOf, canGoBack, change, computeModel, consistency, emptyState, feelCounts, periodOf, recordsOf, seriesOf, speedSeries,
  stepsByDay, summarize, inPeriod,
} from "./index";

const NOW = new Date(2026, 9, 14, 18); // Wed Oct 14, week 2 (week 1 starts Mon Oct 5)

function sample() {
  const s = emptyState();
  s.done["1-0-c"] = 1; s.logs["1-0-c"] = { dist: 2, time: 1800, at: 1, feel: "easy" }; // Mon Oct 5
  s.done["1-1-c"] = 1; s.logs["1-1-c"] = { dist: 1.5, time: 1200, at: 1, feel: "hard", hr: 140 }; // Tue Oct 6
  s.done["2-0-c"] = 1; s.logs["2-0-c"] = { dist: 3, time: 2400, at: 1, feel: "ok" }; // Mon Oct 12
  s.done["2-1-s"] = 1; // strength Tue Oct 13 (if planned)
  s.extras["2-2"] = [{ kind: "hike", dist: 1.25, time: 600 }]; // Wed Oct 14
  s.steps["2-0"] = 8000; s.steps["1-0"] = 5000;
  return computeModel(s, NOW);
}

describe("activities", () => {
  it("lists planned cardio, done strength and extras, oldest first", () => {
    const m = sample(), acts = activities(m);
    expect(acts[0].date).toEqual(new Date(2026, 9, 5));
    expect(acts.filter((a) => a.source === "extra")).toHaveLength(1);
    expect(acts.find((a) => a.source === "extra")!.type).toBe("walk");
    expect(acts.reduce((n, a) => n + a.dist, 0)).toBeCloseTo(7.75);
    const strength = acts.filter((a) => a.type === "strength");
    expect(strength.length).toBe(m.weeks[1].days.find((d) => d.d === 1)?.st && !m.weeks[1].days.find((d) => d.d === 1)!.st!.light ? 1 : 0);
  });

  it("skips planned sessions that were neither done nor timed", () => {
    const s = emptyState();
    s.logs["1-0-c"] = { at: 1, feel: "ok" };
    expect(activities(computeModel(s, NOW))).toHaveLength(0);
  });
});

describe("periods", () => {
  const first = new Date(2026, 9, 5);
  it("labels and bounds each kind", () => {
    const w = periodOf("week", NOW, 0, first);
    expect([w.start, w.end, w.label]).toEqual([new Date(2026, 9, 12), new Date(2026, 9, 19), "This week"]);
    expect(periodOf("week", NOW, -1, first).label).toBe("Last week");
    expect(periodOf("week", NOW, -2, first).label).toBe("Sep 28 to Oct 4");
    expect(periodOf("month", NOW, -1, first).label).toBe("September 2026");
    const q = periodOf("quarter", NOW, 0, first);
    expect([q.start, q.end, q.label]).toEqual([new Date(2026, 7, 1), new Date(2026, 10, 1), "Aug to Oct 2026"]);
    expect(periodOf("quarter", NOW, -1, first).label).toBe("May to Jul 2026");
    expect(periodOf("year", NOW, 0, first).label).toBe("2026");
    expect(periodOf("all", NOW, 0, first).start).toEqual(first);
  });
  it("stops going back before the first day", () => {
    const first = new Date(2026, 9, 5);
    expect(canGoBack(periodOf("week", NOW, 0, first), first)).toBe(true);
    expect(canGoBack(periodOf("week", NOW, -1, first), first)).toBe(false);
    expect(canGoBack(periodOf("all", NOW, 0, first), first)).toBe(false);
  });
});

describe("totals and change", () => {
  it("adds up a period and compares with the one before", () => {
    const m = sample(), acts = activities(m).filter((a) => a.type !== "strength"), steps = stepsByDay(m), first = m.spec.start;
    const now = summarize(acts, steps, periodOf("week", NOW, 0, first)), prev = summarize(acts, steps, periodOf("week", NOW, -1, first));
    expect(now).toMatchObject({ miles: 4.3, secs: 3000, workouts: 2, steps: 8000, activeDays: 2 });
    expect(prev).toMatchObject({ miles: 3.5, secs: 3000, workouts: 2, steps: 5000 });
    expect(change(now.miles, prev.miles)).toBeCloseTo(0.8 / 3.5);
    expect(change(5, 0)).toBeNull();
  });
});

describe("trend buckets", () => {
  const first = new Date(2026, 0, 5);
  it("uses days, weeks or months by period", () => {
    expect(bucketsOf(periodOf("week", NOW, 0, first)).map((b) => b.label).join("")).toBe("MTWTFSS");
    expect(bucketsOf(periodOf("month", NOW, 0, first))).toHaveLength(31);
    expect(bucketsOf(periodOf("quarter", NOW, 0, first)).length).toBeGreaterThanOrEqual(13);
    expect(bucketsOf(periodOf("year", NOW, 0, first)).map((b) => b.label)[0]).toBe("Jan");
  });
  it("sums a metric per bar", () => {
    const m = sample(), acts = activities(m), steps = stepsByDay(m);
    const bs = bucketsOf(periodOf("week", NOW, 0, m.spec.start));
    expect(seriesOf(acts.filter((a) => a.type !== "strength"), steps, bs, "miles").slice(0, 3)).toEqual([3, 0, 1.3]);
    expect(seriesOf(acts, steps, bs, "steps")[0]).toBe(8000);
  });
});

describe("consistency", () => {
  it("counts active days, runs and planned sessions done", () => {
    const m = sample(), c = consistency(m, activities(m).filter((a) => a.type !== "strength"), periodOf("week", NOW, 0, m.spec.start));
    expect(c.dayCount).toBe(3); // Mon to Wed so far
    expect(c.activeDays).toBe(2);
    expect(c.currentRun).toBe(1);
    expect(c.plannedDone).toBe(1);
    expect(c.planned).toBeGreaterThanOrEqual(2);
  });
});

describe("breakdown, feel, records, speed", () => {
  it("splits by type and finds bests", () => {
    const m = sample(), acts = activities(m).filter((a) => a.type !== "strength");
    const b = breakdown(acts);
    expect(b.reduce((n, x) => n + x.count, 0)).toBe(4);
    expect(feelCounts(acts)).toEqual({ easy: 1, ok: 1, hard: 1 });
    const r = recordsOf(acts, stepsByDay(m), () => true);
    expect(r.find((x) => x.key === "far")!.value).toBe("3.00 mi");
    expect(r.find((x) => x.key === "steps")!.value).toBe("8,000");
    expect(r.find((x) => x.key === "week")!.value).toBe("4.3 mi");
    const sp = [...speedSeries(acts, "foot"), ...speedSeries(acts, "bike")];
    expect(sp.length).toBe(4);
    expect(sp.some((p) => p.hr === 140)).toBe(true);
  });
  it("only counts steps inside the filter", () => {
    const m = sample(), r = recordsOf([], stepsByDay(m), inPeriod(periodOf("week", NOW, -1, m.spec.start)));
    expect(r.find((x) => x.key === "steps")!.value).toBe("5,000");
  });
});
