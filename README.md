# Skyline — free Flighty-style flight tracker PWA
Run: cd server && node server.js (serves web/dist on :8787). Build UI: cd web && npm run build. Dev: npm run dev (proxies /api).
Optional keys (Settings screen or env): AERODATABOX_KEY (RapidAPI free tier: global flights, inbound chain), LLM_API_KEY/LLM_BASE_URL/LLM_MODEL (AI explanation), SKYLINE_ADMIN (protect settings).
See PREDICTION.md for the delay model.
