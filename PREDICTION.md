# Skyline AI Delay Prediction (estimate, not observed data)
Server-side engine in server/server.js (`predictCore`/`predictFull`, endpoint `/api/predict/:number?date=`).
Additive weighted model -> predicted delay (minutes) + normal-ish spread -> probabilities via logistic-approx normal CDF.
Factors (each contributes minutes and a readable reason):
- Current airport-reported estimate vs schedule (strongest weight when present)
- Inbound aircraft late (AeroDataBox key only; otherwise skipped)
- Airport congestion: median delay / on-time % of last 4h of the MAG board
- Open-Meteo weather at dep/arr hour: gusts, precipitation, visibility, thunderstorms
- 60-day history for the flight number (server/history.json, collected every 30 min; starts empty)
- Time of day (late-day knock-on) and day of week
Cancel/divert probabilities use base rates scaled by weather severity and airport cancel rate.
Confidence = number/quality of available inputs (high/medium/low).
Explanation: LLM via OpenAI-compatible endpoint if LLM_API_KEY set (default base https://api.x.ai/v1), otherwise a template. Always labelled as an estimate.
