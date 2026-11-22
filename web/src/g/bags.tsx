// Baggage Hall: drag (or tap, then tap a chute) each suitcase from the main belt into the chute for its flight before it falls off
// the end. Airport codes are real; everything else (flights, scores) is made up for the game.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, End, sfx, pick } from "./kit";

const DEST: [string, string][] = [["DUB", "Dublin"], ["AGP", "Málaga"], ["PMI", "Palma"], ["AMS", "Amsterdam"], ["KTW", "Katowice"], ["TFS", "Tenerife"], ["FAO", "Faro"], ["CDG", "Paris"], ["DXB", "Dubai"], ["JFK", "New York"], ["ALC", "Alicante"], ["BCN", "Barcelona"], ["KRK", "Kraków"], ["RAK", "Marrakech"], ["OSL", "Oslo"], ["FCO", "Rome"]];
const COLS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"];
type Lv = { n: string; sub: string; chutes: number; speed: number; every: number; dur: number; colour: boolean; city?: boolean; prio?: number; over?: boolean; swap?: boolean; stars: [number, number, number] };
const LV: Lv[] = [
  { n: "Morning wave", sub: "3 flights. Tag colours match the chutes.", chutes: 3, speed: .11, every: 2.3, dur: 60, colour: true, stars: [150, 250, 320] },
  { n: "Lunch rush", sub: "4 flights, codes only, and orange PRIORITY bags score double.", chutes: 4, speed: .13, every: 1.8, dur: 70, colour: false, prio: .18, stars: [220, 380, 500] },
  { n: "Code breaker", sub: "Chutes show city names, tags show codes. Big bags go to OVERSIZE.", chutes: 4, speed: .14, every: 1.6, dur: 75, colour: false, city: true, prio: .12, over: true, stars: [250, 420, 560] },
  { n: "Gate change chaos", sub: "Fast belt, and flights close mid-shift: watch the chutes change!", chutes: 4, speed: .17, every: 1.3, dur: 80, colour: false, prio: .15, over: true, swap: true, stars: [300, 520, 700] },
];
type Bag = { id: number; x: number; y: number; d: number; col: string; prio: boolean; big: boolean; to?: number; fall?: number; y0?: number; drag?: boolean; gone?: boolean; ok?: boolean };
type Ch = { d: number; n: number; flash: number; closed?: number };
type G = { lv: number; t: number; bags: Bag[]; ch: Ch[]; next: number; score: number; ok: number; bad: number; miss: number; combo: number; nid: number; fl: { x: number; y: number; txt: string; c: string; t: number }[]; swapped: boolean; done?: boolean };
const BELT = .2; // belt centre y (fraction of height)
function fresh(lv: number): G { const L = LV[lv]; const ds = [...DEST.keys()].sort(() => Math.random() - .5).slice(0, L.chutes); const ch: Ch[] = ds.map(d => ({ d, n: 0, flash: 0 })); if (L.over) ch.push({ d: -1, n: 0, flash: 0 }); return { lv, t: 0, bags: [], ch, next: .3, score: 0, ok: 0, bad: 0, miss: 0, combo: 0, nid: 1, fl: [], swapped: false }; }
const label = (g: G, c: Ch) => c.d < 0 ? "OVERSIZE" : LV[g.lv].city ? DEST[c.d][1] : `${DEST[c.d][0]} ${DEST[c.d][1]}`;

export default function BaggageHall() {
  const [best, report] = useBest("bags"); const [ref, get] = useCanvas(); const G0 = useRef<G | null>(null); const [run, setRun] = useState(false); const [, setUi] = useState(0); const [nb, setNb] = useState(false); const sel = useRef<number>(-1); const ut = useRef(0); const drag = useRef<{ id: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [stars, setStars] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem("sk.games.bags.v1") || "[]"); } catch { return []; } });
  const start = (lv: number) => { G0.current = fresh(lv); sel.current = -1; setRun(true); setNb(false); sfx.chime(); };
  const finish = (g: G) => { g.done = true; setRun(false); const L = LV[g.lv]; const st = g.score >= L.stars[2] ? 3 : g.score >= L.stars[1] ? 2 : g.score >= L.stars[0] ? 1 : 0; const a = [...stars]; a[g.lv] = Math.max(a[g.lv] || 0, st); setStars(a); localStorage.setItem("sk.games.bags.v1", JSON.stringify(a)); setNb(g.score > 0 && report(g.score)); (st ? sfx.win : sfx.bad)(); };
  const send = (g: G, b: Bag, ci: number, W: number, H: number) => { const c = g.ch[ci]; if (!c || c.closed) return; b.to = ci; b.fall = 0; b.y0 = Math.max(b.y, H * BELT); b.drag = false; b.x = (ci + .5) * W / g.ch.length; const right = b.big ? c.d === -1 : c.d === b.d;
    if (right) { g.combo++; const pts = (b.prio ? 20 : 10) * (g.combo >= 5 ? 2 : 1); g.score += pts; g.ok++; c.n++; b.ok = true; g.fl.push({ x: b.x, y: H * .45, txt: "+" + pts + (g.combo >= 5 ? " 🔥" : ""), c: "#4ade80", t: 1 }); sfx.pop(); }
    else { g.combo = 0; g.score -= 15; g.bad++; c.flash = 1; b.ok = false; g.fl.push({ x: b.x, y: H * .45, txt: b.big ? "Oversize!" : `Wrong! → ${DEST[b.d][0]}`, c: "#f87171", t: 1.2 }); sfx.bad(); } sel.current = -1; };
  useLoop(dt => { const g = G0.current; const c = get(); if (!g || g.done || !c) return; const { w: W, h: H } = c; const L = LV[g.lv]; g.t += dt;
    if ((g.next -= dt) <= 0) { g.next = L.every * (.7 + Math.random() * .6); const open = g.ch.filter(c => c.d >= 0 && !c.closed); const big = !!L.over && Math.random() < .12; const d = pick(open).d; g.bags.push({ id: g.nid++, x: -30, y: H * BELT, d, col: pick(["#e11d48", "#2563eb", "#059669", "#9333ea", "#d97706", "#0891b2", "#be185d", "#4d7c0f"]), prio: !big && Math.random() < (L.prio || 0), big }); }
    if (L.swap && !g.swapped && g.t > L.dur * .45) { g.swapped = true; const ci = Math.floor(Math.random() * L.chutes); const used = new Set(g.ch.map(c => c.d)); const nd = [...DEST.keys()].filter(k => !used.has(k))[0]; const old = g.ch[ci].d; g.ch[ci] = { d: nd, n: 0, flash: 1, closed: 2.5 }; for (const b of g.bags) if (b.to == null && b.d === old) b.d = nd; g.fl.push({ x: (ci + .5) * W / g.ch.length, y: H * .6, txt: `Gate change! Now ${DEST[nd][0]}`, c: "#facc15", t: 2.5 }); sfx.alert(); }
    for (const ch of g.ch) { ch.flash = Math.max(0, ch.flash - dt); if (ch.closed) ch.closed = Math.max(0, ch.closed - dt) || undefined; }
    for (const b of g.bags) { if (b.drag) continue; if (b.to != null) { b.fall! += dt; b.y = (b.y0 ?? H * BELT) + b.fall! * b.fall! * H * 1.1 + b.fall! * H * .25; if (b.y > H * .9) b.gone = true; continue; }
      b.x += L.speed * W * dt; if (b.x > W + 20) { b.gone = true; g.miss++; g.combo = 0; g.score -= 5; g.fl.push({ x: W - 40, y: H * BELT + 26, txt: "Missed −5", c: "#fca5a5", t: 1 }); sfx.bad(); } }
    g.bags = g.bags.filter(b => !b.gone); g.fl.forEach(f => (f.t -= dt)); g.fl = g.fl.filter(f => f.t > 0);
    draw(c.x, W, H, g, sel.current);
    ut.current += dt; if (ut.current > .3) { ut.current = 0; setUi(u => u + 1); } if (g.t >= L.dur) finish(g); }, run);
  const pos = (e: React.PointerEvent) => { const r = (e.target as HTMLElement).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, W: r.width, H: r.height }; };
  const down = (e: React.PointerEvent) => { const g = G0.current; if (!g || g.done) return; const p = pos(e); (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const b = g.bags.filter(b => b.to == null).sort((a, b2) => Math.abs(a.x - p.x) - Math.abs(b2.x - p.x))[0];
    if (b && Math.abs(b.x - p.x) < 34 && Math.abs(p.y - p.H * BELT) < 40) { sel.current = b.id; b.drag = true; drag.current = { id: b.id, sx: p.x, sy: p.y, moved: false }; sfx.click(); return; }
    if (p.y > p.H * (BELT + .08) && sel.current >= 0) { const sb = g.bags.find(b => b.id === sel.current && b.to == null); if (sb) send(g, sb, Math.floor(p.x / p.W * g.ch.length), p.W, p.H); } };
  const move = (e: React.PointerEvent) => { const g = G0.current, d = drag.current; if (!g || !d) return; const p = pos(e); const b = g.bags.find(b => b.id === d.id); if (!b) return; if (Math.hypot(p.x - d.sx, p.y - d.sy) > 12) d.moved = true; if (d.moved) { b.x = p.x; b.y = Math.max(p.H * BELT, p.y); } };
  const up = (e: React.PointerEvent) => { const g = G0.current, d = drag.current; drag.current = null; if (!g || !d) return; const p = pos(e); const b = g.bags.find(b => b.id === d.id); if (!b) return; b.drag = false;
    if (d.moved && p.y > p.H * (BELT + .1)) send(g, b, Math.floor(p.x / p.W * g.ch.length), p.W, p.H); else { b.y = p.H * BELT; } };
  const g = G0.current;
  if (!g) return <div className="g4"><p className="g4-intro">Suitcases ride along the main belt. <b>Drag</b> each one down into the chute for its flight (or tap a bag, then tap a chute). Bags that reach the end go to the manual-sort pile.</p>
    <div className="g4-levels">{LV.map((l, i) => { const open = i === 0 || (stars[i - 1] || 0) >= 1; return <button key={i} disabled={!open} style={{ opacity: open ? 1 : .5 }} onClick={() => start(i)}><b>{open ? "" : "🔒 "}{i + 1}. {l.n}</b><small>{l.sub}</small><em>{"⭐".repeat(stars[i] || 0) + "☆".repeat(3 - (stars[i] || 0))} · {l.dur}s</em></button>; })}</div>{best != null && <p className="faint xs">Best: {best} points</p>}</div>;
  const L = LV[g.lv]; const left = Math.max(0, Math.ceil(L.dur - g.t));
  if (g.done) { const st = g.score >= L.stars[2] ? 3 : g.score >= L.stars[1] ? 2 : g.score >= L.stars[0] ? 1 : 0; return <div className="g4"><End big={g.score} unit="points" nb={nb} msg={<>{"⭐".repeat(st) + "☆".repeat(3 - st)} · {g.ok} sorted right · {g.bad} wrong · {g.miss} missed<br />{st ? "The flights left with every bag. Nice!" : `Get ${L.stars[0]} for a star.`}</>}><div className="g4-ctl"><button className="gp-btn pri" onClick={() => start(g.lv)}>Again</button>{st > 0 && g.lv < LV.length - 1 && <button className="gp-btn pri" onClick={() => start(g.lv + 1)}>Next level</button>}<button className="gp-btn" onClick={() => { G0.current = null; setUi(u => u + 1); }}>Levels</button></div></End></div>; }
  return <div className="g4"><div className="g4-hud"><span>⏱ {left}s</span><span>⭐ {g.score}</span><span>✅ {g.ok}</span><span>❌ {g.bad}</span><span>📦 {g.miss} missed</span>{g.combo >= 3 && <span className="warn" style={{ background: "#78350f", color: "#fde68a" }}>Combo ×{g.combo}</span>}</div>
    <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "3/4" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Baggage hall: drag bags into the chutes" />
    <div className="bh-legend">{g.ch.map((c, i) => <span key={i} style={{ borderColor: L.colour && c.d >= 0 ? COLS[i] : undefined }}>{label(g, c)}<b>{c.n}</b></span>)}</div></div>;
}
function rr(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); }
function draw(x: CanvasRenderingContext2D, W: number, H: number, g: G, sel: number) {
  const L = LV[g.lv]; const n = g.ch.length; const cw = W / n; const by = H * BELT; const t = g.t;
  x.fillStyle = "#111827"; x.fillRect(0, 0, W, H); x.fillStyle = "#1f2937"; for (let i = 0; i < 12; i++) x.fillRect(0, i * H / 12, W, 1);
  // chutes (sloped belts) and carts
  for (let i = 0; i < n; i++) { const c = g.ch[i]; const x0 = i * cw + 6, x1 = (i + 1) * cw - 6; const col = c.d < 0 ? "#64748b" : L.colour ? COLS[i] : "#475569";
    x.fillStyle = c.flash > 0 ? `rgba(239,68,68,${.35 + c.flash * .4})` : c.closed ? "#3f3f46" : "#1e293b"; rr(x, x0, by + 26, x1 - x0, H * .62, 10); x.fill();
    x.strokeStyle = "#0b1020"; x.lineWidth = 2; for (let k = 0; k < 14; k++) { const yy = by + 30 + ((k * 22 + t * 60) % (H * .6)); x.beginPath(); x.moveTo(x0 + 4, yy); x.lineTo(x1 - 4, yy); x.stroke(); }
    x.fillStyle = col; x.fillRect(x0, by + 26, x1 - x0, 5);
    // cart
    const cy = H * .9; x.fillStyle = "#334155"; rr(x, x0 + 2, cy - 4, x1 - x0 - 4, 30, 6); x.fill(); x.fillStyle = "#0f172a"; x.beginPath(); x.arc(x0 + 12, cy + 28, 4, 0, 7); x.arc(x1 - 12, cy + 28, 4, 0, 7); x.fill();
    for (let k = 0; k < Math.min(12, c.n); k++) { x.fillStyle = ["#7c2d12", "#1e3a8a", "#065f46", "#701a75"][k % 4]; x.fillRect(x0 + 6 + (k % 4) * ((x1 - x0 - 12) / 4), cy - 2 - Math.floor(k / 4) * 9, (x1 - x0 - 16) / 4, 8); }
    x.fillStyle = "#e2e8f0"; x.font = `800 ${Math.min(13, cw / 6)}px system-ui`; x.textAlign = "center"; const lab = label(g, c); x.fillText(c.closed ? "CLOSED" : lab.length > 11 && cw < 100 ? lab.split(" ")[0] : lab, (x0 + x1) / 2, by + 50); if (!L.city && c.d >= 0 && cw < 100) { x.font = `600 ${Math.min(11, cw / 7)}px system-ui`; x.fillStyle = "#94a3b8"; x.fillText(DEST[c.d][1], (x0 + x1) / 2, by + 64); } x.textAlign = "left"; }
  // main belt
  x.fillStyle = "#0b0f19"; x.fillRect(0, by - 24, W, 48); x.fillStyle = "#374151"; x.fillRect(0, by - 20, W, 40); x.strokeStyle = "#1f2937"; x.lineWidth = 3; for (let k = 0; k < W / 18 + 2; k++) { const xx = ((k * 18 + t * L.speed * W) % (W + 18)) - 9; x.beginPath(); x.moveTo(xx, by - 20); x.lineTo(xx, by + 20); x.stroke(); }
  x.fillStyle = "#facc15"; for (let k = 0; k < W / 24; k++) x.fillRect(k * 24, by - 24, 12, 3); x.fillStyle = "#7f1d1d"; x.fillRect(W - 8, by - 24, 8, 48);
  x.fillStyle = "#94a3b8"; x.font = "700 10px system-ui"; x.fillText("FROM CHECK-IN →", 8, by - 30); x.textAlign = "right"; x.fillText("MANUAL SORT ▸", W - 10, by - 30); x.textAlign = "left";
  // bags
  for (const b of [...g.bags].sort((a, c) => (a.drag ? 1 : 0) - (c.drag ? 1 : 0))) { const w = b.big ? 54 : 42, h = b.big ? 40 : 30; const bx = b.x - w / 2, byy = b.y - h / 2; x.save(); if (b.drag) { x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 14; x.shadowOffsetY = 8; }
    x.fillStyle = b.col; rr(x, bx, byy, w, h, 6); x.fill(); x.restore(); x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(bx + 4, byy + 3, w - 8, 3); x.strokeStyle = "#e5e7eb"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(b.x - 7, byy); x.lineTo(b.x - 7, byy - 5); x.lineTo(b.x + 7, byy - 5); x.lineTo(b.x + 7, byy); x.stroke();
    const tg = b.big ? "#94a3b8" : b.prio ? "#f97316" : L.colour ? COLS[g.ch.findIndex(c => c.d === b.d)] || "#fff" : "#f8fafc"; x.fillStyle = tg; rr(x, b.x - 17, b.y - 8, 34, 16, 3); x.fill(); x.fillStyle = b.prio || (L.colour && !b.big) ? "#fff" : "#0f172a"; x.font = "800 11px ui-monospace,Menlo,monospace"; x.textAlign = "center"; x.fillText(b.big ? "BIG" : DEST[b.d][0], b.x, b.y + 4); x.textAlign = "left";
    if (b.id === sel && b.to == null) { x.strokeStyle = "#fff"; x.lineWidth = 2; x.setLineDash([4, 3]); rr(x, bx - 4, byy - 8, w + 8, h + 12, 8); x.stroke(); x.setLineDash([]); } }
  x.textAlign = "center"; for (const f of g.fl) { x.globalAlpha = Math.min(1, f.t * 2); x.fillStyle = f.c; x.font = "800 15px system-ui"; x.fillText(f.txt, f.x, f.y - (1 - f.t) * 30); } x.globalAlpha = 1; x.textAlign = "left"; }
