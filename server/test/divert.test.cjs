// node server/test/divert.test.cjs — diversion parsing from official remark text (no network)
const fs = require("fs"), assert = require("assert"); const src = fs.readFileSync(__dirname + "/../server.js", "utf8");
const a = src.indexOf("const DIV_CITY"), b = src.indexOf("const mkFlight"); const AP = { KTW: { iata: "KTW", city: "Katowice" }, OSR: { iata: "OSR", city: "Ostrava" }, KRK: { iata: "KRK", city: "Krakow" } }; const PLACE = {};
const parseDivert = new Function("AP", "PLACE", src.slice(a, b) + "; return parseDivert;")(AP, PLACE);
const t = (dir, ...x) => parseDivert(dir, ...x);
assert.deepEqual([t("arr", "DIVERTED TO KATOWICE").kind, t("arr", "DIVERTED TO KATOWICE").iata], ["diverted", "KTW"]);
assert.equal(t("arr", "Diverted to ostrava").iata, "OSR"); assert.equal(t("arr", null, "PRZEKIEROWANY DO KATOWIC").iata, "KTW");
assert.deepEqual([t("dep", "Departure from katowice", "ODLOT Z KATOWIC").kind, t("dep", "DEPARTURE FROM KATOWICE").city], ["alt_departure", "Katowice"]);
assert.equal(t("dep", "ODLOT Z OSTRAWY").iata, "OSR"); assert.equal(t("arr", "DEPARTURE FROM KATOWICE"), null);
assert.equal(t("dep", "Departed"), null); assert.equal(t("arr", "Landed"), null); assert.equal(t("dep", "CHECK-IN"), null);
const u = t("arr", "DIVERTED TO NOWHEREVILLE"); assert.equal(u.iata, undefined); assert.equal(u.city, "Nowhereville");
console.log("divert tests ok");
