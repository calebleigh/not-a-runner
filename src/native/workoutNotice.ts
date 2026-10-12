// The workout on the lock screen and in the notification shade, shown like a music player with a
// Pause / Resume button (Android: android/.../WorkoutNoticePlugin.java). While it shows, the app
// keeps going in a pocket: a native tick every second and the phone's step counter. Elsewhere these
// do nothing.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { TrackKind } from "../training/track";

export interface NoticeState {
  kind: TrackKind;
  title: string;
  status: string;
  /** Clock so far; the notification keeps counting on its own while not paused. */
  elapsedMs: number;
  paused: boolean;
  line1: string;
  line2: string;
  /** The theme's accent and the text color on it, so the card matches the app. */
  accent?: string;
  onAccent?: string;
  /** Steps so far; the card keeps counting on from here by itself (left out on a bike). */
  steps?: number;
  /** Auto-pause on steps, done by the phone so it works with the screen off (0: the app decides). */
  autoPauseSecs?: number;
  autoPaused?: boolean;
  /** The last of the phone's auto-pause decisions the app has applied. */
  autoSeq?: number;
  /** Distance so far and meters a step, so the phone can keep the distance going between check-ins. */
  distM?: number;
  stride?: number;
  /** Spoken updates, spoken by the phone (0 is off): every so many miles, minutes, steps. */
  cueMiles?: number;
  cueMins?: number;
  cueSteps?: number;
}

/** An auto-pause or resume the phone decided, and when. */
export interface AutoEvent { state: "pause" | "resume"; at: number; seq: number; pausedMs?: number; steps?: number; erase?: boolean }

type Remove = Promise<{ remove(): Promise<void> }>;
interface WorkoutNoticePlugin {
  show(s: NoticeState): Promise<void>;
  hide(): Promise<void>;
  startSteps(): Promise<void>;
  stopSteps(): Promise<void>;
  addListener(e: "action", fn: (d: { action: "pause" | "resume" }) => void): Remove;
  addListener(e: "tick", fn: () => void): Remove;
  addListener(e: "steps", fn: (d: { steps: number }) => void): Remove;
  addListener(e: "auto", fn: (d: AutoEvent) => void): Remove;
}

const on = Capacitor.getPlatform() === "android";
const Notice = on ? registerPlugin<WorkoutNoticePlugin>("WorkoutNotice") : null;

/** The app keeps ticking and counting steps with the screen off (Android). */
export const liveInBackground = on;

export const showNotice = (s: NoticeState) => { Notice?.show(s).catch(() => {}); };
export const hideNotice = () => { Notice?.hide().catch(() => {}); };
export function onNoticeAction(fn: (action: "pause" | "resume") => void) {
  Notice?.addListener("action", (d) => fn(d.action)).catch(() => {});
}
/** The phone auto-paused or resumed (it keeps deciding while the app sleeps with the screen off). */
export function onNoticeAuto(fn: (d: AutoEvent) => void) {
  Notice?.addListener("auto", fn).catch(() => {});
}
/** Once a second while a workout shows, even with the phone locked. */
export function onNoticeTick(fn: () => void) {
  Notice?.addListener("tick", fn).catch(() => {});
}

/** Steps since this call from the phone's step counter, which keeps counting with the screen off. */
export async function watchNativeSteps(onSteps: (n: number) => void): Promise<{ stop(): Promise<void>; native: true } | null> {
  if (!Notice) return null;
  const sub = await Notice.addListener("steps", (d) => onSteps(d.steps));
  try { await Notice.startSteps(); } catch { await sub.remove(); return null; }
  return { native: true, stop: async () => { await Notice.stopSteps().catch(() => {}); await sub.remove(); } };
}
