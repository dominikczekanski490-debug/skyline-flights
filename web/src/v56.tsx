// v56 — network insights (coverage, new / quiet routes, airline movers, ADS-B type census, busiest airframes),
// best airport for a destination, flight-number record, shared routes. Rule-based; every number is from the Skyline observed log or ADS-B tracker.
import { useEffect, useState } from "react";
import { api } from "./lib";
import { Hero } from "./v47";
import "./v56.css";

const tone = (on: number | null) => on == null ? "" : on >= 75 ? "good" : on >= 55 ? "warn" : "bad";
const pc = (n: number | null | undefined) => n == null ? "—" : n + "%";
const mn = (n: number | null | undefined) => n == null ? "—" : `${n} min`;
const ls = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
function useApi(u: string | null) { const [d, setD] = useState<any>(null); useEffect(() => { if (!u) return; let on = true; setD(null); api(u).then(r => on && setD(r)).catch(e => on && setD({ error: e.message })); return () => { on = false; }; }, [u]); return d; }
const Rule = ({ d }: { d: any }) => <div className="faint xs mt8">Rule: {d.rule} Source: {d.source}.</div>;
const Wait = ({ d, t }: { d: any; t: string }) => !d ? <div className="card muted sm">Loading {t}…</div> : d.error ? <div className="card bad sm">Couldn't load {t} ({d.error}).</div> : null;

/** 17. Data coverage */
export function Coverage() { const d = useApi("/coverage"); const w = Wait({ d, t: "coverage" }); if (w) return w; const mx = Math.max(...d.days.map((x: any) => x.n), 1);
  return <Hero cls="v56-cov" tone="info" kicker="WHAT SKYLINE HAS SEEN" verdict={`${d.flights.toLocaleString("en-GB")} departures`} sub={`${d.days.length} days logged · ${d.numbers.toLocaleString("en-GB")} flight numbers · ${d.origins.length} origins · ${d.dests} destinations`} foot={<Rule d={d} />}>
    <div className="v56-bars" role="img" aria-label="Departures logged per day">{d.days.map((x: any) => <div key={x.d} className={x.d === d.today ? "part" : ""} title={`${x.d}: ${x.n}`}><span style={{ height: 6 + x.n / mx * 70 }} /><b>{x.n}</b><i>{x.d.slice(8)}</i></div>)}</div>
    <div className="faint xs">Hatched = today so far.</div>
    <div className="v56-chips">{d.origins.slice(0, 10).map((o: any) => <span key={o.k}><b>{o.k}</b> {o.n.toLocaleString("en-GB")}</span>)}</div>
    {d.origins.length > 10 && <div className="faint xs">+{d.origins.length - 10} more origins, mostly return legs seen on UK arrival boards.</div>}
    {d.fleet && <div className="v56-kv"><span><i>ADS-B aircraft tracked</i><b>{d.fleet.aircraft.toLocaleString("en-GB")}</b></span><span><i>Inferred legs</i><b>{d.fleet.legs.toLocaleString("en-GB")}</b></span><span><i>Sweep areas</i><b>{d.fleet.areas}</b></span></div>}</Hero>; }

/** 18. New and quiet routes */
export function RouteChanges() { const d = useApi("/route-changes"); const w = Wait({ d, t: "route changes" }); if (w) return w;
  if (!d.enough) return <div className="card"><h3>New & quiet routes</h3><div className="muted sm">Needs {d.need} full logged days; Skyline has {d.days} so far.</div></div>;
  const L = (A: any[], q: boolean) => !A.length ? <div className="muted sm">{q ? "No regular route has gone quiet." : "No route appeared for the first time."}</div> : A.map(r => <div key={r.k} className="row between ckrow"><span><b>{r.k}</b> <span className="faint sm">{r.al.join(", ")}</span></span><span className="faint sm">{q ? `last seen ${r.last} · ${r.n} before` : `${r.n} since ${r.first}`}</span></div>);
  return <div className="card v56-rc"><div className="row between"><h3>New & quiet routes</h3><span className="faint xs">{d.window[0]} → {d.window[1]}</span></div>
    <div className="v56-sub good">● New in the last {d.recent.length} days ({d.fresh.length})</div>{L(d.fresh, false)}
    <div className="v56-sub bad">● Gone quiet ({d.quiet.length})</div>{L(d.quiet, true)}<Rule d={d} /></div>; }

/** 19. Airline movers */
export function Movers() { const d = useApi("/movers"); const w = Wait({ d, t: "movers" }); if (w) return w;
  if (!d.enough) return <div className="card"><h3>Airline movers</h3><div className="muted sm">Needs {d.need} full logged days; Skyline has {d.days} so far.</div></div>;
  if (!d.list.length) return <div className="card"><h3>Airline movers</h3><div className="muted sm">No airline has 20+ departures in both windows yet.</div><Rule d={d} /></div>;
  const up = d.list.filter((x: any) => x.delta > 0).slice(0, 5), dn = d.list.filter((x: any) => x.delta < 0).slice(-5).reverse(); const top = d.list[0];
  const R = (x: any) => <div key={x.k} className="v56-mv"><b>{x.k}</b><span className="faint sm">{pc(x.before.on)} → <b className={"c-" + tone(x.now.on)}>{pc(x.now.on)}</b></span><em className={x.delta > 0 ? "up" : "dn"}>{x.delta > 0 ? "▲" : "▼"} {Math.abs(x.delta)} pts</em><small className="faint">{x.now.n} flights · avg {mn(x.now.avg)}{x.now.cancelled ? ` · ${x.now.cancelled} cxl` : ""}</small></div>;
  return <Hero cls="v56-mov" tone={top.delta > 0 ? "good" : "bad"} kicker="AIRLINE MOVERS" verdict={`${top.k} ${top.delta > 0 ? "+" : ""}${top.delta} pts`} sub={`Last ${d.span} days (${d.recentWin[0].slice(5)}–${d.recentWin[1].slice(5)}) vs the ${d.span} before (${d.priorWin[0].slice(5)}–${d.priorWin[1].slice(5)}) · ${d.list.length} airlines compared`} foot={<Rule d={d} />}>
    <div className="v56-sub good">Improving</div>{up.length ? up.map(R) : <div className="muted sm">None improved.</div>}<div className="v56-sub bad">Slipping</div>{dn.length ? dn.map(R) : <div className="muted sm">None got worse.</div>}</Hero>; }

/** 20 + 21. ADS-B type census (rare visitors) and hardest-working airframes */
export function FleetCensus({ part }: { part: "rare" | "busy" }) { const d = useApi("/fleet-census"); const w = Wait({ d, t: "ADS-B census" }); if (w) return w;
  if (d.none) return <div className="card"><h3>{part === "rare" ? "Rare visitors" : "Hardest-working aircraft"}</h3><div className="muted sm">{d.reason}.</div></div>;
  if (part === "rare") return <Hero cls="v56-rare" tone="info" kicker="RARE VISITORS · ADS-B 24 H" verdict={`${d.rareTotal} rare types`} sub={`${d.seen.toLocaleString("en-GB")} aircraft of ${d.types} type codes seen over Europe in the ${d.window}`} foot={<Rule d={d} />}>
    <div className="v56-sub">Most common</div><div className="v56-chips">{d.top.map((t: any) => <span key={t.k}><b>{t.k}</b> {t.n}</span>)}</div>
    <div className="v56-sub">Only 1–2 seen</div>{!d.rare.length ? <div className="muted sm">Nothing rare in the last 24 h.</div> : <div className="v56-rg">{d.rare.slice(0, 24).map((t: any) => <div key={t.k}><b>{t.k}</b><small>{t.regs.join(", ") || "no reg"}</small>{t.ops.length > 0 && <em>{t.ops.join(", ")}</em>}</div>)}</div>}
    {d.rareTotal > 24 && <div className="faint xs">+{d.rareTotal - 24} more.</div>}</Hero>;
  return <div className="card v56-busy"><div className="row between"><h3>Hardest-working aircraft</h3><span className="faint xs">last 24 h</span></div>
    {!d.busiest.length ? <div className="muted sm">No aircraft has 2+ completed legs in the tracker yet.</div> : d.busiest.map((p: any, i: number) => <div key={p.hex} className="v56-bz"><span className="n">{i + 1}</span><div><b>{p.reg || p.hex}</b> <span className="faint sm">{p.type || "?"} · {p.cs || ""}</span><small>{p.path.join(" → ")}{p.likely ? " · some legs likely" : ""}</small></div><em>{p.legs} legs</em></div>)}<Rule d={d} /></div>; }

/** 22. Best airport to fly from, for a destination */
export function BestOrigin() { const [q, setQ] = useState(() => ls("sk.bo", "ALC")); const [u, setU] = useState(`/best-origin?t=${q}`); const d = useApi(u);
  const go = () => { localStorage.setItem("sk.bo", JSON.stringify(q)); setU(`/best-origin?t=${q}`); };
  const ok = d?.origins?.filter((o: any) => o.n >= 5 && o.on != null) || []; const best = ok.length ? ok.reduce((a: any, b: any) => (b.on > a.on ? b : a)) : null;
  return <><div className="card v54-cin"><input value={q} maxLength={3} onChange={e => setQ(e.target.value.toUpperCase())} placeholder="ALC" aria-label="Destination airport IATA" /><button className="press" onClick={go}>Find origins</button></div>
    {Wait({ d, t: "origins" }) || (!d.origins.length ? <div className="card"><h3>No flights to {d.t} seen</h3><div className="muted sm">Skyline hasn't logged a departure to {d.t} on the boards it reads.</div></div> :
      <Hero cls="v56-bo" tone={tone(best?.on ?? null)} kicker={`FLYING TO ${d.t}${d.city ? " · " + d.city.toUpperCase() : ""}`} verdict={best ? `${best.o} is most punctual` : `${d.origins.length} origin${d.origins.length > 1 ? "s" : ""}`} sub={best ? `${pc(best.on)} on time over ${best.n} departures` : "Not enough departures (5+) to rank punctuality."} foot={<Rule d={d} />}>
        {d.origins.slice(0, 10).map((o: any) => <div key={o.o} className={"v56-or" + (o === best ? " win" : "")}><div><b>{o.o}</b><small>{o.city || ""} · {o.carriers.join(", ")}</small></div><span><i>per day</i><b>{o.perDay}</b></span><span><i>on time</i><b className={"c-" + tone(o.on)}>{pc(o.on)}</b></span><span><i>avg</i><b>{mn(o.avg)}</b></span></div>)}</Hero>)}</>; }

/** 23. Flight-number record */
export function FlightRecord() { const [q, setQ] = useState(() => ls("sk.fr", "EZY2011")); const [u, setU] = useState(`/flight-record?n=${q}`); const d = useApi(u);
  const go = () => { localStorage.setItem("sk.fr", JSON.stringify(q)); setU(`/flight-record?n=${encodeURIComponent(q)}`); };
  const cls = (x: any) => x.s === "cancelled" ? "cx" : x.d == null ? "nd" : x.d < 15 ? "ok" : x.d < 30 ? "lt" : "bd";
  return <><div className="card v54-cin"><input value={q} onChange={e => setQ(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="EZY2011" aria-label="Flight number" /><button className="press" onClick={go}>Look up</button></div>
    {Wait({ d, t: "flight record" }) || (d.none ? <div className="card"><h3>{d.n}: not in Skyline's log</h3><div className="muted sm">Tried {d.tried.join(", ")}. Skyline only logs departures shown on the official boards it reads.</div></div> :
      <Hero cls="v56-fr" tone={tone(d.on)} kicker={`${d.number} · ${d.routes.join(", ")}`} verdict={`${pc(d.on)} on time`} sub={`${d.days.length} days logged · avg ${mn(d.avg)}${d.cancelled ? ` · ${d.cancelled} cancelled` : ""}`} foot={<Rule d={d} />}>
        <div className="v56-dots">{d.days.map((x: any) => <div key={x.date} className={cls(x)} title={`${x.date} ${x.o}→${x.t}`}><span>{x.s === "cancelled" ? "✕" : x.d == null ? "?" : (x.d > 0 ? "+" : "") + x.d}</span><i>{x.date.slice(5)}</i></div>)}</div>
        <div className="v56-leg"><span className="ok">under 15</span><span className="lt">15–29</span><span className="bd">30+</span><span className="cx">cancelled</span></div></Hero>)}</>; }

/** 24. Shared routes for two airlines (used inside Airline vs airline) */
export function SharedRoutes({ a, b, la, lb }: { a: string; b: string; la: string; lb: string }) { const d = useApi(`/shared-routes?a=${a}&b=${b}`); const w = Wait({ d, t: "shared routes" }); if (w) return w;
  return <div className="card v56-sh"><div className="row between"><h3>Head-to-head routes</h3><span className="faint xs">{d.total} shared</span></div>
    {!d.shared.length ? <div className="muted sm">Skyline hasn't seen {la} and {lb} on the same route.</div> : <><div className="v56-shh"><span /><b>{la}</b><b>{lb}</b></div>{d.shared.map((r: any) => { const wa = r.a.on != null && r.b.on != null && r.a.on > r.b.on, wb = r.a.on != null && r.b.on != null && r.b.on > r.a.on;
      return <div key={r.k} className="v56-shr"><span>{r.k}</span><b className={wa ? "win" : ""}>{pc(r.a.on)}<small>{r.a.n}</small></b><b className={wb ? "win" : ""}>{pc(r.b.on)}<small>{r.b.n}</small></b></div>; })}</>}
    <div className="faint xs mt8">On-time %, with departures seen underneath. Green = more punctual on that route.</div><Rule d={d} /></div>; }

/** Overlays */
export function NetworkView({ x }: { x: any }) { const [t, setT] = useState<"r" | "m" | "f" | "c">("r");
  return <div className="fd"><div className="head"><div><span className="tag">NETWORK</span><h1 className="h1s">Network insights</h1><div className="muted sm">What changed across everything Skyline observes</div></div>{x}</div>
    <div className="v54-tabs" role="tablist">{([["r", "Routes"], ["m", "Movers"], ["f", "Fleet"], ["c", "Coverage"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
    {t === "r" ? <RouteChanges /> : t === "m" ? <Movers /> : t === "f" ? <><FleetCensus part="rare" /><FleetCensus part="busy" /></> : <Coverage />}</div>; }
export function LookupView({ x }: { x: any }) { const [t, setT] = useState<"o" | "f">("o");
  return <div className="fd"><div className="head"><div><span className="tag">LOOK UP</span><h1 className="h1s">{t === "o" ? "Best airport to fly from" : "Flight number record"}</h1><div className="muted sm">{t === "o" ? "Every origin Skyline saw flying to a destination" : "Day by day, from the boards Skyline reads"}</div></div>{x}</div>
    <div className="v54-tabs" role="tablist"><button role="tab" aria-selected={t === "o"} className={t === "o" ? "on" : ""} onClick={() => setT("o")}>Destination</button><button role="tab" aria-selected={t === "f"} className={t === "f" ? "on" : ""} onClick={() => setT("f")}>Flight number</button></div>
    {t === "o" ? <BestOrigin /> : <FlightRecord />}</div>; }
