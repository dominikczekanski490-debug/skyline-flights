/** Eurovision studio: styles, ISO countries, default cards/boards, and helpers. */
import { flag } from "./countries";

export type EvStyle = "asia" | "esc" | "jesc";
export type EvRound = "sf1" | "sf2" | "gf";
export type EvCard = { style: EvStyle; country: string; cc: string; song: string; artist: string; lyrics: string };
export type EvRow = { id: string; cc: string; name: string; points: number };
export type EvBoard = { style: EvStyle; round: EvRound; rows: EvRow[] };
export type EvStore = { cards: Record<EvStyle, EvCard>; boards: Record<EvStyle, EvBoard> };

export const EV_STYLES: EvStyle[] = ["asia", "esc", "jesc"];
export const EV_STYLE_LABEL: Record<EvStyle, string> = {
  asia: "Eurovision Asia",
  esc: "Eurovision 2026",
  jesc: "Junior Eurovision 2026",
};
export const EV_ROUNDS: EvRound[] = ["sf1", "sf2", "gf"];
export const EV_ROUND_LABEL: Record<EvRound, string> = {
  sf1: "Semi-final 1",
  sf2: "Semi-final 2",
  gf: "Grand Final",
};
export const EV_REVEAL_VALUES = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export const EV_KEY = "sk.games.euro.v2";
export const EV_QUALIFY = 10;

/** ISO 3166-1 alpha-2 list with short English names, plus Kosovo (XK) used at Eurovision. */
export const ISO_COUNTRIES: { cc: string; name: string }[] = [
  { cc: "AF", name: "Afghanistan" }, { cc: "AL", name: "Albania" }, { cc: "DZ", name: "Algeria" },
  { cc: "AD", name: "Andorra" }, { cc: "AO", name: "Angola" }, { cc: "AG", name: "Antigua and Barbuda" },
  { cc: "AR", name: "Argentina" }, { cc: "AM", name: "Armenia" }, { cc: "AU", name: "Australia" },
  { cc: "AT", name: "Austria" }, { cc: "AZ", name: "Azerbaijan" }, { cc: "BS", name: "Bahamas" },
  { cc: "BH", name: "Bahrain" }, { cc: "BD", name: "Bangladesh" }, { cc: "BB", name: "Barbados" },
  { cc: "BY", name: "Belarus" }, { cc: "BE", name: "Belgium" }, { cc: "BZ", name: "Belize" },
  { cc: "BJ", name: "Benin" }, { cc: "BT", name: "Bhutan" }, { cc: "BO", name: "Bolivia" },
  { cc: "BA", name: "Bosnia and Herzegovina" }, { cc: "BW", name: "Botswana" }, { cc: "BR", name: "Brazil" },
  { cc: "BN", name: "Brunei" }, { cc: "BG", name: "Bulgaria" }, { cc: "BF", name: "Burkina Faso" },
  { cc: "BI", name: "Burundi" }, { cc: "CV", name: "Cabo Verde" }, { cc: "KH", name: "Cambodia" },
  { cc: "CM", name: "Cameroon" }, { cc: "CA", name: "Canada" }, { cc: "CF", name: "Central African Republic" },
  { cc: "TD", name: "Chad" }, { cc: "CL", name: "Chile" }, { cc: "CN", name: "China" },
  { cc: "CO", name: "Colombia" }, { cc: "KM", name: "Comoros" }, { cc: "CG", name: "Congo" },
  { cc: "CD", name: "DR Congo" }, { cc: "CR", name: "Costa Rica" }, { cc: "CI", name: "Côte d'Ivoire" },
  { cc: "HR", name: "Croatia" }, { cc: "CU", name: "Cuba" }, { cc: "CY", name: "Cyprus" },
  { cc: "CZ", name: "Czechia" }, { cc: "DK", name: "Denmark" }, { cc: "DJ", name: "Djibouti" },
  { cc: "DM", name: "Dominica" }, { cc: "DO", name: "Dominican Republic" }, { cc: "EC", name: "Ecuador" },
  { cc: "EG", name: "Egypt" }, { cc: "SV", name: "El Salvador" }, { cc: "GQ", name: "Equatorial Guinea" },
  { cc: "ER", name: "Eritrea" }, { cc: "EE", name: "Estonia" }, { cc: "SZ", name: "Eswatini" },
  { cc: "ET", name: "Ethiopia" }, { cc: "FJ", name: "Fiji" }, { cc: "FI", name: "Finland" },
  { cc: "FR", name: "France" }, { cc: "GA", name: "Gabon" }, { cc: "GM", name: "Gambia" },
  { cc: "GE", name: "Georgia" }, { cc: "DE", name: "Germany" }, { cc: "GH", name: "Ghana" },
  { cc: "GR", name: "Greece" }, { cc: "GD", name: "Grenada" }, { cc: "GT", name: "Guatemala" },
  { cc: "GN", name: "Guinea" }, { cc: "GW", name: "Guinea-Bissau" }, { cc: "GY", name: "Guyana" },
  { cc: "HT", name: "Haiti" }, { cc: "HN", name: "Honduras" }, { cc: "HU", name: "Hungary" },
  { cc: "IS", name: "Iceland" }, { cc: "IN", name: "India" }, { cc: "ID", name: "Indonesia" },
  { cc: "IR", name: "Iran" }, { cc: "IQ", name: "Iraq" }, { cc: "IE", name: "Ireland" },
  { cc: "IL", name: "Israel" }, { cc: "IT", name: "Italy" }, { cc: "JM", name: "Jamaica" },
  { cc: "JP", name: "Japan" }, { cc: "JO", name: "Jordan" }, { cc: "KZ", name: "Kazakhstan" },
  { cc: "KE", name: "Kenya" }, { cc: "KI", name: "Kiribati" }, { cc: "KP", name: "North Korea" },
  { cc: "KR", name: "South Korea" }, { cc: "XK", name: "Kosovo" }, { cc: "KW", name: "Kuwait" },
  { cc: "KG", name: "Kyrgyzstan" }, { cc: "LA", name: "Laos" }, { cc: "LV", name: "Latvia" },
  { cc: "LB", name: "Lebanon" }, { cc: "LS", name: "Lesotho" }, { cc: "LR", name: "Liberia" },
  { cc: "LY", name: "Libya" }, { cc: "LI", name: "Liechtenstein" }, { cc: "LT", name: "Lithuania" },
  { cc: "LU", name: "Luxembourg" }, { cc: "MG", name: "Madagascar" }, { cc: "MW", name: "Malawi" },
  { cc: "MY", name: "Malaysia" }, { cc: "MV", name: "Maldives" }, { cc: "ML", name: "Mali" },
  { cc: "MT", name: "Malta" }, { cc: "MH", name: "Marshall Islands" }, { cc: "MR", name: "Mauritania" },
  { cc: "MU", name: "Mauritius" }, { cc: "MX", name: "Mexico" }, { cc: "FM", name: "Micronesia" },
  { cc: "MD", name: "Moldova" }, { cc: "MC", name: "Monaco" }, { cc: "MN", name: "Mongolia" },
  { cc: "ME", name: "Montenegro" }, { cc: "MA", name: "Morocco" }, { cc: "MZ", name: "Mozambique" },
  { cc: "MM", name: "Myanmar" }, { cc: "NA", name: "Namibia" }, { cc: "NR", name: "Nauru" },
  { cc: "NP", name: "Nepal" }, { cc: "NL", name: "Netherlands" }, { cc: "NZ", name: "New Zealand" },
  { cc: "NI", name: "Nicaragua" }, { cc: "NE", name: "Niger" }, { cc: "NG", name: "Nigeria" },
  { cc: "MK", name: "North Macedonia" }, { cc: "NO", name: "Norway" }, { cc: "OM", name: "Oman" },
  { cc: "PK", name: "Pakistan" }, { cc: "PW", name: "Palau" }, { cc: "PS", name: "Palestine" },
  { cc: "PA", name: "Panama" }, { cc: "PG", name: "Papua New Guinea" }, { cc: "PY", name: "Paraguay" },
  { cc: "PE", name: "Peru" }, { cc: "PH", name: "Philippines" }, { cc: "PL", name: "Poland" },
  { cc: "PT", name: "Portugal" }, { cc: "QA", name: "Qatar" }, { cc: "RO", name: "Romania" },
  { cc: "RU", name: "Russia" }, { cc: "RW", name: "Rwanda" }, { cc: "KN", name: "Saint Kitts and Nevis" },
  { cc: "LC", name: "Saint Lucia" }, { cc: "VC", name: "Saint Vincent and the Grenadines" },
  { cc: "WS", name: "Samoa" }, { cc: "SM", name: "San Marino" }, { cc: "ST", name: "São Tomé and Príncipe" },
  { cc: "SA", name: "Saudi Arabia" }, { cc: "SN", name: "Senegal" }, { cc: "RS", name: "Serbia" },
  { cc: "SC", name: "Seychelles" }, { cc: "SL", name: "Sierra Leone" }, { cc: "SG", name: "Singapore" },
  { cc: "SK", name: "Slovakia" }, { cc: "SI", name: "Slovenia" }, { cc: "SB", name: "Solomon Islands" },
  { cc: "SO", name: "Somalia" }, { cc: "ZA", name: "South Africa" }, { cc: "SS", name: "South Sudan" },
  { cc: "ES", name: "Spain" }, { cc: "LK", name: "Sri Lanka" }, { cc: "SD", name: "Sudan" },
  { cc: "SR", name: "Suriname" }, { cc: "SE", name: "Sweden" }, { cc: "CH", name: "Switzerland" },
  { cc: "SY", name: "Syria" }, { cc: "TW", name: "Taiwan" }, { cc: "TJ", name: "Tajikistan" },
  { cc: "TZ", name: "Tanzania" }, { cc: "TH", name: "Thailand" }, { cc: "TL", name: "Timor-Leste" },
  { cc: "TG", name: "Togo" }, { cc: "TO", name: "Tonga" }, { cc: "TT", name: "Trinidad and Tobago" },
  { cc: "TN", name: "Tunisia" }, { cc: "TR", name: "Türkiye" }, { cc: "TM", name: "Turkmenistan" },
  { cc: "TV", name: "Tuvalu" }, { cc: "UG", name: "Uganda" }, { cc: "UA", name: "Ukraine" },
  { cc: "AE", name: "United Arab Emirates" }, { cc: "GB", name: "United Kingdom" },
  { cc: "US", name: "United States" }, { cc: "UY", name: "Uruguay" }, { cc: "UZ", name: "Uzbekistan" },
  { cc: "VU", name: "Vanuatu" }, { cc: "VA", name: "Vatican City" }, { cc: "VE", name: "Venezuela" },
  { cc: "VN", name: "Vietnam" }, { cc: "YE", name: "Yemen" }, { cc: "ZM", name: "Zambia" },
  { cc: "ZW", name: "Zimbabwe" },
];

export const COUNTRY_BY_CC: Record<string, string> = Object.fromEntries(ISO_COUNTRIES.map(c => [c.cc, c.name]));
export const COUNTRY_BY_NAME: Record<string, string> = Object.fromEntries(ISO_COUNTRIES.map(c => [c.name.toLowerCase(), c.cc]));

export const evFlag = (cc: string) => flag((cc || "").toUpperCase());

export const countryFromName = (name: string) => {
  const n = (name || "").trim();
  if (!n) return { cc: "", name: "" };
  const direct = COUNTRY_BY_NAME[n.toLowerCase()];
  if (direct) return { cc: direct, name: COUNTRY_BY_CC[direct] };
  const hit = ISO_COUNTRIES.find(c => c.name.toLowerCase().startsWith(n.toLowerCase()) || c.cc === n.toUpperCase());
  return hit ? { ...hit } : { cc: "", name: n };
};

const row = (cc: string, points: number, name?: string): EvRow => ({
  id: cc.toLowerCase(),
  cc,
  name: name || COUNTRY_BY_CC[cc] || cc,
  points,
});

export const DEFAULT_CARDS: Record<EvStyle, EvCard> = {
  asia: { style: "asia", country: "Philippines", cc: "PH", song: "Sobra-Sobra", artist: "CARMELLE", lyrics: "Gianina Camille \"Nica\" del Rosario & Mart Sam Emmanuel \"Mat\" B. Olavides" },
  esc: { style: "esc", country: "Switzerland", cc: "CH", song: "Alice", artist: "Veronica Fusaro", lyrics: "Veronica Fusaro & Charlie McClean" },
  jesc: { style: "jesc", country: "France", cc: "FR", song: "Comment tu vas ?", artist: "ALEC", lyrics: "ALEC & MALO" },
};

/** Asia Grand Final, Bangkok 14 Nov 2026 (combined totals). */
export const ASIA_BOARD: EvRow[] = [
  row("PH", 211), row("TH", 170), row("VN", 164), row("MY", 152), row("LA", 139),
  row("BT", 126), row("KR", 113, "Rep. of Korea"), row("MN", 94), row("NP", 69), row("KH", 61), row("BD", 35),
];

/** Eurovision 2026 Grand Final, Vienna. */
export const ESC_BOARD: EvRow[] = [
  row("BG", 516), row("IL", 343), row("RO", 296), row("AU", 287), row("IT", 281),
  row("FI", 279), row("DK", 243), row("MD", 226), row("UA", 221), row("GR", 220),
  row("FR", 158), row("PL", 150), row("AL", 145), row("NO", 134), row("HR", 124),
  row("CZ", 113), row("RS", 90), row("MT", 89), row("CY", 75), row("SE", 51),
  row("BE", 36), row("LT", 22), row("DE", 12), row("AT", 6), row("GB", 1),
];

/** Junior Eurovision 2026 Grand Final, Malta. */
export const JESC_BOARD: EvRow[] = [
  row("AM", 202), row("ES", 184), row("FR", 165), row("SM", 148), row("GE", 145),
  row("PL", 144), row("MT", 136), row("NL", 126), row("UA", 106), row("CY", 98),
  row("IT", 87), row("ME", 68), row("PT", 64), row("IE", 64), row("AL", 62), row("MK", 57),
];

export const DEFAULT_BOARDS: Record<EvStyle, EvBoard> = {
  asia: { style: "asia", round: "gf", rows: ASIA_BOARD },
  esc: { style: "esc", round: "gf", rows: ESC_BOARD },
  jesc: { style: "jesc", round: "gf", rows: JESC_BOARD },
};

export const defaultStore = (): EvStore => ({
  cards: { asia: { ...DEFAULT_CARDS.asia }, esc: { ...DEFAULT_CARDS.esc }, jesc: { ...DEFAULT_CARDS.jesc } },
  boards: {
    asia: { ...DEFAULT_BOARDS.asia, rows: DEFAULT_BOARDS.asia.rows.map(r => ({ ...r })) },
    esc: { ...DEFAULT_BOARDS.esc, rows: DEFAULT_BOARDS.esc.rows.map(r => ({ ...r })) },
    jesc: { ...DEFAULT_BOARDS.jesc, rows: DEFAULT_BOARDS.jesc.rows.map(r => ({ ...r })) },
  },
});

export const sortRows = (rows: EvRow[]): EvRow[] =>
  [...rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.cc.localeCompare(b.cc));

export const rankedRows = (rows: EvRow[]) => sortRows(rows).map((r, i) => ({ ...r, rank: i + 1 }));

export const isSemi = (round: EvRound) => round === "sf1" || round === "sf2";

export const qualifies = (round: EvRound, rank: number) => isSemi(round) && rank <= EV_QUALIFY;

export const boardColumns = (style: EvStyle, count: number, wide: boolean) => {
  if (count <= 6) return 1;
  if (style === "asia") return wide && count > 12 ? 2 : 1;
  return count >= 8 ? 2 : 1;
};

export const setPoints = (rows: EvRow[], id: string, points: number): EvRow[] =>
  rows.map(r => r.id === id ? { ...r, points: Math.max(0, Math.round(Number(points) || 0)) } : r);

export const addPoints = (rows: EvRow[], id: string, add: number): EvRow[] => {
  const row = rows.find(r => r.id === id);
  return row ? setPoints(rows, id, row.points + add) : rows;
};

export const addCountry = (rows: EvRow[], cc: string): EvRow[] => {
  const C = cc.toUpperCase();
  if (!COUNTRY_BY_CC[C] || rows.some(r => r.cc === C)) return rows;
  return [...rows, { id: C.toLowerCase() + "-" + Date.now().toString(36), cc: C, name: COUNTRY_BY_CC[C], points: 0 }];
};

export const removeCountry = (rows: EvRow[], id: string): EvRow[] => rows.filter(r => r.id !== id);

export const loadStore = (): EvStore => {
  const base = defaultStore();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(EV_KEY) : null;
    if (!raw) return base;
    const d = JSON.parse(raw);
    const cards = { ...base.cards };
    for (const s of EV_STYLES) {
      const c = d?.cards?.[s];
      if (c && typeof c === "object") {
        cards[s] = {
          style: s,
          country: String(c.country || base.cards[s].country),
          cc: String(c.cc || base.cards[s].cc).toUpperCase().slice(0, 2),
          song: String(c.song ?? base.cards[s].song),
          artist: String(c.artist ?? base.cards[s].artist),
          lyrics: String(c.lyrics ?? base.cards[s].lyrics),
        };
      }
    }
    const boards = { ...base.boards };
    for (const s of EV_STYLES) {
      const b = d?.boards?.[s];
      if (b && typeof b === "object") {
        const rows: EvRow[] = Array.isArray(b.rows) ? b.rows.map((r: any, i: number) => ({
          id: String(r.id || `${String(r.cc || i).toLowerCase()}-${i}`),
          cc: String(r.cc || "").toUpperCase().slice(0, 2),
          name: String(r.name || COUNTRY_BY_CC[String(r.cc || "").toUpperCase()] || ""),
          points: Math.max(0, Math.round(Number(r.points) || 0)),
        })).filter((r: EvRow) => r.cc && r.name) : base.boards[s].rows.map(r => ({ ...r }));
        const round: EvRound = EV_ROUNDS.includes(b.round) ? b.round : base.boards[s].round;
        boards[s] = { style: s, round, rows };
      }
    }
    return { cards, boards };
  } catch {
    return base;
  }
};

export const saveStore = (store: EvStore) => {
  try { localStorage.setItem(EV_KEY, JSON.stringify(store)); } catch { /* quota / private mode */ }
};

export const padRank = (n: number) => String(n).padStart(2, "0");
