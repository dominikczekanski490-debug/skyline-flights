"""Shared hero-photo renderer for the Clearway destination photos (build.py, override.py, rebuild.py).

Sizing: the largest hero is `.cw-hero.big` = 100% width x clamp(280px, 50vh, 520px). On an iPhone 13 (390x844 CSS px, DPR 3)
that box is 390x422 CSS px (aspect ~0.92) and the photo is drawn with object-fit: cover, so the *height* is what has to be sharp:
422 x 3 = 1266 px. A 16:9 file would need 2250x1266 to cover it; a 4:3 file at 1600x1200 covers it at 2.84 device px per CSS px
while staying near the old 16:9 pixel budget, and the normal 390x230 / 390x290 heroes get 4.1 px per CSS px across the width.
So heroes are 4:3, 1600x1200, WebP q80 (stepping quality down, then size, only if a very detailed photo would exceed MAX_BYTES). No letterboxing, no upscaling.
"""
import io
from PIL import Image
W, H = 1600, 1200          # output size (4:3)
THUMB = 2560               # Commons thumbnail width to fetch (a standard Wikimedia thumb step)
QUALITY = (80, 76, 72, 68, 64, 60, 56)  # WebP quality ladder (80 for almost all; lower only for very detailed aerials)
MAX_BYTES = 250_000        # cap per photo

Image.MAX_IMAGE_PIXELS = None
def pick_url(ii):
  """Commons imageinfo (with iiprop=url|size and iiurlwidth=THUMB) -> URL to download: the 2560 px thumb, or the original
  when the thumb would be too short for a 1200 px tall 4:3 crop (wide panoramas) and the original is under ~40 MB."""
  w, h, sz = ii.get("width") or 0, ii.get("height") or 0, ii.get("size") or 0
  if w and w > THUMB and h * THUMB / w < H and h > h * THUMB / w and sz < 40_000_000: return ii["url"]
  return ii.get("thumburl") or ii["url"]

def render(im, fy=0.45, fx=0.5, z=1.0):
  """Crop to 4:3 at (fx, fy) (0..1 of the spare room) and resize to at most 1600x1200. z < 1 takes a tighter 4:3 window (z of the
  largest one) so a photo with a lot of empty sky can be framed lower; only used where the window still has >= 1600 px.
  Returns (webp_bytes, average_colour, (w, h))."""
  im = im.convert("RGB"); w, h = im.size
  cw, ch = (w, w * H / W) if w * H / W <= h else (h * W / H, h)
  cw, ch = cw * z, ch * z; l, t = int((w - cw) * fx), int((h - ch) * fy)
  im = im.crop((l, t, l + int(cw), t + int(ch)))
  if im.width > W: im = im.resize((W, H), Image.LANCZOS)
  col = im.resize((1, 1), Image.BOX).getpixel((0, 0))
  for q in QUALITY:
    b = io.BytesIO(); im.save(b, "WEBP", quality=q, method=6)
    if b.tell() <= MAX_BYTES: break
  else:
    # Very grainy / detailed sources (dense city aerials, high-ISO shots) can stay over the cap even at q56: step the size
    # down instead of crushing quality further (1440x1080 still gives ~2.6 device px per CSS px on the big hero).
    for w in (1440, 1280, 1120):
      if im.width <= w: continue
      sm = im.resize((w, w * H // W), Image.LANCZOS)
      for q in (72, 64, 56):
        b = io.BytesIO(); sm.save(b, "WEBP", quality=q, method=6)
        if b.tell() <= MAX_BYTES: return b.getvalue(), "#%02x%02x%02x" % col, sm.size
  return b.getvalue(), "#%02x%02x%02x" % col, im.size
