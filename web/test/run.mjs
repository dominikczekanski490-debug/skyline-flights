import fs from 'fs';
const P = await import('/workspace/skyline/web/src/paint3d.ts'); const S = await import('/workspace/skyline/web/src/schemes3d.ts');
const rd = (n, T) => { const b = fs.readFileSync('/tmp/uv/' + n); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const imgs = {}; for (const [k, f] of [...Object.entries(S.LOGO_FILES), ['txt:holidays', 'txt_holidays']]) { const [w, h] = JSON.parse(fs.readFileSync(`/tmp/uv/${f}.json`)); imgs[k] = { w, h, data: new Uint8Array(fs.readFileSync(`/tmp/uv/${f}.rgba`)) }; }
const meta = {};
for (const m of ['B737', 'A320', 'A350']) { const g = { pos: rd(m + '.pos', Float32Array), uv: rd(m + '.uv', Float32Array), idx: rd(m + '.idx', Uint32Array) };
  const A = P.buildAtlas(g, 1024, 1024); meta[m] = A.meta; const base = { w: 1024, h: 1024, data: new Uint8Array(fs.readFileSync(`/tmp/uv/${m}.rgba`)) };
  for (const id of (process.argv[2] || Object.keys(S.SCHEMES).join(',')).split(',')) fs.writeFileSync(`/tmp/uv/out_${m}_${id}.rgba`, P.paint(base, A, S.SCHEMES[id], imgs)); }
console.log(JSON.stringify(meta));
