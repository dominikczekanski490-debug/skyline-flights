/** Eurovision studio — Picture Postcard maker. One photo (kept on this device) becomes a ~15 s cinematic
 *  postcard: Ken Burns shots, grade, light leaks, grain, flag-colour accents and a styled title reveal,
 *  then it flows straight into that style's stage card. Motion is transform/opacity driven by one clock. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { EvCard, EvStyle } from "./eurovision-data";
import { TvFrame, StageCardTV, Ell, useFontsReady, fitSize } from "./evcards";
import { BED_IMPACT, pcLen } from "./evaudio";
import type { Cutout } from "./evcutout";
import "./evpostcard.css";

export const PC_LEN = 15;           // postcard length (s) for ESC / JESC; the stage card takes over here
export const PC_LEN_ASIA = 9;       // Eurovision Asia: a short fashion-shoot postcard (person on a glowing gradient)
const W = 1600, H = 900;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const ease = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const outCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const win = (T: number, a: number, b: number, fi = .4, fo = .4) => Math.min(ease((T - a) / fi), 1 - ease((T - (b - fo)) / fo));

export const SAMPLE_PHOTO = "/ev/sample-postcard.webp";
export const SAMPLE_PORTRAIT = "/ev/sample-portrait.webp";   // generated model, no real person; used by the Asia style

/* ───────────── photo storage (IndexedDB, never uploaded) ───────────── */
const DB = "skyline-ev", ST = "photos", KEY = "postcard";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function loadPhoto(): Promise<string | null> {
  try { const db = await idb(); return await new Promise(res => { const q = db.transaction(ST).objectStore(ST).get(KEY); q.onsuccess = () => res((q.result as string) || null); q.onerror = () => res(null); }); } catch { return null; }
}
export async function savePhoto(url: string | null) {
  try { const db = await idb(); await new Promise<void>(res => { const tx = db.transaction(ST, "readwrite"); const s = tx.objectStore(ST); if (url) s.put(url, KEY); else s.delete(KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch { /* storage off */ }
}
/** The person cut-out of the saved photo (PNG with alpha) — also stays on this device. `of` ties it to the photo. */
export type SavedCut = { of: string; blob: Blob; box: [number, number, number, number] };
export const photoTag = (u: string) => { let h = 0; for (let i = 0; i < u.length; i += 97) h = (h * 31 + u.charCodeAt(i)) | 0; return u.length + ":" + h; };
export async function loadCut(): Promise<SavedCut | null> {
  try { const db = await idb(); return await new Promise(res => { const q = db.transaction(ST).objectStore(ST).get(KEY + "-cut"); q.onsuccess = () => res((q.result as SavedCut) || null); q.onerror = () => res(null); }); } catch { return null; }
}
export async function saveCut(c: SavedCut | null) {
  try { const db = await idb(); await new Promise<void>(res => { const tx = db.transaction(ST, "readwrite"); const s = tx.objectStore(ST); if (c) s.put(c, KEY + "-cut"); else s.delete(KEY + "-cut"); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch { /* storage off */ }
}
/** Downscale a picked photo (≤1280 px long side and ≤1.2 MP, JPEG) so it stores small and decodes fast on a phone.
 *  iPhone photos are 12–48 MP: the full-size decode is dropped straight after this one draw. */
export function downscalePhoto(file: Blob, max = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file); const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight), Math.sqrt(1.2e6 / (im.naturalWidth * im.naturalHeight)));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const g = c.getContext("2d")!; g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); im.src = "";
      const out = c.toDataURL("image/jpeg", .86); c.width = c.height = 0; res(out);
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Could not read that photo")); };
    im.src = u;
  });
}

/* ───────────── look development: graded variants, flag colours, grain ───────────── */
type Grades = { warm: string; teal: string; punch: string; soft: string; w: number; h: number };
const gradeCache = new Map<string, Promise<Grades>>();
function gradePhoto(src: string): Promise<Grades> {
  if (gradeCache.has(src)) return gradeCache.get(src)!;
  const p = new Promise<Grades>((res, rej) => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight)); const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(im, 0, 0, w, h); const base = g.getImageData(0, 0, w, h);
      const S = (x: number, k2: number) => { const t = x / 255; const s = t < .5 ? .5 * Math.pow(2 * t, k2) : 1 - .5 * Math.pow(2 - 2 * t, k2); return s * 255; };
      const lut = (fn: (x: number, ch: number) => number) => { const L = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)]; for (let ch = 0; ch < 3; ch++) for (let x = 0; x < 256; x++) L[ch][x] = fn(x, ch); return L; };
      const make = (L: Uint8ClampedArray[], sat: number) => {
        const d = new ImageData(new Uint8ClampedArray(base.data), w, h), a = d.data;
        for (let i = 0; i < a.length; i += 4) {
          let r = L[0][a[i]], gg = L[1][a[i + 1]], b = L[2][a[i + 2]]; const l = .3 * r + .59 * gg + .11 * b;
          r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat; a[i] = r; a[i + 1] = gg; a[i + 2] = b;
        }
        g.putImageData(d, 0, 0); return c.toDataURL("image/jpeg", .88);
      };
      const warm = make(lut((x, ch) => 10 + S(x, 1.25) * .94 * [1.07, 1, .86][ch] + [6, 2, 0][ch]), 1.12);
      const teal = make(lut((x, ch) => { const s = S(x, 1.4); return ch === 0 ? s * 1.05 + (s > 128 ? 8 : -6) : ch === 1 ? s * .99 + 4 : s * (s < 120 ? 1.12 : .9) + (s < 120 ? 14 : 0); }), 1.05);
      const punch = make(lut((x, ch) => S(x, 1.55) * [1.04, 1, 1.02][ch]), 1.35);
      // soft = heavy blur via down/up-scale (for focus pulls and dreamy transitions)
      const t = document.createElement("canvas"); t.width = 48; t.height = Math.max(8, Math.round(48 * h / w)); t.getContext("2d")!.drawImage(im, 0, 0, t.width, t.height);
      const s2 = document.createElement("canvas"); s2.width = 400; s2.height = Math.round(400 * h / w); const g2 = s2.getContext("2d")!; g2.imageSmoothingQuality = "high"; g2.drawImage(t, 0, 0, s2.width, s2.height);
      const soft = s2.toDataURL("image/jpeg", .8); c.width = c.height = t.width = t.height = s2.width = s2.height = 0;
      res({ warm, teal, punch, soft, w, h });
    };
    im.onerror = () => rej(new Error("photo"));
    im.src = src;
  });
  gradeCache.set(src, p); p.catch(() => gradeCache.delete(src));
  return p;
}

const STYLE_ACCENT: Record<EvStyle, string[]> = { asia: ["#E6192B", "#FF2F6E", "#FFD000"], esc: ["#ff2d8a", "#ff6a3d", "#7a2bff"], jesc: ["#5b8cff", "#ff7ad9", "#ffe566"] };
const flagCache = new Map<string, Promise<string[]>>();
/** Main colours of a country's flag, read from the bundled flag SVG (most common, distinct, not near-white/black first). */
export function flagColours(cc: string, style: EvStyle): Promise<string[]> {
  const k = cc.toLowerCase(); if (!k) return Promise.resolve(STYLE_ACCENT[style]);
  if (!flagCache.has(k)) flagCache.set(k, new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas"); c.width = 64; c.height = 48; const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(im, 0, 0, 64, 48);
      const d = g.getImageData(0, 0, 64, 48).data; const n = new Map<number, { c: number; r: number; g: number; b: number }>();
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const q = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); const e = n.get(q) || { c: 0, r: 0, g: 0, b: 0 }; e.c++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; n.set(q, e); }
      const cols = [...n.values()].filter(e => e.c > 20).sort((a, b) => b.c - a.c).map(e => [e.r / e.c, e.g / e.c, e.b / e.c]);
      const out: number[][] = [];
      for (const c2 of cols) { if (out.every(o => Math.hypot(o[0] - c2[0], o[1] - c2[1], o[2] - c2[2]) > 70)) out.push(c2); if (out.length >= 4) break; }
      const sat = (c2: number[]) => Math.max(...c2) - Math.min(...c2);
      const vivid = out.filter(c2 => sat(c2) > 60); const neutral = out.filter(c2 => sat(c2) <= 60);
      const hex = [...vivid, ...neutral].map(c2 => "#" + c2.map(v => Math.round(v).toString(16).padStart(2, "0")).join(""));
      res(hex.length ? (hex.length < 3 ? [...hex, ...STYLE_ACCENT[style]].slice(0, 3) : hex.slice(0, 3)) : STYLE_ACCENT[style]);
    };
    im.onerror = () => res(STYLE_ACCENT[style]);
    im.src = `/flags/4x3/${k}.svg`;
  }));
  return flagCache.get(k)!;
}
let grainUrl = "";
function grain() {
  if (grainUrl || typeof document === "undefined") return grainUrl;
  const c = document.createElement("canvas"); c.width = c.height = 160; const g = c.getContext("2d")!; const d = g.createImageData(160, 160);
  let s = 4242; for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = (s / 2147483647) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return (grainUrl = c.toDataURL("image/png"));
}

/* ───────────── shot list ───────────── */
type Cam = { s: number; x: number; y: number; r: number };
type Shot = { a: number; b: number; g: keyof Omit<Grades, "w" | "h" | "soft">; from: Cam; to: Cam; fi: number; fo: number; pull?: number };
const SHOTS: Shot[] = [
  { a: 0, b: 3.95, g: "warm", from: { s: 1.04, x: .02, y: .03, r: 0 }, to: { s: 1.17, x: -.02, y: 0, r: 0 }, fi: .7, fo: .35, pull: 1.3 },
  { a: 3.6, b: 7.15, g: "teal", from: { s: 1.85, x: -.17, y: -.1, r: -.6 }, to: { s: 1.62, x: -.07, y: -.05, r: .2 }, fi: .35, fo: .3 },
  { a: 6.85, b: 10.35, g: "punch", from: { s: 1.42, x: .2, y: .08, r: .9 }, to: { s: 1.62, x: .1, y: -.02, r: -.4 }, fi: .3, fo: .4 },
  { a: 9.95, b: 15.2, g: "warm", from: { s: 1.42, x: 0, y: -.02, r: 0 }, to: { s: 1.06, x: 0, y: .02, r: 0 }, fi: .45, fo: .3, pull: 10.9 },
];

/** Transform for a shot at local progress p, clamped so the photo always covers the frame. */
function camAt(sh: Shot, p: number, cw: number, ch: number, still: boolean) {
  const e = still ? .5 : ease(p * .9 + .05) * .55 + p * .45;
  const s0 = lerp(sh.from.s, sh.to.s, e), r = lerp(sh.from.r, sh.to.r, e);
  const s = s0 * (1 + Math.abs(r) * .035);
  const mx = Math.max(0, (cw * s - W) / 2), my = Math.max(0, (ch * s - H) / 2);
  const tx = Math.max(-mx, Math.min(mx, -lerp(sh.from.x, sh.to.x, e) * cw * s)), ty = Math.max(-my, Math.min(my, -lerp(sh.from.y, sh.to.y, e) * ch * s));
  return `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
}

/** Decoration positions (x, y, size) around the title, per style. */
const DECO: Record<EvStyle, [number, number, number][]> = {
  asia: [[250, 300, 120], [1240, 250, 150], [330, 560, 90], [1190, 560, 100], [170, 430, 60], [1380, 420, 70]],
  esc: [[200, 330, 160], [1240, 330, 160], [520, 210, 70], [1010, 210, 70]],
  jesc: [[250, 270, 130], [1240, 250, 150], [320, 590, 90], [1210, 580, 100], [590, 190, 70], [990, 180, 80], [140, 440, 64], [1420, 440, 70]],
};

type Anim = { el: HTMLElement; f: (T: number) => [string | null, number]; t?: string; o?: number };

type Add = (f: Anim["f"]) => (el: HTMLElement | null) => void;
export type PcInfo = { country: string; cc: string; artist: string; song: string; lyrics: string };

/** The postcard player. `start` = performance.now() timestamp of Play (shared by inline + fullscreen views); null = poster. */
export function PostcardTV({ style, info, photo, cut, start, full, onPlay }: { style: EvStyle; info: PcInfo; photo: string; cut?: Cutout | null; start: number | null; full?: boolean; onPlay?: () => void }) {
  const LEN = pcLen(style), MOUNT = LEN - .25;
  const ok = useFontsReady();
  const [gr, setGr] = useState<Grades | null>(null);
  const [cols, setCols] = useState<string[]>(STYLE_ACCENT[style]);
  const [phase, setPhase] = useState<"pc" | "both" | "card">("pc");
  // element → animation; ref callbacks keep this in sync across renders (no reset during render)
  const anims = useRef(new Map<HTMLElement, Anim>());
  const add = (f: Anim["f"]) => { let mine: HTMLElement | null = null; return (el: HTMLElement | null) => {
    if (el) { mine = el; const old = anims.current.get(el); anims.current.set(el, { el, f, t: old?.t, o: old?.o }); } else if (mine) { anims.current.delete(mine); mine = null; } }; };
  const still = reduced();
  const orbs = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);

  // size first (fast) so playback never waits; graded looks swap in when ready
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let dead = false; setGr(null); setDim(null);
    const im = new Image(); im.onload = () => { if (!dead) setDim({ w: im.naturalWidth, h: im.naturalHeight }); }; im.src = photo;
    if (style !== "asia") gradePhoto(photo).then(g => { if (!dead) setGr(g); }, () => {});   // the Asia shoot needs no graded variants
    return () => { dead = true; };
  }, [photo, style]);
  useEffect(() => { let dead = false; flagColours(info.cc, style).then(c => { if (!dead) setCols(c); }); return () => { dead = true; }; }, [info.cc, style]);

  // cover size of the photo in the 1600×900 frame
  const ar = gr ? gr.w / gr.h : dim ? dim.w / dim.h : 16 / 9;
  const cw = ar >= W / H ? H * ar : W, ch = ar >= W / H ? H : W / ar;

  useEffect(() => {
    let raf = 0; let lastPhase = "";
    const tick = () => {
      const fz = (window as any).__pcFreeze;
      const T = typeof fz === "number" ? fz : start == null ? (style === "asia" ? 3.6 : 11.9) : (performance.now() - start) / 1000;
      const ph = start == null && typeof fz !== "number" ? "pc" : T >= LEN + .6 ? "card" : T >= MOUNT ? "both" : "pc";
      if (ph !== lastPhase) { lastPhase = ph; setPhase(ph); }
      for (const A of anims.current.values()) {
        const [t, o] = A.f(T);
        if (t != null && t !== A.t) { A.t = t; A.el.style.transform = t; }
        const oo = Math.round(o * 1000) / 1000; if (oo !== A.o) { if (oo === 0 || A.o === 0 || A.o == null) A.el.style.display = oo === 0 ? "none" : ""; A.o = oo; A.el.style.opacity = String(oo); }
      }
      if (start != null || typeof fz === "number") raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [start, gr, dim, cols, ok, style, info.country, info.artist, cut, LEN]);

  const card: EvCard = { style, country: info.country || "Country", cc: info.cc, song: info.song, artist: info.artist, lyrics: info.lyrics };
  const [c1, c2, c3] = cols;
  const country = info.country || "Country";
  const shownCountry = style === "jesc" ? country.toUpperCase() : style === "esc" ? country : country;
  const titleFont = style === "asia" ? "700 100px Outfit" : style === "esc" ? "700 100px 'Fredoka Variable'" : "900 100px Montserrat";
  const bigSize = fitSize(shownCountry + (style === "asia" ? "  " : ""), px => titleFont.replace("100px", px + "px"), style === "jesc" ? 1250 : 1150, style === "jesc" ? 190 : 200, style === "jesc" ? .03 : .02, ok);
  const hide = phase === "card";
  const letters = Array.from(shownCountry);
  const nL = letters.length;

  return (
    <div className={"pc-wrap" + (full ? " full" : "")}>
      {phase !== "pc" && <div className="pc-card"><StageCardTV card={card} play={0} full={full} /></div>}
      {!hide && (
        <div className={"pc-over" + (phase === "both" ? " closing" : "")}>
          <TvFrame full={full} ready={ok} className={"pc pc-" + style}>
            {style === "asia" ? <AsiaShoot add={add} info={info} photo={photo} cut={cut ?? null} dim={dim ?? (photo === SAMPLE_PORTRAIT ? { w: 1280, h: 720 } : null)} ok={ok} still={still} /> : <>
            <div className="pc-black" />
            {!gr && !dim && <div className="pc-poster" style={{ backgroundImage: `url("${photo}")` }} />}
            {(gr || dim) && SHOTS.map((sh, i) => (
              <div key={i} className="pc-shot" ref={add(T => [null, still ? win(T, sh.a, sh.b, .5, .5) : win(T, sh.a, sh.b, sh.fi, sh.fo)])}>
                <div className="pc-img" style={{ width: cw, height: ch, marginLeft: -cw / 2, marginTop: -ch / 2, backgroundImage: `url("${gr ? gr[sh.g] : photo}")` }}
                  ref={add(T => [camAt(sh, clamp01((T - sh.a) / (sh.b - sh.a)), cw, ch, still), 1])} />
                {sh.pull != null && gr && (
                  <div className="pc-img soft" style={{ width: cw, height: ch, marginLeft: -cw / 2, marginTop: -ch / 2, backgroundImage: `url(${gr.soft})` }}
                    ref={add(T => [camAt(sh, clamp01((T - sh.a) / (sh.b - sh.a)), cw, ch, still), 1 - ease((T - (sh.pull! - .9)) / 1)])} />
                )}
              </div>
            ))}
            {/* depth: out-of-focus orbs drifting faster than the photo (parallax) */}
            <div className="pc-bokeh" aria-hidden="true">
              {orbs.map(i => {
                const x = (i * 337) % 1600, y = (i * 211) % 900, s = 40 + (i * 53) % 110, sp = .6 + (i % 5) * .25;
                return <i key={i} style={{ left: x, top: y, width: s, height: s, background: `radial-gradient(circle, ${[c1, c2, c3, "#fff"][i % 4]}aa, transparent 68%)` }}
                  ref={add(T => [`translate3d(${(-T * 38 * sp).toFixed(1)}px,${(Math.sin(T * .7 + i) * 18).toFixed(1)}px,0)`, (still ? .25 : .5) * win(T, .4 + (i % 4) * .3, 14.4, 1, .6) * (.5 + .5 * Math.sin(T * 1.3 + i))])} />;
              })}
            </div>
            {/* light leaks + anamorphic flare at the cuts */}
            <div className="pc-leak l1" style={{ "--c": "#ff8a3d" } as CSSProperties} ref={add(T => [`translate3d(${(-300 + ((T * 90) % 2200)).toFixed(0)}px,${(Math.sin(T * .5) * 80).toFixed(0)}px,0) rotate(${(T * 6).toFixed(1)}deg)`, .55 * (.55 + .45 * Math.sin(T * .9))])} />
            <div className="pc-leak l2" style={{ "--c": c1 } as CSSProperties} ref={add(T => [`translate3d(${(1300 - ((T * 70) % 2000)).toFixed(0)}px,${(120 + Math.cos(T * .6) * 90).toFixed(0)}px,0)`, .45 * (.5 + .5 * Math.sin(T * 1.1 + 2))])} />
            {[3.75, 7.0, 10.1].map((tc, i) => (
              <div key={i} className="pc-flash" ref={add(T => [`scaleX(${(.6 + clamp01((T - tc + .25) / .6) * .9).toFixed(3)})`, still ? 0 : .72 * Math.max(0, 1 - Math.abs(T - tc) / .28)])} />
            ))}
            <div className="pc-streak" ref={add(T => [`translate3d(${(-900 + clamp01((T - 9.7) / 1.1) * 2600).toFixed(0)}px,0,0)`, still ? 0 : win(T, 9.75, 10.8, .2, .3)])} />
            {/* flag-colour accents */}
            <div className="pc-stripes" ref={add(T => { const p = (T - 6.6) / .75; return [`translate3d(${(-2300 + outCubic(p) * 2300 + ease((T - 7.1) / .5) * 2600).toFixed(0)}px,0,0) skewX(-18deg)`, T > 6.5 && T < 7.8 ? 1 : 0]; })}>
              <b style={{ background: c1 }} /><b style={{ background: c2 }} /><b style={{ background: c3 }} />
            </div>
            <div className="pc-grade" />
            <div className="pc-shade" ref={add(T => [null, win(T, 10.5, 14.7, .8, .4)])} />
            <div className="pc-vig" />
            <div className="pc-grain" style={{ backgroundImage: `url(${grain()})` }} ref={add(T => [still ? null : `translate3d(${((Math.floor(T * 24) * 37) % 160) - 80}px,${((Math.floor(T * 24) * 71) % 160) - 80}px,0)`, .07])} />

            {/* lower-thirds: artist (shot 2), song (shot 3) */}
            <div className="pc-lt l" ref={add(T => [`translate3d(${((1 - outCubic((T - 4.0) / .7)) * -60 + ease((T - 6.6) / .4) * -40).toFixed(1)}px,0,0)`, win(T, 4.0, 6.9, .45, .35)])}>
              <i className="pc-bar" style={{ background: `linear-gradient(180deg,${c1},${c2},${c3})` }} />
              <span className="k">{style === "jesc" ? "MEET" : style === "esc" ? "INTRODUCING" : "Introducing"}</span>
              <span className="v">{info.artist || "Artist"}</span>
            </div>
            <div className="pc-lt r" ref={add(T => [`translate3d(${((1 - outCubic((T - 7.5) / .7)) * 60 + ease((T - 9.6) / .4) * 40).toFixed(1)}px,0,0)`, win(T, 7.5, 9.95, .45, .35)])}>
              <i className="pc-bar" style={{ background: `linear-gradient(180deg,${c3},${c2},${c1})` }} />
              <span className="k">{(style as EvStyle) === "asia" ? "Performing" : "PERFORMING"}</span>
              <span className="v">{(style as EvStyle) === "asia" ? info.song || "Song" : `“${info.song || "Song"}”`}</span>
            </div>

            {/* the country reveal */}
            <div className="pc-title">
              <div className="pc-flag" ref={add(T => [`translate3d(0,${((1 - outCubic((T - 11.25) / .5)) * 30).toFixed(1)}px,0)`, win(T, 11.25, 14.6, .4, .3)])}>
                {info.cc ? <img src={`/flags/4x3/${info.cc.toLowerCase()}.svg`} alt="" /> : null}
              </div>
              <div className="pc-country" style={{ fontSize: bigSize }} ref={add(T => { const k = T - BED_IMPACT; const shake = !still && k > 0 && k < .25 ? Math.sin(k * 90) * (1 - k / .25) * 7 : 0; return [`translate3d(${shake.toFixed(1)}px,${(shake * .4).toFixed(1)}px,0)`, 1 - ease((T - 14.35) / .3)]; })}>
                <span className="pc-sr">{country}</span>
                {letters.map((chr, i) => {
                  const at = BED_IMPACT - .32 + (i / Math.max(1, nL - 1)) * .3;
                  return <span key={i} aria-hidden="true" className="pc-ch" ref={add(T => {
                    const k = (T - at) / .26;
                    if (still) return ["none", ease((T - 10.6) / .5)];
                    const sc = style === "jesc" ? lerp(1.9, 1, outCubic(k)) : style === "esc" ? 1 : lerp(1.35, 1, outCubic(k));
                    const y = style === "jesc" ? (1 - outCubic(k)) * -40 : (style as EvStyle) === "asia" ? (1 - outCubic(k)) * 26 : 0;
                    const op = style === "esc" ? (k < 0 ? 0 : k < .3 ? (Math.floor(k * 20) % 2 ? .25 : 1) : 1) : clamp01(k * 2.5);
                    return [`translate3d(0,${y.toFixed(1)}px,0) scale(${sc.toFixed(3)})`, op];
                  })}>{chr === "l" && (style as EvStyle) === "asia" ? <Ell w={11.5} /> : chr === " " ? "\u00a0" : chr}</span>;
                })}
              </div>
              <div className="pc-sub" ref={add(T => [`translate3d(0,${((1 - outCubic((T - 11.5) / .6)) * 24).toFixed(1)}px,0)`, win(T, 11.5, 14.55, .5, .3)])}>
                {style === "jesc" ? `${(info.song || "Song").toUpperCase()} · ${(info.artist || "Artist").toUpperCase()}` : style === "esc" ? `${(info.artist || "Artist").toUpperCase()} — ${(info.song || "Song").toUpperCase()}` : `${info.song || "Song"} · ${info.artist || "Artist"}`}
              </div>
            </div>
            {/* style decoration around the title */}
            <div className="pc-deco" aria-hidden="true">
              {DECO[style].map((d, i) => (
                <i key={i} className={"pc-d " + style} style={{ left: d[0], top: d[1], width: d[2], height: d[2], "--c": [c1, c2, c3][i % 3] } as CSSProperties}
                  ref={add(T => { const k = T - (BED_IMPACT + .1 + i * .07); return [`translate3d(0,${(Math.sin(T * 1.6 + i) * 10).toFixed(1)}px,0) rotate(${(style === "jesc" ? T * 40 : Math.sin(T + i) * 14).toFixed(1)}deg) scale(${(still ? 1 : outCubic(k / .45) * (style === "jesc" ? .75 + .25 * Math.sin(T * 6 + i) : 1)).toFixed(3)})`, win(T, BED_IMPACT + .1 + i * .07, 14.5, .3, .3)]; })} />
              ))}
            </div>
            <div className="pc-impact" ref={add(T => [`scale(${(1 + clamp01((T - BED_IMPACT) / .5) * .6).toFixed(3)})`, still ? 0 : Math.max(0, 1 - Math.abs(T - BED_IMPACT - .02) / .35) * .9])} />

            {/* closing wipe in flag colours into the stage card */}
            <div className="pc-wipe" ref={add(T => [`translate3d(${(-2400 + outCubic((T - 14.45) / .45) * 2400 + ease((T - 14.95) / .45) * 2700).toFixed(0)}px,0,0) skewX(-14deg)`, T > 14.4 && T < 15.5 ? 1 : 0])}>
              <b style={{ background: c3 }} /><b style={{ background: c2 }} /><b style={{ background: c1 }} /><b className="w" />
            </div>
            </>}
            {start == null && onPlay && (
              <button type="button" className="pc-play" aria-label="Play postcard with sound" onClick={e => { e.stopPropagation(); onPlay(); }}>
                <span>▶</span><em>Play postcard</em>
              </button>
            )}
          </TvFrame>
        </div>
      )}
    </div>
  );
}

/* ───────────── Eurovision Asia: fashion-shoot postcard ─────────────
 * The artist on a smooth magenta → royal-blue glowing backdrop, slow-motion drift, a few cuts (one bloom-flash cut),
 * and the artist's name huge in heavy geometric caps with a sliding rainbow fill. With a cut-out the person sits on our
 * animated gradient; without one the whole photo gets a gradient colour wash. */
type AShot = { a: number; b: number; ph0: number; ph1: number; fx: number; fy: number; dx: number; flip?: boolean; nx: number; ny: number; fi: number };
const ASHOTS: AShot[] = [
  { a: 0, b: 1.75, ph0: 1.0, ph1: 1.06, fx: .42, fy: .05, dx: -26, nx: .3, ny: .6, fi: .35 },
  { a: 1.75, b: 3.02, ph0: 1.1, ph1: 1.16, fx: .34, fy: .03, dx: 30, flip: true, nx: .64, ny: .6, fi: 0 },
  { a: 3.02, b: 6.1, ph0: 1.78, ph1: 1.62, fx: .6, fy: -.09, dx: -34, nx: .3, ny: .64, fi: 0 },
  { a: 6.1, b: 9.2, ph0: 1.02, ph1: 1.1, fx: .55, fy: .04, dx: 24, nx: .37, ny: .7, fi: 0 },
];
const RAINBOW = "linear-gradient(90deg,#FF9800,#FFEB3B 17%,#4CAF50 34%,#2196F3 52%,#E91E63 72%,#FF9800 100%)";

function AsiaShoot({ add, info, photo, cut, dim, ok, still }: { add: Add; info: PcInfo; photo: string; cut: Cutout | null; dim: { w: number; h: number } | null; ok: boolean; still: boolean }) {
  const name = (info.artist || "Artist").toUpperCase();
  const size = fitSize(name, px => `800 ${px}px Outfit`, 760, 190, -.01, ok);
  const iw = dim?.w || 1600, ih = dim?.h || 900;
  const box: [number, number, number, number] = cut ? cut.box : [0, 0, 1, 1];
  const bh = Math.max(.2, box[3] - box[1]);
  // element at ph=1: person box height == frame height
  const eh = H / bh, ew = eh * iw / ih;
  const place = (sh: AShot, T: number) => {
    const p = clamp01((T - sh.a) / (sh.b - sh.a)), e = still ? .5 : p;
    let k = lerp(sh.ph0, sh.ph1, e) * (cut ? 1 : 1.04);
    k = Math.min(k, 4 * H / eh);
    if (!cut) k = Math.max(k, W / ew, H / eh);
    const w = ew * k, h = eh * k;
    const cx = (box[0] + box[2]) / 2;
    let L = sh.fx * W - cx * w + (still ? 0 : sh.dx * (e - .5) * 2), Tp = sh.fy * H - box[1] * h;
    if (cut) { if (box[3] > .95 && Tp + h < H) Tp = H - h; }
    else { L = Math.max(W - w, Math.min(0, L)); Tp = Math.max(H - h, Math.min(0, Tp)); }
    // slow-motion life: a gentle sway around the feet and a breathing scale
    const sway = still ? 0 : Math.sin(T * .9 + sh.a) * 1.1, br = still ? 1 : 1 + Math.sin(T * 1.3 + sh.a * 2) * .008;
    const ox = cx * ew, oy = eh * Math.min(1, box[3]);
    const flip = sh.flip ? ` translate(${ox.toFixed(1)}px,0) scaleX(-1) translate(${(-ox).toFixed(1)}px,0)` : "";
    return `translate3d(${L.toFixed(1)}px,${Tp.toFixed(1)}px,0) scale(${(k * br).toFixed(4)}) translate(${ox.toFixed(1)}px,${oy.toFixed(1)}px) rotate(${sway.toFixed(3)}deg) translate(${(-ox).toFixed(1)}px,${(-oy).toFixed(1)}px)${flip}`;
  };
  const shotOp = (sh: AShot, i: number, T: number) => {
    if (T < sh.a || T >= sh.b + (i === 2 ? 0 : 0)) return 0;
    const fin = sh.fi > 0 && i > 0 ? ease((T - sh.a) / sh.fi) : 1;
    const fout = i === ASHOTS.length - 1 ? 1 - ease((T - 8.5) / .45) : 1;
    return fin * fout;
  };
  const nameAt = (T: number): [string | null, number] => {
    let sh = ASHOTS[0]; for (const s2 of ASHOTS) if (T >= s2.a) sh = s2;
    const p = clamp01((T - sh.a) / (sh.b - sh.a));
    const x = (sh.nx - .5) * W + (still ? 0 : (p - .5) * 22), y = sh.ny * H - size * .55;
    const intro = still ? 1 : outCubic((T - .15) / .5);
    return [`translate3d(${x.toFixed(1)}px,${(y + (1 - intro) * 24).toFixed(1)}px,0) scale(${(.96 + .04 * intro).toFixed(3)})`, intro * (1 - ease((T - 8.45) / .45))];
  };
  return (
    <div className="pa">
      <span className="pc-sr">{`${info.artist || "Artist"} for ${info.country || "Country"}`}</span>
      {/* glowing studio backdrop */}
      <div className="pa-bg" ref={add(T => [still ? null : `translate3d(${(Math.sin(T * .35) * 40).toFixed(1)}px,${(Math.cos(T * .3) * 22).toFixed(1)}px,0) scale(1.12)`, 1])} />
      <div className="pa-glow" ref={add(T => [still ? null : `translate3d(${(Math.sin(T * .5) * 70).toFixed(1)}px,${(Math.cos(T * .42) * 40).toFixed(1)}px,0)`, .85 + .15 * Math.sin(T * 1.1)])} />
      <div className="pa-band" ref={add(T => [`translate3d(${(still ? 0 : -120 + ((T * 38) % 260)).toFixed(1)}px,0,0) rotate(-24deg)`, .9])} />
      {[0, 1, 2].map(i => (
        <div key={i} className={"pa-streak s" + i} ref={add(T => [`translate3d(${(still ? 0 : ((T * (40 + i * 22) + i * 500) % 2200) - 600).toFixed(1)}px,${(i * 160 - 60).toFixed(0)}px,0) rotate(${-28 + i * 5}deg)`, (.35 + .25 * Math.sin(T * 1.4 + i * 2)) * (still ? .6 : 1)])} />
      ))}
      {/* the artist */}
      {dim && ASHOTS.map((sh, i) => (
        <div key={i} className="pa-shot" ref={add(T => [null, shotOp(sh, i, T)])}>
          <div className={"pa-person" + (cut ? " cut" : " wash")} style={{ width: ew, height: eh, backgroundImage: `url("${cut ? cut.url : photo}")` }} ref={add(T => [place(sh, T), 1])} />
          {!cut && <div className="pa-wash" />}
        </div>
      ))}
      {!dim && <div className="pc-poster pa-poster" style={{ backgroundImage: `url("${cut ? cut.url : photo}")` }} />}
      {/* a soft light streak drifting in front for depth */}
      <div className="pa-streak front" ref={add(T => [`translate3d(${(still ? 200 : ((T * 120) % 2600) - 900).toFixed(1)}px,380px,0) rotate(-30deg)`, .4])} />
      {/* the name: heavy geometric caps, sliding rainbow fill, soft shadow */}
      <div className="pa-name" style={{ fontSize: size }} ref={add(nameAt)}>
        <span className="pa-sh" aria-hidden="true">{name}</span>
        <span className="pa-rb" style={{ backgroundImage: RAINBOW }}>{name}</span>
      </div>
      {/* bloom-flash cut and a softer flash on the dissolve */}
      <div className="pa-flash" ref={add(T => [null, still ? 0 : Math.max(Math.max(0, 1 - Math.abs(T - 3.02) / (T < 3.02 ? .1 : .24)) * 1, Math.max(0, 1 - Math.abs(T - 6.1) / (T < 6.1 ? .08 : .3)) * .45)])} />
      <div className="pc-vig pa-vig" />
      <div className="pa-black" ref={add(T => [null, ease((T - 8.6) / .4)])} />
    </div>
  );
}
