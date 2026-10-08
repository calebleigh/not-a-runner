import { describe, expect, it } from "vitest";
import { decodeBackup, emptyState, encodeBackup, mergeState } from "./index";
import type { State } from "./types";

// How the prototype encoded backups.
const legacyEncode = (o: object) => "SGH1." + btoa(unescape(encodeURIComponent(JSON.stringify(o))));

function sample(): State {
  const s = emptyState();
  s.done["1-0-c"] = 1;
  s.logs["1-0-c"] = { dist: 2.1, time: 1500, feel: "ok", at: 1, hr: 131 };
  s.settings.name = "Zoë";
  s.extras["1-5"] = [{ kind: "walk", dist: 1.5, time: 1800, label: "Hike ⛰" }];
  s.steps["1-0"] = 8123;
  return s;
}

describe("backup", () => {
  it("round-trips", () => {
    expect(decodeBackup(encodeBackup(sample()))).toEqual(sample());
  });

  it("produces the same code as the prototype", () => {
    const s = sample();
    expect(encodeBackup(s)).toBe(legacyEncode({ v: 1, done: s.done, logs: s.logs, gear: s.gear, swaps: s.swaps, weights: s.weights, settings: s.settings, extras: s.extras, steps: s.steps }));
  });

  it("reads old codes that are missing newer sections", () => {
    const s = decodeBackup(legacyEncode({ v: 1, done: { "2-1-c": 1 }, gear: { shoes: 1 } }));
    expect(s.done).toEqual({ "2-1-c": 1 });
    expect(s.gear).toEqual({ shoes: 1 });
    expect(s.extras).toEqual({});
    expect(s.steps).toEqual({});
  });

  it("tolerates whitespace from copy and paste", () => {
    const code = encodeBackup(sample());
    expect(decodeBackup(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)).toEqual(sample());
  });

  it("rejects bad codes", () => {
    expect(() => decodeBackup("hello")).toThrow();
    expect(() => decodeBackup("SGH1.!!!")).toThrow();
    expect(() => decodeBackup("SGH1." + btoa("[1,2]"))).toThrow();
  });

  it("merges without erasing", () => {
    const base = sample();
    const inc = emptyState();
    inc.done["3-0-c"] = 1;
    inc.steps["1-0"] = 9000;
    inc.extras["1-5"] = [{ kind: "walk", dist: 1.5, time: 1800, label: "Hike ⛰" }, { kind: "bike", dist: 5, time: 1800 }];
    const m = mergeState(base, inc);
    expect(m.done).toEqual({ "1-0-c": 1, "3-0-c": 1 });
    expect(m.logs).toEqual(base.logs);
    expect(m.steps["1-0"]).toBe(9000);
    expect(m.extras["1-5"]).toHaveLength(2);
    expect(m.settings.name).toBe("Zoë");
  });
});

describe("to-do backups", () => {
  it("carries the to-do list through a backup and a merge", () => {
    const s = emptyState();
    s.todos.a = { text: "PT visit", at: 1 };
    const back = decodeBackup(encodeBackup(s));
    expect(back.todos).toEqual({ a: { text: "PT visit", at: 1 } });
    const other = emptyState();
    other.todos.b = { text: "Healthier snacks", at: 2, done: 3 };
    expect(Object.keys(mergeState(back, other).todos).sort()).toEqual(["a", "b"]);
  });
});
