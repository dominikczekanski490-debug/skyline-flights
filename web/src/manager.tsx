// Airport Manager v2 (Games): a tycoon game. Name and place a made-up airport, pick an operator colour style (Aena-/Fraport-style
// moods as text choices only, no logos), design its signs, screens and terminal, then build it tile by tile on a map (runways, taxiways,
// stands, jet-bridge gates, terminals, security, shops, rail…), sign airline contracts, hire staff, research upgrades, handle storms and
// strikes, and grow from an airfield into a mega hub. The day runs on a clock with speed controls; planes land, taxi, park and push back.
// Simulation lives in ./mgr/sim (pure, unit-tested). 3 save slots on this device. Fan-made game, not affiliated with any operator.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Picto, ArrowSvg, type Arrow } from "./pictos";
import { GateScreen, Fit, DIM, GLABEL, boardData, type GSpec, type GState, type GStyle, type BSpec } from "./gate";
import { TerminalBoard, THEMES } from "./terminal";
import { AirlineTile } from "./brand";
import { AL_NAMES } from "./alnames";
import { saveImage } from "./fids";
import { useBest } from "./games";
import { MgrMap, nightOf } from "./mgr/map";
import { sfx, muted, setMuted } from "./mgr/sfx";
import { W, BUILD, RUNWAY_TILE, LEVELS, RESEARCH, ACH, STAFF_INFO, WAGE, EV_INFO, freshSave, migrate, openAirport, startDay, step, answer, build, buildRunway, bulldoze, hire, sign, decline, dropContract, research, borrow, repay, assign, canBuild, canRunway, bdef, usableStands, taxiPath, isStand, standName, stars, hm, count, runwayCap, secRate, chkRate, turnMin, wagesOf, upkeepOf, loanMax, meets, qWait, nextLevel, planDay, PH_LABEL, rng as rngOf, type Save, type Tile, type Rot, type FX, type Ev, type Contract, type Staff } from "./mgr/sim";
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
function makePax(flights: CiFl[]): Pax { const n = NAMES[rnd(NAMES.length)]; const f = flights[rnd(Math.max(1, flights.length))] || { city: "Dublin", num: "FR123" };
  const twist = rnd(10); return { name: n, ppName: twist === 0 ? NAMES[(NAMES.indexOf(n) + 3) % NAMES.length] : n, exp: twist === 1 ? -1 - rnd(300) : 60 + rnd(2000), bag: Math.round((14 + Math.random() * 14) * 10) / 10, seatWant: Math.random() < .5 ? "window" : "aisle", dest: f.city, num: f.num }; }
type CiFl = { city: string; num: string };
function CheckIn({ s, flights, gate, done }: { s: Save; flights: CiFl[]; gate: string; done: (money: number, happy: number) => void }) {
  const [i, setI] = useState(0); const [p, setP] = useState(() => makePax(flights)); const [step, setStep] = useState(0); const [seat, setSeat] = useState(""); const [log, setLog] = useState<string[]>([]); const [tot, setTot] = useState({ m: 0, h: 0 });
  const ok = p.ppName === p.name && p.exp > 0; const over = p.bag > 23;
  const verdict = (deny: boolean) => { const right = deny === !ok; const m = right ? (deny ? 10 : 25) : -30; const h = right ? 2 : -5; setTot(t => ({ m: t.m + m, h: t.h + h })); setLog(l => [...l, right ? (deny ? "✓ Right call: the passport wasn't valid for travel" : "✓ Passport checked") : deny ? "✗ That passport was fine" : "✗ The passport had a problem (" + (p.exp <= 0 ? "expired" : "name doesn't match") + ")"]); if (deny) nextPax(); else setStep(1); };
  const bagDo = (fee: boolean) => { const right = fee === over; setTot(t => ({ m: t.m + (right ? (fee ? 45 : 5) : -15), h: t.h + (right ? 1 : -3) })); setLog(l => [...l, right ? (over ? "✓ Overweight bag fee charged" : "✓ Bag tagged") : over ? "✗ The bag was over 23 kg" : "✗ No fee needed under 23 kg"]); setStep(2); };
  const seatDo = (x: string) => { setSeat(x); const win = /[AF]$/.test(x), ais = /[CD]$/.test(x); const right = p.seatWant === "window" ? win : ais; setTot(t => ({ m: t.m, h: t.h + (right ? 3 : -2) })); setLog(l => [...l, right ? `✓ ${p.seatWant} seat ${x}` : `✗ They asked for ${p.seatWant}`]); setStep(3); };
  const nextPax = () => { if (i + 1 >= 5) { setStep(9); return; } setI(i + 1); setP(makePax(flights)); setStep(0); setSeat(""); };
  const L = s.look;
  if (step === 9) return <div className="mg-ci"><b>Desk closed</b><p>{log.filter(x => x.startsWith("✓")).length} of {log.length} right · {tot.m >= 0 ? "+" : ""}£{tot.m} · happiness {tot.h >= 0 ? "+" : ""}{tot.h}</p><button className="gp-btn pri" onClick={() => done(tot.m, tot.h)}>Back to the airport</button></div>;
  return <div className="mg-ci"><div className="mg-ci-top"><span>Passenger {i + 1}/5</span><span>£{tot.m} · 🙂{tot.h}</span></div>
    <div className="mg-ci-card"><div><small>BOOKING</small><b>{p.name}</b><span>{p.num} to {p.dest}</span><span>Wants a {p.seatWant} seat</span></div>
      <div className="mg-pp"><small>PASSPORT</small><b>{p.ppName}</b><span className={p.exp <= 0 ? "bad" : ""}>Expires {new Date(Date.now() + p.exp * 864e5).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span></div></div>
    {step === 0 && <div className="mg-ci-q"><p>Check the passport against the booking.</p><div className="gp-ctl"><button className="gp-btn pri" onClick={() => verdict(false)}>✓ Accept</button><button className="gp-btn" onClick={() => verdict(true)}>✗ Refuse</button></div></div>}
    {step === 1 && <div className="mg-ci-q"><div className="mg-scale"><span>🧳</span><b>{p.bag.toFixed(1)} kg</b><small>limit 23 kg</small></div><div className="gp-ctl"><button className="gp-btn pri" onClick={() => bagDo(false)}>Tag the bag</button><button className="gp-btn" onClick={() => bagDo(true)}>Charge overweight fee</button></div></div>}
    {step === 2 && <div className="mg-ci-q"><p>Pick a seat (A & F window · C & D aisle)</p><div className="mg-seats">{[12, 13, 14].map(r => <div key={r}>{["A", "B", "C", "", "D", "E", "F"].map((c, k) => c ? <button key={k} onClick={() => seatDo(r + c)}>{r}{c}</button> : <i key={k} />)}</div>)}</div></div>}
    {step === 3 && <div className="mg-ci-q"><div className="mg-bp" style={{ ["--acc" as any]: L.acc, background: L.bg, color: L.fg, fontFamily: FONTS[L.font][1] }}><div><small>BOARDING PASS · {s.name || "Your Airport"}</small><b>{p.name.toUpperCase()}</b></div>
      <div className="mg-bp-g"><span><small>FLIGHT</small>{p.num}</span><span><small>TO</small>{p.dest}</span><span><small>SEAT</small>{seat}</span><span><small>GATE</small>{gate}</span></div><i className="mg-bp-bar" /></div>
      <button className="gp-btn pri" onClick={nextPax}>🖨️ Print & next passenger</button></div>}
    <ul className="mg-log">{log.slice(-3).map((x, k) => <li key={k} className={x.startsWith("✓") ? "ok" : "bad"}>{x}</li>)}</ul></div>;
}

// ---------- setup wizard ----------
function Setup({ s, set, done, playing }: { s: Save; set: (p: Partial<Save>) => void; done: () => void; playing: boolean }) {
  const r = reg(s); const step = s.step; const steps = ["Name", "Location", "Operator", "Signs", "Screens & terminal"];
  const go = (d: number) => set({ step: Math.max(0, Math.min(steps.length - 1, step + d)) });
  const look = (p: Partial<Look>) => set({ look: { ...s.look, ...p } });
  const canNext = step !== 0 || (s.name.trim().length > 1 && /^[A-Z]{3}$/.test(s.code));
  return <div className="mg-setup"><div className="mg-steps">{steps.map((n, k) => <span key={n} className={k === step ? "on" : k < step ? "done" : ""}>{k + 1}. {n}</span>)}</div>
    {step === 0 && <div className="gsx-grid"><label className="gsx-f"><span>Airport name</span><input value={s.name} maxLength={28} placeholder="e.g. Skyline International" onChange={e => set({ name: e.target.value })} /></label>
      <label className="gsx-f"><span>Three-letter code</span><input value={s.code} maxLength={3} placeholder="SKY" onChange={e => set({ code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></label><p className="faint xs">A made-up airport: pick any name and code you like.</p></div>}
    {step === 1 && <><div className="mg-map" role="radiogroup" aria-label="Where to build">{REGIONS.map(x => <button key={x.k} role="radio" aria-checked={s.region === x.k} className={s.region === x.k ? "on" : ""} style={{ left: x.x + "%", top: x.y + "%" }} onClick={() => set({ region: x.k, look: { ...s.look, bi: !!x.lang } })}><i />{x.e}</button>)}</div>
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
    <div className="gp-ctl mg-nav">{step > 0 && <button className="gp-btn" onClick={() => go(-1)}>‹ Back</button>}{step < steps.length - 1 ? <button className="gp-btn pri" disabled={!canNext} onClick={() => go(1)}>Next ›</button> : <button className="gp-btn pri" onClick={done}>{playing ? "✓ Save & back to the airport" : "✈ Open the airport"}</button>}</div></div>;
}

const reg = (s: Save) => REGIONS.find(r => r.k === s.region) || REGIONS[0];
const rnd = (n: number) => Math.floor(Math.random() * n);
const gbp = (n: number) => (n < 0 ? "−£" : "£") + Math.abs(Math.round(n)).toLocaleString("en-GB");
const demoGate = (s: Save, r?: Rot, clock = 600): GSpec => ({ style: s.gstyle as GStyle, gate: r?.stand != null ? standName(s.grid, r.stand) : "A1", al: r?.al || reg(s).als[0], num: r?.num || reg(s).als[0] + "1234", dest: r?.city || reg(s).dests[0], time: hm(r?.dep ?? 615), st: r ? stOf(r, clock) : "boarding", lang: "en", anim: "none", ac: "A320", tz: reg(s).tz });
function stOf(r: Rot, now: number): GState { if (r.ph === "cxl") return "cancelled"; if (["push", "taxiOut", "tkof", "gone"].includes(r.ph)) return "departed"; if (r.delay > 15) return "delayed"; const left = r.dep + r.delay - now; return left > 45 ? "wait" : left > 30 ? "gate" : left > 15 ? "boarding" : left > 8 ? "final" : "closed"; }

// ---------- saves (3 slots on this device; the v1 save is migrated into slot 1) ----------
const OLD_KEY = "sk.games.mgr.v1", SLOT = (n: number) => "sk.games.mgr.v2.slot" + n, CUR = "sk.games.mgr.v2.cur";
const readSlot = (n: number): Save | null => { try { const j = JSON.parse(localStorage.getItem(SLOT(n)) || "null"); return j?.v === 2 ? { ...freshSave(), ...j } : null; } catch { return null; } };
function loadInitial(): [number, Save] { const cur = Number(localStorage.getItem(CUR) || 1) || 1; const s = readSlot(cur); if (s) return [cur, s];
  if (cur === 1) { try { const v1 = JSON.parse(localStorage.getItem(OLD_KEY) || "null"); if (v1?.v === 1) { const m = migrate(v1); localStorage.setItem(SLOT(1), JSON.stringify(m)); return [1, m]; } } catch { /* ignore */ } }
  return [cur, freshSave()]; }

type Tool = "look" | Tile | "rw" | "bull";
type Toast = { id: number; txt: string; k: string };
type Tab = "map" | "flights" | "airlines" | "staff" | "tech" | "money" | "goals" | "board" | "signs" | "desk" | "saves";
const TABS: [Tab, string][] = [["map", "🗺️ Map"], ["flights", "✈️ Flights"], ["airlines", "🤝 Airlines"], ["staff", "👷 Staff"], ["tech", "🔬 Upgrades"], ["money", "💷 Money"], ["goals", "🏆 Goals"], ["board", "🖥️ Board"], ["signs", "🪧 Signs"], ["desk", "🛄 Check-in"], ["saves", "💾 Saves"]];
const MOOD = (m: number) => m >= 80 ? "😄" : m >= 65 ? "🙂" : m >= 50 ? "😐" : m >= 35 ? "😟" : "😡";
const Mgr3D = lazy(() => import("./mgr3d"));

export function AirportManager() {
  const init = useMemo(loadInitial, []); const [slot, setSlot] = useState(init[0]); const [s, setS] = useState<Save>(init[1]);
  const sRef = useRef(s); sRef.current = s; const [, report] = useBest("manager");
  const [tab, setTab] = useState<Tab>("map"); const [tool, setTool] = useState<Tool>("look"); const [sel, setSel] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1); const [toasts, setToasts] = useState<Toast[]>([]); const [floats, setFloats] = useState<{ id: number; i: number; txt: string; k: string }[]>([]);
  const [sum, setSum] = useState<{ fx: FX[] } | null>(null); const [three, setThree] = useState(false); const [mute, setMute] = useState(muted()); const [bump, setBump] = useState(0);
  const idc = useRef(0); const boardRef = useRef<HTMLDivElement>(null); const lastSnd = useRef(0);
  const toast = (txt: string, k = "info") => { const id = ++idc.current; setToasts(t => [...t.slice(-2), { id, txt, k }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200); };
  const float = (i: number, txt: string, k = "cash") => { const id = ++idc.current; setFloats(f => [...f.slice(-5), { id, i, txt, k }]); setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1400); };
  const apply = (r: Save | string, ok?: string, snd: keyof typeof sfx = "click") => { if (typeof r === "string") { toast(r, "bad"); sfx.bad(); return false; } setS(r); setBump(b => b + 1); sfx[snd](); if (ok) toast(ok, "ok"); return true; };
  // persist (debounced) + on hide
  useEffect(() => { const t = setTimeout(() => { localStorage.setItem(SLOT(slot), JSON.stringify(s)); localStorage.setItem(CUR, String(slot)); }, 1200); return () => clearTimeout(t); }, [s, slot]);
  useEffect(() => { const h = () => { if (document.hidden) localStorage.setItem(SLOT(slot), JSON.stringify(sRef.current)); }; document.addEventListener("visibilitychange", h); return () => { document.removeEventListener("visibilitychange", h); h(); }; }, [slot]);
  const pendingEv = s.phase === "day" ? s.evs.find(e => !e.done && s.clock >= e.at) : undefined;
  const paused = speed === 0 || !!pendingEv || tab === "desk";
  // game loop: 4 ticks a second while visible; 1× = 6 game minutes per real second
  useEffect(() => { if (s.phase !== "day" || paused) return; const t = setInterval(() => { if (document.hidden) return; let cur = sRef.current; const all: FX[] = []; let left = 1.5 * speed;
      while (left > 0 && cur.phase === "day") { const d = Math.min(3, left); left -= d; const r = step(cur, d); cur = r.s; all.push(...r.fx); if (cur.evs.some(e => !e.done && cur.clock >= e.at)) break; }
      sRef.current = cur; setS(cur); handleFx(all, cur); }, 250); return () => clearInterval(t); }, [s.phase, paused, speed]);
  const handleFx = (fx: FX[], cur: Save) => { const now = performance.now();
    for (const f of fx) { if (f.k === "cash") { const r = cur.rots.find(x => f.txt?.endsWith(" " + x.num)); if (r?.stand != null) float(r.stand, f.txt!.split(" ")[0]); if (now - lastSnd.current > 400) { sfx.cash(); lastSnd.current = now; } }
      else if ((f.k === "land" || f.k === "tkof") && now - lastSnd.current > 900) { (f.k === "land" ? sfx.land : sfx.whoosh)(); lastSnd.current = now; }
      else if (f.k === "event") sfx.alert(); else if (f.k === "bad") { toast(f.txt || "", "bad"); sfx.bad(); } }
    if (cur.phase === "summary" && sRef.current.phase === "summary" && fx.some(f => ["level", "mission", "ach", "bad", "cash"].includes(f.k))) { setSum({ fx }); report(Math.round(cur.rep)); if (fx.some(f => f.k === "level")) sfx.level(); else sfx.chime(); }
    else if (cur.phase === "summary") { setSum({ fx }); sfx.chime(); } };
  const set = (p: Partial<Save>) => setS(o => ({ ...o, ...p }));
  if (s.stage === "setup") return <div className="mg"><Setup s={s} set={set} playing={false} done={() => { setS(openAirport(s)); sfx.level(); }} /></div>;
  if (s.flags.redesign) return <div className="mg"><Setup s={s} set={set} playing done={() => set({ flags: { ...s.flags, redesign: 0 } })} /></div>;
  const lv = LEVELS[s.level - 1], nx = nextLevel(s); const bestPax = Math.max(0, ...s.hist.map(h => h.pax)); const night = nightOf(s.clock);
  const onTile = (i: number) => { if (tool === "look") { setSel(sel === i ? null : i); sfx.click(); return; } if (tool === "bull") { if (apply(bulldoze(s, i), "Removed (30% refunded)", "pop")) setSel(null); return; }
    if (tool === "rw") { const y = Math.floor(i / W); if (apply(buildRunway(s, y), "New runway open!", "level")) setTool("look"); return; }
    if (apply(build(s, i, tool), bdef(tool)!.n + " built", "build")) { float(i, "−" + gbp(bdef(tool)!.cost).replace("£", "£"), "cost"); } };
  const okTile = tool === "look" ? undefined : tool === "bull" ? (i: number) => s.grid[i] !== "g" && s.grid[i] !== "rw" : tool === "rw" ? (i: number) => !canRunway(s, Math.floor(i / W)) : (i: number) => !canBuild(s, i, tool as Tile);
  const startDayNow = () => { setSum(null); const n = startDay(s); setS(n); sfx.whoosh(); if (speed === 0) setSpeed(1); };
  const today = s.rots; const nextArr = s.phase === "day" ? s.rots.find(r => r.ph === "sched") : undefined; const live = today.filter(r => !["gone", "cxl", "sched"].includes(r.ph));
  const selInfo = sel != null ? <TileInfo s={s} i={sel} clock={s.clock} /> : null;
  return <div className={"mg mg2" + (night > 0.5 ? " night" : "")} data-bump={bump}>
    <div className="mg-hud2">
      <div className="mg-id"><b>{s.name || "My airport"} <small>{s.code}</small></b><span>{lv.n} · Day {s.day}</span></div>
      <div className="mg-kpis"><span title="Rating" className="k-star">{"★".repeat(Math.floor(stars(s)))}{stars(s) % 1 ? "½" : ""}<i>{stars(s).toFixed(1)}</i></span><span className={"k-cash" + (s.money < 0 ? " neg" : "")} key={Math.round(s.money / 50)}>{gbp(s.money)}</span></div>
      <div className="mg-clock"><span className="k-sun">{s.phase === "day" ? <>{night > 0.5 ? "🌙" : night > 0 ? "🌇" : "☀️"} {hm(s.clock)}</> : "🌙 Night"}</span><span className="k-mood" title="Passenger mood">{MOOD(s.mood)} {Math.round(s.mood)}</span>
        <div className="mg-speed" role="group" aria-label="Game speed">{[0, 1, 2, 4].map(v => <button key={v} className={speed === v ? "on" : ""} aria-label={v ? v + "× speed" : "Pause"} onClick={() => { setSpeed(v); sfx.click(); }}>{v === 0 ? "⏸" : v + "×"}</button>)}</div>
        <button className="mg-mute" aria-label={mute ? "Sound on" : "Sound off"} onClick={() => { setMuted(!mute); setMute(!mute); }}>{mute ? "🔇" : "🔊"}</button></div></div>
    <div className="mg-toasts">{toasts.map(t => <div key={t.id} className={"mg-toast " + t.k}>{t.txt}</div>)}</div>
    <div className="gp-seg mg-tabs" role="tablist">{TABS.map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); sfx.click(); }}>{n}{k === "airlines" && s.offers.length ? <em className="mg-badge">{s.offers.length}</em> : null}</button>)}</div>
    {s.phase !== "day" && tab === "map" && <DayCard s={s} fx={sum?.fx} start={startDayNow} />}{s.phase !== "day" && tab !== "map" && tab !== "saves" && <button className="gp-btn pri mg-go mg-gobar" onClick={startDayNow}>▶ Start day {s.day}</button>}
    {tab === "map" && <>
      <MgrMap s={s} clock={s.clock} ok={okTile} onTile={onTile} sel={sel} floats={floats} />
      <div className="mg-live"><span>🛬 {live.filter(r => ["app", "land", "taxiIn"].includes(r.ph)).length}</span><span>🅿️ {live.filter(r => r.ph === "park").length}/{usableStands(s.grid).length}</span><span>🛫 {live.filter(r => ["push", "taxiOut", "tkof"].includes(r.ph)).length}</span><span title="Security wait">🛂 {qWait(s)} min</span>{nextArr && <span className="mg-next">Next: {nextArr.num} {hm(nextArr.arr)}</span>}<button className="mg-3d" onClick={() => setThree(true)}>🧊 3D view</button></div>
      <div className="mg-tools">{([["look", "👆", "Inspect", 0], ["rw", "🛫", "Runway", 0], ...BUILD.map(b => [b.k, b.e, b.n, b.cost, b.lvl]), ["bull", "🚜", "Remove", 0]] as [Tool, string, string, number, number?][]).map(([k, e, n, c, l]) =>
        <button key={k} className={tool === k ? "on" : ""} disabled={!!l && s.level < l} onClick={() => { setTool(tool === k ? "look" : k); sfx.click(); }}><span>{e}</span><b>{n}</b><small>{l && s.level < l ? "Level " + l : c ? gbp(c) : k === "rw" ? gbp(RUNWAY_TILE * W) : ""}</small></button>)}</div>
      <p className="mg-hint">{tool === "look" ? "Tap a tile to inspect it. Pick a building below, then tap a green tile." : tool === "rw" ? "Tap any tile in an empty row to lay a full runway." : tool === "bull" ? "Tap a building to remove it (30% back)." : bdef(tool as Tile)?.sub}</p>
      {selInfo}</>}
    {tab === "flights" && <Flights s={s} apply={apply} />}
    {tab === "airlines" && <Airlines s={s} apply={apply} />}
    {tab === "staff" && <StaffTab s={s} apply={apply} />}
    {tab === "tech" && <Tech s={s} apply={apply} />}
    {tab === "money" && <Money s={s} apply={apply} />}
    {tab === "goals" && <Goals s={s} bestPax={bestPax} nx={nx} />}
    {tab === "board" && <BoardTab s={s} set={set} boardRef={boardRef} />}
    {tab === "signs" && <><MgrSign s={s} rows={SIGN_ROWS} /><div className="gp-ctl"><button className="gp-btn" onClick={() => set({ flags: { ...s.flags, redesign: 1 }, step: 3 })}>✏️ Redesign signs & screens</button></div><TermBg k={s.term}><div className="mg-hall"><MgrSign s={s} rows={SIGN_ROWS.slice(0, 2)} /></div></TermBg></>}
    {tab === "desk" && <><p className="mg-hint">The clock is paused while you work the desk. Good work raises passenger mood.</p><CheckIn s={s} gate={usableStands(s.grid)[0] != null ? standName(s.grid, usableStands(s.grid)[0]) : "A1"} flights={(today.length ? today : planDay(s, Math.random)).map(r => ({ city: r.city, num: r.num }))} done={(m, h) => { set({ money: s.money + m, mood: Math.max(0, Math.min(100, s.mood + h)) }); sfx.cash(); setTab("map"); }} /></>}
    {tab === "saves" && <Saves slot={slot} s={s} pick={(n, ns) => { localStorage.setItem(SLOT(slot), JSON.stringify(s)); setSlot(n); setS(ns); setSum(null); setSel(null); localStorage.setItem(CUR, String(n)); sfx.chime(); }} />}
    {pendingEv && <EventCard e={pendingEv} s={s} pick={c => { setS(answer(s, pendingEv.id, c)); sfx.click(); }} />}
    {three && <Suspense fallback={<div className="mg3d-wrap"><p className="mg3d-load">Loading 3D…</p></div>}><Mgr3D s={s} close={() => setThree(false)} /></Suspense>}
    <p className="faint xs mt8">Airport Manager is a fan-made game: a made-up airport and made-up game numbers, no real operator logos. Progress is saved on this device.</p></div>;
}

function TileInfo({ s, i, clock }: { s: Save; i: number; clock: number }) { const t = s.grid[i]; const d = bdef(t); const at = s.rots.filter(r => r.stand === i && !["gone", "cxl"].includes(r.ph));
  const name = t === "g" ? "Grass" : t === "rw" ? "Runway" : d?.n || t; return <div className="mg-tinfo"><b>{d?.e || (t === "rw" ? "🛫" : "🌱")} {name}{isStand(t) ? " " + standName(s.grid, i) : ""}</b>
    <span>{d ? `Upkeep ${gbp(d.upkeep)}/day · ${d.sub}` : t === "rw" ? `${Math.round(runwayCap(s))} take-offs and landings an hour across your runways` : "Empty land: pick a building to build here."}</span>
    {isStand(t) && <span>{at.length ? at.map(r => `${r.num} ${hm(r.arr)}–${hm(r.dep + r.delay)} (${PH_LABEL[r.ph]})`).join(" · ") : "No flights planned here right now"}{!taxiPath(s.grid, i).length ? " · ⚠️ not connected to a runway" : ""}</span>}{void clock}</div>; }

function DayCard({ s, fx, start }: { s: Save; fx?: FX[]; start: () => void }) { const h = s.hist.at(-1); const ev = (fx || []).filter(f => ["level", "mission", "ach", "bad", "cash"].includes(f.k) && f.txt);
  return <div className="mg-day"><div className="mg-day-h"><b>{h ? `Day ${h.d} done` : "Your airport is ready"}</b><button className="gp-btn pri mg-go" onClick={start}>▶ Start day {s.day}</button></div>
    {h ? <div className="mg-sum-g"><span><small>FLIGHTS</small>{h.flights}</span><span><small>PASSENGERS</small>{h.pax.toLocaleString("en-GB")}</span><span><small>ON TIME</small>{h.ontime}%</span><span><small>PROFIT</small><em className={h.profit < 0 ? "neg" : "pos"}>{gbp(h.profit)}</em></span><span><small>MOOD</small>{MOOD(h.mood)} {h.mood}</span><span><small>CANCELLED</small>{h.cxl}</span>{!!h.lost && <span><small>LOST BAGS</small><em className="neg">{h.lost}</em></span>}</div>
      : <p className="mg-hint">Two airlines have signed up. Tap Start to run the first day, build stands and shops on the map, and check the Airlines tab for new offers.</p>}
    {ev.length > 0 && <ul className="mg-fxl">{ev.map((f, k) => <li key={k} className={f.k}>{f.txt}</li>)}</ul>}
    {!!h?.lost && <p className="mg-hint">🧳 Bags went missing: build a baggage hall next to the terminal (lost bags hurt your rating).</p>}{s.reviews[0] && h && <p className="mg-rev">“{s.reviews[0].t.replace(/^Day \d+: /, "")}” <span>{"★".repeat(s.reviews[0].s)}</span></p>}</div>; }

function EventCard({ e, s, pick }: { e: Ev; s: Save; pick: (c: string) => void }) { const I = EV_INFO[e.k];
  return <div className="mg-modal"><div className="mg-evc"><span className="mg-eve">{I.e}</span><b>{I.n}</b><p>{I.txt}</p><div className="mg-evch">{I.ch.map(([k, n, c]) => <button key={k} className="gp-btn" disabled={c > s.money} onClick={() => pick(k)}>{n}</button>)}</div><small>{hm(e.at)} · the game is paused</small></div></div>; }

function Flights({ s, apply }: { s: Save; apply: (r: Save | string, ok?: string) => boolean }) { const stands = usableStands(s.grid);
  const rows = s.rots.filter(r => r.ph !== "gone").concat(s.rots.filter(r => r.ph === "gone").slice(-4));
  return <div className="mg-fls"><div className="mg-row"><span>Auto-assign stands</span><div className="gp-seg sm"><button className={s.auto ? "on" : ""} onClick={() => apply({ ...s, auto: true })}>On</button><button className={!s.auto ? "on" : ""} onClick={() => apply({ ...s, auto: false })}>Off (I'll do it)</button></div></div>
    {!rows.length && <p className="mg-hint">No flights yet today. Start the day, or sign airlines in the Airlines tab.</p>}
    {rows.map(r => <div key={r.id} className={"mg-fl2 ph-" + r.ph + (r.delay > 15 ? " late" : "")}><AirlineTile a={{ iata: r.al || "XX", name: AL_NAMES[r.al] || r.al || "Private" }} mode="colour" />
      <div className="mg-fl2-m"><b>{r.num} {r.vip ? "🎩" : r.div ? "↪️" : ""}</b><span>{r.city} · {r.pax} pax</span></div><div className="mg-fl2-t"><span>{hm(r.arr)} → {hm(r.dep)}</span><em>{PH_LABEL[r.ph]}{r.delay > 0 ? ` +${Math.round(r.delay)}m` : ""}</em></div>
      <select aria-label={"Stand for " + r.num} value={r.stand ?? ""} disabled={["taxiIn", "park", "push", "taxiOut", "tkof", "gone", "cxl"].includes(r.ph)} onChange={e => apply(assign(s, r.id, Number(e.target.value)), "Stand set")}><option value="" disabled>Stand…</option>{stands.map(i => <option key={i} value={i}>{standName(s.grid, i)}</option>)}</select></div>)}</div>; }

function Airlines({ s, apply }: { s: Save; apply: (r: Save | string, ok?: string, snd?: any) => boolean }) {
  const D = (c: Contract) => [c.demand.ontime && `${c.demand.ontime}% on time`, c.demand.gates && `${c.demand.gates} jet-bridge gates`, c.demand.stars && `${c.demand.stars}★`].filter(Boolean).join(" · ") || "No special demands";
  return <div className="mg-als"><h3 className="gsx-h">Offers</h3>{!s.offers.length && <p className="mg-hint">New offers arrive at the end of each day.</p>}
    {s.offers.map(c => { const miss = meets(s, c); return <div key={c.id} className="mg-con offer"><AirlineTile a={{ iata: c.al, name: AL_NAMES[c.al] || c.al }} mode="colour" /><div><b>{AL_NAMES[c.al] || c.al}</b><span>{c.perDay} flights a day · ~{c.pax} pax · {gbp(c.fee)} per flight · {c.days} days</span><small>{D(c)}{miss.length ? " · ⚠️ needs " + miss.join(", ") : ""}</small></div>
      <div className="mg-con-b"><button className="gp-btn pri" disabled={!!miss.length} onClick={() => apply(sign(s, c.id), `${AL_NAMES[c.al] || c.al} signed!`, "cash")}>Sign</button><button className="gp-btn" onClick={() => apply(decline(s, c.id))}>✕</button></div></div>; })}
    <h3 className="gsx-h">Your airlines ({s.contracts.length})</h3>{s.contracts.map(c => <div key={c.id} className="mg-con"><AirlineTile a={{ iata: c.al, name: AL_NAMES[c.al] || c.al }} mode="colour" /><div><b>{AL_NAMES[c.al] || c.al}</b><span>{c.perDay}/day · {gbp(c.fee)} per flight · renews in {c.left} day{c.left === 1 ? "" : "s"}</span><small>{D(c)} · {c.strikes ? "😠".repeat(c.strikes) + " " + c.strikes + "/3 warnings" : "😊 happy"}</small></div>
      <div className="mg-con-b"><button className="gp-btn" onClick={() => { if (confirm(`End the ${AL_NAMES[c.al] || c.al} contract? Your rating drops a little.`)) apply(dropContract(s, c.id)); }}>End</button></div></div>)}
    <p className="faint xs">Airlines warn you when their demands aren't met. Three warnings and they leave (and your rating drops). Fees are game numbers.</p></div>; }

function StaffTab({ s, apply }: { s: Save; apply: (r: Save | string, ok?: string) => boolean }) {
  const meter: Record<keyof Staff, string> = { sec: `${Math.round(secRate(s))} pax/h through ${count(s.grid, "sc") * 2} lanes · queue ${Math.round(s.q)} people (${qWait(s)} min)`, chk: `${Math.round(chkRate(s))} pax/h at the desks`, gnd: `Turnaround ${turnMin(s)} min`, atc: s.grid.includes("tw") ? `Runway capacity ${Math.round(runwayCap(s))} movements/h` : "Build a control tower first" };
  return <div className="mg-staff">{(Object.keys(STAFF_INFO) as (keyof Staff)[]).map(k => <div key={k} className="mg-st"><span className="mg-st-e">{STAFF_INFO[k][1]}</span><div><b>{STAFF_INFO[k][0]}</b><small>{STAFF_INFO[k][2]} · {gbp(WAGE[k])}/day each</small><em>{meter[k]}</em></div>
    <div className="mg-step"><button aria-label={"Fewer " + STAFF_INFO[k][0]} onClick={() => apply(hire(s, k, -1))}>−</button><b>{s.staff[k]}</b><button aria-label={"Hire " + STAFF_INFO[k][0]} onClick={() => apply(hire(s, k, 1))}>＋</button></div></div>)}
    <p className="mg-hint">Wages: {gbp(wagesOf(s))} a day. Upkeep: {gbp(upkeepOf(s))} a day.</p></div>; }

function Tech({ s, apply }: { s: Save; apply: (r: Save | string, ok?: string, snd?: any) => boolean }) { const cur = s.rsch && RESEARCH.find(r => r.id === s.rsch!.id);
  return <div className="mg-tech">{cur && <div className="mg-rs"><b>🔬 Researching {cur.e} {cur.n}</b><div className="mg-bar"><i style={{ width: `${(1 - s.rsch!.left / cur.days) * 100}%` }} /></div><small>Ready after {s.rsch!.left} more day{s.rsch!.left === 1 ? "" : "s"}</small></div>}
    <div className="mg-tgrid">{RESEARCH.map(r => { const done = !!s.research[r.id]; const locked = r.need && !s.research[r.need]; return <button key={r.id} className={"mg-tc" + (done ? " done" : locked ? " locked" : "")} disabled={done || !!s.rsch || !!locked || s.money < r.cost} onClick={() => apply(research(s, r.id), "Research started", "build")}>
      <span>{r.e}</span><b>{r.n}</b><small>{r.sub}</small><em>{done ? "✓ Done" : locked ? "🔒 after " + RESEARCH.find(x => x.id === r.need)!.n : `${gbp(r.cost)} · ${r.days} day${r.days > 1 ? "s" : ""}`}</em></button>; })}</div></div>; }

function Money({ s, apply }: { s: Save; apply: (r: Save | string, ok?: string, snd?: any) => boolean }) { const H2 = s.hist.slice(-14); const mx = Math.max(1, ...H2.map(h => Math.max(h.rev, h.cost))); const h = s.hist.at(-1);
  return <div className="mg-money"><div className="mg-chart"><svg viewBox="0 0 280 120" role="img" aria-label="Revenue and costs for the last days">{H2.map((d, k) => { const x = 8 + k * 19.5; return <g key={d.d}><rect x={x} y={110 - d.rev / mx * 100} width={8} height={d.rev / mx * 100} fill="#4ade80" rx="1.5" /><rect x={x + 8.5} y={110 - d.cost / mx * 100} width={8} height={d.cost / mx * 100} fill="#f87171" rx="1.5" /><text x={x + 8} y={119} fontSize="6" fill="#94a3b8" textAnchor="middle">{d.d}</text></g>; })}
    {!H2.length && <text x={140} y={60} textAnchor="middle" fill="#94a3b8" fontSize="9">Play a day to see your chart</text>}</svg><div className="mg-leg"><span className="g">Revenue</span><span className="r">Costs</span></div></div>
    {h && <div className="mg-book"><div><b>Day {h.d} income</b><span>Airline fees<em>{gbp(h.fees)}</em></span><span>Shops & food<em>{gbp(h.shops)}</em></span><span>Parking<em>{gbp(h.parking)}</em></span></div>
      <div><b>Day {h.d} costs</b><span>Wages<em>{gbp(h.wages)}</em></span><span>Upkeep<em>{gbp(h.upkeep)}</em></span><span>Interest<em>{gbp(h.interest)}</em></span><span>Handling & events<em>{gbp(h.cost - h.wages - h.upkeep - h.interest)}</em></span></div></div>}
    <div className="mg-loan"><b>🏦 Bank loan: {gbp(s.loan)}</b><small>1% interest a day · limit {gbp(loanMax(s))} at your level</small><div className="gp-ctl"><button className="gp-btn" onClick={() => apply(borrow(s, 10000), "Borrowed £10,000", "cash")}>Borrow £10,000</button><button className="gp-btn" disabled={!s.loan} onClick={() => apply(repay(s, 10000), "Repaid", "cash")}>Repay £10,000</button></div></div></div>; }

function Goals({ s, bestPax, nx }: { s: Save; bestPax: number; nx: { n: string; pax: number; stars: number } | null }) {
  return <div className="mg-goals"><div className="mg-lv"><b>🏅 {LEVELS[s.level - 1].n}</b>{nx ? <><small>Next: {nx.n} · best day {bestPax.toLocaleString("en-GB")}/{nx.pax.toLocaleString("en-GB")} passengers and {stars(s)}/{nx.stars}★</small><div className="mg-bar"><i style={{ width: `${Math.min(100, bestPax / nx.pax * 100)}%` }} /></div></> : <small>Top level reached!</small>}
    <div className="mg-lvs">{LEVELS.map((l, k) => <span key={l.n} className={k < s.level ? "on" : ""}>{l.n}</span>)}</div></div>
    <h3 className="gsx-h">Goals</h3>{s.missions.map(m => <div key={m.id} className="mg-mis"><span>🎯</span><b>{m.n}</b><em>+{gbp(m.reward)}</em></div>)}
    <h3 className="gsx-h">Achievements ({s.ach.length}/{ACH.length})</h3><div className="mg-ach">{ACH.map(a => <span key={a.id} className={s.ach.includes(a.id) ? "on" : ""} title={a.n}><i>{a.e}</i>{a.n}</span>)}</div>
    <h3 className="gsx-h">Reviews</h3>{!s.reviews.length && <p className="mg-hint">Passengers write reviews after each day.</p>}{s.reviews.slice(0, 6).map((r, k) => <p key={k} className="mg-rev"><span>{"★".repeat(r.s)}{"☆".repeat(5 - r.s)}</span> {r.t}</p>)}</div>; }

function BoardTab({ s, set, boardRef }: { s: Save; set: (p: Partial<Save>) => void; boardRef: React.RefObject<HTMLDivElement | null> }) {
  const mine = useMemo(() => { try { return (JSON.parse(localStorage.getItem("sk.games.boards") || "[]") as BSpec[]).filter(b => b?.theme && THEMES[b.theme]); } catch { return []; } }, []);
  const [msg, setMsg] = useState(""); const deps = (s.phase === "day" ? s.rots.filter(r => r.ph !== "gone" || s.clock - r.t0 < 30) : planDay(s, rngOf(s.seed + s.day))).slice(0, 14);
  const brd: BSpec = useMemo(() => ({ name: s.name || "My airport", theme: s.board, dir: "dep", anim: false, rows: deps.map(r => ({ t: hm(r.dep), dest: r.city, al: r.al || "XX", num: r.num, gate: r.stand != null ? standName(s.grid, r.stand) : "", st: s.phase !== "day" ? "Scheduled" : r.ph === "cxl" ? "Cancelled" : ["push", "taxiOut", "tkof", "gone"].includes(r.ph) ? "Departed" : r.delay > 15 ? "Delayed" : ({ wait: "Wait in lounge", gate: "Go to gate", boarding: "Boarding", final: "Final call", closed: "Gate closed" } as any)[stOf(r, s.clock)] || "Scheduled", ...(r.delay > 15 ? { est: hm(r.dep + r.delay) } : {}) })) }), [s.rots.length, s.board, s.name, s.phase, s.day, Math.floor(s.clock / 10)]);
  const data = useMemo(() => boardData(brd), [brd]); const next = s.rots.find(r => r.ph === "park");
  return <><div ref={boardRef} className="mg-board"><TerminalBoard key={s.board} iata="XXX" dir="dep" date="" onClose={() => {}} custom={data} theme0={s.board} inline dw={780} /></div>
    <div className="gp-ctl"><select aria-label="Board style" value={s.board} onChange={e => set({ board: e.target.value })}>{mine.length > 0 && <optgroup label="My board designs">{mine.map((b, k) => <option key={"m" + k} value={b.theme}>⭐ {b.name} ({THEMES[b.theme].name})</option>)}</optgroup>}<optgroup label="All styles">{Object.entries(THEMES).filter(([k]) => !["tr", "cy", "mla", "ee"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</optgroup></select>
      <button className="gp-btn" onClick={async () => setMsg(await saveImage(boardRef.current?.querySelector(".tb-stage") as HTMLElement, `${s.code || "airport"}-board.png`))}>📷 Save image</button></div>{msg && <p className="mg-hint">{msg}</p>}
    <p className="faint xs">Live from your game: today's departures with their real game gates and statuses.{mine.length ? " ⭐ = boards you saved in Board studio." : ""}</p>
    <h3 className="gsx-h">Gate screen {next ? "· " + standName(s.grid, next.stand!) : ""}</h3><div className="gp-seg sm">{(["mag", "krk", "lpa", "lhr", "spot"] as GStyle[]).map(k => <button key={k} className={s.gstyle === k ? "on" : ""} onClick={() => set({ gstyle: k })}>{GLABEL[k]}</button>)}</div>
    <div className={"gp-stage mg-gsp " + s.gstyle}><Fit w={DIM[s.gstyle as GStyle][0]} h={DIM[s.gstyle as GStyle][1]}><GateScreen s={demoGate(s, next, s.clock)} /></Fit></div></>; }

function Saves({ slot, s, pick }: { slot: number; s: Save; pick: (n: number, s: Save) => void }) { const [, re] = useState(0);
  return <div className="mg-saves">{[1, 2, 3].map(n => { const x = n === slot ? s : readSlot(n); return <div key={n} className={"mg-slot" + (n === slot ? " on" : "")}><span className="mg-slot-n">{n}</span><div><b>{x && x.stage === "play" ? `${x.name} (${x.code})` : "Empty slot"}</b><small>{x && x.stage === "play" ? `${LEVELS[x.level - 1].n} · Day ${x.day} · ${gbp(x.money)} · ${stars(x)}★` : "Start a new airport here"}</small></div>
    <div className="mg-con-b">{n === slot ? <em>Playing</em> : <button className="gp-btn pri" onClick={() => pick(n, x || freshSave())}>{x ? "Load" : "New"}</button>}{x && n !== slot && <button className="gp-btn" onClick={() => { if (confirm("Delete this saved airport?")) { localStorage.removeItem(SLOT(n)); re(v => v + 1); } }}>🗑</button>}
      {n === slot && <button className="gp-btn" onClick={() => { if (confirm("Start over in this slot? This airport will be deleted.")) pick(n, freshSave()); }}>Restart</button>}</div></div>; })}
    <p className="faint xs">Three airports can be saved on this device. The game saves itself every few seconds.</p></div>; }
