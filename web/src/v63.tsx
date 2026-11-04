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



// ---- textured airliner models: amvlab "aircraft-models" (logo-free variants), CC BY 4.0, https://github.com/amvlab/aircraft-models
// Changed by Skyline: the model's livery colour is recoloured to the airline's colours and the airline name is painted on.
const GLB: Record<string, Promise<THREE.Group | null>> = {}; const GOT: Record<string, THREE.Group | null> = {};
const glbFile = (t = "", f: string) => f === "wide" ? "A350_nologo" : /^A3/.test(t) || f === "reg" ? "A320_nologo" : "B737_nologo";
function loadGlb(n: string) { return GLB[n] ||= new Promise(r => new GLTFLoader().load(`/models/${n}.glb`, g => { GOT[n] = g.scene; r(g.scene); }, undefined, () => { GOT[n] = null; r(null); })); }
const TEX: Record<string, THREE.Texture> = {};
const MIR = 1;
function livTex(n: string, src: any, c1: string, name: string) { const k = n + c1 + name; if (TEX[k]) return TEX[k]; const im = src.image; const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d")!; x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data; const R = parseInt(c1.slice(1, 3), 16), G = parseInt(c1.slice(3, 5), 16), B = parseInt(c1.slice(5, 7), 16);
  const W = c.width / 1024;
  const A = n === "A320_nologo", B7 = n === "B737_nologo";
  for (let i = 0; i < p.length; i += 4) { const r = p[i], g = p[i + 1], b = p[i + 2]; const q = i / 4, y = (q / c.width | 0) / W, xx = (q % c.width) / W;
    if (B7) { if (g > r + 12 && g > b + 4 && g < 140) { p[i] = p[i + 1] = p[i + 2] = 244; } else if (xx > 690 && y > 660 && r > 200 && g > 200 && b > 200) { p[i] = R; p[i + 1] = G; p[i + 2] = B; } }
    else if (A) { if (b > r + 80 && g > r + 50) { p[i] = p[i + 1] = p[i + 2] = 244; } else if (r > 140 && r < 215 && b > 195 && b - r > 22 && g > 170) { p[i] = p[i + 1] = p[i + 2] = 236; } else if (b > r + 40 && b < 170 && g < 100) { const l = Math.min(1.1, b / 110); p[i] = R * l; p[i + 1] = G * l; p[i + 2] = B * l; } }
    else if (g > r + 12 && g > b + 4 && g < 140) { if (y < 400) { p[i] = p[i + 1] = p[i + 2] = 244; } else { const l = Math.min(1.1, g / 70); p[i] = R * l; p[i + 1] = G * l; p[i + 2] = B * l; } } }
  x.putImageData(d, 0, 0); if (name) { x.fillStyle = c1; x.font = `900 ${Math.round(44 * W)}px "Helvetica Neue", Arial, sans-serif`; x.textBaseline = "middle"; x.textAlign = "center"; for (const [k, yy] of (A ? [270, 645] : [134, 278]).entries()) { x.save(); x.translate((A ? 480 : 440) * W, yy * W); if (A && k === MIR) x.scale(-1, 1); x.fillText(name.toUpperCase(), 0, 0); x.restore(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = src.flipY; t.anisotropy = 4; return TEX[k] = t; }
function glbModel(t: string, f: string, c1: string, name: string) { const n = glbFile(t, f); const base = GOT[n]; if (!base) return null; const o = base.clone(true); const E = eink();
  o.traverse((m: any) => { if (m.isMesh) { const src = m.material.map; m.material = new THREE.MeshStandardMaterial({ map: src && !E ? livTex(n, src, c1, name) : src, color: E ? "#dddddd" : "#ffffff", roughness: 0.55, metalness: 0.1 }); } });
  const g = new THREE.Group(); o.rotation.set(Math.PI / 2, 0, 0); const w = new THREE.Group(); w.add(o); w.rotation.z = Math.PI / 2; w.position.z = 2.8; if (f === "reg") w.scale.setScalar(0.74); g.add(w);
  const L = f === "wide" ? 67 : 38; const sh = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, L * 0.9), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: E ? 0.12 : 0.3, depthWrite: false, map: shadowTex() })); sh.position.z = 0.15; g.add(sh); return g; }

// Glass curtain wall: blue glass panes with white mullions (one row per storey band), used as the terminal facade pattern.
function curtain() { const W = 64, H = 64, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#9cc3e6"); g.addColorStop(0.5, "#4f86bd"); g.addColorStop(1, "#2e5f93"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.moveTo(0, 0); x.lineTo(24, 0); x.lineTo(0, 30); x.fill(); x.fillStyle = "#f4f6f9"; for (let i = 0; i < W; i += 16) x.fillRect(i, 0, 2, H); x.fillRect(0, 0, W, 3); x.fillRect(0, 32, W, 2);
  const d = x.getImageData(0, 0, W, H); return { width: W, height: H, data: new Uint8Array(d.data.buffer) }; }
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
  return best ? { ...best, back, h: t.f.properties.h || 14 } : null; }

// Roof overhang along the airside facade + entrance canopy on the landside (simple slabs, not surveyed shapes)
function canopies(fc: any, E: boolean) { const g = new THREE.Group(); const mt = new THREE.MeshStandardMaterial({ color: E ? "#cccccc" : "#e9edf2", roughness: 0.6, metalness: 0.2 }); const pm = new THREE.MeshStandardMaterial({ color: E ? "#888888" : "#9aa3b0", roughness: 0.5 });
  const slab = (e: any, len: number, dep: number, th: number, z: number, off: number, posts: boolean) => { const m = [(e.a[0] + e.b[0]) / 2 + e.n[0] * off, (e.a[1] + e.b[1]) / 2 + e.n[1] * off]; const rot = Math.atan2(e.n[1], e.n[0]) + Math.PI / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, dep, th), mt); b.position.set(m[0], m[1], z); b.rotation.z = rot; g.add(b);
    if (posts) for (let k = -2; k <= 2; k++) { const q = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, z, 8), pm); q.rotation.x = Math.PI / 2; const ux = Math.cos(rot), uy = Math.sin(rot); q.position.set(m[0] + ux * k * len / 5 + e.n[0] * dep * 0.4, m[1] + uy * k * len / 5 + e.n[1] * dep * 0.4, z / 2); g.add(q); } };
  slab(fc, fc.L + 4, 5, 0.8, fc.h + 0.4, 2, false);
  if (fc.back) { const L = Math.min(60, fc.back.L * 0.5); slab(fc.back, L, 10, 0.6, 6, 5, true); }
  return g; }

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
            { id: "apron", type: "fill", source: "apt", filter: ["==", ["get", "kind"], "apron"], paint: { "fill-color": eink() ? "#e6e6e6" : dark ? "#5b6472" : "#cfd5de", "fill-opacity": 0.95 } },
            { id: "twy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": eink() ? "#bbb" : dark ? "#3c475c" : "#aab2c0", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "twye", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], layout: { "line-join": "round" }, paint: { "line-color": eink() ? "#000" : "#f2d24b", "line-opacity": 0.9, "line-gap-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.036], 19, ["*", ["get", "w"], 4.9]], "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.3, 18, 1.6] } }, { id: "twyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "taxiway"], paint: { "line-color": eink() ? "#000" : "#ffd23a", "line-opacity": 0.95, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 2.4] } },
            { id: "twyl", type: "symbol", source: "apt", minzoom: 15, filter: ["all", ["==", ["get", "kind"], "taxiway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 11, "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#111", "text-halo-color": "#ffd400", "text-halo-width": 2 } },
            { id: "rwy", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#333" : dark ? "#161b24" : "#4d5361", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.04], 19, ["*", ["get", "w"], 5.2]] } },
            { id: "rwye", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": eink() ? "#000" : "#e8e8e8", "line-gap-width": ["interpolate", ["exponential", 2], ["zoom"], 12, ["*", ["get", "w"], 0.035], 19, ["*", ["get", "w"], 4.9]], "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 18, 2] } },
            { id: "rwyc", type: "line", source: "apt", filter: ["==", ["get", "kind"], "runway"], paint: { "line-color": "#fff", "line-dasharray": [4, 4], "line-width": 1.2 } },
            { id: "rwyl", type: "symbol", source: "apt", filter: ["all", ["==", ["get", "kind"], "runway"], ["!=", ["get", "name"], ""]], layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-size": 12, "text-font": ["Open Sans Bold"] }, paint: { "text-color": fg, "text-halo-color": bg, "text-halo-width": 1.5 } },
            { id: "trl", type: "line", source: "trl", layout: { visibility: "none" }, paint: { "line-color": eink() ? "#000" : "#ffd166", "line-width": 2, "line-opacity": 0.8 } },
            { id: "bld", type: "fill-extrusion", source: "apt", filter: ["in", ["get", "kind"], ["literal", ["building", "bridge"]]], paint: { "fill-extrusion-color": eink() ? ["match", ["get", "sub"], "parking", "#eee", "#d6d6d6"] : ["case", ["!=", ["coalesce", ["get", "col"], ""], ""], ["get", "col"], ["match", ["get", "sub"], "hangar", dark ? "#8a94a6" : "#dfe3ea", "parking", dark ? "#4b505a" : "#b9bdc4", "bridge", dark ? "#aab4c4" : "#eef1f5", dark ? "#5d677c" : "#d9dde4"]], "fill-extrusion-height": ["match", ["get", "sub"], "bridge", 6, ["max", ["get", "h"], 4]], "fill-extrusion-base": ["match", ["get", "sub"], "bridge", 3, 0], "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": true } },
            { id: "term", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { ...(eink() ? {} : { "fill-extrusion-pattern": "cw" }), "fill-extrusion-color": eink() ? "#bbb" : ["case", ["!=", ["coalesce", ["get", "col"], ""], ""], ["get", "col"], dark ? "#4f7db0" : "#8fb4d8"], "fill-extrusion-height": ["max", 6, ["-", ["get", "h"], 2.5]], "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true } },
            { id: "termroof", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "terminal"], paint: { "fill-extrusion-color": eink() ? "#eee" : dark ? "#d7dde6" : "#f7f8fa", "fill-extrusion-base": ["max", 6, ["-", ["get", "h"], 2.5]], "fill-extrusion-height": ["max", 7.5, ["get", "h"]], "fill-extrusion-opacity": 1 } },
            { id: "twr", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#888" : "#e9edf2", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 1 } },
            { id: "twrcab", type: "fill-extrusion", source: "apt", filter: ["==", ["get", "kind"], "tower"], paint: { "fill-extrusion-color": eink() ? "#000" : "#2c4f6e", "fill-extrusion-base": ["-", ["get", "h"], 6], "fill-extrusion-height": ["-", ["get", "h"], 1], "fill-extrusion-opacity": 1 } },
            { id: "terml", type: "symbol", source: "apt", minzoom: 14.5, filter: ["==", ["get", "kind"], "lblpt"], layout: { "text-field": ["get", "label"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 17], "text-font": ["Open Sans Bold"], "text-max-width": 12, "symbol-z-order": "source" }, paint: { "text-color": eink() ? "#000" : dark ? "#fff" : "#1b2a4a", "text-halo-color": eink() ? "#fff" : dark ? "#111" : "#fff", "text-halo-width": 2.5 } }] } });
    } catch (e: any) { setErr("3D view could not start on this device (" + (e?.message || "WebGL error") + ")."); return; }
    mref.current = map; (window as any).__a3 = map; (window as any).__a3fx = fx.current; map.on("error", e => console.warn("apt3d", e?.error?.message)); map.on("styleimagemissing", (e: any) => { if (e.id === "cw" && !map.hasImage("cw")) map.addImage("cw", curtain(), { pixelRatio: 1 }); }); map.on("rotate", () => setBrg(map.getBearing()));
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
        if (sign) { sign.scale.setScalar(Math.min(3, Math.max(1, Math.pow(2, (16.2 - z) * 0.7)))); const bb = mref.current ? mref.current.getBearing() * Math.PI / 180 : 0, sn = sign.userData.n; if (sn) sign.visible = Math.sin(bb) * sn[0] + Math.cos(bb) * sn[1] < 0.15; }
        const M = new THREE.Matrix4().fromArray(o.defaultProjectionData.mainMatrix); const T = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new THREE.Vector3(mpu, -mpu, mpu));
        cam.projectionMatrix = M.multiply(T); ren.resetState(); try { ren.render(scene, cam); } catch (e: any) { if (!(window as any).__a3e) { (window as any).__a3e = 1; console.error('a3 render', e?.message); } } if (moving) map.triggerRepaint(); } };
    const sync = (L: any[]) => { const seen = new Set<string>();
      for (const a of L) { seen.add(a.hex); let f = fx.current[a.hex]; const cs = (a.flight || "").trim(); const l = liv(cs);
        if (!f) { const c = maplibregl.MercatorCoordinate.fromLngLat([a.lon, a.lat], 0); f = fx.current[a.hex] = { a, lon: a.lon, lat: a.lat, t: Date.now(), x: (c.x - origin.x) / mpu, y: -(c.y - origin.y) / mpu, z: 0 };
          f.obj = glbModel(a.type || "", fam(a.type), l ? l[0] : accent, l ? l[2].replace(/ (UK|Europe|Austria|Ireland)$/, "") : "") || model(fam(a.type) as any, l ? l[0] : accent, l ? l[1] : "#8892a6"); scene.add(f.obj);
          const d = document.createElement("button"); d.className = "a3lbl"; d.innerHTML = `<i style="background:${l ? l[0] : "#8892a6"}"></i>${cs || a.reg || a.hex}`; d.onclick = () => setSel({ ...fx.current[a.hex].a });
          f.mk = new maplibregl.Marker({ element: d, anchor: "bottom", offset: [0, -14] }).setLngLat([a.lon, a.lat]).addTo(map); }
        f.a = a; f.t = Date.now(); const T = (trails.current[a.hex] ||= []); const last = T.at(-1); if (!last || last[0] !== a.lon || last[1] !== a.lat) T.push([a.lon, a.lat]); if (T.length > 60) T.shift(); }
      for (const k of Object.keys(fx.current)) if (!seen.has(k)) { const f = fx.current[k]; f.obj && scene.remove(f.obj); f.mk?.remove(); delete fx.current[k]; delete trails.current[k]; }
      (map.getSource("trl") as any)?.setData({ type: "FeatureCollection", features: Object.values(trails.current).filter(t => t.length > 1).map(c => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) });
      map.triggerRepaint(); };
    let ctr: [number, number] | null = null;
    const poll = async () => { if (!ctr || stop) return; try { const r = await api(`/overhead?lat=${ctr[1]}&lon=${ctr[0]}&r=6`); if (stop) return; const L = (r.list || []).filter(isPlane).filter((a: any) => a.alt === "ground" || (+a.alt || 99999) < 6000).slice(0, 40); setN(L.length); sync(L); setSel((s: any) => s ? { ...(fx.current[s.hex]?.a || s) } : s); } catch { } };
    map.on("load", async () => { map.addLayer(layer); await Promise.all(["B737_nologo", "A320_nologo", "A350_nologo"].map(loadGlb));
      try { const j = await api("/apt3d?iata=" + iata); if (stop) return; if (j.error) throw new Error(j.error); setInfo(j); ctr = j.center; origin = maplibregl.MercatorCoordinate.fromLngLat(j.center, 0); mpu = origin.meterInMercatorCoordinateUnits();
        (map.getSource("apt") as any).setData(j); (window as any).__a3info = j; const toL = (p: number[]): [number, number] => { const c = maplibregl.MercatorCoordinate.fromLngLat(p as any, 0); return [(c.x - origin.x) / mpu, -(c.y - origin.y) / mpu]; }; const fc = scene ? facade(j, toL) : null; let cam0: any = null;
        if (fc) { const txt = (j.sign || j.name).replace(/["“”(].*$/, "").replace(/\s+/g, " ").trim().toUpperCase(); const col = eink() ? "#000000" : iata === "LPL" ? "#d6001c" : "#ffffff"; let size = Math.min(14, Math.max(4, fc.h * 0.4)); let r = facadeSign(txt, col, size); if (r.w > fc.L * 0.92) { size = Math.max(4, size * fc.L * 0.92 / r.w); r = facadeSign(txt, col, size); }
          const mx = (fc.a[0] + fc.b[0]) / 2 + fc.n[0] * 0.8, my = (fc.a[1] + fc.b[1]) / 2 + fc.n[1] * 0.8; const onWall = fc.h > size * 1.6; r.o.position.set(mx + fc.n[0] * 4.2, my + fc.n[1] * 4.2, onWall ? fc.h - size * 1.35 : fc.h + 1.4); r.o.rotation.z = Math.atan2(fc.n[1], fc.n[0]) + Math.PI / 2; sign = r.o; sign.userData.n = fc.n; scene.add(sign);
          // dev-only render check (console hook, never shown to users): draws a model at the map centre so liveries can be inspected when no live plane is parked
          (window as any).__a3demo = (type: string, c1: string, name: string) => { const q = [mx + fc.n[0] * 90, my + fc.n[1] * 90]; const o = glbModel(type, "nb", c1, name); if (!o) return false; o.position.set(q[0], q[1], 0); o.rotation.z = 0.6; scene.add(o); const ll = new maplibregl.MercatorCoordinate(origin.x + q[0] * mpu, origin.y - q[1] * mpu, 0).toLngLat(); mref.current!.jumpTo({ center: ll }); return true; }; scene.add(canopies(fc, eink())); (window as any).__a3sign = { txt, size, onWall, L: fc.L };
          const ll = new maplibregl.MercatorCoordinate(origin.x + (mx + fc.n[0] * 60) * mpu, origin.y - (my + fc.n[1] * 60) * mpu, 0).toLngLat(); const brg = Math.atan2(-fc.n[0], -fc.n[1]) * 180 / Math.PI; cam0 = { center: [ll.lng, ll.lat], zoom: (() => { const cl = Math.cos(j.center[1] * Math.PI / 180); let z = 17.4; for (; z > 14; z -= 0.1) { const k = Math.min(3, Math.max(1, Math.pow(2, (16.2 - z) * 0.7))); if (r.w * k / (40075016 * cl / (512 * Math.pow(2, z))) <= 300) break; } return z; })(), pitch: 64, bearing: brg }; map.triggerRepaint(); }
        const b = j.focus || j.bbox; if (cam0) map.jumpTo(cam0); else fit(map, b, true); setLoad(""); poll(); }
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
    {!sel && <div className="a3note sm">{info ? <>{info.features.length} OpenStreetMap shapes{info.counts?.terminal ? ` · ${info.counts.terminal} terminal${info.counts.terminal > 1 ? "s" : ""}` : " · no terminal mapped in OSM"}</> : null}{n != null && <> · {n} live aircraft on or near the airport (ADS-B)</>}<br /><span className="faint">Planes: 3D models by amvlab (CC BY 4.0, recoloured by Skyline with airline colours and name — not exact liveries). Tap a plane or its label.</span></div>}
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
    <div className="faint sm mt8">{gnd ? (a.gs ?? 0) < 1 ? "Stationary on the ground" : a.gs < 40 ? "Taxiing" : "Runway roll" : "Airborne near " + iata} · live ADS-B (adsb.lol) every 8 s · model: amvlab {f === "wide" ? "A350" : /^A3/.test(a.type || "") || f === "reg" ? "A320" : "737"} shape for this {FAM[f as keyof typeof FAM]} (CC BY 4.0), airline colours and name (not the exact livery){!l && " — airline colours unknown, shown grey"}. ACARS from airframes.io volunteers.</div>
  </div>;
}

