/**
 * level.js — Mapa de uma vila: chão isométrico, cenário (props), colisão,
 * campo de fluxo para a IA e ordenação de profundidade.
 */

/**
 * Tipos de objeto de cenário.
 *  - box: colisor retangular calculado a partir do próprio sprite. O ponto de
 *    apoio do PNG é o canto SUL (o mais próximo da câmera) da construção; a
 *    largura à esquerda do apoio corresponde ao eixo X do mundo e a largura à
 *    direita ao eixo Y (ver comentário em Prop).
 *  - circle: colisor circular de raio r em torno do apoio (árvores, lanternas).
 */
const PROP_TYPES = {
  house_thatch: { scale: 0.78, solid: 'box', shrink: 0.86 },
  // As cercas desta casa avançam para a frente do canto sul, então o colisor é
  // dado à mão (relativo ao apoio, em tiles) e cobre casa + cercas.
  house_tile: { scale: 0.78, solid: 'box', box: [-1.62, -2.26, 1.54, 1.63] },
  house_tile2: { scale: 0.78, solid: 'box', shrink: 0.86 },
  shrine: { scale: 0.85, solid: 'box', shrink: 0.75 },
  sakura: { scale: 0.85, solid: 'circle', r: 0.3 },
  bamboo: { scale: 0.85, solid: 'circle', r: 0.5 },
  lantern: { scale: 0.85, solid: 'circle', r: 0.22 },
  lantern2: { scale: 0.85, solid: 'circle', r: 0.22 },
  // Caixas soltas são quebráveis (golpe de espada) e às vezes escondem comida.
  crate: { scale: 0.65, solid: 'circle', r: 0.36, off: -0.32, breakable: 22 },
  crate_tied: { scale: 0.65, solid: 'circle', r: 0.36, off: -0.32, breakable: 30 },
  crate_small: { scale: 0.65, solid: 'circle', r: 0.3, off: -0.28, breakable: 14 },
  crate_mid: { scale: 0.65, solid: 'circle', r: 0.32, off: -0.3, breakable: 18 },

  // Floresta (folha 3). Os bosques grandes trazem o próprio "chão" em losango
  // e formam a mata em volta do mapa.
  forest_mixed: { scale: 0.95, solid: 'box', shrink: 0.9 },
  forest_bamboo_pine: { scale: 0.95, solid: 'box', shrink: 0.9 },
  forest_dark: { scale: 0.95, solid: 'box', shrink: 0.9 },
  forest_sakura: { scale: 0.95, solid: 'box', shrink: 0.9 },
  forest_broadleaf: { scale: 0.95, solid: 'box', shrink: 0.9 },
  forest_pines: { scale: 0.95, solid: 'box', shrink: 0.85 },
  bamboo_grove: { scale: 0.95, solid: 'box', shrink: 0.8 },
  pine: { scale: 0.95, solid: 'circle', r: 0.35 },
  tree_small: { scale: 0.95, solid: 'circle', r: 0.25 },
  bush_a: { scale: 0.8, solid: 'circle', r: 0.28 },
  bush_big: { scale: 0.8, solid: 'circle', r: 0.42 },
  bush_dark: { scale: 0.8, solid: 'circle', r: 0.42 },
  bush_round: { scale: 0.8, solid: 'circle', r: 0.36 },
  rock_moss: { scale: 0.8, solid: 'circle', r: 0.33 },
  rock_big: { scale: 0.8, solid: 'circle', r: 0.3 },
  rock_tall: { scale: 0.8, solid: 'circle', r: 0.3 },
  rock_flat: { scale: 0.8, solid: 'circle', r: 0.4 },
  // Acampamento dos bandidos (folha 4).
  camp_tent: { scale: 0.7, solid: 'box', shrink: 0.7 },
  camp_cookpot: { scale: 0.55, solid: 'circle', r: 0.55, off: -0.2 },
  camp_firepit: { scale: 0.55, solid: 'circle', r: 0.5, off: -0.25 },
  camp_log: { scale: 0.6, solid: 'circle', r: 0.4, off: -0.5 },
  camp_log_bottles: { scale: 0.6, solid: 'circle', r: 0.4, off: -0.4 },
  camp_sake: { scale: 0.65, solid: 'circle', r: 0.3, off: -0.15 },
  camp_barrels: { scale: 0.65, solid: 'circle', r: 0.4, off: -0.3 },
  // Vegetação rasteira: só decoração, não bloqueia.
  fern: { scale: 0.8, solid: 'none', r: 0.25 },
  fern2: { scale: 0.8, solid: 'none', r: 0.25 },
  grass_tall: { scale: 0.8, solid: 'none', r: 0.2 },
};

/** Tipos usados para preencher a mata além das bordas do mapa. */
const BORDER_FAR = ['forest_mixed', 'forest_broadleaf', 'bamboo_grove', 'forest_pines', 'pine', 'forest_mixed', 'forest_sakura'];
// Na frente do mapa (lados sul/leste, mais perto da câmera) só vegetação baixa,
// para as árvores não taparem a luta.
const BORDER_LOW = ['bush_big', 'bush_round', 'bush_a', 'rock_moss', 'rock_flat', 'fern', 'fern2', 'grass_tall', 'tree_small', 'bush_big'];
const BORDER = 9; // largura (em tiles) da faixa de floresta ao redor do mapa

class Prop {
  /**
   * (x, y) = ponto de apoio no mundo.
   *
   * Para colisores 'box': a partir do canto sul S=(x,y) de uma caixa com
   * extensão fx (eixo X) e fy (eixo Y), o canto OESTE fica fx·HW pixels à
   * esquerda de S na tela, e o canto LESTE fica fy·HW pixels à direita. Então:
   *     fx = (pixels à esquerda do apoio) / HW
   *     fy = (pixels à direita do apoio)  / HW
   * — o colisor sai direto do desenho, sem medir nada à mão.
   */
  constructor(type, x, y) {
    const def = PROP_TYPES[type];
    const m = ATLAS[type];
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.fade = 1; // fica translúcido quando esconde o jogador
    this.isProp = true;
    if (def.box) {
      const [bx0, by0, bx1, by1] = def.box;
      this.box = { x0: x + bx0, y0: y + by0, x1: x + bx1, y1: y + by1 };
    } else if (def.solid === 'box') {
      const left = (m.ax * def.scale) / Iso.HW;
      const right = ((m.w - m.ax) * def.scale) / Iso.HW;
      const fx = left * def.shrink, fy = right * def.shrink;
      this.box = { x0: x - fx, y0: y - fy, x1: x, y1: y };
    } else {
      // Colisor circular; `off` desloca o centro para trás do ponto de apoio
      // (o apoio de uma caixa é o canto da frente, não o meio).
      this.r = def.r;
      this.cx = x + (def.off || 0);
      this.cy = y + (def.off || 0);
      this.box = { x0: this.cx - def.r, y0: this.cy - def.r, x1: this.cx + def.r, y1: this.cy + def.r };
    }
    if (def.breakable) {
      this.hp = def.breakable;
      this.flash = 0;
      this.shake = 0;
    }
  }

  /** Alvo para o combate (só caixas quebráveis). */
  get target() {
    if (!this._target) {
      const prop = this;
      this._target = {
        x: this.cx, y: this.cy, radius: this.r, alive: true, isCrate: true,
        takeHit: (hit) => prop.level.breakProp(prop, hit),
      };
    }
    return this._target;
  }

  draw(ctx, cam) {
    const p = cam.worldToScreen(this.x, this.y);
    const wob = this.shake ? Math.sin(this.shake * 60) * this.shake * 10 * cam.scale : 0;
    Sprites.draw(ctx, this.type, p.x + wob, p.y, this.def.scale * cam.scale, {
      alpha: this.fade, tint: '#ffffff', tintAmount: (this.flash || 0) * 6,
    });
  }

  screenBounds(cam) {
    const p = cam.worldToScreen(this.x, this.y);
    return Sprites.bounds(this.type, p.x, p.y, this.def.scale * cam.scale);
  }
}

/* ------------------------------ paletas de chão ------------------------------ */

const GROUND_STYLES = {
  village: { base: [92, 30, 33], path: [32, 32, 38], stone: [30, 6, 52], deco: 'grass' },
  sakura: { base: [96, 28, 36], path: [30, 30, 42], stone: [30, 6, 55], deco: 'petals' },
  forest: { base: [84, 34, 22], path: [34, 28, 30], stone: [30, 6, 45], deco: 'leaves' },
  camp: { base: [40, 22, 30], path: [30, 26, 24], stone: [25, 6, 44], deco: 'ash' },
  shrine: { base: [88, 22, 28], path: [30, 26, 34], stone: [30, 5, 50], deco: 'petals' },
};

const T_GRASS = 0, T_PATH = 1, T_STONE = 2;

function hash2(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Gerador pseudoaleatório com semente (o mesmo mapa toda vez). */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

class Level {
  constructor(stage) {
    this.stage = stage;
    this.W = stage.size[0];
    this.H = stage.size[1];
    this.style = GROUND_STYLES[stage.ground];
    this.tiles = new Uint8Array(this.W * this.H);
    this.props = [];

    // Caminho de terra e praças de pedra.
    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        const cx = i + 0.5, cy = j + 0.5;
        let t = T_GRASS;
        const pts = stage.path;
        for (let k = 0; k < pts.length - 1; k++) {
          const wob = (hash2(i, j) - 0.5) * 0.5;
          if (distToSegment(cx, cy, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]) < (stage.pathWidth || 1.3) + wob) t = T_PATH;
        }
        for (const pl of stage.plazas || []) {
          if (Math.hypot(cx - pl[0], cy - pl[1]) < pl[2]) t = T_STONE;
        }
        this.tiles[j * this.W + i] = t;
      }
    }

    for (const [type, x, y] of stage.props) this.props.push(new Prop(type, x, y));
    this.posts = []; // colisores invisíveis (pilares do torii)

    // Espalha vegetação aleatória (com semente) fora do caminho e longe das construções.
    if (stage.scatter) {
      const rnd = makeRng(stage.scatter.seed);
      let tries = 0, placed = 0;
      while (placed < stage.scatter.count && tries++ < 3000) {
        const x = 1 + rnd() * (this.W - 2), y = 1 + rnd() * (this.H - 2);
        const type = stage.scatter.types[Math.floor(rnd() * stage.scatter.types.length)];
        if (this.tileAt(x, y) !== T_GRASS) continue;
        if (this.nearPath(x, y, 2.4)) continue;
        if (this.props.some((p) => this.boxDist(p.box, x, y) < 1.4)) continue;
        if ((stage.clear || []).some((c) => Math.hypot(x - c[0], y - c[1]) < c[2])) continue;
        this.props.push(new Prop(type, x, y));
        placed++;
      }
    }

    // Vegetação baixa (arbustos, pedras, samambaias) espalhada pelo mapa.
    if (stage.decor !== 0) {
      const rnd = makeRng((stage.scatter ? stage.scatter.seed : 1) * 31 + 7);
      const types = ['bush_a', 'bush_big', 'bush_round', 'rock_moss', 'rock_big', 'rock_tall', 'rock_flat', 'fern', 'fern2', 'grass_tall', 'fern', 'grass_tall'];
      let placed = 0, tries = 0;
      const want = stage.decor || 26;
      while (placed < want && tries++ < 2000) {
        const x = 0.8 + rnd() * (this.W - 1.6), y = 0.8 + rnd() * (this.H - 1.6);
        if (this.tileAt(x, y) !== T_GRASS || this.nearPath(x, y, 1.9)) continue;
        if (this.props.some((p) => this.boxDist(p.box, x, y) < 1.0)) continue;
        if ((stage.clear || []).some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] * 0.75)) continue;
        if ((stage.waves || []).some((wv) => Math.hypot(x - wv.center[0], y - wv.center[1]) < 2.2)) continue;
        this.props.push(new Prop(types[Math.floor(rnd() * types.length)], x, y));
        placed++;
      }
    }

    for (const p of this.props) p.level = this;
    this.buildBorder(makeRng(this.W * 97 + this.H + (stage.scatter ? stage.scatter.seed : 0)));
    this.rebuildBlocked();
    this.flow = new Int16Array(this.W * this.H);
    this.flowTimer = 0;
  }

  /** Grade de bloqueio (para o campo de fluxo da IA). */
  rebuildBlocked() {
    this.blocked = new Uint8Array(this.W * this.H);
    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        const cx = i + 0.5, cy = j + 0.5;
        if (this.solids().some((p) => this.solidDist(p, cx, cy) < 0.3)) this.blocked[j * this.W + i] = 1;
      }
    }
  }

  /** Props que colidem (sem vegetação rasteira) + pilares invisíveis. */
  solids() {
    if (!this._solids) this._solids = [...this.props.filter((p) => p.def.solid !== 'none'), ...this.posts];
    return this._solids;
  }

  /** Acrescenta um objeto de cenário depois da criação (ex.: montagem dos acampamentos). */
  addProp(type, x, y) {
    const p = new Prop(type, x, y);
    p.level = this;
    this.props.push(p);
    this._solids = null;
    this.rebuildBlocked();
    return p;
  }

  addPost(x, y, r) {
    this.posts.push({ def: { solid: 'circle' }, x, y, cx: x, cy: y, r, box: { x0: x - r, y0: y - r, x1: x + r, y1: y + r } });
    this._solids = null;
    this.rebuildBlocked();
  }

  /**
   * Pontos "atrás" de casas e árvores grandes (lado norte/oeste, o mais longe
   * da câmera): quem fica ali some atrás do desenho da construção.
   */
  hideSpots(cx, cy, maxR) {
    const spots = [];
    for (const p of this.props) {
      const isBox = p.def.solid === 'box';
      const big = isBox ? (p.box.x1 - p.box.x0) * (p.box.y1 - p.box.y0) > 1.5 : p.def.solid === 'circle' && p.r >= 0.45;
      if (!big) continue;
      const cands = [];
      if (isBox) {
        const b = p.box;
        for (const t of [0.2, 0.5, 0.8]) {
          cands.push([b.x0 - 0.5, b.y0 + (b.y1 - b.y0) * t]);
          cands.push([b.x0 + (b.x1 - b.x0) * t, b.y0 - 0.5]);
        }
        cands.push([b.x0 - 0.45, b.y0 - 0.45]);
      } else {
        for (const da of [-0.7, 0, 0.7]) {
          const a = -Math.PI * 0.75 + da;
          cands.push([p.cx + Math.cos(a) * (p.r + 0.45), p.cy + Math.sin(a) * (p.r + 0.45)]);
        }
      }
      for (const [x, y] of cands) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < maxR && this.isFree(x, y, 0.32)) spots.push({ x, y, d });
      }
    }
    return spots.sort((u, v) => u.d - v.d);
  }

  /** Caixas quebráveis ainda inteiras, como alvos de combate. */
  breakableTargets() {
    return this.props.filter((p) => p.def.breakable && p.hp > 0).map((p) => p.target);
  }

  breakProp(prop, hit) {
    if (prop.hp <= 0) return false;
    prop.hp -= hit.damage;
    prop.flash = 0.1;
    prop.shake = 0.25;
    const w = this.world;
    w.effects.sparks(prop.cx, prop.cy, Math.atan2(hit.ny, hit.nx), 6, '#c89a5a');
    if (prop.hp <= 0) {
      prop.target.alive = false;
      this.props = this.props.filter((p) => p !== prop);
      this._solids = null;
      this.rebuildBlocked();
      w.effects.sparks(prop.cx, prop.cy, Math.atan2(hit.ny, hit.nx), 16, '#8a5a2b', 3);
      w.effects.smoke(prop.cx, prop.cy, 5, '150,120,80', 0.35);
      Sfx.hit(false);
      if (Math.random() < 0.4) w.pickups.push(new Pickup(w, prop.cx, prop.cy, 'onigiri'));
    }
    return false; // quebrar caixa não conta para o combo
  }

  /**
   * Mata densa em volta do mapa, para o mundo não terminar num "quadrado"
   * flutuando no preto. Do lado de trás (norte/oeste na tela) vão os bosques
   * altos; do lado da frente, vegetação mais baixa para não esconder a luta.
   */
  buildBorder(rnd) {
    this.border = [];
    const W = this.W, H = this.H, B = BORDER;
    for (let gy = -B; gy < H + B; gy += 2.6) {
      for (let gx = -B; gx < W + B; gx += 2.6) {
        const front = gx > W || gy > H;
        const nearFront = front && gx < W + 7 && gy < H + 7;
        const count = nearFront ? 3 : 1;
        for (let k = 0; k < count; k++) {
          const x = gx + rnd() * (nearFront ? 2.6 : 1.6), y = gy + rnd() * (nearFront ? 2.6 : 1.6);
          const list = nearFront ? BORDER_LOW : BORDER_FAR;
          const type = list[Math.floor(rnd() * list.length)];
          const p = new Prop(type, x, y);
          const b = p.box;
          // Precisa ficar inteiramente fora do mapa (com uma folga).
          if (!(b.x1 < -0.2 || b.y1 < -0.2 || b.x0 > W + 0.6 || b.y0 > H + 0.6)) continue;
          p.level = this;
          p.border = true;
          this.border.push(p);
        }
      }
    }
  }

  tileAt(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    return this.tiles[j * this.W + i];
  }

  nearPath(x, y, d) {
    const pts = this.stage.path;
    for (let k = 0; k < pts.length - 1; k++) {
      if (distToSegment(x, y, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]) < d) return true;
    }
    return false;
  }

  boxDist(b, x, y) {
    const cx = clamp(x, b.x0, b.x1), cy = clamp(y, b.y0, b.y1);
    return Math.hypot(x - cx, y - cy);
  }

  solidDist(p, x, y) {
    if (p.def.solid === 'none') return 99;
    return p.def.solid === 'box' ? this.boxDist(p.box, x, y) : Math.hypot(x - p.cx, y - p.cy) - p.r;
  }

  isFree(x, y, r) {
    if (x < r || y < r || x > this.W - r || y > this.H - r) return false;
    return !this.solids().some((p) => this.solidDist(p, x, y) < r + 0.1);
  }

  /** Empurra um círculo (ator) para fora dos colisores e dos limites do mapa. */
  resolveCircle(a) {
    for (const p of this.solids()) {
      if (p.def.solid === 'box') {
        const b = p.box;
        const cx = clamp(a.x, b.x0, b.x1), cy = clamp(a.y, b.y0, b.y1);
        let dx = a.x - cx, dy = a.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < a.radius) {
          if (d < 1e-4) {
            // Centro dentro da caixa: sai pela face mais próxima.
            const opts = [[a.x - b.x0, -1, 0], [b.x1 - a.x, 1, 0], [a.y - b.y0, 0, -1], [b.y1 - a.y, 0, 1]];
            opts.sort((u, v) => u[0] - v[0]);
            a.x += opts[0][1] * (opts[0][0] + a.radius);
            a.y += opts[0][2] * (opts[0][0] + a.radius);
          } else {
            a.x += (dx / d) * (a.radius - d);
            a.y += (dy / d) * (a.radius - d);
          }
        }
      } else {
        const dx = a.x - p.cx, dy = a.y - p.cy;
        const d = Math.hypot(dx, dy), min = a.radius + p.r;
        if (d < min && d > 1e-4) {
          a.x += (dx / d) * (min - d);
          a.y += (dy / d) * (min - d);
        }
      }
    }
    a.x = clamp(a.x, a.radius, this.W - a.radius);
    a.y = clamp(a.y, a.radius, this.H - a.radius);
  }

  /**
   * Campo de fluxo (BFS a partir do tile do jogador). Cada inimigo só precisa
   * olhar os vizinhos e andar para o de menor distância — contorna casas sem
   * pathfinding individual. Recalculado algumas vezes por segundo.
   */
  updateFlow(px, py, dt) {
    this.flowTimer -= dt;
    if (this.flowTimer > 0) return;
    this.flowTimer = 0.25;
    const W = this.W, H = this.H, f = this.flow;
    f.fill(-1);
    const si = clamp(Math.floor(px), 0, W - 1), sj = clamp(Math.floor(py), 0, H - 1);
    const q = new Int32Array(W * H);
    let head = 0, tail = 0;
    f[sj * W + si] = 0;
    q[tail++] = sj * W + si;
    while (head < tail) {
      const cur = q[head++];
      const ci = cur % W, cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const n = nj * W + ni;
          if (f[n] !== -1 || this.blocked[n]) continue;
          if (di && dj && (this.blocked[cj * W + ni] || this.blocked[nj * W + ci])) continue; // sem cortar quina
          f[n] = f[cur] + 1;
          q[tail++] = n;
        }
      }
    }
  }

  /** Direção (normalizada) que um ator em (x,y) deve seguir para chegar ao jogador. */
  flowDir(x, y) {
    const W = this.W, H = this.H;
    const i = clamp(Math.floor(x), 0, W - 1), j = clamp(Math.floor(y), 0, H - 1);
    let best = this.flow[j * W + i], bi = -1, bj = -1;
    if (best < 0) best = 1e9;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const v = this.flow[nj * W + ni];
        if (v >= 0 && v < best) { best = v; bi = ni; bj = nj; }
      }
    }
    if (bi < 0) return null;
    const dx = bi + 0.5 - x, dy = bj + 0.5 - y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  /** Ponto livre aleatório num anel em torno de (cx, cy). */
  randomFreeNear(cx, cy, rmin, rmax, avoid) {
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = rmin + Math.random() * (rmax - rmin);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (!this.isFree(x, y, 0.45)) continue;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < 3) continue;
      return { x, y };
    }
    return { x: clamp(cx, 1, this.W - 1), y: clamp(cy, 1, this.H - 1) };
  }

  /* ----------------------------------- chão ----------------------------------- */

  /**
   * Pinta o chão da fase UMA vez num canvas próprio (sem grade de losangos).
   * O truque: setTransform com a matriz isométrica — assim desenhamos em
   * coordenadas de MUNDO (retângulos, círculos, traços) e o canvas projeta
   * tudo em perspectiva sozinho. Desfoque (filter: blur) suaviza as bordas.
   */
  buildGround() {
    const W = this.W, H = this.H, HW = Iso.HW, HH = Iso.HH, B = BORDER + 2;
    const st = this.style;
    const ox = (H + 2 * B) * HW, oy = 2 * B * HH;
    const c = document.createElement('canvas');
    c.width = Math.ceil((W + H + 4 * B) * HW);
    c.height = Math.ceil((W + H + 4 * B) * HH);
    const g = c.getContext('2d');
    const hsl = (h, sat, l, a = 1) => `hsla(${h}, ${sat}%, ${l}%, ${a})`;
    const rnd = makeRng(W * 131 + H * 7 + (this.stage.scatter ? this.stage.scatter.seed : 3));

    g.fillStyle = hsl(95, 30, 9);
    g.fillRect(0, 0, c.width, c.height);
    g.setTransform(HW, HH, -HW, HH, ox, oy); // daqui em diante: unidades de MUNDO
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Mata ao redor: claridade diminuindo para longe do mapa.
    g.filter = 'blur(24px)';
    g.fillStyle = hsl(92, 30, 16);
    g.fillRect(-5, -5, W + 10, H + 10);
    g.filter = 'blur(12px)';
    g.fillStyle = hsl(92, 30, 20);
    g.fillRect(-1.5, -1.5, W + 3, H + 3);
    // Base do mapa com borda macia.
    g.filter = 'blur(8px)';
    g.fillStyle = hsl(st.base[0], st.base[1], st.base[2]);
    g.fillRect(-0.2, -0.2, W + 0.4, H + 0.4);
    g.filter = 'none';

    // Manchas de cor (variação orgânica do capim/terra).
    for (let k = 0; k < 170; k++) {
      const x = rnd() * W, y = rnd() * H, r = 1.2 + rnd() * 3.5;
      const dl = (rnd() - 0.5) * 12, dh = (rnd() - 0.5) * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hsl(st.base[0] + dh, st.base[1] + 4, st.base[2] + dl, 0.35));
      gr.addColorStop(1, hsl(st.base[0] + dh, st.base[1] + 4, st.base[2] + dl, 0));
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Caminho de terra: sombra desfocada + leito + faixa gasta no meio.
    const pw = (this.stage.pathWidth || 1.3) * 2;
    const path = () => {
      g.beginPath();
      this.stage.path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    };
    const P = st.path;
    g.filter = 'blur(6px)';
    path(); g.strokeStyle = hsl(P[0], P[1], P[2] - 6, 0.6); g.lineWidth = pw + 0.9; g.stroke();
    g.filter = 'blur(2px)';
    path(); g.strokeStyle = hsl(P[0], P[1], P[2]); g.lineWidth = pw; g.stroke();
    g.filter = 'blur(5px)';
    path(); g.strokeStyle = hsl(P[0], P[1] - 4, P[2] + 6, 0.5); g.lineWidth = pw * 0.4; g.stroke();
    g.filter = 'none';
    // pedrinhas e marcas de roda ao longo do caminho
    const pts = this.stage.path;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const len = Math.hypot(bx - ax, by - ay);
      for (let q = 0; q < len * 4; q++) {
        const t = rnd(), off = (rnd() - 0.5) * pw * 0.9;
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        const x = ax + (bx - ax) * t + nx * off, y = ay + (by - ay) * t + ny * off;
        g.fillStyle = hsl(P[0], 10, P[2] - 10 + rnd() * 18, 0.7);
        g.beginPath();
        g.arc(x, y, 0.03 + rnd() * 0.05, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Praças: lajes de pedra assentadas em fiadas desencontradas.
    const S = st.stone;
    for (const [cx, cy, r] of this.stage.plazas || []) {
      g.filter = 'blur(5px)';
      g.fillStyle = hsl(S[0], S[1], S[2] - 12, 0.7);
      g.beginPath(); g.arc(cx, cy, r + 0.3, 0, Math.PI * 2); g.fill();
      g.filter = 'none';
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
      g.fillStyle = hsl(S[0], S[1], S[2] - 14);
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      for (let y = cy - r, row = 0; y < cy + r; y += 0.72, row++) {
        for (let x = cx - r - (row % 2) * 0.5; x < cx + r; x += 1.0) {
          g.fillStyle = hsl(S[0] + (rnd() - 0.5) * 8, S[1], S[2] - 4 + rnd() * 9);
          g.fillRect(x + 0.04, y + 0.04, 0.92, 0.64);
        }
      }
      g.restore();
      // musgo nas bordas
      g.filter = 'blur(4px)';
      g.strokeStyle = hsl(st.base[0], st.base[1], st.base[2] + 2, 0.55);
      g.lineWidth = 0.35;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.filter = 'none';
    }

    this.groundCanvas = c;
    this.gOx = ox;
    this.gOy = oy;
  }

  drawGround(ctx, cam, time) {
    if (!this.groundCanvas) this.buildGround();
    const c = this.groundCanvas, s = cam.scale;
    const p0 = cam.worldToScreen(0, 0);
    const dx = p0.x - this.gOx * s, dy = p0.y - this.gOy * s;
    // Desenha só o pedaço visível do canvas do chão.
    const sx0 = Math.max(0, -dx / s), sy0 = Math.max(0, -dy / s);
    const sx1 = Math.min(c.width, (cam.viewW - dx) / s), sy1 = Math.min(c.height, (cam.viewH - dy) / s);
    if (sx1 > sx0 && sy1 > sy0) {
      ctx.drawImage(c, sx0, sy0, sx1 - sx0, sy1 - sy0, dx + sx0 * s, dy + sy0 * s, (sx1 - sx0) * s, (sy1 - sy0) * s);
    }
    // Detalhes animados (capim balançando, pétalas) por cima, só nos tiles visíveis.
    const m = Iso.HW * 2 * s, B = 4;
    for (let j = -B; j < this.H + B; j++) {
      for (let i = -B; i < this.W + B; i++) {
        const n = hash2(i, j);
        if (n <= 0.55) continue;
        const top = cam.worldToScreen(i, j);
        if (top.x < -m || top.x > cam.viewW + m || top.y < -m || top.y > cam.viewH + m) continue;
        const outside = i < 0 || j < 0 || i >= this.W || j >= this.H;
        if (outside) { if (n > 0.7) this.drawDeco(ctx, cam, i, j, n, 'leaves', time); continue; }
        if (this.tiles[j * this.W + i] === T_GRASS) this.drawDeco(ctx, cam, i, j, n, this.style.deco, time);
      }
    }
  }

  drawDeco(ctx, cam, i, j, n, deco, time) {
    const s = cam.scale;
    const c = cam.worldToScreen(i + 0.25 + n * 0.5, j + 0.3 + (1 - n) * 0.4);
    if (deco === 'grass' || deco === 'leaves') {
      ctx.strokeStyle = deco === 'grass' ? 'rgba(150,180,80,0.55)' : 'rgba(120,150,60,0.5)';
      ctx.lineWidth = 1 * s;
      const sway = Math.sin(time * 2 + i * 0.7 + j) * 1.2 * s;
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(c.x + k * 2.5 * s, c.y);
        ctx.lineTo(c.x + k * 3.5 * s + sway, c.y - (5 + n * 4) * s);
      }
      ctx.stroke();
    } else if (deco === 'petals') {
      ctx.fillStyle = 'rgba(255,170,200,0.75)';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(c.x + (k * 7 - 7) * s * n, c.y + (k % 2) * 3 * s, 1.8 * s, 1 * s, k, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (deco === 'ash') {
      ctx.fillStyle = 'rgba(30,25,22,0.45)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 6 * s * n, 3 * s * n, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* --------------------------- ordenação de profundidade --------------------------- */

/**
 * No isométrico, "quem está atrás" é decidido pelas caixas no chão (AABB no
 * mundo): se A termina antes de B começar em X ou em Y, A fica atrás.
 * Para caixas sobrepostas (dois personagens colados), usa o centro (x+y).
 * Resolvemos com uma ordenação topológica (DFS) — necessária porque casas
 * grandes quebram a ordenação simples por (x + y).
 */
function isBehind(a, b) {
  const A = a.box, B = b.box;
  const aBehindB = A.x1 <= B.x0 || A.y1 <= B.y0;
  const bBehindA = B.x1 <= A.x0 || B.y1 <= A.y0;
  if (aBehindB && !bBehindA) return true;
  if (bBehindA && !aBehindB) return false;
  return A.x0 + A.x1 + A.y0 + A.y1 < B.x0 + B.x1 + B.y0 + B.y1;
}

function depthSort(list) {
  list.sort((a, b) => (a.box.x0 + a.box.x1 + a.box.y0 + a.box.y1) - (b.box.x0 + b.box.x1 + b.box.y0 + b.box.y1));
  const out = [];
  const state = new Map();
  const visit = (n) => {
    if (state.has(n)) return;
    state.set(n, 1);
    for (const m of list) if (m !== n && !state.has(m) && isBehind(m, n)) visit(m);
    out.push(n);
  };
  for (const n of list) visit(n);
  return out;
}
