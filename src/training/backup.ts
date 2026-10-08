// Backup codes: "SGH1." + base64(UTF-8 JSON). Same format as the prototype so old codes keep working.
import { emptyState } from "./types";
import type { State } from "./types";

export const BACKUP_PREFIX = "SGH1.";
export const STATE_KEYS = ["done", "logs", "gear", "swaps", "weights", "settings", "extras", "steps", "plan"] as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Fills in missing sections so older or partial saves load safely. */
export function normalizeState(raw: unknown): State {
  const s = emptyState();
  if (!isObj(raw)) return s;
  for (const k of STATE_KEYS) if (isObj(raw[k])) (s as unknown as Record<string, unknown>)[k] = raw[k];
  for (const [d, arr] of Object.entries(s.extras)) if (!Array.isArray(arr)) delete s.extras[d];
  return s;
}

export function encodeBackup(state: State): string {
  const o: Record<string, unknown> = { v: 1 };
  for (const k of STATE_KEYS) o[k] = state[k];
  return BACKUP_PREFIX + toBase64(JSON.stringify(o));
}

/** Throws on anything that isn't a valid backup code. */
export function decodeBackup(code: string): State {
  const raw = code.replace(/\s+/g, "");
  if (!raw.startsWith(BACKUP_PREFIX)) throw new Error("Not a backup code");
  const o: unknown = JSON.parse(fromBase64(raw.slice(BACKUP_PREFIX.length)));
  if (!isObj(o)) throw new Error("Not a backup code");
  return normalizeState(o);
}

/** Import merges rather than replaces: incoming entries win, extras are unioned. */
export function mergeState(base: State, incoming: State): State {
  const out: State = { ...base };
  for (const k of STATE_KEYS) {
    if (k === "extras") {
      const extras = { ...base.extras };
      for (const [d, arr] of Object.entries(incoming.extras)) {
        const have = extras[d] || [];
        const seen = new Set(have.map((x) => JSON.stringify(x)));
        extras[d] = [...have, ...arr.filter((x) => !seen.has(JSON.stringify(x)))];
      }
      out.extras = extras;
    } else if (k === "plan") {
      // The plan profile is replaced as a whole, never merged field by field.
      const plan = incoming.plan ?? base.plan;
      if (plan) out.plan = plan; else delete out.plan;
    } else {
      (out as unknown as Record<string, unknown>)[k] = { ...base[k], ...incoming[k] };
    }
  }
  return out;
}
