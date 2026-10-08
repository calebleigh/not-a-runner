import { describe, expect, it } from "vitest";
import { QUOTES, quoteForWeek } from "./quotes";

describe("quotes", () => {
  it("has one for every week of the plan", () => {
    expect(QUOTES.length).toBe(52);
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(52);
  });

  it("follows the copy rules: no em dashes, every quote credited", () => {
    for (const q of QUOTES) {
      expect(q.text + q.by).not.toMatch(/—/);
      expect(q.by.trim()).not.toBe("");
    }
  });

  it("changes each week and cycles past the end", () => {
    expect(quoteForWeek(1)).toBe(QUOTES[0]);
    expect(quoteForWeek(2)).toBe(QUOTES[1]);
    expect(quoteForWeek(53)).toBe(QUOTES[0]);
    expect(quoteForWeek(0)).toBe(QUOTES[0]);
  });
});
