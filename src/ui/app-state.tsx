import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createStorage } from "../storage/store";
import { mirrorSend, onMirror } from "./mirror";
import { applyAccent, applyShape, type Shape } from "./theme";
import { computeModel, mergeState, startOfDay, type Model, type State } from "../training";

export type Tab = "home" | "plan" | "stats" | "settings";
export type SheetSpec =
  | { kind: "day"; w: number; d: number }
  | { kind: "cardio"; w: number; d: number; fromExtra?: number }
  | { kind: "strength"; w: number; d: number }
  | { kind: "steps"; date: Date }
  | { kind: "weigh" }
  | { kind: "extra"; date: Date }
  | { kind: "log" }
  | { kind: "export" }
  | { kind: "import" };

interface AppCtx {
  model: Model;
  state: State;
  /** Mutate a draft copy of state; it is saved right away. */
  update: (fn: (draft: State) => void) => void;
  importState: (incoming: State) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  sheet: SheetSpec | null;
  openSheet: (s: SheetSpec) => void;
  closeSheet: () => void;
  toast: (msg: string) => void;
  toastMsg: { text: string; id: number } | null;
  now: Date;
}

const Ctx = createContext<AppCtx | null>(null);
const TAB_KEY = "tab";
const TABS: Tab[] = ["home", "plan", "stats", "settings"];

// A refresh keeps the current tab; opening the app fresh starts on Home (sessionStorage is per launch).
function savedTab(): Tab {
  try { const t = sessionStorage.getItem(TAB_KEY) as Tab; return TABS.includes(t) ? t : "home"; } catch { return "home"; }
}
const storage = createStorage();

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

/** Current time, refreshed when the app comes back to the foreground and once a minute. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    const id = window.setInterval(tick, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", tick); clearInterval(id); };
  }, []);
  return now;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTabRaw] = useState<Tab>(savedTab);
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; id: number } | null>(null);
  const now = useNow();
  const stateRef = useRef<State | null>(null);

  const toast = useCallback((text: string) => setToastMsg({ text, id: Date.now() }), []);

  useEffect(() => {
    storage.load().then(({ state, migrated }) => {
      stateRef.current = state;
      setState(state);
      if (migrated) toast("Your training data moved over");
    });
  }, [toast]);

  const commit = useCallback((next: State) => {
    const prevDone = Object.keys(stateRef.current?.done || {}).length;
    stateRef.current = next;
    setState(next);
    storage.save(next).catch(() => toast("Couldn't save. Export a backup."));
    mirrorSend("data", next);
    const nd = Object.keys(next.done).length;
    if (nd > prevDone && prevDone) toast(nd % 5 === 0 ? `${nd} workouts. Keep stacking them.` : "Logged. Nice work.");
  }, [toast]);

  const update = useCallback((fn: (draft: State) => void) => {
    if (!stateRef.current) return;
    const draft = structuredClone(stateRef.current);
    fn(draft);
    commit(draft);
  }, [commit]);

  const importState = useCallback((incoming: State) => {
    if (stateRef.current) commit(mergeState(stateRef.current, incoming));
  }, [commit]);

  const showTab = useCallback((t: Tab) => {
    setTabRaw(t);
    window.scrollTo(0, 0);
    try { sessionStorage.setItem(TAB_KEY, t); } catch { /* private mode */ }
  }, []);
  const setTab = useCallback((t: Tab) => { showTab(t); mirrorSend("tab", t); }, [showTab]);
  const openSheet = useCallback((s: SheetSpec) => { setSheet(s); mirrorSend("sheet", s); }, []);
  const closeSheet = useCallback(() => { setSheet(null); mirrorSend("sheet", null); }, []);

  // Fold preview: follow the other screen (already saved there, so don't save or toast again).
  useEffect(() => {
    const offs = [
      onMirror<Tab>("tab", showTab),
      onMirror<SheetSpec | null>("sheet", setSheet),
      onMirror<State>("data", (s) => { stateRef.current = s; setState(s); }),
      // The Fold preview's Rounded/Squared toggle changes the real setting.
      onMirror<Shape>("shape", (v) => update((s) => { if (v === "round") s.settings.shape = v; else delete s.settings.shape; })),
    ];
    return () => offs.forEach((off) => off());
  }, [showTab, update]);

  // Accent colors follow the saved theme.
  const accent = state?.settings.accent;
  useEffect(() => { applyAccent(accent); }, [accent?.hi, accent?.lo]); // eslint-disable-line react-hooks/exhaustive-deps
  const shape = state?.settings.shape;
  useEffect(() => { applyShape(shape); }, [shape]);

  // Recompute the plan when state changes or the date rolls over (not every minute).
  const dayMs = startOfDay(now).getTime();
  const model = useMemo(() => (state ? computeModel(state, new Date(dayMs)) : null), [state, dayMs]);

  if (!state || !model) return null;
  return (
    <Ctx.Provider value={{ model, state, update, importState, tab, setTab, sheet, openSheet, closeSheet, toast, toastMsg, now }}>
      {children}
    </Ctx.Provider>
  );
}
