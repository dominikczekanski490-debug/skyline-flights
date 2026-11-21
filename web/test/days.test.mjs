// v43: day-picker range (today −3 … +3) and the status-dot rule (feed phases first, then delay colours).
import { build } from "rolldown"; import fs from "fs"; import assert from "assert"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, ".days-bundle.mjs");
await build({ input: path.join(here, "../src/days.ts"), platform: "node", logLevel: "silent", output: { file: out, format: "esm", codeSplitting: false }, write: true });
const m = await import(pathToFileURL(out).href); fs.unlinkSync(out);
const R = m.dayRange("2026-11-21");
assert.strictEqual(R.length, 7); assert.deepStrictEqual(R.map(c => c.ymd), ["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
assert.deepStrictEqual(R.map(c => c.label), ["Wed 18", "Thu 19", "Fri 20", "Today", "Sun 22", "Mon 23", "Tue 24"]);
assert.strictEqual(R[2].sub, "Yesterday"); assert.strictEqual(R[4].sub, "Tomorrow");
// month / year / DST boundaries
assert.deepStrictEqual(m.dayRange("2026-03-01").map(c => c.ymd).slice(0, 3), ["2026-02-26", "2026-02-27", "2026-02-28"]);
assert.deepStrictEqual(m.dayRange("2026-12-30").map(c => c.ymd).slice(-2), ["2027-01-01", "2027-01-02"]);
assert.strictEqual(m.addDays("2026-03-29", 1), "2026-03-30"); assert.strictEqual(m.addDays("2026-10-25", -1), "2026-10-24");
assert.strictEqual(m.clampDay("2026-11-24", "2026-11-21"), "2026-11-24"); assert.strictEqual(m.clampDay("2026-11-25", "2026-11-21"), "2026-11-21"); assert.strictEqual(m.clampDay("2026-11-17", "2026-11-21"), "2026-11-21"); assert.strictEqual(m.clampDay("junk", "2026-11-21"), "2026-11-21"); assert.strictEqual(m.clampDay(undefined, "2026-11-21"), "2026-11-21");
// dots
const t = n => new Date(Date.parse("2026-11-21T12:00:00Z") + n * 6e4).toISOString();
const F = (late, x = {}) => ({ status: "scheduled", statusText: "", dep: { scheduled: t(0), ...(late == null ? {} : { estimated: t(late) }) }, arr: {}, ...x });
assert.strictEqual(m.dotOf(F(0, { statusText: "Check-in open" }), "dep"), "ci");
assert.strictEqual(m.dotOf(F(30, { statusText: "Boarding", status: "boarding" }), "dep"), "bd", "phase beats delay");
assert.strictEqual(m.dotOf(F(0, { statusText: "Final call" }), "dep"), "fc"); assert.strictEqual(m.dotOf(F(0, { statusText: "Last call" }), "dep"), "fc");
assert.strictEqual(m.dotOf(F(50, { status: "departed", statusText: "Departed 12:50" }), "dep"), "dp");
assert.strictEqual(m.dotOf(F(50, { status: "departed", statusText: "Probably departed (est.)", staleInferred: true }), "dep"), "r", "inferred status never gets a phase colour");
assert.strictEqual(m.dotOf(F(0, { status: "cancelled", statusText: "Cancelled" }), "dep"), "r");
assert.strictEqual(m.dotOf(F(10), "dep"), "g"); assert.strictEqual(m.dotOf(F(20), "dep"), "y"); assert.strictEqual(m.dotOf(F(45), "dep"), "r"); assert.strictEqual(m.dotOf(F(null), "dep"), "g0");
assert.strictEqual(m.dotOf({ status: "scheduled", statusText: "Boarding", dep: {}, arr: { scheduled: t(0), estimated: t(20) } }, "arr"), "y", "arrivals use delay colours only");
console.log("days ok");
