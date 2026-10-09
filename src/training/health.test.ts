import { describe, expect, it } from "vitest";
import {
  computeModel, emptyHealthMemory, emptyState, healthKindOf, importHealth, resolveConflict, trimHealthMemory,
  type HealthData, type HealthWorkout, type Model, type State,
} from "./index";

const NOW = new Date(2026, 9, 14, 18); // Wed of week 2 (week 1 starts Mon Oct 5)
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const none = (): HealthData => ({ steps: [], workouts: [], weights: [] });

function dayOfKind(model: Model, kinds: string[]) {
  const day = model.weeks[1].days.find((x) => kinds.includes(x.c.kind))!;
  return { day, date: 5 + 7 + day.d };
}

function workout(date: number, kind: HealthWorkout["kind"], extra: Partial<HealthWorkout> = {}): HealthWorkout {
  const start = at(date, 7), end = at(date, 7, 40);
  return { id: `w${date}${kind}`, kind, start, end, time: 40 * 60, miles: 2.04, hr: 128.4, ...extra };
}

function run(s: State, data: Partial<HealthData>, mem = emptyHealthMemory()) {
  const model = computeModel(s, NOW);
  const r = importHealth(s, model, { ...none(), ...data }, mem);
  return { r, mem, model };
}

describe("health import", () => {
  it("maps workout types and skips the rest", () => {
    expect(healthKindOf("runningTreadmill")).toBe("run");
    expect(healthKindOf("walking")).toBe("walk");
    expect(healthKindOf("bikingStationary")).toBe("bike");
    expect(healthKindOf("swimmingPool")).toBe("swim");
    expect(healthKindOf("strengthTraining")).toBeNull();
  });

  it("fills steps with the bigger number, inside the plan only", () => {
    const s = emptyState();
    s.steps["2-0"] = 9000;
    const { r } = run(s, { steps: [
      { date: new Date(2026, 9, 12), steps: 8000 },
      { date: new Date(2026, 9, 13), steps: 10234 },
      { date: new Date(2026, 8, 1), steps: 5000 },
    ] });
    expect(s.steps).toEqual({ "2-0": 9000, "2-1": 10234 });
    expect(r.stepDays).toBe(1);
  });

  it("takes the week's latest weigh-in but leaves one you typed", () => {
    const s = emptyState();
    const mem = emptyHealthMemory();
    run(s, { weights: [{ at: at(12, 7), lb: 196.04 }, { at: at(13, 7), lb: 195.53 }] }, mem);
    expect(s.weights[2]).toBe(195.5);
    // A newer weigh-in replaces the imported one.
    run(s, { weights: [{ at: at(14, 7), lb: 195 }] }, mem);
    expect(s.weights[2]).toBe(195);
    // One typed by hand stays.
    s.weights[2] = 194;
    run(s, { weights: [{ at: at(14, 8), lb: 193 }] }, mem);
    expect(s.weights[2]).toBe(194);
  });

  it("puts a matching workout on the planned session", () => {
    const s = emptyState();
    const model = computeModel(s, NOW);
    const { day, date } = dayOfKind(model, ["walk", "run"]);
    const { r } = run(s, { workouts: [workout(date, "walk")] });
    expect(r.workouts).toBe(1);
    expect(s.done[day.ids[0]]).toBe(1);
    expect(s.logs[day.ids[0]]).toEqual({ dist: 2.04, time: 2400, hr: 128, at: at(date, 7, 40), kind: "walk", hc: `w${date}walk` });
  });

  it("files a workout that doesn't fit the session as an extra", () => {
    const s = emptyState();
    const model = computeModel(s, NOW);
    const { day, date } = dayOfKind(model, ["bike"]);
    run(s, { workouts: [workout(date, "walk", { source: "Samsung Health" })] });
    expect(s.done[day.ids[0]]).toBeUndefined();
    expect(s.extras[`2-${day.d}`]).toEqual([{ id: `hc-w${date}walk`, kind: "walk", dist: 2.04, time: 2400, at: at(date, 7, 40), label: "Samsung Health" }]);
  });

  it("skips short workouts and ones already imported", () => {
    const s = emptyState();
    const model = computeModel(s, NOW);
    const { date } = dayOfKind(model, ["bike"]);
    const mem = emptyHealthMemory();
    const w = workout(date, "walk");
    run(s, { workouts: [w, workout(date, "hike", { id: "short", time: 120 })] }, mem);
    run(s, { workouts: [w] }, mem);
    expect(Object.values(s.extras).flat()).toHaveLength(1);
    // Even on a new device with no memory, the saved id prevents a copy.
    run(s, { workouts: [w] });
    expect(Object.values(s.extras).flat()).toHaveLength(1);
  });

  it("doesn't double up a session you tracked in the app", () => {
    const s = emptyState();
    const model = computeModel(s, NOW);
    const { day, date } = dayOfKind(model, ["walk", "run"]);
    s.done[day.ids[0]] = 1;
    s.logs[day.ids[0]] = { dist: 2, time: 2300, at: at(date, 7, 42) };
    const { r } = run(s, { workouts: [workout(date, "walk")] });
    expect(r.conflicts).toBe(0);
    expect(s.logs[day.ids[0]].dist).toBe(2);
    expect(Object.keys(s.extras)).toHaveLength(0);
  });

  it("asks before replacing a session you logged yourself", () => {
    const s = emptyState();
    const model = computeModel(s, NOW);
    const { day, date } = dayOfKind(model, ["walk", "run"]);
    s.done[day.ids[0]] = 1;
    s.logs[day.ids[0]] = { dist: 1.5, time: 1800, feel: "hard", at: at(date, 20) };
    const mem = emptyHealthMemory();
    const { r } = run(s, { workouts: [workout(date, "walk")] }, mem);
    expect(r.conflicts).toBe(1);
    expect(s.logs[day.ids[0]].dist).toBe(1.5);
    // Asked once only.
    expect(run(s, { workouts: [workout(date, "walk")] }, mem).r.conflicts).toBe(0);
    resolveConflict(s, model, mem.pending[0], "replace", mem);
    expect(s.logs[day.ids[0]]).toMatchObject({ dist: 2.04, feel: "hard", hc: `w${date}walk` });
    expect(mem.pending).toEqual([]);
    expect(run(s, { workouts: [workout(date, "walk")] }, mem).r.workouts).toBe(0);
  });

  it("keeps both when you say so", () => {
    const s = emptyState();
    const model = computeModel(s, NOW);
    const { day, date } = dayOfKind(model, ["walk", "run"]);
    s.logs[day.ids[0]] = { dist: 1.5, time: 1800, at: at(date, 20) };
    const mem = emptyHealthMemory();
    run(s, { workouts: [workout(date, "walk")] }, mem);
    resolveConflict(s, model, mem.pending[0], "extra", mem);
    expect(s.logs[day.ids[0]].dist).toBe(1.5);
    expect(s.extras[`2-${day.d}`]).toHaveLength(1);
  });

  it("forgets old workouts", () => {
    const mem = emptyHealthMemory();
    mem.handled = { old: at(1, 8) - 70 * 86400000, recent: at(13, 8) };
    trimHealthMemory(mem, NOW.getTime());
    expect(Object.keys(mem.handled)).toEqual(["recent"]);
  });
});
