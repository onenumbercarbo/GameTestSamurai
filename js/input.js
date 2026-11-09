/**
 * input.js — Estado de teclado e mouse.
 *
 * Usamos `event.code` (tecla FÍSICA), então WASD funciona na mesma posição em
 * teclados ABNT2, AZERTY etc.
 *  - down:    teclas seguradas agora
 *  - pressed: teclas apertadas desde o último frame simulado (ações "de borda")
 *  - cliques de ataque vão para uma fila curta consumida pelo combo
 */
/** Estado global do modo toque (ativado no primeiro toque na tela). */
const TOUCH = { active: false };

/**
 * Controles de toque (celular):
 *  - metade esquerda da tela: joystick virtual que nasce onde o polegar toca;
 *  - botões à direita (CORTE, DASH, IAI, AGIR, pausa), posicionados pela UI
 *    a cada frame em `input.buttons`;
 *  - fora do jogo (menus, história), qualquer toque vale como "confirmar".
 */
class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.attackPresses = 0;
    this.heavyPresses = 0;
    this.mouseMovedAt = -1e9; // quando o mouse se mexeu pela última vez (ms)
    this.clicked = false; // clique para menus/telas
    this.lastTap = null;  // posição do último clique/toque (botões de menu)
    this.onFirstGesture = null;
    this.mode = 'menu';   // 'play' durante o jogo: toques viram joystick/botões
    this.buttons = [];    // botões de toque visíveis neste frame (definidos pela UI)
    this.viewW = 0;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.held = new Map(); // toque -> botão segurado

    const blocked = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'Tab']);
    const gesture = () => {
      if (this.onFirstGesture) {
        this.onFirstGesture();
        this.onFirstGesture = null;
      }
    };

    window.addEventListener('keydown', (e) => {
      if (blocked.has(e.code)) e.preventDefault();
      gesture();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    const setMouse = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
      this.mouseMovedAt = performance.now();
    };
    canvas.addEventListener('mousemove', setMouse);
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', (e) => {
      setMouse(e);
      gesture();
      if (e.button === 0) {
        this.attackPresses++;
        this.clicked = true;
        this.lastTap = { x: this.mouse.x, y: this.mouse.y };
      } else if (e.button === 2) {
        this.heavyPresses++;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- Toque ----
    const pos = (t) => {
      const r = canvas.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const opts = { passive: false };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault(); // evita zoom, rolagem e o "clique fantasma" do mouse
      TOUCH.active = true;
      gesture();
      for (const t of e.changedTouches) {
        const p = pos(t);
        this.touchStart(t.identifier, p.x, p.y);
      }
    }, opts);
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          const p = pos(t);
          this.stick.x = p.x;
          this.stick.y = p.y;
        }
      }
    }, opts);
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) this.stick.id = null;
        this.held.delete(t.identifier);
      }
    };
    canvas.addEventListener('touchend', end, opts);
    canvas.addEventListener('touchcancel', end, opts);
  }

  touchStart(id, x, y) {
    this.lastTap = { x, y };
    if (this.mode !== 'play') {
      this.clicked = true;
      return;
    }
    const b = this.buttons.find((bt) => Math.hypot(x - bt.x, y - bt.y) < bt.r * 1.25);
    if (b) {
      this.press(b.id);
      this.held.set(id, { id: b.id, t: 0 });
      return;
    }
    if (x < this.viewW * 0.55 && this.stick.id === null) {
      this.stick = { id, ox: x, oy: y, x, y };
    }
  }

  press(id) {
    if (id === 'attack') this.attackPresses++;
    else if (id === 'dash') this.pressed.add('Space');
    else if (id === 'heavy') this.heavyPresses++;
    else if (id === 'act') this.pressed.add('KeyE');
    else if (id === 'pause') this.pressed.add('Escape');
  }

  /** Segurar CORTE repete o golpe (combo contínuo sem precisar martelar a tela). */
  updateTouch(dt) {
    for (const h of this.held.values()) {
      if (h.id !== 'attack') continue;
      h.t += dt;
      if (h.t > 0.26) {
        h.t = 0.06;
        this.attackPresses = Math.max(this.attackPresses, 1);
      }
    }
    if (this.mode !== 'play') this.stick.id = null;
  }

  /** Raio do joystick em px. */
  get stickRadius() {
    return 56;
  }

  /** Direção do joystick em espaço de TELA ({x, y, mag}) ou null se solto. */
  stickVec() {
    if (this.stick.id === null) return null;
    const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
    const d = Math.hypot(dx, dy);
    const mag = Math.min(1, d / this.stickRadius);
    if (mag < 0.18) return { x: 0, y: 0, mag: 0 };
    return { x: dx / d, y: dy / d, mag };
  }

  /** Clique/toque dentro de um retângulo de botão de menu? */
  tapIn(r) {
    return this.clicked && this.lastTap && this.lastTap.x >= r.x && this.lastTap.x <= r.x + r.w && this.lastTap.y >= r.y && this.lastTap.y <= r.y + r.h;
  }

  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  consumeAttack() {
    if (this.attackPresses > 0) {
      this.attackPresses--;
      return true;
    }
    return false;
  }

  consumeHeavy() {
    if (this.heavyPresses > 0) {
      this.heavyPresses = 0;
      return true;
    }
    return false;
  }

  /** O jogador está usando o mouse agora (mexeu nos últimos 1,5 s)? */
  get mouseActive() {
    return performance.now() - this.mouseMovedAt < 1500;
  }

  /** Confirmar em menus: Enter, Espaço ou clique. */
  consumeConfirm() {
    const ok = this.wasPressed('Enter', 'NumpadEnter', 'Space') || this.clicked;
    if (ok) this.flush();
    return ok;
  }

  /** Descarta entradas pendentes (ex.: o clique que fechou um menu não vira golpe). */
  flush() {
    this.pressed.clear();
    this.attackPresses = 0;
    this.heavyPresses = 0;
    this.clicked = false;
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.attackPresses = Math.min(this.attackPresses, 1);
    this.heavyPresses = Math.min(this.heavyPresses, 1);
  }
}
