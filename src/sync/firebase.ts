// Firebase connection: sign-in and the synced entries. Loaded only once sync is turned on, so the
// app starts just as fast for people who never sign in.
import { initializeApp } from "firebase/app";
import { Capacitor } from "@capacitor/core";
import {
  GoogleAuthProvider, OAuthProvider, browserLocalPersistence, getAuth, browserPopupRedirectResolver, getRedirectResult,
  indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, signInWithCredential, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User,
} from "firebase/auth";
import { Timestamp, collection, doc, getFirestore, initializeFirestore, memoryLocalCache, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import type { Row } from "./engine";

export type Provider = "google" | "apple";
export interface Account { uid: string; email: string | null; name: string | null; photo?: string | null }

// On these addresses the sign-in pages are served from the app's own domain (see the /__/ rewrites
// in vercel.json), which keeps sign-in working in browsers that block third-party storage.
const OWN_AUTH_DOMAIN = ["not-a-runner.vercel.app", "half-training-app.vercel.app", "not-a-runner-preview.vercel.app"];

const app = initializeApp({
  apiKey: "AIzaSyC81_s_5cBAOVijNofAibRrHRIQY21LNk8",
  authDomain: OWN_AUTH_DOMAIN.includes(location.hostname) ? location.hostname : "not-a-runner.firebaseapp.com",
  projectId: "not-a-runner",
  storageBucket: "not-a-runner.firebasestorage.app",
  messagingSenderId: "216360511088",
  appId: "1:216360511088:web:516ad0823beb39cc2e36b5",
});
// Set up once per page. If this file runs again in the same page (a live code reload while
// developing), reuse what's already there; setting either up twice throws.
const auth = (() => {
  try {
    return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  } catch {
    return getAuth(app);
  }
})();
// The app keeps its own copy on the device, so Firestore doesn't need a second one.
const db = (() => {
  try { return initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true }); } catch { return getFirestore(app); }
})();

const account = (u: User): Account => ({ uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL });
const entries = (uid: string) => collection(db, "users", uid, "entries");
/** Firestore ids can't contain "/". */
const docId = (key: string) => key.replace(/\//g, "|");
/** Cursor as a fixed-width string so plain string comparison orders it. */
export const cursorOf = (ms: number) => String(ms).padStart(15, "0");

/** Calls back with the signed-in account (or null) now and whenever it changes. */
export function watchAccount(cb: (a: Account | null) => void): () => void {
  return onAuthStateChanged(auth, (u) => cb(u ? account(u) : null));
}

/** Finishes a sign-in that left the page (the redirect flow), if one is in progress. */
export async function finishRedirect(): Promise<Account | null> {
  const r = await getRedirectResult(auth);
  return r ? account(r.user) : null;
}

/**
 * Opens the sign-in. Installed apps leave the page and come back (popups are unreliable there);
 * browsers use a popup. Returns null when the page is about to leave.
 */
export async function signIn(kind: Provider): Promise<Account | null> {
  if (Capacitor.isNativePlatform()) return signInNative(kind);
  const p = kind === "apple" ? new OAuthProvider("apple.com") : new GoogleAuthProvider();
  if (kind === "google") (p as GoogleAuthProvider).setCustomParameters({ prompt: "select_account" });
  if (kind === "apple") (p as OAuthProvider).addScope("email");
  const standalone = matchMedia("(display-mode: standalone)").matches;
  if (!standalone) {
    try {
      return account((await signInWithPopup(auth, p)).user);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-blocked" && code !== "auth/operation-not-supported-in-this-environment") throw e;
    }
  }
  await signInWithRedirect(auth, p);
  return null;
}

/**
 * Android app: Google's sign-in page doesn't run inside apps, so Android's account picker signs in
 * and hands back a token, which signs in to Firebase here.
 */
async function signInNative(kind: Provider): Promise<Account> {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  if (kind === "apple") {
    const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
    const cred = new OAuthProvider("apple.com").credential({ idToken: r.credential?.idToken, rawNonce: r.credential?.nonce });
    return account((await signInWithCredential(auth, cred)).user);
  }
  const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const cred = GoogleAuthProvider.credential(r.credential?.idToken);
  return account((await signInWithCredential(auth, cred)).user);
}

export async function signOut() {
  await fbSignOut(auth);
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    await FirebaseAuthentication.signOut().catch(() => {});
  }
}

/** Live download: every row written at or after `cursor`, now and as new ones arrive. */
export function listen(uid: string, cursor: string | null, onRows: (rows: Row[]) => void, onError: (e: Error) => void): () => void {
  const from = Timestamp.fromMillis(cursor ? Number(cursor) : 0);
  return onSnapshot(query(entries(uid), where("updated_at", ">=", from)), (snap) => {
    const rows: Row[] = [];
    for (const ch of snap.docChanges()) {
      // Our own uploads come back once the server has stamped them.
      if (ch.type === "removed" || ch.doc.metadata.hasPendingWrites) continue;
      const d = ch.doc.data();
      const at = d.updated_at instanceof Timestamp ? d.updated_at.toMillis() : 0;
      rows.push({ key: d.key, value: d.value ?? null, deleted: !!d.deleted, edited_at: Number(d.edited_at) || 0, updated_at: cursorOf(at) });
    }
    rows.sort((a, b) => (a.updated_at! < b.updated_at! ? -1 : 1));
    if (rows.length) onRows(rows);
  }, onError);
}

/**
 * Uploads rows. Returns the ones that are settled: written, or turned away because the account
 * already has a newer edit. Rows that failed for other reasons (offline) are left to retry.
 */
export async function push(uid: string, rows: Row[]): Promise<Row[]> {
  const settled: Row[] = [];
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    const res = await Promise.allSettled(chunk.map((r) =>
      setDoc(doc(entries(uid), docId(r.key)), { key: r.key, value: r.deleted ? null : r.value, deleted: r.deleted, edited_at: r.edited_at, updated_at: serverTimestamp() })));
    res.forEach((x, j) => {
      if (x.status === "fulfilled" || (x.reason as { code?: string })?.code === "permission-denied") settled.push(chunk[j]);
    });
  }
  return settled;
}
