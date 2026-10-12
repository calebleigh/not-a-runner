// A date picked on three scrolling wheels (month, day, year), like a phone's clock app. Each wheel
// snaps to a row; the middle row is the pick. Used for birthdays.
import { useEffect, useRef } from "react";

const ROW = 40;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();
const todayYmd = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };

/** "YYYY-MM-DD" parts, or null. */
export function ymdParts(v: string): [number, number, number] | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** "Mar 4, 1990" */
export function fmtBirthday(v: string): string {
  const p = ymdParts(v);
  return p ? `${MONTHS[p[1] - 1]} ${p[2]}, ${p[0]}` : "";
}

function Wheel({ items, value, onChange, label }: { items: { v: number; t: string }[]; value: number; onChange: (v: number) => void; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, items.findIndex((x) => x.v === value));
  const settle = useRef<number | undefined>(undefined);
  // Keep the wheel on the value when it changes from outside (or the list changes, like days in a month).
  useEffect(() => {
    const w = el.current;
    if (w && Math.round(w.scrollTop / ROW) !== idx) w.scrollTop = idx * ROW;
  }, [idx, items.length]);
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const w = el.current;
      if (!w) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(w.scrollTop / ROW)));
      if (items[i].v !== value) onChange(items[i].v);
    }, 90);
  };
  const go = (i: number) => el.current?.scrollTo({ top: i * ROW, behavior: "smooth" });
  return (
    <div className="dw-col" ref={el} onScroll={onScroll} role="listbox" aria-label={label} tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); onChange(items[Math.min(items.length - 1, idx + 1)].v); }
        if (e.key === "ArrowUp") { e.preventDefault(); onChange(items[Math.max(0, idx - 1)].v); }
      }}>
      {items.map((x, i) => (
        <div key={x.v} role="option" aria-selected={i === idx} className={"dw-row" + (i === idx ? " on" : "")} onClick={() => go(i)}>{x.t}</div>
      ))}
    </div>
  );
}

/** Picks "YYYY-MM-DD". Shows `fallback` (today, unless given) until something is picked. */
export function DateWheels({ value, onChange, fallback = todayYmd(), maxYear = new Date().getFullYear(), years = 100 }: {
  value: string; onChange: (v: string) => void; fallback?: string; maxYear?: number; years?: number;
}) {
  const [y, m, d] = ymdParts(value) ?? ymdParts(fallback)!;
  const set = (ny: number, nm: number, nd: number) => onChange(`${ny}-${pad(nm)}-${pad(Math.min(nd, daysIn(ny, nm)))}`);
  const yearItems = Array.from({ length: years + 1 }, (_, i) => maxYear - years + i).map((v) => ({ v, t: String(v) }));
  const monthItems = MONTHS.map((t, i) => ({ v: i + 1, t }));
  const dayItems = Array.from({ length: daysIn(y, m) }, (_, i) => ({ v: i + 1, t: String(i + 1) }));
  return (
    <div className="dw">
      <span className="dw-band" aria-hidden="true" />
      <Wheel label="Month" items={monthItems} value={m} onChange={(v) => set(y, v, d)} />
      <Wheel label="Day" items={dayItems} value={Math.min(d, daysIn(y, m))} onChange={(v) => set(y, m, v)} />
      <Wheel label="Year" items={yearItems} value={y} onChange={(v) => set(v, m, d)} />
    </div>
  );
}
