import { useSyncExternalStore } from "react";
import { notifications, type Note } from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { Wordmark } from "./Logo";
import { useSync } from "./SyncSection";
import { applyUpdate, useUpdateReady } from "./updates";

// Which notifications this device has seen (opening the list marks them all).
const SEEN = "seenNotes";
const seenSubs = new Set<() => void>();
let seenCache: string[] | null = null;
function readSeen(): string[] {
  if (seenCache) return seenCache;
  try { seenCache = JSON.parse(localStorage.getItem(SEEN) || "[]"); } catch { seenCache = []; }
  return seenCache!;
}
function markSeen(keys: string[]) {
  const next = [...new Set([...readSeen(), ...keys])].slice(-200);
  seenCache = next;
  try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch { /* blocked */ }
  seenSubs.forEach((f) => f());
}
const useSeen = () => useSyncExternalStore((f) => { seenSubs.add(f); return () => seenSubs.delete(f); }, readSeen);

/** Today's notifications, plus a new app version when there is one. */
export function useNotes(): Note[] {
  const { model, now } = useApp();
  const update = useUpdateReady();
  const list = notifications(model, now);
  return update ? [{ key: `update:${model.today.toDateString()}`, kind: "tip", text: "A new version of the app is ready.", action: { label: "Update", to: { type: "plan" } } }, ...list] : list;
}

/** Top bar: the app's name, then sync status and notifications. */
export function AppHeader() {
  const { setTab, openSheet } = useApp();
  const sync = useSync();
  const notes = useNotes(), seen = useSeen();
  const unseen = notes.filter((n) => !seen.includes(n.key)).length;
  const on = sync.phase !== "off" && !!sync.account;
  const syncLabel = !on ? "Sync is off" : sync.phase === "offline" ? "Offline, will sync later" : sync.phase === "error" ? "Sync needs attention" : sync.phase === "synced" ? "Synced" : "Syncing";
  const goSync = () => { setTab("settings"); window.setTimeout(() => document.querySelector(".area-sync")?.scrollIntoView({ block: "start" }), 60); };
  return (
    <header className="apphead">
      <span className="apphead-brand"><Wordmark size={24} /></span>
      <span className="apphead-acts">
        <button className={"hicon sync " + (on ? sync.phase : "off")} aria-label={syncLabel} title={syncLabel} onClick={goSync}>
          {on && sync.phase !== "offline" ? <Icon.cloud /> : <Icon.cloudOff />}
        </button>
        <button className="hicon" aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"} onClick={() => { markSeen(notes.map((n) => n.key)); openSheet({ kind: "notes" }); }}>
          <Icon.bell />
          {unseen > 0 && <span className="badge">{unseen > 9 ? "9+" : unseen}</span>}
        </button>
      </span>
    </header>
  );
}

/** The notifications sheet. */
export function NotesSheetBody() {
  const { setTab, openSheet, closeSheet } = useApp();
  const notes = useNotes();
  const act = (n: Note) => {
    const to = n.action?.to;
    if (!to) return;
    if (n.key.startsWith("update:")) { applyUpdate(); return; }
    if (to.type === "steps") openSheet({ kind: "steps", date: to.date });
    else { setTab("plan"); closeSheet(); }
  };
  if (!notes.length) return <p className="setnote">All caught up. Nothing new today.</p>;
  return (
    <ul className="notelist">
      {notes.map((n) => (
        <li key={n.key} className={n.kind}>
          <span className="ndot" aria-hidden="true" />
          <span className="ntext">{n.text}</span>
          {n.action && <button className="chip" onClick={() => act(n)}>{n.action.label}</button>}
        </li>
      ))}
    </ul>
  );
}
