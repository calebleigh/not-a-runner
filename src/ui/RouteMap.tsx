import { useEffect, useRef, useSyncExternalStore } from "react";
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
  const el = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!spec || !el.current) return;
    let map: import("maplibre-gl").Map | null = null, dead = false;
    (async () => {
      const ml = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      // The map draws tiles in a worker; tell it where the bundled worker file is.
      ml.setWorkerUrl((await import("maplibre-gl/dist/maplibre-gl-worker.mjs?url")).default);
      if (dead || !el.current) return;
      const pts = decodeRoute(spec.route).map(([lat, lon]) => [lon, lat] as [number, number]);
      const light = document.documentElement.dataset.mode === "light";
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff7a1a";
      const bounds = pts.reduce((b, p) => b.extend(p), new ml.LngLatBounds(pts[0], pts[0]));
      map = new ml.Map({
        container: el.current, style: STYLE(light), bounds, fitBoundsOptions: { padding: 48 },
        attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.on("load", () => {
        if (!map) return;
        map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } } });
        map.addLayer({ id: "route-edge", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": light ? "#ffffff" : "#000000", "line-width": 8, "line-opacity": 0.5 } });
        map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": accent, "line-width": 5 } });
        map.addSource("ends", { type: "geojson", data: { type: "FeatureCollection", features: [
          { type: "Feature", properties: { c: "#3fb950" }, geometry: { type: "Point", coordinates: pts[0] } },
          { type: "Feature", properties: { c: accent }, geometry: { type: "Point", coordinates: pts[pts.length - 1] } },
        ] } });
        map.addLayer({ id: "ends", type: "circle", source: "ends", paint: { "circle-radius": 7, "circle-color": ["get", "c"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      });
    })();
    return () => { dead = true; map?.remove(); };
  }, [spec]);

  if (!spec) return null;
  return (
    <div className="routemap" role="dialog" aria-label="Route map">
      <div className="routemap-map" ref={el} />
      <div className="routemap-top">
        <button className="hicon routemap-close" aria-label="Close map" onClick={closeRouteMap}><Icon.close /></button>
        <div className="routemap-title"><b>{spec.title}</b>{spec.detail && <small>{spec.detail}</small>}</div>
      </div>
    </div>
  );
}
