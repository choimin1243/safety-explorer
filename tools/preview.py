"""스프라이트 띠를 스킬 3단계 규칙(대칭 중심, 최근접, squash 0.75, 1px 올림, 외곽선 한 번)으로 그려 견본표를 만든다."""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
D = os.path.join(os.path.dirname(__file__), '..', 'sprites')
M = json.load(open(os.path.join(D, 'manifest.json')))
names = sys.argv[2:] or [n for n in M if not n.endswith('_1')]
out = sys.argv[1] if len(sys.argv) > 1 else 'preview.png'
def render(name, turn=0.7, scale=3, squash=0.75):
    m = M[name]; strip = np.array(Image.open(os.path.join(D, name + '.png')))
    w, l, n = m['w'], m['l'], m['n']; R = int(math.hypot(w, l) / 2) + 2
    BW, BH = 2 * R + 4, int(2 * R * squash) + n + 6
    cx, cy = BW / 2, BH - R * squash - 3
    buf = np.zeros((BH, BW, 4), np.uint8); ys, xs = np.mgrid[0:BH, 0:BW]
    c, s = math.cos(turn), math.sin(turn); ox, oy = (w - 1) / 2, (l - 1) / 2
    for z in range(n):
        sl = strip[:, z * w:(z + 1) * w]
        dx = xs - cx; dy = (ys - cy + z) / squash
        u = np.round(c * dx + s * dy + ox).astype(int); v = np.round(-s * dx + c * dy + oy).astype(int)
        ok = (u >= 0) & (u < w) & (v >= 0) & (v < l)
        px = np.zeros_like(buf); px[ok] = sl[v[ok], u[ok]]; msk = px[..., 3] > 0; buf[msk] = px[msk]
    body = buf[..., 3] > 0; pad = np.pad(body, 1); near = np.zeros_like(body)
    for a in (-1, 0, 1):
        for b in (-1, 0, 1): near |= pad[1 + a:1 + a + BH, 1 + b:1 + b + BW]
    img = np.zeros((BH, BW, 4), np.uint8); img[body] = buf[body]; img[near & ~body] = (34, 20, 30, 255)
    return Image.fromarray(img).resize((BW * scale, BH * scale), Image.NEAREST)
ims = [(n, render(n, scale=3 if M[n]['l'] < 60 else 2)) for n in names]
cols = 8; cw = max(i.width for _, i in ims); ch = max(i.height for _, i in ims) + 26
rows = math.ceil(len(ims) / cols)
sheet = Image.new('RGB', (cols * cw, rows * ch), (236, 244, 250)); d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
for k, (n, im) in enumerate(ims):
    x, y = (k % cols) * cw, (k // cols) * ch
    sheet.paste(im, (x + (cw - im.width) // 2, y + ch - 26 - im.height), im); d.text((x + 6, y + ch - 22), n, fill=(40, 40, 60), font=font)
sheet.save(out); print(out, sheet.size, len(ims))
