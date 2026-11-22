// Pushback Driver: steer the tug at the nose wheel and push the plane off the stand onto the taxi line without clipping a wingtip.
// The plane pivots around its main gear, so steering works "backwards", like reversing a trailer.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, Hold, End, sfx, clamp, drawPlane } from "./kit";

type Rect = [number, number, number, number]; // x, y, w, h (metres)
type Lv = { n: string; sub: string; start: [number, number, number]; goal: [number, number, number]; obs: Rect[]; planes: [number, number, number][] };
const LVS: Lv[] = [
  { n: "Stand 1: wide open", sub: "Push back and turn left onto the taxi line.", start: [60, 30, -Math.PI / 2], goal: [38, 62, 0], obs: [[0, 0, 120, 6]], planes: [] },
  { n: "Stand 7: neighbours", sub: "Planes on both sides. Watch your wingtips!", start: [60, 30, -Math.PI / 2], goal: [84, 62, Math.PI], obs: [[0, 0, 120, 6], [48, 6, 4, 8]], planes: [[24, 26, -Math.PI / 2], [96, 26, -Math.PI / 2]] },
  { n: "Stand 12: tight corner", sub: "A blast fence behind you and a parked tug. Push straight, then swing.", start: [60, 30, -Math.PI / 2], goal: [34, 62, 0], obs: [[0, 0, 120, 6], [0, 78, 120, 4], [86, 40, 8, 6], [48, 6, 4, 8]], planes: [[27, 26, -Math.PI / 2], [93, 26, -Math.PI / 2]] },
];
const WB = 13, LEN = 38, SPAN = 25; // wheelbase, length, span (game sizes in metres)
type St = { x: number; y: number; th: number; phi: number; t: number; done?: string; pts?: number; hit?: boolean; ok?: number };
const pts = (s: { x: number; y: number; th: number }) => { const c = Math.cos(s.th), n = Math.sin(s.th); const P = (a: number, b: number): [number, number] => [s.x + a * c - b * n, s.y + a * n + b * c];
  return [P(WB + 6, 0), P(-LEN + WB + 6, 0), P(-8, SPAN / 2), P(-8, -SPAN / 2), P(-5, SPAN / 4), P(-5, -SPAN / 4), P(-LEN + WB + 8, 6), P(-LEN + WB + 8, -6), P(WB * .6, 2), P(WB * .6, -2)]; };
const inR = (p: [number, number], r: Rect) => p[0] > r[0] && p[0] < r[0] + r[2] && p[1] > r[1] && p[1] < r[1] + r[3];
export default function Pushback() {
  const [best, report] = useBest("pushback"); const [ref, get] = useCanvas(); const [li, setLi] = useState(-1); const L = LVS[Math.max(0, li)];
  const S = useRef<St>({ x: 0, y: 0, th: 0, phi: 0, t: 0 }); const ctl = useRef({ u: 0, st: 0 }); const [run, setRun] = useState(false); const [, setUi] = useState(0); const [nb, setNb] = useState(false); const tu = useRef(0); const [score, setScore] = useState<number[]>([]);
  const go = (i: number) => { setLi(i); const [x, y, th] = LVS[i].start; S.current = { x, y, th, phi: 0, t: 0 }; ctl.current = { u: 0, st: 0 }; setRun(true); sfx.tug(); };
  const end = (txt: string, p: number) => { const s = S.current; s.done = txt; s.pts = Math.max(0, Math.round(p)); setRun(false); const sc = [...score.slice(0, li), s.pts]; setScore(sc); if (li === LVS.length - 1) { const sum = sc.reduce((a, b) => a + b, 0); setNb(sum > 0 && report(sum)); } (p > 0 ? sfx.win : sfx.bad)(); setUi(u => u + 1); };
  useLoop(dt => { const s = S.current; if (s.done) return; const C = ctl.current; s.t += dt; s.phi = clamp(s.phi + C.st * 1.1 * dt, -1.1, 1.1);
    const u = C.u; if (u) { s.th += u * Math.sin(s.phi) / WB * dt; s.x += u * Math.cos(s.phi) * Math.cos(s.th) * dt; s.y += u * Math.cos(s.phi) * Math.sin(s.th) * dt; if (Math.random() < dt * 2) sfx.tug(); }
    const P = pts(s); const obs: Rect[] = [...L.obs, ...L.planes.flatMap(([px, py]) => [[px - 2, py - 19, 4, 38], [px - 12.5, py + 5, 25, 6]] as Rect[])];
    if (P.some(p => obs.some(r => inR(p, r)) || p[0] < 0 || p[0] > 120 || p[1] > 88)) { s.hit = true; end("Crunch! A wingtip or the tail hit something. The engineers are not happy.", 0); }
    const [gx, gy, gth] = L.goal; const dist = Math.hypot((s.x + Math.cos(s.th) * WB) - gx, (s.y + Math.sin(s.th) * WB) - gy); const dth = Math.abs(Math.atan2(Math.sin(s.th - gth), Math.cos(s.th - gth)));
    s.ok = dist < 3 && dth < .18 ? 1 : 0; if (s.ok && !u) end(`Parked on the line in ${s.t.toFixed(1)} s. Tow bar off, thumbs up to the pilots!`, 1000 - s.t * 8 - dist * 40 - dth * 400);
    if (s.t > 120) end("Time's up: the slot was lost.", 0);
    const c = get(); if (c) draw(c.x, c.w, c.h, s, L); if (s.t - tu.current > .2) { tu.current = s.t; setUi(v => v + 1); } }, run);
  const s = S.current; const tot = score.reduce((a, b) => a + b, 0);
  return <div className="g4">
    {li >= 0 && <div className="g4-hud"><span>{L.n}</span><span>⏱ {s.t.toFixed(1)} s</span><span>Steer {Math.round(s.phi * 57)}°</span>{s.ok ? <span style={{ background: "#14532d" }}>On the mark: let go!</span> : null}<span>Total {tot}{best != null ? ` · best ${best}` : ""}</span></div>}
    {li >= 0 && <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "4/3" }} />}
    {run ? <><div className="g4-ctl"><Hold label="Steer left" on={d => (ctl.current.st = d ? -1 : 0)}>⟲</Hold><Hold label="Push back" cls="pri" on={d => (ctl.current.u = d ? -3.2 : 0)}>⬇ Push</Hold><Hold label="Pull forward" on={d => (ctl.current.u = d ? 2 : 0)}>⬆ Pull</Hold><Hold label="Steer right" on={d => (ctl.current.st = d ? 1 : 0)}>⟳</Hold></div>
      <p className="g4-intro">Hold Push to move. The tug steers the nose wheel, so the tail swings the opposite way. Stop with the nose on the yellow T, lined up with the arrow.</p></>
      : li < 0 ? <div className="g4-levels">{LVS.map((l, i) => <button key={i} onClick={() => go(i)}><b>{l.n}</b><small>{l.sub}</small>{score[i] != null && <em>{score[i]} pts</em>}</button>)}</div>
      : <End big={s.pts} unit="points" nb={nb} msg={s.done}>{li < LVS.length - 1 && !s.hit && <button className="gp-btn pri" onClick={() => go(li + 1)}>Next stand ›</button>}<button className="gp-btn" onClick={() => go(li)}>Try again</button><button className="gp-btn" onClick={() => setLi(-1)}>All stands</button></End>}</div>;
}
function draw(x: CanvasRenderingContext2D, W: number, H: number, s: St, L: Lv) {
  const k = W / 120; x.fillStyle = "#4b5160"; x.fillRect(0, 0, W, H); x.save(); x.scale(k, k);
  x.fillStyle = "#8e9aab"; x.fillRect(0, 0, 120, 6); x.fillStyle = "#5b6170"; for (const px of [24, 60, 96]) { x.strokeStyle = "#f5c400"; x.lineWidth = .4; x.beginPath(); x.moveTo(px, 6); x.lineTo(px, 46); x.stroke(); }
  x.strokeStyle = "#f5c400"; x.lineWidth = .6; x.beginPath(); x.moveTo(0, 62); x.lineTo(120, 62); x.stroke(); x.beginPath(); for (const px of [24, 60, 96]) { x.moveTo(px, 46); x.quadraticCurveTo(px, 62, px + (L.goal[2] === 0 ? -16 : 16), 62); } x.stroke();
  const [gx, gy, gth] = L.goal; x.fillStyle = "#facc15"; x.fillRect(gx - .5, gy - 3, 1, 6); x.fillRect(gx - (gth === 0 ? -1 : 1) * .5 - .5, gy - .5, 3, 1); x.font = "4px system-ui"; x.fillText(gth === 0 ? "→" : "←", gx - 2, gy - 4);
  for (const r of L.obs) { x.fillStyle = r[1] === 0 ? "#94a3b8" : r[3] <= 6 && r[2] <= 8 ? "#f59e0b" : "#334155"; x.fillRect(...r); }
  for (const [px, py, th] of L.planes) drawPlane(x, px, py, 19, th, "#e2e8f0", "#64748b");
  drawPlane(x, s.x, s.y, 19, s.th, s.hit ? "#fecaca" : "#ffffff", "#0ea5e9");
  const nx = s.x + Math.cos(s.th) * WB, ny = s.y + Math.sin(s.th) * WB; const ta = s.th + s.phi; x.save(); x.translate(nx + Math.cos(ta) * 3.5, ny + Math.sin(ta) * 3.5); x.rotate(ta); x.fillStyle = "#facc15"; x.fillRect(-2, -1.4, 4, 2.8); x.fillStyle = "#111"; x.fillRect(.6, -1, 1, 2); x.restore();
  x.strokeStyle = "#facc15"; x.lineWidth = .3; x.beginPath(); x.moveTo(nx, ny); x.lineTo(nx + Math.cos(ta) * 2, ny + Math.sin(ta) * 2); x.stroke();
  x.restore(); x.fillStyle = "rgba(255,255,255,.5)"; x.font = "11px system-ui"; x.fillText("Terminal", 6, 12);
}
