// v61 — Play & Plan Stage C: read-only endpoints over HIST + AP. No new state (reuses the shared 300 s rows cache).
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const N = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const SRC = "Skyline's multi-day flight log (official airport boards)";
const timed = R => R.filter(r => r.s !== "cancelled" && typeof r.d === "number");
const prof = R => { const v = timed(R), d = v.map(r => r.d); return { n: R.length, on: v.length ? Math.round(v.filter(r => r.d < 15).length / v.length * 100) : null, median: med(d), cx: R.length ? +(R.filter(r => r.s === "cancelled").length / R.length * 100).toFixed(1) : null, big: v.length ? Math.round(v.filter(r => r.d >= 60).length / v.length * 100) : null }; };
export function register(api, { HIST, AP, cached }) {
  const rows = () => cached("v59rows", 300, async () => { const L = []; for (const [n, o] of Object.entries(HIST)) for (const [id, r] of Object.entries(o)) L.push({ n, date: id.slice(-10), ...r }); return L; });
  const byO = () => cached("v61byO", 300, async () => { const G = {}; (await rows()).forEach(r => r.o && (G[r.o] ||= []).push(r)); return G; });
  // Airport twins: nearest neighbour on (on-time %, median, 60+ share)
  api.get("/play/twins", async (req, res) => { const a = N(req.query.a).slice(0, 3); const G = await byO(); const P = Object.entries(G).filter(([, R]) => R.length >= 50).map(([k, R]) => ({ k, city: AP[k]?.city || null, ...prof(R) }));
    const me = P.find(x => x.k === a); if (!me) return res.json({ a, me: null, pool: P.length, list: [] });
    const w = { on: 1, median: 2, big: 1 }; const dist = x => Math.sqrt((x.on - me.on) ** 2 * w.on + (x.median - me.median) ** 2 * w.median + (x.big - me.big) ** 2 * w.big);
    res.json({ a, me, pool: P.length, list: P.filter(x => x.k !== a).map(x => ({ ...x, dist: +dist(x).toFixed(1) })).sort((p, q) => p.dist - q.dist), rule: "Each airport with 50+ logged departures gets three numbers: on-time share, typical (median) delay and share 60+ min late. Twin score = distance between those numbers (median counts double). Smaller = more alike.", source: SRC }); });
  // Delay detective: a flight's daily delay vs its airport's median that day
  api.get("/play/chain", async (req, res) => { const n = N(req.query.n); const G = await byO(); const R = Object.entries(HIST[n] || {}).map(([id, r]) => ({ date: id.slice(-10), ...r })).sort((a, b) => a.date.localeCompare(b.date));
    const list = R.map(r => { const day = timed((G[r.o] || []).filter(x => x.date === r.date)); return { date: r.date, o: r.o, t: r.t, d: r.s === "cancelled" ? null : r.d, s: r.s, apMed: med(day.map(x => x.d)), apN: day.length }; });
    res.json({ n, list, rule: "For each logged day: the flight's departure delay minus the median delay of every departure logged from the same airport that day. 15+ min more than the airport = mostly the flight's own problem; within 15 min = the whole airport was like that.", source: SRC }); });
  // Network for the route explorer + map quiz: airports with coordinates and routes
  api.get("/play/net", async (req, res) => { const out = await cached("v61net", 300, async () => { const E = {}; const C = {}; (await rows()).forEach(r => { if (!r.o || !r.t || !AP[r.o]?.lat || !AP[r.t]?.lat) return; const k = r.o + "-" + r.t; E[k] = (E[k] || 0) + 1; C[r.o] = (C[r.o] || 0) + 1; C[r.t] = (C[r.t] || 0) + 1; });
      const keep = new Set(Object.entries(C).sort((a, b) => b[1] - a[1]).slice(0, 90).map(([k]) => k));
      return { aps: [...keep].map(k => ({ k, city: AP[k].city, country: AP[k].country, lat: +AP[k].lat.toFixed(2), lon: +AP[k].lon.toFixed(2), n: C[k] })), routes: Object.entries(E).filter(([k]) => keep.has(k.slice(0, 3)) && keep.has(k.slice(4))).map(([k, n]) => [k.slice(0, 3), k.slice(4), n]) }; });
    res.json({ ...out, source: SRC + "; coordinates from OpenFlights" }); });
  // Daily challenge: same 3 questions for everyone on a given date (seeded)
  api.get("/play/daily", async (req, res) => { const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? String(req.query.date) : new Date().toISOString().slice(0, 10);
    const out = await cached("v61daily:" + day, 3600, async () => { let s = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7); const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; const G = await byO();
      const ap = Object.entries(G).filter(([k, R]) => R.length >= 80 && AP[k]?.city).map(([k, R]) => ({ k, city: AP[k].city, ...prof(R) })); if (ap.length < 4) return { qs: [] };
      const pick = n => { const c = [...ap]; const o = []; while (o.length < n) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
      const distinct = k => { for (let t = 0; t < 30; t++) { const o = pick(3); if (new Set(o.map(x => x[k])).size === 3) return o; } return null; };
      const qs = [["Which airport is most on time?", "on", 1], ["Which airport has the most departures logged?", "n", 1], ["Which airport has the biggest typical delay?", "median", 1]].map(([q, k]) => { const o = distinct(k); if (!o) return null; const best = o.reduce((a, b) => (b[k] > a[k] ? b : a)); return { q, k, opts: o.map(x => ({ k: x.k, city: x.city, v: x[k] })), ans: best.k }; }).filter(Boolean);
      return { qs }; });
    res.json({ day, ...out, source: SRC }); });
}
