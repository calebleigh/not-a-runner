import { describe, expect, it } from "vitest";
import { computeModel, emptyState, notifications } from "./index";

const WEEK3 = new Date(2026, 9, 21, 9); // Wed of week 3 (plan started Mon Oct 5)

describe("notifications", () => {
  it("lists missed sessions this week, with a Log button for that day", () => {
    const s = emptyState();
    s.done["3-0-c"] = 1;
    const n = notifications(computeModel(s, WEEK3), WEEK3);
    const missed = n.filter((x) => x.text.startsWith("Missed "));
    expect(missed.map((x) => x.text.slice(0, 11))).toEqual(["Missed Tue:"]);
    expect(missed[0].action).toEqual({ label: "Log", to: { type: "day", w: 3, d: 1 } });
    expect(n.find((x) => x.text.startsWith("Strength not logged for"))?.text).toBe("Strength not logged for Mon and Tue");
  });

  it("rolls missing steps into one note and opens the latest day", () => {
    const s = emptyState();
    s.steps["2-6"] = 5000; // Sun Oct 18
    const n = notifications(computeModel(s, WEEK3), WEEK3);
    const steps = n.find((x) => x.text.startsWith("No steps logged"))!;
    expect(steps.text).toBe("No steps logged for Wed, Thu, Fri, Sat, Mon and yesterday");
    expect(steps.action!.to).toEqual({ type: "steps", date: new Date(2026, 9, 20) });
    expect(n.some((x) => x.text === "You haven't logged yesterday's steps.")).toBe(false);
  });

  it("mentions a day under the step goal and a missing weigh-in", () => {
    const s = emptyState();
    s.settings.stepGoal = 8000;
    s.steps["3-1"] = 6200;
    const texts = notifications(computeModel(s, WEEK3), WEEK3).map((x) => x.text);
    expect(texts).toContain("Yesterday: 6,200 of 8,000 steps");
    expect(texts).toContain("No weigh-in this week yet");
    s.weights["3"] = 195;
    s.steps["3-1"] = 9000;
    const after = notifications(computeModel(s, WEEK3), WEEK3).map((x) => x.text);
    expect(after.some((t) => t.startsWith("Yesterday:") || t.startsWith("No weigh-in"))).toBe(false);
  });

  it("includes to-dos that are overdue or due today", () => {
    const s = emptyState();
    s.todos.pt = { text: "PT visit", at: 1, due: "2026-10-21" };
    s.todos.later = { text: "Book hotel", at: 2, due: "2026-12-01" };
    const texts = notifications(computeModel(s, WEEK3), WEEK3).map((x) => x.text);
    expect(texts).toContain("Due today: PT visit");
    expect(texts.some((t) => t.startsWith("Overdue: Bike"))).toBe(true);
    expect(texts.some((t) => t.includes("Book hotel"))).toBe(false);
  });

  it("says nothing about missed things before the plan starts", () => {
    const before = new Date(2026, 9, 1, 9);
    expect(notifications(computeModel(emptyState(), before), before).filter((x) => x.kind === "missed")).toEqual([]);
  });

  it("keys stay the same within a day and change the next day", () => {
    const s = emptyState();
    const keys = (d: Date) => notifications(computeModel(s, d), d).map((x) => x.key);
    const a = keys(WEEK3), b = keys(new Date(2026, 9, 21, 15)), c = keys(new Date(2026, 9, 22, 9));
    expect(b.filter((k) => !k.includes("End of the day"))).toEqual(a);
    expect(c.some((k) => a.includes(k))).toBe(false);
  });
});
