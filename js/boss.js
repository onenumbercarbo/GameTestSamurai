/**
 * boss.js — Gendō, o Ceifador de Kurokama (chefe final).
 *
 * Padrões de ataque, todos telegrafados no chão:
 *   sweep  — ceifada frontal em leque (perto)           boss_low -> boss_slash -> boss_retract
 *   spin   — giro de 360° em volta de si (perto)        boss_hold -> boss_spin -> boss_stance2
 *   slam   — salto + golpe no chão onde o jogador está  boss_raise -> boss_overhead -> boss_slam
 *            (fase 2: libera onda de choque — atravesse com dash!)
 *   lunge  — investida em linha reta (longe)            boss_low -> boss_lunge -> boss_stance
 *   roar   — ao cair para 50% de vida: entra na fase 2, empurra e invoca ninjas
 *
 * Postura (poise): o boss ignora o "stun" dos golpes comuns; só cambaleia
 * quando acumula dano de postura suficiente — recompensa combos completos.
 */
const BOSS_ATTACKS = {
  sweep: { windup: 0.6, active: 0.16, recover: 0.5, range: 2.9, arc: 170, damage: 18 },
  spin: { windup: 0.75, active: 0.5, recover: 0.55, range: 3.0, damage: 22 },
  slam: { windup: 0.85, active: 0.12, recover: 0.75, radius: 1.7, reach: 3.2, damage: 26 },
  lunge: { windup: 0.6, active: 0.42, recover: 0.6, speed: 14, damage: 20, width: 1.2 },
};

class Boss extends Actor {
  constructor(world, x, y) {
    super(world, x, y, 0.55);
    this.name = 'Gendō, o Ceifador de Kurokama';
    this.maxHp = 540;
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant'; // até a cutscene de apresentação
    this.t = 0;
    this.attack = null;
    this.cooldown = 1.0;
    this.poise = 0;
    this.maxPoise = 70;
    this.hits = new Set();
    this.target = { x: 0, y: 0 };
    this.shock = null;
    this.deadT = 0;
    this.facing = Math.PI * 0.75;
    this.lastAttack = '';
  }

  get speed() { return this.phase === 1 ? 2.1 : 2.8; }
  get windMul() { return this.phase === 1 ? 1 : 0.8; }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  awaken() {
    this.setState('roar');
    this.roarIsIntro = true;
  }

  takeHit(hit) {
    if (!this.alive || this.state === 'dormant' || this.state === 'roar') {
      if (this.alive && this.state === 'roar') this.world.effects.sparks(this.x, this.y, Math.atan2(hit.ny, hit.nx) + Math.PI, 5, '#cfe6ff');
      return false;
    }
    const w = this.world;
    this.hp -= hit.damage;
    this.flash = 0.1;
    this.kx += hit.nx * hit.knockback * 0.15; // pesado: quase não recua
    this.ky += hit.ny * hit.knockback * 0.15;
    this.poise += hit.poise || 10;
    const ang = Math.atan2(hit.ny, hit.nx);
    w.effects.sparks(this.x, this.y, ang, hit.finisher ? 16 : 9, hit.finisher ? '#ff6a50' : '#ffe6c8');
    w.effects.ink(this.x, this.y, ang, 5);
    w.effects.text(this.x, this.y, String(hit.damage), hit.finisher ? '#ff6a50' : '#fff3e0', !!hit.finisher);

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
      this.setState('roar');
      this.roarIsIntro = false;
      return true;
    }
    if (this.poise >= this.maxPoise) {
      this.poise = 0;
      this.setState('stagger');
      w.camera.zoomPunch(0.05);
      w.effects.text(this.x, this.y, 'QUEBRA DE POSTURA!', '#ffd34d', true);
    }
    return true;
  }

  chooseAttack(dist) {
    const opts = [];
    if (dist < 3) {
      opts.push(['sweep', 3], ['spin', this.phase === 2 ? 3 : 1.5]);
      if (dist > 1.5) opts.push(['slam', 1]);
    } else if (dist < 6) {
      opts.push(['slam', 3], ['lunge', 1.5]);
    } else {
      opts.push(['lunge', 4], ['slam', 1]);
    }
    // Evita repetir o mesmo ataque duas vezes seguidas.
    const pool = opts.filter((o) => o[0] !== this.lastAttack);
    const list = pool.length ? pool : opts;
    let r = Math.random() * list.reduce((s, o) => s + o[1], 0);
    for (const [name, wgt] of list) {
      if ((r -= wgt) <= 0) return name;
    }
    return list[0][0];
  }

  startAttack(name) {
    this.attack = name;
    this.lastAttack = name;
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
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    this.vx = this.vy = 0;

    // Onda de choque da fase 2 (anel que cresce a partir do ponto do slam).
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
          // Empurra o jogador para longe.
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

      case 'chase':
        this.facing = ang;
        this.cooldown -= dt;
        if (!p.alive) break;
        if (this.cooldown <= 0) {
          this.startAttack(this.chooseAttack(dist));
          break;
        }
        if (dist > 2.2) {
          const d = w.level.flowDir(this.x, this.y) || { x: dx / dist, y: dy / dist };
          this.vx = d.x * this.speed;
          this.vy = d.y * this.speed;
        }
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
          if (this.attack === 'slam') {
            // Salta até o ponto marcado.
            this.x = damp(this.x, this.target.x, 60, 1);
            this.y = damp(this.y, this.target.y, 60, 1);
            w.level.resolveCircle(this);
            Sfx.slam();
            w.camera.shake(14);
            w.camera.zoomPunch(0.05);
            w.effects.ring(this.target.x, this.target.y, A.radius + 0.6, 0.5);
            w.effects.smoke(this.target.x, this.target.y, 14, '170,150,120', 0.7);
            if (this.phase === 2) this.shock = { x: this.target.x, y: this.target.y, r: 0.5, hit: false };
            w.effects.ring(this.target.x, this.target.y, 6, 0.95, '255,150,90');
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
        if (this.t >= A.recover * this.windMul) {
          this.cooldown = (this.phase === 1 ? 0.9 : 0.5) + Math.random() * 0.6;
          this.setState('chase');
        }
        break;
      }

      case 'stagger':
        if (this.t > 1.4) {
          this.cooldown = 0.3;
          this.setState('chase');
        }
        break;

      case 'dying':
        this.deadT += dt;
        break;
    }

    if (this.state !== 'dying') this.move(dt, 7);
  }

  /** Telegráfos no chão — a parte mais importante para uma luta justa. */
  drawGround(ctx, cam) {
    if (this.shock) {
      Ground.ring(ctx, cam, this.shock.x, this.shock.y, this.shock.r - 0.3, this.shock.r + 0.05);
      ctx.fillStyle = 'rgba(255,120,60,0.55)';
      ctx.fill();
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
      // Círculo interno que cresce até a borda: "quando encher, acerta".
      Ground.circle(ctx, cam, this.target.x, this.target.y, A.radius * k);
      ctx.strokeStyle = 'rgba(255,220,200,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.attack === 'lunge') {
      Ground.telegraph(ctx, cam, () => Ground.lane(ctx, cam, this.x, this.y, this.facing, A.speed * A.active, A.width * 2), k);
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
      case 'windup':
        if (this.attack === 'sweep' || this.attack === 'lunge') return 'boss_low';
        if (this.attack === 'spin') return 'boss_hold';
        return t < BOSS_ATTACKS.slam.windup * this.windMul * 0.5 ? 'boss_raise' : 'boss_overhead';
      case 'active':
        if (this.attack === 'sweep') return 'boss_slash';
        if (this.attack === 'spin') return 'boss_spin';
        if (this.attack === 'slam') return 'boss_slam';
        return 'boss_lunge';
      case 'recover':
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
    // Durante o giro, espelha rapidamente para dar sensação de rotação.
    if (this.state === 'active' && this.attack === 'spin') flip = Math.floor(this.t * 12) % 2 === 0;
    const enraged = this.phase === 2 && this.alive;
    const warn = this.state === 'windup';
    this.drawSprite(ctx, cam, this.currentSprite(), CONFIG.BOSS_SCALE, {
      flip,
      tint: this.flash > 0 ? '#ffffff' : warn ? '#ff2a1a' : '#ff3010',
      tintAmount: this.flash > 0 ? this.flash * 8 : warn ? 0.14 + 0.12 * Math.sin(this.t * 30) : enraged ? 0.1 + 0.06 * Math.sin(this.animTime * 6) : 0,
    });
  }
}
