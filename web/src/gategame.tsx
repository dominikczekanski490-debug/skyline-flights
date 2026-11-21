// Gate Builder (Games): the gate agent's brief gives a flight's details; build the gate screen to match it.
// Levels add time-based status, delays, Polish destinations (Kraków style) and gate changes. Scores stay on this device.
import { useMemo, useState } from "react";
import { GateScreen, Fit, DIM, ST, type GSpec, type GState, type GStyle } from "./gate";
import { AirlineTile } from "./brand";
import { AL_NAMES } from "./alnames";
import { useBest, shuffle } from "./games";

type Fl = { al: string; pre: string; dest: string; pl: string };
const POOL: Fl[] = [["FR", "FR", "Dublin", "Dublin"], ["FR", "FR", "Rome", "Rzym"], ["FR", "FR", "Milan Bergamo", "Mediolan Bergamo"], ["U2", "EZY", "Paris", "Paryż"], ["U2", "EZY", "Geneva", "Genewa"], ["W6", "W6", "Budapest", "Budapeszt"],
  ["W6", "W6", "London Luton", "Londyn Luton"], ["LO", "LO", "Warsaw", "Warszawa"], ["LH", "LH", "Munich", "Monachium"], ["LH", "LH", "Frankfurt", "Frankfurt"], ["BA", "BA", "London Heathrow", "Londyn Heathrow"], ["KL", "KL", "Amsterdam", "Amsterdam"],
  ["AF", "AF", "Paris CDG", "Paryż CDG"], ["SK", "SK", "Copenhagen", "Kopenhaga"], ["DY", "D8", "Oslo", "Oslo"], ["OS", "OS", "Vienna", "Wiedeń"], ["A3", "A3", "Athens", "Ateny"], ["TP", "TP", "Lisbon", "Lizbona"], ["VY", "VY", "Barcelona", "Barcelona"],
  ["EK", "EK", "Dubai", "Dubaj"], ["QR", "QR", "Doha", "Doha"], ["TK", "TK", "Istanbul", "Stambuł"], ["LS", "LS", "Tenerife South", "Teneryfa Płd."], ["EI", "EI", "Dublin", "Dublin"]].map(([al, pre, dest, pl]) => ({ al, pre, dest, pl }));
const GATES = ["A3", "A6", "A9", "B12", "B22", "C4", "C10", "D5", "14", "17", "32", "52"];
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (m: number) => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`;
const rnd = (n: number) => Math.floor(Math.random() * n);
type Task = { style: GStyle; ans: GSpec; brief: string[]; opts: string[]; needPl: boolean; needEst: boolean };
/** Boarding rules used for time-based levels (shown in the brief): gate opens 45 min before, boarding 30, final call 15, closed 10. */
const byTime = (left: number): GState => left > 45 ? "wait" : left > 30 ? "gate" : left > 15 ? "boarding" : left > 10 ? "final" : left > 0 ? "closed" : "departed";
function makeTask(level: number): Task {
  const f = POOL[rnd(POOL.length)]; const num = f.pre + (100 + rnd(8900)); const dep = 6 * 60 + rnd(15 * 12) * 5; const gate = GATES[rnd(GATES.length)];
  const style: GStyle = level >= 3 && Math.random() < .5 ? "krk" : level >= 4 && Math.random() < .5 ? "lpa" : "mag";
  const opts = shuffle([f.al, ...shuffle(POOL.map(p => p.al).filter(a => a !== f.al)).filter((a, i, A) => A.indexOf(a) === i).slice(0, 3)]);
  const name = AL_NAMES[f.al] || f.al; const brief: string[] = []; let st: GState; let est: string | undefined; let g = gate;
  if (level <= 1) { st = (["wait", "gate", "boarding", "final", "closed"] as GState[])[rnd(5)]; brief.push(`${name} ${num} to ${f.dest}, departing ${hm(dep)} from gate ${gate}.`, `Status: ${ST[st].mag.toLowerCase()}.`); }
  else { const left = [50, 40, 25, 12, 8][rnd(5)]; st = byTime(left); brief.push(`${name} ${num} to ${f.dest}, scheduled ${hm(dep)}, gate ${gate}.`, `It's ${hm(dep - left)} now. Gate opens 45 min before, boarding 30, final call 15, closed 10.`);
    if (level >= 3 && Math.random() < .35) { const late = 20 + rnd(8) * 5; st = "delayed"; est = hm(dep + late); brief[1] = `It's ${hm(dep - 60)} now and the aircraft is late: new departure time ${est}.`; } }
  if (level >= 4 && Math.random() < .5) { g = GATES.filter(x => x !== gate)[rnd(GATES.length - 1)]; brief.push(`Gate change: moved from ${gate} to ${g}.`); }
  if (style === "krk") brief.push(`Kraków screen: also type the Polish name (${f.pl === f.dest ? "same as English" : "e.g. " + f.pl.split(" ")[0] + "…"}).`);
  const ans: GSpec = { style, gate: g, al: f.al, alName: name, num, dest: f.dest, destPl: f.pl, time: hm(dep), est, st, lang: style === "krk" ? "enpl" : "en", anim: "none", tz: style === "krk" ? "Europe/Warsaw" : undefined };
  return { style, ans, brief, opts, needPl: style === "krk", needEst: st === "delayed" };
}
const norm = (x = "") => x.toUpperCase().replace(/[^A-Z0-9ĄĆĘŁŃÓŚŹŻ]/g, "");
const ROUNDS = 8;
export function GateBuilder() {
  const [best, report] = useBest("gatebuild"); const [round, setRound] = useState(0); const [score, setScore] = useState(0); const [streak, setStreak] = useState(0); const [bestStreak, setBestStreak] = useState(0);
  const level = 1 + Math.floor(round / 2); const [task, setTask] = useState<Task>(() => makeTask(1));
  const blank = (t: Task): GSpec => ({ style: t.style, gate: "", al: "", num: "", dest: "", time: "", st: "wait", lang: t.ans.lang, anim: "none", tz: t.ans.tz });
  const [me, setMe] = useState<GSpec>(() => blank(task)); const set = (p: Partial<GSpec>) => setMe(o => ({ ...o, ...p }));
  const [res, setRes] = useState<null | { pts: number; rows: [string, boolean, string, number][] }>(null); const [end, setEnd] = useState<null | { nb: boolean }>(null);
  const check = () => {
    const a = task.ans; const rows: [string, boolean, string, number][] = [["Gate", norm(me.gate) === norm(a.gate), a.gate, 15], ["Airline", me.al === a.al, a.alName || a.al, 10], ["Flight", norm(me.num) === norm(a.num), a.num, 20],
      ["Destination", norm(me.dest) === norm(a.dest), a.dest, 20], ["Time", me.time === a.time, a.time, 15], ["Status", me.st === a.st, ST[a.st].mag, 20]];
    if (task.needPl) rows.push(["Polish name", norm(me.destPl) === norm(a.destPl), a.destPl || "", 10]);
    if (task.needEst) rows.push(["New time", me.est === a.est, a.est || "", 10]);
    const max = rows.reduce((s, r) => s + r[3], 0); const got = rows.reduce((s, r) => s + (r[1] ? r[3] : 0), 0); const perfect = got === max; const ns = perfect ? streak + 1 : 0;
    const pts = Math.round(got / max * 100) + (perfect ? 20 + 10 * Math.min(ns, 5) : 0);
    setStreak(ns); setBestStreak(b => Math.max(b, ns)); setScore(s => s + pts); setRes({ pts, rows }); try { navigator.vibrate?.(perfect ? 12 : [30, 40, 30]); } catch { /* iPhone */ }
  };
  const next = () => { if (round + 1 >= ROUNDS) { setEnd({ nb: report(score) }); return; } const t = makeTask(1 + Math.floor((round + 1) / 2)); setTask(t); setMe(blank(t)); setRes(null); setRound(r => r + 1); };
  const again = () => { const t = makeTask(1); setTask(t); setMe(blank(t)); setRes(null); setRound(0); setScore(0); setStreak(0); setEnd(null); };
  const [w, h] = DIM[task.style]; const stOpts = useMemo(() => (["wait", "gate", "pre", "boarding", "final", "closed", "departed", "delayed", "cancelled"] as GState[]), []);
  if (end) return <div className="gb"><div className="gb-end"><b>Shift over!</b><div className="gq-big">{score}</div><div>points · best streak {bestStreak}</div>{end.nb && <div className="gq-nb">New best!</div>}<button className="gp-btn pri" onClick={again}>Play again</button></div></div>;
  return <div className="gb">
    <div className="gq-top"><span>Screen {round + 1}/{ROUNDS} · Level {level}</span><div className="gq-bar"><i style={{ width: `${round / ROUNDS * 100}%` }} /></div><span>{score} pts{streak > 1 ? ` · 🔥${streak}` : ""}{best != null ? ` · best ${best}` : ""}</span></div>
    <div className="gb-brief" role="note"><small>📻 GATE BRIEF</small>{task.brief.map((l, i) => <p key={i}>{l}</p>)}</div>
    <div className={"gb-prev gp-stage " + task.style}><Fit w={w} h={h}><GateScreen s={res ? me : { ...me, al: me.al || "", dest: me.dest || " " }} /></Fit></div>
    {!res ? <>
      <div className="gsx-grid gb-form">
        <label className="gsx-f"><span>Gate</span><input value={me.gate} maxLength={4} onChange={e => set({ gate: e.target.value.toUpperCase() })} /></label>
        <label className="gsx-f"><span>Flight number</span><input value={me.num} maxLength={8} onChange={e => set({ num: e.target.value.toUpperCase().replace(/\s/g, "") })} /></label>
        <div className="gsx-f gb-alf"><span>Airline</span><div className="gb-als">{task.opts.map(a => <button key={a} className={me.al === a ? "on" : ""} aria-pressed={me.al === a} onClick={() => set({ al: a, alName: AL_NAMES[a] })}><AirlineTile a={{ iata: a, name: AL_NAMES[a] || a }} mode="colour" /><small>{AL_NAMES[a] || a}</small></button>)}</div></div>
        <label className="gsx-f"><span>Destination</span><input value={me.dest} maxLength={24} onChange={e => set({ dest: e.target.value })} /></label>
        {task.needPl && <label className="gsx-f"><span>Destination in Polish</span><input value={me.destPl || ""} maxLength={24} onChange={e => set({ destPl: e.target.value })} /></label>}
        <label className="gsx-f"><span>Departure time</span><input type="time" value={me.time} onChange={e => set({ time: e.target.value })} /></label>
        <label className="gsx-f"><span>Status</span><select value={me.st} onChange={e => set({ st: e.target.value as GState })}>{stOpts.map(k => <option key={k} value={k}>{ST[k].mag}</option>)}</select></label>
        {me.st === "delayed" && <label className="gsx-f"><span>New time</span><input type="time" value={me.est || ""} onChange={e => set({ est: e.target.value })} /></label>}
      </div>
      <button className="gp-btn pri gb-go" onClick={check}>Put it on the screen ✓</button></>
      : <div className="gb-res"><div className="gb-pts">+{res.pts}</div><ul>{res.rows.map(([k, ok, v]) => <li key={k} className={ok ? "ok" : "bad"}>{ok ? "✓" : "✗"} {k}{!ok && <> — should be <b>{v}</b></>}</li>)}</ul>
        {res.rows.some(r => !r[1]) && <><small className="faint">The correct screen:</small><div className={"gb-prev gp-stage " + task.style}><Fit w={w} h={h}><GateScreen s={task.ans} /></Fit></div></>}
        <button className="gp-btn pri gb-go" onClick={next}>{round + 1 >= ROUNDS ? "Finish shift" : "Next flight →"}</button></div>}
  </div>;
}
