/**
 * boss.js — Gendō, o Ceifador de Kurokama (chefe final).
 *
 * ============================ ATAQUES ============================
 * Todos telegrafados no chão (vermelho = vai acertar ali).
 *
 *  Fase 1
 *   sweep  — ceifada frontal em leque        boss_low -> boss_slash -> boss_retract
 *   spin   — giro de 360° em volta de si     boss_hold -> boss_spin -> boss_stance2
 *   slam   — salto + impacto no chão          boss_raise -> boss_overhead -> boss_slam
 *   lunge  — investida em linha reta          boss_low -> boss_lunge -> boss_stance
 *
 *  Fase 2 (abaixo de 50% de vida) — tudo mais rápido e encadeado:
 *   combo   — ceifada → ceifada → giro, sem pausa
 *   quake   — três saltos seguidos, mirando o jogador a cada um (com onda de choque)
 *   barrage — três investidas seguidas
 *   throw   — arremessa a foice como bumerangue (ida e volta); fica DESARMADO
 *             enquanto ela voa: a melhor janela para atacar
 *
 * ============================ DEFESAS ============================
 *   guard   — ergue a foice e bloqueia golpes vindos da FRENTE (arco azul no
 *             chão). Golpes por trás passam. O golpe final do combo, o iaijutsu
 *             e a investida pós-dash QUEBRAM a guarda (atordoa e leva dano extra).
 *   contra-ataque — após alguns bloqueios, revida com uma ceifada rápida.
 *   evade   — (fase 2) salta para trás quando apanha muito e emenda uma investida.
 *   postura — golpes comuns não o atordoam; só ao acumular dano de postura.
 */
const BOSS_ATTACKS = {
  sweep: { windup: 0.6, active: 0.16, recover: 0.5, range: 2.9, arc: 170, damage: 18 },
  spin: { windup: 0.75, active: 0.5, recover: 0.55, range: 3.0, damage: 22 },
  slam: { windup: 0.85, active: 0.12, recover: 0.75, radius: 1.7, reach: 3.2, damage: 26 },
  lunge: { windup: 0.6, active: 0.42, recover: 0.6, speed: 14, damage: 20, width: 1.2 },
  throw: { windup: 0.55, active: 0.12, recover: 0.4, damage: 16, width: 1.0, reach: 7.5 },
};

/** Foice arremessada: vai até o ponto mirado e volta para a mão do boss. */
class ScytheThrow {
  constructor(world, boss, angle) {
    this.world = world;
    this.boss = boss;
    this.x = boss.x;
    this.y = boss.y;
    this.angle = angle;
    this.out = true;
    this.dist = 0;
    this.spin = 0;
    this.alive = true;
    this.isProjectile = true;
    this.hits = new Set();
    this.box = { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  update(dt) {
    const w = this.world, p = w.player;
    this.spin += dt * 22;
    if (this.out) {
      const v = 13;
      this.x += Math.cos(this.angle) * v * dt;
      this.y += Math.sin(this.angle) * v * dt;
      this.dist += v * dt;
      if (this.dist >= BOSS_ATTACKS.throw.reach || !w.level.isFree(this.x, this.y, 0.1)) {
        this.out = false;
        this.hits.clear(); // pode acertar de novo na volta
      }
    } else {
      const dx = this.boss.x - this.x, dy = this.boss.y - this.y;
      const d = Math.hypot(dx, dy);
      const v = 15;
      if (d < 0.6) {
        this.alive = false;
        this.boss.catchScythe();
        return;
      }
      this.x += (dx / d) * v * dt;
      this.y += (dy / d) * v * dt;
    }
    if (Math.random() < 0.5) w.effects.sparks(this.x, this.y, this.spin, 1, '#cfd8e0', 0.5);
    hitSector(this.x, this.y, 0, 0.75, 360, [p], this.hits, { damage: BOSS_ATTACKS.throw.damage, knockback: 6, source: this });
    this.box = { x0: this.x - 0.3, y0: this.y - 0.3, x1: this.x + 0.3, y1: this.y + 0.3 };
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const c = cam.worldToScreen(this.x, this.y, 30);
    const sh = cam.worldToScreen(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, 16 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(this.spin);
    // rastro circular
    ctx.strokeStyle = 'rgba(230,240,255,0.35)';
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 18 * s, 0, Math.PI * 1.4);
    ctx.stroke();
    // cabo
    ctx.strokeStyle = '#4a2c17';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(-20 * s, 0);
    ctx.lineTo(12 * s, 0);
    ctx.stroke();
    // lâmina curva
    ctx.strokeStyle = '#dfe6ee';
    ctx.lineWidth = 4.5 * s;
    ctx.beginPath();
    ctx.arc(12 * s, 12 * s, 13 * s, -Math.PI / 2, Math.PI * 0.2);
    ctx.stroke();
    ctx.restore();
  }
}

class Boss extends Actor {
  constructor(world, x, y) {
    super(world, x, y, 0.55);
    this.name = 'Gendō, o Ceifador de Kurokama';
    this.maxHp = 780;
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant'; // até a cutscene de apresentação
    this.t = 0;
    this.attack = null;
    this.chain = [];        // próximos ataques de um combo (fase 2)
    this.chained = false;   // ataque atual faz parte de uma sequência (preparação mais curta)
    this.counter = false;   // ataque atual é um contra-ataque (preparação curtíssima)
    this.cooldown = 1.0;
    this.poise = 0;
    this.maxPoise = 90;
    this.hits = new Set();
    this.target = { x: 0, y: 0 };
    this.shock = null;
    this.deadT = 0;
    this.facing = Math.PI * 0.75;
    this.lastAttack = '';
    this.guardTime = 0;
    this.guardCd = 2;
    this.blocks = 0;
    this.recentHits = [];   // instantes dos últimos golpes recebidos
    this.seenSwing = null;  // último golpe do jogador já avaliado para defesa
    this.scytheOut = false;
    this.evadeCd = 3;
  }

  get speed() { return this.phase === 1 ? 2.1 : 2.9; }

  /** Multiplicador da preparação: fase 2 é mais rápida; combos e contra-ataques, mais ainda. */
  get windMul() {
    let m = this.phase === 1 ? 1 : 0.78;
    if (this.chained) m *= 0.65;
    if (this.counter) m = 0.45;
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

  catchScythe() {
    this.scytheOut = false;
    Sfx.clang();
  }

  /** Golpe veio da frente? (direção do atacante dentro de ±80° do olhar do boss) */
  frontal(hit) {
    return Math.abs(angleDiff(Math.atan2(-hit.ny, -hit.nx), this.facing)) < (80 * Math.PI) / 180;
  }

  takeHit(hit) {
    const w = this.world;
    if (!this.alive || this.state === 'dormant' || this.state === 'roar' || this.state === 'evade') {
      if (this.alive && this.state !== 'dormant') w.effects.sparks(this.x, this.y, Math.atan2(hit.ny, hit.nx) + Math.PI, 5, '#cfe6ff');
      return false;
    }
    const ang = Math.atan2(hit.ny, hit.nx);

    // ---- Defesa: guarda ----
    if (this.state === 'guard' && this.frontal(hit)) {
      const breaker = hit.finisher || (hit.poise || 0) >= 18;
      if (!breaker) {
        this.blocks++;
        w.effects.sparks(this.x - hit.nx * 0.4, this.y - hit.ny * 0.4, ang + Math.PI, 10, '#a9d4ff');
        w.effects.text(this.x, this.y, 'BLOQUEIO', '#a9d4ff');
        Sfx.clang();
        w.hitStop = Math.max(w.hitStop, 0.05);
        w.camera.shake(3);
        // empurra o jogador para trás
        const p = w.player;
        p.kx -= hit.nx * 6;
        p.ky -= hit.ny * 6;
        p.combo.cancel();
        // Contra-ataque depois de alguns bloqueios.
        if (this.blocks >= (this.phase === 1 ? 3 : 2)) {
          this.blocks = 0;
          this.guardTime = 0;
          w.effects.text(this.x, this.y, 'CONTRA-ATAQUE!', '#ff6a50', true);
          this.startAttack('sweep', { counter: true });
        }
        return false;
      }
      // Golpe pesado quebra a guarda.
      this.guardTime = 0;
      this.blocks = 0;
      this.poise = 0;
      this.setState('stagger');
      this.staggerTime = 1.8;
      w.effects.text(this.x, this.y, 'GUARDA QUEBRADA!', '#ffd34d', true);
      w.camera.zoomPunch(0.06);
      Sfx.clang();
      hit = { ...hit, damage: Math.round(hit.damage * 1.3) };
    }

    // ---- Dano ----
    this.hp -= hit.damage;
    this.flash = 0.1;
    this.kx += hit.nx * hit.knockback * 0.15; // pesado: quase não recua
    this.ky += hit.ny * hit.knockback * 0.15;
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
      this.maxPoise = 120; // mais difícil de atordoar na fúria
      this.chain = [];
      this.guardTime = 0;
      this.setState('roar');
      this.roarIsIntro = false;
      return true;
    }
    if (this.state !== 'stagger' && this.poise >= this.maxPoise) {
      this.poise = 0;
      this.chain = [];
      this.setState('stagger');
      this.staggerTime = 1.4;
      w.camera.zoomPunch(0.05);
      w.effects.text(this.x, this.y, 'QUEBRA DE POSTURA!', '#ffd34d', true);
      return true;
    }
    // Reação defensiva: apanhando seguido fora de um ataque -> guarda ou esquiva.
    const idle = this.state === 'chase' || (this.state === 'recover' && !this.chain.length);
    if (idle && this.recentHits.length >= 3) {
      if (this.phase === 2 && this.evadeCd <= 0 && Math.random() < 0.55) this.startEvade();
      else if (this.guardCd <= 0) this.startGuard();
    }
    return true;
  }

  startGuard() {
    this.setState('guard');
    this.guardTime = this.phase === 1 ? 1.3 : 1.8;
    this.guardCd = this.phase === 1 ? 4 : 2.6;
    this.blocks = 0;
    this.recentHits = [];
    const p = this.world.player;
    this.facing = Math.atan2(p.y - this.y, p.x - this.x);
  }

  startEvade() {
    const w = this.world, p = w.player;
    const a = Math.atan2(this.y - p.y, this.x - p.x);
    this.kx += Math.cos(a) * 16;
    this.ky += Math.sin(a) * 16;
    this.evadeCd = 4;
    this.recentHits = [];
    this.setState('evade');
    w.effects.smoke(this.x, this.y, 8, '160,140,120', 0.45);
    Sfx.dash();
  }

  chooseAttack(dist) {
    const opts = [];
    if (this.phase === 1) {
      if (dist < 3) {
        opts.push(['sweep', 3], ['spin', 1.5]);
        if (dist > 1.5) opts.push(['slam', 1]);
      } else if (dist < 6) opts.push(['slam', 3], ['lunge', 1.5]);
      else opts.push(['lunge', 4], ['slam', 1]);
    } else {
      if (dist < 3) opts.push(['combo', 3], ['spin', 2], ['quake', 1]);
      else if (dist < 6) opts.push(['quake', 2.5], ['throw', 2], ['lunge', 1]);
      else opts.push(['barrage', 3], ['throw', 2]);
    }
    const pool = opts.filter((o) => o[0] !== this.lastAttack);
    const list = pool.length ? pool : opts;
    let r = Math.random() * list.reduce((s, o) => s + o[1], 0);
    for (const [name, wgt] of list) if ((r -= wgt) <= 0) return name;
    return list[0][0];
  }

  /** Sequências da fase 2 viram uma fila de ataques simples. */
  startPattern(name) {
    this.lastAttack = name;
    if (name === 'combo') { this.chain = ['sweep', 'spin']; this.startAttack('sweep'); }
    else if (name === 'quake') { this.chain = ['slam', 'slam']; this.startAttack('slam'); }
    else if (name === 'barrage') { this.chain = ['lunge', 'lunge']; this.startAttack('lunge'); }
    else this.startAttack(name);
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
    if (name === 'slam') {
      const d = Math.min(Math.hypot(p.x - this.x, p.y - this.y), BOSS_ATTACKS.slam.reach);
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

    // Onda de choque (fase 2): anel que cresce a partir do ponto do slam.
    if (this.shock) {
      const s = this.shock;
      s.r += 6.5 * dt;
      const pd = Math.hypot(p.x - s.x, p.y - s.y);
      if (!s.hit && Math.abs(pd - s.r) < 0.35) {
        if (p.takeHit({ damage: 12, nx: (p.x - s.x) / (pd || 1), ny: (p.y - s.y) / (pd || 1), knockback: 6 })) s.hit = true;
      }
      if (s.r > 6) this.shock = null;
    }

    switch (this.state) {
      case 'dormant':
        this.facing = ang;
        break;

      case 'roar':
        if (this.t > 0.25 && !this.roared) {
          this.roared = true;
          Sfx.roar();
          w.camera.shake(12);
          w.effects.ring(this.x, this.y, 5, 0.8, '255,120,90');
          if (dist < 4 && p.alive) {
            p.kx += (dx / (dist || 1)) * 12;
            p.ky += (dy / (dist || 1)) * 12;
          }
          if (!this.roarIsIntro) w.onBossPhase2(this);
        }
        if (this.t > 1.5) {
          this.roared = false;
          this.cooldown = 0.6;
          this.setState('chase');
        }
        break;

      case 'chase': {
        this.facing = ang;
        this.cooldown -= dt;
        if (!p.alive) break;
        // Defesa antecipada: vê o jogador começando um golpe perto dele.
        const swing = p.combo.current;
        if (swing && swing !== this.seenSwing && dist < 3.2) {
          this.seenSwing = swing;
          const chance = this.phase === 1 ? 0.3 : 0.55;
          if (this.guardCd <= 0 && Math.random() < chance) { this.startGuard(); break; }
        }
        if (this.cooldown <= 0) {
          this.startPattern(this.chooseAttack(dist));
          break;
        }
        if (dist > 2.2) {
          const d = w.level.flowDir(this.x, this.y) || { x: dx / dist, y: dy / dist };
          this.vx = d.x * this.speed;
          this.vy = d.y * this.speed;
        }
        break;
      }

      case 'guard':
        // Gira devagar acompanhando o jogador: rodeá-lo para atacar pelas costas funciona.
        this.facing += clamp(angleDiff(ang, this.facing), -2.2 * dt, 2.2 * dt);
        this.guardTime -= dt;
        if (this.guardTime <= 0) {
          this.cooldown = 0.25;
          // Na fase 2, sai da guarda já revidando se o jogador estiver perto.
          if (this.phase === 2 && dist < 3) this.startAttack('sweep', { counter: true });
          else this.setState('chase');
        }
        break;

      case 'evade':
        if (this.t > 0.35) this.startAttack('lunge', { chained: true });
        break;

      case 'windup': {
        const A = BOSS_ATTACKS[this.attack];
        if (this.t < A.windup * this.windMul * 0.6) {
          this.facing = ang;
          if (this.attack === 'slam') {
            const d = Math.min(dist, A.reach);
            this.target = { x: this.x + Math.cos(ang) * d, y: this.y + Math.sin(ang) * d };
          }
        }
        if (this.t >= A.windup * this.windMul) {
          this.setState('active');
          if (this.attack === 'lunge') Sfx.dash();
          else Sfx.swing(2);
          if (this.attack === 'slam') this.doSlam(A);
          if (this.attack === 'throw') {
            this.scytheOut = true;
            w.projectiles.push(new ScytheThrow(w, this, this.facing));
          }
        }
        break;
      }

      case 'active': {
        const A = BOSS_ATTACKS[this.attack];
        const P = [p];
        if (this.attack === 'sweep') {
          hitSector(this.x, this.y, this.facing, A.range, A.arc, P, this.hits, { damage: A.damage, knockback: 8 });
        } else if (this.attack === 'spin') {
          hitSector(this.x, this.y, 0, A.range, 360, P, this.hits, { damage: A.damage, knockback: 10 });
          if (Math.floor(this.t * 8) !== Math.floor((this.t - dt) * 8)) Sfx.swing(3);
        } else if (this.attack === 'slam') {
          hitSector(this.target.x, this.target.y, 0, A.radius, 360, P, this.hits, { damage: A.damage, knockback: 9 });
        } else if (this.attack === 'lunge') {
          this.vx = Math.cos(this.facing) * A.speed;
          this.vy = Math.sin(this.facing) * A.speed;
          hitSector(this.x, this.y, this.facing, A.width + 0.3, 200, P, this.hits, { damage: A.damage, knockback: 11 });
          if (Math.random() < 0.6) w.effects.smoke(this.x, this.y, 1, '160,140,120', 0.35);
        }
        if (this.t >= A.active) this.setState('recover');
        break;
      }

      case 'recover': {
        const A = BOSS_ATTACKS[this.attack];
        // Enquanto a foice voa, ele espera desarmado.
        if (this.attack === 'throw' && this.scytheOut) break;
        const rec = this.chain.length ? 0.18 : A.recover * (this.phase === 1 ? 1 : 0.8);
        if (this.t >= rec) {
          if (this.chain.length) {
            this.startAttack(this.chain.shift(), { chained: true });
          } else {
            this.chained = this.counter = false;
            this.cooldown = (this.phase === 1 ? 0.9 : 0.45) + Math.random() * 0.5;
            this.setState('chase');
          }
        }
        break;
      }

      case 'stagger':
        if (this.t > (this.staggerTime || 1.4)) {
          this.cooldown = 0.3;
          this.setState('chase');
        }
        break;

      case 'dying':
        this.deadT += dt;
        break;
    }

    // Aura de fúria na fase 2.
    if (this.phase === 2 && this.alive && Math.random() < dt * 18) w.effects.sparks(this.x, this.y, -Math.PI * 0.75 + (Math.random() - 0.5), 1, '#ff5a30', 0.8);
    if (this.state !== 'dying') this.move(dt, this.state === 'evade' ? 5 : 7);
  }

  doSlam(A) {
    const w = this.world;
    this.x = this.target.x;
    this.y = this.target.y;
    w.level.resolveCircle(this);
    Sfx.slam();
    w.camera.shake(14);
    w.camera.zoomPunch(0.05);
    w.effects.ring(this.target.x, this.target.y, A.radius + 0.6, 0.5);
    w.effects.smoke(this.target.x, this.target.y, 14, '170,150,120', 0.7);
    if (this.phase === 2) {
      this.shock = { x: this.target.x, y: this.target.y, r: 0.5, hit: false };
      w.effects.ring(this.target.x, this.target.y, 6, 0.95, '255,150,90');
    }
  }

  /** Telegráfos no chão — a parte mais importante para uma luta justa. */
  drawGround(ctx, cam) {
    if (this.shock) {
      Ground.ring(ctx, cam, this.shock.x, this.shock.y, this.shock.r - 0.3, this.shock.r + 0.05);
      ctx.fillStyle = 'rgba(255,120,60,0.55)';
      ctx.fill();
    }
    if (this.state === 'guard') {
      // Arco azul: o lado protegido pela guarda.
      ctx.save();
      Ground.sector(ctx, cam, this.x, this.y, 1.6, this.facing, 160);
      ctx.fillStyle = `rgba(110,170,255,${0.18 + 0.08 * Math.sin(this.t * 10)})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,210,255,0.8)';
      ctx.lineWidth = 2 * cam.scale;
      ctx.stroke();
      ctx.restore();
    }
    if (this.state !== 'windup') return;
    const A = BOSS_ATTACKS[this.attack];
    const k = clamp(this.t / (A.windup * this.windMul), 0, 1);
    if (this.attack === 'sweep') {
      Ground.telegraph(ctx, cam, () => Ground.sector(ctx, cam, this.x, this.y, A.range, this.facing, A.arc), k);
    } else if (this.attack === 'spin') {
      Ground.telegraph(ctx, cam, () => Ground.circle(ctx, cam, this.x, this.y, A.range), k);
    } else if (this.attack === 'slam') {
      Ground.telegraph(ctx, cam, () => Ground.circle(ctx, cam, this.target.x, this.target.y, A.radius), k);
      Ground.circle(ctx, cam, this.target.x, this.target.y, A.radius * k);
      ctx.strokeStyle = 'rgba(255,220,200,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.attack === 'lunge') {
      Ground.telegraph(ctx, cam, () => Ground.lane(ctx, cam, this.x, this.y, this.facing, A.speed * A.active, A.width * 2), k);
    } else if (this.attack === 'throw') {
      Ground.telegraph(ctx, cam, () => Ground.lane(ctx, cam, this.x, this.y, this.facing, A.reach, A.width * 1.5), k);
    }
  }

  currentSprite() {
    const t = this.t;
    switch (this.state) {
      case 'dormant': return ['boss_idle0', 'boss_idle1', 'boss_idle2'][Math.floor(this.animTime * 3) % 3];
      case 'roar': return Math.floor(t * 8) % 2 ? 'boss_roar0' : 'boss_roar1';
      case 'chase':
        if (Math.hypot(this.vx, this.vy) > 0.3) return ['boss_walk0', 'boss_walk1', 'boss_walk2', 'boss_walk1'][Math.floor(this.animTime * 6) % 4];
        return ['boss_idle0', 'boss_idle1', 'boss_idle2'][Math.floor(this.animTime * 3) % 3];
      case 'guard': return 'boss_hold';
      case 'evade': return 'boss_lunge';
      case 'windup':
        if (this.attack === 'sweep' || this.attack === 'lunge') return 'boss_low';
        if (this.attack === 'spin') return 'boss_hold';
        if (this.attack === 'throw') return 'boss_shoulder';
        return t < BOSS_ATTACKS.slam.windup * this.windMul * 0.5 ? 'boss_raise' : 'boss_overhead';
      case 'active':
        if (this.attack === 'sweep') return 'boss_slash';
        if (this.attack === 'spin') return 'boss_spin';
        if (this.attack === 'slam') return 'boss_slam';
        if (this.attack === 'throw') return 'boss_slash';
        return 'boss_lunge';
      case 'recover':
        if (this.attack === 'throw') return this.scytheOut ? 'boss_stance2' : 'boss_stance';
        if (this.attack === 'sweep') return 'boss_retract';
        if (this.attack === 'spin') return 'boss_stance2';
        if (this.attack === 'slam') return t < 0.3 ? 'boss_slam' : 'boss_stance';
        return 'boss_stance';
      case 'stagger': return Math.floor(t * 3) % 2 ? 'boss_hurt0' : 'boss_hurt1';
      case 'dying': return t < 0.8 ? 'boss_hurt1' : 'boss_down';
    }
    return 'boss_idle0';
  }

  draw(ctx, cam) {
    this.drawShadow(ctx, cam, 1.6);
    let flip = this.flip;
    if (this.state === 'active' && this.attack === 'spin') flip = Math.floor(this.t * 12) % 2 === 0;
    const enraged = this.phase === 2 && this.alive;
    const warn = this.state === 'windup';
    const guard = this.state === 'guard';
    let tint = '#ff3010', amount = enraged ? 0.1 + 0.06 * Math.sin(this.animTime * 6) : 0;
    if (this.flash > 0) { tint = '#ffffff'; amount = this.flash * 8; }
    else if (guard) { tint = '#6aa8ff'; amount = 0.22 + 0.1 * Math.sin(this.t * 12); }
    else if (warn) { tint = this.counter ? '#ffd040' : '#ff2a1a'; amount = 0.14 + 0.12 * Math.sin(this.t * 30); }
    this.drawSprite(ctx, cam, this.currentSprite(), CONFIG.BOSS_SCALE, { flip, tint, tintAmount: amount });
  }
}
