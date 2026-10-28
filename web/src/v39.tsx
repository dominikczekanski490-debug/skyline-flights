// v39 (t135u): Labs v5 — 30 more smart insights (statistical / rule-based, NO language model) + 32 tools.
// All computed on-device from the same real boards (official / AeroDataBox / live ADS-B) and Skyline's airport DB.
import { delayMin } from "./v25";
import { Note, mean, median, isCx, alName, oth, hm, hourIn } from "./v28";
import { FL, GR, tT, ms, hav, brg, byT, up, T3 as T } from "./v29";

const AI = "Smart insights", ST = "Statistical", RB = "Rule-based", CAT = "Live board", NET = "Network & routes", OPS = "Airport ops", PUN = "Punctuality", TL = "Tools";
const dl = (f: any, dir: string) => delayMin(f, dir);
const S = (f: any, dir: string) => (dir === "dep" ? f.dep : f.arr) || {};
const hr = (f: any, dir: string, d: any) => hourIn(S(f, dir).scheduled || tT(f, dir), d.tz);
const km = (f: any, dir: string, d: any) => hav(d.airport, oth(f, dir));
const Ds = (fs: any[], dir: string) => fs.map(f => dl(f, dir)).filter((x: any) => x != null) as number[];
const q = (a: number[], p: number) => { if (a.length < 3) return NaN; const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const sd = (a: number[]) => { if (a.length < 3) return NaN; const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const wil = (k: number, n: number) => { if (!n) return NaN; const z = 1.96, p = k / n; return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n); };
const m1 = (v: number) => (v > 0 ? "+" : "") + Math.round(v) + "′", p0 = (v: number) => Math.round(v) + "%";
const reg = (p: any) => String(p?.tz || "").split("/")[0] || null;
const ter = (f: any, dir: string) => { const t = S(f, dir).terminal; return t ? "T" + t : null; };
const band = (f: any, dir: string, d: any) => { const k = km(f, dir, d); return !isFinite(k) ? null : k < 500 ? "< 500 km" : k < 1500 ? "500–1,500 km" : k < 3000 ? "1,500–3,000 km" : k < 6000 ? "3,000–6,000 km" : "6,000+ km"; };
const late = (f: any, dir: string) => (dl(f, dir) ?? -99) >= 15;
const N3 = (fs: any[], dir: string, f: (a: number[]) => number) => { const a = Ds(fs, dir); return a.length >= 3 ? f(a) : NaN; };
const A = (id: string, n: string, d: string, ic: string, o: any, k: any = ST) => T(id, n, d, AI, ic, p => <GR {...p} {...o} />, k);
const L = (id: string, n: string, d: string, c: string, ic: string, filt: any, o: any = {}, k?: any) => T(id, n, d, c, ic, p => <FL {...p} filt={filt} sort={o.sort || byT} {...o} />, k);
const Gp = (id: string, n: string, d: string, c: string, ic: string, o: any) => T(id, n, d, c, ic, p => <GR {...p} {...o} />);
const NEED3 = "Groups with fewer than 3 timed flights are left out, so small samples don't mislead.";

// ===== 30 smart insights =====
export const AI5 = [
  A("almed", "Typical airline delay", "Median delay per airline", "podium", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => N3(fs, dir, median), fmt: m1, note: "Median is robust to one huge delay. " + NEED3 }),
  A("alp90", "Worst-case airline delay", "90th-percentile delay per airline", "warn", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => q(Ds(fs, dir), .9), fmt: m1, note: "9 in 10 of the airline's flights today were less late than this. " + NEED3 }),
  A("alsd", "Least predictable airlines", "Delay spread (standard deviation)", "scale", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => sd(Ds(fs, dir)), fmt: (v: number) => "±" + Math.round(v) + "′", note: "Higher = less predictable. " + NEED3 }),
  A("aliqr", "Airline delay IQR", "Middle-50% delay range", "hist", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => q(Ds(fs, dir), .75) - q(Ds(fs, dir), .25), fmt: (v: number) => Math.round(v) + "′ wide", note: "Interquartile range of delays. " + NEED3 }),
  A("altrim", "Trimmed-mean delay", "10% trimmed average per airline", "target", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => N3(fs, dir, a => { const s = [...a].sort((x, y) => x - y), c = Math.floor(s.length * .1); return mean(s.slice(c, s.length - c)); }), fmt: m1, note: "Drops the top and bottom 10% before averaging. " + NEED3 }),
  A("alskew", "Delay skew", "Mean minus median per airline", "trend", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => N3(fs, dir, a => mean(a) - median(a)), fmt: m1, note: "Large positive skew = a few very late flights drag the average. " + NEED3 }),
  A("alcv", "Delay consistency", "Coefficient of variation per airline", "ring", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => N3(fs, dir, a => { const m = mean(a.map(x => Math.max(0, x))); return m > 0 ? sd(a) / m : NaN; }), fmt: (v: number) => v.toFixed(2), note: "SD ÷ mean late minutes. Lower is more consistent. " + NEED3 }),
  A("alwil", "On-time (cautious)", "Wilson lower bound of on-time %", "check", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => { const a = Ds(fs, dir); return a.length >= 3 ? 100 * wil(a.filter(x => x < 15).length, a.length) : NaN; }, fmt: p0, note: "95% Wilson lower bound for on-time (<15′) share — rewards proven reliability, not lucky small samples." }),
  A("rtwil", "Places likely late (cautious)", "Wilson lower bound of late % per place", "map", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[], dir: string) => { const a = Ds(fs, dir); return a.length >= 3 ? 100 * wil(a.filter(x => x >= 15).length, a.length) : NaN; }, fmt: p0, note: "Lower bound of the 15+ min late rate; only places with 3+ timed flights." }),
  A("rtlap", "Late chance per place", "Laplace-smoothed P(15+ late)", "pin", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[], dir: string) => { const a = Ds(fs, dir); return a.length ? 100 * (a.filter(x => x >= 15).length + 1) / (a.length + 2) : NaN; }, fmt: p0, note: "(late + 1) ÷ (timed + 2): avoids 0% / 100% from one flight." }),
  A("rtmed", "Typical delay by place", "Median delay per destination/origin", "map", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[], dir: string) => N3(fs, dir, median), fmt: m1, note: NEED3 }),
  A("rtp90", "Worst-case by place", "90th-percentile delay per place", "warn", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[], dir: string) => q(Ds(fs, dir), .9), fmt: m1, note: NEED3 }),
  A("hrp75", "Bad-hour delay", "75th-percentile delay per hour", "timeline", { by: (f: any, dir: string, d: any) => { const h = hr(f, dir, d); return isFinite(h) ? String(h).padStart(2, "0") + ":00" : null; }, val: (fs: any[], dir: string) => q(Ds(fs, dir), .75), fmt: m1, note: "1 in 4 flights in that hour were at least this late. " + NEED3 }),
  A("termmed", "Terminal typical delay", "Median delay per terminal", "building", { by: ter, val: (fs: any[], dir: string) => N3(fs, dir, median), fmt: m1, note: NEED3 }),
  A("ctrymed", "Country typical delay", "Median delay per country", "flag", { by: (f: any, dir: string) => oth(f, dir)?.country, val: (fs: any[], dir: string) => N3(fs, dir, median), fmt: m1, note: NEED3 }),
  A("regmed", "Region typical delay", "Median delay per world region", "globe", { by: (f: any, dir: string) => reg(oth(f, dir)), val: (fs: any[], dir: string) => N3(fs, dir, median), fmt: m1, note: "Region = first part of the destination's time zone. " + NEED3 }),
  A("bandly", "Delay by distance band", "Average delay per distance band", "scale", { by: band, val: (fs: any[], dir: string) => N3(fs, dir, mean), fmt: m1, note: "Great-circle distance from this airport. " + NEED3 }),
  A("bandlate", "Late rate by distance", "15+ min late % per band", "hist", { by: band, val: (fs: any[], dir: string) => { const a = Ds(fs, dir); return a.length >= 3 ? 100 * a.filter(x => x >= 15).length / a.length : NaN; }, fmt: p0, note: NEED3 }),
  A("hrcx", "Cancellation rate by hour", "Share cancelled per hour", "xcircle", { by: (f: any, dir: string, d: any) => { const h = hr(f, dir, d); return isFinite(h) ? String(h).padStart(2, "0") + ":00" : null; }, val: (fs: any[]) => fs.length >= 3 ? 100 * fs.filter(isCx).length / fs.length : NaN, fmt: p0, note: "Hours with 3+ flights only." }),
  A("termcx", "Cancellation rate by terminal", "Share cancelled per terminal", "building", { by: ter, val: (fs: any[]) => fs.length >= 3 ? 100 * fs.filter(isCx).length / fs.length : NaN, fmt: p0, note: "Terminals with 3+ flights only." }),
  A("dlyshare", "Who causes the delay", "Share of all late minutes per airline", "podium", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => Ds(fs, dir).reduce((s, x) => s + Math.max(0, x), 0), fmt: (v: number) => Math.round(v) + " min", note: "Total late minutes contributed today (early flights count 0)." }),
  A("early", "Early-running airlines", "% of flights 5+ min early", "land", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => { const a = Ds(fs, dir); return a.length >= 3 ? 100 * a.filter(x => x <= -5).length / a.length : NaN; }, fmt: p0, note: NEED3 }),
  A("pmpen", "Afternoon penalty", "PM minus AM average delay per airline", "sun", { by: (f: any) => alName(f), val: (fs: any[], dir: string, d: any) => { const am = Ds(fs.filter(f => hr(f, dir, d) < 12), dir), pm = Ds(fs.filter(f => hr(f, dir, d) >= 12), dir); return am.length >= 2 && pm.length >= 2 ? mean(pm) - mean(am) : NaN; }, fmt: m1, note: "Positive = the airline's delays build through the day. Needs 2+ timed flights each side of noon." }),
  A("entropy", "Choice of airlines per place", "Shannon diversity (effective no. of airlines)", "users", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[]) => { const c: Record<string, number> = {}; fs.forEach(f => c[alName(f)] = (c[alName(f)] || 0) + 1); const H = -Object.values(c).reduce((s, n) => s + n / fs.length * Math.log(n / fs.length), 0); return Math.exp(H); }, fmt: (v: number) => v.toFixed(1), note: "exp(Shannon entropy) of airline shares — 1.0 means one airline flies it." }),
  A("hhi", "Route concentration", "Herfindahl index per place", "scale", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[]) => { if (fs.length < 3) return NaN; const c: Record<string, number> = {}; fs.forEach(f => c[alName(f)] = (c[alName(f)] || 0) + 1); return Math.round(Object.values(c).reduce((s, n) => s + (100 * n / fs.length) ** 2, 0)); }, fmt: (v: number) => String(v), note: "HHI 0–10,000; above 2,500 = highly concentrated (US DoJ convention)." }),
  T("madout", "Statistical outlier flights", "Delay beyond median + 3×MAD", AI, "target", p => <FL {...p} filt={(f: any, dir: string, _n: number, d: any) => { const a = Ds(d.flights, dir); if (a.length < 8) return false; const m = median(a), mad = median(a.map(x => Math.abs(x - m))) || 1, x = dl(f, dir); return x != null && x > m + 3 * mad; }} sort={(a: any, b: any, dir: string) => (dl(b, dir) ?? 0) - (dl(a, dir) ?? 0)} empty="No flight is a robust outlier (needs 8+ timed flights)." />, ST),
  T("blend", "Blended risk ranking", "Upcoming flights by airline + place history", AI, "brain", p => <FL {...p} filt={(f: any, dir: string, n: number) => up(f, dir, n) && !isCx(f)} sort={byT} head={() => <Note>Score = ½·(airline mean delay today) + ½·(place mean delay today), from completed flights on this board. Rule-based estimate.</Note>} right={(f: any, dir: string, d: any) => { const done = d.flights.filter((x: any) => dl(x, dir) != null && S(x, dir).actual); const a = Ds(done.filter((x: any) => alName(x) === alName(f)), dir), c = Ds(done.filter((x: any) => oth(x, dir)?.city === oth(f, dir)?.city), dir); const s = (a.length ? mean(a) : 0) / 2 + (c.length ? mean(c) : 0) / 2; return <b className={s >= 15 ? "bad-t" : s >= 5 ? "warn-t" : "good-t"}>{a.length || c.length ? m1(s) : "—"}</b>; }} />, RB),
  L("alhot", "Airline running late today", "Upcoming flights of airlines averaging 20+ late", AI, "warn", (f: any, dir: string, n: number, d: any) => { if (!up(f, dir, n) || isCx(f)) return false; const a = Ds(d.flights.filter((x: any) => alName(x) === alName(f) && S(x, dir).actual), dir); return a.length >= 2 && mean(a) >= 20; }, { empty: "No airline here is averaging 20+ min late on 2+ completed flights." }),
  L("busyrisk", "Flights in overloaded hours", "Upcoming, in hours above mean + 1 SD", AI, "users", (f: any, dir: string, n: number, d: any) => { if (!up(f, dir, n)) return false; const c: number[] = Array(24).fill(0); d.flights.forEach((x: any) => { const h = hr(x, dir, d); if (isFinite(h)) c[h]++; }); const nz = c.filter(Boolean), t = mean(nz) + (sd(nz) || 0); return c[hr(f, dir, d)] > t; }, { empty: "No upcoming flight falls in an unusually busy hour." }, RB),
  L("knock", "Knock-on candidates", "Upcoming on a route whose last flight was 30+ late", AI, "link2", (f: any, dir: string, n: number, d: any) => { if (!up(f, dir, n)) return false; const prev = d.flights.filter((x: any) => oth(x, dir)?.city === oth(f, dir)?.city && S(x, dir).actual && ms(tT(x, dir)) < ms(tT(f, dir))).sort((a: any, b: any) => byT(b, a, dir))[0]; return prev && (dl(prev, dir) ?? 0) >= 30; }, { empty: "No upcoming flight follows a 30+ min late one on the same route." }, RB),
];

// ===== 32 tools =====
const bW = (a: number, b: number) => (f: any, dir: string, _n: number, d: any) => { const o = oth(f, dir); if (!o?.lat || !d.airport?.lat) return false; const x = brg(d.airport, o); return x >= a && x < b; };
const hW = (a: number, b: number) => (f: any, dir: string, _n: number, d: any) => { const h = hr(f, dir, d); return h >= a && h < b; };
const rg = (r: string) => (f: any, dir: string) => reg(oth(f, dir)) === r;
function Csv({ apt }: any) { return <GR apt={apt} by={() => null} note="" />; }
export const TOOLS5 = [
  L("ne", "Heading north-east", "Bearing 22°–67°", NET, "compass", bW(22.5, 67.5)),
  L("se", "Heading south-east", "Bearing 112°–157°", NET, "compass", bW(112.5, 157.5)),
  L("sw", "Heading south-west", "Bearing 202°–247°", NET, "compass", bW(202.5, 247.5)),
  L("nw", "Heading north-west", "Bearing 292°–337°", NET, "compass", bW(292.5, 337.5)),
  L("europe", "Europe flights", "Places in European time zones", NET, "globe", rg("Europe")),
  L("america", "Americas flights", "Places in American time zones", NET, "globe", rg("America")),
  L("asia", "Asia flights", "Places in Asian time zones", NET, "globe", rg("Asia")),
  L("africa", "Africa flights", "Places in African time zones", NET, "globe", rg("Africa")),
  L("rush", "Morning rush", "07:00–09:00 local", CAT, "sun", hW(7, 9)),
  L("lunch", "Lunchtime", "11:00–14:00 local", CAT, "sun", hW(11, 14)),
  L("teatime", "Tea-time peak", "16:00–19:00 local", CAT, "sun", hW(16, 19)),
  L("next2h", "Next two hours", "Every movement in the next 2 h", CAT, "clock", (f: any, dir: string, n: number) => up(f, dir, n) && ms(tT(f, dir)) < n + 72e5),
  L("latearr", "Late arrivals still to come", "Due arrivals 15+ late", CAT, "land", (f: any, _d: string, n: number) => up(f, "arr", n) && late(f, "arr"), { dir: "arr", fixed: true, empty: "No arrival still to come is 15+ min late." }),
  L("latedone", "Landed late", "Arrived 15+ min late", PUN, "land", (f: any) => !!f.arr?.actual && late(f, "arr"), { dir: "arr", fixed: true, empty: "No arrival landed 15+ min late." }),
  L("deplate", "Left late", "Departed 15+ min late", PUN, "takeoff", (f: any) => !!f.dep?.actual && late(f, "dep"), { dir: "dep", fixed: true, empty: "No departure left 15+ min late." }),
  L("gateknown", "Gate published", "Flights with a gate on the board", CAT, "door", (f: any, dir: string) => !!S(f, dir).gate),
  L("estonly", "Estimate only", "Estimated but not yet actual", CAT, "hourglass", (f: any, dir: string) => !!S(f, dir).estimated && !S(f, dir).actual),
  L("near500", "Within 500 km", "Nearby hops", NET, "pin", (f: any, dir: string, _n: number, d: any) => km(f, dir, d) < 500),
  L("far5000", "Over 5,000 km", "Far-away places", NET, "globe", (f: any, dir: string, _n: number, d: any) => km(f, dir, d) >= 5000),
  Gp("gateletter", "Flights per gate area", "Grouped by gate letter/prefix", OPS, "door", { by: (f: any, dir: string) => { const g = String(S(f, dir).gate || ""); const m = g.match(/^[A-Z]+/i); return g ? (m ? "Gate " + m[0].toUpperCase() : "Gates " + g.slice(0, 1) + "x") : null; }, note: "Gate prefix as published by the board." }),
  Gp("gatesterm", "Gates per terminal", "Distinct gates used per terminal", OPS, "building", { by: ter, val: (fs: any[], dir: string) => new Set(fs.map(f => S(f, dir).gate).filter(Boolean)).size, note: "Distinct published gates seen per terminal today." }),
  Gp("aldest", "Places per airline", "Distinct places each airline serves", NET, "map", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => new Set(fs.map(f => oth(f, dir)?.city).filter(Boolean)).size, note: "Distinct destinations/origins today." }),
  Gp("ctrycity", "Cities per country", "Distinct cities served per country", NET, "flag", { by: (f: any, dir: string) => oth(f, dir)?.country, val: (fs: any[], dir: string) => new Set(fs.map(f => oth(f, dir)?.city).filter(Boolean)).size, note: "Distinct cities today." }),
  Gp("alspan", "Airline operating span", "Hours between first and last flight", OPS, "hourglass", { by: (f: any) => alName(f), val: (fs: any[], dir: string) => { const t = fs.map(f => ms(tT(f, dir))).filter(isFinite); return t.length > 1 ? (Math.max(...t) - Math.min(...t)) / 36e5 : NaN; }, fmt: (v: number) => v.toFixed(1) + " h", note: "From the airline's first to last movement today." }),
  Gp("blk3", "Flights per 3-hour block", "Board split into 3 h blocks", OPS, "hist", { by: (f: any, dir: string, d: any) => { const h = hr(f, dir, d); if (!isFinite(h)) return null; const b = Math.floor(h / 3) * 3; return `${String(b).padStart(2, "0")}–${String(b + 3).padStart(2, "0")}`; }, note: "Local time blocks." }),
  Gp("hrkm", "Average distance by hour", "How far flights go each hour", NET, "timeline", { by: (f: any, dir: string, d: any) => { const h = hr(f, dir, d); return isFinite(h) ? String(h).padStart(2, "0") + ":00" : null; }, val: (fs: any[], dir: string, d: any) => { const a = fs.map(f => km(f, dir, d)).filter(isFinite); return a.length ? mean(a) : NaN; }, fmt: (v: number) => Math.round(v).toLocaleString() + " km", note: "Great-circle average." }),
  Gp("firstto", "First flight to each place", "Earliest time per place", NET, "sun", { by: (f: any, dir: string) => oth(f, dir)?.city, val: (fs: any[], dir: string) => -Math.min(...fs.map(f => ms(tT(f, dir))).filter(isFinite)), fmt: (v: number) => new Date(-v).toISOString().slice(11, 16) + " UTC", note: "Sorted latest-first-flight on top; times in UTC." }),
  Gp("cxterm", "Cancellations per terminal", "Count by terminal", OPS, "xcircle", { by: ter, filt: (f: any) => isCx(f), note: "Cancelled flights only." }),
  Gp("cxplace", "Cancellations per place", "Count by destination/origin", OPS, "xcircle", { by: (f: any, dir: string) => oth(f, dir)?.city, filt: (f: any) => isCx(f), note: "Cancelled flights only." }),
  Gp("statusal", "Late flights per airline", "Count of 15+ late per airline", PUN, "warn", { by: (f: any) => alName(f), filt: late, note: "15+ minutes late (actual or estimated)." }),
  T("csv", "Download board as CSV", "Spreadsheet of this board", TL, "doc", p => <CsvDl {...p} />),
  T("ics", "Add next departures to calendar", "Download .ics of the next 10", TL, "clock", p => <IcsDl {...p} />),
];
void Csv;
import { useAB, Shell, G } from "./v28";
function dlFile(name: string, type: string, body: string) { const u = URL.createObjectURL(new Blob([body], { type })); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
function CsvDl({ apt }: any) { const s = useAB(apt, "dep"); return <Shell {...s}><G b={s.b}>{d => { const rows = [["flight", "airline", "place", "scheduled", "estimated", "actual", "terminal", "gate", "status", "delay_min"], ...d.flights.map((f: any) => [f.number, alName(f), oth(f, s.dir)?.city || "", S(f, s.dir).scheduled || "", S(f, s.dir).estimated || "", S(f, s.dir).actual || "", S(f, s.dir).terminal || "", S(f, s.dir).gate || "", f.statusText || f.status || "", dl(f, s.dir) ?? ""])]; const body = rows.map(r => r.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
  return <><button className="btn primary wide" onClick={() => dlFile(`${d.airport?.iata || apt}-${s.dir}.csv`, "text/csv", body)}>Download {d.flights.length} rows</button><Note>Exactly what the board shows; times in UTC ISO format.</Note></>; }}</G></Shell>; }
function IcsDl({ apt }: any) { const s = useAB(apt, "dep"); return <Shell {...s}><G b={s.b}>{d => { const now = Date.now(); const L = d.flights.filter((f: any) => up(f, "dep", now) && !isCx(f)).sort((a: any, b: any) => byT(a, b, "dep")).slice(0, 10); const z = (x: string) => new Date(x).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Skyline//EN", ...L.flatMap((f: any) => ["BEGIN:VEVENT", `UID:${f.id}@skyline`, `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(tT(f, "dep"))}`, `DTEND:${z(new Date(ms(tT(f, "dep")) + 18e5).toISOString())}`, `SUMMARY:${f.number} to ${oth(f, "dep")?.city || ""}`, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
  return <>{L.map((f: any) => <div key={f.id} className="lab-row"><b className="mono">{f.number}</b><span className="grow">{oth(f, "dep")?.city}</span><b>{hm(tT(f, "dep"), d.tz)}</b></div>)}<button className="btn primary wide" disabled={!L.length} onClick={() => dlFile("skyline-departures.ics", "text/calendar", body)}>Download .ics</button></>; }}</G></Shell>; }
export const LABS5 = [...AI5, ...TOOLS5];
