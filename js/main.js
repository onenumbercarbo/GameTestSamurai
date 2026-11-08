/**
 * main.js — Estados do jogo, diretor de câmera, progressão pelas vilas,
 * game loop e renderização.
 */

/* ================================ portão torii ================================ */

/**
 * Portão de saída da vila: o torii da folha de floresta. Os pilares ficam
 * alinhados ao eixo X do mundo (a viga desce para a direita na tela) e são
 * colisores invisíveis; o jogador passa ENTRE eles.
 * Fechado: escurecido, com uma barreira vermelha (kekkai). Aberto: luz dourada.
 */
const TORII_SCALE = 0.95;
const TORII_HALF = 1.33; // meia distância entre os pilares, em tiles

class ToriiGate {
  constructor(x, y, level) {
    this.x = x;
    this.y = y;
    this.open = false;
    this.t = 0;
    this.alive = true;
    this.box = { x0: x - TORII_HALF - 0.3, y0: y - 0.3, x1: x + TORII_HALF + 0.3, y1: y + 0.3 };
    level.addPost(x - TORII_HALF, y, 0.3);
    level.addPost(x + TORII_HALF, y, 0.3);
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const a = cam.worldToScreen(this.x - TORII_HALF, this.y);
    const b = cam.worldToScreen(this.x + TORII_HALF, this.y);
    const H = 150;
    const at = cam.worldToScreen(this.x - TORII_HALF, this.y, H);
    const bt = cam.worldToScreen(this.x + TORII_HALF, this.y, H);
    const plane = (fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(bt.x, bt.y); ctx.lineTo(at.x, at.y);
      ctx.closePath();
      ctx.fill();
    };
    const g = cam.worldToScreen(this.x, this.y);
    Sprites.draw(ctx, 'torii', g.x, g.y, TORII_SCALE * s, {
      tint: '#0b0806', tintAmount: this.open ? 0 : 0.35,
    });
    ctx.save();
    if (this.open) {
      const lg = ctx.createLinearGradient(0, at.y, 0, a.y);
      lg.addColorStop(0, 'rgba(255,210,120,0)');
      lg.addColorStop(1, `rgba(255,210,120,${0.35 + 0.15 * Math.sin(this.t * 4)})`);
      plane(lg);
    } else {
      // Barreira selada: ondas vermelhas translúcidas entre os pilares.
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.t * 3);
      plane('rgba(200,40,30,0.6)');
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = 'rgba(255,120,90,0.8)';
      ctx.lineWidth = 1.5 * s;
      for (let k = 0; k < 4; k++) {
        const z = ((this.t * 30 + k * 35) % 140);
        const p0 = cam.worldToScreen(this.x - TORII_HALF, this.y, z), p1 = cam.worldToScreen(this.x + TORII_HALF, this.y, z);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ================================== cutscenes ================================== */

/**
 * Sequência de PLANOS de câmera. Cada passo: { x, y, zoom, rate, dur, cut?, onStart? }
 * (x/y podem ser funções, para seguir algo que se move).
 */
class Cutscene {
  constructor(steps, onEnd, skippable = false) {
    this.steps = steps;
    this.onEnd = onEnd;
    this.skippable = skippable;
    this.i = -1;
    this.t = 0;
    this.done = false;
    this.next();
  }

  next() {
    this.i++;
    this.t = 0;
    if (this.i >= this.steps.length) {
      this.done = true;
      if (this.onEnd) this.onEnd();
      return;
    }
    const st = this.steps[this.i];
    if (st.onStart) st.onStart();
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    if (this.t >= this.steps[this.i].dur) this.next();
  }

  skip() {
    while (!this.done) this.next();
  }

  shot() {
    const st = this.steps[Math.min(this.i, this.steps.length - 1)];
    const v = (q) => (typeof q === 'function' ? q() : q);
    return { x: v(st.x), y: v(st.y), zoom: st.zoom, rate: st.rate || 2.5, cut: st.cut && this.t === 0 };
  }
}

/* ==================================== jogo ==================================== */

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const input = new Input(canvas);
  const camera = new Camera();
  input.onFirstGesture = () => Sfx.unlock();

  const SAVE_KEY = 'ronin-reliquia-save';
  // Progresso salvo: { stage, items }. Aceita o formato antigo (só o número da vila).
  const loadSave = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { stage: 0, items: [] };
      const v = JSON.parse(raw);
      if (typeof v === 'number') return { stage: v, items: [] };
      return { stage: v.stage || 0, items: Array.isArray(v.items) ? v.items.filter((i) => ITEMS[i]) : [] };
    } catch { return { stage: 0, items: [] }; }
  };
  const writeSave = (v) => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch { /* sem armazenamento: tudo bem */ }
  };

  const game = {
    state: 'loading',
    t: 0,
    loadFrac: 0,
    stageIndex: 0,
    world: null,
    fade: 1,
    fadeDir: -1,
    fadeThen: null,
    save: { stage: 0, items: [] },
    items: [],
    debug: false,
    stats: null,
    ambient: [],
  };

  const newStats = () => ({ kills: 0, time: 0, maxCombo: 0, combo: 0, comboTimer: 0 });

  /* ------------------------------ criação do mundo ------------------------------ */

  function createWorld(index, hp) {
    const stage = STAGES[index];
    const w = {
      stage,
      index,
      level: new Level(stage),
      encounters: stage.waves.map((e) => ({ ...e, state: 'idle' })),
      sealFound: !stage.seal,
      sealWarned: 0,
      camera,
      effects: new Effects(),
      enemies: [],
      projectiles: [],
      pickups: [],
      spawnQueue: [],
      boss: null,
      gate: null,
      hitStop: 0,
      timeScale: 1,
      slowmoLeft: 0,
      attackTokens: 0,
      stats: game.stats,
      cutscene: null,
      waveIndex: -1,
      activeArena: null,
      bossStarted: false,
      bossFight: false,
      exitOpen: false,
      banner: null,
      damageVignette: 0,
      time: 0,
      smokeTimer: 0,
    };
    w.level.world = w;
    w.player = new Player(w, stage.start[0], stage.start[1], game.items);
    if (hp !== undefined) w.player.hp = Math.min(hp, w.player.maxHp);

    if (stage.exit) w.gate = new ToriiGate(stage.exit[0], stage.exit[1], w.level);
    if (stage.boss) w.boss = new Boss(w, stage.boss.spawn[0], stage.boss.spawn[1]);

    // Tesouros do mapa (já coletados em outra tentativa não reaparecem).
    for (const l of stage.loot || []) {
      if (l[0] === 'seal') w.pickups.push(new Pickup(w, l[1], l[2], 'seal'));
      else if (!game.items.includes(l[1])) w.pickups.push(new Pickup(w, l[2], l[3], 'item', l[1]));
    }

    // Névoa do mapa: tiles já vistos (para o minimapa).
    w.explored = new Uint8Array(stage.size[0] * stage.size[1]);
    w.exploreTimer = 0;

    w.targets = () => {
      const t = w.enemies.filter((e) => e.alive);
      if (w.boss && w.boss.alive) t.push(w.boss);
      for (const p of w.projectiles) if (p.hostile) t.push(p);
      for (const c of w.level.breakableTargets()) t.push(c);
      return t;
    };

    w.onLoot = (pk) => {
      if (pk.kind === 'seal') {
        w.sealFound = true;
        Sfx.gong();
        w.showBanner('Selo do portão', { kanji: '御札', sub: 'O torii que leva à próxima vila pode ser aberto', dur: 2.8, color: '#ffcf6a' });
      } else {
        const it = ITEMS[pk.id];
        w.player.equip(pk.id);
        game.items = w.player.items;
        writeSave({ stage: game.stageIndex, items: game.items });
        Sfx.gong();
        w.effects.ring(pk.x, pk.y, 3, 1, '255,210,120');
        w.showBanner(it.name, { kanji: '宝', sub: it.desc, dur: 3.4, color: '#ffcf6a' });
      }
      w.camera.zoomPunch(0.06);
    };
    Object.defineProperty(w, 'inCombat', { get: () => !!(w.activeArena || w.bossFight) });

    w.showBanner = (text, opts = {}) => {
      w.banner = { text, t: 0, dur: opts.dur || 2.2, ...opts };
    };

    w.requiredLeft = () => w.encounters.filter((e) => !e.guard && e.state !== 'done').length;

    w.objectiveText = () => {
      if (w.relic) return 'Recupere a relíquia no altar';
      if (w.bossFight) return 'Derrote Gendō: leia os sinais vermelhos no chão e use o dash';
      if (w.activeArena) {
        const n = w.enemies.filter((e) => e.alive).length + w.spawnQueue.length;
        return `Derrote os saqueadores: ${n} restante${n === 1 ? '' : 's'}`;
      }
      if (w.exitOpen) return 'Siga até o portão torii';
      if (stage.boss) return stage.objective;
      const parts = [];
      const req = w.requiredLeft();
      if (req) parts.push(`${req} emboscada${req > 1 ? 's' : ''} no caminho`);
      if (!w.sealFound) parts.push('encontre o selo do portão (explore o mapa)');
      return parts.length ? 'Falta: ' + parts.join(' · ') : stage.objective;
    };

    w.onBossPhase2 = (b) => {
      w.showBanner('Gendō entra em fúria!', { color: '#ff6a50', dur: 1.8, y: 0.25 });
      stage.boss.adds.forEach((type, i) => {
        const p = w.level.randomFreeNear(b.x, b.y, 3, 5.5, w.player);
        w.spawnQueue.push({ type, x: p.x, y: p.y, delay: 0.5 + i * 0.35 });
      });
    };

    w.onBossDefeated = (b) => {
      w.bossFight = false;
      w.slowmoLeft = 1.6;
      w.camera.shake(14);
      for (const e of w.enemies) if (e.alive) e.takeHit({ damage: 999, nx: 0, ny: 0, knockback: 0 });
      w.spawnQueue = [];
      Sfx.roar();
      w.cutscene = new Cutscene([
        { x: () => b.x, y: () => b.y, zoom: 2.2, rate: 2.5, dur: 2.6 },
        {
          x: stage.boss.relic[0], y: stage.boss.relic[1], zoom: 1.7, rate: 2, dur: 1.8,
          onStart: () => {
            w.relic = new Pickup(w, stage.boss.relic[0], stage.boss.relic[1], 'relic');
            w.pickups.push(w.relic);
            w.effects.ring(w.relic.x, w.relic.y, 3, 1.2, '255,220,140');
            Sfx.gong();
            w.showBanner('O Espelho da Lua', { kanji: '月鏡', sub: 'A relíquia sagrada de Kiriyama', dur: 2.6 });
          },
        },
      ]);
    };

    w.onRelicTaken = () => {
      w.relic = null;
      Sfx.gong();
      w.effects.ring(w.player.x, w.player.y, 4, 1.5, '255,220,140');
      w.cutscene = new Cutscene([
        { x: () => w.player.x, y: () => w.player.y, zoom: 2.3, rate: 2, dur: 3 },
      ], () => toVictory());
      w.showBanner('Relíquia recuperada!', { color: '#ffcf6a', dur: 2.8 });
    };

    // Plano de abertura (estabelecimento): começa no marco da vila e viaja até o Rōnin.
    const est = stage.establish;
    w.cutscene = new Cutscene([
      {
        x: est[0], y: est[1], zoom: est[2], rate: 0.6, dur: 1.9, cut: true,
        onStart: () => w.showBanner(stage.name, { kanji: stage.kanji, sub: stage.objective, dur: 3.2, y: 0.32 }),
      },
      { x: () => w.player.x, y: () => w.player.y, zoom: CONFIG.CAMERA.exploreZoom, rate: 1.8, dur: 1.4 },
    ], null, true);
    camera.setTarget(est[0], est[1], est[2]);
    camera.cut();
    camera.letterbox = 1;
    return w;
  }

  /* ------------------------------ diretor de câmera ------------------------------ */

  /**
   * Escolhe o PLANO do momento, em ordem de prioridade:
   *  cutscene > duelo com o boss > arena travada > plano autoral da área > exploração.
   */
  function directCamera(w, dt, realDt) {
    const C = CONFIG.CAMERA;
    const p = w.player;
    let fx, fy, zoom, rate, lb = 0, keep = true;

    if (w.cutscene) {
      const s = w.cutscene.shot();
      fx = s.x; fy = s.y; zoom = s.zoom; rate = s.rate; lb = 1; keep = false;
      camera.setTarget(fx, fy, zoom, rate);
      if (s.cut) camera.cut();
    } else if (w.bossFight && w.boss) {
      // Plano de duelo: enquadra os dois, aproxima quando estão perto.
      const b = w.boss;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      fx = p.x * 0.6 + b.x * 0.4;
      fy = p.y * 0.6 + b.y * 0.4;
      zoom = clamp(1.8 - d * 0.085, 1.15, 1.6);
      rate = 3;
      lb = 0.35;
    } else if (w.activeArena) {
      // Plano fixo da arena: âncora no centro, só "respira" um pouco na direção do jogador.
      const [cx, cy] = w.activeArena.center;
      fx = cx + (p.x - cx) * C.arenaLean;
      fy = cy + (p.y - cy) * C.arenaLean;
      zoom = w.activeArena.zoom || C.arenaZoom;
      rate = 2.2;
      lb = 0.2;
    } else {
      const shot = (w.stage.shots || []).find((s) => Math.hypot(p.x - s.at[0], p.y - s.at[1]) < s.r);
      if (shot) {
        fx = shot.at[0] + (p.x - shot.at[0]) * shot.lean;
        fy = shot.at[1] + (p.y - shot.at[1]) * shot.lean;
        zoom = shot.zoom;
        rate = 2;
      } else {
        // Exploração: plano fechado, levemente à frente de onde o Rōnin anda/mira.
        fx = p.x + p.vx * 0.22 + Math.cos(p.aimAngle) * C.lookAhead * 0.5;
        fy = p.y + p.vy * 0.22 + Math.sin(p.aimAngle) * C.lookAhead * 0.5;
        zoom = C.exploreZoom;
        rate = 2.6;
      }
    }
    if (!w.cutscene) camera.setTarget(fx, fy, zoom, rate);
    camera.letterboxTarget = lb;
    camera.update(dt, realDt);
    if (keep) camera.keepInFrame(p.x, p.y, C.safeArea);
  }

  /* ---------------------------------- atualização ---------------------------------- */

  function queueGroup(w, center, types) {
    types.forEach((type, i) => {
      const p = w.level.randomFreeNear(center[0], center[1], 2.8, 5.6, w.player);
      w.spawnQueue.push({ type, x: p.x, y: p.y, delay: i * 0.28 });
    });
  }

  function updateEncounters(w, dt) {
    const p = w.player;
    const stage = w.stage;

    // Emboscadas: chegar perto do centro de uma trava a arena (uma por vez).
    if (!w.activeArena) {
      const enc = w.encounters.find((e) => e.state === 'idle' && Math.hypot(p.x - e.center[0], p.y - e.center[1]) < e.r - 0.5);
      if (enc) {
        enc.state = 'active';
        w.activeArena = { ...enc, enc, groups: enc.groups.map((g) => g.slice()), delay: 0.5 };
        const label = enc.guard ? 'Emboscada! Guardiões do tesouro' : 'Emboscada!';
        w.showBanner(label, { color: '#ff6a50', dur: 1.6, y: 0.24 });
        Sfx.smoke();
      }
    }
    if (w.activeArena) {
      const a = w.activeArena;
      a.delay -= dt;
      const alive = () => w.enemies.filter((e) => e.alive).length + w.spawnQueue.length;
      if (a.groups.length && alive() <= 1 && a.delay <= 0) {
        queueGroup(w, a.center, a.groups.shift());
        a.delay = 1.2;
      }
      if (!a.groups.length && alive() === 0) {
        a.enc.state = 'done';
        w.activeArena = null;
        w.showBanner('Área limpa', { dur: 1.4, y: 0.24 });
      }
    }

    // O portão abre quando as emboscadas do caminho caíram e o selo foi achado.
    if (stage.exit && !w.exitOpen && !w.activeArena && w.requiredLeft() === 0 && w.sealFound) {
      w.exitOpen = true;
      w.gate.open = true;
      w.showBanner('O portão está aberto', { sub: 'Siga até o torii para a próxima vila', dur: 2.6, color: '#ffcf6a' });
      Sfx.gong();
    }
    // Aviso ao encostar no portão ainda selado.
    if (stage.exit && !w.exitOpen && w.time > w.sealWarned && Math.hypot(p.x - stage.exit[0], p.y - stage.exit[1]) < 2.4) {
      w.sealWarned = w.time + 6;
      w.showBanner('O portão está selado', { sub: w.objectiveText(), dur: 2.4, y: 0.24, color: '#ff8a70' });
    }

    // Boss: ao entrar no pátio do santuário.
    if (stage.boss && !w.bossStarted) {
      const B = stage.boss;
      if (Math.hypot(p.x - B.center[0], p.y - B.center[1]) < B.triggerR) {
        w.bossStarted = true;
        const b = w.boss;
        w.cutscene = new Cutscene([
          {
            x: () => b.x, y: () => b.y, zoom: 2.0, rate: 2.2, dur: 1.4,
            onStart: () => w.showBanner('Gendō', { kanji: '黒鎌の玄道', sub: 'O Ceifador de Kurokama — líder do clã', dur: 3.4, y: 0.26 }),
          },
          { x: () => b.x, y: () => b.y, zoom: 2.3, rate: 3, dur: 1.7, onStart: () => b.awaken() },
          { x: () => (b.x + p.x) / 2, y: () => (b.y + p.y) / 2, zoom: 1.45, rate: 3, dur: 0.5 },
        ], () => { w.bossFight = true; });
      }
    }

    // Arena travada: o jogador não sai do círculo enquanto houver luta.
    const lock = w.activeArena ? { c: w.activeArena.center, r: w.activeArena.r } : w.bossFight ? { c: stage.boss.center, r: stage.boss.arenaR } : null;
    if (lock) {
      const dx = p.x - lock.c[0], dy = p.y - lock.c[1];
      const d = Math.hypot(dx, dy);
      if (d > lock.r) {
        p.x = lock.c[0] + (dx / d) * lock.r;
        p.y = lock.c[1] + (dy / d) * lock.r;
      }
    }

    // Saída.
    if (w.exitOpen && stage.exit && p.alive && Math.hypot(p.x - stage.exit[0], p.y - stage.exit[1]) < 0.9) {
      stageClear();
    }
  }

  function updateWorld(w, dt, realDt) {
    w.time += dt;
    game.stats.time += dt;
    if (w.cutscene) {
      w.cutscene.update(realDt);
      if (w.cutscene.done) w.cutscene = null;
    }

    w.level.updateFlow(w.player.x, w.player.y, dt);
    w.player.update(dt, input);

    for (const s of w.spawnQueue) s.delay -= dt;
    for (const s of w.spawnQueue.filter((q) => q.delay <= 0)) w.enemies.push(new Ninja(w, s.type, s.x, s.y));
    w.spawnQueue = w.spawnQueue.filter((q) => q.delay > 0);

    for (const e of w.enemies) e.update(dt);
    w.enemies = w.enemies.filter((e) => !e.dead);
    if (w.boss) w.boss.update(dt);
    for (const pr of w.projectiles) pr.update(dt);
    w.projectiles = w.projectiles.filter((pr) => pr.alive);
    for (const pk of w.pickups) pk.update(dt);
    w.pickups = w.pickups.filter((pk) => pk.alive);
    if (w.gate) w.gate.t += dt;

    // Separação entre corpos.
    const bodies = w.enemies.filter((e) => e.alive);
    if (w.boss && w.boss.alive) bodies.push(w.boss);
    for (const e of bodies) e.separateFrom([...bodies, w.player], 0.8);
    if (w.player.alive && w.player.dashTime <= 0) w.player.separateFrom(bodies, 0.5);

    updateEncounters(w, dt);

    for (const pr of w.level.props) {
      if (pr.flash) pr.flash = Math.max(0, pr.flash - dt);
      if (pr.shake) pr.shake = Math.max(0, pr.shake - dt);
    }

    // Revela o minimapa em volta do jogador.
    w.exploreTimer -= dt;
    if (w.exploreTimer <= 0) {
      w.exploreTimer = 0.2;
      const R = 7, W = w.level.W, H = w.level.H, p = w.player;
      for (let j = Math.max(0, Math.floor(p.y - R)); j < Math.min(H, p.y + R); j++) {
        for (let i = Math.max(0, Math.floor(p.x - R)); i < Math.min(W, p.x + R); i++) {
          if (Math.hypot(i + 0.5 - p.x, j + 0.5 - p.y) < R) w.explored[j * W + i] = 1;
        }
      }
    }

    // Fumaça das casas incendiadas.
    w.smokeTimer -= dt;
    if (w.smokeTimer <= 0 && w.stage.smoke) {
      w.smokeTimer = 0.14;
      for (const [x, y] of w.stage.smoke) {
        w.effects.puffs.push({
          x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, z: 90 + Math.random() * 20,
          vx: 0.35, vy: -0.35, vz: 26 + Math.random() * 14, r: 0.35, life: 2.4, max: 2.4, color: '40,36,34',
        });
      }
    }

    w.effects.update(dt);
    const st = game.stats;
    if (st.comboTimer > 0) {
      st.comboTimer -= dt;
      if (st.comboTimer <= 0) st.combo = 0;
    }
    if (w.banner) {
      w.banner.t += realDt;
      if (w.banner.t > w.banner.dur) w.banner = null;
    }
    w.damageVignette = Math.max(0, w.damageVignette - realDt * 2);
    if (w.slowmoLeft > 0) w.slowmoLeft -= realDt;
    w.timeScale = w.slowmoLeft > 0 ? 0.3 : 1;

    if (!w.player.alive && w.player.deadTime > 1.8 && game.state === 'play') {
      game.state = 'gameover';
      game.t = 0;
    }
  }

  /* ---------------------------------- renderização ---------------------------------- */

  function renderWorld(w) {
    const cam = camera;
    ctx.fillStyle = '#0e0b09';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    w.level.drawGround(ctx, cam, w.time);

    // Limite da arena (névoa vermelha tracejada no chão).
    const lock = w.activeArena ? { c: w.activeArena.center, r: w.activeArena.r } : w.bossFight ? { c: w.stage.boss.center, r: w.stage.boss.arenaR } : null;
    if (lock) {
      ctx.save();
      Ground.circle(ctx, cam, lock.c[0], lock.c[1], lock.r);
      ctx.setLineDash([10 * cam.scale, 8 * cam.scale]);
      ctx.lineDashOffset = -w.time * 20;
      ctx.lineWidth = 2.5 * cam.scale;
      ctx.strokeStyle = `rgba(220,60,40,${0.35 + 0.15 * Math.sin(w.time * 3)})`;
      ctx.stroke();
      ctx.restore();
    }

    w.effects.drawGround(ctx, cam);
    for (const e of w.enemies) e.drawGround(ctx, cam);
    if (w.boss) w.boss.drawGround(ctx, cam);

    // Monta a lista de desenháveis visíveis e ordena por profundidade isométrica.
    const list = [];
    for (const pr of [...w.level.props, ...w.level.border]) {
      const b = pr.screenBounds(cam);
      if (b.x1 < 0 || b.x0 > cam.viewW || b.y1 < 0 || b.y0 > cam.viewH) continue;
      list.push(pr);
    }
    list.push(w.player, ...w.enemies, ...w.pickups, ...w.projectiles);
    if (w.boss) list.push(w.boss);
    if (w.gate) list.push(w.gate);
    const sorted = depthSort(list);

    // Casas/árvores na frente do jogador ficam translúcidas (oclusão).
    const pi = sorted.indexOf(w.player);
    const torso = cam.worldToScreen(w.player.x, w.player.y, 45);
    sorted.forEach((d, i) => {
      if (!d.isProp) return;
      let target = 1;
      if (i > pi) {
        const b = d.screenBounds(cam);
        if (torso.x > b.x0 && torso.x < b.x1 && torso.y > b.y0 && torso.y < b.y1) target = 0.38;
      }
      d.fade = damp(d.fade, target, 10, 1 / 60);
    });
    for (const d of sorted) d.draw(ctx, cam);

    w.effects.draw(ctx, cam);
    if (game.debug) renderDebug(w);
  }

  function renderDebug(w) {
    const cam = camera;
    ctx.save();
    ctx.lineWidth = 1;
    for (const p of w.level.solids()) {
      ctx.strokeStyle = 'rgba(80,200,255,0.8)';
      if (p.def.solid === 'box') {
        const b = p.box;
        Ground.path(ctx, cam, [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]);
      } else if (p.def.solid === 'circle') Ground.circle(ctx, cam, p.cx, p.cy, p.r);
      ctx.stroke();
    }
    for (const a of [w.player, ...w.enemies, ...(w.boss ? [w.boss] : [])]) {
      Ground.circle(ctx, cam, a.x, a.y, a.radius);
      ctx.strokeStyle = '#ffd34d';
      ctx.stroke();
    }
    const c = w.player.combo.current;
    if (c) {
      Ground.sector(ctx, cam, w.player.x, w.player.y, c.def.range, c.aim, c.def.arcDeg);
      ctx.strokeStyle = '#ff5050';
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, cam.viewH - 64, 420, 54);
    ctx.fillStyle = '#9fe';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    const p = w.player;
    ctx.fillText(`FPS ${game.fps.toFixed(0)}  mundo (${p.x.toFixed(2)}, ${p.y.toFixed(2)})  estado ${p.state}`, 18, cam.viewH - 44);
    ctx.fillText(`zoom ${camera.zoom.toFixed(2)}  inimigos ${w.enemies.length}  fichas ${w.attackTokens}  onda ${w.waveIndex}`, 18, cam.viewH - 26);
    ctx.restore();
  }

  /** Partículas de ambiente em espaço de tela (pétalas, folhas, brasas). */
  function renderAmbient(kind, dt) {
    const A = game.ambient;
    const cam = camera;
    const want = kind ? 46 : 0;
    while (A.length < want) {
      A.push({ x: Math.random() * cam.viewW, y: Math.random() * cam.viewH, v: 0.5 + Math.random(), ph: Math.random() * 6, s: 0.6 + Math.random() * 0.8 });
    }
    if (A.length > want) A.length = want;
    ctx.save();
    for (const p of A) {
      p.ph += dt * 2;
      if (kind === 'embers') {
        p.y -= 30 * p.v * dt;
        p.x += Math.sin(p.ph) * 12 * dt;
        ctx.fillStyle = `rgba(255,${120 + Math.floor(p.s * 60)},60,${0.35 + 0.35 * Math.sin(p.ph * 2)})`;
        ctx.fillRect(p.x, p.y, 2 * p.s, 2 * p.s);
      } else {
        p.y += 28 * p.v * dt;
        p.x += (Math.sin(p.ph) * 22 + 18) * dt;
        ctx.fillStyle = kind === 'petals' ? 'rgba(255,175,205,0.75)' : 'rgba(150,180,80,0.65)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 3.2 * p.s, 1.6 * p.s, p.ph, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.y < -10) p.y = cam.viewH + 10;
      if (p.y > cam.viewH + 10) p.y = -10;
      if (p.x > cam.viewW + 10) p.x = -10;
      if (p.x < -10) p.x = cam.viewW + 10;
    }
    ctx.restore();
  }

  /* ----------------------------------- transições ----------------------------------- */

  function fadeTo(fn) {
    game.fadeDir = 1;
    game.fadeThen = fn;
  }

  function startStory(index) {
    game.stageIndex = index;
    const hp = game.world && game.world.player.alive && game.world.index !== index
      ? Math.min(CONFIG.PLAYER.maxHp, game.world.player.hp + (CONFIG.PLAYER.maxHp - game.world.player.hp) * 0.6)
      : CONFIG.PLAYER.maxHp;
    game.world = createWorld(index, hp);
    game.state = 'story';
    game.t = 0;
  }

  function stageClear() {
    if (game.state !== 'play') return;
    game.state = 'transition';
    Sfx.gong();
    writeSave({ stage: game.stageIndex + 1, items: game.items });
    fadeTo(() => startStory(game.stageIndex + 1));
  }

  function toVictory() {
    writeSave({ stage: 0, items: [] });
    game.state = 'victory';
    game.t = 0;
  }

  function newGame(from = 0, items = []) {
    game.stats = newStats();
    game.items = items.slice();
    fadeTo(() => startStory(from));
    game.state = 'transition';
  }

  function backToTitle() {
    game.state = 'transition';
    fadeTo(() => {
      game.stats = newStats();
      game.world = createWorld(0);
      game.world.cutscene = null;
      game.state = 'title';
      game.t = 0;
      game.save = loadSave();
    });
  }

  /* ---------------------------------- resize / HiDPI ---------------------------------- */

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    camera.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ------------------------------------ game loop ------------------------------------ */
  /**
   * requestAnimationFrame com dt variável limitado a DT_MAX.
   *  - hit-stop: congela a simulação por alguns ms em impactos (render continua);
   *  - slow motion: timeScale < 1 após derrotar o boss.
   */
  let last = performance.now();
  game.fps = 60;

  function frame(now) {
    const realDt = Math.min((now - last) / 1000, CONFIG.DT_MAX);
    last = now;
    game.fps = damp(game.fps, 1 / Math.max(realDt, 1e-4), 4, realDt);
    game.t += realDt;

    if (input.wasPressed('F3')) game.debug = !game.debug;
    if (input.wasPressed('KeyM')) Sfx.toggleMute();

    const w = game.world;
    let simulated = true;

    switch (game.state) {
      case 'loading':
        UI.loading(ctx, camera, game.loadFrac);
        break;

      case 'title': {
        // Fundo: a aldeia em plano aéreo lento, girando em volta do santuário.
        const a = game.t * 0.12;
        camera.setTarget(14 + Math.cos(a) * 5, 14 + Math.sin(a) * 5, 1.15, 1);
        camera.letterboxTarget = 1;
        camera.update(realDt, realDt);
        w.time += realDt;
        w.effects.update(realDt);
        renderWorld(w);
        renderAmbient(w.stage.ambient, realDt);
        UI.vignette(ctx, camera, 0);
        UI.letterbox(ctx, camera);
        UI.title(ctx, camera, game.t, game.save.stage);
        if (input.wasPressed('KeyC') && game.save.stage > 0) { input.flush(); newGame(game.save.stage, game.save.items); }
        else if (input.consumeConfirm()) newGame(0);
        break;
      }

      case 'story': {
        directCamera(w, 0, realDt);
        renderWorld(w);
        UI.story(ctx, camera, w.stage, game.t, w.index, STAGES.length);
        if (input.consumeConfirm()) {
          if (game.t * 55 < UI.storyLength(w.stage)) game.t = 999; // completa o texto
          else {
            game.state = 'play';
            game.t = 0;
          }
        }
        break;
      }

      case 'play': {
        if (w.cutscene && w.cutscene.skippable && (input.wasPressed('Enter', 'Escape', 'Space') || input.clicked)) {
          w.cutscene.skip(); // plano de abertura pode ser pulado
          input.flush();
        } else if (input.wasPressed('Escape', 'KeyP')) {
          game.state = 'paused';
          break;
        }
        let dt = realDt * w.timeScale;
        if (w.hitStop > 0) {
          w.hitStop -= realDt;
          dt = 0;
          simulated = false;
        }
        if (dt > 0) updateWorld(w, dt, realDt);
        directCamera(w, dt, realDt);
        renderWorld(w);
        renderAmbient(w.stage.ambient, realDt);
        UI.vignette(ctx, camera, w.damageVignette);
        UI.letterbox(ctx, camera);
        UI.hud(ctx, w);
        UI.minimap(ctx, w);
        UI.banner(ctx, w);
        break;
      }

      case 'paused':
        renderWorld(w);
        UI.letterbox(ctx, camera);
        UI.hud(ctx, w);
        UI.pause(ctx, camera, game.items);
        if (input.wasPressed('Escape', 'KeyP')) { game.state = 'play'; input.flush(); }
        break;

      case 'gameover':
        game.world.time += realDt;
        directCamera(w, 0, realDt);
        renderWorld(w);
        UI.vignette(ctx, camera, 0.6);
        UI.gameOver(ctx, camera, game.t);
        if (game.t > 1 && input.consumeConfirm()) {
          game.state = 'transition';
          fadeTo(() => {
            game.world = createWorld(game.stageIndex, CONFIG.PLAYER.maxHp);
            game.world.cutscene = null;
            camera.letterbox = 0;
            game.state = 'play';
          });
        }
        break;

      case 'victory': {
        let dt = realDt * w.timeScale;
        updateWorld(w, dt, realDt);
        directCamera(w, dt, realDt);
        renderWorld(w);
        renderAmbient('petals', realDt);
        UI.letterbox(ctx, camera);
        UI.victory(ctx, camera, game.t, game.stats);
        if (game.t > 2 && input.consumeConfirm()) backToTitle();
        break;
      }

      case 'transition':
        if (w) {
          renderWorld(w);
          UI.letterbox(ctx, camera);
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, camera.viewW, camera.viewH);
        }
        break;
    }

    // Fade em preto entre cenas.
    if (game.fadeDir !== 0) {
      game.fade = clamp(game.fade + game.fadeDir * realDt * 2.2, 0, 1);
      if (game.fade >= 1 && game.fadeDir > 0) {
        const fn = game.fadeThen;
        game.fadeThen = null;
        game.fadeDir = -1;
        input.flush();
        if (fn) fn();
      } else if (game.fade <= 0 && game.fadeDir < 0) game.fadeDir = 0;
    }
    if (game.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${game.fade})`;
      ctx.fillRect(0, 0, camera.viewW, camera.viewH);
    }

    if (simulated) input.endFrame();
    requestAnimationFrame(frame);
  }

  /* -------------------------------------- boot -------------------------------------- */

  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load(`700 40px ${FONT_TITLE}`), new Promise((r) => setTimeout(r, 2500))]).catch(() => {})
    : Promise.resolve();

  Promise.all([Assets.load((f) => (game.loadFrac = f)), fontsReady]).then(() => {
    game.stats = newStats();
    game.world = createWorld(0);
    game.world.cutscene = null;
    game.save = loadSave();
    game.state = 'title';
    game.t = 0;
    game.fadeDir = -1;
  });

  requestAnimationFrame(frame);
  window.__game = game; // para depuração no console
})();
