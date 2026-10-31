// v60 — Play & Plan Stage B: read-only endpoints over the existing log (HIST) + airport/airline tables. No new state kept.
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const N = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const SRC = "Skyline's multi-day flight log (official airport boards)";
const summ = R => { const v = R.filter(r => r.s !== "cancelled" && typeof r.d === "number"); return { days: R.length, timed: v.length, on: v.length ? Math.round(v.filter(r => r.d < 15).length / v.length * 100) : null, median: med(v.map(r => r.d)) }; };
const apO = a => a && { iata: a.iata, city: a.city, name: a.name, lat: a.lat, lon: a.lon, tz: a.tz };
export function register(api, { HIST, AP, AL, cached }) {
  const rows = () => cached("v59rows", 300, async () => { const L = []; for (const [n, o] of Object.entries(HIST)) for (const [id, r] of Object.entries(o)) L.push({ n, date: id.slice(-10), ...r }); return L; });
  // Destinations from an airport, ranked by logged on-time share
  api.get("/play/dests", async (req, res) => { const o = N(req.query.o).slice(0, 3); const G = {}; (await rows()).filter(r => r.o === o && r.t).forEach(r => (G[r.t] ||= []).push(r));
    res.json({ o, oName: AP[o]?.city || null, list: Object.entries(G).map(([t, R]) => ({ t, city: AP[t]?.city || null, numbers: new Set(R.map(r => r.n)).size, ...summ(R) })), rule: "Every departure logged from this airport, grouped by destination. On time = left under 15 min late. Only destinations with at least your chosen number of logged flights are shown.", source: SRC }); });
  // Route + coordinates for a flight number (most common logged route)
  api.get("/play/where", async (req, res) => { const n = N(req.query.n); const C = {}; for (const r of Object.values(HIST[n] || {})) if (r.o && r.t) C[r.o + "-" + r.t] = (C[r.o + "-" + r.t] || 0) + 1;
    const k = Object.entries(C).sort((a, b) => b[1] - a[1])[0]?.[0]; if (!k) return res.json({ n, o: null }); const [o, t] = k.split("-"); res.json({ n, o: apO(AP[o]), t: apO(AP[t]), days: C[k], source: "Route from " + SRC + "; coordinates from OpenFlights" }); });
  // Beat the stats: hold out one random logged day of a flight, give the rest
  api.get("/play/guess", async (req, res) => { const ok = Object.entries(HIST).filter(([, o]) => Object.values(o).filter(r => typeof r.d === "number" && r.s !== "cancelled").length >= 4); if (!ok.length) return res.json({ n: null });
    const [n, o] = ok[Math.floor(Math.random() * ok.length)]; const R = Object.entries(o).map(([id, r]) => ({ date: id.slice(-10), ...r })).filter(r => typeof r.d === "number" && r.s !== "cancelled"); const i = Math.floor(Math.random() * R.length); const held = R[i], rest = R.filter((_, j) => j !== i);
    res.json({ n, o: held.o, t: held.t, date: held.date, actual: held.d, rest: summ(rest), pool: ok.length, rule: "The rule only sees the other logged days: if 50% or more of them left under 15 min late, it says On time, otherwise Late. The hidden day is then revealed.", source: SRC }); });
  // Airline pairs for the memory game: airlines that appear in the log
  api.get("/play/airlines", async (req, res) => { const c = {}; for (const n of Object.keys(HIST)) { const p = n.match(/^[A-Z0-9]{2}(?=\d)/)?.[0]; if (p && AL[p]?.name && AL[p].active) c[p] = (c[p] || 0) + 1; }
    const L = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([code]) => ({ code, name: AL[code].name })); res.json({ list: L, source: "Airline codes seen in Skyline's flight log; names from OpenFlights" }); });
}
