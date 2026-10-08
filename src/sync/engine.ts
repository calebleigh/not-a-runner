// Sync engine: pure functions, no network. The state is split into small entries ("logs/3-1-c",
// "settings/name", "plan") so two devices editing different things never overwrite each other.
// Each local edit is stamped with the time it happened; when the same entry changed on both
// devices, the later edit wins.
import { normalizeState } from "../training/backup";
import type { Extra, State } from "../training/types";

/** One synced entry as stored on the server. */
export interface Row {
  key: string;
  value: unknown;
  deleted: boolean;
  /** When the edit happened on the device (ms). 0 means "from before sync was turned on". */
  edited_at: number;
  /** Server time of the last write, used as the download cursor. */
  updated_at?: string;
}

export interface SyncMeta {
  /** Entries edited here and not yet uploaded, with when they were edited. */
  dirty: Record<string, number>;
  /** updated_at of the newest row downloaded so far. */
  cursor: string | null;
}

const MAPS = ["done", "logs", "gear", "swaps", "weights", "steps", "todos"] as const;
type MapKey = (typeof MAPS)[number];

/** A new id for an extra activity. */
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * Ids for a day's extras. Older extras have no id, so theirs comes from their contents (plus a
 * count for exact repeats). That's the same on every device, so the same activity matches up.
 */
export function extraIds(list: Extra[]): string[] {
  const seen = new Map<string, number>();
  return list.map((e) => {
    if (e.id) return e.id;
    const base = "h" + hash(JSON.stringify([e.kind, e.dist, e.time, e.steps ?? null, e.label ?? null]));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  });
}

/** Every entry in the state, keyed for sync. */
export function toEntries(s: State): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const k of MAPS) for (const [id, v] of Object.entries(s[k])) m.set(`${k}/${id}`, v);
  // Each extra activity is its own entry ("extras/<day>/<id>"), so two devices adding
  // activities on the same day keep both.
  for (const [day, list] of Object.entries(s.extras)) {
    const ids = extraIds(list);
    list.forEach((e, i) => m.set(`extras/${day}/${ids[i]}`, e));
  }
  for (const [f, v] of Object.entries(s.settings)) if (v !== undefined) m.set(`settings/${f}`, v);
  if (s.plan) m.set("plan", s.plan);
  return m;
}

/** Sets (or, with undefined, removes) one entry. Mutates `s`; unknown keys are ignored. */
export function setEntry(s: State, key: string, value: unknown): void {
  if (key === "plan") {
    if (value === undefined) delete s.plan;
    else s.plan = value as State["plan"];
    return;
  }
  const i = key.indexOf("/");
  if (i < 1) return;
  const col = key.slice(0, i), id = key.slice(i + 1);
  if (col === "extras") return setExtra(s, id, value);
  const obj = col === "settings" ? (s.settings as Record<string, unknown>) : MAPS.includes(col as MapKey) ? (s[col as MapKey] as Record<string, unknown>) : null;
  if (!obj || !id) return;
  if (value === undefined) delete obj[id];
  else obj[id] = value;
}

function setExtra(s: State, rest: string, value: unknown) {
  const j = rest.indexOf("/");
  if (j < 0) {
    // Older format: one entry held the whole day. Only add what's missing; never remove.
    if (!Array.isArray(value)) return;
    const have = s.extras[rest] || [], ids = new Set(extraIds(have));
    const incoming = value as Extra[], inIds = extraIds(incoming);
    const add = incoming.filter((_, k) => !ids.has(inIds[k]));
    if (add.length) s.extras[rest] = [...have, ...add];
    return;
  }
  const day = rest.slice(0, j), id = rest.slice(j + 1);
  const list = [...(s.extras[day] || [])], at = extraIds(list).indexOf(id);
  if (value === undefined) {
    if (at < 0) return;
    list.splice(at, 1);
  } else if (at >= 0) list[at] = value as Extra;
  else list.push(value as Extra);
  if (list.length) s.extras[day] = list;
  else delete s.extras[day];
}

/**
 * One-time step after this format change: upload each extra as its own entry and clear the old
 * whole-day entries, so a device that signs in later doesn't bring back deleted activities.
 */
export function migrateExtras(state: State, meta: SyncMeta, now: number): SyncMeta {
  const dirty = { ...meta.dirty };
  for (const [day, list] of Object.entries(state.extras)) {
    dirty[`extras/${day}`] = now;
    for (const id of extraIds(list)) dirty[`extras/${day}/${id}`] ??= 0;
  }
  return { ...meta, dirty };
}

/** Keys whose value differs between two states (added, changed or removed). */
export function changedKeys(prev: State, next: State): string[] {
  const a = toEntries(prev), b = toEntries(next), out: string[] = [];
  for (const [k, v] of b) if (!a.has(k) || JSON.stringify(a.get(k)) !== JSON.stringify(v)) out.push(k);
  for (const k of a.keys()) if (!b.has(k)) out.push(k);
  return out;
}

/** Records local edits so they get uploaded. */
export function markDirty(meta: SyncMeta, keys: string[], at: number): SyncMeta {
  if (!keys.length) return meta;
  const dirty = { ...meta.dirty };
  for (const k of keys) dirty[k] = at;
  return { ...meta, dirty };
}

/**
 * Turning sync on for this device: everything already here is offered to the account, stamped
 * as older than any synced edit, so the account's copy wins where both have the same entry and
 * nothing that exists only here is lost.
 */
export function startMeta(state: State): SyncMeta {
  const dirty: Record<string, number> = {};
  for (const k of toEntries(state).keys()) dirty[k] = 0;
  return { dirty, cursor: null };
}

/** Applies downloaded rows. A local edit newer than the row is kept (and uploaded later). */
export function applyRemote(state: State, meta: SyncMeta, rows: Row[]): { state: State; meta: SyncMeta; changed: boolean } {
  const next = normalizeState(structuredClone(state));
  const dirty = { ...meta.dirty };
  let cursor = meta.cursor, changed = false;
  for (const r of rows) {
    if (r.updated_at && (!cursor || r.updated_at > cursor)) cursor = r.updated_at;
    const mine = dirty[r.key];
    if (mine !== undefined && mine > r.edited_at) continue;
    delete dirty[r.key];
    // Compare the whole collection the row belongs to (an older whole-day extras row touches several entries).
    const col = r.key.split("/")[0] as keyof State, snap = () => JSON.stringify(next[col]);
    const before = snap();
    setEntry(next, r.key, r.deleted ? undefined : r.value);
    if (snap() !== before) changed = true;
  }
  return { state: changed ? next : state, meta: { dirty, cursor }, changed };
}

/** Rows to upload: every dirty entry, with its current value or a deletion. */
export function pendingRows(state: State, meta: SyncMeta): Row[] {
  const e = toEntries(state);
  return Object.entries(meta.dirty).map(([key, at]) => {
    const has = e.has(key);
    return { key, value: has ? e.get(key)! : null, deleted: !has, edited_at: at };
  });
}

/** After an upload: entries not edited again since are no longer dirty. */
export function afterPush(meta: SyncMeta, pushed: Row[]): SyncMeta {
  const dirty = { ...meta.dirty };
  for (const r of pushed) if (dirty[r.key] === r.edited_at) delete dirty[r.key];
  return { ...meta, dirty };
}
