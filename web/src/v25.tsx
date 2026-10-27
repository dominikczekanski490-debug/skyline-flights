// v25: Skyline Labs — 15 "smart" features (all rule-based or simple statistics on live data; NO LLM) + 10 utilities.
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, load, type Flight } from "./lib";
import { LABS2, LabsHome, AirportPicker, Ic2 } from "./v28";

// ---------- design-system icons (original, 24px stroke set) ----------
const sv = (d: string, extra?: ReactNode) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} />{extra}</svg>;
export const Ic: Record<string, ReactNode> = {
  heat: sv("M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z"),
  clock: sv("M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"),
  trend: sv("M3 17l6-6 4 4 8-8M15 7h6v6"),
  bolt: sv("M13 2 4 14h7l-1 8 9-12h-7z"),
  wave: sv("M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-1"),
  chat: sv("M4 5h16v11H9l-5 4z"),
  cloud: sv("M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.2A3.5 3.5 0 0 0 7 18z"),
  people: sv("M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2 .6 3.3 2.6 3.5 5.5"),
  shield: sv("M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z", <path d="M9 12l2 2 4-4" />),
  life: sv("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"),
  sun: sv("M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"),
  doc: sv("M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6"),
  medal: sv("M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8 10 5 2h5l2 5 2-5h5l-3 8"),
  split: sv("M6 3v6a6 6 0 0 0 6 6h0a6 6 0 0 1 6 6M18 3v6M6 21v-6"),
  gauge: sv("M12 14l4-4M3.5 18a9 9 0 1 1 17 0z"),
  download: sv("M12 3v12M7 10l5 5 5-5M4 21h16"),
  pin: sv("M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"),
  bars: sv("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  compare: sv("M4 6h7v14H4zM13 10h7v10h-7z"),
  gate: sv("M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-6h6v6M2 21h20"),
  globe: sv("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"),
  pen: sv("M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"),
  sliders: sv("M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6"),
  image: sv("M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-.01"),
  moon: sv("M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"),
  plane: sv("M10.5 21l1.5-6-7-1.5 1-2 7 .5L16 4a1.5 1.5 0 0 1 2.5 1.2L17 12l4 1-.5 2-4.5-.5L14 21z"),
  flask: sv("M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"),
  chev: sv("M9 6l6 6-6 6"),
  back: sv("M15 6l-6 6 6 6"),
  plus: sv("M12 5v14M5 12h14"),
  link: sv("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  upload: sv("M12 21V9M7 14l5-5 5 5M4 3h16"),
  bell: sv("M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"),
  key: sv("M14.5 9.5a4 4 0 1 0-1 2.6L21 19.5V22h-3v-2h-2v-2h-2l-2-2"),
  info: sv("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01"),
  palette: sv("M12 21a9 9 0 1 1 9-9c0 2.5-2 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3A1.5 1.5 0 0 1 12 21zM7.5 11v.01M10 7.5v.01M14.5 7.5v.01M17 11v.01"),
  user: sv("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6"),
  db: sv("M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"),
  cal: sv("M4 6h16v15H4zM4 10h16M8 3v5M16 3v5"),
  share: sv("M12 3v13M7 8l5-5 5 5M5 13v8h14v-8"),
  search: sv("M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5"),
  route: sv("M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h4M18 9v6a4 4 0 0 1-4 4h-4"),
  tower: sv("M9 21l1-10h4l1 10M8 11h8M12 11V7M7 7h10l-2-4H9zM6 21h12"),
  list: sv("M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01"),
  board: sv("M3 5h18v14H3zM3 9h18M7 13h4M7 16h6M15 13h2M15 16h2"),
  land: sv("M3 21h18M4.5 9.5l2-1 3 3 4.5-.5 6 2.5c.8.4.6 1.6-.3 1.6L8 15z"),
  check: sv("M5 12.5l4.5 4.5L19 7"),
  trash: sv("M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"),
  star: sv("M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"),
  bag: sv("M6 8h12l-1 13H7zM9 8V6a3 3 0 0 1 6 0v2"),
  ticket: sv("M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v3h18v-3a2 2 0 0 1 0-4 2 2 0 0 1 0-4V5H3zM14 5v14"),
};

// ---------- shared data helpers ----------
const ls = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } };
const tOf = (f: any, dir: string) => (dir === "dep" ? f.dep : f.arr) || {};
export const delayMin = (f: any, dir = "dep") => { const t = tOf(f, dir); const s = t.scheduled, r = t.actual || t.estimated; return s && r ? Math.round((+new Date(r) - +new Date(s)) / 6e4) : null; };
const isCx = (f: any) => f.status === "cancelled" || /cancel/i.test(f.statusText || "");
const hourIn = (iso: string, tz: string) => +new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).slice(0, 2);
const hm = (iso?: string, tz?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "—";
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const alName = (f: any) => f.airline?.name || f.airline?.iata || f.number?.slice(0, 2) || "?";
const other = (f: any, dir: string) => dir === "dep" ? f.destination : f.origin;
const BC = new Map<string, Promise<any>>();
export function getBoard(iata: string, dir = "dep", off = 0) { const k = iata + dir + off + Math.floor(Date.now() / 18e4); if (!BC.has(k)) { const p = api(`/airport/${iata}`).catch(() => ({})).then(async (a: any) => { const tz = a?.tz || a?.airport?.tz || "Europe/London"; const ymd = new Date(Date.now() + off * 864e5).toLocaleDateString("en-CA", { timeZone: tz }); const b = await api(`/board/${iata}?dir=${dir}&date=${ymd}`); return { ...b, tz }; }); p.catch(() => BC.delete(k)); BC.set(k, p); } return BC.get(k)!; }
const dayOff = () => +(sessionStorage.getItem("sk.labs.day") || 0);
function useBoard(iata: string, dir = "dep") { const [s, set] = useState<{ d?: any; e?: string; ld: boolean }>({ ld: true }); const off = dayOff();
  useEffect(() => { if (!/^[A-Z]{3}$/.test(iata)) return; let on = true; set({ ld: true }); getBoard(iata, dir, off).then(d => on && set({ d, ld: false })).catch(e => on && set({ e: String(e.message || e), ld: false })); return () => { on = false; }; }, [iata, dir, off]); return s; }
function DaySeg({ on }: { on: () => void }) { const d = dayOff(); const set = (n: number) => { sessionStorage.setItem("sk.labs.day", String(n)); on(); };
  return <div className="lab-seg"><button className={d === -1 ? "on" : ""} onClick={() => set(-1)}>Yesterday</button><button className={d === 0 ? "on" : ""} onClick={() => set(0)}>Today</button></div>; }
const pulseList = (): string[] => ls("sk.pulse", ["SKG", "BUD", "IST", "LCA"]);

// ---------- small UI primitives ----------
const Kind = ({ k }: { k: string }) => <span className={"lab-kind k-" + k.toLowerCase()}>{k}</span>;
const Stat = ({ l, v, tone }: { l: string; v: ReactNode; tone?: string }) => <div className={"lab-stat " + (tone || "")}><b>{v}</b><span>{l}</span></div>;
const Note = ({ children }: { children: ReactNode }) => <div className="lab-note">{children}</div>;
const Src = ({ d }: { d: any }) => d ? <div className="lab-src">Data: {d.provider || d.source || "live board"}{d.sourceKind && d.sourceKind !== "official" ? " (not an official timetable)" : ""}</div> : null;
function AptPick({ v, set }: { v: string; set: (s: string) => void; label?: string }) { return <AirportPicker v={v} set={set} />; }
function Gate({ b, children }: { b: { d?: any; e?: string; ld: boolean }; children: (d: any) => ReactNode }) {
  if (b.ld) return <div className="lab-load"><i /><i /><i /></div>; if (b.e) return <Note>Board unavailable: {b.e}</Note>;
  if (!b.d?.flights?.length) return <Note>No flights on this board today.{b.d?.officialUrl && <> <a href={b.d.officialUrl} target="_blank" rel="noopener">Airport website ↗</a></>}</Note>; return <>{children(b.d)}<Src d={b.d} /></>; }
const useApt = (_k: string, d?: string) => { const [a, sa] = useState<string>(() => d || ls("sk.labs.apt", pulseList()[0] || "SKG")); return [a, (x: string) => { sa(x); localStorage.setItem("sk.labs.apt", JSON.stringify(x)); }] as const; };
const Bar = ({ v, max, tone }: { v: number; max: number; tone?: string }) => <div className="lab-bar"><i className={tone} style={{ width: `${Math.max(2, Math.min(100, (v / (max || 1)) * 100))}%` }} /></div>;
const tone = (d: number) => d >= 30 ? "bad" : d >= 15 ? "warn" : "good";

// ================= SMART (rule-based / statistical) =================
function Heatmap({ apt: a0 }: any) { const [apt, setApt] = useApt("h", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const F = d.flights.filter((f: any) => delayMin(f) != null && f.dep?.scheduled); const als = Object.entries(F.reduce((m: any, f: any) => ((m[alName(f)] ||= []).push(f), m), {})).sort((x: any, y: any) => y[1].length - x[1].length).slice(0, 7) as [string, any[]][];
    const hrs = [...new Set(F.map((f: any) => Math.floor(hourIn(f.dep.scheduled, d.tz) / 3) * 3))].sort((x: any, y: any) => x - y) as number[];
    if (!als.length) return <Note>No flights with a known delay yet today.</Note>;
    return <><div className="lab-heat" style={{ gridTemplateColumns: `90px repeat(${hrs.length},1fr)` }}><span />{hrs.map(h => <span key={h} className="hh">{String(h).padStart(2, "0")}</span>)}
      {als.map(([n, L]) => <Fragment key={n}><span className="hn">{n}</span>{hrs.map(h => { const x = L.filter(f => Math.floor(hourIn(f.dep.scheduled, d.tz) / 3) * 3 === h).map(f => delayMin(f)!); const m = x.length ? Math.round(mean(x)) : null; return <span key={n + h} className={"hc " + (m == null ? "" : tone(m))}>{m == null ? "" : m}</span>; })}</Fragment>)}</div>
      <Note>Average departure delay in minutes per airline, in 3-hour blocks (local time). Statistical summary of today's board only.</Note></>; }}</Gate></>; }

function BestHour({ apt: a0 }: any) { const [apt, setApt] = useApt("b", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const by: Record<number, number[]> = {}; d.flights.forEach((f: any) => { const x = delayMin(f); if (x != null && f.dep?.scheduled) (by[hourIn(f.dep.scheduled, d.tz)] ||= []).push(x); });
    const rows = Object.entries(by).filter(([, v]) => v.length >= 2).map(([h, v]) => ({ h: +h, m: median(v), n: v.length })).sort((x, y) => x.h - y.h); if (!rows.length) return <Note>Not enough flights with known delays yet.</Note>;
    const best = [...rows].sort((x, y) => x.m - y.m)[0], worst = [...rows].sort((x, y) => y.m - x.m)[0]; const mx = Math.max(...rows.map(r => r.m), 10);
    return <><div className="lab-stats"><Stat l="Smoothest hour" v={`${String(best.h).padStart(2, "0")}:00`} tone="good" /><Stat l="Roughest hour" v={`${String(worst.h).padStart(2, "0")}:00`} tone="bad" /></div>
      {rows.map(r => <div key={r.h} className="lab-row"><span className="mono">{String(r.h).padStart(2, "0")}:00</span><Bar v={Math.max(0, r.m)} max={mx} tone={tone(r.m)} /><b>{Math.round(r.m)}′</b><span className="faint">{r.n}</span></div>)}
      <Note>Median delay of flights scheduled in each local hour today (hours with 2+ flights). Past pattern, not a guarantee.</Note></>; }}</Gate></>; }

function Trend({ apt: a0 }: any) { const [apt, setApt] = useApt("t", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const P = d.flights.map((f: any) => [f.dep?.scheduled ? +new Date(f.dep.scheduled) / 36e5 : NaN, delayMin(f)]).filter(([x, y]: any) => Number.isFinite(x) && y != null && x * 36e5 <= Date.now() + 36e5) as [number, number][];
    if (P.length < 5) return <Note>Need at least 5 flights with known delays; {P.length} so far.</Note>;
    const mx = mean(P.map(p => p[0])), my = mean(P.map(p => p[1])); const slope = P.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / (P.reduce((s, [x]) => s + (x - mx) ** 2, 0) || 1);
    const last = P.filter(p => p[0] * 36e5 > Date.now() - 2 * 36e5).map(p => p[1]); const verdict = slope > 2 ? ["Getting worse", "bad"] : slope < -2 ? ["Recovering", "good"] : ["Holding steady", "warn"];
    const x0 = Math.min(...P.map(p => p[0])), x1 = Math.max(...P.map(p => p[0])), y1 = Math.max(30, ...P.map(p => p[1])), y0 = Math.min(0, ...P.map(p => p[1])); const X = (x: number) => 8 + (x - x0) / ((x1 - x0) || 1) * 304, Y = (y: number) => 112 - (y - y0) / ((y1 - y0) || 1) * 104;
    return <><div className="lab-stats"><Stat l="Trend" v={verdict[0]} tone={verdict[1]} /><Stat l="Slope" v={`${slope > 0 ? "+" : ""}${slope.toFixed(1)} min/h`} /><Stat l="Last 2h avg" v={last.length ? `${Math.round(mean(last))}′` : "—"} /></div>
      <svg className="lab-chart" viewBox="0 0 320 120">{P.map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r="2.6" className={tone(y)} />)}<line x1={X(x0)} y1={Y(my + slope * (x0 - mx))} x2={X(x1)} y2={Y(my + slope * (x1 - mx))} className="fit" /></svg>
      <Note>Least-squares line through delay vs scheduled time for flights that have left or are due within the hour. Simple linear statistics.</Note></>; }}</Gate></>; }

function Outliers({ apt: a0, open }: any) { const [apt, setApt] = useApt("o", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const D = d.flights.map((f: any) => ({ f, x: delayMin(f) })).filter((r: any) => r.x != null); const m = mean(D.map((r: any) => r.x)), s = sd(D.map((r: any) => r.x)) || 1;
    const O = D.map((r: any) => ({ ...r, z: (r.x - m) / s })).filter((r: any) => r.z >= 2 && r.x >= 20).sort((x: any, y: any) => y.z - x.z);
    return <><div className="lab-stats"><Stat l="Board mean" v={`${Math.round(m)}′`} /><Stat l="Std dev" v={`${Math.round(s)}′`} /><Stat l="Outliers" v={O.length} tone={O.length ? "bad" : "good"} /></div>
      {O.map((r: any) => <button key={r.f.id} className="lab-row press" onClick={() => open?.(r.f)}><b className="mono">{r.f.number}</b><span>{other(r.f, "dep")?.city || "—"}</span><b className="bad-t">+{r.x}′</b><span className="faint">z {r.z.toFixed(1)}</span></button>)}
      {!O.length && <Note>Nothing unusual: no flight is 2+ standard deviations above today's mean.</Note>}<Note>Z-score test on today's departures (z ≥ 2 and ≥ 20 min). Flags anomalies; it does not know the cause.</Note></>; }}</Gate></>; }

function Waves() { const L = pulseList(); const [r, sr] = useState<any[] | null>(null);
  useEffect(() => { Promise.all(L.map(a => getBoard(a, "dep", dayOff()).then(d => ({ a, d })).catch(() => ({ a, d: null })))).then(sr); }, []);
  if (!r) return <div className="lab-load"><i /><i /><i /></div>;
  const W = r.flatMap(({ a, d }) => { if (!d?.flights) return []; const by: Record<string, any[]> = {}; d.flights.filter(isCx).forEach((f: any) => (by[alName(f)] ||= []).push(f)); return Object.entries(by).map(([n, L]) => ({ a, n, L, tot: d.flights.filter((f: any) => alName(f) === n).length })); }).filter(w => w.L.length >= 2 || w.L.length / (w.tot || 1) >= .25).sort((x, y) => y.L.length - x.L.length);
  return <>{W.map(w => <div key={w.a + w.n} className="lab-card bad"><b>{w.n} at {w.a}</b><span>{w.L.length} of {w.tot} flights cancelled: {w.L.map(f => f.number).slice(0, 6).join(", ")}</span></div>)}
    {!W.length && <Note>No cancellation clusters right now at {L.join(", ")}.</Note>}<Note>Rule: an airline is flagged when it has 2+ cancellations, or 25%+ of its flights cancelled, on one airport's board today. Watching your Pulse airports ({L.join(", ")}).</Note></>; }

const AL_ALIASES: Record<string, string> = { ryanair: "FR", easyjet: "U2", wizz: "W6", aegean: "A3", olympic: "OA", turkish: "TK", pegasus: "PC", lufthansa: "LH", "british airways": "BA", ba: "BA", jet2: "LS", tui: "BY", sky: "GQ", lot: "LO", ajet: "VF" };
export function parseQuery(q: string) { const s = q.toLowerCase(); const o: any = {};
  const af = s.match(/after (\d{1,2})(?::?(\d\d))?/); if (af) o.after = +af[1] * 60 + +(af[2] || 0); const bf = s.match(/before (\d{1,2})(?::?(\d\d))?/); if (bf) o.before = +bf[1] * 60 + +(bf[2] || 0);
  if (/cancel/.test(s)) o.cx = true; if (/late|delay/.test(s)) o.late = true; if (/on time|punctual/.test(s)) o.ontime = true;
  for (const [k, v] of Object.entries(AL_ALIASES)) if (new RegExp(`\\b${k}\\b`).test(s)) o.al = v;
  const to = s.match(/\b(?:to|for|from) ([a-z .'-]+?)(?= after| before| that| which| late| on time| cancel|$)/); if (to) o.place = to[1].trim(); return o; }
function AskBoard({ apt: a0, open }: any) { const [apt, setApt] = useApt("q", a0); const [q, sq] = useState("late flights after 18"); const b = useBoard(apt); const P = parseQuery(q);
  return <><AptPick v={apt} set={setApt} /><input className="lab-input" value={q} onChange={e => sq(e.target.value)} placeholder="e.g. Ryanair to Italy after 18" />
    <div className="lab-chips">{["cancelled", "late flights after 18", "Aegean to Athens", "on time before 12"].map(x => <button key={x} onClick={() => sq(x)}>{x}</button>)}</div>
    <div className="lab-parsed">Understood: {Object.keys(P).length ? Object.entries(P).map(([k, v]) => `${k}=${v === true ? "yes" : k === "after" || k === "before" ? `${String(Math.floor(+v! / 60)).padStart(2, "0")}:${String(+v! % 60).padStart(2, "0")}` : v}`).join(" · ") : "nothing yet"}</div>
    <Gate b={b}>{d => { const R = d.flights.filter((f: any) => { const t = f.dep?.scheduled; const mm = t ? (() => { const [h, m] = hm(t, d.tz).split(":"); return +h * 60 + +m; })() : null; const x = delayMin(f); const pl = other(f, "dep");
      return (!P.after || (mm != null && mm >= P.after)) && (!P.before || (mm != null && mm < P.before)) && (!P.cx || isCx(f)) && (!P.late || (x != null && x >= 15)) && (!P.ontime || (x != null && x < 15 && !isCx(f))) && (!P.al || f.airline?.iata === P.al || f.number?.startsWith(P.al)) && (!P.place || [pl?.city, pl?.country, pl?.name, pl?.iata].some(z => String(z || "").toLowerCase().includes(P.place))); });
      return <>{R.slice(0, 40).map((f: any) => <button key={f.id} className="lab-row press" onClick={() => open?.(f)}><b className="mono">{hm(f.dep?.scheduled, d.tz)}</b><span><b>{f.number}</b> {other(f, "dep")?.city}</span><span className={isCx(f) ? "bad-t" : ""}>{isCx(f) ? "Cancelled" : delayMin(f) != null ? `${delayMin(f)! > 0 ? "+" : ""}${delayMin(f)}′` : f.statusText || ""}</span></button>)}<Note>{R.length} match. Keyword parser (rule-based), not an AI model: understands airline names, “to/from place”, after/before HH, late, cancelled, on time.</Note></>; }}</Gate></>; }

function wxScore(m: any) { if (!m) return null; const R: [string, number][] = []; const ws = m.wspd || 0, gs = m.wgst || 0; const vis = typeof m.visib === "string" ? parseFloat(m.visib) : m.visib ?? 10; const ceil = Math.min(...(m.clouds || []).filter((c: any) => /BKN|OVC|VV/.test(c.cover)).map((c: any) => c.base ?? 99999), 99999); const raw = m.rawOb || "";
  if (gs >= 35 || ws >= 30) R.push([`Strong wind ${ws}kt${gs ? ` gusting ${gs}` : ""}`, 3]); else if (gs >= 25 || ws >= 20) R.push([`Gusty wind ${ws}kt${gs ? `/${gs}` : ""}`, 2]);
  if (vis < 1) R.push([`Very low visibility ${vis} sm`, 3]); else if (vis < 3) R.push([`Reduced visibility ${vis} sm`, 2]);
  if (ceil < 300) R.push([`Low cloud base ${ceil} ft`, 3]); else if (ceil < 1000) R.push([`Cloud base ${ceil} ft`, 1]);
  if (/TS/.test(raw)) R.push(["Thunderstorm reported", 3]); if (/FZ|SN|PL|GR/.test(raw)) R.push(["Snow / ice / freezing precipitation", 3]); if (/\bFG\b/.test(raw)) R.push(["Fog", 2]);
  const s = Math.min(10, R.reduce((a, [, w]) => a + w, 0)); return { s, R, raw }; }
function WxOps({ apt: a0 }: any) { const [apt, setApt] = useApt("w", a0); const [w, sw] = useState<any>(null); const [e, se] = useState("");
  useEffect(() => { sw(null); se(""); api(`/wx/${apt}`).then(sw).catch(x => se(String(x.message))); }, [apt]); const m = w?.metar?.[0]; const sc = wxScore(m);
  return <><AptPick v={apt} set={setApt} />{e ? <Note>{e}</Note> : !w ? <div className="lab-load"><i /><i /><i /></div> : !sc ? <Note>No METAR available for {apt}.</Note> : <>
    <div className="lab-gauge"><svg viewBox="0 0 120 70"><path d="M10 62a50 50 0 0 1 100 0" className="trk" /><path d="M10 62a50 50 0 0 1 100 0" className={"val " + (sc.s >= 5 ? "bad" : sc.s >= 2 ? "warn" : "good")} strokeDasharray={`${sc.s * 15.7} 999`} /></svg><b>{sc.s}/10</b><span>{sc.s >= 5 ? "Likely disruption" : sc.s >= 2 ? "Some impact possible" : "Benign"}</span></div>
    {sc.R.map(([t, wt]) => <div key={t} className="lab-row"><span>{t}</span><b>+{wt}</b></div>)}{!sc.R.length && <Note>No significant weather in the latest report.</Note>}
    <div className="lab-raw mono">{sc.raw}</div><Note>Rule-based score from the latest METAR (wind, gusts, visibility, ceiling, storms, snow, fog) via {w.source}. Our own weighting; not an airline or ATC forecast.</Note></>}</>; }

function Peaks({ apt: a0 }: any) { const [apt, setApt] = useApt("p", a0); const b = useBoard(apt); const a = useBoard(apt, "arr");
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const all = [...d.flights.map((f: any) => f.dep?.scheduled), ...(a.d?.flights || []).map((f: any) => f.arr?.scheduled)].filter(Boolean); const bins: Record<number, number> = {}; all.forEach((t: string) => { const [h, m] = hm(t, d.tz).split(":"); const k = +h * 2 + (+m >= 30 ? 1 : 0); bins[k] = (bins[k] || 0) + 1; });
    const ks = Array.from({ length: 48 }, (_, i) => bins[i] || 0); const nz = ks.filter(Boolean); const thr = mean(nz) + sd(nz); const mx = Math.max(...ks, 1); const peaks = ks.map((v, i) => ({ v, i })).filter(x => x.v >= thr && x.v > 2).sort((x, y) => y.v - x.v).slice(0, 4);
    const lab = (i: number) => `${String(i >> 1).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
    return <><svg className="lab-chart" viewBox="0 0 336 110">{ks.map((v, i) => <rect key={i} x={i * 7} y={100 - v / mx * 92} width="5.5" height={v / mx * 92} rx="1.5" className={v >= thr && v > 2 ? "bad" : "good"} />)}{[0, 12, 24, 36].map(i => <text key={i} x={i * 7} y="109" className="ax">{lab(i)}</text>)}</svg>
      <div className="lab-chips">{peaks.map(p => <span key={p.i} className="pk">{lab(p.i)} · {p.v} movements</span>)}</div><Note>Scheduled departures + arrivals per 30 min (local). Red bars exceed mean + 1σ: expect busier security and gates. Statistical; actual queues are not measured.</Note></>; }}</Gate></>; }

function useMine() { return useMemo(() => load().filter((f: Flight) => !f.friend && !f.example && f.status !== "landed" && f.status !== "cancelled"), []); }
function TripRisk() { const L = useMine(); const [R, sR] = useState<Record<string, any>>({});
  useEffect(() => { L.slice(0, 6).forEach(f => { Promise.all([api(`/predict/${f.number}?date=${f.date}`).catch(() => null), f.origin?.iata ? api(`/wx/${f.origin.iata}`).catch(() => null) : null]).then(([p, w]) => sR(r => ({ ...r, [f.id]: { p, w: wxScore(w?.metar?.[0]) } }))); }); }, []);
  if (!L.length) return <Note>No upcoming flights saved. Add one from the search button to get a risk score.</Note>;
  return <>{L.slice(0, 6).map(f => { const r = R[f.id]; const pd = r?.p?.predictedDelay ?? null; const pts: [string, number][] = [];
    if (pd != null) pts.push([`Predicted delay ${Math.round(pd)} min`, pd >= 45 ? 4 : pd >= 20 ? 2 : pd >= 10 ? 1 : 0]); if (r?.w) pts.push([`Origin weather ${r.w.s}/10`, Math.round(r.w.s / 2.5)]);
    const dl = delayMin(f); if (dl != null && dl >= 15) pts.push([`Already ${dl} min late`, dl >= 60 ? 4 : 2]); if (f.status === "delayed") pts.push(["Status: delayed", 1]);
    const s = Math.min(10, pts.reduce((a, [, w]) => a + w, 0));
    return <div key={f.id} className={"lab-card " + (s >= 5 ? "bad" : s >= 2 ? "warn" : "good")}><div className="row between"><b>{f.number} {f.origin?.iata}→{f.destination?.iata}</b><b>{r ? `${s}/10` : "…"}</b></div><span className="faint">{f.date}</span>{pts.map(([t, w]) => <span key={t}>• {t} (+{w})</span>)}</div>; })}
    <Note>Rule-based: adds points for Skyline's delay prediction (statistical, from history), origin METAR score and current status. An estimate, not a forecast from the airline.</Note></>; }

function Rescue({ f: f0, open }: any) { const L = useMine(); const [id, sid] = useState<string>(f0?.id || L[0]?.id || ""); const f = f0 && f0.id === id ? f0 : L.find(x => x.id === id); const b = useBoard(f?.origin?.iata || "");
  return <>{L.length > 0 && <select className="lab-input" value={id} onChange={e => sid(e.target.value)}>{f0 && !L.find(x => x.id === f0.id) && <option value={f0.id}>{f0.number}</option>}{L.map(x => <option key={x.id} value={x.id}>{x.number} {x.origin?.iata}→{x.destination?.iata} {x.date}</option>)}</select>}
    {!f ? <Note>Pick a saved flight.</Note> : <Gate b={b}>{d => { const st = f.dep?.scheduled ? +new Date(f.dep.scheduled) : 0; const alt = d.flights.filter((x: any) => x.destination?.iata === f.destination?.iata && x.number !== f.number && !isCx(x) && +new Date(x.dep?.scheduled || 0) >= st - 36e5);
      const sameCity = d.flights.filter((x: any) => x.destination?.city && x.destination?.city === f.destination?.city && x.destination?.iata !== f.destination?.iata && !isCx(x));
      return <><div className="faint sm">Other flights today from {f.origin?.iata} to {f.destination?.city || f.destination?.iata}</div>{[...alt, ...sameCity].map((x: any) => <button key={x.id} className="lab-row press" onClick={() => open?.(x)}><b className="mono">{hm(x.dep?.scheduled, d.tz)}</b><span><b>{x.number}</b> {alName(x)}</span><span>{x.destination?.iata}{x.airline?.iata === f.airline?.iata ? " · same airline" : ""}</span></button>)}
        {!alt.length && !sameCity.length && <Note>No other flights to {f.destination?.iata} on today's {f.origin?.iata} board. Try a nearby airport's board.</Note>}<Note>Rule-based: same destination (or same city) later today from the live board. Seats and rebooking rules are not known.</Note></>; }}</Gate>}</>; }

function Briefing() { const L = useMine(); const P = pulseList(); const [pb, spb] = useState<any[]>([]);
  useEffect(() => { Promise.all(P.slice(0, 4).map(a => getBoard(a).then(d => ({ a, d })).catch(() => null))).then(x => spb(x.filter(Boolean) as any[])); }, []);
  const lines: string[] = []; const now = Date.now();
  L.slice(0, 4).forEach(f => { const t = f.dep?.scheduled ? +new Date(f.dep.scheduled) : 0; const h = (t - now) / 36e5; const dl = delayMin(f);
    lines.push(`${f.number} ${f.origin?.city || f.origin?.iata} → ${f.destination?.city || f.destination?.iata}: ${h > 48 ? `in ${Math.round(h / 24)} days` : h > 0 ? `departs in ${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : "departure time passed"}${dl && dl >= 10 ? `, running ${dl} min late` : ""}${f.dep?.gate ? `, gate ${f.dep.gate}` : ""}.`); });
  pb.forEach(({ a, d }) => { const F = d.flights || []; const cx = F.filter(isCx).length; const D = F.map((f: any) => delayMin(f)).filter((x: any) => x != null); const late = D.filter((x: number) => x >= 15).length; if (!F.length) { lines.push(`${a}: board not available right now.`); return; }
    lines.push(`${a}: ${F.length} departures today, ${late} late${cx ? `, ${cx} cancelled` : ""}${D.length ? `, average delay ${Math.round(mean(D))} min` : ""}.`); });
  const txt = lines.join("\n");
  return <><div className="lab-brief">{lines.length ? lines.map((l, i) => <p key={i}>{l}</p>) : <p>Nothing to brief yet.</p>}</div><button className="lab-btn" onClick={() => navigator.clipboard?.writeText(txt)}>{Ic.doc} Copy briefing</button><Note>Written from a fixed template (rule-based) using your saved flights and live boards for your Pulse airports. No AI text generation.</Note></>; }

function Scorecard() { const P = pulseList(); const [r, sr] = useState<any[] | null>(null);
  useEffect(() => { Promise.all(P.map(a => getBoard(a, "dep", dayOff()).catch(() => null))).then(sr); }, []); if (!r) return <div className="lab-load"><i /><i /><i /></div>;
  const by: Record<string, { d: number[]; cx: number; n: number; ap: Set<string> }> = {}; r.forEach((d, i) => (d?.flights || []).forEach((f: any) => { const k = alName(f); const o = (by[k] ||= { d: [], cx: 0, n: 0, ap: new Set() }); o.n++; o.ap.add(P[i]); if (isCx(f)) o.cx++; const x = delayMin(f); if (x != null) o.d.push(x); }));
  const rows = Object.entries(by).filter(([, o]) => o.d.length >= 4).map(([n, o]) => ({ n, otp: Math.round(o.d.filter(x => x < 15).length / o.d.length * 100), avg: Math.round(mean(o.d)), cx: o.cx, k: o.d.length, ap: [...o.ap].join(" ") })).sort((a, b) => b.otp - a.otp || a.avg - b.avg);
  return <>{rows.map((x, i) => <div key={x.n} className="lab-row"><span className="faint mono">{i + 1}</span><span><b>{x.n}</b><small className="faint"> {x.ap}</small></span><Bar v={x.otp} max={100} tone={x.otp >= 80 ? "good" : x.otp >= 60 ? "warn" : "bad"} /><b>{x.otp}%</b></div>)}{!rows.length && <Note>Not enough flights with known times yet.</Note>}
    <Note>On-time = left within 15 min of schedule. Airlines with 4+ timed flights across your Pulse airports ({P.join(", ")}) today. Simple statistics.</Note></>; }

function SunFinder({ apt: a0 }: any) { const [apt, setApt] = useApt("s", a0); const b = useBoard(apt); const [W, sW] = useState<Record<string, any>>({});
  useEffect(() => { if (!b.d?.flights) return; const ds = [...new Map(b.d.flights.map((f: any) => [f.destination?.iata, f.destination])).values()].filter((x: any) => x?.lat).slice(0, 14) as any[]; sW({});
    (async () => { for (let i = 0; i < ds.length; i += 4) await Promise.all(ds.slice(i, i + 4).map(x => api(`/weather?lat=${x.lat}&lon=${x.lon}`).then(w => sW(o => ({ ...o, [x.iata]: { x, c: w.current } }))).catch(() => {}))); })(); }, [b.d]);
  const rows = Object.values(W).map((o: any) => ({ ...o, score: (o.c?.temperature_2m ?? 0) - (o.c?.cloud_cover ?? 50) / 10 - (o.c?.precipitation ?? 0) * 5 })).sort((a: any, b: any) => b.score - a.score);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{() => <>{rows.map((o: any) => <div key={o.x.iata} className="lab-row"><b className="mono">{o.x.iata}</b><span>{o.x.city}</span><span>{Math.round(o.c?.temperature_2m)}°C · {o.c?.cloud_cover}% cloud</span></div>)}{!rows.length && <div className="lab-load"><i /><i /><i /></div>}
    <Note>Today's destinations from {apt}, ranked by our own rule: temperature − cloud/10 − 5×rain mm. Current weather from Open-Meteo, first 14 destinations.</Note></>}</Gate></>; }

function RouteCompare({ apt: a0 }: any) { const [apt, setApt] = useApt("r", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const by: Record<string, Record<string, number[]>> = {}; d.flights.forEach((f: any) => { const x = delayMin(f); const k = f.destination?.iata; if (!k || x == null) return; ((by[k] ||= {})[alName(f)] ||= []).push(x); });
    const R = Object.entries(by).filter(([, m]) => Object.keys(m).length >= 2).slice(0, 12); if (!R.length) return <Note>No destination is served by two or more airlines with known times today.</Note>;
    return <>{R.map(([k, m]) => <div key={k} className="lab-card"><b>{apt} → {k}</b>{Object.entries(m).sort((a, b) => mean(a[1]) - mean(b[1])).map(([n, v], i) => <div key={n} className="row between sm"><span>{i === 0 ? "★ " : ""}{n}</span><span>{Math.round(mean(v))}′ avg · {v.length} flt</span></div>)}</div>)}<Note>Average departure delay per airline on shared routes today. Small samples: one bad flight moves the number a lot.</Note></>; }}</Gate></>; }

function Nowcast({ apt: a0 }: any) { const [apt, setApt] = useApt("n", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const done = d.flights.filter((f: any) => delayMin(f) != null && (f.dep?.actual || f.status === "departed")); const up = d.flights.filter((f: any) => !f.dep?.actual && !isCx(f) && f.status !== "departed" && +new Date(f.dep?.scheduled || 0) > Date.now() - 18e5).slice(0, 25);
    const all = mean(done.map((f: any) => delayMin(f)!)); const alM = (n: string) => { const x = done.filter((f: any) => alName(f) === n).map((f: any) => delayMin(f)!); return x.length ? { m: mean(x), n: x.length } : null; };
    if (done.length < 3) return <Note>Need at least 3 departed flights today to estimate; {done.length} so far.</Note>;
    return <>{up.map((f: any) => { const a = alM(alName(f)); const w = a ? Math.min(1, a.n / 6) : 0; const est = Math.max(0, Math.round(w * (a?.m || 0) + (1 - w) * all)); const own = delayMin(f);
      return <div key={f.id} className="lab-row"><b className="mono">{hm(f.dep?.scheduled, d.tz)}</b><span><b>{f.number}</b> {f.destination?.iata}</span><span className={"est " + tone(est)}>est +{est}′</span><span className="faint">{own != null && own > 0 ? `board +${own}′` : ""}</span></div>; })}
      <Note>Estimate = blend of this airline's average delay today (weight grows with sample size, full at 6 flights) and the airport average ({Math.round(all)}′). Labelled estimate; the board's own time always wins.</Note></>; }}</Gate></>; }

// ================= UTILITIES (no AI) =================
function Csv({ apt: a0 }: any) { const [apt, setApt] = useApt("c", a0); const [dir, sdir] = useState("dep"); const b = useBoard(apt, dir);
  const go = (d: any) => { const H = ["time_local", "flight", "airline", dir === "dep" ? "to" : "from", "status", "gate", "terminal", "delay_min"]; const rows = d.flights.map((f: any) => [hm(tOf(f, dir).scheduled, d.tz), f.number, alName(f), other(f, dir)?.iata || "", f.statusText || f.status || "", tOf(f, dir).gate || "", tOf(f, dir).terminal || "", delayMin(f, dir) ?? ""]);
    const csv = [H, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"); const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = `${apt}-${dir}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); };
  return <><AptPick v={apt} set={setApt} /><div className="lab-seg"><button className={dir === "dep" ? "on" : ""} onClick={() => sdir("dep")}>Departures</button><button className={dir === "arr" ? "on" : ""} onClick={() => sdir("arr")}>Arrivals</button></div><Gate b={b}>{d => <><div className="lab-stats"><Stat l="Rows" v={d.flights.length} /><Stat l="Columns" v={8} /></div><button className="lab-btn" onClick={() => go(d)}>{Ic.download} Download CSV</button></>}</Gate></>; }

function Dests({ apt: a0 }: any) { const [apt, setApt] = useApt("d", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const by: Record<string, Record<string, number>> = {}; d.flights.forEach((f: any) => { const x = f.destination; if (!x) return; ((by[x.country || "Other"] ||= {})[x.city || x.iata] = ((by[x.country || "Other"] ||= {})[x.city || x.iata] || 0) + 1); });
    const C = Object.entries(by).sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0));
    return <><div className="lab-stats"><Stat l="Countries" v={C.length} /><Stat l="Cities" v={C.reduce((s, [, m]) => s + Object.keys(m).length, 0)} /></div>{C.map(([c, m]) => <div key={c} className="lab-card"><b>{c}</b><span>{Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}</span></div>)}</>; }}</Gate></>; }

function Mix({ apt: a0 }: any) { const [apt, setApt] = useApt("m", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const by: Record<string, number> = {}; d.flights.forEach((f: any) => { by[alName(f)] = (by[alName(f)] || 0) + 1; }); const R = Object.entries(by).sort((a, b) => b[1] - a[1]); const mx = R[0]?.[1] || 1;
    return <>{R.slice(0, 15).map(([n, v]) => <div key={n} className="lab-row"><span>{n}</span><Bar v={v} max={mx} /><b>{v}</b><span className="faint">{Math.round(v / d.flights.length * 100)}%</span></div>)}</>; }}</Gate></>; }

function Compare() { const P = pulseList(); const [a, sa] = useState(P[0] || "SKG"), [c, sc] = useState(P[1] || "BUD"); const A = useBoard(a), B = useBoard(c);
  const m = (d: any) => { if (!d?.flights) return null; const D = d.flights.map((f: any) => delayMin(f)).filter((x: any) => x != null); return { n: d.flights.length, otp: D.length ? Math.round(D.filter((x: number) => x < 15).length / D.length * 100) : null, avg: D.length ? Math.round(mean(D)) : null, cx: d.flights.filter(isCx).length, dest: new Set(d.flights.map((f: any) => f.destination?.iata)).size }; };
  const x = m(A.d), y = m(B.d); const row = (l: string, k: string, suf = "") => <div className="lab-cmp"><b>{(x as any)?.[k] ?? "—"}{suf}</b><span>{l}</span><b>{(y as any)?.[k] ?? "—"}{suf}</b></div>;
  return <><div className="row g8"><AptPick v={a} set={sa} label="A" /><AptPick v={c} set={sc} label="B" /></div>{A.ld || B.ld ? <div className="lab-load"><i /><i /><i /></div> : <div className="lab-card">{row("Departures", "n")}{row("On time", "otp", "%")}{row("Avg delay", "avg", "′")}{row("Cancelled", "cx")}{row("Destinations", "dest")}</div>}</>; }

function Gates({ apt: a0 }: any) { const [apt, setApt] = useApt("g", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const by: Record<string, any[]> = {}; d.flights.forEach((f: any) => { if (f.dep?.gate) (by[`${f.dep.terminal ? "T" + f.dep.terminal + " " : ""}${f.dep.gate}`] ||= []).push(f); }); const R = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
    if (!R.length) return <Note>This board doesn't publish gates.</Note>; return <>{R.slice(0, 20).map(([g, L]) => <div key={g} className="lab-row"><b className="mono">{g}</b><span>{L.length} flights</span><span className="faint">{L.map(f => hm(f.dep?.scheduled, d.tz)).slice(0, 4).join(" ")}</span></div>)}<Note>Gates as published on the board so far; many airports assign gates only ~1h before departure.</Note></>; }}</Gate></>; }

function Clocks() { const L = load().filter((f: Flight) => !f.example); const tzs = [...new Map([["Europe/London", "London (you)"], ...L.flatMap((f: Flight) => [f.origin, f.destination]).filter((a: any) => a?.tz).map((a: any) => [a.tz, a.city || a.iata])] as [string, string][]).entries()]; const [, s] = useState(0);
  useEffect(() => { const t = setInterval(() => s(x => x + 1), 15000); return () => clearInterval(t); }, []);
  return <>{tzs.map(([tz, n]) => { const d = new Date(); const h = +d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).slice(0, 2); return <div key={tz} className="lab-row"><span className="clk">{h >= 7 && h < 19 ? Ic.sun : Ic.moon}</span><span><b>{n}</b><small className="faint"> {tz}</small></span><b className="mono big">{d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}</b></div>; })}<Note>Every time zone in your saved flights, from the device clock.</Note></>; }

function Diary() { const L = load().filter((f: Flight) => !f.example && !f.friend).sort((a: any, b: any) => b.date.localeCompare(a.date)); const [n, sn] = useState<Record<string, string>>(() => ls("sk.diary", {}));
  const set = (id: string, v: string) => { const o = { ...n, [id]: v }; sn(o); localStorage.setItem("sk.diary", JSON.stringify(o)); };
  if (!L.length) return <Note>No saved flights yet.</Note>; return <>{L.slice(0, 20).map(f => <div key={f.id} className="lab-card"><b>{f.date} · {f.number} {f.origin?.iata}→{f.destination?.iata}</b><textarea className="lab-input" rows={2} placeholder="Seat, meal, view, who you flew with…" value={n[f.id] || ""} onChange={e => set(f.id, e.target.value)} /></div>)}<Note>Notes stay on this phone (included in Settings → backup).</Note></>; }

function PulseCfg() { const [L, sL] = useState<string[]>(pulseList()); const [t, st] = useState(""); const save = (x: string[]) => { sL(x); localStorage.setItem("sk.pulse", JSON.stringify(x)); sessionStorage.removeItem("sk.pulse.c"); };
  return <><div className="lab-chips">{L.map(a => <button key={a} className="on" onClick={() => save(L.filter(x => x !== a))}>{a} ✕</button>)}</div><div className="row g8 mt8"><input className="lab-input" value={t} maxLength={3} placeholder="Add IATA e.g. WAW" onChange={e => st(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /><button className="lab-btn" disabled={t.length !== 3 || L.includes(t) || L.length >= 8} onClick={() => { save([...L, t]); st(""); }}>Add</button></div><Note>Up to 8 airports. Used by Airport Pulse on Home, the Briefing, Cancellation waves and the Airline scorecard.</Note></>; }

function Snapshot({ apt: a0 }: any) { const [apt, setApt] = useApt("i", a0); const b = useBoard(apt); const [u, su] = useState("");
  const draw = (d: any) => { const F = d.flights.filter((f: any) => +new Date(f.dep?.scheduled || 0) > Date.now() - 36e5).slice(0, 14); const c = document.createElement("canvas"); c.width = 1080; c.height = 260 + F.length * 72; const x = c.getContext("2d")!; x.fillStyle = "#0b0d12"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#e9d3a0"; x.font = "700 54px system-ui"; x.fillText(`${apt} Departures`, 60, 110); x.fillStyle = "#8b8f99"; x.font = "28px system-ui"; x.fillText(new Date().toLocaleString("en-GB", { timeZone: d.tz, dateStyle: "medium", timeStyle: "short" }) + " local · Skyline", 60, 160);
    F.forEach((f: any, i: number) => { const y = 240 + i * 72; x.fillStyle = i % 2 ? "#12151c" : "#0f1218"; x.fillRect(40, y - 48, 1000, 68); x.font = "600 34px ui-monospace,monospace"; x.fillStyle = "#fff"; x.fillText(hm(f.dep?.scheduled, d.tz), 60, y); x.fillText(f.number, 220, y); x.font = "32px system-ui"; x.fillText(String(f.destination?.city || f.destination?.iata || "").slice(0, 18), 440, y);
      const dl = delayMin(f); x.fillStyle = isCx(f) ? "#ff5b5b" : dl != null && dl >= 15 ? "#ffb347" : "#4ade80"; x.fillText(isCx(f) ? "Cancelled" : String(f.statusText || "Scheduled").slice(0, 14), 780, y); });
    su(c.toDataURL("image/png")); };
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => <><button className="lab-btn" onClick={() => draw(d)}>{Ic.image} Render image</button>{u && <><img src={u} className="lab-img" /><a className="lab-btn" href={u} download={`${apt}-board.png`}>{Ic.download} Save PNG</a></>}</>}</Gate></>; }

function LastOut({ apt: a0 }: any) { const [apt, setApt] = useApt("l", a0); const b = useBoard(apt);
  return <><AptPick v={apt} set={setApt} /><Gate b={b}>{d => { const by: Record<string, any[]> = {}; d.flights.filter((f: any) => !isCx(f)).forEach((f: any) => { const k = f.destination?.iata; if (k) (by[k] ||= []).push(f); });
    const R = Object.entries(by).map(([k, L]) => { const s = L.sort((a, b) => +new Date(a.dep?.scheduled) - +new Date(b.dep?.scheduled)); return { k, c: s[0].destination?.city, first: s[0], last: s[s.length - 1], n: s.length }; }).sort((a, b) => +new Date(b.last.dep?.scheduled) - +new Date(a.last.dep?.scheduled));
    return <>{R.map(r => <div key={r.k} className="lab-row"><b className="mono">{r.k}</b><span>{r.c}<small className="faint"> {r.n}×</small></span><span className="faint">first {hm(r.first.dep?.scheduled, d.tz)}</span><b>last {hm(r.last.dep?.scheduled, d.tz)}</b></div>)}<Note>Last non-cancelled departure to each destination today, from the live board.</Note></>; }}</Gate></>; }

// ---------- registry ----------
const BOARDY = new Set(["heat", "best", "trend", "outlier", "ask", "peaks", "score", "route", "csv", "dest", "mix", "cmp", "gates", "last", "waves"]);
type Lab = { id: string; n: string; d: string; k: "Statistical" | "Rule-based" | "Utility"; ic: string; el: (p: any) => ReactNode };
export const LABS: Lab[] = [
  { id: "heat", n: "Delay heatmap", d: "Airline × time-of-day delays today", k: "Statistical", ic: "heat", el: p => <Heatmap {...p} /> },
  { id: "best", n: "Best hour to fly", d: "Median delay by departure hour", k: "Statistical", ic: "clock", el: p => <BestHour {...p} /> },
  { id: "trend", n: "Is it getting worse?", d: "Delay trend line for the day", k: "Statistical", ic: "trend", el: p => <Trend {...p} /> },
  { id: "outlier", n: "Unusual delays", d: "Z-score anomaly finder", k: "Statistical", ic: "bolt", el: p => <Outliers {...p} /> },
  { id: "waves", n: "Cancellation waves", d: "Clusters across your airports", k: "Rule-based", ic: "wave", el: () => <Waves /> },
  { id: "ask", n: "Ask the board", d: "Plain-English board filter", k: "Rule-based", ic: "chat", el: p => <AskBoard {...p} /> },
  { id: "wx", n: "Weather ops risk", d: "METAR → disruption score", k: "Rule-based", ic: "cloud", el: p => <WxOps {...p} /> },
  { id: "peaks", n: "Crowd peaks", d: "Busy 30-min slots at the airport", k: "Statistical", ic: "people", el: p => <Peaks {...p} /> },
  { id: "risk", n: "Trip risk score", d: "Your flights, 0–10", k: "Rule-based", ic: "shield", el: () => <TripRisk /> },
  { id: "rescue", n: "Backup flights", d: "Same route later today", k: "Rule-based", ic: "life", el: p => <Rescue {...p} /> },
  { id: "brief", n: "Daily briefing", d: "Your flights + airports in one note", k: "Rule-based", ic: "doc", el: () => <Briefing /> },
  { id: "score", n: "Airline scorecard", d: "On-time ranking across airports", k: "Statistical", ic: "medal", el: () => <Scorecard /> },
  { id: "sun", n: "Sun finder", d: "Today's sunniest destinations", k: "Rule-based", ic: "sun", el: p => <SunFinder {...p} /> },
  { id: "route", n: "Route showdown", d: "Who's punctual on shared routes", k: "Statistical", ic: "split", el: p => <RouteCompare {...p} /> },
  { id: "now", n: "Delay nowcast", d: "Estimated delay for upcoming flights", k: "Statistical", ic: "gauge", el: p => <Nowcast {...p} /> },
  { id: "csv", n: "Export board CSV", d: "Departures or arrivals as a spreadsheet", k: "Utility", ic: "download", el: p => <Csv {...p} /> },
  { id: "dest", n: "Destinations today", d: "Countries and cities served", k: "Utility", ic: "pin", el: p => <Dests {...p} /> },
  { id: "mix", n: "Airline mix", d: "Who flies from here today", k: "Utility", ic: "bars", el: p => <Mix {...p} /> },
  { id: "cmp", n: "Compare airports", d: "Two boards side by side", k: "Utility", ic: "compare", el: () => <Compare /> },
  { id: "gates", n: "Gate usage", d: "Flights per gate", k: "Utility", ic: "gate", el: p => <Gates {...p} /> },
  { id: "clocks", n: "World clocks", d: "Every zone in your trips", k: "Utility", ic: "globe", el: () => <Clocks /> },
  { id: "diary", n: "Flight diary", d: "Notes for each flight", k: "Utility", ic: "pen", el: () => <Diary /> },
  { id: "pulse", n: "Pulse airports", d: "Choose your watched airports", k: "Utility", ic: "sliders", el: () => <PulseCfg /> },
  { id: "snap", n: "Board snapshot", d: "Share a board as an image", k: "Utility", ic: "image", el: p => <Snapshot {...p} /> },
  { id: "last", n: "Last flight out", d: "First and last departure per destination", k: "Utility", ic: "moon", el: p => <LastOut {...p} /> },
];

export function Labs({ id, apt, f, open }: { id?: string; apt?: string; f?: any; open?: (f: any) => void }) { const [sel, ss] = useState<string | null>(id || null); const [rk, srk] = useState(0); const ALL: any[] = [...LABS, ...LABS2]; const t = ALL.find(x => x.id === sel);
  if (t) return <div className="lab-tool"><button className="lab-back" onClick={() => ss(null)}>{Ic.back} Labs</button><div className="lab-th"><span className={"lab-ic k-" + t.k.split("-")[0].toLowerCase()}>{Ic[t.ic] || Ic2[t.ic]}</span><div><h2>{t.n}</h2><Kind k={t.k} /></div></div>{BOARDY.has(t.id) && <DaySeg on={() => srk(x => x + 1)} />}<Fragment key={rk}>{t.el({ apt, f, open })}</Fragment></div>;
  return <LabsHome all={ALL} pick={ss} />; }

// v26 design-system primitives
export function SecHead({ ic, title, sub, right }: { ic?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return <div className="sk-sec">{ic && <span className="sk-sec-ic">{ic}</span>}<div className="grow"><b>{title}</b>{sub && <small>{sub}</small>}</div>{right}</div>; }
export function StatTile({ ic, k, v, tone }: { ic: ReactNode; k: string; v: ReactNode; tone?: string }) {
  return <div className={"sk-stat " + (tone || "")}><span>{ic}</span><b>{v}</b><label>{k}</label></div>; }
export function ActBtn({ ic, children, onClick, tone }: { ic: ReactNode; children: ReactNode; onClick?: () => void; tone?: string }) {
  return <button className={"sk-act press " + (tone || "")} onClick={onClick}><span>{ic}</span><b>{children}</b></button>; }
