// Builds the plan from the spec. For the owner's profile this is the prototype's 52-week half-marathon plan
// and must match it exactly (see parity.test.ts).
import { clamp, dateOf } from "./calendar";
import { EX, ROUTINES, STRETCH, intervals, long3, long4, phases as TEMPLATE } from "./data";
import { canonPhase, type PlanSpec, type Slot } from "./spec";
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

export const slotOf = (spec: PlanSpec, n: number, d: number): Slot | undefined => spec.slots[n - 1]?.find((x) => x.d === d);

/**
 * Planned cardio for plan week n, weekday d. `s` steps running volume (and foundation sessions)
 * in 10% units, `bs` steps biking. Returns undefined for days with no session.
 * The session comes from the template week and role the spec maps it to, then gets scaled for
 * the goal and turned into a walk when there's no bike.
 */
export function cardio(spec: PlanSpec, n: number, d: number, s: number, bs: number): Cardio | undefined {
  const slot = slotOf(spec, n, d);
  if (!slot) return undefined;
  const first = spec.slots[n - 1][0].d === d;
  const c = templateCardio(spec, spec.canon[n - 1], slot.role, spec.mileTests.includes(n) && first, s, bs, runScales(spec)[n - 1]);
  return c && !spec.profile.hasBike && c.kind === "bike" ? noBike(c) : c;
}

/** Without a bike, bike sessions become brisk walks of the same length. */
function noBike(c: Cardio): Cardio {
  return { ...c, t: c.t.replace(/^Long ride/, "Long walk").replace(/^Bike/, "Walk"), d: "Brisk but comfortable. Any low-impact cardio works too.", kind: "walk" };
}

const RUN_KINDS = ["run", "long", "test"];
const scaleCache = new WeakMap<PlanSpec, number[]>();

/**
 * Volume governor for generated plans: a factor per week (1 or less) that trims runs and long runs so
 * weekly running time never grows more than spec.volumeCap over the best week so far. Worked out on
 * the plan as written (before adaptation and swaps), so it is the same every time.
 */
export function runScales(spec: PlanSpec): number[] {
  let out = scaleCache.get(spec);
  if (out) return out;
  out = spec.canon.map(() => 1);
  if (spec.volumeCap) {
    // Measure each week exactly as it will be scheduled, mile test included.
    const volAt = (i: number, rs: number) => spec.slots[i].reduce((a, sl, j) => {
      const c = templateCardio(spec, spec.canon[i], sl.role, j === 0 && spec.mileTests.includes(i + 1), 0, 0, rs);
      return a + (c && RUN_KINDS.includes(c.kind) ? c.m : 0);
    }, 0);
    let best = 0;
    spec.canon.forEach((cw, i) => {
      // Taper weeks stay well under the peak the plan actually reached; other weeks grow at most volumeCap.
      const cap = cw === 50 ? best * 0.85 : cw === 51 ? best * 0.65 : best * spec.volumeCap!;
      let rs = 1, vol = volAt(i, 1);
      if (best > 0 && cw < 52 && vol > cap) {
        rs = cap / vol;
        // Sessions round to 5 minutes and half miles; trim a little more until the rounded week fits.
        while (rs > 0.3 && volAt(i, rs) > cap) rs -= 0.02;
        vol = volAt(i, rs);
      }
      out![i] = rs;
      if (cw < 50) best = Math.max(best, vol);
    });
  }
  scaleCache.set(spec, out);
  return out;
}

/**
 * The template's session for template week cw and role r (0 to 4, 5 = extra easy, -1 = race).
 * `rs` (run scale, at most 1) trims runs and long runs for the volume governor.
 */
function templateCardio(spec: PlanSpec, cw: number, r: number, test: boolean, s: number, bs: number, rs: number): Cardio | undefined {
  const p = canonPhase(cw);
  if (p < 0) return undefined;
  const k = cw - TEMPLATE[p].from;
  const ss = spec.shortScale, ls = spec.longScale;
  const sc = (m: number) => Math.max(10, Math.round(m * (1 + 0.1 * s)));
  const easy = "Easy pace: you can talk in full sentences.";
  if (r === -1) {
    const mi = spec.raceMiles;
    return { t: `Race day: ${mi} miles`, d: "Start slower than you think. Walk the aid stations. Enjoy the finish.", m: Math.round(mi * 180 / 13.1), kind: "race", shoes: true };
  }
  if (r === 5) {
    const m = p === 0 ? 20 : 30;
    return { t: `Walk ${m} min`, d: "Optional easy walk. Skip it if your legs are tired.", m, kind: "walk" };
  }
  const d = r;
  if (test) {
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
    const wr = Math.round(28 * ss);
    const lr = Math.round(lerp(60, 90, k, 12) * (1 + 0.1 * bs));
    const iv = intervals[clamp(k + 2 * s, 0, 12)];
    return ([
      { t: `Bike ${b} min`, d: easy, m: b, kind: "bike" },
      { t: "Walk/run", d: `Walk 5 min to warm up, then ${iv}.`, m: wr, kind: "run", shoes: true },
      { t: `Bike ${b} min`, d: easy, m: b, kind: "bike" },
      { t: "Walk/run", d: `Walk 5 min to warm up, then ${iv}.`, m: wr, kind: "run", shoes: true },
      { t: `Long ride ${lr} min`, d: "Steady and easy. Bring water.", m: lr, kind: "bike" },
    ] as Cardio[])[d];
  }
  const bk = Math.round(30 * (1 + 0.1 * bs));
  const mi = (L: number) => Math.max(1, Math.round(L * ls * (1 + 0.1 * s) * 2) / 2);
  if (p === 2) {
    const sh = sc(Math.round(lerp(25, 35, k, 12) * ss * rs)), L = mi(long3[k] * rs), cut = [4, 8, 12].includes(k);
    return ([
      { t: `Walk/run ${sh} min`, d: "Mostly easy jogging. Walk whenever you need.", m: sh, kind: "run", shoes: true },
      { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
      { t: `Walk/run ${sh} min`, d: "Mostly easy jogging. Walk whenever you need.", m: sh, kind: "run", shoes: true },
      { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
      { t: `Long walk/run ${L} mi`, d: cut ? "Easier week. Let your legs catch up." : "Walk breaks are part of the plan.", m: L * 13, kind: "long", shoes: true },
    ] as Cardio[])[d];
  }
  if (cw === 52) {
    return ([
      { t: "Walk/run 20 min", d: "Easy, just loosen up.", m: 20, kind: "run", shoes: true },
      { t: "Bike 20 min", d: "Very easy spin.", m: 20, kind: "bike" },
      { t: "Walk/run 15 min", d: "Very easy.", m: 15, kind: "run", shoes: true },
      { t: "Rest", d: "Walk around, hydrate, sleep well.", m: 0, kind: "rest" },
      { t: "Rest", d: "Lay out your gear. Check bus loading time on the race site.", m: 0, kind: "rest" },
    ] as Cardio[])[d];
  }
  const taper = cw >= 50, ts = taper ? Math.min(0, s) : s;
  const L = Math.max(1, Math.round(long4[k] * ls * rs * (1 + 0.1 * ts) * 2) / 2);
  const sh = taper ? Math.max(10, Math.round(25 * ss * rs / 5) * 5) : Math.max(10, Math.round(lerp(30, 40, k, 9) * ss * rs * (1 + 0.1 * ts) / 5) * 5);
  return ([
    { t: `Walk/run ${sh} min`, d: "Easy pace.", m: sh, kind: "run", shoes: true },
    { t: `Bike ${bk} min`, d: "Easy recovery ride.", m: bk, kind: "bike" },
    { t: `Walk/run ${sh} min`, d: cw >= 42 && !taper ? "Find a hill and include a few minutes of easy downhill running." : "Easy pace.", m: sh, kind: "run", shoes: true },
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

/** Strength for plan week n on a session with template role d (0 to 4). */
export function strength(ctx: PlanCtx, n: number, d: number): Strength {
  const cw = ctx.spec.canon[n - 1];
  const p = canonPhase(cw), wip = cw - TEMPLATE[p].from, bump = wip >= 6 && p < 3, s = adaptFor(ctx, n, "str");
  const stretch = (): Exercise[] =>
    ctx.state.gear.roller ? [{ name: "Foam roll calves and quads", amount: 60, unit: " each", seconds: true }, ...STRETCH] : STRETCH;
  if (cw === 52) {
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
  const strengthOn = ctx.state.settings.strength !== false;
  for (let n = 1; n <= spec.weeks; n++) {
    const days: Day[] = [];
    for (const { d, role } of spec.slots[n - 1]) {
      // Strength rides along with the template's five weekday roles, not the race or an extra easy day.
      const c = cardioFor(ctx, n, d), st = role >= 0 && role <= 4 && strengthOn ? strength(ctx, n, role) : null;
      days.push({ d, date: dateOf(spec, n, d), c, st, ids: st ? [`${n}-${d}-c`, `${n}-${d}-s`] : [`${n}-${d}-c`] });
    }
    W.push({ n, s: dateOf(spec, n, 0), days, load: days.reduce((a, x) => a + x.c.m + (x.st ? x.st.min : 0), 0) });
  }
  return W;
}
