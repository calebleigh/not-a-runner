// Adaptive rules: the plan steps up or eases back from how logged sessions went.
import { addDays, dateOf } from "./calendar";
import { cardio, phaseOf } from "./plan";
import { specAt, specOf } from "./spec";
import type { Adapt, AdaptKey, CardioKind, Foot, Log, State } from "./types";

export const TARGET_PACE: (number | null)[] = [null, 16 * 60, 14 * 60 + 30, 13 * 60 + 15]; // sec per mile by phase
export const FOOTK: CardioKind[] = ["walk", "run", "long", "test"];
const LIMITS: Record<AdaptKey, [number, number]> = { run: [-2, 1], bike: [-2, 2], str: [-2, 2] };

export function idParts(id: string) {
  const [w, d, t] = id.split("-");
  return { w: +w, d: +d, t };
}

export function sortedLogs(state: State): [string, Log][] {
  return Object.entries(state.logs).sort((a, b) => {
    const A = idParts(a[0]), B = idParts(b[0]);
    return A.w - B.w || A.d - B.d || (a[0] < b[0] ? -1 : 1);
  });
}

/** The kind a cardio session actually is after any swap. */
export function effKind(state: State, n: number, d: number): { kind: CardioKind; base: CardioKind; swapped: boolean } | null {
  const spec = specAt(state, n);
  if (!(n >= 1 && n <= spec.weeks)) return null;
  const b = cardio(spec, n, d, 0, 0);
  if (!b) return null;
  const sw = state.swaps[`${n}-${d}-c`];
  if (!sw) return { kind: b.kind, base: b.kind, swapped: false };
  return { kind: sw === "bike" ? "bike" : sw === "run" ? "run" : "walk", base: b.kind, swapped: true };
}

/** On-foot sessions in the last two weeks, and how many went to the bike. */
export function computeFoot(state: State, today: Date, curWeek: number): Foot {
  const spec = specOf(state);
  const from = addDays(today, -13), to = dateOf(spec, curWeek, 6);
  let swapped = 0, planned = 0;
  for (let n = Math.max(1, curWeek - 2); n <= curWeek; n++) {
    for (const { d } of specAt(state, n).slots[n - 1] ?? []) {
      const dt = dateOf(spec, n, d);
      if (dt < from || dt > to) continue;
      const e = effKind(state, n, d);
      if (!e || !FOOTK.includes(e.base)) continue;
      planned++;
      if (e.kind === "bike") swapped++;
    }
  }
  return { swapped, planned };
}

/**
 * Score each rated session: easy +1, just right 0, too hard -1, with pace and heart-rate
 * adjustments for on-foot sessions. Three strong in a row steps up 10%; two tough of three eases back.
 */
export function computeAdapt(state: State): Adapt {
  const res: Adapt = {
    run: 0, bike: 0, str: 0,
    msg: { run: "No change yet. Log a few sessions.", bike: "No change yet. Log a few sessions.", str: "No change yet. Rate a few sessions." },
  };
  const win: Record<AdaptKey, number[]> = { run: [], bike: [], str: [] };
  for (const [id, lg] of sortedLogs(state)) {
    const p = idParts(id);
    let kind: AdaptKey | null;
    let paceOK = false;
    if (p.t === "s") kind = "str";
    else {
      const e = effKind(state, p.w, p.d);
      if (!e) continue;
      kind = e.kind === "bike" ? "bike" : FOOTK.includes(e.kind) ? "run" : null;
      paceOK = !e.swapped && e.kind !== "walk";
    }
    if (!kind || !lg.feel) continue;
    let score = lg.feel === "easy" ? 1 : lg.feel === "hard" ? -1 : 0;
    if (kind === "run" && p.t !== "s" && paceOK && (lg.dist ?? 0) >= 1 && lg.time) {
      const pace = lg.time / lg.dist!, tgt = TARGET_PACE[phaseOf(specOf(state), p.w)];
      if (tgt) {
        if (pace <= tgt && lg.feel !== "hard") score += 1;
        else if (pace > tgt * 1.12) score -= 1;
      }
    }
    if (kind === "run" && (lg.hr ?? 0) >= 155) score -= 1;
    win[kind].push(score);
    const w = win[kind].slice(-3);
    if (w.length === 3 && w.every((s) => s >= 1) && res[kind] < LIMITS[kind][1]) {
      res[kind]++;
      res.msg[kind] = `Stepped up after strong sessions in week ${p.w}.`;
      win[kind] = [];
    } else if (w.filter((s) => s <= -1).length >= 2 && res[kind] > LIMITS[kind][0]) {
      res[kind]--;
      res.msg[kind] = `Eased back after tough sessions in week ${p.w}.`;
      win[kind] = [];
    }
  }
  return res;
}

export const pctTxt = (s: number) => (s === 0 ? "On plan" : s > 0 ? `+${s * 10}%` : `${s * 10}%`);
