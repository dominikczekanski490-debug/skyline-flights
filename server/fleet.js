import fs from "node:fs";
// v23 fleet log: sweeps Europe with free ADS-B (adsb.lol / airplanes.live / adsb.fi) and infers every aircraft's
// take-offs and landings, so we can list "what this plane flew today" for any registration. Inferred, so labelled.
const CENTERS = [[51.5, -0.5], [53.6, -4], [56, -3.5], [48.6, 2.4], [51.2, 7.5], [48.2, 12.5], [52.3, 13.5], [40.3, -3.7], [40.5, 2.5], [38.5, -8.5], [37, -4.5], [42, 12.5], [45.4, 9.2], [52.2, 20.5], [50, 18.5], [47.4, 19.2], [44.5, 26], [42.6, 23.4], [43.8, 17], [45.6, 15.5], [38.2, 23.6], [35.8, 25.5], [37.8, 20.5], [40.9, 29], [37, 29.5], [39.5, 33], [35, 33.3], [36, 14.4], [55.7, 12.6], [59.8, 10.8], [59.6, 17.9], [60.3, 24.9], [56.9, 24.1], [54.7, 25.3], [53.4, -6.3], [28.3, -15.5], [43.6, 5.2], [46.3, 6.6], [49.6, 6.2], [57.7, 11.9], [51, 4.4]];
const KEEP = 30 * 3600e3;
export function startFleet({ AP, adsb, STATE, snapFile }) {
  const F = new Map(); // hex -> { reg, type, cs, last, legs: [[from, depT, to, arrT, cs, flags]] }
  const aps = Object.values(AP).filter(a => a.iata && a.icao && /^[A-Z]{4}$/.test(a.icao) && a.lat > 20 && a.lat < 72 && a.lon > -30 && a.lon < 50);
  const grid = new Map(); const key = (la, lo) => `${Math.floor(la * 2)}:${Math.floor(lo * 2)}`;
  for (const a of aps) { const k = key(a.lat, a.lon); (grid.get(k) || grid.set(k, []).get(k)).push(a); }
  const km = (a, la, lo) => { const r = Math.PI / 180, x = (lo - a.lon) * r * Math.cos((la + a.lat) * r / 2), y = (la - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };
  const nearest = (la, lo, max) => { let b = null, bd = max; const gi = Math.floor(la * 2), gj = Math.floor(lo * 2); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const a of grid.get(`${gi + i}:${gj + j}`) || []) { const d = km(a, la, lo); if (d < bd) { bd = d; b = a; } } return b ? { a: b, d: bd } : null; };
  const proj = (la, lo, trk, nm) => { const r = Math.PI / 180, d = nm * 1.852 / 6371; return [la + Math.cos(trk * r) * d / r, lo + Math.sin(trk * r) * d / r / Math.cos(la * r)]; };
  // restore
  let src = STATE.fleet || {}, srcAt = STATE.fleetAt || 0; try { if (snapFile && fs.existsSync(snapFile)) { const j = JSON.parse(fs.readFileSync(snapFile, "utf8")); if ((j.at || 0) > srcAt) { src = j.fleet || {}; srcAt = j.at; } } } catch {}
  try { for (const [h, v] of Object.entries(src)) F.set(h, { reg: v[0], type: v[1], cs: v[2], last: v[4] || null, legs: v[3] || [] }); } catch {}
  const restored = { n: F.size, at: srcAt ? new Date(srcAt).toISOString() : null };
  const FOCUS = new Map(); // iata -> until (dense sampling around airports the resolver is asked about)
  function focus(iata) { const a = AP[iata]; if (a?.lat == null) return; FOCUS.delete(iata); FOCUS.set(iata, Date.now() + 30 * 60e3); while (FOCUS.size > 12) FOCUS.delete(FOCUS.keys().next().value); }
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
        if ((!fresh || prev.gnd) && alt < 16000 && s.vs >= 0) { const back = prev?.gnd && prev.ap ? null : proj(s.la, s.lo, (s.trk + 180) % 360, alt / 320); const n = prev?.gnd && prev.ap ? { a: AP[prev.ap] } : nearest(back[0], back[1], 25 + alt / 500); if (n) open(p, n.a.iata, prev?.gnd && prev.ap ? (prev.t + t) / 2 : t - (alt / 2200) * 60e3, cs, prev?.gnd ? "g" : "c"); }
        if (cs && p.cs && cs !== p.cs && fresh && !prev.gnd) { /* callsign change in flight: ignore */ }
        if (alt < 9000 && s.vs < -300) { const f = proj(s.la, s.lo, s.trk, alt / 320); const n = nearest(f[0], f[1], 20); s.app = n ? { ap: n.a.iata, t: t + (alt / 1500) * 60e3 } : null; } }
      p.cs = cs; p.last = s; }
  }
  function sweepTimeouts(now) { for (const [h, p] of F) { const s = p.last; if (s && !s.gnd && s.app && now - s.t > 12 * 60e3 && now - s.t < 40 * 60e3) { close(p, s.app.ap, s.app.t, "a"); s.app = null; }
    const L = p.legs[p.legs.length - 1]; if ((!L || now - (L[3] || L[1] || 0) > KEEP) && (!s || now - s.t > KEEP)) F.delete(h); else p.legs = p.legs.filter(l => now - (l[3] || l[1]) < KEEP); } }
  let i = 0, sweeps = 0;
  let fi = 0; async function tickFocus() { const now = Date.now(); for (const [k, u] of FOCUS) if (u < now) FOCUS.delete(k); const ks = [...FOCUS.keys()]; if (!ks.length) return; const a = AP[ks[fi++ % ks.length]]; try { const r = await adsb(`point/${a.lat}/${a.lon}/60`); ingest(Array.isArray(r) ? r : r?.list || r?.ac || [], Date.now()); focusSweeps++; } catch {} }
  let focusSweeps = 0; setTimeout(() => setInterval(tickFocus, +process.env.FOCUS_MS || 15000), 18000);
  async function tick() { const c = CENTERS[i++ % CENTERS.length]; try { const r = await adsb(`point/${c[0]}/${c[1]}/250`); ingest(Array.isArray(r) ? r : r?.list || r?.ac || [], Date.now()); sweeps++; } catch {} if (i % CENTERS.length === 0) sweepTimeouts(Date.now()); }
  setTimeout(() => { tick(); setInterval(tick, +process.env.FLEET_MS || 5000); }, 15000);
  function persist() { const o = {}; let n = 0; const now = Date.now(); for (const [h, p] of F) { const recent = p.last && now - p.last.t < 3 * 3600e3; if (p.legs.length || recent) { o[h] = [p.reg, p.type, p.cs, p.legs.slice(-8), recent ? { ...p.last, la: +p.last.la.toFixed(4), lo: +p.last.lo.toFixed(4) } : null]; n++; } } STATE.fleet = o; STATE.fleetAt = now;
    if (snapFile) { try { fs.writeFileSync(snapFile + ".tmp", JSON.stringify({ at: now, fleet: o })); fs.renameSync(snapFile + ".tmp", snapFile); } catch {} } return n; }
  setInterval(persist, 2 * 60e3);
  function legsFor({ hex, reg }) { let p = hex ? F.get(hex) : null; let h = hex; if (!p && reg) { const R = reg.replace(/-/g, "").toUpperCase(); for (const [k, v] of F) if ((v.reg || "").replace(/-/g, "").toUpperCase() === R) { p = v; h = k; break; } }
    if (!p) return null; const day0 = Date.now() - 24 * 3600e3;
    return { hex: h, reg: p.reg, type: p.type, cs: p.cs, now: p.last ? { gnd: p.last.gnd, ap: p.last.ap || null, alt: p.last.alt, at: new Date(p.last.t).toISOString() } : null,
      legs: p.legs.filter(l => (l[3] || l[1]) > day0).map(l => ({ from: l[0], dep: l[1] ? new Date(l[1]).toISOString() : null, to: l[2], arr: l[3] ? new Date(l[3]).toISOString() : null, cs: l[4], how: l[5] || "", conf: /c|a|u/.test(l[5] || "") ? "likely" : "observed" })) }; }
  const stats = () => ({ aircraft: F.size, withLegs: [...F.values()].filter(p => p.legs.length).length, legs: [...F.values()].reduce((s, p) => s + p.legs.length, 0), sweeps, areas: CENTERS.length, focusSweeps, focus: [...FOCUS.keys()], restored });
  // v27: every aircraft of an airline seen recently (callsign prefix), with where it is now — used by the plane resolver.
  function airlineNow(prefixes, maxAgeMs = 20 * 60e3) { const now = Date.now(), out = []; for (const [h, p] of F) { const s = p.last; if (!s || now - s.t > maxAgeMs || !p.cs) continue; if (!prefixes.some(x => p.cs.startsWith(x))) continue;
      const L = p.legs[p.legs.length - 1]; out.push({ hex: h, reg: p.reg, type: p.type, cs: p.cs, gnd: !!s.gnd, ap: s.ap || null, lat: s.la, lon: s.lo, alt: s.gnd ? "ground" : s.alt, gs: s.gs, track: s.trk, app: s.app?.ap || null, seenAgo: Math.round((now - s.t) / 1000), last: L ? { from: L[0], to: L[2], dep: L[1], arr: L[3] } : null }); } return out; }
  function legsOn(o, d, prefixes) { const out = []; for (const [h, p] of F) for (const l of p.legs) if (l[0] === o && l[2] === d && l[4] && prefixes.some(x => l[4].startsWith(x))) out.push({ hex: h, reg: p.reg, cs: l[4], dep: l[1], arr: l[3] }); return out; }
  function typeNow(type, maxAgeMs = 24 * 3600e3) { const now = Date.now(), ops = {}; let seen = 0, air = 0; for (const [h, p] of F) { const s = p.last; if (!s || now - s.t > maxAgeMs || p.type !== type) continue; seen++; if (!s.gnd) air++; const k = (p.cs || "").match(/^[A-Z]{3}(?=\d)/)?.[0] || "Other / private"; ops[k] = (ops[k] || 0) + 1; } return { seen, airborne: air, ops: Object.entries(ops).sort((a, b) => b[1] - a[1]).slice(0, 10) }; }
  // v56: type census and busiest airframes over the last 24 h (only what the feed saw).
  function census(maxAgeMs = 24 * 3600e3) { const now = Date.now(), T = {}; let n = 0; for (const [h, p] of F) { const s = p.last; if (!s || now - s.t > maxAgeMs || !p.type) continue; n++; const m = (T[p.type] ||= { n: 0, regs: [], ops: {} }); m.n++; if (m.regs.length < 3 && p.reg) m.regs.push(p.reg); const o = (p.cs || "").match(/^[A-Z]{3}(?=\d)/)?.[0]; if (o) m.ops[o] = (m.ops[o] || 0) + 1; } return { n, types: Object.entries(T).map(([k, m]) => ({ k, n: m.n, regs: m.regs, ops: Object.keys(m.ops).slice(0, 3) })) }; }
  function busiest(lim = 12) { const day0 = Date.now() - 24 * 3600e3, out = []; for (const [h, p] of F) { const L = p.legs.filter(l => l[0] && l[2] && l[3] && l[3] > day0); if (L.length >= 2) out.push({ hex: h, reg: p.reg, type: p.type, cs: p.cs, legs: L.length, path: [L[0][0], ...L.map(l => l[2])], likely: L.some(l => /c|a|u/.test(l[5] || "")) }); } return out.sort((a, b) => b.legs - a.legs).slice(0, lim); }
  return { legsFor, stats, persist, airlineNow, legsOn, focus, typeNow, census, busiest };
}
