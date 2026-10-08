// Preview-only mirroring: with ?mirror in the URL (the Fold preview page sets it), each copy of the
// app broadcasts what it does so the other screen follows. Off in normal use.
import { useCallback, useEffect, useState } from "react";

const enabled = typeof window !== "undefined" && "BroadcastChannel" in window && new URLSearchParams(location.search).has("mirror");
const channel = enabled ? new BroadcastChannel("fold-preview-mirror") : null;
const self = Math.random().toString(36).slice(2);

interface Msg { from: string; type: string; payload: unknown }

export function mirrorSend(type: string, payload: unknown) {
  channel?.postMessage({ from: self, type, payload } satisfies Msg);
}

export function onMirror<T>(type: string, fn: (payload: T) => void): () => void {
  if (!channel) return () => {};
  const h = (e: MessageEvent<Msg>) => { if (e.data.from !== self && e.data.type === type) fn(e.data.payload as T); };
  channel.addEventListener("message", h);
  return () => channel.removeEventListener("message", h);
}

/** useState that stays the same on both preview screens. */
export function useMirroredState<T>(key: string, initial: T | (() => T)): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => onMirror<T>("state:" + key, setV), [key]);
  const set = useCallback((n: T) => { setV(n); mirrorSend("state:" + key, n); }, [key]);
  return [v, set];
}

/** Mirrors scroll position as a fraction, since the two screens lay out differently. */
export function useMirroredScroll(key: string, getEl: () => HTMLElement | null) {
  useEffect(() => {
    if (!channel) return;
    let quietUntil = 0, raf = 0;
    const target = () => getEl() || document.scrollingElement;
    const scroller = () => (getEl() ? getEl()! : window);
    const onScroll = () => {
      if (performance.now() < quietUntil) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = target();
        if (!t) return;
        const max = t.scrollHeight - t.clientHeight;
        mirrorSend("scroll:" + key, max > 0 ? t.scrollTop / max : 0);
      });
    };
    const off = onMirror<number>("scroll:" + key, (f) => {
      const t = target();
      if (!t) return;
      quietUntil = performance.now() + 150;
      t.scrollTop = f * (t.scrollHeight - t.clientHeight);
    });
    const s = scroller();
    s.addEventListener("scroll", onScroll, { passive: true });
    return () => { off(); s.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [key, getEl]);
}
