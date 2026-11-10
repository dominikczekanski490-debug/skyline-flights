# Destination data builder (Clearway skin)

1. Collect destination IATA codes from live boards into /tmp/cw/dests.json + names.json.
2. `python3 build.py [IATA...]` fetches Wikipedia/Wikidata/Commons (place accepted only if article coordinates are within 80 km of the airport), writes /tmp/cw/out.json + img/*.webp.
3. `python3 override.py IATA "Commons file.jpg"` swaps a photo by hand.
4. `python3 merge.py` writes web/public/dest/index.json, *.webp and ATTRIBUTION.md.
