// v51 — natural-language Find (rule parser over live boards), airline page, aircraft type page, home pins + world clock.
// All rule-based; every number comes from an airport board, Skyline's observed log, ADS-B or Wikidata.
import { useEffect, useMemo, useState } from "react";
import { api, type Flight } from "./lib";
import { Hero } from "./v47";

const AL: Record<string, [string, string]> = { ryanair: ["FR", "RYR"], easyjet: ["U2", "EZY"], wizz: ["W6", "WZZ"], jet2: ["LS", "EXS"], tui: ["BY", "TOM"], "british airways": ["BA", "BAW"], ba: ["BA", "BAW"], aer: ["EI", "EIN"], "aer lingus": ["EI", "EIN"], lufthansa: ["LH", "DLH"], klm: ["KL", "KLM"], emirates: ["EK", "UAE"], qatar: ["QR", "QTR"], turkish: ["TK", "THY"], aegean: ["A3", "AEE"], loganair: ["LM", "LOG"], "virgin": ["VS", "VIR"], etihad: ["EY", "ETD"], "air france": ["AF", "AFR"], vueling: ["VY", "VLG"], pegasus: ["PC", "PGT"], sas: ["SK", "SAS"], "american": ["AA", "AAL"], united: ["UA", "UAL"], delta: ["DL", "DAL"] };
const ls = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const save = (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v));
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export type Parsed = { from?: string; to?: string; al?: [string, string]; alName?: string; after?: number; before?: number; late?: boolean; cx?: boolean; ontime?: boolean; airborne?: boolean };
function tm(h: string, m: string | undefined, ap: string | undefined) { let x = +h; if (ap === "pm" && x < 12) x += 12; if (ap === "am" && x === 12) x = 0; return x * 60 + +(m || 0); }
// Rules: "to X" → destination city/name/IATA contains X; "from/leaving/out of X" → board airport; "after/before H[:MM][am|pm]" → scheduled local time; delayed/late → ≥15 min late; cancelled; on time → <15 min late; airline names → IATA/ICAO prefix.
export function parseFind(q: string): Parsed { const s = " " + q.toLowerCase().replace(/[’]/g, "'") + " "; const o: Parsed = {};
  const t = /(after|before|from) (\d{1,2})(?::?(\d\d))?\s*(am|pm)?\b/g; let m; while ((m = t.exec(s))) { if (m[1] === "from" && !m[4] && !m[3]) continue; (o as any)[m[1] === "before" ? "before" : "after"] = tm(m[2], m[3], m[4]); }
  if (/cancel/.test(s)) o.cx = true; if (/\b(late|delay)/.test(s)) o.late = true; if (/on[- ]time|punctual/.test(s)) o.ontime = true; if (/airborne|in the air/.test(s)) o.airborne = true;
  for (const k of Object.keys(AL).sort((a, b) => b.length - a.length)) if (new RegExp(`\\b${k}\\b`).test(s)) { o.al = AL[k]; o.alName = k; break; }
  const stop = "(?= after| before| from| leaving| on time| that| which| today| tonight| delayed| cancel| late| flights|\\s*$)";
  const fr = s.match(new RegExp(`\\b(?:leaving|from|out of|departing) ([a-z .'-]+?)${stop}`)); if (fr && !/^\d/.test(fr[1])) o.from = fr[1].trim();
  const to = s.match(new RegExp(`\\b(?:to|for|into) ([a-z .'-]+?)${stop}`)); if (to) o.to = to[1].trim(); return o; }

const late = (f: any) => { const s = Date.parse(f.dep?.scheduled), e = Date.parse(f.dep?.actual || f.dep?.estimated); return isFinite(s) && isFinite(e) ? Math.round((e - s) / 60000) : null; };
const loc = (iso: string, tz?: string) => { const p = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).formatToParts(new Date(iso)); return +p.find(x => x.type === "hour")!.value * 60 + +p.find(x => x.type === "minute")!.value; };
export function applyFind(L: any[], p: Parsed) { return L.filter(f => { const d = late(f); const st = String(f.status || "").toLowerCase();
  if (p.to) { const h = [f.destination?.city, f.destination?.name, f.destination?.iata, f.destination?.country].join(" ").toLowerCase(); if (!h.includes(p.to)) return false; }
  if (p.al && !(f.airline?.iata === p.al[0] || f.airline?.icao === p.al[1] || String(f.number).startsWith(p.al[0]))) return false;
  if (p.cx && !st.includes("cancel")) return false; if (p.late && !(d != null && d >= 15)) return false; if (p.ontime && !(d != null && d < 15 && !st.includes("cancel"))) return false;
  if (p.airborne && !/depart|airborne|en.?route/.test(st)) return false;
  if (p.after != null || p.before != null) { if (!f.dep?.scheduled) return false; const m = loc(f.dep.scheduled, f.origin?.tz); if (p.after != null && m < p.after) return false; if (p.before != null && m >= p.before) return false; }
  return true; }); }

const CHIPS = ["delayed flights to Tenerife", "Jet2 flights", "leaving Heathrow after 8pm", "cancelled", "easyJet to Paris", "on time before 10am", "Ryanair from Stansted"];
export function FindView({ x, push }: { x: any; push: (o: any) => void }) {
  const [q, setQ] = useState(() => ls("sk.find.last", "delayed flights to Tenerife")); const [saved, setSaved] = useState<{ q: string; pin?: boolean }[]>(() => ls("sk.find.saved", []));
  const [home] = useState(() => ls("sk.find.home", "MAN")); const P = useMemo(() => parseFind(q), [q]);
  const [apt, setApt] = useState<{ iata: string; name: string } | null>(null); const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(""); const [src, setSrc] = useState("");
  useEffect(() => { save("sk.find.last", q); let dead = false; setErr("");
    (async () => { let a = { iata: home, name: home }; if (P.from) { const raw = P.from.toUpperCase(); const r = await api(`/airports/search?q=${encodeURIComponent(P.from)}`).catch(() => []); const hit = r.find((z: any) => z.iata === raw) || r[0]; if (!hit) { if (!dead) { setErr(`No airport matches “${P.from}”.`); setRows([]); } return; } a = { iata: hit.iata, name: hit.name }; }
      if (dead) return; setApt(a); setRows(null); try { const b = await api(`/board/${a.iata}`); if (dead) return; setSrc(b.provider || b.source || ""); setRows(b.flights || []); } catch (e: any) { if (!dead) { setErr(`Board for ${a.iata} unavailable: ${e.message || e}`); setRows([]); } } })();
    return () => { dead = true; }; }, [P.from, home]);
  const res = rows ? applyFind(rows, P) : null; const has = saved.find(s => s.q === q);
  const upd = (v: typeof saved) => { setSaved(v); save("sk.find.saved", v); };
  const bits = [P.from && `from ${apt?.iata || P.from}`, P.to && `to “${P.to}”`, P.al && `airline ${P.al[0]}/${P.al[1]}`, P.after != null && `after ${hm(P.after)}`, P.before != null && `before ${hm(P.before)}`, P.late && "≥15 min late", P.ontime && "<15 min late", P.cx && "cancelled", P.airborne && "departed"].filter(Boolean);
  return <><div className="head"><div><h1>Find flights</h1><div className="sub">Plain-English search over live departure boards</div></div>{x}</div><div className="px">
    <input className="lab-input" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. delayed flights to Tenerife" aria-label="Search" />
    <div className="lab-chips">{CHIPS.map(c => <button key={c} onClick={() => setQ(c)}>{c}</button>)}</div>
    <div className="lab-parsed">Understood: {bits.length ? bits.join(" · ") : "nothing yet — showing every departure"}{!P.from && ` · board ${home} (say “from X” to change)`}</div>
    <div className="row g8 mt8"><button className="btn sm" onClick={() => upd(has ? saved.filter(s => s.q !== q) : [{ q }, ...saved].slice(0, 12))}>{has ? "★ Saved" : "☆ Save search"}</button>{has && <button className="btn sm" onClick={() => upd(saved.map(s => s.q === q ? { ...s, pin: !s.pin } : s))}>{has.pin ? "📌 Pinned to Home" : "Pin to Home"}</button>}{P.al && <button className="btn sm" onClick={() => push({ t: "airline", iata: P.al![0], icao: P.al![1], name: P.alName })}>Airline page →</button>}</div>
    {saved.length > 0 && <div className="mt12"><div className="faint xs">Saved searches</div><div className="lab-chips">{saved.map(s => <button key={s.q} onClick={() => setQ(s.q)}>{s.pin ? "📌 " : "★ "}{s.q}</button>)}</div></div>}
    {err && <div className="card mt12 sm">{err}</div>}
    {!err && res == null && <div className="faint sm mt12">Loading {apt?.iata} board…</div>}
    {res && !err && <div className="mt12"><div className="faint xs">{res.length} of {rows!.length} departures from {apt?.name} match{src && ` · source: ${src}`}</div>
      {res.length === 0 && <div className="card mt8 sm">Nothing on today's {apt?.iata} board matches. The board only covers today's departures, so try another airport (“from …”) or loosen a filter.</div>}
      {res.slice(0, 60).map(f => { const d = late(f); return <button key={f.id} className="card mt8 row between" style={{ width: "100%", textAlign: "left" }} onClick={() => push({ t: "flight", f })}>
        <div><b>{f.number}</b> <span className="muted sm">{f.airline?.name}</span><div className="sm">{f.destination?.city || f.destination?.name} ({f.destination?.iata})</div></div>
        <div style={{ textAlign: "right" }}><b>{f.dep?.scheduled ? hm(loc(f.dep.scheduled, f.origin?.tz)) : "—"}</b><div className="sm muted">{String(f.status || "").includes("cancel") ? "Cancelled" : d == null ? f.status || "" : d >= 15 ? `+${d} min` : "On time"}</div></div></button>; })}
    </div>}
    <div className="faint xs mt12">Rules: “to X” matches destination city/name/code; “from/leaving X” picks the board via airport search; times are scheduled local times (pm aware); late = 15+ min behind schedule using actual or estimated off-block.</div></div></>; }

export function AirlinePage({ iata, icao, name, x, push }: any) { const [d, setD] = useState<any>(null); const [fx, setFx] = useState<any>(null); const [e, setE] = useState("");
  const pinned = ls("sk.pins.al", []) as any[]; const [pin, setPin] = useState(pinned.some(p => p.icao === icao));
  useEffect(() => { api(`/airline-page?pre=${[icao, iata].filter(Boolean).join(",")}&icao=${icao || ""}`).then(setD).catch(z => setE(String(z.message || z))); if (icao) api(`/airline-facts/${icao}`).then(setFx).catch(() => setFx({ none: true })); }, [iata, icao]);
  const tog = () => { const L = ls("sk.pins.al", []).filter((p: any) => p.icao !== icao); if (!pin) L.unshift({ iata, icao, name: fx?.name || name }); save("sk.pins.al", L.slice(0, 8)); setPin(!pin); };
  const title = fx?.name || name || icao || iata;
  return <><div className="head"><div><h1>{title}</h1><div className="sub">{[iata, icao].filter(Boolean).join(" / ")}</div></div>{x}</div><div className="px">
    <button className="btn sm" onClick={tog}>{pin ? "📌 Pinned to Home" : "Pin to Home"}</button>
    {e && <div className="card mt12 sm">Couldn't load: {e}</div>}
    {fx && !fx.none && <Hero kicker="Airline facts" verdict={title} sub={fx.founded ? `Founded ${fx.founded}` : "Founding year not on Wikidata"} foot={fx.source}>
      <div className="hx-facts"><div><span className="faint xs">Hubs</span><div className="sm">{fx.hubs?.length ? fx.hubs.join(", ") : "Not listed on Wikidata"}</div></div><div><span className="faint xs">Alliance</span><div className="sm">{fx.alliance || "None listed"}</div></div><div><span className="faint xs">HQ</span><div className="sm">{fx.hq || "Not listed"}</div></div></div></Hero>}
    {d && <Hero kicker="On-time from our log" verdict={d.on == null ? "No observed flights yet" : `${d.on}% on time`} tone={d.on == null ? "" : d.on >= 75 ? "good" : d.on >= 55 ? "warn" : "bad"} sub={d.flights ? `${d.flights} departures across ${d.numbers} flight numbers${d.range ? `, ${d.range[0]} – ${d.range[1]}` : ""}; ${d.cancelled} cancelled; average ${d.avg} min late` : "Skyline hasn't seen this airline on the airport boards it reads."} foot={d.scope}>
      {d.bases.length > 0 && <div className="hx-cols"><div className="hx-col"><div className="faint xs">Busiest origins seen</div>{d.bases.map((b: any) => <div key={b.k} className="hx-row row between sm"><button className="link" onClick={() => push({ t: "board", iata: b.k })}>{b.k}</button><span>{b.n} · {b.on}%</span></div>)}</div>
        <div className="hx-col"><div className="faint xs">Top routes</div>{d.routes.map((b: any) => <div key={b.k} className="hx-row row between sm"><span>{b.k}</span><span>{b.n} · {b.on}%</span></div>)}</div></div>}</Hero>}
    {d && <Hero kicker="Fleet seen on ADS-B" verdict={d.fleet ? `${d.fleet.seen} aircraft` : "No ICAO code, no fleet"} sub={d.fleet ? `${d.fleet.airborne} were airborne at last contact; ${d.fleet.window}. Only aircraft our receivers' feed actually saw — not the full fleet.` : ""} foot="Source: ADS-B (adsb.lol) via Skyline fleet tracker">
      {d.fleet?.types.length ? d.fleet.types.map((t: any) => <div key={t.k} className="hx-row row between sm"><button className="link" onClick={() => push({ t: "type", q: t.k })}>{t.k}</button><span>{t.n}</span></div>) : d.fleet && <div className="sm">None seen in the window.</div>}</Hero>}
  </div></>; }

const ICAO_T: Record<string, string> = { A20N: "Airbus A320neo", A21N: "Airbus A321neo", A319: "Airbus A319", A320: "Airbus A320", A321: "Airbus A321", A332: "Airbus A330-200", A333: "Airbus A330-300", A339: "Airbus A330-900", A359: "Airbus A350-900", A35K: "Airbus A350-1000", A388: "Airbus A380", B738: "Boeing 737-800", B38M: "Boeing 737 MAX 8", B39M: "Boeing 737 MAX 9", B752: "Boeing 757-200", B763: "Boeing 767-300", B772: "Boeing 777-200", B77W: "Boeing 777-300ER", B788: "Boeing 787-8", B789: "Boeing 787-9", B78X: "Boeing 787-10", E190: "Embraer 190", E195: "Embraer 195", E75L: "Embraer 175", AT76: "ATR 72-600", AT75: "ATR 72-500", DH8D: "De Havilland Canada Dash 8-400", DH8C: "De Havilland Canada Dash 8-300", BCS3: "Airbus A220-300", BCS1: "Airbus A220-100", CRJ9: "CRJ900" };
export function TypePage({ q, x }: { q: string; x: any }) { const name = ICAO_T[q.toUpperCase()] || q; const [d, setD] = useState<any>(null); const [e, setE] = useState("");
  useEffect(() => { api(`/type-info?q=${encodeURIComponent(name)}`).then(setD).catch(z => setE(String(z.message || z))); }, [name]);
  const n = (v: any, u: string) => v == null ? <span className="faint">Not on Wikidata</span> : <>{(+v).toLocaleString("en-GB", { maximumFractionDigits: 2 })} {u}</>;
  const F: [string, any][] = d && !d.none ? [["Manufacturer", d.maker || <span className="faint">Not on Wikidata</span>], ["First flight", d.firstFlight || <span className="faint">Not on Wikidata</span>], ["Length", n(d.lengthM, "m")], ["Wingspan", n(d.spanM, "m")], ["Height", n(d.heightM, "m")], ["Max take-off mass", n(d.mtowKg, "kg")], ["Seats", n(d.seats, "")], ["Range", n(d.rangeKm, "km")], ["Built", n(d.built, "")]] : [];
  const gaps = F.filter(([, v]) => typeof v === "object" && (v as any)?.props?.children === "Not on Wikidata" || (v as any)?.props?.className === "faint").length;
  return <><div className="head"><div><h1>{name}</h1><div className="sub">{q !== name ? `ICAO type ${q.toUpperCase()}` : "Aircraft type"}</div></div>{x}</div><div className="px">
    {e && <div className="card sm">Couldn't load: {e}</div>}{!d && !e && <div className="faint sm">Asking Wikidata…</div>}
    {d?.none && <div className="card sm">Wikidata has no aircraft-model item matching “{name}”. Skyline shows no specs rather than guess.</div>}
    {d && !d.none && <Hero kicker="Aircraft type" verdict={d.name} sub={d.name.toLowerCase() !== name.toLowerCase() ? `Closest Wikidata match for “${name}”` : undefined} foot={<>{d.source}{gaps ? ` · ${gaps} of ${F.length} fields not recorded there` : ""}{d.wiki && <> · <a href={d.wiki} target="_blank" rel="noreferrer">Wikipedia</a></>}</>}>
      {d.img && <img src={d.img.replace(/^http:/, "https:") + "?width=640"} alt={d.name} style={{ width: "100%", borderRadius: 12 }} />}
      <div className="hx-facts">{F.map(([k, v]) => <div key={k}><span className="faint xs">{k}</span><div className="sm">{v}</div></div>)}</div></Hero>}
  </div></>; }

export function HomePins({ flights, push }: { flights: Flight[]; push: (o: any) => void }) {
  const [now, setNow] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const S = (ls("sk.find.saved", []) as any[]).filter(s => s.pin); const A = ls("sk.pins.al", []) as any[]; const P = ls("sk.pins.apt", []) as string[];
  const zones = useMemo(() => { const m = new Map<string, string>(); flights.forEach(f => [f.origin, f.destination].forEach((a: any) => a?.tz && !m.has(a.tz) && m.set(a.tz, a.city || a.iata))); return [...m.entries()].slice(0, 6); }, [flights]);
  const clk = (tz: string) => new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return <Hero kicker="Your pins" verdict={S.length + A.length + P.length ? `${S.length + A.length + P.length} pinned` : "Nothing pinned yet"} sub={S.length + A.length + P.length ? undefined : "Pin a search in Find or an airline on its page and it shows up here."} foot="World clock: time zones of airports in your tracked flights">
    <div className="lab-chips"><button onClick={() => push({ t: "find" })}>🔎 Find flights</button>{S.map(s => <button key={s.q} onClick={() => { save("sk.find.last", s.q); push({ t: "find" }); }}>📌 {s.q}</button>)}{A.map(a => <button key={a.icao} onClick={() => push({ t: "airline", ...a })}>✈︎ {a.name || a.icao}</button>)}{P.map(p => <button key={p} onClick={() => push({ t: "board", iata: p })}>🛫 {p}</button>)}</div>
    {zones.length > 0 ? <div className="hx-facts mt8">{zones.map(([tz, c]) => <div key={tz}><span className="faint xs">{c}</span><div><b>{clk(tz)}</b></div></div>)}</div> : <div className="faint sm mt8">Track a flight to get a world clock for its airports.</div>}
  </Hero>; }
