// A short log of what the tracker saw (steps, ticks, pauses and why), kept on this phone so a
// confusing workout can be copied from Settings and looked at. Only the latest entries are kept.
const KEY = "trackLog";
const MAX = 400;

let lines: string[] | null = null;
function all(): string[] {
  if (lines) return lines;
  try { lines = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { lines = []; }
  return (lines = Array.isArray(lines) ? lines : []);
}

/** Adds a line: the time of day, then what happened. */
export function logTrack(what: string) {
  const d = new Date(), pad = (n: number) => String(n).padStart(2, "0");
  const l = all();
  l.push(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${what}`);
  if (l.length > MAX) l.splice(0, l.length - MAX);
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage full or blocked */ }
}

export const trackLogText = () => all().join("\n");
export const trackLogSize = () => all().length;
