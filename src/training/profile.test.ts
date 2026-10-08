import { describe, expect, it } from "vitest";
import { birthdayInfo, formatWhy, isBirthdayOn, parseBirthday, whyForDay, whyList } from "./profile";

describe("birthday", () => {
  it("parses only real dates", () => {
    expect(parseBirthday("1990-06-15")).toEqual({ y: 1990, m: 5, d: 15 });
    expect(parseBirthday("1990-02-30")).toBeNull();
    expect(parseBirthday("June 15")).toBeNull();
    expect(parseBirthday(undefined)).toBeNull();
  });

  it("knows the age and days until the next birthday", () => {
    expect(birthdayInfo("1990-06-15", new Date(2027, 5, 10))).toEqual({ age: 36, daysUntil: 5, isToday: false, turning: 37 });
    expect(birthdayInfo("1990-06-15", new Date(2027, 5, 16))).toMatchObject({ age: 37, daysUntil: 365, turning: 38 });
  });

  it("celebrates on the day", () => {
    expect(birthdayInfo("1990-10-07", new Date(2026, 9, 7, 15))).toEqual({ age: 36, daysUntil: 0, isToday: true, turning: 36 });
  });

  it("celebrates leap-day birthdays on Feb 28 in other years", () => {
    expect(birthdayInfo("1992-02-29", new Date(2027, 1, 28))).toMatchObject({ isToday: true, age: 35 });
    expect(birthdayInfo("1992-02-29", new Date(2028, 1, 29))).toMatchObject({ isToday: true, age: 36 });
  });

  it("ignores birthdays in the future", () => {
    expect(birthdayInfo("2030-01-01", new Date(2026, 9, 7))).toBeNull();
  });

  it("finds the birthday on any date", () => {
    expect(isBirthdayOn("1990-10-07", new Date(2027, 9, 7))).toBe(true);
    expect(isBirthdayOn("1990-10-07", new Date(2027, 9, 8))).toBe(false);
    expect(isBirthdayOn("1992-02-29", new Date(2027, 1, 28))).toBe(true);
    expect(isBirthdayOn("1992-02-29", new Date(2028, 1, 28))).toBe(false);
    expect(isBirthdayOn(undefined, new Date(2027, 9, 7))).toBe(false);
  });
});

describe("your why", () => {
  it("splits an older single line into reasons", () => {
    expect(whyList({ why: "For my kids, For my health," })).toEqual(["For my kids", "For my health"]);
    expect(whyList({ why: "For my kids", whys: ["Lose weight"] })).toEqual(["Lose weight"]);
    expect(whyList({})).toEqual([]);
  });

  it("writes each reason as a sentence", () => {
    expect(formatWhy("for my kids")).toBe("For my kids.");
    expect(formatWhy("Prove I can!")).toBe("Prove I can!");
    expect(formatWhy("  lose   weight ")).toBe("Lose weight.");
  });

  it("rotates one reason a day, steady within the day", () => {
    const s = { whys: ["a", "b", "c"] };
    const days = [0, 1, 2, 3].map((i) => whyForDay(s, new Date(2026, 9, 8 + i, 7)));
    expect(new Set(days.slice(0, 3)).size).toBe(3);
    expect(days[3]).toBe(days[0]);
    expect(whyForDay(s, new Date(2026, 9, 8, 23))).toBe(days[0]);
    expect(whyForDay({}, new Date())).toBeNull();
  });
});
