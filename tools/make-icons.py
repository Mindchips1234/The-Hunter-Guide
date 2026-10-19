#!/usr/bin/env python3
"""Build the app icons and intro logo from Serena Da Silva's logo.

Usage: python3 tools/make-icons.py path/to/logo.jpg

The full logo (scope + "THE HUNTER GUIDE") goes in the intro as img/logo.jpg.
Home-screen icons and the favicon use a square crop of just the scope circle,
because the lettering is unreadable at icon sizes. Needs Pillow.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# Scope circle in the 1560px source: centre (782, 627), lit radius about 489.
CX, CY, HALF = 782, 627, 560


def main(src):
    im = Image.open(src).convert('RGB')
    s = im.width / 1560
    im.resize((1024, 1024), Image.LANCZOS).save(ROOT / 'img/logo.jpg', quality=86, optimize=True, progressive=True)
    scope = im.crop(tuple(round(v * s) for v in (CX - HALF, CY - HALF, CX + HALF, CY + HALF)))
    # Edge and Windows pick different sizes for tabs, new-tab shortcuts, the taskbar and Start,
    # so give them a full set rather than letting them blur up a small one.
    for name, size in (('icon-512.png', 512), ('icon-256.png', 256), ('icon-192.png', 192), ('icon-144.png', 144),
                       ('icon-96.png', 96), ('apple-touch-icon.png', 180), ('favicon-48.png', 48),
                       ('favicon-32.png', 32), ('img/logo-mark.png', 96)):
        scope.resize((size, size), Image.LANCZOS).save(ROOT / name, optimize=True)
    # favicon.ico with 16, 32 and 48 inside, for browsers and Windows shortcuts that only read .ico.
    scope.resize((256, 256), Image.LANCZOS).save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    # Maskable: launchers may cut to a circle 80% wide, so shrink the scope into a black frame.
    mask = Image.new('RGB', (512, 512), (0, 0, 0))
    mask.paste(scope.resize((420, 420), Image.LANCZOS), (46, 46))
    mask.save(ROOT / 'icon-maskable-512.png', optimize=True)


if __name__ == '__main__':
    main(sys.argv[1])
