import { usePoll } from "./refresh";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtT, delay } from "./lib";
import { AirlineTile, BRAND } from "./brand";

// Original CSS recreations inspired by reference photos of each airport's screens (see refs/). Not official designs.
type Col = "time" | "dest" | "fl" | "logo" | "tag" | "gate" | "term" | "st" | "icon" | "est" | "tile";
type Th = { name: string; cls: string; caps?: boolean; iata?: boolean; local?: boolean; tr?: Record<string, string>; cols: Col[]; title: (dir: string) => [string, string]; panels?: number; clock: "top" | "bottom" | "box"; heads?: Partial<Record<Col, string>> };
export const THEMES: Record<string, Th> = {
  mag: { name: "MAG (MAN/STN/EMA)", cls: "tb-mag", cols: ["tile", "time", "dest", "fl", "st", "gate"], clock: "bottom", title: d => [d === "dep" ? "Airside Departures" : "Arrivals", ""], heads: { tile: "", time: "Time", dest: "Destination", fl: "Flight", st: "Remark", gate: "Gate" } },
  lhr: { name: "Heathrow", cls: "tb-lhr", cols: ["time", "dest", "fl", "st"], panels: 2, clock: "box", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  fra: { name: "Frankfurt", cls: "tb-fra", cols: ["fl", "dest", "time", "icon", "term", "gate"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departures"] : ["Ankunft", "Arrivals"], heads: { fl: "Flug Flight", dest: "Ziel Destination", time: "Zeit Time", icon: "", term: "Terminal", gate: "Gate" } },
  avinor: { name: "Avinor (OSL)", cls: "tb-avinor", cols: ["time", "tag", "dest", "gate", "st"], panels: 2, clock: "top", title: d => d === "dep" ? ["Avgang", "Departure"] : ["Ankomst", "Arrival"], heads: { time: "Tid", tag: "Fly", dest: "Til / To", gate: "Gate", st: "Merknad" } },
  syd: { name: "Sydney", cls: "tb-syd", cols: ["logo", "fl", "dest", "time", "est", "gate", "st"], panels: 2, clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""], heads: { logo: "", fl: "Flight", dest: "Destination", time: "Sched", est: "Est", gate: "Gate", st: "Status" } },
  ams: { name: "Schiphol", cls: "tb-ams", cols: ["time", "dest", "fl", "gate", "st"], panels: 2, clock: "top", title: d => d === "dep" ? ["Flight departures", "Vertrekken"] : ["Flight arrivals", "Aankomsten"] },
  cdg: { name: "Paris CDG", cls: "tb-cdg", cols: ["dest", "fl", "time", "term", "st"], clock: "top", title: d => d === "dep" ? ["Départs", "Departures"] : ["Arrivées", "Arrivals"], heads: { dest: "Destination", fl: "Vol Flight", time: "Heure Time", term: "Term.", st: "Remarques" } },
  solari: { name: "Split-flap", cls: "tb-solari", cols: ["fl", "dest", "time", "gate", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  lgw: { name: "Gatwick", cls: "tb-lgw", cols: ["time", "dest", "fl", "st", "gate"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""], heads: { time: "Time", dest: "Destination", fl: "Flight", st: "Status", gate: "Gate" } },
  edi: { name: "Edinburgh", cls: "tb-edi", cols: ["tile", "time", "dest", "fl", "gate", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  ags: { name: "AGS (GLA/ABZ/SOU)", cls: "tb-ags", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  bhx: { name: "Birmingham", cls: "tb-bhx", cols: ["logo", "time", "dest", "fl", "gate", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  daa: { name: "daa (DUB/ORK)", cls: "tb-daa", cols: ["time", "dest", "fl", "term", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Imeachtaí", "Departures"] : ["Teachtaí", "Arrivals"], heads: { time: "Time", dest: "Destination", fl: "Flight", term: "Term", gate: "Gate", st: "Remarks" } },
  bel: { name: "Belfast", cls: "tb-bel", cols: ["logo", "time", "dest", "fl", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  isl: { name: "Islands (JER/GCI/IOM)", cls: "tb-isl", cols: ["time", "dest", "fl", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  regional: { name: "UK regional", cls: "tb-reg", cols: ["tile", "time", "dest", "fl", "gate", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  // v18: more airport/operator recreations (CSS only, from public photos/descriptions; not official designs).
  krk: { name: "Kraków", cls: "tb-krk", caps: true, iata: true, local: true, cols: ["time", "est", "logo", "fl", "dest", "gate", "st"], clock: "top", title: d => [d === "dep" ? "✈ ODLOTY" : "✈ PRZYLOTY", ""], heads: { time: "PLANOWO", est: "OCZEKIWANY", logo: "LINIA", fl: "LOT", dest: "KIERUNEK", gate: "WYJŚCIE", st: "UWAGI" } },
  muc: { name: "Munich", cls: "tb-muc", cols: ["time", "dest", "fl", "term", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departures"] : ["Ankunft", "Arrivals"], heads: { time: "Zeit Time", dest: "Ziel Destination", fl: "Flug Flight", term: "Terminal", gate: "Gate", st: "Bemerkung Remarks" } },
  ber: { name: "Berlin BER", cls: "tb-ber", cols: ["time", "dest", "fl", "term", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departures"] : ["Ankunft", "Arrivals"], heads: { time: "Zeit", dest: "Ziel / Destination", fl: "Flug", term: "Terminal", gate: "Gate", st: "Status" } },
  ger: { name: "German airports (ADV)", cls: "tb-ger", cols: ["time", "fl", "dest", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departures"] : ["Ankunft", "Arrivals"], heads: { time: "Zeit", fl: "Flug", dest: "Ziel", gate: "Gate", st: "Bemerkung" } },
  zrh: { name: "Zurich", cls: "tb-zrh dotmx", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departure"] : ["Ankunft", "Arrival"], heads: { time: "Zeit", dest: "Nach / To", fl: "Flug", gate: "Gate", st: "Bemerkung" } },
  vie: { name: "Vienna", cls: "tb-vie", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departure"] : ["Ankunft", "Arrival"], heads: { time: "Zeit Time", dest: "Nach Destination", fl: "Flug Flight", gate: "Gate", st: "Info" } },
  prg: { name: "Prague", cls: "tb-prg", cols: ["time", "dest", "fl", "term", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Odlety", "Departures"] : ["Přílety", "Arrivals"], heads: { time: "Čas Time", dest: "Destinace", fl: "Let Flight", term: "Term.", gate: "Gate", st: "Poznámka" } },
  waw: { name: "Warsaw Chopin", cls: "tb-waw", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Odloty", "Departures"] : ["Przyloty", "Arrivals"], heads: { time: "Czas", dest: "Kierunek", fl: "Lot", gate: "Wyjście", st: "Uwagi" } },
  bud: { name: "Budapest", cls: "tb-bud", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Indulás", "Departures"] : ["Érkezés", "Arrivals"] },
  aena: { name: "Aena (Spain)", cls: "tb-aena", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Salidas", "Departures"] : ["Llegadas", "Arrivals"], heads: { time: "Hora", dest: "Destino", fl: "Vuelo", gate: "Puerta", st: "Observaciones" },
    tr: { "Boarding": "Embarcando", "Go to gate": "Puerta", "Gate open": "Puerta abierta", "Final call": "Último aviso", "Gate closed": "Cerrado", "Departed": "Despegado", "Landed": "Aterrizado", "Delayed": "Retrasado", "Cancelled": "Cancelado", "Expected": "Estimado", "Scheduled": "Programado", "On time": "En hora" } },
  swedavia: { name: "Swedavia (ARN/GOT)", cls: "tb-swe", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Avgångar", "Departures"] : ["Ankomster", "Arrivals"], heads: { time: "Tid", dest: "Till", fl: "Flyg", gate: "Gate", st: "Info" } },
  finavia: { name: "Finavia (HEL)", cls: "tb-fin", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Lähtevät", "Departures"] : ["Saapuvat", "Arrivals"], heads: { time: "Aika", dest: "Kohde", fl: "Lento", gate: "Portti", st: "Tila" } },
  cph: { name: "Copenhagen (light LCD)", cls: "tb-cph", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Afgange", "Departures"] : ["Ankomster", "Arrivals"] },
  bru: { name: "Brussels", cls: "tb-bru", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Departures", "Vertrek · Départs"] : ["Arrivals", "Aankomst · Arrivées"] },
  ana: { name: "Portugal (ANA)", cls: "tb-ana", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Partidas", "Departures"] : ["Chegadas", "Arrivals"] },
  ita: { name: "Italy (split-flap)", cls: "tb-solari tb-ita", cols: ["fl", "dest", "time", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Partenze", "Departures"] : ["Arrivi", "Arrivals"] },
  adria: { name: "Adriatic (HR/SI)", cls: "tb-adria", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Odlasci", "Departures"] : ["Dolasci", "Arrivals"] },
  kef: { name: "Keflavik", cls: "tb-kef", cols: ["time", "dest", "fl", "gate", "st"], clock: "top", title: d => d === "dep" ? ["Brottfarir", "Departures"] : ["Komur", "Arrivals"] },
  led: { name: "Classic amber LED", cls: "tb-led", cols: ["time", "fl", "dest", "gate", "st"], panels: 2, clock: "bottom", title: d => d === "dep" ? ["Départs", "Departures"] : ["Arrivées", "Arrivals"] },
};
const NORDIC = /^(OSL|BGO|TRD|SVG|TOS|BOO|AES|KRS|HAU|EVE|ALF|BDU|MOL|KSU|LKL|HFT|VDS|KKN|ANX|SSJ|MQN|FRO|SOG|HOV|ORW|SDN|FDE|RRS|BNN|MJF|RVK|VAW|BVG|SKN|SVJ|LKN|VRY|RET|NVK|HAA|BJF|MEH|OSY|NTB|SOJ)$/;
const UKREG = /^(LTN|LCY|SEN|BRS|NCL|LBA|LPL|BOH|EXT|NQY|NWI|MME|HUY|DSA|BLK|CAX|ISC|LEQ|BZZ|OXF|BQH|FAB|ESH|LYX|QUG|CWL|VLY|INV|PIK|DND|SYY|KOI|LSI|BRR|BEB|TRE|ILY|CAL|WIC|LWK|NRL|PPW|SOY|WRY|EOI|FIE|FOA|COL|CSA|OUK|SNN|NOC|KIR|WAT|SXL|IOR|CFN|LDY)$/;
const BYC: Record<string, string> = { Germany: "ger", Austria: "vie", Switzerland: "zrh", Liechtenstein: "zrh", Poland: "waw", Czechia: "prg", "Czech Republic": "prg", Slovakia: "prg", Hungary: "bud", Slovenia: "adria", Croatia: "adria", Spain: "aena", Sweden: "swedavia", Finland: "finavia", Norway: "avinor", Denmark: "cph", Belgium: "bru", Portugal: "ana", Italy: "ita", Iceland: "kef", France: "cdg", Netherlands: "ams", Ireland: "daa", "United Kingdom": "regional", Australia: "syd" };
export const autoTheme = (iata: string, country?: string) => iata === "KRK" ? "krk" : iata === "MUC" ? "muc" : iata === "BER" ? "ber" : iata === "ZRH" || iata === "GVA" || iata === "BSL" ? "zrh" : iata === "VIE" ? "vie" : iata === "PRG" ? "prg" : iata === "WAW" ? "waw" : iata === "BUD" ? "bud" : iata === "CPH" ? "cph" : iata === "BRU" ? "bru" : iata === "KEF" ? "kef" : /^(ARN|GOT)$/.test(iata) ? "swedavia" : iata === "HEL" ? "finavia" :
  iata === "LGW" ? "lgw" : iata === "EDI" ? "edi" : /^(GLA|ABZ|SOU)$/.test(iata) ? "ags" : iata === "BHX" ? "bhx" : /^(DUB|ORK)$/.test(iata) ? "daa" : /^(BFS|BHD)$/.test(iata) ? "bel" : /^(JER|GCI|IOM|ACI)$/.test(iata) ? "isl" : UKREG.test(iata) ? "regional" : /^(MAN|STN|EMA)$/.test(iata) ? "mag" : iata === "LHR" ? "lhr" : iata === "FRA" ? "fra" : NORDIC.test(iata) ? "avinor" : /^(SYD|MEL|BNE)$/.test(iata) ? "syd" : iata === "AMS" ? "ams" : /^(CDG|ORY)$/.test(iata) ? "cdg" : BYC[country || ""] || "led";
const Tile = ({ a }: { a: any }) => <AirlineTile a={a} className="tb-tile" mode={BRAND[a?.iata] ? "white" : "colour"} />;
const HEAD: Record<Col, string> = { tile: "", time: "Time", dest: "Destination", fl: "Flight", logo: "", tag: "Flight", gate: "Gate", term: "Term", st: "Remarks", icon: "", est: "Est" };
const tagColor = (c = "") => { if (BRAND[c]) return BRAND[c]; let h = 0; for (const x of c) h = (h * 31 + x.charCodeAt(0)) % 360; return `hsl(${h} 45% 32%)`; };

// Board remark from the feed's own status text only. Supported vocabularies (checked live):
// MAN/STN/EMA: Wait in Lounge, Go to Gate N, Boarding - Gate N, Final Call - Gate N, Departed, Cancelled; arr: Expected hh:mm, On Approach, Arrived hh:mm, Cancelled.
// FRA: Scheduled, Gate open, Boarding, Closed, Off Block, Departed, Cancelled; arr: Approaching, Delayed departure, Landed, On position, Baggage delivery (finished).
// Avinor: New time (E), Departed (D), Arrived (A), Cancelled (C). Sydney: On Time, Delayed, Departed, Arrived, Cancelled, Diverted.
export function status(f: any, dir: string) {
  if (f.liveOnly) { const alt = f.live?.alt; const a = typeof alt === "number" ? ` · ${Math.round(alt / 100) * 100} ft` : "";
    if (f.status === "approaching") return { txt: (f.statusText || "Approaching").replace(/ — /, " · ") + a, k: "blink ok" };
    if (f.status === "landed") return { txt: "Landed · on ground", k: "ok" };
    if (f.status === "departed") return { txt: "Departed · climbing" + a, k: "dim" };
    return { txt: "On ground", k: "" }; }
  const t = dir === "dep" ? f.dep : f.arr; const d = delay(t); const s = (f.statusText || "").toLowerCase(); const tz = dir === "dep" ? f.origin?.tz : f.destination?.tz;
  const at = (x?: string | null) => x ? " " + fmtT(x, tz) : ""; const g = (f.statusText || "").match(/gate\s+([A-Z]?\d+[A-Z]?)/i)?.[1] || t.gate; const gs = g ? " · Gate " + g : "";
  if (f.status === "cancelled" || /cancel/.test(s)) return { txt: "Cancelled", k: "bad" };
  if (f.status === "diverted" || /divert/.test(s)) return { txt: "Diverted", k: "bad" };
  if (dir === "dep") {
    if (/deallocat/i.test(t.gateAction || f.gateAction || "")) return (d ?? 0) >= 30 ? { txt: "Delayed" + at(t.estimated), k: "warn" } : { txt: "Gate closed", k: "bad" };
    if (/final call/.test(s) || /final call/i.test(t.gateAction || f.gateAction || "")) return { txt: "Final call" + gs, k: "blink bad" };
    if (/flight closing/.test(s)) return { txt: "Flight closing" + gs, k: "blink bad" };
    if (/taxied/.test(s)) return { txt: "Taxied", k: "dim" };
    if (/check-in zone/.test(s) && !/delay/.test(s)) return { txt: "On time · Zone " + (s.match(/zone\s+([a-z0-9]+)/)?.[1] || "").toUpperCase(), k: "" };
    if (/boarding/.test(s)) return { txt: "Boarding" + gs, k: "blink ok" };
    if (/go to gate|gate open/.test(s)) return { txt: (/gate open/.test(s) ? "Gate open" : "Go to gate") + gs, k: "blink ok" };
    if (/closed/.test(s)) return { txt: "Gate closed", k: "bad" };
    if (/off block/.test(s)) return { txt: "Off blocks" + at(t.actual), k: "dim" };
    if (f.status === "departed") return { txt: "Departed" + at(t.actual), k: "dim" };
    if (/lounge/.test(s)) return { txt: (d ?? 0) >= 5 ? "Delayed" + at(t.estimated) : "Wait in lounge", k: (d ?? 0) >= 5 ? "warn" : "" };
  } else {
    if (/baggage delivery finish/.test(s)) return { txt: "Bags delivered", k: "dim" };
    if (/baggage/.test(s)) return { txt: "Baggage" + (f.arr?.baggage ? " belt " + f.arr.baggage : " in hall"), k: "blink ok" };
    if (/on position/.test(s)) return { txt: "At stand" + at(t.actual), k: "ok" };
    if (/bags delivered/.test(s)) return { txt: "Landed" + at(t.actual) + " · bags delivered", k: "dim" };
    if (/on belt|arriving on belt/.test(s)) return { txt: "Landed" + at(t.actual) + " · belt " + (s.match(/belt\s+(\w+)/)?.[1] || ""), k: "ok" };
    if (f.status === "landed") return { txt: "Landed" + at(t.actual), k: "ok" };
    if (/approach/.test(s)) return { txt: "On approach" + at(t.estimated), k: "blink ok" };
    if (/delayed departure/.test(s)) return { txt: "Delayed departure", k: "warn" };
  }
  if (d != null && d >= 5) return { txt: (/new time/.test(s) ? "New time" : dir === "dep" ? "Delayed" : "Expected") + at(t.estimated || t.actual), k: "warn" };
  if (f.status === "delayed" || /delay/.test(s)) return { txt: "Delayed", k: "warn" };
  if (dir === "arr" && t.estimated) return { txt: "Expected" + at(t.estimated), k: "" };
  if (/on time/.test(s)) return { txt: "On time", k: "" };
  return { txt: "Scheduled", k: "" };
}

function Logo({ a }: { a: any }) { return a?.iata ? <AirlineTile a={a} className="tb-logo" mode="colour" /> : null; }

function Flap({ text, w }: { text: string; w: number }) {
  const s = (text || "").toUpperCase().slice(0, w).padEnd(w, " ");
  return <span className="flap">{[...s].map((c, i) => <i key={i + c} style={{ animationDelay: i * 18 + "ms" }}>{c === " " ? "\u00a0" : c}</i>)}</span>;
}

export function TerminalBoard({ iata, dir: dir0, date, onClose, onDir, onOpen }: { iata: string; dir: string; date: string; onClose: () => void; onDir?: (d: string) => void; onOpen?: (f: any) => void }) {
  const [dir, setDir0] = useState(dir0); const setDir = (v: string) => { setDir0(v); onDir?.(v); }; useEffect(() => setDir0(dir0), [dir0]);
  // Exit paths: X button, Esc, browser back / iOS back swipe (history entry), swipe down.
  const closed = useRef(false); const exit = useRef(onClose); exit.current = onClose;
  const close = () => { if (closed.current) return; closed.current = true; if (history.state?.tb) history.back(); else exit.current(); };
  useEffect(() => { history.pushState({ ...(history.state || {}), tb: 1 }, ""); const pop = () => { closed.current = true; exit.current(); }; const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("popstate", pop); addEventListener("keydown", key); return () => { removeEventListener("popstate", pop); removeEventListener("keydown", key); }; }, []);
  const ty = useRef<number | null>(null); const [d, setD] = useState<any>(null); const [theme, setTheme] = useState(() => localStorage.getItem("sk.tb." + iata) || "auto");
  const [page, setPage] = useState(0); const [paused, setPaused] = useState(false); const [now, setNow] = useState(Date.now()); const [upd, setUpd] = useState<number>(0); const [side, setSide] = useState(() => localStorage.getItem("sk.tb.side") || "Airside"); const [sec, setSec] = useState<any>(null);
  const [zoom, setZoom] = useState(() => +(localStorage.getItem("sk.tb.zoom") || 1) || 1); const [vp, setVp] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => { const f = () => setVp({ w: innerWidth, h: innerHeight }); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  const setZ = (z: number) => { z = Math.round(Math.max(0.6, Math.min(1.8, z)) * 100) / 100; setZoom(z); localStorage.setItem("sk.tb.zoom", String(z)); };
  useEffect(() => { api(`/security/${iata}`).then(setSec).catch(() => setSec(null)); }, [iata]);
  const ref = useRef<HTMLDivElement>(null); const th = theme === "auto" || !THEMES[theme] ? autoTheme(iata, d?.airport?.country) : theme;
  const poll = usePoll(() => api(`/board/${iata}?dir=${dir}&date=${date}`).then(r => { setD(r); setUpd(Date.now()); }).catch(e => setD((p: any) => p || { error: e.message })), [iata, dir, date]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { localStorage.setItem("sk.tb." + iata, theme); }, [theme]);
  useEffect(() => { const el = ref.current; el?.requestFullscreen?.().then(() => (screen.orientation as any)?.lock?.("landscape").catch(() => {})).catch(() => {}); return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }; }, []);
  const tz = d?.airport?.tz || "Europe/London";
  const rows = useMemo(() => d?.liveOnly ? (d?.flights || []).filter((f: any) => f.liveOnly).sort((a: any, b: any) => (a.live?.dist ?? 0) - (b.live?.dist ?? 0)) : (d?.flights || []).filter((f: any) => !f.liveOnly).filter((f: any) => { const t = dir === "dep" ? f.dep : f.arr; const b = +new Date(t.actual || t.estimated || t.scheduled); if (b < Date.now() - 90 * 60e3 && f.status !== "landed") return false; return f.status === "cancelled" ? +new Date(t.scheduled) > Date.now() - 30 * 60e3 : (f.status !== "departed" && f.status !== "landed") || b > Date.now() - 15 * 60e3; })
    .sort((a: any, b: any) => ((dir === "dep" ? a.dep : a.arr).scheduled < (dir === "dep" ? b.dep : b.arr).scheduled ? -1 : 1)), [d, dir]);
  const live = d?.liveOnly; const portrait = vp.h > vp.w; const panels = (THEMES[th].panels || 1) > 1 && !portrait ? THEMES[th].panels! : 1;
  // "Fit width": lay the board out at a fixed design width that always has room for every column (status included), then scale it to the screen.
  const designW = panels > 1 ? 1500 : portrait ? 720 : 1100; const s = Math.min(1, vp.w / designW) * zoom; const BAR = 66; const stageH = (vp.h - BAR) / s;
  const rowH = th === "mag" ? 50 : 40; const per = Math.max(6, Math.min(30, Math.floor((stageH - (th === "mag" ? 150 : 110)) / rowH))); const pages = Math.max(1, Math.ceil(rows.length / (per * panels)));
  useEffect(() => { if (paused) return; const t = setInterval(() => setPage(p => (p + 1) % pages), 9000); return () => clearInterval(t); }, [paused, pages]);
  const pg = Math.min(page, pages - 1); void 0; const vis = rows.slice(pg * per, pg * per + per); const solari = th === "solari" || th === "ita";
  const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: th === "led" ? "2-digit" : undefined, timeZone: tz });
  const tt0 = THEMES[th]; const tt: Th = th === "mag" ? { ...tt0, title: d => [d === "dep" ? `${side} Departures` : "Arrivals", ""], heads: { ...tt0.heads, gate: dir === "arr" ? "Belt" : "Gate", dest: dir === "arr" ? "From" : "Destination" } } : tt0;
  const show = vis.length ? rows.slice(pg * per * panels, pg * per * panels + per * panels) : [];
  const trS = (x: string) => { const m = tt.tr; if (!m) return x; for (const k of Object.keys(m).sort((a, b) => b.length - a.length)) if (x.startsWith(k)) return m[k] + x.slice(k.length); return x; };
  const cellOf = (f: any, c: Col, st0: any) => { const st = { ...st0, txt: trS(st0.txt) }; const t = dir === "dep" ? f.dep : f.arr; const ap = dir === "dep" ? f.destination : f.origin; const ltz = (dir === "dep" ? f.origin?.tz : f.destination?.tz) || tz;
    const txt = (v: string, w: number) => solari ? <Flap text={v} w={w} /> : v;
    switch (c) {
      case "time": return f.liveOnly ? txt(f.observedAt ? fmtT(f.observedAt, ltz) : "LIVE", 5) : txt(fmtT(t.scheduled, ltz), 5);
      case "est": { const e = t.actual || t.estimated; return e && e !== t.scheduled ? fmtT(e, ltz) : ""; }
      case "dest": { let n = (tt.local && f.localName) || ap?.city || ap?.name || ap?.iata || ""; if (tt.caps) n = n.toUpperCase(); if (tt.iata && ap?.iata && !n.includes(ap.iata)) n += ` (${ap.iata})`; return tt.iata ? <b>{n}</b> : txt(n, 15); }
      case "fl": return <span className="tb-fl">{!solari && !tt.cols.includes("tile") && !tt.cols.includes("logo") && <Logo a={f.airline} />}{txt(th === "fra" ? f.number.replace(/^([A-Z0-9]{2})/, "$1 ") : f.number, 7)}</span>;
      case "tile": return <Tile a={f.airline} />;
      case "logo": return <span className="tb-fl"><Logo a={f.airline} /></span>;
      case "tag": return <span className="tb-tag" style={{ background: tagColor(f.airline?.iata) }}>{f.number}</span>;
      case "gate": return txt((dir === "dep" ? t.gate : f.arr?.baggage) || "", 4);
      case "term": return t.terminal ? (th === "fra" && !/^T/.test(t.terminal) ? "T" + t.terminal : t.terminal) : "";
      case "icon": return st.k ? <i className={"tb-ico " + st.k} /> : null;
      case "st": return <span className={"tb-st " + st.k}>{solari ? <Flap text={st.txt} w={18} /> : st.txt}</span>;
    } };
  const fraSt = (st: any) => th === "fra" ? <span className={"tb-st " + st.k}>{st.txt}</span> : null;
  const panel = (list: any[], k: number) => <div className="tb-panel" key={k}>
    {["avinor", "ams", "led"].includes(th) && panels > 1 && <div className="tb-ptitle"><b>{tt.title(dir)[0]}</b> <span>{tt.title(dir)[1]}</span>{th === "avinor" && <em>{clock}</em>}</div>}
    <div className="tb-head" style={{ gridTemplateColumns: grid }}>{tt.cols.map(c => <span key={c}>{(dir === "arr" && c === "dest" && (tt.heads || {})[c] ? (tt.heads || {})[c]!.replace("Ziel", "Von").replace("Destination", "From") : dir === "arr" && c === "gate" && (tt.heads || {})[c] ? "Belt" : (tt.heads || {})[c]) ?? (c === "gate" && dir === "arr" ? "Belt" : c === "dest" && dir === "arr" ? "From" : HEAD[c])}</span>)}</div>
    <div className="tb-rows">{list.map((f: any, i: number) => { const st = status(f, dir);
      return <div key={f.id + pg + i + (solari ? st.txt : "")} className={"tb-row " + (i % 2 ? "alt" : "")} style={{ gridTemplateColumns: grid }} onClick={e => { if (!onOpen) return; e.stopPropagation(); closed.current = true; onOpen(f); }}>{tt.cols.map(c => <span key={c} className={"c-" + c}>{cellOf(f, c, st)}</span>)}{fraSt(st)}</div>; })}</div></div>;
  const W: Record<Col, string> = { tile: "minmax(100px,.8fr)", time: th === "mag" ? "84px" : "4.2em", est: "4em", dest: "minmax(5em,1.4fr)", fl: th === "mag" || th === "syd" || solari ? "6.5em" : "11em", logo: "100px", tag: "6em", gate: "3.4em", term: "3.2em", st: solari ? "minmax(19em,1.4fr)" : "minmax(11.5em,1.3fr)", icon: "22px" };
  const grid = (th === "krk" ? (portrait ? "52px 46px 58px 76px minmax(0,2.4fr) 44px minmax(0,1.6fr)" : "64px 60px 70px 90px minmax(0,2.6fr) 60px minmax(0,1.6fr)") : tt.cols.map(c => W[c]).join(" ")) + (th === "fra" ? " minmax(0,1fr)" : "");
  const msg = !d ? "Loading live board…" : d.error ? d.error : live && !rows.length ? `Quiet right now — no ${dir === "dep" ? "departures" : "arrivals"} observed near ${iata} in the last 3h. This airport has no free timetable feed, so this board lists only aircraft our ADS-B receivers have observed. Nothing is shown until something is seen.` : rows.length === 0 ? `No more ${dir === "dep" ? "departures" : "arrivals"} listed for this date.` : "";
  return createPortal(<div ref={ref} className={"tboard " + tt.cls + (paused ? " paused" : "")} onClick={() => setPaused(p => !p)} onTouchStart={e => { ty.current = e.touches[0].clientY; }} onTouchEnd={e => { const y0 = ty.current; ty.current = null; if (y0 != null && y0 < innerHeight * 0.5 && e.changedTouches[0].clientY - y0 > 110) close(); }}>
    <div className="tb-fab" onClick={e => e.stopPropagation()}><div className="tb-seg" role="tablist"><button className={dir === "dep" ? "on" : ""} onClick={() => { setDir("dep"); setPage(0); }}>Departures</button><button className={dir === "arr" ? "on" : ""} onClick={() => { setDir("arr"); setPage(0); }}>Arrivals</button></div>
      <button className="tb-x" aria-label="Close board" onClick={close}><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg></button></div><div className="tb-stage" style={{ ["--per" as any]: per, ["--rh" as any]: rowH + "px", width: vp.w / s, height: stageH, transform: `scale(${s})` }}>
    {(panels === 1 || !["avinor", "ams", "led"].includes(th)) && <div className="tb-top"><div className="tb-title"><b>{tt.title(dir)[0]}</b>{tt.title(dir)[1] && <span>{tt.title(dir)[1]}</span>}</div>
      <div className="tb-ap">{d?.airport?.name || iata}{sec && <span className="tb-sec">{sec.available ? "Security " + sec.queues.filter((q: any) => q.kind === "Departures").map((q: any) => `${q.terminal} ${q.text}`).join(" · ") : "Security: no live queue data"}</span>}</div>{tt.clock === "top" && <div className="tb-clock">{clock}</div>}</div>}
    {msg ? <div className="tb-msg">{msg}</div> : <div className="tb-panels">{Array.from({ length: panels }, (_, k) => panel(show.slice(k * per, k * per + per), k))}</div>}
    {tt.clock !== "top" && <div className={"tb-bclock " + tt.clock}>{clock}</div>}
    <div className="tb-foot"><span>{paused ? "Paused - tap to resume" : `Page ${pg + 1} of ${Math.max(1, Math.ceil(rows.length / (per * panels)))}`}</span>
      {live && <span className="tb-livetag">OBSERVED · live ADS-B traffic · no official schedule feed · times are observed, not scheduled</span>}<span>{upd ? "Updated " + new Date(upd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : ""}{d?.source ? " · " + d.source : ""}{" · next in " + (s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`)(Math.max(0, Math.round((poll.next - now) / 1000)))}{d?.attribution ? " · " + d.attribution + " (schedule every 20 min, free data plan)" : ""}{d?.note ? " · " + d.note : ""}</span>
      <span className="tb-ctl" onClick={e => e.stopPropagation()}>
        <select value={dir} onChange={e => { setDir(e.target.value); setPage(0); }}><option value="dep">Departures</option><option value="arr">Arrivals</option></select>
        {th === "mag" && dir === "dep" && <select value={side} onChange={e => { setSide(e.target.value); localStorage.setItem("sk.tb.side", e.target.value); }}><option>Airside</option><option>Landside</option></select>}
        <select value={theme} onChange={e => setTheme(e.target.value)}><option value="auto">Authentic ({THEMES[autoTheme(iata, d?.airport?.country)].name})</option><option value="led">Classic</option>{Object.entries(THEMES).filter(([k]) => k !== "led").map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        <span className="tb-zoom"><button onClick={() => setZ(zoom - 0.1)} aria-label="Zoom out">A-</button><button className={zoom === 1 ? "on" : ""} onClick={() => setZ(1)}>Fit</button><button onClick={() => setZ(zoom + 0.1)} aria-label="Zoom in">A+</button></span>
        <button onClick={close}>Close</button></span></div>
  </div></div>, document.body);
}
