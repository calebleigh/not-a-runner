import { useState, useSyncExternalStore } from "react";
import { flushNow, onSyncStatus, signInSync, syncNow, syncStatus, type SyncStatus } from "../sync/controller";
import type { Account } from "../sync/firebase";
import { useApp } from "./app-state";
import { ConfirmButton } from "./cards";

export const useSync = (): SyncStatus => useSyncExternalStore(onSyncStatus, syncStatus);

function ago(ms: number | null): string {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const PHASE: Record<SyncStatus["phase"], string> = {
  off: "", starting: "Connecting", syncing: "Syncing", synced: "Synced", offline: "Offline. Changes will sync later.", error: "",
};

export function GoogleButton({ label = "Sign in with Google", busy }: { label?: string; busy?: boolean }) {
  return (
    <button className="btn gbtn" disabled={busy} onClick={() => signInSync("google")}>
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {busy ? "Connecting" : label}
    </button>
  );
}

/** Settings: turn sync on with an account, see how it's doing, or turn it off. */
export function SyncSection() {
  const s = useSync();
  const on = s.phase !== "off";
  return (
    <div className="area-sync">
      <div className="sechead"><h3 className="sectitle">Sync</h3>{on && s.account && <span className="lbl">On</span>}</div>
      <section className="card group">
        {!on || !s.account ? (
          <div className="syncoff">
            <p><b>Use the app on more than one device?</b> Sign in and your phone and computer stay in sync. Without an account, everything stays on this device.</p>
            <GoogleButton busy={s.phase === "starting"} />
            {s.error && <p className="syncerr" role="alert">{s.error}</p>}
          </div>
        ) : (
          <>
            <div className="setrow">
              <span>{s.account.email || s.account.name || "Signed in"}
                <small aria-live="polite">{s.error || [PHASE[s.phase], s.phase === "synced" ? ago(s.lastSync) : "", s.pending && s.phase !== "synced" ? `${s.pending} to upload` : ""].filter(Boolean).join(", ")}</small>
              </span>
              <span className={"syncdot " + s.phase} aria-hidden="true" />
            </div>
            <div className="setrow">
              <span>Sync across devices<small>Works offline. Changes upload when you're back online.</small></span>
              <span className="btnpair">
                <button className="chip" onClick={syncNow}>Sync now</button>
                <SignOutButton className="chip" />
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** The signed-in person's Google photo, or their initial. */
export function Avatar({ account, size = 30 }: { account: Account; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (account.name || account.email || "?").trim().charAt(0).toUpperCase();
  return account.photo && !broken
    ? <img className="avatar" src={account.photo} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">{initial}</span>;
}

/**
 * Signs out of the app: uploads anything waiting, then clears this device and goes back to the
 * welcome screen. Offline with changes still waiting, it says so and asks once more.
 */
export function SignOutButton({ className }: { className: string }) {
  const { signOut } = useApp();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const go = async (force: boolean) => {
    setBusy(true);
    const n = await flushNow();
    if (n && !force) { setLeft(n); setBusy(false); return; }
    await signOut();
  };
  if (left) return (
    <span className="signoutwarn">
      <small>{left} {left === 1 ? "change hasn't" : "changes haven't"} uploaded yet. Signing out now loses {left === 1 ? "it" : "them"}.</small>
      <span className="btnpair">
        <button className={className + " confirm"} disabled={busy} onClick={() => go(true)}>Sign out anyway</button>
        <button className={className} onClick={() => setLeft(0)}>Cancel</button>
      </span>
    </span>
  );
  if (busy) return <button className={className} disabled>Signing out</button>;
  return <ConfirmButton className={className} label="Sign out" confirmLabel="Tap again to sign out" onConfirm={() => go(false)} />;
}

/** The account sheet from the header: who's signed in and how sync is doing, or a way to sign in. */
export function AccountSheetBody() {
  const s = useSync();
  const on = s.phase !== "off" && !!s.account;
  if (!on || !s.account) return (
    <div className="acct">
      <p className="setnote">You're using Not a Runner without an account, so your training lives only on this device.</p>
      <p className="setnote">Sign in to back it up and keep your phone and computer in sync.</p>
      <GoogleButton busy={s.phase === "starting"} />
      {s.error && <p className="syncerr" role="alert">{s.error}</p>}
    </div>
  );
  const a = s.account;
  return (
    <div className="acct">
      <div className="acct-who">
        <Avatar account={a} size={56} />
        <div><b>{a.name || a.email}</b>{a.name && a.email && <small>{a.email}</small>}</div>
      </div>
      <div className="setrow">
        <span>Sync<small aria-live="polite">{s.error || [PHASE[s.phase], s.phase === "synced" ? ago(s.lastSync) : "", s.pending && s.phase !== "synced" ? `${s.pending} to upload` : ""].filter(Boolean).join(", ")}</small></span>
        <button className="chip" onClick={syncNow}>Sync now</button>
      </div>
      <SignOutButton className="btn small" />
      <p className="setnote">Signing out removes your training from this device. It stays safe in your account, and signing back in brings it all back.</p>
    </div>
  );
}
