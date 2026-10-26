import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, fmtT, best, delay, withEstArr, type Flight } from "./lib";
import { leavePlan } from "./big";
import { connections } from "./assist";
import { localNotify } from "./extras";

const mine = (L: Flight[]) => L.filter(f => !f.example && !f.friend);
const nextOf = (L: Flight[]) => mine(L).filter(f => f.status !== "landed" && f.status !== "cancelled").sort((a, b) => (best(a.dep) || a.date) < (best(b.dep) || b.date) ? -1 : 1)[0];
const ago = (iso?: string) => iso ? Math.round((Date.now() - +new Date(iso)) / 60000) : null;

// ---------- weather (METAR now + TAF summary) at both ends, and SIGMETs crossing the route ----------
const wxLine = (m: any) => !m ? null : `${m.temp != null ? Math.round(m.temp) + "°C" : ""}${m.wxString ? " · " + m.wxString : ""} · wind ${m.wdir === "VRB" ? "variable" : (m.wdir ?? "?") + "°"} ${m.wspd ?? "?"} kt${m.wgst ? " gust " + m.wgst : ""} · vis ${m.visib ?? "?"}${typeof m.visib === "number" ? " mi" : ""} · ${m.fltCat || ""}`;
const tafHaz = (raw?: string) => { if (!raw) return []; const h: string[] = []; if (/TS|CB/.test(raw)) h.push("thunderstorms possible"); if (/G([3-9]\d)KT/.test(raw)) h.push("strong gusts " + raw.match(/G([3-9]\d)KT/)![1] + " kt"); if (/\bFG\b|BR\b/.test(raw)) h.push("fog/mist"); if (/SN/.test(raw)) h.push("snow"); if (/FZ/.test(raw)) h.push("freezing precipitation"); return h; };
const inPoly = (pt: [number, number], P: { lat: number; lon: number }[]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.lat > pt[0]) !== (b.lat > pt[0]) && pt[1] < (b.lon - a.lon) * (pt[0] - a.lat) / (b.lat - a.lat) + a.lon) c = !c; } return c; };
const gc = (a: any, b: any, n = 24) => Array.from({ length: n + 1 }, (_, i) => [a.lat + (b.lat - a.lat) * i / n, a.lon + (b.lon - a.lon) * i / n] as [number, number]);
export function useRouteWx(f?: Flight) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { if (!f?.origin?.iata) return; let on = true; Promise.all([api("/wx/" + f.origin.iata).catch(() => null), f.destination?.iata ? api("/wx/" + f.destination.iata).catch(() => null) : null, api("/sigmets").catch(() => null)]).then(([o, t, s]) => {
    let sig: any[] = []; if (s && f.origin?.lat != null && f.destination?.lat != null) { const pts = gc(f.origin, f.destination); sig = [...(s.intl || []), ...(s.us || [])].filter((x: any) => { let C = x.coords; if (typeof C === "string") try { C = JSON.parse(C.replace(/'/g, '"')); } catch { C = null; } return Array.isArray(C) && C.length > 2 && pts.some(p => inPoly(p, C)); }); }
    on && setD({ o, t, sig }); }); return () => { on = false; }; }, [f?.id]);
  return d;
}
export function RouteWeather({ f }: { f: Flight }) {
  const d = useRouteWx(f); if (!d) return <div className="card"><h3>Weather on your route</h3><div className="skel" style={{ height: 70 }} /></div>;
  const row = (lab: string, w: any, ap: any) => { const m = w?.metar?.[0], t = w?.taf?.[0]; const hz = tafHaz(t?.rawTAF);
    return <div className="wx2"><div className="row between"><b>{lab} · {ap?.iata}</b>{m && <span className="faint xs">obs {ago(m.reportTime)} min ago</span>}</div>
      <div className="sm">{wxLine(m) || "No METAR from this airport right now."}</div>{hz.length > 0 && <div className="sm lt-bad">Forecast (TAF): {hz.join(", ")}</div>}{t && !hz.length && <div className="faint xs">TAF: no significant hazards forecast.</div>}</div>; };
  return <div className="card"><h3>Weather on your route</h3>{row("Departure", d.o, f.origin)}{row("Arrival", d.t, f.destination)}
    <div className="wx2"><b>En route</b><div className="sm">{d.sig.length ? d.sig.slice(0, 3).map((x: any) => `${x.hazard}${x.qual ? " (" + x.qual.toLowerCase() + ")" : ""} in ${x.fir || "FIR"}`).join("; ") : "No active international SIGMETs cross the straight-line route."}</div></div>
    <div className="faint xs mt8">METAR/TAF/SIGMET from aviationweather.gov (NOAA). Airlines route around hazards; this is context, not a prediction.</div></div>;
}

// ---------- Ask Skyline (rules over real data) ----------
type Msg = { me?: boolean; text?: string; card?: ReactNode; src?: string };
const SUG = ["Is my flight late?", "Where is my plane?", "What gate?", "When do I need to leave?", "Weather in Dublin?", "Will I make my connection?", "Other flights to my destination today?"];
async function answer(q: string, L: Flight[], ctx: { resolve: (f: Flight) => Promise<any> }): Promise<Msg[]> {
  const s = q.toLowerCase(); const num = q.toUpperCase().match(/\b([A-Z0-9]{2}\s?\d{1,4}[A-Z]?)\b/)?.[1]?.replace(/\s/g, "");
  const f = (num && mine(L).find(x => x.number === num)) || nextOf(L);
  const need = () => [{ text: "You don't have an upcoming flight saved. Add one with the search button and I can answer about it." }];
  if (/weather|rain|wind|snow|fog|temperature/.test(s)) { const m = s.match(/(?:in|at|for)\s+([a-z .'-]{3,})\??$/); let iata = f?.destination?.iata, name = f?.destination?.city;
    if (m) { const a = await api("/airports/search?q=" + encodeURIComponent(m[1].trim())).catch(() => []); if (a?.[0]) { iata = a[0].iata; name = a[0].city || a[0].name; } else return [{ text: `I couldn't find an airport for “${m[1].trim()}”.` }]; }
    if (!iata) return need(); const w = await api("/wx/" + iata).catch(() => null); const mt = w?.metar?.[0];
    if (!mt) return [{ text: `I don't have a current METAR for ${name} (${iata}).` }];
    const hz = tafHaz(w.taf?.[0]?.rawTAF); return [{ text: `${name} (${iata}) right now: ${wxLine(mt)}.${hz.length ? " Forecast: " + hz.join(", ") + "." : " No significant hazards in the TAF."}`, src: `METAR ${mt.icaoId}, ${ago(mt.reportTime)} min old · aviationweather.gov` }]; }
  if (/connect|connection|transfer|make it/.test(s)) { const C = connections(mine(L)); if (!C.length) return [{ text: "I don't see two of your saved flights that connect (one landing where the next leaves within 24 h)." }];
    return C.map(c => ({ text: `${c.a.number} → ${c.b.number} at ${c.a.destination?.iata}: ${Math.round(c.buf)} min between landing and departure (Skyline uses ${c.mct} min as a minimum). ${c.risk === "ok" ? "Looks comfortable." : c.risk === "tight" ? "Tight — move quickly." : c.risk === "high" ? "High risk of missing it — speak to your airline." : "On current times you'd miss it."}`, src: "Estimated arrival + scheduled/estimated departure · Skyline estimate" })); }
  if (!f) return need();
  if (/other flights|alternative|another flight|flights to/.test(s)) { const to = (s.match(/to\s+([a-z .'-]{3,})\??$/)?.[1] || "").trim(); let dest = f.destination?.iata;
    if (to && !/my destination/.test(to)) { const a = await api("/airports/search?q=" + encodeURIComponent(to)).catch(() => []); dest = a?.[0]?.iata || dest; }
    const b = await api(`/board/${f.origin?.iata}?dir=dep&date=${f.date}`).catch(() => null); const R = (b?.flights || []).filter((x: any) => !x.liveOnly && x.destination?.iata === dest && x.number !== f.number && best(x.dep) && +new Date(best(x.dep)!) > Date.now());
    return [{ text: R.length ? `Other ${f.origin?.iata} → ${dest} departures still to go on ${f.date}: ${R.slice(0, 5).map((x: any) => `${x.number} ${fmtT(best(x.dep), f.origin?.tz)}`).join(", ")}.` : `No more ${f.origin?.iata} → ${dest} departures on today's board.`, src: `${f.origin?.iata} departures board · seats/fares not public` }]; }
  if (/where.*plane|aircraft|coming from|inbound/.test(s)) { const a = await ctx.resolve(f); const i = a?.inbound;
    return [{ text: i ? `Your plane for ${f.number} is coming from ${i.from} as ${i.number} — ${i.arr?.actual ? "landed at " + fmtT(i.arr.actual, f.origin?.tz) : "due around " + fmtT(best(i.arr || {}), f.origin?.tz)}${a.reg ? ` (aircraft ${a.reg})` : ""}.` : a?.reg ? `${f.number} is aircraft ${a.reg}, but I don't know its previous flight yet.` : `The aircraft for ${f.number} isn't assigned yet — usually 2–3 h before departure.`, src: a?.how === "rotation" ? "Inbound rotation · Skyline estimate" : "Airport board + ADS-B" }]; }
  if (/gate|terminal|stand/.test(s)) return [{ text: f.dep?.gate ? `${f.number}: gate ${f.dep.gate}${f.dep.terminal ? ", terminal " + f.dep.terminal : ""}.` : `No gate for ${f.number} yet${f.dep?.terminal ? ` (terminal ${f.dep.terminal})` : ""}. Gates usually appear 30–60 min before boarding.`, src: f.source || "Airport board" }];
  if (/leave|get to the airport|set off/.test(s)) { const p = leavePlan(f); return [{ text: p ? `Leave by ${fmtT(new Date(p.leave).toISOString(), f.origin?.tz)} to reach ${f.origin?.iata} around ${fmtT(new Date(p.at).toISOString(), f.origin?.tz)} (${p.travel} min travel as set in the Leave card, arriving ${p.long ? 3 : 2} h before departure). I can't see live traffic — add margin at rush hour.` : "I don't have a departure time to plan from.", src: "Skyline estimate" }]; }
  if (/late|delay|on time|status|when.*(land|arrive)/.test(s)) { const d = delay(f.dep), g = withEstArr(f);
    return [{ text: `${f.number} ${f.origin?.iata}→${f.destination?.iata}: ${f.statusText || f.status || "scheduled"}. Departure ${fmtT(best(f.dep), f.origin?.tz)}${d != null && d >= 5 ? ` (${d} min late)` : d != null ? " (on time)" : " (no estimate published yet)"}, arrival ~${fmtT(best(g.arr), f.destination?.tz)}.`, src: (f.source || "Airport board") }]; }
  return [{ text: "I don't know how to answer that yet. I can tell you about delays, your plane, gates, when to leave, weather, connections and other flights." }];
}
export function AskSkyline({ flights, x }: { flights: Flight[]; x: ReactNode }) {
  const [M, setM] = useState<Msg[]>([{ text: "Hi! Ask me about your flights — I only answer from real data and say when I don't know." }]); const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null);
  const resolve = (f: Flight) => api(`/aircraft-for?number=${f.number}&date=${f.date}&o=${f.origin?.iata}&d=${f.destination?.iata || ""}`).catch(() => null);
  const ask = async (t: string) => { if (!t.trim()) return; setQ(""); setM(m => [...m, { me: true, text: t }]); setBusy(true); const r = await answer(t, flights, { resolve }).catch(e => [{ text: "Something went wrong: " + e.message }]); setM(m => [...m, ...r]); setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50); };
  return <div className="ask"><div className="head row between px"><h2>Ask Skyline</h2>{x}</div>
    <div className="ask-l px">{M.map((m, i) => <div key={i} className={"bub " + (m.me ? "bmine" : "")}>{m.text}{m.src && <div className="bub-src">Source: {m.src}</div>}</div>)}{busy && <div className="bub dots"><i /><i /><i /></div>}<div ref={end} /></div>
    <div className="ask-sug">{SUG.map(s => <button key={s} className="chip xs" onClick={() => ask(s)}>{s}</button>)}</div>
    <form className="row g8 px ask-in" onSubmit={e => { e.preventDefault(); ask(q); }}><input className="inp grow" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about your flight…" /><button className="primary">Ask</button></form></div>;
}

// ---------- proactive insights (delay trend, tight connections) ----------
export function useInsights(L: Flight[]) {
  useEffect(() => { const seen = JSON.parse(localStorage.getItem("sk.ins") || "{}"); let ch = false;
    for (const f of mine(L)) { const d = delay(f.dep) ?? 0; const k = f.id + ":d" + (d >= 60 ? 60 : d >= 30 ? 30 : d >= 15 ? 15 : 0); if (d >= 15 && !seen[k]) { seen[k] = 1; ch = true; localNotify(`${f.number} now ${d} min late`, `Departure ${fmtT(best(f.dep), f.origin?.tz)} from ${f.origin?.iata}. Source: ${f.source || "airport board"}`); } }
    for (const c of connections(mine(L))) { const k = c.a.id + ">" + c.b.id + ":" + c.risk; if (c.risk !== "ok" && !seen[k]) { seen[k] = 1; ch = true; localNotify(`Connection ${c.risk === "tight" ? "tight" : "at risk"}: ${c.a.number} → ${c.b.number}`, `${Math.round(c.buf)} min at ${c.a.destination?.iata} (Skyline estimate)`); } }
    if (ch) localStorage.setItem("sk.ins", JSON.stringify(seen)); }, [L.map(f => f.id + (f.dep?.estimated || "")).join()]);
}

// ---------- lock-screen style summary ----------
export function LockView({ flights, x }: { flights: Flight[]; x: ReactNode }) {
  const f = nextOf(flights); const [, t] = useState(0); useEffect(() => { const i = setInterval(() => t(n => n + 1), 1000); return () => clearInterval(i); }, []);
  if (!f) return <div className="lock"><div className="row between">{x}</div><div className="lk-c">No upcoming flights</div></div>;
  const dep = best(f.dep); const ms = dep ? +new Date(dep) - Date.now() : 0; const air = ms < 0; const g = withEstArr(f); const arr = best(g.arr); const tgt = air && arr ? +new Date(arr) - Date.now() : ms;
  const h = Math.floor(Math.abs(tgt) / 3600e3), m = Math.floor(Math.abs(tgt) % 3600e3 / 60e3), s2 = Math.floor(Math.abs(tgt) % 60e3 / 1000); const d = delay(f.dep);
  return <div className="lock"><div className="row between"><span className="faint sm">{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>{x}</div>
    <div className="lk-k">{air ? (f.status === "landed" ? "Landed" : "Lands in") : "Departs in"}</div>
    <div className="lk-c">{h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s2).padStart(2, "0")}`}</div>
    <div className="lk-r"><b>{f.origin?.iata}</b><span>✈︎ {f.number}</span><b>{f.destination?.iata}</b></div>
    <div className="lk-g"><div><small>Departs</small><b>{fmtT(dep, f.origin?.tz)}</b></div><div><small>Gate</small><b>{f.dep?.gate || "—"}</b></div><div><small>Terminal</small><b>{f.dep?.terminal || "—"}</b></div><div><small>Arrives</small><b>{fmtT(arr, f.destination?.tz)}</b></div></div>
    <div className={"lk-s " + (d != null && d >= 15 ? "bad" : "")}>{f.statusText || f.status || "Scheduled"}{d != null && d >= 5 ? ` · ${d} min late` : ""}</div>
    <div className="faint xs" style={{ textAlign: "center", marginTop: 14 }}>Tip: add Skyline to your Home Screen and keep this open for a glanceable countdown.</div></div>;
}
