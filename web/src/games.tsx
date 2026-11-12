// Games tab: gate/board studios + offline aviation games built on Skyline's bundled data (tail fins, airline logos,
// destination photos/index). Scores are kept on this device only (localStorage "sk.games.best").
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GateScreen, GateStudio, BoardStudio, Fit, DIM, PRESETS, type GSpec } from "./gate";
import { TAIL_FILES } from "./assets.gen";
import { LOGOS, SOLID } from "./logoset";
import { AL_NAMES } from "./alnames";
import { CC, NICE, flag } from "./countries";
import { loadDest } from "./clearway";
import { estDurMin } from "./lib";
import { Codle, Touchdown, MorseIdent } from "./v62";
import { MapQuiz, TypeGuess, DailyChallenge } from "./v61";
import { Memory as RouteMemory, Bingo, BeatStats } from "./v60";
import { CodeQuiz, LaterGame, NatoTrainer } from "./v59";
import { SignStudio, SignView, DEFAULTS as SIGN_DEFAULTS } from "./signs";
import { AnnounceStudio } from "./announce";
import "./games.css";

// ---------- helpers ----------
export const shuffle = <T,>(a: T[]): T[] => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pickN = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
type Best = Record<string, number>;
const readBest = (): Best => { try { return JSON.parse(localStorage.getItem("sk.games.best") || "{}") || {}; } catch { return {}; } };
/** Best score per game; lower=true for "fewest moves" games. Returns [best, report(score) → true if it's a new best]. */
export function useBest(id: string, lower = false) {
  const [b, setB] = useState<number | undefined>(() => readBest()[id]);
  const report = (v: number) => { const all = readBest(); const old = all[id]; const nb = old == null || (lower ? v < old : v > old); if (nb) { all[id] = v; localStorage.setItem("sk.games.best", JSON.stringify(all)); setB(v); } return nb; };
  return [b, report] as const;
}
const buzz = (ok: boolean) => { try { navigator.vibrate?.(ok ? 12 : [30, 40, 30]); } catch { /* not supported (iPhone) */ } };
let DESTS: any[] | null = null;
/** Bundled destination index (309 places, cached by the service worker for offline play). */
export function useDests() { const [d, setD] = useState<any[] | null>(DESTS); useEffect(() => { if (!DESTS) loadDest().then((j: any) => { DESTS = Object.values(j || {}).filter((v: any) => v?.iata && v?.name); setD(DESTS); }); }, []); return d; }
const ALS = () => [...LOGOS].filter(k => AL_NAMES[k] && AL_NAMES[k] !== k);
const MAN = { iata: "MAN", lat: 53.3537, lon: -2.275 } as any;

// ---------- generic quiz engine (10 rounds, 100 pts per right answer + speed + streak bonus) ----------
export type Q = { prompt: ReactNode; opts: { k: string; l: ReactNode }[]; ans: string; after?: ReactNode };
function Quiz({ id, make, ready = true, rounds = 10, cols = 2 }: { id: string; make: () => Q | null; ready?: boolean; rounds?: number; cols?: number }) {
  const [best, report] = useBest(id); const [i, setI] = useState(0); const [score, setScore] = useState(0); const [streak, setStreak] = useState(0); const [right, setRight] = useState(0);
  const [q, setQ] = useState<Q | null>(null); const [pick, setPick] = useState<string | null>(null); const [end, setEnd] = useState<null | { nb: boolean }>(null); const t0 = useRef(Date.now());
  useEffect(() => { if (ready && !q && !end) { setQ(make()); t0.current = Date.now(); } }, [ready, q, end]);
  const choose = (k: string) => { if (pick || !q) return; setPick(k); const ok = k === q.ans; buzz(ok); const sec = (Date.now() - t0.current) / 1000;
    if (ok) { setScore(s => s + 100 + Math.max(0, Math.round(50 - sec * 5)) + Math.min(streak, 5) * 10); setRight(r => r + 1); setStreak(s => s + 1); } else setStreak(0); };
  const next = () => { if (i + 1 >= rounds) setEnd({ nb: report(score) }); else { setI(i + 1); setPick(null); setQ(null); } };
  const again = () => { setI(0); setScore(0); setStreak(0); setRight(0); setPick(null); setQ(null); setEnd(null); };
  if (!ready) return <p className="muted">Loading game data…</p>;
  if (end) return <div className="gq-end"><div className="gq-big">{score}</div><div>points · {right}/{rounds} right</div>{end.nb ? <div className="gq-nb">New best!</div> : best != null && <div className="faint sm">Best {best}</div>}<button className="gp-btn pri" onClick={again}>Play again</button></div>;
  if (!q) return null;
  return <div className="gq"><div className="gq-top"><span>{i + 1}/{rounds}</span><span className="gq-bar"><i style={{ width: `${(i + (pick ? 1 : 0)) / rounds * 100}%` }} /></span><span>{score} pts{streak > 1 ? ` · 🔥${streak}` : ""}</span></div>
    <div className="gq-prompt">{q.prompt}</div>
    <div className={"gq-opts c" + cols}>{q.opts.map(o => <button key={o.k} className={"gq-opt" + (pick ? (o.k === q.ans ? " ok" : o.k === pick ? " bad" : " dim") : "")} onClick={() => choose(o.k)}>{o.l}</button>)}</div>
    {pick && <div className="gq-after">{q.after}<button className="gp-btn pri" onClick={next}>{i + 1 >= rounds ? "See score" : "Next ›"}</button></div>}
    {best != null && <div className="faint xs gq-best">Best {best}</div>}</div>;
}
const names4 = (ans: string, pool: string[], label: (k: string) => string) => shuffle([ans, ...pickN(pool.filter(k => k !== ans && label(k) !== label(ans)), 3)]).map(k => ({ k, l: label(k) }));

// ---------- the quiz games ----------
export const makeFin = (): Q => { const codes = Object.keys(TAIL_FILES); const ans = codes[Math.floor(Math.random() * codes.length)]; const nm = (k: string) => AL_NAMES[k] || k;
  return { prompt: <div className="gq-fin"><img src={TAIL_FILES[ans]} alt="Mystery tail fin" /></div>, opts: names4(ans, codes, nm), ans, after: <div className="sm">{nm(ans)} ({ans})</div> }; };
function FinQuiz() { return <Quiz id="fins" make={makeFin} />; }

function LiveryQuiz() { const make = (): Q => { const L = ALS(); const ans = L[Math.floor(Math.random() * L.length)]; const x = Math.round(Math.random() * 100), y = Math.round(Math.random() * 100);
  return { prompt: <div className="gq-livery"><div key={ans} className="gq-zoom" style={{ backgroundImage: `url(/logos/${ans}.png)`, backgroundPosition: `${x}% ${y}%` }} /><small>Zooming out… answer fast for more points</small></div>, opts: names4(ans, L, k => AL_NAMES[k]), ans, after: <div className="gq-logo-rev"><img src={`/logos/${ans}.png`} alt="" /></div> }; };
  return <Quiz id="livery" make={make} />; }

function CodeGame() { const D = useDests(); const make = (): Q | null => { if (!D) return null; const L = D.filter(d => /^[A-Z]{3}$/.test(d.iata)); const a = L[Math.floor(Math.random() * L.length)]; const rev = Math.random() < 0.5;
  const o = shuffle([a, ...pickN(L.filter(x => x.iata !== a.iata && x.name !== a.name), 3)]);
  return rev ? { prompt: <div className="gq-code">{a.iata}</div>, opts: o.map(x => ({ k: x.iata, l: x.name })), ans: a.iata, after: <div className="sm">{a.iata} = {a.name}, {NICE[a.country] || a.country}</div> }
    : { prompt: <div className="gq-q"><b>{a.name}</b><span>{flag(CC[a.country])} {NICE[a.country] || a.country} · which airport code?</span></div>, opts: o.map(x => ({ k: x.iata, l: <span className="gq-mono">{x.iata}</span> })), ans: a.iata, cols: 4, after: <div className="sm">{a.name} is {a.iata}</div> } as Q; };
  return <Quiz id="codes" make={make} ready={!!D} />; }

function PhotoGame() { const D = useDests(); const make = (): Q | null => { if (!D) return null; const L = D.filter(d => d.img); const a = L[Math.floor(Math.random() * L.length)];
  const o = shuffle([a, ...pickN(L.filter(x => x.name !== a.name), 3)]);
  return { prompt: <div className="gq-photo"><img src={`/dest/v3/${a.iata}.webp`} alt="Mystery destination" /><small>Photo: {a.img.by} · {a.img.lic} · Wikimedia Commons</small></div>, opts: o.map(x => ({ k: x.iata, l: x.name })), ans: a.iata, after: <div className="sm">{a.name}, {NICE[a.country] || a.country}</div> }; };
  return <Quiz id="photo" make={make} ready={!!D} />; }

function FlagGame() { const D = useDests(); const cs = useMemo(() => D ? [...new Set(D.map(d => d.country).filter(c => CC[c]))] : [], [D]);
  const make = (): Q | null => { if (!cs.length) return null; const a = cs[Math.floor(Math.random() * cs.length)]; const ex = D!.filter(d => d.country === a).map(d => d.name).slice(0, 3).join(", ");
    return { prompt: <div className="gq-flag">{flag(CC[a])}</div>, opts: names4(a, cs, k => NICE[k] || k), ans: a, after: <div className="sm">{NICE[a] || a}: Skyline destinations include {ex}</div> }; };
  return <Quiz id="flags" make={make} ready={cs.length > 0} />; }

// ---------- Higher or lower: estimated flight time from Manchester ----------
function HiLo() { const D = useDests(); const [best, report] = useBest("hilo"); const L = useMemo(() => (D || []).filter(d => d.lat && d.iata !== "MAN" && estDurMin(MAN, d) > 40), [D]);
  const [a, setA] = useState<any>(null); const [b, setB] = useState<any>(null); const [n, setN] = useState(0); const [res, setRes] = useState<null | boolean>(null); const [over, setOver] = useState(false);
  const draw = (x?: any) => { const A = x || L[Math.floor(Math.random() * L.length)]; let B; do B = L[Math.floor(Math.random() * L.length)]; while (B === A || Math.abs(estDurMin(MAN, A) - estDurMin(MAN, B)) < 10); setA(A); setB(B); setRes(null); };
  useEffect(() => { if (L.length && !a) draw(); }, [L.length]);
  const m = (d: any) => { const t = estDurMin(MAN, d); return `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, "0")}m`; };
  const guess = (longer: boolean) => { if (res != null) return; const ok = (estDurMin(MAN, b) > estDurMin(MAN, a)) === longer; buzz(ok); setRes(ok); if (ok) setN(n + 1); else { report(n); setOver(true); } };
  if (!a || !b) return <p className="muted">Loading routes…</p>;
  const Card = ({ d, show }: { d: any; show: boolean }) => <div className="hl-card" style={{ backgroundImage: d.img ? `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.7)),url(/dest/v3/${d.iata}.webp)` : undefined }}><small>Manchester →</small><b>{d.name}</b><span>{flag(CC[d.country])} {NICE[d.country] || d.country}</span><em>{show ? m(d) : "?"}</em></div>;
  return <div className="hl"><div className="gq-top"><span>Streak {n}</span><span /><span>{best != null ? `Best ${best}` : ""}</span></div>
    <Card d={a} show /><Card d={b} show={res != null} />
    {res == null ? <div className="hl-btns"><button className="gq-opt" onClick={() => guess(true)}>▲ Longer</button><button className="gq-opt" onClick={() => guess(false)}>▼ Shorter</button></div>
      : over ? <div className="gq-end"><div className="gq-big">{n}</div><div>in a row</div><button className="gp-btn pri" onClick={() => { setN(0); setOver(false); draw(); }}>Play again</button></div>
        : <div className="gq-after"><b className="good">Right!</b><button className="gp-btn pri" onClick={() => draw(b)}>Next ›</button></div>}
    <p className="faint xs">Times are estimates from great-circle distance (cruise ~430 kt + 25 min taxi), not timetable times.</p></div>; }

// ---------- Logo memory match ----------
function LogoMemory() { const [best, report] = useBest("memory", true); const mk = () => shuffle(pickN(ALS().filter(k => !SOLID.has(k)), 8).flatMap(k => [k, k])).map((k, i) => ({ k, i }));
  const [cards, setCards] = useState(mk); const [open, setOpen] = useState<number[]>([]); const [done, setDone] = useState<string[]>([]); const [moves, setMoves] = useState(0); const [nb, setNb] = useState(false);
  const tap = (i: number) => { if (open.length === 2 || open.includes(i) || done.includes(cards[i].k)) return; const o = [...open, i]; setOpen(o);
    if (o.length === 2) { setMoves(m => m + 1); const ok = cards[o[0]].k === cards[o[1]].k; buzz(ok); setTimeout(() => { if (ok) { const d = [...done, cards[i].k]; setDone(d); if (d.length === 8) setNb(report(moves + 1)); } setOpen([]); }, ok ? 350 : 850); } };
  const fin = done.length === 8;
  return <div className="mm"><div className="gq-top"><span>{moves} moves</span><span /><span>{best != null ? `Best ${best}` : "Find the 8 pairs"}</span></div>
    <div className="mm-grid">{cards.map((c, i) => { const up = open.includes(i) || done.includes(c.k); return <button key={i} className={"mm-c" + (up ? " up" : "") + (done.includes(c.k) ? " done" : "")} onClick={() => tap(i)} aria-label={up ? AL_NAMES[c.k] : "Hidden card"}><span className="mm-b">✈</span><span className="mm-f"><img src={`/logos/${c.k}.png`} alt="" /></span></button>; })}</div>
    {fin && <div className="gq-end"><div className="gq-big">{moves}</div><div>moves</div>{nb && <div className="gq-nb">New best!</div>}<button className="gp-btn pri" onClick={() => { setCards(mk()); setDone([]); setOpen([]); setMoves(0); setNb(false); }}>Play again</button></div>}</div>; }

// ---------- Flapdle: guess the 5-letter destination on a split-flap board ----------
const WORDS = ["PARIS", "MALTA", "DUBAI", "MIAMI", "MILAN", "TOKYO", "CAIRO", "PORTO", "SOFIA", "SEOUL", "DELHI", "LAGOS", "ACCRA", "TUNIS", "RABAT", "VARNA", "GENOA", "TURIN", "PERTH", "LUXOR", "HANOI", "DHAKA", "LILLE", "LEEDS", "AMMAN", "TAMPA", "ASWAN", "ABUJA"]; // all are destinations in Skyline's index
export function scoreWord(g: string, a: string) { const r = Array(5).fill("x"); const left: Record<string, number> = {}; for (let i = 0; i < 5; i++) { if (g[i] === a[i]) r[i] = "g"; else left[a[i]] = (left[a[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (r[i] !== "g" && left[g[i]]) { r[i] = "y"; left[g[i]]--; } return r.join(""); }
function Flapdle() { const [best, report] = useBest("flap", true); const [ans, setAns] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]); const [rows, setRows] = useState<string[]>([]); const [cur, setCur] = useState(""); const [nb, setNb] = useState(false);
  const won = rows.at(-1) === ans, lost = !won && rows.length >= 6, over = won || lost;
  const key = (k: string) => { if (over) return; if (k === "⌫") setCur(c => c.slice(0, -1)); else if (k === "↵") { if (cur.length === 5) { const r = [...rows, cur]; setRows(r); setCur(""); buzz(cur === ans); if (cur === ans) setNb(report(r.length)); } } else if (cur.length < 5) setCur(c => c + k); };
  useEffect(() => { const h = (e: KeyboardEvent) => { const k = e.key.toUpperCase(); if (/^[A-Z]$/.test(k)) key(k); else if (e.key === "Backspace") key("⌫"); else if (e.key === "Enter") key("↵"); }; addEventListener("keydown", h); return () => removeEventListener("keydown", h); });
  const st: Record<string, string> = {}; rows.forEach(w => { const s = scoreWord(w, ans); [...w].forEach((c, i) => { const v = s[i]; if (v === "g" || (v === "y" && st[c] !== "g") || (v === "x" && !st[c])) st[c] = v; }); });
  const grid = [...rows, ...(over ? [] : [cur.padEnd(5)])].concat(Array(6).fill("     ")).slice(0, 6);
  return <div className="fl"><div className="gq-top"><span>Guess the destination</span><span /><span>{best != null ? `Best ${best}/6` : ""}</span></div>
    <div className="fl-grid">{grid.map((w, r) => { const s = r < rows.length ? scoreWord(w, ans) : ""; return <div key={r} className="fl-row">{[...w].map((c, i) => <span key={i + c} className={"fl-t " + (s ? "s-" + s[i] : "")} style={{ animationDelay: s ? i * 120 + "ms" : "0ms" }}>{c.trim()}</span>)}</div>; })}</div>
    {over ? <div className="gq-end"><div>{won ? `Landed in ${rows.length}!` : `It was ${ans}`}</div>{nb && <div className="gq-nb">New best!</div>}<button className="gp-btn pri" onClick={() => { setAns(WORDS[Math.floor(Math.random() * WORDS.length)]); setRows([]); setCur(""); setNb(false); }}>New word</button></div>
      : <div className="fl-kb">{["QWERTYUIOP", "ASDFGHJKL", "↵ZXCVBNM⌫"].map(r => <div key={r}>{[...r].map(k => <button key={k} className={"fl-k " + (st[k] ? "s-" + st[k] : "") + (k.length && /[↵⌫]/.test(k) ? " wide" : "")} onClick={() => key(k)}>{k}</button>)}</div>)}</div>}
    <p className="faint xs">Green = right letter, right place · amber = in the word · all answers are real destinations.</p></div>; }

// ---------- Gate rush: send each passenger to the right gate before the timer runs out ----------
function GateRush() { const D = useDests(); const [best, report] = useBest("rush"); const [run, setRun] = useState(false); const [score, setScore] = useState(0); const [lives, setLives] = useState(3); const [gates, setGates] = useState<any[]>([]); const [pax, setPax] = useState<any>(null); const [left, setLeft] = useState(1); const [flash, setFlash] = useState(""); const [nb, setNb] = useState(false);
  const deal = (sc: number) => { const L = pickN((D || []).filter(d => d.name.length < 14), 4); const A = pickN(ALS(), 4); const g = L.map((d, i) => ({ gate: String(10 + Math.floor(Math.random() * 40)) + (i ? "" : ""), dest: d.name, al: A[i], num: A[i] + (100 + Math.floor(Math.random() * 899)) })); const uniq = new Set<string>(); g.forEach(x => { while (uniq.has(x.gate)) x.gate = String(+x.gate + 1); uniq.add(x.gate); });
    setGates(g); setPax({ ...g[Math.floor(Math.random() * 4)], t: Date.now(), dur: Math.max(2200, 6000 - sc * 180) }); setLeft(1); };
  useEffect(() => { if (!run || !pax) return; const t = setInterval(() => { const l = 1 - (Date.now() - pax.t) / pax.dur; setLeft(Math.max(0, l)); if (l <= 0) miss(); }, 50); return () => clearInterval(t); }, [run, pax]);
  const miss = () => { setFlash("bad"); buzz(false); const lv = lives - 1; setLives(lv); if (lv <= 0) { setRun(false); setNb(report(score)); } else deal(score); setTimeout(() => setFlash(""), 300); };
  const tap = (g: any) => { if (!run) return; if (g.num === pax.num) { const s = score + 1; setScore(s); setFlash("ok"); buzz(true); setTimeout(() => setFlash(""), 200); deal(s); } else miss(); };
  const start = () => { setScore(0); setLives(3); setNb(false); setRun(true); deal(0); };
  if (!D) return <p className="muted">Loading…</p>;
  return <div className={"gr " + flash}><div className="gq-top"><span>{"♥".repeat(Math.max(0, lives))}{"♡".repeat(3 - Math.max(0, lives))}</span><span /><span>{score} boarded{best != null ? ` · best ${best}` : ""}</span></div>
    {run && pax ? <><div className="gr-pass"><small>BOARDING PASS</small><b>{pax.num}</b><span>to {pax.dest}</span><i className="gr-time" style={{ transform: `scaleX(${left})` }} /></div>
      <div className="gr-gates">{gates.map(g => <button key={g.gate} className="gr-g" onClick={() => tap(g)}><b>{g.gate}</b><span>{g.num}</span><small>{g.dest}</small></button>)}</div></>
      : <div className="gq-end">{score > 0 && <><div className="gq-big">{score}</div><div>passengers boarded</div></>}{nb && <div className="gq-nb">New best!</div>}<p className="sm muted">A passenger shows their boarding pass: tap the gate for that flight before the bar runs out. It gets faster. 3 lives.</p><button className="gp-btn pri" onClick={start}>{score ? "Play again" : "Start"}</button></div>}</div>; }

// ---------- ATC: land them all, hold planes to keep separation ----------
type P = { x: number; y: number; v: number; hold: boolean; hx: number; hy: number; a: number; cs: string };
function AtcGame() { const ref = useRef<HTMLCanvasElement>(null); const [best, report] = useBest("atc"); const [state, setState] = useState<"idle" | "run" | "over">("idle"); const [landed, setLanded] = useState(0); const [nb, setNb] = useState(false);
  const G = useRef<{ ps: P[]; next: number; landed: number; last: number; raf: number }>({ ps: [], next: 0, landed: 0, last: 0, raf: 0 });
  const W = 360, H = 480, T = { x: W / 2, y: H - 70 };
  useEffect(() => { if (state !== "run") return; const g = G.current; g.ps = []; g.next = 0; g.landed = 0; g.last = performance.now(); setLanded(0);
    const cv = ref.current!, c = cv.getContext("2d")!; const dpr = Math.min(3, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const CS = ALS().slice(0, 60);
    const step = (now: number) => { const dt = Math.min(0.05, (now - g.last) / 1000); g.last = now; g.next -= dt;
      if (g.next <= 0) { const side = Math.random(); const x = side < 0.33 ? 10 : side < 0.66 ? W - 10 : 30 + Math.random() * (W - 60); const y = side < 0.66 ? 20 + Math.random() * 180 : 10; const al = CS[Math.floor(Math.random() * CS.length)];
        g.ps.push({ x, y, v: 22 + Math.min(30, g.landed * 1.2) + Math.random() * 8, hold: false, hx: 0, hy: 0, a: 0, cs: al + (100 + Math.floor(Math.random() * 899)) }); g.next = Math.max(1.4, 4 - g.landed * 0.09); }
      for (const p of g.ps) { if (p.hold) { p.a += dt * p.v / 26; p.x = p.hx + Math.cos(p.a) * 26; p.y = p.hy + Math.sin(p.a) * 26; } else { const dx = T.x - p.x, dy = T.y - p.y, d = Math.hypot(dx, dy) || 1; p.x += dx / d * p.v * dt; p.y += dy / d * p.v * dt; } }
      const keep = g.ps.filter(p => Math.hypot(T.x - p.x, T.y - p.y) > 6); if (keep.length < g.ps.length) { g.landed += g.ps.length - keep.length; setLanded(g.landed); buzz(true); } g.ps = keep;
      let crash = false; for (let i = 0; i < g.ps.length; i++) for (let j = i + 1; j < g.ps.length; j++) if (Math.hypot(g.ps[i].x - g.ps[j].x, g.ps[i].y - g.ps[j].y) < 20) crash = true;
      // draw radar
      c.fillStyle = "#04140c"; c.fillRect(0, 0, W, H); c.strokeStyle = "rgba(60,255,140,.16)"; c.lineWidth = 1; for (let r = 60; r < 600; r += 60) { c.beginPath(); c.arc(T.x, T.y, r, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = "#2b3a33"; c.fillRect(T.x - 7, T.y - 4, 14, 64); c.fillStyle = "#e9f5ee"; for (let k = 0; k < 6; k++) c.fillRect(T.x - 1, T.y + 4 + k * 10, 2, 5); c.fillStyle = "#ffd200"; c.fillRect(T.x - 7, T.y - 6, 14, 3);
      c.font = "600 10px ui-monospace,Menlo,monospace";
      for (const p of g.ps) { const dx = T.x - p.x, dy = T.y - p.y; const ang = p.hold ? p.a + Math.PI / 2 : Math.atan2(dy, dx); c.save(); c.translate(p.x, p.y); c.rotate(ang); c.fillStyle = p.hold ? "#ffbf47" : "#5dff9a"; c.beginPath(); c.moveTo(9, 0); c.lineTo(-7, -6); c.lineTo(-4, 0); c.lineTo(-7, 6); c.closePath(); c.fill(); c.restore();
        c.fillStyle = p.hold ? "#ffbf47" : "#9dffc2"; c.fillText(p.cs + (p.hold ? " HOLD" : ""), p.x + 10, p.y - 8); }
      if (crash) { c.fillStyle = "rgba(255,40,40,.35)"; c.fillRect(0, 0, W, H); setState("over"); setNb(report(g.landed)); return; }
      g.raf = requestAnimationFrame(step); };
    g.raf = requestAnimationFrame(step); return () => cancelAnimationFrame(g.raf); }, [state]);
  const tap = (e: React.PointerEvent) => { if (state !== "run") return; const r = (e.target as HTMLCanvasElement).getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    let best: P | null = null, bd = 36; for (const p of G.current.ps) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    if (best) { if (best.hold) best.hold = false; else { best.hold = true; best.hx = best.x - 26; best.hy = best.y; best.a = 0; } } };
  return <div className="atc"><div className="gq-top"><span>{landed} landed</span><span /><span>{best != null ? `Best ${best}` : ""}</span></div>
    <div className="atc-box"><canvas ref={ref} onPointerDown={tap} style={{ aspectRatio: `${W}/${H}` }} />
      {state !== "run" && <div className="atc-ov">{state === "over" ? <><b>Loss of separation!</b><div className="gq-big">{landed}</div><div>landed safely</div>{nb && <div className="gq-nb">New best!</div>}</> : <><b>Approach control</b><p className="sm">Every aircraft heads for the runway. Tap one to put it in a holding circle, tap again to clear it to land. Keep them apart.</p></>}<button className="gp-btn pri" onClick={() => setState("run")}>{state === "over" ? "Try again" : "Start"}</button></div>}</div></div>; }

// ---------- registry + hub ----------
type Def = { id: string; name: string; sub: string; ic: string; col: string; C: () => ReactNode; online?: boolean; lower?: boolean; unit?: string };
export const GAMES: Def[] = [
  { id: "fins", name: "Tail Fin Quiz", sub: "Name the airline from its real tail", ic: "🛫", col: "#2563eb", C: FinQuiz, unit: "pts" },
  { id: "livery", name: "Spot the Livery", sub: "A logo zooms out. Be quick!", ic: "🔍", col: "#db2777", C: LiveryQuiz, unit: "pts" },
  { id: "photo", name: "Where Am I?", sub: "Guess the destination from the photo", ic: "📸", col: "#0d9488", C: PhotoGame, unit: "pts" },
  { id: "codes", name: "Airport Codes", sub: "City ⇄ three-letter code", ic: "🔤", col: "#7c3aed", C: CodeGame, unit: "pts" },
  { id: "flags", name: "Flag Quiz", sub: "Countries Skyline flies to", ic: "🏳️", col: "#ea580c", C: FlagGame, unit: "pts" },
  { id: "hilo", name: "Higher or Lower", sub: "Longer or shorter flight from MAN?", ic: "⏱️", col: "#16a34a", C: HiLo, unit: "streak" },
  { id: "flap", name: "Flapdle", sub: "Split-flap word game, 6 tries", ic: "🔠", col: "#ca8a04", C: Flapdle, lower: true, unit: "/6" },
  { id: "memory", name: "Logo Match", sub: "Memory pairs with airline logos", ic: "🃏", col: "#0891b2", C: LogoMemory, lower: true, unit: "moves" },
  { id: "rush", name: "Gate Rush", sub: "Send passengers to the right gate", ic: "🏃", col: "#dc2626", C: GateRush, unit: "boarded" },
  { id: "atc", name: "Approach Control", sub: "Hold and land traffic safely", ic: "📡", col: "#059669", C: AtcGame, unit: "landed" },
];
const CLASSIC: Def[] = [
  { id: "codle", name: "Codle", sub: "Guess the airport code", ic: "🟩", col: "#334155", C: () => <Codle />, online: true },
  { id: "touchdown", name: "Touchdown", sub: "Flare for a smooth landing", ic: "🛬", col: "#334155", C: () => <Touchdown /> },
  { id: "mapquiz", name: "Map Quiz", sub: "Find places on the map", ic: "🗺️", col: "#334155", C: () => <MapQuiz />, online: true },
  { id: "type", name: "Type Guess", sub: "Name the aircraft type", ic: "✈️", col: "#334155", C: () => <TypeGuess /> },
  { id: "daily", name: "Daily Challenge", sub: "Today's real-flight puzzle", ic: "📅", col: "#334155", C: () => <DailyChallenge />, online: true },
  { id: "quiz", name: "Route Quiz", sub: "Real routes from Skyline's logs", ic: "❓", col: "#334155", C: () => <CodeQuiz />, online: true },
  { id: "later", name: "Later or Earlier", sub: "Real departure times", ic: "🕒", col: "#334155", C: () => <LaterGame />, online: true },
  { id: "beat", name: "Beat the Stats", sub: "Guess real delay numbers", ic: "📊", col: "#334155", C: () => <BeatStats />, online: true },
  { id: "routes", name: "Route Memory", sub: "Pairs from real routes", ic: "🧠", col: "#334155", C: () => <RouteMemory />, online: true },
  { id: "bingo", name: "Airport Bingo", sub: "Spot things at the airport", ic: "🎯", col: "#334155", C: () => <Bingo /> },
  { id: "nato", name: "NATO Trainer", sub: "Alpha, Bravo, Charlie…", ic: "🎙️", col: "#334155", C: () => <NatoTrainer /> },
  { id: "morse", name: "Morse Ident", sub: "Decode navaid idents", ic: "📶", col: "#334155", C: () => <MorseIdent /> },
];
export const ALL_GAMES = [...GAMES, ...CLASSIC];
const STUDIOS = ["gate", "board", "signs", "announce"];
export const GAME_IDS = [...STUDIOS, ...ALL_GAMES.map(g => g.id)];

export function GamesView({ x, tab0, init, inTab }: { x?: ReactNode; tab0?: string; init?: GSpec; more?: () => void; inTab?: boolean }) {
  const [t, setT0] = useState<string>(() => tab0 && GAME_IDS.includes(tab0) ? tab0 : "home"); const [bests, setBests] = useState<Best>(readBest);
  const setT = (v: string) => { setT0(v); setBests(readBest()); const h = v === "home" ? (inTab ? "#tab=games" : "#games") : inTab ? `#tab=games&game=${v}` : `#games=${v}`; if (!/[#&][gbs]=/.test(location.hash) || v === "home") history.replaceState(history.state, "", h); document.querySelector(".games")?.scrollIntoView({ block: "start" }); };
  const g = ALL_GAMES.find(d => d.id === t); const title = t === "gate" ? "Gate studio" : t === "board" ? "Board studio" : t === "signs" ? "Sign studio" : t === "announce" ? "Announcement maker" : g?.name || "Games";
  const Card = ({ d }: { d: Def }) => { const b = bests[d.id]; return <button className="gm-tile" onClick={() => setT(d.id)} style={{ ["--c" as any]: d.col }}><span className="gm-ic">{d.ic}</span><b>{d.name}</b><small>{d.sub}</small>{b != null ? <em>Best {b}{d.unit && d.unit.startsWith("/") ? d.unit : d.unit ? " " + d.unit : ""}</em> : d.online ? <em className="on">Needs internet</em> : <em className="new">Play</em>}</button>; };
  return <div className={"games" + (inTab ? " in-tab" : "")}><div className="gm-hero"><div className="gm-hero-t">{t !== "home" ? <button className="gm-back" onClick={() => setT("home")}>‹ All games</button> : <span className="gm-kick">SKYLINE</span>}<h1>{title}</h1>{t === "home" && <p>Build gate screens, boards, airport signs and announcements, then play {GAMES.length + CLASSIC.length} aviation games. Scores stay on this device.</p>}</div>{x}</div>
    {t === "home" ? <div className="gm-body">
      <h2 className="gm-h">Studios</h2>
      <div className="gm-studios">
        <button className="gm-studio" onClick={() => setT("gate")}><div className="gm-art gates">{[...PRESETS].sort((a, b) => (a.s.style === "lhr" ? 1 : 0) - (b.s.style === "lhr" ? 1 : 0)).map((p, i) => <div key={i} className={"gm-mini " + p.s.style}><Fit w={DIM[p.s.style][0]} h={DIM[p.s.style][1]}><GateScreen s={{ ...p.s, anim: "none" }} /></Fit></div>)}</div><div className="gm-txt"><b>Gate studio</b><small>Animated gate screens in Manchester, Kraków (EN/PL), Heathrow or Gran Canaria style. Share or go fullscreen.</small></div></button>
        <button className="gm-studio" onClick={() => setT("board")}><div className="gm-art board"><div className="gm-flap">{"DEPARTURES".split("").map((c, i) => <i key={i} style={{ animationDelay: i * 90 + "ms" }}>{c}</i>)}</div></div><div className="gm-txt"><b>Board studio</b><small>Build your own departures or arrivals board in 40+ airport styles, with flips and live status changes.</small></div></button>
        <button className="gm-studio" onClick={() => setT("signs")}><div className="gm-art signs">{(["krk", "man", "lhr", "lpa", "fgr"] as const).map(k => <div key={k} className="gm-sg"><SignView s={SIGN_DEFAULTS[k]} /></div>)}</div><div className="gm-txt"><b>Sign studio</b><small>Design hanging airport signs in Kraków, Manchester, Heathrow, Gran Canaria or Fraport Greece style: arrows, pictograms, several languages, share links.</small></div></button>
        <button className="gm-studio" onClick={() => setT("announce")}><div className="gm-art ann"><div className="gm-ann"><b>LAST CALL</b><small>FR 2134  ·  GATE 32</small></div></div><div className="gm-txt"><b>Announcement maker</b><small>Write and play boarding calls, final calls and more, in the style of Manchester, Kraków, Gran Canaria, Fraport Greece and other airports. Voices come from your iPhone.</small></div></button>
      </div>
      <h2 className="gm-h">Quick games <span>work offline</span></h2><div className="gm-grid">{GAMES.map(d => <Card key={d.id} d={d} />)}</div>
      <h2 className="gm-h">Classics</h2><div className="gm-grid">{CLASSIC.map(d => <Card key={d.id} d={d} />)}</div></div>
      : <div className="gm-body gm-play">{t === "gate" ? <GateStudio init={init} /> : t === "board" ? <BoardStudio /> : t === "signs" ? <SignStudio /> : t === "announce" ? <AnnounceStudio /> : g ? <g.C /> : null}</div>}</div>;
}
