import { useEffect, useState } from "react";
import { best, fmtT, dur, liveOf, withEstArr, type Flight } from "./lib";
const R = 6371; const km = (a: number, b: number, c: number, d: number) => { const t = Math.PI / 180, x = Math.sin((c - a) * t / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin((d - b) * t / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
export type Eta = { t: string; kind: "actual" | "official" | "adsb" | "skyline"; src: string; delay: number | null };
// Best arrival estimate with its source. ADS-B ETA = remaining great-circle distance ÷ ground speed + 8 min approach, re-computed from the latest position fix.
export function etaOf(f: Flight, live?: any): Eta | null {
  const a: any = f.arr || {}; const sch = a.scheduled ? +new Date(a.scheduled) : null; const mk = (t: number, kind: Eta["kind"], src: string): Eta => ({ t: new Date(t).toISOString(), kind, src, delay: sch ? Math.round((t - sch) / 60000) : null });
  if (a.actual) return mk(+new Date(a.actual), "actual", "Actual arrival");
  const lv = live || liveOf(f); const d: any = f.destination;
  if (lv && typeof lv.lat === "number" && d?.lat != null && (lv.gs || 0) > 80 && !lv.onGround) { const rem = km(lv.lat, lv.lon, d.lat, d.lon); const at = lv.at || Date.now(); return mk(at + (rem / (lv.gs * 1.852) + 8 / 60) * 3600e3, "adsb", `Live ADS-B · ${Math.round(rem)} km to go at ${Math.round(lv.gs)} kt`); }
  if (a.estimated && !a.etaSource && !a.estimatedOnly) return mk(+new Date(a.estimated), "official", "Official estimate" + (f.source ? ` (${f.source})` : ""));
  if (a.estimated && a.etaSource) return mk(+new Date(a.estimated), "adsb", "Live ADS-B (last fix)");
  const g: any = withEstArr(f); const b = best(g.arr); if (b) { const s0 = g.arr.scheduled ? +new Date(g.arr.scheduled) : null; return { ...mk(+new Date(b), g.arr.estimated ? "skyline" : "official", g.arr.etaMethod || (g.arr.estimated ? "Skyline estimate · typical block time from departure" : g.arr.schedEst ? "Skyline estimate · typical block time (no published arrival time)" : "Scheduled")), delay: s0 && !g.arr.schedEst ? Math.round((+new Date(b) - s0) / 60000) : null }; }
  return null; }
export const useTick = (ms = 15000) => { const [, s] = useState(0); useEffect(() => { const t = setInterval(() => s(x => x + 1), ms); return () => clearInterval(t); }, [ms]); };
export function EtaLine({ f, live, compact }: { f: Flight; live?: any; compact?: boolean }) {
  useTick(); const e = etaOf(f, live); if (!e || f.status === "cancelled") return null; const tz = f.destination?.tz;
  const verb = e.kind === "actual" ? "Arrived" : "Arrives"; const est = e.kind === "actual" ? "" : e.kind === "official" && e.src === "Scheduled" ? "" : " (est.)";
  const dl = e.delay; const dtxt = dl == null ? "" : dl >= 5 ? `+${dur(dl)} vs sched` : dl <= -5 ? `${dur(dl)} early` : "on time";
  return <div className={"eta k-" + e.kind + (compact ? " c" : "")} onClick={ev => ev.stopPropagation()} title={e.src}><b>{verb} {fmtT(e.t, tz)}{est}</b>{dtxt && <span className={"eta-d " + (dl! >= 15 ? "bad" : dl! >= 5 ? "warn" : "ok")}>{dtxt}</span>}<small>{e.src}</small></div>; }
