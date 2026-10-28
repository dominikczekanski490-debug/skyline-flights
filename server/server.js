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
const UA = "Skyline/14 (personal flight tracker; +https://github.com/dominikczekanski490-debug/skyline-flights)";
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
  const a = { name: c[1], city: c[2], country: c[3], iata: c[4], icao: c[5], lat: +c[6], lon: +c[7], elev: +c[8] || 0, tz: c[11] };
  if (a.iata) AP[a.iata] = a; if (a.icao) AP_ICAO[a.icao] = a;
}
// v23: fill missing/\N time zones for the countries we cover (OpenFlights has gaps, e.g. IST)
{ const CTZ = { Turkey: "Europe/Istanbul", Greece: "Europe/Athens", Cyprus: "Asia/Nicosia", Malta: "Europe/Malta", Romania: "Europe/Bucharest", Bulgaria: "Europe/Sofia", Serbia: "Europe/Belgrade", Croatia: "Europe/Zagreb", Albania: "Europe/Tirane", Montenegro: "Europe/Podgorica", "Bosnia and Herzegovina": "Europe/Sarajevo", Macedonia: "Europe/Skopje", "North Macedonia": "Europe/Skopje", Hungary: "Europe/Budapest", Poland: "Europe/Warsaw", Lithuania: "Europe/Vilnius", Latvia: "Europe/Riga", Estonia: "Europe/Tallinn", Moldova: "Europe/Chisinau", Slovenia: "Europe/Ljubljana", Kosovo: "Europe/Belgrade" };
  for (const a of Object.values(AP)) if ((!a.tz || a.tz === "\\N") && CTZ[a.country]) a.tz = CTZ[a.country]; }
const AL = {}, AL_ICAO = {};
for (const l of fs.readFileSync(path.join(__dir, "data/airlines.dat"), "utf8").split("\n")) {
  const c = csv(l); if (c.length < 8) continue;
  const a = { name: c[1], iata: c[3], icao: c[4], callsign: c[5], country: c[6], active: c[7] === "Y" };
  if (a.iata && a.iata !== "-" && (!AL[a.iata] || (a.active && !AL[a.iata].active))) AL[a.iata] = a;
  if (a.icao && (!AL_ICAO[a.icao] || a.active)) AL_ICAO[a.icao] = a;
}
// v23: correct stale OpenFlights rows for airlines common on the new SE-Europe boards
for (const [iata, icao, name, country] of [["GQ", "SEH", "Sky Express", "Greece"], ["EC", "EJU", "easyJet Europe", "Austria"], ["DS", "EZS", "easyJet Switzerland", "Switzerland"], ["OA", "OAL", "Olympic Air", "Greece"], ["A3", "AEE", "Aegean Airlines", "Greece"], ["CY", "CYP", "Cyprus Airways", "Cyprus"], ["KM", "KMM", "KM Malta Airlines", "Malta"], ["VF", "TKJ", "AJet", "Turkey"], ["XQ", "SXS", "SunExpress", "Turkey"], ["H4", "HLY", "HiSky", "Moldova"], ["W4", "WMT", "Wizz Air Malta", "Malta"], ["DK", "VKG", "Sunclass Airlines", "Denmark"]]) { const a = { name, iata, icao, callsign: AL_ICAO[icao]?.callsign || "", country, active: true }; AL[iata] = a; AL_ICAO[icao] = a; }
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
  const inf = INFL.get(key); if (inf && Date.now() - inf.t < 30000) return inf.p; // v15: a stuck in-flight promise can't block a key forever
  const p = cachedRun(key, ttlS, fn, h); const me = { p, t: Date.now() }; INFL.set(key, me); try { return await p; } finally { if (INFL.get(key) === me) INFL.delete(key); }
}
const INFL = new Map();
async function cachedRun(key, ttlS, fn, h) {
  try { const v = await fn(); C.set(key, { v, exp: Date.now() + ttlS * 1000, at: Date.now() }); return v; }
  catch (e) { if (h) return h.v; throw e; }
}
async function getJSON(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { "user-agent": UA, accept: "application/json", ...(opt.headers || {}) }, signal: AbortSignal.timeout(opt.timeout || 14000) });
  if (!r.ok) { const e = new Error(`${r.status} ${url.split("?")[0]}`); e.status = r.status; throw e; }
  return r.json();
}

// ---------- MAG airports (MAN/STN/EMA) — airports' own public flight-info feed ----------
const MAG = "https://d3ebfrkw2baepa.cloudfront.net/";
const MAG_SITES = { MAN: "https://www.manchesterairport.co.uk", STN: "https://www.stanstedairport.com", EMA: "https://www.eastmidlandsairport.com" };
const magQ = dir => { const f = dir === "dep" ? "allDeparturesWithinMonth" : "allArrivalsWithinMonth";
  const x = dir === "dep" ? "estimatedDepartureDateTime actualDepartureDateTime departureGate { number action }" : "estimatedArrivalDateTime actualArrivalDateTime arrivalGate { number } arrivalBaggageClaim { number }";
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
    dep: dir === "dep" ? { scheduled: f.scheduledDepartureDateTime, estimated: f.estimatedDepartureDateTime, actual: f.actualDepartureDateTime, gate: f.departureGate?.number, terminal: f.departureTerminal, gateAction: f.departureGate?.action || undefined }
                       : { scheduled: f.scheduledDepartureDateTime },
    arr: dir === "arr" ? { scheduled: f.scheduledArrivalDateTime, estimated: f.estimatedArrivalDateTime, actual: f.actualArrivalDateTime, gate: f.arrivalGate?.number, terminal: f.arrivalTerminal, baggage: f.arrivalBaggageClaim?.number }
                       : { scheduled: f.scheduledArrivalDateTime },
    statusText: f.status, status: statusFromMag(f.status), source: `${apt} Airport official flight info (${MAG_SITES[apt].replace("https://www.", "")})` };
}
// v15: MAN departures 504'd on the host (board() >25 s). Hardened: 12 s per attempt, retry once with a narrower
// window (-3 h..+12 h) and smaller page, keep the last good copy per key (served stale on failure), record errors in /api/health.
const FEED_ERR = {}; const LAST_GOOD = new Map();
const feedErr = (k, e) => { FEED_ERR[k] = { at: new Date().toISOString(), error: String(e?.message || e).slice(0, 160) }; };
async function magFetch(apt, dir, start, end, size) {
  const r = await getJSON(MAG, { method: "POST", timeout: 12000, headers: { "content-type": "application/json", origin: MAG_SITES[apt], referer: MAG_SITES[apt] + "/" },
    body: JSON.stringify({ query: magQ(dir), variables: { airportCode: apt, startDate: start, endDate: end, size } }) });
  if (r?.errors?.length && !r.data) throw new Error("MAG feed error: " + (r.errors[0].message || "").slice(0, 100));
  const list = r?.data && Object.values(r.data)[0]; if (!Array.isArray(list)) throw new Error("MAG feed returned no data"); return list; }
async function magBoard(apt, dir, ymd) {
  const ttl = ymd < todayLondon() ? 6 * 3600 : 90; const key = `mag:${apt}:${dir}:${ymd}`;
  return cached(key, ttl, async () => {
    const d = londonDay(ymd); let list;
    try { list = await magFetch(apt, dir, d.start, d.end, 1500); }
    catch (e) { feedErr(key, e); console.warn("MAG", apt, dir, e.message);
      try { const now = Date.now(); const s = ymd === todayLondon() ? new Date(Math.max(+new Date(d.start), now - 3 * 3600e3)).toISOString() : d.start;
        const en = ymd === todayLondon() ? new Date(Math.min(+new Date(d.end), now + 12 * 3600e3)).toISOString() : d.end; list = await magFetch(apt, dir, s, en, 500); }
      catch (e2) { feedErr(key, e2); const g = LAST_GOOD.get(key); if (g) return g; throw e2; } }
    const out = []; const seen = new Set();
    for (const f of list) { try { const n = normMag(f, apt, dir); if (!n.number || seen.has(n.id)) continue; seen.add(n.id); out.push(n); } catch {} }
    LAST_GOOD.set(key, out); if (LAST_GOOD.size > 40) LAST_GOOD.delete(LAST_GOOD.keys().next().value); delete FEED_ERR[key]; return out;
  });
}


// ---------- More official airport feeds (free, no key) ----------
// Avinor (Norway, 45 airports): documented open XML feed https://asrv.avinor.no/XmlFeed/v1.0
// Frankfurt (FRA): JSON endpoint used by frankfurt-airport.com's own public departures/arrivals board
// Sydney (SYD): JSON endpoint used by sydneyairport.com.au's own public flight board
const AVINOR = "OSL BGO TRD SVG TOS BOO AES KRS EVE HAU MOL KSU ALF BDU BJF BNN BVG FDE FRO HAA HFT HOV HVG KKN LKL LKN MEH MJF MQN OSY RET RRS RVK SDN SKN SOG SOJ SSJ SVJ VAW VDS VRY LYR ANX TRF".split(" ");
const getText = async (url, opt = {}) => { const r = await fetch(url, { ...opt, headers: { "user-agent": UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(opt.timeout || 14000) }); if (!r.ok) { const e = new Error(`${r.status} ${url.split("?")[0]}`); e.status = r.status; throw e; } return r.text(); };
const DE_ST = { "Geplant": "Scheduled", "Gestartet": "Departed", "Check-In": "Check-in open", "Beendet": "Boarding closed", "Gepäck": "Baggage on belt", "Gelandet": "Landed", "Annulliert": "Cancelled", "Verspätet": "Delayed", "Erwartet": "Expected", "Annulliert/Cancelled": "Cancelled", "BOR": "Boarding" };
const mkFlight = (apt, dir, otherIata, otherName, num, alCode, alName, t, statusText, status, source, extra = {}) => {
  statusText = DE_ST[statusText] || statusText;
  const here = AP[apt], there = AP[otherIata] || { iata: otherIata, name: otherName, city: otherName };
  const side = { scheduled: t.sched, estimated: t.est, actual: t.act, gate: t.gate || undefined, terminal: t.term || undefined, ...(dir === "arr" ? { baggage: t.belt || undefined } : {}) };
  const id = `${num}-${(t.sched || "").slice(0, 10)}`;
  return { id, date: id.slice(-10), number: num, airline: { ...airlineOut(alCode), name: alName || airlineOut(alCode).name }, origin: airportOut(dir === "dep" ? here : there) || there, destination: airportOut(dir === "dep" ? there : here) || there,
    dep: dir === "dep" ? side : {}, arr: dir === "arr" ? side : {}, statusText, status, source, ...extra };
};
const inDay = (iso, ymd) => { if (!iso) return false; const d = londonDay(ymd); return iso >= d.start && iso <= d.end; };
async function avinorBoard(apt, dir, ymd) {
  return cached(`avinor:${apt}:${dir}:${ymd}`, ymd < todayLondon() ? 6 * 3600 : 120, async () => {
    const d = londonDay(ymd), now = Date.now(); const from = Math.max(0, Math.ceil((now - new Date(d.start)) / 3600e3)), to = Math.max(0, Math.ceil((new Date(d.end) - now) / 3600e3));
    if (from > 7 * 24 + 1 || to > 7 * 24 + 1) return [];
    const x = await getText(`https://asrv.avinor.no/XmlFeed/v1.0?airport=${apt}&direction=${dir === "dep" ? "D" : "A"}&TimeFrom=${Math.min(from, 168)}&TimeTo=${Math.min(to, 168)}`);
    const tag = (s, n) => (s.match(new RegExp(`<${n}>([^<]*)</${n}>`)) || [])[1];
    return [...x.matchAll(/<flight [^>]*>([\s\S]*?)<\/flight>/g)].map(m => { const s = m[1]; const st = s.match(/<status code="(\w)"(?: time="([^"]+)")?/) || [];
      const sched = tag(s, "schedule_time"), code = st[1], stt = st[2] ? new Date(st[2]).toISOString() : undefined, num = (tag(s, "flight_id") || "").replace(/\s+/g, "");
      const status = { A: "landed", D: "departed", C: "cancelled", E: stt && sched && new Date(stt) - new Date(sched) >= 15 * 60e3 ? "delayed" : "scheduled", N: "scheduled" }[code] || "scheduled";
      const statusText = { A: "Arrived", D: "Departed", C: "Cancelled", E: "New time", N: "New info" }[code] || "Scheduled";
      return mkFlight(apt, dir, tag(s, "airport"), tag(s, "airport"), num, tag(s, "airline"), null,
        { sched: sched && new Date(sched).toISOString(), est: code === "E" ? stt : undefined, act: code === "A" || code === "D" ? stt : undefined, gate: tag(s, "gate"), belt: tag(s, "belt") }, statusText, status, "Avinor official flight data (avinor.no)"); })
      .filter(f => inDay(f.dep.scheduled || f.arr.scheduled, ymd));
  });
}
const FRA_API = "https://www.frankfurt-airport.com/en/_jcr_content.flights.json/filter";
const fraStatus = s => { s = (s || "").toLowerCase(); if (s.includes("cancel")) return "cancelled"; if (s.includes("divert")) return "diverted"; if (s.includes("landed") || s.includes("arrived") || s.includes("baggage")) return "landed";
  if (s.includes("departed") || s.includes("off block") || s.includes("airborne")) return "departed"; if (s.includes("boarding") || s.includes("final call")) return "boarding"; if (s.includes("gate")) return "gate"; return "scheduled"; };
async function fraBoard(apt, dir, ymd) {
  return cached(`fra:${dir}:${ymd}`, ymd < todayLondon() ? 6 * 3600 : 180, async () => {
    const d = londonDay(ymd), seen = new Map(); const page = p => getJSON(`${FRA_API}?perpage=50&lang=en-GB&page=${p}&flighttype=${dir === "dep" ? "departures" : "arrivals"}`, { headers: { referer: "https://www.frankfurt-airport.com/" } });
    const add = r => { for (const x of r.data || []) if (x.typ === "P" && x.ac !== "TRS") seen.set(x.id, x); const ts = (r.data || []).map(x => new Date(x.sched).toISOString()).sort(); return { min: ts[0], max: ts[ts.length - 1], r }; };
    const first = add(await page(1)); let p = 0, lo = first;
    while (lo.min > d.start && p > Math.max(first.r.minpage ?? -60, -60)) { lo = add(await page(p)); p--; }
    let q = 2, hi = first; while (hi.max && hi.max < d.end && q <= Math.min(first.r.maxpage ?? 40, 40)) { hi = add(await page(q)); q++; }
    return [...seen.values()].map(x => { const sched = new Date(x.sched).toISOString(), est = x.esti ? new Date(x.esti).toISOString() : undefined, st = fraStatus(x.status);
      return mkFlight(apt, dir, x.iata, x.apname, (x.fnr || "").replace(/\s+/g, ""), x.al, x.alname,
        { sched, est: st === "departed" || st === "landed" ? undefined : est, act: st === "departed" || st === "landed" ? est : undefined, gate: x.gate, term: x.terminal, belt: x.band },
        x.status || "Scheduled", st === "scheduled" && est && new Date(est) - new Date(sched) >= 15 * 60e3 ? "delayed" : st, "Frankfurt Airport official flight info (frankfurt-airport.com)", { aircraft: { reg: x.reg, type: x.ac } }); })
      .filter(f => inDay(f.dep.scheduled || f.arr.scheduled, ymd));
  });
}
const tzOff = (tz, d) => new Date(d.toLocaleString("en-US", { timeZone: tz })) - new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
const localToUtc = (tz, date, time) => { if (!date || !time || date === "-" || time === "-") return undefined; const g = new Date(`${date}T${time}:00Z`); return new Date(+g - tzOff(tz, g)).toISOString(); };
let CITY = null; const cityIata = name => { if (!name) return null; if (!CITY) { CITY = {}; for (const a of Object.values(AP)) { const k = (a.city || "").toLowerCase(); (CITY[k] = CITY[k] || []).push(a.iata); } } const c = CITY[name.toLowerCase().trim()]; if (!c) return null; if (c.length === 1) return c[0]; const hubs = new Set(Object.values(STATUS_AIRPORTS).flat()); const h = c.filter(x => hubs.has(x)); return h.length === 1 ? h[0] : null; };
async function sydBoard(apt, dir, ymd) {
  return cached(`syd:${dir}:${ymd}`, ymd < todayLondon() ? 6 * 3600 : 180, async () => {
    const d = londonDay(ymd); const days = [...new Set([d.start, d.end].map(t => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date(t))))];
    const out = [], seenSyd = new Set();
    for (const day of days) for (const tt of ["international", "domestic"]) {
      const r = await getJSON(`https://www.sydneyairport.com.au/_a/flights/?query=&flightType=${dir === "dep" ? "departure" : "arrival"}&terminalType=${tt}&date=${day}&sortColumn=scheduled_time&ascending=true&showAll=true`, { headers: { referer: "https://www.sydneyairport.com.au/" } });
      for (const x of r.flightData || []) { const s = (x.status || "").toLowerCase(), sched = localToUtc("Australia/Sydney", x.scheduledDate, x.scheduledTime), est = localToUtc("Australia/Sydney", x.estimatedDate, x.estimatedTime);
        const st = s.includes("cancel") ? "cancelled" : s.includes("divert") ? "diverted" : s.includes("arrived") || s.includes("landed") ? "landed" : s.includes("departed") ? "departed" : s.includes("boarding") || s.includes("final") ? "boarding" : s.includes("gate") ? "gate" : s.includes("delay") ? "delayed" : "scheduled";
        const place = (x.destinations || [])[0], num = (x.flightNumbers || [])[0] || "";
        let e2 = est; if (e2 && sched && s.includes("on time") && Math.abs(new Date(e2) - new Date(sched)) > 60 * 60e3) e2 = undefined; // feed contradicts itself: keep the airport's status, drop the odd time
        const done = (st === "departed" || st === "landed") && e2 && new Date(e2) <= Date.now() + 5 * 60e3;
        if (seenSyd.has(x.id)) continue; seenSyd.add(x.id);
        out.push(mkFlight(apt, dir, cityIata(place), place, num.replace(/\s+/g, ""), x.airlineCode, (x.airline || "").trim(),
          { sched, est: done ? undefined : e2, act: done ? e2 : undefined, term: x.terminalNumber }, x.status, st, "Sydney Airport official flight info (sydneyairport.com.au)", { codeshares: (x.flightNumbers || []).slice(1) })); } }
    return out.filter(f => inDay(f.dep.scheduled || f.arr.scheduled, ymd));
  });
}

// Heathrow (LHR): JSON endpoints used by heathrow.com's own public departures/arrivals board + security wait times
const LHR_API = "https://api-dp-prod.dp.heathrow.com/pihub/";
const lhrH = { headers: { origin: "https://www.heathrow.com", referer: "https://www.heathrow.com/", "accept-encoding": "gzip" } };
const zIso = u => u ? new Date(u.replace(/Z?$/, "Z")).toISOString() : undefined;
const lhrStatus = (k, m) => { m = (m || "").toLowerCase(); if (k.Cancelled || m.includes("cancel")) return "cancelled"; if (m.includes("divert")) return "diverted"; if (k.Landed) return "landed";
  if (k.Departed || k.Taxied) return "departed"; if (k.Boarding || k.FlightClosing) return "boarding"; if (k.GateOpen || k.GateClosed || k.AtGate) return "gate"; if (k.Delayed) return "delayed"; return "scheduled"; };
async function lhrBoard(apt, dir, ymd) {
  return cached(`lhr:${dir}:${ymd}`, ymd < todayLondon() ? 6 * 3600 : 120, async () => {
    const r = await getJSON(`${LHR_API}flights/${dir === "dep" ? "departures" : "arrivals"}?date=${ymd}`, lhrH); if (!Array.isArray(r)) throw new Error("LHR feed returned no data");
    return r.filter(x => x.flightService?.codeShareStatus !== "CODESHARE_MARKETING_FLIGHT").map(x => { const s = x.flightService, m = s.aircraftMovement, pc = m.route.portsOfCall;
      const here = pc.find(p => p.airportFacility?.iataIdentifier === "LHR") || pc[0], there = pc.find(p => p !== here && p.portOfCallType === (dir === "dep" ? "DESTINATION" : "ORIGIN")) || pc.find(p => p !== here) || {};
      const st = (m.aircraftMovementStatus || [])[0] || {}, k = Object.fromEntries((st.statusData || []).map(d => [d.localisationKey, d.data ?? true]));
      const sched = zIso(here.operatingTimes?.scheduled?.utc), day = (here.operatingTimes?.scheduled?.local || "").slice(0, 10);
      const hm = k.Departed || k.Landed || k.Taxied, et = k.OnTime || k.Delayed || k.Expected || k.Estimated;
      const fix = t => { if (!t || typeof t !== "string" || !/^\d\d:\d\d$/.test(t)) return undefined; let u = localToUtc("Europe/London", day, t); if (sched && u && Math.abs(new Date(u) - new Date(sched)) > 12 * 3600e3) u = new Date(+new Date(u) + (new Date(u) < new Date(sched) ? 86400e3 : -86400e3)).toISOString(); return u; };
      const tf = here.airportFacility?.terminalFacility || {}, belt = (st.message || "").match(/belt (\d+)/i)?.[1];
      const num = s.iataFlightIdentifier || ((x.flightService.airlineParty?.iataIdentifier || "") + s.flightNumber);
      return mkFlight(apt, dir, there.airportFacility?.iataIdentifier, there.airportFacility?.airportCityLocation?.name || there.airportFacility?.name, num, s.airlineParty?.iataIdentifier, s.airlineParty?.name,
        { sched, est: fix(et), act: fix(hm), gate: tf.gateFacility?.gateNumber, term: tf.code, belt: belt ? String(+belt) : undefined }, st.message || "Scheduled", lhrStatus(k, st.message), "Heathrow official flight info (heathrow.com)",
        { checkIn: tf.checkInZoneFacility?.identifier, gateShownFrom: zIso(tf.gateFacility?.gateShownFrom?.utc), codeshares: (s.codeShareSummary || "").split(/[ ,]+/).filter(Boolean), aircraft: { type: s.aircraftTransport?.icaoTypeCode } }); })
      .filter(f => inDay(f.dep.scheduled || f.arr.scheduled, ymd));
  });
}
// Security queue times: only airports that publish live numbers. Never estimated here.
const SECURITY = {
  LHR: async () => { const r = await getJSON(LHR_API + "securitywaittime", lhrH); const at = r.map(x => x.lastUpdated).sort().at(-1);
    return { source: "Heathrow official security wait times (heathrow.com)", updated: at ? localToUtc("Europe/London", at.slice(0, 10), at.slice(11, 16)) : null,
      queues: r.map(x => ({ terminal: x.checkpointFacility?.terminalFacility?.code, kind: x.checkpointFacility?.checkpointFacilityType?.code === "securityConnections" ? "Connections" : "Departures", text: x.waitTimeMessage, range: x.waitTimeRangeMinutes,
        max: x.queueMeasurements?.find(q => q.name === "maximumWaitTime")?.value ?? null, stale: !!x.isDataStale })) }; } };
const OFFICIAL = {};
for (const c of Object.keys(MAG_SITES)) OFFICIAL[c] = { fn: magBoard, label: `${c} Airport official flight info`, provider: "Official airport feed", site: MAG_SITES[c].replace("https://www.", "") };
for (const c of AVINOR) OFFICIAL[c] = { fn: avinorBoard, label: "Avinor official flight data", provider: "Official airport feed (Avinor)", site: "avinor.no" };
OFFICIAL.FRA = { fn: fraBoard, label: "Frankfurt Airport official flight info", provider: "Official airport feed", site: "frankfurt-airport.com" };
OFFICIAL.LHR = { fn: lhrBoard, label: "Heathrow official flight info", provider: "Official airport feed", site: "heathrow.com" };
OFFICIAL.SYD = { fn: sydBoard, label: "Sydney Airport official flight info", provider: "Official airport feed", site: "sydneyairport.com.au" };

// ---------- UK & Ireland official airport feeds (all public, no key; the same endpoints/pages the airports' own websites serve to browsers) ----------
// DUB (api.dublinairport.com) and ORK (corkairport.com/api) — daa flight-listing JSON (upcoming flights only)
// BFS — belfastairport.com/act/flight-tracker JSON; LDY — cityofderryairport.com/wp-content/*.json
// BHD, GCI, LTN, NOC, BOH — server-rendered HTML flight tables on the airports' own pages
const PLACE = { stansted: "STN", gatwick: "LGW", heathrow: "LHR", luton: "LTN", "london city": "LCY", southend: "SEN", "belfast city": "BHD", "george best": "BHD", "belfast int": "BFS", "glasgow prestwick": "PIK", prestwick: "PIK", "glasgow": "GLA", "dublin": "DUB", "manchester": "MAN", "birmingham": "BHX", "edinburgh": "EDI", "tenerife south": "TFS", "tenerife north": "TFN", "tenerife": "TFS", "gran canaria": "LPA", "lanzarote": "ACE", "fuerteventura": "FUE", "paris cdg": "CDG", "paris charles": "CDG", "paris beauvais": "BVA", "paris orly": "ORY", "milan bergamo": "BGY", "milan malpensa": "MXP", "rome ciampino": "CIA", "rome fiumicino": "FCO", "venice treviso": "TSF", "brussels charleroi": "CRL", charleroi: "CRL", "isle of man": "IOM", "jersey": "JER", "guernsey": "GCI", "alderney": "ACI", "kerry": "KIR", "knock": "NOC", "shannon": "SNN", "cork": "ORK", "derry": "LDY", "newquay": "NQY", "exeter": "EXT", "southampton": "SOU", "east midlands": "EMA", "london": "LHR", faro: "FAO", alicante: "ALC", malaga: "AGP", "málaga": "AGP", palma: "PMI", majorca: "PMI", amsterdam: "AMS", berlin: "BER", "new york": "JFK", krakow: "KRK", "kraków": "KRK", lisbon: "LIS", porto: "OPO", barcelona: "BCN", madrid: "MAD", geneva: "GVA", "bristol": "BRS", "newcastle": "NCL", "leeds": "LBA", "liverpool": "LPL", "aberdeen": "ABZ", "inverness": "INV", "cardiff": "CWL", "norwich": "NWI", "jersey": "JER" };
const placeIata = (name = "") => { const n = name.toLowerCase().replace(/\s+/g, " ").replace(/[()]/g, "").replace(/ int(ernational)?\.?$/, "").trim(); if (!n) return null;
  for (const k of Object.keys(PLACE).sort((a, b) => b.length - a.length)) if (n.startsWith(k) || n.includes(" " + k) || n === k) return PLACE[k];
  return cityIata(n) || cityIata(n.split(/[ -]/)[0]) || null; };
const titleCase = s => (s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, " ").trim();
const ukTimes = (ymd, hm, statusText) => { const sched = localToUtc("Europe/London", ymd, hm); const m = (statusText || "").match(/(\d{1,2}):?(\d{2})\b/); let t = m ? localToUtc("Europe/London", ymd, `${m[1].padStart(2, "0")}:${m[2]}`) : undefined;
  if (t && sched && new Date(t) - new Date(sched) < -12 * 3600e3) t = new Date(+new Date(t) + 86400e3).toISOString();
  if (t && sched && new Date(t) - new Date(sched) > 12 * 3600e3) t = new Date(+new Date(t) - 86400e3).toISOString();
  // "Bags delivered 06:01" is a baggage time, not a landing time: don't report it as the actual arrival.
  if (/^\s*(first |last )?(bags?|baggage)\b/i.test(statusText || "")) return { sched, est: undefined, act: undefined };
  const done = /landed|arrived|departed|airborne|took off|delivered/i.test(statusText || ""); if (/gate info|gate opens|check.?in/i.test(statusText || "")) t = undefined; return { sched, est: done ? undefined : t, act: done ? t : undefined }; };
const ukStatus = s => { const x = statusFromMag(s); if (x === "scheduled" && /expected|approx|estimated|new time|delay/i.test(s || "")) return "scheduled"; return x; };
const strip = h => (h || "").replace(/<span class="mobile-th">[^<]*<\/span>/g, "").replace(/<span class="details-for-small">[\s\S]*?<\/span>/g, "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const UK_SRC = {};
const ukRow = (apt, dir, ymd, { num, airline, place, hm, st, gate, belt, term, codeshares, sched, est, act, placeIataHint }) => {
  num = (num || "").replace(/\s+/g, "").toUpperCase(); if (!num) return null; const t = sched ? { sched, est, act } : ukTimes(ymd, hm, st);
  const oi = placeIataHint || placeIata(place); const alc = /^[A-Z]{3}\d/.test(num) ? (AL_ICAO[num.slice(0, 3)]?.iata || num.slice(0, 2)) : num.slice(0, 2);
  const status = /landed|arrived|bags|baggage|belt/i.test(st || "") && dir === "arr" ? "landed" : /landed|arrived/i.test(st || "") ? "landed" : /departed|airborne|taxied/i.test(st || "") ? "departed" : ukStatus(st);
  const f = mkFlight(apt, dir, oi, titleCase(place), num, alc, airline, { ...t, gate, belt, term }, st || "Scheduled", status === "scheduled" && t.est && t.sched && new Date(t.est) - new Date(t.sched) >= 15 * 60e3 ? "delayed" : status, UK_SRC[apt], codeshares ? { codeshares } : {});
  if (!AP[oi]) { const o = { iata: oi || undefined, name: titleCase(place), city: titleCase(place) }; dir === "dep" ? (f.destination = o) : (f.origin = o); } return f; };
const ukCache = (k, ymd, fn) => cached(`uk:${k}:${ymd}`, ymd < todayLondon() ? 6 * 3600 : 90, fn);
const dayOk = ymd => ymd === todayLondon();
async function daaBoard(apt, dir, ymd) { return ukCache(apt + dir, ymd, async () => {
  const base = apt === "DUB" ? "https://api.dublinairport.com/dap/flight-listing/" : "https://www.corkairport.com/api/flight-listing/";
  const site = apt === "DUB" ? "https://www.dublinairport.com" : "https://www.corkairport.com"; const out = []; const seen = new Set(); let url = `${base}${dir === "dep" ? "departures" : "arrivals"}?date=${ymd}&limit=200`;
  const r = await getJSON(url, { headers: { origin: site, referer: site + "/" } }); for (const x of r.content || []) { if (seen.has(x.internalFlightId)) continue; seen.add(x.internalFlightId);
    const sm = titleCase(x.statusMessage || ""); const done = /landed|arrived|departed|airborne/i.test(sm);
    out.push(ukRow(apt, dir, ymd, { num: x.flightIdentity, airline: x.carrierName, place: x.originAirportName || x.destinationAirportName, placeIataHint: x.airportCode, st: sm, gate: x.gate, belt: x.baggageBelt, term: x.terminalName, codeshares: x.codeShares,
      sched: x.scheduledDateTime, est: done ? undefined : x.estimatedDateTime !== x.scheduledDateTime ? x.estimatedDateTime : undefined, act: done ? (ukTimes(ymd, "00:00", sm).act || x.estimatedDateTime) : undefined })); }
  return out.filter(Boolean); }); }
async function bfsBoard(apt, dir, ymd) { if (!dayOk(ymd)) return []; return ukCache(apt + dir, ymd, async () => {
  const r = await getJSON(`https://www.belfastairport.com/act/flight-tracker/flights/${dir === "dep" ? "departures" : "arrivals"}?hours=24&limit=300`, { headers: { referer: "https://www.belfastairport.com/flights/departures" } });
  return (r.data?.flights || []).filter(x => !x.isCodeShare).map(x => { const st = x.status?.text || "Scheduled"; const done = /landed|arrived|departed/i.test(st);
    return ukRow(apt, dir, ymd, { num: x.flightNumber, airline: x.airline?.name, place: dir === "dep" ? x.destinationDisplayName : x.originDisplayName, placeIataHint: dir === "dep" ? x.destination : x.origin, st: x.status?.publicText || st,
      sched: x.scheduledTime, est: done ? undefined : x.estimatedTime && x.estimatedTime !== x.scheduledTime ? x.estimatedTime : undefined, act: x.actualTime || (done ? x.displayTime : undefined), gate: x.gate, belt: x.baggageClaim, term: x.terminal }); }).filter(Boolean); }); }
async function ldyBoard(apt, dir, ymd) { return ukCache(apt + dir, ymd, async () => {
  const r = await getJSON(`https://www.cityofderryairport.com/wp-content/${dir === "dep" ? "departures" : "arrivals"}.json`, { headers: { referer: "https://www.cityofderryairport.com/flight-information/live-flight-information/" } });
  return r.map(x => { const [d, m, y] = (x.scheduled_date || "").split("/"); const day = `${y}-${m}-${d}`; if (day !== ymd) return null;
    return ukRow(apt, dir, day, { num: x.flight_number, place: x.airport_name_1, hm: x.scheduled_flight_time, st: x.flight_status || "Scheduled" }); }).filter(Boolean); }); }
const HTML_SITES = { BHD: "https://www.belfastcityairport.com/departures", GCI: "https://www.airport.gg/arrivals-departures", LTN: "https://www.london-luton.co.uk/flights/", NOC: "https://www.irelandwestairport.com/flight-information/departures-arrivals/", BOH: "https://www.bournemouthairport.com/arrivals-departures/" };
async function htmlBoard(apt, dir, ymd) { const tmr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(Date.now() + 86400e3)); if (!dayOk(ymd) && !(ymd === tmr && /GCI|LTN|BOH/.test(apt))) return []; return ukCache(apt + dir, ymd, async () => {
  const url = apt === "LTN" ? HTML_SITES.LTN + (dir === "dep" ? "departures" : "arrivals") : HTML_SITES[apt]; const h = await getText(url, { headers: { accept: "text/html" } }); const rows = [];
  if (apt === "BHD") { const i = h.indexOf(dir === "dep" ? 'id="departuresTable"' : 'id="arrivalsTable"'); const seg = h.slice(i, h.indexOf("</table>", i));
    for (const tr of seg.split("<tr>").slice(2)) { const td = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => strip(m[1])); if (td.length < 5) continue; const [num, ...cs] = td[1].split(/\s*\/\s*|,/);
      const al = (tr.match(/alt="([^"]+?) logo"/) || [])[1]; rows.push({ hm: td[0], num, codeshares: cs.filter(Boolean), place: td[2], airline: al, st: td[4] }); } }
  if (apt === "GCI") { const i = h.indexOf(dir === "dep" ? 'id="table-departures"' : 'id="table-arrivals"'); const seg = h.slice(i, h.indexOf("</table>", i)); let day = ymd;
    for (const tr of seg.split(/<tr\b/).slice(1)) { const c = n => strip((tr.match(new RegExp(`<td class="${n}">([\\s\\S]*?)</td>`)) || [])[1]); const dt = c("date").match(/(\d\d)\/(\d\d)\/(\d{4})/); if (!dt) continue; day = `${dt[3]}-${dt[2]}-${dt[1]}`;
      if (day !== ymd) continue; rows.push({ hm: c("time"), num: c("flight"), place: c("airport"), airline: c("airline"), st: c("status") }); } }
  if (apt === "LTN") { const items = h.split('id="flightListItem"').slice(1); const ymdTxt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(ymd + "T12:00:00Z"));
    let curDay = null; const dates = [...h.matchAll(/class='flightDate'>([^<]+)</g)].map(m => [m.index, m[1].trim()]); let pos = h.indexOf('id="flightListItem"');
    for (const it of items) { const at = pos; pos = h.indexOf('id="flightListItem"', pos + 10); curDay = (dates.filter(d => d[0] < at).pop() || [0, ymdTxt])[1]; if (curDay !== ymdTxt) continue;
      const g = n => strip((it.match(new RegExp(`class="${n}">([\\s\\S]*?)</div>`)) || [])[1]); const al = (it.match(/alt="airline-(?:logo-)?([a-z0-9-]+)\./) || [])[1];
      rows.push({ num: g("flightListing__table__items__item__flightNumber"), hm: g("flightListing__table__items__item__time"), place: g("flightListing__table__items__item__flightOrgDest"), st: g("flightStatus"), airline: al && titleCase(al.replace(/-/g, " ")) }); } }
  if (apt === "NOC") { const p = dir === "dep" ? "dept_" : "arr_"; const cells = [...h.matchAll(/<div class="flight" role="row">([\s\S]*?)<\/div><\/div>/g)].map(m => m[1]).filter(r => r.includes(`aria-labelledby="${p}airline"`));
    for (const r of cells) { const c = n => strip((r.match(new RegExp(`class="${n}"[^>]*>([\\s\\S]*?)</div>`)) || [])[1]); rows.push({ airline: c("airline"), num: c("flight-number"), hm: c(dir === "dep" ? "departure-time" : "arrival-time"), place: c(dir === "dep" ? "destination" : "origin"), st: c("remarks") }); } }
  if (apt === "BOH") { const seen = new Set(); for (const m of h.matchAll(/<table class="arrivals-table">([\s\S]*?)<\/table>/g)) { const isArr = /<th class="place">From<\/th>/.test(m[1]); if (isArr !== (dir === "arr")) continue;
    for (const tr of m[1].split("<tr>").slice(2)) { const c = n => [...tr.matchAll(new RegExp(`<td[^>]*class="${n}"[^>]*>([\\s\\S]*?)</td>`, "g"))].map(x => strip(x[1])); const tm = c("time"); const num = c("flight")[0];
      if (!num || seen.has(num + tm[1])) continue; seen.add(num + tm[1]); const [dd, mm] = (tm[0] || "").split("/"); if (dd && `${ymd.slice(8)}/${ymd.slice(5, 7)}` !== `${dd}/${mm}`) continue; rows.push({ place: c("place")[0], airline: c("airline")[0], num, hm: tm[1], st: c("status")[0] }); } } }
  return rows.filter(r => /^\d{1,2}:\d{2}$/.test(r.hm || "")).map(r => ukRow(apt, dir, ymd, { ...r, hm: r.hm.padStart(5, "0") })).filter(Boolean); }); }
// Edinburgh: the public JSON API used by edinburghairport.com's own live flights pages.
const hmNear = (schedIso, st) => { const m = /(\d{1,2}):?(\d{2})/.exec(st || ""); if (!m || !schedIso) return undefined; const s = new Date(schedIso); const ymd = new Date(s).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  let t = new Date(localToUtc("Europe/London", ymd, m[1].padStart(2, "0") + ":" + m[2])); if (t - s > 12 * 3600e3) t = new Date(+t - 86400e3); if (s - t > 12 * 3600e3) t = new Date(+t + 86400e3); return t.toISOString(); };
async function ediBoard(apt, dir, ymd) { return ukCache(apt + dir, ymd, async () => {
  const r = await getJSON(`https://flights-api.edinburghairport.com/flights/${dir === "dep" ? "departures" : "arrivals"}?version=2`, { headers: { origin: "https://www.edinburghairport.com", referer: "https://www.edinburghairport.com/" } });
  return (Array.isArray(r) ? r : []).filter(x => !x.isCodeShare && new Date(x.scheduledDateTime).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) === ymd).map(x => { const st = x.status || "Scheduled"; const t = hmNear(x.scheduledDateTime, st);
    const done = /AIRBORNE|LANDED|TAXIED|DEPARTED/i.test(st); const pretty = titleCase(st.toLowerCase()).replace(/^Airborne/, "Departed");
    const f = ukRow(apt, dir, ymd, { num: x.flightNo, airline: x.airline?.name, place: x.airport?.name, placeIataHint: x.airport?.codes?.iata, st: pretty, sched: new Date(x.scheduledDateTime).toISOString(), est: done ? undefined : t, act: done ? t : undefined, gate: x.gate || undefined, belt: x.baggageBelt != null ? String(x.baggageBelt) : undefined });
    if (f && x.codeshareFlights?.length) f.codeshares = x.codeshareFlights.map(c => c.flightNo); if (f && x.callsign) f.callsign = x.callsign; if (f && x.aircraftType) f.aircraft = { ...(f.aircraft || {}), typeName: titleCase(x.aircraftType.toLowerCase()) }; return f; }).filter(Boolean); }); }
// Gatwick: the HTML fragment endpoint gatwickairport.com/flights loads (2-hour pages, page 0 = now).
async function lgwBoard(apt, dir, ymd) { if (!dayOk(ymd)) return []; return ukCache(apt + dir, ymd, async () => {
  const B = "https://www.gatwickairport.com/on/demandware.store/Sites-Gatwick-Site/en_GB/LiveFlights-FetchFlights"; const now = Date.now(), d0 = new Date(localToUtc("Europe/London", ymd, "00:00")).getTime();
  const p0 = Math.floor((d0 - now) / 7200e3), p1 = Math.ceil((d0 + 86400e3 - now) / 7200e3); const out = [], seen = new Set(); let ok = 0;
  for (let p = Math.max(p0, -12); p <= Math.min(p1, 12); p++) { let h; try { h = await getText(`${B}?page=${p}&terminal=&destination=${dir === "dep" ? "D" : "A"}&search=`, { headers: { referer: "https://www.gatwickairport.com/flights", "x-requested-with": "XMLHttpRequest" } }); ok++; } catch { continue; }
    for (const m of h.matchAll(/<tr class="flight-line[^"]*" id="([A-Z0-9]+)_(\d{4}-\d{2}-\d{2})_[AD]">([\s\S]*?)<\/tr>/g)) { if (seen.has(m[1] + m[2])) continue; seen.add(m[1] + m[2]);
      const td = [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => strip(x[1])); const alt = /alt="([^"]*)"/.exec(m[3])?.[1];
      // cells: logo, time, place, toggle, number, status, terminal
      const hm = (td[1] || "").trim(); if (!/^\d{2}:\d{2}$/.test(hm)) continue; const date = m[2];
      const f = ukRow(apt, dir, date, { num: td[4] || m[1], airline: AL_ICAO[alt]?.name, place: td[2], hm, st: td[5] || "Scheduled", term: /north/i.test(td[6]) ? "N" : /south/i.test(td[6]) ? "S" : undefined });
      if (f && (f.dep.scheduled || f.arr.scheduled) && new Date(f.dep.scheduled || f.arr.scheduled).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) === ymd) out.push(f); } }
  if (!ok) throw new Error("Gatwick feed unavailable"); return out; }); }
// Aberdeen + Southampton (AGS): the public JSON the airports' own flight-information pages call.
const agsHost = { ABZ: "www.aberdeenairport.com", SOU: "www.southamptonairport.com" };
async function agsBoard(apt, dir, ymd) { return ukCache(apt + dir, ymd, async () => { const h = agsHost[apt];
  const r = await getJSON(`https://${h}/Umbraco/api/FlightsApi/RetrieveFlights?limit=0`, { headers: { referer: `https://${h}/flight-information/`, "x-requested-with": "XMLHttpRequest" } });
  return (r?.[dir === "dep" ? "departures" : "arrivals"] || []).filter(x => (x.scheduledDateTime || "").slice(0, 10) === ymd).map(x => { const raw = (x.statusMessage?.mainMessage || "Scheduled").trim(); const st = raw.replace(/^Airborne/, "Departed").replace(/, please contact your airline/, "").replace(/\.\s*Bags at carousel\s*$/, "");
    const sched = localToUtc("Europe/London", ymd, x.scheduledDateTime.slice(11, 16)); const t = hmNear(sched, raw); const done = /^(Airborne|Arrived|Landed|Departed)/i.test(raw);
    const f = ukRow(apt, dir, ymd, { num: x.flightNumber, airline: x.airlineName, place: x.location, placeIataHint: x.locationCode, st, sched, est: done ? undefined : t, act: done ? t : undefined });
    if (f && x.codeShares?.length) f.codeshares = x.codeShares.map(c => c.flightNumber || c).filter(c => typeof c === "string"); return f; }).filter(Boolean); }); }
// Jersey: the Ports of Jersey CDN JSON the jerseyairport.com flight pages load (one file, both directions).
async function jerBoard(apt, dir, ymd) { return ukCache(apt + dir, ymd, async () => {
  const r = await cached("jer48", 60, () => getJSON(`https://cdn.ports.je/data/airportArrivals48h.json?t=${Math.floor(Date.now() / 60e3)}`, { headers: { referer: "https://www.jerseyairport.com/", origin: "https://www.jerseyairport.com" } }));
  return (r?.[dir === "dep" ? "FlightDepartureDetails" : "FlightArrivalDetails"] || []).filter(x => (x.Date || "").slice(0, 10) === ymd && /^\d{2}:\d{2}$/.test(x.Scheduled || "")).map(x => { const raw = (x.Status || "Scheduled").trim();
    const sched = localToUtc("Europe/London", ymd, x.Scheduled); const t = /\d{1,2}:\d{2}/.test(raw) ? hmNear(sched, raw) : undefined; const done = /^(Airborne|Landed|Departed)/i.test(raw);
    return ukRow(apt, dir, ymd, { num: x.Flightnumber, airline: x.Airline, place: dir === "dep" ? x.To : x.From, st: raw.replace(/^Airborne( at)?/, "Departed").replace(/^Landed at/, "Landed"), sched, est: done ? undefined : t, act: done ? t : undefined }); }).filter(Boolean); }); }
// Leeds Bradford: the Next.js server action leedsbradfordairport.co.uk/flights/* calls (rolling window, ~5h back).
// Action ids change when LBA redeploys; override with LBA_ACTION_DEP / LBA_ACTION_ARR, otherwise we fall back to observed ADS-B.
const LBA_ACT = { dep: process.env.LBA_ACTION_DEP || "be88851dd7690048df46996c09ae47bbb9586bdb", arr: process.env.LBA_ACTION_ARR || "c8bc44f9ed7b6bc4e8dee86b37c5559c5f013247" };
async function lbaBoard(apt, dir, ymd) { return ukCache(apt + dir, ymd, async () => { const path = dir === "dep" ? "departures" : "arrivals";
  const res = await fetch(`https://www.leedsbradfordairport.co.uk/flights/${path}`, { method: "POST", headers: { "next-action": LBA_ACT[dir], accept: "text/x-component", "content-type": "text/plain;charset=UTF-8", referer: `https://www.leedsbradfordairport.co.uk/flights/${path}`, "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" }, body: dir === "dep" ? "[5,3]" : "[5,3]", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("LBA feed " + res.status); const line = (await res.text()).split("\n").find(l => l.startsWith("1:")); if (!line) throw new Error("LBA feed format changed"); const a = JSON.parse(line.slice(2));
  return a.filter(x => x.PublicFlightIndicator !== "N" && x.DepartureArrivalType === (dir === "dep" ? "D" : "A") && x.ScheduledDate === ymd && !x.CodeSharePrimaryFlightId).map(x => {
    const act = dir === "dep" ? x.ATOT : (x.ALDT || x.AIBT); const st = x.FlightIsCancelled ? "Cancelled" : (x.FlightStatusText || "Scheduled").replace(/^Airborne/, "Departed");
    const f = ukRow(apt, dir, ymd, { num: (x.AirlineIATA || "") + x.FlightNumber, airline: titleCase((x.AirlineDescFormatted || x.AirlineDesc || "").toLowerCase()), place: titleCase((x.OriginDestAirportDesc || "").toLowerCase()), placeIataHint: x.OriginDestAirportIATA, st,
      sched: new Date(x.ScheduledDateTime).toISOString(), est: act ? undefined : x.EstimatedDateTime ? new Date(x.EstimatedDateTime).toISOString() : undefined, act: act ? new Date(act).toISOString() : undefined, gate: x.GateCode || undefined, belt: x.CarouselCode || undefined, term: x.TerminalCode || undefined });
    if (f && x.CallSign) f.callsign = x.CallSign; if (f && x.Registration) f.aircraft = { ...(f.aircraft || {}), reg: x.Registration }; if (f && x.AircraftTypeDesc) f.aircraft = { ...(f.aircraft || {}), typeName: x.AircraftTypeDesc, icao: x.AircraftTypeICAO }; if (f && x.StandCode) f.stand = x.StandCode; return f; }).filter(Boolean); }); }
const UK_OFFICIAL = { LBA: [lbaBoard, "Leeds Bradford Airport official flight info", "leedsbradfordairport.co.uk"], ABZ: [agsBoard, "Aberdeen Airport official flight info", "aberdeenairport.com"], SOU: [agsBoard, "Southampton Airport official flight info", "southamptonairport.com"], JER: [jerBoard, "Jersey Airport official flight info", "jerseyairport.com"], EDI: [ediBoard, "Edinburgh Airport official flight info", "edinburghairport.com"], LGW: [lgwBoard, "London Gatwick official flight info", "gatwickairport.com"], DUB: [daaBoard, "Dublin Airport official flight info", "dublinairport.com"], ORK: [daaBoard, "Cork Airport official flight info", "corkairport.com"], BFS: [bfsBoard, "Belfast International official flight info", "belfastairport.com"],
  LDY: [ldyBoard, "City of Derry Airport official flight info", "cityofderryairport.com"], BHD: [htmlBoard, "Belfast City Airport official flight info", "belfastcityairport.com"], GCI: [htmlBoard, "Guernsey Airport official flight info", "airport.gg"],
  LTN: [htmlBoard, "London Luton official flight info", "london-luton.co.uk"], NOC: [htmlBoard, "Ireland West Airport Knock official flight info", "irelandwestairport.com"], BOH: [htmlBoard, "Bournemouth Airport official flight info", "bournemouthairport.com"] };
for (const [c, [fn, label, site]] of Object.entries(UK_OFFICIAL)) { UK_SRC[c] = `${label} (${site})`; OFFICIAL[c] = { fn, label, provider: "Official airport feed", site }; }

// ---------- Western Europe (OurAirports list: commercial airports with scheduled service) ----------
// Official feeds below are the JSON endpoints each operator's own public flight board uses, tested live; no keys, no bot-protection bypass.
const WEU = JSON.parse(fs.readFileSync(path.join(__dir, "data/weu.json"), "utf8"));
const WEU_NAMES = { FR: "France", DE: "Germany", NL: "Netherlands", BE: "Belgium", LU: "Luxembourg", CH: "Switzerland", AT: "Austria", ES: "Spain", PT: "Portugal", IT: "Italy", DK: "Denmark", SE: "Sweden", FI: "Finland", IS: "Iceland", MT: "Malta" };
for (const [cc, list] of Object.entries(WEU)) for (const a of list) { if (!AP[a.iata]) { AP[a.iata] = { name: a.name, city: a.city || a.name, country: WEU_NAMES[cc], iata: a.iata, icao: a.icao, lat: a.lat, lon: a.lon, elev: 0, tz: a.tz }; if (a.icao) AP_ICAO[a.icao] = AP[a.iata]; } }
const localDayUtc = (apt, ymd) => { const tz = AP[apt]?.tz || "Europe/London"; const start = localToUtc(tz, ymd, "00:00"); const nx = new Date(new Date(ymd + "T12:00:00Z").getTime() + 864e5).toISOString().slice(0, 10); return { start, end: new Date(new Date(localToUtc(tz, nx, "00:00")).getTime() - 1).toISOString() }; };
const inLocalDay = (iso, apt, ymd) => { if (!iso) return false; const d = localDayUtc(apt, ymd); return iso >= d.start && iso <= d.end; };
const ISO = v => v ? new Date(v).toISOString() : undefined;
const genStatus = (s, dir) => { s = (s || "").toLowerCase(); if (/cancel|annul/.test(s)) return "cancelled"; if (/divert/.test(s)) return "diverted"; if (/land|arriv|onblock|on block|baggage|bag|bli\b/.test(s)) return "landed";
  if (/depart|airborne|off ?block|took off|\bair\b|termine/.test(s)) return "departed"; if (/board/.test(s)) return "boarding"; if (/gate|closed/.test(s)) return "gate"; if (/delay|retard|new time/.test(s)) return "delayed"; return "scheduled"; };
const SWEDAVIA = "ARN GOT BMA MMX LLA UME OSD VBY KRN RNB".split(" ");
async function swedaviaBoard(apt, dir, ymd) {
  return cached(`swd:${apt}:${dir}:${ymd}`, ymd < todayLondon() ? 6 * 3600 : 180, async () => {
    const r = await getJSON(`https://www.swedavia.com/services/publicflightsboard/v3/${dir === "dep" ? "departures" : "arrivals"}/en/${apt}/${ymd}`, { headers: { referer: "https://www.swedavia.com/" } });
    return (r.flights || []).map(x => { const t = (dir === "dep" ? x.departureTime : x.arrivalTime) || {}; const ls = x.locationAndStatus || {}; const li = x.flightLegIdentifier || {};
      const other = dir === "dep" ? li.arrivalAirportIata : li.departureAirportIata; const stx = ls.flightLegStatusEnglish || (x.remarksEnglish || []).map(r => r.text).join(" · ") || "Scheduled";
      const f = mkFlight(apt, dir, other, dir === "dep" ? x.arrivalAirportEnglish : x.departureAirportEnglish, (x.flightId || "").replace(/\s+/g, ""), x.airlineOperator?.iata, x.airlineOperator?.name,
        { sched: ISO(t.scheduledUtc), est: t.actualUtc ? undefined : ISO(t.estimatedUtc), act: ISO(t.actualUtc), gate: ls.gate, term: (ls.terminal || "").replace(/^T/, ""), belt: x.baggage?.baggageClaimUnit }, stx, genStatus(stx + " " + (ls.flightLegStatus === "LAN" ? "landed" : ls.flightLegStatus === "AIR" || ls.flightLegStatus === "DEP" ? "departed" : ""), dir), "Swedavia official flight board (swedavia.com)");
      if (li.callsign) f.callsign = li.callsign; if (li.aircraftRegistration) f.aircraft = { reg: li.aircraftRegistration }; return f; });
  });
}
const FINAVIA = "HEL OUL RVN TMP TKU VAA KUO JOE KAJ KEM KTT KOK MHQ IVL SVL JYV POR KAO ENF".split(" ");
async function finaviaBoard(apt, dir, ymd) {
  const all = await cached(`fin:${apt}`, 180, () => getJSON(`https://www.finavia.fi/en/api/flights/all/${apt.toLowerCase()}/now`, { headers: { referer: "https://www.finavia.fi/" } }));
  return (all[dir] || []).map(x => { const other = dir === "dep" ? x.destinationAirport : x.originAirport; const num = (x.flightNumbers || "").split(",")[0].trim(); const stx = x.statusText || (x.actualTime ? (dir === "dep" ? "Departed" : "Landed") : "Scheduled");
    return mkFlight(apt, dir, other?.iataCode, other?.routeNameEn, num, num.slice(0, 2), null, { sched: ISO(x.sdt), est: x.actualTime ? undefined : ISO(x.newTime || undefined), act: ISO(x.actualTime || undefined), gate: x.gate, term: (x.terminal || "").replace(/^T/, ""), belt: x.belt }, stx,
      x.actualTime ? (dir === "dep" ? "departed" : "landed") : genStatus(stx, dir), "Finavia official flight board (finavia.fi)", { codeshares: (x.flightNumbers || "").split(",").slice(1).map(s => s.trim()).filter(Boolean) }); })
    .filter(f => inLocalDay(f.dep.scheduled || f.arr.scheduled, apt, ymd));
}
async function vieBoard(apt, dir, ymd) {
  if (ymd !== todayLondon() && ymd !== new Date(Date.now() + 864e5).toISOString().slice(0, 10)) return [];
  const r = await cached(`vie:${dir}`, 120, () => getJSON(`https://viennaairport.com/jart/prj3/va/data/flights/${dir === "dep" ? "out" : "inc"}.json`, { headers: { referer: "https://www.viennaairport.com/" } }));
  return (r.monitor?.departure || []).map(x => { const o = (dir === "dep" ? x.destinations : x.origins) || []; const p = o[o.length - 1] || {}; const stx = x.status?.description || "Scheduled"; const code = x.status?.code || "";
    const done = /AIR|DEP|BLI|LAN|ARR/.test(code) || /landed|airborne|departed/i.test(stx);
    const f = mkFlight(apt, dir, p.iataCode, p.nameEN, (x.fn || "").replace(/\s+/g, ""), x.airline?.iataCode, x.airline?.name, { sched: ISO(x.scheduledatetime), est: done ? undefined : ISO(x.actualdatetime), act: done ? ISO(x.actualdatetime) : undefined, gate: x.gate, belt: x.belt?.belt }, stx[0]?.toUpperCase() + stx.slice(1), genStatus(stx, dir), "Vienna Airport official flight board (viennaairport.com)");
    if (x.aircraft?.description) f.aircraft = { model: x.aircraft.description }; return f; }).filter(f => inLocalDay(f.dep.scheduled || f.arr.scheduled, apt, ymd));
}
async function crlBoard(apt, dir, ymd) {
  const r = await cached("crl", 120, () => getJSON("https://www.brussels-charleroi-airport.com/fr/flights/live?donnees=1", { headers: { referer: "https://www.brussels-charleroi-airport.com/" } }));
  const blk = dir === "dep" ? r.departs : r.arrivees; if (!blk || blk.etat !== "ok") { const e = new Error(`Charleroi's own board currently reports ${dir === "dep" ? "departures" : "arrivals"} as unavailable`); e.status = 503; throw e; }
  return (blk.vols || []).filter(v => v.jour === ymd).map(v => { const stx = v.etatEn || "Scheduled"; const st = genStatus(stx, dir); const done = st === "departed" || st === "landed";
    return mkFlight(apt, dir, v.iata, v.ville, v.numero, v.code, v.compagnie, { sched: localToUtc(AP.CRL.tz, v.jour, v.heure), est: v.estimee && !done ? localToUtc(AP.CRL.tz, v.jour, v.estimee) : undefined, act: v.estimee && done ? localToUtc(AP.CRL.tz, v.jour, v.estimee) : undefined, term: v.terminal }, stx[0] + stx.slice(1).toLowerCase(), st, "Brussels South Charleroi Airport official flight board (brussels-charleroi-airport.com)"); });
}
async function dusBoard(apt, dir, ymd) {
  if (ymd !== todayLondon()) return [];
  return cached(`dus:${dir}`, 180, async () => { const out = []; for (let off = 0; off < 400; off += 20) {
    const r = await getJSON(`https://www.dus.com/api/sitecore/flightapi/SearchFlightsWithOutParams?lang=en&arrival=${dir === "arr"}&offset=${off}&codeshare=false&showDetails=false`, { headers: { "x-requested-with": "XMLHttpRequest", referer: "https://www.dus.com/en/flights/" } });
    const d = r.data || {}; for (const x of d.flights || []) { const stx = x.status?.publicStatus?.name || x.status?.description || "scheduled";
      out.push(mkFlight(apt, dir, x.destination?.iataCode, x.destination?.name, (x.flightNumber || "").replace(/\s+/g, ""), x.airline?.iataCode, x.airline?.name, { sched: ISO(x.scheduledTime), est: x.actualTime ? undefined : ISO(x.estimatedTime), act: ISO(x.actualTime), gate: (x.gate || [])[0], belt: (x.belt || [])[0] }, stx[0].toUpperCase() + stx.slice(1), genStatus(stx, dir), "Düsseldorf Airport official flight board (dus.com)")); }
    if (!d.more) break; await new Promise(r => setTimeout(r, 250)); } return out; });
}
// ---------- Fraport Greece (14 regional airports): each airport site's own JSON board feed ----------
const FRAPORT_GR = { SKG: "skg", CFU: "cfu", CHQ: "chq", EFL: "efl", KVA: "kva", JMK: "jmk", JSI: "jsi", JTR: "jtr", KGS: "kgs", MJT: "mjt", PVK: "pvk", RHO: "rho", SMI: "smi", ZTH: "zth" };
const CITY_IX2 = (() => { const m = {}; for (const a of Object.values(AP)) { if (!a.iata || !a.icao || !a.city) continue; const k = a.city.toLowerCase(); (m[k] ||= []).push(a); } return m; })();
const CITY_MAIN = { athens: "ATH", london: null, paris: null, milan: null, rome: "FCO", istanbul: null, moscow: null, berlin: "BER", brussels: "BRU", stockholm: "ARN", oslo: "OSL", heraklion: "HER", larnaca: "LCA", paphos: "PFO", vienna: "VIE", munich: "MUC", frankfurt: "FRA", amsterdam: "AMS", zurich: "ZRH", warsaw: "WAW", prague: "PRG", budapest: "BUD", bucharest: "OTP", sofia: "SOF", belgrade: "BEG", "tel aviv": "TLV", "tel aviv-yafo": "TLV", cologne: "CGN", dusseldorf: "DUS", "duesseldorf": "DUS", hamburg: "HAM", stuttgart: "STR", copenhagen: "CPH", helsinki: "HEL", dublin: "DUB", manchester: "MAN", birmingham: "BHX", rhodes: "RHO", corfu: "CFU", chania: "CHQ", kos: "KGS", thessaloniki: "SKG", santorini: "JTR", thira: "JTR", mykonos: "JMK", zakynthos: "ZTH", kefalonia: "EFL", samos: "SMI", mytilene: "MJT", kavala: "KVA", preveza: "PVK", skiathos: "JSI" };
function apByName(name) { if (!name) return null; const raw = String(name).trim(); const t = raw.match(/\b([A-Z]{3})$/); if (t && AP[t[1]]) return t[1];
  const k = raw.toLowerCase().replace(/\s+(intl|international|airport)$/, ""); if (k in CITY_MAIN) return CITY_MAIN[k]; const L = (CITY_IX2[k] || []).filter(a => a.lat > 25 && a.lat < 72 && a.lon > -30 && a.lon < 60); return L.length === 1 ? L[0].iata : null; }
const grT = (s) => s && !s.startsWith("-") ? s.replace(" ", "T").slice(0, 16) : null;
async function fraportGrBoard(apt, dir, ymd) { const host = `https://www.${FRAPORT_GR[apt]}-airport.gr`; const tz = AP[apt]?.tz || "Europe/Athens";
  const rows = await cached(`fgr:${apt}:${dir}:${ymd}`, 120, async () => { const seen = new Map(); const nx = new Date(Date.parse(ymd + "T12:00:00Z") + 86400e3).toISOString().slice(0, 10);
    for (const [d, h] of [[ymd, "00"], [ymd, "06"], [ymd, "12"], [ymd, "18"], [nx, "00"]]) { const r = await getJSON(`${host}/en/_jcr_content.${dir === "dep" ? "departures" : "arrivals"}.json?time=${d}%20${h}:00:00&perpage=300`, { headers: { referer: host + "/en/flight-list", "x-requested-with": "XMLHttpRequest" } });
      for (const x of r.data || []) seen.set(`${x.fnr}|${x.sched}`, x); } return [...seen.values()]; });
  return rows.map(x => { const [d, tm] = grT(x.sched).split("T"); const sched = localToUtc(tz, d, tm); const stx = String(x.status || "").replace(/&nbsp;/g, "").trim(); const st = stx ? genStatus(stx, dir) : "scheduled";
      const hhmm = stx.match(/(\d\d):(\d\d)/); let at = hhmm ? localToUtc(tz, d, hhmm[0]) : undefined; if (at && sched && +new Date(at) < +new Date(sched) - 12 * 3600e3) at = new Date(+new Date(at) + 86400e3).toISOString();
      const e = grT(x.esti); const est = st === "departed" || st === "landed" ? undefined : at || (e ? localToUtc(tz, ...e.split("T")) : undefined);
      const num = (x.fnr || "").replace(/\s+/g, ""); const alI = (/^[A-Z0-9]{2}\d/.test(num) ? num.slice(0, 2) : null) || AL_ICAO[x.al]?.iata; const number = /^[A-Z]{3}\d/.test(num) && alI ? alI + num.slice(3) : num;
      return mkFlight(apt, dir, apByName(x.apname), x.apname, number, alI, x.alname, { sched, est, act: st === "departed" || st === "landed" ? at : undefined, gate: x.gate || undefined, term: x.terminal || undefined, belt: x.ausgang || undefined }, stx || "Scheduled", st, `${AP[apt]?.name || apt} official flight board (${FRAPORT_GR[apt]}-airport.gr, Fraport Greece)`, { codeshares: x.cs || undefined, checkin: x.schalter || undefined }); })
    .filter(f => inLocalDay(f.dep?.scheduled || f.arr?.scheduled, apt, ymd)); }
for (const c of Object.keys(FRAPORT_GR)) if (AP[c]) OFFICIAL[c] = { fn: fraportGrBoard, label: "Fraport Greece official flight board", provider: "Official airport feed (Fraport Greece)", site: FRAPORT_GR[c] + "-airport.gr" };
// ---------- v23: Eastern Europe / Turkey / Cyprus / Malta official airport sites ----------
const htx = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
async function getText2(url, opt = {}) { const r = await fetch(url, { ...opt, headers: { "user-agent": UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(opt.timeout || 15000) });
  if (!r.ok) { const e = new Error(`${r.status} ${url.split("?")[0]}`); e.status = r.status; throw e; } return r.text(); }
const apByName2 = n => { const raw = String(n || "").trim(); const m = raw.match(/^(.+?)\s*[-–(\/]\s*([^)]+)\)?$/);
  if (m) { const c = fold(m[1]), q = fold(m[2]); const hit = Object.values(AP).filter(a => a.iata && fold(a.city) === c && (fold(a.name).includes(q) || q.split(" ").every(w => fold(a.name).includes(w)))); if (hit.length === 1) return hit[0].iata; }
  return apByName(raw) || (m ? apByName(m[1]) : null) || cityIx()[fold(raw)] || null; };
const alFromNum = n => /^[A-Z0-9]{2}\d/.test(n) ? n.slice(0, 2) : null;
// Istanbul Airport (istairport.com public FIDS JSON, 50/page)
async function istBoard(apt, dir, ymd) { const tz = "Europe/Istanbul";
  const rows = await cached(`ist:${dir}:${ymd}`, 300, async () => { const u = new Map();
    for (const intl of [1, 0]) { let from = "00:00";
      for (let i = 0; i < 30; i++) { const body = new URLSearchParams({ nature: dir === "dep" ? 1 : 0, searchTerm: "", pageNumber: 1, pageSize: 50, isInternational: intl, isCurrentTime: false, date: `${ymd} ${from}`, endDate: `${ymd} 23:59`, culture: "en" });
        let F; try { const r = await getJSON("https://www.istairport.com/umbraco/api/FlightInfo/GetFlightStatusBoard", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest", referer: "https://www.istairport.com/en/flights/departure-flights" } }); F = r?.result?.data?.flights || []; } catch { break; }
        const n0 = u.size; for (const x of F) u.set(x.id, x); const last = (F.at(-1)?.scheduledDatetime || "").slice(11, 16);
        if (F.length < 50 || !last || u.size === n0 || !last.startsWith(ymd.slice(0, 0)) || (F.at(-1).scheduledDatetime || "").slice(0, 10) !== ymd) break; from = last; await new Promise(z => setTimeout(z, 250)); } }
    return [...u.values()]; });
  return rows.map(x => { const [d, t] = (x.scheduledDatetime || "").slice(0, 16).split("T"); const sched = localToUtc(tz, d, t); const e = (x.estimatedDatetime || "").slice(0, 16);
    const rm = x.remark || "Scheduled"; const st = genStatus(rm, dir); const other = dir === "dep" ? [x.toCityCode, x.toCityName] : [x.fromCityCode, x.fromCityName];
    const est = e && e !== (x.scheduledDatetime || "").slice(0, 16) ? localToUtc(tz, ...e.split("T")) : undefined;
    return mkFlight(apt, dir, AP[other[0]] ? other[0] : apByName2(other[1]), other[1], (x.flightNumber || "").replace(/^([A-Z0-9]{2})0(\d{3,4})$/, "$1$2"), x.airlineCode, x.airlineName, { sched, est, act: st === "departed" || st === "landed" ? est || sched : undefined, gate: x.gate || undefined, belt: x.carousel || undefined }, rm, st, "Istanbul Airport official flight board (istairport.com)", { codeshares: (x.codeshare || []).join(", ") || undefined, checkin: x.counter || undefined }); })
    .filter(f => inDay(f.dep?.scheduled || f.arr?.scheduled, ymd)); }
// Hermes Airports (LCA/PFO) — server-rendered results table with date headers
async function hermesBoard(apt, dir, ymd) { const tz = "Asia/Nicosia"; const T = dir === "dep" ? "Departures" : "Arrivals";
  const html = await cached(`hermes:${apt}:${dir}`, 180, () => getText2("https://www.hermesairports.com/api/flights/search/results", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest" }, body: new URLSearchParams({ FlightsType: T, Airport: apt, [`${T}ShowAllFlights`]: "true", [`${T}FlightInfo`]: "", [`${T}Airline`]: "", [dir === "dep" ? "DeparturesTo" : "ArrivalsFrom"]: "" }) }));
  const out = []; let day = null;
  for (const r of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) { const c = (r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || []).map(htx);
    if (c.length === 1) { const d = new Date(c[0] + " 12:00 UTC"); if (!isNaN(d)) day = d.toISOString().slice(0, 10); continue; }
    if (c.length < 5 || c[1] === "Flight" || !day || day !== ymd) continue; const parts = c[1].replace(/\s+/g, "").split("/"); const n0 = parts[0].replace(/^([A-Z0-9]{2,3}?)0(\d{3,4})$/, "$1$2"); const ai = /^[A-Z]{3}\d/.test(n0) ? AL_ICAO[n0.slice(0, 3)]?.iata : null; const num = ai ? ai + n0.slice(3) : n0; const rm = c[4] || "Scheduled"; const st = c[4] ? genStatus(rm, dir) : "scheduled";
    const sched = localToUtc(tz, day, c[3]); const hm = rm.match(/(\d\d:\d\d)/); const at = hm ? localToUtc(tz, day, hm[1]) : undefined;
    out.push(mkFlight(apt, dir, apByName2(c[2]), c[2], num, ai || alFromNum(num), null,  { sched, est: st === "departed" || st === "landed" ? undefined : at, act: st === "departed" || st === "landed" ? at : undefined }, rm, st, `${AP[apt]?.name || apt} official flight board (hermesairports.com)`, { codeshares: parts.slice(1).join(", ") || undefined })); }
  return out; }
// Malta International (maltairport.com) — per-row JSON in the save-flight button
async function mlaBoard(apt, dir, ymd) { const tz = "Europe/Malta";
  const html = await cached(`mla:${dir}`, 180, () => getText2(`https://maltairport.com/flights/${dir === "dep" ? "departures" : "arrivals"}/`));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); const off = { yesterday: -1, today: 0, tomorrow: 1 }; const seen = new Set();
  return [...html.matchAll(/toggleSaveFlight\(JSON\.parse\('([^']+)'/g)].map(m => { try { return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/\\\//g, "/")); } catch { return null; } })
    .filter(x => x && /^\d\d:\d\d/.test(x.time || "") && !seen.has(x.flight_id) && seen.add(x.flight_id)).map(x => { const d = new Date(Date.parse(today + "T12:00:00Z") + (off[x.day] ?? 0) * 86400e3).toISOString().slice(0, 10);
      const num = (x.flight || "").replace(/\s+/g, ""); const n2 = /^[A-Z]{3}\d/.test(num) ? ({ EZY: "U2", RYR: "FR", WZZ: "W6" }[num.slice(0, 3)] || num.slice(0, 3)) + num.slice(3) : num; const rm = x.status || "Scheduled"; const st = genStatus(rm, dir);
      return { d, f: mkFlight(apt, dir, apByName2(x.destination || x.origin), x.destination || x.origin, n2, alFromNum(n2), x.airline, { sched: localToUtc(tz, d, (x.time || "").slice(0, 5)) }, rm, st, "Malta International Airport official flight board (maltairport.com)") }; })
    .filter(o => o.d === ymd).map(o => o.f); }
OFFICIAL.IST = { fn: istBoard, label: "Istanbul Airport official flight board", provider: "Official airport feed (iGA Istanbul)", site: "istairport.com" };
for (const c of ["LCA", "PFO"]) OFFICIAL[c] = { fn: hermesBoard, label: "Hermes Airports official flight board", provider: "Official airport feed (Hermes Airports)", site: "hermesairports.com" };
OFFICIAL.MLA = { fn: mlaBoard, label: "Malta Airport official flight board", provider: "Official airport feed (Malta International)", site: "maltairport.com" };
// Budapest Airport (bud.hu public flight-search JSON, 2-hour windows)
let BUD_Q = Promise.resolve(); const budSerial = fn => { const p = BUD_Q.then(fn, fn); BUD_Q = p.catch(() => {}); return p; };
async function budBoard(apt, dir, ymd) { const tz = "Europe/Budapest"; const D = dir === "dep" ? "departures" : "arrivals";
  // polite: sequential, per-window cache (past windows kept 6h), stop on WAF block
  const rows = []; const now = Date.now(); let fails = 0;
  for (const h of ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"]) { const end = Date.parse(localToUtc(tz, ymd, `${h}:00`)) + 2 * 3600e3; const ttl = end < now - 3 * 3600e3 ? 6 * 3600 : 600;
    let L; try { L = await cached(`bud:${dir}:${ymd}:${h}`, ttl, () => budSerial(async () => { await new Promise(z => setTimeout(z, 600)); const r = await getJSON(`https://www.bud.hu/ajax/flight-search?locale=en&query=&date=${ymd}&time=${h}:00&direction=${D}`, { headers: { "x-requested-with": "XMLHttpRequest" } }); if (!Array.isArray(r)) throw new Error("bad"); return r; })); fails = 0; } catch (e) { console.warn("bud window", h, e.message); if (++fails >= 2) break; continue; }
    rows.push(...L); }
  { const u = new Map(); for (const x of rows) u.set(x.uniqueAutoId, x); rows.splice(0, rows.length, ...u.values()); }
  if (!rows.length) throw new Error("bud.hu returned nothing (possibly rate-limited)");
  return rows.map(x => { const [dd, mm, yy] = (x.date || "").split("."); const d = `${yy}-${mm}-${dd}`; const sched = localToUtc(tz, d, x.planned); const rm = x.status?.text || "Scheduled"; const st = x.status?.type ? genStatus(x.status.type + " " + rm, dir) : genStatus(rm, dir);
      const est = x.expected && x.expected !== x.planned ? localToUtc(tz, d, x.expected) : undefined; const num = (x.flightNumber || "").replace(/\s+/g, "");
      return mkFlight(apt, dir, apByName2(x.city || x.destination), x.city || x.destination, num, alFromNum(num), x.airline?.name, { sched, est: st === "departed" || st === "landed" ? undefined : est, act: st === "departed" || st === "landed" ? est || sched : undefined, gate: x.gate || undefined, term: x.terminal || undefined, belt: x.baggageClaim || undefined }, rm, st, "Budapest Airport official flight board (bud.hu)", { codeshares: (x.codeshareFlights || []).map(c => c.flightNumber || c).join(", ") || undefined, reg: x.registration || undefined }); })
    .filter(f => inDay(f.dep?.scheduled || f.arr?.scheduled, ymd)); }
// Warsaw Chopin (lotnisko-chopina.pl) — server-rendered list the site pages with ?page=N (20 rows/page, chronological)
// v25: Warsaw stale-while-revalidate. Pages fetched 3 at a time (polite), refreshed in the background every 4 min, so requests never wait on a cold 40-page crawl after start-up.
const WAWC = {}; async function wawCrawl(op) { const H = { headers: { "x-requested-with": "XMLHttpRequest", "user-agent": "Mozilla/5.0 (compatible; Skyline personal flight tracker)" } }; const out = []; let done = false;
  for (let p = 1; p <= 40 && !done; p += 3) { const hs = await Promise.all([p, p + 1, p + 2].filter(x => x <= 40).map(x => getText2(`https://www.lotnisko-chopina.pl/en/arrivals-and-departures/?page=${x}&operation=${op}`, H).catch(() => ""))); for (const h of hs) { if (!h) { done = true; break; } out.push(h.split("Wersja desktop").slice(1)); if (!h.includes('id="load-more"')) { done = true; break; } } if (!done) await new Promise(z => setTimeout(z, 300)); }
  if (!out.length) throw new Error("Warsaw timetable unavailable"); return out.flat(); }
function wawRefresh(op) { const c = WAWC[op] || (WAWC[op] = {}); if (!c.p) c.p = wawCrawl(op).then(v => { c.v = v; c.at = Date.now(); }).finally(() => { c.p = null; }); return c.p; }
async function wawPages(op) { const c = WAWC[op] || {}; if (c.v) { if (Date.now() - c.at > 240e3) wawRefresh(op).catch(() => {}); return c.v; } await wawRefresh(op); return WAWC[op].v; }
setTimeout(() => { wawRefresh("d").catch(() => {}); setTimeout(() => wawRefresh("a").catch(() => {}), 8000); }, 3000); setInterval(() => { wawRefresh("d").catch(() => {}); setTimeout(() => wawRefresh("a").catch(() => {}), 8000); }, 240e3).unref?.();
async function wawBoard(apt, dir, ymd) { const tz = "Europe/Warsaw"; const op = dir === "dep" ? "d" : "a";
  const pages = await wawPages(op);
  const col = (r, c) => { const m = r.match(new RegExp(`column-${c}[^"]*"[^>]*>([\\s\\S]*?)</div>`)); return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""; };
  const now = new Date(); const nowHm = now.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }); const today = now.toLocaleDateString("en-CA", { timeZone: tz });
  const dayAdd = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  let d = null, prev = null; const res = [];
  for (const r of pages) { const tm = (r.match(new RegExp(`column-time[^"]*${dir === "dep" ? "departures" : "arrivals"}-col">\\s*(\\d\\d:\\d\\d)`)) || [])[1]; if (!tm) continue;
    if (!d) d = tm > nowHm && (+tm.slice(0, 2)) - (+nowHm.slice(0, 2)) > 6 ? dayAdd(today, -1) : today; else if (prev && tm < prev && (+prev.slice(0, 2)) - (+tm.slice(0, 2)) > 6) d = dayAdd(d, 1); prev = tm;
    const od = col(r, "origin-destination"); const ia = (od.match(/\(([A-Z]{3})\)\s*$/) || [])[1]; const nm = od.replace(/\s*\([A-Z]{3}\)\s*$/, "");
    const num = col(r, "flight-no").split(/[,/]/)[0].replace(/\s+/g, ""); const alName = (r.match(/airline-logo[^>]*alt="([^"]*)"|alt="([^"]*)"[^>]*airline-logo/) || []).slice(1).find(Boolean);
    const rm = col(r, "status") || "Scheduled"; const st = genStatus(rm, dir); const ex = (col(r, "expected").match(/\d\d:\d\d/) || [])[0];
    const sched = localToUtc(tz, d, tm); let est = ex ? localToUtc(tz, d, ex) : undefined; if (est && +new Date(est) < +new Date(sched) - 12 * 36e5) est = new Date(+new Date(est) + 864e5).toISOString();
    res.push(mkFlight(apt, dir, ia || apByName2(nm), nm, num, alFromNum(num), alName, { sched, est: st === "departed" || st === "landed" ? undefined : est, act: st === "departed" || st === "landed" ? est : undefined, gate: dir === "dep" ? col(r, "gate") || undefined : undefined, term: col(r, "terminal") || undefined, belt: dir === "arr" ? col(r, "belt").replace(/^Tape\s*/i, "") || undefined : undefined }, rm, st, "Warsaw Chopin Airport official flight board (lotnisko-chopina.pl)")); }
  return res.filter(f => inLocalDay(f.dep?.scheduled || f.arr?.scheduled, apt, ymd)); }
OFFICIAL.WAW = { fn: wawBoard, label: "Warsaw Chopin official flight board", provider: "Official airport feed (Polish Airports)", site: "lotnisko-chopina.pl" };
OFFICIAL.BUD = { fn: budBoard, label: "Budapest Airport official flight board", provider: "Official airport feed (Budapest Airport)", site: "bud.hu" };
for (const c of SWEDAVIA) if (AP[c]) OFFICIAL[c] = { fn: swedaviaBoard, label: "Swedavia official flight board", provider: "Official airport feed (Swedavia)", site: "swedavia.com" };
for (const c of FINAVIA) if (AP[c]) OFFICIAL[c] = { fn: finaviaBoard, label: "Finavia official flight board", provider: "Official airport feed (Finavia)", site: "finavia.fi" };
OFFICIAL.VIE = { fn: vieBoard, label: "Vienna Airport official flight board", provider: "Official airport feed", site: "viennaairport.com" };
OFFICIAL.CRL = { fn: crlBoard, label: "Brussels South Charleroi official flight board", provider: "Official airport feed", site: "brussels-charleroi-airport.com" };
OFFICIAL.DUS = { fn: dusBoard, label: "Düsseldorf Airport official flight board", provider: "Official airport feed", site: "dus.com" };
// ---- v12: more official airport websites (public endpoints their own flight pages use) ----
const v12BUA = "Mozilla/5.0 (compatible; Skyline personal flight tracker)";
const v12nameIdx = {}; for (const a of Object.values(AP)) for (const k of [a.city, a.name]) if (k) { const n = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""); if (n && !v12nameIdx[n]) v12nameIdx[n] = a.iata; }
const v12NAME_FIX = { bukarestotopeni: "OTP", palmademallorca: "PMI", londonstansted: "STN", londonluton: "LTN", londongatwick: "LGW", londonheathrow: "LHR", kattowitz: "KTW", danzig: "GDA", krakau: "KRK", warschau: "WAW", posen: "POZ", breslau: "WRO", istanbulsabihagokcen: "SAW", lissabon: "LIS", rom: "FCO", romciampino: "CIA", mailand: "MXP", mailandbergamo: "BGY", neapel: "NAP", venedig: "VCE", gerona: "GRO", girona: "GRO", teneriffasud: "TFS", teneriffa: "TFS", tenerifesouth: "TFS", grancanaria: "LPA", lanzarote: "ACE", fuerteventura: "FUE", kopenhagen: "CPH", copenhagen: "CPH", amsterdam: "AMS", oslo: "OSL", stockholm: "ARN", helsinki: "HEL", paris: "CDG", london: "LHR", sofia: "SOF", tirana: "TIA", skopje: "SKP", belgrad: "BEG", sarajevo: "SJJ", pristina: "PRN", banjaluka: "BNX", kutaisi: "KUT", podgorica: "TGD", tuzla: "TZL", nisch: "INI", nis: "INI", chisinau: "RMO", kischinau: "RMO", iasi: "IAS", cluj: "CLJ", klausenburg: "CLJ", temeswar: "TSR", hurghada: "HRG", antalya: "AYT", izmir: "ADB", malaga: "AGP", alicante: "ALC", faro: "FAO", porto: "OPO", dublin: "DUB", manchester: "MAN", edinburgh: "EDI" };
const v12iataOf = n => { if (!n) return undefined; const k = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""); return v12NAME_FIX[k] || v12nameIdx[k]; };
const v12dmy = s => { const m = /(\d{2})[.\/-](\d{2})[.\/-](\d{4})\s*(\d{2}):?(\d{2})/.exec(s || ""); return m ? [`${m[3]}-${m[2]}-${m[1]}`, `${m[4]}:${m[5]}`] : null; };
const v12locIso = (apt, s) => { const p = v12dmy(s); return p ? localToUtc(AP[apt].tz, p[0], p[1]) : undefined; };
const v12hmNear = (apt, ymd, hm, ref) => { if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return undefined; let t = localToUtc(AP[apt].tz, ymd, hm.slice(0, 5).padStart(5, "0")); if (ref && t) { const d = (+new Date(t) - +new Date(ref)) / 36e5; if (d < -12) t = new Date(+new Date(t) + 864e5).toISOString(); if (d > 12) t = new Date(+new Date(t) - 864e5).toISOString(); } return t; };
const v12dayFilter = (L, apt, ymd, dir) => L.filter(f => inLocalDay((dir === "dep" ? f.dep : f.arr).scheduled, apt, ymd));
const v12splitNum = s => { const m = /^([A-Z0-9]{2})\s*0*(\d{1,4}[A-Z]?)$/.exec((s || "").trim().toUpperCase().replace(/\s+/g, " ")); return m ? [m[1], m[1] + m[2]] : [undefined, (s || "").replace(/\s+/g, "")]; };

// Aena (all Spanish state airports incl. Canary and Balearic Islands): aena.es Infovuelos JSON, POST as the page does.
const AENA_ST = { SCH: "Scheduled", HOR: "On time", RET: "Delayed", CAN: "Cancelled", FLY: "In flight", EMB: "Boarding", ULL: "Last call", PRO: "Boarding soon", DES: "Departed", DSP: "Departed", LLE: "Landed", ATE: "Landed", ATR: "Landed", REC: "Baggage on belt", DIV: "Diverted", SAL: "Departed", ENV: "In flight", CER: "Gate closed", INI: "Check-in open", FIN: "Check-in closed" };
let AENA_Q = Promise.resolve();
const aenaSerial = fn => { const p = AENA_Q.then(fn, fn); AENA_Q = p.catch(() => {}); return p; };
async function aenaBoard(apt, dir, ymd) {
  // v12.1: memory-safe. Raw Aena two-day list is ~4 MB / 4,000 rows at MAD; parse once, keep a -3h..+12h window,
  // merge codeshares (same time + other airport) into one row, cap 400, and never hold the raw JSON in cache.
  const all = await cached(`aena:${apt}:${dir}`, 240, () => aenaSerial(async () => {
    const r = await fetch(`https://www.aena.es/sites/Satellite?pagename=AENA_ConsultarVuelos&airport=${apt}&flightType=${dir === "dep" ? "S" : "L"}&dosDias=si`, { method: "POST", headers: { "user-agent": v12BUA, "content-length": "0", referer: "https://www.aena.es/en/flight-info.html" }, signal: AbortSignal.timeout(14000) });
    if (!r.ok) throw new Error(`Aena ${r.status}`); let d = await r.json(); if (!Array.isArray(d)) throw new Error("Aena: no list");
    const now = Date.now(), lo = now - 3 * 36e5, hi = now + 12 * 36e5; const groups = new Map();
    for (const x of d) { const sched = v12locIso(apt, `${x.fecha} ${x.horaProgramada}`); if (!sched) continue; const t = +new Date(sched); if (t < lo || t > hi) continue;
      const k = `${sched}|${x.iataOtro}`; const g = groups.get(k); const num = `${x.iataCompania || ""}${x.numVuelo}`;
      if (g) { if (!g.cs.includes(num)) g.cs.push(num); continue; }
      groups.set(k, { x: { fecha: x.fecha, horaProgramada: x.horaProgramada, fechaEstimada: x.fechaEstimada, horaEstimada: x.horaEstimada, iataOtro: x.iataOtro, ciudadIataOtro: x.ciudadIataOtro, estado: x.estado, terminal: x.terminal, puertaPrimera: x.puertaPrimera, cintaPrimera: x.cintaPrimera, iataCompania: x.iataCompania, nombreCompania: x.nombreCompania, tipoAeronave: x.tipoAeronave }, sched, num, cs: [] }); }
    d = null;
    const rows = [...groups.values()].sort((a, b) => a.sched < b.sched ? -1 : 1).slice(0, 400);
    return rows.map(({ x, sched, num, cs }) => { const est = v12locIso(apt, `${x.fechaEstimada} ${x.horaEstimada}`); const st = AENA_ST[x.estado] || (x.estado ? x.estado : "Scheduled");
      const done = dir === "dep" ? /^(FLY|DES|DSP|SAL|ENV)$/.test(x.estado) : /^(LLE|ATE|ATR|REC)$/.test(x.estado);
      return mkFlight(apt, dir, x.iataOtro, (x.ciudadIataOtro || "").replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()), num, x.iataCompania, x.nombreCompania,
        { sched, est: done ? undefined : (est !== sched ? est : undefined), act: done ? est : undefined, term: x.terminal, gate: x.puertaPrimera && x.puertaPrimera !== "null" ? x.puertaPrimera : undefined, belt: x.cintaPrimera && x.cintaPrimera !== "null" ? x.cintaPrimera : undefined },
        st, x.estado === "CAN" ? "cancelled" : done ? (dir === "dep" ? "departed" : "landed") : genStatus(st, dir), "Aena official flight information (aena.es)", { aircraft: { type: x.tipoAeronave }, ...(cs.length ? { codeshares: cs } : {}) }); });
  }));
  return v12dayFilter(all, apt, ymd, dir);
}

// Berlin BER: api.flights.json used by ber.berlin-airport.de departures/arrivals page.
async function berBoard(apt, dir, ymd) {
  return cached(`ber:${dir}:${ymd}`, 180, async () => { const out = []; for (let p = 1; p <= 20; p++) {
    const r = await getJSON(`https://ber.berlin-airport.de/api.flights.json?arrivalDeparture=${dir === "dep" ? "D" : "A"}&dateFrom=${ymd}T00:00:00&dateUntil=${ymd}T23:59:59&search=&lang=en&page=${p}&terminal=&itemsPerPage=100`, { headers: { "user-agent": v12BUA, referer: "https://ber.berlin-airport.de/en/flying/departures-arrivals.html", accept: "application/json" } });
    const L = r?.data?.items || []; for (const x of L) { const s = dir === "dep" ? x.dep_scheduled_time || x.scheduled_time : x.arr_scheduled_time || x.scheduled_time; const e = dir === "dep" ? x.dep_estimated_time : x.arr_estimated_time; const st = x.flight_status_label || "Scheduled"; const g = genStatus(x.flight_status_id || st, dir);
      const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed"); const [al, num] = v12splitNum(x.flight_number);
      out.push(mkFlight(apt, dir, dir === "dep" ? x.arr_airport_iata : x.dep_airport_iata, dir === "dep" ? x.arr_airport_name : x.dep_airport_name, num, x.airline_code || al, x.airline_name, { sched: ISO(s), est: done ? undefined : ISO(e), act: done ? ISO(e) : undefined, term: x.terminal, gate: x.gate, belt: x.arr_belt }, st, g, "BER Berlin Brandenburg Airport official flight board (berlin-airport.de)", { aircraft: { type: x.aircraft_type, reg: x.aircraft_reg } })); }
    const m = r?.data?.meta || r?.meta || {}; if (L.length < 100 || (m.last_page && p >= m.last_page)) break; } return out; });
}

// Munich: flightsearch HTML fragment used by munich-airport.com all-departures/all-arrivals page.
async function mucBoard(apt, dir, ymd) {
  return cached(`muc:${dir}:${ymd}`, 180, async () => { const out = [], seen = new Set(); let from = `${ymd}T00:00:00`;
    for (let p = 0; p < 30; p++) { const h = await getText(`https://www.munich-airport.com/flightsearch/${dir === "dep" ? "departures" : "arrivals"}?from=${encodeURIComponent(from)}&allow_scroll_back=0&per_page=100&allow_pagination=1&min_date=${ymd}T00%3A00%3A00`, { headers: { "user-agent": v12BUA, referer: "https://www.munich-airport.com/all-departures-1450598" } });
      const day = /am (\d{2})\.(\d{2})\.(\d{4})/.exec(h); const dy = day ? `${day[3]}-${day[2]}-${day[1]}` : ymd; if (dy !== ymd) break; let added = 0, last;
      for (const m of h.matchAll(/<tr data-flight-id="([\d.]+)" class="fp-flight-item">([\s\S]*?)<\/tr>/g)) { const id = m[1], b = m[2]; if (seen.has(id)) continue; seen.add(id); added++;
        const tx = c => (new RegExp(`class="${c}"[^>]*>([\\s\\S]*?)</td>`).exec(b)?.[1] || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        const ap = tx("fp-flight-airport"), apI = /\(([A-Z]{3})\)/.exec(ap)?.[1], nm = tx("fp-flight-number"), [, fn] = /^([A-Z0-9]{2,3} ?\d{1,4}[A-Z]?)/.exec(nm) || [, nm]; const tm = tx("fp-flight-time-muc").split("|").map(s => s.trim()).filter(Boolean);
        const airline = /aria-label="([^"]+)"/.exec(b)?.[1]; const stx = tx("fp-flight-status"); const sched = v12hmNear(apt, ymd, tm[0]); last = tm[0];
        const est = tm[1] ? v12hmNear(apt, ymd, tm[1], sched) : undefined; const g = genStatus({ gestartet: "departed", gelandet: "landed", annulliert: "cancelled", verspätet: "delayed" }[stx.toLowerCase()] || stx, dir);
        const [al, num] = v12splitNum(fn.replace(/^([A-Z]{3}) /, (_, i) => (Object.entries(v12AL_ICAO || {}).find(([k]) => k === i)?.[1] || i) + " ")); const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed");
        out.push(mkFlight(apt, dir, apI, ap.replace(/\s*\([A-Z]{3}\)/, ""), num, al, airline, { sched, est: done ? undefined : est, act: done ? est : undefined, term: tx("fp-flight-area") }, stx ? stx[0].toUpperCase() + stx.slice(1) : "Scheduled", g, "Munich Airport official flight search (munich-airport.com)", { aircraft: { type: /\(([A-Z0-9]{3,4})\)/.exec(nm)?.[1] } })); }
      if (!added || !last) break; from = `${ymd}T${last}:00`; if (added < 3) break; }
    return out; });
}
const v12AL_ICAO = {};

// Dortmund: flight-schedule.json used by dortmund-airport.com departures page (local times, today).
async function dtmBoard(apt, dir, ymd) {
  const d = await cached("dtm", 180, () => getJSON("https://www.dortmund-airport.com/flight-schedule.json", { headers: { "user-agent": v12BUA, referer: "https://www.dortmund-airport.com/departures" } }));
  return v12dayFilter((d[dir === "dep" ? "departures" : "arrivals"] || []).map(x => { const sched = v12locIso(apt, x.scheduledTime), est = v12locIso(apt, x.expectedTime); const [al, num] = v12splitNum(x.flightNumber);
    const stc = { DP: "Departed", LD: "Landed", BO: "Boarding", GC: "Gate closed", DL: "Delayed", CX: "Cancelled", AR: "Landed" }[x.status] || (x.cancelled ? "Cancelled" : "Scheduled"); const g = genStatus(stc, dir); const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed");
    return mkFlight(apt, dir, v12iataOf(x.destination), x.destination, num, al, x.airline, { sched, est: done || est === sched ? undefined : est, act: done ? est : undefined, gate: x.gate }, stc, g, "Dortmund Airport official flight schedule (dortmund-airport.com)", { aircraft: { type: x.aircraftType } }); }), apt, ymd, dir);
}

// Weeze: api/flights.json used by airport-weeze.com (HTML rows; first block = today).
async function nrnBoard(apt, dir, ymd) {
  if (ymd !== v12todayLocal(apt)) return [];
  const d = await cached("nrn", 180, () => getJSON("https://airport-weeze.com/api/flights.json", { headers: { "user-agent": v12BUA, referer: "https://airport-weeze.com/" } }));
  const h = (d[dir === "dep" ? "return_html_departures" : "return_html_arrivals"] || "").split('class="fs__flights"')[1] || ""; const out = [];
  for (const r of h.split('class="fs__row fs__body"').slice(1)) { const g1 = re => (re.exec(r)?.[1] || "").replace(/<[^>]+>/g, "").trim(); const fn = g1(/data-label="Flugnr\.">([^<]*)</); const city = g1(/airport-name complete">([^<]*)</);
    const st = g1(/status__name">([^<]*)</); const sch = g1(/data-label="Geplant"><div>([^<]*)</); const exp = g1(/data-label="Erwartet"><div>([^<]*)</); const sched = v12hmNear(apt, ymd, sch), est = v12hmNear(apt, ymd, exp, sched);
    const en = { gestartet: "Departed", gelandet: "Landed", annulliert: "Cancelled", verspätet: "Delayed", boarding: "Boarding", "gate geschlossen": "Gate closed" }[st.toLowerCase()] || st || "Scheduled"; const g = genStatus(en, dir); const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed"); const [al, num] = v12splitNum(fn);
    out.push(mkFlight(apt, dir, v12iataOf(city), city, num, al, undefined, { sched, est: done ? undefined : est, act: done ? est : undefined }, en, g, "Airport Weeze official flight board (airport-weeze.com)")); }
  return out;
}
const v12todayLocal = apt => new Intl.DateTimeFormat("en-CA", { timeZone: AP[apt].tz }).format(new Date());

// Luxembourg: Luxair flight-data API used by lux-airport.lu departures/arrivals pages.
async function luxBoard(apt, dir, ymd) {
  return cached(`lux:${dir}:${ymd}`, 180, async () => { const d = await getJSON(`https://luxair-flightdata-1.azurewebsites.net/api/v1/Flights?Day=${ymd}&Sens=${dir === "dep" ? "D" : "A"}&updateMarker=0`, { headers: { "user-agent": v12BUA, referer: "https://www.lux-airport.lu/", origin: "https://www.lux-airport.lu" } });
    return (d.flights || []).map(x => { const sched = localToUtc(AP[apt].tz, x.schDate.slice(0, 10), x.schDate.slice(11, 16)); const other = Object.keys(x.stops || {})[0]; const act = v12hmNear(apt, ymd, dir === "dep" ? x.timeRunway || x.timeFinal : x.timeRunway || x.timeFinal, sched); const est = v12hmNear(apt, ymd, x.timeEstimated, sched);
      const stc = { DE: "Departed", AR: "Landed", LA: "Landed", CA: "Cancelled", CX: "Cancelled", BO: "Boarding", DL: "Delayed", GC: "Gate closed" }[x.statusCode] || (x.boarding ? "Boarding" : x.approach ? "Approaching" : "Scheduled"); const g = genStatus(stc, dir);
      const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed");
      return mkFlight(apt, dir, other, (x.stops || {})[other], `${x.iataAirCode}${x.flightNum}`, x.iataAirCode, x.airline, { sched, est: done ? undefined : est, act: done ? act : undefined, term: x.terminal, gate: x.boardGates, belt: x.belt }, stc, g, "Luxembourg Airport official flight data (lux-airport.lu)", { aircraft: { type: x.aircraftType } }); }); });
}

// Billund: FtpData JSON used by bll.dk departures/arrivals pages (Yesterday/Today/Tomorrow, local).
async function bllBoard(apt, dir, ymd) {
  const d = await cached(`bll:${dir}`, 180, () => getJSON(`https://www.bll.dk/umbraco/surface/FtpData/${dir === "dep" ? "Departure" : "Arrival"}FlightsData`, { headers: { "user-agent": v12BUA, referer: "https://www.bll.dk/en/flight-traffic/departures" } }));
  const out = []; for (const k of ["Yesterday", "Today", "Tomorrow"]) for (const x of d[k] || []) { const sched = v12locIso(apt, x.ScheduledDepartureTime.replace(/ (\d{2})(\d{2})$/, " $1:$2")); const est = x.EstimatedTime ? v12hmNear(apt, sched ? sched.slice(0, 10) : ymd, x.EstimatedTime, sched) : undefined;
    const st = x.Status || (x.CheckInInformation || []).find(s => /cancel/i.test(s)) || "Scheduled"; const g = genStatus(st, dir); const oth = dir === "dep" ? x.ArrivalAirport : x.DepartureAirport; const c = x.AdministratingFlightCode || {};
    const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed");
    out.push(mkFlight(apt, dir, oth?.Code || v12iataOf(oth?.Name), oth?.Name, c.Code, c.Airline?.Code, c.Airline?.Name, { sched, est: done ? undefined : est, act: done ? est : undefined }, st, g, "Billund Airport official flight data (bll.dk)")); }
  return v12dayFilter(out, apt, ymd, dir);
}

// Nuremberg: flight-status API used by airport-nuernberg.de flight-status page (UTC times, several days).
async function nueBoard(apt, dir, ymd) {
  const d = await cached(`nue:${dir}`, 180, () => getJSON(`https://airportnue-service.justrelate.io/production/api/flight-status/${dir === "dep" ? "departures" : "arrivals"}?lang=en`, { headers: { "user-agent": v12BUA, referer: "https://www.airport-nuernberg.de/" } }));
  return v12dayFilter((d || []).map(x => { const o = dir === "dep" ? x.toAirport : x.fromAirport; const lab = x.status?.label || "scheduled"; const g = genStatus(lab === "started" ? "departed" : lab, dir); const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed");
    const t = ISO(x.status?.time); const sched = ISO(x.scheduledTime); const stx = lab.replace(/-/g, " "); return mkFlight(apt, dir, o?.iata, o?.name, `${x.flight.airline.iata}${x.flight.number}`, x.flight.airline.iata, x.flight.airline.name, { sched, est: done || t === sched ? undefined : t, act: done ? t : undefined, term: x.terminal, gate: x.gate, belt: x.belt || x.baggageBelt },
      stx[0].toUpperCase() + stx.slice(1), g, "Nuremberg Airport official flight status (airport-nuernberg.de)", { aircraft: { type: x.aircraft?.iata, reg: x.aircraft?.registration || undefined } }); }), apt, ymd, dir);
}

// Rotterdam The Hague: rtha/v2/flights JSON used by rotterdamthehagueairport.nl (today).
async function rtmBoard(apt, dir, ymd) {
  const d = await cached("rtm", 180, () => getJSON("https://www.rotterdamthehagueairport.nl/en/wp-json/rtha/v2/flights/", { headers: { "user-agent": v12BUA, referer: "https://www.rotterdamthehagueairport.nl/en/" } }));
  return v12dayFilter((d || []).filter(x => x.movementType === (dir === "dep" ? "D" : "A")).map(x => { const o = dir === "dep" ? x.arrivalAirport : x.departureAirport; const st = x.flightStatusName || "Scheduled"; const s = dir === "dep" ? x.sobt : x.sibt, e = dir === "dep" ? x.eobt : x.eibt, a = dir === "dep" ? x.aobt || x.adtt : x.aibt;
    return mkFlight(apt, dir, o?.airportIATA, o?.airportDisplayName, x.flightNumber, x.airline?.airlineIATA, x.airline?.airlineName, { sched: ISO(s), est: a ? undefined : ISO(e), act: ISO(a), gate: x.gate, belt: (x.baggageClaimUnits || [])[0] }, st, a ? (dir === "dep" ? "departed" : "landed") : genStatus(st, dir), "Rotterdam The Hague Airport official flight board (rotterdamthehagueairport.nl)", { aircraft: { type: x.aircraftICAOType, reg: x.aircraftRegistration } }); }), apt, ymd, dir);
}

// Keflavik (Isavia): flight list embedded in kefairport.com departures/arrivals pages (__NEXT_DATA__).
async function kefBoard(apt, dir, ymd) {
  const L = await cached(`kef:${dir}`, 180, async () => { const h = await getText(`https://www.kefairport.com/flights/${dir === "dep" ? "departures" : "arrivals"}`, { headers: { "user-agent": v12BUA } }); const m = /id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(h); if (!m) throw new Error("KEF: no data");
    const f = JSON.parse(JSON.parse(m[1]).props.pageProps.flightArrayData || "[]"); return f.filter(x => x.arrival === (dir === "arr")); });
  return v12dayFilter(L.map(x => { const sched = ISO(x.date); const s = x.status || ""; const upd = x.updateDate && x.updatedTime ? ISO(x.updateDate) : undefined;
    const stx = { ATD: "Departed", ATA: "Landed", LBB: "Landed", EST: "Estimated", BDO: "Boarding", CNL: "Cancelled", CAN: "Cancelled", DEL: "Delayed", GCL: "Gate closed", FCL: "Final call", NoStatus: "Scheduled" }[s] || s || "Scheduled"; const g = genStatus(stx, dir); const done = (dir === "dep" && g === "departed") || (dir === "arr" && g === "landed");
    return mkFlight(apt, dir, x.airportCode, x.destination, x.flightNumber, x.airlineCode, x.airline, { sched, est: done ? undefined : upd, act: done ? upd : undefined, gate: x.gate || undefined, belt: x.belt || undefined }, stx, g, "Keflavík Airport official flight board (kefairport.com)"); }), apt, ymd, dir);
}

const AENA_CODES = (WEU.ES || []).map(a => a.iata || a).filter(c => AP[c]);
for (const c of AENA_CODES) OFFICIAL[c] = { fn: aenaBoard, label: "Aena official flight information", provider: "Official airport feed (Aena)", site: "aena.es" };
// ---------- v15: Central Europe (OurAirports: commercial airports with scheduled service) + official feeds ----------
const CEU = JSON.parse(fs.readFileSync(path.join(__dir, "data/ceu.json"), "utf8"));
const CE_SET = new Set(Object.values(CEU).flat().map(a => a.iata)); // v17: 400-row cap for every Central Europe official board (FRA ~530)
const CEU_NAMES = { DE: "Germany", AT: "Austria", CH: "Switzerland", LI: "Liechtenstein", PL: "Poland", CZ: "Czechia", SK: "Slovakia", HU: "Hungary", SI: "Slovenia", HR: "Croatia", LT: "Lithuania", LV: "Latvia", EE: "Estonia" };
for (const [cc, list] of Object.entries(CEU)) for (const a of list) { if (!AP[a.iata]) { AP[a.iata] = { name: a.name, city: a.city || a.name, country: CEU_NAMES[cc], iata: a.iata, icao: a.icao, lat: a.lat, lon: a.lon, elev: 0, tz: a.tz }; if (a.icao) AP_ICAO[a.icao] = AP[a.iata]; } }
// City-name -> IATA for feeds that only print a (local-language) city name. Exact matches only; unknown names stay as text.
const fold = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const EXONYM = { LARNAKA: "Larnaca", BUDAPESZT: "Budapest", GOTEBORG: "Gothenburg", CRACOW: "Krakow", LONDYN: "London", HURGADA: "Hurghada", RIM: "Rome", KISINOV: "Chisinau", BAZILEJ: "Basel", MALLORCA: "Palma de Mallorca", MUENCHEN: "Munich", MUNCHEN: "Munich", KOELN: "Cologne", NUERNBERG: "Nuremberg", WIEN: "Vienna", ZUERICH: "Zurich", MAILAND: "Milan", ROM: "Rome", LISSABON: "Lisbon", KOPENHAGEN: "Copenhagen", BRUESSEL: "Brussels", ISTANBUL: "Istanbul", ANTALYA: "Antalya", "PALMA": "Palma de Mallorca", "PALMA DE MALLORCA": "Palma de Mallorca", "GRAN CANARIA": "Gran Canaria", "LAS PALMAS": "Gran Canaria", "FUERTEVENTURA": "Fuerteventura", HURGHADA: "Hurghada", LONDYN: "London", MADRYT: "Madrid", KOPENHAGA: "Copenhagen", NEAPOL: "Naples", KATANIA: "Catania", BRUKSELA: "Brussels", SZTOKHOLM: "Stockholm", WILNO: "Vilnius", PRAGA: "Prague", ANTALIA: "Antalya", MADERA: "Funchal", WARSZAWA: "Warsaw", KRAKOW: "Krakow", GOTEBORG: "Gothenburg", MONACHIUM: "Munich", RZYM: "Rome", MEDIOLAN: "Milan", PARYZ: "Paris", WIEDEN: "Vienna", ATENY: "Athens", LIZBONA: "Lisbon", ZURYCH: "Zurich", GENEWA: "Geneva", BAZYLEA: "Basel", KOLONIA: "Cologne", HAMBURG: "Hamburg", RYGA: "Riga", TALLIN: "Tallinn", HELSINKI: "Helsinki", TELAWIW: "Tel Aviv", "TEL AWIW": "Tel Aviv", STAMBUL: "Istanbul", SEWILLA: "Seville", WALENCJA: "Valencia", MALAGA: "Malaga", TENERYFA: "Tenerife", REYKJAVIK: "Reykjavik", DUBAJ: "Dubai", KAIR: "Cairo", "BIRMINGHAM": "Birmingham", EDYNBURG: "Edinburgh", "NEAPOL": "Naples", ALGIER: "Algiers", "PALMA DE MALLORCA": "Palma de Mallorca", MNICHOV: "Munich", VIDEN: "Vienna", "SOLUN": "Thessaloniki", LONDYN_: "", BELEHRAD: "Belgrade", BELGRAD: "Belgrade", WENECJA: "Venice", BOLONIA: "Bologna", FLORENCJA: "Florence", PIZA: "Pisa", KORFU: "Corfu", HERAKLION: "Heraklion", RODOS: "Rhodes" };
const PREF = { London: null, Paris: "CDG", Milan: "MXP", Rome: "FCO", Stockholm: "ARN", Oslo: "OSL", Istanbul: "IST", Moscow: "SVO", Brussels: "BRU", Berlin: "BER", Tenerife: "TFS" };
let CITY_IX = null; const cityIx = () => { if (CITY_IX) return CITY_IX; CITY_IX = {}; for (const a of Object.values(AP)) { if (!a.iata) continue; for (const k of [fold(a.city), fold(a.name), fold((a.name || "").replace(/\b(International|Airport|Airfield)\b/gi, ""))]) if (k && !CITY_IX[k]) CITY_IX[k] = a.iata; } return CITY_IX; };
function resolveCity(raw) { if (!raw) return null; const m = raw.match(/\(([A-Z]{3})\)/); if (m && AP[m[1]]) return m[1];
  const parts = raw.split(/[\/]| - /).map(x => x.replace(/^([^-]+)-(STANSTED|LUTON|GATWICK|HEATHROW|CIAMPINO|FIUMICINO|BERGAMO|MALPENSA|BEAUVAIS|ORLY)$/i, "$1 $2").replace(/-(?=[A-ZÀ-Ž])/g, " ")).map(fold).filter(Boolean); const ix = cityIx();
  for (const p of [...parts].reverse()) { const words = p.split(" "); for (let n = words.length; n >= 1; n--) { const k = words.slice(0, n).join(" "); const ex = EXONYM[k] || EXONYM[k.replace(/ /g, "")];
      const name = ex || k; const sub = p.slice(k.length).trim(); // "LONDYN STANSTED" -> London + Stansted
      if (sub) { const s = ix[fold(sub)] || ix[fold(name + " " + sub)]; if (s) return s; }
      if (name in PREF) return PREF[name]; const hit = ix[fold(name)]; if (hit) return hit; } }
  return null; }
const ceStatus = s => { s = fold(s); if (/CANCEL|ODWOL|ZRUS|ANUL|TOROLV|ODPOV/.test(s)) return "cancelled"; if (/DIVERT|PRZEKIER|ODKLON/.test(s)) return "diverted";
  if (/LANDED|WYLADOW|PRISTAL|PRILET|LANDOL|ARRIVED/.test(s)) return "landed"; if (/DEPART|WYSTART|ODLET|ODL |AIRBORNE|FELSZALL|ODLETELO/.test(s)) return "departed";
  if (/BOARD|NASTUP/.test(s)) return "boarding"; if (/GATE|BRAMKA|ZAMKN|CLOSED/.test(s)) return "gate"; if (/DELAY|OPOZN|ZPOZD|MESKAS|KESIK/.test(s)) return "delayed"; return "scheduled"; };
const CE_KEEP = (list, ymd) => { if (list.length <= 400 || ymd !== todayLondon()) return list.slice(0, 400); // v23: whole day when it fits const lo = Date.now() - 3 * 3600e3, hi = Date.now() + 12 * 3600e3;
  return list.filter(f => { const t = +new Date(f.dep.scheduled || f.arr.scheduled); return t >= lo && t <= hi; }).slice(0, 400); };
const ceGet = (url, opt = {}) => getText(url, { ...opt, headers: { accept: "*/*", ...(opt.headers || {}) } });
const htmlDec = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
// Gdańsk: the airport's own board page embeds the full JSON schedule in a React props attribute.
async function gdnBoard(apt, dir, ymd) { return cached(`gdn:${dir}:${ymd}`, 180, async () => {
  const h = await ceGet(`https://www.airport.gdansk.pl/en/flights/current-${dir === "dep" ? "departures" : "arrivals"}`);
  const key = dir === "dep" ? "departures" : "arrivals"; const m = [...h.matchAll(/react-props-value="([^"]+)"/g)].find(x => x[1].includes("&quot;" + key + "&quot;:&quot;")); if (!m) throw new Error("GDN board data not found"); const props = JSON.parse(krkDec(m[1]));
  const raw = props[dir === "dep" ? "departures" : "arrivals"]; const rows = typeof raw === "string" ? JSON.parse(raw) : raw || [];
  const out = rows.map(x => { const other = x.destination || x.origin || x.from; const num = (x.flight || "").replace(/\s+/g, ""); const sched = x.dateTime && new Date(x.dateTime).toISOString(); const st = ceStatus(x.remarks);
    const est = x.expectedDateTime ? new Date(x.expectedDateTime).toISOString() : undefined; const act = x.landingTime ? new Date(x.landingTime).toISOString() : undefined;
    return mkFlight(apt, dir, resolveCity(other), other, num, num.slice(0, 2), x.carrierName, { sched, est, act, gate: x.gate, term: x.terminal }, x.remarks || "Scheduled", st, "Gdańsk Airport official flight board (airport.gdansk.pl)", { otherName: other }); });
  return CE_KEEP(out, ymd); }); }
// Prague: the JSON API behind prg.aero's own departures/arrivals app (paged, 150 per page, UTC times, IATA codes).
async function prgBoard(apt, dir, ymd) { return cached(`prg:${dir}:${ymd}`, 180, async () => { const rows = []; const hi = Date.now() + 12 * 3600e3;
  for (let off = 0; off < 600; off += 150) { const r = JSON.parse(await ceGet(`https://api.prg.aero/${dir === "dep" ? "departures" : "arrivals"}-shorttime?offset=${off}&limit=150`, { headers: { origin: "https://www.prg.aero", referer: "https://www.prg.aero/" } }));
    if (!Array.isArray(r) || !r.length) break; rows.push(...r); if (+new Date(r.at(-1).time) > hi) break; }
  const z = t => t ? new Date(t.replace(/\+0000$/, "Z")).toISOString() : undefined;
  const out = rows.filter(x => x.isMainFlight !== false).map(x => { const st = ceStatus(x.state); const done = ["departed", "landed"].includes(st); const nt = z(x["time-new"]);
    return mkFlight(apt, dir, x["destination-id"], (x.destination || "").replace(/\s*\([A-Z]{3}\)$/, ""), (x.flyNumber || "").replace(/^([A-Z0-9]{2})0+(\d)/, "$1$2"), x["company-id"] ? null : (x.flyNumber || "").slice(0, 2), x.company,
      { sched: z(x.time), est: done ? undefined : nt, act: done ? nt : undefined, gate: x.gates || undefined, term: x.terminal }, x.state || "Scheduled", st, "Prague Airport official flight info (prg.aero)"); });
  out.forEach(f => { if (!f.airline?.iata) f.airline = { ...airlineOut(f.number.slice(0, 2)), name: f.airline?.name }; });
  return CE_KEEP(out, ymd); }); }
// Poznań: the WordPress REST endpoint used by poznanairport.pl's own board (local times, IATA codes).
async function pozBoard(apt, dir, ymd) { return cached(`poz:${dir}:${ymd}`, 180, async () => {
  const r = JSON.parse(await ceGet(`https://poznanairport.pl/wp-json/api/v1/board/?type=${dir === "dep" ? "departures" : "arrivals"}&timeFrom=00:00&timeTo=23:59&lang=en`));
  const rows = Array.isArray(r) ? r : r.data || []; const tz = "Europe/Warsaw";
  const out = rows.map(x => { const [d, t] = (x.date?.value || "").split(" "); const sched = localToUtc(tz, d, (t || "").slice(0, 5)); const lab = x.status?.label || "Scheduled"; const st = ceStatus(lab + " " + (x.status?.code || ""));
    const m = (x.status?.value || "").match(/(\d{1,2}):(\d{2})/); const tt = m ? localToUtc(tz, d, m[1].padStart(2, "0") + ":" + m[2]) : undefined; const done = ["departed", "landed"].includes(st);
    return mkFlight(apt, dir, x.airport?.value, x.airport?.label, (x.flight_id || "").replace(/\s+/g, ""), (x.flight_id || "").slice(0, 2), x.airline?.label, { sched, est: done ? undefined : tt, act: done ? tt : undefined, gate: x.gate?.value, belt: x.belt?.value }, lab, st, "Poznań Airport official flight board (poznanairport.pl)"); });
  return CE_KEEP(out, ymd); }); }
// Bratislava: server-rendered board table on bts.aero.
async function btsBoard(apt, dir, ymd) { return cached(`bts:${dir}:${ymd}`, 180, async () => {
  const h = await ceGet(`https://www.bts.aero/lety/prilety-odlety/${dir === "dep" ? "odlety" : "prilety"}/`); const tz = "Europe/Bratislava"; const out = [];
  for (const row of h.split(/<tr class="flights-list-row/).slice(1)) { const td = c => { const m = row.match(new RegExp(`flights-list-td--${c}[^>]*>([\\s\\S]*?)</td>`)); return m ? m[1].replace(/<span class="flights-list-airline-name[\s\S]*?<\/span>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""; };
    const dm = row.match(/data-flight-date="(\d+)\. (\d+)\. (\d{4})"/); if (!dm) continue; const d = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    const num = td("fid").replace(/\s+/g, ""); const other = td("destination") || td("origin"); const stx = td("status"); const st = ceStatus(stx); const ct = td("ct"); const done = ["departed", "landed"].includes(st);
    const am = stx.match(/(\d{1,2})\.(\d{1,2})\.\s*(\d{1,2}):(\d{2})/); const actual = am ? localToUtc(tz, `${dm[3]}-${am[2].padStart(2, "0")}-${am[1].padStart(2, "0")}`, `${am[3].padStart(2, "0")}:${am[4]}`) : undefined;
    out.push(mkFlight(apt, dir, resolveCity(other), other, num, num.slice(0, 2), td("airline"), { sched: localToUtc(tz, d, td("pt")), est: !done && /^\d{1,2}:\d{2}$/.test(ct) ? localToUtc(tz, d, ct) : undefined, act: done ? actual : undefined }, stx || "Scheduled", st, "Bratislava Airport official flight board (bts.aero)", { otherName: other })); }
  return CE_KEEP(out, ymd); }); }
// Bremen: server-rendered daily flight plan (tagesflugplan) on bremen-airport.com; both directions on one page.
async function breBoard(apt, dir, ymd) { const all = await cached(`bre:${ymd}`, 180, async () => {
  const h = await ceGet("https://www.bremen-airport.com/fluginfo/fluege/tagesflugplan"); const tz = "Europe/Berlin"; const day = new Date().toLocaleDateString("en-CA", { timeZone: tz }); const out = { dep: [], arr: [] };
  for (const row of h.split('class="flight-info_number">').slice(1)) { const cell = c => { const m = row.match(new RegExp(`class="flight-info_${c}"[^>]*>([\\s\\S]*?)</div>`)); return m ? m[1].replace(/<span class="c-heading-mobile">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() : ""; };
    const num = row.slice(0, row.indexOf("<")).replace(/\s+/g, ""); const d = /class="flight-info_arrival"/.test(row) ? "arr" : "dep"; const other = cell("destination") || cell("origin");
    const t = cell(d === "dep" ? "departure" : "arrival"), e = cell("expected"), stx = cell("status") || "Scheduled"; const st = ceStatus(DE_ST[stx[0].toUpperCase() + stx.slice(1)] || stx); const done = ["departed", "landed"].includes(st);
    if (!/^\d{2}:\d{2}$/.test(t)) continue; const et = /^\d{2}:\d{2}$/.test(e) ? localToUtc(tz, day, e) : undefined;
    out[d].push(mkFlight(apt, d, resolveCity(other), other, num, num.slice(0, 2), null, { sched: localToUtc(tz, day, t), est: done ? undefined : et, act: done ? et : undefined, gate: cell("gate") || undefined, term: cell("terminal") || undefined }, stx[0].toUpperCase() + stx.slice(1), st, "Bremen Airport official daily flight plan (bremen-airport.com)", { otherName: other })); }
  return out; }); return CE_KEEP(all[dir] || [], ymd); }
OFFICIAL.BRE = { fn: breBoard, label: "Bremen Airport official daily flight plan", provider: "Official airport feed", site: "bremen-airport.com" };
const CE_BLOCKED = { AOK: "Karpathos is run by the state operator HASP, not Fraport Greece (Fraport runs 14 Greek airports incl. Samos SMI); no public flight-data feed found",
  HAM: "Blocked by airport site: connection closed to server requests", STR: "Blocked by airport site: Access Denied (bot protection)", CGN: "No public flight-data endpoint found on the airport site (board rendered client-side behind bot protection)",
  HAJ: "No public flight-data endpoint found on the airport site", LEJ: "No public flight-data endpoint found on the airport site", DRS: "No public flight-data endpoint found on the airport site",
  ZRH: "Blocked by airport site: captcha on flight-data API", GVA: "Blocked by airport site: captcha widget, no public data endpoint", BSL: "No public flight-data endpoint found on the airport site",
  SZG: "No public flight-data endpoint found on the airport site (board loaded client-side)", INN: "No public flight-data endpoint found on the airport site", GRZ: "Airport site did not respond to server requests", KLU: "No public flight-data endpoint found on the airport site", LNZ: "No public flight-data endpoint found on the airport site",
KRK: "Blocked by airport site: reCAPTCHA-protected board", KTW: "No public flight-data endpoint found on the airport site (CSRF-protected API)", WRO: "No public flight-data endpoint found on the airport site",
  BUD: "No public flight-data endpoint found on the airport site (session-bound API)", BRQ: "No public flight-data endpoint found on the airport site", OSR: "Airport site did not respond to server requests", LJU: "No public flight-data endpoint found on the airport site",
  ZAG: "No public flight-data endpoint found on the airport site", SPU: "Airport site did not respond to server requests", DBV: "No public flight-data endpoint found on the airport site", ZAD: "Airport site publishes a seasonal timetable only (no day-of board)",
  PUY: "No public flight-data endpoint found on the airport site", RJK: "No public flight-data endpoint found on the airport site", FMM: "Airport site did not respond to server requests", FMO: "No public flight-data endpoint found on the airport site",
  HHN: "No public flight-data endpoint found on the airport site", PAD: "No public flight-data endpoint found on the airport site", FKB: "No public flight-data endpoint found on the airport site", SCN: "No public flight-data endpoint found on the airport site",
  FDH: "No public flight-data endpoint found on the airport site", ERF: "No public flight-data endpoint found on the airport site", RLG: "Airport site did not respond to server requests", GWT: "No public flight-data endpoint found on the airport site" };
OFFICIAL.GDN = { fn: gdnBoard, label: "Gdańsk Airport official flight board", provider: "Official airport feed", site: "airport.gdansk.pl" };
OFFICIAL.PRG = { fn: prgBoard, label: "Prague Airport official flight info", provider: "Official airport feed", site: "prg.aero" };
OFFICIAL.POZ = { fn: pozBoard, label: "Poznań Airport official flight board", provider: "Official airport feed", site: "poznanairport.pl" };
OFFICIAL.BTS = { fn: btsBoard, label: "Bratislava Airport official flight board", provider: "Official airport feed", site: "bts.aero" };

OFFICIAL.BER = { fn: berBoard, label: "BER official flight board", provider: "Official airport feed", site: "berlin-airport.de" };
OFFICIAL.MUC = { fn: mucBoard, label: "Munich Airport official flight search", provider: "Official airport feed", site: "munich-airport.com" };
OFFICIAL.DTM = { fn: dtmBoard, label: "Dortmund Airport official flight schedule", provider: "Official airport feed", site: "dortmund-airport.com" };
OFFICIAL.NRN = { fn: nrnBoard, label: "Airport Weeze official flight board", provider: "Official airport feed", site: "airport-weeze.com" };
OFFICIAL.LUX = { fn: luxBoard, label: "Luxembourg Airport official flight data", provider: "Official airport feed", site: "lux-airport.lu" };
OFFICIAL.BLL = { fn: bllBoard, label: "Billund Airport official flight data", provider: "Official airport feed", site: "bll.dk" };
OFFICIAL.NUE = { fn: nueBoard, label: "Nuremberg Airport official flight status", provider: "Official airport feed", site: "airport-nuernberg.de" };
OFFICIAL.RTM = { fn: rtmBoard, label: "Rotterdam The Hague Airport official flight board", provider: "Official airport feed", site: "rotterdamthehagueairport.nl" };
OFFICIAL.KEF = { fn: kefBoard, label: "Keflavík Airport official flight board", provider: "Official airport feed (Isavia)", site: "kefairport.com" };
// Tested and NOT usable without bypassing protection or a key (documented, not scraped):
const EU_BLOCKED = {"AMS": "Blocked by airport site: Cloudflare challenge", "BRE": "Blocked by airport site: Cloudflare challenge", "BGY": "Blocked by airport site: Cloudflare challenge", "AAL": "Blocked by airport site: Cloudflare challenge", "GLA": "Blocked by airport site: Cloudflare challenge", "BHX": "Blocked by airport site: Cloudflare challenge", "NCL": "Blocked by airport site: Cloudflare challenge", "PMO": "Blocked by airport site: Cloudflare 'Attention Required'", "NTE": "Blocked by airport site: Cloudflare 'Attention Required'", "INN": "Blocked by airport site: Cloudflare 'Attention Required'", "BRS": "Blocked by airport site: Cloudflare 'Attention Required'", "LCY": "Blocked by airport site: Cloudflare 'Attention Required'", "CDG": "Blocked by airport site: hCaptcha bot protection (Groupe ADP)", "ORY": "Blocked by airport site: hCaptcha bot protection (Groupe ADP)", "BRU": "Blocked by airport site: Access Denied (bot protection)", "CPH": "Blocked by airport site: Access Denied (bot protection)", "CGN": "Blocked by airport site: Access Denied (bot protection)", "STR": "Blocked by airport site: Access Denied (bot protection)", "VCE": "Blocked by airport site: Access Denied (bot protection)", "LEJ": "Blocked by airport site: 403 (Mitteldeutsche Flughafen AG)", "DRS": "Blocked by airport site: 403 (Mitteldeutsche Flughafen AG)", "LPL": "Blocked by airport site: 403", "FCO": "Blocked by airport site: AWS WAF / CloudFront 403 (ADR)", "CIA": "Blocked by airport site: AWS WAF / CloudFront 403 (ADR)", "NAP": "Blocked by airport site: Radware captcha", "LIS": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "OPO": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "FAO": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "FNC": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "PXO": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "PDL": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "TER": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "HOR": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "SMA": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "PIX": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "FLW": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "GRW": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "SJZ": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "CVU": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "BYJ": "Blocked by airport site: Imperva Incapsula (ANA / VINCI)", "HAM": "Blocked by airport site: connection closed to server requests", "PSA": "Blocked by airport site: connection closed to server requests", "FLR": "Blocked by airport site: connection closed to server requests", "EIN": "Blocked by airport site: connection closed to server requests", "GVA": "Blocked by airport site: captcha widget, no public data endpoint", "MLA": "Blocked by airport site: CloudFront 403", "ZRH": "No public flight-data endpoint found on the airport site", "MXP": "No public flight-data endpoint found on the airport site", "LIN": "No public flight-data endpoint found on the airport site", "BLQ": "No public flight-data endpoint found on the airport site", "BSL": "No public flight-data endpoint found on the airport site", "HAJ": "No public flight-data endpoint found on the airport site", "NCE": "No public flight-data endpoint found on the airport site", "SZG": "No public flight-data endpoint found on the airport site", "KLU": "No public flight-data endpoint found on the airport site", "LNZ": "No public flight-data endpoint found on the airport site", "GRZ": "No public flight-data endpoint found on the airport site", "CTA": "No public flight-data endpoint found on the airport site", "TLS": "No public flight-data endpoint found on the airport site", "LYS": "No public flight-data endpoint found on the airport site", "MRS": "No public flight-data endpoint found on the airport site", "BOD": "No public flight-data endpoint found on the airport site", "MST": "No public flight-data endpoint found on the airport site", "AJA": "No public flight-data endpoint found on the airport site", "BIA": "No public flight-data endpoint found on the airport site", "CLY": "No public flight-data endpoint found on the airport site", "FSC": "No public flight-data endpoint found on the airport site", "CAG": "No public flight-data endpoint found on the airport site", "OLB": "No public flight-data endpoint found on the airport site", "AHO": "No public flight-data endpoint found on the airport site", "TPS": "No public flight-data endpoint found on the airport site", "CMN": "No public flight-data endpoint found on the airport site", "PMF": "No public flight-data endpoint found on the airport site", "TRN": "No public flight-data endpoint found on the airport site"};
const EU_CANDIDATES = { AMS: "Schiphol Public Flight API (free developer key)", HAM: "Hamburg Airport API portal (free key)", FRA: "already official", MAD: "Aena (no public API found; page loads data dynamically, not identified)", LIS: "ANA/VINCI (no public endpoint identified)" };
// Every commercial airport in the UK, Crown Dependencies and Republic of Ireland
const UKI = { "England": "LHR LGW STN LTN LCY SEN MAN BHX BRS NCL LBA LPL EMA BOH SOU EXT NQY NWI MME HUY DSA BLK CAX ISC LEQ BZZ QUG OXF BQH FAB ESH LYX".split(" "), "Scotland": "EDI GLA ABZ INV PIK DND SYY KOI LSI BRR BEB TRE ILY CAL WIC LWK NRL PPW SOY WRY EOI FIE FOA OUK CSA COL".split(" "), "Wales": ["CWL", "VLY"], "Northern Ireland": ["BFS", "BHD", "LDY"], "Channel Islands": ["JER", "GCI", "ACI"], "Isle of Man": ["IOM"], "Ireland": "DUB ORK SNN NOC KIR WAT SXL IOR CFN DUB".split(" ").filter((x, i, a) => a.indexOf(x) === i) };

// Kraków: krakowairport.pl renders its public departures/arrivals board server-side (Livewire snapshot JSON in the page). Plain public page; no captcha is involved in reading it.
const krkDec = t => t.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
async function krkBoard(apt, dir, ymd) {
  const all = await cached(`krk:${dir}`, 180, async () => { const h = await getText(`https://krakowairport.pl/pl/pasazer/loty/${dir === "dep" ? "odloty" : "przyloty"}`, { headers: { accept: "text/html" } }); const out = [];
    for (const m of h.matchAll(/wire:snapshot="([^"]+)"/g)) { let d; try { d = JSON.parse(krkDec(m[1])); } catch { continue; } const fl = d?.data?.flights?.[0]; if (!Array.isArray(fl)) continue;
      for (const [x] of fl) { if (!x?.flight_no) continue; const iso = v => { const t = Array.isArray(v) ? v[0] : v; return t ? new Date(t).toISOString() : undefined; };
        const rmk = x.remarks || (x.is_cancelled ? "CANCELLED" : "SCHEDULED"); const st = x.is_cancelled ? "cancelled" : genStatus(rmk, dir); const done = st === "departed" || st === "landed";
        const ex = iso(x.expected_time) || iso(x.arrival_datetime_pl); const num = x.flight_no.replace(/\s+/g, "");
        out.push(mkFlight(apt, dir, dir === "dep" ? x.destination_iata : x.origin_iata, dir === "dep" ? x.destination : x.origin, num, num.slice(0, 2), x.airline, { sched: iso(x.scheduled_datetime_pl), est: done ? undefined : ex, act: done ? ex : undefined, gate: x.gate_id || undefined, term: x.terminal || undefined }, rmk[0] + rmk.slice(1).toLowerCase(), st, "Kraków Airport official flight board (krakowairport.pl)", { localName: dir === "dep" ? x.destination : x.origin, remarksLocal: x.remarks_pl || undefined })); } }
    return out; });
  return all.filter(f => inDay((dir === "dep" ? f.dep : f.arr).scheduled, ymd)); }
if (AP.KRK) OFFICIAL.KRK = { fn: krkBoard, label: "Kraków Airport official flight board", provider: "Official airport feed", site: "krakowairport.pl" };
// v41 OOOI: airport feeds' departure "actual" is the off-block (gate) time, not wheels-off. Mark it, and attach a real
// take-off time only from evidence: Skyline's ADS-B take-off log for the ICAO callsign, or feed wording that says airborne.
const AIRBORNE_TXT = /airborne|took off|in the air|en ?route/i;
function oooiMark(apt, dir, L) { if (dir !== "dep" || !Array.isArray(L)) return L; return L.map(f => { const d = f.dep || {}; if (!d.actual || d.actualSource || d.actualKind) return f;
  const al = f.airline?.icao, n = (f.number || "").slice(2).replace(/^0+/, ""); const cs = al && /^\d+[A-Z]?$/.test(n) ? al + n : null; const t0 = Date.parse(d.actual);
  const ev = cs && t0 ? obsEvent(apt, "dep", cs, t0 - 5 * 60e3, t0 + 60 * 60e3) : null; const dep = { ...d, actualKind: "offblock", offBlock: d.actual };
  if (ev) { dep.takeoff = new Date(ev.t).toISOString(); dep.takeoffSource = "ADS-B observed take-off" + (ev.approx ? " (approx.)" : ""); } else if (AIRBORNE_TXT.test(f.statusText || "")) dep.airborneText = true;
  return { ...f, dep }; }); }
const officialBoard = async (apt, dir, ymd) => oooiMark(apt, dir, await OFFICIAL[apt].fn(apt, dir, ymd));

// ---------- AeroDataBox (optional key, RapidAPI) ----------
const ADB = process.env.ADB_BASE || "https://aerodatabox.p.rapidapi.com"; // ADB_BASE only for local mock tests
const adb = (p, ttl = 300) => { if (true) { /* budget: only board FIDS may call AeroDataBox (see adbFids) */ const e = new Error("no key"); e.needsKey = true; throw e; }
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
    statusText: f.status, status: adbStatus(f.status), callsign: f.callSign || undefined, source: "AeroDataBox" };
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
api.get("/health", (q, r) => r.json({ ok: true, ...adbStats(), keys: { aerodatabox: !!cfg.aerodataboxKey }, magAirports: Object.keys(MAG_SITES), feedErrors: FEED_ERR, officialAirports: Object.keys(OFFICIAL), mem: Object.fromEntries(Object.entries(process.memoryUsage()).map(([k, v]) => [k, Math.round(v / 1048576)])) }));
api.get("/settings", (q, r) => r.json({ aerodatabox: cfg.aerodataboxKey ? "set" : "", protected: !!cfg.adminToken }));
api.post("/settings", (req, res) => {
  if (cfg.adminToken && req.body.adminToken !== cfg.adminToken) return res.status(403).json({ error: "admin token required" });
  for (const k of ["aerodataboxKey", "llmKey", "llmBase", "llmModel"]) if (typeof req.body[k] === "string") cfg[k] = req.body[k].trim();
  if (!cfg.adminToken && req.body.newAdminToken) cfg.adminToken = String(req.body.newAdminToken);
  saveCfg(); C.clear(); res.json({ ok: true });
});
api.get("/airports/search", (req, res) => { const q = String(req.query.q || "").toLowerCase(); if (!q) return res.json([]);
  const out = []; for (const a of Object.values(AP)) { const s = `${a.iata} ${a.icao} ${a.name} ${a.city}`.toLowerCase(); if (a.iata.toLowerCase() === q) out.unshift(a); else if (s.includes(q)) out.push(a); if (out.length > 40) break; }
  res.json(out.slice(0, 15).map(airportOut)); });
api.get("/airport/:iata", (req, res) => { const a = AP[req.params.iata.toUpperCase()]; a ? res.json({ ...airportOut(a), sourceLabel: OFFICIAL[a.iata]?.label, boardSource: OFFICIAL[a.iata] ? "official" : cfg.aerodataboxKey ? "aerodatabox" : "live" }) : res.status(404).json({ error: "unknown airport" }); });
api.get("/airline/:code", (req, res) => res.json(airlineOut(req.params.code.toUpperCase())));


// ---- Worldwide live-traffic board (real ADS-B, no schedules) ----
let adsbQ = Promise.resolve(); const adsbGate = fn => { const r = adsbQ.then(fn, fn); adsbQ = r.catch(() => {}).then(() => new Promise(z => setTimeout(z, 350))); return r; };
const routeCs = cs => cached("adsbdb:" + cs, 86400, async () => { try { return (await getJSON(`https://api.adsbdb.com/v0/callsign/${cs}`)).response?.flightroute || null; } catch { return null; } });
const kmTo = (a, lat, lon) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(lat - a.lat), dn = r(lon - a.lon); return 2 * R * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(lat)) * Math.sin(dn / 2) ** 2)); };
// ---------- Rolling ADS-B observation log for airports without a free timetable feed ----------
// Samples aircraft within 25nm of tracked airports, keeps per-aircraft tracks and derives observed events
// (departed / landed) with real observed times. In memory (6h), mirrored to Upstash KV when configured.
const OBS = {}; const OBS_KEEP = 6 * 3600e3; const EV_KEEP = 26 * 3600e3; // aircraft positions 6 h; take-off/landing events 26 h (about 1 MB)
// v24: airport's own live board page, linked when we have no usable official feed (blocked / client-only sites)
const AIRPORT_SITE = { OTP: "https://www.bucharestairports.ro/en/flights", BEG: "https://beg.aero/en/flights", VNO: "https://www.vilnius-airport.lt/en/flights", KIV: "https://www.airport.md/en/flights", SOF: "https://www.sofia-airport.eu/en/flights/departures", ATH: "https://www.aia.gr/traveler/flight-info/rtfi/", SAW: "https://www.sabihagokcen.aero/passengers-and-visitors/passenger-guide/flight-information", AYT: "https://www.antalya-airport.aero/", VAR: "https://www.varna-airport.bg/en/flights", BOJ: "https://www.bourgas-airport.com/en/flights", TIA: "https://www.tirana-airport.com/", SKP: "https://skp.airports.com.mk/en-EN/flights", OHD: "https://ohd.airports.com.mk/en-EN/flights", TLL: "https://www.tallinn-airport.ee/en/flight-info/realtime-flights/", RIX: "https://www.riga-airport.com/en/flight-schedule", CLJ: "https://airportcluj.ro/", ZAG: "https://www.zagreb-airport.hr/", SPU: "https://www.split-airport.hr/", DBV: "https://www.airport-dubrovnik.hr/en/flights", LJU: "https://www.fraport-slovenija.si/", SJJ: "https://www.sia.ba/", TGD: "https://montenegroairports.com/", TIV: "https://montenegroairports.com/", PRN: "https://www.airportpristina.com/", INI: "https://nis.aero/", KRK: "https://www.krakowairport.pl/en/passenger/flights/arrivals-and-departures", GDN: "https://www.airport.gdansk.pl/flights/departures", KTW: "https://www.katowice-airport.com/en/flights/departures", WRO: "https://airport.wroclaw.pl/en/passenger/departure/departures-board/", HER: "https://www.heraklion-airport.gr/", PRG: "https://www.prg.aero/en/departures", BTS: "https://www.bts.aero/en/flights/departures/", IAS: "https://www.aeroport-iasi.ro/", TSR: "https://www.aerotim.ro/" };
const TOP_LIVE = ["LGW", "EDI", "GLA", "BHX", "BRS", "NCL", "LBA", "LPL", "CWL", "ABZ", "LCY", "SOU", "JER", "IOM", "BFS"];
const REQ = {}; // iata -> last requested ms
const obsOf = c => OBS[c] || (OBS[c] = { iata: c, ac: {}, events: [], lastSeen: null, sampledAt: null, backfilled: 0 });
const nearAir = (a, nm = 25) => cached(`near:${a.iata}:${nm}`, 45, () => adsbGate(async () => { for (const u of [`https://api.adsb.lol/v2/point/${a.lat}/${a.lon}/${nm}`, `https://api.airplanes.live/v2/point/${a.lat}/${a.lon}/${nm}`, `https://opendata.adsb.fi/api/v2/lat/${a.lat}/lon/${a.lon}/dist/${nm}`]) { try { const r = await getJSON(u); if (r.ac || r.aircraft) return { ac: r.ac || r.aircraft, src: u.includes("lol") ? "adsb.lol" : u.includes("airplanes") ? "airplanes.live" : "adsb.fi" }; } catch {} } throw new Error("no ADS-B source"); }));
function sampleOf(a, x, now) { const elev = a.alt || 0; const alt = x.alt_baro === "ground" ? elev : typeof x.alt_baro === "number" ? x.alt_baro : null; if (alt == null || x.lat == null) return null;
  const km = kmTo(a, x.lat, x.lon), gnd = x.alt_baro === "ground" || ((x.gs ?? 999) < 50 && alt < elev + 400);
  return { t: now - (x.seen_pos || x.seen || 0) * 1000, alt, agl: alt - elev, vs: x.baro_rate ?? x.geom_rate ?? 0, gs: x.gs ?? null, km, gnd }; }
async function observe(c) { const a = AP[c]; if (!a) return null; const { ac, src } = await nearAir(a); const o = obsOf(c), now = Date.now(); o.sampledAt = now; o.src = src;
  for (const x of ac) { const s = sampleOf(a, x, now); if (!s) continue; const near = s.gnd ? s.km < 5 : s.km < 46 && s.agl < 12000; if (!near) continue;
    const cs = (x.flight || "").trim(); const p = o.ac[x.hex] || (o.ac[x.hex] = { hex: x.hex, first: s.t, samples: [] }); Object.assign(p, { cs: cs || p.cs, reg: x.r || p.reg, type: x.t || p.type, last: s.t, pos: { lat: x.lat, lon: x.lon, track: x.track } });
    const prev = p.samples[p.samples.length - 1]; p.samples.push(s); if (p.samples.length > 40) p.samples.shift(); o.lastSeen = Math.max(o.lastSeen || 0, s.t);
    if (prev && now - prev.t < 20 * 60e3) {
      if (prev.gnd && !s.gnd && s.km < 25) addEv(o, p, "dep", s.t, "Departed — observed leaving the ground");
      if (!prev.gnd && s.gnd && s.km < 5) addEv(o, p, "arr", s.t, "Landed — observed touching down"); }
    else if (!prev && !s.gnd && s.agl < 3000 && s.km < 12 && s.vs > 500) addEv(o, p, "dep", s.t, "Departed — first seen climbing out", true);
    else if (!prev && !s.gnd && s.agl < 1500 && s.km < 8 && s.vs < -300) addEv(o, p, "arr", s.t, "Landing — first seen on short final", true); }
  for (const [h, p] of Object.entries(o.ac)) if (now - p.last > OBS_KEEP) delete o.ac[h];
  o.events = o.events.filter(e => now - e.t < EV_KEEP); if (o.events.length > 4000) o.events = o.events.slice(-4000); return o; }
function addEv(o, p, kind, t, text, approx) { if (o.events.some(e => e.hex === p.hex && e.kind === kind && Math.abs(e.t - t) < 30 * 60e3)) return; o.events.push({ hex: p.hex, cs: p.cs, reg: p.reg, type: p.type, kind, t, text, approx: !!approx }); }
function current(o, p) { const s = p.samples[p.samples.length - 1]; if (!s || Date.now() - p.last > 3 * 60e3) return null;
  const prev = p.samples[p.samples.length - 2]; if (s.gnd) return { phase: p.samples.some(q => !q.gnd) && !p.samples.slice(p.samples.findIndex(q => !q.gnd)).every(q => !q.gnd) ? "arrived" : (s.gs ?? 0) > 5 ? "taxi" : "stand", s };
  const brg = p.pos?.track != null ? (() => { const r = Math.PI / 180, A = AP[o.iata] || {}; const y = Math.sin((A.lon - p.pos.lon) * r) * Math.cos(A.lat * r), x = Math.cos(p.pos.lat * r) * Math.sin(A.lat * r) - Math.sin(p.pos.lat * r) * Math.cos(A.lat * r) * Math.cos((A.lon - p.pos.lon) * r); const b = (Math.atan2(y, x) / r + 360) % 360; return Math.abs(((p.pos.track - b) + 540) % 360 - 180); })() : null;
  const away = brg != null ? brg > 150 : prev ? s.km > prev.km + 0.2 : s.vs > 300, inbound = brg != null ? brg < 25 : prev ? s.km < prev.km - 0.2 : s.vs < -300;
  if (inbound && s.vs <= 200 && (s.vs < -200 || s.agl < 4000)) return { phase: "approach", s, eta: s.gs ? Math.round(s.km / (s.gs * 1.852 / 60)) : null };
  if (away && s.vs > 200 && p.samples.some(q => q.gnd || q.km < 8)) return { phase: "leaving", s }; return { phase: "overhead", s }; }
const ukTrack = c => { REQ[c] = Date.now(); };
async function backfill(c) { const a = AP[c], o = obsOf(c); if (Date.now() - o.backfilled < 15 * 60e3) return; o.backfilled = Date.now();
  // Wider look (150nm) for aircraft whose adsbdb route starts or ends here, so a freshly woken server is not empty.
  let list = []; try { list = await adsb(`point/${a.lat.toFixed(3)}/${a.lon.toFixed(3)}/150`); } catch { return; }
  const cand = list.filter(x => x.flight?.trim() && typeof x.alt_baro === "number" && x.alt_baro > 3000).sort((x, y) => kmTo(a, x.lat, x.lon) - kmTo(a, y.lat, y.lon)).slice(0, 30);
  o.wide = []; for (const x of cand) { const cs = x.flight.trim(); const rt = await routeCs(cs); if (!rt) continue; const og = rt.origin?.iata_code, ds = rt.destination?.iata_code; if (og !== c && ds !== c) continue;
    const km = kmTo(a, x.lat, x.lon); o.wide.push({ hex: x.hex, cs, reg: x.r, type: x.t, side: og === c ? "dep" : "arr", km, alt: x.alt_baro, gs: x.gs, at: Date.now(), eta: ds === c && x.gs ? Math.round(km / (x.gs * 1.852 / 60)) : null, pos: { lat: x.lat, lon: x.lon, track: x.track } }); } }
async function liveBoard(iata, dir) { const a = AP[iata]; if (!a) throw new Error("unknown airport"); ukTrack(iata);
  return cached(`liveboard:${iata}:${dir}`, 40, async () => { const o = await observe(iata).catch(() => obsOf(iata)); await backfill(iata).catch(() => {}); const out = [], seen = new Set();
    const row = async (p, side, status, statusText, t, extra = {}) => { if (seen.has(p.hex + side)) return; if (!p.type && !p.reg) return; /* ground vehicles / unidentified */ seen.add(p.hex + side); const rt = p.cs ? await routeCs(p.cs) : null; const og = rt?.origin?.iata_code, ds = rt?.destination?.iata_code;
      if (rt && og !== iata && ds !== iata && [og, ds].some(z => AP[z] && kmTo(a, AP[z].lat, AP[z].lon) < 90)) return; // flying to/from a neighbouring airport
      const okRt = rt && (side === "dep" ? og === iata : ds === iata); const num = okRt && rt.callsign_iata ? rt.callsign_iata : p.cs || p.reg || p.hex.toUpperCase();
      const iso = t ? new Date(t).toISOString() : null; const times = side === "dep" ? { dep: { actual: iso, observed: true }, arr: {} } : { dep: {}, arr: { actual: iso, observed: true } };
      out.push({ id: `${num}-obs-${p.hex}`, number: num, callsign: p.cs, airline: okRt && rt.airline?.iata ? airlineOut(rt.airline.iata) : null, origin: okRt && og ? airportOut(AP[og]) || { iata: og } : side === "dep" ? airportOut(a) : null, destination: okRt && ds ? airportOut(AP[ds]) || { iata: ds } : side === "arr" ? airportOut(a) : null,
        ...times, observedAt: iso, status, statusText, aircraft: { reg: p.reg, type: p.type }, live: p.pos ? { ...p.pos, hex: p.hex, src: o.src } : null, liveOnly: true, observed: true, source: (o.src || "ADS-B") + (okRt ? " + adsbdb route" : ""), ...extra }); };
    for (const e of o.events.filter(e => e.kind === dir).sort((x, y) => y.t - x.t)) await row(e, dir, dir === "dep" ? "departed" : "landed", e.text, e.t, { approx: e.approx });
    for (const p of Object.values(o.ac)) { const c = current(o, p); if (!c) continue; const rt = p.cs ? await routeCs(p.cs) : null; const side = rt ? (rt.origin?.iata_code === iata ? "dep" : rt.destination?.iata_code === iata ? "arr" : null) : null;
      if (dir === "arr" && c.phase === "approach" && side !== "dep") await row(p, "arr", "approaching", `Approaching — ${Math.round(c.s.km / 1.852)} nm out${c.eta != null ? `, about ${c.eta} min` : ""}`, null, { etaMin: c.eta });
      if (dir === "dep" && (c.phase === "taxi" || c.phase === "stand") && side !== "arr" && !o.events.some(e => e.hex === p.hex && e.kind === "arr" && Date.now() - e.t < 20 * 60e3)) await row(p, "dep", c.phase === "taxi" ? "taxiing" : "on ground", c.phase === "taxi" ? "Taxiing" : "On stand / parked (seen on ground)", null);
      if (dir === "arr" && (c.phase === "arrived" || ((c.phase === "taxi" || c.phase === "stand") && side === "arr"))) await row(p, "arr", "landed", c.phase === "arrived" ? "Landed — now taxiing / on stand" : "On ground — arrived", null);
      if (dir === "dep" && c.phase === "leaving" && side !== "arr") await row(p, "dep", "departed", `Airborne leaving — ${Math.round(c.s.km / 1.852)} nm out, ${Math.round(c.s.alt)} ft`, null); }
    for (const w of (o.wide || []).filter(w => w.side === dir && Date.now() - w.at < 30 * 60e3)) await row(w, dir, dir === "dep" ? "departed" : "approaching", dir === "dep" ? `Airborne — departed earlier, now ${Math.round(w.km / 1.852)} nm away` : `En route — ${Math.round(w.km / 1.852)} nm away${w.eta != null ? `, about ${w.eta} min` : ""}`, null, { etaMin: w.eta });
    return out; }); }
async function liveCounts(iata) { const o = await observe(iata); const cur = Object.values(o.ac).map(p => current(o, p)).filter(Boolean); const h3 = Date.now() - 3 * 3600e3;
  return { ground: cur.filter(c => c.phase === "taxi" || c.phase === "stand").length, departing: cur.filter(c => c.phase === "leaving").length, arriving: cur.filter(c => c.phase === "approach").length,
    dep3h: o.events.filter(e => e.kind === "dep" && e.t > h3).length, arr3h: o.events.filter(e => e.kind === "arr" && e.t > h3).length, lastSeen: o.lastSeen ? new Date(o.lastSeen).toISOString() : null }; }
// Sampler: top live airports + anything requested in the last 2h every ~60s; everything else round-robin (~1 every 12s).
let rr = 0; setInterval(async () => { const hot = [...new Set([...TOP_LIVE, ...Object.keys(REQ).filter(c => Date.now() - REQ[c] < 2 * 3600e3)])].filter(c => AP[c] && !OFFICIAL[c]);
  for (const c of hot) { try { await observe(c); } catch {} await new Promise(r => setTimeout(r, 1200)); } }, 60e3);
setInterval(async () => { const cold = [...new Set([...Object.values(UKI).flat(), ...CE_SET])].filter(c => AP[c] && !OFFICIAL[c] && !TOP_LIVE.includes(c)); if (!cold.length) return; const c = cold[rr++ % cold.length]; try { await observe(c); } catch {} }, 12e3);

// ---------- AeroDataBox budget (RapidAPI Basic: 400 units/month hard limit) ----------
// Only the FIDS board for UK/Irish airports with no official feed may spend units; we stop at ADB_BUDGET (default 350).
const ADB_BUDGET = +process.env.ADB_BUDGET || 350, ADB_UNITS = +process.env.ADB_UNITS_PER_CALL || 2; // FIDS is a Tier-2 endpoint = 2 units/call
const adbMonth = () => new Date().toISOString().slice(0, 7);
let ADBU = { month: adbMonth(), units: 0, calls: 0, last: null, blocked: null }; const ADBC = {}; const ADB_INF = {};
const kvGet = async k => { if (!KV_URL) return null; try { const r = await getJSON(KV_URL.replace(/\/$/, "") + "/get/" + k, { headers: { authorization: "Bearer " + KV_TOK } }); return r.result ? JSON.parse(r.result) : null; } catch { return null; } };
const kvSet = (k, v) => { if (!KV_URL) return; fetch(KV_URL.replace(/\/$/, "") + "/set/" + k, { method: "POST", headers: { authorization: "Bearer " + KV_TOK }, body: JSON.stringify(v) }).catch(() => {}); };
let adbReadyP = null; const adbReadyF = () => adbReadyP || (adbReadyP = (async () => { const u = await kvGet("skyline_adb_usage"); if (u && u.month === adbMonth()) ADBU = { ...ADBU, ...u }; })());
const adbLeft = () => { if (ADBU.month !== adbMonth()) ADBU = { month: adbMonth(), units: 0, calls: 0, last: null, blocked: null }; return ADB_BUDGET - ADBU.units; };
const ADB_GAP = () => Object.values(UKI).flat().filter(c => AP[c] && !OFFICIAL[c]);
const ADB_TTL = 20 * 60e3;
// One call per airport covers both directions for a 12h window (max FIDS span) around now: 4h back, 8h ahead, local time.
async function adbFids(iata) { await adbReadyF(); const key = "skyline_adb_" + iata; let c = ADBC[iata] || (ADBC[iata] = await kvGet(key)); const fresh = c && Date.now() - c.at < ADB_TTL;
  if (fresh || !cfg.aerodataboxKey) return c ? { ...c, stale: !fresh } : null;
  if (adbLeft() < ADB_UNITS) { ADBU.blocked = new Date().toISOString(); return c ? { ...c, stale: true, budget: true } : { budget: true }; }
  if (ADB_INF[iata]) return ADB_INF[iata];
  return ADB_INF[iata] = (async () => { const tz = AP[iata]?.tz || "Europe/London"; const lt = ms => new Date(ms).toLocaleString("sv-SE", { timeZone: tz }).replace(" ", "T").slice(0, 16);
    const p = `/flights/airports/iata/${iata}/${lt(Date.now() - 4 * 3600e3)}/${lt(Date.now() + 8 * 3600e3 - 60e3)}?direction=Both&withLeg=true&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;
    ADBU.units += ADB_UNITS; ADBU.calls++; ADBU.last = new Date().toISOString(); kvSet("skyline_adb_usage", ADBU); // count before the call so failures still count
    try { const r = await getJSON(ADB + p, { headers: { "x-rapidapi-key": cfg.aerodataboxKey, "x-rapidapi-host": "aerodatabox.p.rapidapi.com" } });
      c = { at: Date.now(), dep: (r.departures || []).map(normAdb), arr: (r.arrivals || []).map(normAdb) }; ADBC[iata] = c; kvSet(key, c); return c; }
    catch (e) { if (/429|quota|limit/i.test(e.message)) { ADBU.units = Math.max(ADBU.units, ADB_BUDGET); kvSet("skyline_adb_usage", ADBU); } return c ? { ...c, stale: true, error: e.message } : { error: e.message }; }
    finally { delete ADB_INF[iata]; } })(); }
const adbStats = () => { adbLeft(); return { adbConfigured: !!cfg.aerodataboxKey, adbMonth: ADBU.month, adbUnitsUsed: ADBU.units, adbCalls: ADBU.calls, adbBudget: ADB_BUDGET, adbUnitsPerCall: ADB_UNITS, adbBudgetReached: ADBU.units + ADB_UNITS > ADB_BUDGET, adbLastCall: ADBU.last, adbAirports: ADB_GAP() }; };
async function board(iata, dir, ymd) {
  if (OFFICIAL[iata]) { try { const fl = await officialBoard(iata, dir, ymd); return { flights: CE_SET.has(iata) ? CE_KEEP(fl, ymd) : fl, source: OFFICIAL[iata].label, sourceKind: "official", provider: OFFICIAL[iata].provider, site: OFFICIAL[iata].site }; } catch (e) { console.warn("official feed failed", iata, e.message); } }
  const today = ymd === todayLondon();
  // never let the ADS-B fallback push a board past the request timeout (busy airports have hundreds of aircraft)
  const obs = today ? await Promise.race([liveBoard(iata, dir).catch(() => []), new Promise(r => setTimeout(() => r([]), OFFICIAL[iata] ? 8000 : 18000))]) : [];
  const liveOnly = note => ({ flights: obs, source: "Live traffic only (ADS-B)", sourceKind: "live", provider: "Live ADS-B (adsb.lol / adsb.fi)", liveOnly: true, note });
  if (!today || OFFICIAL[iata] || !ADB_GAP().includes(iata) || !cfg.aerodataboxKey) return liveOnly();
  const c = await adbFids(iata);
  if (!c || !c[dir]) return liveOnly(c?.budget ? "AeroDataBox monthly budget used up — showing observed ADS-B traffic only until next month." : c?.error ? "AeroDataBox unavailable right now — showing observed ADS-B traffic." : undefined);
  const key = f => (f.number || "").replace(/\s/g, ""); const have = new Set(); for (const f of c[dir]) { have.add(key(f)); if (f.callsign) have.add(f.callsign); }
  // Observed rows only add value when the schedule doesn't already list that flight.
  const extra = obs.filter(o => !have.has(key(o)) && !(o.callsign && have.has(o.callsign)));
  const flights = c[dir].map(f => { const o = obs.find(o => key(o) === key(f) || (o.callsign && o.callsign === f.callsign)); return o ? { ...f, observed: o.observed, observedAt: o.observedAt, live: o.live } : f; }).concat(extra);
  return { flights, source: "AeroDataBox", sourceKind: "aerodatabox", provider: "AeroDataBox", attribution: "Flight data by AeroDataBox via RapidAPI", stale: !!c.stale, fetchedAt: new Date(c.at).toISOString(),
    note: c.budget ? "AeroDataBox monthly budget used up — schedule shown is the last cached copy; live rows are observed ADS-B." : c.stale ? "Showing the last cached AeroDataBox schedule (could not refresh)." : undefined };
}
// ---- Completed-flight log: keep what each board/lookup reported (esp. ACTUAL times) for 72h, so yesterday's flights stay recallable.
setTimeout(() => { const L = STATE.flog || {}; for (const k in L) { const e = L[k]; if (!(e.dep?.actual || e.arr?.actual || ["landed", "departed", "cancelled"].includes(e.status))) { delete L[k]; continue; } if (e.origin) e.origin = slimAp(e.origin); if (e.destination) e.destination = slimAp(e.destination); } }, 0);
const FLOG_KEEP = 72 * 3600e3; const flogDay = f => { const t = f.dep?.scheduled || f.arr?.scheduled; return t ? new Date(t).toLocaleDateString("en-CA", { timeZone: f.origin?.tz || "Europe/London" }) : null; };
const pick = (a = {}, b = {}) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) if (v != null && v !== "") o[k] = v; return o; };
const slimAp = a => ({ iata: a.iata, icao: a.icao, name: a.name, city: a.city, tz: a.tz, lat: a.lat, lon: a.lon });
const FLOG_MAX = 6000;
function flogPut(f) { if (!f?.number || !(f.dep?.scheduled || f.arr?.scheduled)) return; const L = STATE.flog || (STATE.flog = {}); const k = f.number + "|" + flogDay(f); const p = L[k] || {};
  L[k] = { at: Date.now(), number: f.number, airline: f.airline ? { iata: f.airline.iata, icao: f.airline.icao, name: f.airline.name } : p.airline, origin: f.origin?.iata ? slimAp(f.origin) : p.origin, destination: f.destination?.iata ? slimAp(f.destination) : p.destination,
    dep: pick(p.dep, f.dep), arr: pick(p.arr, f.arr), status: f.status === "scheduled" && p.status ? p.status : f.status, statusText: f.status === "scheduled" && p.statusText ? p.statusText : f.statusText, aircraft: f.aircraft || p.aircraft, callsign: f.callsign || p.callsign,
    sources: [...new Set([...(p.sources || []), f.source].filter(Boolean))] };
  if (!p.at && ++FLOG_N % 200 === 0) { const ks = Object.keys(L); if (ks.length > FLOG_MAX) ks.sort((a, b) => L[a].at - L[b].at).slice(0, ks.length - FLOG_MAX).forEach(k => delete L[k]); } }
let FLOG_N = 0;
// v41 route history: observed block times (dep actual -> arr actual) per origin-destination(-airline) from the flight log. Median, >=3 samples.
let RB = { at: 0, ix: {} };
function routeBlock(o, d, al) { if (!o || !d) return null; if (Date.now() - RB.at > 10 * 60e3) { const ix = {}; for (const e of Object.values(STATE.flog || {})) { const a = Date.parse(e.dep?.actual || ""), b = Date.parse(e.arr?.actual || "");
      if (!a || !b || !e.origin?.iata || !e.destination?.iata) continue; const m = (b - a) / 6e4; if (m < 15 || m > 20 * 60) continue; const k = e.origin.iata + "-" + e.destination.iata; (ix[k] ||= []).push(m); if (e.airline?.iata) (ix[k + "-" + e.airline.iata] ||= []).push(m); } RB = { at: Date.now(), ix }; }
  const med = L => { const x = [...L].sort((p, q) => p - q); return Math.round(x.length % 2 ? x[x.length >> 1] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2); };
  for (const k of [o + "-" + d + "-" + al, o + "-" + d]) { const L = RB.ix[k]; if (L && L.length >= 3) return { med: med(L), n: L.length, scope: k.split("-").length > 2 ? "airline" : "route" }; } return null; }
const flogGet = (num, ymd) => STATE.flog?.[num + "|" + ymd];
setInterval(() => { const L = STATE.flog || {}; for (const k in L) if (Date.now() - L[k].at > FLOG_KEEP) delete L[k]; }, 3600e3);
// ADS-B observed landing/take-off at an airport for a callsign, within a time window.
const obsEvent = (iata, kind, cs, from, to) => cs && OBS[iata]?.events.find(e => e.kind === kind && e.cs === cs && e.t >= from && e.t <= to);
// Feeds sometimes keep "Final call"/"Boarding" for hours after a flight left. If the best time is well past and the feed never
// marked it, show it as departed/landed (est.) instead of a stale gate status. Flagged so the UI can label it.
function staleFix(L, dir) { const now = Date.now(); return L.map(f => { const st = f.status || "";
  if (/cancel|divert|landed/.test(st)) return f;
  if (dir === "dep" && !/departed|enroute/.test(st) && !f.dep?.actual) { const t = Date.parse(f.dep?.estimated || f.dep?.scheduled || ""); if (t && now - t > 40 * 60e3) return { ...f, status: "departed", statusText: `Probably departed (est.) · feed still says ${f.statusText || "scheduled"}`, staleInferred: true }; }
  if (dir === "arr" && !f.arr?.actual) { const t = Date.parse(f.arr?.estimated || f.arr?.scheduled || ""); if (t && now - t > 45 * 60e3) return { ...f, status: "landed", statusText: "Landed (est.)", staleInferred: true }; }
  return f; }); }
api.get("/board/:iata", wrap(async (req, res) => { const iata = req.params.iata.toUpperCase(); const dir = req.query.dir === "arr" ? "arr" : "dep";
  let b; try { b = await Promise.race([board(iata, dir, String(req.query.date || todayLondon())), new Promise((_, rj) => setTimeout(() => rj(Object.assign(new Error("Board source timed out"), { status: 504 })), 25000))]); }
  catch (e) { return res.status(e.status === 504 ? 504 : 502).json({ error: e.status === 504 ? "The airport's timetable took too long to respond. Try again in a minute." : "The airport's timetable is unavailable right now.", detail: String(e.message || e).slice(0, 200), airport: airportOut(AP[iata]) }); }
  const a = AP[iata];
  const [wx, st] = await Promise.all([a ? wxCached(a.lat, a.lon).catch(() => null) : null, dir === "dep" ? boardStats(iata) : null]);
  for (const f of b.flights) { if (["landed", "departed", "cancelled"].includes(f.status)) continue; const t = dir === "dep" ? f.dep.scheduled : f.arr.scheduled;
    const p = predictCore(f, dir === "dep" ? { wxDep: wxAt(wx, t), aptStats: st } : { wxArr: wxAt(wx, t) }); f.pred = { d: p.predictedDelay, on: p.probs.onTime, c: p.confidence, top: p.top, summary: p.summary, factors: p.factors.slice(0, 4) }; }
  // v12.1: only log flights with an outcome (actual time / departed / landed / cancelled); logging every scheduled row of big boards grew state to 7 MB+ and OOMed 512 MB hosts.
  for (const f of b.flights) if (!f.liveOnly && (f.dep?.actual || f.arr?.actual || ["landed", "departed", "cancelled"].includes(f.status))) flogPut(f);
  for (const f of b.flights) { const r = routeBlock(f.origin?.iata, f.destination?.iata, f.airline?.iata); if (r) f.routeBlock = r; }
  warmPhotos(b.flights); const officialUrl = b.sourceKind === "official" ? undefined : AIRPORT_SITE[a.iata]; res.json({ airport: airportOut(a), dir, ...b, officialUrl, flights: staleFix(b.flights || [], dir) }); }));


// ---- Route-based ADS-B match: many airlines (Jet2 EXS, easyJet EZY...) fly alphanumeric callsigns (EXS8KD), so EXS1747 isn't on ADS-B.
// Find an aircraft of the same operator, airborne, on the great circle between origin and destination, heading to the destination,
// near where the flight should be given its real departure time. Once matched, follow that airframe by hex.
const R_NM = 3440.065, rad = x => x * Math.PI / 180;
const nm = (a, b) => { const dl = rad(b.lat - a.lat), dn = rad(b.lon - a.lon); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R_NM * Math.asin(Math.sqrt(h)); };
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)), x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
const lerp = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
const MATCH = {};
const liveOut = (a, src, extra = {}) => ({ hex: a.hex, callsign: (a.flight || "").trim(), reg: a.r, type: a.t, lat: a.lat, lon: a.lon, alt: a.alt_baro, gs: a.gs, track: a.track, vs: a.baro_rate, squawk: a.squawk, seen: a.seen, source: src, ...extra });
async function routeMatch(f) { const o = f.origin, d = f.destination, icao = f.airline?.icao; const t0 = f.dep?.actual; if (!o?.lat || !d?.lat || !icao || !t0) return null;
  const el = (Date.now() - new Date(t0)) / 3600e3; if (el < 0.05 || el > 18) return null; const key = f.number + f.date;
  const m = MATCH[key]; if (m) { const r = await cached("hex:" + m.hex, 15, () => getJSON(`https://api.adsb.lol/v2/hex/${m.hex}`)).catch(() => null); const a = r?.ac?.[0];
    if (a?.lat != null) return liveOut(a, "adsb.lol", { matched: "route", matchNote: m.note }); return null; }
  const tot = nm(o, d), exp = Math.min(tot, Math.max(0, (el - 0.2) * 420)); const p = lerp(o, d, tot ? exp / tot : 0);
  const r = await cached(`pt:${p.lat.toFixed(1)}:${p.lon.toFixed(1)}`, 30, () => getJSON(`https://api.adsb.lol/v2/point/${p.lat.toFixed(3)}/${p.lon.toFixed(3)}/250`)).catch(() => null);
  let best = null; for (const a of r?.ac || []) { const cs = (a.flight || "").trim(); if (!cs.startsWith(icao) || a.lat == null) continue;
    const air = typeof a.alt_baro === "number"; const fo = nm(o, a), td = nm(a, d), x = fo + td - tot; if (x > 40) continue;
    if (air && a.track != null) { const dd = Math.abs(((a.track - brg(a, d)) + 540) % 360 - 180); if (dd > 35) continue; }
    if (!air && td > 8) continue; const sc = Math.abs(fo - exp) + x * 2; if (sc > 160) continue; if (!best || sc < best.sc) best = { a, sc, cs }; }
  if (!best) return null; const note = `Matched by route: ${best.cs}${best.a.r ? " (" + best.a.r + ")" : ""} is the ${f.airline?.name || icao} aircraft on the ${o.iata}→${d.iata} track`;
  MATCH[key] = { hex: best.a.hex, note }; return liveOut(best.a, "adsb.lol", { matched: "route", matchNote: note }); }
async function findFlight(number, ymd) {
  number = number.toUpperCase().replace(/\s+/g, "");
  const result = { number, date: ymd, sources: [] };
  if (cfg.aerodataboxKey) { try { const r = await adb(`/flights/number/${number}/${ymd}?withAircraftImage=false&withLocation=true`, 120); if (r?.length) { result.flight = normAdb(r[0]); result.sources.push("AeroDataBox"); } } catch (e) { result.adbError = e.message; } }
  const cs = toCallsign(number);
  let route = null; if (cs) { try { route = await cached("adsbdb:" + cs, 86400, async () => (await getJSON(`https://api.adsbdb.com/v0/callsign/${cs}`)).response?.flightroute); } catch {} }
  if (!result.flight) {
    const cands = new Set(route ? [route.origin?.iata_code, route.destination?.iata_code].filter(a => OFFICIAL[a]) : [...Object.keys(MAG_SITES), "LHR"]);
    let dep, arr;
    for (const apt of cands) for (const dir of ["dep", "arr"]) { try { const f = (await officialBoard(apt, dir, ymd)).find(x => x.number === number); if (f) dir === "dep" ? (dep = f) : (arr = f); } catch {} }
    const f = dep || arr;
    if (f) { result.flight = { ...f, dep: { ...f.dep, ...(arr && dep ? {} : {}) }, arr: arr ? arr.arr : f.arr, status: arr && ["landed"].includes(arr.status) ? "landed" : f.status }; result.sources.push(f.source); }
  }
  if (!result.flight && route) {
    result.flight = { id: `${number}-${ymd}`, number, airline: airlineOut(number.slice(0, 2)), origin: airportOut(AP[route.origin.iata_code]), destination: airportOut(AP[route.destination.iata_code]), dep: {}, arr: {}, status: "unknown", scheduleUnknown: true, source: "adsbdb route database (no schedule)" };
    result.sources.push("adsbdb (route only)");
  }
  if (result.flight) result.flight.callsign = cs;
  if (cs) { const live = await liveByCallsign(cs).catch(() => null); if (live) { const fit = result.flight ? liveFits(result.flight, live) : { ok: true }; if (fit.ok) { result.live = live; result.sources.push(live.source); } else result.liveRejected = `ADS-B ${live.callsign || cs}${live.reg ? " (" + live.reg + ")" : ""} ignored: ${fit.why}`; } }
  if (!result.live && result.flight && result.flight.status === "departed" && !result.flight.arr?.actual) { const lv = await routeMatch({ ...result.flight, date: ymd }).catch(() => null); if (lv && liveFits(result.flight, lv).ok) { result.live = lv; result.sources.push("adsb.lol (route match)"); } }
  const F = result.flight, L = result.live;
  if (F && L?.lat != null && F.destination?.lat) { const rem = nm(L, F.destination), tot = nm(F.origin || L, F.destination);
    L.remainingNm = Math.round(rem); L.progress = tot ? Math.max(0, Math.min(100, Math.round((1 - rem / tot) * 100))) : null;
    if (typeof L.alt === "number" && L.gs > 80) { L.eta = new Date(Date.now() + (rem / L.gs + 8 / 60) * 3600e3).toISOString(); if (!F.arr?.actual) { F.arr = F.arr?.estimated ? F.arr : { ...F.arr, estimated: L.eta, etaSource: "ADS-B (distance ÷ ground speed + 8 min approach)" }; } if (["departed", "scheduled", "delayed", "boarding", "gate"].includes(F.status)) { F.status = "enroute"; F.statusText = "En route"; } }
    else if (L.alt === "ground" && rem < 8 && F.status !== "landed") { F.status = "landed"; F.statusText = "Landed (ADS-B: on the ground at " + F.destination.iata + ")"; } }
  { const g = flogGet(number, ymd); if (g) { if (!result.flight) { result.flight = { id: `${number}-${ymd}`, ...g, source: "Skyline flight log (recorded from " + g.sources.join(", ") + ")" }; result.sources.push("Skyline flight log"); }
      else { const F2 = result.flight; F2.dep = pick(g.dep, F2.dep); F2.arr = pick(g.arr, F2.arr); if (["scheduled", "unknown"].includes(F2.status) && ["landed", "departed", "cancelled"].includes(g.status)) { F2.status = g.status; F2.statusText = g.statusText; } } } }
  { const F2 = result.flight, c2 = F2?.callsign; if (F2 && c2) { const sd = +new Date(F2.dep?.scheduled || F2.arr?.scheduled || ymd + "T00:00:00Z");
      const d = !F2.dep?.actual && obsEvent(F2.origin?.iata, "dep", c2, sd - 2 * 3600e3, sd + 12 * 3600e3); if (d) F2.dep = { ...F2.dep, actual: new Date(d.t).toISOString(), actualSource: "ADS-B observed" + (d.approx ? " (approx.)" : "") };
      const a2 = !F2.arr?.actual && obsEvent(F2.destination?.iata, "arr", c2, sd, sd + 20 * 3600e3); if (a2) { F2.arr = { ...F2.arr, actual: new Date(a2.t).toISOString(), actualSource: "ADS-B observed" + (a2.approx ? " (approx.)" : "") }; F2.status = "landed"; F2.statusText = "Landed (observed by ADS-B)"; } } }
  if (result.flight) { const F2 = result.flight; for (const s2 of ["dep", "arr"]) { const t = F2[s2] || (F2[s2] = {}); const ref = t.actual || t.estimated; t.delayMin = ref && t.scheduled ? Math.round((new Date(ref) - new Date(t.scheduled)) / 60e3) : null; }
    if (["landed", "departed"].includes(F2.status) || F2.arr?.actual || F2.dep?.actual) flogPut(F2); }
  if (result.flight) { const r = routeBlock(result.flight.origin?.iata, result.flight.destination?.iata, result.flight.airline?.iata); if (r) result.flight.routeBlock = r; }
  if (result.flight) { const F2 = result.flight; const de = depEvidence(F2, result.live), ae = arrEvidence(F2, result.live); F2.evidence = { dep: de, arr: ae };
    // v34: never state departed/landed as fact without evidence (a feed actual time or matched live ADS-B).
    if (["departed", "enroute"].includes(F2.status) && !de) { F2.status = "departed"; F2.unconfirmed = true; F2.statusText = "Departed per airport feed · not yet seen airborne"; }
    if (F2.status === "landed" && !ae) { F2.unconfirmed = true; F2.statusText = "Landed per airport feed · not yet confirmed"; } }
  if (result.flight && !result.flight.date) result.flight.date = ymd;
  return result;
}
// v13: batched status for tracked flights, polled every 2 min by the app. Per-flight result cached <= 110 s; AeroDataBox calls keep their own quota guard.
api.get("/flights", wrap(async (req, res) => { const ids = String(req.query.ids || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 20); const out = {};
  for (const id of ids) { const [n, d] = id.split("@"); if (!/^[A-Z0-9]{2,8}$/i.test(n || "")) continue; const ymd = /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : todayLondon();
    try { out[id] = await Promise.race([cached(`ff:${n.toUpperCase()}:${ymd}`, 110, () => findFlight(n, ymd)), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 14e3))]); } catch (e) { out[id] = { error: String(e.message || e) }; } }
  res.json({ at: new Date().toISOString(), ttl: 120, flights: out }); }));
api.get("/flight/:number", wrap(async (req, res) => res.json(await findFlight(req.params.number, String(req.query.date || todayLondon())))));
api.get("/route", wrap(async (req, res) => { const from = String(req.query.from || "").toUpperCase(), to = String(req.query.to || "").toUpperCase(), ymd = String(req.query.date || todayLondon());
  let list = [], source = "";
  if (OFFICIAL[from]) { list = (await officialBoard(from, "dep", ymd)).filter(f => !to || f.destination?.iata === to); source = "official"; }
  else if (OFFICIAL[to]) { list = (await officialBoard(to, "arr", ymd)).filter(f => !from || f.origin?.iata === from); source = "official"; }
  else { const b = await board(from, "dep", ymd); list = b.flights.filter(f => !to || f.destination?.iata === to); source = b.source; }
  res.json({ flights: list, source }); }));
api.get("/live/:callsign", wrap(async (req, res) => res.json(await liveByCallsign(req.params.callsign.toUpperCase()))));
api.get("/live-area", wrap(async (req, res) => { const lat = (+req.query.lat).toFixed(1), lon = (+req.query.lon).toFixed(1);
  res.json(await cached(`area:${lat}:${lon}`, 15, async () => { const r = await getJSON(`https://api.adsb.lol/v2/point/${lat}/${lon}/100`); return (r.ac || []).filter(a => a.lat).slice(0, 300).map(a => ({ hex: a.hex, cs: (a.flight || "").trim(), lat: a.lat, lon: a.lon, track: a.track, alt: a.alt_baro, type: a.t, reg: a.r })); })); }));
// "Is my plane here yet?": live position of the assigned aircraft (by hex or registration) relative to the departure airport. adsb.lol, fallback adsb.fi.
api.get("/plane-here", wrap(async (req, res) => { const hex = String(req.query.hex || "").toLowerCase().replace(/[^0-9a-f]/g, ""), reg = String(req.query.reg || "").toUpperCase().replace(/[^A-Z0-9-]/g, ""); const ap = AP[String(req.query.at || "").toUpperCase()];
  if (!hex && !reg) return res.status(400).json({ error: "No aircraft assigned yet" });
  const r = await cached(`ph:${hex || reg}`, 45, () => adsbGate(async () => { const us = hex ? [`https://api.adsb.lol/v2/hex/${hex}`, `https://opendata.adsb.fi/api/v2/hex/${hex}`] : [`https://api.adsb.lol/v2/reg/${reg}`, `https://opendata.adsb.fi/api/v2/registration/${reg}`];
    for (const u of us) { try { const j = await getJSON(u); return { ac: (j.ac || j.aircraft || [])[0] || null, src: u.includes("lol") ? "adsb.lol" : "adsb.fi" }; } catch {} } throw new Error("ADS-B sources unavailable, try again shortly"); }));
  const x = r.ac; if (!x || x.lat == null) return res.json({ seen: false, src: r.src, note: "Not broadcasting a position right now (parked with transponder off, or outside receiver coverage)" });
  const km = ap ? Math.round(kmTo(ap, x.lat, x.lon)) : null; const gnd = x.alt_baro === "ground" || (x.gs ?? 99) < 40;
  res.json({ seen: true, src: r.src, callsign: (x.flight || "").trim(), reg: x.r, type: x.t, alt: x.alt_baro, gs: x.gs, lat: x.lat, lon: x.lon, km, onGround: gnd, here: km != null && km < 6 && gnd, seenSec: x.seen_pos ?? x.seen }); }));

// ---------- v14: real aircraft photos ----------
// 1) Planespotters.net public photo API for the exact aircraft (reg or hex). Hotlinked + credited per their terms. 24 h cache, 6 h for "no photo".
// 2) Fallback: another real registration of the same airline + ICAO type seen by ADS-B (our observed log, then adsb.lol /v2/type), looked up on Planespotters.
// 3) Fallback: Wikimedia Commons file search "<airline> <type>", freely licensed only (CC0 / PD / CC BY / CC BY-SA), no interiors, models or cockpits. 7-day cache.
let psLast = 0; const psQ = []; let psBusy = false;
function psGate(fn) { return new Promise((ok, no) => { psQ.push({ fn, ok, no }); psPump(); }); }
async function psPump() { if (psBusy) return; psBusy = true; while (psQ.length) { const j = psQ.shift(); const w = psLast + 350 - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); psLast = Date.now();
  try { j.ok(await j.fn()); } catch (e) { j.no(e); } } psBusy = false; }
async function psPhoto(kind, id) { id = String(id || "").toUpperCase().trim(); if (!id || !/^[A-Z0-9-]{3,10}$/.test(id)) return null; const k = `psv14:${kind}:${id}`;
  const h = C.get(k); if (h && h.exp > Date.now()) return h.v;
  try { const j = await psGate(() => getJSON(`https://api.planespotters.net/pub/photos/${kind}/${kind === "hex" ? id.toLowerCase() : id}`, { headers: { "user-agent": UA } })); const ph = j.photos?.[0];
    const v = ph ? { src: ph.thumbnail_large?.src || ph.thumbnail?.src, w: ph.thumbnail_large?.size?.width, h: ph.thumbnail_large?.size?.height, link: ph.link, author: ph.photographer, source: "Planespotters.net", license: "© photographer, shown via the Planespotters.net API", reg: kind === "reg" ? id : null } : null;
    C.set(k, { v, exp: Date.now() + (v ? 86400e3 : 6 * 3600e3) }); return v; } catch (e) { return h?.v ?? null; } }
const FREE_LIC = /^(cc0|public domain|pd|cc by(-sa)? ?[0-9.]*( [a-z]+)?|cc-by(-sa)?-[0-9.]+)$/i;
const BAD = /interior|cabin|cockpit|seat|model|toy|diecast|lego|galley|lavatory|livery drawing|logo|menu|ticket|boarding pass|meal|engine detail|tail fin only|crash|accident|wreck/i;
const stripTags = s => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
async function commonsPhoto(airline, typeName) { if (!typeName) return null; const anyLivery = !airline; airline = airline || "";
  const words = airline.split(/\s+/).filter(w => w.length > 2 && !/^(air|airlines|airways|the)$/i.test(w)); const key = (words[0] || airline).toLowerCase();
  const model = (typeName.match(/(A\d{3}|\d{3}|E\d{3}|CRJ\d*|ATR ?\d\d|Q400|Dash 8|A220|ERJ)/i) || [typeName])[0].toLowerCase().replace(/\s/g, "");
  const q = `${airline} ${anyLivery ? typeName : typeName.replace(/^(Airbus|Boeing|Embraer|Bombardier|De Havilland)\s+/i, "")} filetype:bitmap -interior -cabin -cockpit -model`;
  const j = await getJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo|categories&cllimit=50&iiprop=url|extmetadata|size&iiurlwidth=960`);
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of pages) { const ii = p.imageinfo?.[0]; if (!ii || !ii.thumburl) continue; const m = ii.extmetadata || {}; const lic = stripTags(m.LicenseShortName?.value);
    const blob = (p.title + " " + (p.categories || []).map(c => c.title).join(" ")).toLowerCase().replace(/_/g, " "); const flat = blob.replace(/[\s-]/g, "");
    if (!FREE_LIC.test(lic) || BAD.test(p.title + " " + stripTags(m.ImageDescription?.value)) || !(anyLivery || blob.includes(airline.toLowerCase()) || (key.length > 4 && blob.includes(key))) || !flat.includes(model) || ii.width < ii.height) continue;
    return { src: ii.thumburl, link: ii.descriptionurl, author: stripTags(m.Artist?.value).slice(0, 80) || "Unknown", license: lic, licenseUrl: m.LicenseUrl?.value || null, source: "Wikimedia Commons", title: p.title.replace(/^File:/, "") }; }
  return null; }
// v15: the airline's most common type in our observed ADS-B log (its "typical" aircraft) when the flight's own type is unknown.
function typicalType(alIcao) { const n = {}; for (const o of Object.values(OBS)) for (const p of Object.values(o.ac || {})) if (p.type && (p.cs || "").startsWith(alIcao)) n[p.type] = (n[p.type] || 0) + 1; return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }
const TYPE_NAME = { A319: "Airbus A319", A320: "Airbus A320", A20N: "Airbus A320neo", A321: "Airbus A321", A21N: "Airbus A321neo", B738: "Boeing 737-800", B38M: "Boeing 737 MAX 8", B737: "Boeing 737-700", B789: "Boeing 787-9", B788: "Boeing 787-8", B77W: "Boeing 777-300ER", A333: "Airbus A330-300", A359: "Airbus A350-900", E190: "Embraer 190", E195: "Embraer 195", AT76: "ATR 72", DH8D: "Dash 8 Q400", BCS3: "Airbus A220-300", A388: "Airbus A380" };
// v15: lazily warm exact-aircraft photos for registrations on boards (max 8 per call, each reg at most once per 24 h; psGate keeps 350 ms spacing).
const WARMED = new Map(); function warmPhotos(list) { let n = 0; if (psQ.length > 20) return; for (const f of list || []) { const r = f.aircraft?.reg; if (!r || WARMED.has(r)) continue; WARMED.set(r, Date.now()); psPhoto("reg", r).catch(() => {}); if (++n >= 8) break; }
  if (WARMED.size > 5000) for (const [k, t] of WARMED) if (Date.now() - t > 86400e3) WARMED.delete(k); }
function seenRegs(alIcao, type) { const out = new Set(); for (const o of Object.values(OBS)) for (const p of Object.values(o.ac || {})) if (p.reg && (p.cs || "").startsWith(alIcao) && (!type || p.type === type)) out.add(p.reg); return [...out]; }
async function fleetRegs(alIcao, type) { const a = seenRegs(alIcao, type); if (a.length >= 3 || !type) return a;
  try { const j = await cached(`type:${type}`, 1800, () => adsbGate(() => getJSON(`https://api.adsb.lol/v2/type/${type}`))); for (const x of j.ac || []) if (x.r && (x.flight || "").trim().startsWith(alIcao) && !a.includes(x.r)) a.push(x.r); } catch {}
  return a.slice(0, 6); }
api.get("/photo", wrap(async (req, res) => { const reg = String(req.query.reg || "").toUpperCase(), hex = String(req.query.hex || ""), al = String(req.query.al || "").toUpperCase(), aln = String(req.query.aln || "").slice(0, 60), type = String(req.query.type || "").toUpperCase().slice(0, 4), tn = String(req.query.tn || "").slice(0, 40);
  if (reg || hex) { const p = (reg && await psPhoto("reg", reg)) || (hex && await psPhoto("hex", hex)); if (p) return res.json({ kind: "exact", reg: reg || p.reg, ...p }); }
  if (!al && !aln && !type && !tn) return res.json({ kind: "none" });
  const v = await cached(`sel15:${al}:${type || tn}`, 7 * 86400, async () => {
    if (al && type) for (const r of await fleetRegs(al, type)) { if (r === reg) continue; const p = await psPhoto("reg", r); if (p) return { kind: "same-type", ...p, reg: r }; }
    if (aln) try { const c = await commonsPhoto(aln, tn); if (c) return { kind: "same-type", ...c }; } catch {}
    const tt = !type && al ? typicalType(al) : null; // typical aircraft of this airline
    if (tt) { for (const r of (await fleetRegs(al, tt)).slice(0, 3)) { const p = await psPhoto("reg", r); if (p) return { kind: "typical", ...p, reg: r, typeName: TYPE_NAME[tt] || tt }; } }
    const anyT = tn || TYPE_NAME[type || tt] || null; // a real freely licensed photo of the type in any livery
    if (anyT) try { const c = await commonsPhoto("", anyT); if (c) return { kind: "type", ...c, typeName: anyT }; } catch {}
    return { kind: "none" }; });
  if (v.kind === "none") C.set(`sel15:${al}:${type || tn}`, { v, exp: Date.now() + 6 * 3600e3 });
  res.set("cache-control", "public, max-age=86400");
  res.json(v); }));
// v15: where this aircraft has been. Free sources only: our own ADS-B take-off/landing log (OBS events) and the 72 h completed-flight log.
// Public trace files (adsb.lol / airplanes.live / adsb.fi globe traces) are behind a browser check or not public, and OpenSky history needs an account, so they are not used.
api.get("/aircraft/:reg/history", wrap(async (req, res) => { const reg = String(req.params.reg || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10); const hex = String(req.query.hex || "").toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 6);
  if (!reg && !hex) return res.status(400).json({ error: "registration required" });
  const out = await cached(`achist:${reg}:${hex}`, 900, async () => { const legs = new Map(); const same = x => (reg && String(x || "").toUpperCase().replace(/[^A-Z0-9-]/g, "") === reg);
    for (const e of Object.values(STATE.flog || {})) { const a = e.aircraft || {}; if (!(same(a.reg) || (hex && String(a.hex || "").toLowerCase() === hex))) continue;
      const t = e.dep?.actual || e.dep?.estimated || e.dep?.scheduled; legs.set(e.number + "|" + String(t).slice(0, 10), { number: e.number, airline: e.airline?.name, from: e.origin?.iata, fromCity: e.origin?.city, to: e.destination?.iata, toCity: e.destination?.city,
        dep: e.dep?.actual || null, depSched: e.dep?.scheduled || null, arr: e.arr?.actual || null, arrSched: e.arr?.scheduled || null, status: e.status, source: "Airport boards (Skyline flight log)" }); }
    for (const [ap, o] of Object.entries(OBS)) for (const ev of o.events || []) { if (!(same(ev.reg) || (hex && ev.hex === hex))) continue;
      const k = (ev.cs || "") + "|" + ap + "|" + ev.kind; if ([...legs.values()].some(l => (ev.kind === "dep" ? l.from : l.to) === ap && Math.abs(+new Date(ev.kind === "dep" ? l.dep || l.depSched : l.arr || l.arrSched) - ev.t) < 3 * 3600e3)) continue;
      legs.set(k + ev.t, { number: ev.cs, from: ev.kind === "dep" ? ap : null, to: ev.kind === "arr" ? ap : null, dep: ev.kind === "dep" ? new Date(ev.t).toISOString() : null, arr: ev.kind === "arr" ? new Date(ev.t).toISOString() : null, observed: true, approx: ev.approx, source: "ADS-B (" + (o.src || "adsb.lol") + "), observed " + (ev.kind === "dep" ? "take-off" : "landing") }); }
    const list = [...legs.values()].sort((a, b) => +new Date(b.dep || b.depSched || b.arr || b.arrSched) - +new Date(a.dep || a.depSched || a.arr || a.arrSched)).slice(0, 12);
    return { reg, hex: hex || null, legs: list, window: "last 72 h", note: list.length ? null : "No recent flight history available" }; });
  res.json(out); }));
api.get("/aircraft", wrap(async (req, res) => {
  let hex = String(req.query.hex || ""), reg = String(req.query.reg || ""); const out = {};
  if (hex) { try { const h = await cached("hexdb:" + hex, 86400 * 7, () => getJSON(`https://hexdb.io/api/v1/aircraft/${hex}`)); Object.assign(out, { reg: h.Registration, type: h.Type, icaoType: h.ICAOTypeCode, manufacturer: h.Manufacturer, owner: h.RegisteredOwners }); reg = reg || h.Registration; } catch {} }
  try { const p = await cached("ps:" + (hex || reg), 86400, () => getJSON(hex ? `https://api.planespotters.net/pub/photos/hex/${hex}` : `https://api.planespotters.net/pub/photos/reg/${reg}`)); const ph = p.photos?.[0];
    if (ph) out.photo = { src: ph.thumbnail_large?.src, link: ph.link, credit: ph.photographer }; } catch {}
  out.hex = hex; out.reg = out.reg || reg; res.json(out); }));
api.get("/inbound", wrap(async (req, res) => { const reg = String(req.query.reg || ""), ymd = String(req.query.date || todayLondon());
  if (!reg) return res.json({ flights: [], note: "aircraft registration not known yet" });
  const r = await adb(`/flights/reg/${reg}/${ymd}?withLocation=false`, 300); res.json({ flights: (r || []).map(normAdb), source: "AeroDataBox" }); }));

// ---- Airport info: runways (OurAirports), sun times + weather (Open-Meteo), live traffic (adsb.lol) ----
let RWY = null, rwyLoading = null;
async function runwaysFor(icao) { if (!RWY) { rwyLoading ||= fetch("https://davidmegginson.github.io/ourairports-data/runways.csv").then(r => r.text()).then(t => { RWY = {}; const L = t.split("\n"); const H = csv(L[0]);
  const ix = k => H.indexOf(k); for (const l of L.slice(1)) { if (!l) continue; const v = csv(l); const id = v[ix("airport_ident")]; if (v[ix("closed")] === "1") continue;
    (RWY[id] ||= []).push({ le: v[ix("le_ident")], he: v[ix("he_ident")], lengthFt: +v[ix("length_ft")] || null, widthFt: +v[ix("width_ft")] || null, surface: v[ix("surface")], lighted: v[ix("lighted")] === "1", heading: +v[ix("le_heading_degT")] || null }); } }).catch(e => { rwyLoading = null; throw e; }); await rwyLoading; }
  return RWY[icao] || []; }
api.get("/airport/:iata/info", wrap(async (req, res) => { const a = AP[req.params.iata.toUpperCase()]; if (!a) return res.status(404).json({ error: "unknown airport" });
  const [rw, wx, live] = await Promise.all([
    a.icao ? runwaysFor(a.icao).catch(() => null) : null,
    cached(`apwx:${a.iata}`, 900, () => getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,precipitation&daily=sunrise,sunset&forecast_days=1&wind_speed_unit=kn&timezone=${encodeURIComponent(a.tz || "auto")}`)).catch(() => null),
    cached(`aplive:${a.iata}`, 60, async () => { const r = await getJSON(`https://api.adsb.lol/v2/point/${a.lat}/${a.lon}/25`); const ac = r.ac || []; return { total: ac.length, ground: ac.filter(x => x.alt_baro === "ground").length, low: ac.filter(x => typeof x.alt_baro === "number" && x.alt_baro < 10000).length, source: "adsb.lol" }; }).catch(() => null)]);
  res.json({ airport: airportOut(a), runways: rw, weather: wx?.current || null, sun: wx?.daily ? { sunrise: wx.daily.sunrise?.[0], sunset: wx.daily.sunset?.[0] } : null, live }); }));
api.get("/weather", wrap(async (req, res) => { const lat = (+req.query.lat).toFixed(2), lon = (+req.query.lon).toFixed(2);
  res.json(await cached(`wx:${lat}:${lon}`, 900, () => getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover,precipitation,relative_humidity_2m,pressure_msl,dew_point_2m&hourly=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation_probability,visibility&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&wind_speed_unit=kn&forecast_days=7&timezone=auto`))); }));
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
  const step = (fn, icon, title, text, kind, data) => { const before = mu; fn(); const impact = Math.round(mu - before); F.push({ icon, title, text, impact, kind, data }); };
  const hist = Object.values(HIST[f.number] || {}).filter(x => x.d != null);
  if (hist.length >= 3) { const m = hist.reduce((a, x) => a + Math.max(-10, Math.min(180, x.d)), 0) / hist.length; const w = Math.min(hist.length, 20) / 6; signals.push("history");
    step(() => { mu = (mu * w0 + m * w) / (w0 + w); w0 += w; }, "📊", `Route history: ${m >= 0 ? "+" : ""}${Math.round(m)}m average`, `${f.number} averaged ${Math.round(m)} min vs schedule across ${hist.length} flights Skyline has recorded (up to 60 days).`, "history"); }
  if (hist.length < 3 && f.origin?.iata) { const L = learned(f.origin.iata, f.destination?.iata); const src = L.route?.n >= 5 ? ["route", L.route] : L.airport?.n >= 15 ? ["airport", L.airport] : null;
    if (src) { const [kind, v] = src, w = Math.min(v.n, 40) / 15; signals.push("learned");
      step(() => { mu = (mu * w0 + v.avg * w) / (w0 + w); w0 += w; }, "🧠", kind === "route" ? `Learned: ${f.origin.iata}→${f.destination?.iata} ${v.avg >= 0 ? "+" : ""}${v.avg}m typical` : `Learned: ${f.origin.iata} departures ${v.avg >= 0 ? "+" : ""}${v.avg}m typical`, `From ${v.n} real ${kind === "route" ? "flights on this route" : "departures from " + f.origin.iata} Skyline recorded (last 60 days): average ${v.avg} min vs schedule, ${v.late15}% were 15+ min late.`, "learned"); } }
  const st = ctx.aptStats; if (st?.avgDelay != null && st.n >= 5) { const w = 1.2; signals.push("airport");
    step(() => { mu = (mu * w0 + st.avgDelay * w) / (w0 + w); w0 += w; }, st.avgDelay >= 20 ? "🚦" : "🛫", st.avgDelay >= 20 ? `${f.origin?.iata} congested right now` : `${f.origin?.iata} running normally`, `Departures over the last 4 h: average ${st.avgDelay} min late, ${st.onTime}% on time, ${st.cancelled || 0}% cancelled (${st.n} flights, live board).`, "airport", { n: st.n, avgDelay: st.avgDelay, onTime: st.onTime, cancelled: st.cancelled, counts: st.counts, trend: st.trend, airport: f.origin?.iata }); }
  const sd = f.dep?.scheduled; const loc = sd ? new Date(new Date(sd).toLocaleString("en-US", { timeZone: f.origin?.tz || "Europe/London" })) : null;
  if (loc) { const h = loc.getHours(), d = loc.getDay();
    if (h >= 17) step(() => { mu += 5; }, "🌆", "Evening departure bank", `Departs ${String(h).padStart(2, "0")}:00 local — knock-on delays build up through the day.`, "time");
    else if (h < 8) step(() => { mu -= 3; }, "🌅", "First wave of the day", "Early departures usually use aircraft that night-stopped, so less knock-on delay.", "time");
    if (d === 5 || d === 0) step(() => { mu += 2; }, "📅", d === 5 ? "Friday peak" : "Sunday peak", "Busier leisure days carry slightly more delay.", "time");
    if (h >= 22 || h < 1) F.push({ icon: "🌙", title: "Near night curfew window", text: "Many airports restrict late movements — big delays risk cancellation rather than late departure.", impact: 0, kind: "curfew" }); }
  let wxp = 0; for (const [w, where, k] of [[ctx.wxDep, f.origin?.iata || "departure", 1], [ctx.wxArr, f.destination?.iata || "arrival", 0.7]]) for (const x of wxFactors(w, where)) { wxp += x.p * k; step(() => { mu += x.p * k; }, x.icon, x.title, x.text + (k < 1 ? " (arrival-side, weighted 70%)" : ""), "weather", { gust: w.gust != null ? Math.round(w.gust) : null, wind: w.wind != null ? Math.round(w.wind) : null, vis: w.vis, precip: w.precip, code: w.code, where }); }
  if (ctx.wxDep || ctx.wxArr) signals.push("weather");
  if (wxp === 0 && (ctx.wxDep || ctx.wxArr)) F.push({ icon: "☀️", title: "Weather looks fine", text: "No storms, strong gusts, fog or snow forecast at departure/arrival time (Open-Meteo).", impact: 0, kind: "weather" });
  if (ctx.inbound) { const ib = ctx.inbound; const slack = (new Date(sd) - new Date(ib.eta)) / 60000 - 40; signals.push("inbound");
    if (slack < 0) step(() => { mu = Math.max(mu, -slack + 3); }, "🔁", `Inbound ${ib.number} running late`, `The aircraft operating this flight is due in ${Math.round(-slack)} min after the ~40 min minimum turnaround allows.`, "inbound", { number: ib.number, eta: ib.eta, dep: sd, slack: Math.round(slack) });
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
async function boardStats(iata) { if (!OFFICIAL[iata]) return null; try { return statsFrom(await officialBoard(iata, "dep", todayLondon())); } catch { return null; } }
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
  const dn = recent.filter(f => f.status !== "cancelled").map(delayMin).filter(d => d != null && !Number.isNaN(d)), late = dn.filter(d => d >= 15).length, trend = [3, 2, 1, 0].map(h => { const b = recent.filter(f => { const t = new Date(f.dep.scheduled || f.arr.scheduled); return t <= now - h * 3600e3 && t > now - (h + 1) * 3600e3; }).map(delayMin).filter(d => d != null && !Number.isNaN(d)); return b.length ? Math.round(b.reduce((a, c) => a + Math.max(0, c), 0) / b.length) : null; });
  return { counts: { onTime: dn.length - late, late, cancelled: canc, unknown: Math.max(0, recent.length - dn.length - canc) }, trend, n: recent.length, onTime: ds.length ? Math.round(ds.filter(d => d < 15).length / ds.length * 100) : null, avgDelay: ds.length ? Math.max(0, Math.round(ds.reduce((a, c) => a + Math.max(0, c), 0) / ds.length)) : null, cancelled: recent.length ? Math.round(canc / recent.length * 100) : 0 };
}
const UKC = {}; async function ukCount(c) { const h = UKC[c]; if (h && Date.now() - h.t < 600e3) return h.v; let v;
  if (OFFICIAL[c]) { const ymd = todayLondon(); const [d, r] = await Promise.all([officialBoard(c, "dep", ymd).catch(() => null), officialBoard(c, "arr", ymd).catch(() => null)]); v = d || r ? { dep: d?.length ?? null, arr: r?.length ?? null, kind: "official" } : null; }
  if (!v) { try { const l = await liveCounts(c); v = { ...l, kind: "live" }; } catch { v = null; } } UKC[c] = { t: Date.now(), v }; return v; }
const REGION_SUB = { "ES-CN": "Canary Islands", "ES-IB": "Balearic Islands", "PT-20": "Azores", "PT-30": "Madeira", "FR-20R": "Corsica", "FR-COR": "Corsica", "IT-88": "Sardinia", "IT-82": "Sicily" };
api.get("/uk", wrap(async (req, res) => { const out = []; const eu = req.query.region === "eu";
  const ce = req.query.region === "ce";
  const groups = ce ? (() => { const g = {}; for (const [cc, l] of Object.entries(CEU)) for (const a of l) (g[CEU_NAMES[cc]] ||= []).push(a.iata); return g; })() : eu ? (() => { const g = {}; for (const [cc, l] of Object.entries(WEU)) for (const a of l) { const k = WEU_NAMES[cc] + (REGION_SUB[a.region] ? " – " + REGION_SUB[a.region] : ""); (g[k] ||= []).push(a.iata); } g["Norway"] = AVINOR; return g; })() : UKI;
  for (const [country, codes] of Object.entries(groups)) for (const c of codes) { const a = AP[c]; if (!a) continue; out.push({ ...airportOut(a), country, feed: OFFICIAL[c] ? "official" : cfg.aerodataboxKey && !eu && !ce ? "aerodatabox" : "live", source: OFFICIAL[c]?.site || null, blocked: (OFFICIAL[c] ? null : EU_BLOCKED[c] || CE_BLOCKED[c]) || null }); }
  res.json({ airports: out.map(a => { const lc = a.feed === "official" ? null : obsCounts(a.iata); return { ...a, counts: lc || UKC[a.iata]?.v || null, countsAt: lc ? lc.sampledAt : UKC[a.iata] ? new Date(UKC[a.iata].t).toISOString() : null, lastSeen: lc?.lastSeen || null }; }), at: new Date().toISOString() }); }));
(async function warmUk() { for (const c of Object.values(UKI).flat()) { if (!AP[c] || !OFFICIAL[c]) continue; try { await ukCount(c); } catch {} await new Promise(r => setTimeout(r, 1500)); } setTimeout(warmUk, 5 * 60e3); })();
function obsCounts(c) { const o = OBS[c]; if (!o?.sampledAt) return null; const cur = Object.values(o.ac).map(p => current(o, p)).filter(Boolean); const h3 = Date.now() - 3 * 3600e3;
  return { kind: "live", ground: cur.filter(x => x.phase === "taxi" || x.phase === "stand").length, departing: cur.filter(x => x.phase === "leaving").length, arriving: cur.filter(x => x.phase === "approach").length, dep3h: o.events.filter(e => e.kind === "dep" && e.t > h3).length, arr3h: o.events.filter(e => e.kind === "arr" && e.t > h3).length, lastSeen: o.lastSeen ? new Date(o.lastSeen).toISOString() : null, sampledAt: new Date(o.sampledAt).toISOString() }; }
api.get("/status", wrap(async (req, res) => {
  const region = String(req.query.region || "All"); const codes = (region === "All" ? Object.values(STATUS_AIRPORTS).flat() : STATUS_AIRPORTS[region] || []).filter(c => AP[c]);
  const out = await Promise.all(codes.map(async c => { const a = airportOut(AP[c]); const reg = Object.keys(STATUS_AIRPORTS).find(k => STATUS_AIRPORTS[k].includes(c));
    try {
      if (OFFICIAL[c]) { const ymd = todayLondon(); const [d, r] = await Promise.all([officialBoard(c, "dep", ymd), officialBoard(c, "arr", ymd)]); return { airport: a, region: reg, dep: statsFrom(d), arr: statsFrom(r), source: "official" }; }
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
function airlineBreak(list, now = Date.now()) { const m = {};
  for (const f of list) { const t = new Date(f.dep.scheduled || f.arr.scheduled); if (!(t <= now && t > now - 4 * 3600e3)) continue; const k = f.airline?.iata || f.number.slice(0, 2); const r = m[k] ||= { iata: k, name: f.airline?.name || k, n: 0, canc: 0, d: [] }; r.n++;
    if (f.status === "cancelled") r.canc++; else { const d = delayMin(f); if (d != null && !Number.isNaN(d)) r.d.push(Math.max(0, d)); } }
  return Object.values(m).filter(r => r.n >= 3).map(r => ({ iata: r.iata, name: r.name, n: r.n, cancelled: r.canc, avgDelay: r.d.length ? Math.round(r.d.reduce((a, c) => a + c, 0) / r.d.length) : 0 })).sort((a, b) => (b.cancelled * 30 + b.avgDelay) - (a.cancelled * 30 + a.avgDelay)).slice(0, 6); }
function wxCause(w) { if (!w) return null; const c = w.code; const t = c >= 95 ? "Thunderstorms" : c >= 71 && c <= 77 || c === 85 || c === 86 ? "Snow" : c === 45 || c === 48 ? "Fog" : c === 66 || c === 67 || c === 56 || c === 57 ? "Freezing rain" : null;
  const parts = [t, w.windKts >= 30 ? `Strong wind ${w.windKts} kt` : null].filter(Boolean); return parts.length ? parts.join(" · ") : null; }
const wxNow = a => cached(`wxnow:${a.iata}`, 600, async () => { const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day&wind_speed_unit=kn`); const c = j.current || {};
  return { temp: c.temperature_2m, windKts: c.wind_speed_10m != null ? Math.round(c.wind_speed_10m) : null, windDir: c.wind_direction_10m, code: c.weather_code, isDay: c.is_day }; });
api.get("/disruptions", wrap(async (req, res) => {
  const out = await cached("disruptions:" + !!cfg.aerodataboxKey + ":" + Object.keys(LIVEC).length, 240, async () => { const codes = Object.values(STATUS_AIRPORTS).flat().filter(c => AP[c]);
    const rows = await Promise.all(codes.map(async c => { const ap = AP[c]; if (!ap) return null; const a = airportOut(ap); let wx = null; try { wx = await wxNow(ap); } catch {}
      try {
        if (OFFICIAL[c]) { const ymd = todayLondon(); const [d, r] = await Promise.all([officialBoard(c, "dep", ymd), officialBoard(c, "arr", ymd)]); return { airport: a, wx, cause: wxCause(wx), dep: disruptFrom(d), arr: disruptFrom(r), airlines: airlineBreak([...d, ...r]), source: "Official airport board" }; }
        if (cfg.aerodataboxKey) { const x = await adb(`/airports/iata/${c}/delays`, 1800); const s = v => { if (!v?.numTotal) return { score: null }; const canc = (v.numCancelled || 0) / v.numTotal, avg = v.medianDelay ? parseMed(v.medianDelay) : 0, l30 = Math.min(1, (v.numQualifiedDelayed || 0) / v.numTotal);
            return { n: v.numTotal, score: Math.round(50 * (0.45 * Math.min(canc / 0.2, 1) + 0.35 * Math.min(avg / 60, 1) + 0.2 * Math.min(l30 / 0.5, 1))) / 10, cancelledPct: Math.round(canc * 100), avgDelay: avg }; };
          return { airport: a, wx, cause: wxCause(wx), dep: s(x.departuresDelayInformation), arr: s(x.arrivalsDelayInformation), source: "AeroDataBox" }; }
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
// Storage is split into 3 keys so no single Upstash request gets near its 10 MB limit, and heavy logs are
// written rarely (bandwidth: free tier has 10 GB a month). core = subs/vapid/hist (on change);
// flog = flight log (hourly); live = obs events + fleet legs (every 20 min).
const KVH = () => ({ headers: { authorization: "Bearer " + KV_TOK } });
const kvRead = async k => { try { const r = await getJSON(KV_URL.replace(/\/$/, "") + "/get/" + k, KVH()); return r.result ? JSON.parse(r.result) : null; } catch { return null; } };
const KV_MAX = 8e6;
async function kvWrite(k, body) { if (body.length > KV_MAX) { console.warn(`state ${k} too big (${body.length}), skipped`); return false; }
  const r = await fetch(KV_URL.replace(/\/$/, "") + "/set/" + k, { method: "POST", ...KVH(), body }); if (!r.ok) console.warn("kv save", k, r.status); return r.ok; }
async function loadState() {
  try { if (KV_URL) { const [a, f, l] = await Promise.all([kvRead("skyline_state"), kvRead("skyline_flog"), kvRead("skyline_live")]); if (a) Object.assign(STATE, a); if (f) STATE.flog = f; if (l) { STATE.obs = l.obs; STATE.fleet = l.fleet; } }
    else Object.assign(STATE, JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch {}
  if (STATE.obs) for (const [k, v] of Object.entries(STATE.obs)) { const o = obsOf(k); o.events = (v.events || []).filter(e => Date.now() - e.t < EV_KEEP); o.lastSeen = v.lastSeen; }
  if (STATE.hist && typeof STATE.hist === "object") for (const k in STATE.hist) HIST[k] = { ...(HIST[k] || {}), ...STATE.hist[k] };
}
function trimFlog(n) { const L = STATE.flog || {}; const ks = Object.keys(L); if (ks.length > n) ks.sort((a, b) => L[a].at - L[b].at).slice(0, ks.length - n).forEach(k => delete L[k]); }
let saveT = null, saving = false; const PEND = new Set();
function saveState(which = "core") { PEND.add(which); clearTimeout(saveT); saveT = setTimeout(async () => { if (saving) return saveState(which); saving = true; const W = new Set(PEND); PEND.clear(); const want = k => W.has(k) || W.has("all");
  try { if (KV_URL) { if (want("core")) await kvWrite("skyline_state", JSON.stringify({ subs: STATE.subs, vapid: STATE.vapid, hist: HIST }));
      if (want("flog")) { let b = JSON.stringify(STATE.flog || {}); if (b.length > KV_MAX) { trimFlog(3000); b = JSON.stringify(STATE.flog); } await kvWrite("skyline_flog", b); }
      if (want("live")) await kvWrite("skyline_live", JSON.stringify({ obs: STATE.obs, fleet: STATE.fleet })); }
    else { let b = JSON.stringify(STATE); if (b.length > 2 * KV_MAX) { trimFlog(3000); b = JSON.stringify(STATE); } fs.writeFileSync(STATE_FILE, b); } }
  catch (e) { console.warn("state save failed", e.message); } finally { saving = false; } }, 1500); }
setInterval(() => saveState("flog"), 60 * 60e3); setInterval(() => saveState("core"), 30 * 60e3);
setInterval(() => { FLEET?.persist(); STATE.obs = Object.fromEntries(Object.entries(OBS).map(([k, o]) => [k, { events: o.events, lastSeen: o.lastSeen }])); saveState(KV_URL ? "live" : "all"); }, 20 * 60e3);
import webpush from "web-push";
import { startFleet } from "./fleet.js";
import { register as reg36, decode as acarsDecode } from "./v36.js";
import { liveFits, depEvidence, arrEvidence } from "./evidence.js";
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { try { FLEET?.persist(); } catch {} process.exit(0); });
let FLEET = null;
import crypto from "crypto";
// VAPID keys MUST stay stable across restarts, otherwise every iPhone subscription silently dies (DATA_DIR is /tmp on Render).
// Priority: VAPID_PUBLIC/VAPID_PRIVATE env → keys derived deterministically from a stable server-side secret → stored/generated.
function deriveVapid() { const seed = process.env.VAPID_SEED || process.env.SKYLINE_ADMIN || process.env.RENDER_SERVICE_ID; if (!seed) return null;
  const priv = crypto.createHash("sha256").update("skyline-vapid-v1:" + seed).digest(); const ec = crypto.createECDH("prime256v1"); ec.setPrivateKey(priv);
  return { publicKey: ec.getPublicKey().toString("base64url"), privateKey: priv.toString("base64url"), derived: true }; }
const VAPID_SUBJECT = /^(mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}|https:\/\/[^\s]+)$/i.test(process.env.VAPID_SUBJECT || "") ? process.env.VAPID_SUBJECT : "https://skyline-flights.onrender.com"; // Apple 403s BadJwtToken on bad/example subjects
let vapidSource = "";
const PUSHLOG = []; const plog = (...a) => { const line = new Date().toISOString() + " " + a.join(" "); console.log("[push]", line); PUSHLOG.unshift(line); PUSHLOG.length = Math.min(PUSHLOG.length, 40); };
const ready = loadState().then(() => { if (!process.env.NO_FLEET) FLEET = startFleet({ AP, STATE, snapFile: path.join(DATA_DIR, "fleet-snap.json"), adsb: p => (async () => { for (const u of ["https://api.adsb.lol/v2/" + p, "https://api.airplanes.live/v2/" + p]) { try { const j = await adq(() => getJ(u)); return (j.ac || j.aircraft || []).map(slimAc); } catch {} } throw new Error("adsb busy"); })() });
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) { STATE.vapid = { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE }; vapidSource = "env"; }
  else { const d = deriveVapid(); if (d) { if (STATE.vapid?.publicKey !== d.publicKey) STATE.subs = {}; STATE.vapid = d; vapidSource = "derived"; } }
  if (!STATE.vapid) { STATE.vapid = webpush.generateVAPIDKeys(); vapidSource = "generated (rotates on restart!)"; saveState(); } else if (!vapidSource) vapidSource = "stored";
  webpush.setVapidDetails(VAPID_SUBJECT, STATE.vapid.publicKey, STATE.vapid.privateKey); plog("vapid", vapidSource, "subject", VAPID_SUBJECT);
});
const subId = ep => crypto.createHash("sha256").update(String(ep || "")).digest("base64url").slice(0, 32);
const pushHost = ep => { try { return new URL(ep).host; } catch { return "?"; } };
async function sendPush(id, s, payload, opts = {}) {
  try { const r = await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: opts.TTL ?? 4 * 3600, urgency: opts.urgency || "high", topic: opts.topic });
    s.lastOk = Date.now(); plog("sent", pushHost(s.sub.endpoint), r.statusCode); return { ok: true, status: r.statusCode };
  } catch (e) { const status = e.statusCode || 0, body = String(e.body || e.message || e).slice(0, 300); plog("FAIL", pushHost(s.sub.endpoint), status, body);
    if (status === 404 || status === 410) { delete STATE.subs[id]; saveState(); } if (s) s.lastErr = `${status} ${body}`; return { ok: false, status, error: body }; } }
api.get("/push/key", wrap(async (q, r) => { await ready; r.json({ publicKey: STATE.vapid.publicKey, durable: !!KV_URL, vapid: vapidSource }); }));
api.get("/push/status", wrap(async (req, r) => { await ready; const ep = req.query.endpoint; const s = ep ? STATE.subs[subId(ep)] : null;
  r.json({ vapidSource, subject: VAPID_SUBJECT, publicKey: STATE.vapid.publicKey, durable: !!KV_URL, subscriptions: Object.keys(STATE.subs).length,
    byHost: Object.values(STATE.subs).reduce((a, x) => (a[pushHost(x.sub.endpoint)] = (a[pushHost(x.sub.endpoint)] || 0) + 1, a), {}),
    you: ep ? (s ? { subscribed: true, watching: s.flights.length, at: s.at, lastOk: s.lastOk || null, lastErr: s.lastErr || null } : { subscribed: false }) : undefined, log: PUSHLOG.slice(0, 15) }); }));
api.post("/push/subscribe", wrap(async (req, res) => { await ready; const { sub } = req.body || {};
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({ error: "Invalid subscription (missing endpoint or keys)" });
  const id = subId(sub.endpoint); const oid = req.body.oldEndpoint ? subId(req.body.oldEndpoint) : null; if (oid && oid !== id && STATE.subs[oid]) { STATE.subs[id] = { ...STATE.subs[oid], ...(STATE.subs[id] || {}) }; delete STATE.subs[oid]; plog("rotated", pushHost(sub.endpoint)); } const prev = STATE.subs[id]?.flights || []; const flights = Array.isArray(req.body.flights) ? req.body.flights : prev;
  STATE.subs[id] = { ...(STATE.subs[id] || {}), sub, at: Date.now(), prefs: req.body.prefs || STATE.subs[id]?.prefs || null, flights: flights.slice(0, 30).map(f => { const o = prev.find(p => p.number === f.number && p.date === f.date); return { number: String(f.number).toUpperCase(), date: f.date, snap: o?.snap || f.snap || null }; }) };
  if (!prev.length && !STATE.subs[id].lastOk) plog("subscribed", pushHost(sub.endpoint)); saveState(); res.json({ ok: true, watching: STATE.subs[id].flights.length }); }));
api.get("/push/inbox", wrap(async (req, r) => { await ready; const s = STATE.subs[subId(req.query.endpoint)]; r.json({ items: s?.inbox || [] }); }));
api.post("/push/test", wrap(async (req, res) => { await ready; const id = subId(req.body?.endpoint); const s = STATE.subs[id];
  if (!s) return res.status(404).json({ error: "Server has no subscription for this device (it may have restarted). Tap Turn on alerts again." });
  const r = await sendPush(id, s, { title: "✈ Skyline · notifications are on", body: `Watching ${s.flights.length} flight${s.flights.length === 1 ? "" : "s"}: gate, delay, boarding, take-off and landing.\nTake-off and landing are only sent when confirmed.`, tag: "skyline-test", kind: "test", url: "/", icon: "/icon-192.png", badge: "/badge-72.png" }, { TTL: 600 });
  if (r.ok) return res.json({ ok: true, status: r.status, host: pushHost(s.sub.endpoint) });
  res.status(502).json({ error: `Push service ${pushHost(s.sub.endpoint)} rejected it: ${r.status} ${r.error}${r.status === 404 || r.status === 410 ? " (subscription expired — tap Turn on alerts again)" : ""}`, status: r.status }); }));
const snapOf = (f, L) => ({ status: f.status, statusText: f.statusText, gate: f.dep?.gate || null, term: f.dep?.terminal || null, belt: f.arr?.baggage || null, dly: delayMin(f), dlyAct: !!f.dep?.actual,
  depOk: depEvidence(f, L), arrOk: arrEvidence(f, L), eta: f.arr?.actual ? null : (f.arr?.estimated || null), dep: f.dep?.takeoff || (f.dep?.actualKind === "offblock" ? null : f.dep?.actual) || null, offblk: f.dep?.actualKind === "offblock" ? f.dep.actual : null, arr: f.arr?.actual || null });
const hmL = (t, tz) => t ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || "Europe/London" }) : "";
// Messages are { kind, text }. Departed/landed only with evidence (see evidence.js); delays from estimates say "estimated".
function diff(a, b, f) { const m = []; if (!a) return m; const P = (kind, text) => m.push({ kind, text });
  if (b.status === "cancelled" && a.status !== "cancelled") P("cancel", "❌ Cancelled");
  if (b.status === "diverted" && a.status !== "diverted") P("status", "↪️ Diverted");
  if (b.gate && b.gate !== a.gate) P("gate", `🚪 Gate ${a.gate ? a.gate + " → " : ""}${b.gate}`);
  if (b.term && a.term && b.term !== a.term) P("gate", `🏢 Terminal ${a.term} → ${b.term}`);
  const est = b.dlyAct ? "" : " (estimated)";
  if (b.dly != null && (a.dly ?? 0) + 10 <= b.dly && b.dly >= 15) { P("delay", `⏱ Delayed ${b.dly} min${est}`); m[m.length - 1].dly = b.dly; }
  if (b.dly != null && a.dly != null && a.dly >= 15 && b.dly <= a.dly - 15) P("delay", `✅ Delay down to ${Math.max(0, b.dly)} min${est}`);
  if (b.belt && b.belt !== a.belt) P("belt", `🧳 Bags on belt ${b.belt}`);
  { const ph = x => { const t = (x || "").toLowerCase(); return /final call|last call/.test(t) ? "Final call" : /gate closed|closing/.test(t) ? "Gate closed" : /boarding/.test(t) ? "Boarding" : /go to gate|gate open/.test(t) ? "Gate open" : null; };
    const pa = ph(a.statusText), pb = ph(b.statusText); if (pb && pb !== pa && !b.depOk) P("board", `🚪 ${pb} (airport feed)`); }
  const hadDep = a.depOk !== undefined ? !!a.depOk : ["departed", "enroute", "landed"].includes(a.status) && !/not yet/.test(a.statusText || "");
  const hadArr = a.arrOk !== undefined ? !!a.arrOk : a.status === "landed" && !/not yet/.test(a.statusText || "");
  if (b.offblk && !a.offblk && !b.depOk && !b.arrOk && !(a.depOk)) P("status", `🚕 Left the gate ${hmL(b.offblk, f.origin?.tz)} · taxiing (not airborne yet)`);
  if (b.depOk && !hadDep && !b.arrOk) P("status", `🛫 Took off${b.dep ? " " + hmL(b.dep, f.origin?.tz) : ""}${b.depOk === "adsb" ? " · seen airborne on ADS-B" : ""}`);
  if (b.arrOk && !hadArr) P("status", `🛬 Landed${b.arr ? " " + hmL(b.arr, f.destination?.tz) : ""}${b.arrOk === "adsb" ? " · seen on the ground by ADS-B" : ""}`);
  return m; }
// Rich notification: title "✈ LS1566 · Larnaca → Stansted", body = changes + context line.
function richPush(f, msgs, k) { const c = x => x?.city || x?.iata || "?"; const tz = f.destination?.tz; const ctx = [];
  const eta = f.arr?.actual ? null : f.arr?.estimated; if (eta) ctx.push(`ETA ${hmL(eta, tz)} (est.)`);
  if (f.dep?.gate) ctx.push(`Gate ${f.dep.gate}`); if (f.dep?.terminal) ctx.push(`Terminal ${String(f.dep.terminal).replace(/^T/, "")}`);
  const kind = msgs.find(x => x.kind === "cancel") ? "cancel" : msgs[0].kind;
  return { title: `✈ ${f.number} · ${c(f.origin)} → ${c(f.destination)}`, body: msgs.map(x => x.text).join(" · ") + (ctx.length ? "\n" + ctx.join(" · ") : ""), tag: k, kind, renotify: true,
    url: "/#flight=" + encodeURIComponent(f.id || k), icon: "/icon-192.png", badge: "/badge-72.png", at: Date.now(), flight: f.number }; }
// prefs: { events: { cancel, gate, delay, belt, status }: bool, quiet: { on, from: "22:00", to: "07:00", tz } } — cancellations always break quiet hours
// v43: + delayMin threshold (only for new-delay alerts), per-flight mute list, separate "board" type, and quiet-hours digest:
// non-cancel alerts suppressed in quiet hours are held and sent as one summary push when quiet hours end.
const inQuiet = p => { if (!p?.quiet?.on || !p.quiet.from || !p.quiet.to) return false; const hm = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: p.quiet.tz || "Europe/London" });
  return p.quiet.from <= p.quiet.to ? hm >= p.quiet.from && hm < p.quiet.to : hm >= p.quiet.from || hm < p.quiet.to; };
function filterPrefs(m, p, key, s) { if (!p || !m.length) return m; const ev = p.events || {};
  if ((p.muted || []).includes(key)) return m.filter(x => x.kind === "cancel");
  let out = m.filter(x => ev[x.kind === "board" && ev.board === undefined ? "status" : x.kind] !== false).filter(x => !(x.kind === "delay" && x.dly != null && x.dly < (+p.delayMin || 15)));
  if (inQuiet(p)) { const held = out.filter(x => x.kind !== "cancel"); if (held.length && s && p.quiet.digest !== false) { (s.held ||= []).push(...held.map(x => ({ key, text: x.text, at: Date.now() }))); s.held = s.held.slice(-40); } out = out.filter(x => x.kind === "cancel"); }
  return out; }
async function flushHeld(id, s) { if (!s.held?.length || inQuiet(s.prefs)) return; const by = {}; for (const h of s.held) (by[h.key.replace(/\d{4}-\d\d-\d\d$/, "")] ||= []).push(h.text.replace(/ \(.*?\)$/, ""));
  const body = Object.entries(by).map(([k, t]) => `${k}: ${t.slice(-3).join(" · ")}`).join("\n"); s.held = [];
  const pl = { title: "🌙 While you were in quiet hours", body, tag: "quiet-digest", kind: "status", renotify: true, url: "/", icon: "/icon-192.png", badge: "/badge-72.png", at: Date.now() };
  (s.inbox ||= []).unshift(pl); s.inbox.length = Math.min(s.inbox.length, 30); await sendPush(id, s, pl, { topic: "quietdigest" }).catch(() => {}); }
async function watch() { await ready; const cache = {};
  for (const [id, s] of Object.entries(STATE.subs)) { const keep = [];
    for (const w of s.flights) { if (w.date < new Date(Date.now() - 36 * 3600e3).toISOString().slice(0, 10)) continue; keep.push(w);
      try { const k = w.number + w.date; const r = cache[k] ||= await findFlight(w.number, w.date); if (!r.flight) continue; const n = snapOf(r.flight, r.live); const msg = filterPrefs(diff(w.snap, n, r.flight), s.prefs, w.number + w.date, s); w.snap = n;
        if (msg.length) { const pl = richPush(r.flight, msg, k); (s.inbox ||= []).unshift(pl); s.inbox.length = Math.min(s.inbox.length, 30); await sendPush(id, s, pl, { topic: k.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) }); }
      } catch {} }
    if (STATE.subs[id]) { STATE.subs[id].flights = keep; await flushHeld(id, STATE.subs[id]).catch(() => {}); } }
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

api.get("/security/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(); const f = SECURITY[c];
  if (!f) return res.json({ iata: c, available: false, note: "This airport doesn't publish live security queue times that Skyline can read." });
  try { res.json({ iata: c, available: true, ...(await cached("sec:" + c, 120, f)) }); } catch (e) { res.json({ iata: c, available: false, note: "Live queue feed unavailable right now (" + e.message + ")" }); } }));

// ---------- Tools / Explore (real public sources only) ----------
const getJ = async (u, h = {}) => { const r = await fetch(u, { headers: { "user-agent": UA, ...h }, signal: AbortSignal.timeout(15000) }); if (!r.ok) { const e = new Error(`${new URL(u).host} ${r.status}`); e.status = 502; throw e; } return r.json(); };
const getT = async u => { const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${new URL(u).host} ${r.status}`); return r.text(); };
const icaoOf = c => { c = String(c || "").toUpperCase(); return c.length === 3 ? (AP[c]?.icao || c) : c; };
const OA = "https://davidmegginson.github.io/ourairports-data/";
let OAD = null, OADp = null; // runways + frequencies, loaded once on demand (~5 MB)
async function oa() { if (OAD) return OAD; if (OADp) return OADp; OADp = (async () => { const rw = {}, fq = {};
  const parse = (t, fn) => { const L = t.split("\n"); const h = csv(L[0]); for (const l of L.slice(1)) { if (!l) continue; const c = csv(l); const o = {}; h.forEach((k, i) => o[k] = c[i]); fn(o); } };
  parse(await getT(OA + "runways.csv"), o => { if (o.closed === "1") return; (rw[o.airport_ident] ||= []).push({ le: o.le_ident, he: o.he_ident, len: +o.length_ft || null, wid: +o.width_ft || null, surf: o.surface, lit: o.lighted === "1", leHdg: o.le_heading_degT ? +o.le_heading_degT : null, heHdg: o.he_heading_degT ? +o.he_heading_degT : null }); });
  parse(await getT(OA + "airport-frequencies.csv"), o => (fq[o.airport_ident] ||= []).push({ type: o.type, desc: o.description, mhz: +o.frequency_mhz }));
  OAD = { rw, fq }; return OAD; })().catch(e => { OADp = null; throw e; }); return OADp; }
// v31: real ACARS / VDL2 messages from the public Airframes.io community feed (no key). Never synthesised.
const ACARS_LBL = { H1: "Datalink (crew/ops)", "_d": "Link test / no text", Q0: "Link test", SA: "Media advisory", "5Z": "Airline ops", "80": "Position / OOOI", "15": "Position", "16": "Position", "10": "Out/Off event", "11": "On/In event", "12": "Out/Off/On/In", QA: "Out (left gate)", QB: "Off (took off)", QC: "On (landed)", QD: "In (at gate)", QE: "Out + fuel", QF: "Off + destination", QQ: "Weather request", "44": "Position + fuel", B6: "ADS-C / CPDLC", A9: "ATIS request", B9: "ATIS / D-ATIS", "4N": "Airline ops", "2Z": "Progress report", "33": "Arrival info", H2: "Weather report", "1L": "Fuel / ops", SQ: "Squitter (ground station)", "4T": "Airline ops", RA: "Uplink to printer", C1: "Crew message", "20": "Delay report", "21": "Position + ETA", "22": "Position report", AA: "Free text", BA: "CPDLC" };
api.get("/acars/:hex", wrap(async (req, res) => { const hex = String(req.params.hex || "").toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6); if (hex.length !== 6) return res.status(400).json({ error: "hex required" });
  const raw = await cached("acars:" + hex, 90, () => getJSON(`https://api.airframes.io/messages?icao=${hex}&limit=60`, { timeout: 12000 })).catch(e => ({ err: String(e.message || e) }));
  if (raw.err) return res.json({ hex, source: "airframes.io", error: raw.err, messages: [] });
  const ms = (Array.isArray(raw) ? raw : []).filter(m => (m.fromHex || "").toUpperCase() === hex || (m.toHex || "").toUpperCase() === hex || (m.airframe?.icao || "").toUpperCase() === hex).map(m => ({ t: m.timestamp, dir: (m.fromHex || "").toUpperCase() === hex ? "down" : "up", label: m.label || null, labelText: ACARS_LBL[m.label] || (m.label ? "Label " + m.label : "Link-layer frame"), text: (m.text || "").trim() || null, flight: m.flightNumber || null, tail: m.tail || m.airframe?.tail || null, kind: m.sourceType || null, freq: m.frequency || null, station: m.station?.ident || null, dep: m.departingAirport || null, dst: m.destinationAirport || null, lat: m.latitude ?? null, lon: m.longitude ?? null, alt: m.altitude ?? null, ...acarsDecode(m) }));
  res.json({ hex, source: "airframes.io", fetched: new Date().toISOString(), messages: ms });
}));
api.get("/wx/:code", wrap(async (req, res) => { const i = icaoOf(req.params.code);
  const [m, t] = await Promise.all([cached("metar:" + i, 300, () => getJ(`https://aviationweather.gov/api/data/metar?ids=${i}&format=json&hours=3`)), cached("taf:" + i, 900, () => getJ(`https://aviationweather.gov/api/data/taf?ids=${i}&format=json`)).catch(() => [])]);
  res.json({ icao: i, metar: m, taf: t, source: "aviationweather.gov (NOAA)" }); }));
api.get("/apinfo/:code", wrap(async (req, res) => { const i = icaoOf(req.params.code); const a = AP_ICAO[i]; if (!a) return res.status(404).json({ error: "unknown airport" });
  let d = null; try { d = await oa(); } catch {}
  const near = Object.values(AP_ICAO).filter(b => b.iata && b !== a).map(b => ({ iata: b.iata, icao: b.icao, name: b.name, city: b.city, km: Math.round(hav(a, b)) })).filter(b => b.km < 150).sort((x, y) => x.km - y.km).slice(0, 8);
  res.json({ ...airportOut(a), elev: a.elev, runways: d?.rw[i] || null, freqs: d?.fq[i] || null, nearby: near, source: "OpenFlights + OurAirports" }); }));
const hav = (a, b) => { const r = Math.PI / 180, R = 6371; const x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
api.get("/sigmets", wrap(async (req, res) => { const [i, u] = await Promise.all([cached("isig", 600, () => getJ("https://aviationweather.gov/api/data/isigmet?format=json")), cached("asig", 600, () => getJ("https://aviationweather.gov/api/data/airsigmet?format=json")).catch(() => [])]);
  const slim = x => ({ fir: x.firName || x.firId || x.icaoId, hazard: x.hazard, qual: x.qualifier, from: x.validTimeFrom, to: x.validTimeTo, base: x.base, top: x.top, raw: x.rawSigmet || x.rawAirSigmet, coords: x.coords });
  res.json({ intl: (i || []).map(slim), us: (u || []).map(slim), source: "aviationweather.gov" }); }));
api.get("/winds", wrap(async (req, res) => res.json({ raw: await cached("winds", 1800, () => getT("https://aviationweather.gov/api/data/windtemp?region=all&level=high&fcst=06")), source: "aviationweather.gov FB winds (US stations)" })));
const slimAc = a => ({ hex: a.hex, flight: (a.flight || "").trim(), reg: a.r, type: a.t, desc: a.desc, alt: a.alt_baro, gs: a.gs, track: a.track ?? a.true_heading ?? a.mag_heading, lat: a.lat, lon: a.lon, squawk: a.squawk, emergency: a.emergency, mil: !!(a.dbFlags & 1), vs: a.baro_rate, seen: a.seen });
let ADQ = Promise.resolve(); const adq = fn => { const p = ADQ.then(fn); ADQ = p.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100))); return p; }; // adsb.lol allows ~1 req/s
// adsb.lol, then airplanes.live, then adsb.fi (path-mapped); last good answer is kept for 10 min if all three are rate-limiting.
const ADSB_STALE = {}; const fiPath = p => p.replace(/^reg\//, "registration/").replace(/^point\/([-\d.]+)\/([-\d.]+)\/(\d+)/, "lat/$1/lon/$2/dist/$3");
const adsb = p => cached("adsb:" + p, 45, async () => { for (const u of ["https://api.adsb.lol/v2/" + p, "https://api.airplanes.live/v2/" + p, "https://opendata.adsb.fi/api/v2/" + fiPath(p)]) { try { const j = await adq(() => getJ(u)); ADSB_STALE[p] = { j, at: Date.now() }; return j; } catch {} }
  const st = ADSB_STALE[p]; if (st && Date.now() - st.at < 600e3) return st.j; throw new Error("Live ADS-B sources are busy (rate-limited). Try again in a minute."); }).then(j => (j.ac || j.aircraft || []).map(slimAc));
api.get("/squawks", wrap(async (req, res) => { const out = []; for (const s of ["7500", "7600", "7700"]) out.push(...(await adsb("sqk/" + s)).map(a => ({ ...a, code: s }))); res.json({ list: out, at: Date.now(), source: "adsb.lol" }); }));
api.get("/mil", wrap(async (req, res) => res.json({ list: (await adsb("mil")).filter(a => a.lat).slice(0, 300), source: "adsb.lol" })));
api.get("/overhead", wrap(async (req, res) => { const lat = +req.query.lat, lon = +req.query.lon, r = Math.min(250, +req.query.r || 25); if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: "lat/lon required" });
  const l = (await adsb(`point/${lat.toFixed(3)}/${lon.toFixed(3)}/${r}`)).filter(a => a.lat).map(a => ({ ...a, nm: Math.round(hav({ lat, lon }, a) / 1.852 * 10) / 10 })).sort((a, b) => a.nm - b.nm); res.json({ list: l, source: "adsb.lol" }); }));
// v43 airport live map: aircraft within 40 nm classed as ground / approach / departure / holding / overflight.
// Holding = Skyline estimate from the turn pattern Skyline itself observed (track turned >=300° in <=12 min at steady altitude); needs a few polls.
const TRK = {};
api.get("/airport/:iata/traffic", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(), ap = AP[c]; if (!ap?.lat) return res.status(404).json({ error: "Unknown airport" });
  res.json(await cached(`aptraf:${c}`, 20, async () => { const l = (await adsb(`point/${ap.lat.toFixed(3)}/${ap.lon.toFixed(3)}/40`)).filter(a => a.lat && a.type !== "TWR" && a.reg !== "TWR"); const now = Date.now(); const T = TRK[c] ||= {};
    for (const k in T) if (now - T[k].at > 15 * 60e3) delete T[k];
    const list = l.map(a => { const nm = Math.round(hav(ap, a) / 1.852 * 10) / 10, alt = a.alt === "ground" ? 0 : +a.alt || null; const h = T[a.hex] ||= { s: [], at: now }; h.at = now;
      if (a.track != null && alt != null) { h.s.push({ t: now, tr: a.track, alt }); h.s = h.s.filter(x => now - x.t < 12 * 60e3).slice(-40); }
      let turn = 0; for (let i = 1; i < h.s.length; i++) { const d = ((h.s[i].tr - h.s[i - 1].tr + 540) % 360) - 180; turn += d; }
      const alts = h.s.map(x => x.alt), steady = alts.length >= 3 && Math.max(...alts) - Math.min(...alts) < 2500;
      const cls = a.alt === "ground" || (alt != null && alt < 300 && (a.gs || 0) < 80) || (alt != null && nm < 3 && alt < 400) ? "ground" : Math.abs(turn) >= 300 && steady && alt > 3000 ? "holding" : nm < 30 && alt != null && alt < 12000 && (a.vs || 0) < -300 ? "approach" : nm < 30 && alt != null && alt < 15000 && (a.vs || 0) > 300 ? "departure" : "overflight";
      const brg = Math.atan2(Math.sin((a.lon - ap.lon) * Math.PI / 180) * Math.cos(a.lat * Math.PI / 180), Math.cos(ap.lat * Math.PI / 180) * Math.sin(a.lat * Math.PI / 180) - Math.sin(ap.lat * Math.PI / 180) * Math.cos(a.lat * Math.PI / 180) * Math.cos((a.lon - ap.lon) * Math.PI / 180)) * 180 / Math.PI;
      return { hex: a.hex, cs: (a.flight || "").trim(), reg: a.reg, type: a.type, alt: a.alt, gs: a.gs, vs: a.vs, track: a.track, lat: a.lat, lon: a.lon, nm, brg: Math.round((brg + 360) % 360), cls, turn: Math.round(Math.abs(turn)) }; }).sort((a, b) => a.nm - b.nm);
    return { iata: c, at: now, center: { lat: ap.lat, lon: ap.lon }, list, source: "ADS-B: adsb.lol / airplanes.live / adsb.fi", holdNote: "Holding is a Skyline estimate from the turn pattern seen over the last 12 min" }; })); }));
api.get("/aircraft/:q", wrap(async (req, res) => { const q = req.params.q.toUpperCase().replace(/[^A-Z0-9-]/g, ""); const isHex = /^[0-9A-F]{6}$/.test(q);
  const db = await cached("adsbdb:" + q, 86400, () => getJ("https://api.adsbdb.com/v0/aircraft/" + q).then(j => j.response?.aircraft || null).catch(() => null));
  const live = await adsb((isHex ? "hex/" : "reg/") + q).catch(() => []);
  res.json({ q, info: db, live: live[0] || null, source: "adsbdb.com + adsb.lol" }); }));
api.get("/callsign/:cs", wrap(async (req, res) => { const c = req.params.cs.toUpperCase().replace(/[^A-Z0-9]/g, "");
  res.json({ route: await cached("cs:" + c, 3600, () => getJ("https://api.adsbdb.com/v0/callsign/" + c).then(j => j.response?.flightroute || null).catch(() => null)), source: "adsbdb.com" }); }));
api.get("/airlines/search", (req, res) => { const q = String(req.query.q || "").toLowerCase().trim(); if (!q) return res.json([]);
  res.json(Object.values(AL_ICAO).filter(a => (a.iata || "").toLowerCase() === q || (a.icao || "").toLowerCase() === q || (a.callsign || "").toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q)).slice(0, 30)); });
api.get("/fx", wrap(async (req, res) => { const b = String(req.query.base || "GBP").toUpperCase().replace(/[^A-Z]/g, ""); res.json({ ...(await cached("fx:" + b, 3600, () => getJ("https://api.frankfurter.dev/v1/latest?base=" + b))), source: "Frankfurter (ECB reference rates)" }); }));

// ---------- v19: natural-language search (rules, no LLM), observed on-time stats, airport guide ----------
const NL_COUNTRY_ALIAS = { uk: "United Kingdom", britain: "United Kingdom", england: "United Kingdom", usa: "United States", us: "United States", america: "United States", holland: "Netherlands", czechia: "Czech Republic", turkiye: "Turkey", "canary islands": "Spain", canaries: "Spain", tenerife: "Spain", mallorca: "Spain", majorca: "Spain", ibiza: "Spain" };
const NL_COUNTRIES = () => (NL_COUNTRIES.c ||= [...new Set(Object.values(AP).map(a => a.country).filter(Boolean))]);
function nlFind(word) { const w = word.trim().toLowerCase(); if (!w) return null;
  if (/^[a-z]{3}$/.test(w) && AP[w.toUpperCase()]) return { kind: "airport", iata: w.toUpperCase(), label: AP[w.toUpperCase()].city || AP[w.toUpperCase()].name };
  const alias = NL_COUNTRY_ALIAS[w]; const cn = alias || NL_COUNTRIES().find(c => c.toLowerCase() === w); if (cn && !["tenerife", "mallorca", "majorca", "ibiza"].includes(w)) return { kind: "country", country: cn, label: cn };
  const cities = Object.values(AP).filter(a => a.iata && (a.city || "").toLowerCase() === w); if (cities.length) { const big = cities.sort((a, b) => (OFFICIAL[b.iata] ? 1 : 0) - (OFFICIAL[a.iata] ? 1 : 0))[0]; return { kind: "city", city: big.city, iatas: cities.map(a => a.iata), iata: big.iata, label: big.city }; }
  if (alias) return { kind: "country", country: alias, label: alias };
  const nm = Object.values(AP).find(a => a.iata && (a.name || "").toLowerCase().includes(w) && w.length > 4); if (nm) return { kind: "airport", iata: nm.iata, label: nm.name };
  return null; }
function nlParse(q) { const s = " " + String(q).toLowerCase().replace(/[^a-z0-9: ]/g, " ").replace(/\s+/g, " ") + " "; const out = { q, dir: "dep", day: 0, from: null, to: null, win: null, airline: null, notes: [] };
  if (/ tomorrow /.test(s)) out.day = 1; if (/ yesterday /.test(s)) out.day = -1;
  const W = { "early morning": [4, 8], morning: [5, 12], afternoon: [12, 17], evening: [17, 22], night: [20, 24], tonight: [17, 24] }; for (const k in W) if (s.includes(" " + k + " ")) { out.win = W[k]; out.winLabel = k; break; }
  const am = s.match(/ (?:after|from) (\d{1,2})(?::(\d\d))? ?(am|pm)? /); if (am && !out.win) { let h = +am[1] + (am[3] === "pm" && +am[1] < 12 ? 12 : 0); out.win = [h, 24]; out.winLabel = "after " + h + ":00"; }
  const bm = s.match(/ before (\d{1,2})(?::(\d\d))? ?(am|pm)? /); if (bm) { let h = +bm[1] + (bm[3] === "pm" && +bm[1] < 12 ? 12 : 0); out.win = [out.win?.[0] ?? 0, h]; out.winLabel = (out.winLabel ? out.winLabel + ", " : "") + "before " + h + ":00"; }
  if (/ (arrivals?|arriving|landing) /.test(s)) out.dir = "arr";
  const tok = (re) => { const m = s.match(re); return m ? m[1].trim() : null; };
  const stop = "(?= tomorrow | today | yesterday | this | morning | afternoon | evening | night | tonight | after | before | on | with | by | from | to | into | $)";
  let fr = tok(new RegExp(" from ([a-z ]+?)" + stop)), to = tok(new RegExp(" (?:to|into) ([a-z ]+?)" + stop));
  if (!fr && !to) { const m = s.match(/^ ([a-z]{3}) ([a-z]{3}) /); if (m) { fr = m[1]; to = m[2]; } }
  if (fr) out.from = nlFind(fr) || (out.notes.push(`Didn't recognise "${fr}"`), null); if (to) out.to = nlFind(to) || (out.notes.push(`Didn't recognise "${to}"`), null);
  const al = Object.values(AL).find(a => a.active && a.name && a.name.length > 3 && s.includes(" " + a.name.toLowerCase() + " ")); if (al) out.airline = { iata: al.iata, name: al.name };
  return out; }
api.get("/nlsearch", wrap(async (req, res) => { const p = nlParse(String(req.query.q || "").slice(0, 200));
  // need a board to read from: origin airport for departures, destination airport for arrivals
  let base = p.dir === "dep" ? p.from : p.to, other = p.dir === "dep" ? p.to : p.from;
  if ((!base || base.kind === "country") && other && other.kind !== "country") { p.dir = p.dir === "dep" ? "arr" : "dep"; [base, other] = [other, base]; p.notes.push("Read from the " + (p.dir === "arr" ? "arrivals" : "departures") + " board at " + base.label); }
  if (!base || base.kind === "country") return res.json({ parsed: p, flights: [], note: "Name a departure airport or city, e.g. \"flights from MAN to Spain tomorrow morning\"." });
  const iata = base.iata, a = AP[iata]; const d = new Date(Date.now() + p.day * 86400e3).toLocaleDateString("en-CA", { timeZone: a?.tz || "Europe/London" });
  let b; try { b = await board(iata, p.dir, d); } catch (e) { return res.json({ parsed: p, flights: [], board: iata, note: "The " + iata + " board is unavailable right now (" + String(e.message || e).slice(0, 80) + ")." }); }
  const hour = iso => iso ? +new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: a?.tz || "Europe/London" }) : null;
  let L = b.flights.filter(f => (p.dir === "dep" ? f.dep.scheduled : f.arr.scheduled || "").slice(0, 10) === d || true);
  L = L.filter(f => { const t = p.dir === "dep" ? f.dep.scheduled : f.arr.scheduled; if (t && new Date(t).toLocaleDateString("en-CA", { timeZone: a?.tz || "Europe/London" }) !== d) return false;
    const o = p.dir === "dep" ? f.destination : f.origin; const oa = AP[o?.iata] || o || {};
    if (other) { if (other.kind === "country" && oa.country !== other.country) return false; if (other.kind === "airport" && o?.iata !== other.iata) return false; if (other.kind === "city" && !other.iatas.includes(o?.iata) && (oa.city || "") !== other.city) return false; }
    if (p.win) { const h = hour(t); if (h == null || h < p.win[0] || h >= p.win[1]) return false; }
    if (p.airline && f.airline?.iata !== p.airline.iata) return false; return true; });
  res.json({ parsed: p, board: iata, date: d, flights: L.slice(0, 60), total: L.length, source: b.source || null, note: "Parsed with Skyline's own rules (no AI service); results are real flights from the " + iata + " board." }); }));

// Observed on-time stats: only from flights Skyline itself logged (history.json, 60 days, MAG airports). Hidden below MIN_N.
const MIN_N = 20;
api.get("/ontime", (req, res) => { const al = String(req.query.airline || "").toUpperCase().slice(0, 3), o = String(req.query.o || "").toUpperCase().slice(0, 3), t = String(req.query.t || "").toUpperCase().slice(0, 3), num = String(req.query.number || "").toUpperCase().replace(/\s/g, "");
  const sum = a => { const n = a.length; if (n < MIN_N) return { n, enough: false }; const late = a.filter(d => d >= 15).length; const s = [...a].sort((x, y) => x - y);
    return { n, enough: true, onTime: Math.round((n - late) / n * 100), median: s[Math.floor(n / 2)], p90: s[Math.floor(n * 0.9)] }; };
  const fl = [], route = [], airline = [];
  for (const k in HIST) for (const x of Object.values(HIST[k])) { if (x.d == null || x.s === "cancelled") continue;
    if (num && k === num) fl.push(x.d); if (o && t && x.o === o && x.t === t) route.push(x.d); if (al && k.startsWith(al)) airline.push(x.d); }
  res.json({ minN: MIN_N, flight: num ? sum(fl) : null, route: o && t ? sum(route) : null, airline: al ? sum(airline) : null, scope: "Flights Skyline observed on Manchester, Stansted and East Midlands boards over the last 60 days. On time = under 15 min late.", source: "Skyline observed log" }); });

// Airport guide: OSM facilities (Overpass), live security where Skyline has a feed, official map links
api.get("/guide/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(); const a = AP[c]; if (!a) return res.status(404).json({ error: "unknown airport" });
  let fac = null, facErr = null;
  const OS = (globalThis.__OSMF ||= {}); const ent = OS[c];
  if (ent?.data && Date.now() - ent.at < 86400e3) fac = ent.data; else if (ent?.loading) facErr = "loading"; else if (ent?.err && Date.now() - ent.at < 300e3) facErr = ent.err; else { OS[c] = { loading: true, at: Date.now() }; facErr = "loading";
  (async () => {
    const qq = `[out:json][timeout:55];(nwr(around:2000,${a.lat},${a.lon})[amenity];nwr(around:2000,${a.lat},${a.lon})[shop];nwr(around:2500,${a.lat},${a.lon})[aeroway~"^(gate|terminal)$"];);out tags 900;`;
    let r = null, last; for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) { try { const x = await fetch(host, { method: "POST", body: "data=" + encodeURIComponent(qq), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA }, signal: AbortSignal.timeout(70000) }); if (!x.ok) throw new Error(new URL(host).host + " " + x.status); r = await x.json(); break; } catch (e) { last = e; } }
    if (!r) throw last; const KEEP = /^(restaurant|cafe|fast_food|bar|pub|pharmacy|atm|bureau_de_change|toilets|drinking_water|charging_station|lounge|baby_changing|prayer_room|place_of_worship|left_luggage|luggage_locker|car_rental|taxi|bus_station|parking)$/; const cnt = {}, named = {}; let gates = 0, terms = [];
    for (const e of r.elements || []) { const tg = e.tags || {}; if (tg.aeroway === "gate") { gates++; continue; } if (tg.aeroway === "terminal") { if (tg.name) terms.push(tg.name); continue; }
      const k = tg.shop ? "shop" : KEEP.test(tg.amenity || "") ? tg.amenity : null; if (!k) continue; cnt[k] = (cnt[k] || 0) + 1; if (tg.name) (named[k] ||= new Set()).add(tg.name); }
    return { counts: cnt, examples: Object.fromEntries(Object.entries(named).map(([k, v]) => [k, [...v].slice(0, 8)])), gates, terminals: [...new Set(terms)].slice(0, 8), radiusM: 2000 }; })()
    .then(d => OS[c] = { data: d, at: Date.now() }).catch(e => OS[c] = { err: String(e.message || e).slice(0, 120), at: Date.now() }); }
  let sec = null; if (SECURITY[c]) { try { sec = await cached("sec:" + c, 120, SECURITY[c]); } catch {} }
  res.json({ airport: airportOut(a), facilities: fac, facilitiesError: facErr, security: sec, securityAvailable: !!SECURITY[c], maps: { osm: `https://www.openstreetmap.org/#map=16/${a.lat}/${a.lon}`, google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name + " airport terminal map")}`, official: OFFICIAL[c]?.site || null },
    source: "OpenStreetMap (Overpass) — community data, may be incomplete" }); }));


// ---------- Aircraft resolver: registration from every real source we have, never invented ----------
const acNum = n => (String(n || "").match(/^([A-Z0-9]{2})(\d+)([A-Z]?)$/) || []);
const icaoCs = f => { const [, al, d, sx] = acNum((f.number || "").replace(/\s/g, "")); const ic = AL[al]?.icao; return ic && d ? ic + String(+d) + (sx || "") : null; };
async function areaAc(iata) { const a = AP[iata]; if (!a) return []; try { return await adsb(`point/${a.lat.toFixed(3)}/${a.lon.toFixed(3)}/40`); } catch { return []; } }
// In-flight search: look around where the flight should be now for the airline's transponders, then confirm each
// candidate's route with adsbdb (callsigns like EXS15PD / EZY45TC / RYR5YP don't contain the flight number).
async function findInFlight(f) { const o = AP[f.origin?.iata], d = AP[f.destination?.iata]; const al = acNum((f.number || "").replace(/\s/g, ""))[1]; const ic = f.airline?.icao || AL[al]?.icao || (/^[A-Z]{3}$/.test(String(f.number).slice(0, 3)) ? String(f.number).slice(0, 3) : null);
  const t0 = Date.parse(f.dep?.actual || (/departed|enroute/.test(f.status || "") ? f.dep?.estimated || f.dep?.scheduled : "") || ""); if (!o || !d || !ic || !t0) return null;
  const R = 6371, r = Math.PI / 180; const km = 2 * R * Math.asin(Math.sqrt(Math.sin((d.lat - o.lat) * r / 2) ** 2 + Math.cos(o.lat * r) * Math.cos(d.lat * r) * Math.sin((d.lon - o.lon) * r / 2) ** 2));
  const durMs = (km / 780 + 0.4) * 3600e3; const fr = (Date.now() - t0) / durMs; if (fr < 0 || fr > 1.4) return null; const k = Math.min(1, Math.max(0, fr));
  const lat = o.lat + (d.lat - o.lat) * k, lon = o.lon + (d.lon - o.lon) * k;
  return cached(`inflt:${f.number}:${f.date}`, 60, async () => { const near = await adsb(`point/${lat.toFixed(2)}/${lon.toFixed(2)}/250`).catch(() => []);
    const C = (near || []).filter(x => (x.flight || "").trim().toUpperCase().startsWith(ic)).slice(0, 25);
    const exact = C.find(x => (x.flight || "").trim().toUpperCase() === ic + String(+acNum(f.number)[2])); const order = exact ? [exact, ...C.filter(x => x !== exact)] : C;
    for (const x of order) { const rt = await routeCs((x.flight || "").trim()); const oi = rt?.origin?.iata_code, di = rt?.destination?.iata_code;
      if (oi === f.origin.iata && di === f.destination.iata) return { reg: (x.reg || x.r) || null, type: (x.type || x.t) || null, hex: x.hex, callsign: (x.flight || "").trim(), lat: x.lat, lon: x.lon, alt: (x.alt ?? x.alt_baro), gs: x.gs, track: x.track, onGround: (x.alt ?? x.alt_baro) === "ground" }; }
    // adsbdb often doesn't know alphanumeric callsigns: fall back to geometry. Candidate must sit on the route corridor, head for the
    // destination and be about as far along as the elapsed time implies. Accept only if exactly one of the airline's aircraft fits.
    const brg = (a, b) => { const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r), x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r); return (Math.atan2(y, x) / r + 360) % 360; };
    const hav = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2));
    const fit = C.filter(x => { if (x.lat == null || typeof (x.alt ?? x.alt_baro) !== "number" || (x.alt ?? x.alt_baro) < 5000) return false; const p = { lat: x.lat, lon: x.lon }; const dO = hav(o, p), dD = hav(p, d);
      if (dO + dD > km * 1.08) return false; const dt = Math.abs(((brg(p, d) - (x.track ?? -999)) + 540) % 360 - 180); if (dt > 25) return false; const prog = dO / km; return Math.abs(prog - Math.min(1, fr)) < 0.3; });
    if (fit.length === 1) { const x = fit[0]; return { reg: (x.reg || x.r) || null, type: (x.type || x.t) || null, hex: x.hex, callsign: (x.flight || "").trim(), lat: x.lat, lon: x.lon, alt: (x.alt ?? x.alt_baro), gs: x.gs, track: x.track, onGround: false, geom: true }; }
    return null; }); }
async function resolveAircraft(f, ctx) {
  const out = { reg: f.aircraft?.reg || null, type: f.aircraft?.model || f.aircraft?.type || null, how: f.aircraft?.reg ? "board" : null, confidence: f.aircraft?.reg ? "airline" : null, inbound: null };
  const alF = acNum((f.number || "").replace(/\s/g, ""))[1]; const bn = ctx.byNum?.[(f.number || "").replace(/\s/g, "")] || ctx.byRoute?.[`${alF}:${f.origin?.iata}:${f.destination?.iata}`]?.[0]; if (bn && !out.reg) Object.assign(out, { reg: bn.reg, type: out.type || bn.type, how: "adsb-callsign", confidence: "transponder", live: bn.live || null });
  if (!out.reg && (f.dep?.actual || /departed|enroute/.test(f.status || ""))) { const L = await findInFlight(f).catch(() => null); if (L) Object.assign(out, { reg: L.reg, type: out.type || L.type, how: L.geom ? "adsb-geometry" : "adsb-route", confidence: L.geom ? "likely" : "transponder", live: { lat: L.lat, lon: L.lon, alt: L.alt, gs: L.gs, hex: L.hex, callsign: L.callsign, onGround: L.onGround } }); }
  const css = [...new Set([f.callsign, icaoCs(f)].filter(Boolean).map(x => x.replace(/\s/g, "").toUpperCase()))];
  const near = ctx.near || []; const hit = near.find(x => css.includes((x.flight || "").trim().toUpperCase()));
  if (hit && !out.reg && (hit.reg || hit.r)) Object.assign(out, { reg: (hit.reg || (hit.reg || hit.r)), type: out.type || (hit.type || hit.t), how: "adsb-callsign", confidence: "transponder", live: { lat: hit.lat, lon: hit.lon, alt: (hit.alt ?? hit.alt_baro), gs: hit.gs, hex: hit.hex } });
  // rotation: the same airline's arrival into this airport 25 min–4 h before departure with the paired flight number
  const [, al, d] = acNum((f.number || "").replace(/\s/g, "")); const dep = +new Date(f.dep?.estimated || f.dep?.scheduled || 0);
  if (al && d && dep && ctx.arr?.length) {
    const n = +d; const pair = new Set([n - 1, n + 1].map(String));
    const cands = ctx.arr.filter(a => { const [, al2, d2] = acNum((a.number || "").replace(/\s/g, "")); if (al2 !== al || !pair.has(String(+d2))) return false; const t = +new Date(a.arr?.actual || a.arr?.estimated || a.arr?.scheduled || 0); return t && t < dep - 25 * 60e3 && t > dep - 4 * 3600e3 && a.origin?.iata === f.destination?.iata; });
    const inb = cands[0];
    if (inb) { let ir = inb.aircraft?.reg || null, live = null; const ics = [inb.callsign, icaoCs(inb)].filter(Boolean);
      const b = ctx.byNum?.[(inb.number || "").replace(/\s/g, "")] || ctx.byRoute?.[`${al}:${inb.origin?.iata}:${f.origin?.iata}`]?.[0]; if (!ir && b) { ir = b.reg; live = b.live ? { ...b.live, type: b.type } : { type: b.type }; }
      if (!ir) for (const c of ics) { const l = await liveByCallsign(c.replace(/\s/g, "")).catch(() => null); if (l) { ir = l.reg || null; live = l; break; } }
      out.inbound = { number: inb.number, from: inb.origin?.iata, status: inb.status, statusText: inb.statusText, arr: inb.arr, reg: ir, live: live && { lat: live.lat, lon: live.lon, alt: live.alt, gs: live.gs } };
      if (!out.reg && ir) Object.assign(out, { reg: ir, type: out.type || live?.type || inb.aircraft?.model || null, how: "rotation", confidence: "likely" }); }
  }
  if (!out.type && ctx.typical) out.typicalType = ctx.typical[(al || "") + ":" + (f.destination?.iata || "")] || ctx.typical[al || ""] || null;
  return out;
}
function typicalTypes(rows) { const c = {}; for (const r of rows) { const al = acNum((r.number || "").replace(/\s/g, ""))[1]; const t = r.aircraft?.model || r.aircraft?.type; if (!al || !t) continue; for (const k of [al + ":" + (r.destination?.iata || r.origin?.iata || ""), al]) { c[k] = c[k] || {}; c[k][t] = (c[k][t] || 0) + 1; } }
  const o = {}; for (const k in c) { const [t, n] = Object.entries(c[k]).sort((a, b) => b[1] - a[1])[0]; o[k] = { type: t, n }; } return o; }
async function acContext(iata, ymd) { return cached(`acctx:${iata}:${ymd}`, 60, async () => { const [dep, arr, near] = await Promise.all([board(iata, "dep", ymd).catch(() => ({ flights: [] })), board(iata, "arr", ymd).catch(() => ({ flights: [] })), areaAc(iata)]);
  const D = (dep.flights || []).filter(f => !f.liveOnly), A = (arr.flights || []).filter(f => !f.liveOnly);
  // transponder callsign -> IATA flight number via adsbdb for everything seen at/near this airport (landed, parked, taxiing, airborne nearby)
  const byNum = {}, byRoute = {}; const o = obsOf(iata); const seen = [...(o.events || []).map(e => ({ cs: e.cs, reg: e.reg, type: e.type, t: e.t, kind: e.kind })), ...Object.values(o.ac || {}).map(p => ({ cs: p.cs, reg: p.reg, type: p.type })), ...near.map(x => ({ cs: (x.flight || "").trim(), reg: x.reg || x.r, type: x.type || x.t, live: { lat: x.lat, lon: x.lon, alt: x.alt ?? x.alt_baro, gs: x.gs } }))].filter(x => x.cs && x.reg);
  for (const x of seen.slice(0, 120)) { const rt = await routeCs(x.cs).catch(() => null); const n = rt?.callsign_iata; if (n && !byNum[n]) byNum[n] = x;
    const al = rt?.airline?.iata, og = rt?.origin?.iata_code, ds = rt?.destination?.iata_code; if (al && og && ds) { const k = `${al}:${og}:${ds}`; (byRoute[k] = byRoute[k] || []).push(x); } }
  for (const k in byRoute) if (new Set(byRoute[k].map(x => x.reg)).size > 1) delete byRoute[k]; // ambiguous — two aircraft on the same airline+route, don't guess
  return { dep: D, arr: A, near, byNum, byRoute, typical: typicalTypes([...D, ...A]) }; }); }
api.get("/aircraft-for", async (req, res) => { try { const { number, o } = req.query; const ymd = req.query.date || todayLondon(); const ctx = await acContext(String(o).toUpperCase(), ymd);
  const f = ctx.dep.find(x => (x.number || "").replace(/\s/g, "") === String(number).toUpperCase()) || { number: String(number).toUpperCase(), origin: AP[o], dep: { scheduled: req.query.dep }, destination: { iata: req.query.d } };
  const gone = !!(f.dep?.actual || /departed|enroute|landed/.test(f.status || ""));
  let ra = await resolveAircraft(f, ctx); if (!ra.reg) { const rp = await resolvePlane({ number, o: String(o).toUpperCase(), d: f.destination?.iata || req.query.d, date: ymd, status: f.status, dep: f.dep?.actual || f.dep?.estimated || f.dep?.scheduled, depActual: f.dep?.actual }).catch(() => null);
    if (rp?.reg || rp?.hex) ra = { ...ra, reg: rp.reg, type: ra.type || rp.type, how: rp.how, confidence: rp.confidence, live: rp.live ? { ...rp.live } : ra.live, reason: rp.reason, inbound: ra.inbound || inbOut(rp.inbound) }; else if (rp) ra = { ...ra, reason: rp.reason, candidates: rp.candidates, inbound: ra.inbound || inbOut(rp.inbound) }; }
  res.json({ number, departed: gone, ...ra, hint: gone ? "This flight has departed, but its transponder isn't matched right now — either it's outside volunteer ADS-B coverage (e.g. over sea) or it has already landed. Skyline keeps checking." : "Airlines usually assign the aircraft 2–3 hours before departure; Skyline keeps checking." }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.get("/acresolve/:iata", async (req, res) => { try { const iata = req.params.iata.toUpperCase(); const ctx = await acContext(iata, todayLondon()); const now = Date.now(), H = (+req.query.h || 6) * 3600e3;
  const L = ctx.dep.filter(f => { const t = +new Date(f.dep?.estimated || f.dep?.scheduled || 0); return t > now - 15 * 60e3 && t < now + H && f.status !== "cancelled"; });
  const R = []; for (const f of L) R.push({ number: f.number, to: f.destination?.iata, before: f.aircraft?.reg || null, ...(await resolveAircraft(f, ctx)) });
  const by = {}; R.forEach(r => r.how && (by[r.how] = (by[r.how] || 0) + 1));
  res.json({ iata, near: ctx.near.length, mapped: Object.keys(ctx.byNum).length, sample: Object.keys(ctx.byNum).slice(0, 12), flights: R.length, regBefore: R.filter(r => r.before).length, regAfter: R.filter(r => r.reg).length, typeKnown: R.filter(r => r.type || r.typicalType).length, by, rows: req.query.rows ? R : undefined }); } catch (e) { res.status(500).json({ error: e.message }); } });

// ---------- v27 plane resolver: Confirmed (feed / own transponder) → Likely (route-matched transponder, inbound rotation, plane on the ground) → Typical. ----------
const CACHE_HAS = k => { const h = C.get(k); return !!(h && h.exp > Date.now()); };
const ALT_ICAO = { U2: ["EZY", "EJU", "EZS"], EC: ["EJU"], DS: ["EZS"], FR: ["RYR", "RUK", "MAY", "LDM"], RK: ["RUK"], W6: ["WZZ", "WUK", "WMT", "WAZ"], W4: ["WMT"], BA: ["BAW", "EFW", "CFE"], LS: ["EXS"], BY: ["TOM"], X3: ["TUI"], TB: ["JAF"], OR: ["TFL"], A3: ["AEE"], OA: ["OAL"], LH: ["DLH", "CLH"], EN: ["DLA"], EW: ["EWG", "EWL"], EK: ["UAE"], VY: ["VLG"], IB: ["IBE", "IBS"], I2: ["IBS"], AF: ["AFR"], KL: ["KLM"], HV: ["TRA"], TO: ["TVF"], LX: ["SWR"], OS: ["AUA"], SK: ["SAS"], DY: ["NOZ", "NSZ"], D8: ["IBK"], EI: ["EIN"], TK: ["THY"], PC: ["PGT"], QR: ["QTR"], TP: ["TAP"], AZ: ["ITY"], LO: ["LOT"], MT: ["TCX"], BT: ["BTI"], VS: ["VIR"], AA: ["AAL"], UA: ["UAL"], DL: ["DAL"], EY: ["ETD"], CY: ["CYP"], GQ: ["SEH"], JU: ["ASL"], FB: ["LZB"], RO: ["ROT"], "0B": ["BMS"], XQ: ["SXS"], LG: ["LGL"], SN: ["BEL"], EZ: ["EZY"], BE: ["BEE"], T3: ["EZE"], LM: ["LOG"], "2L": ["OAW"], GR: ["AUR"], NT: ["IBB"], UX: ["AEA"], V7: ["VOE"], HG: ["NLY"] };
const normNum = s => { let x = String(s || "").toUpperCase().replace(/\s/g, ""); const i3 = x.match(/^([A-Z]{3})(\d+[A-Z]?)$/); if (i3) { const a = AL_ICAO[i3[1]]; if (a?.iata && a.iata !== "-") x = a.iata + i3[2]; else return x; } const m = x.match(/^([A-Z0-9]{2})0*(\d+)([A-Z]?)$/); return m ? m[1] + m[2] + m[3] : x; };
const prefixesOf = num => { const raw = String(num || "").toUpperCase().replace(/\s/g, ""); if (/^[A-Z]{3}\d/.test(raw) && !AL_ICAO[raw.slice(0, 3)]?.iata) return [raw.slice(0, 3)]; const [, al] = acNum(normNum(num)); const p = new Set([...(ALT_ICAO[al] || []), AL[al]?.icao].filter(Boolean)); return [...p]; };
const hkm = (a, b) => { const R = 6371, r = Math.PI / 180; return 2 * R * Math.asin(Math.sqrt(Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2)); };
// adsbdb route lookups for the airline's airborne/parked aircraft, limited per call (cached 24 h per callsign)
const hdgOk = (x, B) => { if (x.track == null) return false; const r = Math.PI / 180; const y = Math.sin((B.lon - x.lon) * r) * Math.cos(B.lat * r), z = Math.cos(x.lat * r) * Math.sin(B.lat * r) - Math.sin(x.lat * r) * Math.cos(B.lat * r) * Math.cos((B.lon - x.lon) * r); const b = (Math.atan2(y, z) / r + 360) % 360; return Math.abs(((b - x.track) + 540) % 360 - 180) < 30; };
async function airlineFleetRoutes(prefixes, limit = 60) { const L = (FLEET?.airlineNow(prefixes) || []); const out = []; let n = 0;
  for (const x of L) { if (n >= limit) break; const k = "adsbdb:" + x.cs; if (!CACHE_HAS(k)) n++; const rt = await routeCs(x.cs).catch(() => null); out.push({ ...x, num: rt?.callsign_iata ? normNum(rt.callsign_iata) : null, ro: rt?.origin?.iata_code || null, rd: rt?.destination?.iata_code || null }); } return out; }
const inbOut = i => i ? { number: i.number, from: i.from, status: i.status, reg: i.reg, arr: { scheduled: i.arr }, live: i.live && i.live.alt !== "ground" ? { lat: i.live.lat, lon: i.live.lon, alt: i.live.alt, gs: i.live.gs } : null, depStatus: i.depStatus, depSched: i.depSched } : null;
async function resolvePlane(q, depth = 0) {
  const number = normNum(q.number); const o = q.o, d = q.d; const status = q.status || ""; const depT = +new Date(q.dep || 0) || 0, arrT = +new Date(q.arr || 0) || 0;
  const pre = prefixesOf(number); const [, al, dg, sx] = acNum(number); const steps = [];
  const out = (o2) => ({ number, steps, ...o2 });
  const air = /departed|enroute|airborne|active/.test(status) || (!!q.depActual);
  // Consistency check for a live match (callsigns are reused on later legs/days): a flight that already landed can only be an
  // aircraft now on the ground at (or within 25 km of) its destination; a flight not yet departed can't be one airborne far from its origin.
  const landed = /landed|arrived/.test(status) || !!q.arrActual;
  const fits = (l) => { if (!l || l.lat == null) return true; const gnd = l.onGround || l.gnd || l.alt === "ground" || (typeof l.alt === "number" && l.alt < 300);
    if (landed) return gnd && !!AP[d] && hkm(AP[d], l) < 25; if (!air && depT && depT - Date.now() > 20 * 60e3) return gnd ? !AP[o] || hkm(AP[o], l) < 25 : true; return true; };
  const otherNum = (x) => x.num && x.num !== number; // its callsign is registered to a different flight
  // 1) feed registration
  if (q.reg) return out({ reg: q.reg, confidence: "confirmed", how: "board", reason: "The airport/airline feed lists this registration." });
  // 2) own callsign on live ADS-B (ICAO prefix + number, every operating prefix)
  for (const p of pre) { const c = p + dg + (sx || ""); const l = await liveByCallsign(c).catch(() => null); steps.push(`ADS-B callsign ${c}: ${l ? (fits(l) ? "found" : "found but position doesn't fit this flight (callsign reused)") : "not seen"}`);
    if (l && (l.reg || l.hex) && fits(l)) return out({ reg: l.reg || null, hex: l.hex, type: l.type, confidence: "confirmed", how: "adsb-callsign", reason: `Its transponder is broadcasting callsign ${l.callsign || c}.`, live: l }); }
  // 3) the airline's aircraft in Skyline's Europe-wide sweep whose callsign adsbdb maps to this flight number / route
  if (FLEET && o) { FLEET.focus(o); if (d && air) FLEET.focus(d); }
  if (pre.length) { const F = await airlineFleetRoutes(pre, depth ? 25 : 70); steps.push(`${F.length} ${pre.join("/")} aircraft in the live sweep`);
    const byNum = F.filter(x => x.num === number && fits(x)); if (F.some(x => x.num === number && !fits(x))) steps.push(`callsign for ${number} live on another leg — ignored`); if (byNum.length) { const x = byNum.sort((a, b) => a.seenAgo - b.seenAgo)[0];
      return out({ reg: x.reg, hex: x.hex, type: x.type, confidence: "confirmed", how: "adsb-route", reason: `Transponder callsign ${x.cs} is registered to ${number} (adsbdb).`, live: { lat: x.lat, lon: x.lon, alt: x.alt, gs: x.gs, track: x.track, hex: x.hex, callsign: x.cs, onGround: x.gnd } }); }
    if (o && d) { const byRt = F.filter(x => !otherNum(x) && fits(x) && x.ro === o && x.rd === d && (air ? (!x.gnd || x.ap === o) : (x.gnd && x.ap === o))); const uniq = [...new Map(byRt.map(x => [x.hex, x])).values()];
      if (uniq.length === 1) { const x = uniq[0]; return out({ reg: x.reg, hex: x.hex, type: x.type, confidence: "likely", how: "adsb-route", reason: `The only ${pre[0]} aircraft flying ${o}→${d} now (callsign ${x.cs}).`, live: { lat: x.lat, lon: x.lon, alt: x.alt, gs: x.gs, track: x.track, hex: x.hex, callsign: x.cs, onGround: x.gnd } }); }
      if (uniq.length > 1) steps.push(`${uniq.length} ${pre[0]} aircraft on ${o}→${d}`);
      // take-off match: the fleet log saw this airline's aircraft take off from o close to this flight's actual departure
      const dRef = +new Date(q.depActual || 0) || (air ? depT : 0); if (dRef) { const tk = F.filter(x => !otherNum(x) && !x.gnd && x.last?.from === o && !x.last.to && x.last.dep && Math.abs(x.last.dep - dRef) < 30 * 60e3 && (!x.rd || x.rd === d) && (!x.ro || x.ro === o));
        const tk2 = tk.length > 1 && AP[d] ? tk.filter(x => hdgOk(x, AP[d]) || x.app === d) : tk; steps.push(`take-off log at ${o}: ${tk.length} ${pre[0]} departure(s) near ${new Date(dRef).toISOString().slice(11, 16)} UTC`);
        if (tk2.length === 1) { const x = tk2[0]; return out({ reg: x.reg, hex: x.hex, type: x.type, confidence: "likely", how: "adsb-takeoff", reason: `Skyline's ADS-B log saw ${x.reg || x.hex} (callsign ${x.cs}) take off from ${o} at ${new Date(x.last.dep).toISOString().slice(11, 16)} UTC, matching this departure${x.rd === d ? " and its adsbdb route" : ""}.`, live: { lat: x.lat, lon: x.lon, alt: x.alt, gs: x.gs, track: x.track, hex: x.hex, callsign: x.cs, onGround: false } }); } }
      // logged leg: the fleet log has a complete or open o→d leg for this airline that left within 30 min of this departure (covers flights that already landed)
      if (dRef) { const lg = [...new Map(FLEET.legsOn(o, d, pre).filter(l => l.dep && Math.abs(l.dep - dRef) < 30 * 60e3).map(l => [l.hex, l])).values()]; steps.push(`fleet log ${o}→${d} legs near departure: ${lg.length}`);
        if (lg.length === 1) { const l = lg[0]; const x = F.find(y => y.hex === l.hex); return out({ reg: l.reg, hex: l.hex, type: x?.type || null, confidence: "likely", how: "adsb-leg", reason: `Skyline's ADS-B log recorded ${l.reg || l.hex} (callsign ${l.cs}) flying ${o}→${d}, off at ${new Date(l.dep).toISOString().slice(11, 16)} UTC${l.arr ? ", landed " + new Date(l.arr).toISOString().slice(11, 16) + " UTC" : ""}.`, live: x ? { lat: x.lat, lon: x.lon, alt: x.alt, gs: x.gs, track: x.track, hex: x.hex, callsign: x.cs, onGround: x.gnd } : null }); } }
      // approach match: airborne, descending towards d, came from o
      if (air) { const ap = F.filter(x => !otherNum(x) && !x.gnd && x.app === d && (x.last?.from === o || x.ro === o)); if (ap.length === 1) { const x = ap[0]; return out({ reg: x.reg, hex: x.hex, type: x.type, confidence: "likely", how: "adsb-approach", reason: `${x.reg || x.hex} (callsign ${x.cs}) is descending into ${d} after leaving ${o} — the only ${pre[0]} aircraft doing so.`, live: { lat: x.lat, lon: x.lon, alt: x.alt, gs: x.gs, track: x.track, hex: x.hex, callsign: x.cs, onGround: false } }); } }
      // geometry: airborne airline aircraft on the great-circle corridor heading for d, progress consistent with time
      const A = AP[o], B = AP[d]; if (A && B && air) { const km = hkm(A, B); const fit = F.filter(x => !otherNum(x) && !x.gnd && typeof x.alt === "number" && x.lat != null && (hkm(A, x) + hkm(x, B)) < km * 1.05 + 20 && hdgOk(x, B) && (!x.ro || x.ro === o) && (!x.rd || x.rd === d));
        const prog = depT ? Math.min(1, (Date.now() - depT) / ((km / 780 + 0.4) * 3600e3)) : null; const fit2 = prog == null ? fit : fit.filter(x => Math.abs(hkm(A, x) / km - prog) < 0.35);
        if (fit2.length === 1) { const x = fit2[0]; return out({ reg: x.reg, hex: x.hex, type: x.type, confidence: "possible", how: "adsb-geometry", reason: `Possible: the only ${pre[0]} aircraft on the ${o}→${d} corridor where this flight should be (callsign ${x.cs}).`, live: { lat: x.lat, lon: x.lon, alt: x.alt, gs: x.gs, track: x.track, hex: x.hex, callsign: x.cs, onGround: false } }); }
        steps.push(`corridor ${o}→${d}: ${fit2.length} candidate(s)`); if (fit2.length > 1) q._cands = fit2.sort((a, b) => (prog == null ? 0 : Math.abs(hkm(A, a) / km - prog) - Math.abs(hkm(A, b) / km - prog))).slice(0, 3).map(x => ({ reg: x.reg, hex: x.hex, cs: x.cs, type: x.type })); } } }
  // 3a) direct ADS-B search around where the flight should be now (works outside the sweep areas too)
  if (air && o && d) { const L = await findInFlight({ number, airline: { icao: pre[0] }, origin: { iata: o }, destination: { iata: d }, dep: { actual: q.depActual || q.dep }, status: "departed" }).catch(() => null);
    if ((L?.reg || L?.hex) && fits(L)) return out({ reg: L.reg, hex: L.hex, type: L.type, confidence: L.geom ? "possible" : "confirmed", how: L.geom ? "adsb-geometry" : "adsb-route", reason: L.geom ? `The only ${pre[0]} aircraft near where ${number} should be on the ${o}→${d} route (callsign ${L.callsign}).` : `Transponder ${L.callsign} is flying ${o}→${d} (adsbdb route).`, live: L }); steps.push("position search: no unique match"); }
  // 3b) learned callsign: the callsign this airline used on o→d at about this time of day in the last 30 h (fleet log), seen live now
  if (o && d && pre.length && FLEET && depT) { const tod = t => (t % 86400e3); const L = FLEET.legsOn(o, d, pre).filter(l => { if (!l.dep) return false; const x = Math.abs(tod(l.dep) - tod(depT)); return Math.min(x, 86400e3 - x) < 100 * 60e3 && Date.now() - l.dep > 6 * 3600e3; });
    const css = [...new Set(L.map(l => l.cs))].slice(0, 4); for (const c of css) { const l = await liveByCallsign(c).catch(() => null); if (l && (l.reg || l.hex) && fits(l)) { const pos = l.lat != null ? (AP[o] && hkm(AP[o], l) < 15 ? "on the ground/at " + o : "airborne") : "";
        return out({ reg: l.reg || null, hex: l.hex, type: l.type, confidence: "likely", how: "learned-callsign", reason: `${pre[0]} flew ${o}→${d} at this time yesterday as callsign ${c}; that callsign is live now${pos ? " (" + pos + ")" : ""} on ${l.reg || l.hex}.`, live: l }); } }
    if (css.length) steps.push(`learned callsign(s) ${css.join(", ")} not live`); }
  if (depth > 0) return out({ reason: "not resolved" });
  // 4) inbound rotation: same airline arriving at o from d (or anywhere) 30 min–3 h before departure, paired number first
  let inbound = null;
  if (o && al && depT) { const ctx = await acContext(o, q.date || todayLondon()).catch(() => null); const A = ctx?.arr || [];
    const cand = A.filter(a => { const [, al2] = acNum(normNum(a.number)); const t = +new Date(a.arr?.actual || a.arr?.estimated || a.arr?.scheduled || 0); return al2 === al && t && t < depT - 30 * 60e3 && t > depT - 3 * 3600e3; })
      .map(a => { const n2 = +acNum(normNum(a.number))[2]; return { a, score: (Math.abs(n2 - +dg) === 1 ? 0 : 10) + (a.origin?.iata === d ? 0 : 5) + Math.abs(+new Date(a.arr?.scheduled || 0) - (depT - 70 * 60e3)) / 3600e3 }; }).sort((x, y) => x.score - y.score);
    const best = cand[0]; if (best && best.score < 10) { const a = best.a; const ar = +new Date(a.arr?.actual || a.arr?.estimated || a.arr?.scheduled);
      let r = a.aircraft?.reg ? { reg: a.aircraft.reg, confidence: "confirmed", how: "board" } : null;
      if (!r && a.origin?.iata) { const ob = await board(a.origin.iata, "dep", q.date || todayLondon()).catch(() => null); const row = (ob?.flights || []).find(x => normNum(x.number) === normNum(a.number)); if (row?.aircraft?.reg) r = { reg: row.aircraft.reg, confidence: "confirmed", how: "board" };
        if (!r) r = await resolvePlane({ number: a.number, o: a.origin.iata, d: o, status: row?.status || a.status, dep: row?.dep?.actual || row?.dep?.scheduled, depActual: row?.dep?.actual, date: q.date }, 1).catch(() => null);
        inbound = { number: normNum(a.number), from: a.origin.iata, arr: new Date(ar).toISOString(), status: a.status, depStatus: row?.status || null, depSched: row?.dep?.scheduled || null, reg: r?.reg || null, hex: r?.hex || null, live: r?.live || null, via: r?.how || null }; }
      else inbound = { number: normNum(a.number), from: a.origin?.iata, arr: new Date(ar).toISOString(), status: a.status, reg: r?.reg || null };
      // 4b) inbound already landed but unnamed: the airline's aircraft the fleet log saw land at o from inbound.from around that time
      if (!inbound.reg && !inbound.hex && FLEET && ar < Date.now() + 10 * 60e3) { const G = FLEET.airlineNow(pre, 4 * 3600e3).filter(x => x.last?.to === o && x.last.arr && Math.abs(x.last.arr - ar) < 45 * 60e3 && (x.gnd ? x.ap === o : true));
        const m = G.filter(x => x.last.from === a.origin?.iata); const pk = m.length === 1 ? m[0] : null; steps.push(`fleet log: ${G.length} ${pre[0]} landing(s) at ${o} near ${inbound.number}'s arrival, ${m.length} from ${inbound.from}`);
        if (pk) Object.assign(inbound, { reg: pk.reg, hex: pk.hex, via: "fleet-landing", live: { lat: pk.lat, lon: pk.lon, alt: pk.alt, hex: pk.hex, callsign: pk.cs, onGround: pk.gnd } }); }
      if (inbound.reg || inbound.hex) { const landed = a.status === "landed" || ar < Date.now(); const lv = inbound.live; const flying = lv && lv.alt !== "ground" && !lv.onGround;
        return out({ reg: inbound.reg, hex: inbound.hex, type: r?.type || lv?.type || null, confidence: "likely", how: "rotation", inbound, live: lv,
          reason: `Inbound ${inbound.number} from ${inbound.from} ${landed ? "arrived" : flying ? "is in the air now" : "departs " + (inbound.depSched ? "at " + new Date(inbound.depSched).toISOString().slice(11, 16) + " UTC" : "earlier")} as ${inbound.reg || inbound.hex}; airlines normally turn the same aircraft round.` }); }
      steps.push(`inbound ${inbound.number} from ${inbound.from}: aircraft not identified yet${inbound.depStatus ? " (" + inbound.depStatus + " at " + inbound.from + ")" : ""}`); } else steps.push("no paired inbound flight on the arrivals board"); }
  // 5) airline aircraft sitting on the ground at o whose last observed leg came from d
  if (o && pre.length && FLEET && !air) { const G = FLEET.airlineNow(pre, 90 * 60e3).filter(x => x.gnd && x.ap === o); const fromD = G.filter(x => x.last?.from === d);
    const pick = fromD.length === 1 ? fromD[0] : G.length === 1 ? G[0] : null; steps.push(`${G.length} ${pre[0]} aircraft on the ground at ${o}`);
    if (pick && depT && depT - Date.now() < 4 * 3600e3) return out({ reg: pick.reg, hex: pick.hex, type: pick.type, confidence: fromD.length === 1 ? "likely" : "possible", how: "ground", inbound, reason: `${pick.reg || pick.hex} is the ${fromD.length === 1 ? "only " + pre[0] + " aircraft at " + o + " that last flew in from " + d : "only " + pre[0] + " aircraft Skyline can see on the ground at " + o + " (others may be parked with transponders off)"}.`, live: { lat: pick.lat, lon: pick.lon, alt: "ground", hex: pick.hex, callsign: pick.cs, onGround: true } }); }
  const cands = q._cands || null;
  if (air && cands?.length) { const c = cands[0]; return out({ reg: c.reg, hex: c.hex, type: c.type, confidence: "possible", how: "adsb-geometry", candidates: cands, reason: `${cands.length} ${pre[0]} aircraft are on the ${o}→${d} route right now; ${c.reg || c.hex} (callsign ${c.cs}) is closest to where this flight should be. Possible match — Skyline estimate.` }); }
  const reason = air ? `This flight is in the air but its transponder isn't visible: ${cands ? cands.length + " " + pre[0] + " aircraft fit the route, so Skyline won't guess" : "it may be outside volunteer ADS-B coverage (e.g. over sea), or the airline uses a callsign Skyline can't map yet"}.`
    : inbound ? `The aircraft comes in as ${inbound.number} from ${inbound.from} (due ${new Date(inbound.arr).toISOString().slice(11, 16)} UTC). That plane isn't identified yet${inbound.depStatus ? ` — it's "${inbound.depStatus}" at ${inbound.from}` : ""}; Skyline will name it as soon as it's seen.`
    : depT && depT - Date.now() > 3 * 3600e3 ? "More than 3 h to departure; airlines often assign the exact aircraft 2–3 h before." : "No feed lists the aircraft and no transponder matched yet.";
  return out({ reg: null, confidence: "typical", how: null, inbound, candidates: cands, reason });
}
api.get("/plane-resolve", async (req, res) => { try { res.json(await resolvePlane({ ...req.query, o: String(req.query.o || "").toUpperCase(), d: String(req.query.d || "").toUpperCase() })); } catch (e) { res.status(500).json({ error: e.message }); } });
// ---------- v22: one aircraft card for ANY flight. Every field says where it came from; gaps carry a reason. ----------
api.get("/fleet/stats", (req, res) => res.json(FLEET?.stats() || { off: true }));
api.get("/fleet/:id", (req, res) => { const id = req.params.id; res.json(FLEET?.legsFor(/^[0-9a-f]{6}$/i.test(id) ? { hex: id.toLowerCase() } : { reg: id }) || { legs: [], none: true }); });
api.get("/plane-card", async (req, res) => { try {
  const q = req.query; const number = String(q.number || "").toUpperCase().replace(/\s/g, ""); const o = String(q.o || "").toUpperCase(), d = String(q.d || "").toUpperCase(); const ymd = String(q.date || todayLondon());
  const [, al, digits] = acNum(number); const icao = AL[al]?.icao || (/^[A-Z]{3}/.test(number) ? number.slice(0, 3) : null); const cs = icao && digits ? icao + digits : null;
  let hex = String(q.hex || "").toLowerCase().replace(/[^0-9a-f]/g, ""), reg = String(q.reg || "").toUpperCase(); let how = hex || reg ? "given" : null, conf = hex || reg ? "confirmed" : null, typical = null; const gaps = [];
  const status = String(q.status || ""); const arrT = +new Date(q.arr || 0), depT = +new Date(q.dep || 0);
  // 1) ADS-B observed take-off/landing log (covers landed flights)
  if (!hex && !reg) { for (const [ap, kind, t] of [[d, "arr", arrT], [o, "dep", depT]]) { const ev = (OBS[ap]?.events || []).filter(e => e.kind === kind);
      let m = cs && ev.filter(e => e.cs === cs && (!t || Math.abs(e.t - t) < 4 * 3600e3)); if (!m?.length && icao && t) m = ev.filter(e => (e.cs || "").startsWith(icao) && Math.abs(e.t - t) < 25 * 60e3);
      if (m?.length === 1 || (m?.length && m.every(x => x.hex === m[0].hex))) { hex = m[0].hex; reg = m[0].reg || ""; how = "observed-" + kind; conf = m[0].cs === cs ? "confirmed" : "likely"; break; } } }
  // 2) live ADS-B by callsign
  if (!hex && cs && status !== "landed") { let l = await adsb("callsign/" + cs).catch(() => []); const cs2 = cs.replace(/^([A-Z]{3})0+/, "$1"); if (!l[0] && cs2 !== cs) l = await adsb("callsign/" + cs2).catch(() => []); if (l[0]) { if (reg && l[0].reg && l[0].reg.replace(/-/g, "") !== reg.replace(/-/g, "")) gaps.push(`The schedule feed listed ${reg}, but the live transponder for ${cs} is ${l[0].reg}. Skyline shows the live aircraft.`); hex = l[0].hex; reg = l[0].reg || reg; how = "adsb-callsign"; conf = "confirmed"; } }
  if (!hex && reg) { const l = (await adsb("reg/" + reg).catch(() => []))[0]; if (l?.hex) hex = l.hex; }
  // 3) the existing resolver (board, ADS-B route/geometry, rotation)
  let rp = null; if (!hex && !reg && status !== "landed") { try { rp = await resolvePlane({ number, o, d, date: ymd, status, dep: q.dep, depActual: /departed|enroute/.test(status) ? q.dep : null }); if (rp.reg || rp.hex) { reg = rp.reg || ""; hex = rp.hex || ""; how = rp.how; conf = rp.confidence; } } catch {} }
  if (!hex && !reg && o && status !== "landed") { try { const ctx = await acContext(o, ymd); const f = ctx.dep.find(x => (x.number || "").replace(/\s/g, "") === number) || { number, origin: AP[o], dep: { scheduled: q.dep }, destination: { iata: d } };
      const r = await resolveAircraft(f, ctx); if (r?.reg || r?.live?.hex) { reg = r.reg || ""; hex = r.live?.hex || ""; how = r.how; conf = /geometry|rotation/.test(r.how || "") ? "likely" : "confirmed"; } typical = r?.typicalType || null; } catch {} }
  const out = { number, callsign: cs, how, confidence: conf, hex: hex || null, reg: reg || null, sources: [], reason: rp?.reason || null, inbound: rp?.inbound || null, candidates: rp?.candidates || null, steps: rp?.steps };
  if (!hex && !reg && rp?.reason) { out.typicalType = typical || (icao ? typicalType(icao) : null); out.confidence = "typical"; gaps.push(rp.reason); out.gaps = gaps; return res.json(out); }
  if (!hex && !reg) { out.typicalType = typical || (icao ? typicalType(icao) : null); gaps.push(status === "landed" ? "This flight has landed and Skyline didn't see it touch down on ADS-B, so its exact aircraft isn't known." : depT && depT - Date.now() > 3 * 3600e3 ? "Airlines usually assign the exact aircraft 2–3 hours before departure. Skyline keeps checking." : "No transponder matched this flight yet (it may be outside volunteer ADS-B coverage)."); out.gaps = gaps; return res.json(out); }
  const key = hex || reg; const db = await cached("adsbdb:" + key.toUpperCase(), 86400, () => getJ("https://api.adsbdb.com/v0/aircraft/" + key.toUpperCase()).then(j => j.response?.aircraft || null).catch(() => null));
  if (db) { Object.assign(out, { reg: out.reg || db.registration, hex: out.hex || (db.mode_s || "").toLowerCase(), type: db.type, icaoType: db.icao_type, manufacturer: db.manufacturer, owner: db.registered_owner, ownerCountry: db.registered_owner_country_name }); out.sources.push("adsbdb.com"); if (db.url_photo) out.photo = { src: db.url_photo_thumbnail || db.url_photo, credit: "airport-data.com", link: db.url_photo }; }
  if (!out.type && out.hex) { try { const h = await cached("hexdb:" + out.hex, 86400 * 7, () => getJSON(`https://hexdb.io/api/v1/aircraft/${out.hex}`)); Object.assign(out, { reg: out.reg || h.Registration, type: h.Type, icaoType: h.ICAOTypeCode, manufacturer: h.Manufacturer, owner: out.owner || h.RegisteredOwners }); out.sources.push("hexdb.io"); } catch {} }
  try { const p = await cached("ps:" + (out.hex || out.reg), 86400, () => getJSON(out.hex ? `https://api.planespotters.net/pub/photos/hex/${out.hex}` : `https://api.planespotters.net/pub/photos/reg/${out.reg}`, { headers: { "user-agent": UA } })); const ph = p.photos?.[0]; if (ph) out.photo = { src: ph.thumbnail_large?.src, link: ph.link, credit: "© " + ph.photographer + " / planespotters.net" }; } catch {}
  if (out.hex) { const l = (await adsb("hex/" + out.hex).catch(() => []))[0]; if (l?.lat) { if (!out.icaoType && l.type) { out.icaoType = l.type; if (!out.type) out.type = l.type + " (from its transponder)"; } const nc = x => String(x || "").trim().replace(/^([A-Z]{3})0+/, "$1"); if (cs && l.flight && nc(l.flight) !== nc(cs)) gaps.push(`${out.reg || "This aircraft"} is currently flying as ${String(l.flight).trim()}, not ${cs}. The feed's registration may be out of date, or the plane is on another leg first.`); out.live = { other: !!(cs && l.flight && nc(l.flight) !== nc(cs)), lat: l.lat, lon: l.lon, alt: l.alt, gs: l.gs, track: l.track, flight: l.flight, vs: l.vs, seen: l.seen }; out.sources.push("ADS-B (adsb.lol/airplanes.live/adsb.fi)"); } }
  // previous / next legs: Skyline's own observed log (ADS-B take-offs/landings + feeds)
  const legs = []; for (const [ap, ob] of Object.entries(OBS)) for (const e of ob.events) if ((out.hex && e.hex === out.hex) || (out.reg && e.reg === out.reg)) legs.push({ ap, kind: e.kind, t: e.t, cs: e.cs });
  const fl = FLEET?.legsFor({ hex: out.hex, reg: out.reg }); if (fl) { out.today = fl.legs; out.fleetNow = fl.now; if (!out.type && fl.type) { out.icaoType = fl.type; out.type = fl.type; } if (!out.reg && fl.reg) out.reg = fl.reg; out.sources.push("Skyline fleet log (Europe-wide ADS-B sweeps)"); }
  legs.sort((a, b) => b.t - a.t); out.legs = legs.slice(0, 10).map(l => ({ ...l, at: new Date(l.t).toISOString() })); if (!legs.length && !out.today?.length) gaps.push("Skyline hasn't logged this aircraft's earlier take-offs or landings (it only logs ADS-B at the airports it watches).");
  if (!out.live) gaps.push(status === "landed" ? "Not broadcasting now (parked or switched off)." : "Not visible on ADS-B right now.");
  gaps.push("Build year / age and cabin layout aren't in any free aircraft database Skyline uses."); out.gaps = gaps; res.json(out);
} catch (e) { res.status(500).json({ error: e.message }); } });
app.use("/api", api);
const dist = path.join(__dir, "../web/dist");
app.use(express.static(dist, { setHeaders: (r, p) => { if (p.endsWith("sw.js") || p.endsWith(".html") || p.endsWith("version.json")) r.setHeader("cache-control", "no-cache"); } }));
app.get(/^\/(?!api).*/, (q, r) => r.sendFile(path.join(dist, "index.html")));
reg36(api, { getJSON, cached, wrap, STATE, saveState, board, todayLondon, adsb });
app.listen(PORT, "0.0.0.0", () => console.log("Skyline on :" + PORT));

process.on("unhandledRejection", e => console.error("[unhandledRejection]", e?.message || e));
process.on("uncaughtException", e => console.error("[uncaughtException]", e?.message || e));

// ---- v41 Airport facts: operator (verified static table first, Wikidata P137 second), owner, opening year, Commons terminal photo ----
const OPERATOR = { MAN: "Manchester Airports Group", STN: "Manchester Airports Group", EMA: "Manchester Airports Group", LHR: "Heathrow Airport Holdings", FRA: "Fraport AG",
  LCA: "Hermes Airports", PFO: "Hermes Airports", IST: "İGA Airport Operation", VIE: "Flughafen Wien AG", BUD: "Budapest Airport Zrt.", WAW: "Polish Airports State Enterprise (PPL)",
  MUC: "Flughafen München GmbH", BER: "Flughafen Berlin Brandenburg GmbH", DUS: "Flughafen Düsseldorf GmbH", PRG: "Letiště Praha, a. s.", KEF: "Isavia", SYD: "Sydney Airport Corporation",
  MLA: "Malta International Airport plc", ABZ: "AGS Airports", DUB: "daa", ORK: "daa", AMS: "Royal Schiphol Group", CDG: "Groupe ADP", ORY: "Groupe ADP", LGW: "Gatwick Airport Limited" };
for (const c of Object.keys(FRAPORT_GR)) OPERATOR[c] = "Fraport Greece"; for (const c of AVINOR) OPERATOR[c] = "Avinor"; for (const c of SWEDAVIA) OPERATOR[c] = "Swedavia"; for (const c of FINAVIA) OPERATOR[c] = "Finavia"; for (const c of AENA_CODES) OPERATOR[c] ||= "Aena";
const WDUA = { "user-agent": "Skyline/1.0 (flight tracker; open-data facts)" };
async function commonsInfo(titles) { if (!titles.length) return []; const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&titles=" + encodeURIComponent(titles.join("|"));
  const j = await getJSON(u, { headers: WDUA }); return Object.values(j.query?.pages || {}).map(p => { const i = p.imageinfo?.[0]; if (!i) return null; const m = i.extmetadata || {}; const strip = s => String(s || "").replace(/<[^>]+>/g, "").trim();
    return { title: p.title, url: i.thumburl || i.url, page: i.descriptionurl, w: i.width, h: i.height, author: strip(m.Artist?.value) || "Unknown author", licence: strip(m.LicenseShortName?.value), licenceUrl: m.LicenseUrl?.value || null }; }).filter(Boolean); }
const OK_LIC = /^(cc|public domain|pd|cc0|attribution)/i; const GOOD_T = /terminal|entrance|building|exterior|front|airport|aerodrome|flughafen|aeroporto|aeropuerto|lufthavn|αεροδρ/i; const BAD_T = /\bim terminal|inside|interior|innen|lounge|check-in|baggage|map|logo|diagram|chart|plan|\.svg|\.pdf|aircraft|boeing|airbus|cockpit|tail|runway/i;
async function airportFacts(c) { const a = AP[c]; if (!a) return null;
  return cached("apfacts2:" + c, 7 * 86400, async () => {
    const q = `SELECT ?a ?opLabel ?ownLabel ?open ?img WHERE { ?a wdt:P238 "${c}". OPTIONAL{?a wdt:P137 ?op} OPTIONAL{?a wdt:P127 ?own} OPTIONAL{?a wdt:P1619 ?open} OPTIONAL{?a wdt:P18 ?img} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
    let wd = []; try { wd = (await getJSON("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: WDUA })).results?.bindings || []; } catch {}
    const uniq = k => [...new Set(wd.map(b => b[k]?.value).filter(Boolean))]; const qid = uniq("a")[0]?.split("/").pop() || null;
    const wdOps = uniq("opLabel").filter(x => !/^Q\d+$/.test(x)); const owners = uniq("ownLabel").filter(x => !/^Q\d+$/.test(x)); const opened = uniq("open").map(x => +x.slice(0, 4)).filter(Boolean).sort()[0] || null;
    const st = OPERATOR[c]; const operator = st ? { name: st, how: "Skyline verified table" + (wdOps.length ? (wdOps.some(x => x.toLowerCase().includes(st.toLowerCase().split(" ")[0].toLowerCase())) ? " · matches Wikidata" : " · Wikidata lists " + wdOps.join(", ")) : "") } : wdOps.length ? { name: wdOps.join(" / "), how: "Wikidata (operator, P137) · not independently verified" } : null;
    // photo: Commons search for the terminal/entrance; Wikidata image (P18) as a candidate too. Only openly licensed bitmaps with a terminal-like title.
    let photo = null; try { const short = String(a.name || "").replace(/ (International )?Airport.*/i, "").trim(); const toks = [a.city, short].filter(Boolean).flatMap(x => String(x).toLowerCase().split(/[^\p{L}]+/u)).filter(t => t.length >= 4 && !/airport|international/.test(t)); const cands = [];
      for (const s of [a.city && a.city + " airport terminal", short + " airport terminal", a.city && a.city + " airport"].filter(Boolean)) { const j = await getJSON("https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=" + encodeURIComponent(s + " filetype:bitmap"), { headers: WDUA }).catch(() => null);
        for (const r of j?.query?.search || []) if (!cands.includes(r.title) && toks.some(t => r.title.toLowerCase().includes(t))) cands.push(r.title); if (cands.filter(t => /terminal|entrance|building|exterior/i.test(t)).length >= 3) break; }
      const p18 = uniq("img").map(u => "File:" + decodeURIComponent(u.split("/").pop())); const titles = [...cands.filter(t => /terminal|entrance|building|exterior/i.test(t)), ...p18, ...cands].filter((t, i, A) => A.indexOf(t) === i && !BAD_T.test(t)).slice(0, 12);
      const info = await commonsInfo(titles); const ord = t => titles.indexOf(t); const pick = info.filter(i => OK_LIC.test(i.licence) && i.w >= 600 && i.w >= i.h * 0.9).sort((x, y) => ord(x.title) - ord(y.title))[0];
      if (pick) photo = { ...pick, kind: /terminal|entrance|building|exterior/i.test(pick.title) ? "Terminal" : "Airport", how: p18.includes(pick.title) ? "Wikidata image (P18)" : "Wikimedia Commons search" }; } catch {}
    return { iata: c, icao: a.icao || null, name: a.name, qid, operator, owners, opened, photo, sources: ["Wikidata" + (qid ? " " + qid : ""), "Wikimedia Commons"] }; }); }
api.get("/airport/:iata/facts", wrap(async (req, res) => { const f = await airportFacts(req.params.iata.toUpperCase()); f ? res.json(f) : res.status(404).json({ error: "Unknown airport" }); }));

// ---- v44 Destination guide: Wikidata/Wikipedia facts, Commons photos, sights, major cities, airlines seen on the route in Skyline's own data. Cached 7 days. ----
const wdq1 = q => getJSON("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: WDUA }).then(j => j.results?.bindings || []);
const wdq = q => wdq1(q).catch(() => new Promise(r => setTimeout(r, 1500)).then(() => wdq1(q))).catch(e => { console.warn("wdq failed", String(e.message || e).slice(0, 80)); return []; });
// v46: resolve the guide's place from the airport entity itself (P238 → P931/P131 chain/P706), matched to the airport's own city name.
const normN = s => String(s || "").replace(/[øØ]/g, "o").replace(/[æÆ]/g, "ae").replace(/ß/g, "ss").replace(/ı/g, "i").replace(/[đĐ]/g, "d").replace(/[łŁ]/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const qid = u => u ? String(u).split("/").pop() : null;
const ISLAND = new Set(["Q23442", "Q33837", "Q1402592", "Q12766313", "Q2226709", "Q185113"]);
async function placeInfo(ids) { if (!ids.length) return {}; const V = ids.map(i => "wd:" + i).join(" ");
  const b = await wdq(`SELECT ?e ?eLabel ?t ?pop ?ctry ?ctryLabel ?tzLabel ?img ?art ?coord ?cat ?alt ?isl WHERE { VALUES ?e { ${V} } OPTIONAL{?e wdt:P31 ?t} OPTIONAL{ FILTER EXISTS { ?e wdt:P31/wdt:P279* wd:Q23442 } BIND(true AS ?isl) } OPTIONAL{?e wdt:P1082 ?pop} OPTIONAL{?e wdt:P17 ?ctry} OPTIONAL{?e wdt:P421 ?tz} OPTIONAL{?e wdt:P18 ?img} OPTIONAL{?e wdt:P625 ?coord} OPTIONAL{?e wdt:P373 ?cat} OPTIONAL{?e skos:altLabel ?alt FILTER(LANG(?alt) IN ("en","es","it","pt","el","de","fr","no","is","tr"))} OPTIONAL{?art schema:about ?e; schema:isPartOf <https://en.wikipedia.org/>} SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es,it,pt,el,de,fr,nb,is,tr". } }`);
  const o = {}; for (const x of b) { const k = qid(x.e.value); const r = o[k] ||= { qid: k, label: x.eLabel?.value, types: new Set(), pops: new Set(), alts: new Set(), tz: new Set() };
    if (x.t) r.types.add(qid(x.t.value)); if (x.isl) r.isl = true; if (x.pop) r.pops.add(+x.pop.value); if (x.alt) r.alts.add(x.alt.value); if (x.tzLabel && !/^Q\d+$/.test(x.tzLabel.value)) r.tz.add(x.tzLabel.value);
    r.ctry ||= qid(x.ctry?.value); r.ctryLabel ||= x.ctryLabel?.value; r.img ||= x.img?.value; r.art ||= x.art?.value; r.cat ||= x.cat?.value;
    if (!r.coord && x.coord) { const m = x.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/); if (m) r.coord = { lon: +m[1], lat: +m[2] }; } }
  for (const r of Object.values(o)) { r.island = !!r.isl || [...r.types].some(t => ISLAND.has(t)); r.pop = r.pops.size === 1 ? [...r.pops][0] : r.pops.size ? null : null; r.popAll = [...r.pops]; } return o; }
async function popOf(q) { const b = await wdq(`SELECT ?p ?d WHERE { wd:${q} p:P1082 ?s. ?s ps:P1082 ?p. OPTIONAL{?s pq:P585 ?d} ?s wikibase:rank ?r FILTER(?r != wikibase:DeprecatedRank) } ORDER BY DESC(?d) LIMIT 1`); return b[0] ? { n: +b[0].p.value, year: b[0].d?.value?.slice(0, 4) || null } : null; }
const kmBetween = (a, b) => { const R = 6371, t = x => x * Math.PI / 180; const d = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lon - a.lon) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(d)); };
async function resolvePlace(c) { const a = AP[c]; if (!a) return null;
  const A = await wdq(`SELECT ?ap ?s ?l1 ?l2 ?l3 ?on ?ctry WHERE { ?ap wdt:P238 "${c}". OPTIONAL{?ap wdt:P931 ?s} OPTIONAL{?ap wdt:P131 ?l1. OPTIONAL{?l1 wdt:P131 ?l2. OPTIONAL{?l2 wdt:P131 ?l3}}} OPTIONAL{?ap wdt:P706 ?on} OPTIONAL{?ap wdt:P17 ?ctry} } LIMIT 60`);
  const col = k => [...new Set(A.map(x => qid(x[k]?.value)).filter(Boolean))];
  const served = col("s"), l1 = col("l1"), chain = [...l1, ...col("l2"), ...col("l3")], on = col("on"), apQ = col("ap")[0] || null, apCtry = col("ctry")[0] || null;
  const names = String(a.city).split("/").map(normN).filter(Boolean);
  const matches = r => { const ls = [r.label, ...r.alts].map(normN); return names.some(n => ls.some(l => l === n || l.split(" ").includes(n) && l.length - n.length < 12 || n.split(" ").includes(l) && l.length >= 4)); };
  let info = await placeInfo([...new Set([...served, ...chain, ...on])]);
  const near = r => !r.coord || kmBetween(a, r.coord) < 120;
  const order = [...on, ...served, ...l1, ...chain];
  const exact = r => [r.label, ...r.alts].map(normN).some(l => names.includes(l));
  let pick = order.map(q => info[q]).find(r => r && exact(r) && near(r)) || order.map(q => info[q]).find(r => r && matches(r) && near(r)), how = pick ? (on.includes(pick.qid) ? "airport is on (P706)" : served.includes(pick.qid) ? "place served (P931)" : "located in (P131)") : null;
  if (!pick) { const s = await getJSON(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=10&search=${encodeURIComponent(String(a.city).split("/").pop())}`, { headers: WDUA }).catch(() => null);
    const ids = (s?.search || []).map(x => x.id).filter(q => !info[q]); const more = await placeInfo(ids); Object.assign(info, more);
    const okS = r => r && r.coord && kmBetween(a, r.coord) < 60 && (!apCtry || r.ctry === apCtry) && matches(r) && !r.types.has("Q1248784") && !r.types.has("Q644371"); pick = ids.map(q => info[q]).find(r => okS(r) && exact(r)) || ids.map(q => info[q]).find(okS); if (pick) how = "name search, within 60 km and same country"; }
  const matched = !!pick; if (!pick) { pick = info[l1[0]] || info[served[0]] || null; how = pick ? "located in (P131) — no name match" : null; }
  let island = pick?.island ? pick : on.map(q => info[q]).find(r => r?.island) || null;
  if (!island && pick) { const I = await wdq(`SELECT ?i WHERE { wd:${pick.qid} (wdt:P706|wdt:P1376) ?i. ?i wdt:P31/wdt:P279* wd:Q23442 } LIMIT 1`); const iq = qid(I[0]?.i?.value); if (iq) { const ii = await placeInfo([iq]); island = ii[iq] || null; if (island) island.island = true; } }
  const pop = pick ? await popOf(pick.qid).catch(() => null) : null;
  return { airportQ: apQ, place: pick, island, matched, how, pop, apCity: a.city, served, chain, info }; }
// v46 destination guide: everything comes from the place resolved from the airport entity (resolvePlace).
// Wikimedia now only renders standard thumbnail widths (e.g. 500, 960, 1280); 800px returns HTTP 400, which is why photos never appeared.
const thumb800 = u => String(u || "").replace(/\/(\d+)px-/, "/960px-");
async function placePhotos(p) { const files = [];
  if (p.img) files.push("File:" + decodeURIComponent(p.img.split("/").pop()));
  if (p.art) { const t = decodeURIComponent(p.art.split("/wiki/")[1] || ""); const j = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&titles=${encodeURIComponent(t)}`, { headers: WDUA }).catch(() => null); const n = Object.values(j?.query?.pages || {})[0]?.pageimage; if (n) files.push("File:" + n);
    const im = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=images&imlimit=40&titles=${encodeURIComponent(t)}`, { headers: WDUA }).catch(() => null); for (const x of Object.values(im?.query?.pages || {})[0]?.images || []) files.push(x.title.replace(/^Image:/, "File:")); }
  if (p.cat) { const j = await getJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=file&cmlimit=40&cmtitle=${encodeURIComponent("Category:" + p.cat)}`, { headers: WDUA }).catch(() => null); for (const x of j?.query?.categorymembers || []) files.push(x.title); }
  const cand = [...new Set(files)].filter(t => /\.(jpe?g|png|webp)$/i.test(t) && !/map|logo|flag|coat|escudo|bandera|wappen|locator|location|diagram|plan|seal|icon|emblem|signature/i.test(t)).slice(0, 45);
  const info = cand.length ? await commonsInfo(cand).catch(() => []) : [];
  return info.filter(i => OK_LIC.test(i.licence) && i.w >= 600 && i.w >= i.h * 1.05).map(i => ({ i, sc: cand.indexOf(i.title) + (/aerial|satellite|map|nasa|iss0|landsat|sentinel|relief|locator|\bNWW\b|from space/i.test(i.title) ? 100 : 0) - (/beach|playa|town|church|iglesia|castle|castillo|old|harbou?r|port|street|plaza|square|cathedral|landmark|view|panorama/i.test(i.title) ? 0.5 : 0) })).sort((a, b) => a.sc - b.sc).map(x => x.i).slice(0, 6).map(i => ({ ...i, url: "/api/img?u=" + encodeURIComponent(wmThumb(thumb800(i.url))) })); }
async function destGuide(c) { const a = AP[c]; if (!a) return null;
  return cached("dest2:" + c, 7 * 86400, async () => {
    const R = await resolvePlace(c); const p = R?.place; if (!p) throw new Error("place not resolved (Wikidata unavailable?)");
    const ctryQ = p.ctry || null; let summary = null;
    if (p.art) { try { const j = await getJSON("https://en.wikipedia.org/api/rest_v1/page/summary/" + p.art.split("/wiki/")[1], { headers: WDUA }); summary = { text: j.extract, url: j.content_urls?.desktop?.page || p.art, title: j.title }; } catch {} }
    let langs = [], cur = [], sights = [], cities = [], citiesScope = null;
    if (ctryQ) { const L = await wdq(`SELECT DISTINCT ?lLabel ?cLabel WHERE { OPTIONAL{wd:${ctryQ} wdt:P37 ?l} OPTIONAL{wd:${ctryQ} wdt:P38 ?c} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`); langs = [...new Set(L.map(x => x.lLabel?.value))].filter(Boolean).slice(0, 6); cur = [...new Set(L.map(x => x.cLabel?.value))].filter(Boolean).slice(0, 2); }
    const isl = R.island; // settlements on the island, else the country's largest cities
    if (isl) { const A = await wdq(`SELECT ?a ?pt WHERE { OPTIONAL { wd:${isl.qid} wdt:P2046 ?a } OPTIONAL { wd:${isl.qid} wdt:P625 ?pt } } LIMIT 1`); const km = Math.min(120, Math.max(8, Math.sqrt((+A[0]?.a?.value || 400) / Math.PI) * 1.15)); const pt = A[0]?.pt?.value; const C = !pt ? [] : await wdq(`SELECT ?c ?cLabel (MAX(?p) AS ?pop) WHERE { SERVICE wikibase:around { ?c wdt:P625 ?loc. bd:serviceParam wikibase:center "${pt}"^^geo:wktLiteral; wikibase:radius "${km.toFixed(0)}". } ?c wdt:P31/wdt:P279* wd:Q486972; wdt:P1082 ?p. FILTER NOT EXISTS { ?c wdt:P31/wdt:P279* wd:Q23442 } FILTER NOT EXISTS { ?c wdt:P706 ?o. ?o wdt:P31/wdt:P279* wd:Q23442. FILTER(?o != wd:${isl.qid}) } FILTER NOT EXISTS { ?c wdt:P576 [] } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?c ?cLabel ORDER BY DESC(?pop) LIMIT 6`); cities = C; citiesScope = "on " + isl.label; }
    let region = null;
    if (!isl) { const G = await wdq(`SELECT ?r ?rLabel WHERE { wd:${p.qid} wdt:P131+ ?r. ?r wdt:P31/wdt:P279* wd:Q10864048. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 1`); if (G[0]) { region = { qid: qid(G[0].r.value), label: G[0].rLabel.value };
      const C = await wdq(`SELECT ?c ?cLabel (MAX(?p) AS ?pop) WHERE { ?c (wdt:P131|wdt:P131/wdt:P131) wd:${region.qid}; wdt:P31 ?t; wdt:P1082 ?p. VALUES ?t { wd:Q747074 wd:Q515 wd:Q15284 wd:Q2074737 wd:Q484170 wd:Q1549591 wd:Q3957 wd:Q532 wd:Q262166 wd:Q1093829 } FILTER NOT EXISTS { ?c wdt:P576 [] } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?c ?cLabel ORDER BY DESC(?pop) LIMIT 8`); if (C.length >= 3 && +C[0].pop.value >= (R.pop?.n || 0)) { cities = C; citiesScope = "in " + region.label; } /* sanity: region list must contain somewhere at least as big as this place, else Wikidata coverage is too thin */ } }
    if (!cities.length && ctryQ) { cities = await wdq(`SELECT ?c ?cLabel (MAX(?p) AS ?pop) WHERE { ?c wdt:P17 wd:${ctryQ}; wdt:P31 ?t; wdt:P1082 ?p. VALUES ?t { wd:Q515 wd:Q1549591 wd:Q1637706 wd:Q5119 wd:Q200250 } FILTER NOT EXISTS { ?c wdt:P576 [] } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?c ?cLabel ORDER BY DESC(?pop) LIMIT 6`); citiesScope = "in " + (p.ctryLabel || "the country"); }
    cities = cities.map(x => ({ name: x.cLabel?.value, pop: +x.pop?.value, qid: qid(x.c.value) })).filter(x => x.name && !/^Q\d+$/.test(x.name) && x.qid !== p.qid && !/\b(barri|district|distrito|distretto|bezirk|arrondissement|quartier|borough|ward|neighbou?rhood|barrio)\b/i.test(x.name)).slice(0, 6);
    const area = isl && isl.qid !== p.qid ? `{ ?s wdt:P131 wd:${p.qid} } UNION { ?s wdt:P706 wd:${isl.qid} }` : isl ? `{ ?s wdt:P706 wd:${p.qid} } UNION { ?s wdt:P131 wd:${p.qid} } UNION { ?s wdt:P131 ?m. ?m wdt:P706 wd:${p.qid} }` : `?s wdt:P131 wd:${p.qid}.`;
    let S = await wdq(`SELECT ?s ?sLabel ?sDescription ?n WHERE { ${area} ?s wdt:P31/wdt:P279? ?t; wikibase:sitelinks ?n. VALUES ?t { wd:Q570116 wd:Q33506 wd:Q16970 wd:Q23413 wd:Q22698 wd:Q4989906 wd:Q207694 wd:Q2977 wd:Q44539 wd:Q12280 wd:Q8502 wd:Q40080 wd:Q46169 wd:Q8514 } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?n) LIMIT 40`);
    if (!S.length && p.coord) { const S2 = await wdq(`SELECT ?s ?sLabel ?sDescription ?n WHERE { SERVICE wikibase:around { ?s wdt:P625 ?loc. bd:serviceParam wikibase:center "Point(${p.coord.lon} ${p.coord.lat})"^^geo:wktLiteral; wikibase:radius "30". } ?s wdt:P31 ?t; wikibase:sitelinks ?n. VALUES ?t { wd:Q570116 wd:Q33506 wd:Q16970 wd:Q23413 wd:Q22698 wd:Q4989906 wd:Q207694 wd:Q2977 wd:Q44539 wd:Q12280 wd:Q8502 wd:Q40080 wd:Q46169 wd:Q8514 } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?n) LIMIT 40`); S.push(...S2); }
    const seen = new Set(["http://www.wikidata.org/entity/" + p.qid, isl ? "http://www.wikidata.org/entity/" + isl.qid : ""]); sights = S.filter(x => { const k = x.s.value; if (seen.has(k) || /^Q\d+$/.test(x.sLabel?.value || "Q1") || x.sLabel.value === p.label) return false; seen.add(k); return true; }).slice(0, 8).map(x => ({ name: x.sLabel.value, desc: x.sDescription?.value || null, url: "https://www.wikidata.org/wiki/" + qid(x.s.value) }));
    let photos = []; try { photos = await placePhotos(p); if (!photos.length && isl && isl.qid !== p.qid) photos = await placePhotos(isl); } catch {}
    return { iata: c, city: p.label, cityQ: p.qid, isIsland: !!p.island, island: isl && isl.qid !== p.qid ? isl.label : null, region: region?.label || null, matched: R.matched, how: R.how, population: R.matched && R.pop ? R.pop.n : null, popYear: R.pop?.year || null, country: p.ctryLabel || a.country || null, timezone: p.tz.size ? [...p.tz].slice(0, 2) : a.tz ? [a.tz] : [], currency: cur, languages: langs, summary, sights, cities, citiesScope, photos, lat: a.lat, lon: a.lon,
      sources: ["Wikidata " + p.qid + " (" + R.how + ")", summary ? "Wikipedia" : null, photos.length ? "Wikimedia Commons" : null].filter(Boolean), at: Date.now() }; }); }
// image proxy: only upload.wikimedia.org, cached in memory so the PWA gets same-origin, cacheable images.
const IMGC = new Map();
// Commons now hands out thumb.wikimedia.org URLs with utm params; map them to the canonical upload.wikimedia.org path (same file).
const wmThumb = u => { try { const h = new URL(u); if (h.hostname === "thumb.wikimedia.org") h.hostname = "upload.wikimedia.org"; h.search = ""; return h.toString(); } catch { return u; } };
// Wikimedia robot policy: identify with a contact URL; fetch one at a time to stay under their thumbnail rate limit.
const IMGUA = { "user-agent": "Skyline/1.0 (https://skyline-flights.onrender.com; flight tracker, open-data destination guide)" }; let IMGQ = Promise.resolve();
api.get("/img", wrap(async (req, res) => { const u = wmThumb(String(req.query.u || "")); let h; try { h = new URL(u); } catch { return res.status(400).end(); } if (h.protocol !== "https:" || h.hostname !== "upload.wikimedia.org") return res.status(403).json({ error: "host not allowed" });
  let e = IMGC.get(u); if (!e) { const r = await (IMGQ = IMGQ.then(async () => { let r; for (let t = 0; t < 3; t++) { r = await fetch(u, { headers: IMGUA }); if (r.status !== 429) break; await new Promise(z => setTimeout(z, 1500 * (t + 1))); } return r; }).catch(() => null)); if (!r) return res.status(502).end(); if (!r.ok) { console.warn("img", r.status, u.slice(-60)); return res.status(502).end(); } const ct = r.headers.get("content-type") || ""; if (!/^image\//.test(ct)) return res.status(415).end(); const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 1.5e6) return res.status(413).end(); e = { ct, buf }; IMGC.set(u, e); if (IMGC.size > 60) IMGC.delete(IMGC.keys().next().value); }
  res.set("Content-Type", e.ct).set("Cache-Control", "public, max-age=604800, immutable").send(e.buf); }));
// v45 "Before you land": real data from ECB (Frankfurter), Nager.Date, Open-Meteo (sun, air quality/UV), GOV.UK FCDO travel advice.
const codesOf = c => cached("codes1:" + c, 30 * 86400, async () => { const b = await wdq(`SELECT ?iso ?ctryLabel ?cur WHERE { ?ap wdt:P238 "${c}"; wdt:P931 ?city. ?city wdt:P17 ?ctry. ?ctry wdt:P297 ?iso. OPTIONAL{?ctry wdt:P38 ?c2. ?c2 wdt:P498 ?cur} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 5`); const x = b[0]; return x ? { iso: x.iso.value, country: x.ctryLabel?.value, cur: b.map(y => y.cur?.value).find(Boolean) || null } : null; });
// v46 Ground & essentials: OpenStreetMap (Overpass) airport facilities + transport routes; Wikidata country essentials.
const OVP = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
async function overpass(q) { let err; const seq = [OVP[0], OVP[0], OVP[1], OVP[0], OVP[0]]; for (let n = 0; n < seq.length; n++) { const u = seq[n]; try { const r = await fetch(u, { method: "POST", headers: { ...IMGUA, "content-type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(100000) }); if (r.ok) return (await r.json()).elements || []; err = new Error("OpenStreetMap Overpass busy (" + r.status + ")"); } catch (e) { err = new Error("OpenStreetMap Overpass busy (timeout)"); } await new Promise(z => setTimeout(z, 2500 * (n + 1))); } throw err; }
const FAC = { cafe: "Cafés", restaurant: "Restaurants", fast_food: "Fast food", bar: "Bars", pharmacy: "Pharmacy", atm: "ATMs", bureau_de_change: "Currency exchange", toilets: "Toilets", charging_station: "EV charging", car_rental: "Car hire desks", bank: "Banks", lounge: "Lounges", drinking_water: "Water refill points", place_of_worship: "Prayer / multi-faith rooms", luggage_locker: "Luggage lockers", left_luggage: "Left luggage", shop: "Shops" };
api.get("/ground/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(), a = AP[c]; if (!a || !/^[A-Z]{3}$/.test(c)) return res.status(404).json({ error: "Unknown airport" });
  const hit = GRD.get(c); if (hit?.data && Date.now() - hit.at < 3 * 864e5) return res.json(hit.data);
  if (!hit?.job) { const job = groundBuild(c, a).then(d => GRD.set(c, { data: d, at: Date.now() })).catch(e => GRD.set(c, { err: String(e.message || e), at: Date.now() })); GRD.set(c, { ...(hit || {}), job }); }
  const cur = GRD.get(c); if (cur.err && !cur.job) { GRD.delete(c); return res.status(503).json({ error: cur.err }); } if (cur.err) { const e = cur.err; GRD.delete(c); return res.status(503).json({ error: e }); }
  res.status(202).json({ pending: true, note: "Querying OpenStreetMap — public servers can take a minute or two." }); }));
const GRD = new Map();
async function groundBuild(c, a) { {
    const QF = (`[out:json][timeout:100];nwr["aeroway"="aerodrome"]["iata"="${c}"]->.a;.a map_to_area->.ar;(nwr(area.ar)["amenity"~"^(cafe|restaurant|fast_food|bar|pharmacy|atm|bureau_de_change|toilets|charging_station|car_rental|bank|lounge|drinking_water|place_of_worship|luggage_locker|left_luggage)$"];nwr(area.ar)["shop"];nwr(area.ar)["aeroway"="lounge"];);out tags 600;`);
const QT = (`[out:json][timeout:100];(nwr(around:3000,${a.lat},${a.lon})["railway"~"^(station|halt)$"]["name"];nwr(around:3000,${a.lat},${a.lon})["amenity"="bus_station"]["name"];nwr(around:3000,${a.lat},${a.lon})["station"~"^(subway|light_rail)$"]["name"];);out tags center;node(around:1500,${a.lat},${a.lon})["highway"="bus_stop"]->.s;node(around:1500,${a.lat},${a.lon})["public_transport"="stop_position"]->.p;(rel(bn.s);rel(bn.p);)->.r;rel.r["route"~"^(bus|coach|train|light_rail|subway|tram)$"];out tags;`); const F = await overpass(QF), T = await overpass(QT); const groups = {}; for (const e of F) { const t = e.tags || {}; const k = t.aeroway === "lounge" ? "lounge" : t.shop ? "shop" : t.amenity; if (!FAC[k]) continue; (groups[k] ||= { label: FAC[k], n: 0, names: [] }).n++; const nm = t.name || t.brand; if (nm && !groups[k].names.includes(nm) && groups[k].names.length < 8) groups[k].names.push(nm); }
    const toRad = x => x * Math.PI / 180, km = (la, lo) => 6371 * 2 * Math.asin(Math.sqrt(Math.sin(toRad(la - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(la)) * Math.sin(toRad(lo - a.lon) / 2) ** 2));
    const seenS = new Set(), stations = T.filter(e => e.type !== "relation").map(e => ({ name: e.tags.name, kind: e.tags.amenity === "bus_station" ? "Bus station" : e.tags.station === "subway" ? "Metro" : e.tags.station === "light_rail" ? "Light rail" : "Rail", km: Math.round(km(e.center?.lat ?? e.lat, e.center?.lon ?? e.lon) * 10) / 10 })).filter(s => !seenS.has(s.name) && seenS.add(s.name)).sort((x, y) => x.km - y.km).slice(0, 6);
    const R = {}; for (const e of T.filter(e => e.type === "relation")) { const t = e.tags; const key = (t.route || "") + "|" + (t.ref || [t.from, t.to].filter(Boolean).sort().join("~") || t.name); const r = R[key] ||= { mode: t.route, ref: t.ref || null, name: t.name || null, operator: t.operator || t.network || null, ends: new Set() }; for (const x of [t.from, t.to]) if (x) r.ends.add(x); }
    const routes = Object.values(R).map(r => ({ ...r, ends: [...r.ends].slice(0, 3) })).sort((x, y) => (x.mode === "bus") - (y.mode === "bus") || String(x.ref).localeCompare(String(y.ref), undefined, { numeric: true })).slice(0, 14);
    return { iata: c, facilities: Object.entries(groups).map(([k, v]) => ({ k, ...v })).sort((x, y) => y.n - x.n), stations, routes, source: "OpenStreetMap contributors (ODbL) via Overpass API", note: "Mapped by volunteers — counts show what is in OpenStreetMap, which may be incomplete." };
  } }
api.get("/essentials/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(); if (!AP[c]) return res.status(404).json({ error: "Unknown airport" });
  res.json(await cached("ess1:" + c, 30 * 86400, async () => {
    const k = await codesOf(c); if (!k?.iso) throw new Error("country not found");
    const b = await wdq(`SELECT ?ctry ?ctryLabel ?plugLabel ?volt ?hz ?sideLabel ?emLabel ?cc WHERE { ?ctry wdt:P297 "${k.iso}". OPTIONAL{?ctry wdt:P2853 ?plug} OPTIONAL{?ctry wdt:P2884 ?volt} OPTIONAL{?ctry wdt:P2144 ?hz} OPTIONAL{?ctry wdt:P1622 ?side} OPTIONAL{?ctry wdt:P2852 ?em} OPTIONAL{?ctry wdt:P474 ?cc} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`);
    const u = f => [...new Set(b.map(x => x[f]?.value).filter(Boolean))];
    return { iata: c, country: k.country, iso: k.iso, plugs: u("plugLabel").map(s => s.replace(/^(AC power plugs and sockets: )?/i, "")).sort(), voltage: u("volt").map(Number), hz: u("hz").map(Number), driveSide: u("sideLabel")[0] || null, emergency: u("emLabel"), callingCode: u("cc")[0] || null, source: "Wikidata (country " + k.iso + ")" };
  })); }));
// ---- v47 stage 2: outdoors (Open-Meteo marine, pollen, snow, daily forecast), earthquakes (USGS), airline facts (Wikidata) ----
api.get("/outdoors/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(), a = AP[c]; if (!a) return res.status(404).json({ error: "Unknown airport" });
  res.json(await cached("out1:" + c, 3 * 3600, async () => {
    const [m, p, w] = await Promise.all([
      getJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${a.lat}&longitude=${a.lon}&current=sea_surface_temperature,wave_height&daily=wave_height_max&timezone=auto&forecast_days=4&cell_selection=sea`).catch(() => null),
      getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${a.lat}&longitude=${a.lon}&current=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto`).catch(() => null),
      getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=snow_depth&daily=temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,uv_index_max&timezone=auto&forecast_days=4`).catch(() => null)]);
    const pol = p?.current ? Object.fromEntries(Object.entries(p.current).filter(([k, v]) => k.endsWith("_pollen") && v != null).map(([k, v]) => [k.replace("_pollen", ""), v])) : null;
    const sea = m?.current?.sea_surface_temperature != null ? { sst: m.current.sea_surface_temperature, wave: m.current.wave_height, at: m.current.time, km: m.latitude != null ? Math.round(kmBetween(a, { lat: m.latitude, lon: m.longitude })) : null } : null;
    const days = w?.daily?.time ? w.daily.time.map((d, i) => ({ date: d, tmax: w.daily.temperature_2m_max[i], rain: w.daily.precipitation_probability_max[i], wind: w.daily.wind_speed_10m_max[i], uv: w.daily.uv_index_max[i], wave: m?.daily?.wave_height_max?.[i] ?? null })) : [];
    return { iata: c, sea, pollen: pol && Object.keys(pol).length ? pol : null, pollenAt: p?.current?.time || null, snowCm: w?.current?.snow_depth != null ? Math.round(w.current.snow_depth * 100) : null, days, source: "Open-Meteo (Marine, CAMS air quality, Forecast)" }; })); }));
api.get("/quakes/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(), a = AP[c]; if (!a) return res.status(404).json({ error: "Unknown airport" });
  res.json(await cached("eq1:" + c, 1800, async () => { const st = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const j = await getJSON(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${a.lat}&longitude=${a.lon}&maxradiuskm=300&starttime=${st}&minmagnitude=2.5&orderby=magnitude&limit=8`);
    return { iata: c, radiusKm: 300, days: 30, minMag: 2.5, total: j.metadata?.count ?? j.features.length, quakes: j.features.map(f => ({ mag: f.properties.mag, place: f.properties.place, time: f.properties.time, tsunami: !!f.properties.tsunami, km: Math.round(kmBetween(a, { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] })), url: f.properties.url })), source: "USGS Earthquake Hazards Program" }; })); }));
api.get("/airline-facts/:icao", wrap(async (req, res) => { const c = req.params.icao.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3); if (c.length !== 3) return res.status(400).json({ error: "ICAO code needed" });
  res.json(await cached("alf1:" + c, 14 * 86400, async () => {
    const b = await wdq(`SELECT ?a ?aLabel ?inc ?hubLabel ?allLabel ?hqLabel ?parLabel ?art WHERE { ?a wdt:P230 "${c}". OPTIONAL{?a wdt:P571 ?inc} OPTIONAL{?a wdt:P113 ?hub} OPTIONAL{?a wdt:P114 ?all} OPTIONAL{?a wdt:P159 ?hq} OPTIONAL{?a wdt:P749 ?par} OPTIONAL{?art schema:about ?a; schema:isPartOf <https://en.wikipedia.org/>} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 200`);
    if (!b.length) throw Object.assign(new Error("not in Wikidata"), { status: 404 });
    const q = b[0].a.value.split("/").pop(), r = b.filter(x => x.a.value.endsWith("/" + q)); const u = f => [...new Set(r.map(x => x[f]?.value).filter(Boolean))];
    return { icao: c, qid: q, name: u("aLabel")[0], founded: u("inc").sort()[0]?.slice(0, 4) || null, hubs: u("hubLabel").filter(x => !/^Q\d+$/.test(x)).slice(0, 8), alliance: u("allLabel")[0] || null, hq: u("hqLabel")[0] || null, parent: u("parLabel")[0] || null, wiki: u("art")[0] || null, source: "Wikidata " + q }; })); }));
api.get("/arrive/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(), a = AP[c]; if (!a) return res.status(404).json({ error: "Unknown airport" });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : new Date().toISOString().slice(0, 10); const days = Math.min(21, Math.max(1, +req.query.days || 7));
  const k = await codesOf(c).catch(() => null); const end = new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);
  const [fx, hol, sun, aq, adv] = await Promise.all([
    k?.cur && k.cur !== "GBP" ? cached("fx1:" + k.cur, 6 * 3600, () => getJSON(`https://api.frankfurter.dev/v1/latest?base=GBP&symbols=${k.cur}`)).then(j => j.rates?.[k.cur] ? { from: "GBP", to: k.cur, rate: j.rates[k.cur], date: j.date, source: "European Central Bank reference rate via Frankfurter" } : null).catch(() => null) : null,
    k?.iso ? Promise.all([...new Set([date.slice(0, 4), end.slice(0, 4)])].map(y => cached(`hol1:${k.iso}:${y}`, 7 * 86400, () => getJSON(`https://date.nager.at/api/v3/PublicHolidays/${y}/${k.iso}`)).catch(() => []))).then(L => L.flat().filter(h => h.date >= date && h.date <= end).map(h => ({ date: h.date, name: h.name, local: h.localName, national: h.global, regions: h.counties }))).catch(() => null) : null,
    cached(`sun1:${c}:${date}`, 86400, () => getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&daily=sunrise,sunset,daylight_duration&timezone=auto&start_date=${date}&end_date=${date}`)).then(j => j.daily?.sunrise ? { sunrise: j.daily.sunrise[0], sunset: j.daily.sunset[0], daylightH: Math.round(j.daily.daylight_duration[0] / 360) / 10, tz: j.timezone } : null).catch(() => null),
    cached(`aq1:${c}`, 3600, () => getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${a.lat}&longitude=${a.lon}&current=european_aqi,pm2_5,uv_index&daily=uv_index_max&timezone=auto`)).then(j => j.current ? { aqi: j.current.european_aqi, pm25: j.current.pm2_5, uv: j.current.uv_index, uvMax: j.daily?.uv_index_max?.[0] ?? null, at: j.current.time } : null).catch(() => null),
    k?.country && k.iso !== "GB" ? cached("fcdo1:" + k.country, 6 * 3600, () => getJSON(`https://www.gov.uk/api/content/foreign-travel-advice/${k.country.toLowerCase().replace(/^the /, "").replace(/[^a-z]+/g, "-")}`)).then(j => ({ title: j.title, updated: j.public_updated_at, change: j.details?.change_description || null, alerts: j.details?.alert_status || [], url: "https://www.gov.uk" + (j.base_path || "") })).catch(() => null) : null]);
  res.json({ iata: c, date, days, country: k?.country || null, iso: k?.iso || null, currency: k?.cur || null, fx, holidays: hol, sun, air: aq, advice: adv }); }));
api.get("/place/:iata", wrap(async (req, res) => { const r = await cached("place1:" + req.params.iata.toUpperCase(), 7 * 86400, () => resolvePlace(req.params.iata.toUpperCase())); if (!r) return res.status(404).json({ error: "Unknown airport" }); const p = r.place; res.json({ apCity: r.apCity, place: p && { qid: p.qid, label: p.label, island: p.island, coord: p.coord || null }, island: r.island && r.island.label, matched: r.matched, how: r.how, pop: r.pop }); }));
api.get("/dest/:iata", wrap(async (req, res) => { const c = req.params.iata.toUpperCase(); const g = await destGuide(c); if (!g) return res.status(404).json({ error: "Unknown airport" });
  const o = String(req.query.from || "").toUpperCase(); const al = {}; if (o) for (const k in HIST) for (const x of Object.values(HIST[k])) if (x.o === o && x.t === c) { const p = (k.match(/^[A-Z0-9]{2}(?=\d)|^[A-Z]{3}/) || [k.slice(0, 2)])[0]; (al[p] ||= new Set()).add(k); }
  res.json({ ...g, airlinesSeen: Object.entries(al).map(([code, s]) => ({ code, flights: [...s].slice(0, 6), n: s.size })).sort((a, b) => b.n - a.n), airlinesNote: "Seen in Skyline data (last 60 days of recorded boards), not a full schedule" }); }));
// ---- v42 Family sharing: read-only live link, no login. Token in Upstash (or memory when no KV), expires 4 h after landing (max 72 h). ----
const SHARES = new Map();
const shareKey = t => "sk_share_" + t;
async function shareGet(t) { if (KV_URL) return kvRead(shareKey(t)); return SHARES.get(t) || null; }
async function sharePut(t, v, ttlS) { if (KV_URL) { const r = await fetch(KV_URL.replace(/\/$/, "") + "/set/" + shareKey(t) + "?EX=" + Math.max(60, Math.round(ttlS)), { method: "POST", ...KVH(), body: JSON.stringify(v) }); return r.ok; } SHARES.set(t, v); setTimeout(() => SHARES.delete(t), ttlS * 1000).unref?.(); return true; }
api.post("/share", express.json({ limit: "2kb" }), wrap(async (req, res) => { const n = String(req.body?.number || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8), d = String(req.body?.date || "").slice(0, 10);
  if (!/^[A-Z0-9]{2,3}\d{1,5}[A-Z]?$/.test(n) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: "Need a flight number and date" });
  const t = crypto.randomBytes(12).toString("base64url"); const v = { number: n, date: d, name: String(req.body?.name || "").slice(0, 30), created: Date.now(), maxExp: Date.now() + 72 * 3600e3 };
  await sharePut(t, v, 72 * 3600); res.json({ token: t, expiresNote: "Expires 4 hours after landing (at most 72 hours)" }); }));
api.get("/share/:tok", wrap(async (req, res) => { const t = String(req.params.tok).replace(/[^A-Za-z0-9_-]/g, ""); const v = await shareGet(t); if (!v || Date.now() > v.maxExp) return res.status(410).json({ error: "This link has expired" });
  const f = await findFlight(v.number, v.date).catch(() => null); const fl = f?.flight || f?.flights?.[0] || f; const landed = fl?.arr?.actual; const exp = landed ? Math.min(v.maxExp, +new Date(landed) + 4 * 3600e3) : v.maxExp;
  if (Date.now() > exp) return res.status(410).json({ error: "This link has expired (the flight landed more than 4 hours ago)" });
  if (landed && !v.exp) { v.exp = exp; await sharePut(t, v, (exp - Date.now()) / 1000); }
  res.set("cache-control", "no-store").json({ flight: fl ? { number: fl.number, airline: fl.airline, origin: fl.origin, destination: fl.destination, dep: fl.dep, arr: fl.arr, status: fl.status, statusText: fl.statusText, aircraft: fl.aircraft, routeBlock: fl.routeBlock, date: v.date } : null, name: v.name, expires: new Date(exp).toISOString() }); }));
