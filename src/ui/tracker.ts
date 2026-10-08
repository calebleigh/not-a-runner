// The workout being tracked right now. Lives outside React so it keeps recording across tabs, and
// is saved to the device every few seconds so a closed or reloaded app picks up where it left off.
import { useSyncExternalStore } from "react";
import { watchLocation, type LocationError, type LocationFeed } from "../native/location";
import { addFix, newTrack, pause, resume, type Track, type TrackKind } from "../training/track";

/** Where a finished workout gets saved: a planned session, or an extra activity for today. */
export interface TrackTarget { w: number; d: number; title: string }

export type TrackStatus = "ready" | "recording" | "paused" | "done";

export interface ActiveTrack {
  status: TrackStatus;
  kind: TrackKind;
  target: TrackTarget | null;
  track: Track | null;
  simulate: boolean;
  /** GPS problem to show, if any. */
  error: LocationError | null;
  /** When the last fix arrived (for "waiting for GPS"). */
  lastFixAt: number | null;
  /** When Finish was tapped; the summary's numbers stop here. */
  finishedAt?: number;
}

const KEY = "activeTrack";
let active: ActiveTrack | null = load();
let feed: LocationFeed | null = null;
let lastSaved = 0;
let wake: { release(): Promise<void> } | null = null;
const subs = new Set<() => void>();

function load(): ActiveTrack | null {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function persist(force = false) {
  if (!force && Date.now() - lastSaved < 5000) return;
  lastSaved = Date.now();
  try { if (active) localStorage.setItem(KEY, JSON.stringify(active)); else localStorage.removeItem(KEY); } catch { /* storage full or blocked */ }
}
function set(next: ActiveTrack | null, force = true) {
  active = next;
  persist(force);
  subs.forEach((f) => f());
}

export const useTracker = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => active);

/** Opens the tracker, ready to start. */
export function openTracker(kind: TrackKind, target: TrackTarget | null, simulate = false) {
  if (active && active.status !== "ready") return; // something is already being tracked
  set({ status: "ready", kind, target, track: null, simulate, error: null, lastFixAt: null });
}

export function setTrackKind(kind: TrackKind) { if (active?.status === "ready") set({ ...active, kind }); }
export function setSimulate(simulate: boolean) { if (active?.status === "ready") set({ ...active, simulate }); }

export async function startTracking() {
  if (!active || active.status !== "ready") return;
  set({ ...active, status: "recording", track: newTrack(active.kind, Date.now()), error: null });
  await startFeed();
}

async function startFeed() {
  if (!active) return;
  await feed?.stop();
  feed = await watchLocation({
    kind: active.kind,
    simulate: active.simulate,
    onFix: (f) => {
      if (!active?.track || active.status === "done") return;
      set({ ...active, track: addFix(active.track, f), lastFixAt: Date.now(), error: null }, false);
    },
    onError: (e) => { if (active) set({ ...active, error: e }); },
  });
  keepAwake(true);
}

export function pauseTracking() {
  if (active?.status !== "recording" || !active.track) return;
  set({ ...active, status: "paused", track: pause(active.track, Date.now()) });
}
export function resumeTracking() {
  if (active?.status !== "paused" || !active.track) return;
  set({ ...active, status: "recording", track: resume(active.track, Date.now()) });
}

/** Stops recording and shows the summary. */
export async function finishTracking() {
  if (!active?.track || (active.status !== "recording" && active.status !== "paused")) return;
  const now = Date.now(), track = active.track;
  // A pause running at the finish counts as paused time, so close it at the finish.
  set({ ...active, status: "done", track: track.pausedAt != null ? resume(track, now) : track, finishedAt: now });
  await feed?.stop();
  feed = null;
  keepAwake(false);
}

/** Closes the tracker, throwing away anything recorded. */
export async function closeTracker() {
  await feed?.stop();
  feed = null;
  keepAwake(false);
  set(null);
}

/** If the app was closed while recording, pick the GPS back up. */
export function resumeAfterReload() {
  if (active && (active.status === "recording" || active.status === "paused") && !feed) startFeed();
}

// The website can't track with the screen off, so keep the screen on while recording there.
async function keepAwake(on: boolean) {
  try {
    if (on && !wake && "wakeLock" in navigator) wake = await (navigator as Navigator & { wakeLock: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen");
    if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* not allowed right now */ }
}
