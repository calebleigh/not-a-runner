import { describe, expect, it } from "vitest";
import { birthdayInfo, parseBirthday } from "./profile";

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
});
