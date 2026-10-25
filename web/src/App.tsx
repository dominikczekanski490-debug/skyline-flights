import { TerminalBoard } from "./terminal";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import MapView, { MAP_STYLES } from "./MapView";
import { Sheet, RoundBtn, I, Badge } from "./ui";
import { api, today, dist, fmtT, fmtD, best, delay, dur, lateLabel, lateColor, withEstArr, load, save, ics, download, wxIcon, tzOffset, estDurMin, type Flight, type Ap } from "./lib";
import { liveOf, statusOf } from "./lib";
import { AirlineTile } from "./brand";
import { EXAMPLE } from "./example";
import { Timeline, Progress, WeatherCard, AirportInfo, PassportMore, PasteImport, exportIcs, UnitsCard, AlertPrefsCard } from "./more";
import { FactorViz, WarmBanner, syncPush, testPush, pushState, pushStatus, exportBackup, importBackup, shareLink, parseShare, LeaveCard, PassportExtras, DepartureDay, UpdateBanner, PushChecklist, BUILD, localNotify } from "./extras";

type Ov = { t: "flight"; f: Flight } | { t: "board"; iata: string } | { t: "airports"; mode?: string } | { t: "search" } | { t: "settings" } | { t: "addpast" } | { t: "paste" };
const Logo = ({ a, s = 34 }: { a?: any; s?: number }) => <AirlineTile a={a} className="card-tile" mode="colour" style={{ width: Math.round(s * 2.4), height: s }} />;

export default function App() {
  const [tab, setTab] = useState<"mine" | "friends" | "passport">("mine");
  const [flights, setFlights] = useState<Flight[]>(load);
  const [ov, setOv] = useState<Ov[]>([]);
  const [live, setLive] = useState<Record<string, any>>({});
  const [mapStyle, setMapStyle] = useState(localStorage.getItem("sk.map2") || "dark");
  const [radar, setRadar] = useState(false); const [locate, setLocate] = useState(0);
  useEffect(() => { const m = location.hash.match(/board=([A-Za-z]{3})/); if (m) setOv([{ t: "board", iata: m[1].toUpperCase() }]); const a = location.hash.match(/airports=(\w+)/); if (a) setOv([{ t: "airports", mode: a[1] }]); }, []);
  const [why, setWhy] = useState<any>(null); (window as any).__why = (f: any) => { navigator.vibrate?.(8); setWhy(f); };
  const [theme, setTheme] = useState(localStorage.getItem("sk.theme") || "dark");
  useEffect(() => save(flights), [flights]);
  useEffect(() => { navigator.storage?.persist?.(); if (new URLSearchParams(location.search).get("tab") === "friends") { setTab("friends"); history.replaceState(null, "", "/"); } }, []);
  useEffect(() => { const f = () => document.visibilityState === "visible" && syncPush(flights.filter(x => !x.friend)).catch(e => console.warn("push resync", e)); const t = setTimeout(f, 1500); const iv = setInterval(f, 10 * 60e3); document.addEventListener("visibilitychange", f); return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener("visibilitychange", f); }; }, [flights.filter(f => !f.friend).map(f => f.id).join()]);
  useEffect(() => { localStorage.setItem("sk.theme", theme); document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { localStorage.setItem("sk.map2", mapStyle); }, [mapStyle]);
  // import a friend's shared flight from URL
  useEffect(() => { const p = new URLSearchParams(location.search).get("share"); if (p) { try { const f = JSON.parse(decodeURIComponent(escape(atob(p)))); f.friend = f.friend || "Friend"; setFlights(l => l.some(x => x.id === f.id && x.friend) ? l : [...l, { ...f, id: f.id }]); setTab("friends"); history.replaceState(null, "", "/"); } catch {} } }, []);
  const push = (o: Ov) => setOv(s => [...s, o]); const pop = () => setOv(s => s.slice(0, -1));
  const upd = (f: Flight) => setFlights(l => l.map(x => x.id === f.id && !!x.friend === !!f.friend ? f : x));
  const active = flights.filter(f => !f.example && f.date >= new Date(Date.now() - 86400e3).toISOString().slice(0, 10));
  // refresh active flights + live positions, notify on change
  // Refresh every tracked flight from the server on open, whenever the app comes back to the foreground, and every 60 s.
  // (Before: a status change fired `new Notification()`, which throws on iPhone, so the update was never saved and the card stayed stale.)
  const flRef = useRef(flights); flRef.current = flights;
  useEffect(() => { let busy = false; const tick = async () => { if (busy || document.visibilityState !== "visible") return; busy = true;
    const now = flRef.current.filter(f => !f.example && f.date >= new Date(Date.now() - 86400e3).toISOString().slice(0, 10));
    for (const f of now) { try { const r = await api(`/flight/${f.number}?date=${f.date}`); setLive(l => ({ ...l, [f.id]: r.live || null }));
      if (r.flight && !f.manual) { const n: Flight = { ...f, ...r.flight, id: f.id, date: f.date, notes: f.notes, friend: f.friend, checkedAt: Date.now(), live: r.live ? { ...r.live, at: Date.now() } : null, aircraft: { ...f.aircraft, ...r.flight.aircraft, ...(r.live ? { reg: r.live.reg, hex: r.live.hex, model: r.live.type } : {}) } } as any;
        const msg: string[] = []; if (n.statusText !== f.statusText && n.statusText) msg.push(n.statusText!); if (n.dep.gate !== f.dep.gate && n.dep.gate) msg.push(`Gate ${n.dep.gate}`);
        if (msg.length) { n.updates = [...(f.updates || []), { at: Date.now(), text: msg.join(" · ") }]; localNotify(`${n.number} ${n.origin?.iata}→${n.destination?.iata}`, msg.join(" · "), n.id); }
        upd(n); } } catch (e) { console.warn("refresh", f.number, e); } }
    busy = false; };
    tick(); const t = setInterval(tick, 60e3); const v = () => document.visibilityState === "visible" && tick(); document.addEventListener("visibilitychange", v); window.addEventListener("focus", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); window.removeEventListener("focus", v); }; }, [active.map(f => f.id).join()]);
  const top = ov.at(-1); const focus = top?.t === "flight" ? top.f : null;
  const mapFlights = focus ? [focus] : tab === "passport" ? flights.filter(f => !f.friend) : tab === "friends" ? flights.filter(f => f.friend) : active.filter(f => !f.friend);
  return <div className="app"><WarmBanner /><UpdateBanner />{why && <WhySheet f={why} close={() => setWhy(null)} />}
    <MapView flights={mapFlights} live={live} style={mapStyle} radar={radar} focus={focus} locate={locate} onPlane={id => { const f = flights.find(x => x.id === id); f && push({ t: "flight", f }); }} />
    <div className="maptint" /><div className="aurora" />
    <div className="mapbtns"><button onClick={() => setMapStyle(MAP_STYLES[(MAP_STYLES.indexOf(mapStyle) + 1) % MAP_STYLES.length])}>{I.layers}</button><button className={radar ? "on" : ""} onClick={() => setRadar(!radar)}>{I.cloud}</button><button onClick={() => setLocate(Date.now())}>{I.locate}</button></div>
    <Sheet snaps={[0.3, 0.55, 0.94]} initial={1} z={5}>
      {tab === "mine" && <MyFlights list={active.filter(f => !f.friend)} open={f => push({ t: "flight", f })} push={push} />}
      {tab === "friends" && <Friends list={flights.filter(f => f.friend)} open={f => push({ t: "flight", f })} push={push} />}
      {tab === "passport" && <Passport flights={flights.filter(f => !f.friend)} setFlights={setFlights} open={f => push({ t: "flight", f })} push={push} />}
      <div style={{ height: 120 }} />
    </Sheet>
    {!ov.length && <nav className="tabbar"><div className="pill"><i className="tabind" style={{ transform: `translateX(${["mine","friends","passport"].indexOf(tab) * 100}%)` }} />
      {([["mine", "My Flights", I.plane], ["friends", "Friends", I.friends], ["passport", "Passport", I.passport]] as const).map(([k, l, ic]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{ic}<span>{l}</span></button>)}
    </div><button className="searchbtn" onClick={() => push({ t: "search" })}>{I.search}</button></nav>}
    {ov.map((o, i) => <Overlay key={i + o.t} o={o} z={20 + i} close={pop} push={push} flights={flights} setFlights={setFlights} upd={upd} live={live} theme={theme} setTheme={setTheme} tab={tab} />)}
  </div>;
}

function Head({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) { return <div className="head"><div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div><div className="row g8">{right}</div></div>; }
const Avatar = ({ onClick }: { onClick?: () => void }) => <button className="avatar" onClick={onClick}>D</button>;

function FlightCard({ f, onClick, pred }: { f: Flight; onClick: () => void; pred?: boolean }) {
  const g = withEstArr(f); const dd = delay(f.dep); const [p, setP] = useState<any>(null);
  useEffect(() => { if (pred && !f.example) api(`/predict/${f.number}?date=${f.date}`).then(setP).catch(() => {}); }, [f.id]);
  const until = best(f.dep) ? (+new Date(best(f.dep)!) - Date.now()) / 60000 : null;
  const dm = estDurMin(f.origin, f.destination) || 0; const st = best(f.dep) ? (Date.now() - +new Date(best(f.dep)!)) / 60000 : -1;
  const lv = liveOf(f); const S = statusOf(f, lv);
  const prog = f.status === "landed" ? 100 : lv?.progress != null ? lv.progress : ["departed", "enroute"].includes(f.status || "") && st > 0 ? Math.min(95, (st / Math.max(dm, 1)) * 100) : 0;
  const sTxt = S.label, sCls = S.cls;
  return <div className="card fcard rise press" onClick={onClick}>
    <div className="row between"><div className="row g12"><Logo a={f.airline} s={36} /><div><div className="fnum">{f.number}<span> • {fmtD(f.date, { weekday: "short", day: "numeric", month: "short" })}{f.friend && ` • ${f.friend}`}</span></div><div className="froute">{f.origin?.city || f.origin?.iata} → {f.destination?.city || f.destination?.iata}</div></div></div>
      <span className={"spill " + sCls}><i />{sTxt}</span></div>
    <div className="fbig"><div><div className="iata">{f.origin?.iata}</div><div className="ftime" style={{ color: lateColor(dd) }}>{fmtT(best(f.dep), f.origin?.tz)}</div></div>
      <div className="ftrack"><div className="fdur">{dm ? dur(dm) : ""}</div><div className="fline"><span style={{ width: `${prog}%` }} /><i style={{ left: `${prog}%` }}>{I.glyph}</i></div><div className="fdur">{lv && typeof lv.alt === "number" ? `${Math.round(lv.alt / 100) * 100} ft · ${Math.round(lv.gs || 0)} kt` : until != null && until > 0 && !["departed", "enroute", "landed", "cancelled"].includes(f.status || "") ? `departs in ${dur(until)}` : f.statusText || ""}</div></div>
      <div className="right"><div className="iata">{f.destination?.iata}</div><div className="ftime">{fmtT(best(g.arr), f.destination?.tz)}{(g.arr as any).estimatedOnly && <sup>est</sup>}</div></div></div>
    {p && !p.cancelled && <div className="aiwrap"><span className="aichip press" onClick={e => { e.stopPropagation(); (window as any).__why?.(f); }}><b style={{ color: lateColor(p.predictedDelay) }}>AI {p.predictedDelay >= 5 ? `+${p.predictedDelay}m` : "on time"}</b></span>{p?.top && <span className="toprsn">{p.summary}</span>}</div>}
  </div>;
}

function MyFlights({ list, open, push }: { list: Flight[]; open: (f: Flight) => void; push: (o: Ov) => void }) {
  return <>
    <Head title="My Flights" right={<><RoundBtn onClick={() => push({ t: "airports" })}>{I.share}</RoundBtn><Avatar onClick={() => push({ t: "settings" })} /></>} />
    <div className="qa">{([[I.alert, "Disruptions", "Live delay scores", () => push({ t: "airports", mode: "disruptions" }), "r"], [I.globe, "Airports", "Status worldwide", () => push({ t: "airports" }), "b"], [I.takeoff, "MAN board", "Departures now", () => push({ t: "board", iata: "MAN" }), "g"], [I.sliders, "Settings", "Keys & theme", () => push({ t: "settings" }), "v"]] as const).map(([ic, t, s, fn, c]) => <button key={t} className={"qtile press q" + c} onClick={fn}><span className="qic">{ic}</span><b>{t}</b><small>{s}</small></button>)}</div>
    {!list.length ? <div className="empty"><b>Let's Fly Somewhere</b><span>Tap <span className="mini">{I.search}</span> Search to add your next flight</span>
      <div className="row g8 mt16 wrap center"><button className="chip" onClick={() => push({ t: "board", iata: "MAN" })}>Manchester board</button><button className="chip" onClick={() => push({ t: "airports" })}>Airport delays</button></div></div>
      : list.sort((a, b) => (best(a.dep) || a.date) < (best(b.dep) || b.date) ? -1 : 1).map(f => <FlightCard key={f.id} f={f} onClick={() => open(f)} pred />)}
  </>;
}

function Friends({ list, open, push }: { list: Flight[]; open: (f: Flight) => void; push: (o: Ov) => void }) {
  return <><Head title="Friends" right={<Avatar onClick={() => push({ t: "settings" })} />} />
    {!list.length && <div className="empty"><b>Follow friends' flights</b><span>Open any flight → Share to send a link. When a friend opens your link (or you open theirs) the flight appears here and updates live.</span></div>}
    {list.map(f => <FlightCard key={f.id} f={f} onClick={() => open(f)} pred />)}
    <div className="px mt16"><button className="primary wide" onClick={() => push({ t: "search" })}>＋ Add Friend's Flight</button>
      <button className="secondary wide mt8" style={{ width: "100%" }} onClick={() => { const u = prompt("Paste a Skyline share link"); const s = u && parseShare(u); if (s) location.href = u!.slice(u!.indexOf("/s/")); else if (u) alert("That isn't a Skyline share link"); }}>🔗 Follow from a share link</button></div></>;
}

// ---------------- Passport ----------------
function Passport({ flights, setFlights, open, push }: { flights: Flight[]; setFlights: (f: any) => void; open: (f: Flight) => void; push: (o: Ov) => void }) {
  const years = [...new Set(flights.map(f => f.date.slice(0, 4)))].sort().reverse();
  const [yr, setYr] = useState("All"); const [sort, setSort] = useState("Date");
  const L = flights.filter(f => yr === "All" || f.date.startsWith(yr)).filter(f => f.date <= today() || f.status === "landed");
  const s = useMemo(() => { let mi = 0, min = 0, lh = 0, lost = 0, nl = 0; const ap = new Set<string>(), al = new Set<string>(), ac: Record<string, number> = {};
    for (const f of L) { const d = dist(f.origin, f.diverted || f.destination); mi += d; if (d > 3000) lh++; const a = withEstArr(f); const t = best(a.arr) && best(f.dep) ? (+new Date(best(a.arr)!) - +new Date(best(f.dep)!)) / 60000 : estDurMin(f.origin, f.destination); min += Math.max(0, t);
      f.origin && ap.add(f.origin.iata); f.destination && ap.add(f.destination.iata); f.airline?.iata && al.add(f.airline.iata); const m = f.aircraft?.model; if (m) ac[m] = (ac[m] || 0) + 1;
      const dl = delay(f.arr) ?? delay(f.dep); if (dl && dl > 0) { lost += dl; nl++; } }
    const top = Object.entries(ac).sort((a, b) => b[1] - a[1])[0]; return { mi, min, lh, lost, nl, ap: ap.size, al: al.size, top }; }, [L]);
  const ex = flights.some(f => f.example);
  const sorted = [...L].sort((a, b) => sort === "From" ? (a.origin?.city || "").localeCompare(b.origin?.city || "") : sort === "To" ? (a.destination?.city || "").localeCompare(b.destination?.city || "") : sort === "Airline" ? (a.airline?.name || "").localeCompare(b.airline?.name || "") : sort === "Aircraft" ? (a.aircraft?.model || "").localeCompare(b.aircraft?.model || "") : a.date < b.date ? 1 : -1);
  const groups: Record<string, Flight[]> = {}; sorted.forEach(f => (groups[sort === "Date" ? f.date.slice(0, 4) : sort] ||= []).push(f));
  const imp = (e: any) => { const file = e.target.files[0]; if (!file) return; file.text().then(async (t: string) => { const rows = file.name.endsWith(".ics") ? parseIcs(t) : parseCsv(t); const out: Flight[] = [];
    for (const r of rows) out.push(await manualFlight(r.number, r.date, r.from, r.to)); setFlights((l: Flight[]) => [...l, ...out]); alert(`Imported ${out.length} flights`); }); };
  return <>
    <Head title="Passport" right={<><RoundBtn onClick={() => navigator.share?.({ title: "My Skyline Passport", text: `${L.length} flights • ${s.mi.toLocaleString()} mi • ${s.ap} airports` })}>{I.share}</RoundBtn><Avatar onClick={() => push({ t: "settings" })} /></>} />
    <div className="segs">{["All", ...years].map(y => <button key={y} className={yr === y ? "on" : ""} onClick={() => setYr(y)}>{y === "All" ? "All-Time" : y}</button>)}</div>
    {ex && <div className="exlabel">Example data — sample flights so you can see the layout. <button onClick={() => setFlights((l: Flight[]) => l.filter(f => !f.example))}>Remove</button></div>}
    <div className="pcard passport"><div className="row between"><div><div className="ptitle">{yr === "All" ? "ALL-TIME" : yr} SKYLINE PASSPORT</div><div className="psub">▭ PASSPORT • PASS • PASAPORTE</div></div>{I.share}</div>
      <div className="grid2"><div><label>FLIGHTS</label><b className="h1">{L.length}</b><small>{s.lh} Long Haul</small></div><div><label>DISTANCE</label><b className="h1">{s.mi.toLocaleString()} mi</b><small>{(s.mi / 24901).toFixed(1)}x around the world</small></div></div>
      <div className="grid3"><div><label>FLIGHT TIME</label><b className="h2">{dur(s.min)}</b></div><div><label>AIRPORTS</label><b className="h2">{s.ap}</b></div><div><label>AIRLINES</label><b className="h2">{s.al}</b></div></div>
    </div>
    <div className="pcard delays"><div className="row between"><b className="huge">{Math.round(s.lost / 60)}</b>{I.share}</div><div className="h3">hours lost from delays</div><small>Delayed flights averaged {s.nl ? dur(s.lost / s.nl) : "0m"} late</small></div>
    <div className="pcard aircraft"><div className="h3">Most flown aircraft</div><b className="h1 thin">{s.top?.[0] || "—"}</b><small>{s.top?.[1] || 0} flights</small><div className="acimg">{I.plane}</div></div>
    <PassportExtras L={L} yr={yr} />
    <PassportMore L={L} />
    <div className="row g8 px wrap mt8"><button className="chip" onClick={() => push({ t: "addpast" })}>＋ Add past flight</button><button className="chip" onClick={() => push({ t: "paste" })}>Paste booking email</button><button className="chip" onClick={() => exportIcs(flights.filter((f: Flight) => !f.friend && !f.example))}>{I.cal} Export .ics</button><label className="chip">⇪ Import CSV / .ics<input hidden type="file" accept=".csv,.ics" onChange={imp} /></label>
      <button className="chip" onClick={() => download("skyline.ics", ics(L))}>{I.cal} Export .ics</button>{!flights.length && <button className="chip" onClick={() => setFlights(EXAMPLE)}>Load example data</button>}</div>
    <div className="sorts">{["Date", "From", "To", "Airline", "Aircraft"].map(k => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{k}{sort === k && " ↓"}</button>)}</div>
    {Object.entries(groups).map(([g, l]) => <div key={g}><div className="ghead"><b>{g}</b><span>{l.length} FLIGHTS</span></div>
      {l.map(f => <div key={f.id} className="lrow" onClick={() => open(f)}><Logo a={f.airline} /><div className="grow"><div className="row between muted sm"><span>{f.number} <span className="faint">{f.origin?.iata} → {f.diverted ? <s>{f.destination?.iata}</s> : f.destination?.iata}</span>{f.example && <em className="ex"> example</em>}</span><span>{fmtD(f.date)}</span></div>
        <b>{f.origin?.city} to {f.diverted ? <s>{f.destination?.city}</s> : f.destination?.city}</b></div></div>)}</div>)}
  </>;
}
function parseCsv(t: string) { const [h, ...rows] = t.trim().split(/\r?\n/); const k = h.toLowerCase().split(",").map(x => x.trim()); const ix = (n: string[]) => k.findIndex(x => n.includes(x));
  const [a, b, c, d] = [ix(["flight", "number", "flight number"]), ix(["date"]), ix(["from", "origin"]), ix(["to", "destination"])];
  return rows.map(r => r.split(",").map(x => x.trim())).map(r => ({ number: r[a], date: r[b], from: r[c], to: r[d] })).filter(r => r.date); }
function parseIcs(t: string) { return t.split("BEGIN:VEVENT").slice(1).map(e => { const sm = (e.match(/SUMMARY:(.*)/)?.[1] || ""); const n = sm.match(/\b([A-Z0-9]{2}\s?\d{1,4})\b/)?.[1]?.replace(" ", "") || "";
  const ap = sm.match(/\b([A-Z]{3})\s*(?:→|-|to)\s*([A-Z]{3})\b/); const d = e.match(/DTSTART[^:]*:(\d{8})/)?.[1] || ""; return { number: n, date: d && `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, from: ap?.[1], to: ap?.[2] }; }).filter(r => r.date); }
async function manualFlight(number: string, date: string, from?: string, to?: string, ac?: string): Promise<Flight> {
  const [o, d, al] = await Promise.all([from ? api("/airport/" + from).catch(() => null) : null, to ? api("/airport/" + to).catch(() => null) : null, number ? api("/airline/" + number.slice(0, 2)).catch(() => null) : null]);
  return { id: `${number}-${date}-${Math.random().toString(36).slice(2, 6)}`, number: (number || "").toUpperCase(), date, origin: o, destination: d, airline: al, dep: {}, arr: {}, manual: true, status: "landed", aircraft: ac ? { model: ac } : undefined };
}

// ---------------- overlays ----------------
function Overlay(p: { o: Ov; z: number; close: () => void; push: (o: Ov) => void; flights: Flight[]; setFlights: any; upd: (f: Flight) => void; live: any; theme: string; setTheme: any; tab: string }) {
  const { o, z, close } = p;
  const x = <RoundBtn onClick={close}>{I.close}</RoundBtn>;
  if (o.t === "search") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><SearchView {...p} x={x} /></Sheet>;
  if (o.t === "flight") return <Sheet z={z} onClose={close} snaps={[0.5, 0.94]} initial={0} header={<div className="head fhead"><div className="row g10"><Logo a={o.f.airline} /><div><div className="muted sm">{o.f.number} • {fmtD(o.f.date, { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}</div><h2>{o.f.origin?.city} to {o.f.diverted ? <s>{o.f.destination?.city}</s> : o.f.destination?.city}</h2></div></div>{x}</div>}>
    <FlightDetail f={p.flights.find(f => f.id === o.f.id) || o.f} {...p} /></Sheet>;
  if (o.t === "board") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Board iata={o.iata} x={x} push={p.push} /></Sheet>;
  if (o.t === "airports") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Airports x={x} push={p.push} flights={p.flights} initial={o.mode} /></Sheet>;
  if (o.t === "paste") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Head title="Import booking" right={x} /><PasteImport add={(fl: Flight[]) => { p.setFlights((l: Flight[]) => [...l, ...fl.filter(n => !l.some(y => y.id === n.id))]); close(); }} /></Sheet>;
  if (o.t === "addpast") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><AddPast x={x} done={(f: Flight) => { p.setFlights((l: Flight[]) => [...l, f]); close(); }} /></Sheet>;
  return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Settings x={x} theme={p.theme} setTheme={p.setTheme} /></Sheet>;
}

function SearchView({ x, push, setFlights, close }: any) {
  const [q, setQ] = useState(""); const [date, setDate] = useState(today()); const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [aps, setAps] = useState<Ap[]>([]);
  const [mode, setMode] = useState<"flight" | "route" | "airport">("flight"); const [to, setTo] = useState("");
  useEffect(() => { if (mode !== "flight" && q.length >= 2) api("/airports/search?q=" + q).then(setAps).catch(() => {}); else setAps([]); }, [q, mode]);
  const go = async () => { setBusy(true); setRes(null); try { if (mode === "flight") setRes(await api(`/flight/${q.replace(/\s/g, "")}?date=${date}`)); else if (mode === "route") setRes({ list: (await api(`/route?from=${q}&to=${to}&date=${date}`)).flights }); } catch (e: any) { setRes({ error: e.message, needsKey: e.needsKey }); } setBusy(false); };
  const add = (f: Flight, friend?: boolean) => { const n = { ...f, id: f.id || `${f.number}-${date}`, date }; setFlights((l: Flight[]) => [...l.filter(y => !(y.id === n.id && !!y.friend === !!friend)), friend ? { ...n, friend: "Friend" } : n]); close(); };
  return <><Head title="Search" right={x} />
    <div className="segs">{(["flight", "route", "airport"] as const).map(m => <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setRes(null); }}>{m === "flight" ? "Flight #" : m === "route" ? "Route" : "Airport"}</button>)}</div>
    <div className="px col g8"><input className="field" autoFocus placeholder={mode === "flight" ? "e.g. LS965, FR2141, BA1393" : "From airport (e.g. MAN)"} value={q} onChange={e => setQ(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && go()} />
      {mode === "route" && <input className="field" placeholder="To airport (optional, e.g. LCA)" value={to} onChange={e => setTo(e.target.value.toUpperCase())} />}
      {mode !== "airport" && <div className="row g8"><input className="field grow" type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="primary" onClick={go}>{busy ? "…" : "Search"}</button></div>}</div>
    {mode !== "flight" && aps.length > 0 && <div className="mt8">{aps.map(a => <div key={a.iata} className="lrow" onClick={() => mode === "airport" ? push({ t: "board", iata: a.iata }) : (setQ(a.iata), setAps([]))}><span className="code">{a.iata}</span><div><b>{a.name}</b><div className="muted sm">{a.city}, {a.country}</div></div></div>)}</div>}
    {res?.error && <div className="note warn">{res.error}{res.needsKey && " — this airport needs a free AeroDataBox key (Settings)."}</div>}
    {res?.flight && <div className="mt8"><FlightCard f={{ ...res.flight, date }} onClick={() => push({ t: "flight", f: { ...res.flight, date } })} />
      <div className="muted sm px">Sources: {res.sources.join(", ")}{res.flight.scheduleUnknown && " — schedule times need an AeroDataBox key for this airport"}</div>
      <div className="row g8 px mt8"><button className="primary grow" onClick={() => add(res.flight)}>＋ Track flight</button><button className="secondary grow" onClick={() => add(res.flight, true)}>＋ Friend's flight</button></div></div>}
    {res && !res.flight && !res.list && !res.error && <div className="note">No schedule found for {q} on {date}. Free schedule data covers flights at MAN, STN, EMA, FRA, SYD and 45 Norwegian (Avinor) airports; add a free AeroDataBox key in Settings for worldwide coverage.</div>}
    {res?.list && <div className="mt8">{res.list.map((f: Flight) => <BoardRow key={f.id} f={f} dir="dep" onClick={() => push({ t: "flight", f: { ...f, date } })} />)}{!res.list.length && <div className="note">No flights found.</div>}</div>}
    <div className="note mt16">Tip: free real-time schedules, gates & delays come straight from Manchester, Stansted and East Midlands airports. Live positions come from ADS-B (adsb.lol).</div>
  </>;
}

function Stat({ label, v }: { label: string; v: ReactNode }) { return <div><label>{label}</label><b>{v}</b></div>; }
function WhySheet({ f, close }: any) {
  const [p, setP] = useState<any>(null); useEffect(() => { api(`/predict/${f.number}?date=${f.date || today()}`).then(setP).catch(e => setP({ error: e.message })); }, [f.number]);
  return <><motion.div className="whyback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close} />
    <motion.div className="whysheet" initial={{ y: 400 }} animate={{ y: 0 }} transition={{ type: "spring", damping: 28, stiffness: 320 }} drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 120) close(); }}>
      <div className="grabber" /><div className="row between"><h3>✦ Why {f.number} might be late</h3><span className="faint sm">Estimate</span></div>
      {!p ? <div className="skel" style={{ height: 120 }} /> : p.error ? <div className="note warn">{p.error}</div> : <>
        <div className="psum2">{p.summary}</div><Factors list={p.factors || []} /><div className="faint sm mt8">ⓘ {p.confidenceNote} Prediction from real inputs only — not observed data.</div></>}
    </motion.div></>;
}
function Factors({ list }: { list: any[] }) {
  const col: any = { high: "#ff453a", med: "#ff9f0a", low: "#8e8e93", good: "#30d158" }; const lab: any = { high: "Major", med: "Moderate", low: "Minor", good: "Helps" };
  const mx = Math.max(10, ...list.map(x => Math.abs(x.impact)));
  return <div className="pfac"><div className="plab">Why this flight might be late · ranked by impact</div>{list.map((x: any, i: number) => <motion.div key={i} className="pfrow" style={{ ["--sv" as any]: col[x.sev] }} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 22, stiffness: 260, delay: 0.08 * i }}>
    <div className="pfic" style={{ background: col[x.sev] + "22" }}>{x.icon}</div>
    <div className="grow"><div className="row between g8"><b className="pft">{x.title}</b><span className={"pfimp" + (x.data ? " big" : "")} style={{ color: col[x.sev], ...(x.data ? { background: `linear-gradient(135deg, ${col[x.sev]}2e, ${col[x.sev]}12)`, boxShadow: `0 0 0 1px ${col[x.sev]}40 inset` } : {}) }}>{x.impact > 0 ? `+${x.impact}m` : x.impact < 0 ? `${x.impact}m` : "±0"}{x.data && <small>impact</small>}</span></div>
      <div className="pftx">{x.text}</div><FactorViz x={x} color={col[x.sev]} />
      <div className="row g8 mt6"><span className="pchip" style={{ color: col[x.sev], background: col[x.sev] + "1f" }}>{lab[x.sev]}</span><div className="pimp"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.abs(x.impact) / mx * 100}%` }} transition={{ duration: 0.8, delay: 0.1 + 0.05 * i }} style={{ background: col[x.sev] }} /></div></div></div>
  </motion.div>)}</div>;
}
function Gauge({ d }: { d: number }) {
  const t = Math.max(0, Math.min(1, (Math.max(-10, d) + 10) / 100)); const L = Math.PI * 80;
  return <svg viewBox="0 0 200 116" className="pg"><defs><linearGradient id="pgg" x1="0" x2="1"><stop offset="0" stopColor="#30d158" /><stop offset=".5" stopColor="#ff9f0a" /><stop offset="1" stopColor="#ff453a" /></linearGradient><filter id="pgl"><feGaussianBlur stdDeviation="4" /></filter></defs>
    <path d="M20 100a80 80 0 0 1 160 0" stroke="var(--line)" strokeWidth="12" fill="none" strokeLinecap="round" />
    <motion.path d="M20 100a80 80 0 0 1 160 0" stroke="url(#pgg)" strokeWidth="12" fill="none" strokeLinecap="round" filter="url(#pgl)" opacity=".45" strokeDasharray={L} initial={{ strokeDashoffset: L }} animate={{ strokeDashoffset: L * (1 - t) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
    <motion.path d="M20 100a80 80 0 0 1 160 0" stroke="url(#pgg)" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={L} initial={{ strokeDashoffset: L }} animate={{ strokeDashoffset: L * (1 - t) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} /></svg>;
}
function CountUp({ v }: { v: number }) { const [n, setN] = useState(0); useEffect(() => { let r = 0; const s = performance.now(); const f = (t: number) => { const k = Math.min(1, (t - s) / 900); setN(Math.round(v * (1 - Math.pow(1 - k, 3)))); if (k < 1) r = requestAnimationFrame(f); }; r = requestAnimationFrame(f); return () => cancelAnimationFrame(r); }, [v]); return <>{n}</>; }
function Prediction({ f }: { f: Flight }) {
  const [p, setP] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { if (!f.example) api(`/predict/${f.number}?date=${f.date}`).then(setP).catch(e => setErr(e.message)); }, [f.id, f.statusText]);
  if (f.example) return null;
  if (!p) return <div className="pcard"><div className="phead"><span className="ptitle">✦ Delay Forecast</span></div>{err ? <div className="muted sm">{err}</div> : <><div className="skel" style={{ height: 110, marginTop: 12 }} /><div className="skel" style={{ height: 60, marginTop: 10 }} /></>}</div>;
  const d = p.predictedDelay ?? 0; const c = p.cancelled ? "#ff453a" : d >= 45 ? "#ff453a" : d >= 15 ? "#ff9f0a" : "#30d158";
  const bars = [["On time", "under 15 min", p.probs.onTime, "#30d158"], ["15+ min late", "", p.probs.late15, "#ff9f0a"], ["45+ min late", "", p.probs.late45, "#ff453a"], ["Cancelled", "", p.probs.cancel, "#bf5af2"], ["Diverted", "", p.probs.divert, "#64d2ff"]];
  return <div className="pcard" style={{ ["--pc" as any]: c }}>
    <div className="phead"><span className="ptitle">✦ Delay Forecast</span><span className={"pconf " + p.confidence}><i />{p.confidence[0].toUpperCase() + p.confidence.slice(1)} confidence</span></div>
    <div className="phero"><Gauge d={d} /><div className="pfig"><div className="pnum" style={{ color: c }}>{p.cancelled ? "Cancelled" : d >= 5 ? <>+<CountUp v={d} /><small>min</small></> : "On time"}</div>{p.range && !p.cancelled && <div className="prng">Likely {p.range[0] < 0 ? p.range[0] : "+" + p.range[0]} to +{p.range[1]} min</div>}</div></div>
    {p.summary && <div className="psum2">{p.summary}</div>}
    <div className="pglass"><div className="plab">Chances</div>{bars.map(([l, sub, v, col]: any, i) => <div key={l} className="pbar"><span>{l}{sub && <em> {sub}</em>}</span><div><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(v, v > 0 ? 1.5 : 0)}%` }} transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }} style={{ background: `linear-gradient(90deg, ${col}aa, ${col})` }} /></div><b>{v}%</b></div>)}</div>
    <Factors list={p.factors || []} />
    {p.confidenceNote && <div className="pnote">ⓘ {p.confidenceNote}</div>}
    <div className="pexp">{p.explanation?.text}<div className="pby">{p.explanation?.by === "llm" ? "Written by your LLM from the model's real inputs" : "Template summary · add an LLM key in Settings for AI-written text"} · Estimate, not observed data</div></div></div>;
}

function FlightDetail({ f, upd, setFlights, flights, close, push, live }: any) {
  const g = withEstArr(f); const dd = delay(f.dep), da = delay(g.arr); const lv = live[f.id] || liveOf(f);
  const [wx, setWx] = useState<any[]>([]); const [ac, setAc] = useState<any>(null); const [fc, setFc] = useState<any>(null); const [inb, setInb] = useState<any>(null); const [al, setAl] = useState<any>(f.airline);
  useEffect(() => { Promise.all([f.origin, f.destination].map((a: Ap) => a?.lat ? api(`/weather?lat=${a.lat}&lon=${a.lon}`).catch(() => null) : null)).then(setWx);
    if (!f.example) api(`/forecast/${f.number}`).then(setFc).catch(() => {}); if (f.airline?.iata && !f.airline.links) api("/airline/" + f.airline.iata).then(setAl).catch(() => {}); }, [f.id]);
  const hex = lv?.hex || f.aircraft?.hex, reg = lv?.reg || f.aircraft?.reg;
  useEffect(() => { if (hex || reg) api(`/aircraft?hex=${hex || ""}&reg=${reg || ""}`).then(setAc).catch(() => {}); if (reg) api(`/inbound?reg=${reg}&date=${f.date}`).then(setInb).catch(e => setInb({ err: e.message, needsKey: e.needsKey })); }, [hex, reg]);
  const tracked = flights.some((x: Flight) => x.id === f.id);
  const until = best(f.dep) ? (+new Date(best(f.dep)!) - Date.now()) / 60000 : 0;
  const banner = f.status === "cancelled" ? ["Cancelled", "red"] : f.status === "landed" ? [`Arrived ${da != null ? lateLabel(da) : ""}`, da && da > 14 ? "red" : "green"] : f.status === "enroute" ? [`En route${lv?.eta ? ", ETA " + fmtT(lv.eta, f.destination?.tz) : ""}`, "blue"] : f.status === "departed" ? ["Departed " + (f.dep.actual ? fmtT(f.dep.actual, f.origin?.tz) : ""), "blue"] : until > 0 ? [`Gate Departure in ${dur(until)}`, dd && dd > 14 ? "red" : "green"] : [f.statusText || "Scheduled", "green"];
  const tz = tzOffset(f.destination?.tz) - tzOffset(f.origin?.tz);
  const shareUrl = () => shareLink(f);
  const h = (f.history = flights.filter((x: Flight) => x.origin?.iata === f.origin?.iata && x.destination?.iata === f.destination?.iata && !x.friend));
  return <div className="fd">
    {f.example && <div className="exlabel">Example data — not a real flight record</div>}
    <div className={"banner " + banner[1]}><b>{banner[0]}</b><div className="sm">Total {dur(estDurMin(f.origin, f.destination))} est. • {dist(f.origin, f.destination).toLocaleString()} mi{lv ? ` • live ${Math.round(lv.alt || 0).toLocaleString()} ft, ${Math.round(lv.gs || 0)} kt` : ""}</div>{lv?.matched === "route" && <div className="sm">{lv.matchNote}. Probable match: the airline flies a different radio callsign from the flight number.</div>}</div>
    <TimeBlock dir="dep" a={f.origin} t={f.dep} d={dd} badge={<Badge icon={<span>↗</span>} v={f.dep.gate} k={f.dep.terminal && `Terminal ${f.dep.terminal}`} />} />
    {f.diverted && <div className="divert">⑂ DIVERTED TO {f.diverted.iata}<span>Search for Recovery Flight ›</span></div>}
    <div className="sep"><span>◷ {dur(estDurMin(f.origin, f.destination))} • {dist(f.origin, f.destination).toLocaleString()} mi</span></div>
    <TimeBlock dir="arr" a={f.diverted || f.destination} t={g.arr} d={da} est={(g.arr as any).estimatedOnly} badge={<Badge icon={I.bag} v={f.arr.baggage || f.arr.gate} k={f.arr.terminal && `Terminal ${f.arr.terminal}`} />} />
    <div className="muted sm px">Source: {f.source || (f.manual ? "entered manually" : "—")}</div>
    <Progress f={f} lv={lv} />
    <Timeline f={f} />
    <Prediction f={f} />
    <LeaveCard f={f} /><DepartureDay f={f} />
    <WeatherCard w={wx[0]} a={f.origin} label="Departure" />
    <WeatherCard w={wx[1]} a={f.destination} label="Arrival" />
    <h3 className="px">Good to Know</h3>
    <div className="gtk"><span className="ico">🕘</span><div><b>{tz ? `${tz > 0 ? "+" : ""}${tz / 60}h Timezone Change` : "No Timezone Change"}</b><div className="muted sm">{tz ? `${f.destination?.city} is ${Math.abs(tz / 60)}h ${tz > 0 ? "ahead of" : "behind"} ${f.origin?.city}` : "Both airports are in the same timezone"}</div></div></div>
    <div className="card"><h3>Arrival Forecast</h3><div className="muted sm">{f.number} recorded performance{fc ? ` • ${fc.observed} observed flights` : ""}</div>
      {fc && fc.observed ? <><div className="grid3 mt8"><Stat label="Late" v={`${fc.latePct}%`} /><Stat label="Average of Late" v={`${fc.avgLate}m`} /><Stat label="Observed" v={`${fc.observed} Flights`} /></div>
        {[["Early", fc.buckets.early, "#2f9e44"], ["On Time", fc.buckets.ontime, "#69db7c"], ["15m late", fc.buckets.l15, "#fcc419"], ["30m late", fc.buckets.l30, "#fd7e14"], ["45m+ late", fc.buckets.l45, "#fa5252"], ["Canceled", fc.buckets.cancelled, "#c92a2a"], ["Diverted", fc.buckets.diverted, "#862e2e"]].map(([l, v, c]: any) => <div key={l} className="bar"><span>{l}</span><div><i style={{ width: `${v / fc.observed * 100}%`, background: c }} /></div><b>{Math.round(v / fc.observed * 100)}%</b></div>)}
        <div className="faint sm mt8">{fc.source}</div></> : <div className="muted sm mt8">No recorded history yet. Skyline records every MAN/STN/EMA flight outcome every 30 min, so this fills up over the coming days (up to 60 days).</div>}</div>
    <div className="card plane"><h3>Where's My Plane?</h3><div className="muted">{ac?.type || lv?.type || f.aircraft?.model || "Aircraft not assigned yet"}{reg && ` • ${reg}`}</div>
      {ac?.photo ? <a href={ac.photo.link} target="_blank"><img src={ac.photo.src} className="acphoto" /><div className="faint sm">Photo © {ac.photo.credit} / planespotters.net</div></a> : <div className="acimg big">{I.plane}</div>}
      <div className="chain"><div className="ci on"><b>This Flight</b><span style={{ color: lateColor(dd) }}>{f.status === "departed" || f.status === "landed" ? `Departed ${lateLabel(dd)}` : lateLabel(dd) || "Scheduled"}</span></div>
        {inb?.flights?.filter((x: Flight) => x.number !== f.number).map((x: Flight) => <div key={x.id} className="ci"><b>{x.number} {x.origin?.iata} → {x.destination?.iata}</b><span style={{ color: lateColor(delay(x.arr)) }}>{x.statusText} {lateLabel(delay(x.arr))}</span></div>)}
        {inb?.needsKey && <div className="faint sm">Inbound aircraft chain needs a free AeroDataBox key (Settings). The aircraft registration is {reg}.</div>}
        {!reg && <div className="faint sm">The aircraft appears once it is assigned / broadcasting ADS-B (usually ~1h before departure).</div>}</div></div>
    {al && <div className="card"><div className="row g10"><Logo a={al} /><h3>{al.name}</h3></div><div className="grid2b mt8">
      <a className="gbtn" href={al.links?.phone ? "tel:" + al.links.phone : undefined}>PHONE</a><a className="gbtn" href={al.links?.web} target="_blank">WEBSITE</a><a className="gbtn" href={al.links?.x || `https://x.com/search?q=${encodeURIComponent(al.name)}`} target="_blank">X / TWITTER</a><a className="gbtn" href={al.links?.fb || `https://facebook.com/search/top?q=${encodeURIComponent(al.name)}`} target="_blank">FACEBOOK</a></div>
      <div className="grid3 mt8"><Stat label="ATC Callsign" v={al.callsign || "—"} /><Stat label="ICAO" v={al.icao || "—"} /><Stat label="IATA" v={al.iata} /></div></div>}
    <div className="card"><h3>My History on This Route</h3><div className="muted sm">{f.origin?.iata} → {f.destination?.iata}</div><div className="grid3 mt8"><Stat label="Flights" v={h.length} /><Stat label="Distance" v={`${(h.length * dist(f.origin, f.destination)).toLocaleString()} mi`} /><Stat label="Flight Time" v={dur(h.length * estDurMin(f.origin, f.destination))} /></div>
      {h.slice(0, 3).map((x: Flight) => <div key={x.id} className="row between mt8"><b>{fmtD(x.date)}</b><span className="muted">{x.number}{x.aircraft?.reg && ` • ${x.aircraft.reg}`}</span></div>)}</div>
    <div className="card"><h3>Updates</h3><div className="muted sm">{(f.updates || []).length} updates for this flight</div>{(f.updates || []).slice().reverse().map((u: any) => <div key={u.at} className="upd"><i />{u.text}<small>{new Date(u.at).toLocaleString("en-GB")}</small></div>)}</div>
    <div className="card"><h3>Notes</h3><textarea placeholder="Tap to Edit" defaultValue={f.notes} onBlur={e => tracked ? upd({ ...f, notes: e.target.value }) : null} /></div>
    <div className="card cal"><b className="row g8">{I.cal} Calendar Sync</b><div className="muted sm">Add this flight to your calendar (.ics works with Apple/Google Calendar)</div><button className="secondary mt8" onClick={() => download(`${f.number}.ics`, ics([f]))}>Add to Calendar</button></div>
    <a className="report" href={`mailto:?subject=Skyline data issue ${f.number} ${f.date}`}>ⓘ Report Data Issue</a>
    <div style={{ height: 100 }} />
    <div className="fbar"><div className="pill small"><button onClick={() => navigator.share ? navigator.share({ title: `${f.number} ${f.origin?.iata}→${f.destination?.iata}`, url: shareUrl() }) : (navigator.clipboard.writeText(shareUrl()), alert("Share link copied"))}>{I.share}</button>
      <button onClick={() => { const n = prompt("Diverted to (IATA), or leave blank"); if (n !== null) api("/airport/" + n).then(a => upd({ ...f, diverted: a })).catch(() => upd({ ...f, diverted: undefined })); }}>{I.edit}</button>
      <button onClick={() => { if (confirm("Remove this flight?")) { setFlights((l: Flight[]) => l.filter(x => x.id !== f.id)); close(); } }}>{I.more}</button></div>
      {!tracked ? <button className="primary" onClick={() => { setFlights((l: Flight[]) => [...l, f]); syncPush([...flights, f], true).catch(() => {}); }}>＋ Track Flight</button> : <button className="primary" onClick={() => push({ t: "board", iata: f.origin?.iata })}>{f.origin?.iata} Board</button>}</div>
  </div>;
}
function TimeBlock({ dir, a, t, d, badge, est }: any) {
  const shown = t.actual || t.estimated || t.scheduled; const changed = t.scheduled && shown && fmtT(shown, a?.tz) !== fmtT(t.scheduled, a?.tz);
  return <div className="tb"><div className="muted row g6">{dir === "dep" ? I.dep : I.arr}<b className="text">{a?.iata} • {a?.city || a?.name}</b> ›</div>
    <div className="row between"><div><div className="row g8 base"><span className="huge2" style={{ color: d != null ? lateColor(d) : undefined }}>{fmtT(shown, a?.tz)}</span>{changed && <s className="faint">{fmtT(t.scheduled, a?.tz)}</s>}</div>
      <small style={{ color: lateColor(d) }}>{lateLabel(d)}{est && <span className="faint"> • estimated from distance</span>}</small></div>{badge}</div></div>;
}

function BoardRow({ f, dir, onClick }: { f: any; dir: string; onClick: () => void }) {
  const t = dir === "dep" ? f.dep : f.arr; const a = dir === "dep" ? f.destination : f.origin; const d = delay(t); const tz = (dir === "dep" ? f.origin : f.destination)?.tz;
  const st = f.status === "cancelled" ? ["Cancelled", "var(--red)"] : f.status === "landed" ? ["Landed " + (t.actual ? fmtT(t.actual, tz) : ""), "var(--green)"] : f.status === "departed" ? ["Departed " + lateLabel(d), lateColor(d)] : [lateLabel(d) || f.statusText || "Scheduled", lateColor(d)];
  if (f.liveOnly) return <div className="brow press" onClick={onClick}><div className="bt"><span className="livedot" /><span className="faint sm">LIVE</span></div>
    <div className="grow"><b>{a?.city || a?.name || a?.iata || "Route unknown"}</b><div className="sm" style={{ color: f.status === "approaching" || f.status === "departed" ? "var(--blue)" : "var(--green)" }}>● {f.statusText}</div></div>
    <div className="right"><b>{f.number}</b><div className="faint sm">{f.aircraft?.type || ""} {f.live?.alt && f.live.alt !== "ground" ? `${Math.round(f.live.alt / 100) * 100}ft` : ""}</div></div></div>;
  return <div className="brow press" onClick={onClick}><div className="bt">{d != null && Math.abs(d) >= 5 ? <><s>{fmtT(t.scheduled, tz)}</s><b style={{ color: lateColor(d) }}>{fmtT(t.actual || t.estimated, tz)}</b></> : <b>{fmtT(t.scheduled, tz)}</b>}</div>
    <div className="grow"><b>{a?.city || a?.name || a?.iata}</b><div className="sm" style={{ color: st[1] }}>● {st[0]}{f.pred && f.pred.d >= 10 && f.status !== "cancelled" && <span className="aibadge sm" onClick={e => { e.stopPropagation(); (window as any).__why?.(f); }}> AI +{f.pred.d}m{f.pred.top ? ` · ${f.pred.top.icon}` : ""}</span>}</div></div>
    <div className="right"><b>{f.number.replace(/^([A-Z0-9]{2})/, "$1 ")}</b><div className="faint sm">{t.gate || ""}</div></div></div>;
}
function Board({ iata, x, push }: any) {
  const [info, setInfo] = useState(false); const [term, setTerm] = useState(false);
  const [dir, setDir] = useState("dep"); const [date, setDate] = useState(today()); const [d, setD] = useState<any>(null); const [airline, setAirline] = useState(""); const [q, setQ] = useState("");
  useEffect(() => { setD(null); api(`/board/${iata}?dir=${dir}&date=${date}`).then(setD).catch(e => setD({ error: e.message, needsKey: e.needsKey })); }, [iata, dir, date]);
  const ap = d?.airport; const [, tick] = useState(0); useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30e3); return () => clearInterval(t); }, []);
  const list = (d?.flights || []).filter((f: any) => (!airline || f.airline?.iata === airline) && (!q || JSON.stringify([f.number, f.destination?.city, f.origin?.city]).toLowerCase().includes(q.toLowerCase())))
    .sort((a: any, b: any) => a.liveOnly ? 0 : ((dir === "dep" ? a.dep : a.arr).scheduled < (dir === "dep" ? b.dep : b.arr).scheduled ? -1 : 1));
  const nowIdx = list.findIndex((f: any) => +new Date((dir === "dep" ? f.dep : f.arr).scheduled) > Date.now() - 30 * 60e3);
  useEffect(() => { if (nowIdx > 0 && date === today()) setTimeout(() => document.getElementById("brow-now")?.scrollIntoView({ block: "start" }), 50); }, [d]);
  const airlines = [...new Set((d?.flights || []).map((f: any) => f.airline?.iata))].filter(Boolean) as string[];
  return <><div className="head"><div><div className="row g6">{[iata, ap?.icao, new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ap?.tz || "Europe/London" }) + " " + (ap?.tz === "Europe/London" ? "GMT" : "local")].map(t => <span key={t} className="tag">{t}</span>)}</div><h1 className="h1s">{ap?.city || iata}</h1><div className="muted sm">{ap?.name?.toUpperCase()}, {ap?.country?.toUpperCase()}</div></div>{x}</div>
    <div className="chips"><div className="segs sm"><button className={!term ? "on" : ""}>List</button><button onClick={() => setTerm(true)}>Terminal</button></div><button className={"chip " + (info ? "blue" : "")} onClick={() => setInfo(v => !v)}>{info ? "Board" : "Airport info"}</button><button className="chip blue" onClick={() => navigator.share?.({ url: location.href, title: `${iata} board` })}>{I.share} Share</button>
      <select className="chip" value={date} onChange={e => setDate(e.target.value)}>{[-1, 0, 1, 2].map(o => { const v = new Date(Date.now() + o * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" }); return <option key={v} value={v}>{["Yesterday", "Today", "Tomorrow", fmtD(v)][o + 1]}</option>; })}</select>
      <select className="chip" value={dir} onChange={e => setDir(e.target.value)}><option value="dep">Departures</option><option value="arr">Arrivals</option></select>
      <select className="chip" value={airline} onChange={e => setAirline(e.target.value)}><option value="">Airline: All</option>{airlines.sort().map(a => <option key={a}>{a}</option>)}</select></div>
    {term && <TerminalBoard iata={iata} dir={dir} date={date} onClose={() => setTerm(false)} />}
    {info ? <AirportInfo iata={iata} /> : <>
    <div className="px"><input className="field" placeholder="Filter city or flight" value={q} onChange={e => setQ(e.target.value)} /></div>
    {!d && <div>{[0,1,2,3,4,5,6].map(i => <div key={i} className="sk-row"><div className="skel" style={{ width: 52 }} /><div className="grow"><div className="skel" style={{ width: (60 + (i * 37) % 30) + "%" }} /><div className="skel" style={{ width: "35%", height: 10, marginTop: 8 }} /></div><div className="skel" style={{ width: 54 }} /></div>)}</div>}
    {d && !d.error && d.sourceKind && d.sourceKind !== "live" && <div className="px"><span className={"srcb " + (d.sourceKind === "official" ? "off" : "")}>{d.sourceKind === "official" ? "OFFICIAL AIRPORT FEED" : "AERODATABOX"}</span> <span className="faint sm">{d.source}{d.site ? ` · ${d.site}` : ""} · real scheduled, estimated & actual times</span></div>}
    {d?.error && <div className="note warn">{d.needsKey ? `Free real-time boards are available for MAN, STN, EMA, FRA, SYD and 45 Norwegian (Avinor) airports. For ${iata}, add a free AeroDataBox key in Settings.` : d.error}</div>}
    {d?.liveOnly && <div className="note live-note"><b>Live traffic only</b> — derived from real ADS-B positions near {iata} (adsb.lol / adsb.fi) with adsbdb routes. No free official schedule feed exists for this airport, so no times or delays are shown (nothing is guessed). Optional: an AeroDataBox key in Settings adds schedules here.{date !== today() && " Live traffic is only available for today."}</div>}
    {d?.liveOnly && d.flights?.length === 0 && date === today() && <div className="empty"><div className="emo">📡</div><b>No aircraft moving right now</b><div className="muted sm">Nothing on the ground or climbing/descending within 30 nm in the last minute.</div></div>}
    {d?.flights && <div className="faint sm px">Source: {d.source} • AI badges are predictions</div>}
    <div className="board">{list.map((f: any, i: number) => <div key={f.id + i} id={i === nowIdx ? "brow-now" : undefined}><BoardRow f={f} dir={dir} onClick={() => push({ t: "flight", f: { ...f, date } })} /></div>)}</div></>}</>;
}

function Airports({ x, push, flights, initial }: any) {
  const [mode, setMode] = useState<"status" | "disruptions">(initial || "status");
  const seg = <div className="segs"><button className={mode === "status" ? "on" : ""} onClick={() => setMode("status")}>Status</button><button className={mode === "disruptions" ? "on" : ""} onClick={() => setMode("disruptions")}>Disruptions</button></div>;
  if (mode === "disruptions") return <Disruptions x={x} push={push} seg={seg} />;
  return <AirportStatus x={x} push={push} flights={flights} seg={seg} />;
}
const dsev = (v: number | null | undefined) => v == null ? -1 : v >= 3.5 ? 2 : v >= 2 ? 1 : 0;
function Disruptions({ x, push, seg }: any) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { const go = () => api("/disruptions").then(setD).catch(() => setD({ airports: [], noData: [] })); go(); const t = setInterval(go, 600e3); return () => clearInterval(t); }, []);
  const sc = (v: any, ic: ReactNode) => <div className={"dscore s" + dsev(v?.score)}><span className="faint">{ic}</span><b>{v?.score != null ? v.score.toFixed(1) : "–"}</b><i /></div>;
  const A = (d?.airports || []).slice(0, 10);
  return <><Head title="Airports" right={<>{x}</>} />{seg}
    <div className="px row g8"><h3 className="m0">Airport disruptions</h3><span className="live">LIVE</span></div>
    <div className="px muted sm mt8">See the top 10 airports with the most cancellations and longest delays.</div>
    {!d && <div>{[0,1,2,3,4,5,6].map(i => <div key={i} className="sk-row"><div className="skel" style={{ width: 52 }} /><div className="grow"><div className="skel" style={{ width: (60 + (i * 37) % 30) + "%" }} /><div className="skel" style={{ width: "35%", height: 10, marginTop: 8 }} /></div><div className="skel" style={{ width: 54 }} /></div>)}</div>}
    <div className="card dcard">{A.map((a: any) => <div key={a.airport.iata} className="drow" onClick={() => push({ t: "board", iata: a.airport.iata })}>
      <div className="grow"><div className="row g8"><b>{a.airport.city || a.airport.name}</b><span className="tag">{a.airport.iata}</span></div>
        {a.wx && <div className="row g10 sm muted mt8"><span>{wxIcon(a.wx.code)} {Math.round(a.wx.temp)}°C</span><span>{a.wx.windKts <= 3 ? "Variable " : <span className="warr" style={{ transform: `rotate(${(a.wx.windDir + 180) % 360}deg)` }}>↑</span>} {a.wx.windKts} kts</span></div>}</div>
      {sc(a.arr, I.land)}{sc(a.dep, I.takeoff)}</div>)}
      {d && !A.length && <div className="faint sm">No airports with enough live data right now.</div>}</div>
    <div className="card"><div className="lg"><span className="sdot2 s0" />0.0–1.9<span className="muted">Good traffic flow</span></div><div className="lg"><span className="sdot2 s1" />2.0–3.4<span className="muted">Minor problems with some delays or few cancellations</span></div><div className="lg"><span className="sdot2 s2" />3.5–5.0<span className="muted">Major problems with long delays and several cancelled flights</span></div></div>
    {d?.liveOnly?.length ? <div className="card mt16"><div className="row between"><b>Live traffic elsewhere</b><span className="srcb live">ADS-B</span></div><div className="faint sm">Real aircraft moving at {d.liveOnly.length} more hubs right now. No delay score without schedules (add AeroDataBox key).</div>
      {d.liveOnly.slice().sort((a: any, b: any) => (b.live.departing + b.live.arriving) - (a.live.departing + a.live.arriving)).slice(0, 15).map((r: any) => <div key={r.airport.iata} className="row between drow press" onClick={() => push({ t: "board", iata: r.airport.iata })}><div><b>{r.airport.city}</b> <span className="tag">{r.airport.iata}</span></div><div className="sm muted">↗ {r.live.departing} ↘ {r.live.arriving} • ⏸ {r.live.ground}</div></div>)}</div> : null}
    <div className="note">Skyline Disruption Index — our own score, not Flightradar24's. Arrivals and departures are scored separately from the last 4 hours of real flights: 5 × (45% cancellations, capped at 20% cancelled + 35% average delay, capped at 60m + 20% share over 30m late, capped at 50%). Weather: Open-Meteo. Refreshes every 10 min.
      {d?.noData?.length ? <> No delay data (live ADS-B traffic only) for {d.noData.length} airports: {d.noData.join(", ")}{!d.keys?.aerodatabox && " — add a free AeroDataBox key in Settings to score them"}.</> : null}</div></>;
}
function AirportStatus({ x, push, flights, seg }: any) {
  const [region, setRegion] = useState("All"); const [d, setD] = useState<any>(null); const [fav, setFav] = useState<string[]>(() => JSON.parse(localStorage.getItem("sk.fav") || "[]"));
  useEffect(() => { setD(null); api("/status?region=" + encodeURIComponent(region)).then(setD).catch(() => setD({ airports: [] })); }, [region]);
  useEffect(() => localStorage.setItem("sk.fav", JSON.stringify(fav)), [fav]);
  const sev = (a: any) => a.unavailable ? -1 : Math.max(a.dep?.avgDelay || 0, a.arr?.avgDelay || 0) >= 30 || Math.max(a.dep?.cancelled || 0, a.arr?.cancelled || 0) >= 10 ? 2 : Math.max(a.dep?.avgDelay || 0, a.arr?.avgDelay || 0) >= 15 || Math.max(a.dep?.cancelled || 0, a.arr?.cancelled || 0) >= 3 ? 1 : 0;
  const issues = (a: any) => [a.dep?.cancelled >= 3 || a.arr?.cancelled >= 3 ? "High Cancellations" : "", (a.dep?.avgDelay || 0) >= 30 ? "Long departure delays" : "", (a.arr?.avgDelay || 0) >= 30 ? "Long arrival delays" : ""].filter(Boolean).join(" • ");
  const mine = new Set(flights.filter((f: Flight) => !f.example).flatMap((f: Flight) => [f.origin?.iata, f.destination?.iata]));
  const row = (a: any) => { const s = sev(a); return <div key={a.airport.iata} className="arow" onClick={() => push({ t: "board", iata: a.airport.iata })}><div className={"sdot s" + s}><i /><span>{a.airport.iata}</span></div>
    <div className="grow"><div className="row between"><b>{a.airport.name.replace(/ (International )?Airport$/, "")}</b><button className="star" onClick={e => { e.stopPropagation(); setFav(v => v.includes(a.airport.iata) ? v.filter(y => y !== a.airport.iata) : [...v, a.airport.iata]); }}>{I.star(fav.includes(a.airport.iata))}</button></div>
      {issues(a) && <div className={"sm " + (s === 2 ? "red" : "orange")}>{issues(a)}</div>}
      {a.unavailable ? (a.live ? <div><span className="srcb live">LIVE TRAFFIC</span><div className="grid3 st"><div><label>ON GROUND</label><div>{a.live.ground}</div></div><div><label>CLIMBING OUT</label><div>↗ {a.live.departing}</div></div><div><label>APPROACHING</label><div>↘ {a.live.arriving}</div></div></div><div className="faint sm">Real ADS-B counts • delays need an AeroDataBox key</div></div> : <div className="faint sm">Live traffic loading… • delay stats need an AeroDataBox key</div>) : <div className="grid3 st"><div><label>ON TIME</label><div>↗ {a.dep?.onTime ?? "–"}%</div><div>↘ {a.arr?.onTime ?? "–"}%</div></div><div><label>AVG. DELAY</label><div>{a.dep?.avgDelay ?? "–"}m</div><div>{a.arr?.avgDelay ?? "–"}m</div></div><div><label>CANCELED</label><div>{a.dep?.cancelled ?? 0}%</div><div>{a.arr?.cancelled ?? 0}%</div></div></div>}</div></div>; };
  const A = d?.airports || []; const favs = A.filter((a: any) => fav.includes(a.airport.iata) || mine.has(a.airport.iata));
  return <><Head title="Airports" right={<><RoundBtn onClick={() => navigator.share?.({ title: "Airport delays", url: location.href })}>{I.share}</RoundBtn>{x}</>} />{seg}
    <div className="chips"><span className="chip plain">Now ⌄</span>{["All", "Europe", "North America", "Asia", "Oceania", "Africa", "South America"].map(r => <button key={r} className={"chip" + (region === r ? " on" : " plain")} onClick={() => setRegion(r)}>{r}</button>)}</div>
    <div className="px"><b>For You</b><div className="muted sm">Favorites and airports from your active flights</div>{!favs.length && <div className="faint">No Favorites – Tap ★ in an airport to favorite</div>}</div>{favs.map(row)}
    {!d && <div>{[0,1,2,3,4,5,6].map(i => <div key={i} className="sk-row"><div className="skel" style={{ width: 52 }} /><div className="grow"><div className="skel" style={{ width: (60 + (i * 37) % 30) + "%" }} /><div className="skel" style={{ width: "35%", height: 10, marginTop: 8 }} /></div><div className="skel" style={{ width: 54 }} /></div>)}</div>}
    {[[2, "Major Issues"], [1, "Minor Issues"], [0, "Normal Operations"], [-1, "No free live data"]].map(([s, l]) => { const L = A.filter((a: any) => sev(a) === s); return L.length ? <div key={l}><h4 className="px">{l}</h4>{L.map(row)}</div> : null; })}
    <div className="note">Stats cover the last 4 hours. MAN, STN, EMA, FRA, SYD and 45 Norwegian (Avinor) airports are computed live from official airport feeds. {d && !d.keys?.aerodatabox && "Add a free AeroDataBox key in Settings for worldwide airports."}</div></>;
}

function AddPast({ x, done }: any) {
  const [v, setV] = useState({ number: "", date: today(), from: "MAN", to: "", ac: "" });
  return <><Head title="Add Past Flight" right={x} /><div className="px col g8">{(["number", "date", "from", "to", "ac"] as const).map(k => <input key={k} className="field" type={k === "date" ? "date" : "text"} placeholder={{ number: "Flight number (LS1709)", date: "", from: "From IATA (MAN)", to: "To IATA (ATH)", ac: "Aircraft (optional, e.g. Boeing 737-800)" }[k]} value={v[k]} onChange={e => setV({ ...v, [k]: k === "ac" ? e.target.value : e.target.value.toUpperCase() })} />)}
    <button className="primary" onClick={async () => done(await manualFlight(v.number, v.date, v.from, v.to, v.ac))}>Add to Passport</button>
    <div className="note">CSV import columns: flight,date,from,to (e.g. LS1709,2026-09-20,MAN,ATH). .ics import reads flight numbers and IATA pairs from event titles.</div></div></>;
}

function PushControls() {
  const [st, setSt] = useState(pushState()); const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null); const [busy, setBusy] = useState(false); const [dbg, setDbg] = useState<any>(null);
  const flights = () => { try { return JSON.parse(localStorage.getItem("skyline.flights.v1") || "[]").filter((f: any) => !f.friend); } catch { return []; } };
  const run = (p: Promise<string>) => { setBusy(true); setMsg(null); p.then(t => setMsg({ t })).catch(e => setMsg({ t: e.message || String(e), err: true })).finally(() => { setBusy(false); setSt(pushState()); }); };
  const label: any = { subscribed: "✅ On", off: "Off", denied: "⛔ Blocked", "not-installed": "📲 Add to Home Screen first", unsupported: "Not supported", error: "Error" };
  return <><div className="sm mt8">Status: <b>{label[st.state]}</b>{st.state !== "subscribed" && st.state !== "off" ? <div className="muted sm">{st.msg}</div> : null}</div>
    <div className="row g8 mt8 wrap"><button className="primary" disabled={busy} onClick={() => run(syncPush(flights(), true).then(m => "Notifications " + m))}>{st.state === "subscribed" ? "Re-register alerts" : "Turn on alerts"}</button>
      <button className="secondary" disabled={busy || st.state !== "subscribed"} onClick={() => run(testPush())}>Send test</button>
      <button className="chip" onClick={() => pushStatus().then(setDbg).catch(e => setDbg({ error: e.message }))}>Diagnostics</button></div>
    <div className="mt8"><PushChecklist refresh={msg ? msg.t.length : 0} /></div>
    {msg && <div className={"pushmsg mt8 " + (msg.err ? "err" : "ok")}>{msg.err ? "Failed: " : ""}{msg.t}</div>}
    {dbg && <pre className="sm muted mt8" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" }}>{JSON.stringify(dbg.you ? { you: dbg.you, vapid: dbg.vapidSource, subs: dbg.subscriptions, log: dbg.log?.slice(0, 5) } : dbg, null, 1)}</pre>}</>;
}

function Settings({ x, theme, setTheme }: any) {
  const [s, setS] = useState<any>({}); const [k, setK] = useState(""); const [lk, setLk] = useState(""); const [lb, setLb] = useState(""); const [lm, setLm] = useState(""); const [tok, setTok] = useState(""); const [msg, setMsg] = useState("");
  const load = () => api("/settings").then(r => { setS(r); setLb(r.llmBase); setLm(r.llmModel); }); useEffect(() => { load(); }, []);
  const saveK = (body: any) => api("/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, adminToken: tok, newAdminToken: tok }) }).then(() => { setMsg("Saved ✓"); load(); }).catch(e => setMsg(e.message));
  return <><Head title="Settings" right={x} /><div className="px col g8">
    <div className="card m0 row between"><span className="sm">App version</span><b className="sm">{BUILD}</b></div><UnitsCard /><AlertPrefsCard onChange={() => syncPush(JSON.parse(localStorage.getItem("skyline.flights.v1") || "[]").filter((f: any) => !f.friend)).catch(() => {})} />
    <div className="card m0"><h3>Appearance</h3><div className="segs m0">{["auto", "light", "dark"].map(t => <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t}</button>)}</div></div>
    <div className="card m0"><h3>Push notifications</h3><div className="muted sm">Gate & terminal changes, delays, cancellations, belt numbers — even when Skyline is closed. The server checks your tracked flights every 4 minutes. iPhone: open Skyline from its Home Screen icon (iOS 16.4+).</div>
      <PushControls /></div>
    <div className="card m0"><h3>Your data</h3><div className="muted sm">Your flights, friends and settings are saved on this iPhone and survive server restarts. Make a backup file to move them to another device.</div>
      <div className="row g8 mt8 wrap"><button className="secondary" onClick={() => exportBackup()}>⇩ Back up</button><label className="secondary">⇪ Restore<input hidden type="file" accept=".json,application/json" onChange={e => e.target.files?.[0] && importBackup(e.target.files[0]).catch(er => setMsg(er.message))} /></label></div>
      <input className="field mt8" placeholder="Your name (shown on flights you share)" defaultValue={localStorage.getItem("sk.name") || ""} onBlur={e => localStorage.setItem("sk.name", e.target.value.trim())} /></div>
    <div className="card m0"><h3>AeroDataBox key (optional)</h3><div className="muted sm"><b>You don’t need this.</b> Real schedules already work free, with no key, at MAN, STN, EMA, FRA, SYD and 45 Norwegian (Avinor) airports. Every other airport shows real live ADS-B traffic. If you want schedules everywhere: Free “Basic” plan at rapidapi.com/aedbx-aedbx/api/aerodatabox → Subscribe → copy X-RapidAPI-Key. Enables boards & flight search at any airport, aircraft registration, inbound-plane chain and global airport delay stats. Status: <b>{s.aerodatabox || "not set"}</b></div>
      <input className="field mt8" placeholder="Paste RapidAPI key" value={k} onChange={e => setK(e.target.value)} /><button className="primary mt8" onClick={() => saveK({ aerodataboxKey: k })}>Save key</button></div>
    <div className="card m0"><h3>LLM explanations (optional)</h3><div className="muted sm">Any OpenAI-compatible API (default xAI: console.x.ai). Used only to word the AI-prediction explanation. Status: <b>{s.llm || "not set"}</b></div>
      <input className="field mt8" placeholder="API key" value={lk} onChange={e => setLk(e.target.value)} /><input className="field mt8" placeholder="Base URL" value={lb} onChange={e => setLb(e.target.value)} /><input className="field mt8" placeholder="Model" value={lm} onChange={e => setLm(e.target.value)} />
      <button className="primary mt8" onClick={() => saveK({ llmKey: lk, llmBase: lb, llmModel: lm })}>Save</button></div>
    <div className="card m0"><h3>Admin token</h3><div className="muted sm">{s.protected ? "Keys are protected — enter your admin token to change them." : "Set a token so nobody else with the URL can change your keys (saved with your next key save)."}</div><input className="field mt8" type="password" placeholder="Admin token" value={tok} onChange={e => setTok(e.target.value)} /></div>
    {msg && <div className="note">{msg}</div>}
    <div className="note">Data: MAN/STN/EMA official flight info • adsb.lol / adsb.fi (ADS-B live positions) • adsbdb (routes) • hexdb.io (aircraft) • planespotters.net (photos) • Open-Meteo (weather) • RainViewer (radar) • OpenFlights (airports/airlines) • Esri / CARTO / OSM (maps). Skyline is an independent app, not affiliated with Flighty.</div></div></>;
}
