// v48 stage 3: "At the airport today" — rules over today's real airport boards (gate predecessor, terminal rush, belt share, arrival wave),
// UK bank-holiday travel flag (GOV.UK), gate-call log (what the board showed, when Skyline saw it). Every rule is shown in the UI.
import { useEffect, useState } from "react";
import { api, fmtT, best, delay, type Flight } from "./lib";
const ms = (s?: string | null) => s ? +new Date(s) : NaN;
const SCOT = new Set(["EDI", "GLA", "ABZ", "INV", "PIK", "DND", "SYY", "KOI", "LSI", "BEB", "BRR", "TRE", "ILY", "CAL", "WIC"]), NI = new Set(["BFS", "BHD", "LDY"]);
function useBoard(iata?: string, dir?: string, date?: string, on = true) { const [d, setD] = useState<any>(null);
  useEffect(() => { if (!on || !iata || !date) return; let dead = false; api(`/board/${iata}?dir=${dir}&date=${date}`).then(j => !dead && setD(j.flights?.length && !j.liveOnly ? j : { none: true })).catch(() => !dead && setD({ none: true })); return () => { dead = true; }; }, [iata, dir, date, on]);
  return d; }
const same = (a: any, f: Flight) => a.number === f.number || a.id === f.id;
export function gateLog(f: Flight) { const k = "sk.gatelog." + f.id; const L: [string, number][] = JSON.parse(localStorage.getItem(k) || "[]"); const g = (f.dep as any)?.gateAction as string | undefined;
  if (g && (!L.length || L[L.length - 1][0] !== g)) { L.push([g, Date.now()]); localStorage.setItem(k, JSON.stringify(L.slice(-8))); } return L; }
export function AirportToday({ f }: { f: Flight }) { const [open, setOpen] = useState(false); const o = f.origin?.iata, t = f.destination?.iata;
  const dep = useBoard(o, "dep", f.date, open), arr = useBoard(t, "arr", f.date, open); const [bh, setBh] = useState<any>(null);
  useEffect(() => { if (open && f.origin?.country === "United Kingdom") api("/bankhol").then(setBh).catch(() => {}); }, [open]);
  const log = gateLog(f); const tzO = f.origin?.tz, tzD = f.destination?.tz;
  // own rows from the boards (fresher gate/belt info than the flight object)
  const me = dep?.flights?.find((x: any) => same(x, f)); const meA = arr?.flights?.find((x: any) => same(x, f));
  const myDep = ms(best(me?.dep || f.dep)), myGate = me?.dep?.gate || f.dep.gate, myTerm = me?.dep?.terminal || f.dep.terminal;
  if (me) gateLog({ ...f, dep: me.dep } as any);
  // 1 gate predecessor
  const prev = myGate && dep?.flights ? dep.flights.filter((x: any) => !same(x, f) && x.dep?.gate === myGate && x.status !== "cancelled" && ms(best(x.dep)) < myDep).sort((a: any, b: any) => ms(best(b.dep)) - ms(best(a.dep)))[0] : null;
  const gap = prev ? Math.round((myDep - ms(best(prev.dep))) / 6e4) : null; const pd = prev ? delay(prev.dep) : null;
  const gateMsg = !myGate ? "No gate on the board yet." : !prev ? `No earlier departure from gate ${myGate} today on the board.` : gap! < 45 && (pd ?? 0) >= 15 ? `⚠️ ${prev.number} leaves gate ${myGate} ${gap} min before you and is running +${pd} min — boarding at this gate may start late.` : `${prev.number} uses gate ${myGate} ${gap} min before you${pd != null && pd >= 5 ? ` (+${pd} min)` : ""} — no knock-on expected.`;
  // 2 terminal rush: departures from the same terminal in the 2 h before yours vs every 2 h window today
  const tl = dep?.flights?.filter((x: any) => !x.liveOnly && (!myTerm || x.dep?.terminal === myTerm)).map((x: any) => ms(x.dep.scheduled)).filter((n: number) => !isNaN(n)) || [];
  const win = (end: number) => tl.filter((n: number) => n > end - 7200e3 && n <= end).length; const mine = !isNaN(myDep) && tl.length ? win(myDep) : null;
  const all = tl.map(win); const pct = mine != null && all.length ? Math.round(all.filter((n: number) => n < mine).length / all.length * 100) : null;
  // 3 belt share + 4 arrival wave at destination
  const myArr = ms(best(meA?.arr || f.arr)), belt = meA?.arr?.baggage || (f.arr as any)?.baggage;
  const near = arr?.flights?.filter((x: any) => !same(x, f) && x.status !== "cancelled" && Math.abs(ms(best(x.arr)) - myArr) <= 20 * 60e3) || [];
  const beltMates = belt ? (arr?.flights || []).filter((x: any) => !same(x, f) && x.arr?.baggage === belt && Math.abs(ms(best(x.arr)) - myArr) <= 30 * 60e3) : [];
  // 5 bank holiday
  const div = o && SCOT.has(o) ? "scotland" : o && NI.has(o) ? "northern-ireland" : "england-and-wales";
  const hol = bh?.divisions?.[div]?.find((e: any) => Math.abs(Date.parse(e.date) - Date.parse(f.date)) <= 3 * 864e5);
  return <details className="card m0 mt8 dg at" onToggle={ev => setOpen((ev.target as HTMLDetailsElement).open)}><summary><b>At the airport today</b><small> {open ? "tap to close" : "your gate, terminal rush, bags, arrival queue"}</small></summary>
    {!dep && !arr ? <p className="muted sm">Reading today's boards…</p> : <div className="bl-g">
      <section><h4>Your gate's earlier flight · {o}</h4>{dep?.none ? <p className="sm muted">No official board for {o}, so this can't be checked.</p> : <><p className="sm">{gateMsg}</p><small className="muted">Rule: the last departure from your gate before you; flagged if it leaves under 45 min before you and is 15+ min late.</small></>}</section>
      {!dep?.none && <section><h4>Terminal rush{myTerm ? ` · T${String(myTerm).replace(/^T/, "")}` : ""}</h4>{mine != null ? <><p className="sm"><b>{mine}</b> departures from {myTerm ? "your terminal" : o} in the 2 h before yours — {pct! >= 75 ? "🚶‍♂️ one of the busiest spells today; allow extra time at security" : pct! <= 25 ? "a quiet spell for today" : "about average for today"} (busier than {pct}% of today's 2-hour windows).</p><small className="muted">Rule: count scheduled departures from the same terminal in the 2 h before yours, ranked against the same count ending at every departure today. ≥ 75th percentile = busy. Board counts, not queue times.</small></> : <p className="sm muted">No scheduled time to compare.</p>}</section>}
      <section><h4>Landing at {t}</h4>{arr?.none ? <p className="sm muted">No official arrivals board for {t}, so arrival wave and belt can't be checked.</p> : isNaN(myArr) ? <p className="sm muted">No arrival time yet.</p> : <>
        <p className="sm"><b>{near.length}</b> other arrival{near.length === 1 ? "" : "s"} within 20 min of yours (~{fmtT(new Date(myArr).toISOString(), tzD)}). {near.length >= 8 ? "🛂 Arrival wave — expect longer passport and bag-hall queues." : near.length >= 4 ? "Moderately busy arrival spell." : "Quiet arrival spell."}</p>
        <small className="muted">Rule: 8+ arrivals within ±20 min = wave, 4–7 = moderate. Counted from the arrivals board.</small>
        <p className="sm mt8">{belt ? <>Belt <b>{belt}</b>: {beltMates.length ? <>shared with {beltMates.map((x: any) => x.number).join(", ")} within 30 min — {beltMates.length >= 2 ? "bags may take longer to appear." : "light sharing."}</> : "no other flight on it within 30 min."}</> : "No baggage belt on the board yet."}</p>
        {belt && <small className="muted">Rule: flights on the same belt within ±30 min of your landing; 2+ = busy belt.</small>}</>}</section>
      {f.origin?.country === "United Kingdom" && <section><h4>UK bank holiday</h4><p className="sm">{!bh ? "Checking GOV.UK…" : hol ? <>🎉 <b>{hol.title}</b> is {hol.date === f.date ? "on your travel day" : `on ${hol.date}, within 3 days of your flight`} — bank-holiday getaway days are usually busier at UK airports.</> : `No ${div.replace(/-/g, " ")} bank holiday within 3 days of your flight.`}</p><small className="muted">Rule: a {div.replace(/-/g, " ")} bank holiday within ±3 days of departure. Source: GOV.UK.</small></section>}
      <section><h4>Gate calls seen</h4>{log.length ? log.map(([g, at]) => <div key={g + at} className="row between sm"><span>{g}</span><span className="muted">first seen {fmtT(new Date(at).toISOString(), tzO)}</span></div>) : <p className="sm muted">No gate call (Go to gate, Boarding, Final call…) seen yet. Skyline logs each new one while this flight is open.</p>}</section>
      <div className="faint xs">Official airport boards via Skyline{dep?.source ? ` (${dep.source})` : ""}. Rules use today's board only.</div></div>}
  </details>; }
