export function hms(sec: number): string {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
export const pace = (t: number, d: number) => `${hms(t / d)}/mi`;
export const mph = (t: number, d: number) => `${(d / (t / 3600)).toFixed(1)} mph`;
export const kfmt = (v: number) => (v >= 100000 ? `${Math.round(v / 1000)}k` : v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString("en-US"));
export const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const fmtLong = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export const FEEL = { easy: "Easy", ok: "Just right", hard: "Too hard" } as const;
export const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const LONGDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
