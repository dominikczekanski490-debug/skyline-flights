// Airport Manager 3D view (lazy-loaded): the same grid save drawn in low-poly 3D with three.js. Instanced meshes per tile type,
// animated planes from the live simulation, day/night lighting from the game clock, camera presets (overview, tower, follow a plane).
// Orbit / pinch-zoom / two-finger pan on touch. The WebGL context is released on close (dispose + forceContextLoss) to keep memory low.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { W, H, hm, type Save, type Tile } from "./mgr/sim";
import { planePos, nightOf, TERM_COL, AL_COL } from "./mgr/map";

type Cam = "overview" | "tower" | "follow";
const X = (mx: number) => mx - W * 5, Z = (my: number) => my - H * 5; // map units → world (centred)

export default function Mgr3D({ s, close }: { s: Save; close: () => void }) {
  const host = useRef<HTMLDivElement>(null); const sRef = useRef(s); sRef.current = s; const [cam, setCam] = useState<Cam>("overview"); const camRef = useRef<Cam>("overview"); camRef.current = cam;
  const [err, setErr] = useState(""); const [follow, setFollow] = useState("");
  useEffect(() => {
    const el = host.current!; let ren: THREE.WebGLRenderer;
    try { ren = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" }); } catch { setErr("3D isn't available on this device."); return; }
    ren.setPixelRatio(Math.min(2, devicePixelRatio)); ren.setSize(el.clientWidth, el.clientHeight); ren.shadowMap.enabled = false; el.appendChild(ren.domElement);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 1, 1200); const OV = () => { const a = el.clientWidth / el.clientHeight; const d = Math.max(130, 50 / Math.tan(25 * Math.PI / 180) / Math.min(1.4, a)); camera.position.set(0, d * .72, d * .7); ctl.target.set(0, 0, 4); };
    const ctl = new OrbitControls(camera, ren.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.47; ctl.minDistance = 20; ctl.maxDistance = 700; OV();
    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a5a40, 1.1); scene.add(hemi); const sun = new THREE.DirectionalLight(0xfff2dd, 1.6); sun.position.set(-60, 120, 40); scene.add(sun);
    const trash: { dispose: () => void }[] = []; const geo = <T extends THREE.BufferGeometry>(g: T) => (trash.push(g), g); const mat = <T extends THREE.Material>(m: T) => (trash.push(m), m);
    // ground
    const apron = new THREE.Mesh(geo(new THREE.PlaneGeometry(W * 10 + 8, H * 10 + 8)), mat(new THREE.MeshLambertMaterial({ color: 0x5c9a62 }))); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);
    const ground = new THREE.Mesh(geo(new THREE.PlaneGeometry(2400, 2400)), mat(new THREE.MeshLambertMaterial({ color: 0x4a8a57 }))); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
    // static tiles (rebuilt when the grid changes)
    let stat = new THREE.Group(); scene.add(stat); let gridKey = ""; const winMats: THREE.MeshLambertMaterial[] = []; let lights: THREE.InstancedMesh | null = null;
    const buildStatic = (g: Tile[], term: string) => {
      scene.remove(stat); stat.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); } }); stat = new THREE.Group(); scene.add(stat); winMats.length = 0;
      const [tc, tcd] = TERM_COL[term] || TERM_COL.glass; const groups: Record<string, number[]> = {}; g.forEach((t, i) => (groups[t] ||= []).push(i));
      const inst = (idx: number[] | undefined, geom: THREE.BufferGeometry, m: THREE.Material, y: number, f?: (o: THREE.Object3D, i: number) => void) => { if (!idx?.length) return null; const im = new THREE.InstancedMesh(geom, m, idx.length); const o = new THREE.Object3D();
        idx.forEach((i, k) => { o.position.set(X((i % W) * 10 + 5), y, Z(Math.floor(i / W) * 10 + 5)); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); f?.(o, i); o.updateMatrix(); im.setMatrixAt(k, o.matrix); }); stat.add(im); return im; };
      const flat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
      inst(groups.rw, new THREE.BoxGeometry(10, 0.2, 10), flat(0x2a2e35), 0.1); inst(groups.rw, new THREE.BoxGeometry(6, 0.05, 0.6), flat(0xeeeeee), 0.24);
      inst(groups.tx, new THREE.BoxGeometry(10, 0.15, 10), flat(0x4b5160), 0.08); inst(groups.tx, new THREE.BoxGeometry(10, 0.05, 0.4), flat(0xf5c400), 0.18);
      inst([...(groups.st || []), ...(groups.gt || [])], new THREE.BoxGeometry(10, 0.15, 10), flat(0x5b6170), 0.08);
      const win = new THREE.MeshLambertMaterial({ color: 0x2c3e57, emissive: 0x000000 }); winMats.push(win);
      inst(groups.tm, new THREE.BoxGeometry(10, 7, 10), flat(new THREE.Color(tc).getHex()), 3.5); inst(groups.tm, new THREE.BoxGeometry(10.1, 2, 10.1), win, 4.2); inst(groups.tm, new THREE.BoxGeometry(10.4, 0.6, 10.4), flat(new THREE.Color(tcd).getHex()), 7.2);
      // jet bridges point from the terminal side of the gate tile toward the stand centre
      inst(groups.gt, new THREE.BoxGeometry(1.8, 1.8, 6), flat(new THREE.Color(tcd).getHex()), 3.2, (o, i) => { const up = g[i - W] === "tm", dn = g[i + W] === "tm", lf = g[i - 1] === "tm"; o.position.z += up ? -2 : dn ? 2 : 0; o.position.x += lf ? -2 : !up && !dn ? 2 : 0; if (!up && !dn) o.rotation.y = Math.PI / 2; });
      inst(groups.gt, new THREE.CylinderGeometry(0.3, 0.3, 3, 6), flat(0x9aa3ad), 1.5);
      inst(groups.tw, new THREE.CylinderGeometry(1.2, 1.8, 22, 8), flat(0xd5dbe3), 11); const twg = new THREE.MeshLambertMaterial({ color: 0x5aa0c8, emissive: 0x000000 }); winMats.push(twg); inst(groups.tw, new THREE.CylinderGeometry(3.4, 2.6, 3.2, 8), twg, 23.4); inst(groups.tw, new THREE.CylinderGeometry(3.6, 3.6, 0.6, 8), flat(0x334155), 25.3);
      const box = (k: string, h: number, c: number, roof: number) => { inst(groups[k], new THREE.BoxGeometry(9, h, 9), flat(c), h / 2); inst(groups[k], new THREE.BoxGeometry(9.4, 0.5, 9.4), flat(roof), h + 0.25); };
      box("sh", 4, new THREE.Color(tc).getHex(), 0xec4899); box("fd", 4, new THREE.Color(tc).getHex(), 0xf59e0b); box("sc", 5, new THREE.Color(tc).getHex(), 0x3b82f6); box("bg", 5, new THREE.Color(tc).getHex(), 0x8b5cf6);
      inst(groups.pk, new THREE.BoxGeometry(10, 0.12, 10), flat(0x6b7280), 0.06); inst(groups.pk, new THREE.BoxGeometry(2, 1.2, 3.6), flat(0xdc2626), 0.7, (o, i) => { o.position.x += (i % 3) * 2.5 - 2.5; o.position.z += 1.5; });
      inst(groups.pk, new THREE.BoxGeometry(2, 1.2, 3.6), flat(0x2563eb), 0.7, (o, i) => { o.position.x += ((i + 1) % 3) * 2.5 - 2.5; o.position.z -= 2.5; });
      inst(groups.rl, new THREE.BoxGeometry(10, 0.3, 4), flat(0x57534e), 0.15); inst(groups.rl, new THREE.BoxGeometry(8, 3, 2.6), flat(0xe5e7eb), 1.8);
      inst(groups.hg, new THREE.CylinderGeometry(5, 5, 10, 10, 1, false, 0, Math.PI), flat(0x94a3b8), 0, o => { o.rotation.z = Math.PI / 2; o.rotation.y = Math.PI / 2; });
      // runway edge lights (glow at night)
      const rwi = groups.rw || []; const lm = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0 }); lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 6, 4), lm, rwi.length * 2); const o = new THREE.Object3D();
      rwi.forEach((i, k) => [-4.4, 4.4].forEach((dz, j) => { o.position.set(X((i % W) * 10 + 5), 0.5, Z(Math.floor(i / W) * 10 + 5) + dz); o.updateMatrix(); lights!.setMatrixAt(k * 2 + j, o.matrix); })); stat.add(lights);
      // a few low-poly trees around the edge (fixed pattern, instanced)
      const tr: number[] = []; for (let k = 0; k < 26; k++) tr.push(k); const tree = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 7, 6), flat(0x2f6b3c), tr.length); tr.forEach(k => { const a = k / tr.length * Math.PI * 2; o.position.set(Math.cos(a) * (W * 5 + 18 + (k % 3) * 6), 3.5, Math.sin(a) * (H * 5 + 16 + (k % 4) * 5)); o.updateMatrix(); tree.setMatrixAt(k, o.matrix); }); stat.add(tree);
    };
    // planes: instanced fuselage / wings / tail
    const MAXP = 48; const fus = new THREE.InstancedMesh(geo(new THREE.CylinderGeometry(0.9, 0.9, 11, 8).rotateZ(Math.PI / 2)), mat(new THREE.MeshLambertMaterial({ color: 0xf4f6fa })), MAXP);
    const wing = new THREE.InstancedMesh(geo(new THREE.BoxGeometry(3, 0.25, 12)), mat(new THREE.MeshLambertMaterial({ color: 0xdfe4ec })), MAXP);
    const tail = new THREE.InstancedMesh(geo(new THREE.BoxGeometry(2.4, 3, 0.25).translate(-4.6, 1.8, 0)), mat(new THREE.MeshLambertMaterial({ color: 0xffffff })), MAXP);
    const stab = new THREE.InstancedMesh(geo(new THREE.BoxGeometry(1.6, 0.2, 4.4).translate(-4.8, 0.4, 0)), mat(new THREE.MeshLambertMaterial({ color: 0xdfe4ec })), MAXP);
    [fus, wing, tail, stab].forEach(m => { m.count = 0; m.frustumCulled = false; scene.add(m); });
    const cur = new Map<string, { x: number; y: number; z: number; h: number }>(); const o = new THREE.Object3D(); const col = new THREE.Color();
    const sky = new THREE.Color(), dayC = new THREE.Color(0x9ccbf0), nightC = new THREE.Color(0x0a1430); scene.background = sky; scene.fog = new THREE.Fog(0x9ccbf0, 520, 1150);
    let raf = 0, alive = true; const tower = () => { const i = sRef.current.grid.indexOf("tw"); return i >= 0 ? new THREE.Vector3(X((i % W) * 10 + 5), 26, Z(Math.floor(i / W) * 10 + 5)) : new THREE.Vector3(X(W * 10 - 5), 26, Z(H * 10 - 5)); };
    let lastCam: Cam | "" = "";
    const frame = () => { if (!alive) return; raf = requestAnimationFrame(frame); if (document.hidden) return; const S = sRef.current; const key = S.grid.join("") + S.term; if (key !== gridKey) { gridKey = key; buildStatic(S.grid, S.term); }
      const n = nightOf(S.clock); sky.copy(dayC).lerp(nightC, n); (scene.fog as THREE.Fog).color.copy(sky); hemi.intensity = 1.1 - n * 0.8; sun.intensity = 1.6 - n * 1.45; sun.color.setHSL(0.1, 0.6, 0.85 - n * 0.3);
      winMats.forEach(m => m.emissive.setHex(n > 0.35 ? 0xffc965 : 0x000000)); if (lights) (lights.material as THREE.MeshBasicMaterial).opacity = n > 0.25 ? n : 0;
      let k = 0; let followPos: THREE.Vector3 | null = null; let followMoving = false; let fol = ""; const seen = new Set<string>();
      for (const r of S.rots) { if (k >= MAXP) break; const p = planePos(S, r, S.clock); if (!p) continue; seen.add(r.id); const tgt = { x: X(p.x), y: p.z > 1.02 ? (p.z - 1) * 45 : 0.9, z: Z(p.y), h: -p.h * Math.PI / 180 }; const c = cur.get(r.id) || tgt;
        const nx = { x: c.x + (tgt.x - c.x) * 0.12, y: c.y + (tgt.y - c.y) * 0.12, z: c.z + (tgt.z - c.z) * 0.12, h: c.h + Math.atan2(Math.sin(tgt.h - c.h), Math.cos(tgt.h - c.h)) * 0.15 }; cur.set(r.id, nx);
        o.position.set(nx.x, nx.y + 1.2, nx.z); o.rotation.set(0, nx.h, 0); o.scale.setScalar(1.25); o.updateMatrix(); fus.setMatrixAt(k, o.matrix); wing.setMatrixAt(k, o.matrix); tail.setMatrixAt(k, o.matrix); stab.setMatrixAt(k, o.matrix); tail.setColorAt(k, col.set(r.vip ? "#111111" : AL_COL(r.al)));
        if (["taxiIn", "taxiOut", "tkof", "land", "push", "app"].includes(r.ph) ? !followMoving : !followPos) { followPos = new THREE.Vector3(nx.x, nx.y, nx.z); fol = r.num; if (r.ph !== "park") followMoving = true; } k++; }
      for (const id of cur.keys()) if (!seen.has(id)) cur.delete(id);
      [fus, wing, tail, stab].forEach(m => { m.count = k; m.instanceMatrix.needsUpdate = true; }); if (tail.instanceColor) tail.instanceColor.needsUpdate = true;
      const cm = camRef.current; if (cm !== lastCam) { lastCam = cm; if (cm === "overview") OV(); if (cm === "tower") { const t = tower(); const l = Math.hypot(t.x, t.z) || 1; camera.position.set(t.x + t.x / l * 34, 58, t.z + t.z / l * 34); ctl.target.set(-t.x * .2, 0, -t.z * .2); } }
      if (cm === "follow" && followPos) { ctl.target.lerp(followPos, 0.15); const want = followPos.clone().add(new THREE.Vector3(-16, 26 + followPos.y * 0.3, 30)); camera.position.lerp(want, 0.05); }
      if (cm === "follow") setFollow(f => f === fol ? f : fol);
      ctl.update(); ren.render(scene, camera); };
    frame();
    const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; ren.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }); ro.observe(el);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); ctl.dispose();
      stat.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(q => q.dispose()); } }); [fus, wing, tail, stab].forEach(m => m.dispose()); trash.forEach(t => t.dispose());
      ren.dispose(); ren.forceContextLoss(); ren.domElement.remove(); };
  }, []);
  return createPortal(<div className="mg3d-wrap" role="dialog" aria-label="3D airport view"><div ref={host} className="mg3d-c" />
    <div className="mg3d-top"><b>{s.name || "My airport"} · {s.phase === "day" ? hm(s.clock) : "between days"}</b><button className="mg3d-x" aria-label="Close 3D view" onClick={close}>✕</button></div>
    <div className="mg3d-cams">{([["overview", "🛰️ Overview"], ["tower", "🗼 Tower"], ["follow", "✈️ Follow plane"]] as [Cam, string][]).map(([k, n]) => <button key={k} className={cam === k ? "on" : ""} onClick={() => setCam(k)}>{n}</button>)}</div>
    {cam === "follow" && <p className="mg3d-note">{follow ? "Following " + follow : s.phase === "day" ? "Waiting for a plane to move…" : "Start the day to see planes move"}</p>}
    {err && <p className="mg3d-note">{err}</p>}<p className="mg3d-help">Drag to orbit · pinch to zoom · two fingers to pan</p></div>, document.body);
}
