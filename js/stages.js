/**
 * stages.js — As vilas da jornada.
 *
 * As quatro vilas são MODELOS para o gerador procedural (js/procgen.js): aqui
 * ficam só o que dá identidade à vila (nome, história, clima, tipos de casa,
 * grupos de inimigos, tesouro). Caminho, casas, emboscadas, acampamentos,
 * baús e reféns mudam a cada vez que o jogador entra.
 *
 *  ambushes — grupos das emboscadas do caminho (em ciclo; `ambushCount` define quantas). Cada lista interna é um
 *             grupo; todos já estão no mapa, escondidos atrás de casas/árvores.
 *  camps    — grupos dos acampamentos (em ciclo; `campCount` define quantos). O 1º grupo vira bandidos
 *             bebendo/dormindo em volta da fogueira; os demais ficam de vigia.
 *  item     — tesouro guardado no baú de um dos acampamentos (outro guarda o selo,
 *             os demais guardam comida).
 *  miniboss — guardião da vila (js/miniboss.js), na arena antes do portão.
 *  size     — 67×67 tiles: 5× a área da versão original (30×30).
 *
 * O santuário final (boss) continua desenhado à mão.
 */

/** Anel de lanternas em volta de um ponto, pulando os ângulos indicados (graus). */
function lanternRing(cx, cy, r, count, skip = []) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const deg = (k / count) * 360;
    if (skip.some(([a, b]) => deg >= a && deg <= b)) continue;
    const a = (deg * Math.PI) / 180;
    out.push(['lantern2', cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

const STAGES = [
  {
    id: 'kiriyama',
    name: 'Aldeia de Kiriyama',
    kanji: '霧山村',
    procedural: true,
    ground: 'village',
    ambient: 'embers',
    size: [67, 67],
    story: [
      'Japão, 11º ano da Era Meiji. As espadas foram proibidas nas ruas, mas os saqueadores do clã Kurokama não obedecem a lei alguma.',
      'Na noite passada eles invadiram Kiriyama, incendiaram as casas e levaram o Espelho da Lua — a relíquia sagrada que protege a aldeia há trezentos anos.',
      'Um rōnin sem mestre, que encontrou abrigo nesta aldeia, desembainha a espada mais uma vez.',
    ],
    objective: 'Expulse os saqueadores que ficaram para trás',
    shrine: true,
    plaza: false,
    houses: { types: ['house_thatch', 'house_thatch', 'house_tile', 'house_tile2'], count: [6, 8] },
    lanterns: 4,
    smoke: 3,
    scatter: { count: 12, types: ['sakura', 'sakura', 'crate_small'] },
    item: 'tamahagane',
    ambushCount: 7,
    campCount: 5,
    miniboss: 'oni',
    bossAdds: ['blue', 'blue', 'gray'],
    ambushes: [
      [['blue', 'blue', 'blue']],
      [['blue', 'blue', 'gray'], ['blue', 'blue']],
      [['gray', 'blue', 'blue']],
    ],
    camps: [
      [['blue', 'gray'], ['blue', 'blue']],
      [['blue', 'blue', 'gray'], ['gray']],
    ],
  },
  {
    id: 'hanamura',
    name: 'Vila de Hanamura',
    kanji: '花村',
    procedural: true,
    ground: 'sakura',
    ambient: 'petals',
    size: [67, 67],
    story: [
      'Hanamura floresce como se nada tivesse acontecido.',
      'Mas os aldeões sussurram: homens de preto atravessaram a vila ao amanhecer, carregando um baú selado com o brasão de uma foice.',
      'Alguns deles ainda estão aqui — cobrando "proteção" à força.',
    ],
    objective: 'Liberte Hanamura dos batedores do clã',
    plaza: true,
    houses: { types: ['house_tile', 'house_tile2', 'house_tile', 'house_thatch'], count: [7, 9] },
    lanterns: 6,
    scatter: { count: 16, types: ['sakura'] },
    item: 'omamori',
    ambushCount: 7,
    campCount: 5,
    miniboss: 'kuno',
    bossAdds: ['gray', 'gray', 'blue'],
    ambushes: [
      [['blue', 'gray', 'blue']],
      [['blue', 'blue', 'gray'], ['gray', 'gray', 'blue']],
      [['blue', 'gray', 'blue', 'blue']],
    ],
    camps: [
      [['gray', 'gray', 'blue'], ['blue', 'gray']],
      [['blue', 'blue', 'gray'], ['gray', 'blue']],
    ],
  },
  {
    id: 'sagino',
    name: 'Floresta de Bambu de Sagino',
    kanji: '鷺野竹林',
    procedural: true,
    ground: 'forest',
    ambient: 'leaves',
    size: [67, 67],
    story: [
      'O rastro de sandálias some entre os bambus de Sagino.',
      'O vento faz a floresta inteira sussurrar. Entre os colmos, assassinos do clã esperam com kunais envenenadas.',
      'Dica: uma kunai pode ser rebatida com um corte de espada — ou evitada com o dash.',
    ],
    objective: 'Atravesse a floresta',
    houses: { types: ['house_thatch'], count: [0, 1] },
    lanterns: 4,
    scatter: { count: 95, types: ['bamboo', 'bamboo', 'bamboo', 'bamboo', 'sakura'] },
    item: 'nodachi',
    ambushCount: 7,
    campCount: 5,
    miniboss: 'monk',
    bossAdds: ['black', 'gray', 'black'],
    ambushes: [
      [['blue', 'black']],
      [['gray', 'gray', 'black'], ['black', 'blue', 'gray']],
      [['black', 'black', 'gray', 'gray']],
    ],
    camps: [
      [['black', 'gray'], ['black', 'blue']],
      [['gray', 'gray', 'black'], ['blue', 'black']],
    ],
  },
  {
    id: 'kurogane',
    name: 'Kurogane, a Vila Ocupada',
    kanji: '黒鉄',
    procedural: true,
    ground: 'camp',
    ambient: 'embers',
    size: [67, 67],
    story: [
      'A vila mineira de Kurogane virou o acampamento do clã Kurokama. Caixas de pólvora e saque se empilham pelas ruas.',
      'Do alto do morro já se vê o santuário abandonado onde vive o líder do clã.',
      'Todos os homens dele estão aqui. Não haverá outra chance.',
    ],
    objective: 'Abra caminho pelo acampamento',
    plaza: true,
    houses: { types: ['house_tile2', 'house_thatch', 'house_tile'], count: [6, 8] },
    lanterns: 3,
    smoke: 2,
    scatter: { count: 14, types: ['crate_small', 'crate', 'crate_tied', 'bamboo'] },
    item: 'iai',
    ambushCount: 8,
    campCount: 5,
    miniboss: 'ronin',
    bossAdds: ['rifle', 'rifle', 'black'],
    ambushes: [
      [['blue', 'blue', 'gray'], ['rifle', 'blue']],
      [['gray', 'gray', 'blue'], ['black', 'rifle', 'blue']],
      [['blue', 'gray', 'black', 'blue'], ['gray', 'rifle', 'rifle']],
      [['rifle', 'rifle', 'gray'], ['black', 'blue']],
    ],
    camps: [
      [['black', 'black', 'gray'], ['blue', 'blue', 'gray']],
      [['gray', 'black', 'blue'], ['black', 'gray', 'gray']],
    ],
  },
  {
    id: 'kurokama',
    name: 'Santuário de Kurokama',
    kanji: '黒鎌神社',
    ground: 'shrine',
    ambient: 'petals',
    size: [26, 26],
    start: [3, 22],
    exit: null,
    establish: [8, 7.5, 1.2],
    story: [
      'O santuário de Kurokama foi abandonado pelos monges há uma geração. Agora pertence a um único homem.',
      'Gendō, o Ceifador. Dizem que sua foice já colheu cem espadas — e que ele guarda o Espelho da Lua no altar como troféu.',
      'O rōnin sobe os últimos degraus.',
    ],
    objective: 'Derrote Gendō e recupere a relíquia',
    path: [[1, 25], [4, 21], [7, 18], [10, 15], [13, 13]],
    plazas: [[13, 13, 6.8]],
    props: [
      ['shrine', 8, 7],
      ...lanternRing(13, 13, 7.6, 12, [[120, 150], [210, 240]]),
      ['sakura', 21, 4], ['sakura', 4, 8.5], ['sakura', 22.5, 17], ['sakura', 16, 22.5],
    ],
    scatter: { seed: 21, count: 28, types: ['bamboo', 'bamboo', 'sakura'] },
    clear: [[13, 13, 8.6], [3, 22, 3], [7, 7, 3]],
    shots: [],
    waves: [],
    boss: { spawn: [15.5, 10.5], center: [13, 13], triggerR: 7.2, arenaR: 7.2, relic: [9.3, 8.6], adds: ['blue', 'black', 'gray'] },
  },
];

const ENDING = [
  'Gendō cai de joelhos sobre a pedra do santuário. A foice, enfim, se cala.',
  'O Espelho da Lua volta para Kiriyama nas mãos do rōnin. Os aldeões reconstroem as casas, e o santuário volta a ter luz.',
  'Ao amanhecer, sem pedir recompensa, o andarilho de kimono vermelho segue estrada afora — para onde precisarem dele.',
];
