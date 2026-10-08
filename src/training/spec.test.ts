import { describe, expect, it } from "vitest";
import { OWNER_PROFILE, buildSpec, decodeBackup, emptyState, encodeBackup, mergeState, specOf } from "./index";

describe("plan spec", () => {
  it("uses the owner's plan when no profile is saved", () => {
    const s = specOf(emptyState());
    expect(s.profile).toEqual(OWNER_PROFILE);
    expect(s.weeks).toBe(52);
    expect(s.start.toDateString()).toBe("Mon Oct 05 2026");
    expect(s.race?.toDateString()).toBe("Sat Oct 02 2027");
    expect(s.raceDay).toBe(5);
    expect(s.mileTests).toEqual([14, 27, 40, 49]);
  });

  it("builds the same spec for the same profile", () => {
    expect(buildSpec({ ...OWNER_PROFILE })).toEqual(buildSpec(OWNER_PROFILE));
  });

  it("keeps the profile through a backup", () => {
    const st = emptyState();
    st.plan = { profile: { ...OWNER_PROFILE, raceName: "Test Race" } };
    expect(decodeBackup(encodeBackup(st)).plan?.profile.raceName).toBe("Test Race");
  });

  it("replaces the profile on import instead of mixing fields", () => {
    const base = emptyState(), inc = emptyState();
    base.plan = { profile: { ...OWNER_PROFILE, raceName: "Old" } };
    inc.plan = { profile: { ...OWNER_PROFILE, raceName: "New", days: [1, 3, 5] } };
    expect(mergeState(base, inc).plan?.profile).toEqual(inc.plan.profile);
    expect(mergeState(base, emptyState()).plan).toEqual(base.plan);
    expect(mergeState(emptyState(), emptyState()).plan).toBeUndefined();
  });
});
