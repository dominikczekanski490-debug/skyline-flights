import { useEffect, useState } from "react";
import { api, fmtT, fmtD, best, delay, tzOffset, type Flight } from "./lib";
import { useAircraft } from "./inbound";
// Alternatives: real later departures from the same airport board to the same destination (shown when delayed ≥60 min or cancelled).
export function Alternatives({ f, push }: { f: Flight; push: (o: any) => void }) {
  const d = delay(f.dep) ?? 0; const bad = f.status === "cancelled" || d >= 60; const [L, setL] = useState<Flight[] | null>(null); const [force, setForce] = useState(false);
  useEffect(() => { if (!(bad || force) || !f.origin?.iata) return; api(`/board/${f.origin.iata}?dir=dep&date=${f.date}`).then(r => setL((r.flights || []).filter((x: Flight) => !(x as any).liveOnly && x.number !== f.number && x.destination?.iata === f.destination?.iata && x.status !== "cancelled" && best(x.dep) && +new Date(best(x.dep)!) > Date.now()).slice(0, 6))).catch(() => setL([])); }, [bad, force, f.id]);
  if (!bad && !force) return <button className="chip mt8" style={{ margin: "8px 16px 0" }} onClick={() => setForce(true)}>Other flights {f.origin?.iata}→{f.destination?.iata} today</button>;
  return <div className="card"><h3>{bad ? "If you need another flight" : `Other ${f.origin?.iata}→${f.destination?.iata} flights today`}</h3>
    {!L ? <div className="skel" style={{ height: 60 }} /> : !L.length ? <div className="muted sm">No later departures to {f.destination?.city || f.destination?.iata} on today's {f.origin?.iata} board.</div> :
      L.map(x => <div key={x.id} className="lrow" onClick={() => push({ t: "flight", f: x })}><b className="code">{fmtT(best(x.dep), x.origin?.tz)}</b><div className="grow"><b>{x.number}</b> <span className="muted sm">{x.airline?.name}</span><div className="faint xs">{x.statusText || x.status}{x.dep?.terminal ? ` · T${x.dep.terminal}` : ""}</div></div></div>)}
    <div className="faint xs mt8">From the live {f.origin?.iata} departures board. Seats, fares and rebooking rules aren't public — check with your airline before going to another desk.</div></div>;
}
// Flight Story: a plain-language timeline from the real times we hold.
export function FlightStory({ f }: { f: Flight }) {
  const a = useAircraft(f); const o = f.origin?.tz, t = f.destination?.tz; const dd = delay(f.dep), ad = delay(f.arr); const S: [string, string][] = [];
  const inb = a?.inbound; if (inb) S.push(["✈︎", `Your aircraft${a?.reg ? ` (${a.reg})` : ""} ${inb.arr?.actual ? `landed from ${inb.from} as ${inb.number} at ${fmtT(inb.arr.actual, o)}` : `is due in from ${inb.from} as ${inb.number} around ${fmtT(best(inb.arr || {}), o)}`}.`]);
  if (f.dep?.gate) S.push(["🚪", `Gate ${f.dep.gate}${f.dep.terminal ? `, terminal ${f.dep.terminal}` : ""}${(f.dep as any).gateAction ? ` — ${(f.dep as any).gateAction.toLowerCase()}` : ""}.`]);
  if (f.dep?.scheduled) S.push(["🛫", f.dep.actual ? `${(f.dep as any).actualKind === "offblock" && !(f.dep as any).takeoff ? "Left the gate" : "Took off"} ${fmtT((f.dep as any).takeoff || f.dep.actual, o)}${dd != null && Math.abs(dd) >= 5 ? `, ${Math.abs(dd)} min ${dd > 0 ? "late" : "early"}` : ", on time"}.` : `Scheduled off ${fmtT(f.dep.scheduled, o)}${f.dep.estimated && dd != null && dd >= 5 ? `, now expected ${fmtT(f.dep.estimated, o)} (+${dd} min)` : ""}.`]);
  if (f.arr?.scheduled || f.arr?.estimated) S.push(["🛬", f.arr.actual ? `Landed ${fmtT(f.arr.actual, t)}${ad != null && Math.abs(ad) >= 5 ? `, ${Math.abs(ad)} min ${ad > 0 ? "late" : "early"}` : ""}.` : `Due ${fmtT(best(f.arr), t)} local${f.arr.estimated ? "" : " (scheduled)"}.`]);
  if (f.arr?.baggage) S.push(["🧳", `Bags on belt ${f.arr.baggage}.`]);
  if (f.status === "cancelled") S.push(["⚠︎", "The airport lists this flight as cancelled."]);
  if (!S.length) return null;
  return <div className="card story"><h3>Flight story</h3>{S.map(([i, s], k) => <div key={k} className="st-r"><span>{i}</span><div>{s}</div></div>)}<div className="faint xs mt8">Written from the board, ADS-B and Skyline's log — nothing is filled in that the sources didn't report.</div></div>;
}
// Boarding-pass style card (not a real boarding pass — no booking data).
export function PassCard({ f }: { f: Flight }) {
  const o = f.origin?.tz; return <div className="bpass"><div className="bp-top"><span>{f.airline?.name || f.number}</span><span>{fmtD(f.date, { weekday: "short", day: "numeric", month: "short" })}</span></div>
    <div className="bp-mid"><div><b>{f.origin?.iata}</b><small>{f.origin?.city}</small></div><span className="bp-pl">✈︎</span><div className="r"><b>{f.destination?.iata}</b><small>{f.destination?.city}</small></div></div>
    <div className="bp-cut" /><div className="bp-g"><div><small>Flight</small><b>{f.number}</b></div><div><small>Departs</small><b>{fmtT(best(f.dep), o)}</b></div><div><small>Terminal</small><b>{f.dep?.terminal || "—"}</b></div><div><small>Gate</small><b>{f.dep?.gate || "—"}</b></div></div>
    <div className="faint xs" style={{ padding: "0 16px 12px" }}>Trip card — not a boarding pass. Use your airline's pass to board.</div></div>;
}
// Jet-lag helper from the real time-zone difference.
export function JetLag({ f }: { f: Flight }) {
  if (!f.origin?.tz || !f.destination?.tz) return null; const h = Math.round((tzOffset(f.destination.tz) - tzOffset(f.origin.tz)) / 60); if (Math.abs(h) < 3) return null;
  const east = h > 0; const days = Math.min(Math.abs(h), 6);
  return <div className="card"><h3>Jet-lag plan <span className="est-tag">General guidance</span></h3><div className="sm">{f.destination.city} is {Math.abs(h)} h {east ? "ahead" : "behind"}. {east ? "Travelling east is usually harder." : "Travelling west is usually easier."}</div>
    <div className="st-r mt8"><span>🌅</span><div>{east ? `For ${Math.min(3, days)} days before, go to bed ~1 h earlier each night and seek morning light.` : `For ${Math.min(3, days)} days before, go to bed ~1 h later and seek evening light.`}</div></div>
    <div className="st-r"><span>☕️</span><div>On arrival, eat and sleep on local time; avoid caffeine after 2 pm local ({f.destination.city}).</div></div>
    <div className="faint xs mt8">General sleep-hygiene guidance, not medical advice.</div></div>;
}
