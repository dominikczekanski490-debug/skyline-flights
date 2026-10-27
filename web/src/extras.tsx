import { useEffect, useMemo, useState } from "react";
import { AirlineTile } from "./brand";
import { getPrefs } from "./more";
import { api, best, delay, dist, dur, estDurMin, fmtT, fmtD, lateLabel, lateColor, today, type Flight } from "./lib";

// ---------- Web Push ----------
const b64 = (s: string) => { const p = "=".repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const watchList = (fl: Flight[]) => fl.filter(f => !f.example && !f.manual && f.date >= new Date(Date.now() - 86400e3).toISOString().slice(0, 10)).map(f => ({ number: f.number, date: f.date }));
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => (navigator as any).standalone === true || matchMedia("(display-mode: standalone)").matches;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export type PushState = { state: "unsupported" | "not-installed" | "denied" | "off" | "subscribed" | "error"; msg: string };
export function pushState(): PushState {
  if (isIOS() && !isStandalone()) return { state: "not-installed", msg: "On iPhone, alerts only work in the Home Screen app: Safari → Share → Add to Home Screen, then open Skyline from that icon (iOS 16.4+)." };
  if (!pushSupported()) return { state: "unsupported", msg: isIOS() ? "This iOS version doesn't support web push. Update to iOS 16.4 or later." : "This browser doesn't support push notifications." };
  if (Notification.permission === "denied") return { state: "denied", msg: "Notifications are blocked. Turn them on in iOS Settings → Notifications → Skyline, then tap Turn on alerts." };
  if (Notification.permission === "granted" && localStorage.getItem("sk.pushEndpoint")) return { state: "subscribed", msg: "On" };
  return { state: "off", msg: "Off" };
}
// Step log: every stage of turning alerts on is recorded so the Settings screen can show exactly where it failed.
export type Step = { k: string; ok: boolean | null; v: string };
let STEPS: Step[] = []; const stepL = new Set<() => void>(); export const onSteps = (f: () => void) => { stepL.add(f); return () => { stepL.delete(f); }; };
export const getSteps = () => STEPS; const step = (k: string, ok: boolean | null, v: string) => { STEPS = [...STEPS.filter(s => s.k !== k), { k, ok, v }]; localStorage.setItem("sk.pushSteps", JSON.stringify({ at: Date.now(), steps: STEPS })); stepL.forEach(f => f()); };
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(what + " timed out after " + ms / 1000 + " s")), ms))]);
async function swReg() { // never wait forever on serviceWorker.ready: register if missing, and accept an installing/waiting worker
  let reg = await navigator.serviceWorker.getRegistration("/"); if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
  if (reg.active) return reg; return withTimeout(navigator.serviceWorker.ready, 10000, "Service worker activation"); }
// ask=true must be called directly from a tap. iOS only shows the prompt if requestPermission() is the FIRST await after the tap,
// so everything before it is synchronous.
export async function syncPush(fl: Flight[], ask = false): Promise<string> {
  if (ask) STEPS = [];
  const ios = isIOS(), sa = isStandalone();
  step("Installed to Home Screen", ios ? sa : true, ios ? (sa ? "Yes (navigator.standalone)" : "No: open Skyline from the Home Screen icon") : "Not needed on this device");
  step("Push supported", pushSupported(), pushSupported() ? "PushManager available" : "No PushManager (iOS 16.4+ Home Screen app required)");
  const st = pushState(); if (st.state === "not-installed" || st.state === "unsupported" || st.state === "denied") { step("Permission", st.state === "denied" ? false : null, typeof Notification !== "undefined" ? Notification.permission : "n/a"); if (ask) throw new Error(st.msg); return st.state; }
  if (Notification.permission !== "granted") { if (!ask) { step("Permission", null, Notification.permission); return "off"; }
    const p = await Notification.requestPermission(); step("Permission", p === "granted", p);
    if (p !== "granted") throw new Error(p === "denied" ? pushState().msg : "Permission wasn't granted. Tap Turn on alerts and choose Allow."); }
  else step("Permission", true, "granted");
  let reg: ServiceWorkerRegistration; try { reg = await swReg(); step("Service worker", true, `active (${reg.active?.state || "ready"})`); } catch (e: any) { step("Service worker", false, e.message); throw new Error("Service worker problem: " + e.message); }
  let publicKey: string; try { publicKey = (await withTimeout(api("/push/key"), 45000, "Server")).publicKey; step("Server key", true, publicKey.slice(0, 12) + "…"); } catch (e: any) { step("Server key", false, e.message); throw new Error("Couldn't reach the server: " + e.message); }
  let sub = await reg.pushManager.getSubscription();
  const curKey = sub?.options?.applicationServerKey ? btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : localStorage.getItem("sk.vapid");
  if (sub && curKey && curKey !== publicKey) { await sub.unsubscribe().catch(() => {}); sub = null; } // server key changed → resubscribe
  try { if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }); step("Subscribed on device", true, new URL(sub.endpoint).host); }
  catch (e: any) { const t = (e?.name ? e.name + ": " : "") + (e?.message || e); step("Subscribed on device", false, t); throw new Error("Subscribing failed: " + t); }
  localStorage.setItem("sk.vapid", publicKey); localStorage.setItem("sk.pushEndpoint", sub.endpoint);
  try { const r = await api("/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), flights: watchList(fl), prefs: getPrefs() }) });
    step("Server has subscription", true, `yes, watching ${r.watching} flight${r.watching === 1 ? "" : "s"}`); localStorage.setItem("sk.pushSynced", String(Date.now()));
    return `on, watching ${r.watching} flight${r.watching === 1 ? "" : "s"}`; }
  catch (e: any) { step("Server has subscription", false, "POST failed: " + e.message); throw new Error("Server didn't save the subscription: " + e.message); }
}
const myFlights = () => { try { return JSON.parse(localStorage.getItem("skyline.flights.v1") || "[]").filter((f: any) => !f.friend); } catch { return []; } };
// Re-POST before testing so a server restart can't make the test fail with "not subscribed".
export async function testPush(): Promise<string> {
  const st = pushState(); if (st.state !== "subscribed") throw new Error(st.state === "off" ? "Alerts are off — tap Turn on alerts first." : st.msg);
  await syncPush(myFlights());
  const r = await api("/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: localStorage.getItem("sk.pushEndpoint") }) }).catch((e: any) => { step("Test sent", false, e.message); throw e; });
  step("Test sent", true, `accepted by ${r.host} (${r.status})`);
  return `Test sent (accepted by ${r.host}, ${r.status}). It should arrive within a few seconds.`;
}
export const pushStatus = () => api("/push/status?endpoint=" + encodeURIComponent(localStorage.getItem("sk.pushEndpoint") || ""));

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
export const shareLink = (f: Flight, from = localStorage.getItem("sk.name") || "") => location.origin + "/s/" + enc({ n: f.number, d: f.date, o: f.origin?.iata, t: f.destination?.iata, by: from || undefined, x: Math.round(((best(f.arr) ? +new Date(best(f.arr)!) : +new Date(f.date + "T23:59:00Z")) + 6 * 3600e3) / 1000) });
export const parseShare = (url: string) => { const m = url.match(/\/s\/([A-Za-z0-9_-]+)/); return m ? dec(m[1]) : null; };

export function SharedView({ id }: { id: string }) {
  const s = useMemo(() => { try { return dec(id); } catch { return null; } }, [id]);
  const [r, setR] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { if (!s) return; const go = () => api(`/flight/${s.n}?date=${s.d}`).then(setR).catch(e => setErr(e.message)); go(); const t = setInterval(go, 60e3); return () => clearInterval(t); }, [id]);
  if (!s) return <div className="share"><div className="shcard"><b>Link not recognised</b></div></div>;
  if (s.x && Date.now() / 1000 > s.x) return <div className="share"><div className="shcard"><b>This share link has expired</b><div className="muted sm">Live links stop 6 hours after the flight lands. Ask {s.by || "the sender"} for a new one.</div></div></div>;
  const f: Flight | undefined = r?.flight; const dd = f ? delay(f.dep) : null, da = f ? delay(f.arr) : null; const lv = r?.live;
  const add = () => { const name = prompt("Whose flight is this?", s.by || "Friend") || "Friend"; const K = "skyline.flights.v1"; const L = JSON.parse(localStorage.getItem(K) || "[]");
    const nf = f ? { ...f, id: f.id || s.n + s.d, friend: name } : { id: s.n + s.d, number: s.n, date: s.d, dep: {}, arr: {}, friend: name, scheduleUnknown: true };
    if (!L.some((x: any) => x.number === nf.number && x.date === nf.date && x.friend)) L.push(nf); localStorage.setItem(K, JSON.stringify(L)); location.href = "/?tab=friends"; };
  return <div className="share"><div className="shbrand"><img src="/icon-192.png" /><b>Skyline</b><span>Live flight{s.by ? ` shared by ${s.by}` : ""}{s.x ? ` · link expires ${new Date(s.x * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</span></div>
    <div className="shcard">
      <div className="row between"><div className="row g10"><AirlineTile a={f?.airline || { iata: s.n.slice(0, 2) }} mode="colour" style={{ width: 82, height: 34 }} /><div><b className="shnum">{s.n}</b><div className="muted sm">{f?.airline?.name || ""} · {fmtD(s.d, { weekday: "short", day: "numeric", month: "short" })}</div></div></div>
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

// ---------- Rich visuals for "Why" reason cards (real data only) ----------
export function FactorViz({ x, color }: { x: any; color: string }) {
  const d = x.data; if (!d) return null;
  if (x.kind === "airport" && d.counts) { const c = d.counts;
    const seg = [["On time", c.onTime, "#30d158"], ["15m+ late", c.late, "#ff9f0a"], ["Cancelled", c.cancelled, "#ff453a"], ["No time yet", c.unknown, "#8e8e9366"]].filter(s => (s[1] as number) > 0) as [string, number, string][];
    const tr = (d.trend || []) as (number | null)[]; const pts = tr.map((v, i) => v == null ? null : [i, v] as [number, number]).filter(Boolean) as [number, number][]; const mx = Math.max(15, ...pts.map(p => p[1]));
    const path = pts.map((p, i) => `${i ? "L" : "M"}${8 + p[0] * 61},${46 - p[1] / mx * 38}`).join(" ");
    return <div className="fviz">
      <div className="fvk">{d.airport} DEPARTURES · LAST 4 HOURS</div>
      <div className="segbar">{seg.map(([l, v, col]) => <i key={l} style={{ flex: v, background: col }} />)}</div>
      <div className="seglg">{seg.map(([l, v, col]) => <span key={l}><b style={{ background: col }} />{l} <em>{v}</em></span>)}</div>
      <div className="fchips"><span><small>Avg delay</small><b style={{ color }}>{d.avgDelay}m</b></span><span><small>On time</small><b>{d.onTime ?? "—"}%</b></span><span><small>Cancelled</small><b>{d.cancelled || 0}%</b></span><span><small>Flights</small><b>{d.n}</b></span></div>
      {pts.length >= 2 && <div className="spark"><svg viewBox="0 0 200 54" preserveAspectRatio="none"><defs><linearGradient id="spg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={`${path} L${8 + pts.at(-1)![0] * 61},50 L${8 + pts[0][0] * 61},50 Z`} fill="url(#spg)" /><path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{pts.map(p => <circle key={p[0]} cx={8 + p[0] * 61} cy={46 - p[1] / mx * 38} r="3.5" fill={color} />)}</svg>
        <div className="sparkl">{["-4h", "-3h", "-2h", "last h"].map((l, i) => <span key={l}>{l}{tr[i] != null ? ` · ${tr[i]}m` : ""}</span>)}</div><div className="fvk">Average departure delay by hour{pts.length >= 2 ? (pts.at(-1)![1] > pts[0][1] + 5 ? " · getting worse" : pts.at(-1)![1] < pts[0][1] - 5 ? " · improving" : " · steady") : ""}</div></div>}
    </div>; }
  if (x.kind === "weather" && d.gust != null) { const g = Math.min(d.gust, 100), a = Math.PI * (1 - g / 100), cx = 60, cy = 56, r = 44;
    return <div className="fviz row g16"><svg width="120" height="66" viewBox="0 0 120 66"><path d="M16,56 A44,44 0 0 1 104,56" fill="none" stroke="var(--chip)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M16,56 A44,44 0 0 1 ${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
      {[45, 65].map(t => { const b = Math.PI * (1 - t / 100); return <line key={t} x1={cx + 36 * Math.cos(b)} y1={cy - 36 * Math.sin(b)} x2={cx + 52 * Math.cos(b)} y2={cy - 52 * Math.sin(b)} stroke="var(--muted)" strokeWidth="1.5" />; })}
      <text x="60" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text)">{d.gust}</text><text x="60" y="64" textAnchor="middle" fontSize="8.5" fill="var(--muted)">km/h gusts</text></svg>
      <div className="fchips col"><span><small>Mean wind</small><b>{d.wind ?? "—"} km/h</b></span><span><small>Gusts</small><b style={{ color }}>{d.gust} km/h</b></span><span><small>Thresholds</small><b>45 gusty · 65 strong</b></span></div></div>; }
  if (x.kind === "inbound" && d.number) return <div className="fviz"><div className="chainv"><div><b>{d.number}</b><small>inbound · ETA {fmtT(d.eta)}</small></div><i style={{ background: color }} /><div><b>40m</b><small>min turnaround</small></div><i /><div><b>This flight</b><small>sched {fmtT(d.dep)}</small></div></div><div className="fvk mt6">Aircraft arrives {Math.abs(d.slack)} min too late for a normal turnaround</div></div>;
  return null;
}

// ---------- Build stamp + stale-app detection ----------
declare const __BUILD__: string;
export const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "dev";
export async function checkUpdate(): Promise<string | null> { try { const r = await fetch("/version.json", { cache: "no-store" }); const j = await r.json(); return j.build && j.build !== BUILD ? j.build : null; } catch { return null; } }
export async function applyUpdate() { const reg = await navigator.serviceWorker?.getRegistration("/"); await reg?.update().catch(() => {}); const ks = await caches?.keys?.().catch(() => []) || []; await Promise.all(ks.map(k => caches.delete(k))); location.reload(); }
export function UpdateBanner() { const [nb, setNb] = useState<string | null>(null);
  useEffect(() => { const go = () => checkUpdate().then(setNb); go(); const f = () => document.visibilityState === "visible" && go(); document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
  if (!nb) return null; return <div className="warm press" onClick={applyUpdate}><div><b>New version of Skyline available</b><small>Tap to update (you have {BUILD}, latest is {nb})</small></div></div>; }
// ---------- Notification checklist ----------
export function PushChecklist({ refresh }: { refresh?: number }) {
  const [, re] = useState(0); const [srv, setSrv] = useState<any>(null); useEffect(() => onSteps(() => re(n => n + 1)), []);
  useEffect(() => { const ep = localStorage.getItem("sk.pushEndpoint"); if (ep) pushStatus().then(setSrv).catch(e => setSrv({ error: e.message })); }, [refresh, getSteps().length]);
  const iosV = (navigator.userAgent.match(/OS (\d+)_(\d+)/) || []).slice(1).map(Number); const ios = isIOS();
  const saved = (() => { try { return JSON.parse(localStorage.getItem("sk.pushSteps") || "null"); } catch { return null; } })();
  const S = getSteps().length ? getSteps() : saved?.steps || []; const g = (k: string) => S.find((x: Step) => x.k === k);
  const perm = typeof Notification !== "undefined" ? Notification.permission : "unavailable";
  const rows: [string, boolean | null, string][] = [
    ["iOS 16.4 or later", ios ? (iosV.length ? iosV[0] > 16 || (iosV[0] === 16 && iosV[1] >= 4) : null) : true, ios ? (iosV.length ? `iOS ${iosV.join(".")}` : "unknown") : "Not an iPhone"],
    ["Installed to Home Screen", ios ? isStandalone() : true, ios ? (isStandalone() ? "Opened from Home Screen icon" : "Opened in Safari: alerts can't work here") : "Not needed"],
    ["Permission granted", perm === "granted" ? true : perm === "denied" ? false : null, perm],
    ["Service worker", g("Service worker")?.ok ?? null, g("Service worker")?.v || "not checked yet"],
    ["Subscribed on this device", g("Subscribed on device")?.ok ?? (localStorage.getItem("sk.pushEndpoint") ? true : null), g("Subscribed on device")?.v || (localStorage.getItem("sk.pushEndpoint") ? "endpoint saved" : "no")],
    ["Server has subscription", srv?.you ? srv.you.subscribed : g("Server has subscription")?.ok ?? null, srv?.you ? (srv.you.subscribed ? `yes, watching ${srv.you.watching}` : "No: server lost it (restart). Tap Re-register.") : g("Server has subscription")?.v || "unknown"],
    ["Test sent", g("Test sent")?.ok ?? null, g("Test sent")?.v || "not yet"]];
  const ic = (o: boolean | null) => o === true ? <span className="ck ok">✓</span> : o === false ? <span className="ck bad">✕</span> : <span className="ck na">–</span>;
  return <div className="card m0"><h3>Notification checklist</h3>
    {rows.map(([k, o, v]) => <div key={k} className="row between sm ckrow"><span className="row g8">{ic(o)}{k}</span><span className="faint">{v}</span></div>)}
    {S.filter((x: Step) => x.ok === false).map((x: Step) => <div key={x.k} className="ckerr">{x.k} failed: {x.v}</div>)}
    <div className="faint sm mt8">App build {BUILD}{saved?.at ? ` · last attempt ${new Date(saved.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</div></div>;
}

// Local notification that works on iPhone too (pages there can't construct Notification; the service worker can).
export function localNotify(title: string, body: string, tag?: string): Promise<boolean> { try { if (typeof Notification === "undefined" || Notification.permission !== "granted") return Promise.resolve(false);
  return (navigator.serviceWorker ? navigator.serviceWorker.getRegistration("/").then(r => r || navigator.serviceWorker.register("/sw.js")) : Promise.resolve(null as any)).then((r: any) => r ? r.showNotification(title, { body, tag, icon: "/icon-192.png", badge: "/icon-192.png" }).then(() => true) : (new Notification(title, { body }), true)).catch(() => false); } catch { return Promise.resolve(false); } }

// ---------- Security queues (real feed only) ----------
export function SecurityCard({ iata }: { iata: string }) {
  const [s, setS] = useState<any>(null); useEffect(() => { const go = () => api(`/security/${iata}`).then(setS).catch(e => setS({ available: false, note: e.message })); go(); const t = setInterval(go, 120e3); return () => clearInterval(t); }, [iata]);
  if (!s) return null;
  return <div className="card"><div className="row between"><h3>Security wait</h3>{s.available && <span className="srcb live">LIVE</span>}</div>
    {s.available ? <>{s.queues.map((q: any) => <div key={q.terminal + q.kind} className="row between ckrow"><span>{q.terminal} <span className="faint sm">{q.kind === "Connections" ? "flight connections" : "departures"}</span></span><b className={q.max >= 20 ? "orange" : ""}>{q.text}{q.stale ? " (stale)" : ""}</b></div>)}
      <div className="faint sm mt8">{s.source}{s.updated ? " · updated " + new Date(s.updated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) + " UK time" : ""}</div></>
      : <div className="muted sm">No live queue data. {s.note || `${iata} doesn't publish security wait times in a feed we can read.`}</div>}</div>;
}
// ---------- Official airport links (all checked returning 200 on 25 Oct 2026) ----------
const MAGL = (d: string, lounge: string) => ({ Parking: `https://${d}/parking/`, "Drop-off & pick-up": `https://${d}/getting-to-and-from/pick-up-and-drop-off/`, Lounges: `https://${d}${lounge}`, "Getting here": `https://${d}/getting-to-and-from/`, "Fast Track security": `https://${d}/at-the-airport/security-fasttrack/` });
const LINKS: Record<string, Record<string, string>> = {
  MAN: MAGL("www.manchesterairport.co.uk", "/at-the-airport/airport-lounges/"), STN: MAGL("www.stanstedairport.com", "/at-the-airport/escape-lounge/"), EMA: MAGL("www.eastmidlandsairport.com", "/at-the-airport/escape-lounge/"),
  LHR: { Parking: "https://www.heathrow.com/transport-and-directions/heathrow-parking", "Drop-off & by car": "https://www.heathrow.com/transport-and-directions/by-car", Lounges: "https://www.heathrow.com/at-the-airport/lounges-hotels-spas", "Getting here": "https://www.heathrow.com/transport-and-directions", "Security & baggage": "https://www.heathrow.com/at-the-airport/security-and-baggage" } };
export function AirportLinks({ iata }: { iata: string }) { const L = LINKS[iata]; if (!L) return null;
  return <div className="card"><h3>Plan your trip</h3><div className="muted sm">Official {iata} airport pages</div>{Object.entries(L).map(([k, u]) => <a key={k} className="row between ckrow" href={u} target="_blank" rel="noreferrer"><span>{k}</span><span className="faint sm">{new URL(u).hostname.replace("www.", "")} ›</span></a>)}</div>; }
// ---------- Departure day checklist ----------
export function DepartureDay({ f }: { f: Flight }) {
  const [sec, setSec] = useState<any>(null); const iata = f.origin?.iata || "";
  useEffect(() => { if (iata) api(`/security/${iata}`).then(setSec).catch(() => {}); }, [iata]);
  if (!f.dep.scheduled || ["departed", "enroute", "landed", "cancelled"].includes(f.status || "") || Math.abs(+new Date(f.dep.scheduled) - Date.now()) > 36 * 3600e3) return null;
  const tz = f.origin?.tz; const q = sec?.available ? sec.queues.filter((x: any) => x.kind === "Departures" && (!f.dep.terminal || x.terminal.replace(/\D/g, "") === String(f.dep.terminal).replace(/\D/g, ""))) : [];
  const qMax = q.length ? Math.max(...q.map((x: any) => x.max || 0)) : null; const d = Math.max(0, delay(f.dep) ?? 0);
  const items: [string, string, boolean | null][] = [
    ["Check-in", (f as any).checkIn ? `Zone ${(f as any).checkIn}` : "See airline", null],
    ["Terminal", f.dep.terminal ? `Terminal ${f.dep.terminal}` : "Not published yet", f.dep.terminal ? true : null],
    ["Security queue", qMax != null ? `${q.map((x: any) => x.text).join(", ")} now` : "No live queue data", qMax != null ? qMax < 20 : null],
    ["Delay", d ? `+${d} min (airport)` : "None published", d ? false : true],
    ["Gate", f.dep.gate ? `Gate ${f.dep.gate}` : (f as any).gateShownFrom ? `Shown from ${fmtT((f as any).gateShownFrom, tz)}` : "Not shown yet", f.dep.gate ? true : null],
    ["Arrival belt", f.arr.baggage ? `Belt ${f.arr.baggage}` : "Shown after landing", f.arr.baggage ? true : null]];
  return <div className="card"><h3>Departure day</h3>{items.map(([k, v, o]) => <div key={k} className="row between ckrow"><span className="row g8"><span className={"ck " + (o === true ? "ok" : o === false ? "bad" : "na")}>{o === true ? "✓" : o === false ? "!" : "–"}</span>{k}</span><span className="sm">{v}</span></div>)}
    <div className="faint sm mt8">Leave time above uses the delay; security time {qMax != null ? "is live from the airport" : "isn't published by this airport, so allow your usual buffer"}.</div></div>;
}

// On-device test: proves permission + service worker work, independent of the server / Apple push service.
export async function testLocal(): Promise<string> {
  if (typeof Notification === "undefined") throw new Error("This browser has no notifications here. On iPhone, open Skyline from its Home Screen icon (iOS 16.4+).");
  if (Notification.permission !== "granted") throw new Error(Notification.permission === "denied" ? "Blocked — iOS Settings → Notifications → Skyline → Allow." : "Tap Turn on alerts first so iOS can ask for permission.");
  const ok = await localNotify("Skyline test (this device)", "Local notifications work. Server push is tested separately.", "sk-local-test");
  if (!ok) throw new Error("The service worker couldn't show a notification.");
  return "Shown by this device's service worker. If you didn't see a banner, check Focus / iOS notification settings.";
}
export const notifEnv = () => ({ ios: isIOS(), standalone: isStandalone(), perm: typeof Notification !== "undefined" ? Notification.permission : "unavailable", push: pushSupported() });
