// Runs the prototype's own plan code and checks the port produces the same plan, adaptation and stats.
import { readFileSync } from "node:fs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { addDays, dateOf } from "./calendar";
import { specOf } from "./spec";

const SPEC = specOf({});
import { GEAR } from "./data";
import { coachTip, computeModel, encodeBackup, predict, bestFor, stepStats, totals, loggedFootSteps } from "./index";
import type { Feel, State, SwapKind } from "./types";

const html = readFileSync(new URL("../../reference/prototype.html", import.meta.url), "utf8");
// The prototype stepped dates in 24h units, which breaks across DST. The port fixes that on purpose,
// so apply the same fix here and compare only the training logic.
const DST_FIXES: [string, string][] = [
  ["const from=new Date(today.getTime()-13*DAY), to=new Date(START.getTime()+(curWeek*7-1)*DAY);", "const from=__ad(today,-13), to=__ad(START,curWeek*7-1);"],
  ["const dt=new Date(START.getTime()+((n-1)*7+d)*DAY);", "const dt=__ad(START,(n-1)*7+d);"],
  ["const dateOf=(w,d)=>new Date(START.getTime()+((w-1)*7+d)*DAY);", "const dateOf=(w,d)=>__ad(START,(w-1)*7+d);"],
];
let code = html.slice(html.indexOf("const START = new Date(2026, 9, 5);"), html.indexOf("/* ---------- Tabs & refresh ---------- */"));
for (const [from, to] of DST_FIXES) {
  if (!code.includes(from)) throw new Error(`Prototype snippet not found: ${from}`);
  code = code.replace(from, to);
}
code = "const __ad=(b,n)=>new Date(b.getFullYear(),b.getMonth(),b.getDate()+n);\n" + code;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Proto = any;
function runPrototype(state: State): Proto {
  const fn = new Function("__state", `${code}\nstate = __state; rebuild();\nreturn { weeks, ADAPT, FOOT, curWeek, totals, stepStats, predict, bestFor, coachTip, encodeBackup, loggedFootSteps };`);
  return fn(JSON.parse(JSON.stringify(state)));
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A plausible random history up to (not including) `today`. */
function randomState(seed: number, today: Date, feelBias: [number, number], swapRate: number): State {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const feel = (): Feel => { const x = r(); return x < feelBias[0] ? "easy" : x < feelBias[1] ? "ok" : "hard"; };
  const s: State = { done: {}, logs: {}, gear: {}, swaps: {}, weights: {}, settings: {}, extras: {}, steps: {} };
  for (const g of GEAR) if (r() < 0.5) s.gear[g.k] = 1;
  if (r() < 0.5) s.settings.startWt = 180 + Math.round(r() * 60);
  for (let w = 1; w <= 52; w++) {
    for (let d = 0; d < 7; d++) {
      const dt = dateOf(SPEC, w, d);
      if (dt >= today) continue;
      if (d < 5) {
        if (r() < swapRate) s.swaps[`${w}-${d}-c`] = pick<SwapKind>(["bike", "walk", "run"]);
        if (r() < 0.8) {
          const dist = Math.round((0.5 + r() * 6) * 100) / 100;
          s.done[`${w}-${d}-c`] = 1;
          s.logs[`${w}-${d}-c`] = { dist: r() < 0.9 ? dist : undefined, time: Math.round(dist * (540 + r() * 700)), feel: feel(), at: 1, ...(r() < 0.4 ? { hr: 120 + Math.round(r() * 50) } : {}) };
        }
        if (r() < 0.7) { s.done[`${w}-${d}-s`] = 1; s.logs[`${w}-${d}-s`] = { feel: feel(), at: 1 }; }
      }
      if (d === 0 && r() < 0.6) s.weights[w] = 200 - w * 0.4 + Math.round(r() * 30) / 10;
      if (r() < 0.6) s.steps[`${w}-${d}`] = Math.round(3000 + r() * 12000);
      if (r() < 0.1) s.extras[`${w}-${d}`] = [{ kind: pick(["walk", "bike"] as const), dist: Math.round(r() * 500) / 100, time: Math.round(r() * 3600), ...(r() < 0.5 ? { steps: 4000 } : {}) }];
    }
  }
  return s;
}

const strip = (o: unknown) => JSON.parse(JSON.stringify(o));

const DATES = [
  new Date(2026, 9, 7, 10), new Date(2026, 11, 9, 19), new Date(2027, 1, 3, 7), new Date(2027, 3, 21, 20),
  new Date(2027, 6, 14, 12), new Date(2027, 8, 15, 18), new Date(2027, 9, 2, 9), new Date(2027, 10, 2, 9),
];
// [feel bias, swap rate]. The last one swaps often to hit the running hold.
const BIASES: [[number, number], number][] = [[[0.34, 0.67], 0.15], [[0.8, 0.95], 0.15], [[0.05, 0.3], 0.15], [[0.5, 0.8], 0.6]];

const seen = new Set<string>();
afterEach(() => { vi.useRealTimers(); });
afterAll(() => {
  // Make sure the random histories exercised step-ups, ease-backs and the swap hold.
  const v = [...seen].map((s) => s.split(",").map(Number));
  expect(v.some((x) => x[0] > 0) && v.some((x) => x[0] < 0)).toBe(true);
  expect(v.some((x) => x[1] > 0) && v.some((x) => x[1] < 0)).toBe(true);
  expect(v.some((x) => x[2] > 0) && v.some((x) => x[2] < 0)).toBe(true);
  expect(v.some((x) => x[3] >= 3)).toBe(true);
});

describe("prototype parity", () => {
  it("matches for an empty state at plan start", () => {
    vi.useFakeTimers(); vi.setSystemTime(DATES[0]);
    const P = runPrototype({ done: {}, logs: {}, gear: {}, swaps: {}, weights: {}, settings: {}, extras: {}, steps: {} });
    const m = computeModel({ done: {}, logs: {}, gear: {}, swaps: {}, weights: {}, settings: {}, extras: {}, steps: {} }, DATES[0]);
    expect(m.weeks[0].days[0].c.t).toBe(P.weeks[0].days[0].c.t);
  });

  for (const now of DATES) {
    for (const [bi, [bias, swapRate]] of BIASES.entries()) {
      for (const seed of [1, 2, 3]) {
        it(`matches on ${now.toDateString()} (bias ${bi}, seed ${seed})`, () => {
          vi.useFakeTimers(); vi.setSystemTime(now);
          const state = randomState(seed * 101 + bi * 7 + now.getMonth(), new Date(now.getFullYear(), now.getMonth(), now.getDate()), bias, swapRate);
          const P = runPrototype(state);
          const m = computeModel(state, now);

          seen.add(`${m.adapt.run},${m.adapt.bike},${m.adapt.str},${m.foot.swapped}`);
          expect(m.curWeek).toBe(P.curWeek);
          expect(strip(m.adapt)).toEqual(strip(P.ADAPT));
          expect(m.foot).toEqual(P.FOOT);

          m.weeks.forEach((w, i) => {
            const pw = P.weeks[i];
            expect(w.load).toBe(pw.load);
            w.days.forEach((day, d) => {
              const pd = pw.days[d];
              const pc = pd.c;
              expect({ ...day.c, shoes: !!day.c.shoes }, `cardio w${w.n} d${d}`).toEqual(strip({ t: pc.t, d: pc.d, m: pc.m, kind: pc.kind, shoes: !!pc.shoes, orig: pc.orig }));
              expect(day.ids).toEqual(pd.ids);
              if (!pd.st) { expect(day.st).toBeNull(); return; }
              expect(day.st, `strength w${w.n} d${d}`).toEqual(strip({
                title: pd.st.title, sets: pd.st.sets, min: pd.st.min, light: pd.st.light ? true : undefined,
                ex: pd.st.ex.map(([name, amount, unit, sec]: [string, number, string, number?]) => ({ name, amount, unit, seconds: !!sec })),
              }));
            });
          });

          const T = totals(m), PT = P.totals();
          for (const k of ["walk", "run", "bike", "cal", "secs"] as const) expect(T[k]).toBeCloseTo(PT[k], 6);
          expect(stepStats(state)).toEqual(P.stepStats(() => true));
          for (const dist of [1, 5, 10, 13.1]) {
            expect(predict(state, dist)).toEqual(P.predict(dist));
            expect(bestFor(state, dist)).toEqual(P.bestFor(dist));
          }
          for (let w = 1; w <= 52; w += 5) for (let d = 0; d < 7; d++) expect(loggedFootSteps(state, w, d)).toBe(P.loggedFootSteps(w, d));
          expect(coachTip(m, now.getHours())?.t).toEqual(P.coachTip()?.t);
          expect(encodeBackup(state)).toBe(P.encodeBackup());
        });
      }
    }
  }
});

describe("calendar", () => {
  it("keeps plan dates on local midnight across DST changes", () => {
    // Prototype added 24h steps, which put Nov to Mar dates at 11pm the day before.
    for (let w = 1; w <= 52; w++) for (let d = 0; d < 7; d++) {
      const dt = dateOf(SPEC, w, d);
      expect(dt.getHours()).toBe(0);
      expect((dt.getDay() + 6) % 7).toBe(d);
    }
    expect(dateOf(SPEC, 5, 0).toDateString()).toBe("Mon Nov 02 2026");
    expect(addDays(dateOf(SPEC, 52, 5), 0).toDateString()).toBe("Sat Oct 02 2027");
  });
});
