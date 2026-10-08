import { describe, expect, it } from "vitest";
import { computeModel, emptyState, notifications } from "./index";

const WEEK3 = new Date(2026, 9, 21, 9); // Wed of week 3

describe("notifications", () => {
  it("lists today's nudges and to-dos that are overdue or due today", () => {
    const s = emptyState();
    s.todos.pt = { text: "PT visit", at: 1, due: "2026-10-21" };
    s.todos.later = { text: "Book hotel", at: 2, due: "2026-12-01" };
    const n = notifications(computeModel(s, WEEK3), WEEK3);
    const texts = n.map((x) => x.text);
    expect(texts).toContain("You haven't logged yesterday's steps.");
    expect(texts).toContain("Due today: PT visit");
    expect(texts.some((t) => t.startsWith("Overdue: Bike"))).toBe(true);
    expect(texts.some((t) => t.includes("Book hotel"))).toBe(false);
  });

  it("keys stay the same within a day and change the next day", () => {
    const s = emptyState();
    const a = notifications(computeModel(s, WEEK3), WEEK3).map((x) => x.key);
    const b = notifications(computeModel(s, new Date(2026, 9, 21, 15)), new Date(2026, 9, 21, 15)).map((x) => x.key);
    const c = notifications(computeModel(s, new Date(2026, 9, 22, 9)), new Date(2026, 9, 22, 9)).map((x) => x.key);
    expect(b).toEqual(a);
    expect(c.some((k) => a.includes(k))).toBe(false);
  });
});
