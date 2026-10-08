// Sync engine: pure functions, no network. The state is split into small entries ("logs/3-1-c",
// "settings/name", "plan") so two devices editing different things never overwrite each other.
// Each local edit is stamped with the time it happened; when the same entry changed on both
// devices, the later edit wins.
import { normalizeState } from "../training/backup";
import type { State } from "../training/types";

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

const MAPS = ["done", "logs", "gear", "swaps", "weights", "extras", "steps"] as const;
type MapKey = (typeof MAPS)[number];

/** Every entry in the state, keyed for sync. */
export function toEntries(s: State): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const k of MAPS) for (const [id, v] of Object.entries(s[k])) m.set(`${k}/${id}`, v);
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
  const obj = col === "settings" ? (s.settings as Record<string, unknown>) : MAPS.includes(col as MapKey) ? (s[col as MapKey] as Record<string, unknown>) : null;
  if (!obj || !id) return;
  if (value === undefined) delete obj[id];
  else obj[id] = value;
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
    const before = JSON.stringify(toEntries(next).get(r.key));
    setEntry(next, r.key, r.deleted ? undefined : r.value);
    if (JSON.stringify(toEntries(next).get(r.key)) !== before) changed = true;
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
