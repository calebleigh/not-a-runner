// Side-scrolling strips (the consistency squares, stat chips, mile splits, and any added later) can
// be dragged with a mouse, the way a finger already drags them. One listener for the whole app: it
// finds the nearest strip under the pointer that scrolls sideways. A drag doesn't count as a tap.

const DRAG_PX = 5;

function sideScroller(el: Element | null): HTMLElement | null {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (!(n instanceof HTMLElement) || n.scrollWidth <= n.clientWidth + 1) continue;
    const o = getComputedStyle(n).overflowX;
    if (o === "auto" || o === "scroll") return n;
  }
  return null;
}

export function installDragScroll() {
  let el: HTMLElement | null = null, startX = 0, startLeft = 0, dragged = false;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    el = sideScroller(e.target as Element);
    if (!el) return;
    startX = e.clientX; startLeft = el.scrollLeft; dragged = false;
  });
  document.addEventListener("pointermove", (e) => {
    // Some input sources only report moves with the button held; start the drag from the first one.
    if (!el && e.pointerType === "mouse" && e.buttons & 1 && !dragged) {
      el = sideScroller(e.target as Element);
      if (el) { startX = e.clientX; startLeft = el.scrollLeft; }
    }
    if (!el) return;
    if (!(e.buttons & 1)) { el = null; return; }
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) < DRAG_PX) return;
    if (!dragged) { dragged = true; el.style.cursor = "grabbing"; el.style.userSelect = "none"; }
    el.scrollLeft = startLeft - dx;
    e.preventDefault();
  });
  const end = () => {
    if (el && dragged) { el.style.cursor = ""; el.style.userSelect = ""; }
    el = null;
    // The swallowed click comes right after; if it never does (let go elsewhere), forget the drag.
    setTimeout(() => { dragged = false; }, 0);
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  // The click that ends a drag would open whatever square it started on; swallow it.
  document.addEventListener("click", (e) => {
    if (dragged) { dragged = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
}
