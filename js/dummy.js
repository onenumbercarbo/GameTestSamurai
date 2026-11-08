/**
 * dummy.js — Bonecos de treino (makiwara de palha).
 *
 * Servem para testar o ataque em área contra vários alvos. A interface que o
 * combate espera de um alvo é mínima — { x, y, radius, alive, takeHit() } —
 * então os futuros saqueadores (bandidos com IA) implementarão a mesma.
 */
class TrainingDummy {
  constructor(x, y) {
    this.spawnX = x;
    this.spawnY = y;
    this.radius = 0.3;
    this.maxHp = 60;
    this.reset();
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.flash = 0;
    this.wobble = 0;
    this.respawn = 0;
  }

  get depth() {
    return this.x + this.y;
  }

  takeHit(damage, nx, ny, knockback) {
    this.hp -= damage;
    this.flash = 0.1;
    this.wobble = 1;
    this.vx += nx * knockback;
    this.vy += ny * knockback;
    if (this.hp <= 0) {
      this.alive = false;
      this.respawn = 2.5;
    }
  }

  update(dt) {
    if (!this.alive) {
      this.respawn -= dt;
      if (this.respawn <= 0) this.reset();
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.exp(-7 * dt); // atrito
    this.vy *= Math.exp(-7 * dt);
    this.x = clamp(this.x, this.radius, CONFIG.MAP_W - this.radius);
    this.y = clamp(this.y, this.radius, CONFIG.MAP_H - this.radius);
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt * 3);
  }

  draw(ctx, camera, debug) {
    if (!this.alive) return;
    const g = camera.worldToScreen(this.x, this.y);
    const sway = Math.sin(this.wobble * 30) * this.wobble * 6;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, CONFIG.TILE_W * 0.22, CONFIG.TILE_H * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Poste de madeira + feixe de palha
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#6b4a2b';
    ctx.fillRect(g.x - 3, g.y - 20, 6, 20);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#c9a85a';
    ctx.fillRect(g.x - 9 + sway, g.y - 50, 18, 32);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#8a6d33';
    ctx.fillRect(g.x - 9 + sway, g.y - 40, 18, 3);
    ctx.fillRect(g.x - 9 + sway, g.y - 28, 18, 3);

    // Barra de vida
    const w = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(g.x - w / 2, g.y - 60, w, 4);
    ctx.fillStyle = '#d9483b';
    ctx.fillRect(g.x - w / 2, g.y - 60, w * (this.hp / this.maxHp), 4);

    if (debug) drawWorldCircle(ctx, camera, this.x, this.y, this.radius, '#fc4');
  }
}
