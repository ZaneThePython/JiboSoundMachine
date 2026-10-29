# Draws the white action-button glyphs (265x265, like Jibo's stock actionIcons),
# the Store icon (330x330) and banner (1000x800).
import math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = sys.argv[1]
S = 4  # supersample
WHITE = (255, 255)

def canvas(size=265):
    im = Image.new('LA', (size * S, size * S), (0, 0)); return im, ImageDraw.Draw(im)

def save(im, path, size=265): im.resize((size, size), Image.LANCZOS).save(path)

def P(x, y): return (x * S, y * S)

def cloud(d, cx, cy, k=1.0, fill=WHITE):
    for (x, y, r) in [(-38, 8, 30), (0, -12, 40), (38, 6, 30)]:
        d.ellipse([P(cx + x * k - r * k, cy + y * k - r * k), P(cx + x * k + r * k, cy + y * k + r * k)], fill=fill)
    d.rounded_rectangle([P(cx - 66 * k, cy + 2 * k), P(cx + 66 * k, cy + 38 * k)], radius=18 * k * S, fill=fill)

def rain():
    im, d = canvas(); cloud(d, 132, 105)
    for x, y in [(95, 170), (132, 182), (169, 170)]:
        d.line([P(x + 8, y), P(x - 4, y + 30)], fill=WHITE, width=12 * S)
    return im

def wave(d, y, amp, w=12, x0=62, x1=203, phase=0.0):
    pts = [P(x, y + amp * math.sin((x - x0) / (x1 - x0) * 2 * math.pi * 1.5 + phase)) for x in range(x0, x1 + 1, 2)]
    d.line(pts, fill=WHITE, width=w * S, joint='curve')

def ocean():
    im, d = canvas(); wave(d, 105, 16); wave(d, 150, 16); wave(d, 195, 16); return im

def fan():
    im, d = canvas(); c = 132
    for a in (0, 120, 240):
        r = math.radians(a)
        pts = []
        for t in range(0, 101, 5):
            ang = r + math.radians(t * 0.9 - 45); rad = 18 + 52 * math.sin(math.pi * t / 100) ** 0.6 + t * 0.12
            pts.append(P(c + rad * math.cos(ang), c + rad * math.sin(ang)))
        d.polygon([P(c, c)] + pts, fill=WHITE)
    d.ellipse([P(c - 76, c - 76), P(c + 76, c + 76)], outline=WHITE, width=10 * S)
    d.ellipse([P(c - 14, c - 14), P(c + 14, c + 14)], fill=(0, 0))
    d.ellipse([P(c - 9, c - 9), P(c + 9, c + 9)], fill=WHITE)
    return im

def brown():
    im, d = canvas()
    pts = [P(x, 132 - 42 * math.sin((x - 60) / 146.0 * 2 * math.pi)) for x in range(60, 207, 2)]
    d.line(pts, fill=WHITE, width=14 * S, joint='curve'); return im

def white():
    im, d = canvas()
    import random; rnd = random.Random(7)
    pts = [P(x, 132 + (1 if i % 2 else -1) * rnd.uniform(18, 50)) for i, x in enumerate(range(62, 205, 11))]
    d.line(pts, fill=WHITE, width=9 * S); return im

def moon():
    im, d = canvas(); c = 132
    d.ellipse([P(c - 62, c - 62), P(c + 62, c + 62)], fill=WHITE)
    d.ellipse([P(c - 32, c - 82), P(c + 82, c + 32)], fill=(0, 0))
    for x, y, r in [(178, 92, 7), (200, 130, 5)]:
        d.ellipse([P(x - r, y - r), P(x + r, y + r)], fill=WHITE)
    return im

def stop_glyph():
    im, d = canvas(); d.rounded_rectangle([P(87, 87), P(178, 178)], radius=10 * S, fill=WHITE); return im

for name, fn in [('rain', rain), ('ocean', ocean), ('fan', fan), ('brown', brown), ('white', white), ('sleep', moon)]:
    save(fn(), f'{ROOT}/soundmachine/resources/{name}.png')

# Store icon: cloud with sound waves, white on transparent, 330x330.
im, d = canvas(330)
cloud(d, 150, 150, 1.25)
for i, r in enumerate((40, 70)):
    d.arc([P(222 - r, 165 - r), P(222 + r, 165 + r)], -50, 50, fill=WHITE, width=13 * S)
save(im, f'{ROOT}/icon.png', 330)

# Banner: dark background, glowing title, the five sound glyphs in a row.
FONT = '/root/.hermes/cache/scratch/Nunito.ttf'
W, H = 1000 * 2, 800 * 2
banner = Image.new('RGBA', (W, H), (14, 16, 26, 255))
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
CYAN = (37, 242, 251, 255)
for i, fn in enumerate([rain, ocean, fan, brown, white]):
    g = fn().resize((150 * 2, 150 * 2), Image.LANCZOS).convert('RGBA')
    tint = Image.new('RGBA', g.size, CYAN if i == 0 else (200, 205, 225, 255)); tint.putalpha(g.getchannel('A'))
    layer.alpha_composite(tint, ((500 + (i - 2) * 180 - 75) * 2, 230 * 2))  # centred row
f = ImageFont.truetype(FONT, 112 * 2); f.set_variation_by_name('Black')
ImageDraw.Draw(layer).text((W // 2, 560 * 2), 'Sound Machine', font=f, fill=CYAN, anchor='mm')
blur = layer.filter(ImageFilter.GaussianBlur(14 * 2))
banner.alpha_composite(blur); banner.alpha_composite(blur); banner.alpha_composite(layer)
banner.convert('RGB').resize((1000, 800), Image.LANCZOS).save(f'{ROOT}/banner.png')
print('art written')
