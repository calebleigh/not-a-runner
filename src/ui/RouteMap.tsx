import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { decodeRoute } from "../training";
import { Icon } from "./icons";
import { RouteShape } from "./RouteShape";

// A tracked route on a real map. Maps come from OpenFreeMap (OpenStreetMap data, free, no key), in
// the app's light or dark look. The map library loads only when a map is opened.

export interface RouteMapSpec { route: string; title: string; detail?: string }

let shown: RouteMapSpec | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function openRouteMap(spec: RouteMapSpec) { shown = spec; emit(); }
export function closeRouteMap() { shown = null; emit(); }
const useShown = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => shown);

const STYLE = (light: boolean) => `https://tiles.openfreemap.org/styles/${light ? "positron" : "dark"}`;

/** The route outline as a button that opens the map. */
export function RouteThumb({ route, size, title, detail }: { route?: string; size: number } & Omit<RouteMapSpec, "route">) {
  if (!route || decodeRoute(route).length < 2) return null;
  return (
    <button className="routethumb" aria-label="Show route on a map" onClick={() => openRouteMap({ route, title, detail })}>
      <RouteShape route={route} size={size} />
    </button>
  );
}

/** Full-screen map, mounted once in the app shell. */
export function RouteMapScreen() {
  const spec = useShown();

  useEffect(() => {
    if (!spec) return;
    document.body.classList.add("tracking");
    // Android back closes the map instead of leaving the app.
    let back: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) import("@capacitor/app").then(({ App }) => App.addListener("backButton", closeRouteMap)).then((h) => { back = h; });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRouteMap(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("tracking"); document.removeEventListener("keydown", onKey); back?.remove(); };
  }, [spec]);

  if (!spec) return null;
  return (
    <div className="routemap" role="dialog" aria-label="Route map">
      <RouteMapView className="routemap-map" points={decodeRoute(spec.route)} />
      <div className="routemap-top">
        <button className="hicon routemap-close" aria-label="Close map" onClick={closeRouteMap}><Icon.close /></button>
        <div className="routemap-title"><b>{spec.title}</b>{spec.detail && <small>{spec.detail}</small>}</div>
      </div>
    </div>
  );
}

type ML = typeof import("maplibre-gl");
type Pt = [number, number];
const lngLat = (pts: Pt[]) => pts.map(([lat, lon]) => [lon, lat] as Pt);

async function loadMaplibre(): Promise<ML> {
  const ml = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");
  // The map draws tiles in a worker; tell it where the bundled worker file is.
  ml.setWorkerUrl((await import("maplibre-gl/dist/maplibre-gl-worker.mjs?url")).default);
  return ml;
}

function routeData(pts: Pt[]) {
  const ll = lngLat(pts);
  return {
    line: { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: ll } },
    ends: { type: "FeatureCollection" as const, features: ll.length ? [
      { type: "Feature" as const, properties: { c: "#3fb950" }, geometry: { type: "Point" as const, coordinates: ll[0] } },
      { type: "Feature" as const, properties: { c: "accent" }, geometry: { type: "Point" as const, coordinates: ll[ll.length - 1] } },
    ] : [] },
  };
}

/**
 * A map with a route drawn on it. Still: fits the whole route. Live: follows the newest point as it
 * comes in, until you drag the map (then a button brings it back).
 */
export function RouteMapView({ points, live = false, className }: { points: Pt[]; live?: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const ready = useRef(false);
  const latest = useRef(points);
  latest.current = points;
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  followRef.current = follow;

  useEffect(() => {
    if (!el.current) return;
    let dead = false;
    (async () => {
      const ml = await loadMaplibre();
      if (dead || !el.current) return;
      const pts = latest.current;
      const light = document.documentElement.dataset.mode === "light";
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff7a1a";
      const ll = lngLat(pts);
      const m = new ml.Map({
        container: el.current, style: STYLE(light),
        ...(live || ll.length < 2
          ? { center: ll.at(-1) ?? [-98.5, 39.8], zoom: ll.length ? 16 : 3 }
          : { bounds: ll.reduce((b, p) => b.extend(p), new ml.LngLatBounds(ll[0], ll[0])), fitBoundsOptions: { padding: 48 } }),
        // The required map credit is our own small button (below), so it never covers the map.
        attributionControl: false, pitchWithRotate: false, dragRotate: false,
      });
      map.current = m;
      m.touchZoomRotate.disableRotation();
      m.on("dragstart", () => { if (live) setFollow(false); });
      m.on("load", () => {
        const d = routeData(latest.current);
        m.addSource("route", { type: "geojson", data: d.line });
        m.addLayer({ id: "route-edge", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": light ? "#ffffff" : "#000000", "line-width": 8, "line-opacity": 0.5 } });
        m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": accent, "line-width": 5 } });
        m.addSource("ends", { type: "geojson", data: d.ends });
        m.addLayer({ id: "ends", type: "circle", source: "ends", paint: { "circle-radius": 7, "circle-color": ["match", ["get", "c"], "accent", accent, ["get", "c"]], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        ready.current = true;
      });
    })();
    return () => { dead = true; ready.current = false; map.current?.remove(); map.current = null; };
    // The map is made once; new points are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live: draw new points and keep the newest in view.
  const n = points.length;
  useEffect(() => {
    const m = map.current;
    if (!live || !m || !ready.current || !n) return;
    const d = routeData(points);
    (m.getSource("route") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(d.line);
    (m.getSource("ends") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(d.ends);
    if (followRef.current) m.easeTo({ center: lngLat([points[n - 1]])[0], zoom: Math.max(m.getZoom(), 15), duration: 600 });
  }, [live, n, points]);

  const recenter = () => {
    setFollow(true);
    const m = map.current;
    if (m && n) m.easeTo({ center: lngLat([points[n - 1]])[0], zoom: Math.max(m.getZoom(), 15), duration: 400 });
  };

  return (
    <div className={"mapview " + (className ?? "")}>
      <div className="mapview-map" ref={el} />
      {live && !follow && <button className="chip mapview-recenter" onClick={recenter}>Recenter</button>}
      <MapCredit />
    </div>
  );
}

/** The map's required credit: a small "i" that opens one line of links. */
function MapCredit() {
  const [open, setOpen] = useState(false);
  return (
    <div className={"mapcredit" + (open ? " open" : "")}>
      {open && (
        <span>
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">&copy; OpenMapTiles</a>{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap contributors</a>
        </span>
      )}
      <button aria-label={open ? "Hide map credits" : "Map credits"} aria-expanded={open} onClick={() => setOpen(!open)}>i</button>
    </div>
  );
}
