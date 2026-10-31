// v58 — Radio & Alerts: interesting ACARS, squawk watch, diversions, most delayed now, most watched,
// "interesting right now" score and "why is this flight special?". Rule-based; each card prints its rule.
import { useEffect, useState } from "react";
import { api } from "./lib";
import { Hero } from "./v47";
import "./v58.css";

function useApi(u: string | null, every = 0) { const [d, setD] = useState<any>(null); useEffect(() => { if (!u) return; let on = true; const go = () => api(u).then(r => on && setD(r)).catch(e => on && setD({ error: e.message })); setD(null); go(); const t = every ? setInterval(go, every) : 0; return () => { on = false; if (t) clearInterval(t); }; }, [u, every]); return d; }
const Rule = ({ d }: { d: any }) => <div className="faint xs mt8">Rule: {d.rule} Source: {d.source}.</div>;
const Wait = ({ d, t }: { d: any; t: string }) => !d ? <div className="card muted sm">Loading {t}…</div> : d.error ? <div className="card bad sm">Couldn't load {t} ({d.error}).</div> : null;
const hm = (s: string) => s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";
const ago = (s: string) => { const m = Math.round((Date.now() - Date.parse(s)) / 6e4); return m < 1 ? "now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

/** 33. Interesting ACARS */
export function TopAcars() { const d = useApi("/acars-top", 90e3); const [open, setOpen] = useState<number | null>(null); const w = Wait({ d, t: "ACARS" }); if (w) return w;
  return <div className="card v58a"><div className="row between"><h3>Most interesting ACARS</h3><span className="faint xs">{d.list.length} of {d.sampled} scored</span></div>
    {!d.list.length ? <div className="muted sm">None of the latest {d.sampled} messages scored 15+. Most ACARS traffic is routine position and engine reports.</div> :
      d.list.slice(0, 10).map((m: any, i: number) => <button key={i} className="v58am" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
        <div className="row between"><b>{m.flight || m.tail || m.hex || "Unknown"}{m.tail && m.flight ? <small> · {m.tail}</small> : null}</b><span className={"v58sc " + (m.score >= 50 ? "c-bad" : m.score >= 30 ? "c-warn" : "c-info")}>{m.score}</span></div>
        <div className="xs muted">{m.label ? <code>{m.label}</code> : null} {m.what} · {ago(m.t)}{m.hits.length ? " · " + m.hits.join(", ") : ""}</div>
        {open === i ? <><div className="xs mt8">{m.explain}</div>{m.text && <pre className="v58pre">{m.text}</pre>}<div className="faint xs">{m.why.join(" · ")}{m.station ? ` · heard by ${m.station}` : ""}</div></> : m.text && <div className="v58sn">{m.text.replace(/\s+/g, " ").slice(0, 90)}</div>}</button>)}
    <Rule d={d} /></div>; }

/** 34. Squawk watch */
export function SquawkWatch() { const d = useApi("/squawk-watch", 60e3); const [ref, setRef] = useState(false); const w = Wait({ d, t: "squawks" }); if (w) return w; const em = d.emergencies;
  return <><Hero cls="v58sq" tone={em.length ? "bad" : "good"} kicker="SPECIAL SQUAWKS · WORLDWIDE" verdict={em.length ? `${em.length} aircraft squawking an emergency` : "No emergency squawks right now"} sub={em.length ? "Most are cancelled within minutes; a 7700 is often a medical or precautionary call." : "Nobody on adsb.lol is squawking 7500, 7600 or 7700."} foot={null}>
      {em.map((a: any) => <div key={a.hex} className="v58em"><b className="c-bad">{a.code}</b><span><b>{(a.cs || a.reg || a.hex || "").trim()}</b> {a.type || ""} {a.reg || ""}<small> · {a.alt ? `${a.alt.toLocaleString("en-GB")} ft` : "ground"}{a.emergency && a.emergency !== "none" ? ` · ${a.emergency}` : ""}</small></span></div>)}</Hero>
    <div className="card v58c"><div className="row between"><h3>Squawk census</h3><span className="faint xs">{d.tracked.toLocaleString("en-GB")} airborne · 10 min</span></div>
      {!d.tracked ? <div className="muted sm">The ADS-B tracker has no airborne aircraft yet (it fills a few minutes after start).</div> : <>
        <div className="muted sm">{d.tracked - d.noCode} aircraft broadcast a code; {d.discrete} distinct ATC-assigned codes; {d.noCode} send none (Mode S only).</div>
        {d.special.length ? d.special.map((x: any) => <div key={x.k} className="v58cr"><code className={x.kind === "alert" ? "c-bad" : ""}>{x.k}</code><span><b>{x.meaning}</b><small>{x.ac.slice(0, 3).map((a: any) => a.cs || a.reg).filter(Boolean).join(", ")}</small></span><em>{x.n}</em></div>) : <div className="muted sm mt8">No aircraft on a code with a published meaning.</div>}</>}
      <button className="press v58b" onClick={() => setRef(!ref)} aria-expanded={ref}>{ref ? "Hide" : "Show"} code reference ({d.ref.length})</button>
      {ref && d.ref.map((r: any) => <div key={r.k} className="v58rf"><code className={r.kind === "alert" ? "c-bad" : ""}>{r.k}</code><span><b>{r.name}</b><small>{r.what}</small></span></div>)}<Rule d={d} /></div></>; }

/** 35. Diversions */
export function Diversions() { const d = useApi("/diversions", 120e3); const w = Wait({ d, t: "diversions" }); if (w) return w; const n = d.conf.length + d.likely.length;
  return <div className="card v58d"><div className="row between"><h3>Diverting flights</h3><span className="faint xs">{d.checked} flights checked</span></div>
    {!n ? <div className="muted sm">No diversions. No board shows a diverted flight and the ADS-B tracker hasn't seen a logged flight land or descend away from its destination.</div> : <>
      {d.conf.map((x: any) => <div key={x.number} className="v58dv"><span className="v58tag c-bad">Confirmed</span><b>{x.number}</b> {x.o}→{x.t}<small>{x.text}</small></div>)}
      {d.likely.map((x: any) => <div key={x.number} className="v58dv"><span className="v58tag c-warn">Likely</span><b>{x.number}</b> {x.o}→<s>{x.t}</s> {x.to}<small>{x.why}</small></div>)}</>}<Rule d={d} /></div>; }

/** 36. Most delayed now */
export function DelayedNow() { const d = useApi("/delayed-now", 120e3); const w = Wait({ d, t: "delays" }); if (w) return w;
  return <div className="card v58l"><div className="row between"><h3>Most delayed right now</h3><span className="faint xs">{d.total} 30+ min{d.skipped ? ` · ${d.skipped} skipped` : ""}</span></div>
    {!d.list.length ? <div className="muted sm">No departure within 6 h of now is 30+ minutes late on the boards Skyline has read.</div> :
      d.list.slice(0, 12).map((x: any, i: number) => <div key={x.number + i} className="v58lr"><span className="n">{i + 1}</span><div><b>{x.number}</b> <small>{x.o}→{x.t} · {x.airline || ""}</small><small>Due {hm(x.sch)} · {x.statusText || x.status}{x.kind === "estimated" ? " (estimate)" : ""}</small></div><em className={x.d >= 120 ? "c-bad" : x.d >= 60 ? "c-warn" : ""}>+{x.d >= 60 ? `${Math.floor(x.d / 60)}h ${x.d % 60}m` : `${x.d}m`}</em></div>)}<Rule d={d} /></div>; }

/** 37. Most watched */
export function MostWatched() { const d = useApi("/most-watched", 120e3); const w = Wait({ d, t: "counters" }); if (w) return w;
  const L = (A: any[], u: string) => A.map((x, i) => <div key={x.number} className="v58lr"><span className="n">{i + 1}</span><div><b>{x.number}</b></div><em>{x.n} {u}</em></div>);
  return <div className="card v58w"><h3>Most watched in Skyline</h3>
    <div className="v56-sub">Looked up today</div>{d.looked.length ? L(d.looked, "devices") : <div className="muted sm">Counting started {hm(d.lookedSince)} today ({new Date(d.lookedSince).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}). No flight has been looked up since.</div>}
    <div className="v56-sub">Tracked (saved)</div>{d.tracked.length ? L(d.tracked, "devices") : <div className="muted sm">No flight is saved on 2+ devices today.</div>}<Rule d={d} /></div>; }

/** 38. Interesting right now + 39. Why special */
export function InterestingNow() { const d = useApi("/interesting-now", 90e3); const w = Wait({ d, t: "scores" }); if (w) return w; const top = d.list[0];
  return <Hero cls="v58i" tone={top?.score >= 70 ? "bad" : top ? "warn" : "good"} kicker="INTERESTING RIGHT NOW" verdict={top ? `${top.k} · ${top.score} pts` : "Nothing stands out"} sub={top ? top.why.join(" · ") : "No rule fires for any flight right now."} foot={<Rule d={d} />}>
    {d.list.slice(1, 10).map((x: any, i: number) => <div key={x.k} className="v58ir"><span className="n">{i + 2}</span><div><b>{x.k}</b>{x.type ? <small> · {x.type}</small> : null}<small>{x.why.join(" · ")}</small></div><em>{x.score}</em></div>)}</Hero>; }
export function WhySpecial() { const [q, setQ] = useState(""); const [u, setU] = useState<string | null>(null); const d = useApi(u);
  return <div className="card v58y"><h3>Why is this flight special?</h3><div className="v54-cin v58f"><input value={q} maxLength={10} onChange={e => setQ(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && q && setU(`/why-special?q=${encodeURIComponent(q)}`)} placeholder="Flight, callsign or reg" aria-label="Flight number, callsign or registration" /><button className="press" disabled={!q} onClick={() => setU(`/why-special?q=${encodeURIComponent(q)}`)}>Explain</button></div>
    {!u ? <div className="muted sm">Lists every rule that fires for one flight right now.</div> : !d ? <div className="muted sm">Checking…</div> : d.error ? <div className="bad sm">{d.error}</div> :
      <>{!d.found ? <div className="muted sm">Nothing special about {d.q} right now: no rule fires and the logged history has no stand-out pattern.</div> : <>
        {d.why.length ? <div className="sm"><b>{d.score} pts</b> · #{d.rank} of {d.of} scored flights</div> : null}
        <ul className="v58ul">{d.why.map((y: string) => <li key={y}>{y}</li>)}{d.history.map((y: string) => <li key={y} className="muted">History: {y}</li>)}</ul></>}<Rule d={d} /></>}</div>; }

export function LiveWatch({ x }: { x: any }) { const [t, setT] = useState<"n" | "r" | "s" | "f">("n");
  return <div className="fd"><div className="head"><div><span className="tag">LIVE WATCH</span><h1 className="h1s">Radio & Alerts</h1><div className="muted sm">ACARS, squawks, diversions, delays and what people are watching</div></div>{x}</div>
    <div className="v54-tabs" role="tablist">{([["n", "Now"], ["r", "ACARS"], ["s", "Squawks"], ["f", "Flights"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
    {t === "n" ? <><InterestingNow /><WhySpecial /></> : t === "r" ? <TopAcars /> : t === "s" ? <SquawkWatch /> : <><Diversions /><DelayedNow /><MostWatched /></>}</div>; }
