/**
 * input.js — Estado de teclado e mouse.
 *
 * Usamos `event.code` (tecla FÍSICA) em vez de `event.key`, então WASD funciona
 * na mesma posição em teclados ABNT2, AZERTY, Dvorak etc.
 *
 * - down:    teclas seguradas agora.
 * - pressed: teclas que foram pressionadas desde o último frame simulado
 *            (para ações "de borda", como dash).
 * - Cliques de ataque vão para uma pequena FILA; o sistema de combo consome.
 *   Isso evita perder cliques rápidos que caem entre dois frames.
 */
class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.attackPresses = 0;
    this.debugToggled = false;

    const blocked = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3']);

    window.addEventListener('keydown', (e) => {
      if (blocked.has(e.code)) e.preventDefault();
      if (e.code === 'F3' && !e.repeat) this.debugToggled = true;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });

    window.addEventListener('keyup', (e) => this.down.delete(e.code));

    // Se a janela perde o foco com uma tecla segurada, o keyup nunca chega.
    window.addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.attackPresses++;
      // Botão direito reservado para golpe pesado / defesa no futuro.
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Retorna true (e consome) se houve ao menos um clique de ataque pendente. */
  consumeAttack() {
    if (this.attackPresses > 0) {
      this.attackPresses--;
      return true;
    }
    return false;
  }

  consumeDebugToggle() {
    const t = this.debugToggled;
    this.debugToggled = false;
    return t;
  }

  /** Chamado ao fim de cada frame SIMULADO (não durante hit-stop). */
  endFrame() {
    this.pressed.clear();
    // Limita a fila para que "spam" de cliques não gere 10 golpes atrasados.
    this.attackPresses = Math.min(this.attackPresses, 1);
  }
}
