export type Ap = { iata: string; icao?: string; name: string; city?: string; country?: string; lat?: number; lon?: number; tz?: string };
export type Times = { scheduled?: string | null; estimated?: string | null; actual?: string | null; gate?: string; terminal?: string; baggage?: string };
export type Flight = { id: string; number: string; date: string; airline?: any; origin?: Ap; destination?: Ap; dep: Times; arr: Times; status?: string; statusText?: string; source?: string;
  callsign?: string; aircraft?: { reg?: string; hex?: string; model?: string }; notes?: string; example?: boolean; manual?: boolean; diverted?: Ap; scheduleUnknown?: boolean; updates?: { at: number; text: string }[]; friend?: string };
export const api = async (p: string, o?: RequestInit) => { const r = await fetch("/api" + p, o); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), j); return j; };
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
export function dist(a?: Ap, b?: Ap) { if (!a?.lat || !b?.lat) return 0; const R = 3958.8, r = Math.PI / 180; const dl = (b.lat - a.lat) * r, dn = (b.lon! - a.lon!) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
export const estDurMin = (a?: Ap, b?: Ap) => { const d = dist(a, b); return d ? Math.round(d / 495 * 60 + 25) : 0; }; // ~430kt cruise + taxi
export const fmtT = (iso?: string | null, tz?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || "Europe/London" }) : "--:--";
export const fmtD = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-GB", o);
export const best = (t: Times) => t.actual || t.estimated || t.scheduled || null;
export const delay = (t: Times) => { const b = t.actual || t.estimated; return t.scheduled && b ? Math.round((+new Date(b) - +new Date(t.scheduled)) / 60000) : null; };
export const dur = (m: number) => { m = Math.abs(Math.round(m)); const d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d}d ${h}h` : h ? `${h}h${mm ? " " + mm + "m" : ""}` : `${mm}m`; };
export const lateLabel = (d: number | null) => d == null ? "" : d >= 5 ? `${dur(d)} Late` : d <= -5 ? `${dur(d)} Early` : "On Time";
export const lateColor = (d: number | null) => d == null ? "var(--muted)" : d >= 45 ? "var(--red)" : d >= 15 ? "var(--orange)" : d >= 5 ? "var(--orange)" : "var(--green)";
export function withEstArr(f: Flight): Flight { // fill missing arrival with labelled estimate
  if (f.arr?.scheduled || !f.dep?.scheduled) return f; const m = estDurMin(f.origin, f.destination); if (!m) return f;
  const s = new Date(+new Date(f.dep.scheduled) + m * 60000).toISOString(); const b = best(f.dep); const e = b ? new Date(+new Date(b) + m * 60000).toISOString() : undefined;
  return { ...f, arr: { ...f.arr, scheduled: s, estimated: e, estimatedOnly: true } as any };
}
// storage
const K = "skyline.flights.v1";
export const load = (): Flight[] => { try { return JSON.parse(localStorage.getItem(K) || "[]"); } catch { return []; } };
export const save = (l: Flight[]) => localStorage.setItem(K, JSON.stringify(l));
export const logo = (iata?: string) => iata ? `/logos/${iata}.png` : "";
export function ics(fl: Flight[]) {
  const z = (s: string) => s.replace(/[-:]/g, "").replace(/\.\d+/, ""); const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Skyline//EN"];
  for (const f of fl) { const s = best(f.dep) || f.date + "T09:00:00Z"; const e = best(withEstArr(f).arr) || new Date(+new Date(s) + 7200e3).toISOString();
    L.push("BEGIN:VEVENT", `UID:${f.id}@skyline`, `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(new Date(s).toISOString())}`, `DTEND:${z(new Date(e).toISOString())}`,
      `SUMMARY:✈ ${f.number} ${f.origin?.iata}→${f.destination?.iata}`, `LOCATION:${f.origin?.name || ""}`, `DESCRIPTION:${f.airline?.name || ""} ${f.number}. Terminal ${f.dep.terminal || "-"} Gate ${f.dep.gate || "-"}`, "END:VEVENT"); }
  L.push("END:VCALENDAR"); return L.join("\r\n");
}
export const download = (name: string, text: string, type = "text/calendar") => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
export const wxText = (c: number) => c === 0 ? "clear" : c <= 2 ? "few clouds" : c === 3 ? "overcast" : c <= 48 ? "fog" : c <= 57 ? "drizzle" : c <= 67 ? "rain" : c <= 77 ? "snow" : c <= 82 ? "showers" : c <= 86 ? "snow showers" : "thunderstorms";
export const wxIcon = (c: number) => c === 0 ? "☀️" : c <= 2 ? "🌤️" : c === 3 ? "☁️" : c <= 48 ? "🌫️" : c <= 67 ? "🌧️" : c <= 77 ? "❄️" : c <= 82 ? "🌦️" : c <= 86 ? "🌨️" : "⛈️";
export const tzOffset = (tz?: string, at = new Date()) => { if (!tz) return 0; const p = new Date(at.toLocaleString("en-US", { timeZone: tz })); const u = new Date(at.toLocaleString("en-US", { timeZone: "UTC" })); return Math.round((+p - +u) / 60000); };
// Live ADS-B snapshot saved on the flight by the refresh loop; ignored once older than 5 minutes.
export const liveOf = (f: any) => f?.live && Date.now() - (f.live.at || 0) < 5 * 60e3 ? f.live : null;
// One status vocabulary for every card, from the airport feed + ADS-B. Never guessed from the clock alone.
export function statusOf(f: Flight, lv?: any): { label: string; cls: "ok" | "bad" | "air" | "warn" } {
  const d = delay(f.dep); const s = f.status || "";
  if (s === "cancelled") return { label: "Cancelled", cls: "bad" };
  if (s === "diverted") return { label: "Diverted", cls: "bad" };
  if (s === "landed") return { label: "Landed", cls: "ok" };
  if (s === "enroute" || (lv && typeof lv.alt === "number" && s !== "landed")) return { label: "En route", cls: "air" };
  if (s === "departed") return { label: "Departed", cls: "air" };
  if (s === "boarding") return { label: /final/i.test(f.statusText || "") ? "Final call" : /closing/i.test(f.statusText || "") ? "Gate closing" : "Boarding", cls: "warn" };
  if (s === "gate") return { label: /closed/i.test(f.statusText || "") ? "Gate closed" : "Go to gate", cls: "warn" };
  if (s === "delayed" || (d != null && d >= 15)) return { label: d != null && d > 0 ? `Delayed +${d}m` : "Delayed", cls: "bad" };
  return { label: "Scheduled", cls: "ok" };
}
