// Radar-style airport page: an alternate look for the airport sheet (Settings → Airport page → Radar).
// Inspired by the layout of popular flight-tracker apps; Skyline branding only, no third-party names or logos.
// Every number shown comes from data the app already loads (board feeds, Open-Meteo, NOAA METAR, OurAirports, ADS-B);
// anything we can't source is left out or labelled.
import { useEffect, useMemo, useState } from "react";
import { api, today, delay, fmtT } from "./lib";
import { usePoll } from "./refresh";
import { withKtw } from "./fids";
import { AirlineTile } from "./brand";
import { CC, flag } from "./countries";
import { fTemp, wxSvg } from "./more";
import { wxText } from "./lib";
import "./radar.css";

const J = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const tOf = (t: any) => +new Date(t?.actual || t?.estimated || t?.scheduled || 0);
const cmp = (d: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((d % 360) + 360) % 360 / 45) % 8];
// Dot colour rule (same as the reference): green 0–15 min late, yellow 15–45, red 45+ or cancelled; grey when there's no time info yet.
export const dotOf = (f: any, dir: string) => { if (f.status === "cancelled") return "r"; const d = delay(dir === "dep" ? f.dep : f.arr); return d == null ? "g0" : d >= 45 ? "r" : d >= 15 ? "y" : "g"; };
const stLine = (f: any, dir: string, tz?: string) => { const t = dir === "dep" ? f.dep : f.arr;
  if (f.status === "cancelled") return "Cancelled";
  if (dir === "dep" && (t.actual || f.status === "departed" || f.status === "landed")) return t.actual ? "Departed " + fmtT(t.actual, tz) : "Departed";
  if (dir === "arr" && (t.actual || f.status === "landed")) return t.actual ? "Landed " + fmtT(t.actual, tz) : "Landed";
  if (t.estimated && t.estimated !== t.scheduled) return "Estimated " + fmtT(t.estimated, tz);
  return f.statusText && !/^scheduled$/i.test(f.statusText) ? String(f.statusText) : "Scheduled"; };
const airborne = (f: any, dir: string) => f.status !== "cancelled" && (dir === "dep" ? (f.status === "departed" && !f.arr?.actual) : (f.dep?.actual || f.status === "departed" || f.status === "enroute") && !f.arr?.actual && f.status !== "landed");

function useBoard(iata: string, dir: string) { const [d, setD] = useState<any>(null); const date = today();
  const poll = usePoll(() => api(`/board/${iata}?dir=${dir}&date=${date}`).then(r => withKtw(iata, dir, date, r)).then(setD).catch(e => setD((p: any) => p && !p.error ? p : { error: e.message })), [iata, dir, date]);
  return { d, poll }; }

function Row({ f, dir, tz, onOpen }: any) { const t = dir === "dep" ? f.dep : f.arr; const o = dir === "dep" ? f.destination : f.origin; const dot = dotOf(f, dir); const ty = f.aircraft?.type || f.aircraft?.model || "";
  return <button className="rd-row" onClick={onOpen}>
    <div className="rd-tm"><b>{f.liveOnly ? "Live" : fmtT(t.scheduled, tz)}</b><span><i className={"rd-dot " + dot} />{f.liveOnly ? f.statusText || "Live" : stLine(f, dir, tz)}</span></div>
    <span className="rd-al"><AirlineTile a={f.airline || { iata: (f.number || "").slice(0, 2) }} mode="colour" /></span>
    <div className="rd-mid"><div className="rd-city">{o?.city || o?.name || "Unknown"}{o?.iata && <em>{o.iata}</em>}</div>
      <div className="rd-fn">{f.number}{ty && <em>{ty}</em>}{airborne(f, dir) && <span className="rd-live">LIVE</span>}</div></div>
    <span className="rd-chev" aria-hidden>›</span></button>; }

function FlightList({ iata, dir, tz, push, B }: any) { const [early, setEarly] = useState(false); const now = Date.now();
  const all = ((B.d?.flights || []) as any[]).slice().sort((a, b) => a.liveOnly ? 0 : +new Date((dir === "dep" ? a.dep : a.arr).scheduled) - +new Date((dir === "dep" ? b.dep : b.arr).scheduled));
  const cut = now - 60 * 60e3; const old = all.filter(f => !f.liveOnly && tOf(dir === "dep" ? f.dep : f.arr) < cut); const L = early ? all : all.filter(f => !old.includes(f));
  if (!B.d) return <div className="rd-pad"><div className="rd-skel" /><div className="rd-skel" /><div className="rd-skel" /></div>;
  if (B.d.error && !all.length) return <div className="rd-pad rd-note">{dir === "dep" ? "Departures" : "Arrivals"} for {iata} aren't available right now ({B.d.error}).</div>;
  return <div className="rd-list">{old.length > 0 && <button className="rd-earlier" onClick={() => setEarly(v => !v)}>{early ? "Hide earlier flights" : `Earlier flights (${old.length})`}</button>}
    {L.map((f, i) => <Row key={f.id + ":" + i} f={f} dir={dir} tz={tz} onOpen={() => push({ t: "flight", f: { ...f, date: today() } })} />)}
    {!L.length && <div className="rd-note">No more {dir === "dep" ? "departures" : "arrivals"} listed today.</div>}
    <div className="rd-src">{B.d.sourceKind === "derived" ? "Times estimated from destination boards" : B.d.liveOnly ? "Live ADS-B only: this airport has no public timetable feed" : "Airport timetable feed"} · refreshes every 4 min</div></div>; }

function Ground({ iata, info }: { iata: string; info: any }) { const [d, setD] = useState<any>(null); const [e, setE] = useState(""); const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 20e3); return () => clearTimeout(t); }, [iata]);
  useEffect(() => { let on = true; const go = () => document.visibilityState === "visible" && api(`/airport/${iata}/traffic`).then(j => { if (on) { setD(j); setE(""); } }).catch(x => on && setE(x.message)); go(); const t = setInterval(go, 30e3); return () => { on = false; clearInterval(t); }; }, [iata]);
  if (!d) return <div className="rd-pad rd-note">{e || slow ? <>The live aircraft list isn't responding right now{e ? ` (${e})` : ""}. Trying again every 30 s.{info?.live ? <><br /><br /><b>{info.live.ground}</b> aircraft on the ground within 25 nm, from the last ADS-B count ({info.live.source}).</> : null}</> : "Looking for aircraft on the ground…"}</div>;
  const L = (d.list || []).filter((a: any) => a.cls === "ground");
  return <div className="rd-list">{L.map((a: any) => <div key={a.hex} className="rd-row gnd"><div className="rd-tm"><b>{a.reg || a.hex.toUpperCase()}</b><span><i className="rd-dot g0" />{a.gs > 5 ? `Taxiing ${Math.round(a.gs)} kt` : "Parked"}</span></div>
      <span className="rd-al"><AirlineTile a={{ iata: "", name: (a.cs || "").slice(0, 3) || "?" }} mode="colour" /></span>
      <div className="rd-mid"><div className="rd-city">{a.cs || "No callsign"}</div><div className="rd-fn">{a.type ? <em>{a.type}</em> : <span className="rd-muted">Type unknown</span>}<span className="rd-muted">{a.nm} nm</span></div></div></div>)}
    {!L.length && <div className="rd-note">No aircraft on the ground are broadcasting near {iata} right now.</div>}
    <div className="rd-src">{L.length} on the ground · live ADS-B within 40 nm · updates every 30 s · only aircraft with transponders on are seen</div></div>; }

function Sec({ t, children, more }: any) { return <section className="rd-sec"><div className="rd-sh"><h3>{t}</h3>{more}</div>{children}</section>; }

function General({ iata, info, facts, ap, wx, dep, arr, tz, go, push }: any) {
  const [mx, setMx] = useState(false); const w = info?.weather; const m = wx?.metar?.[0]; const now = Date.now();
  const D = (dep.d?.flights || []) as any[], A = (arr.d?.flights || []) as any[]; const timed = !dep.d?.liveOnly && D.some(f => f.dep?.scheduled);
  const dis = (L: any[], dir: string) => { const r = L.filter(f => { const t = +new Date((dir === "dep" ? f.dep : f.arr).scheduled || 0); return t && t <= now && t > now - 4 * 3600e3; }); if (r.length < 3) return null;
    const canc = r.filter(f => f.status === "cancelled").length / r.length; const ds = r.filter(f => f.status !== "cancelled").map(f => Math.max(0, delay(dir === "dep" ? f.dep : f.arr) ?? 0)); const avg = ds.length ? Math.round(ds.reduce((a, c) => a + c, 0) / ds.length) : 0; const l30 = ds.filter(x => x >= 30).length / r.length;
    return { n: r.length, idx: Math.round(50 * (0.45 * Math.min(canc / 0.2, 1) + 0.35 * Math.min(avg / 60, 1) + 0.2 * Math.min(l30 / 0.5, 1))) / 10, avg }; };
  const dd = dis(D, "dep"), da = dis(A, "arr");
  const offs = D.filter(f => f.dep?.actual).sort((a, b) => tOf(b.dep) - tOf(a.dep)).slice(0, 4); const lands = A.filter(f => f.arr?.actual).sort((a, b) => tOf(b.arr) - tOf(a.arr)).slice(0, 4);
  const st = useMemo(() => { if (!timed) return null; const dest: Record<string, any> = {}; const cs = new Set<string>(); const hr: number[] = Array(24).fill(0);
    D.forEach(f => { const o = f.destination; if (o?.iata) { (dest[o.iata] ||= { a: o, n: 0 }).n++; if (o.country) cs.add(o.country); } });
    A.forEach(f => { const o = f.origin; if (o?.iata) { (dest[o.iata] ||= { a: o, n: 0 }).n++; if (o.country) cs.add(o.country); } });
    [...D.map(f => f.dep?.scheduled), ...A.map(f => f.arr?.scheduled)].forEach(s => { if (s) { const h = +new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }) % 24; hr[h]++; } });
    return { aps: Object.keys(dest).length, cs: cs.size, top: Object.values(dest).sort((a: any, b: any) => b.n - a.n).slice(0, 5), mv: D.length + A.length, dep: D.length, arr: A.length, canc: [...D, ...A].filter(f => f.status === "cancelled").length, hr }; }, [dep.d, arr.d]);
  const rws = (info?.runways || []) as any[];
  const inUse = useMemo(() => { if (!m || m.wdir == null || typeof m.wdir !== "number" || !rws.length) return null; const ends: any[] = []; rws.forEach(r => { if (r.heading == null) return; ends.push({ id: r.le, h: r.heading }); if (r.he) ends.push({ id: r.he, h: (r.heading + 180) % 360 }); });
    if (!ends.length) return null; const b = ends.map(e => ({ ...e, hw: (m.wspd || 0) * Math.cos((m.wdir - e.h) * Math.PI / 180) })).sort((x, y) => y.hw - x.hw)[0]; return b; }, [m, info]);
  const p = facts?.photo; const hmx = st ? Math.max(1, ...st.hr) : 1;
  return <div className="rd-gen">
    {p ? <div className="rd-car"><figure><img src={p.url} alt={`${p.kind} of ${facts.name}`} loading="lazy" decoding="async" /><figcaption>© <a href={p.page} target="_blank" rel="noopener">{p.author}</a> · {p.licence} · Wikimedia Commons</figcaption></figure></div>
      : facts ? <div className="rd-car none">No openly licensed photo found for this airport</div> : <div className="rd-car"><div className="rd-skel tall" /></div>}
    <Sec t="Weather">{w ? <div className="rd-wx"><div><small>Conditions</small><span className="rd-wi">{wxSvg(w.weather_code)}</span><b>{wxText(w.weather_code)}</b></div><div><small>Temperature</small><b className="big">{fTemp(w.temperature_2m)}</b></div><div><small>Wind</small><span className="rd-wd" style={{ transform: `rotate(${(w.wind_direction_10m || 0) + 180}deg)` }}>↑</span><b className="nc">{cmp(w.wind_direction_10m || 0)} {Math.round(w.wind_speed_10m)} kt</b></div></div> : <div className="rd-note">{info ? "Weather unavailable" : "Loading weather…"}</div>}
      <button className="rd-more" onClick={() => setMx(v => !v)}>{mx ? "Less weather" : "More weather & METAR"} <span>›</span></button>
      {mx && <div className="rd-metar">{m ? <><div className="rd-kv"><span>Flight category</span><b>{m.fltCat || "—"}</b></div>{w?.visibility != null && <div className="rd-kv"><span>Visibility</span><b>{w.visibility >= 10000 ? "10 km+" : `${(w.visibility / 1000).toFixed(1)} km`}</b></div>}{w?.wind_gusts_10m != null && <div className="rd-kv"><span>Gusts</span><b>{Math.round(w.wind_gusts_10m)} kt</b></div>}{m.altim != null && <div className="rd-kv"><span>Pressure (QNH)</span><b>{Math.round(m.altim)} hPa</b></div>}<code>{m.rawOb}</code><div className="rd-src">METAR: aviationweather.gov (NOAA) · conditions: Open-Meteo</div></> : <div className="rd-note">No recent METAR for {iata}.</div>}</div>}</Sec>
    <Sec t="Disruptions">{dd || da ? <div className="rd-dis">{([["Departures", dd], ["Arrivals", da]] as const).map(([n, x]) => <div key={n}><small>{n}</small>{x ? <><b className={x.idx >= 3 ? "r" : x.idx >= 1.5 ? "y" : "g"}>{x.idx.toFixed(1)}</b><span>Average delay {x.avg} min</span></> : <span className="rd-muted">Not enough flights</span>}</div>)}</div> : <div className="rd-note">{!dep.d ? "Loading…" : timed ? "Not enough flights in the last 4 hours to score." : "Needs a timetable feed, which this airport doesn't have."}</div>}
      <div className="rd-src">Skyline index 0–5 from today's board, last 4 hours (cancellations, average delay, flights 30+ min late)</div></Sec>
    {timed && <Sec t="Takeoffs" more={<button className="rd-link" onClick={() => go("dep")}>More</button>}>{offs.length ? offs.map(f => <Row key={f.id} f={f} dir="dep" tz={tz} onOpen={() => push({ t: "flight", f: { ...f, date: today() } })} />) : <div className="rd-note">No takeoffs recorded yet today.</div>}</Sec>}
    {timed && <Sec t="Landings" more={<button className="rd-link" onClick={() => go("arr")}>More</button>}>{lands.length ? lands.map(f => <Row key={f.id} f={f} dir="arr" tz={tz} onOpen={() => push({ t: "flight", f: { ...f, date: today() } })} />) : <div className="rd-note">No landings recorded yet today.</div>}</Sec>}
    <Sec t="Airport statistics">{st ? <><div className="rd-stats"><div><b>{st.aps}</b><small>Airports served today</small></div><div><b>{st.cs}</b><small>Countries served today</small></div><div><b>{st.mv}</b><small>Scheduled movements today</small></div><div><b>{st.canc}</b><small>Cancelled today</small></div></div>
        <h4>Busiest routes today</h4>{st.top.map((r: any) => <div key={r.a.iata} className="rd-bar"><span>{r.a.city || r.a.iata} <em>{r.a.iata}</em></span><i style={{ width: `${Math.round(r.n / st.top[0].n * 100)}%` }} /><b>{r.n}</b></div>)}
        <h4>Movements per hour today</h4><div className="rd-hrs">{st.hr.map((n: number, h: number) => <div key={h} title={`${h}:00 · ${n}`}><i style={{ height: `${Math.round(n / hmx * 100)}%` }} /><small>{h % 6 === 0 ? String(h).padStart(2, "0") : ""}</small></div>)}</div>
        <table className="rd-tbl"><thead><tr><th>Today</th><th>Departures</th><th>Arrivals</th><th>Total</th></tr></thead><tbody><tr><td>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz })}</td><td>{st.dep}</td><td>{st.arr}</td><td>{st.mv}</td></tr></tbody></table>
        {inUse && <div className="rd-kv"><span>Runway likely in use</span><b>{inUse.id}</b></div>}
        <div className="rd-src">Counted from today's airport board only. Earlier days and yearly totals aren't in our data, so they're not shown.{inUse ? " Runway is an estimate: the end most into the METAR wind; ATC may choose otherwise." : ""}</div></>
      : <div className="rd-note">{dep.d ? "Statistics need a timetable feed, which this airport doesn't have." : "Loading…"}</div>}</Sec>
    <Sec t="Airport & runway details"><div className="rd-det">{([["Name", ap?.name], ["IATA", iata], ["ICAO", ap?.icao], ["Time zone", tz?.replace("_", " ")], ["Elevation", ap?.elev ? `${ap.elev.toLocaleString()} ft (${Math.round(ap.elev * .3048)} m)` : null], ["Sunrise", info?.sun?.sunrise?.slice(11, 16)], ["Sunset", info?.sun?.sunset?.slice(11, 16)]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k} className="rd-kv"><span>{k}</span><b>{v}</b></div>)}</div>
      {rws.length > 0 && <><h4>Runways</h4>{rws.map(r => <div key={r.le + r.he} className="rd-kv"><span>{r.le}{r.he ? "/" + r.he : ""}</span><b>{r.lengthFt ? `${r.lengthFt.toLocaleString()} ft · ${Math.round(r.lengthFt * .3048).toLocaleString()} m` : "Length unknown"} · {({ ASP: "Asphalt", CON: "Concrete", GRS: "Grass", GRE: "Gravel" } as any)[String(r.surface).toUpperCase()] || r.surface || "Surface unknown"}</b></div>)}</>}
      <div className="rd-src">OpenFlights + OurAirports · sunrise/sunset Open-Meteo (local time)</div></Sec>
  </div>; }

export default function RadarAirport({ iata, onClose, push, onClassic }: { iata: string; onClose: () => void; push: (o: any) => void; onClassic: () => void }) {
  const [tab, setTab] = useState<"gen" | "dep" | "arr" | "gnd">(() => /[#&]dir=arr\b/.test(location.hash) ? "arr" : "gen");
  const dep = useBoard(iata, "dep"), arr = useBoard(iata, "arr");
  const [info, setInfo] = useState<any>(null); const [facts, setFacts] = useState<any>(null); const [ai, setAi] = useState<any>(null); const [wx, setWx] = useState<any>(null);
  useEffect(() => { api(`/airport/${iata}/info`).then(setInfo).catch(() => setInfo({})); api(`/airport/${iata}/facts`).then(setFacts).catch(() => setFacts({})); api(`/apinfo/${iata}`).then(setAi).catch(() => setAi({})); api(`/wx/${iata}`).then(setWx).catch(() => setWx({})); }, [iata]);
  const ap = { ...(dep.d?.airport || {}), ...(info?.airport || {}), elev: ai?.elev }; const tz = ap.tz || "Europe/London";
  const [now, setNow] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15e3); return () => clearInterval(t); }, []);
  const [fav, setFav] = useState(() => J("sk.pins.apt", []).includes(iata));
  const star = () => { const P: string[] = J("sk.pins.apt", []); const n = fav ? P.filter(x => x !== iata) : [...P, iata]; localStorage.setItem("sk.pins.apt", JSON.stringify(n)); setFav(!fav); };
  const cc = CC[ap.country] || (ap.country === "UK" ? "GB" : "");
  return <div className="rd">
    <header className="rd-hd"><div className="rd-hl"><h2>{ap.name || ap.city || iata}</h2>
        <div className="rd-codes">{cc && <span className="rd-flag">{flag(cc)}</span>}<b>{iata}</b>{ap.icao && <b>/ {ap.icao}</b>}</div>
        <div className="rd-meta"><span>{new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })} local</span><span>{new Date(now).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}</span>{ap.elev ? <span>Elev. {ap.elev.toLocaleString()} ft</span> : null}</div></div>
      <div className="rd-btns"><button aria-label={fav ? "Unpin airport" : "Pin airport"} className={fav ? "on" : ""} onClick={star}>{fav ? "★" : "☆"}</button><button aria-label="Share" onClick={() => navigator.share?.({ url: location.href, title: `${iata} airport` }).catch(() => {})}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg></button><button aria-label="Close" onClick={onClose}>✕</button></div></header>
    <div className="rd-body">
      {tab === "gen" && <General iata={iata} info={info} facts={facts} ap={ap} wx={wx} dep={dep} arr={arr} tz={tz} go={setTab} push={push} />}
      {tab === "dep" && <FlightList iata={iata} dir="dep" tz={tz} push={push} B={dep} />}
      {tab === "arr" && <FlightList iata={iata} dir="arr" tz={tz} push={push} B={arr} />}
      {tab === "gnd" && <Ground iata={iata} info={info} />}
      <div className="rd-foot"><button className="rd-link" onClick={onClassic}>Switch to the classic board</button><span>Radar style · Skyline</span></div></div>
    <nav className="rd-tabs" role="tablist">{([["gen", "General", "M4 5h16M4 12h16M4 19h10"], ["dep", "Departures", "M3 17h18M5 13l14-6-2 6H7l-3-3"], ["arr", "Arrivals", "M3 19h18M4 9l3 6h12l1-3-14-5"], ["gnd", "On ground", "M3 18h18M6 14h12l2-4H4z"]] as const).map(([k, n, d]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg><span>{n}</span></button>)}</nav>
  </div>; }
