// v45 (wave 2): five new lazy-loaded games are registered, use no external logos/URLs, and their pure simulations behave.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const src = p => fs.readFileSync(path.join(here, "../src", p), "utf8");
const games = src("games.tsx");
for (const [id, file] of [["tower", "atc2"], ["bags", "bags"], ["approach", "approach"], ["airline", "airline"], ["disaster", "disaster"]]) {
  assert.match(games, new RegExp(`id: "${id}"`), id + " registered"); assert.match(games, new RegExp(`import\\("./g/${file}"\\)`), file + " lazy-loaded");
  assert.ok(/^[a-z]+$/.test(id), id + ": ids must match the app's #games=[a-z]+ deep links");
  const g = src(`g/${file}.tsx`); assert.match(g, /export default function/); assert.ok(!/logo\.(png|svg)|https?:\/\//.test(g), file + ": no external logos/URLs"); }
assert.match(games, /id: "atc", name: "Approach Control"/, "the original ATC game is kept");
async function load(file) { const out = path.join(here, `.${file}-bundle.mjs`); await build({ input: path.join(here, `../src/g/${file}.ts`), platform: "node", logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true }); const m = await import(pathToFileURL(out).href); fs.unlinkSync(out); return m; }
// Tower Boss: a calm controller (advise) lands and launches traffic; doing nothing scores far worse; same seed = same game
const A = await load("atcsim");
for (let lv = 0; lv < A.LEVELS.length; lv++) { const s = A.newGame(lv, 42); while (!s.done) { A.step(s, .1); const a = A.advise(s); if (a) (a.act === "clear" ? A.clearApp : A.takeoff)(s, a.id); }
  const idle = A.newGame(lv, 42); while (!idle.done) A.step(idle, .1); assert.ok(s.landed >= 3 && s.departed >= 3, "lv" + lv + " traffic moves"); assert.ok(s.score > idle.score + 500, "lv" + lv + " control matters"); assert.ok(A.starsFor(s) >= 1, "lv" + lv + " a calm controller earns a star"); }
{ const a = A.newGame(1, 7), b = A.newGame(1, 7); for (let i = 0; i < 600; i++) { A.step(a, .1); A.step(b, .1); } assert.deepStrictEqual(a.ps.map(p => [p.cs, p.x.toFixed(3)]), b.ps.map(p => [p.cs, p.x.toFixed(3)])); }
{ const s = A.newGame(0, 3); for (let i = 0; i < 200; i++) A.step(s, .1); const d = s.ps.find(p => p.ph === "wait"); assert.ok(d); assert.strictEqual(A.takeoff(s, d.id), null); const d2 = s.ps.find(p => p.ph === "wait"); if (d2) assert.strictEqual(A.takeoff(s, d2.id), "Runway busy!", "one runway, one plane at a time"); }
// Pilot Approach: a stable autopilot lands well; no input lands short; no gear = belly landing
const P = await load("approachsim");
for (const apt of P.APTS) { const fly = (gear) => { const s = P.fresh(apt, 7); s.gear = gear; s.flaps = 3; for (let i = 0; i < 20000 && !s.done; i++) { const gd = P.gsDev(s), ld = P.locDev(s, apt); let pitch, roll; if (s.h > 40) { pitch = Math.max(-1, Math.min(1, (-3 - gd * 2.5 - s.gam) * 1.5)); s.cmd = Math.max(0, Math.min(1, .5 + (P.VREF - s.v) * .04 + (s.gam + 3) * .1)); } else { pitch = Math.max(-1, Math.min(1, (-.6 - s.gam) * 2)); if (s.h < 20) s.cmd = 0; } roll = Math.max(-1, Math.min(1, (-ld * 8 - Math.atan2(apt.wind.c, P.VREF) * 57.3 - s.psi) * .3)); P.step(s, apt, pitch, roll, .05); } return s; };
  const ok = fly(true); assert.ok(ok.score > 600 && ok.vs < 400, apt.k + " autopilot lands: " + ok.score + " " + ok.vs); assert.match(fly(false).done, /Belly/);
  const idle = P.fresh(apt, 7); for (let i = 0; i < 20000 && !idle.done; i++) P.step(idle, apt, 0, 0, .05); assert.ok(idle.score < 100, "no input doesn't land well"); }
// Your Own Airline: books balance, range limits, growth with sensible play
const L = await load("airlinesim"); const liv = { name: "Test Air", code: "TST", body: "#fff", belly: "#000", tail: "#f00", stripe: "#ff0", motif: "dot", engine: "#000" };
{ const s = L.newAirline(liv, "MAN", 5); assert.strictEqual(s.fleet.length, 1); assert.strictEqual(L.openRoute(s, "JFK"), null); assert.match(L.assign(s, s.fleet[0].id, "rJFK"), /Too far/); assert.strictEqual(L.openRoute(s, "AGP"), null); assert.strictEqual(L.assign(s, s.fleet[0].id, "rAGP"), null);
  for (let d = 0; d < 30; d++) { const c0 = s.cash; const { log, legs } = L.runDay(s); assert.strictEqual(Math.round(s.cash), Math.round(c0 + log.profit), "cash = cash + profit"); assert.ok(legs.every(l => l.cxl || l.arr > l.dep)); for (const p of s.fleet) if (p.wear > 60) L.service(s, p.id); }
  assert.ok(L.value(s) > 520000, "a sensible airline grows: " + L.value(s)); assert.ok(L.distNm("MAN", "KTW") > 750 && L.distNm("MAN", "KTW") < 850, "great-circle distance"); }
// Disaster Day: safe choices beat risky ones on every warning level; can't skip decisions
const D = await load("disastersim");
for (let lv = 0; lv < D.LEVELS.length; lv++) { const run = mode => { const s = D.newDay(lv, 11); assert.match(String(D.pendingEvs(s).length ? D.play(s) : "Decide"), /Decide/); while (!s.done) { for (const e of D.pendingEvs(s)) { const ch = D.EVS[e].ch; const c = mode === "safe" ? (ch.find(c => !c.risky && c.cost <= s.money) || ch.at(-1)) : (ch.find(c => c.risky) || ch.at(-1)); D.answer(s, e, c.k); } if (mode === "safe" && s.snow + D.cur(s).snow >= 4) s.orders.plough = true; const r = D.play(s); assert.notStrictEqual(typeof r, "string"); } return s; };
  const safe = run("safe"), risky = run("risky"); assert.ok(D.score(safe) > D.score(risky), lv + ": safety pays"); assert.strictEqual(safe.incidents, 0); assert.strictEqual(safe.hist.length, D.TURNS); }
// SW cache bumped
assert.match(fs.readFileSync(path.join(here, "../public/sw.js"), "utf8"), /skyline-v4[5-9]/);
console.log("v45 ok");
