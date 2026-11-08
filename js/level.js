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
  house_tile: { scale: 0.78, solid: 'box', shrink: 0.8 },
  house_tile2: { scale: 0.78, solid: 'box', shrink: 0.86 },
  shrine: { scale: 0.85, solid: 'box', shrink: 0.75 },
  sakura: { scale: 0.85, solid: 'circle', r: 0.3 },
  bamboo: { scale: 0.85, solid: 'circle', r: 0.5 },
  lantern: { scale: 0.85, solid: 'circle', r: 0.22 },
  lantern2: { scale: 0.85, solid: 'circle', r: 0.22 },
  crate: { scale: 0.65, solid: 'box', shrink: 0.9 },
  crate_tied: { scale: 0.65, solid: 'box', shrink: 0.9 },
  crate_small: { scale: 0.65, solid: 'box', shrink: 0.9 },
  crate_mid: { scale: 0.65, solid: 'box', shrink: 0.9 },
};

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
    if (def.solid === 'box') {
      const left = (m.ax * def.scale) / Iso.HW;
      const right = ((m.w - m.ax) * def.scale) / Iso.HW;
      const fx = left * def.shrink, fy = right * def.shrink;
      this.box = { x0: x - fx, y0: y - fy, x1: x, y1: y };
    } else {
      this.r = def.r;
      this.box = { x0: x - def.r, y0: y - def.r, x1: x + def.r, y1: y + def.r };
    }
  }

  draw(ctx, cam) {
    const p = cam.worldToScreen(this.x, this.y);
    Sprites.draw(ctx, this.type, p.x, p.y, this.def.scale * cam.scale, { alpha: this.fade });
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

    // Grade de bloqueio (para o campo de fluxo da IA).
    this.blocked = new Uint8Array(this.W * this.H);
    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        const cx = i + 0.5, cy = j + 0.5;
        if (this.props.some((p) => this.solidDist(p, cx, cy) < 0.3)) this.blocked[j * this.W + i] = 1;
      }
    }
    this.flow = new Int16Array(this.W * this.H);
    this.flowTimer = 0;
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
    return p.def.solid === 'box' ? this.boxDist(p.box, x, y) : Math.hypot(x - p.x, y - p.y) - p.r;
  }

  isFree(x, y, r) {
    if (x < r || y < r || x > this.W - r || y > this.H - r) return false;
    return !this.props.some((p) => this.solidDist(p, x, y) < r + 0.1);
  }

  /** Empurra um círculo (ator) para fora dos colisores e dos limites do mapa. */
  resolveCircle(a) {
    for (const p of this.props) {
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
        const dx = a.x - p.x, dy = a.y - p.y;
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

  drawGround(ctx, cam, time) {
    const st = this.style;
    const s = cam.scale;
    // Culling: só os tiles cujo topo está na tela (com margem).
    const m = Iso.HW * 2 * s;
    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        const top = cam.worldToScreen(i, j);
        if (top.x < -m || top.x > cam.viewW + m || top.y < -m || top.y > cam.viewH + m) continue;
        const right = cam.worldToScreen(i + 1, j);
        const bottom = cam.worldToScreen(i + 1, j + 1);
        const left = cam.worldToScreen(i, j + 1);
        const t = this.tiles[j * this.W + i];
        const n = hash2(i, j);
        const hsl = t === T_PATH ? st.path : t === T_STONE ? st.stone : st.base;
        const edge = Math.min(i, j, this.W - 1 - i, this.H - 1 - j);
        const dark = edge < 2 ? (2 - edge) * 6 : 0; // escurece as bordas do mapa (vinheta)
        const l = hsl[2] - 4 + n * 7 + ((i + j) % 2 ? 0 : 2) - dark;
        ctx.fillStyle = `hsl(${hsl[0] + (n - 0.5) * 10}, ${hsl[1]}%, ${l}%)`;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(left.x, left.y);
        ctx.closePath();
        ctx.fill();
        if (t === T_STONE) {
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        // Decoração procedural barata (tufos, pétalas, folhas, cinzas).
        if (t === T_GRASS && n > 0.55) this.drawDeco(ctx, cam, i, j, n, st.deco, time);
        if (t === T_PATH && n < 0.18) {
          const c = cam.worldToScreen(i + 0.3 + n * 2, j + 0.6);
          ctx.fillStyle = 'rgba(60,45,30,0.5)';
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 2.5 * s, 1.3 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
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
