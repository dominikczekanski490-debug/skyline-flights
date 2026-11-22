// Airport Builder 3D (sandbox): pure data model. Catalog, snapping, placement rules, object caps and a compact save format.
// Units are metres (runways are shortened so a whole airport fits on a phone). Infinite money: nothing costs anything.
export type Lay = "out" | "in";
export type Cat = { k: string; n: string; e: string; lay: Lay; g: string; w: number; d: number; h: number; solid?: boolean; lin?: [number, number, number]; vars?: string[]; snap?: number };
export const TERM_SIZES: [number, number][] = [[48, 28], [72, 34], [104, 40]];
export const TERM_STYLES = ["Glass", "Concrete", "Timber", "White"];
export const LIVS = ["Sky Blue", "Sunset", "Forest", "Royal", "Candy", "Silver"];
export const COLS = ["Blue", "Red", "Green", "Yellow", "Purple", "Orange", "Teal", "Grey"];
export const FLOORS = ["Marble", "Terrazzo", "Wood", "Blue carpet", "Green carpet", "Slate"];
export const CATALOG: Cat[] = [
  { k: "runway", n: "Runway", e: "🛬", lay: "out", g: "Airside", w: 400, d: 30, h: 0, lin: [200, 760, 40] },
  { k: "taxi", n: "Taxiway", e: "〰️", lay: "out", g: "Airside", w: 60, d: 14, h: 0, lin: [20, 400, 20] },
  { k: "apron", n: "Apron", e: "⬛", lay: "out", g: "Airside", w: 40, d: 40, h: 0 },
  { k: "stand", n: "Stand", e: "🅿️", lay: "out", g: "Airside", w: 44, d: 44, h: 0 },
  { k: "bridge", n: "Jet bridge", e: "🌉", lay: "out", g: "Airside", w: 24, d: 4, h: 5, solid: true },
  { k: "mast", n: "Floodlight", e: "💡", lay: "out", g: "Airside", w: 2, d: 2, h: 24 },
  { k: "term", n: "Terminal", e: "🏢", lay: "out", g: "Buildings", w: 72, d: 34, h: 13, solid: true, vars: TERM_STYLES },
  { k: "tower", n: "Control tower", e: "🗼", lay: "out", g: "Buildings", w: 10, d: 10, h: 40, solid: true },
  { k: "hangar", n: "Hangar", e: "🛠️", lay: "out", g: "Buildings", w: 52, d: 40, h: 18, solid: true },
  { k: "fuel", n: "Fuel farm", e: "⛽", lay: "out", g: "Buildings", w: 34, d: 24, h: 10, solid: true },
  { k: "road", n: "Road", e: "🛣️", lay: "out", g: "Landside", w: 60, d: 10, h: 0, lin: [20, 400, 20] },
  { k: "park", n: "Car park", e: "🚗", lay: "out", g: "Landside", w: 40, d: 30, h: 10, solid: true },
  { k: "rail", n: "Rail station", e: "🚆", lay: "out", g: "Landside", w: 60, d: 18, h: 8, solid: true },
  { k: "tree", n: "Tree", e: "🌳", lay: "out", g: "Landside", w: 4, d: 4, h: 10, vars: ["Pine", "Oak"] },
  { k: "plane", n: "Plane", e: "✈️", lay: "out", g: "Planes", w: 36, d: 34, h: 12, vars: LIVS },
  { k: "checkin", n: "Check-in desks", e: "🛃", lay: "in", g: "Desks", w: 8, d: 3, h: 2.4, solid: true, vars: COLS },
  { k: "security", n: "Security lane", e: "🛂", lay: "in", g: "Desks", w: 9, d: 3, h: 2.4, solid: true },
  { k: "belt", n: "Bag belt", e: "🧳", lay: "in", g: "Desks", w: 12, d: 5, h: 1, solid: true },
  { k: "gate", n: "Gate + seats", e: "💺", lay: "in", g: "Gates", w: 10, d: 7, h: 1.2, solid: true, vars: COLS },
  { k: "fids", n: "Departure board", e: "🖥️", lay: "in", g: "Gates", w: 4, d: 1, h: 4 },
  { k: "sign", n: "Hanging sign", e: "🪧", lay: "in", g: "Gates", w: 5, d: 1, h: 4 },
  { k: "shop", n: "Shop", e: "🛍️", lay: "in", g: "Shops & food", w: 8, d: 6, h: 4, solid: true, vars: COLS },
  { k: "cafe", n: "Café", e: "☕", lay: "in", g: "Shops & food", w: 7, d: 6, h: 3, solid: true, vars: COLS },
  { k: "wc", n: "Toilets", e: "🚻", lay: "in", g: "Shops & food", w: 6, d: 4, h: 3.5, solid: true },
  { k: "esc", n: "Escalator", e: "↗️", lay: "in", g: "Structure", w: 13, d: 2.4, h: 6, solid: true },
  { k: "lift", n: "Lift", e: "🛗", lay: "in", g: "Structure", w: 3, d: 3, h: 6, solid: true },
  { k: "wall", n: "Wall", e: "🧱", lay: "in", g: "Structure", w: 8, d: .3, h: 5.6, lin: [2, 40, 2], vars: COLS },
  { k: "glass", n: "Glass wall", e: "🪟", lay: "in", g: "Structure", w: 8, d: .2, h: 5.6, lin: [2, 40, 2] },
  { k: "plant", n: "Plant", e: "🪴", lay: "in", g: "Structure", w: 1.2, d: 1.2, h: 2 },
];
export const cat = (k: string) => CATALOG.find(c => c.k === k)!;
export const CAP = { out: 350, in: 250, term: 8, plane: 40 };
export const HALF = 390, FLOOR_H = 6;
export type It = { i: number; k: string; x: number; z: number; r: number; s?: number; v?: number; f?: number };
export type Save = { v: 1; name: string; nid: number; out: It[]; ins: Record<string, It[]>; fl: Record<string, [number, number]> };
export const blank = (name = "My airport"): Save => ({ v: 1, name, nid: 1, out: [], ins: {}, fl: {} });
export const snapOf = (c: Cat) => (c.lay === "in" ? .5 : c.lin ? 5 : c.w <= 4 ? 2 : 5);
export const snap = (v: number, s: number) => Math.round(v / s) * s;
/** Footprint (w along local x, d along local z) for an item, using its length/size. */
export function dims(it: It): [number, number] { const c = cat(it.k); if (it.k === "term") return TERM_SIZES[it.s ?? 1] || TERM_SIZES[1]; if (c.lin) return [it.s ?? c.w, c.d]; return [c.w, c.d]; }
/** Axis-aligned bounds of the rotated footprint. */
export function aabb(it: It): [number, number, number, number] { const [w, d] = dims(it); const a = it.r * Math.PI / 180; const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); const hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2; return [it.x - hx, it.z - hz, it.x + hx, it.z + hz]; }
const hit = (a: number[], b: number[], m = .05) => a[0] < b[2] - m && a[2] > b[0] + m && a[1] < b[3] - m && a[3] > b[1] + m;
export type Ctx = { lay: Lay; term?: number; floor?: number };
export const listOf = (s: Save, c: Ctx): It[] => (c.lay === "out" ? s.out : (s.ins[String(c.term)] ||= []));
export const termOf = (s: Save, id?: number) => s.out.find(t => t.i === id && t.k === "term");
/** Returns an error message, or null if `it` may go there. `skip` = id of the item being moved/edited. */
export function check(s: Save, c: Ctx, it: It, skip = -1): string | null {
  const C = cat(it.k); if (!C || C.lay !== c.lay) return "That doesn't go here";
  const list = listOf(s, c); const others = list.filter(o => o.i !== skip);
  if (skip < 0) { if (others.length >= (c.lay === "out" ? CAP.out : CAP.in)) return c.lay === "out" ? `That's a huge airport! To keep your iPhone happy the outside is capped at ${CAP.out} objects.` : `This terminal is full: ${CAP.in} objects is the limit (iPhone memory).`;
    if (it.k === "term" && others.filter(o => o.k === "term").length >= CAP.term) return `Up to ${CAP.term} terminals per airport (iPhone memory).`;
    if (it.k === "plane" && others.filter(o => o.k === "plane").length >= CAP.plane) return `Up to ${CAP.plane} parked planes.`; }
  const b = aabb(it);
  if (c.lay === "out") { if (b[0] < -HALF || b[2] > HALF || b[1] < -HALF || b[3] > HALF) return "Too close to the edge of the map"; }
  else { const t = termOf(s, c.term); if (!t) return "Terminal not found"; const [W, D] = dims(t); if (b[0] < -W / 2 || b[2] > W / 2 || b[1] < -D / 2 || b[3] > D / 2) return "That has to fit inside the terminal walls"; }
  if (C.solid) for (const o of others) { if (!cat(o.k).solid || (c.lay === "in" && (o.f ?? 0) !== (it.f ?? 0) && o.k !== "lift" && it.k !== "lift")) continue; if (hit(b, aabb(o))) return `Something's in the way (${cat(o.k).n})`; }
  return null; }
export type Res = { s: Save; it?: It; err?: string };
const clone = (s: Save): Save => JSON.parse(JSON.stringify(s));
export function place(s0: Save, c: Ctx, k: string, x: number, z: number, r = 0, extra: Partial<It> = {}): Res {
  const C = cat(k); const sn = snapOf(C); const it: It = { i: s0.nid, k, x: snap(x, sn), z: snap(z, sn), r, ...(C.lin ? { s: C.w } : {}), ...(k === "term" ? { s: 1, v: 0 } : {}), ...(C.vars && k !== "term" ? { v: 0 } : {}), ...(c.lay === "in" ? { f: c.floor ?? 0 } : {}), ...extra };
  const e = check(s0, c, it); if (e) return { s: s0, err: e }; const s = clone(s0); s.nid++; listOf(s, c).push(it); if (k === "term") { s.ins[String(it.i)] = []; s.fl[String(it.i)] = [0, 3]; } return { s, it }; }
export function edit(s0: Save, c: Ctx, id: number, ch: Partial<It>): Res { const cur = listOf(s0, c).find(o => o.i === id); if (!cur) return { s: s0, err: "Gone" }; const C = cat(cur.k); const n: It = { ...cur, ...ch };
  if (ch.x != null || ch.z != null) { const sn = snapOf(C); n.x = snap(n.x, sn); n.z = snap(n.z, sn); } if (C.lin && n.s != null) n.s = Math.max(C.lin[0], Math.min(C.lin[1], n.s)); n.r = ((n.r % 360) + 360) % 360;
  const e = check(s0, c, n, id); if (e) return { s: s0, err: e }; const s = clone(s0); const l = listOf(s, c); l[l.findIndex(o => o.i === id)] = n; return { s, it: n }; }
export function remove(s0: Save, c: Ctx, id: number): Save { const s = clone(s0); if (c.lay === "out") { s.out = s.out.filter(o => o.i !== id); delete s.ins[String(id)]; delete s.fl[String(id)]; } else s.ins[String(c.term)] = listOf(s, c).filter(o => o.i !== id); return s; }
export function duplicate(s: Save, c: Ctx, id: number): Res { const o = listOf(s, c).find(x => x.i === id); if (!o) return { s, err: "Gone" }; const [w, d] = dims(o); for (const [dx, dz] of [[w + 2, 0], [0, d + 2], [-w - 2, 0], [0, -d - 2]]) { const r = place(s, c, o.k, o.x + dx, o.z + dz, o.r, { s: o.s, v: o.v, f: o.f }); if (!r.err) return r; } return { s, err: "No room next to it" }; }
/** Compact save: arrays instead of objects (k,x,z,r,s,v,f,i). */
const pack = (l: It[]) => l.map(o => [o.k, o.x, o.z, o.r, o.s ?? null, o.v ?? null, o.f ?? null, o.i]);
const unpack = (l: unknown[]): It[] => (Array.isArray(l) ? l : []).filter(a => Array.isArray(a) && CATALOG.some(c => c.k === a[0])).map((a: any) => { const o: It = { k: a[0], x: +a[1] || 0, z: +a[2] || 0, r: +a[3] || 0, i: +a[7] || 0 }; if (a[4] != null) o.s = +a[4]; if (a[5] != null) o.v = +a[5]; if (a[6] != null) o.f = +a[6]; return o; });
export const encode = (s: Save) => JSON.stringify({ v: 1, n: s.name, i: s.nid, o: pack(s.out), in: Object.fromEntries(Object.entries(s.ins).map(([k, l]) => [k, pack(l)])), fl: s.fl });
export function decode(txt: string | null): Save | null { try { const j = JSON.parse(txt || ""); if (!j || j.v !== 1) return null; const s: Save = { v: 1, name: String(j.n || "My airport").slice(0, 40), nid: +j.i || 1, out: unpack(j.o), ins: {}, fl: {} };
  for (const t of s.out.filter(o => o.k === "term")) { s.ins[String(t.i)] = unpack(j.in?.[t.i]); const f = j.fl?.[t.i]; s.fl[String(t.i)] = Array.isArray(f) ? [+f[0] || 0, +f[1] || 0] : [0, 3]; }
  s.nid = Math.max(s.nid, ...s.out.map(o => o.i + 1), ...Object.values(s.ins).flat().map(o => o.i + 1)); return s; } catch { return null; } }
/** A ready-made starter airport so the first open isn't an empty field. */
export function starter(): Save { let s = blank("Dominik International"); const P = (c: Ctx, k: string, x: number, z: number, r = 0, e: Partial<It> = {}) => { const res = place(s, c, k, x, z, r, e); if (!res.err) s = res.s; return res.it; };
  const O: Ctx = { lay: "out" }; P(O, "runway", 0, -150, 0, { s: 680 }); P(O, "taxi", 0, -105, 0, { s: 400 }); P(O, "taxi", -200, -125, 90, { s: 40 }); P(O, "taxi", 200, -125, 90, { s: 40 });
  const t = P(O, "term", 0, 40, 0, { s: 1, v: 0 })!; for (const x of [-60, 0, 60]) { P(O, "stand", x, -40); P(O, "bridge", x + 10, 11, 90); } P(O, "plane", -60, -42, 90, { v: 0 }); P(O, "plane", 60, -42, 90, { v: 3 });
  P(O, "tower", 120, 20); P(O, "hangar", -150, 20); P(O, "road", 0, 85, 0, { s: 260 }); P(O, "park", 80, 120); P(O, "rail", -70, 120); P(O, "fuel", 170, 60);
  for (let k = 0; k < 14; k++) P(O, "tree", -260 + k * 40, 175, 0, { v: k % 2 }); for (const x of [-90, 90]) P(O, "mast", x, -10);
  const I: Ctx = { lay: "in", term: t.i, floor: 0 }; for (const x of [-24, -14]) P(I, "checkin", x, 10, 0, { v: 0 }); P(I, "security", 6, 6); P(I, "security", 6, 1); P(I, "belt", 26, 9); P(I, "esc", -16, -4); P(I, "fids", -8, 13); P(I, "plant", 0, 14); P(I, "wc", 30, 0);
  const U: Ctx = { ...I, floor: 1 }; P(U, "gate", -20, -10, 0, { v: 0 }); P(U, "gate", 0, -10, 0, { v: 2 }); P(U, "gate", 20, -10, 0, { v: 1 }); P(U, "shop", -4, 6, 0, { v: 4 }); P(U, "cafe", 10, 6, 0, { v: 5 }); P(U, "sign", 0, -2); P(U, "fids", 25, 4);
  return s; }
export const counts = (s: Save) => ({ out: s.out.length, in: Object.values(s.ins).reduce((t, l) => t + l.length, 0) });

/** Turn an Airport Manager grid (14×10 tiles, row-major tile codes) into a sandbox layout: 50 m per tile. Things that don't fit are skipped. */
export function fromManager(grid: string[], name = "My airport", GW = 14, GH = 10): Save { let s = blank(name.slice(0, 40)); const C = 50; const X = (cx: number) => (cx - (GW - 1) / 2) * C, Z = (cy: number) => (cy - (GH - 1) / 2) * C;
  const P = (c: Ctx, k: string, x: number, z: number, r = 0, e: Partial<It> = {}) => { const res = place(s, c, k, x, z, r, e); if (!res.err) s = res.s; return res.it; };
  for (let y = 0; y < GH; y++) { const row = grid.slice(y * GW, y * GW + GW); if (row.filter(t => t === "rw").length >= GW - 2) P({ lay: "out" }, "runway", 0, Z(y), 0, { s: 680 }); }
  for (let y = 0; y < GH; y++) { let x = 0; while (x < GW) { if (grid[y * GW + x] !== "tx") { x++; continue; } let e = x; while (e < GW && grid[y * GW + e] === "tx") e++; P({ lay: "out" }, "taxi", (X(x) + X(e - 1)) / 2, Z(y), 0, { s: Math.min(400, (e - x) * C) }); x = e; } }
  const seen = new Set<number>(); const terms: It[] = [];
  for (let i = 0; i < grid.length; i++) { if (grid[i] !== "tm" || seen.has(i)) continue; const cl: number[] = []; const st = [i]; seen.add(i); while (st.length) { const j = st.pop()!; cl.push(j); const x = j % GW; for (const n of [x > 0 ? j - 1 : -1, x < GW - 1 ? j + 1 : -1, j - GW, j + GW]) if (n >= 0 && n < grid.length && grid[n] === "tm" && !seen.has(n)) { seen.add(n); st.push(n); } }
    const cx = cl.reduce((a, j) => a + (j % GW), 0) / cl.length, cy = cl.reduce((a, j) => a + Math.floor(j / GW), 0) / cl.length; const t = P({ lay: "out" }, "term", Math.round(X(cx) / 5) * 5, Math.round(Z(cy) / 5) * 5, 0, { s: cl.length >= 4 ? 2 : cl.length >= 2 ? 1 : 0, v: 0 }); if (t) terms.push(t); }
  const OUT: Record<string, string> = { st: "stand", gt: "stand", tw: "tower", pk: "park", rl: "rail", hg: "hangar" }; const INS: Record<string, string> = { sh: "shop", fd: "cafe", sc: "security", bg: "belt" }; const slots = new Map<number, number>();
  for (let i = 0; i < grid.length; i++) { const t = grid[i], x = X(i % GW), z = Z(Math.floor(i / GW)); if (OUT[t]) { P({ lay: "out" }, OUT[t], x, z, 0); if (t === "gt") P({ lay: "out" }, "bridge", x + 10, z + 14, 90); if (t === "st" || t === "gt") P({ lay: "out" }, "plane", x, z, 90, { v: i % LIVS.length }); }
    else if (INS[t] && terms.length) { const tm = terms.reduce((a, b) => Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b); const n = slots.get(tm.i) || 0; slots.set(tm.i, n + 1); const [W] = dims(tm); P({ lay: "in", term: tm.i }, INS[t], -W / 2 + 8 + (n % 4) * 12, -6 + Math.floor(n / 4) * 8, 0, { f: 0 }); } }
  for (const tm of terms) { const c: Ctx = { lay: "in", term: tm.i }; P(c, "checkin", 0, 8, 0, { f: 0 }); P(c, "gate", 0, -8, 0, { f: 1 }); P(c, "esc", 10, 0, 0, { f: 0 }); }
  return s; }
