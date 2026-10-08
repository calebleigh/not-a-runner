export type Feel = "easy" | "ok" | "hard";
export type SwapKind = "bike" | "walk" | "run";
/** Extra activity types. Planned sessions and swaps only use walk, bike and walk/run. */
export type ExtraKind = "walk" | "bike" | "hike" | "elliptical" | "swim" | "row" | "skate" | "other";
export type CardioKind = "bike" | "walk" | "run" | "long" | "test" | "race" | "rest";
export type AdaptKey = "run" | "bike" | "str";

/** Session ids are "w-d-c" (cardio) or "w-d-s" (strength). Day keys are "w-d", d 0..6 (Mon..Sun). */
export interface Log {
  dist?: number; // miles
  time?: number; // seconds
  feel?: Feel;
  hr?: number;
  at: number;
}

export interface Extra {
  /** Lets each activity sync on its own. Older entries have none (see extraIds in src/sync/engine.ts). */
  id?: string;
  kind: ExtraKind;
  dist: number;
  time: number;
  steps?: number;
  label?: string;
}

export interface Settings {
  name?: string;
  startWt?: number;
  goalWt?: number;
  /** "YYYY-MM-DD" */
  birthday?: string;
  /** Short personal reason for training, shown on Home. */
  /** Older saves: one line. Newer saves use `whys`. */
  why?: string;
  whys?: string[];
  /** Accent gradient, light end and dark end as #RRGGBB. Missing means the default orange. */
  accent?: { hi: string; lo: string };
  /** False turns strength workouts off (not scheduled, not shown). Missing means on. */
  strength?: boolean;
  /** Corner style; also picks the matching logo. Missing means squared. */
  shape?: "round" | "square";
  /** Missing means dark. */
  mode?: "light" | "system";
}

export interface State {
  done: Record<string, 1>;
  logs: Record<string, Log>;
  gear: Record<string, 1>;
  swaps: Record<string, SwapKind>;
  weights: Record<string, number>; // week number -> lb
  settings: Settings;
  extras: Record<string, Extra[]>;
  steps: Record<string, number>;
  /** Onboarding answers the plan is generated from. Missing means the owner's original plan. */
  plan?: import("./spec").PlanState;
}

export interface Cardio {
  t: string; // title
  d: string; // description
  m: number; // minutes
  kind: CardioKind;
  shoes?: boolean;
  orig?: string; // title before a swap
}

export interface Exercise {
  name: string;
  amount: number;
  unit: string;
  seconds: boolean;
}

export interface Strength {
  title: string;
  sets: string;
  ex: Exercise[];
  min: number;
  light?: boolean;
}

export interface Day {
  d: number;
  date: Date;
  c: Cardio;
  st: Strength | null;
  ids: string[];
}

export interface Week {
  n: number;
  s: Date;
  days: Day[];
  load: number;
}

export interface Adapt {
  run: number;
  bike: number;
  str: number;
  msg: Record<AdaptKey, string>;
}

export interface Foot {
  swapped: number;
  planned: number;
}

export interface Model {
  state: State;
  spec: import("./spec").PlanSpec;
  today: Date;
  rawWeek: number;
  curWeek: number;
  dow: number;
  isWeekend: boolean;
  todayIdx: number;
  foot: Foot;
  adapt: Adapt;
  weeks: Week[];
}

export function emptyState(): State {
  return { done: {}, logs: {}, gear: {}, swaps: {}, weights: {}, settings: {}, extras: {}, steps: {} };
}
