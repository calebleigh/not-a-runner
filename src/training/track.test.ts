import { describe, expect, it } from "vitest";
import { MILE, addFix, meters, newTrack, pause, resume, thinRoute, trackStats, type Fix, type Track } from "./track";

// A straight walk north from St. George. One degree of latitude is about 111,195 m.
const START = { lat: 37.0965, lon: -113.5684 };
const north = (m: number) => START.lat + m / 111195;
/** Fixes every `everyS` seconds at `mps` meters per second. */
function walk(tr: Track, seconds: number, mps: number, everyS = 5, t0 = tr.anchor?.t ?? 0, m0 = 0): Track {
  for (let s = everyS; s <= seconds; s += everyS) tr = addFix(tr, { lat: north(m0 + mps * s), lon: START.lon, t: t0 + s * 1000, acc: 5 });
  return tr;
}
const begin = (kind: Track["kind"] = "walk") => addFix(newTrack(kind, 0), { lat: START.lat, lon: START.lon, t: 0, acc: 5 });

describe("tracking", () => {
  it("measures distance between points", () => {
    expect(meters(START, { lat: north(1000), lon: START.lon })).toBeCloseTo(1000, 0);
  });

  it("adds up a steady walk and its pace", () => {
    const tr = walk(begin(), 20 * 60, 1.34); // 20 min at 3 mph
    const s = trackStats(tr, 20 * 60 * 1000);
    expect(s.miles).toBeCloseTo(1, 1);
    expect(s.movingS).toBe(1200);
    expect(s.paceS! / 60).toBeCloseTo(20, 0);
    expect(s.splitS.length).toBe(0);
  });

  it("records a split each mile", () => {
    const tr = walk(begin(), 40 * 60, 1.4);
    const s = trackStats(tr, 40 * 60 * 1000);
    expect(s.splitS.length).toBe(2);
    expect(s.splitS[0]).toBeCloseTo(MILE / 1.4, -1);
  });

  it("ignores GPS wobble while standing still", () => {
    let tr = begin();
    for (let s = 5; s <= 600; s += 5) tr = addFix(tr, { lat: START.lat + (s % 2 ? 1 : -1) * 0.00002, lon: START.lon, t: s * 1000, acc: 8 });
    const st = trackStats(tr, 600_000);
    expect(st.miles).toBe(0);
    expect(st.movingS).toBe(0);
  });

  it("drops inaccurate fixes and impossible jumps", () => {
    let tr = walk(begin(), 60, 1.4);
    const before = tr.distM;
    tr = addFix(tr, { lat: north(5000), lon: START.lon, t: 65_000, acc: 5 }); // 5 km in 5 s
    tr = addFix(tr, { lat: north(200), lon: START.lon, t: 70_000, acc: 80 }); // too inaccurate
    expect(tr.distM).toBe(before);
    tr = walk(tr, 60, 1.4, 5, 60_000, 84);
    expect(tr.distM).toBeGreaterThan(before);
  });

  it("doesn't count time stopped at a light as moving", () => {
    let tr = walk(begin(), 300, 1.4);
    // Stand still for two minutes.
    for (let s = 305; s <= 420; s += 5) tr = addFix(tr, { lat: north(420), lon: START.lon, t: s * 1000, acc: 5 });
    tr = walk(tr, 300, 1.4, 5, 420_000, 420);
    const st = trackStats(tr, 720_000);
    expect(st.movingS).toBeGreaterThanOrEqual(595);
    expect(st.movingS).toBeLessThanOrEqual(610);
    expect(st.elapsedS).toBe(720);
  });

  it("pausing stops distance and the clock; resuming doesn't add the paused stretch", () => {
    let tr = walk(begin(), 300, 1.4);
    tr = pause(tr, 300_000);
    tr = walk(tr, 120, 1.4, 5, 300_000, 420); // walked while paused
    tr = resume(tr, 420_000);
    const at = tr.distM;
    tr = walk(tr, 60, 1.4, 5, 420_000, 588);
    expect(at).toBeCloseTo(420, -1);
    expect(tr.distM - at).toBeCloseTo(84, -1);
    expect(trackStats(tr, 480_000).elapsedS).toBe(360);
  });

  it("thins the route but keeps its ends", () => {
    const pts: [number, number][] = Array.from({ length: 100 }, (_, i) => [north(i), START.lon]);
    const thin = thinRoute(pts, 10);
    expect(thin.length).toBeLessThan(15);
    expect(thin[0]).toEqual(pts[0]);
    expect(thin.at(-1)).toEqual(pts[99]);
  });

  it("allows bike speeds that would be a jump on foot", () => {
    const tr = walk(begin("bike"), 600, 6.7); // 15 mph
    expect(trackStats(tr, 600_000).mph).toBeCloseTo(15, 0);
    const onFoot = walk(begin("walk"), 600, 8); // 18 mph "walking" is a GPS problem
    expect(onFoot.distM).toBe(0);
  });
});

// Keep Fix used for type checking in tests.
export type _F = Fix;

describe("route encoding", () => {
  it("round-trips a route to within a meter, as short text", async () => {
    const { encodeRoute, decodeRoute } = await import("./track");
    const pts: [number, number][] = Array.from({ length: 50 }, (_, i) => [north(i * 20), START.lon + i * 0.0001]);
    const s = encodeRoute(pts);
    expect(typeof s).toBe("string");
    expect(s.length).toBeLessThan(pts.length * 12);
    decodeRoute(s).forEach(([la, lo], i) => {
      expect(meters({ lat: la, lon: lo }, { lat: pts[i][0], lon: pts[i][1] })).toBeLessThan(1.5);
    });
    expect(decodeRoute(encodeRoute([[38.5, -120.2], [40.7, -120.95]]))).toEqual([[38.5, -120.2], [40.7, -120.95]]);
  });
});
