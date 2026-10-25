// Skyline backend: serves the PWA and proxies/caches free flight-data sources.
import express from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression());
app.use(express.json({ limit: "200kb" }));
const UA = "Skyline/1.0 (personal flight tracker; +mailto:skyline-dev@example.com)";
const PORT = process.env.PORT || 8787;

// ---------- config (API keys) ----------
const DATA_DIR = process.env.DATA_DIR || __dir;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const CFG_FILE = path.join(DATA_DIR, "config.json");
let cfg = { aerodataboxKey: process.env.AERODATABOX_KEY || "", llmKey: process.env.LLM_API_KEY || "", llmBase: process.env.LLM_BASE_URL || "", llmModel: process.env.LLM_MODEL || "", adminToken: process.env.SKYLINE_ADMIN || "" };
try { Object.assign(cfg, JSON.parse(fs.readFileSync(CFG_FILE, "utf8"))); } catch {}
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) { console.warn("cfg save failed", e.message); } };

// ---------- reference data (OpenFlights) ----------
const csv = line => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(v => (v === "\\N" ? "" : v)); };
const AP = {}, AP_ICAO = {};
for (const l of fs.readFileSync(path.join(__dir, "data/airports.dat"), "utf8").split("\n")) {
  const c = csv(l); if (c.length < 12) continue;
  const a = { name: c[1], city: c[2], country: c[3], iata: c[4], icao: c[5], lat: +c[6], lon: +c[7], tz: c[11] };
  if (a.iata) AP[a.iata] = a; if (a.icao) AP_ICAO[a.icao] = a;
}
const AL = {}, AL_ICAO = {};
for (const l of fs.readFileSync(path.join(__dir, "data/airlines.dat"), "utf8").split("\n")) {
  const c = csv(l); if (c.length < 8) continue;
  const a = { name: c[1], iata: c[3], icao: c[4], callsign: c[5], country: c[6], active: c[7] === "Y" };
  if (a.iata && a.iata !== "-" && (!AL[a.iata] || (a.active && !AL[a.iata].active))) AL[a.iata] = a;
  if (a.icao && (!AL_ICAO[a.icao] || a.active)) AL_ICAO[a.icao] = a;
}
// fixes for common carriers whose OpenFlights rows are ambiguous
Object.assign(AL, { LS: { name: "Jet2.com", iata: "LS", icao: "EXS", callsign: "CHANNEX", country: "United Kingdom", active: true },
  FR: { name: "Ryanair", iata: "FR", icao: "RYR", callsign: "RYANAIR", country: "Ireland", active: true },
  U2: { name: "easyJet", iata: "U2", icao: "EZY", callsign: "EASY", country: "United Kingdom", active: true },
  BA: { name: "British Airways", iata: "BA", icao: "BAW", callsign: "SPEEDBIRD", country: "United Kingdom", active: true },
  BY: { name: "TUI Airways", iata: "BY", icao: "TOM", callsign: "TOMJET", country: "United Kingdom", active: true } });
const AIRLINE_LINKS = {
  LS: { web: "https://www.jet2.com", phone: "+443339000500", x: "https://x.com/jet2tweets", fb: "https://facebook.com/Jet2" },
  FR: { web: "https://www.ryanair.com", phone: "+443308100300", x: "https://x.com/Ryanair", fb: "https://facebook.com/ryanair" },
  U2: { web: "https://www.easyjet.com", phone: "+443303655000", x: "https://x.com/easyJet", fb: "https://facebook.com/easyJet" },
  BA: { web: "https://www.britishairways.com", phone: "+443444930787", x: "https://x.com/British_Airways", fb: "https://facebook.com/britishairways" },
  BY: { web: "https://www.tui.co.uk", phone: "+442034517001", x: "https://x.com/TUIUK", fb: "https://facebook.com/TUIUK" },
};
const airportOut = a => a && { iata: a.iata, icao: a.icao, name: a.name, city: a.city, country: a.country, lat: a.lat, lon: a.lon, tz: a.tz };
const airlineOut = code => { const a = AL[code] || AL_ICAO[code]; return a ? { ...a, links: AIRLINE_LINKS[a.iata] || { web: `https://www.google.com/search?q=${encodeURIComponent(a.name + " airline")}` } } : { iata: code, name: code }; };

// ---------- tiny cache ----------
const C = new Map();
async function cached(key, ttlS, fn) {
  const h = C.get(key); if (h && h.exp > Date.now()) return h.v;
  try { const v = await fn(); C.set(key, { v, exp: Date.now() + ttlS * 1000, at: Date.now() }); return v; }
  catch (e) { if (h) return h.v; throw e; }
}
async function getJSON(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { "user-agent": UA, accept: "application/json", ...(opt.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) { const e = new Error(`${r.status} ${url.split("?")[0]}`); e.status = r.status; throw e; }
  return r.json();
}

// ---------- MAG airports (MAN/STN/EMA) — airports' own public flight-info feed ----------
const MAG = "https://d3ebfrkw2baepa.cloudfront.net/";
const MAG_SITES = { MAN: "https://www.manchesterairport.co.uk", STN: "https://www.stanstedairport.com", EMA: "https://www.eastmidlandsairport.com" };
const magQ = dir => { const f = dir === "dep" ? "allDeparturesWithinMonth" : "allArrivalsWithinMonth";
  const x = dir === "dep" ? "estimatedDepartureDateTime actualDepartureDateTime departureGate { number }" : "estimatedArrivalDateTime actualArrivalDateTime arrivalGate { number } arrivalBaggageClaim { number }";
  return `query($airportCode: String!, $startDate: AWSDateTime, $endDate: AWSDateTime, $size: Int){ ${f}(tenant: $airportCode, startDate: $startDate, endDate: $endDate, size: $size){ id scheduledDepartureDateTime scheduledArrivalDateTime ${x} arrivalAirport { name cityName code } departureAirport { name cityName code } flightNumber airline { name code } arrivalTerminal departureTerminal status } }`; };
function londonDay(ymd) {
  const off = d => new Date(d.toLocaleString("en-US", { timeZone: "Europe/London" })) - new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const mid = new Date(ymd + "T00:00:00Z"); const start = new Date(mid - off(mid));
  return { start: start.toISOString(), end: new Date(+start + 86400e3 - 60e3).toISOString() };
}
const todayLondon = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const statusFromMag = s => { s = (s || "").toLowerCase();
  if (s.includes("cancel")) return "cancelled"; if (s.includes("divert")) return "diverted"; if (s.includes("landed") || s.includes("arrived")) return "landed";
  if (s.includes("departed") || s.includes("airborne")) return "departed"; if (s.includes("board")) return "boarding"; if (s.includes("gate")) return "gate"; if (s.includes("delay")) return "delayed"; return "scheduled"; };
function normMag(f, apt, dir) {
  const other = dir === "dep" ? f.arrivalAirport : f.departureAirport;
  const here = AP[apt], there = AP[other?.code] || { iata: other?.code, name: other?.name, city: other?.cityName };
  const num = (f.flightNumber || "").replace(/\s+/g, "");
  const al = f.airline?.code || num.slice(0, 2);
  const _id = `${num}-${(f.scheduledDepartureDateTime || f.scheduledArrivalDateTime || "").slice(0, 10)}`; return { id: _id, date: _id.slice(-10),
    number: num, airline: { ...airlineOut(al), name: airlineOut(al).name || f.airline?.name },
    origin: airportOut(dir === "dep" ? here : there) || there, destination: airportOut(dir === "dep" ? there : here) || there,
    dep: dir === "dep" ? { scheduled: f.scheduledDepartureDateTime, estimated: f.estimatedDepartureDateTime, actual: f.actualDepartureDateTime, gate: f.departureGate?.number, terminal: f.departureTerminal }
                       : { scheduled: f.scheduledDepartureDateTime },
    arr: dir === "arr" ? { scheduled: f.scheduledArrivalDateTime, estimated: f.estimatedArrivalDateTime, actual: f.actualArrivalDateTime, gate: f.arrivalGate?.number, terminal: f.arrivalTerminal, baggage: f.arrivalBaggageClaim?.number }
                       : { scheduled: f.scheduledArrivalDateTime },
    statusText: f.status, status: statusFromMag(f.status), source: `${apt} Airport official flight info (${MAG_SITES[apt].replace("https://www.", "")})` };
}
async function magBoard(apt, dir, ymd) {
  const ttl = ymd < todayLondon() ? 6 * 3600 : 60;
  return cached(`mag:${apt}:${dir}:${ymd}`, ttl, async () => {
    const d = londonDay(ymd);
    const r = await getJSON(MAG, { method: "POST", headers: { "content-type": "application/json", origin: MAG_SITES[apt], referer: MAG_SITES[apt] + "/" },
      body: JSON.stringify({ query: magQ(dir), variables: { airportCode: apt, startDate: d.start, endDate: d.end, size: 2000 } }) });
    const list = r?.data && Object.values(r.data)[0]; if (!Array.isArray(list)) throw new Error("MAG feed returned no data");
    return list.map(f => normMag(f, apt, dir));
  });
}

// ---------- AeroDataBox (optional key, RapidAPI) ----------
const ADB = "https://aerodatabox.p.rapidapi.com";
const adb = (p, ttl = 300) => { if (!cfg.aerodataboxKey) { const e = new Error("no key"); e.needsKey = true; throw e; }
  return cached("adb:" + p, ttl, () => getJSON(ADB + p, { headers: { "x-rapidapi-key": cfg.aerodataboxKey, "x-rapidapi-host": "aerodatabox.p.rapidapi.com" } })); };
const adbStatus = s => ({ Expected: "scheduled", Scheduled: "scheduled", EnRoute: "departed", CheckIn: "scheduled", Boarding: "boarding", GateClosed: "gate", Departed: "departed", Delayed: "delayed", Approaching: "departed", Arrived: "landed", Canceled: "cancelled", Diverted: "diverted", CanceledUncertain: "cancelled" }[s] || "scheduled");
const utcz = t => t?.utc ? new Date(t.utc.replace(" ", "T").replace(/Z?$/, "Z")).toISOString() : undefined;
function normAdb(f) {
  const ap = x => x?.airport && (airportOut(AP[x.airport.iata] || AP_ICAO[x.airport.icao]) || { iata: x.airport.iata, name: x.airport.name });
  const num = (f.number || "").replace(/\s+/g, "");
  return { id: `${num}-${(utcz(f.departure?.scheduledTime) || "").slice(0, 10)}`, number: num, airline: { ...airlineOut(f.airline?.iata || num.slice(0, 2)), name: f.airline?.name },
    origin: ap(f.departure), destination: ap(f.arrival),
    dep: { scheduled: utcz(f.departure?.scheduledTime), estimated: utcz(f.departure?.revisedTime) || utcz(f.departure?.predictedTime), actual: utcz(f.departure?.runwayTime), gate: f.departure?.gate, terminal: f.departure?.terminal },
    arr: { scheduled: utcz(f.arrival?.scheduledTime), estimated: utcz(f.arrival?.revisedTime) || utcz(f.arrival?.predictedTime), actual: utcz(f.arrival?.runwayTime), gate: f.arrival?.gate, terminal: f.arrival?.terminal, baggage: f.arrival?.baggageBelt },
    aircraft: f.aircraft ? { reg: f.aircraft.reg, hex: f.aircraft.modeS, model: f.aircraft.model } : undefined,
    statusText: f.status, status: adbStatus(f.status), source: "AeroDataBox" };
}

// ---------- live positions: adsb.lol (fallback adsb.fi) ----------
async function liveByCallsign(cs) {
  return cached("live:" + cs, 10, async () => {
    for (const u of [`https://api.adsb.lol/v2/callsign/${cs}`, `https://opendata.adsb.fi/api/v2/callsign/${cs}`]) {
      try { const r = await getJSON(u); const a = (r.ac || r.aircraft || [])[0];
        if (r.ac || r.aircraft) return a ? { hex: a.hex, callsign: (a.flight || "").trim(), reg: a.r, type: a.t, lat: a.lat, lon: a.lon, alt: a.alt_baro, gs: a.gs, track: a.track, vs: a.baro_rate, squawk: a.squawk, seen: a.seen, source: u.includes("lol") ? "adsb.lol" : "adsb.fi" } : null;
      } catch {}
    }
    return null;
  });
}
const toCallsign = number => { const m = number.toUpperCase().match(/^([A-Z0-9]{2})(\d+[A-Z]?)$/); if (!m) return null; const al = AL[m[1]]; return al?.icao ? al.icao + m[2] : null; };

// ---------- forecast history store (snapshots of MAG boards, accumulates over time) ----------
const HIST_FILE = path.join(DATA_DIR, "history.json");
if (!fs.existsSync(HIST_FILE) && fs.existsSync(path.join(__dir, "history.json"))) { try { fs.copyFileSync(path.join(__dir, "history.json"), HIST_FILE); } catch {} }
let HIST = {}; try { HIST = JSON.parse(fs.readFileSync(HIST_FILE, "utf8")); } catch {}
const delayMin = f => { const s = f.arr.scheduled, a = f.arr.actual || f.arr.estimated; const sd = f.dep.scheduled, ad = f.dep.actual || f.dep.estimated;
  if (s && a) return Math.round((new Date(a) - new Date(s)) / 60000); if (sd && ad) return Math.round((new Date(ad) - new Date(sd)) / 60000); return null; };
function record(list) { for (const f of list) { if (!["landed", "departed", "cancelled", "diverted"].includes(f.status)) continue;
  const k = f.number; HIST[k] = HIST[k] || {}; HIST[k][f.id] = { d: delayMin(f), s: f.status, o: f.origin?.iata, t: f.destination?.iata }; } }
async function collect() {
  const y = new Date(Date.now() - 86400e3).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  for (const apt of Object.keys(MAG_SITES)) for (const dir of ["dep", "arr"]) for (const d of [y, todayLondon()]) { try { record(await magBoard(apt, dir, d)); } catch {} }
  const cutoff = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10);
  for (const k in HIST) for (const id in HIST[k]) if (id.slice(-10) < cutoff) delete HIST[k][id];
  try { fs.writeFileSync(HIST_FILE, JSON.stringify(HIST)); } catch {}
}
setTimeout(collect, 3000); setInterval(collect, 30 * 60e3);

// ---------- routes ----------
const api = express.Router();
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(e.needsKey ? 501 : e.status || 502).json({ error: String(e.message || e), needsKey: !!e.needsKey }));
api.get("/health", (q, r) => r.json({ ok: true, keys: { aerodatabox: !!cfg.aerodataboxKey }, magAirports: Object.keys(MAG_SITES) }));
api.get("/settings", (q, r) => r.json({ aerodatabox: cfg.aerodataboxKey ? "set (" + cfg.aerodataboxKey.slice(0, 4) + "…)" : "", protected: !!cfg.adminToken }));
api.post("/settings", (req, res) => {
  if (cfg.adminToken && req.body.adminToken !== cfg.adminToken) return res.status(403).json({ error: "admin token required" });
  for (const k of ["aerodataboxKey", "llmKey", "llmBase", "llmModel"]) if (typeof req.body[k] === "string") cfg[k] = req.body[k].trim();
  if (!cfg.adminToken && req.body.newAdminToken) cfg.adminToken = String(req.body.newAdminToken);
  saveCfg(); C.clear(); res.json({ ok: true });
});
api.get("/airports/search", (req, res) => { const q = String(req.query.q || "").toLowerCase(); if (!q) return res.json([]);
  const out = []; for (const a of Object.values(AP)) { const s = `${a.iata} ${a.icao} ${a.name} ${a.city}`.toLowerCase(); if (a.iata.toLowerCase() === q) out.unshift(a); else if (s.includes(q)) out.push(a); if (out.length > 40) break; }
  res.json(out.slice(0, 15).map(airportOut)); });
api.get("/airport/:iata", (req, res) => { const a = AP[req.params.iata.toUpperCase()]; a ? res.json({ ...airportOut(a), boardSource: MAG_SITES[a.iata] ? "official" : cfg.aerodataboxKey ? "aerodatabox" : "live" }) : res.status(404).json({ error: "unknown airport" }); });
api.get("/airline/:code", (req, res) => res.json(airlineOut(req.params.code.toUpperCase())));


// ---- Worldwide live-traffic board (real ADS-B, no schedules) ----
let adsbQ = Promise.resolve(); const adsbGate = fn => { const r = adsbQ.then(fn, fn); adsbQ = r.catch(() => {}).then(() => new Promise(z => setTimeout(z, 350))); return r; };
const nearAir = (a, nm = 30) => cached(`near:${a.iata}:${nm}`, 60, () => adsbGate(async () => { for (const u of [`https://api.adsb.lol/v2/point/${a.lat}/${a.lon}/${nm}`, `https://opendata.adsb.fi/api/v2/lat/${a.lat}/lon/${a.lon}/dist/${nm}`]) { try { const r = await getJSON(u); if (r.ac || r.aircraft) return { ac: r.ac || r.aircraft, src: u.includes("lol") ? "adsb.lol" : "adsb.fi" }; } catch {} } throw new Error("no ADS-B source"); }));
const routeCs = cs => cached("adsbdb:" + cs, 86400, async () => { try { return (await getJSON(`https://api.adsbdb.com/v0/callsign/${cs}`)).response?.flightroute || null; } catch { return null; } });
const kmTo = (a, lat, lon) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(lat - a.lat), dn = r(lon - a.lon); return 2 * R * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(lat)) * Math.sin(dn / 2) ** 2)); };
function classify(a, x) { const cs = (x.flight || "").trim(); if (!cs || x.lat == null) return null; const gnd = x.alt_baro === "ground" || (x.gs != null && x.gs < 40 && (x.alt_baro ?? 99999) < 1500 + (a.alt || 0));
  const alt = typeof x.alt_baro === "number" ? x.alt_baro : 0, vs = x.baro_rate ?? x.geom_rate ?? 0, km = kmTo(a, x.lat, x.lon);
  if (gnd) return km < 6 ? { cs, phase: "ground", km } : null;
  if (alt < 14000 && vs > 300) return { cs, phase: "departed", km }; if (alt < 14000 && vs < -300) return { cs, phase: "approaching", km }; return null; }
async function liveBoard(iata, dir) { const a = AP[iata]; if (!a) throw new Error("unknown airport");
  return cached(`liveboard:${iata}:${dir}`, 90, async () => { const { ac, src } = await nearAir(a); const out = [];
    const cl = ac.map(x => [x, classify(a, x)]).filter(([, c]) => c).slice(0, 60);
    for (const [x, c] of cl) { const rt = await routeCs(c.cs); const o = rt?.origin?.iata_code, d = rt?.destination?.iata_code;
      let side = rt ? (o === iata ? "dep" : d === iata ? "arr" : null) : (c.phase === "departed" ? "dep" : c.phase === "approaching" ? "arr" : null);
      if (rt && !side) continue; if (!side && c.phase === "ground") continue; if (side !== dir) continue;
      const num = rt?.airline?.iata && rt.callsign_iata ? rt.callsign_iata : c.cs;
      out.push({ id: `${num}-live`, number: num, callsign: c.cs, airline: airlineOut(rt?.airline?.iata || num.slice(0, 2)), origin: o ? airportOut(AP[o]) || { iata: o } : null, destination: d ? airportOut(AP[d]) || { iata: d } : null, dep: {}, arr: {},
        status: c.phase === "ground" ? (dir === "dep" ? "on ground" : "landed") : c.phase === "departed" ? "departed" : "approaching", statusText: { ground: dir === "dep" ? "On ground — taxiing / at stand" : "Landed — on ground", departed: "Just departed (climbing)", approaching: `Approaching — ${Math.round(c.km)} km out` }[c.phase],
        aircraft: { reg: x.r, type: x.t }, live: { lat: x.lat, lon: x.lon, alt: x.alt_baro, gs: x.gs, track: x.track, hex: x.hex, src }, liveOnly: true, source: src + (rt ? " + adsbdb route" : "") }); }
    return out; }); }
async function liveCounts(iata) { const a = AP[iata]; const { ac } = await nearAir(a); const c = ac.map(x => classify(a, x)).filter(Boolean);
  return { ground: c.filter(x => x.phase === "ground").length, departing: c.filter(x => x.phase === "departed").length, arriving: c.filter(x => x.phase === "approaching").length, airborneNearby: ac.filter(x => x.alt_baro !== "ground").length }; }

async function board(iata, dir, ymd) {
  if (MAG_SITES[iata]) return { flights: await magBoard(iata, dir, ymd), source: `${iata} Airport official flight info` };
  const liveOnly = async () => ({ flights: ymd === todayLondon() ? await liveBoard(iata, dir) : [], source: "Live traffic only (ADS-B) — add AeroDataBox key for schedules", liveOnly: true });
  if (!cfg.aerodataboxKey) return liveOnly();
  const d = londonDay(ymd); const out = [];
  try { for (const [a, b] of [[0, 12], [12, 24]]) {
    const f = new Date(+new Date(d.start) + a * 3600e3).toISOString().slice(0, 16), t = new Date(+new Date(d.start) + b * 3600e3 - 60e3).toISOString().slice(0, 16);
    const r = await adb(`/flights/airports/iata/${iata}/${f}/${t}?direction=${dir === "dep" ? "Departure" : "Arrival"}&withCodeshared=false&withCancelled=true&withLeg=true`, ymd < todayLondon() ? 21600 : 120);
    out.push(...(r[dir === "dep" ? "departures" : "arrivals"] || []).map(normAdb));
  } } catch { return liveOnly(); }
  return { flights: out, source: "AeroDataBox" };
}
api.get("/board/:iata", wrap(async (req, res) => { const iata = req.params.iata.toUpperCase(); const dir = req.query.dir === "arr" ? "arr" : "dep";
  const b = await board(iata, dir, String(req.query.date || todayLondon())); const a = AP[iata];
  const [wx, st] = await Promise.all([a ? wxCached(a.lat, a.lon).catch(() => null) : null, dir === "dep" ? boardStats(iata) : null]);
  for (const f of b.flights) { if (["landed", "departed", "cancelled"].includes(f.status)) continue; const t = dir === "dep" ? f.dep.scheduled : f.arr.scheduled;
    const p = predictCore(f, dir === "dep" ? { wxDep: wxAt(wx, t), aptStats: st } : { wxArr: wxAt(wx, t) }); f.pred = { d: p.predictedDelay, on: p.probs.onTime, c: p.confidence, top: p.top, summary: p.summary, factors: p.factors.slice(0, 4) }; }
  res.json({ airport: airportOut(a), dir, ...b }); }));

async function findFlight(number, ymd) {
  number = number.toUpperCase().replace(/\s+/g, "");
  const result = { number, date: ymd, sources: [] };
  if (cfg.aerodataboxKey) { try { const r = await adb(`/flights/number/${number}/${ymd}?withAircraftImage=false&withLocation=true`, 120); if (r?.length) { result.flight = normAdb(r[0]); result.sources.push("AeroDataBox"); } } catch (e) { result.adbError = e.message; } }
  const cs = toCallsign(number);
  let route = null; if (cs) { try { route = await cached("adsbdb:" + cs, 86400, async () => (await getJSON(`https://api.adsbdb.com/v0/callsign/${cs}`)).response?.flightroute); } catch {} }
  if (!result.flight) {
    const cands = new Set(Object.keys(MAG_SITES).filter(a => !route || route.origin?.iata_code === a || route.destination?.iata_code === a));
    let dep, arr;
    for (const apt of cands) for (const dir of ["dep", "arr"]) { try { const f = (await magBoard(apt, dir, ymd)).find(x => x.number === number); if (f) dir === "dep" ? (dep = f) : (arr = f); } catch {} }
    const f = dep || arr;
    if (f) { result.flight = { ...f, dep: { ...f.dep, ...(arr && dep ? {} : {}) }, arr: arr ? arr.arr : f.arr, status: arr && ["landed"].includes(arr.status) ? "landed" : f.status }; result.sources.push(f.source); }
  }
  if (!result.flight && route) {
    result.flight = { id: `${number}-${ymd}`, number, airline: airlineOut(number.slice(0, 2)), origin: airportOut(AP[route.origin.iata_code]), destination: airportOut(AP[route.destination.iata_code]), dep: {}, arr: {}, status: "unknown", scheduleUnknown: true, source: "adsbdb route database (no schedule)" };
    result.sources.push("adsbdb (route only)");
  }
  if (result.flight) result.flight.callsign = cs;
  if (cs) { const live = await liveByCallsign(cs).catch(() => null); if (live) { result.live = live; result.sources.push(live.source); } }
  if (result.flight && !result.flight.date) result.flight.date = ymd;
  return result;
}
api.get("/flight/:number", wrap(async (req, res) => res.json(await findFlight(req.params.number, String(req.query.date || todayLondon())))));
api.get("/route", wrap(async (req, res) => { const from = String(req.query.from || "").toUpperCase(), to = String(req.query.to || "").toUpperCase(), ymd = String(req.query.date || todayLondon());
  let list = [], source = "";
  if (MAG_SITES[from]) { list = (await magBoard(from, "dep", ymd)).filter(f => !to || f.destination?.iata === to); source = "official"; }
  else if (MAG_SITES[to]) { list = (await magBoard(to, "arr", ymd)).filter(f => !from || f.origin?.iata === from); source = "official"; }
  else { const b = await board(from, "dep", ymd); list = b.flights.filter(f => !to || f.destination?.iata === to); source = b.source; }
  res.json({ flights: list, source }); }));
api.get("/live/:callsign", wrap(async (req, res) => res.json(await liveByCallsign(req.params.callsign.toUpperCase()))));
api.get("/live-area", wrap(async (req, res) => { const lat = (+req.query.lat).toFixed(1), lon = (+req.query.lon).toFixed(1);
  res.json(await cached(`area:${lat}:${lon}`, 15, async () => { const r = await getJSON(`https://api.adsb.lol/v2/point/${lat}/${lon}/100`); return (r.ac || []).filter(a => a.lat).slice(0, 300).map(a => ({ hex: a.hex, cs: (a.flight || "").trim(), lat: a.lat, lon: a.lon, track: a.track, alt: a.alt_baro, type: a.t, reg: a.r })); })); }));
api.get("/aircraft", wrap(async (req, res) => {
  let hex = String(req.query.hex || ""), reg = String(req.query.reg || ""); const out = {};
  if (hex) { try { const h = await cached("hexdb:" + hex, 86400 * 7, () => getJSON(`https://hexdb.io/api/v1/aircraft/${hex}`)); Object.assign(out, { reg: h.Registration, type: h.Type, icaoType: h.ICAOTypeCode, manufacturer: h.Manufacturer, owner: h.RegisteredOwners }); reg = reg || h.Registration; } catch {} }
  try { const p = await cached("ps:" + (hex || reg), 86400, () => getJSON(hex ? `https://api.planespotters.net/pub/photos/hex/${hex}` : `https://api.planespotters.net/pub/photos/reg/${reg}`)); const ph = p.photos?.[0];
    if (ph) out.photo = { src: ph.thumbnail_large?.src, link: ph.link, credit: ph.photographer }; } catch {}
  out.hex = hex; out.reg = out.reg || reg; res.json(out); }));
api.get("/inbound", wrap(async (req, res) => { const reg = String(req.query.reg || ""), ymd = String(req.query.date || todayLondon());
  if (!reg) return res.json({ flights: [], note: "aircraft registration not known yet" });
  const r = await adb(`/flights/reg/${reg}/${ymd}?withLocation=false`, 300); res.json({ flights: (r || []).map(normAdb), source: "AeroDataBox" }); }));
api.get("/weather", wrap(async (req, res) => { const lat = (+req.query.lat).toFixed(2), lon = (+req.query.lon).toFixed(2);
  res.json(await cached(`wx:${lat}:${lon}`, 900, () => getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,visibility&hourly=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=auto`))); }));
api.get("/forecast/:number", (req, res) => { const n = req.params.number.toUpperCase(); const h = Object.values(HIST[n] || {});
  const b = { early: 0, ontime: 0, l15: 0, l30: 0, l45: 0, cancelled: 0, diverted: 0 }; let late = [], obs = 0;
  for (const x of h) { obs++; if (x.s === "cancelled") b.cancelled++; else if (x.s === "diverted") b.diverted++; else if (x.d == null) obs--; else if (x.d < -5) b.early++; else if (x.d < 15) b.ontime++; else if (x.d < 30) { b.l15++; late.push(x.d); } else if (x.d < 45) { b.l30++; late.push(x.d); } else { b.l45++; late.push(x.d); } }
  res.json({ number: n, observed: obs, buckets: b, latePct: obs ? Math.round(late.length / obs * 100) : 0, avgLate: late.length ? Math.round(late.reduce((a, c) => a + c, 0) / late.length) : 0,
    source: "Skyline's own recordings of MAN/STN/EMA official boards (builds up over time, max 60 days)" }); });


// ================= Prediction engine (transparent weighted model; see PREDICTION.md) =================
const wxCached = (lat, lon) => cached(`wxp:${(+lat).toFixed(1)}:${(+lon).toFixed(1)}`, 900, () => getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_gusts_10m,wind_speed_10m,visibility,precipitation,weather_code&forecast_days=3&timezone=UTC`));
function wxAt(wx, iso) { if (!wx?.hourly || !iso) return null; const h = iso.slice(0, 13) + ":00"; const i = wx.hourly.time.indexOf(h); if (i < 0) return null;
  return { gust: wx.hourly.wind_gusts_10m[i], wind: wx.hourly.wind_speed_10m[i], vis: wx.hourly.visibility[i], precip: wx.hourly.precipitation[i], code: wx.hourly.weather_code[i] }; }
const Phi = z => 1 / (1 + Math.exp(-1.702 * z)); // logistic approx of normal CDF
function wxFactors(w, where) { const out = []; if (!w) return out; const add = (p, icon, title, text) => out.push({ p, icon, title, text });
  if (w.code >= 95) add(25, "⛈️", `Thunderstorms at ${where}`, `Forecast storms (WMO code ${w.code}) often cause ground stops and rerouting.`);
  else if ([71, 73, 75, 77, 85, 86].includes(w.code)) add(18, "❄️", `Snow at ${where}`, "Snow means de-icing queues and reduced runway capacity.");
  if (w.gust >= 65) add(15, "💨", `Strong gusts at ${where}`, `Gusts of ${Math.round(w.gust)} km/h reduce landing rates and can force go-arounds.`);
  else if (w.gust >= 45) add(6, "💨", `Gusty wind at ${where}`, `Gusts of ${Math.round(w.gust)} km/h can slow arrival spacing.`);
  if (w.vis != null && w.vis < 1000) add(12, "🌫️", `Fog / low visibility at ${where}`, `Visibility ${Math.round(w.vis)} m triggers low-visibility procedures with wider spacing.`);
  else if (w.vis != null && w.vis < 3000) add(4, "🌫️", `Reduced visibility at ${where}`, `Visibility around ${Math.round(w.vis / 100) / 10} km.`);
  if (w.precip >= 4) add(4, "🌧️", `Heavy rain at ${where}`, `${w.precip} mm/h forecast — slower ground handling.`);
  return out; }
function wxPenalty(w, where, R) { return wxFactors(w, where).reduce((a, x) => (R.push(x.title), a + x.p), 0); }
function predictCore(f, ctx) {
  const F = [], signals = []; let mu = 6, w0 = 1; // prior: typical short-haul mean delay ~6 min
  const step = (fn, icon, title, text, kind) => { const before = mu; fn(); const impact = Math.round(mu - before); F.push({ icon, title, text, impact, kind }); };
  const hist = Object.values(HIST[f.number] || {}).filter(x => x.d != null);
  if (hist.length >= 3) { const m = hist.reduce((a, x) => a + Math.max(-10, Math.min(180, x.d)), 0) / hist.length; const w = Math.min(hist.length, 20) / 6; signals.push("history");
    step(() => { mu = (mu * w0 + m * w) / (w0 + w); w0 += w; }, "📊", `Route history: ${m >= 0 ? "+" : ""}${Math.round(m)}m average`, `${f.number} averaged ${Math.round(m)} min vs schedule across ${hist.length} flights Skyline has recorded (up to 60 days).`, "history"); }
  if (hist.length < 3 && f.origin?.iata) { const L = learned(f.origin.iata, f.destination?.iata); const src = L.route?.n >= 5 ? ["route", L.route] : L.airport?.n >= 15 ? ["airport", L.airport] : null;
    if (src) { const [kind, v] = src, w = Math.min(v.n, 40) / 15; signals.push("learned");
      step(() => { mu = (mu * w0 + v.avg * w) / (w0 + w); w0 += w; }, "🧠", kind === "route" ? `Learned: ${f.origin.iata}→${f.destination?.iata} ${v.avg >= 0 ? "+" : ""}${v.avg}m typical` : `Learned: ${f.origin.iata} departures ${v.avg >= 0 ? "+" : ""}${v.avg}m typical`, `From ${v.n} real ${kind === "route" ? "flights on this route" : "departures from " + f.origin.iata} Skyline recorded (last 60 days): average ${v.avg} min vs schedule, ${v.late15}% were 15+ min late.`, "learned"); } }
  const st = ctx.aptStats; if (st?.avgDelay != null && st.n >= 5) { const w = 1.2; signals.push("airport");
    step(() => { mu = (mu * w0 + st.avgDelay * w) / (w0 + w); w0 += w; }, st.avgDelay >= 20 ? "🚦" : "🛫", st.avgDelay >= 20 ? `${f.origin?.iata} congested right now` : `${f.origin?.iata} running normally`, `Departures over the last 4 h: average ${st.avgDelay} min late, ${st.onTime}% on time, ${st.cancelled || 0}% cancelled (${st.n} flights, live board).`, "airport"); }
  const sd = f.dep?.scheduled; const loc = sd ? new Date(new Date(sd).toLocaleString("en-US", { timeZone: f.origin?.tz || "Europe/London" })) : null;
  if (loc) { const h = loc.getHours(), d = loc.getDay();
    if (h >= 17) step(() => { mu += 5; }, "🌆", "Evening departure bank", `Departs ${String(h).padStart(2, "0")}:00 local — knock-on delays build up through the day.`, "time");
    else if (h < 8) step(() => { mu -= 3; }, "🌅", "First wave of the day", "Early departures usually use aircraft that night-stopped, so less knock-on delay.", "time");
    if (d === 5 || d === 0) step(() => { mu += 2; }, "📅", d === 5 ? "Friday peak" : "Sunday peak", "Busier leisure days carry slightly more delay.", "time");
    if (h >= 22 || h < 1) F.push({ icon: "🌙", title: "Near night curfew window", text: "Many airports restrict late movements — big delays risk cancellation rather than late departure.", impact: 0, kind: "curfew" }); }
  let wxp = 0; for (const [w, where, k] of [[ctx.wxDep, f.origin?.iata || "departure", 1], [ctx.wxArr, f.destination?.iata || "arrival", 0.7]]) for (const x of wxFactors(w, where)) { wxp += x.p * k; step(() => { mu += x.p * k; }, x.icon, x.title, x.text + (k < 1 ? " (arrival-side, weighted 70%)" : ""), "weather"); }
  if (ctx.wxDep || ctx.wxArr) signals.push("weather");
  if (wxp === 0 && (ctx.wxDep || ctx.wxArr)) F.push({ icon: "☀️", title: "Weather looks fine", text: "No storms, strong gusts, fog or snow forecast at departure/arrival time (Open-Meteo).", impact: 0, kind: "weather" });
  if (ctx.inbound) { const ib = ctx.inbound; const slack = (new Date(sd) - new Date(ib.eta)) / 60000 - 40; signals.push("inbound");
    if (slack < 0) step(() => { mu = Math.max(mu, -slack + 3); }, "🔁", `Inbound ${ib.number} running late`, `The aircraft operating this flight is due in ${Math.round(-slack)} min after the ~40 min minimum turnaround allows.`, "inbound");
    else F.push({ icon: "🔁", title: `Inbound ${ib.number} on time`, text: `Aircraft due with ${Math.round(slack)} min spare beyond a ~40 min turnaround.`, impact: 0, kind: "inbound" }); }
  const off = f.dep?.actual || f.dep?.estimated; if (off && sd) { const d = (new Date(off) - new Date(sd)) / 60000; signals.push("official");
    step(() => { mu = d + Math.max(0, mu - d) * 0.25; }, "🏢", d >= 5 ? `Airport already shows +${Math.round(d)}m` : "Airport shows on time", `The ${f.dep?.actual ? "actual" : "estimated"} departure time published by the airline/airport is the strongest signal; other factors only add a little on top.`, "official"); }
  if (["cancelled"].includes(f.status)) return { cancelled: true, predictedDelay: null, probs: { onTime: 0, late15: 0, late45: 0, cancel: 100, divert: 0 }, confidence: "high", reasons: ["Flight is shown as cancelled by the airport"], factors: [{ icon: "⛔", title: "Cancelled", text: "Shown as cancelled by the airport.", impact: 0, sev: "high" }], summary: "Shown as cancelled by the airport." };
  const sigma = signals.includes("official") ? 8 : 14 + Math.max(0, mu) * 0.4;
  const pc = Math.min(40, 1 + (st?.cancelled || 0) * 0.6 + (wxp >= 20 ? 6 : wxp >= 10 ? 2 : 0)), pd = Math.min(10, 0.3 + (wxp >= 20 ? 2 : 0));
  const live = (100 - pc - pd) / 100; const p15 = 1 - Phi((15 - mu) / sigma), p45 = 1 - Phi((45 - mu) / sigma);
  const conf = signals.includes("official") ? "high" : signals.length >= 3 ? "medium" : "low";
  const factors = F.map(x => ({ ...x, sev: x.impact >= 15 ? "high" : x.impact >= 5 ? "med" : x.impact <= -2 ? "good" : "low" })).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  if (!factors.length) factors.push({ icon: "✈️", title: "No unusual signals", text: "Based on the typical delay for a flight like this (~6 min prior).", impact: 0, sev: "low", kind: "prior" });
  const pdl = Math.round(Math.max(-10, mu)), lo = Math.max(0, Math.round(mu - sigma * 0.5)), hi = Math.round(mu + sigma * 0.7);
  const drivers = factors.filter(x => x.impact > 0).slice(0, 2).map(x => /^[A-Z]{3}\b/.test(x.title) ? x.title : x.title[0].toLowerCase() + x.title.slice(1));
  const summary = pdl >= 10 ? `Likely ${lo}–${hi}m late${drivers.length ? " mainly because of " + drivers.join(" and ") : ""}.` : pdl >= 5 ? `Possibly a few minutes late${drivers.length ? " — " + drivers[0] : ""}.` : `Likely on time${factors.find(x => x.impact < 0) ? " — " + factors.find(x => x.impact < 0).title : ""}.`;
  const confNote = { high: "High confidence — the airport is already publishing a revised time.", medium: `Medium confidence — ${signals.length} independent real signals (${signals.join(", ")}).`, low: `Low confidence — only ${signals.length ? signals.join(", ") : "the base rate"} available${cfg.aerodataboxKey ? "" : "; an AeroDataBox key adds inbound-aircraft data"}.` }[conf];
  return { predictedDelay: pdl, range: [Math.round(Math.max(-15, mu - sigma)), Math.round(mu + sigma * 1.3)],
    probs: { onTime: Math.round((1 - p15) * live * 100), late15: Math.round(p15 * live * 100), late45: Math.round(p45 * live * 100), cancel: Math.round(pc * 10) / 10, divert: Math.round(pd * 10) / 10 },
    confidence: conf, confidenceNote: confNote, signals, factors: factors.slice(0, 8), summary, top: factors[0] ? { icon: factors[0].icon, title: factors[0].title } : null, reasons: factors.slice(0, 6).map(x => x.title), model: "skyline-weighted-v2", label: "Prediction (estimate) — not observed data" };
}
async function boardStats(iata) { if (!MAG_SITES[iata]) return null; try { return statsFrom(await magBoard(iata, "dep", todayLondon())); } catch { return null; } }
async function predictFull(number, ymd) {
  const r = await findFlight(number, ymd); const f = r.flight; if (!f) { const e = new Error("flight not found"); e.status = 404; throw e; }
  const sd = f.dep?.scheduled; const ea = f.arr?.scheduled || (sd && new Date(+new Date(sd) + 3 * 3600e3).toISOString());
  const [wd, wa, st] = await Promise.all([f.origin?.lat ? wxCached(f.origin.lat, f.origin.lon).catch(() => null) : null, f.destination?.lat ? wxCached(f.destination.lat, f.destination.lon).catch(() => null) : null, boardStats(f.origin?.iata)]);
  let inbound = null; const reg = f.aircraft?.reg || r.live?.reg;
  if (reg && cfg.aerodataboxKey) { try { const legs = (await adb(`/flights/reg/${reg}/${ymd}?withLocation=false`, 300)).map(normAdb).filter(x => x.destination?.iata === f.origin?.iata && x.arr.scheduled < sd).sort((a, b) => a.arr.scheduled < b.arr.scheduled ? 1 : -1);
    if (legs[0]) inbound = { number: legs[0].number, eta: legs[0].arr.actual || legs[0].arr.estimated || legs[0].arr.scheduled }; } catch {} }
  const p = predictCore(f, { wxDep: wxAt(wd, sd), wxArr: wxAt(wa, ea), aptStats: st, inbound });
  p.explanation = await explain(f, p);
  return { number: f.number, date: ymd, ...p };
}
async function explain(f, p) {
  const tpl = p.cancelled ? `${f.number} is shown as cancelled.` : `Skyline estimates ${f.number} ${f.origin?.iata}→${f.destination?.iata} will be ${p.predictedDelay >= 5 ? "about " + p.predictedDelay + " minutes late" : "roughly on time"} (likely range ${p.range[0]} to ${p.range[1]} min), with a ${p.probs.onTime}% chance of arriving within 15 minutes of schedule. ${p.summary || ""} Confidence is ${p.confidence}.`;
  if (!cfg.llmKey) return { text: tpl, by: "template" };
  return cached(`llm:${f.id}:${p.predictedDelay}:${p.reasons.join("|")}`, 1800, async () => {
    const r = await getJSON((cfg.llmBase || "https://api.x.ai/v1").replace(/\/$/, "") + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + cfg.llmKey },
      body: JSON.stringify({ model: cfg.llmModel || "grok-3-mini", max_tokens: 160, temperature: 0.3, messages: [{ role: "system", content: "You explain flight delay PREDICTIONS for a traveller in 2-3 short sentences. Only use the features given; it is an estimate, say so; no invented facts." }, { role: "user", content: JSON.stringify({ flight: f.number, from: f.origin?.iata, to: f.destination?.iata, scheduledDeparture: f.dep?.scheduled, prediction: p }) }] }) });
    return { text: r.choices?.[0]?.message?.content?.trim() || tpl, by: "llm" };
  }).catch(() => ({ text: tpl, by: "template" }));
}
api.get("/predict/:number", wrap(async (req, res) => res.json(await predictFull(req.params.number, String(req.query.date || todayLondon())))));

// airport status overview
const STATUS_AIRPORTS = { Europe: ["MAN", "LHR", "LGW", "STN", "EMA", "BHX", "EDI", "GLA", "BRS", "DUB", "AMS", "CDG", "ORY", "FRA", "MUC", "BER", "DUS", "HAM", "MAD", "BCN", "PMI", "AGP", "ALC", "LIS", "OPO", "FCO", "MXP", "VCE", "ZRH", "GVA", "VIE", "BRU", "CPH", "OSL", "ARN", "HEL", "WAW", "PRG", "BUD", "ATH", "IST", "SAW", "LPA", "TFS"], "North America": ["JFK", "EWR", "LGA", "BOS", "IAD", "ATL", "MCO", "MIA", "ORD", "DFW", "IAH", "DEN", "PHX", "LAS", "LAX", "SFO", "SEA", "YYZ", "YVR", "YUL", "MEX", "CUN"], Asia: ["DXB", "AUH", "DOH", "RUH", "JED", "TLV", "DEL", "BOM", "SIN", "KUL", "BKK", "CGK", "MNL", "HKG", "TPE", "ICN", "HND", "NRT", "KIX", "PEK", "PVG", "CAN"], Oceania: ["SYD", "MEL", "BNE", "PER", "AKL"], Africa: ["JNB", "CPT", "CAI", "ADD", "NBO", "CMN", "LOS"], "South America": ["GRU", "GIG", "EZE", "SCL", "BOG", "LIM"] };
const LIVEC = {}; (async function refreshLive() { for (const c of Object.values(STATUS_AIRPORTS).flat()) { if (!AP[c]) continue; try { LIVEC[c] = { ...(await liveCounts(c)), at: new Date().toISOString() }; } catch {} } setTimeout(refreshLive, 600e3); })();
function statsFrom(list, now = Date.now()) {
  const recent = list.filter(f => { const t = new Date((f.dep.scheduled || f.arr.scheduled)); return t <= now && t > now - 4 * 3600e3; });
  const ds = recent.map(delayMin).filter(d => d != null && !Number.isNaN(d)); const canc = recent.filter(f => f.status === "cancelled").length;
  return { n: recent.length, onTime: ds.length ? Math.round(ds.filter(d => d < 15).length / ds.length * 100) : null, avgDelay: ds.length ? Math.max(0, Math.round(ds.reduce((a, c) => a + Math.max(0, c), 0) / ds.length)) : null, cancelled: recent.length ? Math.round(canc / recent.length * 100) : 0 };
}
api.get("/status", wrap(async (req, res) => {
  const region = String(req.query.region || "All"); const codes = (region === "All" ? Object.values(STATUS_AIRPORTS).flat() : STATUS_AIRPORTS[region] || []).filter(c => AP[c]);
  const out = await Promise.all(codes.map(async c => { const a = airportOut(AP[c]); const reg = Object.keys(STATUS_AIRPORTS).find(k => STATUS_AIRPORTS[k].includes(c));
    try {
      if (MAG_SITES[c]) { const ymd = todayLondon(); const [d, r] = await Promise.all([magBoard(c, "dep", ymd), magBoard(c, "arr", ymd)]); return { airport: a, region: reg, dep: statsFrom(d), arr: statsFrom(r), source: "official" }; }
      if (cfg.aerodataboxKey) { const x = await adb(`/airports/iata/${c}/delays`, 1800); const s = v => v && { onTime: null, avgDelay: Math.round((v.medianDelay ? parseMed(v.medianDelay) : 0)), cancelled: v.numTotal ? Math.round((v.numCancelled || 0) / v.numTotal * 100) : 0, n: v.numTotal, index: v.delayIndex };
        return { airport: a, region: reg, dep: s(x.departuresDelayInformation), arr: s(x.arrivalsDelayInformation), source: "AeroDataBox" }; }
      return { airport: a, region: reg, unavailable: true, live: LIVEC[c] || null, source: "Live traffic only" };
    } catch (e) { return { airport: a, region: reg, unavailable: true, error: e.message }; } }));
  res.json({ airports: out, keys: { aerodatabox: !!cfg.aerodataboxKey } }); }));
const parseMed = s => { const m = String(s).match(/(\d+):(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : 0; };


// ---- Skyline Disruption Index (own index, NOT Flightradar24's) ----
// score(dir) = 5 * (0.45*min(cancelShare/0.20,1) + 0.35*min(avgDelay/60,1) + 0.20*min(late30Share/0.50,1)), last 4h, needs >=5 flights
function disruptFrom(list, now = Date.now()) {
  const recent = list.filter(f => { const t = new Date(f.dep.scheduled || f.arr.scheduled); return t <= now && t > now - 4 * 3600e3; });
  if (recent.length < 5) return { n: recent.length, score: null };
  const canc = recent.filter(f => f.status === "cancelled").length / recent.length;
  const ds = recent.filter(f => f.status !== "cancelled").map(delayMin).filter(d => d != null && !Number.isNaN(d)).map(d => Math.max(0, d));
  const avg = ds.length ? ds.reduce((a, c) => a + c, 0) / ds.length : 0, late30 = ds.length ? ds.filter(d => d > 30).length / ds.length : 0;
  const score = 5 * (0.45 * Math.min(canc / 0.2, 1) + 0.35 * Math.min(avg / 60, 1) + 0.2 * Math.min(late30 / 0.5, 1));
  return { n: recent.length, score: Math.round(score * 10) / 10, cancelledPct: Math.round(canc * 100), avgDelay: Math.round(avg), late30Pct: Math.round(late30 * 100) };
}
const wxNow = a => cached(`wxnow:${a.iata}`, 600, async () => { const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day&wind_speed_unit=kn`); const c = j.current || {};
  return { temp: c.temperature_2m, windKts: c.wind_speed_10m != null ? Math.round(c.wind_speed_10m) : null, windDir: c.wind_direction_10m, code: c.weather_code, isDay: c.is_day }; });
api.get("/disruptions", wrap(async (req, res) => {
  const out = await cached("disruptions:" + !!cfg.aerodataboxKey + ":" + Object.keys(LIVEC).length, 600, async () => { const codes = Object.values(STATUS_AIRPORTS).flat().filter(c => AP[c]);
    const rows = await Promise.all(codes.map(async c => { const ap = AP[c]; if (!ap) return null; const a = airportOut(ap); let wx = null; try { wx = await wxNow(ap); } catch {}
      try {
        if (MAG_SITES[c]) { const ymd = todayLondon(); const [d, r] = await Promise.all([magBoard(c, "dep", ymd), magBoard(c, "arr", ymd)]); return { airport: a, wx, dep: disruptFrom(d), arr: disruptFrom(r), source: "Official airport board" }; }
        if (cfg.aerodataboxKey) { const x = await adb(`/airports/iata/${c}/delays`, 1800); const s = v => { if (!v?.numTotal) return { score: null }; const canc = (v.numCancelled || 0) / v.numTotal, avg = v.medianDelay ? parseMed(v.medianDelay) : 0, l30 = Math.min(1, (v.numQualifiedDelayed || 0) / v.numTotal);
            return { n: v.numTotal, score: Math.round(50 * (0.45 * Math.min(canc / 0.2, 1) + 0.35 * Math.min(avg / 60, 1) + 0.2 * Math.min(l30 / 0.5, 1))) / 10, cancelledPct: Math.round(canc * 100), avgDelay: avg }; };
          return { airport: a, wx, dep: s(x.departuresDelayInformation), arr: s(x.arrivalsDelayInformation), source: "AeroDataBox" }; }
      } catch {}
      return { airport: a, wx, dep: { score: null }, arr: { score: null }, noData: true, live: LIVEC[c] || null, source: "Live traffic only" }; }));
    const R = rows.filter(Boolean), worst = r => Math.max(r.dep.score ?? -1, r.arr.score ?? -1);
    return { updated: new Date().toISOString(), airports: R.filter(r => worst(r) >= 0).sort((a, b) => worst(b) - worst(a)), noData: R.filter(r => worst(r) < 0).map(r => r.airport.iata), liveOnly: R.filter(r => worst(r) < 0 && r.live),
      formula: "Skyline Disruption Index (not Flightradar24): 5 × (0.45·min(cancelled/20%,1) + 0.35·min(avg delay/60m,1) + 0.20·min(share >30m late/50%,1)), last 4h, min 5 flights" }; });
  res.json({ ...out, keys: { aerodatabox: !!cfg.aerodataboxKey } }); }));


// ================= Durable state, Web Push, share links, keep-warm =================
// Store: Upstash Redis REST if UPSTASH_REDIS_REST_URL/TOKEN set (free, survives restarts), else a JSON file in DATA_DIR.
const KV_URL = process.env.UPSTASH_REDIS_REST_URL, KV_TOK = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_FILE = path.join(DATA_DIR, "state.json");
let STATE = { subs: {}, vapid: null };
async function loadState() {
  try { if (KV_URL) { const r = await getJSON(KV_URL.replace(/\/$/, "") + "/get/skyline_state", { headers: { authorization: "Bearer " + KV_TOK } }); if (r.result) Object.assign(STATE, JSON.parse(r.result)); }
    else Object.assign(STATE, JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch {}
  if (STATE.hist && typeof STATE.hist === "object") for (const k in STATE.hist) HIST[k] = { ...(HIST[k] || {}), ...STATE.hist[k] };
}
let saveT = null; function saveState() { clearTimeout(saveT); saveT = setTimeout(async () => { const body = JSON.stringify({ ...STATE, hist: KV_URL ? HIST : undefined });
  try { if (KV_URL) await fetch(KV_URL.replace(/\/$/, "") + "/set/skyline_state", { method: "POST", headers: { authorization: "Bearer " + KV_TOK }, body }); else fs.writeFileSync(STATE_FILE, body); } catch (e) { console.warn("state save failed", e.message); } }, 1500); }
setInterval(() => { if (KV_URL) saveState(); }, 30 * 60e3); // keep delay history durable too
import webpush from "web-push";
const ready = loadState().then(() => {
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) STATE.vapid = { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE };
  if (!STATE.vapid) { STATE.vapid = webpush.generateVAPIDKeys(); saveState(); }
  webpush.setVapidDetails("mailto:skyline-dev@example.com", STATE.vapid.publicKey, STATE.vapid.privateKey);
});
api.get("/push/key", wrap(async (q, r) => { await ready; r.json({ publicKey: STATE.vapid.publicKey, durable: !!KV_URL }); }));
api.post("/push/subscribe", wrap(async (req, res) => { await ready; const { sub, flights = [] } = req.body || {}; if (!sub?.endpoint) return res.status(400).json({ error: "no subscription" });
  const id = Buffer.from(sub.endpoint).toString("base64url").slice(-40); const prev = STATE.subs[id]?.flights || [];
  STATE.subs[id] = { sub, at: Date.now(), flights: flights.slice(0, 30).map(f => { const o = prev.find(p => p.number === f.number && p.date === f.date); return { number: String(f.number).toUpperCase(), date: f.date, snap: o?.snap || f.snap || null }; }) };
  saveState(); res.json({ ok: true, watching: STATE.subs[id].flights.length }); }));
api.post("/push/test", wrap(async (req, res) => { await ready; const id = Buffer.from(req.body?.endpoint || "").toString("base64url").slice(-40); const s = STATE.subs[id]; if (!s) return res.status(404).json({ error: "not subscribed" });
  await webpush.sendNotification(s.sub, JSON.stringify({ title: "Skyline notifications are on ✓", body: `Watching ${s.flights.length} flight${s.flights.length === 1 ? "" : "s"} for gate, delay and cancellation changes.` })); res.json({ ok: true }); }));
const snapOf = f => ({ status: f.status, statusText: f.statusText, gate: f.dep?.gate || null, term: f.dep?.terminal || null, belt: f.arr?.baggage || null, dly: delayMin(f) });
function diff(a, b, f) { const m = []; if (!a) return m;
  if (b.status === "cancelled" && a.status !== "cancelled") m.push("❌ Cancelled");
  if (b.gate && b.gate !== a.gate) m.push(`🚪 Gate ${a.gate ? a.gate + " → " : ""}${b.gate}`);
  if (b.term && a.term && b.term !== a.term) m.push(`Terminal ${a.term} → ${b.term}`);
  if (b.dly != null && (a.dly ?? 0) + 10 <= b.dly && b.dly >= 15) m.push(`⏱ Now ${b.dly} min late`);
  if (b.dly != null && a.dly != null && a.dly >= 15 && b.dly <= a.dly - 15) m.push(`✅ Delay reduced to ${Math.max(0, b.dly)} min`);
  if (b.belt && b.belt !== a.belt) m.push(`🧳 Baggage belt ${b.belt}`);
  if (b.status !== a.status && ["departed", "landed", "diverted", "boarding"].includes(b.status)) m.push(b.statusText || b.status);
  return m; }
async function watch() { await ready; const cache = {};
  for (const [id, s] of Object.entries(STATE.subs)) { const keep = [];
    for (const w of s.flights) { if (w.date < new Date(Date.now() - 36 * 3600e3).toISOString().slice(0, 10)) continue; keep.push(w);
      try { const k = w.number + w.date; const r = cache[k] ||= await findFlight(w.number, w.date); if (!r.flight) continue; const n = snapOf(r.flight); const msg = diff(w.snap, n, r.flight); w.snap = n;
        if (msg.length) await webpush.sendNotification(s.sub, JSON.stringify({ title: `${r.flight.number} ${r.flight.origin?.iata || ""}→${r.flight.destination?.iata || ""}`, body: msg.join(" • "), tag: k, url: "/" })).catch(e => { if (e.statusCode === 404 || e.statusCode === 410) delete STATE.subs[id]; });
      } catch {} }
    if (STATE.subs[id]) STATE.subs[id].flights = keep; }
  saveState(); }
setInterval(watch, 4 * 60e3); setTimeout(watch, 20e3);
// keep-warm self ping (Render free sleeps after ~15 min without inbound traffic)
if (process.env.RENDER_EXTERNAL_URL) setInterval(() => fetch(process.env.RENDER_EXTERNAL_URL + "/api/health").catch(() => {}), 9 * 60e3);

// Learned stats from stored history: per route and per origin airport
function learned(o, t) { const route = [], apt = [];
  for (const k in HIST) for (const x of Object.values(HIST[k])) { if (x.d == null) continue; if (x.o === o && x.t === t) route.push(x.d); if (x.o === o) apt.push(x.d); }
  const sum = a => a.length ? { n: a.length, avg: Math.round(a.reduce((s, d) => s + Math.max(-10, Math.min(180, d)), 0) / a.length), late15: Math.round(a.filter(d => d >= 15).length / a.length * 100) } : null;
  return { route: sum(route), airport: sum(apt) }; }
api.get("/learned", (req, res) => res.json(learned(String(req.query.o || "").toUpperCase(), String(req.query.t || "").toUpperCase())));

app.use("/api", api);
const dist = path.join(__dir, "../web/dist");
app.use(express.static(dist, { setHeaders: (r, p) => { if (p.endsWith("sw.js") || p.endsWith(".html")) r.setHeader("cache-control", "no-cache"); } }));
app.get(/^\/(?!api).*/, (q, r) => r.sendFile(path.join(dist, "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log("Skyline on :" + PORT));
