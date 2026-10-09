import { describe, expect, it } from "vitest";
import { cardIsToday, computeModel, emptyState, friendCard, newInviteCode, parseInviteCode } from "./index";

const NOW = new Date(2026, 9, 14, 18); // Wed Oct 14, week 2

describe("friend card", () => {
  it("shares first name, streak, today's session and totals only", () => {
    const s = emptyState();
    s.done["2-2-c"] = 1; s.logs["2-2-c"] = { dist: 2, time: 1500, at: 1 };
    s.steps["2-2"] = 6000;
    s.weights["2"] = 210;
    const m = computeModel(s, NOW), c = friendCard(m, { name: "Caleb Leigh", photo: "p.jpg" });
    expect(c.name).toBe("Caleb");
    expect(c.today.day).toBe("2026-10-14");
    expect(c.today.done).toBe(true);
    expect(c.totals).toEqual({ steps: 6000, miles: 2, hours: 0.4 });
    expect(JSON.stringify(c)).not.toContain("210");
    expect(cardIsToday(c, NOW)).toBe(true);
    expect(cardIsToday(c, new Date(2026, 9, 15))).toBe(false);
  });
  it("counts a rest day as done", () => {
    const m = computeModel(emptyState(), NOW), c = friendCard(m, { name: "" });
    expect(c.name).toBe("Friend");
    if (c.today.rest) expect(c.today.done).toBe(true);
    else expect(c.today.done).toBe(false);
  });
});

describe("invite codes", () => {
  it("makes 8-character codes without look-alikes", () => {
    const c = newInviteCode();
    expect(c).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });
  it("reads a code from typing or a pasted link", () => {
    expect(parseInviteCode("abcd efgh")).toBe("ABCDEFGH");
    expect(parseInviteCode("https://not-a-runner.vercel.app/?invite=K7QM2XRP")).toBe("K7QM2XRP");
    expect(parseInviteCode("ABC")).toBeNull();
    expect(parseInviteCode("ABCDEFG0")).toBeNull();
  });
});
