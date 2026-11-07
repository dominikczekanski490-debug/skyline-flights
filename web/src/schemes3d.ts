// Stylised 3D paint schemes, reconstructed from dated, attributed Wikimedia Commons photos (see /liveries/ATTRIBUTION.md).
// Shapes are simplified approximations of the real paint — NOT exact liveries. Logos are the real public-domain files where one exists.
import type { Scheme } from "./paint3d";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const LOGO_FILES: Record<string, string> = { FR: "Ryanair_wordmark", EZY: "EasyJet_logo", BA: "BRITISH_AIRWAYS_logo", LH: "Lufthansa_Logo_2018", J2: "Jet2Logo", FRH: "Ryanair_harp_from_CommonsB737" };
// Jet2Logo.png (1200x201, rasterised from Commons Jet2Logo.svg): "Jet" = x 0..386, "2" = 386..558, ".com" = 558..1200 (measured column gaps).
export const J2CUT = { jet: [0, 386], two: [386, 172], jet2: [0, 558] } as const;
export const SCHEMES: Record<string, Scheme & { ref: string; notes: string }> = {
  FR: { id: "FR", ref: "EI-GXL B737-800, Alan Wilson, 2019-01-18, CC BY-SA 2.0", notes: "white crown, navy lower fuselage with yellow pinstripe, navy fin with yellow harp and navy harp after the title (harp traced from the CC BY-SA 4.0 Commons drawing File:Ryanair_B737-800.svg), navy engines",
    fus: (s, h) => h < 0.36 + 0.05 * clamp((s - 0.85) / 0.15) ? "#073590" : h < 0.395 + 0.05 * clamp((s - 0.85) / 0.15) ? "#f1c933" : "#ffffff",
    fin: () => "#073590", eng: "#073590",
    decals: [{ img: "FRH", on: "fin", s: 0.5, h: 0.5, ws: 0.62, tint: "#f1c933", fwd: true }, { img: "FR", on: "fus", s: 0.68, h: 0.66, ws: 0.4, parts: [{ img: "FR", x: 0, w: 0.86, tint: "#073590" }, { img: "FRH", x: 0.885, w: 0.115, tint: "#073590", fwd: true }] }] },
  EZY: { id: "EZY", ref: "G-UZHS A320neo, Alec Wilson, 2020, CC BY-SA 2.0", notes: "white, orange fin with white easyJet wordmark up the fin, orange aft swoosh and forward upper band carrying the white title, orange engines",
    fus: (s, h) => (s < 0.34 && h < 1.15 - s * 2.6) || (h > 0.56 && s > 0.5 && s < 0.9 && h > 0.56 + 2.2 * Math.max(0, s - 0.86)) ? "#ff6600" : "#ffffff",
    fin: () => "#ff6600", eng: "#ff6600",
    decals: [{ img: "EZY", on: "fus", s: 0.69, h: 0.74, ws: 0.3, tint: "#ffffff" }, { img: "EZY", on: "fin", s: 0.42, h: 0.46, ws: 0.68, rot: 62, tint: "#ffffff" }] },
  BA: { id: "BA", ref: "G-TTNS A320neo, Southsea_Matt, 2025-06-27, CC BY 4.0", notes: "white, navy belly, red/blue speedmarque by the nose; fin = diagonal red/white/navy bands (simplified stand-in for the Chatham Dockyard flag artwork); navy engines",
    fus: (s, h) => h < 0.2 ? "#1c2c5c" : (s > 0.86 && s < 0.95 && h > 0.6 && h < 0.7 - (s - 0.86) * 0.3) ? (h > 0.65 ? "#c8102e" : "#1c2c5c") : "#ffffff",
    fin: (fs, fh) => { const t = fh - (1 - fs) * 0.55; return t > 0.32 ? "#ffffff" : t > 0.14 ? "#c8102e" : t > 0.04 ? "#ffffff" : t > -0.12 ? "#1c2c5c" : t > -0.2 ? "#ffffff" : "#c8102e"; }, eng: "#1c2c5c",
    decals: [{ img: "BA", on: "fus", s: 0.72, h: 0.6, ws: 0.3, tint: "#1c2c5c" }] },
  LH: { id: "LH", ref: "D-AINF A320neo, Riik@mctr, 2019-10-23, CC BY-SA 2.0", notes: "white, navy fin and aft lower fuselage sweep, white crane roundel (real PD logo) on the fin, white engines",
    fus: (s, h) => h < 1.3 - s * 4.2 ? "#05164d" : "#ffffff",
    fin: () => "#05164d", eng: "#e9ebef",
    decals: [{ img: "LH", on: "fus", s: 0.73, h: 0.7, ws: 0.3, tint: "#05164d", sx: 440, sw: 1160 }, { img: "LH", on: "fin", s: 0.5, h: 0.5, ws: 0.46, tint: "#ffffff", sx: 0, sw: 282 }] },
  J2COM: { id: "J2COM", ref: "G-SUNS A321neo, Oscaracton, 2026-05-17, CC BY 4.0 (+ G-GDFX 2023)", notes: "silver-grey fuselage, big red 'Jet' + white '2' forward title, red fin with white jet2.com up the fin, red engines (real PD Jet2.com logo)",
    fus: () => "#a9aeb6", fin: () => "#d7192d", eng: "#d7192d",
    decals: [{ img: "J2", on: "fus", s: 0.8, h: 0.47, ws: 0.17, parts: [{ img: "J2", x: 0, w: 386 / 558, sx: 0, sw: 386, tint: "#d7192d" }, { img: "J2", x: 386 / 558, w: 172 / 558, sx: 386, sw: 172, tint: "#ffffff" }] }, { img: "J2", on: "fin", s: 0.4, h: 0.42, ws: 0.6, rot: 56, tint: "#ffffff" }] },
  J2HOL: { id: "J2HOL", ref: "G-HLYI A321neo + G-JZBP, Oscaracton, 2026-05-17, CC BY 4.0", notes: "white; blue sweep from under the wing up to the tail; orange/yellow under the tail cone; blue fin with a large orange sun low on the trailing edge, red spikes and yellow rim (drawn by Skyline); blue engines; big forward title = real PD 'Jet2' glyphs in red + 'holidays' in orange (bold font, no PD Jet2holidays file); red 'Package holidays you can trust' slogan",
    fus: (s, h) => s < 0.1 && h > 0.15 && h < 0.75 - s * 3 ? "#f7941d" : h < 1.25 - s * 2.9 ? "#1f5bb5" : "#ffffff",
    fin: (fs, fh) => sun(fs, fh), eng: "#1f5bb5",
    decals: [{ img: "J2", on: "fus", s: 0.79, h: 0.38, ws: 0.27, parts: [{ img: "J2", x: 0, w: 0.43, sx: 0, sw: 558, tint: "#d7192d" }, { img: "txt:holidays", x: 0.45, w: 0.55, tint: "#f26b21" }] }, { img: "txt:slogan", on: "fus", s: 0.55, h: 0.8, ws: 0.3, tint: "#d7192d" }] },
  J2: { id: "J2", ref: "none — registration not in the photo-checked list", notes: "Jet2 sub-brand unknown for this registration: neutral white/grey with only the 'Jet2' glyphs common to both brands (no .com, no holidays)",
    fus: () => "#ffffff", fin: () => "#9aa0a8", eng: "#9aa0a8", decals: [{ img: "J2", on: "fus", s: 0.74, h: 0.62, ws: 0.12, tint: "#d7192d", sx: 0, sw: 558 }] },
};
// Ryanair harp, stylised: frame arc + strings, in fin coordinates (fs 0 trailing .. 1 leading, fh 0 root .. 1 tip). Drawn approximation, not the official artwork.
function harp(u: number, v: number) { // u,v in -1..1 (v up). Stylised harp: curved neck, forward pillar, 6 thin strings.
  const neckY = 0.72 - 0.22 * u * u + 0.12 * u; const neck = Math.abs(v - neckY) < 0.12 && u > -0.92 && u < 0.92;
  const pillar = Math.abs(u - (0.62 + 0.22 * (v + 1) / 2)) < 0.11 && v > -0.95 && v < neckY;
  const k = (u + 0.8) / 1.4 * 6; const str = u > -0.8 && u < 0.6 && v < neckY && v > -0.95 + (0.6 - u) * 0.85 && k % 1 < 0.3; return neck || pillar || str; }
// Shape decals rendered from code (square images) so fin art keeps its proportions on any fin
export function shapeImg(fn: (u: number, v: number) => boolean, n = 256) { const d = new Uint8ClampedArray(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let c = 0; for (const [a, b] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) c += fn(((x + a) / n) * 2 - 1, 1 - ((y + b) / n) * 2) ? 1 : 0; const o = 4 * (y * n + x); d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = c * 63.75; } return { w: n, h: n, data: d }; }
export const SHAPES = { "shape:harp": () => shapeImg(harp) };
// Jet2holidays fin: blue with a sun low on the trailing side and red/orange rays fanning forward-up (simplified from G-HLYI photo)
function sun(fs: number, fh: number) { // G-HLYI: big orange disc low on the trailing edge, yellow lower rim, red spikes fanning forward/up
  const dx = (fs - 0.08) * 1.1, dy = fh - 0.22; const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  if (r < 0.36) return dy < -0.12 + dx * 0.2 ? "#ffc72c" : "#f7941d";
  if (r < 0.62 && a > -0.5 && a < 2.0) { const k = (a + 0.5) / 2.5 * 7, f = k % 1; const tip = 1 - (r - 0.36) / 0.26; if (Math.abs(f - 0.5) < 0.42 * tip) return "#e4002b"; }
  return "#1f5bb5"; }
// Only registrations seen in dated Commons photos are given a Jet2 sub-brand.
export const JET2_REG: Record<string, { b: "J2COM" | "J2HOL"; ref: string }> = {
  "G-GDFX": { b: "J2COM", ref: "Commons: Jet2.com_Boeing_737-800_(G-GDFX)_@_MAN,_June_2023.jpg" },
  "G-SUNS": { b: "J2COM", ref: "Commons: G-SUNS-Jet2-EGCC.jpg (2026-05-17)" },
  "G-HLYI": { b: "J2HOL", ref: "Commons: G-HLYI-Jet2holidays-EGCC.jpg (2026-05-17)" },
  "G-JZBP": { b: "J2HOL", ref: "Commons: G-JZBP-Jet2holidays-EGCC.jpg (2026-05-17)" },
};
