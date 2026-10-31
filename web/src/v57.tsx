// v57 — patterns: delay spread, cancellation log, flight-number league, delay by distance, destination countries,
// carrier share, ADS-B airport movements, only-from destinations. Rule-based; every number is from the Skyline observed log or ADS-B tracker.
import { useEffect, useState } from "react";
import { api } from "./lib";
import { Hero } from "./v47";
import "./v57.css";

const tone = (on: number | null) => on == null ? "" : on >= 75 ? "good" : on >= 55 ? "warn" : "bad";
const pc = (n: number | null | undefined) => n == null ? "—" : n + "%";
const mn = (n: number | null | undefined) => n == null ? "—" : `${n} min`;
const fmt = (n: number) => n.toLocaleString("en-GB");
function useApi(u: string | null) { const [d, setD] = useState<any>(null); useEffect(() => { if (!u) return; let on = true; setD(null); api(u).then(r => on && setD(r)).catch(e => on && setD({ error: e.message })); return () => { on = false; }; }, [u]); return d; }
const Rule = ({ d }: { d: any }) => <div className="faint xs mt8">Rule: {d.rule} Source: {d.source}.</div>;
const Wait = ({ d, t }: { d: any; t: string }) => !d ? <div className="card muted sm">Loading {t}…</div> : d.error ? <div className="card bad sm">Couldn't load {t} ({d.error}).</div> : null;
const Bar = ({ v, mx, c }: { v: number; mx: number; c?: string }) => <span className={"v57-bar " + (c || "")}><i style={{ width: `${Math.max(2, v / Math.max(1, mx) * 100)}%` }} /></span>;

/** 25. Delay spread */
export function DelaySpread() { const [o, setO] = useState(""); const [a, setA] = useState(""); const [u, setU] = useState("/delay-spread"); const d = useApi(u);
  const go = () => setU(`/delay-spread?o=${o}&a=${a}`); const w = Wait({ d, t: "delay spread" });
  const mx = d?.buckets ? Math.max(...d.buckets.map((b: any) => b.n), 1) : 1; const on = d?.timed ? Math.round((d.buckets[0].n + d.buckets[1].n) / d.timed * 100) : null;
  return <><div className="card v54-cin v57-f"><input value={o} maxLength={3} onChange={e => setO(e.target.value.toUpperCase())} placeholder="Airport" aria-label="Airport IATA filter" /><input value={a} maxLength={2} onChange={e => setA(e.target.value.toUpperCase())} placeholder="Airline" aria-label="Airline IATA filter" /><button className="press" onClick={go}>Show</button></div>
    {w || (!d.timed ? <div className="card"><h3>No timed flights</h3><div className="muted sm">Skyline has no delay times for {[d.o, d.a].filter(Boolean).join(" · ") || "this filter"}.</div></div> :
      <Hero cls="v57-ds" tone={tone(on)} kicker={`HOW LATE IS LATE · ${[d.o || "ALL AIRPORTS", d.a || "ALL AIRLINES"].join(" · ")}`} verdict={`Median ${d.median > 0 ? "+" : ""}${d.median} min`} sub={`1 in 10 flights is ${d.p90}+ min late · worst ${fmt(d.worst)} min · ${fmt(d.timed)} timed flights${d.cancelled ? ` · ${d.cancelled} cancelled` : ""}`} foot={<Rule d={d} />}>
        <div className="v57-hist" role="img" aria-label="Delay bands">{d.buckets.map((b: any, i: number) => <div key={b.k} className={"b" + i}><b>{Math.round(b.n / d.timed * 100)}%</b><span style={{ height: 4 + b.n / mx * 90 }} /><i>{b.l}</i></div>)}</div></Hero>)}</>; }

/** 26. Cancellation log */
export function Cancellations() { const d = useApi("/cancellations"); const w = Wait({ d, t: "cancellations" }); if (w) return w;
  if (!d.n) return <div className="card"><h3>Cancellations</h3><div className="muted sm">No board has marked a flight cancelled in {fmt(d.of)} logged flights.</div><Rule d={d} /></div>;
  const mx = Math.max(...d.byDay.map((x: any) => x.n), 1); const G = (t: string, A: any[]) => <><div className="v56-sub">{t}</div>{A.map(x => <div key={x.k} className="v57-row"><b>{x.k}</b><Bar v={x.n} mx={A[0].n} c="cx" /><span>{x.n}<small> of {fmt(x.of)} · {x.pct}%</small></span></div>)}</>;
  return <div className="card v57-cx"><div className="row between"><h3>Cancellation log</h3><span className="faint xs">{d.n} of {fmt(d.of)} · {d.pct}%</span></div>
    <div className="v57-days">{d.byDay.map((x: any) => <div key={x.d} title={`${x.d}: ${x.n} of ${x.of}`}><span style={{ height: 3 + x.n / mx * 50 }} /><b>{x.n}</b><i>{x.d.slice(8)}</i></div>)}</div>
    {G("By airline", d.byAirline)}{G("By origin", d.byOrigin)}
    <div className="v56-sub">Latest</div><div className="v57-lat">{d.latest.map((r: any) => <span key={r.k + r.date}><b>{r.k}</b> {r.o}→{r.t} <i>{r.date.slice(5)}</i></span>)}</div><Rule d={d} /></div>; }

/** 27. Flight-number league */
export function NumberLeague() { const d = useApi("/number-league"); const w = Wait({ d, t: "league" }); if (w) return w;
  if (!d.ranked) return <div className="card"><h3>Flight number league</h3><div className="muted sm">No flight number has been logged on {d.min}+ days yet.</div></div>;
  const R = (x: any, i: number, sd?: boolean) => <div key={x.k} className="v57-lg"><span className="n">{i + 1}</span><div><b>{x.k}</b><small>{x.o}→{x.t} · {x.days} days{x.cancelled ? ` · ${x.cancelled} cxl` : ""}</small></div><span className={"c-" + tone(x.on)}>{sd ? `±${x.sd} min` : pc(x.on)}</span><em>avg {mn(x.avg)}</em></div>;
  return <Hero cls="v57-lgh" tone="info" kicker="FLIGHT NUMBER LEAGUE" verdict={`${fmt(d.ranked)} flights ranked`} sub={`Every flight number Skyline logged on ${d.min}+ days`} foot={<Rule d={d} />}>
    <div className="v56-sub good">Most reliable</div>{d.best.map((x: any, i: number) => R(x, i))}<div className="v56-sub bad">Least reliable</div>{d.worst.map((x: any, i: number) => R(x, i))}
    <div className="v56-sub">Steadiest timing</div>{d.steady.length ? d.steady.map((x: any, i: number) => R(x, i, true)) : <div className="muted sm">None with 5+ days yet.</div>}</Hero>; }

/** 28. Delay by distance */
export function DistanceDelay() { const d = useApi("/distance-delay"); const w = Wait({ d, t: "distance bands" }); if (w) return w; const ok = d.bands.filter((b: any) => b.on != null);
  if (!ok.length) return <div className="card"><h3>Delay by distance</h3><div className="muted sm">No routes with known airport coordinates yet.</div></div>;
  const best = ok.reduce((a: any, b: any) => b.on > a.on ? b : a), worst = ok.reduce((a: any, b: any) => b.on < a.on ? b : a);
  return <div className="card v57-dd"><div className="row between"><h3>Delay by route length</h3><span className="faint xs">{ok.length} bands</span></div>
    <div className="muted sm">{best === worst ? "Only one band has data." : `${best.l} flights were most punctual (${pc(best.on)}); ${worst.l} least (${pc(worst.on)}).`}</div>
    {d.bands.map((b: any) => <div key={b.l} className="v57-row w"><b>{b.l}</b><Bar v={b.on || 0} mx={100} c={tone(b.on)} /><span>{pc(b.on)}<small> avg {mn(b.avg)} · {fmt(b.n)} flights · {b.routes} routes</small></span></div>)}
    <div className="v56-sub">Longest routes seen</div><div className="v57-lat">{d.longest.map((r: any) => <span key={r.k}><b>{r.k}</b> {fmt(r.km)} km <i>×{r.n}</i></span>)}</div>
    <div className="v56-sub">Shortest</div><div className="v57-lat">{d.shortest.map((r: any) => <span key={r.k}><b>{r.k}</b> {fmt(r.km)} km <i>×{r.n}</i></span>)}</div>
    {d.noCoords > 0 && <div className="faint xs">{d.noCoords} flights skipped (airport without coordinates).</div>}<Rule d={d} /></div>; }

/** 29. Destination countries */
export function Countries() { const d = useApi("/countries"); const w = Wait({ d, t: "countries" }); if (w) return w; const L = d.countries; if (!L.length) return <div className="card"><h3>Where flights go</h3><div className="muted sm">No departures with a known destination country yet.</div></div>;
  const tot = L.reduce((s: number, c: any) => s + c.n, 0);
  return <Hero cls="v57-co" tone="info" kicker="WHERE FLIGHTS GO" verdict={`${L.length} countries`} sub={`${fmt(tot)} departures · ${L[0].k} leads with ${Math.round(L[0].n / tot * 100)}%`} foot={<Rule d={d} />}>
    {L.slice(0, 14).map((c: any) => <div key={c.k} className="v57-row w"><b>{c.k}</b><Bar v={c.n} mx={L[0].n} /><span>{fmt(c.n)}<small> · {c.airports} airports · <span className={"c-" + tone(c.on)}>{pc(c.on)}</span> on time · {c.top.join(", ")}</small></span></div>)}
    {L.length > 14 && <div className="faint xs">+{L.length - 14} more: {L.slice(14).map((c: any) => c.k).join(", ")}.</div>}{d.unknown > 0 && <div className="faint xs">{d.unknown} departures to airports without a country.</div>}</Hero>; }

/** 30. Carrier share per airport */
export function CarrierShare() { const d = useApi("/carrier-share"); const w = Wait({ d, t: "carrier share" }); if (w) return w;
  if (!d.airports.length) return <div className="card"><h3>Who flies where</h3><div className="muted sm">No airport has 100+ logged flights yet.</div></div>;
  return <div className="card v57-cs"><div className="row between"><h3>Who flies where</h3><span className="faint xs">{d.airports.length} airports</span></div>
    {d.airports.map((a: any) => <div key={a.k} className="v57-ap"><div className="row between"><span><b>{a.k}</b> <span className="faint sm">{a.city || ""}</span></span><span className={"v57-hhi " + (a.hhi > 2500 ? "hi" : "")}>{a.hhi > 2500 ? "Dominated" : "Competitive"} · {fmt(a.hhi)}</span></div>
      <div className="v57-stack">{a.top.map((t: any, i: number) => <span key={t.a} className={"v57s" + i} style={{ width: t.pct + "%" }} title={`${t.a} ${t.pct}%`} />)}</div>
      <div className="v57-lat">{a.top.map((t: any, i: number) => <span key={t.a}><em className={"v57s" + i} /><b>{t.a}</b> {t.pct}%</span>)}<span className="faint">{a.carriers} airlines · {fmt(a.n)} flights</span></div></div>)}<Rule d={d} /></div>; }

/** 31. ADS-B airport movements */
export function Movements() { const d = useApi("/adsb-movements"); const w = Wait({ d, t: "ADS-B movements" }); if (w) return w;
  if (d.none) return <div className="card"><h3>Busiest airports on ADS-B</h3><div className="muted sm">{d.reason}.</div></div>;
  if (!d.airports.length) return <div className="card"><h3>Busiest airports on ADS-B</h3><div className="muted sm">The tracker hasn't inferred any take-offs or landings in the last 24 h.</div><Rule d={d} /></div>;
  const mh = Math.max(...d.hours, 1), top = d.airports[0];
  return <Hero cls="v57-mo" tone="info" kicker="BUSIEST ON ADS-B · 24 H" verdict={`${top.k} · ${top.n} movements`} sub={`${fmt(d.total)} take-offs and landings at ${d.count} airports in the ${d.window}`} foot={<Rule d={d} />}>
    <div className="v57-hours" role="img" aria-label="Movements by hour, UTC">{d.hours.map((v: number, i: number) => <span key={i} title={`${i}:00 UTC: ${v}`} style={{ height: 3 + v / mh * 60 }} />)}</div><div className="v57-hl faint xs"><span>00</span><span>06</span><span>12</span><span>18</span><span>23 UTC</span></div>
    {d.airports.map((a: any) => <div key={a.k} className="v57-row w"><b>{a.k}</b><Bar v={a.n} mx={top.n} /><span>{a.n}<small> {a.dep} out · {a.arr} in · {a.likely} likely{a.city ? " · " + a.city : ""}</small></span></div>)}</Hero>; }

/** 32. Only-from destinations */
export function OnlyFrom() { const d = useApi("/only-from"); const w = Wait({ d, t: "only-from" }); if (w) return w;
  return <div className="card v57-of"><div className="row between"><h3>Only from here</h3><span className="faint xs">{d.total} of {d.dests} destinations</span></div>
    {!d.groups.length ? <div className="muted sm">Every destination Skyline saw is served from more than one logged airport.</div> : d.groups.map((g: any) => <div key={g.o} className="v57-ap"><div className="row between"><span><b>{g.o}</b> <span className="faint sm">{g.city || ""}</span></span><span className="faint sm">{g.n} only here</span></div>
      <div className="v57-lat">{g.list.slice(0, 12).map((t: any) => <span key={t.t}><b>{t.t}</b> {t.city || ""} <i>×{t.n}</i></span>)}{g.n > 12 && <span className="faint">+{g.n - 12} more</span>}</div></div>)}
    <div className="faint xs mt8">Compared across {d.origins} departure airports.</div><Rule d={d} /></div>; }

/** Overlay */
export function PatternsView({ x }: { x: any }) { const [t, setT] = useState<"d" | "r" | "a" | "w">("d");
  return <div className="fd"><div className="head"><div><span className="tag">PATTERNS</span><h1 className="h1s">Patterns</h1><div className="muted sm">Delays, reliability, airports and reach across everything Skyline logged</div></div>{x}</div>
    <div className="v54-tabs" role="tablist">{([["d", "Delays"], ["r", "Reliability"], ["a", "Airports"], ["w", "Reach"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
    {t === "d" ? <><DelaySpread /><DistanceDelay /></> : t === "r" ? <><NumberLeague /><Cancellations /></> : t === "a" ? <><CarrierShare /><Movements /></> : <><Countries /><OnlyFrom /></>}</div>; }
