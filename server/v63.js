// v63: 3D airport shapes for ANY airport (OpenStreetMap via Overpass, cached on disk, not in memory) + FAA NAS status (US).
import fs from "fs"; import os from "os"; import path from "path";
const DIR = path.join(os.tmpdir(), "skyline-apt3d"); try { fs.mkdirSync(DIR, { recursive: true }); } catch {}
const OVP = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const UA = "Skyline/1.0 (hobby flight tracker; contact via github)";
async function ovp(q) { let last; for (const u of [...OVP, ...OVP, OVP[0], OVP[0]]) { try { const r = await fetch(u + "?data=" + encodeURIComponent(q), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error("Overpass " + r.status); return await r.json(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 4000)); } } throw last; }
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const H = t => { const h = t.height; if (h) { const n = parseFloat(h); if (n > 0) return /ft/.test(h) ? n * 0.3048 : n; } if (t["building:levels"]) return +t["building:levels"] * 4; return null; };
const area = c => { let s = 0; for (let i = 0; i < c.length - 1; i++) s += c[i][0] * c[i + 1][1] - c[i + 1][0] * c[i][1]; return Math.abs(s / 2); };
async function build(a) {
  const ad = await ovp(`[out:json][timeout:40];(way["aeroway"="aerodrome"](around:3000,${a.lat},${a.lon});rel["aeroway"="aerodrome"](around:3000,${a.lat},${a.lon}););out geom;`);
  const cands = (ad.elements || []).map(e => { const rings = e.type === "way" ? [e.geometry] : (e.members || []).filter(m => m.role === "outer" && m.geometry).map(m => m.geometry); const pts = rings.flat().filter(Boolean).map(p => [p.lon, p.lat]); return { t: e.tags || {}, rings: rings.filter(Boolean).map(r => r.map(p => [p.lon, p.lat])), pts }; }).filter(c => c.pts.length > 3);
  const pick = cands.find(c => c.t.iata === a.iata) || cands.find(c => c.t.icao === a.icao) || cands.sort((x, y) => y.pts.length - x.pts.length)[0];
  let s, w, n, e2; if (pick) { const xs = pick.pts.map(p => p[0]), ys = pick.pts.map(p => p[1]); w = Math.min(...xs); e2 = Math.max(...xs); s = Math.min(...ys); n = Math.max(...ys); }
  if (!pick || e2 - w > 0.12 || n - s > 0.08) { const d = 0.02; s = a.lat - d; n = a.lat + d; w = a.lon - d / Math.cos(a.lat * Math.PI / 180); e2 = a.lon + d / Math.cos(a.lat * Math.PI / 180); }
  const bb = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e2.toFixed(5)}`;
  const j = await ovp(`[out:json][timeout:60];(way["aeroway"~"^(terminal|apron|taxiway|runway|hangar|control_tower|tower|jet_bridge)$"](${bb});way["building"](${bb});rel["aeroway"="terminal"](${bb});rel["building"]["name"~"[Tt]erminal"](${bb}););out geom qt;`);
  const inside = c => !pick || pick.rings.some(r => inPoly(c, r));
  const feats = []; const K = {};
  for (const el of j.elements || []) { if (el.type === "relation") { const o = (el.members || []).filter(m => m.role === "outer" && m.geometry?.length); if (!o.length) continue; let ring = o.sort((a, b) => b.geometry.length - a.geometry.length)[0].geometry; if (o.length > 1) ring = o.flatMap(m => m.geometry); if (ring[0].lat !== ring.at(-1).lat || ring[0].lon !== ring.at(-1).lon) ring = [...ring, ring[0]]; el.geometry = ring; }
    if (!el.geometry) continue; const t = el.tags || {}; const c = el.geometry.map(p => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);
    const closed = c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1]; let kind = null, h = H(t); if (/hotel|hilton|hyatt|inn\b|premier|holiday|sonesta|marriott|novotel|ibis|radisson|college|school/i.test(t.name || "") || t.tourism === "hotel") continue;
    if (t.aeroway === "runway") kind = "runway"; else if (t.aeroway === "taxiway") kind = "taxiway"; else if (t.aeroway === "apron" && closed) kind = "apron";
    else if ((t.aeroway === "terminal" || t.building === "terminal" || (t.building && /terminal/i.test(t.name || "") && !/car park|parking|hotel|cargo|business|aviation|bus|coach|rail|fuel/i.test(t.name || ""))) && closed) { kind = "terminal"; h ??= 16; }
    else if (t.aeroway === "jet_bridge") kind = "bridge";
    else if ((t.building || t.aeroway) && closed) { if (["house", "detached", "semidetached_house", "terrace", "apartments", "residential", "garage", "garages", "shed", "no", "roof"].includes(t.building)) continue; if (!inside(c[0])) continue; kind = (t.aeroway === "control_tower" || t["man_made"] === "tower" || (h && h > 35)) ? "tower" : "building"; h ??= t.aeroway === "hangar" || t.building === "hangar" ? 14 : 8; }
    if (!kind) continue; K[kind] = (K[kind] || 0) + 1;
    const poly = closed && kind !== "runway" && kind !== "taxiway";
    feats.push({ type: "Feature", properties: { kind, name: t.name || t.ref || "", h: h ? Math.round(h) : 0, est: H(t) == null, w: kind === "runway" ? (+t.width || 45) : kind === "taxiway" ? (+t.width || 18) : 0, A: poly ? area(c) : 0 }, geometry: poly ? { type: "Polygon", coordinates: [c] } : { type: "LineString", coordinates: c } }); }
  // Label: the biggest terminal shows the terminal's own OSM name, or the airport's OSM name if the terminal has none.
  const terms = feats.filter(f => f.properties.kind === "terminal").sort((x, y) => y.properties.A - x.properties.A);
  const aname = pick?.t?.name || (/airport/i.test(a.name) ? a.name : a.name + " Airport");
  // Signs: the biggest terminal carries the airport-name sign; every terminal also shows its own OSM name (e.g. "Terminal 1").
  terms.forEach((f, i) => { f.properties.sign = i === 0 ? aname : ""; f.properties.label = f.properties.name && f.properties.name !== aname ? f.properties.name : ""; });
  if (!terms.length) feats.push({ type: "Feature", properties: { kind: "signpt", sign: aname, label: "", h: 0 }, geometry: { type: "Point", coordinates: [a.lon, a.lat] } });
  feats.forEach(f => delete f.properties.A);
  return { type: "FeatureCollection", iata: a.iata, name: aname, center: [a.lon, a.lat], bbox: [w, s, e2, n], counts: K, built: new Date().toISOString(), outline: !!pick, attribution: "© OpenStreetMap contributors (ODbL)", features: feats };
}
const busy = new Map();
const xml = (s, tag) => [...s.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map(m => m[1]);
const one = (s, tag) => (s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim() || null;
export function register(api, { AP, cached, wrap, HIST }) {
  const WK_RULE = "From Skyline's own flight log (official airport boards), last 7 days. Highlight = the single biggest logged departure delay (delays over 10 h are skipped as likely board date mix-ups). Also shown: the airport-day with the most cancellations (3+ needed).";
  api.get("/week-highlight", wrap(async (req, res) => { const r = await cached("wk63", 600, async () => { const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10); let top = null; const C = {}; let n = 0;
      for (const [num, o] of Object.entries(HIST)) for (const [id, x] of Object.entries(o)) { const date = id.slice(-10); if (date < since) continue; n++;
        if (x.s === "cancelled") { const k = x.o + "|" + date; C[k] = (C[k] || 0) + 1; continue; } if (typeof x.d === "number" && x.d <= 600 && (!top || x.d > top.d)) top = { n: num, o: x.o, t: x.t, d: x.d, date }; }
      const cx = Object.entries(C).filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1])[0];
      return { since, rows: n, top: top && { ...top, oc: AP[top.o]?.city || null, tc: AP[top.t]?.city || null }, cx: cx ? { ap: cx[0].split("|")[0], city: AP[cx[0].split("|")[0]]?.city || null, date: cx[0].split("|")[1], n: cx[1] } : null }; });
    res.json({ ...r, rule: WK_RULE, source: "Skyline flight log (official airport boards)" }); }));
  api.get("/apt3d", wrap(async (req, res) => { const iata = String(req.query.iata || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3); const a = AP[iata]; if (!a) return res.status(404).json({ error: "unknown airport" });
    const f = path.join(DIR, iata + ".json"); try { const st = fs.statSync(f); if (Date.now() - st.mtimeMs < 30 * 864e5) { res.type("json").set("cache-control", "public, max-age=86400"); return fs.createReadStream(f).pipe(res); } } catch {}
    if (busy.size >= 2 && !busy.has(iata)) return res.status(503).json({ error: "Busy building other airports, try again in a minute" });
    let p = busy.get(iata); if (!p) { p = build(a).finally(() => busy.delete(iata)); busy.set(iata, p); }
    try { const g = await p; const s = JSON.stringify(g); if (g.features.length) fs.writeFileSync(f, s); res.type("json").set("cache-control", "public, max-age=86400").send(s); } catch (e) { res.status(502).json({ error: "OpenStreetMap (Overpass) did not answer: " + (e.message || e) }); } }));
  api.get("/faa-status", wrap(async (req, res) => { const r = await cached("faa63", 120, async () => { const t = await (await fetch("https://nasstatus.faa.gov/api/airport-status-information", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(12000) })).text();
      const L = []; const upd = one(t, "Update_Time");
      for (const p of xml(t, "Program")) L.push({ kind: "ground stop", ap: one(p, "ARPT"), reason: one(p, "Reason"), end: one(p, "End_Time") });
      for (const p of xml(t, "Ground_Delay")) L.push({ kind: "ground delay", ap: one(p, "ARPT"), reason: one(p, "Reason"), avg: one(p, "Avg"), max: one(p, "Max") });
      for (const p of xml(t, "Delay")) { const ad = (p.match(/Type="(\w+)"/) || [])[1]; L.push({ kind: (ad || "").toLowerCase() + " delay", ap: one(p, "ARPT"), reason: one(p, "Reason"), min: one(p, "Min"), max: one(p, "Max"), trend: one(p, "Trend") }); }
      for (const p of xml(t, "Airport")) { const ap = one(p, "ARPT"); if (ap) L.push({ kind: "closure", ap, reason: one(p, "Reason"), reopen: one(p, "Reopen") }); }
      return { updated: upd, list: L.filter(x => x.ap).map(x => ({ ...x, city: AP[x.ap]?.city || null })) }; });
    res.json({ ...r, source: "FAA National Airspace System status (nasstatus.faa.gov), US airports only" }); }));
}
