"""Build data/maps.json, the reserve maps, from research/.

Usage:  python3 tools/build-maps.py

Reads:
  research/map-places/<slug>.json   outposts, lookouts, landmarks and points of interest with their in-game
                                    X,Y coordinates, copied from Nucta Ox's Steam guides (one file per reserve)
  research/collectible-locations.json   collectibles with coordinates (joined in as their own layer)
  research/reserves.json            reserve names and slugs
Writes:
  data/maps.json  {"sources": [...], "maps": {slug: {"ext": [x0, y0, size], "places": [[type, name, x, y], ...],
                   "regions": [[name, x, y], ...], "source": url}}}

ext is the square the app draws: x0, y0 is the south-west corner in game units (Y grows northwards)
and size its side, worked out from the places with a margin. Reserves with no coordinate source get no entry.
Stdlib only.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'research')
TYPES = ('outpost', 'range', 'lodge', 'lookout', 'landmark', 'poi', 'other')
SAME = {'High Lake': 'Highlake'}  # one region spelled two ways in the Layton guide


def xy(s):
    m = re.fullmatch(r'\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*', s or '')
    return (round(float(m[1])), round(float(m[2]))) if m else None


def main():
    reserves = json.load(open(os.path.join(RES, 'reserves.json'), encoding='utf-8'))['reserves']
    by_name = {r['name']: r['slug'] for r in reserves}
    loc = json.load(open(os.path.join(RES, 'collectible-locations.json'), encoding='utf-8'))
    out, sources = {}, []
    for r in reserves:
        path = os.path.join(RES, 'map-places', r['slug'] + '.json')
        if not os.path.exists(path):
            print('  no places for', r['name'])
            continue
        d = json.load(open(path, encoding='utf-8'))
        places = [[p['type'] if p['type'] in TYPES else 'other', p['name'], p['x'], p['y']] for p in d['places']]
        regions = {}
        for p in d['places']:
            if p.get('region'):
                regions.setdefault(SAME.get(p['region'], p['region']), []).append((p['x'], p['y']))
        # collectibles (single spots and lists of spots) from the collectibles research
        items = loc.get(r['name']) or {}
        for name, it in items.items():
            if not isinstance(it, dict):
                continue
            label = name.replace('__group__', '')
            c = xy(it.get('coords'))
            if c:
                places.append(['collect', label, *c])
            for i, sp in enumerate(it.get('spots') or []):
                c = xy(sp.get('coords') or sp.get('target'))
                if c:
                    places.append(['collect', f"{label} ({i + 1})", *c])
        xs, ys = [p[2] for p in places], [p[3] for p in places]
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        size = round(max(span * 1.12, 3000) / 100) * 100
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        out[r['slug']] = {
            'ext': [round(cx - size / 2), round(cy - size / 2), size],
            'places': places,
            'regions': [[n, round(sum(x for x, _ in v) / len(v)), round(sum(y for _, y in v) / len(v))]
                        for n, v in sorted(regions.items()) if len(v) >= 2],
            'source': d['source'],
        }
        sources.append({'url': d['source'], 'title': d.get('title'), 'author': d.get('author'), 'accessed': d.get('accessed')})
        print(f"  {r['slug']}: {len(places)} places, {size} m square")
    for s in loc.get('sources') or []:
        if s['url'] not in {x['url'] for x in sources}:
            sources.append(s)
    with open(os.path.join(ROOT, 'data', 'maps.json'), 'w', encoding='utf-8') as f:
        json.dump({'sources': sources, 'maps': out}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  maps.json: {len(out)} of {len(reserves)} reserves')


if __name__ == '__main__':
    main()
