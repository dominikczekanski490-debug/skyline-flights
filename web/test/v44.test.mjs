// v44: the seven new mini-games are registered and lazy-loaded, the Manager/3D are lazy, and the boarding race simulation finishes.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const src = p => fs.readFileSync(path.join(here, "../src", p), "utf8");
const games = src("games.tsx");
for (const [id, file] of [["glide", "glide"], ["roulette", "roulette"], ["pushback", "pushback"], ["boarding", "boarding"], ["gateagent", "gateagent"], ["luggage", "luggage"], ["escape", "escape"]]) {
  assert.match(games, new RegExp(`id: "${id}"`), id + " registered"); assert.match(games, new RegExp(`import\\("./g/${file}"\\)`), file + " lazy-loaded");
  const g = src(`g/${file}.tsx`); assert.match(g, /export default function/); assert.ok(!/logo\.(png|svg)|https?:\/\//.test(g), file + ": no external logos/URLs"); }
assert.ok(!/^import .*from "\.\/manager"/m.test(games), "Manager is not statically imported"); assert.match(games, /import\("\.\/manager"\)/);
assert.match(src("manager.tsx"), /lazy\(\(\) => import\("\.\/mgr3d"\)\)/, "3D view is lazy"); const m3 = src("mgr3d.tsx"); assert.match(m3, /forceContextLoss\(\)/); assert.match(m3, /ren\.dispose\(\)/); assert.match(m3, /InstancedMesh/);
// boarding simulation: every method seats all 180 passengers
const out = path.join(here, ".board-bundle.mjs");
await build({ input: path.join(here, "../src/g/boardsim.ts"), platform: "node", logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const b = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const pax = b.makePax(); assert.strictEqual(pax.length, 180);
const times = {}; for (const m of b.METHODS) { const L = b.mkLane(m.order(pax.map(x => ({ ...x })))); for (let i = 0; i < 20000 && !L.done; i++) b.tick(L); assert.ok(L.done, m.k + " finishes"); assert.strictEqual(L.n, 180); assert.ok(L.seated.flat().every(Boolean)); times[m.k] = L.t; }
assert.ok(times.wilma < times.f2b, "window-middle-aisle beats front-to-back in this model: " + JSON.stringify(times));
console.log("v44 ok");
