// Accent themes: a gradient (light end, dark end) becomes the app's accent colors.
// The default is the original orange and leaves the CSS tokens untouched.

export interface Accent { hi: string; lo: string }

export interface Preset extends Accent { name: string; mid: string }

export const PRESETS: Preset[] = [
  { name: "Ember", hi: "#FF8A3D", mid: "#FF6A13", lo: "#E5540A" },
  { name: "Sunrise", hi: "#FFC94A", mid: "#FFA21F", lo: "#F07C0F" },
  { name: "Blaze", hi: "#FF7A59", mid: "#F2483A", lo: "#C9252F" },
  { name: "Rose", hi: "#FF8FC0", mid: "#FF5C9E", lo: "#E0357A" },
  { name: "Violet", hi: "#B9A2FF", mid: "#8E6BFF", lo: "#6A3FE8" },
  { name: "Ocean", hi: "#6FD0FF", mid: "#36A3F5", lo: "#1F6FE0" },
  { name: "Mint", hi: "#7EF5C8", mid: "#3FDDA6", lo: "#16B387" },
  { name: "Lime", hi: "#D4F53C", mid: "#B3E12A", lo: "#7FB81E" },
];
export const DEFAULT_PRESET = PRESETS[0];

const PAPER = "#111110", INK = "#F4F1EC", DARK_TEXT = "#141210";

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
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const sameAccent = (a: Accent, b: Accent) => a.hi.toUpperCase() === b.hi.toUpperCase() && a.lo.toUpperCase() === b.lo.toUpperCase();
export const presetFor = (a: Accent) => PRESETS.find((p) => sameAccent(p, a));

/** CSS custom properties for an accent; the empty object for the default (stylesheet values stay). */
export function themeVars(a: Accent | undefined): Record<string, string> {
  if (!a || !isHex(a.hi) || !isHex(a.lo) || sameAccent(a, DEFAULT_PRESET)) return {};
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
  };
}

const KEYS = ["--accent", "--accent-hi", "--accent-lo", "--accent-soft", "--accent-rgb", "--sky", "--sky-soft", "--on-accent"];

export function applyAccent(a: Accent | undefined, root: HTMLElement = document.documentElement) {
  const vars = themeVars(a);
  for (const k of KEYS) {
    if (vars[k]) root.style.setProperty(k, vars[k]);
    else root.style.removeProperty(k);
  }
}
