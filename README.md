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

## v3: push, persistence, sharing, keep-warm
- **Push notifications** (Web Push/VAPID). Settings → Turn on alerts. The server checks tracked flights every 4 min and pushes gate/terminal/belt changes, delays (+10 min steps), cancellations, departed/landed. iPhone: iOS 16.4+, opened from the Home Screen icon.
- **Persistence**: your flights/friends/settings live on the phone (localStorage + `navigator.storage.persist()`), so they survive any server restart; Settings → Back up/Restore moves them between devices. The client re-sends its push subscription and watch-list on every open and re-subscribes automatically if the server's VAPID key changed.
- **Best durable server store (free)**: create a free Upstash Redis DB and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` on Render. Then VAPID keys, subscriptions and the 60-day delay history survive restarts. Alternatively set fixed `VAPID_PUBLIC`/`VAPID_PRIVATE`. Without either, the server uses `/tmp` (lost on restart/redeploy; the app recovers on next open).
- **Keep-warm**: server self-pings `RENDER_EXTERNAL_URL` every 9 min, optional GitHub Actions ping in `docs/keep-warm.yml` (copy to `.github/workflows/` via the GitHub web UI; the bot token lacks workflow scope). The PWA shell is served from the service-worker cache instantly with a "Waking up Skyline…" pill if the server is cold.
- **Share links**: `/s/<id>`. The id encodes flight+date (stateless, survives restarts); the page shows live status read-only, and "Follow in my Friends feed" adds it.
- **Smarter AI**: learns per-route and per-airport averages from recorded history; "Leave for the airport" card (estimate).
