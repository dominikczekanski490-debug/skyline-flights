// Airport Manager (Games): name and place a fictional airport, pick an operator style (Aena- or Fraport-style colours as text
// choices only, no logos), design its signs, gate screens, terminal look and FIDS board, then run it: assign flights to gates,
// handle delays, diversions and gate faults, open/close gates, check passengers in, and spend money/reputation on more gates,
// terminals and airlines. Progress is saved on this device (localStorage "sk.games.mgr.v1"). Fan-made game, not affiliated.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Picto, ArrowSvg, type Arrow } from "./pictos";
import { GateScreen, Fit, DIM, ST, GLABEL, boardData, type GSpec, type GState, type GStyle, type BSpec } from "./gate";
import { TerminalBoard, THEMES } from "./terminal";
import { AirlineTile } from "./brand";
import { AL_NAMES } from "./alnames";
import { saveImage } from "./fids";
import { useBest } from "./games";
import "./manager.css";

// ---------- world ----------
type Region = { k: string; n: string; e: string; x: number; y: number; lang?: [string, string]; als: string[]; dests: string[]; wx: string[]; tz: string };
const REGIONS: Region[] = [
  { k: "uk", n: "North of England", e: "🇬🇧", x: 44, y: 38, als: ["U2", "FR", "LS", "BA", "EI", "EK", "TK"], dests: ["Dublin", "Alicante", "Palma", "Tenerife South", "Amsterdam", "Paris", "Dubai", "Istanbul", "Faro", "Rome"], wx: ["🌧️", "☁️", "🌦️", "☀️", "🌫️"], tz: "Europe/London" },
  { k: "pl", n: "Southern Poland", e: "🇵🇱", x: 63, y: 40, lang: ["pl", "Polski"], als: ["W6", "FR", "LO", "LH", "U2", "TK"], dests: ["London Luton", "Dortmund", "Warsaw", "Munich", "Malaga", "Barcelona", "Larnaca", "Oslo", "Paris", "Rome"], wx: ["❄️", "☁️", "☀️", "🌫️", "🌦️"], tz: "Europe/Warsaw" },
  { k: "es", n: "Canary Islands", e: "🇪🇸", x: 30, y: 74, lang: ["es", "Español"], als: ["VY", "FR", "U2", "IB", "LS", "X3", "BA"], dests: ["Madrid", "Barcelona", "Manchester", "London Gatwick", "Dusseldorf", "Bilbao", "Seville", "Hanover", "Oslo", "Dublin"], wx: ["☀️", "☀️", "🌤️", "💨", "☁️"], tz: "Atlantic/Canary" },
  { k: "gr", n: "Greek islands", e: "🇬🇷", x: 66, y: 62, lang: ["el", "Ελληνικά"], als: ["A3", "FR", "U2", "W6", "DE", "LS", "BA"], dests: ["Athens", "London Gatwick", "Manchester", "Dusseldorf", "Vienna", "Milan", "Tel Aviv", "Amsterdam", "Krakow", "Rome"], wx: ["☀️", "☀️", "🌤️", "💨", "⛈️"], tz: "Europe/Athens" },
  { k: "de", n: "Bavaria", e: "🇩🇪", x: 55, y: 46, lang: ["de", "Deutsch"], als: ["LH", "EW", "FR", "U2", "TK", "EK", "OS"], dests: ["Frankfurt", "Berlin", "Hamburg", "Palma", "Vienna", "London Heathrow", "Istanbul", "Dubai", "Antalya", "Zurich"], wx: ["☁️", "❄️", "☀️", "🌧️", "🌫️"], tz: "Europe/Berlin" },
  { k: "no", n: "Norwegian fjords", e: "🇳🇴", x: 52, y: 22, lang: ["no", "Norsk"], als: ["DY", "SK", "WF", "KL", "LH", "FR"], dests: ["Oslo", "Bergen", "Stavanger", "Tromsø", "Copenhagen", "Amsterdam", "London Gatwick", "Gdansk", "Alicante", "Reykjavik"], wx: ["🌧️", "❄️", "🌫️", "☁️", "💨"], tz: "Europe/Oslo" },
];
/** Sign wording in each region's language (the airport's second language when bilingual signs are on). */
const WORDS: Record<string, Record<string, string>> = {
  dep: { en: "Departures", pl: "Odloty", es: "Salidas", el: "Αναχωρήσεις", de: "Abflug", no: "Avgang" }, arr: { en: "Arrivals", pl: "Przyloty", es: "Llegadas", el: "Αφίξεις", de: "Ankunft", no: "Ankomst" },
  gates: { en: "Gates", pl: "Wyjścia", es: "Puertas", el: "Πύλες", de: "Flugsteige", no: "Gater" }, checkin: { en: "Check-in", pl: "Odprawa", es: "Facturación", el: "Check-in", de: "Check-in", no: "Innsjekking" },
  reclaim: { en: "Baggage reclaim", pl: "Odbiór bagażu", es: "Recogida de equipajes", el: "Παραλαβή αποσκευών", de: "Gepäckausgabe", no: "Bagasjebånd" }, taxi: { en: "Taxis & buses", pl: "Taxi i autobusy", es: "Taxis y autobuses", el: "Ταξί & λεωφορεία", de: "Taxi & Bus", no: "Taxi og buss" },
};
const SIGN_ROWS: [string, string, Arrow][] = [["dep", "plane", "up"], ["gates", "gates", "right"], ["checkin", "checkin", "left"], ["arr", "arrivals", "left"], ["reclaim", "reclaim", "down"], ["taxi", "taxi", "right"]];
type Op = "aena" | "fraport" | "indie";
const OPS: { k: Op; n: string; sub: string; sign: Partial<Look>; board: string; gate: GStyle }[] = [
  { k: "aena", n: "Aena-style", sub: "Spanish network look: bright green accents, clean white text", sign: { bg: "#1f2a24", fg: "#ffffff", acc: "#2fb34a", font: "frutiger", picto: "square" }, board: "aena", gate: "lpa" },
  { k: "fraport", n: "Fraport-style", sub: "Navy panels with lime-green text, like the Greek regional airports", sign: { bg: "#0b2a78", fg: "#c2dc3c", acc: "#45b23a", font: "condensed", picto: "circle" }, board: "fgr", gate: "krk" },
  { k: "indie", n: "Independent", sub: "Your own colours and fonts", sign: {}, board: "mag", gate: "mag" },
];
type Look = { bg: string; fg: string; acc: string; font: "rounded" | "frutiger" | "condensed" | "mono"; picto: "square" | "circle" | "line"; bi: boolean };
const FONTS: Record<Look["font"], [string, string]> = { rounded: ["Rounded", '"Fredoka Variable",ui-rounded,system-ui,sans-serif'], frutiger: ["Airport sans", '"Frutiger","Segoe UI","Inter Variable",Inter,Arial,sans-serif'], condensed: ["Condensed", '"Arial Narrow","Roboto Condensed",Arial,sans-serif'], mono: ["Mono", 'ui-monospace,"SF Mono",Menlo,monospace'] };
const TERMS: { k: string; n: string; e: string }[] = [{ k: "glass", n: "Glass & steel", e: "🏙️" }, { k: "timber", n: "Timber & light", e: "🌲" }, { k: "concrete", n: "Brutalist concrete", e: "🧱" }, { k: "heritage", n: "Heritage hall", e: "🏛️" }];
const PALETTE = ["#111418", "#2b2f36", "#3a3d42", "#0b2a78", "#1f2a24", "#1d4ed8", "#ffd200", "#ffffff", "#c2dc3c", "#b5e61d", "#ff6a13", "#e11d48"];

type Fl = { id: string; num: string; al: string; city: string; kind: "dep" | "arr"; t: number; gate?: string; pax: number; st: "wait" | "gate" | "done" | "late" | "cxl"; div?: boolean };
type Save = { v: 1; stage: "setup" | "play"; step: number; name: string; code: string; region: string; op: Op; look: Look; gstyle: GStyle; term: string; board: string;
  day: number; money: number; rep: number; gates: number; terms: number; als: string[]; closed: string[]; happy: number; best?: number };
const KEY = "sk.games.mgr.v1";
const fresh = (): Save => ({ v: 1, stage: "setup", step: 0, name: "", code: "", region: "uk", op: "indie", look: { bg: "#111418", fg: "#ffd200", acc: "#ffd200", font: "frutiger", picto: "square", bi: false }, gstyle: "mag", term: "glass", board: "mag",
  day: 1, money: 5000, rep: 50, gates: 3, terms: 1, als: [], closed: [], happy: 70 });
const load = (): Save => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s?.v === 1 ? { ...fresh(), ...s } : fresh(); } catch { return fresh(); } };
const gateIds = (s: Save) => Array.from({ length: s.gates }, (_, i) => (s.terms > 1 && i >= 6 ? "B" : "A") + (s.terms > 1 && i >= 6 ? i - 5 : i + 1));
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const rnd = (n: number) => Math.floor(Math.random() * n);
const reg = (s: Save) => REGIONS.find(r => r.k === s.region) || REGIONS[0];
const occ = (f: Fl): [number, number] => f.kind === "dep" ? [f.t - 40, f.t + 10] : [f.t - 5, f.t + 40];
const clash = (a: Fl, b: Fl) => { const [a0, a1] = occ(a), [b0, b1] = occ(b); return a0 < b1 && b0 < a1; };
const UNLOCK_AL = (s: Save) => reg(s).als.filter(a => !s.als.includes(a));
function schedule(s: Save): Fl[] {
  const r = reg(s); const als = s.als.length ? s.als : r.als.slice(0, 2); const n = Math.min(26, 8 + s.gates * 2 + s.als.length * 2);
  return Array.from({ length: n }, (_, i) => { const al = als[rnd(als.length)]; const kind: "dep" | "arr" = i % 2 ? "arr" : "dep"; return { id: "f" + i, num: al + (100 + rnd(8900)), al, city: r.dests[rnd(r.dests.length)], kind, t: 7 * 60 + Math.round((i * (14 * 60) / n + rnd(30)) / 5) * 5, pax: 90 + rnd(100), st: "wait" as const }; }).sort((a, b) => a.t - b.t);
}

// ---------- your airport's sign ----------
export function MgrSign({ s, rows = SIGN_ROWS.slice(0, 3) }: { s: Save; rows?: [string, string, Arrow][] }) {
  const L = s.look; const lang = reg(s).lang; const font = FONTS[L.font][1];
  return <div className={"mg-sign pic-" + L.picto} style={{ background: L.bg, color: L.fg, fontFamily: font, ["--acc" as any]: L.acc }} role="img" aria-label={rows.map(r => WORDS[r[0]].en).join(", ")}>
    <div className="mg-sign-h"><b>{s.name || "Your Airport"}</b><span>{(s.code || "XXX").toUpperCase()}</span></div>
    {rows.map(([w, ic, ar]) => <div key={w} className="mg-sign-r"><span className="mg-pi"><Picto k={ic} /></span><span className="mg-sign-t"><b>{WORDS[w].en}</b>{L.bi && lang && <i>{WORDS[w][lang[0]]}</i>}</span><span className="mg-ar"><ArrowSvg a={ar} w={2.4} /></span></div>)}</div>;
}
const TermBg = ({ k, children }: { k: string; children: ReactNode }) => <div className={"mg-term t-" + k}>{children}</div>;

// ---------- check-in desk mini-game ----------
type Pax = { name: string; ppName: string; exp: number; bag: number; seatWant: "window" | "aisle"; dest: string; num: string };
const NAMES = ["Amelia Clarke", "Jan Nowak", "Lucía García", "Nikos Papadopoulos", "Lena Schmidt", "Ola Nordmann", "Oliver Brown", "Zofia Kowalska", "Mateo López", "Sofia Rossi"];
function makePax(flights: Fl[]): Pax { const n = NAMES[rnd(NAMES.length)]; const f = flights.filter(x => x.kind === "dep")[rnd(Math.max(1, flights.filter(x => x.kind === "dep").length))] || { city: "Dublin", num: "FR123" } as Fl;
  const twist = rnd(10); return { name: n, ppName: twist === 0 ? NAMES[(NAMES.indexOf(n) + 3) % NAMES.length] : n, exp: twist === 1 ? -1 - rnd(300) : 60 + rnd(2000), bag: Math.round((14 + Math.random() * 14) * 10) / 10, seatWant: Math.random() < .5 ? "window" : "aisle", dest: f.city, num: f.num }; }
function CheckIn({ s, flights, done }: { s: Save; flights: Fl[]; done: (money: number, happy: number) => void }) {
  const [i, setI] = useState(0); const [p, setP] = useState(() => makePax(flights)); const [step, setStep] = useState(0); const [seat, setSeat] = useState(""); const [log, setLog] = useState<string[]>([]); const [tot, setTot] = useState({ m: 0, h: 0 });
  const ok = p.ppName === p.name && p.exp > 0; const over = p.bag > 23;
  const verdict = (deny: boolean) => { const right = deny === !ok; const m = right ? (deny ? 10 : 25) : -30; const h = right ? 2 : -5; setTot(t => ({ m: t.m + m, h: t.h + h })); setLog(l => [...l, right ? (deny ? "✓ Right call: the passport wasn't valid for travel" : "✓ Passport checked") : deny ? "✗ That passport was fine" : "✗ The passport had a problem (" + (p.exp <= 0 ? "expired" : "name doesn't match") + ")"]); if (deny) nextPax(); else setStep(1); };
  const bagDo = (fee: boolean) => { const right = fee === over; setTot(t => ({ m: t.m + (right ? (fee ? 45 : 5) : -15), h: t.h + (right ? 1 : -3) })); setLog(l => [...l, right ? (over ? "✓ Overweight bag fee charged" : "✓ Bag tagged") : over ? "✗ The bag was over 23 kg" : "✗ No fee needed under 23 kg"]); setStep(2); };
  const seatDo = (x: string) => { setSeat(x); const win = /[AF]$/.test(x), ais = /[CD]$/.test(x); const right = p.seatWant === "window" ? win : ais; setTot(t => ({ m: t.m, h: t.h + (right ? 3 : -2) })); setLog(l => [...l, right ? `✓ ${p.seatWant} seat ${x}` : `✗ They asked for ${p.seatWant}`]); setStep(3); };
  const nextPax = () => { if (i + 1 >= 5) { setStep(9); return; } setI(i + 1); setP(makePax(flights)); setStep(0); setSeat(""); };
  const L = s.look;
  if (step === 9) return <div className="mg-ci"><b>Desk closed</b><p>{log.filter(x => x.startsWith("✓")).length} of {log.length} right · {tot.m >= 0 ? "+" : ""}£{tot.m} · happiness {tot.h >= 0 ? "+" : ""}{tot.h}</p><button className="gp-btn pri" onClick={() => done(tot.m, tot.h)}>Back to the terminal</button></div>;
  return <div className="mg-ci"><div className="mg-ci-top"><span>Passenger {i + 1}/5</span><span>£{tot.m} · 🙂{tot.h}</span></div>
    <div className="mg-ci-card"><div><small>BOOKING</small><b>{p.name}</b><span>{p.num} to {p.dest}</span><span>Wants a {p.seatWant} seat</span></div>
      <div className="mg-pp"><small>PASSPORT</small><b>{p.ppName}</b><span className={p.exp <= 0 ? "bad" : ""}>Expires {new Date(Date.now() + p.exp * 864e5).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span></div></div>
    {step === 0 && <div className="mg-ci-q"><p>Check the passport against the booking.</p><div className="gp-ctl"><button className="gp-btn pri" onClick={() => verdict(false)}>✓ Accept</button><button className="gp-btn" onClick={() => verdict(true)}>✗ Refuse</button></div></div>}
    {step === 1 && <div className="mg-ci-q"><div className="mg-scale"><span>🧳</span><b>{p.bag.toFixed(1)} kg</b><small>limit 23 kg</small></div><div className="gp-ctl"><button className="gp-btn pri" onClick={() => bagDo(false)}>Tag the bag</button><button className="gp-btn" onClick={() => bagDo(true)}>Charge overweight fee</button></div></div>}
    {step === 2 && <div className="mg-ci-q"><p>Pick a seat (A & F window · C & D aisle)</p><div className="mg-seats">{[12, 13, 14].map(r => <div key={r}>{["A", "B", "C", "", "D", "E", "F"].map((c, k) => c ? <button key={k} onClick={() => seatDo(r + c)}>{r}{c}</button> : <i key={k} />)}</div>)}</div></div>}
    {step === 3 && <div className="mg-ci-q"><div className="mg-bp" style={{ ["--acc" as any]: L.acc, background: L.bg, color: L.fg, fontFamily: FONTS[L.font][1] }}><div><small>BOARDING PASS · {s.name || "Your Airport"}</small><b>{p.name.toUpperCase()}</b></div>
      <div className="mg-bp-g"><span><small>FLIGHT</small>{p.num}</span><span><small>TO</small>{p.dest}</span><span><small>SEAT</small>{seat}</span><span><small>GATE</small>{gateIds(s)[rnd(s.gates)]}</span></div><i className="mg-bp-bar" /></div>
      <button className="gp-btn pri" onClick={nextPax}>🖨️ Print & next passenger</button></div>}
    <ul className="mg-log">{log.slice(-3).map((x, k) => <li key={k} className={x.startsWith("✓") ? "ok" : "bad"}>{x}</li>)}</ul></div>;
}

// ---------- setup wizard ----------
function Setup({ s, set }: { s: Save; set: (p: Partial<Save>) => void }) {
  const r = reg(s); const step = s.step; const steps = ["Name", "Location", "Operator", "Signs", "Screens & terminal"];
  const go = (d: number) => set({ step: Math.max(0, Math.min(steps.length - 1, step + d)) });
  const look = (p: Partial<Look>) => set({ look: { ...s.look, ...p } });
  const canNext = step !== 0 || (s.name.trim().length > 1 && /^[A-Z]{3}$/.test(s.code));
  return <div className="mg-setup"><div className="mg-steps">{steps.map((n, k) => <span key={n} className={k === step ? "on" : k < step ? "done" : ""}>{k + 1}. {n}</span>)}</div>
    {step === 0 && <div className="gsx-grid"><label className="gsx-f"><span>Airport name</span><input value={s.name} maxLength={28} placeholder="e.g. Skyline International" onChange={e => set({ name: e.target.value })} /></label>
      <label className="gsx-f"><span>Three-letter code</span><input value={s.code} maxLength={3} placeholder="SKY" onChange={e => set({ code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></label><p className="faint xs">A made-up airport: pick any name and code you like.</p></div>}
    {step === 1 && <><div className="mg-map" role="radiogroup" aria-label="Where to build">{REGIONS.map(x => <button key={x.k} role="radio" aria-checked={s.region === x.k} className={s.region === x.k ? "on" : ""} style={{ left: x.x + "%", top: x.y + "%" }} onClick={() => set({ region: x.k, als: [], look: { ...s.look, bi: !!x.lang } })}><i />{x.e}</button>)}</div>
      <div className="mg-reg"><b>{r.e} {r.n}</b><span>Weather: {r.wx.slice(0, 3).join(" ")} · Airlines: {r.als.map(a => AL_NAMES[a] || a).slice(0, 4).join(", ")}…</span><span>Destinations: {r.dests.slice(0, 5).join(", ")}…{r.lang ? ` · Signs can be bilingual (${r.lang[1]})` : ""}</span></div></>}
    {step === 2 && <div className="mg-ops">{OPS.map(o => <button key={o.k} className={s.op === o.k ? "on" : ""} aria-pressed={s.op === o.k} onClick={() => set({ op: o.k, look: { ...s.look, ...o.sign }, board: o.board, gstyle: o.gate })}><b>{o.n}</b><small>{o.sub}</small><span className="mg-sw">{[o.sign.bg || s.look.bg, o.sign.fg || s.look.fg, o.sign.acc || s.look.acc].map((c, k) => <i key={k} style={{ background: c }} />)}</span></button>)}<p className="faint xs">Operator styles are colour moods only: no real operator names on screens and no logos. Fan-made game.</p></div>}
    {step === 3 && <><MgrSign s={s} rows={SIGN_ROWS.slice(0, 4)} />
      <div className="gsx-grid"><div className="gsx-f"><span>Background</span><div className="mg-pal">{PALETTE.map(c => <button key={c} aria-label={c} className={s.look.bg === c ? "on" : ""} style={{ background: c }} onClick={() => look({ bg: c })} />)}</div></div>
        <div className="gsx-f"><span>Text</span><div className="mg-pal">{PALETTE.map(c => <button key={c} aria-label={c} className={s.look.fg === c ? "on" : ""} style={{ background: c }} onClick={() => look({ fg: c })} />)}</div></div>
        <div className="gsx-f"><span>Pictogram colour</span><div className="mg-pal">{PALETTE.map(c => <button key={c} aria-label={c} className={s.look.acc === c ? "on" : ""} style={{ background: c }} onClick={() => look({ acc: c })} />)}</div></div>
        <div className="gsx-f"><span>Font</span><div className="gp-seg sm">{(Object.keys(FONTS) as Look["font"][]).map(k => <button key={k} className={s.look.font === k ? "on" : ""} onClick={() => look({ font: k })}>{FONTS[k][0]}</button>)}</div></div>
        <div className="gsx-f"><span>Pictograms</span><div className="gp-seg sm">{([["square", "Squares"], ["circle", "Circles"], ["line", "Line"]] as const).map(([k, n]) => <button key={k} className={s.look.picto === k ? "on" : ""} onClick={() => look({ picto: k })}>{n}</button>)}</div></div>
        {r.lang && <div className="gsx-f"><span>Bilingual</span><div className="gp-seg sm"><button className={s.look.bi ? "on" : ""} onClick={() => look({ bi: true })}>English + {r.lang[1]}</button><button className={!s.look.bi ? "on" : ""} onClick={() => look({ bi: false })}>English only</button></div></div>}</div></>}
    {step === 4 && <><div className="mg-prev2"><TermBg k={s.term}><div className="mg-gs"><Fit w={DIM[s.gstyle][0]} h={DIM[s.gstyle][1]}><GateScreen s={demoGate(s)} /></Fit></div></TermBg></div>
      <div className="gsx-grid"><div className="gsx-f"><span>Gate screen look</span><div className="gp-seg sm">{(["mag", "krk", "lpa", "spot"] as GStyle[]).map(k => <button key={k} className={s.gstyle === k ? "on" : ""} onClick={() => set({ gstyle: k })}>{k === "mag" ? "Classic dark" : k === "krk" ? "Airline band" : k === "lpa" ? "Gold frame" : "Spotter"}</button>)}</div></div>
        <div className="gsx-f"><span>Terminal look</span><div className="mg-terms">{TERMS.map(t => <button key={t.k} className={s.term === t.k ? "on" : ""} onClick={() => set({ term: t.k })}><span className={"mg-tsw t-" + t.k} />{t.e} {t.n}</button>)}</div></div>
        <label className="gsx-f"><span>Flight board style</span><select value={s.board} onChange={e => set({ board: e.target.value })}>{Object.entries(THEMES).filter(([k]) => !["tr", "cy", "mla", "ee"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label></div></>}
    <div className="gp-ctl mg-nav">{step > 0 && <button className="gp-btn" onClick={() => go(-1)}>‹ Back</button>}{step < steps.length - 1 ? <button className="gp-btn pri" disabled={!canNext} onClick={() => go(1)}>Next ›</button> : <button className="gp-btn pri" onClick={() => set({ stage: "play", als: reg(s).als.slice(0, 2) })}>✈ Open the airport</button>}</div></div>;
}
const demoGate = (s: Save, f?: Fl): GSpec => ({ style: s.gstyle, gate: f?.gate || "A1", al: f?.al || reg(s).als[0], num: f?.num || reg(s).als[0] + "1234", dest: f?.city || reg(s).dests[0], time: hm(f?.t ?? 615), st: f ? stOf(f, 0) : "boarding", lang: s.gstyle === "krk" ? "en" : "en", anim: "none", ac: "A320", tz: reg(s).tz });
function stOf(f: Fl, now: number): GState { if (f.st === "cxl") return "cancelled"; if (f.st === "done") return "departed"; if (f.st === "late") return "delayed"; const left = f.t - now; return left > 45 ? "wait" : left > 30 ? "gate" : left > 15 ? "boarding" : left > 10 ? "final" : "closed"; }

// ---------- the ops day ----------
type Ev = { id: number; txt: string; k: "ok" | "warn" | "bad" | "info" };
export function AirportManager() {
  const [s, setS0] = useState<Save>(load); const set = (p: Partial<Save>) => setS0(o => { const n = { ...o, ...p }; localStorage.setItem(KEY, JSON.stringify(n)); return n; });
  const [, report] = useBest("manager");
  const [tab, setTab] = useState<"ops" | "desk" | "board" | "brand" | "shop">("ops");
  const [fl, setFl] = useState<Fl[]>([]); const [now, setNow] = useState(6 * 60); const [run, setRun] = useState(false); const [pick, setPick] = useState<string | null>(null);
  const [ev, setEv] = useState<Ev[]>([]); const [faults, setFaults] = useState<Record<string, number>>({}); const [sum, setSum] = useState<null | { flights: number; ontime: number; late: number; cxl: number; money: number; rep: number }>(null);
  const [wx, setWx] = useState("☀️"); const evId = useRef(0); const dayMoney = useRef(0); const dayRep = useRef(0); const boardRef = useRef<HTMLDivElement>(null); const [msg, setMsg] = useState("");
  const log = (txt: string, k: Ev["k"] = "info") => setEv(e => [{ id: ++evId.current, txt: `${hm(nowRef.current)} ${txt}`, k }, ...e].slice(0, 30));
  const nowRef = useRef(now); nowRef.current = now; const flRef = useRef(fl); flRef.current = fl;
  const gates = gateIds(s); const openG = gates.filter(g => !s.closed.includes(g) && !(faults[g] > now));
  const startDay = () => { const f = schedule(s); setFl(f); setNow(6 * 60); setSum(null); setEv([]); setFaults({}); dayMoney.current = 0; dayRep.current = 0; const r = reg(s); setWx(r.wx[rnd(r.wx.length)]); setRun(true); setTab("ops"); };
  // One game tick = 5 minutes, every 1.2 s while the day runs and the page is visible (no work in the background).
  useEffect(() => { if (!run) return; const t = setInterval(() => { if (document.hidden) return; tick(); }, 1200); return () => clearInterval(t); }, [run, s.gates, s.closed.join()]);
  const tick = () => {
    const t = nowRef.current + 5; setNow(t); const bad = /🌧️|❄️|🌫️|⛈️|💨/.test(wx) ? 2 : 1;
    let list = flRef.current.map(f => {
      if (f.st === "done" || f.st === "cxl") return f;
      if (f.gate && t >= f.t + (f.kind === "dep" ? 0 : 30)) { const pay = Math.round(f.pax * (f.kind === "dep" ? 6 : 4)); dayMoney.current += pay; dayRep.current += f.st === "late" ? 0 : 1; if (f.st !== "late") log(`${f.num} ${f.kind === "dep" ? "departed" : "arrived"} on time at ${f.gate} · +£${pay}`, "ok"); else log(`${f.num} finally ${f.kind === "dep" ? "departed" : "arrived"} · +£${pay}`, "warn"); return { ...f, st: "done" as const }; }
      if (!f.gate && t >= f.t && f.st === "wait") { dayRep.current -= 2; log(`${f.num} has no gate: delayed, passengers waiting`, "bad"); return { ...f, st: "late" as const, t: f.t + 30 }; }
      if (!f.gate && f.st === "late" && t >= f.t) { dayRep.current -= 5; log(`${f.num} cancelled: no gate in time`, "bad"); return { ...f, st: "cxl" as const }; }
      return f; });
    // random events (bad weather doubles delays)
    const roll = Math.random();
    if (roll < .05 * bad) { const cand = list.filter(f => f.st === "wait" && f.t > t + 20); const f = cand[rnd(cand.length)]; if (f) { const late = 15 + rnd(4) * 10; list = list.map(x => x.id === f.id ? { ...x, t: x.t + late } : x); log(`${f.num} delayed ${late} min (${wx} weather / late inbound)${f.gate ? " — check gate " + f.gate + " is still free" : ""}`, "warn"); } }
    else if (roll < .075) { const g = gates[rnd(gates.length)]; setFaults(F => ({ ...F, [g]: t + 60 })); const hit = list.filter(f => f.gate === g && f.st !== "done" && f.st !== "cxl"); list = list.map(x => x.gate === g && x.st !== "done" && x.st !== "cxl" ? { ...x, gate: undefined } : x); log(`Jet bridge fault at ${g} for an hour${hit.length ? ": move " + hit.map(h => h.num).join(", ") + " to another gate" : ""}`, "bad"); }
    else if (roll < .09) { const r = reg(s); const al = r.als[rnd(r.als.length)]; list = [...list, { id: "d" + t, num: al + (100 + rnd(8900)), al, city: r.dests[rnd(r.dests.length)], kind: "arr", t: t + 25, pax: 120 + rnd(60), st: "wait", div: true }]; log(`Diversion inbound in 25 min: give it a gate for a bonus`, "info"); }
    flRef.current = list; setFl(list);
    if (t >= 22 * 60) endDay();
  };
  const endDay = () => { setRun(false); const L = flRef.current; const done = L.filter(f => f.st === "done").length, cxl = L.filter(f => f.st === "cxl").length, late = L.filter(f => f.st === "late" || (f.st === "wait" && !f.gate)).length;
    const ontime = Math.round(done / Math.max(1, L.length) * 100); const upkeep = (s.gates - s.closed.length) * 150 + (s.terms - 1) * 600; const money = dayMoney.current - upkeep; const rep = Math.max(-20, Math.min(20, dayRep.current + (ontime >= 90 ? 5 : 0)));
    const nr = Math.max(0, Math.min(999, s.rep + rep)); set({ day: s.day + 1, money: s.money + money, rep: nr, happy: Math.max(0, Math.min(100, s.happy + (ontime - 75) / 5)) }); report(nr); setSum({ flights: L.length, ontime, late, cxl, money, rep }); };
  const assign = (g: string) => { if (!pick) return; const f = fl.find(x => x.id === pick); if (!f) return;
    if (!openG.includes(g)) { setMsg(`${g} is closed`); return; }
    const c = fl.find(x => x.id !== f.id && x.gate === g && x.st !== "done" && x.st !== "cxl" && clash(x, f)); if (c) { setMsg(`${g} is busy with ${c.num} at ${hm(c.t)}`); return; }
    setFl(L => L.map(x => x.id === f.id ? { ...x, gate: g } : x)); if (f.div) { dayMoney.current += 300; dayRep.current += 3; log(`Diversion ${f.num} parked at ${g} · +£300 bonus`, "ok"); }
    setPick(null); setMsg(""); };
  const toggleGate = (g: string) => { const open = s.closed.includes(g); if (!open && fl.some(f => f.gate === g && f.st !== "done" && f.st !== "cxl")) { setMsg(`Move the flights off ${g} first`); return; } set({ closed: open ? s.closed.filter(x => x !== g) : [...s.closed, g] }); };
  const r = reg(s); const queue = fl.filter(f => f.st !== "done" && f.st !== "cxl").sort((a, b) => a.t - b.t);
  const brd: BSpec = useMemo(() => ({ name: s.name || "My airport", theme: s.board, dir: "dep", anim: true, rows: (fl.length ? fl : schedule(s)).filter(f => f.kind === "dep").slice(0, 14).map(f => ({ t: hm(f.t), dest: f.city, al: f.al, num: f.num, gate: f.gate || "", st: f.st === "done" ? "Departed" : f.st === "cxl" ? "Cancelled" : f.st === "late" ? "Delayed" : f.gate ? ({ wait: "Wait in lounge", gate: "Go to gate", boarding: "Boarding", final: "Final call", closed: "Gate closed" } as any)[stOf(f, now)] || "Scheduled" : "Scheduled", ...(f.st === "late" ? { est: hm(f.t) } : {}) })) }), [fl, s.board, s.name, now >> 4]);
  const data = useMemo(() => boardData(brd), [brd]);
  if (s.stage === "setup") return <div className="mg"><Setup s={s} set={set} /></div>;
  const unl = UNLOCK_AL(s); const gCost = 2000 + s.gates * 1200; const tCost = 12000; const aCost = 3000 + s.als.length * 1500;
  return <div className="mg">
    <div className="mg-hud"><div><b>{s.name}</b><small>{s.code} · {r.e} {r.n} · Day {s.day}</small></div><div className="mg-stats"><span title="Money">£{s.money.toLocaleString("en-GB")}</span><span title="Reputation">⭐ {s.rep}</span><span title="Passenger happiness">🙂 {Math.round(s.happy)}</span>{run && <span>{wx} {hm(now)}</span>}</div></div>
    <div className="gp-seg mg-tabs" role="tablist">{([["ops", "🛫 Gates"], ["desk", "🧳 Check-in"], ["board", "🖥️ FIDS"], ["brand", "🪧 Signs"], ["shop", "🏗️ Build"]] as const).map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{n}</button>)}</div>
    {tab === "ops" && <>{sum ? <div className="mg-sum"><b>Day {s.day - 1} done</b><div className="mg-sum-g"><span><small>FLIGHTS</small>{sum.flights}</span><span><small>ON TIME</small>{sum.ontime}%</span><span><small>CANCELLED</small>{sum.cxl}</span><span><small>PROFIT</small>{sum.money >= 0 ? "+" : ""}£{sum.money}</span><span><small>REPUTATION</small>{sum.rep >= 0 ? "+" : ""}{sum.rep}</span></div><button className="gp-btn pri" onClick={startDay}>Start day {s.day} ›</button></div>
      : !run ? <div className="mg-sum"><b>Ready for day {s.day}</b><p className="faint">Tap a flight, then tap a free gate. Departures use the gate from 40 min before to 10 min after; arrivals from 5 min before to 40 min after. Unassigned flights get delayed, then cancelled.</p><button className="gp-btn pri" onClick={startDay}>▶ Start the day</button></div> : null}
      {run && <><TermBg k={s.term}><div className="mg-gates">{gates.map(g => { const busy = fl.filter(f => f.gate === g && f.st !== "done" && f.st !== "cxl").sort((a, b) => a.t - b.t); const cur = busy.find(f => { const [a, b] = occ(f); return now >= a && now <= b; }); const closed = s.closed.includes(g); const fault = faults[g] > now;
          return <div key={g} className={"mg-gate" + (closed ? " closed" : fault ? " fault" : cur ? " busy" : "") + (pick ? " can" : "")} onClick={() => assign(g)}><div className="mg-g-scr"><Fit w={DIM[cur ? s.gstyle : "mag"][0]} h={DIM[cur ? s.gstyle : "mag"][1]}><GateScreen s={cur ? { ...demoGate(s, cur), anim: "none" } : { ...demoGate(s), gate: g, idle: true, style: "mag", st: "closed", al: "", num: "", dest: "", time: "", apt: s.name || "My airport" }} /></Fit></div>
            <div className="mg-g-f"><b>{g}</b><span>{closed ? "closed" : fault ? "🔧 fault" : busy.length ? busy.map(b => hm(b.t)).join(" · ") : "free"}</span><button className="mg-mini" onClick={e => { e.stopPropagation(); toggleGate(g); }}>{closed ? "Open" : "Close"}</button></div></div>; })}</div></TermBg>
        {msg && <p className="mg-msg">{msg}</p>}
        <div className="mg-q">{queue.slice(0, 12).map(f => <button key={f.id} className={"mg-fl" + (pick === f.id ? " on" : "") + (f.st === "late" ? " late" : "") + (f.div ? " div" : "")} onClick={() => setPick(pick === f.id ? null : f.id)}>
          <span className="mg-k">{f.kind === "dep" ? "🛫" : "🛬"}</span><AirlineTile a={{ iata: f.al, name: AL_NAMES[f.al] || f.al }} mode="colour" /><b>{f.num}</b><span className="mg-c">{f.city}</span><span>{hm(f.t)}</span><em>{f.gate ? f.gate : f.st === "late" ? "LATE" : f.div ? "DIVERT" : f.t - now < 60 ? "needs gate!" : "—"}</em></button>)}</div>
        <ul className="mg-ev">{ev.slice(0, 6).map(e => <li key={e.id} className={e.k}>{e.txt}</li>)}</ul>
        <div className="gp-ctl"><button className="gp-btn" onClick={() => tick()}>⏩ +5 min</button><button className="gp-btn" onClick={endDay}>End day early</button></div></>}</>}
    {tab === "desk" && <CheckIn s={s} flights={fl.length ? fl : schedule(s)} done={(m, h) => { set({ money: s.money + m, happy: Math.max(0, Math.min(100, s.happy + h)) }); setTab("ops"); }} />}
    {tab === "board" && <><div ref={boardRef} className="mg-board"><TerminalBoard key={s.board} iata="XXX" dir="dep" date="" onClose={() => {}} custom={data} theme0={s.board} inline dw={780} /></div>
      <div className="gp-ctl"><select aria-label="Board style" value={s.board} onChange={e => set({ board: e.target.value })}>{Object.entries(THEMES).filter(([k]) => !["tr", "cy", "mla", "ee"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select><button className="gp-btn" onClick={async () => setMsg(await saveImage(boardRef.current?.querySelector(".tb-stage") as HTMLElement, `${s.name} departures`))}>📷 Image</button>{msg && <span className="faint xs">{msg}</span>}</div>
      <p className="faint xs">Your board lists today's departures from your airport with live statuses from the game.</p>
      <h3 className="gsx-h">Gate screen</h3><div className="gp-seg sm">{(["mag", "krk", "lpa", "lhr", "spot"] as GStyle[]).map(k => <button key={k} className={s.gstyle === k ? "on" : ""} onClick={() => set({ gstyle: k })}>{GLABEL[k]}</button>)}</div>
      <div className={"gp-stage mg-gsp " + s.gstyle}><Fit w={DIM[s.gstyle][0]} h={DIM[s.gstyle][1]}><GateScreen s={demoGate(s, queue[0])} /></Fit></div></>}
    {tab === "brand" && <><MgrSign s={s} rows={SIGN_ROWS} /><div className="gp-ctl"><button className="gp-btn" onClick={() => set({ stage: "setup", step: 3 })}>✏️ Redesign signs & screens</button></div><TermBg k={s.term}><div className="mg-hall"><MgrSign s={s} rows={SIGN_ROWS.slice(0, 2)} /></div></TermBg></>}
    {tab === "shop" && <div className="mg-shop">
      <button disabled={s.money < gCost || s.gates >= s.terms * 6} onClick={() => set({ money: s.money - gCost, gates: s.gates + 1 })}><b>＋ New gate</b><small>{s.gates >= s.terms * 6 ? "Terminal full: build a terminal first" : `£${gCost.toLocaleString("en-GB")} · more flights each day`}</small></button>
      <button disabled={s.money < tCost || s.rep < 70 || s.terms >= 2} onClick={() => set({ money: s.money - tCost, terms: s.terms + 1 })}><b>🏢 Terminal B</b><small>{s.terms >= 2 ? "Built" : `£${tCost.toLocaleString("en-GB")} · needs ⭐70 · room for 6 more gates`}</small></button>
      {unl.slice(0, 3).map(a => <button key={a} disabled={s.money < aCost || s.rep < 40 + s.als.length * 10} onClick={() => set({ money: s.money - aCost, als: [...s.als, a] })}><b><AirlineTile a={{ iata: a, name: AL_NAMES[a] || a }} mode="colour" /> {AL_NAMES[a] || a}</b><small>£{aCost.toLocaleString("en-GB")} · needs ⭐{40 + s.als.length * 10} · new routes</small></button>)}
      <p className="faint xs">Upkeep: £150 per open gate and £600 for Terminal B each day. Close quiet gates to save money.</p>
      <button className="mg-reset" onClick={() => { if (confirm("Start a brand-new airport? This one will be deleted from this device.")) { localStorage.removeItem(KEY); setS0(fresh()); setFl([]); setRun(false); } }}>Start a new airport</button></div>}
    <p className="faint xs mt8">Airport Manager is a fan-made game: made-up airport, no real operator logos. Progress is saved on this device.</p></div>;
}
export const MGR_KEY = KEY; export { ST as MGR_ST };
