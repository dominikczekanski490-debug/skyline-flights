import "./v63.css";
// Pitched fitBounds leaves the airport tiny (it fits the far horizon too), so fit flat, then tilt and zoom in a bit.
const fit = (m: any, b: number[], now: boolean) => { const c = m.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 10, bearing: m.getBearing() }); if (!c) return; const z = Math.min(15.3, (c.zoom ?? 14) + 0.7); m.easeTo({ center: c.center, zoom: z, pitch: 60, duration: now || still() ? 0 : 700 }); };
// v63: 3D airport for ANY airport (OpenStreetMap shapes via /api/apt3d) + live ADS-B traffic drawn as simple 3D aircraft
// (Skyline's own procedural low-poly models, one per size class, tinted with the airline's brand colours — NOT exact liveries).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import * as THREE from "three";
import { api } from "./lib";
import { liv } from "./v36";
maplibregl.setWorkerUrl(workerUrl);

const still = () => document.documentElement.dataset.skin === "eink" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const eink = () => document.documentElement.dataset.skin === "eink";
const css = (v: string, d: string) => (getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d);
const webgl = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
export const fam = (t = "") => /^(A33|A34|A35|A38|B74|B76|B77|B78|IL96|MD11|A30|A310)/.test(t) ? "wide" : /^(AT|DH8|E1|E2|E5|E7|CRJ|SF3|J31|BE|C2|P18|C30|C29|PC|DHC|SW|D32)/.test(t) ? "reg" : "narrow";
const FAM = { narrow: "narrow-body", wide: "wide-body", reg: "regional / turboprop / small" } as const;
const isPlane = (a: any) => a.type && !/^(GND|TWR|SERV|EMER|N\/A)$/.test(a.type) && a.lat != null;
const ago = (t: string) => { const m = Math.round((Date.now() - +new Date(t)) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago"; };

// ---- procedural aircraft (metres, nose along +y, up +z) ----
function model(f: "narrow" | "wide" | "reg", c1: string, c2: string) {
  const L = f === "wide" ? 64 : f === "reg" ? 27 : 38, R = f === "wide" ? 3.1 : f === "reg" ? 1.4 : 2, span = f === "wide" ? 62 : f === "reg" ? 27 : 35;
  const white = new THREE.MeshLambertMaterial({ color: eink() ? "#ffffff" : "#f4f6fa", side: THREE.DoubleSide }), m1 = new THREE.MeshLambertMaterial({ color: eink() ? "#222" : c1 , side: THREE.DoubleSide }), m2 = new THREE.MeshLambertMaterial({ color: eink() ? "#666" : c2 , side: THREE.DoubleSide }), grey = new THREE.MeshLambertMaterial({ color: "#9aa3b2" , side: THREE.DoubleSide });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L * 0.78, 14), white); body.position.set(0, 0, R + 2); g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.scale.set(1, 1.7, 1); nose.position.set(0, L * 0.39, R + 2); g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(R, L * 0.2, 14), white); tail.rotation.x = Math.PI; tail.position.set(0, -L * 0.49, R + 2 + R * 0.35); g.add(tail);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, L * 0.78, 14, 1, true, Math.PI * 0.75, Math.PI * 0.5), m1); belly.position.copy(body.position); g.add(belly);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(span, L * 0.13, 0.5), grey); wing.position.set(0, -L * 0.02, R + 1.2); g.add(wing);
  const hs = new THREE.Mesh(new THREE.BoxGeometry(span * 0.35, L * 0.07, 0.35), grey); hs.position.set(0, -L * 0.45, R + 2.3); g.add(hs);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, L * 0.14, L * 0.2), m1); fin.position.set(0, -L * 0.45, R * 2 + 2 + L * 0.09); fin.rotation.x = -0.35; g.add(fin);
  const eng = (x: number) => { const e = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.45, R * 0.45, L * 0.1, 10), m2); e.position.set(x, L * 0.03, R + 0.4); g.add(e); };
  const ex = span * (f === "wide" ? 0.2 : f === "reg" ? 0.22 : 0.17); eng(ex); eng(-ex);
  g.rotation.x = 0; // up already +z after we map
  // CylinderGeometry is along y already = nose axis; good.
  return g;
}

type Fix = { a: any; lon: number; lat: number; t: number; x: number; y: number; z: number; obj?: THREE.Group; mk?: maplibregl.Marker };

export default function Apt3D({ iata, onClose }: { iata: string; onClose: () => void }) {
  const el = useRef<HTMLDivElement>(null), mref = useRef<maplibregl.Map | undefined>(undefined), fx = useRef<Record<string, Fix>>({}), trails = useRef<Record<string, [number, number][]>>({});
  const [ok] = useState(webgl); const [err, setErr] = useState(""); const [info, setInfo] = useState<any>(null); const [n, setN] = useState<number | null>(null);
  const [sel, setSel] = useState<any>(null); const [flat, setFlat] = useState(false); const [brg, setBrg] = useState(0); const [lay, setLay] = useState(false); const [bld, setBld] = useState(true); const [sat, setSat] = useState(false); const [hist, setHist] = useState(false); const [load, setLoad] = useState("Loading OpenStreetMap shapes…");
  useEffect(() => {
    if (!ok || !el.current) return; let stop = false;
    const bg = css("--bg", "#0b1220"), fg = css("--fg", "#e8eefc"), accent = eink() ? "#000" : css("--accent", "#6aa8ff");
    const dark = (() => { const h = bg.replace("#", ""); if (h.length < 6) return true; return parseInt(h.slice(0, 2), 16) * .3 + parseInt(h.slice(2, 4), 16) * .59 + parseInt(h.slice(4, 6), 16) * .11 < 128; })() && !eink();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: el.current, center: [0, 0], zoom: 2, pitch: 60, bearing: -20, maxPitch: 75, maxZoom: 19, pixelRatio: Math.min(window.devicePixelRatio, 2), attributionControl: { compact: true }, canvasContextAttributes: { antialias: true },
        style: { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: { base: { type: "raster", tiles: [dark ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 16, attribution: "Basemap © Esri" },
            sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagery © Esri, Maxar" },
            apt: { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "Airport shapes © OpenStreetMap contributors (ODbL)" }, trl: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
          layers: [{ id: "bg", type: "background", paint: { "background-color": eink() ? "#fff" : bg } }, { id: "base", type: "raster", source: "base", paint: { "raster-opacity": eink() ? 0.35 : 0.75 } }, { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" }, paint: { "raster-brightness-max": 0.8 } },
            { id: "apron", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "apron"], paint: { "fill-color": eink() ? "#e6e6e6" : dark ? "#2a3344" : "#cdd2dc", "fill-opacity": 0.85 } },
            { id: "twy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": eink() ? "#bbb" : dark ? "#3c475c" : "#aab2c0", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "twyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], paint: { "line-color": eink() ? "#000" : "#e6c84a", "line-opacity": 0.8, "line-width": 1 } },
            { id: "twyl", type: "symbol", source: "apt", minzoom: 15, filter: ["all", ["==", ["get", "kind"], "taxiway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 11, "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#111", "text-halo-color": "#ffd400", "text-halo-width": 2 } },
            { id: "rwy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#333" : dark ? "#161b24" : "#4d5361", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "rwyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": "#fff", "line-dasharray": [4, 4], "line-width": 1.2 } },
            { id: "rwyl", type: "symbol", source: "apt", filter: ["all", ["==", ["get", "kind"], "runway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 12, "text-font": ["Open Sans Bold"] }, paint: { "text-color": fg, "text-halo-color": bg, "text-halo-width": 1.5 } },
            { id: "trl", type: "line", source: "trl", layout: { visibility: "none" }, paint: { "line-color": eink() ? "#000" : "#ffd166", "line-width": 2, "line-opacity": 0.8 } },
            { id: "bld", type: "fill-extrusion", source: "apt", filter: ["in", ["get", "kind"], ["literal", ["building", "bridge"]]], paint: { "fill-extrusion-color": eink() ? "#ddd" : dark ? "#55607a" : "#e3e6ec", "fill-extrusion-height": ["max", ["get", "h"], 4], "fill-extrusion-opacity": 0.9 } },
            { id: "term", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { "fill-extrusion-color": eink() ? "#bbb" : dark ? "#7d8db0" : "#f5f6f8", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.95 } },
            { id: "twr", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#888" : "#f2b84b", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.95 } },
            { id: "signs", type: "symbol", source: "apt", filter: ["!=", ["coalesce", ["get", "sign"], ""], ""], layout: { "text-field": ["upcase", ["get", "sign"]], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 17, 20], "text-font": ["Open Sans Bold"], "text-max-width": 14, "text-letter-spacing": 0.08, "text-allow-overlap": true, "text-offset": [0, -1.2] }, paint: { "text-color": eink() ? "#000" : "#fff", "text-halo-color": eink() ? "#fff" : "#1d3a6e", "text-halo-width": 3 } },
            { id: "terml", type: "symbol", source: "apt", minzoom: 14.5, filter: ["all", ["==", ["get", "kind"], "terminal"], ["!=", ["coalesce", ["get", "label"], ""], ""]], layout: { "text-field": ["get", "label"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 17], "text-font": ["Open Sans Bold"], "text-max-width": 12, "symbol-z-order": "source" }, paint: { "text-color": eink() ? "#000" : dark ? "#fff" : "#1b2a4a", "text-halo-color": eink() ? "#fff" : dark ? "#111" : "#fff", "text-halo-width": 2.5 } }] } });
    } catch (e: any) { setErr("3D view could not start on this device (" + (e?.message || "WebGL error") + ")."); return; }
    mref.current = map; map.on("error", e => console.warn("apt3d", e?.error?.message)); map.on("rotate", () => setBrg(map.getBearing()));
    // three.js custom layer
    let scene: THREE.Scene, cam: THREE.Camera, ren: THREE.WebGLRenderer, origin: maplibregl.MercatorCoordinate, mpu = 1;
    const layer: any = { id: "planes3d", type: "custom", renderingMode: "3d",
      onAdd(m: maplibregl.Map, gl: WebGLRenderingContext) { scene = new THREE.Scene(); cam = new THREE.Camera(); scene.add(new THREE.AmbientLight(0xffffff, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(60, -80, 120); scene.add(d);
        ren = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); ren.autoClear = false; },
      render(_gl: any, o: any) { if (!origin) return; const now = Date.now(); const z = map.getZoom(); const k = Math.min(2.5, Math.max(1, Math.pow(2, (16.3 - z) * 0.6))); let moving = false;
        for (const f of Object.values(fx.current)) { if (!f.obj) continue; const a = f.a; let lon = a.lon, lat = a.lat;
          if (!still() && a.gs > 2 && a.track != null) { const dt = Math.min(12, (now - f.t) / 1000), dm = a.gs * 0.5144 * dt; lat += dm * Math.cos(a.track * Math.PI / 180) / 111320; lon += dm * Math.sin(a.track * Math.PI / 180) / (111320 * Math.cos(lat * Math.PI / 180)); moving = true; }
          const c = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0); const tx = (c.x - origin.x) / mpu, ty = -(c.y - origin.y) / mpu, tz = a.alt === "ground" ? 0 : Math.min(+a.alt || 0, 6000) * 0.3048;
          if (still()) { f.x = tx; f.y = ty; f.z = tz; } else { f.x += (tx - f.x) * 0.2; f.y += (ty - f.y) * 0.2; f.z += (tz - f.z) * 0.2; }
          f.obj.position.set(f.x, f.y, f.z); f.obj.scale.setScalar(k); f.obj.rotation.z = -((a.track ?? 0) * Math.PI / 180);
          if (f.mk) { const ll = new maplibregl.MercatorCoordinate(origin.x + f.x * mpu, origin.y - f.y * mpu, 0).toLngLat(); f.mk.setLngLat(ll); } }
        const M = new THREE.Matrix4().fromArray(o.defaultProjectionData.mainMatrix); const T = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new THREE.Vector3(mpu, -mpu, mpu));
        cam.projectionMatrix = M.multiply(T); ren.resetState(); ren.render(scene, cam); if (moving) map.triggerRepaint(); } };
    const sync = (L: any[]) => { const seen = new Set<string>();
      for (const a of L) { seen.add(a.hex); let f = fx.current[a.hex]; const cs = (a.flight || "").trim(); const l = liv(cs);
        if (!f) { const c = maplibregl.MercatorCoordinate.fromLngLat([a.lon, a.lat], 0); f = fx.current[a.hex] = { a, lon: a.lon, lat: a.lat, t: Date.now(), x: (c.x - origin.x) / mpu, y: -(c.y - origin.y) / mpu, z: 0 };
          f.obj = model(fam(a.type) as any, l ? l[0] : accent, l ? l[1] : "#8892a6"); scene.add(f.obj);
          const d = document.createElement("button"); d.className = "a3lbl"; d.innerHTML = `<i style="background:${l ? l[0] : "#8892a6"}"></i>${cs || a.reg || a.hex}`; d.onclick = () => setSel({ ...fx.current[a.hex].a });
          f.mk = new maplibregl.Marker({ element: d, anchor: "bottom", offset: [0, -14] }).setLngLat([a.lon, a.lat]).addTo(map); }
        f.a = a; f.t = Date.now(); const T = (trails.current[a.hex] ||= []); const last = T.at(-1); if (!last || last[0] !== a.lon || last[1] !== a.lat) T.push([a.lon, a.lat]); if (T.length > 60) T.shift(); }
      for (const k of Object.keys(fx.current)) if (!seen.has(k)) { const f = fx.current[k]; f.obj && scene.remove(f.obj); f.mk?.remove(); delete fx.current[k]; delete trails.current[k]; }
      (map.getSource("trl") as any)?.setData({ type: "FeatureCollection", features: Object.values(trails.current).filter(t => t.length > 1).map(c => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) });
      map.triggerRepaint(); };
    let ctr: [number, number] | null = null;
    const poll = async () => { if (!ctr || stop) return; try { const r = await api(`/overhead?lat=${ctr[1]}&lon=${ctr[0]}&r=6`); if (stop) return; const L = (r.list || []).filter(isPlane).filter((a: any) => a.alt === "ground" || (+a.alt || 99999) < 6000).slice(0, 40); setN(L.length); sync(L); setSel((s: any) => s ? { ...(fx.current[s.hex]?.a || s) } : s); } catch { } };
    map.on("load", async () => { map.addLayer(layer);
      try { const j = await api("/apt3d?iata=" + iata); if (stop) return; if (j.error) throw new Error(j.error); setInfo(j); ctr = j.center; origin = maplibregl.MercatorCoordinate.fromLngLat(j.center, 0); mpu = origin.meterInMercatorCoordinateUnits();
        (map.getSource("apt") as any).setData(j); const b = j.focus || j.bbox; fit(map, b, true); setLoad(""); poll(); }
      catch (e: any) { setLoad(""); setErr("Couldn't load the airport shapes: " + (e?.message || e) + ". OpenStreetMap's free Overpass service can be busy — try again in a minute."); } });
    const t = setInterval(poll, 8000);
    const clk = (e: any) => { let best: any = null, bd = 34; for (const f of Object.values(fx.current)) { if (!f.mk) continue; const p = map.project(f.mk.getLngLat()); const d = Math.hypot(p.x - e.point.x, p.y - e.point.y); if (d < bd) { bd = d; best = f.a; } } if (best) setSel({ ...best }); };
    map.on("click", clk);
    return () => { stop = true; clearInterval(t); for (const f of Object.values(fx.current)) f.mk?.remove(); fx.current = {}; trails.current = {}; map.remove(); };
  }, [ok, iata]);
  useEffect(() => { const m = mref.current; if (!m || !m.isStyleLoaded()) return; m.easeTo({ pitch: flat ? 0 : 60, duration: still() ? 0 : 700 }); }, [flat]);
  useEffect(() => { const m = mref.current; if (!m) return; const v = (id: string, on: boolean) => { try { m.setLayoutProperty(id, "visibility", on ? "visible" : "none"); } catch { } };
    ["bld", "term", "twr"].forEach(i => v(i, bld)); v("sat", sat); v("trl", hist); }, [bld, sat, hist]);
  return createPortal(<div className="a3">
    {ok && !err ? <div ref={el} className="a3map" /> : <div className="m3fb"><b>3D view isn't available</b><p className="muted sm">{err || "This browser has WebGL turned off, so the 3D airport can't be drawn."}</p></div>}
    {err && ok && <div className="a3err card sm">{err}</div>}
    <div className="a3top"><button className="a3btn" onClick={onClose} aria-label="Back">‹</button><div className="a3ttl"><b>{info?.name || iata}</b><span>{iata} · 3D · BETA</span></div>
      <button className="a3cmp" aria-label="Point north" onClick={() => mref.current?.easeTo({ bearing: 0, duration: still() ? 0 : 500 })}><svg viewBox="0 0 40 40" style={{ transform: `rotate(${-brg}deg)` }}><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeOpacity=".4" /><path d="M20 5 25 20H15z" fill="#e5484d" /><path d="M20 35 15 20h10z" fill="currentColor" opacity=".5" /><text x="20" y="15" fontSize="7" textAnchor="middle" fill="#fff">N</text></svg></button></div>
    {load && <div className="a3load card sm">{load}</div>}
    <div className="a3side"><button className={"a3btn" + (hist ? " on" : "")} aria-label="History trails" onClick={() => setHist(!hist)}>⟲</button><button className="a3btn" aria-label="Fit airport" onClick={() => { const b = info?.focus || info?.bbox; b && mref.current && fit(mref.current, b, false); }}>➤</button><button className={"a3btn" + (lay ? " on" : "")} aria-label="Layers" onClick={() => setLay(!lay)}>≋</button></div>
    {lay && <div className="a3lay card sm"><label><input type="checkbox" checked={bld} onChange={e => setBld(e.target.checked)} /> 3D buildings</label><label><input type="checkbox" checked={sat} onChange={e => setSat(e.target.checked)} /> Satellite photo</label><label><input type="checkbox" checked={hist} onChange={e => setHist(e.target.checked)} /> Trails (since you opened this)</label></div>}
    <button className="a3btn a3flat" onClick={() => setFlat(!flat)}>{flat ? "3D" : "2D"}</button>
    {!sel && <div className="a3note sm">{info ? <>{info.features.length} OpenStreetMap shapes{info.counts?.terminal ? ` · ${info.counts.terminal} terminal${info.counts.terminal > 1 ? "s" : ""}` : " · no terminal mapped in OSM"}</> : null}{n != null && <> · {n} live aircraft on or near the airport (ADS-B)</>}<br /><span className="faint">Planes are Skyline's simple 3D models per size class in airline colours — not exact liveries. Tap a plane or its label.</span></div>}
    {sel && <Sheet a={sel} iata={iata} onClose={() => setSel(null)} />}
  </div>, document.body);
}

function Sheet({ a, iata, onClose }: { a: any; iata: string; onClose: () => void }) {
  const cs = (a.flight || "").trim(); const l = liv(cs); const [route, setRoute] = useState<any>(undefined); const [ac, setAc] = useState<any>(null); const [open, setOpen] = useState(false);
  useEffect(() => { setRoute(undefined); setAc(null); setOpen(false); if (cs) api("/callsign/" + cs).then(r => setRoute(r.route || null)).catch(() => setRoute(null)); else setRoute(null);
    api("/acars/" + a.hex).then(setAc).catch(() => setAc({ error: true })); }, [a.hex]);
  const msgs = (ac?.list || ac?.messages || []) as any[]; const typed = msgs.filter(m => m.text && /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(m.text));
  const gnd = a.alt === "ground"; const f = fam(a.type);
  return <div className="a3sheet"><div className="a3grab" />
    <div className="row g8" style={{ alignItems: "center" }}><span className="a3logo" style={{ background: l ? l[0] : "#555", color: l ? l[1] : "#fff" }}>{cs.slice(0, 3) || "?"}</span><b className="a3cs">{cs || a.reg || a.hex.toUpperCase()}</b><span className="a3sub">{a.reg && a.reg !== cs ? a.reg : ""}</span><span className="a3sub">{a.type || ""}</span><button className="a3x" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="row between a3mid"><span className="muted">{l ? l[2] : a.desc || "Airline not known"}</span><span><b className="a3big">{a.gs != null ? Math.round(a.gs) : "–"}</b> <span className="muted sm">kt</span> &nbsp; <b className="a3big">{gnd ? "GND" : a.alt != null ? a.alt + " ft" : "–"}</b></span></div>
    {route === undefined ? <div className="muted sm a3rt">Looking up route…</div> : route ? <div className="a3rt row between"><div><b>{route.origin?.iata_code}</b><span>{route.origin?.municipality || route.origin?.name}</span></div><div className="a3line" /><div style={{ textAlign: "right" }}><b>{route.destination?.iata_code}</b><span>{route.destination?.municipality || route.destination?.name}</span></div></div> : <div className="muted sm a3rt">No route on file for this callsign.</div>}
    {route && <div className="faint sm">Route for this callsign from adsbdb — airlines reuse callsigns, so it can be out of date.</div>}
    <button className="a3acars" onClick={() => setOpen(!open)} disabled={!typed.length}><span className="tag">ACARS</span> {ac == null ? "checking…" : ac.error ? "couldn't reach airframes.io" : typed.length ? <>{typed.length} typed message{typed.length > 1 ? "s" : ""} · {ago(typed[0].t)}</> : msgs.length ? `${msgs.length} data-only message${msgs.length > 1 ? "s" : ""}, no typed text` : "no messages heard recently"}<span style={{ marginLeft: "auto" }}>{typed.length ? (open ? "▴" : "▾") : ""}</span></button>
    {open && typed.slice(0, 5).map((m, i) => <pre key={i} className="a3msg">{ago(m.t)} · {m.labelText}{"\n"}{m.text.slice(0, 400)}</pre>)}
    <div className="faint sm mt8">{gnd ? (a.gs ?? 0) < 1 ? "Stationary on the ground" : a.gs < 40 ? "Taxiing" : "Runway roll" : "Airborne near " + iata} · live ADS-B (adsb.lol) every 8 s · model: generic {FAM[f as keyof typeof FAM]}, airline colours (not the exact livery){!l && " — airline colours unknown, shown grey"}. ACARS from airframes.io volunteers.</div>
  </div>;
}

