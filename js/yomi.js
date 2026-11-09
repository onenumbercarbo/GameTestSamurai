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
  const GROUND = 0.66;     // linha dos pés dos lutadores (fração da altura da tela)
  const ZOOM = 0.5;        // câmera aberta: lutadores pequenos numa clareira ampla, como num plano de cinema
  const HERO_H = 0.3 * ZOOM; // altura do rōnin na tela (fração)
  const LEVEL_END = 7000;

  /* ------------------------------- inimigos ------------------------------- */
  const TYPES = {
    ninja: {
      name: 'Ninja', hp: 3, speed: 150, scale: 1, guard: 0.25, gap: 115,
      side: true, sp: { idle: 'ns_walk0', walk: ['ns_walk0', 'ns_walk1', 'ns_walk2', 'ns_walk3'], wind: 'ns_atk0', act: 'ns_atk2', rec: 'ns_atk1', guard: 'ns_block2', stagger: 'ns_block0', hurt: 'ns_die0', die: ['ns_die0', 'ns_die1', 'ns_die2'] },
      attacks: [{ windup: 0.5, active: 0.12, recover: 0.45, reach: 135, dmg: 12, lunge: 70 }],
    },
    gray: {
      name: 'Ninja cinza', hp: 3, speed: 190, scale: 1, guard: 0.15, gap: 120,
      tone: ['#ffffff', 0.28], // ninja cinza: mais claro
      side: true, sp: { idle: 'ns_walk0', walk: ['ns_walk0', 'ns_walk1', 'ns_walk2', 'ns_walk3'], wind: 'ns_atk0', act: 'ns_atk2', rec: 'ns_atk1', guard: 'ns_block2', stagger: 'ns_block0', hurt: 'ns_die0', die: ['ns_die0', 'ns_die1', 'ns_die2'] },
      attacks: [
        { windup: 0.38, active: 0.1, recover: 0.4, reach: 130, dmg: 10, lunge: 60 },
        { windup: 0.3, active: 0.1, recover: 0.5, reach: 130, dmg: 9, lunge: 40, chain: 1 },
      ],
    },
    black: {
      name: 'Ninja negro', hp: 4, speed: 140, scale: 1.05, guard: 0.45, gap: 125,
      tone: ['#000000', 0.32], // ninja negro: mais escuro
      side: true, sp: { idle: 'ns_walk0', walk: ['ns_walk0', 'ns_walk1', 'ns_walk2', 'ns_walk3'], wind: 'ns_atk0', act: 'ns_atk2', rec: 'ns_atk1', guard: 'ns_block2', stagger: 'ns_block0', hurt: 'ns_die0', die: ['ns_die0', 'ns_die1', 'ns_die2'] },
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
    { x: 0, name: 'Floresta de Kiriyama', sub: 'Era Meiji, 1877', mid: ['forest_mixed', 'ss_grove', 'bamboo_grove', 'forest_broadleaf', 'forest_bamboo_pine', 'bonsai_pine'], near: ['bush_a', 'rock_moss', 'fern', 'rock_big', 'bush_round'] },
    { x: 2400, name: 'Aldeia abandonada', sub: 'As casas ainda cheiram a fumaça', mid: ['ss_gate', 'house_thatch2', 'bonsai_pine', 'ss_gate', 'house_tile'], near: ['ss_lantern', 'barrel', 'crate', 'hay', 'ss_lantern'] },
    { x: 4400, name: 'Bambuzal dos mortos', sub: 'O vento sopra entre os túmulos', mid: ['bamboo_grove', 'forest_bamboo_pine', 'bamboo_grove', 'forest_dark'], near: ['bamboo', 'rock_tall', 'grass_tall', 'lantern2'] },
    { x: 5700, name: 'Portal do Santuário', sub: 'Onde o ceifador espera', mid: ['ss_bell', 'torii', 'ss_grove', 'forest_pines', 'ss_bell'], near: ['ss_lantern', 'ss_lantern', 'rock_flat', 'rock_moss'] },
  ];

  /* ------------------------------ utilidades ------------------------------ */
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const zoneAt = (x) => { let z = ZONES[0]; for (const q of ZONES) if (x >= q.x) z = q; return z; };
  const ease = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

  function buildScenery() {
    seed = 77;
    const far = [], mid = [], near = [], fore = [], tufts = [];
    let lastPlate = -9999;
    for (let x = -3200; x < LEVEL_END + 3200; x += (rnd() < 0.35 ? 900 : 260) + rnd() * 300) { // tufos de mata com clareiras
      far.push({ x, name: ['forest_broadleaf', 'forest_pines', 'pine', 'forest_mixed'][Math.floor(rnd() * 4)], s: 1.9 + rnd() * 0.6, dy: rnd() * 30 });
    }
    for (let x = -3200; x < LEVEL_END + 3200; x += (rnd() < 0.4 ? 1100 : 380) + rnd() * 300) {
      const z = zoneAt(x / 0.62);
      let name = z.mid[Math.floor(rnd() * z.mid.length)];
      if (name.startsWith('ss_') && x - lastPlate < 1500) name = ['forest_mixed', 'forest_broadleaf', 'forest_pines', 'bamboo_grove'][Math.floor(rnd() * 4)];
      const side = name.startsWith('ss_');
      if (side) lastPlate = x;
      // painéis de cena da folha de perfil: grandes, um por vez (sem sobrepor)
      mid.push({ x, name, s: (side ? 0.82 : 1.35) + rnd() * (side ? 0.1 : 0.35), dy: side ? 34 : rnd() * 18, flip: !side && rnd() < 0.5 });
      if (side) x += ATLAS[name].w * 0.55;
    }
    for (let x = -2400; x < LEVEL_END + 2400; x += 160 + rnd() * 260) {
      const z = zoneAt(x);
      const nn = z.near[Math.floor(rnd() * z.near.length)];
      near.push({ x, name: nn, s: nn.startsWith('ss_') ? 0.85 + rnd() * 0.15 : 1.25 + rnd() * 0.4, flip: rnd() < 0.5 });
    }
    for (let x = -3000; x < LEVEL_END * 1.6 + 3000; x += 180 + rnd() * 360) {
      const big = rnd() < 0.25; // moita grande escura rente à câmera
      fore.push({ x, name: big ? 'bush_dark' : ['grass_tall', 'fern', 'fern2', 'grass_tall'][Math.floor(rnd() * 4)], s: big ? 3.4 + rnd() : 2.4 + rnd() * 1.1, big, flip: rnd() < 0.5 });
    }
    for (let x = -300; x < LEVEL_END + 600; x += 18 + rnd() * 40) tufts.push({ x, dy: rnd(), h: 6 + rnd() * 10, l: rnd() });
    const beams = [];
    for (let x = -2400; x < LEVEL_END * 0.3 + 2400; x += 220 + rnd() * 260) beams.push({ x, w: 50 + rnd() * 110, a: 0.07 + rnd() * 0.09, ph: rnd() * 6 });
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
      type, T, x: h.x + side * ((w.viewHalf || 900) + 40 + Math.random() * 60), face: -side, hp: T.hp, maxHp: T.hp,
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
    1: { wind: 0.07, active: 0.12, recover: 0.24, reach: 150, dmg: 1, sprites: ['rs_atk0', 'rs_atk1', 'rs_atk2'], lunge: 30 },
    2: { wind: 0.06, active: 0.12, recover: 0.24, reach: 150, dmg: 1, sprites: ['rs_atk2', 'rs_atk1', 'rs_atk0'], lunge: 30 },
    3: { wind: 0.12, active: 0.14, recover: 0.36, reach: 175, dmg: 2, sprites: ['rs_atk0', 'rs_atk1', 'rs_atk2'], lunge: 90 },
    heavy: { wind: 0.42, active: 0.14, recover: 0.42, reach: 185, dmg: 3, sprites: ['rs_block1', 'rs_atk1', 'rs_atk2'], lunge: 70, breaks: true, arc: true },
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

    // Sem parede invisível: o rōnin anda livre até o fim do caminho e pode ir de
    // encontro aos inimigos (eles surgem logo fora do quadro e vêm até ele).
    const minX = -100, maxX = LEVEL_END + 400;
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
      if (e.state === 'dead' || (e.state === 'enter' && e.t < 0)) continue; // quem está chegando também pode ser atingido
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
        h.parryT = w.time;
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
        if (ad < (w.viewHalf || 900) * 0.8) { e.state = 'approach'; e.t = 0; }
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
    w.enemies = w.enemies.filter((e) => !(e.state === 'dead' && e.deadT > (e.T.side ? 7 : 2.2))); // corpos ficam no chão
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
  let farCache = null;   // mata distante pré-desenhada
  let backdrop = null;   // panorama de montanhas (gerado uma vez)

  /**
   * Panorama do Japão antigo em camadas de névoa (cinza claro no fundo, mais escuro
   * à frente): sol pálido, cordilheira com o vulcão nevado, colinas com pinheiros,
   * um pagode de cinco andares, um castelo no morro, torii e telhados de templo.
   * As cristas usam senos de frequência inteira: o panorama repete sem emenda.
   */
  function makeBackdrop() {
    const PW = 4096, PH = 420;
    const c = document.createElement('canvas');
    c.width = PW; c.height = PH;
    const g = c.getContext('2d');
    const TAU = Math.PI * 2;
    const ridge = (x, base, amp, fs) => base - amp * fs.reduce((sum, [f, a, ph]) => sum + a * Math.sin((x / PW) * TAU * f + ph), 0);
    const fill = (fn, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, PH);
      for (let x = 0; x <= PW; x += 8) g.lineTo(x, fn(x));
      g.lineTo(PW, PH);
      g.closePath();
      g.fill();
    };
    const mist = (y0, y1, a) => {
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, 'rgba(225,226,220,0)');
      gr.addColorStop(1, `rgba(225,226,220,${a})`);
      g.fillStyle = gr;
      g.fillRect(0, y0, PW, y1 - y0);
    };
    // sol pálido com halo
    const sun = g.createRadialGradient(720, 110, 0, 720, 110, 190);
    sun.addColorStop(0, 'rgba(255,255,250,0.95)');
    sun.addColorStop(0.3, 'rgba(255,255,250,0.55)');
    sun.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = sun;
    g.fillRect(500, -100, 440, 420);
    // pássaros
    g.strokeStyle = 'rgba(70,72,68,0.6)';
    g.lineWidth = 2;
    for (const [bx, by, bs] of [[1500, 70, 9], [1530, 82, 7], [1556, 66, 6], [3000, 100, 8], [3024, 110, 6]]) {
      g.beginPath(); g.moveTo(bx - bs, by - bs * 0.4); g.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.6, bx, by);
      g.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.6, bx + bs, by - bs * 0.4); g.stroke();
    }
    // 1) cordilheira distante com o vulcão nevado (cone suave)
    const FX = 1250, FW = 620, FTOP = 52;
    const fuji = (x) => {
      const d = Math.abs(x - FX) / FW;
      return d >= 1 ? PH : FTOP + (300 - FTOP) * Math.pow(d, 1.35) + (d < 0.07 ? 6 : 0);
    };
    const far = (x) => Math.min(fuji(x), ridge(x, 270, 1, [[3, 26, 0.4], [7, 14, 1.3], [13, 6, 2.1]]));
    fill(far, '#c3c5bf');
    // neve no topo, com borda recortada
    g.save();
    g.beginPath();
    g.moveTo(FX - FW, PH);
    for (let x = FX - FW; x <= FX + FW; x += 4) g.lineTo(x, fuji(x));
    g.lineTo(FX + FW, PH);
    g.closePath();
    g.clip();
    g.fillStyle = '#f1f1ec';
    g.beginPath();
    g.moveTo(FX - 300, 0);
    g.lineTo(FX + 300, 0);
    for (let x = FX + 300; x >= FX - 300; x -= 12) g.lineTo(x, 130 + 16 * Math.sin(x * 0.09) + 10 * Math.sin(x * 0.23));
    g.closePath();
    g.fill();
    g.restore();
    mist(170, 320, 0.75);
    // 2) colinas médias com pinheiros, pagode e castelo
    const mid = (x) => ridge(x, 318, 1, [[2, 22, 2.2], [5, 16, 0.3], [11, 7, 1.7]]);
    fill(mid, '#a3a69f');
    g.fillStyle = '#a3a69f';
    for (let x = 0; x < PW; x += 23 + ((x * 7) % 19)) { // pinheiros na crista
      const y = mid(x), h = 16 + ((x * 13) % 14);
      g.beginPath(); g.moveTo(x - 6, y + 2); g.lineTo(x, y - h); g.lineTo(x + 6, y + 2); g.fill();
    }
    const pagoda = (px, base, s) => { // pagode de cinco andares
      g.fillStyle = '#8e918a';
      g.fillRect(px - 2 * s, base - 150 * s, 4 * s, 30 * s); // ponta (sōrin)
      for (let i = 0; i < 5; i++) {
        const y = base - i * 24 * s, w2 = (46 - i * 6) * s;
        g.fillRect(px - w2 * 0.55, y - 16 * s, w2 * 1.1, 16 * s);
        g.beginPath(); // beiral curvo
        g.moveTo(px - w2 - 8 * s, y - 14 * s);
        g.quadraticCurveTo(px, y - 26 * s, px + w2 + 8 * s, y - 14 * s);
        g.lineTo(px + w2 * 0.8, y - 18 * s);
        g.lineTo(px - w2 * 0.8, y - 18 * s);
        g.closePath(); g.fill();
      }
    };
    pagoda(2480, mid(2480) + 4, 0.95);
    const castle = (px, base, s) => { // castelo no morro: muralha de pedra e telhados em camadas
      g.fillStyle = '#8e918a';
      g.beginPath(); g.moveTo(px - 70 * s, base); g.lineTo(px - 55 * s, base - 30 * s); g.lineTo(px + 55 * s, base - 30 * s); g.lineTo(px + 70 * s, base); g.fill();
      const tiers = [[56, 26], [44, 24], [32, 22], [22, 20]];
      let y = base - 30 * s;
      for (const [hw, hh] of tiers) {
        g.fillRect(px - hw * 0.8 * s, y - hh * s, hw * 1.6 * s, hh * s);
        g.beginPath();
        g.moveTo(px - (hw + 12) * s, y - hh * 0.75 * s);
        g.quadraticCurveTo(px, y - (hh + 16) * s, px + (hw + 12) * s, y - hh * 0.75 * s);
        g.closePath(); g.fill();
        y -= hh * s;
      }
    };
    castle(3420, mid(3420) + 6, 1);
    mist(260, 380, 0.6);
    // 3) morros próximos com torii e telhado de templo
    const near = (x) => ridge(x, 372, 1, [[3, 14, 1.1], [8, 9, 2.6], [17, 4, 0.2]]);
    fill(near, '#83867f');
    g.fillStyle = '#83867f';
    for (let x = 0; x < PW; x += 40 + ((x * 11) % 33)) { // copas arredondadas
      const y = near(x);
      g.beginPath(); g.arc(x, y + 4, 14 + ((x * 3) % 10), Math.PI, 0); g.fill();
    }
    const torii = (px, base) => {
      g.fillStyle = '#6f726b';
      g.fillRect(px - 26, base - 54, 5, 54); g.fillRect(px + 21, base - 54, 5, 54);
      g.fillRect(px - 32, base - 44, 64, 4);
      g.beginPath(); g.moveTo(px - 40, base - 56); g.quadraticCurveTo(px, base - 50, px + 40, base - 56); g.lineTo(px + 36, base - 62); g.quadraticCurveTo(px, base - 57, px - 36, base - 62); g.closePath(); g.fill();
    };
    torii(560, near(560) + 6);
    torii(3900, near(3900) + 6);
    g.fillStyle = '#74776f'; // telhado de templo
    const tx = 1900, ty = near(1900) + 4;
    g.fillRect(tx - 40, ty - 26, 80, 26);
    g.beginPath(); g.moveTo(tx - 70, ty - 22); g.quadraticCurveTo(tx, ty - 70, tx + 70, ty - 22); g.closePath(); g.fill();
    mist(330, PH, 0.5);
    return c;
  }
  let groundPair = null; // textura da clareira (gerada uma vez)

  /**
   * Terra da clareira, gerada (repete sem emenda na horizontal): manchas claras e
   * escuras bem suaves, pedrinhas, marcas de pegadas e tufos de capim — mais
   * densos no alto (o fundo, longe) e na faixa de baixo (beira, perto da câmera).
   */
  function makeGround() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#8c8c86';
    g.fillRect(0, 0, 1024, 256);
    let sd = 991;
    const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
    const blob = (x, y, rad, col) => {
      for (const ox of [-1024, 0, 1024]) {
        const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad);
        gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2);
      }
    };
    for (let i = 0; i < 70; i++) blob(r() * 1024, r() * 256, 30 + r() * 90, r() < 0.5 ? 'rgba(255,255,250,0.10)' : 'rgba(20,20,18,0.12)');
    for (let i = 0; i < 260; i++) { // pedrinhas
      const x = r() * 1024, y = r() * 256, s = 1 + r() * 2.5;
      g.fillStyle = 'rgba(40,40,36,0.5)'; g.beginPath(); g.ellipse(x, y + 1, s * 1.4, s * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(200,200,192,0.35)'; g.beginPath(); g.ellipse(x - 0.5, y, s, s * 0.5, 0, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(35,38,32,0.55)'; g.lineWidth = 1.2;
    for (let i = 0; i < 900; i++) { // capim: mais no fundo e na beira de baixo
      const y = r() < 0.5 ? r() * 60 : 190 + r() * 66;
      const x = r() * 1024, h = 3 + r() * 9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y - h); g.stroke();
    }
    return c;
  }
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
      case 'dead': return 'rs_die' + (h.deadT < 0.22 ? 0 : h.deadT < 0.55 ? 1 : h.deadT < 1.05 ? 2 : 3);
      case 'roll': return 'rs_walk1';
      case 'hurt': return 'rs_die0';
      case 'broken': return 'rs_die1';
      case 'block': return w.time - (h.parryT || -9) < 0.3 ? 'rs_block1' : 'rs_block0';
      case 'attack': {
        const A = h.atk;
        return h.t < A.wind ? A.sprites[0] : h.t < A.wind + A.active + 0.05 ? A.sprites[1] : A.sprites[2];
      }
      case 'walk': return 'rs_walk' + (Math.floor(h.stride / 38) % 4);
      default: return w.active ? 'rs_atk0' : 'rs_walk0';
    }
  }

  function enemySprite(e) {
    const S = e.T.sp, A = e.atk;
    switch (e.state) {
      case 'enter': case 'approach':
        return e.vx ? S.walk[Math.floor(e.stride / (S.die ? 38 : 34)) % S.walk.length] : S.idle;
      case 'windup': return A && A.heavy && S.heavyWind ? S.heavyWind : S.wind;
      case 'strike': return A && A.heavy && S.heavyAct ? S.heavyAct : S.act;
      case 'recover': return S.rec || S.idle;
      case 'guard': return S.guard || S.wind;
      case 'stagger': return S.stagger || S.hurt;
      case 'hurt': return S.hurt;
      case 'dead': return S.die ? S.die[e.deadT < 0.2 ? 0 : e.deadT < 0.5 ? 1 : 2] : S.hurt;
    }
    return S.idle;
  }

  /** Morte em três tempos (recua, joelhos, desaba) — igual ao modo principal. */
  function deathPose(t, face) {
    const k1 = ease(t / 0.16), k2 = ease((t - 0.14) / 0.42), k3 = ease((t - 0.58) / 0.5);
    return { rotate: face * (-0.14 * k1 * (1 - k2) + 0.16 * k2 + 0.38 * k3), sy: 1 - 0.24 * k2 - 0.16 * k3, dark: 0.5 * k3, alpha: 1 - clamp((t - 1.5) / 0.6, 0, 1) };
  }

  function render(ctx0, cam, w) {
    let ctx = ctx0;
    const W = cam.viewW, H = cam.viewH;
    const k = (H / REF_H) * ZOOM * (1 + w.punch);
    const gy = H * GROUND;
    const shx = (Math.random() - 0.5) * w.shake, shy = (Math.random() - 0.5) * w.shake;
    const X = (x, p = 1) => (x - w.camX * p) * k + W / 2 + shx * p;
    const heroScale = ((H * HERO_H) / 135) * (1 + w.punch); // sprites antigos (3/4); já em px de tela
    const sideScale = ((H * HERO_H) / ATLAS.rs_walk0.h) * (1 + w.punch); // sprites de perfil

    ctx.save();
    // céu de névoa: claro no alto, escurecendo para a mata
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#d9d9d4');
    sky.addColorStop(0.55, '#8e918a');
    sky.addColorStop(1, '#3d403b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const S = w.scenery;
    // paisagem japonesa ao fundo (quase parada: paralaxe 0,05), repetida sem emenda
    if (!backdrop) backdrop = makeBackdrop();
    {
      const top = H * 0.06, bh = H * GROUND - H * 0.11 - top + 8 * k;
      const sc = bh / backdrop.height, tw = backdrop.width * sc;
      const off = ((((w.camX * k * 0.05) % tw) + tw) % tw);
      for (let x = -off; x < W; x += tw) ctx.drawImage(backdrop, x, top, tw + 1, bh);
    }
    const drawLayer = (list, p, baseY, scaleK, fog, tone = null, cached = false) => {
      for (const o of list) {
        const sx = cached ? (o.x - w.camX * p) * k + W / 2 : X(o.x, p);
        if (sx < -500 * k - W * 0.35 || sx > W + 500 * k + W * 0.35) continue;
        if (tone && !o.name.startsWith('ss_')) {
          // árvore do fundo vira silhueta no tom da distância (mata em névoa)
          const m = ATLAS[o.name], sc = o.s * scaleK * k;
          if (!m) continue;
          ctx.save();
          // a base (losango de chão do sprite isométrico) fica escondida atrás da clareira
          ctx.translate(sx, baseY + (o.dy || 0) * k + m.h * sc * 0.22);
          ctx.scale(o.flip ? -1 : 1, 1);
          ctx.drawImage(Sprites.tinted(o.name, tone), -m.ax * sc, -m.ay * sc, m.w * sc, m.h * sc);
          ctx.restore();
        } else Sprites.draw(ctx, o.name, sx, baseY + (o.dy || 0) * k, o.s * scaleK * k, { flip: o.flip });
      }
      if (fog) {
        ctx.fillStyle = `rgba(200,202,196,${fog})`;
        if (cached) ctx.fillRect(-W, 0, W * 3, H);
        else ctx.fillRect(0, 0, W, H);
      }
    };
    // camada distante (bem pequena e lavada pela névoa)
    w.viewHalf = W / 2 / k;
    const gTop = gy - H * 0.11, gBot = H * 0.95; // a clareira: do fundo (gTop) até rente à câmera
    // mata distante: muda devagar (paralaxe 0,3), então fica pré-desenhada com margem
    // e só é refeita quando a câmera sai dela
    const M = W * 0.3;
    let fc = farCache;
    if (!fc || fc.W !== W || fc.H !== H || fc.k !== k || Math.abs((w.camX - fc.camX) * 0.3 * k) > M * 0.9) {
      fc = farCache = fc && fc.W === W && fc.H === H ? fc : { c: document.createElement('canvas'), W, H };
      fc.c.width = Math.ceil(W + M * 2); fc.c.height = Math.ceil(gTop + 4);
      fc.k = k; fc.camX = w.camX;
      const fctx = fc.c.getContext('2d');
      fctx.clearRect(0, 0, fc.c.width, fc.c.height);
      const saved = ctx;
      ctx = fctx; // drawLayer desenha no contexto atual
      fctx.translate(M, 0);
      drawLayer(S.far, 0.3, gTop + 10 * k, 1.05, 0, '#9a9d96', true);
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx = saved;
    }
    ctx.drawImage(fc.c, -M - (w.camX - fc.camX) * 0.3 * k, 0);
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
      // borda suave: faixas cada vez mais estreitas empilhadas (o miolo fica mais claro)
      ctx.globalAlpha = 0.4;
      for (const f of [1, 0.7, 0.45, 0.22]) {
        const inset = (b.w * k * (1 - f)) / 2;
        ctx.beginPath();
        ctx.moveTo(bx + inset, 0);
        ctx.lineTo(bx + b.w * k - inset, 0);
        ctx.lineTo(bx + b.w * k + 260 * k - inset * 1.6, gy + 40 * k);
        ctx.lineTo(bx + 200 * k + inset * 1.6, gy + 40 * k);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    // camada do meio (casas, mata) com névoa leve
    drawLayer(S.mid, 0.62, gTop + 14 * k, 1.2, 0.12, '#55584f');

    // chão: a clareira em perspectiva. O ladrilho de terra (espelhado aos pares) é
    // desenhado em faixas horizontais; cada faixa anda com a sua paralaxe — devagar
    // no fundo, rápido rente à câmera — e é mais larga quanto mais perto (2.5D).
    const gimg = true;
    ctx.fillStyle = '#2a2a28';
    ctx.fillRect(0, gTop, W, H - gTop);
    if (gimg) {
      if (!groundPair) groundPair = makeGround();
      const N = 22, band = (gBot - gTop) / N, tg = (gy - gTop) / (gBot - gTop);
      const GW = groundPair.width, GH = groundPair.height;
      const pairW = GW * ((gBot - gTop) / GH) * 1.4; // largura do ladrilho na linha dos lutadores
      for (let j = 0; j < N; j++) {
        const t = (j + 0.5) / N;
        const p = clamp(1 + (t - tg) * 1.1, 0.55, 1.6);
        const pw = pairW * p;
        const off = ((((w.camX * k * p - W / 2) % pw) + pw) % pw);
        for (let x = -off; x < W; x += pw) {
          ctx.drawImage(groundPair, 0, (j / N) * GH, GW, GH / N, x, gTop + j * band, pw + 1, band + 1);
        }
      }
      // névoa no fundo da clareira, sombra rente à câmera
      const fog = ctx.createLinearGradient(0, gTop, 0, gBot);
      fog.addColorStop(0, 'rgba(200,202,196,0.55)');
      fog.addColorStop(0.35, 'rgba(200,202,196,0.08)');
      fog.addColorStop(0.75, 'rgba(0,0,0,0.05)');
      fog.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, gTop, W, gBot - gTop);
    }
    // poças de "tinta" (sangue) no chão
    for (const f of w.fx) {
      if (!f.ground) continue;
      ctx.fillStyle = `rgba(10,10,10,${0.55 * clamp(1 + f.life / 6, 0, 1)})`;
      ctx.beginPath();
      ctx.ellipse(X(f.x), gy + 2 * k, f.s * 1.6 * k, f.s * 0.5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // objetos da beira do caminho (atrás dos lutadores)
    drawLayer(S.near, 0.92, gTop + (gy - gTop) * 0.45, 1.2, 0);

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
      const side = isHero || a.T.side;
      const sc = (side ? sideScale : heroScale) * (isHero ? 1 : a.T.scale);
      const dead = a.state === 'dead';
      // perfil: a morte é a sequência desenhada na folha (cai e fica no chão)
      const dp = dead && !side ? deathPose(a.deadT, a.face) : null;
      let tint = '#ffffff', ta = a.flash * 6;
      if (!isHero && a.T.tone && ta < a.T.tone[1]) { tint = a.T.tone[0]; ta = a.T.tone[1]; }
      if (!isHero && a.state === 'windup') {
        // telégrafo: brilho que cresce; imbloqueável pisca forte
        const p = a.t / a.atk.windup;
        ta = a.atk.unblockable ? 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(w.time * 40)) : 0.35 * p;
      }
      if (!isHero && a.state === 'stagger') { tint = '#ffffff'; ta = 0.2 + 0.1 * Math.sin(w.time * 20); }
      if (isHero && a.state === 'block') { tint = '#ffffff'; ta = w.time - a.blockPress < 0.22 ? 0.45 : 0.08; }
      if (dp && dp.dark > ta) { tint = '#000000'; ta = dp.dark; }
      const bob = !dead && (a.state === 'walk' || (a.vx && a.state !== 'block')) ? Math.abs(Math.sin((a.stride / 38) * Math.PI)) * 1.5 * k : 0;
      if (a.state === 'roll') {
        // rolamento: rastro de vultos atrás do corpo agachado
        for (let g = 1; g <= 3; g++) Sprites.draw(ctx, name, sx - a.face * g * 26 * k, gy + 6 * k, sc, { flip: a.face < 0, alpha: 0.22 / g, sy: 0.82, rotate: a.face * 0.25 });
      }
      const corpseFade = dead && side ? 1 - clamp(a.deadT - (isHero ? 99 : 6), 0, 1) : null;
      Sprites.draw(ctx, name, sx, gy - bob + (a.state === 'roll' ? 6 * k : 0), sc, {
        flip: a.face < 0, tint, tintAmount: ta,
        rotate: dp ? dp.rotate : a.state === 'roll' ? a.face * 0.25 : 0,
        sy: dp ? dp.sy : a.state === 'roll' ? 0.82 : 1,
        alpha: dp ? dp.alpha : corpseFade !== null ? corpseFade : 1,
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
    if (h.state === 'attack' && h.atk.arc && h.t >= h.atk.wind && h.t < h.atk.wind + h.atk.active + 0.06) {
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

    // primeiro plano: muro de pedra rente à câmera (só o topo aparece acima da faixa de cinema)
    const WL = ATLAS.ss_wall, wimg = Assets.images.ss_wall;
    if (wimg) {
      const wk = (H * 0.2) / WL.h, ww = WL.w * wk, top = H * 0.885;
      const off = (w.camX * 1.25 * k) % (ww * 2);
      for (let x = -off - ww * 2; x < W + ww; x += ww) {
        const i = Math.round((x + off) / ww);
        ctx.save();
        if (i & 1) { ctx.translate(x + ww, top); ctx.scale(-1, 1); } else ctx.translate(x, top);
        ctx.globalAlpha = 1;
        ctx.drawImage(wimg, 0, 0, ww + 1, WL.h * wk);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; // na sombra, mais escuro que o caminho
        ctx.fillRect(0, 0, ww + 1, WL.h * wk);
        ctx.restore();
      }
    }
    // primeiro plano: silhuetas escuras e desfocadas passando rente à câmera
    for (const o of S.fore) {
      const sx = X(o.x, 1.6);
      if (sx < -600 * k || sx > W + 600 * k) continue;
      const m = ATLAS[o.name];
      if (!m) continue;
      const sc = (o.s * k) / ZOOM * 0.85;
      ctx.save();
      ctx.translate(sx, o.big ? H * 1.16 : H * 1.12); // só o topo aparece: a borda reta do recorte fica fora da tela
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
      { id: 'attack', label: 'Cortar', x: W - r * 1.6, y: H - r * 2.4, r: r * 1.15 },
      { id: 'heavy', label: 'Golpe forte', x: W - r * 4.2, y: H - r * 1.7, r },
      { id: 'block', label: 'Defender', x: W - r * 1.7, y: H - r * 5.0, r },
      { id: 'dash', label: 'Rolar', x: W - r * 4.4, y: H - r * 4.3, r: r * 0.95 },
      { id: 'pause', label: 'Sair', x: W - 34, y: 34, r: 24 }, // sai para o título
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
      // rótulo em português; palavras longas quebram em duas linhas
      const words = b.label.split(' ');
      const fs = Math.round(b.r * (words.length > 1 ? 0.32 : b.label.length > 6 ? 0.3 : 0.36));
      ctx.font = `700 ${fs}px ${FONT_UI}`;
      words.forEach((wd, i) => ctx.fillText(wd, b.x, b.y + 1 + (i - (words.length - 1) / 2) * fs * 1.1));
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
