// Tower Boss: a pure, seeded simulation of a stylised radar sector (fan-made airspace, not a real chart).
// Units: positions in nautical miles (screen box ±20), time in real seconds, speeds in nm per second (game-fast).
export type Rw = { id: string; x: number; y: number; h: number; len: number; use: "both" | "arr" | "dep" };
export type Stack = { n: string; x: number; y: number };
export type Lv = { k: string; n: string; sub: string; style: "man" | "ktw"; rws: Rw[]; stacks: Stack[]; arrEvery: number; depEvery: number; dur: number; fuel: [number, number]; gusty?: number; heavy: number; stars: [number, number, number] };
export type Ph = "in" | "hold" | "faf" | "final" | "roll" | "ga" | "wait" | "lu" | "tko" | "climb" | "gone";
export type P = { id: number; cs: string; kind: "M" | "H"; t: "arr" | "dep"; ph: Ph; x: number; y: number; alt: number; hdg: number; spd: number; rw: number; stack: number; slot: number; ang: number; fuel: number; wait: number; tm: number; mayday?: boolean; slow?: boolean; warn?: boolean };
export type Log = { t: number; txt: string; c: "ok" | "bad" | "info" };
export type S = { lv: number; t: number; ps: P[]; nid: number; nextArr: number; nextDep: number; score: number; landed: number; departed: number; ga: number; div: number; delay: number; log: Log[]; seed: number; done?: boolean; sep: Record<string, 1> };

const D2R = Math.PI / 180;
export const dirOf = (h: number) => ({ x: Math.sin(h * D2R), y: -Math.cos(h * D2R) });
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export const FINAL = 6, HOLD_R = 1.5, SLOT_ALT = (k: number) => 7000 + 1000 * k, MAX_SLOTS = 5;
export const SPD = { in: .6, hold: .45, faf: .5, final: .34, slow: .27, ga: .5, climb: .55 };

const rwy = (id: string, x: number, y: number, h: number, use: Rw["use"] = "both", len = 1.7): Rw => ({ id, x, y, h, len, use });
export const LEVELS: Lv[] = [
  { k: "sun", n: "Quiet Sunday", sub: "Manchester-style airspace, one runway (23R). Learn the stacks.", style: "man", rws: [rwy("23R", -3, 3, 230)], stacks: [{ n: "MOSSY", x: 12, y: -12 }, { n: "DALES", x: 13, y: 8 }], arrEvery: 24, depEvery: 30, dur: 150, fuel: [100, 170], heavy: .1, stars: [400, 700, 950] },
  { k: "ktw", n: "Silesian Morning", sub: "Katowice-style airspace, runway 27, forests below. Busier.", style: "ktw", rws: [rwy("27", 4, 2, 270)], stacks: [{ n: "BIRCH", x: 14, y: -11 }, { n: "OSIKA", x: 14, y: 13 }], arrEvery: 19, depEvery: 24, dur: 180, fuel: [90, 150], heavy: .15, stars: [700, 1100, 1500] },
  { k: "twin", n: "Twin Runways", sub: "Manchester-style: land on 23R, depart from 23L. Much more traffic.", style: "man", rws: [rwy("23R", -3, 3, 230, "arr"), rwy("23L", -2.2, 4.4, 230, "dep")], stacks: [{ n: "MOSSY", x: 12, y: -12 }, { n: "DALES", x: 13, y: 8 }, { n: "PEAKS", x: 2, y: -15 }], arrEvery: 14, depEvery: 16, dur: 210, fuel: [85, 150], heavy: .2, stars: [1200, 1900, 2600] },
  { k: "gust", n: "Gusty Evening", sub: "Katowice-style. Strong gusts: pilots may go around on their own. Low fuel.", style: "ktw", rws: [rwy("27", 4, 2, 270)], stacks: [{ n: "BIRCH", x: 14, y: -11 }, { n: "OSIKA", x: 14, y: 13 }], arrEvery: 17, depEvery: 22, dur: 210, fuel: [75, 130], gusty: .15, heavy: .2, stars: [800, 1300, 1800] },
];
const CS = ["SKL", "PNN", "RRS", "SLS", "NWD", "BJY", "MRL", "TWR", "OAK", "GLD"];
export const CS_NAME: Record<string, string> = { SKL: "Skylark", PNN: "Pennine", RRS: "Red Rose", SLS: "Silesia", NWD: "Northwind", BJY: "Bluejay", MRL: "Merlin", TWR: "Tower Air", OAK: "Oakline", GLD: "Goldfinch" };
function rng(s: S) { let a = (s.seed += 0x6d2b79f5) | 0; a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; }
const L = (s: S) => LEVELS[s.lv];
export const arrRw = (s: S) => L(s).rws.findIndex(r => r.use !== "dep");
export const depRw = (s: S) => L(s).rws.findIndex(r => r.use !== "arr");
export const faf = (r: Rw) => { const d = dirOf(r.h); return { x: r.x - d.x * FINAL, y: r.y - d.y * FINAL }; };
const say = (s: S, txt: string, c: Log["c"] = "info") => { s.log.unshift({ t: Math.round(s.t), txt, c }); if (s.log.length > 30) s.log.length = 30; };

export function newGame(lv: number, seed = (Math.random() * 1e9) | 0): S {
  const s: S = { lv, t: 0, ps: [], nid: 1, nextArr: 2, nextDep: 6, score: 0, landed: 0, departed: 0, ga: 0, div: 0, delay: 0, log: [], seed, sep: {} };
  spawnArr(s); s.nextArr = L(s).arrEvery * .6; say(s, "You have the sector. Good luck, controller!"); return s; }

function callsign(s: S) { return CS[Math.floor(rng(s) * CS.length)] + (10 + Math.floor(rng(s) * 890)); }
function stackCount(s: S, k: number) { return s.ps.filter(p => p.t === "arr" && p.stack === k && (p.ph === "in" || p.ph === "hold")).length; }
function spawnArr(s: S) { const lv = L(s); const k = Math.floor(rng(s) * lv.stacks.length); const st = lv.stacks[k];
  if (stackCount(s, k) >= MAX_SLOTS) { s.div++; s.score -= 100; say(s, `Stack ${st.n} full: an arrival diverted elsewhere (−100)`, "bad"); return; }
  const m = Math.hypot(st.x, st.y) || 1; const x = Math.max(-19.5, Math.min(19.5, st.x + st.x / m * 7)), y = Math.max(-19.5, Math.min(19.5, st.y + st.y / m * 7));
  const p: P = { id: s.nid++, cs: callsign(s), kind: rng(s) < lv.heavy ? "H" : "M", t: "arr", ph: "in", x, y, alt: 12000, hdg: Math.atan2(st.x - x, -(st.y - y)) / D2R, spd: SPD.in, rw: arrRw(s), stack: k, slot: stackCount(s, k), ang: 0, fuel: lv.fuel[0] + rng(s) * (lv.fuel[1] - lv.fuel[0]), wait: 0, tm: 0 };
  s.ps.push(p); }
function spawnDep(s: S) { const lv = L(s); const ri = depRw(s); const r = lv.rws[ri]; const waiting = s.ps.filter(p => p.ph === "wait").length; if (waiting >= 5) { s.score -= 40; s.delay += 60; say(s, "Too many departures queuing: one flight was cancelled (−40)", "bad"); return; }
  const d = dirOf(r.h); const p: P = { id: s.nid++, cs: callsign(s), kind: rng(s) < lv.heavy ? "H" : "M", t: "dep", ph: "wait", x: r.x - d.x * .25, y: r.y - d.y * .25, alt: 0, hdg: r.h, spd: 0, rw: ri, stack: -1, slot: waiting, ang: 0, fuel: 999, wait: 0, tm: 0 }; s.ps.push(p); }

/** Distance along the arrival path to the threshold (used for spacing). */
export function pathDist(s: S, p: P) { const r = L(s).rws[p.rw]; if (p.ph === "final") return dist(p.x, p.y, r.x, r.y); if (p.ph === "faf") { const f = faf(r); return dist(p.x, p.y, f.x, f.y) + FINAL; } return 99; }
export const busy = (s: S, ri: number, not = -1) => s.ps.some(p => p.id !== not && p.rw === ri && (p.ph === "roll" || p.ph === "lu" || p.ph === "tko"));

function leaveStack(s: S, p: P) { if (p.stack < 0) return; for (const q of s.ps) if (q !== p && q.t === "arr" && q.stack === p.stack && (q.ph === "hold" || q.ph === "in") && q.slot > p.slot) q.slot--; }
/** Player: clear an arrival from the stack for the approach. */
export function clearApp(s: S, id: number): string | null { const p = s.ps.find(q => q.id === id); if (!p || p.t !== "arr") return "Pick an arrival"; if (!(p.ph === "hold" || p.ph === "in" || p.ph === "ga")) return p.ph === "faf" || p.ph === "final" ? "Already on the approach" : "Can't clear that one";
  if (p.ph !== "ga") leaveStack(s, p); p.ph = "faf"; p.stack = -1; p.spd = SPD.faf; say(s, `${p.cs} cleared ILS ${L(s).rws[p.rw].id}`); return null; }
/** Player: send an approaching arrival around (back to its stack). */
export function goAround(s: S, id: number, why = "go around", pen = 60): string | null { const p = s.ps.find(q => q.id === id); if (!p || !(p.ph === "faf" || p.ph === "final")) return "Only planes on the approach can go around";
  p.ph = "ga"; p.tm = 0; p.spd = SPD.ga; s.ga++; s.score -= pen; say(s, `${p.cs}: ${why}${pen ? ` (−${pen})` : ""}`, "bad"); return null; }
/** Player: clear a waiting departure for take-off. */
export function takeoff(s: S, id: number): string | null { const p = s.ps.find(q => q.id === id); if (!p || p.ph !== "wait") return "Pick a waiting departure"; if (busy(s, p.rw)) return "Runway busy!";
  const r = L(s).rws[p.rw]; p.ph = "lu"; p.tm = 2; p.x = r.x; p.y = r.y; for (const q of s.ps) if (q.ph === "wait" && q.slot > p.slot) q.slot--; say(s, `${p.cs} line up and take off ${r.id}`); return null; }

function steer(p: P, tx: number, ty: number, dt: number, turn = 120) { const want = Math.atan2(tx - p.x, -(ty - p.y)) / D2R; let d = ((want - p.hdg + 540) % 360) - 180; d = Math.max(-turn * dt, Math.min(turn * dt, d)); p.hdg = (p.hdg + d + 360) % 360; const v = dirOf(p.hdg); p.x += v.x * p.spd * dt; p.y += v.y * p.spd * dt; }
const toward = (a: number, b: number, r: number) => (a < b ? Math.min(b, a + r) : Math.max(b, a - r));

export function step(s: S, dt: number): S {
  if (s.done) return s; const lv = L(s); s.t += dt;
  if ((s.nextArr -= dt) <= 0) { spawnArr(s); s.nextArr = lv.arrEvery * (.75 + rng(s) * .5); }
  if ((s.nextDep -= dt) <= 0) { spawnDep(s); s.nextDep = lv.depEvery * (.75 + rng(s) * .5); }
  for (const p of s.ps) { if (p.ph === "gone") continue; const r = lv.rws[p.rw]; const rd = dirOf(r.h);
    if (p.t === "arr" && p.ph !== "roll") { p.fuel -= dt; if (p.fuel <= 0 && !p.mayday) { p.mayday = true; s.score -= 150; say(s, `MAYDAY ${p.cs}: minimum fuel! Priority landing (−150)`, "bad"); if (p.ph !== "faf" && p.ph !== "final") clearApp(s, p.id); } }
    switch (p.ph) {
      case "in": { const st = lv.stacks[p.stack]; steer(p, st.x, st.y, dt); p.alt = toward(p.alt, SLOT_ALT(p.slot), 900 * dt); if (dist(p.x, p.y, st.x, st.y) < HOLD_R + .1) { p.ph = "hold"; p.ang = Math.atan2(p.y - st.y, p.x - st.x); p.spd = SPD.hold; } break; }
      case "hold": { const st = lv.stacks[p.stack]; p.ang += p.spd / HOLD_R * dt; const nx = st.x + Math.cos(p.ang) * HOLD_R, ny = st.y + Math.sin(p.ang) * HOLD_R; p.hdg = (Math.atan2(nx - p.x, -(ny - p.y)) / D2R + 360) % 360; p.x = nx; p.y = ny; p.alt = toward(p.alt, SLOT_ALT(p.slot), 900 * dt); break; }
      case "faf": { const f = faf(r); steer(p, f.x, f.y, dt, 90); p.alt = toward(p.alt, 3000, 900 * dt); if (dist(p.x, p.y, f.x, f.y) < .5) { p.ph = "final"; p.spd = SPD.final; } break; }
      case "final": { steer(p, r.x, r.y, dt, 60); const d = dist(p.x, p.y, r.x, r.y); p.alt = Math.min(p.alt, 3000 * d / FINAL); p.spd = p.slow ? SPD.slow : SPD.final;
        if (d < 1 && busy(s, p.rw, p.id)) { goAround(s, p.id, "runway occupied, going around"); break; }
        if (d < .6 && lv.gusty && !p.warn) { p.warn = true; if (rng(s) < lv.gusty) { goAround(s, p.id, "windshear! The pilot goes around", 0); break; } }
        if (d < .12) { p.ph = "roll"; p.tm = 4; p.alt = 0; p.x = r.x; p.y = r.y; p.hdg = r.h; p.spd = .3; } break; }
      case "roll": { p.tm -= dt; p.spd = Math.max(.04, p.spd - .07 * dt); p.x += rd.x * p.spd * dt; p.y += rd.y * p.spd * dt; if (p.tm <= 0) { p.ph = "gone"; s.landed++; s.score += 100 + (p.kind === "H" ? 20 : 0); say(s, `${p.cs} landed ✓ (+${100 + (p.kind === "H" ? 20 : 0)})`, "ok"); } break; }
      case "ga": { p.tm += dt; p.alt = toward(p.alt, 4000, 700 * dt); if (p.tm < 5) { const v = dirOf(r.h); steer(p, p.x + v.x * 3, p.y + v.y * 3, dt, 30); } else { let k = 0, best = 99; lv.stacks.forEach((_, i) => { const c = stackCount(s, i); if (c < best) { best = c; k = i; } }); p.stack = k; p.slot = stackCount(s, k); p.ph = "in"; p.spd = SPD.in; p.warn = false; p.slow = false; } break; }
      case "wait": p.wait += dt; if (p.wait > 40) { s.score -= 2 * dt; s.delay += dt; } break;
      case "lu": p.tm -= dt; if (p.tm <= 0) { p.ph = "tko"; p.tm = 4; p.spd = .08; } break;
      case "tko": p.tm -= dt; p.spd += .1 * dt; p.x += rd.x * p.spd * dt; p.y += rd.y * p.spd * dt; p.alt = Math.max(0, (2 - p.tm) * 400); if (p.tm <= 0) { p.ph = "climb"; p.spd = SPD.climb; } break;
      case "climb": { p.alt = Math.min(12000, p.alt + 900 * dt); const v = dirOf(r.h); p.x += v.x * p.spd * dt; p.y += v.y * p.spd * dt; if (Math.abs(p.x) > 21 || Math.abs(p.y) > 21) { p.ph = "gone"; s.departed++; s.score += 80; say(s, `${p.cs} departed ✓ (+80)`, "ok"); } break; }
    } }
  // spacing on the approach: slow the follower, or send it around if it gets far too close
  const app = s.ps.filter(p => p.ph === "faf" || p.ph === "final").map(p => ({ p, d: pathDist(s, p) })).sort((a, b) => a.d - b.d);
  for (const a of app) a.p.slow = false;
  for (let i = 1; i < app.length; i++) { const lead = app[i - 1], f = app[i]; if (lead.p.rw !== f.p.rw) continue; const min = lead.p.kind === "H" ? 3 : 2.2; const gap = f.d - lead.d;
    if (gap < min) f.p.slow = true; if (gap < min * .6 && f.p.ph === "final") goAround(s, f.p.id, `too close behind ${lead.p.cs}${lead.p.kind === "H" ? " (heavy wake!)" : ""}, going around`); }
  // separation between airborne planes not stacked at different levels
  const air = s.ps.filter(p => p.ph !== "gone" && p.ph !== "wait" && p.ph !== "lu" && p.ph !== "roll" && p.alt > 200);
  for (let i = 0; i < air.length; i++) for (let j = i + 1; j < air.length; j++) { const a = air[i], b = air[j]; const appr = (q: P) => q.ph === "faf" || q.ph === "final"; const out = (q: P) => q.ph === "ga" || q.ph === "tko" || q.ph === "climb"; if (appr(a) && appr(b) || out(a) && out(b)) continue; if (Math.abs(a.alt - b.alt) < 800 && dist(a.x, a.y, b.x, b.y) < .9) { const key = a.id + "-" + b.id; if (!s.sep[key]) { s.sep[key] = 1; s.score -= 200; say(s, `Loss of separation: ${a.cs} and ${b.cs}! (−200)`, "bad"); } } }
  s.ps = s.ps.filter(p => p.ph !== "gone");
  if (s.t >= lv.dur) { s.done = true; s.score = Math.round(s.score); say(s, "Shift over! Hand over to the next controller.", "info"); }
  return s; }
export const starsFor = (s: S) => { const st = L(s).stars; return s.score >= st[2] ? 3 : s.score >= st[1] ? 2 : s.score >= st[0] ? 1 : 0; };

/** A simple helper controller (used by tests and the "hint" button): what would a calm controller do next? */
export function advise(s: S): { id: number; act: "clear" | "takeoff"; why: string } | null {
  const lv = L(s); const ar = arrRw(s), dr = depRw(s);
  const app = s.ps.filter(p => p.ph === "faf" || p.ph === "final").map(p => pathDist(s, p)).sort((a, b) => a - b);
  const lastD = app.length ? app[app.length - 1] : -99; const nearest = app.length ? app[0] : 99;
  const may = s.ps.find(p => p.mayday && (p.ph === "hold" || p.ph === "in")); if (may) return { id: may.id, act: "clear", why: `${may.cs} is on minimum fuel` };
  const dep = s.ps.filter(p => p.ph === "wait").sort((a, b) => b.wait - a.wait)[0];
  if (dep && !busy(s, dr) && (dr !== ar || nearest > 2.6)) return { id: dep.id, act: "takeoff", why: dr !== ar ? "Departure runway is free" : "Big enough gap before the next arrival" };
  const holds = s.ps.filter(p => p.t === "arr" && (p.ph === "hold" || p.ph === "in")).sort((a, b) => a.fuel - b.fuel);
  if (holds.length) { const h = holds[0]; const f = faf(lv.rws[ar]); const eta = Math.hypot(h.x - f.x, h.y - f.y) + FINAL; if (eta - lastD > 3.4 || !app.length) return { id: h.id, act: "clear", why: `${h.cs} has the least fuel` }; }
  return null; }
