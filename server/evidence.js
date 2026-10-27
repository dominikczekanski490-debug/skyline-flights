// Evidence rules for "departed" / "landed" (v34). A status is only stated as fact when something real backs it:
//  - an official feed's actual timestamp (not in the future, not inferred), or
//  - live ADS-B of the matched aircraft: airborne, fresh, on the origin→destination corridor, heading to the destination.
// Anything else is wording from a feed or an estimate, and is never pushed as "Departed"/"Landed".
const R = 3440.065, rad = d => d * Math.PI / 180;
export const nmi = (a, b) => { const dl = rad(b.lat - a.lat), dn = rad(b.lon - a.lon); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)), x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
// Is this ADS-B contact plausibly THIS flight leg? (callsigns are reused / don't always map from flight numbers)
export function liveFits(f, L, now = Date.now()) {
  if (!L || L.lat == null) return { ok: false, why: "no position" };
  if (L.seen != null && L.seen > 120) return { ok: false, why: "stale position (" + Math.round(L.seen) + " s old)" };
  const o = f?.origin, d = f?.destination;
  const sd = Date.parse(f?.dep?.actual || f?.dep?.estimated || f?.dep?.scheduled || "");
  if (sd && now < sd - 45 * 60e3) return { ok: false, why: "scheduled departure is still " + Math.round((sd - now) / 60e3) + " min away" };
  if (o?.lat != null && d?.lat != null) { const tot = nmi(o, d), x = nmi(o, L) + nmi(L, d) - tot;
    if (x > Math.max(60, tot * 0.15)) return { ok: false, why: "aircraft is off the " + o.iata + "→" + d.iata + " route" };
    if (typeof L.alt === "number" && L.track != null) { const dd = Math.abs(((L.track - brg(L, d)) + 540) % 360 - 180); if (dd > 60 && nmi(L, d) > 30) return { ok: false, why: "aircraft is not heading to " + d.iata }; } }
  return { ok: true };
}
const past = (t, now) => { const v = Date.parse(t || ""); return !!v && v <= now + 2 * 60e3; };
// "feed" | "adsb" | null
export function depEvidence(f, L, now = Date.now()) {
  if (!f) return null;
  if (f.dep?.actual && past(f.dep.actual, now) && !f.staleInferred && f.dep.actualKind !== "offblock") return /ADS-B/.test(f.dep.actualSource || "") ? "adsb" : "feed";
  if (L && liveFits(f, L, now).ok && typeof L.alt === "number" && (L.gs || 0) > 80 && f.origin?.lat != null && nmi(f.origin, L) > 3) return "adsb";
  return null; }
export function arrEvidence(f, L, now = Date.now()) {
  if (!f) return null;
  if (f.arr?.actual && past(f.arr.actual, now) && !f.staleInferred) return /ADS-B/.test(f.arr.actualSource || "") ? "adsb" : "feed";
  if (L && L.alt === "ground" && f.destination?.lat != null && nmi(f.destination, L) < 8 && (L.seen == null || L.seen < 120)) return "adsb";
  return null; }
