# The Hunter Guide 0.4

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
| **Reserves** | Each reserve's facts, a **need zone planner** (a 24-hour bar for every animal, with a time slider), and a filterable animal list. Each species page has the **trophy score for every rating**, its need zone times, fur types by rarity, integrity ammo, where else it lives and a **Log a harvest** button |
| **Log** | Your harvests with trophy score, rating (worked out from the score), fur and date; Harvests, Diamonds, Great Ones and Rare furs counters; a medal for each harvest; a collection of every species with your best rating; share any harvest as a picture |
| **Guides** | **Ammo finder**, **Great Ones** (where they live, their furs, how the grind works, with a harvested tracker), **Weapons & ammo** (an ammo finder for any animal, plus every weapon and ammo type), **Skills & perks** (every skill and perk with a points planner), **Missions** and **Collectibles** (tick-off lists per reserve) **How hunting works** (difficulty levels, trophy ratings, need zones, integrity, fur rarity) and **Credits** (every photographer and licence) |
| **Settings** | Metric/imperial, 24-hour/12-hour clock, dark/light/match-device theme, back up and restore your progress, replay the intro |

Your log, Great Ones, missions, collectibles and skill plan are saved on the device only. Use **Settings → Save backup** before changing phones or clearing your browser.

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
| `tools/import-photos.py` | Copies a folder of photos (with `manifest.json`) into `img/animals/` and writes `data/photos.json` |
| `service-worker.js` | Offline support and updates |
| `manifest.webmanifest`, `icon*.png`, `icon.svg` | Install metadata and icons (the icon is a placeholder until the real logo is in) |

## Rebuilding the data

Edit or replace the files in `research/`, then run `python3 tools/build-data.py` (Python 3, no extra packages).

## Known gaps in this build

- **Logo:** the icon is a placeholder until the real logo is in.
- **Pictures:** real wildlife photos, not in-game pictures. Wild Haggis (fictional) has none. No reserve maps yet. 5 photos are CC BY-NC, so they must be replaced if the app is ever sold.
- **Missions:** about 470 listed. Full or nearly full for Hirschfelden, Layton Lake, Cuatro Colinas, Emerald Coast, Askiy Ridge, Intisuyu and Vurhonga (3 of its arcs). Partial for Medved-Taiga, Yukon Valley, Silver Ridge Peaks, Te Awaroa, New England, Sundarpatan and Tòrr nan Sìthean; 29 of those only have an unofficial translation of the Japanese name. None yet for Rancho del Arroyo, Mississippi Acres, Revontuli Coast or Salzwiesen. No XP or cash rewards anywhere.
- **Collectibles:** pick-ups only exist in Hirschfelden, Layton Lake, Medved-Taiga and Vurhonga (plus Parque Fernando's challenge targets); the rest list their achievements. Salzwiesen, Askiy Ridge, Tòrr nan Sìthean and Intisuyu are unconfirmed.
- **Trophy scores:** the bronze threshold is not published, so anything under silver is shown as bronze. Some bird and crocodile scores look like they use different units and are flagged in the data notes.
- **Great Ones:** how many kills it takes is player-reported, not official. Fur names are missing for the Jaguar and Taruca.
- **Skills:** effects are paraphrased from community sources and some per-level effects are missing.

## Releasing

1. Bump `V` in `service-worker.js` (e.g. `hunter-guide-v0-5`). This is what makes installed copies show the update banner.
2. Update `APP_VERSION` in `app.js` so Settings shows the right version.

## Credits

Logo made by Serena Da Silva.

Data comes from community sources, listed per record in `research/` and on each page: [CoTW Guide](https://cotwguide.com) (species, classes, trophy scores, reserves), [The Wild Register](https://thewildregister.com) (need zone times, from TacMaps by TicTactical), the [official site](https://callofthewild.thehunter.com) and its patch notes, Steam community guides, and others. Missions also come from TrueAchievements, TrueToad and the Japanese fan wiki (atwiki). Animal photos are by iNaturalist photographers, credited in the app under Guides → Credits. Community data may contain errors. This project is not affiliated with Expansive Worlds or the game's publishers.
