import { useSyncExternalStore } from "react";
import { notifications, streakOf, type Note } from "../training";
import { useApp } from "./app-state";
import { Icon, StreakFlame } from "./icons";
import { Logo } from "./Logo";

import { unseenPokes, useFriends } from "./friendsStore";
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

const TITLES = { home: "Home", today: "Today", plan: "Plan", stats: "Stats", settings: "Settings" } as const;

/** Top bar: the app's name on Home, the page name elsewhere; then streak, notifications, friends and settings. */
export function AppHeader() {
  const { model, tab, setTab, openSheet } = useApp();
  const streak = streakOf(model);
  const lit = streak.current > 0;
  const notes = useNotes(), seen = useSeen();
  const unseen = notes.filter((n) => !seen.includes(n.key)).length;
  const pokes = unseenPokes(useFriends());
  return (
    <header className="apphead">
      {/* The logo shows on phones; on wide screens the side rail already has it. */}
      <h1 className="apphead-title"><span className="apphead-logo"><Logo size={30} /></span>{tab === "home" ? "Not a Runner" : TITLES[tab]}</h1>
      <span className="apphead-acts">
        <button className={"hicon streakbtn" + (lit ? " lit" : "")} aria-label={`Streak: ${streak.current} ${streak.current === 1 ? "day" : "days"}, ${streak.flames} of 3 flames`} onClick={() => openSheet({ kind: "streak" })}>
          <StreakFlame level={streak.flames} /><b>{streak.current}</b>
        </button>
        <button className="hicon" aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"} onClick={() => { markSeen(notes.map((n) => n.key)); openSheet({ kind: "notes" }); }}>
          <Icon.bell />
          {unseen > 0 && <span className="badge">{unseen > 9 ? "9+" : unseen}</span>}
        </button>
        <button className="hicon frbtn" aria-label={pokes ? `Friends, ${pokes} new pokes` : "Friends"} onClick={() => openSheet({ kind: "friends" })}>
          <Icon.friends />
          {pokes > 0 && <span className="badge">{pokes > 9 ? "9+" : pokes}</span>}
        </button>
        <button className={"hicon" + (tab === "settings" ? " sel" : "")} aria-label="Settings" aria-current={tab === "settings" ? "page" : undefined} onClick={() => setTab("settings")}>
          <Icon.settings />
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

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The streak sheet: how many days, how many flames are left, the last week, and the rule. */
export function StreakSheetBody() {
  const { model } = useApp();
  const k = streakOf(model);
  const now = !k.current ? "Log a workout or hit your step goal to start one."
    : k.today ? "Today counts. Nice work."
      : k.flames === 3 ? "Do something today to add it."
        : k.flames === 2 ? "One training day missed. Do something to fill the flame back up."
          : "Last flame. Do something today or it goes out.";
  return (
    <div className="streaksheet">
      <div className="streakbig">
        <span className={"streakflame" + (k.current ? " lit" : "")}><StreakFlame level={k.flames} /></span>
        <span className="num">{k.current}</span>
        <span className="unit">{k.current === 1 ? "day" : "days"}</span>
      </div>
      <p className="streaknow">{now}</p>
      <div className="streakweeks days" aria-label="The last week">
        {k.recent.map((r) => (
          <span key={r.date.getTime()} className={(r.active ? "met" : r.rest ? "rest" : "") + (r.today ? " now" : "")}>
            <i>{r.active && <Icon.flame />}</i><small>{r.today ? "Today" : WD[r.date.getDay()]}</small>
          </span>
        ))}
      </div>
      <div className="streakfacts">
        <div><b>{k.best}</b><small>Best streak, days</small></div>
        <div><b>{k.flames} of 3</b><small>Flames left</small></div>
      </div>
      <p className="setnote">A workout or your step goal keeps a day. Rest days never count against you. Each missed training day burns a flame; miss 3 in a row and it goes out. Doing something fills it right back up.</p>
    </div>
  );
}
