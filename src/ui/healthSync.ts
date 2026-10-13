// Health Connect (Apple Health later) import: on or off, when it last ran, and workouts waiting
// for an answer. Kept on this device; what it brings in syncs like anything you log.
import { useSyncExternalStore } from "react";
import { computeModel, emptyHealthMemory, importHealth, resolveConflict, startOfDay, trimHealthMemory, type ConflictChoice, type HealthConflict, type HealthData, type HealthImportResult, type HealthMemory, type State } from "../training";
import { connectHealth, healthAllowed, healthName, readHealth, stepsAllowed } from "../native/health";

export interface HealthStatus {
  on: boolean;
  busy: boolean;
  /** When the last import finished (ms). */
  last: number | null;
  error?: string;
  mem: HealthMemory;
}

const KEY = "health";
/** First import looks back this far; later ones only need the last two weeks. */
const FIRST_DAYS = 30, DAYS = 14;
/** Opening the app imports again when the last import is older than this. */
const STALE_MS = 15 * 60 * 1000;

function load(): HealthStatus {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || "null");
    if (x && typeof x === "object") return { on: !!x.on, busy: false, last: x.last ?? null, mem: { ...emptyHealthMemory(), ...x.mem } };
  } catch { /* blocked or broken */ }
  return { on: false, busy: false, last: null, mem: emptyHealthMemory() };
}

let status = load();
const subs = new Set<() => void>();
function set(next: Partial<HealthStatus>) {
  status = { ...status, ...next };
  try { localStorage.setItem(KEY, JSON.stringify({ on: status.on, last: status.last, mem: status.mem })); } catch { /* blocked */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useHealth = () => useSyncExternalStore(subscribe, () => status);
export const healthPending = () => status.mem.pending;

type Update = (fn: (draft: State) => void) => void;

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** What an import brought in, in a few words, or "" when nothing changed. */
/**
 * What came in, for the toast. `quiet` (the imports that run on their own when the app opens) leaves
 * out steps: today's count changes all day, so nearly every open would say "steps for 1 day".
 */
export function importSummary(r: HealthImportResult, quiet = false): string {
  const parts = [
    r.workouts ? plural(r.workouts, "workout") : "",
    r.stepDays && !quiet ? `steps for ${plural(r.stepDays, "day")}` : "",
    r.weights ? plural(r.weights, "weigh-in") : "",
  ].filter(Boolean);
  const asks = r.conflicts ? ` ${plural(r.conflicts, "workout needs", "workouts need")} a look (see the bell).` : "";
  return parts.length || asks ? `From ${healthName}: ${parts.join(", ") || "nothing new"}.${asks}` : "";
}

/**
 * Why "Import now" brought nothing new, in plain words: steps aren't shared with the app, the
 * health store has none for today (the step app isn't saving to it), or it's all in already.
 */
async function nothingNew(data: HealthData, started: boolean): Promise<string> {
  if (!(await stepsAllowed())) return `${healthName} isn't sharing steps with Not a Runner. Tap Open ${healthName} below and turn on Steps.`;
  const today = startOfDay(new Date()).getTime();
  const n = data.steps.find((s) => startOfDay(s.date).getTime() === today)?.steps ?? 0;
  if (!n) return `${healthName} has no steps for today. In Samsung Health (or your step app), open Settings, then ${healthName}, and let it share steps.`;
  if (!started) return `${healthName} has ${Math.round(n).toLocaleString("en-US")} steps today. Steps count once your plan starts.`;
  return `Up to date. ${Math.round(n).toLocaleString("en-US")} steps today.`;
}

/** Reads the health store and brings it in. Returns the summary ("" when nothing changed, unless `explain`). */
export async function importHealthNow(update: Update, opts: { days?: number; quiet?: boolean; explain?: boolean } = {}): Promise<string> {
  if (!status.on || status.busy) return "";
  set({ busy: true, error: undefined });
  try {
    const data = await readHealth(opts.days ?? (status.last ? DAYS : FIRST_DAYS));
    const mem: HealthMemory = structuredClone(status.mem);
    let result: HealthImportResult = { stepDays: 0, workouts: 0, weights: 0, conflicts: 0 };
    let started = true;
    const now = new Date();
    update((draft) => { const m = computeModel(draft, now); started = m.rawWeek >= 1; result = importHealth(draft, m, data, mem); });
    trimHealthMemory(mem, now.getTime());
    set({ busy: false, last: Date.now(), mem });
    const summary = importSummary(result, opts.quiet);
    return summary || (opts.explain ? nothingNew(data, started) : "");
  } catch (e) {
    set({ busy: false, error: `Couldn't read ${healthName}. ${e instanceof Error ? e.message : ""}`.trim() });
    return "";
  }
}

/** Asks for permission, then imports. False when nothing was allowed. */
export async function turnOnHealth(update: Update): Promise<{ ok: boolean; summary: string }> {
  set({ busy: true, error: undefined });
  let ok = false;
  try { ok = await connectHealth(); } catch { ok = false; }
  if (!ok) {
    set({ busy: false, on: false, error: `Nothing was allowed. Turn on steps and exercise for Not a Runner in ${healthName}.` });
    return { ok: false, summary: "" };
  }
  set({ busy: false, on: true });
  return { ok: true, summary: await importHealthNow(update) };
}

export function turnOffHealth() {
  set({ on: false, error: undefined, mem: { ...status.mem, pending: [] } });
}

/** On app open or return: import when it's been a while. Turns itself off if permission was taken away. */
export async function autoImportHealth(update: Update): Promise<string> {
  if (!status.on || status.busy || (status.last && Date.now() - status.last < STALE_MS)) return "";
  if (!(await healthAllowed())) { set({ on: false, error: `Not a Runner can't read ${healthName} anymore. Connect again to turn it back on.` }); return ""; }
  return importHealthNow(update, { quiet: true });
}

export function answerConflict(update: Update, c: HealthConflict, choice: ConflictChoice) {
  const mem: HealthMemory = structuredClone(status.mem);
  const now = new Date();
  update((draft) => { resolveConflict(draft, computeModel(draft, now), c, choice, mem); });
  set({ mem });
}
