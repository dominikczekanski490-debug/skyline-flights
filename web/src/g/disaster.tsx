// Disaster Day: run a Manchester-style airport (fan-made, stylised) through storms, strikes and snow, two hours at a time.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, End, sfx } from "./kit";
import { LEVELS, EVS, ORD, TURNS, LANES, newDay, cur, xwNow, pendingEvs, ordersCost, answer, play, score, grade, slotName, type S, type Res, type Orders, type Wx } from "./disastersim";

const WXN: Record<Wx, string> = { clear: "☀️ Clear", rain: "🌧️ Rain", storm: "⛈️ Thunderstorms", snow: "🌨️ Snow", blizzard: "❄️ Blizzard", fog: "🌫️ Fog" };
export default function DisasterDay() {
  const [best, report] = useBest("disaster"); const [ref, get] = useCanvas(); const S0 = useRef<S | null>(null); const [, setUi] = useState(0); const [msg, setMsg] = useState(""); const [last, setLast] = useState<Res | null>(null); const [nb, setNb] = useState(false);
  const anim = useRef({ t: 1, n: 0, plough: false, flash: 0, parts: [] as { x: number; y: number; v: number }[] }); const tm = useRef(0);
  const s = S0.current; const up = () => setUi(u => u + 1);
  useLoop(dt => { const g = S0.current; if (!g) return; tm.current += dt; const A = anim.current; if (A.t < 1) { A.t = Math.min(1, A.t + dt / 3.6); if (A.t >= 1) up(); } A.flash = Math.max(0, A.flash - dt * 3); const t = g.done ? LEVELS[g.lv].turns[TURNS - 1] : cur(g); if (t.wx === "storm" && Math.random() < dt * .35) { A.flash = 1; if (Math.random() < .5) sfx.tug(); }
    const c = get(); if (c) scene(c.x, c.w, c.h, g, A, tm.current, dt); }, !!s);
  if (!s) return <div className="g4"><p className="g4-intro">You're the duty manager at a Manchester-style airport on the worst day of the year. Every two hours, decide how to handle each problem, give orders, and keep flights moving <b>safely</b>. Safety always comes first!</p>
    <div className="g4-levels">{LEVELS.map((l, i) => <button key={l.k} onClick={() => { S0.current = newDay(i); setLast(null); setMsg(""); setNb(false); anim.current.t = 1; sfx.alert(); up(); }}><b>{l.e} {l.n}</b><small>{l.sub}</small><em>Budget £{(l.money / 1000).toFixed(0)}k · 8 slots, 06:00–22:00</em></button>)}</div>{best != null && <p className="faint xs">Best day: {best} points</p>}
    <p className="faint xs">A stylised, fan-made airport. All numbers are game numbers.</p></div>;
  const lv = LEVELS[s.lv]; const busy = anim.current.t < 1;
  if (s.done && !busy) { const sc = score(s); return <div className="g4"><canvas ref={ref} className="g4-cv" style={{ aspectRatio: "16/9" }} />
    <End big={grade(s)} unit={`${sc} points`} nb={nb} msg={<>{s.moved} flights moved · {s.cxl} cancelled · {s.div} diverted · {s.incidents ? `⚠️ ${s.incidents} safety incident${s.incidents > 1 ? "s" : ""}` : "✅ No safety incidents"} · mood {Math.round(s.mood)}% · £{Math.round(s.money / 1000)}k left</>}>
      <div className="g4-ctl"><button className="gp-btn pri" onClick={() => { S0.current = newDay(s.lv); setLast(null); up(); }}>Try again</button><button className="gp-btn" onClick={() => { S0.current = null; up(); }}>Warnings</button></div></End>
    <ul className="g4-log">{s.hist.map(h => <li key={h.turn} className={h.incident ? "bad" : h.cxl + h.div > 5 ? "info" : "ok"}>{slotName(h.turn)}: {h.landed}🛬 {h.departed}🛫{h.cxl ? ` ${h.cxl}❌` : ""}{h.div ? ` ${h.div}↪️` : ""}{h.incident ? " ⚠️" : ""}</li>)}</ul></div>; }
  const t = cur(s); const pend = pendingEvs(s); const oc = ordersCost(s.orders); const xw = xwNow(s);
  const go = () => { const r = play(s); if (typeof r === "string") { setMsg(r); sfx.bad(); return; } setMsg(""); setLast(r); anim.current = { ...anim.current, t: 0, n: r.landed + r.departed, plough: r.notes.some(n => n.startsWith("🚜")) }; (r.incident ? sfx.alert : sfx.whoosh)(); if (s.done) { const sc = score(s); setNb(sc > 0 && report(sc)); setTimeout(() => (grade(s).startsWith("A") ? sfx.win : sfx.level)(), 3700); } up(); };
  return <div className="g4 dd">
    <div className="g4-hud"><span>🕐 {slotName(s.turn)}</span><span>{WXN[t.wx]}</span><span>💷 £{Math.round(s.money / 1000)}k</span><span>✈️ {s.moved}</span>{s.incidents > 0 && <span className="warn">⚠️ {s.incidents}</span>}</div>
    <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "16/9" }} aria-label="The airport" />
    <div className="dd-stats"><span><small>Runway</small>{s.rw === "23" ? "23R" : "05L"} · {xw} kt X-wind</span><span><small>Snow on runway</small>{s.snow} cm</span><span><small>Security</small>{s.lanes}/{LANES} lanes</span><span><small>Waiting</small>{s.backDep}🛫 {s.holdArr}🛬</span><span className="dd-mood"><small>Passenger mood</small><i><b style={{ width: s.mood + "%", background: s.mood > 60 ? "#22c55e" : s.mood > 35 ? "#f59e0b" : "#ef4444" }} /></i></span></div>
    {busy ? <div className="g4-card"><b>Running {slotName(s.turn - 1)}…</b><div className="g4-bar"><i style={{ width: anim.current.t * 100 + "%" }} /></div></div> : <>
      {last && <div className="g4-card dd-res"><b>Last slot: {last.landed} landed · {last.departed} departed{last.div ? ` · ${last.div} diverted` : ""}{last.cxl ? ` · ${last.cxl} cancelled` : ""}</b>{last.incident && <p className="dd-inc">⚠️ {last.incident}</p>}<ul className="g4-log">{last.notes.map((n, i) => <li key={i} className="info">{n}</li>)}</ul></div>}
      {pend.map(e => { const E = EVS[e]; return <div key={e} className="g4-card dd-ev"><b>{E.e} {E.n}</b><p className="sm">{E.txt}</p><div className="dd-ch">{E.ch.map(c => <button key={c.k} disabled={s.money < c.cost} onClick={() => { const r = answer(s, e, c.k); if (r) { setMsg(r); sfx.bad(); } else { sfx.click(); setMsg(""); } up(); }}>{c.t}{c.cost ? <small>£{(c.cost / 1000).toFixed(c.cost % 1000 ? 1 : 0)}k</small> : null}</button>)}</div></div>; })}
      {!pend.length && <div className="g4-card"><b>Orders for {slotName(s.turn)}</b><div className="dd-ord">{(Object.keys(ORD) as (keyof Orders)[]).map(k => <button key={k} className={s.orders[k] ? "on" : ""} onClick={() => { s.orders[k] = !s.orders[k]; sfx.click(); up(); }}><span>{ORD[k].e}</span><b>{ORD[k].n}</b><small>{ORD[k].txt}{ORD[k].cost ? ` · £${ORD[k].cost / 1000}k` : ""}</small></button>)}</div>
        <button className="gp-btn pri dd-go" disabled={oc > s.money} onClick={go}>▶ Run {slotName(s.turn)}{oc ? ` (−£${oc / 1000}k)` : ""}</button></div>}
      {pend.length > 0 && <p className="faint xs">Decide on each problem to continue.</p>}</>}
    {msg && <p className="tb-err">{msg}</p>}
    <p className="faint xs">{lv.e} {lv.n} · slot {Math.min(TURNS, s.turn + 1)}/{TURNS}. Fan-made Manchester-style airport; game numbers only.</p></div>;
}
function scene(x: CanvasRenderingContext2D, W: number, H: number, s: S, A: { t: number; n: number; plough: boolean; flash: number; parts: { x: number; y: number; v: number }[] }, tm: number, dt: number) {
  const ti = Math.min(TURNS - 1, s.done ? TURNS - 1 : s.turn); const t = LEVELS[s.lv].turns[ti]; const hour = 6 + ti * 2 + (A.t < 1 ? A.t * 2 - 2 : 0); const night = hour >= 20 || hour < 6.5;
  const sky = x.createLinearGradient(0, 0, 0, H * .62); const dark = t.wx === "storm" || t.wx === "blizzard"; const grey = t.wx === "snow" || t.wx === "fog" || t.wx === "rain";
  if (night) { sky.addColorStop(0, "#020617"); sky.addColorStop(1, "#1e293b"); } else if (dark) { sky.addColorStop(0, "#1f2937"); sky.addColorStop(1, "#475569"); } else if (grey) { sky.addColorStop(0, "#64748b"); sky.addColorStop(1, "#cbd5e1"); } else if (hour < 8 || hour >= 18) { sky.addColorStop(0, "#3b5b8c"); sky.addColorStop(1, "#f9a87a"); } else { sky.addColorStop(0, "#3b82f6"); sky.addColorStop(1, "#bfdbfe"); }
  x.fillStyle = sky; x.fillRect(0, 0, W, H); if (A.flash > 0) { x.fillStyle = `rgba(255,255,255,${A.flash * .55})`; x.fillRect(0, 0, W, H); x.strokeStyle = `rgba(255,255,240,${A.flash})`; x.lineWidth = 2; x.beginPath(); let lx = W * (.2 + (Math.floor(tm * 7) % 5) * .15), ly = 0; x.moveTo(lx, ly); while (ly < H * .45) { lx += (Math.random() - .5) * 30; ly += 12 + Math.random() * 10; x.lineTo(lx, ly); } x.stroke(); }
  const snowy = t.wx === "snow" || t.wx === "blizzard" || s.snow > 0;
  x.fillStyle = night ? "#0f172a" : snowy ? "#cbd5e1" : "#6b8f71"; x.beginPath(); x.moveTo(0, H * .55); for (let k = 0; k <= W; k += 10) x.lineTo(k, H * .55 - 16 * Math.sin(k / W * 5 + 1) - 10 * Math.sin(k / W * 13)); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  x.fillStyle = night ? "#111827" : snowy ? "#e2e8f0" : "#4d7c4f"; x.fillRect(0, H * .58, W, H * .42);
  // terminal + tower
  const ty = H * .6; x.fillStyle = night ? "#1e293b" : "#94a3b8"; x.fillRect(W * .08, ty - H * .16, W * .5, H * .16); x.fillStyle = night ? "#0f172a" : "#64748b"; x.fillRect(W * .08, ty - H * .18, W * .5, H * .025);
  for (let i = 0; i < 18; i++) { x.fillStyle = night ? (i % 3 ? "#fde68a" : "#facc15") : "#bae6fd"; x.globalAlpha = night ? .85 : .75; x.fillRect(W * .1 + i * W * .026, ty - H * .13, W * .018, H * .07); } x.globalAlpha = 1;
  x.fillStyle = night ? "#e2e8f0" : "#0f172a"; x.font = `800 ${Math.max(8, W * .022)}px system-ui`; x.fillText("TERMINAL", W * .1, ty - H * .19);
  x.fillStyle = night ? "#334155" : "#cbd5e1"; x.fillRect(W * .78, ty - H * .36, W * .03, H * .36); x.fillStyle = night ? "#475569" : "#e2e8f0"; x.beginPath(); x.moveTo(W * .755, ty - H * .36); x.lineTo(W * .835, ty - H * .36); x.lineTo(W * .825, ty - H * .43); x.lineTo(W * .765, ty - H * .43); x.fill(); x.fillStyle = night ? "#22d3ee" : "#0ea5e9"; x.fillRect(W * .768, ty - H * .42, W * .054, H * .05); x.fillStyle = "#ef4444"; if (Math.floor(tm * 1.5) % 2) { x.beginPath(); x.arc(W * .795, ty - H * .445, 2.2, 0, 7); x.fill(); }
  // windsock
  const xw = xwNow(s); const sx = W * .9, sy = ty - H * .12; x.strokeStyle = "#e2e8f0"; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, ty); x.lineTo(sx, sy); x.stroke(); const ang = Math.min(1.45, .25 + xw / 30) + Math.sin(tm * 6) * .08; const L = W * .05; for (let k = 0; k < 5; k++) { x.fillStyle = k % 2 ? "#fff" : "#f97316"; const a0 = k / 5, a1 = (k + 1) / 5; x.beginPath(); x.moveTo(sx + Math.sin(ang) * L * a0, sy + Math.cos(ang) * L * a0 * .3 + (k ? 0 : -3)); x.lineTo(sx + Math.sin(ang) * L * a1, sy + Math.cos(ang) * L * a1 * .3 - 3 + a1 * 2); x.lineTo(sx + Math.sin(ang) * L * a1, sy + Math.cos(ang) * L * a1 * .3 + 3 - a1 * 2); x.lineTo(sx + Math.sin(ang) * L * a0, sy + Math.cos(ang) * L * a0 * .3 + 3); x.fill(); }
  // parked planes at stands
  for (let i = 0; i < 3; i++) plane(x, W * (.16 + i * .15), ty + H * .02, W * .1, 0, ["#dc2626", "#2563eb", "#16a34a"][i], night);
  if ((t.wx === "snow" || t.wx === "blizzard")) { for (let i = 0; i < 2; i++) { const px = W * (.24 + i * .15); x.fillStyle = "#a855f7"; x.fillRect(px, ty + H * .05, W * .035, H * .03); x.strokeStyle = "rgba(251,146,60,.8)"; x.lineWidth = 1.5; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(px + W * .02, ty + H * .045); x.quadraticCurveTo(px - W * .01 * k, ty - H * .02, px - W * .03 - k * 3, ty + (Math.sin(tm * 9 + k) * 4)); x.stroke(); } } }
  // queue at the door
  const q = Math.min(30, s.backDep + Math.round((100 - s.mood) / 8)); for (let i = 0; i < q; i++) { x.fillStyle = ["#f87171", "#fbbf24", "#60a5fa", "#a78bfa", "#34d399"][i % 5]; const qx = W * .58 + (i % 15) * W * .012, qy = ty - 3 - Math.floor(i / 15) * 7; x.beginPath(); x.arc(qx, qy - 6 + Math.sin(tm * 5 + i) * .6, 2.2, 0, 7); x.fill(); x.fillRect(qx - 2, qy - 4, 4, 5); }
  // runway
  const ry = H * .8; x.fillStyle = night ? "#0b0f14" : "#374151"; x.fillRect(0, ry - H * .045, W, H * .09); x.fillStyle = "#e5e7eb"; for (let k = 0; k < 14; k++) x.fillRect(k * W / 14 + 6, ry - 1, W / 30, 2.5);
  if (night) for (let k = 0; k < 24; k++) { x.fillStyle = "#fef3c7"; x.beginPath(); x.arc(k * W / 23, ry - H * .045, 1.6, 0, 7); x.arc(k * W / 23, ry + H * .045, 1.6, 0, 7); x.fill(); }
  if (s.snow > 0) { x.fillStyle = `rgba(241,245,249,${Math.min(.85, s.snow / 10)})`; x.fillRect(0, ry - H * .045, W, H * .09); }
  x.fillStyle = night ? "#94a3b8" : "#f8fafc"; x.font = `900 ${Math.max(9, W * .026)}px system-ui`; x.fillText(s.rw === "23" ? "23R ◀" : "▶ 05L", W * .02, ry + H * .075);
  // animated movements during a slot
  if (A.t < 1) { const n = Math.min(8, Math.max(1, Math.round(A.n / 6))); for (let i = 0; i < n; i++) { const ph = (A.t * n - i * .55); if (ph < 0 || ph > 1.4) continue; const dep = i % 2 === 0; const dir = s.rw === "23" ? -1 : 1; let px: number, py: number, ang = 0;
      if (dep) { const u = Math.min(1.4, ph); px = dir < 0 ? W * (1 - u * .9) : W * u * .9; py = ry - (u > .55 ? (u - .55) ** 2 * H * .9 : 0); ang = u > .55 ? .25 : 0; } else { const u = Math.min(1.4, ph); const land = Math.min(1, u / .6); px = dir < 0 ? W * (1.1 - u * .85) : W * (-.1 + u * .85); py = ry - (1 - land) * H * .38; ang = land < 1 ? -.08 : 0; }
      plane(x, px, py, W * .085, ang, ["#f8fafc", "#facc15", "#38bdf8"][i % 3], night, dir < 0); }
    if (A.plough) { const u = A.t; for (let k = 0; k < 3; k++) { const px = W * (u * 1.2 - k * .07); x.fillStyle = "#f97316"; x.fillRect(px, ry - H * .03 + k * 4, W * .045, H * .028); x.fillStyle = "#facc15"; x.fillRect(px + W * .045, ry - H * .035 + k * 4, 4, H * .04); x.fillStyle = "rgba(255,255,255,.8)"; for (let j = 0; j < 5; j++) { x.beginPath(); x.arc(px + W * .05 + j * 3, ry - H * .04 + k * 4 - Math.random() * 8, 1.5, 0, 7); x.fill(); } } } }
  // weather particles
  const kind = t.wx === "snow" || t.wx === "blizzard" ? "snow" : t.wx === "rain" || t.wx === "storm" ? "rain" : ""; const n = kind ? (t.wx === "blizzard" || t.wx === "storm" ? 140 : 80) : 0; while (A.parts.length < n) A.parts.push({ x: Math.random() * W, y: Math.random() * H, v: .5 + Math.random() }); A.parts.length = n; const wind = xw * 4;
  for (const p of A.parts) { if (kind === "snow") { p.y += (25 + p.v * 30) * dt; p.x += (wind * .6 + Math.sin(tm + p.v * 7) * 10) * dt; x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.arc(p.x, p.y, .8 + p.v, 0, 7); x.fill(); } else { p.y += 420 * p.v * dt; p.x += wind * dt; x.strokeStyle = "rgba(203,213,225,.5)"; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + wind * .03, p.y + 10); x.stroke(); } if (p.y > H) { p.y = -5; p.x = Math.random() * W; } if (p.x > W + 5) p.x = -5; }
  if (t.wx === "fog") { x.fillStyle = "rgba(226,232,240,.55)"; x.fillRect(0, 0, W, H); }
}
function plane(x: CanvasRenderingContext2D, cx: number, cy: number, w: number, ang: number, tail: string, night: boolean, flip = false) {
  x.save(); x.translate(cx, cy); if (flip) x.scale(-1, 1); x.rotate(-ang); const k = w / 100; x.scale(k, k);
  x.fillStyle = night ? "#cbd5e1" : "#f8fafc"; x.beginPath(); x.moveTo(-50, -4); x.lineTo(38, -6); x.quadraticCurveTo(52, -4, 50, 2); x.lineTo(-44, 4); x.closePath(); x.fill(); x.strokeStyle = "#0b1220"; x.lineWidth = 1; x.stroke();
  x.fillStyle = tail; x.beginPath(); x.moveTo(-50, -4); x.lineTo(-56, -22); x.lineTo(-44, -22); x.lineTo(-34, -5); x.fill(); x.fillStyle = "#64748b"; x.beginPath(); x.moveTo(-6, 0); x.lineTo(10, 0); x.lineTo(-2, 10); x.lineTo(-12, 10); x.fill();
  x.fillStyle = "#0f172a"; for (let i = 0; i < 10; i++) x.fillRect(-36 + i * 7, -3, 3, 2.5); if (night) { x.fillStyle = "#ef4444"; x.fillRect(-2, 9, 2, 2); x.fillStyle = "#fff"; x.fillRect(-56, -23, 2, 2); }
  x.restore(); }
