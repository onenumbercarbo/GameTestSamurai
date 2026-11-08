/**
 * player.js — O Rōnin.
 *
 * Animações (sprites recortados das folhas):
 *   idle  -> hero_idle            andar -> hero_walk1/idle/walk2/idle
 *   dash  -> hero_dash            golpes -> definidos em COMBO_CHAIN.frames
 *   dano  -> hero_stance + flash vermelho
 */
class Player extends Actor {
  constructor(world, x, y, items = []) {
    super(world, x, y, CONFIG.PLAYER.radius);
    this.items = items;
    this.mods = computeMods(items); // bônus das armas/relíquias encontradas
    this.maxHp = CONFIG.PLAYER.maxHp + this.mods.hp;
    this.hp = this.maxHp;
    this.aimAngle = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.sinceDash = 99;
    this.dashDir = { x: 0, y: 0 };
    this.iframes = 0;
    this.hurtTime = 0;
    this.afterimages = [];
    this.afterimageTimer = 0;
    this.deadTime = 0;
    this.heavyCd = 0;
    this.moveDir = { x: 0, y: 0 };
    this.combo = new ComboSystem(COMBO_CHAIN);
  }

  /** Recalcula bônus após pegar um item novo. */
  equip(id) {
    if (!this.items.includes(id)) this.items.push(id);
    const before = this.maxHp;
    this.mods = computeMods(this.items);
    this.maxHp = CONFIG.PLAYER.maxHp + this.mods.hp;
    if (this.maxHp > before) this.hp = this.maxHp;
  }

  /**
   * Direção do golpe.
   *  1. Base: para onde o jogador conduz com WASD; parado, para onde o mouse aponta.
   *  2. Assistência de mira: se houver inimigo a até 3,2 tiles, gira para ele,
   *     preferindo os que estão à frente da direção base e mais perto.
   * Assim o Rōnin sempre corta na direção da luta, mesmo que o cursor tenha
   * ficado parado do outro lado da tela.
   */
  attackAim() {
    const moving = this.moveDir.x || this.moveDir.y;
    const base = moving ? Math.atan2(this.moveDir.y, this.moveDir.x) : this.aimAngle;
    let best = null, bestScore = Infinity;
    for (const e of this.world.targets()) {
      if (e.isProjectile || e.isCrate) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 3.2) continue;
      const score = d + Math.abs(angleDiff(Math.atan2(dy, dx), base)) * 1.6;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best ? Math.atan2(best.y - this.y, best.x - this.x) : base;
  }

  get invulnerable() {
    return this.dashTime > 0 || this.iframes > 0 || this.world.cutscene;
  }

  get state() {
    if (!this.alive) return 'dead';
    if (this.dashTime > 0) return 'dash';
    if (this.combo.attacking) return 'attack';
    if (this.hurtTime > 0) return 'hurt';
    return Math.hypot(this.vx, this.vy) > 0.4 ? 'run' : 'idle';
  }

  onAttackStart(def, aim) {
    this.facing = aim;
    this.kx += Math.cos(aim) * def.lunge;
    this.ky += Math.sin(aim) * def.lunge;
  }

  takeHit(hit) {
    if (!this.alive || this.invulnerable) return false;
    this.hp -= hit.damage;
    this.iframes = CONFIG.PLAYER.hurtIFrames;
    this.hurtTime = 0.22;
    this.flash = 0.15;
    this.kx += hit.nx * (hit.knockback || 4);
    this.ky += hit.ny * (hit.knockback || 4);
    this.combo.cancel();
    const w = this.world;
    w.camera.shake(8);
    w.hitStop = Math.max(w.hitStop, 0.06);
    w.damageVignette = 1;
    w.effects.ink(this.x, this.y, Math.atan2(hit.ny, hit.nx), 8);
    w.effects.text(this.x, this.y, '-' + hit.damage, '#ff4d4d');
    w.stats.combo = 0;
    Sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deadTime = 0;
      Sfx.death();
    }
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  update(dt, input) {
    const P = CONFIG.PLAYER;
    const w = this.world;
    this.animTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.sinceDash += dt;

    if (!this.alive) {
      this.deadTime += dt;
      this.vx = this.vy = 0;
      this.move(dt);
      return;
    }

    // Mira: mouse (tela) -> mundo (inverte câmera, zoom e projeção isométrica).
    const m = w.camera.screenToWorld(input.mouse.x, input.mouse.y);
    this.aimAngle = Math.atan2(m.y - this.y, m.x - this.x);

    // Input de TELA (WASD) convertido em direção no MUNDO.
    const locked = !!w.cutscene;
    const sx = locked ? 0 : (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const sy = locked ? 0 : (input.isDown('KeyS', 'ArrowDown') ? 1 : 0) - (input.isDown('KeyW', 'ArrowUp') ? 1 : 0);
    const move = Iso.screenDirToWorld(sx, sy);
    this.moveDir = move;
    this.heavyCd = Math.max(0, this.heavyCd - dt);

    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (!locked && input.wasPressed('Space', 'ShiftLeft', 'ShiftRight') && this.dashCooldown <= 0 && this.dashTime <= 0) {
      this.dashDir = move.x || move.y ? move : { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
      this.dashTime = P.dashDuration;
      this.dashCooldown = P.dashCooldown;
      this.combo.cancel();
      this.kx = this.ky = 0;
      w.effects.smoke(this.x, this.y, 4, '210,200,180', 0.3);
      Sfx.dash();
    }

    if (!locked && input.consumeHeavy() && this.mods.iai && this.heavyCd <= 0 && this.dashTime <= 0) {
      this.heavyCd = 2.2;
      this.combo.startSpecial(IAI_STRIKE, this, w);
      w.effects.smoke(this.x, this.y, 6, '200,220,255', 0.35);
    }

    if (!locked && input.consumeAttack()) {
      // Ramo da árvore de combos: atacar durante/logo após o dash = investida.
      if (this.dashTime > 0 || this.sinceDash < 0.15) {
        this.dashTime = 0;
        this.combo.startSpecial(DASH_ATTACK, this, w);
      } else {
        this.combo.request();
      }
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.dashDir.x * P.dashSpeed;
      this.vy = this.dashDir.y * P.dashSpeed;
      this.facing = Math.atan2(this.dashDir.y, this.dashDir.x);
      if (this.dashTime <= 0) {
        this.sinceDash = 0;
        this.vx = this.dashDir.x * P.speed;
        this.vy = this.dashDir.y * P.speed;
      }
    } else {
      const mul = this.combo.attacking ? this.combo.current.def.moveMul : this.hurtTime > 0 ? 0.3 : 1;
      this.vx = damp(this.vx, move.x * P.speed * mul, P.accel, dt);
      this.vy = damp(this.vy, move.y * P.speed * mul, P.accel, dt);
      if (!this.combo.attacking) {
        // Corre olhando para onde anda; parado, só segue o mouse se ele estiver em uso.
        if (move.x || move.y) this.facing = Math.atan2(move.y, move.x);
        else if (input.mouseActive) this.facing = this.aimAngle;
      }
    }

    this.combo.update(dt, this, w.targets(), w);
    this.move(dt, 12);

    this.afterimageTimer -= dt;
    if (this.dashTime > 0 && this.afterimageTimer <= 0) {
      this.afterimages.push({ x: this.x, y: this.y, life: 0.25, flip: this.flip });
      this.afterimageTimer = 0.03;
    }
    for (const a of this.afterimages) a.life -= dt;
    this.afterimages = this.afterimages.filter((a) => a.life > 0);
  }

  currentSprite() {
    const st = this.state;
    if (st === 'dead') return { name: 'hero_stance' };
    if (st === 'dash') return { name: 'hero_dash' };
    if (st === 'attack') return this.combo.frame();
    if (st === 'hurt') return { name: 'hero_stance' };
    if (st === 'run') {
      const seq = ['hero_walk1', 'hero_idle', 'hero_walk2', 'hero_idle'];
      return { name: seq[Math.floor(this.animTime * 9) % 4] };
    }
    return { name: this.world.inCombat ? 'hero_stance' : 'hero_idle' };
  }

  draw(ctx, cam) {
    const S = CONFIG.SPRITE_SCALE;
    for (const a of this.afterimages) {
      const g = cam.worldToScreen(a.x, a.y);
      Sprites.draw(ctx, 'hero_dash', g.x, g.y, S * cam.scale, {
        flip: a.flip, alpha: (a.life / 0.25) * 0.5, tint: '#ff4a3a', tintAmount: 0.85,
      });
    }
    this.drawShadow(ctx, cam);
    const spr = this.currentSprite();
    let flip = this.flip;
    if (spr.flipInvert) flip = !flip;
    const blink = this.iframes > 0 && this.dashTime <= 0 && Math.floor(this.iframes * 20) % 2 === 0;
    if (!this.alive) {
      const k = clamp(this.deadTime / 0.6, 0, 1);
      this.drawSprite(ctx, cam, 'hero_stance', S, { rotate: (flip ? -1 : 1) * k * 1.35, alpha: 1 - clamp(this.deadTime - 1.5, 0, 1) * 0.6, tintAmount: 0 });
      return;
    }
    this.drawSprite(ctx, cam, spr.name, S, {
      flip,
      alpha: blink ? 0.55 : 1,
      tint: this.hurtTime > 0 ? '#ff3030' : '#ffffff',
      tintAmount: this.hurtTime > 0 ? 0.6 : 0,
    });
  }
}
