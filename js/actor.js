/**
 * actor.js — Base comum para jogador, ninjas e boss: posição, knockback,
 * colisão com o cenário, flash de dano e desenho de sprite com sombra.
 */
class Actor {
  constructor(world, x, y, radius) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = 0; // velocidade "intencional" (andar)
    this.vy = 0;
    this.kx = 0; // velocidade de impulso (knockback, investidas) — decai sozinha
    this.ky = 0;
    this.alive = true;
    this.flash = 0;
    this.facing = 0;
    this.animTime = 0;
  }

  get box() {
    const r = this.radius;
    return { x0: this.x - r, y0: this.y - r, x1: this.x + r, y1: this.y + r };
  }

  /** Espelha o sprite (que olha para a direita) quando a direção aponta para a esquerda NA TELA. */
  get flip() {
    // Componente X de tela de uma direção do mundo: (cos - sin) * HW.
    return Math.cos(this.facing) - Math.sin(this.facing) < 0;
  }

  move(dt, friction = 9) {
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
    this.kx *= Math.exp(-friction * dt);
    this.ky *= Math.exp(-friction * dt);
    this.world.level.resolveCircle(this);
  }

  /** Separação suave entre atores (evita que ninjas se empilhem). */
  separateFrom(others, strength = 1) {
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d = Math.hypot(dx, dy), min = this.radius + o.radius;
      if (d < min && d > 1e-4) {
        const push = (min - d) * 0.5 * strength;
        this.x += (dx / d) * push;
        this.y += (dy / d) * push;
      }
    }
  }

  drawShadow(ctx, cam, size = 1) {
    const g = cam.worldToScreen(this.x, this.y);
    const s = cam.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, Iso.HW * 0.5 * size * s, Iso.HH * 0.5 * size * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSprite(ctx, cam, name, scale, opts = {}) {
    const g = cam.worldToScreen(this.x, this.y, opts.z || 0);
    Sprites.draw(ctx, name, g.x, g.y, scale * cam.scale, {
      flip: opts.flip ?? this.flip,
      alpha: opts.alpha,
      rotate: opts.rotate,
      tint: opts.tint || '#ffffff',
      tintAmount: opts.tintAmount ?? this.flash * 8,
    });
  }
}
