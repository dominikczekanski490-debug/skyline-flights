// v55 — reliability timelines (route / airline / airport), weekday pattern, live type sightings, pinned-airports dashboard,
// spotting map, trip itinerary + budget, airline vs airline. Rule-based; data from the Skyline observed log, ADS-B, METAR, OSM and your own flights.
import { useEffect, useState } from "react";
import { api, dist, fmtT, type Flight } from "./lib";
import { Hero } from "./v47";
import "./v55.css";
import { SharedRoutes } from "./v56";

const ls = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const save = (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v));
const tone = (on: number | null) => on == null ? "" : on >= 75 ? "good" : on >= 55 ? "warn" : "bad";
const pc = (n: number | null) => n == null ? "—" : n + "%";

/** Daily on-time bars + weekday pattern for a route, airline or airport. */
export function Timeline({ kind, q, title, onDest }: { kind: "route" | "airline" | "airport"; q: string; title?: string; onDest?: (iata: string) => void }) { const [d, setD] = useState<any>(null);
  useEffect(() => { setD(null); api(`/trend?kind=${kind}&q=${encodeURIComponent(q)}`).then(setD).catch(e => setD({ error: e.message })); }, [kind, q]);
  if (!d) return <div className="card v55-tl"><div className="muted sm">Loading reliability timeline…</div></div>;
  if (d.error || !d.days?.length) return <div className="card v55-tl"><h3>{title || "Reliability timeline"}</h3><div className="muted sm">{d.error ? `Couldn't load (${d.error}).` : "Skyline hasn't observed any departures here yet."}</div></div>;
  const full = d.days.filter((x: any) => x.date !== d.today && x.on != null); const tot = full.reduce((s: number, x: any) => s + x.n, 0);
  const on = tot ? Math.round(full.reduce((s: number, x: any) => s + (x.on ?? 0) * x.n, 0) / tot) : null; const wk = (d.week as any[]).filter(w => w.on != null && w.n >= 3);
  const bestW = wk.length > 1 ? wk.reduce((a, b) => (b.on > a.on ? b : a)) : null, worstW = wk.length > 1 ? wk.reduce((a, b) => (b.on < a.on ? b : a)) : null;
  return <Hero cls="v55-tl" tone={tone(on)} kicker={(title || "Reliability timeline").toUpperCase()} verdict={on == null ? "Not enough data" : `${on}% on time`} sub={`${full.length} full days observed${bestW && worstW && bestW !== worstW ? ` · best ${bestW.day} (${bestW.on}%), worst ${worstW.day} (${worstW.on}%)` : ""}`} foot={`${d.scope} Source: ${d.source}.`}>
    <div className="v55-bars" role="img" aria-label="On-time percentage per day">{d.days.map((x: any) => <div key={x.date} className={"v55-bar t-" + tone(x.on) + (x.date === d.today ? " part" : "")} title={`${x.date}: ${pc(x.on)} on time, ${x.n} flights, avg ${x.avg ?? "—"} min`}><span style={{ height: `${Math.max(4, x.on ?? 0)}%` }} /><i>{x.date.slice(8)}</i><em>{x.on ?? "—"}</em></div>)}</div>
    {wk.length > 1 && <div className="v55-wk">{wk.map(w => <span key={w.day} className={"t-" + tone(w.on)}><i>{w.day}</i><b>{w.on}%</b><em>{w.n}</em></span>)}</div>}
    {wk.length > 1 && <div className="faint xs mt8">Weekday row: on-time % and flights (days with 3+ flights). Hatched bar = today so far.</div>}
    {d.todayDest?.length > 0 && <div className="v55-dest"><div className="faint xs">Busiest destinations today</div>{d.todayDest.map((t: any) => onDest ? <button key={t[0]} className="press" onClick={() => onDest(t[0])}>{t[0]} <b>{t[1]}</b></button> : <span key={t[0]} className="v55-chip">{t[0]} <b>{t[1]}</b></span>)}</div>}
  </Hero>; }

/** Aircraft type: where it's flying now (ADS-B) */
export function TypeLive({ q, push }: { q: string; push?: (o: any) => void }) { const [d, setD] = useState<any>(null);
  useEffect(() => { api("/type-live?t=" + encodeURIComponent(q)).then(setD).catch(() => setD({ none: true })); }, [q]);
  if (!d) return null; if (d.none || !d.seen) return <div className="card"><h3>Seen live on ADS-B</h3><div className="muted sm">{d.reason || `Skyline's feed hasn't seen a ${q.toUpperCase()} in the last 24 hours.`}</div></div>;
  const mx = d.ops[0]?.[1] || 1;
  return <Hero cls="v55-type" tone="info" kicker="SEEN LIVE ON ADS-B" verdict={`${d.seen} aircraft`} sub={`${d.airborne} airborne at last contact · ${d.window}`} foot={`${d.source}. ${d.rule}`}>
    <div className="v55-ops">{d.ops.map(([k, n]: any) => <button key={k} className="press" disabled={k.length !== 3} onClick={() => push?.({ t: "airline", icao: k })}><i>{k}</i><span><b style={{ width: `${n / mx * 100}%` }} /></span><em>{n}</em></button>)}</div></Hero>; }

/** Pinned airports dashboard */
function PinRow({ iata, push, un }: { iata: string; push: (o: any) => void; un: () => void }) { const [w, setW] = useState<any>(null); const [t, setT] = useState<any>(null);
  useEffect(() => { api("/wx/" + iata).then(setW).catch(() => setW({})); api(`/trend?kind=airport&q=${iata}`).then(setT).catch(() => setT({})); }, [iata]);
  const m = w?.metar?.[0]; const td = t?.days?.find((x: any) => x.date === t.today);
  return <div className={"card v55-pin t-" + tone(td?.on ?? null)}><div className="row between"><button className="v55-pin-h press" onClick={() => push({ t: "guide", iata })}><b>{iata}</b><small>{m?.name?.split(",")[0] || ""}</small></button><button className="v55-x" onClick={un} aria-label={`Unpin ${iata}`}>★</button></div>
    <div className="v55-pg"><span><i>Weather</i><b>{!w ? "…" : m ? `${m.fltCat || "—"} · ${m.temp}°C` : "No METAR"}</b><em>{m ? `${m.wdir === "VRB" ? "VRB" : m.wdir + "°"} ${m.wspd} kt` : ""}</em></span>
      <span><i>Departures today</i><b>{!t ? "…" : td ? td.n : "None seen"}</b><em>{td ? `${pc(td.on)} on time` : ""}</em></span><span><i>Avg delay</i><b>{td?.avg != null ? `${td.avg} min` : "—"}</b><em>{td?.cancelled ? `${td.cancelled} cancelled` : ""}</em></span></div>
    <div className="v55-pa"><button className="press" onClick={() => push({ t: "board", iata })}>Board</button><button className="press" onClick={() => push({ t: "guide", iata })}>Airport hub</button></div></div>; }
export function PinnedDash({ x, push }: { x: any; push: (o: any) => void }) { const [P, setP] = useState<string[]>(() => ls("sk.pins.apt", []));
  const un = (i: string) => { const n = P.filter(p => p !== i); save("sk.pins.apt", n); setP(n); };
  return <div className="fd"><div className="head"><div><span className="tag">PINNED AIRPORTS</span><h1 className="h1s">Your airports</h1><div className="muted sm">Live METAR and today's observed departures</div></div>{x}</div>
    {!P.length ? <div className="card"><h3>No pinned airports yet</h3><div className="muted sm">Open any airport hub and tap ☆ Pin airport. Pinned airports appear here and on Home.</div><button className="btn sm mt8" onClick={() => push({ t: "guide", iata: "MAN" })}>Open MAN airport hub</button></div> : P.map(i => <PinRow key={i} iata={i} push={push} un={() => un(i)} />)}
    {P.length > 0 && <div className="faint xs px">Weather: aviationweather.gov METAR. Departures: Skyline observed log (today so far; on time = under 15 min late).</div>}</div>; }

/** Spotting map: SVG plot of OSM spots + hotels around the airport */
export function SpotMap({ d, lat, lon }: { d: any; lat?: number; lon?: number }) { if (!d || d.error || lat == null || lon == null) return null; const P = [...(d.spots || []).map((p: any) => ({ ...p, k: "s" })), ...(d.hotels || []).slice(0, 6).map((p: any) => ({ ...p, k: "h" }))]; if (!P.length) return null;
  const R = 6, c = Math.cos(lat * Math.PI / 180); const xy = (p: any) => [100 + (p.lon - lon) * c * 111 / R * 90, 100 - (p.lat - lat) * 111 / R * 90];
  return <div className="v55-map"><svg viewBox="0 0 200 200" role="img" aria-label="Map of spotting spots and hotels around the airport">{[2, 4, 6].map(r => <g key={r}><circle cx="100" cy="100" r={r / R * 90} className="ring" /><text x={100 + r / R * 90 * .707 + 2} y={100 - r / R * 90 * .707} className="rl">{r} km</text></g>)}<text x="100" y="8" className="n">N</text>
    <text x="100" y="104" className="ap">✈</text>{P.map((p, i) => { const [x, y] = xy(p); return <g key={i}><circle cx={x} cy={y} r={p.k === "s" ? 4.5 : 3} className={p.k === "s" ? (p.spotting ? "sp" : "vp") : "ht"} />{p.k === "s" && <text x={x + 6} y={y + 3} className="lb">{i + 1}</text>}</g>; })}</svg>
    <div className="v55-leg"><span><i className="sp" />Spotting spot</span><span><i className="vp" />Viewpoint</span><span><i className="ht" />Hotel</span></div></div>; }

/** Trip itinerary + budget */
type Line = { k: string; v: number };
export function TripPlan({ x, flights, extra }: { x: any; flights: Flight[]; extra?: any }) { const now = Date.now() - 864e5; const up = flights.filter(f => !f.example && Date.parse(f.date) >= now - 864e5).sort((a, b) => (a.dep?.scheduled || a.date).localeCompare(b.dep?.scheduled || b.date));
  const [B, setB] = useState<Line[]>(() => ls("sk.budget", [{ k: "Flights", v: 0 }, { k: "Accommodation", v: 0 }, { k: "Food & drink", v: 0 }, { k: "Transport", v: 0 }])); const [cur, setCur] = useState<string>(() => ls("sk.budget.cur", "£"));
  const set = (n: Line[]) => { setB(n); save("sk.budget", n); };
  const miles = up.reduce((s, f) => s + dist(f.origin as any, f.destination as any), 0); const mins = up.reduce((s, f) => s + (f.dep?.scheduled && f.arr?.scheduled ? (Date.parse(f.arr.scheduled) - Date.parse(f.dep.scheduled)) / 6e4 : 0), 0);
  const first = up[0]?.date?.slice(0, 10), last = up[up.length - 1]?.date?.slice(0, 10); const nights = first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 864e5) : 0; const total = B.reduce((s, l) => s + (+l.v || 0), 0);
  return <div className="fd"><div className="head"><div><span className="tag">TRIP PLANNER</span><h1 className="h1s">Itinerary & budget</h1><div className="muted sm">Built from your saved flights</div></div>{x}</div>{extra}
    {!up.length ? <div className="card"><h3>No upcoming flights</h3><div className="muted sm">Add a flight on Home and it appears here as an itinerary with distance, time in the air and a budget.</div></div> : <>
      <Hero cls="v55-trip" tone="info" kicker="YOUR ITINERARY" verdict={`${up.length} flight${up.length > 1 ? "s" : ""}`} sub={`${first}${last && last !== first ? ` → ${last} · ${nights} night${nights === 1 ? "" : "s"}` : ""}`} foot="Distance is great-circle between airports; time in the air uses scheduled times only (flights without both times are left out).">
        <div className="v55-tg"><span><i>Distance</i><b>{Math.round(miles * 1.609).toLocaleString("en-GB")} km</b></span><span><i>Scheduled air time</i><b>{mins ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : "—"}</b></span><span><i>Airports</i><b>{new Set(up.flatMap(f => [f.origin?.iata, f.destination?.iata]).filter(Boolean)).size}</b></span></div></Hero>
      <div className="card v55-it">{up.map((f, i) => { const nx = up[i + 1]; const gap = nx && f.arr?.scheduled && nx.dep?.scheduled ? (Date.parse(nx.dep.scheduled) - Date.parse(f.arr.scheduled)) / 6e4 : null;
        return <div key={f.id}><div className="v55-leg2"><i /><div><b>{f.number} · {f.origin?.iata} → {f.destination?.iata}</b><small>{f.date.slice(0, 10)} · {fmtT(f.dep?.scheduled, (f.origin as any)?.tz)} – {f.arr?.scheduled ? fmtT(f.arr.scheduled, (f.destination as any)?.tz) : "arr. time not published"} local</small></div></div>
          {gap != null && gap > 0 && <div className="v55-gap">{gap < 24 * 60 ? `${Math.floor(gap / 60)}h ${Math.round(gap % 60)}m connection${gap < 60 ? " — tight" : ""}` : `${Math.round(gap / 1440)} days in ${f.destination?.city || f.destination?.iata}`}</div>}</div>; })}</div></>}
    <div className="card v55-bud"><div className="row between"><h3>Budget</h3><select value={cur} onChange={e => { setCur(e.target.value); save("sk.budget.cur", e.target.value); }} aria-label="Currency">{["£", "€", "$"].map(c => <option key={c}>{c}</option>)}</select></div>
      {B.map((l, i) => <div key={i} className="v55-bl"><input value={l.k} onChange={e => set(B.map((y, j) => j === i ? { ...y, k: e.target.value } : y))} aria-label="Item" /><span>{cur}</span><input type="number" inputMode="decimal" value={l.v || ""} placeholder="0" onChange={e => set(B.map((y, j) => j === i ? { ...y, v: +e.target.value } : y))} aria-label={`${l.k} amount`} /><button onClick={() => set(B.filter((_, j) => j !== i))} aria-label="Remove">×</button></div>)}
      <button className="btn sm mt8" onClick={() => set([...B, { k: "Other", v: 0 }])}>+ Add line</button>
      <div className="v55-tot"><span>Total</span><b>{cur}{total.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</b></div>{nights > 0 && total > 0 && <div className="faint xs">{cur}{(total / nights).toFixed(0)} per night over {nights} nights</div>}
      <div className="faint xs mt8">Amounts are what you type — Skyline has no price data. Saved on this device only.</div></div></div>; }

/** Airline vs airline */
// Skyline logs flight numbers as boards print them (often IATA, e.g. FR1234), so also query the IATA prefix for common ICAO codes.
const I2: Record<string, string> = { EZY: "U2", EJU: "U2", RYR: "FR", RUK: "RK", EXS: "LS", BAW: "BA", TOM: "BY", WZZ: "W6", WUK: "W9", EIN: "EI", KLM: "KL", TAP: "TP", LOG: "LM", AFR: "AF", DLH: "LH", VLG: "VY", IBE: "IB", SAS: "SK", UAE: "EK", QTR: "QR", TCX: "MT", JBU: "B6", AUR: "UX", NAX: "DY", BEE: "BE", LOT: "LO" };
export function AirlineCompare() { const [a, setA] = useState(() => ls("sk.cmpal", ["EZY", "RYR"])[0]); const [b, setB] = useState(() => ls("sk.cmpal", ["EZY", "RYR"])[1]); const [d, setD] = useState<any>(null);
  const go = () => { save("sk.cmpal", [a, b]); setD(null); Promise.all([a, b].map(c => api(`/airline-page?pre=${[c, I2[c]].filter(Boolean).join(",")}&icao=${c}`).catch(e => ({ error: e.message })))).then(setD); }; useEffect(go, []);
  const R: [string, string, (s: any) => any, number][] = [["on", "On time", s => pc(s.on), 1], ["avg", "Avg delay", s => s.avg == null ? "—" : `${s.avg} min`, -1], ["flights", "Departures seen", s => s.flights, 0], ["cancelled", "Cancelled", s => s.cancelled, -1], ["fleet", "Fleet on ADS-B", s => s.fleet?.seen ?? "—", 0]];
  const win = (k: string, dir: number, me: any, ot: any) => dir && me?.flights && ot?.flights && me[k] != null && ot[k] != null && (dir > 0 ? me[k] > ot[k] : me[k] < ot[k]);
  return <><div className="card v54-cin"><input value={a} onChange={e => setA(e.target.value.toUpperCase())} aria-label="First airline ICAO code" placeholder="EZY" /><span>vs</span><input value={b} onChange={e => setB(e.target.value.toUpperCase())} aria-label="Second airline ICAO code" placeholder="RYR" /><button className="press" onClick={go}>Compare</button></div>
    {!d ? <div className="card muted sm">Loading…</div> : <div className="card"><div className="v54-cg">{d.map((s: any, i: number) => <div key={i} className="v54-col"><b>{[a, b][i]}</b>{s.error ? <div className="muted sm">{s.error}</div> : !s.flights ? <div className="muted sm">No observed departures for this code.</div> : R.map(([k, l, f, dir]) => <div key={k} className={"v54-cr" + (win(k, dir, s, d[1 - i]) ? " win" : "")}><i>{l}</i><b>{f(s)}</b></div>)}</div>)}</div>
      <div className="faint xs mt8">Use ICAO airline codes (EZY, RYR, BAW, EXS…). Green = better of the two. {d[0]?.scope || ""}</div></div>}
    {d && d[0]?.pre && d[1]?.pre && <SharedRoutes a={d[0].pre} b={d[1].pre} la={a} lb={b} />}</>; }
