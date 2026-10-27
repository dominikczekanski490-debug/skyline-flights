import { AircraftCard, WhatsNew22, HomeWidgets, Overhead22, Wrapped22, Connections22 } from "./v22";
import "./v22.css";
import "./v24.css";
import "./v25.css";
import { AirportPulse } from "./v24";
import { PredictCard, FindMyPlane } from "./predict";
import { Livery, PLANE_CREDITS, useFlightPhoto, photoLabel } from "./livery";
import { usePoll, Refreshed, TRACK_MS, markTracked, LiveLine } from "./refresh";
import { Labs, LABS, Ic, SecHead, ActBtn } from "./v25";
import "./v26.css";
import { ToolsHub, FeatureList, TOOLS, BOARD_FEATURES } from "./tools";
import { TerminalBoard, status as boardStatus } from "./terminal";
import { mark, toast, Boundary } from "./guard";
import { PlaneFrom, useAircraft } from "./inbound";
import { Alternatives, FlightStory, PassCard, JetLag } from "./v20";
import { AssistantFeed, TodayCard, NLSearch, CompCard, shareImage, exportIcs as icsOf, AirportGuide } from "./assist";
import { NextHero, PlaneHere, Facts, GlobalSearch, DayOf, phaseOf } from "./big";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import MapView, { MAP_STYLES } from "./MapView";
import { Sheet, RoundBtn, I, Badge } from "./ui";
import { api, today, dist, fmtT, fmtD, best, delay, dur, lateLabel, lateColor, withEstArr, load, save, ics, download, wxIcon, tzOffset, estDurMin, type Flight, type Ap } from "./lib";
import { liveOf, statusOf } from "./lib";
import { AirlineTile } from "./brand";
import { EtaLine } from "./eta";
import { Tracked, isTracked, finishStale } from "./tracked";
import { EXAMPLE } from "./example";
import { Timeline, Progress, WeatherCard, AirportInfo, PassportMore, PasteImport, exportIcs, UnitsCard, AlertPrefsCard } from "./more";
import { AskSkyline, LockView, RouteWeather, useInsights } from "./v21";
import { FactorViz, WarmBanner, syncPush, testPush, pushState, pushStatus, exportBackup, importBackup, shareLink, parseShare, LeaveCard, PassportExtras, DepartureDay, UpdateBanner, PushChecklist, BUILD, localNotify } from "./extras";

type Ov = { t: "ask" } | { t: "lock" } | { t: "flight"; f: Flight } | { t: "board"; iata: string; term?: boolean; dir?: string } | { t: "airports"; mode?: string } | { t: "search" } | { t: "settings" } | { t: "addpast" } | { t: "paste" } | { t: "tools"; id?: string } | { t: "features" } | { t: "labs"; id?: string; apt?: string; f?: Flight } | { t: "dayof"; f: Flight } | { t: "guide"; iata: string } | { t: "overhead" } | { t: "wrapped" } | { t: "conn" };
const Logo = ({ a, s = 34 }: { a?: any; s?: number }) => <AirlineTile a={a} className="card-tile" mode="colour" style={{ width: Math.round(s * 2.4), height: s }} />;

export default function App() {
  const [tab, setTab] = useState<"mine" | "friends" | "tracked" | "passport">("mine");
  const [flights, setFlights] = useState<Flight[]>(() => load().map(finishStale));
  const [ov, setOv] = useState<Ov[]>([]);
  const [live, setLive] = useState<Record<string, any>>({});
  const [mapStyle, setMapStyle] = useState(localStorage.getItem("sk.map2") || "dark");
  const [radar, setRadar] = useState(false); const [locate, setLocate] = useState(0);
  useEffect(() => { const tb = location.hash.match(/tab=(mine|friends|tracked|passport)/); if (tb) setTab(tb[1] as any); const v = location.hash.match(/ov=(overhead|wrapped|conn|ask|settings|search)/); if (v) setOv([{ t: v[1] } as Ov]); const lb = location.hash.match(/labs=?(\w*)/); if (lb) setOv([{ t: "labs", id: lb[1] || undefined }]); const fm = location.hash.match(/flight=([\w-]+)/); if (fm) { const f = load().find(x => x.id === fm[1]); if (f) setOv([{ t: "flight", f }]); } }, []);
  useEffect(() => { const m = location.hash.match(/board=([A-Za-z]{3})/); if (m) setOv([{ t: "board", iata: m[1].toUpperCase() }]); const a = location.hash.match(/airports=(\w+)/); if (a) setOv([{ t: "airports", mode: a[1] }]); }, []);
  const [why, setWhy] = useState<any>(null); (window as any).__why = (f: any) => { navigator.vibrate?.(8); setWhy(f); };
  const [theme, setTheme] = useState(localStorage.getItem("sk.theme") || "dark");
  useEffect(() => save(flights), [flights]);
  useEffect(() => { navigator.storage?.persist?.(); if (new URLSearchParams(location.search).get("tab") === "friends") { setTab("friends"); history.replaceState(null, "", "/"); } }, []);
  useEffect(() => { const f = () => document.visibilityState === "visible" && syncPush(flights.filter(x => !x.friend)).catch(e => console.warn("push resync", e)); const t = setTimeout(f, 1500); const iv = setInterval(f, 10 * 60e3); document.addEventListener("visibilitychange", f); return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener("visibilitychange", f); }; }, [flights.filter(f => !f.friend).map(f => f.id).join()]);
  useEffect(() => { localStorage.setItem("sk.theme", theme); const mq = matchMedia("(prefers-color-scheme: light)");
    const apply = () => { const r = theme === "auto" ? (mq.matches ? "light" : "dark") : theme; document.documentElement.dataset.theme = r; document.documentElement.dataset.themePref = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", r === "light" ? "#f4f6fb" : "#0b1020"); };
    apply(); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }, [theme]);
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
    let batch: any = {}; try { batch = (await api(`/flights?ids=${now.map(f => `${f.number}@${f.date}`).join(",")}`)).flights || {}; } catch (e) { console.warn("batch", e); }
    for (const f of now) { try { const r = batch[`${f.number}@${f.date}`]; if (!r || r.error) continue; setLive(l => ({ ...l, [f.id]: r.live || null }));
      if (r.flight && !f.manual) { const keep = (a: any = {}, b: any = {}) => { const o = { ...a }; for (const k in b) if (b[k] != null && b[k] !== "") o[k] = b[k]; return o; };
        const n: Flight = { ...f, ...r.flight, dep: keep(f.dep, r.flight.dep), arr: keep(f.arr, r.flight.arr), id: f.id, date: f.date, notes: f.notes, friend: f.friend, checkedAt: Date.now(), live: r.live ? { ...r.live, at: Date.now() } : null, aircraft: { ...f.aircraft, ...r.flight.aircraft, ...(r.live ? { reg: r.live.reg, hex: r.live.hex, model: r.live.type } : {}) } } as any;
        const msg: string[] = []; if (n.statusText !== f.statusText && n.statusText) msg.push(n.statusText!); if (n.dep.gate !== f.dep.gate && n.dep.gate) msg.push(`Gate ${n.dep.gate}`);
        if (msg.length) { n.updates = [...(f.updates || []), { at: Date.now(), text: msg.join(" · ") }]; localNotify(`${n.number} ${n.origin?.iata}→${n.destination?.iata}`, msg.join(" · "), n.id); }
        upd(finishStale(n)); } } catch (e) { console.warn("refresh", f.number, e); } }
    markTracked(); busy = false; };
    tick(); const t = setInterval(tick, TRACK_MS); const v = () => document.visibilityState === "visible" && tick(); document.addEventListener("visibilitychange", v); window.addEventListener("focus", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); window.removeEventListener("focus", v); }; }, [active.map(f => f.id).join()]);
  const top = ov.at(-1); const focus = top?.t === "flight" ? top.f : null;
  const mapFlights = focus ? [focus] : tab === "passport" ? flights.filter(f => !f.friend) : tab === "friends" ? flights.filter(f => f.friend) : active.filter(f => !f.friend);
  return <div className="app"><WarmBanner /><UpdateBanner />{why && <WhySheet f={why} close={() => setWhy(null)} />}
    <MapView flights={mapFlights} live={live} style={mapStyle} radar={radar} focus={focus} locate={locate} onPlane={id => { const f = flights.find(x => x.id === id); f && push({ t: "flight", f }); }} />
    <div className="maptint" /><div className="aurora" />
    <div className="mapbtns"><button onClick={() => setMapStyle(MAP_STYLES[(MAP_STYLES.indexOf(mapStyle) + 1) % MAP_STYLES.length])}>{I.layers}</button><button className={radar ? "on" : ""} onClick={() => setRadar(!radar)}>{I.cloud}</button><button onClick={() => setLocate(Date.now())}>{I.locate}</button></div>
    <Sheet snaps={[0.3, 0.55, 0.94]} initial={1} z={5}>
      {tab === "tracked" && <Tracked flights={flights.filter(f => !f.friend)} setFlights={setFlights} open={f => push({ t: "flight", f })} />}
      {tab === "mine" && <MyFlights list={active.filter(f => !f.friend && !isTracked(f))} open={f => push({ t: "flight", f })} push={push} />}
      {tab === "friends" && <Friends list={flights.filter(f => f.friend)} open={f => push({ t: "flight", f })} push={push} />}
      {tab === "passport" && <Passport flights={flights.filter(f => !f.friend)} setFlights={setFlights} open={f => push({ t: "flight", f })} push={push} />}
      <div style={{ height: 120 }} />
    </Sheet>
    <WhatsNew22 />
    {!ov.length && <nav className="tabbar"><div className="pill"><i className="tabind" style={{ transform: `translateX(${["mine","friends","tracked","passport"].indexOf(tab) * 100}%)` }} />
      {([["mine", "My Flights", I.plane], ["friends", "Friends", I.friends], ["tracked", "Tracked", I.clock], ["passport", "Passport", I.passport]] as const).map(([k, l, ic]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{ic}<span>{l}</span></button>)}
    </div><button className="searchbtn" onClick={() => push({ t: "search" })}>{I.search}</button></nav>}
    {ov.map((o, i) => <Boundary key={i + o.t} label="screen"><Overlay o={o} z={20 + i} close={pop} push={push} flights={flights} setFlights={setFlights} upd={upd} live={live} theme={theme} setTheme={setTheme} tab={tab} /></Boundary>)}
  </div>;
}

function Head({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) { return <div className="head"><div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div><div className="row g8">{right}</div></div>; }
const Avatar = ({ onClick }: { onClick?: () => void }) => <button className="avatar" onClick={onClick}>D</button>;

function Thumb({ f, type }: { f: Flight; type?: string }) {
  const p = useFlightPhoto(type ? { ...f, aircraft: { ...f.aircraft, model: type } } : f); if (!p?.src) return null;
  const cr = p.source === "Planespotters.net" ? `© ${p.author} / Planespotters.net` : `${p.author} / Wikimedia Commons, ${p.license}`;
  return <div className="fthumb"><img src={p.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /><span>{photoLabel(p, f.airline?.name || "")} · {cr}</span></div>;
}
function Greeting() { const n = (localStorage.getItem("sk.name") || "").trim().split(/\s+/)[0]; const h = +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date());
  const g = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return <div className="greet px"><span>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" })}</span><b>{g}{n ? `, ${n}` : ""}</b></div>; }
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
    {!f.example && <EtaLine f={f} live={lv} compact />}
    {!f.example && <Thumb f={f} type={lv?.type} />}
    {p && <PredictCard compact f={f} p={p} onWhy={() => (window as any).__why?.(f)} />}
    {pred && !f.example && !f.friend && until != null && until > -30 && until < 18 * 60 && <PlaneFrom f={f} compact />}
  </div>;
}

function MyFlights({ list, open, push }: { list: Flight[]; open: (f: Flight) => void; push: (o: Ov) => void }) {
  useInsights(list);
  return <>
    <Head title="My Flights" right={<><RoundBtn onClick={() => push({ t: "airports" })}>{I.share}</RoundBtn><Avatar onClick={() => push({ t: "settings" })} /></>} />
    <Greeting />
    <GlobalSearch push={push} onFlight={f => push({ t: "flight", f })} />
    {(() => { const nx = list.filter(f => !f.example && phaseOf(f) !== "cancelled" && !(f.status === "landed" && Date.now() - +new Date(f.arr.actual || f.arr.scheduled || 0) > 3 * 3600e3)).sort((a, b) => (best(a.dep) || a.date) < (best(b.dep) || b.date) ? -1 : 1)[0];
      return nx ? <><NextHero f={nx} open={() => open(nx)} dayof={() => push({ t: "dayof", f: nx })} /><div className="px pf-hero"><PlaneFrom f={nx} compact /></div></> : null; })()}
    <div className="px"><HomeWidgets flights={list} push={push} /><AirportPulse push={push} /></div>
    <TodayCard flights={list} />
    <AssistantFeed flights={list} push={push} />
    <NLSearch open={f => push({ t: "flight", f })} />
    <div className="qa">{([[I.alert, "Disruptions", "Live delay scores", () => push({ t: "airports", mode: "disruptions" }), "r"], [I.grid, "Tools", `${TOOLS.length} aviation tools`, () => push({ t: "tools" }), "b"], [I.spark, "Skyline Labs", `${LABS.length} insights & utilities`, () => push({ t: "labs" }), "v"], [I.globe, "UK & Ireland", "Every airport board", () => push({ t: "airports", mode: "uk" }), "b"], [I.takeoff, "MAN board", "Departures now", () => push({ t: "board", iata: "MAN" }), "g"], [I.sliders, "Settings", "Keys & theme", () => push({ t: "settings" }), "v"]] as const).map(([ic, t, s, fn, c]) => <button key={t} className={"qtile press q" + c} onClick={fn}><span className="qic">{ic}</span><b>{t}</b><small>{s}</small></button>)}</div>
    {!list.length ? <div className="empty16 rise"><div className="e-ic">{I.plane}</div><b>Your next trip starts here</b><span>Search a flight number like BA1387 or a route to start tracking it live.</span>
      <button className="primary mt16" onClick={() => push({ t: "search" })}>{I.search} Add a flight</button>
      <div className="row g8 mt12 wrap center"><button className="chip" onClick={() => push({ t: "board", iata: "MAN" })}>Manchester board</button><button className="chip" onClick={() => push({ t: "airports" })}>Airport delays</button></div></div>
      : <>{(() => { const srt = [...list].sort((a, b) => (best(a.dep) || a.date) < (best(b.dep) || b.date) ? -1 : 1);
        const past = (f: Flight) => f.status === "landed" || f.status === "cancelled" || (f.date < today() && !["departed", "enroute"].includes(f.status || ""));
        const up = srt.filter(f => !past(f)), pa = srt.filter(past).reverse(); void pa;
        return <><LiveLine />{up.length > 0 && <div className="sect">Upcoming</div>}{up.map(f => <FlightCard key={f.id} f={f} onClick={() => open(f)} pred />)}
          <div className="sect muted">Landed and past flights move to the Tracked tab.</div></>; })()}</>}
  </>;
}

function Friends({ list, open, push }: { list: Flight[]; open: (f: Flight) => void; push: (o: Ov) => void }) {
  return <><Head title="Friends" right={<Avatar onClick={() => push({ t: "settings" })} />} />
    <div className="sub px" style={{ marginTop: -6 }}>Live flights shared with you</div>
    {!list.length && <div className="sk-empty"><div className="sk-empty-art"><span>{Ic.people}</span><i>{Ic.plane}</i></div><b>Follow friends' flights</b><span>Open any flight and tap Share to send a link. When a friend opens your link, or you open theirs, the flight appears here and updates live.</span></div>}
    {list.length > 0 && <SecHead ic={Ic.people} title="Following" sub={`${list.length} flight${list.length > 1 ? "s" : ""} · updates live`} />}
    {list.map(f => <FlightCard key={f.id} f={f} onClick={() => open(f)} pred />)}
    <div className="sk-acts two"><ActBtn ic={Ic.plus} tone="pri" onClick={() => push({ t: "search" })}>Add friend's flight</ActBtn>
      <ActBtn ic={Ic.link} onClick={() => { const u = prompt("Paste a Skyline share link"); const s = u && parseShare(u); if (s) location.href = u!.slice(u!.indexOf("/s/")); else if (u) alert("That isn't a Skyline share link"); }}>Follow a share link</ActBtn></div><div style={{ height: 150 }} /></>;
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
    <div className="pcard passport"><div className="row between"><div><div className="ptitle">{yr === "All" ? "ALL-TIME" : yr} SKYLINE PASSPORT</div><div className="psub">PASSPORT · PASS · PASAPORTE</div></div><span className="pp-emb">{Ic.globe}</span></div>
      <div className="grid2"><div><label>FLIGHTS</label><b className="h1">{L.length}</b><small>{s.lh} Long Haul</small></div><div><label>DISTANCE</label><b className="h1">{s.mi.toLocaleString()} mi</b><small>{(s.mi / 24901).toFixed(1)}x around the world</small></div></div>
      <div className="grid3"><div><label>FLIGHT TIME</label><b className="h2">{dur(s.min)}</b></div><div><label>AIRPORTS</label><b className="h2">{s.ap}</b></div><div><label>AIRLINES</label><b className="h2">{s.al}</b></div></div>
    </div>
    <div className="pcard delays"><div className="row between"><b className="huge">{Math.round(s.lost / 60)}</b><span className="pp-emb">{Ic.clock}</span></div><div className="h3">hours lost from delays</div><small>Delayed flights averaged {s.nl ? dur(s.lost / s.nl) : "0m"} late</small></div>
    <div className="pcard aircraft"><div className="h3">Most flown aircraft</div><b className="h1 thin">{s.top?.[0] || "—"}</b><small>{s.top?.[1] || 0} flights</small><div className="acimg">{Ic.plane}</div></div>
    <PassportExtras L={L} yr={yr} />
    <PassportMore L={L} />
    <SecHead ic={Ic.ticket} title="Build your logbook" sub="Add history, import or export" />
    <div className="sk-acts"><ActBtn ic={Ic.plus} tone="pri" onClick={() => push({ t: "addpast" })}>Past flight</ActBtn><ActBtn ic={Ic.doc} onClick={() => push({ t: "paste" })}>Paste email</ActBtn><label className="sk-act press"><span>{Ic.upload}</span><b>Import</b><input hidden type="file" accept=".csv,.ics" onChange={imp} /></label><ActBtn ic={Ic.cal} onClick={() => exportIcs(flights.filter((f: Flight) => !f.friend && !f.example))}>Export .ics</ActBtn></div>
    {!flights.length && <div className="px mt8"><button className="chip" onClick={() => setFlights(EXAMPLE)}>Load example data</button></div>}
    <div className="sorts">{["Date", "From", "To", "Airline", "Aircraft"].map(k => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{k}{sort === k && <i className="sk-sort">{Ic.chev}</i>}</button>)}</div>
    {Object.entries(groups).map(([g, l]) => <div key={g}><SecHead ic={Ic.cal} title={g} sub={`${l.length} flight${l.length > 1 ? "s" : ""}`} />
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
  if (o.t === "board") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Board iata={o.iata} x={x} push={p.push} term0={o.term} /></Sheet>;
  if (o.t === "airports") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Airports x={x} push={p.push} flights={p.flights} initial={o.mode} /></Sheet>;
  if (o.t === "tools") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Head title="Tools" right={x} /><div className="px"><ToolsHub open={o.id} /></div></Sheet>;
  if (o.t === "ask") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><AskSkyline flights={p.flights} x={x} /></Sheet>;
  if (o.t === "lock") return <Sheet z={z} onClose={close} snaps={[0.97]} initial={0}><LockView flights={p.flights} x={x} /></Sheet>;
  if (o.t === "overhead") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Overhead22 x={x} /></Sheet>;
  if (o.t === "wrapped") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Wrapped22 x={x} /></Sheet>;
  if (o.t === "conn") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Connections22 flights={p.flights} x={x} /></Sheet>;
  if (o.t === "guide") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><AirportGuide iata={o.iata} x={x} /></Sheet>;
  if (o.t === "dayof") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><DayOf f={p.flights.find(f => f.id === o.f.id) || o.f} push={p.push} x={x} /></Sheet>;
  if (o.t === "labs") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Head title="Labs" right={x} /><div className="px"><Labs id={o.id} apt={o.apt} f={o.f} open={f => p.push({ t: "flight", f })} /></div></Sheet>;
  if (o.t === "features") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Head title="What's new" right={x} /><div className="px"><FeatureList /></div></Sheet>;
  if (o.t === "paste") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Head title="Import booking" right={x} /><PasteImport add={(fl: Flight[]) => { p.setFlights((l: Flight[]) => [...l, ...fl.filter(n => !l.some(y => y.id === n.id))]); close(); }} /></Sheet>;
  if (o.t === "addpast") return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><AddPast x={x} done={(f: Flight) => { p.setFlights((l: Flight[]) => [...l, f]); close(); }} /></Sheet>;
  return <Sheet z={z} onClose={close} snaps={[0.94]} initial={0}><Settings x={x} theme={p.theme} setTheme={p.setTheme}  push={p.push} /></Sheet>;
}

function SearchView({ x, push, setFlights, close }: any) {
  const [q, setQ] = useState(""); const [date, setDate] = useState(today()); const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [aps, setAps] = useState<Ap[]>([]);
  const [mode, setMode] = useState<"flight" | "route" | "airport">("flight"); const [to, setTo] = useState("");
  useEffect(() => { if (mode !== "flight" && q.length >= 2) api("/airports/search?q=" + q).then(setAps).catch(() => {}); else setAps([]); }, [q, mode]);
  const go = async () => { setBusy(true); setRes(null); try { if (mode === "flight") setRes(await api(`/flight/${q.replace(/\s/g, "")}?date=${date}`)); else if (mode === "route") setRes({ list: (await api(`/route?from=${q}&to=${to}&date=${date}`)).flights }); } catch (e: any) { setRes({ error: e.message, needsKey: e.needsKey }); } setBusy(false); };
  const add = (f: Flight, friend?: boolean) => { const n = { ...f, id: f.id || `${f.number}-${date}`, date }; mark("add " + n.number); const up = (l: Flight[]) => [...l.filter(y => !(y.id === n.id && !!y.friend === !!friend)), friend ? { ...n, friend: "Friend" } : n];
    try { save(up(load())); } catch { /* quota */ } setFlights(up); close(); toast(`${n.number} added to ${friend ? "Friends" : "My Flights"}`, 2500); };
  return <><Head title="Add a flight" sub="Track live by number, route or airport" right={x} />
    <div className="sk-seg">{(["flight", "route", "airport"] as const).map(m => <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setRes(null); }}>{m === "flight" ? Ic.ticket : m === "route" ? Ic.route : Ic.tower}<span>{m === "flight" ? "Flight no." : m === "route" ? "Route" : "Airport"}</span></button>)}</div>
    <div className="px col g8"><label className="sk-field"><span>{Ic.search}</span><input autoFocus placeholder={mode === "flight" ? "e.g. LS965, FR2141, BA1393" : "From airport (e.g. MAN)"} value={q} onChange={e => setQ(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && go()} /></label>
      {mode === "route" && <label className="sk-field"><span>{Ic.pin}</span><input placeholder="To airport (optional, e.g. LCA)" value={to} onChange={e => setTo(e.target.value.toUpperCase())} /></label>}
      {mode !== "airport" && <><div className="row g8"><label className="sk-field grow"><span>{Ic.cal}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><button className="sk-go press" onClick={go}>{busy ? <i className="sk-spin" /> : Ic.search}<span>{busy ? "Searching" : "Search"}</span></button></div>
      <div className="lab-chips">{[0, 1].map(o => { const v = new Date(Date.now() + o * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" }); return <button key={o} className={date === v ? "on" : ""} onClick={() => setDate(v)}>{o ? "Tomorrow" : "Today"}</button>; })}</div></>}</div>
    {mode !== "flight" && aps.length > 0 && <div className="mt8">{aps.map(a => <div key={a.iata} className="lrow" onClick={() => mode === "airport" ? push({ t: "board", iata: a.iata }) : (setQ(a.iata), setAps([]))}><span className="code">{a.iata}</span><div><b>{a.name}</b><div className="muted sm">{a.city}, {a.country}</div></div></div>)}</div>}
    {res?.error && <div className="note warn">{res.error}{res.needsKey && " — this airport needs a free AeroDataBox key (Settings)."}</div>}
    {res?.flight && <div className="mt8"><FlightCard f={{ ...res.flight, date }} onClick={() => push({ t: "flight", f: { ...res.flight, date } })} />
      <div className="muted sm px">Sources: {res.sources.join(", ")}{res.flight.scheduleUnknown && " — schedule times need an AeroDataBox key for this airport"}</div>
      <div className="row g8 px mt8"><button className="sk-go press grow" onClick={() => add(res.flight)}>{Ic.plus}<span>Track flight</span></button><button className="sk-go ghost press grow" onClick={() => add(res.flight, true)}>{Ic.people}<span>Friend's flight</span></button></div></div>}
    {res && !res.flight && !res.list && !res.error && <div className="note">No schedule found for {q} on {date}. Free schedule data covers flights at MAN, STN, EMA, FRA, SYD and 45 Norwegian (Avinor) airports; add a free AeroDataBox key in Settings for worldwide coverage.</div>}
    {res?.list && <div className="mt8">{res.list.map((f: Flight) => <BoardRow key={f.id} f={f} dir="dep" onClick={() => push({ t: "flight", f: { ...f, date } })} />)}{!res.list.length && <div className="note">No flights found.</div>}</div>}
    <div className="sk-foot mt16">{Ic.info}<span>Free real-time schedules, gates & delays come straight from Manchester, Stansted and East Midlands airports. Live positions come from ADS-B (adsb.lol).</span></div>
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
  return <><PredictCard f={f} p={p} /><div className="pcard" style={{ ["--pc" as any]: c }}>
    <div className="phead"><span className="ptitle">✦ Delay Forecast</span><span className={"pconf " + p.confidence}><i />{p.confidence[0].toUpperCase() + p.confidence.slice(1)} confidence</span></div>
    <div className="phero"><Gauge d={d} /><div className="pfig"><div className="pnum" style={{ color: c }}>{p.cancelled ? "Cancelled" : d >= 5 ? <>+<CountUp v={d} /><small>min</small></> : "On time"}</div>{p.range && !p.cancelled && <div className="prng">Likely {p.range[0] < 0 ? p.range[0] : "+" + p.range[0]} to +{p.range[1]} min</div>}</div></div>
    {p.summary && <div className="psum2">{p.summary}</div>}
    <div className="pglass"><div className="plab">Chances</div>{bars.map(([l, sub, v, col]: any, i) => <div key={l} className="pbar"><span>{l}{sub && <em> {sub}</em>}</span><div><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(v, v > 0 ? 1.5 : 0)}%` }} transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }} style={{ background: `linear-gradient(90deg, ${col}aa, ${col})` }} /></div><b>{v}%</b></div>)}</div>
    <Factors list={p.factors || []} />
    {p.confidenceNote && <div className="pnote">ⓘ {p.confidenceNote}</div>}
    <div className="pexp">{p.explanation?.text}<div className="pby">{p.explanation?.by === "llm" ? "Written by your LLM from the model's real inputs" : "Template summary · add an LLM key in Settings for AI-written text"} · Estimate, not observed data</div></div></div></>;
}

function FlightDetail({ f, upd, setFlights, flights, close, push, live }: any) {
  const g = withEstArr(f); const dd = delay(f.dep), da = delay(g.arr); const lv = live[f.id] || liveOf(f);
  const [wx, setWx] = useState<any[]>([]); const [ac, setAc] = useState<any>(null); const [fc, setFc] = useState<any>(null); const [inb, setInb] = useState<any>(null); const [al, setAl] = useState<any>(f.airline);
  useEffect(() => { Promise.all([f.origin, f.destination].map((a: Ap) => a?.lat ? api(`/weather?lat=${a.lat}&lon=${a.lon}`).catch(() => null) : null)).then(setWx);
    if (!f.example) api(`/forecast/${f.number}`).then(setFc).catch(() => {}); if (f.airline?.iata && !f.airline.links) api("/airline/" + f.airline.iata).then(setAl).catch(() => {}); }, [f.id]);
  const rs = useAircraft(f); const hex = lv?.hex || f.aircraft?.hex || rs?.live?.hex, reg = lv?.reg || f.aircraft?.reg || rs?.reg || undefined;
  useEffect(() => { if (hex || reg) api(`/aircraft?hex=${hex || ""}&reg=${reg || ""}`).then(setAc).catch(() => {}); if (reg) api(`/inbound?reg=${reg}&date=${f.date}`).then(setInb).catch(e => setInb({ err: e.message, needsKey: e.needsKey })); }, [hex, reg]);
  const tracked = flights.some((x: Flight) => x.id === f.id);
  const [fresh, setFresh] = useState<any>(null);
  const fpoll = usePoll(() => f.example || f.manual ? undefined : api(`/flight/${f.number}?date=${f.date}`).then(r => r.flight && setFresh(r.flight)).catch(() => {}), [f.id], TRACK_MS);
  const until = best(f.dep) ? (+new Date(best(f.dep)!) - Date.now()) / 60000 : 0;
  const banner = f.status === "cancelled" ? ["Cancelled", "red"] : f.status === "landed" ? [`Arrived ${da != null ? lateLabel(da) : ""}`, da && da > 14 ? "red" : "green"] : f.status === "enroute" ? [`En route${lv?.eta ? ", ETA " + fmtT(lv.eta, f.destination?.tz) : ""}`, "blue"] : f.status === "departed" ? ["Departed " + (f.dep.actual ? fmtT(f.dep.actual, f.origin?.tz) : ""), "blue"] : until > 0 ? [`Gate Departure in ${dur(until)}`, dd && dd > 14 ? "red" : "green"] : [f.statusText || "Scheduled", "green"];
  const tz = tzOffset(f.destination?.tz) - tzOffset(f.origin?.tz);
  const shareUrl = () => shareLink(f);
  const h = flights.filter((x: Flight) => x.origin?.iata === f.origin?.iata && x.destination?.iata === f.destination?.iata && !x.friend);
  return <div className="fd"><EtaLine f={f} live={lv} />
    {f.example && <div className="exlabel">Example data — not a real flight record</div>}
    <div className={"banner " + banner[1]}><b>{banner[0]}</b><div className="sm">Total {dur(estDurMin(f.origin, f.destination))} est. • {dist(f.origin, f.destination).toLocaleString()} mi{lv ? ` • live ${Math.round(lv.alt || 0).toLocaleString()} ft, ${Math.round(lv.gs || 0)} kt` : ""}</div>{lv?.matched === "route" && <div className="sm">{lv.matchNote}. Probable match: the airline flies a different radio callsign from the flight number.</div>}</div>
    {!f.example && <div className="px"><AircraftCard f={f} hex={hex} reg={reg} /></div>}
    <div className="px"><FindMyPlane f={f} reg={reg} hex={hex} type={ac?.icaoType || lv?.type || ac?.type || f.aircraft?.model} flights={flights} inb={inb} /><div className="faint xs mt8">{PLANE_CREDITS}</div></div>
    <TimeBlock dir="dep" a={f.origin} t={f.dep} d={dd} badge={<Badge icon={Ic.gate} v={f.dep.gate} k={f.dep.terminal && `Terminal ${f.dep.terminal}`} />} />
    {f.diverted && <div className="divert">⑂ DIVERTED TO {f.diverted.iata}<span>Search for Recovery Flight ›</span></div>}
    <div className="sep"><span><i className="sk-ii">{Ic.clock}</i> {dur(estDurMin(f.origin, f.destination))} • {dist(f.origin, f.destination).toLocaleString()} mi</span></div>
    <TimeBlock dir="arr" a={f.diverted || f.destination} t={g.arr} d={da} est={(g.arr as any).estimatedOnly} badge={<Badge icon={I.bag} v={f.arr.baggage || f.arr.gate} k={f.arr.terminal && `Terminal ${f.arr.terminal}`} />} />
    <FlightTimes f={f} fresh={fresh} />
    <Refreshed {...fpoll} />
    <div className="sk-src"><i className="sk-ii">{Ic.info}</i>Source: {f.source || (f.manual ? "entered manually" : "—")}</div>
    <Facts f={f} ac={ac} />
    <Progress f={f} lv={lv} />
    <Timeline f={f} />
    <Prediction f={f} />
    <SecHead ic={Ic.bolt} title="Actions" sub="Share, plan and check the risks" />
    <div className="sk-acts three"><ActBtn ic={Ic.image} onClick={() => shareImage(f)}>Share image</ActBtn><ActBtn ic={Ic.cal} onClick={() => icsOf([f], f.number + ".ics")}>Calendar</ActBtn>{f.origin?.iata && <ActBtn ic={Ic.tower} onClick={() => push({ t: "guide", iata: f.origin!.iata })}>{f.origin.iata} guide</ActBtn>}{f.origin?.iata && <ActBtn ic={Ic.life} onClick={() => push({ t: "labs", id: "rescue", f })}>Backup flights</ActBtn>}{f.origin?.iata && <ActBtn ic={Ic.cloud} onClick={() => push({ t: "labs", id: "wx", apt: f.origin!.iata })}>{f.origin.iata} weather</ActBtn>}{!f.example && <ActBtn ic={Ic.shield} onClick={() => push({ t: "labs", id: "risk", f })}>Trip risk</ActBtn>}</div>
    {!f.example && <CompCard f={f} />}
    <LeaveCard f={f} /><DepartureDay f={f} />
    <WeatherCard w={wx[0]} a={f.origin} label="Departure" />
    <WeatherCard w={wx[1]} a={f.destination} label="Arrival" />
    <h3 className="px">Good to Know</h3>
    <div className="gtk"><span className="ico">🕘</span><div><b>{tz ? `${tz > 0 ? "+" : ""}${tz / 60}h Timezone Change` : "No Timezone Change"}</b><div className="muted sm">{tz ? `${f.destination?.city} is ${Math.abs(tz / 60)}h ${tz > 0 ? "ahead of" : "behind"} ${f.origin?.city}` : "Both airports are in the same timezone"}</div></div></div>
    <div className="card"><h3>Arrival Forecast</h3><div className="muted sm">{f.number} recorded performance{fc ? ` • ${fc.observed} observed flights` : ""}</div>
      {fc && fc.observed ? <><div className="grid3 mt8"><Stat label="Late" v={`${fc.latePct}%`} /><Stat label="Average of Late" v={`${fc.avgLate}m`} /><Stat label="Observed" v={`${fc.observed} Flights`} /></div>
        {[["Early", fc.buckets.early, "#2f9e44"], ["On Time", fc.buckets.ontime, "#69db7c"], ["15m late", fc.buckets.l15, "#fcc419"], ["30m late", fc.buckets.l30, "#fd7e14"], ["45m+ late", fc.buckets.l45, "#fa5252"], ["Canceled", fc.buckets.cancelled, "#c92a2a"], ["Diverted", fc.buckets.diverted, "#862e2e"]].map(([l, v, c]: any) => <div key={l} className="bar"><span>{l}</span><div><i style={{ width: `${v / fc.observed * 100}%`, background: c }} /></div><b>{Math.round(v / fc.observed * 100)}%</b></div>)}
        <div className="faint sm mt8">{fc.source}</div></> : <div className="muted sm mt8">No recorded history yet. Skyline records every MAN/STN/EMA flight outcome every 30 min, so this fills up over the coming days (up to 60 days).</div>}</div>
    <PassCard f={f} /><FlightStory f={f} /><Alternatives f={f} push={push} /><JetLag f={f} /><PlaneFrom f={f} /><RouteWeather f={f} /><div className="card plane"><h3>Where's My Plane?</h3><div className="muted">{ac?.type || lv?.type || f.aircraft?.model || rs?.reg && rs.type || (rs?.typicalType ? `Typical: ${rs.typicalType.type}` : "Aircraft usually assigned 2–3 h before departure")}{reg && ` • ${reg}`}</div>
      <Livery small code={f.airline?.iata} icao={f.airline?.icao} name={f.airline?.name} type={ac?.icaoType || lv?.type || ac?.type || f.aircraft?.model} reg={reg} hex={hex} />
      <div className="chain"><div className="ci on"><b>This Flight</b><span style={{ color: lateColor(dd) }}>{f.status === "departed" || f.status === "landed" ? `Departed ${lateLabel(dd)}` : lateLabel(dd) || "Scheduled"}</span></div>
        {inb?.flights?.filter((x: Flight) => x.number !== f.number).map((x: Flight) => <div key={x.id} className="ci"><b>{x.number} {x.origin?.iata} → {x.destination?.iata}</b><span style={{ color: lateColor(delay(x.arr)) }}>{x.statusText} {lateLabel(delay(x.arr))}</span></div>)}
        {inb?.needsKey && <div className="faint sm">Inbound aircraft chain needs a free AeroDataBox key (Settings). The aircraft registration is {reg}.</div>}
        {!reg && <div className="faint sm">The aircraft appears once it is assigned / broadcasting ADS-B (usually ~1h before departure).</div>}</div></div>
    <PlaneHere f={f} hex={hex} reg={reg} />
    {phaseOf(f) === "pre" && !f.example && <button className="secondary mx" onClick={() => push({ t: "dayof", f })}>Open airport mode for {f.origin?.iata}</button>}
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
const zoneAbbr = (iso: string, tz?: string) => { try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/London", timeZoneName: "short" }).formatToParts(new Date(iso)).find(p => p.type === "timeZoneName")?.value || ""; } catch { return ""; } };
const dayTag = (iso: string, tz?: string) => { const d = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz || "Europe/London" }); const t = d(new Date()); const v = d(new Date(iso)); return v === t ? "" : v === d(new Date(Date.now() - 864e5)) ? "Yesterday " : v === d(new Date(Date.now() + 864e5)) ? "Tomorrow " : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz }) + " "; };
function FlightTimes({ f, fresh }: any) {
  const keep = (a: any = {}, b: any = {}) => { const o = { ...a }; for (const k in b) if (b[k] != null && b[k] !== "") o[k] = b[k]; return o; };
  const dep = keep(f.dep, fresh?.dep), arr = keep(f.arr, fresh?.arr), status = fresh?.status || f.status;
  const cell = (iso: any, tz?: string) => iso ? <><b>{dayTag(iso, tz)}{fmtT(iso, tz)}</b> <span className="faint">{zoneAbbr(iso, tz)}</span></> : <span className="faint">not reported</span>;
  const dl = (t: any) => { const x = t.actual || t.estimated; if (!x || !t.scheduled) return null; const m = Math.round((+new Date(x) - +new Date(t.scheduled)) / 60000); return m; };
  const row = (label: string, t: any, a: any, done: boolean) => { const m = dl(t); return <div className="ftrow"><div className="ftlab"><b>{label}</b><div className="faint sm">{a?.iata} local time</div></div>
    <div className="ftgrid"><div><small className="faint">Scheduled</small><div>{cell(t.scheduled, a?.tz)}</div></div><div><small className="faint">Estimated</small><div>{t.estimated ? cell(t.estimated, a?.tz) : <span className="faint">{t.actual ? "—" : "not reported"}</span>}</div></div>
      <div><small className="faint">Actual</small><div>{t.actual ? cell(t.actual, a?.tz) : <span className="faint">{done ? "not reported by source" : "not yet"}</span>}</div>{t.actualSource && <small className="faint">{t.actualSource}</small>}</div>
      <div><small className="faint">Delay</small><div style={{ color: m != null ? lateColor(m) : undefined }}>{m == null ? <span className="faint">—</span> : m > 0 ? `+${m} min` : m < 0 ? `${-m} min early` : "on time"}</div></div></div></div>; };
  return <div className="card"><h3>Departure and arrival times</h3>
    {row("Departure", dep, f.origin, ["departed", "enroute", "landed"].includes(status))}
    {row("Arrival", arr, f.diverted || f.destination, status === "landed")}
    <div className="faint sm mt8">Times shown in each airport's local time. "Not reported" means the source did not publish that time; nothing is estimated here.</div></div>;
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
  const bs = boardStatus(f, dir); const bsC = /bad/.test(bs.k) ? "var(--red)" : /warn/.test(bs.k) ? "var(--orange, #f59e0b)" : /ok/.test(bs.k) ? "var(--green)" : /dim/.test(bs.k) ? "var(--muted)" : st[1]; void st; void bsC;
  if (f.liveOnly) return <div className="brow press" onClick={onClick}><div className="bt"><span className="livedot" /><span className="faint sm">LIVE</span></div>
    <div className="grow"><b>{a?.city || a?.name || a?.iata || "Route unknown"}</b><div className="sm" style={{ color: f.status === "approaching" || f.status === "departed" ? "var(--blue)" : "var(--green)" }}>● {f.statusText}</div></div>
    <div className="right"><b>{f.number}</b><div className="faint sm">{f.aircraft?.type || ""} {f.live?.alt && f.live.alt !== "ground" ? `${Math.round(f.live.alt / 100) * 100}ft` : ""}</div></div></div>;
  const chipK = /bad/.test(bs.k) ? "bad" : /warn/.test(bs.k) ? "warn" : /ok/.test(bs.k) ? "ok" : /dim/.test(bs.k) ? "dim" : d != null && d >= 15 ? "warn" : "ok";
  const late = d != null && Math.abs(d) >= 5; const pills = [t.terminal && "T" + String(t.terminal).replace(/^T/, ""), dir === "dep" ? (t.gate && "Gate " + t.gate) : (f.arr?.baggage && "Belt " + f.arr.baggage)].filter(Boolean) as string[];
  return <div className="brow2 press" onClick={onClick}>
    <div className="b2t"><b className={late ? "lt" : ""}>{fmtT(late ? t.actual || t.estimated : t.scheduled, tz)}</b>{late && <s>{fmtT(t.scheduled, tz)}</s>}</div>
    <div className="b2logo"><Logo a={f.airline} s={18} /></div>
    <div className="grow b2m"><div className="b2c">{a?.city || a?.name || a?.iata}<span className="b2i">{a?.iata}</span></div>
      <div className="b2s"><span className={"b2chip " + chipK}>{bs.txt}</span>{d != null && d >= 5 && !/cancel/i.test(bs.txt) && <span className="b2chip delay">+{d}m</span>}{f.pred && f.pred.d >= 10 && f.status !== "cancelled" && <span className="aibadge sm" onClick={e => { e.stopPropagation(); (window as any).__why?.(f); }}>AI +{f.pred.d}m</span>}</div></div>
    <div className="b2r"><b>{f.number.replace(/^([A-Z0-9]{2})(?=\d)/, "$1 ")}</b><div className="b2p">{pills.map(x => <span key={x}>{x}</span>)}</div></div></div>;
}
function Board({ iata, x, push, term0 }: any) {
  const [info, setInfo] = useState(false); const [term, setTerm] = useState(() => !!term0 || /term=1/.test(location.hash));
  const [dir, setDir] = useState("dep"); const [date, setDate] = useState(today()); const [d, setD] = useState<any>(null); const [airline, setAirline] = useState(""); const [q, setQ] = useState(""); const [earlier, setEarlier] = useState(false);
  useEffect(() => setD(null), [iata, dir, date]);
  const poll = usePoll(() => api(`/board/${iata}?dir=${dir}&date=${date}`).then(setD).catch(e => setD((p: any) => p && !p.error ? p : { error: e.message, needsKey: e.needsKey, airport: e.airport || p?.airport })), [iata, dir, date]);
  const ap = d?.airport; const adj = useRef(false); // v23: open on the airport's local "today" (e.g. Greece/Turkey are past midnight before London)
  useEffect(() => { if (adj.current || !ap?.tz || date !== today()) return; adj.current = true; try { const loc = new Date().toLocaleDateString("en-CA", { timeZone: ap.tz }); if (loc !== date) setDate(loc); } catch {} }, [ap?.tz]);
  const [, tick] = useState(0); useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30e3); return () => clearInterval(t); }, []);
  const list = (d?.flights || []).filter((f: any) => (!airline || f.airline?.iata === airline) && (!q || JSON.stringify([f.number, f.destination?.city, f.origin?.city]).toLowerCase().includes(q.toLowerCase())))
    .sort((a: any, b: any) => a.liveOnly ? 0 : ((dir === "dep" ? a.dep : a.arr).scheduled < (dir === "dep" ? b.dep : b.arr).scheduled ? -1 : 1));
  const nowIdx = list.findIndex((f: any) => +new Date((dir === "dep" ? f.dep : f.arr).scheduled) > Date.now() - 30 * 60e3);
  useEffect(() => { if (nowIdx > 0 && date === today()) setTimeout(() => document.getElementById("brow-now")?.scrollIntoView({ block: "start" }), 50); }, [d]);
  const airlines = [...new Set((d?.flights || []).map((f: any) => f.airline?.iata))].filter(Boolean) as string[];
  return <><div className="head"><div><div className="row g6 bh-tags">{[iata, ap?.icao, new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ap?.tz || "Europe/London" }) + " " + (ap?.tz === "Europe/London" ? "GMT" : "local")].map(t => <span key={t} className="tag">{t}</span>)}</div><h1 className="h1s">{ap?.city || iata}</h1><div className="muted sm">{ap ? [ap.name, ap.country].filter(Boolean).join(", ").toUpperCase() : d?.error ? "" : "Loading airport…"}</div></div>{x}</div>
    <div className="chips bh-chips"><div className="sk-seg mini"><button className={!term ? "on" : ""}>{Ic.list}<span>List</span></button><button onClick={() => setTerm(true)}>{Ic.board}<span>FIDS</span></button></div><button className={"sk-pill " + (info ? "on" : "")} onClick={() => setInfo(v => !v)}>{info ? Ic.list : Ic.info}<span>{info ? "Board" : "Info"}</span></button><button className="sk-pill" onClick={() => navigator.share?.({ url: location.href, title: `${iata} board` })}>{Ic.share}<span>Share</span></button>
      <select className="chip" value={date} onChange={e => setDate(e.target.value)}>{[-1, 0, 1, 2].map(o => { const v = new Date(Date.now() + o * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" }); return <option key={v} value={v}>{["Yesterday", "Today", "Tomorrow", fmtD(v)][o + 1]}</option>; })}</select>
            <select className="chip" value={airline} onChange={e => setAirline(e.target.value)}><option value="">Airline: All</option>{airlines.sort().map(a => <option key={a}>{a}</option>)}</select></div>
    <div className="px"><div className="sk-seg big">{([["dep", "Departures", Ic.plane], ["arr", "Arrivals", Ic.land]] as const).map(([k, l, ic]) => <button key={k} className={dir === k ? "on" : ""} onClick={() => setDir(k)}>{ic}<span>{l}</span></button>)}</div></div>
    {term && <TerminalBoard iata={iata} dir={dir} date={date} onDir={setDir} onClose={() => setTerm(false)} onOpen={f => { setTerm(false); if (history.state?.tb) history.back(); push({ t: "flight", f: { ...f, date } }); }} />}
    {info ? <AirportInfo iata={iata} /> : <>
    <div className="px"><label className="sk-field"><span>{Ic.search}</span><input placeholder="Filter city or flight" value={q} onChange={e => setQ(e.target.value)} /></label></div>
    {!d && <div>{[0,1,2,3,4,5,6].map(i => <div key={i} className="sk-row"><div className="skel" style={{ width: 52 }} /><div className="grow"><div className="skel" style={{ width: (60 + (i * 37) % 30) + "%" }} /><div className="skel" style={{ width: "35%", height: 10, marginTop: 8 }} /></div><div className="skel" style={{ width: 54 }} /></div>)}</div>}
    {d && !d.error && d.sourceKind && d.sourceKind !== "live" && <div className="px"><span className={"srcb " + (d.sourceKind === "official" ? "off" : "")}>{d.sourceKind === "official" ? "OFFICIAL AIRPORT FEED" : "AERODATABOX"}</span> <span className="faint sm">{d.source}{d.site ? ` · ${d.site}` : ""} · real scheduled, estimated & actual times</span></div>}
    {d?.error && <div className="note warn">{d.needsKey ? `Free real-time boards are available for MAN, STN, EMA, FRA, SYD and 45 Norwegian (Avinor) airports. For ${iata}, add a free AeroDataBox key in Settings.` : d.error}</div>}
    {d?.liveOnly && <div className="note live-note"><b>Live traffic only</b> — derived from real ADS-B positions near {iata} (adsb.lol / adsb.fi) with adsbdb routes. No free official schedule feed exists for this airport, so no times or delays are shown (nothing is guessed). Optional: an AeroDataBox key in Settings adds schedules here.{date !== today() && " Live traffic is only available for today."}</div>}
    {d?.liveOnly && d.flights?.length === 0 && date === today() && <div className="empty"><b>Quiet right now</b><div className="muted sm">No aircraft seen near {iata} in the last 3h; this airport has no free timetable feed.</div><button className="chip mt8" onClick={() => push({ t: "airports", mode: "uk" })}>Airports with official boards</button></div>}
    {d?.officialUrl && <a className="site-link" href={d.officialUrl} target="_blank" rel="noopener"><b>Open {d.airport?.name || iata}'s own live board ↗</b><span>Their website has the full timetable; Skyline can't read it automatically (blocked or loaded in-browser only).</span></a>}
    {d?.note && <div className="note warn">{d.note}</div>}
    <Refreshed {...poll} note={d?.sourceKind === "aerodatabox" ? "schedule refreshes every 20 min (limited by free data plan)" : undefined} />
    {d?.flights && <div className="faint sm px">Source: {d.source}{d.attribution ? <> • <a href="https://aerodatabox.com" target="_blank" rel="noreferrer">{d.attribution}</a></> : null} • AI badges are predictions</div>}
    {(() => { const tOf = (f: any) => +new Date(best(dir === "dep" ? f.dep : f.arr) || (dir === "dep" ? f.dep : f.arr).scheduled || 0);
      const cut = Date.now() - 150 * 60e3; const old = date === today() && !q ? list.filter((f: any) => !f.liveOnly && tOf(f) < cut) : []; const L = earlier ? list : list.filter((f: any) => !old.includes(f));
      let lastH = ""; const tz = ap?.tz || "Europe/London";
      return <div className="board b2">{old.length > 0 && <button className="chip b2earlier" onClick={() => setEarlier(v => !v)}>{earlier ? "Hide earlier flights" : `Show ${old.length} earlier flights`}</button>}
        {L.map((f: any, i: number) => { const h = f.liveOnly ? "Live" : new Date((dir === "dep" ? f.dep : f.arr).scheduled || tOf(f)).toLocaleTimeString("en-GB", { hour: "2-digit", timeZone: tz }) + ":00"; const hd = h !== lastH; lastH = h;
          return <div key={f.id + i} id={i === nowIdx ? "brow-now" : undefined}>{hd && <div className="b2h">{h}</div>}<BoardRow f={f} dir={dir} onClick={() => push({ t: "flight", f: { ...f, date } })} /></div>; })}</div>; })()}</>}</>;
}

function Airports({ x, push, flights, initial }: any) {
  const [mode, setMode] = useState<"status" | "disruptions" | "uk">(initial || "status");
  const seg = <div className="segs"><button className={mode === "uk" ? "on" : ""} onClick={() => setMode("uk")}>UK &amp; Ireland</button><button className={mode === "status" ? "on" : ""} onClick={() => setMode("status")}>Status</button><button className={mode === "disruptions" ? "on" : ""} onClick={() => setMode("disruptions")}>Disruptions</button></div>;
  if (mode === "disruptions") return <Disruptions x={x} push={push} seg={seg} />;
  if (mode === "uk") return <UkList x={x} push={push} seg={seg} />;
  return <AirportStatus x={x} push={push} flights={flights} seg={seg} />;
}
function UkList({ x, push, seg }: any) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(""); const [q, setQ] = useState(""); const [n, setN] = useState(0); const [only, setOnly] = useState("all"); const [reg, setReg] = useState(() => localStorage.getItem("aplist") || "uk");
  useEffect(() => { localStorage.setItem("aplist", reg); setD(null); }, [reg]);
  const poll = usePoll(() => api(reg === "uk" ? "/uk" : "/uk?region=" + reg).then(r => { setD(r); setErr(""); }).catch(e => setErr(e.message || "Could not load airports")), [n, reg]);
  const ql = q.trim().toLowerCase(); const A = (d?.airports || []).filter((a: any) => (only === "all" || a.feed === only) && (!ql || [a.iata, a.name, a.city, a.country].some((v: string) => (v || "").toLowerCase().includes(ql))));
  const groups: Record<string, any[]> = {}; for (const a of A) (groups[a.country] = groups[a.country] || []).push(a);
  const cnt = (a: any) => { const c = a.counts; if (!c) return <span className="faint sm">{a.feed === "official" ? "Tap for today’s official timetable" : reg === "eu" ? "Not sampled yet" : "counting…"}</span>; if (c.kind === "official") return <span className="sm"><b>{c.dep ?? "–"}</b> dep · <b>{c.arr ?? "–"}</b> arr</span>; const ls = a.lastSeen || c.lastSeen; return <span className="sm"><b>{c.dep3h ?? c.departing}</b> dep · <b>{c.arr3h ?? c.arriving}</b> arr observed (3h) · <b>{c.ground}</b> on ground<div className="faint sm">{ls ? `Last aircraft seen ${new Date(ls).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}` : "No aircraft seen yet"}</div></span>; };
  const nOff = (d?.airports || []).filter((a: any) => a.feed === "official").length;
  return <><Head title="Airports" right={<>{x}</>} />{seg}<Refreshed {...poll} />
    <div className="px row g8 mb8">{[["uk", "UK & Ireland"], ["eu", "Western Europe"], ["ce", "Central Europe"]].map(([k, l]) => <button key={k} className={"chip" + (reg === k ? " blue" : "")} onClick={() => setReg(k)}>{l}</button>)}</div>
    <div className="px"><input className="field" placeholder={reg === "eu" ? "Search Western European airports" : reg === "ce" ? "Search Central European airports" : "Search UK & Irish airports"} value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="px row g8 mt8">{[["all", "All"], ["official", "Official timetable"], ["live", "Observed only"]].map(([k, l]) => <button key={k} className={"chip" + (only === k ? " blue" : "")} onClick={() => setOnly(k)}>{l}</button>)}</div>
    {d && <div className="px muted sm mt8">{(d.airports || []).length} airports. {nOff} publish an official timetable we can read; the rest are observed only (real ADS-B traffic, no scheduled times).</div>}
    {err && <div className="note warn">{err} <button className="chip" onClick={() => { setErr(""); setN(v => v + 1); }}>Retry</button></div>}
    {!d && !err && <div className="faint sm px mt8">Loading {reg === "eu" ? "Western European" : reg === "ce" ? "Central European" : "UK & Ireland"} airports…</div>}
    {Object.entries(groups).map(([g, L]) => <div key={g}><div className="px faint sm mt12" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>{g}</div><div className="card">{L.map((a: any) => <div key={a.iata} className="lrow press" onClick={() => push({ t: "board", iata: a.iata })}>
      <span className="code">{a.iata}</span><div className="grow"><b>{a.name.replace(/ (International )?Airport$/, "")}</b><div className="muted sm">{a.city} · {g}{a.source ? ` · ${a.source}` : ""}</div><div>{cnt(a)}</div>{a.blocked && <div className="faint sm">Official site not readable: {a.blocked}</div>}</div>
      <div className="col g8" style={{ alignItems: "flex-end" }}><span className={"fbadge " + a.feed}>{a.feed === "official" ? "Official timetable" : a.feed === "aerodatabox" ? "Schedule (free plan)" : "Observed only"}</span><button className="chip" onClick={e => { e.stopPropagation(); push({ t: "board", iata: a.iata, term: true }); }}>Board</button></div></div>)}</div></div>)}
    {d && !A.length && <div className="px faint mt8">No airport matches “{q}”.</div>}
  </>;
}
const dsev = (v: number | null | undefined) => v == null ? -1 : v >= 3.5 ? 2 : v >= 2 ? 1 : 0;
function Disruptions({ x, push, seg }: any) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(""); const [open, setOpen] = useState(""); const [n, setN] = useState(0);
  const poll = usePoll(() => api("/disruptions").then(r => { setD(r); setErr(""); }).catch(e => setErr(e.message || "Could not load disruptions")), [n]);
  const sc = (v: any, ic: ReactNode, l: string) => <div className={"dscore s" + dsev(v?.score)} title={l}><span className="faint">{ic}</span><b>{v?.score != null ? v.score.toFixed(1) : "–"}</b><i /></div>;
  const A = d?.airports || []; const stat = (v: any, l: string) => v?.score != null ? <div><label>{l}</label><div>{v.n} flights</div><div>{v.avgDelay} min avg</div><div>{v.cancelledPct ?? 0}% cancelled</div>{v.late30Pct != null && <div>{v.late30Pct}% &gt;30m late</div>}</div> : <div><label>{l}</label><div className="faint">Not enough flights</div></div>;
  return <><Head title="Airports" right={<>{x}</>} />{seg}<Refreshed {...poll} />
    <div className="px row g8"><h3 className="m0">Airport disruptions</h3><span className="live">LIVE</span>{d?.updated && <span className="faint sm">Updated {fmtT(d.updated)} UK</span>}</div>
    <div className="px muted sm mt8">Ranked by the worst of arrivals and departures over the last 4 hours, from real airport boards. Tap an airport for airlines and causes.</div>
    {err && <div className="note warn">{err} <button className="chip" onClick={() => { setErr(""); setN(v => v + 1); }}>Retry</button></div>}
    {!d && !err && <div><div className="faint sm px">Reading live boards from every supported airport (takes up to 15 s)…</div>{[0,1,2,3,4,5].map(i => <div key={i} className="sk-row"><div className="skel" style={{ width: 52 }} /><div className="grow"><div className="skel" style={{ width: (60 + (i * 37) % 30) + "%" }} /></div><div className="skel" style={{ width: 54 }} /></div>)}</div>}
    {d && <div className="card dcard">{A.map((a: any) => { const o = open === a.airport.iata; return <div key={a.airport.iata}><div className="drow press" onClick={() => setOpen(o ? "" : a.airport.iata)}>
      <div className="grow"><div className="row g8"><b>{a.airport.city || a.airport.name}</b><span className="tag">{a.airport.iata}</span></div>
        <div className="row g10 sm muted mt8 wrap">{a.wx && <><span>{wxIcon(a.wx.code)} {Math.round(a.wx.temp)}°C</span><span>{a.wx.windKts} kt</span></>}{a.cause && <span className="orange">{a.cause}</span>}<span className="faint">{a.source}</span></div></div>
      {sc(a.arr, I.land, "Arrivals")}{sc(a.dep, I.takeoff, "Departures")}</div>
      {o && <div className="ddet"><div className="grid3 st">{stat(a.dep, "DEPARTURES")}{stat(a.arr, "ARRIVALS")}<div><label>CAUSE</label><div>{a.cause ? "Weather: " + a.cause : "No severe weather now"}</div><div className="faint sm">ATC / strike causes are not in any free feed</div></div></div>
        {a.airlines?.length ? <><div className="faint sm mt8">Airlines, last 4 h (3+ flights)</div>{a.airlines.map((l: any) => <div key={l.iata} className="row between sm"><span><b>{l.iata}</b> {l.name}</span><span className={l.cancelled ? "red" : l.avgDelay >= 30 ? "orange" : "muted"}>{l.n} flights · {l.avgDelay} min avg{l.cancelled ? ` · ${l.cancelled} cancelled` : ""}</span></div>)}</> : null}
        <button className="chip blue mt8" onClick={() => push({ t: "board", iata: a.airport.iata })}>Open {a.airport.iata} board</button></div>}</div>; })}
      {!A.length && <div className="faint sm">No airports have 5+ flights in the last 4 hours right now (common overnight). Live traffic is listed below.</div>}</div>}
    <div className="card"><div className="lg"><span className="sdot2 s0" />0.0–1.9<span className="muted">Good traffic flow</span></div><div className="lg"><span className="sdot2 s1" />2.0–3.4<span className="muted">Minor problems with some delays or few cancellations</span></div><div className="lg"><span className="sdot2 s2" />3.5–5.0<span className="muted">Major problems with long delays and several cancelled flights</span></div></div>
    {d?.liveOnly?.length ? <div className="card mt16"><div className="row between"><b>Live traffic elsewhere</b><span className="srcb live">ADS-B</span></div><div className="faint sm">Real aircraft moving at {d.liveOnly.length} more hubs right now. No delay score without schedules (add AeroDataBox key).</div>
      {d.liveOnly.slice().sort((a: any, b: any) => (b.live.departing + b.live.arriving) - (a.live.departing + a.live.arriving)).slice(0, 15).map((r: any) => <div key={r.airport.iata} className="row between drow press" onClick={() => push({ t: "board", iata: r.airport.iata })}><div><b>{r.airport.city}</b> <span className="tag">{r.airport.iata}</span></div><div className="sm muted">{r.live.departing} out · {r.live.arriving} in · {r.live.ground} on ground</div></div>)}</div> : null}
    <div className="note">Skyline Disruption Index: our own score, not Flightradar24's. 5 × (45% cancellations capped at 20% + 35% average delay capped at 60 min + 20% share over 30 min late capped at 50%). Weather: Open-Meteo. Refreshes every 10 min.
      {d?.noData?.length ? <> No delay data for {d.noData.length} airports: {d.noData.join(", ")}{!d.keys?.aerodatabox && ". Add a free AeroDataBox key in Settings to score them"}.</> : null}</div></>;
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

function Settings({ x, theme, setTheme, push }: any) {
  const [s, setS] = useState<any>({}); const [k, setK] = useState(""); const [lk, setLk] = useState(""); const [lb, setLb] = useState(""); const [lm, setLm] = useState(""); const [tok, setTok] = useState(""); const [msg, setMsg] = useState("");
  const load = () => api("/settings").then(r => { setS(r); setLb(r.llmBase); setLm(r.llmModel); }); useEffect(() => { load(); }, []);
  const saveK = (body: any) => api("/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, adminToken: tok, newAdminToken: tok }) }).then(() => { setMsg("Saved ✓"); load(); }).catch(e => setMsg(e.message));
  return <><Head title="Settings" sub="Preferences, data and sources" right={x} /><div className="px col g8 set">
    <div className="card m0"><b className="set-h sm"><span>{Ic.image}</span>Photo credits</b><div className="faint sm mt4">{PLANE_CREDITS}</div><div className="faint sm mt4"><a href="https://www.planespotters.net" target="_blank" rel="noopener">Planespotters.net</a> · <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a></div></div><div className="card m0 row between"><span className="set-l"><span>{Ic.info}</span>App version</span><b className="sm">{BUILD}</b></div><button className="card m0 row between press" style={{ width: "100%" }} onClick={() => push({ t: "features" })}><span className="set-l"><span>{Ic.flask}</span>All features</span><b className="sm set-n">{TOOLS.length + BOARD_FEATURES.length}</b></button><UnitsCard /><AlertPrefsCard onChange={() => syncPush(JSON.parse(localStorage.getItem("skyline.flights.v1") || "[]").filter((f: any) => !f.friend)).catch(() => {})} />
    <div className="card m0"><h3 className="set-h"><span>{Ic.palette}</span>Appearance</h3><div className="segs m0">{["auto", "light", "dark"].map(t => <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t}</button>)}</div></div>
    <div className="card m0"><h3 className="set-h"><span>{Ic.bell}</span>Push notifications</h3><div className="muted sm">Gate & terminal changes, delays, cancellations, belt numbers — even when Skyline is closed. The server checks your tracked flights every 4 minutes. iPhone: open Skyline from its Home Screen icon (iOS 16.4+).</div>
      <PushControls /></div>
    <div className="card m0"><h3 className="set-h"><span>{Ic.db}</span>Your data</h3><div className="muted sm">Your flights, friends and settings are saved on this iPhone and survive server restarts. Make a backup file to move them to another device.</div>
      <div className="row g8 mt8 wrap"><button className="secondary" onClick={() => exportBackup()}><i className="sk-ii">{Ic.download}</i> Back up</button><label className="secondary"><i className="sk-ii">{Ic.upload}</i> Restore<input hidden type="file" accept=".json,application/json" onChange={e => e.target.files?.[0] && importBackup(e.target.files[0]).catch(er => setMsg(er.message))} /></label></div>
      <input className="field mt8" placeholder="Your name (shown on flights you share)" defaultValue={localStorage.getItem("sk.name") || ""} onBlur={e => localStorage.setItem("sk.name", e.target.value.trim())} /></div>
    <div className="card m0"><h3 className="set-h"><span>{Ic.key}</span>AeroDataBox key (optional)</h3><div className="muted sm"><b>You don’t need this.</b> Real schedules already work free, with no key, at MAN, STN, EMA, LHR, DUB, ORK, BFS, BHD, LDY, LTN, GCI, NOC, BOH, FRA, SYD and 45 Norwegian (Avinor) airports. Every other airport shows real live ADS-B traffic. If you want schedules everywhere: Free “Basic” plan at rapidapi.com/aedbx-aedbx/api/aerodatabox → Subscribe → copy X-RapidAPI-Key. Enables boards & flight search at any airport, aircraft registration, inbound-plane chain and global airport delay stats. Status: <b>{s.aerodatabox || "not set"}</b></div>
      <input className="field mt8" placeholder="Paste RapidAPI key" value={k} onChange={e => setK(e.target.value)} /><button className="primary mt8" onClick={() => saveK({ aerodataboxKey: k })}>Save key</button></div>
    <div className="card m0"><h3 className="set-h"><span>{Ic.chat}</span>LLM explanations (optional)</h3><div className="muted sm">Any OpenAI-compatible API (default xAI: console.x.ai). Used only to word the AI-prediction explanation. Status: <b>{s.llm || "not set"}</b></div>
      <input className="field mt8" placeholder="API key" value={lk} onChange={e => setLk(e.target.value)} /><input className="field mt8" placeholder="Base URL" value={lb} onChange={e => setLb(e.target.value)} /><input className="field mt8" placeholder="Model" value={lm} onChange={e => setLm(e.target.value)} />
      <button className="primary mt8" onClick={() => saveK({ llmKey: lk, llmBase: lb, llmModel: lm })}>Save</button></div>
    <div className="card m0"><h3 className="set-h"><span>{Ic.shield}</span>Admin token</h3><div className="muted sm">{s.protected ? "Keys are protected — enter your admin token to change them." : "Set a token so nobody else with the URL can change your keys (saved with your next key save)."}</div><input className="field mt8" type="password" placeholder="Admin token" value={tok} onChange={e => setTok(e.target.value)} /></div>
    {msg && <div className="note">{msg}</div>}
    <div className="sk-foot">{Ic.db}<span>Data: MAN/STN/EMA official flight info • adsb.lol / adsb.fi (ADS-B live positions) • adsbdb (routes) • hexdb.io (aircraft) • planespotters.net (photos) • Open-Meteo (weather) • RainViewer (radar) • OpenFlights (airports/airlines) • Esri / CARTO / OSM (maps). Skyline is an independent app, not affiliated with Flighty.</span></div><div style={{ height: 60 }} /></div></>;
}
