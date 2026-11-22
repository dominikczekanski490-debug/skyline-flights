// Speed-run Boarding: race boarding methods for a 180-seat cabin (30 rows × 6) side by side, or design your own plan and try to beat the CPU.
// Times come from this game's own simple simulation (bag stowing + seat shuffles), not from real airline data.
import { useEffect, useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, End, sfx, pick } from "./kit";
import { ROWS, METHODS, makePax, mkLane, tick, zones, typ, type Lane, type Meth } from "./boardsim";

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
export default function Boarding() {
  const [best, report] = useBest("boarding", true); const [mine, setMine] = useState("custom"); const [cust, setCust] = useState({ type: true, rows: "back" as "back" | "front" | "none" });
  const [race, setRace] = useState<{ a: Lane; b: Lane; an: string; bn: string } | null>(null); const [, setUi] = useState(0); const [nb, setNb] = useState(false); const acc = useRef(0); const fin = useRef(false); const ca = useRef<HTMLCanvasElement>(null), cb = useRef<HTMLCanvasElement>(null);
  const meth = (k: string): Meth => k === "custom" ? { k, n: "Your plan", sub: "", order: p => zones(p, x => (cust.type ? typ(x.s) * 100 : 0) + (cust.rows === "back" ? -Math.floor(x.r / 6) : cust.rows === "front" ? Math.floor(x.r / 6) : 0)) } : METHODS.find(m => m.k === k)!;
  const start = () => { const p = makePax(); const my = meth(mine); const cpu = pick(METHODS.filter(m => m.k !== mine)); setRace({ a: mkLane(my.order(p)), b: mkLane(cpu.order(p.map(x => ({ ...x })))), an: my.n, bn: cpu.n }); setNb(false); fin.current = false; sfx.whoosh(); };
  const running = !!race && !(race.a.done && race.b.done);
  useLoop(dt => { if (!race) return; acc.current += dt * 40; while (acc.current >= 1) { acc.current--; tick(race.a); tick(race.b); }
    if (race.a.done && race.b.done && !fin.current) { fin.current = true; (race.a.t <= race.b.t ? sfx.win : sfx.bad)(); setNb(report(race.a.t)); }
    drawLane(ca.current, race.a); drawLane(cb.current, race.b); setUi(u => u + 1); }, running);
  useEffect(() => { if (race) { drawLane(ca.current, race.a); drawLane(cb.current, race.b); } });
  const won = race && race.a.done && race.b.done ? race.a.t <= race.b.t : null;
  return <div className="g4">
    {!race || !running ? <><p className="g4-intro">Pick a boarding plan. The CPU picks another. Both cabins board the same 180 passengers{best != null ? ` · your best ${mmss(best)}` : ""}.</p>
      <div className="g4-meth">{[...METHODS, { k: "custom", n: "✏️ Your plan", sub: "Build it below" }].map(m => <button key={m.k} className={mine === m.k ? "on" : ""} onClick={() => setMine(m.k)}><b>{m.n}</b><small>{m.sub}</small></button>)}</div>
      {mine === "custom" && <div className="g4-card"><b>Your plan</b><div className="gp-seg sm"><button className={cust.type ? "on" : ""} onClick={() => setCust({ ...cust, type: true })}>Windows first</button><button className={!cust.type ? "on" : ""} onClick={() => setCust({ ...cust, type: false })}>Any seat</button></div>
        <div className="gp-seg sm">{(["back", "front", "none"] as const).map(k => <button key={k} className={cust.rows === k ? "on" : ""} onClick={() => setCust({ ...cust, rows: k })}>{k === "back" ? "Back rows first" : k === "front" ? "Front rows first" : "Rows mixed"}</button>)}</div></div>}
      {race && won != null && <End big={mmss(race.a.t)} unit={won ? `🏆 You beat ${race.bn} (${mmss(race.b.t)})` : `${race.bn} won in ${mmss(race.b.t)}`} nb={nb} msg="Simulated in this game: each bag takes a few seconds to stow and every seated neighbour you squeeze past costs time." />}
      <button className="gp-btn pri" onClick={start}>{race ? "Race again" : "Start boarding race"}</button></> : null}
    {race && <div className="g4-cabin"><div className="g4-lane"><b>You: {race.an} · {mmss(race.a.t)} · {race.a.n}/180 {race.a.done ? "✓" : ""}</b><canvas ref={ca} width={680} height={150} /></div><div className="g4-lane"><b>CPU: {race.bn} · {mmss(race.b.t)} · {race.b.n}/180 {race.b.done ? "✓" : ""}</b><canvas ref={cb} width={680} height={150} /></div></div>}</div>;
}
function drawLane(c: HTMLCanvasElement | null, L: Lane) { if (!c) return; const x = c.getContext("2d")!; const W = c.width, H = c.height; const cw = (W - 40) / ROWS, ch = H / 7.4;
  x.fillStyle = "#e2e8f0"; x.beginPath(); x.roundRect(4, 2, W - 8, H - 4, 60); x.fill(); x.fillStyle = "#cbd5e1"; x.fillRect(24, ch * 3 + 2, W - 48, ch * 1.2);
  for (let r = 0; r < ROWS; r++) for (let s = 0; s < 6; s++) { const yy = 4 + (s < 3 ? s : s + 1.2) * ch, xx = 30 + r * cw; x.fillStyle = L.seated[r][s] ? "#2563eb" : "#94a3b8"; x.beginPath(); x.roundRect(xx, yy, cw - 3, ch - 3, 3); x.fill(); }
  for (let i = 0; i < ROWS; i++) { const a = L.aisle[i]; if (!a) continue; x.fillStyle = a.phase === 1 ? "#f97316" : a.col; x.beginPath(); x.arc(30 + i * cw + cw / 2, ch * 3.6 + 2, ch * .42, 0, 7); x.fill(); }
  x.fillStyle = "#16a34a"; x.fillRect(4, ch * 3 + 2, 18, ch * 1.2); x.fillStyle = "#0f172a"; x.font = "700 18px system-ui"; x.fillText(String(L.q.length), 6, H - 8); }
