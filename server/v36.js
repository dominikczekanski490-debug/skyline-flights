// ACARS feed + decoder, Skyline's own "most tracked", trending live flights (ADS-B), popular routes from boards.
import crypto from "crypto";
const CAT = {
  oooi: "OOOI times: Out of the gate, Off the runway, On the runway, In at the gate. Airlines use these for timekeeping.",
  pos: "Position report: where the aircraft is, its altitude and often its ETA or fuel, sent automatically.",
  wx: "Weather: the crew or aircraft asked for (or received) airport weather such as METAR/TAF or ATIS.",
  text: "Free text: a readable message between crew and the airline's operations or dispatch.",
  ops: "Airline operations data: usually coded or encrypted airline data (engine, maintenance, load figures). Not decodable here.",
  link: "Link-layer frame: housekeeping between the radio and the ground station; carries no message text.",
  atc: "Air traffic control datalink (CPDLC / ADS-C): controller–pilot messages or automatic position contracts.",
};
const LBL = { QA: ["oooi", "OUT: left the gate"], QB: ["oooi", "OFF: took off"], QC: ["oooi", "ON: landed"], QD: ["oooi", "IN: arrived at the gate"], QE: ["oooi", "OUT with fuel"], QF: ["oooi", "OFF with destination"], QG: ["oooi", "OUT return"], QH: ["oooi", "OUT"], QK: ["oooi", "Landing report"], QL: ["oooi", "Arrival report"], QM: ["oooi", "Arrival info"], QN: ["oooi", "Diversion report"], QP: ["oooi", "OUT: left the gate"], QQ: ["oooi", "OFF: took off"], QR: ["oooi", "ON: landed"], QS: ["oooi", "IN: at the gate"], "10": ["oooi", "Out/Off event"], "11": ["oooi", "On/In event"], "12": ["oooi", "Out/Off/On/In"], "14": ["oooi", "ETA report"],
  "15": ["pos", "Position report"], "16": ["pos", "Position report"], "20": ["pos", "Delay report"], "21": ["pos", "Position + ETA"], "22": ["pos", "Position report"], "2Z": ["pos", "Progress report"], "44": ["pos", "Position + fuel"], "80": ["pos", "Position / OOOI"], "4N": ["ops", "Airline ops"], "4T": ["ops", "Airline ops"], "5Z": ["ops", "Airline ops"], "33": ["ops", "Arrival info"], "1L": ["ops", "Fuel / ops"],
  H2: ["wx", "Weather report"], A9: ["wx", "ATIS request"], B9: ["wx", "ATIS / D-ATIS"], "5Y": ["wx", "Weather request"], RB: ["wx", "Weather request"],
  AA: ["text", "Free text"], C1: ["text", "Crew message"], RA: ["text", "Uplink to cockpit printer"], SA: ["link", "Media advisory"], SQ: ["link", "Ground-station squitter"], "_d": ["link", "Link test (no text)"], Q0: ["link", "Link test"], B6: ["atc", "ADS-C / CPDLC"], BA: ["atc", "CPDLC"], H1: ["ops", "Datalink (crew/ops)"] };
const readable = t => { if (!t || t.length < 6) return false; const w = t.match(/\b[A-Za-z]{3,}\b/g) || []; const letters = (t.match(/[A-Za-z ]/g) || []).length; return w.length >= 3 && letters / t.length > 0.7; };
const OOOI_RX = /\b(OUT|OFF|ON|IN)\s*[:/ ]?\s*(\d{4})\b/g;
export function decode(m) {
  const text = (m.text || "").trim(); let [cat, what] = LBL[m.label] || [m.label ? "ops" : "link", m.label ? "Label " + m.label : "Link-layer frame"];
  if (/^(POS|#M1BPOS|\/POS)/.test(text) || (m.latitude != null && cat === "ops")) { cat = "pos"; what = "Position report"; }
  if (/METAR|TAF|ATIS|\bWX\b|RESREQ/.test(text) && cat !== "oooi") { cat = "wx"; what = /RESREQ/.test(text) ? "Data request" : "Weather"; }
  if (cat === "ops" && readable(text)) { cat = "text"; what = "Free text"; }
  const times = []; if (cat === "oooi") for (const x of text.matchAll(OOOI_RX)) times.push(x[1] + " " + x[2].slice(0, 2) + ":" + x[2].slice(2) + "Z");
  return { cat, what, explain: CAT[cat], times };
}
const ukStation = s => /-(EG|EI)[A-Z]{2}/.test(s || "");
const ukPos = m => m.latitude != null && m.latitude > 49 && m.latitude < 61.5 && m.longitude > -11 && m.longitude < 2.5;
export const slim = m => ({ t: m.timestamp, label: m.label || null, tail: m.tail || m.airframe?.tail || null, hex: (m.fromHex || m.airframe?.icao || "").toUpperCase() || null, flight: m.flightNumber || null, text: (m.text || "").trim().slice(0, 600) || null, station: m.station?.ident || null, kind: m.sourceType || null, dep: m.departingAirport || null, dst: m.destinationAirport || null, lat: m.latitude ?? null, lon: m.longitude ?? null, alt: m.altitude ?? null, up: m.linkDirection === "uplink", ...decode(m) });

export function register(api, { getJSON, cached, wrap, STATE, saveState, board, todayLondon, adsb }) {
  api.get("/acars-feed", wrap(async (req, res) => { const uk = req.query.scope !== "global";
    const raw = await cached("acarsfeed", 30, () => getJSON("https://api.airframes.io/messages?limit=300", { timeout: 12000 })).catch(e => ({ err: String(e.message || e) }));
    if (raw.err) return res.json({ source: "airframes.io", error: raw.err, messages: [] });
    const all = (Array.isArray(raw) ? raw : []).map(m => ({ ...slim(m), uk: ukStation(m.station?.ident) || ukPos(m) }));
    const L = all.filter(m => (!uk || m.uk) && (m.text || m.cat === "oooi"));
    const by = {}; all.forEach(m => by[m.cat] = (by[m.cat] || 0) + 1);
    res.json({ source: "airframes.io (volunteer ground stations)", fetched: new Date().toISOString(), scope: uk ? "uk" : "global", stats: { sampled: all.length, uk: all.filter(m => m.uk).length, withText: all.filter(m => m.text).length, byCat: by, from: all.at(-1)?.t, to: all[0]?.t }, cats: CAT, messages: L.slice(0, 120) });
  }));
  // Most tracked on Skyline: devices send a random anonymous token; we store only a salted hash per flight-day, counts shown at n>=2.
  const SALT = process.env.TRACK_SALT || "skyline-trk";
  api.post("/track-ping", wrap(async (req, res) => { const tok = String(req.body?.t || "").slice(0, 64); const keys = (req.body?.keys || []).slice(0, 40).map(String).filter(k => /^[A-Z0-9]{2,8}\|\d{4}-\d{2}-\d{2}$/.test(k));
    if (tok.length < 16) return res.status(400).json({ error: "token" }); const h = crypto.createHash("sha256").update(SALT + tok).digest("hex").slice(0, 16);
    const T = STATE.trk ||= {}; const today = todayLondon(); let ch = false;
    for (const k in T) if (k.split("|")[1] < new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)) { delete T[k]; ch = true; }
    for (const k of keys) { if (k.split("|")[1] < today) continue; const a = T[k] ||= []; if (!a.includes(h)) { a.push(h); ch = true; } }
    if (ch) saveState("core"); res.json({ ok: true }); }));
  api.get("/most-tracked", (req, res) => { const T = STATE.trk || {}; const today = todayLondon();
    const L = Object.entries(T).filter(([k]) => k.split("|")[1] >= today).map(([k, a]) => ({ number: k.split("|")[0], date: k.split("|")[1], n: a.length })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 20);
    res.json({ list: L, flightsTracked: Object.keys(T).length, note: "Counts of devices tracking each flight in Skyline. Not Flightradar24." }); });
  // Trending: notable aircraft airborne right now from ADS-B (adsb.lol). Military excluded.
  const TYPES = { A388: "Airbus A380", A3ST: "Airbus Beluga", A337: "Airbus BelugaXL", B748: "Boeing 747-8", B744: "Boeing 747-400", A124: "Antonov An-124", A225: "Antonov An-225", B742: "Boeing 747-200", DC10: "DC-10", MD11: "MD-11", CONC: "Concorde", A346: "Airbus A340-600", B77L: "Boeing 777F/LR" };
  api.get("/trending", wrap(async (req, res) => { res.json(await cached("trending", 60, async () => {
    const out = []; const add = (a, why, tag) => { if (!a || a.mil || a.alt === "ground" || !a.lat) return; if (out.some(x => x.hex === a.hex)) return; out.push({ hex: a.hex, cs: (a.flight || "").trim(), reg: a.reg, type: a.type, typeName: TYPES[a.type] || a.desc || a.type, alt: a.alt, gs: a.gs, lat: a.lat, lon: a.lon, why, tag }); };
    const rare = await Promise.all(Object.keys(TYPES).map(t => adsb("type/" + t).catch(() => [])));
    rare.forEach((L, i) => { const t = Object.keys(TYPES)[i]; L.filter(a => !a.mil && a.alt !== "ground").slice(0, t === "A388" || t === "B744" || t === "B748" ? 4 : 3).forEach(a => add(a, (TYPES[t]) + " airborne now", t === "A3ST" || t === "A337" ? "Rare" : "Big jet")); });
    const uk = (await adsb("point/54/-3/250").catch(() => [])).filter(a => !a.mil && typeof a.alt === "number");
    const hi = [...uk].sort((a, b) => b.alt - a.alt)[0]; add(hi, `Highest over the UK · ${hi?.alt} ft`, "Highest");
    const fa = [...uk].sort((a, b) => (b.gs || 0) - (a.gs || 0))[0]; add(fa, `Fastest over the UK · ${Math.round(fa?.gs || 0)} kt ground speed`, "Fastest");
    const sq = uk.filter(a => ["7700", "7600"].includes(a.squawk)); sq.forEach(a => add(a, `Squawking ${a.squawk} (${a.squawk === "7700" ? "general emergency" : "radio failure"})`, "Squawk"));
    return { list: out.slice(0, 30), source: "adsb.lol live ADS-B", fetched: new Date().toISOString(), ukSeen: uk.length };
  })); }));
  api.get("/popular-routes", wrap(async (req, res) => { res.json(await cached("poproutes:" + todayLondon(), 900, async () => {
    const APS = ["MAN", "LHR", "LGW", "STN", "BHX", "EDI", "DUB", "BRS", "GLA", "LTN"]; const C = {}; const used = [];
    await Promise.all(APS.map(async a => { try { const b = await Promise.race([board(a, "dep", todayLondon()), new Promise((_, r) => setTimeout(r, 20000))]); used.push(a); const seen = new Set();
      for (const f of b.flights || []) { const d = f.destination?.iata; if (!d) continue; const key = a + "-" + d + "-" + (f.times?.dep?.scheduled || f.dep?.scheduled || f.number); if (seen.has(key)) continue; seen.add(key); const k = a + "→" + d; (C[k] ||= { from: a, to: d, city: f.destination?.city, n: 0, airlines: new Set() }).n++; f.airline?.name && C[k].airlines.add(f.airline.name); } } catch {} }));
    const list = Object.values(C).sort((a, b) => b.n - a.n).slice(0, 20).map(x => ({ ...x, airlines: [...x.airlines].slice(0, 4) }));
    return { list, boards: used.sort(), note: "Departures scheduled today on these airport boards (codeshares counted once per departure time)." }; })); }));
}
