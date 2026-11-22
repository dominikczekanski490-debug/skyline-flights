// v46: Airport Builder 3D sandbox. Placement rules, caps, edits, undo-friendly immutability, compact save/load and the Manager import.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const src = p => fs.readFileSync(path.join(here, "../src", p), "utf8");
const games = src("games.tsx");
assert.match(games, /id: "sandbox", name: "Airport Builder 3D"/); assert.match(games, /import\("\.\/g\/sandbox"\)/, "lazy-loaded");
const ui = src("g/sandbox.tsx"); assert.match(ui, /import\("\.\/sb3d"\)/, "three.js only loads when the builder opens"); assert.ok(!/^import .*from "three"/m.test(ui));
const eng = src("g/sb3d.ts"); assert.match(eng, /forceContextLoss\(\)/); assert.match(eng, /ren\.dispose\(\)/); for (const f of [ui, eng]) assert.ok(!/logo\.(png|svg)|https?:\/\//.test(f), "no external logos/URLs");
assert.match(src("manager.tsx"), /#games=sandbox/, "reachable from Airport Manager");
assert.match(fs.readFileSync(path.join(here, "../public/sw.js"), "utf8"), /skyline-v46/);
const out = path.join(here, ".sbcore-bundle.mjs"); await build({ input: path.join(here, "../src/g/sbcore.ts"), platform: "node", logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const S = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const O = { lay: "out" };
// placement + snapping + immutability
{ const s0 = S.blank(); const r = S.place(s0, O, "term", 3, 41, 0); assert.ok(!r.err); assert.strictEqual(s0.out.length, 0, "place doesn't mutate"); assert.deepStrictEqual([r.it.x, r.it.z], [5, 40], "snapped to 5 m"); assert.deepStrictEqual(r.s.ins[String(r.it.i)], []); assert.deepStrictEqual(r.s.fl[String(r.it.i)], [0, 3]);
  assert.match(S.place(r.s, O, "hangar", 5, 40).err, /in the way/, "solid buildings can't overlap");
  assert.ok(!S.place(r.s, O, "road", 5, 40).err, "flat things can go under/over"); assert.match(S.place(r.s, O, "term", 389, 0).err, /edge/); assert.match(S.place(r.s, O, "checkin", 0, 0).err, /doesn't go here/);
  // interior: must fit inside the walls; floors don't collide; the lift spans both floors
  const T = { lay: "in", term: r.it.i }; let s = r.s; const a = S.place(s, T, "shop", 0, 0, 0, { f: 0 }); assert.ok(!a.err); s = a.s;
  assert.ok(!S.place(s, T, "shop", 0, 0, 0, { f: 1 }).err, "a different floor is free"); assert.match(S.place(s, T, "shop", 0, 0, 0, { f: 0 }).err, /in the way/); assert.match(S.place(s, T, "gate", 34, 0, 0, { f: 0 }).err, /inside the terminal/);
  const l = S.place(s, T, "lift", 10, 10, 0, { f: 0 }); assert.ok(!l.err); assert.match(S.place(l.s, T, "wc", 10, 10, 0, { f: 1 }).err, /in the way/, "lift blocks both floors");
  // edit: rotate, length clamp, move collision; remove terminal removes its inside
  const rw = S.place(S.blank(), O, "runway", 0, 0).s; const id = rw.out[0].i; assert.strictEqual(S.edit(rw, O, id, { s: 5000 }).s.out[0].s, 760); assert.strictEqual(S.edit(rw, O, id, { r: -15 }).s.out[0].r, 345);
  const gone = S.remove(l.s, O, r.it.i); assert.strictEqual(gone.out.length, 0); assert.strictEqual(gone.ins[String(r.it.i)], undefined);
  const d = S.duplicate(r.s, O, r.it.i); assert.ok(!d.err); assert.strictEqual(d.s.out.filter(o => o.k === "term").length, 2); }
// caps keep the iPhone safe
{ let s = S.blank(); for (let k = 0; k < S.CAP.term; k++) s = S.place(s, O, "term", -300 + k * 80, 0, 0, { s: 0 }).s; assert.strictEqual(s.out.length, S.CAP.term); assert.match(S.place(s, O, "term", 0, 300, 0, { s: 0 }).err, /terminals/);
  let t = S.blank(); for (let k = 0; t.out.length < S.CAP.out; k++) t = S.place(t, O, "tree", -380 + (k % 60) * 12, -380 + Math.floor(k / 60) * 12).s; assert.match(S.place(t, O, "tree", 300, 300).err, /iPhone/); }
// save/load round trip (compact) and bad data
{ const s = S.starter(); const c = S.counts(s); assert.ok(c.out >= 30 && c.in >= 12, "starter is a real airport"); const txt = S.encode(s); assert.ok(txt.length < 4000, "compact: " + txt.length);
  const back = S.decode(txt); assert.deepStrictEqual(back, s, "round trip"); assert.strictEqual(S.decode("nope"), null); assert.strictEqual(S.decode('{"v":9}'), null);
  const j = JSON.parse(txt); j.o.push(["ufo", 0, 0, 0, null, null, null, 999]); const b2 = S.decode(JSON.stringify(j)); assert.strictEqual(b2.out.length, s.out.length, "unknown kinds dropped"); assert.ok(b2.nid > Math.max(...s.out.map(o => o.i)));
  const ts = s.out.filter(o => o.k === "term"); for (const t of ts) for (const it of s.ins[String(t.i)]) assert.strictEqual(S.check(s, { lay: "in", term: t.i }, it, it.i), null, "starter interior is valid"); }
// Airport Manager import
{ const W = 14, H = 10; const g = Array(W * H).fill("g"); for (let x = 0; x < W; x++) { g[W + x] = "rw"; g[2 * W + x] = "tx"; } g[3 * W + 3] = "st"; g[3 * W + 5] = "gt"; g[4 * W + 4] = "tm"; g[4 * W + 5] = "tm"; g[5 * W + 4] = "sc"; g[5 * W + 5] = "sh"; g[7 * W + 3] = "pk"; g[8 * W + 8] = "tw";
  const s = S.fromManager(g, "Test"); const k = s.out.map(o => o.k); for (const x of ["runway", "taxi", "term", "stand", "bridge", "plane", "park", "tower"]) assert.ok(k.includes(x), x);
  const t = s.out.find(o => o.k === "term"); const ins = s.ins[String(t.i)].map(o => o.k); for (const x of ["security", "shop", "checkin", "gate", "esc"]) assert.ok(ins.includes(x), "inside " + x); }
console.log("v46 sandbox ok");
