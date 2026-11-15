/** On-device person cut-out for the Eurovision Asia postcard (MediaPipe selfie segmentation).
 *  Everything runs in this browser: the wasm runtime and the model are bundled with the app under /mediapipe/,
 *  the photo never leaves the device, and MediaPipe's built-in usage logging is switched off (see noTelemetry). */
export type Cutout = { url: string; blob: Blob | null; box: [number, number, number, number] };   // box = person bounds (0..1: x0, y0, x1, y1)

const BASE = "/mediapipe/";
/** Precomputed cut-out of the bundled sample portrait (made once with this same code). */
export const SAMPLE_CUT: Cutout = { url: "/ev/sample-portrait-cut.webp", blob: null, box: [0.223, 0.017, 0.825, 0.999] };

/** MediaPipe's web tasks post anonymous usage stats to a Google logging endpoint; Skyline sends nothing, so drop those calls. */
function noTelemetry() {
  const w = window as any; if (w.__evNoTelemetry) return; w.__evNoTelemetry = true;
  const real = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (/^https?:\/\/odml\.pa\.googleapis\.com\//i.test(u)) { w.__evBlockedLogs = (w.__evBlockedLogs || 0) + 1; return Promise.resolve(new Response(null, { status: 204 })); }
    return real(input as any, init);
  }) as typeof fetch;
}

/* Crash guard: if the tab dies while segmenting (iOS kills tabs that use too much memory), the flag survives the reload
 * and the cut-out is switched off on this device, so the studio never gets stuck in a crash loop. */
const GUARD = "sk.games.euro.cutting", OFF = "sk.games.euro.nocut";
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private */ } } };
if (typeof window !== "undefined" && ls.get(GUARD)) { ls.set(OFF, "1"); ls.set(GUARD, null); }
/** Whether to try the on-device cut-out here: not after an earlier crash, and not on low-memory devices. */
export function cutoutAllowed() {
  if (typeof window === "undefined" || ls.get(OFF)) return false;
  const dm = (navigator as any).deviceMemory; if (typeof dm === "number" && dm < 2) return false;
  return typeof WebAssembly === "object";
}

/** Load the segmenter, run `fn`, then close it and drop the wasm runtime + its WebGL canvas so the memory goes back. */
async function withSegmenter<T>(fn: (seg: any) => T): Promise<T> {
  noTelemetry();
  const { ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const model = new Uint8Array(await (await fetch(BASE + "selfie_segmenter.tflite")).arrayBuffer());
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;   // MediaPipe's GL canvas — ours, so we can free it
  let seg: any = null;
  try {
    seg = await ImageSegmenter.createFromOptions({ wasmLoaderPath: BASE + "vision_wasm_internal.js", wasmBinaryPath: BASE + "vision_wasm_internal.wasm" },
      { baseOptions: { modelAssetBuffer: model, delegate: "CPU" }, canvas, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false });
    return fn(seg);
  } finally {
    try { seg?.close(); } catch { /* already gone */ }
    try { const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null; gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* none */ }
    canvas.width = canvas.height = 0;
  }
}

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("img")); im.src = src; });

/** Cut the person out of a photo. Resolves null when there's no clear person, it fails, or it takes too long (caller falls back to a colour wash). */
export async function cutoutPerson(src: string, timeoutMs = 20000): Promise<Cutout | null> {
  if (!cutoutAllowed()) return null;
  ls.set(GUARD, String(Date.now()));
  const work = (async (): Promise<Cutout | null> => {
    const im = await loadImg(src);
    // ≤1280 px long side and ≤1 MP: small for any phone (the model itself only looks at 256×256)
    const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight), Math.sqrt(1e6 / (im.naturalWidth * im.naturalHeight)));
    const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(im, 0, 0, w, h); im.src = "";
    const got = await withSegmenter(sg => { const r = sg.segment(c); const m0 = r.confidenceMasks?.[0]; const o = m0 ? { mw: m0.width as number, mh: m0.height as number, conf: (m0.getAsFloat32Array() as Float32Array).slice() } : null; r.close?.(); return o; });
    if (!got) { c.width = c.height = 0; return null; }
    const mw = got.mw, mh = got.mh, conf = got.conf;
    // soften: separable box blur (r=2) on the confidence map, then a smooth threshold
    const blur = (a: Float32Array, W2: number, H2: number, r: number) => {
      const t = new Float32Array(a.length), o = new Float32Array(a.length);
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < W2) { s += a[y * W2 + xx]; n++; } } t[y * W2 + x] = s / n; }
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < H2) { s += t[yy * W2 + x]; n++; } } o[y * W2 + x] = s / n; }
      return o;
    };
    const m = blur(conf, mw, mh, Math.max(1, Math.round(mw / 400)));
    const px = g.getImageData(0, 0, w, h); const d = px.data;
    const at = (x: number, y: number) => m[Math.min(mh - 1, Math.floor(y * mh / h)) * mw + Math.min(mw - 1, Math.floor(x * mw / w))];
    // plain studio backdrop? (sure-background pixels close to a smooth local colour) → refine the edge band by colour
    const GX = 40, GY = Math.max(8, Math.round(40 * h / w)), cw2 = w / GX, ch2 = h / GY;
    const sum = new Float32Array(GX * GY * 4);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (at(x, y) < .05) { const i = (y * w + x) * 4, c = (Math.floor(y / ch2) * GX + Math.floor(x / cw2)) * 4; sum[c] += d[i]; sum[c + 1] += d[i + 1]; sum[c + 2] += d[i + 2]; sum[c + 3]++; }
    const bgm = new Float32Array(GX * GY * 3), known = new Uint8Array(GX * GY); let kn = 0;
    for (let c = 0; c < GX * GY; c++) if (sum[c * 4 + 3] > 4) { for (let k = 0; k < 3; k++) bgm[c * 3 + k] = sum[c * 4 + k] / sum[c * 4 + 3]; known[c] = 1; kn++; }
    let plain = kn > GX * GY * .12;
    if (plain) {
      // deviation of sure-background pixels from their cell colour
      let dev = 0, dn = 0;
      for (let y = 0; y < h; y += 5) for (let x = 0; x < w; x += 5) if (at(x, y) < .05) { const i = (y * w + x) * 4, c = (Math.floor(y / ch2) * GX + Math.floor(x / cw2)) * 3; dev += Math.hypot(d[i] - bgm[c], d[i + 1] - bgm[c + 1], d[i + 2] - bgm[c + 2]); dn++; }
      plain = dn > 0 && dev / dn < 16;
      // fill unknown cells (behind the person) by diffusion from known ones
      const fill = Uint8Array.from(known);
      for (let it = 0; it < 60; it++) { let ch = 0;
        for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) { const c = gy * GX + gx; if (fill[c]) continue; let r = 0, g2 = 0, b2 = 0, n = 0;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = gx + ox, yy = gy + oy; if (xx < 0 || yy < 0 || xx >= GX || yy >= GY) continue; const q = yy * GX + xx; if (fill[q]) { r += bgm[q * 3]; g2 += bgm[q * 3 + 1]; b2 += bgm[q * 3 + 2]; n++; } }
          if (n) { bgm[c * 3] = r / n; bgm[c * 3 + 1] = g2 / n; bgm[c * 3 + 2] = b2 / n; fill[c] = 2; ch++; } }
        if (!ch) break; }
    }
    // "near the backdrop" map: sure-background cells dilated by ~5% of the width (colour keying is only trusted there)
    const near = new Uint8Array(GX * GY);
    for (let c = 0; c < GX * GY; c++) if (known[c]) { const gx = c % GX, gy = (c - gx) / GX; for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const xx = gx + ox, yy = gy + oy; if (xx >= 0 && yy >= 0 && xx < GX && yy < GY) near[yy * GX + xx] = 1; } }
    const sm = (e0: number, e1: number, v: number) => { const q = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return q * q * (3 - 2 * q); };
    let on = 0, x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = at(x, y), i = (y * w + x) * 4;
      let a: number;
      const cell = Math.min(GY - 1, Math.floor(y / ch2)) * GX + Math.min(GX - 1, Math.floor(x / cw2));
      if (plain && near[cell] && v >= .06) {
        // bilinear local backdrop colour
        const fx = Math.max(0, Math.min(GX - 1.001, x / cw2 - .5)), fy = Math.max(0, Math.min(GY - 1.001, y / ch2 - .5)), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const B = [0, 0, 0]; for (let k = 0; k < 3; k++) { const q = (yy: number, xx: number) => bgm[(yy * GX + xx) * 3 + k]; B[k] = (q(iy, ix) * (1 - tx) + q(iy, ix + 1) * tx) * (1 - ty) + (q(iy + 1, ix) * (1 - tx) + q(iy + 1, ix + 1) * tx) * ty; }
        const dist = Math.hypot(d[i] - B[0], d[i + 1] - B[1], d[i + 2] - B[2]);
        a = sm(10, 46, dist) * sm(.06, .25, v);
        if (a > .02 && a < .98) for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - (1 - a) * B[k]) / a));   // un-mix the backdrop colour
      } else a = plain ? (v < .06 ? 0 : 1) : sm(.4, .75, v);
      d[i + 3] = Math.round(a * 255);
      if (a > .5) { on++; const fx = x / w, fy = y / h; if (fx < x0) x0 = fx; if (fx > x1) x1 = fx; if (fy < y0) y0 = fy; if (fy > y1) y1 = fy; }
    }
    const cover = on / (w * h);
    if (cover < .03 || cover > .9) { c.width = c.height = 0; return null; }          // no clear person, or nothing but person
    g.putImageData(px, 0, 0);
    const blob: Blob | null = await new Promise(r => c.toBlob(b => r(b), "image/png"));
    c.width = c.height = 0;
    if (!blob) return null;
    return { url: URL.createObjectURL(blob), blob, box: [+x0.toFixed(3), +y0.toFixed(3), +x1.toFixed(3), +y1.toFixed(3)] };
  })();
  const done = work.catch(e => { console.warn("[ev-cutout]", e); return null; });
  done.finally(() => ls.set(GUARD, null));
  return Promise.race([done, new Promise<null>(r => setTimeout(() => r(null), timeoutMs))]);
}
if (typeof window !== "undefined") (window as any).__evCutout = cutoutPerson;
