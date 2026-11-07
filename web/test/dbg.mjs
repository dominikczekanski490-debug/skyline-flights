import fs from 'fs';
const P = await import('/workspace/skyline/web/src/paint3d.ts');
const rd = (n, T) => { const b = fs.readFileSync('/tmp/uv/' + n); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
for (const m of ['B737', 'A320', 'A350']) { const g = { pos: rd(m + '.pos', Float32Array), uv: rd(m + '.uv', Float32Array), idx: rd(m + '.idx', Uint32Array) };
  const A = P.buildAtlas(g, 1024, 1024); const base = { w: 1024, h: 1024, data: new Uint8Array(fs.readFileSync(`/tmp/uv/${m}.rgba`)) };
  const hx = v => Math.max(0, Math.min(255, v * 255 | 0)).toString(16).padStart(2, '0');
  const S = { id: 'dbg', fus: (s, h) => '#' + hx(s) + hx(h) + '80', fin: () => '#ff00ff', eng: '#00ffff', other: '#ffff00', decals: [] };
  fs.writeFileSync(`/tmp/uv/out_${m}_dbg.rgba`, P.paint(base, A, S, {}));
  let cov = 0; for (const c of A.cls) if (c) cov++; console.log(m, 'covered', cov, A.meta.counts); }
