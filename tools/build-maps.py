"""Build data/maps.json, the reserve maps, from research/.

Usage:  python3 tools/build-maps.py

Reads:
  research/companion-maps/<slug>.json   from tools/import-companion-maps.py: outposts, lookouts, hides and each animal's
                                        need zone areas as 0-1 fractions of img/maps/<slug>.webp (GPL-3.0, COTW Companion)
  research/map-places/<slug>.json       named outposts, lookouts, landmarks and points of interest with in-game X,Y,
                                        copied from Nucta Ox's Steam guides
  research/collectible-locations.json   collectibles with in-game X,Y
  research/reserves.json                reserve slugs
Writes:
  data/maps.json  {"sources": [...], "maps": {slug: {"img", "t": [a, b, c, d] or null, "places": [[type, name, u, v], ...],
                   "zones": {animal: [[u, v, kind], ...]}, "regions": [[name, u, v], ...], "source"}}}

u, v are fractions of the picture (right, down). t turns in-game X,Y into u, v (u = a*X + b, v = c*Y + d); it is fitted
by matching the guide's outposts and lookouts to the picture's (in-game Y grows southwards). Reserves without named
places (Intisuyu) get the picture's own unnamed outposts and lookouts and t = null.
Stdlib only.
"""
import json, math, os, re, statistics as st

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'research')
TYPES = ('outpost', 'range', 'lodge', 'lookout', 'landmark', 'poi', 'other')
SAME = {'High Lake': 'Highlake'}  # one region spelled two ways in the Layton guide


def load(*p):
    path = os.path.join(RES, *p)
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else None


def xy(s):
    m = re.fullmatch(r'\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*', s or '')
    return (float(m[1]), float(m[2])) if m else None


def line(xs, ys):  # least-squares y = a*x + b
    mx, my = st.mean(xs), st.mean(ys)
    a = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    return a, my - a * mx


def fit(game, pic):
    """Match in-game points to picture points (nearest neighbour, repeated) and fit u = a*x + b, v = c*y + d."""
    gx, gy = [p[0] for p in game], [p[1] for p in game]
    pu, pv = [p[0] for p in pic], [p[1] for p in pic]
    a = st.pstdev(pu) / st.pstdev(gx); b = st.mean(pu) - a * st.mean(gx)
    c = st.pstdev(pv) / st.pstdev(gy); d = st.mean(pv) - c * st.mean(gy)
    for _ in range(40):
        pairs = []
        for g in game:
            u, v = a * g[0] + b, c * g[1] + d
            n = min(pic, key=lambda q: (q[0] - u) ** 2 + (q[1] - v) ** 2)
            pairs.append((g, n, math.hypot(n[0] - u, n[1] - v)))
        med = st.median(p[2] for p in pairs)
        use = [p for p in pairs if p[2] <= max(3 * med, 0.003)]
        a, b = line([p[0][0] for p in use], [p[1][0] for p in use])
        c, d = line([p[0][1] for p in use], [p[1][1] for p in use])
    return [a, b, c, d], st.median(p[2] for p in pairs)


def main():
    reserves = load('reserves.json')['reserves']
    loc = load('collectible-locations.json') or {}
    out, sources = {}, []
    r4 = lambda v: round(v, 4)
    for r in reserves:
        slug = r['slug']
        cm, mp = load('companion-maps', slug + '.json'), load('map-places', slug + '.json')
        if not cm:
            print('  no map picture for', r['name'])
            continue
        entry = {'img': f'img/maps/{slug}.webp', 't': None, 'places': [], 'regions': [],
                 'zones': {sp: [[r4(u), r4(v), k] for u, v, k in pts] for sp, pts in sorted(cm['zones'].items())},
                 'source': mp['source'] if mp else None}
        if mp:
            t, err = fit([(p['x'], p['y']) for p in mp['places'] if p['type'] in ('outpost', 'lookout')],
                         [tuple(p) for p in cm['outposts'] + cm['lookouts']])
            entry['t'] = t
            uv = lambda x, y: [r4(t[0] * x + t[1]), r4(t[2] * y + t[3])]
            regions = {}
            for p in mp['places']:
                entry['places'].append([p['type'] if p['type'] in TYPES else 'other', p['name'], *uv(p['x'], p['y'])])
                if p.get('region'):
                    regions.setdefault(SAME.get(p['region'], p['region']), []).append(uv(p['x'], p['y']))
            entry['regions'] = [[n, r4(st.mean(q[0] for q in v)), r4(st.mean(q[1] for q in v))]
                                for n, v in sorted(regions.items()) if len(v) >= 2]
            for name, it in (loc.get(r['name']) or {}).items():
                if not isinstance(it, dict):
                    continue
                label = name.replace('__group__', '')
                c = xy(it.get('coords'))
                if c:
                    entry['places'].append(['collect', label, *uv(*c)])
                for i, sp in enumerate(it.get('spots') or []):
                    c = xy(sp.get('coords') or sp.get('target'))
                    if c:
                        entry['places'].append(['collect', f'{label} ({i + 1})', *uv(*c)])
            sources.append({'url': mp['source'], 'title': mp.get('title'), 'author': mp.get('author'), 'accessed': mp.get('accessed')})
            print(f"  {slug}: lined up to {err * 2048:.1f} px, {len(entry['places'])} places, {len(entry['zones'])} animals with zones")
        else:
            entry['places'] = [['outpost', 'Outpost', r4(u), r4(v)] for u, v in cm['outposts']] + \
                              [['lookout', 'Lookout point', r4(u), r4(v)] for u, v in cm['lookouts']]
            print(f"  {slug}: unnamed outposts and lookouts only, {len(entry['zones'])} animals with zones")
        entry['places'] += [['hide', 'Hunting stand or blind', r4(u), r4(v)] for u, v in cm['hides']]
        out[slug] = entry
    sources.insert(0, {'url': 'https://github.com/janstehno/cotw-companion', 'title': 'COTW Companion: reserve map pictures, '
                       'outposts, lookouts, hides and need zone areas (GPL-3.0)', 'author': 'Jan Stehno'})
    for s in loc.get('sources') or []:
        if s['url'] not in {x['url'] for x in sources}:
            sources.append(s)
    with open(os.path.join(ROOT, 'data', 'maps.json'), 'w', encoding='utf-8') as f:
        json.dump({'sources': sources, 'maps': out}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  maps.json: {len(out)} of {len(reserves)} reserves')


if __name__ == '__main__':
    main()
