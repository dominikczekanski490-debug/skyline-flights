// Loads /api/board for all Central Europe airports, both directions, and prints a per-airport table plus summary.
const BASE = process.argv[2] || "http://localhost:8787";
const get = async (u, ms = 45000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(BASE + u, { signal: c.signal }); return { code: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { code: 0, j: { error: e.name === "AbortError" ? "timeout" : e.message } }; } finally { clearTimeout(t); } };
const kind = j => j.error ? "error" : j.sourceKind || (j.flights?.length && j.flights.every(f => f.liveOnly || f.observed) ? "observed" : j.source ? "schedule" : "?");
(async () => {
  const { j } = await get("/api/uk?region=ce"); const aps = j.airports || []; const rows = []; let i = 0;
  const work = async () => { while (i < aps.length) { const a = aps[i++]; for (const d of ["dep", "arr"]) { const t0 = Date.now(); const r = await get(`/api/board/${a.iata}?dir=${d}`); const f = r.j.flights || [];
    const has = k => f.filter(x => (d === "dep" ? x.dep : x.arr)?.[k]).length;
    rows.push({ ap: a.iata, cc: a.country, d, code: r.code, kind: kind(r.j), rows: f.length, term: has("terminal"), gate: has(d === "dep" ? "gate" : "baggage"), ms: Date.now() - t0, err: r.j.error || "", src: (r.j.source || "").slice(0, 40) }); } } };
  await Promise.all(Array.from({ length: 4 }, work));
  rows.sort((a, b) => a.ap < b.ap ? -1 : a.ap > b.ap ? 1 : a.d < b.d ? 1 : -1);
  for (const r of rows) console.log(`${r.ap.padEnd(4)} ${r.d} ${String(r.code).padEnd(4)}${r.kind.padEnd(11)}${String(r.rows).padStart(4)} rows  term ${String(r.term).padStart(3)}  ${r.d === "dep" ? "gate" : "belt"} ${String(r.gate).padStart(3)}  ${String(r.ms).padStart(6)}ms  ${r.src}${r.err ? "  ERR " + r.err : ""}`);
  const by = {}; for (const r of rows) by[r.kind] = (by[r.kind] || 0) + 1;
  console.log("\nairports:", aps.length, " requests:", rows.length, " by source type (per request):", JSON.stringify(by));
  const zero = rows.filter(r => !r.rows).map(r => r.ap + "/" + r.d); console.log("0 rows (" + zero.length + "):", zero.join(" "));
  const err = rows.filter(r => r.code !== 200); console.log("errors (" + err.length + "):", err.map(r => `${r.ap}/${r.d} ${r.code} ${r.err}`).join("; "));
  console.log("max rows:", Math.max(...rows.map(r => r.rows)));
  process.exit(err.length ? 1 : 0);
})();
