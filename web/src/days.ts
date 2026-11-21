// v43: day picker range (today −3 … today +3) and the shared status-dot rule. Pure functions (tested in test/days.test.mjs).
export const addDays = (ymd: string, n: number) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export type DayChip = { ymd: string; off: number; label: string; sub: string };
// 7 chips around `base` (the London "today" the app uses), e.g. "Wed 18", "Today", "Tue 24".
export function dayRange(base: string, back = 3, ahead = 3): DayChip[] { const out: DayChip[] = [];
  for (let o = -back; o <= ahead; o++) { const ymd = addDays(base, o); const d = new Date(ymd + "T12:00:00Z");
    const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }), dm = d.getUTCDate();
    out.push({ ymd, off: o, label: o === 0 ? "Today" : `${wd} ${dm}`, sub: o === 0 ? `${wd} ${dm}` : o === -1 ? "Yesterday" : o === 1 ? "Tomorrow" : "" }); }
  return out; }
export const inRange = (ymd: string, base: string, back = 3, ahead = 3) => ymd >= addDays(base, -back) && ymd <= addDays(base, ahead);
export const clampDay = (ymd: string | undefined | null, base: string) => ymd && /^\d{4}-\d\d-\d\d$/.test(ymd) && inRange(ymd, base) ? ymd : base;

// Status dot. Phase colours win, but only when the feed itself says so (never inferred):
//   check-in = light blue, boarding = green, final/last call = red, departed = grey.
// Otherwise delay colours: green 0–15 min late, yellow 15–45, red 45+ or cancelled; grey "g0" with no time info.
export type Dot = "ci" | "bd" | "fc" | "dp" | "g" | "y" | "r" | "g0";
const late = (t: any) => { const b = t?.actual || t?.estimated; return t?.scheduled && b ? Math.round((+new Date(b) - +new Date(t.scheduled)) / 60000) : null; };
export function phaseOf(f: any, dir: string): Dot | null { if (dir !== "dep" || f.status === "cancelled" || f.staleInferred || f.liveOnly) return null;
  const txt = `${f.statusText || ""} ${f.dep?.gateAction || ""}`;
  if (f.dep?.actual || f.status === "departed" || /\bdeparted\b|\bairborne\b|\btaxied\b/i.test(f.statusText || "")) return "dp";
  if (/final call|last call|ostatnie wezwanie/i.test(txt)) return "fc";
  if (/boarding|\bboard\b/i.test(txt) || f.status === "boarding") return "bd";
  if (/check[\s-]?in/i.test(txt)) return "ci";
  return null; }
export function dotOf(f: any, dir: string): Dot { const p = phaseOf(f, dir); if (p) return p; if (f.status === "cancelled") return "r";
  const d = late(dir === "dep" ? f.dep : f.arr); return d == null ? "g0" : d >= 45 ? "r" : d >= 15 ? "y" : "g"; }
export const DOT_LEGEND: [Dot, string][] = [["ci", "Check-in"], ["bd", "Boarding"], ["fc", "Final call"], ["dp", "Departed"], ["g", "<15 min late"], ["y", "15–45 min late"], ["r", "45+ late / cancelled"]];
