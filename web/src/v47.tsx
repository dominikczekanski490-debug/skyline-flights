// v47 stage 2: sea & swim days, pollen & hay-fever rule, snow, earthquakes (USGS), airline facts (Wikidata), city-centre distance. Real sources; rules labelled.
import { useEffect, useState } from "react";
import { api, type Flight } from "./lib";
function useLazy(path: string | null, open: boolean) { const [d, setD] = useState<any>(null); const [e, setE] = useState("");
  useEffect(() => { if (open && !d && path) api(path).then(setD).catch(x => setE(x.message)); }, [open, path]); return { d, e }; }
const dayName = (s: string) => new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
// Swim rule (labelled in UI): sea ≥ 20 °C, max wave < 1 m, air max ≥ 22 °C, rain chance < 40 %.
const swim = (sst: number | null, x: any) => sst == null || x.wave == null ? null : sst >= 20 && x.wave < 1 && x.tmax >= 22 && x.rain < 40 ? "good" : sst >= 17 && x.wave < 1.5 ? "bracing" : "no";
const TREE = ["alder", "birch", "olive"];
const band = (k: string, v: number) => { const [m, h] = TREE.includes(k) ? [20, 100] : [10, 50]; return v >= h ? "high" : v >= m ? "moderate" : "low"; };
export function Outdoors({ f }: { f: Flight }) { const c = f.destination?.iata; const [open, setOpen] = useState(false); const { d, e } = useLazy(c ? `/outdoors/${c}` : null, open);
  if (!c) return null; const sea = d?.sea && d.sea.km != null && d.sea.km <= 30 ? d.sea : null;
  const rated = sea ? d.days.map((x: any) => ({ ...x, s: swim(sea.sst, x) })) : []; const best = rated.filter((x: any) => x.s === "good").sort((a: any, b: any) => b.tmax - a.tmax)[0];
  const pol = d?.pollen ? Object.entries(d.pollen as Record<string, number>).map(([k, v]) => ({ k, v, b: band(k, v) })) : []; const hi = pol.filter(p => p.b !== "low");
  return <details className="card m0 mt8 dg od" onToggle={ev => setOpen((ev.target as HTMLDetailsElement).open)}><summary><b>Outdoors · {f.destination?.city || c}</b><small> {open ? "tap to close" : "sea, swim days, pollen, snow"}</small></summary>
    {e ? <p className="sm bad">{e}</p> : !d ? <p className="muted sm">Loading from Open-Meteo…</p> : <div className="bl-g">
      <section><h4>Sea</h4>{sea ? <><p className="sm">Sea surface <b>{sea.sst.toFixed(1)} °C</b> · waves {sea.wave} m <span className="muted">(model cell {sea.km} km from the airport, {sea.at.slice(11)} local)</span></p>
        <div className="od-days">{rated.map((x: any) => <div key={x.date} className={"od-d " + x.s}><b>{dayName(x.date)}</b><small>{Math.round(x.tmax)}° · {x.rain}% rain</small><small>waves ≤{x.wave} m</small><span>{x.s === "good" ? "🏊 Swim day" : x.s === "bracing" ? "Bracing" : "Not ideal"}</span></div>)}</div>
        <p className="sm">{best ? <>Best swim day: <b>{dayName(best.date)}</b>.</> : "No day in the next 4 meets the swim rule."} <span className="muted">Rule: sea ≥ 20 °C, max wave &lt; 1 m, air ≥ 22 °C and rain chance &lt; 40 %. “Bracing”: sea ≥ 17 °C, waves &lt; 1.5 m.</span></p></> : <p className="sm muted">No sea within 30 km of the airport in the marine model.</p>}</section>
      <section><h4>Pollen now</h4>{pol.length ? <><p className="sm">{pol.map(p => `${p.k} ${Math.round(p.v)}`).join(" · ")} <span className="muted">grains/m³</span></p>
        <p className="sm">{hi.length ? <>🤧 Hay fever alert: {hi.map(p => `${p.k} ${p.b}`).join(", ")} — pack antihistamines.</> : "Pollen is low for every type measured."} <span className="muted">Rule: trees (alder, birch, olive) moderate ≥ 20, high ≥ 100; grass, mugwort, ragweed moderate ≥ 10, high ≥ 50 grains/m³.</span></p></> : <p className="sm muted">No pollen data — CAMS pollen covers Europe only.</p>}</section>
      {d.snowCm != null && <section><h4>Snow on the ground</h4><p className="sm">{d.snowCm > 0 ? <>❄️ <b>{d.snowCm} cm</b> lying at the airport now.</> : "No lying snow at the airport now."}</p></section>}
      <div className="faint xs">{d.source}. Model values, not observations; cached 3 h.</div></div>}
  </details>; }
export function Quakes({ f }: { f: Flight }) { const c = f.destination?.iata; const [open, setOpen] = useState(false); const { d, e } = useLazy(c ? `/quakes/${c}` : null, open);
  if (!c) return null;
  return <details className="card m0 mt8 dg eq" onToggle={ev => setOpen((ev.target as HTMLDetailsElement).open)}><summary><b>Earthquakes near {c}</b><small> {open ? "tap to close" : "last 30 days, within 300 km"}</small></summary>
    {e ? <p className="sm bad">{e}</p> : !d ? <p className="muted sm">Loading from USGS…</p> : <div className="bl-g">
      <p className="sm">{d.total ? <><b>{d.total}</b> quake{d.total > 1 ? "s" : ""} of magnitude {d.minMag}+ within {d.radiusKm} km in the last {d.days} days{d.total > d.quakes.length ? `; the ${d.quakes.length} strongest:` : ":"}</> : `None of magnitude ${d.minMag}+ within ${d.radiusKm} km in the last ${d.days} days.`}</p>
      {d.quakes.map((q: any) => <a key={q.url} className="row between sm eq-r" href={q.url} target="_blank" rel="noreferrer"><span><b>M{q.mag.toFixed(1)}</b> {q.place}{q.tsunami ? " · 🌊 tsunami flag" : ""}</span><span className="muted">{new Date(q.time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {q.km} km</span></a>)}
      <div className="faint xs">{d.source}. Distances are from the airport; cached 30 min.</div></div>}
  </details>; }
export function AirlineFacts({ f }: { f: Flight }) { const icao = f.airline?.icao || (/^[A-Z]{3}(?=\d)/.exec(f.number || "") || [])[0]; const [open, setOpen] = useState(false); const { d, e } = useLazy(icao ? `/airline-facts/${icao}` : null, open);
  if (!icao) return null;
  return <details className="card m0 mt8 dg af" onToggle={ev => setOpen((ev.target as HTMLDetailsElement).open)}><summary><b>About {f.airline?.name || icao}</b><small> {open ? "tap to close" : "founded, hubs, alliance"}</small></summary>
    {e ? <p className="sm bad">{e}</p> : !d ? <p className="muted sm">Loading from Wikidata…</p> : <div className="bl-g">
      {[["Founded", d.founded], ["Headquarters", d.hq], ["Parent", d.parent], ["Alliance", d.alliance || "None recorded"], ["Hubs", d.hubs.join(", ") || "None recorded"]].filter(r => r[1]).map(r => <div key={r[0]} className="row between sm af-r"><span className="muted">{r[0]}</span><span>{r[1]}</span></div>)}
      {d.wiki && <a className="sm" href={d.wiki} target="_blank" rel="noreferrer">Wikipedia article ↗</a>}
      <div className="faint xs">{d.source}, cached 14 days.</div></div>}
  </details>; }
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function CityDist({ f }: { f: Flight }) { const a = f.destination; const [p, setP] = useState<any>(null);
  useEffect(() => { if (a?.iata) api(`/place/${a.iata}`).then(setP).catch(() => {}); }, [a?.iata]);
  const q = p?.place?.coord; if (!q || a?.lat == null || a?.lon == null) return null;
  const t = (x: number) => x * Math.PI / 180, dl = t(q.lon - a.lon!); const km = 6371 * 2 * Math.asin(Math.sqrt(Math.sin(t(q.lat - a.lat!) / 2) ** 2 + Math.cos(t(a.lat!)) * Math.cos(t(q.lat)) * Math.sin(dl / 2) ** 2));
  const br = (Math.atan2(Math.sin(dl) * Math.cos(t(q.lat)), Math.cos(t(a.lat!)) * Math.sin(t(q.lat)) - Math.sin(t(a.lat!)) * Math.cos(t(q.lat)) * Math.cos(dl)) * 180 / Math.PI + 360) % 360;
  return <p className="sm mt8 cd">📍 <b>{p.place.label}</b> centre is <b>{km < 10 ? km.toFixed(1) : Math.round(km)} km {DIRS[Math.round(br / 45) % 8]}</b> of the airport, straight line <span className="faint xs">(Wikidata coordinates)</span></p>; }
