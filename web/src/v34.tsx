// v34: notification inbox, example previews, and the same "no departed/landed without evidence" rule the server uses.
import { useEffect, useState } from "react";
import type { Flight } from "./lib";
import { api } from "./lib";
export type InboxItem = { title: string; body: string; kind?: string; url?: string; at: number; tag?: string; example?: boolean };
const KEY = "sk.inbox";
export const inbox = (): InboxItem[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export function addInbox(it: InboxItem) { const l = inbox(); if (l.some(x => x.at === it.at && x.title === it.title)) return; const n = [it, ...l].sort((a, b) => b.at - a.at).slice(0, 40);
  localStorage.setItem(KEY, JSON.stringify(n)); window.dispatchEvent(new Event("sk-inbox")); }
if (typeof navigator !== "undefined" && navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", e => { if (e.data?.type === "inbox" && e.data.item) addInbox(e.data.item); });
const city = (a: any) => a?.city || a?.iata || "?";
export const flightTitle = (f: Flight) => `✈ ${f.number} · ${city(f.origin)} → ${city(f.destination)}`;
const hm = (t?: string, tz?: string) => t ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || "Europe/London" }) : "";
export function contextLine(f: Flight) { const c: string[] = []; const eta = f.arr?.actual ? null : f.arr?.estimated; if (eta) c.push(`ETA ${hm(eta, f.destination?.tz)} (est.)`);
  if (f.dep?.gate) c.push(`Gate ${f.dep.gate}`); if (f.dep?.terminal) c.push(`Terminal ${String(f.dep.terminal).replace(/^T/, "")}`); return c.join(" · "); }
// Messages for an in-app refresh, from old → new. Departure/landing only with server evidence.
export function changeMsgs(o: any, n: any): { kind: string; text: string }[] { const m: { kind: string; text: string }[] = [];
  const hadD = o.evidence ? !!o.evidence.dep : false, hadA = o.evidence ? !!o.evidence.arr : false;
  if (n.status === "cancelled" && o.status !== "cancelled") m.push({ kind: "cancel", text: "❌ Cancelled" });
  if (n.dep?.gate && n.dep.gate !== o.dep?.gate) m.push({ kind: "gate", text: `🚪 Gate ${o.dep?.gate ? o.dep.gate + " → " : ""}${n.dep.gate}` });
  if (n.evidence?.dep && !hadD && !n.evidence?.arr && o.evidence) m.push({ kind: "status", text: `🛫 Took off${n.dep?.actual ? " " + hm(n.dep.actual, n.origin?.tz) : ""}` });
  if (n.evidence?.arr && !hadA && o.evidence) m.push({ kind: "status", text: `🛬 Landed${n.arr?.actual ? " " + hm(n.arr.actual, n.destination?.tz) : ""}` });
  const t = n.statusText || ""; if (t && t !== o.statusText && /boarding|final call|last call|gate (open|closed)|go to gate/i.test(t) && !/depart|land|airborne|en route/i.test(t)) m.push({ kind: "status", text: `🚪 ${t} (airport feed)` });
  return m; }
const ICON: Record<string, string> = { cancel: "❌", gate: "🚪", delay: "⏱", belt: "🧳", status: "✈", test: "✓" };
const tone = (k?: string) => k === "cancel" ? "bad" : k === "delay" ? "warn" : k === "test" ? "ok" : "info";
function Card({ it }: { it: InboxItem }) { const [a, ...b] = it.body.split("\n");
  return <a className={"nfc " + tone(it.kind)} href={it.url || "#"} onClick={e => { if (!it.url || it.example) e.preventDefault(); }}>
    <span className="nfc-i"><img src="/icon-192.png" alt="" /><i>{ICON[it.kind || "status"] || "✈"}</i></span>
    <span className="nfc-t"><span className="row between"><b>{it.title}</b><small>{it.example ? "EXAMPLE" : new Date(it.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></span>
      <span className="nfc-b">{a}</span>{b.length > 0 && <span className="nfc-c">{b.join(" ")}</span>}</span></a>; }
export function NotifInbox() { const [l, setL] = useState(inbox());
  useEffect(() => { const u = () => setL(inbox()); window.addEventListener("sk-inbox", u);
    navigator.serviceWorker?.getRegistration("/").then(r => r?.pushManager.getSubscription()).then(s => s && api(`/push/inbox?endpoint=${encodeURIComponent(s.endpoint)}`)).then((j: any) => (j?.items || []).forEach(addInbox)).catch(() => {});
    return () => window.removeEventListener("sk-inbox", u); }, []);
  return <div className="mt8"><b className="sm">Recent alerts</b>{l.length ? <div className="col g6 mt4">{l.slice(0, 12).map(x => <Card key={x.at + x.title} it={x} />)}</div> : <div className="faint sm mt4">No alerts yet. They'll appear here as well as on your lock screen.</div>}
    {l.length > 0 && <button className="linkbtn sm mt4" onClick={() => { localStorage.removeItem(KEY); setL([]); }}>Clear</button>}</div>; }
const EX: InboxItem[] = [
  { kind: "delay", title: "✈ LS1566 · Larnaca → London", body: "⏱ Delayed 25 min (estimated)\nETA 20:20 (est.) · Gate 12 · Terminal 1" },
  { kind: "gate", title: "✈ LS1566 · Larnaca → London", body: "🚪 Gate 12 → 14\nTerminal 1" },
  { kind: "status", title: "✈ LS1566 · Larnaca → London", body: "🚪 Boarding (airport feed) · Gate 14" },
  { kind: "status", title: "✈ LS1566 · Larnaca → London", body: "🛫 Took off 15:21 · seen airborne on ADS-B\nETA 19:58 (est.)" },
  { kind: "status", title: "✈ LS1566 · Larnaca → London", body: "🛬 Landed 19:52" },
  { kind: "belt", title: "✈ LS1566 · Larnaca → London", body: "🧳 Bags on belt 6" },
  { kind: "cancel", title: "✈ LS1566 · Larnaca → London", body: "❌ Cancelled\nCheck the airline app for rebooking" }].map((x, i) => ({ ...x, at: i, example: true }));
export function NotifPreviews() { const [o, setO] = useState(false);
  return <div className="mt8"><button className="linkbtn sm nfcx" onClick={() => setO(!o)}>{o ? "Hide" : "Show"} example alerts</button>
    {o && <div className="col g6 mt4"><div className="faint sm">Examples of each alert type (not real flights). Take-off and landing are only sent when an airport feed gives an actual time or ADS-B shows the aircraft in the air or on the ground.</div>{EX.map(x => <Card key={x.at} it={x} />)}</div>}</div>; }
