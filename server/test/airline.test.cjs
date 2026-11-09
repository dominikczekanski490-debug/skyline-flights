// Airline code resolution: ICAO-prefixed flight numbers must not fall back to an unrelated 2-letter IATA carrier (EZS→"EZ" Sun-Air bug).
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8").split("\n");
const i = src.findIndex(l => l.startsWith("const AL = {}")), j = src.findIndex(l => l.startsWith("const airlineOut"));
const csv = l => { const o = []; let c = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o.map(x => x === "\\N" ? "" : x); };
const __dir = path.join(__dirname, "..");
const AL_ = new Function("fs", "path", "__dir", "csv", src.slice(i, j + 1).join("\n") + "\nreturn { AL, AL_ICAO, airlineOut };")(fs, path, __dir, csv);
const { AL_ICAO } = AL_;
const k = src.findIndex(l => l.includes("resolve a 3-letter ICAO prefix first")); const fix = src[k + 1].trim();
const resolve = (num, alCode) => { new Function("num", "AL_ICAO", "ref", fix.replace(/alCode/g, "ref.c"))(num, AL_ICAO, (alCode = { c: alCode })); return alCode.c; };
const cases = { EZS1284: "DS", EZS1354: "DS", EZY2938: "U2", EZY2264: "U2", EJU4670: "EC", RYR123: "FR", WZZ1: "W6", EXS7: "LS", BAW1: "BA", FR9385: "FR", W62067: "W6", LS296: "LS", LO2111: "LO", G9749: "G9", U22938: "U2" };
for (const [n, want] of Object.entries(cases)) assert.strictEqual(resolve(n, n.slice(0, 2)), want, n);
// Every carrier that has a bundled logo must resolve to a real airline row with that IATA code (no orphan/mis-named logo files).
const logos = fs.readdirSync(path.join(__dirname, "../../web/public/logos")).filter(f => f.endsWith(".png")).map(f => f.replace(".png", ""));
const report = logos.map(c => `${c}\t${(AL_.AL[c] || AL_ICAO[c] || {}).name || "?"}`);
if (process.argv[2] === "--list") console.log(report.join("\n"));
console.log("airline tests ok");
