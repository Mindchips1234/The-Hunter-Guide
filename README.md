# The Hunter Guide 0.7.3

A fan-made, offline-ready field guide for *theHunter: Call of the Wild*, made by Vanderholst Studios. It covers all 19 reserves (up to Intisuyu, June 2026), 128 species with their classes, trophy scores, fur types and need zones, the 14 Great Ones, 74 weapons and 103 kinds of ammo, every skill and perk, and about 470 missions and the known collectibles, a real photo of almost every animal, and a log for every harvest.

This is the starting build. It is modelled on [The Angler Guide](https://github.com/Mindchips1234/The-Angler-Guide), restyled with a hunter's orange design (Barlow fonts, medal colours, need zone bars).

## Use it

- **Quick look:** open `index.html` in a browser. (The guides and offline mode need it served over http/https, see below.)
- **Install as an app:** serve the folder over HTTPS (e.g. GitHub Pages), then use *Add to Home Screen* / *Install App*. Once visited, it works offline.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## How the app is organised

Five tabs on phones (header buttons on larger screens):

| Tab | What's in it |
| --- | --- |
| **Home** | **What's moving?** (pick a reserve and the in-game time; it lists which animals are feeding, drinking or resting right then), search every species, and the reserve list |
| **Reserves** | Each reserve's facts, a **need zone planner** (a 24-hour bar for every animal, with a time slider), and a filterable animal list. Each species page has the **trophy score for every rating**, its need zone times, fur types by rarity, ammo rated for it, **callers and scents**, where else it lives and a **Log a harvest** button. Each reserve has its own emblem and a built-in **reserve map** (like the Angler Guide's): the reserve's map picture with outposts, lookouts, hunting stands, landmarks, points of interest and collectibles, each animal's **need zone hotspots** (bright when they match the planner time), **your own hotspots**, and full screen |
| **Log** | Every harvest (edit or delete any of them) with trophy score, rating (worked out from the score), fur and date; Harvests, Diamonds, Great Ones and Rare furs counters; a medal for each harvest; a collection of every species with your best rating; share any harvest as a picture |
| **Guides** | **Great Ones** (where they live, their furs, how the grind works, with a harvested tracker), **Weapons & ammo** (an ammo finder for any animal, plus every weapon and ammo type), **Skills & perks** (every skill and perk with a points planner), **Missions** and **Collectibles** (tick-off lists per reserve, with a mission search and where each collectible is) **How hunting works** (difficulty levels, trophy ratings, need zones, integrity, fur rarity) and **Credits** (every photographer and licence) |
| **Settings** | Metric/imperial, 24-hour/12-hour clock, dark/light/match-device theme, **My DLC** (hide the reserves you don't own everywhere in the app), back up and restore your progress, replay the intro |

Your log, Great Ones, missions, collectibles, skill plan and map hotspots are saved on the device only. Use **Settings → Save backup** before changing phones or clearing your browser.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and styles (dark and light themes) |
| `app.js` | The app: screens, routing, need zones, log, guides, settings |
| `data/hunter-data.js` | Reserves, species and need zones (`DATA`) |
| `data/great-ones.json`, `weapons.json`, `skills.json`, `missions.json`, `collectibles.json`, `mechanics.json` | Guide data, loaded when a guide opens |
| `img/animals/` | Animal photos: `thumb/` (320px, lists) and `full/` (800px, species pages). Credits in `data/photos.json` |
| `fonts/` | Barlow, Barlow Condensed and IBM Plex Mono (SIL Open Font License) |
| `research/` | The research the data is built from, with a source for every record (see `research/SCHEMA.md`) |
| `tools/build-data.py` | Rebuilds `data/` from `research/` |
| `img/maps/` | Reserve map pictures (2048 px WebP) from COTW Companion, GPL-3.0 (licence in the folder) |
| `tools/import-companion-maps.py` | Imports the map pictures, stands and need zone areas from a COTW Companion clone (needs Pillow) |
| `tools/build-maps.py` | Rebuilds `data/maps.json` (reserve maps) from `research/companion-maps/`, `research/map-places/` and the collectible locations, lining the named places up on each picture |
| `img/reserves/` | Reserve emblems (original artwork), drawn by `tools/make-reserve-emblems.py` |
| `tools/import-photos.py` | Copies a folder of photos (with `manifest.json`) into `img/animals/` and writes `data/photos.json` |
| `service-worker.js` | Offline support and updates |
| `manifest.webmanifest`, `icon*.png`, `apple-touch-icon.png`, `favicon*`, `img/logo*` | Install metadata, icons and the intro logo, made by `tools/make-icons.py` from the logo file |

## Rebuilding the data

Edit or replace the files in `research/`, then run `python3 tools/build-data.py` and `python3 tools/build-maps.py` (Python 3, no extra packages).

## Known gaps in this build

- **Logo:** by Serena Da Silva. The intro shows the full logo; app icons and the favicon use a crop of the scope circle because the lettering is unreadable at icon sizes.
- **Pictures:** real wildlife photos, not in-game pictures. Wild Haggis (fictional) has none. Reserve maps: Intisuyu's outposts and lookouts have no names yet. Need zone areas are community-mapped; exact zones differ between saves. 5 photos are CC BY-NC, so they must be replaced if the app is ever sold.
- **Missions:** about 470 listed. Full or nearly full for Hirschfelden, Layton Lake, Cuatro Colinas, Emerald Coast, Askiy Ridge, Intisuyu and Vurhonga (3 of its arcs). Partial for Medved-Taiga, Yukon Valley, Silver Ridge Peaks, Te Awaroa, New England, Sundarpatan and Tòrr nan Sìthean; 29 of those only have an unofficial translation of the Japanese name. None yet for Rancho del Arroyo, Mississippi Acres, Revontuli Coast or Salzwiesen. No XP or cash rewards anywhere.
- **Collectibles:** pick-ups only exist in Hirschfelden, Layton Lake, Medved-Taiga and Vurhonga (plus Parque Fernando's challenge targets); the rest list their achievements. Salzwiesen, Askiy Ridge, Tòrr nan Sìthean and Intisuyu are unconfirmed.
- **Trophy scores:** the bronze threshold is not published, so anything under silver is shown as bronze. Bird and crocodilian scores are on their own in-game scale (hundreds for many ducks); they were checked against the Steam trophy chart. The bighorn sheep maximum is blank because scoring changed in the Snowfall Update.
- **Callers:** 70 of 128 animals have a known caller or scent; the rest show none.
- **Collectibles:** all 107 named items have a location hint with map coordinates where the guide gives them (some list many spots under one name).
- **Great Ones:** how many kills it takes is player-reported, not official. Fur names are missing for the Jaguar and Taruca.
- **Skills:** effects are paraphrased from community sources and some per-level effects are missing.

## Releasing

1. Bump `V` in `service-worker.js` (e.g. `hunter-guide-v0-5`). This is what makes installed copies show the update banner.
2. Update `APP_VERSION` in `app.js` so Settings shows the right version.
3. If the icons changed, bump the `?v=` on the icon links in `index.html` and `manifest.webmanifest` so browsers (Edge especially) fetch the new ones instead of keeping their saved copy.

## Credits

Logo made by Serena Da Silva.

Data comes from community sources, listed per record in `research/` and on each page: reserve map pictures, stands and need zone areas from [COTW Companion](https://github.com/janstehno/cotw-companion) by Jan Stehno (GPL-3.0), map place names from Nucta Ox's "All Secret Locations" Steam guides, [CoTW Guide](https://cotwguide.com) (species, classes, trophy scores, reserves), [The Wild Register](https://thewildregister.com) (need zone times, from TacMaps by TicTactical), the [official site](https://callofthewild.thehunter.com) and its patch notes, Steam community guides, and others. Missions also come from TrueAchievements, TrueToad and the Japanese fan wiki (atwiki). Animal photos are by iNaturalist photographers, credited in the app under Guides → Credits. Community data may contain errors. This project is not affiliated with Expansive Worlds or the game's publishers.
