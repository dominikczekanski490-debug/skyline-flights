// v22: aircraft card for any flight, home widgets, plane overhead, Wrapped, connection checker, What's new.
import { useEffect, useMemo, useState } from "react";
import { api, best, delay, dist, estDurMin, fmtT, fmtD, load, withEstArr, type Flight } from "./lib";
import { connections } from "./assist";

const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* */ } };
const ago = (iso: string) => { const m = Math.round((Date.now() - +new Date(iso)) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const HOW: Record<string, string> = { given: "from the flight feed", "observed-arr": "seen landing on ADS-B", "observed-dep": "seen taking off on ADS-B", "adsb-callsign": "matched by its transponder callsign", "adsb-route": "transponder matched by route", "adsb-geometry": "the only matching aircraft on this route (Skyline estimate)", rotation: "flew the inbound leg (Skyline estimate)", "learned-callsign": "the callsign this route used yesterday is live now (Skyline estimate)", ground: "parked at the departure airport (Skyline estimate)", board: "from the airline/airport" };

export function AircraftCard({ f, hex, reg }: { f: Flight; hex?: string; reg?: string }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { let on = true; const go = () => api(`/plane-card?number=${encodeURIComponent(f.number)}&date=${f.date}&o=${f.origin?.iata || ""}&d=${f.destination?.iata || ""}&dep=${f.dep?.actual || f.dep?.scheduled || ""}&arr=${f.arr?.actual || f.arr?.estimated || f.arr?.scheduled || ""}&status=${f.status || ""}&hex=${hex || ""}&reg=${reg || ""}`).then(r => on && setD(r)).catch(e => on && setErr(e.message));
    go(); const t = setInterval(go, 90e3); return () => { on = false; clearInterval(t); }; }, [f.id, hex, reg]);
  const [tp, stp] = useState<any>(null);
  useEffect(() => { if (!d || d.photo?.src) return; const t = d.icaoType || d.typicalType; const al = (d.callsign || "").slice(0, 3); if (!t && !al) return; api(`/photo?al=${al}&type=${t || ""}&aln=${encodeURIComponent((f as any).airline?.name || "")}&tn=${encodeURIComponent(d.type || "")}${d.reg ? "&reg=" + d.reg : ""}`).then(r => stp(r?.src ? r : null)).catch(() => {}); }, [d?.reg, d?.typicalType, d?.photo?.src]);
  const lv = d?.live; const air = lv && lv.alt !== "ground" && lv.alt > 0;
  return <section className="v22-sec ac22"><div className="v22-sh"><span>Aircraft</span>{d?.confidence && <em className={"conf " + d.confidence}>{d.confidence === "likely" ? "Likely · Skyline estimate" : d.confidence === "possible" ? "Possible · Skyline estimate" : d.confidence === "typical" ? "Typical type only" : "Confirmed"}</em>}</div>
    <div className="ac22-card">
      {d?.photo?.src ? <a className="ac22-ph big" href={d.photo.link} target="_blank" rel="noreferrer"><img src={d.photo.src.replace("_280.", "_1000.")} onError={e => { (e.target as HTMLImageElement).src = d.photo.src; }} alt="" referrerPolicy="no-referrer" /><em className={"ac22-tag " + (d.confidence || "")}>{d.confidence === "confirmed" || !d.confidence ? `This aircraft · ${d.reg || d.hex?.toUpperCase() || ""}` : `Possible airframe · ${d.reg || d.hex?.toUpperCase() || ""}`}</em><span>{d.photo.credit}</span></a>
        : d && tp?.src ? <a className="ac22-ph big" href={tp.link} target="_blank" rel="noreferrer"><img src={tp.src} alt="" referrerPolicy="no-referrer" /><em className="ac22-tag typical">{tp.kind === "type" ? `Type photo · ${tp.typeName || d.type || d.typicalType} (not this airframe)` : `Same type${tp.reg ? " · " + tp.reg : ""} — not this airframe`}</em><span>{tp.credit || (tp.author ? "© " + tp.author : "")}{tp.source ? " · " + tp.source : ""}</span></a>
        : <div className="ac22-ph none"><span>{!d ? "Looking up the aircraft…" : d.reg ? "No photo of this airframe found" : d.inbound ? `Arrives as ${d.inbound.number} from ${d.inbound.from}` : /departed|enroute/.test(f.status || "") || (f as any).dep?.actual ? "In the air — transponder not matched yet" : "Exact aircraft not identified yet"}</span></div>}
      <div className="ac22-main"><div className="ac22-reg">{d?.reg || (d ? "—" : "…")}</div><div className="ac22-type">{d?.type || d?.icaoType || ((f as any).aircraft?.model ? `${(f as any).aircraft.model} (flight feed)` : "") || (d?.typicalType ? `Usually a ${d.typicalType}` : d ? "Type not known yet" : "")}{d?.typicalType && !d?.reg && <small> · typical for this airline (Skyline estimate)</small>}</div>
        {d?.how && <div className="ac22-how">Identified: {HOW[d.how] || d.how}</div>}
        {d?.reason && (d.reg || d.hex) && d.confidence !== "confirmed" && <div className="ac22-how">{d.reason}</div>}
        {d?.inbound && <div className="ac22-how">Inbound <b>{d.inbound.number}</b> from {d.inbound.from}{d.inbound.reg ? <> {d.inbound.status === "landed" ? "arrived" : "operated"} as <b>{d.inbound.reg}</b></> : " — aircraft not identified yet"}</div>}
        <div className="ac22-grid">
          <div><label>Operator / owner</label><b>{d?.owner || "Not available"}</b></div>
          <div><label>Mode-S hex</label><b>{d?.hex ? d.hex.toUpperCase() : "Not available"}</b></div>
          <div><label>Manufacturer</label><b>{d?.manufacturer || "Not available"}</b></div>
          <div><label>Registered in</label><b>{d?.ownerCountry || "Not available"}</b></div>
          <div><label>Age</label><b className="na">Not available</b></div>
          <div><label>Cabin / seats</label><b className="na">Not available</b></div>
        </div>
        {lv?.other ? <div className="ac22-live off"><i /><span>Live: this airframe is flying as {lv.flight} right now (another flight). See the note below.</span></div> : lv ? <div className={"ac22-live " + (air ? "air" : "gnd")}><i />{air ? <><b>{Math.round(lv.alt).toLocaleString()} ft</b><b>{Math.round(lv.gs || 0)} kt</b><b>{Math.round(lv.track || 0)}°</b><span>live ADS-B · {lv.flight || ""}</span></> : <><b>On the ground</b><span>live ADS-B{lv.gs ? ` · ${Math.round(lv.gs)} kt taxiing` : ""}</span></>}</div>
          : d?.reg && <div className="ac22-live off"><i /><span>Not broadcasting on ADS-B right now</span></div>}
        {d?.today?.length > 0 && <div className="ac22-day"><label>This plane's flights in the last 24 h</label>{[...d.today].reverse().map((l: any, i: number) => { const me = (l.from === f.origin?.iata || l.to === f.destination?.iata) && Math.abs(+new Date(l.dep || l.arr) - +new Date(best(f.dep) || f.date)) < 3 * 3600e3;
          return <div key={i} className={"ac22-leg" + (me ? " me" : "") + (l.arr ? "" : " air")}><div className="ac22-lt"><b>{l.from || "?"}</b><i /><b>{l.to || (l.arr ? "?" : "…")}</b></div><div className="ac22-lm"><span>{l.cs || ""}{me ? " · this flight" : ""}</span><span>{l.dep ? fmtT(l.dep) : "—"} → {l.arr ? fmtT(l.arr) : l.to ? "—" : "in the air"}</span></div>{l.conf === "likely" && <em>Likely</em>}</div>; })}
          <div className="faint xs">Worked out from Skyline's Europe-wide ADS-B sweeps. Airports are inferred from where the plane climbed or descended, so "Likely" legs are Skyline estimates. Times are UK time.</div></div>}
        {!d?.today?.length && d?.legs?.length > 0 && <div className="ac22-legs"><label>Where this plane has been (Skyline's ADS-B log)</label>{d.legs.slice(0, 5).map((l: any) => <div key={l.t + l.kind}><span className={"dot " + l.kind} /><b>{l.kind === "arr" ? "Landed" : "Took off"} {l.ap}</b><span>{l.cs} · {fmtT(l.at)} · {ago(l.at)}</span></div>)}</div>}
        {(d?.gaps || []).length > 0 && <ul className="ac22-gaps">{d.gaps.map((g: string) => <li key={g}>{g}</li>)}</ul>}
        {err && <div className="ac22-gaps">Couldn't reach the aircraft service: {err}</div>}
        {d?.sources?.length > 0 && <div className="faint xs mt8">Sources: {d.sources.join(" · ")}</div>}
      </div></div>{d?.hex && <Xpdr lv={lv} hex={d.hex} />}<Acars hex={d?.hex} reg={d?.reg} conf={d?.confidence} /></section>;
}

export function WhatsNew22() {
  const [show, setShow] = useState(() => !localStorage.getItem("sk.seen.v22")); if (!show) return null;
  const done = () => { buzz(); localStorage.setItem("sk.seen.v22", "1"); setShow(false); };
  return <div className="wn22" onClick={done}><div className="wn22-card" onClick={e => e.stopPropagation()}>
    <div className="wn22-badge">Skyline v22</div><h2>A whole new Skyline</h2><p>Redesigned from top to bottom, plus new features. Everything uses real data, and estimates are labelled.</p>
    {[["✦", "New design", "Bigger type, glass cards, a new tab bar and a new home screen"], ["✈︎", "Aircraft card", "Registration, type, photo and live position for any flight, with reasons when something isn't known"], ["◎", "What's overhead", "Point at the sky. Skyline lists the planes near you from live ADS-B"], ["⇄", "Connection checker", "Checks your layovers against typical minimum connection times"], ["★", "Your year in flights", "A Wrapped-style recap of your flights"]].map(([i, t, s]) => <div key={t} className="wn22-row"><span>{i}</span><div><b>{t}</b><small>{s}</small></div></div>)}
    <button className="primary" onClick={done}>Let's go</button></div></div>;
}

export function HomeWidgets({ flights, push }: { flights: Flight[]; push: (o: any) => void }) {
  const mine = flights.filter(f => !f.friend && !f.example); const yr = String(new Date().getFullYear()); const ys = mine.filter(f => f.date.startsWith(yr));
  const nx = mine.filter(f => best(f.dep) && +new Date(best(f.dep)!) > Date.now()).sort((a, b) => +new Date(best(a.dep)!) - +new Date(best(b.dep)!))[0];
  const [, t] = useState(0); useEffect(() => { const i = setInterval(() => t(x => x + 1), 30e3); return () => clearInterval(i); }, []);
  const mins = nx ? Math.max(0, Math.round((+new Date(best(nx.dep)!) - Date.now()) / 60000)) : 0; const cx = connections(mine);
  const W = (k: string, cls: string, ic: string, title: string, val: any, sub: string, on: () => void) => <button key={k} className={"w22 " + cls} onClick={() => { buzz(); on(); }}><span className="w22-ic">{ic}</span><b>{val}</b><span className="w22-t">{title}</span><small>{sub}</small></button>;
  return <div className="w22-grid">
    {W("cd", "wide grad1", "⏱", nx ? `${nx.number} · ${nx.origin?.iata} → ${nx.destination?.iata}` : "No upcoming flight", nx ? (mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor(mins % 1440 / 60)}h` : `${Math.floor(mins / 60)}h ${mins % 60}m`) : "—", nx ? "until departure · tap for the countdown screen" : "Add a flight to start a countdown", () => push({ t: "lock" }))}
    {W("ask", "grad2", "✦", "Ask Skyline", "Ask", "Ask about your flights", () => push({ t: "ask" }))}
    {W("oh", "grad3", "◎", "What's overhead", "Sky", "Live planes near you", () => push({ t: "overhead" }))}
    {W("cx", cx.some(c => c.risk !== "ok") ? "grad4 alert" : "grad4", "⇄", "Connections", cx.length ? `${cx.length}` : "0", cx.length ? `${cx.filter(c => c.risk !== "ok").length} need attention` : "Check a layover", () => push({ t: "conn" }))}
    {W("wr", "grad5", "★", `${yr} Wrapped`, `${ys.length}`, `${ys.length === 1 ? "flight" : "flights"} · ${Math.round(ys.reduce((s, f) => s + dist(f.origin, f.destination), 0)).toLocaleString()} mi`, () => push({ t: "wrapped" }))}
  </div>;
}

export function Overhead22({ x }: { x: any }) {
  const last = (() => { try { return JSON.parse(localStorage.getItem("sk.lastpos") || "null"); } catch { return null; } })();
  const [pos, setPos] = useState<{ lat: number; lon: number; label?: string } | null>(null); const [err, setErr] = useState(""); const [d, setD] = useState<any>(null); const [routes, setRoutes] = useState<Record<string, any>>({});
  const [q, setQ] = useState(""); const [hits, setHits] = useState<any[]>([]); const [asking, setAsking] = useState(false);
  const nx = load().filter(f => !f.friend && f.origin?.lat).sort((a, b) => Math.abs(+new Date(best(a.dep) || a.date) - Date.now()) - Math.abs(+new Date(best(b.dep) || b.date) - Date.now()))[0];
  const locate = () => { setErr(""); setAsking(true); if (!navigator.geolocation) { setAsking(false); return setErr("nogeo"); }
    navigator.geolocation.getCurrentPosition(p => { setAsking(false); const v = { lat: p.coords.latitude, lon: p.coords.longitude, label: "your location" }; localStorage.setItem("sk.lastpos", JSON.stringify({ ...v, at: Date.now() })); setPos(v); }, e => { setAsking(false); setErr(e.code === 1 ? "denied" : "unavailable"); }, { timeout: 12000, maximumAge: 300000 }); };
  useEffect(() => { if (last && Date.now() - last.at < 30 * 60e3) setPos({ ...last, label: "your last location" }); else if ((navigator as any).permissions?.query) (navigator as any).permissions.query({ name: "geolocation" }).then((r: any) => r.state === "granted" ? locate() : setErr(r.state === "denied" ? "denied" : "ask")).catch(() => setErr("ask")); else setErr("ask"); }, []);
  useEffect(() => { if (q.trim().length < 2) return setHits([]); const t = setTimeout(() => api("/airports/search?q=" + encodeURIComponent(q.trim())).then(r => setHits((r || []).slice(0, 5))).catch(() => setHits([])), 250); return () => clearTimeout(t); }, [q]);
  const pick = (a: any) => { setErr(""); setD(null); setPos({ lat: a.lat, lon: a.lon, label: `${a.city || a.name} (${a.iata})` }); setQ(""); setHits([]); };
  const isIOS = /iPhone|iPad/.test(navigator.userAgent); const standalone = (navigator as any).standalone || matchMedia("(display-mode: standalone)").matches;
  const chooser = <div className="oh-choose"><div className="oh-why">{err === "denied" ? <><b>Location is turned off for Skyline</b><span>{isIOS ? <>To turn it on, open <b>Settings → Privacy &amp; Security → Location Services</b>, make sure it's on, then scroll to <b>{standalone ? "Safari Websites" : "Safari Websites"}</b> and choose <b>While Using the App</b>. Then come back and tap Try again.</> : <>Allow location for this site in your browser's site settings, then tap Try again.</>}</span></> : err === "nogeo" ? <><b>This device can't share its location</b><span>Pick a place below.</span></> : err === "unavailable" ? <><b>Couldn't get a location fix</b><span>You might be indoors or offline. Pick a place below or try again.</span></> : <><b>See the planes above you</b><span>Skyline uses your location once to find nearby aircraft. It isn't stored on any server.</span></>}</div>
    <button className="primary w100" onClick={locate} disabled={asking}>{asking ? "Waiting for location…" : err === "ask" ? "Use my location" : "Try again"}</button>
    <div className="oh-or">or choose a place</div>
    {nx && <button className="oh-opt" onClick={() => pick(nx.origin)}><b>{nx.origin!.iata}</b><span>{nx.origin!.city || nx.origin!.name} · from your flight {nx.number}</span></button>}
    {nx?.destination?.lat && <button className="oh-opt" onClick={() => pick(nx.destination)}><b>{nx.destination!.iata}</b><span>{nx.destination!.city || nx.destination!.name} · where {nx.number} lands</span></button>}
    {last && <button className="oh-opt" onClick={() => setPos({ ...last, label: "your last location" })}><b>Last</b><span>Your last location ({ago(new Date(last.at).toISOString())})</span></button>}
    <input className="inp w100 mt8" placeholder="Type a city or airport, e.g. Athens" value={q} onChange={e => setQ(e.target.value)} />
    {hits.map(a => <button key={a.iata} className="oh-opt" onClick={() => pick(a)}><b>{a.iata}</b><span>{a.name}{a.city ? ", " + a.city : ""}</span></button>)}</div>;
  useEffect(() => { if (!pos) return; let on = true; const go = () => api(`/overhead?lat=${pos.lat}&lon=${pos.lon}&r=30`).then(r => { if (!on) return; setD(r); r.list.slice(0, 8).forEach((a: any) => a.flight && !routes[a.flight] && api("/callsign/" + a.flight).then(c => setRoutes(m => ({ ...m, [a.flight]: c.route || null }))).catch(() => {})); }).catch(e => on && setD({ list: [], error: e.message }));
    go(); const t = setInterval(go, 20e3); return () => { on = false; clearInterval(t); }; }, [pos?.lat, pos?.lon]);
  const L = (d?.list || []).filter((a: any) => a.alt !== "ground").slice(0, 25);
  return <div className="v22-page"><div className="v22-top"><div><h1>What's overhead</h1><span>{pos ? `Live ADS-B within 30 nm of ${pos.label || "you"} · updates every 20 s` : "Live planes near you, from ADS-B"}</span></div>{x}</div>
    {!pos ? chooser : <div className="row g8 px"><button className="chip" onClick={() => { setPos(null); setD(null); if (!err) setErr("ask"); }}>Change place</button></div>}
    {pos && !d && <div className="v22-empty">Scanning the sky…</div>}
    {d?.error && <div className="v22-empty">The live ADS-B sources are busy ({d.error}). Skyline retries every 20 seconds.</div>}
    {d && !d.error && !L.length && <div className="v22-empty">No aircraft in the air within 30 nm right now. Volunteer ADS-B coverage can be patchy away from big airports.</div>}
    {L[0] && <div className="oh-hero"><div className="oh-radar"><i />{L.slice(0, 12).map((a: any) => { const b = Math.atan2(a.lon - pos!.lon, a.lat - pos!.lat); const r = Math.min(1, a.nm / 30) * 46; return <s key={a.hex} style={{ left: `${50 + Math.sin(b) * r}%`, top: `${50 - Math.cos(b) * r}%`, transform: `rotate(${a.track || 0}deg)` }}>✈︎</s>; })}</div>
      <div><small>Nearest</small><b>{L[0].flight || L[0].reg || L[0].hex}</b><span>{L[0].desc || L[0].type || "Unknown type"}</span><span>{L[0].nm} nm · {Math.round(+L[0].alt || 0).toLocaleString()} ft</span>{routes[L[0].flight] && <span className="oh-rt">{routes[L[0].flight].origin?.iata_code} → {routes[L[0].flight].destination?.iata_code}*</span>}</div></div>}
    <div className="oh-list">{L.map((a: any) => { const r = routes[a.flight]; return <div key={a.hex} className="oh-row"><span className="oh-ic" style={{ transform: `rotate(${(a.track || 0) - 45}deg)` }}>✈︎</span><div className="grow"><b>{a.flight || a.reg || a.hex.toUpperCase()}</b><small>{[a.type, a.reg].filter(Boolean).join(" · ")}{r ? ` · ${r.origin?.iata_code}→${r.destination?.iata_code}*` : ""}</small></div><div className="right"><b>{a.nm} nm</b><small>{Math.round(+a.alt || 0).toLocaleString()} ft · {Math.round(a.gs || 0)} kt</small></div></div>; })}</div>
    {d && <div className="faint xs px mt8">Source: {d.source}. *The route comes from adsbdb.com's callsign database and can be wrong for some charter or alphanumeric callsigns. Military and blocked aircraft may not be shown.</div>}
  </div>;
}

export function Wrapped22({ x }: { x: any }) {
  const L = useMemo(() => load().filter(f => !f.friend && !f.example), []); const yrs = [...new Set(L.map(f => f.date.slice(0, 4)))].sort().reverse(); const [yr, setYr] = useState(yrs[0] || String(new Date().getFullYear()));
  const Y = L.filter(f => f.date.startsWith(yr)); const mi = Y.reduce((s, f) => s + dist(f.origin, f.destination), 0); const mins = Y.reduce((s, f) => s + estDurMin(f.origin, f.destination), 0);
  const top = (k: (f: Flight) => string | undefined) => { const m: Record<string, number> = {}; Y.forEach(f => { const v = k(f); if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]; };
  const aps: Record<string, number> = {}; Y.forEach(f => [f.origin?.iata, f.destination?.iata].forEach(c => c && (aps[c] = (aps[c] || 0) + 1))); const tAp = Object.entries(aps).sort((a, b) => b[1] - a[1])[0];
  const known = Y.filter(f => f.arr.actual && f.arr.scheduled); const ot = known.length ? Math.round(known.filter(f => (delay(f.arr) || 0) < 15).length / known.length * 100) : null;
  const lng = [...Y].sort((a, b) => dist(b.origin, b.destination) - dist(a.origin, a.destination))[0]; const ctry = new Set(Y.flatMap(f => [f.origin?.country, f.destination?.country]).filter(Boolean));
  const C = (cls: string, k: string, big: any, sub: string) => <div className={"wr-card " + cls}><small>{k}</small><b>{big}</b><span>{sub}</span></div>;
  return <div className="v22-page"><div className="v22-top"><div><h1>{yr} Wrapped</h1><span>Your year in flights · worked out on this device</span></div>{x}</div>
    {yrs.length > 1 && <div className="row g8 px wrap">{yrs.map(y => <button key={y} className={"chip " + (y === yr ? "on" : "")} onClick={() => setYr(y)}>{y}</button>)}</div>}
    {!Y.length ? <div className="v22-empty">No flights saved for {yr} yet. Track or import flights and your recap builds itself.</div> : <div className="wr-stack">
      {C("g1", "You flew", Y.length, `${Y.length === 1 ? "flight" : "flights"} in ${yr}`)}
      {C("g2", "Distance", `${Math.round(mi).toLocaleString()} mi`, `${(mi / 24901).toFixed(2)}× around the Earth`)}
      {C("g3", "Time in the air", `${Math.floor(mins / 60)}h ${mins % 60}m`, "Skyline estimate, worked out from distance")}
      {top(f => f.airline?.name) && C("g4", "Top airline", top(f => f.airline?.name)![0], `${top(f => f.airline?.name)![1]} flight${top(f => f.airline?.name)![1] === 1 ? "" : "s"}`)}
      {tAp && C("g5", "Home from home", tAp[0], `${tAp[1]} visit${tAp[1] === 1 ? "" : "s"}`)}
      {lng && C("g6", "Longest flight", `${lng.origin?.iata} → ${lng.destination?.iata}`, `${Math.round(dist(lng.origin, lng.destination)).toLocaleString()} mi · ${lng.number} · ${fmtD(lng.date)}`)}
      {C("g1", "Countries", ctry.size, [...ctry].slice(0, 6).join(", "))}
      {C("g2", "On time", ot == null ? "—" : `${ot}%`, ot == null ? "No actual arrival times recorded" : `arrived <15 min late · ${known.length} flights with times`)}
    </div>}</div>;
}

export function Connections22({ flights, x }: { flights: Flight[]; x: any }) {
  const mine = flights.filter(f => !f.friend && !f.example); const auto = connections(mine); const [a, setA] = useState(""); const [b, setB] = useState("");
  const A = mine.find(f => f.id === a), B = mine.find(f => f.id === b);
  const man = A && B ? (() => { const arr = best(withEstArr(A).arr), dep = best(B.dep); if (!arr || !dep) return null; const buf = Math.round((+new Date(dep) - +new Date(arr)) / 60000); const intl = A.origin?.country !== B.destination?.country; const mct = intl ? 75 : 50; return { a: A, b: B, buf, mct, risk: buf < 0 ? "missed" : buf < mct ? "high" : buf < mct + 30 ? "tight" : "ok", same: A.destination?.iata === B.origin?.iata }; })() : null;
  const Row = (c: any) => <div key={c.a.id + c.b.id} className={"cx-row " + c.risk}><div className="cx-legs"><b>{c.a.number}</b> {c.a.origin?.iata} → <b>{c.a.destination?.iata}</b> → {c.b.destination?.iata} <b>{c.b.number}</b></div>
    <div className="cx-bar"><i style={{ width: `${Math.max(4, Math.min(100, c.buf / (c.mct * 2) * 100))}%` }} /><s style={{ left: `${50}%` }} /></div>
    <div className="cx-meta"><b>{c.buf < 0 ? `Missed by ${-c.buf} min` : `${Math.floor(c.buf / 60)}h ${c.buf % 60}m layover`}</b><span>{c.risk === "ok" ? "Comfortable" : c.risk === "tight" ? "Tight, keep moving" : c.risk === "high" ? "High risk" : "Missed"} · typical minimum {c.mct} min (general guidance, not the airport's official MCT)</span>{c.same === false && <span className="bad">Different airports: allow a transfer</span>}</div></div>;
  return <div className="v22-page"><div className="v22-top"><div><h1>Connections</h1><span>Uses live times: the estimated arrival vs the next departure</span></div>{x}</div>
    <div className="v22-sh px"><span>Found in your flights</span></div>{auto.length ? auto.map(Row) : <div className="v22-empty">No connecting flights found. A connection is when one flight lands where the next one departs within 24h.</div>}
    <div className="v22-sh px"><span>Check any two flights</span></div>
    <div className="px cx-pick"><select value={a} onChange={e => setA(e.target.value)}><option value="">First flight…</option>{mine.map(f => <option key={f.id} value={f.id}>{f.number} {f.origin?.iata}→{f.destination?.iata} {f.date}</option>)}</select>
      <select value={b} onChange={e => setB(e.target.value)}><option value="">Then…</option>{mine.map(f => <option key={f.id} value={f.id}>{f.number} {f.origin?.iata}→{f.destination?.iata} {f.date}</option>)}</select></div>
    {man ? Row(man) : A && B && <div className="v22-empty">One of these flights has no times yet.</div>}</div>;
}

// v31: real ACARS/VDL2 messages (airframes.io community feed) — shown only as received, never synthesised.
export function Acars({ hex, reg, conf }: { hex?: string; reg?: string; conf?: string }) { const [r, sr] = useState<any>(null); const [all, sa] = useState(false);
  useEffect(() => { if (!hex) return; let on = true; const go = () => api(`/acars/${hex}`).then(x => on && sr(x)).catch(e => on && sr({ error: e.message, messages: [] })); go(); const t = setInterval(go, 120e3); return () => { on = false; clearInterval(t); }; }, [hex]);
  const ms = (r?.messages || []) as any[]; const txt = ms.filter(m => m.text); const shown = all ? ms : txt.length ? txt : ms.slice(0, 6);
  return <div className="acars card"><div className="row between"><b>ACARS messages</b><span className="faint sm">{reg || hex?.toUpperCase() || ""}</span></div>
    {!hex ? <div className="muted sm mt4">ACARS can be looked up once the exact aircraft (its Mode-S hex) is identified. Not identified yet for this flight.</div>
    : !r ? <div className="skel mt8" style={{ height: 60 }} />
    : r.error ? <div className="muted sm mt4">Couldn't reach the Airframes.io feed right now ({r.error}).</div>
    : !ms.length ? <div className="muted sm mt4">No ACARS/VDL2 messages from {reg || hex.toUpperCase()} in the latest 60 frames Airframes.io holds. Coverage depends on volunteer ground stations nearby.</div>
    : <><div className="faint sm mt4">{ms.length} recent frames · {txt.length} with text{conf && conf !== "confirmed" ? " · aircraft match is a Skyline estimate" : ""}</div>
      <div className="acars-list">{shown.map((m, i) => <div key={i} className="acars-m"><div className="row between sm"><b>{new Date(m.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} <span className={"acars-dir " + m.dir}>{m.dir === "down" ? "↓ from aircraft" : "↑ to aircraft"}</span></b><span className="faint">{m.label ? m.label + " · " : ""}{m.labelText}</span></div>
        {m.text ? <pre>{m.text.length > 600 ? m.text.slice(0, 600) + "…" : m.text}</pre> : <div className="faint xs">No text payload (link-layer / ack)</div>}<div className="faint xs">{[m.flight, m.kind?.toUpperCase(), m.freq && m.freq + " MHz", m.station && "station " + m.station].filter(Boolean).join(" · ")}</div></div>)}</div>
      {!all && ms.length > shown.length && <button className="secondary mt8" onClick={() => sa(true)}>Show all {ms.length} frames</button>}</>}
    <div className="faint xs mt8">Source: <a href={`https://app.airframes.io/airframes?icao=${hex || ""}`} target="_blank" rel="noreferrer">Airframes.io</a> community ACARS/VDL2 feed — real received messages, shown raw. Labels are decoded from the standard ARINC 618 label list; payloads are airline-specific.</div></div>; }
// v31: real transponder (Mode-S/ADS-B) state, separate from ACARS.
const SQ: Record<string, string> = { "7500": "Unlawful interference", "7600": "Radio failure", "7700": "General emergency", "7000": "VFR conspicuity (EU)", "2000": "Entering SSR area", "1200": "VFR (US)" };
function Xpdr({ lv, hex }: { lv: any; hex: string }) { if (!lv) return <div className="acars card"><b>Transponder</b><div className="muted sm mt4">{hex.toUpperCase()} is not broadcasting on ADS-B right now.</div></div>; const sq = lv.squawk ? String(lv.squawk) : ""; const em = /^7[56]00$|^7700$/.test(sq) || (lv.emergency && lv.emergency !== "none");
  return <div className={"acars card" + (em ? " em" : "")}><div className="row between"><b>Transponder (ADS-B)</b><span className="faint sm">live</span></div><div className="xp-grid">
    <div><label>Squawk</label><b>{sq || "—"}</b>{SQ[sq] && <small>{SQ[sq]}</small>}</div><div><label>Altitude</label><b>{lv.alt === "ground" ? "Ground" : typeof lv.alt === "number" ? Math.round(lv.alt).toLocaleString() + " ft" : "—"}</b></div>
    <div><label>Ground speed</label><b>{lv.gs ? Math.round(lv.gs) + " kt" : "—"}</b></div><div><label>Vertical</label><b>{typeof lv.vr === "number" ? (lv.vr > 0 ? "+" : "") + Math.round(lv.vr) + " fpm" : typeof lv.baro_rate === "number" ? Math.round(lv.baro_rate) + " fpm" : "—"}</b></div></div>
    {em && <div className="sm mt4" style={{ color: "var(--red)" }}>Emergency code broadcast: {SQ[sq] || lv.emergency}</div>}<div className="faint xs mt4">Directly from the aircraft's transponder via adsb.lol / adsb.fi.</div></div>; }
