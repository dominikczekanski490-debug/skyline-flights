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

// ---- procedural aircraft (metres, nose along +y, up +z). Skyline's own generic shapes per size class, not real type models. ----
const flat = (pts: number[][], depth: number, m: THREE.Material) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return new THREE.Mesh(g, m); };
// vertical shape: u along y (nose), v along z (up), thin along x
const vert = (pts: number[][], depth: number, m: THREE.Material) => { const o = flat(pts, depth, m); o.geometry.rotateX(Math.PI / 2); o.geometry.rotateZ(Math.PI / 2); return o; };
function model(f: "narrow" | "wide" | "reg", c1: string, c2: string) {
  const P = f === "wide" ? { L: 64, R: 2.9, span: 60, sweep: 0.55, gear: 2.6, eng: 1.5 } : f === "reg" ? { L: 28, R: 1.35, span: 27, sweep: 0.25, gear: 1.2, eng: 0.7 } : { L: 38, R: 1.95, span: 35, sweep: 0.45, gear: 1.7, eng: 1.0 };
  const { L, R, span, sweep, gear } = P; const E = eink();
  const mat = (c: string, sh = 40) => new THREE.MeshPhongMaterial({ color: c, shininess: sh, side: THREE.DoubleSide });
  const white = mat(E ? "#ffffff" : "#f3f5f9", 60), m1 = mat(E ? "#222222" : c1), m2 = mat(E ? "#777777" : c2), grey = mat(E ? "#bbbbbb" : "#c5cbd5", 30), dark = mat("#1b2230", 10), metal = mat("#8d96a6", 80);
  const g = new THREE.Group(), zc = gear + R;
  // fuselage: lathe profile (radius, y) from tail tip to nose tip
  const prof: [number, number][] = [[0.05, -L / 2], [R * 0.25, -L / 2 + L * 0.04], [R * 0.6, -L / 2 + L * 0.12], [R * 0.92, -L / 2 + L * 0.24], [R, -L / 2 + L * 0.32], [R, L / 2 - L * 0.16], [R * 0.93, L / 2 - L * 0.09], [R * 0.72, L / 2 - L * 0.045], [R * 0.4, L / 2 - L * 0.013], [0.05, L / 2]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24), white); body.position.z = zc; body.scale.z = 1.04; g.add(body);
  // tail cone sweeps up a little: lift the rear by tilting a copy-free trick (shift tail section via fin base instead)
  const seg = (r: number, len: number, y: number, th0: number, th: number, m: THREE.Material) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, true, th0, th), m); c.position.set(0, y, zc); g.add(c); };
  const cl = L * 0.5, cy = (L / 2 - L * 0.16 + (-L / 2 + L * 0.32)) / 2;
  seg(R * 1.01, cl, cy, Math.PI / 2 - 0.42, 0.07, dark); seg(R * 1.01, cl, cy, -Math.PI / 2 + 0.35, 0.07, dark); // window rows
  seg(R * 1.012, cl * 1.05, cy, Math.PI - 0.75, 1.5, m1);                        // belly in airline colour 1
  seg(R * 1.013, cl * 1.05, cy, Math.PI / 2 + 0.55, 0.06, m2); seg(R * 1.013, cl * 1.05, cy, -Math.PI / 2 - 0.61, 0.06, m2); // cheatlines
  const ck = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.99, R * 0.99, L * 0.025, 24, 1, true, -0.55, 1.1), dark); ck.position.set(0, L / 2 - L * 0.06, zc + R * 0.12); ck.scale.set(0.95, 1, 0.9); g.add(ck); // cockpit windows
  // wings (swept, tapered, dihedral) + winglets
  const rc = L * (f === "reg" ? 0.11 : 0.2), tc = rc * 0.3, y0 = L * 0.06, sw = span / 2 * sweep;
  for (const s of [1, -1]) {
    const w = flat([[s * R * 0.6, y0], [s * span / 2, y0 - sw], [s * span / 2, y0 - sw - tc], [s * R * 0.6, y0 - rc]], 0.45, grey); w.position.z = zc - R * 0.55; w.rotation.y = s * -0.06; g.add(w);
    const wl = vert([[-sw - tc, 0], [-sw - tc * 0.2, 0], [-sw - tc * 0.1 - 1, span * 0.045], [-sw - tc * 0.7 - 1, span * 0.045]].map(([u, v]) => [u + y0, v]), 0.25, m1); wl.position.set(s * span / 2, 0, zc - R * 0.55 + span / 2 * 0.06); g.add(wl);
    const xs = f === "wide" && false ? [0.22, 0.4] : [f === "reg" ? 0.2 : 0.32];
    for (const k of xs) { const x = s * span / 2 * k, yy = y0 - sw * k + rc * 0.15, er = P.eng * (f === "wide" ? 1.9 : 1);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(er, er * 0.8, L * (f === "reg" ? 0.11 : 0.12), 18), m2); n.position.set(x, yy, zc - R * 0.55 - er * 0.9); g.add(n);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(er * 0.92, 18), metal); fan.rotation.x = -Math.PI / 2; fan.position.set(x, yy + L * 0.061, zc - R * 0.55 - er * 0.9); g.add(fan);
      const py = new THREE.Mesh(new THREE.BoxGeometry(0.3, L * 0.06, er * 0.9), grey); py.position.set(x, yy - L * 0.02, zc - R * 0.55 - er * 0.3); g.add(py); }
  }
  // horizontal stabilisers
  const hy = -L / 2 + L * 0.13, hs = span * (f === "reg" ? 0.3 : 0.34) / 2, hc = L * 0.1;
  for (const s of [1, -1]) { const h = flat([[s * R * 0.3, hy], [s * hs, hy - hs * 0.55], [s * hs, hy - hs * 0.55 - hc * 0.4], [s * R * 0.3, hy - hc]], 0.3, m1); h.position.z = zc + R * 0.3; g.add(h); }
  // vertical fin in airline colour 1 (swept)
  const fh = L * (f === "wide" ? 0.18 : 0.21), fb = L * 0.19;
  const fin = vert([[-L / 2 + L * 0.05 + fb, 0], [-L / 2 + L * 0.05 + fb - fh * 0.9, fh], [-L / 2 + L * 0.03 + fh * 0.0, fh], [-L / 2 + L * 0.03, 0]], 0.5, m1); fin.position.z = zc + R * 0.6; g.add(fin);
  // gear legs + soft shadow
  for (const [x, y] of [[0, L * 0.38], [R * 1.1, -L * 0.03], [-R * 1.1, -L * 0.03]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, gear + R * 0.3, 6), metal); l.rotation.x = Math.PI / 2; l.position.set(x, y, (gear + R * 0.3) / 2); g.add(l); }
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.85, L * 0.9), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: E ? 0.12 : 0.28, depthWrite: false, map: shadowTex() })); sh.position.z = 0.15; sh.position.y = -L * 0.03; g.add(sh);
  return g;
}
let _st: THREE.Texture | null = null;
function shadowTex() { if (_st) return _st; const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!; const gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); _st = new THREE.CanvasTexture(c); return _st; }
// Airport-name sign: bold sans on a coloured panel, drawn as a 3D billboard above the main terminal's roof (text only, no logos).
function signMesh(text: string) { const c = document.createElement("canvas"); const x = c.getContext("2d")!; const fs = 64; x.font = `800 ${fs}px Inter, "Helvetica Neue", Arial, sans-serif`; const w = Math.ceil(x.measureText(text).width) + 64; c.width = w; c.height = fs + 44;
  const E = eink(); x.fillStyle = E ? "#000" : "#1f4fa3"; x.beginPath(); (x as any).roundRect ? (x as any).roundRect(0, 0, c.width, c.height, 14) : x.rect(0, 0, c.width, c.height); x.fill(); x.font = `800 ${fs}px Inter, "Helvetica Neue", Arial, sans-serif`; x.fillStyle = "#fff"; x.textBaseline = "middle"; x.fillText(text, 32, c.height / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const H = 16, W = H * c.width / c.height; const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, transparent: true, toneMapped: false })); m.geometry.rotateX(Math.PI / 2); m.geometry.translate(0, 0, H / 2);
  const post = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.6, 1.2), new THREE.MeshPhongMaterial({ color: E ? "#444" : "#c9d1dc" })); post.position.z = 0.6; const g = new THREE.Group(); g.add(post); g.add(m); return g; }

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
            { id: "grass", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "grass"], paint: { "fill-color": eink() ? "#f4f4f4" : dark ? "#1f3326" : "#cfe3c4", "fill-opacity": eink() ? 1 : 0.8 } },
            { id: "apron", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "apron"], paint: { "fill-color": eink() ? "#e6e6e6" : dark ? "#2a3344" : "#cdd2dc", "fill-opacity": 0.85 } },
            { id: "twy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": eink() ? "#bbb" : dark ? "#3c475c" : "#aab2c0", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "twyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], paint: { "line-color": eink() ? "#000" : "#e6c84a", "line-opacity": 0.8, "line-width": 1 } },
            { id: "twyl", type: "symbol", source: "apt", minzoom: 15, filter: ["all", ["==", ["get", "kind"], "taxiway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 11, "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#111", "text-halo-color": "#ffd400", "text-halo-width": 2 } },
            { id: "rwy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#333" : dark ? "#161b24" : "#4d5361", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "rwye", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#000" : "#e8e8e8", "line-gap-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.035], 19, ["*", ["get", "w"], 4.9]], "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 18, 2] } },
            { id: "rwyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": "#fff", "line-dasharray": [4, 4], "line-width": 1.2 } },
            { id: "rwyl", type: "symbol", source: "apt", filter: ["all", ["==", ["get", "kind"], "runway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 12, "text-font": ["Open Sans Bold"] }, paint: { "text-color": fg, "text-halo-color": bg, "text-halo-width": 1.5 } },
            { id: "trl", type: "line", source: "trl", layout: { visibility: "none" }, paint: { "line-color": eink() ? "#000" : "#ffd166", "line-width": 2, "line-opacity": 0.8 } },
            { id: "bld", type: "fill-extrusion", source: "apt", filter: ["in", ["get", "kind"], ["literal", ["building", "bridge"]]], paint: { "fill-extrusion-color": eink() ? ["match", ["get", "sub"], "parking", "#eee", "#d6d6d6"] : ["case", ["!=", ["coalesce", ["get", "col"], ""], ""], ["get", "col"], ["match", ["get", "sub"], "hangar", dark ? "#8a94a6" : "#dfe3ea", "parking", dark ? "#4b505a" : "#b9bdc4", "bridge", dark ? "#aab4c4" : "#eef1f5", dark ? "#5d677c" : "#d9dde4"]], "fill-extrusion-height": ["match", ["get", "sub"], "bridge", 6, ["max", ["get", "h"], 4]], "fill-extrusion-base": ["match", ["get", "sub"], "bridge", 3, 0], "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": true } },
            { id: "term", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { "fill-extrusion-color": eink() ? "#bbb" : ["case", ["!=", ["coalesce", ["get", "col"], ""], ""], ["get", "col"], dark ? "#4f7db0" : "#8fb4d8"], "fill-extrusion-height": ["max", 6, ["-", ["get", "h"], 2.5]], "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true } },
            { id: "termroof", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { "fill-extrusion-color": eink() ? "#eee" : dark ? "#d7dde6" : "#f7f8fa", "fill-extrusion-base": ["max", 6, ["-", ["get", "h"], 2.5]], "fill-extrusion-height": ["max", 7.5, ["get", "h"]], "fill-extrusion-opacity": 1 } },
            { id: "twr", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#888" : "#e9edf2", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 1 } },
            { id: "twrcab", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#000" : "#2c4f6e", "fill-extrusion-base": ["-", ["get", "h"], 6], "fill-extrusion-height": ["-", ["get", "h"], 1], "fill-extrusion-opacity": 1 } },
            { id: "terml", type: "symbol", source: "apt", minzoom: 14.5, filter: ["==", ["get", "kind"], "lblpt"], layout: { "text-field": ["get", "label"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 17], "text-font": ["Open Sans Bold"], "text-max-width": 12, "symbol-z-order": "source" }, paint: { "text-color": eink() ? "#000" : dark ? "#fff" : "#1b2a4a", "text-halo-color": eink() ? "#fff" : dark ? "#111" : "#fff", "text-halo-width": 2.5 } }] } });
    } catch (e: any) { setErr("3D view could not start on this device (" + (e?.message || "WebGL error") + ")."); return; }
    mref.current = map; (window as any).__a3 = map; (window as any).__a3fx = fx.current; map.on("error", e => console.warn("apt3d", e?.error?.message)); map.on("rotate", () => setBrg(map.getBearing()));
    // three.js custom layer
    let sign: THREE.Group | null = null; let scene: THREE.Scene, cam: THREE.Camera, ren: THREE.WebGLRenderer, origin: maplibregl.MercatorCoordinate, mpu = 1;
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
        if (sign) { sign.rotation.z = -map.getBearing() * Math.PI / 180; sign.scale.setScalar(Math.min(4, Math.max(1, Math.pow(2, (16.5 - z) * 0.8)))); }
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
        (map.getSource("apt") as any).setData(j); (window as any).__a3info = j; const sp = (j.features || []).find((f: any) => f.properties.kind === "signpt"); if (sp && scene) { const c = maplibregl.MercatorCoordinate.fromLngLat(sp.geometry.coordinates, 0); sign = signMesh((j.sign || sp.properties.sign || j.name).toUpperCase()); sign.position.set((c.x - origin.x) / mpu, -(c.y - origin.y) / mpu, (sp.properties.h || 16) + 0.5); scene.add(sign); map.triggerRepaint(); } const b = j.focus || j.bbox; fit(map, b, true); setLoad(""); poll(); }
      catch (e: any) { setLoad(""); setErr("Couldn't load the airport shapes: " + (e?.message || e) + ". OpenStreetMap's free Overpass service can be busy — try again in a minute."); } });
    const t = setInterval(poll, 8000);
    const clk = (e: any) => { let best: any = null, bd = 34; for (const f of Object.values(fx.current)) { if (!f.mk) continue; const p = map.project(f.mk.getLngLat()); const d = Math.hypot(p.x - e.point.x, p.y - e.point.y); if (d < bd) { bd = d; best = f.a; } } if (best) setSel({ ...best }); };
    map.on("click", clk);
    return () => { stop = true; clearInterval(t); for (const f of Object.values(fx.current)) f.mk?.remove(); fx.current = {}; trails.current = {}; map.remove(); };
  }, [ok, iata]);
  useEffect(() => { const m = mref.current; if (!m || !m.isStyleLoaded()) return; m.easeTo({ pitch: flat ? 0 : 60, duration: still() ? 0 : 700 }); }, [flat]);
  useEffect(() => { const m = mref.current; if (!m) return; const v = (id: string, on: boolean) => { try { m.setLayoutProperty(id, "visibility", on ? "visible" : "none"); } catch { } };
    ["bld", "term", "termroof", "twr", "twrcab"].forEach(i => v(i, bld)); v("sat", sat); v("trl", hist); }, [bld, sat, hist]);
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

