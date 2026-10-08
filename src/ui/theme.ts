import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
// Accent themes: a gradient (light end, dark end) becomes the app's accent colors.
// The default is the original orange and leaves the CSS tokens untouched.

export interface Accent { hi: string; lo: string }

export interface Preset extends Accent { name: string; mid: string }

export const PRESETS: Preset[] = [
  { name: "Blaze", hi: "#FF7B7B", mid: "#F24848", lo: "#C92A2A" },
  { name: "Ember", hi: "#FF8A3D", mid: "#FF6A13", lo: "#E5540A" },
  { name: "Sunrise", hi: "#FFE066", mid: "#FCC419", lo: "#F08C00" },
  { name: "Lime", hi: "#8CE99A", mid: "#40C057", lo: "#2B8A3E" },
  { name: "Ocean", hi: "#74C0FC", mid: "#339AF0", lo: "#1971C2" },
  { name: "Violet", hi: "#D6B0FF", mid: "#AB7BFF", lo: "#7B3FE0" },
  { name: "Steel", hi: "#FFFFFF", mid: "#D6D1C9", lo: "#8F8A84" },
];
export const DEFAULT_PRESET = PRESETS[1];

const PAPER = "#111110", INK = "#F4F1EC", DARK_TEXT = "#141210";
/** Light mode background (matches --paper under [data-mode="light"]). */
export const LIGHT_PAPER = "#F6F3EE";

type RGB = [number, number, number];
const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: unknown): s is string => typeof s === "string" && HEX.test(s);

export function toRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const toHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();

/** a blended toward b by t (0 = a, 1 = b). */
export const mix = (a: string, b: string, t: number) => {
  const A = toRgb(a), B = toRgb(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
};

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Hue in degrees (0 to 360). */
export function hue(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Red accents would hide red warnings, so those themes warn in amber instead. */
const WARN_AMBER = { bad: "#FFB020", soft: "#3A2B0E" };
const WARN_AMBER_LIGHT = { bad: "#B26A00", soft: "#FBEBD3" };

/** Darkens a color just enough to reach a contrast ratio against a background. */
export function darkenTo(hex: string, bg: string, ratio: number): string {
  for (let t = 0; t <= 1; t += 0.04) {
    const c = mix(hex, "#000000", t);
    if (contrast(c, bg) >= ratio) return c;
  }
  return "#000000";
}
export const isReddish = (hex: string) => { const h = hue(hex); return h <= 12 || h >= 340; };

export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const sameAccent = (a: Accent, b: Accent) => a.hi.toUpperCase() === b.hi.toUpperCase() && a.lo.toUpperCase() === b.lo.toUpperCase();
export const presetFor = (a: Accent) => PRESETS.find((p) => sameAccent(p, a));

/**
 * CSS custom properties for an accent; the empty object for the default in dark mode (stylesheet
 * values stay). Light mode always sets them: tints are mixed with the light background, and pale
 * accents (Sunrise, Steel) are darkened so they stay readable on it.
 */
export function themeVars(a: Accent | undefined, light = false): Record<string, string> {
  const valid = !!a && isHex(a.hi) && isHex(a.lo);
  if (light) return lightVars(valid ? a! : DEFAULT_PRESET);
  if (!valid || sameAccent(a!, DEFAULT_PRESET)) return {};
  a = a!;
  const mid = presetFor(a)?.mid ?? mix(a.hi, a.lo, 0.5);
  const on = contrast(mid, DARK_TEXT) >= contrast(mid, INK) ? DARK_TEXT : INK;
  return {
    "--accent": mid,
    "--accent-hi": a.hi,
    "--accent-lo": a.lo,
    "--accent-soft": mix(PAPER, mid, 0.17),
    "--accent-rgb": toRgb(mid).join(","),
    "--sky": a.hi,
    "--sky-soft": mix(PAPER, mid, 0.09),
    "--on-accent": on,
    ...(isReddish(mid) ? { "--bad": WARN_AMBER.bad, "--bad-soft": WARN_AMBER.soft } : {}),
  };
}

function lightVars(a: Accent): Record<string, string> {
  const base = presetFor(a)?.mid ?? mix(a.hi, a.lo, 0.5);
  const mid = darkenTo(base, LIGHT_PAPER, 3);
  const hi = darkenTo(a.hi, LIGHT_PAPER, 2), lo = darkenTo(a.lo, LIGHT_PAPER, 3);
  const on = contrast(mid, DARK_TEXT) >= contrast(mid, "#FFFFFF") ? DARK_TEXT : "#FFFFFF";
  return {
    "--accent": mid,
    "--accent-hi": hi,
    "--accent-lo": lo,
    "--accent-soft": mix(LIGHT_PAPER, mid, 0.14),
    "--accent-rgb": toRgb(mid).join(","),
    "--sky": hi,
    "--sky-soft": mix(LIGHT_PAPER, mid, 0.07),
    "--on-accent": on,
    ...(isReddish(mid) ? { "--bad": WARN_AMBER_LIGHT.bad, "--bad-soft": WARN_AMBER_LIGHT.soft } : {}),
  };
}

/** Dark (the default), light, or follow the phone's setting. */
export type Mode = "dark" | "light" | "system";
export const isLight = (mode: Mode | undefined) =>
  mode === "light" || (mode === "system" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches);

/** Sets light or dark on the page, including the browser's bar color. */
export function applyMode(light: boolean, root: HTMLElement = document.documentElement) {
  root.dataset.mode = light ? "light" : "dark";
  // Android app: status and gesture bar icons dark on light, light on dark.
  if (Capacitor.isNativePlatform()) SystemBars.setStyle({ style: light ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
  // Remembered so the next launch starts in the right mode before the app loads (see index.html).
  try { localStorage.setItem("mode", light ? "light" : "dark"); } catch { /* blocked */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? LIGHT_PAPER : PAPER);
}

export type Shape = "round" | "square";

/** Squared (the default) caps every corner at one radius and uses the square logo; rounded uses full corners and the round logo. */
export function applyShape(shape: Shape | undefined, root: HTMLElement = document.documentElement) {
  const round = shape === "round";
  root.dataset.shape = round ? "round" : "square";
  if (round) { root.style.setProperty("--rmax", "999px"); root.style.setProperty("--rc", "50%"); }
  else { root.style.removeProperty("--rmax"); root.style.removeProperty("--rc"); }
}

const KEYS = ["--accent", "--accent-hi", "--accent-lo", "--accent-soft", "--accent-rgb", "--sky", "--sky-soft", "--on-accent", "--bad", "--bad-soft"];

export function applyAccent(a: Accent | undefined, light = false, root: HTMLElement = document.documentElement) {
  const vars = themeVars(a, light);
  for (const k of KEYS) {
    if (vars[k]) root.style.setProperty(k, vars[k]);
    else root.style.removeProperty(k);
  }
}
