// node web/test/livery.test.mjs — mappings, logo assets, scheme metadata (pure, no browser)
import fs from 'fs'; import assert from 'assert';
const S = await import('../src/schemes3d.ts');
for (const [k, f] of Object.entries(S.LOGO_FILES)) { assert(fs.existsSync(`public/liveries/${f}.png`), f); assert(fs.existsSync(`public/liveries/${f}.svg`), f); assert(fs.readFileSync('public/liveries/ATTRIBUTION.md', 'utf8').includes(f), 'attribution ' + f); }
for (const [r, v] of Object.entries(S.JET2_REG)) { assert(/^G-[A-Z]{4}$/.test(r)); assert(S.SCHEMES[v.b]); assert(v.ref.includes('Commons')); }
for (const [id, s] of Object.entries(S.SCHEMES)) { assert(s.ref && s.notes, id); for (const h of [0.1, 0.5, 0.9]) assert(/^#[0-9a-f]{6}$/i.test(s.fus(0.5, h)) && /^#[0-9a-f]{6}$/i.test(s.fin(0.5, h, 1)), id); }
assert.equal(S.SCHEMES.J2HOL.fin(0.32, 0.3, 1), '#ffb81c'); assert.equal(S.SCHEMES.FR.fus(0.5, 0.1), '#073590');
const P = await import('../src/paint3d.ts'); for (const [k, f] of Object.entries(S.SHAPES)) { const im = f(); assert(im.w === 256 && im.data.some((v, i) => i % 4 === 3 && v > 0), k); }
console.log('livery tests ok');
