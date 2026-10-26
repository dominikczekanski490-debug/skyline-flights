import { useEffect, useState } from "react";
import { api, fmtT, delay, type Flight } from "./lib";
// Where is my plane coming from? Registration + inbound leg from real sources only (board, ADS-B, rotation).
export type AcRes = { reg?: string | null; type?: string | null; typicalType?: { type: string; n: number } | null; how?: string | null; confidence?: string | null; live?: any; inbound?: any; hint?: string };
const mem: Record<string, { at: number; v: AcRes }> = {};
export function useAircraft(f: Flight) {
  const k = `${f.number}|${f.date}|${f.origin?.iata}`; const [v, setV] = useState<AcRes | null>(mem[k]?.v || null);
  useEffect(() => { if (!f.origin?.iata || f.status === "landed") return; let on = true;
    const go = () => api(`/aircraft-for?number=${encodeURIComponent(f.number)}&date=${f.date}&o=${f.origin!.iata}&d=${f.destination?.iata || ""}&dep=${f.dep?.scheduled || ""}`).then(r => { mem[k] = { at: Date.now(), v: r }; on && setV(r); }).catch(() => {});
    if (!mem[k] || Date.now() - mem[k].at > 90e3) go(); const t = setInterval(go, 3 * 60e3); return () => { on = false; clearInterval(t); }; }, [k]);
  return v;
}
const HOW: Record<string, string> = { board: "from the airline/airport", "adsb-callsign": "seen on its transponder", rotation: "likely — it flew the inbound leg (Skyline estimate)" };
export function PlaneFrom({ f, compact }: { f: Flight; compact?: boolean }) {
  const a = useAircraft(f); const reg = f.aircraft?.reg || a?.reg; const inb = a?.inbound; const d = inb ? delay(inb.arr) : null;
  const tz = f.origin?.tz; const eta = inb && (inb.arr?.actual || inb.arr?.estimated || inb.arr?.scheduled);
  const st = inb ? (inb.arr?.actual ? `landed ${fmtT(inb.arr.actual, tz)}` : inb.live?.alt ? `in the air · lands ~${fmtT(eta, tz)}` : `due ${fmtT(eta, tz)}`) : "";
  const line = inb ? <>Your plane is coming from <b>{inb.from}</b> as <b>{inb.number}</b> · {st}{d != null && d >= 5 ? <span className="lt-bad"> · {d} min late</span> : d != null && !inb.arr?.actual ? " · on time" : ""}</>
    : <>{reg ? `Inbound leg for ${reg} not known yet.` : "Aircraft not assigned yet."} <span className="faint">Usually assigned 2–3 h before departure — Skyline keeps checking.</span></>;
  if (compact) return <div className="pf-line">✈︎ {line}</div>;
  return <div className="card pf"><div className="row between"><h3>Where your plane comes from</h3>{a?.how === "rotation" && <span className="est-tag">Skyline estimate</span>}</div>
    <div className="pf-chain"><div className={"pf-n " + (inb ? "" : "dim")}><b>{inb?.from || "?"}</b><small>{inb ? inb.number : "inbound"}</small></div><i className={inb?.live?.alt ? "fly" : ""} /><div className="pf-n me"><b>{f.origin?.iata}</b><small>{f.number}</small></div><i /><div className="pf-n"><b>{f.destination?.iata}</b><small>destination</small></div></div>
    <div className="sm mt8">{line}</div>
    {inb?.live?.alt && <div className="faint xs mt4">Live: {Math.round(inb.live.alt).toLocaleString()} ft, {Math.round(inb.live.gs || 0)} kt · {inb.live.lat?.toFixed(2)}, {inb.live.lon?.toFixed(2)} (ADS-B)</div>}
    <div className="faint xs mt8">{reg ? <>Aircraft <b>{reg}</b>{a?.type || f.aircraft?.model ? ` · ${a?.type || f.aircraft?.model}` : ""} — {HOW[a?.how || "board"] || "from the airline"}</> : a?.typicalType ? <>Typical aircraft on this route: <b>{a.typicalType.type}</b> (seen on {a.typicalType.n} of today's {f.airline?.name || ""} flights here)</> : "Aircraft type not published yet."}</div></div>;
}
