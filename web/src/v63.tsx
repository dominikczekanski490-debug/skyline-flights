import { BUILD } from "./extras";
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
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import helvBold from "three/examples/fonts/helvetiker_bold.typeface.json";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { api } from "./lib";
import { liv } from "./v36";
import { liveryFor } from "./livery";
import { buildAtlas, paint, type Atlas, type Img } from "./paint3d";
import { SCHEMES, LOGO_FILES, JET2_REG as J2REG } from "./schemes3d";
maplibregl.setWorkerUrl(workerUrl);

const still = () => document.documentElement.dataset.skin === "eink" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const eink = () => document.documentElement.dataset.skin === "eink";
const css = (v: string, d: string) => (getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d);
const webgl = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
export const fam = (t = "") => /^(A33|A34|A35|A38|B74|B76|B77|B78|IL96|MD11|A30|A310)/.test(t) ? "wide" : /^(AT|DH8|E1|E2|E5|E7|CRJ|SF3|J31|BE|C2|P18|C30|C29|PC|DHC|SW|D32)/.test(t) ? "reg" : "narrow";
const FAM = { narrow: "narrow-body", wide: "wide-body", reg: "regional / turboprop / small" } as const;
const isPlane = (a: any) => a && a.hex && a.lat != null && a.lon != null && !/^(GND|TWR|SERV|EMER|N\/A|GRND|VEH)$/i.test(a.type || "");
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



// ---- textured airliner models: amvlab "aircraft-models" (logo-free variants), CC BY 4.0, https://github.com/amvlab/aircraft-models
// Changed by Skyline: the model's livery colour is recoloured to the airline's colours and the airline name is painted on.
const GLB: Record<string, Promise<THREE.Group | null>> = {}; const GOT: Record<string, THREE.Group | null> = {};
const glbFile = (t = "", f: string) => f === "wide" ? "A350_nologo" : /^A3/.test(t) || f === "reg" ? "A320_nologo" : "B737_nologo";
// Public-domain (Wikimedia Commons, text-logo/simple-geometry PD) airline wordmarks, rasterised from SVG — see /liveries/ATTRIBUTION.md
const LOGO_SRC: Record<string, string> = LOGO_FILES;
const LOGO: Record<string, HTMLImageElement> = {};
const logosReady = Promise.all(Object.entries(LOGO_SRC).map(([k, f]) => new Promise<void>(res => { const im = new Image(); im.onload = () => { LOGO[k] = im; res(); }; im.onerror = () => res(); im.src = `/liveries/${f}.png`; setTimeout(res, 6000); })));
// Jet2 sub-brands are both callsign EXS; scheme only asserted for registrations seen in dated Commons photos (see ATTRIBUTION.md).
function tint(im: CanvasImageSource, w: number, h: number, col: string, sx = 0, sy = 0, sw?: number, sh?: number) { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); const x = c.getContext("2d")!; const I: any = im; x.drawImage(im, sx, sy, sw ?? I.width, sh ?? I.height, 0, 0, c.width, c.height); x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
function loadGlb(n: string) {
  return GLB[n] ||= new Promise(async r => { await logosReady;
    let done = false; const finish = (v: THREE.Group | null) => { if (done) return; done = true; GOT[n] = v; r(v); };
    const t = setTimeout(() => finish(null), 10000); // iOS Safari / flaky SW must not hang 3D forever
    try {
      new GLTFLoader().load(`/models/${n}.glb`, g => { clearTimeout(t); finish(g.scene); }, undefined, () => { clearTimeout(t); finish(null); });
    } catch { clearTimeout(t); finish(null); }
  });
}
const TEX: Record<string, THREE.Texture> = {};
const MIR = 1;
// Recolour the logo-free amvlab atlas into a simplified airline scheme. RYR/EZY/BA/LH get real public-domain wordmark decals; other airlines get plain-text names. Simplified schemes, not exact liveries.
function hexRgb(h: string) { const x = (h || "#888888").replace("#", ""); return [parseInt(x.slice(0, 2), 16) || 0, parseInt(x.slice(2, 4), 16) || 0, parseInt(x.slice(4, 6), 16) || 0] as [number, number, number]; }
function paintMotif(x: CanvasRenderingContext2D, m: string, cx: number, cy: number, s: number, col: string, acc: string) {
  x.save(); x.translate(cx, cy); x.fillStyle = col; x.strokeStyle = acc; x.lineWidth = Math.max(2, s * 0.06);
  if (m === "disc" || m === "circle") { // geometric harp-ish / disc mark (original shape, not a logo)
    x.beginPath(); x.moveTo(0, -s * 0.55); x.quadraticCurveTo(s * 0.55, -s * 0.2, s * 0.35, s * 0.55); x.lineTo(0, s * 0.35); x.lineTo(-s * 0.35, s * 0.55); x.quadraticCurveTo(-s * 0.55, -s * 0.2, 0, -s * 0.55); x.fill();
    x.beginPath(); x.moveTo(0, -s * 0.4); for (let i = 0; i < 5; i++) { const t = i / 4; x.moveTo(-s * 0.12, -s * 0.25 + t * s * 0.55); x.quadraticCurveTo(s * 0.05, -s * 0.1 + t * s * 0.4, s * 0.18, -s * 0.2 + t * s * 0.5); } x.stroke();
  } else if (m === "chevron") { x.beginPath(); x.moveTo(0, -s * 0.5); x.lineTo(s * 0.45, s * 0.2); x.lineTo(0, s * 0.05); x.lineTo(-s * 0.45, s * 0.2); x.closePath(); x.fill(); }
  else if (m === "flag" || m === "band") { x.fillRect(-s * 0.35, -s * 0.5, s * 0.7, s); x.fillStyle = acc; x.fillRect(-s * 0.35, -s * 0.1, s * 0.7, s * 0.2); }
  else if (m === "stripes") { for (let i = -2; i <= 2; i++) { x.fillStyle = i % 2 ? col : acc; x.fillRect(-s * 0.4, i * s * 0.18, s * 0.8, s * 0.14); } }
  else if (m === "split") { x.fillStyle = col; x.fillRect(-s * 0.4, -s * 0.5, s * 0.4, s); x.fillStyle = acc; x.fillRect(0, -s * 0.5, s * 0.4, s); }
  else { x.beginPath(); x.arc(0, 0, s * 0.35, 0, Math.PI * 2); x.fill(); }
  x.restore();
}
function livTex(n: string, src: any, lv: { f: string; b?: string; t: string; e: string; a?: string; m?: string; tx?: string; n?: string }, name: string, brand = "") {
  const key = n + (lv.t || "") + (lv.b || "") + (lv.a || "") + name + (lv.m || "") + brand; if (TEX[key]) return TEX[key];
  const im = src.image; const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d")!; x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data; const W = c.width / 1024;
  const [fR, fG, fB] = hexRgb(lv.f || "#ffffff"), [bR, bG, bB] = hexRgb(lv.b || lv.f || "#ffffff"), [tR, tG, tB] = hexRgb(lv.t || "#333333"), [eR, eG, eB] = hexRgb(lv.e || lv.t || "#333");
  const A = n === "A320_nologo", B7 = n === "B737_nologo", A35 = n === "A350_nologo";
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2]; const q = i / 4, y = (q / c.width | 0) / W, xx = (q % c.width) / W;
    const green = g > r + 12 && g > b + 4 && g < 160;
    const blueBody = b > r + 80 && g > r + 50; // A320 sky-blue upper
    const darkBlue = b > r + 40 && b < 170 && g < 100; // A320 dark accents / tail
    const lilac = r > 140 && r < 215 && b > 195 && b - r > 22 && g > 170;
    if (B7) {
      if (green) { p[i] = fR; p[i + 1] = fG; p[i + 2] = fB; } // whole green fuselage → white/fuselage
      else if (xx > 680 && y > 640 && r > 180 && g > 180 && b > 180) { p[i] = tR; p[i + 1] = tG; p[i + 2] = tB; }
      else if (xx > 800 && y < 280 && Math.abs(r - g) < 50 && r > 90 && r < 210) { p[i] = eR; p[i + 1] = eG; p[i + 2] = eB; }
    } else if (A) {
      if (blueBody) { const belly = (y > 280 && y < 380) || (y > 640 && y < 740); if (belly && lv.b) { p[i] = bR; p[i + 1] = bG; p[i + 2] = bB; } else { p[i] = fR; p[i + 1] = fG; p[i + 2] = fB; } }
      else if (lilac) { p[i] = fR; p[i + 1] = fG; p[i + 2] = fB; }
      else if (darkBlue) { const l = Math.min(1.15, b / 110); p[i] = tR * l; p[i + 1] = tG * l; p[i + 2] = tB * l; }
    } else if (A35) {
      if (green) { if (y < 420) { const belly = (y % 210) / 210 > 0.6 && lv.b; if (belly) { p[i] = bR; p[i + 1] = bG; p[i + 2] = bB; } else { p[i] = fR; p[i + 1] = fG; p[i + 2] = fB; } } else { const l = Math.min(1.1, g / 70); p[i] = tR * l; p[i + 1] = tG * l; p[i + 2] = tB * l; } }
    } else if (green) { if (y < 400) { p[i] = fR; p[i + 1] = fG; p[i + 2] = fB; } else { const l = Math.min(1.1, g / 70); p[i] = tR * l; p[i + 1] = tG * l; p[i + 2] = tB * l; } }
  }
  x.putImageData(d, 0, 0);
  // soft panel shading first so names stay crisp
  x.globalCompositeOperation = "multiply"; const grd = x.createLinearGradient(0, 0, 0, c.height); grd.addColorStop(0, "rgba(200,210,230,0.12)"); grd.addColorStop(0.5, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(40,50,70,0.14)"); x.fillStyle = grd; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = "source-over";
  // belly cheatline bands on known fuselage UV strips (simplified — not surveyed paint)
  if (lv.b && A) { x.fillStyle = lv.b; x.fillRect(60 * W, 310 * W, 700 * W, 22 * W); x.fillRect(60 * W, 690 * W, 700 * W, 22 * W); }

  const rows = A ? [258, 640] : B7 ? [134, 278] : [134, 278]; const cx = (A ? 480 : 440) * W;
  const side = (k: number, f: () => void) => { x.save(); x.translate(cx, rows[k] * W); if ((A || B7) && k === MIR) x.scale(-1, 1); f(); x.restore(); };
  const LG = A35 ? undefined : LOGO[brand]; const acc = lv.a || "#f1c933"; // A350 atlas UVs not verified → no decals/tail marks, plain-text name fallback
  // tail regions on the amvlab atlases (measured from the PNGs): A320 top-right, B737 bottom-right, A350 bottom-right
  const tails: [number, number, number][] = B7 ? [[860, 780, 110], [920, 860, 70]] : A ? [[900, 180, 80]] : [];
  if (LG) { // real PD wordmark decal on both fuselage sides
    const col = brand === "EZY" ? "#ff6600" : brand === "BA" ? "#1f3c78" : brand === "LH" ? "#05164d" : "#073590";
    const sx = brand === "LH" ? LG.height * 1.3 : 0, sw = LG.width - sx; const lw = 360 * W, lh = lw * LG.height / sw; const img = tint(LG, lw, lh, col, sx, 0, sw, LG.height); // LH: wordmark only, roundel goes on the fin
    for (const k of [0, 1]) side(k, () => x.drawImage(img, -lw / 2, -lh / 2));
  } else if (!A35 && (brand === "J2COM" || brand === "J2HOL")) { // Jet2 has no licensed logo file: plain-text titles in photo colours (not the logo)
    x.fillStyle = "#d4002a"; x.font = `900 ${Math.round(54 * W)}px "Helvetica Neue", Arial, sans-serif`; x.textBaseline = "middle"; x.textAlign = "center";
    for (const k of [0, 1]) side(k, () => x.fillText(brand === "J2COM" ? "Jet2" : "jet2holidays", 0, 0));
  } else {
    const tx = lv.tx || lv.t || "#073590"; x.fillStyle = tx; x.font = `900 ${Math.round(52 * W)}px "Helvetica Neue", Arial, sans-serif`; x.textBaseline = "middle"; x.textAlign = "center";
    for (const k of [0, 1]) side(k, () => x.fillText((name || lv.n || "").toUpperCase(), 0, 0));
  }
  for (const [tx0, ty0, ts] of tails) {
    const X = tx0 * W, Y = ty0 * W, S = ts * W;
    if (brand === "LH" && LG) { const cw = LG.height; const im2 = tint(LG, S * 1.1, S * 1.1, "#ffffff", 0, 0, cw, LG.height); x.drawImage(im2, X - S * 0.55, Y - S * 0.55); } // crane roundel = left square of the PD 2018 logo
    else if (brand === "EZY" && LG) { const w2 = S * 1.6, h2 = w2 * LG.height / LG.width; const im2 = tint(LG, w2, h2, "#ffffff"); x.save(); x.translate(X, Y); x.rotate(-Math.PI / 2); x.drawImage(im2, -w2 / 2, -h2 / 2); x.restore(); }
    else if (brand === "BA") { // Union Flag geometry (PD flag) as a simplified stand-in for the Chatham Dockyard tail — approximate, not the artwork
      x.save(); x.translate(X, Y); const w2 = S * 1.4, h2 = S * 0.9; x.beginPath(); x.rect(-w2 / 2, -h2 / 2, w2, h2); x.clip(); x.fillStyle = "#012169"; x.fillRect(-w2 / 2, -h2 / 2, w2, h2);
      x.strokeStyle = "#fff"; x.lineWidth = h2 * 0.2; x.beginPath(); x.moveTo(-w2 / 2, -h2 / 2); x.lineTo(w2 / 2, h2 / 2); x.moveTo(w2 / 2, -h2 / 2); x.lineTo(-w2 / 2, h2 / 2); x.stroke();
      x.strokeStyle = "#c8102e"; x.lineWidth = h2 * 0.067; x.stroke(); x.fillStyle = "#fff"; x.fillRect(-w2 / 2, -h2 / 6, w2, h2 / 3); x.fillRect(-h2 / 6, -h2 / 2, h2 / 3, h2);
      x.fillStyle = "#c8102e"; x.fillRect(-w2 / 2, -h2 / 10, w2, h2 / 5); x.fillRect(-h2 / 10, -h2 / 2, h2 / 5, h2); x.restore(); }
    else if (brand === "J2HOL") { // photo-observed: blue fin with orange/red/yellow sunburst (simplified rays, not the artwork)
      x.save(); x.translate(X, Y + S * 0.2); for (let i = 0; i < 9; i++) { x.fillStyle = ["#ff6a13", "#ffc72c", "#e4002b"][i % 3]; x.beginPath(); x.moveTo(0, 0); const a0 = Math.PI + i * Math.PI / 9, a1 = a0 + Math.PI / 18; x.lineTo(Math.cos(a0) * S * 0.7, Math.sin(a0) * S * 0.7); x.lineTo(Math.cos(a1) * S * 0.7, Math.sin(a1) * S * 0.7); x.fill(); } x.fillStyle = "#ffc72c"; x.beginPath(); x.arc(0, 0, S * 0.22, Math.PI, 0); x.fill(); x.restore(); }
    else if (brand === "J2COM") { x.save(); x.translate(X, Y); x.rotate(-Math.PI / 2); x.fillStyle = "#fff"; x.font = `900 ${Math.round(S * 0.32)}px Arial`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("Jet2.com", 0, 0); x.restore(); }
    else if (brand === "FR") { /* no PD harp asset found — leave fin plain navy rather than invent one */ }
    else paintMotif(x, lv.m || "plain", X, Y, S, acc, B7 ? "#fff8d0" : "#ffffff");
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = src.flipY; t.anisotropy = 8; t.needsUpdate = true; return TEX[key] = t;
}
function brandOf(cs: string, reg: string) {
  const p = cs.slice(0, 3).toUpperCase(); const p2 = cs.slice(0, 2).toUpperCase();
  if (p === "RYR" || p === "RUK" || p2 === "FR") return "FR"; if (["EZY", "EJU", "EZS"].includes(p) || p2 === "U2") return "EZY";
  if (p === "BAW" || p2 === "BA") return "BA"; if (p === "DLH" || p2 === "LH") return "LH";
  if (p === "EXS" || p2 === "LS") { return J2REG[(reg || "").toUpperCase().trim()]?.b || "J2"; }
  return "";
}
const J2: Record<string, any> = { J2COM: { n: "Jet2", f: "#c9ccd1", b: "#c9ccd1", t: "#d4002a", e: "#d4002a", a: "#ffffff", m: "plain", tx: "#d4002a" }, J2HOL: { n: "Jet2holidays", f: "#ffffff", b: "#ffffff", t: "#0057b8", e: "#0057b8", a: "#ffc72c", m: "plain", tx: "#d4002a" }, J2: { n: "Jet2", f: "#ffffff", t: "#8a8f98", e: "#8a8f98", a: "#8a8f98", m: "plain", tx: "#d4002a" } };
// Projection painter (paint3d.ts): texel → 3D point map per model, cached; one painted texture per model+scheme.
const ATL: Record<string, Atlas> = {}; const PT: Record<string, THREE.Texture> = {};
const imgData = (im: CanvasImageSource & { width: number; height: number }): Img => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d")!; x.drawImage(im, 0, 0); return { w: c.width, h: c.height, data: x.getImageData(0, 0, c.width, c.height).data }; };
let DIMG: Record<string, Img> | null = null;
function decalImgs() { if (DIMG) return DIMG; const o: Record<string, Img> = {}; for (const k of Object.keys(LOGO)) o[k] = imgData(LOGO[k]);
  const c = document.createElement("canvas"); c.width = 760; c.height = 170; const x = c.getContext("2d")!; x.font = `italic 900 150px "Arial Black", "Helvetica Neue", Arial, sans-serif`; x.textBaseline = "middle"; x.fillStyle = "#fff"; x.fillText("holidays", 4, 88); o["txt:holidays"] = imgData(c); return DIMG = o; }
function projTex(n: string, root: THREE.Object3D, mesh: any, id: string) { const key = n + id; if (PT[key]) return PT[key]; const src = mesh.material.map; if (!src?.image) return null;
  if (!ATL[n]) { root.updateMatrixWorld(true); const g = mesh.geometry; const pa = g.attributes.position, ua = g.attributes.uv; const v = new THREE.Vector3(); const pos = new Float32Array(pa.count * 3);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld); for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(inv); pos[3 * i] = v.x; pos[3 * i + 1] = v.y; pos[3 * i + 2] = v.z; }
    const idx = g.index ? g.index.array : Uint32Array.from({ length: pa.count }, (_, i) => i); const im = src.image; ATL[n] = buildAtlas({ pos, uv: ua.array, idx }, im.width, im.height); (window as any).__a3atlas = { ...(window as any).__a3atlas, [n]: ATL[n].meta }; }
  const base = imgData(src.image); const out = paint(base, ATL[n], SCHEMES[id], decalImgs()); const c = document.createElement("canvas"); c.width = base.w; c.height = base.h; c.getContext("2d")!.putImageData(new ImageData(out as any, base.w, base.h), 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = src.flipY; t.anisotropy = 8; return PT[key] = t; }
export { loadGlb, brandOf, glbFile };
export function glbModel(t: string, f: string, cs: string, fallbackC1: string, fallbackName: string, reg = "") {
  const n = glbFile(t, f); const base = GOT[n]; if (!base) return null; const o = base.clone(true); const E = eink(); const brand = brandOf(cs, reg);
  const lv = J2[brand] || liveryFor(cs.slice(0, 3), cs.slice(0, 3)) || liveryFor(cs.slice(0, 2)) || { n: fallbackName || "", f: "#ffffff", t: fallbackC1, e: fallbackC1, a: fallbackC1, m: "plain" as const, tx: fallbackC1 };
  const name = (fallbackName || lv.n || "").replace(/ (UK|Europe|Austria|Ireland)$/, "");
  o.traverse((m: any) => { if (m.isMesh) { const src = m.material.map; m.material = new THREE.MeshStandardMaterial({ map: src && !E ? (SCHEMES[brand] && projTex(n, o, m, brand)) || livTex(n, src, lv, name, brand) : src, color: E ? "#dddddd" : "#ffffff", roughness: 0.42, metalness: 0.18, envMapIntensity: 0.8 }); m.castShadow = false; } });
  const g = new THREE.Group(); o.rotation.set(Math.PI / 2, 0, 0); const w = new THREE.Group(); w.add(o); w.rotation.z = Math.PI / 2; w.position.z = 2.8; if (f === "reg") w.scale.setScalar(0.74); g.add(w);
  const L = f === "wide" ? 67 : f === "reg" ? 28 : 38; const sh = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.05, L * 0.55), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: E ? 0.12 : 0.38, depthWrite: false, map: shadowTex() })); sh.position.set(0, -L * 0.05, 0.12); g.add(sh); return g;
}

// Glass curtain wall: procedural panes for EVERY airport (not surveyed). Optional per-IATA tint when a verified Commons colour cue exists (see web/public/refs/ATTRIBUTION.md). Photos are NOT embedded.
const GLASS_GENERIC: [string, string, string, string] = ["#d7ebfb", "#7eb4e0", "#3f78b8", "#1e4a7a"];
// Reference-verified glass tints only (colour cues from attributed photos — not hand-modelled buildings). All other airports use GLASS_GENERIC.
// Per-airport building-sign overrides, only where a dated photo shows it. Everything else = a name LABEL, not a photographed sign.
const SIGN_REF: Record<string, { col?: string; none?: boolean; src: string; date: string; what: string }> = {
  CFU: { none: true, src: "https://www.fraport-greece.com/en/airport-profiles/corfu.html", date: "post-2021 (Fraport Greece official photo)", what: "new Fraport terminal facade: grey panels with blue portal blocks, no airport-name lettering on the facade; Fraport-style yellow/black wayfinding is interior only" },
  FRA: { none: true, src: "https://commons.wikimedia.org/wiki/File:Frankfurt_Airport_Terminal_1_departures_entrance_(Quintin_Soloviev).png", date: "2023-09-18", what: "T1 kerbside shows blue Fraport pylon signs with white concourse letters, no big name sign on the facade" },
  LPL: { col: "#d6001c", src: "https://commons.wikimedia.org/wiki/File:Liverpool_John_Lennon_Airport_terminal_building_-_geograph.org.uk_-_6207868.jpg", date: "2019-06-28", what: "red facade lettering colour (text too small to read; position approximate)" },
};
// Airports operated by Fraport AG / Fraport Greece (public operator lists) — the only places the Fraport logo is drawn.
const FRAPORT = new Set(["FRA", "CFU", "CHQ", "EFL", "JMK", "JSI", "JTR", "KGS", "KVA", "MJT", "PVK", "RHO", "SKG", "SMI", "ZTH"]);
const GLASS_REF: Record<string, [string, string, string, string]> = {
  MAN: ["#e8f4fc", "#9ec9e8", "#4a8fc4", "#1f567f"], // Commons CC BY 4.0 T1/T2 refs
  FRA: ["#dfe8f2", "#8a9ab8", "#4a678a", "#243a55"], // Commons colour cue only (SA — not embedded)
  CFU: ["#f2f7fc", "#a8c8e0", "#5a8fb8", "#2a5a82"], // colour cue only (GR FoP + SA — not embedded)
};
function curtain(iata?: string) {
  const W = 128, H = 128, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!;
  const cols = (iata && GLASS_REF[iata]) || GLASS_GENERIC;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cols[0]); g.addColorStop(0.3, cols[1]); g.addColorStop(0.65, cols[2]); g.addColorStop(1, cols[3]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,.34)"; x.beginPath(); x.moveTo(0, 0); x.lineTo(48, 0); x.lineTo(0, 56); x.fill();
  x.fillStyle = "#f7f9fc"; for (let i = 0; i < W; i += 14) x.fillRect(i, 0, 2.5, H); for (let j = 0; j < H; j += 28) x.fillRect(0, j, W, 2.5);
  x.fillStyle = "rgba(10,30,60,.22)"; for (let i = 0; i < W; i += 14) for (let j = 0; j < H; j += 28) x.fillRect(i + 3, j + 5, 8, 18);
  const d = x.getImageData(0, 0, W, H); return { width: W, height: H, data: new Uint8Array(d.data.buffer) };
}
let _font: any = null; const font = () => _font ||= new FontLoader().parse(helvBold as any);
const ascii = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[–—]/g, "-").replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();
// Airport name as real 3D extruded letters, mounted on the main terminal's airside facade (text only, no logos).
function facadeSign(text: string, col: string, size: number) { const g = new TextGeometry(ascii(text), { font: font(), size, depth: size * 0.18, curveSegments: 4, bevelEnabled: true, bevelThickness: size * 0.03, bevelSize: size * 0.02, bevelSegments: 1 } as any); g.computeBoundingBox(); const b = g.boundingBox!; g.translate(-(b.max.x + b.min.x) / 2, 0, 0); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.1, emissive: col, emissiveIntensity: 0.35, depthTest: false })); m.renderOrder = 10; const o = new THREE.Group(); o.add(m); return { o, w: b.max.x - b.min.x }; }
// pick the facade: longest terminal edge whose outward side faces the nearest runway (airside)
function facade(j: any, toL: (p: number[]) => [number, number]) { const F = j.features || []; const sp = F.find((f: any) => f.properties.kind === "signpt"); const terms = F.filter((f: any) => f.properties.kind === "terminal" && f.geometry.type === "Polygon"); if (!terms.length) return null;
  const sc = sp ? toL(sp.geometry.coordinates) : [0, 0]; const cen = (r: number[][]) => r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]);
  const ar = (r: number[][]) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
  const inP = (q: number[], r: number[][]) => { let o = false; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const a = r[i], b = r[k]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) o = !o; } return o; };
  const T = terms.map((f: any) => { const r = f.geometry.coordinates[0].map(toL); const c = cen(r); return { f, r, c, A: Math.abs(ar(r)), d: Math.hypot(c[0] - sc[0], c[1] - sc[1]) }; });
  const near = T.filter((x: any) => x.d < 1500); const pool = near.length ? near : T; const t = pool.sort((a: any, b: any) => b.A - a.A)[0];
  const ap = F.filter((f: any) => f.properties.kind === "apron" && f.geometry.type === "Polygon").map((f: any) => f.geometry.coordinates[0].map(toL));
  const tw = F.filter((f: any) => (f.properties.kind === "taxiway" || f.properties.kind === "runway") && f.geometry.type === "LineString").flatMap((f: any) => f.geometry.coordinates.filter((_: any, i: number) => i % 3 === 0).map(toL));
  const sg = ar(t.r) > 0 ? 1 : -1; const R = t.r; const E: any[] = []; // merge near-collinear edges so long facades split by OSM count as one
  for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const l = E[E.length - 1]; if (l && Math.abs(((ang - l.ang + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 0.26) { l.b = b; l.ang = Math.atan2(b[1] - l.a[1], b[0] - l.a[0]); } else E.push({ a, b, ang }); }
  let best: any = null, back: any = null;
  for (const g of E) { const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]); if (L < 20) continue; const n = [sg * (g.b[1] - g.a[1]) / L, -sg * (g.b[0] - g.a[0]) / L]; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2];
    let f = 0; for (const dd of [30, 70, 120]) { const q = [m[0] + n[0] * dd, m[1] + n[1] * dd]; if (ap.some((r: number[][]) => inP(q, r))) f += 1; }
    let tn = 0; for (const p of tw) { const v = [p[0] - m[0], p[1] - m[1]], dl = Math.hypot(v[0], v[1]); if (dl < 400 && dl > 1 && (v[0] * n[0] + v[1] * n[1]) / dl > 0.5) tn++; }
    const s = L * (0.1 + f + Math.min(2, tn / 15)); const o = { s, a: g.a, b: g.b, L, n }; if (!best || s > best.s) best = o; if (!back || L * (1 - f) > back.s2) back = { ...o, s2: L * (1 - f) }; }
  if (best && back && back.n[0] * best.n[0] + back.n[1] * best.n[1] > -0.3) back = null;
  return best ? { ...best, back, h: t.f.properties.h || 14, ring: t.r, c: t.c } : null; }

// Roof overhang, landside canopy, jet bridges, apron gate pads, taxiway edge lights (simple procedural, not surveyed).
function aptExtras(fc: any, j: any, toL: (p: number[]) => [number, number], E: boolean) {
  const g = new THREE.Group();
  const mt = new THREE.MeshStandardMaterial({ color: E ? "#cccccc" : "#e9edf2", roughness: 0.55, metalness: 0.25 });
  const pm = new THREE.MeshStandardMaterial({ color: E ? "#888888" : "#8e97a6", roughness: 0.45, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: E ? "#aaa" : "#7eb0d8", roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: E ? "#666" : "#3a4250", roughness: 0.7 });
  const padM = new THREE.MeshStandardMaterial({ color: E ? "#bbb" : "#9aa3b2", roughness: 0.9 });
  const slab = (e: any, len: number, dep: number, th: number, z: number, off: number, posts: boolean, mat = mt) => {
    const m = [(e.a[0] + e.b[0]) / 2 + e.n[0] * off, (e.a[1] + e.b[1]) / 2 + e.n[1] * off]; const rot = Math.atan2(e.n[1], e.n[0]) + Math.PI / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, dep, th), mat); b.position.set(m[0], m[1], z); b.rotation.z = rot; g.add(b);
    if (posts) for (let k = -2; k <= 2; k++) { const q = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, z, 8), pm); q.rotation.x = Math.PI / 2; const ux = Math.cos(rot), uy = Math.sin(rot); q.position.set(m[0] + ux * k * len / 5 + e.n[0] * dep * 0.35, m[1] + uy * k * len / 5 + e.n[1] * dep * 0.35, z / 2); g.add(q); }
  };
  slab(fc, fc.L + 6, 5.5, 0.7, fc.h + 0.35, 2.2, false);
  slab(fc, fc.L + 6.5, 0.45, 0.9, fc.h + 0.9, 4.6, false, dark);
  if (fc.back) { const L = Math.min(70, fc.back.L * 0.55); slab(fc.back, L, 12, 0.55, 5.5, 5.5, true); }
  const ux = (fc.b[0] - fc.a[0]) / fc.L, uy = (fc.b[1] - fc.a[1]) / fc.L; const nJ = Math.max(2, Math.min(10, Math.floor(fc.L / 42)));
  for (let i = 0; i < nJ; i++) {
    const t = (i + 0.5) / nJ; const px = fc.a[0] + ux * fc.L * t + fc.n[0] * 3, py = fc.a[1] + uy * fc.L * t + fc.n[1] * 3;
    const rot = Math.atan2(fc.n[1], fc.n[0]);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 28, 3.2), glass); arm.position.set(px + fc.n[0] * 16, py + fc.n[1] * 16, 6.2); arm.rotation.z = rot + Math.PI / 2; g.add(arm);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5.5, 6, 3.6), mt); cab.position.set(px + fc.n[0] * 30, py + fc.n[1] * 30, 5.4); cab.rotation.z = rot + Math.PI / 2; g.add(cab);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 5.2, 8), pm); leg.rotation.x = Math.PI / 2; leg.position.set(px + fc.n[0] * 22, py + fc.n[1] * 22, 2.6); g.add(leg);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(11, 24), padM); pad.position.set(px + fc.n[0] * 36, py + fc.n[1] * 36, 0.08); g.add(pad);
  }
  const F = j.features || []; const tw = F.filter((f: any) => f.properties.kind === "taxiway" && f.geometry.type === "LineString").slice(0, 40);
  const bulb = new THREE.MeshStandardMaterial({ color: "#ffe08a", emissive: "#ffcc44", emissiveIntensity: E ? 0 : 1.2, roughness: 0.4 });
  let lit = 0;
  for (const f of tw) {
    const pts = f.geometry.coordinates.map(toL); if (pts.length < 2) continue;
    for (let i = 0; i < pts.length - 1 && lit < 180; i++) {
      const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 8) continue;
      const steps = Math.max(1, Math.floor(L / 28));
      for (let s = 0; s < steps && lit < 180; s++) {
        const t = (s + 0.5) / steps; const qx = a[0] + (b[0] - a[0]) * t, qy = a[1] + (b[1] - a[1]) * t;
        if (Math.hypot(qx - (fc.a[0] + fc.b[0]) / 2, qy - (fc.a[1] + fc.b[1]) / 2) > 700) continue;
        const o = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 6), bulb); o.position.set(qx, qy, 0.35); g.add(o); lit++;
      }
    }
  }
  return g;
}

type Fix = { a: any; lon: number; lat: number; t: number; x: number; y: number; z: number; obj?: THREE.Group; mk?: maplibregl.Marker };

export default function Apt3D({ iata, onClose }: { iata: string; onClose: () => void }) {
  const el = useRef<HTMLDivElement>(null), mref = useRef<maplibregl.Map | undefined>(undefined), fx = useRef<Record<string, Fix>>({}), trails = useRef<Record<string, [number, number][]>>({});
  const [ok] = useState(webgl); const [err, setErr] = useState(""); const [info, setInfo] = useState<any>(null); const [n, setN] = useState<number | null>(null);
  const [sel, setSel] = useState<any>(null); const [flat, setFlat] = useState(false); const [brg, setBrg] = useState(0); const [lay, setLay] = useState(false); const [bld, setBld] = useState(true); const [sat, setSat] = useState(false); const [hist, setHist] = useState(false); const [load, setLoad] = useState("Loading OpenStreetMap shapes…"); const [looking, setLooking] = useState("");
  const [follow, setFollow] = useState(false); const [followSt, setFollowSt] = useState(""); // following | waiting | stale | lost
  const [fp, setFp] = useState<any>({}); const FPD: any = useRef<any>({}).current;
  const followHex = useRef<string | null>(null); const followAt = useRef(0); const userCam = useRef(/a3view=(terminal|sign)/.test(location.hash)); // user chose the terminal overview: never auto-jump to a plane
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
          layers: [{ id: "bg", type: "background", paint: { "background-color": eink() ? "#fff" : (dark ? "#0c1422" : "#9ec0de") } }, { id: "base", type: "raster", source: "base", paint: { "raster-opacity": eink() ? 0.35 : 0.75 } }, { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" }, paint: { "raster-brightness-max": 0.8 } },
            { id: "grass", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "grass"], paint: { "fill-color": eink() ? "#f4f4f4" : dark ? "#1f3326" : "#cfe3c4", "fill-opacity": eink() ? 1 : 0.8 } },
            { id: "apron", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "apron"], paint: { "fill-color": eink() ? "#e6e6e6" : dark ? "#555e6c" : "#c2cad4", "fill-opacity": 0.98 } },
            { id: "twy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": eink() ? "#bbb" : dark ? "#3c475c" : "#aab2c0", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "twye", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], layout: { "line-join": "round" }, paint: { "line-color": eink() ? "#000" : "#f2d24b", "line-opacity": 0.9, "line-gap-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.036], 19, ["*", ["get", "w"], 4.9]], "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.3, 18, 1.6] } }, { id: "twyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], paint: { "line-color": eink() ? "#000" : "#ffd23a", "line-opacity": 0.95, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 2.4] } },
            { id: "twyl", type: "symbol", source: "apt", minzoom: 15, filter: ["all", ["==", ["get", "kind"], "taxiway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 11, "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#111", "text-halo-color": "#ffd400", "text-halo-width": 2 } },
            { id: "rwy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#333" : dark ? "#161b24" : "#4d5361", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "rwye", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#000" : "#e8e8e8", "line-gap-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.035], 19, ["*", ["get", "w"], 4.9]], "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 18, 2] } },
            { id: "rwyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": "#fff", "line-dasharray": [4, 4], "line-width": 1.2 } },
            { id: "rwyl", type: "symbol", source: "apt", filter: ["all", ["==", ["get", "kind"], "runway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 12, "text-font": ["Open Sans Bold"] }, paint: { "text-color": fg, "text-halo-color": bg, "text-halo-width": 1.5 } },
            { id: "trl", type: "line", source: "trl", layout: { visibility: "none" }, paint: { "line-color": eink() ? "#000" : "#ffd166", "line-width": 2, "line-opacity": 0.8 } },
            { id: "bld", type: "fill-extrusion", source: "apt", filter: ["in", ["get", "kind"], ["literal", ["building", "bridge"]]], paint: { "fill-extrusion-color": eink() ? ["match", ["get", "sub"], "parking", "#eee", "#d6d6d6"] : ["case", ["!=", ["coalesce", ["get", "col"], ""], ""], ["get", "col"], ["match", ["get", "sub"], "hangar", dark ? "#8a94a6" : "#dfe3ea", "parking", dark ? "#4b505a" : "#b9bdc4", "bridge", dark ? "#aab4c4" : "#eef1f5", dark ? "#5d677c" : "#d9dde4"]], "fill-extrusion-height": ["match", ["get", "sub"], "bridge", 6, ["max", ["get", "h"], 4]], "fill-extrusion-base": ["match", ["get", "sub"], "bridge", 3, 0], "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": true } },
            { id: "term", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { ...(eink() ? {} : { "fill-extrusion-pattern": "cw" }), "fill-extrusion-color": eink() ? "#bbb" : ["case", ["!=", ["coalesce", ["get", "col"], ""], ""], ["get", "col"], dark ? "#4f7db0" : "#8fb4d8"], "fill-extrusion-height": ["max", 6, ["-", ["get", "h"], 2.5]], "fill-extrusion-opacity": 0.97, "fill-extrusion-vertical-gradient": true } },
            { id: "termroof", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { "fill-extrusion-color": eink() ? "#eee" : dark ? "#d7dde6" : "#f7f8fa", "fill-extrusion-base": ["max", 6, ["-", ["get", "h"], 2.5]], "fill-extrusion-height": ["max", 7.5, ["get", "h"]], "fill-extrusion-opacity": 1 } },
            { id: "twr", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#888" : "#e9edf2", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 1 } },
            { id: "twrcab", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#000" : "#2c4f6e", "fill-extrusion-base": ["-", ["get", "h"], 6], "fill-extrusion-height": ["-", ["get", "h"], 1], "fill-extrusion-opacity": 1 } },
            { id: "terml", type: "symbol", source: "apt", minzoom: 14.5, filter: ["==", ["get", "kind"], "lblpt"], layout: { "text-field": ["get", "label"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 17], "text-font": ["Open Sans Bold"], "text-max-width": 12, "symbol-z-order": "source" }, paint: { "text-color": eink() ? "#000" : dark ? "#fff" : "#1b2a4a", "text-halo-color": eink() ? "#fff" : dark ? "#111" : "#fff", "text-halo-width": 2.5 } }] } });
    } catch (e: any) { setErr("3D view could not start on this device (" + (e?.message || "WebGL error") + ")."); return; }
    mref.current = map; (window as any).__a3 = map; (window as any).__a3fx = fx.current; map.on("error", e => console.warn("apt3d", e?.error?.message)); map.on("styleimagemissing", (e: any) => { if (e.id === "cw" && !map.hasImage("cw")) map.addImage("cw", curtain(iata), { pixelRatio: 1 }); }); map.on("rotate", () => setBrg(map.getBearing()));
    // three.js custom layer
    let sign: THREE.Group | null = null; let scene: THREE.Scene, cam: THREE.Camera, ren: THREE.WebGLRenderer, origin: maplibregl.MercatorCoordinate, mpu = 1;
    const layer: any = { id: "planes3d", type: "custom", renderingMode: "3d",
      onAdd(m: maplibregl.Map, gl: WebGLRenderingContext) { scene = new THREE.Scene(); cam = new THREE.Camera(); scene.fog = new THREE.FogExp2(dark ? 0x1a2740 : 0x9ec0de, dark ? 0.00045 : 0.00028); scene.add(new THREE.HemisphereLight(dark ? 0xb8d0f0 : 0xe8f2ff, dark ? 0x2a2618 : 0x6a5a3a, 1.35)); scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.55 : 0.72)); const d = new THREE.DirectionalLight(0xfff1dc, dark ? 2.4 : 2.9); d.position.set(90, -50, 160); scene.add(d); const fill = new THREE.DirectionalLight(0xa8c4ff, 1.05); fill.position.set(-60, 50, 70); scene.add(fill);
        ren = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); ren.autoClear = false; ren.outputColorSpace = THREE.SRGBColorSpace; },
      render(_gl: any, o: any) { if (!origin) return; const now = Date.now(); const z = map.getZoom(); const k = Math.min(2.8, Math.max(1.15, Math.pow(2, (16.8 - z) * 0.58))); let moving = false;
        for (const f of Object.values(fx.current)) { if (!f.obj) continue; const a = f.a; let lon = a.lon, lat = a.lat;
          if (!still() && a.gs > 2 && a.track != null) { const dt = Math.min(12, (now - f.t) / 1000), dm = a.gs * 0.5144 * dt; lat += dm * Math.cos(a.track * Math.PI / 180) / 111320; lon += dm * Math.sin(a.track * Math.PI / 180) / (111320 * Math.cos(lat * Math.PI / 180)); moving = true; }
          const c = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0); const tx = (c.x - origin.x) / mpu, ty = -(c.y - origin.y) / mpu, tz = a.alt === "ground" ? 0 : Math.min(+a.alt || 0, 6000) * 0.3048;
          if (still()) { f.x = tx; f.y = ty; f.z = tz; } else { f.x += (tx - f.x) * 0.2; f.y += (ty - f.y) * 0.2; f.z += (tz - f.z) * 0.2; }
          f.obj.position.set(f.x, f.y, f.z); f.obj.scale.setScalar(k); f.obj.rotation.z = -((a.track ?? 0) * Math.PI / 180);
          if (f.mk) { const ll = new maplibregl.MercatorCoordinate(origin.x + f.x * mpu, origin.y - f.y * mpu, 0).toLngLat(); f.mk.setLngLat(ll); }
          // Follow: camera tracks this plane's position derived from the last real ADS-B report (no invented path when stale/lost)
          if (followHex.current && f.a.hex === followHex.current && mref.current) {
            const age = now - f.t;
            if (age > 45000) { /* stale — leave camera; status updated in poll */ }
            else {
              const ll = new maplibregl.MercatorCoordinate(origin.x + f.x * mpu, origin.y - f.y * mpu, 0).toLngLat();
              mref.current.jumpTo({ center: [ll.lng, ll.lat], bearing: a.track != null ? a.track - 20 : mref.current.getBearing() });
            }
          }
        }
        if (sign) { sign.scale.setScalar(Math.min(3, Math.max(1, Math.pow(2, (16.2 - z) * 0.7)))); const bb = mref.current ? mref.current.getBearing() * Math.PI / 180 : 0, sn = sign.userData.n; if (sn) sign.visible = Math.sin(bb) * sn[0] + Math.cos(bb) * sn[1] < 0.15; }
        const M = new THREE.Matrix4().fromArray(o.defaultProjectionData.mainMatrix); const T = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new THREE.Vector3(mpu, -mpu, mpu));
        cam.projectionMatrix = M.multiply(T); ren.resetState(); try { ren.render(scene, cam); } catch (e: any) { if (!(window as any).__a3e) { (window as any).__a3e = 1; console.error('a3 render', e?.message); } } if (moving) map.triggerRepaint(); } };
    const mkPlane = (a: any) => {
      const cs = (a.flight || "").trim(); const l = liv(cs); const c1 = l ? l[0] : accent; const c2 = l ? l[1] : "#8892a6";
      const name = l ? l[2].replace(/ (UK|Europe|Austria|Ireland)$/, "") : "";
      return glbModel(a.type || "", fam(a.type), cs, c1, name, a.r || a.reg || "") || model(fam(a.type) as any, c1, c2);
    };
    const sync = (L: any[]) => {
      if (!scene || !origin || stop) return; // custom layer onAdd may lag on iOS — next poll retries
      const seen = new Set<string>();
      for (const a of L) { seen.add(a.hex); let f = fx.current[a.hex]; const cs = (a.flight || "").trim(); const l = liv(cs);
        if (!f) {
          const c = maplibregl.MercatorCoordinate.fromLngLat([a.lon, a.lat], 0);
          f = fx.current[a.hex] = { a, lon: a.lon, lat: a.lat, t: Date.now(), x: (c.x - origin.x) / mpu, y: -(c.y - origin.y) / mpu, z: 0 };
          f.obj = mkPlane(a); scene.add(f.obj);
          const d = document.createElement("button"); d.className = "a3lbl"; d.innerHTML = `<i style="background:${l ? l[0] : "#8892a6"}"></i>${cs || a.reg || a.hex}`; d.onclick = () => setSel({ ...fx.current[a.hex].a });
          f.mk = new maplibregl.Marker({ element: d, anchor: "bottom", offset: [0, -18] }).setLngLat([a.lon, a.lat]).addTo(map);
        } else if (f.obj && !(f as any).glb && GOT[glbFile(a.type || "", fam(a.type))]) {
          // Upgrade procedural stand-in once the glTF finishes loading (common on slow phones)
          scene.remove(f.obj); f.obj = mkPlane(a); (f as any).glb = !!GOT[glbFile(a.type || "", fam(a.type))]; scene.add(f.obj);
        }
        if (f.obj && GOT[glbFile(a.type || "", fam(a.type))]) (f as any).glb = true;
        f.a = a; f.t = Date.now(); const T = (trails.current[a.hex] ||= []); const last = T.at(-1); if (!last || last[0] !== a.lon || last[1] !== a.lat) T.push([a.lon, a.lat]); if (T.length > 60) T.shift(); }
      for (const k of Object.keys(fx.current)) if (!seen.has(k)) { const f = fx.current[k]; f.obj && scene.remove(f.obj); f.mk?.remove(); delete fx.current[k]; delete trails.current[k]; }
      (map.getSource("trl") as any)?.setData({ type: "FeatureCollection", features: Object.values(trails.current).filter(t => t.length > 1).map(c => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) });
      map.triggerRepaint();
    };
    let ctr: [number, number] | null = null;
    let polling = false, sawPlanes = false;
    const poll = async () => {
      (window as any).__a3poll = { ctr, stop, scene: !!scene, origin: !!origin, n: Object.keys(fx.current).length };
      if (!ctr || stop || polling) return;
      polling = true;
      try {
        // Wider ring so approaching/departing traffic shows; include low airborne + all ground ADS-B (real positions only)
        const r = await api(`/overhead?lat=${ctr[1]}&lon=${ctr[0]}&r=12`);
        if (stop) return;
        const L = (r.list || []).filter(isPlane).filter((a: any) => a.alt === "ground" || (+a.alt || 99999) < 12000).slice(0, 60);
        (window as any).__a3poll = { ...(window as any).__a3poll, list: L.length, sample: L[0]?.flight, pending: !!r.pending };
        if (r.pending && L.length === 0) {
          setLooking("Looking for aircraft near this airport…");
          if (followHex.current) setFollowSt("waiting");
          return; // keep n null so the looking banner stays up
        }
        setN(L.length);
        setLooking(L.length ? "" : "No aircraft near this airport right now — try again in a minute");
        sync(L);
        (window as any).__a3poll = { ...(window as any).__a3poll, fx: Object.keys(fx.current).length, synced: true };
        setSel((s: any) => s ? { ...(fx.current[s.hex]?.a || s) } : s);
        // Follow plane: only real ADS-B updates; clear inventing when lost/stale
        if (followHex.current) {
          const f = fx.current[followHex.current];
          if (!f) { setFollowSt("lost"); setFollow(false); followHex.current = null; }
          else if (r.stale || r.pending) { setFollowSt("stale"); followAt.current = f.t; }
          else { setFollowSt("following"); followAt.current = f.t;
            if (mref.current) mref.current.easeTo({ center: [f.a.lon, f.a.lat], duration: still() ? 0 : 400, bearing: f.a.track != null ? f.a.track - 20 : mref.current.getBearing() });
          }
        }
        // First time we get planes: always frame the nearest ground/low aircraft (facade cam often points at empty landside)
        if (!sawPlanes && L.length) {
          sawPlanes = true;
          if (userCam.current) { /* keep terminal overview */ } else {
          const gnd = L.filter((a: any) => a.alt === "ground" || (+a.alt || 99999) < 3500);
          const pick = (gnd.length ? gnd : L).slice().sort((a: any, b: any) => (a.nm || 0) - (b.nm || 0))[0];
          if (pick && mref.current) {
            mref.current.easeTo({ center: [pick.lon, pick.lat], zoom: 16.2, bearing: pick.track != null ? pick.track - 30 : mref.current.getBearing(), pitch: flat ? 0 : 56, duration: still() ? 0 : 1100 });
          }
        }
        }
      } catch (e: any) {
        (window as any).__a3poll = { ...(window as any).__a3poll, err: String(e?.message || e) };
        if (!stop) setLooking("Couldn't reach live aircraft yet — trying again…");
      } finally { polling = false; }
    };
    map.on("load", async () => {
      map.addLayer(layer);
      map.triggerRepaint(); // force custom-layer onAdd before first sync (iOS often delays it)
      // Kick glTF in the background with a timeout — NEVER block airport shapes or the ADS-B poll on model download
      const glbReady = Promise.all(["B737_nologo", "A320_nologo", "A350_nologo"].map(loadGlb)).then(() => { if (!stop) poll(); });
      try { const j = await api("/apt3d?iata=" + iata); if (stop) return; if (j.error) throw new Error(j.error); setInfo(j); ctr = j.center; origin = maplibregl.MercatorCoordinate.fromLngLat(j.center, 0); mpu = origin.meterInMercatorCoordinateUnits();
        (map.getSource("apt") as any).setData(j); (window as any).__a3info = j; const toL = (p: number[]): [number, number] => { const c = maplibregl.MercatorCoordinate.fromLngLat(p as any, 0); return [(c.x - origin.x) / mpu, -(c.y - origin.y) / mpu]; }; const fc = scene ? facade(j, toL) : null; let cam0: any = null;
        if (FRAPORT.has(iata)) { FPD.fc = fc ? 1 : 0; FPD.scene = scene ? 1 : 0; setFp({ ...FPD }); }
        if (fc && FRAPORT.has(iata) && !eink()) { // real PD Fraport 2019 logo (Commons). Rooftop placement = user's choice, not seen in reference photos.
          // Bake the logo into one opaque canvas texture (white panel + logo) — no second transparent layer that can lose the depth fight or show its back.
          const cv = document.createElement("canvas"); cv.width = 1296; cv.height = 640; const cx2 = cv.getContext("2d")!; cx2.fillStyle = "#ffffff"; cx2.fillRect(0, 0, cv.width, cv.height);
          const tl = new THREE.CanvasTexture(cv); tl.colorSpace = THREE.SRGBColorSpace; tl.anisotropy = 8;
          const li = new Image(); li.onload = () => { cx2.drawImage(li, 48, 60, 1200, 519); tl.needsUpdate = true; FPD.img = "ok"; setFp({ ...FPD }); map.triggerRepaint(); }; li.onerror = () => { FPD.img = "error"; setFp({ ...FPD }); console.error("a3 fraport logo failed"); }; li.src = "/liveries/Fraport_Logo_2019.png";
          // size from the whole terminal's extent along the facade (the chosen facade edge can be a short 30 m stub → 12 m panel last build)
          const ux = (fc.b[0] - fc.a[0]) / fc.L, uy = (fc.b[1] - fc.a[1]) / fc.L; const pr = (fc.ring || [fc.a, fc.b]).map((q: number[]) => (q[0] - fc.c[0]) * ux + (q[1] - fc.c[1]) * uy); const ext = Math.max(...pr) - Math.min(...pr);
          const w = Math.max(40, Math.min(110, ext * 0.6)), h = w * 640 / 1296; const g = new THREE.Group();
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tl, side: THREE.DoubleSide, depthTest: false, depthWrite: false })); panel.renderOrder = 11; g.add(panel); // same depth setup as the facade text, the only 3D sign path proven visible
          FPD.st = "mesh"; FPD.w = Math.round(w); FPD.z = Math.round(fc.h); FPD.fc = 1;
          const holder = new THREE.Group(); holder.add(g); g.rotation.x = Math.PI / 2; g.position.z = h * 0.6;
          const mx = fc.c ? fc.c[0] : (fc.a[0] + fc.b[0]) / 2, my = fc.c ? fc.c[1] : (fc.a[1] + fc.b[1]) / 2; holder.position.set(mx, my, fc.h + 0.5); FPD.ext = Math.round(ext); // centred on the terminal roof, facing the airfield facade normal
          if (/a3view=sign/.test(location.hash)) { userCam.current = true; const sll = new maplibregl.MercatorCoordinate(origin.x + mx * mpu, origin.y - my * mpu, 0).toLngLat(); const sb = Math.atan2(-fc.n[0], -fc.n[1]) * 180 / Math.PI; setTimeout(() => map.jumpTo({ center: [sll.lng, sll.lat], zoom: 17.6, bearing: sb, pitch: 62 }), 1500); } // direct view of the real 3D panel from the airfield side
          holder.rotation.z = Math.atan2(fc.n[1], fc.n[0]) + Math.PI / 2; scene.add(holder);
        }
        if (fc && !SIGN_REF[iata]?.none) { const SIGN: Record<string, string> = { LPL: "LIVERPOOL JOHN LENNON AIRPORT", MAN: "MANCHESTER AIRPORT", CFU: "CORFU IOANNIS KAPODISTRIAS", FRA: "FRANKFURT AIRPORT", STN: "LONDON STANSTED AIRPORT", DUB: "DUBLIN AIRPORT", LHR: "HEATHROW AIRPORT", ATL: "HARTSFIELD-JACKSON ATLANTA", AMS: "AMSTERDAM SCHIPHOL" }; const txt = (SIGN[iata] || (j.sign || j.name).replace(/["“”(].*$/, "").replace(/\s+/g, " ").trim()).toUpperCase(); const col = eink() ? "#000000" : SIGN_REF[iata]?.col || "#ffffff"; /* white name label everywhere; photo-verified colour override where SIGN_REF has one */ let size = Math.min(14, Math.max(4, fc.h * 0.4)); let r = facadeSign(txt, col, size); if (r.w > fc.L * 0.92) { size = Math.max(4, size * fc.L * 0.92 / r.w); r = facadeSign(txt, col, size); }
          const mx = (fc.a[0] + fc.b[0]) / 2 + fc.n[0] * 0.8, my = (fc.a[1] + fc.b[1]) / 2 + fc.n[1] * 0.8; const onWall = fc.h > size * 1.6; r.o.position.set(mx + fc.n[0] * 4.2, my + fc.n[1] * 4.2, onWall ? fc.h - size * 1.35 : fc.h + 1.4); r.o.rotation.z = Math.atan2(fc.n[1], fc.n[0]) + Math.PI / 2; sign = r.o; sign.userData.n = fc.n; scene.add(sign);
          // dev-only render check (console hook, never shown to users): draws a model at the map centre so liveries can be inspected when no live plane is parked
          (window as any).__a3demo = (type: string, icao: string, name: string) => { const q = [mx + fc.n[0] * 90, my + fc.n[1] * 90]; const o = glbModel(type, "nb", icao, "#073590", name) || model("narrow", "#073590", "#f1c933"); o.position.set(q[0], q[1], 0); o.rotation.z = 0.6; scene.add(o); const ll = new maplibregl.MercatorCoordinate(origin.x + q[0] * mpu, origin.y - q[1] * mpu, 0).toLngLat(); mref.current!.jumpTo({ center: ll }); return true; }; scene.add(aptExtras(fc, j, toL, eink())); (window as any).__a3sign = { txt, size, onWall, L: fc.L };
          const ll = new maplibregl.MercatorCoordinate(origin.x + (mx + fc.n[0] * 60) * mpu, origin.y - (my + fc.n[1] * 60) * mpu, 0).toLngLat(); const brg = Math.atan2(-fc.n[0], -fc.n[1]) * 180 / Math.PI; cam0 = { center: [ll.lng, ll.lat], zoom: (() => { const cl = Math.cos(j.center[1] * Math.PI / 180); let z = 17.4; for (; z > 14; z -= 0.1) { const k = Math.min(3, Math.max(1, Math.pow(2, (16.2 - z) * 0.7))); if (r.w * k / (40075016 * cl / (512 * Math.pow(2, z))) <= 300) break; } return z; })(), pitch: 64, bearing: brg }; map.triggerRepaint(); }
        const b = j.focus || j.bbox; if (cam0) map.jumpTo(cam0); else fit(map, b, true); setLoad(""); setLooking("Looking for aircraft near this airport…"); poll(); void glbReady; }
      catch (e: any) { setLoad(""); setErr("Couldn't load the airport shapes: " + (e?.message || e) + ". OpenStreetMap's free Overpass service can be busy — try again in a minute."); } });
    const t = setInterval(poll, 5000);
    const clk = (e: any) => { let best: any = null, bd = 34; for (const f of Object.values(fx.current)) { if (!f.mk) continue; const p = map.project(f.mk.getLngLat()); const d = Math.hypot(p.x - e.point.x, p.y - e.point.y); if (d < bd) { bd = d; best = f.a; } } if (best) setSel({ ...best }); };
    map.on("click", clk);
    const stopFollow = () => { userCam.current = true; if (!followHex.current) return; followHex.current = null; setFollow(false); setFollowSt(""); };
    map.on("dragstart", stopFollow);
    return () => { stop = true; clearInterval(t); map.off("dragstart", stopFollow); for (const f of Object.values(fx.current)) f.mk?.remove(); fx.current = {}; trails.current = {}; map.remove(); };
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
    <div className="a3side"><button className={"a3btn" + (hist ? " on" : "")} aria-label="History trails" onClick={() => setHist(!hist)}>⟲</button><button className="a3btn" aria-label="Terminal overview" title="Terminal overview" onClick={() => { userCam.current = true; followHex.current = null; setFollow(false); setFollowSt(""); const b = info?.focus || info?.bbox; b && mref.current && fit(mref.current, b, false); }}>➤</button><button className={"a3btn" + (lay ? " on" : "")} aria-label="Layers" onClick={() => setLay(!lay)}>≋</button></div>
    {lay && <div className="a3lay card sm"><label><input type="checkbox" checked={bld} onChange={e => setBld(e.target.checked)} /> 3D buildings</label><label><input type="checkbox" checked={sat} onChange={e => setSat(e.target.checked)} /> Satellite photo</label><label><input type="checkbox" checked={hist} onChange={e => setHist(e.target.checked)} /> Trails (since you opened this)</label></div>}
    <button className="a3btn a3flat" onClick={() => setFlat(!flat)}>{flat ? "3D" : "2D"}</button>
    {!sel && looking && (n == null || n === 0) && <div className="a3load card sm">{looking}{n != null ? ` (${n})` : ""}</div>}
    {!sel && <div className="a3note sm">{info ? <>{info.features.length} OpenStreetMap shapes{info.counts?.terminal ? ` · ${info.counts.terminal} terminal${info.counts.terminal > 1 ? "s" : ""}` : " · no terminal mapped in OSM"}{GLASS_REF[iata] ? " · glass tint from verified photo refs" : " · generic glass (OSM geometry)"}{FRAPORT.has(iata) ? " · real Fraport logo on the roof (placement is our choice, not from photos)" : ""}{SIGN_REF[iata] ? (SIGN_REF[iata].none ? ` · no name sign on the building (as in ${SIGN_REF[iata].date} photo)` : ` · sign colour from ${SIGN_REF[iata].date} photo`) : " · name is a map label, not a real building sign"}</> : null}{n != null && <> · {n} live aircraft on or near the airport (ADS-B)</>} · build {BUILD}{FRAPORT.has(iata) && <> · [temp diag: fraport img={fp.img || "pending"} mesh={fp.st || "none"} facade={fp.fc ?? "?"} scene={fp.scene ?? "?"} w={fp.w ?? "-"}m roof={fp.z ?? "-"}m ext={fp.ext ?? "-"}m]</>}<br /><span className="faint">Buildings = OSM extrusions for every airport (not surveyed). Planes: amvlab models (CC BY 4.0) in simplified airline colours; Ryanair, easyJet, BA and Lufthansa carry their real public-domain wordmarks; Jet2.com/Jet2holidays scheme only when the registration matches a dated photo — still not exact liveries. Follow tracks live ADS-B only. Tap a plane or its label.</span></div>}
    {followSt && (follow || followSt === "lost") && <div className="a3follow card sm" role="status">{followSt === "following" ? "Following live ADS-B position…" : followSt === "waiting" ? "Waiting for live ADS-B…" : followSt === "stale" ? "ADS-B data is stale — showing last known position" : followSt === "lost" ? "Lost contact with this aircraft" : followSt}</div>}
    {sel && <Sheet a={sel} iata={iata} follow={follow && followHex.current === sel.hex} followSt={followSt}
      onFollow={() => { if (followHex.current === sel.hex) { followHex.current = null; setFollow(false); setFollowSt(""); }
        else { followHex.current = sel.hex; setFollow(true); setFollowSt("following"); if (mref.current) mref.current.easeTo({ center: [sel.lon, sel.lat], zoom: Math.max(mref.current.getZoom(), 16.2), duration: still() ? 0 : 600 }); } }}
      onClose={() => { setSel(null); }} />}
  </div>, document.body);
}

function Sheet({ a, iata, onClose, follow, followSt, onFollow }: { a: any; iata: string; onClose: () => void; follow?: boolean; followSt?: string; onFollow?: () => void }) {
  const cs = (a.flight || "").trim(); const l = liv(cs); const [route, setRoute] = useState<any>(undefined); const [ac, setAc] = useState<any>(null); const [open, setOpen] = useState(false);
  useEffect(() => { setRoute(undefined); setAc(null); setOpen(false); if (cs) api("/callsign/" + cs).then(r => setRoute(r.route || null)).catch(() => setRoute(null)); else setRoute(null);
    api("/acars/" + a.hex).then(setAc).catch(() => setAc({ error: true })); }, [a.hex]);
  const msgs = (ac?.list || ac?.messages || []) as any[]; const typed = msgs.filter(m => m.text && /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(m.text));
  const gnd = a.alt === "ground"; const f = fam(a.type);
  return <div className="a3sheet"><div className="a3grab" />
    <div className="row g8" style={{ alignItems: "center" }}><span className="a3logo" style={{ background: l ? l[0] : "#555", color: l ? l[1] : "#fff" }}>{cs.slice(0, 3) || "?"}</span><b className="a3cs">{cs || a.reg || a.hex.toUpperCase()}</b><span className="a3sub">{a.reg && a.reg !== cs ? a.reg : ""}</span><span className="a3sub">{a.type || ""}</span><button className="a3x" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="row between a3mid"><span className="muted">{l ? l[2] : a.desc || "Airline not known"}</span><span><b className="a3big">{a.gs != null ? Math.round(a.gs) : "–"}</b> <span className="muted sm">kt</span> &nbsp; <b className="a3big">{gnd ? "GND" : a.alt != null ? a.alt + " ft" : "–"}</b></span></div>
    <button type="button" className={"a3followbtn" + (follow ? " on" : "")} onClick={onFollow} aria-pressed={!!follow}>{follow ? "Following · drag map to stop" : "Follow plane"}{follow && followSt === "stale" ? " · stale" : follow && followSt === "waiting" ? " · waiting" : ""}</button>
    {route === undefined ? <div className="muted sm a3rt">Looking up route…</div> : route ? <div className="a3rt row between"><div><b>{route.origin?.iata_code}</b><span>{route.origin?.municipality || route.origin?.name}</span></div><div className="a3line" /><div style={{ textAlign: "right" }}><b>{route.destination?.iata_code}</b><span>{route.destination?.municipality || route.destination?.name}</span></div></div> : <div className="muted sm a3rt">No route on file for this callsign.</div>}
    {route && <div className="faint sm">Route for this callsign from adsbdb — airlines reuse callsigns, so it can be out of date.</div>}
    <button className="a3acars" onClick={() => setOpen(!open)} disabled={!typed.length}><span className="tag">ACARS</span> {ac == null ? "checking…" : ac.error ? "couldn't reach airframes.io" : typed.length ? <>{typed.length} typed message{typed.length > 1 ? "s" : ""} · {ago(typed[0].t)}</> : msgs.length ? `${msgs.length} data-only message${msgs.length > 1 ? "s" : ""}, no typed text` : "no messages heard recently"}<span style={{ marginLeft: "auto" }}>{typed.length ? (open ? "▴" : "▾") : ""}</span></button>
    {open && typed.slice(0, 5).map((m, i) => <pre key={i} className="a3msg">{ago(m.t)} · {m.labelText}{"\n"}{m.text.slice(0, 400)}</pre>)}
    <div className="faint sm mt8">{gnd ? (a.gs ?? 0) < 1 ? "Stationary on the ground" : a.gs < 40 ? "Taxiing" : "Runway roll" : "Airborne near " + iata} · live ADS-B (adsb.lol) every 8 s · model: amvlab {f === "wide" ? "A350" : /^A3/.test(a.type || "") || f === "reg" ? "A320" : "737"} shape for this {FAM[f as keyof typeof FAM]} (CC BY 4.0), airline colours and name (not the exact livery){!l && " — airline colours unknown, shown grey"}. ACARS from airframes.io volunteers.</div>
  </div>;
}

