import sys
import numpy as np
from PIL import Image
from collections import deque

def mask_of(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = (g > 120) & (g - np.maximum(r, b) > 60)
    return ~green

def components(mask, ds=4, dil=2):
    h, w = mask.shape
    m = mask[:h - h % ds, :w - w % ds].reshape(h // ds, ds, w // ds, ds).mean(axis=(1, 3)) > 0.25
    # dilate
    d = m.copy()
    for dy in range(-dil, dil + 1):
        for dx in range(-dil, dil + 1):
            d |= np.roll(np.roll(m, dy, 0), dx, 1)
    H, W = d.shape
    lab = np.zeros((H, W), int)
    out = []
    n = 0
    for y in range(H):
        for x in range(W):
            if d[y, x] and not lab[y, x]:
                n += 1
                q = deque([(y, x)]); lab[y, x] = n
                x0 = x1 = x; y0 = y1 = y; cnt = 0
                while q:
                    cy, cx = q.popleft(); cnt += 1
                    x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                    for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                        if 0 <= ny < H and 0 <= nx < W and d[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
                if cnt > 30:
                    out.append((x0*ds, y0*ds, (x1+1)*ds, (y1+1)*ds, cnt))
    return out

for p in sys.argv[1:]:
    print(p)
    cs = components(mask_of(p))
    cs.sort(key=lambda c: (c[1] // 300, c[0]))
    for c in cs:
        print('  ', c)
