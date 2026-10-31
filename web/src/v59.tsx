// v59 — Play & Plan (Stage A of the interactive program). Smart = rule/statistical over Skyline's real logs; each prints its rule.
// Non-smart = interactive tools and games. Everything saves to this device only (localStorage).
import { useEffect, useMemo, useState } from "react";
import { api } from "./lib";
import "./v59.css";

function useApi(u: string | null) { const [d, setD] = useState<any>(null); useEffect(() => { if (!u) { setD(null); return; } let on = true; setD(undefined); api(u).then(r => on && setD(r)).catch(e => on && setD({ error: e.message })); return () => { on = false; }; }, [u]); return d; }
const Rule = ({ d }: { d: any }) => <div className="faint xs mt8">Rule: {d.rule} Source: {d.source}.</div>;
const St = ({ d, t }: { d: any; t: string }) => d === undefined ? <div className="muted sm mt8">Loading {t}…</div> : d?.error ? <div className="bad sm mt8">Couldn't load {t} ({d.error}).</div> : null;
const ls = <T,>(k: string, v: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") ?? v; } catch { return v; } };
function useLS<T>(k: string, v: T) { const [s, set] = useState<T>(() => ls(k, v)); useEffect(() => { localStorage.setItem(k, JSON.stringify(s)); }, [k, s]); return [s, set] as const; }
const U = (s: string, n = 8) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, n);
const tone = (on: number | null) => on == null ? "info" : on >= 75 ? "good" : on >= 55 ? "warn" : "bad";
const In = (p: { v: string; set: (s: string) => void; ph: string; n?: number; label: string }) => <input value={p.v} maxLength={p.n || 8} placeholder={p.ph} aria-label={p.label} onChange={e => p.set(U(e.target.value, p.n))} />;

/** A1 (smart). Late-o-meter: drag how late is OK, see how often this flight made it. */
export function LateOMeter() { const [q, setQ] = useState("FR557"); const [u, setU] = useState<string | null>(null); const [m, setM] = useState(15); const d = useApi(u);
  const T = d?.list?.filter((r: any) => r.d != null) || []; const ok = T.filter((r: any) => r.d <= m).length; const den = d ? d.list.length : 0; const p = den ? Math.round(ok / den * 100) : null;
  return <div className="card v59c"><h3>Late-o-meter</h3><div className="muted sm">Drag the slider: how late is OK for you?</div>
    <div className="v59f"><In v={q} set={setQ} ph="Flight no." label="Flight number" /><button className="press" disabled={!q} onClick={() => setU(`/play/delays?n=${q}`)}>Check</button></div>
    <St d={d} t="history" />{d && !d.error && (!d.list.length ? <div className="muted sm">Skyline hasn't logged {d.n} yet. Try one that leaves a UK airport often (e.g. FR557, EI209).</div> : <>
      <label className="v59sl"><span>OK if up to <b>{m} min</b> late</span><input type="range" min={0} max={120} step={5} value={m} onChange={e => setM(+e.target.value)} aria-label="Minutes late that is OK" /></label>
      <div className={"v59big c-" + tone(p)}>{p}%<small> of {den} logged days ({ok} made it{d.cancelled ? `, ${d.cancelled} cancelled` : ""})</small></div>
      <div className="v59dots" role="img" aria-label="Each logged day">{d.list.map((r: any) => <span key={r.date} title={`${r.date}: ${r.d == null ? r.s : r.d + " min"}`} className={r.d == null ? "x" : r.d <= m ? "y" : "n"}><i>{r.date.slice(8)}</i><b>{r.d == null ? "✕" : r.d}</b></span>)}</div>
      {den < 5 && <div className="warn xs mt8">Only {den} days logged: treat this as a hint, not odds.</div>}<Rule d={d} /></>)}</div>; }

/** A2 (smart). Route picker: tap to sort flight numbers on a route. */
export function RoutePicker() { const [o, setO] = useState("MAN"); const [t, setT] = useState("DUB"); const [u, setU] = useState<string | null>(null); const [s, setS] = useState<"on" | "median" | "days">("on"); const d = useApi(u);
  const L = useMemo(() => d?.list ? [...d.list].sort((a: any, b: any) => s === "median" ? (a.median ?? 999) - (b.median ?? 999) : s === "days" ? b.days - a.days : (b.on ?? -1) - (a.on ?? -1)) : [], [d, s]);
  return <div className="card v59c"><h3>Pick the most reliable flight</h3><div className="v59f"><In v={o} set={setO} ph="From" n={3} label="Origin IATA" /><span className="muted">→</span><In v={t} set={setT} ph="To (any)" n={3} label="Destination IATA" /><button className="press" disabled={o.length < 3} onClick={() => setU(`/play/route?o=${o}&t=${t}`)}>Find</button></div>
    <St d={d} t="route" />{d && !d.error && (!L.length ? <div className="muted sm">No flight number from {d.o}{d.t ? ` to ${d.t}` : ""} has been logged on 2+ days.</div> : <>
      <div className="v59seg" role="tablist">{([["on", "Most on time"], ["median", "Least late"], ["days", "Most logged"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={s === k} className={s === k ? "on" : ""} onClick={() => setS(k)}>{l}</button>)}</div>
      {L.slice(0, 12).map((x: any, i: number) => <div key={x.n} className={"v59r" + (i === 0 ? " top" : "")}><span className="n">{i + 1}</span><div><b>{x.n}</b> <small>→ {x.t} · {x.days} days{x.cancelled ? ` · ${x.cancelled} cxl` : ""}</small></div><span className={"c-" + tone(x.on)}>{x.on ?? "—"}%</span><em>{x.median != null ? `${x.median > 0 ? "+" : ""}${x.median}m` : "—"}</em></div>)}<Rule d={d} /></>)}</div>; }

/** A3 (smart). Airport face-off with swap. */
export function FaceOff() { const [a, setA] = useLS("sk.v59.fa", "MAN"); const [b, setB] = useLS("sk.v59.fb", "BHX"); const [go, setGo] = useState(0); const A = useApi(go ? `/play/airport?a=${a}&g=${go}` : null), B = useApi(go ? `/play/airport?a=${b}&g=${go}` : null);
  const row = (k: string, l: string, lower = false, f = (v: any) => v ?? "—") => { const x = A?.[k], y = B?.[k]; const w = x == null || y == null || x === y ? 0 : (lower ? x < y : x > y) ? 1 : 2; return <div className="v59fo" key={k}><span className={w === 1 ? "win" : ""}>{f(x)}</span><i>{l}</i><span className={w === 2 ? "win" : ""}>{f(y)}</span></div>; };
  const ok = A && B && !A.error && !B.error;
  return <div className="card v59c"><h3>Airport face-off</h3><div className="v59f"><In v={a} set={setA} ph="Airport A" n={3} label="Airport A" /><button className="press v59sw" aria-label="Swap airports" onClick={() => { setA(b); setB(a); }}>⇄</button><In v={b} set={setB} ph="Airport B" n={3} label="Airport B" /><button className="press" disabled={a.length < 3 || b.length < 3} onClick={() => setGo(Date.now())}>Fight</button></div>
    {!go ? <div className="muted sm">Pick two airports and tap Fight. Winners are highlighted.</div> : !ok ? <St d={A?.error ? A : B?.error ? B : undefined} t="airports" /> : <>
      <div className="v59fo h"><b>{A.a}</b><i></i><b>{B.a}</b></div>{row("on", "on time", false, v => v == null ? "—" : v + "%")}{row("median", "typical delay", true, v => v == null ? "—" : v + " min")}{row("p90", "9 in 10 by", true, v => v == null ? "—" : v + " min")}{row("timed", "flights logged")}{row("cancelled", "cancelled", true)}
      {(A.timed < 20 || B.timed < 20) && <div className="warn xs mt8">{[A, B].filter(x => x.timed < 20).map(x => x.a).join(" and ")}: under 20 logged departures — Skyline mostly reads UK and Irish boards.</div>}<Rule d={A} /></>}</div>; }

/** A4 (smart). Odds playground: combine airline + airport chips. */
export function OddsLab() { const [al, setAl] = useState("FR"); const [o, setO] = useState("STN"); const [u, setU] = useState<string | null>("/play/odds?al=FR&o=STN"); const d = useApi(u);
  const B = ({ l, x }: { l: string; x: any }) => !x ? null : <div className="v59od"><span>{l}</span><span className="v59bar"><i className={"c-" + tone(x.on)} style={{ width: `${x.on ?? 0}%` }} /></span><b>{x.on ?? "—"}%</b><small>{x.timed} flights{x.timed < 20 ? " · thin" : ""}</small></div>;
  return <div className="card v59c"><h3>Delay odds lab</h3><div className="muted sm">Mix an airline and an airport to see how often flights leave on time.</div>
    <div className="v59f"><In v={al} set={setAl} ph="Airline (FR)" n={3} label="Airline code" /><In v={o} set={setO} ph="Airport (STN)" n={3} label="Airport IATA" /><button className="press" onClick={() => setU(`/play/odds?al=${al}&o=${o}`)}>Mix</button></div>
    <div className="v59chips">{["FR", "U2", "EZY", "BA", "EI", "LS", "W6"].map(c => <button key={c} className={al === c ? "on" : ""} onClick={() => { setAl(c); setU(`/play/odds?al=${c}&o=${o}`); }}>{c}</button>)}</div>
    <St d={d} t="odds" />{d && !d.error && <><B l="All flights" x={d.all} /><B l={`Airline ${d.al || ""}`} x={d.airline} /><B l={`From ${d.o || ""}`} x={d.airport} /><B l="Both together" x={d.both} />{d.both && !d.both.timed && <div className="muted sm">No logged flight matches both.</div>}<Rule d={d} /></>}</div>; }

/** A5 (smart). Alert-rule builder: build rules, test them against live delays. Saved on this device. */
type AR = { id: number; ap: string; al: string; min: number; on: boolean };
export function AlertRules() { const [R, setR] = useLS<AR[]>("sk.v59.rules", []); const [ap, setAp] = useState(""); const [al, setAl] = useState(""); const [min, setMin] = useState(60); const [live, setLive] = useState<any>(null);
  const test = () => { setLive(undefined); api("/delayed-now").then(setLive).catch(e => setLive({ error: e.message })); }; useEffect(() => { if (R.length) test(); }, []);
  const match = (r: AR) => (live?.list || []).filter((f: any) => f.d >= r.min && (!r.ap || f.o === r.ap || f.t === r.ap) && (!r.al || f.number.startsWith(r.al)));
  return <div className="card v59c"><h3>My alert rules</h3><div className="muted sm">Build a rule, then Test to see which flights trip it right now.</div>
    <div className="v59f"><In v={ap} set={setAp} ph="Airport" n={3} label="Airport (optional)" /><In v={al} set={setAl} ph="Airline" n={3} label="Airline (optional)" /></div>
    <label className="v59sl"><span>Late by <b>{min}+ min</b></span><input type="range" min={15} max={240} step={15} value={min} onChange={e => setMin(+e.target.value)} aria-label="Minimum delay" /></label>
    <div className="v59f"><button className="press" disabled={R.length >= 8} onClick={() => { setR([...R, { id: Date.now(), ap, al, min, on: true }]); setAp(""); setAl(""); }}>+ Add rule</button><button className="press" disabled={!R.length} onClick={test}>Test now</button></div>
    {!R.length ? <div className="muted sm">No rules yet. Example: airport MAN, 60+ min.</div> : R.map(r => { const M = live?.list ? match(r) : null; return <div key={r.id} className={"v59rule" + (r.on ? "" : " off")}>
      <label><input type="checkbox" checked={r.on} onChange={() => setR(R.map(x => x.id === r.id ? { ...x, on: !x.on } : x))} aria-label="Rule on" /> <b>{[r.al || "Any airline", r.ap ? `at ${r.ap}` : "anywhere"].join(" ")}</b> · {r.min}+ min</label>
      <button className="v59x" aria-label="Delete rule" onClick={() => setR(R.filter(x => x.id !== r.id))}>✕</button>
      {r.on && M && <div className="xs">{M.length ? <><b className="c-bad">{M.length} match{M.length > 1 ? "es" : ""}:</b> {M.slice(0, 5).map((f: any) => `${f.number} +${f.d}m`).join(", ")}</> : <span className="c-good">No flight trips this right now.</span>}</div>}</div>; })}
    {live === undefined && <div className="muted sm">Testing…</div>}{live?.error && <div className="bad sm">{live.error}</div>}
    <div className="faint xs mt8">Rule: a rule fires for every departure within 6 h of now that is at least its minutes late and matches its airport (from or to) and airline prefix, using Skyline's "Most delayed right now" list. Rules live on this device only; Skyline checks them when you tap Test or open this card (no background alerts).</div></div>; }

/** B1. Saved board views + B2. time scrubber */
type BV = { id: number; name: string; ap: string; dir: "dep" | "arr"; al: string; late: boolean };
export function BoardViews() { const [V, setV] = useLS<BV[]>("sk.v59.views", []); const [cur, setCur] = useState<BV>({ id: 0, name: "", ap: "MAN", dir: "dep", al: "", late: false }); const [u, setU] = useState<string | null>(null); const d = useApi(u); const [h, setH] = useState<number | null>(null);
  const load = (v: BV) => { setCur(v); setU(`/board/${v.ap}?dir=${v.dir}`); setH(null); };
  const tOf = (f: any) => Date.parse(f[cur.dir]?.scheduled || "") || 0; const late = (f: any) => { const s = tOf(f), e = Date.parse(f[cur.dir]?.actual || f[cur.dir]?.estimated || "") || 0; return s && e ? Math.round((e - s) / 6e4) : null; };
  const F = (d?.flights || []).filter((f: any) => (!cur.al || (f.number || "").startsWith(cur.al)) && (!cur.late || (late(f) ?? 0) >= 15 || f.status === "cancelled"));
  const hrs = F.map((f: any) => +new Date(tOf(f)).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }) % 24); const hs = [...new Set<number>(hrs)].sort((a, b) => a - b);
  const sel = h == null ? F : F.filter((_: any, i: number) => hrs[i] === h);
  return <><div className="card v59c"><h3>My board views</h3><div className="muted sm">Set filters, then save them as a one-tap view.</div>
    <div className="v59f"><In v={cur.ap} set={s => setCur({ ...cur, ap: s })} ph="Airport" n={3} label="Airport IATA" /><div className="v59seg sm2">{(["dep", "arr"] as const).map(k => <button key={k} className={cur.dir === k ? "on" : ""} onClick={() => setCur({ ...cur, dir: k })}>{k === "dep" ? "Departures" : "Arrivals"}</button>)}</div></div>
    <div className="v59f"><In v={cur.al} set={s => setCur({ ...cur, al: s })} ph="Airline (any)" n={3} label="Airline prefix" /><label className="v59tg"><input type="checkbox" checked={cur.late} onChange={e => setCur({ ...cur, late: e.target.checked })} /> Late only</label><button className="press" disabled={cur.ap.length < 3} onClick={() => load(cur)}>Show</button></div>
    <div className="v59f"><input value={cur.name} maxLength={18} placeholder="Name this view" aria-label="View name" onChange={e => setCur({ ...cur, name: e.target.value })} /><button className="press" disabled={!cur.name || cur.ap.length < 3 || V.length >= 8} onClick={() => setV([...V.filter(x => x.name !== cur.name), { ...cur, id: Date.now() }])}>Save</button></div>
    <div className="v59chips">{V.map(v => <span key={v.id} className={"v59vw" + (cur.name === v.name ? " on" : "")}><button onClick={() => load(v)}>{v.name}<small> {v.ap} {v.dir}{v.al ? " " + v.al : ""}{v.late ? " late" : ""}</small></button><button className="v59x" aria-label={`Delete ${v.name}`} onClick={() => setV(V.filter(x => x.id !== v.id))}>✕</button></span>)}{!V.length && <span className="faint xs">No saved views yet.</span>}</div></div>
    {u && <div className="card v59c"><div className="row between"><h3>{cur.ap} {cur.dir === "dep" ? "departures" : "arrivals"}</h3><span className="faint xs">{sel.length} of {F.length}</span></div><St d={d} t="board" />
      {d && !d.error && (!F.length ? <div className="muted sm">No flights match this view on the board right now.</div> : <>
        <div className="muted xs">Tap an hour to scrub through the day (London time):</div>
        <div className="v59hrs" role="tablist"><button className={h == null ? "on" : ""} onClick={() => setH(null)}>All</button>{hs.map(x => <button key={x} className={h === x ? "on" : ""} onClick={() => setH(x)}>{String(x).padStart(2, "0")}<small>{hrs.filter((y: number) => y === x).length}</small></button>)}</div>
        {sel.slice(0, 25).map((f: any) => { const l = late(f); const p = cur.dir === "dep" ? f.destination : f.origin; return <div key={f.id} className="v59r"><span className="n">{new Date(tOf(f)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</span><div><b>{f.number}</b> <small>{cur.dir === "dep" ? "→" : "←"} {p?.city || p?.iata}</small></div><em className={f.status === "cancelled" ? "c-bad" : l != null && l >= 15 ? "c-warn" : ""}>{f.status === "cancelled" ? "cxl" : l != null ? (l > 0 ? `+${l}m` : "on time") : f.status}</em></div>; })}</>)}</div>}</>; }

/** B3. Airport code quiz */
export function CodeQuiz() { const [q, setQ] = useState<any>(null); const [pick, setPick] = useState<string | null>(null); const [S, setS] = useLS("sk.v59.quiz", { right: 0, played: 0, streak: 0, best: 0 });
  const next = () => { setPick(null); setQ(undefined); api("/play/quiz").then(setQ).catch(e => setQ({ error: e.message })); }; useEffect(next, []);
  const ans = q?.opts?.[q.ask]; const tap = (c: string) => { if (pick) return; setPick(c); const ok = c === ans.c; setS(s => ({ right: s.right + (ok ? 1 : 0), played: s.played + 1, streak: ok ? s.streak + 1 : 0, best: Math.max(s.best, ok ? s.streak + 1 : 0) })); };
  return <div className="card v59c"><div className="row between"><h3>Airport code quiz</h3><span className="faint xs">{S.right}/{S.played} · streak {S.streak} · best {S.best}</span></div>
    {q === undefined ? <div className="muted sm">Loading…</div> : q?.error ? <div className="bad sm">{q.error}</div> : !ans ? <div className="muted sm">Not enough airports logged yet.</div> : <>
      <div className="v59qq">Which code is <b>{ans.city.replace(/\b\w/g, (m: string) => m.toUpperCase())}</b>?<small>{ans.country}</small></div>
      <div className="v59qa">{q.opts.map((o: any) => <button key={o.c} className={pick ? o.c === ans.c ? "right" : o.c === pick ? "wrong" : "" : ""} onClick={() => tap(o.c)} aria-pressed={pick === o.c}>{o.c}</button>)}</div>
      {pick && <div className="sm mt8">{pick === ans.c ? "✅ Correct!" : `❌ It's ${ans.c}.`} {ans.name}. <button className="press v59nx" onClick={next}>Next</button></div>}
      <div className="faint xs mt8">Questions use the {q.pool} airports in Skyline's flight log. Score is saved on this device.</div></>}</div>; }

/** B4. Higher or lower: which real flight left later? */
export function LaterGame() { const [g, setG] = useState<any>(null); const [p, setP] = useState<string | null>(null); const [S, setS] = useLS("sk.v59.hl", { right: 0, played: 0 });
  const next = () => { setP(null); setG(undefined); api("/play/later").then(setG).catch(e => setG({ error: e.message })); }; useEffect(next, []);
  const win = g?.a ? (g.a.d > g.b.d ? "a" : "b") : null; const tap = (k: string) => { if (p) return; setP(k); setS(s => ({ right: s.right + (k === win ? 1 : 0), played: s.played + 1 })); };
  const C = ({ k }: { k: "a" | "b" }) => { const f = g[k]; return <button className={"v59hl" + (p ? k === win ? " right" : k === p ? " wrong" : "" : "")} onClick={() => tap(k)}><b>{f.n}</b><small>{f.o} → {f.t}</small><small>{new Date(f.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</small>{p && <span className="v59hd">{f.d > 0 ? `+${f.d}` : f.d} min</span>}</button>; };
  return <div className="card v59c"><div className="row between"><h3>Which was later?</h3><span className="faint xs">{S.right}/{S.played} right</span></div><div className="muted sm">Two real departures from the log. Tap the one you think left later.</div>
    {g === undefined ? <div className="muted sm">Loading…</div> : g?.error ? <div className="bad sm">{g.error}</div> : !g?.a ? <div className="muted sm">Not enough logged flights yet.</div> : <>
      <div className="v59hlw"><C k="a" /><span className="muted">or</span><C k="b" /></div>{p && <div className="sm mt8">{p === win ? "✅ Nice!" : "❌ Not this time."} <button className="press v59nx" onClick={next}>Next pair</button></div>}
      <div className="faint xs mt8">Departure delays from {g.pool.toLocaleString("en-GB")} logged flights (official boards); pairs differ by 10+ min.</div></>}</div>; }

/** B5. NATO alphabet trainer */
const NATO = "Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu".split(" ");
export function NatoTrainer() { const mk = () => Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(""); const [w, setW] = useState(mk); const [i, setI] = useState(0); const [miss, setMiss] = useState<string | null>(null); const [S, setS] = useLS("sk.v59.nato", { words: 0, best: 0 });
  const opts = useMemo(() => { const c = w.charCodeAt(i) - 65; const s = new Set([c]); while (s.size < 3) s.add(Math.floor(Math.random() * 26)); return [...s].sort(() => Math.random() - .5); }, [w, i]);
  const tap = (k: number) => { if (k !== w.charCodeAt(i) - 65) { setMiss(NATO[k]); return; } setMiss(null); if (i === 2) { setS(s => ({ words: s.words + 1, best: s.best })); setW(mk()); setI(0); } else setI(i + 1); };
  return <div className="card v59c"><div className="row between"><h3>Say it like a pilot</h3><span className="faint xs">{S.words} codes spelled</span></div><div className="muted sm">Tap the radio word for each letter.</div>
    <div className="v59nt">{w.split("").map((c, k) => <span key={k} className={k < i ? "done" : k === i ? "cur" : ""}>{c}<small>{k < i ? NATO[c.charCodeAt(0) - 65] : ""}</small></span>)}</div>
    <div className="v59qa">{opts.map(k => <button key={k} onClick={() => tap(k)}>{NATO[k]}</button>)}</div>{miss && <div className="bad xs mt8">Not {miss}, try again.</div>}<div className="faint xs mt8">ICAO spelling alphabet. Practice only: nothing is sent anywhere.</div></div>; }

export function PlayView({ x }: { x: any }) { const [t, setT] = useState<"p" | "a" | "b" | "g">("p");
  return <div className="fd"><div className="head"><div><span className="tag">PLAY & PLAN</span><h1 className="h1s">Play & Plan</h1><div className="muted sm">Drag, pick, test and play with real flight data</div></div>{x}</div>
    <div className="v54-tabs" role="tablist">{([["p", "Plan"], ["a", "Alerts"], ["b", "Boards"], ["g", "Games"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
    {t === "p" ? <><LateOMeter /><RoutePicker /><FaceOff /></> : t === "a" ? <><AlertRules /><OddsLab /></> : t === "b" ? <BoardViews /> : <><CodeQuiz /><LaterGame /><NatoTrainer /></>}</div>; }
