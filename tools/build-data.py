"""Build the app's data files from the research JSON in research/.

Usage:  python3 tools/build-data.py

Reads (research/, see research/SCHEMA.md):
  reserves.json, species-a-m.json, species-n-z.json, needzones.json,
  great-ones.json, weapons.json, skills.json, missions.json, collectibles.json, mechanics.json,
  collectible-locations.json (joined into collectibles), callers.json
Writes (data/):
  hunter-data.js   DATA: reserves, species and need zones, loaded with the page
  great-ones.json, weapons.json, skills.json, missions.json, collectibles.json, mechanics.json
                   guide data, loaded when a guide opens (copied with the research-only
                   fields left out)

Great One status comes from great-ones.json and reserve membership from reserves.json (the species files spell some reserve names
differently). Missing research files are skipped, so the app shows "not available yet".
Stdlib only.
"""
import json, os, re, unicodedata

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
GUIDES = ['great-ones', 'weapons', 'skills', 'missions', 'collectibles', 'mechanics', 'callers']


def load(name):
    path = os.path.join(RES, name + '.json')
    if not os.path.exists(path):
        print('  skipped (not found):', name)
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def fold(s):  # 'Tòrr nan Sìthean' -> 'torr nan sithean', for matching names spelled without accents
    return ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).lower()


# Sentences about where the research came from belong in the data notes, not in text players read.
RESEARCH = re.compile(r'TacMaps|Japanese wiki|NamuWiki|slug|sitemap|machine-translated|translated from|source|Steam (forum|discussion)|'
                      r'reachable|This list has|could not be (read|fetched)|Wand|Nucta Ox|guide lists|not confirmed|unverified|'
                      r'\.json|verify in-game|Grokipedia|as given there|by meaning|'
                      r'TrueAchievements|gameplay\.tips|Steam store page|No mission list found|It lists two|GHIR|G100|guides spell|player count|'
                      r'Giver not recorded|TrueToad|A review says|rendered from|Characters named', re.I)


def player_text(text):
    """Split prose into (what players read, research notes)."""
    if not text:
        return text, None
    keep, notes = [], []
    for sent in re.split(r'(?<!\bDr\.)(?<!\bSt\.)(?<=[.!?])\s+(?=[A-Z\'"(])', text.strip()):
        (notes if RESEARCH.search(sent) else keep).append(sent)
    return (' '.join(keep) or None), (' '.join(notes) or None)


def clean_line(text):
    """Drop research remarks in brackets from a mission objective or name."""
    if not text:
        return text
    out = re.sub(r'\s*\((?:[^()]*?)(?:guide says|per the source|as listed in the source|the translation read|Japanese wiki|'
                 r'marked uncertain|wiki calls|guide lists)[^()]*\)', '', text)
    return out.replace('One more objective, unclear in the source', 'One more objective (not listed yet)').strip()


GROUP_NAMES = {  # research labels -> what players see
    'Known mission names (partial)': 'Missions',
    'Known mission names (from achievements)': 'Missions',
    'Known mission names (Kiri Taylor story, partial)': 'Kiri Taylor story',
    'Other known mission names (giver unknown)': 'Other missions',
    'Side missions (Georgy Grankin, unnamed)': 'Side missions: Georgy Grankin',
    'Side missions: Bronze Age caves (Dr. Columbus Neidell, attributed)': 'Side missions: Bronze Age caves',
}


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

    def canon(key):  # 'Te Awaroa' -> 'Te Awaroa National Park', 'Tòrr nan Sithean' -> 'Tòrr nan Sìthean'
        k = fold(key).replace(' nepal', '')
        return next((n for n in names if fold(n) == k or fold(n).replace(' nepal', '').startswith(k)
                     or k.startswith(fold(n).replace(' nepal', '')) or k in fold(n)), key)

    for g in GUIDES:
        d = load(g)
        if d is None:
            continue
        if g == 'weapons':  # weapons say "420gr Broadhead Arrow", the ammo list "420gr Broadhead Arrow/Bolt"
            ammo = {a['name'] for a in d.get('ammo', [])}
            for w in d.get('weapons', []):
                w['ammo'] = [next((n for n in ammo if '/' in n and a.rsplit(' ', 1)[0] == n.rsplit(' ', 1)[0]), a)
                             if a not in ammo else a for a in w.get('ammo') or []]
        if g == 'great-ones':
            for x in d.get('greatOnes', []):
                x['reserves'] = [canon(r) for r in x.get('reserves') or []]
        if g == 'weapons':
            for w in d.get('weapons', []):
                w['ammo'] = [re.sub(r'\s*\(types not verified\)', '', a) for a in w.get('ammo') or []]
            for a in d.get('ammo', []):  # no class range of its own: use the only rifle that fires it
                if a.get('classMin') is None:
                    ws = [w for w in d.get('weapons', []) if a['name'] in (w.get('ammo') or []) and w.get('classRange')]
                    if len(ws) == 1:
                        a['classMin'], a['classMax'] = ws[0]['classRange']
                        a['notes'] = (a.get('notes') or '') + 'Class range taken from the ' + ws[0]['name'] + '.'
        if g == 'collectibles':  # where each item is (research/collectible-locations.json)
            loc = load('collectible-locations') or {}
            for k, groups in d.items():
                spots = (loc.get(k) or loc.get(canon(k))) if isinstance(groups, list) else None
                if not isinstance(spots, dict):
                    continue
                for grp in groups:
                    w = spots.get('__group__' + (grp.get('type') or ''))
                    if w:
                        grp['where'] = clean_line(re.sub(r'\s*\(per [^)]*\)', '', w['where']))
                    items = []
                    for it in grp.get('items') or []:
                        it = dict(it) if isinstance(it, dict) else {'name': it}
                        w = spots.get(it['name'])
                        if w and w.get('where'):
                            it['where'] = clean_line(re.sub(r'\s*\(per [^)]*\)', '', w['where']))
                            it['coords'] = w.get('coords')
                        items.append(it)
                    grp['items'] = items
            d.setdefault('sources', []).extend(s for s in loc.get('sources') or [] if s not in d['sources'])
        if g in ('missions', 'collectibles'):
            for k, groups in d.items():
                if not isinstance(groups, list):
                    continue
                n = 0
                for grp in groups:
                    if grp.get('type') == 'Overview':
                        grp['type'] = 'Missions' if grp.get('missions') else 'About this reserve'
                    grp['type'] = GROUP_NAMES.get(grp.get('type'), grp.get('type'))
                    grp['about'], grp['dataNotes'] = player_text(grp.get('about'))
                    for m in grp.get('missions') or []:
                        # some missions have no known English name; give each a label and mark it unofficial
                        if not m.get('name'):
                            n += 1
                            m['name'] = m.get('nameTranslated') or 'Untitled mission %d' % n
                            m['unofficial'] = True
                        m['name'] = clean_line(m['name'])
                        m['desc'] = clean_line(player_text(m.get('desc'))[0])
                        m['objectives'] = [clean_line(o) for o in m.get('objectives') or [] if o != m['name']]
        if g == 'mechanics':
            def tidy(v):
                if isinstance(v, dict):
                    return {k: tidy(x) for k, x in v.items()
                            if k not in ('notes', 'verified', 'source') and x is not None and tidy(x) is not None}
                if isinstance(v, list):
                    return [tidy(x) for x in v] or None
                if isinstance(v, str):
                    return player_text(v)[0]
                return v
            d = {k: (v if k == 'sources' else tidy(v)) for k, v in d.items() if k != 'notes'}
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
