// All-day steps counted by the phone itself (Android's step counter, read in the background by the
// app's own code), so steps work with no other app. iPhone will read Apple Health's count through
// the same three calls. Browsers can't count steps, so the website has none.
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

interface PhoneStepsPlugin {
  available(): Promise<{ available: boolean; allowed: boolean }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  read(o: { days: number }): Promise<{ days: { date: string; steps: number }[] }>;
  watch(): Promise<void>;
  unwatch(): Promise<void>;
  addListener(e: "today", f: (x: { date: string; steps: number }) => void): Promise<PluginListenerHandle>;
}

const ymdDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export const canCountPhoneSteps = Capacitor.getPlatform() === "android";
const Plugin = canCountPhoneSteps ? registerPlugin<PhoneStepsPlugin>("PhoneSteps") : null;

/** Whether this phone has a step counter. */
export async function phoneStepsAvailable(): Promise<boolean> {
  try { return !!Plugin && (await Plugin.available()).available; } catch { return false; }
}

/** Asks for the activity permission, then starts counting. False when it wasn't allowed. */
export async function startPhoneSteps(): Promise<boolean> {
  if (!Plugin) return false;
  try {
    const { CapacitorPedometer } = await import("@capgo/capacitor-pedometer");
    let perm = await CapacitorPedometer.checkPermissions();
    if (perm.activityRecognition !== "granted") perm = await CapacitorPedometer.requestPermissions();
    if (perm.activityRecognition !== "granted") return false;
    await Plugin.start();
    return true;
  } catch {
    return false;
  }
}

export async function stopPhoneSteps() {
  try { await Plugin?.stop(); } catch { /* nothing to stop */ }
}

/** Whether counting is still allowed (the permission can be taken away in the phone's settings). */
export async function phoneStepsAllowed(): Promise<boolean> {
  try { return !!Plugin && (await Plugin.available()).allowed; } catch { return false; }
}

/** Steps per local day for the last `days` days, today included. */
export async function readPhoneSteps(days: number): Promise<{ date: Date; steps: number }[]> {
  if (!Plugin) return [];
  const r = await Plugin.read({ days });
  return r.days.map((x) => ({ date: ymdDate(x.date), steps: x.steps }));
}

/** Calls back with today's count as you walk (while the app is open). Returns a stop function. */
export async function watchPhoneSteps(onToday: (date: Date, steps: number) => void): Promise<() => void> {
  if (!Plugin) return () => {};
  const sub = await Plugin.addListener("today", (x) => onToday(ymdDate(x.date), x.steps));
  await Plugin.watch();
  return () => { sub.remove(); Plugin.unwatch().catch(() => {}); };
}
