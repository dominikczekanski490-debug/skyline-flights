// v52 — Home dashboard pieces (lazy-loaded): local weather (permission-gated), recent flights, trending from our log, aviation "on this day".
import { useEffect, useRef, useState } from "react";
import { api, type Flight } from "./lib";
import "./v52.css";

const eink = () => document.documentElement.dataset.skin === "eink" || matchMedia("(prefers-reduced-motion: reduce)").matches;
export function CountUp({ to, d = 0, ms = 900 }: { to: number; d?: number; ms?: number }) { const [v, setV] = useState(eink() ? to : 0); const r = useRef(0);
  useEffect(() => { if (eink()) { setV(to); return; } const t0 = performance.now(); const f = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) r.current = requestAnimationFrame(f); }; r.current = requestAnimationFrame(f); return () => cancelAnimationFrame(r.current); }, [to]);
  return <>{v.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d })}</>; }
const Sk = ({ n = 3 }) => <div className="h52-sk">{Array.from({ length: n }, (_, i) => <span key={i} className="skel" style={{ height: 16, width: `${90 - i * 18}%` }} />)}</div>;
const Card = ({ k, title, sub, children, i = 0 }: any) => <section className="h52 glass52" style={{ ["--i" as any]: i }} aria-label={title}><div className="h52-h"><b>{title}</b>{sub && <span>{sub}</span>}</div>{children}{k && <div className="h52-f">{k}</div>}</section>;

const WMO: Record<number, [string, string]> = { 0: ["☀️", "Clear"], 1: ["🌤", "Mainly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"], 45: ["🌫", "Fog"], 48: ["🌫", "Rime fog"], 51: ["🌦", "Light drizzle"], 53: ["🌦", "Drizzle"], 55: ["🌧", "Heavy drizzle"], 61: ["🌦", "Light rain"], 63: ["🌧", "Rain"], 65: ["🌧", "Heavy rain"], 71: ["🌨", "Light snow"], 73: ["🌨", "Snow"], 75: ["❄️", "Heavy snow"], 80: ["🌦", "Showers"], 81: ["🌧", "Heavy showers"], 82: ["⛈", "Violent showers"], 95: ["⛈", "Thunderstorm"], 96: ["⛈", "Thunderstorm, hail"], 99: ["⛈", "Thunderstorm, hail"] };
export function HomeWeather({ push }: { push: (o: any) => void }) {
  const [mode, setMode] = useState<"ask" | "loc" | "apt">(() => localStorage.getItem("sk.geo.ok") === "1" ? "loc" : "apt"); const [w, setW] = useState<any>(null); const [apt, setApt] = useState<any>(null); const [err, setErr] = useState("");
  const fav = (() => { try { return JSON.parse(localStorage.getItem("sk.pulse") || "")[0]; } catch { return "MAN"; } })() || "MAN";
  const load = async (la: number, lo: number) => { const j = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover&wind_speed_unit=kmh&timezone=auto`).then(r => r.json()); if (!j.current) throw new Error("No current conditions from Open-Meteo"); setW(j.current); };
  useEffect(() => { let dead = false; setErr(""); setW(null);
    if (mode === "loc") navigator.geolocation?.getCurrentPosition(async p => { try { const a = await api(`/airports/nearest?lat=${p.coords.latitude}&lon=${p.coords.longitude}`); if (!dead) setApt(a); await load(p.coords.latitude, p.coords.longitude); } catch (e: any) { if (!dead) setErr(e.message); } },
      () => { localStorage.removeItem("sk.geo.ok"); if (!dead) { setErr("Location permission was declined, so showing your first pulse airport instead."); setMode("apt"); } }, { maximumAge: 15 * 60e3, timeout: 10e3 });
    else (async () => { try { const r = await api(`/airports/search?q=${fav}`); const a = r.find((x: any) => x.iata === fav) || r[0]; if (!a) throw new Error(`No coordinates for ${fav}`); if (dead) return; setApt({ ...a, km: null }); await load(a.lat, a.lon); } catch (e: any) { if (!dead) setErr(e.message); } })();
    return () => { dead = true; }; }, [mode]);
  const c = w ? WMO[w.weather_code] || ["🌡", `Code ${w.weather_code}`] : null;
  return <Card i={0} title="Weather now" sub={mode === "loc" ? "Your location" : `At ${fav} (location not shared)`} k={<>Open-Meteo current conditions{apt?.km != null && ` · nearest airport ${apt.iata}, ${apt.km} km`}</>}>
    {err && <div className="faint sm">{err}</div>}
    {!w && !err && <Sk n={2} />}
    {w && <div className="h52-wx"><span className="h52-wx-ic" aria-hidden>{c![0]}</span><div><b className="h52-big"><CountUp to={w.temperature_2m} />°</b><div className="sm">{c![1]} · feels {Math.round(w.apparent_temperature)}°</div><div className="faint xs">Wind {Math.round(w.wind_speed_10m)} km/h, gusts {Math.round(w.wind_gusts_10m)} · cloud {w.cloud_cover}%{w.visibility != null && ` · vis ${(w.visibility / 1000).toFixed(0)} km`}</div></div></div>}
    <div className="lab-chips mt8">{mode !== "loc" && navigator.geolocation && <button onClick={() => { localStorage.setItem("sk.geo.ok", "1"); setMode("loc"); }}>📍 Use my location</button>}{apt?.iata && <button onClick={() => push({ t: "board", iata: apt.iata })}>🛫 {apt.iata} board</button>}</div>
  </Card>; }

export function RecentFlights({ flights, push }: { flights: Flight[]; push: (o: any) => void }) {
  const L = flights.filter(f => !f.example).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8); if (!L.length) return null;
  return <Card i={1} title="Tracked & recent" sub={`${flights.filter(f => !f.example).length} on this device`}><div className="h52-strip">{L.map((f, i) => <button key={f.id} className="h52-tile stag52" style={{ ["--i" as any]: i }} onClick={() => push({ t: "flight", f })}>
    <b>{f.number}</b><span>{f.origin?.iata} → {f.destination?.iata}</span><small>{f.date.slice(8, 10)}/{f.date.slice(5, 7)} · {f.status || "scheduled"}</small></button>)}</div></Card>; }

export function Trends({ push }: { push: (o: any) => void }) { const [d, setD] = useState<any>(null); const [e, setE] = useState("");
  useEffect(() => { api("/home-trends").then(setD).catch(z => setE(String(z.message || z))); }, []);
  return <Card i={2} title="Trending today" sub="From Skyline's observed board log" k={d && <>{d.rule} Today is a partial day, so ratios only rise as it fills in.</>}>
    {e && <div className="faint sm">Couldn't load trends: {e}</div>}{!d && !e && <Sk />}
    {d && !d.routes.length && <div className="faint sm">Not enough flights logged today yet (needs 3+ on a route).</div>}
    {d && d.routes.length > 0 && <div className="h52-cols"><div>{d.routes.map((r: any, i: number) => <div key={r.k} className="h52-row stag52" style={{ ["--i" as any]: i }}><span>{r.k}</span><b>{r.ratio != null ? <>×<CountUp to={r.ratio} d={1} /></> : "new"}</b><small>{r.today} today · avg {r.avg ?? "—"}</small></div>)}</div>
      <div>{d.airports.map((a: any, i: number) => <button key={a.k} className="h52-row stag52" style={{ ["--i" as any]: i }} onClick={() => push({ t: "board", iata: a.k })}><span>{a.k}</span><b><CountUp to={a.today} /></b><small>departures logged today</small></button>)}</div></div>}
  </Card>; }

export function AvFact() { const [d, setD] = useState<any>(null); const [e, setE] = useState(""); const [i, setI] = useState(0);
  useEffect(() => { api("/aviation-fact").then(setD).catch(z => setE(String(z.message || z))); }, []);
  const f = d?.facts?.[i];
  return <Card i={3} title={`On this day${d ? ` · ${d.date}` : ""}`} sub="Aviation history" k={d?.source}>
    {e && <div className="faint sm">Couldn't load: {e}</div>}{!d && !e && <Sk n={2} />}{d?.none && <div className="faint sm">Wikipedia lists no aviation event for today's date.</div>}
    {f && <div><b className="h52-big">{f.year}</b><p className="sm">{f.text}</p><div className="lab-chips">{f.url && <a href={f.url} target="_blank" rel="noreferrer">Read on Wikipedia</a>}{d.facts.length > 1 && <button onClick={() => setI((i + 1) % d.facts.length)}>Next ({i + 1}/{d.facts.length})</button>}</div></div>}
  </Card>; }

export default function HomeDash({ flights, push }: { flights: Flight[]; push: (o: any) => void }) {
  return <div className="h52-wrap"><HomeWeather push={push} /><RecentFlights flights={flights} push={push} /><Trends push={push} /><AvFact /></div>; }
