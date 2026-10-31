// v61 — Play & Plan Stage C (features 22–31). Smart = rule/statistical over real logs, each prints its rule. Device-only saves.
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib";
import { useApi, Rule, St, useLS, U, tone, In } from "./v59";

const stats = (L: any[]) => { const v = L.filter(r => r.s !== "cancelled" && typeof r.d === "number").map(r => r.d).sort((a, b) => a - b);
  return { n: L.length, on: v.length ? Math.round(v.filter(d => d < 15).length / v.length * 100) : null, med: v.length ? v[Math.floor(v.length / 2)] : null, worst: v.length ? v[v.length - 1] : null, cx: L.length ? Math.round(L.filter(r => r.s === "cancelled").length / L.length * 100) : null }; };
const SRC = "Skyline's multi-day flight log (official airport boards)";

/** D1 (smart). Compare two flight numbers — swipe (or tap arrows) through metric cards; winner chosen by a printed rule. */
const MET: [string, string, (s: any) => number | null, 1 | -1, string][] = [["on", "On-time share", s => s.on, 1, "%"], ["med", "Typical delay", s => s.med, -1, " min"], ["worst", "Worst delay", s => s.worst, -1, " min"], ["cx", "Cancelled", s => s.cx, -1, "%"], ["n", "Days logged", s => s.n, 1, ""]];
export function FlightSwiper() { const [a, setA] = useLS("sk.v61.sa", "FR3222"); const [b, setB] = useLS("sk.v61.sb", "FR3187"); const [go, setGo] = useState(0); const [i, setI] = useState(0); const x0 = useRef<number | null>(null);
  const A = useApi(go ? `/play/delays?n=${a}&g=${go}` : null), B = useApi(go ? `/play/delays?n=${b}&g=${go}` : null);
  const sa = A?.list ? stats(A.list) : null, sb = B?.list ? stats(B.list) : null; const m = MET[i];
  const va = sa && m[2](sa), vb = sb && m[2](sb); const win = va == null || vb == null || va === vb ? null : (va - vb) * m[3] > 0 ? a : b;
  const score = sa && sb ? MET.slice(0, 4).reduce((t, M) => { const p = M[2](sa), q = M[2](sb); return p == null || q == null || p === q ? t : t + ((p - q) * M[3] > 0 ? 1 : -1); }, 0) : 0;
  const mv = (d: number) => setI(k => (k + d + MET.length) % MET.length);
  return <div className="card v59c"><h3>Flight vs flight swiper</h3><div className="muted sm">Two flight numbers, one stat at a time. Swipe the card or tap the arrows.</div>
    <div className="v59r v61r mt8"><In v={a} set={setA} ph="FR3222" label="First flight" /><In v={b} set={setB} ph="FR3187" label="Second flight" /><button className="press" onClick={() => { setGo(g => g + 1); setI(0); }}>Compare</button></div>
    {go ? <St d={A} t="first flight" /> : null}
    {sa && sb ? (sa.n && sb.n ? <><div className="v61sw mt8" onTouchStart={e => (x0.current = e.touches[0].clientX)} onTouchEnd={e => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; if (Math.abs(dx) > 40) mv(dx < 0 ? 1 : -1); x0.current = null; }}>
        <button className="press" aria-label="Previous stat" onClick={() => mv(-1)}>‹</button>
        <div className="v61swc"><div className="muted xs">{i + 1} / {MET.length}</div><b>{m[1]}</b><div className="v61two"><div className={win === a ? "good" : ""}><span className="v59big">{va ?? "—"}{va != null ? m[4] : ""}</span><div className="xs">{a}</div></div><div className={win === b ? "good" : ""}><span className="v59big">{vb ?? "—"}{vb != null ? m[4] : ""}</span><div className="xs">{b}</div></div></div><div className="sm">{win ? `${win} wins this one` : "Tie / not enough data"}</div></div>
        <button className="press" aria-label="Next stat" onClick={() => mv(1)}>›</button></div>
      <div className="v59dots">{MET.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
      <div className="sm mt8"><b>Overall: {score > 0 ? `${a} looks more reliable` : score < 0 ? `${b} looks more reliable` : "too close to call"}</b> ({sa.n} vs {sb.n} logged days)</div></> : <div className="muted sm mt8">One of these flights isn't in the log yet — try another number.</div>) : null}
    <Rule d={{ rule: "Each card compares one stat from all logged days. On time = left under 15 min late. Overall = +1 for each of the first four cards a flight wins, −1 for each it loses; days logged is shown but not scored.", source: SRC }} /></div>; }

/** D2 (smart). Multi-leg trip risk — add legs; chance every leg leaves on time = product of each leg's logged on-time share. */
export function LegRisk() { const [L, setL] = useLS<string[]>("sk.v61.legs", ["FR3222"]); const [q, setQ] = useState(""); const [R, setR] = useState<Record<string, any>>({}); const [th, setTh] = useState(15);
  useEffect(() => { L.filter(n => !R[n]).forEach(n => api(`/play/delays?n=${n}`).then(j => setR(o => ({ ...o, [n]: j }))).catch(() => setR(o => ({ ...o, [n]: { error: 1 } })))); }, [L]);
  const P = L.map(n => { const l = R[n]?.list; if (!l) return { n, p: null, k: 0 }; const v = l.filter((r: any) => r.s !== "cancelled" && typeof r.d === "number"); return { n, k: l.length, p: l.length ? v.filter((r: any) => r.d < th).length / l.length : null }; });
  const ready = P.length && P.every(x => x.p != null); const all = ready ? P.reduce((t, x) => t * (x.p as number), 1) : null;
  return <div className="card v59c"><h3>Multi-leg trip risk</h3><div className="muted sm">Add each flight of a trip. See how the chance of a smooth day shrinks with every leg.</div>
    <div className="v59r v61r mt8"><In v={q} set={setQ} ph="EJU5419" label="Add a flight" /><button className="press" disabled={!q || L.length >= 6} onClick={() => { const n = U(q); if (n && !L.includes(n)) setL([...L, n]); setQ(""); }}>Add leg</button></div>
    <label className="sm mt8 v59sl">"On time" means under <b>{th} min</b> late<input type="range" min={5} max={60} step={5} value={th} aria-label="On-time threshold" onChange={e => setTh(+e.target.value)} /></label>
    {L.map((n, k) => { const x = P[k]; return <div key={n} className="v59fo mt8"><span>Leg {k + 1}: <b>{n}</b></span><span className={x.p == null ? "muted" : tone(Math.round(x.p * 100))}>{R[n] ? (x.k ? `${Math.round((x.p as number) * 100)}% (${x.k} days)` : "not in log") : "…"}</span><button className="v59x" aria-label={`Remove ${n}`} onClick={() => setL(L.filter(y => y !== n))}>×</button></div>; })}
    {!L.length ? <div className="muted sm mt8">No legs yet — add one above.</div> : null}
    {all != null ? <div className="mt8"><span className={`v59big ${tone(Math.round(all * 100))}`}>{Math.round(all * 100)}%</span> <span className="sm">chance every leg leaves on time</span></div> : null}
    <Rule d={{ rule: "Each leg's chance = logged days it left under the threshold ÷ all logged days (cancellations count as not on time). Whole trip = the legs' chances multiplied together, which assumes the legs don't affect each other — in real life a late first leg can make the next one late too, so treat it as a best case.", source: SRC }} /></div>; }

/** D3 (smart). Call-home planner — drag your local hour; shows who is awake using a printed 08:00–22:00 rule. */
const ZONES: [string, string][] = [["London", "Europe/London"], ["Dublin", "Europe/Dublin"], ["Warsaw", "Europe/Warsaw"], ["Athens", "Europe/Athens"], ["Dubai", "Asia/Dubai"], ["New Delhi", "Asia/Kolkata"], ["Bangkok", "Asia/Bangkok"], ["Tokyo", "Asia/Tokyo"], ["Sydney", "Australia/Sydney"], ["New York", "America/New_York"], ["Chicago", "America/Chicago"], ["Los Angeles", "America/Los_Angeles"], ["São Paulo", "America/Sao_Paulo"]];
const offMin = (tz: string, d: Date) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map(x => [x.type, x.value])); return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime()) / 60000); };
export function CallPlanner() { const [me, setMe] = useLS("sk.v61.tzme", "Europe/London"); const [them, setThem] = useLS<string[]>("sk.v61.tzs", ["America/New_York", "Asia/Tokyo"]); const [h, setH] = useState(18);
  const now = new Date(); const base = offMin(me, now); const at = (tz: string, hh: number) => ((hh * 60 + offMin(tz, now) - base) % 1440 + 1440) % 1440; const awake = (m: number) => m >= 480 && m < 1320;
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; const all = [me, ...them];
  const good = Array.from({ length: 24 }, (_, k) => all.every(tz => awake(at(tz, k))));
  return <div className="card v59c"><h3>Call-home planner</h3><div className="muted sm">Pick places, then drag the time. Green = everyone is awake.</div>
    <label className="sm mt8 v59sl">I'm in <select aria-label="My zone" value={me} onChange={e => setMe(e.target.value)}>{ZONES.map(([c, z]) => <option key={z} value={z}>{c}</option>)}</select></label>
    <div className="v59chips mt8">{ZONES.filter(([, z]) => z !== me).map(([c, z]) => <button key={z} className={them.includes(z) ? "on" : ""} aria-pressed={them.includes(z)} onClick={() => setThem(them.includes(z) ? them.filter(y => y !== z) : [...them, z].slice(-4))}>{c}</button>)}</div>
    <label className="sm mt8 v59sl">My time: <b>{fmt(h * 60)}</b><input type="range" min={0} max={23} value={h} aria-label="My hour" onChange={e => setH(+e.target.value)} /></label>
    <div className="v61hrs" aria-label="Hours when everyone is awake">{good.map((g, k) => <button key={k} className={(g ? "g" : "") + (k === h ? " on" : "")} aria-label={`${k}:00 ${g ? "everyone awake" : "someone asleep"}`} onClick={() => setH(k)}>{k % 6 === 0 ? k : ""}</button>)}</div>
    {all.map(tz => { const m = at(tz, h); return <div key={tz} className="v59fo mt8"><span>{ZONES.find(z => z[1] === tz)?.[0]}</span><span className={awake(m) ? "good" : "bad"}>{fmt(m)} {awake(m) ? "awake" : "probably asleep"}</span></div>; })}
    <div className="sm mt8">{good.some(Boolean) ? `Best hours for you: ${good.map((g, k) => g ? k : -1).filter(k => k >= 0).map(k => fmt(k * 60)).join(", ")}` : "No hour works for everyone — someone will need to stay up!"}</div>
    <Rule d={{ rule: "Awake = 08:00 to 21:59 local time for every place you picked. Times use today's real time-zone offsets (including summer time) from your browser's time-zone database.", source: "IANA time-zone database via your browser" }} /></div>; }

/** D4 (smart). Airport twins — nearest-neighbour on on-time share, median delay and 60+ share. */
export function AirportTwins() { const [a, setA] = useLS("sk.v61.tw", "LHR"); const [go, setGo] = useState(1); const d = useApi(go ? `/play/twins?a=${a}&g=${go}` : null); const [k, setK] = useState(3);
  return <div className="card v59c"><h3>Airport twin finder</h3><div className="muted sm">Which airport behaves most like yours? Tap a twin to see why.</div>
    <div className="v59r v61r mt8"><In v={a} set={setA} ph="LHR" n={3} label="Airport code" /><button className="press" onClick={() => setGo(g => g + 1)}>Find twins</button></div>
    <St d={d} t="airport twins" />{d && !d.error ? (d.me ? <><div className="sm mt8"><b>{d.me.city} ({d.a})</b>: {d.me.on}% on time · typical {d.me.median} min · {d.me.big}% 60+ late · {d.me.n} departures</div>
      <label className="sm mt8 v59sl">Show <b>{k}</b> twins<input type="range" min={1} max={8} value={k} aria-label="How many twins" onChange={e => setK(+e.target.value)} /></label>
      <TwinList L={d.list.slice(0, k)} me={d.me} /></> : <div className="muted sm mt8">{d.a || "That airport"} needs 50+ logged departures ({d.pool} airports qualify). Try MAN, STN, LHR or DUB.</div>) : null}
    {d?.rule ? <Rule d={d} /> : null}</div>; }
function TwinList({ L, me }: any) { const [o, setO] = useState<string | null>(null);
  return <>{L.map((x: any, i: number) => <div key={x.k}><button className="v59fo press mt8" style={{ width: "100%" }} aria-expanded={o === x.k} onClick={() => setO(o === x.k ? null : x.k)}><span>#{i + 1} {x.city} ({x.k})</span><span className="muted">score {x.dist}</span></button>
    {o === x.k ? <div className="xs mt8">On time {x.on}% vs {me.on}% · typical {x.median} vs {me.median} min · 60+ late {x.big}% vs {me.big}% · {x.n} departures</div> : null}</div>)}</>; }

/** D5 (smart). Delay detective — tap a day: was it the flight or the whole airport? */
export function DelayDetective() { const [n, setN] = useLS("sk.v61.dd", "FR3222"); const [go, setGo] = useState(1); const d = useApi(go ? `/play/chain?n=${n}&g=${go}` : null); const [sel, setSel] = useState<number | null>(null);
  const L = (d?.list || []).filter((r: any) => r.d != null && r.apMed != null); const verdict = (r: any) => r.d - r.apMed >= 15 ? ["The flight's own problem", "bad"] : r.d - r.apMed <= -15 ? ["Beat the airport", "good"] : ["The whole airport was like that", "warn"];
  const own = L.filter((r: any) => r.d - r.apMed >= 15).length; const mx = Math.max(30, ...L.map((r: any) => Math.max(r.d, r.apMed)));
  return <div className="card v59c"><h3>Delay detective</h3><div className="muted sm">Each pair of bars is one day: the flight vs its airport's typical delay. Tap a day.</div>
    <div className="v59r v61r mt8"><In v={n} set={setN} ph="FR3222" label="Flight number" /><button className="press" onClick={() => { setGo(g => g + 1); setSel(null); }}>Investigate</button></div>
    <St d={d} t="the case file" />{d && !d.error ? (L.length ? <><div className="v61bars mt8">{L.map((r: any, i: number) => <button key={r.date} className={sel === i ? "on" : ""} aria-label={`${r.date}: flight ${r.d} min, airport ${r.apMed} min`} onClick={() => setSel(i)}><i style={{ height: `${Math.max(2, r.d / mx * 100)}%` }} className="f" /><i style={{ height: `${Math.max(2, r.apMed / mx * 100)}%` }} className="a" /><span>{r.date.slice(8)}</span></button>)}</div>
      <div className="xs muted">Dark = {d.n} · light = everything leaving {L[0].o} that day</div>
      {sel != null && L[sel] ? <div className="sm mt8"><b>{L[sel].date}</b>: {d.n} left {L[sel].d} min late; {L[sel].o}'s typical delay was {L[sel].apMed} min ({L[sel].apN} flights). Verdict: <b className={verdict(L[sel])[1]}>{verdict(L[sel])[0]}</b></div> : <div className="muted sm mt8">Tap a day to get a verdict.</div>}
      <div className="sm mt8">Its own fault on <b>{own}</b> of {L.length} days.</div></> : <div className="muted sm mt8">No logged days with a delay for {d.n} yet. Try FR3222 or EJU5419.</div>) : null}
    {d?.rule ? <Rule d={d} /> : null}</div>; }

/** E1 (non-smart). Route explorer — tap an airport dot to draw its logged routes. */
function useNet() { return useApi("/play/net"); }
function proj(aps: any[]) { const la = aps.map(a => a.lat), lo = aps.map(a => a.lon); const [a0, a1, o0, o1] = [Math.min(...la) - 1, Math.max(...la) + 1, Math.min(...lo) - 1, Math.max(...lo) + 1]; const k = Math.cos((a0 + a1) / 2 * Math.PI / 180); const W = (o1 - o0) * k, H = a1 - a0; return { W, H, p: (a: any) => [(a.lon - o0) * k, a1 - a.lat] }; }
export function RouteMap() { const d = useNet(); const [s, setS] = useLS<string | null>("sk.v61.rm", "MAN"); const [min, setMin] = useState(1);
  const P = useMemo(() => d?.aps?.length ? proj(d.aps) : null, [d]); const by = useMemo(() => Object.fromEntries((d?.aps || []).map((a: any) => [a.k, a])), [d]);
  const R = (d?.routes || []).filter((r: any) => (r[0] === s || r[1] === s) && r[2] >= min); const dest = [...new Set(R.map((r: any) => r[0] === s ? r[1] : r[0]))] as string[];
  return <div className="card v59c"><h3>Route explorer map</h3><div className="muted sm">Tap a dot to see where you can fly from there (routes seen in the log).</div>
    <St d={d} t="the map" />{P ? <><svg className="v61map mt8" viewBox={`-1 -1 ${P.W + 2} ${P.H + 2}`} role="img" aria-label="Map of logged airports">
      {R.map((r: any) => { const [x1, y1] = P.p(by[r[0]]), [x2, y2] = P.p(by[r[1]]); return <line key={r[0] + r[1]} x1={x1} y1={y1} x2={x2} y2={y2} className="ln" style={{ strokeWidth: Math.min(0.5, 0.1 + r[2] / 200) }} />; })}
      {d.aps.map((a: any) => { const [x, y] = P.p(a); return <circle key={a.k} cx={x} cy={y} r={a.k === s ? 0.9 : dest.includes(a.k) ? 0.6 : 0.4} className={a.k === s ? "me" : dest.includes(a.k) ? "to" : ""} onClick={() => setS(a.k)} role="button" aria-label={`${a.city} ${a.k}`} />; })}</svg>
      <label className="sm v59sl">Only routes seen <b>{min}+</b> times<input type="range" min={1} max={30} value={min} aria-label="Minimum times seen" onChange={e => setMin(+e.target.value)} /></label>
      {s && by[s] ? <div className="sm mt8"><b>{by[s].city} ({s})</b> — {dest.length} connected airports{dest.length ? ": " : ""}<span className="xs">{dest.slice(0, 20).map(k => <button key={k} className="v59link v61k" onClick={() => setS(k)}>{k}</button>)}{dest.length > 20 ? `+${dest.length - 20} more` : ""}</span></div> : <div className="muted sm mt8">Tap any dot.</div>}</> : null}
    <div className="faint xs mt8">Shows the {d?.aps?.length || 0} busiest airports in the log. Source: {d?.source || SRC}.</div></div>; }

/** E2 (non-smart). Airport map quiz — find the named airport among the dots. */
export function MapQuiz() { const d = useNet(); const [q, setQ] = useState<any>(null); const [pick, setPick] = useState<string | null>(null); const [S, setS] = useLS("sk.v61.mq", { r: 0, n: 0, best: 0, st: 0 });
  const P = useMemo(() => d?.aps?.length ? proj(d.aps) : null, [d]);
  const next = () => { if (!d?.aps?.length) return; const pool = d.aps.filter((a: any) => a.city); const c = [...pool].sort(() => Math.random() - 0.5).slice(0, 5); setQ({ opts: c, ans: c[Math.floor(Math.random() * c.length)] }); setPick(null); };
  useEffect(() => { if (d?.aps && !q) next(); }, [d]);
  const tap = (k: string) => { if (pick) return; setPick(k); const ok = k === q.ans.k; setS(s => { const st = ok ? s.st + 1 : 0; return { r: s.r + (ok ? 1 : 0), n: s.n + 1, st, best: Math.max(s.best, st) }; }); };
  return <div className="card v59c"><h3>Airport map quiz</h3><div className="muted sm">Five airports light up. Tap the one that is <b>{q ? `${q.ans.city} (${q.ans.k})` : "…"}</b>.</div>
    <St d={d} t="the map" />{P && q ? <><svg className="v61map mt8" viewBox={`-1 -1 ${P.W + 2} ${P.H + 2}`} role="img" aria-label="Quiz map">
      {d.aps.map((a: any) => { const [x, y] = P.p(a); return <circle key={a.k} cx={x} cy={y} r={0.25} className="dim" />; })}
      {q.opts.map((a: any) => { const [x, y] = P.p(a); const c = pick ? (a.k === q.ans.k ? "ok" : a.k === pick ? "no" : "") : "q"; return <g key={a.k}><circle cx={x} cy={y} r={1.1} className={c} onClick={() => tap(a.k)} role="button" aria-label={pick ? a.city : "Mystery airport"} />{pick ? <text x={x + 1.3} y={y + 0.4} className="lb">{a.k}</text> : null}</g>; })}</svg>
      {pick ? <div className="sm mt8"><b className={pick === q.ans.k ? "good" : "bad"}>{pick === q.ans.k ? "Correct!" : `Not quite — that was ${q.opts.find((a: any) => a.k === pick)?.city}.`}</b> <button className="press" onClick={next}>Next</button></div> : null}
      <div className="xs muted mt8">Score {S.r}/{S.n} · streak {S.st} · best {S.best} <button className="v59link" onClick={() => setS({ r: 0, n: 0, best: 0, st: 0 })}>reset</button></div></> : null}
    <div className="faint xs mt8">Airport positions: OpenFlights coordinates for airports in Skyline's log.</div></div>; }

/** E3 (non-smart). Daily challenge — three questions, same for everyone today; one try a day. */
export function DailyChallenge() { const d = useApi("/play/daily"); const [A, setA] = useLS<Record<string, string[]>>("sk.v61.daily", {}); const [S, setS] = useLS("sk.v61.dstreak", { last: "", st: 0, best: 0 });
  const day = d?.day; const mine: string[] = (day && A[day]) || []; const done = d?.qs && mine.filter(Boolean).length === d.qs.length; const right = d?.qs ? mine.filter((k: string, i: number) => d.qs[i]?.ans === k).length : 0;
  const ans = (i: number, k: string) => { if (mine[i] || !day) return; const m = [...mine]; m[i] = k; setA({ ...Object.fromEntries(Object.entries(A).slice(-13)), [day]: m });
    if (m.filter(Boolean).length === d.qs.length) { const y = new Date(Date.parse(day) - 864e5).toISOString().slice(0, 10); setS(s => s.last === day ? s : { last: day, st: s.last === y ? s.st + 1 : 1, best: Math.max(s.best, s.last === y ? s.st + 1 : 1) }); } };
  const unit = (k: string) => k === "on" ? "% on time" : k === "median" ? " min typical" : " departures";
  return <div className="card v59c"><h3>Daily challenge</h3><div className="muted sm">Three questions from the real log — everyone gets the same ones today. One go each!</div>
    <St d={d} t="today's challenge" />{d?.qs?.length ? d.qs.map((q: any, i: number) => <div key={i} className="mt8"><div className="sm"><b>{i + 1}. {q.q}</b></div><div className="v59chips">{q.opts.map((o: any) => { const c = mine[i] ? (o.k === q.ans ? "ok" : o.k === mine[i] ? "no" : "") : ""; return <button key={o.k} className={c} disabled={!!mine[i] || (i > 0 && !mine[i - 1])} onClick={() => ans(i, o.k)}>{o.city} ({o.k}){mine[i] ? ` · ${o.v}${unit(q.k)}` : ""}</button>; })}</div></div>) : d && !d.error ? <div className="muted sm mt8">Not enough airports in the log for a challenge today.</div> : null}
    {done ? <div className="sm mt8"><b>{right}/{d.qs.length} today!</b> Come back tomorrow for new questions. Streak {S.st} day{S.st === 1 ? "" : "s"} · best {S.best}</div> : null}
    <div className="faint xs mt8">Day {day || "…"} (UTC). Numbers are from {SRC}.</div></div>; }

/** Real published manufacturer specs (length / wingspan in metres, first flight). */
const AC: { k: string; m: string; len: number; span: number; eng: string; ff: number }[] = [
  { k: "ATR 72-600", m: "ATR", len: 27.17, span: 27.05, eng: "2 propellers", ff: 2009 }, { k: "Embraer E190", m: "Embraer", len: 36.24, span: 28.72, eng: "2 jets", ff: 2004 },
  { k: "Airbus A220-300", m: "Airbus", len: 38.7, span: 35.1, eng: "2 jets", ff: 2015 }, { k: "Airbus A320neo", m: "Airbus", len: 37.57, span: 35.8, eng: "2 jets", ff: 2014 },
  { k: "Airbus A321neo", m: "Airbus", len: 44.51, span: 35.8, eng: "2 jets", ff: 2016 }, { k: "Boeing 737-800", m: "Boeing", len: 39.47, span: 35.79, eng: "2 jets", ff: 1997 },
  { k: "Boeing 737 MAX 8", m: "Boeing", len: 39.52, span: 35.92, eng: "2 jets", ff: 2016 }, { k: "Airbus A330-300", m: "Airbus", len: 63.66, span: 60.3, eng: "2 jets", ff: 1992 },
  { k: "Boeing 787-9", m: "Boeing", len: 62.81, span: 60.12, eng: "2 jets", ff: 2013 }, { k: "Airbus A350-900", m: "Airbus", len: 66.8, span: 64.75, eng: "2 jets", ff: 2013 },
  { k: "Boeing 777-300ER", m: "Boeing", len: 73.86, span: 64.8, eng: "2 jets", ff: 2003 }, { k: "Airbus A380", m: "Airbus", len: 72.72, span: 79.75, eng: "4 jets", ff: 2005 }];
const ACSRC = "Airbus, Boeing, Embraer and ATR published aircraft specifications";
const Plane = ({ a, s, c }: { a: typeof AC[0]; s: number; c: string }) => { const L = a.len * s, W = a.span * s; return <g className={c}><rect x={-L / 2} y={-L * 0.045} width={L} height={L * 0.09} rx={L * 0.045} /><polygon points={`${-L * 0.05},0 ${L * 0.08},${-W / 2} ${L * 0.15},${-W / 2} ${L * 0.12},0 ${L * 0.15},${W / 2} ${L * 0.08},${W / 2}`} /><polygon points={`${-L * 0.43},0 ${-L * 0.38},${-W * 0.17} ${-L * 0.34},${-W * 0.17} ${-L * 0.36},0 ${-L * 0.34},${W * 0.17} ${-L * 0.38},${W * 0.17}`} /></g>; };

/** E4 (non-smart). Aircraft size compare — pick two types and overlay them to scale. */
export function SizeCompare() { const [a, setA] = useLS("sk.v61.za", "Boeing 737-800"); const [b, setB] = useLS("sk.v61.zb", "Airbus A380"); const [lay, setLay] = useState(true);
  const A = AC.find(x => x.k === a) || AC[5], B = AC.find(x => x.k === b) || AC[11]; const s = 90 / Math.max(A.len, A.span, B.len, B.span);
  return <div className="card v59c"><h3>Aircraft size compare</h3><div className="muted sm">Pick two planes and see them side by side, to scale (seen from above).</div>
    <div className="v59r v61r mt8">{([[a, setA, "First plane"], [b, setB, "Second plane"]] as const).map(([v, set, l]) => <select key={l} aria-label={l} value={v} onChange={e => set(e.target.value)}>{AC.map(x => <option key={x.k}>{x.k}</option>)}</select>)}</div>
    <div className="v59seg mt8"><button className={lay ? "on" : ""} onClick={() => setLay(true)}>On top</button><button className={!lay ? "on" : ""} onClick={() => setLay(false)}>Side by side</button></div>
    <svg className="v61ac mt8" viewBox={lay ? "-50 -50 100 100" : "-50 -50 200 100"} role="img" aria-label={`${A.k} and ${B.k} to scale`}><Plane a={B} s={s} c="pb" /><g transform={lay ? "" : "translate(100 0)"}><Plane a={A} s={s} c="pa" /></g></svg>
    <div className="v59fo"><span className="pa-t">■ {A.k}</span><span>{A.len} m long · {A.span} m wide</span></div><div className="v59fo"><span className="pb-t">■ {B.k}</span><span>{B.len} m long · {B.span} m wide</span></div>
    <div className="sm mt8">The {A.len > B.len ? A.k : B.k} is <b>{Math.abs(A.len - B.len).toFixed(1)} m</b> longer — about {Math.round(Math.abs(A.len - B.len) / 4.5)} cars nose to tail.</div>
    <div className="faint xs mt8">Source: {ACSRC}. Outlines are simple shapes, not exact drawings.</div></div>; }

/** E5 (non-smart). Aircraft-type guessing game — reveal clues one by one; fewer clues = more points. */
export function TypeGuess() { const mk = () => { const a = AC[Math.floor(Math.random() * AC.length)]; const o = [a, ...AC.filter(x => x !== a).sort(() => Math.random() - 0.5).slice(0, 3)].sort(() => Math.random() - 0.5); return { a, o }; };
  const [g, setG] = useState(mk); const [c, setC] = useState(1); const [p, setP] = useState<string | null>(null); const [S, setS] = useLS("sk.v61.tg", { pts: 0, n: 0 });
  const clues = [`Engines: ${g.a.eng}`, `Wingspan: ${g.a.span} m`, `First flew: ${g.a.ff}`, `Length: ${g.a.len} m`, `Made by: ${g.a.m}`];
  const pick = (k: string) => { if (p) return; setP(k); setS(s => ({ pts: s.pts + (k === g.a.k ? 6 - c : 0), n: s.n + 1 })); };
  return <div className="card v59c"><h3>Guess the plane</h3><div className="muted sm">Reveal clues one at a time. Guess early for more points!</div>
    <ul className="sm mt8">{clues.slice(0, p ? 5 : c).map(x => <li key={x}>{x}</li>)}</ul>
    {!p && c < 5 ? <button className="press" onClick={() => setC(c + 1)}>Another clue ({5 - c} left)</button> : null}
    <div className="v59chips mt8">{g.o.map(x => <button key={x.k} className={p ? (x.k === g.a.k ? "ok" : x.k === p ? "no" : "") : ""} disabled={!!p} onClick={() => pick(x.k)}>{x.k}</button>)}</div>
    {p ? <div className="sm mt8"><b className={p === g.a.k ? "good" : "bad"}>{p === g.a.k ? `Yes! +${6 - c} points` : `It was the ${g.a.k}.`}</b> <button className="press" onClick={() => { setG(mk()); setC(1); setP(null); }}>Next plane</button></div> : null}
    <div className="xs muted mt8">{S.pts} points from {S.n} planes <button className="v59link" onClick={() => setS({ pts: 0, n: 0 })}>reset</button></div>
    <div className="faint xs mt8">Source: {ACSRC}.</div></div>; }
