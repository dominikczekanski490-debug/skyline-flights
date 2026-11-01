// v62 — Play & Plan Stage D (features 32–40). Smart = rule/statistical over real logs, each prints its rule. Device-only saves.
import { useEffect, useMemo, useRef, useState } from "react";
import { useApi, Rule, St, useLS, U, tone, In } from "./v59";

const SRC = "Skyline's multi-day flight log (official airport boards)";
const still = () => document.documentElement.dataset.skin === "eink" || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** F1 (smart). Best airport to fly FROM for a destination. */
export function BestFrom() { const [t, setT] = useLS("sk.v62.bf", "AGP"); const [go, setGo] = useState(1); const d = useApi(go ? `/play/from?t=${t}&g=${go}` : null); const [o, setO] = useState<string | null>(null);
  return <div className="card v59c"><h3>Best airport to fly from</h3><div className="muted sm">Pick where you want to go. Which nearby airport gets you away on time most often?</div>
    <div className="v59r v61r mt8"><In v={t} set={setT} ph="AGP" n={3} label="Destination code" /><button className="press" onClick={() => { setGo(g => g + 1); setO(null); }}>Rank airports</button></div>
    <St d={d} t="departure airports" />{d && !d.error ? (d.list.length ? d.list.map((x: any, i: number) => <div key={x.o}><button className="v59fo press mt8" style={{ width: "100%" }} aria-expanded={o === x.o} onClick={() => setO(o === x.o ? null : x.o)}><span>#{i + 1} {x.city} ({x.o})</span><span className={tone(x.on)}>{x.on}%</span></button>
      {o === x.o ? <div className="xs mt8">{x.n} logged flights {x.o}→{d.t}; {x.on}% left under 15 min late.{x.n < 15 ? " Small sample — take it with a pinch of salt." : ""}</div> : null}</div>) : <div className="muted sm mt8">No airport has 5+ logged departures to {d.t || "there"} yet. Try AGP, ALC, DUB or PMI.</div>) : null}
    {d?.rule ? <Rule d={d} /> : null}</div>; }

/** F2 (smart). Meet in the middle — destinations both friends can fly to, ranked by both-on-time chance. */
export function MeetMiddle() { const [a, setA] = useLS("sk.v62.ma", "MAN"); const [b, setB] = useLS("sk.v62.mb", "STN"); const [go, setGo] = useState(1); const [min, setMin] = useState(5); const d = useApi(go ? `/play/meet?a=${a}&b=${b}&g=${go}` : null);
  const L = (d?.list || []).filter((x: any) => Math.min(x.na, x.nb) >= min);
  return <div className="card v59c"><h3>Meet in the middle</h3><div className="muted sm">You fly from one airport, your friend from another. Where can you both get to?</div>
    <div className="v59r v61r mt8"><In v={a} set={setA} ph="MAN" n={3} label="Your airport" /><In v={b} set={setB} ph="STN" n={3} label="Friend's airport" /><button className="press" onClick={() => setGo(g => g + 1)}>Find</button></div>
    <label className="sm mt8 v59sl">Each route needs <b>{min}+</b> logged flights<input type="range" min={1} max={30} value={min} aria-label="Minimum flights per route" onChange={e => setMin(+e.target.value)} /></label>
    <St d={d} t="meeting places" />{d && !d.error ? (L.length ? <>{L.slice(0, 8).map((x: any) => <div key={x.k} className="v59fo mt8"><span>{x.city || x.k} ({x.k})</span><span className="xs muted">{x.onA}% · {x.onB}%</span><span className={tone(x.both)}>{x.both}%</span></div>)}<div className="xs muted mt8">{L.length} places in total · your % · friend's % · both</div></>
      : <div className="muted sm mt8">{d.list.length ? `No shared places with ${min}+ flights each — drag the slider left.` : `No shared destinations in the log for ${d.a} and ${d.b}. Skyline logs departures mostly from MAN, STN, EMA and DUB.`}</div>) : null}
    {d?.rule ? <Rule d={d} /> : null}</div>; }

/** F3 (smart). Delay luck simulator — resample a flight's real logged days. */
export function LuckSim() { const [n, setN] = useLS("sk.v62.ls", "FR3222"); const [go, setGo] = useState(1); const d = useApi(go ? `/play/delays?n=${n}&g=${go}` : null); const [k, setK] = useState(10); const [roll, setRoll] = useState<number[] | null>(null);
  const L = (d?.list || []); const pool = L.map((r: any) => r.s === "cancelled" || typeof r.d !== "number" ? null : Math.max(0, r.d));
  const draw = (m: number) => Array.from({ length: m }, () => pool[Math.floor(Math.random() * pool.length)]);
  const sim = useMemo(() => { if (!pool.length) return null; const T = Array.from({ length: 1000 }, () => draw(k).reduce((t: number, v: number | null) => t + (v ?? 0), 0)).sort((x, y) => x - y); return { p10: T[100], p50: T[500], p90: T[900] }; }, [d, k]);
  useEffect(() => setRoll(null), [d, k]);
  const tot = roll ? roll.reduce((t, v) => t + (v ?? 0), 0) : 0;
  return <div className="card v59c"><h3>Delay luck simulator</h3><div className="muted sm">Fly the same flight lots of times. Roll the dice to see how much waiting you'd do.</div>
    <div className="v59r v61r mt8"><In v={n} set={setN} ph="FR3222" label="Flight to simulate" /><button className="press" onClick={() => setGo(g => g + 1)}>Load</button></div>
    <St d={d} t="logged days" />{d && !d.error ? (pool.length ? <>
      <label className="sm mt8 v59sl">Fly it <b>{k}</b> times<input type="range" min={5} max={50} step={5} value={k} aria-label="Number of trips" onChange={e => setK(+e.target.value)} /></label>
      <button className="press mt8" onClick={() => setRoll(draw(k))}>🎲 Roll {k} trips</button>
      {roll ? <><div className="v62dots mt8" aria-label="Your rolled trips">{roll.map((v, i) => <span key={i} className={v == null ? "x" : v >= 60 ? "b" : v >= 15 ? "w" : "g"} title={v == null ? "cancelled" : `${v} min`} />)}</div>
        <div className="sm mt8">You waited <b>{tot} min</b> in total ({Math.round(tot / 60 * 10) / 10} h){roll.some(v => v == null) ? `, plus ${roll.filter(v => v == null).length} cancelled` : ""}.</div></> : <div className="muted sm mt8">Tap Roll to fly.</div>}
      {sim ? <div className="sm mt8">Over 1,000 simulated runs of {k} trips: usually <b>{sim.p50} min</b> of waiting; lucky runs {sim.p10} min, unlucky runs {sim.p90} min.</div> : null}</>
      : <div className="muted sm mt8">{d.n} isn't in the log yet. Try FR3222 or EJU5419.</div>) : null}
    <Rule d={{ rule: `Each simulated trip picks one of the ${pool.length || "logged"} real logged days at random (with replacement). Waiting = departure delay, early departures count as 0. Cancelled days are counted separately, not as minutes. Lucky/unlucky = 10th/90th percentile of 1,000 runs.`, source: SRC }} /></div>; }

/** F4 (smart). Bad-day finder — z-scores of an airport's daily on-time share; tap a day for its worst flights. */
export function BadDays() { const [a, setA] = useLS("sk.v62.bd", "MAN"); const [go, setGo] = useState(1); const d = useApi(go ? `/play/days?a=${a}&g=${go}` : null); const [sel, setSel] = useState<string | null>(null); const D = useApi(sel ? `/play/day?a=${d?.a}&date=${sel}` : null);
  const L = d?.list || []; const lab = (z: number) => z <= -1 ? ["Bad day", "bad"] : z >= 1 ? ["Great day", "good"] : ["Normal day", "warn"];
  return <div className="card v59c"><h3>Bad-day finder</h3><div className="muted sm">Which days were unusually bad (or great) at an airport? Tap a bar.</div>
    <div className="v59r v61r mt8"><In v={a} set={setA} ph="MAN" n={3} label="Airport for bad days" /><button className="press" onClick={() => { setGo(g => g + 1); setSel(null); }}>Check days</button></div>
    <St d={d} t="daily scores" />{d && !d.error ? (L.length >= 3 ? <><div className="v62z mt8">{L.map((x: any) => <button key={x.date} className={(x.z <= -1 ? "b " : x.z >= 1 ? "g " : "") + (sel === x.date ? "on" : "")} aria-label={`${x.date}: ${x.on}% on time, z ${x.z}`} onClick={() => setSel(x.date)}><i style={{ height: `${Math.min(50, Math.abs(x.z) * 22)}%`, [x.z < 0 ? "top" : "bottom"]: "50%" } as any} /><span>{x.date.slice(8)}</span></button>)}</div>
      <div className="xs muted">Average day: {d.mean}% on time (± {d.sd}). Bars below the line = worse than usual.</div>
      {sel ? (() => { const x = L.find((y: any) => y.date === sel); const [t, c] = lab(x.z); return <div className="sm mt8"><b>{sel}</b>: {x.on}% on time from {x.n} flights, {x.cx} cancelled — <b className={c}>{t}</b> (z {x.z}).
        {D === undefined ? <div className="muted xs">Loading worst flights…</div> : D?.worst?.length ? <div className="xs mt8">Latest that day: {D.worst.map((w: any) => `${w.n}→${w.t} ${w.d} min`).join(" · ")}{D.cx.length ? ` · cancelled: ${D.cx.join(", ")}` : ""}</div> : null}</div>; })() : <div className="muted sm mt8">Tap a day.</div>}</>
      : <div className="muted sm mt8">{d.a} needs at least 3 days with 20+ logged departures. Try MAN, STN or DUB.</div>) : null}
    {d?.rule ? <Rule d={d} /> : null}</div>; }

/** F5 (smart). Sibling rank — your flight vs the same airline's other flights from that airport. */
export function SiblingRank() { const [n, setN] = useLS("sk.v62.sr", "FR3222"); const [go, setGo] = useState(1); const d = useApi(go ? `/play/sib?n=${n}&g=${go}` : null); const [all, setAll] = useState(false);
  const L = d?.list || []; const i = d?.rank ? d.rank - 1 : -1; const show = all ? L : L.filter((_: any, j: number) => j < 3 || Math.abs(j - i) <= 2);
  return <div className="card v59c"><h3>Flight family ranking</h3><div className="muted sm">How does your flight do against the same airline's other flights from the same airport?</div>
    <div className="v59r v61r mt8"><In v={n} set={setN} ph="FR3222" label="Flight to rank" /><button className="press" onClick={() => setGo(g => g + 1)}>Rank it</button></div>
    <St d={d} t="the family" />{d && !d.error ? (d.me && L.length > 1 ? <><div className="mt8"><span className={`v59big ${tone(Math.round((1 - i / (L.length - 1)) * 100))}`}>#{d.rank}</span> <span className="sm">of {L.length} {d.al} flights from {d.city || d.o}</span></div>
      {show.map((x: any) => { const j = L.indexOf(x); return <div key={x.n} className={"v59fo mt8" + (x.n === d.n ? " v62me" : "")}><span>#{j + 1} {x.n} → {x.t}</span><span className={tone(x.on)}>{x.on}%</span><span className="xs muted">{x.days}d · {x.med ?? "—"} min</span></div>; })}
      <button className="v59link mt8" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${L.length}`}</button></>
      : <div className="muted sm mt8">{!d.me ? `${d.n} needs 3+ logged days first.` : "This flight has no siblings with 3+ logged days."} Try FR3222.</div>) : null}
    {d?.rule ? <Rule d={d} /> : null}</div>; }

/** G1 (non-smart). Codle — guess the airport code in 6 tries (codes from the log). */
export function Codle() { const d = useApi("/play/net"); const codes: string[] = useMemo(() => (d?.aps || []).map((a: any) => a.k), [d]); const [ans, setAns] = useState<string | null>(null); const [G, setG] = useState<string[]>([]); const [q, setQ] = useState(""); const [msg, setMsg] = useState(""); const [S, setS] = useLS("sk.v62.codle", { w: 0, n: 0 });
  useEffect(() => { if (codes.length && !ans) setAns(codes[Math.floor(Math.random() * codes.length)]); }, [codes]);
  const won = ans != null && G.includes(ans), lost = !won && G.length >= 6;
  const col = (g: string) => { const r = Array(3).fill("x"); const left = ans!.split(""); g.split("").forEach((c, i) => { if (c === ans![i]) { r[i] = "g"; left[i] = "_"; } }); g.split("").forEach((c, i) => { if (r[i] !== "g") { const k = left.indexOf(c); if (k >= 0) { r[i] = "y"; left[k] = "_"; } } }); return r; };
  const guess = () => { const g = U(q, 3); if (g.length !== 3) return setMsg("Codes have 3 letters."); if (!codes.includes(g)) return setMsg(`${g} isn't one of the ${codes.length} airports in the game.`); setMsg(""); const N2 = [...G, g]; setG(N2); setQ(""); if (g === ans || N2.length >= 6) setS(s => ({ w: s.w + (g === ans ? 1 : 0), n: s.n + 1 })); };
  const city = (k: string) => d?.aps?.find((a: any) => a.k === k)?.city;
  return <div className="card v59c"><h3>Codle</h3><div className="muted sm">Guess the secret 3-letter airport code in 6 tries. Green = right spot, yellow = in the code but wrong spot.</div>
    <St d={d} t="airport codes" />{ans ? <><div className="v62grid mt8">{Array.from({ length: 6 }, (_, r) => { const g = G[r]; const c = g ? col(g) : null; return <div key={r} className="v62row">{[0, 1, 2].map(i => <span key={i} className={c ? c[i] : ""}>{g?.[i] || ""}</span>)}{g ? <em className="xs muted">{city(g)}</em> : null}</div>; })}</div>
      {!won && !lost ? <div className="v59r v61r mt8"><In v={q} set={setQ} ph="ABC" n={3} label="Your code guess" /><button className="press" onClick={guess}>Guess</button></div> : <div className="sm mt8"><b className={won ? "good" : "bad"}>{won ? `Got it in ${G.length}!` : `It was ${ans}.`}</b> {ans} = {city(ans)}. <button className="press" onClick={() => { setAns(codes[Math.floor(Math.random() * codes.length)]); setG([]); }}>New code</button></div>}
      {msg ? <div className="warn xs mt8">{msg}</div> : null}<div className="xs muted mt8">Won {S.w} of {S.n} <button className="v59link" onClick={() => setS({ w: 0, n: 0 })}>reset</button></div></> : null}
    <div className="faint xs mt8">Secret codes come from the {codes.length} busiest airports in Skyline's log.</div></div>; }

/** G2 (non-smart). Morse ident player — radio beacons send their code in Morse. */
const MORSE: Record<string, string> = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----." };
export function MorseIdent() { const [t, setT] = useLS("sk.v62.mo", "MAN"); const [wpm, setWpm] = useState(10); const [cur, setCur] = useState(-1); const [play, setPlay] = useState(false); const stop = useRef(false); const [beep, setBeep] = useState(false);
  const sym = U(t, 4).split("").map(c => MORSE[c] || "");
  const go = async () => { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; let ctx: any = null; try { ctx = AC ? new AC() : null; } catch { ctx = null; } const u = 1200 / wpm; stop.current = false; setPlay(true); const W = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < sym.length && !stop.current; i++) { setCur(i); for (const s of sym[i]) { if (stop.current) break; setBeep(true); let o: any = null; if (ctx) { o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 1020; g.gain.value = 0.15; o.connect(g).connect(ctx.destination); o.start(); } await W(s === "." ? u : 3 * u); o?.stop(); setBeep(false); await W(u); } await W(2 * u); }
    setCur(-1); setPlay(false); ctx?.close(); };
  return <div className="card v59c"><h3>Morse ident player</h3><div className="muted sm">Radio beacons near airports beep their code in Morse so pilots know they've tuned the right one. Type a code and play it.</div>
    <div className="v59r v61r mt8"><In v={t} set={setT} ph="MAN" n={4} label="Code to play" />{play ? <button className="press" onClick={() => (stop.current = true)}>Stop</button> : <button className="press" disabled={!sym.length} onClick={go}>▶ Play</button>}</div>
    <label className="sm mt8 v59sl">Speed <b>{wpm} words/min</b><input type="range" min={5} max={20} value={wpm} aria-label="Morse speed" onChange={e => setWpm(+e.target.value)} /></label>
    <div className="v62morse mt8">{U(t, 4).split("").map((c, i) => <div key={i} className={(cur === i ? "on" : "") + (cur === i && beep ? " bp" : "")}><b>{c}</b><span>{(sym[i] || "").split("").map((s, j) => <i key={j} className={s === "." ? "dot" : "dash"} />)}</span><em className="xs">{sym[i]}</em></div>)}</div>
    {!sym.length ? <div className="muted sm mt8">Type some letters first.</div> : null}
    <div className="faint xs mt8">International Morse code (ITU-R M.1677). Tone 1020 Hz, like real beacon idents. Sound needs your volume on.</div></div>; }

/** G3 (non-smart). Artificial horizon — drag the instrument (or sliders) to pitch and bank. */
export function Horizon() { const [p, setP] = useState(0); const [b, setB] = useState(0); const st = useRef<{ x: number; y: number; p: number; b: number } | null>(null);
  const c = (v: number, m: number) => Math.max(-m, Math.min(m, Math.round(v)));
  return <div className="card v59c"><h3>Artificial horizon</h3><div className="muted sm">This is the instrument pilots use in cloud. Drag it (or use the sliders) to tilt the plane.</div>
    <svg className="v62ai mt8" viewBox="-50 -50 100 100" role="img" aria-label={`Pitch ${p} degrees, bank ${b} degrees`} style={{ touchAction: "none" }}
      onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); st.current = { x: e.clientX, y: e.clientY, p, b }; }} onPointerMove={e => { const s = st.current; if (!s) return; setB(c(s.b + (e.clientX - s.x) / 2, 60)); setP(c(s.p + (e.clientY - s.y) / 3, 30)); }} onPointerUp={() => (st.current = null)}>
      <defs><clipPath id="v62c"><circle r="46" /></clipPath></defs>
      <g clipPath="url(#v62c)"><g transform={`rotate(${-b}) translate(0 ${p * 1.5})`}><rect x="-120" y="-120" width="240" height="120" className="sky" /><rect x="-120" y="0" width="240" height="120" className="gnd" /><line x1="-120" x2="120" y1="0" y2="0" className="hz" />
        {[-20, -10, 10, 20].map(v => <g key={v}><line x1={-(Math.abs(v) === 10 ? 10 : 16)} x2={Math.abs(v) === 10 ? 10 : 16} y1={-v * 1.5} y2={-v * 1.5} className="hz" /><text x={19} y={-v * 1.5 + 1.5} className="lb">{Math.abs(v)}</text></g>)}</g></g>
      <circle r="46" className="rim" /><path d="M-28 0h12l4 5 4-5h0M28 0h-12l-4 5-4-5" className="wing" /><circle r="1.5" className="wingc" /></svg>
    <label className="sm mt8 v59sl">Nose {p > 0 ? "up" : p < 0 ? "down" : "level"} <b>{Math.abs(p)}°</b><input type="range" min={-30} max={30} value={p} aria-label="Pitch" onChange={e => setP(+e.target.value)} /></label>
    <label className="sm v59sl">Bank {b > 0 ? "right" : b < 0 ? "left" : "level"} <b>{Math.abs(b)}°</b><input type="range" min={-60} max={60} value={b} aria-label="Bank" onChange={e => setB(+e.target.value)} /></label>
    <div className="sm mt8">{Math.abs(b) > 30 ? "That's a steep turn — airliners normally bank no more than about 25–30°." : p > 15 ? "Big climb! Airliners usually take off at around 10–15° nose up." : p === 0 && b === 0 ? "Straight and level." : "Gentle — passengers would barely notice."}</div>
    <button className="v59link" onClick={() => { setP(0); setB(0); }}>Level off</button></div>; }

/** G4 (non-smart). Touchdown game — tap Flare as close to the runway as you can. */
export function Touchdown() { const [alt, setAlt] = useState(300); const [run, setRun] = useState(false); const [res, setRes] = useState<number | null>(null); const [B, setB] = useLS("sk.v62.td", { best: null as number | null, n: 0 }); const [vs, setVs] = useState(15);
  useEffect(() => { if (!run || still()) return; const id = setInterval(() => setAlt(a => { const n = a - vs / 5; if (n <= 0) { clearInterval(id); setRun(false); setRes(-1); setB(s => ({ ...s, n: s.n + 1 })); return 0; } return n; }), 50); return () => clearInterval(id); }, [run]);
  const flare = () => { if (!run) return; setRun(false); const a = Math.round(alt); setRes(a); setB(s => ({ n: s.n + 1, best: a >= 5 && a <= 50 && (s.best == null || Math.abs(a - 20) < Math.abs(s.best - 20)) ? a : s.best })); };
  const stp = still(); const verdict = res == null ? null : res < 0 ? ["Bump! You forgot to flare.", "bad"] : res < 5 ? ["Too late — firm landing!", "warn"] : res <= 35 ? ["Butter! Lovely smooth landing.", "good"] : res <= 60 ? ["A bit early — you floated down the runway.", "warn"] : ["Way too early — you'd run out of runway!", "bad"];
  return <div className="card v59c"><h3>Touchdown game</h3><div className="muted sm">Pilots raise the nose (the "flare") about 20–30 ft above the runway. Tap Flare at the right moment!</div>
    <div className="v62td mt8" aria-label={`Height ${Math.round(alt)} feet`}><div className="rwy" /><div className="pl" style={{ bottom: `${8 + alt / 300 * 80}%` }}>✈</div><div className="ft">{Math.round(alt)} ft</div></div>
    <label className="sm mt8 v59sl">Game speed <b>{vs < 15 ? "easy" : vs < 23 ? "medium" : "hard"}</b><input type="range" min={10} max={30} value={vs} disabled={run} aria-label="Game speed" onChange={e => setVs(+e.target.value)} /></label>
    <div className="v59r mt8">{!run ? <button className="press" onClick={() => { setAlt(300); setRes(null); setRun(true); }}>{res == null ? "Start approach" : "Try again"}</button> : <><button className="press v62flare" onClick={flare}>FLARE!</button>{stp ? <button className="press" onClick={() => setAlt(a => { const n = a - vs; if (n <= 0) { setRun(false); setRes(-1); setB(s => ({ ...s, n: s.n + 1 })); return 0; } return n; })}>Descend ↓</button> : null}</>}</div>
    {stp && run ? <div className="xs muted mt8">Motion is off (E-ink / reduce motion), so tap Descend to move one step at a time.</div> : null}
    {verdict ? <div className={`sm mt8 ${verdict[1]}`}><b>{verdict[0]}</b>{res! >= 0 ? ` (flared at ${res} ft)` : ""}</div> : null}
    <div className="xs muted mt8">{B.n} landings · best flare {B.best ?? "—"} ft <button className="v59link" onClick={() => setB({ best: null, n: 0 })}>reset</button></div>
    <div className="faint xs mt8">A game, not a simulator: the 20–30 ft flare height is the usual airliner guidance; the rest is simplified.</div></div>; }
