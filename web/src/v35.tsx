import "./v35.css";
// 3D Manchester Airport (BETA). Lazy-loaded. Building shapes from OpenStreetMap via a prebuilt GeoJSON (scripts/build-man3d.mjs).
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "./lib";
maplibregl.setWorkerUrl(workerUrl);

const MAN: [number, number] = [-2.2750, 53.3537];
const css = (v: string, d: string) => (getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d);
const webgl = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
const plane = (rot: number, c: string) => `<div style="transform:rotate(${rot}deg)"><svg width="26" height="26" viewBox="0 0 24 24"><path fill="${c}" stroke="rgba(0,0,0,.55)" stroke-width=".8" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg></div>`;

export default function Man3D({ onClose }: { onClose: () => void }) {
  const el = useRef<HTMLDivElement>(null), m = useRef<maplibregl.Map | undefined>(undefined), marks = useRef<Record<string, maplibregl.Marker>>({});
  const [ok] = useState(webgl); const [err, setErr] = useState(""); const [sel, setSel] = useState<any>(null); const [n, setN] = useState<number | null>(null); const [route, setRoute] = useState<any>(null);
  useEffect(() => {
    if (!ok || !el.current) return;
    const accent = css("--accent", "#6aa8ff"), bg = css("--bg", "#0b1220"), fg = css("--fg", "#e8eefc");
    const dark = (() => { const h = bg.replace("#", ""); if (h.length < 6) return true; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return r * .3 + g * .59 + b * .11 < 128; })();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: el.current, center: MAN, zoom: 14.2, pitch: 60, bearing: -32, maxPitch: 70, minZoom: 12, maxZoom: 18, pixelRatio: Math.min(window.devicePixelRatio, 2), attributionControl: { compact: true },
        style: { version: 8, sources: { base: { type: "raster", tiles: [dark ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Basemap © Esri" },
          apt: { type: "geojson", data: "/man3d.geojson", attribution: "Airport shapes © OpenStreetMap contributors (ODbL)" } },
          layers: [{ id: "bg", type: "background", paint: { "background-color": bg } }, { id: "base", type: "raster", source: "base", paint: { "raster-opacity": 0.7 } },
            { id: "apron", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "apron"], paint: { "fill-color": dark ? "#2a3344" : "#c9ced8", "fill-opacity": 0.8 } },
            { id: "twy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], paint: { "line-color": dark ? "#3c475c" : "#b0b7c4", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 18, ["*", ["get", "w"], 2.6]] } },
            { id: "twyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], paint: { "line-color": "#e6c84a", "line-opacity": 0.7, "line-width": 1 } },
            { id: "rwy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": dark ? "#1a1f29" : "#5b6170", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 18, ["*", ["get", "w"], 2.6]] } },
            { id: "rwyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": "#fff", "line-dasharray": [4, 4], "line-width": 1.2 } },
            { id: "rwyl", type: "symbol", source: "apt", filter: ["all", ["==", ["get", "kind"], "runway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 12, "text-font": ["Open Sans Regular"] }, paint: { "text-color": fg, "text-halo-color": bg, "text-halo-width": 1.5 } },
            { id: "bld", type: "fill-extrusion", source: "apt", filter: ["in", ["get", "kind"], ["literal", ["building", "bridge"]]], paint: { "fill-extrusion-color": dark ? "#55607a" : "#d9dde6", "fill-extrusion-height": ["max", ["get", "h"], 4], "fill-extrusion-opacity": 0.9 } },
            { id: "term", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { "fill-extrusion-color": accent, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.92 } },
            { id: "twr", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": "#f2b84b", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.95 } }],
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf" } });
    } catch (e: any) { setErr("3D view could not start on this device (" + (e?.message || "WebGL error") + ")."); return; }
    m.current = map; map.on("error", e => console.warn("man3d", e?.error?.message));
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    let stop = false;
    const load = async () => {
      try { const r = await api(`/overhead?lat=${MAN[1]}&lon=${MAN[0]}&r=12`); if (stop) return; const L = (r.list || []).slice(0, 60); setN(L.length); const seen = new Set<string>();
        for (const a of L) { seen.add(a.hex); const gnd = a.alt === "ground"; const c = gnd ? "#ffd166" : accent; let mk = marks.current[a.hex];
          if (!mk) { const d = document.createElement("div"); d.className = "m3p"; d.onclick = () => setSel(a); mk = marks.current[a.hex] = new maplibregl.Marker({ element: d, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([a.lon, a.lat]).addTo(map); }
          mk.setLngLat([a.lon, a.lat]); mk.getElement().innerHTML = plane(a.track ?? 0, c); mk.getElement().onclick = () => setSel(a); }
        for (const k of Object.keys(marks.current)) if (!seen.has(k)) { marks.current[k].remove(); delete marks.current[k]; }
      } catch { /* keep last positions */ } };
    load(); const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); map.remove(); marks.current = {}; };
  }, [ok]);
  useEffect(() => { setRoute(null); const cs = (sel?.flight || "").trim(); if (cs) api("/callsign/" + cs).then(r => setRoute(r.route)).catch(() => {}); }, [sel?.hex]);
  const cs = (sel?.flight || "").trim();
  return <div className="m3d">
    <div className="m3top"><button className="chip" onClick={onClose}>‹ Back</button><b>Manchester in 3D</b><span className="m3beta">BETA</span></div>
    {ok && !err ? <div ref={el} className="m3map" /> : <div className="m3fb"><b>3D view isn't available here</b><p className="muted sm">{err || "This browser has WebGL turned off, so the 3D airport can't be drawn. The 2D board and map still work."}</p></div>}
    <div className="m3note">Beta · building shapes from OpenStreetMap, not an exact model{n != null && <> · {n} live aircraft within 12 nm (ADS-B, adsb.lol)</>}</div>
    {sel && <div className="m3card card"><div className="row between"><b>{cs || sel.reg || sel.hex}</b><button className="chip" onClick={() => setSel(null)}>✕</button></div>
      <div className="muted sm">{[sel.type, sel.reg].filter(Boolean).join(" · ")}</div>
      <div className="sm mt8">{sel.alt === "ground" ? "On the ground" : sel.alt != null ? `${sel.alt} ft` : "Altitude not reported"}{sel.gs != null && ` · ${Math.round(sel.gs)} kt`}{sel.track != null ? ` · heading ${Math.round(sel.track)}°` : " · heading not reported"}{sel.nm != null && ` · ${sel.nm} nm from MAN`}</div>
      {route && <div className="sm mt8">{route.origin?.iata_code} → {route.destination?.iata_code} <span className="faint">(route for this callsign from adsbdb, may be out of date)</span></div>}
      <div className="faint sm mt8">Live ADS-B position, updated every 10 s</div></div>}
  </div>;
}
