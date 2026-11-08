"""
Extrai os sprites das folhas com fundo verde (chroma key) e gera:
  assets/sprites/<nome>.png  — PNG com transparência, já recortado
  js/atlas.js                — tamanhos e ponto de ancoragem (pés) de cada sprite

Uso:  python3 tools/extract_sprites.py <folha_boss.jpg> <folha_heroi.jpg>

Cada quadro é definido por um retângulo generoso na folha. Dentro dele mantemos
o maior componente conectado e qualquer componente que NÃO toque a borda do
retângulo — assim pedaços de sprites vizinhos (que invadem a área) são descartados.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sprites')
BG = np.array([4, 232, 4], float)
SCALE = 0.5  # reduz pela metade: ainda nítido em telas HiDPI e leve para carregar

# nome: (folha, x0, y0, x1, y1, opções)
FRAMES = {
    # ---------------- Boss (folha 1) ----------------
    'boss_walk0': (1, 5, 15, 196, 316, {}),
    'boss_walk1': (1, 199, 15, 392, 316, {}),
    'boss_walk2': (1, 396, 15, 588, 316, {}),
    'boss_lunge': (1, 588, 30, 893, 300, {}),
    'boss_low': (1, 893, 30, 1136, 312, {}),
    'boss_shoulder': (1, 1138, 0, 1396, 312, {}),
    'boss_hold': (1, 1398, 40, 1738, 312, {}),
    'boss_stance': (1, 1740, 40, 1996, 312, {}),
    'boss_idle0': (1, 5, 325, 186, 598, {}),
    'boss_idle1': (1, 192, 325, 372, 598, {}),
    'boss_idle2': (1, 378, 325, 578, 598, {}),
    'boss_raise': (1, 576, 284, 802, 598, {}),
    'boss_overhead': (1, 784, 262, 1026, 598, {}),
    'boss_slash': (1, 1024, 345, 1248, 602, {}),
    'boss_retract': (1, 1250, 345, 1432, 602, {}),
    'boss_spin': (1, 1430, 350, 1752, 602, {}),
    'boss_stance2': (1, 1755, 355, 1996, 602, {}),
    'boss_slam': (1, 488, 648, 760, 1072, {}),
    'boss_roar0': (1, 755, 708, 972, 1068, {}),
    'boss_roar1': (1, 982, 722, 1212, 1068, {}),
    'boss_hurt0': (1, 1214, 732, 1462, 1068, {}),
    'boss_hurt1': (1, 1464, 742, 1702, 1068, {}),
    'boss_down': (1, 1704, 718, 1992, 1068, {}),
    # ---------------- Herói (folha 2, linha 1) ----------------
    'hero_idle': (2, 18, 8, 202, 316, {}),
    'hero_walk1': (2, 204, 12, 388, 316, {}),
    'hero_walk2': (2, 398, 15, 592, 316, {}),
    'hero_dash': (2, 594, 22, 902, 290, {}),
    'hero_stance': (2, 904, 28, 1144, 312, {}),
    'hero_draw': (2, 1148, 28, 1404, 312, {}),
    'hero_slash1': (2, 1404, 36, 1752, 312, {}),
    'hero_slash2': (2, 1752, 32, 1988, 312, {}),
    # ---------------- Ninjas (folha 2, linha 2) ----------------
    'ninja_idle': (2, 4, 328, 186, 598, {}),
    'ninja_walk1': (2, 188, 322, 372, 598, {}),
    'ninja_walk2': (2, 378, 322, 590, 600, {}),
    'ninja_lunge': (2, 588, 336, 830, 598, {}),
    'ninja_raise': (2, 830, 318, 1016, 602, {}),
    'gray_raise': (2, 1014, 326, 1216, 602, {}),
    'black_raise': (2, 1214, 316, 1428, 598, {}),
    'gray_strike': (2, 1428, 326, 1606, 598, {}),
    'ninja_crouch': (2, 1608, 350, 1800, 594, {}),
    'black_crouch': (2, 1812, 360, 1988, 594, {}),
    # ---------------- Cenário (folha 2, linha 3) ----------------
    'house_thatch': (2, 0, 604, 478, 1084, {'keep_all_inner': True, 'clip': [(440, 620, 478, 762)]}),
    'sakura': (2, 438, 626, 642, 870, {'clip': [(575, 715, 642, 870)]}),
    'lantern': (2, 452, 864, 524, 1002, {}),
    'house_tile': (2, 552, 610, 990, 990, {'keep_all_inner': True, 'clip': [(552, 610, 642, 742), (552, 742, 578, 880)]}),
    'lantern2': (2, 732, 966, 804, 1098, {}),
    'house_tile2': (2, 1000, 616, 1440, 1094, {'keep_all_inner': True, 'clip': [(1270, 985, 1440, 1094), (1404, 778, 1440, 985), (1426, 715, 1440, 778)]}),
    'bamboo': (2, 1512, 612, 1720, 934, {}),
    'crate': (2, 1728, 622, 1854, 764, {}),
    'crate_tied': (2, 1856, 622, 1988, 764, {}),
    'crate_small': (2, 1268, 988, 1380, 1104, {}),
    'crate_mid': (2, 1455, 912, 1562, 1028, {}),
    'shrine': (2, 1680, 782, 1996, 1098, {'keep_all_inner': True}),
}


def key(rgb):
    """Chroma key suave: alfa pela distância à cor de fundo + remoção do verde na borda."""
    d = np.sqrt(((rgb - BG) ** 2).sum(-1))
    a = np.clip((d - 70) / 70, 0, 1)
    safe = np.maximum(a, 1e-3)[..., None]
    col = (rgb - (1 - a[..., None]) * BG) / safe  # "despremultiplica" o fundo verde
    col = np.clip(col, 0, 255)
    # despill extra: verde não pode dominar em pixels semitransparentes
    semi = a < 0.98
    g = col[..., 1]
    lim = np.maximum(col[..., 0], col[..., 2]) * 1.15 + 12
    col[..., 1] = np.where(semi & (g > lim), lim, g)
    return col, a


def label(mask):
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    comps = []
    n = 0
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if lab[y, x]:
            continue
        n += 1
        lab[y, x] = n
        q = deque([(y, x)])
        border = False
        cnt = 0
        while q:
            cy, cx = q.popleft()
            cnt += 1
            if cy == 0 or cx == 0 or cy == H - 1 or cx == W - 1:
                border = True
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((ny, nx))
        comps.append((n, cnt, border))
    return lab, comps


CHARACTER_PREFIXES = ('boss_', 'hero_', 'ninja_', 'gray_', 'black_')

# Ajustes manuais de âncora X (em pixels do PNG final) onde a heurística dos pés erra
# (ex.: explosão no chão do golpe do boss, perna aberta no rugido).
ANCHOR_X = {'boss_roar0': 55, 'boss_slam': 50}


def extract(sheet, x0, y0, x1, y1, opts, character=False):
    rgb = sheet[y0:y1, x0:x1].astype(float)
    col, a = key(rgb)
    if character:
        # Personagens não têm verde legítimo: remove o "vazamento" verde do JPG em tudo.
        lim = np.maximum(col[..., 0], col[..., 2]) * 1.04 + 6
        col[..., 1] = np.minimum(col[..., 1], lim)
    for cx0, cy0, cx1, cy1 in opts.get('clip', []):
        a[max(cy0 - y0, 0):max(cy1 - y0, 0), max(cx0 - x0, 0):max(cx1 - x0, 0)] = 0
    mask = a > 0.35
    lab, comps = label(mask)
    if not comps:
        raise SystemExit('quadro vazio')
    biggest = max(comps, key=lambda c: c[1])
    keep = np.zeros_like(mask)
    for n, cnt, border in comps:
        if n == biggest[0] or (not border and (cnt > 12 or opts.get('keep_all_inner'))):
            keep |= lab == n
    # inclui a franja semitransparente vizinha aos pixels mantidos (bordas suaves)
    grown = keep.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= np.roll(np.roll(keep, dy, 0), dx, 1)
    a = np.where(grown, a, 0)
    ys, xs = np.nonzero(a > 0.02)
    by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([col, a * 255])[by0:by1, bx0:bx1].astype(np.uint8)
    solid = (a > 0.5)[by0:by1, bx0:bx1]
    return Image.fromarray(rgba, 'RGBA'), solid


def feet_anchor(solid):
    """Âncora = centro dos pixels sólidos nas linhas mais baixas (os pés)."""
    H, W = solid.shape
    rows = np.nonzero(solid.any(1))[0]
    bottom = rows.max()
    band = solid[max(bottom - int(H * 0.12), 0):bottom + 1]
    xs = np.nonzero(band.any(0))[0]
    return float((xs.min() + xs.max()) / 2), float(bottom)


# Variações de cor dos ninjas: as folhas só trazem 2 poses do ninja cinza e do
# preto, então derivamos as poses que faltam recolorindo o ninja azul.
RECOLOR_SOURCES = ['ninja_idle', 'ninja_walk1', 'ninja_walk2', 'ninja_lunge', 'ninja_crouch']
RECOLORS = {'gray': (1.25, 18), 'black': (0.55, -6)}  # (brilho, deslocamento)


def recolor(img, gain, offset):
    a = np.asarray(img).astype(float)
    rgb, alpha = a[..., :3], a[..., 3:]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    skin = (r > g + 12) & (g > b + 8) & (r > 120)  # olhos/pele: não mexe
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    gray = np.clip(lum * gain + offset, 0, 255)
    out = np.where(skin[..., None], rgb, np.stack([gray * 1.0, gray * 0.99, gray * 1.03], -1))
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), alpha], -1).astype(np.uint8), 'RGBA')


def main(boss_path, hero_path):
    sheets = {1: np.asarray(Image.open(boss_path).convert('RGB')),
              2: np.asarray(Image.open(hero_path).convert('RGB'))}
    os.makedirs(OUT, exist_ok=True)
    atlas = {}
    for name, (s, x0, y0, x1, y1, opts) in FRAMES.items():
        img, solid = extract(sheets[s], x0, y0, x1, y1, opts, name.startswith(CHARACTER_PREFIXES))
        ax, ay = feet_anchor(solid)
        if name in ANCHOR_X:
            ax = ANCHOR_X[name] / SCALE
        w, h = img.size
        nw, nh = max(1, round(w * SCALE)), max(1, round(h * SCALE))
        img = img.resize((nw, nh), Image.LANCZOS)
        img.save(os.path.join(OUT, name + '.png'), optimize=True)
        atlas[name] = {'w': nw, 'h': nh, 'ax': round(ax * SCALE, 1), 'ay': round(ay * SCALE, 1)}
        print(f'{name:14s} {nw:4d}x{nh:<4d} anchor=({atlas[name]["ax"]}, {atlas[name]["ay"]})')
    for src in RECOLOR_SOURCES:
        base = Image.open(os.path.join(OUT, src + '.png'))
        for tag, (gain, off) in RECOLORS.items():
            name = src.replace('ninja_', tag + '_')
            recolor(base, gain, off).save(os.path.join(OUT, name + '.png'), optimize=True)
            atlas[name] = dict(atlas[src])
    with open(os.path.join(ROOT, 'js', 'atlas.js'), 'w') as f:
        f.write('/* Gerado por tools/extract_sprites.py — não editar à mão.\n'
                ' * w/h: tamanho do PNG; ax/ay: ponto de apoio (pés) em pixels do PNG. */\n')
        f.write('const ATLAS = ' + json.dumps(atlas, indent=1) + ';\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
