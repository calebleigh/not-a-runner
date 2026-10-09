// GPS tracking math: turns a stream of location fixes into distance, moving time, pace and mile
// splits. Pure and platform-free, so the same rules apply on Android, iPhone and the web.
//
// GPS is noisy. The rules below keep a phone sitting on a table from "walking", and one bad
// reading from adding a jump: inaccurate fixes are dropped, tiny moves wait until they add up to
// a real move, and impossible speeds are ignored.

export interface Fix {
  lat: number;
  lon: number;
  /** ms since 1970 */
  t: number;
  /** Horizontal accuracy in meters, if known. */
  acc?: number;
}

export type TrackKind = "walk" | "run" | "bike";

export interface Track {
  kind: TrackKind;
  startedAt: number;
  /** Total ms spent manually paused (finished pauses only). */
  pausedMs: number;
  /** When the current manual pause began, if paused. */
  pausedAt: number | null;
  /** Meters counted so far. */
  distM: number;
  /** ms spent actually moving (stops at lights don't count). */
  movingMs: number;
  /** The last fix that counted; small moves wait here until they add up. */
  anchor: Fix | null;
  /** Elapsed moving ms at each whole mile. */
  splits: number[];
  /** Points kept for the route map (thinned). */
  route: [number, number][];
  /** Auto-pause seconds this workout ran with (0 or missing: off). Then the clock is the time saved. */
  autoPause?: number;
}

export const MILE = 1609.344;
/** Fixes less accurate than this are ignored. */
const MAX_ACC = 30;
/** Faster than this between two fixes is a GPS jump, not you (m/s). */
const MAX_SPEED: Record<TrackKind, number> = { walk: 7, run: 9, bike: 25 };
/** Below this you count as stopped (m/s): slower than a stroll. */
const MIN_MOVING = 0.4;
/** A gap longer than this between fixes isn't counted as moving time. */
const MAX_GAP_MS = 30_000;

export function newTrack(kind: TrackKind, now: number): Track {
  return { kind, startedAt: now, pausedMs: 0, pausedAt: null, distM: 0, movingMs: 0, anchor: null, splits: [], route: [] };
}

/** Meters between two points (haversine). */
export function meters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Adds one GPS fix. Returns a new track (the input isn't changed). */
export function addFix(tr: Track, f: Fix): Track {
  if (f.acc != null && f.acc > MAX_ACC) return tr;
  // While paused, follow along without counting, so resuming doesn't add the distance walked paused.
  if (tr.pausedAt != null || !tr.anchor) return { ...tr, anchor: f, route: tr.anchor ? tr.route : [...tr.route, [f.lat, f.lon]] };
  const a = tr.anchor, dt = f.t - a.t;
  if (dt <= 0) return tr;
  const d = meters(a, f);
  // Small moves are probably GPS wobble: wait until they add up to more than the fix's own error.
  // The anchor stays put while waiting, so wobble around one spot never adds up.
  const wobble = Math.min(Math.max(f.acc ?? 10, 5), 20);
  if (d < wobble) return tr;
  const speed = d / (dt / 1000);
  if (speed > MAX_SPEED[tr.kind]) return tr; // a jump; keep the old anchor and wait for a sane fix
  const moving = dt <= MAX_GAP_MS && speed >= MIN_MOVING;
  const distM = tr.distM + d, movingMs = tr.movingMs + (moving ? dt : 0);
  const splits = [...tr.splits];
  while (distM >= MILE * (splits.length + 1)) {
    // When the mile was crossed, interpolated within this segment.
    const into = (MILE * (splits.length + 1) - tr.distM) / d;
    splits.push(Math.round(tr.movingMs + (moving ? dt * into : 0)));
  }
  return { ...tr, anchor: f, distM, movingMs, splits, route: [...tr.route, [f.lat, f.lon]] };
}

export function pause(tr: Track, now: number): Track {
  return tr.pausedAt != null ? tr : { ...tr, pausedAt: now };
}
export function resume(tr: Track, now: number): Track {
  return tr.pausedAt == null ? tr : { ...tr, pausedMs: tr.pausedMs + (now - tr.pausedAt), pausedAt: null };
}

export interface TrackStats {
  miles: number;
  /** Seconds since start, minus manual pauses. */
  elapsedS: number;
  /** Seconds actually moving. */
  movingS: number;
  /** Average pace while moving (s per mile), once there's enough distance to mean something. */
  paceS: number | null;
  /** Average speed while moving. */
  mph: number;
  /** Seconds for each whole mile. */
  splitS: number[];
}

export function trackStats(tr: Track, now: number): TrackStats {
  const paused = tr.pausedMs + (tr.pausedAt != null ? now - tr.pausedAt : 0);
  const elapsedS = Math.max(0, Math.round((now - tr.startedAt - paused) / 1000));
  const movingS = Math.round(tr.movingMs / 1000), miles = tr.distM / MILE;
  const paceS = miles >= 0.05 && movingS > 0 ? Math.round(movingS / miles) : null;
  const mph = movingS > 0 ? miles / (movingS / 3600) : 0;
  const splitS = tr.splits.map((ms, i) => Math.round((ms - (tr.splits[i - 1] ?? 0)) / 1000));
  return { miles, elapsedS, movingS, paceS, mph, splitS };
}

/** Thins the route for storage: keeps points at least `minM` apart (and always the last one). */
export function thinRoute(route: [number, number][], minM = 10): [number, number][] {
  if (route.length < 3) return route;
  const out: [number, number][] = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const [la, lo] = out[out.length - 1], [lb, lob] = route[i];
    if (meters({ lat: la, lon: lo }, { lat: lb, lon: lob }) >= minM) out.push(route[i]);
  }
  out.push(route[route.length - 1]);
  return out;
}

/**
 * Route as an encoded polyline (the format map services use): about 6 characters a point instead
 * of 30, and plain text, which the sync database can store.
 */
export function encodeRoute(route: [number, number][]): string {
  let out = "", pLat = 0, pLon = 0;
  const enc = (v: number) => {
    let x = v < 0 ? ~(v << 1) : v << 1, s = "";
    while (x >= 0x20) { s += String.fromCharCode((0x20 | (x & 0x1f)) + 63); x >>= 5; }
    return s + String.fromCharCode(x + 63);
  };
  for (const [lat, lon] of route) {
    const a = Math.round(lat * 1e5), b = Math.round(lon * 1e5);
    out += enc(a - pLat) + enc(b - pLon);
    pLat = a; pLon = b;
  }
  return out;
}

export function decodeRoute(s: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lon = 0;
  const dec = () => {
    let r = 0, sh = 0, b;
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < s.length) { lat += dec(); lon += dec(); out.push([lat / 1e5, lon / 1e5]); }
  return out;
}
