# hunter-data schema (starting build of The Hunter Guide)

Reference app: The Angler Guide (github.com/Mindchips1234/The-Angler-Guide) keeps
data as JSON keyed by reserve / item name, with prose "about" fields and plain values.
Follow the same spirit: plain JSON, UTF-8, names exactly as the game spells them.

Every file carries a top-level "sources" array of {"url","title","accessed":"2026-10-12"}
and per-record "sources" where a value came from a specific page. Use null for unknown
values; never invent numbers. Put doubts in a "notes" string.

Files
- reserves.json     [{name, slug, region, country, biome, sizeKm2, released (YYYY-MM-DD or YYYY),
                      dlc (bool), dlcName, about, species:[species names], sources}]
- species.json      {"<Species name>": {name, latin, class, difficulty, maxLevel, maxWeightKg,
                      weightRangeKg:[min,max], trophy:{bronze,silver,gold,diamond,max},
                      reserves:[...], furs:[{name, rarity}], greatOne (bool),
                      integrityAmmo:[...], about, sources}}
- needzones.json    {"<Reserve>": {"<Species>": {feed:["HH:MM-HH:MM"], drink:[...], rest:[...]}}}
- great-ones.json   [{species, reserves, furs:[...], howToSpawn, maxScore, notes, sources}]
- weapons.json      {weapons:[{name, type, action, dlc, ammo:[...], magazine, about}],
                     ammo:[{name, caliber, type, classMin, classMax, penetration, expansion, notes}],
                     optics:[...] (optional)}
- skills.json       {skills:{Stalker:[...],Ambusher:[...]}, perks:{Rifles:[...],Handguns:[...],
                     Shotguns:[...],Archery:[...]}}  each item {name, tree, tier, maxPoints,
                     levels:[description per point], unlock, about}
- missions.json     {"<Reserve>": [{type, about, missions:[{name, desc, objectives:[...],
                      reward:{xp, cash, items}}]}]}
- collectibles.json {"<Reserve>": [{type, about, items:[...] , count}]}
- mechanics.json    {difficultyLevels, trophyRatings, needZones, harvestCheck, integrity,
                     callers, lures, ... prose for the guide's "How it works" pages}
