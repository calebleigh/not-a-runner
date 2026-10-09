// The phone's health store behind one small interface: Health Connect on Android now, Apple Health
// on iPhone later (the same plugin covers both). Reads only; the app never writes health data.
// Browsers have no health store, so the website has none.
import { Capacitor } from "@capacitor/core";
import { addDays, healthKindOf, startOfDay, type HealthData, type HealthWorkout } from "../training";

export const healthName = Capacitor.getPlatform() === "ios" ? "Apple Health" : "Health Connect";

const READ = ["steps", "workouts", "weight", "heartRate", "distance"] as const;
const KG_TO_LB = 2.20462;
const M_PER_MI = 1609.344;

// Returns the module, not the plugin: a Capacitor plugin looks like a promise (it answers to
// `.then`), so returning it from an async function would wait forever.
const mod = () => import("@capgo/capacitor-health");

export interface HealthAvailability {
  available: boolean;
  /** Why not, in plain words (e.g. Health Connect isn't installed). */
  reason?: string;
}

export async function healthAvailable(): Promise<HealthAvailability> {
  if (!Capacitor.isNativePlatform()) return { available: false };
  try {
    const r = await (await mod()).Health.isAvailable();
    return r.available ? { available: true } : { available: false, reason: r.reason };
  } catch (e) {
    return { available: false, reason: String(e) };
  }
}

/** Shows the permission screen. True when at least steps or workouts can be read. */
export async function connectHealth(): Promise<boolean> {
  const h = (await mod()).Health;
  const r = await h.requestAuthorization({ read: [...READ] });
  return r.readAuthorized.includes("steps") || r.readAuthorized.includes("workouts");
}

/** Whether reading is still allowed (it can be turned off in the phone's settings). */
export async function healthAllowed(): Promise<boolean> {
  try {
    const r = await (await mod()).Health.checkAuthorization({ read: [...READ] });
    return r.readAuthorized.includes("steps") || r.readAuthorized.includes("workouts");
  } catch {
    return false;
  }
}

export async function openHealthSettings() {
  try { await (await mod()).Health.openHealthConnectSettings(); } catch { /* not on this phone */ }
}

const iso = (d: Date) => d.toISOString();
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

/** Steps per day, workouts and weigh-ins from `days` days ago through now. Parts you didn't allow come back empty. */
export async function readHealth(days: number, now = new Date()): Promise<HealthData> {
  const h = (await mod()).Health;
  const today = startOfDay(now);
  const from = addDays(today, -days + 1);

  // Steps: one total per local day (asked day by day so daylight saving can't shift a date).
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const steps = (await Promise.all(dates.map(async (date) => {
    try {
      const r = await h.queryAggregated({ dataType: "steps", startDate: iso(date), endDate: iso(addDays(date, 1)), bucket: "day", aggregation: "sum" });
      return { date, steps: r.samples.reduce((a, s) => a + (s.value || 0), 0) };
    } catch {
      return { date, steps: 0 };
    }
  }))).filter((s) => s.steps > 0);

  const workouts: HealthWorkout[] = [];
  try {
    let anchor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const r = await h.queryWorkouts({ startDate: iso(from), endDate: iso(now), limit: 100, ascending: true, anchor });
      for (const w of r.workouts) {
        const kind = healthKindOf(w.workoutType);
        if (!kind) continue;
        const start = Date.parse(w.startDate), end = Date.parse(w.endDate);
        workouts.push({
          id: w.platformId || `${w.startDate}|${w.workoutType}`,
          kind, start, end, time: w.duration || (end - start) / 1000,
          ...(w.totalDistance ? { miles: w.totalDistance / M_PER_MI } : {}),
          ...(w.sourceName ? { source: w.sourceName } : {}),
        });
      }
      if (!r.anchor) break;
      anchor = r.anchor;
    }
  } catch { /* workouts not allowed */ }

  // Average heart rate during each workout, when a band recorded it.
  await Promise.all(workouts.map(async (w) => {
    try {
      const r = await h.readSamples({ dataType: "heartRate", startDate: new Date(w.start).toISOString(), endDate: new Date(w.end).toISOString(), limit: 2000 });
      const hr = avg(r.samples.map((s) => s.value).filter((v) => v > 30 && v < 230));
      if (hr) w.hr = hr;
    } catch { /* heart rate not allowed */ }
  }));

  let weights: HealthData["weights"] = [];
  try {
    const r = await h.readSamples({ dataType: "weight", startDate: iso(from), endDate: iso(now), limit: 200 });
    weights = r.samples.map((s) => ({ at: Date.parse(s.startDate), lb: s.unit === "kilogram" ? s.value * KG_TO_LB : s.value }));
  } catch { /* weight not allowed */ }

  return { steps, workouts, weights };
}
