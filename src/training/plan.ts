// Builds the plan from the spec. For the owner's profile this is the prototype's 52-week half-marathon plan
// and must match it exactly (see parity.test.ts).
import { clamp, dateOf } from "./calendar";
import { EX, ROUTINES, STRETCH, intervals, long3, long4 } from "./data";
import type { PlanSpec } from "./spec";
import type { Adapt, AdaptKey, Cardio, Day, Exercise, Foot, State, Strength, SwapKind, Week } from "./types";

export interface PlanCtx {
  spec: PlanSpec;
  state: State;
  curWeek: number;
  adapt: Adapt;
  foot: Foot;
}

export const phaseOf = (spec: Pick<PlanSpec, "phases">, n: number) => spec.phases.findIndex((p) => n >= p.from && n <= p.to);
const lerp = (a: number, b: number, k: number, n: number) => Math.round(a + (b - a) * k / n);
const r5 = (m: number) => Math.max(10, Math.round(m / 5) * 5);

export const BIKE_SWAP_FACTOR = 1.5;
export const BIKE_SWAP_CAP = 120;
export const WALK_SWAP_CAP = 75;
export const RUN_SWAP_CAP = 50;

/**
 * Planned cardio for week n, day d. `s` steps running volume (and foundation sessions)
 * in 10% units, `bs` steps biking. Returns undefined for days with no session.
 */
export function cardio(spec: PlanSpec, n: number, d: number, s: number, bs: number): Cardio | undefined {
  const p = phaseOf(spec, n);
  if (p < 0) return undefined;
  const k = n - spec.phases[p].from;
  const sc = (m: number) => Math.max(10, Math.round(m * (1 + 0.1 * s)));
  const easy = "Easy pace: you can talk in full sentences.";
  if (spec.mileTests.includes(n) && d === 0) {
    return { t: "Mile test", d: "Walk 5 min to warm up, then cover 1 mile as fast as you comfortably can. Walking breaks are fine. Log your time.", m: 25, kind: "test" };
  }
  if (p === 0) {
    const b = sc(lerp(20, 30, k, 12)), f = sc(lerp(25, 45, k, 12));
    return ([
      { t: `Bike ${b} min`, d: easy, m: b, kind: "bike" },
      { t: `Walk ${b} min`, d: "Brisk but comfortable.", m: b, kind: "walk" },
      { t: `Bike ${b} min`, d: easy, m: b, kind: "bike" },
      { t: `Walk ${b} min`, d: "Brisk but comfortable. Bring the kids if you can.", m: b, kind: "walk" },
      { t: `Bike ${f} min`, d: "Your longer ride of the week. Keep it easy.", m: f, kind: "bike" },
    ] as Cardio[])[d];
  }
  if (p === 1) {
    const b = Math.max(10, Math.round(lerp(30, 40, k, 12) * (1 + 0.1 * bs)));
    const lr = Math.round(lerp(60, 90, k, 12) * (1 + 0.1 * bs));
    const iv = intervals[clamp(k + 2 * s, 0, 12)];
    return ([
      { t: `Bike ${b} min`, d: easy, m: b, kind: "bike" },
      { t: "Walk/run", d: `Walk 5 min to warm up, then ${iv}.`, m: 28, kind: "run", shoes: true },
      { t: `Bike ${b} min`, d: easy, m: b, kind: "bike" },
      { t: "Walk/run", d: `Walk 5 min to warm up, then ${iv}.`, m: 28, kind: "run", shoes: true },
      { t: `Long ride ${lr} min`, d: "Steady and easy. Bring water.", m: lr, kind: "bike" },
    ] as Cardio[])[d];
  }
  const bk = Math.round(30 * (1 + 0.1 * bs));
  const mi = (L: number) => Math.round(L * (1 + 0.1 * s) * 2) / 2;
  if (p === 2) {
    const sh = sc(lerp(25, 35, k, 12)), L = mi(long3[k]), cut = [4, 8, 12].includes(k);
    return ([
      { t: `Walk/run ${sh} min`, d: "Mostly easy jogging. Walk whenever you need.", m: sh, kind: "run", shoes: true },
      { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
      { t: `Walk/run ${sh} min`, d: "Mostly easy jogging. Walk whenever you need.", m: sh, kind: "run", shoes: true },
      { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
      { t: `Long walk/run ${L} mi`, d: cut ? "Easier week. Let your legs catch up." : "Walk breaks are part of the plan.", m: L * 13, kind: "long", shoes: true },
    ] as Cardio[])[d];
  }
  if (n === spec.weeks) {
    return ([
      { t: "Walk/run 20 min", d: "Easy, just loosen up.", m: 20, kind: "run", shoes: true },
      { t: "Bike 20 min", d: "Very easy spin.", m: 20, kind: "bike" },
      { t: "Walk/run 15 min", d: "Very easy.", m: 15, kind: "run", shoes: true },
      { t: "Rest", d: "Walk around, hydrate, sleep well.", m: 0, kind: "rest" },
      { t: "Rest", d: "Lay out your gear. Check bus loading time on the race site.", m: 0, kind: "rest" },
      { t: "Race day: 13.1 miles", d: "Start slower than you think. Walk the aid stations. Enjoy the finish.", m: 180, kind: "race", shoes: true },
    ] as Cardio[])[d];
  }
  const taper = n >= spec.weeks - 2, ts = taper ? Math.min(0, s) : s;
  const L = Math.round(long4[k] * (1 + 0.1 * ts) * 2) / 2;
  const sh = taper ? 25 : Math.round(lerp(30, 40, k, 9) * (1 + 0.1 * ts) / 5) * 5;
  return ([
    { t: `Walk/run ${sh} min`, d: "Easy pace.", m: sh, kind: "run", shoes: true },
    { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
    { t: `Walk/run ${sh} min`, d: n >= spec.phases[3].from + 2 && !taper ? "Find a hill and include a few minutes of easy downhill running." : "Easy pace.", m: sh, kind: "run", shoes: true },
    { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
    { t: `Long walk/run ${L} mi`, d: taper ? "Cutting back so you start the race fresh." : [3, 7].includes(k) ? "Easier week." : "Practice race pace, water and snacks.", m: L * 13, kind: "long", shoes: true },
  ] as Cardio[])[d];
}

/** Running is held or eased back when too many on-foot sessions went to the bike. */
export function footHold(spec: PlanSpec, foot: Foot, curWeek: number): number | null {
  if (phaseOf(spec, curWeek) === 0) return 0;
  return foot.swapped >= 4 ? -1 : foot.swapped >= 3 ? 0 : null;
}

/** Adaptation applies to current and future weeks only. */
export function adaptFor(ctx: PlanCtx, n: number, kind: AdaptKey): number {
  if (n < ctx.curWeek) return 0;
  let v = ctx.adapt[kind];
  if (kind === "run") {
    const h = footHold(ctx.spec, ctx.foot, ctx.curWeek);
    if (h !== null) v = Math.max(-2, Math.min(v, 0) + h);
  }
  return v;
}

export function convert(c: Cardio, to: SwapKind): Cardio {
  const orig = c.t, mins = c.m;
  if (to === "bike") {
    const m = c.kind === "bike" ? mins : r5(Math.min(BIKE_SWAP_CAP, mins * BIKE_SWAP_FACTOR));
    return { t: `Bike ${m} min`, d: `Swapped from ${orig}. Easy pace. It's a bit longer because biking is gentler than being on your feet.`, m, kind: "bike", orig };
  }
  if (to === "walk") {
    const m = r5(Math.min(WALK_SWAP_CAP, mins));
    return { t: `Walk ${m} min`, d: `Swapped from ${orig}. Brisk but comfortable.`, m, kind: "walk", orig };
  }
  const m = r5(Math.min(RUN_SWAP_CAP, mins));
  return { t: `Walk/run ${m} min`, d: `Swapped from ${orig}. Easy jogging with walk breaks whenever you need.`, m, kind: "run", shoes: true, orig };
}

export function cardioFor(ctx: PlanCtx, n: number, d: number): Cardio {
  const bs = adaptFor(ctx, n, "bike");
  let c = cardio(ctx.spec, n, d, adaptFor(ctx, n, "run"), bs)!;
  if (c.kind === "bike" && phaseOf(ctx.spec, n) === 0) c = cardio(ctx.spec, n, d, bs, bs)!;
  const sw = ctx.state.swaps[`${n}-${d}-c`];
  return sw ? convert(c, sw) : c;
}

/** Gear-based exercise upgrades. */
function swapFor(gear: State["gear"], key: string, lvl: number, wedHips?: boolean): Exercise | null {
  const ex = (name: string, amount: number, unit: string): Exercise => ({ name, amount, unit, seconds: false });
  if (key === "squat" && gear.kettlebell && lvl >= 1) return ex("Goblet squat", [10, 10, 12, 12][lvl], "");
  if (key === "row" && gear.kettlebell) return ex("Kettlebell row", [10, 10, 12, 12][lvl], " each arm");
  if (key === "row" && gear.bands) return ex("Band row", [12, 15, 15, 20][lvl], "");
  if (key === "yraise" && gear.bands) return ex("Band pull-apart", [12, 15, 15, 20][lvl], "");
  if (key === "bridge" && wedHips && gear.kettlebell && lvl >= 1) return ex("Kettlebell deadlift", [10, 10, 12, 12][lvl], "");
  if (key === "bridge" && gear.bands && lvl < 2) return ex("Banded glute bridge", [12, 15][lvl], "");
  return null;
}

export function strength(ctx: PlanCtx, n: number, d: number): Strength {
  const p = phaseOf(ctx.spec, n), wip = n - ctx.spec.phases[p].from, bump = wip >= 6 && p < 3, s = adaptFor(ctx, n, "str");
  const stretch = (): Exercise[] =>
    ctx.state.gear.roller ? [{ name: "Foam roll calves and quads", amount: 60, unit: " each", seconds: true }, ...STRETCH] : STRETCH;
  if (n === ctx.spec.weeks) {
    return { title: d >= 3 ? "Rest" : "Easy stretch", sets: d >= 3 ? "Stretch only, legs fresh for the race" : "One pass, nothing hard this week", ex: stretch(), min: 6, light: true };
  }
  if (d === 4 && p >= 2) return { title: "Stretch", sets: "One pass after your long session", ex: stretch(), min: 7, light: true };
  const r = d === 3 && p >= 2 ? { name: "Core", keys: ["deadbug", "birddog", "side", "plank"] } : ROUTINES[d];
  let lvl = p;
  if (s <= -2) lvl = Math.max(0, p - 1);
  const sets = [2, 3, 3, 2][p];
  const ex = r.keys.map((k): Exercise => {
    const v = swapFor(ctx.state.gear, k, lvl, "wed" in r ? r.wed : false) || EX[k][lvl];
    let amt = v.amount;
    if (bump) amt += v.seconds ? 10 : 2;
    if (s) amt = Math.max(v.seconds ? 10 : 4, amt + s * (v.seconds ? 10 : 2));
    return { ...v, amount: amt };
  });
  const circuit = "circuit" in r && r.circuit;
  return { title: r.name, sets: circuit ? `${sets} rounds: do each move once, then repeat` : `${sets} sets of each`, ex, min: Math.round(sets * 4 * 1.4) + 2 };
}

export function buildWeeks(ctx: PlanCtx): Week[] {
  const W: Week[] = [];
  const { spec } = ctx;
  for (let n = 1; n <= spec.weeks; n++) {
    const nd = n === spec.weeks ? spec.raceDay + 1 : 5, days: Day[] = [];
    for (let d = 0; d < nd; d++) {
      const c = cardioFor(ctx, n, d), st = d < 5 ? strength(ctx, n, d) : null;
      days.push({ d, date: dateOf(spec, n, d), c, st, ids: st ? [`${n}-${d}-c`, `${n}-${d}-s`] : [`${n}-${d}-c`] });
    }
    W.push({ n, s: dateOf(spec, n, 0), days, load: days.reduce((a, x) => a + x.c.m + (x.st ? x.st.min : 0), 0) });
  }
  return W;
}
