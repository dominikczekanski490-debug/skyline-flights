// v60 — Play & Plan Stage B (interactive features 11–20). Smart = rule/statistical over real logs, each prints its rule. Device-only saves.
import { useEffect, useMemo, useState } from "react";
import { api } from "./lib";
import { useApi, Rule, St, useLS, U, tone, In } from "./v59";

const pctOf = (a: number[], q: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

/** C1 (smart). Connection odds from logged delays, with a draggable layover slider. */
export function ConnOdds() { const [a, setA] = useLS("sk.v60.ca", "FR557"); const [b, setB] = useLS("sk.v60.cb", ""); const [go, setGo] = useState(0); const [lay, setLay] = useState(60); const [mct, setMct] = useState(45);
  const A = useApi(go ? `/play/delays?n=${a}&g=${go}` : null), B = useApi(go && b ? `/play/delays?n=${b}&g=${go}` : null);
  const L = A?.list || []; const ok = L.filter((r: any) => r.d != null && r.d <= lay - mct).length; const p = L.length ? Math.round(ok / L.length * 100) : null;
  const bo = B?.list?.[B.list.length - 1]?.o, at = L[L.length - 1]?.t;
  return <div className="card v59c"><h3>Will I make my connection?</h3><div className="muted sm">Type your first flight (and the onward one if you like), then drag the layover.</div>
    <div className="v59f"><In v={a} set={setA} ph="1st flight" label="First flight" /><span className="muted">then</span><In v={b} set={setB} ph="Onward (opt.)" label="Onward flight" /><button className="press" disabled={!a} onClick={() => setGo(Date.now())}>Check</button></div>
    {!go ? <div className="muted sm">Uses the days Skyline logged for your first flight. Nothing is checked until you tap Check.</div> : <><St d={A} t="history" />{A && !A.error && (!L.length ? <div className="muted sm">Skyline hasn't logged {A.n} yet, so there's nothing to count. Try a flight that leaves a UK or Irish airport.</div> : <>
      <label className="v59sl"><span>Layover <b>{lay} min</b></span><input type="range" min={20} max={240} step={5} value={lay} onChange={e => setLay(+e.target.value)} aria-label="Layover minutes" /></label>
      <label className="v59sl"><span>Time you need to change planes <b>{mct} min</b></span><input type="range" min={20} max={120} step={5} value={mct} onChange={e => setMct(+e.target.value)} aria-label="Minimum connection minutes" /></label>
      <div className={"v59big c-" + tone(p)}>{p}%<small>made it on {ok} of {L.length} logged days (late by ≤ {lay - mct} min)</small></div>
      <div className="v59dots">{L.map((r: any) => <span key={r.date} className={r.d == null ? "x" : r.d <= lay - mct ? "y" : "n"}><i>{r.date.slice(8)}</i><b>{r.d == null ? "✕" : r.d}</b></span>)}</div>
      {B && !B.error && b && (!B.list.length ? <div className="muted xs mt8">{B.n} isn't in the log, so I can't check the airports match.</div> : at && bo && <div className={(at === bo ? "good" : "bad") + " xs mt8"}>{at === bo ? `Both use ${at}: good, same airport.` : `${A.n} lands at ${at} but ${B.n} leaves from ${bo}: different airports!`}</div>)}
      {L.length < 5 && <div className="warn xs mt8">Only {L.length} days logged: a hint, not odds.</div>}
      <div className="faint xs mt8">Rule: you make it on a day if the first flight's departure delay ≤ layover − change time. Arrival delay is assumed equal to departure delay (planes sometimes catch up, so this is cautious). Cancelled days count as missed. Not airline advice. Source: {A.source}.</div></>)}</>}</div>; }

/** C2 (smart). What-if delay simulator: drag a delay, see how it ranks against real logged days. */
export function WhatIf() { const [q, setQ] = useState("EI209"); const [u, setU] = useState<string | null>(null); const [m, setM] = useState(30); const d = useApi(u);
  const T: number[] = d?.list?.filter((r: any) => r.d != null).map((r: any) => r.d) || []; const worse = T.filter(x => x > m).length; const rank = T.length ? Math.round(worse / T.length * 100) : null; const p90 = pctOf(T, 0.9);
  const lab = rank == null ? "" : m < 15 ? "That's basically on time." : rank >= 50 ? "Late, but this flight is often that late." : rank >= 10 ? "A bad day for this flight." : "Worse than almost every logged day!";
  return <div className="card v59c"><h3>What-if delay simulator</h3><div className="muted sm">Pretend your flight is late. How unusual would that be?</div>
    <div className="v59f"><In v={q} set={setQ} ph="Flight no." label="Flight number" /><button className="press" disabled={!q} onClick={() => setU(`/play/delays?n=${q}`)}>Load</button></div>
    <St d={d} t="history" />{d && !d.error && (!T.length ? <div className="muted sm">No timed departures logged for {d.n} yet.</div> : <>
      <label className="v59sl"><span>What if it leaves <b>{m} min</b> late?</span><input type="range" min={0} max={180} step={5} value={m} onChange={e => setM(+e.target.value)} aria-label="Pretend delay" /></label>
      <div className={"v59big c-" + (rank == null ? "info" : rank >= 50 ? "good" : rank >= 10 ? "warn" : "bad")}>{rank}%<small>of {T.length} logged days were even later · {lab}</small></div>
      <div className="v59bar2"><i style={{ width: Math.min(100, m / Math.max(180, ...T) * 100) + "%" }} />{T.map((x, i) => <b key={i} style={{ left: Math.max(0, Math.min(100, x / Math.max(180, ...T) * 100)) + "%" }} title={x + " min"} />)}</div>
      <div className="faint xs">Ticks = real logged days. 9 in 10 days left within {p90} min.</div>
      <div className="faint xs mt8">Rule: rank = logged days with a bigger departure delay ÷ all timed logged days. Under 15 min counts as on time. Source: {d.source}.</div></>)}</div>; }

/** C3 (smart). Where can I fly on time from here? Destinations ranked by logged reliability. */
export function DestRank() { const [o, setO] = useLS("sk.v60.do", "MAN"); const [u, setU] = useState<string | null>(null); const [min, setMin] = useState(10); const [s, setS] = useState<"on" | "days">("on"); const d = useApi(u);
  const L = useMemo(() => (d?.list || []).filter((x: any) => x.timed >= min).sort((a: any, b: any) => s === "days" ? b.days - a.days : (b.on ?? -1) - (a.on ?? -1)), [d, min, s]);
  return <div className="card v59c"><h3>Most on-time destinations</h3><div className="v59f"><In v={o} set={setO} ph="From" n={3} label="Origin airport" /><button className="press" disabled={o.length < 3} onClick={() => setU(`/play/dests?o=${o}`)}>Rank</button></div>
    <St d={d} t="destinations" />{d && !d.error && <>
      <label className="v59sl"><span>Only places with <b>{min}+</b> logged flights</span><input type="range" min={1} max={60} value={min} onChange={e => setMin(+e.target.value)} aria-label="Minimum flights" /></label>
      <div className="v59seg">{([["on", "Most on time"], ["days", "Busiest"]] as const).map(([k, l]) => <button key={k} className={s === k ? "on" : ""} aria-pressed={s === k} onClick={() => setS(k)}>{l}</button>)}</div>
      {!L.length ? <div className="muted sm">No destination from {d.o} has {min}+ logged flights. Drag the slider left, or try MAN, DUB or STN.</div> : L.slice(0, 10).map((x: any, i: number) => <div key={x.t} className={"v59r" + (i === 0 ? " top" : "")}><span className="n">{i + 1}</span><div><b>{x.t}</b> <small>{x.city || ""} · {x.timed} flights · {x.numbers} numbers</small></div><span className={"c-" + tone(x.on)}>{x.on}%</span><em>{x.median != null ? `${x.median > 0 ? "+" : ""}${x.median}m` : "—"}</em></div>)}
      {L.length > 10 && <div className="faint xs">+{L.length - 10} more</div>}<Rule d={d} /></>}</div>; }

/** C4 (smart). My flights report card: logged reliability for the flights you saved. */
export function MyReport() { const nums = useMemo(() => { try { return [...new Set((JSON.parse(localStorage.getItem("skyline.flights.v1") || "[]") as any[]).filter(f => !f.friend && !f.example && f.number).map(f => U(f.number)))].slice(0, 8); } catch { return []; } }, []);
  const [off, setOff] = useLS<string[]>("sk.v60.off", []); const [R, setR] = useState<Record<string, any>>({});
  useEffect(() => { nums.forEach(n => api(`/play/delays?n=${n}`).then(j => setR(o => ({ ...o, [n]: j }))).catch(() => setR(o => ({ ...o, [n]: { error: 1 } })))); }, [nums]);
  const on = nums.filter(n => !off.includes(n) && R[n]?.timed); const tot = on.reduce((a, n) => a + R[n].timed, 0); const ok = on.reduce((a, n) => a + Math.round(R[n].on * R[n].timed / 100), 0);
  return <div className="card v59c"><h3>My flights report card</h3><div className="muted sm">Tap a flight to leave it in or out of your score.</div>
    {!nums.length ? <div className="muted sm mt8">You haven't saved any flights yet. Add one on My Flights and it shows up here.</div> : <>
      <div className={"v59big c-" + tone(tot ? Math.round(ok / tot * 100) : null)}>{tot ? Math.round(ok / tot * 100) + "%" : "—"}<small>{tot ? `on time over ${tot} logged departures of ${on.length} flight${on.length > 1 ? "s" : ""}` : "No logged days for the flights you picked"}</small></div>
      {nums.map(n => { const r = R[n]; const inn = !off.includes(n); return <button key={n} className={"v59r v59tog" + (inn ? "" : " off")} aria-pressed={inn} onClick={() => setOff(inn ? [...off, n] : off.filter(x => x !== n))}><span className="n">{inn ? "☑" : "☐"}</span><div><b>{n}</b> <small>{r === undefined ? "loading…" : r.error ? "couldn't load" : r.timed ? `${r.timed} logged days` : "not in the log yet"}</small></div><span className={"c-" + tone(r?.on ?? null)}>{r?.on != null ? r.on + "%" : "—"}</span></button>; })}
      <div className="faint xs mt8">Rule: score = departures under 15 min late ÷ all timed logged departures, added up over the flights you ticked. Source: Skyline's multi-day flight log (official airport boards).</div></>}</div>; }

/** C5 (smart). Beat the stats: you vs a simple rule, guessing a hidden real day. */
export function BeatStats() { const [g, setG] = useState(1); const d = useApi(`/play/guess?g=${g}`); const [pick, setPick] = useState<null | boolean>(null); const [sc, setSc] = useLS("sk.v60.bs", { you: 0, rule: 0, n: 0 });
  const rule = d?.rest ? (d.rest.on ?? 0) >= 50 : null; const truth = d?.actual != null ? d.actual < 15 : null;
  const choose = (v: boolean) => { if (pick != null || truth == null) return; setPick(v); setSc({ you: sc.you + (v === truth ? 1 : 0), rule: sc.rule + (rule === truth ? 1 : 0), n: sc.n + 1 }); };
  return <div className="card v59c"><h3>Beat the stats</h3><div className="muted sm">Guess if a real flight left on time. A simple rule guesses too. Who wins?</div>
    <div className="v59score">You <b>{sc.you}</b> · Rule <b>{sc.rule}</b> · Rounds <b>{sc.n}</b></div>
    <St d={d} t="a flight" />{d && !d.error && (!d.n ? <div className="muted sm">Not enough flights with 4+ logged days yet.</div> : <>
      <div className="v59q"><b>{d.n}</b> {d.o} → {d.t} on {d.date}<small>Other days: {d.rest.on}% on time over {d.rest.timed} days, typical {d.rest.median > 0 ? "+" : ""}{d.rest.median} min</small></div>
      <div className="v59f"><button className={"press" + (pick === true ? " sel" : "")} disabled={pick != null} onClick={() => choose(true)}>On time</button><button className={"press" + (pick === false ? " sel" : "")} disabled={pick != null} onClick={() => choose(false)}>Late (15+)</button></div>
      {pick != null && <div className="sm mt8"><b className={pick === truth ? "good" : "bad"}>{pick === truth ? "You got it!" : "Not this time."}</b> It left {d.actual > 0 ? `${d.actual} min late` : d.actual < 0 ? `${-d.actual} min early` : "right on time"}. The rule said <b>{rule ? "On time" : "Late"}</b> {rule === truth ? "and was right" : "and was wrong"}.<div className="v59f"><button className="press" onClick={() => { setPick(null); setG(g + 1); }}>Next flight</button></div></div>}
      <Rule d={d} /></>)}<button className="v59link xs" onClick={() => setSc({ you: 0, rule: 0, n: 0 })}>Reset score</button></div>; }

// ---- solar position (NOAA-style approximation) ----
const R = Math.PI / 180;
function sun(lat: number, lon: number, t: Date) { const d = (+t - Date.UTC(2000, 0, 1, 12)) / 864e5; const g = (357.529 + 0.98560028 * d) * R, q = 280.459 + 0.98564736 * d; const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R, e = (23.439 - 3.6e-7 * d) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L)); const gmst = (18.697374558 + 24.06570982441908 * d) % 24; const H = ((gmst * 15 + lon) * R - ra);
  const la = lat * R; const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)); const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(H));
  return { el: el / R, az: (az / R + 360) % 360 }; }
const hv = (a: any, b: any) => { const x = Math.sin((b.lat - a.lat) * R / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin((b.lon - a.lon) * R / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(x)); };
const bg = (a: any, b: any) => { const y = Math.sin((b.lon - a.lon) * R) * Math.cos(b.lat * R), x = Math.cos(a.lat * R) * Math.sin(b.lat * R) - Math.sin(a.lat * R) * Math.cos(b.lat * R) * Math.cos((b.lon - a.lon) * R); return (Math.atan2(y, x) / R + 360) % 360; };
const gp = (a: any, b: any, f: number) => { const d = hv(a, b) / 6371; if (!d) return a; const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d); const x = A * Math.cos(a.lat * R) * Math.cos(a.lon * R) + B * Math.cos(b.lat * R) * Math.cos(b.lon * R), y = A * Math.cos(a.lat * R) * Math.sin(a.lon * R) + B * Math.cos(b.lat * R) * Math.sin(b.lon * R), z = A * Math.sin(a.lat * R) + B * Math.sin(b.lat * R); return { lat: Math.atan2(z, Math.hypot(x, y)) / R, lon: Math.atan2(y, x) / R }; };
const tzMin = (tz: string, t: Date) => { try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(t).reduce((o: any, x) => (o[x.type] = x.value, o), {}); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - +t) / 6e4; } catch { return 0; } };

/** Seat sun picker (interactive upgrade of the existing Tools → "Sunny side of the plane"; NOT counted as new). */
export function SeatSun() { const [q, setQ] = useLS("sk.v60.sn", "FR557"); const [u, setU] = useState<string | null>(null); const [hr, setHr] = useState(9 * 60); const [side, setSide] = useLS<"L" | "R">("sk.v60.ss", "L"); const d = useApi(u);
  const res = useMemo(() => { if (!d?.o?.lat || !d?.t?.lat) return null; const km = hv(d.o, d.t), mins = km / 1.852 / 450 * 60 + 30; const now = new Date(); const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()); const off = tzMin(d.o.tz, now); const t0 = day + (hr - off) * 6e4;
    const S: ("L" | "R" | "n")[] = []; for (let f = 0.025; f < 1; f += 0.05) { const p = gp(d.o, d.t, f), q2 = gp(d.o, d.t, Math.min(1, f + 0.01)), h = bg(p, q2), s = sun(p.lat, p.lon, new Date(t0 + f * mins * 6e4)); S.push(s.el < 0 ? "n" : ((s.az - h + 360) % 360) > 180 ? "L" : "R"); }
    return { S, mins: Math.round(mins), km: Math.round(km), head: Math.round(bg(d.o, d.t)) }; }, [d, hr]);
  const day = res ? res.S.filter(x => x !== "n").length : 0, mine = res ? res.S.filter(x => x === side).length : 0;
  return <div className="card v59c"><h3>Seat sun picker</h3><div className="muted sm">Pick a flight, drag the take-off time, then tap a window side.</div>
    <div className="v59f"><In v={q} set={setQ} ph="Flight no." label="Flight number" /><button className="press" disabled={!q} onClick={() => setU(`/play/where?n=${q}`)}>Route</button></div>
    <St d={d} t="route" />{d && !d.error && (!d.o ? <div className="muted sm">Skyline hasn't logged a route for {d.n}. Try a UK or Irish departure.</div> : !res ? <div className="muted sm">Missing airport coordinates for this route.</div> : <>
      <div className="sm"><b>{d.o.iata} → {d.t.iata}</b> · {res.km} km · about {Math.floor(res.mins / 60)}h {res.mins % 60}m · heading {res.head}°</div>
      <label className="v59sl"><span>Take-off today at <b>{String(Math.floor(hr / 60)).padStart(2, "0")}:{String(hr % 60).padStart(2, "0")}</b> {d.o.iata} time</span><input type="range" min={0} max={1435} step={15} value={hr} onChange={e => setHr(+e.target.value)} aria-label="Take-off time" /></label>
      <div className="v59seg">{(["L", "R"] as const).map(k => <button key={k} className={side === k ? "on" : ""} aria-pressed={side === k} onClick={() => setSide(k)}>{k === "L" ? "Left window (A)" : "Right window (F/K)"}</button>)}</div>
      <div className="v59plane" role="img" aria-label="Sun along the flight">{res.S.map((x, i) => <span key={i} className={x === "n" ? "nt" : x === side ? "me" : "ot"} />)}</div>
      <div className={"v59big " + (!day ? "c-info" : mine * 2 >= day ? "c-warn" : "c-good")}>{!day ? "No sun" : `${Math.round(mine / day * 100)}%`}<small>{!day ? "It's dark for the whole flight at this time." : `of the sunny part, the sun is on your ${side === "L" ? "left" : "right"} side. ${mine * 2 >= day ? "Bring sunglasses ☀" : "Mostly shade 😎"}`}</small></div>
      <div className="faint xs mt8">Rule: the route is split into 20 slices along the great circle; for each, the sun's direction is compared with the plane's heading (sun left or right of the nose; dark slices skipped). Flight time = distance at 450 kt + 30 min. Skyline doesn't log take-off times, so you set it. Source: {d.source}; solar maths.</div></>)}</div>; }

/** D1 (non-smart). Flight-day bingo: tap squares, saved on the device. */
const BINGO = ["Someone claps on landing", "Seat belt sign pings", "Window seat", "See a cloud below you", "Hear the engines spool", "Gate change", "Snack trolley", "Bag on the belt first", "Spot a different airline", "Pilot says hello", "Tray table up!", "Someone asleep", "FREE", "Moving walkway", "Spot a jet bridge", "Duty-free smell", "Safety demo", "Bumpy bit", "Ears pop", "Wing view", "Boarding by group", "Kid waving at planes", "See the runway lights", "Fuel truck", "Plane taxiing past"];
export function Bingo() { const [on, setOn] = useLS<number[]>("sk.v60.bingo", [12]); const has = (i: number) => on.includes(i);
  const lines = [...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)), ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)), [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]].filter(l => l.every(has)).length;
  return <div className="card v59c"><h3>Flight-day bingo</h3><div className="muted sm">Tap a square when it happens. Get 5 in a row!</div>
    <div className="v59bingo">{BINGO.map((t, i) => <button key={i} className={has(i) ? "on" : ""} aria-pressed={has(i)} onClick={() => i !== 12 && setOn(o => o.includes(i) ? o.filter(x => x !== i) : [...o, i])}>{t}</button>)}</div>
    <div className="sm mt8">{lines ? <b className="good">BINGO × {lines}! 🎉</b> : `${on.length - 1} of 24 ticked`}</div><button className="v59link xs" onClick={() => setOn([12])}>New card</button></div>; }

/** D2 (non-smart). Airline memory match: flip cards to pair a code with its airline. */
export function Memory() { const d = useApi("/play/airlines"); const [seed, setSeed] = useState(1); const [open, setOpen] = useState<number[]>([]); const [done, setDone] = useState<string[]>([]); const [moves, setMoves] = useState(0); const [best, setBest] = useLS<number | null>("sk.v60.mem", null);
  const cards = useMemo(() => { const L = (d?.list || []).slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; } const P = L.slice(0, 6); const C = P.flatMap((a: any) => [{ k: a.code, t: a.code }, { k: a.code, t: a.name }]); for (let i = C.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [C[i], C[j]] = [C[j], C[i]]; } return C; }, [d, seed]);
  const tap = (i: number) => { if (open.length === 2 || open.includes(i) || done.includes(cards[i].k)) return; const o = [...open, i]; setOpen(o); if (o.length === 2) { setMoves(moves + 1); const hit = cards[o[0]].k === cards[o[1]].k; setTimeout(() => { if (hit) { const nd = [...done, cards[i].k]; setDone(nd); if (nd.length * 2 === cards.length && (best == null || moves + 1 < best)) setBest(moves + 1); } setOpen([]); }, hit ? 200 : 900); } };
  return <div className="card v59c"><h3>Airline memory match</h3><div className="muted sm">Flip two cards. Match each airline code with its name.</div>
    <St d={d} t="airlines" />{d && !d.error && (cards.length < 4 ? <div className="muted sm">Not enough airlines in the log yet.</div> : <>
      <div className="v59mem">{cards.map((c: any, i: number) => { const up = open.includes(i) || done.includes(c.k); return <button key={i} className={(up ? "up" : "") + (done.includes(c.k) ? " ok" : "")} aria-label={up ? c.t : "Hidden card"} onClick={() => tap(i)}>{up ? c.t : "✈"}</button>; })}</div>
      <div className="sm mt8">Moves <b>{moves}</b> · pairs {done.length}/{cards.length / 2}{best != null && <> · best <b>{best}</b></>}{done.length * 2 === cards.length && <b className="good"> · All matched! 🎉</b>}</div>
      <button className="v59link xs" onClick={() => { setSeed(seed + 1); setOpen([]); setDone([]); setMoves(0); }}>Shuffle new airlines</button><div className="faint xs">Airlines: {d.source}.</div></>)}</div>; }

/** D3 (non-smart). Trip countdowns you create yourself. */
export function Countdowns() { const [L, setL] = useLS<{ n: string; t: string }[]>("sk.v60.cd", []); const [n, setN] = useState(""); const [t, setT] = useState(""); const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const fmt = (ms: number) => { if (ms <= 0) return "It's here! 🎉"; const s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return `${dd}d ${h}h ${m}m ${s % 60}s`; };
  return <div className="card v59c"><h3>Trip countdowns</h3><div className="muted sm">Make your own countdowns: holidays, a trip to Gran's, anything.</div>
    <div className="v59f"><input value={n} maxLength={30} placeholder="Name e.g. Spain trip" aria-label="Countdown name" onChange={e => setN(e.target.value)} /></div>
    <div className="v59f"><input type="datetime-local" value={t} aria-label="Date and time" onChange={e => setT(e.target.value)} /><button className="press" disabled={!n.trim() || !t} onClick={() => { setL([...L, { n: n.trim(), t }].sort((a, b) => a.t.localeCompare(b.t))); setN(""); setT(""); }}>Add</button></div>
    {!L.length ? <div className="muted sm">No countdowns yet. Add one above.</div> : L.map((c, i) => <div key={i} className="v59r"><div><b>{c.n}</b> <small>{new Date(c.t).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div><em className="v59cd">{fmt(+new Date(c.t) - now)}</em><button className="v59x" aria-label={"Delete " + c.n} onClick={() => setL(L.filter((_, j) => j !== i))}>✕</button></div>)}
    <div className="faint xs mt8">Saved on this device only, in your phone's time.</div></div>; }

/** D4 (non-smart). Favourite routes board: save routes, tap one to see its flights. */
export function FavRoutes() { const [L, setL] = useLS<string[]>("sk.v60.fr", []); const [o, setO] = useState(""); const [t, setT] = useState(""); const [sel, setSel] = useState<string | null>(null); const d = useApi(sel ? `/play/route?o=${sel.slice(0, 3)}&t=${sel.slice(4)}` : null);
  return <div className="card v59c"><h3>Favourite routes</h3><div className="muted sm">Save the routes you like, then tap one to see its flights.</div>
    <div className="v59f"><In v={o} set={setO} ph="From" n={3} label="From" /><span className="muted">→</span><In v={t} set={setT} ph="To" n={3} label="To" /><button className="press" disabled={o.length < 3 || t.length < 3 || L.includes(o + "-" + t)} onClick={() => { setL([...L, o + "-" + t]); setO(""); setT(""); }}>Save</button></div>
    {!L.length ? <div className="muted sm">No favourite routes yet. Try MAN → DUB.</div> : <div className="v59chips">{L.map(r => <span key={r} className="v59fav"><button className={sel === r ? "on" : ""} aria-pressed={sel === r} onClick={() => setSel(sel === r ? null : r)}>★ {r.replace("-", " → ")}</button><button className="v59x" aria-label={"Remove " + r} onClick={() => { setL(L.filter(x => x !== r)); if (sel === r) setSel(null); }}>✕</button></span>)}</div>}
    {sel && <><St d={d} t="route" />{d && !d.error && (!d.list.length ? <div className="muted sm mt8">No flight on {sel.replace("-", " → ")} has been logged on 2+ days yet.</div> : d.list.slice(0, 8).map((x: any) => <div key={x.n} className="v59r"><div><b>{x.n}</b> <small>{x.days} days logged</small></div><span className={"c-" + tone(x.on)}>{x.on ?? "—"}%</span></div>))}{d?.source && <div className="faint xs mt8">On time = under 15 min late. Source: {d.source}.</div>}</>}</div>; }

/** D5 (non-smart). Runway number dial: drag a heading, see the runway name painted on the ground. */
export function RunwayDial() { const [h, setH] = useState(233); const n = (x: number) => { const r = Math.round(((x % 360) + 360) % 360 / 10) || 36; return String(r).padStart(2, "0"); }; const a = n(h), b = n(h + 180);
  return <div className="card v59c"><h3>Runway number dial</h3><div className="muted sm">Drag to point the runway. Its number is the compass heading ÷ 10, and the other end is 180° round.</div>
    <div className="v59rwy"><div className="dial" style={{ transform: `rotate(${h}deg)` }}><div className="strip"><b>{a}</b><b className="far">{b}</b></div></div><span className="N">N</span></div>
    <label className="v59sl"><span>Heading <b>{h}°</b> → runway <b>{a}</b> / <b>{b}</b></span><input type="range" min={0} max={359} value={h} onChange={e => setH(+e.target.value)} aria-label="Runway heading" /></label>
    <div className="v59chips">{[["MAN", 233], ["LHR", 272], ["DUB", 280], ["STN", 224]].map(([k, v]) => <button key={k} className={h === v ? "on" : ""} onClick={() => setH(v as number)}>{k} ~{v}°</button>)}</div>
    <div className="faint xs mt8">Uses magnetic heading rounded to the nearest 10°. Example headings are approximate. Twin runways add L / C / R.</div></div>; }
