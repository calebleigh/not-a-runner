// Friends: the small card each person shares with friends, and the preset pokes. Pure.
// Friends see only this card, never logs, weights or anything else.
import { dayAt } from "./model";
import { homeTotals } from "./stats";
import { streakOf } from "./streak";
import { weekProgress } from "./stats";
import type { Model } from "./types";

export interface FriendCard {
  name: string;
  photo: string | null;
  streak: number;
  best: number;
  /** Today's planned cardio, as of `day`. A rest day (or no plan today) counts as done. */
  today: { day: string; title: string; kind: string; done: boolean; rest: boolean };
  week: { done: number; total: number };
  totals: { steps: number; miles: number; hours: number };
  plan: { name: string; daysToRace: number | null };
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayKey = ymd;

export function friendCard(model: Model, who: { name: string; photo?: string | null }): FriendCard {
  const { state, curWeek, rawWeek, dow, today, spec } = model;
  const s = streakOf(model);
  const day = rawWeek >= 1 ? dayAt(model, curWeek, dow) : undefined;
  const rest = !day || day.c.kind === "rest";
  const wk = model.weeks[curWeek - 1];
  const p = wk && rawWeek >= 1 ? weekProgress(state, wk) : { cardioDone: 0, cardioTotal: 0 };
  const t = homeTotals(model).all;
  return {
    name: who.name.trim().split(/\s+/)[0]?.slice(0, 24) || "Friend",
    photo: who.photo || null,
    streak: s.current,
    best: s.best,
    today: { day: ymd(today), title: rest ? "Rest day" : day!.c.t, kind: rest ? "rest" : day!.c.kind, done: rest || !!state.done[day!.ids[0]], rest },
    week: { done: p.cardioDone, total: p.cardioTotal },
    totals: { steps: t.steps, miles: t.miles, hours: Math.round(t.secs / 360) / 10 },
    plan: { name: spec.raceName, daysToRace: spec.race ? Math.max(0, Math.round((spec.race.getTime() - today.getTime()) / 86400000)) : null },
  };
}

/** Is a friend's card about today? An old card means they haven't opened the app today. */
export const cardIsToday = (c: FriendCard, today: Date) => c.today.day === ymd(today);

export type PokeKind = "tease" | "cheer";
export const POKES: Record<PokeKind, string[]> = {
  tease: ["Your couch misses you. Ignore it.", "Shoes are by the door. Just saying.", "Today's session called. It's waiting.", "No pressure. Okay, a little pressure."],
  cheer: ["Nice work today!", "Look at you go.", "Done and dusted. Respect.", "That's how it's done."],
};
/** Pokes one person can send one friend in a day. */
export const POKES_PER_DAY = 3;

/** Invite codes: 8 characters with no look-alikes (no 0/O, 1/I/L). */
export const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newInviteCode(rand: () => number = Math.random): string {
  let c = "";
  for (let i = 0; i < 8; i++) c += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return c;
}
/** Tidies a typed or pasted code (or a whole invite link) into the code, or null. */
export function parseInviteCode(input: string): string | null {
  const m = input.match(/(?:invite=|\/i\/)([A-Za-z0-9]+)/);
  const raw = (m ? m[1] : input).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 8 && [...raw].every((ch) => CODE_CHARS.includes(ch)) ? raw : null;
}
