// Your Own Airline: a pure, seeded airline business sim. Airport codes and coordinates are real (used only for distances);
// aircraft are generic size classes and every price, demand and delay number is a made-up game number.
import type { Livery } from "./myair";
export type Apt = { c: string; n: string; lat: number; lon: number; sz: number };
export const APTS: Apt[] = [
  { c: "MAN", n: "Manchester", lat: 53.354, lon: -2.275, sz: 4 }, { c: "KTW", n: "Katowice", lat: 50.474, lon: 19.08, sz: 2 }, { c: "LHR", n: "London Heathrow", lat: 51.47, lon: -.454, sz: 5 }, { c: "DUB", n: "Dublin", lat: 53.421, lon: -6.27, sz: 4 },
  { c: "AMS", n: "Amsterdam", lat: 52.31, lon: 4.768, sz: 5 }, { c: "CDG", n: "Paris CDG", lat: 49.01, lon: 2.55, sz: 5 }, { c: "BCN", n: "Barcelona", lat: 41.297, lon: 2.083, sz: 4 }, { c: "AGP", n: "Málaga", lat: 36.675, lon: -4.499, sz: 3 },
  { c: "PMI", n: "Palma", lat: 39.552, lon: 2.739, sz: 3 }, { c: "FAO", n: "Faro", lat: 37.017, lon: -7.966, sz: 3 }, { c: "ALC", n: "Alicante", lat: 38.282, lon: -.558, sz: 3 }, { c: "TFS", n: "Tenerife South", lat: 28.044, lon: -16.572, sz: 3 },
  { c: "FCO", n: "Rome", lat: 41.8, lon: 12.239, sz: 4 }, { c: "ATH", n: "Athens", lat: 37.936, lon: 23.947, sz: 4 }, { c: "IST", n: "Istanbul", lat: 41.262, lon: 28.727, sz: 5 }, { c: "WAW", n: "Warsaw", lat: 52.166, lon: 20.967, sz: 4 },
  { c: "KRK", n: "Kraków", lat: 50.078, lon: 19.785, sz: 3 }, { c: "GDN", n: "Gdańsk", lat: 54.378, lon: 18.466, sz: 2 }, { c: "OSL", n: "Oslo", lat: 60.194, lon: 11.1, sz: 3 }, { c: "KEF", n: "Reykjavík", lat: 63.985, lon: -22.605, sz: 2 },
  { c: "PRG", n: "Prague", lat: 50.101, lon: 14.26, sz: 3 }, { c: "BER", n: "Berlin", lat: 52.366, lon: 13.503, sz: 4 }, { c: "DXB", n: "Dubai", lat: 25.253, lon: 55.364, sz: 5 }, { c: "JFK", n: "New York JFK", lat: 40.641, lon: -73.778, sz: 5 },
];
export const apt = (c: string) => APTS.find(a => a.c === c)!;
export function distNm(a: string, b: string) { const A = apt(a), B = apt(b); const r = Math.PI / 180; const h = Math.sin((B.lat - A.lat) * r / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin((B.lon - A.lon) * r / 2) ** 2; return Math.round(3440 * 2 * Math.asin(Math.sqrt(h))); }
export type PT = { k: string; n: string; sub: string; seats: number; range: number; kt: number; price: number; hour: number; rep: number };
export const TYPES: PT[] = [
  { k: "tp", n: "Turboprop 70", sub: "ATR-size: cheap, short hops", seats: 70, range: 800, kt: 270, price: 90000, hour: 900, rep: 0 },
  { k: "nb", n: "Narrowbody 180", sub: "A320-size: the workhorse", seats: 180, range: 1900, kt: 450, price: 260000, hour: 3000, rep: 0 },
  { k: "nl", n: "Long narrowbody 220", sub: "A321-size: more seats, more range", seats: 220, range: 2400, kt: 450, price: 360000, hour: 3500, rep: 55 },
  { k: "wb", n: "Widebody 300", sub: "A330-size: long-haul to Dubai and New York", seats: 300, range: 6000, kt: 480, price: 900000, hour: 8000, rep: 65 },
];
export const tp = (k: string) => TYPES.find(t => t.k === k)!;
export type Plane = { id: string; t: string; reg: string; route: string | null; wear: number; out?: number };
export type Route = { id: string; a: string; b: string; fare: number; plane: string | null; days: number };
export type DayLog = { d: number; pax: number; seats: number; rev: number; cost: number; profit: number; ontime: number; legs: number; cxl: number; cash: number; events: string[] };
export type Save = { v: 1; liv: Livery; home: string; day: number; cash: number; loan: number; rep: number; fleet: Plane[]; routes: Route[]; hist: DayLog[]; seed: number; nreg: number };
const r32 = (s: Save) => { let a = (s.seed += 0x6d2b79f5) | 0; a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; };
export const fairFare = (d: number) => Math.round((40 + d * .07) / 5) * 5;
export const blockH = (d: number, kt: number) => d / kt + .5;
export const LOAN_MAX = 400000;
export function newAirline(liv: Livery, home: string, seed = (Math.random() * 1e9) | 0): Save { const s: Save = { v: 1, liv, home, day: 1, cash: 500000, loan: 0, rep: 50, fleet: [], routes: [], hist: [], seed, nreg: 1 }; buy(s, "nb"); return s; }
const regOf = (s: Save) => "G-" + (s.liv.code.slice(0, 2) || "XX").toUpperCase() + String.fromCharCode(65 + (s.nreg++ % 26));
export function buy(s: Save, k: string): string | null { const t = tp(k); if (s.rep < t.rep) return `Needs reputation ${t.rep}`; if (s.cash < t.price) return "Not enough cash"; s.cash -= t.price; s.fleet.push({ id: "p" + s.nreg + "_" + s.day, t: k, reg: regOf(s), route: null, wear: 0 }); return null; }
export const planeValue = (p: Plane) => Math.round(tp(p.t).price * .7 * (1 - p.wear / 250));
export function sell(s: Save, id: string): string | null { const p = s.fleet.find(q => q.id === id); if (!p) return "No plane"; if (s.fleet.length === 1) return "Keep at least one plane"; s.cash += planeValue(p); for (const r of s.routes) if (r.plane === id) r.plane = null; s.fleet = s.fleet.filter(q => q !== p); return null; }
export function openRoute(s: Save, b: string): string | null { if (b === s.home) return "That's home!"; if (s.routes.some(r => r.b === b)) return "Already flying there"; if (s.cash < 15000) return "Opening a route costs £15,000"; s.cash -= 15000; s.routes.push({ id: "r" + b, a: s.home, b, fare: fairFare(distNm(s.home, b)), plane: null, days: 0 }); return null; }
export function closeRoute(s: Save, id: string) { s.routes = s.routes.filter(r => r.id !== id); for (const p of s.fleet) if (p.route === id) p.route = null; }
export function assign(s: Save, pid: string, rid: string | null): string | null { const p = s.fleet.find(q => q.id === pid); if (!p) return "No plane"; const r = rid ? s.routes.find(q => q.id === rid) : null;
  if (r && distNm(r.a, r.b) > tp(p.t).range) return `Too far for a ${tp(p.t).n} (${tp(p.t).range} nm range)`; for (const q of s.routes) if (q.plane === pid) q.plane = null; if (p.route) { /* moved */ } p.route = rid; if (r) { if (r.plane) { const old = s.fleet.find(q => q.id === r.plane); if (old) old.route = null; } r.plane = pid; } return null; }
export function service(s: Save, pid: string): string | null { const p = s.fleet.find(q => q.id === pid); if (!p) return "No plane"; const c = Math.round(tp(p.t).price * .02 + p.wear * 300); if (s.cash < c) return "Not enough cash"; s.cash -= c; p.wear = 0; p.out = 1; return null; }
export const serviceCost = (p: Plane) => Math.round(tp(p.t).price * .02 + p.wear * 300);
export function borrow(s: Save, n: number) { const m = Math.min(n, LOAN_MAX - s.loan); s.loan += m; s.cash += m; }
export function repay(s: Save, n: number) { const m = Math.min(n, s.loan, Math.max(0, s.cash)); s.loan -= m; s.cash -= m; }
/** Legs per day for a plane on a route (two legs = one return trip; 17 hours of operation). */
export const legsPerDay = (d: number, kt: number) => Math.max(2, Math.min(8, Math.floor(17 / (blockH(d, kt) + .75)) & ~1));
export const demandOf = (s: Save, r: Route) => { const d = distNm(r.a, r.b); const A = apt(r.a), B = apt(r.b); return Math.round((A.sz + B.sz) * 70 * (d > 2500 ? 1.4 : 1) * (.6 + s.rep / 125) * (1 + Math.min(10, r.days) * .03)); };
export type LegRes = { r: string; dep: number; arr: number; from: string; to: string; delay: number; why?: string; cxl?: boolean; pax: number };
/** Simulate one day. Returns the day log and the flown legs (for the animated map). */
export function runDay(s: Save): { log: DayLog; legs: LegRes[] } {
  const ev: string[] = []; const legs: LegRes[] = []; let pax = 0, seats = 0, rev = 0, cost = 0, ont = 0, n = 0, cxl = 0;
  const wx = r32(s); const stormy = wx < .12; const atcStrike = r32(s) < .05; if (stormy) ev.push("⛈️ Storms across Europe today: more weather delays."); if (atcStrike) ev.push("✊ Air traffic control strike in one country: slot delays.");
  for (const p of s.fleet) { if (p.out) { p.out = 0; ev.push(`🔧 ${p.reg} spent the day in maintenance.`); continue; } const r = s.routes.find(q => q.id === p.route); if (!r) { cost += 400; continue; } const t = tp(p.t); const d = distNm(r.a, r.b); const nl = legsPerDay(d, t.kt); const bh = blockH(d, t.kt);
    const fareF = Math.max(.2, Math.min(1.6, 1.6 - (r.fare / fairFare(d) - .6) * 1.1)); const dem = demandOf(s, r) * fareF; let prevArr = 0;
    for (let i = 0; i < nl; i++) { const from = i % 2 ? r.b : r.a, to = i % 2 ? r.a : r.b; const sched = 6 + i * (bh + .75); let delay = i ? Math.max(0, Math.round((prevArr + .4 - sched) * 60)) : 0; let why: string | undefined = delay > 5 ? "late inbound plane" : undefined; const x = r32(s); const strk = atcStrike ? .08 : 0;
      if (x < (stormy ? .16 : .04)) { delay += 15 + Math.round(r32(s) * 70); why = "weather"; } else if (x < (stormy ? .22 : .07) + strk) { delay += 10 + Math.round(r32(s) * 50); why = "ATC slot"; } else if (x < .09 + strk + p.wear / 400) { delay += 20 + Math.round(r32(s) * 80 * (1 + p.wear / 60)); why = "technical check"; } else if (x < .11 + strk + p.wear / 400) { delay += 10 + Math.round(r32(s) * 25); why = "crew late"; }
      const cancel = delay > 180 || (p.wear > 85 && r32(s) < .25); if (cancel) { cxl++; n++; legs.push({ r: r.id, dep: sched, arr: sched, from, to, delay, why: why || "technical fault", cxl: true, pax: 0 }); ev.push(`❌ ${s.liv.code}${100 + legs.length} ${from}→${to} cancelled (${why || "technical fault"}). Refunds paid.`); cost += 4000 + t.seats * 20; break; }
      const lf = Math.max(.25, Math.min(1, dem / (t.seats * nl) * (.85 + r32(s) * .3))); const px = Math.round(t.seats * lf); pax += px; seats += t.seats; rev += px * r.fare + px * 6; n++; if (delay < 15) ont++;
      cost += bh * t.hour + 600 + t.seats * 3 + px * 20 + (delay > 180 ? px * 100 : 0);
      const dep = sched + delay / 60; prevArr = dep + bh; legs.push({ r: r.id, dep, arr: prevArr, from, to, delay, why, pax: px }); if (delay >= 60) ev.push(`⏱️ ${s.liv.code}${100 + legs.length} ${from}→${to} ${delay} min late (${why}).`);
      p.wear = Math.min(100, p.wear + bh * .9); }
    r.days++; }
  cost += s.fleet.length * 900 + Math.round(s.loan * .0015); const ontime = n ? Math.round(ont / Math.max(1, n - cxl) * 100) : 100;
  s.rep = Math.max(0, Math.min(100, s.rep + (n ? (ontime - 70) / 15 : 0) - cxl * 1.2 + (pax && pax / Math.max(1, seats) > .75 ? .5 : 0)));
  const profit = Math.round(rev - cost); s.cash += profit; const log: DayLog = { d: s.day, pax, seats, rev: Math.round(rev), cost: Math.round(cost), profit, ontime, legs: n, cxl, cash: Math.round(s.cash), events: ev.slice(0, 8) };
  s.hist = [...s.hist, log].slice(-30); s.day++; return { log, legs }; }
export const value = (s: Save) => Math.round(s.cash - s.loan + s.fleet.reduce((t, p) => t + planeValue(p), 0));
