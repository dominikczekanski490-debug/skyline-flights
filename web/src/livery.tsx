import { useId } from "react";
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
  KL: { n: "KLM", f: "#00a1de", b: "#ffffff", t: "#00a1de", e: "#00a1de", a: "#ffffff", m: "plain", tx: "#ffffff" },
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
const ICAO: Record<string, string> = { BAW: "BA", SHT: "BA", CFE: "BA", EZY: "EZY", EJU: "EZY", EZS: "EZY", RYR: "FR", RUK: "FR", WZZ: "W6", WUK: "W6", VIR: "VS", DLH: "LH", AFR: "AF", KLM: "KL", IBE: "IB", VLG: "VY", TAP: "TP", SAS: "SK", FIN: "AY", SWR: "LX", AUA: "OS", BEL: "SN", EIN: "EI", EUK: "EI", UAE: "EK", QTR: "QR", ETD: "EY", THY: "TK", AAL: "AA", DAL: "DL", UAL: "UA", QFA: "QF", SIA: "SQ", NAX: "DY", NSZ: "DY", EXS: "LS", TOM: "BY", LOG: "LM", AUR: "GR", EZE: "T3", TRA: "HV", TVF: "HV", EWG: "EW", CFG: "DE", ICE: "FI", WIF: "WF", ACA: "AC", ETH: "ET", LOT: "LO", AEE: "A3", ITY: "AZ", AEA: "UX", VOE: "V7", BTI: "BT", AMC: "KM", LGL: "LG", EDW: "WK", PGT: "PC", SXS: "XQ", CPA: "CX", JAL: "JL", ANA: "NH", AIC: "AI", PIA: "PK", MSR: "MS", RAM: "AT", SVA: "SV" };
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
const SH: Record<Fam, { len: number; h: number; win: number; eng: number; tailH: number }> = {
  narrow: { len: 300, h: 30, win: 26, eng: 2, tailH: 52 }, rj: { len: 250, h: 26, win: 18, eng: 2, tailH: 46 }, prop: { len: 250, h: 27, win: 16, eng: 2, tailH: 48 },
  wide: { len: 340, h: 38, win: 36, eng: 2, tailH: 62 }, quad: { len: 350, h: 44, win: 40, eng: 4, tailH: 66 } };
export function Livery({ code, icao, name, type, reg, small }: { code?: string; icao?: string; name?: string; type?: string; reg?: string; small?: boolean }) {
  const id = useId().replace(/:/g, ""); const lv = liveryFor(code, icao); const fam = familyOf(type); const s = SH[fam];
  const v = lv || { n: "", f: "#eef0f3", b: "#c7ccd3", t: "#9aa3ad", e: "#b8bfc8", a: "#7c8691", m: "plain" as Motif, tx: "#7c8691" };
  const x0 = (400 - s.len) / 2, x1 = x0 + s.len, cy = 70, top = cy - s.h / 2, bot = cy + s.h / 2;
  const body = `M${x0 + 18},${top + 4} L${x1 - 40},${top} Q${x1 - 6},${top + 2} ${x1},${cy + 4} Q${x1 - 4},${bot} ${x1 - 34},${bot} L${x0 + 40},${bot} Q${x0 + 10},${bot - 2} ${x0},${top + 6} Z`;
  const tailX = x0 + 6, fin = `M${tailX},${top + 4} L${tailX + 10},${top - s.tailH} L${tailX + 34},${top - s.tailH} L${tailX + 64},${top + 2} Z`;
  const wing = `M${x0 + s.len * 0.38},${cy + 6} L${x0 + s.len * 0.52},${cy + 6} L${x0 + s.len * 0.40},${bot + 18} L${x0 + s.len * 0.33},${bot + 18} Z`;
  const engs = fam === "prop" ? [x0 + s.len * 0.42] : fam === "rj" && /CRJ|E145|E135|ERJ|F70|F100/.test((type || "").toUpperCase()) ? [] : Array.from({ length: s.eng / 2 }, (_, i) => x0 + s.len * (0.40 - i * 0.12));
  const rear = fam === "rj" && engs.length === 0; const wins = Array.from({ length: s.win }, (_, i) => x0 + 50 + i * ((s.len - 100) / s.win));
  const label = lv ? lv.n : name ? `${name}` : "";
  const fx = tailX + 32, fy = top - s.tailH * 0.42;
  const motif = () => { switch (v.m) {
    case "circle": return <circle cx={fx} cy={fy} r={s.tailH * 0.22} fill="none" stroke={v.a} strokeWidth={3} />;
    case "disc": return <circle cx={fx} cy={fy} r={s.tailH * 0.2} fill={v.a} />;
    case "chevron": return <path d={`M${fx - 12},${fy + 12} L${fx},${fy - 6} L${fx + 12},${fy + 12}`} fill="none" stroke={v.a} strokeWidth={4} />;
    case "split": return <path d={`M${tailX + 10},${top - s.tailH} L${tailX + 34},${top - s.tailH} L${tailX + 64},${top + 2} L${tailX + 40},${top + 2} Z`} fill={v.a} opacity={0.9} />;
    case "stripes": return <>{[0, 1, 2].map(i => <path key={i} d={`M${tailX + 8 + i * 9},${top + 2} L${tailX + 20 + i * 9},${top - s.tailH + 6}`} stroke={i === 1 && v.ch ? v.ch : v.a} strokeWidth={4} />)}</>;
    case "flag": return <><path d={`M${tailX + 14},${fy + 8} Q${fx},${fy - 12} ${tailX + 48},${fy}`} stroke={v.a} strokeWidth={5} fill="none" />{v.ch && <path d={`M${tailX + 16},${fy + 14} Q${fx},${fy - 4} ${tailX + 50},${fy + 6}`} stroke={v.ch} strokeWidth={3} fill="none" />}</>;
    case "band": return <rect x={tailX + 12} y={fy - 4} width={36} height={8} fill={v.a} transform={`skewX(-20)`} style={{ transformBox: "fill-box", transformOrigin: "center" }} />;
    default: return null; } };
  return <div className={"livery" + (small ? " sm" : "")}>
    <svg viewBox="0 0 400 130" role="img" aria-label={`${label || "Aircraft"} illustrative livery`}>
      <defs><linearGradient id={"lvsh" + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".18" /></linearGradient>
        <clipPath id={"lvbody" + id}><path d={body} /></clipPath></defs>
      <ellipse cx="200" cy="122" rx={s.len / 2} ry="4" fill="#000" opacity=".35" />
      <path d={fin} fill={v.t} stroke="rgba(0,0,0,.25)" />
      <clipPath id={"lvfin" + id}><path d={fin} /></clipPath><g clipPath={`url(#lvfin${id})`}>{motif()}</g>
      <path d={`M${x0 + 4},${top + 10} L${x0 - 6},${top + 2} L${x0 + 26},${top + 4} L${x0 + 38},${top + 10} Z`} fill={v.t} opacity=".9" />
      <path d={body} fill={v.f} stroke="rgba(0,0,0,.3)" />
      {v.b && <rect x={x0} y={cy + s.h * 0.2} width={s.len} height={s.h} fill={v.b} clipPath={`url(#lvbody${id})`} />}
      <rect x={x0} y={top} width={s.len} height={s.h} fill={`url(#lvsh${id})`} clipPath={`url(#lvbody${id})`} />
      {wins.map((x, i) => <rect key={i} x={x} y={cy - s.h * 0.3} width={3.2} height={4} rx={1.2} fill="#24303d" opacity=".75" />)}
      <path d={`M${x1 - 26},${cy - s.h * 0.22} L${x1 - 12},${cy - s.h * 0.2} L${x1 - 9},${cy - s.h * 0.06} L${x1 - 24},${cy - s.h * 0.06} Z`} fill="#1c2733" />
      <rect x={x0 + 70} y={cy - 4} width={8} height={s.h * 0.45} rx={1} fill="none" stroke="rgba(0,0,0,.25)" />
      {label && <text x={x0 + s.len * (fam === "prop" ? 0.7 : 0.58)} y={cy + s.h * 0.1} textAnchor="middle" fontSize={fam === "rj" || fam === "prop" ? 9 : fam === "narrow" ? 10.5 : 12.5} fontWeight={700} fill={v.tx || "#333"} fontFamily="system-ui, -apple-system, sans-serif">{label}</text>}
      {reg && <text x={x0 + 46} y={cy + s.h * 0.1} fontSize={7} fill="#333" fontFamily="system-ui, sans-serif">{reg}</text>}
      <path d={wing} fill="#8b939c" stroke="rgba(0,0,0,.3)" />
      {engs.map((x, i) => fam === "prop" ? <g key={i}><rect x={x - 6} y={cy - 6} width={36} height={12} rx={6} fill={v.e} stroke="rgba(0,0,0,.3)" /><ellipse cx={x + 32} cy={cy} rx={2.5} ry={16} fill="#555" opacity=".6" /></g>
        : <g key={i}><rect x={x - 4} y={bot + (i ? 6 : 2)} width={fam === "quad" || fam === "wide" ? 40 : 32} height={fam === "quad" || fam === "wide" ? 15 : 12} rx={6} fill={v.e} stroke="rgba(0,0,0,.35)" /><rect x={x + (fam === "quad" || fam === "wide" ? 32 : 25)} y={bot + (i ? 7 : 3)} width={4} height={fam === "quad" || fam === "wide" ? 13 : 10} fill="#2a2f35" /></g>)}
      {rear && <rect x={x0 + 34} y={top - 4} width={30} height={11} rx={5} fill={v.e} stroke="rgba(0,0,0,.35)" />}
      <rect x={x0 + s.len * 0.42} y={bot} width={3} height={14} fill="#555" /><circle cx={x0 + s.len * 0.42 + 1.5} cy={bot + 16} r={4} fill="#222" />
      <rect x={x1 - 40} y={bot} width={2.5} height={12} fill="#555" /><circle cx={x1 - 39} cy={bot + 14} r={3.2} fill="#222" />
    </svg>
    <div className="lvcap"><span>{lv ? lv.n : name || "Unknown airline"}{type ? ` · ${type}` : ""}{reg ? ` · ${reg}` : ""}</span><span className="faint">{lv ? "Illustrative livery" : "Livery not on file · neutral scheme"}</span></div>
  </div>;
}
export const LIVERY_COUNT = Object.keys(L).length;
