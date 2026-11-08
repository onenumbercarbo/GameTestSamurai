/**
 * assets.js — Carregamento e desenho de sprites.
 *
 * Os PNGs são gerados por tools/extract_sprites.py a partir das folhas com
 * fundo verde. ATLAS (js/atlas.js) traz o tamanho e o ponto de apoio (pés)
 * de cada sprite, então desenhar = "colocar os pés no ponto do chão".
 */
const Assets = {
  images: {},
  loaded: 0,
  total: 0,
  failed: [],

  load(onProgress) {
    const names = Object.keys(ATLAS);
    this.total = names.length;
    return Promise.all(names.map((n) => new Promise((resolve) => {
      const img = new Image();
      const done = () => {
        this.loaded++;
        if (onProgress) onProgress(this.loaded / this.total);
        resolve();
      };
      img.onload = done;
      img.onerror = () => { this.failed.push(n); done(); };
      img.src = 'assets/sprites/' + n + '.png';
      this.images[n] = img;
    })));
  },
};

const Sprites = {
  tintCache: new Map(),

  /**
   * Desenha um sprite com os pés em (x, y) de tela.
   * opts: flip (espelha), alpha, rotate (rad, em torno dos pés),
   *       tint + tintAmount (sobreposição de cor sólida p/ flash de dano).
   */
  draw(ctx, name, x, y, scale, opts = {}) {
    const m = ATLAS[name];
    const img = Assets.images[name];
    if (!m || !img || !img.naturalWidth) return;
    const alpha = opts.alpha ?? 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (opts.rotate) ctx.rotate(opts.rotate);
    if (opts.flip) ctx.scale(-1, 1);
    const dx = -m.ax * scale;
    const dy = -m.ay * scale;
    ctx.drawImage(img, dx, dy, m.w * scale, m.h * scale);
    if (opts.tint && opts.tintAmount > 0) {
      ctx.globalAlpha = alpha * Math.min(1, opts.tintAmount);
      ctx.drawImage(this.tinted(name, opts.tint), dx, dy, m.w * scale, m.h * scale);
    }
    ctx.restore();
  },

  /**
   * Silhueta colorida do sprite (para o "flash" branco/vermelho ao levar dano).
   * Só usamos composição (source-in), nunca lemos pixels — por isso funciona
   * mesmo abrindo o jogo via file://, onde getImageData seria bloqueado.
   */
  tinted(name, color) {
    const key = name + color;
    let c = this.tintCache.get(key);
    if (c) return c;
    const m = ATLAS[name];
    c = document.createElement('canvas');
    c.width = m.w;
    c.height = m.h;
    const g = c.getContext('2d');
    g.drawImage(Assets.images[name], 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, m.w, m.h);
    this.tintCache.set(key, c);
    return c;
  },

  /** Retângulo de tela ocupado pelo sprite (para oclusão/culling). */
  bounds(name, x, y, scale) {
    const m = ATLAS[name];
    return { x0: x - m.ax * scale, y0: y - m.ay * scale, x1: x + (m.w - m.ax) * scale, y1: y + (m.h - m.ay) * scale };
  },
};
