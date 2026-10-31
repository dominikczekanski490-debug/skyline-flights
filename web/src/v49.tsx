// v49 stage 4: route insight hero cards from Skyline's own observed log + destination travel advice and holidays.
// Every "smart" card is a printed rule or statistic; no models. Empty states say why.
import { useEffect, useState } from "react";
import { api, type Flight } from "./lib";
import { Hero } from "./v47";
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dd = (s: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
const tone = (m: number | null) => m == null ? "dim" : m >= 30 ? "bad" : m >= 15 ? "warn" : "ok";
const col = (m: number | null) => m == null ? "var(--faint)" : m >= 30 ? "var(--red)" : m >= 15 ? "var(--orange)" : "var(--green)";
const sg = (m: number) => (m > 0 ? "+" : "") + m;
function useRI(f: Flight) { const o = f.origin?.iata, t = f.destination?.iata; const [d, setD] = useState<any>(null);
  useEffect(() => { if (o && t) api(`/route-insight?o=${o}&t=${t}&number=${encodeURIComponent(f.number || "")}`).then(setD).catch(() => setD({ err: 1 })); }, [o, t, f.number]); return d; }
const Empty = ({ k, msg, foot }: any) => <Hero cls="hx-empty" tone="dim" kicker={k} verdict="Not enough data yet" sub={msg} foot={foot} />;
function BestDay({ d }: any) { const ok = d.dows.filter((x: any) => x.flown >= 3); const k = `Best day to fly · ${d.o}→${d.t}`;
  if (ok.length < 3) return <Empty k={k} msg={`Needs 3+ observed flights on at least 3 weekdays; Skyline has ${d.route.flown} on this route so far.`} foot={d.scope} />;
  const best = [...ok].sort((a: any, b: any) => a.avg - b.avg)[0], worst = [...ok].sort((a: any, b: any) => b.avg - a.avg)[0]; const mx = Math.max(15, ...ok.map((x: any) => Math.abs(x.avg)));
  return <Hero cls="hx-bd" tone={tone(best.avg)} kicker={k} verdict={`${DOW[best.dow]}s`} sub={`Avg ${sg(best.avg)} min vs ${DOW[worst.dow]}s at ${sg(worst.avg)} min`} foot={<>Rule: weekday with the lowest mean departure delay, counting weekdays with 3+ observed flights. Early data: {d.days} days observed. {d.scope}</>}>
    <div className="hx-cols">{[1, 2, 3, 4, 5, 6, 0].map((w, i) => { const x = d.dows[w]; const has = x.flown >= 3; return <div key={w} className={"hx-col" + (x === best ? " best" : "")}><div className="hx-colb"><i style={{ height: has ? `${Math.max(6, Math.abs(x.avg) / mx * 100)}%` : "4%", background: has ? col(x.avg) : "var(--faint)", animationDelay: `${i * 60}ms` }} /></div><b>{has ? sg(x.avg) : "–"}</b><small>{DOW[w].slice(0, 3)}</small></div>; })}</div></Hero>; }
function Trend({ d }: any) { const s = d.series.filter((x: any) => x.s !== "cancelled" && x.d != null); const k = `${d.number} recent form`;
  if (s.length < 5) return <Empty k={k} msg={`Needs 5 observed departures of this flight; Skyline has ${s.length}.`} foot={d.scope} />;
  const last = s.slice(-3), prev = s.slice(0, -3); const m = (a: any[]) => a.reduce((t, x) => t + Math.max(-10, Math.min(180, x.d)), 0) / a.length; const diff = Math.round(m(last) - m(prev));
  const v = diff >= 10 ? "Getting later" : diff <= -10 ? "Getting more punctual" : "Holding steady"; const W = 300, H = 70, mx = Math.max(30, ...s.map((x: any) => x.d)), mn = Math.min(0, ...s.map((x: any) => x.d));
  const pts: number[][] = s.map((x: any, i: number) => [i / (s.length - 1) * W, H - (x.d - mn) / (mx - mn) * H]);
  return <Hero cls="hx-tr" tone={diff >= 10 ? "bad" : diff <= -10 ? "ok" : "dim"} kicker={k} verdict={v} sub={`Last 3 avg ${sg(Math.round(m(last)))} min vs ${sg(Math.round(m(prev)))} min before`} foot={<>Rule: mean of the last 3 observed departures vs the earlier ones; ±10 min or more counts as a change. {d.scope}</>}>
    <svg className="hx-spark" viewBox={`-6 -8 ${W + 12} ${H + 26}`} role="img" aria-label="Delay per day"><line x1="0" x2={W} y1={H - (15 - mn) / (mx - mn) * H} y2={H - (15 - mn) / (mx - mn) * H} className="hx-l15" />
      <polyline points={pts.map(p => p.join(",")).join(" ")} className="hx-pl" pathLength={1} />{pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4.5" fill={col(s[i].d)} /><text x={p[0]} y={H + 16} className="hx-n">{dd(s[i].date, { day: "numeric" })}</text></g>)}</svg></Hero>; }
function Cancel({ d }: any) { const r = d.route, f = d.flight; const p = (x: any) => x.n ? x.cancelled / x.n * 100 : 0; const k = `Cancellation record · ${d.o}→${d.t}`;
  if (r.n < 10) return <Empty k={k} msg={`Needs 10 observed flights on this route; Skyline has ${r.n}.`} foot={d.scope} />;
  const pr = p(r), b = pr === 0 ? ["None cancelled", "ok"] : pr < 2 ? ["Low cancellation rate", "ok"] : pr < 5 ? ["Elevated cancellations", "warn"] : ["High cancellation rate", "bad"]; const R = 40, C = 2 * Math.PI * R;
  return <Hero cls="hx-cx" tone={b[1]} kicker={k} verdict={b[0]} sub={`${r.cancelled} of ${r.n} route flights cancelled${f.n ? ` · ${d.number}: ${f.cancelled} of ${f.n}` : ""}`} foot={<>Bands: 0 % none, under 2 % low, 2–5 % elevated, 5 %+ high, from cancelled vs all observed flights. {d.scope}</>}>
    <div className="hx-row"><svg className="hx-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r={R} className="hx-ring-bg" /><circle cx="60" cy="60" r={R} className="hx-ring-fg" transform="rotate(-90 60 60)" style={{ stroke: col(pr * 6), strokeDasharray: C, ["--off" as any]: C * (1 - Math.min(1, (100 - pr) / 100)), ["--c" as any]: C }} /><text x="60" y="58" className="hx-ring-v">{(100 - pr).toFixed(pr ? 1 : 0)}<tspan className="hx-ring-u">%</tspan></text><text x="60" y="78" className="hx-ring-l">operated</text></svg>
      <div className="hx-facts" style={{ flex: 1, marginTop: 0 }}><div><small>Route</small><b>{pr.toFixed(1)} % cancelled</b></div><div><small>{d.number}</small><b>{f.n ? `${p(f).toFixed(0)} % of ${f.n}` : "Not observed"}</b></div></div></div></Hero>; }
function AirlineLeague({ d }: any) { const L = d.airlineLeague; const i = L.findIndex((x: any) => x.k === d.airline); const k = `Airline punctuality at ${d.o}`;
  if (L.length < 3) return <Empty k={k} msg="Needs 3+ airlines with 10+ observed departures." foot={d.scope} />;
  const me = L[i]; const show = L.slice(0, 5); if (me && i >= 5) show.push(me);
  return <Hero cls="hx-al" tone={!me ? "dim" : i < L.length / 3 ? "ok" : i < L.length * 2 / 3 ? "warn" : "bad"} kicker={k} verdict={me ? <>#{i + 1}<small> of {L.length} airlines</small></> : "Airline not ranked"} sub={me ? `${d.airline} averages ${sg(me.avg)} min, ${me.late15} % 15+ late (${me.flown} flights)` : `${d.airline} has under 10 observed departures here`} foot={<>Rule: airlines ranked by mean departure delay at {d.o}, minimum 10 observed flights; top third green, bottom third red. {d.scope}</>}>
    <div className="hx-lg">{show.map((x: any) => <div key={x.k} className={x.k === d.airline ? "me" : ""}><span>#{L.indexOf(x) + 1}</span><b>{x.k}</b><div><i style={{ ["--w" as any]: `${Math.min(100, Math.max(4, (x.avg + 10) / (L[L.length - 1].avg + 10) * 100))}%`, background: col(x.avg) }} /></div><em>{sg(x.avg)}m</em></div>)}</div></Hero>; }
function RouteLeague({ d }: any) { const R = d.routeLeague; const k = `Routes from ${d.o}`;
  if (R.size < 5 || !R.me) return <Empty k={k} msg={`Needs this route and 5+ routes with 5+ observed flights; ${R.size} qualify${R.me ? "" : `, ${d.t} has too few`}.`} foot={d.scope} />;
  const pct = Math.round((1 - (R.rank - 1) / Math.max(1, R.size - 1)) * 100);
  return <Hero cls="hx-rl" tone={pct >= 67 ? "ok" : pct >= 33 ? "warn" : "bad"} kicker={k} verdict={<>More punctual than {pct}%<small> of routes</small></>} sub={`${d.o}→${d.t} ranks ${R.rank} of ${R.size} · avg ${sg(R.me.avg)} min`} foot={<>Rule: routes from {d.o} ranked by mean departure delay, minimum 5 observed flights; percentile = share of routes ranked below. {d.scope}</>}>
    <div className="hx-gauge"><i style={{ ["--w" as any]: `${pct}%` }} /><b style={{ left: `${pct}%` }} /></div>
    <div className="hx-facts"><div><small>Most punctual</small>{R.best.map((x: any) => <b key={x.k} className="hx-li">{x.k} {sg(x.avg)}m</b>)}</div><div><small>Least punctual</small>{R.worst.map((x: any) => <b key={x.k} className="hx-li">{x.k} {sg(x.avg)}m</b>)}</div></div></Hero>; }
function Calendar({ d }: any) { const k = `Route calendar · ${d.o}→${d.t}`; if (!d.calendar.length) return <Empty k={k} msg="Skyline hasn't observed this route yet." foot={d.scope} />;
  const first = new Date(d.calendar[0].date + "T12:00:00Z"); const pad = (first.getUTCDay() + 6) % 7;
  const n = d.calendar.reduce((t: number, x: any) => t + x.n, 0);
  return <Hero cls="hx-cal" tone="dim" kicker={k} verdict={<>{d.calendar.length}<small> days · {n} flights</small></>} sub="Average departure delay per day, as seen on the board" foot={<>Green under 15 min, orange 15–29, red 30+; ✕ marks a day with a cancellation. {d.scope}</>}>
    <div className="hx-grid">{["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <small key={i}>{x}</small>)}{Array.from({ length: pad }, (_, i) => <span key={"p" + i} />)}
      {d.calendar.map((x: any, i: number) => <div key={x.date} style={{ background: col(x.avg), animationDelay: `${i * 40}ms` }}><b>{dd(x.date, { day: "numeric" })}</b><small>{x.avg == null ? "–" : sg(x.avg)}{x.cancelled ? " ✕" : ""}</small></div>)}</div></Hero>; }
function Spread({ d }: any) { const k = `How late ${d.o}→${d.t} runs`; const r = d.route; if (r.flown < 10) return <Empty k={k} msg={`Needs 10 observed departures; Skyline has ${r.flown}.`} foot={d.scope} />;
  const B = [["Early/on time", -99, 1], ["1–14 min", 1, 15], ["15–29", 15, 30], ["30–59", 30, 60], ["60+", 60, 999]] as const;
  return <SpreadInner d={d} B={B} k={k} />; }
function SpreadInner({ d, B, k }: any) { const [raw, setRaw] = useState<number[] | null>(null);
  useEffect(() => { api(`/route-insight?o=${d.o}&t=${d.t}&raw=1`).then((j: any) => setRaw(j.raw || null)).catch(() => setRaw(null)); }, [d.o, d.t]);
  if (!raw) return null; const c = B.map(([, a, b]: any) => raw.filter(v => v >= a && v < b).length); const mx = Math.max(...c); const on = Math.round(raw.filter(v => v < 15).length / raw.length * 100);
  return <Hero cls="hx-sp" tone={on >= 80 ? "ok" : on >= 60 ? "warn" : "bad"} kicker={k} verdict={<>{on}%<small> leave under 15 min late</small></>} sub={`${raw.length} observed departures`} foot={<>Counts of observed departure delays in each band. {d.scope}</>}>
    <div className="hx-hist">{B.map(([l]: any, i: number) => <div key={l}><em>{c[i]}</em><div><i style={{ height: `${Math.max(3, c[i] / mx * 100)}%`, background: ["var(--green)", "var(--green)", "var(--orange)", "var(--red)", "var(--red)"][i], animationDelay: `${i * 70}ms` }} /></div><small>{l}</small></div>)}</div></Hero>; }
export function RouteInsights({ f }: { f: Flight }) { const d = useRI(f); if (!d || d.err || !f.origin?.iata) return null;
  return <><BestDay d={d} /><Trend d={d} /><Spread d={d} /><Calendar d={d} /><Cancel d={d} /><AirlineLeague d={d} /><RouteLeague d={d} /></>; }
const ALERT: Record<string, string> = { avoid_all_travel_to_whole_country: "FCDO advises against ALL travel", avoid_all_but_essential_travel_to_whole_country: "FCDO advises against all but essential travel", avoid_all_travel_to_parts: "FCDO advises against all travel to parts", avoid_all_but_essential_travel_to_parts: "FCDO advises against all but essential travel to parts" };
export function DestInfo({ f }: { f: Flight }) { const c = f.destination?.iata; const [d, setD] = useState<any>(null);
  useEffect(() => { if (c) api(`/dest-info/${c}?date=${f.date || ""}`).then(setD).catch(() => {}); }, [c, f.date]); if (!d) return null;
  const a = d.advice, h = d.holidays; const date = (f.date || d.date).slice(0, 10); const t0 = Date.parse(date);
  const near = h?.list ? h.list.filter((x: any) => Math.abs(Date.parse(x.date) - t0) <= 3 * 864e5) : []; const nat = near.filter((x: any) => x.national);
  const next = h?.list ? h.list.filter((x: any) => x.date >= date).slice(0, 4) : [];
  return <>{a && !a.none && !a.error && <Hero cls="hx-ta" tone={a.alerts.length ? (a.alerts.some((x: string) => x.includes("whole")) ? "bad" : "warn") : "ok"} kicker={`UK travel advice · ${d.country}`} verdict={a.alerts.length ? ALERT[a.alerts[0]] || a.alerts[0].replace(/_/g, " ") : "No FCDO travel warnings"}
      sub={<>Updated {dd(a.updated, { day: "numeric", month: "short", year: "numeric" })}{a.change ? <> · “{a.change.trim()}”</> : null}</>} foot={<>Colour: red for whole-country warnings, orange for warnings on parts, green for none. <a href={a.url} target="_blank" rel="noreferrer">GOV.UK FCDO ↗</a></>}>
      <div className="hx-chips">{a.parts.map((p: any) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><span>{p.title} ↗</span></a>)}</div></Hero>}
    {h && !h.uk && !h.none && !h.error && <Hero cls="hx-ho" tone={nat.length ? "warn" : near.length ? "dim" : "ok"} kicker={`Public holidays · ${d.country}`} verdict={nat.length ? `Holiday crowds likely: ${nat[0].name}` : near.length ? `Regional holiday: ${near[0].name}` : "No holiday near your dates"}
      sub={nat.length ? `${dd(nat[0].date, { weekday: "short", day: "numeric", month: "short" })} · expect busier flights, roads and closed shops` : `Checked ${dd(new Date(t0 - 3 * 864e5).toISOString())} to ${dd(new Date(t0 + 3 * 864e5).toISOString())}`}
      foot={<>Rule: a national public holiday within 3 days of the flight date is flagged as likely crowds; regional ones are shown but not flagged. Nager.Date ({h.cc}).</>}>
      <div className="hx-hol">{next.map((x: any) => <div key={x.date + x.name} className={near.includes(x) ? "near" : ""}><b>{dd(x.date, { day: "numeric" })}</b><small>{dd(x.date, { month: "short" })}</small><span>{x.name}{x.national ? "" : " (regional)"}</span></div>)}</div></Hero>}</>; }
