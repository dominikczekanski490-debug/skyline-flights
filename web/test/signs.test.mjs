// Sign studio: defaults match the photos, presets per theme, Kraków keeps one language per field, theme switching,
// share link round trip with sanitising, row editing, routing, and server render of every theme.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, ".signs-bundle.mjs");
await build({ input: path.join(here, "../src/signs.tsx"), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty", ".png": "empty", ".webp": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
globalThis.location = { hash: "", origin: "https://x" }; globalThis.history = { replaceState() {}, state: null };
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const { createElement: h } = await import("react"); const { renderToStaticMarkup: R } = await import("react-dom/server");
const { DEFAULTS: D } = m;
// photo defaults
const k = D.krk.rows; assert.deepStrictEqual(k.map(r => r.arrow), ["up", "right"]); assert.strictEqual(k[0].lines[0].en, "Check-in 1-18"); assert.strictEqual(k[1].lines[0].en, "Check-in 19-45");
assert.deepStrictEqual(k[0].lines[2], { t: "Skrytki bagażowe", en: "Luggage lockers" }); assert.deepStrictEqual(k[1].lines[1], { t: "Kasy biletowe", en: "Ticket offices" });
assert.deepStrictEqual(D.man.rows.map(r => [r.arrow, r.lines[0].t]), [["upright", "Departures"], ["upright", "Check in"]]);
assert.deepStrictEqual(D.lhr.rows.map(r => r.lines.map(l => l.t)), [["Gates A19-A26"], ["Lounges A1-A2", "Pharmacy", "Multi-faith prayer room"], ["Toilets"]]);
assert.ok(D.lhr.rows.every(r => r.arrow === "left")); assert.ok(D.lhr.rows[1].lines[1].cross); assert.deepStrictEqual(D.lhr.rows[1].lines[0].al, ["LH", "EI"]);
// no mixed language: Kraków `t` is Polish only, English sits in `en`; English words never appear in a Polish field
const EN = /\b(Check|Gates?|Departures|Arrivals|Toilets|Security|Baggage|Luggage|Ticket|Observation|Terminal|reclaim)\b/;
const allKrk = [D.krk, ...m.PRESET_KEYS.map(p => m.presetFor("krk", p))];
for (const s of allKrk) for (const r of s.rows) for (const l of r.lines) { assert.ok(!EN.test(l.t), "Polish field has English: " + l.t); assert.ok(l.en, "English line present"); }
for (const th of ["man", "lhr"]) for (const p of m.PRESET_KEYS) { const s = m.presetFor(th, p); assert.strictEqual(s.theme, th); assert.ok(s.rows.length); for (const r of s.rows) for (const l of r.lines) { assert.ok(!l.en, "single language"); assert.ok(!/[ąęłńóśźżĄĘŁŃÓŚŹŻ]|Odloty|Przyloty|Wyjścia/.test(l.t), "English only: " + l.t); } }
for (const p of ["dep", "arr", "gates", "checkin", "toilets", "security", "reclaim"]) assert.ok(m.PRESET_KEYS.includes(p), p);
// theme switch converts a custom sign without losing it; default switches to the other default
assert.ok(m.isDefault(D.krk)); const c = m.convert(D.krk, "man"); assert.strictEqual(c.rows[0].lines[2].t, "Luggage lockers"); assert.ok(!m.isDefault(c));
const back = m.convert(c, "krk"); assert.strictEqual(back.rows[0].lines[2].en, "Luggage lockers"); assert.strictEqual(back.rows[0].lines[2].t, "");
// share link round trip + sanitising
const s = JSON.parse(JSON.stringify(D.lhr)); s.rows.push({ arrow: "upthen", ics: ["taxi", "nope"], lines: [{ t: "Taxis", al: ["BA", "ZZ9"] }] });
const link = m.signLink(s, "https://x"); assert.match(link, /^https:\/\/x\/#games=signs&s=[\w-]+$/);
const r = m.signFromHash(link.slice(link.indexOf("#"))); assert.strictEqual(r.rows.length, 4); assert.deepStrictEqual(r.rows[3].ics, ["taxi"]); assert.deepStrictEqual(r.rows[3].lines[0].al, ["BA"]); assert.strictEqual(r.rows[3].arrow, "upthen");
assert.deepStrictEqual(m.signFromHash("#games=signs&s=" + link.split("&s=")[1]).rows[1], D.lhr.rows[1]);
assert.strictEqual(m.sanitize({ theme: "xyz", rows: [] }), null); assert.strictEqual(m.sanitize({ theme: "man", rows: Array(20).fill({ arrow: "bad", ics: [], lines: [{ t: 5 }] }) }).rows.length, 8);
assert.strictEqual(m.sanitize({ theme: "man", rows: [{ arrow: "bad", ics: [], lines: [{ t: "x".repeat(99) }] }] }).rows[0].arrow, "none");
// render: every theme and preset; KRK colours split per span
for (const th of ["krk", "man", "lhr"]) for (const p of ["default", ...m.PRESET_KEYS]) assert.ok(R(h(m.SignView, { s: m.presetFor(th, p) })).includes("sg-" + th));
const kh = R(h(m.SignView, { s: D.krk })); assert.ok(kh.includes('<span class="pl">Skrytki bagażowe</span><span class="en">Luggage lockers</span>')); assert.ok(kh.includes("sgk-row div"), "divider");
const lh = R(h(m.SignView, { s: D.lhr })); assert.ok(lh.includes("sl-ic stack") && lh.includes("sg-cross"));
// studio renders from a share link (theme + rows)
location.hash = "#games=signs&s=" + link.split("&s=")[1]; const st = R(h(m.SignStudio)); assert.ok(st.includes("Taxis") && st.includes("sg-lhr") && st.includes("Row 4"));
location.hash = ""; assert.ok(R(h(m.SignStudio)).includes("Polski (white"));
// routing: App hash parser treats #games=signs and a bare &s= share param as the sign studio; Games keeps the share hash
const app = fs.readFileSync(path.join(here, "../src/App.tsx"), "utf8"); assert.ok(app.includes('/[#&]s=/.test(location.hash) ? "signs"'));
const re = /[#&](?:games|ov=games)(?:=([a-z]+))?(?=&|$)/; assert.strictEqual("#games=signs&s=abc".match(re)[1], "signs"); assert.strictEqual("#skin=clearway&games=signs".match(re)[1], "signs");
assert.ok(app.includes(re.source.replace(/\//g, "\\/")) || app.includes("(?:games|ov=games)"));
const g = fs.readFileSync(path.join(here, "../src/games.tsx"), "utf8"); assert.ok(/"signs"/.test(g) && /"announce"/.test(g) && g.includes("[#&][gbs]="));
console.log("signs ok");
