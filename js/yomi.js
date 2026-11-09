/**
 * yomi.js — Modo "Caminho do Rōnin": duelo linear em 2.5D, preto e branco.
 *
 * Um caminho só, da esquerda para a direita, visto de lado como num filme de
 * samurai antigo. A profundidade vem de camadas em paralaxe (mata ao fundo na
 * névoa, o caminho no meio, silhuetas escuras passando na frente da câmera),
 * de feixes de luz entre as árvores e do granulado de película.
 *
 * Combate de postura:
 *  - Corte leve (combo de 3) e golpe pesado (lento, quebra a guarda).
 *  - Defender (segurar): bloqueia golpes de frente gastando fôlego.
 *  - Aparar: defender BEM NA HORA do golpe (janela curta) desequilibra o
 *    inimigo; o próximo corte é uma execução.
 *  - Rolar: esquiva com invulnerabilidade — a única saída contra os golpes
 *    "imbloqueáveis" (o inimigo pisca forte e aparece 危 acima dele).
 *  - Os inimigos atacam um de cada vez e podem vir pelos dois lados.
 *
 * Unidades: "px de referência" numa tela de 720 de altura; k converte para a tela.
 */
const Yomi = (() => {
  const REF_H = 720;
  const GROUND = 0.8;      // linha do chão (fração da altura da tela)
  const HERO_H = 0.3;      // altura do rōnin na tela (fração)
  const LEVEL_END = 7000;

  /* ------------------------------- inimigos ------------------------------- */
  const TYPES = {
    ninja: {
      name: 'Ninja', hp: 3, speed: 150, scale: 1, guard: 0.25, gap: 115,
      sp: { idle: 'ninja_idle', walk: ['ninja_idle', 'ninja_lunge'], wind: 'ninja_raise', act: 'ninja_lunge', hurt: 'ninja_crouch' },
      attacks: [{ windup: 0.5, active: 0.12, recover: 0.45, reach: 135, dmg: 12, lunge: 70 }],
    },
    gray: {
      name: 'Ninja cinza', hp: 3, speed: 190, scale: 1, guard: 0.15, gap: 120,
      sp: { idle: 'gray_idle', walk: ['gray_idle', 'gray_lunge'], wind: 'gray_raise', act: 'gray_strike', hurt: 'gray_crouch' },
      attacks: [
        { windup: 0.38, active: 0.1, recover: 0.4, reach: 130, dmg: 10, lunge: 60 },
        { windup: 0.3, active: 0.1, recover: 0.5, reach: 130, dmg: 9, lunge: 40, chain: 1 },
      ],
    },
    black: {
      name: 'Ninja negro', hp: 4, speed: 140, scale: 1.05, guard: 0.45, gap: 125,
      sp: { idle: 'black_idle', walk: ['black_idle', 'black_lunge'], wind: 'black_raise', act: 'black_lunge', hurt: 'black_crouch' },
      attacks: [
        { windup: 0.55, active: 0.12, recover: 0.5, reach: 140, dmg: 14, lunge: 80 },
        { windup: 0.85, active: 0.14, recover: 0.7, reach: 170, dmg: 22, lunge: 160, unblockable: true },
      ],
    },
    ronin: {
      name: 'Jūrō, o rōnin sem senhor', boss: true, hp: 16, speed: 130, scale: 0.92, guard: 0.5, gap: 150,
      sp: { idle: 'ronin_low', walk: ['ronin_w0', 'ronin_w1', 'ronin_w2', 'ronin_w1'], wind: 'ronin_raise', act: 'ronin_dual', hurt: 'ronin_raise' },
      attacks: [
        { windup: 0.5, active: 0.12, recover: 0.35, reach: 175, dmg: 14, lunge: 60, chain: 2 },
        { windup: 0.95, active: 0.16, recover: 0.8, reach: 260, dmg: 26, lunge: 260, unblockable: true },
        { windup: 0.42, active: 0.1, recover: 0.6, reach: 170, dmg: 12, lunge: 30 },
      ],
    },
    gendo: {
      name: 'Gendō, o ceifador', boss: true, hp: 26, speed: 110, scale: 1.3, guard: 0.35, gap: 175,
      sp: { idle: 'boss_stance', walk: ['boss_walk0', 'boss_walk1', 'boss_walk2', 'boss_walk1'], wind: 'boss_raise', act: 'boss_slash', hurt: 'boss_retract', heavyWind: 'boss_overhead', heavyAct: 'boss_slam' },
      attacks: [
        { windup: 0.6, active: 0.14, recover: 0.45, reach: 210, dmg: 16, lunge: 50, chain: 1 },
        { windup: 1.05, active: 0.18, recover: 0.9, reach: 230, dmg: 30, lunge: 120, unblockable: true, heavy: true },
        { windup: 0.45, active: 0.12, recover: 0.6, reach: 200, dmg: 14, lunge: 90 },
      ],
    },
  };

  /** Encontros ao longo do caminho (x de gatilho; side +1 = chega pela frente). */
  const ENCOUNTERS = [
    { x: 900, foes: [['ninja', 1, 0], ['ninja', 1, 1.2]] },
    { x: 1900, foes: [['gray', 1, 0], ['ninja', -1, 0.8]] },
    { x: 2900, foes: [['ninja', 1, 0], ['black', 1, 0.6], ['gray', -1, 1.6]] },
    { x: 3900, foes: [['ronin', 1, 0]], title: 'Jūrō' },
    { x: 4900, foes: [['black', 1, 0], ['gray', -1, 0.4], ['ninja', 1, 1.8], ['black', -1, 2.6]] },
    { x: 6200, foes: [['gendo', 1, 0]], title: 'Gendō' },
  ];

  /** Trechos do caminho (cenário e letreiro). */
  const ZONES = [
    { x: 0, name: 'Floresta de Kiriyama', sub: 'Era Meiji, 1877', mid: ['forest_mixed', 'bamboo_grove', 'forest_broadleaf', 'forest_bamboo_pine', 'bonsai_pine'], near: ['bush_a', 'rock_moss', 'fern', 'rock_big', 'bush_round'] },
    { x: 2400, name: 'Aldeia abandonada', sub: 'As casas ainda cheiram a fumaça', mid: ['house_thatch2', 'house_thatch', 'store_thatch', 'shop_a', 'house_tile', 'well_a', 'barn_tile'], near: ['crate', 'barrel', 'fence', 'lantern', 'hay', 'crate_small'] },
    { x: 4400, name: 'Bambuzal dos mortos', sub: 'O vento sopra entre os túmulos', mid: ['bamboo_grove', 'forest_bamboo_pine', 'bamboo_grove', 'forest_dark'], near: ['bamboo', 'rock_tall', 'grass_tall', 'lantern2'] },
    { x: 5700, name: 'Portal do Santuário', sub: 'Onde o ceifador espera', mid: ['torii', 'forest_pines', 'mini_shrine', 'forest_dark'], near: ['lantern', 'lantern2', 'rock_flat', 'rock_moss'] },
  ];

  /* ------------------------------ utilidades ------------------------------ */
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const zoneAt = (x) => { let z = ZONES[0]; for (const q of ZONES) if (x >= q.x) z = q; return z; };
  const ease = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

  function buildScenery() {
    seed = 77;
    const far = [], mid = [], near = [], fore = [], tufts = [];
    for (let x = -400; x < LEVEL_END + 1200; x += 140 + rnd() * 120) {
      far.push({ x, name: ['forest_dark', 'forest_pines', 'pine', 'forest_mixed'][Math.floor(rnd() * 4)], s: 1.9 + rnd() * 0.6, dy: rnd() * 30 });
    }
    for (let x = -300; x < LEVEL_END + 900; x += 230 + rnd() * 200) {
      const z = zoneAt(x / 0.62);
      mid.push({ x, name: z.mid[Math.floor(rnd() * z.mid.length)], s: 1.35 + rnd() * 0.35, dy: rnd() * 18, flip: rnd() < 0.5 });
    }
    for (let x = -200; x < LEVEL_END + 600; x += 160 + rnd() * 260) {
      const z = zoneAt(x);
      near.push({ x, name: z.near[Math.floor(rnd() * z.near.length)], s: 1.25 + rnd() * 0.4, flip: rnd() < 0.5 });
    }
    for (let x = -200; x < LEVEL_END * 1.6 + 800; x += 260 + rnd() * 420) {
      const big = rnd() < 0.14;
      fore.push({ x, name: big ? 'pine' : ['grass_tall', 'fern', 'fern2', 'grass_tall'][Math.floor(rnd() * 4)], s: big ? 5 + rnd() : 2.4 + rnd() * 1.1, big, flip: rnd() < 0.5 });
    }
    for (let x = -300; x < LEVEL_END + 600; x += 18 + rnd() * 40) tufts.push({ x, dy: rnd(), h: 6 + rnd() * 10, l: rnd() });
    const beams = [];
    for (let x = -200; x < LEVEL_END * 0.3 + 1600; x += 220 + rnd() * 260) beams.push({ x, w: 30 + rnd() * 90, a: 0.05 + rnd() * 0.08, ph: rnd() * 6 });
    return { far, mid, near, fore, tufts, beams };
  }

  /* -------------------------------- mundo -------------------------------- */
  function create(checkpoint = 0) {
    const w = {
      t: 0, time: 0, hitstop: 0, slow: 0, shake: 0,
      camX: 0, punch: 0,
      scenery: buildScenery(),
      enemies: [], fx: [], texts: [],
      enc: checkpoint, active: null,
      zone: null, card: { name: 'Caminho do Rōnin', sub: 'Um rōnin. Um caminho. Nenhuma volta.', t: 0 },
      checkpoint,
      over: 0, won: 0,
      hero: {
        x: checkpoint ? ENCOUNTERS[checkpoint].x - 420 : 120, face: 1, hp: 100, st: 100,
        state: 'idle', t: 0, combo: 0, queued: null, iframes: 0, stride: 0, vx: 0,
        blockPress: -9, blocking: false, flash: 0, deadT: 0, hitDone: false,
      },
      attacker: null,
    };
    w.camX = w.hero.x + 120;
    for (let i = 0; i < checkpoint; i++) ENCOUNTERS[i].done = true;
    for (let i = checkpoint; i < ENCOUNTERS.length; i++) ENCOUNTERS[i].done = false;
    w.zone = zoneAt(w.hero.x);
    return w;
  }

  function spawn(w, type, side, delay) {
    const T = TYPES[type];
    const h = w.hero;
    w.enemies.push({
      type, T, x: h.x + side * (760 + Math.random() * 80), face: -side, hp: T.hp, maxHp: T.hp,
      state: 'enter', t: -delay, atk: null, chain: 0, flash: 0, deadT: 0, stride: 0, vx: 0,
      cool: 0.6 + Math.random() * 0.8, guardT: 0, dangerT: 0,
    });
  }

  /* ------------------------------- entrada ------------------------------- */
  function controls(input) {
    const st = input.stickVec();
    const held = (id) => [...input.held.values()].some((h) => h.id === id);
    let mx = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    if (st && Math.abs(st.x) > 0.3) mx = Math.sign(st.x);
    return {
      mx,
      light: input.consumeAttack() || input.wasPressed('KeyJ'),
      heavy: input.consumeHeavy() || input.wasPressed('KeyL'),
      blockDown: input.isDown('KeyK', 'ShiftLeft', 'ShiftRight') || held('block'),
      blockPress: input.wasPressed('KeyK', 'ShiftLeft', 'ShiftRight') || input.wasPressed('YomiBlock'),
      roll: input.wasPressed('Space'),
    };
  }

  /* ------------------------------ o rōnin ------------------------------ */
  const HERO_ATK = {
    1: { wind: 0.07, active: 0.1, recover: 0.24, reach: 150, dmg: 1, sprites: ['hero_draw', 'hero_slash1'], lunge: 30 },
    2: { wind: 0.06, active: 0.1, recover: 0.24, reach: 150, dmg: 1, sprites: ['hero_stance', 'hero_slash2'], lunge: 30 },
    3: { wind: 0.12, active: 0.12, recover: 0.36, reach: 175, dmg: 2, sprites: ['hero_draw', 'hero_slash1'], lunge: 90 },
    heavy: { wind: 0.42, active: 0.12, recover: 0.42, reach: 185, dmg: 3, sprites: ['hero_draw', 'hero_slash2'], lunge: 70, breaks: true },
  };

  function heroStartAttack(w, kind) {
    const h = w.hero;
    h.state = 'attack';
    h.t = 0;
    h.atk = HERO_ATK[kind];
    h.atkKind = kind;
    h.hitDone = false;
    h.queued = null;
    if (kind === 'heavy') h.st = Math.max(0, h.st - 18);
  }

  function updateHero(w, dt, c) {
    const h = w.hero;
    h.t += dt;
    h.iframes = Math.max(0, h.iframes - dt);
    h.flash = Math.max(0, h.flash - dt * 3);
    if (h.state !== 'block' && h.state !== 'attack') h.st = Math.min(100, h.st + dt * 22);
    if (c.blockPress) h.blockPress = w.time;
    if (h.state === 'dead') { h.deadT += dt; return; }

    const locked = w.active;
    const minX = locked ? locked.x - 620 : -100, maxX = locked ? locked.x + 620 : LEVEL_END + 200;
    const move = (dx) => { h.x = clamp(h.x + dx, minX, maxX); };

    switch (h.state) {
      case 'idle':
      case 'walk':
      case 'block': {
        if (c.roll && h.st >= 12) {
          h.state = 'roll'; h.t = 0; h.iframes = 0.42; h.st -= 12;
          if (c.mx) h.face = c.mx;
          Sfx.dash();
          break;
        }
        if (c.heavy && h.st >= 10) { heroStartAttack(w, 'heavy'); break; }
        if (c.light) { heroStartAttack(w, h.combo && w.time - h.lastAtk < 0.6 ? Math.min(3, h.combo + 1) : 1); break; }
        if (c.blockDown) {
          h.state = 'block';
          if (c.mx) h.face = c.mx; // virar sem sair da guarda
          break;
        }
        if (c.mx) {
          h.face = c.mx;
          h.state = 'walk';
          move(c.mx * 230 * dt);
          h.stride += 230 * dt;
          h.vx = c.mx;
        } else { h.state = 'idle'; h.vx = 0; }
        break;
      }
      case 'attack': {
        const A = h.atk;
        if ((c.light || c.heavy) && h.t > A.wind) h.queued = c.heavy ? 'heavy' : 'light';
        if (h.t < A.wind + A.active) move(h.face * (A.lunge / (A.wind + A.active)) * dt);
        if (!h.hitDone && h.t >= A.wind) {
          h.hitDone = true;
          Sfx.swing(h.atkKind === 'heavy' ? 2 : 0);
          heroHit(w, A);
        }
        if (h.t >= A.wind + A.active + A.recover * 0.45 && h.queued) {
          const q = h.queued;
          h.combo = h.atkKind === 'heavy' ? 0 : h.atkKind;
          h.lastAtk = w.time;
          heroStartAttack(w, q === 'heavy' ? 'heavy' : h.combo >= 3 ? 1 : h.combo + 1);
        } else if (h.t >= A.wind + A.active + A.recover) {
          h.combo = h.atkKind === 'heavy' ? 0 : h.atkKind;
          h.lastAtk = w.time;
          h.state = 'idle';
        }
        break;
      }
      case 'roll':
        move(h.face * 520 * Math.max(0, 1 - h.t / 0.4) * dt * 1.6);
        if (h.t > 0.42) h.state = 'idle';
        break;
      case 'hurt':
        move(-h.face * 160 * Math.max(0, 1 - h.t / 0.3) * dt);
        if (h.t > 0.38) h.state = 'idle';
        break;
      case 'broken': // guarda quebrada
        if (h.t > 0.75) h.state = 'idle';
        break;
    }
    if (h.state !== 'block') h.blocking = false;
    else h.blocking = true;
  }

  /** O golpe do rōnin chega: acerta quem estiver à frente e ao alcance. */
  function heroHit(w, A) {
    const h = w.hero;
    let any = false;
    for (const e of w.enemies) {
      if (e.state === 'dead' || e.state === 'enter') continue;
      const d = (e.x - h.x) * h.face;
      if (d < -20 || d > A.reach + e.T.gap * 0.25) continue;
      any = true;
      const facingHero = Math.sign(h.x - e.x) === e.face;
      const busy = e.state === 'windup' || e.state === 'strike' || e.state === 'recover' || e.state === 'stagger' || e.state === 'hurt';
      // defesa do inimigo
      if (facingHero && !busy && (e.state === 'guard' || Math.random() < e.T.guard)) {
        if (A.breaks) {
          e.state = 'stagger'; e.t = 0;
          fxSparks(w, e.x - e.face * 30, 0.55, 14);
          Sfx.clang(); w.shake = 10; w.hitstop = 0.08;
          text(w, e.x, 'Guarda quebrada');
        } else {
          e.state = 'guard'; e.t = 0; e.guardT = 0.45;
          e.x += -e.face * 26;
          fxSparks(w, e.x - e.face * 30, 0.6, 8);
          Sfx.clang(); w.hitstop = 0.05; w.shake = 4;
        }
        continue;
      }
      let dmg = A.dmg;
      const exec = e.state === 'stagger';
      if (exec) dmg *= 3;
      e.hp -= dmg;
      e.flash = 1;
      fxBlood(w, e.x, h.face, exec ? 26 : 12);
      Sfx.hit(exec || A.breaks);
      w.hitstop = exec ? 0.16 : 0.07;
      w.shake = exec ? 14 : 6;
      if (exec) { w.slow = 0.35; text(w, e.x, 'Execução'); }
      if (e.hp <= 0) {
        e.state = 'dead'; e.t = 0; e.deadT = 0;
        if (w.attacker === e) w.attacker = null;
        Sfx.death();
        if (e.T.boss) { w.slow = 1.2; Sfx.gong(); }
      } else if (!(e.T.boss && e.state === 'strike')) { // chefes têm "armadura" no golpe
        e.state = 'hurt'; e.t = 0;
        if (w.attacker === e) { w.attacker = null; e.cool = 0.5 + Math.random() * 0.5; }
        e.x += h.face * (A.breaks ? 60 : 30);
      }
    }
    if (!any) w.punch = 0;
  }

  /** Um golpe inimigo chega no rōnin. */
  function enemyHit(w, e, A) {
    const h = w.hero;
    const d = (h.x - e.x) * e.face;
    if (d < -30 || d > A.reach) return;
    if (h.iframes > 0 || h.state === 'dead') return;
    const facing = Math.sign(e.x - h.x) === h.face;
    if (h.blocking && facing && !A.unblockable) {
      if (w.time - h.blockPress < 0.22) {
        // APARAR: o inimigo perde o equilíbrio
        e.state = 'stagger'; e.t = 0;
        if (w.attacker === e) w.attacker = null;
        h.st = Math.min(100, h.st + 25);
        fxSparks(w, h.x + h.face * 40, 0.52, 22);
        Sfx.clang(); Sfx.clang();
        w.hitstop = 0.12; w.slow = 0.5; w.shake = 8; w.punch = 0.06;
        text(w, h.x + h.face * 40, 'Aparado');
        return;
      }
      h.st -= A.dmg * 2.2;
      fxSparks(w, h.x + h.face * 40, 0.55, 10);
      Sfx.clang(); w.hitstop = 0.05; w.shake = 5;
      h.x -= h.face * 34;
      if (h.st <= 0) {
        h.st = 0; h.state = 'broken'; h.t = 0;
        text(w, h.x, 'Guarda quebrada');
      }
      return;
    }
    h.hp -= A.dmg;
    h.flash = 1;
    fxBlood(w, h.x, e.face, 14);
    Sfx.hurt(); w.hitstop = 0.09; w.shake = 10;
    if (h.hp <= 0) {
      h.hp = 0; h.state = 'dead'; h.t = 0; h.deadT = 0;
      w.slow = 1.5;
      Sfx.death();
    } else {
      h.state = 'hurt'; h.t = 0;
      h.face = Math.sign(e.x - h.x) || h.face;
    }
  }

  /* ------------------------------ inimigos ------------------------------ */
  function updateEnemy(w, e, dt) {
    const h = w.hero;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt * 4);
    if (e.state === 'dead') { e.deadT += dt; return; }
    const dist = h.x - e.x, ad = Math.abs(dist);
    const T = e.T;
    const walk = (dir, sp) => { e.x += dir * sp * dt; e.stride += sp * dt; e.vx = dir; };
    e.vx = 0;
    switch (e.state) {
      case 'enter':
        if (e.t < 0) return;
        e.face = Math.sign(dist) || 1;
        walk(e.face, T.speed * 1.3);
        if (ad < 520) { e.state = 'approach'; e.t = 0; }
        break;
      case 'approach': {
        e.face = Math.sign(dist) || e.face;
        e.cool -= dt;
        const iAttack = w.attacker === e;
        // Só um ataca por vez; os outros cercam a uma distância respeitosa.
        const want = iAttack || !w.attacker ? T.gap : T.gap + 150 + (w.enemies.indexOf(e) % 2) * 60;
        if (ad > want + 18) walk(e.face, T.speed);
        else if (ad < want - 40) walk(-e.face, T.speed * 0.6);
        if (e.cool <= 0 && ad < T.gap + 60 && (!w.attacker || iAttack) && h.state !== 'dead') {
          w.attacker = e;
          const A = e.chain > 0 && e.atk && e.atk.chain ? e.atk : T.attacks[Math.floor(Math.random() * T.attacks.length)];
          e.chain = e.chain > 0 ? e.chain - 1 : A.chain || 0;
          e.atk = A; e.state = 'windup'; e.t = 0; e.hitDone = false;
        }
        break;
      }
      case 'windup':
        if (e.t >= e.atk.windup) { e.state = 'strike'; e.t = 0; Sfx.swing(1); }
        break;
      case 'strike': {
        const A = e.atk;
        e.x += e.face * (A.lunge / A.active) * dt;
        if (!e.hitDone && e.t >= A.active * 0.5) { e.hitDone = true; enemyHit(w, e, A); }
        if (e.state === 'strike' && e.t >= A.active) { e.state = 'recover'; e.t = 0; }
        break;
      }
      case 'recover':
        if (e.t >= e.atk.recover) {
          if (e.chain > 0) { e.state = 'approach'; e.cool = 0.05; }
          else { e.state = 'approach'; e.cool = 0.7 + Math.random() * 1.1; if (w.attacker === e) w.attacker = null; }
          e.t = 0;
        }
        break;
      case 'guard':
        e.guardT -= dt;
        if (e.guardT <= 0) { e.state = 'approach'; e.t = 0; e.cool = Math.min(e.cool, 0.25); }
        break;
      case 'hurt':
        if (e.t > 0.32) { e.state = 'approach'; e.t = 0; e.chain = 0; }
        break;
      case 'stagger':
        if (e.t > 1.1) { e.state = 'approach'; e.t = 0; e.chain = 0; e.cool = 0.4; }
        break;
    }
    // não atravessar o rōnin
    if (e.state !== 'dead' && Math.abs(h.x - e.x) < 60 && h.state !== 'roll') e.x = h.x - Math.sign(h.x - e.x || 1) * 60;
  }

  /* -------------------------------- efeitos -------------------------------- */
  function fxBlood(w, x, dir, n) {
    for (let i = 0; i < n; i++) {
      w.fx.push({ kind: 'ink', x: x + (Math.random() - 0.5) * 20, y: 0.55 + Math.random() * 0.1, vx: dir * (120 + Math.random() * 380), vy: -(80 + Math.random() * 260), life: 0.9 + Math.random() * 0.6, s: 3 + Math.random() * 6 });
    }
  }
  function fxSparks(w, x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 200 + Math.random() * 500;
      w.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.25 + Math.random() * 0.3, s: 2 });
    }
  }
  function text(w, x, s) {
    w.texts.push({ x, s, t: 0 });
  }

  /* ------------------------------ atualização ------------------------------ */
  function update(w, realDt, input) {
    const c = controls(input);
    w.time += realDt;
    if (w.card) w.card.t += realDt;
    if (w.won) { w.won += realDt; return; }
    if (w.hitstop > 0) { w.hitstop -= realDt; return; }
    let dt = realDt;
    if (w.slow > 0) { w.slow -= realDt; dt *= 0.3; }
    w.t += dt;
    const h = w.hero;
    updateHero(w, dt, c);

    // encontros
    const E = ENCOUNTERS[w.enc];
    if (!w.active && E && !E.done && h.x > E.x - 140) {
      w.active = E;
      E.foes.forEach(([type, side, delay]) => spawn(w, type, side, delay));
      if (E.title) { const T = TYPES[E.foes[0][0]]; w.card = { name: T.name, sub: 'Duelo', t: 0, boss: true }; Sfx.roar(); }
    }
    for (const e of w.enemies) updateEnemy(w, e, dt);
    if (w.attacker && (w.attacker.state === 'dead' || !w.enemies.includes(w.attacker))) w.attacker = null;
    w.enemies = w.enemies.filter((e) => !(e.state === 'dead' && e.deadT > 2.2));
    if (w.active && w.enemies.every((e) => e.state === 'dead')) {
      w.active.done = true;
      w.active = null;
      w.enc++;
      w.checkpoint = w.enc;
      if (w.enc >= ENCOUNTERS.length) { w.won = 0.001; Sfx.gong(); }
    }

    // trechos
    const z = zoneAt(h.x);
    if (z !== w.zone) { w.zone = z; w.card = { name: z.name, sub: z.sub, t: 0 }; }

    // morte do rōnin
    if (h.state === 'dead') w.over += realDt;

    // efeitos
    for (const f of w.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += (f.vy * dt) / REF_H;
      f.vy += 900 * dt;
      if (f.kind === 'ink' && f.y > GROUND) { f.y = GROUND; f.vx *= 0.2; f.vy = 0; f.ground = true; }
    }
    w.fx = w.fx.filter((f) => f.life > 0 || (f.ground && f.life > -6));
    for (const t of w.texts) t.t += dt;
    w.texts = w.texts.filter((t) => t.t < 1.2);

    // câmera: um pouco à frente do rōnin; em luta, entre ele e os inimigos
    let tx = h.x + h.face * 110;
    const live = w.enemies.filter((e) => e.state !== 'dead' && e.state !== 'enter');
    if (live.length) tx = (h.x * 2 + live.reduce((s, e) => s + e.x, 0) / live.length) / 3;
    w.camX = damp(w.camX, tx, 3.2, dt);
    w.shake *= Math.exp(-12 * realDt);
    w.punch *= Math.exp(-6 * realDt);
  }

  /* -------------------------------- desenho -------------------------------- */
  let grain = null;
  function grainCanvas() {
    if (grain) return grain;
    grain = document.createElement('canvas');
    grain.width = grain.height = 256;
    const g = grain.getContext('2d');
    const im = g.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return grain;
  }

  function heroSprite(h, w) {
    switch (h.state) {
      case 'dead': return 'hero_stance';
      case 'roll': return 'hero_dash';
      case 'hurt': case 'broken': return 'hero_stance';
      case 'block': return 'hero_stance';
      case 'attack': return h.t < h.atk.wind ? h.atk.sprites[0] : h.atk.sprites[1];
      case 'walk': return 'hero_sw' + (Math.floor(h.stride / 26) % 8);
      default: return w.active ? 'hero_stance' : 'hero_idle';
    }
  }

  function enemySprite(e) {
    const S = e.T.sp, A = e.atk;
    switch (e.state) {
      case 'enter': case 'approach':
        return e.vx ? S.walk[Math.floor(e.stride / 34) % S.walk.length] : S.idle;
      case 'windup': return A && A.heavy && S.heavyWind ? S.heavyWind : S.wind;
      case 'strike': return A && A.heavy && S.heavyAct ? S.heavyAct : S.act;
      case 'recover': return S.idle;
      case 'guard': return S.wind;
      case 'hurt': case 'stagger': case 'dead': return S.hurt;
    }
    return S.idle;
  }

  /** Morte em três tempos (recua, joelhos, desaba) — igual ao modo principal. */
  function deathPose(t, face) {
    const k1 = ease(t / 0.16), k2 = ease((t - 0.14) / 0.42), k3 = ease((t - 0.58) / 0.5);
    return { rotate: face * (-0.14 * k1 * (1 - k2) + 0.16 * k2 + 0.38 * k3), sy: 1 - 0.24 * k2 - 0.16 * k3, dark: 0.5 * k3, alpha: 1 - clamp((t - 1.5) / 0.6, 0, 1) };
  }

  function render(ctx, cam, w) {
    const W = cam.viewW, H = cam.viewH;
    const k = (H / REF_H) * (1 + w.punch);
    const gy = H * GROUND;
    const shx = (Math.random() - 0.5) * w.shake, shy = (Math.random() - 0.5) * w.shake;
    const X = (x, p = 1) => (x - w.camX * p) * k + W / 2 + shx * p;
    const heroScale = ((H * HERO_H) / 135) * (1 + w.punch); // já em px de tela (não multiplicar por k)

    ctx.save();
    // céu de névoa: claro no alto, escurecendo para a mata
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#d9d9d4');
    sky.addColorStop(0.55, '#8e918a');
    sky.addColorStop(1, '#3d403b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const S = w.scenery;
    const drawLayer = (list, p, baseY, scaleK, fog, behind = true) => {
      for (const o of list) {
        const sx = X(o.x, p);
        if (sx < -500 * k || sx > W + 500 * k) continue;
        Sprites.draw(ctx, o.name, sx, baseY + (o.dy || 0) * k, o.s * scaleK * k, { flip: o.flip });
      }
      if (fog) {
        ctx.fillStyle = `rgba(200,202,196,${fog})`;
        ctx.fillRect(0, 0, W, H);
      }
    };
    // camada distante (bem pequena e lavada pela névoa)
    drawLayer(S.far, 0.3, gy - 120 * k, 0.95, 0.5);
    // feixes de luz entre as árvores
    ctx.globalCompositeOperation = 'lighter';
    for (const b of S.beams) {
      const bx = X(b.x, 0.22);
      if (bx < -300 || bx > W + 300) continue;
      const a = b.a * (0.75 + 0.25 * Math.sin(w.time * 0.7 + b.ph));
      const g = ctx.createLinearGradient(0, 0, 0, gy + 40 * k);
      g.addColorStop(0, `rgba(255,255,250,${a})`);
      g.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + b.w * k, 0);
      ctx.lineTo(bx + b.w * k + 260 * k, gy + 40 * k);
      ctx.lineTo(bx + 200 * k, gy + 40 * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // camada do meio (casas, mata) com névoa leve
    drawLayer(S.mid, 0.62, gy - 42 * k, 1, 0.22);

    // chão: faixa do caminho iluminada
    const gr = ctx.createLinearGradient(0, gy - 50 * k, 0, H);
    gr.addColorStop(0, '#5d5f58');
    gr.addColorStop(0.25, '#9a9a92');
    gr.addColorStop(0.55, '#6a6a63');
    gr.addColorStop(1, '#1d1e1b');
    ctx.fillStyle = gr;
    ctx.fillRect(0, gy - 50 * k, W, H - gy + 50 * k);
    // tufos de capim na beira do caminho
    ctx.strokeStyle = 'rgba(40,42,38,0.7)';
    ctx.lineWidth = Math.max(1, 1.4 * k);
    ctx.beginPath();
    for (const t of S.tufts) {
      const tx = X(t.x);
      if (tx < -20 || tx > W + 20) continue;
      const ty = gy - 46 * k + t.dy * 22 * k;
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + (t.l - 0.5) * 8 * k, ty - t.h * k);
    }
    ctx.stroke();
    // poças de "tinta" (sangue) no chão
    for (const f of w.fx) {
      if (!f.ground) continue;
      ctx.fillStyle = `rgba(10,10,10,${0.55 * clamp(1 + f.life / 6, 0, 1)})`;
      ctx.beginPath();
      ctx.ellipse(X(f.x), gy + 2 * k, f.s * 1.6 * k, f.s * 0.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // objetos da beira do caminho (atrás dos lutadores)
    drawLayer(S.near, 1, gy - 30 * k, 1, 0);

    // lutadores: sombra, corpo
    const shadow = (x, r) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(X(x), gy + 4 * k, r * k, r * 0.22 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const actors = [...w.enemies, w.hero];
    for (const a of actors) {
      const isHero = a === w.hero;
      const sx = X(a.x);
      if (sx < -300 || sx > W + 300) continue;
      shadow(a.x, isHero ? 46 : 46 * a.T.scale);
      const name = isHero ? heroSprite(a, w) : enemySprite(a);
      const sc = heroScale * (isHero ? 1 : a.T.scale);
      const dead = a.state === 'dead';
      const dp = dead ? deathPose(isHero ? a.deadT : a.deadT, a.face) : null;
      let tint = '#ffffff', ta = a.flash * 6;
      if (!isHero && a.state === 'windup') {
        // telégrafo: brilho que cresce; imbloqueável pisca forte
        const p = a.t / a.atk.windup;
        ta = a.atk.unblockable ? 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(w.time * 40)) : 0.35 * p;
      }
      if (!isHero && a.state === 'stagger') { tint = '#ffffff'; ta = 0.2 + 0.1 * Math.sin(w.time * 20); }
      if (isHero && a.state === 'block') { tint = '#ffffff'; ta = w.time - a.blockPress < 0.22 ? 0.45 : 0.08; }
      if (dp && dp.dark > ta) { tint = '#000000'; ta = dp.dark; }
      const bob = !dead && (a.state === 'walk' || (a.vx && a.state !== 'block')) ? Math.abs(Math.sin((a.stride / 52) * Math.PI)) * 3 * k : 0;
      Sprites.draw(ctx, name, sx, gy - bob + (a.state === 'roll' ? 6 * k : 0), sc, {
        flip: a.face < 0, tint, tintAmount: ta,
        rotate: dp ? dp.rotate : a.state === 'roll' ? a.face * 0.15 : 0,
        sy: dp ? dp.sy : a.state === 'broken' ? 0.94 : 1,
        alpha: dp ? dp.alpha : isHero && a.iframes > 0 && a.state === 'roll' ? 0.75 : 1,
      });
      // 危 acima de quem vai dar um golpe imbloqueável
      if (!isHero && a.state === 'windup' && a.atk.unblockable) {
        ctx.save();
        ctx.font = `900 ${Math.round(34 * k)}px ${FONT_TITLE}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5 * k;
        const ty = gy - sc * 150;
        ctx.strokeText('危', sx, ty);
        ctx.fillText('危', sx, ty);
        ctx.restore();
      }
    }

    // respingos e faíscas
    for (const f of w.fx) {
      if (f.ground || f.life <= 0) continue;
      const fx = X(f.x), fy = f.y * H;
      if (f.kind === 'spark') {
        ctx.strokeStyle = `rgba(255,255,255,${clamp(f.life * 4, 0, 1)})`;
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - f.vx * 0.03 * k, fy - f.vy * 0.03 * k);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(8,8,8,0.9)';
        ctx.beginPath();
        ctx.arc(fx, fy, f.s * k * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // arco do corte do rōnin (rastro branco)
    const h = w.hero;
    if (h.state === 'attack' && h.t >= h.atk.wind && h.t < h.atk.wind + h.atk.active + 0.06) {
      const p = (h.t - h.atk.wind) / (h.atk.active + 0.06);
      const cx = X(h.x + h.face * 40), cy = gy - H * HERO_H * 0.5;
      const r = h.atk.reach * k * 0.75;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(h.face, 1);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - p)})`;
      ctx.lineWidth = (h.atkKind === 'heavy' ? 9 : 5) * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const a0 = h.atkKind === 2 ? 0.9 : -1.2, a1 = h.atkKind === 2 ? -1.0 : 0.9;
      ctx.arc(0, 0, r, a0, a0 + (a1 - a0) * Math.min(1, p * 1.6), a1 < a0);
      ctx.stroke();
      ctx.restore();
    }

    // textos de combate
    ctx.textAlign = 'center';
    for (const t of w.texts) {
      ctx.font = `700 ${Math.round(20 * k)}px ${FONT_TITLE}`;
      ctx.fillStyle = `rgba(255,255,255,${1 - t.t / 1.2})`;
      ctx.fillText(t.s, X(t.x), gy - 230 * k - t.t * 30 * k);
    }

    // primeiro plano: silhuetas escuras e desfocadas passando rente à câmera
    for (const o of S.fore) {
      const sx = X(o.x, 1.6);
      if (sx < -600 * k || sx > W + 600 * k) continue;
      const m = ATLAS[o.name];
      if (!m) continue;
      const sc = o.s * k;
      ctx.save();
      ctx.translate(sx, o.big ? H * 1.45 : H * 1.12); // só o topo aparece: a borda reta do recorte fica fora da tela
      ctx.scale(o.flip ? -1 : 1, 1);
      // tronco grande que passa pelo meio da luta fica translúcido (não esconde o duelo)
      ctx.globalAlpha = o.big ? clamp(Math.abs(sx - W / 2) / (W * 0.32), 0.18, 0.95) : 0.95;
      ctx.drawImage(Sprites.tinted(o.name, '#0b0b0a'), -m.ax * sc, -m.ay * sc, m.w * sc, m.h * sc);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Granulado, vinheta, faixas de cinema e HUD. */
  function overlay(ctx, cam, w) {
    const W = cam.viewW, H = cam.viewH, k = H / REF_H;
    // vinheta
    const v = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // granulado de película
    const g = grainCanvas();
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
    for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(g, x, y);
    ctx.restore();
    // riscos de filme
    if (Math.random() < 0.08) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(Math.random() * W, 0, 1, H);
    }
    // faixas de cinema
    const bar = H * 0.075;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);

    const h = w.hero;
    // vida em "contas" (canto inferior esquerdo) e fôlego logo abaixo
    const pip = 10;
    for (let i = 0; i < pip; i++) {
      const full = h.hp >= (i + 1) * (100 / pip) - 0.01;
      const part = !full && h.hp > i * (100 / pip);
      ctx.fillStyle = full ? '#f2f2ee' : part ? 'rgba(242,242,238,0.45)' : 'rgba(242,242,238,0.12)';
      ctx.fillRect(28 * k + i * 15 * k, H - bar - 34 * k, 11 * k, 7 * k);
    }
    ctx.fillStyle = 'rgba(242,242,238,0.15)';
    ctx.fillRect(28 * k, H - bar - 20 * k, 148 * k, 2 * k);
    ctx.fillStyle = h.st < 25 ? '#ffffff' : 'rgba(242,242,238,0.7)';
    ctx.fillRect(28 * k, H - bar - 20 * k, 148 * k * (h.st / 100), 2 * k);

    // barra do chefe
    const boss = w.enemies.find((e) => e.T.boss && e.state !== 'dead');
    if (boss) {
      const bw = Math.min(W * 0.5, 520 * k);
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(18 * k)}px ${FONT_TITLE}`;
      ctx.fillStyle = '#eee';
      ctx.fillText(boss.T.name, W / 2, H - bar - 30 * k);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(W / 2 - bw / 2, H - bar - 20 * k, bw, 4 * k);
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(W / 2 - bw / 2, H - bar - 20 * k, bw * (boss.hp / boss.maxHp), 4 * k);
    }

    // letreiros (lugar / duelo / título)
    const C = w.card;
    if (C && C.t < 4.2) {
      const a = Math.min(1, C.t / 0.6) * (1 - clamp((C.t - 3.2) / 1, 0, 1));
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(240,240,236,${a})`;
      ctx.font = `800 ${Math.round((C.boss ? 46 : 40) * k)}px ${FONT_TITLE}`;
      ctx.fillText(C.name, W / 2, H * 0.3);
      ctx.font = `400 ${Math.round(17 * k)}px ${FONT_TITLE}`;
      ctx.fillStyle = `rgba(220,220,214,${a * 0.85})`;
      ctx.fillText(C.sub, W / 2, H * 0.3 + 34 * k);
    }
    // dica de controles no começo
    if (w.time < 9 && !w.enc && !TOUCH.active) {
      const a = Math.min(1, w.time) * (1 - clamp(w.time - 8, 0, 1));
      ctx.font = `600 ${Math.round(13 * k)}px ${FONT_UI}`;
      ctx.fillStyle = `rgba(235,235,230,${a * 0.8})`;
      ctx.textAlign = 'center';
      ctx.fillText('A/D andar · J ou clique: corte · L ou botão direito: golpe pesado · K/Shift: defender (na hora certa: aparar) · Espaço: rolar', W / 2, bar + 26 * k);
    }

    // morte / vitória
    if (h.state === 'dead' && w.over > 1.2) {
      const a = clamp((w.over - 1.2) / 1, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${a * 0.65})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(240,240,236,${a})`;
      ctx.font = `800 ${Math.round(54 * k)}px ${FONT_TITLE}`;
      ctx.fillText('死', W / 2, H * 0.42);
      ctx.font = `400 ${Math.round(18 * k)}px ${FONT_TITLE}`;
      ctx.fillText('O caminho ainda não terminou.  Enter / toque: tentar de novo  ·  Esc: sair', W / 2, H * 0.42 + 48 * k);
    }
    if (w.won) {
      const a = clamp((w.won - 1.5) / 1.5, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${a * 0.75})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(240,240,236,${a})`;
      ctx.font = `800 ${Math.round(50 * k)}px ${FONT_TITLE}`;
      ctx.fillText('終', W / 2, H * 0.4);
      ctx.font = `400 ${Math.round(18 * k)}px ${FONT_TITLE}`;
      ctx.fillText('O ceifador caiu. A relíquia volta ao santuário.  Enter / toque: voltar', W / 2, H * 0.4 + 48 * k);
    }
  }

  /** Botões de toque deste modo (joystick na esquerda só para os lados). */
  function touchLayout(cam) {
    const W = cam.viewW, H = cam.viewH, r = Math.min(46, H * 0.075);
    return [
      { id: 'attack', label: '斬', x: W - r * 1.6, y: H - r * 2.4, r: r * 1.15 },
      { id: 'heavy', label: '重', x: W - r * 4.2, y: H - r * 1.7, r },
      { id: 'block', label: '守', x: W - r * 1.7, y: H - r * 5.0, r },
      { id: 'dash', label: '転', x: W - r * 4.4, y: H - r * 4.3, r: r * 0.85 },
      { id: 'pause', label: '✕', x: W - 30, y: 30, r: 20 }, // sai para o título
    ];
  }

  function drawTouch(ctx, cam, buttons, input) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of buttons) {
      const down = [...input.held.values()].some((h) => h.id === b.id);
      ctx.fillStyle = down ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(b.r * 0.8)}px ${FONT_TITLE}`;
      ctx.fillText(b.label, b.x, b.y + 1);
    }
    const st = input.stick;
    if (st.id !== null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, input.stickRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { create, update, render, overlay, touchLayout, drawTouch, ENCOUNTERS };
})();
