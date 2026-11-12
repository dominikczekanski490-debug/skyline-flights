// Announcement maker: airport profiles, script languages, voice picking, and a stubbed play path.
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.innerWidth = 390; globalThis.innerHeight = 844;
globalThis.location = { hash: "", origin: "https://x" }; globalThis.history = { replaceState() {}, state: null };
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
const out = path.join(here, ".announce-bundle.mjs");
await build({ input: path.join(here, "../src/announcer.ts"), platform: "node", moduleTypes: { ".css": "empty" }, logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);

const must = ["MAN", "KRK", "LPA", "SKG", "CFU", "HER", "ZTH", "CHQ", "KGS", "RHO", "JMK", "JTR", "PVK", "EFL", "SMI", "KVA", "MJT", "AOK", "JSI", "ATH", "FRA", "LHR", "LGW"];
for (const c of must) assert.ok(m.AIRPORTS.some(a => a.iata === c), "airport " + c);
assert.strictEqual(m.profileOf("MAN").id, "man");
assert.strictEqual(m.profileOf("LHR").id, "lhr");
assert.strictEqual(m.profileOf("LGW").id, "lgw");
assert.strictEqual(m.profileOf("KRK").id, "pl");
assert.strictEqual(m.profileOf("LPA").id, "lpa");
assert.strictEqual(m.profileOf("FRA").id, "fra");
assert.strictEqual(m.profileOf("SKG").id, "fgr");
assert.strictEqual(m.profileOf("JSI").id, "fgr");
assert.strictEqual(m.profileOf("ATH").id, "el");
assert.strictEqual(m.profileOf("HER").id, "el");
assert.strictEqual(m.profileOf("AOK").id, "el");
assert.ok(m.isFraportGreece("SKG") && m.isFraportGreece("CFU") && !m.isFraportGreece("ATH") && !m.isFraportGreece("HER"));
assert.deepStrictEqual(m.profileOf("MAN").langs, ["en"]);
assert.deepStrictEqual(m.profileOf("KRK").langs, ["pl", "en"]);
assert.deepStrictEqual(m.profileOf("LPA").langs, ["es", "en"]);
assert.deepStrictEqual(m.profileOf("SKG").langs, ["el", "en"]);
assert.deepStrictEqual(m.profileOf("FRA").langs, ["de", "en"]);
assert.deepStrictEqual(m.profileOf("BRU").langs, ["fr", "nl", "en"]);

const f = { ...m.defaultFields(), flight: "FR 2134", airline: "Ryanair", dest: "Fuerteventura", gate: "32", newGate: "B12", delay: "30", passenger: "Alex Kowalski", belt: "4", from: "Manchester", airport: "Kraków" };
const krk = m.buildScript("KRK", "boarding", f);
assert.strictEqual(krk[0].lang, "pl"); assert.strictEqual(krk[1].lang, "en");
assert.ok(/bramki 32/.test(krk[0].text) && /Ryanair/.test(krk[0].text) && /Fuerteventura/.test(krk[0].text));
assert.ok(/gate 32/.test(krk[1].text) && /boarding/i.test(krk[1].text));
const lpa = m.buildScript("LPA", "final", f);
assert.strictEqual(lpa[0].lang, "es"); assert.ok(/Última llamada/.test(lpa[0].text) && /puerta 32/.test(lpa[0].text));
const skg = m.buildScript("SKG", "boarding", f);
assert.strictEqual(skg[0].lang, "el"); assert.ok(/[α-ωΑ-Ω]/.test(skg[0].text) && /πύλη 32/.test(skg[0].text));
const fra = m.buildScript("FRA", "boarding", f);
assert.strictEqual(fra[0].lang, "de"); assert.ok(/Fluggäste|Boarding/.test(fra[0].text) && /Gate 32/.test(fra[0].text));
const man = m.buildScript("MAN", "boarding", f);
assert.strictEqual(man.length, 1); assert.strictEqual(man[0].lang, "en"); assert.ok(/Manchester|Ladies and gentlemen/.test(man[0].text));

const pax = m.buildScript("MAN", "passenger", f); assert.ok(pax[0].text.includes("Alex Kowalski"));
const gc = m.buildScript("MAN", "gatechange", f); assert.ok(gc[0].text.includes("B12") && gc[0].text.includes("32"));
const dl = m.buildScript("KRK", "delay", f); assert.ok(dl.some(l => l.text.includes("30")) && dl[0].lang === "pl");
const bg = m.buildScript("LHR", "baggage", f); assert.ok(bg[0].text.includes("belt 4") && bg[0].text.includes("Manchester"));
const wel = m.buildScript("KRK", "welcome", { ...f, airport: "Kraków" }); assert.ok(wel[0].text.includes("Kraków") && wel[0].text.includes("Manchester"));
const sec = m.buildScript("MAN", "security", f); assert.ok(/security|unattended/i.test(sec[0].text));

for (const t of m.ANN_TYPES) {
  for (const iata of ["MAN", "KRK", "LPA", "SKG", "FRA", "BRU", "CDG", "AMS", "LIS"]) {
    const lines = m.buildScript(iata, t.id, f);
    assert.ok(lines.length >= 1, iata + " " + t.id);
    assert.ok(lines.every(l => l.text && l.speak && l.lang), "text " + iata + " " + t.id);
    const langs = m.profileOf(iata).langs;
    assert.deepStrictEqual(lines.map(l => l.lang), langs);
  }
}

assert.ok(m.chimeDuration(m.profileOf("MAN").chime) !== m.chimeDuration(m.profileOf("FRA").chime));
assert.ok(m.chimeDuration(m.profileOf("LPA").chime) > 1);
assert.ok(JSON.stringify(m.profileOf("MAN").chime) !== JSON.stringify(m.profileOf("LHR").chime));
assert.ok(JSON.stringify(m.profileOf("fgr" in {} ? "SKG" : "SKG").chime) !== JSON.stringify(m.profileOf("FRA").chime));

const voices = [
  { lang: "en-US", name: "Samantha", localService: true, default: false },
  { lang: "en-GB", name: "Daniel", localService: true, default: false },
  { lang: "pl-PL", name: "Zosia", localService: true, default: false },
  { lang: "de-DE", name: "Anna", localService: false, default: true },
];
assert.strictEqual(m.pickVoice(voices, "en", "en-GB").name, "Daniel");
assert.strictEqual(m.pickVoice(voices, "en", "en-US").name, "Samantha");
assert.strictEqual(m.pickVoice(voices, "pl", "en-GB").name, "Zosia");
assert.strictEqual(m.pickVoice(voices, "el", "en-GB"), null);
assert.strictEqual(m.pickVoice([], "en", "en-GB"), null);

// WAV chime is a real RIFF file
const wav = m.chimeWav(m.profileOf("MAN").chime);
assert.ok(wav && wav.size > 44);
const head = new Uint8Array(await wav.slice(0, 12).arrayBuffer());
assert.strictEqual(String.fromCharCode(...head.slice(0, 4)), "RIFF");
assert.strictEqual(String.fromCharCode(...head.slice(8, 12)), "WAVE");

// Stubbed play path: HTMLAudioElement chime + speechSynthesis, including a missing Greek voice fallback.
if (!globalThis.URL) globalThis.URL = {};
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:chime";
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
class Osc { constructor() { this.frequency = { value: 0 }; this.type = "sine"; this.connect = () => this; this.start = () => {}; this.stop = () => {}; } }
class Gain { constructor() { this.gain = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }; this.connect = () => this; } }
class Ctx { constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; } resume() { return Promise.resolve(); } createOscillator() { return new Osc(); } createGain() { return new Gain(); } }
class Utt { constructor(text) { this.text = text; this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onend = null; this.onstart = null; this.onerror = null; } }
globalThis.SpeechSynthesisUtterance = Utt;
const spoken = [];
const order = [];
class AudioStub {
  constructor() { this.src = ""; this.preload = ""; this.currentTime = 0; }
  setAttribute() {}
  play() { order.push("audio.play"); return Promise.resolve(); }
  pause() { order.push("audio.pause"); }
}
const speech = {
  getVoices() { return voices; },
  speak(u) { order.push("speak"); spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 0); },
  cancel() { order.push("cancel"); },
  addEventListener() {},
  removeEventListener() {},
};
const ctl = m.makeCtl();
const lines = m.buildScript("SKG", "boarding", f);
const ev = { line: [], notes: [] };
order.push("handler-start");
const playP = m.playAnnouncement(lines, m.profileOf("SKG"), {
  speech, ctx: new Ctx(), ctl, AudioEl: AudioStub,
  onLine: i => ev.line.push(i),
  onNote: n => n && ev.notes.push(n),
});
order.push("handler-end");
assert.ok(order.indexOf("cancel") > order.indexOf("handler-start"), "cancel in handler: " + order);
assert.ok(order.indexOf("speak") > order.indexOf("cancel"), "speak after cancel: " + order);
assert.ok(order.indexOf("speak") < order.indexOf("handler-end"), "speak is synchronous in the click handler: " + order);
assert.ok(order.indexOf("audio.play") < order.indexOf("handler-end") && order.indexOf("audio.play") > order.indexOf("handler-start"), "audio.play in handler: " + order);
assert.ok(order.filter(x => x === "speak").length >= 2, "pause + lines queued immediately: " + order);
await playP;
assert.ok(spoken.length >= 2, "spoke chime-pause plus lines, got " + spoken.length);
assert.ok(ev.notes.some(n => /Greek/i.test(n)), "missing Greek voice note: " + ev.notes.join(" | "));
assert.ok(spoken.some(t => /boarding|gate/i.test(t)), "English fallback spoken");
assert.ok(ev.line.includes(0) && ev.line.includes(1));

const ctl2 = m.makeCtl();
m.stopPlayback(ctl2, speech);
const ev2 = { done: false };
await m.playAnnouncement(lines, m.profileOf("MAN"), { speech, ctx: new Ctx(), ctl: ctl2, AudioEl: AudioStub, onDone: () => ev2.done = true });
assert.strictEqual(ev2.done, false, "already-stopped play should not finish");

// missing speechSynthesis: chime still plays, missing-speech hook fires, no throw
const ev3 = { miss: false, done: false, played: false };
class Audio2 { constructor() { this.src = ""; this.preload = ""; } setAttribute() {} play() { ev3.played = true; return Promise.resolve(); } pause() {} }
m.startAnnouncement(lines, m.profileOf("MAN"), { speech: null, ctl: m.makeCtl(), AudioEl: Audio2, onMissingSpeech: () => ev3.miss = true, onDone: () => ev3.done = true });
assert.ok(ev3.miss && ev3.played, "missing speech still plays chime");

// Studio renders (load games bundle so AnnounceStudio is wired)
const gout = path.join(here, ".games-ann-bundle.mjs");
await build({ input: path.join(here, "../src/games.tsx"), platform: "node", external: [/^react/, /^maplibre/, /^three/, /^framer-motion/], moduleTypes: { ".css": "empty", ".woff2": "empty", ".png": "empty", ".webp": "empty" }, logLevel: "silent", output: { file: gout, format: "esm", codeSplitting: false }, write: true });
const g = await import(pathToFileURL(gout).href); fs.unlinkSync(gout);
const { createElement: h } = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
assert.ok(g.GAME_IDS.includes("announce"));
const html = renderToStaticMarkup(h(g.GamesView, { tab0: "announce" }));
assert.ok(html.includes("Play announcement"), html.slice(0, 200));
assert.ok(html.includes("Manchester") && html.includes("Kraków") && html.includes("Gran Canaria"));
assert.ok(html.includes("Thessaloniki") && html.includes("Frankfurt") && html.includes("Heathrow"));
assert.ok(html.includes("recreations") && /not official/i.test(html));
assert.ok(html.includes("No sound? Turn off silent mode and turn the volume up."));
assert.ok(!/aena|MAG |Heathrow Airport Limited|kraków airport logo/i.test(html.replace(/Heathrow/g, "")));
console.log("announce ok");
