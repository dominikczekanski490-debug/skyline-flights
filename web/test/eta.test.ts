import { withEstArr, statusOf, recoveryMin } from "../src/lib";
const ok = (c: any, m: string) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok", m); };
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 27, h, m)).toISOString();
// 1h32 late departure on a 2h45 scheduled block: arrival delay must be less than 92 min
const f: any = { id: "x", number: "LS1566", date: "2026-10-28", dep: { scheduled: at(10), actual: at(11, 32) }, arr: { scheduled: at(12, 45) } };
const g: any = withEstArr(f); const ad = (Date.parse(g.arr.estimated) - Date.parse(f.arr.scheduled)) / 6e4;
ok(ad < 92 && ad >= 92 - 17, `arrival delay ${ad} (dep delay 92, block 165)`); ok(/Skyline estimate/.test(g.arr.etaMethod), "labelled");
ok(withEstArr({ ...f, arr: { ...f.arr, estimated: at(13, 5) } }).arr.estimated === at(13, 5), "official estimate kept");
ok(recoveryMin(5, 165) === 5 && recoveryMin(-10, 100) === 0, "recovery capped by delay, none when early");
const noSch: any = withEstArr({ ...f, arr: { estimated: at(13, 40), etaSource: "ADS-B" }, origin: { iata: "LCA", lat: 34.87, lon: 33.62 }, destination: { iata: "STN", lat: 51.88, lon: 0.23 } });
ok(noSch.arr.estimated === at(13, 40), "ADS-B estimate kept when no published arrival");
ok(statusOf({ ...f, status: "scheduled" }).label === "Departed", "actual departure beats stale 'scheduled'");
ok(statusOf({ ...f, status: "scheduled", arr: { actual: at(12) } }).label === "Landed", "actual arrival -> Landed");
// v41 OOOI: off-block is not take-off
{ const now = Date.now(), iso = (m: number) => new Date(now + m * 6e4).toISOString();
  const ob: any = { id: "y", number: "FR555", date: "x", dep: { scheduled: iso(-30), actual: iso(-10), actualKind: "offblock" }, arr: { scheduled: iso(120) }, status: "departed" };
  ok(statusOf(ob).label === "Taxiing", "off-block 10 min ago, no airborne evidence -> Taxiing (got " + statusOf(ob).label + ")");
  ok(statusOf({ ...ob, dep: { ...ob.dep, actual: iso(-2) } }).label === "Pushback", "off-block 2 min ago -> Pushback");
  ok(statusOf({ ...ob, dep: { ...ob.dep, takeoff: iso(-1) } }).label === "Departed", "ADS-B take-off log -> Departed");
  ok(statusOf(ob, { alt: 3000, gs: 180, lat: 1, lon: 1 }).label === "En route", "live airborne >80kt -> En route");
  ok(statusOf(ob, { alt: "ground", gs: 15, onGround: true }).label === "Taxiing", "live on ground taxiing -> still Taxiing");
  ok(statusOf({ ...ob, dep: { ...ob.dep, actual: iso(-50) } }).label === "Departed (est.)", "off-block 50 min ago -> Departed (est.) labelled");
  ok(statusOf({ ...ob, status: "landed", arr: { actual: iso(-1) }, statusText: "Arrived" }).label === "Arrived", "on-block wording -> Arrived"); }
// v41 LS1755 MAN->OLB: sched 08:00Z, off-block 09:45Z, sched arr 10:29Z (block 149 min)
{ const L: any = { id: "z", number: "LS1755", date: "2026-10-28", dep: { scheduled: "2026-10-28T08:00:00Z", actual: "2026-10-28T09:45:00Z", actualKind: "offblock" }, arr: { scheduled: "2026-10-28T10:29:00Z" } };
  const g: any = withEstArr(L); console.log("  LS1755 schedule model:", g.arr.estimated, g.arr.etaMethod);
  ok(g.arr.estimated === "2026-10-28T11:59:00.000Z", "LS1755 schedule model = 11:59Z (149 block - 15 recovery cap)");
  const h: any = withEstArr({ ...L, routeBlock: { med: 140, n: 5, scope: "route" } }); ok(h.arr.estimated === "2026-10-28T12:05:00.000Z" && /route history/.test(h.arr.etaMethod), "route history (>=3) used");
  ok(withEstArr({ ...L, routeBlock: { med: 140, n: 2 } }).arr.estimated === g.arr.estimated, "<3 samples falls back to schedule"); }
