// Boarding race simulation (pure): 30 rows × 6 seats, a single aisle, bag stowing and seat-shuffle delays. Game model, not real data.
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const ROWS = 30; export type Pax = { r: number; s: number; bag: number; col: string };
export type Meth = { k: string; n: string; sub: string; order: (p: Pax[]) => Pax[] };
export const shuf = <T>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const typ = (s: number) => s === 0 || s === 5 ? 0 : s === 1 || s === 4 ? 1 : 2; // window, middle, aisle
export const zones = (p: Pax[], key: (x: Pax) => number) => shuf(p).sort((a, b) => key(a) - key(b));
export const METHODS: Meth[] = [
  { k: "rand", n: "Random", sub: "Everyone at once, any order", order: p => shuf(p) },
  { k: "b2f", n: "Back to front", sub: "5 zones, back rows first", order: p => zones(p, x => -Math.floor(x.r / 6)) },
  { k: "f2b", n: "Front to back", sub: "Front rows first (ouch)", order: p => zones(p, x => Math.floor(x.r / 6)) },
  { k: "wilma", n: "Window-Middle-Aisle", sub: "Windows, then middles, then aisles", order: p => zones(p, x => typ(x.s)) },
  { k: "steffen", n: "Steffen-style", sub: "Alternate rows, windows first, back to front", order: p => [...p].sort((a, b) => typ(a.s) - typ(b.s) || (a.s < 3 ? 0 : 1) - (b.s < 3 ? 0 : 1) || (a.r % 2) - (b.r % 2) || b.r - a.r) },
  { k: "pyr", n: "Reverse pyramid", sub: "Back windows first, front aisles last", order: p => zones(p, x => typ(x.s) * 2 - x.r / 15) },
];
export const COLS = ["#60a5fa", "#f472b6", "#facc15", "#34d399", "#f97316", "#a78bfa"];
export function makePax(): Pax[] { const p: Pax[] = []; for (let r = 0; r < ROWS; r++) for (let s = 0; s < 6; s++) p.push({ r, s, bag: Math.random() < .2 ? 1 : 3 + Math.random() * 12, col: pick(COLS) }); return p; }
export type Agent = Pax & { pos: number; st: number; phase: 0 | 1 | 2 }; // 0 walking, 1 stowing/shuffling, 2 seated
export type Lane = { q: Agent[]; aisle: (Agent | null)[]; seated: boolean[][]; t: number; done: boolean; n: number };
export const mkLane = (order: Pax[]): Lane => ({ q: order.map(p => ({ ...p, pos: -1, st: 0, phase: 0 })), aisle: Array(ROWS).fill(null), seated: Array.from({ length: ROWS }, () => Array(6).fill(false)), t: 0, done: false, n: 0 });
/** One simulated second. Pure enough to test: walking takes ~1 s per row, bags take their time, each seated neighbour in the way adds 4 s. */
export function tick(L: Lane) { if (L.done) return; L.t++;
  for (let i = ROWS - 1; i >= 0; i--) { const a = L.aisle[i]; if (!a) continue;
    if (a.r === i) { if (a.phase === 0) { a.phase = 1; const side = a.s < 3 ? [0, 1, 2] : [5, 4, 3]; const idx = side.indexOf(a.s); a.st = Math.ceil(a.bag) + side.slice(idx + 1).filter(k => L.seated[i][k]).length * 4; }
      else if (--a.st <= 0) { a.phase = 2; L.seated[i][a.s] = true; L.aisle[i] = null; L.n++; } }
    else if (i + 1 < ROWS && !L.aisle[i + 1]) { L.aisle[i + 1] = a; L.aisle[i] = null; } }
  if (!L.aisle[0] && L.q.length) L.aisle[0] = L.q.shift()!; if (L.n >= ROWS * 6) L.done = true; }
