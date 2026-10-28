// v42: connection risk (b) and delay explainer (c). Rule/statistical only; every number says how it was worked out.
import { useState } from "react";
import { withEstArr, fmtT } from "./lib";
// 1-sigma uncertainty of the arrival time by ETA method (Skyline's own rule of thumb, shown to the user)
const SIG: [RegExp, number, string][] = [[/actual/i, 1, "actual landing time"], [/live/i, 6, "live ADS-B speed"], [/official|airport/i, 10, "airport/airline estimate"], [/route history/i, 15, "route history median"], [/schedule/i, 22, "schedule"]];
const erf = (x: number) => { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = (z: number) => .5 * (1 + erf(z / Math.SQRT2));
export function connRisk(a: any, b: any, mct: number, extra = 0) {
  const A: any = withEstArr(a).arr; const arr = A.actual || A.estimated || A.scheduled; const dep = b.dep?.actual || b.dep?.estimated || b.dep?.scheduled; if (!arr || !dep) return null;
  const how = A.actual ? "actual" : A.etaConf || (A.estimated ? "official" : "schedule"); const s = SIG.find(([r]) => r.test(how)) || SIG[4];
  const depSig = b.dep?.estimated ? 8 : 12; const sig = Math.sqrt(s[1] ** 2 + depSig ** 2);
  const buf = (+new Date(dep) - +new Date(arr)) / 60000 - extra; const p = Math.round(Phi((mct - buf) / sig) * 100);
  return { buf: Math.round(buf), p: Math.max(1, Math.min(99, p)), sig: Math.round(sig), basis: s[2], depSig };
}
export function ConnDetail({ c }: { c: any }) {
  const [w, setW] = useState(0); const r = connRisk(c.a, c.b, c.mct, w); if (!r) return null; const r0 = connRisk(c.a, c.b, c.mct, 0)!;
  const lvl = r.p >= 60 ? "bad" : r.p >= 25 ? "warn" : "ok";
  return <div className="cxd" onClick={e => e.stopPropagation()}>
    <div className={"cxd-p " + lvl}><b>{r.p}%</b><span>chance of missing it · Skyline estimate</span></div>
    <div className="cxd-tx">Buffer {r.buf} min against a {c.mct}-min minimum. Arrival time is from the {r0.basis} (±{SIG.find(x => x[2] === r0.basis)?.[1]} min), departure ±{r0.depSig} min; combined spread ±{r0.sig} min (normal approximation).</div>
    <div className="cxd-tx">Minimum connection time and walking time are <b>generic</b> ({c.mct} min {c.mct > 60 ? "international" : "same-country"} guidance), not the airport's published MCT. {c.same === false ? "Different airports: add ground transfer time." : ""}</div>
    <label className="cxd-w">What if {c.a.number} lands <b>{w} min</b> later? <input type="range" min={0} max={120} step={5} value={w} onChange={e => setW(+e.target.value)} /></label>
    {w > 0 && <div className="cxd-tx">Then: buffer {r.buf} min · {r.p}% risk.</div>}
  </div>;
}
// (c) delay explainer: only proven causes; "unknown" otherwise.
export function delayExplain(f: any, p: any, inb?: any) {
  const out: { k: string; t: string; src: string }[] = []; const sd = f.dep?.scheduled, ad = f.dep?.actual || f.dep?.estimated; const dm = sd && ad ? Math.round((+new Date(ad) - +new Date(sd)) / 60000) : null;
  if (dm == null || dm < 10) return { dm, out, unknown: false };
  const prev = (inb?.flights || []).find((x: any) => x.number !== f.number && x.destination?.iata === f.origin?.iata && x.arr?.scheduled);
  if (prev) { const pa = prev.arr.actual || prev.arr.estimated; const pl = pa ? Math.round((+new Date(pa) - +new Date(prev.arr.scheduled)) / 60000) : null;
    if (pl != null && pl >= 10) out.push({ k: "Late inbound aircraft", t: `${prev.number} from ${prev.origin?.iata} ${prev.arr.actual ? "arrived" : "is due"} ${pl} min late (${fmtT(pa, f.origin?.tz)})`, src: "board feed for the inbound flight" }); }
  for (const x of p?.factors || []) { if ((x.impact ?? 0) < 5) continue;
    if (x.kind === "weather") out.push({ k: "Weather", t: x.text || x.title, src: "METAR / forecast at the airport" });
    if (x.kind === "airport") out.push({ k: "Airport congestion", t: x.text || x.title, src: "delays across the airport's live board" }); }
  if (f.statusText && /strike|atc|air traffic|technical|weather|crew/i.test(f.statusText)) out.push({ k: "Reason given by the airport", t: f.statusText, src: "official board remark" });
  return { dm, out, unknown: out.length === 0 };
}
export function DelayExplainer({ f, p, inb }: any) {
  const e = delayExplain(f, p, inb); if (e.dm == null || e.dm < 10) return null;
  return <div className="card dex"><h3>Why is it delayed?</h3><div className="muted sm">{e.dm} min late · only causes backed by data are listed</div>
    {e.unknown ? <div className="dex-u mt8">Cause unknown. No late inbound aircraft, weather or congestion signal explains this delay, and the airport gives no reason.</div>
      : <ul className="dex-l mt8">{e.out.map((x, i) => <li key={i}><b>{x.k}</b><div>{x.t}</div><small>Source: {x.src}</small></li>)}</ul>}
    <div className="faint xs mt8">Rule-based explainer (no LLM). Contributing factors, not an official cause.</div></div>;
}
