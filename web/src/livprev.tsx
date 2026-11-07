// Livery preview: renders the REAL in-app 3D models + painter (v63 glbModel) for each scheme. Clearly labelled preview, not live ADS-B traffic.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { glbModel, loadGlb, glbFile } from "./v63";
import { SCHEMES, JET2_REG } from "./schemes3d";
import { BUILD } from "./extras";
// sample callsign/registration that the app's own brandOf() maps to each scheme
const CASES: Record<string, { cs: string; reg: string; name: string }> = {
  FR: { cs: "RYR1AB", reg: "EI-GXL", name: "Ryanair" }, EZY: { cs: "EZY12A", reg: "G-UZHS", name: "easyJet" }, BA: { cs: "BAW123", reg: "G-TTNS", name: "British Airways" },
  LH: { cs: "DLH4AB", reg: "D-AINF", name: "Lufthansa" }, J2COM: { cs: "EXS12A", reg: "G-SUNS", name: "Jet2.com" }, J2HOL: { cs: "EXS34B", reg: "G-HLYI", name: "Jet2holidays" }, J2: { cs: "EXS99Z", reg: "G-XXXX", name: "Jet2 (unknown reg)" },
};
const TYPES: Record<string, [string, string]> = { A320: ["A320", "narrow"], B737: ["B738", "narrow"], A350: ["A359", "wide"] };
export default function LivPreview() {
  const h = location.hash; const sch = (h.match(/livpreview=(\w+)/)?.[1] || "J2HOL").toUpperCase(); const mdl = (h.match(/model=(\w+)/)?.[1] || "A320").toUpperCase(); const sideV = h.match(/side=(\w)/)?.[1] || "q"; const gearOn = !/gear=0/.test(h);
  const el = useRef<HTMLDivElement>(null); const [st, setSt] = useState("loading model…");
  useEffect(() => { const c = el.current!; const W = c.clientWidth, H = c.clientHeight; let ren: THREE.WebGLRenderer; try { ren = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e: any) { setSt("ERROR: WebGL unavailable: " + (e?.message || e)); return; } ren.setPixelRatio(Math.min(2, devicePixelRatio)); ren.setSize(W, H); ren.outputColorSpace = THREE.SRGBColorSpace; c.appendChild(ren.domElement);
    const sc = new THREE.Scene(); sc.background = new THREE.Color("#cfd8e3"); sc.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(30, -40, 60); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, W / H, 1, 1000); cam.up.set(0, 0, 1); let stop = false, raf = 0;
    const [ty, fam] = TYPES[mdl] || TYPES.A320; const k = CASES[sch] || CASES.J2HOL;
    const file = glbFile(ty, fam); loadGlb(file).then((g: any) => { if (!g) { setSt(`ERROR: /models/${file}.glb did not load (GLTFLoader error or 10 s timeout)`); return; } if (stop) return; const t0 = performance.now(); let o: any; try { o = glbModel(ty, fam, k.cs, "#888888", k.name, k.reg); } catch (e: any) { setSt("ERROR painting: " + (e?.message || e)); console.error(e); return; } if (!o) { setSt(`ERROR: glbModel returned null for ${file}`); return; } sc.add(o); if (o.userData.gear) o.userData.gear.visible = gearOn;
      setSt(`painted in ${Math.round(performance.now() - t0)} ms`); (window as any).__livprev = { sch, mdl, ok: true };
      // glbModel frame: nose → world +Y, starboard (model +Z) → world +X. Left/port profile = camera on −X.
      let a = sideV === "l" ? Math.PI : sideV === "r" ? 0 : Math.PI - 0.6; const gr = o.userData.gear as THREE.Object3D | undefined; let nv = 0; gr?.traverse((m: any) => { if (m.isMesh) nv++; }); const R = fam === "wide" ? 120 : 75;
      setSt(s0 => s0 + ` · gear ${gr ? (gearOn ? "DOWN" : "UP") + " (" + nv + " parts)" : "n/a"}`);
      const loop = () => { if (stop) return; if (gr) gr.visible = gearOn; if (sideV === "s") a += 0.004; cam.position.set(Math.cos(a) * R, Math.sin(a) * R, sideV === "q" || sideV === "s" ? R * 0.28 : 4); cam.lookAt(0, 0, sideV === "l" || sideV === "r" ? 4 : 3); ren.render(sc, cam); raf = requestAnimationFrame(loop); }; loop(); });
    return () => { stop = true; cancelAnimationFrame(raf); ren.dispose(); c.innerHTML = ""; }; }, [sch, mdl, sideV, gearOn]);
  const S = SCHEMES[sch]; const link = (s: string, m = mdl, v = sideV, gr = gearOn) => `#livpreview=${s}&model=${m}&side=${v}${gr ? "" : "&gear=0"}`;
  return <div style={{ position: "fixed", inset: 0, background: "#0b1220", color: "#fff", font: "13px system-ui", display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "8px 10px", background: "#7a1d1d" }}><b>LIVERY PREVIEW — not live traffic.</b> Real in-app 3D model + paint code, sample registration {CASES[sch]?.reg}. Build {BUILD}. {st}</div>
    <div style={{ padding: "6px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>{Object.keys(CASES).map(s => <a key={s} href={link(s)} onClick={() => setTimeout(() => location.reload(), 0)} style={{ color: s === sch ? "#ffd34d" : "#9cc3ff" }}>{s}</a>)} · {Object.keys(TYPES).map(m => <a key={m} href={link(sch, m)} onClick={() => setTimeout(() => location.reload(), 0)} style={{ color: m === mdl ? "#ffd34d" : "#9cc3ff" }}>{m}</a>)} · {["l", "r", "q", "s"].map(v => <a key={v} href={link(sch, mdl, v)} onClick={() => setTimeout(() => location.reload(), 0)} style={{ color: v === sideV ? "#ffd34d" : "#9cc3ff" }}>{{ l: "left", r: "right", q: "3/4", s: "spin" }[v]}</a>)} · <a href={link(sch, mdl, sideV, !gearOn)} onClick={() => setTimeout(() => location.reload(), 0)} style={{ color: "#9cc3ff" }}>gear {gearOn ? "down → up" : "up → down"}</a></div>
    <div ref={el} style={{ flex: 1, minHeight: 0 }} />
    <div style={{ padding: "6px 10px", fontSize: 11, opacity: 0.85 }}>{S ? <>Ref photo: {S.ref}. {S.notes}. Simplified stylised scheme, not an exact livery.</> : "unknown scheme"} Landing gear: Skyline-made from public type dimensions; in the live view it shows only when ADS-B reports on-ground (no gear telemetry exists). Jet2 sub-brand only for photo-checked registrations: {Object.keys(JET2_REG).join(", ")}; others get the neutral Jet2 fallback.</div></div>;
}
