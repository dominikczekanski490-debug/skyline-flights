// "Clearway" skin: a clean white/navy mobile-airport-website style that restyles the whole app, plus the
// list/detail/itinerary/destination-guide layouts it needs. Original name and no third-party airport branding or logos.
import { useEffect, useState, type ReactNode } from "react";
import "@fontsource-variable/inter";
import "./clearway.css";
import { fmtT, best, delay, dur, estDurMin, withEstArr, type Flight } from "./lib";
import { airlineName, hasLogo } from "./brand";
import { status as boardStatus } from "./terminal";

export const CW = "clearway";
const isCw = () => typeof document !== "undefined" && document.documentElement.dataset.skin === CW;
export function useCw() {
  const [v, s] = useState(isCw);
  useEffect(() => { const o = new MutationObserver(() => s(isCw())); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] }); s(isCw()); return () => o.disconnect(); }, []);
  return v;
}

// ---- destination data (pre-built from Wikipedia / Wikidata / Wikimedia Commons, see public/dest/ATTRIBUTION.md) ----
export type Dest = { iata: string; name: string; title: string; url: string; desc?: string; lat: number; lon: number; tz?: string; country?: string; countryUrl?: string; lang?: string[]; cur?: string[]; tags?: string[];
  img?: { file: string; page?: string; lic: string; by?: string; col: string }; climate?: { hi: number[]; lo: number[]; loc?: string; page: string } | null };
let DEST: Record<string, Dest> | null = null; let destP: Promise<Record<string, Dest>> | null = null;
export const loadDest = () => destP ||= fetch("/dest/index.json").then(r => r.json()).then(j => (DEST = j)).catch(() => (DEST = {}));
export function useDest(iata?: string) {
  const [d, sd] = useState<Dest | null | undefined>(() => (DEST && iata ? DEST[iata] || null : undefined));
  useEffect(() => { if (!iata) return; loadDest().then(j => sd(j[iata] || null)); }, [iata]);
  return d;
}
// Precache every bundled hero photo once the skin is in use (cache-first in the service worker afterwards), so detail screens open instantly.
let warmed = false;
export function warmDest() {
  if (warmed || typeof caches === "undefined") return; warmed = true; const c = (navigator as any).connection; if (c?.saveData) return;
  loadDest().then(async j => { const cache = await caches.open("skyline-dest-v1"); const urls = (Object.values(j) as Dest[]).filter(d => d.img).map(d => `/dest/${d.iata}.webp`);
    for (let i = 0; i < urls.length; i += 8) { const part: string[] = []; for (const u of urls.slice(i, i + 8)) if (!(await cache.match(u))) part.push(u); if (part.length) await cache.addAll(part).catch(() => {}); await new Promise(r => setTimeout(r, 120)); } });
}

// Tiny blurred previews (lazy chunk, ~50 KB) so a photo-shaped preview shows on the first frame; the real WebP replaces it.
let LQ: Record<string, string> | null = null; let lqP: Promise<Record<string, string>> | null = null;
export const loadLqip = (): Promise<Record<string, string>> => lqP ||= import("./destlqip").then(m => (LQ = m.LQIP)).catch(() => (LQ = {} as Record<string, string>));
export const hasPhoto = (iata?: string) => !!iata && !!LQ?.[iata];
// Start the photo download right away (row tap / overlay open), before React even mounts the hero.
export function preloadHero(iata?: string) {
  if (!iata || typeof document === "undefined" || document.querySelector(`link[data-hero="${iata}"]`)) return;
  const go = () => { if (LQ && !LQ[iata]) return; const l = document.createElement("link"); l.rel = "preload"; l.as = "image"; l.href = `/dest/${iata}.webp`; l.dataset.hero = iata; (l as any).fetchPriority = "high"; document.head.appendChild(l); };
  LQ ? go() : loadLqip().then(go);
}
export function Hero({ iata, children, tall }: { iata?: string; children?: ReactNode; tall?: boolean }) {
  const d = useDest(iata); const [ok, setOk] = useState(false); const [lq, setLq] = useState(() => (iata && LQ ? LQ[iata] || "" : null));
  useEffect(() => { setOk(false); if (!iata) return setLq(""); if (LQ) setLq(LQ[iata] || ""); else loadLqip().then(m => setLq(m[iata] || "")); }, [iata]);
  // the photo is requested as soon as we know it exists (from the bundled preview list), without waiting for index.json
  const photo = !!iata && (lq ? true : !!d?.img);
  return <div className={"cw-hero" + (tall ? " tall" : "")} style={d?.img?.col ? { backgroundColor: d.img.col } : undefined}>
    {lq && <i className="cw-lq" style={{ backgroundImage: `url(data:image/webp;base64,${lq})` }} />}
    {photo && <img src={`/dest/${iata}.webp`} alt={d?.name || ""} decoding="async" loading="eager" fetchPriority="high" className={ok ? "on" : ""} onLoad={() => setOk(true)} ref={el => { if (el?.complete && el.naturalWidth) setOk(true); }} onError={e => ((e.target as HTMLImageElement).style.display = "none")} />}
    <i className="cw-hero-shade" />{children}
    {d?.img && <a className="cw-credit" href={d.img.page} target="_blank" rel="noreferrer">Photo: {d.name}{d.img.by ? " · " + d.img.by : ""} · {d.img.lic}</a>}</div>;
}

const ic = { menu: <svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" /></svg>, search: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>,
  cal: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>, bell: <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  close: <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>, plane: <svg viewBox="0 0 24 24"><path d="M2 13.5 22 12 2 10.5l3 1.5zM9 12l-3-7h2l6 7-6 7H6z" /></svg>, tick: <svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></svg> };
export type CwNav = { menu: () => void; search: () => void; cal: () => void; bell: () => void; close?: () => void };
export function TopBar({ nav, over, fixed }: { nav: CwNav; over?: boolean; fixed?: boolean }) {
  return <div className={"cw-bar" + (over ? " over" : "") + (fixed ? " fixed" : "")}><div className="cw-bar-l"><button aria-label="Menu" onClick={nav.menu}>{ic.menu}</button><button aria-label="Search" onClick={nav.search}>{ic.search}</button></div>
    <div className="cw-bar-c" aria-hidden="true" /> {/* intentionally blank: no logo */}
    <div className="cw-bar-r"><button aria-label="My trips calendar" onClick={nav.cal}>{ic.cal}</button><button aria-label="Notifications" onClick={nav.bell}>{ic.bell}</button>{nav.close && <button aria-label="Close" onClick={nav.close}>{ic.close}</button>}</div></div>;
}

// ---- status pill ----
const tc = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s;
export function pill(f: any, dir: string): { t: string; k: "red" | "green" | "amber" | "blue" | "cx" } {
  const b = boardStatus(f, dir); const t: any = dir === "dep" ? f.dep : f.arr; const tz = dir === "dep" ? f.origin?.tz : f.destination?.tz;
  const gate = (b.txt.match(/Gate ([A-Z]?\d+[A-Z]?)/)?.[1]) || t?.gate || ""; const x = b.txt.toLowerCase();
  if (/cancel/.test(x)) return { t: "Cancelled", k: "cx" };
  if (/divert|departing from|arriving at/.test(x)) return { t: b.txt, k: "amber" };
  if (/final call|flight closing/.test(x)) return { t: ("Final Call " + gate).trim(), k: "red" };
  if (/gate closed/.test(x)) return { t: "Gate Closed", k: "red" };
  if (/boarding/.test(x)) return { t: ("Boarding " + gate).trim(), k: "green" };
  if (/go to gate|gate open/.test(x)) return { t: ("Go to Gate " + gate).trim(), k: "amber" };
  if (/baggage/.test(x)) return { t: tc(b.txt.replace("Baggage belt", "Baggage Belt")), k: "amber" };
  if (/pushback|taxiing|departed|off blocks|taxied/.test(x)) return { t: "Departed", k: "blue" };
  if (/landed|at stand|bags delivered/.test(x)) return { t: "Landed" + (t?.actual ? " " + fmtT(t.actual, tz) : ""), k: "blue" };
  const when = t?.estimated || t?.scheduled;
  if (dir === "dep") return { t: when ? "Departing at " + fmtT(when, tz) : tc(b.txt), k: "blue" };
  return { t: when ? (/approach/.test(x) ? "On Approach " : "Expected at ") + fmtT(when, tz) : tc(b.txt), k: "blue" };
}
export const Pill = ({ p }: { p: { t: string; k: string } }) => <span className={"cw-pill " + p.k}>{p.t}</span>;

const ord = (n: number) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
export const capsDate = (ymd: string) => { const d = new Date(ymd + "T12:00:00Z"); return `${d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })} ${ord(d.getUTCDate())} ${d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}`.toUpperCase(); };

export function BoardList({ list, dir, date, tz, open, extra }: { list: any[]; dir: string; date: string; tz: string; open: (f: any) => void; extra?: ReactNode }) {
  // warm the hero photos of what's on screen first, so tapping a row shows its photo instantly
  useEffect(() => { loadDest().then(j => { const seen = new Set<string>(); for (const f of list.slice(0, 40)) { const i = (dir === "dep" ? f.destination : f.origin)?.iata; if (i && j[i]?.img && !seen.has(i)) { seen.add(i); const im = new Image(); im.decoding = "async"; im.src = `/dest/${i}.webp`; } } }); }, [list.length, dir]);
  return <div className="cw-list"><h1 className="cw-title">{dir === "dep" ? "Departures" : "Arrivals"}</h1><div className="cw-date">{capsDate(date)}</div>{extra}
    {list.map((f, i) => { const t = dir === "dep" ? f.dep : f.arr; const o = dir === "dep" ? f.destination : f.origin; const p = pill(f, dir); const cx = p.k === "cx"; const d = delay(t);
      return <button key={f.id + i} className={"cw-item" + (cx ? " cx" : "")} onPointerDown={() => preloadHero(o?.iata)} onClick={() => { preloadHero(o?.iata); open(f); }}><div className="cw-time"><b>{f.liveOnly ? "Live" : fmtT(t.scheduled, tz)}</b>{!cx && d != null && d >= 5 && t.estimated && <small>{fmtT(t.estimated, tz)}</small>}</div>
        <div className="cw-mid"><b className="cw-dest">{o?.city || o?.name || o?.iata}{o?.iata ? ` (${o.iata})` : ""}</b><div className="cw-line">{f.number} | {airlineName(f.airline) || f.airline?.iata}</div>{!cx && t.terminal && <div className="cw-line">T{String(t.terminal).replace(/^T/i, "")}</div>}<Pill p={p} /></div>
        <span className="cw-more">Details ›</span></button>; })}
    {!list.length && <div className="cw-empty">No flights to show.</div>}</div>;
}

// ---- flight detail ----
const Tile = ({ l, v, s }: { l: string; v: ReactNode; s?: ReactNode }) => <div className="cw-tile"><small>{l}</small><b>{v}</b>{s && <small>{s}</small>}</div>;
export function FlightTop({ f, nav, discover, crumbs }: { f: Flight; nav: CwNav; discover: (iata: string) => void; crumbs?: string }) {
  const g: any = withEstArr(f); const o = f.origin, a = f.destination; const dd = useDest(a?.iata); const dir = "dep";
  const ds = f.dep.scheduled, as_ = f.arr.scheduled; const real = ds && as_ ? (+new Date(as_) - +new Date(ds)) / 6e4 : 0; const mins = real > 0 ? real : estDurMin(o, a);
  const dep = best(f.dep); const p = pill(f, dir); preloadHero(a?.iata);
  return <div className="cw-fd"><Hero iata={a?.iata}><TopBar nav={nav} over /></Hero>
    <div className="cw-card"><div className="cw-card-h"><div className="cw-logo">{f.airline?.iata && hasLogo(f.airline.iata) ? <img src={`/logos/${f.airline.iata}.png`} alt={airlineName(f.airline)} /> : <b>{airlineName(f.airline) || f.airline?.iata}</b>}</div>
      <div className="cw-hd"><h2 className="cw-city">{dd?.name || a?.city || a?.iata}</h2><div className="cw-line">{f.number} | {airlineName(f.airline) || f.airline?.iata}</div></div><Pill p={p} /></div>
      <div className="cw-route"><div><b>{o?.iata}</b><small>{o?.city}{o?.country ? ", " + o.country : ""}</small></div>
        <div className="cw-path"><small>{mins ? dur(mins) + (real > 0 ? "" : " est.") : ""}</small><span><i />{ic.plane}<i /></span></div>
        <div className="r"><b>{a?.iata}</b><small>{a?.city}{a?.country ? ", " + a.country : ""}</small></div></div>
      <div className="cw-tiles"><Tile l="Departure" v={fmtT(dep, o?.tz)} s={dep ? new Date(dep).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: o?.tz || "Europe/London" }).replace(/ (\d{4})$/, ", $1") : ""} />
        {f.dep.terminal && <Tile l="Terminal" v={String(f.dep.terminal).replace(/^T/i, "")} />}{f.dep.gate && <Tile l="Gate" v={f.dep.gate} />}{!f.dep.gate && <Tile l="Gate" v="—" s="not announced yet" />}</div>
      {dd && <button className="cw-disc" onClick={() => discover(a!.iata)}>Discover {dd.name}<span>›</span></button>}</div>
    <div className="cw-crumbs">Home › {crumbs || "Departures"} › {f.number}</div>
    <Itinerary f={f} g={g} /></div>;
}
const gm = (q: string, mode: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=${mode}`;
function Itinerary({ f, g }: { f: Flight; g: any }) {
  const o = f.origin, a = f.destination; const dep = best(f.dep); const long = estDurMin(o, a) > 300; const sug = dep && !f.dep.actual ? new Date(+new Date(dep) - (long ? 3 : 2) * 3600e3).toISOString() : null;
  const al = airlineName(f.airline) || "your airline"; const web = f.airline?.links?.web; const apq = o?.name || (o?.iata + " airport");
  const st = pill(f, "dep"); const arr = best(g.arr);
  const S = ({ h, children }: { h: string; children?: ReactNode }) => <li><i /><h4>{h}</h4>{children}</li>;
  return <div className="cw-itin"><h3>Departure Itinerary</h3><ol>
    <S h="Before you leave"><ul className="cw-check">{["Passport or ID valid for your trip", "Boarding pass on your phone or printed", "Liquids in containers up to 100 ml, in a clear bag", `Baggage allowance checked with ${al}`].map(x => <li key={x}>{ic.tick}{x}</li>)}</ul></S>
    <S h="Get to the Airport"><div className="cw-btns"><a href={`https://www.google.com/search?q=${encodeURIComponent("car hire " + apq)}`} target="_blank" rel="noreferrer">Car hire</a><a href={gm(apq, "transit")} target="_blank" rel="noreferrer">Bus</a><a href={gm(apq, "driving")} target="_blank" rel="noreferrer">Taxi</a><a href={gm(apq, "transit")} target="_blank" rel="noreferrer">Train</a></div></S>
    <S h="Check-in"><p>Check-in and bag-drop closing times are set by {al}.{web && <> <a href={web} target="_blank" rel="noreferrer">Check with {al} ›</a></>}</p></S>
    <S h="Security">{sug && <div className="cw-tile w"><small>Suggested arrival</small><b>{fmtT(sug, o?.tz)}*</b></div>}</S>
    <S h="At the Terminal"><p>{f.dep.terminal ? `Your flight leaves from Terminal ${String(f.dep.terminal).replace(/^T/i, "")}.` : "Watch the departure screens for your gate."}</p></S>
    <S h="Boarding"><p>{f.dep.gate ? `Gate ${f.dep.gate}` : "Gate not announced yet"} · <Pill p={st} /></p></S>
    <S h="Departure"><p className="cw-up">from {(o?.city || "").toUpperCase()}{o?.country ? ", " + o.country.toUpperCase() : ""} ({o?.iata})</p>{dep && <div className="cw-tile w"><small>{f.dep.actual ? "Departed" : "Expected departure"}</small><b>{fmtT(dep, o?.tz)}</b></div>}</S>
    <S h="Arrival"><p className="cw-up">to {(a?.city || "").toUpperCase()}{a?.country ? ", " + a.country.toUpperCase() : ""} ({a?.iata})</p>{arr && <div className="cw-tile w"><small>{g.arr.actual ? "Arrived" : "Expected arrival"}</small><b>{fmtT(arr, a?.tz)}</b></div>}</S>
  </ol>{sug && <p className="cw-foot">* General guidance ({long ? "3" : "2"} hours before departure), not an official airport or airline time. Always follow {al}'s advice.</p>}</div>;
}

// ---- destination guide ----
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function DestPage({ iata, from, nav }: { iata: string; from?: any; nav: CwNav }) {
  const d = useDest(iata); preloadHero(iata);
  if (d === undefined) return <div className="cw-dest"><Hero iata={iata} tall><TopBar nav={nav} over /></Hero></div>;
  if (!d) return <div className="cw-dest"><Hero tall><TopBar nav={nav} over /></Hero><div className="cw-body"><h1 className="cw-big">{iata}</h1><p>No destination guide for {iata} yet.</p></div></div>;
  const zone = d.tz || from?.destination?.tz; const tz = (() => { if (!zone) return ""; try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find(x => x.type === "timeZoneName"); return p?.value; } catch { return ""; } })();
  const ft = from?.origin && from?.destination ? estDurMin(from.origin, from.destination) : 0;
  const rows: [string, ReactNode][] = ([["Language", d.lang?.join(", ")], ["Currency", d.cur?.map(c => c[0].toUpperCase() + c.slice(1)).join(", ")], ["Time Zone", zone ? `${zone.replace(/_/g, " ")}${tz ? " (" + tz + ")" : ""}` : ""], ["Flight Time", ft ? `about ${dur(ft)} from ${from.origin.iata} (estimate)` : ""], ["Airport Code", iata]] as [string, ReactNode][]).filter(r => r[1]);
  const c = d.climate;
  return <div className="cw-dest"><Hero iata={iata} tall><TopBar nav={nav} over /></Hero><div className="cw-body">
    <h1 className="cw-big">{d.name}</h1>{d.country && <a className="cw-country" href={d.countryUrl} target="_blank" rel="noreferrer">{d.country} ›</a>}
    {!!d.tags?.length && <div className="cw-tags">{d.tags.map(t => <span key={t}>{t}</span>)}</div>}
    {d.desc && <p className="cw-desc">{d.desc} <a href={d.url} target="_blank" rel="noreferrer">Wikipedia ›</a></p>}
    <h3>Essential Info</h3><table className="cw-tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
    {c && <><h3>Temp By Month (°C)</h3><div className="cw-temps"><table className="cw-tbl t"><thead><tr><th />{MON.map(m => <th key={m}>{m}</th>)}</tr></thead><tbody><tr><th>High</th>{c.hi.map((v, i) => <td key={i}>{v}</td>)}</tr><tr><th>Low</th>{c.lo.map((v, i) => <td key={i}>{v}</td>)}</tr></tbody></table></div>
      <p className="cw-src">Average daily high/low{c.loc ? ` — ${c.loc}` : ""}. Source: Wikipedia climate table ({c.page}).</p></>}
    <h3>Map</h3><iframe className="cw-map" title={`Map of ${d.name}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${d.lon - .25},${d.lat - .15},${d.lon + .25},${d.lat + .15}&layer=mapnik&marker=${d.lat},${d.lon}`} />
    <p className="cw-src">Text: Wikipedia (CC BY-SA 4.0) · Facts: Wikidata (CC0) · Map © OpenStreetMap contributors</p></div></div>;
}

// Settings → top "Theme" row: Clearway featured with a live preview swatch (all skins stay in Appearance below).
export function ThemeFeature({ theme, setTheme, name }: { theme: string; setTheme: (s: string) => void; name: string }) {
  const on = theme === CW;
  return <div className="card m0 cw-feat"><div className="row between"><b className="set-h sm">Theme</b><span className="faint sm">Now: {name}</span></div>
    <button className={"cw-feat-b press" + (on ? " on" : "")} onClick={() => setTheme(on ? "dark" : CW)} aria-pressed={on}>
      <span className="cw-sw" aria-hidden><i className="h" /><i className="t" /><i className="r"><em className="p" /></i><i className="r"><em className="p a" /></i><i className="r"><em className="p g" /></i></span>
      <span className="cw-feat-t"><b>Clearway</b><small>Clean white &amp; navy, photo-led flight pages and destination guides. Applies to the whole app, every airport.</small><em>{on ? "On ✓ · tap to switch back to Skyline Gold" : "Tap to use Clearway"}</em></span></button></div>;
}
