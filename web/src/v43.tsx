// v43: trip view, offline mode banner, airport live map, plane spotter log. Real data only.
import { useEffect, useMemo, useState } from "react";
import { api, best, download, fmtD, ics, load, type Flight } from "./lib";

const hm = (iso?: string | null, tz?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || undefined }) : "—";
const ms = (f: Flight, k: "dep" | "arr") => { const v = best(f[k]); return v ? +new Date(v) : +new Date(f.date + "T12:00:00Z"); };
const durS = (m: number) => m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.round(m % 1440 / 60)}h` : `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;

// ---------- (e) Trip view ----------
// A trip = flights chained by airport (next origin = previous destination) with < 21 days between legs. Rule-based grouping.
export function tripsOf(L: Flight[]): Flight[][] { const s = [...L].filter(f => !f.friend && !f.example).sort((a, b) => ms(a, "dep") - ms(b, "dep")); const out: Flight[][] = [];
  for (const f of s) { const t = out.at(-1), p = t?.at(-1); if (t && p && p.destination?.iata === f.origin?.iata && ms(f, "dep") - ms(p, "arr") < 21 * 86400e3 && ms(f, "dep") >= ms(p, "arr") - 3600e3) t.push(f); else out.push([f]); }
  return out; }
const WX: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
function StopWx({ ap, from, to }: { ap: any; from: string; to: string }) { const [d, setD] = useState<any>(null); const [e, setE] = useState("");
  useEffect(() => { if (!ap?.lat) return; api(`/weather?lat=${ap.lat}&lon=${ap.lon}`).then(setD).catch(x => setE(x.message)); }, [ap?.iata]);
  if (!ap?.lat) return null; if (e) return <div className="faint sm">Weather unavailable: {e}</div>; if (!d) return <div className="faint sm">Loading forecast…</div>;
  const days = (d.daily?.time || []).map((t: string, i: number) => ({ t, hi: d.daily.temperature_2m_max[i], lo: d.daily.temperature_2m_min[i], c: d.daily.weather_code[i] })).filter((x: any) => x.t >= from && x.t <= to);
  if (!days.length) return <div className="faint sm">{ap.city || ap.iata}: forecast not out yet (Open-Meteo covers the next 7 days).</div>;
  return <div className="tv-wx">{days.slice(0, 7).map((x: any) => <div key={x.t}><small>{fmtD(x.t, { weekday: "short", day: "numeric" })}</small><b>{Math.round(x.hi)}°/{Math.round(x.lo)}°</b><small>{WX[x.c] || "—"}</small></div>)}</div>; }
export function TripView({ f, flights, open, x }: { f?: Flight; flights: Flight[]; open: (f: Flight) => void; x: any }) {
  const T = tripsOf(flights); const now = Date.now(); const def = f ? T.findIndex(t => t.some(y => y.id === f.id)) : Math.max(0, T.findIndex(t => ms(t.at(-1)!, "arr") > now));
  const [i, setI] = useState(def < 0 ? 0 : def); const t = T[i];
  if (!t) return <><div className="head"><h2>Trips</h2>{x}</div><div className="px muted">Track a flight to build a trip.</div></>;
  const a = t[0], z = t.at(-1)!; const title = `${a.origin?.city || a.origin?.iata} → ${z.destination?.city || z.destination?.iata}${t.length > 1 && z.destination?.iata === a.origin?.iata ? " (return)" : ""}`;
  return <><div className="head"><div><div className="muted sm">TRIP · {t.length} flight{t.length > 1 ? "s" : ""}</div><h2>{title}</h2></div>{x}</div>
    <div className="px">
      {T.length > 1 && <div className="chips mb8">{T.map((y, j) => <button key={j} className={"sk-pill " + (j === i ? "on" : "")} onClick={() => setI(j)}><span>{fmtD(y[0].date, { day: "numeric", month: "short" })} {y[0].origin?.iata}→{y.at(-1)!.destination?.iata}</span></button>)}</div>}
      <div className="card m0 tv"><h3>Timeline</h3>
        {t.map((g, j) => { const nx = t[j + 1]; const gap = nx ? Math.round((ms(nx, "dep") - ms(g, "arr")) / 60000) : 0;
          return <div key={g.id}><button className="tv-leg press" onClick={() => open(g)}><span className="tv-dot" /><div><b>{g.number} · {g.origin?.iata} → {g.destination?.iata}</b><div className="muted sm">{fmtD(g.date, { weekday: "short", day: "numeric", month: "short" })} · {hm(best(g.dep), g.origin?.tz)} → {hm(best(g.arr), g.destination?.tz)} (local) · {g.statusText || g.status || "scheduled"}</div></div></button>
            {nx && <div className="tv-gap muted sm">{gap < 24 * 60 ? `Connection ${durS(gap)} in ${g.destination?.city || g.destination?.iata}` : `${durS(gap)} in ${g.destination?.city || g.destination?.iata}`}</div>}</div>; })}
      </div>
      <div className="card m0 mt8"><h3>Weather at each stop</h3>{t.map((g, j) => { const nx = t[j + 1]; return <div key={g.id} className="mt8"><b className="sm">{g.destination?.city || g.destination?.iata}</b><StopWx ap={g.destination} from={g.date} to={nx ? nx.date : g.date} /></div>; })}<div className="faint xs mt8">Forecast: Open-Meteo, daily high/low in local time.</div></div>
      <button className="primary mt12" style={{ width: "100%" }} onClick={() => download(`trip-${a.date}-${a.origin?.iata}-${z.destination?.iata}.ics`, ics(t))}>Add whole trip to calendar (.ics)</button>
    </div></>; }

// ---------- (f) Offline mode ----------
// The service worker answers /api GETs from its cache when the network fails and marks them x-sk-offline. Flights already live in localStorage.
export function useOnline() { const [on, setOn] = useState(navigator.onLine); useEffect(() => { const u = () => setOn(true), d = () => setOn(false); addEventListener("online", u); addEventListener("offline", d); return () => { removeEventListener("online", u); removeEventListener("offline", d); }; }, []); return on; }
export function OfflineBanner() { const on = useOnline(); const [stale, setStale] = useState(false);
  useEffect(() => { const h = (e: any) => setStale(!!e.detail); addEventListener("sk-offline", h); return () => removeEventListener("sk-offline", h); }, []);
  if (on && !stale) return null; const L = load(); const last = Math.max(0, ...L.map((f: any) => f.updatedAt || f.fetchedAt || 0));
  return <div className="offl" role="status">{on ? "Connection weak — showing saved data" : "Offline — showing saved flights"}{last ? ` · last updated ${new Date(last).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>; }
if (typeof window !== "undefined" && !(window as any).__skOff) { (window as any).__skOff = 1; const of = window.fetch.bind(window);
  window.fetch = async (...a: Parameters<typeof fetch>) => { const r = await of(...a); try { const u = String(a[0] instanceof Request ? a[0].url : a[0]); if (u.includes("/api/")) dispatchEvent(new CustomEvent("sk-offline", { detail: r.headers.get("x-sk-offline") === "1" })); } catch {} return r; }; }

// ---------- (h) Airport live map ----------
const CLS: Record<string, [string, string]> = { ground: ["On the ground", "var(--muted)"], approach: ["Approaching", "var(--ok, #3c6)"], departure: ["Departing", "var(--warn)"], holding: ["Holding", "var(--warn, #fa3)"], overflight: ["Passing", "color-mix(in srgb, var(--text) 45%, transparent)"] };
export function AirportLive({ iata }: { iata: string }) { const [d, setD] = useState<any>(null); const [e, setE] = useState(""); const [sel, setSel] = useState("all");
  useEffect(() => { let s = true; const go = () => api(`/airport/${iata}/traffic`).then(j => { if (s) { setD(j); setE(""); } }).catch(x => s && setE(x.message)); go(); const t = setInterval(() => document.visibilityState === "visible" && go(), 20000); return () => { s = false; clearInterval(t); }; }, [iata]);
  const L = useMemo(() => (d?.list || []).filter((a: any) => sel === "all" || a.cls === sel), [d, sel]);
  if (e && !d) return <div className="card m0 muted">Live traffic unavailable: {e}</div>; if (!d) return <div className="card m0 muted">Loading live traffic…</div>;
  const cnt: Record<string, number> = {}; d.list.forEach((a: any) => cnt[a.cls] = (cnt[a.cls] || 0) + 1); const R = 40, S = 150;
  return <div className="card m0 alive"><h3>Live around {iata}</h3><div className="muted sm">{d.list.length} aircraft within 40 nm · updates every 20 s</div>
    <svg viewBox={`-${S} -${S} ${S * 2} ${S * 2}`} className="alive-map" role="img" aria-label={`Map of ${d.list.length} aircraft near ${iata}`}>
      {[10, 20, 30, 40].map(r => <g key={r}><circle r={r / R * S} className="alive-ring" /><text x={4} y={-r / R * S + 10} className="alive-rt">{r} nm</text></g>)}
      <circle r={4} className="alive-apt" /><text y={-8} className="alive-rt" textAnchor="middle">{iata}</text>
      {L.map((a: any) => { const r = Math.min(a.nm, R) / R * S, th = a.brg * Math.PI / 180; const px = r * Math.sin(th), py = -r * Math.cos(th);
        return <g key={a.hex} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${a.track || 0})`} className={"alive-" + a.cls} style={{ color: CLS[a.cls][1] }}><path d="M0 -6 L4 5 L0 3 L-4 5 Z" fill="currentColor" /></g>; })}
    </svg>
    <div className="chips mt8">{["all", "ground", "approach", "departure", "holding", "overflight"].map(k => <button key={k} className={"sk-pill " + (sel === k ? "on" : "")} onClick={() => setSel(k)}>{k !== "all" && <i className="alive-k" style={{ background: CLS[k][1] }} />}<span>{k === "all" ? "All" : CLS[k][0]} {k === "all" ? d.list.length : cnt[k] || 0}</span></button>)}</div>
    <div className="alive-list">{L.slice(0, 40).map((a: any) => <div key={a.hex} className="row between alive-row"><span><b>{a.cs || a.reg || a.hex}</b> <span className="muted sm">{a.type || ""}{a.reg && a.cs ? " · " + a.reg : ""}</span></span><span className="sm" style={{ color: CLS[a.cls][1] }}>{CLS[a.cls][0]} · {a.cls === "ground" ? "ground" : a.alt != null ? `${Math.round(+a.alt / 100) * 100} ft` : "—"} · {a.nm} nm</span></div>)}</div>
    <div className="faint xs mt8">{d.source}. {d.holdNote}. Approach/departure = within 30 nm and descending/climbing (rule-based).</div></div>; }

// ---------- (i) Plane spotter log ----------
export type Spot = { id: string; reg: string; type?: string; airline?: string; date: string; where?: string; how: "seen" | "flown"; note?: string; flight?: string };
const SK = "sk.spots"; export const spots = (): Spot[] => { try { return JSON.parse(localStorage.getItem(SK) || "[]"); } catch { return []; } };
const saveSpots = (l: Spot[]) => localStorage.setItem(SK, JSON.stringify(l));
function flownFromTrips(): Spot[] { return load().filter(f => !f.friend && !f.example && f.aircraft?.reg && (f.status === "landed" || ms(f, "arr") < Date.now())).map(f => ({ id: "f:" + f.id, reg: f.aircraft!.reg!.toUpperCase(), type: f.aircraft?.model, airline: f.airline?.name, date: f.date, where: `${f.origin?.iata}→${f.destination?.iata}`, how: "flown" as const, flight: f.number })); }
function SpotPhoto({ s }: { s: Spot }) { const [p, setP] = useState<any>(null); useEffect(() => { api(`/photo?reg=${encodeURIComponent(s.reg)}`).then(setP).catch(() => setP({ kind: "none" })); }, [s.reg]);
  if (!p || p.kind !== "exact" || !p.thumb && !p.src) return null; return <figure className="spot-ph"><img loading="lazy" src={p.thumb || p.src} alt={`${s.reg} photo`} /><figcaption className="faint xs">© {p.photographer || p.author || "photographer"} · {p.link ? <a href={p.link} target="_blank" rel="noopener">Planespotters.net</a> : "Planespotters.net"}</figcaption></figure>; }
export function SpotterLog({ x }: { x: any }) { const [L, setL] = useState<Spot[]>(spots()); const [reg, setReg] = useState(""); const [where, setWhere] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [tab, setTab] = useState<"log" | "stats">("log");
  const all = useMemo(() => { const m = new Map<string, Spot>(); [...flownFromTrips(), ...L].forEach(s => m.set(s.id, s)); return [...m.values()].sort((a, b) => b.date.localeCompare(a.date)); }, [L]);
  const add = async () => { const r = reg.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""); if (!r) return; setBusy(true); setErr("");
    try { const j = await api(`/aircraft/${r}`); const i = j.info; if (!i && !j.live) throw new Error(`No aircraft found for ${r} in adsbdb / ADS-B`);
      const s: Spot = { id: "s:" + Date.now(), reg: (i?.registration || j.live?.reg || r).toUpperCase(), type: i ? `${i.manufacturer || ""} ${i.type || ""}`.trim() : j.live?.type, airline: i?.registered_owner || undefined, date: new Date().toISOString().slice(0, 10), where: where.trim() || undefined, how: "seen" };
      const n = [s, ...L]; setL(n); saveSpots(n); setReg(""); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const del = (id: string) => { const n = L.filter(s => s.id !== id); setL(n); saveSpots(n); };
  const regs = new Set(all.map(s => s.reg)), types = new Map<string, number>(), als = new Map<string, number>(); all.forEach(s => { if (s.type) types.set(s.type, (types.get(s.type) || 0) + 1); if (s.airline) als.set(s.airline, (als.get(s.airline) || 0) + 1); });
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return <><div className="head"><h2>Spotter log</h2>{x}</div><div className="px">
    <div className="sk-seg mini mb8"><button className={tab === "log" ? "on" : ""} onClick={() => setTab("log")}><span>Log</span></button><button className={tab === "stats" ? "on" : ""} onClick={() => setTab("stats")}><span>Stats</span></button></div>
    {tab === "log" ? <>
      <div className="card m0"><h3>Log a plane you saw</h3><div className="row g8 mt8"><input className="field" placeholder="Registration e.g. G-EZAA" value={reg} onChange={e => setReg(e.target.value)} aria-label="Registration" /><input className="field" placeholder="Where (optional)" value={where} onChange={e => setWhere(e.target.value)} aria-label="Where" /></div>
        <button className="primary mt8" disabled={busy || !reg.trim()} onClick={add}>{busy ? "Looking up…" : "Add"}</button>{err && <div className="bad sm mt8">{err}</div>}<div className="faint xs mt8">Type and owner come from adsbdb.com. Flights you've flown are added automatically from your tracked flights that had an aircraft assigned.</div></div>
      {!all.length && <div className="muted mt12">Nothing logged yet.</div>}
      {all.map(s => <div key={s.id} className="card m0 mt8 spot"><div className="row between"><b>{s.reg}</b><span className={"chip " + (s.how === "flown" ? "ok" : "")}>{s.how === "flown" ? "Flown" : "Seen"}</span></div><div className="muted sm">{[s.type, s.airline, s.flight, s.where, fmtD(s.date)].filter(Boolean).join(" · ")}</div><SpotPhoto s={s} />{s.id.startsWith("s:") && <button className="link sm" onClick={() => del(s.id)}>Remove</button>}</div>)}
    </> : <div className="card m0"><h3>Your stats</h3><div className="spot-st"><div><b>{regs.size}</b><small>airframes</small></div><div><b>{all.filter(s => s.how === "flown").length}</b><small>flown</small></div><div><b>{all.filter(s => s.how === "seen").length}</b><small>seen</small></div><div><b>{types.size}</b><small>types</small></div><div><b>{als.size}</b><small>airlines / owners</small></div></div>
      {als.size > 0 && <><h4 className="mt12">Airlines collected</h4>{top(als).map(([k, v]) => <div key={k} className="row between sm"><span>{k}</span><b>{v}</b></div>)}</>}
      {types.size > 0 && <><h4 className="mt12">Types</h4>{top(types).map(([k, v]) => <div key={k} className="row between sm"><span>{k}</span><b>{v}</b></div>)}</>}
      <div className="faint xs mt12">Counted only from planes you logged and flights you tracked.</div></div>}
  </div></>; }
export function OnlineOnly({ children }: { children: any }) { return useOnline() ? children : null; }
