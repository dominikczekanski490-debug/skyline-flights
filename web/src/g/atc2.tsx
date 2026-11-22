// Tower Boss: a new radar-control game (the original "Approach Control" stays as it was). Stylised, fan-made airspace:
// not a real chart, and the airline callsigns are made up.
import { useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, useCanvas, End, sfx } from "./kit";
import { LEVELS, newGame, step, clearApp, goAround, takeoff, advise, starsFor, faf, dirOf, FINAL, HOLD_R, SLOT_ALT, CS_NAME, arrRw, pathDist, type S, type P } from "./atcsim";

const KEY = "sk.games.atc2.v1"; const VIEW = 21;
const loadStars = (): number[] => { try { return JSON.parse(localStorage.getItem(KEY) || "{}").stars || []; } catch { return []; } };
const PH: Record<string, string> = { in: "Flying to the stack", hold: "Holding", faf: "Cleared ILS: joining final", final: "On final", roll: "Landing roll", ga: "Going around", wait: "Waiting at the holding point", lu: "Lining up", tko: "Taking off", climb: "Climbing away" };
export default function TowerBoss() {
  const [best, report] = useBest("tower"); const [ref, get] = useCanvas(); const S0 = useRef<S | null>(null); const [sel, setSel] = useState(-1); const [, setUi] = useState(0); const [run, setRun] = useState(false); const [pause, setPause] = useState(false); const [stars, setStars] = useState(loadStars); const [nb, setNb] = useState(false); const [msg, setMsg] = useState(""); const [hint, setHint] = useState(-1);
  const trails = useRef(new Map<number, [number, number][]>()); const tt = useRef(0); const ut = useRef(0); const lastLog = useRef(0);
  const start = (lv: number) => { S0.current = newGame(lv); trails.current.clear(); setSel(-1); setRun(true); setPause(false); setNb(false); setMsg(""); sfx.chime(); };
  const s = S0.current;
  const finish = (g: S) => { setRun(false); const st = starsFor(g); const a = [...stars]; a[g.lv] = Math.max(a[g.lv] || 0, st); setStars(a); localStorage.setItem(KEY, JSON.stringify({ stars: a })); setNb(g.score > 0 && report(g.score)); (st >= 2 ? sfx.win : st ? sfx.level : sfx.bad)(); };
  useLoop(dt => { const g = S0.current; if (!g || g.done) return; const n0 = g.landed, d0 = g.departed, ga0 = g.ga; step(g, dt);
    if (g.landed > n0) sfx.land(); if (g.departed > d0) sfx.whoosh(); if (g.ga > ga0) sfx.bad(); if (g.log.length && g.log[0].txt.startsWith("MAYDAY") && lastLog.current !== g.log[0].t) { lastLog.current = g.log[0].t; sfx.alert(); }
    tt.current += dt; if (tt.current > .6) { tt.current = 0; for (const p of g.ps) { const a = trails.current.get(p.id) || []; a.push([p.x, p.y]); if (a.length > 6) a.shift(); trails.current.set(p.id, a); } }
    const c = get(); if (c) draw(c.x, c.w, c.h, g, sel, hint);
    ut.current += dt; if (ut.current > .25) { ut.current = 0; setUi(u => u + 1); }
    if (g.done) finish(g); }, run && !pause);
  const act = (f: (s: S, id: number) => string | null, id: number, snd: () => void) => { if (!s) return; const e = f(s, id); setMsg(e || ""); if (e) sfx.bad(); else { snd(); setHint(-1); } setUi(u => u + 1); };
  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!s) return; const r = e.currentTarget.getBoundingClientRect(); const k = r.width / (VIEW * 2); const wx = (e.clientX - r.left) / k - VIEW, wy = (e.clientY - r.top) / k - VIEW;
    let bestP: P | null = null, bd = 2.6; for (const p of s.ps) { const d = Math.hypot(p.x - wx, p.y - wy); if (d < bd) { bd = d; bestP = p; } } setSel(bestP ? bestP.id : -1); if (bestP) sfx.click(); };
  if (!s || (!run && !s.done)) return <Levels stars={stars} best={best} go={start} />;
  const lv = LEVELS[s.lv]; const P = s.ps.find(p => p.id === sel); const left = Math.max(0, Math.ceil(lv.dur - s.t));
  const deps = s.ps.filter(p => p.ph === "wait").sort((a, b) => a.slot - b.slot);
  if (s.done && !run) { const st = starsFor(s); return <div className="g4"><End big={s.score} unit="points" nb={nb} msg={<>{"⭐".repeat(st) + "☆".repeat(3 - st)} · {s.landed} landed · {s.departed} departed · {s.ga} go-arounds{s.div ? ` · ${s.div} diverted` : ""}<br />{st ? (s.lv < LEVELS.length - 1 ? "Next sector unlocked!" : "You run the busiest sector. Tower Boss!") : `Get ${lv.stars[0]} points for a star.`}</>}>
    <div className="g4-ctl"><button className="gp-btn pri" onClick={() => start(s.lv)}>Play again</button><button className="gp-btn" onClick={() => { S0.current = null; setUi(u => u + 1); }}>Sectors</button></div></End>
    <ul className="g4-log">{s.log.slice(0, 8).map((l, i) => <li key={i} className={l.c}>{l.txt}</li>)}</ul></div>; }
  return <div className="g4 tb">
    <div className="g4-hud"><span>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span><span>⭐ {Math.round(s.score)}</span><span>🛬 {s.landed}</span><span>🛫 {s.departed}</span>{s.ga > 0 && <span>↺ {s.ga}</span>}<span className="tb-sp" /><button className="tb-mini" onClick={() => setPause(!pause)}>{pause ? "▶" : "⏸"}</button></div>
    <canvas ref={ref} className="g4-cv" style={{ aspectRatio: "1/1" }} onPointerDown={tap} aria-label="Radar screen: tap a plane to select it" />
    <div className={"g4-card tb-sel" + (P?.mayday ? " may" : "")}>{P ? <>
      <div className="tb-row"><b>{P.cs}</b><small>{CS_NAME[P.cs.slice(0, 3)] || ""} {P.cs.slice(3)} · {P.kind === "H" ? "Heavy" : "Medium"} · {P.t === "arr" ? "Arrival" : "Departure"}</small></div>
      <small>{PH[P.ph]}{P.ph === "hold" ? ` at ${lv.stacks[P.stack]?.n} · FL${Math.round(SLOT_ALT(P.slot) / 100)}` : ""}{P.slow ? " · slowing for spacing" : ""}</small>
      {P.t === "arr" && <div className="g4-bar" title="Fuel"><i style={{ width: Math.max(0, Math.min(100, P.fuel / 1.6)) + "%" }} /></div>}
      <div className="g4-ctl">{(P.ph === "hold" || P.ph === "in" || P.ph === "ga") && <button className="gp-btn pri" onClick={() => act(clearApp, P.id, sfx.chime)}>✅ Clear ILS {lv.rws[P.rw].id}</button>}
        {(P.ph === "faf" || P.ph === "final") && <button className="gp-btn" onClick={() => act((g, id) => goAround(g, id, "go around, controller's instruction", 30), P.id, () => {})}>↺ Go around</button>}
        {P.ph === "wait" && <button className="gp-btn pri" onClick={() => act(takeoff, P.id, sfx.tug)}>🛫 Take off</button>}</div></> : <small className="muted">Tap a plane on the radar, or pick one below. Land arrivals from the stacks and fit departures into the gaps.</small>}
      {msg && <small className="tb-err">{msg}</small>}</div>
    <div className="tb-lists">{lv.stacks.map((st, k) => { const hs = s.ps.filter(p => p.t === "arr" && p.stack === k && (p.ph === "hold" || p.ph === "in")).sort((a, b) => a.slot - b.slot); return <div key={st.n} className="tb-stack"><b>▲ {st.n}</b>{!hs.length && <small className="muted">empty</small>}
      {hs.map(p => <button key={p.id} className={(p.id === sel ? "on " : "") + (p.fuel < 25 ? "low " : "") + (p.id === hint ? "hint" : "")} onClick={() => { setSel(p.id); sfx.click(); }}><span>FL{Math.round(SLOT_ALT(p.slot) / 100)}</span>{p.cs}{p.kind === "H" ? " H" : ""}<i style={{ width: Math.max(0, Math.min(100, p.fuel / 1.6)) + "%" }} /></button>)}</div>; })}
      <div className="tb-stack dep"><b>🛫 Departures {lv.rws[deps[0]?.rw ?? 0]?.id}</b>{!deps.length && <small className="muted">none waiting</small>}
        {deps.map(p => <button key={p.id} className={(p.id === sel ? "on " : "") + (p.wait > 40 ? "low " : "") + (p.id === hint ? "hint" : "")} onClick={() => { setSel(p.id); act(takeoff, p.id, sfx.tug); }}><span>{Math.round(p.wait)}s</span>{p.cs}{p.kind === "H" ? " H" : ""}</button>)}</div></div>
    <div className="g4-ctl"><button className="gp-btn" onClick={() => { const a = advise(s); setHint(a ? a.id : -1); if (a) setSel(a.id); setMsg(a ? "Tip: " + (a.act === "clear" ? "clear " : "take off ") + s.ps.find(p => p.id === a.id)?.cs + ". " + a.why : "Tip: wait for a gap."); }}>💡 Tip</button></div>
    <ul className="g4-log">{s.log.slice(0, 4).map((l, i) => <li key={s.log.length - i + ":" + l.t} className={l.c}>{l.txt}</li>)}</ul>
    <p className="faint xs">Stylised {lv.style === "man" ? "Manchester" : "Katowice"}-style airspace made for this game: not a real chart. Callsigns are made up.</p></div>;
}
function Levels({ stars, best, go }: { stars: number[]; best?: number; go: (i: number) => void }) {
  return <div className="g4"><p className="g4-intro">You're the radar controller. Planes queue in <b>holding stacks</b>: clear them for the ILS one at a time, keep them spaced (more behind a <b>Heavy</b>), and squeeze departures into the gaps. Watch the fuel!</p>
    <div className="g4-levels">{LEVELS.map((l, i) => { const open = i === 0 || (stars[i - 1] || 0) >= 1; return <button key={l.k} disabled={!open} onClick={() => go(i)} style={{ opacity: open ? 1 : .5 }}><b>{open ? "" : "🔒 "}{i + 1}. {l.n}</b><small>{l.sub}</small><em>{"⭐".repeat(stars[i] || 0) + "☆".repeat(3 - (stars[i] || 0))} · {Math.round(l.dur / 60 * 10) / 10} min</em></button>; })}</div>
    {best != null && <p className="faint xs">Best shift: {best} points</p>}</div>; }

function draw(x: CanvasRenderingContext2D, W: number, H: number, s: S, sel: number, hint: number) {
  const lv = LEVELS[s.lv]; const k = W / (VIEW * 2); const X = (v: number) => (v + VIEW) * k, Y = (v: number) => (v + VIEW) * k; const t = s.t;
  const g = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * .75); g.addColorStop(0, "#0d2a24"); g.addColorStop(1, "#04110f"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // stylised terrain
  x.save(); if (lv.style === "man") { x.fillStyle = "rgba(120,98,60,.16)"; for (const [cx, cy, r] of [[17, -4, 6], [18, 6, 5], [15, 14, 4]]) { x.beginPath(); x.ellipse(X(cx), Y(cy), r * k, r * 1.6 * k, .3, 0, 7); x.fill(); } x.fillStyle = "rgba(148,163,184,.12)"; x.beginPath(); x.ellipse(X(-2), Y(-9), 7 * k, 4.5 * k, -.4, 0, 7); x.fill(); x.fillStyle = "rgba(148,163,184,.35)"; x.font = `600 ${Math.max(9, k * .9)}px system-ui`; x.fillText("CITY", X(-4), Y(-9)); x.fillText("HILLS", X(15.5), Y(0)); }
  else { x.fillStyle = "rgba(34,120,60,.18)"; for (const [cx, cy, r] of [[-12, -10, 5], [-8, 10, 6], [8, 14, 4], [-16, 2, 3], [10, -8, 3]]) { x.beginPath(); x.ellipse(X(cx), Y(cy), r * k, r * .8 * k, .5, 0, 7); x.fill(); } x.fillStyle = "rgba(134,239,172,.3)"; x.font = `600 ${Math.max(9, k * .9)}px system-ui`; x.fillText("FOREST", X(-10), Y(10)); }
  x.restore();
  const ar = lv.rws[arrRw(s)]; x.strokeStyle = "rgba(74,222,128,.13)"; x.lineWidth = 1; for (let r = 5; r <= 25; r += 5) { x.beginPath(); x.arc(X(ar.x), Y(ar.y), r * k, 0, 7); x.stroke(); }
  // sweep
  const sw = (t * 1.2) % (Math.PI * 2); const sg = x.createConicGradient ? x.createConicGradient(sw - .6, X(ar.x), Y(ar.y)) : null; if (sg) { sg.addColorStop(0, "rgba(74,222,128,0)"); sg.addColorStop(.09, "rgba(74,222,128,.12)"); sg.addColorStop(.1, "rgba(74,222,128,0)"); x.fillStyle = sg; x.fillRect(0, 0, W, H); }
  // runways + final
  for (const r of lv.rws) { const d = dirOf(r.h); x.strokeStyle = "#e5e7eb"; x.lineWidth = Math.max(3, k * .35); x.beginPath(); x.moveTo(X(r.x), Y(r.y)); x.lineTo(X(r.x + d.x * r.len), Y(r.y + d.y * r.len)); x.stroke();
    x.fillStyle = "#cbd5e1"; x.font = `700 ${Math.max(9, k * .85)}px system-ui`; x.fillText(r.id, X(r.x + d.x * r.len) + 4, Y(r.y + d.y * r.len) + 10);
    if (r.use !== "dep") { const f = faf(r); x.setLineDash([4, 4]); x.strokeStyle = "rgba(125,211,252,.55)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X(r.x), Y(r.y)); x.lineTo(X(f.x), Y(f.y)); x.stroke(); x.setLineDash([]); for (let n = 1; n <= FINAL; n++) { const px = r.x - d.x * n, py = r.y - d.y * n; x.fillStyle = "rgba(125,211,252,.6)"; x.fillRect(X(px) - 1.5, Y(py) - 1.5, 3, 3); } x.fillStyle = "#7dd3fc"; x.fillText("FAF", X(f.x) + 4, Y(f.y) - 4); } }
  if (s.ps.some(p => p.ph === "roll" || p.ph === "lu" || p.ph === "tko")) { x.fillStyle = "rgba(239,68,68,.85)"; x.font = `800 ${Math.max(9, k * .8)}px system-ui`; x.fillText("RUNWAY BUSY", X(ar.x) - 30, Y(ar.y) + 22); }
  // stacks
  lv.stacks.forEach((st, i) => { const n = s.ps.filter(p => p.t === "arr" && p.stack === i && (p.ph === "hold" || p.ph === "in")).length; x.strokeStyle = n >= 4 ? "rgba(248,113,113,.6)" : "rgba(250,204,21,.45)"; x.setLineDash([3, 4]); x.beginPath(); x.arc(X(st.x), Y(st.y), HOLD_R * k, 0, 7); x.stroke(); x.setLineDash([]);
    x.fillStyle = "#facc15"; x.beginPath(); x.moveTo(X(st.x), Y(st.y) - 6); x.lineTo(X(st.x) - 5, Y(st.y) + 4); x.lineTo(X(st.x) + 5, Y(st.y) + 4); x.fill(); x.font = `700 ${Math.max(9, k * .8)}px system-ui`; x.fillText(`${st.n} ×${n}`, X(st.x) - 18, Y(st.y) + HOLD_R * k + 12); });
  // planes
  const app = new Map(s.ps.filter(p => p.ph === "faf" || p.ph === "final").map(p => [p.id, pathDist(s, p)]));
  for (const p of s.ps) { if (p.ph === "wait") continue; const px = X(p.x), py = Y(p.y); const col = p.mayday ? (Math.floor(t * 4) % 2 ? "#f87171" : "#fff") : p.t === "arr" ? "#67e8f9" : "#fdba74";
    x.fillStyle = col; x.globalAlpha = .9; const sz = p.kind === "H" ? 4.6 : 3.4; x.fillRect(px - sz, py - sz, sz * 2, sz * 2); x.globalAlpha = 1;
    const v = dirOf(p.hdg); x.strokeStyle = col; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + v.x * 14, py + v.y * 14); x.stroke();
    if (p.id === sel || p.id === hint) { x.strokeStyle = p.id === hint ? "#facc15" : "#fff"; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 10 + Math.sin(t * 6) * 1.5, 0, 7); x.stroke(); }
    if (p.slow) { x.strokeStyle = "rgba(250,204,21,.8)"; x.beginPath(); x.arc(px, py, 7, 0, 7); x.stroke(); }
    if (p.ph === "hold") continue;
    x.fillStyle = col; x.font = `700 ${Math.max(9, k * .78)}px ui-monospace,Menlo,monospace`; x.fillText(p.cs + (p.kind === "H" ? " H" : ""), px + 7, py - 6); x.fillStyle = "rgba(226,232,240,.8)"; x.fillText(String(Math.round(p.alt / 100)).padStart(3, "0") + (app.has(p.id) ? " " + app.get(p.id)!.toFixed(1) + "nm" : ""), px + 7, py + 5); }
  // waiting departures as dots near the runway
  const dr = lv.rws.find(r => r.use !== "arr")!; s.ps.filter(p => p.ph === "wait").forEach((p, i) => { x.fillStyle = p.id === sel ? "#fff" : "#fdba74"; x.beginPath(); x.arc(X(dr.x) - 8 - i * 7, Y(dr.y) + 8, 2.6, 0, 7); x.fill(); });
  void SLOT_ALT; }
