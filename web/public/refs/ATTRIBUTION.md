# Reference photos for 3D airport glass tints / livery colours (Skyline)

**Scope:** Follow plane and OSM-based 3D work at **every** airport Skyline can load via `/api/apt3d` (any IATA with OSM data or a prebuilt cache). Photo-grounded glass tints exist only for the few IATAs below — all other airports use the same **generic** procedural glass on OSM extrusions. We do **not** claim hand-modelled worldwide coverage.

Skyline does **not** embed these photos as textures (share-alike / FoP / trademark risk).
They were used only as **visual evidence** to tune procedural glass tints and simplified airline colour schemes.
Aircraft models remain amvlab logo-free glTF (CC BY 4.0) with Skyline recolour + airline **name** text — **not** exact liveries and **not** trademark logos.

## Airports with reference-verified glass tint (3)

| Airport | File | Licence | Author | URL | Use in Skyline |
|--------|------|---------|--------|-----|----------------|
| MAN | Manchester Airport Terminal 1 06.jpg | CC BY 4.0 | Christian Alexander Tietgen | https://commons.wikimedia.org/wiki/File:Manchester_Airport_Terminal_1_06.jpg | Glass tint cue (cool blue) |
| MAN | Terminal 2, Manchester Airport, June 2016 (02).JPG | CC BY 4.0 | Ardfern | https://commons.wikimedia.org/wiki/File:Terminal_2,_Manchester_Airport,_June_2016_(02).JPG | Glass / mullion cue |
| FRA | Flughafen Frankfurt am Main.JPG | CC BY-SA 3.0 | Heidas | https://commons.wikimedia.org/wiki/File:Flughafen_Frankfurt_am_Main.JPG | Grey-blue glass cue only — **not embedded** (SA) |
| CFU | Corfu Airport Terminal.jpg | CC BY-SA 3.0 | Jean Housen | https://commons.wikimedia.org/wiki/File:Corfu_Airport_Terminal.jpg | Colour cue only — **not embedded** (Greece FoP + SA) |

All other airports: **generic** glass + OSM terminal/taxiway/apron geometry.

## Aircraft (livery colour cues — global airline codes)

| Airline | File | Licence | Author | URL | Use in Skyline |
|---------|------|---------|--------|-----|----------------|
| Ryanair | Boeing 737-8AS Ryanair Dreamliner EI-DCL.jpg | CC BY 2.0 | Curimedia | https://commons.wikimedia.org/wiki/File:Boeing_737-8AS_Ryanair_Dreamliner_EI-DCL.jpg | Navy `#073590` + yellow accent (no harp logo) |
| Ryanair | Ryanair Boeing 737-800 EI-EBX.jpg | CC BY-SA 4.0 | Michael Oldfield | https://commons.wikimedia.org/wiki/File:Ryanair_Boeing_737-800_EI-EBX.jpg | Colour check only — **not embedded** (SA) |
| easyJet | Airbus A320 G-UZLB of EasyJet 3.jpg | CC BY-SA 2.0 | Riik@mctr | https://commons.wikimedia.org/wiki/File:Airbus_A320_G-UZLB_of_EasyJet_3.jpg | Orange `#ff6600` cue — **not embedded** (SA) |
| British Airways | British Airways, G-STBF, Boeing 777-336 ER (37718754925).jpg | CC BY-SA 2.0 | (Commons) | https://commons.wikimedia.org/wiki/File:British_Airways,_G-STBF,_Boeing_777-336_ER_(37718754925).jpg | BA blue `#075aaa` / red accent cue — **not embedded** (SA) |

## Models already in-tree

- `web/public/models/*_nologo.glb` — amvlab aircraft-models, **CC BY 4.0** — see `web/public/models/LICENSE-amvlab-CC-BY-4.0.txt`

## Honest limits

- Procedural terminals / signs are OSM-derived extrusions + stylised glass, **not** surveyed architecture.
- Airline paint is a simplified colour scheme with the airline name in text; it is **not** an exact livery and does not reproduce logos.
- Follow uses live ADS-B positions only (drag cancels); no invented paths when data is lost/stale.
