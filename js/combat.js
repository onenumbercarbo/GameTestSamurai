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

/** Ataque pesado (botão direito), liberado pelo Pergaminho do Iaijutsu. */
const IAI_STRIKE = {
  name: 'Iai: Raikō',
  arcDeg: 80, sweep: 1, range: 3.4, thickness: 0.7,
  damage: 40, knockback: 10, stun: 0.8, poise: 45, finisher: true,
  lunge: 16, moveMul: 0,
  activeStart: 0.14, activeEnd: 0.27, chainFrom: Infinity, duration: 0.52, comboWindow: 0,
  hitStop: 0.12, shake: 11, nextStep: 0,
  color: [170, 210, 255],
  frames: [[0, 'hero_stance'], [0.12, 'hero_dash'], [0.2, 'hero_slash1'], [0.4, 'hero_stance']],
};

/**
 * Armas e relíquias encontradas explorando as vilas. `apply` altera os
 * modificadores do jogador; os golpes são reescalados no início de cada swing.
 */
const ITEMS = {
  tamahagane: { name: 'Katana Tamahagane', desc: 'Aço dobrado mil vezes: dano +30%', icon: 'blade', apply: (m) => { m.dmg *= 1.3; } },
  omamori: { name: 'Omamori de Proteção', desc: 'Amuleto do templo: vida máxima +30', icon: 'charm', apply: (m) => { m.hp += 30; } },
  nodachi: { name: 'Nodachi do Vento', desc: 'Alcance +25% e o giro final lança uma onda de vento', icon: 'wind', apply: (m) => { m.range *= 1.25; m.wind = true; } },
  iai: { name: 'Pergaminho do Iaijutsu', desc: 'Botão direito: saque relâmpago que atravessa os inimigos', icon: 'scroll', apply: (m) => { m.iai = true; } },
};

function computeMods(items) {
  const m = { dmg: 1, range: 1, hp: 0, wind: false, iai: false };
  for (const id of items) if (ITEMS[id]) ITEMS[id].apply(m);
  return m;
}

/** Cópia do golpe com dano/alcance ajustados pela arma equipada. */
function scaleDef(def, mods) {
  if (!mods || (mods.dmg === 1 && mods.range === 1)) return def;
  return {
    ...def,
    damage: Math.round(def.damage * mods.dmg),
    range: def.range * mods.range,
    thickness: def.thickness * mods.range,
  };
}

/** Onda de vento cortante (Nodachi do Vento): atravessa e acerta cada inimigo uma vez. */
class WindSlash {
  constructor(world, x, y, angle, damage) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 11;
    this.life = 0.6;
    this.damage = damage;
    this.alive = true;
    this.isProjectile = true;
    this.hits = new Set();
    this.radius = 0.2;
  }

  get box() {
    return { x0: this.x - 0.3, y0: this.y - 0.3, x1: this.x + 0.3, y1: this.y + 0.3 };
  }

  update(dt) {
    this.life -= dt;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    if (this.life <= 0) { this.alive = false; return; }
    const w = this.world;
    const foes = w.targets().filter((t) => !t.isProjectile);
    const n = hitSector(this.x, this.y, this.angle, 0.9, 360, foes, this.hits, {
      damage: this.damage, knockback: 5, stun: 0.35, poise: 12, source: this,
    });
    if (n > 0) w.camera.shake(3);
  }

  draw(ctx, cam) {
    const a = clamp(this.life / 0.6, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(200,240,255,${0.85 * a})`;
    ctx.lineWidth = 4 * cam.scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const t = -0.9 + (i / 14) * 1.8;
      const r = 0.75;
      const px = this.x + Math.cos(this.angle + t) * r - Math.cos(this.angle) * 0.5;
      const py = this.y + Math.sin(this.angle + t) * r - Math.sin(this.angle) * 0.5;
      const p = cam.worldToScreen(px, py, 22);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

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
      // Nodachi do Vento: o golpe final dispara uma onda de vento.
      if (c.def.finisher && owner.mods && owner.mods.wind && !c.wind && c.t >= c.def.activeStart) {
        c.wind = true;
        for (const da of [-0.5, 0, 0.5]) world.projectiles.push(new WindSlash(world, owner.x, owner.y, c.aim + da, Math.round(12 * owner.mods.dmg)));
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
    def = scaleDef(def, owner.mods);
    // A direção é travada no início do golpe: para onde o jogador está
    // conduzindo (WASD), com assistência de mira para o inimigo mais próximo.
    const aim = owner.attackAim ? owner.attackAim() : owner.aimAngle;
    this.current = { def, t: 0, aim, hits: new Set(), wind: false };
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
