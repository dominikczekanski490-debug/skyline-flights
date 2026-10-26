// v23 fleet log: sweeps Europe with free ADS-B (adsb.lol / airplanes.live / adsb.fi) and infers every aircraft's
// take-offs and landings, so we can list "what this plane flew today" for any registration. Inferred, so labelled.
const CENTERS = [[51.5, -0.5], [53.6, -4], [56, -3.5], [48.6, 2.4], [51.2, 7.5], [48.2, 12.5], [52.3, 13.5], [40.3, -3.7], [40.5, 2.5], [38.5, -8.5], [37, -4.5], [42, 12.5], [45.4, 9.2], [52.2, 20.5], [50, 18.5], [47.4, 19.2], [44.5, 26], [42.6, 23.4], [43.8, 17], [45.6, 15.5], [38.2, 23.6], [35.8, 25.5], [37.8, 20.5], [40.9, 29], [37, 29.5], [39.5, 33], [35, 33.3], [36, 14.4], [55.7, 12.6], [59.8, 10.8], [59.6, 17.9], [60.3, 24.9], [56.9, 24.1], [54.7, 25.3], [53.4, -6.3], [28.3, -15.5], [43.6, 5.2], [46.3, 6.6], [49.6, 6.2], [57.7, 11.9], [51, 4.4]];
const KEEP = 30 * 3600e3;
export function startFleet({ AP, adsb, STATE }) {
  const F = new Map(); // hex -> { reg, type, cs, last, legs: [[from, depT, to, arrT, cs, flags]] }
  const aps = Object.values(AP).filter(a => a.iata && a.icao && /^[A-Z]{4}$/.test(a.icao) && a.lat > 20 && a.lat < 72 && a.lon > -30 && a.lon < 50);
  const grid = new Map(); const key = (la, lo) => `${Math.floor(la * 2)}:${Math.floor(lo * 2)}`;
  for (const a of aps) { const k = key(a.lat, a.lon); (grid.get(k) || grid.set(k, []).get(k)).push(a); }
  const km = (a, la, lo) => { const r = Math.PI / 180, x = (lo - a.lon) * r * Math.cos((la + a.lat) * r / 2), y = (la - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };
  const nearest = (la, lo, max) => { let b = null, bd = max; const gi = Math.floor(la * 2), gj = Math.floor(lo * 2); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const a of grid.get(`${gi + i}:${gj + j}`) || []) { const d = km(a, la, lo); if (d < bd) { bd = d; b = a; } } return b ? { a: b, d: bd } : null; };
  const proj = (la, lo, trk, nm) => { const r = Math.PI / 180, d = nm * 1.852 / 6371; return [la + Math.cos(trk * r) * d / r, lo + Math.sin(trk * r) * d / r / Math.cos(la * r)]; };
  // restore
  try { for (const [h, v] of Object.entries(STATE.fleet || {})) F.set(h, { reg: v[0], type: v[1], cs: v[2], last: null, legs: v[3] || [] }); } catch {}
  const open = (p, from, t, cs, how) => { const L = p.legs[p.legs.length - 1]; if (L && L[3] == null && Math.abs(t - L[1]) < 25 * 60e3) return; if (L && L[3] == null && L[2] == null) L[5] = (L[5] || "") + "u"; p.legs.push([from, t, null, null, cs, how]); if (p.legs.length > 14) p.legs.shift(); };
  const close = (p, to, t, how) => { const L = p.legs[p.legs.length - 1]; if (L && L[3] == null && t > L[1] && L[0] !== to) { L[2] = to; L[3] = t; L[5] = (L[5] || "") + how; } else if (!L || L[3] != null) { if (L && L[2] === to && Math.abs(L[3] - t) < 40 * 60e3) return; p.legs.push([null, null, to, t, p.cs, how]); if (p.legs.length > 14) p.legs.shift(); } };
  function ingest(list, now) {
    for (const x of list) { if (!x.hex || x.lat == null) continue; const gnd = x.alt === "ground"; const alt = gnd ? 0 : +x.alt; if (!gnd && !isFinite(alt)) continue;
      let p = F.get(x.hex); if (!p) { if ((!x.reg && !x.type) || F.size > 30000) continue; p = { reg: x.reg, type: x.type, cs: null, last: null, legs: [] }; F.set(x.hex, p); }
      const cs = (x.flight || "").trim() || p.cs; const t = now - (x.seen || 0) * 1000; const prev = p.last; p.reg = x.reg || p.reg; p.type = x.type || p.type;
      const s = { t, la: x.lat, lo: x.lon, alt, gnd, vs: x.vs || 0, gs: x.gs || 0, trk: x.track || 0 };
      const fresh = prev && t - prev.t < 25 * 60e3;
      if (gnd || (alt < 1500 && s.gs < 80)) { const n = nearest(s.la, s.lo, 6); if (n && fresh && !prev.gnd && prev.alt > 0) close(p, n.a.iata, t, "g"); s.gnd = true; s.ap = n?.a.iata; }
      else { // airborne
        if ((!fresh || prev.gnd) && alt < 10000 && s.vs >= 0) { const back = prev?.gnd && prev.ap ? null : proj(s.la, s.lo, (s.trk + 180) % 360, alt / 320); const n = prev?.gnd && prev.ap ? { a: AP[prev.ap] } : nearest(back[0], back[1], 25); if (n) open(p, n.a.iata, prev?.gnd && prev.ap ? (prev.t + t) / 2 : t - (alt / 2200) * 60e3, cs, prev?.gnd ? "g" : "c"); }
        if (cs && p.cs && cs !== p.cs && fresh && !prev.gnd) { /* callsign change in flight: ignore */ }
        if (alt < 9000 && s.vs < -300) { const f = proj(s.la, s.lo, s.trk, alt / 320); const n = nearest(f[0], f[1], 20); s.app = n ? { ap: n.a.iata, t: t + (alt / 1500) * 60e3 } : null; } }
      p.cs = cs; p.last = s; }
  }
  function sweepTimeouts(now) { for (const [h, p] of F) { const s = p.last; if (s && !s.gnd && s.app && now - s.t > 12 * 60e3 && now - s.t < 40 * 60e3) { close(p, s.app.ap, s.app.t, "a"); s.app = null; }
    const L = p.legs[p.legs.length - 1]; if ((!L || now - (L[3] || L[1] || 0) > KEEP) && (!s || now - s.t > KEEP)) F.delete(h); else p.legs = p.legs.filter(l => now - (l[3] || l[1]) < KEEP); } }
  let i = 0, sweeps = 0;
  async function tick() { const c = CENTERS[i++ % CENTERS.length]; try { const r = await adsb(`point/${c[0]}/${c[1]}/250`); ingest(Array.isArray(r) ? r : r?.list || r?.ac || [], Date.now()); sweeps++; } catch {} if (i % CENTERS.length === 0) sweepTimeouts(Date.now()); }
  setTimeout(() => { tick(); setInterval(tick, +process.env.FLEET_MS || 5000); }, 15000);
  function persist() { const o = {}; let n = 0; for (const [h, p] of F) if (p.legs.length) { o[h] = [p.reg, p.type, p.cs, p.legs.slice(-8)]; n++; } STATE.fleet = o; return n; }
  setInterval(persist, 10 * 60e3);
  function legsFor({ hex, reg }) { let p = hex ? F.get(hex) : null; let h = hex; if (!p && reg) { const R = reg.replace(/-/g, "").toUpperCase(); for (const [k, v] of F) if ((v.reg || "").replace(/-/g, "").toUpperCase() === R) { p = v; h = k; break; } }
    if (!p) return null; const day0 = Date.now() - 24 * 3600e3;
    return { hex: h, reg: p.reg, type: p.type, cs: p.cs, now: p.last ? { gnd: p.last.gnd, ap: p.last.ap || null, alt: p.last.alt, at: new Date(p.last.t).toISOString() } : null,
      legs: p.legs.filter(l => (l[3] || l[1]) > day0).map(l => ({ from: l[0], dep: l[1] ? new Date(l[1]).toISOString() : null, to: l[2], arr: l[3] ? new Date(l[3]).toISOString() : null, cs: l[4], how: l[5] || "", conf: /c|a|u/.test(l[5] || "") ? "likely" : "observed" })) }; }
  const stats = () => ({ aircraft: F.size, withLegs: [...F.values()].filter(p => p.legs.length).length, legs: [...F.values()].reduce((s, p) => s + p.legs.length, 0), sweeps, areas: CENTERS.length });
  return { legsFor, stats, persist };
}
