// Regression: "departed"/"landed" must never be stated without evidence (false 'Departed' push, Oct 2026).
import { depEvidence, arrEvidence, liveFits } from "../server/evidence.js";
const now = Date.parse("2026-10-27T15:30:00Z");
const LCA = { iata: "LCA", lat: 34.875, lon: 33.625 }, STN = { iata: "STN", lat: 51.885, lon: 0.235 };
const f = (x = {}) => ({ origin: LCA, destination: STN, dep: { scheduled: "2026-10-27T14:55:00Z" }, arr: { scheduled: "2026-10-27T19:55:00Z" }, status: "departed", ...x });
let bad = 0; const t = (name, got, want) => { const ok = got === want; if (!ok) bad++; console.log((ok ? "ok   " : "FAIL ") + name + " → " + got); };
t("feed says Departed, no actual, no ADS-B", depEvidence(f(), null, now), null);
t("time passed only (stale inference)", depEvidence(f({ staleInferred: true, dep: { scheduled: "2026-10-27T14:00:00Z", actual: "2026-10-27T14:00:00Z" } }), null, now), null);
t("feed actual in the future", depEvidence(f({ dep: { scheduled: "2026-10-27T14:55:00Z", actual: "2026-10-27T16:00:00Z" } }), null, now), null);
t("feed actual take-off time", depEvidence(f({ dep: { scheduled: "2026-10-27T14:55:00Z", actual: "2026-10-27T15:10:00Z" } }), null, now), "feed");
t("same callsign far off route (other leg)", depEvidence(f(), { lat: 40.4, lon: -3.7, alt: 36000, gs: 450, track: 30, seen: 3 }, now), null);
t("aircraft still on stand at LCA", depEvidence(f(), { lat: 34.875, lon: 33.62, alt: "ground", gs: 0, seen: 3 }, now), null);
t("stale ADS-B position", depEvidence(f(), { lat: 35.3, lon: 32.9, alt: 12000, gs: 320, track: 300, seen: 900 }, now), null);
t("matched aircraft climbing out on track", depEvidence(f(), { lat: 35.3, lon: 32.9, alt: 12000, gs: 320, track: 300, seen: 3 }, now), "adsb");
t("contact before departure window", liveFits(f({ dep: { scheduled: "2026-10-27T18:00:00Z" } }), { lat: 35.3, lon: 32.9, alt: 12000, gs: 320, track: 300, seen: 3 }, now).ok, false);
t("landed per feed, no actual", arrEvidence(f({ status: "landed" }), null, now), null);
t("on ground at STN via ADS-B", arrEvidence(f(), { lat: 51.884, lon: 0.24, alt: "ground", gs: 10, seen: 4 }, now), "adsb");
console.log(bad ? `evidence tests: ${bad} FAILED` : "evidence tests: all passed"); process.exit(bad ? 1 : 0);
