import { playSplashNextLoad } from "./Splash";
// Shared app-update state: the service worker registration, whether a new version is waiting,
// and a manual check used by Settings. The update bar (UpdatePrompt) keeps this in sync.
import { useSyncExternalStore } from "react";
import { APP_CODE, IS_NATIVE, installApk, latestRelease, openOutside } from "./apk";

export type CheckResult = "ready" | "current" | "offline" | "error" | "unsupported";

let registration: ServiceWorkerRegistration | undefined;
let ready = false;
let apply: (() => void) | undefined;
const listeners = new Set<() => void>();

export function setRegistration(r: ServiceWorkerRegistration | undefined) { registration = r; }

export function setUpdateReady(isReady: boolean, applyFn: () => void) {
  apply = applyFn;
  if (ready !== isReady) { ready = isReady; listeners.forEach((l) => l()); }
}

export const useUpdateReady = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => ready);

/**
 * Switches to the new version and reloads. Tells a waiting version to take over, reloads as soon as it
 * does, and reloads anyway after a moment so the button never does nothing.
 */
export function applyUpdate(fallbackMs = 1500) {
  if (IS_NATIVE) { apply?.(); return; }
  let done = false;
  const reload = () => { if (!done) { done = true; playSplashNextLoad(); window.location.reload(); } };
  navigator.serviceWorker?.addEventListener("controllerchange", reload, { once: true });
  const waiting = registration?.waiting;
  if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
  else apply?.();
  window.setTimeout(reload, waiting ? fallbackMs : 300);
}

/** Quiet background check (when the app comes back, and hourly). */
export function checkQuietly() { if (navigator.onLine) registration?.update().catch(() => {}); }

/** Asks the server for a new version and waits for it to finish downloading. */
export async function checkForUpdate(timeoutMs = 20000): Promise<CheckResult> {
  if (ready) return "ready";
  if (!navigator.onLine) return "offline";
  if (IS_NATIVE) return checkApk();
  const r = registration;
  if (!r) return "unsupported";
  try {
    await r.update();
    const sw = r.installing;
    if (sw) {
      await new Promise<void>((resolve) => {
        const done = () => { if (sw.state !== "installing") { sw.removeEventListener("statechange", done); resolve(); } };
        sw.addEventListener("statechange", done);
        setTimeout(resolve, timeoutMs);
      });
    }
    return r.waiting ? "ready" : "current";
  } catch {
    return navigator.onLine ? "error" : "offline";
  }
}

/** When this build was made, for the version row. */
export const BUILT_AT = new Date(__BUILD_TIME__);

let lastApkCheck = 0;
/** Android app: is there a newer APK on GitHub? Marks the update ready (tap downloads it). */
export async function checkApk(force = true): Promise<CheckResult> {
  if (!force && Date.now() - lastApkCheck < 30 * 60 * 1000) return ready ? "ready" : "current";
  lastApkCheck = Date.now();
  try {
    const r = await latestRelease();
    if (r && r.code > APP_CODE) { setUpdateReady(true, () => { downloadAndInstall(r.url); }); return "ready"; }
    return r ? "current" : "error";
  } catch {
    return navigator.onLine ? "error" : "offline";
  }
}

// Android app: download progress for the update bar (null when not downloading).
let downloadPct: number | null = null;
const dlSubs = new Set<() => void>();
const setDownload = (v: number | null) => { downloadPct = v; dlSubs.forEach((f) => f()); };
export const useDownloadPct = () => useSyncExternalStore((f) => { dlSubs.add(f); return () => dlSubs.delete(f); }, () => downloadPct);

/** Downloads the new APK in the app and opens Android's installer; falls back to the browser. */
async function downloadAndInstall(url: string) {
  if (downloadPct !== null) return;
  setDownload(0);
  try {
    await installApk(url, (p) => setDownload(p));
  } catch {
    openOutside(url).catch(() => {});
  } finally {
    setDownload(null);
  }
}
