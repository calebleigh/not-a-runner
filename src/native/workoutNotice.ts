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
}

type Remove = Promise<{ remove(): Promise<void> }>;
interface WorkoutNoticePlugin {
  show(s: NoticeState): Promise<void>;
  hide(): Promise<void>;
  startSteps(): Promise<void>;
  stopSteps(): Promise<void>;
  addListener(e: "action", fn: (d: { action: "pause" | "resume" }) => void): Remove;
  addListener(e: "tick", fn: () => void): Remove;
  addListener(e: "steps", fn: (d: { steps: number }) => void): Remove;
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
/** Once a second while a workout shows, even with the phone locked. */
export function onNoticeTick(fn: () => void) {
  Notice?.addListener("tick", fn).catch(() => {});
}

/** Steps since this call from the phone's step counter, which keeps counting with the screen off. */
export async function watchNativeSteps(onSteps: (n: number) => void): Promise<{ stop(): Promise<void> } | null> {
  if (!Notice) return null;
  const sub = await Notice.addListener("steps", (d) => onSteps(d.steps));
  try { await Notice.startSteps(); } catch { await sub.remove(); return null; }
  return { stop: async () => { await Notice.stopSteps().catch(() => {}); await sub.remove(); } };
}
