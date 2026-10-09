import { describe, expect, it } from "vitest";
import { computeModel, emptyState, homeTotals } from "./index";

const NOW = new Date(2026, 9, 14, 18); // Wed of week 2 (week 1 starts Mon Oct 5)

describe("home totals", () => {
  it("adds up steps, miles and time for the week, month and all time", () => {
    const s = emptyState();
    s.steps["2-0"] = 8000; // Oct 12
    s.steps["1-0"] = 5000; // Oct 5
    s.done["2-0-c"] = 1;
    s.logs["2-0-c"] = { dist: 2, time: 1800, at: 1 };
    s.done["1-1-c"] = 1;
    s.logs["1-1-c"] = { dist: 5, time: 1200, at: 1 };
    s.extras["2-2"] = [{ kind: "hike", dist: 1.25, time: 600 }];
    const t = homeTotals(computeModel(s, NOW));
    expect(t.week).toEqual({ steps: 8000, miles: 3.3, secs: 2400 });
    expect(t.month).toEqual({ steps: 13000, miles: 8.3, secs: 3600 });
    expect(t.all).toEqual(t.month);
  });
});
