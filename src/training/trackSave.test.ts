import { describe, expect, it } from "vitest";
import { computeModel, emptyState } from "./index";
import { addFix, decodeRoute, newTrack, type Track } from "./track";
import { saveTrack, trackResult } from "./trackSave";

const NOW = new Date(2026, 9, 8, 7); // Thu of week 1
const T0 = NOW.getTime();
function walked(seconds: number, mps: number, kind: Track["kind"] = "walk"): Track {
  let tr = newTrack(kind, T0);
  for (let s = 0; s <= seconds; s += 5) tr = addFix(tr, { lat: 37.0965 + (mps * s) / 111195, lon: -113.5684, t: T0 + s * 1000, acc: 5 });
  return tr;
}

describe("saving a tracked workout", () => {
  it("logs into the planned session with distance, moving time, feel and route", () => {
    const s = emptyState(), m = computeModel(s, NOW);
    const where = saveTrack(s, m, { track: walked(1200, 1.34), finishedAt: T0 + 1_200_000, feel: "easy", target: { w: 1, d: 3 }, date: NOW, newId: () => "x" });
    expect(where).toBe("session");
    expect(s.done["1-3-c"]).toBe(1);
    const log = s.logs["1-3-c"];
    expect(log.dist).toBeCloseTo(1, 1);
    expect(log.time).toBe(1200);
    expect(log.feel).toBe("easy");
    expect(decodeRoute(log.route!).length).toBeGreaterThan(50);
  });

  it("saves as an extra activity when there's no planned session", () => {
    const s = emptyState(), m = computeModel(s, NOW);
    saveTrack(s, m, { track: walked(900, 6, "bike"), finishedAt: T0 + 900_000, target: null, date: NOW, newId: () => "abc" });
    const x = s.extras["1-3"][0];
    expect(x).toMatchObject({ id: "abc", kind: "bike" });
    expect(x.dist).toBeGreaterThan(3);
    expect(x.route).toBeTypeOf("string");
  });

  it("keeps the full time for a session without GPS distance (indoors)", () => {
    const tr = newTrack("bike", T0);
    const r = trackResult(tr, T0 + 30 * 60_000);
    expect(r.dist).toBe(0);
    expect(r.time).toBe(1800);
  });
});
