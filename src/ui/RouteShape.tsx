import { decodeRoute } from "../training";

/** The outline of a tracked route (no map, just its shape), scaled to fit and kept to true proportions. */
export function RouteShape({ route, size = 64 }: { route?: string; size?: number }) {
  if (!route) return null;
  const pts = decodeRoute(route);
  if (pts.length < 2) return null;
  // Longitude degrees shrink toward the poles; scale them so the shape isn't stretched.
  const k = Math.cos((pts[0][0] * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0]);
  const minX = Math.min(...xs), minY = Math.min(...ys), w = Math.max(...xs) - minX || 1e-9, h = Math.max(...ys) - minY || 1e-9;
  const s = (size - 8) / Math.max(w, h), ox = (size - w * s) / 2, oy = (size - h * s) / 2;
  const d = xs.map((x, i) => `${i ? "L" : "M"}${(ox + (x - minX) * s).toFixed(1)} ${(oy + (ys[i] - minY) * s).toFixed(1)}`).join("");
  const [ex, ey] = [ox + (xs.at(-1)! - minX) * s, oy + (ys.at(-1)! - minY) * s];
  return (
    <svg className="routeshape" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Route shape">
      <path d={d} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="3" style={{ fill: "var(--accent)" }} />
    </svg>
  );
}
