/**
 * stages.js — As vilas da jornada (dados puros: o motor lê e monta a fase).
 *
 * Coordenadas em tiles do mundo. Lembrete da projeção: +x vai para baixo-direita
 * na tela, +y para baixo-esquerda. Todas as vilas são atravessadas da ESQUERDA
 * (canto oeste) para a DIREITA (canto leste) da tela, como um rolo de pintura.
 *
 *  path    — polilinha do caminho de terra (também guia a vegetação aleatória)
 *  props   — [tipo, x, y]; para casas, (x, y) é o canto SUL da construção
 *  waves   — encontros: ao chegar perto de `center`, a arena trava (plano fixo
 *            de câmera) e os grupos de inimigos surgem em sequência
 *  shots   — planos de câmera autorais: dentro do raio r, a câmera ancora em `at`
 *  establish — ponto de abertura do plano de estabelecimento (cutscene de entrada)
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
    ground: 'village',
    ambient: 'embers',
    size: [30, 30],
    start: [3, 26],
    exit: [26.5, 3.5],
    establish: [8, 12.5, 1.05],
    story: [
      'Japão, 11º ano da Era Meiji. As espadas foram proibidas nas ruas, mas os saqueadores do clã Kurokama não obedecem a lei alguma.',
      'Na noite passada eles invadiram Kiriyama, incendiaram as casas e levaram o Espelho da Lua — a relíquia sagrada que protege a aldeia há trezentos anos.',
      'Um rōnin sem mestre, que encontrou abrigo nesta aldeia, desembainha a espada mais uma vez.',
    ],
    objective: 'Expulse os saqueadores que ficaram para trás',
    path: [[2, 28], [6, 24], [10, 22], [14, 17], [18, 14], [22, 9], [25, 6], [28, 2]],
    plazas: [[8.5, 13.5, 2.3]],
    smoke: [[12, 11.5], [19, 6.5], [24.5, 14.5]],
    props: [
      ['shrine', 7.5, 11.5],
      ['lantern', 10, 12.5], ['lantern', 6.2, 14.6],
      ['house_thatch', 13, 13],
      ['house_thatch', 20, 8],
      ['house_tile', 9, 20],
      ['house_thatch', 16, 24],
      ['house_tile2', 25, 16],
      ['sakura', 4, 19.5], ['sakura', 19, 20], ['sakura', 23.5, 2.5], ['sakura', 12.5, 7], ['sakura', 5, 9],
      ['crate', 17.2, 17.8], ['crate_small', 18.2, 18.4], ['crate_tied', 26, 11], ['crate_mid', 21, 18.5],
      ['lantern2', 8, 25.6], ['lantern2', 24.5, 8.6],
    ],
    scatter: { seed: 11, count: 10, types: ['sakura', 'crate_small'] },
    shots: [{ at: [8.5, 13.5], r: 3.5, zoom: 1.5, lean: 0.35 }],
    waves: [
      { center: [8, 23], r: 6.2, groups: [['blue', 'blue', 'blue']] },
      { center: [16, 16], r: 6.5, groups: [['blue', 'blue', 'gray'], ['blue', 'blue']] },
    ],
  },
  {
    id: 'hanamura',
    name: 'Vila de Hanamura',
    kanji: '花村',
    ground: 'sakura',
    ambient: 'petals',
    size: [30, 30],
    start: [3, 26],
    exit: [27, 3.5],
    establish: [15, 15, 1.1],
    story: [
      'Hanamura floresce como se nada tivesse acontecido.',
      'Mas os aldeões sussurram: homens de preto atravessaram a vila ao amanhecer, carregando um baú selado com o brasão de uma foice.',
      'Alguns deles ainda estão aqui — cobrando "proteção" à força.',
    ],
    objective: 'Liberte Hanamura dos batedores do clã',
    path: [[2, 27], [6, 25], [10, 20], [14, 18], [18, 13], [22, 11], [25, 6], [28, 3]],
    plazas: [[15, 15, 2.4]],
    props: [
      ['house_tile', 11, 15],
      ['house_tile2', 19, 9],
      ['house_tile', 23, 4],
      ['house_tile2', 12, 27],
      ['house_tile', 22, 19],
      ['house_thatch', 27, 13.5],
      ['sakura', 6, 19], ['sakura', 9, 26.5], ['sakura', 16, 21.5], ['sakura', 20.5, 15.5],
      ['sakura', 13, 10], ['sakura', 26.5, 9], ['sakura', 17, 25], ['sakura', 4, 15],
      ['lantern', 12.6, 13], ['lantern', 17.8, 17.2],
      ['crate', 23.4, 17.4], ['crate_tied', 26, 16.4], ['crate_small', 14.4, 23.5],
    ],
    scatter: { seed: 5, count: 8, types: ['sakura'] },
    shots: [],
    waves: [
      { center: [8, 22], r: 6, groups: [['blue', 'gray', 'blue']] },
      { center: [15, 15], r: 6.5, groups: [['blue', 'blue', 'gray'], ['gray', 'gray', 'blue']] },
      { center: [23, 8.5], r: 6, groups: [['blue', 'gray', 'blue', 'blue']] },
    ],
  },
  {
    id: 'sagino',
    name: 'Floresta de Bambu de Sagino',
    kanji: '鷺野竹林',
    ground: 'forest',
    ambient: 'leaves',
    size: [30, 30],
    start: [2.5, 27],
    exit: [27, 3],
    establish: [14, 14, 1.15],
    story: [
      'O rastro de sandálias some entre os bambus de Sagino.',
      'O vento faz a floresta inteira sussurrar. Entre os colmos, assassinos do clã esperam com kunais envenenadas.',
      'Dica: uma kunai pode ser rebatida com um corte de espada — ou evitada com o dash.',
    ],
    objective: 'Atravesse a floresta',
    path: [[2, 27], [5, 22], [9, 20], [12, 15], [16, 14], [19, 10], [23, 8], [27, 3]],
    plazas: [],
    props: [
      ['lantern2', 6.5, 24.5], ['lantern2', 14, 11.6], ['lantern2', 21, 6.4],
      ['crate_small', 10.4, 17.4], ['crate', 18, 16.5],
    ],
    scatter: { seed: 7, count: 95, types: ['bamboo', 'bamboo', 'bamboo', 'bamboo', 'sakura'] },
    clear: [[7, 21.5, 3.6], [14.5, 14, 4.4], [22, 8, 3.8], [2.5, 27, 2.5], [27, 3, 2.5]],
    shots: [],
    waves: [
      { center: [7, 21.5], r: 5.5, groups: [['blue', 'black']] },
      { center: [14.5, 14], r: 6, groups: [['gray', 'gray', 'black'], ['black', 'blue', 'gray']] },
      { center: [22, 8], r: 5.5, groups: [['black', 'black', 'gray', 'gray']] },
    ],
  },
  {
    id: 'kurogane',
    name: 'Kurogane, a Vila Ocupada',
    kanji: '黒鉄',
    ground: 'camp',
    ambient: 'embers',
    size: [30, 30],
    start: [3, 26],
    exit: [27, 3],
    establish: [20, 12, 1.1],
    story: [
      'A vila mineira de Kurogane virou o acampamento do clã Kurokama. Caixas de pólvora e saque se empilham pelas ruas.',
      'Do alto do morro já se vê o santuário abandonado onde vive o líder do clã.',
      'Todos os homens dele estão aqui. Não haverá outra chance.',
    ],
    objective: 'Abra caminho pelo acampamento',
    path: [[2, 27], [7, 24], [11, 19], [15, 16], [19, 13], [23, 8], [27, 3]],
    plazas: [[11, 19, 2.5], [20, 12, 2.8]],
    smoke: [[16, 9.5], [14, 23.5]],
    props: [
      ['house_tile2', 9, 15],
      ['house_thatch', 16, 11],
      ['house_tile', 22.5, 4.5],
      ['house_tile', 15, 25],
      ['house_thatch', 25, 17],
      ['crate', 13, 21.2], ['crate_tied', 13.9, 21.8], ['crate_small', 18, 18], ['crate', 18.7, 17.3],
      ['crate_mid', 22, 15.5], ['crate_tied', 6, 20], ['crate_small', 6.8, 20.6], ['crate', 26.5, 9.5],
      ['lantern', 10, 16.6], ['lantern', 23.5, 11],
      ['bamboo', 4, 17], ['bamboo', 27, 21],
    ],
    scatter: { seed: 3, count: 8, types: ['crate_small', 'crate', 'bamboo'] },
    shots: [],
    waves: [
      { center: [10.5, 20], r: 6, groups: [['blue', 'blue', 'gray'], ['black', 'blue']] },
      { center: [17, 15], r: 6.2, groups: [['gray', 'gray', 'blue'], ['black', 'black', 'blue']] },
      { center: [21.5, 10], r: 6, groups: [['blue', 'gray', 'black', 'blue'], ['gray', 'black', 'gray']] },
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
