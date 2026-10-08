import { describe, expect, it } from "vitest";
import { emptyState } from "../training";
import type { State } from "../training/types";
import { afterPush, applyRemote, changedKeys, markDirty, pendingRows, setEntry, startMeta, toEntries, type Row, type SyncMeta } from "./engine";

const withLog = (s: State, id: string, dist: number): State => ({ ...s, done: { ...s.done, [id]: 1 }, logs: { ...s.logs, [id]: { dist, time: 1200, feel: "ok", at: 1 } } });
const empty: SyncMeta = { dirty: {}, cursor: null };
type Dev = { state: State; meta: SyncMeta };

/** A tiny in-memory server: upsert by key, download rows newer than a cursor. */
function server() {
  const rows = new Map<string, Row>();
  let clock = 0;
  return {
    push(rs: Row[]) { for (const r of rs) rows.set(r.key, { ...r, updated_at: String(++clock).padStart(8, "0") }); },
    pull(cursor: string | null) { return [...rows.values()].filter((r) => !cursor || r.updated_at! > cursor); },
  };
}
/** One sync round for a device, as the app will run it: download, then upload. */
function sync(dev: Dev, srv: ReturnType<typeof server>): Dev {
  const got = applyRemote(dev.state, dev.meta, srv.pull(dev.meta.cursor));
  const rows = pendingRows(got.state, got.meta);
  srv.push(rows);
  return { state: got.state, meta: afterPush(got.meta, rows) };
}
function edit(dev: Dev, next: State, at: number): Dev {
  return { state: next, meta: markDirty(dev.meta, changedKeys(dev.state, next), at) };
}

describe("sync engine", () => {
  it("round-trips a state through entries", () => {
    let s = withLog(emptyState(), "1-0-c", 2);
    s = { ...s, settings: { name: "Sam", whys: ["a"] }, extras: { "1-5": [{ kind: "hike", dist: 3, time: 3600 }] } };
    const back = emptyState();
    for (const [k, v] of toEntries(s)) setEntry(back, k, v);
    expect(back).toEqual(s);
  });

  it("finds added, changed and removed entries", () => {
    const a = withLog(emptyState(), "1-0-c", 2);
    const b = withLog({ ...a, done: {}, logs: {} }, "1-1-c", 3);
    expect(changedKeys(a, b).sort()).toEqual(["done/1-0-c", "done/1-1-c", "logs/1-0-c", "logs/1-1-c"]);
  });

  it("two devices editing different things both keep their edits", () => {
    const srv = server();
    let phone: Dev = { state: emptyState(), meta: empty }, laptop: Dev = { state: emptyState(), meta: empty };
    phone = edit(phone, withLog(phone.state, "1-0-c", 2), 100);
    laptop = edit(laptop, { ...laptop.state, steps: { "1-0": 8000 } }, 101);
    phone = sync(phone, srv); laptop = sync(laptop, srv); phone = sync(phone, srv);
    for (const d of [phone, laptop]) {
      expect(d.state.logs["1-0-c"].dist).toBe(2);
      expect(d.state.steps["1-0"]).toBe(8000);
      expect(d.meta.dirty).toEqual({});
    }
  });

  it("the later edit of the same entry wins, whichever syncs first", () => {
    const srv = server();
    let phone: Dev = { state: emptyState(), meta: empty }, laptop: Dev = { state: emptyState(), meta: empty };
    phone = edit(phone, { ...phone.state, settings: { name: "Phone" } }, 200);
    laptop = edit(laptop, { ...laptop.state, settings: { name: "Laptop" } }, 100);
    phone = sync(phone, srv); laptop = sync(laptop, srv); phone = sync(phone, srv);
    expect(laptop.state.settings.name).toBe("Phone");
    expect(phone.state.settings.name).toBe("Phone");
  });

  it("deletes travel to other devices", () => {
    const srv = server();
    let phone: Dev = { state: emptyState(), meta: empty }, laptop: Dev = { state: emptyState(), meta: empty };
    phone = sync(edit(phone, withLog(phone.state, "1-0-c", 2), 1), srv);
    laptop = sync(laptop, srv);
    expect(laptop.state.done["1-0-c"]).toBe(1);
    phone = sync(edit(phone, { ...phone.state, done: {}, logs: {} }, 2), srv);
    laptop = sync(laptop, srv);
    expect(laptop.state.done).toEqual({});
    expect(laptop.state.logs).toEqual({});
  });

  it("turning sync on merges this device in without overwriting the account", () => {
    const srv = server();
    let phone: Dev = { state: { ...withLog(emptyState(), "1-0-c", 2), settings: { name: "Caleb" } }, meta: empty };
    phone = sync({ ...phone, meta: startMeta(phone.state) }, srv);
    // A second device that already had a different name and one log of its own.
    let laptop: Dev = { state: { ...withLog(emptyState(), "2-0-c", 3), settings: { name: "Old" } }, meta: empty };
    laptop = sync({ ...laptop, meta: startMeta(laptop.state) }, srv);
    phone = sync(phone, srv);
    for (const d of [phone, laptop]) {
      expect(d.state.settings.name).toBe("Caleb");
      expect(Object.keys(d.state.done).sort()).toEqual(["1-0-c", "2-0-c"]);
    }
  });

  it("keeps an edit made while an upload was in flight", () => {
    let dev = edit({ state: emptyState(), meta: empty }, { ...emptyState(), steps: { "1-0": 100 } }, 1);
    const rows = pendingRows(dev.state, dev.meta);
    dev = edit(dev, { ...dev.state, steps: { "1-0": 200 } }, 2);
    expect(afterPush(dev.meta, rows).dirty).toEqual({ "steps/1-0": 2 });
  });

  it("ignores rows it doesn't understand", () => {
    const got = applyRemote(emptyState(), empty, [{ key: "future/x", value: 1, deleted: false, edited_at: 1, updated_at: "1" }]);
    expect(got.changed).toBe(false);
    expect(got.meta.cursor).toBe("1");
  });
});
