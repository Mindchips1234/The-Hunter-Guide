"""Build the app's data files from the research JSON in research/.

Usage:  python3 tools/build-data.py

Reads (research/, see research/SCHEMA.md):
  reserves.json, species-a-m.json, species-n-z.json, needzones.json,
  great-ones.json, weapons.json, skills.json, missions.json, collectibles.json, mechanics.json
Writes (data/):
  hunter-data.js   DATA: reserves, species and need zones, loaded with the page
  great-ones.json, weapons.json, skills.json, missions.json, collectibles.json, mechanics.json
                   guide data, loaded when a guide opens (copied with the research-only
                   fields left out)

Great One status comes from great-ones.json and reserve membership from reserves.json (the species files spell some reserve names
differently). Missing research files are skipped, so the app shows "not available yet".
Stdlib only.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'research')
OUT = os.path.join(ROOT, 'data')
# iNaturalist search names where the game's latin name is missing, fictional or too broad.
PHOTO_QUERY = {
    'Blacktail Deer': 'Odocoileus hemionus columbianus', 'Eastern Wild Turkey': 'Meleagris gallopavo silvestris',
    'Rio Grande Turkey': 'Meleagris gallopavo intermedia', 'Roosevelt Elk': 'Cervus canadensis roosevelti',
    'Red Grouse': 'Lagopus lagopus scotica', 'Raccoon Dog': 'Nyctereutes procyonoides', 'Javan Rusa': 'Rusa timorensis',
    'Iberian Mouflon': 'Ovis gmelini', 'Wild Haggis': None,
}
GUIDES = ['great-ones', 'weapons', 'skills', 'missions', 'collectibles', 'mechanics']


def load(name):
    path = os.path.join(RES, name + '.json')
    if not os.path.exists(path):
        print('  skipped (not found):', name)
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def first_url(rec):
    for s in rec.get('sources') or []:
        if isinstance(s, dict) and s.get('url'):
            return s['url']
    return None


def main():
    reserves = load('reserves')['reserves']
    species = {}
    for part in ('species-a-m', 'species-n-z'):
        d = load(part)
        d.pop('sources', None)
        species.update(d)
    zones = load('needzones') or {}
    go = load('great-ones')
    go_species = {g['species'] for g in go['greatOnes']} if go else None

    data = {'reserves': {}, 'species': {}, 'zones': {}}
    where = {}
    for r in reserves:
        data['reserves'][r['name']] = {
            'slug': r.get('slug'), 'region': r.get('region'), 'country': r.get('country'),
            'biome': r.get('biome'), 'released': r.get('released'), 'dlc': bool(r.get('dlc')),
            'dlcName': r.get('dlcName'), 'about': r.get('about'),
            'species': sorted(r['species']), 'source': first_url(r),
        }
        for s in r['species']:
            where.setdefault(s, []).append(r['name'])
        z = zones.get(r['name']) or {}
        data['zones'][r['name']] = {
            s: {k: v.get(k) for k in ('feed', 'drink', 'rest')} for s, v in z.items() if isinstance(v, dict)
        }

    for name, s in sorted(species.items()):
        t = s.get('trophy') or {}
        data['species'][name] = {
            'latin': s.get('latin'), 'class': s.get('class'), 'difficulty': s.get('difficulty'),
            'maxLevel': s.get('maxLevel'), 'maxWeightKg': s.get('maxWeightKg'),
            'trophy': {k: t.get(k) for k in ('silver', 'gold', 'diamond', 'max')},
            'furs': [{**f, 'rarity': 'Great One' if re.search(r'great one|fabled', f.get('name', ''), re.I) else (f.get('rarity') or '').title() or None} for f in s.get('furs') or []], 'greatOne': name in go_species if go_species is not None else bool(s.get('greatOne')),
            'ammo': s.get('integrityAmmo') or [], 'notes': s.get('notes'),
            'reserves': where.get(name, []), 'source': first_url(s),
            'photo': PHOTO_QUERY.get(name, s.get('latin')),
        }
        if name not in where:
            print('  species in no reserve:', name)

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'hunter-data.js'), 'w', encoding='utf-8') as f:
        f.write('// Reserves, species and need zones. Rebuilt by tools/build-data.py from research/.\n')
        f.write('const DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f"  hunter-data.js: {len(data['reserves'])} reserves, {len(data['species'])} species")

    names = list(data['reserves'])

    def canon(key):  # 'Te Awaroa' -> 'Te Awaroa National Park'
        return next((n for n in names if n == key or n.startswith(key) or key in n), key)

    for g in GUIDES:
        d = load(g)
        if d is None:
            continue
        if g == 'weapons':  # weapons say "420gr Broadhead Arrow", the ammo list "420gr Broadhead Arrow/Bolt"
            ammo = {a['name'] for a in d.get('ammo', [])}
            for w in d.get('weapons', []):
                w['ammo'] = [next((n for n in ammo if '/' in n and a.rsplit(' ', 1)[0] == n.rsplit(' ', 1)[0]), a)
                             if a not in ammo else a for a in w.get('ammo') or []]
        if g == 'missions':  # some missions have no known English name; give each a unique label
            for k, groups in d.items():
                if not isinstance(groups, list):
                    continue
                n = 0
                for grp in groups:
                    for m in grp.get('missions') or []:
                        if not m.get('name'):
                            n += 1
                            m['name'] = (m['nameTranslated'] + ' (unofficial translation)') if m.get('nameTranslated') \
                                else 'Unnamed mission %d' % n + (' (' + grp['type'] + ')' if grp.get('type') else '')
        if g in ('missions', 'collectibles'):
            d = {(k if k in ('sources', 'notes') else canon(k)): v for k, v in d.items()}
            odd = [k for k in d if k not in names and k not in ('sources', 'notes')]
            if odd:
                print('  unknown reserve keys in', g, odd)
        with open(os.path.join(OUT, g + '.json'), 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        print('  ' + g + '.json')


if __name__ == '__main__':
    main()
