// The workout being tracked right now. Lives outside React so it keeps recording across tabs, and
// is saved to the device every few seconds so a closed or reloaded app picks up where it left off.
import { useSyncExternalStore } from "react";
import { watchLocation, type LocationError, type LocationFeed } from "../native/location";
import { cue } from "../native/cues";
import { watchSteps, type StepFeed } from "../native/steps";
import { intervalAt, intervalCue, intervalPlan, type IntervalPlan } from "../training/intervals";
import { addFix, newTrack, pause, resume, trackStats, type Fix, type Track, type TrackKind } from "../training/track";
import { MILESTONES_DEFAULT, milestoneCue, milestoneMarks, type MilestoneMarks, type MilestonePrefs } from "../training/milestones";
import { AUTO_PAUSE_DEFAULT, autoPauseDue, autoPauseWake, gpsMoving, keepRecent, keepSteps, stepsMoving, type StepMark } from "../training/autopause";
import { hideNotice, liveInBackground, onNoticeAction, onNoticeAuto, onNoticeTick, showNotice } from "../native/workoutNotice";
import { logTrack } from "./trackLog";

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
  /** Steps and meters when the auto-pause began, to tell a real stop from a late step count. */
  apFrom?: { steps: number; distM: number };
  /** Tucked into the bar above the nav, so the rest of the app can be used. */
  min?: boolean;
  /** The last 20 seconds of GPS fixes, to tell walking from GPS drift. */
  recent?: Fix[];
  /** Recent step counts, to tell walking from a stray step while standing. */
  stepLog?: StepMark[];
  /** The last auto-pause decision from the phone that's been applied here. */
  autoSeq?: number;
  /** Meters a step (from your outdoor walks), for distance indoors and the phone's spoken miles. */
  stride?: number;
  /** The spoken updates already said (on the website; the Android app keeps its own). */
  marks?: MilestoneMarks;
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

/** The theme's accent colors (set as CSS variables by the theme), for the notification's card. */
function themeColors() {
  if (typeof document === "undefined") return {};
  const css = getComputedStyle(document.documentElement);
  return { accent: css.getPropertyValue("--accent").trim(), onAccent: css.getPropertyValue("--on-accent").trim() };
}

// The lock screen and notification shade show the workout with a Pause button (Android).
let noticeAt = 0, noticeKey = "";
function notice() {
  const a = active;
  if (!a?.track || (a.status !== "recording" && a.status !== "paused")) { if (noticeKey) { noticeKey = ""; hideNotice(); } return; }
  const key = a.status + (a.autoPaused ? "a" : "");
  if (key === noticeKey && Date.now() - noticeAt < 1000) return;
  noticeKey = key; noticeAt = Date.now();
  const s = trackStats(a.track, Date.now());
  const what = a.kind === "bike" ? "Bike" : a.kind === "run" ? "Run" : "Walk";
  const dist = a.mode === "indoor" ? "" : `${s.miles.toFixed(2)} mi`;
  const speed = a.mode === "indoor" ? "" : a.kind === "bike" ? (s.mph ? `${s.mph.toFixed(1)} mph` : "") : s.paceS ? `${Math.floor(s.paceS / 60)}:${String(s.paceS % 60).padStart(2, "0")} /mi` : "";
  const phoneSteps = !!stepFeed?.native && a.kind !== "bike";
  const cues = cuesFor(a);
  showNotice({
    kind: a.kind,
    title: what,
    status: a.status === "paused" ? (a.autoPaused ? "Auto-paused" : "Paused") : "Recording",
    elapsedMs: s.elapsedS * 1000,
    paused: a.status === "paused",
    line1: [dist, speed].filter(Boolean).join("  ·  ") || "Indoors",
    // The phone counts steps on the card itself when it can, so they stay live with the screen off.
    line2: phoneSteps || !a.steps ? "" : `${a.steps.toLocaleString("en-US")} steps`,
    ...(phoneSteps ? { steps: a.steps } : {}),
    autoPauseSecs: phoneAutoPause(a) ? a.track.autoPause : 0,
    autoPaused: !!a.autoPaused,
    autoSeq: a.autoSeq ?? 0,
    distM: distMeters(a),
    stride: a.kind !== "bike" ? a.stride ?? 0 : 0,
    cueMiles: cues.mi,
    cueMins: cues.min,
    cueSteps: cues.steps,
    ...themeColors(),
  });
}
onNoticeAction((action) => { logTrack(`notification ${action}`); if (action === "pause") pauseTracking(); else if (action === "resume") resumeTracking(); });
// The app's own timers crawl in a pocket, so on Android a native tick keeps these on time.
onNoticeTick(() => { tick("native"); checkAutoPause(); checkCue(); notice(); });

// Notes in the log when the once-a-second check went quiet (the app was asleep), since auto-pause
// can only start on a check.
let lastTick = 0;
function tick(from: string) {
  const now = Date.now();
  if (lastTick && now - lastTick > 3000 && active?.status === "recording") logTrack(`no check for ${Math.round((now - lastTick) / 1000)}s (${from})`);
  lastTick = now;
}

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

/**
 * On foot with the app's Android step counter, the phone does auto-pause itself: the app sleeps
 * after a minute or so with the screen off, so it couldn't. Its decisions arrive here, timestamped.
 */
function phoneAutoPause(a: ActiveTrack): a is ActiveTrack & { track: Track } {
  return liveInBackground && !!stepFeed?.native && a.kind !== "bike" && !!a.track?.autoPause;
}
onNoticeAuto((d) => {
  const a = active;
  if (!a?.track || (a.status !== "recording" && a.status !== "paused")) return;
  const at = new Date(d.at).toLocaleTimeString("en-US", { hour12: false });
  // A cue only when it's fresh: one arriving as the phone unlocks would just be confusing.
  const fresh = Date.now() - d.at < 3000;
  if (d.state === "pause" && a.status === "recording") {
    logTrack(`auto-pause by the phone at ${at}, ${a.steps} steps`);
    set({ ...a, status: "paused", autoPaused: true, autoSeq: d.seq, apFrom: { steps: a.steps, distM: a.track.distM }, track: pause(a.track, d.at) });
    if (fresh) cue("Paused", { voice: false });
  } else if (d.state === "resume" && a.status === "paused" && a.autoPaused) {
    logTrack(`auto-resume by the phone at ${at} (${d.erase ? "erase" : "resume"}) after ${Math.round((d.pausedMs ?? 0) / 1000)}s, ${d.steps ?? 0} steps`);
    const track = d.erase ? { ...a.track, pausedAt: null } : resume(a.track, d.at);
    set({ ...a, status: "recording", autoPaused: false, apFrom: undefined, autoSeq: d.seq, lastMoveAt: d.at, track });
    if (fresh) cue("Resumed", { voice: false });
  } else {
    set({ ...a, autoSeq: d.seq }, false);
  }
});

/** Pauses after a while without movement; ends an auto-pause when you move. */
function checkAutoPause(moved = false) {
  const a = active;
  if (!a?.track || !a.track.autoPause) return;
  if (phoneAutoPause(a)) return;
  const now = Date.now();
  if (a.status === "paused") {
    if (!a.autoPaused || !moved || a.track.pausedAt == null) return;
    const from = a.apFrom ?? { steps: a.steps, distM: a.track.distM };
    const wake = autoPauseWake({ pausedS: (now - a.track.pausedAt) / 1000, steps: a.steps - from.steps, meters: a.track.distM - from.distM, kind: a.kind });
    if (!wake) return;
    // Moving the whole time: the pause was a mistake, so it's erased and the clock catches up.
    const track = wake === "erase" ? { ...a.track, pausedAt: null } : resume(a.track, now);
    set({ ...a, status: "recording", autoPaused: false, apFrom: undefined, lastMoveAt: now, track });
    logTrack(`auto-resume (${wake}) after ${Math.round((now - a.track.pausedAt) / 1000)}s, ${a.steps - from.steps} steps`);
    cue("Resumed", { voice: false });
    return;
  }
  if (a.status !== "recording") return;
  const background = !liveInBackground && typeof document !== "undefined" && document.visibilityState === "hidden";
  if (!autoPauseDue({ now, lastMoveAt: a.lastMoveAt ?? a.track.startedAt, secs: a.track.autoPause, kind: a.kind, indoor: a.mode === "indoor", background })) return;
  // The clock stops now, not back when you stopped, so it never jumps backward.
  set({ ...a, status: "paused", autoPaused: true, apFrom: { steps: a.steps, distM: a.track.distM }, track: pause(a.track, now) });
  logTrack(`auto-pause, ${Math.round((now - (a.lastMoveAt ?? a.track.startedAt)) / 1000)}s since moving, ${a.steps} steps`);
  cue("Paused", { voice: false });
}
// The log notes the screen locking or the app leaving sight (and coming back) during a workout.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (active?.status === "recording" || active?.status === "paused") logTrack(document.visibilityState === "hidden" ? "app out of sight (screen off or another app)" : "app back in sight");
  });
}
// Back on the website the step count catches up; give it a moment before judging you stopped.
if (typeof document !== "undefined" && !liveInBackground) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && active?.status === "recording") set({ ...active, lastMoveAt: Date.now() }, false);
  });
}

export const useTracker = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => active);

/** Opens the tracker, ready to start. */
export function openTracker(kind: TrackKind, target: TrackTarget | null, simulate = false) {
  // Something is already being tracked: bring it back up instead.
  if (active && active.status !== "ready") { if (active.min) expandTracker(); return; }
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

// Spoken updates (every mile, every few minutes, every thousand steps).
export function milestonePrefs(): MilestonePrefs {
  try { return { ...MILESTONES_DEFAULT, ...JSON.parse(localStorage.getItem("voiceEvery") ?? "{}") }; } catch { return MILESTONES_DEFAULT; }
}
export function setMilestonePrefs(p: Partial<MilestonePrefs>) {
  try { localStorage.setItem("voiceEvery", JSON.stringify({ ...milestonePrefs(), ...p })); } catch { /* blocked */ }
  if (active) set({ ...active });
}
/** What gets spoken for this workout: nothing with voice off, no steps on a bike, no miles without a way to measure. */
function cuesFor(a: ActiveTrack): MilestonePrefs {
  const p = milestonePrefs();
  if (!a.voice) return { mi: 0, min: 0, steps: 0 };
  const bike = a.kind === "bike";
  return { mi: bike && a.mode === "indoor" ? 0 : p.mi, min: p.min, steps: bike ? 0 : p.steps };
}
/** Distance so far: GPS outdoors, steps times stride indoors. */
const distMeters = (a: ActiveTrack) => (a.mode === "indoor" ? (a.kind === "bike" ? 0 : a.steps * (a.stride ?? 0)) : a.track?.distM ?? 0);

/** On the website, speaks the updates (the Android app speaks them itself, even with the screen off). */
function checkMilestones() {
  const a = active;
  if (liveInBackground || !a?.track || a.status !== "recording") return;
  const p = cuesFor(a);
  const at = { miles: distMeters(a) / 1609.344, elapsedS: trackStats(a.track, Date.now()).elapsedS, steps: a.kind === "bike" ? 0 : a.steps };
  const said = milestoneCue(p, a.marks ?? milestoneMarks(p, at), at);
  if (!said) { if (!a.marks) set({ ...a, marks: milestoneMarks(p, at) }, false); return; }
  set({ ...a, marks: said.marks }, false);
  cue(said.text, { voice: true });
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

export async function startTracking(stride?: number) {
  if (!active || active.status !== "ready") return;
  const now = Date.now(), ap = canAutoPause(active) ? autoPausePref() : 0;
  logTrack(`start ${active.kind} ${active.mode}, auto-pause ${ap ? `${ap}s` : "off"}`);
  set({ ...active, status: "recording", track: { ...newTrack(active.kind, now), ...(ap ? { autoPause: ap } : {}) }, lastMoveAt: now, autoPaused: false, error: null, stride, marks: { mi: 0, min: 0, steps: 0 } });
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
      // Steps out of an auto-pause count (they're what wakes it); during a tapped pause they don't.
      if (active.status === "paused" && !active.autoPaused) { set({ ...active, stepBase: active.steps - n }, false); return; }
      // Walking is a few steps in a few seconds; a stray one while standing doesn't count as moving.
      const steps = active.stepBase + n, stepLog = keepSteps(active.stepLog, { t: Date.now(), n: steps });
      const moved = steps > active.steps && stepsMoving(stepLog) && !phoneAutoPause(active);
      if (steps !== active.steps) logTrack(`steps ${steps} (+${steps - active.steps})${moved ? " moving" : ""}${active.status === "paused" ? " while auto-paused" : ""}`);
      set({ ...active, steps, stepLog, ...(moved ? { lastMoveAt: Date.now() } : {}) }, false);
      if (moved) checkAutoPause(true);
    });
  }
  if (active.mode === "indoor") { startClock(); return; }
  feed = await watchLocation({
    kind: active.kind,
    simulate: active.simulate,
    onFix: (f) => {
      if (!active?.track || active.status === "done") return;
      // During an auto-pause distance still counts (it may be a mistake, and gets erased); a real
      // stop adds nothing, since GPS wobble in one spot never adds up.
      const ap = active.status === "paused" && active.autoPaused;
      const track = ap ? { ...addFix({ ...active.track, pausedAt: null }, f), pausedAt: active.track.pausedAt } : addFix(active.track, f);
      // Moving is judged by steps when they're counting (GPS drifts while you stand still), and
      // otherwise by GPS clearly getting somewhere.
      const recent = f.acc != null && f.acc > 30 ? active.recent ?? [] : keepRecent(active.recent, f);
      const bySteps = !!stepFeed && active.steps > 0;
      const moved = !bySteps && gpsMoving(recent, active.kind);
      if (moved && Date.now() - (active.lastMoveAt ?? 0) > 5000) logTrack(`GPS moving${active.status === "paused" ? " while auto-paused" : ""}`);
      set({ ...active, track, recent, lastFixAt: Date.now(), error: null, ...(moved ? { lastMoveAt: Date.now() } : {}) }, false);
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
  cueTimer = window.setInterval(() => { tick("app"); checkAutoPause(); checkCue(); checkMilestones(); notice(); }, 1000);
  checkCue();
}

/** Shrinks a running workout to the bar above the nav, or opens it full screen again. */
export function minimizeTracker() { if (active?.status === "recording" || active?.status === "paused") set({ ...active, min: true }); }
export function expandTracker() { if (active?.min) set({ ...active, min: false }); }

export function pauseTracking() {
  if (active?.status === "recording") logTrack("pause tapped");
  if (active?.status !== "recording" || !active.track) return;
  set({ ...active, status: "paused", autoPaused: false, apFrom: undefined, track: pause(active.track, Date.now()) });
}
export function resumeTracking() {
  if (active?.status === "paused") logTrack(`resume tapped${active.autoPaused ? " (was auto-paused)" : ""}`);
  if (active?.status !== "paused" || !active.track) return;
  set({ ...active, status: "recording", autoPaused: false, apFrom: undefined, lastMoveAt: Date.now(), track: resume(active.track, Date.now()) });
}

/** Stops recording and shows the summary. */
export async function finishTracking() {
  if (!active?.track || (active.status !== "recording" && active.status !== "paused")) return;
  const now = Date.now(), track = active.track;
  logTrack(`finish, ${active.steps} steps`);
  // A pause running at the finish counts as paused time, so close it at the finish.
  set({ ...active, status: "done", min: false, track: track.pausedAt != null ? resume(track, now) : track, finishedAt: now });
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
  if (active && (active.status === "recording" || active.status === "paused") && !feed) logTrack(`app reopened, ${active.status}`);
  if (active && (active.status === "recording" || active.status === "paused") && !feed) startFeed();
}

// The website can't track with the screen off, so keep the screen on while recording there.
async function keepAwake(on: boolean) {
  try {
    if (on && !wake && "wakeLock" in navigator) wake = await (navigator as Navigator & { wakeLock: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen");
    if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* not allowed right now */ }
}
