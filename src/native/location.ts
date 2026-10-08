// Location for workout tracking, behind one small interface so each platform only needs its own
// connector: Android (and later iPhone) use a background GPS watcher that keeps going with the
// screen off; the website uses the browser's GPS while open; "simulate" fakes a walk for testing.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import type { Fix, TrackKind } from "../training/track";

export type LocationError = "denied" | "unavailable";

export interface LocationFeed {
  stop(): Promise<void>;
}

export interface WatchOptions {
  kind: TrackKind;
  onFix: (f: Fix) => void;
  onError: (e: LocationError) => void;
  /** Fake a walk around a block (for testing without going outside). */
  simulate?: boolean;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export const canTrackInBackground = Capacitor.isNativePlatform();

export async function watchLocation(o: WatchOptions): Promise<LocationFeed> {
  if (o.simulate) return simulate(o);
  if (Capacitor.isNativePlatform()) return watchNative(o);
  return watchBrowser(o);
}

/** Opens the app's settings so location can be allowed after a "Don't allow". */
export async function openLocationSettings() {
  if (Capacitor.isNativePlatform()) await BackgroundGeolocation.openSettings();
}

async function watchNative(o: WatchOptions): Promise<LocationFeed> {
  // Android 13+ needs permission to show the "recording" notification that keeps tracking alive.
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if ((await LocalNotifications.checkPermissions()).display !== "granted") await LocalNotifications.requestPermissions();
  } catch { /* tracking still works; the notice just may not show */ }
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: o.kind === "bike" ? "Recording your ride" : o.kind === "run" ? "Recording your walk/run" : "Recording your walk",
      backgroundMessage: "Not a Runner is tracking this workout. Open the app to pause or finish.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    },
    (loc, err) => {
      if (err) { o.onError(err.code === "NOT_AUTHORIZED" ? "denied" : "unavailable"); return; }
      if (loc) o.onFix({ lat: loc.latitude, lon: loc.longitude, t: loc.time ?? Date.now(), acc: loc.accuracy });
    },
  );
  return { stop: () => BackgroundGeolocation.removeWatcher({ id }) };
}

async function watchBrowser(o: WatchOptions): Promise<LocationFeed> {
  if (!("geolocation" in navigator)) { o.onError("unavailable"); return { stop: async () => {} }; }
  const id = navigator.geolocation.watchPosition(
    (p) => o.onFix({ lat: p.coords.latitude, lon: p.coords.longitude, t: p.timestamp, acc: p.coords.accuracy }),
    (e) => o.onError(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
  return { stop: async () => navigator.geolocation.clearWatch(id) };
}

/** A walk (or ride) around a 400 m block in St. George, one fix a second, with a little GPS noise. */
function simulate(o: WatchOptions): LocationFeed {
  const mps = o.kind === "bike" ? 5.5 : o.kind === "run" ? 2.6 : 1.4;
  const lat0 = 37.0965, lon0 = -113.5684, side = 100, mLat = 1 / 111195, mLon = 1 / (111195 * Math.cos(lat0 * Math.PI / 180));
  let traveled = 0;
  const timer = window.setInterval(() => {
    traveled += mps;
    const p = traveled % (side * 4), leg = Math.floor(p / side), off = p % side;
    const [x, y] = [[off, 0], [side, off], [side - off, side], [0, side - off]][leg];
    const n = () => (Math.random() - 0.5) * 3;
    o.onFix({ lat: lat0 + (y + n()) * mLat, lon: lon0 + (x + n()) * mLon, t: Date.now(), acc: 5 });
  }, 1000);
  return { stop: async () => clearInterval(timer) };
}
