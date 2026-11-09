/**
 * region.js — A região inteira num mapa contínuo.
 *
 * As quatro vilas (geradas por ProcGen a partir dos modelos em stages.js) ficam
 * lado a lado numa faixa leste-oeste, ligadas por ESTRADAS na mata, e o
 * santuário do Gendō fecha a faixa no alto da montanha:
 *
 *   [Kiriyama]──estrada──[Hanamura]──trilha──[Sagino]──estrada──[Kurogane]──subida──[Santuário]
 *
 * Cada zona é separada da próxima por um cinturão de mata fechada; a estrada
 * atravessa por uma passagem bloqueada por uma barricada dos bandidos, que só
 * cai quando o guardião da vila é derrotado. Não há mais portal: o rōnin anda
 * de uma vila à outra.
 *
 * A semente é sorteada a cada jogo novo e guardada no save: dentro da mesma
 * jornada o mapa é sempre o mesmo (morrer e continuar não muda o mundo).
 */

const REGION = { H: 60, villageW: 62, roadW: [30, 32, 30, 26] };

/** As estradas entre as zonas. */
const ROADS = [
  {
    name: 'Estrada do Leste', kanji: '東街道', ground: 'village', ambient: 'leaves',
    forest: ['pine', 'forest_pines', 'tree_small', 'bonsai_pine', 'forest_mixed', 'sakura'],
    ambushes: [[['brute', 'blue']], [['blue', 'gray', 'brute']]],
  },
  {
    name: 'Trilha dos Bambus', kanji: '竹の道', ground: 'forest', ambient: 'leaves',
    forest: ['bamboo', 'bamboo', 'bamboo_grove', 'pine', 'bamboo'],
    ambushes: [[['gray', 'black']], [['brute', 'black', 'gray']]],
  },
  {
    name: 'Estrada Mineira', kanji: '鉱山道', ground: 'camp', ambient: 'embers',
    forest: ['pine', 'forest_pines', 'bonsai_pine', 'tree_small', 'forest_dark'],
    ambushes: [[['rifle', 'brute']], [['rifle', 'gray', 'blue']]],
  },
  {
    name: 'Subida do Monte Kurokama', kanji: '黒鎌山', ground: 'forest', ambient: 'leaves',
    forest: ['pine', 'forest_pines', 'forest_dark', 'bonsai_pine'],
    ambushes: [[['black', 'rifle', 'brute']]],
  },
];

/**
 * Falas dos moradores. `ask`: quem pede ajuda ao rōnin quando ele chega;
 * `thanks`: dito quando o guardião da vila cai (a estrada para a próxima abre).
 */
const VILLAGE_TALK = [
  {
    npc: 'elder', speaker: 'Ancião Sōbei',
    ask: [
      ['Ancião Sōbei', 'Senhor andarilho! Espere, por favor... o senhor carrega uma espada.'],
      ['Ancião Sōbei', 'Na noite passada os saqueadores do clã Kurokama incendiaram Kiriyama e levaram o Espelho da Lua, a relíquia que protege esta aldeia há trezentos anos.'],
      ['Ancião Sōbei', 'Alguns ainda estão aqui, amarrando nossa gente. E o brutamontes deles, Gōriki, guarda a saída leste da aldeia.'],
      ['Rōnin', 'Guarde suas lágrimas, ojii-san. Eu cuidarei disso.'],
    ],
    thanks: [
      ['Ancião Sōbei', 'O oni caiu! Os bandidos fugiram pela Estrada do Leste, rumo a Hanamura.'],
      ['Ancião Sōbei', 'A barricada deles foi derrubada. Que os deuses guiem seus passos, rōnin.'],
    ],
  },
  {
    npc: 'woman', speaker: 'Senhora Ochiyo',
    ask: [
      ['Senhora Ochiyo', 'Um viajante? Graças aos deuses...'],
      ['Senhora Ochiyo', 'Batedores do clã cobram "proteção" de todos nós. Ao amanhecer, homens de preto atravessaram a vila carregando um baú com o brasão de uma foice.'],
      ['Senhora Ochiyo', 'A chefe deles, Kagerō, se move como uma sombra. Ela vigia o caminho para a floresta.'],
    ],
    thanks: [
      ['Senhora Ochiyo', 'Kagerō fugiu! O baú com a foice seguiu pela Trilha dos Bambus, para a floresta de Sagino.'],
    ],
  },
  {
    npc: 'farmer', speaker: 'Lenhador Gonta',
    ask: [
      ['Lenhador Gonta', 'Cuidado onde pisa, forasteiro. Sagino virou covil de assassinos.'],
      ['Lenhador Gonta', 'Eles atiram kunais envenenadas do meio dos bambus. Dá para rebatê-las com a espada, se tiver reflexos.'],
      ['Lenhador Gonta', 'Quem manda neles é Jōkai, um monge expulso do templo. Fica na clareira de pedra, perto da saída.'],
    ],
    thanks: [
      ['Lenhador Gonta', 'O monge renegado caiu! O rastro do baú segue para Kurogane, a vila mineira que o clã tomou.'],
    ],
  },
  {
    npc: 'merchant', speaker: 'Mercador Heiji',
    ask: [
      ['Mercador Heiji', 'Kurogane é deles agora. Soldados desertores do exército com rifles e um rōnin mercenário, Jūrō.'],
      ['Mercador Heiji', 'Jūrō guarda o caminho da montanha. Lá em cima fica o santuário de Kurokama, onde mora o líder do clã.'],
    ],
    thanks: [
      ['Mercador Heiji', 'Jūrō foi vencido! O caminho do santuário está aberto.'],
      ['Mercador Heiji', 'Gendō, o Ceifador, espera lá em cima com o Espelho da Lua. Uma tempestade se forma na montanha...'],
    ],
  },
];

/** Sprites dos moradores (quadros parecidos usados como ciclo de caminhada). */
const TOWNSFOLK = {
  farmer: ['farmer0', 'farmer1', 'farmer3', 'farmer4'],
  farmer2: ['farmer20', 'farmer21', 'farmer22', 'farmer23'],
  merchant: ['merchant0', 'merchant1', 'merchant2', 'merchant3'],
  youth: ['youth0', 'youth1', 'youth2', 'youth3'],
  monk: ['monk_npc0', 'monk_npc1', 'monk_npc2'],
  miko: ['miko0', 'miko1', 'miko2', 'miko3'],
  woman: ['woman0', 'woman1', 'woman2', 'woman3'],
  woman2: ['woman20', 'woman21', 'woman22', 'woman23'],
  elder: ['elder0', 'elder1', 'elder2', 'elder3'],
  elder2: ['elder20', 'elder21', 'elder22', 'elder23'],
  townsman: ['townsman0', 'townsman1', 'townsman2', 'townsman3'],
};

/** Construções novas espalhadas pelas vilas (além das casas do modelo). */
const VILLAGE_EXTRAS = {
  kiriyama: ['well_a', 'house_fence_a', 'store_thatch', 'hay_cart', 'market_stall', 'house_thatch2', 'barrel'],
  hanamura: ['shop_a', 'shop_b', 'shop_c', 'well_roof', 'market_stall', 'house_fence_b', 'mini_shrine'],
  sagino: ['house_thatch2', 'well_b', 'hay', 'cart', 'store_thatch'],
  kurogane: ['store_tile', 'store_tile2', 'barn_tile', 'watchtower', 'watchtower', 'cart', 'shop_d', 'well_box', 'barrel2'],
};

function shiftPts(pts, dx, dy = 0) {
  return pts.map(([x, y, ...r]) => [x + dx, y + dy, ...r]);
}

/** Objetos de cenário são [tipo, x, y]. */
function shiftProps(props, dx, dy = 0) {
  return props.map(([t, x, y, ...r]) => [t, x + dx, y + dy, ...r]);
}

/** Monta a região completa (formato de "stage" que Level e main.js entendem). */
function buildRegion(seed) {
  const rnd = makeRng(seed);
  const H = REGION.H;
  const st = {
    id: 'region', size: [0, H], path: [], trails: [], plazas: [], props: [], waves: [], loot: [],
    smoke: [], clear: [], scatters: [], zones: [], braziers: [], shots: [], decor: 0, boss: null,
  };
  let x = 0;
  let y = H * 0.5 + (rnd() - 0.5) * 16;
  const junctions = []; // [x, y, zona que ela fecha (barricada) ou -1]

  const addRoad = (ri, x0, y0, y1) => {
    const R = ROADS[ri], Wr = REGION.roadW[ri];
    const pts = [[x0, y0]];
    const n = 4;
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      pts.push([x0 + Wr * t, clamp(y0 + (y1 - y0) * t + (rnd() - 0.5) * 16, 7, H - 7)]);
    }
    pts.push([x0 + Wr, y1]);
    st.path.push(...pts.slice(1));
    const zone = {
      index: st.zones.length, kind: 'road', name: R.name, kanji: R.kanji, ground: R.ground, ambient: R.ambient,
      x0, x1: x0 + Wr,
    };
    st.zones.push(zone);
    R.ambushes.forEach((groups, k) => {
      const t = R.ambushes.length === 1 ? 0.5 : 0.3 + 0.4 * k;
      const q = ProcGen.pointAt(pts, t);
      st.waves.push({ center: [q.x, q.y], r: 5.6, groups, zone: zone.index });
    });
    st.scatters.push({ seed: Math.floor(rnd() * 1e6), count: Math.round(Wr * H * 0.07), types: R.forest, x0, x1: x0 + Wr });
    return pts;
  };

  for (let i = 0; i < 4; i++) {
    const T = STAGES[i];
    const W = REGION.villageW;
    const endY = 12 + rnd() * (H - 24);
    const v = ProcGen.generate({ ...T, size: [W, H], startY: y, endY, seal: false }, seed * 7 + i * 101);
    const zone = {
      index: st.zones.length, kind: 'village', village: i, id: T.id, name: T.name, kanji: T.kanji,
      ground: T.ground, ambient: T.ambient, x0: x, x1: x + W, objective: T.objective,
      talk: VILLAGE_TALK[i], start: [v.start[0] + x, v.start[1]],
    };
    st.zones.push(zone);
    st.path.push(...shiftPts(v.path, x).slice(i === 0 ? 0 : 1));
    st.trails.push(...v.trails.map((t) => shiftPts(t, x)));
    st.plazas.push(...shiftPts(v.plazas, x));
    st.props.push(...shiftProps(v.props, x));
    st.loot.push(...v.loot.map((l) => (l[0] === 'item' ? [l[0], l[1], l[2] + x, l[3]] : [l[0], l[1] + x, l[2]])));
    st.smoke.push(...shiftPts(v.smoke, x));
    st.clear.push(...shiftPts(v.clear, x));
    st.shots.push(...v.shots.map((s) => ({ ...s, at: [s.at[0] + x, s.at[1]] })));
    st.waves.push(...v.waves.map((wv) => ({ ...wv, center: [wv.center[0] + x, wv.center[1]], zone: zone.index })));
    if (v.scatter) st.scatters.push({ ...v.scatter, x0: x, x1: x + W });
    st.decor += v.decor;
    if (v.boss) {
      zone.boss = { ...v.boss, center: [v.boss.center[0] + x, v.boss.center[1]], spawn: [v.boss.spawn[0] + x, v.boss.spawn[1]] };
    }
    // Quem pede ajuda espera à beira da estrada, logo na entrada da vila.
    const g = ProcGen.pointAt(shiftPts(v.path, x), 0.06);
    zone.greeter = [g.x + 0.5, g.y + 2.2];
    // Construções novas da folha de vila.
    zone.extras = VILLAGE_EXTRAS[T.id] || [];
    zone.townCenter = (() => { const q = ProcGen.pointAt(shiftPts(v.path, x), 0.45); return [q.x, q.y]; })();
    x += W;
    y = endY;
    junctions.push([x, y, zone.index]);
    // estrada até a próxima zona
    let y1;
    if (i < 3) y1 = H * 0.5 + (rnd() - 0.5) * 16;
    else st.shrineOy = clamp(Math.round(y - 22 + (rnd() - 0.5) * 6), 3, H - 29), y1 = st.shrineOy + 24.5;
    addRoad(i, x, y, y1);
    x += REGION.roadW[i];
    y = y1;
    junctions.push([x, y, -1]);
  }

  // Santuário (fixo), encaixado no fim da subida.
  const S = STAGES[4], ox = x, oy = st.shrineOy;
  const shrineZone = {
    index: st.zones.length, kind: 'shrine', name: S.name, kanji: S.kanji, ground: 'storm', ambient: null,
    weather: 'storm', x0: x, x1: x + S.size[0], objective: S.objective,
  };
  st.zones.push(shrineZone);
  st.path.push(...shiftPts(S.path, ox, oy));
  st.plazas.push(...S.plazas.map(([px, py, r]) => [px + ox, py + oy, r, 'mosaic']));
  st.props.push(...shiftProps(S.props, ox, oy));
  st.braziers.push(...shiftPts(S.braziers, ox, oy));
  st.clear.push(...shiftPts(S.clear, ox, oy));
  st.scatters.push({ seed: Math.floor(rnd() * 1e6), count: 70, types: ['pine', 'forest_pines', 'forest_dark', 'bonsai_pine', 'bamboo'], x0: x, x1: x + S.size[0] });
  const B = S.boss;
  shrineZone.boss = {
    ...B, center: [B.center[0] + ox, B.center[1] + oy], spawn: [B.spawn[0] + ox, B.spawn[1] + oy], relic: [B.relic[0] + ox, B.relic[1] + oy],
  };
  shrineZone.start = [ox + 3, oy + 22];
  x += S.size[0];
  st.size = [Math.ceil(x), H];

  // Cinturões de mata entre as zonas, com uma passagem na estrada.
  // Na saída de cada vila a passagem é fechada por uma barricada dos bandidos.
  for (const [bx, by, zi] of junctions) {
    for (let yy = 0.4; yy < H - 0.3; yy += 0.82) {
      if (Math.abs(yy - by) < 2.8) continue;
      const t = rnd();
      const type = t < 0.6 ? 'bamboo' : t < 0.85 ? 'pine' : 'bonsai_pine';
      st.props.push([type, bx + (rnd() - 0.5) * 0.4, yy]);
    }
    if (zi >= 0) {
      for (const k of [-0.95, 0.85, 2.65]) st.props.push(['fence', bx + 0.2, by + k, 'barricade' + zi]);
      st.props.push(['crate_tied', bx - 0.9, by - 2.9, 'barricade' + zi], ['crate', bx - 0.8, by + 3.3, 'barricade' + zi]);
    }
    st.clear.push([bx, by, 2.4]);
  }
  st.junctions = junctions;
  st.start = [st.zones[0].start[0] + 3, st.zones[0].start[1]];
  st.establish = [st.start[0] + 6, st.start[1] - 4, 1.2];
  return st;
}
