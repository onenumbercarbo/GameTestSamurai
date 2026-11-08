/**
 * camera.js — Câmera que segue o jogador + screen shake.
 *
 * A câmera guarda sua posição JÁ EM ESPAÇO DE TELA isométrico (pixels).
 * Assim a conversão final de qualquer ponto é:
 *
 *   canvasPos = Iso.toScreen(mundo) - camera + centroDaViewport + shake
 *
 * E o caminho inverso (mouse -> mundo) desfaz exatamente esses passos.
 */
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.viewW = 0;
    this.viewH = 0;
    this.trauma = 0; // intensidade do shake em pixels, decai com o tempo
    this.offX = 0;
    this.offY = 0;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  /** Centraliza instantaneamente (usado no início do jogo). */
  snapTo(wx, wy) {
    const p = Iso.toScreen(wx, wy);
    this.x = p.x;
    this.y = p.y;
  }

  /** Segue suavemente um ponto do mundo (lerp exponencial). */
  follow(wx, wy, dt) {
    const p = Iso.toScreen(wx, wy);
    this.x = damp(this.x, p.x, 9, dt);
    this.y = damp(this.y, p.y, 9, dt);
  }

  shake(amount) {
    this.trauma = Math.max(this.trauma, amount);
  }

  /** O shake usa o dt REAL, para continuar tremendo mesmo durante o hit-stop. */
  updateShake(dt) {
    this.trauma *= Math.exp(-14 * dt);
    if (this.trauma < 0.05) this.trauma = 0;
    this.offX = (Math.random() * 2 - 1) * this.trauma;
    this.offY = (Math.random() * 2 - 1) * this.trauma;
  }

  worldToScreen(wx, wy, wz = 0) {
    const p = Iso.toScreen(wx, wy, wz);
    return {
      x: p.x - this.x + this.viewW / 2 + this.offX,
      y: p.y - this.y + this.viewH / 2 + this.offY,
    };
  }

  screenToWorld(sx, sy) {
    return Iso.toWorld(
      sx - this.viewW / 2 + this.x - this.offX,
      sy - this.viewH / 2 + this.y - this.offY
    );
  }
}
