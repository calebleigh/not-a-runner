import { describe, expect, it } from "vitest";
import { computeModel, emptyState, recentActivity } from "./index";

const NOW = new Date(2026, 9, 14, 18); // Wed of week 2

describe("recent entries", () => {
  it("lists everything logged, newest first by when it was logged", () => {
    const s = emptyState();
    s.done["2-0-c"] = 1;
    s.logs["2-0-c"] = { dist: 1.5, time: 1500, feel: "ok", at: new Date(2026, 9, 12, 7).getTime() };
    s.done["2-1-s"] = 1;
    s.logs["2-1-s"] = { feel: "easy", at: new Date(2026, 9, 13, 19).getTime() };
    s.extras["2-2"] = [{ kind: "hike", dist: 3, time: 3600, label: "Pine Valley", at: new Date(2026, 9, 14, 9).getTime() }];
    s.steps["2-1"] = 9000;
    s.weights["2"] = 195;
    const r = recentActivity(computeModel(s, NOW), 10);
    expect(r.map((x) => x.icon)).toEqual(["extra", "strength", "steps", "bike", "weigh"]);
    expect(r[0].title).toBe("Hike: Pine Valley");
    expect(r[0].detail).toBe("3 mi, 1:00:00");
    expect(r[0].target).toEqual({ kind: "extra", date: new Date(2026, 9, 14) });
    expect(r.at(-1)!.title).toBe("195 lb");
  });

  it("keeps the newest few", () => {
    const s = emptyState();
    for (let d = 0; d < 7; d++) s.steps[`1-${d}`] = 1000 * (d + 1);
    const r = recentActivity(computeModel(s, NOW), 5);
    expect(r.map((x) => x.title)).toEqual(["7,000 steps", "6,000 steps", "5,000 steps", "4,000 steps", "3,000 steps"]);
  });

  it("is empty with nothing logged", () => {
    expect(recentActivity(computeModel(emptyState(), NOW))).toEqual([]);
  });
});
