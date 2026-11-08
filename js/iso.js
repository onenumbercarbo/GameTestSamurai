/**
 * iso.js — Matemática da projeção isométrica.
 *
 * ================== CARTESIANO  ->  ISOMÉTRICO ==================
 *
 * Toda a lógica do jogo vive num plano cartesiano "visto de cima":
 *
 *        +x  →
 *     +y ┌────────┐
 *      ↓ │ mundo  │   (x, y) em tiles
 *        └────────┘
 *
 * Para exibir em isométrico, giramos esse plano 45° e o "achatamos" pela
 * metade na vertical. Os eixos do mundo viram as diagonais da tela:
 *
 *              (0,0)
 *              /  \
 *        +y  ↙      ↘  +x
 *            \      /
 *              \  /
 *
 *  - Andar +1 em X no mundo  => na tela: +TILE_W/2 para a direita, +TILE_H/2 para baixo
 *  - Andar +1 em Y no mundo  => na tela: -TILE_W/2 (esquerda),      +TILE_H/2 para baixo
 *
 * Somando as duas contribuições obtemos a fórmula:
 *
 *      screenX = (worldX - worldY) * (TILE_W / 2)
 *      screenY = (worldX + worldY) * (TILE_H / 2) - worldZ
 *
 * Em forma de matriz:   [sx]   [ hw  -hw ] [wx]
 *                       [sy] = [ hh   hh ] [wy]      (hw = TILE_W/2, hh = TILE_H/2)
 *
 * worldZ (altura, em pixels) apenas "levanta" o desenho na tela — usado para
 * pulos, projéteis, a altura do arco da espada, partículas etc.
 *
 * ================== ISOMÉTRICO  ->  CARTESIANO ==================
 *
 * Para saber onde o MOUSE está no mundo (mira!), invertemos a matriz 2x2.
 * Determinante = hw*hh - (-hw*hh) = 2*hw*hh, logo:
 *
 *      worldX = (screenX / hw + screenY / hh) / 2
 *      worldY = (screenY / hh - screenX / hw) / 2
 *
 * (Isso assume Z = 0, ou seja, o ponto clicado está no chão — o que é
 *  exatamente o que queremos para mirar.)
 *
 * Como o determinante é positivo, a projeção preserva a orientação: um ângulo
 * crescente no mundo continua girando no mesmo sentido (horário) na tela.
 * Assim podemos calcular ângulos de golpes no mundo e eles "batem" com o visual.
 */
const Iso = (() => {
  const HW = CONFIG.TILE_W / 2;
  const HH = CONFIG.TILE_H / 2;

  /** Mundo (tiles) -> Tela (px), relativo à origem do mundo. */
  function toScreen(wx, wy, wz = 0) {
    return {
      x: (wx - wy) * HW,
      y: (wx + wy) * HH - wz,
    };
  }

  /** Tela (px, relativa à origem do mundo) -> Mundo (tiles), no plano Z = 0. */
  function toWorld(sx, sy) {
    return {
      x: (sx / HW + sy / HH) / 2,
      y: (sy / HH - sx / HW) / 2,
    };
  }

  /**
   * Converte uma DIREÇÃO de input dada em espaço de tela para o mundo.
   *
   * O jogador pensa em "W = para cima NA TELA". Mas "cima na tela" no mundo
   * cartesiano é a diagonal (-1, -1). Se aplicássemos WASD direto aos eixos
   * do mundo, W andaria para a diagonal superior-direita — sensação horrível.
   *
   * Então: pegamos o vetor de tela (ex.: W+D = (1,-1)), passamos pela matriz
   * inversa (só a parte linear, sem translação) e normalizamos no mundo, para
   * que andar na diagonal não seja mais rápido que andar reto.
   *
   *   W  (0,-1) -> mundo (-1,-1)/√2      (sobe na tela)
   *   D  (1, 0) -> mundo ( 1,-1)/√2      (direita na tela)
   *   W+D       -> mundo ( 0,-1)         (exatamente ao longo de um eixo do grid)
   *
   * Observação de feel: como a projeção achata Y pela metade, andar na
   * vertical da tela percorre menos pixels por segundo que na horizontal,
   * mesmo com a mesma velocidade no mundo. Isso é fiel à perspectiva (é o que
   * Diablo faz). Se quisermos velocidade constante EM PIXELS (estilo Hades),
   * basta escalar o vetor pelo inverso do comprimento projetado.
   */
  function screenDirToWorld(dx, dy) {
    if (dx === 0 && dy === 0) return { x: 0, y: 0 };
    const w = toWorld(dx, dy);
    const len = Math.hypot(w.x, w.y);
    return { x: w.x / len, y: w.y / len };
  }

  return { HW, HH, toScreen, toWorld, screenDirToWorld };
})();

/* --------------------------- utilidades de ângulo --------------------------- */

/** Diferença angular normalizada para o intervalo (-PI, PI]. */
function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Interpolação exponencial independente de framerate. */
function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
