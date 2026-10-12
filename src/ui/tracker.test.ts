// Auto-pause through the real tracker, with the phone's step counter and clock faked: walk, stand,
// walk, stand. Each stand should pause (even with a stray step while standing), and each walk
// should start it again.
import { beforeEach, describe, expect, it, vi } from "vitest";

let onSteps: ((n: number) => void) | null = null;
vi.mock("../native/steps", () => ({
  canCountSteps: true,
  watchSteps: async (fn: (n: number) => void) => { onSteps = fn; return { stop: async () => {} }; },
}));
vi.mock("../native/location", () => ({ watchLocation: async () => ({ stop: async () => {} }), canTrackInBackground: true }));
vi.mock("../native/cues", () => ({ cue: () => {} }));
vi.mock("../native/workoutNotice", () => ({
  liveInBackground: true, showNotice: () => {}, hideNotice: () => {}, onNoticeAction: () => {}, onNoticeTick: () => {},
}));

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});
(globalThis as { window?: unknown }).window = globalThis;

const now = () => JSON.parse(store.get("activeTrack") ?? "null") as { status: string; autoPaused?: boolean } | null;

describe("auto-pause, indoors on steps", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 12, 9, 0, 0)); store.clear(); store.set("trackMode", "indoor"); store.set("autoPause", "15"); });

  it("pauses every time you stand still, and starts again every time you walk", async () => {
    const T = await import("./tracker");
    T.openTracker("walk", null);
    await T.startTracking();
    let n = 0;
    const walk = async (secs: number) => { for (let i = 0; i < secs; i++) { n += 2; onSteps!(n); await vi.advanceTimersByTimeAsync(1000); } };
    // Standing, with one shift of weight partway through (the step counter counts it).
    const stand = async (secs: number) => {
      for (let i = 0; i < secs; i++) { if (i === 8) onSteps!(++n); await vi.advanceTimersByTimeAsync(1000); }
    };

    await walk(30);
    expect(now()?.status).toBe("recording");
    for (let round = 1; round <= 3; round++) {
      await stand(20);
      expect(now(), `stand ${round}`).toMatchObject({ status: "paused", autoPaused: true });
      await walk(10);
      expect(now(), `walk ${round}`).toMatchObject({ status: "recording" });
    }
    await T.closeTracker();
  });
});
