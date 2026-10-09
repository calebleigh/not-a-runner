// The workout on the lock screen and in the notification shade, with a Pause / Resume button
// (Android: android/.../WorkoutNoticePlugin.java). Elsewhere these do nothing.
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NoticeState {
  title: string;
  status: string;
  /** Clock so far; the notification keeps counting on its own while not paused. */
  elapsedMs: number;
  paused: boolean;
  line1: string;
  line2: string;
}

interface WorkoutNoticePlugin {
  show(s: NoticeState): Promise<void>;
  hide(): Promise<void>;
  addListener(e: "action", fn: (d: { action: "pause" | "resume" }) => void): Promise<{ remove(): Promise<void> }>;
}

const on = Capacitor.getPlatform() === "android";
const Notice = on ? registerPlugin<WorkoutNoticePlugin>("WorkoutNotice") : null;

export const showNotice = (s: NoticeState) => { Notice?.show(s).catch(() => {}); };
export const hideNotice = () => { Notice?.hide().catch(() => {}); };
export function onNoticeAction(fn: (action: "pause" | "resume") => void) {
  Notice?.addListener("action", (d) => fn(d.action)).catch(() => {});
}
