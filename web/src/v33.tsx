// v33: "Island pill" — an in-app, Dynamic-Island-style live flight pill. A PWA cannot drive the real iOS Dynamic Island /
// Live Activities (that needs a native app with ActivityKit), so this lives inside Skyline, under the notch / island safe area.
import { useEffect, useRef, useState } from "react";
import type { Flight } from "./lib";
const T = (t: any) => t?.actual || t?.estimated || t?.scheduled;
const ms = (x?: string) => x ? +new Date(x) : NaN;
export const islandOn = () => localStorage.getItem("sk.island") !== "off";
const dly = (t: any) => t?.scheduled && (t.actual || t.estimated) ? Math.round((ms(t.actual || t.estimated) - ms(t.scheduled)) / 6e4) : null;
const cd = (m: number) => { const a = Math.abs(m); const h = Math.floor(a / 60), mm = Math.round(a % 60); return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`; };
function pickNext(fl: Flight[], now: number) {
  const mine = fl.filter((f: any) => !f.friend && !f.example && f.status !== "cancelled" || (f as any).status === "cancelled" && ms(f.dep?.scheduled) > now - 3 * 36e5);
  const air = mine.find(f => ms(T(f.dep)) <= now && ms(T(f.arr)) > now && !/landed|arrived/i.test(f.status || ""));
  if (air) return air;
  return mine.filter(f => ms(T(f.dep)) > now - 15 * 6e4 && ms(T(f.dep)) < now + 48 * 36e5).sort((a, b) => ms(T(a.dep)) - ms(T(b.dep)))[0];
}
export function Island({ flights, open }: { flights: Flight[]; open: (f: Flight) => void }) {
  const [now, sn] = useState(Date.now()); const [ex, sx] = useState(false); const [on, so] = useState(islandOn()); const [bump, sb] = useState(0);
  useEffect(() => { const i = setInterval(() => sn(Date.now()), 15000); const f = () => so(islandOn()); addEventListener("sk-island", f); return () => { clearInterval(i); removeEventListener("sk-island", f); }; }, []);
  const f = pickNext(flights, now); const sig = f ? [f.id, f.dep?.gate, dly(f.dep), f.status].join("|") : ""; const prev = useRef(sig);
  useEffect(() => { if (prev.current && sig && prev.current !== sig && prev.current.split("|")[0] === sig.split("|")[0]) sb(b => b + 1); prev.current = sig; }, [sig]);
  if (!on || !f) return null;
  const d0 = ms(T(f.dep)), a0 = ms(T(f.arr)); const flying = d0 <= now && a0 > now && !/landed|arrived/i.test(f.status || "");
  const cx = f.status === "cancelled"; const dd = dly(f.dep); const p = flying ? Math.min(1, Math.max(0, (now - d0) / (a0 - d0))) : 0;
  const tone = cx ? "bad" : (dd ?? 0) >= 30 ? "bad" : (dd ?? 0) >= 15 ? "warn" : "good";
  const lbl = cx ? "Cancelled" : flying ? `Lands in ${cd((a0 - now) / 6e4)}` : d0 > now ? `Departs in ${cd((d0 - now) / 6e4)}` : "Departing";
  const hm = (x?: string, tz?: string) => x ? new Date(x).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : "—";
  return <div className={"isl " + (ex ? "ex " : "") + tone} key={bump} role="button" aria-expanded={ex} aria-label={`${f.number} ${lbl}`} onClick={() => sx(!ex)}>
    <div className="isl-c"><i className="isl-dot" /><b className="mono">{f.number}</b><span className="isl-l">{lbl}</span>{f.dep?.gate && !flying ? <span className="isl-g">G{f.dep.gate}</span> : null}</div>
    {ex && <div className="isl-x">
      <div className="isl-r"><div><b>{f.origin?.iata}</b><small>{hm(T(f.dep), f.origin?.tz)}</small></div>
        <div className="isl-bar"><i style={{ width: `${p * 100}%` }} /><span className="isl-pl" style={{ left: `${p * 100}%` }}>✈</span></div>
        <div className="ta-r"><b>{f.destination?.iata}</b><small>{hm(T(f.arr), f.destination?.tz)}</small></div></div>
      <div className="isl-m"><span>{f.statusText || f.status || "Scheduled"}</span><span>{f.dep?.terminal ? "T" + String(f.dep.terminal).replace(/^T/i, "") + " · " : ""}{f.dep?.gate ? "Gate " + f.dep.gate : "Gate not yet shown"}</span><span className={tone + "-t"}>{dd == null ? "No estimate yet" : dd > 0 ? `+${dd} min` : "On time"}</span></div>
      <button className="isl-o" onClick={e => { e.stopPropagation(); sx(false); open(f); }}>Open flight</button>
    </div>}
  </div>;
}
export function IslandToggle() { const [v, sv] = useState(islandOn()); return <div className="mt12"><label className="row g8 sm"><input type="checkbox" checked={v} onChange={e => { localStorage.setItem("sk.island", e.target.checked ? "on" : "off"); sv(e.target.checked); dispatchEvent(new Event("sk-island")); }} /> <b>Island pill</b></label>
  <div className="faint sm mt4">A live pill at the top of Skyline for your next or in-flight trip — tap to expand. It runs inside the app only: the real iPhone Dynamic Island and Live Activities need a native app, which a Home Screen web app can't use.</div></div>; }
