// FIDS helpers: Katowice real-flight board (KTW has no public timetable feed, so its flights are collected from the
// official boards of the airports it links to), "save as image" for any screen, and an auto-cycling kiosk viewer.
import { useEffect, useState, type ReactNode } from "react";
import { api, estDurMin } from "./lib";
import { FullScreen } from "./gate";

const KTW_AP = { iata: "KTW", icao: "EPKT", name: "Katowice International Airport", city: "Katowice", country: "Poland", lat: 50.4743, lon: 19.08, tz: "Europe/Warsaw" };
/** Airports with an official feed in Skyline that Katowice flights go to / come from (checked against live boards). */
export const KTW_LINKS = ["STN", "LTN", "DTM", "WAW", "ACE", "AGP", "BCN", "LCA", "PFO", "ALC", "TFS", "FUE", "LPA", "PMI", "DUB", "MAN", "EDI", "LGW", "BFS", "OSL", "BGO", "TRF", "SVG", "ARN", "GOT", "FRA", "MUC", "DUS", "SKG", "RHO", "CHQ", "CFU", "ZTH", "KGS", "LBA", "EMA"];
export const KTW_SOURCE = "Real flights from the official boards of the airports Katowice links to · KTW times estimated from flight length (KTW has no public feed)";
const round5 = (ms: number) => Math.round(ms / 3e5) * 3e5;
const iso = (ms: number) => new Date(ms).toISOString();
async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < xs.length) { const k = i++; out[k] = await fn(xs[k]); } })); return out;
}
const mem: Record<string, { at: number; v: any[] }> = {};
/** Real Katowice departures/arrivals for a date as TerminalBoard flight objects (times at KTW estimated). Cached 15 min. */
export async function ktwFlights(dir: string, date: string): Promise<any[]> {
  const k = dir + date; const c = mem[k] || (() => { try { return JSON.parse(sessionStorage.getItem("sk.ktw." + k) || "null"); } catch { return null; } })();
  if (c && Date.now() - c.at < 15 * 60e3) return c.v;
  const lists = await pool(KTW_LINKS, 6, x => Promise.race([api(`/route?from=${dir === "dep" ? "KTW" : x}&to=${dir === "dep" ? x : "KTW"}&date=${date}`).then(r => r?.flights || []).catch(() => []), new Promise<any[]>(r => setTimeout(() => r([]), 14000))]));
  const seen = new Set<string>(); const out: any[] = [];
  for (const f of lists.flat()) {
    const num = String(f.number || "").replace(/\s+/g, ""); if (!num || seen.has(num)) continue; seen.add(num);
    const other = dir === "dep" ? f.destination : f.origin; const dur = estDurMin(KTW_AP as any, other) * 60e3; if (!dur) continue;
    const st = String(f.statusText || "").toLowerCase();
    if (dir === "dep") { const a = f.arr || {}; const sch = Date.parse(a.scheduled || ""); if (!sch) continue;
      const dep = round5(sch - dur); const lateMin = a.estimated ? (Date.parse(a.estimated) - sch) / 6e4 : 0; const arrived = !!a.actual || /arrived|landed|on blocks|baggage/.test(st);
      out.push({ id: "ktw-" + num, number: num, airline: f.airline, aircraft: f.aircraft, origin: KTW_AP, destination: other, localName: (other?.city || "").toUpperCase(),
        dep: { scheduled: iso(dep), estimated: lateMin >= 15 ? iso(round5(dep + lateMin * 6e4)) : iso(dep), ...(arrived ? { actual: iso(round5((Date.parse(a.actual || a.estimated || a.scheduled)) - dur)) } : {}) },
        arr: a, status: /cancel/.test(st) ? "cancelled" : arrived ? "departed" : lateMin >= 15 ? "delayed" : "scheduled", statusText: /cancel/.test(st) ? "Cancelled" : arrived ? "Departed" : "", ktwEst: true });
    } else { const d = f.dep || {}; const sch = Date.parse(d.scheduled || ""); if (!sch) continue;
      const arr = round5(sch + dur); const real = Date.parse(d.actual || d.offBlock || d.estimated || "") || 0; const est = real ? round5(real + dur) : arr; const landed = !!real && Date.now() > est;
      out.push({ id: "ktw-" + num, number: num, airline: f.airline, aircraft: f.aircraft, origin: other, destination: KTW_AP, localName: (other?.city || "").toUpperCase(), dep: d,
        arr: { scheduled: iso(arr), estimated: iso(est), ...(landed ? { actual: iso(est) } : {}) }, status: /cancel/.test(st) ? "cancelled" : landed ? "landed" : "scheduled", statusText: /cancel/.test(st) ? "Cancelled" : "", ktwEst: true });
    }
  }
  out.sort((a, b) => ((dir === "dep" ? a.dep : a.arr).scheduled < (dir === "dep" ? b.dep : b.arr).scheduled ? -1 : 1));
  if (out.length) { mem[k] = { at: Date.now(), v: out }; try { sessionStorage.setItem("sk.ktw." + k, JSON.stringify(mem[k])); } catch { /* full */ } }
  return out;
}
/** KTW board responses are ADS-B only: swap in the collected real flights when there are any (keeps the live list otherwise). */
export async function withKtw(iata: string, dir: string, date: string, r: any) {
  if (iata !== "KTW" || !r || (r.flights || []).some((f: any) => !f.liveOnly)) return r;
  const fl = await ktwFlights(dir, date).catch(() => []);
  return fl.length ? { ...r, flights: fl, liveOnly: false, source: KTW_SOURCE, sourceKind: "derived", provider: "Destination airports' official boards" } : r;
}

/** Save a screen as a PNG (share sheet on iPhone, download elsewhere). html-to-image loads only when tapped. */
export async function saveImage(el: HTMLElement | null, name: string, bg = "#05070c") {
  if (!el) return "Nothing to save";
  try {
    const { toBlob } = await import("html-to-image");
    const w = el.offsetWidth || 600, h = el.offsetHeight || 400; const pr = Math.max(1, Math.min(3, 2000 / Math.max(w, h))); // ≤ ~2000 px long side keeps iPhone memory low
    const blob = await toBlob(el, { pixelRatio: pr, backgroundColor: bg, cacheBust: false, skipFonts: true, width: w, height: h, style: { transform: "none", margin: "0" } }); // the Fit wrapper scales the screen; capture it at design size
    if (!blob) return "Couldn't make the image";
    const file = new File([blob], name.replace(/[^\w-]+/g, "-").toLowerCase() + ".png", { type: "image/png" });
    if ((navigator as any).canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return "Shared"; } catch (e: any) { if (e?.name === "AbortError") return ""; } }
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    return "Image saved";
  } catch { return "Couldn't make the image"; }
}

/** Fullscreen kiosk: shows one screen at a time and moves on every `sec` seconds (tap a dot to jump, ✕ or Esc to leave). */
export function Kiosk({ items, sec = 8, onClose, bg }: { items: { key: string; label: string; node: ReactNode }[]; sec?: number; onClose: () => void; bg?: string }) {
  const [i, setI] = useState(0); const n = items.length;
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setI(v => (v + 1) % n), sec * 1000); return () => clearInterval(t); }, [n, sec]);
  const it = items[Math.min(i, n - 1)];
  return <FullScreen onClose={onClose} bg={bg}>{it && <div className="kq"><div key={it.key} className="kq-scr">{it.node}</div>
    <div className="kq-bar" onClick={e => e.stopPropagation()}><span>{it.label}</span><span className="kq-dots">{items.length <= 24 && items.map((x, k) => <button key={x.key} className={k === i ? "on" : ""} aria-label={"Show " + x.label} onClick={() => setI(k)} />)}</span><span>{i + 1}/{n} · every {sec}s</span></div></div>}</FullScreen>;
}
