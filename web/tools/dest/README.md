# Destination data builder (Clearway skin)

Heroes are 4:3, at most 1600×1200 WebP (quality 80, stepping down only for very detailed photos; ≤250 KB). See img.py for the sizing rationale (iPhone 13 `.cw-hero.big` = 390×422 CSS px at DPR 3).

1. Collect destination IATA codes from live boards into /tmp/cw/dests.json + names.json.
2. `python3 build.py [IATA...]` fetches Wikipedia/Wikidata/Commons (place accepted only if article coordinates are within 80 km of the airport), writes /tmp/cw/out.json (or test.json for named IATAs) + img/*.webp.
3. `python3 merge.py` writes web/public/dest/index.json, *.webp and ATTRIBUTION.md (never drops a bundled destination or photo when a fetch fails).
4. `python3 rebuild.py [IATA...]` then `python3 rebuild.py --apply` re-renders bundled heroes from the Commons file already in index.json (failures keep the old photo).
5. `python3 find.py IATA "search terms"...` makes a numbered contact sheet of sharp, freely licensed Commons candidates near the airport (/tmp/cw/cand).
6. `python3 override.py IATA "Commons file.jpg" [fy] [fx] [z]` swaps one hero by hand and updates index.json + ATTRIBUTION.md directly.
7. `python3 lqip.py` regenerates src/destlqip.ts; then `python3 tools/hashassets.py` from web/.
