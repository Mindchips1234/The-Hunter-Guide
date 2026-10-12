"""Pick a photo for every species from iNaturalist and save it in data/photos.json.

Usage:  python3 tools/find-photos.py [--download]

Only Creative Commons photos are used, each saved with the photographer's credit, licence and
a link to the iNaturalist page. With --download the pictures are also saved to img/animals/
(as WebP if Pillow is installed) so the app has them offline from the first launch.
Species already in data/photos.json are skipped; delete an entry to look it up again.
Without this file the app looks photos up in the browser instead (see photoFor in app.js).
"""
import json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://api.inaturalist.org/v1/'
UA = {'User-Agent': 'HunterGuideApp/0.2 (fan app photo lookup)'}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def pick(p):
    if p and (p.get('license_code') or '').startswith('cc') and p.get('medium_url'):
        return {'u': p['medium_url'], 'by': p.get('attribution') or '', 'lic': p['license_code'].upper()}


def lookup(q):
    for name in dict.fromkeys([q, ' '.join(q.split()[:2])]):
        res = json.loads(get(API + 'taxa?is_active=true&per_page=5&q=' + urllib.parse.quote(name)))['results']
        t = next((x for x in res if x['name'].lower() == name.lower()), None) or next((x for x in res if 'species' in x['rank']), None)
        if not t:
            continue
        ph = pick(t.get('default_photo'))
        if not ph:
            full = json.loads(get(API + 'taxa/%d' % t['id']))['results'][0]
            ph = next((pick(tp['photo']) for tp in full.get('taxon_photos', []) if pick(tp['photo'])), None)
        if ph:
            return {**ph, 'link': 'https://www.inaturalist.org/taxa/%d' % t['id']}
        time.sleep(1)


def main():
    src = open(os.path.join(ROOT, 'data', 'hunter-data.js'), encoding='utf-8').read()
    species = json.loads(src[src.index('=') + 1:].rstrip().rstrip(';'))['species']
    out_path = os.path.join(ROOT, 'data', 'photos.json')
    photos = json.load(open(out_path, encoding='utf-8')) if os.path.exists(out_path) else {}
    for name, s in sorted(species.items()):
        if name in photos or not s.get('photo'):
            continue
        try:
            p = lookup(s['photo'])
        except Exception as e:  # keep going; the app falls back to a browser lookup
            print('  failed:', name, e)
            continue
        if p:
            photos[name] = p
            print('  ok:', name)
        else:
            print('  no CC photo:', name)
        time.sleep(1.1)  # iNaturalist asks for at most ~60 requests a minute

    if '--download' in sys.argv:
        os.makedirs(os.path.join(ROOT, 'img', 'animals'), exist_ok=True)
        try:
            from PIL import Image
        except ImportError:
            Image = None
        for name, p in photos.items():
            if not p['u'].startswith('http'):
                continue
            slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
            data = get(p['u'])
            path = os.path.join('img', 'animals', slug + ('.webp' if Image else os.path.splitext(p['u'].split('?')[0])[1]))
            if Image:
                import io
                Image.open(io.BytesIO(data)).convert('RGB').save(os.path.join(ROOT, path), 'WEBP', quality=80)
            else:
                open(os.path.join(ROOT, path), 'wb').write(data)
            p['u'] = './' + path
            time.sleep(0.5)

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(photos, f, ensure_ascii=False, indent=1)
    print(f'{len(photos)} of {len(species)} species have a photo')


if __name__ == '__main__':
    main()
