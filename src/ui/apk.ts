// The Android app (APK) updates itself from GitHub releases: each release is one build, tagged
// "build-<versionCode>", with the APK attached. The website keeps using its service worker instead.
import { Capacitor } from "@capacitor/core";

export const IS_NATIVE = Capacitor.isNativePlatform();
/** This build's versionCode (set by CI for both the web build and the APK). 0 for local builds. */
export const APP_CODE = Number(__APP_CODE__) || 0;
export const APP_VERSION = __APP_VERSION__;

const REPO = "calebleigh/not-a-runner";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export interface ApkRelease { code: number; version: string; url: string }

/** The newest release, or null if there isn't one (or GitHub can't be reached). */
export async function latestRelease(): Promise<ApkRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!res.ok) return null;
  const r = await res.json() as { tag_name?: string; name?: string; assets?: { name: string; browser_download_url: string }[] };
  const code = Number(/^build-(\d+)$/.exec(r.tag_name ?? "")?.[1]);
  const apk = r.assets?.find((a) => a.name.endsWith(".apk"));
  return code && apk ? { code, version: r.name ?? r.tag_name!, url: apk.browser_download_url } : null;
}

/** Opens a URL outside the app (the browser downloads the APK, then Android offers to install it). */
export async function openOutside(url: string) {
  const { AppLauncher } = await import("@capacitor/app-launcher");
  await AppLauncher.openUrl({ url });
}

/**
 * Downloads an APK into the app's cache and hands it to Android's installer, which asks before
 * installing. The first time, Android also asks to allow installs from this app.
 */
export async function installApk(url: string, onProgress?: (pct: number) => void): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { FileOpener } = await import("@capacitor-community/file-opener");
  const sub = onProgress
    ? await Filesystem.addListener("progress", (p) => onProgress(p.contentLength ? Math.round((100 * p.bytes) / p.contentLength) : 0))
    : null;
  try {
    const r = await Filesystem.downloadFile({ url, path: "update.apk", directory: Directory.Cache, progress: !!onProgress });
    if (!r.path) throw new Error("Download failed");
    await FileOpener.open({ filePath: r.path, contentType: "application/vnd.android.package-archive" });
  } finally {
    await sub?.remove();
  }
}
