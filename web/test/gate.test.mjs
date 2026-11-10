// Gate screens + Games: live-flight mapping, bilingual KRK text, share-link round trip, custom board data, and rendering of all 3 designs.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, ".gate-bundle.mjs");
await build({ input: path.join(here, "../src/gate.tsx"), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty", ".woff2": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const { createElement: h } = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
assert.strictEqual(m.styleFor("KRK"), "krk"); assert.strictEqual(m.styleFor("LHR"), "lhr"); for (const a of ["MAN", "EMA", "STN"]) assert.strictEqual(m.styleFor(a), "mag");
assert.strictEqual(m.spaced("FR2616"), "FR 2616"); assert.strictEqual(m.spaced("EZY1872"), "EZY 1872"); assert.strictEqual(m.spaced("D84470"), "D8 4470");
const soon = (min) => new Date(Date.now() + min * 6e4).toISOString();
const F = (st, extra = {}) => ({ id: "x" + st, number: "FR2616", airline: { iata: "FR", name: "Ryanair" }, origin: { iata: "KRK", tz: "Europe/Warsaw" }, destination: { iata: "VDA", city: "Ejlat (Ovda)" }, statusText: st, status: "scheduled", dep: { scheduled: soon(35), gate: "5" }, arr: {}, ...extra });
assert.strictEqual(m.stateOf(F("Final call")), "final"); assert.strictEqual(m.stateOf(F("Boarding")), "boarding"); assert.strictEqual(m.stateOf(F("Cancelled", { status: "cancelled" })), "cancelled"); assert.strictEqual(m.stateOf(F("Gate closed")), "closed");
// KRK: Polish strings come from the feed; next line is the next flight at the same gate
const nxt = { id: "n", number: "EZY1872", destination: { city: "Manchester" }, localName: "MANCHESTER", statusText: "", dep: { scheduled: soon(180), gate: "5" }, arr: {} };
const s = m.specFromFlight({ ...F("Final call"), localName: "EJLAT", remarksLocal: "OSTATNIE WEZWANIE" }, "krk", [nxt]);
assert.strictEqual(s.destPl, "EJLAT"); assert.strictEqual(s.stPl, undefined, "feed remark (may mix languages) is not used"); assert.match(s.next, /^EZY 1872 MANCHESTER \d\d:\d\d$/); assert.strictEqual(s.lang, "enpl"); assert.strictEqual(s.gate, "5");
assert.strictEqual(m.specFromFlight(F("Boarding"), "krk", []).next, "", "no invented next flight");
// share link round trip (unicode)
const g = { ...m.DEFAULT_GATE, dest: "Łódź – Kraków", stPl: "PROSZĘ CZEKAĆ" }; assert.deepStrictEqual(m.dec(m.enc(g)), g); assert.ok(/^[\w-]+$/.test(m.enc(g))); assert.strictEqual(m.dec("!!bad"), null);
// render each design
for (const st of ["mag", "krk", "lhr"]) { const html = renderToStaticMarkup(h(m.GateScreen, { s: { ...m.DEFAULT_GATE, style: st, al: st === "krk" ? "FR" : st === "lhr" ? "BA" : "DY", st: "final" } })); assert.ok(html.includes("gs-" + st), st); assert.ok(/FINAL CALL|Final Call|Final call/i.test(html), st + " status"); }
const lhr = renderToStaticMarkup(h(m.GateScreen, { s: { ...m.DEFAULT_GATE, style: "lhr", al: "BA", num: "BA109", dest: "Dubai", gate: "B32", st: "pre" } }));
assert.ok(lhr.includes("B32") && lhr.includes("Dubai") && /Pre-boarding/.test(lhr) && /young children/.test(lhr), "LHR pre-boarding");
for (const p of m.PRESETS) assert.ok(renderToStaticMarkup(h(m.GateScreen, { s: p.s })).length > 200, p.n);
// custom board data → flight objects TerminalBoard understands
const d = m.boardData(m.BDEF); assert.strictEqual(d.flights.length, m.BDEF.rows.length); for (const f of d.flights) { assert.ok(!isNaN(+new Date(f.dep.scheduled)), "utc time"); assert.ok(f.number && f.airline.iata); }
// Polish status lines are pure Polish, English pure English (no "GATE ZAMKNIĘTY")
for (const [k, v] of Object.entries(m.ST)) { assert.ok(!/GATE|BOARD|CALL|WAIT|CLOSED|OPEN|DELAY|CANCEL|DEPART/.test(v.pl), k + " pl: " + v.pl); assert.ok(!/[ĄĆĘŁŃÓŚŹŻ]/.test(v.en), k + " en"); }
assert.strictEqual(m.ST.closed.pl, "BRAMKA ZAMKNIĘTA"); assert.strictEqual(m.ST.boarding.pl, "WEJŚCIE NA POKŁAD"); assert.strictEqual(m.ST.departed.pl, "ODLECIAŁ");
// screen clocks use the airport's zone
assert.strictEqual(m.tzFor({ style: "krk" }), "Europe/Warsaw"); assert.strictEqual(m.tzFor({ style: "lhr" }), "Europe/London"); assert.strictEqual(m.tzFor({ style: "mag" }), "Europe/London");
assert.strictEqual(m.boardTz("krk"), "Europe/Warsaw"); assert.strictEqual(m.boardTz("mag"), "Europe/London"); assert.strictEqual(m.boardTz("lhr"), "Europe/London");
assert.strictEqual(m.tzOff("UTC"), 0); assert.ok([60, 120].includes(m.tzOff("Europe/Warsaw")));
// a Kraków-style board typed "07:50" shows 07:50 Kraków time
const kb = m.boardData({ ...m.BDEF, theme: "krk" }); const t0 = kb.flights[0].dep.scheduled; assert.strictEqual(new Date(t0).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }), m.BDEF.rows[0].t); assert.strictEqual(kb.airport.tz, "Europe/Warsaw");
// MAG status bars: bright colours with white text
for (const k of ["final", "boarding", "closed", "wait"]) { const c = parseInt(m.ST[k].col.slice(1), 16); const mx = Math.max(c >> 16, (c >> 8) & 255, c & 255); assert.ok(mx >= 0xb0, k + " bar bright"); }
console.log("gate ok");
