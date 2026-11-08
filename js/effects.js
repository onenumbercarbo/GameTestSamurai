/**
 * effects.js — Efeitos visuais: arcos de espada, faíscas e números de dano.
 *
 * Os efeitos vivem em coordenadas de MUNDO e são projetados a cada frame.
 * Isso é o que faz o arco do corte parecer "deitado no chão" em perspectiva:
 * amostramos pontos de um círculo no mundo e projetamos cada um — um círculo
 * no mundo vira automaticamente uma elipse 2:1 na tela.
 */

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Ângulo atual da lâmina de um golpe, dado o tempo decorrido.
 * Usado tanto pelo rastro (SlashEffect) quanto pelo desenho da katana do
 * jogador, garantindo que os dois fiquem sincronizados.
 */
function swingAngleAt(def, aimAngle, t) {
  const arc = (def.arcDeg * Math.PI) / 180;
  const start = aimAngle - (def.sweep * arc) / 2;
  const p = easeOutCubic(clamp((t - def.activeStart) / (def.activeEnd - def.activeStart), 0, 1));
  return start + def.sweep * arc * p;
}

class SlashEffect {
  constructor(owner, aimAngle, def) {
    this.owner = owner; // o arco acompanha o dono (lunge, dash-cancel...)
    this.aim = aimAngle;
    this.def = def;
    this.age = 0;
    this.life = def.activeEnd + 0.16; // tempo do swing + fade-out
  }

  get dead() {
    return this.age >= this.life;
  }

  update(dt) {
    this.age += dt;
  }

  draw(ctx, camera) {
    const d = this.def;
    if (this.age < d.activeStart) return;

    const arc = (d.arcDeg * Math.PI) / 180;
    const start = this.aim - (d.sweep * arc) / 2;
    const lead = swingAngleAt(d, this.aim, this.age);
    const swept = Math.abs(lead - start);
    if (swept < 0.01) return;

    // O rastro cobre no máximo ~75% do arco já percorrido atrás da lâmina.
    const trailLen = Math.min(swept, arc * 0.75);
    const tail = lead - d.sweep * trailLen;

    // Fade-out depois que a lâmina termina o movimento.
    const fadeT = clamp((this.age - d.activeEnd) / (this.life - d.activeEnd), 0, 1);
    const alpha = 1 - fadeT;

    const cx = this.owner.x;
    const cy = this.owner.y;
    const z = 20; // altura do corte (px) — na linha da cintura/peito
    const N = 28;

    // Constrói uma "fita" (ribbon): borda externa no raio máximo e borda
    // interna afinando em direção à cauda. Larga na ponta, fina no fim.
    const outer = [];
    const inner = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N; // 0 = cauda, 1 = ponta da lâmina
      const a = tail + (lead - tail) * t;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rOut = d.range;
      const rIn = d.range - d.thickness * (0.15 + 0.85 * t);
      outer.push(camera.worldToScreen(cx + ca * rOut, cy + sa * rOut, z));
      inner.push(camera.worldToScreen(cx + ca * rIn, cy + sa * rIn, z));
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // brilho aditivo

    const [r, g, b] = d.color;
    // Camada 1: halo colorido.
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.55 * alpha})`;
    ctx.fill();

    // Camada 2: fio da lâmina (borda externa branca e nítida).
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }
}

class Particle {
  constructor(x, y, z, vx, vy, vz, life, color, size) {
    Object.assign(this, { x, y, z, vx, vy, vz, life, maxLife: life, color, size });
  }
}

class FloatingText {
  constructor(x, y, text, color, big) {
    Object.assign(this, { x, y, text, color, big, z: 34, age: 0, life: 0.7 });
  }
}

class Effects {
  constructor() {
    this.slashes = [];
    this.particles = [];
    this.texts = [];
  }

  spawnSlash(owner, aimAngle, def) {
    this.slashes.push(new SlashEffect(owner, aimAngle, def));
  }

  /** Faíscas de impacto espirrando na direção do golpe. */
  spawnSparks(x, y, dirAngle, count, color) {
    for (let i = 0; i < count; i++) {
      const a = dirAngle + (Math.random() - 0.5) * 1.6;
      const s = 3 + Math.random() * 6;
      this.particles.push(
        new Particle(x, y, 18 + Math.random() * 10,
          Math.cos(a) * s, Math.sin(a) * s, 60 + Math.random() * 160,
          0.25 + Math.random() * 0.25, color, 1.5 + Math.random() * 2)
      );
    }
  }

  spawnText(x, y, text, color, big = false) {
    this.texts.push(new FloatingText(x, y, text, color, big));
  }

  update(dt) {
    for (const s of this.slashes) s.update(dt);
    this.slashes = this.slashes.filter((s) => !s.dead);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 700 * dt; // gravidade (px/s²) no eixo Z
      p.vx *= Math.exp(-4 * dt);
      p.vy *= Math.exp(-4 * dt);
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const t of this.texts) {
      t.age += dt;
      t.z += 50 * dt;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
  }

  draw(ctx, camera) {
    for (const s of this.slashes) s.draw(ctx, camera);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = camera.worldToScreen(p.x, p.y, p.z);
      // Desenha como um risco na direção do movimento (motion streak).
      const b = camera.worldToScreen(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.z - p.vz * 0.02);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const p = camera.worldToScreen(t.x, t.y, t.z);
      const k = t.age / t.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `bold ${t.big ? 20 : 15}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(t.text, p.x, p.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, p.x, p.y);
    }
    ctx.restore();
  }
}
