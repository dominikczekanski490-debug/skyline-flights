// Gate screens: playful recreations of three real gate-display layouts (MAG Manchester/East Midlands/Stansted,
// Kraków, Heathrow) driven by live board data, plus the Games area (Gate studio, Board studio).
// Original CSS/markup inspired by reference photos; no airport-owned logos are used — only airline wordmarks.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api, fmtT, today } from "./lib";
import { AirlineTile, BRAND, airlineName, hasLogo } from "./brand";
import { LOGOS } from "./logoset";
import { AL_NAMES } from "./alnames";
import { WHITE_LOGOS } from "./assets.gen";
import { status as boardStatus, TerminalBoard, THEMES } from "./terminal";
import { TYPES, regCountry } from "./toolsdata";
import { CC, flag } from "./countries";
import { Kiosk, saveImage, withKtw, ktwFlights } from "./fids";
import { Picto } from "./pictos";
import "./gate.css";

export type GStyle = "mag" | "krk" | "lhr" | "lpa" | "spot";
export const GSTYLES: GStyle[] = ["mag", "krk", "lhr", "lpa", "spot"];
export const GLABEL: Record<GStyle, string> = { mag: "MAN · EMA · STN", krk: "Kraków", lhr: "Heathrow", lpa: "Gran Canaria", spot: "Spotter" };
export type GState = "wait" | "gate" | "pre" | "boarding" | "final" | "closed" | "departed" | "delayed" | "cancelled";
export type GSpec = { style: GStyle; gate: string; al: string; alName?: string; num: string; dest: string; destPl?: string; time: string; est?: string; st: GState; stPl?: string; msg?: string; next?: string; nextPl?: string; lang?: "en" | "pl" | "enpl"; anim?: "live" | "cycle" | "none"; tz?: string; co?: string;
  /** Manchester: gate not in use → "Gate Closed" idle screen (neutral blue band, no flight). */ idle?: boolean; /** Gate-area scene around the screen (wall letter + striped desk). */ scene?: boolean;
  /** Spotter gate: ICAO type, registration, operator country, "rare visitor" note. */ ac?: string; reg?: string; regc?: string; rare?: string; /** Idle band wording (airport name, generic type; no operator logo). */ apt?: string };

export const ST: Record<GState, { en: string; pl: string; mag: string; lhr: string; col: string; lcol: string; msg: string }> = {
  wait: { en: "PLEASE WAIT", pl: "PROSZĘ CZEKAĆ", mag: "Wait in Lounge", lhr: "Please wait", col: "#1d4ed8", lcol: "#ffffff", msg: "Please remain in the seating area. Boarding will begin shortly." },
  gate: { en: "GATE OPEN", pl: "BRAMKA OTWARTA", mag: "Go to Gate", lhr: "Gate open", col: "#f59e0b", lcol: "#ffd34d", msg: "This gate is now open. Please have your boarding pass and passport ready." },
  pre: { en: "PRIORITY BOARDING", pl: "WEJŚCIE PRIORYTETOWE", mag: "Priority Boarding", lhr: "Pre-boarding", col: "#16b34a", lcol: "#5fe35f", msg: "Passengers with young children or those needing assistance to board please come forward" },
  boarding: { en: "BOARDING", pl: "WEJŚCIE NA POKŁAD", mag: "Boarding", lhr: "Boarding", col: "#16b34a", lcol: "#5fe35f", msg: "Boarding now. Please have your boarding pass and passport ready for inspection." },
  final: { en: "FINAL CALL", pl: "OSTATNIE WEZWANIE", mag: "Final Call", lhr: "Final call", col: "#ff1a1f", lcol: "#ff5b5b", msg: "Final call. All remaining passengers please board immediately." },
  closed: { en: "GATE CLOSED", pl: "BRAMKA ZAMKNIĘTA", mag: "Gate Closed", lhr: "Gate closed", col: "#d4161d", lcol: "#ff8a8a", msg: "This gate is now closed." },
  departed: { en: "DEPARTED", pl: "ODLECIAŁ", mag: "Departed", lhr: "Departed", col: "#64748b", lcol: "#c8d2e3", msg: "This flight has departed." },
  delayed: { en: "DELAYED", pl: "OPÓŹNIONY", mag: "Delayed", lhr: "Delayed", col: "#f08c00", lcol: "#ffbf47", msg: "We apologise for the delay. Further information will be shown on this screen." },
  cancelled: { en: "CANCELLED", pl: "ODWOŁANY", mag: "Cancelled", lhr: "Cancelled", col: "#e11d2a", lcol: "#ff6b6b", msg: "This flight has been cancelled. Please contact your airline for assistance." },
};
const CYCLE: GState[] = ["wait", "gate", "pre", "boarding", "final", "closed"];
export const STYLE_NAME: Record<GStyle, string> = { mag: "Manchester · East Midlands · Stansted", krk: "Kraków (EN/PL)", lhr: "Heathrow (portrait)", lpa: "Gran Canaria (DE/EN/ES)", spot: "Planespotting gate" };
/** Gran Canaria gate screen: status bar wording and colour (cyan boarding bar as in the photo). */
export const LPA_ST: Record<GState, [string, string]> = { wait: ["PLEASE WAIT", "#2a56b0"], gate: ["GATE OPEN", "#2fae4f"], pre: ["PRIORITY BOARDING", "#1fb8d6"], boarding: ["BOARDING", "#1fc0e0"], final: ["LAST CALL", "#ff3b1f"], closed: ["GATE CLOSED", "#a01c1c"], departed: ["DEPARTED", "#5b6472"], delayed: ["DELAYED", "#f29a00"], cancelled: ["CANCELLED", "#d11f2a"] };
export const tzFor = (s: { style: GStyle; tz?: string }) => s.tz || (s.style === "krk" ? "Europe/Warsaw" : s.style === "lpa" ? "Atlantic/Canary" : "Europe/London");
export const styleFor = (iata?: string): GStyle => iata === "KRK" ? "krk" : iata === "LHR" ? "lhr" : iata === "LPA" ? "lpa" : "mag";
export const spaced = (n = "") => n.replace(/\s+/g, "").replace(/^([A-Z]{3}(?=\d)|[A-Z0-9]{2})(\d.*)$/, "$1 $2");

/** Map a live flight's board remark to a gate-screen state (from the feed's own status text, see terminal.status). */
export function stateOf(f: any): GState {
  const s = String(boardStatus(f, "dep").txt || "").toLowerCase();
  if (/cancel/.test(s)) return "cancelled"; if (/final call|closing/.test(s)) return "final"; if (/boarding/.test(s)) return "boarding";
  if (/go to gate|gate open/.test(s)) return "gate"; if (/gate closed/.test(s)) return "closed"; if (/departed|pushback|taxi|off block/.test(s)) return "departed";
  if (/delay|new time/.test(s)) return "delayed"; return "wait";
}
const gateOf = (f: any) => String(f?.dep?.gate || (f?.statusText || "").match(/gate\s+([A-Z]?\d+[A-Z]?)/i)?.[1] || "");

/** Gate-screen spec from real board data. Next-flight line = the next later departure listed for the same gate (KRK style). */
export function specFromFlight(f: any, style: GStyle, board?: any[]): GSpec {
  const tz = f?.origin?.tz || "Europe/London"; const g = gateOf(f); const sched = f?.dep?.scheduled; const est = f?.dep?.estimated;
  let next = "", nextPl = "";
  if (board && g) { const n = board.filter(x => x.id !== f.id && gateOf(x) === g && (x.dep?.scheduled || "") > (sched || "") && stateOf(x) !== "departed" && stateOf(x) !== "cancelled").sort((a, b) => a.dep.scheduled < b.dep.scheduled ? -1 : 1)[0];
    if (n) { next = `${spaced(n.number)} ${(n.destination?.city || n.destination?.iata || "").toUpperCase()} ${fmtT(n.dep.scheduled, tz)}`; nextPl = `${spaced(n.number)} ${(n.localName || n.destination?.city || "").toUpperCase()} ${fmtT(n.dep.scheduled, tz)}`; } }
  return { style, gate: g, al: f?.airline?.iata || "", alName: airlineName(f?.airline), num: f?.number || "", dest: f?.destination?.city || f?.destination?.name || f?.destination?.iata || "", destPl: f?.localName || undefined,
    time: fmtT(sched, tz), est: est && est !== sched ? fmtT(est, tz) : undefined, st: stateOf(f), next, nextPl, lang: style === "krk" ? "enpl" : "en", anim: "live", tz };
}

const useNow = (ms = 1000) => { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; };
/** Scales a fixed design-size screen to fit its box (keeps text crisp on iPhone). */
export function Fit({ w, h, children, max = 1 }: { w: number; h: number; children: ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement>(null); const [s, setS] = useState(0.5);
  useEffect(() => { const el = ref.current; if (!el) return; const f = () => { const W = el.clientWidth, H = el.clientHeight || 9e9; setS(Math.min(max, W / w, H / h)); }; f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, [w, h, max]);
  return <div ref={ref} className="gs-fit"><div className="gs-fit-in" style={{ width: w * s, height: h * s }}><div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "0 0" }}>{children}</div></div></div>;
}
const Dep = ({ c = "#ffd200" }: { c?: string }) => <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden><path fill={c} d="M2.5 19h19v2h-19zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 1.82 3.16.77 1.33 1.6-.43 5.31-1.42 4.35-1.16L21 11.49c.81-.23 1.28-1.05 1.07-1.85z" /></svg>;
const Banner = ({ al, name, cls }: { al: string; name?: string; cls: string }) => WHITE_LOGOS[al] ? <span className={"al-tile m-white wl " + cls}><img src={WHITE_LOGOS[al]} alt={name || AL_NAMES[al] || al} /></span> : <AirlineTile a={{ iata: al, name: name || AL_NAMES[al] || al }} className={cls} mode={BRAND[al] ? "white" : "colour"} />;

/** One gate screen. Animations: bilingual alternation (KRK), scrolling ticker + live clock (LHR), blinking urgent status, optional status cycle. */
export function GateScreen({ s }: { s: GSpec }) {
  const now = useNow(1000); const anim = s.anim || "live";
  const st: GState = anim === "cycle" ? CYCLE[Math.floor(now / 5000) % CYCLE.length] : s.st;
  const [alt, setAlt] = useState(false); useEffect(() => { if (s.lang !== "enpl" || anim === "none") { setAlt(false); return; } const t = setInterval(() => setAlt(a => !a), 4000); return () => clearInterval(t); }, [s.lang, anim]);
  const pl = s.lang === "pl" || (s.lang === "enpl" && alt);
  const L = ST[st]; const urgent = anim !== "none" && (st === "final" || st === "boarding" || st === "gate");
  const bg = BRAND[s.al] || "#0b2a6b"; const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tzFor(s) });
  if (s.style === "spot") return <SpotScreen s={s} st={st} clock={clock} urgent={urgent} />;
  if (s.style === "mag" && s.idle) return <div className="gs gs-mag idle" role="img" aria-label={`Gate ${s.gate} Gate Closed`}>
    <div className="gm-top"><b>{s.gate || "—"}</b><i><Dep /></i><em className="gm-acc" aria-label="Assistance"><Picto k="wheelchair" /></em></div>
    <div className="gm-ban gm-neutral"><span className="gm-lock"><svg className="gm-arc" viewBox="0 0 48 40" aria-hidden="true"><path d="M3 31C12 14 28 6 45 6c-12 4-22 12-28 25z" fill="#fff" /><circle cx="40" cy="31" r="4" fill="#fff" opacity=".85" /></svg><span className="gm-lw"><b>{s.apt || "Manchester"}</b><i>Airport</i></span></span></div>
    <div className="gm-idle">Gate Closed</div></div>;
  if (s.style === "mag") return <div className="gs gs-mag" role="img" aria-label={`Gate ${s.gate} ${s.num} ${s.dest} ${L.mag}`}>
    <div className="gm-top"><b>{s.gate || "—"}</b><i><Dep /></i></div>
    <div className="gm-ban" style={{ background: bg }}><Banner al={s.al} name={s.alName} cls="gm-logo" /></div>
    <div className="gm-row"><span>{s.num.replace(/\s+/g, "")}</span><span className="gm-dest">{s.dest}</span><span>{s.est && st === "delayed" ? s.est : s.time}</span></div>
    <div className={"gm-bar" + (urgent && st === "final" ? " pulse" : "")} style={{ background: L.col }}>{s.msg && st === "wait" ? s.msg : L.mag}{st === "delayed" && s.est ? " " + s.est : ""}</div></div>;
  if (s.style === "krk") { const dest = (pl && s.destPl ? s.destPl : s.dest).toUpperCase(); const stTxt = (pl ? L.pl : L.en) + (st === "delayed" && s.est ? " " + s.est : "");
    return <div className="gs gs-krk" role="img" aria-label={`${s.num} ${s.dest} ${L.en}`}>
      <div className="gk-ban" style={{ background: s.al === "FR" ? "#2457d6" : bg }}><Banner al={s.al} name={s.alName} cls="gk-logo" /></div>
      <div className="gk-body"><div className="gk-r1"><i className="gk-ico"><Dep c="#fff" /></i><b key={dest} className="gk-dest fade">{dest}</b><span className="gk-num">{spaced(s.num)}</span></div>
        <div className="gk-r2"><span className="gk-time">{s.est && st === "delayed" ? s.est : s.time}</span></div>
        <div key={stTxt} className={"gk-st fade" + (urgent && st === "final" ? " blink" : "")}>{stTxt}</div>
        {(s.next || s.msg) && <div key={String(pl)} className="gk-next fade">{s.next ? <><b>{pl ? "NASTĘPNY:" : "NEXT:"}</b> {pl ? s.nextPl || s.next : s.next}</> : s.msg}</div>}
        <span className="gk-tag">{s.gate || ""}</span></div></div>; }
  if (s.style === "lpa") { const [lab, col] = LPA_ST[st];
    return <div className="gs gs-lpa" role="img" aria-label={`Gate ${s.gate} ${s.num} ${s.dest} ${lab}`}>
      <div className="gc-top"><i className="gc-ico"><Dep c="#2b1d0c" /></i><div className="gc-words"><span className="de">Ausgang</span><span className="en">Gate</span><span className="es">Puerta</span></div><b className="gc-gate">{s.gate || "—"}</b></div>
      <div className="gc-main"><div className="gc-al" style={{ background: s.al === "VY" ? "#ffd200" : bg }}><AirlineTile a={{ iata: s.al, name: s.alName || AL_NAMES[s.al] || s.al }} className="gc-logo" mode={s.al === "VY" ? "colour" : BRAND[s.al] ? "white" : "colour"} /></div>
        <div className="gc-fl"><b>{spaced(s.num)}</b><span>{s.est && st === "delayed" ? s.est : s.time}</span></div></div>
      <div className="gc-dest">{s.dest.toUpperCase()}</div>
      {s.co && <div className="gc-co">{s.co.toUpperCase()}</div>}
      {s.msg && <div className="gc-msg">{s.msg}</div>}
      <div className={"gc-st" + (urgent && st === "final" ? " pulse" : "")} style={{ background: col }}>{lab}{st === "delayed" && s.est ? " " + s.est : ""}</div></div>; }
  const tick = "Please keep your belongings with you at all times · Do not leave baggage unattended · Have your boarding pass and passport ready · ";
  return <div className="gs gs-lhr" role="img" aria-label={`Gate ${s.gate} ${s.num} ${s.dest} ${L.lhr}`}>
    <div className="gl-sign"><b>{s.gate || "—"}</b></div>
    <div className="gl-scr"><div className="gl-ban" style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${bg} 55%, #7fa6ff), color-mix(in srgb, ${bg} 72%, #3b64d8))` }}>{!(hasLogo(s.al) || WHITE_LOGOS[s.al]) && <span className="gl-name">{(s.alName || AL_NAMES[s.al] || s.al).toUpperCase()}</span>}<Banner al={s.al} name={s.alName} cls="gl-logo" /></div>
      <div className="gl-dest">{s.dest}</div><div className="gl-time">{s.est && st === "delayed" ? s.est : s.time}</div>
      <div className="gl-line" /><div className="gl-st"><b className={urgent && st === "final" ? "blink" : ""} style={{ color: L.lcol }}>{L.lhr}</b><span>{s.num.replace(/\s+/g, "")}</span></div><div className="gl-line" />
      <div className="gl-msg">{s.msg || L.msg}</div>
      <div className="gl-foot"><div className="gl-tick"><span className={anim === "none" ? "" : "run"}>{tick}</span></div><em>{clock}</em></div></div></div>;
}
export const DIM: Record<GStyle, [number, number]> = { mag: [640, 360], krk: [640, 360], lhr: [380, 720], lpa: [640, 580], spot: [640, 400] };

// ---------- Planespotting gate ----------
const TYPE_ROW = (ac = "") => { const k = ac.toUpperCase().replace(/[^A-Z0-9]/g, ""); return TYPES.find(t => t[0] === k) || TYPES.find(t => k && t[1].replace(/[^A-Z0-9]/gi, "").toUpperCase() === k); };
/** Everyday short-haul types at UK/EU airports; anything else (wide-bodies, classics, freighters, bizjets) is flagged as a rare visitor. */
const COMMON_AC = /^(A31[89]|A32[01]|A2[01]N|A19N|B73[6-9]|B3[89]M|B37M|B738|B752|E1[79]0|E19[05]|E[27]5|E29\d|BCS[13]|AT[47]\d|DH8D|CRJ\d|SB20|DH8C)$/;
export const rareNote = (ac?: string) => { const k = (ac || "").toUpperCase(); if (!k) return ""; if (/^(A38|B74|A34|AN12|AN22|B52|MD11|IL76|A3ST|BLCF|BELF)/.test(k)) return "RARE VISITOR"; if (/^(A3[35]|B7[678]|A35K)/.test(k)) return "WIDE-BODY"; return COMMON_AC.test(k) ? "" : "UNUSUAL TYPE"; };
export const acName = (ac?: string) => { const t = TYPE_ROW(ac); return t ? `${t[2]} ${t[1]}` : ac || ""; };
function SpotScreen({ s, st, clock, urgent }: { s: GSpec; st: GState; clock: string; urgent: boolean }) {
  const t = TYPE_ROW(s.ac); const rare = s.rare ?? rareNote(s.ac); const cc = s.regc || (s.reg ? regCountry(s.reg) : ""); const L = ST[st]; const bg = BRAND[s.al] || "#2b3a55";
  return <div className="gs gs-spot" role="img" aria-label={`Spotter gate ${s.gate}: ${s.num} ${s.dest}, ${acName(s.ac) || "aircraft not assigned yet"}${s.reg ? " " + s.reg : ""}, ${L.lhr}`}>
    <div className="sp-top"><b className="sp-gate">{s.gate || "—"}</b><span className="sp-k">SPOTTER GATE</span><em>{clock}</em></div>
    <div className="sp-main"><div className="sp-ac"><small>{t ? t[2].toUpperCase() : "AIRCRAFT"}</small><b>{t ? t[1] : s.ac || "Not assigned yet"}</b>
      <div className="sp-reg">{s.reg ? <><span className="sp-mono">{s.reg}</span>{cc && <i>{flag(CC[cc] || "")} {cc}</i>}</> : <span className="sp-dim">Registration shows when the airline assigns the plane</span>}</div></div>
      {rare ? <span className={"sp-badge" + (urgent || rare === "RARE VISITOR" ? " glow" : "")}>★ {rare}</span> : s.ac ? <span className="sp-badge reg">REGULAR</span> : null}</div>
    <div className="sp-facts">{t ? <><span><small>FIRST FLEW</small>{t[3]}</span><span><small>SEATS</small>{t[4]}</span><span><small>RANGE</small>{t[5].toLocaleString("en-GB")} km</span></> : <span><small>TIP</small>Types are often confirmed 2–3 h before departure</span>}</div>
    <div className="sp-fl" style={{ ["--al" as any]: bg }}><AirlineTile a={{ iata: s.al, name: s.alName || AL_NAMES[s.al] || s.al }} className="sp-logo" mode="colour" /><b>{spaced(s.num)}</b><span className="sp-dest">{s.dest}</span><span>{s.est && st === "delayed" ? s.est : s.time}</span>
      <span className={"sp-st" + (urgent && st === "final" ? " pulse" : "")} style={{ background: L.col }}>{L.lhr}</span></div></div>;
}
/** Gate-area scene: wall with the big gate number, the screen on a post and the white desk with a black diagonal stripe (MAN-style gate). */
export function GateScene({ s, children }: { s: GSpec; children: ReactNode }) {
  return <div className="gsc"><b className="gsc-wall">{s.gate || "—"}</b><div className="gsc-scr">{children}</div><div className="gsc-desk"><i /></div><div className="gsc-floor" /></div>;
}
export const SCENE: [number, number] = [900, 760];

export function FullScreen({ children, onClose, bg = "#05070c" }: { children: ReactNode; onClose: () => void; bg?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.requestFullscreen?.().catch(() => {}); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => { removeEventListener("keydown", k); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }; }, []);
  return createPortal(<div ref={ref} className="gs-full" style={{ background: bg }} onClick={onClose}><div className="gs-full-in">{children}</div><button className="gs-full-x" aria-label="Close fullscreen" onClick={onClose}>✕</button><span className="gs-full-hint">Tap to close</span></div>, document.body);
}

/** Live preview for a real flight (from a flight's detail or a board). Polls the origin's board for status / next-at-gate. */
export function GatePreview({ f, x, studio }: { f: any; x?: ReactNode; studio?: (s: GSpec) => void }) {
  const apt = f?.origin?.iata; const [style, setStyle] = useState<GStyle>(() => (location.hash.match(/[#&]gstyle=(mag|krk|lhr|lpa|spot)/)?.[1] as GStyle) || styleFor(apt));
  const [scene, setScene] = useState(false); const [msg, setMsg] = useState(""); const shot = useRef<HTMLDivElement>(null); const spot = useSpot(f, style === "spot");
  const [board, setBoard] = useState<any[] | null>(null); const [cur, setCur] = useState(f); const [anim, setAnim] = useState<"live" | "cycle" | "none">("live"); const [full, setFull] = useState(false); const [src, setSrc] = useState("");
  useEffect(() => { if (!apt) return; let dead = false; const day = (f.dep?.scheduled || "").slice(0, 10) || today(); const go = () => api(`/board/${apt}?dir=dep&date=${day}`).then(d => withKtw(apt, "dep", day, d)).then(d => { if (dead) return; const L = d?.flights || []; setBoard(L); setSrc(d?.source || ""); const m = L.find((y: any) => y.id === f.id || String(y.number).replace(/\s/g, "") === String(f.number).replace(/\s/g, "")); if (m) setCur(m); }).catch(() => {}); go(); const t = setInterval(go, 60e3); return () => { dead = true; clearInterval(t); }; }, [apt, f.id]);
  const spec: GSpec = { ...specFromFlight(cur, style, board || undefined), anim, ...(style === "spot" ? spot : {}) }; const [w0, h0] = DIM[style]; const sc = scene && style !== "lhr"; const [w, h] = sc ? SCENE : [w0, h0];
  const screen = sc ? <GateScene s={spec}><Fit w={w0} h={h0}><GateScreen s={spec} /></Fit></GateScene> : <GateScreen s={spec} />;
  return <div className="fd gp"><div className="head"><div><span className="tag">GATE SCREEN</span><h1 className="h1s">{spec.num} · {spec.dest}</h1><div className="muted sm">{spec.gate ? `Gate ${spec.gate}` : "Gate not announced yet"} · {ST[spec.st].lhr} · {apt}</div></div>{x}</div>
    <div className="px"><div className="gp-seg" role="tablist">{GSTYLES.map(k => <button key={k} role="tab" aria-selected={style === k} className={style === k ? "on" : ""} onClick={() => setStyle(k)}>{GLABEL[k]}</button>)}</div>
      <div ref={shot} className={"gp-stage " + style + (sc ? " scene" : "")} onClick={() => setFull(true)}><Fit w={w} h={h}>{screen}</Fit></div>
      <div className="gp-ctl"><div className="gp-seg sm">{([["live", "Live"], ["cycle", "Simulate boarding"], ["none", "Still"]] as const).map(([k, l]) => <button key={k} className={anim === k ? "on" : ""} onClick={() => setAnim(k)}>{l}</button>)}</div>
        <button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button>{style !== "lhr" && <button className={"gp-btn" + (scene ? " on" : "")} aria-pressed={scene} onClick={() => setScene(v => !v)}>🚪 Gate scene</button>}
        <button className="gp-btn" onClick={async () => setMsg(await saveImage(shot.current?.querySelector(".gs-fit-in > div") as HTMLElement, `${spec.num} gate screen`))}>📷 Save image</button>{studio && <button className="gp-btn" onClick={() => studio(spec)}>Edit in Gate studio</button>}{msg && <span className="faint xs">{msg}</span>}</div>
      {style === "spot" && <p className="faint xs mt8">{spot.reg ? `Aircraft ${spot.reg}${spot.ac ? " (" + spot.ac + ")" : ""} from Skyline's live aircraft lookup.` : spot.ac ? `The airline hasn't assigned the plane yet; ${spot.ac} is the type this flight usually uses.` : spot.loading ? "Looking up the aircraft…" : "No aircraft assigned yet. Airlines usually assign it 2–3 hours before departure."} Rare-visitor badges are a fun guess from the aircraft type.</p>}
      <p className="faint xs mt8">{style === "spot" ? "A planespotting gate screen made for Skyline, not an official display." : <>A fun recreation of {style === "mag" ? "Manchester / East Midlands / Stansted" : style === "krk" ? "Kraków" : style === "lpa" ? "Gran Canaria" : "Heathrow"}-style gate screens, not an official display.</>} {anim === "cycle" ? "Simulate boarding cycles through the boarding stages; it is not the real status." : `Status, gate and time come from the live board${src ? " (" + src + ")" : ""}${spec.next ? "; the next-flight line is the next departure listed for the same gate" : ""}. Refreshes every minute.`}{!spec.gate && " The gate shows “—” until the airport publishes it."}</p></div>
    {full && <FullScreen onClose={() => setFull(false)}><Fit w={w} h={h} max={4}>{screen}</Fit></FullScreen>}</div>;
}
/** Spotter data for a live flight: assigned aircraft (or the usual type) from /plane-card, then registration details. Fetched only for the Spotter style. */
function useSpot(f: any, on: boolean) {
  const [v, setV] = useState<{ ac?: string; reg?: string; regc?: string; loading?: boolean }>({});
  useEffect(() => { if (!on || !f?.number) return; let dead = false; setV({ loading: true });
    const ac0 = f.aircraft?.type || f.aircraft?.model || "";
    api(`/plane-card?number=${encodeURIComponent(f.number)}&date=${f.date || (f.dep?.scheduled || "").slice(0, 10) || today()}&o=${f.origin?.iata || ""}&d=${f.destination?.iata || ""}`).then(async c => {
      if (dead) return; const reg = c?.reg || f.aircraft?.reg || ""; let ac = c?.type || ac0 || c?.typicalType || ""; let regc = "";
      if (reg) { const a = await api(`/aircraft/${encodeURIComponent(reg)}`).catch(() => null); ac = a?.info?.icao_type || a?.live?.type || ac; regc = a?.info?.registered_owner_country_name || ""; }
      if (!dead) setV({ ac, reg, regc }); }).catch(() => { if (!dead) setV({ ac: ac0 }); });
    return () => { dead = true; }; }, [on, f?.number]);
  return v;
}

/** Gate screens for every upcoming departure on a board that has a gate (opened from the board header). Manchester-style walls can also
 *  show the gates with no flight right now as "Gate Closed" screens, and any wall can run as a fullscreen kiosk. */
const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
export function GateWall({ iata, x, open }: { iata: string; x?: ReactNode; open: (f: any) => void }) {
  const [d, setD] = useState<any>(null); const day = today();
  useEffect(() => { let dead = false; const go = () => api(`/board/${iata}?dir=dep&date=${day}`).then(r => withKtw(iata, "dep", day, r)).then(r => !dead && setD(r)).catch(e => !dead && setD((p: any) => p && !p.error ? p : { error: e.message })); go(); const t = setInterval(go, 90e3); return () => { dead = true; clearInterval(t); }; }, [iata]);
  const [style, setStyle0] = useState<GStyle>(() => (localStorage.getItem("sk.gw.style." + iata) as GStyle) || styleFor(iata)); const setStyle = (k: GStyle) => { setStyle0(k); localStorage.setItem("sk.gw.style." + iata, k); };
  const [idle, setIdle] = useState(true); const [kiosk, setKiosk] = useState(false); const loose = style === "krk" || iata === "KTW";
  const L = (d?.flights || []).filter((f: any) => !f.liveOnly && !["departed", "cancelled"].includes(stateOf(f)) && (gateOf(f) || loose)).slice(0, 24);
  // Gates seen on today's board with nothing boarding in the next 3 hours → idle "Gate Closed" screens (Manchester style only).
  const idleGates = useMemo(() => { if (style !== "mag") return []; const busy = new Set(L.filter((f: any) => +new Date(f.dep?.estimated || f.dep?.scheduled) < Date.now() + 3 * 3600e3).map(gateOf));
    return [...new Set((d?.flights || []).map(gateOf).filter(Boolean) as string[])].filter(g => !busy.has(g)).sort(natural).slice(0, 18); }, [d, style]);
  const sty = style === "spot" ? "mag" : style; const [w, h] = DIM[sty];
  const specs = [...L.map((f: any) => ({ key: f.id, label: `${spaced(f.number)} · ${f.destination?.city || ""}${gateOf(f) ? " · Gate " + gateOf(f) : ""}`, s: { ...specFromFlight(f, sty, d.flights), anim: "live" } as GSpec, f })),
    ...(idle ? idleGates.map(g => ({ key: "idle" + g, label: `Gate ${g} · not in use`, s: { ...DEFAULT_GATE, gate: g, idle: true, anim: "none", apt: iata === "STN" ? "London Stansted" : iata === "EMA" ? "East Midlands" : iata === "MAN" ? "Manchester" : d?.airport?.city || iata } as GSpec, f: null })) : [])];
  return <div className="fd gp"><div className="head"><div><span className="tag">GATE SCREENS</span><h1 className="h1s">{iata} gates now</h1><div className="muted sm">Live departures{loose ? "" : " with a gate"} · tap one to open</div></div>{x}</div>
    <div className="px"><div className="gp-seg" role="tablist">{GSTYLES.filter(k => k !== "spot").map(k => <button key={k} role="tab" aria-selected={style === k} className={style === k ? "on" : ""} onClick={() => setStyle(k)}>{GLABEL[k]}</button>)}</div>
      <div className="gp-ctl">{specs.length > 0 && <button className="gp-btn pri" onClick={() => setKiosk(true)}>▶ Kiosk mode</button>}{style === "mag" && <button className={"gp-btn" + (idle ? " on" : "")} aria-pressed={idle} onClick={() => setIdle(v => !v)}>Closed gates {idle ? "on" : "off"}</button>}</div>
      {!d ? <p className="muted">Loading live board…</p> : d.error ? <p className="bad">{d.error}</p> : !specs.length ? <p className="muted">No upcoming departures with a published gate right now.</p> :
      <div className={"gw-grid " + sty}>{specs.map(x => <button key={x.key} className={"gw-it" + (x.f ? "" : " idle")} onClick={() => x.f ? open(x.f) : setKiosk(true)} aria-label={x.label}><Fit w={w} h={h}><GateScreen s={x.s} /></Fit></button>)}</div>}
      <p className="faint xs mt8">Recreations for fun from the live board{d?.source ? " (" + d.source + ")" : ""}, not official displays.{style === "mag" && idle && idleGates.length ? " “Gate Closed” screens are gates listed on today's board with no departure in the next 3 hours." : ""} Kiosk mode shows each screen fullscreen for 8 seconds, like a gate-area display.</p></div>
    {kiosk && <Kiosk items={specs.map(x => ({ key: x.key, label: x.label, node: <Fit w={w} h={h} max={4}><GateScreen s={x.s} /></Fit> }))} onClose={() => setKiosk(false)} />}</div>;
}

// ---------- Games ----------
export const enc = (o: any) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const dec = (s: string) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))); } catch { return null; } };
export const DEFAULT_GATE: GSpec = { style: "mag", gate: "A7", al: "DY", num: "D84470", dest: "Stockholm", time: "20:05", st: "final", lang: "en", anim: "live" };
export const PRESETS: { n: string; s: GSpec }[] = [
  { n: "Manchester style", s: DEFAULT_GATE },
  { n: "Kraków style", s: { style: "krk", gate: "17", al: "FR", num: "FR2616", dest: "Eilat (Ovda)", destPl: "Ejlat (Ovda)", time: "07:50", st: "wait", lang: "enpl", next: "EZY 1872 MANCHESTER 10:55", nextPl: "EZY 1872 MANCHESTER 10:55", anim: "live", tz: "Europe/Warsaw" } },
  { n: "Heathrow style", s: { style: "lhr", gate: "B32", al: "BA", num: "BA109", dest: "Dubai", time: "21:25", st: "pre", lang: "en", anim: "live" } },
  { n: "Manchester gate closed", s: { style: "mag", gate: "A6", al: "", num: "", dest: "", time: "", st: "closed", idle: true, scene: true, lang: "en", anim: "none" } },
  { n: "Planespotting gate", s: { style: "spot", gate: "B32", al: "EK", num: "EK18", dest: "Dubai", time: "14:05", st: "boarding", ac: "A388", reg: "A6-EOE", lang: "en", anim: "live" } },
  { n: "Gran Canaria style", s: { style: "lpa", gate: "C06", al: "VY", num: "VLG3275", dest: "Bilbao", time: "06:45", st: "boarding", co: "IB 5427   BILBAO", msg: "**** PIO PIO ****", lang: "en", anim: "live", tz: "Atlantic/Canary" } },
];
const alList = () => [...LOGOS].map(k => [k, AL_NAMES[k] || k] as const).sort((a, b) => a[1].localeCompare(b[1]));

export function GateStudio({ init }: { init?: GSpec }) {
  const [s, setS0] = useState<GSpec>(() => init || dec(location.hash.match(/[#&]g=([\w-]+)/)?.[1] || "") || JSON.parse(localStorage.getItem("sk.games.gate") || "null") || DEFAULT_GATE);
  const setS = (p: Partial<GSpec>) => setS0(o => { const n = { ...o, ...p }; localStorage.setItem("sk.games.gate", JSON.stringify(n)); return n; });
  const [full, setFull] = useState(false); const [msg, setMsg] = useState(""); const [saved, setSaved] = useState<{ n: string; s: GSpec }[]>(() => JSON.parse(localStorage.getItem("sk.games.gates") || "[]"));
  const link = () => `${location.origin}/#games=gate&g=${enc(s)}`;
  const share = async () => { const u = link(); try { if (navigator.share) await navigator.share({ url: u, title: `${s.num} gate screen` }); else { await navigator.clipboard.writeText(u); setMsg("Link copied"); } } catch { try { await navigator.clipboard.writeText(u); setMsg("Link copied"); } catch { setMsg(u); } } history.replaceState(null, "", `#games=gate&g=${enc(s)}`); };
  const save = () => { const n = [{ n: `${s.num} ${s.dest}`, s }, ...saved.filter(x => x.n !== `${s.num} ${s.dest}`)].slice(0, 20); setSaved(n); localStorage.setItem("sk.games.gates", JSON.stringify(n)); setMsg("Saved on this device"); };
  const [w0, h0] = DIM[s.style]; const AL = useMemo(alList, []); const sc = !!s.scene && s.style !== "lhr"; const [w, h] = sc ? SCENE : [w0, h0]; const shot = useRef<HTMLDivElement>(null);
  const screen = sc ? <GateScene s={s}><Fit w={w0} h={h0}><GateScreen s={s} /></Fit></GateScene> : <GateScreen s={s} />;
  const F = (l: string, el: ReactNode) => <label className="gsx-f"><span>{l}</span>{el}</label>;
  return <div className="gsx"><div ref={shot} className={"gp-stage " + s.style + (sc ? " scene" : "")} onClick={() => setFull(true)}><Fit w={w} h={h}>{screen}</Fit></div>
    <div className="gp-ctl"><button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button><button className="gp-btn" onClick={share}>Share link</button><button className="gp-btn" onClick={save}>Save</button><button className="gp-btn" onClick={async () => setMsg(await saveImage(shot.current?.querySelector(".gs-fit-in > div") as HTMLElement, `Gate ${s.gate} screen`))}>📷 Image</button>{msg && <span className="faint xs">{msg}</span>}</div>
    <div className="gsx-pre">{PRESETS.map(p => <button key={p.n} onClick={() => setS0(p.s)}>{p.n}</button>)}</div>
    <div className="gsx-grid">
      {F("Design", <div className="gp-seg sm">{GSTYLES.map(k => <button key={k} className={s.style === k ? "on" : ""} onClick={() => setS({ style: k, lang: k === "krk" ? "enpl" : "en" })}>{k === "mag" ? "MAN·EMA·STN" : GLABEL[k]}</button>)}</div>)}
      {s.style !== "lhr" && F("Gate area", <div className="gp-seg sm"><button className={!s.scene ? "on" : ""} onClick={() => setS({ scene: false })}>Screen only</button><button className={s.scene ? "on" : ""} onClick={() => setS({ scene: true })}>Gate scene (desk + wall)</button></div>)}
      {s.style === "mag" && F("Gate in use?", <div className="gp-seg sm"><button className={!s.idle ? "on" : ""} onClick={() => setS({ idle: false, al: s.al || "DY", num: s.num || "D84470", dest: s.dest || "Stockholm", time: s.time || "20:05" })}>Flight at gate</button><button className={s.idle ? "on" : ""} onClick={() => setS({ idle: true })}>Not in use · Gate Closed</button></div>)}
      {F("Gate", <input value={s.gate} maxLength={5} onChange={e => setS({ gate: e.target.value.toUpperCase() })} />)}
      {s.style === "mag" && s.idle && F("Airport name on the blue band", <input value={s.apt || ""} maxLength={20} placeholder="Manchester" onChange={e => setS({ apt: e.target.value || undefined })} />)}
      {s.style === "spot" && F("Aircraft type (ICAO code)", <input value={s.ac || ""} maxLength={5} placeholder="A388" onChange={e => setS({ ac: e.target.value.toUpperCase() || undefined })} />)}
      {s.style === "spot" && F("Registration", <input value={s.reg || ""} maxLength={9} placeholder="A6-EOE" onChange={e => setS({ reg: e.target.value.toUpperCase() || undefined })} />)}
      {F("Airline", <select value={s.al} onChange={e => setS({ al: e.target.value, alName: AL_NAMES[e.target.value] })}>{AL.map(([k, n]) => <option key={k} value={k}>{n} ({k})</option>)}</select>)}
      {F("Flight", <input value={s.num} maxLength={8} onChange={e => setS({ num: e.target.value.toUpperCase() })} />)}
      {F("Destination", <input value={s.dest} maxLength={24} onChange={e => setS({ dest: e.target.value })} />)}
      {s.style === "krk" && F("Destination (Polish)", <input value={s.destPl || ""} maxLength={24} placeholder="same as English" onChange={e => setS({ destPl: e.target.value || undefined })} />)}
      {F("Time", <input type="time" value={s.time} onChange={e => setS({ time: e.target.value })} />)}
      {F("Status", <select value={s.st} onChange={e => setS({ st: e.target.value as GState, stPl: undefined })}>{(Object.keys(ST) as GState[]).map(k => <option key={k} value={k}>{s.style === "krk" ? `${ST[k].en} / ${ST[k].pl}` : s.style === "lhr" ? ST[k].lhr : s.style === "lpa" ? LPA_ST[k][0] : ST[k].mag}</option>)}</select>)}
      {s.st === "delayed" && F("New time", <input type="time" value={s.est || ""} onChange={e => setS({ est: e.target.value })} />)}
      {s.style === "krk" ? F("Next flight line", <input value={s.next || ""} maxLength={40} placeholder="EZY 1872 MANCHESTER 10:55" onChange={e => setS({ next: e.target.value.toUpperCase(), nextPl: e.target.value.toUpperCase() })} />) : F(s.style === "lhr" ? "Message" : s.style === "lpa" ? "Message line" : "Wait message", <input value={s.msg || ""} maxLength={s.style === "lpa" ? 32 : 110} placeholder={s.style === "lhr" ? ST[s.st].msg : s.style === "lpa" ? "**** PIO PIO ****" : "Wait in Lounge"} onChange={e => setS({ msg: e.target.value || undefined })} />)}
      {s.style === "lpa" && F("Second flight (grey bar)", <input value={s.co || ""} maxLength={28} placeholder="IB 5427   BILBAO" onChange={e => setS({ co: e.target.value.toUpperCase() || undefined })} />)}
      {s.style === "krk" && F("Language", <div className="gp-seg sm">{([["enpl", "EN ⇄ PL"], ["en", "English"], ["pl", "Polski"]] as const).map(([k, l]) => <button key={k} className={s.lang === k ? "on" : ""} onClick={() => setS({ lang: k })}>{l}</button>)}</div>)}
      {F("Animation", <div className="gp-seg sm">{([["live", "Animated"], ["cycle", "Boarding sequence"], ["none", "Still"]] as const).map(([k, l]) => <button key={k} className={(s.anim || "live") === k ? "on" : ""} onClick={() => setS({ anim: k })}>{l}</button>)}</div>)}
    </div>
    {saved.length > 0 && <><h3 className="gsx-h">Saved screens</h3><div className="gsx-saved">{saved.map(x => <button key={x.n} onClick={() => setS0(x.s)}>{x.n}<small>{x.s.style.toUpperCase()}</small></button>)}</div></>}
    {full && <FullScreen onClose={() => setFull(false)}><Fit w={w} h={h} max={4}>{screen}</Fit></FullScreen>}</div>;
}

// Board studio: user-built rows rendered by the real TerminalBoard themes (Kraków, split-flap, MAG, Heathrow, …).
type BRow = { t: string; dest: string; al: string; num: string; gate: string; st: string; est?: string; via?: string };
const BST = ["Scheduled", "Wait in lounge", "Go to gate", "Boarding", "Final call", "Gate closed", "Delayed", "Departed", "Cancelled", "Gate open", "New gate", "Gate displayed at", "Check-in"];
export type BSpec = { name: string; theme: string; dir: string; anim: boolean; rows: BRow[]; sign?: boolean; dual?: boolean; foot?: string };
export const BDEF: BSpec = { name: "My board", theme: "krk", dir: "dep", anim: true, rows: [
  { t: "07:50", dest: "Eilat", al: "FR", num: "FR2616", gate: "17", st: "Wait in lounge" }, { t: "08:15", dest: "Manchester", al: "U2", num: "EZY1872", gate: "18", st: "Scheduled" },
  { t: "08:40", dest: "Warsaw", al: "LO", num: "LO3922", gate: "5", st: "Boarding" }, { t: "09:05", dest: "Budapest", al: "W6", num: "W61234", gate: "9", st: "Delayed", est: "09:45" },
  { t: "09:30", dest: "Frankfurt", al: "LH", num: "LH1365", gate: "3", st: "Final call" }, { t: "10:10", dest: "London Stansted", al: "FR", num: "FR2448", gate: "12", st: "Scheduled" }] };
/** Board presets recreated from the user's photos (sample rows typed from the photo; airlines limited to Skyline's logo set). */
export const BPRESETS: { n: string; b: BSpec }[] = [
  { n: "Gran Canaria (photo)", b: { name: "Gran Canaria", theme: "lpa", dir: "dep", anim: true, sign: true, dual: false, foot: "keine Flugsteige per Lautsprecher Ansage", rows: [
    { t: "10:00", dest: "Frankfurt-Hahn", al: "FR", num: "FR1685", gate: "C13", st: "Final call" },
    { t: "11:30", dest: "Hannover", al: "X3", num: "X32263", gate: "C10", st: "Final call" },
    { t: "11:30", dest: "Treviso", al: "FR", num: "FR2185", gate: "C04", st: "Final call" },
    { t: "11:35", dest: "Fuerteventura", al: "NT", num: "NT226", gate: "A11", st: "Go to gate" },
    { t: "11:35", dest: "Manchester", al: "FR", num: "FR2584", gate: "D34", st: "Go to gate" },
    { t: "11:55", dest: "Madrid", al: "IB", num: "IB1600", gate: "B11", st: "New gate" },
    { t: "11:55", dest: "Madrid", al: "VY", num: "VLG5300", gate: "B11", st: "Scheduled" },
    { t: "11:55", dest: "Budapest", al: "FR", num: "FR2967", gate: "C17", st: "Scheduled" },
    { t: "12:00", dest: "Tenerife N", al: "NT", num: "NT131", gate: "A13", st: "Scheduled" },
    { t: "12:00", dest: "Lanzarote", al: "NT", num: "NT530", gate: "A13", st: "Scheduled" },
    { t: "12:10", dest: "Dusseldorf", al: "X3", num: "X32115", gate: "C16", st: "Scheduled" },
    { t: "12:15", dest: "Pisa", al: "FR", num: "FR7989", gate: "", st: "Gate displayed at", est: "11:50" },
    { t: "12:35", dest: "Lon/Gatwick", al: "U2", num: "U28130", gate: "D28", st: "Go to gate" },
    { t: "12:35", dest: "Tenerife N", al: "NT", num: "NT137", gate: "", st: "Gate displayed at", est: "11:35" },
    { t: "12:45", dest: "Lon/Gatwick", al: "BA", num: "BA2707", gate: "D32", st: "Go to gate" },
    { t: "12:55", dest: "Stockholm", al: "D8", num: "D85706", gate: "", st: "Gate displayed at", est: "11:45" },
    { t: "12:55", dest: "Bournemouth", al: "LS", num: "LS3644", gate: "D35", st: "Go to gate" },
    { t: "13:00", dest: "E.Midlands", al: "LS", num: "LS670", gate: "D25", st: "Go to gate" }] } },
  { n: "Katowice (sample)", b: { name: "Katowice", theme: "ktw", dir: "dep", anim: true, rows: [
    { t: "06:00", dest: "London Luton", al: "W6", num: "W61005", gate: "2", st: "Departed", est: "06:08" },
    { t: "06:25", dest: "Warsaw", al: "LO", num: "LO3884", gate: "5", st: "Departed", est: "06:31" },
    { t: "09:40", dest: "London Stansted", al: "FR", num: "FR2472", gate: "4", st: "Boarding" },
    { t: "10:15", dest: "Dortmund", al: "W6", num: "W61093", gate: "1", st: "Boarding" },
    { t: "11:05", dest: "Malaga", al: "FR", num: "FR7012", gate: "6", st: "Check-in" },
    { t: "11:30", dest: "Barcelona", al: "W6", num: "W61175", gate: "", st: "Check-in" },
    { t: "12:10", dest: "Larnaca", al: "W6", num: "W61251", gate: "", st: "Scheduled" },
    { t: "13:20", dest: "Lanzarote", al: "E4", num: "E45017", gate: "", st: "Scheduled" },
    { t: "14:05", dest: "Paphos", al: "FR", num: "FR6393", gate: "", st: "Delayed", est: "14:45" }] } },
  { n: "Fraport Greece (photo)", b: { name: "Fraport Greece", theme: "fgr", dir: "dep", anim: true, rows: [
    { t: "09:40", dest: "Tel Aviv", al: "W6", num: "W67502", gate: "01", st: "Delayed", est: "11:00" },
    { t: "09:45", dest: "Athens", al: "A3", num: "A3203", gate: "05", st: "Final call" },
    { t: "11:30", dest: "Dusseldorf", al: "DE", num: "DE1623", gate: "17", st: "Gate open" },
    { t: "12:00", dest: "Dusseldorf", al: "EW", num: "EW9631", gate: "01", st: "Scheduled" },
    { t: "12:45", dest: "Amsterdam", al: "HV", num: "HV5080", gate: "13", st: "Scheduled" },
    { t: "13:00", dest: "East Midlands", al: "FR", num: "FR3851", gate: "16", st: "Scheduled" },
    { t: "13:00", dest: "London LGW", al: "U2", num: "EZY8228", gate: "05", st: "Scheduled" },
    { t: "13:25", dest: "London STN", al: "FR", num: "FR8585", gate: "02", st: "Scheduled" },
    { t: "14:05", dest: "London LGW", al: "U2", num: "EZY6542", gate: "06", st: "Scheduled" },
    { t: "14:40", dest: "Krakow", al: "FR", num: "FR7041", gate: "01", st: "Scheduled" },
    { t: "15:30", dest: "Rome CIA", al: "FR", num: "FR2118", gate: "14", st: "Scheduled" }] } },
];
/** Minutes the zone is ahead of UTC right now. */
export const tzOff = (tz: string, at = Date.now()) => { const p = (z: string) => Date.parse(new Date(at).toLocaleString("en-US", { timeZone: z })); return Math.round((p(tz) - p("UTC")) / 60e3); };
/** Board studio clock zone: Polish board styles run on Kraków time, every other style on UK time. */
const TZ: Record<string, string> = { krk: "Europe/Warsaw", ktw: "Europe/Warsaw", waw: "Europe/Warsaw", fra: "Europe/Berlin", muc: "Europe/Berlin", ber: "Europe/Berlin", ger: "Europe/Berlin", zrh: "Europe/Zurich", vie: "Europe/Vienna", prg: "Europe/Prague", ams: "Europe/Amsterdam", cdg: "Europe/Paris", bud: "Europe/Budapest", aena: "Europe/Madrid", mad: "Europe/Madrid", pmi: "Europe/Madrid", swedavia: "Europe/Stockholm", cph: "Europe/Copenhagen", bru: "Europe/Brussels", ita: "Europe/Rome", adria: "Europe/Zagreb", otp: "Europe/Bucharest", fgr: "Europe/Athens", lpa: "Atlantic/Canary", finavia: "Europe/Helsinki", avinor: "Europe/Oslo", ana: "Europe/Lisbon", lis: "Europe/Lisbon", daa: "Europe/Dublin", kef: "Atlantic/Reykjavik", syd: "Australia/Sydney", tr: "Europe/Istanbul" };
/** Board studio clock zone = the local time of the airport whose style is picked (UK styles → Europe/London). */
export const boardTz = (theme: string) => TZ[theme] || "Europe/London";
/** "HH:MM" typed as local time in tz → next occurrence as a UTC ISO string. */
const iso = (hhmm: string, tz = "Europe/London") => { const [h, m] = (hhmm || "00:00").split(":").map(Number); const off = tzOff(tz); const d = new Date(); d.setUTCHours(h || 0, (m || 0) - off, 0, 0);
  while (+d < Date.now() - 30 * 60e3) d.setUTCDate(d.getUTCDate() + 1); while (+d > Date.now() + 26 * 3600e3) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString(); };
/** Board rows → the flight objects TerminalBoard renders (times in UTC so they show exactly as typed). */
export function boardData(b: BSpec, step = 0) {
  const tz = boardTz(b.theme);
  // Keep the rows in the order typed even when the clock passes them: every row is placed on the day that keeps it within 12h after the row above.
  let prev = 0; const day = 864e5;
  const near = (x: string, ref: number) => { let v = +new Date(x); while (v < ref - day / 2) v += day; while (v > ref + day / 2) v -= day; return new Date(v).toISOString(); };
  const flights = b.rows.map((r, i) => { const s = b.anim && step && BST.indexOf(r.st) < 7 ? BST[(BST.indexOf(r.st) + (i % 3 === step % 3 ? 1 : 0)) % 7] : r.st; let tm = +new Date(iso(r.t, tz));
    if (i) { while (tm < prev - day / 2) tm += day; while (tm > prev + day / 2) tm -= day; } prev = tm; const t = new Date(tm).toISOString();
    const side = { scheduled: t, estimated: s === "Delayed" && r.est ? near(iso(r.est, tz), tm) : t, gate: r.gate || undefined };
    const ap = { iata: "", city: r.dest, tz }; const home = { iata: "XXX", city: b.name, tz };
    return { id: "c" + i + r.num, number: r.num, airline: { iata: r.al, name: AL_NAMES[r.al] || r.al }, origin: b.dir === "dep" ? home : ap, destination: b.dir === "dep" ? ap : home, dep: b.dir === "dep" ? side : {}, arr: b.dir === "arr" ? side : {},
      ...(s === "Check-in" ? { remark: { txt: "Check-in", k: "" } } : s === "Departed" && r.est ? { remark: { txt: "Departed " + r.est, k: "dim" } } : s === "New gate" ? { remark: { txt: "New gate", k: "warn" } } : s === "Gate displayed at" ? { remark: { txt: "Gate displayed at" + (r.est ? " " + r.est : ""), k: "info" } } : {}), via: r.via || "",
      statusText: s === "Scheduled" ? "" : s, status: s === "Cancelled" ? "cancelled" : s === "Departed" ? (b.dir === "dep" ? "departed" : "landed") : s === "Delayed" ? "delayed" : "scheduled", localName: r.dest.toUpperCase() }; });
  return { airport: { name: b.name, tz, country: "" }, flights, source: "Made in Skyline Games", ...(b.foot != null ? { footer: b.foot } : {}) };
}
const LPW = 470; // Gran Canaria boards are portrait screens
/** Gran Canaria overhead identity sign above the screens: black box, yellow plane tile, Abflug / Departures / Salidas (recreation, no operator logo). */
export function LpaSign({ dir }: { dir: string }) {
  const [de, en, es] = dir === "arr" ? ["Ankunft", "Arrivals", "Llegadas"] : ["Abflug", "Departures", "Salidas"];
  return <div className="lpa-sign"><i className="lpa-sq"><Dep c="#151515" /></i><div className="lpa-w"><span>{de}</span><span>{en}</span><b>{es}</b></div></div>;
}
const BW0 = 780; // board preview design width (a real landscape board, scaled to fit the phone); height follows the row count
export function BoardStudio() {
  const [b, setB0] = useState(() => dec(location.hash.match(/[#&]b=([\w-]+)/)?.[1] || "") || JSON.parse(localStorage.getItem("sk.games.board") || "null") || BDEF);
  const setB = (p: any) => setB0((o: any) => { const n = { ...o, ...p }; localStorage.setItem("sk.games.board", JSON.stringify(n)); return n; });
  const setRow = (i: number, p: Partial<BRow>) => setB({ rows: b.rows.map((r: BRow, k: number) => k === i ? { ...r, ...p } : r) });
  const [full, setFull] = useState(false); const [step, setStep] = useState(0); const [msg, setMsg] = useState(""); const AL = useMemo(alList, []);
  useEffect(() => { if (!b.anim) return; const t = setInterval(() => setStep(s => s + 1), 7000); return () => clearInterval(t); }, [b.anim]);
  const lpa = b.theme === "lpa"; const dual = lpa && !!b.dual; const BW = lpa ? LPW : BW0;
  const data = useMemo(() => boardData(b, step), [b, step]);
  const half = Math.ceil(b.rows.length / 2); const dataA = useMemo(() => dual ? { ...data, flights: data.flights.slice(0, half) } : data, [data, dual, half]); const dataB = useMemo(() => ({ ...data, flights: data.flights.slice(half) }), [data, half]);
  const nRows = dual ? half : b.rows.length; const BH = Math.min(1100, Math.max(6, nRows) * (b.theme === "mag" ? 50 : 40) + (b.theme === "mag" ? 160 : lpa ? 150 : 120));
  const signH = lpa && b.sign ? 190 : 0; const TW = dual ? BW * 2 + 24 : BW; const TH = BH + signH;
  const [saved, setSaved] = useState<any[]>(() => JSON.parse(localStorage.getItem("sk.games.boards") || "[]"));
  const save = () => { const n = [b, ...saved.filter(x => x.name !== b.name)].slice(0, 20); setSaved(n); localStorage.setItem("sk.games.boards", JSON.stringify(n)); setMsg("Saved on this device"); };
  const share = async () => { const u = `${location.origin}/#games=board&b=${enc(b)}`; try { await navigator.clipboard.writeText(u); setMsg("Link copied"); } catch { setMsg(u); } };
  const prevRef = useRef<HTMLDivElement>(null);
  const ktwLive = async () => { setMsg("Collecting today's Katowice flights…"); const fl = await ktwFlights(b.dir, today()).catch(() => []); if (!fl.length) { setB0(JSON.parse(JSON.stringify(BPRESETS.find(p => p.b.theme === "ktw")!.b))); setMsg("No live Katowice flights found right now, so here's a sample board"); return; }
    const tz = "Europe/Warsaw"; const rows: BRow[] = fl.slice(0, 18).map((f: any) => { const t = b.dir === "dep" ? f.dep : f.arr; const done = b.dir === "dep" ? !!t.actual : !!t.actual; const late = t.estimated && t.estimated !== t.scheduled;
      return { t: fmtT(t.scheduled, tz), dest: (b.dir === "dep" ? f.destination?.city : f.origin?.city) || "", al: f.airline?.iata || "", num: f.number, gate: "", st: f.status === "cancelled" ? "Cancelled" : done ? "Departed" : late ? "Delayed" : "Scheduled", ...(done ? { est: fmtT(t.actual, tz) } : late ? { est: fmtT(t.estimated, tz) } : {}) }; });
    setB0({ name: "Katowice", theme: "ktw", dir: b.dir, anim: false, rows }); setMsg(`${rows.length} real flights · Katowice times estimated from flight length`); };
  const themes = Object.entries(THEMES).map(([k, v]) => [k, v.name] as const);
  const one = (k: string, cd: any) => <div className="bs-board" key={k} style={{ width: BW, height: BH }}><TerminalBoard key={b.theme + b.dir + k} iata="XXX" dir={b.dir} date={today()} onClose={() => {}} custom={cd} theme0={b.theme} inline dw={BW} /></div>;
  return <div className="gsx"><div ref={prevRef} className={"bs-prev" + (lpa ? " lpa" : "")} style={{ aspectRatio: `${TW}/${TH}` }}><Fit w={TW} h={TH} max={2}><div className="bs-compose" style={{ width: TW, height: TH }}>{signH > 0 && <div className="bs-sign" style={{ height: signH }}><LpaSign dir={b.dir} /></div>}
      <div className="bs-screens">{one("a", dataA)}{dual && one("b", dataB)}</div></div></Fit></div>
    <div className="gp-ctl"><button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button><button className="gp-btn" onClick={save}>Save</button><button className="gp-btn" onClick={share}>Share link</button><button className="gp-btn" onClick={async () => setMsg(await saveImage(prevRef.current?.querySelector(".bs-compose") as HTMLElement, b.name + " board"))}>📷 Image</button>{msg && <span className="faint xs">{msg}</span>}</div>
    <div className="gsx-pre"><button onClick={ktwLive}>✈ Katowice · today's real flights</button>{BPRESETS.map(p => <button key={p.n} onClick={() => setB0(JSON.parse(JSON.stringify(p.b)))}>{p.n}</button>)}<button onClick={() => setB0(BDEF)}>Kraków sample</button></div>
    <div className="gsx-grid">
      <label className="gsx-f"><span>Board name</span><input value={b.name} maxLength={40} onChange={e => setB({ name: e.target.value })} /></label>
      <label className="gsx-f"><span>Style</span><select value={b.theme} onChange={e => setB({ theme: e.target.value })}>{themes.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <label className="gsx-f"><span>Board</span><div className="gp-seg sm"><button className={b.dir === "dep" ? "on" : ""} onClick={() => setB({ dir: "dep" })}>Departures</button><button className={b.dir === "arr" ? "on" : ""} onClick={() => setB({ dir: "arr" })}>Arrivals</button></div></label>
      {lpa && <label className="gsx-f"><span>Gran Canaria extras</span><div className="gp-seg sm"><button className={b.sign ? "on" : ""} aria-pressed={!!b.sign} onClick={() => setB({ sign: !b.sign })}>Overhead sign</button><button className={b.dual ? "on" : ""} aria-pressed={!!b.dual} onClick={() => setB({ dual: !b.dual })}>Two screens</button></div></label>}
      {lpa && <label className="gsx-f"><span>Footer line</span><input value={b.foot ?? "keine Flugsteige per Lautsprecher Ansage"} maxLength={60} onChange={e => setB({ foot: e.target.value })} /></label>}
      <label className="gsx-f"><span>Animation</span><div className="gp-seg sm"><button className={b.anim ? "on" : ""} onClick={() => setB({ anim: true })}>Live (flip · blink · status changes)</button><button className={!b.anim ? "on" : ""} onClick={() => setB({ anim: false })}>Still</button></div></label>
    </div>
    <h3 className="gsx-h">Rows</h3>
    <div className="bs-rows">{b.rows.map((r: BRow, i: number) => <div key={i} className="bs-row">
      <input type="time" value={r.t} onChange={e => setRow(i, { t: e.target.value })} aria-label="Time" />
      <input value={r.dest} aria-label="Destination" placeholder={b.dir === "dep" ? "Destination" : "From"} maxLength={22} onChange={e => setRow(i, { dest: e.target.value })} />
      <select value={r.al} onChange={e => setRow(i, { al: e.target.value })} aria-label="Airline">{AL.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
      <input value={r.num} maxLength={8} onChange={e => setRow(i, { num: e.target.value.toUpperCase() })} aria-label="Flight" />
      <input value={r.gate} aria-label="Gate" maxLength={4} placeholder={b.dir === "dep" ? "Gate" : "Belt"} onChange={e => setRow(i, { gate: e.target.value.toUpperCase() })} />
      <select value={r.st} onChange={e => setRow(i, { st: e.target.value })} aria-label="Status">{BST.map(k => <option key={k}>{k}</option>)}</select>
      {(r.st === "Delayed" || r.st === "Gate displayed at") && <input type="time" value={r.est || ""} onChange={e => setRow(i, { est: e.target.value })} aria-label="New time" />}
      <button className="bs-del" aria-label="Remove row" onClick={() => setB({ rows: b.rows.filter((_: any, k: number) => k !== i) })}>✕</button></div>)}
      <button className="gp-btn" onClick={() => setB({ rows: [...b.rows, { t: "12:00", dest: "Paris", al: "AF", num: "AF1669", gate: "", st: "Scheduled" }].slice(0, 30) })}>+ Add row</button></div>
    {saved.length > 0 && <><h3 className="gsx-h">Saved boards</h3><div className="gsx-saved">{saved.map(x => <button key={x.name} onClick={() => setB0(x)}>{x.name}<small>{THEMES[x.theme]?.name || x.theme}</small></button>)}</div></>}
    {full && <TerminalBoard key={"f" + b.theme} iata="XXX" dir={b.dir} date={today()} onClose={() => setFull(false)} custom={data} theme0={b.theme} />}</div>;
}
