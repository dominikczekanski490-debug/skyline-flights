// v54 — hub links, airport pins, METAR dashboard, spotting + hotels (OSM), route comparison, daily spotlight, packing list.
// Rule-based only; every number is from an airport board (Skyline observed log), aviationweather.gov METAR, OpenStreetMap or Open-Meteo.
import { useEffect, useState } from "react";
import { api, type Flight } from "./lib";
import { Hero } from "./v47";
import "./v54.css";

const ls = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const save = (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v));
const pct = (n: number | null) => n == null ? "—" : n + "%";
const mins = (n: number | null) => n == null ? "—" : (n > 0 ? "+" : "") + n + " min";

/** 1. Flight sheet → airline / aircraft type / airport hubs */
export function HubLinks({ f, type, push }: { f: Flight; type?: string; push: (o: any) => void }) {
  const al = f.airline; const L: [string, string, () => void][] = [];
  if (al?.iata || al?.icao) L.push(["✈︎", `${al.name || al.iata} airline page`, () => push({ t: "airline", iata: al.iata, icao: al.icao, name: al.name })]);
  if (type) L.push(["🛩", `${type} aircraft page`, () => push({ t: "type", q: type })]);
  if (f.destination?.iata) L.push(["🛬", `${f.destination.iata} airport hub`, () => push({ t: "guide", iata: f.destination!.iata })]);
  if (f.origin?.iata && f.destination?.iata) L.push(["⚖︎", "Compare this route", () => push({ t: "cmp", a: `${f.origin!.iata}-${f.destination!.iata}` })]);
  if (!L.length) return null;
  return <div className="card v54-hub"><h3>Explore</h3><div className="v54-hub-g">{L.map(([i, t, fn]) => <button key={t} className="press" onClick={fn}><span>{i}</span><b>{t}</b><em>›</em></button>)}</div></div>; }

/** 2. Pin an airport (feeds Home pins) */
export function PinApt({ iata }: { iata: string }) { const [p, setP] = useState<string[]>(() => ls("sk.pins.apt", []));
  const on = p.includes(iata); const tog = () => { const n = on ? p.filter(x => x !== iata) : [...p, iata].slice(-8); save("sk.pins.apt", n); setP(n); };
  return <button className={"v54-pin press" + (on ? " on" : "")} onClick={tog} aria-pressed={on}>{on ? "★ Pinned" : "☆ Pin airport"}</button>; }

/** 3. METAR dashboard */
const CAT: Record<string, [string, string]> = { VFR: ["good", "Visual flight rules — good conditions"], MVFR: ["warn", "Marginal VFR — some low cloud or haze"], IFR: ["bad", "Instrument rules — low cloud or poor visibility"], LIFR: ["bad", "Low IFR — very poor visibility / cloud"] };
export function MetarDash({ iata }: { iata: string }) { const [d, setD] = useState<any>(null);
  useEffect(() => { api("/wx/" + iata).then(setD).catch(e => setD({ error: e.message })); }, [iata]);
  if (!d) return <div className="card"><h3>Weather now (METAR)</h3><div className="muted sm">Loading…</div></div>;
  const m = d.metar?.[0]; if (!m) return <div className="card"><h3>Weather now (METAR)</h3><div className="muted sm">{d.error ? `Weather feed unavailable (${d.error}).` : `${iata} has no recent METAR report.`}</div></div>;
  const c = CAT[m.fltCat] || ["", m.fltCat || "Unknown category"]; const age = Math.round((Date.now() / 1000 - m.obsTime) / 60);
  const H = (d.metar as any[]).slice(0, 8).reverse(); const tmin = Math.min(...H.map(x => x.temp)), tmax = Math.max(...H.map(x => x.temp));
  const cl = (m.clouds || []).map((x: any) => `${x.cover}${x.base != null ? " " + x.base + " ft" : ""}`).join(", ") || "No cloud reported";
  return <Hero cls="v54-metar" tone={c[0] || "info"} kicker={`WEATHER NOW · ${m.icaoId}`} verdict={<>{m.fltCat || "—"} <small>{m.temp}°C</small></>} sub={c[1]}
    foot={`aviationweather.gov METAR · observed ${age} min ago · category is the official flight category`}>
    <div className="v54-mg"><span><i>Wind</i><b>{m.wdir === "VRB" ? "Variable" : m.wdir + "°"} {m.wspd} kt{m.wgst ? ` G${m.wgst}` : ""}</b></span><span><i>Visibility</i><b>{m.visib === "6+" ? "10 km+" : m.visib + " sm"}</b></span><span><i>Pressure</i><b>{m.altim} hPa</b></span><span><i>Dew point</i><b>{m.dewp}°C</b></span></div>
    <div className="faint xs mt8">Cloud: {cl}</div>
    {H.length > 2 && <div className="v54-spark" aria-label="Temperature over recent reports">{H.map((x, i) => <span key={i} style={{ height: 8 + (tmax > tmin ? (x.temp - tmin) / (tmax - tmin) : .5) * 26 }} title={`${x.temp}°C`} />)}<em>{H.length} reports · {tmin}–{tmax}°C</em></div>}
    <code className="v54-raw">{m.rawOb}</code></Hero>; }

/** 4. Plane-spotting spots + hotels nearby (OSM) */
export function AroundApt({ iata }: { iata: string }) { const [d, setD] = useState<any>(null);
  useEffect(() => { let on = true, n = 0; const go = () => api("/apt-around/" + iata).then(r => on && setD(r)).catch(e => { if (!on) return; if (n++ < 2) setTimeout(go, 20000); else setD({ error: e.message }); }); go(); return () => { on = false; }; }, [iata]);
  const map = (p: any) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`;
  const body = (L: any[], none: string, k: "s" | "h") => !d ? <div className="muted sm">Asking OpenStreetMap (can take a minute the first time)…</div> : d.error ? <div className="muted sm">OpenStreetMap isn't reachable right now ({d.error}).</div> : !L.length ? <div className="muted sm">{none}</div>
    : L.slice(0, 6).map((p: any, i: number) => <a key={i} className="row between ckrow" href={k === "h" && p.web ? p.web : map(p)} target="_blank" rel="noreferrer"><span>{k === "s" && p.spotting ? "📸 " : ""}{p.name || "Unnamed viewpoint"}{p.stars ? ` · ${p.stars}★` : ""}</span><span className="faint sm">{p.km} km ›</span></a>);
  return <><div className="card"><div className="row between"><h3>Plane-spotting spots</h3><span className="faint xs">OpenStreetMap</span></div>{body(d?.spots || [], `No viewpoints are mapped in OpenStreetMap within 6 km of ${iata}.`, "s")}<div className="faint xs mt8">📸 = named as a spotting / viewing area. Others are general viewpoints; check access and local rules before you go.</div></div>
    <div className="card"><div className="row between"><h3>Hotels near {iata}</h3><span className="faint xs">OpenStreetMap</span></div>{body(d?.hotels || [], `No hotels are mapped in OpenStreetMap within 3 km of ${iata}.`, "h")}<div className="faint xs mt8">Straight-line distance from the airport reference point. No prices — Skyline has no booking data.</div></div></>; }

/** 5. Route comparison */
function Col({ s, w }: { s: any; w: (k: string) => boolean }) { if (!s.flights) return <div className="v54-col"><b>{s.route}</b><div className="muted sm">No observed flights on this route yet.</div></div>;
  return <div className="v54-col"><b>{s.route}</b><small>{s.apO} → {s.apT}</small>{([["on", "On time", pct(s.on)], ["avg", "Avg delay", mins(s.avg)], ["late30", "30+ min late", pct(s.late30)], ["cancelled", "Cancelled", String(s.cancelled)], ["perDay", "Flights / day", String(s.perDay)], ["flights", "Sample", `${s.flights} over ${s.days} days`]] as const).map(([k, l, v]) => <div key={k} className={"v54-cr" + (w(k) ? " win" : "")}><i>{l}</i><b>{v}</b></div>)}<div className="faint xs mt8">{s.carriers.map((c: any) => `${c[0]} ${c[1]}`).join(" · ")}</div></div>; }
export function RouteCompare({ a0, x }: { a0?: string; x: any }) { const [a, setA] = useState(a0 || ls("sk.cmp", ["MAN-ALC", "EMA-ALC"])[0]); const [b, setB] = useState(ls("sk.cmp", ["MAN-ALC", "EMA-ALC"])[1]); const [d, setD] = useState<any>(null);
  const go = () => { save("sk.cmp", [a, b]); setD(null); api(`/route-compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`).then(setD).catch(e => setD({ error: e.message })); };
  useEffect(go, []);
  const better = (k: string, me: any, ot: any) => { if (!me?.flights || !ot?.flights) return false; const hi = k === "on" || k === "perDay"; if (!["on", "avg", "late30", "cancelled", "perDay"].includes(k)) return false; return hi ? me[k] > ot[k] : me[k] < ot[k]; };
  return <div className="fd"><div className="head"><div><span className="tag">COMPARE ROUTES</span><h1 className="h1s">Route vs route</h1><div className="muted sm">Reliability from departures Skyline has observed</div></div>{x}</div>
    <div className="card v54-cin"><input value={a} onChange={e => setA(e.target.value.toUpperCase())} placeholder="MAN-ALC" aria-label="First route" /><span>vs</span><input value={b} onChange={e => setB(e.target.value.toUpperCase())} placeholder="EMA-ALC" aria-label="Second route" /><button className="press" onClick={go}>Compare</button></div>
    {!d ? <div className="card muted sm">Loading…</div> : d.error ? <div className="card bad sm">{d.error}</div> : <div className="card"><div className="v54-cg"><Col s={d.a} w={k => better(k, d.a, d.b)} /><Col s={d.b} w={k => better(k, d.b, d.a)} /></div><div className="faint xs mt8">Green = better of the two. {d.scope} Source: {d.source}.</div></div>}</div>; }

/** 6. Daily spotlight: airport + airline of the day */
export function Spotlight({ push }: { push: (o: any) => void }) { const [d, setD] = useState<any>(null);
  useEffect(() => { api("/spotlight").then(setD).catch(() => setD({ error: 1 })); }, []);
  if (!d || d.error || (!d.airport && !d.airline)) return null; const A = d.airport, L = d.airline;
  return <div className="card v54-spot"><div className="row between"><h3>Today's spotlight</h3><span className="faint xs">{d.day}</span></div><div className="v54-sg">
    {A && <button className="press" onClick={() => push({ t: "guide", iata: A.k })}><i>Airport of the day</i><b>{A.k}</b><small>{A.city || A.name}</small><em>{A.flights} flights seen · {pct(A.on)} on time · avg {mins(A.avg)}</em><em>Busiest link: {A.top.map((t: any) => t[0]).join(", ")}</em></button>}
    {L && <button className="press" onClick={() => push({ t: "airline", iata: L.k })}><i>Airline of the day</i><b>{L.k}</b><small>Code {L.k}</small><em>{L.flights} flights seen · {pct(L.on)} on time · {L.cancelled} cancelled</em><em>Most seen at: {L.top.map((t: any) => t[0]).join(", ")}</em></button>}
  </div><div className="faint xs mt8">{d.rule} Source: {d.source}.</div></div>; }

/** 7. Packing list from the destination forecast (rules shown) */
export function PackList({ f }: { f: Flight }) { const o = f.origin?.iata, t = f.destination?.iata, date = f.date?.slice(0, 10); const [d, setD] = useState<any>(null); const [chk, setChk] = useState<Record<string, 1>>(() => ls("sk.pack." + f.id, {}));
  useEffect(() => { if (o && t && date) api(`/trip-wx?o=${o}&t=${t}&date=${date}`).then(setD).catch(() => setD({ err: 1 })); }, [o, t, date]);
  if (!d || d.err || d.out || !d.t?.hourly) return null; const h = d.t.hourly; const N = (k: string) => (h[k] || []).filter((v: any) => v != null) as number[];
  const T = N("temperature_2m"), F = N("apparent_temperature"), P = N("precipitation_probability"), G = N("wind_gusts_10m"), C = N("weather_code"); if (!T.length) return null;
  const mx = Math.max(...T), mn = Math.min(...F.length ? F : T), pr = P.length ? Math.max(...P) : 0, gu = G.length ? Math.max(...G) : 0, snow = C.some(c => (c >= 71 && c <= 77) || c === 85 || c === 86);
  const R: [string, string][] = [["Passport / ID & boarding pass", "Always"], ["Phone charger & power bank (in cabin bag)", "Always"]];
  if (o && t && o.slice(0, 1) !== t.slice(0, 1)) R.push(["Plug adaptor — check the socket type", "Origin and destination codes differ by region (rough rule)"]);
  if (mx >= 24) R.push(["Sunglasses, sun cream, light clothes", `High ${Math.round(mx)}°C (rule: ≥ 24°C)`]);
  if (mn <= 8) R.push(["Warm layer / coat", `Feels like ${Math.round(mn)}°C at the coldest (rule: ≤ 8°C)`]);
  if (mn <= 0) R.push(["Hat & gloves", `Feels-like below freezing (rule: ≤ 0°C)`]);
  if (pr >= 40) R.push(["Umbrella or rain jacket", `Up to ${pr}% chance of rain (rule: ≥ 40%)`]);
  if (gu >= 50) R.push(["Wind-proof layer — skip the umbrella", `Gusts up to ${Math.round(gu)} km/h (rule: ≥ 50 km/h)`]);
  if (snow) R.push(["Shoes with grip", "Snow in the forecast (weather codes 71–77, 85–86)"]);
  const tog = (k: string) => { const n = { ...chk }; if (n[k]) delete n[k]; else n[k] = 1; setChk(n); save("sk.pack." + f.id, n); };
  return <div className="card v54-pack"><div className="row between"><h3>Packing list · {d.t.city || t}</h3><span className="faint xs">{Object.keys(chk).length}/{R.length}</span></div>
    {R.map(([k, why]) => <label key={k} className={"v54-pi" + (chk[k] ? " done" : "")}><input type="checkbox" checked={!!chk[k]} onChange={() => tog(k)} /><span><b>{k}</b><em>{why}</em></span></label>)}
    <div className="faint xs mt8">Rule-based from the Open-Meteo forecast for {d.t.city || t}, {date} to 3 days after. Ticks are saved on this device.</div></div>; }
