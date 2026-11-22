// Bird Strike Panic: both engines quit after a bird strike. Trade height for distance and glide back to the runway.
// A simple made-up glide model (speed sets the glide ratio; gear and flaps add drag). Game physics, not a real aircraft.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, Hold, End, sfx, clamp, drawPlane } from "./kit";

type St = { v: number; h: number; x: number; gear: boolean; flaps: number; t: number; wind: number; birds: number; done?: string; score?: number };
const STALL = (f: number) => 125 - f * 12;
const GR = (s: St) => s.v < STALL(s.flaps) ? 3 : Math.max(3, 16 - Math.abs(s.v - 205) / 10 - (s.gear ? 4 : 0) - s.flaps * 2.5);
const RWY = 7000;
function fresh(): St { const h = 2600 + Math.random() * 900; return { v: 230, h, x: h * (12.5 + Math.random() * 2), gear: false, flaps: 0, t: 0, wind: Math.round(Math.random() * 15), birds: 2.2 }; }
export default function BirdGlide() {
  const [best, report] = useBest("glide"); const [ref, get] = useCanvas(); const S = useRef<St>(fresh()); const p = useRef(0); const [ui, setUi] = useState(0); const [run, setRun] = useState(false); const [nb, setNb] = useState(false); const lastUi = useRef(0);
  const start = () => { S.current = fresh(); setRun(true); setNb(false); sfx.bad(); setTimeout(() => sfx.alert(), 600); };
  const finish = (txt: string, score: number) => { const s = S.current; s.done = txt; s.score = Math.max(0, Math.round(score)); setRun(false); setNb(s.score > 0 && report(s.score)); (score > 400 ? sfx.win : sfx.bad)(); setUi(u => u + 1); };
  useLoop(dt => { const s = S.current; if (s.done) return; const T = dt * 4; s.t += dt; if (s.birds > 0) s.birds -= dt;
    const gs = Math.max(40, s.v - s.wind) * 1.688; const g = GR(s);
    s.v = clamp(s.v + (-p.current * 3.2 - (s.gear ? .5 : 0) - s.flaps * .45 + (p.current === 0 ? (s.v < 200 ? .25 : -.15) : 0)) * T, 95, 300);
    s.h -= gs / g * T; s.x -= gs * T;
    if (s.h <= 0) { s.h = 0; const onRwy = s.x <= 0 && s.x >= -RWY + 1500; const sink = gs / g;
      if (s.x > 0) finish(s.x < 3000 ? "Landed in the grass just short. Everyone walks away, but the plane is bent." : "Landed in a field " + (s.x / 6076).toFixed(1) + " nm short. Safe, but not the runway.", 300 - s.x / 30);
      else if (!onRwy) finish("Too long: ran off the end of the runway into the safety area.", 250);
      else if (!s.gear) finish("Belly landing on the runway! Everyone is safe, but sparks everywhere.", 400 - Math.abs(s.x + 1000) / 10);
      else if (s.v > 185 || sink > 30) finish("Hard, fast landing… the tyres didn't enjoy that. Safe on the runway.", 650 - Math.abs(s.x + 1000) / 8 - Math.max(0, s.v - 150) * 4);
      else finish(Math.abs(s.x + 1000) < 800 ? "Greaser! Right on the touchdown zone. The cabin claps." : "Safe on the runway. Nice gliding, captain!", 1000 - Math.abs(s.x + 1000) / 6 - Math.max(0, s.v - 140) * 5 + s.flaps * 40); }
    const c = get(); if (c) draw(c.x, c.w, c.h, s, g, gs);
    if (s.t - lastUi.current > .2) { lastUi.current = s.t; setUi(u => u + 1); } }, run);
  const s = S.current; const g = GR(s); const reach = s.x - s.h * g; const stall = s.v < STALL(s.flaps) + 8;
  const hint = reach > 0 ? `You'll land ${(reach / 6076).toFixed(1)} nm short: lower the nose less, keep ~205 kt clean` : reach < -RWY + 1500 ? "You'll fly past the runway: add flaps/gear or slow down" : "On track for the runway ✓";
  return <div className="g4">
    <div className="g4-hud"><span>⚡ {Math.round(s.v)} kt</span><span>⛰ {Math.round(s.h)} ft</span><span>📏 {(Math.max(0, s.x) / 6076).toFixed(1)} nm</span><span>Glide 1:{g.toFixed(0)}</span>{stall && run && <span className="warn">STALL!</span>}{best != null && <span>Best {best}</span>}</div>
    <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "16/10" }} onPointerDown={e => { const r = (e.target as HTMLElement).getBoundingClientRect(); p.current = e.clientY < r.top + r.height / 2 ? 1 : -1; }} onPointerUp={() => (p.current = 0)} onPointerLeave={() => (p.current = 0)} />
    {run ? <><p className="g4-intro">{hint}</p><div className="g4-ctl"><Hold label="Nose up" on={d => (p.current = d ? 1 : 0)}>▲<small style={{ fontSize: 10, display: "block" }}>nose up</small></Hold><Hold label="Nose down" on={d => (p.current = d ? -1 : 0)}>▼<small style={{ fontSize: 10, display: "block" }}>nose down</small></Hold>
      <button className={"g4-tg" + (s.gear ? " on" : "")} onClick={() => { s.gear = !s.gear; sfx.build(); setUi(ui + 1); }}>⚙ Gear {s.gear ? "down" : "up"}</button><button className={"g4-tg" + (s.flaps ? " on" : "")} onClick={() => { s.flaps = (s.flaps + 1) % 3; sfx.click(); setUi(ui + 1); }}>Flaps {s.flaps}</button></div></>
      : <End big={s.done ? s.score : undefined} unit={s.done ? "points" : undefined} nb={nb} msg={s.done || "Birds hit both engines just after take-off. No thrust! Hold the nose to keep about 205 kt (best glide), watch the green line, then drop the gear and flaps late so you touch down near the start of the runway. Headwind today: random."}><button className="gp-btn pri" onClick={start}>{s.done ? "Fly again" : "Take off"}</button></End>}</div>;
}
function draw(x: CanvasRenderingContext2D, W: number, H: number, s: St, g: number, gs: number) {
  const gy = H * .84; const vs = Math.max(700, s.h * 1.5) / (gy - 20); const hs = vs * 7; const px = W * .22; const py = gy - s.h / vs; const X = (ft: number) => px + (s.x - ft) / hs; // ft = distance to threshold
  const sky = x.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, "#4f8fd6"); sky.addColorStop(1, "#cfe5f7"); x.fillStyle = sky; x.fillRect(0, 0, W, gy);
  for (let k = 0; k < 5; k++) { const cx = ((k * 157 - s.x / hs * .3) % (W + 120) + W + 120) % (W + 120) - 60; x.fillStyle = "rgba(255,255,255,.8)"; x.beginPath(); x.ellipse(cx, 30 + k * 17, 34, 10, 0, 0, 7); x.ellipse(cx + 20, 26 + k * 17, 22, 9, 0, 0, 7); x.fill(); }
  x.fillStyle = "#4e8c4f"; x.fillRect(0, gy, W, H - gy); x.fillStyle = "#3f7a40"; for (let k = -2; k < 40; k++) { const fx = X(k * 4000 + 2000); if (fx > -80 && fx < W + 80) x.fillRect(fx, gy + 6, 60, 8); }
  for (let k = 0; k < 30; k++) { const tx = X(k * 2600 + 9000 + (k % 3) * 400); if (tx > -10 && tx < W + 10 && (k % 4)) { x.fillStyle = "#2f6b3c"; x.beginPath(); x.moveTo(tx, gy - 12); x.lineTo(tx - 5, gy); x.lineTo(tx + 5, gy); x.fill(); } }
  const r0 = X(0), r1 = X(-RWY); x.fillStyle = "#2a2e35"; x.fillRect(r0, gy - 2, r1 - r0, 7); x.fillStyle = "#fff"; for (let k = 0; k < 10; k++) x.fillRect(r0 + (r1 - r0) * (k + .3) / 10, gy + 1, (r1 - r0) / 30, 1.5);
  x.fillStyle = "rgba(34,197,94,.55)"; x.fillRect(X(0), gy + 6, X(-2000) - X(0), 3);
  const land = s.x - s.h * g; const ok = land <= 0 && land >= -RWY + 1500; x.setLineDash([5, 5]); x.strokeStyle = ok ? "#22c55e" : "#ef4444"; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(X(land), gy); x.stroke(); x.setLineDash([]);
  if (s.birds > 0) { x.fillStyle = "#111"; for (let k = 0; k < 9; k++) { const bx = px + 40 - (2.2 - s.birds) * 60 + k * 9, by = py - 14 + Math.sin(k * 2 + s.t * 20) * 6; x.fillText("ᐯ", bx, by); } }
  const pitch = s.v < STALL(s.flaps) ? -.15 : Math.atan(1 / g) * 1.5; void gs; drawPlane(x, px, py, 22, pitch, "#f4f6fa", "#dc2626");
  if (s.t < 6) { x.fillStyle = `rgba(80,80,80,${.5 - s.t / 12})`; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(px - 12 - k * 9, py + 3 - k * 1.5, 3 + k, 0, 7); x.fill(); } }
  if (s.gear) { x.fillStyle = "#111"; x.fillRect(px - 3, py + 4, 2, 4); x.fillRect(px + 8, py + 4, 2, 4); }
  x.fillStyle = "rgba(2,6,23,.55)"; x.fillRect(8, 8, 104, 22); x.fillStyle = "#fff"; x.font = "700 12px system-ui"; x.fillText(s.t < 3 ? "⚠ ENGINES OUT" : "Gliding…", 14, 23);
}
