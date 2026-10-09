// Friends over Firestore: each person's shared card (profiles/{uid}), invite codes (invites/{code}),
// friend links (users/{uid}/friends/{friendUid}, one each way) and pokes (users/{uid}/pokes).
// Who may read or write what is enforced in firestore.rules. Loaded only for signed-in people.
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import type { FriendCard, PokeKind } from "../training/friends";
import { newInviteCode } from "../training/friends";
import { firestore } from "./firebase";

export interface Invite { uid: string; name: string; photo: string | null }
export interface Poke { id: string; from: string; name: string; photo: string | null; kind: PokeKind; msg: string; at: number }

const db = firestore;

export async function publishCard(uid: string, card: FriendCard): Promise<void> {
  await setDoc(doc(db(), "profiles", uid), { ...card, updated_at: serverTimestamp() });
}

/** This person's invite code, made once and reused. */
export async function myInvite(uid: string, who: Omit<Invite, "uid">): Promise<string> {
  const mine = await getDocs(query(collection(db(), "invites"), where("uid", "==", uid), limit(1)));
  if (!mine.empty) {
    const d = mine.docs[0];
    if (d.data().name !== who.name || d.data().photo !== who.photo) await setDoc(d.ref, { uid, ...who, at: d.data().at ?? serverTimestamp() });
    return d.id;
  }
  const code = newInviteCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
  await setDoc(doc(db(), "invites", code), { uid, ...who, at: serverTimestamp() });
  return code;
}

export async function readInvite(code: string): Promise<Invite | null> {
  const d = await getDoc(doc(db(), "invites", code));
  return d.exists() ? (d.data() as Invite) : null;
}

/** Links both ways. The invite code is the proof the other person asked for it. */
export async function addFriend(me: string, code: string, them: string): Promise<void> {
  const b = writeBatch(db());
  b.set(doc(db(), "users", me, "friends", them), { code, at: serverTimestamp() });
  b.set(doc(db(), "users", them, "friends", me), { code, at: serverTimestamp() });
  await b.commit();
}

export async function removeFriend(me: string, them: string): Promise<void> {
  const b = writeBatch(db());
  b.delete(doc(db(), "users", me, "friends", them));
  b.delete(doc(db(), "users", them, "friends", me));
  await b.commit();
}

/** Calls back with friend ids now and as they change. */
export function watchFriendIds(me: string, cb: (ids: string[]) => void, onErr: (e: Error) => void): Unsubscribe {
  return onSnapshot(collection(db(), "users", me, "friends"), (s) => cb(s.docs.map((d) => d.id)), onErr);
}

export function watchCard(uid: string, cb: (c: (FriendCard & { updatedAt: number }) | null) => void): Unsubscribe {
  return onSnapshot(doc(db(), "profiles", uid), (d) => {
    const v = d.data();
    cb(v ? { ...(v as FriendCard), updatedAt: v.updated_at?.toMillis?.() ?? Date.now() } : null);
  }, () => cb(null));
}

export async function sendPoke(to: string, p: Omit<Poke, "id" | "at">): Promise<void> {
  await setDoc(doc(collection(db(), "users", to, "pokes")), { ...p, at: serverTimestamp() });
}

export function watchPokes(me: string, cb: (p: Poke[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db(), "users", me, "pokes"), orderBy("at", "desc"), limit(20)), (s) => {
    cb(s.docs.map((d) => { const v = d.data(); return { id: d.id, ...(v as Omit<Poke, "id" | "at">), at: v.at?.toMillis?.() ?? Date.now() }; }));
  }, () => cb([]));
}

export const clearPoke = (me: string, id: string) => deleteDoc(doc(db(), "users", me, "pokes", id));
