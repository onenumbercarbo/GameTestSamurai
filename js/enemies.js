/**
 * enemies.js — Saqueadores ninja, kunais e itens.
 *
 * IA em máquina de estados (spawn → chase → windup → strike → recover, mais
 * hurt/dead e, para o ninja negro, aim → throw). Dois princípios do combate
 * estilo God of War / Hades:
 *  1. TELEGRAFAR: todo ataque tem uma preparação visível (pose de golpe +
 *     marca vermelha no chão) para o jogador reagir com dash.
 *  2. FICHAS DE ATAQUE: só CONFIG.MAX_ATTACKERS inimigos atacam ao mesmo
 *     tempo; os outros circulam ao redor esperando a vez. Grupos grandes
 *     ficam ameaçadores sem ficarem injustos.
 */

const NINJA_TYPES = {
  blue: {
    label: 'Saqueador', hp: 36, speed: 2.7, damage: 9, windup: 0.5, range: 1.25, arc: 110, lunge: 7, recover: 0.55,
    sprites: { idle: 'ninja_idle', walk: ['ninja_walk1', 'ninja_idle', 'ninja_walk2', 'ninja_idle'], windup: 'ninja_raise', strike: 'ninja_lunge', hurt: 'ninja_crouch' },
  },
  gray: {
    label: 'Batedor', hp: 28, speed: 3.7, damage: 8, windup: 0.34, range: 1.2, arc: 100, lunge: 9, recover: 0.4,
    sprites: { idle: 'gray_idle', walk: ['gray_walk1', 'gray_idle', 'gray_walk2', 'gray_idle'], windup: 'gray_raise', strike: 'gray_strike', hurt: 'gray_crouch' },
  },
  black: {
    label: 'Assassino', hp: 52, speed: 2.5, damage: 13, windup: 0.55, range: 1.3, arc: 120, lunge: 7, recover: 0.6, ranged: true,
    sprites: { idle: 'black_idle', walk: ['black_walk1', 'black_idle', 'black_walk2', 'black_idle'], windup: 'black_raise', strike: 'black_lunge', hurt: 'black_crouch' },
  },
};

class Ninja extends Actor {
  constructor(world, type, x, y) {
    super(world, x, y, 0.3);
    this.type = NINJA_TYPES[type];
    this.kind = type;
    this.hp = this.maxHp = this.type.hp;
    this.state = 'spawn';
    this.t = 0;
    this.attackCd = 0.4 + Math.random() * 0.8;
    this.throwCd = 1 + Math.random() * 2;
    this.hasToken = false;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.hits = new Set();
    this.stunTime = 0;
    this.deadT = 0;
    world.effects.smoke(x, y, 10, '60,60,70', 0.55);
    Sfx.smoke();
  }

  setState(s) {
    if ((this.state === 'windup' || this.state === 'strike') && s !== 'strike') this.releaseToken();
    this.state = s;
    this.t = 0;
  }

  releaseToken() {
    if (this.hasToken) {
      this.hasToken = false;
      this.world.attackTokens--;
    }
  }

  takeHit(hit) {
    if (!this.alive || (this.state === 'spawn' && this.t < 0.3)) return false;
    const w = this.world;
    this.hp -= hit.damage;
    this.flash = 0.12;
    this.kx += hit.nx * hit.knockback;
    this.ky += hit.ny * hit.knockback;
    this.stunTime = hit.stun || 0.3;
    this.setState('hurt');
    const ang = Math.atan2(hit.ny, hit.nx);
    w.effects.sparks(this.x, this.y, ang, hit.finisher ? 14 : 8, hit.finisher ? '#ff6a50' : '#ffe6c8');
    w.effects.ink(this.x, this.y, ang, hit.finisher ? 8 : 4);
    w.effects.text(this.x, this.y, String(hit.damage), hit.finisher ? '#ff6a50' : '#fff3e0', !!hit.finisher);
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.deadT = 0;
      this.kx *= 1.6;
      this.ky *= 1.6;
      w.stats.kills++;
      if (Math.random() < 0.22) w.pickups.push(new Pickup(w, this.x, this.y, 'onigiri'));
    }
    return true;
  }

  update(dt) {
    const w = this.world;
    const T = this.type;
    this.t += dt;
    this.animTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.attackCd -= dt;
    this.throwCd -= dt;

    if (this.state === 'dead') {
      this.deadT += dt;
      this.vx = this.vy = 0;
      this.move(dt, 6);
      return;
    }

    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let speed = 0, dir = null;

    switch (this.state) {
      case 'spawn':
        if (this.t > 0.45) this.setState('chase');
        break;

      case 'chase': {
        this.facing = ang;
        if (!p.alive || w.cutscene) break;
        if (T.ranged && dist > 3 && dist < 7.5 && this.throwCd <= 0) { this.setState('aim'); break; }
        if (dist < T.range + 0.35) {
          if (this.attackCd <= 0 && w.attackTokens < CONFIG.MAX_ATTACKERS) {
            this.hasToken = true;
            w.attackTokens++;
            this.setState('windup');
            break;
          }
          // Sem ficha: circula em volta mantendo distância.
          const tx = -dy / (dist || 1) * this.orbitDir, ty = dx / (dist || 1) * this.orbitDir;
          const back = dist < 1.7 ? -0.8 : 0.1;
          dir = { x: tx + (dx / dist) * back, y: ty + (dy / dist) * back };
          speed = T.speed * 0.55;
        } else if (dist > 2.2 && dist < 3.4 && w.attackTokens >= CONFIG.MAX_ATTACKERS) {
          // Fila de espera: aproxima devagar circulando (pressão sem atacar).
          dir = { x: -dy / dist * this.orbitDir + dx / dist * 0.2, y: dx / dist * this.orbitDir + dy / dist * 0.2 };
          speed = T.speed * 0.5;
        } else {
          dir = dist < 2.2 ? { x: dx / dist, y: dy / dist } : (w.level.flowDir(this.x, this.y) || { x: dx / dist, y: dy / dist });
          speed = T.speed;
        }
        if (Math.random() < dt * 0.3) this.orbitDir *= -1;
        break;
      }

      case 'windup':
        // Acompanha o jogador durante a maior parte da preparação, depois trava.
        if (this.t < T.windup * 0.7) this.facing = ang;
        if (this.t >= T.windup) {
          this.setState('strike');
          this.hits.clear();
          this.kx += Math.cos(this.facing) * T.lunge;
          this.ky += Math.sin(this.facing) * T.lunge;
          Sfx.swing(1);
        }
        break;

      case 'strike':
        if (this.t < 0.16) {
          hitSector(this.x, this.y, this.facing, T.range, T.arc, [p], this.hits, { damage: T.damage, knockback: 5, source: this });
        }
        if (this.t > 0.24) {
          this.releaseToken();
          this.setState('recover');
        }
        break;

      case 'recover':
        if (this.t > T.recover) {
          this.attackCd = 0.7 + Math.random() * 1.1;
          this.setState('chase');
        }
        break;

      case 'aim':
        this.facing = ang;
        if (this.t > 0.5) {
          w.projectiles.push(new Kunai(w, this.x, this.y, ang, this));
          Sfx.throwK();
          this.throwCd = 2.4 + Math.random() * 1.6;
          this.setState('throw');
        }
        break;

      case 'throw':
        if (this.t > 0.35) this.setState('chase');
        break;

      case 'hurt':
        if (this.t > this.stunTime) this.setState('chase');
        break;
    }

    this.vx = dir ? dir.x * speed : 0;
    this.vy = dir ? dir.y * speed : 0;
    this.move(dt, 8);
  }

  get dead() {
    return this.state === 'dead' && this.deadT > 1.1;
  }

  /** Telegráfo no chão (desenhado antes dos personagens). */
  drawGround(ctx, cam) {
    if (this.state === 'windup') {
      const k = this.t / this.type.windup;
      Ground.telegraph(ctx, cam, () => Ground.sector(ctx, cam, this.x, this.y, this.type.range + 0.35, this.facing, this.type.arc), k);
    } else if (this.state === 'aim') {
      Ground.telegraph(ctx, cam, () => Ground.lane(ctx, cam, this.x, this.y, this.facing, 6, 0.25), this.t / 0.5);
    }
  }

  draw(ctx, cam) {
    const S = this.type.sprites;
    const sc = CONFIG.SPRITE_SCALE * 0.96;
    let name = S.idle, rotate = 0, alpha = 1;
    switch (this.state) {
      case 'spawn': alpha = clamp((this.t - 0.15) / 0.25, 0, 1); break;
      case 'chase': name = Math.hypot(this.vx, this.vy) > 0.3 ? S.walk[Math.floor(this.animTime * 9) % 4] : S.idle; break;
      case 'windup': case 'aim': name = S.windup; break;
      case 'strike': case 'throw': name = S.strike; break;
      case 'recover': case 'hurt': name = S.hurt; break;
      case 'dead':
        name = S.hurt;
        rotate = (this.flip ? -1 : 1) * clamp(this.deadT / 0.35, 0, 1) * 1.4;
        alpha = 1 - clamp((this.deadT - 0.6) / 0.5, 0, 1);
        break;
    }
    if (alpha <= 0) return;
    this.drawShadow(ctx, cam, 0.9);
    // Preparação de ataque: brilho vermelho pulsante no corpo (telegráfo extra).
    const warn = this.state === 'windup' || this.state === 'aim';
    this.drawSprite(ctx, cam, name, sc, {
      rotate, alpha,
      tint: warn ? '#ff2a1a' : '#ffffff',
      tintAmount: warn ? 0.18 + 0.14 * Math.sin(this.t * 40) : this.flash * 8,
    });
    // Barra de vida discreta.
    if (this.alive && this.hp < this.maxHp) {
      const g = cam.worldToScreen(this.x, this.y);
      const w = 28 * Math.min(cam.scale, 1.5), y = g.y - 82 * cam.scale * 0.6 - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(g.x - w / 2, y, w, 4);
      ctx.fillStyle = '#d9483b';
      ctx.fillRect(g.x - w / 2, y, w * (this.hp / this.maxHp), 4);
    }
  }
}

/** Kunai arremessada pelo ninja negro. Pode ser rebatida com um corte! */
class Kunai {
  constructor(world, x, y, angle, owner) {
    this.world = world;
    this.x = x + Math.cos(angle) * 0.4;
    this.y = y + Math.sin(angle) * 0.4;
    this.angle = angle;
    this.speed = 9;
    this.life = 1.4;
    this.radius = 0.25;
    this.alive = true;
    this.owner = owner;
  }

  get box() {
    return { x0: this.x - 0.1, y0: this.y - 0.1, x1: this.x + 0.1, y1: this.y + 0.1 };
  }

  takeHit() {
    // Rebatida pelo jogador: some com faísca metálica (não conta como acerto).
    this.alive = false;
    this.world.effects.sparks(this.x, this.y, this.angle + Math.PI, 8, '#cfe6ff');
    Sfx.clang();
    return false;
  }

  update(dt) {
    this.life -= dt;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    const w = this.world, p = w.player;
    if (this.life <= 0 || !w.level.isFree(this.x, this.y, 0.05)) {
      this.alive = false;
      w.effects.sparks(this.x, this.y, this.angle + Math.PI, 4, '#bbb');
      return;
    }
    if (p.alive && Math.hypot(p.x - this.x, p.y - this.y) < p.radius + 0.15) {
      if (p.takeHit({ damage: 8, nx: Math.cos(this.angle), ny: Math.sin(this.angle), knockback: 3 })) this.alive = false;
    }
  }

  draw(ctx, cam) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const tip = cam.worldToScreen(this.x + c * 0.25, this.y + s * 0.25, 30);
    const tail = cam.worldToScreen(this.x - c * 0.25, this.y - s * 0.25, 30);
    const sh = cam.worldToScreen(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, 4 * cam.scale, 2 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 3 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo((tail.x + tip.x) / 2, (tail.y + tip.y) / 2);
    ctx.stroke();
    ctx.strokeStyle = '#e4ecf4';
    ctx.lineWidth = 2.2 * cam.scale;
    ctx.beginPath();
    ctx.moveTo((tail.x + tip.x) / 2, (tail.y + tip.y) / 2);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }
}

/** Itens no chão: onigiri (cura) e a relíquia sagrada. */
class Pickup {
  constructor(world, x, y, kind) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.t = 0;
    this.alive = true;
    this.radius = 0.2;
  }

  get box() {
    return { x0: this.x - 0.2, y0: this.y - 0.2, x1: this.x + 0.2, y1: this.y + 0.2 };
  }

  update(dt) {
    this.t += dt;
    const p = this.world.player;
    if (!p.alive || this.t < 0.4) return;
    const reach = this.kind === 'relic' ? 0.9 : 0.65;
    if (Math.hypot(p.x - this.x, p.y - this.y) < reach) {
      this.alive = false;
      if (this.kind === 'onigiri') {
        p.heal(22);
        this.world.effects.text(this.x, this.y, '+22', '#7dff8a');
        Sfx.pickup();
      } else {
        this.world.onRelicTaken();
      }
    }
    if (this.kind === 'onigiri' && this.t > 25) this.alive = false;
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const bob = Math.sin(this.t * 3) * 3;
    const sh = cam.worldToScreen(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, 7 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.kind === 'onigiri') {
      const c = cam.worldToScreen(this.x, this.y, 12 + bob);
      ctx.fillStyle = '#f7f3ea';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 9 * s);
      ctx.quadraticCurveTo(c.x + 10 * s, c.y + 6 * s, c.x, c.y + 6 * s);
      ctx.quadraticCurveTo(c.x - 10 * s, c.y + 6 * s, c.x, c.y - 9 * s);
      ctx.fill();
      ctx.fillStyle = '#1d2a1d';
      ctx.fillRect(c.x - 4 * s, c.y, 8 * s, 6 * s);
    } else {
      // A Relíquia: o Espelho da Lua — disco dourado com brilho pulsante.
      const c = cam.worldToScreen(this.x, this.y, 34 + bob * 2);
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 4);
      const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 46 * s);
      g.addColorStop(0, `rgba(255,240,180,${0.8 * pulse})`);
      g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 46 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9952c';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 13 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eef6ff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,190,230,0.8)';
      ctx.beginPath();
      ctx.arc(c.x + 2.5 * s, c.y - 1 * s, 6.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
