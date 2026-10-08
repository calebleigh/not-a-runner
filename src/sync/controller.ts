// Runs sync in the background: remembers whether it's on, marks local edits, uploads them shortly
// after they happen, and applies what other devices upload. The app never waits on it.
import { createStore, get, set } from "idb-keyval";
import type { State } from "../training/types";
import { afterPush, applyRemote, changedKeys, markDirty, migrateExtras, pendingRows, startMeta, type SyncMeta } from "./engine";
import type { Account, Provider } from "./firebase";

export type SyncPhase = "off" | "starting" | "syncing" | "synced" | "offline" | "error";
export interface SyncStatus { phase: SyncPhase; account: Account | null; pending: number; lastSync: number | null; error: string | null }

interface Saved { on: boolean; meta: SyncMeta; account: Account | null; lastSync: number | null; /** 2: extras sync one by one. */ v?: number }
interface Host { get(): State; apply(next: State): void }

const KEY = "sync";
const REDIRECT_FLAG = "syncSignInPending";
const kv = createStore("half-training", "kv");
const fb = () => import("./firebase");

let host: Host | null = null;
let saved: Saved = { on: false, meta: { dirty: {}, cursor: null }, account: null, lastSync: null };
let status: SyncStatus = { phase: "off", account: null, pending: 0, lastSync: null, error: null };
let stopListen: (() => void) | null = null;
let stopAuth: (() => void) | null = null;
let timer: number | undefined;
let pushing = false;
const subs = new Set<() => void>();

function emit(p: Partial<SyncStatus>) {
  status = { ...status, ...p, pending: Object.keys(saved.meta.dirty).length, account: saved.account, lastSync: saved.lastSync };
  subs.forEach((f) => f());
}
const persist = () => set(KEY, saved, kv).catch(() => {});

export const syncStatus = () => status;
export function onSyncStatus(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

/** Called once the app's data has loaded. Resumes sync if it was on, or finishes a sign-in. */
export async function initSync(h: Host): Promise<void> {
  host = h;
  saved = (await get<Saved>(KEY, kv).catch(() => undefined)) ?? saved;
  let pending = false;
  try { pending = localStorage.getItem(REDIRECT_FLAG) === "1"; localStorage.removeItem(REDIRECT_FLAG); } catch { /* blocked */ }
  if (pending) {
    emit({ phase: "starting" });
    try {
      const a = await (await fb()).finishRedirect();
      if (a) return turnOn(a);
    } catch (e) {
      return emit({ phase: saved.on ? "error" : "off", error: message(e) });
    }
  }
  if (saved.on && (saved.v ?? 1) < 2) {
    saved = { ...saved, v: 2, meta: migrateExtras(h.get(), saved.meta, Date.now()) };
    await persist();
  }
  if (saved.on) start();
  else emit({ phase: "off" });
  window.addEventListener("online", () => schedule(0));
}

/** A local edit: remember what changed and upload it soon. */
export function noteChange(prev: State, next: State): void {
  if (!saved.on) return;
  saved = { ...saved, meta: markDirty(saved.meta, changedKeys(prev, next), Date.now()) };
  persist();
  emit({});
  schedule(1500);
}

export async function signInSync(kind: Provider): Promise<void> {
  emit({ phase: "starting", error: null });
  try {
    try { localStorage.setItem(REDIRECT_FLAG, "1"); } catch { /* blocked */ }
    const a = await (await fb()).signIn(kind);
    if (!a) return; // the page is leaving for the sign-in; initSync finishes when it comes back
    try { localStorage.removeItem(REDIRECT_FLAG); } catch { /* blocked */ }
    await turnOn(a);
  } catch (e) {
    try { localStorage.removeItem(REDIRECT_FLAG); } catch { /* blocked */ }
    const code = (e as { code?: string }).code;
    // Closing the popup (web) or backing out of Android's account picker isn't an error.
    const closed = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || /cancel/i.test((e as Error)?.message ?? "");
    emit({ phase: saved.on ? status.phase : "off", error: closed ? null : message(e) });
  }
}

/** Stops syncing on this device. Everything stays on the device; the account keeps its copy. */
export async function signOutSync(): Promise<void> {
  stopListen?.(); stopAuth?.(); stopListen = stopAuth = null;
  saved = { on: false, v: 2, meta: { dirty: {}, cursor: null }, account: null, lastSync: null };
  await persist();
  emit({ phase: "off", error: null });
  try { await (await fb()).signOut(); } catch { /* already signed out */ }
}

export const syncNow = () => schedule(0);

async function turnOn(a: Account) {
  const sameAccount = saved.on && saved.account?.uid === a.uid;
  saved = { on: true, v: 2, account: a, lastSync: sameAccount ? saved.lastSync : null, meta: sameAccount ? saved.meta : startMeta(host!.get()) };
  await persist();
  start();
}

async function start() {
  emit({ phase: "starting", error: null });
  let f: typeof import("./firebase");
  try { f = await fb(); } catch (e) { return emit({ phase: "offline", error: message(e) }); }
  stopAuth?.();
  stopAuth = f.watchAccount((a) => {
    stopListen?.(); stopListen = null;
    if (!a) {
      // Signed out elsewhere (or the session expired): stop, keep the local data.
      if (saved.on) emit({ phase: "error", error: "Signed out. Sign in again to keep syncing." });
      return;
    }
    if (saved.account?.uid !== a.uid) { saved = { ...saved, account: a, meta: startMeta(host!.get()) }; persist(); }
    stopListen = f.listen(a.uid, saved.meta.cursor, (rows) => {
      const r = applyRemote(host!.get(), saved.meta, rows);
      saved = { ...saved, meta: r.meta, lastSync: Date.now() };
      if (r.changed) host!.apply(r.state);
      persist();
      emit({ phase: Object.keys(saved.meta.dirty).length ? "syncing" : "synced", error: null });
    }, (e) => emit({ phase: "error", error: message(e) }));
    schedule(0);
  });
}

function schedule(ms: number) {
  if (!saved.on) return;
  clearTimeout(timer);
  timer = window.setTimeout(flush, ms);
}

async function flush() {
  if (pushing || !saved.on || !saved.account || !host) return;
  const rows = pendingRows(host.get(), saved.meta);
  if (!rows.length) return emit({ phase: status.phase === "starting" ? "synced" : status.phase });
  if (!navigator.onLine) return emit({ phase: "offline" });
  pushing = true;
  emit({ phase: "syncing" });
  try {
    const done = await (await fb()).push(saved.account.uid, rows);
    saved = { ...saved, meta: afterPush(saved.meta, done), lastSync: done.length ? Date.now() : saved.lastSync };
    await persist();
    const left = Object.keys(saved.meta.dirty).length;
    emit({ phase: left ? (navigator.onLine ? "error" : "offline") : "synced", error: left && navigator.onLine ? "Some changes didn't upload. Trying again soon." : null });
    if (left) schedule(30_000);
  } catch (e) {
    emit({ phase: navigator.onLine ? "error" : "offline", error: message(e) });
    schedule(30_000);
  } finally {
    pushing = false;
  }
}

function message(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  if (code.includes("network") || code === "unavailable") return "No connection. Changes will sync later.";
  if (code === "auth/unauthorized-domain") return "Sign-in isn't set up for this address yet.";
  if (code === "auth/operation-not-allowed") return "That sign-in option isn't turned on yet.";
  return "Something went wrong with sync. Your data is safe on this device.";
}
