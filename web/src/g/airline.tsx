// Your Own Airline: design an original livery, buy planes, open routes from Manchester or Katowice and run the days.
// Airport codes/positions are real (for distances); planes are generic size classes; all money and delay numbers are game numbers.
import { useMemo, useRef, useState } from "react";
import { useBest } from "../games";
import { useLoop, sfx } from "./kit";
import { AIR_KEY, type Livery } from "./myair";
import { APTS, TYPES, apt, tp, distNm, newAirline, buy, sell, openRoute, closeRoute, assign, service, serviceCost, borrow, repay, runDay, value, planeValue, legsPerDay, fairFare, demandOf, LOAN_MAX, type Save, type LegRes, type DayLog } from "./airlinesim";

const PAL = ["#ffffff", "#f8fafc", "#0f172a", "#1e3a8a", "#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#84cc16", "#facc15", "#f97316", "#dc2626", "#db2777", "#7c3aed", "#78350f", "#94a3b8"];
const MOTIFS: Livery["motif"][] = ["swoosh", "stripes", "star", "dot", "chevron", "wave"];
const DEF: Livery = { name: "", code: "", body: "#ffffff", belly: "#1e3a8a", tail: "#2563eb", stripe: "#facc15", motif: "swoosh", engine: "#1e3a8a" };
const gbp = (n: number) => (n < 0 ? "−£" : "£") + Math.abs(Math.round(n)).toLocaleString("en-GB");
const load = (): Save | null => { try { const s = JSON.parse(localStorage.getItem(AIR_KEY) || "null"); return s && s.v === 1 ? s : null; } catch { return null; } };
const store = (s: Save) => { try { localStorage.setItem(AIR_KEY, JSON.stringify(s)); } catch { /* full */ } };

/** Side view of an original airliner in the player's livery (no real logos). */
export function LiveryPlane({ l, w = 320 }: { l: Livery; w?: number }) {
  const m = l.motif; const tc = l.stripe;
  return <svg viewBox="0 0 320 120" width={w} style={{ maxWidth: "100%", display: "block" }} aria-label={`${l.name || "Your airline"} livery`}>
    <defs><clipPath id="lvTail"><path d="M236 62 L262 10 L290 10 L282 62 Z" /></clipPath><clipPath id="lvBody"><path d="M30 60 C30 46 50 42 80 42 L270 42 C292 42 300 50 300 60 C300 70 292 76 270 76 L80 76 C50 76 30 72 30 60 Z" /></clipPath></defs>
    <ellipse cx="165" cy="108" rx="120" ry="5" fill="rgba(0,0,0,.25)" />
    <path d="M150 70 L205 70 L178 98 L160 98 Z" fill="#94a3b8" opacity=".9" />
    <g clipPath="url(#lvBody)"><rect x="20" y="40" width="290" height="40" fill={l.body} /><rect x="20" y="66" width="290" height="14" fill={l.belly} /><rect x="20" y="62" width="290" height="4" fill={l.stripe} /></g>
    <path d="M30 60 C30 46 50 42 80 42 L270 42 C292 42 300 50 300 60 C300 70 292 76 270 76 L80 76 C50 76 30 72 30 60 Z" fill="none" stroke="#0b1220" strokeWidth="1.2" />
    <path d="M40 52 C44 48 50 47 56 47 L60 47 L58 53 L42 54 Z" fill="#0f172a" />
    {Array.from({ length: 22 }, (_, i) => <rect key={i} x={76 + i * 8.6} y="55" width="4" height="4.5" rx="1.5" fill="#1e293b" opacity=".85" />)}
    <rect x="66" y="47" width="6" height="15" rx="1" fill="none" stroke="#334155" strokeWidth=".8" />
    <path d="M236 62 L262 10 L290 10 L282 62 Z" fill={l.tail} stroke="#0b1220" strokeWidth="1" />
    <g clipPath="url(#lvTail)" fill={tc}>{m === "swoosh" && <path d="M230 60 C250 40 270 30 300 26 L300 34 C276 38 258 48 240 64 Z" />}{m === "stripes" && [0, 1, 2].map(i => <rect key={i} x="230" y={22 + i * 12} width="70" height="5" transform={`skewY(-8)`} />)}
      {m === "star" && <path d="M272 22 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1 Z" />}{m === "dot" && <circle cx="272" cy="34" r="11" />}{m === "chevron" && <path d="M250 50 L274 22 L292 22 L268 50 Z" />}{m === "wave" && <path d="M230 46 C245 38 255 54 270 46 C282 40 290 44 300 42 L300 64 L230 64 Z" />}</g>
    <path d="M262 52 L300 48 L302 54 L268 58 Z" fill={l.tail} stroke="#0b1220" strokeWidth=".8" />
    <rect x="132" y="72" width="34" height="14" rx="7" fill={l.engine} stroke="#0b1220" strokeWidth=".8" /><rect x="132" y="74" width="5" height="10" rx="2" fill="#0b1220" />
    <text x="160" y="72" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="10" fill={l.belly === l.body ? l.tail : l.belly} style={{ letterSpacing: 1.2 }} transform="translate(0 -20)">{(l.name || "YOUR AIRLINE").toUpperCase().slice(0, 18)}</text>
  </svg>; }

export default function OwnAirline() {
  const [best, report] = useBest("airline"); const [s, setS] = useState<Save | null>(load); const [tab, setTab] = useState<"day" | "routes" | "fleet" | "livery" | "money">("day"); const [msg, setMsg] = useState(""); const [, setUi] = useState(0);
  const [anim, setAnim] = useState<{ legs: LegRes[]; log: DayLog; t: number } | null>(null); const [report2, setReport2] = useState<DayLog | null>(null); const [nb, setNb] = useState(false);
  const commit = (n: Save) => { setS({ ...n }); store(n); };
  const act = (f: (n: Save) => string | null | void, ok?: string, snd = sfx.click) => { if (!s) return; const n: Save = JSON.parse(JSON.stringify(s)); const e = f(n); if (e) { setMsg(e); sfx.bad(); return; } setMsg(ok || ""); snd(); commit(n); };
  useLoop(dt => { if (!anim) return; anim.t += dt / 7; if (anim.t >= 1) { const n = anim; setAnim(null); setReport2(n.log); sfx[n.log.profit >= 0 ? "cash" : "bad"](); } setUi(u => u + 1); }, !!anim);
  if (!s) return <Designer onDone={(liv, home) => { const n = newAirline(liv, home); commit(n); sfx.level(); setTab("routes"); setMsg(`Welcome to ${liv.name}! You have one Narrowbody 180. Open your first route.`); }} />;
  const startDay = () => { if (!s.routes.some(r => r.plane)) { setMsg("Give a plane a route first (Routes tab)."); sfx.bad(); setTab("routes"); return; } const n: Save = JSON.parse(JSON.stringify(s)); const res = runDay(n); commit(n); setAnim({ legs: res.legs, log: res.log, t: 0 }); setReport2(null); setTab("day"); sfx.whoosh(); const v = Math.round(value(n) / 1000); setNb(v > 0 && report(v)); };
  const T = (k: typeof tab, l: string) => <button className={tab === k ? "on" : ""} onClick={() => { setTab(k); sfx.click(); }}>{l}</button>;
  return <div className="g4 oa">
    <div className="oa-top"><LiveryPlane l={s.liv} w={140} /><div><b>{s.liv.name}</b><small>Day {s.day} · {s.liv.code} · home {s.home}</small><small>⭐ Rep {Math.round(s.rep)} · 💰 {gbp(s.cash)}{s.loan ? ` · loan ${gbp(s.loan)}` : ""}</small><small>Company value {gbp(value(s))}{best != null ? ` · best £${best}k` : ""}</small></div></div>
    <div className="oa-tabs">{T("day", "🗺️ Day")}{T("routes", "🧭 Routes")}{T("fleet", "✈️ Fleet")}{T("money", "💷 Money")}{T("livery", "🎨 Livery")}</div>
    {msg && <p className="oa-msg">{msg}</p>}
    {tab === "day" && <div className="oa-day"><RouteMap s={s} anim={anim} />
      {anim ? <p className="g4-intro">⏱ {clock(6 + anim.t * 18)} · flying today…</p> : report2 ? <DayCard d={report2} nb={nb} /> : <p className="g4-intro">{s.routes.filter(r => r.plane).length} route{s.routes.filter(r => r.plane).length === 1 ? "" : "s"} flying. Press <b>Run day</b> to fly a whole day of schedules.</p>}
      {!anim && <button className="gp-btn pri oa-go" onClick={startDay}>▶ Run day {s.day}</button>}</div>}
    {tab === "routes" && <Routes s={s} act={act} />}
    {tab === "fleet" && <Fleet s={s} act={act} />}
    {tab === "money" && <Money s={s} act={act} />}
    {tab === "livery" && <Designer init={s.liv} home={s.home} edit onDone={liv => { act(n => { n.liv = liv; }, "Livery repainted! It shows in Airport Manager too.", sfx.build); setTab("day"); }} onReset={() => { if (confirm("Close your airline and start again? This deletes the save.")) { localStorage.removeItem(AIR_KEY); setS(null); } }} />}
    <p className="faint xs">Fan-made airline. Airports are real places; prices, demand and delays are game numbers, not real data.</p></div>;
}
const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
function DayCard({ d, nb }: { d: DayLog; nb: boolean }) {
  return <div className="g4-card"><b>Day {d.d} report {d.profit >= 0 ? "📈" : "📉"}</b>
    <div className="oa-stats"><span><small>Passengers</small>{d.pax.toLocaleString("en-GB")}</span><span><small>Seats filled</small>{d.seats ? Math.round(d.pax / d.seats * 100) : 0}%</span><span><small>On time</small>{d.ontime}%</span><span><small>Flights</small>{d.legs}{d.cxl ? ` (${d.cxl} cxl)` : ""}</span><span><small>Revenue</small>{gbp(d.rev)}</span><span><small>Costs</small>{gbp(d.cost)}</span><span className={d.profit >= 0 ? "ok" : "bad"}><small>Profit</small>{gbp(d.profit)}</span><span><small>Cash</small>{gbp(d.cash)}</span></div>
    {nb && <div className="gq-nb">New best company value!</div>}
    {d.events.length ? <ul className="g4-log">{d.events.map((e, i) => <li key={i} className={e.startsWith("❌") ? "bad" : "info"}>{e}</li>)}</ul> : <p className="sm muted">A smooth day: no big delays. 😎</p>}</div>; }

function proj(lat: number, lon: number) { return { x: (lon + 10) * Math.cos(48 * Math.PI / 180) * 10, y: -(lat - 48) * 10 }; }
function RouteMap({ s, anim }: { s: Save; anim: { legs: LegRes[]; t: number } | null }) {
  const used = new Set([s.home, ...s.routes.map(r => r.b)]); const pts = [...used].map(c => proj(apt(c).lat, apt(c).lon)); const base = [proj(62, -12), proj(35, 25)];
  const all = [...pts, ...base]; let x0 = Math.min(...all.map(p => p.x)) - 25, x1 = Math.max(...all.map(p => p.x)) + 25, y0 = Math.min(...all.map(p => p.y)) - 20, y1 = Math.max(...all.map(p => p.y)) + 20; { const w = x1 - x0, hh = y1 - y0; if (w / hh < 4 / 3) { const e = (hh * 4 / 3 - w) / 2; x0 -= e; x1 += e; } else { const e = (w * 3 / 4 - hh) / 2; y0 -= e; y1 += e; } }
  const H = 6 + (anim ? anim.t * 18 : 0); const P = (c: string) => proj(apt(c).lat, apt(c).lon); const h = P(s.home);
  return <svg className="oa-map" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} preserveAspectRatio="xMidYMid meet">
    <defs><radialGradient id="oaG" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#123a5a" /><stop offset="1" stopColor="#081426" /></radialGradient></defs>
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="url(#oaG)" />
    {Array.from({ length: 30 }, (_, i) => <line key={"g" + i} x1={x0} x2={x1} y1={y0 + i * 20} y2={y0 + i * 20} stroke="rgba(148,163,184,.08)" />)}
    {APTS.map(a => { const p = proj(a.lat, a.lon); if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return null; const u = used.has(a.c); return <g key={a.c} opacity={u ? 1 : .35}><circle cx={p.x} cy={p.y} r={a.c === s.home ? 5 : u ? 3.6 : 2.2} fill={a.c === s.home ? "#facc15" : u ? "#e2e8f0" : "#64748b"} /><text x={p.x + 5} y={p.y + 3} fontSize={u ? 11 : 8} fontWeight="800" fill={u ? "#e2e8f0" : "#94a3b8"} fontFamily="system-ui">{a.c}</text></g>; })}
    {s.routes.map(r => { const b = P(r.b); const mx = (h.x + b.x) / 2, my = (h.y + b.y) / 2 - Math.hypot(b.x - h.x, b.y - h.y) * .12; return <path key={r.id} d={`M${h.x} ${h.y} Q${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke={r.plane ? s.liv.tail : "#475569"} strokeWidth={r.plane ? 1.6 : 1} strokeDasharray={r.plane ? "" : "3 3"} opacity=".9" />; })}
    {anim && anim.legs.filter(l => !l.cxl && H >= l.dep && H <= l.arr).map((l, i) => { const a = P(l.from), b = P(l.to); const f = (H - l.dep) / (l.arr - l.dep); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * .12;
      const q = (t: number) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y }); const p = q(f), p2 = q(Math.min(1, f + .02)); const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
      return <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${ang}) scale(1.7)`}><path d="M6 0 L-4 -1.4 L-1 -1.4 L-3 -5 L-1 -5 L3 -1.2 L5 -1 Z M6 0 L-4 1.4 L-1 1.4 L-3 5 L-1 5 L3 1.2 L5 1 Z" fill={s.liv.body} stroke={s.liv.tail} strokeWidth=".8" />{l.delay >= 30 && <text y="-7" fontSize="7" textAnchor="middle" fill="#fca5a5" transform={`rotate(${-ang})`}>⏱{l.delay}′</text>}</g>; })}
    {anim && anim.legs.filter(l => l.cxl && H >= l.dep && H <= l.dep + 1.5).map((l, i) => { const a = P(l.from); return <text key={"c" + i} x={a.x} y={a.y - 8} fontSize="9" textAnchor="middle">❌</text>; })}
  </svg>; }

function Routes({ s, act }: { s: Save; act: (f: (n: Save) => string | null | void, ok?: string, snd?: () => void) => void }) {
  const [to, setTo] = useState(""); const opts = APTS.filter(a => a.c !== s.home && !s.routes.some(r => r.b === a.c)).map(a => ({ a, d: distNm(s.home, a.c) })).sort((p, q) => p.d - q.d);
  return <div className="oa-list"><div className="g4-card"><b>Open a new route from {s.home}</b><div className="oa-row"><select value={to} onChange={e => setTo(e.target.value)} aria-label="Destination"><option value="">Choose a destination…</option>{opts.map(({ a, d }) => <option key={a.c} value={a.c}>{a.c} {a.n} · {d} nm</option>)}</select><button className="gp-btn pri" disabled={!to} onClick={() => { act(n => openRoute(n, to), `Route to ${apt(to).n} opened!`, sfx.cash); setTo(""); }}>Open £15k</button></div><small className="muted">Short hops suit small planes; long routes need big ones (range!).</small></div>
    {!s.routes.length && <p className="g4-intro">No routes yet.</p>}
    {s.routes.map(r => { const d = distNm(r.a, r.b); const p = s.fleet.find(q => q.id === r.plane); const ff = fairFare(d); const free = s.fleet.filter(q => !q.route || q.route === r.id);
      return <div key={r.id} className="g4-card oa-route"><div className="oa-row"><b>{r.a} ⇄ {r.b}</b><small>{apt(r.b).n} · {d} nm{p ? ` · ${legsPerDay(d, tp(p.t).kt)} flights/day` : ""}</small></div>
        <div className="oa-row"><select value={r.plane || ""} onChange={e => act(n => assign(n, e.target.value || (r.plane as string), e.target.value ? r.id : null), "Schedule updated", sfx.tug)} aria-label="Plane on this route"><option value="">No plane (not flying)</option>{free.map(q => <option key={q.id} value={q.id}>{q.reg} · {tp(q.t).n}</option>)}</select></div>
        <div className="oa-row oa-fare"><span>Fare</span><button onClick={() => act(n => { const x = n.routes.find(q => q.id === r.id)!; x.fare = Math.max(20, x.fare - 5); })}>−</button><b>{gbp(r.fare)}</b><button onClick={() => act(n => { const x = n.routes.find(q => q.id === r.id)!; x.fare += 5; })}>＋</button><small className={r.fare > ff * 1.15 ? "bad" : r.fare < ff * .85 ? "ok" : ""}>usual ≈ {gbp(ff)} · demand ~{demandOf(s, r)}/day</small></div>
        <div className="oa-row"><small className="muted">{r.days} days flown</small><button className="gp-btn" onClick={() => { if (confirm(`Close ${r.a}–${r.b}?`)) act(n => { closeRoute(n, r.id); }, "Route closed"); }}>Close</button></div></div>; })}</div>; }

function Fleet({ s, act }: { s: Save; act: (f: (n: Save) => string | null | void, ok?: string, snd?: () => void) => void }) {
  return <div className="oa-list"><h3 className="gsx-h">Your fleet ({s.fleet.length})</h3>
    {s.fleet.map(p => { const t = tp(p.t); const r = s.routes.find(q => q.id === p.route); return <div key={p.id} className="g4-card"><div className="oa-row"><b>{p.reg}</b><small>{t.n} · {t.seats} seats · {t.range} nm</small></div><small>{r ? `Flying ${r.a}⇄${r.b}` : "Parked: no route"}{p.out ? " · in maintenance" : ""}</small>
      <div className="oa-row"><span className="oa-wear"><i style={{ width: p.wear + "%", background: p.wear > 70 ? "#ef4444" : p.wear > 40 ? "#f59e0b" : "#22c55e" }} /></span><small>Wear {Math.round(p.wear)}%</small></div>
      <div className="oa-row"><button className="gp-btn" onClick={() => act(n => service(n, p.id), `${p.reg} booked in for maintenance tonight`, sfx.build)}>🔧 Service {gbp(serviceCost(p))}</button><button className="gp-btn" onClick={() => { if (confirm(`Sell ${p.reg} for ${gbp(planeValue(p))}?`)) act(n => sell(n, p.id), "Sold", sfx.cash); }}>Sell {gbp(planeValue(p))}</button></div></div>; })}
    <h3 className="gsx-h">Buy a plane</h3>{TYPES.map(t => <div key={t.k} className="g4-card"><div className="oa-row"><b>{t.n}</b><small>{t.sub}</small></div><small>{t.seats} seats · {t.range} nm range · {gbp(t.hour)}/flying hour{t.rep ? ` · needs reputation ${t.rep}` : ""}</small><button className="gp-btn pri" disabled={s.cash < t.price || s.rep < t.rep} onClick={() => act(n => buy(n, t.k), `New ${t.n} delivered! Give it a route.`, sfx.level)}>Buy {gbp(t.price)}</button></div>)}
    <p className="faint xs">Worn planes break down more (delays and cancellations). A service takes the plane out for one day.</p></div>; }

function Money({ s, act }: { s: Save; act: (f: (n: Save) => string | null | void, ok?: string, snd?: () => void) => void }) {
  const h = s.hist.slice(-14); const mx = Math.max(1, ...h.map(d => Math.abs(d.profit)));
  return <div className="oa-list"><div className="g4-card"><b>Profit, last {h.length} days</b>{h.length ? <svg viewBox="0 0 280 90" className="oa-chart">{h.map((d, i) => { const v = d.profit / mx * 40; return <rect key={i} x={6 + i * 19.5} y={v >= 0 ? 45 - v : 45} width="14" height={Math.max(1, Math.abs(v))} rx="2" fill={v >= 0 ? "#22c55e" : "#ef4444"} />; })}<line x1="0" x2="280" y1="45" y2="45" stroke="#475569" /></svg> : <small className="muted">Run a day to see results.</small>}</div>
    <div className="g4-card"><b>Bank</b><small>Loan {gbp(s.loan)} of {gbp(LOAN_MAX)} · interest 0.15% a day</small><div className="oa-row"><button className="gp-btn" disabled={s.loan >= LOAN_MAX} onClick={() => act(n => { borrow(n, 100000); }, "Borrowed £100,000", sfx.cash)}>Borrow £100k</button><button className="gp-btn" disabled={!s.loan || s.cash <= 0} onClick={() => act(n => { repay(n, 100000); }, "Repaid", sfx.cash)}>Repay £100k</button></div></div>
    <div className="g4-card"><b>Company value {gbp(value(s))}</b><small>Cash minus loan plus what your planes are worth. This is your score.</small></div></div>; }

function Designer({ init, home, edit, onDone, onReset }: { init?: Livery; home?: string; edit?: boolean; onDone: (l: Livery, home: string) => void; onReset?: () => void }) {
  const [l, setL] = useState<Livery>(init || DEF); const [h, setH] = useState(home || "MAN"); const set = (p: Partial<Livery>) => setL({ ...l, ...p });
  const Sw = ({ k, lab }: { k: "body" | "belly" | "tail" | "stripe" | "engine"; lab: string }) => <div className="oa-sw"><small>{lab}</small><div>{PAL.map(c => <button key={c} aria-label={lab + " " + c} className={l[k] === c ? "on" : ""} style={{ background: c }} onClick={() => { set({ [k]: c } as Partial<Livery>); sfx.pop(); }} />)}</div></div>;
  const rnd = useRef(0); const ok = l.name.trim().length >= 2 && /^[A-Z]{3}$/.test(l.code);
  const surprise = () => { rnd.current++; const p = () => PAL[Math.floor(Math.random() * PAL.length)]; set({ body: Math.random() < .5 ? "#ffffff" : p(), belly: p(), tail: p(), stripe: p(), engine: p(), motif: MOTIFS[Math.floor(Math.random() * MOTIFS.length)] }); sfx.chime(); };
  const preview = useMemo(() => <LiveryPlane l={l} />, [l]);
  return <div className="g4 oa-des">{!edit && <p className="g4-intro">Start your own airline! Invent a name, a three-letter code and paint an <b>original</b> livery (no real logos), then pick your home airport.</p>}
    <div className="oa-prev">{preview}</div>
    <label className="gsx-f"><span>Airline name</span><input value={l.name} maxLength={22} placeholder="e.g. Pennine Skyways" onChange={e => set({ name: e.target.value })} /></label>
    <label className="gsx-f"><span>Code (3 letters)</span><input value={l.code} maxLength={3} placeholder="PSK" autoCapitalize="characters" onChange={e => set({ code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></label>
    <Sw k="body" lab="Body" /><Sw k="belly" lab="Belly" /><Sw k="stripe" lab="Stripe & tail art" /><Sw k="tail" lab="Tail" /><Sw k="engine" lab="Engines" />
    <div className="oa-sw"><small>Tail art</small><div className="oa-motifs">{MOTIFS.map(m => <button key={m} className={l.motif === m ? "on" : ""} onClick={() => { set({ motif: m }); sfx.click(); }}>{m}</button>)}</div></div>
    <button className="gp-btn" onClick={surprise}>🎲 Surprise me</button>
    {!edit && <div className="oa-sw"><small>Home airport</small><div className="gp-seg">{["MAN", "KTW"].map(c => <button key={c} className={h === c ? "on" : ""} onClick={() => setH(c)}>{c} {apt(c).n}</button>)}</div></div>}
    <button className="gp-btn pri" disabled={!ok} onClick={() => onDone({ ...l, name: l.name.trim() }, h)}>{edit ? "Save livery" : "🚀 Launch my airline"}</button>{!ok && <small className="muted">Needs a name and a 3-letter code.</small>}
    {edit && onReset && <button className="gp-btn" onClick={onReset}>Close airline & start over</button>}
    {edit && <p className="faint xs">Your airline can also fly at your Airport Manager airport: open Airlines there and invite it.</p>}</div>; }
