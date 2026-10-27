import { useEffect, useMemo, useRef, useState } from "react";
import { api, best, delay, dist, dur, estDurMin, fmtT, fmtD, today, download, withEstArr, type Flight } from "./lib";
import { useFlightPhoto } from "./livery";
import { AirlineTile } from "./brand";
import { exportIcs } from "./assist";
import { Ic, SecHead, StatTile, ActBtn } from "./v25";
// A flight is "tracked" (finished) once it landed >20 min ago, was cancelled, or its date has passed while not airborne.
// A flight belongs in Tracked once it has finished: official "landed" + 20 min, ADS-B on the ground near the destination,
// or (if the feed never confirmed) 20 min past its arrival time (60 min if that arrival is only a Skyline block-time estimate).
export const isTracked = (f: Flight) => { const a: any = withEstArr(f).arr || {}; const t = a.actual || a.estimated || a.scheduled; const now = Date.now();
  if (f.status === "landed") return !t || now - +new Date(t) > 20 * 60e3; if (f.status === "cancelled" || f.status === "diverted") return f.date < today();
  const lv: any = (f as any).live; if (lv && lv.onGround && f.destination?.lat != null && Math.hypot(lv.lat - f.destination.lat, lv.lon - (f.destination.lon ?? 0)) < 0.3 && now - (lv.at || 0) < 3600e3) return true;
  if (t && now - +new Date(t) > (a.estimatedOnly ? 60 : 20) * 60e3) return true;
  return f.date < today() && !["departed", "enroute"].includes(f.status || ""); };
// Migration/normaliser: a departed flight whose arrival time is long past without a "landed" update is shown as "Landed (est.)".
export const finishStale = (f: Flight): Flight => { if (!["departed", "enroute", "boarding", "gate", "scheduled", "delayed", "unknown", ""].includes(f.status || "")) return f;
  const a: any = withEstArr(f).arr || {}; const t = a.actual || a.estimated || a.scheduled; if (!t || Date.now() - +new Date(t) < (a.estimatedOnly ? 60 : 20) * 60e3) return f;
  if (!f.dep?.actual && !["departed", "enroute"].includes(f.status || "")) return f; return { ...f, status: "landed", statusText: "Landed (est.)", staleInferred: true }; };
const mins = (f: Flight) => { const g = withEstArr(f); const a = f.arr.actual || best(g.arr), d = f.dep.actual || best(f.dep); return a && d ? Math.max(0, (+new Date(a) - +new Date(d)) / 60000) : estDurMin(f.origin, f.destination) || 0; };
const tm = (k: string, d: any, a: any, f: Flight) => { const x = (t: any, tz: any) => t ? fmtT(t, tz) : "?"; return d || a ? `${k} ${x(d, f.origin?.tz)}–${x(a, f.destination?.tz)}` : ""; };
const CC: Record<string, string> = {};
function Row({ f, open, del }: { f: Flight; open: () => void; del: () => void }) {
  const ph = useFlightPhoto(f, !f.example); const x0 = useRef<number | null>(null); const [dx, setDx] = useState(0); const dl = delay(f.arr) ?? delay(f.dep);
  return <div className="trk-wrap">{dx < 0 && <button className="trk-del" onClick={del}>Delete</button>}
    <div className="trk card press" style={{ transform: `translateX(${dx}px)` }} onClick={() => dx ? setDx(0) : open()}
      onTouchStart={e => x0.current = e.touches[0].clientX} onTouchMove={e => { if (x0.current != null) setDx(Math.min(0, Math.max(-96, e.touches[0].clientX - x0.current))); }} onTouchEnd={() => { setDx(d => d < -48 ? -96 : 0); x0.current = null; }}>
      {ph?.src ? <img className="trk-ph" src={ph.src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="trk-ph none"><AirlineTile a={f.airline} className="card-tile" mode="colour" style={{ width: 52, height: 22 }} /><span>{f.aircraft?.model || f.airline?.name || ""}</span></div>}
      <div className="trk-b"><div className="row between"><b>{f.origin?.iata} → {f.destination?.iata}</b><span className={"trk-dl " + (f.status === "cancelled" ? "bad" : dl == null ? "" : dl >= 15 ? "bad" : dl >= 5 ? "warn" : "ok")}>{f.status === "cancelled" ? "Cancelled" : dl == null ? "—" : dl >= 5 ? `+${dur(dl)}` : "On time"}</span></div>
        <div className="row g8 trk-s"><AirlineTile a={f.airline} className="card-tile" mode="colour" style={{ width: 40, height: 18 }} /><span>{f.number} · {fmtD(f.date, { weekday: "short", day: "numeric", month: "short" })}</span></div>
        <div className="trk-t">{tm("Sched", f.dep.scheduled, f.arr.scheduled, f)}{f.dep.actual || f.arr.actual ? " · " + tm("Actual", f.dep.actual, f.arr.actual, f) : ""}</div>
        <div className="trk-t">{[f.aircraft?.model, f.aircraft?.reg, `${Math.round(dist(f.origin, f.destination)).toLocaleString()} mi`].filter(Boolean).join(" · ")}</div></div></div></div>; }
export function Tracked({ flights, setFlights, open }: { flights: Flight[]; setFlights: (f: any) => void; open: (f: Flight) => void }) {
  const [cc, setCc] = useState<Record<string, string>>(CC);
  useEffect(() => { const need = [...new Set(flights.flatMap(f => [f.origin, f.destination]).filter((a: any) => a?.iata && !a.country && !CC[a.iata]).map((a: any) => a.iata))];
    if (need.length) Promise.all(need.map(i => api("/airport/" + i).then((r: any) => { if (r?.country) CC[i] = r.country; }).catch(() => {}))).then(() => setCc({ ...CC })); }, [flights.length]);
  const L = useMemo(() => flights.filter(isTracked).sort((a, b) => (best(a.dep) || a.date) < (best(b.dep) || b.date) ? 1 : -1), [flights]);
  const s = useMemo(() => { let mi = 0, mn = 0, ot = 0, n = 0; const ap = new Set<string>(), al = new Set<string>(), co = new Set<string>(); let lg: Flight | null = null, lgd = 0;
    for (const f of L) { if (f.status === "cancelled") continue; const d = dist(f.origin, f.destination); mi += d; mn += mins(f); if (d > lgd) { lgd = d; lg = f; }
      [f.origin, f.destination].forEach((a: any) => { if (a?.iata) ap.add(a.iata); const c = a?.country || cc[a?.iata]; if (c) co.add(c); }); if (f.airline?.iata || f.airline?.name) al.add(f.airline.iata || f.airline.name);
      const dl = delay(f.arr) ?? delay(f.dep); if (dl != null) { n++; if (dl < 15) ot++; } }
    return { mi, mn, ap: ap.size, al: al.size, co: co.size, lg, lgd, ot: n ? Math.round(ot / n * 100) : null, n }; }, [L, cc]);
  const groups: [string, Flight[]][] = []; for (const f of L) { const k = fmtD(f.date, { month: "long", year: "numeric" }); const g = groups.find(x => x[0] === k); g ? g[1].push(f) : groups.push([k, [f]]); }
  const exp = (kind: "csv" | "json") => kind === "json" ? download("skyline-tracked.json", JSON.stringify(L, null, 1), "application/json")
    : download("skyline-tracked.csv", ["date,flight,airline,from,to,sched_dep,act_dep,sched_arr,act_arr,delay_min,aircraft,reg,miles", ...L.map(f => [f.date, f.number, f.airline?.name || "", f.origin?.iata, f.destination?.iata, f.dep.scheduled || "", f.dep.actual || "", f.arr.scheduled || "", f.arr.actual || "", delay(f.arr) ?? "", f.aircraft?.model || "", f.aircraft?.reg || "", Math.round(dist(f.origin, f.destination))].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"), "text/csv");
  return <><div className="head"><div><h1>Tracked</h1><div className="sub">Every flight you've finished, in one logbook</div></div></div>
    <div className="sk-hero"><div className="sk-hero-top"><div><b className="sk-hero-n">{L.length}</b><span>flights tracked</span></div><span className="sk-hero-ic">{Ic.check}</span></div>
      {s.lg && <div className="sk-hero-long"><span>{Ic.route}</span><div><small>Longest flight</small><b>{s.lg.origin?.iata} → {s.lg.destination?.iata}</b></div><em>{Math.round(s.lgd).toLocaleString()} mi · {s.lg.number}</em></div>}</div>
    <div className="sk-stats">{([[Ic.route, "Distance", `${Math.round(s.mi).toLocaleString()} mi`], [Ic.clock, "In the air", dur(s.mn)], [Ic.tower, "Airports", s.ap], [Ic.plane, "Airlines", s.al], [Ic.globe, "Countries", s.co], [Ic.gauge, "On-time", s.ot == null ? "—" : `${s.ot}%`, s.ot == null ? "" : s.ot >= 80 ? "good" : s.ot >= 60 ? "warn" : "bad"]] as any[]).map(([ic, k, v, t]) => <StatTile key={k} ic={ic} k={k} v={v} tone={t} />)}</div>
    {s.ot != null && <div className="sk-foot">{Ic.info}<span>On-time = arrived under 15 min late, over {s.n} flights with known times. Same flights feed Passport; nothing is stored twice.</span></div>}
    {!L.length ? <div className="empty16"><div className="e-ic">{Ic.check}</div><b>No tracked flights yet</b><span>When a flight you follow lands (or its date passes), it moves here automatically with its times, delay, aircraft and distance.</span></div>
      : <>{groups.map(([k, fs]) => <div key={k}><SecHead ic={Ic.cal} title={k} sub={`${fs.length} flight${fs.length > 1 ? "s" : ""}`} />{fs.map(f => <Row key={f.id} f={f} open={() => open(f)} del={() => confirm(`Delete ${f.number} on ${f.date}?`) && setFlights((l: Flight[]) => l.filter(x => x.id !== f.id))} />)}</div>)}
        <SecHead ic={Ic.download} title="Export logbook" /><div className="sk-acts three"><ActBtn ic={Ic.doc} onClick={() => exp("csv")}>CSV</ActBtn><ActBtn ic={Ic.db} onClick={() => exp("json")}>JSON</ActBtn><ActBtn ic={Ic.cal} onClick={() => exportIcs(L)}>Calendar</ActBtn></div></>}
    <div style={{ height: 170 }} /></>; }
