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

/**
 * Mirrors scroll position as a fraction, since the two screens lay out differently.
 * With `selector`, the scrolling element is that descendant of getEl() (it may be replaced over time).
 */
export function useMirroredScroll(key: string, getEl: () => HTMLElement | null, selector?: string) {
  useEffect(() => {
    if (!channel) return;
    let quietUntil = 0, raf = 0;
    const target = () => {
      const el = getEl();
      return selector ? el?.querySelector<HTMLElement>(selector) ?? null : el || document.scrollingElement;
    };
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
    // With a selector, listen in the capture phase so scrolls inside a replaced child still reach us.
    const s = scroller(), capture = !!selector;
    s.addEventListener("scroll", onScroll, { passive: true, capture });
    return () => { off(); s.removeEventListener("scroll", onScroll, { capture }); cancelAnimationFrame(raf); };
  }, [key, getEl, selector]);
}
