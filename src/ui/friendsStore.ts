// Friends in the app: keeps your card published, and your friends' cards and pokes live, while
// you're signed in. The Firestore side (and the firebase library) loads only once someone is.
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Account } from "../sync/firebase";
import type { Invite, Poke } from "../sync/social";
import { friendCard, POKES_PER_DAY, todayKey, type FriendCard, type PokeKind } from "../training";
import { useApp } from "./app-state";
import { useSync } from "./SyncSection";

export type Card = FriendCard & { updatedAt: number };
export interface FriendsState { uid: string | null; code: string | null; ids: string[]; cards: Record<string, Card | null>; pokes: Poke[]; error: string | null }

const social = () => import("../sync/social");
let st: FriendsState = { uid: null, code: null, ids: [], cards: {}, pokes: [], error: null };
const subs = new Set<() => void>();
const set = (p: Partial<FriendsState>) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
export const useFriends = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => st);

let stops: (() => void)[] = [];
const cardStops = new Map<string, () => void>();
function stopAll() {
  stops.forEach((f) => f()); stops = [];
  cardStops.forEach((f) => f()); cardStops.clear();
}

async function start(a: Account) {
  stopAll();
  set({ uid: a.uid, code: null, ids: [], cards: {}, pokes: [], error: null });
  const s = await social();
  if (st.uid !== a.uid) return;
  stops.push(s.watchFriendIds(a.uid, (ids) => {
    for (const [id, stop] of cardStops) if (!ids.includes(id)) { stop(); cardStops.delete(id); }
    for (const id of [a.uid, ...ids]) {
      if (cardStops.has(id)) continue;
      cardStops.set(id, s.watchCard(id, (c) => set({ cards: { ...st.cards, [id]: c } })));
    }
    set({ ids });
  }, (e) => set({ error: friendlyError(e) })));
  stops.push(s.watchPokes(a.uid, (pokes) => {
    const fresh = pokes.filter((p) => p.at > seenPokes() && !st.pokes.some((x) => x.id === p.id));
    set({ pokes });
    if (fresh.length && pokeListener) pokeListener(fresh[0]);
  }));
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  if (code === "permission-denied") return "Friends aren't switched on for your account yet.";
  if (code.includes("unavailable") || code.includes("network")) return "No connection. Friends will show up when you're back online.";
  return "Couldn't load friends right now.";
}

// New pokes pop up as a toast once; the badge counts pokes since the friends list was last opened.
let pokeListener: ((p: Poke) => void) | null = null;
const SEEN = "pokesSeen";
const seenPokes = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } };
export function markPokesSeen() { try { localStorage.setItem(SEEN, String(Date.now())); } catch { /* blocked */ } set({}); }
export const unseenPokes = (s: FriendsState) => s.pokes.filter((p) => p.at > seenPokes()).length;

/**
 * Mounted once in the app shell: follows sign-in, and publishes your card when it changes
 * (a log, a new day, a new streak).
 */
export function FriendsSync() {
  const { model, state, toast } = useApp();
  const sync = useSync();
  const acct = sync.phase !== "off" ? sync.account : null;
  const uid = acct?.uid ?? null;
  useEffect(() => { pokeListener = (p) => toast(`${p.name}: ${p.msg}`); return () => { pokeListener = null; }; }, [toast]);
  useEffect(() => {
    if (acct) start(acct);
    else { stopAll(); set({ uid: null, code: null, ids: [], cards: {}, pokes: [], error: null }); }
    // Restart only when the person changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const who = { name: state.settings.name || acct?.name || "", photo: acct?.photo ?? null };
  const card = acct ? friendCard(model, who) : null;
  const json = card ? JSON.stringify(card) : "";
  const last = useRef("");
  useEffect(() => {
    if (!uid || !card || json === last.current) return;
    const t = window.setTimeout(async () => {
      try { await (await social()).publishCard(uid, card); last.current = json; } catch { /* retried on the next change */ }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, json]);
  return null;
}

/** Your invite code (made the first time it's asked for). */
export async function loadInviteCode(a: Account, name: string): Promise<string> {
  if (st.code) return st.code;
  const code = await (await social()).myInvite(a.uid, { name: name.trim().split(/\s+/)[0] || "Friend", photo: a.photo ?? null });
  set({ code });
  return code;
}

export const inviteLink = (code: string) => `https://not-a-runner.vercel.app/?invite=${code}`;

export async function lookUpInvite(code: string): Promise<Invite | null> {
  return (await social()).readInvite(code);
}

export async function addFriendByCode(code: string, them: string) {
  if (!st.uid) throw new Error("Sign in first.");
  await (await social()).addFriend(st.uid, code, them);
}

export async function unfriend(them: string) {
  if (st.uid) await (await social()).removeFriend(st.uid, them);
}

// Pokes sent today, per friend, kept on this device to hold the daily limit.
const SENT = "pokesSent";
function sentToday(): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(SENT) || "{}"); return v.day === todayKey(new Date()) ? v.n || {} : {}; } catch { return {}; }
}
export const pokesLeft = (them: string) => Math.max(0, POKES_PER_DAY - (sentToday()[them] || 0));

export async function poke(them: string, kind: PokeKind, msg: string, me: { name: string; photo: string | null }) {
  if (!st.uid || pokesLeft(them) <= 0) return false;
  await (await social()).sendPoke(them, { from: st.uid, name: me.name, photo: me.photo, kind, msg });
  const n = sentToday();
  n[them] = (n[them] || 0) + 1;
  try { localStorage.setItem(SENT, JSON.stringify({ day: todayKey(new Date()), n })); } catch { /* blocked */ }
  set({});
  return true;
}

export async function dismissPoke(id: string) {
  if (st.uid) await (await social()).clearPoke(st.uid, id).catch(() => {});
}

// Invite links: ?invite=CODE is kept until the person is signed in, then offered in the friends sheet.
const PENDING = "pendingInvite";
export function takeInviteFromUrl() {
  try {
    const u = new URL(location.href), c = u.searchParams.get("invite");
    if (!c) return;
    localStorage.setItem(PENDING, c);
    u.searchParams.delete("invite");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch { /* not a browser */ }
}
export const pendingInvite = () => { try { return localStorage.getItem(PENDING); } catch { return null; } };
export const clearPendingInvite = () => { try { localStorage.removeItem(PENDING); } catch { /* blocked */ } };
