/**
 * player.js — O Rōnin (placeholder).
 *
 * Por enquanto é desenhado com retângulos coloridos (cabelo ruivo, kimono
 * vermelho, hakama claro) e uma linha como katana. Quando os sprites
 * chegarem, apenas o draw() muda: a lógica já trabalha em coordenadas de mundo
 * e expõe `facing`/`state`, que escolherão a direção (8 direções) e a animação.
 */
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0; // velocidade de locomoção (tiles/s)
    this.vy = 0;
    this.ix = 0; // impulsos (lunge dos golpes), decaem rápido
    this.iy = 0;
    this.radius = CONFIG.PLAYER.radius;

    this.aimAngle = 0;  // ângulo no MUNDO de jogador -> cursor
    this.facing = 0;    // para onde o corpo olha (vira a direção do sprite)

    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashDir = { x: 0, y: 0 };
    this.invulnerable = false;
    this.afterimages = [];
    this.afterimageTimer = 0;

    this.combo = new ComboSystem(COMBO_CHAIN);
  }

  get state() {
    if (this.dashTime > 0) return 'dash';
    if (this.combo.attacking) return 'attack';
    return Math.hypot(this.vx, this.vy) > 0.2 ? 'run' : 'idle';
  }

  onAttackStart(def, aim) {
    this.facing = aim;
    this.ix += Math.cos(aim) * def.lunge;
    this.iy += Math.sin(aim) * def.lunge;
  }

  update(dt, input, world) {
    const P = CONFIG.PLAYER;

    // ---- Mira: mouse (tela) -> mundo, e ângulo a partir do jogador ----
    const m = world.camera.screenToWorld(input.mouse.x, input.mouse.y);
    this.aimAngle = Math.atan2(m.y - this.y, m.x - this.x);

    // ---- Direção de movimento: input de TELA convertido para o MUNDO ----
    const sx = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const sy = (input.isDown('KeyS', 'ArrowDown') ? 1 : 0) - (input.isDown('KeyW', 'ArrowUp') ? 1 : 0);
    const move = Iso.screenDirToWorld(sx, sy);

    // ---- Dash: esquiva rápida com invulnerabilidade, cancela ataques ----
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (input.wasPressed('Space', 'ShiftLeft', 'ShiftRight') && this.dashCooldown <= 0 && this.dashTime <= 0) {
      // Sem direção pressionada, o dash vai para onde o mouse aponta.
      this.dashDir = move.x || move.y ? move : { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
      this.dashTime = P.dashDuration;
      this.dashCooldown = P.dashCooldown;
      this.combo.cancel(); // "animation cancel" — fundamental para combate fluido
      this.ix = this.iy = 0;
    }

    // ---- Ataque ----
    if (input.consumeAttack() && this.dashTime <= 0) this.combo.request();

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.invulnerable = true;
      this.vx = this.dashDir.x * P.dashSpeed;
      this.vy = this.dashDir.y * P.dashSpeed;
      this.facing = Math.atan2(this.dashDir.y, this.dashDir.x);
      if (this.dashTime <= 0) {
        // Sai do dash mantendo um pouco do embalo, sem parar seco.
        this.vx = this.dashDir.x * P.speed;
        this.vy = this.dashDir.y * P.speed;
      }
    } else {
      this.invulnerable = false;
      const mul = this.combo.attacking ? this.combo.current.def.moveMul : 1;
      this.vx = damp(this.vx, move.x * P.speed * mul, P.accel, dt);
      this.vy = damp(this.vy, move.y * P.speed * mul, P.accel, dt);
      if (!this.combo.attacking) {
        // Fora de ataque, o corpo olha para o cursor (twin-stick feel).
        this.facing = this.aimAngle;
      }
    }

    this.combo.update(dt, this, world.enemies, world);

    // Impulso do lunge decai exponencialmente.
    this.ix *= Math.exp(-12 * dt);
    this.iy *= Math.exp(-12 * dt);

    this.x += (this.vx + this.ix) * dt;
    this.y += (this.vy + this.iy) * dt;

    // Limites do mapa (colisão com cenário virá depois, via grid de tiles).
    this.x = clamp(this.x, this.radius, CONFIG.MAP_W - this.radius);
    this.y = clamp(this.y, this.radius, CONFIG.MAP_H - this.radius);

    // Rastro de "afterimages" durante o dash.
    this.afterimageTimer -= dt;
    if (this.dashTime > 0 && this.afterimageTimer <= 0) {
      this.afterimages.push({ x: this.x, y: this.y, life: 0.22 });
      this.afterimageTimer = 0.025;
    }
    for (const a of this.afterimages) a.life -= dt;
    this.afterimages = this.afterimages.filter((a) => a.life > 0);
  }

  /** Depth key: no isométrico, quem tem x+y maior está "mais perto" da câmera. */
  get depth() {
    return this.x + this.y;
  }

  drawBody(ctx, p, alpha = 1, tint = null) {
    ctx.globalAlpha = alpha;
    // Pernas/hakama (claro)
    ctx.fillStyle = tint || '#e6dcc3';
    ctx.fillRect(p.x - 9, p.y - 22, 18, 22);
    // Tronco/kimono (vermelho)
    ctx.fillStyle = tint || '#b3202a';
    ctx.fillRect(p.x - 10, p.y - 40, 20, 19);
    // Cabeça (pele) + cabelo ruivo preso (rabo de cavalo)
    ctx.fillStyle = tint || '#f0c9a0';
    ctx.fillRect(p.x - 6, p.y - 52, 12, 12);
    ctx.fillStyle = tint || '#c0392b';
    ctx.fillRect(p.x - 7, p.y - 55, 14, 6);
    ctx.globalAlpha = 1;
  }

  draw(ctx, camera, debug) {
    // Afterimages (rastro do dash)
    for (const a of this.afterimages) {
      this.drawBody(ctx, camera.worldToScreen(a.x, a.y), (a.life / 0.22) * 0.45, '#ff5a4a');
    }

    const ground = camera.worldToScreen(this.x, this.y);

    // Sombra: um círculo no mundo = elipse 2:1 na tela.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, CONFIG.TILE_W * 0.26, CONFIG.TILE_H * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // A katana fica atrás do corpo quando aponta para "longe" da câmera
    // (seno negativo da direção projetada) — ordenação simples de profundidade.
    const blade = this.combo.bladeAngle();
    const swordAngle = blade ?? this.facing;
    const swordBehind = Math.sin(swordAngle + Math.PI / 4) < 0;

    if (swordBehind) this.drawKatana(ctx, camera, swordAngle, blade !== null);
    this.drawBody(ctx, ground, 1, this.dashTime > 0 ? '#ffd0c8' : null);
    if (!swordBehind) this.drawKatana(ctx, camera, swordAngle, blade !== null);

    if (debug) {
      drawWorldCircle(ctx, camera, this.x, this.y, this.radius, '#4af');
      const c = this.combo.current;
      if (c) drawWorldSector(ctx, camera, this.x, this.y, c.def.range, c.aim, c.def.arcDeg, 'rgba(255,80,80,0.8)');
    }
  }

  drawKatana(ctx, camera, angle, swinging) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const len = swinging ? 1.25 : 0.85; // estendida durante o golpe
    const hilt = camera.worldToScreen(this.x + ca * 0.18, this.y + sa * 0.18, 26);
    const guard = camera.worldToScreen(this.x + ca * 0.32, this.y + sa * 0.32, 26);
    const tip = camera.worldToScreen(this.x + ca * len, this.y + sa * len, swinging ? 22 : 30);

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b1d14'; // tsuka (cabo)
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hilt.x, hilt.y);
    ctx.lineTo(guard.x, guard.y);
    ctx.stroke();
    ctx.strokeStyle = '#dfe6ee'; // lâmina
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }
}

/* ---------------- helpers de debug (desenho de formas no MUNDO) ---------------- */

function drawWorldCircle(ctx, camera, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const p = camera.worldToScreen(x + Math.cos(a) * r, y + Math.sin(a) * r);
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawWorldSector(ctx, camera, x, y, r, aim, arcDeg, color) {
  const half = (arcDeg * Math.PI) / 360;
  const c = camera.worldToScreen(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  for (let i = 0; i <= 32; i++) {
    const a = aim - half + (i / 32) * half * 2;
    const p = camera.worldToScreen(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
}
