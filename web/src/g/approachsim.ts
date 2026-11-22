// Pilot Approach: a simple made-up flight model for a final approach (game physics, not a real aircraft or real charts).
// d = feet before the runway threshold (negative once past it), h = feet above the runway, y = feet right of the centreline.
export type Apt = { k: string; n: string; sub: string; rw: string; len: number; wid: number; style: "man" | "ktw"; night?: boolean; snow?: boolean; rain?: boolean; wind: { h: number; c: number; g: number } };
export const APTS: Apt[] = [
  { k: "man", n: "Manchester-style 23R", sub: "Showers and a breezy crosswind. A parallel runway on your left.", rw: "23R", len: 10000, wid: 150, style: "man", rain: true, wind: { h: 12, c: 7, g: 6 } },
  { k: "ktw", n: "Katowice-style 27", sub: "Winter morning: snowy fields, forests, a wide runway.", rw: "27", len: 10500, wid: 200, style: "ktw", snow: true, wind: { h: 8, c: -9, g: 5 } },
  { k: "night", n: "Manchester-style 23R at night", sub: "Dark and gusty. Follow the lights and the needles.", rw: "23R", len: 10000, wid: 150, style: "man", night: true, rain: true, wind: { h: 16, c: 12, g: 10 } },
];
export const VREF = 140, AIM = 1000;
export type St = { d: number; h: number; y: number; psi: number; v: number; gam: number; thr: number; cmd: number; flaps: number; gear: boolean; t: number; gust: number; gt: number; bank: number; sumGs: number; sumLoc: number; sumSpd: number; n: number; seed: number; call: number; done?: string; score?: number; parts?: [string, number][]; vs?: number; tdz?: number };
const rnd = (s: St) => { s.seed = (s.seed * 16807) % 2147483647; return s.seed / 2147483647; };
export function fresh(apt: Apt, seed = 1 + Math.floor(Math.random() * 1e6)): St { const s: St = { d: 18000, h: 0, y: 0, psi: 0, v: 152, gam: -3, thr: .5, cmd: .5, flaps: 2, gear: false, t: 0, gust: 0, gt: 0, bank: 0, sumGs: 0, sumLoc: 0, sumSpd: 0, n: 0, seed, call: 9999 }; s.h = Math.tan(3 * Math.PI / 180) * (s.d + AIM) + (rnd(s) * 120 - 60); s.y = (rnd(s) * 2 - 1) * 260; void apt; return s; }
export const gsDev = (s: St) => Math.atan2(s.h, Math.max(1, s.d + AIM)) * 180 / Math.PI - 3; // + = above
export const locDev = (s: St, a: Apt) => Math.atan2(s.y, Math.max(1, s.d + a.len)) * 180 / Math.PI; // + = right of centreline
export const stallV = (s: St) => 112 + (3 - s.flaps) * 8;
export const papi = (s: St) => { const a = Math.atan2(s.h + 8, Math.max(1, s.d + AIM)) * 180 / Math.PI; return [2.5, 2.83, 3.17, 3.5].map(th => a > th); };
export const CALLS = [500, 200, 100, 50, 40, 30, 20, 10];

/** Advance dt seconds. pitch/roll inputs are −1..1. Returns a callout (e.g. "50") when one is due. */
export function step(s: St, a: Apt, pitch: number, roll: number, dt: number): string | null {
  if (s.done) return null; s.t += dt; let call: string | null = null;
  if ((s.gt -= dt) <= 0) { s.gt = .6 + rnd(s) * 1.4; s.gust = (rnd(s) * 2 - 1) * a.wind.g; }
  s.thr += Math.max(-.45 * dt, Math.min(.45 * dt, s.cmd - s.thr));
  const stall = s.v < stallV(s); s.gam += (pitch * 2.4 - (stall ? 3 : 0)) * dt + (s.gust * .004) * dt * 10 * (rnd(s) - .5); s.gam = Math.max(-8, Math.min(6, s.gam));
  if (s.h < 25 && s.gam < -.5) s.gam += .6 * dt; // ground effect cushion
  s.bank += (roll * 18 - s.bank) * 2.5 * dt; s.psi += s.bank * .33 * dt; s.psi = Math.max(-25, Math.min(25, s.psi));
  const need = .52 + (s.v - VREF) * .009 + (s.gam + 3) * .11 - (3 - s.flaps) * .06 - (s.gear ? 0 : .07); s.v += (s.thr - need) * 9 * dt; s.v = Math.max(80, Math.min(230, s.v));
  const head = a.wind.h + s.gust * .7, cross = a.wind.c + s.gust * .5; const gs = Math.max(30, s.v - head) * 1.688; const rad = Math.PI / 180;
  s.d -= gs * Math.cos(s.psi * rad) * dt; s.y += (gs * Math.sin(s.psi * rad) + cross * 1.688) * dt; s.h += s.v * 1.688 * Math.sin(s.gam * rad) * dt;
  if (s.d > 600 && s.h > 60) { s.sumGs += Math.abs(gsDev(s)) * dt; s.sumLoc += Math.abs(locDev(s, a)) * dt; s.sumSpd += Math.abs(s.v - VREF) * dt; s.n += dt; }
  for (const c of CALLS) if (s.h <= c && s.call > c) { s.call = c; call = c === 200 ? "Minimums" : String(c); }
  if (s.h <= 0) touchdown(s, a); else if (s.d < -a.len || s.h > 4000) end(s, "You flew past the runway. Go around next time!", 0, []);
  return call; }
function end(s: St, txt: string, score: number, parts: [string, number][]) { s.done = txt; s.score = Math.max(0, Math.round(score)); s.parts = parts; }
export function goAround(s: St) { end(s, "Go-around! Safe decision, captain: you can always try again.", 150, [["Safe go-around", 150]]); }
function touchdown(s: St, a: Apt) {
  const vs = -s.v * 1.688 * Math.sin(s.gam * Math.PI / 180) * 60; s.vs = Math.round(vs); s.h = 0; const pos = -s.d; s.tdz = Math.round(pos);
  const avg = (v: number) => (s.n ? v / s.n : 0);
  const parts: [string, number][] = [["Glideslope", Math.round(300 - avg(s.sumGs) * 400)], ["Localiser", Math.round(250 - avg(s.sumLoc) * 600)], ["Speed", Math.round(200 - avg(s.sumSpd) * 12)],
    ["Touchdown softness", Math.round(vs < 120 ? 250 : 250 - (vs - 120) * .6)], ["Touchdown point", Math.round(150 - Math.max(0, Math.abs(pos - 1500) - 600) * .08)], ["Centreline", Math.round(100 - Math.abs(s.y) * 2)], ["Straight (no crab)", Math.round(50 - Math.abs(s.psi) * 8)]].map(([k, v]) => [k as string, Math.max(0, v as number)] as [string, number]);
  const sum = parts.reduce((t, p) => t + p[1], 0);
  if (s.d > 0) return end(s, s.d > 2500 ? "Landed in a field before the airport! Everyone is OK, but the plane isn't going anywhere." : "Touched down short of the runway, in the approach lights.", 40, [["Survived", 40]]);
  if (Math.abs(s.y) > a.wid / 2) return end(s, "Touched down off the side of the runway, onto the grass.", 80, [["Survived", 80]]);
  if (!s.gear) return end(s, "Belly landing! You forgot the landing gear. Sparks everywhere, everyone safe.", 60, [["Survived", 60]]);
  if (vs > 900) return end(s, `Very hard landing (${Math.round(vs)} ft/min). The engineers will inspect the plane.`, sum * .3, parts);
  if (pos > a.len * .55) return end(s, "Landed very long: heavy braking and you only just stopped in time.", sum * .45, parts);
  const txt = vs < 180 ? "Butter! The passengers barely felt it. 🧈" : vs < 360 ? "Nice, smooth landing. Welcome to " + (a.style === "man" ? "Manchester" : "Katowice") + "-style!" : "Firm, but safe. The cabin crew noticed.";
  end(s, txt, sum + (s.flaps < 3 ? -60 : 0), s.flaps < 3 ? [...parts, ["Not full flaps", -60]] : parts); }
