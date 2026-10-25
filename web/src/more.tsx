import { useEffect, useMemo, useState } from "react";
import { api, dist, estDurMin, dur, fmtD, best, tzOffset, wxText, ics, download, today, type Flight, type Ap, type Times } from "./lib";
import { I } from "./ui";

// ---------- units ----------
export type Units = { dist: "mi" | "km"; clock: "24" | "12"; temp: "C" | "F" };
export const getUnits = (): Units => { try { return { dist: "mi", clock: "24", temp: "C", ...JSON.parse(localStorage.getItem("sk.units") || "{}") }; } catch { return { dist: "mi", clock: "24", temp: "C" }; } };
export const setUnits = (u: Units) => localStorage.setItem("sk.units", JSON.stringify(u));
export const fDist = (mi: number) => getUnits().dist === "km" ? `${Math.round(mi * 1.609344).toLocaleString()} km` : `${Math.round(mi).toLocaleString()} mi`;
export const fTemp = (c?: number) => c == null ? "—" : getUnits().temp === "F" ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`;
export const fClock = (iso?: string | null, tz?: string) => iso ? new Date(iso).toLocaleTimeString(getUnits().clock === "12" ? "en-US" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: getUnits().clock === "12", timeZone: tz || "Europe/London" }) : "--:--";
const fLocalWall = (wall?: string) => wall ? (getUnits().clock === "12" ? new Date("2000-01-01T" + wall.slice(11, 16)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : wall.slice(11, 16)) : "—";
const compass = (d?: number) => d == null ? "" : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8];
const gc = (a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }) => dist(a as Ap, b as Ap);

// ---------- icons (stroke, matches ui.tsx set) ----------
const sv = (d: string) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
export const X = {
  sun: sv("M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"),
  cloud: sv("M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"),
  rain: sv("M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3"),
  snow: sv("M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14zM8 18h.01M12 20h.01M16 18h.01"),
  storm: sv("M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14zM13 15l-3 4h4l-3 4"),
  fog: sv("M4 10h16M4 14h16M6 18h12M7 6h10"),
  wind: sv("M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"),
  eye: sv("M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"),
  drop: sv("M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"),
  clock: sv("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2"),
  runway: sv("M8 22 10 2M16 22 14 2M12 5v2M12 11v2M12 17v2"),
  radar: sv("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 12l6-6M12 16a4 4 0 1 0 0-8"),
  sunrise: sv("M12 2v6M8.5 5.5 12 2l3.5 3.5M4 18h16M6 14a6 6 0 0 1 12 0M2 22h20"),
  sunset: sv("M12 8V2M8.5 4.5 12 8l3.5-3.5M4 18h16M6 14a6 6 0 0 1 12 0M2 22h20"),
  leaf: sv("M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7"),
  award: sv("M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 22l5-3 5 3-1.5-8"),
  gauge: sv("M4 18a9 9 0 1 1 16 0M12 13l4-4"),
};
export const wxSvg = (c: number) => c <= 1 ? X.sun : c <= 3 ? X.cloud : c <= 48 ? X.fog : c <= 67 || (c >= 80 && c <= 82) ? X.rain : c <= 77 || c <= 86 ? X.snow : X.storm;
const Cell = ({ icon, k, v }: { icon: any; k: string; v: any }) => <div className="mcell"><span className="mic">{icon}</span><div><small>{k}</small><b>{v}</b></div></div>;

// ---------- Flight timeline ----------
export function Timeline({ f }: { f: Flight }) {
  const o = f.origin?.tz, d = (f.diverted || f.destination)?.tz;
  const st = (t: Times | undefined, k: "dep" | "arr") => t?.actual ? "done" : (k === "dep" ? ["departed", "landed"] : ["landed"]).includes(f.status || "") ? "done" : "";
  const rows: [string, string, Times | undefined, string | undefined, string][] = [
    ["Gate departure", f.dep.gate ? `Gate ${f.dep.gate}${f.dep.terminal ? " · T" + f.dep.terminal : ""}` : f.dep.terminal ? `Terminal ${f.dep.terminal}` : "", f.dep, o, st(f.dep, "dep")],
    ["Take-off", "", (f as any).takeoff, o, ["departed", "landed"].includes(f.status || "") ? "done" : ""],
    ["Landing", "", (f as any).landing, d, f.status === "landed" ? "done" : ""],
    ["Gate arrival", f.arr.gate ? `Gate ${f.arr.gate}` : f.arr.terminal ? `Terminal ${f.arr.terminal}` : "", f.arr, d, st(f.arr, "arr")],
  ];
  const vis = rows.filter(r => r[0] === "Gate departure" || r[0] === "Gate arrival" || (r[2] && (r[2].scheduled || r[2].actual || r[2].estimated)));
  return <div className="card"><h3>Flight timeline</h3><div className="muted sm">Scheduled · estimated · actual, local times</div>
    <div className="tline">{vis.map(([l, sub, t, tz, s]) => <div key={l} className={"tl " + s}><i /><div className="grow"><b>{l}</b>{sub && <div className="faint sm">{sub}</div>}</div>
      <div className="right"><b>{fClock(t?.actual || t?.estimated || t?.scheduled, tz)}</b><div className="faint sm">{t?.actual ? "actual" : t?.estimated ? `sched ${fClock(t.scheduled, tz)}` : t?.scheduled ? "scheduled" : "not published"}</div></div></div>)}
      <div className={"tl " + (f.arr.baggage && f.status === "landed" ? "done" : "")}><i /><div className="grow"><b>Baggage belt</b></div><div className="right"><b>{f.arr.baggage || "—"}</b><div className="faint sm">{f.arr.baggage ? "assigned" : "not assigned yet"}</div></div></div></div></div>;
}

// ---------- Progress + local times ----------
export function Progress({ f, lv }: { f: Flight; lv: any }) {
  const a = f.origin, b = f.diverted || f.destination; const total = dist(a, b); const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30e3); return () => clearInterval(t); }, []);
  if (!a?.lat || !b?.lat) return null;
  const live = lv?.lat != null && typeof lv.alt === "number"; const flown = live ? Math.min(total, gc(a, lv)) : f.status === "landed" ? total : 0;
  const pct = total ? Math.round(flown / total * 100) : 0; const rem = Math.max(0, total - flown);
  const tzd = (tzOffset(b.tz) - tzOffset(a.tz)) / 60; const now = new Date().toISOString();
  return <div className="card"><div className="row between"><h3>Progress</h3><span className="faint sm">{live ? `live · ${lv.source}` : f.status === "landed" ? "landed" : "not airborne"}</span></div>
    <div className="pbar mt8"><i style={{ width: pct + "%" }} /><span style={{ left: pct + "%" }}>{I.plane}</span></div>
    <div className="row between sm mt8"><span><b>{fDist(flown)}</b> flown</span><span><b>{fDist(rem)}</b> to go</span></div>
    <div className="mgrid mt8"><Cell icon={X.radar} k="Great-circle distance" v={fDist(total)} /><Cell icon={X.clock} k="Typical block time (est.)" v={dur(estDurMin(a, b))} />
      <Cell icon={X.sunrise} k={`Local time ${a.iata}`} v={fClock(now, a.tz)} /><Cell icon={X.sunset} k={`Local time ${b.iata}`} v={fClock(now, b.tz)} /></div>
    <div className="faint sm mt8">{tzd ? `${b.city || b.iata} is ${Math.abs(tzd)}h ${tzd > 0 ? "ahead of" : "behind"} ${a.city || a.iata}` : "Same time zone at both ends"}</div>
    {live && <div className="mgrid mt8"><Cell icon={X.gauge} k="Altitude" v={`${Math.round(lv.alt).toLocaleString()} ft`} /><Cell icon={X.wind} k="Ground speed" v={lv.gs != null ? `${Math.round(lv.gs)} kt` : "—"} />
      <Cell icon={X.radar} k="Heading" v={lv.track != null ? `${Math.round(lv.track)}° ${compass(lv.track)}` : "—"} /><Cell icon={X.gauge} k="Vertical rate" v={lv.vs != null ? `${lv.vs > 0 ? "+" : ""}${Math.round(lv.vs).toLocaleString()} ft/min` : "—"} /></div>}</div>;
}

// ---------- Weather ----------
export function WeatherCard({ w, a, label }: { w: any; a?: Ap; label: string }) {
  if (!w?.current) return null; const c = w.current; const h = w.hourly; const i0 = h ? Math.max(0, h.time.findIndex((t: string) => t >= c.time.slice(0, 13))) : 0;
  return <div className="card"><div className="row between"><h3>{label} weather</h3><span className="faint sm">{a?.iata} · Open-Meteo</span></div>
    <div className="row g10 mt8 wxhero"><span className="wxbig">{wxSvg(c.weather_code)}</span><div><b className="lvt">{fTemp(c.temperature_2m)}</b><div className="muted sm" style={{ textTransform: "capitalize" }}>{wxText(c.weather_code)}</div></div></div>
    <div className="mgrid mt8"><Cell icon={X.wind} k="Wind" v={`${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} kt${c.wind_gusts_10m > c.wind_speed_10m + 8 ? ` G${Math.round(c.wind_gusts_10m)}` : ""}`} />
      <Cell icon={X.eye} k="Visibility" v={c.visibility != null ? (c.visibility >= 10000 ? "10 km+" : `${(c.visibility / 1000).toFixed(1)} km`) : "—"} />
      <Cell icon={X.cloud} k="Cloud cover" v={c.cloud_cover != null ? `${c.cloud_cover}%` : "—"} /><Cell icon={X.drop} k="Precipitation" v={c.precipitation != null ? `${c.precipitation} mm` : "—"} />
      {c.relative_humidity_2m != null && <Cell icon={X.drop} k="Humidity · dew pt" v={`${c.relative_humidity_2m}% · ${fTemp(c.dew_point_2m)}`} />}{c.pressure_msl != null && <Cell icon={X.gauge} k="Pressure (QNH)" v={`${Math.round(c.pressure_msl)} hPa`} />}</div>
    {h && <div className="hstrip mt8">{h.time.slice(i0, i0 + 24).map((t: string, k: number) => <div key={t}><small>{k === 0 ? "Now" : fLocalWall(t)}</small><span>{wxSvg(h.weather_code[i0 + k])}</span><b>{fTemp(h.temperature_2m[i0 + k])}</b><small>{Math.round(h.wind_speed_10m[i0 + k])}kt</small>{h.precipitation_probability?.[i0 + k] > 0 && <small className="pp">{h.precipitation_probability[i0 + k]}%</small>}</div>)}</div>}</div>;
}

// ---------- Airport info ----------
export function AirportInfo({ iata }: { iata: string }) {
  const [d, setD] = useState<any>(null); useEffect(() => { api(`/airport/${iata}/info`).then(setD).catch(e => setD({ error: e.message })); }, [iata]);
  if (!d) return <div className="card"><div className="skel" style={{ width: "60%" }} /><div className="skel mt8" style={{ width: "40%" }} /></div>;
  if (d.error) return <div className="note warn">{d.error}</div>;
  const a = d.airport, w = d.weather;
  return <><div className="card"><h3>{a.name}</h3><div className="muted sm">{a.city}, {a.country} · {a.iata} / {a.icao}</div>
    <div className="mgrid mt8"><Cell icon={X.clock} k="Local time" v={fClock(new Date().toISOString(), a.tz)} /><Cell icon={I.globe} k="Time zone" v={a.tz?.replace("_", " ")} />
      {d.sun && <><Cell icon={X.sunrise} k="Sunrise" v={fLocalWall(d.sun.sunrise)} /><Cell icon={X.sunset} k="Sunset" v={fLocalWall(d.sun.sunset)} /></>}
      {w && <><Cell icon={wxSvg(w.weather_code)} k="Weather now" v={`${fTemp(w.temperature_2m)} · ${wxText(w.weather_code)}`} /><Cell icon={X.wind} k="Wind" v={`${compass(w.wind_direction_10m)} ${Math.round(w.wind_speed_10m)} kt`} /></>}
      {d.live && <><Cell icon={X.radar} k="Aircraft within 25 nm" v={d.live.total} /><Cell icon={I.plane} k="On the ground · below 10k ft" v={`${d.live.ground} · ${d.live.low}`} /></>}</div>
    <div className="faint sm mt8">Live traffic: {d.live?.source || "unavailable"} ADS-B, refreshed every minute · weather Open-Meteo</div></div>
    {d.runways?.length ? <div className="card"><h3>Runways</h3><div className="muted sm">{d.runways.length} active · OurAirports</div>
      {d.runways.map((r: any) => <div key={r.le + r.he} className="rwy"><span className="mic">{X.runway}</span><div className="grow"><b>{r.le}{r.he ? " / " + r.he : ""}</b><div className="faint sm">{surf(r.surface)}{r.lighted ? " · lit" : ""}{r.heading ? ` · ${Math.round(r.heading)}°` : ""}</div></div>
        <div className="right"><b>{r.lengthFt ? (getUnits().dist === "km" ? `${Math.round(r.lengthFt * .3048).toLocaleString()} m` : `${r.lengthFt.toLocaleString()} ft`) : "—"}</b><div className="faint sm">{r.widthFt ? (getUnits().dist === "km" ? `${Math.round(r.widthFt * .3048)} m wide` : `${r.widthFt} ft wide`) : ""}</div></div></div>)}</div> : null}</>;
}
const surf = (s: string) => ({ ASP: "Asphalt", CON: "Concrete", GRS: "Grass", GRE: "Gravel", "ASP-CON": "Asphalt/concrete" } as any)[s?.toUpperCase()] || s || "Surface unknown";

// ---------- Passport: map, time aloft, CO2, badges ----------
export function PassportMore({ L }: { L: Flight[] }) {
  const s = useMemo(() => { const aps: Record<string, Ap> = {}; let mi = 0, min = 0; const countries = new Set<string>(), conts = new Set<string>();
    L.forEach(f => { [f.origin, f.destination].forEach(a => { if (a?.lat != null) { aps[a.iata] = a; if (a.country) countries.add(a.country); conts.add(cont(a)); } }); const d = dist(f.origin, f.destination); mi += d;
      const sa = f.dep.actual || f.dep.scheduled, ea = f.arr.actual || f.arr.scheduled; min += sa && ea && +new Date(ea) > +new Date(sa) ? (+new Date(ea) - +new Date(sa)) / 60000 : estDurMin(f.origin, f.destination); });
    const km = mi * 1.609344; const co2 = L.reduce((t, f) => { const k = dist(f.origin, f.destination) * 1.609344; return t + k * (k < 1500 ? .156 : k < 4000 ? .131 : .114); }, 0); // per-passenger kg/km incl. uplift, DEFRA-style economy factors
    return { aps: Object.values(aps), mi, km, min, co2, countries: countries.size, conts: conts.size }; }, [L]);
  const longest = Math.max(0, ...L.map(f => dist(f.origin, f.destination)));
  const badges: [string, boolean, string][] = [["First flight", L.length >= 1, "Log a flight"], ["Frequent flyer", L.length >= 10, "10 flights"], ["Road warrior", L.length >= 50, "50 flights"],
    ["Globetrotter", s.countries >= 10, "10 countries"], ["Explorer", s.aps.length >= 20, "20 airports"], ["Long haul", longest >= 3000, "A 3,000 mi flight"], ["Around the world", s.mi >= 24901, "24,901 mi total"], ["Three continents", s.conts >= 3, "Land on 3 continents"]];
  const W = 340, H = 170, px = (lon: number) => (lon + 180) / 360 * W, py = (lat: number) => (90 - lat) / 180 * H;
  return <>
    <div className="card m18"><h3>Airports visited</h3><div className="muted sm">{s.aps.length} airports · {s.countries} countries</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="vmap mt8">{[...Array(7)].map((_, i) => <line key={"a" + i} x1={0} x2={W} y1={i * H / 6} y2={i * H / 6} />)}{[...Array(13)].map((_, i) => <line key={"b" + i} y1={0} y2={H} x1={i * W / 12} x2={i * W / 12} />)}
        {L.map(f => f.origin?.lon != null && f.destination?.lon != null && <path key={f.id} d={`M${px(f.origin.lon)},${py(f.origin.lat!)} Q${(px(f.origin.lon) + px(f.destination.lon)) / 2},${Math.min(py(f.origin.lat!), py(f.destination.lat!)) - 12} ${px(f.destination.lon)},${py(f.destination.lat!)}`} className="arc" />)}
        {s.aps.map(a => <circle key={a.iata} cx={px(a.lon!)} cy={py(a.lat!)} r={2.6} className="dot" />)}</svg></div>
    <div className="card m18"><h3>Totals</h3><div className="mgrid mt8"><Cell icon={X.radar} k="Distance flown" v={fDist(s.mi)} /><Cell icon={X.clock} k="Time in the air" v={dur(s.min)} />
      <Cell icon={X.leaf} k="CO₂ estimate" v={`${(s.co2 / 1000).toFixed(s.co2 < 10000 ? 2 : 1)} t`} /><Cell icon={I.globe} k="Around the world" v={`${(s.mi / 24901).toFixed(2)}×`} /></div>
      <div className="faint sm mt8">CO₂ is an estimate per economy passenger from great-circle distance (UK DEFRA-style factors incl. radiative uplift). Time uses actual/scheduled times where known, otherwise a typical block time.</div></div>
    <div className="card m18"><h3>Achievements</h3><div className="badges mt8">{badges.map(([n, ok, how]) => <div key={n} className={"bdg " + (ok ? "on" : "")}><span className="mic">{X.award}</span><b>{n}</b><small>{ok ? "Unlocked" : how}</small></div>)}</div></div></>;
}
const cont = (a: Ap) => { const z = a.tz || ""; return z.startsWith("Europe") ? "EU" : z.startsWith("America") ? (a.lat! < 13 ? "SA" : "NA") : z.startsWith("Asia") ? "AS" : z.startsWith("Africa") ? "AF" : z.startsWith("Australia") || z.startsWith("Pacific") ? "OC" : z.startsWith("Atlantic") ? (a.lon! < -30 ? "NA" : a.lat! < 35 ? "AF" : "EU") : "?"; };

// ---------- Paste booking email ----------
const MON: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
export function parseBooking(text: string) { const out: { number: string; date: string }[] = []; const T = text.replace(/\s+/g, " ");
  const re = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g; let m: RegExpExecArray | null;
  const dates: { i: number; d: string }[] = []; const dre = /\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;
  while ((m = dre.exec(T))) { let y, mo, d; if (m[1]) [y, mo, d] = [m[1], m[2], m[3]]; else if (m[4]) [d, mo, y] = [m[4], m[5], m[6].length === 2 ? "20" + m[6] : m[6]]; else if (m[7]) [d, mo, y] = [m[7], MON[m[8].toLowerCase()], m[9]]; else [mo, d, y] = [MON[m[10].toLowerCase()], m[11], m[12]];
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) dates.push({ i: m.index, d: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` }); }
  const bad = new Set(["UK", "US", "EU", "GB", "PM", "AM", "ID", "PNR", "VAT"]);
  while ((m = re.exec(T))) { if (bad.has(m[1]) || /^\d{4}$/.test(m[1] + m[2]) && !/[A-Z]/.test(m[1])) continue; const near = dates.slice().sort((a, b) => Math.abs(a.i - m!.index) - Math.abs(b.i - m!.index))[0];
    if (!near || Math.abs(near.i - m.index) > 220) continue; const number = m[1] + m[2]; if (!out.some(o => o.number === number && o.date === near.d)) out.push({ number, date: near.d }); }
  return out; }
export function PasteImport({ add }: { add: (fl: Flight[]) => void }) {
  const [t, setT] = useState(""); const [rows, setRows] = useState<{ number: string; date: string; ok?: boolean; f?: Flight; err?: string }[]>([]); const [busy, setBusy] = useState(false);
  const look = async () => { const p = parseBooking(t); setRows(p); setBusy(true); const r = await Promise.all(p.map(async x => { try { const j = await api(`/flight/${x.number}?date=${x.date}`); return j.flight ? { ...x, ok: true, f: { ...j.flight, id: j.flight.id || `${x.number}-${x.date}`, date: x.date } } : { ...x, err: "no schedule found" }; } catch (e: any) { return { ...x, err: e.message }; } })); setRows(r); setBusy(false); };
  return <div className="px col g8"><div className="muted sm">Paste the text of a booking confirmation. Flight numbers and dates are read on your phone; nothing is uploaded except the flight lookups.</div>
    <textarea className="field" style={{ minHeight: 140 }} value={t} onChange={e => setT(e.target.value)} placeholder="e.g. Flight LS1747 · Mon 26 Oct 2026 · Manchester → Gran Canaria" />
    <button className="primary" disabled={!t.trim() || busy} onClick={look}>{busy ? "Looking up…" : "Find flights"}</button>
    {rows.length === 0 && t && !busy ? <div className="faint sm">Tap Find flights.</div> : null}
    {rows.map(r => <div key={r.number + r.date} className="card m0 row between"><div><b>{r.number}</b> <span className="muted">{fmtD(r.date)}</span><div className="faint sm">{r.f ? `${r.f.origin?.iata || "?"} → ${r.f.destination?.iata || "?"}` : r.err || "…"}</div></div></div>)}
    {rows.some(r => r.ok) && <button className="primary" onClick={() => add(rows.filter(r => r.ok).map(r => r.f!))}>Add {rows.filter(r => r.ok).length} flight{rows.filter(r => r.ok).length === 1 ? "" : "s"}</button>}</div>;
}
export const exportIcs = (L: Flight[]) => download(`skyline-flights-${today()}.ics`, ics(L));

// ---------- Settings: units + alert prefs ----------
export type AlertPrefs = { events: Record<"cancel" | "gate" | "delay" | "belt" | "status", boolean>; quiet: { on: boolean; from: string; to: string; tz: string } };
export const getPrefs = (): AlertPrefs => { const d: AlertPrefs = { events: { cancel: true, gate: true, delay: true, belt: true, status: true }, quiet: { on: false, from: "22:00", to: "07:00", tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }; try { const p = JSON.parse(localStorage.getItem("sk.alertPrefs") || "null"); return p ? { events: { ...d.events, ...p.events }, quiet: { ...d.quiet, ...p.quiet } } : d; } catch { return d; } };
export function UnitsCard() { const [u, setU] = useState(getUnits()); const s = (k: keyof Units, v: string) => { const n = { ...u, [k]: v } as Units; setU(n); setUnits(n); };
  const seg = (k: keyof Units, opts: [string, string][]) => <div className="segs m0 mt8">{opts.map(([v, l]) => <button key={v} className={u[k] === v ? "on" : ""} onClick={() => s(k, v)}>{l}</button>)}</div>;
  return <div className="card m0"><h3>Units</h3><div className="muted sm">Used by the timeline, progress, weather, airport and passport cards.</div>{seg("dist", [["mi", "Miles"], ["km", "Kilometres"]])}{seg("clock", [["24", "24-hour"], ["12", "12-hour"]])}{seg("temp", [["C", "°C"], ["F", "°F"]])}</div>; }
export function AlertPrefsCard({ onChange }: { onChange: (p: AlertPrefs) => void }) {
  const [p, setP] = useState(getPrefs()); const up = (n: AlertPrefs) => { setP(n); localStorage.setItem("sk.alertPrefs", JSON.stringify(n)); onChange(n); };
  const L: [keyof AlertPrefs["events"], string][] = [["cancel", "Cancellations"], ["gate", "Gate & terminal changes"], ["delay", "Delays & recoveries"], ["belt", "Baggage belt"], ["status", "Boarding, departed, landed"]];
  return <div className="card m0"><h3>Alert types</h3>{L.map(([k, l]) => <label key={k} className="tog"><span>{l}</span><input type="checkbox" checked={p.events[k]} onChange={e => up({ ...p, events: { ...p.events, [k]: e.target.checked } })} /></label>)}
    <label className="tog"><span>Quiet hours</span><input type="checkbox" checked={p.quiet.on} onChange={e => up({ ...p, quiet: { ...p.quiet, on: e.target.checked } })} /></label>
    {p.quiet.on && <div className="row g8 mt8"><input className="field" type="time" value={p.quiet.from} onChange={e => up({ ...p, quiet: { ...p.quiet, from: e.target.value } })} /><span className="muted">to</span><input className="field" type="time" value={p.quiet.to} onChange={e => up({ ...p, quiet: { ...p.quiet, to: e.target.value } })} /></div>}
    <div className="faint sm mt8">Cancellations always come through, even in quiet hours. Times are in {p.quiet.tz}.</div></div>;
}
export { best };
