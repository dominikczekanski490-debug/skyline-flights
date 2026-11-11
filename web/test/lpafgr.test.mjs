// Gran Canaria (LPA) + Fraport Greece themes: sign defaults/presets/sanitise/share, board themes + auto-routing, board studio data, LPA gate screen.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.innerWidth = 390; globalThis.innerHeight = 844; globalThis.location = { hash: "", origin: "https://x" }; globalThis.history = { replaceState() {}, state: null };
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
const load = async (f) => { const out = path.join(here, `.lf-${f}.mjs`); await build({ input: path.join(here, "../src/" + f), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty", ".png": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true }); const m = await import(pathToFileURL(out).href); fs.unlinkSync(out); return m; };
const S = await load("signs.tsx"), G = await load("gate.tsx"), T = await load("terminal.tsx");
const { createElement: h } = await import("react"); const { renderToStaticMarkup: R } = await import("react-dom/server");
// ---- Sign studio
assert.deepStrictEqual(S.STHEMES.map(t => t[0]), ["krk", "man", "lhr", "lpa", "fgr"]);
const L = S.DEFAULTS.lpa.rows; assert.deepStrictEqual(L.map(r => r.arrow), ["right", "down"]);
assert.deepStrictEqual(L[0].lines[0], { t: "Flugsteige", en: "Gates", es: "Puertas" }); assert.deepStrictEqual([L[0].gates.a, L[0].gates.b, L[1].gates.a, L[1].gates.b], ["C19", "C21", "C18", "C01"]);
assert.deepStrictEqual(L[1].chips, [{ m: "10min.", l: "B", c: "blue" }, { m: "15min.", l: "A", c: "red" }]); assert.ok(L.every(r => r.gates.en === "to" && r.gates.es === "a"));
const F = S.DEFAULTS.fgr; assert.deepStrictEqual(F.rows.map(r => r.lines[0].en), ["Security control", "Passport control", "Boarding Area"]); assert.ok(F.rows.every(r => /[α-ωΑ-Ω]/.test(r.lines[0].t))); assert.deepStrictEqual(F.cap, { on: true, arrow: "right" });
for (const p of S.PRESET_KEYS) { const a = S.presetFor("lpa", p), b = S.presetFor("fgr", p); assert.strictEqual(a.theme, "lpa"); assert.strictEqual(b.theme, "fgr");
  for (const r of a.rows) for (const l of r.lines) { assert.ok(l.t && l.en && l.es, "lpa DE/EN/ES " + p); assert.ok(!/[α-ωΑ-Ω]/.test(l.t)); }
  for (const r of b.rows) for (const l of r.lines) { assert.ok(/[α-ωΑ-Ωά-ώ]/.test(l.t), "Greek field: " + l.t); assert.ok(l.en && !/[α-ωΑ-Ω]/.test(l.en)); } }
// renders
for (const th of ["lpa", "fgr"]) for (const p of ["default", ...S.PRESET_KEYS]) assert.ok(R(h(S.SignView, { s: S.presetFor(th, p) })).includes("sg-" + th), th + p);
const lh = R(h(S.SignView, { s: S.DEFAULTS.lpa })); assert.ok(lh.includes("C19") && lh.includes("C01") && lh.includes("Puertas") && lh.includes("10min.") && lh.includes("15min."));
const fh = R(h(S.SignView, { s: F })); assert.ok(fh.includes("Έλεγχος Ασφαλείας") && fh.includes("sf-cap")); assert.ok(!R(h(S.SignView, { s: { ...F, cap: { on: false, arrow: "right" } } })).includes("sf-cap"));
// share round trip + sanitising of new fields
const c = JSON.parse(JSON.stringify(S.DEFAULTS.lpa)); c.rows[1].chips.push({ m: "20min.", l: "D", c: "nope" }); c.rows[0].gates.a = "X".repeat(40);
const link = S.signLink(c, "https://x"); assert.match(link, /#games=signs&s=[\w-]+$/); const back = S.signFromHash(link.slice(link.indexOf("#")));
assert.strictEqual(back.theme, "lpa"); assert.deepStrictEqual(back.rows[1].chips.slice(0, 2), S.DEFAULTS.lpa.rows[1].chips); assert.ok(back.rows[0].gates.a.length < 40); assert.notStrictEqual(back.rows[1].chips[2]?.c, "nope");
const fb = S.signFromHash(S.signLink({ ...F, cap: { on: false, arrow: "left" } }).replace(/^.*#/, "#")); assert.strictEqual(fb.theme, "fgr"); assert.deepStrictEqual(fb.cap, { on: false, arrow: "left" }); assert.deepStrictEqual(fb.rows, F.rows);
assert.deepStrictEqual(S.signFromHash(S.signLink(S.DEFAULTS.lpa).replace(/^.*#/, "#")), S.DEFAULTS.lpa);
// theme switch keeps English text
const cv = S.convert({ ...S.DEFAULTS.lhr, rows: [{ arrow: "left", ics: ["plane"], lines: [{ t: "Gates 1-9" }] }] }, "fgr"); assert.strictEqual(cv.rows[0].lines[0].en, "Gates 1-9");
location.hash = "#games=signs&s=" + link.split("&s=")[1]; assert.ok(R(h(S.SignStudio)).includes("sg-lpa")); location.hash = "";
// ---- Board themes + routing
assert.ok(T.THEMES.lpa && T.THEMES.fgr); assert.strictEqual(T.autoTheme("LPA"), "lpa"); for (const a of ["SKG", "CFU", "RHO", "ZTH"]) assert.strictEqual(T.autoTheme(a), "fgr");
assert.notStrictEqual(T.autoTheme("ATH"), "fgr", "Athens is not a Fraport Greece airport");
assert.deepStrictEqual(T.THEMES.lpa.cols, ["time", "logo", "fl", "dest", "gate", "st"]); assert.ok(T.THEMES.fgr.cols.includes("via") && T.THEMES.fgr.secs);
assert.strictEqual(T.THEMES.fgr.heads.via, "Μέσω|Via"); assert.deepStrictEqual(T.THEMES.fgr.title("dep"), ["Αναχωρήσεις", "Departures"]);
assert.strictEqual(T.THEMES.lpa.foot, "keine Flugsteige per Lautsprecher Ansage"); assert.strictEqual(T.THEMES.lpa.tr["Final call"], "LAST CALL");
assert.deepStrictEqual(T.status({ remark: { txt: "Gate displayed at 11:35", k: "info" }, dep: {}, arr: {} }, "dep"), { txt: "Gate displayed at 11:35", k: "info" });
// ---- Board studio presets → board data
const gc = G.BPRESETS.find(p => /Gran Canaria/.test(p.n)).b, fg = G.BPRESETS.find(p => /Fraport Greece/.test(p.n)).b;
assert.strictEqual(gc.theme, "lpa"); assert.strictEqual(fg.theme, "fgr"); assert.ok(gc.sign); assert.ok(gc.rows.length >= 12);
const gd = G.boardData({ ...gc, anim: false }); assert.strictEqual(gd.flights.length, gc.rows.length); assert.strictEqual(gd.footer, gc.foot ?? undefined);
const disp = gc.rows.findIndex(r => r.st === "Gate displayed at"); if (disp >= 0) assert.match(gd.flights[disp].remark.txt, /^Gate displayed at/);
const ng = gc.rows.findIndex(r => r.st === "New gate"); assert.ok(ng >= 0); assert.strictEqual(gd.flights[ng].remark.txt, "New gate");
// rows keep the typed order even when the clock has passed the first one
const fd = G.boardData({ ...fg, anim: false }); const ts = fd.flights.map(f => +new Date(f.dep.scheduled)); for (let i = 1; i < ts.length; i++) assert.ok(ts[i] >= ts[i - 1], "order " + i);
const dl = fd.flights[0]; assert.strictEqual(dl.statusText, "Delayed"); assert.ok(+new Date(dl.dep.estimated) - +new Date(dl.dep.scheduled) === 80 * 6e4, "Delayed 11:00 vs 09:40");
assert.strictEqual(G.boardData({ ...gc, foot: "Hola" }).footer, "Hola");
// board share link round trip with the new fields
const bb = { ...gc, dual: true, foot: "Test" }; assert.deepStrictEqual(G.dec(G.enc(bb)), bb);
// board studio renders the LPA composition (sign + two screens)
localStorage.setItem("sk.games.board", JSON.stringify(bb)); const bs = R(h(G.BoardStudio)); assert.ok(bs.includes("lpa-sign") && bs.includes("Salidas") && (bs.match(/bs-board/g) || []).length === 2, "dual + sign");
// ---- Gate studio: LPA
assert.strictEqual(G.styleFor("LPA"), "lpa"); assert.strictEqual(G.tzFor({ style: "lpa" }), "Atlantic/Canary"); assert.ok(G.DIM.lpa);
const gp = G.PRESETS.find(p => p.s.style === "lpa"); assert.ok(gp, "Gran Canaria preset"); assert.deepStrictEqual([gp.s.gate, gp.s.num, gp.s.time, gp.s.dest], ["C06", "VLG3275", "06:45", "Bilbao"]);
const gh = R(h(G.GateScreen, { s: gp.s })); for (const x of ["gs-lpa", "Ausgang", "Puerta", "C06", "VLG 3275", "06:45", "BILBAO", "IB 5427", "PIO PIO", "BOARDING"]) assert.ok(gh.includes(x), x);
for (const st of ["final", "closed", "cancelled", "wait"]) assert.ok(R(h(G.GateScreen, { s: { ...gp.s, st } })).includes("gc-st"), st);
assert.deepStrictEqual(G.dec(G.enc(gp.s)), gp.s);
// live flight → LPA gate spec
const soon = new Date(Date.now() + 40 * 6e4).toISOString();
const sp = G.specFromFlight({ id: "a", number: "VY3275", airline: { iata: "VY", name: "Vueling" }, origin: { iata: "LPA", tz: "Atlantic/Canary" }, destination: { iata: "BIO", city: "Bilbao" }, statusText: "Boarding", status: "scheduled", dep: { scheduled: soon, gate: "C06" }, arr: {} }, "lpa", []);
assert.strictEqual(sp.style, "lpa"); assert.strictEqual(sp.gate, "C06"); assert.ok(R(h(G.GateScreen, { s: sp })).includes("gs-lpa"));
// no operator marks anywhere in the new markup
for (const [n, html] of Object.entries({ lh, fh, gh, bs })) { const hit = html.replace(/<option[^>]*>[^<]*<\/option>/g, "").replace(/Fraport Greece/g, "").match(/.{40}(aena|fraport).{40}/i); assert.ok(!hit, "no operator mark in " + n + ": " + hit?.[0]); }
console.log("lpa/fgr ok");
