// Sign studio (Games): design hanging airport wayfinding signs in looks recreated from photos (plus Gran Canaria: brown bars,
// DE/EN/ES, green gate chips; Fraport Greece: navy, lime Greek/English, green exit end-cap) —
// Kraków (charcoal, silver frame, Polish white + English yellow), Manchester (black backlit box, yellow pictogram squares,
// white arrow tiles) and Heathrow (yellow, black circular pictograms, three ruled rows). Recreations only: no airport marks.
import { useMemo, useState } from "react";
import { Picto, PICTOS, PICTO_KEYS, ArrowSvg, ARROWS, type Arrow } from "./pictos";
import { AirlineTile } from "./brand";
import { LOGOS } from "./logoset";
import { AL_NAMES } from "./alnames";
import { enc, dec, FullScreen } from "./gate";
import "./signs.css";

export type SThemeK = "krk" | "man" | "lhr" | "lpa" | "fgr";
/** One line of text. Multilingual looks keep each language in its own field: Kraków t=Polish en=English; Gran Canaria t=German en=English es=Spanish; Fraport Greece t=Greek en=English. */
export type SLine = { t: string; en?: string; es?: string; al?: string[]; cross?: boolean };
/** Gran Canaria gate-range chips: "C19 to/a C21" (connector words editable in English and Spanish). */
export type SGates = { a: string; b?: string; en?: string; es?: string };
/** Gran Canaria walking-time chips: small "10min." over a coloured letter square. */
export type SChip = { m: string; l: string; c: string };
export type SRow = { arrow: Arrow; ics: string[]; lines: SLine[]; gates?: SGates; chips?: SChip[] };
export type SignSpec = { v: 1; theme: SThemeK; rows: SRow[]; corner?: string[]; cap?: { on: boolean; arrow: Arrow } };
export const STHEMES: [SThemeK, string][] = [["krk", "Kraków"], ["man", "Manchester"], ["lhr", "Heathrow"], ["lpa", "Gran Canaria"], ["fgr", "Fraport Greece"]];
const THEME_KEYS = STHEMES.map(t => t[0]);
export const CHIP_COLS: [string, string][] = [["blue", "Blue"], ["red", "Red"], ["green", "Green"], ["yellow", "Yellow"]];
/** Which text fields each look has (label shown in the editor). */
export const LANGS: Record<SThemeK, [keyof SLine, string, string][]> = {
  krk: [["t", "Polski", "np. Odloty"], ["en", "English", "e.g. Departures"]],
  man: [["t", "Text", "e.g. Departures"]], lhr: [["t", "Text", "e.g. Gates A1-A10"]],
  lpa: [["t", "Deutsch", "z. B. Flugsteige"], ["en", "English", "e.g. Gates"], ["es", "Español", "p. ej. Puertas"]],
  fgr: [["t", "Ελληνικά (Greek)", "π.χ. Αναχωρήσεις"], ["en", "English", "e.g. Departures"]],
};
const MULTI = (t: SThemeK) => t === "krk" || t === "lpa" || t === "fgr";
const ARROW_KEYS = ARROWS.map(a => a[0]);

/** Defaults reproduce the three reference photos. Kraków rule: `t` = Polish (white), `en` = English (yellow) — one language per field. */
export const DEFAULTS: Record<SThemeK, SignSpec> = {
  krk: { v: 1, theme: "krk", corner: ["escalator", "wheelchair", "dog"], rows: [
    { arrow: "up", ics: ["plane"], lines: [{ t: "", en: "Check-in 1-18" }, { t: "", en: "VIP Terminal" }, { t: "Skrytki bagażowe", en: "Luggage lockers" }, { t: "Taras widokowy", en: "Observation deck" }] },
    { arrow: "right", ics: ["plane"], lines: [{ t: "", en: "Check-in 19-45" }, { t: "Kasy biletowe", en: "Ticket offices" }] }] },
  man: { v: 1, theme: "man", rows: [
    { arrow: "upright", ics: ["plane", "escalator"], lines: [{ t: "Departures" }] },
    { arrow: "upright", ics: ["checkin", "escalator"], lines: [{ t: "Check in" }] }] },
  lhr: { v: 1, theme: "lhr", rows: [
    { arrow: "left", ics: ["plane"], lines: [{ t: "Gates A19-A26" }] },
    { arrow: "left", ics: ["lounge", "pharmacy", "prayer"], lines: [{ t: "Lounges A1-A2", al: ["LH", "EI"] }, { t: "Pharmacy", cross: true }, { t: "Multi-faith prayer room" }] },
    { arrow: "left", ics: ["toilets", "wheelchair", "baby", "fountain"], lines: [{ t: "Toilets" }] }] },
  lpa: { v: 1, theme: "lpa", rows: [
    { arrow: "right", ics: ["plane"], lines: [{ t: "Flugsteige", en: "Gates", es: "Puertas" }], gates: { a: "C19", b: "C21", en: "to", es: "a" } },
    { arrow: "down", ics: ["plane"], lines: [{ t: "Flugsteige", en: "Gates", es: "Puertas" }], gates: { a: "C18", b: "C01", en: "to", es: "a" }, chips: [{ m: "10min.", l: "B", c: "blue" }, { m: "15min.", l: "A", c: "red" }] }] },
  fgr: { v: 1, theme: "fgr", cap: { on: true, arrow: "right" }, rows: [
    { arrow: "left", ics: ["screening"], lines: [{ t: "Έλεγχος Ασφαλείας", en: "Security control" }] },
    { arrow: "none", ics: ["officer"], lines: [{ t: "Έλεγχος Διαβατηρίων", en: "Passport control" }] },
    { arrow: "none", ics: ["boarding"], lines: [{ t: "Χώρος Επιβίβασης", en: "Boarding Area" }] }] },
};
// Common messages, written once in Polish, English, German, Spanish and Greek ([pl, en, de, es, el]) and adapted to each look.
type L5 = [string, string, string, string, string];
type G = { a: Arrow; i: string[]; l: L5[] };
const COMMON: Record<string, { n: string; rows: G[] }> = {
  dep: { n: "Departures", rows: [{ a: "up", i: ["plane"], l: [["Odloty", "Departures", "Abflug", "Salidas", "Αναχωρήσεις"], ["Odprawa", "Check-in", "Check-in", "Facturación", "Έλεγχος Εισιτηρίων"]] }, { a: "right", i: ["security"], l: [["Kontrola bezpieczeństwa", "Security", "Sicherheitskontrolle", "Control de seguridad", "Έλεγχος Ασφαλείας"]] }] },
  arr: { n: "Arrivals", rows: [{ a: "left", i: ["arrivals"], l: [["Przyloty", "Arrivals", "Ankunft", "Llegadas", "Αφίξεις"], ["Odbiór bagażu", "Baggage reclaim", "Gepäckausgabe", "Recogida de equipajes", "Παραλαβή Αποσκευών"]] }, { a: "right", i: ["taxi", "train", "bus"], l: [["Transport", "Taxis, trains & buses", "Taxi & Bus", "Taxis y autobuses", "Ταξί & Λεωφορεία"]] }] },
  gates: { n: "Gates", rows: [{ a: "left", i: ["gates"], l: [["Wyjścia 1-12", "Gates 1-12", "Flugsteige 1-12", "Puertas 1-12", "Πύλες 1-12"]] }, { a: "right", i: ["gates"], l: [["Wyjścia 14-28", "Gates 14-28", "Flugsteige 14-28", "Puertas 14-28", "Πύλες 14-28"]] }, { a: "up", i: ["food", "shop"], l: [["Restauracje i sklepy", "Food & shops", "Restaurants & Shops", "Restaurantes y tiendas", "Εστιατόρια & Καταστήματα"]] }] },
  checkin: { n: "Check-in", rows: [{ a: "upright", i: ["checkin"], l: [["Odprawa A-D", "Check-in A-D", "Check-in A-D", "Facturación A-D", "Έλεγχος Εισιτηρίων A-D"]] }, { a: "upleft", i: ["luggage"], l: [["Bagaż ponadgabarytowy", "Oversize baggage", "Sperrgepäck", "Equipaje especial", "Ογκώδεις Αποσκευές"]] }] },
  toilets: { n: "Toilets", rows: [{ a: "right", i: ["toilets", "wheelchair", "baby"], l: [["Toalety", "Toilets", "Toiletten", "Aseos", "Τουαλέτες"]] }, { a: "left", i: ["fountain"], l: [["Woda pitna", "Drinking water", "Trinkwasser", "Agua potable", "Πόσιμο Νερό"]] }] },
  security: { n: "Security", rows: [{ a: "up", i: ["security"], l: [["Kontrola bezpieczeństwa", "Security", "Sicherheitskontrolle", "Control de seguridad", "Έλεγχος Ασφαλείας"], ["Wszystkie wyjścia", "All gates", "Alle Flugsteige", "Todas las puertas", "Όλες οι Πύλες"]] }, { a: "right", i: ["passport"], l: [["Kontrola paszportowa", "Passport control", "Passkontrolle", "Control de pasaportes", "Έλεγχος Διαβατηρίων"]] }] },
  reclaim: { n: "Baggage reclaim", rows: [{ a: "down", i: ["reclaim"], l: [["Odbiór bagażu", "Baggage reclaim", "Gepäckausgabe", "Recogida de equipajes", "Παραλαβή Αποσκευών"]] }, { a: "right", i: ["info"], l: [["Informacja", "Information", "Information", "Información", "Πληροφορίες"]] }, { a: "left", i: ["money"], l: [["Kantor", "Currency exchange", "Geldwechsel", "Cambio de moneda", "Συνάλλαγμα"]] }] },
};
const lineFor = (theme: SThemeK, [pl, en, de, es, el]: L5): SLine => theme === "krk" ? { t: pl, en } : theme === "lpa" ? { t: de, en, es } : theme === "fgr" ? { t: el, en } : { t: en };
export const PRESET_KEYS = Object.keys(COMMON);
export function presetFor(theme: SThemeK, key: string): SignSpec {
  if (key === "default" || !COMMON[key]) return clone(DEFAULTS[theme]);
  // Gran Canaria bars and Fraport Greece rows carry one message each, so multi-line messages become separate bars/rows.
  const split = theme === "lpa" || theme === "fgr";
  const rows: SRow[] = COMMON[key].rows.flatMap(g => (split ? g.l.map((l, j) => ({ g, l: [l], j })) : [{ g, l: g.l, j: 0 }]).map(({ g, l, j }) => ({
    arrow: theme === "man" && g.a === "up" ? "upright" as Arrow : theme === "fgr" && j ? "none" as Arrow : g.a, ics: theme === "man" || theme === "lpa" ? g.i.slice(0, 2) : theme === "fgr" ? g.i.slice(0, 1) : g.i, lines: l.map(x => lineFor(theme, x)) })));
  return { v: 1, theme, rows, ...(theme === "krk" ? { corner: ["wheelchair", "lift"] } : theme === "fgr" ? { cap: { on: true, arrow: "right" as Arrow } } : {}) };
}
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const isDefault = (s: SignSpec) => JSON.stringify({ r: s.rows, c: s.corner || [], k: s.cap || null }) === JSON.stringify({ r: DEFAULTS[s.theme].rows, c: DEFAULTS[s.theme].corner || [], k: DEFAULTS[s.theme].cap || null });
/** Restyle a sign in another look, keeping the user's rows (Kraków keeps languages in separate fields). */
export function convert(s: SignSpec, theme: SThemeK): SignSpec {
  if (s.theme === theme) return s;
  // English is the shared language: multilingual looks keep it in `en`, single-language looks in `t`. Other languages are not guessed.
  const rows = s.rows.map(r => ({ ...r, ics: theme === "man" ? r.ics.slice(0, 3) : r.ics, lines: r.lines.map(l => { const E = MULTI(s.theme) ? (l.en || l.t) : l.t; const { es: _es, en: _en, ...rest } = l; void _es; void _en; return MULTI(theme) ? { ...rest, t: "", en: E } : { ...rest, t: E }; }) }));
  return { v: 1, theme, rows, ...(theme === "krk" ? { corner: s.corner || [] } : theme === "fgr" ? { cap: s.cap || { on: true, arrow: "right" as Arrow } } : {}) };
}
/** Validate a sign decoded from a share link / storage: unknown pictograms, arrows and logos are dropped, sizes capped. */
export function sanitize(o: any): SignSpec | null {
  if (!o || typeof o !== "object" || !THEME_KEYS.includes(o.theme) || !Array.isArray(o.rows)) return null;
  const str = (x: any, n = 48) => typeof x === "string" ? x.slice(0, n) : "";
  const rows: SRow[] = o.rows.slice(0, 8).map((r: any) => ({ arrow: ARROW_KEYS.includes(r?.arrow) ? r.arrow : "none", ics: (Array.isArray(r?.ics) ? r.ics : []).filter((k: any) => PICTOS[k]).slice(0, 4),
    lines: (Array.isArray(r?.lines) ? r.lines : []).slice(0, 6).map((l: any) => ({ t: str(l?.t), ...(l?.en ? { en: str(l.en) } : {}), ...(l?.es ? { es: str(l.es) } : {}), ...(Array.isArray(l?.al) && l.al.length ? { al: l.al.filter((k: any) => LOGOS.has(k)).slice(0, 3) } : {}), ...(l?.cross ? { cross: true } : {}) })),
    ...(r?.gates && typeof r.gates === "object" && str(r.gates.a, 8) ? { gates: { a: str(r.gates.a, 8), ...(r.gates.b ? { b: str(r.gates.b, 8) } : {}), en: str(r.gates.en, 6), es: str(r.gates.es, 6) } } : {}),
    ...(Array.isArray(r?.chips) && r.chips.length ? { chips: r.chips.slice(0, 4).map((c: any) => ({ m: str(c?.m, 8), l: str(c?.l, 3), c: CHIP_COLS.some(x => x[0] === c?.c) ? c.c : "blue" })) } : {}) }));
  return { v: 1, theme: o.theme, rows, ...(o.theme === "krk" ? { corner: (Array.isArray(o.corner) ? o.corner : []).filter((k: any) => PICTOS[k]).slice(0, 4) } : {}),
    ...(o.theme === "fgr" ? { cap: { on: o.cap ? !!o.cap.on : true, arrow: ARROW_KEYS.includes(o.cap?.arrow) ? o.cap.arrow : "right" } } : {}) };
}
export const signLink = (s: SignSpec, origin = "") => `${origin}/#games=signs&s=${enc(s)}`;
export const signFromHash = (h: string) => sanitize(dec(h.match(/[#&]s=([\w-]+)/)?.[1] || ""));

const Cross = () => <svg className="sg-cross" viewBox="0 0 24 24" aria-label="Pharmacy cross"><path d="M8.5 2h7v6.5H22v7h-6.5V22h-7v-6.5H2v-7h6.5z" fill="#1fa64a" stroke="#fff" strokeWidth="1.2" /></svg>;
const Al = ({ k }: { k: string }) => <AirlineTile a={{ iata: k, name: AL_NAMES[k] || k }} className={"sg-al al-" + k} mode="colour" />;

/** One sign, sized by its container width (CSS container units), so height follows content and never squashes. */
export function SignView({ s }: { s: SignSpec }) {
  const rows = s.rows.length ? s.rows : [{ arrow: "none" as Arrow, ics: [], lines: [{ t: "" }] }];
  if (s.theme === "krk") return <div className="sg-wrap"><div className="sg-hang krk"><i /><i /></div><div className="sg sg-krk" role="img" aria-label={rows.flatMap(r => r.lines.map(l => [l.t, l.en].filter(Boolean).join(" "))).join(", ")}>
    {!!s.corner?.length && <div className="sgk-corner">{s.corner.map(k => <Picto key={k} k={k} />)}</div>}
    {rows.map((r, i) => <div key={i} className={"sgk-row" + (i ? " div" : "")}><span className="sgk-ar"><ArrowSvg a={r.arrow} w={2.6} /></span><span className="sgk-ic">{r.ics.map(k => <Picto key={k} k={k} />)}</span>
      <div className="sgk-lines">{r.lines.map((l, j) => <div key={j} className={j ? "sgk-sub" : "sgk-head"}>{l.t && <span className="pl">{l.t}</span>}{l.en && <span className="en">{l.en}</span>}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</div>)}</div></div>)}</div></div>;
  if (s.theme === "man") return <div className="sg-wrap"><div className="sg sg-man" role="img" aria-label={rows.map(r => r.lines.map(l => l.t).join(" ")).join(", ")}><span className="sm-pole" /><span className="sm-brk" /><span className="sm-brk b" />
    {rows.map((r, i) => <div key={i} className="sm-row"><span className="sm-ic">{r.ics.map(k => <span key={k} className="sm-sq"><Picto k={k} /></span>)}</span>
      <div className="sm-lines">{r.lines.map((l, j) => <div key={j} className={j ? "sm-sub" : "sm-t"}>{l.t}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</div>)}</div>
      <span className={"sm-tile" + (r.arrow === "none" ? " none" : "")}><ArrowSvg a={r.arrow} w={2.4} /></span></div>)}</div></div>;
  if (s.theme === "lpa") return <div className="sg-wrap"><div className="sg-lpa-stack" role="img" aria-label={rows.map(r => r.lines.map(l => [l.t, l.en, l.es].filter(Boolean).join(" ")).join(" ") + (r.gates?.a ? ` ${r.gates.a}${r.gates.b ? " to " + r.gates.b : ""}` : "")).join(", ")}>
    {rows.map((r, i) => <div key={i} className="sp-unit"><div className="sg-hang lpa"><i /><i /></div><div className="sg sg-lpa">
      <span className="sp-ar"><ArrowSvg a={r.arrow} w={3.2} /></span><span className="sp-ic">{r.ics.map(k => <span key={k} className="sp-sq"><Picto k={k} /></span>)}</span>
      <div className="sp-lines">{r.lines.map((l, j) => <div key={j} className="sp-l">{l.t && <span className="de">{l.t}</span>}{l.en && <span className="en">{l.en}</span>}{l.es && <span className="es">{l.es}</span>}{(l.cross || !!l.al?.length) && <span className="sp-x">{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</span>}</div>)}</div>
      <div className="sp-gates">{r.gates?.a && <><b className="sp-g">{r.gates.a}</b>{r.gates.b && <><span className="sp-to"><i>{r.gates.en}</i><i className="es">{r.gates.es}</i></span><b className="sp-g">{r.gates.b}</b></>}</>}</div>
      <div className="sp-chips">{r.chips?.map((c, k) => <span key={k} className="sp-chip"><small>{c.m}</small><b className={"c-" + c.c}>{c.l}</b></span>)}</div></div></div>)}</div></div>;
  if (s.theme === "fgr") { const cap = s.cap?.on !== false;
    return <div className="sg-wrap"><div className="sg-hang fgr"><i /><i /></div><div className={"sg sg-fgr" + (cap ? " cap" : "")} role="img" aria-label={rows.map(r => r.lines.map(l => [l.t, l.en].filter(Boolean).join(" ")).join(" ")).join(", ")}>
      <div className="sf-rows">{rows.map((r, i) => <div key={i} className="sf-row"><span className="sf-ar"><ArrowSvg a={r.arrow} w={2.2} /></span><span className="sf-ic">{r.ics.map(k => <span key={k} className="sf-c"><Picto k={k} /></span>)}</span>
        <div className="sf-lines">{r.lines.map((l, j) => <div key={j} className="sf-l">{l.t && <span className="el">{l.t}</span>}{(l.en || l.cross || !!l.al?.length) && <span className="en">{l.en}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</span>}</div>)}</div></div>)}</div>
      {cap && <div className="sf-cap"><span className="sf-exit"><Picto k="exit" /></span><span className="sf-car"><ArrowSvg a={s.cap?.arrow || "right"} w={2.2} /></span></div>}</div></div>; }
  return <div className="sg-wrap"><div className="sg-hang lhr"><i /><i /></div><div className="sg sg-lhr" role="img" aria-label={rows.map(r => r.lines.map(l => l.t).join(" ")).join(", ")}>
    {rows.map((r, i) => { const stack = r.lines.length > 1 && r.ics.length > 1; return <div key={i} className="sl-row"><span className="sl-ar"><ArrowSvg a={r.arrow} w={3} /></span>
      <span className={"sl-ic" + (stack ? " stack" : "")}>{r.ics.map(k => <span key={k} className="sl-c"><Picto k={k} /></span>)}</span>
      <div className="sl-lines">{r.lines.map((l, j) => <div key={j} className="sl-t">{l.t}{l.cross && <Cross />}{l.al?.map(k => <Al key={k} k={k} />)}</div>)}</div></div>; })}</div></div>;
}

const LS = "sk.games.sign";
const load = (): SignSpec => signFromHash(location.hash) || sanitize(JSON.parse(localStorage.getItem(LS) || "null")) || clone(DEFAULTS.krk);
const alList = () => [...LOGOS].map(k => [k, AL_NAMES[k] || k] as const).sort((a, b) => a[1].localeCompare(b[1]));

export function SignStudio() {
  const [s, setS0] = useState<SignSpec>(load); const [full, setFull] = useState(false); const [msg, setMsg] = useState(""); const [pick, setPick] = useState<number | "c" | null>(null);
  const [saved, setSaved] = useState<SignSpec[]>(() => { try { return (JSON.parse(localStorage.getItem(LS + "s") || "[]") as any[]).map(sanitize).filter(Boolean) as SignSpec[]; } catch { return []; } });
  const AL = useMemo(alList, []);
  const setS = (n: SignSpec) => { setS0(n); localStorage.setItem(LS, JSON.stringify(n)); };
  const rows = s.rows; const setRows = (r: SRow[]) => setS({ ...s, rows: r });
  const setRow = (i: number, p: Partial<SRow>) => setRows(rows.map((r, k) => k === i ? { ...r, ...p } : r));
  const setLine = (i: number, j: number, p: Partial<SLine>) => setRow(i, { lines: rows[i].lines.map((l, k) => k === j ? { ...l, ...p } : l) });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const r = rows.slice(); [r[i], r[j]] = [r[j], r[i]]; setRows(r); };
  const theme = (th: SThemeK) => setS(isDefault(s) ? clone(DEFAULTS[th]) : convert(s, th));
  const share = async () => { const u = signLink(s, location.origin); history.replaceState(history.state, "", `#games=signs&s=${enc(s)}`); try { if (navigator.share) await navigator.share({ url: u, title: "My airport sign" }); else { await navigator.clipboard.writeText(u); setMsg("Link copied"); } } catch { try { await navigator.clipboard.writeText(u); setMsg("Link copied"); } catch { setMsg(u); } } };
  const save = () => { const n = [s, ...saved.filter(x => JSON.stringify(x) !== JSON.stringify(s))].slice(0, 20); setSaved(n); localStorage.setItem(LS + "s", JSON.stringify(n)); setMsg("Saved on this device"); };
  const reset = () => { if (isDefault(s) || confirm(`Reset to the ${STHEMES.find(t => t[0] === s.theme)![1]} default sign? Your rows will be replaced.`)) setS(clone(DEFAULTS[s.theme])); };
  const kr = s.theme === "krk"; const langs = LANGS[s.theme]; const blank = (): SLine => ({ t: "", ...Object.fromEntries(langs.map(([k]) => [k, ""])) }) as SLine;
  const ADDROW: Record<SThemeK, SRow> = { krk: { arrow: "right", ics: ["plane"], lines: [{ t: "Wyjścia", en: "Gates" }] }, man: { arrow: "upright", ics: ["plane"], lines: [{ t: "Gates" }] }, lhr: { arrow: "left", ics: ["plane"], lines: [{ t: "Gates" }] },
    lpa: { arrow: "right", ics: ["plane"], lines: [{ t: "Flugsteige", en: "Gates", es: "Puertas" }], gates: { a: "A1", b: "A10", en: "to", es: "a" } }, fgr: { arrow: "right", ics: ["plane"], lines: [{ t: "Πύλες", en: "Gates" }] } };
  const Picker = ({ have, add }: { have: string[]; add: (k: string) => void }) => <div className="sg-pick">{PICTO_KEYS.filter(k => !have.includes(k)).map(k => <button key={k} onClick={() => add(k)} title={PICTOS[k].n}><Picto k={k} /><small>{PICTOS[k].n}</small></button>)}</div>;
  return <div className="gsx sgs">
    <div className={"sg-stage " + s.theme} onClick={() => setFull(true)}><SignView s={s} /></div>
    <div className="gp-ctl"><button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button><button className="gp-btn" onClick={share}>Share link</button><button className="gp-btn" onClick={save}>Save</button><button className="gp-btn" onClick={reset}>Reset</button>{msg && <span className="faint xs">{msg}</span>}</div>
    <div className="gp-seg sg-themes" role="tablist">{STHEMES.map(([k, n]) => <button key={k} role="tab" aria-selected={s.theme === k} className={s.theme === k ? "on" : ""} onClick={() => theme(k)}>{n}</button>)}</div>
    <div className="gsx-pre">{["default", ...PRESET_KEYS].map(k => <button key={k} onClick={() => { if (isDefault(s) || confirm("Replace this sign with the preset?")) setS(presetFor(s.theme, k)); }}>{k === "default" ? "Photo sign" : COMMON[k].n}</button>)}</div>
    {s.theme === "fgr" && <div className="sg-card"><div className="sg-card-h"><b>Green exit end-cap</b><button className={"sg-mini" + (s.cap?.on !== false ? " on" : "")} aria-pressed={s.cap?.on !== false} onClick={() => setS({ ...s, cap: { on: s.cap?.on === false, arrow: s.cap?.arrow || "right" } })}>{s.cap?.on !== false ? "On" : "Off"}</button></div>
      {s.cap?.on !== false && <label className="gsx-f"><span>End-cap arrow</span><select value={s.cap?.arrow || "right"} onChange={e => setS({ ...s, cap: { on: true, arrow: e.target.value as Arrow } })}>{ARROWS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>}</div>}
    {kr && <div className="sg-card"><div className="sg-card-h"><b>Corner pictograms</b></div><div className="sg-chips">{(s.corner || []).map(k => <button key={k} className="sg-chip" onClick={() => setS({ ...s, corner: (s.corner || []).filter(x => x !== k) })} aria-label={"Remove " + PICTOS[k].n}><Picto k={k} />✕</button>)}{(s.corner || []).length < 4 && <button className="sg-chip add" onClick={() => setPick(pick === "c" ? null : "c")}>＋ Pictogram</button>}</div>
      {pick === "c" && <Picker have={s.corner || []} add={k => { setS({ ...s, corner: [...(s.corner || []), k].slice(0, 4) }); setPick(null); }} />}</div>}
    {rows.map((r, i) => <div key={i} className="sg-card">
      <div className="sg-card-h"><b>{s.theme === "lpa" ? "Bar" : "Row"} {i + 1}</b><span><button className="sg-mini" disabled={!i} onClick={() => move(i, -1)} aria-label="Move up">↑</button><button className="sg-mini" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button><button className="sg-mini del" onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label="Delete row">✕</button></span></div>
      <label className="gsx-f"><span>Arrow</span><select value={r.arrow} onChange={e => setRow(i, { arrow: e.target.value as Arrow })}>{ARROWS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <div className="gsx-f"><span>Pictograms</span><div className="sg-chips">{r.ics.map(k => <button key={k} className="sg-chip" onClick={() => setRow(i, { ics: r.ics.filter(x => x !== k) })} aria-label={"Remove " + PICTOS[k].n}><Picto k={k} />✕</button>)}{r.ics.length < (s.theme === "man" ? 3 : 4) && <button className="sg-chip add" onClick={() => setPick(pick === i ? null : i)}>＋ Pictogram</button>}</div></div>
      {pick === i && <Picker have={r.ics} add={k => { setRow(i, { ics: [...r.ics, k].slice(0, 4) }); setPick(null); }} />}
      {r.lines.map((l, j) => <div key={j} className="sg-line">
        {kr ? <><label className="gsx-f"><span>{j ? "Polski (white)" : "Polski (white, optional)"}</span><input value={l.t} maxLength={48} placeholder="np. Odloty" onChange={e => setLine(i, j, { t: e.target.value })} /></label>
          <label className="gsx-f"><span>English (yellow)</span><input value={l.en || ""} maxLength={48} placeholder="e.g. Departures" onChange={e => setLine(i, j, { en: e.target.value || undefined })} /></label></>
          : langs.length > 1 ? langs.map(([k, n, ph]) => <label key={k} className="gsx-f"><span>{n}</span><input value={(l[k] as string) || ""} maxLength={48} placeholder={ph} onChange={e => setLine(i, j, { [k]: k === "t" ? e.target.value : e.target.value || undefined })} /></label>)
          : <label className="gsx-f"><span>{j ? `Line ${j + 1}` : "Text"}</span><input value={l.t} maxLength={48} placeholder="e.g. Gates A1-A10" onChange={e => setLine(i, j, { t: e.target.value })} /></label>}
        <div className="sg-line-x"><select aria-label="Airline logo" value={l.al?.[0] || ""} onChange={e => setLine(i, j, { al: e.target.value ? [e.target.value, ...(l.al || []).slice(1)].filter((x, k, a) => a.indexOf(x) === k) : undefined })}><option value="">No airline logo</option>{AL.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          <button className={"sg-mini" + (l.cross ? " on" : "")} onClick={() => setLine(i, j, { cross: !l.cross || undefined })} aria-pressed={!!l.cross} title="Green pharmacy cross">✚</button>
          <button className="sg-mini del" disabled={r.lines.length < 2} onClick={() => setRow(i, { lines: r.lines.filter((_, k) => k !== j) })} aria-label="Delete line">✕</button></div></div>)}
      {r.lines.length < (s.theme === "lpa" || s.theme === "fgr" ? 2 : 6) && <button className="gp-btn sg-add" onClick={() => setRow(i, { lines: [...r.lines, blank()] })}>＋ Add line</button>}
      {s.theme === "lpa" && <div className="sg-line"><div className="sg-card-h"><b>Gate range</b>{r.gates ? <button className="sg-mini del" onClick={() => setRow(i, { gates: undefined })} aria-label="Remove gate range">✕</button> : <button className="sg-mini" onClick={() => setRow(i, { gates: { a: "A1", b: "A10", en: "to", es: "a" } })}>＋</button>}</div>
        {r.gates && <div className="sg-g4"><label className="gsx-f"><span>From</span><input value={r.gates.a} maxLength={8} onChange={e => setRow(i, { gates: { ...r.gates!, a: e.target.value.toUpperCase() } })} /></label><label className="gsx-f"><span>To</span><input value={r.gates.b || ""} maxLength={8} placeholder="(single gate)" onChange={e => setRow(i, { gates: { ...r.gates!, b: e.target.value.toUpperCase() || undefined } })} /></label>
          <label className="gsx-f"><span>“to” word</span><input value={r.gates.en || ""} maxLength={6} onChange={e => setRow(i, { gates: { ...r.gates!, en: e.target.value } })} /></label><label className="gsx-f"><span>Spanish word</span><input value={r.gates.es || ""} maxLength={6} onChange={e => setRow(i, { gates: { ...r.gates!, es: e.target.value } })} /></label></div>}</div>}
      {s.theme === "lpa" && <div className="sg-line"><div className="sg-card-h"><b>Walking-time chips</b>{(r.chips || []).length < 4 && <button className="sg-mini" onClick={() => setRow(i, { chips: [...(r.chips || []), { m: "5min.", l: "C", c: "green" }] })} aria-label="Add walking-time chip">＋</button>}</div>
        {(r.chips || []).map((c, k) => <div key={k} className="sg-g4 chip"><label className="gsx-f"><span>Time</span><input value={c.m} maxLength={8} onChange={e => setRow(i, { chips: r.chips!.map((x, q) => q === k ? { ...x, m: e.target.value } : x) })} /></label><label className="gsx-f"><span>Letter</span><input value={c.l} maxLength={3} onChange={e => setRow(i, { chips: r.chips!.map((x, q) => q === k ? { ...x, l: e.target.value.toUpperCase() } : x) })} /></label>
          <label className="gsx-f"><span>Colour</span><select value={c.c} onChange={e => setRow(i, { chips: r.chips!.map((x, q) => q === k ? { ...x, c: e.target.value } : x) })}>{CHIP_COLS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label><button className="sg-mini del" onClick={() => setRow(i, { chips: r.chips!.filter((_, q) => q !== k) })} aria-label="Remove chip">✕</button></div>)}</div>}
    </div>)}
    {rows.length < 8 && <button className="gp-btn sg-add" onClick={() => setRows([...rows, clone(ADDROW[s.theme])])}>＋ {s.theme === "lpa" ? "Add bar" : "Add row"}</button>}
    {saved.length > 0 && <><h3 className="gsx-h">Saved signs</h3><div className="gsx-saved">{saved.map((x, k) => <button key={k} onClick={() => setS(clone(x))}>{x.rows[0]?.lines[0]?.en || x.rows[0]?.lines[0]?.t || "Sign"}<small>{x.theme.toUpperCase()}</small></button>)}</div></>}
    <p className="faint xs mt8">Fun recreations of Kraków-, Manchester-, Heathrow-, Gran Canaria- and Fraport Greece-style wayfinding signs, not official airport signs. Pictograms are drawn for Skyline; airline logos come from Skyline's own set. No airport logos are used.</p>
    {full && <FullScreen onClose={() => setFull(false)} bg="radial-gradient(120% 90% at 50% 0%,#3a3f4a,#0c0e12)"><div className="sg-full"><SignView s={s} /></div></FullScreen>}</div>;
}
