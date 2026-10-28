// v46: arrival ground info (OpenStreetMap) and country essentials (Wikidata). Real sources; rules labelled.
import { useEffect, useState } from "react";
import { api, type Flight } from "./lib";
const PLUG: [RegExp, string][] = [[/NEMA 1-15/i, "A"], [/NEMA 5-15/i, "B"], [/Europlug|CEE 7\/16/i, "C"], [/BS 546/i, "D/M"], [/French|CEE 7\/5/i, "E"], [/Schuko|CEE 7\/4/i, "F"], [/BS 1363/i, "G"], [/SI 32|Israeli/i, "H"], [/AS\/NZS 3112|Australian/i, "I"], [/SN 441011|Swiss/i, "J"], [/Danish|DS 60884/i, "K"], [/CEI 23-50|Italian/i, "L"], [/SANS 164|South African/i, "N"], [/TIS 166|Thai/i, "O"]];
const plugType = (s: string) => PLUG.find(([r]) => r.test(s))?.[1] || null;
function usePoll(path: string | null, open: boolean) { const [d, setD] = useState<any>(null); const [e, setE] = useState(""); const [n, setN] = useState(0);
  useEffect(() => { if (!open || !path || d?.pending === undefined && d) return; let dead = false, t: any;
    const go = () => api(path).then(j => { if (dead) return; if (j.pending) { setD(j); t = setTimeout(go, 8000); } else setD(j); }).catch(x => !dead && setE(x.message));
    setE(""); go(); return () => { dead = true; clearTimeout(t); }; }, [open, path, n]);
  return { d: d?.pending ? null : d, pending: !!d?.pending, e, retry: () => { setD(null); setN(n + 1); } }; }

export function Ground({ f }: { f: Flight }) { const c = f.destination?.iata; const [open, setOpen] = useState(false); const { d, pending, e, retry } = usePoll(c ? `/ground/${c}` : null, open);
  if (!c) return null; const city = (f.destination?.city || "").toLowerCase();
  const rail = d?.stations?.find((s: any) => s.kind !== "Bus station" && s.km <= 1.5);
  const toCity = d?.routes?.find((r: any) => r.ends.some((x: string) => city && x.toLowerCase().includes(city)));
  const best = !d ? null : rail ? `Rail: ${rail.name} is ${rail.km} km from the airport point.` : toCity ? `${toCity.mode === "bus" ? "Bus" : toCity.mode} ${toCity.ref || ""} runs between ${toCity.ends.join(" and ")}.` : d.routes.length ? `No mapped route names ${f.destination?.city}; ${d.routes.length} other route${d.routes.length > 1 ? "s" : ""} call here (below).` : "No public transport mapped at this airport — plan a taxi or transfer.";
  return <details className="card m0 mt8 dg gr" onToggle={ev => setOpen((ev.target as HTMLDetailsElement).open)}><summary><b>Getting around · {c}</b><small> {open ? "tap to close" : "buses, trains and airport facilities"}</small></summary>
    {e ? <p className="sm bad">{e} <button className="sk-go ghost press" onClick={retry}>Retry</button></p> : !d ? <div className="dg-sk mt8" aria-busy="true"><div className="dg-sk-l" /><div className="dg-sk-l s" /><div className="muted xs">{pending ? "Querying OpenStreetMap — the public servers can take a minute or two; this fills in by itself." : "Loading…"}</div></div> : <>
      <section className="mt8"><h4>Best way into {f.destination?.city || "town"}</h4><p className="sm">{best}</p><small className="muted">Rule: a mapped rail/metro station within 1.5 km wins; else a bus route whose end names the city; else whatever calls here. Not a timetable.</small></section>
      {d.routes.length > 0 && <section className="mt8"><h4>Routes calling at the airport</h4><ul className="gr-r">{d.routes.map((r: any, i: number) => <li key={i}><b className="gr-ref">{r.ref || r.mode}</b><span className="sm">{r.ends.join(" ↔ ") || r.name}</span><small className="muted">{r.mode}{r.operator ? " · " + r.operator : ""}</small></li>)}</ul></section>}
      {d.stations.length > 0 && <section className="mt8"><h4>Stations within 3 km</h4>{d.stations.map((s: any) => <div key={s.name} className="row between sm"><span>{s.name}</span><span className="muted">{s.kind} · {s.km} km</span></div>)}</section>}
      <section className="mt8"><h4>In the airport</h4>{d.facilities.length ? <div className="gr-f">{d.facilities.map((x: any) => <div key={x.k}><b>{x.n}</b><small>{x.label}</small>{x.names.length > 0 && <small className="muted">{x.names.slice(0, 3).join(", ")}</small>}</div>)}</div> : <p className="sm muted">Nothing mapped inside the airport boundary yet.</p>}</section>
      <div className="faint xs mt8">{d.source}. {d.note}</div></>}
  </details>; }

export function Essentials({ f }: { f: Flight }) { const c = f.destination?.iata; const [open, setOpen] = useState(false); const [d, setD] = useState<any>(null); const [e, setE] = useState("");
  useEffect(() => { if (open && !d && c) api(`/essentials/${c}`).then(setD).catch(x => setE(x.message)); }, [open, c]);
  if (!c) return null;
  const types = d ? [...new Set(d.plugs.map(plugType).filter(Boolean))] as string[] : []; const needG = d && !types.includes("G"); const v = d?.voltage?.[0];
  return <details className="card m0 mt8 dg es" onToggle={ev => setOpen((ev.target as HTMLDetailsElement).open)}><summary><b>Essentials · {d?.country || c}</b><small> {open ? "tap to close" : "plugs, emergency number, driving side"}</small></summary>
    {e ? <p className="sm bad">{e}</p> : !d ? <p className="muted sm">Loading from Wikidata…</p> : <div className="bl-g">
      <section><h4>Plugs & power</h4><p className="sm">{d.plugs.length ? d.plugs.map((p: string) => { const t = plugType(p); return t ? `Type ${t} (${p})` : p; }).join(", ") : "Not recorded."}{v ? ` · ${d.voltage.join("/")} V` : ""}{d.hz?.length ? ` · ${d.hz.join("/")} Hz` : ""}</p>
        <p className="sm">{!d.plugs.length ? "" : needG ? <>🔌 Bring an adapter: UK Type G plugs won't fit{types.length ? ` (sockets are Type ${types.join("/")})` : ""}.</> : "UK Type G plugs fit — no adapter needed."}{v && (v < 200 || v > 250) ? ` ⚡ Mains is ${v} V: check chargers say 100–240 V; hair dryers and straighteners may not.` : ""} <span className="muted">Rule: compare the sockets with UK Type G and 230 V.</span></p></section>
      <section><h4>Emergency & phone</h4><p className="sm">Emergency: <b>{d.emergency.length ? d.emergency.join(", ") : "not recorded"}</b>{d.emergency.includes("112") ? " (112 works across the EU)" : ""}</p>{d.callingCode && <p className="sm">Country dialling code {d.callingCode} — UK numbers from there: +44, drop the leading 0.</p>}</section>
      {d.driveSide && <section><h4>Driving</h4><p className="sm">Traffic drives on the <b>{d.driveSide}</b>{d.driveSide === "right" ? " — opposite to the UK, so take care crossing roads and in a hire car." : " — same as the UK."}</p></section>}
      <div className="faint xs">{d.source}, cached 30 days.</div></div>}
  </details>; }
