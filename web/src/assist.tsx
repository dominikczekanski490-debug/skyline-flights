// v19 Stage B: assistant feed, NL search, compensation, share image, Today card, airport guide. All built on real signals; estimates are labelled "Skyline estimate".
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { api, best, delay, dist, dur, fmtT, fmtD, today, withEstArr, ics, download, type Flight } from "./lib";
import { leavePlan, phaseOf } from "./big";
import { localNotify } from "./extras";
const EST = <span className="est-tag">Skyline estimate</span>;
const km = (f: Flight) => Math.round(dist(f.origin, f.destination) * 1.609);
const t = (ms: number, tz?: string) => fmtT(new Date(ms).toISOString(), tz);
const upcoming = (L: Flight[]) => L.filter(f => !f.example && !f.friend && phaseOf(f) !== "cancelled" && f.status !== "landed").sort((a, b) => (best(a.dep) || a.date) < (best(b.dep) || b.date) ? -1 : 1);

// ---- gate / terminal change detection (in-app + local notification while the app is open; server push covers background) ----
type GC = { id: string; number: string; what: string; from: string; to: string; at: number };
export function useGateChanges(L: Flight[]) {
  const [log, setLog] = useState<GC[]>(() => { try { return JSON.parse(localStorage.getItem("sk.gc") || "[]"); } catch { return []; } });
  useEffect(() => { let seen: Record<string, any> = {}; try { seen = JSON.parse(localStorage.getItem("sk.gseen") || "{}"); } catch {}
    const add: GC[] = [];
    for (const f of L) { if (f.example || f.friend) continue; const cur = { g: f.dep.gate || "", t: f.dep.terminal || "" }; const p = seen[f.id];
      if (p) for (const [k, w] of [["g", "Gate"], ["t", "Terminal"]] as const) if (p[k] && cur[k] && p[k] !== cur[k]) add.push({ id: f.id, number: f.number, what: w, from: p[k], to: cur[k], at: Date.now() });
      seen[f.id] = { g: cur.g || p?.g || "", t: cur.t || p?.t || "" }; }
    localStorage.setItem("sk.gseen", JSON.stringify(seen));
    if (add.length) { add.forEach(c => localNotify(`${c.number}: ${c.what.toLowerCase()} change`, `${c.what} ${c.from} → ${c.to}`, "gc-" + c.id)); setLog(l => { const n = [...add, ...l].slice(0, 20); localStorage.setItem("sk.gc", JSON.stringify(n)); return n; }); } }, [L]);
  return [log.filter(c => Date.now() - c.at < 12 * 3600e3), () => { localStorage.setItem("sk.gc", "[]"); setLog([]); }] as const;
}

// ---- connection risk between two of the user's flights ----
export function connections(L: Flight[]) { const U = L.filter(f => !f.example && !f.friend); const out: { a: Flight; b: Flight; buf: number; mct: number; risk: "ok" | "tight" | "high" | "missed" }[] = [];
  for (const a of U) for (const b of U) { if (a === b || a.destination?.iata !== b.origin?.iata) continue; const arr = best(withEstArr(a).arr), dep = best(b.dep); if (!arr || !dep) continue;
    const buf = (+new Date(dep) - +new Date(arr)) / 60000; if (buf < -30 || buf > 24 * 60) continue; const intl = a.origin?.country && b.destination?.country && a.origin.country !== b.destination.country;
    const mct = intl ? 75 : 50; out.push({ a, b, buf, mct, risk: buf < 0 ? "missed" : buf < mct ? "high" : buf < mct + 30 ? "tight" : "ok" }); }
  return out; }

// ---- why is my flight late: real signals only ----
function WhyLate({ f }: { f: Flight }) { const [s, setS] = useState<any>(null); const d = delay(f.dep) ?? delay(f.arr);
  useEffect(() => { if (!f.origin?.iata) return; Promise.all([api(`/wx/${f.origin.iata}`).catch(() => null), f.destination?.iata ? api(`/wx/${f.destination.iata}`).catch(() => null) : null, api(`/board/${f.origin.iata}?dir=dep`).catch(() => null), f.aircraft?.reg ? api(`/aircraft/${f.aircraft.reg}/history`).catch(() => null) : null]).then(([wo, wd, bd, h]) => setS({ wo, wd, bd, h })); }, [f.id]);
  if (!s) return <div className="faint sm">Checking weather, the airport board and the aircraft…</div>;
  const R: [string, string][] = [];
  const wx = (w: any, lab: string) => { const m = w?.metar?.[0]; if (!m) return; const bad = ["IFR", "LIFR"].includes(m.fltCat) || (m.wgst || 0) >= 30 || /TS|FG|SN|FZ/.test(m.wxString || "");
    R.push([bad ? "⚠️" : "✓", `${lab} weather ${bad ? "is poor" : "looks fine"}: ${m.fltCat || "—"}${m.wspd != null ? `, wind ${m.wspd} kt${m.wgst ? ` gusting ${m.wgst}` : ""}` : ""}${m.wxString ? `, ${m.wxString}` : ""} (METAR ${m.icaoId})`]); };
  wx(s.wo, "Departure"); wx(s.wd, "Arrival");
  const now = Date.now(); const near = (s.bd?.flights || []).filter((x: any) => x.dep?.scheduled && Math.abs(+new Date(x.dep.scheduled) - now) < 2 * 3600e3 && x.number !== f.number); const dl = near.map((x: any) => delay(x.dep)).filter((x: any) => x != null).sort((a: number, b: number) => a - b);
  if (dl.length >= 8) { const med = dl[Math.floor(dl.length / 2)]; const late = dl.filter((x: number) => x >= 15).length; R.push([med >= 15 ? "⚠️" : "✓", `${f.origin?.iata} departures in the last/next 2 h: median ${med >= 0 ? "+" : ""}${med} min, ${late}/${dl.length} late. ${med >= 15 ? "Delays are airport-wide, so this is probably congestion, weather or air traffic control rather than just your flight." : (d ?? 0) >= 15 ? "Other flights are mostly on time, so the cause looks specific to this flight (aircraft arriving late, crew or a technical issue)." : ""}`]); }
  else R.push(["·", `Not enough timed departures on the ${f.origin?.iata} board right now to compare.`]);
  const prev = (s.h?.legs || []).find((l: any) => l.to === f.origin?.iata); if (prev) { const pd = prev.arr && prev.arrSched ? Math.round((+new Date(prev.arr) - +new Date(prev.arrSched)) / 60000) : null; R.push([pd != null && pd >= 15 ? "⚠️" : "✓", `Inbound aircraft ${f.aircraft?.reg}: ${prev.number || "previous leg"} from ${prev.from || "?"}${prev.arr ? ` landed ${fmtT(prev.arr, f.origin?.tz)}` : " not landed yet"}${pd != null ? ` (${pd >= 0 ? "+" : ""}${pd} min)` : ""}.`]); }
  else R.push(["·", f.aircraft?.reg ? `No earlier leg for ${f.aircraft.reg} in Skyline's 72 h log.` : "Aircraft not assigned yet, so the inbound flight can't be checked."]);
  return <><div className="why-l">{R.map(([i, x], k) => <div key={k} className="row g8 why-r"><span>{i}</span><span>{x}</span></div>)}</div><div className="faint xs mt8">Skyline estimate from real signals (NOAA METAR, the live airport board, the ADS-B log). Airlines don't publish delay reasons, so this is a likely explanation, not a confirmed one.</div></>;
}

function Inbound({ f }: { f: Flight }) { const [h, setH] = useState<any>(null); const reg = f.aircraft?.reg;
  useEffect(() => { if (reg) api(`/aircraft/${reg}/history${f.aircraft?.hex ? "?hex=" + f.aircraft.hex : ""}`).then(setH).catch(() => setH({ legs: [] })); }, [reg]);
  if (!reg) return <div className="faint sm">The airline hasn't assigned an aircraft (registration) yet. The chain shows up once a board or ADS-B reports it.</div>;
  if (!h) return <div className="faint sm">Loading {reg}…</div>;
  const legs = (h.legs || []).slice(0, 4).reverse();
  return legs.length ? <div className="chain">{legs.map((l: any, i: number) => <div key={i} className="chain-l"><i /><div><b>{l.from || "?"} → {l.to || "?"}</b> <span className="faint sm">{l.number || ""}</span><div className="faint xs">{l.dep ? "Dep " + fmtT(l.dep) : l.depSched ? "Sched " + fmtT(l.depSched) : ""}{l.arr ? " · Arr " + fmtT(l.arr) : ""} · {l.source}</div></div></div>)}<div className="chain-l me"><i /><div><b>{f.origin?.iata} → {f.destination?.iata}</b> <span className="faint sm">{f.number} (yours)</span></div></div></div>
    : <div className="faint sm">{reg}: no legs in Skyline's last-72 h log (boards + ADS-B).</div>;
}

function OnTime({ f }: { f: Flight }) { const [s, setS] = useState<any>(null);
  useEffect(() => { api(`/ontime?number=${f.number}&airline=${f.airline?.iata || ""}&o=${f.origin?.iata || ""}&t=${f.destination?.iata || ""}`).then(setS).catch(() => {}); }, [f.id]);
  if (!s) return null; const rows = [["This flight", s.flight], ["This route", s.route], [f.airline?.name || "Airline", s.airline]].filter(([, v]) => v) as [string, any][];
  return <><div className="kvg">{rows.map(([k, v]) => <div key={k}><label>{k}</label><b>{v.enough ? `${v.onTime}% on time` : `Not enough data (${v.n}/${s.minN})`}</b>{v.enough && <div className="faint xs">n={v.n} · median {v.median >= 0 ? "+" : ""}{v.median} min · 90% within {v.p90} min</div>}</div>)}</div>
    <div className="faint xs mt8">{s.scope} Shown only with at least {s.minN} observed flights.</div></>;
}

export function AssistantFeed({ flights, push }: { flights: Flight[]; push: (o: any) => void }) {
  const up = useMemo(() => upcoming(flights), [flights]); const nx = up[0]; const [gc, clear] = useGateChanges(flights); const cx = useMemo(() => connections(up), [up]);
  const [open, setOpen] = useState<string | null>(null); const lp = nx ? leavePlan(nx) : null; const soon = nx && best(nx.dep) && +new Date(best(nx.dep)!) - Date.now() < 36 * 3600e3;
  const late = up.filter(f => (delay(f.dep) ?? 0) >= 15).slice(0, 2);
  const cards: ReactElement[] = [];
  gc.forEach((c, i) => cards.push(<div key={"gc" + i} className="ai-card alert rise"><div className="ai-h"><span className="ai-ic">⇄</span><b>{c.number}: {c.what.toLowerCase()} changed</b></div><div className="ai-big">{c.from} → <em>{c.to}</em></div><div className="faint xs">Seen on the live board at {t(c.at)} · <button className="linkb" onClick={clear}>dismiss</button></div></div>));
  cx.filter(c => c.risk !== "ok").forEach((c, i) => cards.push(<div key={"cx" + i} className={"ai-card rise " + (c.risk === "tight" ? "warn" : "bad")}><div className="ai-h"><span className="ai-ic">⛓</span><b>Connection at {c.a.destination?.iata}: {c.risk === "missed" ? "likely missed" : c.risk === "high" ? "high risk" : "tight"}</b>{EST}</div>
    <div className="sm">{c.a.number} arrives {fmtT(best(withEstArr(c.a).arr), c.a.destination?.tz)}, {c.b.number} leaves {fmtT(best(c.b.dep), c.b.origin?.tz)}: <b>{c.buf < 0 ? "overlap " + dur(-c.buf) : dur(c.buf)}</b> to connect (assumed minimum {c.mct} min; real minimums depend on terminal, passport control and whether bags are checked through).</div></div>));
  if (nx && soon && lp) cards.push(<div key="lv" className="ai-card rise"><div className="ai-h"><span className="ai-ic">🚗</span><b>Leave for {nx.origin?.iata} by {t(lp.leave, nx.origin?.tz)}</b>{EST}</div>
    <div className="sm">Gets you there {t(lp.at, nx.origin?.tz)}, {lp.long ? 3 : 2} h before {nx.number}. Assumes {dur(lp.travel)} travel (set in the Leave card). Skyline can't see live traffic, so add a margin at rush hour.</div></div>);
  late.forEach(f => cards.push(<div key={"wl" + f.id} className="ai-card rise warn"><div className="ai-h"><span className="ai-ic">?</span><b>Why is {f.number} {dur(delay(f.dep)!)} late?</b></div>{open === "wl" + f.id ? <WhyLate f={f} /> : <button className="chip mt8" onClick={() => setOpen("wl" + f.id)}>Check the real signals</button>}</div>));
  if (nx) cards.push(<div key="ch" className="ai-card rise"><div className="ai-h"><span className="ai-ic">↩</span><b>Where is your plane coming from?</b></div>{open === "ch" ? <Inbound f={nx} /> : <button className="chip mt8" onClick={() => setOpen("ch")}>Show the aircraft's earlier flights ({nx.number})</button>}</div>);
  if (nx) cards.push(<div key="ot" className="ai-card rise"><div className="ai-h"><span className="ai-ic">%</span><b>How punctual is {nx.number}?</b></div>{open === "ot" ? <OnTime f={nx} /> : <button className="chip mt8" onClick={() => setOpen("ot")}>Show observed on-time stats</button>}</div>);
  if (nx?.origin?.iata) cards.push(<div key="gd" className="ai-card rise press" onClick={() => push({ t: "guide", iata: nx.origin!.iata })}><div className="ai-h"><span className="ai-ic">⌖</span><b>{nx.origin.iata} airport guide</b></div><div className="sm muted">Food, shops, security queues and terminal maps ›</div></div>);
  if (!cards.length) return null;
  return <div className="ai-feed"><div className="sect row between"><span>Trip assistant</span><span className="faint xs">real signals · no AI service</span></div><div className="ai-scroll">{cards}</div></div>;
}

// ---- Today summary ----
export function TodayCard({ flights }: { flights: Flight[] }) {
  const d = today(); const L = flights.filter(f => !f.example && !f.friend && f.date === d); if (!L.length) return null;
  const air = L.filter(f => ["departed", "enroute"].includes(f.status || "")).length, landed = L.filter(f => f.status === "landed").length, late = L.filter(f => (delay(f.dep) ?? delay(f.arr) ?? 0) >= 15).length, canc = L.filter(f => f.status === "cancelled").length;
  const nx = upcoming(L)[0];
  return <div className="today rise"><div className="row between"><b>Today</b><span className="faint xs">{fmtD(d, { weekday: "long", day: "numeric", month: "long" })}</span></div>
    <div className="today-g"><div><i>{L.length}</i>flights</div><div><i>{air}</i>in the air</div><div><i>{landed}</i>landed</div><div className={late ? "warn" : ""}><i>{late}</i>delayed</div>{canc > 0 && <div className="bad"><i>{canc}</i>cancelled</div>}</div>
    {nx && <div className="sm mt8">Next: <b>{nx.number}</b> {nx.origin?.iata}→{nx.destination?.iata} at {fmtT(best(nx.dep), nx.origin?.tz)}{nx.dep.gate ? ` · gate ${nx.dep.gate}` : ""}</div>}</div>;
}

// ---- natural-language search ----
export function NLSearch({ open }: { open: (f: any) => void }) {
  const [q, setQ] = useState(""); const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false);
  const go = (s = q) => { if (!s.trim()) return; setBusy(true); setQ(s); api("/nlsearch?q=" + encodeURIComponent(s)).then(setR).catch(e => setR({ flights: [], note: e.message })).finally(() => setBusy(false)); };
  const p = r?.parsed;
  return <div className="nls card"><div className="row between"><h3>Ask Skyline</h3><span className="faint xs">rules-based, no AI service</span></div>
    <form onSubmit={e => { e.preventDefault(); go(); }} className="row g8 mt8"><input className="inp grow" value={q} onChange={e => setQ(e.target.value)} placeholder="flights from MAN to Spain tomorrow morning" /><button className="primary sm" disabled={busy}>{busy ? "…" : "Go"}</button></form>
    {!r && <div className="row g6 wrap mt8">{["flights from MAN to Spain tomorrow morning", "arrivals at STN from Italy this evening", "from LHR to New York after 6pm", "from Edinburgh to Dublin"].map(s => <button key={s} className="chip xs" onClick={() => go(s)}>{s}</button>)}</div>}
    {p && <div className="nls-p">{[p.dir === "arr" ? "Arrivals" : "Departures", p.from && "from " + p.from.label, p.to && "to " + p.to.label, p.day === 1 ? "tomorrow" : p.day === -1 ? "yesterday" : "today", p.winLabel, p.airline?.name].filter(Boolean).map((x: string) => <span key={x} className="pill">{x}</span>)}</div>}
    {r && <div className="faint xs mt8">{r.total != null ? `${r.total} real flight${r.total === 1 ? "" : "s"} on the ${r.board} board${r.date ? " for " + fmtD(r.date, { weekday: "short", day: "numeric", month: "short" }) : ""}. ` : ""}{[...(p?.notes || []), r.note].filter(Boolean).join(" ")}</div>}
    {(r?.flights || []).slice(0, 12).map((f: any) => { const o = p?.dir === "arr" ? f.origin : f.destination; const tt = p?.dir === "arr" ? f.arr : f.dep;
      return <div key={f.id} className="row between ckrow press" onClick={() => open(f)}><span><b>{fmtT(tt.scheduled, p?.dir === "arr" ? f.destination?.tz : f.origin?.tz)}</b> {o?.city || o?.name || o?.iata} <span className="faint sm">{o?.iata}</span></span><span className="faint sm">{f.number} · {f.statusText || "Scheduled"}</span></div>; })}
  </div>;
}

// ---- EU261 / UK261 compensation ----
const EUC = /^(Austria|Belgium|Bulgaria|Croatia|Cyprus|Czech Republic|Czechia|Denmark|Estonia|Finland|France|Germany|Greece|Hungary|Ireland|Italy|Latvia|Lithuania|Luxembourg|Malta|Netherlands|Poland|Portugal|Romania|Slovakia|Slovenia|Spain|Sweden|Iceland|Norway|Liechtenstein|Switzerland)$/;
const UKC = /^(United Kingdom|Jersey|Guernsey|Isle of Man|Gibraltar)$/;
export function compCalc(f: Flight, carrierCountry?: string) {
  const k = km(f); const g = withEstArr(f); const arrD = f.arr.actual && f.arr.scheduled ? Math.round((+new Date(f.arr.actual) - +new Date(f.arr.scheduled)) / 60000) : delay(g.arr); const canc = f.status === "cancelled";
  const oc = f.origin?.country || "", dc = f.destination?.country || ""; const cc = carrierCountry || "";
  const fromUK = UKC.test(oc), fromEU = EUC.test(oc), toUK = UKC.test(dc), toEU = EUC.test(dc), ukCar = UKC.test(cc), euCar = EUC.test(cc);
  const uk = fromUK || (toUK && (ukCar || euCar)); const eu = fromEU || (toEU && euCar);
  const band = k <= 1500 ? 0 : k <= 3500 ? 1 : 2; const intraEU = fromEU && toEU; const b = band === 2 && intraEU ? 1 : band;
  const EUR = [250, 400, 600][b], GBP = [220, 350, 520][b]; const half = b === 2 && arrD != null && arrD < 240;
  const due = canc || (arrD != null && arrD >= 180);
  return { k, arrD, canc, eu, uk, regime: uk && eu ? "UK261 and EU261 (claim under one)" : uk ? "UK261" : eu ? "EU261" : null, eur: half ? EUR / 2 : EUR, gbp: half ? GBP / 2 : GBP, due, half, cc };
}
export function CompCard({ f }: { f: Flight }) { const [cc, setCc] = useState<string | undefined>(f.airline?.country);
  useEffect(() => { if (!cc && f.airline?.iata) api("/airline/" + f.airline.iata).then(a => setCc(a?.country || "")).catch(() => setCc("")); }, [f.id]);
  const c = compCalc(f, cc);
  return <div className="card comp"><div className="row between"><h3>Delay compensation</h3>{EST}</div>
    <div className="kvg"><div><label>Distance</label><b>{c.k.toLocaleString()} km</b></div><div><label>Arrival delay</label><b>{c.canc ? "Cancelled" : c.arrD == null ? "Not known yet" : (c.arrD >= 0 ? "+" : "") + dur(c.arrD)}</b></div><div><label>Rules</label><b>{c.regime || "Not covered"}</b></div><div><label>Carrier country</label><b>{cc === undefined ? "…" : cc || "Unknown"}</b></div></div>
    <div className={"comp-res " + (c.regime && c.due ? "ok" : "")}>{!c.regime ? "Neither UK261 nor EU261 seems to apply: the flight doesn't leave the UK/EU, and the carrier isn't a UK/EU carrier flying in." : c.due ? <>Likely eligible for <b>{c.uk ? `£${c.gbp}` : ""}{c.uk && c.eu ? " / " : ""}{c.eu ? `€${c.eur}` : ""}</b> per passenger{c.half ? " (halved because the delay on a >3,500 km flight is under 4 h)" : ""}.</> : c.arrD == null ? "Arrival time isn't known yet. Compensation starts at 3 h late on arrival (when the doors open)." : `Arrived under 3 h late, so no fixed compensation. You may still be owed meals/care for long departure delays.`}</div>
    <div className="faint xs mt8">Rules: UK261 / EU261 cover flights leaving the UK/EU on any airline. EU261 also covers flights into the EU on an EU carrier; UK261 covers flights into the UK on a UK or EU carrier. ≤1,500 km £220/€250; 1,500–3,500 km (and intra-EU over 1,500 km) £350/€400; over 3,500 km £520/€600, halved for 3–4 h delays. Not owed for extraordinary circumstances (weather, ATC strikes, security, bird strike); cancellations with 14+ days' notice are exempt. Distance is great-circle; delay uses actual arrival when known. Not legal advice — check with the airline or the CAA.</div></div>;
}

// ---- share image (canvas → PNG) ----
export async function shareImage(f: Flight) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0b1030"); g.addColorStop(1, "#3a1d6e"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,.06)"; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc((i * 137) % W, (i * 263) % H, 2, 0, 7); x.fill(); }
  const F = (s: number, w = 700) => `${w} ${s}px -apple-system, "SF Pro Display", Inter, Arial, sans-serif`;
  x.fillStyle = "#fff"; x.font = F(44, 600); x.fillText((f.airline?.name || "") + "  " + f.number, 80, 150);
  x.font = F(220, 800); x.fillText(f.origin?.iata || "", 80, 440); const w2 = x.measureText(f.destination?.iata || "").width; x.fillText(f.destination?.iata || "", W - 80 - w2, 440);
  x.font = F(40, 500); x.fillStyle = "#b9c2ff"; x.fillText(f.origin?.city || "", 84, 500); const w3 = x.measureText(f.destination?.city || "").width; x.fillText(f.destination?.city || "", W - 80 - w3, 500);
  x.strokeStyle = "#8f7cff"; x.lineWidth = 6; x.setLineDash([2, 18]); x.lineCap = "round"; x.beginPath(); x.moveTo(120, 620); x.quadraticCurveTo(W / 2, 520, W - 120, 620); x.stroke(); x.setLineDash([]);
  x.font = F(70); x.fillStyle = "#fff"; x.fillText("✈", W / 2 - 35, 600);
  const g2 = withEstArr(f); const row = (y: number, k: string, v: string) => { x.font = F(34, 500); x.fillStyle = "#9aa3d6"; x.fillText(k, 80, y); x.font = F(56, 700); x.fillStyle = "#fff"; x.fillText(v, 80, y + 66); };
  row(760, "DEPARTS", `${fmtT(best(f.dep), f.origin?.tz)}  ${f.dep.terminal ? "T" + f.dep.terminal : ""} ${f.dep.gate ? "Gate " + f.dep.gate : ""}`);
  row(920, "ARRIVES", `${fmtT(best(g2.arr), f.destination?.tz)}${(g2.arr as any).estimatedOnly ? " (est.)" : ""}`);
  row(1080, "STATUS", `${f.statusText || f.status || "Scheduled"} · ${fmtD(f.date, { day: "numeric", month: "short", year: "numeric" })}`);
  x.font = F(30, 500); x.fillStyle = "#7f88c0"; x.fillText(`${km(f).toLocaleString()} km · tracked with Skyline`, 80, 1270);
  const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), "image/png")); const file = new File([blob], `${f.number}.png`, { type: "image/png" });
  if ((navigator as any).canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: f.number }); return "shared"; } catch { } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); return "downloaded";
}
export const exportIcs = (L: Flight[], name = "skyline-flights.ics") => download(name, ics(L.filter(f => !f.example)));

// ---- airport guide ----
const FAC: [string, string][] = [["restaurant", "Restaurants"], ["cafe", "Cafés"], ["fast_food", "Fast food"], ["bar", "Bars"], ["pub", "Pubs"], ["shop", "Shops"], ["pharmacy", "Pharmacy"], ["atm", "Cash machines"], ["bureau_de_change", "Currency exchange"], ["toilets", "Toilets"], ["drinking_water", "Water refill"], ["charging_station", "EV charging"], ["lounge", "Lounges"], ["baby_changing", "Baby changing"], ["place_of_worship", "Prayer / worship"], ["left_luggage", "Left luggage"], ["car_rental", "Car hire"], ["taxi", "Taxi ranks"], ["bus_station", "Bus station"], ["parking", "Parking"]];
export function AirportGuide({ iata, x }: { iata: string; x: any }) { const [g, setG] = useState<any>(null);
  useEffect(() => { let on = true, n = 0; const go = () => api("/guide/" + iata).then(r => { if (!on) return; setG(r); if (r.facilitiesError === "loading" && n++ < 6) setTimeout(go, 15000); }).catch(e => on && setG({ error: e.message })); go(); return () => { on = false; }; }, [iata]);
  const a = g?.airport; const fc = g?.facilities;
  return <div className="fd"><div className="head"><div><span className="tag">AIRPORT GUIDE</span><h1 className="h1s">{iata}{a ? " · " + (a.city || "") : ""}</h1><div className="muted sm">{a?.name || "Loading…"}</div></div>{x}</div>
    {g?.error && <div className="card bad sm">{g.error}</div>}
    <div className="card"><div className="row between"><h3>Security wait</h3>{g?.security && <span className="srcb live">LIVE</span>}</div>
      {g?.security ? g.security.queues.map((q: any) => <div key={q.terminal + q.kind} className="row between ckrow"><span>{q.terminal} <span className="faint sm">{q.kind}</span></span><b>{q.text}</b></div>) : <div className="muted sm">{g ? (g.securityAvailable ? "Feed unavailable right now." : `${iata} doesn't publish live security queue times in a feed Skyline can read.`) : "…"}</div>}</div>
    <div className="card"><h3>Terminal maps</h3>{g?.maps && <>{g.maps.official && <a className="row between ckrow" href={"https://" + g.maps.official.replace(/^https?:\/\//, "")} target="_blank" rel="noreferrer"><span>Official airport site</span><span className="faint sm">{g.maps.official} ›</span></a>}
      <a className="row between ckrow" href={g.maps.osm} target="_blank" rel="noreferrer"><span>OpenStreetMap (indoor detail where mapped)</span><span className="faint sm">›</span></a><a className="row between ckrow" href={g.maps.google} target="_blank" rel="noreferrer"><span>Google Maps</span><span className="faint sm">›</span></a></>}
      {fc?.terminals?.length > 0 && <div className="faint sm mt8">Terminals mapped: {fc.terminals.join(", ")}{fc.gates ? ` · ${fc.gates} gates in OSM` : ""}</div>}</div>
    <div className="card"><div className="row between"><h3>Facilities</h3><span className="faint xs">OpenStreetMap</span></div>
      {!g || g.facilitiesError === "loading" ? <div className="muted sm">Asking OpenStreetMap (this can take up to a minute the first time)…</div> : !fc ? <div className="muted sm">OpenStreetMap isn't reachable right now ({g.facilitiesError}).</div>
        : <div className="fac-g">{FAC.filter(([k]) => fc.counts[k]).map(([k, l]) => <div key={k} className="fac"><b>{fc.counts[k]}</b><span>{l}</span>{fc.examples[k] && <em>{fc.examples[k].slice(0, 4).join(" · ")}</em>}</div>)}</div>}
      <div className="faint xs mt8">Within {fc?.radiusM || 2000} m of the airport reference point, airside and landside. Community data: it may be incomplete or out of date.</div></div>
  </div>;
}
