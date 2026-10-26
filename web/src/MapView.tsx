import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
maplibregl.setWorkerUrl(workerUrl);
import "maplibre-gl/dist/maplibre-gl.css";
import type { Flight } from "./lib";

const STYLES: Record<string, any> = {
  hybrid: { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf", sources: {
    sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
    lbl: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"], tileSize: 256 },
    rd: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"], tileSize: 256 } },
    layers: [{ id: "sat", type: "raster", source: "sat" }, { id: "rd", type: "raster", source: "rd", paint: { "raster-opacity": 0.55 } }, { id: "lbl", type: "raster", source: "lbl" }] },
  dark: { version: 8, sources: { sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagery © Esri, Maxar" }, lbl: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"], tileSize: 256 } }, layers: [{ id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": -0.75, "raster-brightness-max": 0.42, "raster-contrast": 0.15, "raster-hue-rotate": 200 } }, { id: "lbl", type: "raster", source: "lbl", paint: { "raster-opacity": 0.55 } }] },
  light: { version: 8, sources: { c: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "© Esri" } }, layers: [{ id: "c", type: "raster", source: "c" }] },
};
export const MAP_STYLES = Object.keys(STYLES);

function arc(a: [number, number], b: [number, number], n = 96) { // great-circle
  const r = Math.PI / 180, [l1, p1] = [a[0] * r, a[1] * r], [l2, p2] = [b[0] * r, b[1] * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2)); if (!d) return [a, b];
  const out: [number, number][] = []; for (let i = 0; i <= n; i++) { const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([Math.atan2(y, x) / r, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]); } return out;
}
const planeSvg = (rot: number, color = "#fff") => `<div style="transform:rotate(${rot}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))"><svg width="30" height="30" viewBox="0 0 24 24"><path fill="${color}" stroke="#000" stroke-width=".6" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg></div>`;

export default function MapView({ flights, live, style, radar, focus, locate, onPlane }: { flights: Flight[]; live: Record<string, any>; style: string; radar: boolean; focus?: Flight | null; locate: number; onPlane?: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null), map = useRef<maplibregl.Map | undefined>(undefined), marks = useRef<maplibregl.Marker[]>([]);
  useEffect(() => { map.current = new maplibregl.Map({ container: el.current!, style: STYLES[style], center: [-2.27, 53.35], zoom: 7.5, attributionControl: { compact: true }, pixelRatio: Math.min(window.devicePixelRatio || 1, /iPhone|iPad/.test(navigator.userAgent) ? 2 : 3), maxTileCacheSize: 120, fadeDuration: 0 } as any); return () => map.current?.remove(); }, []);
  useEffect(() => { map.current?.setStyle(STYLES[style]); }, [style]);
  const draw = () => {
    const m = map.current; if (!m || !m.isStyleLoaded()) return;
    const feats = flights.filter(f => f.origin?.lon && f.destination?.lon).map(f => ({ type: "Feature", properties: { id: f.id, focus: focus?.id === f.id ? 1 : 0 }, geometry: { type: "LineString", coordinates: arc([f.origin!.lon!, f.origin!.lat!], [f.destination!.lon!, f.destination!.lat!]) } }));
    const data: any = { type: "FeatureCollection", features: feats };
    if (m.getSource("routes")) (m.getSource("routes") as any).setData(data);
    else { m.addSource("routes", { type: "geojson", data }); m.addLayer({ id: "routes-glow", type: "line", source: "routes", paint: { "line-color": "#6aa8ff", "line-width": 10, "line-blur": 8, "line-opacity": 0.55 } }); m.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": ["case", ["==", ["get", "focus"], 1], "#8fc2ff", "#c9dcff"], "line-width": ["case", ["==", ["get", "focus"], 1], 3, 2], "line-opacity": 0.85, "line-dasharray": [2, 1.2] } }); }
    if (radar) fetch("https://api.rainviewer.com/public/weather-maps.json").then(r => r.json()).then(j => { const p = j.radar.past.at(-1); if (!m.getSource("radar")) { m.addSource("radar", { type: "raster", tiles: [`${j.host}${p.path}/256/{z}/{x}/{y}/2/1_1.png`], tileSize: 256, attribution: "Radar © RainViewer" }); m.addLayer({ id: "radar", type: "raster", source: "radar", paint: { "raster-opacity": 0.7 } }); } }).catch(() => {});
    else if (m.getLayer("radar")) { m.removeLayer("radar"); m.removeSource("radar"); }
    marks.current.forEach(x => x.remove()); marks.current = [];
    const aps = new Map<string, any>(); flights.forEach(f => [f.origin, f.destination].forEach(a => a?.lon && aps.set(a.iata, a)));
    aps.forEach(a => { const d = document.createElement("div"); d.className = "apmark"; d.innerHTML = `<span class="dot"></span><b>${a.city || a.name}</b><i>${a.iata}</i>`; marks.current.push(new maplibregl.Marker({ element: d, anchor: "left", offset: [-7, 0] }).setLngLat([a.lon, a.lat]).addTo(m)); });
    Object.entries(live).forEach(([id, p]) => { if (!p?.lat) return; const d = document.createElement("div"); d.className = "liveplane"; d.innerHTML = planeSvg(p.track || 0, focus?.id === id ? "#4da3ff" : "#fff"); d.onclick = () => onPlane?.(id);
      marks.current.push(new maplibregl.Marker({ element: d }).setLngLat([p.lon, p.lat]).addTo(m)); });
  };
  useEffect(() => { const m = map.current!; draw(); m.on("styledata", draw); return () => { m.off("styledata", draw); }; });
  useEffect(() => { const m = map.current; if (!m || !focus?.origin?.lon || !focus.destination?.lon) return; const p = live[focus.id];
    if (p?.lat) { m.flyTo({ center: [p.lon, p.lat], zoom: 6, padding: { bottom: window.innerHeight * 0.45, top: 0, left: 0, right: 0 } }); return; }
    const b = new maplibregl.LngLatBounds(); arc([focus.origin.lon, focus.origin.lat!], [focus.destination.lon, focus.destination.lat!]).forEach(c => b.extend(c as any));
    m.fitBounds(b, { padding: { top: 90, left: 50, right: 50, bottom: window.innerHeight * 0.5 }, maxZoom: 8, duration: 900 }); }, [focus?.id]);
  useEffect(() => { if (!locate) return; navigator.geolocation?.getCurrentPosition(p => { map.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 9 });
    const d = document.createElement("div"); d.className = "me"; marks.current.push(new maplibregl.Marker({ element: d }).setLngLat([p.coords.longitude, p.coords.latitude]).addTo(map.current!)); }); }, [locate]);
  return <div ref={el} className="map" />;
}
