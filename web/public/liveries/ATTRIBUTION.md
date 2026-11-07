# Livery assets & evidence (Skyline)

## Embedded files (decals painted onto amvlab A320/B737/A350 atlases at runtime)
| File | Source | Author | Licence |
|---|---|---|---|
| Ryanair_wordmark.svg/.png | https://commons.wikimedia.org/wiki/File:Ryanair_wordmark.svg | Ryanair (text logo) | Public domain (below threshold of originality); trademark |
| EasyJet_logo.svg/.png | https://commons.wikimedia.org/wiki/File:EasyJet_logo.svg | easyJet | Public domain (text logo); trademark |
| BRITISH_AIRWAYS_logo.svg/.png | https://commons.wikimedia.org/wiki/File:BRITISH_AIRWAYS_logo.svg | British Airways | Public domain (text logo); trademark |
| Jet2Logo.svg/.png | https://commons.wikimedia.org/wiki/File:Jet2Logo.svg | Jet2.com | Public domain (Commons); trademark (sha1 e111251ac02f8642c459082785e594891578add1) |
| Lufthansa_Logo_2018.svg/.png | https://commons.wikimedia.org/wiki/File:Lufthansa_Logo_2018.svg | Lufthansa | Public domain (simple geometry/text); trademark |
PNGs were rasterised from the SVGs with CairoSVG; colours re-tinted at runtime. Trademarks belong to their owners; used here only to identify the airline.

## Reference photos (looked at, NOT embedded) — scheme colours/placement
| Scheme | Photo | Author | Date | Licence |
|---|---|---|---|---|
| Ryanair | https://commons.wikimedia.org/wiki/File:Ryanair_B737-800_(EI-GXL)_@_TFS,_Jan_2019.jpg | Alan Wilson | 2019-01-18 | CC BY-SA 2.0 |
| easyJet | https://commons.wikimedia.org/wiki/File:G-UZHS_(50740344153).jpg | Alec Wilson | 2020 | CC BY-SA 2.0 |
| BA | https://commons.wikimedia.org/wiki/File:G-TTNS,_London_Heathrow,_June_27th_2025.jpg | Southsea_Matt | 2025-06-27 | CC BY 4.0 |
| Lufthansa | https://commons.wikimedia.org/wiki/File:Airbus_A320neo_D-AINF_of_Lufthansa_66.jpg | Riik@mctr | 2019-10-23 | CC BY-SA 2.0 |
| Jet2.com (G-GDFX) | https://commons.wikimedia.org/wiki/File:Jet2.com_Boeing_737-800_(G-GDFX)_@_MAN,_June_2023.jpg | Ardfern | 2023-06-21 | CC BY-SA 4.0 |
| Jet2.com (G-SUNS) | https://commons.wikimedia.org/wiki/File:G-SUNS-Jet2-EGCC.jpg | Oscaracton | 2026-05-17 | CC BY 4.0 |
| Jet2holidays (G-HLYI) | https://commons.wikimedia.org/wiki/File:G-HLYI-Jet2holidays-EGCC.jpg | Oscaracton | 2026-05-17 | CC BY 4.0 |
| Jet2holidays (G-JZBP) | https://commons.wikimedia.org/wiki/File:G-JZBP-Jet2holidays-EGCC.jpg | Oscaracton | 2026-05-17 | CC BY 4.0 |

## 3D paint (paint3d.ts + schemes3d.ts, since Nov 2026)
Paint is placed by projection: each texel of the amvlab atlas is mapped back to its 3D point, so fuselage/fin/engine paint and logos land on the real surfaces for A320, B737 and A350 (no hand-guessed UV boxes). Schemes are simplified, stylised reconstructions of the reference photos above — not exact liveries.
- Real PD logo files: Ryanair wordmark, easyJet, BRITISH AIRWAYS, Lufthansa (wordmark + crane roundel), Jet2.com (Jet2Logo.svg; also used for the 'Jet2' glyphs of Jet2holidays).
- Drawn by Skyline (approximations): Ryanair fin harp, BA fin bands (stand-in for Chatham Dockyard), Jet2holidays sunburst, 'holidays' word (system bold font), all cheatlines/sweeps.
- Jet2 sub-brand only for registrations in schemes3d.ts JET2_REG (photo-checked); other EXS = neutral grey fallback with Jet2.com logo.
- Preview route: /#livpreview=<FR|EZY|BA|LH|J2COM|J2HOL|J2>&model=<A320|B737|A350>&side=<l|r|q|s> (labelled preview, not live traffic).

## Airport signs
- LPL: red facade lettering colour from https://commons.wikimedia.org/wiki/File:Liverpool_John_Lennon_Airport_terminal_building_-_geograph.org.uk_-_6207868.jpg (2019-06-28, CC BY-SA 2.0).
- FRA: (no facade name sign drawn) https://commons.wikimedia.org/wiki/File:Frankfurt_Airport_Terminal_1_departures_entrance_(Quintin_Soloviev).png (2023-09-18, CC BY-SA 4.0) shows blue Fraport pylons with white concourse letters at the T1 kerb and no big name sign on the facade, so the made-up name sign is removed.
- CFU: the official Fraport Greece photo (https://www.fraport-greece.com/en/airport-profiles/corfu.html, new terminal) shows grey panels and blue portal blocks with no name lettering on the facade, so the made-up name sign is removed. Yellow/black Fraport wayfinding appears inside only. The photo is used as a reference only (not licensed, not embedded).
- Everything else: the airport name is a map label, not a photographed sign.

## Fraport logo
| Fraport_Logo_2019.svg/.png | https://commons.wikimedia.org/wiki/File:Fraport_Logo_2019.svg | Fraport AG | Public domain (Commons); trademark (sha1 f673301535a64061577ccc0f37579c05d101a0d7) |
It's drawn on a white rooftop panel only at Fraport-operated airports: FRA plus the 14 Fraport Greece airports. The rooftop position was the user's request. The reference photos (Fraport Greece CFU page, FRA T1 2023) show no roof logo, so this isn't a replica of a real sign.
