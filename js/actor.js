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
  // caminhadas novas (folha 12)
  oni_w0: ['oni_back_raise', 0.72], oni_w1: ['oni_back_raise', 0.72], oni_w2: ['oni_back_raise', 0.72], oni_w3: ['oni_back_raise', 0.72], oni_w4: ['oni_back_raise', 0.72],
  ronin_w0: ['ronin_wb0', 1], ronin_w1: ['ronin_wb0', 1], ronin_w2: ['ronin_wb0', 1],
  kuno_r1: ['kuno_wb0', 1], kuno_r2: ['kuno_wb0', 1], kuno_r3: ['kuno_wb0', 1], kuno_r4: ['kuno_wb0', 1], kuno_r5: ['kuno_wb0', 1], kuno_r6: ['kuno_wb0', 1],
  // rōnin (folha pequena: recortada em escala 1, por isso fator ~1,36)
  hero_idle: ['hero_back_idle', 1.4], hero_walk1: ['hero_back_walk1', 1.4], hero_walk2: ['hero_back_walk2', 1.4],
  hero_dash: ['hero_back_dash', 1.4], hero_stance: ['hero_back_stance', 1.4], hero_draw: ['hero_back_draw', 1.4],
  hero_slash1: ['hero_back_slash', 1.4], hero_slash2: ['hero_back_slash2', 1.4],
};
/** Variações para animar a caminhada de costas (alterna quadros parecidos). */
const BACK_WALK = {
  oni_back_raise: ['oni_back_raise', 'oni_back_raise2'],
  ronin_back: ['ronin_back', 'ronin_back_cape'],
  kuno_back: ['kuno_back', 'kuno_back2'],
  ronin_wb0: ['ronin_wb0', 'ronin_wb1'],
  kuno_wb0: ['kuno_wb0', 'kuno_wb1'],
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

    // Virada: espelho instantâneo (achatar o sprite parecia uma folha de papel girando).
    // A troca de lado ganha só a transição cruzada de quadros, abaixo.
    const flipNow = opts.flip ?? this.flip;
    const sx = flipNow ? -1 : 1;

    // balanço e inclinação ao andar
    const sp = Math.hypot(this.vx, this.vy);
    const moving = sp > 0.3 && !opts.still;
    // balanço vertical: dois "passos" por ciclo de 8 quadros (sincronizado com as pernas)
    const bob = moving
      ? Math.abs(Math.sin(opts.cycle ? (this.stride * 2.6 / 8) * Math.PI * 2 : this.stride * Math.PI * 0.95)) * 2.4 * Math.min(1, sp / 4)
      : 0;
    const screenVx = (this.vx - this.vy); // componente X de tela da velocidade
    this._lean = damp(this._lean, moving ? clamp(screenVx / 12, -0.07, 0.07) : 0, 10, dt || 1);

    const g = cam.worldToScreen(this.x, this.y, (opts.z || 0) + bob);
    const base = {
      flip: false,
      sx,
      sy: 1,
      rotate: (opts.rotate || 0) + this._lean,
      tint: opts.tint || '#ffffff',
      tintAmount: opts.tintAmount ?? this.flash * 8,
    };
    const alpha = opts.alpha ?? 1;
    const fullScale = scale * k * cam.scale;

    // transição entre quadros (inclui a troca de lado e frente/costas)
    if (!this._prev || this._prev.name !== name || this._prev.sx !== sx) {
      // Dentro do mesmo ciclo de caminhada os quadros trocam secos (sem "fantasma");
      // a fusão curta fica só para mudanças de pose ou de direção.
      const sameCycle = this._prev && opts.cycle && this._prev.cycle === opts.cycle && this._prev.sx === sx;
      if (this._prev && this._fade >= 1 && !sameCycle) this._from = { ...this._prev };
      if (!sameCycle) this._fade = this._prev ? 0 : 1;
      this._prev = { name, scale: fullScale, sx, cycle: opts.cycle };
    }
    this._fade = Math.min(1, this._fade + dt / 0.08);
    if (this._fade < 1 && this._from) {
      Sprites.draw(ctx, this._from.name, g.x, g.y, this._from.scale, { ...base, sx: this._from.sx, alpha: alpha * (1 - this._fade) });
    }
    Sprites.draw(ctx, name, g.x, g.y, fullScale, { ...base, alpha: this._fade < 1 ? alpha * (0.35 + 0.65 * this._fade) : alpha });
  }
}
