import { useSyncExternalStore } from "react";
import { notifications, streakOf, type Note } from "../training";
import { useApp } from "./app-state";
import { Icon } from "./icons";
import { Logo } from "./Logo";
import { useSync } from "./SyncSection";
import { applyUpdate, useUpdateReady } from "./updates";
import { conflictText } from "./HealthSection";
import { useHealth } from "./healthSync";

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
  const health = useHealth();
  // Workouts from the health store that match a session you logged yourself.
  const asks: Note[] = health.mem.pending.map((c) => ({ key: `health:${c.workout.id}`, kind: "missed", text: conflictText(c), action: { label: "Choose", to: { type: "plan" } } }));
  const list = [...asks, ...notifications(model, now)];
  return update ? [{ key: `update:${model.today.toDateString()}`, kind: "tip", text: "A new version of the app is ready.", action: { label: "Update", to: { type: "plan" } } }, ...list] : list;
}

const TITLES = { home: "Home", plan: "Plan", stats: "Stats", settings: "Settings" } as const;

/** Top bar: the app's name on Home, the page name elsewhere; then streak, sync and notifications. */
export function AppHeader() {
  const { model, tab, setTab, openSheet } = useApp();
  const sync = useSync();
  const streak = streakOf(model);
  const lit = streak.current > 0;
  const notes = useNotes(), seen = useSeen();
  const unseen = notes.filter((n) => !seen.includes(n.key)).length;
  const on = sync.phase !== "off" && !!sync.account;
  const syncLabel = !on ? "Sync is off" : sync.phase === "offline" ? "Offline, will sync later" : sync.phase === "error" ? "Sync needs attention" : sync.phase === "synced" ? "Synced" : "Syncing";
  const goSync = () => { setTab("settings"); window.setTimeout(() => document.querySelector(".area-sync")?.scrollIntoView({ block: "start" }), 60); };
  return (
    <header className="apphead">
      {/* The logo shows on phones; on wide screens the side rail already has it. */}
      <h1 className="apphead-title"><span className="apphead-logo"><Logo size={26} /></span>{tab === "home" ? "Not a Runner" : TITLES[tab]}</h1>
      <span className="apphead-acts">
        <button className={"hicon streakbtn" + (lit ? " lit" : "")} aria-label={`Weekly streak: ${streak.current} ${streak.current === 1 ? "week" : "weeks"}`} onClick={() => openSheet({ kind: "streak" })}>
          <Icon.flame /><b>{streak.current}</b>
        </button>
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
    if (n.key.startsWith("health:")) { openSheet({ kind: "health" }); return; }
    if (to.type === "steps") openSheet({ kind: "steps", date: to.date });
    else if (to.type === "day") openSheet({ kind: "day", w: to.w, d: to.d });
    else if (to.type === "weigh") openSheet({ kind: "weigh" });
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

/** The streak sheet: how many weeks in a row, this week's progress, and the rule. */
export function StreakSheetBody() {
  const { model } = useApp();
  const k = streakOf(model), left = Math.max(0, k.thisWeek.need - k.thisWeek.done);
  return (
    <div className="streaksheet">
      <div className="streakbig">
        <span className={"streakflame" + (k.current ? " lit" : "")}><Icon.flame /></span>
        <span className="num">{k.current}</span>
        <span className="unit">{k.current === 1 ? "week" : "weeks"} in a row</span>
      </div>
      <p className="streaknow">{k.thisWeek.met ? "This week counts. Nice work." : k.thisWeek.need ? `${left} more ${left === 1 ? "session" : "sessions"} this week to keep it going.` : "Your streak starts with your first week."}</p>
      <div className="streakweeks" aria-label="Recent weeks">
        {k.recent.map((r) => (
          <span key={r.week} className={(r.met ? "met" : "") + (r.current ? " now" : "")} title={`Week ${r.week}`}>
            <i>{r.met && <Icon.flame />}</i><small>{r.current ? "Now" : `W${r.week}`}</small>
          </span>
        ))}
      </div>
      <div className="streakfacts">
        <div><b>{k.best}</b><small>Best streak</small></div>
        <div><b>{k.thisWeek.done}</b><small>Done this week, {k.thisWeek.need} needed</small></div>
      </div>
      <p className="setnote">A week counts when you do most of your planned cardio, like 3 of 5. Rest days and the odd missed day never break it.</p>
    </div>
  );
}
