// v63b: light entry points (no three.js here) — 3D airport button for any airport + "What matters now" home feed.
import "./v63.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "./lib";
import { liv } from "./v36";
const Apt3D = lazy(() => import("./v63"));
export function Apt3DBtn({ iata, name }: { iata: string; name?: string }) {
  const [o, setO] = useState(() => new RegExp("apt3d=" + iata).test(location.hash));
  return <><button className="card press a3entry" onClick={() => setO(true)}><span style={{ fontSize: 22 }}>🛬</span><div><b>See {name || iata} in 3D</b> <span className="m3beta">BETA</span><div className="muted sm">Terminals, taxiways and live planes taxiing · OpenStreetMap + ADS-B</div></div></button>
    {o && <Suspense fallback={<div className="a3 a3load2">Loading 3D view…</div>}><Apt3D iata={iata} onClose={() => setO(false)} /></Suspense>}</>;
}

const ago = (t: string) => { const m = Math.round((Date.now() - +new Date(t)) / 6e4); return m < 1 ? "now" : m < 60 ? m + "m" : Math.round(m / 60) + "h"; };
const RULES = "Summary = up to two sentences, picked by rule: (1) the highest-scoring ACARS message that mentions emergency, medical, diversion or security; (2) an emergency squawk (7500/7600/7700) seen by ADS-B; (3) the first FAA ground stop, else ground-delay programme; (4) if none of those, the airport with the most 30+ min late departures on Skyline's boards. Happening now = ACARS messages scoring 25+ and emergency squawks. Airport situations = FAA status (US) + Skyline boards with 3+ departures 30+ min late. Highlight = biggest logged delay in the last 7 days. Message text is shown exactly as sent (it is not rewritten).";
const EMK = ["emergency", "medical", "diversion", "security"];
export function WhatMatters() {
  const [d, setD] = useState<any>(null); const [rule, setRule] = useState(false);
  useEffect(() => { let s = false; Promise.all(["/acars-top", "/interesting-now", "/faa-status", "/delayed-now", "/week-highlight"].map(p => api(p).catch(() => null))).then(([ac, it, faa, dl, wk]) => !s && setD({ ac, it, faa, dl, wk })); return () => { s = true; }; }, []);
  if (!d) return <div className="skel" style={{ height: 120, margin: "12px 0" }} />;
  const acs = (d.ac?.list || []).filter((m: any) => m.score >= 25).sort((a: any, b: any) => b.score - a.score);
  const sq = (d.it?.list || []).filter((x: any) => (x.why || []).some((w: string) => /squawking 7[567]00/.test(w)));
  const faa = (d.faa?.list || []) as any[];
  const G: Record<string, any[]> = {}; (d.dl?.list || []).forEach((f: any) => (G[f.o] ||= []).push(f)); const boards = Object.entries(G).filter(([, L]) => L.length >= 3).sort((a, b) => b[1].length - a[1].length);
  const sum: string[] = []; const em = acs.find((m: any) => (m.hits || []).some((h: string) => EMK.includes(h)));
  if (em) sum.push(`${em.flight || em.tail || "An aircraft"} sent an ACARS message mentioning ${em.hits.filter((h: string) => EMK.includes(h)).join(" and ")}.`);
  if (sq[0] && sum.length < 2) sum.push(`${sq[0].k}${sq[0].type ? ` (${sq[0].type})` : ""} is ${sq[0].why.find((w: string) => /squawking/.test(w)).replace(/^\+\d+ /, "")}.`);
  const gs = faa.find(x => x.kind === "ground stop") || faa.find(x => x.kind === "ground delay");
  if (gs && sum.length < 2) sum.push(`${gs.ap} has an FAA ${gs.kind}${gs.reason ? " for " + gs.reason.replace(/^WX:/i, "").toLowerCase() : ""}${gs.end ? " until " + gs.end : gs.avg ? ", averaging " + gs.avg : ""}.`);
  if (!sum.length && boards[0]) sum.push(`${boards[0][0]} has ${boards[0][1].length} departures running 30+ min late on its board.`);
  const sit = [...faa.filter(x => x.kind !== "closure" || !/NON SKED|TRANSIENT|GA\b/.test(x.reason || "")).slice(0, 8).map(x => ({ tag: x.kind, ap: x.ap, city: x.city, head: x.kind === "ground stop" ? `Flights on hold${x.reason ? " for " + x.reason.replace(/^WX:/i, "").toLowerCase() : ""}${x.end ? " until " + x.end : ""}` : x.kind === "ground delay" ? `Arriving flights held ${x.avg ? "avg " + x.avg : ""}${x.max ? ", up to " + x.max : ""}` : x.kind === "closure" ? `Closed: ${(x.reason || "").slice(0, 70)}` : `${x.kind[0].toUpperCase() + x.kind.slice(1)}s ${x.min || ""}${x.max ? "–" + x.max : ""}${x.trend ? " · " + x.trend.toLowerCase() : ""}`, src: "FAA" })),
    ...boards.slice(0, 6).map(([ap, L]) => ({ tag: "delays", ap, city: null, head: `${L.length} departures 30+ min late · worst ${Math.max(...L.map((f: any) => f.d))} min`, src: "Skyline boards" }))];
  const wk = d.wk?.top;
  return <section className="wm">
    <div className="wmsum card"><div className="row between"><span className="faint sm">What matters now</span><button className="chip sm" onClick={() => setRule(!rule)}>{rule ? "Hide rule" : "How?"}</button></div>
      <p>{sum.length ? sum.join(" ") : "Nothing unusual right now in the sources Skyline reads — no flagged ACARS messages, emergency squawks or FAA programmes."}</p>{rule && <p className="faint sm">{RULES}</p>}</div>
    <h3 className="wmh">Happening now</h3>
    {acs.length + sq.length ? <div className="wmrow">{sq.slice(0, 3).map((x: any) => <div key={x.k} className="wmc wmred"><div className="row g6"><span className="tag">SQUAWK</span><b>{x.k}</b><span className="muted sm">{x.type}</span></div><h4>{x.why.find((w: string) => /squawking/.test(w)).replace(/^\+\d+ squawking /, "Squawk ")}</h4><div className="faint sm">{x.reg || ""} · ADS-B (adsb.lol)</div></div>)}
      {acs.slice(0, 8).map((m: any, i: number) => { const l = liv(m.flight); return <div key={i} className="wmc"><div className="row g6"><span className="tag">ACARS</span><b>{m.flight || m.tail}</b><span className="muted sm">{l ? l[2] : m.tail}</span><span className="faint sm" style={{ marginLeft: "auto" }}>{ago(m.t)}</span></div><div className="wmhits">{(m.hits || []).join(" · ") || m.what}</div><pre>{(m.text || "").trim().slice(0, 160)}</pre><div className="faint sm">Exact message text from airframes.io · score {m.score}</div></div>; })}</div>
      : <div className="card muted sm">No ACARS messages scored 25+ in the latest sample and no emergency squawks.</div>}
    <h3 className="wmh">Airport situations</h3>
    {sit.length ? <div className="wmrow">{sit.map((s, i) => <div key={i} className={"wmc wmsit" + (s.tag === "ground stop" ? " wmred" : "")}><div className="row g6"><span className="tag">{s.tag.toUpperCase()}</span><b>{s.ap}</b><span className="muted sm">{s.city || ""}</span></div><h4>{s.head}</h4><div className="faint sm">{s.src === "FAA" ? "FAA NAS status · US only · times as FAA gives them" : "Skyline's own board reads"}</div></div>)}</div> : <div className="card muted sm">No FAA programmes and no airports with 3+ late departures on Skyline's boards right now.</div>}
    <h3 className="wmh">This week's highlight</h3>
    <div className="card wmwk">{wk ? <><b>{wk.n}</b> {wk.o}→{wk.t} left <b>{Math.floor(wk.d / 60) ? Math.floor(wk.d / 60) + " h " : ""}{wk.d % 60} min</b> late on {wk.date} — the biggest delay in Skyline's log this week{d.wk.cx ? <>. Most cancellations: {d.wk.cx.ap} on {d.wk.cx.date} ({d.wk.cx.n}).</> : "."}</> : "Not enough logged flights this week yet."}<div className="faint sm mt8">{d.wk?.rule}</div></div>
  </section>;
}
