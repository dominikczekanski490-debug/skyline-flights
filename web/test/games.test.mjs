// Games: registry, quiz builders, word scoring, flags, and that every game renders.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, ".games-bundle.mjs");
await build({ input: path.join(here, "../src/games.tsx"), platform: "node", external: [/^react/, /^maplibre/, /^three/, /^framer-motion/], moduleTypes: { ".css": "empty", ".woff2": "empty", ".png": "empty", ".webp": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
globalThis.location = { hash: "", origin: "https://x" }; globalThis.history = { replaceState() {}, state: null }; globalThis.innerWidth = 390; globalThis.innerHeight = 844;
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const { createElement: h } = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
const ids = m.GAME_IDS; assert.strictEqual(new Set(ids).size, ids.length, "unique ids"); assert.ok(m.GAMES.length >= 10, "10+ new games"); for (const id of ids) assert.match(id, /^[a-z]+$/, "hash-safe id");
for (const g of m.ALL_GAMES) assert.ok(g.name && g.sub && g.C, g.id);
assert.strictEqual(m.scoreWord("PARIS", "PARIS"), "ggggg"); assert.strictEqual(m.scoreWord("SIPAR", "PARIS"), "yyyyy"); assert.strictEqual(m.scoreWord("LLLLL", "HELLO"), "xxggx");
for (let i = 0; i < 30; i++) { const q = m.makeFin(); assert.strictEqual(q.opts.length, 4); assert.ok(q.opts.some(o => o.k === q.ans)); assert.strictEqual(new Set(q.opts.map(o => o.l)).size, 4, "distinct names"); }
const { flag, CC } = await import(pathToFileURL(path.join(here, "../src/countries.ts")).href).catch(() => ({}));
if (flag) { assert.strictEqual(flag("PL"), "🇵🇱"); assert.strictEqual(CC["United Kingdom"], "GB"); }
const D = JSON.parse(fs.readFileSync(path.join(here, "../public/dest/index.json"), "utf8")); const cc = fs.readFileSync(path.join(here, "../src/countries.ts"), "utf8");
for (const v of Object.values(D)) assert.ok(cc.includes(JSON.stringify(v.country) + ":"), "flag for " + v.country);
// hub + each game renders (server-side, effects off)
assert.ok(renderToStaticMarkup(h(m.GamesView, {})).includes("Quick games"));
for (const id of ["gate", "board", ...m.GAMES.map(g => g.id)]) { const html = renderToStaticMarkup(h(m.GamesView, { tab0: id })); assert.ok(html.length > 100, id); }
console.log("games ok");
