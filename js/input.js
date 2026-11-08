/**
 * input.js — Estado de teclado e mouse.
 *
 * Usamos `event.code` (tecla FÍSICA), então WASD funciona na mesma posição em
 * teclados ABNT2, AZERTY etc.
 *  - down:    teclas seguradas agora
 *  - pressed: teclas apertadas desde o último frame simulado (ações "de borda")
 *  - cliques de ataque vão para uma fila curta consumida pelo combo
 */
class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.attackPresses = 0;
    this.clicked = false; // clique para menus/telas
    this.onFirstGesture = null;

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
    };
    canvas.addEventListener('mousemove', setMouse);
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', (e) => {
      setMouse(e);
      gesture();
      if (e.button === 0) {
        this.attackPresses++;
        this.clicked = true;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
    this.clicked = false;
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.attackPresses = Math.min(this.attackPresses, 1);
  }
}
