import { useEffect, useState } from "react";
// Illustrative 2D side-view aircraft drawn in an airline's livery colours. Original drawings, not photos.
// Livery entries are a simplified colour scheme (fuselage, belly, tail, engine, accent, motif), not exact artwork.
type Motif = "band" | "circle" | "chevron" | "split" | "stripes" | "disc" | "flag" | "plain";
type Liv = { n: string; f: string; b?: string; t: string; e: string; a?: string; m: Motif; tx?: string; ch?: string };
const L: Record<string, Liv> = {
  BA: { n: "British Airways", f: "#f4f5f7", b: "#1b2a5c", t: "#1b2a5c", e: "#1b2a5c", a: "#d22630", m: "flag", tx: "#1b2a5c" },
  EZY: { n: "easyJet", f: "#ffffff", t: "#ff6600", e: "#ff6600", a: "#ff6600", m: "plain", tx: "#ff6600" }, U2: { n: "easyJet", f: "#ffffff", t: "#ff6600", e: "#ff6600", a: "#ff6600", m: "plain", tx: "#ff6600" },
  FR: { n: "Ryanair", f: "#ffffff", b: "#073590", t: "#073590", e: "#073590", a: "#f1c933", m: "disc", tx: "#073590" }, RYR: { n: "Ryanair", f: "#ffffff", b: "#073590", t: "#073590", e: "#073590", a: "#f1c933", m: "disc", tx: "#073590" },
  W6: { n: "Wizz Air", f: "#ffffff", t: "#c6007e", e: "#2c2a6b", a: "#2c2a6b", m: "split", tx: "#c6007e" },
  VS: { n: "Virgin Atlantic", f: "#ffffff", t: "#da0530", e: "#5b2a86", a: "#5b2a86", m: "stripes", tx: "#da0530" },
  LH: { n: "Lufthansa", f: "#ffffff", b: "#ffffff", t: "#05164d", e: "#05164d", a: "#ffffff", m: "circle", tx: "#05164d" },
  AF: { n: "Air France", f: "#ffffff", t: "#ffffff", e: "#ffffff", a: "#002157", m: "stripes", tx: "#002157", ch: "#ed2939" },
  KL: { n: "KLM", f: "#ffffff", b: "#00a1de", t: "#00a1de", e: "#00a1de", a: "#00a1de", m: "plain", tx: "#00a1de" },
  IB: { n: "Iberia", f: "#ffffff", t: "#d7192d", e: "#d7192d", a: "#fdc82f", m: "split", tx: "#d7192d" },
  VY: { n: "Vueling", f: "#ffffff", t: "#ffcc00", e: "#4d4d4d", a: "#4d4d4d", m: "plain", tx: "#4d4d4d" },
  TP: { n: "TAP Air Portugal", f: "#ffffff", t: "#00b259", e: "#e10b17", a: "#e10b17", m: "split", tx: "#00b259" },
  SK: { n: "SAS", f: "#ffffff", t: "#000a8c", e: "#000a8c", a: "#000a8c", m: "plain", tx: "#000a8c" },
  AY: { n: "Finnair", f: "#ffffff", t: "#ffffff", e: "#0b1560", a: "#0b1560", m: "plain", tx: "#0b1560" },
  LX: { n: "Swiss", f: "#ffffff", t: "#e2001a", e: "#e2001a", a: "#ffffff", m: "flag", tx: "#1d1d1b" },
  OS: { n: "Austrian", f: "#ffffff", b: "#ffffff", t: "#e3001b", e: "#e3001b", a: "#ffffff", m: "band", tx: "#e3001b" },
  SN: { n: "Brussels Airlines", f: "#ffffff", t: "#002157", e: "#002157", a: "#e20031", m: "disc", tx: "#002157" },
  EI: { n: "Aer Lingus", f: "#ffffff", b: "#006272", t: "#006272", e: "#006272", a: "#8bc9a3", m: "flag", tx: "#006272" },
  EK: { n: "Emirates", f: "#ffffff", t: "#ffffff", e: "#d71921", a: "#d71921", m: "flag", tx: "#9a7b4f", ch: "#00843d" },
  QR: { n: "Qatar Airways", f: "#ffffff", t: "#5c0632", e: "#5c0632", a: "#5c0632", m: "plain", tx: "#5c0632" },
  EY: { n: "Etihad", f: "#f1ece1", t: "#bd8b13", e: "#4a4a4a", a: "#bd8b13", m: "chevron", tx: "#4a4a4a" },
  TK: { n: "Turkish Airlines", f: "#ffffff", t: "#c70a0c", e: "#c70a0c", a: "#ffffff", m: "circle", tx: "#c70a0c" },
  AA: { n: "American", f: "#c9ccd1", t: "#0078d2", e: "#9da6ab", a: "#c30019", m: "stripes", tx: "#36495a" },
  DL: { n: "Delta", f: "#ffffff", b: "#003268", t: "#003268", e: "#003268", a: "#c01933", m: "chevron", tx: "#003268" },
  UA: { n: "United", f: "#ffffff", b: "#0c2340", t: "#0c2340", e: "#0c2340", a: "#0033a0", m: "disc", tx: "#0c2340" },
  QF: { n: "Qantas", f: "#ffffff", t: "#e40000", e: "#e40000", a: "#ffffff", m: "split", tx: "#e40000" },
  SQ: { n: "Singapore Airlines", f: "#ffffff", t: "#00266b", e: "#00266b", a: "#f99f1c", m: "band", tx: "#00266b" },
  CX: { n: "Cathay Pacific", f: "#ffffff", t: "#005d63", e: "#005d63", a: "#ffffff", m: "chevron", tx: "#005d63" },
  JL: { n: "Japan Airlines", f: "#ffffff", t: "#ffffff", e: "#c8102e", a: "#c8102e", m: "circle", tx: "#1d1d1b" },
  NH: { n: "ANA", f: "#ffffff", b: "#1a3f8e", t: "#1a3f8e", e: "#1a3f8e", a: "#14a0dc", m: "split", tx: "#1a3f8e" },
  AC: { n: "Air Canada", f: "#ffffff", b: "#1d1d1b", t: "#1d1d1b", e: "#1d1d1b", a: "#d22630", m: "disc", tx: "#1d1d1b" },
  ET: { n: "Ethiopian", f: "#ffffff", t: "#078930", e: "#078930", a: "#fcdd09", m: "stripes", tx: "#078930", ch: "#da121a" },
  SV: { n: "Saudia", f: "#e9e2d4", b: "#1b4f8a", t: "#1b4f8a", e: "#1b4f8a", a: "#d4b062", m: "band", tx: "#1b4f8a" },
  AI: { n: "Air India", f: "#ffffff", t: "#7a0d34", e: "#7a0d34", a: "#d6a243", m: "split", tx: "#7a0d34" },
  PK: { n: "PIA", f: "#ffffff", t: "#006c35", e: "#006c35", a: "#d6a243", m: "band", tx: "#006c35" },
  MS: { n: "EgyptAir", f: "#ffffff", t: "#0b2d65", e: "#0b2d65", a: "#c7a24b", m: "circle", tx: "#0b2d65" },
  AT: { n: "Royal Air Maroc", f: "#ffffff", t: "#c1272d", e: "#c1272d", a: "#006233", m: "disc", tx: "#c1272d" },
  LO: { n: "LOT", f: "#ffffff", t: "#11397e", e: "#11397e", a: "#ffffff", m: "plain", tx: "#11397e" },
  A3: { n: "Aegean", f: "#ffffff", t: "#0e3d79", e: "#0e3d79", a: "#d4b062", m: "circle", tx: "#0e3d79" },
  AZ: { n: "ITA Airways", f: "#ffffff", t: "#0c2e83", e: "#0c2e83", a: "#9fb4c7", m: "plain", tx: "#0c2e83" },
  DY: { n: "Norwegian", f: "#ffffff", b: "#d81939", t: "#d81939", e: "#d81939", a: "#ffffff", m: "circle", tx: "#d81939" }, D8: { n: "Norwegian", f: "#ffffff", b: "#d81939", t: "#d81939", e: "#d81939", a: "#ffffff", m: "circle", tx: "#d81939" },
  WF: { n: "Wideroe", f: "#ffffff", t: "#00a650", e: "#00a650", a: "#00a650", m: "plain", tx: "#00a650" },
  LS: { n: "Jet2", f: "#ffffff", b: "#d50032", t: "#d50032", e: "#d50032", a: "#ffffff", m: "plain", tx: "#d50032" },
  BY: { n: "TUI", f: "#ffffff", t: "#70cbf4", e: "#092a5e", a: "#d40e14", m: "circle", tx: "#092a5e" }, TOM: { n: "TUI", f: "#ffffff", t: "#70cbf4", e: "#092a5e", a: "#d40e14", m: "circle", tx: "#092a5e" }, X3: { n: "TUI", f: "#ffffff", t: "#70cbf4", e: "#092a5e", a: "#d40e14", m: "circle", tx: "#092a5e" },
  LM: { n: "Loganair", f: "#ffffff", t: "#1f2a56", e: "#1f2a56", a: "#c8102e", m: "stripes", tx: "#1f2a56" },
  BE: { n: "Flybe", f: "#ffffff", t: "#3c1053", e: "#3c1053", a: "#e6007e", m: "plain", tx: "#3c1053" },
  GR: { n: "Aurigny", f: "#ffffff", t: "#002f6c", e: "#002f6c", a: "#f2c200", m: "band", tx: "#002f6c" },
  T3: { n: "Eastern Airways", f: "#ffffff", t: "#3f1f69", e: "#3f1f69", a: "#b19bd1", m: "plain", tx: "#3f1f69" },
  HV: { n: "Transavia", f: "#ffffff", t: "#00d66c", e: "#00d66c", a: "#0d2c4f", m: "split", tx: "#0d2c4f" }, TO: { n: "Transavia", f: "#ffffff", t: "#00d66c", e: "#00d66c", a: "#0d2c4f", m: "split", tx: "#0d2c4f" },
  EW: { n: "Eurowings", f: "#ffffff", t: "#a5004f", e: "#a5004f", a: "#a5004f", m: "split", tx: "#a5004f" },
  DE: { n: "Condor", f: "#ffffff", t: "#fdc82f", e: "#fdc82f", a: "#fdc82f", m: "stripes", tx: "#1d1d1b" },
  "4U": { n: "Eurowings", f: "#ffffff", t: "#a5004f", e: "#a5004f", a: "#a5004f", m: "split", tx: "#a5004f" },
  UX: { n: "Air Europa", f: "#ffffff", t: "#0b2265", e: "#0b2265", a: "#0b2265", m: "plain", tx: "#0b2265" },
  V7: { n: "Volotea", f: "#ffffff", t: "#e4007c", e: "#1d1d1b", a: "#e4007c", m: "plain", tx: "#1d1d1b" },
  BT: { n: "airBaltic", f: "#ffffff", t: "#cddc29", e: "#cddc29", a: "#cddc29", m: "plain", tx: "#1d1d1b" },
  FI: { n: "Icelandair", f: "#ffffff", b: "#003a7d", t: "#003a7d", e: "#003a7d", a: "#f6b221", m: "band", tx: "#003a7d" },
  OG: { n: "PLAY", f: "#ee3b43", t: "#ee3b43", e: "#ee3b43", a: "#ffffff", m: "plain", tx: "#ffffff" },
  KM: { n: "KM Malta Airlines", f: "#ffffff", t: "#cf142b", e: "#cf142b", a: "#cf142b", m: "split", tx: "#cf142b" },
  LG: { n: "Luxair", f: "#ffffff", t: "#00a4e4", e: "#00a4e4", a: "#00a4e4", m: "chevron", tx: "#00a4e4" },
  WK: { n: "Edelweiss", f: "#ffffff", t: "#e2001a", e: "#e2001a", a: "#ffffff", m: "circle", tx: "#1d1d1b" },
  PC: { n: "Pegasus", f: "#ffffff", t: "#fdb913", e: "#fdb913", a: "#e30613", m: "plain", tx: "#1d1d1b" },
  XQ: { n: "SunExpress", f: "#ffffff", t: "#003c71", e: "#fcbf26", a: "#fcbf26", m: "disc", tx: "#003c71" },
  "6E": { n: "IndiGo", f: "#ffffff", t: "#001b94", e: "#001b94", a: "#001b94", m: "plain", tx: "#001b94" },
  B6: { n: "JetBlue", f: "#ffffff", b: "#003876", t: "#003876", e: "#003876", a: "#0033a0", m: "stripes", tx: "#003876" },
  WN: { n: "Southwest", f: "#304cb2", b: "#c4c8cf", t: "#304cb2", e: "#304cb2", a: "#e51d23", m: "split", tx: "#ffffff" },
  AS: { n: "Alaska", f: "#ffffff", t: "#01426a", e: "#01426a", a: "#64ccc9", m: "plain", tx: "#01426a" },
  CA: { n: "Air China", f: "#ffffff", t: "#ffffff", e: "#e60012", a: "#e60012", m: "circle", tx: "#1d1d1b" },
  MU: { n: "China Eastern", f: "#ffffff", t: "#c4171d", e: "#1a2e6a", a: "#1a2e6a", m: "circle", tx: "#1a2e6a" },
  CZ: { n: "China Southern", f: "#ffffff", t: "#0b6cb0", e: "#0b6cb0", a: "#e2231a", m: "plain", tx: "#0b6cb0" },
  KE: { n: "Korean Air", f: "#a9d6ef", b: "#ffffff", t: "#ffffff", e: "#a9d6ef", a: "#00256c", m: "circle", tx: "#00256c" },
  OZ: { n: "Asiana", f: "#ffffff", t: "#7b7d80", e: "#7b7d80", a: "#c8102e", m: "stripes", tx: "#7b7d80" },
  MH: { n: "Malaysia Airlines", f: "#ffffff", t: "#003d79", e: "#003d79", a: "#d71920", m: "split", tx: "#003d79" },
  TG: { n: "Thai", f: "#ffffff", t: "#5a2d82", e: "#5a2d82", a: "#d6a243", m: "circle", tx: "#5a2d82" },
  GF: { n: "Gulf Air", f: "#ffffff", t: "#c9a24f", e: "#c9a24f", a: "#c8102e", m: "plain", tx: "#c9a24f" },
  WY: { n: "Oman Air", f: "#ffffff", t: "#7a5c35", e: "#00818f", a: "#00818f", m: "plain", tx: "#7a5c35" },
  KU: { n: "Kuwait Airways", f: "#ffffff", t: "#004b87", e: "#004b87", a: "#004b87", m: "plain", tx: "#004b87" },
  RJ: { n: "Royal Jordanian", f: "#2b2b2b", b: "#c9a24f", t: "#2b2b2b", e: "#2b2b2b", a: "#c9a24f", m: "plain", tx: "#c9a24f" },
  LY: { n: "El Al", f: "#ffffff", t: "#0b3b8c", e: "#0b3b8c", a: "#0b3b8c", m: "stripes", tx: "#0b3b8c" },
  SA: { n: "South African", f: "#ffffff", t: "#007749", e: "#007749", a: "#ffb81c", m: "split", tx: "#007749", ch: "#e03c31" },
  KQ: { n: "Kenya Airways", f: "#ffffff", t: "#cc0000", e: "#cc0000", a: "#1d1d1b", m: "split", tx: "#cc0000" },
  NZ: { n: "Air New Zealand", f: "#ffffff", t: "#1d1d1b", e: "#1d1d1b", a: "#ffffff", m: "circle", tx: "#1d1d1b" },
  LA: { n: "LATAM", f: "#ffffff", b: "#1b0088", t: "#1b0088", e: "#1b0088", a: "#e8114b", m: "split", tx: "#1b0088" },
  AM: { n: "Aeromexico", f: "#ffffff", t: "#0b2343", e: "#0b2343", a: "#ffffff", m: "plain", tx: "#0b2343" },
  CM: { n: "Copa", f: "#ffffff", t: "#003a8f", e: "#003a8f", a: "#c9a24f", m: "plain", tx: "#003a8f" },
  WS: { n: "WestJet", f: "#ffffff", t: "#00a6c8", e: "#00a6c8", a: "#00a6c8", m: "split", tx: "#00a6c8" },
  BW: { n: "Caribbean Airlines", f: "#ffffff", t: "#00857c", e: "#00857c", a: "#e2231a", m: "plain", tx: "#00857c" },
  FZ: { n: "flydubai", f: "#ffffff", t: "#e84f1c", e: "#004b87", a: "#004b87", m: "split", tx: "#004b87" },
  G9: { n: "Air Arabia", f: "#ffffff", t: "#e2231a", e: "#7d7d7d", a: "#e2231a", m: "stripes", tx: "#7d7d7d" },
};
const ICAO: Record<string, string> = { W4: "W6", W9: "W6", "5W": "W6", WMT: "W6", WAZ: "W6", BAW: "BA", SHT: "BA", CFE: "BA", EZY: "EZY", EJU: "EZY", EZS: "EZY", RYR: "FR", RUK: "FR", WZZ: "W6", WUK: "W6", VIR: "VS", DLH: "LH", AFR: "AF", KLM: "KL", IBE: "IB", VLG: "VY", TAP: "TP", SAS: "SK", FIN: "AY", SWR: "LX", AUA: "OS", BEL: "SN", EIN: "EI", EUK: "EI", UAE: "EK", QTR: "QR", ETD: "EY", THY: "TK", AAL: "AA", DAL: "DL", UAL: "UA", QFA: "QF", SIA: "SQ", NAX: "DY", NSZ: "DY", EXS: "LS", TOM: "BY", LOG: "LM", AUR: "GR", EZE: "T3", TRA: "HV", TVF: "HV", EWG: "EW", CFG: "DE", ICE: "FI", WIF: "WF", ACA: "AC", ETH: "ET", LOT: "LO", AEE: "A3", ITY: "AZ", AEA: "UX", VOE: "V7", BTI: "BT", AMC: "KM", LGL: "LG", EDW: "WK", PGT: "PC", SXS: "XQ", CPA: "CX", JAL: "JL", ANA: "NH", AIC: "AI", PIA: "PK", MSR: "MS", RAM: "AT", SVA: "SV" };
export function liveryFor(code?: string, icao?: string): Liv | null { const c = (code || "").toUpperCase(); return L[c] || L[ICAO[(icao || "").toUpperCase()] || ""] || L[ICAO[c] || ""] || null; }
export type Fam = "narrow" | "wide" | "quad" | "prop" | "rj";
export function familyOf(type?: string): Fam {
  const t = (type || "").toUpperCase().replace(/\s/g, "");
  if (/A38|388|380|B74|747|A34|340/.test(t)) return "quad";
  if (/AT[47]|ATR|DH8|DASH8|Q400|Q300|SF34|SAAB340|JS41|D328|DO328|F50|BN2|DHC6|TWIN|L410/.test(t)) return "prop";
  if (/E1[79]|E75|E90|E95|E2|EMB|ERJ|E145|E135|CRJ|CR[279K]|RJ[0-9]|BAE146|AVRO|F70|F100|FOKKER|A22|BCS|CS[13]00|SSJ|SU95/.test(t)) return "rj";
  if (/A33|330|A35|350|A30[0-9]|A310|B76|767|B77|777|B78|787|B72|MD11|DC10/.test(t)) return "wide";
  return "narrow";
}
// v13: realistic side-view base images (AI-generated originals, see PLANE_CREDITS) with livery colour overlays.
type Ast = { k: string; name: string };
const T: [RegExp, Ast][] = [
  [/A21N|A321NEO/, { k: "a321", name: "Airbus A321neo" }], [/A321|A21/, { k: "a321", name: "Airbus A321" }],
  [/A20N|A320NEO/, { k: "a320", name: "Airbus A320neo" }], [/A19N|A319NEO/, { k: "a320", name: "Airbus A319neo" }], [/A320|A32[0-9]/, { k: "a320", name: "Airbus A320" }], [/A319|A318|A31[89]/, { k: "a320", name: "Airbus A319" }],
  [/B38M|B39M|B37M|737MAX|MAX8|MAX9|7M8/, { k: "b38m", name: "Boeing 737 MAX 8" }], [/B738|737-800|7378|73H/, { k: "b738", name: "Boeing 737-800" }], [/B739|737-900/, { k: "b738", name: "Boeing 737-900" }], [/B737|B73|737/, { k: "b738", name: "Boeing 737-700" }],
  [/B78X|787-10/, { k: "b789", name: "Boeing 787-10" }], [/B788|787-8/, { k: "b789", name: "Boeing 787-8" }], [/B789|B78|787/, { k: "b789", name: "Boeing 787-9" }],
  [/B77W|777-300|B773|77W/, { k: "b77w", name: "Boeing 777-300ER" }], [/B772|B77L|777-200|B77|777/, { k: "b77w", name: "Boeing 777-200" }],
  [/A388|A380|388/, { k: "a388", name: "Airbus A380" }], [/A35K|A350-1000/, { k: "a359", name: "Airbus A350-1000" }], [/A359|A35|350/, { k: "a359", name: "Airbus A350-900" }],
  [/B744|B748|B74|747/, { k: "b744", name: "Boeing 747" }], [/A33|330/, { k: "a333", name: "Airbus A330" }], [/A34|340/, { k: "a346", name: "Airbus A340" }],
  [/B75|757/, { k: "b752", name: "Boeing 757" }], [/B76|767/, { k: "b763", name: "Boeing 767" }],
  [/AT7|ATR72|ATR 72/, { k: "at76", name: "ATR 72" }], [/AT4|ATR42/, { k: "at76", name: "ATR 42" }], [/DH8|DASH8|Q400|Q300|DHC8/, { k: "dh8d", name: "De Havilland Dash 8-400" }],
  [/CRJ|CR[279K]/, { k: "crj9", name: "Bombardier CRJ900" }], [/BCS|A22|CS[13]00|A220/, { k: "bcs3", name: "Airbus A220" }],
  [/E19|E29|E195|E190|E2/, { k: "e190", name: "Embraer E190/E195" }], [/E17|E75|E170|E175|EMB|ERJ|E1/, { k: "e190", name: "Embraer E170/E175" }],
];
const WIDE = new Set(["EK", "QR", "EY", "SQ", "CX", "QF", "JL", "NH", "VS"]);
export function assetFor(type?: string, code?: string): Ast & { known: boolean } {
  const t = (type || "").toUpperCase().replace(/\s+/g, "");
  for (const [r, a] of T) if (r.test(t)) return { ...a, known: true };
  // Unknown type: airline's typical aircraft, flagged as not reported.
  const c = (code || "").toUpperCase(); const k = WIDE.has(c) ? "b77w" : ["FR", "RYR"].includes(c) ? "b738" : "a320";
  return { k, name: "", known: false };
}
export const PLANE_CREDITS = "Aircraft photos: Planespotters.net photo API (each photo © its photographer, linked to the original) and Wikimedia Commons (freely licensed; author and licence shown on each photo). No drawn or recoloured liveries.";
type Photo = { kind: "exact" | "same-type" | "typical" | "type" | "none"; typeName?: string; src?: string; link?: string; author?: string; license?: string; licenseUrl?: string; source?: string; reg?: string };
const PC = new Map<string, Promise<Photo>>();
const getPhoto = (q: string) => { if (!PC.has(q)) PC.set(q, fetch("/api/photo?" + q).then(r => r.ok ? r.json() : { kind: "none" }).catch(() => { PC.delete(q); return { kind: "none" } as Photo; })); return PC.get(q)!; };
export function Livery({ code, icao, name, type, reg, hex, small }: { code?: string; icao?: string; name?: string; type?: string; reg?: string; hex?: string; small?: boolean }) {
  const lv = liveryFor(code, icao); const a = assetFor(type, code); const aln = name || lv?.n || "";
  const t = (type || "").toUpperCase().trim(); const tc = /^[A-Z][A-Z0-9]{2,3}$/.test(t) ? t : "";
  const alI = (icao || "").toUpperCase();
  const q = new URLSearchParams({ reg: (reg || "").toUpperCase(), hex: hex || "", al: alI, aln, type: tc, tn: a.known ? a.name : "" }).toString();
  const [p, setP] = useState<Photo | null>(null);
  useEffect(() => { let on = true; setP(null); if (!reg && !hex && !aln && !alI && !tc) { setP({ kind: "none" }); return; } getPhoto(q).then(r => on && setP(r)); return () => { on = false; }; }, [q]);
  const tname = a.known ? a.name : (type || "Aircraft not assigned yet");
  return <div className={"pl-card" + (small ? " sm" : "")}>
    <div className="pl-sky">{!p ? <div className="pl-ph pl-wait" /> : p.kind === "none" || !p.src ? <div className="pl-ph pl-none">No photo available</div>
      : <a href={p.link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}><img className="pl-ph" src={p.src} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt={`${aln} ${tname}`} /></a>}</div>
    <div className="pl-cap"><b>{tname}</b>
      <div className="faint sm">{[reg, aln].filter(Boolean).join(" · ")}</div>
      {p && p.kind !== "none" && p.src && <div className="faint xs mt4">{p.kind === "exact" ? `Photo of this aircraft (${p.reg || reg || hex})` : p.kind === "typical" ? `Typical ${aln} aircraft (${p.typeName}${p.reg ? ", shows " + p.reg : ""}), type not yet assigned` : p.kind === "type" ? `Illustrative ${p.typeName}, other livery (not this aircraft)` : `Photo of ${/^[aeiou]/i.test(aln) ? "an" : "a"} ${aln} ${tname} (not necessarily this exact aircraft${p.reg ? ", shows " + p.reg : ""})`}
        <br /><a href={p.link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>{p.source === "Planespotters.net" ? `Photo: ${p.author} / Planespotters.net` : <>Photo: {p.author} / Wikimedia Commons, {p.license}</>}</a></div>}
    </div></div>;
}
export const LIVERY_COUNT = Object.keys(L).length;
