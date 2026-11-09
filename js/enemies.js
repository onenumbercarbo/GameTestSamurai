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
  // Bandido do acampamento: briga de mãos nuas (sprites da folha do acampamento).
  brute: {
    label: 'Bandido', hp: 42, speed: 3.0, damage: 9, windup: 0.45, range: 1.1, arc: 110, lunge: 6, recover: 0.55,
    sprites: { idle: 'bandit_dance2', walk: ['bandit_w0', 'bandit_w1', 'bandit_w2', 'bandit_w3', 'bandit_w4'], windup: 'bandit_dance2', strike: 'bandit_dance', hurt: 'bandit_ground' },
  },
  // Soldado do exército Meiji desertor: atira de longe, baioneta de perto.
  rifle: {
    label: 'Soldado', hp: 38, speed: 2.3, damage: 11, windup: 0.5, range: 1.4, arc: 90, lunge: 6, recover: 0.6, ranged: true,
    shot: { speed: 17, damage: 11, aim: 0.75, style: 'bullet', min: 3, max: 9.5, cd: 2.2 },
    sprites: { idle: 'soldier_hold', walk: ['soldier_w0', 'soldier_w1', 'soldier_w2', 'soldier_w3'], windup: 'soldier_bayonet', strike: 'soldier_bayonet', hurt: 'soldier_hold', aim: 'soldier_aim', throw: 'soldier_fire' },
  },
  black: {
    label: 'Assassino', hp: 52, speed: 2.5, damage: 13, windup: 0.55, range: 1.3, arc: 120, lunge: 7, recover: 0.6, ranged: true,
    sprites: { idle: 'black_idle', walk: ['black_walk1', 'black_idle', 'black_walk2', 'black_idle'], windup: 'black_raise', strike: 'black_lunge', hurt: 'black_crouch' },
  },
};

class Ninja extends Actor {
  /**
   * opts.encounter: se presente, o ninja já começa no mapa, ACAMPADO (parado
   * ao redor da fogueira ou escondido atrás de uma casa) até o grupo ser
   * alertado. Sem encounter, surge numa nuvem de fumaça (reforços do boss).
   */
  constructor(world, type, x, y, opts = {}) {
    super(world, x, y, 0.3);
    this.type = NINJA_TYPES[type];
    this.kind = type;
    this.hp = this.maxHp = this.type.hp;
    this.encounter = opts.encounter || null;
    this.pose = opts.pose || 'idle'; // 'sit' perto da fogueira, 'idle' de vigia
    this.campSprite = opts.campSprite || null; // pose de acampamento (bebendo, dormindo...)
    if (opts.face !== undefined) this.facing = opts.face;
    this.alertT = 0;
    this.state = this.encounter ? 'camp' : 'spawn';
    this.t = 0;
    this.attackCd = 0.4 + Math.random() * 0.8;
    this.throwCd = 1 + Math.random() * 2;
    this.hasToken = false;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.hits = new Set();
    this.stunTime = 0;
    this.deadT = 0;
    if (!this.encounter) {
      world.effects.smoke(x, y, 10, '60,60,70', 0.55);
      Sfx.smoke();
    }
  }

  /** O grupo foi descoberto: mostra "!" e parte para cima após um pequeno atraso. */
  alert(delay) {
    if (this.state !== 'camp') return;
    this.state = 'alerting';
    this.t = -delay;
    this.alertT = 1.2;
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
    // Atacar um bandido acampado acorda o grupo inteiro.
    if (this.encounter && this.encounter.state === 'idle') w.triggerEncounter(this.encounter);
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
    this.alertT = Math.max(0, this.alertT - dt);
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

      case 'camp':
        break; // acampado: parado até o grupo ser alertado

      case 'alerting':
        this.facing = ang;
        if (this.t > 0.25) this.setState('chase');
        break;

      case 'chase': {
        this.facing = ang;
        if (!p.alive || w.cutscene) break;
        if (T.ranged && dist > (T.shot ? T.shot.min : 3) && dist < (T.shot ? T.shot.max : 7.5) && this.throwCd <= 0) { this.setState('aim'); break; }
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

      case 'aim': {
        const shot = T.shot;
        const aimT = shot ? shot.aim : 0.5;
        if (this.t < aimT * 0.75) this.facing = ang; // trava a mira um pouco antes do disparo
        if (this.t > aimT) {
          w.projectiles.push(new Kunai(w, this.x, this.y, this.facing, this, shot));
          if (shot) { Sfx.shot(); w.camera.shake(2); } else Sfx.throwK();
          this.throwCd = (shot ? shot.cd : 2.4) + Math.random() * 1.6;
          this.setState('throw');
        }
        break;
      }

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
      const shot = this.type.shot;
      Ground.telegraph(ctx, cam, () => Ground.lane(ctx, cam, this.x, this.y, this.facing, shot ? 10 : 6, 0.25), this.t / (shot ? shot.aim : 0.5));
    }
  }

  draw(ctx, cam) {
    const S = this.type.sprites;
    const sc = CONFIG.SPRITE_SCALE * 0.96;
    let name = S.idle, rotate = 0, alpha = 1, dp = null;
    switch (this.state) {
      case 'spawn': alpha = clamp((this.t - 0.15) / 0.25, 0, 1); break;
      case 'camp': name = this.campSprite || (this.pose === 'sit' ? S.hurt : S.idle); break;
      case 'alerting': name = S.windup; break;
      case 'chase': name = Math.hypot(this.vx, this.vy) > 0.3 ? S.walk[Math.floor(this.stride * 2.4) % S.walk.length] : S.idle; break;
      case 'windup': name = S.windup; break;
      case 'aim': name = S.aim || S.windup; break;
      case 'strike': name = S.strike; break;
      case 'throw': name = S.throw || S.strike; break;
      case 'recover': case 'hurt': name = S.hurt; break;
      case 'dead': {
        name = S.hurt;
        dp = this.deathPose(this.deadT * 1.25, 1.4); // um pouco mais rápido que o mini-chefe
        rotate = dp.rotate;
        alpha = dp.alpha;
        break;
      }
    }
    if (alpha <= 0) return;
    this.drawShadow(ctx, cam, 0.9);
    // Preparação de ataque: brilho vermelho pulsante no corpo (telegráfo extra).
    const warn = this.state === 'windup' || this.state === 'aim';
    this.drawSprite(ctx, cam, name, sc, {
      rotate, alpha, sy: dp ? dp.sy : 1,
      cycle: this.state === 'chase' && S.walk.includes(name) ? 'walk' : undefined, // quadros de caminhada trocam secos
      tint: warn ? '#ff2a1a' : dp && this.flash <= 0 ? dp.tint : '#ffffff',
      tintAmount: warn ? 0.18 + 0.14 * Math.sin(this.t * 40) : dp && this.flash <= 0 ? dp.tintAmount : this.flash * 8,
    });
    // "!" de alerta (estilo jogos de furtividade).
    if (this.alertT > 0 && this.alive) {
      const g = cam.worldToScreen(this.x, this.y, 95 + (1.2 - this.alertT) * 10);
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alertT * 2);
      ctx.font = `900 ${Math.round(26 * Math.min(cam.scale, 1.5))}px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1a0a08';
      ctx.strokeText('!', g.x, g.y);
      ctx.fillStyle = '#ff4a3a';
      ctx.fillText('!', g.x, g.y);
      ctx.restore();
    }
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
  constructor(world, x, y, angle, owner, opts = null) {
    this.world = world;
    this.x = x + Math.cos(angle) * 0.4;
    this.y = y + Math.sin(angle) * 0.4;
    this.angle = angle;
    this.speed = opts ? opts.speed : 9;
    this.damage = opts ? opts.damage : 8;
    this.style = opts ? opts.style : 'kunai';
    this.life = opts ? 0.75 : 1.4;
    this.radius = 0.25;
    this.alive = true;
    this.owner = owner;
    this.isProjectile = true;
    this.hostile = true; // pode ser rebatida pelo jogador
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
      if (p.takeHit({ damage: this.damage, nx: Math.cos(this.angle), ny: Math.sin(this.angle), knockback: 3 })) this.alive = false;
    }
  }

  draw(ctx, cam) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    if (this.style === 'bullet') {
      // bala: risco brilhante
      const a = cam.worldToScreen(this.x, this.y, 34), b = cam.worldToScreen(this.x - c * 0.9, this.y - s * 0.9, 34);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,220,120,0.9)';
      ctx.lineWidth = 2.5 * cam.scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      return;
    }
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

/**
 * Itens no chão:
 *  onigiri — cura        seal — selo ofuda que abre o portão da vila
 *  item    — arma/relíquia (ver ITEMS)      relic — o Espelho da Lua
 */
class Pickup {
  constructor(world, x, y, kind, id) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.id = id;
    this.fromChest = false; // sai de um baú: sobe e é coletado sozinho
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
    if (this.fromChest) {
      if (this.t > 1.1) {
        this.alive = false;
        this.world.onLoot(this);
      }
      return;
    }
    if (!p.alive || this.t < 0.4) return;
    const reach = this.kind === 'onigiri' ? 0.65 : 0.9;
    if (Math.hypot(p.x - this.x, p.y - this.y) < reach) {
      this.alive = false;
      if (this.kind === 'onigiri') {
        p.heal(22);
        this.world.effects.text(this.x, this.y, '+22', '#7dff8a');
        Sfx.pickup();
      } else if (this.kind === 'relic') {
        this.world.onRelicTaken();
      } else {
        this.world.onLoot(this);
      }
    }
    if (this.kind === 'onigiri' && this.t > 25) this.alive = false;
  }

  draw(ctx, cam) {
    const s = cam.scale;
    let bob = Math.sin(this.t * 3) * 3;
    const sh = cam.worldToScreen(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, 7 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.kind === 'seal' || this.kind === 'item') {
      this.drawTreasure(ctx, cam, bob);
      return;
    }
    if (this.kind === 'onigiri') {
      if (this.fromChest) bob = 20 + easeOutCubic(Math.min(1, this.t / 0.6)) * 40;
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

  /** Pedestal de pedra + objeto flutuando com brilho (selo ou arma). */
  drawTreasure(ctx, cam, bob) {
    const s = cam.scale;
    const base = cam.worldToScreen(this.x, this.y);
    if (this.fromChest) {
      // Sobe de dentro do baú girando, com brilho.
      const k = Math.min(1, this.t / 0.6);
      bob = 20 + easeOutCubic(k) * 40;
    } else {
    // pedestal
    ctx.fillStyle = '#6d6a63';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 14 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a867d';
    ctx.fillRect(base.x - 10 * s, base.y - 12 * s, 20 * s, 12 * s);
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - 12 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    }
    // brilho
    const c = cam.worldToScreen(this.x, this.y, 38 + bob * 1.5);
    const gold = this.kind === 'seal' ? '255,235,200' : '255,205,110';
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 4);
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 40 * s);
    g.addColorStop(0, `rgba(${gold},${0.75 * pulse})`);
    g.addColorStop(1, `rgba(${gold},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 40 * s, 0, Math.PI * 2);
    ctx.fill();
    // coluna de luz até o céu (visível de longe: incentiva a exploração)
    const sky = cam.worldToScreen(this.x, this.y, 260);
    const lg = ctx.createLinearGradient(0, sky.y, 0, base.y);
    lg.addColorStop(0, `rgba(${gold},0)`);
    lg.addColorStop(1, `rgba(${gold},${0.22 * pulse})`);
    ctx.fillStyle = lg;
    ctx.fillRect(c.x - 6 * s, sky.y, 12 * s, base.y - sky.y);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.lineCap = 'round';
    const icon = this.kind === 'seal' ? 'seal' : (ITEMS[this.id] || {}).icon;
    if (icon === 'seal') {
      // ofuda: tira de papel com selo vermelho
      ctx.rotate(Math.sin(this.t * 2) * 0.12);
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(-6 * s, -14 * s, 12 * s, 28 * s);
      ctx.fillStyle = '#b3202a';
      ctx.fillRect(-3.5 * s, -10 * s, 7 * s, 7 * s);
      ctx.fillRect(-1 * s, -1 * s, 2 * s, 12 * s);
    } else if (icon === 'blade' || icon === 'wind') {
      ctx.rotate(-0.8);
      ctx.strokeStyle = '#e8eef5';
      ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-2 * s, 0); ctx.quadraticCurveTo(10 * s, -1 * s, (icon === 'wind' ? 22 : 18) * s, -4 * s); ctx.stroke();
      ctx.strokeStyle = '#2b1d14';
      ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(-12 * s, 1 * s); ctx.lineTo(-3 * s, 0); ctx.stroke();
      ctx.fillStyle = '#c9952c';
      ctx.fillRect(-4 * s, -4 * s, 2.5 * s, 8 * s);
      if (icon === 'wind') {
        ctx.strokeStyle = 'rgba(200,240,255,0.8)';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.arc(4 * s, 6 * s, 9 * s, 0.2, 1.6); ctx.stroke();
      }
    } else if (icon === 'charm') {
      ctx.fillStyle = '#b3202a';
      ctx.beginPath();
      ctx.moveTo(-7 * s, -6 * s); ctx.lineTo(7 * s, -6 * s); ctx.lineTo(7 * s, 9 * s); ctx.lineTo(0, 12 * s); ctx.lineTo(-7 * s, 9 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e7c46a';
      ctx.fillRect(-4 * s, -2 * s, 8 * s, 2 * s);
      ctx.strokeStyle = '#e7c46a';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(0, -6 * s); ctx.lineTo(0, -11 * s); ctx.stroke();
    } else {
      // pergaminho
      ctx.fillStyle = '#efe4c8';
      ctx.fillRect(-10 * s, -5 * s, 20 * s, 10 * s);
      ctx.fillStyle = '#6b3a1e';
      ctx.fillRect(-12 * s, -7 * s, 3 * s, 14 * s);
      ctx.fillRect(9 * s, -7 * s, 3 * s, 14 * s);
      ctx.fillStyle = '#2b1d14';
      ctx.fillRect(-5 * s, -2 * s, 10 * s, 1.5 * s);
      ctx.fillRect(-5 * s, 1 * s, 7 * s, 1.5 * s);
    }
    ctx.restore();
  }
}

/**
 * Baú de tesouro (desenhado proceduralmente em isométrico). Fica TRANCADO
 * enquanto os bandidos acampados que o guardam estiverem de pé; depois o
 * jogador o abre com E.
 */
class Chest {
  constructor(world, x, y, kind, id) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.kind = kind; // 'seal', 'item' ou 'food'
    this.id = id;
    this.encounter = null;
    this.opened = false;
    this.openT = 0;
    this.alive = true;
    this.box = { x0: x - 0.4, y0: y - 0.3, x1: x + 0.4, y1: y + 0.3 };
    world.level.addPost(x, y, 0.38);
  }

  get locked() {
    return !!this.encounter && this.encounter.state !== 'done';
  }

  /** Jogador perto o bastante para interagir. */
  near() {
    const p = this.world.player;
    return p.alive && Math.hypot(p.x - this.x, p.y - this.y) < 1.35;
  }

  open() {
    if (this.opened || this.locked) return;
    this.opened = true;
    this.openT = 0;
    Sfx.pickup();
    const pk = new Pickup(this.world, this.x, this.y, this.kind === 'food' ? 'onigiri' : this.kind, this.id);
    pk.fromChest = true;
    this.world.pickups.push(pk);
    this.world.effects.sparks(this.x, this.y, -Math.PI * 0.75, 14, '#ffd36a', 3);
  }

  update(dt) {
    this.t = (this.t || 0) + dt;
    if (this.opened) this.openT = Math.min(1, this.openT + dt * 3);
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const hx = 0.36, hy = 0.24, H = 16, L = 7;
    const P = (dx, dy, z) => cam.worldToScreen(this.x + dx, this.y + dy, z);
    const quad = (pts, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,5,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    // sombra
    const c = cam.worldToScreen(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 2 * s, 24 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // brilho de "pode abrir"
    if (!this.opened && !this.locked) {
      const g = ctx.createRadialGradient(c.x, c.y - 10 * s, 2, c.x, c.y - 10 * s, 50 * s);
      g.addColorStop(0, `rgba(255,210,110,${0.35 + 0.2 * Math.sin(this.t * 4)})`);
      g.addColorStop(1, 'rgba(255,210,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 10 * s, 50 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // corpo: faces sul (+y) e leste (+x) são as visíveis
    quad([P(-hx, hy, 0), P(hx, hy, 0), P(hx, hy, H), P(-hx, hy, H)], '#7a2a1c');
    quad([P(hx, hy, 0), P(hx, -hy, 0), P(hx, -hy, H), P(hx, hy, H)], '#5e2015');
    // faixas douradas
    ctx.strokeStyle = '#d7a640';
    ctx.lineWidth = 2 * s;
    for (const f of [-0.6, 0.6]) {
      const a = P(hx * f, hy, 0), b = P(hx * f, hy, H);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (!this.opened) {
      // tampa fechada (prisma baixo)
      quad([P(-hx, hy, H), P(hx, hy, H), P(hx, hy, H + L), P(-hx, hy, H + L)], '#8e3322');
      quad([P(hx, hy, H), P(hx, -hy, H), P(hx, -hy, H + L), P(hx, hy, H + L)], '#6b2618');
      quad([P(-hx, -hy, H + L), P(hx, -hy, H + L), P(hx, hy, H + L), P(-hx, hy, H + L)], '#a43d28');
      // fechadura
      const k = P(0, hy, H + 2);
      ctx.fillStyle = this.locked ? '#9aa0a8' : '#f0c25a';
      ctx.fillRect(k.x - 3 * s, k.y - 4 * s, 6 * s, 7 * s);
      if (this.locked) {
        // corrente com selo vermelho: guardado pelos bandidos
        ctx.strokeStyle = '#3a3a3e';
        ctx.lineWidth = 2 * s;
        const a = P(-hx, hy, H + 3), b = P(hx, hy, H + 3);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } else {
      // aberto: interior escuro + tampa levantada atrás
      quad([P(-hx, -hy, H), P(hx, -hy, H), P(hx, hy, H), P(-hx, hy, H)], '#1d0d08');
      const up = this.openT;
      quad([P(-hx, -hy, H), P(hx, -hy, H), P(hx, -hy - 0.05 * up, H + 22 * up), P(-hx, -hy - 0.05 * up, H + 22 * up)], '#a43d28');
    }
    // aviso de interação
    if (!this.opened && this.near()) {
      const t = cam.worldToScreen(this.x, this.y, 60);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(13 * Math.min(s, 1.4))}px ${FONT_UI}`;
      const msg = this.locked ? 'Trancado: derrote os bandidos do acampamento' : (TOUCH.active ? 'AGIR — abrir o baú' : 'E — abrir o baú');
      const w = ctx.measureText(msg).width + 14;
      ctx.fillStyle = 'rgba(10,7,6,0.75)';
      ctx.fillRect(t.x - w / 2, t.y - 15, w, 22);
      ctx.fillStyle = this.locked ? '#ff9a80' : '#ffcf6a';
      ctx.fillText(msg, t.x, t.y + 1);
      ctx.restore();
    }
  }
}

/** Fogueira do acampamento: decorativa, com chama animada e luz. */
class Campfire {
  constructor(world, x, y) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.t = Math.random() * 10;
    this.alive = true;
    this.box = { x0: x - 0.55, y0: y - 0.55, x1: x + 0.55, y1: y + 0.55 };
    this.smokeT = 0;
    world.level.addPost(x, y, 0.55);
  }

  update(dt) {
    this.t += dt;
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.25;
      this.world.effects.puffs.push({ x: this.x, y: this.y, z: 30, vx: 0.15, vy: -0.15, vz: 30, r: 0.18, life: 1.6, max: 1.6, color: '60,55,50' });
    }
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const c = cam.worldToScreen(this.x, this.y);
    // luz da fogueira no chão
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 80 * s);
    g.addColorStop(0, `rgba(255,150,60,${0.34 + 0.07 * Math.sin(this.t * 13)})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 80 * s, 40 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // fogueira com espetos (sprite) + tremulação da chama
    const f = 1 + 0.03 * Math.sin(this.t * 17);
    Sprites.draw(ctx, 'camp_firepit', c.x, c.y + 6 * s, 0.55 * s * f, {});
  }
}

/**
 * Aldeão refém (sprites da folha do acampamento): amarrado a um poste ou
 * ajoelhado com as mãos atadas, pedindo socorro perto dos bandidos.
 * Depois que o grupo que o vigia cai, o rōnin corta a corda com E:
 *   villager_cut (corda cortada) -> villager_rise (levanta) -> agradece -> some.
 */
class Villager {
  constructor(world, x, y, post, encounter) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.post = post; // amarrado num poste?
    this.backTurned = !post && Math.random() < 0.35; // ajoelhado de costas (mãos atadas à mostra)
    this.wx = 0; // deslocamento ao ir embora depois de libertado
    this.wy = 0;
    this.encounter = encounter;
    this.freed = false;
    this.freedT = 0;
    this.t = Math.random() * 5;
    this.alive = true;
    this.radius = 0.3;
    this.facing = Math.random() < 0.5 ? 0 : Math.PI / 2;
    this.box = { x0: x - 0.3, y0: y - 0.3, x1: x + 0.3, y1: y + 0.3 };
    if (post) world.level.addPost(x - 0.15, y - 0.15, 0.22);
  }

  get locked() {
    return !!this.encounter && this.encounter.state !== 'done';
  }

  near() {
    const p = this.world.player;
    return p.alive && Math.hypot(p.x - this.x, p.y - this.y) < 1.4;
  }

  free() {
    if (this.freed || this.locked) return;
    this.freed = true;
    this.freedT = 0;
    const w = this.world;
    w.stats.rescued++;
    w.rescuedHere++;
    w.player.heal(20);
    w.effects.text(this.x, this.y, 'Obrigado, rōnin!', '#ffe9a8', true);
    w.effects.sparks(this.x, this.y, -Math.PI * 0.75, 10, '#c89a5a', 2);
    Sfx.swing(0);
    Sfx.pickup();
    const left = w.villagers.filter((v) => !v.freed).length;
    w.showBanner('Aldeão libertado', { sub: left ? `Ainda há ${left} em perigo nesta vila (+20 de vida)` : 'Todos os aldeões desta vila estão a salvo (+20 de vida)', dur: 2.2, y: 0.24, color: '#ffe9a8' });
  }

  update(dt) {
    this.t += dt;
    if (this.freed) {
      this.freedT += dt;
      // depois de agradecer, vai embora caminhando (para longe da câmera)
      if (this.freedT > 1.5) {
        this.wx -= 1.6 * dt * Math.SQRT1_2;
        this.wy -= 1.6 * dt * Math.SQRT1_2;
      }
      if (this.freedT > 3.6) this.alive = false;
    }
  }

  sprite() {
    if (this.freed) {
      const k = this.freedT;
      if (k < 0.4) return 'villager_cut';
      if (k < 0.8) return 'villager_rise';
      if (k < 1.5) return Math.floor(k * 2) % 2 ? 'villager_thank' : 'villager_pray';
      return 'villager_back_walk';
    }
    if (this.post) return Math.floor(this.t * 1.2) % 2 ? 'villager_post2' : 'villager_post';
    // quando o jogador chega perto (e já é seguro), junta as mãos implorando
    if (this.near() && !this.locked) return 'villager_pray_kneel';
    if (this.backTurned) return 'villager_back_kneel';
    return ['villager_kneel', 'villager_kneel2', 'villager_bow'][Math.floor(this.t * 0.9) % 3];
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const walking = this.freed && this.freedT > 1.5;
    const bob = walking ? Math.abs(Math.sin(this.freedT * 7)) * 2.5 : 0;
    const g = cam.worldToScreen(this.x + this.wx, this.y + this.wy, bob);
    const alpha = this.freed ? clamp(1 - (this.freedT - 2.8) / 0.8, 0, 1) : 1;
    if (alpha <= 0) return;
    const shiver = this.freed ? 0 : Math.sin(this.t * 40) * 0.6 * s; // tremendo de medo
    ctx.fillStyle = `rgba(0,0,0,${0.3 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, Iso.HW * 0.45 * s, Iso.HH * 0.45 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    Sprites.draw(ctx, this.sprite(), g.x + shiver, g.y, CONFIG.SPRITE_SCALE * s, { alpha });

    // balão: pedido de socorro / instrução
    const p = this.world.player;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    let msg = null, color = '#7a1d16';
    if (this.freed) {
      msg = null;
    } else if (this.near()) {
      msg = this.locked ? 'Cuidado! Os bandidos ainda estão aqui!' : (TOUCH.active ? 'AGIR — cortar as cordas' : 'E — cortar as cordas');
      color = this.locked ? '#8a2a1c' : '#6b4a10';
    } else if (d < 9 && Math.floor(this.t * 1.5) % 3 !== 2) {
      msg = 'Socorro!';
    }
    if (msg) {
      const t = cam.worldToScreen(this.x, this.y, this.post ? 120 : 90);
      ctx.save();
      ctx.font = `700 ${Math.round(13 * Math.min(s, 1.4))}px ${FONT_UI}`;
      ctx.textAlign = 'center';
      const wd = ctx.measureText(msg).width + 16;
      ctx.fillStyle = 'rgba(250,244,230,0.92)';
      ctx.beginPath();
      ctx.moveTo(t.x - wd / 2, t.y - 16);
      ctx.lineTo(t.x + wd / 2, t.y - 16);
      ctx.lineTo(t.x + wd / 2, t.y + 6);
      ctx.lineTo(t.x + 6, t.y + 6);
      ctx.lineTo(t.x, t.y + 13);
      ctx.lineTo(t.x - 4, t.y + 6);
      ctx.lineTo(t.x - wd / 2, t.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(msg, t.x, t.y);
      ctx.restore();
    }
  }
}
