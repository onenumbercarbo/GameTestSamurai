/**
 * miniboss.js — Guardiões das vilas (mini-chefes).
 *
 * Mesma dinâmica do chefe final (boss.js), mas movida a DADOS: cada guardião
 * declara sprites, ataques e padrões por fase. Um único `MiniBoss` interpreta
 * os tipos de ataque abaixo, todos telegrafados no chão:
 *
 *   sweep  — golpe em leque à frente          spin   — giro de 360°
 *   lunge  — investida em linha reta           slam   — salto + impacto onde o jogador está
 *   vanish — some numa nuvem de fumaça e reaparece atrás do jogador (kunoichi)
 *
 * Defesas: `guard` (bloqueia golpes frontais, contra-ataca; quebrada pelo golpe
 * final do combo, iaijutsu, investida ou ataques pelas costas) ou `evade`
 * (esquiva para trás e emenda uma investida). Postura: só atordoa acumulando dano.
 *
 * Fase 2 (≤ 50% de vida): ruge, chama reforços, fica mais rápido, encadeia
 * ataques (padrões com vários golpes, ex. 'claw claw dive') e, se `shock`,
 * os impactos no chão soltam onda de choque.
 *
 * Padrões: [sequência, peso, distância mínima, distância máxima].
 */
const MINIBOSS_DEFS = {
  oni: {
    short: 'Gōriki', name: 'Gōriki, o Oni do Kanabō', kanji: '剛力の鬼', title: 'Brutamontes do clã Kurokama',
    hp: 420, scale: 0.68, radius: 0.5, speed: [1.8, 2.4], poise: [80, 110],
    defense: 'guard', guardChance: [0.25, 0.45], shock: true,
    sprites: { idle: ['oni_w0'], walk: ['oni_w0', 'oni_w2', 'oni_w3', 'oni_w4', 'oni_w1'], guard: 'oni_raise', hurt: 'oni_raise', roar: 'oni_raise', intro: 'oni_raise' },
    attacks: {
      smash: { kind: 'sweep', windup: 0.7, active: 0.14, recover: 0.55, range: 2.6, arc: 120, damage: 20, wind: 'oni_raise', act: 'oni_slam', rec: 'oni_slam' },
      slam: { kind: 'slam', windup: 0.85, active: 0.12, recover: 0.7, radius: 1.8, reach: 3.4, damage: 24, wind: 'oni_raise', act: 'oni_slam2', rec: 'oni_slam2' },
      charge: { kind: 'lunge', windup: 0.6, active: 0.45, recover: 0.6, speed: 11, width: 1.2, damage: 18, wind: 'oni_raise', act: 'oni_raise', rec: 'oni_slam' },
    },
    phase1: [['smash', 3, 0, 3], ['slam', 2, 1.5, 6], ['charge', 2, 4, 99]],
    phase2: [['smash smash slam', 3, 0, 3], ['slam slam slam', 2, 1.5, 7], ['charge charge', 2, 4, 99]],
  },
  kuno: {
    short: 'Kagerō', name: 'Kagerō, a Garra Sombria', kanji: '陽炎', title: 'Kunoichi assassina do clã',
    hp: 340, scale: 0.62, radius: 0.35, speed: [3.2, 3.9], poise: [60, 80],
    defense: 'evade', guardChance: [0.35, 0.6],
    sprites: { idle: ['kuno_stance'], walk: ['kuno_r1', 'kuno_r2', 'kuno_r3', 'kuno_r4', 'kuno_r5', 'kuno_r6'], guard: 'kuno_stance', hurt: 'kuno_fist', roar: 'kuno_fist', intro: 'kuno_grab' },
    attacks: {
      claw: { kind: 'sweep', windup: 0.4, active: 0.12, recover: 0.35, range: 1.9, arc: 130, damage: 13, wind: 'kuno_stance', act: 'kuno_slash', rec: 'kuno_stance' },
      dive: { kind: 'lunge', windup: 0.45, active: 0.32, recover: 0.4, speed: 15, width: 1.0, damage: 15, wind: 'kuno_stance', act: 'kuno_lunge', rec: 'kuno_slash' },
      pounce: { kind: 'slam', windup: 0.6, active: 0.1, recover: 0.45, radius: 1.3, reach: 5, damage: 16, wind: 'kuno_fist', act: 'kuno_jump', rec: 'kuno_stance' },
      vanish: { kind: 'vanish', windup: 0.3, active: 0.45, recover: 0.05, wind: 'kuno_fist', act: 'kuno_jump', rec: 'kuno_stance' },
    },
    phase1: [['claw', 3, 0, 2.5], ['dive', 3, 2.5, 99], ['pounce', 2, 2, 7]],
    phase2: [['claw claw dive', 3, 0, 3], ['vanish claw claw', 3, 0, 99], ['dive dive dive', 2, 3, 99], ['pounce pounce', 2, 2, 8]],
  },
  monk: {
    short: 'Jōkai', name: 'Jōkai, o Monge Renegado', kanji: '僧兵 浄海', title: 'Sōhei expulso do templo',
    hp: 400, scale: 0.6, radius: 0.45, speed: [2.0, 2.5], poise: [80, 110],
    defense: 'guard', guardChance: [0.35, 0.6],
    sprites: { idle: ['monk_idle', 'monk_idle2'], walk: ['monk_w0', 'monk_w1', 'monk_w2', 'monk_w3', 'monk_w4'], guard: 'monk_pray', hurt: 'monk_idle2', roar: 'monk_pray', intro: 'monk_pray' },
    attacks: {
      thrust: { kind: 'lunge', windup: 0.55, active: 0.24, recover: 0.5, speed: 9, width: 0.8, damage: 17, wind: 'monk_thrust_w', act: 'monk_thrust', rec: 'monk_thrust' },
      cleave: { kind: 'sweep', windup: 0.65, active: 0.16, recover: 0.5, range: 3.0, arc: 150, damage: 19, wind: 'monk_raise', act: 'monk_swing', rec: 'monk_swing' },
      whirl: { kind: 'spin', windup: 0.7, active: 0.5, recover: 0.5, range: 3.1, damage: 20, wind: 'monk_raise', act: 'monk_spin', rec: 'monk_idle' },
    },
    phase1: [['thrust', 3, 1.5, 99], ['cleave', 3, 0, 3], ['whirl', 1.5, 0, 3]],
    phase2: [['thrust thrust cleave', 3, 0, 99], ['cleave whirl', 3, 0, 3.5], ['thrust thrust thrust', 2, 3, 99]],
  },
  ronin: {
    short: 'Jūrō', name: 'Kasa no Jūrō, o Rōnin de Palha', kanji: '笠の十郎', title: 'Espadachim mercenário do clã',
    hp: 440, scale: 0.62, radius: 0.4, speed: [2.6, 3.2], poise: [80, 110],
    defense: 'guard', guardChance: [0.35, 0.6],
    sprites: { idle: ['ronin_low'], walk: ['ronin_w0', 'ronin_w1', 'ronin_w2', 'ronin_w1'], guard: 'ronin_low', hurt: 'ronin_raise', roar: 'ronin_raise', intro: 'ronin_low' },
    attacks: {
      cross: { kind: 'sweep', windup: 0.5, active: 0.14, recover: 0.4, range: 2.3, arc: 150, damage: 16, wind: 'ronin_low', act: 'ronin_dual', rec: 'ronin_low' },
      iai: { kind: 'lunge', windup: 0.55, active: 0.3, recover: 0.5, speed: 16, width: 1.0, damage: 20, wind: 'ronin_low', act: 'ronin_dual', rec: 'ronin_low' },
      heaven: { kind: 'slam', windup: 0.75, active: 0.1, recover: 0.6, radius: 1.6, reach: 4, damage: 24, wind: 'ronin_raise', act: 'ronin_dual', rec: 'ronin_low' },
      cyclone: { kind: 'spin', windup: 0.6, active: 0.5, recover: 0.5, range: 2.6, damage: 18, wind: 'ronin_raise', act: 'ronin_dual', rec: 'ronin_low' },
    },
    phase1: [['cross', 3, 0, 2.6], ['iai', 3, 2.6, 99], ['heaven', 1.5, 1.5, 6]],
    phase2: [['cross cross cyclone', 3, 0, 3], ['iai iai cross', 3, 2, 99], ['heaven heaven', 2, 1.5, 7]],
  },
};

class MiniBoss extends Actor {
  constructor(world, x, y, id) {
    const D = MINIBOSS_DEFS[id];
    super(world, x, y, D.radius);
    this.D = D;
    this.mini = true;
    this.short = D.short;
    this.name = D.name;
    this.kanji = D.kanji;
    this.title = D.title;
    this.maxHp = this.hp = D.hp;
    this.phase = 1;
    this.state = 'dormant';
    this.t = 0;
    this.attack = null;
    this.chain = [];
    this.chained = false;
    this.counter = false;
    this.cooldown = 1;
    this.poise = 0;
    this.maxPoise = D.poise[0];
    this.hits = new Set();
    this.target = { x: 0, y: 0 };
    this.shock = null;
    this.deadT = 0;
    this.guardTime = 0;
    this.guardCd = 2;
    this.blocks = 0;
    this.recentHits = [];
    this.seenSwing = null;
    this.evadeCd = 2;
    this.lastPattern = '';
    this.alpha = 1;
    this.facing = Math.PI * 0.75;
  }

  get A() { return this.D.attacks[this.attack]; }
  get speed() { return this.D.speed[this.phase - 1]; }

  get windMul() {
    let m = this.phase === 1 ? 1 : 0.8;
    if (this.chained) m *= 0.7;
    if (this.counter) m = 0.5;
    return m;
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  awaken() {
    this.setState('roar');
    this.roarIsIntro = true;
  }

  frontal(hit) {
    return Math.abs(angleDiff(Math.atan2(-hit.ny, -hit.nx), this.facing)) < (80 * Math.PI) / 180;
  }

  takeHit(hit) {
    const w = this.world;
    if (!this.alive || this.state === 'dormant' || this.state === 'roar' || this.state === 'evade' || (this.state === 'active' && this.A.kind === 'vanish')) {
      if (this.alive && this.state !== 'dormant') w.effects.sparks(this.x, this.y, Math.atan2(hit.ny, hit.nx) + Math.PI, 5, '#cfe6ff');
      return false;
    }
    const ang = Math.atan2(hit.ny, hit.nx);

    if (this.state === 'guard' && this.frontal(hit)) {
      const breaker = hit.finisher || (hit.poise || 0) >= 18;
      if (!breaker) {
        this.blocks++;
        w.effects.sparks(this.x - hit.nx * 0.4, this.y - hit.ny * 0.4, ang + Math.PI, 10, '#a9d4ff');
        w.effects.text(this.x, this.y, 'BLOQUEIO', '#a9d4ff');
        Sfx.clang();
        w.hitStop = Math.max(w.hitStop, 0.05);
        const p = w.player;
        p.kx -= hit.nx * 6;
        p.ky -= hit.ny * 6;
        p.combo.cancel();
        if (this.blocks >= (this.phase === 1 ? 3 : 2)) {
          this.blocks = 0;
          this.guardTime = 0;
          w.effects.text(this.x, this.y, 'CONTRA-ATAQUE!', '#ff6a50', true);
          this.startAttack(this.counterAttack(), { counter: true });
        }
        return false;
      }
      this.guardTime = 0;
      this.blocks = 0;
      this.poise = 0;
      this.staggerTime = 1.6;
      this.setState('stagger');
      w.effects.text(this.x, this.y, 'GUARDA QUEBRADA!', '#ffd34d', true);
      w.camera.zoomPunch(0.05);
      Sfx.clang();
      hit = { ...hit, damage: Math.round(hit.damage * 1.3) };
    }

    this.hp -= hit.damage;
    this.flash = 0.1;
    this.kx += hit.nx * hit.knockback * 0.2;
    this.ky += hit.ny * hit.knockback * 0.2;
    this.poise += hit.poise || 10;
    w.effects.sparks(this.x, this.y, ang, hit.finisher ? 16 : 9, hit.finisher ? '#ff6a50' : '#ffe6c8');
    w.effects.ink(this.x, this.y, ang, 5);
    w.effects.text(this.x, this.y, String(hit.damage), hit.finisher ? '#ff6a50' : '#fff3e0', !!hit.finisher);
    const now = w.time;
    this.recentHits = this.recentHits.filter((t) => now - t < 1.2);
    this.recentHits.push(now);

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.setState('dying');
      w.onBossDefeated(this);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.poise = 0;
      this.maxPoise = this.D.poise[1];
      this.chain = [];
      this.guardTime = 0;
      this.roarIsIntro = false;
      this.setState('roar');
      return true;
    }
    if (this.state !== 'stagger' && this.poise >= this.maxPoise) {
      this.poise = 0;
      this.chain = [];
      this.staggerTime = 1.3;
      this.setState('stagger');
      w.camera.zoomPunch(0.04);
      w.effects.text(this.x, this.y, 'QUEBRA DE POSTURA!', '#ffd34d', true);
      return true;
    }
    const idle = this.state === 'chase' || (this.state === 'recover' && !this.chain.length);
    if (idle && this.recentHits.length >= 3) this.defend(true);
    return true;
  }

  /** Reação defensiva: guarda ou esquiva, conforme o guardião. */
  defend(reactive) {
    if (this.D.defense === 'evade') {
      if (this.evadeCd <= 0) this.startEvade();
    } else if (this.guardCd <= 0) {
      this.startGuard();
    } else if (reactive && this.phase === 2 && this.evadeCd <= 0) {
      this.startEvade();
    }
  }

  counterAttack() {
    const names = Object.keys(this.D.attacks);
    return names.find((n) => this.D.attacks[n].kind === 'sweep') || names[0];
  }

  startGuard() {
    this.setState('guard');
    this.guardTime = this.phase === 1 ? 1.2 : 1.7;
    this.guardCd = this.phase === 1 ? 4 : 2.6;
    this.blocks = 0;
    this.recentHits = [];
    const p = this.world.player;
    this.facing = Math.atan2(p.y - this.y, p.x - this.x);
  }

  startEvade() {
    const w = this.world, p = w.player;
    const a = Math.atan2(this.y - p.y, this.x - p.x) + (Math.random() - 0.5) * 0.8;
    this.kx += Math.cos(a) * 15;
    this.ky += Math.sin(a) * 15;
    this.evadeCd = this.phase === 1 ? 3.2 : 2.2;
    this.recentHits = [];
    this.setState('evade');
    w.effects.smoke(this.x, this.y, 8, '120,110,110', 0.4);
    Sfx.dash();
  }

  choosePattern(dist) {
    const list = this.phase === 1 ? this.D.phase1 : this.D.phase2;
    let opts = list.filter((o) => dist >= o[2] && dist <= o[3] && o[0] !== this.lastPattern);
    if (!opts.length) opts = list.filter((o) => dist >= o[2] && dist <= o[3]);
    if (!opts.length) opts = list;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const o of opts) if ((r -= o[1]) <= 0) return o[0];
    return opts[0][0];
  }

  startPattern(seq) {
    this.lastPattern = seq;
    const parts = seq.split(' ');
    this.chain = parts.slice(1);
    this.startAttack(parts[0]);
  }

  startAttack(name, opts = {}) {
    this.attack = name;
    this.chained = !!opts.chained;
    this.counter = !!opts.counter;
    this.hits.clear();
    this.setState('windup');
    const p = this.world.player;
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.facing = ang;
    if (this.A.kind === 'slam') {
      const d = Math.min(Math.hypot(p.x - this.x, p.y - this.y), this.A.reach);
      this.target = { x: this.x + Math.cos(ang) * d, y: this.y + Math.sin(ang) * d };
    }
  }

  update(dt) {
    const w = this.world;
    this.t += dt;
    this.animTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.guardCd -= dt;
    this.evadeCd -= dt;
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    this.vx = this.vy = 0;
    this.alpha = damp(this.alpha, 1, 6, dt);

    if (this.shock) {
      const s = this.shock;
      s.r += 6.5 * dt;
      const pd = Math.hypot(p.x - s.x, p.y - s.y);
      if (!s.hit && Math.abs(pd - s.r) < 0.35) {
        if (p.takeHit({ damage: 10, nx: (p.x - s.x) / (pd || 1), ny: (p.y - s.y) / (pd || 1), knockback: 6 })) s.hit = true;
      }
      if (s.r > 5) this.shock = null;
    }

    switch (this.state) {
      case 'dormant':
        this.facing = ang;
        break;

      case 'roar':
        if (this.t > 0.2 && !this.roared) {
          this.roared = true;
          Sfx.roar();
          w.camera.shake(10);
          w.effects.ring(this.x, this.y, 4, 0.7, '255,120,90');
          if (dist < 3.5 && p.alive) {
            p.kx += (dx / (dist || 1)) * 10;
            p.ky += (dy / (dist || 1)) * 10;
          }
          if (!this.roarIsIntro) w.onBossPhase2(this);
        }
        if (this.t > 1.2) {
          this.roared = false;
          this.cooldown = 0.5;
          this.setState('chase');
        }
        break;

      case 'chase': {
        this.facing = ang;
        this.cooldown -= dt;
        if (!p.alive) break;
        const swing = p.combo.current;
        if (swing && swing !== this.seenSwing && dist < 3) {
          this.seenSwing = swing;
          if (Math.random() < this.D.guardChance[this.phase - 1]) { this.defend(false); if (this.state !== 'chase') break; }
        }
        if (this.cooldown <= 0) {
          this.startPattern(this.choosePattern(dist));
          break;
        }
        if (dist > 1.9) {
          const d = w.level.flowDir(this.x, this.y) || { x: dx / dist, y: dy / dist };
          this.vx = d.x * this.speed;
          this.vy = d.y * this.speed;
        }
        break;
      }

      case 'guard':
        this.facing += clamp(angleDiff(ang, this.facing), -2.4 * dt, 2.4 * dt);
        this.guardTime -= dt;
        if (this.guardTime <= 0) {
          this.cooldown = 0.25;
          if (this.phase === 2 && dist < 2.8) this.startAttack(this.counterAttack(), { counter: true });
          else this.setState('chase');
        }
        break;

      case 'evade': {
        if (this.t > 0.32) {
          const lunge = Object.keys(this.D.attacks).find((n) => this.D.attacks[n].kind === 'lunge');
          if (lunge) this.startAttack(lunge, { chained: true });
          else this.setState('chase');
        }
        break;
      }

      case 'windup': {
        const A = this.A;
        if (this.t < A.windup * this.windMul * 0.6) {
          this.facing = ang;
          if (A.kind === 'slam') {
            const d = Math.min(dist, A.reach);
            this.target = { x: this.x + Math.cos(ang) * d, y: this.y + Math.sin(ang) * d };
          }
        }
        if (this.t >= A.windup * this.windMul) this.beginActive(A);
        break;
      }

      case 'active': {
        const A = this.A;
        const P = [p];
        if (A.kind === 'sweep') {
          hitSector(this.x, this.y, this.facing, A.range, A.arc, P, this.hits, { damage: A.damage, knockback: 7 });
        } else if (A.kind === 'spin') {
          hitSector(this.x, this.y, 0, A.range, 360, P, this.hits, { damage: A.damage, knockback: 9 });
          if (Math.floor(this.t * 8) !== Math.floor((this.t - dt) * 8)) Sfx.swing(3);
        } else if (A.kind === 'slam') {
          hitSector(this.target.x, this.target.y, 0, A.radius, 360, P, this.hits, { damage: A.damage, knockback: 8 });
        } else if (A.kind === 'lunge') {
          this.vx = Math.cos(this.facing) * A.speed;
          this.vy = Math.sin(this.facing) * A.speed;
          hitSector(this.x, this.y, this.facing, A.width + 0.3, 200, P, this.hits, { damage: A.damage, knockback: 10 });
          if (Math.random() < 0.5) w.effects.smoke(this.x, this.y, 1, '160,140,120', 0.3);
        } else if (A.kind === 'vanish') {
          this.alpha = 0.05;
        }
        if (this.t >= A.active) this.setState('recover');
        break;
      }

      case 'recover': {
        const A = this.A;
        const rec = this.chain.length ? 0.16 : A.recover * (this.phase === 1 ? 1 : 0.8);
        if (this.t >= rec) {
          if (this.chain.length) this.startAttack(this.chain.shift(), { chained: true });
          else {
            this.chained = this.counter = false;
            this.cooldown = (this.phase === 1 ? 0.85 : 0.45) + Math.random() * 0.5;
            this.setState('chase');
          }
        }
        break;
      }

      case 'stagger':
        if (this.t > (this.staggerTime || 1.3)) {
          this.cooldown = 0.3;
          this.setState('chase');
        }
        break;

      case 'dying':
        this.deadT += dt;
        break;
    }

    if (this.phase === 2 && this.alive && Math.random() < dt * 14) w.effects.sparks(this.x, this.y, -Math.PI * 0.75 + (Math.random() - 0.5), 1, '#ff5a30', 0.8);
    if (this.state !== 'dying') this.move(dt, this.state === 'evade' ? 5 : 7);
  }

  beginActive(A) {
    const w = this.world, p = w.player;
    this.setState('active');
    if (A.kind === 'lunge') Sfx.dash();
    else Sfx.swing(2);
    if (A.kind === 'slam') {
      w.effects.smoke(this.x, this.y, 6, '170,150,120', 0.45);
      this.x = this.target.x;
      this.y = this.target.y;
      w.level.resolveCircle(this);
      Sfx.slam();
      w.camera.shake(10);
      w.effects.ring(this.target.x, this.target.y, A.radius + 0.5, 0.45);
      w.effects.smoke(this.target.x, this.target.y, 10, '170,150,120', 0.6);
      if (this.phase === 2 && this.D.shock) {
        this.shock = { x: this.target.x, y: this.target.y, r: 0.5, hit: false };
        w.effects.ring(this.target.x, this.target.y, 5, 0.8, '255,150,90');
      }
    } else if (A.kind === 'vanish') {
      // Some e reaparece atrás do jogador.
      w.effects.smoke(this.x, this.y, 12, '60,55,60', 0.5);
      Sfx.smoke();
      const back = Math.atan2(p.y - this.y, p.x - this.x);
      for (const r of [1.4, 1.1, 0.8]) {
        const nx = p.x + Math.cos(back) * r, ny = p.y + Math.sin(back) * r;
        if (w.level.isFree(nx, ny, this.radius)) { this.x = nx; this.y = ny; break; }
      }
      w.effects.smoke(this.x, this.y, 10, '60,55,60', 0.5);
      this.facing = Math.atan2(p.y - this.y, p.x - this.x);
    }
  }

  drawGround(ctx, cam) {
    if (this.shock) {
      Ground.ring(ctx, cam, this.shock.x, this.shock.y, this.shock.r - 0.3, this.shock.r + 0.05);
      ctx.fillStyle = 'rgba(255,120,60,0.55)';
      ctx.fill();
    }
    if (this.state === 'guard') {
      ctx.save();
      Ground.sector(ctx, cam, this.x, this.y, 1.5, this.facing, 160);
      ctx.fillStyle = `rgba(110,170,255,${0.18 + 0.08 * Math.sin(this.t * 10)})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,210,255,0.8)';
      ctx.lineWidth = 2 * cam.scale;
      ctx.stroke();
      ctx.restore();
    }
    if (this.state !== 'windup') return;
    const A = this.A;
    const k = clamp(this.t / (A.windup * this.windMul), 0, 1);
    if (A.kind === 'sweep') Ground.telegraph(ctx, cam, () => Ground.sector(ctx, cam, this.x, this.y, A.range, this.facing, A.arc), k);
    else if (A.kind === 'spin') Ground.telegraph(ctx, cam, () => Ground.circle(ctx, cam, this.x, this.y, A.range), k);
    else if (A.kind === 'lunge') Ground.telegraph(ctx, cam, () => Ground.lane(ctx, cam, this.x, this.y, this.facing, A.speed * A.active, A.width * 2), k);
    else if (A.kind === 'slam') {
      Ground.telegraph(ctx, cam, () => Ground.circle(ctx, cam, this.target.x, this.target.y, A.radius), k);
      Ground.circle(ctx, cam, this.target.x, this.target.y, A.radius * k);
      ctx.strokeStyle = 'rgba(255,220,200,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  currentSprite() {
    const S = this.D.sprites;
    switch (this.state) {
      case 'dormant': return S.intro;
      case 'roar': return S.roar;
      case 'chase': {
        const moving = Math.hypot(this.vx, this.vy) > 0.3;
        const list = moving ? S.walk : S.idle;
        return list[Math.floor(moving ? this.stride * 1.8 : this.animTime * 2) % list.length];
      }
      case 'guard': return S.guard;
      case 'evade': return S.walk[0];
      case 'windup': return this.A.wind;
      case 'active': return this.A.act;
      case 'recover': return this.A.rec;
      case 'stagger': return S.hurt;
      case 'dying': return S.hurt;
    }
    return S.idle[0];
  }

  draw(ctx, cam) {
    if (this.state === 'dying' && this.deadT > 1.4) return;
    this.drawShadow(ctx, cam, 1.3);
    let flip = this.flip;
    if (this.state === 'active' && this.A.kind === 'spin') flip = Math.floor(this.t * 12) % 2 === 0;
    const guard = this.state === 'guard';
    const warn = this.state === 'windup';
    const moving = this.state === 'chase' && Math.hypot(this.vx, this.vy) > 0.3;
    let tint = '#ff3010', amount = this.phase === 2 ? 0.1 + 0.05 * Math.sin(this.animTime * 6) : 0;
    if (this.flash > 0) { tint = '#ffffff'; amount = this.flash * 8; }
    else if (guard) { tint = '#6aa8ff'; amount = 0.22 + 0.1 * Math.sin(this.t * 12); }
    else if (warn) { tint = this.counter ? '#ffd040' : '#ff2a1a'; amount = 0.14 + 0.12 * Math.sin(this.t * 30); }
    else if (this.state === 'stagger') { tint = '#ffffff'; amount = 0.15; }
    const dying = this.state === 'dying';
    this.drawSprite(ctx, cam, this.currentSprite(), this.D.scale * (this.D.walkScale && moving ? this.D.walkScale : 1), {
      cycle: moving ? 'walk' : undefined,
      flip, tint, tintAmount: amount,

      rotate: dying ? (flip ? -1 : 1) * clamp(this.deadT / 0.5, 0, 1) * 1.4 : 0,
      alpha: dying ? 1 - clamp((this.deadT - 0.9) / 0.5, 0, 1) : this.alpha,
    });
  }
}
