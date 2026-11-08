/**
 * combat.js — Sistema de combo do Rōnin e utilidades de acerto em área.
 *
 * ============================ COMO FUNCIONA ============================
 *
 * Um combo é uma lista de GOLPES descritos como dados (COMBO_CHAIN). Cada
 * golpe define arco, alcance, dano, janelas de tempo, knockback, hit-stop e
 * quais quadros do sprite mostrar. O ComboSystem é uma máquina de estados:
 *
 *   [ocioso] --clique--> [golpe 1] --clique na janela--> [golpe 2] --> [golpe 3 / giro final]
 *       ^                    |                                |
 *       +---- comboWindow expirou / dash cancelou ------------+
 *
 *   ataque logo após um dash  -->  [Investida (DASH_ATTACK)]  (ramo da "árvore")
 *
 * Linha do tempo de UM golpe:
 *
 *   0 ── activeStart ════ activeEnd ── chainFrom ──────────── duration
 *   │  preparação │  HITBOX ATIVA  │      (pode encadear)       │ fim
 *
 *  - INPUT_BUFFER: um clique um pouco antes de chainFrom fica guardado e é
 *    executado assim que possível — o segredo da fluidez estilo God of War.
 *  - Cada golpe testa TODOS os alvos contra um setor circular; um Set por
 *    golpe garante 1 acerto por alvo por swing (mas vários alvos por swing).
 *
 * ======================== COMO VAMOS EXPANDIR ========================
 *
 * 1. Árvore completa: cada golpe ganha `next: { light, heavy, dash }` e o
 *    sistema guarda o nó atual em vez de um índice (o DASH_ATTACK já é um ramo).
 * 2. Botão direito = golpe pesado/carregado (ex.: iaijutsu com tempo de carga).
 * 3. Hitboxes específicas: estocada (retângulo), projétil de vento, área no chão.
 * 4. Reações: `launch` (lança ao ar usando o Z da projeção), `guardBreak`.
 * 5. Medidor de estilo e especiais que gastam medidor.
 * 6. Golpes carregados de JSON para designers ajustarem sem tocar no código.
 */

const COMBO_CHAIN = [
  {
    name: 'Kesa-giri',
    arcDeg: 150, sweep: 1, range: 1.9, thickness: 0.6,
    damage: 12, knockback: 3.5, stun: 0.3, poise: 10,
    lunge: 3.2, moveMul: 0.3,
    activeStart: 0.05, activeEnd: 0.14, chainFrom: 0.13, duration: 0.32, comboWindow: 0.32,
    hitStop: 0.045, shake: 3,
    color: [255, 225, 205],
    frames: [[0, 'hero_draw'], [0.06, 'hero_slash1'], [0.22, 'hero_stance']],
  },
  {
    name: 'Gyaku-kesa',
    arcDeg: 160, sweep: -1, range: 2.0, thickness: 0.65,
    damage: 14, knockback: 4, stun: 0.3, poise: 12,
    lunge: 3.6, moveMul: 0.3,
    activeStart: 0.04, activeEnd: 0.13, chainFrom: 0.13, duration: 0.34, comboWindow: 0.32,
    hitStop: 0.05, shake: 4,
    color: [255, 205, 185],
    frames: [[0, 'hero_stance'], [0.05, 'hero_slash2'], [0.24, 'hero_stance']],
  },
  {
    name: 'Enten-giri',
    arcDeg: 360, sweep: 1, range: 2.5, thickness: 0.9,
    damage: 26, knockback: 9, stun: 0.6, poise: 30, finisher: true,
    lunge: 5, moveMul: 0.15,
    activeStart: 0.07, activeEnd: 0.26, chainFrom: Infinity, duration: 0.5, comboWindow: 0,
    hitStop: 0.1, shake: 10,
    color: [255, 95, 80],
    // Giro: alterna quadros e espelha o sprite para simular a rotação.
    frames: [[0, 'hero_dash'], [0.07, 'hero_slash1'], [0.13, 'hero_slash2', true], [0.19, 'hero_slash1', true], [0.25, 'hero_slash2'], [0.36, 'hero_stance']],
  },
];

/** Ramo da árvore de combos: atacar logo após o dash. */
const DASH_ATTACK = {
  name: 'Tsuki-ugachi',
  arcDeg: 90, sweep: 1, range: 2.6, thickness: 0.5,
  damage: 18, knockback: 7, stun: 0.45, poise: 18,
  lunge: 11, moveMul: 0,
  activeStart: 0.03, activeEnd: 0.16, chainFrom: 0.2, duration: 0.36, comboWindow: 0.3,
  hitStop: 0.07, shake: 6, nextStep: 1, // continua o combo a partir do golpe 2
  color: [255, 240, 230],
  frames: [[0, 'hero_dash'], [0.08, 'hero_slash1'], [0.26, 'hero_stance']],
};

/**
 * Testa um setor circular contra uma lista de alvos e aplica o golpe.
 * Usado pelo jogador, pelos ninjas e pelo boss.
 * Retorna quantos alvos foram atingidos.
 */
function hitSector(ox, oy, aim, range, arcDeg, targets, already, hit) {
  const halfArc = (arcDeg * Math.PI) / 360;
  let landed = 0;
  for (const t of targets) {
    if (!t.alive || already.has(t)) continue;
    const dx = t.x - ox, dy = t.y - oy;
    const dist = Math.hypot(dx, dy);
    if (dist > range + t.radius) continue;
    if (arcDeg < 360 && dist > 0.001) {
      const tolerance = Math.atan2(t.radius, dist);
      if (Math.abs(angleDiff(Math.atan2(dy, dx), aim)) > halfArc + tolerance) continue;
    }
    const nx = dist > 0.001 ? dx / dist : Math.cos(aim);
    const ny = dist > 0.001 ? dy / dist : Math.sin(aim);
    already.add(t);
    if (t.takeHit({ ...hit, nx, ny })) landed++;
  }
  return landed;
}

class ComboSystem {
  constructor(chain) {
    this.chain = chain;
    this.reset();
  }

  reset() {
    this.step = -1;
    this.current = null;
    this.buffer = 0;
    this.windowLeft = 0;
  }

  get attacking() { return this.current !== null; }

  request() { this.buffer = CONFIG.INPUT_BUFFER; }

  cancel() {
    this.current = null;
    this.step = -1;
    this.windowLeft = 0;
  }

  bladeAngle() {
    if (!this.current) return null;
    return swingAngleAt(this.current.def, this.current.aim, this.current.t);
  }

  /** Quadro do sprite do golpe atual: { name, flipInvert }. */
  frame() {
    const c = this.current;
    if (!c) return null;
    let f = c.def.frames[0];
    for (const fr of c.def.frames) if (c.t >= fr[0]) f = fr;
    return { name: f[1], flipInvert: !!f[2] };
  }

  /** Inicia o ramo especial (ataque após dash). */
  startSpecial(def, owner, world) {
    this._begin(def, owner, world, def.nextStep - 1);
  }

  update(dt, owner, targets, world) {
    if (this.buffer > 0) this.buffer -= dt;

    if (this.current) {
      const c = this.current;
      c.t += dt;
      if (c.t >= c.def.activeStart && c.t <= c.def.activeEnd + dt) this._resolveHits(c, owner, targets, world);

      const canChain = this.step < this.chain.length - 1 && c.t >= c.def.chainFrom;
      if (this.buffer > 0 && canChain) {
        this._start(this.step + 1, owner, world);
      } else if (c.t >= c.def.duration) {
        this.current = null;
        this.windowLeft = c.def.comboWindow;
      }
      return;
    }

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
    this._begin(this.chain[index], owner, world, index);
  }

  _begin(def, owner, world, stepIndex) {
    this.step = stepIndex;
    this.buffer = 0;
    this.windowLeft = 0;
    // A mira é travada no início do golpe (direção do cursor naquele instante).
    this.current = { def, t: 0, aim: owner.aimAngle, hits: new Set() };
    owner.onAttackStart(def, this.current.aim);
    world.effects.spawnSlash(owner, this.current.aim, def);
    Sfx.swing(Math.max(0, stepIndex));
  }

  _resolveHits(c, owner, targets, world) {
    const def = c.def;
    const landed = hitSector(owner.x, owner.y, c.aim, def.range, def.arcDeg, targets, c.hits, {
      damage: def.damage, knockback: def.knockback, stun: def.stun, poise: def.poise,
      finisher: !!def.finisher, source: owner,
    });
    if (landed > 0) {
      world.hitStop = Math.max(world.hitStop, def.hitStop + Math.min(landed - 1, 3) * 0.01);
      world.camera.shake(def.shake + landed * 0.5);
      if (def.finisher) world.camera.zoomPunch(0.06);
      world.stats.combo += landed;
      world.stats.comboTimer = 1.8;
      world.stats.maxCombo = Math.max(world.stats.maxCombo, world.stats.combo);
      Sfx.hit(!!def.finisher);
    }
  }
}
