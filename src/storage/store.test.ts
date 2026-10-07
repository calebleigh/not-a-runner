import "fake-indexeddb/auto";
import { createStore } from "idb-keyval";
import { describe, expect, it } from "vitest";
import { LEGACY_KEY, createStorage } from "./store";

let n = 0;
const freshDb = () => createStore(`test-${n++}`, "kv");
function memLs(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
}

describe("storage", () => {
  it("migrates the old app's data on first load", async () => {
    const ls = memLs({ [LEGACY_KEY]: JSON.stringify({ done: { "1-0-c": 1 }, logs: { "1-0-c": { dist: 2, time: 1200, feel: "ok", at: 1 } }, gear: { shoes: 1 } }) });
    const st = createStorage(freshDb(), ls);
    const { state, migrated } = await st.load();
    expect(migrated).toBe(true);
    expect(state.done).toEqual({ "1-0-c": 1 });
    expect(state.gear).toEqual({ shoes: 1 });
    expect(state.steps).toEqual({});
  });

  it("prefers IndexedDB once it has data", async () => {
    const db = freshDb(), ls = memLs({ [LEGACY_KEY]: JSON.stringify({ done: { "1-0-c": 1 } }) });
    const st = createStorage(db, ls);
    const { state } = await st.load();
    await st.save({ ...state, done: { "1-0-c": 1, "1-1-c": 1 } });
    ls.map.set(LEGACY_KEY, JSON.stringify({ done: {} }));
    const again = await createStorage(db, ls).load();
    expect(again.migrated).toBe(false);
    expect(Object.keys(again.state.done)).toHaveLength(2);
  });

  it("mirrors saves to the old key so a rollback keeps new logs", async () => {
    const ls = memLs();
    const st = createStorage(freshDb(), ls);
    const { state } = await st.load();
    await st.save({ ...state, steps: { "1-0": 5000 } });
    expect(JSON.parse(ls.map.get(LEGACY_KEY)!).steps).toEqual({ "1-0": 5000 });
  });

  it("starts empty with no data anywhere", async () => {
    const { state, migrated } = await createStorage(freshDb(), null).load();
    expect(migrated).toBe(false);
    expect(state.done).toEqual({});
  });
});
