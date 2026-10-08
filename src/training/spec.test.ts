import { describe, expect, it } from "vitest";
import { OWNER_PROFILE, buildSpec, decodeBackup, emptyState, encodeBackup, mergeState, needsOnboarding, onboardingStart, specOf } from "./index";

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

  it("maps the owner's plan one-to-one onto the template", () => {
    const s = specOf(emptyState());
    expect(s.canon).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
    expect(s.phases.map((p) => [p.from, p.to])).toEqual([[1, 13], [14, 26], [27, 39], [40, 52]]);
    for (let n = 1; n <= 51; n++) expect(s.slots[n - 1]).toEqual([0, 1, 2, 3, 4].map((d) => ({ d, role: d })));
    expect(s.slots[51]).toEqual([...[0, 1, 2, 3, 4].map((d) => ({ d, role: d })), { d: 5, role: -1 }]);
    expect(s.warnings).toEqual([]);
  });
});

describe("onboarding helpers", () => {
  it("starts this week on Monday or Tuesday, otherwise next Monday", () => {
    expect(onboardingStart(new Date(2026, 9, 6)).toDateString()).toBe("Mon Oct 05 2026");
    expect(onboardingStart(new Date(2026, 9, 7)).toDateString()).toBe("Mon Oct 12 2026");
    expect(onboardingStart(new Date(2026, 9, 11)).toDateString()).toBe("Mon Oct 12 2026");
  });

  it("only onboards brand-new users", () => {
    const s = emptyState();
    expect(needsOnboarding(s)).toBe(true);
    s.steps["1-0"] = 5000;
    expect(needsOnboarding(s)).toBe(false);
    const t = emptyState();
    t.plan = { profile: OWNER_PROFILE };
    expect(needsOnboarding(t)).toBe(false);
  });
});
