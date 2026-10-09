import { useEffect, useRef, useState, type CSSProperties } from "react";
import { kfmt } from "../training";

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that counts up when it first appears. */
export function Num({ value, dec = 0, k = false, comma = false }: { value: number; dec?: number; k?: boolean; comma?: boolean }) {
  const show = (v: number) => (k ? kfmt(Math.round(v)) : comma ? Math.round(v).toLocaleString("en-US") : v.toFixed(dec));
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const n = ref.current;
    if (!n) return;
    if (!first.current || reducedMotion() || !isFinite(value)) { n.textContent = show(value); return; }
    first.current = false;
    const t0 = performance.now(), dur = 750;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      n.textContent = show(value * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dec, k, comma]);
  return <span ref={ref}>{show(value)}</span>;
}

/** Fill element that grows from 0 to `pct` after mount (CSS transitions do the motion). */
export function Grow({ pct, dir = "w", style }: { pct: number; dir?: "w" | "h"; style?: CSSProperties }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const v = `${on ? pct : 0}%`;
  return <i style={{ ...style, [dir === "w" ? "width" : "height"]: v }} />;
}
