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

/** Main bus: per-play gains → master → compressor → make-up gain → soft-clip limiter → speakers, plus a
 *  generated-impulse reverb send. Tuned loud and bright like a phone video (~-9 dBFS RMS) without clipping. */
function softClip(ac: BaseAudioContext) {
  const ws = ac.createWaveShaper(); const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = .96 * Math.tanh(x * 1.6) / Math.tanh(1.6); }
  ws.curve = c; ws.oversample = "2x"; return ws;
}
function buildBus(ac: BaseAudioContext) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 6; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .14;
  const m = ac.createGain(); m.gain.value = isMuted() && ac instanceof AudioContext ? 0 : LEVEL;
  const mk = ac.createGain(); mk.gain.value = 1.45;
  const lim = softClip(ac);
  m.connect(comp); comp.connect(mk); mk.connect(lim); lim.connect(ac.destination);
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

/** Postcard length per style (s): Eurovision Asia is a short 9 s fashion shoot, the others 15 s. */
export const pcLen = (style: EvStyle) => style === "asia" ? 9 : 15;

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

/** Postcard bed: a continuous, steady-energy pop loop (drums, bass, chords, arp, hook) from the first beat, like the
 *  TikTok edit it copies — no quiet intro. Bars are 2 s (120 bpm). ESC/JESC add an impact when the country lands at 11 s.
 *  Fades out over the last ~0.6 s into the stage card. */
export const BED_LEN = 15, BED_IMPACT = 11;
/** Eurovision Asia stage-card timeline (s) — the visuals (evcards) use the same numbers. */
export const ASIA_T = { burst: 1.7, hold: 8.0, end: 9.7, loop: 10.4 };
export const CARD_HIT: Record<EvStyle, number> = { asia: ASIA_T.burst + .55, esc: .75, jesc: 1.55 };
function scheduleBed(o: Out, style: EvStyle, t0: number, len = pcLen(style)) {
  const F = FLAV[style], B = .5, bar = 2, impact = style === "asia" ? -1 : BED_IMPACT;
  const bus = o.ac.createGain(); bus.gain.setValueAtTime(1, t0); bus.gain.setValueAtTime(1, t0 + len - .65); bus.gain.linearRampToValueAtTime(0, t0 + len); bus.connect(o.out); o.n.count++;
  const B2: Out = { ...o, out: bus };
  const padBus = o.ac.createGain(); padBus.gain.value = 1; padBus.connect(bus); o.n.count++;
  const padLP = filt(o, "lowpass", F.padCut * 1.3, .7, padBus);
  const padSend = o.ac.createGain(); padSend.gain.value = .3; padSend.connect(o.fx); padLP.connect(padSend); o.n.count++;
  const bars = Math.ceil(len / bar);
  for (let b = 0; b < bars; b++) {
    const tb = t0 + b * bar, ci = b % 4, ch = F.chords[ci];
    const g = env(o, tb, .05, .05, bar - .12, .3, padLP);
    for (const m of ch) for (const d of [-10, 10]) osc(o, F.pad, mtof(m), tb, tb + bar + .4, g, d);
    for (let q = 0; q < 4; q++) {
      const tq = tb + q * B, rel = tq - t0;
      if (rel >= len - .3) break;
      if (F.four || q % 2 === 0) { padBus.gain.setValueAtTime(1 - F.pump, tq); padBus.gain.linearRampToValueAtTime(1, tq + .26); }
      if (F.four || q === 0 || q === 2) kick(B2, tq, 1);
      if (!F.four && q === 1) kick(B2, tq + B * .5, .7);
      if (q === 1 || q === 3) { snare(B2, tq, .95, true); if (F.clap) snare(B2, tq, .5, false); }
      for (let h = 0; h < 4; h++) hat(B2, tq + h * B / 4, h === 2 ? 1.1 : h % 2 ? .6 : .8, h === 2 && q % 2 === 1);
      // bass on 8ths
      for (let e = 0; e < 2; e++) {
        const te = tq + e * B / 2, r = F.roots[ci] + (e === 1 ? 12 : 0);
        const bg = env(o, te, .004, style === "jesc" ? .13 : .16, .14, .07, filt(o, "lowpass", 900, 3, bus));
        osc(o, F.bass, mtof(r), te, te + .28, bg); osc(o, "sine", mtof(r - 12), te, te + .28, bg);
      }
      // bright arp 16ths
      for (let s2 = 0; s2 < 4; s2++) {
        const ts = tq + s2 * B / 4; if (ts - t0 >= len - .2) break;
        const step = q * 4 + s2, note = ch[step % ch.length] + 12 + (step % 8 >= 4 ? 12 : 0);
        const ag = env(o, ts, .003, F.bell ? .075 : .055, .02, F.bell ? .3 : .12, filt(o, "lowpass", 5200, 1.2, bus));
        osc(o, F.arp, mtof(note), ts, ts + .4, ag);
        if (F.bell) { const m = o.ac.createOscillator(); const mg = o.ac.createGain(); m.frequency.value = mtof(note) * 3.5; mg.gain.value = mtof(note) * 1.2; m.connect(mg); o.n.count += 2;
          const car = osc(o, "sine", mtof(note), ts, ts + .4, ag); mg.connect(car.frequency); m.start(ts); m.stop(ts + .4); }
      }
    }
    // the hook: a bright lead on every other bar from bar 1 (call), answered by a shimmer
    if (b >= 1 && b % 2 === 1) for (let i = 0; i < 8; i++) {
      const t = tb + i * .25; if (t - t0 > len - .5) break;
      const m = F.lead[(i + (b % 4 === 3 ? 8 : 0)) % F.lead.length];
      const lg = env(o, t, .008, .052, .15, .14, filt(o, "lowpass", 4600, 1, bus));
      osc(o, style === "jesc" ? "triangle" : "square", mtof(m), t, t + .38, lg); osc(o, "sawtooth", mtof(m), t, t + .38, lg, 8);
      const e2 = env(o, t, .01, .045, .15, .3, o.fx); osc(o, "triangle", mtof(m + 12), t, t + .5, e2);
    }
  }
  if (impact > 0) { riser(B2, t0 + impact - 1.6, 1.6, .8); boom(B2, t0 + impact, .9); }
  crash(B2, t0, .7);
  whoosh(o, t0 + len - .45, .8, 1.1);
  return t0 + len;
}

/** Whoosh + hit for a stage card. `t` = when the card starts. */
function scheduleSting(o: Out, style: EvStyle, t: number) {
  whoosh(o, t - .05, .6, 1.15);
  const hit = t + CARD_HIT[style];
  boom(o, hit, .85);
  // phone speakers can't play the sub boom, so the hit also has a mid "body", a bright crack and a shimmer
  const b = env(o, hit, .002, .45, .03, .32, o.out); const bo = osc(o, "triangle", 260, hit, hit + .4, b); bo.frequency.exponentialRampToValueAtTime(110, hit + .25);
  const k = env(o, hit, .001, .4, .01, .12, filt(o, "bandpass", 2600, .9, o.out)); nsrc(o, hit, hit + .2, k);
  const F = FLAV[style];
  const g = env(o, hit, .005, .085, .35, 1.4, filt(o, "lowpass", 4200, .6, o.out)); const e = env(o, hit, .005, .07, .3, 1.8, o.fx);
  for (const m of F.chords[3]) { osc(o, F.pad, mtof(m + 12), hit, hit + 2, g, -6); osc(o, "triangle", mtof(m + 12), hit, hit + 2.3, e, 6); }
  F.chords[3].forEach((m, i) => { const ts = hit + .05 + i * .06; const sg = env(o, ts, .002, .05, .02, .5, o.out); osc(o, "sine", mtof(m + 24), ts, ts + .6, sg); const sf = env(o, ts, .002, .04, .02, .8, o.fx); osc(o, "sine", mtof(m + 24), ts, ts + .9, sf); });
}

/** Light ambient bed under a stage card's hold (pad + soft arp + shaker), fading out by `t + len`. */
function scheduleCardBed(o: Out, style: EvStyle, t: number, len: number) {
  const F = FLAV[style];
  const bus = o.ac.createGain(); bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + .8); bus.gain.setValueAtTime(1, t + len - 1.2); bus.gain.linearRampToValueAtTime(0, t + len); bus.connect(o.out); o.n.count++;
  const lp = filt(o, "lowpass", F.padCut * 1.1, .6, bus);
  const send = o.ac.createGain(); send.gain.value = .5; lp.connect(send); send.connect(o.fx); o.n.count++;
  for (let b = 0; b * 2 < len; b++) {
    const tb = t + b * 2, ch = F.chords[b % 4];
    const g = env(o, tb, .3, .03, 1.7, .6, lp); for (const m of ch) osc(o, F.pad, mtof(m), tb, tb + 2.6, g, (m % 2 ? 7 : -7));
    for (let s = 0; s < 8; s++) {
      const ts = tb + s * .25; if (ts > t + len - .3) break;
      const a = env(o, ts, .003, F.bell ? .03 : .022, .02, .2, bus); osc(o, F.arp, mtof(ch[s % ch.length] + 12 + (s >= 4 ? 12 : 0)), ts, ts + .3, a);
      if (ts > t + CARD_HIT[style] + .4) hat(o, ts + .125, .28);
    }
  }
}

/** Eurovision Asia stage card sound, following the clip's loudness arc: silence → a swelling crowd → a shimmer whoosh
 *  as the hearts burst in → a bright impact as they settle and the country types in → a warm pad/arp/drum bed → a rising
 *  harmonic riser into the exit → the bed rides out over the clean stage. `t` = card time 0. */
function scheduleAsiaCardArc(o: Out, t: number, len = ASIA_T.loop) {
  const F = FLAV.asia, Bt = t + ASIA_T.burst, hit = Bt + .55, X = t + ASIA_T.hold;
  // crowd: two band-passed noise layers with a fluttering, cheer-like gain; swells until the burst, then sits under the bed
  const crowd = o.ac.createGain(); crowd.connect(o.out); o.n.count++;
  crowd.gain.setValueAtTime(0, t); crowd.gain.setValueAtTime(0, t + .3); crowd.gain.linearRampToValueAtTime(.09, t + .55); crowd.gain.linearRampToValueAtTime(.14, Bt - .2);
  crowd.gain.linearRampToValueAtTime(.3, hit + .2); crowd.gain.linearRampToValueAtTime(.12, hit + 1.6); crowd.gain.setValueAtTime(.12, X - 1); crowd.gain.linearRampToValueAtTime(.3, X + .3); crowd.gain.linearRampToValueAtTime(.1, t + len - .4); crowd.gain.linearRampToValueAtTime(0, t + len);
  const flutter = o.ac.createGain(); flutter.connect(crowd); o.n.count++;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = t + .3; k < t + len; k += .09) flutter.gain.linearRampToValueAtTime(.55 + rnd() * .45, k);
  nsrc(o, t + .3, t + len, filt(o, "bandpass", 1100, .7, flutter));
  nsrc(o, t + .3, t + len, filt(o, "bandpass", 2900, 1.1, flutter));
  const low = env(o, t + .3, .4, .08, len - 1.1, .4, filt(o, "lowpass", 380, .5, o.out)); nsrc(o, t + .3, t + len, low);
  // a few whistles in the crowd before the burst
  for (const [w, f] of [[.8, 2300], [1.15, 2650], [1.45, 2100]]) { const wt = t + w; const g = env(o, wt, .03, .02, .25, .15, o.out); const s = osc(o, "sine", f, wt, wt + .5, g); s.frequency.linearRampToValueAtTime(f * 1.18, wt + .3); }
  // shimmer whoosh into the burst: noise sweeping up + a fast bright glissando
  const sw = filt(o, "bandpass", 700, 1.3, o.out); sw.frequency.setValueAtTime(700, Bt - .1); sw.frequency.exponentialRampToValueAtTime(9000, hit);
  const swg = o.ac.createGain(); swg.gain.setValueAtTime(0, Bt - .1); swg.gain.linearRampToValueAtTime(.4, hit - .05); swg.gain.linearRampToValueAtTime(0, hit + .1); swg.connect(sw); o.n.count++; nsrc(o, Bt - .1, hit + .15, swg);
  [0, 4, 7, 12, 16, 19, 24, 28].forEach((iv, i) => { const ts = Bt + .05 + i * .06; const g = env(o, ts, .003, .04, .03, .45, o.out); osc(o, "sine", mtof(72 + iv), ts, ts + .6, g); const e = env(o, ts, .003, .05, .03, .9, o.fx); osc(o, "triangle", mtof(84 + iv), ts, ts + 1, e); });
  // bright impact as the hearts settle (sub + mid body + crack + crash + chord stab)
  boom(o, hit, .8);
  const bd = env(o, hit, .002, .5, .03, .3, o.out); const bo = osc(o, "triangle", 280, hit, hit + .4, bd); bo.frequency.exponentialRampToValueAtTime(120, hit + .25);
  const k = env(o, hit, .001, .5, .01, .14, filt(o, "bandpass", 2800, .9, o.out)); nsrc(o, hit, hit + .2, k);
  const st = env(o, hit, .004, .09, .4, 1.2, filt(o, "lowpass", 5000, .6, o.out)); for (const m of F.chords[0]) { osc(o, "sawtooth", mtof(m + 12), hit, hit + 1.8, st, -7); osc(o, "sawtooth", mtof(m + 12), hit, hit + 1.8, st, 7); }
  // bed: pad + arp + four-on-the-floor from the impact to the end, ducking out over the last 0.6 s
  const bus = o.ac.createGain(); bus.gain.setValueAtTime(0, hit); bus.gain.linearRampToValueAtTime(.8, hit + .15);
  // a one-beat break after the name lands (as in the clip), and a lift into the exit
  bus.gain.setValueAtTime(.8, Bt + 2.0); bus.gain.linearRampToValueAtTime(.15, Bt + 2.1); bus.gain.setValueAtTime(.15, Bt + 2.35); bus.gain.linearRampToValueAtTime(.8, Bt + 2.45);
  bus.gain.setValueAtTime(.8, X - 1); bus.gain.linearRampToValueAtTime(1.8, X); bus.gain.linearRampToValueAtTime(.9, X + .8); bus.gain.setValueAtTime(.9, t + len - .6); bus.gain.linearRampToValueAtTime(0, t + len); bus.connect(o.out); o.n.count++;
  const B2: Out = { ...o, out: bus };
  const lp = filt(o, "lowpass", 2600, .6, bus); const send = o.ac.createGain(); send.gain.value = .4; lp.connect(send); send.connect(o.fx); o.n.count++;
  for (let tb = hit, b = 0; tb < t + len - .3; tb += 2, b++) {
    const ch = F.chords[b % 4];
    const g = env(o, tb, .2, .05, 1.8, .4, lp); for (const m of ch) for (const d of [-9, 9]) osc(o, F.pad, mtof(m), tb, tb + 2.5, g, d);
    for (let q = 0; q < 4; q++) {
      const tq = tb + q * .5; if (tq > t + len - .4) break;
      kick(B2, tq, .9); if (q % 2) snare(B2, tq, .7, true);
      for (let h = 0; h < 2; h++) hat(B2, tq + .25 * h + .125, .7);
      const r = F.roots[b % 4]; const bg = env(o, tq + .25, .004, .14, .12, .06, filt(o, "lowpass", 900, 3, bus)); osc(o, F.bass, mtof(r), tq + .25, tq + .5, bg); osc(o, "sine", mtof(r - 12), tq + .25, tq + .5, bg);
      for (let s2 = 0; s2 < 4; s2++) { const ts = tq + s2 * .125; const ag = env(o, ts, .003, .045, .02, .14, filt(o, "lowpass", 5200, 1.2, bus)); osc(o, F.arp, mtof(ch[(q * 4 + s2) % ch.length] + 12 + ((q * 4 + s2) % 8 >= 4 ? 12 : 0)), ts, ts + .3, ag); }
    }
  }
  // a second sparkle as the full country name lands
  [0, 7, 12, 16].forEach((iv, i) => { const ts = hit + .75 + i * .08; const g = env(o, ts, .003, .05, .03, .6, o.fx); osc(o, "sine", mtof(84 + iv), ts, ts + .8, g); });
  // the lift into the exit: rising harmonic tones + noise riser, then crash as the hearts blow out
  const rs = X - 1.1;
  riser(o, rs, 1.1, 1.5);
  const rg = o.ac.createGain(); rg.gain.setValueAtTime(0, rs); rg.gain.linearRampToValueAtTime(.3, X); rg.gain.linearRampToValueAtTime(0, X + .25); rg.connect(o.out); o.n.count++;
  for (const h of [1, 1.5, 2, 3]) { const s = osc(o, h === 1.5 ? "sawtooth" : "triangle", 330 * h, rs, X + .3, rg); s.frequency.exponentialRampToValueAtTime(330 * h * 2.4, X); }
  crash(o, X, .9); const xs = env(o, X, .002, .4, .02, .12, filt(o, "bandpass", 3000, .8, o.out)); nsrc(o, X, X + .2, xs);
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
  const len = pcLen(style);
  return startOn((o, t) => { scheduleBed(o, style, t, len); if (style === "asia") scheduleAsiaCardArc(o, t + len - .25); else scheduleSting(o, style, t + len); });
}
/** Stage-card Replay: whoosh + impact. */
export function playCardSting(style: EvStyle, bedLen = 7.4) {
  stopAll(.08);
  return startOn((o, t) => { if (style === "asia") scheduleAsiaCardArc(o, t); else { scheduleSting(o, style, t + .1); if (bedLen > 0) scheduleCardBed(o, style, t + .1, bedLen); } });
}
/** True once a tap has unlocked the shared context and it's playing (so auto-plays may make sound). */
export const audioRunning = () => !!ctx && ctx.state === "running";

/** Offline render for checks: peak/RMS, node count and loudness per second and per 0.25 s (dBFS) — no speakers involved.
 *  "bed" = the postcard (+ what follows it), "sting" = one play of the stage card. */
export async function renderOffline(style: EvStyle, what: "bed" | "sting" = "bed") {
  const OAC = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const pl = pcLen(style);
  const len = what === "bed" ? pl + 3 : style === "asia" ? ASIA_T.loop : 3.5;
  const ac: OfflineAudioContext = new OAC(2, Math.ceil(44100 * len), 44100);
  const bus = buildBus(ac); const o: Out = { ac, out: bus.master, fx: bus.fx, n: { count: 0 } };
  if (what === "bed") { scheduleBed(o, style, 0, pl); if (style === "asia") scheduleAsiaCardArc(o, pl - .25); else scheduleSting(o, style, pl); }
  else if (style === "asia") scheduleAsiaCardArc(o, 0);
  else { scheduleSting(o, style, .1); scheduleCardBed(o, style, .1, 3.3); }
  const buf = await ac.startRendering(); const d = buf.getChannelData(0);
  let peak = 0, sum = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
  const sr = buf.sampleRate; const win = (a: number, b: number) => { let q = 0; for (let i = a; i < b; i++) q += d[i] * d[i]; return Math.sqrt(q / Math.max(1, b - a)); };
  const per: number[] = []; for (let s = 0; s < Math.floor(len); s++) per.push(+win(s * sr, (s + 1) * sr).toFixed(3));
  const db = (x: number) => x > 1e-6 ? Math.round(20 * Math.log10(x)) : -120;
  const q: number[] = []; for (let s = 0; s + .25 <= len + 1e-9; s += .25) q.push(db(win(Math.round(s * sr), Math.round((s + .25) * sr))));
  return { nodes: o.n.count, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), rmsDb: db(Math.sqrt(sum / d.length)), perSecond: per, dbQuarter: q };
}
if (typeof window !== "undefined") (window as any).__evAudio = { renderOffline };
