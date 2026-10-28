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
