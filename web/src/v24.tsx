import { useEffect, useState } from "react";
import { api } from "./lib";

// v24 "Airport Pulse": live statistics computed from the airport's own board (rule-based, no LLM).
const DEF = ["SKG", "BUD", "IST", "LCA"];
type P = { iata: string; n: number; dep: number; canc: number; late: number; avg: number; top?: [string, number]; err?: string; src?: string };
const localYmd = (tz?: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz || "Europe/London" });
async function pulse(iata: string): Promise<P> {
  const ap = await api(`/airport/${iata}`).catch(() => null);
  const b = await api(`/board/${iata}?dir=dep&date=${localYmd(ap?.tz)}`);
  const L: any[] = b.flights || []; let canc = 0, late = 0, sum = 0, k = 0, dep = 0; const al: Record<string, number> = {};
  for (const f of L) { const s = String(f.status || ""); if (/cancel/i.test(s)) { canc++; const a = f.airline?.name || "?"; al[a] = (al[a] || 0) + 1; continue; }
    if (/depart|airborne|en.?route|landed/i.test(s)) dep++;
    const sc = f.dep?.scheduled, e = f.dep?.actual || f.dep?.estimated; if (sc && e) { const m = (+new Date(e) - +new Date(sc)) / 60e3; if (m > -30 && m < 600) { sum += Math.max(0, m); k++; if (m >= 15) late++; } } }
  const top = Object.entries(al).sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
  return { iata, n: L.length, dep, canc, late, avg: k ? Math.round(sum / k) : 0, top, src: b.source };
}
export function summary(p: P) {
  if (p.err) return "Board unavailable right now.";
  if (!p.n) return "No departures listed for today yet.";
  const bits: string[] = [];
  const cr = p.canc / p.n;
  if (p.canc === 0 && p.late === 0) bits.push("Running smoothly — no cancellations or 15-min+ delays reported.");
  else { if (p.canc) bits.push(`${p.canc} cancellation${p.canc > 1 ? "s" : ""}${p.top && p.top[1] > 1 ? ` (${p.top[1]} ${p.top[0]})` : ""}.`); if (p.late) bits.push(`${p.late} flight${p.late > 1 ? "s" : ""} 15+ min late, average delay ${p.avg} min.`); }
  if (cr > .1) bits.push("Disruption is high: check your flight before leaving.");
  return bits.join(" ");
}
const grade = (p: P) => p.err || !p.n ? "na" : p.canc / p.n > .1 || p.avg > 30 ? "bad" : p.canc || p.avg > 12 ? "warn" : "good";

export function AirportPulse({ push }: { push: (v: any) => void }) {
  const [list] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("sk.pulse") || "") } catch { return DEF } });
  const [data, setData] = useState<Record<string, P>>({});
  useEffect(() => { let on = true; const C: Record<string, { at: number; p: P }> = (() => { try { return JSON.parse(sessionStorage.getItem("sk.pulse.c") || "{}"); } catch { return {}; } })();
    const fresh = Object.fromEntries(list.filter(c => C[c] && Date.now() - C[c].at < 5 * 60e3).map(c => [c, C[c].p])); setData(fresh);
    list.filter(c => !fresh[c]).forEach(c => pulse(c).catch(e => ({ iata: c, n: 0, dep: 0, canc: 0, late: 0, avg: 0, err: String(e?.message || e) }) as P).then(p => { if (!p.err) { C[c] = { at: Date.now(), p }; try { sessionStorage.setItem("sk.pulse.c", JSON.stringify(C)); } catch {} } if (on) setData(d => ({ ...d, [c]: p })); }));
    return () => { on = false; }; }, [list.join()]);
  return <div className="pulse">
    <div className="pulse-h"><b>Airport pulse</b><span>Live, from each airport's own board · rule-based summary</span></div>
    {list.map(c => { const p = data[c]; return <button key={c} className={`pulse-r ${p ? grade(p) : "load"}`} onClick={() => push({ t: "board", iata: c })}>
      <i className="pulse-dot" /><span className="pulse-iata">{c}</span>
      <span className="pulse-t">{p ? summary(p) : "Reading the board…"}</span>
      {p && !p.err && <span className="pulse-n"><b>{p.n}</b>deps</span>}
    </button>; })}
  </div>;
}
