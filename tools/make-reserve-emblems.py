"""Draws the reserve emblems in img/reserves/ (one SVG per reserve slug).

Usage:  python3 tools/make-reserve-emblems.py
Original artwork: a round badge with a small landscape for each reserve. Not the game's own logos.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'reserves')


def tree(x, y, h, c):  # spruce
    w = h * .42
    return (f'<path d="M{x} {y-h}L{x+w} {y-h*.35}H{x+w*.45}L{x+w*.8} {y}H{x-w*.8}L{x-w*.45} {y-h*.35}H{x-w}Z" fill="{c}"/>'
            f'<rect x="{x-1.2}" y="{y}" width="2.4" height="{h*.12}" fill="{c}"/>')


def peaks(pts, c, snow=None):
    d = 'M' + ' L'.join(f'{x} {y}' for x, y in pts) + ' L96 96 L0 96Z'
    s = f'<path d="{d}" fill="{c}"/>'
    if snow:
        for (x0, y0), (x, y), (x1, y1) in zip(pts, pts[1:], pts[2:]):
            if y < y0 and y < y1 and y < 50:
                s += f'<path d="M{x} {y}L{x-(x-x0)*.3} {y+(y0-y)*.3}L{x} {y+4}L{x+(x1-x)*.3} {y+(y1-y)*.3}Z" fill="{snow}"/>'
    return s


def hills(y, amp, c, phase=0):
    return f'<path d="M0 {y} C24 {y-amp+phase} 40 {y-amp} 60 {y-amp*.4} S86 {y-amp*.9} 96 {y-amp*.6} V96 H0Z" fill="{c}"/>'


def water(y, c, c2):
    return f'<rect x="0" y="{y}" width="96" height="{96-y}" fill="{c}"/>' + ''.join(
        f'<path d="M{x} {y+6+i*6}h{l}" stroke="{c2}" stroke-width="1.6" stroke-linecap="round"/>' for i, (x, l) in enumerate([(20, 18), (52, 22), (30, 14)]))


def sun(x, y, r, c):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'


def aurora(c1, c2):
    return (f'<path d="M-4 30 C20 10 40 34 60 16 S90 20 100 8" stroke="{c1}" stroke-width="7" fill="none" opacity=".75" stroke-linecap="round"/>'
            f'<path d="M-4 40 C24 24 44 42 66 28 S92 30 100 22" stroke="{c2}" stroke-width="4" fill="none" opacity=".6" stroke-linecap="round"/>')


def acacia(x, y, c):
    return (f'<path d="M{x} {y}V{y-18}M{x} {y-12}l-7 -8M{x} {y-12}l7 -9" stroke="{c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
            f'<ellipse cx="{x}" cy="{y-22}" rx="18" ry="5" fill="{c}"/>')


def cactus(x, y, c):
    return (f'<path d="M{x} {y}V{y-22}M{x} {y-10}h-6v-7M{x} {y-14}h6v-6" stroke="{c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')


def leaf(x, y, s, c):  # maple-ish leaf
    return (f'<path transform="translate({x} {y}) scale({s})" d="M0 -12 L3 -6 L8 -8 L6 -2 L11 0 L5 3 L6 8 L1 5 L0 11 L-1 5 L-6 8 L-5 3 L-11 0 L-6 -2 L-8 -8 L-3 -6Z" fill="{c}"/>')


def fern(x, y, c):
    s = f'<path d="M{x} {y} Q{x+2} {y-18} {x+12} {y-28}" stroke="{c}" stroke-width="1.8" fill="none"/>'
    for i in range(7):
        t = i / 7
        px, py = x + 12 * t * t + 1, y - 28 * t
        s += f'<path d="M{px} {py} q-7 -2 -9 -7 M{px} {py} q7 -5 9 -3" stroke="{c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
    return s


def cypress(x, y, c):
    return (f'<path d="M{x} {y}V{y-26}" stroke="{c}" stroke-width="3"/><path d="M{x-4} {y} l4 -6 l4 6Z" fill="{c}"/>'
            f'<ellipse cx="{x}" cy="{y-24}" rx="9" ry="6" fill="{c}"/><ellipse cx="{x-5}" cy="{y-18}" rx="6" ry="4" fill="{c}"/><ellipse cx="{x+6}" cy="{y-17}" rx="6" ry="4" fill="{c}"/>')


def lighthouse(x, y, c, light):
    return (f'<path d="M{x-4} {y}L{x-2.5} {y-24}H{x+2.5}L{x+4} {y}Z" fill="{c}"/><rect x="{x-3}" y="{y-29}" width="6" height="5" fill="{light}"/>'
            f'<path d="M{x-4} {y-29}L{x} {y-33}L{x+4} {y-29}Z" fill="{c}"/><path d="M{x-3} {y-16}h6M{x-2.5} {y-8}h5" stroke="{light}" stroke-width="2"/>')


def stone(x, y, c):
    return f'<path d="M{x-4} {y}L{x-3} {y-16}Q{x} {y-19} {x+3} {y-15}L{x+4} {y}Z" fill="{c}"/>'


def flags(y, cs):
    s = f'<path d="M6 {y} Q48 {y+10} 90 {y-2}" stroke="#fff6" stroke-width=".8" fill="none"/>'
    for i, c in enumerate(cs * 3):
        x = 12 + i * 5.3
        yy = y + 10 * (1 - ((x - 48) / 42) ** 2) * .5 + (-2 * (x / 96))
        s += f'<rect x="{x}" y="{yy}" width="3.6" height="4.4" fill="{c}"/>'
    return s


def terraces(c, c2):
    return ''.join(f'<path d="M0 {60+i*8} Q48 {52+i*8} 96 {62+i*8} V96 H0Z" fill="{c if i % 2 else c2}"/>' for i in range(5))


def sky(top, bottom):
    return top, bottom


DESIGNS = {
    'hirschfelden': (('#7fb7d9', '#d8ecf3'), '#3f6b3a', lambda: hills(70, 14, '#6f9a4a') + hills(80, 10, '#4e7a3c') + tree(22, 70, 22, '#244a2a') + tree(32, 74, 17, '#2e5a32') + tree(74, 72, 20, '#244a2a') + hills(92, 6, '#3c6532')),
    'layton': (('#5b8fc4', '#bcd6e8'), '#2d5f8a', lambda: peaks([(0, 60), (22, 34), (40, 52), (60, 28), (82, 50), (96, 44)], '#4a6a7f', '#eef4f7') + water(66, '#3f7fb0', '#a8d0ec') + tree(12, 70, 22, '#1d3f2d') + tree(84, 68, 24, '#1d3f2d')),
    'medved': (('#9fc4dc', '#e8f2f7'), '#5c7d93', lambda: peaks([(0, 56), (30, 26), (52, 46), (70, 34), (96, 52)], '#7d93a6', '#ffffff') + hills(82, 8, '#dfe9ee') + ''.join(tree(x, 84, h, '#2a4638') for x, h in [(10, 20), (20, 26), (32, 18), (66, 22), (78, 28), (90, 19)])),
    'vurhonga': (('#e8743b', '#f6c76a'), '#b5541f', lambda: sun(62, 50, 15, '#ffe2a1') + hills(74, 6, '#b0682e') + acacia(36, 74, '#3a2414') + f'<rect x="0" y="74" width="96" height="22" fill="#8a4d22"/>'),
    'parque': (('#8d6fb7', '#e3c3c9'), '#5e4a86', lambda: peaks([(0, 62), (18, 44), (34, 56), (54, 22), (60, 26), (76, 50), (96, 40)], '#5d5a7a', '#f3eef8') + f'<path d="M54 22l-2 -8M57 22l1 -9" stroke="#bbb" stroke-width="2" opacity=".7"/>' + hills(84, 10, '#a68b5c') + water(88, '#5d83b5', '#a9c4e6')),
    'yukon': (('#0e2a3a', '#2a5a6a'), '#16424f', lambda: aurora('#3fe0a0', '#7bd1ff') + peaks([(0, 58), (26, 38), (44, 52), (66, 30), (96, 54)], '#40606f', '#e8f1f4') + f'<path d="M10 96 Q40 72 56 74 T96 66 V96Z" fill="#9fc6d8"/>' + tree(16, 78, 18, '#0d2420') + tree(84, 76, 20, '#0d2420')),
    'cuatro': (('#e9b54c', '#f7e1a6'), '#b07a1c', lambda: sun(70, 28, 10, '#fff4cf') + hills(60, 10, '#c48f3e') + hills(70, 12, '#a7792e') + hills(80, 10, '#8b6a2a') + hills(90, 8, '#6f5622') + f'<circle cx="26" cy="64" r="5" fill="#5e6b2b"/><circle cx="34" cy="66" r="4" fill="#5e6b2b"/>'),
    'srp': (('#8aa2b8', '#dfe6ec'), '#56687a', lambda: peaks([(0, 64), (14, 40), (24, 50), (40, 18), (56, 44), (70, 30), (86, 48), (96, 42)], '#7f8c97', '#ffffff') + peaks([(0, 76), (30, 62), (60, 74), (96, 60)], '#4d5c68') + tree(70, 88, 18, '#22352c') + tree(80, 90, 14, '#22352c')),
    'awaroa': (('#69a8a0', '#cfe6df'), '#2e6b55', lambda: peaks([(0, 52), (28, 30), (46, 46), (70, 24), (96, 46)], '#5c7f78', '#f4fbf8') + hills(76, 12, '#3f7a52') + fern(30, 94, '#a5d97b') + fern(60, 96, '#88c264')),
    'rancho': (('#e36a3a', '#f4b46a'), '#a8431f', lambda: sun(24, 34, 9, '#ffe0a8') + f'<path d="M40 56H80L84 64H36Z" fill="#a1462a"/><path d="M36 64H96V96H0V70Z" fill="#c26a3c"/>' + cactus(22, 86, '#3f6b3a') + cactus(70, 90, '#355d33')),
    'mississippi': (('#90a86a', '#dfe7bf'), '#56702f', lambda: water(70, '#5f7a4a', '#a2b98a') + cypress(24, 72, '#3d4f24') + cypress(66, 70, '#344420') + f'<path d="M80 70v-10M84 70v-8" stroke="#6c5b2c" stroke-width="1.6"/><ellipse cx="80" cy="59" rx="1.6" ry="4" fill="#5a3b1a"/>'),
    'revontuli': (('#10213f', '#284a6c'), '#1c3557', lambda: aurora('#5df0b4', '#c98cff') + water(64, '#1d3f63', '#5f8fbf') + f'<path d="M0 64 Q30 56 52 64 Z" fill="#2c3d33"/>' + ''.join(f'<path d="M{x} 64V{64-h}" stroke="#e9eef0" stroke-width="2"/><ellipse cx="{x}" cy="{64-h}" rx="5" ry="7" fill="#d9a441"/>' for x, h in [(12, 16), (22, 20), (34, 14)])),
    'newengland': (('#b8462f', '#f2c38c'), '#8f3320', lambda: peaks([(0, 50), (30, 30), (52, 46), (74, 28), (96, 46)], '#6d6f73', '#f7f4ee') + hills(74, 10, '#c4552c') + hills(84, 8, '#d98a2b') + leaf(30, 82, .9, '#e8461f') + leaf(66, 84, .7, '#f1a21d')),
    'emerald': (('#2aa58a', '#bfeedd'), '#13755e', lambda: sun(74, 26, 8, '#fff2c0') + water(62, '#1e8bb0', '#9fe0f0') + f'<path d="M0 62 Q34 50 60 70 L60 96 H0Z" fill="#c9a65c"/>' + f'<path d="M22 70 Q20 52 24 40" stroke="#e4ddd0" stroke-width="2.6" fill="none"/>' + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="9" ry="5" fill="#3f8f5a"/>' for x, y in [(18, 40), (30, 42), (24, 34)])),
    'sundarpatan': (('#e98d2c', '#fbe0b0'), '#b4601a', lambda: peaks([(0, 58), (22, 30), (34, 40), (52, 14), (70, 36), (96, 30)], '#857a86', '#ffffff') + flags(58, ['#2d6cdf', '#ffffff', '#d83a2e', '#2f9a4a', '#f2c230']) + hills(84, 10, '#5d7a3a')),
    'salzwiesen': (('#6ab0d6', '#d6eef7'), '#2f7aa6', lambda: water(60, '#4f95bf', '#bfe2f2') + f'<path d="M0 70 Q40 62 96 72 V96 H0Z" fill="#8fae5a"/>' + lighthouse(70, 70, '#f5f5f5', '#d8392b') + ''.join(f'<path d="M{x} 92 q-2 -10 -5 -16 M{x} 92 q1 -10 4 -16" stroke="#5c7a2c" stroke-width="1.4" fill="none"/>' for x in (14, 24, 36))),
    'askiy': (('#5f87a8', '#cfdde8'), '#3b5f7a', lambda: peaks([(0, 46), (24, 26), (40, 42), (62, 20), (80, 38), (96, 34)], '#6e7c86', '#f6f9fb') + f'<path d="M0 70 Q48 60 96 70 V96 H0Z" fill="#c9b36a"/>' + tree(16, 72, 26, '#1f3a2c') + tree(28, 74, 20, '#244232')),
    'torr': (('#7d6a9a', '#d9cfe2'), '#5a4878', lambda: hills(58, 16, '#6e7e5c') + water(68, '#44607a', '#9db6cc') + hills(84, 10, '#8a5f8f') + stone(66, 82, '#9a9a96') + stone(76, 84, '#86868a')),
    'intisuyu': (('#d8572a', '#f6c35c'), '#9c3618', lambda: sun(48, 30, 12, '#ffe08a') + ''.join(f'<path d="M48 30 L{48+20*c} {30+20*s}" stroke="#ffe08a" stroke-width="2"/>' for c, s in [(1, 0), (-1, 0), (.7, -.7), (-.7, -.7), (0, -1)]) + terraces('#6f8a3a', '#86a145')),
}


def emblem(slug):
    (top, bottom), ring, scene = DESIGNS[slug]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">'
            f'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>'
            f'<clipPath id="c"><circle cx="48" cy="48" r="42"/></clipPath></defs>'
            f'<circle cx="48" cy="48" r="47" fill="{ring}"/><circle cx="48" cy="48" r="44.5" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.2"/>'
            f'<g clip-path="url(#c)"><rect width="96" height="96" fill="url(#s)"/>{scene()}</g></svg>\n')


def main():
    os.makedirs(OUT, exist_ok=True)
    reserves = json.load(open(os.path.join(ROOT, 'research', 'reserves.json'), encoding='utf-8'))['reserves']
    for r in reserves:
        slug = r['slug']
        if slug not in DESIGNS:
            print('  no emblem design for', r['name'], slug)
            continue
        with open(os.path.join(OUT, slug + '.svg'), 'w', encoding='utf-8') as f:
            f.write(emblem(slug))
    print('  wrote', len(os.listdir(OUT)), 'emblems')


if __name__ == '__main__':
    main()
