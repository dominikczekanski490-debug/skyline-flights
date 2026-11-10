#!/usr/bin/env python3
"""White-on-colour logo variants for gate screens, where the plain 'whiten every pixel' filter would turn an opaque coloured
box inside the artwork into a white patch. Rule per airline: pixels close to the given box colour become transparent; everything
else becomes white (alpha kept). Output public/logos/w/<CODE>.png, then tools/hashassets.py hashes them. Run from web/."""
from PIL import Image
BOX = {"DY": (215, 25, 50), "TK": (200, 16, 46)}  # Norwegian: red ".com" panel; Turkish: red disc behind the bird
for k, (r0, g0, b0) in BOX.items():
    im = Image.open(f"public/logos/{k}.png").convert("RGBA"); px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0: continue
            red = r > 150 and g < 110 and b < 120 and r - g > 90
            px[x, y] = (255, 255, 255, 0 if red else a)
    im = im.crop(im.getchannel("A").getbbox()); im.save(f"public/logos/w/{k}.png", optimize=True); print(k, im.size)
