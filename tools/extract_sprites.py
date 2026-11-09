"""
Extrai os sprites das folhas com fundo verde (chroma key) e gera:
  assets/sprites/<nome>.png  — PNG com transparência, já recortado
  js/atlas.js                — tamanhos e ponto de ancoragem (pés) de cada sprite

Uso:  python3 tools/extract_sprites.py <folha_boss.jpg> <folha_heroi.jpg> <folha_floresta.jpg> <folha_acampamento.jpg> <folha_minichefes.jpg> <costas_oni_ronin.jpg> <costas_kunoichi.jpg> <costas_aldeoes.jpg> <floresta2.jpg> <ronin_costas.png> <ronin_caminhada.jpg> <npcs_caminhada.jpg> <vila_moradores.jpg>

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
    # ---------------- Poses de costas (folhas 6, 7, 8) e cenário novo (folha 9) ----------------
    'oni_back_raise': (6, 1015, 10, 1305, 525, {}),
    'oni_back_raise2': (6, 1360, 0, 1665, 530, {}),
    'oni_back_slam': (6, 1640, 100, 1985, 530, {}),
    'ronin_back': (6, 1015, 560, 1315, 840, {}),
    'ronin_back_cape': (6, 360, 830, 645, 1105, {}),
    'ronin_back_raise': (6, 1005, 800, 1315, 1105, {}),
    'ronin_back_dual': (6, 1325, 830, 1700, 1105, {}),
    'kuno_back': (7, 830, 350, 1015, 605, {}),
    'kuno_back2': (7, 1040, 355, 1215, 605, {}),
    'villager_back_kneel': (8, 250, 80, 395, 305, {}),
    'villager_back_walk': (8, 1390, 40, 1520, 312, {}),
    'bandit_back_dance': (8, 1035, 322, 1212, 612, {}),
    'fence': (9, 1185, 1078, 1400, 1272, {'only_main': True}),
    'bonsai_pine': (9, 1295, 205, 1612, 642, {'only_main': True, 'drop_teal': True, 'clip': [(1295, 470, 1345, 642), (1295, 205, 1335, 420), (1490, 205, 1612, 345), (1400, 205, 1462, 272)]}),
    'cliff_long': (9, 38, 1138, 432, 1412, {'only_main': True}),
    'cliff_end': (9, 1532, 1108, 1952, 1408, {'only_main': True}),
    'cliff_block': (9, 1402, 982, 1658, 1178, {'only_main': True}),
    'slope_path': (9, 468, 1258, 708, 1418, {'only_main': True}),
    'slope_roots': (9, 748, 1268, 972, 1418, {'only_main': True}),
    'slope_roots2': (9, 1242, 1188, 1502, 1422, {'only_main': True, 'clip': [(1242, 1188, 1330, 1250)]}),
    # ---------------- Rōnin de costas (folha 10, pequena: recortada em escala 1) ----------------
    'hero_back_idle': (10, 16, 114, 78, 233, {'scale': 1}),
    'hero_back_walk1': (10, 80, 4, 150, 118, {'scale': 1}),
    'hero_back_walk2': (10, 158, 4, 228, 118, {'scale': 1}),
    'hero_back_dash': (10, 346, 4, 428, 118, {'scale': 1}),
    'hero_back_stance': (10, 438, 4, 506, 118, {'scale': 1}),
    'hero_back_slash': (10, 520, 4, 602, 118, {'scale': 1}),
    'hero_back_draw': (10, 230, 104, 306, 233, {'scale': 1}),
    'hero_back_slash2': (10, 148, 114, 232, 233, {'scale': 1}),
    'hero_front': (10, 6, 4, 80, 120, {'scale': 1.32, 'only_main': True}),
    # ---------------- Rōnin: ciclos de caminhada em 8 quadros (folha 11) ----------------
    'hero_bw0': (11, 4, 48, 246, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw1': (11, 254, 48, 496, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw2': (11, 504, 48, 746, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw3': (11, 754, 48, 996, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw4': (11, 1004, 48, 1246, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw5': (11, 1254, 48, 1496, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw6': (11, 1504, 48, 1746, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bw7': (11, 1754, 48, 1996, 312, {'scale': 0.6, 'only_main': True}),
    'hero_bd0': (11, 4, 346, 246, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd1': (11, 254, 346, 496, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd2': (11, 504, 346, 746, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd3': (11, 754, 346, 996, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd4': (11, 1004, 346, 1246, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd5': (11, 1254, 346, 1496, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd6': (11, 1504, 346, 1746, 584, {'scale': 0.6, 'only_main': True}),
    'hero_bd7': (11, 1754, 346, 1996, 584, {'scale': 0.6, 'only_main': True}),
    'hero_sw0': (11, 4, 622, 246, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw1': (11, 254, 622, 496, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw2': (11, 504, 622, 746, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw3': (11, 754, 622, 996, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw4': (11, 1004, 622, 1246, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw5': (11, 1254, 622, 1496, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw6': (11, 1504, 622, 1746, 860, {'scale': 0.6, 'only_main': True}),
    'hero_sw7': (11, 1754, 622, 1996, 860, {'scale': 0.6, 'only_main': True}),
    # ---------------- Caminhada dos NPCs (folha 12) ----------------
    'oni_w0': (12, 0, 0, 200, 362, {'only_main': True}),
    'oni_w1': (12, 200, 0, 400, 362, {'only_main': True}),
    'oni_w2': (12, 400, 0, 600, 362, {'only_main': True}),
    'oni_w3': (12, 600, 0, 800, 362, {'only_main': True}),
    'oni_w4': (12, 800, 0, 1000, 362, {'only_main': True}),
    'ronin_w0': (12, 1000, 0, 1200, 362, {'only_main': True}),
    'ronin_w1': (12, 1200, 0, 1400, 362, {'only_main': True}),
    'ronin_w2': (12, 1400, 0, 1600, 362, {'only_main': True}),
    'ronin_wb0': (12, 1600, 0, 1800, 362, {'only_main': True}),
    'ronin_wb1': (12, 1800, 0, 2000, 362, {'only_main': True}),
    'monk_w0': (12, 0, 410, 260, 742, {'only_main': True}),
    'monk_w1': (12, 200, 410, 460, 742, {'only_main': True}),
    'monk_w2': (12, 400, 410, 660, 742, {'only_main': True}),
    'monk_w3': (12, 600, 410, 860, 742, {'only_main': True}),
    'monk_w4': (12, 800, 410, 1060, 742, {'only_main': True}),
    'soldier_aim2': (12, 1000, 410, 1200, 742, {'only_main': True}),
    'soldier_w0': (12, 1200, 410, 1400, 742, {'only_main': True}),
    'soldier_w1': (12, 1400, 410, 1600, 742, {'only_main': True}),
    'soldier_w2': (12, 1600, 410, 1800, 742, {'only_main': True}),
    'soldier_w3': (12, 1800, 410, 2000, 742, {'only_main': True}),
    'kuno_r0': (12, 0, 792, 200, 1142, {'only_main': True}),
    'kuno_r1': (12, 200, 792, 400, 1142, {'only_main': True}),
    'kuno_r2': (12, 400, 792, 600, 1142, {'only_main': True}),
    'kuno_r3': (12, 600, 792, 800, 1142, {'only_main': True}),
    'kuno_r4': (12, 800, 792, 1000, 1142, {'only_main': True}),
    'kuno_front': (12, 1000, 792, 1200, 1142, {'only_main': True}),
    'kuno_wb0': (12, 1200, 792, 1400, 1142, {'only_main': True}),
    'kuno_wb1': (12, 1400, 792, 1600, 1142, {'only_main': True}),
    'kuno_r5': (12, 1600, 792, 1800, 1142, {'only_main': True}),
    'kuno_r6': (12, 1800, 792, 2000, 1142, {'only_main': True}),
    'villager_tw0': (12, 0, 1188, 200, 1490, {'only_main': True}),
    'villager_twb0': (12, 200, 1188, 400, 1490, {'only_main': True}),
    'villager_tw1': (12, 400, 1188, 600, 1490, {'only_main': True}),
    'villager_tw2': (12, 600, 1188, 800, 1490, {'only_main': True}),
    'villager_twb1': (12, 800, 1188, 1000, 1490, {'only_main': True}),
    'bandit_w0': (12, 1000, 1188, 1200, 1490, {'only_main': True}),
    'bandit_w1': (12, 1200, 1188, 1400, 1490, {'only_main': True}),
    'bandit_w2': (12, 1400, 1188, 1600, 1490, {'only_main': True}),
    'bandit_w3': (12, 1600, 1188, 1800, 1490, {'only_main': True}),
    'bandit_w4': (12, 1800, 1188, 2000, 1490, {'only_main': True}),
    # ---------------- Vila: construções e objetos (folha 13) ----------------
    'shrine_big': (13, 5, 5, 300, 240, {'keep_all_inner': True, 'scale': 1}),
    'torii_red': (13, 295, 15, 420, 195, {'keep_all_inner': True, 'scale': 1}),
    'shrine_lion': (13, 415, 10, 615, 235, {'keep_all_inner': True, 'scale': 1}),
    'shrine_lanterns': (13, 620, 10, 840, 230, {'keep_all_inner': True, 'scale': 1}),
    'well_a': (13, 20, 245, 120, 355, {'keep_all_inner': True, 'scale': 1}),
    'well_b': (13, 1010, 10, 1150, 155, {'keep_all_inner': True, 'scale': 1}),
    'well_roof': (13, 1340, 10, 1490, 155, {'keep_all_inner': True, 'scale': 1}),
    'well_box': (13, 1675, 10, 1820, 155, {'keep_all_inner': True, 'scale': 1}),
    'shop_a': (13, 5, 480, 200, 650, {'keep_all_inner': True, 'scale': 1}),
    'shop_b': (13, 212, 488, 398, 635, {'keep_all_inner': True, 'scale': 1}),
    'shop_c': (13, 412, 488, 598, 635, {'keep_all_inner': True, 'scale': 1}),
    'shop_d': (13, 600, 480, 790, 650, {'keep_all_inner': True, 'scale': 1}),
    'shop_e': (13, 800, 480, 995, 650, {'keep_all_inner': True, 'scale': 1}),
    'house_fence_a': (13, 5, 650, 240, 845, {'keep_all_inner': True, 'scale': 1}),
    'house_fence_b': (13, 245, 650, 445, 830, {'keep_all_inner': True, 'scale': 1}),
    'house_thatch2': (13, 445, 668, 585, 800, {'keep_all_inner': True, 'scale': 1}),
    'house_fence_c': (13, 595, 655, 795, 835, {'keep_all_inner': True, 'scale': 1}),
    'house_fence_d': (13, 800, 660, 995, 840, {'keep_all_inner': True, 'scale': 1}),
    'store_thatch': (13, 1010, 160, 1160, 330, {'keep_all_inner': True, 'scale': 1}),
    'store_tile': (13, 1340, 165, 1490, 330, {'keep_all_inner': True, 'scale': 1}),
    'store_tile2': (13, 1835, 165, 1985, 330, {'keep_all_inner': True, 'scale': 1}),
    'barn_tile': (13, 1340, 340, 1495, 500, {'keep_all_inner': True, 'scale': 1}),
    'mansion': (13, 1005, 500, 1330, 815, {'keep_all_inner': True, 'scale': 1}),
    'watchtower': (13, 1340, 510, 1490, 740, {'keep_all_inner': True, 'scale': 1}),
    'market_stall': (13, 5, 860, 130, 975, {'keep_all_inner': True, 'scale': 1}),
    'cart': (13, 135, 855, 260, 950, {'keep_all_inner': True, 'scale': 1}),
    'hay_cart': (13, 275, 860, 400, 960, {'keep_all_inner': True, 'scale': 1}),
    'hay': (13, 410, 860, 500, 945, {'keep_all_inner': True, 'scale': 1}),
    'barrel': (13, 755, 868, 815, 940, {'keep_all_inner': True, 'scale': 1}),
    'barrel2': (13, 835, 868, 895, 940, {'keep_all_inner': True, 'scale': 1}),
    'mini_shrine': (13, 905, 860, 1000, 950, {'keep_all_inner': True, 'scale': 1}),
    'bridge_red': (13, 170, 975, 310, 1035, {'keep_all_inner': True, 'scale': 1}),
    'pier': (13, 70, 990, 170, 1035, {'keep_all_inner': True, 'scale': 1}),
    # ---------------- Moradores (folha 13) ----------------
    'farmer0': (13, 1000, 896, 1100, 1016, {'only_main': True, 'scale': 1}),
    'farmer1': (13, 1100, 896, 1200, 1016, {'only_main': True, 'scale': 1}),
    'farmer2': (13, 1200, 896, 1300, 1016, {'only_main': True, 'scale': 1}),
    'farmer3': (13, 1300, 896, 1400, 1016, {'only_main': True, 'scale': 1}),
    'farmer4': (13, 1400, 896, 1500, 1016, {'only_main': True, 'scale': 1}),
    'farmer5': (13, 1500, 896, 1600, 1016, {'only_main': True, 'scale': 1}),
    'farmer6': (13, 1600, 896, 1700, 1016, {'only_main': True, 'scale': 1}),
    'farmer7': (13, 1700, 896, 1800, 1016, {'only_main': True, 'scale': 1}),
    'farmer8': (13, 1800, 896, 1900, 1016, {'only_main': True, 'scale': 1}),
    'farmer9': (13, 1900, 896, 2000, 1016, {'only_main': True, 'scale': 1}),
    'farmer20': (13, 0, 1040, 100, 1157, {'only_main': True, 'scale': 1}),
    'farmer21': (13, 100, 1040, 200, 1157, {'only_main': True, 'scale': 1}),
    'farmer22': (13, 200, 1040, 300, 1157, {'only_main': True, 'scale': 1}),
    'farmer23': (13, 300, 1040, 400, 1157, {'only_main': True, 'scale': 1}),
    'farmer24': (13, 400, 1040, 500, 1157, {'only_main': True, 'scale': 1}),
    'farmer25': (13, 500, 1040, 600, 1157, {'only_main': True, 'scale': 1}),
    'farmer26': (13, 600, 1040, 700, 1157, {'only_main': True, 'scale': 1}),
    'farmer27': (13, 700, 1040, 800, 1157, {'only_main': True, 'scale': 1}),
    'farmer28': (13, 800, 1040, 900, 1157, {'only_main': True, 'scale': 1}),
    'farmer29': (13, 900, 1040, 1000, 1157, {'only_main': True, 'scale': 1}),
    'merchant0': (13, 1000, 1030, 1100, 1145, {'only_main': True, 'scale': 1}),
    'merchant1': (13, 1100, 1030, 1200, 1145, {'only_main': True, 'scale': 1}),
    'merchant2': (13, 1200, 1030, 1300, 1145, {'only_main': True, 'scale': 1}),
    'merchant3': (13, 1300, 1030, 1400, 1145, {'only_main': True, 'scale': 1}),
    'merchant4': (13, 1400, 1030, 1500, 1145, {'only_main': True, 'scale': 1}),
    'merchant5': (13, 1500, 1030, 1600, 1145, {'only_main': True, 'scale': 1}),
    'merchant6': (13, 1600, 1030, 1700, 1145, {'only_main': True, 'scale': 1}),
    'merchant7': (13, 1700, 1030, 1800, 1145, {'only_main': True, 'scale': 1}),
    'merchant8': (13, 1800, 1030, 1900, 1145, {'only_main': True, 'scale': 1}),
    'merchant9': (13, 1900, 1030, 2000, 1145, {'only_main': True, 'scale': 1}),
    'youth0': (13, 0, 1164, 100, 1274, {'only_main': True, 'scale': 1}),
    'youth1': (13, 100, 1164, 200, 1274, {'only_main': True, 'scale': 1}),
    'youth2': (13, 200, 1164, 300, 1274, {'only_main': True, 'scale': 1}),
    'youth3': (13, 300, 1164, 400, 1274, {'only_main': True, 'scale': 1}),
    'youth4': (13, 400, 1164, 500, 1274, {'only_main': True, 'scale': 1}),
    'youth5': (13, 500, 1164, 600, 1274, {'only_main': True, 'scale': 1}),
    'youth6': (13, 600, 1164, 700, 1274, {'only_main': True, 'scale': 1}),
    'youth7': (13, 700, 1164, 800, 1274, {'only_main': True, 'scale': 1}),
    'youth8': (13, 800, 1164, 900, 1274, {'only_main': True, 'scale': 1}),
    'youth9': (13, 900, 1164, 1000, 1274, {'only_main': True, 'scale': 1}),
    'monk_npc0': (13, 1000, 1158, 1100, 1269, {'only_main': True, 'scale': 1}),
    'monk_npc1': (13, 1100, 1158, 1200, 1269, {'only_main': True, 'scale': 1}),
    'monk_npc2': (13, 1200, 1158, 1300, 1269, {'only_main': True, 'scale': 1}),
    'monk_npc3': (13, 1300, 1158, 1400, 1269, {'only_main': True, 'scale': 1}),
    'monk_npc4': (13, 1400, 1158, 1500, 1269, {'only_main': True, 'scale': 1}),
    'miko0': (13, 1500, 1158, 1600, 1269, {'only_main': True, 'scale': 1}),
    'miko1': (13, 1600, 1158, 1700, 1269, {'only_main': True, 'scale': 1}),
    'miko2': (13, 1700, 1158, 1800, 1269, {'only_main': True, 'scale': 1}),
    'miko3': (13, 1800, 1158, 1900, 1269, {'only_main': True, 'scale': 1}),
    'miko4': (13, 1900, 1158, 2000, 1269, {'only_main': True, 'scale': 1}),
    'woman0': (13, 0, 1285, 100, 1385, {'only_main': True, 'scale': 1}),
    'woman1': (13, 100, 1285, 200, 1385, {'only_main': True, 'scale': 1}),
    'woman2': (13, 200, 1285, 300, 1385, {'only_main': True, 'scale': 1}),
    'woman3': (13, 300, 1285, 400, 1385, {'only_main': True, 'scale': 1}),
    'woman4': (13, 400, 1285, 500, 1385, {'only_main': True, 'scale': 1}),
    'woman5': (13, 500, 1285, 600, 1385, {'only_main': True, 'scale': 1}),
    'woman6': (13, 600, 1285, 700, 1385, {'only_main': True, 'scale': 1}),
    'woman7': (13, 700, 1285, 800, 1385, {'only_main': True, 'scale': 1}),
    'woman8': (13, 800, 1285, 900, 1385, {'only_main': True, 'scale': 1}),
    'woman9': (13, 900, 1285, 1000, 1385, {'only_main': True, 'scale': 1}),
    'woman20': (13, 1000, 1280, 1100, 1381, {'only_main': True, 'scale': 1}),
    'woman21': (13, 1100, 1280, 1200, 1381, {'only_main': True, 'scale': 1}),
    'woman22': (13, 1200, 1280, 1300, 1381, {'only_main': True, 'scale': 1}),
    'woman23': (13, 1300, 1280, 1400, 1381, {'only_main': True, 'scale': 1}),
    'woman24': (13, 1400, 1280, 1500, 1381, {'only_main': True, 'scale': 1}),
    'woman25': (13, 1500, 1280, 1600, 1381, {'only_main': True, 'scale': 1}),
    'woman26': (13, 1600, 1280, 1700, 1381, {'only_main': True, 'scale': 1}),
    'woman27': (13, 1700, 1280, 1800, 1381, {'only_main': True, 'scale': 1}),
    'woman28': (13, 1800, 1280, 1900, 1381, {'only_main': True, 'scale': 1}),
    'woman29': (13, 1900, 1280, 2000, 1381, {'only_main': True, 'scale': 1}),
    'elder0': (13, 0, 1396, 100, 1492, {'only_main': True, 'scale': 1}),
    'elder1': (13, 100, 1396, 200, 1492, {'only_main': True, 'scale': 1}),
    'elder2': (13, 200, 1396, 300, 1492, {'only_main': True, 'scale': 1}),
    'elder3': (13, 300, 1396, 400, 1492, {'only_main': True, 'scale': 1}),
    'elder4': (13, 400, 1396, 500, 1492, {'only_main': True, 'scale': 1}),
    'elder5': (13, 500, 1396, 600, 1492, {'only_main': True, 'scale': 1}),
    'elder6': (13, 600, 1396, 700, 1492, {'only_main': True, 'scale': 1}),
    'elder7': (13, 700, 1396, 800, 1492, {'only_main': True, 'scale': 1}),
    'elder8': (13, 800, 1396, 900, 1492, {'only_main': True, 'scale': 1}),
    'elder9': (13, 900, 1396, 1000, 1492, {'only_main': True, 'scale': 1}),
    'elder20': (13, 1000, 1395, 1100, 1492, {'only_main': True, 'scale': 1}),
    'elder21': (13, 1100, 1395, 1200, 1492, {'only_main': True, 'scale': 1}),
    'elder22': (13, 1200, 1395, 1300, 1492, {'only_main': True, 'scale': 1}),
    'elder23': (13, 1300, 1395, 1400, 1492, {'only_main': True, 'scale': 1}),
    'elder24': (13, 1400, 1395, 1500, 1492, {'only_main': True, 'scale': 1}),
    'elder25': (13, 1500, 1395, 1600, 1492, {'only_main': True, 'scale': 1}),
    'elder26': (13, 1600, 1395, 1700, 1492, {'only_main': True, 'scale': 1}),
    'elder27': (13, 1700, 1395, 1800, 1492, {'only_main': True, 'scale': 1}),
    'elder28': (13, 1800, 1395, 1900, 1492, {'only_main': True, 'scale': 1}),
    'elder29': (13, 1900, 1395, 2000, 1492, {'only_main': True, 'scale': 1}),
    'townsman0': (13, 1300, 760, 1400, 880, {'only_main': True, 'scale': 1}),
    'townsman1': (13, 1400, 760, 1500, 880, {'only_main': True, 'scale': 1}),
    'townsman2': (13, 1500, 760, 1600, 880, {'only_main': True, 'scale': 1}),
    'townsman3': (13, 1600, 760, 1700, 880, {'only_main': True, 'scale': 1}),
    'townsman4': (13, 1700, 760, 1800, 880, {'only_main': True, 'scale': 1}),
    'townsman5': (13, 1800, 760, 1900, 880, {'only_main': True, 'scale': 1}),
    'townsman6': (13, 1900, 760, 2000, 880, {'only_main': True, 'scale': 1}),
}

# Cor de fundo de cada folha (as duas primeiras são verde-chroma, a terceira verde-claro).
SHEET_BG = {1: (4, 232, 4), 2: (4, 232, 4), 3: (177, 220, 166), 4: (13, 222, 9), 5: (12, 226, 8),
            6: (4, 234, 1), 7: (9, 218, 2), 8: (11, 219, 3), 9: (174, 219, 162), 10: (12, 228, 9), 11: (76, 130, 78), 12: (13, 235, 0), 13: (3, 252, 60)}


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


CHARACTER_PREFIXES = ('boss_', 'hero_', 'ninja_', 'gray_', 'black_', 'villager_', 'bandit_', 'monk_', 'soldier_', 'kuno_', 'oni_', 'ronin_',
                      'farmer', 'merchant', 'youth', 'miko', 'woman', 'elder', 'townsman')

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
    if opts.get('drop_teal'):
        # remove a árvore azul-petróleo vizinha (folhas do bonsai são verdes: G > B)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        a = np.where((b >= g - 6) & (b > r + 12), 0, a)
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
        if n == biggest[0] or (not border and not opts.get('only_main') and (cnt > 12 or opts.get('keep_all_inner'))):
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


def hair_to_black(img):
    """Cabelo do rōnin: laranja/ruivo -> preto azulado, mantendo luz e sombra.

    O cabelo é separado do resto pela cor: matiz laranja (≈8°–32°), bem
    saturado e só na parte de cima do sprite. Isso deixa de fora o kimono
    (vermelho carmim, matiz < 8°), a pele (pouco saturada), as sandálias
    (embaixo) e o brilho amarelo dos cortes (matiz > 32°).
    """
    a = np.asarray(img).astype(float)
    rgb, alpha = a[..., :3], a[..., 3:]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    hue = np.where(mx == r, (60 * (g - b) / np.maximum(mx - mn, 1)) % 360, 0)
    h = rgb.shape[0]
    rows = np.arange(h)[:, None] < h * 0.78
    # tons laranja vivos + sombras marrom-avermelhadas (verde > azul = cor "quente");
    # o carmim do kimono tem azul >= verde e fica de fora
    warm_shadow = (hue < 8) & (g >= b + 4) & (sat > 0.45) & (r > 35)
    hair = (((hue >= 8) & (hue <= 32) & (sat > 0.5) & (r > 70)) | warm_shadow) & rows & (mx == r)
    # fios vermelhos DENTRO do cabelo: viram cabelo só se a vizinhança 5×5 já
    # for, em boa parte, cabelo (assim o kimono, que é uma área contínua, fica de fora)
    red = ((hue < 12) | (hue > 348)) & (sat > 0.4) & (mx == r) & rows & (alpha[..., 0] > 0)
    for _ in range(2):
        count = np.zeros(hair.shape)
        hf = hair.astype(float)
        for dy in (-2, -1, 0, 1, 2):
            for dx in (-2, -1, 0, 1, 2):
                count += np.roll(np.roll(hf, dy, 0), dx, 1)
        hair = hair | (red & (count >= 9))
    # contorno do cabelo: borda alaranjada/amarelada (mistura do ruivo com o fundo verde)
    ring = hair.copy()
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            ring |= np.roll(np.roll(hair, dy, 0), dx, 1)
    A = alpha[..., 0]
    edge = A < 250
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            edge |= np.roll(np.roll(A < 40, dy, 0), dx, 1)
    hair |= ring & edge & (hue >= 12) & (hue <= 100) & (sat > 0.18) & rows & (A > 0)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    v = lum * 0.38 + 8
    black = np.stack([v * 0.95, v * 0.97, v * 1.12], -1)
    out = np.where(hair[..., None], black, rgb)
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), alpha], -1).astype(np.uint8), 'RGBA')


def crown_to_black(img, frac):
    """No topo do sprite (só cabeça), qualquer tom vermelho/laranja vira cabelo preto."""
    a = np.asarray(img).astype(float)
    rgb, A = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    rows = np.arange(A.shape[0])[:, None] < A.shape[0] * frac
    skin = (r > 150) & (g > 100) & (g > b + 15)  # pele clara fica
    m = rows & (r > g + 25) & (r > b + 20) & ~skin & (A > 0)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    v = lum * 0.38 + 8
    out = np.where(m[..., None], np.stack([v * 0.95, v * 0.97, v * 1.12], -1), rgb)
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), A[..., None]], -1).astype(np.uint8), 'RGBA')


def darken_fringe(img):
    """Escurece a franja amarelada/oliva colada na borda transparente (parte de cima)."""
    a = np.asarray(img).astype(float)
    rgb, A = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    edge = np.zeros(A.shape, bool)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            edge |= np.roll(np.roll(A < 60, dy, 0), dx, 1)
    rows = np.arange(A.shape[0])[:, None] < A.shape[0] * 0.55
    warm = (r > b + 18) & (g > b + 10) & (A > 0)
    m = edge & warm & rows
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    v = lum * 0.38 + 8
    out = np.where(m[..., None], np.stack([v * 0.95, v * 0.97, v * 1.12], -1), rgb)
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), A[..., None]], -1).astype(np.uint8), 'RGBA')


def walk_frame(img, k):
    """Quadro k (0..7) de uma caminhada de frente: cada metade (perna) da parte de
    baixo é comprimida para cima em turnos, como se o pé saísse do chão."""
    import math
    a = np.asarray(img).copy()
    h, w = a.shape[:2]
    ys, xs = np.nonzero(a[..., 3] > 40)
    cx = int((xs[ys > h * 0.85].min() + xs[ys > h * 0.85].max()) / 2)
    hip = int(h * 0.66)
    ph = k / 8 * 2 * math.pi
    out = a.copy()
    for side, lift in ((0, max(0.0, math.sin(ph))), (1, max(0.0, -math.sin(ph)))):
        cols = slice(0, cx) if side == 0 else slice(cx, w)
        seg = a[hip:, cols]
        L = h - hip
        newL = int(round(L - lift * h * 0.15))
        if newL >= L:
            continue
        part = Image.fromarray(seg).resize((seg.shape[1], newL), Image.LANCZOS)
        blk = np.zeros_like(seg)
        blk[:newL] = np.asarray(part)
        out[hip:, cols] = blk
    return Image.fromarray(out, 'RGBA')


import math


def _sample_row(row, cx, s):
    """reamostra uma linha RGBA comprimindo/esticando em torno de cx (fator s)."""
    w = row.shape[0]
    xs = cx + (np.arange(w) - cx) / s
    x0 = np.floor(xs).astype(int); fr = (xs - x0)[:, None]
    ok = (x0 >= 0) & (x0 + 1 < w)
    x0c = np.clip(x0, 0, w - 2)
    out = row[x0c] * (1 - fr) + row[x0c + 1] * fr
    out[~ok] = 0
    return out

def stride_frame(img, k, hip_frac=0.6, close=0.45, lift=0.08, swing=0.0):
    """Quadro k (0..7) de passada: as pernas (abaixo do quadril) abrem e fecham como
    tesoura duas vezes por ciclo (contato em 0/4, passagem em 2/6) e a perna que
    passa sobe um pouco."""
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    h, w = a.shape[:2]
    ys, xs = np.nonzero(a[..., 3] > 40)
    low = ys > h * 0.85
    cx = (xs[low].min() + xs[low].max()) / 2
    hip = int(h * hip_frac)
    L = h - hip
    ph = k / 8 * 2 * math.pi
    f = 1 - close * (1 - abs(math.cos(ph)))  # 1 no contato, 1-close na passagem
    out = a.copy()
    for y in range(hip, h):
        t = (y - hip) / L
        s = 1 - (1 - f) * t
        out[y] = _sample_row(a[y], cx + swing * math.sin(ph) * t * w, s)
    # perna que passa sobe (metade esquerda e direita alternam)
    up = abs(math.sin(ph))
    side = 0 if math.sin(ph) > 0 else 1
    ic = int(round(cx))
    cols = slice(0, ic) if side == 0 else slice(ic, w)
    newL = int(round(L - up * lift * h))
    if newL < L:
        seg = out[hip:, cols].clip(0, 255).astype(np.uint8)
        part = np.asarray(Image.fromarray(seg).resize((seg.shape[1], newL), Image.LANCZOS)).astype(np.float32)
        blk = np.zeros_like(seg, dtype=np.float32); blk[:newL] = part
        out[hip:, cols] = blk
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')


DEBASE = ('forest_mixed', 'forest_bamboo_pine', 'forest_dark', 'bamboo_grove', 'forest_sakura',
          'forest_broadleaf', 'forest_pines', 'bonsai_pine')


def debase(img, top_frac=0.45):
    """Remove o 'chão' isométrico pintado sob árvores/moitas (losango verde liso)
    e fragmentos soltos de vizinhos que vieram no recorte."""
    from scipy import ndimage as ndi  # pip install scipy
    a = np.asarray(img.convert('RGBA')).astype(float)
    h, w = a.shape[:2]
    rgb = a[..., :3]
    lum = rgb.mean(-1)
    # textura local: folhas têm contorno e brilho; o chão é liso
    blur = ndi.uniform_filter(lum, 5)
    var = ndi.uniform_filter((lum - blur) ** 2, 7)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = (g > r * 1.08) & (g > b * 1.15) & (lum > 40) & (lum < 140)
    smooth = var < 140
    # chão sombreado (sob as copas): mais escuro, só perto da base
    dark = (g > r * 1.03) & (g > b * 0.98) & (lum > 16) & (lum <= 60) & (var < 90)
    yy = np.arange(h)[:, None] * np.ones((1, w))
    cand = ((green & smooth & (yy > h * (1 - top_frac))) | (dark & (yy > h * 0.78))) & (a[..., 3] > 0)
    cand = ndi.binary_opening(cand, iterations=1)
    lab, n = ndi.label(cand)
    if n:
        sizes = ndi.sum(cand, lab, range(1, n + 1))
        # só regiões grandes que encostam na faixa de baixo (o chão), não buracos na copa
        bottom = set(np.unique(lab[int(h * 0.85):][lab[int(h * 0.85):] > 0]))
        ids = [i + 1 for i in range(n) if sizes[i] > w * h * 0.004 and (i + 1) in bottom]
        keep = np.isin(lab, ids)
        keep = ndi.binary_closing(keep, iterations=3)
        keep = ndi.binary_fill_holes(keep) & (a[..., 3] > 0) & ~(~green & ~dark & (var > 300))
        # contorno escuro do losango: escuro e não marrom (tronco é marrom)
        ring = ndi.binary_dilation(keep, iterations=3) & ~keep
        keep |= ring & (lum < 75) & (r <= g + 4)
        soft = ndi.gaussian_filter(keep.astype(float), 1.0)
        a[..., 3] *= 1 - np.clip(soft * 1.4, 0, 1)
    # fragmentos soltos: só fica o maior componente e os que forem grandes
    op = a[..., 3] > 30
    lab, n = ndi.label(op)
    if n > 1:
        sizes = ndi.sum(op, lab, range(1, n + 1))
        big = sizes.max()
        drop = np.isin(lab, 1 + np.nonzero(sizes < big * 0.12)[0])
        a[..., 3][drop] = 0
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------------------
# Folha 14 (19.jpg): modo "Caminho do Rōnin" — sprites DE PERFIL em tons de
# cinza sobre fundo cinza-claro liso (~213). Em vez de chroma key, o fundo é
# achado por inundação a partir das bordas de cada recorte: o miolo claro da
# hakama fica de fora porque é cercado pelo contorno escuro.
# (x0, y0, x1, y1, opções) — tol: tolerância do fundo; dark: (x_lim, v_max)
# remove o "fantasma" claro do golpe à esquerda de x_lim.
SIDE_FRAMES = {
    'rs_walk0': (17, 70, 141, 302, {}), 'rs_walk1': (145, 70, 269, 302, {}),
    'rs_walk2': (273, 70, 397, 302, {}), 'rs_walk3': (402, 70, 527, 302, {}),
    'rs_atk0': (568, 80, 702, 306, {}), 'rs_atk1': (800, 64, 980, 306, {}),
    'rs_atk2': (962, 80, 1122, 306, {}),
    'rs_block0': (1134, 38, 1264, 306, {}), 'rs_block1': (1266, 8, 1395, 306, {}),
    'rs_die0': (1452, 85, 1581, 306, {}), 'rs_die1': (1578, 90, 1701, 306, {}),
    'rs_die2': (1700, 118, 1809, 304, {}), 'rs_die3': (1807, 118, 1997, 304, {}),
    'ns_walk0': (6, 455, 145, 688, {}), 'ns_walk1': (144, 455, 271, 688, {}),
    'ns_walk2': (267, 455, 406, 688, {}), 'ns_walk3': (399, 455, 528, 688, {}),
    'ns_atk0': (550, 455, 700, 688, {'darkR': (674, 75)}), 'ns_atk1': (776, 455, 926, 688, {'dark': (806, 70)}),
    'ns_atk2': (897, 455, 1128, 688, {}),
    'ns_block0': (1128, 445, 1251, 688, {}), 'ns_block1': (1250, 445, 1368, 688, {}),
    'ns_block2': (1366, 445, 1493, 688, {}),
    'ns_die0': (1516, 480, 1679, 688, {}), 'ns_die1': (1660, 490, 1820, 688, {}),
    'ns_die2': (1807, 575, 2000, 690, {}),
    # cenário de perfil
    'ss_house_long': (0, 806, 552, 1158, {'bg': 163, 'tol': 7}), 'ss_house_tile': (655, 703, 1150, 1152, {'bg': 156, 'tol': 24}),
    'ss_lantern': (479, 1012, 546, 1150, {'bg': 163, 'tol': 7, 'light': 178}),
   
    'ss_ground': (1252, 814, 1560, 962, {'raw': True}), 'ss_wall': (1160, 1022, 1540, 1191, {'raw': True}),
}


def side_sheet(path):
    """Recorta a folha de perfil; devolve {nome: (img RGBA, (ax, ay))}."""
    from scipy import ndimage as ndi
    g = np.asarray(Image.open(path).convert('L')).astype(int)
    out = {}
    for name, (x0, y0, x1, y1, o) in SIDE_FRAMES.items():
        c = g[y0:y1, x0:x1]
        h, w = c.shape
        if o.get('raw'):  # ladrilho opaco (chão, muro)
            rgba = np.dstack([c, c, c, np.full_like(c, 255)]).astype(np.uint8)
            out[name] = (Image.fromarray(rgba, 'RGBA'), (w / 2, h))
            continue
        near = np.abs(c - o.get('bg', 213)) <= o.get('tol', 10)
        if 'light' in o:  # parede clara atrás do objeto também conta como fundo
            near |= c >= o['light']
        lab, _ = ndi.label(near)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        fg = ~np.isin(lab, list(border))
        if 'dark' in o:
            xl, vmax = o['dark']
            cols = np.arange(w)[None, :] + x0 < xl
            fg &= ~(cols & (c > vmax))
        if 'darkR' in o:  # idem, à direita
            xl, vmax = o['darkR']
            cols = np.arange(w)[None, :] + x0 >= xl
            fg &= ~(cols & (c > vmax))
        fg = ndi.binary_opening(fg, iterations=1)
        # só o corpo principal (+ pedaços grandes, ex.: o arco do corte)
        lab, n = ndi.label(fg)
        if n > 1:
            sizes = ndi.sum(fg, lab, range(1, n + 1))
            fg = np.isin(lab, 1 + np.nonzero(sizes >= sizes.max() * 0.08)[0])
        fg = ndi.binary_erosion(fg, iterations=1)  # tira o halo claro do JPG
        alpha = (ndi.gaussian_filter(fg.astype(float), 0.6) * 255).clip(0, 255)
        rgba = np.dstack([c, c, c, alpha]).astype(np.uint8)
        ys, xs = np.nonzero(fg)
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = rgba[by0:by1, bx0:bx1]
        fgc = fg[by0:by1, bx0:bx1]
        hh = by1 - by0
        # apoio: pés embaixo; x no centro do tronco (não balança com o passo)
        band = fgc[int(hh * 0.3):int(hh * 0.55)]
        bys, bxs = np.nonzero(band)
        ax = float(bxs.mean()) if len(bxs) else (bx1 - bx0) / 2
        out[name] = (Image.fromarray(rgba, 'RGBA'), (round(ax, 1), float(hh)))
    return out



def main(*paths):
    # folhas: 1 boss, 2 herói/ninjas/casas, 3 floresta, 4 acampamento, 5 mini-chefes,
    #         6 oni/rōnin de costas, 7 kunoichi de costas, 8 aldeões/bandido de costas, 9 floresta 2
    sheets = {i + 1: np.asarray(Image.open(p).convert('RGB')) for i, p in enumerate(paths)}
    os.makedirs(OUT, exist_ok=True)
    atlas = {}
    for name, (s, x0, y0, x1, y1, opts) in FRAMES.items():
        if s in (3, 9) and 'feather' not in opts and name != 'torii':
            opts = {**opts, 'feather': 10}
        img, solid, fixed = extract(sheets[s], x0, y0, x1, y1, opts, name.startswith(CHARACTER_PREFIXES), SHEET_BG[s])
        ax, ay = fixed or feet_anchor(solid)
        if name in ANCHOR_X:
            ax = ANCHOR_X[name] / SCALE
        w, h = img.size
        sc = opts.get('scale', SCALE)
        nw, nh = max(1, round(w * sc)), max(1, round(h * sc))
        img = img.resize((nw, nh), Image.LANCZOS)
        if name.startswith('hero_'):
            img = hair_to_black(img)  # o rōnin agora tem cabelo preto
        if name.startswith(('hero_bw', 'hero_bd', 'hero_sw')):
            img = crown_to_black(img, 0.2)  # mechas avermelhadas no alto da cabeça
        if name in DEBASE:
            img = debase(img)  # sem o losango de chão pintado (aparecia como "quadriculado")
        if name.startswith(('hero_back_', 'hero_front')):
            img = darken_fringe(img)  # folha pequena: contorno dourado na borda do cabelo
        img.save(os.path.join(OUT, name + '.png'), optimize=True)
        atlas[name] = {'w': nw, 'h': nh, 'ax': round(ax * sc, 1), 'ay': round(ay * sc, 1)}
        print(f'{name:14s} {nw:4d}x{nh:<4d} anchor=({atlas[name]["ax"]}, {atlas[name]["ay"]})')
    for src in RECOLOR_SOURCES:
        base = Image.open(os.path.join(OUT, src + '.png'))
        for tag, (gain, off) in RECOLORS.items():
            name = src.replace('ninja_', tag + '_')
            recolor(base, gain, off).save(os.path.join(OUT, name + '.png'), optimize=True)
            atlas[name] = dict(atlas[src])
    # Caminhada DE FRENTE (a folha não traz): 8 quadros gerados a partir da pose de
    # frente, levantando alternadamente a perna esquerda e a direita.
    front = Image.open(os.path.join(OUT, 'hero_front.png'))
    for k in range(8):
        f = stride_frame(walk_frame(front, k), k, hip_frac=0.62, close=0.22, lift=0.0)
        f.save(os.path.join(OUT, f'hero_fw{k}.png'), optimize=True)
        atlas[f'hero_fw{k}'] = dict(atlas['hero_front'])
    # Caminhada de PERFIL: na folha a hakama fica quase sempre aberta (as pernas
    # parecem paradas). Reforça a passada: as pernas fecham na passagem (quadros
    # 2 e 6), abrem no contato (0 e 4) e a perna que passa sobe.
    for k in range(8):
        p = os.path.join(OUT, f'hero_sw{k}.png')
        stride_frame(Image.open(p), k).save(p, optimize=True)
    # folha 14: sprites de perfil do modo Caminho do Rōnin
    if len(paths) >= 14:
        for name, (img, (ax, ay)) in side_sheet(paths[13]).items():
            img.save(os.path.join(OUT, name + '.png'), optimize=True)
            atlas[name] = {'w': img.width, 'h': img.height, 'ax': ax, 'ay': ay}
    with open(os.path.join(ROOT, 'js', 'atlas.js'), 'w') as f:
        f.write('/* Gerado por tools/extract_sprites.py — não editar à mão.\n'
                ' * w/h: tamanho do PNG; ax/ay: ponto de apoio (pés) em pixels do PNG. */\n')
        f.write('const ATLAS = ' + json.dumps(atlas, indent=1) + ';\n')


if __name__ == '__main__':
    main(*sys.argv[1:])
