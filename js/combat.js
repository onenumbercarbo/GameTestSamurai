/**
 * combat.js — Sistema de combo (hack and slash).
 *
 * ============================ COMO FUNCIONA HOJE ============================
 *
 * Um combo é uma LISTA DE GOLPES (COMBO_CHAIN). Cada golpe é puro dado:
 * ângulo do arco, alcance, dano, janelas de tempo, knockback, hit-stop...
 * O ComboSystem é uma pequena máquina de estados que percorre essa lista:
 *
 *   [ocioso] --clique--> [golpe 1] --clique na janela--> [golpe 2] --> [golpe 3 / finalizador]
 *       ^                    |                                |
 *       +---- comboWindow expirou / dash cancelou ------------+
 *
 * Linha do tempo de UM golpe (t em segundos desde o início):
 *
 *   0 ── activeStart ════ activeEnd ── chainFrom ──────────── duration
 *   │  wind-up   │  HITBOX ATIVA  │      (pode encadear)       │ fim
 *
 *  - activeStart/activeEnd: "frames ativos". Só nesse intervalo o golpe acerta.
 *  - chainFrom: a partir daqui, um clique (ou um clique bufferizado antes)
 *    inicia imediatamente o próximo golpe — é o "cancel" que dá fluidez.
 *  - duration: se ninguém clicou, o golpe termina e abre a comboWindow:
 *    se o jogador clicar dentro dela, continua de onde parou; senão, volta ao 1.
 *  - INPUT_BUFFER: cliques feitos ANTES de chainFrom ficam guardados por um
 *    tempo — o jogador não precisa ter timing perfeito (truque central do
 *    "feel" de God of War / DMC).
 *
 * Ataques em ÁREA: cada golpe testa TODOS os alvos contra um setor circular
 * (distância <= alcance E ângulo dentro do arco). Um Set por golpe garante
 * que cada inimigo leva no máximo um hit por swing, mas vários inimigos podem
 * ser atingidos no mesmo corte.
 *
 * ======================== COMO VAMOS EXPANDIR ========================
 *
 * 1. ÁRVORE DE COMBOS em vez de lista: cada golpe terá `next: { light: id,
 *    heavy: id, dashAttack: id }`. Ex.: L-L-H = lançador, L-L-L = giro.
 *    O ComboSystem passa a guardar um "nó atual" em vez de um índice.
 * 2. Tipos de input: botão direito (pesado), segurar (carregado), ataque
 *    após dash, ataque aéreo (com Z do Iso.toScreen já pronto para pulos).
 * 3. Hitboxes por golpe além do setor: retângulo de estocada (tsuki), círculo
 *    ao redor (giro), projétil (onda de vento de iaijutsu).
 * 4. Propriedades de reação: `launch` (joga para o ar), `stagger`, `armorBreak`,
 *    `guardBreak`. Os inimigos lerão isso no takeHit().
 * 5. Medidor de estilo/contador de hits (GoW: hits sem tomar dano => bônus).
 * 6. Animações: cada golpe referencia uma faixa da spritesheet e os
 *    activeStart/End passam a ser derivados dos frames da animação.
 * 7. Dados em JSON externo para designers ajustarem sem tocar no código.
 */

const COMBO_CHAIN = [
  {
    name: 'Kesa-giri',          // corte diagonal descendente
    arcDeg: 150, sweep: 1,      // sweep: 1 = sentido horário, -1 = anti-horário
    range: 1.9, thickness: 0.6, // alcance e "largura" visual da fita do arco (tiles)
    damage: 12, knockback: 3.5,
    lunge: 3.2,                 // impulso para frente ao golpear (tiles/s)
    moveMul: 0.3,               // fração da velocidade de andar durante o golpe
    activeStart: 0.03, activeEnd: 0.13, chainFrom: 0.11, duration: 0.3,
    comboWindow: 0.32,
    hitStop: 0.045, shake: 3,
    color: [255, 225, 205],
  },
  {
    name: 'Gyaku-kesa',         // corte de volta, sentido inverso
    arcDeg: 160, sweep: -1,
    range: 2.0, thickness: 0.65,
    damage: 14, knockback: 4,
    lunge: 3.6, moveMul: 0.3,
    activeStart: 0.03, activeEnd: 0.13, chainFrom: 0.12, duration: 0.32,
    comboWindow: 0.32,
    hitStop: 0.05, shake: 4,
    color: [255, 205, 185],
  },
  {
    name: 'Enten-giri',         // finalizador: giro completo de 360°
    arcDeg: 360, sweep: 1,
    range: 2.5, thickness: 0.9,
    damage: 26, knockback: 9,
    lunge: 5, moveMul: 0.15,
    activeStart: 0.07, activeEnd: 0.26, chainFrom: Infinity, duration: 0.5,
    comboWindow: 0,
    hitStop: 0.1, shake: 10,
    color: [255, 95, 80],
  },
];

class ComboSystem {
  constructor(chain) {
    this.chain = chain;
    this.step = -1;        // índice do último golpe executado
    this.current = null;   // { def, t, aim, hits:Set }
    this.buffer = 0;       // tempo restante do clique bufferizado
    this.windowLeft = 0;   // tempo restante para continuar o combo após um golpe
  }

  get attacking() {
    return this.current !== null;
  }

  /** Registra intenção de atacar (vem do clique). */
  request() {
    this.buffer = CONFIG.INPUT_BUFFER;
  }

  /** Dash cancela o golpe atual e reinicia o combo. */
  cancel() {
    this.current = null;
    this.step = -1;
    this.windowLeft = 0;
  }

  /** Ângulo atual da lâmina (para o desenho da katana), ou null se ocioso. */
  bladeAngle() {
    if (!this.current) return null;
    return swingAngleAt(this.current.def, this.current.aim, this.current.t);
  }

  update(dt, owner, targets, world) {
    if (this.buffer > 0) this.buffer -= dt;

    if (this.current) {
      const c = this.current;
      c.t += dt;

      if (c.t >= c.def.activeStart && c.t <= c.def.activeEnd + dt) {
        this._resolveHits(c, owner, targets, world);
      }

      const canChain = this.step < this.chain.length - 1 && c.t >= c.def.chainFrom;
      if (this.buffer > 0 && canChain) {
        this._start(this.step + 1, owner, world);
      } else if (c.t >= c.def.duration) {
        this.current = null;
        this.windowLeft = c.def.comboWindow;
      }
      return;
    }

    // Ocioso: a janela de combo vai expirando.
    if (this.windowLeft > 0) {
      this.windowLeft -= dt;
      if (this.windowLeft <= 0) this.step = -1;
    }

    if (this.buffer > 0) {
      const continues = this.windowLeft > 0 && this.step < this.chain.length - 1;
      this._start(continues ? this.step + 1 : 0, owner, world);
    }
  }

  _start(index, owner, world) {
    const def = this.chain[index];
    this.step = index;
    this.buffer = 0;
    this.windowLeft = 0;
    // A mira é "travada" no início do golpe: o arco sai na direção do cursor
    // daquele instante, mesmo que o mouse se mova durante o swing.
    this.current = { def, t: 0, aim: owner.aimAngle, hits: new Set() };
    owner.onAttackStart(def, this.current.aim);
    world.effects.spawnSlash(owner, this.current.aim, def);
  }

  /** Teste de área: setor circular centrado no dono. Atinge vários alvos. */
  _resolveHits(c, owner, targets, world) {
    const def = c.def;
    const halfArc = (def.arcDeg * Math.PI) / 360;
    let landed = 0;

    for (const t of targets) {
      if (!t.alive || c.hits.has(t)) continue;
      const dx = t.x - owner.x;
      const dy = t.y - owner.y;
      const dist = Math.hypot(dx, dy);
      if (dist > def.range + t.radius) continue;

      if (def.arcDeg < 360 && dist > 0.001) {
        // Tolerância angular proporcional ao tamanho do alvo: um inimigo
        // grande "de raspão" na borda do arco ainda é atingido.
        const tolerance = Math.atan2(t.radius, dist);
        if (Math.abs(angleDiff(Math.atan2(dy, dx), c.aim)) > halfArc + tolerance) continue;
      }

      const nx = dist > 0.001 ? dx / dist : Math.cos(c.aim);
      const ny = dist > 0.001 ? dy / dist : Math.sin(c.aim);
      t.takeHit(def.damage, nx, ny, def.knockback);
      c.hits.add(t);
      landed++;

      const finisher = this.step === this.chain.length - 1;
      world.effects.spawnSparks(t.x, t.y, Math.atan2(ny, nx), finisher ? 16 : 9,
        finisher ? '#ff6a50' : '#ffe6c8');
      world.effects.spawnText(t.x, t.y, String(def.damage), finisher ? '#ff6a50' : '#fff3e0', finisher);
    }

    if (landed > 0) {
      // Hit-stop: congela a simulação por alguns ms. Pequeno, mas é o que dá
      // "peso" ao impacto. Mais alvos => um pouquinho mais de pausa.
      world.hitStop = Math.max(world.hitStop, def.hitStop + Math.min(landed - 1, 3) * 0.01);
      world.camera.shake(def.shake + landed * 0.5);
      world.comboHits += landed;
      world.comboTimer = 1.6;
    }
  }
}
