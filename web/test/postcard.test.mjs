// Eurovision Picture Postcard: timeline constants, SSR markup, studio tab, audio engine iOS unlock path, sample photo.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.innerWidth = 390; globalThis.innerHeight = 844;
globalThis.location = { hash: "", origin: "https://x" }; globalThis.history = { replaceState() {}, state: null };
globalThis.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

const out = path.join(here, ".pc-ui.mjs");
await build({ input: path.join(here, "../src/eurovision.tsx"), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty", ".png": "empty", ".webp": "empty", ".svg": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const ui = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const pcOut = path.join(here, ".pc-mod.mjs");
await build({ input: path.join(here, "../src/evpostcard.tsx"), platform: "node", external: [/^react/], moduleTypes: { ".css": "empty" }, logLevel: "silent", output: { file: pcOut, format: "esm", codeSplitting: false }, write: true });
const pc = await import(pathToFileURL(pcOut).href); fs.unlinkSync(pcOut);
const { createElement: h } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");

assert.strictEqual(pc.PC_LEN, 15);
assert.strictEqual(pc.SAMPLE_PHOTO, "/ev/sample-postcard.webp");
assert.ok(fs.statSync(path.join(here, "../public/ev/sample-postcard.webp")).size > 10000, "bundled sample photo");

const info = { country: "Philippines", cc: "PH", artist: "CARMELLE", song: "Sobra-Sobra", lyrics: "A & B" };
for (const style of ["asia", "esc", "jesc"]) {
  const m = renderToStaticMarkup(h(pc.PostcardTV, { style, info, photo: pc.SAMPLE_PHOTO, start: null, onPlay() {} }));
  assert.ok(m.includes("Fan-made recreation"), style + " note");
  assert.ok(m.includes("Philippines"), style + " country (screen-reader text)");
  assert.ok(m.includes("CARMELLE"), style + " artist");
  assert.ok(m.includes("Play postcard"), style + " play button");
  if (style !== "asia") assert.ok(m.includes("/flags/4x3/ph.svg"), style + " flag");
  else assert.ok(m.includes("pa-rb") && m.includes("pa-name"), "asia rainbow artist name");
  assert.ok(!/ebu|eurovision\.tv|official heart logo/i.test(m), "no official marks " + style);
}
// Eurovision Asia: 9 s fashion-shoot postcard with an on-device person cut-out (model + wasm bundled, nothing uploaded)
assert.strictEqual(pc.PC_LEN_ASIA, 9);
assert.strictEqual(pc.SAMPLE_PORTRAIT, "/ev/sample-portrait.webp");
for (const f of ["ev/sample-portrait.webp", "ev/sample-portrait-cut.webp", "mediapipe/selfie_segmenter.tflite", "mediapipe/vision_wasm_internal.wasm", "mediapipe/vision_wasm_internal.js"])
  assert.ok(fs.statSync(path.join(here, "../public/" + f)).size > 10000, "bundled " + f);
const cutSrc = fs.readFileSync(path.join(here, "../src/evcutout.ts"), "utf8");
assert.match(cutSrc, /const BASE = "\/mediapipe\/"/, "segmentation assets served from the app");
assert.ok(!/XMLHttpRequest|sendBeacon|FormData|method: "POST"/.test(cutSrc), "cut-out never uploads the photo");
assert.match(cutSrc, /odml\\.pa\\.googleapis/, "MediaPipe usage logging is blocked");
assert.match(fs.readFileSync(path.join(here, "../src/evcards.tsx"), "utf8"), /= ASIA_T;/, "card + sound share one timeline");
const studio = renderToStaticMarkup(h(ui.EuroStudio));
assert.ok(studio.includes(">Postcard<"), "Postcard tab");

// audio engine: iPhone unlock path + original synthesis only (no audio files)
const a = fs.readFileSync(path.join(here, "../src/evaudio.ts"), "utf8");
assert.match(a, /audioSession/); assert.match(a, /"playback"/);
assert.match(a, /createBuffer\(1, 1, 22050\)/, "silent-buffer unlock");
assert.match(a, /webkitAudioContext/);
assert.ok(!/\.(mp3|m4a|wav|ogg|aac)\b/i.test(a), "no audio files");
// the photo is local only: no upload code in the postcard module
const p = fs.readFileSync(path.join(here, "../src/evpostcard.tsx"), "utf8");
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|FormData/.test(p), "photo never uploaded");
assert.match(p, /indexedDB/);
// stage card sound: taps unlock the shared engine synchronously; auto-plays/loops only sound once it's running
const e = fs.readFileSync(path.join(here, "../src/eurovision.tsx"), "utf8");
assert.match(e, /const replayCard = \(\) => \{ if \(!isMuted\(\)\) unlockAudio\(\);/, "Replay unlocks in the tap");
assert.match(e, /else if \(tab === "stage"\) replayCard\(\); setFull\(true\)/, "Fullscreen on Stage plays with sound");
assert.match(e, /ev-card-loop/); assert.match(e, /audioRunning\(\)/);
assert.match(fs.readFileSync(path.join(here, "../src/evcards.tsx"), "utf8"), /new CustomEvent\("ev-card-loop"/);
assert.match(a, /function scheduleCardBed/);
console.log("postcard ok");
