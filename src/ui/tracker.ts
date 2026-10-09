// The workout being tracked right now. Lives outside React so it keeps recording across tabs, and
// is saved to the device every few seconds so a closed or reloaded app picks up where it left off.
import { useSyncExternalStore } from "react";
import { watchLocation, type LocationError, type LocationFeed } from "../native/location";
import { cue } from "../native/cues";
import { watchSteps, type StepFeed } from "../native/steps";
import { intervalAt, intervalCue, intervalPlan, type IntervalPlan } from "../training/intervals";
import { addFix, newTrack, pause, resume, trackStats, type Track, type TrackKind } from "../training/track";
import { AUTO_PAUSE_DEFAULT, autoPauseStep, gpsMoved } from "../training/autopause";
import { hideNotice, onNoticeAction, showNotice } from "../native/workoutNotice";

/** Where a finished workout gets saved: a planned session, or an extra activity for today. */
export interface TrackTarget { w: number; d: number; title: string; /** The session's instructions (for intervals). */ instructions?: string }

export type TrackStatus = "ready" | "recording" | "paused" | "done";
/** Outdoors with GPS, or indoors / in place (treadmill, pacing a small area) by steps and time. */
export type TrackMode = "gps" | "indoor";

export interface ActiveTrack {
  status: TrackStatus;
  mode: TrackMode;
  /** Steps counted so far (the phone's counter restarts with the app, so earlier counts add in). */
  steps: number;
  stepBase: number;
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
  /** Walk/run interval schedule from the session, coached with voice and vibration. */
  intervals: IntervalPlan | null;
  /** Speak the cues (vibration happens either way). */
  voice: boolean;
  /** The last interval segment announced. */
  cuedIndex: number;
  /** Paused by auto-pause (it resumes on its own), not by a tap. */
  autoPaused?: boolean;
  /** When you last moved (steps or GPS), for auto-pause. */
  lastMoveAt?: number;
}

const KEY = "activeTrack";
let active: ActiveTrack | null = load();
let feed: LocationFeed | null = null;
let stepFeed: StepFeed | null = null;
let lastSaved = 0;
let wake: { release(): Promise<void> } | null = null;
const subs = new Set<() => void>();

function load(): ActiveTrack | null {
  try { const s = localStorage.getItem(KEY); return s ? { intervals: null, voice: true, cuedIndex: -1, mode: "gps", steps: 0, stepBase: 0, ...JSON.parse(s) } : null; } catch { return null; }
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
  notice();
}

// The lock screen and notification shade show the workout with a Pause button (Android).
let noticeAt = 0, noticeKey = "";
function notice() {
  const a = active;
  if (!a?.track || (a.status !== "recording" && a.status !== "paused")) { if (noticeKey) { noticeKey = ""; hideNotice(); } return; }
  const key = a.status + (a.autoPaused ? "a" : "");
  if (key === noticeKey && Date.now() - noticeAt < 3000) return;
  noticeKey = key; noticeAt = Date.now();
  const s = trackStats(a.track, Date.now());
  const what = a.kind === "bike" ? "Bike" : a.kind === "run" ? "Run" : "Walk";
  const dist = a.mode === "indoor" ? "" : `${s.miles.toFixed(2)} mi`;
  const speed = a.mode === "indoor" ? "" : a.kind === "bike" ? (s.mph ? `${s.mph.toFixed(1)} mph` : "") : s.paceS ? `${Math.floor(s.paceS / 60)}:${String(s.paceS % 60).padStart(2, "0")} /mi` : "";
  showNotice({
    title: what,
    status: a.status === "paused" ? (a.autoPaused ? "Auto-paused" : "Paused") : "Recording",
    elapsedMs: s.elapsedS * 1000,
    paused: a.status === "paused",
    line1: [dist, speed].filter(Boolean).join("  ·  ") || "Indoors",
    line2: a.steps ? `${a.steps.toLocaleString("en-US")} steps` : "",
  });
}
onNoticeAction((action) => { if (action === "pause") pauseTracking(); else if (action === "resume") resumeTracking(); });

// Auto-pause setting (seconds; 0 is off).
export function autoPausePref(): number {
  try { const v = localStorage.getItem("autoPause"); return v == null ? AUTO_PAUSE_DEFAULT : Math.max(0, parseInt(v) || 0); } catch { return AUTO_PAUSE_DEFAULT; }
}
export function setAutoPause(secs: number) {
  try { localStorage.setItem("autoPause", String(secs)); } catch { /* blocked */ }
  if (active) set({ ...active });
}
/** Indoors on a bike there's nothing to sense movement with. */
const canAutoPause = (a: ActiveTrack) => !(a.kind === "bike" && a.mode === "indoor");

/** Pauses after a while without movement; resumes an auto-pause when you move. */
function checkAutoPause(moved = false) {
  const a = active;
  if (!a?.track || (a.status !== "recording" && a.status !== "paused") || !a.track.autoPause) return;
  const now = Date.now();
  const step = autoPauseStep({ now, lastMoveAt: a.lastMoveAt ?? a.track.startedAt, secs: a.track.autoPause, status: a.status, autoPaused: !!a.autoPaused, moved });
  if (step === "pause") {
    // The clock stopped when you did, not when auto-pause noticed.
    const at = Math.max(a.lastMoveAt ?? a.track.startedAt, a.track.startedAt);
    set({ ...a, status: "paused", autoPaused: true, track: pause(a.track, at) });
    cue("Paused", { voice: false });
  } else if (step === "resume") {
    set({ ...a, status: "recording", autoPaused: false, lastMoveAt: now, track: resume(a.track, now) });
    cue("Resumed", { voice: false });
  }
}

export const useTracker = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => active);

/** Opens the tracker, ready to start. */
export function openTracker(kind: TrackKind, target: TrackTarget | null, simulate = false) {
  if (active && active.status !== "ready") return; // something is already being tracked
  set({ status: "ready", mode: modePref(), steps: 0, stepBase: 0, kind, target, track: null, simulate, error: null, lastFixAt: null, intervals: plansFor(kind, target), voice: voicePref(), cuedIndex: -1 });
}

const plansFor = (kind: TrackKind, target: TrackTarget | null) => (kind === "run" && target?.instructions ? intervalPlan(target.instructions) : null);
function modePref(): TrackMode { try { return localStorage.getItem("trackMode") === "indoor" ? "indoor" : "gps"; } catch { return "gps"; } }
export function setTrackMode(mode: TrackMode) {
  try { localStorage.setItem("trackMode", mode); } catch { /* blocked */ }
  if (active?.status === "ready") set({ ...active, mode });
}
function voicePref() { try { return localStorage.getItem("voiceCues") !== "off"; } catch { return true; } }
export function setVoice(on: boolean) {
  try { localStorage.setItem("voiceCues", on ? "on" : "off"); } catch { /* blocked */ }
  if (active) set({ ...active, voice: on });
}

/** Announces the interval segment when it changes. Runs every second and on every GPS fix. */
function checkCue() {
  if (!active?.intervals || active.status !== "recording" || !active.track) return;
  const at = intervalAt(active.intervals, trackStats(active.track, Date.now()).elapsedS);
  if (at.index === active.cuedIndex) return;
  set({ ...active, cuedIndex: at.index });
  cue(intervalCue(active.intervals, at.segment), { voice: active.voice });
}
let cueTimer: number | undefined;

export function setTrackKind(kind: TrackKind) { if (active?.status === "ready") set({ ...active, kind, intervals: plansFor(kind, active.target) }); }
export function setSimulate(simulate: boolean) { if (active?.status === "ready") set({ ...active, simulate }); }

export async function startTracking() {
  if (!active || active.status !== "ready") return;
  const now = Date.now(), ap = canAutoPause(active) ? autoPausePref() : 0;
  set({ ...active, status: "recording", track: { ...newTrack(active.kind, now), ...(ap ? { autoPause: ap } : {}) }, lastMoveAt: now, autoPaused: false, error: null });
  await startFeed();
}

async function startFeed() {
  if (!active) return;
  await feed?.stop();
  feed = null;
  await stepFeed?.stop();
  // Steps count in both modes (indoors they're the distance; outdoors they teach the app your stride).
  if (active.kind !== "bike") {
    set({ ...active, stepBase: active.steps });
    stepFeed = await watchSteps((n) => {
      if (!active || active.status === "done") return;
      const moved = active.stepBase + n > active.steps;
      // Steps out of an auto-pause count (they're what wakes it); during a tapped pause they don't.
      if (active.status === "paused" && !active.autoPaused) { set({ ...active, stepBase: active.steps - n }, false); return; }
      set({ ...active, steps: active.stepBase + n, ...(moved ? { lastMoveAt: Date.now() } : {}) }, false);
      if (moved) checkAutoPause(true);
    });
  }
  if (active.mode === "indoor") { startClock(); return; }
  feed = await watchLocation({
    kind: active.kind,
    simulate: active.simulate,
    onFix: (f) => {
      if (!active?.track || active.status === "done") return;
      const prev = active.track.anchor, before = active.track.distM;
      const track = addFix(active.track, f);
      // Moving: distance counted, or (while auto-paused, when nothing counts) a real move between fixes.
      const moved = track.distM > before || (active.status === "paused" && gpsMoved(prev, f, active.kind));
      set({ ...active, track, lastFixAt: Date.now(), error: null, ...(moved ? { lastMoveAt: Date.now() } : {}) }, false);
      checkAutoPause(moved);
      checkCue();
    },
    onError: (e) => { if (active) set({ ...active, error: e }); },
  });
  startClock();
}

function startClock() {
  keepAwake(true);
  clearInterval(cueTimer);
  cueTimer = window.setInterval(() => { checkAutoPause(); checkCue(); notice(); }, 1000);
  checkCue();
}

export function pauseTracking() {
  if (active?.status !== "recording" || !active.track) return;
  set({ ...active, status: "paused", autoPaused: false, track: pause(active.track, Date.now()) });
}
export function resumeTracking() {
  if (active?.status !== "paused" || !active.track) return;
  set({ ...active, status: "recording", autoPaused: false, lastMoveAt: Date.now(), track: resume(active.track, Date.now()) });
}

/** Stops recording and shows the summary. */
export async function finishTracking() {
  if (!active?.track || (active.status !== "recording" && active.status !== "paused")) return;
  const now = Date.now(), track = active.track;
  // A pause running at the finish counts as paused time, so close it at the finish.
  set({ ...active, status: "done", track: track.pausedAt != null ? resume(track, now) : track, finishedAt: now });
  await feed?.stop();
  feed = null;
  await stepFeed?.stop();
  stepFeed = null;
  clearInterval(cueTimer);
  keepAwake(false);
}

/** Closes the tracker, throwing away anything recorded. */
export async function closeTracker() {
  await feed?.stop();
  feed = null;
  await stepFeed?.stop();
  stepFeed = null;
  clearInterval(cueTimer);
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
