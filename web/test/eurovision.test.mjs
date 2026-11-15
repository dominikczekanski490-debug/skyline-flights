// Eurovision studio: prefills, sort/reveal helpers, ISO list, and markup for all 3 cards and boards.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.innerWidth = 390; globalThis.innerHeight = 844;
globalThis.location = { hash: "", origin: "https://x" }; globalThis.history = { replaceState() {}, state: null };
globalThis.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

const dataOut = path.join(here, ".ev-data.mjs");
await build({ input: path.join(here, "../src/eurovision-data.ts"), platform: "node", moduleTypes: { ".css": "empty" }, logLevel: "silent", output: { file: dataOut, format: "esm", codeSplitting: false }, write: true });
const d = await import(pathToFileURL(dataOut).href); fs.unlinkSync(dataOut);

assert.deepStrictEqual(d.EV_STYLES, ["asia", "esc", "jesc"]);
assert.ok(d.ISO_COUNTRIES.length >= 190, "full ISO list");
assert.strictEqual(d.COUNTRY_BY_CC.PH, "Philippines");
assert.strictEqual(d.COUNTRY_BY_CC.CH, "Switzerland");
assert.strictEqual(d.COUNTRY_BY_CC.FR, "France");
assert.strictEqual(d.COUNTRY_BY_CC.XK, "Kosovo");
assert.strictEqual(d.countryFromName("philippines").cc, "PH");
assert.ok(d.evFlag("PH").includes("\uD83C\uDDF5"));

const asia = d.DEFAULT_CARDS.asia;
assert.strictEqual(asia.country, "Philippines");
assert.match(asia.song, /Sobra-Sobra/);
assert.match(asia.artist, /CARMELLE/i);
assert.match(asia.lyrics, /del Rosario/i);

const esc = d.DEFAULT_CARDS.esc;
assert.strictEqual(esc.country, "Switzerland");
assert.strictEqual(esc.song, "Alice");
assert.match(esc.artist, /Veronica Fusaro/);
assert.match(esc.lyrics, /Charlie McClean/);

const jesc = d.DEFAULT_CARDS.jesc;
assert.strictEqual(jesc.country, "France");
assert.match(jesc.song, /Comment tu vas/);
assert.match(jesc.artist, /ALEC/i);
assert.match(jesc.lyrics, /Burette/);

assert.strictEqual(d.sortRows(d.ASIA_BOARD)[0].cc, "PH");
assert.strictEqual(d.sortRows(d.ASIA_BOARD)[0].points, 211);
assert.strictEqual(d.sortRows(d.ASIA_BOARD).length, 11);
assert.strictEqual(d.DEFAULT_BOARDS.asia.round, "gf");
assert.strictEqual(d.sortRows(d.ESC_BOARD).find(r => r.cc === "CH").points, 108);
assert.strictEqual(d.DEFAULT_BOARDS.esc.round, "sf2");
assert.strictEqual(d.sortRows(d.JESC_BOARD)[0].cc, "AM");
assert.strictEqual(d.sortRows(d.JESC_BOARD)[0].points, 202);
assert.strictEqual(d.sortRows(d.JESC_BOARD).length, 16);
assert.ok(d.qualifies("sf2", 10) && !d.qualifies("sf2", 11) && !d.qualifies("gf", 1));
assert.strictEqual(d.boardColumns("asia", 11, false), 1);
assert.strictEqual(d.boardColumns("jesc", 16, false), 2);
assert.strictEqual(d.boardColumns("esc", 15, false), 2);

const added = d.addPoints(d.ASIA_BOARD, "th", 12);
assert.strictEqual(d.sortRows(added)[0].cc, "PH");
const jump = d.addPoints(d.ASIA_BOARD, "bd", 200);
assert.strictEqual(d.sortRows(jump)[0].cc, "BD");
const plus = d.addCountry(d.ASIA_BOARD, "JP");
assert.ok(plus.some(r => r.cc === "JP"));
assert.strictEqual(d.addCountry(plus, "JP").length, plus.length);
assert.ok(!d.removeCountry(plus, plus.find(r => r.cc === "JP").id).some(r => r.cc === "JP"));

const store = d.defaultStore();
d.saveStore(store);
const loaded = d.loadStore();
assert.strictEqual(loaded.cards.asia.song, "Sobra-Sobra");
assert.strictEqual(loaded.boards.jesc.rows.length, 16);

const uiOut = path.join(here, ".ev-ui.mjs");
await build({ input: path.join(here, "../src/eurovision.tsx"), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty", ".png": "empty", ".webp": "empty", ".svg": "empty" }, logLevel: "silent", output: { file: uiOut, format: "esm", codeSplitting: false }, write: true });
const ui = await import(pathToFileURL(uiOut).href); fs.unlinkSync(uiOut);
const { createElement: h } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");

for (const style of d.EV_STYLES) {
  const card = renderToStaticMarkup(h(ui.StageCard, { card: d.DEFAULT_CARDS[style], play: 0 }));
  assert.ok(card.includes("Fan-made recreation"), style + " note");
  assert.ok(!/ebu|eurovision\.tv|official heart logo/i.test(card), "no official marks " + style);
  if (style === "asia") { assert.ok(card.includes("PHILIPPINES") || card.includes("Philippines")); assert.ok(card.includes("Sobra-Sobra")); assert.ok(card.includes("CARMELLE")); }
  if (style === "esc") { assert.ok(card.includes("Switzerland")); assert.ok(card.includes("Alice")); assert.ok(card.includes("Veronica Fusaro")); }
  if (style === "jesc") { assert.ok(card.includes("FRANCE") || card.includes("France")); assert.ok(/COMMENT TU VAS/i.test(card)); assert.ok(/ALEC/i.test(card)); assert.ok(card.includes("ev-crown")); }
  const board = renderToStaticMarkup(h(ui.ScoreBoard, { board: d.DEFAULT_BOARDS[style], wide: false }));
  assert.ok(board.includes("Fan-made recreation"), style + " board note");
  assert.ok(board.includes("/flags/4x3/"), style + " flags");
  if (style === "asia") { assert.ok(board.includes("Philippines") && board.includes("211") && board.includes("Grand Final")); }
  if (style === "esc") { assert.ok(board.includes("Switzerland") && board.includes("108") && board.includes("Semi-final 2") && board.includes(">Q<")); }
  if (style === "jesc") { assert.ok(board.includes("Armenia") && board.includes("202") && board.includes("France")); }
}

const studio = renderToStaticMarkup(h(ui.EuroStudio));
assert.ok(studio.includes("Stage") && studio.includes("Scoreboard"));
assert.ok(studio.includes("Eurovision Asia") && studio.includes("Junior Eurovision"));
assert.ok(studio.includes("Fan-made recreation"));
assert.ok(studio.includes('id="ev-countries"'));

const src = fs.readFileSync(path.join(here, "../src/games.tsx"), "utf8");
assert.ok(src.includes('"eurovision"'));
assert.ok(src.includes("EuroStudio"));
const sw = fs.readFileSync(path.join(here, "../public/sw.js"), "utf8");
assert.match(sw, /skyline-v35/);
console.log("eurovision ok");
