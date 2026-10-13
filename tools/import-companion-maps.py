"""Import reserve map pictures and map data from COTW Companion (GPL-3.0, Jan Stehno).

Usage:  python3 tools/import-companion-maps.py /path/to/cotw-companion
        (a clone of https://github.com/janstehno/cotw-companion; needs Pillow)

Writes:
  img/maps/<slug>.webp                 the reserve's map background, stitched from the app's zoom-3 tiles (16 x 16)
                                       and scaled to 2048 px
  img/maps/LICENSE-GPL-3.0.md          the licence the pictures are under
  research/companion-maps/<slug>.json  outposts, lookouts and hides (unnamed) and each animal's need zone areas,
                                       all as 0-1 fractions of the picture (x right, y down)
  research/companion-maps/LICENSE-GPL-3.0.md

The map backgrounds were redrawn by Jan Stehno for COTW Companion; they follow the game's terrain.
"""
import json, os, re, shutil, sys, unicodedata
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 2048
# COTW Companion folder name -> our reserve slug
SLUGS = {
    'hirschfeldenhuntingreserve': 'hirschfelden', 'laytonlakedistrict': 'layton', 'medvedtaiganationalpark': 'medved',
    'vurhongasavannareserve': 'vurhonga', 'parquefernando': 'parque', 'yukonvalley': 'yukon',
    'cuatrocolinasgamereserve': 'cuatro', 'silverridgepeaks': 'srp', 'teawaroanationalpark': 'awaroa',
    'ranchodelarroyo': 'rancho', 'mississippiacrespreserve': 'mississippi', 'revontulicoast': 'revontuli',
    'newenglandmountains': 'newengland', 'emeraldcoastaustralia': 'emerald', 'sundarpatanhuntingreserve': 'sundarpatan',
    'salzwiesenpark': 'salzwiesen', 'askiyridgehuntingpreserve': 'askiy', 'torrnansitheanhuntingestate': 'torr',
    'intisuyuhuntingreserve': 'intisuyu',
}
# same animal, named differently in that reserve
ALIAS = {('mississippi', 'Feral Pig'): 'Wild Hog', ('newengland', 'Mexican Bobcat'): 'Bobcat'}
KIND = {0: 'feed', 1: 'drink', 2: 'rest'}
# COTW Companion animal keys whose names differ from ours
RENAME = {'EURASIAN_BROWN_BEAR': 'Brown Bear', 'BLACK_BEAR': 'Black Bear', 'EUROPEAN_RABBIT': 'European Rabbit'}


def fold(s):
    return re.sub(r'[^a-z]', '', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower())


def main(src):
    ours = json.load(open(os.path.join(ROOT, 'research', 'species-a-m.json'), encoding='utf-8'))
    ours.update(json.load(open(os.path.join(ROOT, 'research', 'species-n-z.json'), encoding='utf-8')))
    names = {fold(n): n for n in ours if n != 'sources'}
    animals = json.load(open(os.path.join(src, 'assets', 'raw', 'animals.json'), encoding='utf-8'))
    by_id = {}
    for a in animals:
        key = a['NAME'].split(':', 1)[1]
        guess = RENAME.get(key) or names.get(fold(key.replace('_', ' '))) or names.get(fold(key.replace('_', ' ').replace(' DEER', '')))
        by_id[str(a['ID'])] = guess or key  # unmatched keys (e.g. CARIBOU) are resolved per reserve below
    reserves = {r['slug']: r['species'] for r in json.load(open(os.path.join(ROOT, 'research', 'reserves.json'), encoding='utf-8'))['reserves']}
    os.makedirs(os.path.join(ROOT, 'img', 'maps'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'research', 'companion-maps'), exist_ok=True)
    for folder, slug in SLUGS.items():
        tiles = os.path.join(src, 'assets', 'graphics', 'maps', folder, '3')
        t = Image.open(os.path.join(tiles, '0.webp'))
        n, w = 16, t.size[0]
        im = Image.new('RGB', (n * w, n * w))
        for i in range(n * n):
            im.paste(Image.open(os.path.join(tiles, f'{i}.webp')).convert('RGB'), ((i % n) * w, (i // n) * w))
        im.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(ROOT, 'img', 'maps', slug + '.webp'), 'WEBP', quality=72, method=6)
        raw = json.load(open(os.path.join(src, 'assets', 'raw', 'maps', folder + '.json'), encoding='utf-8'))
        zones = {}
        for aid, pts in (raw.get('3') or {}).items():
            name = by_id.get(aid, aid)
            name = ALIAS.get((slug, name), name)
            if name not in reserves[slug]:  # 'CARIBOU' -> the one caribou species that lives in this reserve
                hit = [n for n in reserves[slug] if fold(n).endswith(fold(name.replace('_', ' ')))]
                if len(hit) != 1:
                    print('  ', slug, 'cannot place animal', name, hit)
                    continue
                name = hit[0]
            zones.setdefault(name, []).extend([round(p[0], 4), round(p[1], 4), KIND.get(p[2], 'other')] for p in pts)
        out = {'source': 'https://github.com/janstehno/cotw-companion', 'license': 'GPL-3.0', 'author': 'Jan Stehno',
               'outposts': raw.get('0') or [], 'lookouts': raw.get('1') or [], 'hides': raw.get('2') or [], 'zones': zones}
        with open(os.path.join(ROOT, 'research', 'companion-maps', slug + '.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        print(f'  {slug}: {len(out["outposts"])} outposts, {len(out["lookouts"])} lookouts, {len(out["hides"])} hides, {len(zones)} animals with zones')
    for d in ('img/maps', 'research/companion-maps'):
        shutil.copy(os.path.join(src, 'LICENSE.md'), os.path.join(ROOT, d, 'LICENSE-GPL-3.0.md'))


if __name__ == '__main__':
    main(sys.argv[1])
