"""Copy a folder of species photos into the app and write data/photos.json.

Usage:  python3 tools/import-photos.py /path/to/hunter-pictures

The folder holds manifest.json ({"species": {name: {image, thumb, creator, license, source, ...}}})
with full/ and thumb/ beside it. Pictures are copied to img/animals/full and img/animals/thumb.
The app shows the thumb in lists and the full picture on species pages, with the credit, and
lists every credit under Guides → Photo credits.
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    src = sys.argv[1]
    man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))['species']
    photos = {}
    for name, p in sorted(man.items()):
        if not p or not p.get('image'):
            print('  no photo:', name)
            continue
        out = {}
        for key, rel in (('u', p.get('thumb') or p['image']), ('full', p['image'])):
            dest = os.path.join('img', 'animals', rel)
            os.makedirs(os.path.join(ROOT, os.path.dirname(dest)), exist_ok=True)
            shutil.copyfile(os.path.join(src, rel), os.path.join(ROOT, dest))
            out[key] = './' + dest.replace(os.sep, '/')
        photos[name] = {**out, 'by': p.get('creator') or 'Unknown', 'lic': p.get('license') or '',
                        'licUrl': p.get('licenseUrl'), 'link': p.get('source')}
    with open(os.path.join(ROOT, 'data', 'photos.json'), 'w', encoding='utf-8') as f:
        json.dump(photos, f, ensure_ascii=False, indent=1)
    print(f'{len(photos)} species have a photo')


if __name__ == '__main__':
    main()
