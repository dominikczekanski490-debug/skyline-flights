/** Eurovision studio sound engine — original music synthesised live with Web Audio (no samples, no recordings).
 *  iPhone Safari: call unlockAudio() synchronously inside the tap handler before anything async. */
import type { EvStyle } from "./eurovision-data";

const MUTE_KEY = "sk.games.euro.mute";
const LEVEL = .72;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fxIn: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let live: GainNode[] = [];

export const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } };
export function setMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* private mode */ }
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, .04);
}

/** Main bus: per-play gains → master → compressor → speakers, with a generated-impulse reverb send. */
function buildBus(ac: BaseAudioContext) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
  const m = ac.createGain(); m.gain.value = isMuted() && ac instanceof AudioContext ? 0 : LEVEL;
  m.connect(comp); comp.connect(ac.destination);
  const verb = ac.createConvolver(); verb.buffer = impulse(ac, 2.3, 2.6);
  const send = ac.createGain(); send.gain.value = .28; const vr = ac.createGain(); vr.gain.value = 1;
  send.connect(verb); verb.connect(vr); vr.connect(m);
  return { master: m, fx: send };
}
function impulse(ac: BaseAudioContext, sec: number, decay: number) {
  const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let s = 12345 + c * 777; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / n, decay); } }
  return b;
}
function noise(ac: BaseAudioContext) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  let s = 987654; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
  return (noiseBuf = b);
}

/** Must run synchronously in a user gesture (tap). Returns the running context or null if Web Audio is missing. */
export function unlockAudio(): AudioContext | null {
  try { const s = (navigator as any).audioSession; if (s && s.type !== "playback") s.type = "playback"; } catch { /* older Safari */ }
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: "interactive" }) as AudioContext; } catch { ctx = new AC() as AudioContext; }
    const bus = buildBus(ctx); master = bus.master; fxIn = bus.fx;
  }
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* ignore */ }
  return ctx;
}

/** Fade out and drop everything currently playing. */
export function stopAll(fade = .25) {
  if (!ctx) return; const t = ctx.currentTime;
  for (const g of live) { try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); setTimeout(() => g.disconnect(), fade * 1000 + 120); } catch { /* gone */ } }
  live = [];
}

/* ───────────── instruments (all schedule ahead on any BaseAudioContext) ───────────── */
type Out = { ac: BaseAudioContext; out: AudioNode; fx: AudioNode; n: { count: number } };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
function env(o: Out, t: number, a: number, peak: number, dur: number, rel: number, dest: AudioNode) {
  const g = o.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(.0008, t + Math.max(a, dur) + rel); g.connect(dest); o.n.count++; return g;
}
function osc(o: Out, type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0) {
  const s = o.ac.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t); s.detune.value = detune; s.connect(dest); s.start(t); s.stop(end); o.n.count++; return s;
}
function nsrc(o: Out, t: number, end: number, dest: AudioNode) {
  const s = o.ac.createBufferSource(); s.buffer = noise(o.ac); s.loop = true; s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(end); o.n.count++; return s;
}
function filt(o: Out, type: BiquadFilterType, f: number, q: number, dest: AudioNode) { const b = o.ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); o.n.count++; return b; }

function kick(o: Out, t: number, v = 1) {
  const g = env(o, t, .002, .95 * v, .02, .34, o.out);
  const s = osc(o, "sine", 160, t, t + .45, g); s.frequency.exponentialRampToValueAtTime(44, t + .13);
  const c = env(o, t, .001, .25 * v, .004, .02, o.out); nsrc(o, t, t + .04, filt(o, "highpass", 2500, .7, c));
}
function snare(o: Out, t: number, v = 1, clap = false) {
  const bp = filt(o, "bandpass", clap ? 1400 : 1900, clap ? 1.2 : .7, o.out);
  if (clap) { for (let i = 0; i < 3; i++) { const g = env(o, t + i * .011, .001, .5 * v, .004, .02, bp); nsrc(o, t + i * .011, t + i * .011 + .05, g); } }
  const g = env(o, t + (clap ? .033 : 0), .001, .55 * v, .01, clap ? .16 : .19, bp); nsrc(o, t, t + .32, g);
  if (!clap) { const b = env(o, t, .001, .3 * v, .01, .09, o.out); osc(o, "triangle", 190, t, t + .14, b); }
  const s = env(o, t, .001, .12 * v, .01, .25, o.fx); nsrc(o, t, t + .3, filt(o, "bandpass", 2200, .8, s));
}
function hat(o: Out, t: number, v = 1, open = false) {
  const g = env(o, t, .001, .16 * v, .004, open ? .2 : .035, filt(o, "highpass", 7600, .6, o.out)); nsrc(o, t, t + (open ? .3 : .07), g);
}
function crash(o: Out, t: number, v = 1) {
  const g = env(o, t, .002, .3 * v, .03, 1.7, filt(o, "highpass", 4200, .4, o.out)); nsrc(o, t, t + 2, g);
  const f = env(o, t, .002, .18 * v, .03, 1.5, o.fx); nsrc(o, t, t + 1.8, filt(o, "highpass", 3000, .4, f));
}
function boom(o: Out, t: number, v = 1) {
  const g = env(o, t, .003, 1.1 * v, .05, 1.1, o.out); const s = osc(o, "sine", 90, t, t + 1.3, g); s.frequency.exponentialRampToValueAtTime(30, t + .9);
  const n = env(o, t, .001, .5 * v, .02, .5, filt(o, "lowpass", 900, .5, o.out)); nsrc(o, t, t + .6, n);
  const r = env(o, t, .001, .45 * v, .02, .9, o.fx); nsrc(o, t, t + 1, filt(o, "lowpass", 2400, .5, r));
  crash(o, t, .8 * v);
}
function riser(o: Out, t: number, dur: number, v = 1) {
  const bp = filt(o, "bandpass", 300, 2.2, o.out); bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = o.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32 * v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .05); g.connect(bp); o.n.count++;
  nsrc(o, t, t + dur + .1, g);
  const tg = o.ac.createGain(); tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(.07 * v, t + dur); tg.gain.linearRampToValueAtTime(0, t + dur + .04); tg.connect(o.out); o.n.count++;
  const s = osc(o, "sawtooth", 180, t, t + dur + .1, filt(o, "lowpass", 2500, .5, tg)); s.frequency.exponentialRampToValueAtTime(1100, t + dur);
}
function whoosh(o: Out, t: number, dur = .7, v = 1) {
  const bp = filt(o, "bandpass", 5000, 1.4, o.out); bp.frequency.setValueAtTime(5500, t); bp.frequency.exponentialRampToValueAtTime(260, t + dur);
  const g = o.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55 * v, t + dur * .35); g.gain.exponentialRampToValueAtTime(.001, t + dur); g.connect(bp); o.n.count++;
  nsrc(o, t, t + dur + .05, g);
  const r = env(o, t + dur * .3, .01, .16 * v, .05, .6, o.fx); nsrc(o, t, t + dur + .7, filt(o, "bandpass", 1600, .8, r));
}

type Flavour = { chords: number[][]; roots: number[]; lead: number[]; pad: OscillatorType; padCut: number; arp: OscillatorType; bass: OscillatorType; bell?: boolean; four: boolean; hats16: boolean; clap: boolean; pump: number };
const FLAV: Record<EvStyle, Flavour> = {
  // Eurovision Asia: warm "royal road" progression (IV–V–iii–vi), pentatonic plucks
  asia: { chords: [[53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 62], [57, 60, 64, 69]], roots: [41, 43, 40, 45],
    lead: [76, 74, 72, 74, 76, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 69], pad: "sawtooth", padCut: 1700, arp: "square", bass: "sawtooth", four: true, hats16: false, clap: false, pump: .45 },
  // Eurovision 2026: dark neon electro-pop in F# minor, supersaw + heavy sidechain
  esc: { chords: [[54, 57, 61, 66], [50, 54, 57, 62], [57, 61, 64, 69], [52, 56, 59, 64]], roots: [42, 38, 45, 40],
    lead: [73, 73, 71, 69, 73, 76, 73, 71, 69, 69, 66, 69, 71, 73, 71, 69], pad: "sawtooth", padCut: 1250, arp: "sawtooth", bass: "sawtooth", four: true, hats16: true, clap: true, pump: .7 },
  // Junior Eurovision 2026: bright C major bubblegum, bell arps and claps
  jesc: { chords: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], roots: [48, 43, 45, 41],
    lead: [79, 76, 79, 81, 79, 76, 74, 76, 77, 76, 74, 72, 74, 76, 79, 79], pad: "triangle", padCut: 2600, arp: "sine", bass: "square", bell: true, four: false, hats16: true, clap: true, pump: .35 },
};

/** The ~15 s postcard bed. Bars are 2 s (120 bpm). Impact at 11.0 s when the country lands; whoosh into the card at 15 s. */
export const BED_LEN = 15, BED_IMPACT = 11, CARD_HIT: Record<EvStyle, number> = { asia: .55, esc: .75, jesc: 1.55 };
function scheduleBed(o: Out, style: EvStyle, t0: number) {
  const F = FLAV[style], B = .5, bar = 2;
  const padBus = o.ac.createGain(); padBus.gain.value = 1; padBus.connect(o.out); o.n.count++;
  const padLP = filt(o, "lowpass", F.padCut, .7, padBus);
  padLP.frequency.setValueAtTime(F.padCut * .35, t0); padLP.frequency.exponentialRampToValueAtTime(F.padCut, t0 + 4);
  padLP.frequency.setValueAtTime(F.padCut, t0 + 9); padLP.frequency.exponentialRampToValueAtTime(F.padCut * .5, t0 + 10.9); padLP.frequency.setValueAtTime(F.padCut * 1.15, t0 + 11);
  const padSend = o.ac.createGain(); padSend.gain.value = .35; padSend.connect(o.fx); padLP.connect(padSend); o.n.count++;
  const drumsOn = (t: number) => t >= 2 && !(t >= 10.5 && t < 11);
  for (let b = 0; b < 8; b++) {
    const tb = t0 + b * bar, ci = b % 4, ch = F.chords[ci];
    // pad chord (two detuned voices per note); the last bar is cut short under the whoosh
    const pd = b === 7 ? .7 : bar - .15;
    const g = env(o, tb, .12, .055, pd, .35, padLP);
    for (const m of ch) for (const d of [-9, 9]) osc(o, F.pad, mtof(m), tb, tb + pd + .5, g, d);
    for (let q = 0; q < 4; q++) {
      const tq = tb + q * B, rel = tq - t0;
      if (rel >= BED_LEN) break;
      // sidechain pump on the pad
      if (drumsOn(rel) && (F.four || q % 2 === 0)) { padBus.gain.setValueAtTime(1 - F.pump, tq); padBus.gain.linearRampToValueAtTime(1, tq + .28); }
      if (drumsOn(rel)) {
        if (F.four || q === 0 || q === 2) kick(o, tq, rel < 4 ? .8 : 1);
        if (!F.four && q === 1) kick(o, tq + B * .5, .7);
        if (rel >= 4 && (q === 1 || q === 3)) snare(o, tq, rel >= 11 ? 1 : .85, F.clap);
        const steps = F.hats16 && rel >= 4 ? 4 : 2;
        for (let h = 0; h < steps; h++) { const th = tq + h * B / steps; if (steps === 2 && h === 0) continue; hat(o, th, steps === 4 && h % 2 ? .55 : .9, steps === 2 && q === 3 && rel >= 11); }
      }
      // bass on 8ths from bar 1
      if (rel >= 2 && !(rel >= 10.5 && rel < 11)) for (let e = 0; e < 2; e++) {
        const te = tq + e * B / 2, r = F.roots[ci] + (style === "esc" && e === 1 ? 12 : 0);
        const g = env(o, te, .005, style === "jesc" ? .12 : .17, .14, .08, filt(o, "lowpass", style === "esc" ? 520 : 680, 4, o.out));
        osc(o, F.bass, mtof(r), te, te + .3, g); osc(o, "sine", mtof(r - 12), te, te + .3, g);
      }
      // arp 16ths
      for (let s = 0; s < 4; s++) {
        const ts = tq + s * B / 4, rs = ts - t0; if (rs >= 14.6) break;
        const step = (q * 4 + s), note = ch[step % ch.length] + 12 + (step % 8 >= 4 ? 12 : 0);
        const v = (rs < 2 ? .4 + rs * .3 : 1) * (F.bell ? .07 : .045);
        const cut = filt(o, "lowpass", rs < 4 ? 1400 + rs * 600 : 4200, 1.5, o.out);
        const g = env(o, ts, .003, v, .02, F.bell ? .32 : .11, cut);
        osc(o, F.arp, mtof(note), ts, ts + .45, g);
        if (F.bell) { const m = o.ac.createOscillator(); const mg = o.ac.createGain(); m.frequency.value = mtof(note) * 3.5; mg.gain.value = mtof(note) * 1.2; m.connect(mg); o.n.count += 2;
          const car = osc(o, "sine", mtof(note), ts, ts + .45, g); mg.connect(car.frequency); m.start(ts); m.stop(ts + .45); }
        if (s === 2 && q % 2 === 1) { const e = env(o, ts, .003, v * .6, .02, .25, o.fx); osc(o, F.arp, mtof(note), ts, ts + .4, e); }
      }
    }
  }
  // build: snare roll 8.5–10.5, riser into the impact, drop, impact at 11
  for (let t = 8.5; t < 10.45;) { const p = (t - 8.5) / 2; snare(o, t0 + t, .25 + p * .6, false); t += p < .4 ? .25 : p < .75 ? .125 : .0625; }
  riser(o, t0 + 8.7, 2.25);
  boom(o, t0 + BED_IMPACT, 1);
  // chorus lead 11–14.6
  for (let i = 0; i < 16; i++) {
    const t = t0 + 11 + i * .25; if (t - t0 > 14.6) break;
    const m = F.lead[i % F.lead.length];
    const g = env(o, t, .01, F.bell ? .06 : .05, .16, .14, filt(o, "lowpass", 3800, 1, o.out));
    osc(o, style === "jesc" ? "triangle" : "square", mtof(m), t, t + .4, g, 0); osc(o, "sawtooth", mtof(m), t, t + .4, g, 7);
    const e = env(o, t, .01, .05, .16, .3, o.fx); osc(o, "triangle", mtof(m), t, t + .5, e);
  }
  riser(o, t0 + 13.4, 1.45, .9);
  whoosh(o, t0 + 14.55, .8, 1.1);
  return t0 + BED_LEN;
}

/** Whoosh + hit for a stage card. `t` = when the card starts. */
function scheduleSting(o: Out, style: EvStyle, t: number) {
  whoosh(o, t - .05, .6, .9);
  const hit = t + CARD_HIT[style];
  boom(o, hit, .85);
  const F = FLAV[style];
  const g = env(o, hit, .005, .07, .3, 1.4, filt(o, "lowpass", 3200, .6, o.out)); const e = env(o, hit, .005, .06, .3, 1.8, o.fx);
  for (const m of F.chords[3]) { osc(o, F.pad, mtof(m + 12), hit, hit + 2, g, -6); osc(o, "triangle", mtof(m + 12), hit, hit + 2.3, e, 6); }
}

function startOn(build: (o: Out, t: number) => void, lead = .06) {
  if (!ctx || !master || !fxIn) return null;
  const g = ctx.createGain(); g.gain.value = 1; g.connect(master); live.push(g);
  const o: Out = { ac: ctx, out: g, fx: fxIn, n: { count: 0 } };
  const t = ctx.currentTime + lead;
  try { build(o, t); } catch (e) { console.warn("[ev-audio] schedule failed", e); return null; }
  (window as any).__evAudioLog = { nodes: o.n.count, state: ctx.state, at: t, sampleRate: ctx.sampleRate };
  console.info("[ev-audio] scheduled", o.n.count, "nodes,", ctx.state);
  return { at: t, ctx };
}

/** Postcard bed (+ the card sting at 15 s). Returns the audio start time so visuals can sync. */
export function playPostcard(style: EvStyle) {
  stopAll(.12);
  return startOn((o, t) => { scheduleBed(o, style, t); scheduleSting({ ...o }, style, t + BED_LEN); });
}
/** Stage-card Replay: whoosh + impact. */
export function playCardSting(style: EvStyle) { stopAll(.08); return startOn((o, t) => scheduleSting(o, style, t + .1)); }

/** Offline render for checks: returns peak/RMS and node count (no speakers involved). */
export async function renderOffline(style: EvStyle, what: "bed" | "sting" = "bed") {
  const OAC = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const len = what === "bed" ? BED_LEN + 3 : 3.5;
  const ac: OfflineAudioContext = new OAC(2, Math.ceil(44100 * len), 44100);
  const bus = buildBus(ac); const o: Out = { ac, out: bus.master, fx: bus.fx, n: { count: 0 } };
  if (what === "bed") { scheduleBed(o, style, .05); scheduleSting(o, style, .05 + BED_LEN); } else scheduleSting(o, style, .1);
  const buf = await ac.startRendering(); const d = buf.getChannelData(0);
  let peak = 0, sum = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
  // loudness per second, to see the arrangement (intro quiet → impact → card)
  const per: number[] = []; const sr = buf.sampleRate;
  for (let s = 0; s < Math.floor(len); s++) { let q = 0; for (let i = s * sr; i < (s + 1) * sr; i++) q += d[i] * d[i]; per.push(+Math.sqrt(q / sr).toFixed(3)); }
  return { nodes: o.n.count, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), perSecond: per };
}
if (typeof window !== "undefined") (window as any).__evAudio = { renderOffline };
