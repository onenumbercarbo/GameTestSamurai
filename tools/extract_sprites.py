"""
Extrai os sprites das folhas com fundo verde (chroma key) e gera:
  assets/sprites/<nome>.png  — PNG com transparência, já recortado
  js/atlas.js                — tamanhos e ponto de ancoragem (pés) de cada sprite

Uso:  python3 tools/extract_sprites.py <folha_boss.jpg> <folha_heroi.jpg> <folha_floresta.jpg> <folha_acampamento.jpg> <folha_minichefes.jpg>

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
    # Casa com as duas cercas de bambu: recorte vai até o pé das cercas (y≈1092);
    # a lanterna entre elas é removida; o apoio é o canto sul da CASA (740, 980).
    'house_tile': (2, 548, 610, 990, 1096, {'keep_all_inner': True, 'anchor': (740, 980),
                   'clip': [(548, 610, 642, 742), (548, 742, 578, 880), (728, 962, 806, 1100)]}),
    'lantern2': (2, 732, 966, 804, 1098, {}),
    'house_tile2': (2, 1000, 616, 1440, 1094, {'keep_all_inner': True, 'clip': [(1270, 985, 1440, 1094), (1404, 778, 1440, 985), (1426, 715, 1440, 778)]}),
    'bamboo': (2, 1512, 612, 1720, 934, {}),
    'crate': (2, 1728, 622, 1854, 764, {}),
    'crate_tied': (2, 1856, 622, 1988, 764, {}),
    'crate_small': (2, 1268, 988, 1380, 1104, {}),
    'crate_mid': (2, 1455, 912, 1562, 1028, {}),
    'shrine': (2, 1680, 782, 1996, 1098, {'keep_all_inner': True}),
    # ---------------- Floresta / torii (folha 3, fundo verde-claro) ----------------
    'forest_mixed': (3, 25, 25, 610, 532, {'keep_all_inner': True}),
    'forest_bamboo_pine': (3, 670, 35, 1238, 398, {'keep_all_inner': True}),
    'pine': (3, 1166, 210, 1350, 490, {'clip': [(1166, 210, 1212, 330), (1322, 210, 1350, 430)]}),
    'forest_dark': (3, 1505, 28, 1970, 530, {'keep_all_inner': True}),
    'bamboo_grove': (3, 22, 495, 312, 832, {'keep_all_inner': True}),
    'forest_sakura': (3, 296, 398, 812, 952, {'keep_all_inner': True, 'clip': [(296, 815, 405, 952)]}),
    'forest_broadleaf': (3, 18, 792, 402, 1170, {'keep_all_inner': True, 'clip': [(90, 792, 262, 836)]}),
    'torii': (3, 858, 392, 1212, 868, {'keep_all_inner': True, 'anchor': (1030, 790)}),
    'tree_small': (3, 1398, 660, 1558, 840, {}),
    'forest_pines': (3, 1626, 503, 1974, 864, {'keep_all_inner': True}),
    'bush_a': (3, 346, 1092, 428, 1175, {}),
    'bush_big': (3, 484, 962, 628, 1094, {}),
    'bush_dark': (3, 594, 912, 738, 1038, {}),
    'bush_round': (3, 698, 866, 812, 988, {}),
    'rock_moss': (3, 796, 863, 900, 942, {}),
    'rock_big': (3, 1066, 946, 1152, 1038, {}),
    'rock_tall': (3, 1278, 830, 1368, 928, {}),
    'rock_flat': (3, 726, 1132, 858, 1220, {}),
    'fern': (3, 884, 922, 992, 1012, {}),
    'fern2': (3, 858, 1182, 982, 1270, {}),
    'grass_tall': (3, 1348, 792, 1448, 892, {}),
    # ---------------- Aldeões presos e bandidos do acampamento (folha 4) ----------------
    'villager_kneel': (4, 32, 72, 208, 312, {}),
    'villager_kneel2': (4, 232, 76, 418, 312, {}),
    'villager_post': (4, 482, 6, 604, 326, {}),
    'villager_post2': (4, 648, 6, 772, 330, {}),
    'villager_bow': (4, 772, 88, 928, 308, {}),
    'villager_pray_kneel': (4, 952, 82, 1112, 308, {}),
    'villager_rise': (4, 1166, 52, 1314, 312, {}),
    'villager_pray': (4, 1396, 38, 1524, 312, {}),
    'villager_cut': (4, 1636, 18, 1790, 318, {}),
    'villager_thank': (4, 1826, 12, 1954, 314, {}),
    'bandit_drink': (4, 12, 342, 202, 608, {}),
    'bandit_drink2': (4, 204, 342, 388, 608, {}),
    'bandit_laugh': (4, 396, 342, 590, 608, {}),
    'bandit_ground': (4, 602, 352, 812, 598, {}),
    'bandit_dance': (4, 812, 312, 1014, 614, {}),
    'bandit_dance2': (4, 1026, 322, 1218, 614, {}),
    'bandit_sleep': (4, 1696, 352, 1978, 598, {'keep_all_inner': True}),
    'camp_cookpot': (4, 470, 622, 872, 1064, {'keep_all_inner': True}),
    'camp_log_bottles': (4, 888, 698, 1162, 896, {'keep_all_inner': True}),
    'camp_log': (4, 906, 900, 1178, 1084, {}),
    'camp_sake': (4, 1158, 688, 1288, 802, {'keep_all_inner': True}),
    'camp_barrels': (4, 1280, 656, 1434, 828, {'keep_all_inner': True}),
    'camp_firepit': (4, 1178, 818, 1482, 1078, {'keep_all_inner': True}),
    'camp_tent': (4, 1448, 618, 1996, 1068, {'keep_all_inner': True}),
    # ---------------- Mini-chefes e soldados (folha 5) ----------------
    'monk_idle': (5, 17, 11, 363, 438, {}),
    'monk_idle2': (5, 311, 11, 677, 438, {}),
    'monk_pray': (5, 603, 55, 828, 438, {}),
    'monk_thrust_w': (5, 846, 83, 1337, 438, {}),
    'monk_thrust': (5, 1255, 83, 1684, 438, {}),
    'monk_raise': (5, 1596, 11, 1998, 438, {}),
    'monk_swing': (5, 1962, 11, 2268, 438, {}),
    'monk_spin': (5, 2265, 11, 2708, 438, {}),
    'soldier_aim': (5, 58, 475, 344, 831, {}),
    'soldier_fire': (5, 322, 475, 638, 831, {}),
    'soldier_hold': (5, 575, 484, 773, 831, {}),
    'soldier_bayonet': (5, 837, 484, 1167, 831, {}),
    'kuno_fist': (5, 1117, 438, 1368, 831, {}),
    'kuno_stance': (5, 1406, 475, 1690, 831, {}),
    'kuno_jump': (5, 1709, 482, 1951, 831, {}),
    'kuno_lunge': (5, 1965, 495, 2240, 831, {}),
    'kuno_slash': (5, 2199, 495, 2455, 831, {}),
    'kuno_grab': (5, 2447, 475, 2730, 831, {}),
    'oni_slam': (5, 699, 1040, 1051, 1492, {'clip': [(919, 1040, 1051, 1245)], 'nohaze': True}),
    'oni_raise': (5, 1015, 911, 1310, 1439, {'clip': [(1288, 1137, 1310, 1211)]}),
    'oni_slam2': (5, 1365, 1071, 1706, 1492, {'clip': [(1365, 963, 1706, 1076), (1335, 1159, 1382, 1252), (1365, 1076, 1412, 1137), (1412, 1076, 1437, 1109)], 'nohaze': True}),
    'ronin_low': (5, 1703, 1098, 2103, 1483, {}),
    'ronin_dual': (5, 2081, 1101, 2419, 1483, {}),
    'ronin_raise': (5, 2419, 1054, 2735, 1492, {}),
}

# Cor de fundo de cada folha (as duas primeiras são verde-chroma, a terceira verde-claro).
SHEET_BG = {1: (4, 232, 4), 2: (4, 232, 4), 3: (177, 220, 166), 4: (13, 222, 9), 5: (12, 226, 8)}


def key(rgb, bg=BG):
    """Chroma key suave: alfa pela distância à cor de fundo + remoção do verde na borda."""
    bg = np.array(bg, float)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    lo, span = (70, 70) if bg[0] < 50 else (22, 40)  # fundo claro: tolerância menor
    a = np.clip((d - lo) / span, 0, 1)
    safe = np.maximum(a, 1e-3)[..., None]
    col = (rgb - (1 - a[..., None]) * bg) / safe  # "despremultiplica" o fundo verde
    col = np.clip(col, 0, 255)
    # despill extra: verde não pode dominar em pixels semitransparentes
    semi = (a < 0.98) & (bg[0] < 50)
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


CHARACTER_PREFIXES = ('boss_', 'hero_', 'ninja_', 'gray_', 'black_', 'villager_', 'bandit_', 'monk_', 'soldier_', 'kuno_', 'oni_', 'ronin_')

# Ajustes manuais de âncora X (em pixels do PNG final) onde a heurística dos pés erra
# (ex.: explosão no chão do golpe do boss, perna aberta no rugido).
ANCHOR_X = {'boss_roar0': 55, 'boss_slam': 50, 'bandit_ground': 55}


def extract(sheet, x0, y0, x1, y1, opts, character=False, bg=BG):
    rgb = sheet[y0:y1, x0:x1].astype(float)
    col, a = key(rgb, bg)
    if character:
        # Personagens não têm verde legítimo: remove o "vazamento" verde do JPG em tudo.
        lim = np.maximum(col[..., 0], col[..., 2]) * 1.04 + 6
        col[..., 1] = np.minimum(col[..., 1], lim)
    for cx0, cy0, cx1, cy1 in opts.get('clip', []):
        a[max(cy0 - y0, 0):max(cy1 - y0, 0), max(cx0 - x0, 0):max(cx1 - x0, 0)] = 0
    if opts.get('nohaze'):
        # Remove a "névoa" esverdeada (fumaça/tora atrás do sprite tingida pelo fundo).
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        haze = (g > r + 4) & (g > b + 18)
        a = np.where(haze, 0, a)
    if opts.get('feather'):
        # Suaviza cortes retos onde o recorte encostou num vizinho da folha.
        h, w = a.shape
        yy, xx = np.mgrid[0:h, 0:w]
        edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
        a = a * np.clip(edge / opts['feather'], 0, 1)
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
    anchor = None
    if 'anchor' in opts:  # ponto de apoio dado em coordenadas da folha
        anchor = (opts['anchor'][0] - x0 - bx0, opts['anchor'][1] - y0 - by0)
    return Image.fromarray(rgba, 'RGBA'), solid, anchor


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


def main(*paths):
    # folhas: 1 boss, 2 herói/ninjas/casas, 3 floresta, 4 acampamento, 5 mini-chefes
    sheets = {i + 1: np.asarray(Image.open(p).convert('RGB')) for i, p in enumerate(paths)}
    os.makedirs(OUT, exist_ok=True)
    atlas = {}
    for name, (s, x0, y0, x1, y1, opts) in FRAMES.items():
        if s == 3 and 'feather' not in opts and name != 'torii':
            opts = {**opts, 'feather': 10}
        img, solid, fixed = extract(sheets[s], x0, y0, x1, y1, opts, name.startswith(CHARACTER_PREFIXES), SHEET_BG[s])
        ax, ay = fixed or feet_anchor(solid)
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
    main(*sys.argv[1:6])
