/**
 * actor.js — Base comum para jogador, ninjas e boss: posição, knockback,
 * colisão com o cenário, flash de dano e desenho de sprite com sombra.
 */
/**
 * Poses DE COSTAS: quando o personagem anda/ataca para longe da câmera (para
 * cima na tela), troca a pose de frente pela de costas. [sprite, escala relativa]
 * (a escala corrige folhas desenhadas em tamanhos diferentes).
 */
const BACK_SPRITES = {
  oni_raise: ['oni_back_raise', 1], oni_slam: ['oni_back_slam', 1], oni_slam2: ['oni_back_slam', 1],
  ronin_low: ['ronin_back', 1.38], ronin_dual: ['ronin_back_dual', 1.38], ronin_raise: ['ronin_back_raise', 1.38],
  kuno_stance: ['kuno_back', 1.28], kuno_fist: ['kuno_back2', 1.28], kuno_slash: ['kuno_back2', 1.28],
  bandit_dance: ['bandit_back_dance', 1], bandit_dance2: ['bandit_back_dance', 1],
};
/** Variações para animar a caminhada de costas (alterna quadros parecidos). */
const BACK_WALK = {
  oni_back_raise: ['oni_back_raise', 'oni_back_raise2'],
  ronin_back: ['ronin_back', 'ronin_back_cape'],
  kuno_back: ['kuno_back', 'kuno_back2'],
};

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
    this.stride = 0;       // distância percorrida: os passos acompanham a velocidade
    this._sx = 1;          // escala X atual (virada suave entre esquerda e direita)
    this._prev = null;     // quadro anterior, para a transição curta entre poses
    this._fade = 1;
    this._lastT = null;
    this._lean = 0;
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
    this.stride += Math.hypot(this.vx, this.vy) * dt;
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

  /** Olhando para longe da câmera? (componente Y de tela da direção < 0) */
  get facingAway() {
    return Math.cos(this.facing) + Math.sin(this.facing) < -0.45;
  }

  /**
   * Desenha o sprite com movimento fluido:
   *  - pose de costas quando vai para longe da câmera (BACK_SPRITES);
   *  - virada suave: em vez de espelhar de uma vez, o sprite "gira" achatando no eixo X;
   *  - transição de ~70 ms entre quadros diferentes (sem saltos de pose);
   *  - leve balanço vertical e inclinação na direção da corrida.
   */
  drawSprite(ctx, cam, name, scale, opts = {}) {
    const now = this.world.time;
    const dt = this._lastT === null ? 0 : clamp(now - this._lastT, 0, 0.1);
    this._lastT = now;

    let k = 1;
    if (!opts.noBack && this.facingAway && BACK_SPRITES[name]) {
      const [bn, bk] = BACK_SPRITES[name];
      name = bn;
      k = bk;
      const walk = BACK_WALK[name];
      if (walk && Math.hypot(this.vx, this.vy) > 0.3) name = walk[Math.floor(this.stride * 1.6) % walk.length];
    }

    // virada suave
    const target = (opts.flip ?? this.flip) ? -1 : 1;
    const turn = 14 * dt;
    this._sx = this._sx < target ? Math.min(target, this._sx + turn) : Math.max(target, this._sx - turn);
    if (dt === 0) this._sx = target;
    const sx = Math.sign(this._sx || target) * Math.max(0.2, Math.abs(this._sx));

    // balanço e inclinação ao andar
    const sp = Math.hypot(this.vx, this.vy);
    const moving = sp > 0.3 && !opts.still;
    const bob = moving ? Math.abs(Math.sin(this.stride * Math.PI * 0.95)) * 2.6 * Math.min(1, sp / 4) : 0;
    const screenVx = (this.vx - this.vy); // componente X de tela da velocidade
    this._lean = damp(this._lean, moving ? clamp(screenVx / 12, -0.07, 0.07) : 0, 10, dt || 1);

    const g = cam.worldToScreen(this.x, this.y, (opts.z || 0) + bob);
    const base = {
      flip: false,
      sx,
      sy: moving ? 1 + Math.sin(this.stride * Math.PI * 1.9) * 0.015 : 1,
      rotate: (opts.rotate || 0) + this._lean,
      tint: opts.tint || '#ffffff',
      tintAmount: opts.tintAmount ?? this.flash * 8,
    };
    const alpha = opts.alpha ?? 1;
    const fullScale = scale * k * cam.scale;

    // transição entre quadros
    if (!this._prev || this._prev.name !== name) {
      if (this._prev && this._fade >= 1) this._from = { ...this._prev };
      this._fade = this._prev ? 0 : 1;
      this._prev = { name, scale: fullScale };
    }
    this._fade = Math.min(1, this._fade + dt / 0.07);
    if (this._fade < 1 && this._from) {
      Sprites.draw(ctx, this._from.name, g.x, g.y, this._from.scale, { ...base, alpha: alpha * (1 - this._fade) });
    }
    Sprites.draw(ctx, name, g.x, g.y, fullScale, { ...base, alpha: this._fade < 1 ? alpha * (0.35 + 0.65 * this._fade) : alpha });
  }
}
