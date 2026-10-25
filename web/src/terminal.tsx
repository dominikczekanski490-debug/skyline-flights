import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtT, delay } from "./lib";
import { AirlineTile, BRAND } from "./brand";

// Original CSS recreations inspired by reference photos of each airport's screens (see refs/). Not official designs.
type Col = "time" | "dest" | "fl" | "logo" | "tag" | "gate" | "term" | "st" | "icon" | "est" | "tile";
type Th = { name: string; cls: string; cols: Col[]; title: (dir: string) => [string, string]; panels?: number; clock: "top" | "bottom" | "box"; heads?: Partial<Record<Col, string>> };
export const THEMES: Record<string, Th> = {
  mag: { name: "MAG (MAN/STN/EMA)", cls: "tb-mag", cols: ["tile", "time", "dest", "fl", "st", "gate"], clock: "bottom", title: d => [d === "dep" ? "Airside Departures" : "Arrivals", ""], heads: { tile: "", time: "Time", dest: "Destination", fl: "Flight", st: "Remark", gate: "Gate" } },
  lhr: { name: "Heathrow", cls: "tb-lhr", cols: ["time", "dest", "fl", "st"], panels: 2, clock: "box", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  fra: { name: "Frankfurt", cls: "tb-fra", cols: ["fl", "dest", "time", "icon", "term", "gate"], clock: "top", title: d => d === "dep" ? ["Abflug", "Departures"] : ["Ankunft", "Arrivals"], heads: { fl: "Flug Flight", dest: "Ziel Destination", time: "Zeit Time", icon: "", term: "Terminal", gate: "Gate" } },
  avinor: { name: "Avinor (OSL)", cls: "tb-avinor", cols: ["time", "tag", "dest", "gate", "st"], panels: 2, clock: "top", title: d => d === "dep" ? ["Avgang", "Departure"] : ["Ankomst", "Arrival"], heads: { time: "Tid", tag: "Fly", dest: "Til / To", gate: "Gate", st: "Merknad" } },
  syd: { name: "Sydney", cls: "tb-syd", cols: ["logo", "fl", "dest", "time", "est", "gate", "st"], panels: 2, clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""], heads: { logo: "", fl: "Flight", dest: "Destination", time: "Sched", est: "Est", gate: "Gate", st: "Status" } },
  ams: { name: "Schiphol", cls: "tb-ams", cols: ["time", "dest", "fl", "gate", "st"], panels: 2, clock: "top", title: d => d === "dep" ? ["Flight departures", "Vertrekken"] : ["Flight arrivals", "Aankomsten"] },
  cdg: { name: "Paris CDG", cls: "tb-cdg", cols: ["dest", "fl", "time", "term", "st"], clock: "top", title: d => d === "dep" ? ["Départs", "Departures"] : ["Arrivées", "Arrivals"], heads: { dest: "Destination", fl: "Vol Flight", time: "Heure Time", term: "Term.", st: "Remarques" } },
  solari: { name: "Split-flap", cls: "tb-solari", cols: ["fl", "dest", "time", "gate", "st"], clock: "top", title: d => [d === "dep" ? "Departures" : "Arrivals", ""] },
  led: { name: "Amber LED", cls: "tb-led", cols: ["time", "fl", "dest", "gate", "st"], panels: 2, clock: "bottom", title: d => d === "dep" ? ["Départs", "Departures"] : ["Arrivées", "Arrivals"] },
};
const NORDIC = /^(OSL|BGO|TRD|SVG|TOS|BOO|AES|KRS|HAU|EVE|ALF|BDU|MOL|KSU|LKL|HFT|VDS|KKN|ANX|SSJ|MQN|FRO|SOG|HOV|ORW|SDN|FDE|RRS|BNN|MJF|RVK|VAW|BVG|SKN|SVJ|LKN|VRY|RET|NVK|HAA|BJF|MEH|OSY|NTB|SOJ)$/;
export const autoTheme = (iata: string) => /^(MAN|STN|EMA)$/.test(iata) ? "mag" : /^(LHR|LGW)$/.test(iata) ? "lhr" : iata === "FRA" ? "fra" : NORDIC.test(iata) ? "avinor" : /^(SYD|MEL|BNE)$/.test(iata) ? "syd" : iata === "AMS" ? "ams" : /^(CDG|ORY)$/.test(iata) ? "cdg" : "led";
const Tile = ({ a }: { a: any }) => <AirlineTile a={a} className="tb-tile" mode={BRAND[a?.iata] ? "white" : "colour"} />;
const HEAD: Record<Col, string> = { tile: "", time: "Time", dest: "Destination", fl: "Flight", logo: "", tag: "Flight", gate: "Gate", term: "Term", st: "Remarks", icon: "", est: "Est" };
const tagColor = (c = "") => { if (BRAND[c]) return BRAND[c]; let h = 0; for (const x of c) h = (h * 31 + x.charCodeAt(0)) % 360; return `hsl(${h} 45% 32%)`; };

// Board remark from the feed's own status text only. Supported vocabularies (checked live):
// MAN/STN/EMA: Wait in Lounge, Go to Gate N, Boarding - Gate N, Final Call - Gate N, Departed, Cancelled; arr: Expected hh:mm, On Approach, Arrived hh:mm, Cancelled.
// FRA: Scheduled, Gate open, Boarding, Closed, Off Block, Departed, Cancelled; arr: Approaching, Delayed departure, Landed, On position, Baggage delivery (finished).
// Avinor: New time (E), Departed (D), Arrived (A), Cancelled (C). Sydney: On Time, Delayed, Departed, Arrived, Cancelled, Diverted.
function status(f: any, dir: string) {
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

export function TerminalBoard({ iata, dir: dir0, date, onClose }: { iata: string; dir: string; date: string; onClose: () => void }) {
  const [dir, setDir] = useState(dir0); const [d, setD] = useState<any>(null); const [theme, setTheme] = useState(() => localStorage.getItem("sk.tb." + iata) || "auto");
  const [page, setPage] = useState(0); const [paused, setPaused] = useState(false); const [now, setNow] = useState(Date.now()); const [upd, setUpd] = useState<number>(0); const [side, setSide] = useState(() => localStorage.getItem("sk.tb.side") || "Airside"); const [sec, setSec] = useState<any>(null);
  useEffect(() => { api(`/security/${iata}`).then(setSec).catch(() => setSec(null)); }, [iata]);
  const ref = useRef<HTMLDivElement>(null); const th = theme === "auto" || !THEMES[theme] ? autoTheme(iata) : theme;
  useEffect(() => { let on = true; const go = () => api(`/board/${iata}?dir=${dir}&date=${date}`).then(r => { if (on) { setD(r); setUpd(Date.now()); } }).catch(e => on && setD((p: any) => p || { error: e.message })); go(); const t = setInterval(go, 60e3); return () => { on = false; clearInterval(t); }; }, [iata, dir, date]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { localStorage.setItem("sk.tb." + iata, theme); }, [theme]);
  useEffect(() => { const el = ref.current; el?.requestFullscreen?.().then(() => (screen.orientation as any)?.lock?.("landscape").catch(() => {})).catch(() => {}); return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }; }, []);
  const tz = d?.airport?.tz || "Europe/London";
  const rows = useMemo(() => (d?.flights || []).filter((f: any) => !f.liveOnly).filter((f: any) => { const t = dir === "dep" ? f.dep : f.arr; const b = +new Date(t.actual || t.estimated || t.scheduled); if (b < Date.now() - 90 * 60e3 && f.status !== "landed") return false; return f.status === "cancelled" ? +new Date(t.scheduled) > Date.now() - 30 * 60e3 : (f.status !== "departed" && f.status !== "landed") || b > Date.now() - 15 * 60e3; })
    .sort((a: any, b: any) => ((dir === "dep" ? a.dep : a.arr).scheduled < (dir === "dep" ? b.dep : b.arr).scheduled ? -1 : 1)), [d, dir]);
  const live = d?.liveOnly; const per = typeof innerHeight === "number" && innerHeight < 520 ? 8 : 12; const panels = (THEMES[th].panels || 1) > 1 && typeof innerWidth === "number" && innerWidth > innerHeight ? THEMES[th].panels! : 1; const pages = Math.max(1, Math.ceil(rows.length / (per * panels)));
  useEffect(() => { if (paused) return; const t = setInterval(() => setPage(p => (p + 1) % pages), 9000); return () => clearInterval(t); }, [paused, pages]);
  const pg = Math.min(page, pages - 1); void 0; const vis = rows.slice(pg * per, pg * per + per); const solari = th === "solari";
  const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: th === "led" ? "2-digit" : undefined, timeZone: tz });
  const tt0 = THEMES[th]; const tt: Th = th === "mag" ? { ...tt0, title: d => [d === "dep" ? `${side} Departures` : "Arrivals", ""], heads: { ...tt0.heads, gate: dir === "arr" ? "Belt" : "Gate", dest: dir === "arr" ? "From" : "Destination" } } : tt0;
  const show = vis.length ? rows.slice(pg * per * panels, pg * per * panels + per * panels) : [];
  const cellOf = (f: any, c: Col, st: any) => { const t = dir === "dep" ? f.dep : f.arr; const ap = dir === "dep" ? f.destination : f.origin; const ltz = (dir === "dep" ? f.origin?.tz : f.destination?.tz) || tz;
    const txt = (v: string, w: number) => solari ? <Flap text={v} w={w} /> : v;
    switch (c) {
      case "time": return txt(fmtT(t.scheduled, ltz), 5);
      case "est": { const e = t.actual || t.estimated; return e && e !== t.scheduled ? fmtT(e, ltz) : ""; }
      case "dest": return txt(ap?.city || ap?.name || ap?.iata || "", 15);
      case "fl": return <span className="tb-fl">{!solari && th !== "mag" && th !== "syd" && <Logo a={f.airline} />}{txt(th === "fra" ? f.number.replace(/^([A-Z0-9]{2})/, "$1 ") : f.number, 7)}</span>;
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
    <div className="tb-head" style={{ gridTemplateColumns: grid }}>{tt.cols.map(c => <span key={c}>{(tt.heads || {})[c] ?? (c === "gate" && dir === "arr" ? "Belt" : c === "dest" && dir === "arr" ? "From" : HEAD[c])}</span>)}</div>
    <div className="tb-rows">{list.map((f: any, i: number) => { const st = status(f, dir);
      return <div key={f.id + pg + i + (solari ? st.txt : "")} className={"tb-row " + (i % 2 ? "alt" : "")} style={{ gridTemplateColumns: grid }}>{tt.cols.map(c => <span key={c} className={"c-" + c}>{cellOf(f, c, st)}</span>)}{fraSt(st)}</div>; })}</div></div>;
  const W: Record<Col, string> = { tile: "minmax(110px,.9fr)", time: th === "mag" ? "92px" : "58px", est: "52px", dest: "minmax(0,1.5fr)", fl: "minmax(150px,1fr)", logo: "110px", tag: "84px", gate: "52px", term: "54px", st: "minmax(0,1.3fr)", icon: "26px" };
  const grid = tt.cols.map(c => W[c]).join(" ") + (th === "fra" ? " minmax(0,1fr)" : "");
  const msg = !d ? "Loading live board…" : d.error ? d.error : live ? `No official schedule feed for ${iata}. The terminal view needs scheduled times, so use the list view for live ADS-B traffic.` : rows.length === 0 ? `No more ${dir === "dep" ? "departures" : "arrivals"} listed for this date.` : "";
  return <div ref={ref} style={{ ["--per" as any]: per }} className={"tboard " + tt.cls + (paused ? " paused" : "")} onClick={() => setPaused(p => !p)}>
    {(panels === 1 || !["avinor", "ams", "led"].includes(th)) && <div className="tb-top"><div className="tb-title"><b>{tt.title(dir)[0]}</b>{tt.title(dir)[1] && <span>{tt.title(dir)[1]}</span>}</div>
      <div className="tb-ap">{d?.airport?.name || iata}{sec && <span className="tb-sec">{sec.available ? "Security " + sec.queues.filter((q: any) => q.kind === "Departures").map((q: any) => `${q.terminal} ${q.text}`).join(" · ") : "Security: no live queue data"}</span>}</div>{tt.clock === "top" && <div className="tb-clock">{clock}</div>}</div>}
    {msg ? <div className="tb-msg">{msg}</div> : <div className="tb-panels">{Array.from({ length: panels }, (_, k) => panel(show.slice(k * per, k * per + per), k))}</div>}
    {tt.clock !== "top" && <div className={"tb-bclock " + tt.clock}>{clock}</div>}
    <div className="tb-foot"><span>{paused ? "Paused - tap to resume" : `Page ${pg + 1} of ${Math.max(1, Math.ceil(rows.length / (per * panels)))}`}</span>
      <span>{upd ? "Updated " + new Date(upd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : ""}{d?.source ? " · " + d.source : ""}</span>
      <span className="tb-ctl" onClick={e => e.stopPropagation()}>
        <select value={dir} onChange={e => { setDir(e.target.value); setPage(0); }}><option value="dep">Departures</option><option value="arr">Arrivals</option></select>
        {th === "mag" && dir === "dep" && <select value={side} onChange={e => { setSide(e.target.value); localStorage.setItem("sk.tb.side", e.target.value); }}><option>Airside</option><option>Landside</option></select>}
        <select value={theme} onChange={e => setTheme(e.target.value)}><option value="auto">Auto ({THEMES[autoTheme(iata)].name})</option>{Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        <button onClick={onClose}>Close</button></span></div>
  </div>;
}
