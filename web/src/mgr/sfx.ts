// Tiny synthesised sound effects (Web Audio oscillators/noise, nothing downloaded). Muted state is remembered on this device.
let ctx: AudioContext | null = null; const KEY = "sk.games.sfx.off";
export const muted = () => localStorage.getItem(KEY) === "1";
export const setMuted = (m: boolean) => { localStorage.setItem(KEY, m ? "1" : "0"); if (m && ctx) { ctx.close().catch(() => {}); ctx = null; } };
const ac = () => { if (muted()) return null; try { ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; } };
function tone(f: number, d: number, type: OscillatorType = "sine", v = 0.12, at = 0, f2?: number) { const c = ac(); if (!c) return; const t = c.currentTime + at; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02); }
function noise(d: number, v = 0.08, f0 = 400, f1 = 2000, at = 0) { const c = ac(); if (!c) return; const t = c.currentTime + at; const n = Math.floor(c.sampleRate * d); const b = c.createBuffer(1, n, c.sampleRate); const a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + d); bp.Q.value = 1.2; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(bp).connect(g).connect(c.destination); s.start(t); }
export const sfx = {
  click: () => tone(880, 0.05, "triangle", 0.06),
  build: () => { tone(220, 0.08, "square", 0.05); tone(330, 0.12, "triangle", 0.08, 0.06); noise(0.12, 0.05, 300, 900, 0.02); },
  cash: () => { tone(1318, 0.08, "triangle", 0.07); tone(1760, 0.16, "triangle", 0.07, 0.07); },
  chime: () => { tone(659, 0.35, "sine", 0.09); tone(523, 0.5, "sine", 0.09, 0.28); },
  alert: () => { tone(740, 0.14, "square", 0.05); tone(740, 0.14, "square", 0.05, 0.22); tone(587, 0.3, "square", 0.05, 0.44); },
  whoosh: () => noise(1.2, 0.05, 200, 2400),
  land: () => { noise(0.9, 0.04, 1800, 300); tone(90, 0.3, "sine", 0.05, 0.6); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.08, i * 0.1)),
  bad: () => tone(220, 0.35, "sawtooth", 0.05, 0, 130),
  win: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, "sine", 0.08, i * 0.08)),
  pop: () => tone(600, 0.08, "sine", 0.08, 0, 900),
  tug: () => { tone(70, 0.25, "sawtooth", 0.03); },
};
