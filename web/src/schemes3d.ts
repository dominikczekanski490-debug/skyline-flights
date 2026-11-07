// Stylised 3D paint schemes, reconstructed from dated, attributed Wikimedia Commons photos (see /liveries/ATTRIBUTION.md).
// Shapes are simplified approximations of the real paint — NOT exact liveries. Logos are the real public-domain files where one exists.
import type { Scheme } from "./paint3d";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const LOGO_FILES: Record<string, string> = { FR: "Ryanair_wordmark", EZY: "EasyJet_logo", BA: "BRITISH_AIRWAYS_logo", LH: "Lufthansa_Logo_2018", J2: "Jet2Logo" };
// Jet2Logo.png (1200x201, rasterised from Commons Jet2Logo.svg): "Jet" = x 0..386, "2" = 386..558, ".com" = 558..1200 (measured column gaps).
export const J2CUT = { jet: [0, 386], two: [386, 172], jet2: [0, 558] } as const;
export const SCHEMES: Record<string, Scheme & { ref: string; notes: string }> = {
  FR: { id: "FR", ref: "EI-GXL B737-800, Alan Wilson, 2019-01-18, CC BY-SA 2.0", notes: "white crown, navy lower fuselage with yellow pinstripe, navy fin with yellow harp (harp drawn by Skyline — no PD harp file), navy engines",
    fus: (s, h) => h < 0.36 + 0.05 * clamp((s - 0.85) / 0.15) ? "#073590" : h < 0.395 + 0.05 * clamp((s - 0.85) / 0.15) ? "#f1c933" : "#ffffff",
    fin: (fs, fh) => harp(fs, fh) ? "#f1c933" : "#073590", eng: "#073590",
    decals: [{ img: "FR", on: "fus", s: 0.66, h: 0.66, ws: 0.36, tint: "#073590" }] },
  EZY: { id: "EZY", ref: "G-UZHS A320neo, Alec Wilson, 2020, CC BY-SA 2.0", notes: "white, orange fin with white easyJet wordmark up the fin, orange aft swoosh and forward upper band carrying the white title, orange engines",
    fus: (s, h) => (s < 0.34 && h < 1.15 - s * 2.6) || (h > 0.56 && s > 0.5 && s < 0.9 && h > 0.56 + 2.2 * Math.max(0, s - 0.86)) ? "#ff6600" : "#ffffff",
    fin: () => "#ff6600", eng: "#ff6600",
    decals: [{ img: "EZY", on: "fus", s: 0.69, h: 0.74, ws: 0.3, tint: "#ffffff" }, { img: "EZY", on: "fin", s: 0.45, h: 0.5, ws: 1.05, rot: 62, tint: "#ffffff" }] },
  BA: { id: "BA", ref: "G-TTNS A320neo, Southsea_Matt, 2025-06-27, CC BY 4.0", notes: "white, navy belly, red/blue speedmarque by the nose; fin = diagonal red/white/navy bands (simplified stand-in for the Chatham Dockyard flag artwork); navy engines",
    fus: (s, h) => h < 0.2 ? "#1c2c5c" : (s > 0.86 && s < 0.95 && h > 0.6 && h < 0.7 - (s - 0.86) * 0.3) ? (h > 0.65 ? "#c8102e" : "#1c2c5c") : "#ffffff",
    fin: (fs, fh) => { const t = fh - (1 - fs) * 0.55; return t > 0.32 ? "#ffffff" : t > 0.14 ? "#c8102e" : t > 0.04 ? "#ffffff" : t > -0.12 ? "#1c2c5c" : t > -0.2 ? "#ffffff" : "#c8102e"; }, eng: "#1c2c5c",
    decals: [{ img: "BA", on: "fus", s: 0.72, h: 0.6, ws: 0.3, tint: "#1c2c5c" }] },
  LH: { id: "LH", ref: "D-AINF A320neo, Riik@mctr, 2019-10-23, CC BY-SA 2.0", notes: "white, navy fin and aft lower fuselage sweep, white crane roundel (real PD logo) on the fin, white engines",
    fus: (s, h) => h < 1.3 - s * 4.2 ? "#05164d" : "#ffffff",
    fin: () => "#05164d", eng: "#e9ebef",
    decals: [{ img: "LH", on: "fus", s: 0.73, h: 0.7, ws: 0.3, tint: "#05164d", sx: 440, sw: 1160 }, { img: "LH", on: "fin", s: 0.62, h: 0.55, ws: 0.62, tint: "#ffffff", sx: 0, sw: 282 }] },
  J2COM: { id: "J2COM", ref: "G-SUNS A321neo, Oscaracton, 2026-05-17, CC BY 4.0 (+ G-GDFX 2023)", notes: "silver-grey fuselage, big red 'Jet' + white '2' forward title, red fin with white jet2.com up the fin, red engines (real PD Jet2.com logo)",
    fus: () => "#a9aeb6", fin: () => "#d7192d", eng: "#d7192d",
    decals: [{ img: "J2", on: "fus", s: 0.8, h: 0.47, ws: 0.17, parts: [{ img: "J2", x: 0, w: 386 / 558, sx: 0, sw: 386, tint: "#d7192d" }, { img: "J2", x: 386 / 558, w: 172 / 558, sx: 386, sw: 172, tint: "#ffffff" }] }, { img: "J2", on: "fin", s: 0.47, h: 0.47, ws: 0.95, rot: 56, tint: "#ffffff" }] },
  J2HOL: { id: "J2HOL", ref: "G-HLYI A321neo + G-JZBP, Oscaracton, 2026-05-17, CC BY 4.0", notes: "white, blue aft sweep from the wing to the tail, blue fin with a red/orange/yellow sunburst (drawn by Skyline), blue engines; title = real PD 'Jet2' glyphs in red + 'holidays' set in a bold font in orange (no PD Jet2holidays file)",
    fus: (s, h) => h < 1.25 - s * 2.9 ? "#1f5bb5" : "#ffffff",
    fin: (fs, fh) => sun(fs, fh), eng: "#1f5bb5",
    decals: [{ img: "J2", on: "fus", s: 0.78, h: 0.36, ws: 0.2, parts: [{ img: "J2", x: 0, w: 0.46, sx: 0, sw: 558, tint: "#d7192d" }, { img: "txt:holidays", x: 0.48, w: 0.52, tint: "#f26b21" }] }] },
  J2: { id: "J2", ref: "none — registration not in the photo-checked list", notes: "Jet2 scheme unknown for this registration: neutral white/grey with the real Jet2.com logo only",
    fus: () => "#ffffff", fin: () => "#9aa0a8", eng: "#9aa0a8", decals: [{ img: "J2", on: "fus", s: 0.72, h: 0.62, ws: 0.24, tint: "#d7192d" }] },
};
// Ryanair harp, stylised: frame arc + strings, in fin coordinates (fs 0 trailing .. 1 leading, fh 0 root .. 1 tip). Drawn approximation, not the official artwork.
function harp(fs: number, fh: number) { const u = (fs - 0.42) / 0.36, v = (fh - 0.5) / 0.36; if (Math.abs(u) > 1 || Math.abs(v) > 1) return false;
  const top = v > 0.55 - 0.35 * u && v < 0.85 - 0.3 * u && u > -0.9; const pillar = u > -0.95 && u < -0.7 && v > -0.95 && v < 0.75; const str = u > -0.7 && v < 0.6 - 0.35 * u && v > -0.95 + 1.1 * (u + 0.7) && ((u + 0.7) * 6) % 1 < 0.45; return top || pillar || str; }
// Jet2holidays fin: blue with a sun low on the trailing side and red/orange rays fanning forward-up (simplified from G-HLYI photo)
function sun(fs: number, fh: number) { const dx = fs - 0.32, dy = fh - 0.3; const r = Math.hypot(dx * 1.2, dy), a = Math.atan2(dy, dx);
  if (r < 0.16) return "#ffb81c"; if (r < 0.58 && a > -0.6 && a < 2.4) { const ray = ((a + 0.6) / 3 * 9) % 1; if (ray < 0.5) return r < 0.36 ? "#f7941d" : "#e4002b"; } return "#1f5bb5"; }
// Only registrations seen in dated Commons photos are given a Jet2 sub-brand.
export const JET2_REG: Record<string, { b: "J2COM" | "J2HOL"; ref: string }> = {
  "G-GDFX": { b: "J2COM", ref: "Commons: Jet2.com_Boeing_737-800_(G-GDFX)_@_MAN,_June_2023.jpg" },
  "G-SUNS": { b: "J2COM", ref: "Commons: G-SUNS-Jet2-EGCC.jpg (2026-05-17)" },
  "G-HLYI": { b: "J2HOL", ref: "Commons: G-HLYI-Jet2holidays-EGCC.jpg (2026-05-17)" },
  "G-JZBP": { b: "J2HOL", ref: "Commons: G-JZBP-Jet2holidays-EGCC.jpg (2026-05-17)" },
};
