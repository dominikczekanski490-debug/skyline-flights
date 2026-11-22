// v44: Airport Manager simulation (pure module): build rules, taxi routes, economy, loans, contracts, research, events, levels, saves.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, ".mgr-bundle.mjs");
await build({ input: path.join(here, "../src/mgr/sim.ts"), platform: "node", logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const ok = r => { assert.notStrictEqual(typeof r, "string", "expected success, got: " + r); return r; };
// starting airport
const f = m.freshSave(7); assert.strictEqual(f.grid.length, m.W * m.H); assert.deepStrictEqual(m.runwayRows(f.grid), [1]); assert.strictEqual(m.usableStands(f.grid).length, 2);
const tp = m.taxiPath(f.grid, 3 * m.W + 3); assert.ok(tp.length >= 3 && f.grid[tp[0]] === "rw" && tp.at(-1) === 3 * m.W + 3, "taxi route runs runway → stand");
// build rules
let s = m.openAirport({ ...f, name: "Test", code: "TST" }); assert.strictEqual(s.stage, "play"); assert.strictEqual(s.contracts.length, 2); assert.strictEqual(s.missions.length, 3);
assert.match(m.canBuild(s, 3 * m.W + 6, "gt"), /level 2/); assert.match(m.canBuild(s, 8 * m.W + 8, "st"), /taxiway/); assert.match(m.canBuild(s, 8 * m.W + 8, "sh"), /terminal/); assert.match(m.canBuild(s, 4 * m.W + 4, "st"), /Bulldoze/);
const before = s.money; s = ok(m.build(s, 3 * m.W + 6, "st")); assert.strictEqual(s.money, before - 2500); assert.strictEqual(m.usableStands(s.grid).length, 3);
assert.match(m.canRunway(s, 9), /level 3/); assert.match(m.bulldoze(s, m.W + 2), /can't/);
const b2 = m.bulldoze(s, 3 * m.W + 6); assert.strictEqual(ok(b2).money, s.money + 750, "bulldoze refunds 30%");
assert.match(m.build({ ...s, money: 100 }, 3 * m.W + 7, "st"), /money/);
// a second runway at level 3 costs a full row
const l3 = { ...s, level: 3, money: 1e6 }; const r2 = ok(m.buildRunway(l3, 9)); assert.deepStrictEqual(m.runwayRows(r2.grid), [1, 9]); assert.strictEqual(r2.money, 1e6 - m.W * m.RUNWAY_TILE); assert.ok(m.runwayCap(r2) > m.runwayCap(l3));
// staff & capacities
assert.strictEqual(m.runwayCap(s), 6, "no tower → ATC doesn't help"); const tw = ok(m.build({ ...s, money: 1e5 }, 6 * m.W + 10, "tw")); assert.strictEqual(m.runwayCap(m.hire(m.hire(tw, "atc", 1), "atc", 1)), 12);
assert.ok(m.turnMin(m.hire(s, "gnd", 1)) < m.turnMin(s)); assert.strictEqual(m.secRate(s), 150); assert.strictEqual(m.secRate({ ...s, research: { egate: 1 } }), 210);
assert.strictEqual(m.hire({ ...s, staff: { ...s.staff, sec: 0 } }, "sec", -1).staff.sec, 0, "never negative");
// research tree
assert.match(m.research(s, "push"), /Smart gate planner first/); let rs = ok(m.research(s, "auto")); assert.match(m.research(rs, "egate"), /Already researching/);
// loans with interest
assert.match(m.borrow(s, 1e6), /limit/); let ln = ok(m.borrow(s, 20000)); assert.strictEqual(ln.money, s.money + 20000);
// one full day: money change equals the day's revenue minus costs (plus goal rewards)
let d = m.startDay(ln); assert.strictEqual(d.phase, "day"); assert.ok(d.rots.length >= 5); const m0 = d.money; let fx = [];
for (let i = 0; i < 1000 && d.phase === "day"; i++) { for (const e of d.evs) if (!e.done && d.clock >= e.at) d = m.answer(d, e.id, m.EV_INFO[e.k].ch[0][0]); const r = m.step(d, 3); d = r.s; fx.push(...r.fx); }
assert.strictEqual(d.phase, "summary"); const h = d.hist.at(-1); assert.ok(h.flights >= 4, "flights flew: " + h.flights); assert.ok(fx.some(x => x.k === "land") && fx.some(x => x.k === "tkof"));
assert.strictEqual(h.interest, 200, "1% daily interest on £20k"); const rewards = d.missions.length ? 0 : 0; void rewards;
const goal = (d.flags.mdone || []).reduce((n, id) => n + (m.MISSIONS.find(x => x.id === id)?.reward || 0), 0); const renew = fx.filter(x => /renewed/.test(x.txt || "")).length * 2000;
assert.strictEqual(d.money - m0, h.rev - h.cost + goal + renew, "books balance");
assert.ok(h.rev === h.fees + h.shops + h.parking && h.fees > 0); assert.strictEqual(d.day, 2); assert.ok(d.reviews.length >= 1 && /^Day 1:/.test(d.reviews[0].t));
// determinism: same seed → same day
const again = (() => { let x = m.startDay(ln); for (let i = 0; i < 1000 && x.phase === "day"; i++) { for (const e of x.evs) if (!e.done && x.clock >= e.at) x = m.answer(x, e.id, m.EV_INFO[e.k].ch[0][0]); x = m.step(x, 3).s; } return x; })();
assert.strictEqual(again.money, d.money); assert.deepStrictEqual(again.hist, d.hist);
// shops raise revenue per passenger with diminishing returns
const sp0 = m.spendPerPax(s), s1 = ok(m.build(s, 5 * m.W + 5, "sh")), sp1 = m.spendPerPax(s1), s2 = ok(m.build(s1, 5 * m.W + 6, "sh")), sp2 = m.spendPerPax(s2); assert.ok(sp0 === 0 && sp1 > 0 && sp2 - sp1 < sp1);
// contracts: demands block signing; three strikes end a contract
const off = { id: "x", al: "BA", perDay: 2, pax: 150, fee: 500, days: 5, left: 0, demand: { gates: 2 }, strikes: 0 }; assert.match(m.sign({ ...s, offers: [off] }, "x"), /jet-bridge/);
let st = { ...s, contracts: [{ ...off, left: 5, strikes: 2 }], today: { ...s.today }, phase: "day" }; st = m.endDay(st).s; assert.ok(!st.contracts.some(c => c.id === "x"), "3rd strike ends the contract");
// no stand → the flight holds then diverts away (cancelled)
let ns = m.startDay({ ...s, grid: s.grid.map(t => t === "st" ? "g" : t) }); for (let i = 0; i < 1000 && ns.phase === "day"; i++) ns = m.step(ns, 5).s; assert.ok(ns.hist.at(-1).cxl >= 5 && ns.hist.at(-1).flights === 0);
// events: a bird strike closes the runway (shorter with bird radar)
const ev = { ...m.startDay(s), evs: [{ id: "b", k: "bird", at: 400 }] }; assert.strictEqual(m.answer(ev, "b", "check").flags.fx.rwClosed, Math.max(ev.clock, 400) + 25);
assert.strictEqual(m.answer({ ...ev, research: { bird: 1 } }, "b", "check").flags.fx.rwClosed, Math.max(ev.clock, 400) + 5);
const sk = { ...m.startDay(s), evs: [{ id: "k", k: "strike", at: 400 }] }; assert.strictEqual(m.answer(sk, "k", "pay").money, sk.money - 4000);
// levels: a big day with a good rating levels the airport up
let lv = { ...s, phase: "day", rep: 60, today: { ...s.today, pax: 4000, ot: 20 } }; lv = m.endDay(lv).s; assert.strictEqual(lv.level, 3, "4,000 pax and 3★ → City airport"); assert.strictEqual(m.stars({ rep: 100 }), 5); assert.strictEqual(m.stars({ rep: 0 }), 1);
// v1 save migration keeps the setup
const mg = m.migrate({ v: 1, stage: "play", name: "Dominik Intl", code: "DOM", region: "pl", op: "fraport", gates: [] }); assert.strictEqual(mg.v, 2); assert.strictEqual(mg.name, "Dominik Intl"); assert.strictEqual(mg.region, "pl"); assert.strictEqual(mg.stage, "play"); assert.ok(mg.contracts.length === 2);
assert.strictEqual(m.migrate(null).stage, "setup");
// sim.ts stays pure (no React/DOM) and logo-free
const src = fs.readFileSync(path.join(here, "../src/mgr/sim.ts"), "utf8"); assert.ok(!/from "react"|document\.|window\./.test(src)); assert.ok(!/logo\.(png|svg)|fraport\.com|aena\.es/.test(src));
console.log("manager sim ok");
