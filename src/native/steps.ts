// Step counting during a workout, behind one small interface like location: the phone's step
// counter in the app (Android now, iPhone later); browsers can't read it, so the website has none.
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

export interface StepFeed { stop(): Promise<void> }

export const canCountSteps = Capacitor.isNativePlatform();

/**
 * Calls back with steps counted since this call (not since the phone booted). Returns null when
 * steps can't be counted (website, no sensor, or permission refused).
 */
export async function watchSteps(onSteps: (n: number) => void): Promise<StepFeed | null> {
  if (!canCountSteps) return null;
  try {
    const { CapacitorPedometer } = await import("@capgo/capacitor-pedometer");
    if (!(await CapacitorPedometer.isAvailable()).stepCounting) return null;
    let perm = await CapacitorPedometer.checkPermissions();
    if (perm.activityRecognition !== "granted") perm = await CapacitorPedometer.requestPermissions();
    if (perm.activityRecognition !== "granted") return null;
    const sub: PluginListenerHandle = await CapacitorPedometer.addListener("measurement", (m) => onSteps(m.numberOfSteps ?? 0));
    await CapacitorPedometer.startMeasurementUpdates();
    return {
      stop: async () => {
        await CapacitorPedometer.stopMeasurementUpdates().catch(() => {});
        await sub.remove();
      },
    };
  } catch {
    return null;
  }
}
