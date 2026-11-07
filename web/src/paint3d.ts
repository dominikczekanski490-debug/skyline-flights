// Projection livery painter for the amvlab airliner models (CC BY 4.0).
// Instead of guessing where things sit on each UV atlas, every texel is mapped back to the 3D point it
// covers on the model (rasterising each triangle in UV space). Paint is then decided from the 3D position:
// fuselage side (s = 0 tail .. 1 nose, h = 0 belly .. 1 crown), fin (fs = 0 trailing .. 1 leading, fh = 0 root .. 1 tip),
// engine nacelles, everything else. Decals (logos/titles) are projected orthographically from the side, so they land
// on the real fuselage/fin whatever the atlas layout is. Pure code: no DOM, testable in Node.
export type Img = { w: number; h: number; data: Uint8ClampedArray | Uint8Array };
export type Geo = { pos: ArrayLike<number>; uv: ArrayLike<number>; idx: ArrayLike<number> };
export const C_NONE = 0, C_FUS = 1, C_FIN = 2, C_ENG = 3, C_OTHER = 4;
export type Meta = { x0: number; x1: number; yb: number; yt: number; yc: number; R: number; fx0: number; fx1: number; fy0: number; fy1: number; ex0: number; ex1: number; counts: number[] };
export type Atlas = { W: number; H: number; cls: Uint8Array; X: Float32Array; Y: Float32Array; Z: Float32Array; meta: Meta };

// Classify triangles from geometry alone (model frame: X along fuselage, nose at +X; Y up; Z lateral).
export function classify(g: Geo) {
  const P = g.pos, I = g.idx, nT = I.length / 3; const vx = (i: number) => P[3 * i], vy = (i: number) => P[3 * i + 1], vz = (i: number) => P[3 * i + 2];
  let x0 = Infinity, x1 = -Infinity, ytop = -Infinity; for (let i = 0; i < P.length / 3; i++) { x0 = Math.min(x0, vx(i)); x1 = Math.max(x1, vx(i)); ytop = Math.max(ytop, vy(i)); }
  // tail is the X end with the highest points (the fin); flip sign not needed if nose already +X, but verify
  let hs = 0, hn = 0; for (let i = 0; i < P.length / 3; i++) if (vy(i) > ytop * 0.7) { hs += vx(i); hn++; } const noseSign = hs / Math.max(1, hn) < (x0 + x1) / 2 ? 1 : -1;
  // fuselage cross-section at mid-cabin: vertices with |Z| small around the centre third
  const L = x1 - x0, m0 = x0 + L * 0.4, m1 = x0 + L * 0.6; let yb = Infinity, yt = -Infinity, zr = 0;
  for (let i = 0; i < P.length / 3; i++) { const x = vx(i); if (x < m0 || x > m1) continue; if (Math.abs(vz(i)) < 0.35) { yb = Math.min(yb, vy(i)); yt = Math.max(yt, vy(i)); } }
  const yc = (yb + yt) / 2, R0 = (yt - yb) / 2; for (let i = 0; i < P.length / 3; i++) { const x = vx(i); if (x < m0 || x > m1) continue; if (Math.abs(vy(i) - yc) < R0 * 0.2) zr = Math.max(zr, Math.min(Math.abs(vz(i)), R0 * 1.4)); }
  const R = Math.max(R0, Math.min(zr, R0 * 1.15));
  const tc = new Uint8Array(nT); let fx0 = Infinity, fx1 = -Infinity, fy0 = yt, fy1 = -Infinity, ex0 = Infinity, ex1 = -Infinity; const counts = [0, 0, 0, 0, 0];
  for (let t = 0; t < nT; t++) {
    const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2]; const cx = (vx(a) + vx(b) + vx(c)) / 3, cy = (vy(a) + vy(b) + vy(c)) / 3, cz = (vz(a) + vz(b) + vz(c)) / 3;
    const ux = vx(b) - vx(a), uy = vy(b) - vy(a), uz = vz(b) - vz(a), wx = vx(c) - vx(a), wy = vy(c) - vy(a), wz = vz(c) - vz(a);
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz) || 1;
    const rr = Math.hypot(cy - yc, cz); let k = C_OTHER;
    if (cy > yt + R * 0.12 && Math.abs(cz) < R * 0.55 && Math.abs(nz / nl) > 0.35) k = C_FIN;
    else if (rr < R * 1.1 && Math.abs(cz) < R * 1.1) k = C_FUS;
    else if (Math.abs(cz) > R * 1.6 && Math.abs(cz) < R * 4.6 && cy < yc && (cx - x0) / L > 0.3 && (cx - x0) / L < 0.85) k = C_ENG;
    tc[t] = k; counts[k]++;
    if (k === C_FIN) for (const v of [a, b, c]) { fx0 = Math.min(fx0, vx(v)); fx1 = Math.max(fx1, vx(v)); fy1 = Math.max(fy1, vy(v)); }
    if (k === C_ENG) for (const v of [a, b, c]) { ex0 = Math.min(ex0, vx(v)); ex1 = Math.max(ex1, vx(v)); }
  }
  // engine refinement: the nacelle is the lowest thing outboard of the fuselage. Fit its circle in the (|Z|, Y) plane from the
  // candidates' lowest points, then keep only triangles inside that circle (drops wing, flap fairings and pylons above it).
  { let ymin = Infinity; const ct: number[][] = []; for (let t = 0; t < nT; t++) if (tc[t] === C_ENG) { const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2]; const q = [(vx(a) + vx(b) + vx(c)) / 3, (vy(a) + vy(b) + vy(c)) / 3, Math.abs((vz(a) + vz(b) + vz(c)) / 3), t]; ct.push(q); ymin = Math.min(ymin, q[1]); }
    const low = ct.filter(q => q[1] < ymin + R * 0.12).map(q => q[2]).sort((p, q) => p - q); const zc = low[low.length >> 1] ?? 0;
    const side = ct.filter(q => q[1] < ymin + R * 0.9).map(q => Math.abs(q[2] - zc)).sort((p, q) => p - q); const r = Math.max(0.5, side[Math.floor(side.length * 0.95)] ?? 1); const yE = ymin + r;
    const bx = ct.filter(q => q[1] < yE - r * 0.5).map(q => q[0]); const bx0 = Math.min(...bx) - r * 0.6, bx1 = Math.max(...bx) + r * 0.6;
    ex0 = Infinity; ex1 = -Infinity; counts[C_ENG] = 0;
    for (const q of ct) { const t = q[3]; if (Math.hypot(q[2] - zc, q[1] - yE) > r * 1.12 || q[0] < bx0 || q[0] > bx1) { tc[t] = C_OTHER; counts[C_OTHER]++; } else { counts[C_ENG]++; ex0 = Math.min(ex0, q[0]); ex1 = Math.max(ex1, q[0]); } } }
  return { tc, meta: { x0, x1, yb, yt, yc, R, fx0, fx1, fy0, fy1, ex0, ex1, counts, noseSign } as Meta & { noseSign: number } };
}

export function buildAtlas(g: Geo, W: number, H: number): Atlas {
  const { tc, meta } = classify(g); const cls = new Uint8Array(W * H), X = new Float32Array(W * H), Y = new Float32Array(W * H), Z = new Float32Array(W * H); const P = g.pos, U = g.uv, I = g.idx;
  const pad = 1.5; // texels: covers bilinear/mip bleed at island edges
  for (let t = 0; t < I.length / 3; t++) {
    const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2];
    const ax = U[2 * a] * W, ay = U[2 * a + 1] * H, bx = U[2 * b] * W, by = U[2 * b + 1] * H, cx = U[2 * c] * W, cy = U[2 * c + 1] * H;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    const mnx = Math.max(0, Math.floor(Math.min(ax, bx, cx) - pad)), mxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) + pad)), mny = Math.max(0, Math.floor(Math.min(ay, by, cy) - pad)), mxy = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) + pad));
    const per = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy)); const eps = pad / Math.max(1, per) * 2;
    for (let py = mny; py <= mxy; py++) for (let px = mnx; px <= mxx; px++) {
      const qx = px + 0.5, qy = py + 0.5; const l1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den, l2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den, l3 = 1 - l1 - l2;
      if (l1 < -eps || l2 < -eps || l3 < -eps) continue; const k = py * W + px; const inside = l1 >= 0 && l2 >= 0 && l3 >= 0; if (cls[k] && !inside) continue;
      const m1 = Math.min(1, Math.max(0, l1)), m2 = Math.min(1, Math.max(0, l2)), m3 = Math.max(0, 1 - m1 - m2);
      cls[k] = tc[t]; X[k] = P[3 * a] * m1 + P[3 * b] * m2 + P[3 * c] * m3; Y[k] = P[3 * a + 1] * m1 + P[3 * b + 1] * m2 + P[3 * c + 1] * m3; Z[k] = P[3 * a + 2] * m1 + P[3 * b + 2] * m2 + P[3 * c + 2] * m3;
    }
  }
  return { W, H, cls, X, Y, Z, meta };
}

export type RGB = [number, number, number];
export const hex = (h: string): RGB => { const x = h.replace("#", ""); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
// Decal: an image placed on the fuselage (centre s,h in 0..1, width ws as a fraction of fuselage length) or fin (fs,fh, width as a fraction of fin chord).
// rot = degrees counter-clockwise as seen with the nose to the right. Images stay readable on both sides (like real titles).
export type Part = { img: string; x: number; w: number; tint?: string; sx?: number; sw?: number };
export type Decal = { parts?: Part[]; img: string; on: "fus" | "fin"; s: number; h: number; ws: number; rot?: number; tint?: string; sx?: number; sw?: number; mirrorFixed?: boolean };
export type Scheme = { id: string; fus: (s: number, h: number) => string; fin: (fs: number, fh: number, side: number) => string; eng: string; other?: string; decals: Decal[] };

export function paint(base: Img, A: Atlas, S: Scheme, imgs: Record<string, Img>): Uint8ClampedArray {
  const { W, H, cls, X, Y, Z, meta: M } = A; const out = new Uint8ClampedArray(base.data); const src = base.data; const L = M.x1 - M.x0, D = M.yt - M.yb;
  const bw = base.w / W; // base texture may differ in size from the atlas grid
  const lum = (k: number) => 0.3 * src[4 * k] + 0.59 * src[4 * k + 1] + 0.11 * src[4 * k + 2];
  // local mean luminance (box 9x9 via integral image) — detects painted windows/doors/panel lines to keep them
  const ii = new Float64Array((W + 1) * (H + 1)); for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < W; x++) { const k = Math.min(base.h - 1, Math.floor(y * bw)) * base.w + Math.min(base.w - 1, Math.floor(x * bw)); r += lum(k); ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1] + r; } }
  const box = (x: number, y: number, r: number) => { const a0 = Math.max(0, x - r), a1 = Math.min(W, x + r + 1), b0 = Math.max(0, y - r), b1 = Math.min(H, y + r + 1); return (ii[b1 * (W + 1) + a1] - ii[b0 * (W + 1) + a1] - ii[b1 * (W + 1) + a0] + ii[b0 * (W + 1) + a0]) / ((a1 - a0) * (b1 - b0)); };
  const cache: Record<string, RGB> = {}; const col = (h: string) => cache[h] ||= hex(h);
  const finC = (M.fx1 - M.fx0) || 1, finH = (M.fy1 - M.fy0) || 1;
  const dec = S.decals.flatMap(d0 => (d0.parts || [{ img: d0.img, x: 0, w: 1, tint: d0.tint, sx: d0.sx, sw: d0.sw }]).map(pt => ({ d0, pt }))).map(({ d0, pt }) => { const d: Decal = { ...d0, img: pt.img, tint: pt.tint, sx: pt.sx, sw: pt.sw }; const im = imgs[d.img]; if (!im) return null; const sx = d.sx || 0, sw = d.sw || im.w - sx;
    const W0 = d.on === "fus" ? d.ws * L : d.ws * finC; const w = W0 * pt.w; const h = w * im.h / sw; const r = (d.rot || 0) * Math.PI / 180; const ox = (pt.x + pt.w / 2 - 0.5) * W0;
    const bx = d.on === "fus" ? M.x0 + d.s * L : M.fx0 + d.s * finC, by = d.on === "fus" ? M.yb + d.h * D : M.fy0 + d.h * finH;
    return { d, im, sx, sw, w, h, ox, cx: bx, cy: by, cr: Math.cos(r), sr: Math.sin(r), t: d.tint ? hex(d.tint) : null }; });
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const k = py * W + px, c = cls[k]; if (!c) continue;
    const bk = Math.min(base.h - 1, Math.floor(py * bw)) * base.w + Math.min(base.w - 1, Math.floor(px * bw));
    const x = X[k], y = Y[k], z = Z[k], side = z >= 0 ? 1 : -1;
    let rgb: RGB; let shade = 1;
    if (c === C_FUS) { const s = (x - M.x0) / L, h = (y - M.yb) / D; rgb = col(S.fus(s, h)); shade = 0.93 + 0.1 * Math.min(1, Math.max(0, h)); }
    else if (c === C_FIN) rgb = col(S.fin((x - M.fx0) / finC, (y - M.fy0) / finH, side));
    else if (c === C_ENG) rgb = col(S.eng);
    else { const l = lum(bk); const g = S.other ? col(S.other) : null; rgb = g ? [g[0] * l / 200, g[1] * l / 200, g[2] * l / 200] as RGB : [l * 0.97, l, l * 1.02]; }
    let r = rgb[0] * shade, g = rgb[1] * shade, b = rgb[2] * shade;
    if (c === C_FUS || c === C_FIN || c === C_ENG) for (const q of dec) { if (!q || (q.d.on === "fus" ? c !== C_FUS : c !== C_FIN)) continue;
      const dx = (x - q.cx) * side, dy = y - q.cy; const lx = dx * q.cr + dy * q.sr - q.ox, ly = -dx * q.sr + dy * q.cr; const u = lx / q.w + 0.5, v = 0.5 - ly / q.h; if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const ix = Math.min(q.im.w - 1, q.sx + Math.floor(u * q.sw)), iy = Math.min(q.im.h - 1, Math.floor(v * q.im.h)), o = 4 * (iy * q.im.w + ix); const a = q.im.data[o + 3] / 255; if (a <= 0) continue;
      const tr = q.t ? q.t[0] : q.im.data[o], tg = q.t ? q.t[1] : q.im.data[o + 1], tb = q.t ? q.t[2] : q.im.data[o + 2]; r = r * (1 - a) + tr * a; g = g * (1 - a) + tg * a; b = b * (1 - a) + tb * a; }
    if (c === C_FUS || c === C_ENG) { const dl = lum(bk) - box(px, py, 4); if (Math.abs(dl) > 28) { const m = 0.82; r = r * (1 - m) + 28 * m; g = g * (1 - m) + 34 * m; b = b * (1 - m) + 44 * m; } } // keep windows/doors from the model's own art
    out[4 * bk] = r; out[4 * bk + 1] = g; out[4 * bk + 2] = b; out[4 * bk + 3] = 255;
  }
  return out;
}
