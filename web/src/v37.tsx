// v37: Manchester Airport terminal walkthrough (BETA). Stylised; built from OpenStreetMap positions, Wikipedia facts, Wikimedia Commons photos and the live MAN feed.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "./lib";
import "./v37.css";

const C = "https://commons.wikimedia.org/wiki/File:";
type Ph = { src: string; page: string; cap: string; by: string; lic: string };
const PH: Record<string, Ph> = {
  sky: { src: "", page: C + "Manchester_Airport_sky_walk.jpg", cap: "Skylink walkway, 2005", by: "Terry Whalebone", lic: "CC BY 2.0" },
  t2ext: { src: "", page: "https://commons.wikimedia.org/w/index.php?search=geograph+8257804&ns6=1", cap: "Terminal 2 exterior, 2026", by: "habiloid (Geograph)", lic: "CC BY-SA 2.0" },
  t2chk: { src: "", page: "https://commons.wikimedia.org/w/index.php?search=geograph+8224208&ns6=1", cap: "Terminal 2 check-in hall, 2025", by: "Thomas Nugent (Geograph)", lic: "CC BY-SA 2.0" },
  t2in: { src: "", page: C + "Manchester_Airport_Terminal_2_in_2025.jpg", cap: "Terminal 2 interior, 2025", by: "Infomation12345", lic: "CC BY-SA 4.0" },
  t2pier: { src: "", page: "https://commons.wikimedia.org/w/index.php?search=geograph+5989528&ns6=1", cap: "View from a new T2 departure lounge, 2018", by: "Richard Humphrey (Geograph)", lic: "CC BY-SA 2.0" },
  t1chk: { src: "", page: C + "Manchester_Check-In.JPG", cap: "Former Terminal 1 check-in hall, 2011 (may look different today)", by: "MKY661", lic: "CC0" },
  t3: { src: "", page: "https://commons.wikimedia.org/w/index.php?search=geograph+6537228&ns6=1", cap: "Terminal 3, 2020", by: "Thomas Nugent (Geograph)", lic: "CC BY-SA 2.0" },
  t2dep: { src: "", page: C + "Terminal_2_Departures_MAN.JPG", cap: "Terminal 2 departures, 2012", by: "MKY661", lic: "Public domain" },
};
type Step = { t: string; at: [number, number]; facts: string[]; ph?: string; fids?: boolean; sign: string };
const ST = "Manchester Airport station opened in May 1993, between the terminals. The Skylink moving walkway links it to the terminals; Metrolink trams have served it since November 2014.";
const ROUTES: Record<string, Step[]> = {
  T2: [
    { t: "Station & Skylink", at: [-2.27204, 53.36518], facts: [ST], ph: "sky", sign: "Terminal 2 →" },
    { t: "Terminal 2 forecourt", at: [-2.2785, 53.3662], facts: ["T2 opened on 5 March 1993. Its big extension opened on 14 July 2021.", "Wikipedia lists T2 as a base for easyJet, Jet2, TUI and Virgin Atlantic."], ph: "t2ext", sign: "Departures ↑" },
    { t: "Check-in hall", at: [-2.27947, 53.3667], facts: ["Desk numbers aren't shown because Skyline can't verify them. The board below is the live MAN departures feed for T2."], ph: "t2chk", fids: true, sign: "Check-in · Bag drop" },
    { t: "Security", at: [-2.28151, 53.36807], facts: ["T2's new security hall opened on 22 May 2025. OpenStreetMap maps it as \u201cT2 Security West\u201d."], ph: "t2in", sign: "Security ↑" },
    { t: "Departure lounge", at: [-2.283, 53.3677], facts: ["Airside shops and the gate screens. Pier 2 opened in late 2025."], ph: "t2dep", fids: true, sign: "Gates A · B · C ←" },
    { t: "Pier 1 · Gates A", at: [-2.28602, 53.36949], facts: ["Pier 1 opened on 1 April 2019. OpenStreetMap maps gates A1 to A11."], ph: "t2pier", sign: "A1–A11 ↑" },
  ],
  T3: [
    { t: "Station & Skylink", at: [-2.27204, 53.36518], facts: [ST], ph: "sky", sign: "Terminal 3 →" },
    { t: "Terminal 3 entrance (former T1)", at: [-2.27522, 53.36196], facts: ["Terminal 1 largely closed on 19 November 2025. On 5 March 2026 its entrance, security and World Duty Free were renamed Terminal 3.", "T3's old check-in and security closed on 20 October 2025. Wikipedia lists T3 as the Ryanair base."], ph: "t1chk", fids: true, sign: "Terminal 3 · Check-in" },
    { t: "Security", at: [-2.2740, 53.3616], facts: ["This position is approximate. OpenStreetMap still maps an older \u201cT3 Security Area\u201d."], sign: "Security ↑" },
    { t: "Departure lounge", at: [-2.27, 53.36045], facts: ["T3 opened in 1989 as Terminal A and became T3 in 1998."], ph: "t3", fids: true, sign: "Gates 44–56 →" },
    { t: "Gates 44–56", at: [-2.26864, 53.36101], facts: ["OpenStreetMap maps gates 44 to 56 and 141 to 143 here."], sign: "Gate 53 ↑" },
  ],
};
const brg = (a: number[], b: number[]) => { const r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r); return (Math.atan2(y, x) / r + 360) % 360; };
const hm = (s?: string) => s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";

function Fids({ term, rows }: { term: string; rows: any[] | null }) {
  const n = term.replace("T", ""); const now = Date.now();
  const L = (rows || []).filter(f => f.dep?.terminal === n && Date.parse(f.dep.estimated || f.dep.scheduled) > now - 15 * 60e3 && f.status !== "departed" && f.status !== "cancelled").sort((a, b) => Date.parse(a.dep.scheduled) - Date.parse(b.dep.scheduled)).slice(0, 8);
  return <div className="fids"><div className="fidsh"><span>Departures · {term}</span><span>{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</span></div>
    {!rows ? <div className="fidsr">Loading live board…</div> : !L.length ? <div className="fidsr">No more {term} departures on the live board right now</div> : L.map(f => <div key={f.id} className="fidsr"><span>{hm(f.dep.scheduled)}</span><b>{f.number}</b><span className="fd">{f.destination?.city || f.destination?.name || f.destination?.iata}</span><span>{f.dep.gate || ""}</span><span className="fs">{f.dep.gateAction || f.statusText}</span></div>)}
    <div className="fidsf">Live MAN feed (manchesterairport.co.uk) · stylised display</div></div>;
}
function AirlineTerm({ rows }: { rows: any[] | null }) { if (!rows) return null; const m: Record<string, Set<string>> = {}; rows.forEach(f => { const t = f.dep?.terminal; const a = f.airline?.name; if (t && a) (m[a] ||= new Set()).add("T" + t); });
  const L = Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])); return <details className="mt8"><summary className="sm"><b>Which terminal does my airline use?</b> (from today's board, {L.length} airlines)</summary><div className="atg">{L.map(([a, s]) => <div key={a} className="sm"><span>{a}</span> <b>{[...s].sort().join(" / ")}</b></div>)}</div><div className="faint xs">Built from today's live departures. No check-in desk numbers because Skyline can't verify them.</div></details>; }

function Schematic({ steps, i, geo }: { steps: Step[]; i: number; geo: any }) {
  const B = [-2.2885, 53.3585, -2.2655, 53.3705]; const X = (lon: number) => (lon - B[0]) / (B[2] - B[0]) * 360, Y = (lat: number) => (B[3] - lat) / (B[3] - B[1]) * 260;
  const polys = (geo?.features || []).filter((f: any) => f.properties.kind === "terminal" && f.geometry.type === "Polygon");
  return <svg viewBox="0 0 360 260" className="schem">{polys.map((f: any, k: number) => <polygon key={k} points={f.geometry.coordinates[0].map((c: number[]) => X(c[0]) + "," + Y(c[1])).join(" ")} />)}
    <polyline points={steps.map(s => X(s.at[0]) + "," + Y(s.at[1])).join(" ")} />{steps.map((s, k) => <circle key={k} cx={X(s.at[0])} cy={Y(s.at[1])} r={k === i ? 7 : 4} className={k === i ? "on" : ""} />)}</svg>;
}

export default function Walk({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState<"T2" | "T3">("T2"); const [i, setI] = useState(0); const [rows, setRows] = useState<any[] | null>(null); const [geo, setGeo] = useState<any>(null);
  const [flat, setFlat] = useState(() => { try { return !document.createElement("canvas").getContext("webgl2"); } catch { return true; } });
  const [img, setImg] = useState<Record<string, string>>({});
  const el = useRef<HTMLDivElement>(null), map = useRef<maplibregl.Map | null>(null); const steps = ROUTES[term], s = steps[i];
  useEffect(() => { api("/board/MAN").then(r => setRows(r.flights || [])).catch(() => setRows([])); fetch("/man3d.geojson").then(r => r.json()).then(setGeo).catch(() => {}); }, []);
  // Resolve Commons thumbnails through the public Commons API (no keys).
  useEffect(() => { const k = s.ph; if (!k || img[k] !== undefined) return; const p = PH[k]; if (p.src) { setImg(x => ({ ...x, [k]: p.src })); return; }
    const q = p.page.includes("search=") ? `generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(decodeURIComponent(p.page.split("search=")[1].split("&")[0]))}` : "titles=" + encodeURIComponent("File:" + decodeURIComponent(p.page.split("File:")[1]));
    fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=800&${q}`).then(r => r.json()).then(j => { const pg: any = Object.values(j.query?.pages || {})[0]; setImg(x => ({ ...x, [k]: pg?.imageinfo?.[0]?.thumburl || "" })); }).catch(() => setImg(x => ({ ...x, [k]: "" }))); }, [s.ph]);
  useEffect(() => { if (flat || !el.current) return; try {
    const m = new maplibregl.Map({ container: el.current, style: { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf", sources: { b: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Esri, Maxar · OpenStreetMap contributors" } }, layers: [{ id: "b", type: "raster", source: "b", paint: { "raster-saturation": -0.3, "raster-brightness-max": 0.75 } }] }, center: steps[0].at, zoom: 17.6, pitch: 70, bearing: brg(steps[0].at, steps[1].at), attributionControl: { compact: true } });
    m.on("load", () => { m.addSource("apt", { type: "geojson", data: "/man3d.geojson" }); m.addLayer({ id: "bld", type: "fill-extrusion", source: "apt", filter: ["in", ["get", "kind"], ["literal", ["terminal", "building", "tower"]]], paint: { "fill-extrusion-color": ["match", ["get", "kind"], "terminal", "#8fa3c4", "#6b7280"], "fill-extrusion-height": ["coalesce", ["get", "h"], 12], "fill-extrusion-opacity": 0.55 } });
      m.addSource("w", { type: "geojson", data: "/man-walk.geojson" }); m.addLayer({ id: "g", type: "symbol", source: "w", filter: ["==", ["get", "kind"], "gate"], layout: { "text-field": ["get", "ref"], "text-size": 12, "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#111", "text-halo-color": "#ffd400", "text-halo-width": 4 } });
      m.addSource("path", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: steps.map(x => x.at) } } as any }); m.addLayer({ id: "pg", type: "line", source: "path", paint: { "line-color": "#ffd400", "line-width": 12, "line-blur": 8, "line-opacity": 0.5 } }); m.addLayer({ id: "p", type: "line", source: "path", paint: { "line-color": "#ffd400", "line-width": 3, "line-dasharray": [2, 1] } }); });
    map.current = m; return () => { m.remove(); map.current = null; }; } catch { setFlat(true); } }, [flat, term]);
  useEffect(() => { const m = map.current; if (!m) return; const nx = steps[Math.min(i + 1, steps.length - 1)], b = i < steps.length - 1 ? brg(s.at, nx.at) : m.getBearing(); m.flyTo({ center: s.at, zoom: 18.4, pitch: 72, bearing: b, duration: 3200, essential: true }); }, [i, term]);
  const p = s.ph ? PH[s.ph] : null;
  return createPortal(<div className="fs36 walk"><div className="fs36h"><button className="chip" onClick={onClose}>‹ Back</button><b>Terminal walkthrough</b><span className="m3beta">BETA</span><button className="chip sm" style={{ marginLeft: "auto" }} onClick={() => setFlat(!flat)}>{flat ? "3D" : "2D"}</button></div>
    <div className="row g6 px wpick">{(["T2", "T3"] as const).map(t => <button key={t} className={"chip" + (term === t ? " on" : "")} onClick={() => { setTerm(t); setI(0); }}>Terminal {t.slice(1)}</button>)}<span className="faint xs">T1 closed on 19 Nov 2025</span></div>
    <div className="wview">{flat ? <Schematic steps={steps} i={i} geo={geo} /> : <div ref={el} className="wmap" />}<div className="wsign">{s.sign}</div><div className="wbadge">Beta · stylised walkthrough built from OpenStreetMap + public info</div></div>
    <div className="wcard"><div className="row between"><b>{i + 1}. {s.t}</b><span className="faint sm">{i + 1}/{steps.length}</span></div>
      {s.facts.map((f, k) => <div key={k} className="sm mt4">{f}</div>)}
      {p && <figure className="wph">{img[s.ph!] ? <img src={img[s.ph!]} alt={p.cap} loading="lazy" /> : img[s.ph!] === "" ? null : <div className="skel" style={{ height: 160 }} />}<figcaption className="xs faint">{p.cap} · {p.by} · {p.lic} · <a href={p.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></figcaption></figure>}
      {s.fids && <Fids term={term} rows={rows} />}{s.fids && <AirlineTerm rows={rows} />}
      <div className="row g6 mt8"><button className="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>‹ Back</button><button className="primary" style={{ flex: 1 }} disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>{i === steps.length - 1 ? "You're at the gate" : "Walk to " + steps[i + 1].t + " ›"}</button></div>
      <div className="faint xs mt8">Facts: Wikipedia (Manchester Airport). Positions: OpenStreetMap contributors. Imagery: Esri. Not an official map, so follow the signs at the airport.</div></div></div>, document.body);
}
