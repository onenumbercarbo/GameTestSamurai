"""Gera uma prancha de conferência com todos os sprites e a âncora (cruz vermelha)."""
import json, os, re, sys
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'js', 'atlas.js')).read()
atlas = json.loads(re.search(r'= (\{.*\});', src, re.S).group(1))
cell, cols = 250, 8
rows = (len(atlas) + cols - 1) // cols
sheet = Image.new('RGBA', (cell * cols, cell * rows), (60, 70, 60, 255))
d = ImageDraw.Draw(sheet)
for i, (name, m) in enumerate(atlas.items()):
    cx, cy = (i % cols) * cell, (i // cols) * cell
    for yy in range(0, cell, 10):
        for xx in range(0, cell, 10):
            if (xx + yy) // 10 % 2: d.rectangle([cx+xx, cy+yy, cx+xx+9, cy+yy+9], fill=(80, 90, 80, 255))
    im = Image.open(os.path.join(ROOT, 'assets', 'sprites', name + '.png'))
    ox, oy = cx + 125 - int(m['ax']), cy + 230 - int(m['ay'])
    sheet.alpha_composite(im, (ox, oy))
    d.line([cx+115, cy+230, cx+135, cy+230], fill='red', width=2)
    d.line([cx+125, cy+220, cx+125, cy+240], fill='red', width=2)
    d.text((cx+4, cy+4), name, fill='white')
sheet.save(sys.argv[1])
