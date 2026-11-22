// Runway Roulette: hand-fly short final into four stylised "scary" runways (inspired by famous tricky approaches, drawn as simple
// game scenery, not real charts). Drag to steer and hold height on the glide path, watch the PAPI lights, flare, and touch down on the centreline.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, End, sfx, clamp } from "./kit";

type Lvl = { k: string; n: string; sub: string; off: number; wind: number; len: number; sea: boolean; hills: number; rock?: boolean; road?: boolean; beach?: boolean };
const LV: Lvl[] = [
  { k: "rock", n: "Rock & Road", sub: "Gibraltar-style: a giant rock beside you, a road across the middle. Land before the road!", off: 40, wind: 7, len: 1700, sea: true, hills: 0, rock: true, road: true },
  { k: "cliff", n: "Cliffside", sub: "Madeira-style: you start well off to the side. Line up late, over the sea, in gusty wind.", off: 260, wind: 9, len: 2700, sea: true, hills: 1 },
  { k: "valley", n: "Valley", sub: "Mountain-valley style: hills on both sides and a late lineup.", off: -180, wind: 6, len: 2000, sea: false, hills: 2 },
  { k: "beach", n: "Beach Pass", sub: "Beach-approach style: low over the sand, short runway. Don't land short!", off: 25, wind: 5, len: 2100, sea: true, hills: 0, beach: true },
];
type St = { d: number; h: number; ox: number; vx: number; vy: number; g: number; gt: number; t: number; done?: string; pts?: number; tdz?: number };
const V = 70, GS = Math.tan(3 * Math.PI / 180);
const fresh = (l: Lvl): St => ({ d: 2300, h: 2300 * GS + (Math.random() * 30 - 15), ox: l.off, vx: 0, vy: -V * GS, g: 0, gt: 0, t: 0 });
export default function RunwayRoulette() {
  const [best, report] = useBest("roulette"); const [ref, get] = useCanvas(); const [li, setLi] = useState(-1); const [tot, setTot] = useState<number[]>([]); const S = useRef<St>(fresh(LV[0])); const inp = useRef({ x: 0, y: 0, ax: 0, ay: 0, on: false }); const [, setUi] = useState(0); const [run, setRun] = useState(false); const [nb, setNb] = useState(false); const tu = useRef(0);
  const L = LV[Math.max(0, li)];
  const go = (i: number, keep: number[]) => { setLi(i); setTot(keep); S.current = fresh(LV[i]); setRun(true); sfx.whoosh(); };
  const end = (txt: string, pts: number) => { const s = S.current; s.done = txt; s.pts = Math.max(0, Math.round(pts)); setRun(false); const t = [...tot, s.pts]; setTot(t); (pts > 500 ? sfx.win : pts > 0 ? sfx.land : sfx.bad)(); if (li === LV.length - 1) { const sum = t.reduce((a, b) => a + b, 0); setNb(sum > 0 && report(sum)); } setUi(u => u + 1); };
  useLoop(dt => { const s = S.current; if (s.done) return; s.t += dt; const I = inp.current;
    s.gt -= dt; if (s.gt <= 0) { s.gt = .4 + Math.random() * .8; s.g = (Math.random() * 2 - 1) * L.wind * (L.rock && s.d < 1400 ? 1.6 : 1); }
    s.vx += (I.x * 14 - s.vx * .9 + s.g) * dt; s.ox += s.vx * dt; const tgt = -V * GS + I.y * 4.5; s.vy += (tgt - s.vy) * 1.6 * dt; s.h += s.vy * dt; s.d -= V * dt;
    if (s.h <= 0) { const pos = -s.d; const sink = -s.vy;
      if (s.d > 0) end(L.sea && !L.beach ? "Splash! Landed in the sea short of the runway." : "Landed short of the runway: on the " + (L.beach ? "beach" : "grass") + "!", 0);
      else if (Math.abs(s.ox) > 24) end("Touched down off the side of the runway.", 50);
      else if (L.road && pos > L.len * .45) end("Landed past the road. The traffic lights were red for you!", 150);
      else if (pos > L.len * .7) end("Too far down the runway: ran off the end.", 80);
      else { s.tdz = pos; end(sink > 3.4 ? "Firm arrival… but on the runway." : "Smooth! Butter landing.", 1000 - Math.abs(s.ox) * 18 - Math.abs(pos - 300) / 2 - Math.max(0, sink - 1.5) * 120); } }
    else if (s.d < -L.len) end("Floated the whole runway! Go-around.", 0);
    const c = get(); if (c) draw(c.x, c.w, c.h, s, L); if (s.t - tu.current > .25) { tu.current = s.t; setUi(u => u + 1); } }, run);
  const s = S.current; const dev = (s.h - Math.max(0, s.d) * GS); const sum = tot.reduce((a, b) => a + b, 0);
  const pd = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); inp.current = { x: 0, y: 0, ax: e.clientX, ay: e.clientY, on: true }; };
  const pm = (e: React.PointerEvent) => { const I = inp.current; if (!I.on) return; I.x = clamp((e.clientX - I.ax) / 70, -1, 1); I.y = clamp(-(e.clientY - I.ay) / 70, -1, 1); };
  const pu = () => { inp.current.on = false; inp.current.x = 0; inp.current.y = 0; };
  return <div className="g4">
    {li >= 0 && <div className="g4-hud"><span>{L.n} ({li + 1}/{LV.length})</span><span>⛰ {Math.max(0, Math.round(s.h * 3.28))} ft</span><span>↕ {dev > 8 ? "high" : dev < -8 ? "LOW" : "on slope"}</span><span>↔ {Math.abs(s.ox) < 6 ? "centred" : Math.round(Math.abs(s.ox)) + " m " + (s.ox > 0 ? "right" : "left")}</span><span>Total {sum}</span></div>}
    {li >= 0 && <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "4/3" }} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={pu} />}
    {run ? <p className="g4-intro">Drag left/right to line up, up/down to climb or sink. PAPI: 2 white + 2 red = perfect. Pull up a little just before touchdown.</p>
      : li < 0 ? <><p className="g4-intro">Four famous-style tricky approaches, drawn as stylised game scenery. Land on all four for a total score{best != null ? ` (best ${best})` : ""}.</p><div className="g4-levels">{LV.map((l, i) => <button key={l.k} onClick={() => go(i, [])}><b>{i + 1}. {l.n}</b><small>{l.sub}</small></button>)}</div></>
      : <End big={s.pts} unit={`points · ${L.n}`} nb={nb} msg={s.done}>{li < LV.length - 1 ? <button className="gp-btn pri" onClick={() => go(li + 1, tot)}>Next: {LV[li + 1].n} ›</button> : <p><b>Total {sum}</b></p>}<button className="gp-btn" onClick={() => go(li, tot.slice(0, -1))}>Retry this one</button><button className="gp-btn" onClick={() => { setLi(-1); setTot([]); }}>All runways</button></End>}</div>;
}
function draw(x: CanvasRenderingContext2D, W: number, H: number, s: St, L: Lvl) {
  const f = W * 1.1, cx = W / 2; const hy = H * .36 - s.vy * 4; const roll = clamp(-s.vx * .012, -.35, .35);
  x.save(); x.translate(cx, H / 2); x.rotate(roll); x.translate(-cx, -H / 2);
  const sky = x.createLinearGradient(0, -H, 0, hy); sky.addColorStop(0, "#3b82c4"); sky.addColorStop(1, "#dbeafe"); x.fillStyle = sky; x.fillRect(-W, -H, W * 3, hy + H);
  x.fillStyle = L.sea ? "#1d5f8a" : "#5d8a4e"; x.fillRect(-W, hy, W * 3, H * 2);
  const P = (wx: number, z: number) => [cx + (wx - s.ox) / z * f, hy + Math.max(1, s.h + 3) / z * f] as const;
  // land around the runway
  const z0 = Math.max(4, s.d), z1 = Math.max(5, s.d + L.len);
  if (L.sea) { const zz = Math.max(4, s.d - (L.beach ? 160 : 40)); const a = P(-500, zz), b = P(500, zz), c2 = P(500, z1 + 800), d2 = P(-500, z1 + 800); x.fillStyle = L.beach ? "#e9d8a6" : "#6b8f5a"; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.lineTo(...c2); x.lineTo(...d2); x.fill();
    if (L.beach) { const g1 = P(-500, Math.max(4, s.d - 60)), g2 = P(500, Math.max(4, s.d - 60)); x.fillStyle = "#5d8a4e"; x.beginPath(); x.moveTo(...g1); x.lineTo(...g2); x.lineTo(...c2); x.lineTo(...d2); x.fill(); } }
  for (let k = 0; k < 14; k++) { const z = Math.max(4, s.d - 200 + k * 260 - ((-s.d) % 260)); const [, y] = P(0, z); x.fillStyle = "rgba(255,255,255,.05)"; x.fillRect(-W, y, W * 3, 1); }
  if (L.hills) for (const side of L.hills === 2 ? [-1, 1] : [-1]) { x.fillStyle = side < 0 ? "#3f5f3a" : "#4a6b40"; x.beginPath(); const zs = [300, 900, 1600, 2600, 3600]; x.moveTo(...P(side * 2500, Math.max(4, s.d + 4000))); for (const z of zs) { const zz = s.d + z - 2300; if (zz < 180) continue; const [px2, py2] = P(side * (220 + (z % 500)), zz); x.lineTo(px2, py2 - 260 / zz * f); } x.lineTo(...P(side * 2500, Math.max(180, s.d + 300))); x.fill(); }
  if (L.rock) { const z = Math.max(30, s.d + 600); const [rx, ry] = P(-420, z); x.fillStyle = "#8b8f94"; x.beginPath(); x.moveTo(rx - 2400 / z * f, ry); x.lineTo(rx - 300 / z * f, ry - 420 / z * f); x.lineTo(rx + 200 / z * f, ry - 380 / z * f); x.lineTo(rx + 500 / z * f, ry); x.fill(); x.fillStyle = "#6d7176"; x.beginPath(); x.moveTo(rx - 300 / z * f, ry - 420 / z * f); x.lineTo(rx + 200 / z * f, ry - 380 / z * f); x.lineTo(rx, ry); x.fill(); }
  // runway
  const a = P(-22, z0), b = P(22, z0), c = P(22, z1), d = P(-22, z1); x.fillStyle = "#2b2f36"; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.lineTo(...c); x.lineTo(...d); x.fill();
  x.fillStyle = "#f1f5f9"; for (let k = 0; k < L.len; k += 60) { const za = Math.max(4, s.d + k + 10), zb = Math.max(4, s.d + k + 40); if (s.d + k + 40 < 4) continue; const p1 = P(-.5, za), p2 = P(.5, za), p3 = P(.5, zb), p4 = P(-.5, zb); x.beginPath(); x.moveTo(...p1); x.lineTo(...p2); x.lineTo(...p3); x.lineTo(...p4); x.fill(); }
  for (let k = -18; k <= 18; k += 4.5) { if (s.d + 30 < 4) break; const p1 = P(k - 1.2, Math.max(4, s.d + 6)), p2 = P(k + 1.2, Math.max(4, s.d + 6)), p3 = P(k + 1.2, Math.max(4, s.d + 40)), p4 = P(k - 1.2, Math.max(4, s.d + 40)); x.beginPath(); x.moveTo(...p1); x.lineTo(...p2); x.lineTo(...p3); x.lineTo(...p4); x.fill(); }
  if (L.road) { const zr = s.d + L.len * .5; if (zr > 4) { const r1 = P(-600, zr), r2 = P(600, zr), r3 = P(600, zr + 14), r4 = P(-600, zr + 14); x.fillStyle = "#4b5563"; x.beginPath(); x.moveTo(...r1); x.lineTo(...r2); x.lineTo(...r3); x.lineTo(...r4); x.fill(); const [lx, ly] = P(30, zr); x.fillStyle = "#ef4444"; x.beginPath(); x.arc(lx, ly - 3, Math.max(1.5, 30 / zr * 8), 0, 7); x.fill(); } }
  // PAPI (left of the touchdown zone)
  const zp = s.d + 300; if (zp > 8) { const ang = Math.atan2(s.h, zp) * 180 / Math.PI; const th = [2.5, 2.83, 3.17, 3.5]; th.forEach((t, k) => { const [px2, py2] = P(-40 - k * 9, zp); x.fillStyle = ang > t ? "#ffffff" : "#ef4444"; x.beginPath(); x.arc(px2, py2, Math.max(1.6, 260 / zp), 0, 7); x.fill(); }); }
  x.restore();
  // cockpit frame + flight path marker
  x.strokeStyle = "rgba(34,197,94,.9)"; x.lineWidth = 2; const fpx = cx + s.vx * 6, fpy = H * .36 + 0 - (s.vy + V * GS) * 6; x.beginPath(); x.arc(fpx, fpy, 7, 0, 7); x.moveTo(fpx - 16, fpy); x.lineTo(fpx - 7, fpy); x.moveTo(fpx + 7, fpy); x.lineTo(fpx + 16, fpy); x.moveTo(fpx, fpy - 7); x.lineTo(fpx, fpy - 12); x.stroke();
  x.fillStyle = "#0b1020"; x.fillRect(0, H - 26, W, 26); x.fillStyle = "#e2e8f0"; x.font = "700 12px system-ui"; x.fillText(`${Math.max(0, Math.round(s.d))} m to go · wind gust ${s.g > 0 ? "→" : "←"} ${Math.abs(s.g).toFixed(0)}`, 10, H - 9);
}
