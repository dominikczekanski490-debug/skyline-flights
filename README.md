# Skyline — free Flighty-style flight tracker PWA
Run: cd server && node server.js (serves web/dist on :8787). Build UI: cd web && npm run build. Dev: npm run dev (proxies /api).
Optional keys (Settings screen or env): AERODATABOX_KEY (RapidAPI free tier: global flights, inbound chain), LLM_API_KEY/LLM_BASE_URL/LLM_MODEL (AI explanation), SKYLINE_ADMIN (protect settings).
See PREDICTION.md for the delay model.

## Worldwide coverage (v3)
| Region / airport | Real data without keys | With AeroDataBox key |
|---|---|---|
| MAN, STN, EMA | Official MAG schedules, gates, delays, cancellations, disruption index, AI predictions | same |
| Every other OpenFlights airport | **Live traffic only**: real ADS-B aircraft within 30 nm (adsb.lol → adsb.fi fallback) classified as on ground / climbing out / approaching, routes from adsbdb, weather (Open-Meteo), timezone | full schedules, delays, airport delay stats |

Boards for non-MAG airports are labelled "Live traffic only — add AeroDataBox key for schedules". Status/Disruptions cover ~105 hubs; live counts refresh in the background every 10 min (rate-limited queue, 60–90 s caches, adsbdb routes cached 24 h).

AI predictions now return ranked `factors` (icon, title, explanation, impact in minutes, severity), a `summary` and a `confidenceNote`. Every factor comes from a real input; it is still an estimate.

Deep links: `/#board=AMS`, `/#airports=disruptions`.
