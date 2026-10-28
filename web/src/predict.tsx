// v15: Flighty-style glass prediction card. Reasons come only from real model signals (inbound, weather, congestion, official revised times).
import { fmtT } from "./lib";
const Spark = ({ s = 16 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" className="pk-spark" aria-hidden><path fill="currentColor" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" /></svg>;
export function reasonOf(p: any): string | null {
  const fs = (p?.factors || []).filter((x: any) => ["inbound", "weather", "airport", "official"].includes(x.kind) && (x.impact ?? 0) > 0).sort((a: any, b: any) => (b.impact || 0) - (a.impact || 0));
  const x = fs[0]; if (!x) return null; const at = x.data?.where || x.data?.airport;
  if (x.kind === "inbound") return "Due to the late inbound aircraft";
  if (x.kind === "weather") return `Due to weather conditions${at ? " at " + at : ""}`;
  if (x.kind === "airport") return `Due to congestion${at ? " at " + at : ""}`;
  return "The airport is already publishing a revised time";
}
export function pillOf(p: any, status?: string) { const d = p?.predictedDelay ?? 0;
  if (p?.cancelled || status === "cancelled") return ["Cancelled", "red"]; if (status === "diverted") return ["Diverted", "red"];
  if (d >= 15) return ["Delayed", d >= 45 ? "red" : "amber"]; if (d >= 5) return ["Slight delay", "amber"]; if (d <= -5) return ["Early", "green"]; return ["On time", "green"]; }
export function PredictCard({ f, p, compact, onWhy }: { f: any; p: any; compact?: boolean; onWhy?: () => void }) {
  if (!p || p.error || !f?.dep?.scheduled) return null; const d = Math.round(p.predictedDelay ?? 0); const [pl, cls] = pillOf(p, f.status);
  const t = fmtT(new Date(+new Date(f.dep.scheduled) + d * 60000).toISOString(), f.origin?.tz); const r = reasonOf(p);
  const late = p.cancelled ? null : d >= 1 ? <span className={"pk-min " + cls}>({d}m late)</span> : d <= -1 ? <span className="pk-min green">({-d}m early)</span> : <span className="pk-min green">(on time)</span>;
  return <div className={"pk " + cls + (compact ? " pk-c" : "")} onClick={e => { if (onWhy) { e.stopPropagation(); onWhy(); } }}>
    <span className={"pk-pill " + cls}>{pl}</span>
    {!p.cancelled && <div className="pk-line"><Spark s={compact ? 14 : 18} /><span className="pk-grad">Predicted departure</span> <span className={"pk-t pk-min " + (d <= -1 || d < 1 ? "green" : cls)}>{t}</span> {late}</div>}
    {r && <div className="pk-why">{r}</div>}
    {!compact && <PredDetail f={f} p={p} d={d} />}
    {!compact && <div className="pk-note">Skyline estimate from live signals (rule/statistical model, no LLM), not an official time</div>}
  </div>;
}

// v15: "Find My Plane" card: real photo (v14/v15 photo chain), type · registration, flown-count from My Flights, inbound pill and recent legs.
import { useEffect, useState } from "react";
import { Livery } from "./livery";
import { api } from "./lib";
const CONF: Record<string, [string, string]> = { confirmed: ["Confirmed", "ok"], airline: ["Confirmed", "ok"], transponder: ["Confirmed", "ok"], likely: ["Likely", "lk"], possible: ["Possible", "ps"], typical: ["Typical", "ty"] };
export function FindMyPlane({ f, reg, hex, type, flights, inb, rs }: any) {
  const [h, setH] = useState<any>(null); const [more, setMore] = useState(false);
  useEffect(() => { setH(null); if (reg || hex) api(`/aircraft/${encodeURIComponent(reg || "-")}/history${hex ? "?hex=" + hex : ""}`).then(setH).catch(() => setH({ legs: [] })); }, [reg, hex]);
  const flown = reg ? (flights || []).filter((x: any) => x.id !== f.id && (x.aircraft?.reg || "").toUpperCase() === String(reg).toUpperCase() && x.status === "landed").length : 0;
  const prev = (inb?.flights || []).find((x: any) => x.number !== f.number && x.destination?.iata === f.origin?.iata);
  const pd = prev && prev.arr?.scheduled && (prev.arr.actual || prev.arr.estimated) ? Math.round((+new Date(prev.arr.actual || prev.arr.estimated) - +new Date(prev.arr.scheduled)) / 60000) : null;
  const legs = h?.legs || []; const shown = more ? legs : legs.slice(0, 3); const tt = (s: string | null, tz?: string) => s ? fmtT(s, tz) : "--:--";
  return <div className="fmp">
    <div className="fmp-h"><span className="fmp-t">Find My Plane</span>{flown > 0 && <span className="fmp-n">You flew {flown} time{flown > 1 ? "s" : ""} on this aircraft</span>}</div>
    <Livery code={f.airline?.iata} icao={f.airline?.icao} name={f.airline?.name} type={type} reg={reg} hex={hex} />
    {(() => { const c = CONF[rs?.confidence || (reg || hex ? "confirmed" : "typical")] || CONF.typical; const gone = !!(f.dep?.actual || ["departed", "enroute"].includes(f.status || ""));
      const why = rs?.reason || (reg || hex ? null : gone ? "In the air — matching its transponder…" : "Looking for the aircraft…");
      const i = rs?.inbound; return <div className="fmp-why"><span className={"fmp-conf " + c[1]}>{c[0]}</span>{(reg || hex) && rs?.confidence && rs.confidence !== "confirmed" ? <b> {c[0]} {reg || String(hex).toUpperCase()}</b> : null}{why && <span> {why}</span>}
        {i && <div className="fmp-inb">Inbound <b>{i.number}</b> from {i.from}{i.reg ? <> · operated by <b>{i.reg}</b></> : " · aircraft not identified yet"}{i.arr?.scheduled ? ` · due ${new Date(i.arr.scheduled).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} UK` : ""}</div>}
        {!reg && !hex && rs?.candidates?.length > 1 && <div className="fmp-inb">Candidates: {rs.candidates.map((x: any) => x.reg || x.cs).join(", ")}</div>}</div>; })()}
    {prev && <div className={"fmp-pill " + (prev.status === "landed" ? (pd != null && pd > 14 ? "red" : "green") : "blue")}>{prev.status === "landed" ? `Inbound aircraft arrived · ${pd == null ? "" : pd > 4 ? `${pd}m late` : "On time"}` : `Inbound aircraft ${prev.number} from ${prev.origin?.iata} · ${prev.statusText || prev.status}`}</div>}
    {(reg || hex) && <div className="fmp-legs"><div className="fmp-lab">Where this aircraft has been</div>
      {!h ? <div className="skel" style={{ height: 70 }} /> : !legs.length ? <div className="faint sm">No recent flight history available</div> :
        shown.map((l: any, i: number) => <div key={i} className="fmp-leg"><i className="fmp-dot" /><div className="grow"><b>{l.from || "?"} → {l.to || "?"}</b> <span className="faint sm">{l.number || ""}</span>
          <div className="faint xs">{l.dep || l.depSched ? "Dep " + tt(l.dep || l.depSched) + (l.dep ? "" : " sched") : ""}{l.arr || l.arrSched ? " · Arr " + tt(l.arr || l.arrSched) + (l.arr ? "" : " sched") : ""} · {new Date(l.dep || l.depSched || l.arr || l.arrSched).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })} · {l.source}</div></div></div>)}
      {legs.length > 3 && <button className="chip mt8" onClick={() => setMore(!more)}>{more ? "Show less" : "Show more"}</button>}
      <div className="faint xs mt4">Times UK (Europe/London). From Skyline's own board log and ADS-B take-off/landing observations, last 72 h.</div></div>}
  </div>;
}

// v42: reasoning chain, confidence, prediction timeline (kept on this device), confirmation by off-block / wheels-off.
const KIND: Record<string, string> = { inbound: "Inbound aircraft", official: "Airport revised time", weather: "Weather", airport: "Congestion", trend: "Delay trend", route: "Route history", prior: "Typical delay" };
function PredDetail({ f, p, d }: { f: any; p: any; d: number }) {
  const key = "sk.predtl." + f.id; let tl: { t: number; d: number }[] = []; try { tl = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  if (!p.cancelled && (!tl.length || tl[tl.length - 1].d !== d)) { tl = [...tl, { t: Date.now(), d }].slice(-12); try { localStorage.setItem(key, JSON.stringify(tl)); } catch {} }
  const fs = (p.factors || []).filter((x: any) => x.title).slice(0, 6); const tz = f.origin?.tz;
  const ob = f.dep?.offBlock || (f.dep?.actualKind === "offblock" ? f.dep.actual : null), to = f.dep?.takeoff || (f.dep?.actualKind !== "offblock" ? f.dep?.actual : null);
  const act = ob || to; const real = act && f.dep?.scheduled ? Math.round((+new Date(act) - +new Date(f.dep.scheduled)) / 60000) : null; const pred0 = tl.length ? tl[tl.length - 1].d : d;
  const conf = p.confidence ? p.confidence[0].toUpperCase() + p.confidence.slice(1) : null;
  return <div className="pk-det">
    {conf && <div className={"pk-conf " + p.confidence}>{conf} confidence{p.confidenceNote ? <span> · {String(p.confidenceNote).replace(/^\s*(high|medium|low) confidence\s*[—–:-]\s*/i, "").replace(/^./, (c: string) => c.toUpperCase())}</span> : null}</div>}
    {fs.length > 0 && <><div className="pk-lab">How this was worked out</div><ol className="pk-chain">{fs.map((x: any, i: number) => <li key={i}><b>{KIND[x.kind] || x.title}</b>{KIND[x.kind] && x.title ? <> · {x.title}</> : null}{x.text ? <div className="pk-tx">{x.text}</div> : null}{x.impact ? <span className={"pk-imp " + (x.impact > 0 ? "up" : "dn")}>{x.impact > 0 ? "+" : ""}{Math.round(x.impact)} min</span> : null}</li>)}</ol></>}
    {tl.length > 1 && <><div className="pk-lab">How the prediction changed</div><div className="pk-tl">{tl.map((x, i) => <div key={i} className="pk-tli"><i /><span>{new Date(x.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span><b>{x.d >= 1 ? "+" + x.d + " min" : x.d <= -1 ? x.d + " min" : "on time"}</b></div>)}</div><div className="pk-tx">Recorded on this device while you viewed the flight.</div></>}
    {act && <div className="pk-ok">✓ Confirmed: {to ? "airborne " + fmtT(to, tz) : "left the gate " + fmtT(ob, tz)}{real != null ? ` · actual ${real >= 0 ? "+" : ""}${real} min vs predicted ${pred0 >= 0 ? "+" : ""}${pred0} min` : ""}</div>}
  </div>;
}
