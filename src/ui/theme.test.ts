import { describe, expect, it } from "vitest";
import { PRESETS, contrast, isHex, mix, themeVars, toHex, toRgb } from "./theme";

describe("theme", () => {
  it("round-trips hex colors", () => {
    expect(toHex(toRgb("#FF6A13"))).toBe("#FF6A13");
    expect(isHex("#abcdef")).toBe(true);
    expect(isHex("orange")).toBe(false);
  });

  it("mixes colors", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#FF0000", "#0000FF", 0)).toBe("#FF0000");
  });

  it("leaves the default orange to the stylesheet", () => {
    expect(themeVars(undefined)).toEqual({});
    expect(themeVars({ hi: "#ff8a3d", lo: "#e5540a" })).toEqual({});
  });

  it("ignores bad values", () => {
    expect(themeVars({ hi: "red", lo: "#000000" })).toEqual({});
  });

  it("uses a preset's own middle color", () => {
    const ocean = PRESETS.find((p) => p.name === "Ocean")!;
    expect(themeVars(ocean)["--accent"]).toBe(ocean.mid);
  });

  it("keeps text on the accent readable for every preset and for dark custom colors", () => {
    for (const p of PRESETS.slice(1)) {
      const v = themeVars(p);
      expect(contrast(v["--accent"], v["--on-accent"])).toBeGreaterThanOrEqual(4.5);
    }
    const dark = themeVars({ hi: "#3A4A8C", lo: "#1B2250" });
    expect(dark["--on-accent"]).toBe("#F4F1EC");
  });
});
