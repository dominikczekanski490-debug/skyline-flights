// v41: Fraport Greece airport FIDS, styled after the airports' own departure screens (dark-blue board, bilingual header,
// live clock with seconds, striped rows). Only real feed fields are shown; empty gate/remarks stay empty.
import { useEffect, useState } from "react";
import { AirlineTile } from "./brand";
import { fmtT, delay } from "./lib";
import { status as boardStatus } from "./terminal";
import { etaOf } from "./eta";
export const FRAPORT_GR = new Set("SKG CFU CHQ KGS KVA JMK JTR MJT PVK EFL ZTH RHO SMI JSI".split(" "));
const Clock = ({ tz }: { tz: string }) => { const [n, s] = useState(Date.now()); useEffect(() => { const t = setInterval(() => s(Date.now()), 1000); return () => clearInterval(t); }, []);
  return <span className="gr-clock" aria-label="Local time">{new Date(n).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz })}</span>; };
// Remarks wording/colour like the reference: red Gate Closed / Final call, green Gate Open / Boarding, amber Delayed hh:mm.
function remark(f: any, dir: string): { t: string; k: string } { if (f.liveOnly) return { t: "", k: "" };
  const b = boardStatus(f, dir); const s = b.txt.replace(/ · Gate .*/, ""); const tz = (dir === "dep" ? f.origin : f.destination)?.tz;
  if (/cancel/i.test(s)) return { t: "Cancelled", k: "red" };
  if (/final call|closing|gate closed/i.test(s)) return { t: /final/i.test(s) ? "Final Call" : "Gate Closed", k: "red" };
  if (/boarding/i.test(s)) return { t: "Boarding", k: "green" };
  if (/gate open|go to gate/i.test(s)) return { t: "Gate Open", k: "green" };
  if (/taxiing|pushback/i.test(s)) return { t: s.replace(/ · left gate.*/, ""), k: "white" };
  if (/departed|landed|arrived|bags/i.test(s)) return { t: s.replace(/ \(est\.\)/, " est.").replace(/ \d\d:\d\d$/, ""), k: "white" };
  const t = dir === "dep" ? f.dep : f.arr; const d = delay(t);
  if (d != null && d >= 15 && t.estimated) return { t: "Delayed " + fmtT(t.estimated, tz), k: "amber" };
  if (dir === "arr" && t.estimated) return { t: "Expected " + fmtT(t.estimated, tz), k: "white" };
  return { t: /scheduled|on time/i.test(s) ? "" : s, k: "white" }; }
export function GreekBoard({ ap, dir, list, onOpen }: { ap: any; dir: string; list: any[]; onOpen: (f: any) => void }) {
  const tz = ap?.tz || "Europe/Athens"; const dep = dir === "dep";
  return <div className="grb" role="table" aria-label={dep ? "Departures" : "Arrivals"}>
    <div className="grb-hd"><span className="grb-logo" aria-hidden>{dep ? "✈" : "🛬"}</span><div className="grb-ttl"><b lang="el">{dep ? "Αναχωρήσεις" : "Αφίξεις"}</b><b>{dep ? "Departures" : "Arrivals"}</b></div><Clock tz={tz} /></div>
    <div className="grb-cols" role="row"><span>Time</span><span>Flight</span><span /><span>{dep ? "Destination" : "Origin"}</span><span>{dep ? "Gate" : "Belt"}</span><span>Remarks</span></div>
    {list.map((f, i) => { const t = dep ? f.dep : f.arr; const o = dep ? f.destination : f.origin; const r = remark(f, dir);
      const e = !dep && !t.actual ? etaOf(f) : null;
      return <div key={f.id + i} role="row" className={"grb-row " + (i % 2 ? "b" : "a")} onClick={() => onOpen(f)}>
        <span className="grb-t">{f.liveOnly ? "—" : fmtT(t.scheduled, tz)}</span><span className="grb-f">{f.number}</span>
        <span className="grb-al"><AirlineTile a={f.airline} mode="colour" style={{ width: 44, height: 18 }} /></span>
        <span className="grb-d">{o?.city || o?.name || o?.iata || ""}</span><span className="grb-g">{dep ? t.gate || "" : f.arr?.baggage || ""}</span>
        <span className={"grb-r " + r.k}>{r.t}{e && e.kind !== "official" && !r.t && <i title={e.src}>est. {fmtT(e.t, tz)}</i>}</span></div>; })}
    {!list.length && <div className="grb-empty">No flights listed</div>}
    <div className="grb-src">Fraport Greece official flight board · times local ({tz.split("/")[1]}) · names as supplied by the feed</div></div>;
}
