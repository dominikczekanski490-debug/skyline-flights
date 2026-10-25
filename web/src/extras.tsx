import { useEffect, useMemo, useState } from "react";
import { api, best, delay, dist, dur, estDurMin, fmtT, fmtD, lateLabel, lateColor, logo, today, type Flight } from "./lib";

// ---------- Web Push ----------
const b64 = (s: string) => { const p = "=".repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const watchList = (fl: Flight[]) => fl.filter(f => !f.example && !f.manual && f.date >= new Date(Date.now() - 86400e3).toISOString().slice(0, 10)).map(f => ({ number: f.number, date: f.date }));
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export async function syncPush(fl: Flight[], ask = false): Promise<string> {
  if (!pushSupported()) return (navigator as any).standalone === false || !matchMedia("(display-mode: standalone)").matches ? "On iPhone: Share → Add to Home Screen, then open Skyline from the Home Screen icon to enable alerts." : "This browser doesn't support push.";
  if (Notification.permission !== "granted") { if (!ask) return "off"; if ((await Notification.requestPermission()) !== "granted") return "Notifications were not allowed. Turn them on in iOS Settings → Notifications → Skyline."; }
  const reg = await navigator.serviceWorker.ready; const { publicKey } = await api("/push/key");
  let sub = await reg.pushManager.getSubscription();
  if (sub && localStorage.getItem("sk.vapid") !== publicKey) { await sub.unsubscribe().catch(() => {}); sub = null; } // server key changed → resubscribe silently
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
  localStorage.setItem("sk.vapid", publicKey); localStorage.setItem("sk.pushEndpoint", sub.endpoint);
  const r = await api("/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), flights: watchList(fl) }) });
  return `on · watching ${r.watching} flight${r.watching === 1 ? "" : "s"}`;
}
export const testPush = () => api("/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: localStorage.getItem("sk.pushEndpoint") }) });

// ---------- Cold-start warming pill ----------
export function WarmBanner() {
  const [st, setSt] = useState<"ok" | "warm" | "down">("ok");
  useEffect(() => { let done = false; const t = setTimeout(() => !done && setSt("warm"), 1200);
    const go = (n = 0): any => fetch("/api/health", { cache: "no-store" }).then(r => { if (!r.ok) throw 0; done = true; setSt("ok"); }).catch(() => n < 20 ? setTimeout(() => go(n + 1), 4000) : setSt("down"));
    go(); return () => clearTimeout(t); }, []);
  if (st === "ok") return null;
  return <div className="warm"><span className="spin" /><div><b>{st === "warm" ? "Waking up Skyline…" : "Can't reach Skyline right now"}</b><small>{st === "warm" ? "The free server naps when idle. Live data in a few seconds. Your flights are saved on this phone." : "Showing your saved flights. Pull to retry later."}</small></div></div>;
}

// ---------- Backup (flights live in this phone's storage; this makes them portable) ----------
export function exportBackup() { const o: Record<string, string> = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith("sk") ) o[k] = localStorage.getItem(k)!; }
  const blob = new Blob([JSON.stringify({ app: "skyline", at: new Date().toISOString(), data: o })], { type: "application/json" }); const file = new File([blob], `skyline-backup-${today()}.json`, { type: "application/json" });
  if ((navigator as any).canShare?.({ files: [file] })) return navigator.share({ files: [file], title: "Skyline backup" }).catch(() => {});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); }
export async function importBackup(file: File) { const j = JSON.parse(await file.text()); if (j.app !== "skyline") throw new Error("Not a Skyline backup"); for (const [k, v] of Object.entries(j.data)) localStorage.setItem(k, v as string); location.reload(); }

// ---------- Share links (stateless id → survives server restarts) ----------
const enc = (o: any) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dec = (s: string) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
export const shareLink = (f: Flight, from = localStorage.getItem("sk.name") || "") => location.origin + "/s/" + enc({ n: f.number, d: f.date, o: f.origin?.iata, t: f.destination?.iata, by: from || undefined });
export const parseShare = (url: string) => { const m = url.match(/\/s\/([A-Za-z0-9_-]+)/); return m ? dec(m[1]) : null; };

export function SharedView({ id }: { id: string }) {
  const s = useMemo(() => { try { return dec(id); } catch { return null; } }, [id]);
  const [r, setR] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { if (!s) return; const go = () => api(`/flight/${s.n}?date=${s.d}`).then(setR).catch(e => setErr(e.message)); go(); const t = setInterval(go, 60e3); return () => clearInterval(t); }, [id]);
  if (!s) return <div className="share"><div className="shcard"><b>Link not recognised</b></div></div>;
  const f: Flight | undefined = r?.flight; const dd = f ? delay(f.dep) : null, da = f ? delay(f.arr) : null; const lv = r?.live;
  const add = () => { const name = prompt("Whose flight is this?", s.by || "Friend") || "Friend"; const K = "skyline.flights.v1"; const L = JSON.parse(localStorage.getItem(K) || "[]");
    const nf = f ? { ...f, id: f.id || s.n + s.d, friend: name } : { id: s.n + s.d, number: s.n, date: s.d, dep: {}, arr: {}, friend: name, scheduleUnknown: true };
    if (!L.some((x: any) => x.number === nf.number && x.date === nf.date && x.friend)) L.push(nf); localStorage.setItem(K, JSON.stringify(L)); location.href = "/?tab=friends"; };
  return <div className="share"><div className="shbrand"><img src="/icon-192.png" /><b>Skyline</b><span>Live flight{s.by ? ` shared by ${s.by}` : ""}</span></div>
    <div className="shcard">
      <div className="row between"><div className="row g10"><img className="alogo" src={logo(f?.airline?.iata || s.n.slice(0, 2))} style={{ width: 34, height: 34 }} onError={e => (e.currentTarget.style.visibility = "hidden")} /><div><b className="shnum">{s.n}</b><div className="muted sm">{f?.airline?.name || ""} · {fmtD(s.d, { weekday: "short", day: "numeric", month: "short" })}</div></div></div>
        <span className="shstat" style={{ background: f?.status === "cancelled" ? "var(--red)" : lv ? "var(--blue)" : lateColor(da ?? dd) }}>{f ? f.status === "cancelled" ? "Cancelled" : lv && f.status !== "landed" ? "In the air" : f.statusText || lateLabel(da ?? dd) || "Scheduled" : err ? "Unavailable" : "Loading…"}</span></div>
      <div className="shroute"><div><b>{f?.origin?.iata || s.o}</b><small>{f?.origin?.city}</small><span>{fmtT(best(f?.dep || {}), f?.origin?.tz)}</span>{dd != null && Math.abs(dd) >= 5 && <em style={{ color: lateColor(dd) }}>{lateLabel(dd)}</em>}</div>
        <div className="shline"><i style={{ left: `${f?.status === "landed" ? 100 : lv ? 50 : 0}%` }}>✈</i></div>
        <div className="r"><b>{f?.destination?.iata || s.t}</b><small>{f?.destination?.city}</small><span>{fmtT(best(f?.arr || {}), f?.destination?.tz)}</span>{da != null && Math.abs(da) >= 5 && <em style={{ color: lateColor(da) }}>{lateLabel(da)}</em>}</div></div>
      <div className="grid3 mt8 shmeta"><div><label>Gate</label><b>{f?.dep.gate || "—"}</b></div><div><label>Terminal</label><b>{f?.dep.terminal || "—"}</b></div><div><label>Belt</label><b>{f?.arr.baggage || "—"}</b></div></div>
      {lv && <div className="muted sm mt8">Live: {Math.round(lv.alt || 0).toLocaleString()} ft · {Math.round(lv.gs || 0)} kt · {lv.reg || ""}</div>}
      {err && <div className="muted sm mt8">{err}</div>}
      <div className="faint sm mt8">Read-only · refreshes every minute · {f?.source || ""}</div></div>
    <button className="primary wide mt16" onClick={add}>＋ Follow in my Friends feed</button><a className="shopen" href="/">Open Skyline</a></div>;
}

// ---------- Leave for the airport ----------
export function LeaveCard({ f }: { f: Flight }) {
  const [p, setP] = useState<any>(null); const [travel, setTravel] = useState(+(localStorage.getItem("sk.travel") || 45));
  useEffect(() => { if (!f.example && f.dep.scheduled) api(`/predict/${f.number}?date=${f.date}`).then(setP).catch(() => {}); }, [f.id]);
  useEffect(() => localStorage.setItem("sk.travel", String(travel)), [travel]);
  if (!f.dep.scheduled || f.status === "departed" || f.status === "landed" || +new Date(f.dep.scheduled) < Date.now() - 3600e3) return null;
  const official = Math.max(0, delay(f.dep) ?? 0); const pred = p && !p.cancelled && p.confidence !== "low" ? Math.max(0, p.range?.[0] ?? 0) : 0; // only the cautious low end
  const shift = Math.max(official, Math.min(pred, 60)); const long = dist(f.origin, f.destination) > 2500 || estDurMin(f.origin, f.destination) > 300; const buf = long ? 180 : 120;
  const dep = +new Date(f.dep.scheduled) + shift * 60e3, arrive = dep - buf * 60e3, leave = arrive - travel * 60e3; const tz = f.origin?.tz;
  return <div className="card leave"><div className="row between"><div><div className="lvk">LEAVE FOR {f.origin?.iata}</div><b className="lvt">{fmtT(new Date(leave).toISOString(), tz)}</b></div><span className="lvbadge">Estimate</span></div>
    <div className="lvsteps"><div><small>Leave</small><b>{fmtT(new Date(leave).toISOString(), tz)}</b></div><i /><div><small>At airport</small><b>{fmtT(new Date(arrive).toISOString(), tz)}</b></div><i /><div><small>Departs{shift ? " (exp.)" : ""}</small><b>{fmtT(new Date(dep).toISOString(), tz)}</b></div></div>
    <div className="muted sm">{shift ? `Shifted ${shift} min for ${official >= shift ? "the delay the airport is publishing" : "the cautious end of Skyline's delay prediction"}` : "No delay expected, so this uses the scheduled time"} · {buf / 60}h airport buffer ({long ? "long-haul" : "short-haul"}) · travel time:
      <select className="lvsel" value={travel} onChange={e => setTravel(+e.target.value)}>{[15, 30, 45, 60, 75, 90, 120, 150].map(m => <option key={m} value={m}>{dur(m)}</option>)}</select></div>
    <div className="faint sm mt8">Gates usually close 30 min before departure even when a flight is late. Always follow your airline's times.</div></div>;
}

// ---------- Passport extras ----------
export function stats(L: Flight[]) {
  const by = (k: (f: Flight) => string | undefined) => { const m: Record<string, number> = {}; L.forEach(f => { const v = k(f); if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const years: Record<string, { n: number; mi: number }> = {}; L.forEach(f => { const y = f.date.slice(0, 4); (years[y] ||= { n: 0, mi: 0 }); years[y].n++; years[y].mi += dist(f.origin, f.destination); });
  const longest = [...L].sort((a, b) => dist(b.origin, b.destination) - dist(a.origin, a.destination))[0];
  const ap: Record<string, number> = {}; L.forEach(f => [f.origin?.iata, f.destination?.iata].forEach(c => c && (ap[c] = (ap[c] || 0) + 1)));
  return { years: Object.entries(years).sort((a, b) => b[0].localeCompare(a[0])), longest, airlines: by(f => f.airline?.name), aircraft: by(f => f.aircraft?.model), airports: Object.entries(ap).sort((a, b) => b[1] - a[1]), mi: L.reduce((s, f) => s + dist(f.origin, f.destination), 0) };
}
const Bars = ({ rows, color }: { rows: [string, number][]; color: string }) => { const m = rows[0]?.[1] || 1; return <>{rows.slice(0, 5).map(([k, v]) => <div key={k} className="sbar"><span>{k}</span><div><i style={{ width: `${v / m * 100}%`, background: color }} /></div><b>{v}</b></div>)}{!rows.length && <div className="faint sm">No data yet</div>}</>; };
export function PassportExtras({ L, yr }: { L: Flight[]; yr: string }) {
  const s = useMemo(() => stats(L), [L]); const [busy, setBusy] = useState(false);
  return <>
    <div className="card m18"><div className="row between"><h3>Year in Review</h3><button className="chip blue" disabled={busy || !L.length} onClick={async () => { setBusy(true); try { await shareReview(L, yr); } finally { setBusy(false); } }}>{busy ? "Making…" : "Share card"}</button></div>
      <div className="muted sm">A shareable image of your {yr === "All" ? "all-time" : yr} flying, made from your own flights.</div></div>
    {s.longest && <div className="card m18"><div className="lvk">LONGEST FLIGHT</div><div className="row between mt8"><b className="lvt">{s.longest.origin?.iata} → {s.longest.destination?.iata}</b><b>{dist(s.longest.origin, s.longest.destination).toLocaleString()} mi</b></div><div className="muted sm">{s.longest.number} · {fmtD(s.longest.date)} · {s.longest.origin?.city} to {s.longest.destination?.city}</div></div>}
    {yr === "All" && s.years.length > 0 && <div className="card m18"><h3>By year</h3>{s.years.map(([y, v]) => <div key={y} className="row between ytot"><b>{y}</b><span className="muted">{v.n} flight{v.n === 1 ? "" : "s"} · {v.mi.toLocaleString()} mi</span></div>)}</div>}
    <div className="card m18"><h3>Most visited airports</h3><Bars rows={s.airports} color="linear-gradient(90deg,#2f7cf6,#7aa8ff)" /></div>
    <div className="card m18"><h3>Airlines flown</h3><Bars rows={s.airlines} color="linear-gradient(90deg,#8b5cf6,#c4a7ff)" /></div>
    <div className="card m18"><h3>Aircraft flown</h3><Bars rows={s.aircraft} color="linear-gradient(90deg,#10b981,#7ee2b8)" /></div></>;
}
export async function reviewPng(L: Flight[], yr: string): Promise<Blob> {
  const s = stats(L), W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0b1d3a"); g.addColorStop(.55, "#1d3f8f"); g.addColorStop(1, "#6d3bd7"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * .8, 260, 10, W * .8, 260, 600); glow.addColorStop(0, "rgba(122,168,255,.45)"); glow.addColorStop(1, "rgba(122,168,255,0)"); x.fillStyle = glow; x.fillRect(0, 0, W, H);
  // great-circle-ish arcs of every route
  x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 3; L.forEach(f => { if (!f.origin?.lon || !f.destination?.lon) return; const px = (lon: number) => (lon + 180) / 360 * W, py = (lat: number) => 520 - lat * 3.2;
    const a = [px(f.origin.lon), py(f.origin.lat!)], b = [px(f.destination.lon), py(f.destination.lat!)]; x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 80, b[0], b[1]); x.stroke(); });
  const F = "Inter, -apple-system, system-ui, sans-serif"; x.fillStyle = "#fff"; x.font = `600 40px ${F}`; x.fillText("SKYLINE", 80, 130); x.globalAlpha = .7; x.font = `500 34px ${F}`; x.fillText(yr === "All" ? "All-time in review" : `${yr} in review`, 80, 180); x.globalAlpha = 1;
  const big = (v: string, l: string, y: number) => { x.font = `700 150px ${F}`; x.fillText(v, 80, y); x.globalAlpha = .75; x.font = `500 38px ${F}`; x.fillText(l, 86, y + 56); x.globalAlpha = 1; };
  big(String(L.length), L.length === 1 ? "flight" : "flights", 820); big(s.mi.toLocaleString(), `miles · ${(s.mi / 24901).toFixed(1)}× around the world`, 1080);
  const row = (k: string, v: string, y: number) => { x.globalAlpha = .65; x.font = `600 28px ${F}`; x.fillText(k.toUpperCase(), 80, y); x.globalAlpha = 1; x.font = `600 46px ${F}`; x.fillText(v.length > 34 ? v.slice(0, 33) + "…" : v, 80, y + 58); };
  row("Longest flight", s.longest ? `${s.longest.origin?.iata} → ${s.longest.destination?.iata} · ${dist(s.longest.origin, s.longest.destination).toLocaleString()} mi` : "—", 1260);
  row("Top airport", s.airports[0] ? `${s.airports[0][0]} · ${s.airports[0][1]} visit${s.airports[0][1] === 1 ? "" : "s"}` : "—", 1400);
  row("Top airline", s.airlines[0]?.[0] || "—", 1540); row("Top aircraft", s.aircraft[0]?.[0] || "—", 1680);
  x.globalAlpha = .55; x.font = `500 28px ${F}`; x.fillText(`${s.airports.length} airports · ${s.airlines.length} airlines · made with Skyline`, 80, 1840);
  return new Promise(r => c.toBlob(b => r(b!), "image/png"));
}
async function shareReview(L: Flight[], yr: string) { const b = await reviewPng(L, yr); const file = new File([b], `skyline-${yr}.png`, { type: "image/png" });
  if ((navigator as any).canShare?.({ files: [file] })) return navigator.share({ files: [file], title: "My Skyline year" }).catch(() => {});
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = file.name; a.click(); }
