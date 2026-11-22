// Pilot Approach: fly the last few miles into a stylised Manchester-style or Katowice-style runway (simple game scenery and a
// made-up flight model; not real charts or a real aircraft). Glideslope + localiser needles, PAPI lights, wind, flare, scoring.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, Hold, End, sfx } from "./kit";
import { APTS, VREF, AIM, fresh, step, gsDev, locDev, papi, stallV, goAround, type St, type Apt } from "./approachsim";

const TS = 1.3; type Pt = { x: number; y: number; z: number };
export default function PilotApproach() {
  const [best, report] = useBest("approach"); const [ref, get] = useCanvas(); const [ai, setAi] = useState(-1); const S = useRef<St | null>(null); const inp = useRef({ p: 0, r: 0, dp: 0, dr: 0, drag: null as null | { x: number; y: number } }); const [run, setRun] = useState(false); const [, setUi] = useState(0); const [nb, setNb] = useState(false); const call = useRef({ txt: "", t: 0 }); const ut = useRef(0); const warned = useRef<Record<string, 1>>({});
  const fx = useRef<{ x: number; y: number; v: number }[]>([]);
  const A = APTS[Math.max(0, ai)];
  const start = (i: number) => { setAi(i); S.current = fresh(APTS[i]); warned.current = {}; call.current = { txt: "", t: 0 }; setRun(true); setNb(false); sfx.chime(); };
  const done = (s: St) => { setRun(false); setNb((s.score || 0) > 0 && report(s.score || 0)); ((s.score || 0) > 700 ? sfx.win : (s.score || 0) > 300 ? sfx.land : sfx.bad)(); };
  useLoop(dt => { const s = S.current; if (!s || s.done) return; const I = inp.current; const c = step(s, A, I.p + I.dp, I.r + I.dr, dt * TS);
    if (c) { call.current = { txt: c, t: 1.2 }; c === "Minimums" ? sfx.chime() : sfx.click(); } call.current.t -= dt;
    if (!s.gear && s.h < 900 && !warned.current.gear) { warned.current.gear = 1; sfx.alert(); }
    if (s.v < stallV(s) + 4 && !warned.current.st) { warned.current.st = 1; sfx.alert(); setTimeout(() => (warned.current.st = undefined as never), 3000); }
    const g = get(); if (g) draw(g.x, g.w, g.h, s, A, call.current, fx.current, dt);
    ut.current += dt; if (ut.current > .15) { ut.current = 0; setUi(u => u + 1); } if (s.done) { if (s.parts?.length && s.h === 0) sfx.land(); done(s); } }, run);
  const s = S.current;
  if (ai < 0 || !s) return <div className="g4"><p className="g4-intro">You're the pilot on final approach. Get the <b>gear down</b> and <b>full flaps</b>, hold <b>{VREF} kt</b>, keep the diamonds centred (or 2 white + 2 red PAPI lights), steer into the crosswind, then <b>flare</b> (nose up a little) at about 30 ft and pull the thrust to idle.</p>
    <div className="g4-levels">{APTS.map((a, i) => <button key={a.k} onClick={() => start(i)}><b>{a.night ? "🌙" : a.snow ? "❄️" : "🌦️"} {a.n}</b><small>{a.sub}</small><em>Wind: {a.wind.h} kt headwind, {Math.abs(a.wind.c)} kt from the {a.wind.c > 0 ? "left" : "right"}, gusts ±{a.wind.g}</em></button>)}</div>
    {best != null && <p className="faint xs">Best landing: {best} points</p>}<p className="faint xs">Fan-made, stylised scenery inspired by the two airports: not real charts or procedures.</p></div>;
  if (s.done && !run) return <div className="g4"><End big={s.score} unit="points" nb={nb} msg={s.done}>
    {s.vs != null && <p className="sm">Touchdown: <b>{s.vs} ft/min</b> · {s.tdz != null && s.tdz > 0 ? `${s.tdz} ft past the threshold` : ""}</p>}
    {!!s.parts?.length && <ul className="g4-log ap-parts">{s.parts.map(([k, v]) => <li key={k} className={v > 0 ? "ok" : "bad"}><span>{k}</span><b>{v}</b></li>)}</ul>}
    <div className="g4-ctl"><button className="gp-btn pri" onClick={() => start(ai)}>Fly again</button><button className="gp-btn" onClick={() => { setAi(-1); S.current = null; }}>Airports</button></div></End></div>;
  const ptr = (e: React.PointerEvent) => { const d = inp.current.drag; if (!d) return; inp.current.dp = Math.max(-1, Math.min(1, -(e.clientY - d.y) / 70)); inp.current.dr = Math.max(-1, Math.min(1, (e.clientX - d.x) / 70)); };
  const rel = () => { inp.current.drag = null; inp.current.dp = 0; inp.current.dr = 0; };
  return <div className="g4 ap">
    <div className="g4-hud"><span>{A.rw}</span><span>⚡ {Math.round(s.v)} kt</span><span>📡 {Math.round(s.h)} ft</span><span>📏 {(Math.max(0, s.d) / 6076).toFixed(1)} nm</span>{!s.gear && s.h < 1000 && <span className="warn">GEAR!</span>}{s.v < stallV(s) + 4 && <span className="warn">STALL</span>}</div>
    <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "4/3.4" }} onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); inp.current.drag = { x: e.clientX, y: e.clientY }; }} onPointerMove={ptr} onPointerUp={rel} onPointerCancel={rel} aria-label="Cockpit view: drag up/down to pitch, left/right to steer" />
    <div className="g4-ctl"><Hold label="Steer left" on={d => (inp.current.r = d ? -1 : 0)}>◀</Hold><Hold label="Nose up" on={d => (inp.current.p = d ? 1 : 0)}>▲<small className="ap-s">nose up</small></Hold><Hold label="Nose down" on={d => (inp.current.p = d ? -1 : 0)}>▼<small className="ap-s">nose down</small></Hold><Hold label="Steer right" on={d => (inp.current.r = d ? 1 : 0)}>▶</Hold></div>
    <div className="ap-thr"><button aria-label="Less thrust" onClick={() => { s.cmd = Math.max(0, +(s.cmd - .05).toFixed(2)); sfx.click(); }}>−</button><div><i style={{ width: s.thr * 100 + "%" }} /><b style={{ left: s.cmd * 100 + "%" }} /><span>Thrust {Math.round(s.cmd * 100)}%</span></div><button aria-label="More thrust" onClick={() => { s.cmd = Math.min(1, +(s.cmd + .05).toFixed(2)); sfx.click(); }}>＋</button><button onClick={() => { s.cmd = 0; sfx.click(); }}>Idle</button></div>
    <div className="g4-ctl"><button className={"g4-tg" + (s.gear ? " on" : "")} onClick={() => { s.gear = !s.gear; sfx.build(); }}>⚙ Gear {s.gear ? "down" : "up"}</button><button className={"g4-tg" + (s.flaps === 3 ? " on" : "")} onClick={() => { s.flaps = s.flaps >= 3 ? 1 : s.flaps + 1; sfx.click(); }}>Flaps {s.flaps === 3 ? "FULL" : s.flaps}</button><button className="g4-tg" onClick={() => { goAround(s); sfx.whoosh(); }}>↺ Go around</button></div>
    <p className="faint xs">Tip: drag on the view to fly too. Wind {A.wind.h} kt on the nose, {Math.abs(A.wind.c)} kt from the {A.wind.c > 0 ? "left: point the nose a little left" : "right: point the nose a little right"}.</p></div>;
}

// ---------- drawing ----------
const FIELDS = new Map<string, { q: [number, number, number, number]; c: string; f?: boolean }[]>();
function fields(a: Apt) { let f = FIELDS.get(a.k); if (f) return f; f = []; let sd = a.k.length * 99 + 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const pal = a.snow ? ["#e8eef4", "#dfe7ef", "#f1f5f9", "#d6dee8"] : a.style === "man" ? ["#5c8a3c", "#6b9a45", "#7ba656", "#8a9a4a", "#4f7d36"] : ["#5f8f45", "#6e9d50", "#7b8f4a"];
  for (let i = -9; i <= 9; i++) for (let j = -12; j <= 7; j++) { const x0 = i * 2600, z0 = j * 3200; const forest = a.style === "ktw" ? r() < .38 : r() < .08; if (Math.abs(x0 + 1300) < 1400 && z0 > -16000 && z0 < a.len + 2000) { f.push({ q: [x0, z0, x0 + 2600, z0 + 3200], c: a.snow ? "#e2e8f0" : "#6b9a45" }); continue; } f.push({ q: [x0 + 30, z0 + 30, x0 + 2570, z0 + 3170], c: forest ? (a.snow ? "#3d5a45" : "#2f5a2e") : pal[Math.floor(r() * pal.length)], f: forest }); }
  FIELDS.set(a.k, f); return f; }
function draw(x: CanvasRenderingContext2D, W: number, H: number, s: St, a: Apt, call: { txt: string; t: number }, fx: { x: number; y: number; v: number }[], dt: number) {
  const rad = Math.PI / 180; const ps = s.psi * rad, th = (s.gam + 2.2 + (VREF - s.v) * .05) * rad, eh = s.h + 12; const f = W * 2.1, y0 = H * .36; const N = 3; const night = !!a.night;
  const cs = Math.cos(ps), sn = Math.sin(ps), ct = Math.cos(th), st = Math.sin(th);
  const cam = (gx: number, gz: number, gy = 0): Pt => { const rx = gx - s.y, rz = gz + s.d, ry = gy - eh; const cx = rx * cs - rz * sn, cz = rx * sn + rz * cs; return { x: cx, y: ry * ct - cz * st, z: ry * st + cz * ct }; };
  const P = (p: Pt) => [W / 2 + f * p.x / p.z, y0 - f * p.y / p.z] as const;
  const poly = (pts: [number, number, number?][], fill: string) => { const c = pts.map(p => cam(p[0], p[1], p[2] || 0)); const out: Pt[] = []; for (let i = 0; i < c.length; i++) { const A1 = c[i], B = c[(i + 1) % c.length]; const ia = A1.z > N, ib = B.z > N; if (ia) out.push(A1); if (ia !== ib) { const t = (N - A1.z) / (B.z - A1.z); out.push({ x: A1.x + (B.x - A1.x) * t, y: A1.y + (B.y - A1.y) * t, z: N }); } } if (out.length < 3) return; x.beginPath(); out.forEach((p, i) => { const [sx, sy] = P(p); i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); }); x.fillStyle = fill; x.fill(); };
  const light = (gx: number, gz: number, col: string, sz = 1, gy = 0) => { const p = cam(gx, gz, gy); if (p.z < 20) return; const [sx, sy] = P(p); const r = Math.max(1, Math.min(5, 900 * sz / p.z)); if (night) { x.fillStyle = col; x.globalAlpha = .25; x.beginPath(); x.arc(sx, sy, r * 2.6, 0, 7); x.fill(); x.globalAlpha = 1; } x.fillStyle = col; x.beginPath(); x.arc(sx, sy, r, 0, 7); x.fill(); };
  x.save(); x.translate(W / 2, y0); x.rotate(-s.bank * rad * .9); x.translate(-W / 2, -y0);
  const hy = y0 + f * Math.tan(th); const sky = x.createLinearGradient(0, hy - H, 0, hy);
  if (night) { sky.addColorStop(0, "#020617"); sky.addColorStop(1, "#1e293b"); } else if (a.snow) { sky.addColorStop(0, "#94a3b8"); sky.addColorStop(1, "#e2e8f0"); } else { sky.addColorStop(0, "#5b7fa6"); sky.addColorStop(1, "#c3d3e2"); }
  x.fillStyle = sky; x.fillRect(-W, hy - H * 2, W * 3, H * 2 + 2);
  // horizon silhouette (stylised hills / treeline), shifts with heading
  const off = -s.psi * rad * f; x.fillStyle = night ? "#0b1220" : a.style === "man" ? (a.snow ? "#9aa7b4" : "#7d8a8f") : "#55705a";
  x.beginPath(); x.moveTo(-W, hy + 1); for (let k = -W; k <= W * 2; k += 6) { const u = (k - off) / W; const hh = a.style === "man" ? Math.max(0, 14 * Math.sin(u * 3.1 + 1) + 9 * Math.sin(u * 7.3) + 8) * (u > .3 ? 1.4 : .6) : 5 + 3 * Math.abs(Math.sin(u * 47)) + 2 * Math.sin(u * 9); x.lineTo(k, hy - hh); } x.lineTo(W * 2, hy + 1); x.fill();
  x.fillStyle = night ? "#05080f" : a.snow ? "#e5ebf1" : "#5b8a3e"; x.fillRect(-W, hy, W * 3, H * 2);
  if (!night) for (const fl of fields(a)) { const [x0, z0, x1, z1] = fl.q; if (z1 + s.d < 0) continue; poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], fl.c); }
  else { for (const fl of fields(a)) { if (!fl.f && (fl.q[0] * 7 + fl.q[1]) % 5 === 0) { const [x0, z0] = fl.q; for (let k = 0; k < 4; k++) light(x0 + 300 + k * 500, z0 + 400 + (k % 2) * 900, "#fbbf24", .35); } } }
  // haze
  if (!night) { const hz = x.createLinearGradient(0, hy - 4, 0, hy + 40); hz.addColorStop(0, a.snow ? "rgba(226,232,240,.9)" : "rgba(195,211,226,.85)"); hz.addColorStop(1, "rgba(195,211,226,0)"); x.fillStyle = hz; x.fillRect(-W, hy - 4, W * 3, 44); }
  // runways
  const rw = (dx: number, z0: number, len: number, wid: number) => { poly([[dx - wid / 2 - 25, z0 - 60], [dx + wid / 2 + 25, z0 - 60], [dx + wid / 2 + 25, z0 + len + 60], [dx - wid / 2 - 25, z0 + len + 60]], night ? "#0a0d14" : a.snow ? "#cbd5e1" : "#6b7a5a");
    poly([[dx - wid / 2, z0], [dx + wid / 2, z0], [dx + wid / 2, z0 + len], [dx - wid / 2, z0 + len]], night ? "#111318" : "#3b3f46");
    if (!night) { for (let k = 0; k < 8; k++) { const bx = dx - wid / 2 + 8 + k * (wid - 16) / 8 + (k >= 4 ? 8 : 0); poly([[bx, z0 + 20], [bx + (wid - 40) / 10, z0 + 20], [bx + (wid - 40) / 10, z0 + 170], [bx, z0 + 170]], "#f8fafc"); }
      for (let z = z0 + 400; z < z0 + len - 200; z += 400) poly([[dx - 2, z], [dx + 2, z], [dx + 2, z + 200], [dx - 2, z + 200]], "#f1f5f9");
      for (const sd2 of [-1, 1]) { poly([[dx + sd2 * wid * .28 - 12, z0 + AIM], [dx + sd2 * wid * .28 + 12, z0 + AIM], [dx + sd2 * wid * .28 + 12, z0 + AIM + 150], [dx + sd2 * wid * .28 - 12, z0 + AIM + 150]], "#f8fafc"); for (const tz of [500, 1500, 2000]) poly([[dx + sd2 * wid * .3 - 8, z0 + tz], [dx + sd2 * wid * .3 + 8, z0 + tz], [dx + sd2 * wid * .3 + 8, z0 + tz + 75], [dx + sd2 * wid * .3 - 8, z0 + tz + 75]], "#e2e8f0"); }
      poly([[dx - wid / 2 + 3, z0], [dx - wid / 2 + 6, z0], [dx - wid / 2 + 6, z0 + len], [dx - wid / 2 + 3, z0 + len]], "#e2e8f0"); poly([[dx + wid / 2 - 6, z0], [dx + wid / 2 - 3, z0], [dx + wid / 2 - 3, z0 + len], [dx + wid / 2 - 6, z0 + len]], "#e2e8f0"); } };
  if (a.style === "man") rw(-1280, 1500, 10000, 150); rw(0, 0, a.len, a.wid);
  // buildings (simple boxes): terminals, tower, hangar
  const box = (x0: number, z0: number, w: number, d: number, h: number, col: string, top: string) => { const faces: { p: [number, number, number][]; c: string; z: number }[] = [
    { p: [[x0, z0, 0], [x0 + w, z0, 0], [x0 + w, z0, h], [x0, z0, h]], c: col, z: 0 }, { p: [[x0, z0, 0], [x0, z0 + d, 0], [x0, z0 + d, h], [x0, z0, h]], c: col, z: 0 }, { p: [[x0 + w, z0, 0], [x0 + w, z0 + d, 0], [x0 + w, z0 + d, h], [x0 + w, z0, h]], c: col, z: 0 }, { p: [[x0, z0, h], [x0 + w, z0, h], [x0 + w, z0 + d, h], [x0, z0 + d, h]], c: top, z: 0 }];
    for (const F of faces) F.z = F.p.reduce((t, q) => t + cam(q[0], q[1], q[2]).z, 0); faces.sort((p, q) => q.z - p.z).forEach(F => poly(F.p, F.c)); };
  const dk = night ? "#111827" : "#94a3b8", tp = night ? "#1f2937" : "#cbd5e1";
  const blds: [number, number, number, number, number, string, string][] = a.style === "man" ? [[1100, 2600, 500, 1500, 55, dk, tp], [1150, 4600, 450, 1300, 55, night ? "#111827" : "#a1a1aa", tp], [900, 6600, 120, 120, 190, night ? "#1e293b" : "#e5e7eb", "#64748b"], [1300, 7600, 700, 500, 70, night ? "#111827" : "#78716c", tp]] : [[-1400, 3800, 450, 1200, 45, dk, tp], [-1000, 5600, 100, 100, 150, night ? "#1e293b" : "#e5e7eb", "#64748b"]];
  blds.sort((p, q) => cam(q[0], q[1]).z - cam(p[0], p[1]).z).forEach(b => { if (cam(b[0], b[1]).z > -b[3]) box(...b); });
  if (night) blds.forEach(b => { for (let k = 0; k < 6; k++) light(b[0] - 3, b[1] + 40 + k * b[3] / 6, "#fde68a", .3, b[4] * .5); });
  // lights: approach lights + edges + PAPI
  const flash = Math.floor(s.t * 4) % 15; for (let z = -2700; z < 0; z += 100) { light(0, z, "#fff7d6", .5); if (z === -1000) for (let k = -5; k <= 5; k++) light(k * 18, z, "#fff7d6", .45); if (night && (-z / 100) % 15 === 14 - flash) light(0, z, "#ffffff", 1.4, 4); }
  if (night || a.snow) { for (let z = 0; z <= a.len; z += 200) { light(-a.wid / 2, z, z > a.len - 2000 ? "#fcd34d" : "#f8fafc", .3); light(a.wid / 2, z, z > a.len - 2000 ? "#fcd34d" : "#f8fafc", .3); } for (let k = -6; k <= 6; k++) { light(k * a.wid / 12, 0, "#22c55e", .35); light(k * a.wid / 12, a.len, "#ef4444", .35); } }
  papi(s).forEach((w, i) => light(-a.wid / 2 - 60 - (3 - i) * 32, AIM, w ? "#ffffff" : "#ef4444", .8, 3));
  x.restore();
  // weather particles (screen space)
  if (a.rain || a.snow) { const n = a.snow ? 70 : 90; while (fx.length < n) fx.push({ x: Math.random() * W, y: Math.random() * H, v: .5 + Math.random() }); for (const p of fx) { if (a.snow) { p.y += (30 + p.v * 30) * dt; p.x += Math.sin(s.t * 2 + p.v * 9) * 12 * dt - s.psi * dt; x.fillStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(p.x, p.y, 1 + p.v, 0, 7); x.fill(); } else { p.y += 520 * p.v * dt; p.x -= 120 * dt; x.strokeStyle = night ? "rgba(148,163,184,.35)" : "rgba(226,232,240,.45)"; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - 4, p.y + 12); x.stroke(); } if (p.y > H) { p.y = -10; p.x = Math.random() * W * 1.2; } if (p.x < -10) p.x = W + 5; } }
  // HUD
  const hud = "#4ade80"; x.strokeStyle = hud; x.fillStyle = hud; x.lineWidth = 2; x.font = "800 13px ui-monospace,Menlo,monospace";
  x.beginPath(); x.moveTo(W / 2 - 34, y0); x.lineTo(W / 2 - 12, y0); x.lineTo(W / 2 - 6, y0 + 7); x.moveTo(W / 2 + 34, y0); x.lineTo(W / 2 + 12, y0); x.lineTo(W / 2 + 6, y0 + 7); x.stroke(); x.fillRect(W / 2 - 2, y0 - 2, 4, 4);
  // speed / altitude boxes
  const spdCol = s.v < stallV(s) + 4 || s.v > 165 ? "#f87171" : Math.abs(s.v - VREF) < 6 ? hud : "#fde047"; x.fillStyle = "rgba(2,6,23,.55)"; x.fillRect(6, y0 - 16, 62, 32); x.fillRect(W - 76, y0 - 16, 70, 32); x.fillStyle = spdCol; x.fillText(Math.round(s.v) + " kt", 12, y0 + 5); x.fillStyle = "#94a3b8"; x.font = "700 10px system-ui"; x.fillText("target " + VREF, 12, y0 + 28);
  x.fillStyle = hud; x.font = "800 13px ui-monospace,Menlo,monospace"; x.fillText(String(Math.round(s.h)).padStart(4, " ") + " ft", W - 72, y0 + 5); const vs = Math.round(s.v * 1.688 * Math.sin(s.gam * rad) * 60 / 10) * 10; x.font = "700 10px system-ui"; x.fillStyle = vs < -1100 ? "#f87171" : "#94a3b8"; x.fillText((vs > 0 ? "+" : "") + vs + " fpm", W - 72, y0 + 28);
  // glideslope (right) and localiser (bottom) scales: each dot = 0.35° / 0.5°
  const gsY = Math.max(-2.2, Math.min(2.2, gsDev(s) / .35)), lcX = Math.max(-2.2, Math.min(2.2, locDev(s, a) / .5)); const gx = W - 14, ly = H - 16;
  x.fillStyle = "rgba(2,6,23,.45)"; x.fillRect(gx - 8, y0 - 64, 16, 128); x.fillRect(W / 2 - 64, ly - 8, 128, 16); x.strokeStyle = "#e2e8f0"; x.lineWidth = 1.5;
  for (const k of [-2, -1, 1, 2]) { x.beginPath(); x.arc(gx, y0 + k * 26, 3, 0, 7); x.stroke(); x.beginPath(); x.arc(W / 2 + k * 26, ly, 3, 0, 7); x.stroke(); } x.fillStyle = "#e2e8f0"; x.fillRect(gx - 7, y0 - 1, 14, 2); x.fillRect(W / 2 - 1, ly - 7, 2, 14);
  const dia = (cx: number, cy: number) => { x.fillStyle = "#e879f9"; x.beginPath(); x.moveTo(cx, cy - 7); x.lineTo(cx + 6, cy); x.lineTo(cx, cy + 7); x.lineTo(cx - 6, cy); x.closePath(); x.fill(); };
  dia(gx, y0 + gsY * 26); dia(W / 2 - lcX * 26, ly);
  x.fillStyle = "#e2e8f0"; x.font = "700 9px system-ui"; x.fillText("G/S", gx - 8, y0 - 68); x.fillText("LOC", W / 2 - 72 - 14, ly + 3);
  if (call.t > 0) { x.globalAlpha = Math.min(1, call.t * 1.5); x.fillStyle = "#fde047"; x.font = "900 28px system-ui"; x.textAlign = "center"; x.fillText(call.txt === "Minimums" ? "MINIMUMS" : call.txt, W / 2, y0 - 50); x.textAlign = "left"; x.globalAlpha = 1; }
  if (!s.gear && s.h < 1000 && Math.floor(s.t * 3) % 2) { x.fillStyle = "#ef4444"; x.font = "900 18px system-ui"; x.textAlign = "center"; x.fillText("TOO LOW – GEAR", W / 2, y0 + 56); x.textAlign = "left"; }
  if (vs < -1300 && s.h < 1000) { x.fillStyle = "#f97316"; x.font = "900 16px system-ui"; x.textAlign = "center"; x.fillText("SINK RATE", W / 2, y0 + 78); x.textAlign = "left"; }
}
