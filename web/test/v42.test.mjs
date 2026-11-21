// v42: Manchester "Gate Closed" idle screen, planespotting gate, Katowice board/sign themes, radar-style airport page dot rule.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = async (src) => { const out = path.join(here, `.v42-${path.basename(src, ".tsx")}.mjs`); await build({ input: path.join(here, "../src/" + src), platform: "node", external: [/^react/, /^html-to-image/], moduleTypes: { ".css": "empty", ".woff2": "empty", ".png": "empty", ".jpg": "empty", ".svg": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true }); const m = await import(pathToFileURL(out).href); fs.unlinkSync(out); return m; };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} }; globalThis.sessionStorage ??= globalThis.localStorage;
const { createElement: h } = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
const g = await bundle("gate.tsx");
const idle = renderToStaticMarkup(h(g.GateScreen, { s: { ...g.DEFAULT_GATE, style: "mag", gate: "A6", idle: true, st: "closed" } }));
assert.match(idle, /Gate Closed/); assert.match(idle, /Manchester/); assert.match(idle, /Airport/); assert.match(idle, />A6</); assert.ok(!/\bMAG\b/.test(idle.replace(/gs-mag|gm-[\w-]+/g, "")), "no MAG text in the idle band");
const spot = renderToStaticMarkup(h(g.GateScreen, { s: { ...g.DEFAULT_GATE, style: "spot", ac: "A388", reg: "A6-EOE", al: "EK", num: "EK18", dest: "Dubai" } }));
assert.match(spot, /gs-spot/); assert.match(spot, /A6-EOE/); assert.match(spot, /A380/);
const src = (f) => fs.readFileSync(path.join(here, "../src/" + f), "utf8");
assert.match(src("terminal.tsx"), /ktw:\s*\{/); assert.match(src("terminal.tsx"), /WYJŚCIE/);
assert.match(src("signs.tsx"), /"ktw"/); assert.match(src("fids.tsx"), /export async function ktwFlights|export const ktwFlights|ktwFlights/);
assert.match(src("games.tsx"), /gatebuild/); assert.match(src("games.tsx"), /AirportManager/);
assert.ok(!/fraport\.com|aena\.es|\blogo\.(png|svg)/i.test(src("manager.tsx")), "no operator logos in the manager game");
// radar-style page: dot colour rule
const r = await bundle("radar.tsx"); const t = (m) => new Date(Date.parse("2026-11-21T12:00:00Z") + m * 6e4).toISOString();
const F = (late, extra = {}) => ({ status: "scheduled", dep: { scheduled: t(0), estimated: late == null ? undefined : t(late) }, arr: {}, ...extra });
assert.strictEqual(r.dotOf(F(5), "dep"), "g"); assert.strictEqual(r.dotOf(F(20), "dep"), "y"); assert.strictEqual(r.dotOf(F(50), "dep"), "r"); assert.strictEqual(r.dotOf(F(0, { status: "cancelled" }), "dep"), "r"); assert.strictEqual(r.dotOf(F(null), "dep"), "g0");
assert.ok(!/flightradar|fr24/i.test(src("radar.tsx").replace(/^\/\/.*$/gm, "")), "no third-party name in the radar page UI");
console.log("v42 ok");
