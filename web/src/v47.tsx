// v47 (redesigned): hero cards — sea & swim days, pollen & hay fever, snow, earthquakes map (USGS), airline facts (Wikidata), city-centre compass.
// Real sources; every rule is printed on the card. Motion is CSS-only and switched off for E-ink / reduced motion (see v41.css .hx rules).
import { useEffect, useState } from "react";
import { api, type Flight } from "./lib";
function useGet(path: string | null) { const [d, setD] = useState<any>(null); const [e, setE] = useState("");
  useEffect(() => { if (path) api(path).then(setD).catch(x => setE(x.message)); }, [path]); return { d, e }; }
const dayName = (s: string) => new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
function Ring({ v, min, max, color, label, unit }: { v: number; min: number; max: number; color: string; label: string; unit: string }) {
  const r = 46, C = 2 * Math.PI * r, f = clamp((v - min) / (max - min), 0, 1);
  return <svg className="hx-ring" viewBox="0 0 120 120" role="img" aria-label={`${label} ${v}${unit}`}><circle cx="60" cy="60" r={r} className="hx-ring-bg" />
    <circle cx="60" cy="60" r={r} className="hx-ring-fg" style={{ stroke: color, strokeDasharray: C, ["--off" as any]: C * (1 - f), ["--c" as any]: C }} transform="rotate(-90 60 60)" />
    <text x="60" y="58" className="hx-ring-v">{v.toFixed(1)}<tspan className="hx-ring-u">{unit}</tspan></text><text x="60" y="78" className="hx-ring-l">{label}</text></svg>; }
function Hero({ cls, kicker, verdict, tone, sub, children, foot }: any) {
  return <div className={`card m0 mt8 hx ${cls} t-${tone}`}><div className="hx-k">{kicker}</div><div className="hx-v">{verdict}</div>{sub && <div className="hx-s">{sub}</div>}{children}<div className="hx-f">{foot}</div></div>; }
function Waves({ h }: { h: number }) { const a = clamp(h, 0.1, 3) * 7; const path = (y: number, k: number) => `M0 ${y} ${Array.from({ length: 9 }, (_, i) => `Q ${i * 50 + 25} ${y + (i % 2 ? a : -a) * k} ${i * 50 + 50} ${y}`).join(" ")} V60 H0 Z`;
  return <svg className="hx-waves" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden><path d={path(30, 1)} className="w1" /><path d={path(38, .7)} className="w2" /></svg>; }
// Swim rule: sea ≥ 20 °C, max wave < 1 m, air ≥ 22 °C, rain < 40 %. Bracing: sea ≥ 17 °C, wave < 1.5 m.
const swim = (sst: number, x: any) => x.wave == null ? null : sst >= 20 && x.wave < 1 && x.tmax >= 22 && x.rain < 40 ? "good" : sst >= 17 && x.wave < 1.5 ? "bracing" : "no";
const TREE = ["alder", "birch", "olive"]; const lim = (k: string) => TREE.includes(k) ? [20, 100] : [10, 50];
const band = (k: string, v: number) => { const [m, h] = lim(k); return v >= h ? "high" : v >= m ? "moderate" : "low"; };
export function Outdoors({ f }: { f: Flight }) { const c = f.destination?.iata; const { d, e } = useGet(c ? `/outdoors/${c}` : null);
  if (!c) return null; if (e) return <div className="card m0 mt8 hx"><p className="sm bad">Outdoors: {e}</p></div>;
  if (!d) return <div className="card m0 mt8 hx hx-sk"><div className="hx-k">Outdoors · {f.destination?.city || c}</div><div className="dg-sk-l" /><div className="dg-sk-l s" /></div>;
  const sea = d.sea && d.sea.km != null && d.sea.km <= 30 ? d.sea : null; const rated = sea ? d.days.map((x: any) => ({ ...x, s: swim(sea.sst, x) })) : [];
  const best = rated.filter((x: any) => x.s === "good").sort((a: any, b: any) => b.tmax - a.tmax)[0]; const today = rated[0];
  const pol = d.pollen ? Object.entries(d.pollen as Record<string, number>).map(([k, v]) => ({ k, v, b: band(k, v) })).sort((a, b) => b.v / lim(b.k)[1] - a.v / lim(a.k)[1]) : [];
  const worst = pol.find(p => p.b === "high") || pol.find(p => p.b === "moderate");
  const sstCol = !sea ? "" : sea.sst >= 20 ? "var(--green)" : sea.sst >= 17 ? "var(--orange)" : "var(--blue)";
  return <>
    {sea && <Hero cls="od" tone={today?.s === "good" ? "ok" : today?.s === "bracing" ? "warn" : "bad"} kicker={`Sea & swim · ${f.destination?.city || c}`}
      verdict={best ? (best === today ? "Swim day today" : `Best swim day: ${dayName(best.date)}`) : rated.some((x: any) => x.s === "bracing") ? "Bracing swims only" : "Not swimming weather"}
      sub={`${rated.filter((x: any) => x.s === "good").length} of the next ${rated.length} days pass the swim rule`}
      foot={<>Rule: sea ≥ 20 °C, max wave &lt; 1 m, air ≥ 22 °C, rain &lt; 40 %; “bracing” sea ≥ 17 °C, waves &lt; 1.5 m. Open-Meteo Marine model cell {sea.km} km from the airport; model values, not buoy readings.</>}>
      <div className="hx-row"><Ring v={sea.sst} min={10} max={30} color={sstCol} label="sea °C" unit="°" />
        <div className="hx-wv"><div className="hx-big">{sea.wave.toFixed(1)}<small> m</small></div><div className="hx-lab">waves now</div><Waves h={sea.wave} /></div></div>
      <div className="hx-days">{rated.map((x: any, i: number) => <div key={x.date} className={"hx-d " + x.s} style={{ animationDelay: `${i * 70}ms` }}><b>{dayName(x.date)}</b><span className="hx-dt">{Math.round(x.tmax)}°</span><small>{x.rain}% rain</small><small>≤{x.wave} m</small><i>{x.s === "good" ? "Swim" : x.s === "bracing" ? "Bracing" : "No"}</i></div>)}</div></Hero>}
    <Hero cls="hxpl" tone={!pol.length ? "dim" : worst?.b === "high" ? "bad" : worst ? "warn" : "ok"} kicker={`Pollen · ${f.destination?.city || c}`}
      verdict={!pol.length ? "No pollen data here" : worst ? `Hay fever alert: ${worst.k} ${worst.b}` : "Pollen is low"} sub={!pol.length ? "CAMS pollen covers Europe only" : worst ? "Pack antihistamines" : "Every measured type is in the low band"}
      foot={<>Rule: trees (alder, birch, olive) moderate ≥ 20, high ≥ 100; grass, mugwort, ragweed moderate ≥ 10, high ≥ 50 grains/m³. Open-Meteo CAMS model{d.pollenAt ? `, ${d.pollenAt.slice(11)} local` : ""}.</>}>
      {pol.length > 0 && <div className="hx-bars">{pol.map((p, i) => { const h = lim(p.k)[1]; return <div key={p.k} className={"hx-bar " + p.b}><span>{p.k}</span><div><i style={{ ["--w" as any]: `${clamp(p.v / (h * 1.5), 0.02, 1) * 100}%`, animationDelay: `${i * 60}ms` }} /><em style={{ left: `${(lim(p.k)[0] / (h * 1.5)) * 100}%` }} /><em style={{ left: `${(1 / 1.5) * 100}%` }} /></div><b>{Math.round(p.v)}</b></div>; })}</div>}
      {d.snowCm != null && <div className={"hx-snow" + (d.snowCm > 0 ? " on" : "")}><span className="hx-flake" aria-hidden>❄</span><div><b>{d.snowCm > 0 ? `${d.snowCm} cm of snow lying` : "No lying snow"}</b><small>at the airport now · Open-Meteo model</small></div>{d.snowCm > 0 && <div className="hx-sbar"><i style={{ height: `${clamp(d.snowCm / 100, 0.05, 1) * 100}%` }} /></div>}</div>}</Hero>
  </>; }
export function Quakes({ f }: { f: Flight }) { const a = f.destination; const c = a?.iata; const { d, e } = useGet(c ? `/quakes/${c}` : null);
  if (!c) return null; if (e) return <div className="card m0 mt8 hx"><p className="sm bad">Earthquakes: {e}</p></div>; if (!d) return null;
  const mx = d.quakes.reduce((m: number, q: any) => Math.max(m, q.mag), 0); const tone = mx >= 5 ? "bad" : mx >= 4 ? "warn" : "ok";
  const t = (x: number) => x * Math.PI / 180; const pos = (q: any) => { const dl = t(q.lon - a!.lon!); const br = Math.atan2(Math.sin(dl) * Math.cos(t(q.lat)), Math.cos(t(a!.lat!)) * Math.sin(t(q.lat)) - Math.sin(t(a!.lat!)) * Math.cos(t(q.lat)) * Math.cos(dl)); const r = q.km / d.radiusKm * 90; return [100 + r * Math.sin(br), 100 - r * Math.cos(br)]; };
  const col = (m: number) => m >= 5 ? "var(--red)" : m >= 4 ? "var(--orange)" : "var(--yellow, #eab308)";
  return <Hero cls="eq" tone={tone} kicker={`Earthquakes · ${d.radiusKm} km around ${c}`} verdict={!d.total ? "Seismically quiet" : mx >= 5 ? `Strong quake: M${mx.toFixed(1)}` : mx >= 4 ? `Moderate activity · max M${mx.toFixed(1)}` : `Minor activity · max M${mx.toFixed(1)}`}
    sub={`${d.total} quake${d.total === 1 ? "" : "s"} of M${d.minMag}+ in the last ${d.days} days`} foot={<>Colour: M5+ red, M4+ orange, smaller yellow. USGS Earthquake Hazards Program; rings at 100, 200, 300 km from the airport.</>}>
    <div className="hx-row"><svg className="hx-map" viewBox="0 0 200 200" role="img" aria-label="Map of recent earthquakes around the airport">
      {[30, 60, 90].map(r => <circle key={r} cx="100" cy="100" r={r} className="hx-rg" />)}<text x="100" y="14" className="hx-n">N</text>
      {d.quakes.map((q: any, i: number) => { const [x, y] = pos(q); return <g key={q.url}><circle cx={x} cy={y} r={2 + q.mag * 1.6} fill={col(q.mag)} className="hx-q" style={{ animationDelay: `${i * 120}ms` }} /><circle cx={x} cy={y} r={2 + q.mag * 1.6} fill="none" stroke={col(q.mag)} className="hx-pulse" /></g>; })}
      <g className="hx-ap"><circle cx="100" cy="100" r="5" /><text x="100" y="118">{c}</text></g></svg>
      <div className="hx-ql">{d.quakes.length ? d.quakes.slice(0, 4).map((q: any) => <a key={q.url} href={q.url} target="_blank" rel="noreferrer" className="hx-qi"><b style={{ color: col(q.mag) }}>M{q.mag.toFixed(1)}</b><span>{q.place}</span><small>{new Date(q.time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {q.km} km{q.tsunami ? " · 🌊 tsunami flag" : ""}</small></a>) : <div className="hx-calm">No recorded quakes of M{d.minMag}+ within {d.radiusKm} km in {d.days} days.</div>}</div></div></Hero>; }
export function AirlineFacts({ f }: { f: Flight }) { const icao = f.airline?.icao || (/^[A-Z]{3}(?=\d)/.exec(f.number || "") || [])[0]; const { d, e } = useGet(icao ? `/airline-facts/${icao}` : null);
  if (!icao || e || !d) return null; const age = d.founded ? new Date().getFullYear() - +d.founded : null;
  return <Hero cls="af" tone="dim" kicker={`About ${d.name || f.airline?.name || icao}`} verdict={age != null ? <>{age}<small> years flying</small></> : d.name} sub={d.founded ? `Founded ${d.founded}${d.hq ? ` · HQ ${d.hq}` : ""}` : d.hq ? `HQ ${d.hq}` : ""}
    foot={<>{d.source}{d.wiki ? <> · <a href={d.wiki} target="_blank" rel="noreferrer">Wikipedia ↗</a></> : null}</>}>
    <div className="hx-facts">{[["Alliance", d.alliance || "None recorded"], ["Parent", d.parent || "—"]].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
    {d.hubs.length > 0 && <div className="hx-chips"><small>Hubs</small>{d.hubs.map((h: string) => <span key={h}>{h}</span>)}</div>}</Hero>; }
const DIRS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
export function CityDist({ f }: { f: Flight }) { const a = f.destination; const { d: p } = useGet(a?.iata ? `/place/${a.iata}` : null);
  const q = p?.place?.coord; if (!q || a?.lat == null || a?.lon == null) return null;
  const t = (x: number) => x * Math.PI / 180, dl = t(q.lon - a.lon!); const km = 6371 * 2 * Math.asin(Math.sqrt(Math.sin(t(q.lat - a.lat!) / 2) ** 2 + Math.cos(t(a.lat!)) * Math.cos(t(q.lat)) * Math.sin(dl / 2) ** 2));
  const br = (Math.atan2(Math.sin(dl) * Math.cos(t(q.lat)), Math.cos(t(a.lat!)) * Math.sin(t(q.lat)) - Math.sin(t(a.lat!)) * Math.cos(t(q.lat)) * Math.cos(dl)) * 180 / Math.PI + 360) % 360;
  return <Hero cls="cd" tone="dim" kicker={`${p.place.label} from the airport`} verdict={<>{km < 10 ? km.toFixed(1) : Math.round(km)}<small> km {DIRS[Math.round(br / 45) % 8]}</small></>} sub={`Straight line to the centre, bearing ${Math.round(br)}°`} foot="Wikidata coordinates for the town and OurAirports for the airport; road distance will be longer.">
    <div className="hx-comp" aria-hidden><div className="hx-dial">{["N", "E", "S", "W"].map((n, i) => <span key={n} style={{ transform: `rotate(${i * 90}deg) translateY(-46px) rotate(${-i * 90}deg)` }}>{n}</span>)}<div className="hx-needle" style={{ ["--b" as any]: `${br}deg` }} /><div className="hx-hub" /></div></div></Hero>; }
