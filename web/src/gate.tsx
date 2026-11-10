// Gate screens: playful recreations of three real gate-display layouts (MAG Manchester/East Midlands/Stansted,
// Kraków, Heathrow) driven by live board data, plus the Games area (Gate studio, Board studio).
// Original CSS/markup inspired by reference photos; no airport-owned logos are used — only airline wordmarks.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api, fmtT, today } from "./lib";
import { AirlineTile, BRAND, airlineName } from "./brand";
import { LOGOS } from "./logoset";
import { AL_NAMES } from "./alnames";
import { status as boardStatus, TerminalBoard, THEMES } from "./terminal";
import "./gate.css";

export type GStyle = "mag" | "krk" | "lhr";
export type GState = "wait" | "gate" | "pre" | "boarding" | "final" | "closed" | "departed" | "delayed" | "cancelled";
export type GSpec = { style: GStyle; gate: string; al: string; alName?: string; num: string; dest: string; destPl?: string; time: string; est?: string; st: GState; stPl?: string; msg?: string; next?: string; nextPl?: string; lang?: "en" | "pl" | "enpl"; anim?: "live" | "cycle" | "none"; tz?: string };

export const ST: Record<GState, { en: string; pl: string; mag: string; lhr: string; col: string; lcol: string; msg: string }> = {
  wait: { en: "PLEASE WAIT", pl: "PROSZĘ CZEKAĆ", mag: "Wait in Lounge", lhr: "Please wait", col: "#26344f", lcol: "#ffffff", msg: "Please remain in the seating area. Boarding will begin shortly." },
  gate: { en: "GATE OPEN", pl: "WYJŚCIE OTWARTE", mag: "Go to Gate", lhr: "Gate open", col: "#c98a00", lcol: "#ffd34d", msg: "This gate is now open. Please have your boarding pass and passport ready." },
  pre: { en: "PRIORITY BOARDING", pl: "WEJŚCIE PRIORYTETOWE", mag: "Priority Boarding", lhr: "Pre-boarding", col: "#16a34a", lcol: "#5fe35f", msg: "Passengers with young children or those needing assistance to board please come forward" },
  boarding: { en: "BOARDING", pl: "WEJŚCIE NA POKŁAD", mag: "Boarding", lhr: "Boarding", col: "#16a34a", lcol: "#5fe35f", msg: "Boarding now. Please have your boarding pass and passport ready for inspection." },
  final: { en: "FINAL CALL", pl: "OSTATNIE WEZWANIE", mag: "Final Call", lhr: "Final call", col: "#e3141b", lcol: "#ff5b5b", msg: "Final call. All remaining passengers please board immediately." },
  closed: { en: "GATE CLOSED", pl: "WYJŚCIE ZAMKNIĘTE", mag: "Gate Closed", lhr: "Gate closed", col: "#8f1010", lcol: "#ff8a8a", msg: "This gate is now closed." },
  departed: { en: "DEPARTED", pl: "ODLECIAŁ", mag: "Departed", lhr: "Departed", col: "#3b4557", lcol: "#c8d2e3", msg: "This flight has departed." },
  delayed: { en: "DELAYED", pl: "OPÓŹNIONY", mag: "Delayed", lhr: "Delayed", col: "#d97706", lcol: "#ffbf47", msg: "We apologise for the delay. Further information will be shown on this screen." },
  cancelled: { en: "CANCELLED", pl: "ODWOŁANY", mag: "Cancelled", lhr: "Cancelled", col: "#c62828", lcol: "#ff6b6b", msg: "This flight has been cancelled. Please contact your airline for assistance." },
};
const CYCLE: GState[] = ["wait", "gate", "pre", "boarding", "final", "closed"];
export const STYLE_NAME: Record<GStyle, string> = { mag: "Manchester · East Midlands · Stansted", krk: "Kraków (EN/PL)", lhr: "Heathrow (portrait)" };
export const styleFor = (iata?: string): GStyle => iata === "KRK" ? "krk" : iata === "LHR" ? "lhr" : "mag";
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
    time: fmtT(sched, tz), est: est && est !== sched ? fmtT(est, tz) : undefined, st: stateOf(f), stPl: f?.remarksLocal || undefined, next, nextPl, lang: style === "krk" ? "enpl" : "en", anim: "live", tz };
}

const useNow = (ms = 1000) => { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; };
/** Scales a fixed design-size screen to fit its box (keeps text crisp on iPhone). */
export function Fit({ w, h, children, max = 1 }: { w: number; h: number; children: ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement>(null); const [s, setS] = useState(0.5);
  useEffect(() => { const el = ref.current; if (!el) return; const f = () => { const W = el.clientWidth, H = el.clientHeight || 9e9; setS(Math.min(max, W / w, H / h)); }; f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, [w, h, max]);
  return <div ref={ref} className="gs-fit"><div className="gs-fit-in" style={{ width: w * s, height: h * s }}><div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "0 0" }}>{children}</div></div></div>;
}
const Dep = ({ c = "#ffd200" }: { c?: string }) => <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden><path fill={c} d="M2.5 19h19v2h-19zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 1.82 3.16.77 1.33 1.6-.43 5.31-1.42 4.35-1.16L21 11.49c.81-.23 1.28-1.05 1.07-1.85z" /></svg>;
const Banner = ({ al, name, cls }: { al: string; name?: string; cls: string }) => <AirlineTile a={{ iata: al, name: name || AL_NAMES[al] || al }} className={cls} mode={BRAND[al] ? "white" : "colour"} />;

/** One gate screen. Animations: bilingual alternation (KRK), scrolling ticker + live clock (LHR), blinking urgent status, optional status cycle. */
export function GateScreen({ s }: { s: GSpec }) {
  const now = useNow(1000); const anim = s.anim || "live";
  const st: GState = anim === "cycle" ? CYCLE[Math.floor(now / 5000) % CYCLE.length] : s.st;
  const pl = s.lang === "pl" || (s.lang === "enpl" && anim !== "none" && Math.floor(now / 4000) % 2 === 1);
  const L = ST[st]; const urgent = anim !== "none" && (st === "final" || st === "boarding" || st === "gate");
  const bg = BRAND[s.al] || "#0b2a6b"; const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: s.tz || "Europe/London" });
  if (s.style === "mag") return <div className="gs gs-mag" role="img" aria-label={`Gate ${s.gate} ${s.num} ${s.dest} ${L.mag}`}>
    <div className="gm-top"><b>{s.gate || "—"}</b><i><Dep /></i></div>
    <div className="gm-ban" style={{ background: bg }}><Banner al={s.al} name={s.alName} cls="gm-logo" /></div>
    <div className="gm-row"><span>{s.num.replace(/\s+/g, "")}</span><span className="gm-dest">{s.dest}</span><span>{s.est && st === "delayed" ? s.est : s.time}</span></div>
    <div className={"gm-bar" + (urgent && st === "final" ? " blink" : "")} style={{ background: L.col }}>{s.msg && st === "wait" ? s.msg : L.mag}{st === "delayed" && s.est ? " " + s.est : ""}</div></div>;
  if (s.style === "krk") { const dest = (pl && s.destPl ? s.destPl : s.dest).toUpperCase(); const stTxt = pl ? (s.stPl && st === s.st ? s.stPl : L.pl) : L.en;
    return <div className="gs gs-krk" role="img" aria-label={`${s.num} ${s.dest} ${L.en}`}>
      <div className="gk-ban" style={{ background: s.al === "FR" ? "#2457d6" : bg }}><Banner al={s.al} name={s.alName} cls="gk-logo" /></div>
      <div className="gk-body"><div className="gk-r1"><i className="gk-ico"><Dep c="#fff" /></i><b key={dest} className="gk-dest fade">{dest}</b><span className="gk-num">{spaced(s.num)}</span></div>
        <div className="gk-r2"><span className="gk-time">{s.est && st === "delayed" ? s.est : s.time}</span></div>
        <div key={stTxt} className={"gk-st fade" + (urgent && st === "final" ? " blink" : "")}>{stTxt}</div>
        {(s.next || s.msg) && <div key={String(pl)} className="gk-next fade">{s.next ? <><b>{pl ? "NASTĘPNY:" : "NEXT:"}</b> {pl ? s.nextPl || s.next : s.next}</> : s.msg}</div>}
        <span className="gk-tag">{s.gate || ""}</span></div></div>; }
  const tick = "Please keep your belongings with you at all times · Do not leave baggage unattended · Have your boarding pass and passport ready · ";
  return <div className="gs gs-lhr" role="img" aria-label={`Gate ${s.gate} ${s.num} ${s.dest} ${L.lhr}`}>
    <div className="gl-sign"><b>{s.gate || "—"}</b></div>
    <div className="gl-scr"><div className="gl-ban" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${bg} 62%, #fff), color-mix(in srgb, ${bg} 80%, #fff))` }}><span className="gl-name">{(s.alName || AL_NAMES[s.al] || s.al).toUpperCase()}</span><Banner al={s.al} name={s.alName} cls="gl-logo" /></div>
      <div className="gl-dest">{s.dest}</div><div className="gl-time">{s.est && st === "delayed" ? s.est : s.time}</div>
      <div className="gl-line" /><div className="gl-st"><b className={urgent && st === "final" ? "blink" : ""} style={{ color: L.lcol }}>{L.lhr}</b><span>{s.num.replace(/\s+/g, "")}</span></div><div className="gl-line" />
      <div className="gl-msg">{s.msg || L.msg}</div>
      <div className="gl-foot"><div className="gl-tick"><span className={anim === "none" ? "" : "run"}>{tick + tick}</span></div><em>{clock}</em></div></div></div>;
}
export const DIM: Record<GStyle, [number, number]> = { mag: [640, 360], krk: [640, 360], lhr: [380, 720] };

function FullScreen({ children, onClose, bg = "#05070c" }: { children: ReactNode; onClose: () => void; bg?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.requestFullscreen?.().catch(() => {}); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => { removeEventListener("keydown", k); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }; }, []);
  return createPortal(<div ref={ref} className="gs-full" style={{ background: bg }} onClick={onClose}><div className="gs-full-in">{children}</div><button className="gs-full-x" aria-label="Close fullscreen" onClick={onClose}>✕</button><span className="gs-full-hint">Tap to close</span></div>, document.body);
}

/** Live preview for a real flight (from a flight's detail or a board). Polls the origin's board for status / next-at-gate. */
export function GatePreview({ f, x, studio }: { f: any; x?: ReactNode; studio?: (s: GSpec) => void }) {
  const apt = f?.origin?.iata; const [style, setStyle] = useState<GStyle>(() => (location.hash.match(/[#&]gstyle=(mag|krk|lhr)/)?.[1] as GStyle) || styleFor(apt));
  const [board, setBoard] = useState<any[] | null>(null); const [cur, setCur] = useState(f); const [anim, setAnim] = useState<"live" | "cycle" | "none">("live"); const [full, setFull] = useState(false); const [src, setSrc] = useState("");
  useEffect(() => { if (!apt) return; let dead = false; const go = () => api(`/board/${apt}?dir=dep&date=${(f.dep?.scheduled || "").slice(0, 10) || today()}`).then(d => { if (dead) return; const L = d?.flights || []; setBoard(L); setSrc(d?.source || ""); const m = L.find((y: any) => y.id === f.id || String(y.number).replace(/\s/g, "") === String(f.number).replace(/\s/g, "")); if (m) setCur(m); }).catch(() => {}); go(); const t = setInterval(go, 60e3); return () => { dead = true; clearInterval(t); }; }, [apt, f.id]);
  const spec = { ...specFromFlight(cur, style, board || undefined), anim }; const [w, h] = DIM[style];
  return <div className="fd gp"><div className="head"><div><span className="tag">GATE SCREEN</span><h1 className="h1s">{spec.num} · {spec.dest}</h1><div className="muted sm">{spec.gate ? `Gate ${spec.gate}` : "Gate not announced yet"} · {ST[spec.st].lhr} · {apt}</div></div>{x}</div>
    <div className="px"><div className="gp-seg" role="tablist">{(["mag", "krk", "lhr"] as GStyle[]).map(k => <button key={k} role="tab" aria-selected={style === k} className={style === k ? "on" : ""} onClick={() => setStyle(k)}>{k === "mag" ? "MAN · EMA · STN" : k === "krk" ? "Kraków" : "Heathrow"}</button>)}</div>
      <div className={"gp-stage " + style} onClick={() => setFull(true)}><Fit w={w} h={h}><GateScreen s={spec} /></Fit></div>
      <div className="gp-ctl"><div className="gp-seg sm">{([["live", "Live"], ["cycle", "Simulate boarding"], ["none", "Still"]] as const).map(([k, l]) => <button key={k} className={anim === k ? "on" : ""} onClick={() => setAnim(k)}>{l}</button>)}</div>
        <button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button>{studio && <button className="gp-btn" onClick={() => studio(spec)}>Edit in Gate studio</button>}</div>
      <p className="faint xs mt8">A fun recreation of {style === "mag" ? "Manchester / East Midlands / Stansted" : style === "krk" ? "Kraków" : "Heathrow"}-style gate screens, not an official display. {anim === "cycle" ? "Simulate boarding cycles through the boarding stages; it is not the real status." : `Status, gate and time come from the live board${src ? " (" + src + ")" : ""}${spec.next ? "; the next-flight line is the next departure listed for the same gate" : ""}. Refreshes every minute.`}{!spec.gate && " The gate shows “—” until the airport publishes it."}</p></div>
    {full && <FullScreen onClose={() => setFull(false)}><Fit w={w} h={h} max={4}><GateScreen s={spec} /></Fit></FullScreen>}</div>;
}

/** Gate screens for every upcoming departure on a board that has a gate (opened from the board header). */
export function GateWall({ iata, x, open }: { iata: string; x?: ReactNode; open: (f: any) => void }) {
  const [d, setD] = useState<any>(null); useEffect(() => { api(`/board/${iata}?dir=dep&date=${today()}`).then(setD).catch(e => setD({ error: e.message })); }, [iata]);
  const style = styleFor(iata); const L = (d?.flights || []).filter((f: any) => !f.liveOnly && !["departed", "cancelled"].includes(stateOf(f)) && (gateOf(f) || style === "krk")).slice(0, 24);
  const [w, h] = DIM[style];
  return <div className="fd gp"><div className="head"><div><span className="tag">GATE SCREENS</span><h1 className="h1s">{iata} gates now</h1><div className="muted sm">Live departures{style === "krk" ? "" : " with a gate"} · tap one to open</div></div>{x}</div>
    <div className="px">{!d ? <p className="muted">Loading live board…</p> : d.error ? <p className="bad">{d.error}</p> : !L.length ? <p className="muted">No upcoming departures with a published gate right now.</p> :
      <div className={"gw-grid " + style}>{L.map((f: any) => <button key={f.id} className="gw-it" onClick={() => open(f)}><Fit w={w} h={h}><GateScreen s={{ ...specFromFlight(f, style, d.flights), anim: "live" }} /></Fit></button>)}</div>}
      <p className="faint xs mt8">Recreations for fun from the live board{d?.source ? " (" + d.source + ")" : ""}, not official displays.</p></div></div>;
}

// ---------- Games ----------
export const enc = (o: any) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const dec = (s: string) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))); } catch { return null; } };
export const DEFAULT_GATE: GSpec = { style: "mag", gate: "A7", al: "DY", num: "D84470", dest: "Stockholm", time: "20:05", st: "final", lang: "en", anim: "live" };
export const PRESETS: { n: string; s: GSpec }[] = [
  { n: "Manchester style", s: DEFAULT_GATE },
  { n: "Kraków style", s: { style: "krk", gate: "17", al: "FR", num: "FR2616", dest: "Eilat (Ovda)", destPl: "Ejlat (Ovda)", time: "07:50", st: "wait", lang: "enpl", next: "EZY 1872 MANCHESTER 10:55", nextPl: "EZY 1872 MANCHESTER 10:55", anim: "live", tz: "Europe/Warsaw" } },
  { n: "Heathrow style", s: { style: "lhr", gate: "B32", al: "BA", num: "BA109", dest: "Dubai", time: "21:25", st: "pre", lang: "en", anim: "live" } },
];
const alList = () => [...LOGOS].map(k => [k, AL_NAMES[k] || k] as const).sort((a, b) => a[1].localeCompare(b[1]));

export function GateStudio({ init }: { init?: GSpec }) {
  const [s, setS0] = useState<GSpec>(() => init || dec(location.hash.match(/[#&]g=([\w-]+)/)?.[1] || "") || JSON.parse(localStorage.getItem("sk.games.gate") || "null") || DEFAULT_GATE);
  const setS = (p: Partial<GSpec>) => setS0(o => { const n = { ...o, ...p }; localStorage.setItem("sk.games.gate", JSON.stringify(n)); return n; });
  const [full, setFull] = useState(false); const [msg, setMsg] = useState(""); const [saved, setSaved] = useState<{ n: string; s: GSpec }[]>(() => JSON.parse(localStorage.getItem("sk.games.gates") || "[]"));
  const link = () => `${location.origin}/#games=gate&g=${enc(s)}`;
  const share = async () => { const u = link(); try { if (navigator.share) await navigator.share({ url: u, title: `${s.num} gate screen` }); else { await navigator.clipboard.writeText(u); setMsg("Link copied"); } } catch { try { await navigator.clipboard.writeText(u); setMsg("Link copied"); } catch { setMsg(u); } } history.replaceState(null, "", `#games=gate&g=${enc(s)}`); };
  const save = () => { const n = [{ n: `${s.num} ${s.dest}`, s }, ...saved.filter(x => x.n !== `${s.num} ${s.dest}`)].slice(0, 20); setSaved(n); localStorage.setItem("sk.games.gates", JSON.stringify(n)); setMsg("Saved on this device"); };
  const [w, h] = DIM[s.style]; const AL = useMemo(alList, []);
  const F = (l: string, el: ReactNode) => <label className="gsx-f"><span>{l}</span>{el}</label>;
  return <div className="gsx"><div className={"gp-stage " + s.style} onClick={() => setFull(true)}><Fit w={w} h={h}><GateScreen s={s} /></Fit></div>
    <div className="gp-ctl"><button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button><button className="gp-btn" onClick={share}>Share link</button><button className="gp-btn" onClick={save}>Save</button>{msg && <span className="faint xs">{msg}</span>}</div>
    <div className="gsx-pre">{PRESETS.map(p => <button key={p.n} onClick={() => setS0(p.s)}>{p.n}</button>)}</div>
    <div className="gsx-grid">
      {F("Design", <div className="gp-seg sm">{(["mag", "krk", "lhr"] as GStyle[]).map(k => <button key={k} className={s.style === k ? "on" : ""} onClick={() => setS({ style: k, lang: k === "krk" ? "enpl" : "en" })}>{k === "mag" ? "MAN·EMA·STN" : k === "krk" ? "Kraków" : "Heathrow"}</button>)}</div>)}
      {F("Gate", <input value={s.gate} maxLength={5} onChange={e => setS({ gate: e.target.value.toUpperCase() })} />)}
      {F("Airline", <select value={s.al} onChange={e => setS({ al: e.target.value, alName: AL_NAMES[e.target.value] })}>{AL.map(([k, n]) => <option key={k} value={k}>{n} ({k})</option>)}</select>)}
      {F("Flight", <input value={s.num} maxLength={8} onChange={e => setS({ num: e.target.value.toUpperCase() })} />)}
      {F("Destination", <input value={s.dest} maxLength={24} onChange={e => setS({ dest: e.target.value })} />)}
      {s.style === "krk" && F("Destination (Polish)", <input value={s.destPl || ""} maxLength={24} placeholder="same as English" onChange={e => setS({ destPl: e.target.value || undefined })} />)}
      {F("Time", <input type="time" value={s.time} onChange={e => setS({ time: e.target.value })} />)}
      {F("Status", <select value={s.st} onChange={e => setS({ st: e.target.value as GState, stPl: undefined })}>{(Object.keys(ST) as GState[]).map(k => <option key={k} value={k}>{s.style === "krk" ? `${ST[k].en} / ${ST[k].pl}` : s.style === "lhr" ? ST[k].lhr : ST[k].mag}</option>)}</select>)}
      {s.st === "delayed" && F("New time", <input type="time" value={s.est || ""} onChange={e => setS({ est: e.target.value })} />)}
      {s.style === "krk" ? F("Next flight line", <input value={s.next || ""} maxLength={40} placeholder="EZY 1872 MANCHESTER 10:55" onChange={e => setS({ next: e.target.value.toUpperCase(), nextPl: e.target.value.toUpperCase() })} />) : F(s.style === "lhr" ? "Message" : "Wait message", <input value={s.msg || ""} maxLength={110} placeholder={s.style === "lhr" ? ST[s.st].msg : "Wait in Lounge"} onChange={e => setS({ msg: e.target.value || undefined })} />)}
      {s.style === "krk" && F("Language", <div className="gp-seg sm">{([["enpl", "EN ⇄ PL"], ["en", "English"], ["pl", "Polski"]] as const).map(([k, l]) => <button key={k} className={s.lang === k ? "on" : ""} onClick={() => setS({ lang: k })}>{l}</button>)}</div>)}
      {F("Animation", <div className="gp-seg sm">{([["live", "Animated"], ["cycle", "Boarding sequence"], ["none", "Still"]] as const).map(([k, l]) => <button key={k} className={(s.anim || "live") === k ? "on" : ""} onClick={() => setS({ anim: k })}>{l}</button>)}</div>)}
    </div>
    {saved.length > 0 && <><h3 className="gsx-h">Saved screens</h3><div className="gsx-saved">{saved.map(x => <button key={x.n} onClick={() => setS0(x.s)}>{x.n}<small>{x.s.style.toUpperCase()}</small></button>)}</div></>}
    {full && <FullScreen onClose={() => setFull(false)}><Fit w={w} h={h} max={4}><GateScreen s={s} /></Fit></FullScreen>}</div>;
}

// Board studio: user-built rows rendered by the real TerminalBoard themes (Kraków, split-flap, MAG, Heathrow, …).
type BRow = { t: string; dest: string; al: string; num: string; gate: string; st: string; est?: string };
const BST = ["Scheduled", "Wait in lounge", "Go to gate", "Boarding", "Final call", "Gate closed", "Delayed", "Departed", "Cancelled"];
export const BDEF: { name: string; theme: string; dir: string; anim: boolean; rows: BRow[] } = { name: "My board", theme: "krk", dir: "dep", anim: true, rows: [
  { t: "07:50", dest: "Eilat", al: "FR", num: "FR2616", gate: "17", st: "Wait in lounge" }, { t: "08:15", dest: "Manchester", al: "U2", num: "EZY1872", gate: "18", st: "Scheduled" },
  { t: "08:40", dest: "Warsaw", al: "LO", num: "LO3922", gate: "5", st: "Boarding" }, { t: "09:05", dest: "Budapest", al: "W6", num: "W61234", gate: "9", st: "Delayed", est: "09:45" },
  { t: "09:30", dest: "Frankfurt", al: "LH", num: "LH1365", gate: "3", st: "Final call" }, { t: "10:10", dest: "London Stansted", al: "FR", num: "FR2448", gate: "12", st: "Scheduled" }] };
const iso = (hhmm: string) => { const [h, m] = (hhmm || "00:00").split(":").map(Number); const d = new Date(); d.setUTCHours(h || 0, m || 0, 0, 0); if (+d < Date.now() - 30 * 60e3) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString(); };
/** Board rows → the flight objects TerminalBoard renders (times in UTC so they show exactly as typed). */
export function boardData(b: typeof BDEF, step = 0) {
  const flights = b.rows.map((r, i) => { const s = b.anim && step ? BST[(BST.indexOf(r.st) + (i % 3 === step % 3 ? 1 : 0)) % 7] : r.st; const t = iso(r.t);
    const side = { scheduled: t, estimated: s === "Delayed" && r.est ? iso(r.est) : t, gate: r.gate || undefined };
    const ap = { iata: "", city: r.dest, tz: "UTC" }; const home = { iata: "XXX", city: b.name, tz: "UTC" };
    return { id: "c" + i + r.num, number: r.num, airline: { iata: r.al, name: AL_NAMES[r.al] || r.al }, origin: b.dir === "dep" ? home : ap, destination: b.dir === "dep" ? ap : home, dep: b.dir === "dep" ? side : {}, arr: b.dir === "arr" ? side : {},
      statusText: s === "Scheduled" ? "" : s, status: s === "Cancelled" ? "cancelled" : s === "Departed" ? (b.dir === "dep" ? "departed" : "landed") : s === "Delayed" ? "delayed" : "scheduled", localName: r.dest.toUpperCase() }; });
  return { airport: { name: b.name, tz: "UTC", country: "" }, flights, source: "Made in Skyline Games" };
}
export function BoardStudio() {
  const [b, setB0] = useState(() => dec(location.hash.match(/[#&]b=([\w-]+)/)?.[1] || "") || JSON.parse(localStorage.getItem("sk.games.board") || "null") || BDEF);
  const setB = (p: any) => setB0((o: any) => { const n = { ...o, ...p }; localStorage.setItem("sk.games.board", JSON.stringify(n)); return n; });
  const setRow = (i: number, p: Partial<BRow>) => setB({ rows: b.rows.map((r: BRow, k: number) => k === i ? { ...r, ...p } : r) });
  const [full, setFull] = useState(false); const [step, setStep] = useState(0); const [msg, setMsg] = useState(""); const AL = useMemo(alList, []);
  useEffect(() => { if (!b.anim) return; const t = setInterval(() => setStep(s => s + 1), 7000); return () => clearInterval(t); }, [b.anim]);
  const data = useMemo(() => boardData(b, step), [b, step]);
  const [saved, setSaved] = useState<any[]>(() => JSON.parse(localStorage.getItem("sk.games.boards") || "[]"));
  const save = () => { const n = [b, ...saved.filter(x => x.name !== b.name)].slice(0, 20); setSaved(n); localStorage.setItem("sk.games.boards", JSON.stringify(n)); setMsg("Saved on this device"); };
  const share = async () => { const u = `${location.origin}/#games=board&b=${enc(b)}`; try { await navigator.clipboard.writeText(u); setMsg("Link copied"); } catch { setMsg(u); } };
  const themes = Object.entries(THEMES).map(([k, v]) => [k, v.name] as const);
  return <div className="gsx"><div className="bs-prev"><TerminalBoard key={b.theme + b.dir} iata="XXX" dir={b.dir} date={today()} onClose={() => {}} custom={data} theme0={b.theme} inline /></div>
    <div className="gp-ctl"><button className="gp-btn pri" onClick={() => setFull(true)}>⛶ Fullscreen</button><button className="gp-btn" onClick={save}>Save</button><button className="gp-btn" onClick={share}>Share link</button>{msg && <span className="faint xs">{msg}</span>}</div>
    <div className="gsx-grid">
      <label className="gsx-f"><span>Board name</span><input value={b.name} maxLength={40} onChange={e => setB({ name: e.target.value })} /></label>
      <label className="gsx-f"><span>Style</span><select value={b.theme} onChange={e => setB({ theme: e.target.value })}>{themes.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <label className="gsx-f"><span>Board</span><div className="gp-seg sm"><button className={b.dir === "dep" ? "on" : ""} onClick={() => setB({ dir: "dep" })}>Departures</button><button className={b.dir === "arr" ? "on" : ""} onClick={() => setB({ dir: "arr" })}>Arrivals</button></div></label>
      <label className="gsx-f"><span>Animation</span><div className="gp-seg sm"><button className={b.anim ? "on" : ""} onClick={() => setB({ anim: true })}>Live (flip · blink · status changes)</button><button className={!b.anim ? "on" : ""} onClick={() => setB({ anim: false })}>Still</button></div></label>
    </div>
    <h3 className="gsx-h">Rows</h3>
    <div className="bs-rows">{b.rows.map((r: BRow, i: number) => <div key={i} className="bs-row">
      <input type="time" value={r.t} onChange={e => setRow(i, { t: e.target.value })} aria-label="Time" />
      <input value={r.dest} placeholder={b.dir === "dep" ? "Destination" : "From"} maxLength={22} onChange={e => setRow(i, { dest: e.target.value })} />
      <select value={r.al} onChange={e => setRow(i, { al: e.target.value })} aria-label="Airline">{AL.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
      <input value={r.num} maxLength={8} onChange={e => setRow(i, { num: e.target.value.toUpperCase() })} aria-label="Flight" />
      <input value={r.gate} maxLength={4} placeholder={b.dir === "dep" ? "Gate" : "Belt"} onChange={e => setRow(i, { gate: e.target.value.toUpperCase() })} />
      <select value={r.st} onChange={e => setRow(i, { st: e.target.value })} aria-label="Status">{BST.map(k => <option key={k}>{k}</option>)}</select>
      {r.st === "Delayed" && <input type="time" value={r.est || ""} onChange={e => setRow(i, { est: e.target.value })} aria-label="New time" />}
      <button className="bs-del" aria-label="Remove row" onClick={() => setB({ rows: b.rows.filter((_: any, k: number) => k !== i) })}>✕</button></div>)}
      <button className="gp-btn" onClick={() => setB({ rows: [...b.rows, { t: "12:00", dest: "Paris", al: "AF", num: "AF1669", gate: "", st: "Scheduled" }].slice(0, 30) })}>+ Add row</button></div>
    {saved.length > 0 && <><h3 className="gsx-h">Saved boards</h3><div className="gsx-saved">{saved.map(x => <button key={x.name} onClick={() => setB0(x)}>{x.name}<small>{THEMES[x.theme]?.name || x.theme}</small></button>)}</div></>}
    {full && <TerminalBoard key={"f" + b.theme} iata="XXX" dir={b.dir} date={today()} onClose={() => setFull(false)} custom={data} theme0={b.theme} />}</div>;
}

export function GamesView({ x, tab0, more, init }: { x?: ReactNode; tab0?: string; more?: () => void; init?: GSpec }) {
  const [t, setT] = useState<"home" | "gate" | "board">(() => (tab0 === "gate" || tab0 === "board" ? tab0 : "home"));
  const demo = PRESETS.map(p => p.s);
  return <div className="fd games"><div className="gm-hero"><div><span className="tag">GAMES</span><h1 className="h1s">Games</h1><div className="muted sm">Build your own animated gate screens and departure boards</div></div>{x}</div>
    <div className="v54-tabs" role="tablist">{([["home", "All games"], ["gate", "Gate studio"], ["board", "Board studio"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
    {t === "home" ? <div className="px gm-home">
      <button className="gm-card" onClick={() => setT("gate")}><div className="gm-card-art">{demo.map((s, i) => <div key={i} className={"gm-mini " + s.style}><Fit w={DIM[s.style][0]} h={DIM[s.style][1]}><GateScreen s={s} /></Fit></div>)}</div><b>Gate studio</b><span>Make an animated boarding-gate screen in Manchester, Kraków (English/Polish) or Heathrow style. Share it or show it fullscreen.</span></button>
      <button className="gm-card" onClick={() => setT("board")}><div className="gm-card-art board"><div className="gm-flap">{"DEPARTURES".split("").map((c, i) => <i key={i} style={{ animationDelay: i * 90 + "ms" }}>{c}</i>)}</div></div><b>Board studio</b><span>Build a departures or arrivals board row by row in 30+ airport styles: Kraków, split-flap, Manchester, Heathrow and more, with flips, blinking statuses and live changes.</span></button>
      {more && <button className="gm-card slim" onClick={more}><b>Quizzes & mini-games</b><span>Codle, map quiz, touchdown and more in Play & Plan.</span></button>}</div>
      : t === "gate" ? <div className="px"><GateStudio init={init} /></div> : <div className="px"><BoardStudio /></div>}</div>;
}
