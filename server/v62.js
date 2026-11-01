// v62 — Play & Plan Stage D: read-only endpoints over HIST + AP. Reuses v59rows/v61byO caches; small cached outputs only.
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const N = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const SRC = "Skyline's multi-day flight log (official airport boards)";
const ok = r => r.s !== "cancelled" && typeof r.d === "number";
const onp = R => R.length ? Math.round(R.filter(r => ok(r) && r.d < 15).length / R.length * 100) : null;
export function register(api, { HIST, AP, cached }) {
  const rows = () => cached("v59rows", 300, async () => { const L = []; for (const [n, o] of Object.entries(HIST)) for (const [id, r] of Object.entries(o)) L.push({ n, date: id.slice(-10), ...r }); return L; });
  const routes = () => cached("v62routes", 300, async () => { const G = {}; (await rows()).forEach(r => { if (!r.o || !r.t) return; const k = r.o + "-" + r.t; (G[k] ||= { o: r.o, t: r.t, n: 0, good: 0 }); G[k].n++; if (ok(r) && r.d < 15) G[k].good++; }); return G; });
  const outOf = async o => Object.values(await routes()).filter(x => x.o === o);
  api.get("/play/from", async (req, res) => { const t = N(req.query.t).slice(0, 3); const list = Object.values(await routes()).filter(x => x.t === t && x.n >= 5).map(x => ({ o: x.o, city: AP[x.o]?.city || null, n: x.n, on: Math.round(x.good / x.n * 100) })).sort((p, q) => q.on - p.on || q.n - p.n);
    res.json({ t, city: AP[t]?.city || null, list, rule: "Every airport Skyline logged 5+ departures from to your destination. Ranked by on-time share (under 15 min late); ties go to the airport with more logged flights. More flights logged = a more trustworthy number.", source: SRC }); });
  api.get("/play/meet", async (req, res) => { const a = N(req.query.a).slice(0, 3), b = N(req.query.b).slice(0, 3); const A = await outOf(a), B = await outOf(b); const mb = Object.fromEntries(B.map(x => [x.t, x]));
    const list = A.filter(x => mb[x.t] && x.t !== a && x.t !== b).map(x => { const y = mb[x.t]; const p1 = x.good / x.n, p2 = y.good / y.n; return { k: x.t, city: AP[x.t]?.city || null, na: x.n, nb: y.n, onA: Math.round(p1 * 100), onB: Math.round(p2 * 100), both: Math.round(p1 * p2 * 100) }; }).sort((p, q) => q.both - p.both);
    res.json({ a, b, list, rule: "A meeting place is any airport Skyline logged flights to from BOTH of your airports. Score = chance both of you leave on time = your route's on-time share × your friend's route's on-time share.", source: SRC }); });
  api.get("/play/days", async (req, res) => { const a = N(req.query.a).slice(0, 3); const D = {}; (await rows()).forEach(r => { if (r.o === a) (D[r.date] ||= []).push(r); });
    const L = Object.entries(D).filter(([, R]) => R.length >= 20).map(([date, R]) => ({ date, n: R.length, on: onp(R), cx: R.filter(r => r.s === "cancelled").length })).sort((p, q) => p.date.localeCompare(q.date));
    const m = L.length ? L.reduce((t, x) => t + x.on, 0) / L.length : 0, sd = L.length > 1 ? Math.sqrt(L.reduce((t, x) => t + (x.on - m) ** 2, 0) / (L.length - 1)) : 0;
    res.json({ a, city: AP[a]?.city || null, mean: Math.round(m), sd: +sd.toFixed(1), list: L.map(x => ({ ...x, z: sd ? +((x.on - m) / sd).toFixed(2) : 0 })), rule: "For each day with 20+ logged departures: on-time share (under 15 min late). z = (that day − the airport's average day) ÷ standard deviation. z below −1 = a bad day, above +1 = a great day.", source: SRC }); });
  api.get("/play/day", async (req, res) => { const a = N(req.query.a).slice(0, 3), d = String(req.query.date || "").slice(0, 10); const R = (await rows()).filter(r => r.o === a && r.date === d);
    res.json({ a, date: d, worst: R.filter(ok).sort((p, q) => q.d - p.d).slice(0, 5).map(r => ({ n: r.n, t: r.t, d: r.d })), cx: R.filter(r => r.s === "cancelled").map(r => r.n).slice(0, 8), source: SRC }); });
  api.get("/play/sib", async (req, res) => { const n = N(req.query.n); const R = Object.values(HIST[n] || {}); if (!R.length) return res.json({ n, me: null, list: [] }); const o = R[R.length - 1].o, al = n.replace(/\d.*$/, "");
    const G = {}; (await rows()).forEach(r => { if (r.o === o && r.n.replace(/\d.*$/, "") === al) (G[r.n] ||= []).push(r); });
    const list = Object.entries(G).filter(([, X]) => X.length >= 3).map(([k, X]) => ({ n: k, t: X[X.length - 1].t, days: X.length, on: onp(X), med: med(X.filter(ok).map(r => r.d)) })).sort((p, q) => q.on - p.on || (p.med ?? 999) - (q.med ?? 999));
    res.json({ n, o, al, city: AP[o]?.city || null, me: list.find(x => x.n === n) || null, rank: list.findIndex(x => x.n === n) + 1, list, rule: "Compares your flight with every other flight number of the same airline code leaving the same airport (3+ logged days each). Ranked by on-time share (under 15 min late), ties broken by smaller typical delay.", source: SRC }); });
}
