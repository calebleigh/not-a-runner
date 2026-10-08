import { describe, expect, it } from "vitest";
import { computeModel, emptyState, todoLists } from "./index";

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
});
