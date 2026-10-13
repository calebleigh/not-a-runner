// The phone's own step count: on or off (kept on this device), and bringing it into the app. What it
// brings in syncs like steps you type. Health Connect can bring steps too; each day keeps the bigger.
import { useSyncExternalStore } from "react";
import { computeModel, mergeSteps, type State } from "../training";
import { phoneStepsAllowed, readPhoneSteps, startPhoneSteps, stopPhoneSteps } from "../native/phoneSteps";

const KEY = "phoneSteps";
const DAYS = 14;

function load(): boolean {
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
}

let on = load();
const subs = new Set<() => void>();
function setOn(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* blocked */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const usePhoneSteps = () => useSyncExternalStore(subscribe, () => on);

type Update = (fn: (draft: State) => void) => void;

/** Asks for permission and starts counting. False when it wasn't allowed. */
export async function turnOnPhoneSteps(): Promise<boolean> {
  const ok = await startPhoneSteps();
  setOn(ok);
  return ok;
}

export async function turnOffPhoneSteps() {
  setOn(false);
  await stopPhoneSteps();
}

let busy = false;
/** Brings the phone's counts into the app (quietly). Turns itself off if permission was taken away. */
export async function importPhoneSteps(update: Update) {
  if (!on || busy) return;
  busy = true;
  try {
    if (!(await phoneStepsAllowed())) { setOn(false); return; }
    const steps = await readPhoneSteps(DAYS);
    if (!steps.length) return;
    const now = new Date();
    update((draft) => { mergeSteps(draft, computeModel(draft, now), steps); });
  } catch { /* try again next time */ } finally {
    busy = false;
  }
}
