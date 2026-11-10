// Clearway skin: status-pill mapping, date header, and the bundled destination data/photos.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, ".cw-bundle.mjs");
await build({ input: path.join(here, "../src/clearway.tsx"), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty", ".woff2": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const T = (h, mm) => `2026-11-10T${h}:${mm}:00Z`; const base = { origin: { iata: "MAN", tz: "Europe/London" }, destination: { iata: "TRF", tz: "Europe/Oslo" }, number: "RK3248", airline: { iata: "RK" } };
const P = (st, extra = {}) => m.pill({ ...base, statusText: st, status: "scheduled", dep: { scheduled: new Date(Date.now() + 40 * 6e4).toISOString(), gate: "49", ...extra.dep }, arr: {}, ...extra }, "dep");
assert.deepStrictEqual(P("Final call"), { t: "Final Call 49", k: "red" });
assert.deepStrictEqual(P("Boarding", { dep: { gate: "52", scheduled: new Date(Date.now() + 30 * 6e4).toISOString() } }), { t: "Boarding 52", k: "green" });
assert.deepStrictEqual(P("Go to gate B1", { dep: { gate: undefined, scheduled: new Date(Date.now() + 50 * 6e4).toISOString() } }), { t: "Go to Gate B1", k: "amber" });
assert.strictEqual(P("Cancelled", { status: "cancelled" }).k, "cx"); assert.strictEqual(P("Cancelled", { status: "cancelled" }).t, "Cancelled");
assert.match(P("").t, /^Departing at \d\d:\d\d$/); assert.strictEqual(P("").k, "blue");
assert.strictEqual(m.capsDate("2026-11-10"), "TUESDAY 10TH NOVEMBER 2026"); assert.strictEqual(m.capsDate("2026-11-01"), "SUNDAY 1ST NOVEMBER 2026"); assert.strictEqual(m.capsDate("2026-11-12"), "THURSDAY 12TH NOVEMBER 2026");
// bundled destination data
const D = JSON.parse(fs.readFileSync(path.join(here, "../public/dest/index.json"), "utf8")); const att = fs.readFileSync(path.join(here, "../public/dest/ATTRIBUTION.md"), "utf8");
assert.ok(Object.keys(D).length > 150, "destinations"); for (const k of ["KRK", "MAN", "ACE"]) assert.ok(D[k]?.img, k + " photo");
for (const [k, v] of Object.entries(D)) { assert.strictEqual(v.iata, k); if (v.img) { const f = path.join(here, "../public/dest", k + ".webp"); assert.ok(fs.existsSync(f), f); assert.ok(fs.statSync(f).size < 90000, k + " size"); assert.ok(v.img.lic && v.img.col, k + " licence/colour"); assert.ok(att.includes(`| ${k} |`), k + " credited"); }
  if (v.climate) { assert.strictEqual(v.climate.hi.length, 12); assert.strictEqual(v.climate.lo.length, 12); v.climate.hi.forEach((h, i) => assert.ok(h >= v.climate.lo[i], k + " hi>=lo")); } }
const lq = fs.readFileSync(path.join(here, "../src/destlqip.ts"), "utf8"); for (const [k, v] of Object.entries(D)) if (v.img) assert.ok(lq.includes(`"${k}":"`), k + " preview");
// no Manchester Airports Group / airport logo artwork anywhere in the bundle assets
for (const f of fs.readdirSync(path.join(here, "../public/logos"))) assert.ok(!/^(MAG|MAN|M\.A\.G)/i.test(f), "airport logo file " + f);
assert.ok(!/\bMAG\b|Manchester Airport/.test(fs.readFileSync(path.join(here, "../src/clearway.tsx"), "utf8")), "no MAG branding in Clearway");
// Tail slot is never empty: tail fin, real logo file, or a coloured code badge — checked for common LHR/MAN carriers
const { createElement: h } = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
for (const c of ["BA", "VS", "EZY", "U2", "LS", "EI", "LH", "AF", "KL", "EK", "QR", "TK", "AA", "DL", "UA", "W6", "FR", "TOM", "RK", "ZZ"]) {
  const a = c.length === 3 ? { icao: c } : { iata: c }; const html = renderToStaticMarkup(h(m.Tail, { a })); const code = m.tailCode(a);
  if (/harp/.test(html)) continue;
  const tl = html.match(/src="\/liveries\/tails\/([A-Z0-9]+)\.webp"/);
  if (tl) { const f = path.join(here, "../public/liveries/tails", tl[1] + ".webp"); assert.ok(fs.existsSync(f) && fs.statSync(f).size > 1000 && fs.statSync(f).size < 40000, c + " tail file"); continue; }
  const img = html.match(/src="\/logos\/([A-Z0-9]+)\.png"/);
  if (img) { const f = path.join(here, "../public/logos", img[1] + ".png"); assert.ok(fs.existsSync(f) && fs.statSync(f).size > 500, c + " logo file"); continue; }
  assert.ok(/cw-badge/.test(html) && html.includes(">" + code + "<"), c + " badge: " + html);
  assert.ok(c === "ZZ", c + " should have a real logo, got badge");
}
// every real tail photo is credited, and every priority carrier (2- and 3-letter codes) resolves to one
const tatt = fs.readFileSync(path.join(here, "../public/liveries/tails/ATTRIBUTION.md"), "utf8");
for (const f of fs.readdirSync(path.join(here, "../public/liveries/tails")).filter(f => f.endsWith(".webp"))) assert.ok(tatt.includes("| " + f + " |") && /\| CC BY|\| Public domain|\| PD/.test(tatt.split("| " + f + " |")[1].split("\n")[0]), f + " credited with a free licence");
for (const c of ["BA", "BAW", "VS", "VIR", "U2", "EZY", "EJU", "EZS", "LS", "EXS", "BY", "TOM", "W6", "WZZ", "WUK", "EI", "LH", "DLH", "AF", "KL", "EK", "QR", "TK", "LO", "LOT", "AA", "DL", "UA", "SK", "SAS", "AY", "IB", "VY", "TP", "LX", "SWR", "OS", "SN"]) {
  const a = c.length === 3 ? { icao: c } : { iata: c }; assert.ok(/liveries\/tails\/[A-Z0-9]+\.webp/.test(renderToStaticMarkup(h(m.Tail, { a }))), c + " has a tail photo");
}
console.log("clearway tests ok");
