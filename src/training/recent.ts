// Recent entries for Home: everything logged, newest first, each pointing at where it lives.
import { idParts } from "./adapt";
import { dateOf, parseDayKey } from "./calendar";
import { hms, kfmt } from "./format";
import { dayAt } from "./model";
import { extraKind } from "./stats";
import type { Model } from "./types";

export type RecentTarget =
  | { kind: "cardio"; w: number; d: number }
  | { kind: "strength"; w: number; d: number }
  | { kind: "extra"; date: Date }
  | { kind: "steps"; date: Date }
  | { kind: "weigh"; week: number };

export interface RecentItem {
  key: string;
  icon: "run" | "bike" | "walk" | "strength" | "extra" | "steps" | "weigh";
  title: string;
  detail: string;
  /** The day the entry is for. */
  date: Date;
  /** When it was logged (ms). Entries without a time sort as the start of their day. */
  at: number;
  target: RecentTarget;
}

const fmtDist = (mi: number) => `${+mi.toFixed(2)} mi`;
const startMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** The newest `limit` entries of anything logged: sessions, strength, extras, steps and weigh-ins. */
export function recentActivity(model: Model, limit = 5): RecentItem[] {
  const { state, spec } = model, out: RecentItem[] = [];

  for (const id of Object.keys(state.done)) {
    const { w, d, t } = idParts(id), day = dayAt(model, w, d);
    if (!day) continue;
    const log = state.logs[id], at = log?.at && log.at > 1 ? log.at : startMs(day.date);
    if (t === "c") {
      const parts = [log?.dist ? fmtDist(log.dist) : "", log?.time ? hms(log.time) : ""].filter(Boolean);
      const icon = day.c.kind === "bike" ? "bike" : day.c.kind === "walk" ? "walk" : "run";
      out.push({ key: id, icon, title: day.c.t, detail: parts.join(", ") || "Done", date: day.date, at, target: { kind: "cardio", w, d } });
    } else if (t === "s" && day.st) {
      out.push({ key: id, icon: "strength", title: day.st.title, detail: `Strength, ${day.st.min} min`, date: day.date, at, target: { kind: "strength", w, d } });
    }
  }

  for (const [dk, list] of Object.entries(state.extras)) {
    const [w, d] = parseDayKey(dk), date = dateOf(spec, w, d);
    list.forEach((e, i) => {
      const k = extraKind(e.kind);
      const parts = [e.dist ? fmtDist(e.dist) : "", e.time ? hms(e.time) : ""].filter(Boolean);
      out.push({
        key: `x-${dk}-${i}`, icon: "extra", title: e.label ? `${k.label}: ${e.label}` : k.label, detail: parts.join(", ") || "Logged",
        date, at: e.at ?? startMs(date) + i, target: { kind: "extra", date },
      });
    });
  }

  for (const [dk, n] of Object.entries(state.steps)) {
    if (!n) continue;
    const [w, d] = parseDayKey(dk), date = dateOf(spec, w, d);
    out.push({ key: `st-${dk}`, icon: "steps", title: `${kfmt(n)} steps`, detail: "Daily steps", date, at: startMs(date), target: { kind: "steps", date } });
  }

  for (const [wk, lb] of Object.entries(state.weights)) {
    const week = +wk, date = dateOf(spec, week, 0);
    out.push({ key: `wt-${wk}`, icon: "weigh", title: `${lb} lb`, detail: `Weigh-in, week ${week}`, date, at: startMs(date), target: { kind: "weigh", week } });
  }

  return out.sort((a, b) => b.at - a.at || b.date.getTime() - a.date.getTime()).slice(0, limit);
}
