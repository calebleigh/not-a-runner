// Local-first storage. IndexedDB holds the state; the old app's localStorage key is read once to
// migrate, and kept mirrored so rolling back to the old app never loses a log.
import { createStore, get, set, type UseStore } from "idb-keyval";
import { normalizeState } from "../training/backup";
import type { State } from "../training/types";

export const LEGACY_KEY = "sgHalfV3";
const LEGACY_DAILY_KEY = "sgHalfDaily";
const STATE_KEY = "state";

type KV = Pick<Storage, "getItem" | "setItem">;

export interface Storage_ {
  load(): Promise<{ state: State; migrated: boolean }>;
  save(state: State): Promise<void>;
}

function readLegacy(ls: KV | null): State | null {
  if (!ls) return null;
  try {
    const raw = ls.getItem(LEGACY_KEY);
    const s = raw ? normalizeState(JSON.parse(raw)) : null;
    // The earliest prototype kept only done flags under a separate key.
    if (!s || !Object.keys(s.done).length) {
      const old = JSON.parse(ls.getItem(LEGACY_DAILY_KEY) || "null");
      if (old && typeof old === "object" && Object.keys(old).length) return { ...(s || normalizeState({})), done: old };
    }
    return s;
  } catch {
    return null;
  }
}

export function createStorage(db: UseStore = createStore("half-training", "kv"), ls: KV | null = safeLocalStorage()): Storage_ {
  return {
    async load() {
      const saved = await get<unknown>(STATE_KEY, db);
      if (saved) return { state: normalizeState(saved), migrated: false };
      const legacy = readLegacy(ls);
      const state = legacy || normalizeState({});
      await set(STATE_KEY, state, db);
      return { state, migrated: !!legacy };
    },
    async save(state) {
      await set(STATE_KEY, state, db);
      try { ls?.setItem(LEGACY_KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
    },
  };
}

function safeLocalStorage(): KV | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
