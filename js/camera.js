/**
 * camera.js — Câmera cinematográfica.
 *
 * Em vez de grudar no jogador, a câmera persegue um ALVO (foco + zoom) que é
 * escolhido a cada frame pelo "diretor" (CameraDirector em main.js) a partir
 * de PLANOS PRÉ-DEFINIDOS:
 *
 *   - Exploração: plano fechado, câmera "pesada" que enquadra à frente do Rōnin.
 *   - Arena (ondas de inimigos): plano FIXO no centro da arena, mais aberto.
 *   - Boss: plano de duelo que enquadra os dois lutadores.
 *   - Cutscene: sequência roteirizada (plano de estabelecimento, apresentação do boss).
 *   - Planos autorais por área (stage.shots): ex. vista do santuário.
 *
 * Como a arte é isométrica fixa (sprites pré-desenhados), "ângulo" aqui é
 * enquadramento + zoom + posição; girar a câmera exigiria sprites em várias vistas.
 *
 * A posição (x, y) da câmera é guardada em pixels isométricos com zoom 1,
 * e a conversão final de um ponto do mundo é:
 *
 *   tela = (Iso.toScreen(mundo) - camera) * zoom + centroDaViewport + shake
 */
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = CONFIG.CAMERA.exploreZoom;
    this.tx = 0;
    this.ty = 0;
    this.tzoom = this.zoom;
    this.rate = 4;           // velocidade de aproximação do alvo (maior = corte mais seco)
    this.punch = 0;          // "zoom punch" momentâneo em impactos fortes
    this.viewW = 0;
    this.viewH = 0;
    this.trauma = 0;
    this.offX = 0;
    this.offY = 0;
    this.letterbox = 0;      // 0..1 — faixas pretas de cinema
    this.letterboxTarget = 0;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  /** Escala efetiva (zoom × punch), usada para dimensionar sprites e traços. */
  get scale() {
    return this.zoom * (1 + this.punch);
  }

  /** Ajuste do zoom ao tamanho da janela: telas pequenas veem um pouco mais. */
  get fit() {
    return clamp(Math.min(this.viewW / 1280, this.viewH / 760), 0.6, 1.25);
  }

  /** Define o alvo da câmera em coordenadas de MUNDO. */
  setTarget(wx, wy, zoom, rate = 4) {
    const p = Iso.toScreen(wx, wy);
    this.tx = p.x;
    this.ty = p.y;
    this.tzoom = zoom * this.fit;
    this.rate = rate;
  }

  /** Corte seco para o alvo atual. */
  cut() {
    this.x = this.tx;
    this.y = this.ty;
    this.zoom = this.tzoom;
  }

  shake(amount) {
    this.trauma = Math.max(this.trauma, amount);
  }

  zoomPunch(amount) {
    this.punch = Math.max(this.punch, amount);
  }

  update(dt, realDt) {
    this.x = damp(this.x, this.tx, this.rate, dt);
    this.y = damp(this.y, this.ty, this.rate, dt);
    this.zoom = damp(this.zoom, this.tzoom, this.rate * 0.8, dt);
    this.letterbox = damp(this.letterbox, this.letterboxTarget, 5, realDt);
    this.punch *= Math.exp(-10 * realDt);
    // O shake usa o dt real: continua tremendo durante o hit-stop.
    this.trauma *= Math.exp(-13 * realDt);
    if (this.trauma < 0.05) this.trauma = 0;
    this.offX = (Math.random() * 2 - 1) * this.trauma;
    this.offY = (Math.random() * 2 - 1) * this.trauma;
  }

  /**
   * Garante que um ponto do mundo fique dentro da "área segura" da tela.
   * É isso que permite planos fixos sem nunca perder o jogador de vista.
   */
  keepInFrame(wx, wy, frac) {
    const p = Iso.toScreen(wx, wy);
    const z = this.scale;
    const limX = (this.viewW * frac) / z;
    const limY = (this.viewH * frac) / z;
    const upY = (this.viewH * frac) / z + 50; // o corpo do sprite sobe acima dos pés
    if (p.x - this.x > limX) this.x = p.x - limX;
    if (this.x - p.x > limX) this.x = p.x + limX;
    if (p.y - this.y > limY) this.y = p.y - limY;
    if (this.y - p.y > upY) this.y = p.y + upY;
  }

  worldToScreen(wx, wy, wz = 0) {
    const p = Iso.toScreen(wx, wy, wz);
    const z = this.scale;
    return {
      x: (p.x - this.x) * z + this.viewW / 2 + this.offX,
      y: (p.y - this.y) * z + this.viewH / 2 + this.offY,
    };
  }

  screenToWorld(sx, sy) {
    const z = this.scale;
    return Iso.toWorld(
      (sx - this.viewW / 2 - this.offX) / z + this.x,
      (sy - this.viewH / 2 - this.offY) / z + this.y
    );
  }
}
