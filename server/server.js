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
  const a = { name: c[1], city: c[2], country: c[3], iata: c[4], icao: c[5], lat: +c[6], lon: +c[7], elev: +c[8] || 0, tz: c[11] };
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


// ---------- More official airport feeds (free, no key) ----------
// Avinor (Norway, 45 airports): documented open XML feed https://asrv.avinor.no/XmlFeed/v1.0
// Frankfurt (FRA): JSON endpoint used by frankfurt-airport.com's own public departures/arrivals board
// Sydney (SYD): JSON endpoint used by sydneyairport.com.au's own public flight board
const AVINOR = "OSL BGO TRD SVG TOS BOO AES KRS EVE HAU MOL KSU ALF BDU BJF BNN BVG FDE FRO HAA HFT HOV HVG KKN LKL LKN MEH MJF MQN OSY RET RRS RVK SDN SKN SOG SOJ SSJ SVJ VAW VDS VRY LYR ANX TRF".split(" ");
const getText = async (url, opt = {}) => { const r = await fetch(url, { ...opt, headers: { "user-agent": UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(20000) }); if (!r.ok) { const e = new Error(`${r.status} ${url.split("?")[0]}`); e.status = r.status; throw e; } return r.text(); };
const mkFlight = (apt, dir, otherIata, otherName, num, alCode, alName, t, statusText, status, source, extra = {}) => {
  const here = AP[apt], there = AP[otherIata] || { iata: otherIata, name: otherName, city: otherName };
  const side = { scheduled: t.sched, estimated: t.est, actual: t.act, gate: t.gate || undefined, terminal: t.term || undefined, ...(dir === "arr" ? { baggage: t.belt || undefined } : {}) };
  const id = `${num}-${(t.sched || "").slice(0, 10)}`;
  return { id, date: id.slice(-10), number: num, airline: { ...airlineOut(alCode), name: airlineOut(alCode).name || alName }, origin: airportOut(dir === "dep" ? here : there) || there, destination: airportOut(dir === "dep" ? there : here) || there,
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
const officialBoard = (apt, dir, ymd) => OFFICIAL[apt].fn(apt, dir, ymd);

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
api.get("/health", (q, r) => r.json({ ok: true, keys: { aerodatabox: !!cfg.aerodataboxKey }, magAirports: Object.keys(MAG_SITES), officialAirports: Object.keys(OFFICIAL) }));
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
api.get("/airport/:iata", (req, res) => { const a = AP[req.params.iata.toUpperCase()]; a ? res.json({ ...airportOut(a), sourceLabel: OFFICIAL[a.iata]?.label, boardSource: OFFICIAL[a.iata] ? "official" : cfg.aerodataboxKey ? "aerodatabox" : "live" }) : res.status(404).json({ error: "unknown airport" }); });
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
  if (OFFICIAL[iata]) { try { return { flights: await officialBoard(iata, dir, ymd), source: OFFICIAL[iata].label, sourceKind: "official", provider: OFFICIAL[iata].provider, site: OFFICIAL[iata].site }; } catch (e) { console.warn("official feed failed", iata, e.message); } }
  const liveOnly = async () => ({ flights: ymd === todayLondon() ? await liveBoard(iata, dir) : [], source: "Live traffic only (ADS-B) — add AeroDataBox key for schedules", sourceKind: "live", provider: "Live ADS-B (adsb.lol / adsb.fi)", liveOnly: true });
  if (!cfg.aerodataboxKey) return liveOnly();
  const d = londonDay(ymd); const out = [];
  try { for (const [a, b] of [[0, 12], [12, 24]]) {
    const f = new Date(+new Date(d.start) + a * 3600e3).toISOString().slice(0, 16), t = new Date(+new Date(d.start) + b * 3600e3 - 60e3).toISOString().slice(0, 16);
    const r = await adb(`/flights/airports/iata/${iata}/${f}/${t}?direction=${dir === "dep" ? "Departure" : "Arrival"}&withCodeshared=false&withCancelled=true&withLeg=true`, ymd < todayLondon() ? 21600 : 120);
    out.push(...(r[dir === "dep" ? "departures" : "arrivals"] || []).map(normAdb));
  } } catch { return liveOnly(); }
  return { flights: out, source: "AeroDataBox", sourceKind: "aerodatabox", provider: "AeroDataBox (your key)" };
}
api.get("/board/:iata", wrap(async (req, res) => { const iata = req.params.iata.toUpperCase(); const dir = req.query.dir === "arr" ? "arr" : "dep";
  const b = await board(iata, dir, String(req.query.date || todayLondon())); const a = AP[iata];
  const [wx, st] = await Promise.all([a ? wxCached(a.lat, a.lon).catch(() => null) : null, dir === "dep" ? boardStats(iata) : null]);
  for (const f of b.flights) { if (["landed", "departed", "cancelled"].includes(f.status)) continue; const t = dir === "dep" ? f.dep.scheduled : f.arr.scheduled;
    const p = predictCore(f, dir === "dep" ? { wxDep: wxAt(wx, t), aptStats: st } : { wxArr: wxAt(wx, t) }); f.pred = { d: p.predictedDelay, on: p.probs.onTime, c: p.confidence, top: p.top, summary: p.summary, factors: p.factors.slice(0, 4) }; }
  res.json({ airport: airportOut(a), dir, ...b }); }));


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
  if (cs) { const live = await liveByCallsign(cs).catch(() => null); if (live) { result.live = live; result.sources.push(live.source); } }
  if (!result.live && result.flight && result.flight.status === "departed" && !result.flight.arr?.actual) { const lv = await routeMatch({ ...result.flight, date: ymd }).catch(() => null); if (lv) { result.live = lv; result.sources.push("adsb.lol (route match)"); } }
  const F = result.flight, L = result.live;
  if (F && L?.lat != null && F.destination?.lat) { const rem = nm(L, F.destination), tot = nm(F.origin || L, F.destination);
    L.remainingNm = Math.round(rem); L.progress = tot ? Math.max(0, Math.min(100, Math.round((1 - rem / tot) * 100))) : null;
    if (typeof L.alt === "number" && L.gs > 80) { L.eta = new Date(Date.now() + (rem / L.gs + 8 / 60) * 3600e3).toISOString(); if (!F.arr?.actual) { F.arr = { ...F.arr, estimated: F.arr?.estimated || L.eta, etaSource: "ADS-B (distance ÷ ground speed + 8 min approach)" }; } if (["departed", "scheduled", "delayed", "boarding", "gate"].includes(F.status)) { F.status = "enroute"; F.statusText = "En route"; } }
    else if (L.alt === "ground" && rem < 8 && F.status !== "landed") { F.status = "landed"; F.statusText = "Landed (ADS-B: on the ground at " + F.destination.iata + ")"; } }
  if (result.flight && !result.flight.date) result.flight.date = ymd;
  return result;
}
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
const wxNow = a => cached(`wxnow:${a.iata}`, 600, async () => { const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day&wind_speed_unit=kn`); const c = j.current || {};
  return { temp: c.temperature_2m, windKts: c.wind_speed_10m != null ? Math.round(c.wind_speed_10m) : null, windDir: c.wind_direction_10m, code: c.weather_code, isDay: c.is_day }; });
api.get("/disruptions", wrap(async (req, res) => {
  const out = await cached("disruptions:" + !!cfg.aerodataboxKey + ":" + Object.keys(LIVEC).length, 600, async () => { const codes = Object.values(STATUS_AIRPORTS).flat().filter(c => AP[c]);
    const rows = await Promise.all(codes.map(async c => { const ap = AP[c]; if (!ap) return null; const a = airportOut(ap); let wx = null; try { wx = await wxNow(ap); } catch {}
      try {
        if (OFFICIAL[c]) { const ymd = todayLondon(); const [d, r] = await Promise.all([officialBoard(c, "dep", ymd), officialBoard(c, "arr", ymd)]); return { airport: a, wx, dep: disruptFrom(d), arr: disruptFrom(r), source: "Official airport board" }; }
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
import crypto from "crypto";
// VAPID keys MUST stay stable across restarts, otherwise every iPhone subscription silently dies (DATA_DIR is /tmp on Render).
// Priority: VAPID_PUBLIC/VAPID_PRIVATE env → keys derived deterministically from a stable server-side secret → stored/generated.
function deriveVapid() { const seed = process.env.VAPID_SEED || process.env.SKYLINE_ADMIN || process.env.RENDER_SERVICE_ID; if (!seed) return null;
  const priv = crypto.createHash("sha256").update("skyline-vapid-v1:" + seed).digest(); const ec = crypto.createECDH("prime256v1"); ec.setPrivateKey(priv);
  return { publicKey: ec.getPublicKey().toString("base64url"), privateKey: priv.toString("base64url"), derived: true }; }
const VAPID_SUBJECT = /^(mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}|https:\/\/[^\s]+)$/i.test(process.env.VAPID_SUBJECT || "") ? process.env.VAPID_SUBJECT : "https://skyline-flights.onrender.com"; // Apple 403s BadJwtToken on bad/example subjects
let vapidSource = "";
const PUSHLOG = []; const plog = (...a) => { const line = new Date().toISOString() + " " + a.join(" "); console.log("[push]", line); PUSHLOG.unshift(line); PUSHLOG.length = Math.min(PUSHLOG.length, 40); };
const ready = loadState().then(() => {
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
  const id = subId(sub.endpoint); const prev = STATE.subs[id]?.flights || []; const flights = Array.isArray(req.body.flights) ? req.body.flights : prev;
  STATE.subs[id] = { ...(STATE.subs[id] || {}), sub, at: Date.now(), prefs: req.body.prefs || STATE.subs[id]?.prefs || null, flights: flights.slice(0, 30).map(f => { const o = prev.find(p => p.number === f.number && p.date === f.date); return { number: String(f.number).toUpperCase(), date: f.date, snap: o?.snap || f.snap || null }; }) };
  if (!prev.length && !STATE.subs[id].lastOk) plog("subscribed", pushHost(sub.endpoint)); saveState(); res.json({ ok: true, watching: STATE.subs[id].flights.length }); }));
api.post("/push/test", wrap(async (req, res) => { await ready; const id = subId(req.body?.endpoint); const s = STATE.subs[id];
  if (!s) return res.status(404).json({ error: "Server has no subscription for this device (it may have restarted). Tap Turn on alerts again." });
  const r = await sendPush(id, s, { title: "Skyline notifications are on ✓", body: `Watching ${s.flights.length} flight${s.flights.length === 1 ? "" : "s"} for gate, delay and cancellation changes.`, tag: "skyline-test", url: "/" }, { TTL: 600 });
  if (r.ok) return res.json({ ok: true, status: r.status, host: pushHost(s.sub.endpoint) });
  res.status(502).json({ error: `Push service ${pushHost(s.sub.endpoint)} rejected it: ${r.status} ${r.error}${r.status === 404 || r.status === 410 ? " (subscription expired — tap Turn on alerts again)" : ""}`, status: r.status }); }));
const snapOf = f => ({ status: f.status, statusText: f.statusText, gate: f.dep?.gate || null, term: f.dep?.terminal || null, belt: f.arr?.baggage || null, dly: delayMin(f) });
function diff(a, b, f) { const m = []; if (!a) return m;
  if (b.status === "cancelled" && a.status !== "cancelled") m.push("❌ Cancelled");
  if (b.gate && b.gate !== a.gate) m.push(`🚪 Gate ${a.gate ? a.gate + " → " : ""}${b.gate}`);
  if (b.term && a.term && b.term !== a.term) m.push(`Terminal ${a.term} → ${b.term}`);
  if (b.dly != null && (a.dly ?? 0) + 10 <= b.dly && b.dly >= 15) m.push(`⏱ Now ${b.dly} min late`);
  if (b.dly != null && a.dly != null && a.dly >= 15 && b.dly <= a.dly - 15) m.push(`✅ Delay reduced to ${Math.max(0, b.dly)} min`);
  if (b.belt && b.belt !== a.belt) m.push(`🧳 Baggage belt ${b.belt}`);
  if (b.status !== a.status && ["departed", "enroute", "landed", "diverted", "boarding"].includes(b.status) && !(a.status === "enroute" && b.status === "departed") && !(a.status === "departed" && b.status === "enroute")) m.push(b.status === "enroute" ? "Departed, now en route" : b.statusText || b.status);
  return m; }
// prefs: { events: { cancel, gate, delay, belt, status }: bool, quiet: { on, from: "22:00", to: "07:00", tz } } — cancellations always break quiet hours
function filterPrefs(m, p) { if (!p || !m.length) return m; const ev = p.events || {}; const kind = x => x.startsWith("❌") ? "cancel" : x.startsWith("🚪") || x.startsWith("Terminal") ? "gate" : x.startsWith("⏱") || x.startsWith("✅") ? "delay" : x.startsWith("🧳") ? "belt" : "status";
  let out = m.filter(x => ev[kind(x)] !== false);
  if (p.quiet?.on && p.quiet.from && p.quiet.to) { const hm = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: p.quiet.tz || "Europe/London" });
    const q = p.quiet.from <= p.quiet.to ? hm >= p.quiet.from && hm < p.quiet.to : hm >= p.quiet.from || hm < p.quiet.to; if (q) out = out.filter(x => kind(x) === "cancel"); }
  return out; }
async function watch() { await ready; const cache = {};
  for (const [id, s] of Object.entries(STATE.subs)) { const keep = [];
    for (const w of s.flights) { if (w.date < new Date(Date.now() - 36 * 3600e3).toISOString().slice(0, 10)) continue; keep.push(w);
      try { const k = w.number + w.date; const r = cache[k] ||= await findFlight(w.number, w.date); if (!r.flight) continue; const n = snapOf(r.flight); const msg = filterPrefs(diff(w.snap, n, r.flight), s.prefs); w.snap = n;
        if (msg.length) await sendPush(id, s, { title: `${r.flight.number} ${r.flight.origin?.iata || ""}→${r.flight.destination?.iata || ""}`, body: msg.join(" • "), tag: k, url: "/" }, { topic: k.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) });
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
const slimAc = a => ({ hex: a.hex, flight: (a.flight || "").trim(), reg: a.r, type: a.t, desc: a.desc, alt: a.alt_baro, gs: a.gs, track: a.track, lat: a.lat, lon: a.lon, squawk: a.squawk, emergency: a.emergency, mil: !!(a.dbFlags & 1), vs: a.baro_rate, seen: a.seen });
let ADQ = Promise.resolve(); const adq = fn => { const p = ADQ.then(fn); ADQ = p.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100))); return p; }; // adsb.lol allows ~1 req/s
const adsb = p => cached("adsb:" + p, 20, () => adq(() => getJ("https://api.adsb.lol/v2/" + p)).catch(() => getJ("https://api.airplanes.live/v2/" + p))).then(j => (j.ac || []).map(slimAc));
api.get("/squawks", wrap(async (req, res) => { const out = []; for (const s of ["7500", "7600", "7700"]) out.push(...(await adsb("sqk/" + s)).map(a => ({ ...a, code: s }))); res.json({ list: out, at: Date.now(), source: "adsb.lol" }); }));
api.get("/mil", wrap(async (req, res) => res.json({ list: (await adsb("mil")).filter(a => a.lat).slice(0, 300), source: "adsb.lol" })));
api.get("/overhead", wrap(async (req, res) => { const lat = +req.query.lat, lon = +req.query.lon, r = Math.min(250, +req.query.r || 25); if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: "lat/lon required" });
  const l = (await adsb(`point/${lat.toFixed(3)}/${lon.toFixed(3)}/${r}`)).filter(a => a.lat).map(a => ({ ...a, nm: Math.round(hav({ lat, lon }, a) / 1.852 * 10) / 10 })).sort((a, b) => a.nm - b.nm); res.json({ list: l, source: "adsb.lol" }); }));
api.get("/aircraft/:q", wrap(async (req, res) => { const q = req.params.q.toUpperCase().replace(/[^A-Z0-9-]/g, ""); const isHex = /^[0-9A-F]{6}$/.test(q);
  const db = await cached("adsbdb:" + q, 86400, () => getJ("https://api.adsbdb.com/v0/aircraft/" + q).then(j => j.response?.aircraft || null).catch(() => null));
  const live = await adsb((isHex ? "hex/" : "reg/") + q).catch(() => []);
  res.json({ q, info: db, live: live[0] || null, source: "adsbdb.com + adsb.lol" }); }));
api.get("/callsign/:cs", wrap(async (req, res) => { const c = req.params.cs.toUpperCase().replace(/[^A-Z0-9]/g, "");
  res.json({ route: await cached("cs:" + c, 3600, () => getJ("https://api.adsbdb.com/v0/callsign/" + c).then(j => j.response?.flightroute || null).catch(() => null)), source: "adsbdb.com" }); }));
api.get("/airlines/search", (req, res) => { const q = String(req.query.q || "").toLowerCase().trim(); if (!q) return res.json([]);
  res.json(Object.values(AL_ICAO).filter(a => (a.iata || "").toLowerCase() === q || (a.icao || "").toLowerCase() === q || (a.callsign || "").toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q)).slice(0, 30)); });
api.get("/fx", wrap(async (req, res) => { const b = String(req.query.base || "GBP").toUpperCase().replace(/[^A-Z]/g, ""); res.json({ ...(await cached("fx:" + b, 3600, () => getJ("https://api.frankfurter.dev/v1/latest?base=" + b))), source: "Frankfurter (ECB reference rates)" }); }));

app.use("/api", api);
const dist = path.join(__dir, "../web/dist");
app.use(express.static(dist, { setHeaders: (r, p) => { if (p.endsWith("sw.js") || p.endsWith(".html") || p.endsWith("version.json")) r.setHeader("cache-control", "no-cache"); } }));
app.get(/^\/(?!api).*/, (q, r) => r.sendFile(path.join(dist, "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log("Skyline on :" + PORT));
