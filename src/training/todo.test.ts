import { describe, expect, it } from "vitest";
import { computeModel, emptyState, todoLists, upNext } from "./index";

const WEEK3 = new Date(2026, 9, 21); // Wed of week 3

describe("to-do list", () => {
  it("puts gear that's due first, then your items, then gear due soon", () => {
    const s = emptyState();
    s.todos.a = { text: "PT visit", at: 2 };
    s.todos.b = { text: "Healthier snacks", at: 1 };
    const { now, later } = todoLists(computeModel(s, WEEK3));
    const kinds = now.map((x) => x.kind);
    expect(kinds.indexOf("custom")).toBeGreaterThan(0);
    expect(now.filter((x) => x.kind === "custom").map((x) => x.text)).toEqual(["Healthier snacks", "PT visit"]);
    expect(now.filter((x) => x.kind === "gear").every((g) => g.gear!.week <= 5)).toBe(true);
    expect(now.find((x) => x.status === "overdue")?.kind).toBe("gear");
    expect(later.every((g) => g.gear!.week > 5)).toBe(true);
  });

  it("moves checked items to done, newest first, with owned gear", () => {
    const s = emptyState();
    s.todos.a = { text: "PT visit", at: 1, done: 50 };
    s.todos.b = { text: "Snacks", at: 2, done: 90 };
    s.gear.helmet = 1;
    const { now, done } = todoLists(computeModel(s, WEEK3));
    expect(done.map((x) => x.text).slice(0, 2)).toEqual(["Snacks", "PT visit"]);
    expect(done.some((x) => x.key === "g:helmet")).toBe(true);
    expect(now.some((x) => x.key === "g:helmet" || x.kind === "custom")).toBe(false);
  });

  it("covers every gear item exactly once", () => {
    const { now, later, done } = todoLists(computeModel(emptyState(), WEEK3));
    const keys = [...now, ...later, ...done].map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(16);
  });

  it("sorts dated items in with the gear, and holds far-off ones for later", () => {
    const s = emptyState();
    s.todos.pt = { text: "PT visit", at: 1, due: "2026-10-23" }; // in 2 days
    s.todos.old = { text: "Call the doctor", at: 2, due: "2026-10-19" }; // 2 days ago
    s.todos.far = { text: "Book race hotel", at: 3, due: "2027-03-01" };
    s.todos.any = { text: "Healthier snacks", at: 4 };
    const { now, later } = todoLists(computeModel(s, WEEK3));
    const at = (t: string) => now.findIndex((x) => x.text === t);
    expect(now.find((x) => x.text === "Call the doctor")!.status).toBe("overdue");
    expect(now.find((x) => x.text === "PT visit")!.status).toBe("due");
    expect(at("Call the doctor")).toBeLessThan(at("PT visit"));
    expect(at("PT visit")).toBeLessThan(at("Healthier snacks"));
    expect(later.map((x) => x.text)).toContain("Book race hotel");
    expect(now.some((x) => x.text === "Book race hotel")).toBe(false);
  });
});

describe("what the card shows", () => {
  it("tops up from later so there are always at least four", () => {
    const s = emptyState();
    for (const k of ["helmet", "tuneup", "bottle", "lights", "mat"]) s.gear[k] = 1;
    const lists = todoLists(computeModel(s, WEEK3));
    const { shown, rest } = upNext(lists, 4);
    expect(shown.length).toBe(4);
    expect(shown.slice(0, lists.now.length)).toEqual(lists.now);
    expect(rest.length).toBe(lists.later.length - (4 - lists.now.length));
  });

  it("shows everything open when there's more than four, and nothing when the list is empty", () => {
    const s = emptyState();
    for (let i = 0; i < 6; i++) s.todos[`t${i}`] = { text: `Item ${i}`, at: i };
    const lists = todoLists(computeModel(s, WEEK3));
    expect(upNext(lists).shown.length).toBe(lists.now.length);
    expect(upNext({ now: [], later: [], done: [] }).shown).toEqual([]);
  });
});
