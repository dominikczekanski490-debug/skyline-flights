import { Livery } from "./livery";
// Day-of features: next-flight live card, "is my plane here", flight facts, global search, airport (day-of) mode.
import { useEffect, useState } from "react";
import { api, fmtT, best, delay, dur, dist, estDurMin, lateLabel, lateColor, today, withEstArr, wxIcon, type Flight } from "./lib";
import { I } from "./ui";

const zoneOf = (f: any) => (f.statusText || "").match(/(check-in )?zone\s+([A-Z0-9]+)/i)?.[2]?.toUpperCase() || null;
const ago = (ms: number) => ms > 0 ? dur(ms / 60000) : "now";
export function leavePlan(f: Flight) { const s = f.dep.scheduled; if (!s) return null; const sh = Math.max(0, delay(f.dep) ?? 0); const long = dist(f.origin, f.destination) > 2500 || estDurMin(f.origin, f.destination) > 300;
  const travel = +(localStorage.getItem("sk.travel") || 45); const dep = +new Date(s) + sh * 6e4; const at = dep - (long ? 180 : 120) * 6e4; return { dep, at, leave: at - travel * 6e4, gateClose: dep - 30 * 6e4, boarding: dep - (long ? 50 : 35) * 6e4, long, travel, shift: sh }; }
export function phaseOf(f: Flight) { const st = f.status || ""; if (st === "cancelled") return "cancelled"; if (st === "landed") return "landed"; if (["departed", "enroute"].includes(st)) return "air"; if (st === "diverted") return "diverted"; return "pre"; }

export function NextHero({ f, open, dayof, noMode }: { f: Flight; open: () => void; dayof: () => void; noMode?: boolean }) {
  const [, t] = useState(0); useEffect(() => { const i = setInterval(() => t(n => n + 1), 30e3); return () => clearInterval(i); }, []);
  const g = withEstArr(f); const ph = phaseOf(f); const p = leavePlan(f); const tz = f.origin?.tz, atz = f.destination?.tz; const now = Date.now(); const dd = delay(f.dep);
  const depAt = best(f.dep) ? +new Date(best(f.dep)!) : 0, arrAt = best(g.arr) ? +new Date(best(g.arr)!) : 0;
  const big = ph === "pre" ? (depAt > now ? "Departs in " + ago(depAt - now) : "Due to depart") : ph === "air" ? (arrAt > now ? "Lands in " + ago(arrAt - now) : "Landing now") : ph === "landed" ? "Landed " + fmtT(f.arr.actual || best(g.arr), atz) : ph === "cancelled" ? "Cancelled" : "Diverted";
  const next = ph !== "pre" || !p ? null : now < p.leave ? ["Leave by", p.leave] : now < p.boarding ? ["Boarding about", p.boarding] : now < p.gateClose ? ["Gate closes about", p.gateClose] : null;
  const cells: [string, string | null | undefined][] = ph === "landed" || ph === "air" ? [["Terminal", f.arr.terminal], ["Belt", f.arr.baggage], ["Arrives", fmtT(best(g.arr), atz)]] : [["Terminal", f.dep.terminal], ["Gate", f.dep.gate || (f.statusText || "").match(/gate\s+([A-Z]?\d+[A-Z]?)/i)?.[1]], ["Zone", zoneOf(f)], ["Departs", fmtT(best(f.dep), tz)]];
  return <div className={"hero rise " + ph} onClick={open}>
    <div className="row between"><span className="hk">NEXT FLIGHT · {f.number}</span><span className="hk" style={{ color: lateColor(dd) }}>{ph === "pre" ? (lateLabel(dd) || "On time") : f.statusText || ""}</span></div>
    <div className="hbig">{big}</div><div className="hroute"><b>{f.origin?.iata}</b> {f.origin?.city} <span className="faint">→</span> <b>{f.destination?.iata}</b> {f.destination?.city}</div>
    <div className="hcells">{cells.map(([k, v]) => <div key={k}><label>{k}</label><b>{v || "—"}</b></div>)}</div>
    {next && <div className="hnext">{next[0]} <b>{fmtT(new Date(next[1] as number).toISOString(), tz)}</b><span className="faint"> · estimate</span></div>}
    {ph === "pre" && !noMode && <button className="chip blue mt8" onClick={e => { e.stopPropagation(); dayof(); }}>{I.plane} Airport mode</button>}</div>;
}

export function PlaneHere({ f, hex, reg }: { f: Flight; hex?: string; reg?: string }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { if (!hex && !reg) return; let on = true; const go = () => api(`/plane-here?hex=${hex || ""}&reg=${reg || ""}&at=${f.origin?.iata || ""}`).then(r => { on && (setD(r), setErr("")); }).catch(e => on && setErr(e.message)); go(); const i = setInterval(go, 240e3); const v = () => document.visibilityState === "visible" && go(); document.addEventListener("visibilitychange", v); return () => { on = false; clearInterval(i); document.removeEventListener("visibilitychange", v); }; }, [hex, reg]);
  if (!hex && !reg) return <div className="card"><h3>Is my plane here yet?</h3><div className="muted sm">No aircraft assigned to {f.number} yet. Airlines usually assign one a few hours before departure; this fills in automatically.</div></div>;
  const pre = phaseOf(f) === "pre";
  return <div className="card"><div className="row between"><h3 className="m0">Is my plane here yet?</h3><span className="srcb live">ADS-B</span></div>
    <div className="muted sm">{reg || hex}{d?.type ? " · " + d.type : ""}</div>
    <div className="mt8"><Livery small code={f.airline?.iata} icao={f.airline?.icao} name={f.airline?.name} type={d?.type || f.aircraft?.model} reg={reg} /></div>
    {err ? <div className="note warn">{err}</div> : !d ? <div className="faint sm mt8">Looking for the aircraft…</div> : !d.seen ? <div className="mt8"><b>Not visible right now</b><div className="faint sm">{d.note}</div></div>
      : <div className="mt8"><b className={d.here ? "green" : ""}>{d.here ? `Yes. It is on the ground at ${f.origin?.iata}.` : d.onGround ? `On the ground ${d.km} km from ${f.origin?.iata}` : `Airborne, ${d.km?.toLocaleString()} km from ${f.origin?.iata}`}</b>
        <div className="faint sm">{d.callsign ? `Currently flying as ${d.callsign}` : ""}{typeof d.alt === "number" ? ` · ${Math.round(d.alt / 100) * 100} ft · ${Math.round(d.gs || 0)} kt` : ""} · {d.src}{d.seenSec != null ? `, seen ${Math.round(d.seenSec)} s ago` : ""}</div>
        {pre && !d.here && !d.onGround && d.km != null && d.gs > 100 && <div className="sm mt8">At its current speed it would reach {f.origin?.iata} in about {dur(d.km / (d.gs * 1.852) * 60)} (straight-line, rough).</div>}</div>}</div>;
}

export function Facts({ f, ac }: { f: Flight; ac?: any }) {
  const g = withEstArr(f); const mi = dist(f.origin, f.destination); const row = (l: string, t: any, tz?: string) => <tr><th>{l}</th><td>{fmtT(t.scheduled, tz)}</td><td>{t.estimated ? fmtT(t.estimated, tz) : "—"}</td><td>{t.actual ? fmtT(t.actual, tz) : "—"}</td><td style={{ color: lateColor(delay(t)) }}>{delay(t) != null ? (delay(t)! > 0 ? "+" : "") + delay(t) + "m" : "—"}</td></tr>;
  const block = f.dep.actual && f.arr.actual ? (+new Date(f.arr.actual) - +new Date(f.dep.actual)) / 6e4 : f.dep.scheduled && f.arr.scheduled ? (+new Date(f.arr.scheduled) - +new Date(f.dep.scheduled)) / 6e4 : null;
  const kv: [string, any][] = [["Dep terminal", f.dep.terminal], ["Dep gate", f.dep.gate], ["Check-in zone", zoneOf(f)], ["Arr terminal", f.arr.terminal], ["Baggage belt", f.arr.baggage], ["Aircraft", ac?.type || f.aircraft?.model], ["ICAO type", ac?.icaoType], ["Registration", ac?.reg || f.aircraft?.reg], ["Operator", ac?.owner], ["Distance", mi ? `${mi.toLocaleString()} mi · ${Math.round(mi * 1.609).toLocaleString()} km` : null], [f.dep.actual && f.arr.actual ? "Actual flight time" : "Scheduled block", block ? dur(block) : null], ["Feed status", f.statusText]];
  return <div className="card facts"><h3>Flight details</h3><table className="ftab"><thead><tr><th /><th>Sched</th><th>Est</th><th>Actual</th><th>Delay</th></tr></thead><tbody>{row("Dep " + (f.origin?.iata || ""), f.dep, f.origin?.tz)}{row("Arr " + (f.destination?.iata || ""), g.arr, f.destination?.tz)}</tbody></table>
    <div className="kvg mt8">{kv.map(([k, v]) => <div key={k}><label>{k}</label><b>{v || "—"}</b></div>)}</div>
    <div className="faint sm mt8">Local times at each airport. A dash means the source has not published it. Aircraft age is not in any free source, so it is not shown.</div></div>;
}

export function GlobalSearch({ push, onFlight }: { push: (o: any) => void; onFlight: (f: any) => void }) {
  const [q, setQ] = useState(""); const [ap, setAp] = useState<any[]>([]); const [al, setAl] = useState<any[]>([]); const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const Q = q.trim().toUpperCase().replace(/\s/g, "");
  const isFl = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(Q) && /\d/.test(Q.slice(2)), isReg = /^([A-Z]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2})$/.test(Q);
  useEffect(() => { setErr(""); if (q.trim().length < 2) { setAp([]); setAl([]); return; } const t = setTimeout(() => { api("/airports/search?q=" + encodeURIComponent(q.trim())).then(r => setAp((r || []).slice(0, 4))).catch(() => setAp([])); api("/airlines/search?q=" + encodeURIComponent(q.trim())).then(r => setAl((r || []).slice(0, 3))).catch(() => setAl([])); }, 250); return () => clearTimeout(t); }, [q]);
  const fl = async () => { setBusy("f"); setErr(""); try { const r = await api(`/flight/${Q}?date=${today()}`); if (r.flight) onFlight({ ...r.flight, date: today() }); else setErr(`No ${Q} found today.`); } catch (e: any) { setErr(e.message); } setBusy(""); };
  return <div className="gsearch"><div className="gsin">{I.search}<input placeholder="Flight, airport, airline or registration" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && isFl && fl()} />{q && <button aria-label="Clear" onClick={() => setQ("")}>×</button>}</div>
    {q.trim().length >= 2 && <div className="gsres">
      {isFl && <div className="gsr press" onClick={fl}><b>{Q}</b><span className="muted sm">{busy ? "Looking up…" : "Track flight " + Q + " today"}</span></div>}
      {isReg && <div className="gsr press" onClick={() => push({ t: "tools", id: "ac" })}><b>{Q}</b><span className="muted sm">Look up aircraft registration</span></div>}
      {ap.map(a => <div key={a.iata} className="gsr press" onClick={() => push({ t: "board", iata: a.iata })}><b>{a.iata}</b><span className="muted sm">{a.name} · departures &amp; arrivals</span></div>)}
      {al.map(a => <div key={a.iata || a.icao} className="gsr"><b>{a.iata || a.icao}</b><span className="muted sm">{a.name}{a.callsign ? ` · callsign ${a.callsign}` : ""}. Type a flight number such as {(a.iata || "XX") + "123"}</span></div>)}
      {err && <div className="faint sm">{err}</div>}{!isFl && !isReg && !ap.length && !al.length && <div className="faint sm">No matches yet</div>}</div>}</div>;
}

export function DayOf({ f, push, x }: { f: Flight; push: (o: any) => void; x: any }) {
  const [sec, setSec] = useState<any>(null); const [wx, setWx] = useState<any[]>([]); const [bd, setBd] = useState<any>(null);
  const o = f.origin; const p = leavePlan(f); const tz = o?.tz;
  useEffect(() => { if (!o?.iata) return; api(`/security/${o.iata}`).then(setSec).catch(() => setSec({ available: false }));
    Promise.all([o, f.destination].map((a: any) => a?.lat ? api(`/weather?lat=${a.lat}&lon=${a.lon}`).catch(() => null) : null)).then(setWx);
    api(`/board/${o.iata}?dir=dep&date=${f.date}`).then(setBd).catch(() => setBd({ flights: [] })); }, [f.id]);
  const mine = bd?.flights?.find((x: any) => x.number.replace(/\s/g, "") === f.number.replace(/\s/g, ""));
  const steps: [string, number | null, string][] = p ? [["Leave for the airport", p.leave, `${dur(p.travel)} travel (set in Leave card)`], ["Arrive at the airport", p.at, `${p.long ? 3 : 2}h before departure`], ["Boarding (typical)", p.boarding, "Airline times vary"], ["Gate closes (typical)", p.gateClose, "30 min before departure"], ["Departure" + (p.shift ? " (delayed)" : ""), p.dep, p.shift ? `+${p.shift} min published delay` : "Scheduled"]] : [];
  const cw = (w: any) => w?.current ? `${wxIcon(w.current.weather_code)} ${Math.round(w.current.temperature_2m)}°C · ${Math.round(w.current.wind_speed_10m)} wind` : "—";
  return <div className="fd"><div className="head"><div><span className="tag">AIRPORT MODE</span><h1 className="h1s">{f.number} · {o?.iata}</h1><div className="muted sm">{o?.name}</div></div>{x}</div>
    <NextHero f={f} open={() => push({ t: "flight", f })} dayof={() => {}} noMode />
    <div className="card"><h3>Today's plan</h3>{steps.map(([l, t, n]) => { const past = t != null && t < Date.now(); return <div key={l} className={"dstep " + (past ? "past" : "")}><i /><div className="grow"><b>{l}</b><div className="faint sm">{n}</div></div><b>{t ? fmtT(new Date(t).toISOString(), tz) : "—"}</b></div>; })}
      {!steps.length && <div className="faint sm">No scheduled time yet.</div>}<div className="faint sm mt8">Estimates. Always follow your airline's times.</div></div>
    <div className="card"><h3>At {o?.iata} right now</h3>
      <div className="kvg"><div><label>Board status</label><b>{mine?.statusText || (bd ? "Not on today's board" : "Loading…")}</b></div><div><label>Terminal / Gate</label><b>{(mine?.dep?.terminal || f.dep.terminal || "—") + " / " + (mine?.dep?.gate || f.dep.gate || "—")}</b></div>
        <div><label>Security queue</label><b>{!sec ? "Loading…" : sec.available ? sec.queues.filter((q: any) => q.kind === "Departures").map((q: any) => `${q.terminal} ${q.text}`).join(" · ") || "—" : "No live data for " + o?.iata}</b></div><div><label>Weather</label><b>{cw(wx[0])}</b></div></div>
      <div className="row g8 mt8 wrap"><button className="chip blue" onClick={() => push({ t: "board", iata: o?.iata })}>{o?.iata} departures board</button><button className="chip" onClick={() => push({ t: "flight", f })}>Full flight details</button></div></div>
    <PlaneHere f={f} hex={(f as any).live?.hex || f.aircraft?.hex} reg={f.aircraft?.reg} />
    <div className="card"><h3>At {f.destination?.iata}</h3><div className="kvg"><div><label>Weather</label><b>{cw(wx[1])}</b></div><div><label>Arrival terminal</label><b>{f.arr.terminal || "—"}</b></div></div></div>
    <div style={{ height: 80 }} /></div>;
}
