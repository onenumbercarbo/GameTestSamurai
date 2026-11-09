/**
 * effects.js — Efeitos visuais e formas desenhadas NO CHÃO.
 *
 * Tudo vive em coordenadas de MUNDO e é projetado a cada frame: um círculo
 * no mundo vira automaticamente uma elipse 2:1 na tela, por isso arcos de
 * espada, telegráfos de ataque e ondas de choque "deitam" na perspectiva.
 */

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ------------------------- formas no chão (helpers) ------------------------- */

const Ground = {
  /** Polígono a partir de pontos do mundo. */
  path(ctx, cam, pts, z = 0) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const p = cam.worldToScreen(x, y, z);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
  },

  /** Um círculo de raio r no mundo (polígono: fica correto também em perspectiva). */
  circle(ctx, cam, x, y, r) {
    ctx.beginPath();
    this._loop(ctx, cam, x, y, r, false);
  },

  _loop(ctx, cam, x, y, r, rev) {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = ((rev ? n - i : i) / n) * Math.PI * 2;
      const p = cam.worldToScreen(x + Math.cos(a) * r, y + Math.sin(a) * r);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
  },

  ring(ctx, cam, x, y, r0, r1) {
    ctx.beginPath();
    this._loop(ctx, cam, x, y, r1, false);
    this._loop(ctx, cam, x, y, Math.max(0.01, r0), true);
  },

  sector(ctx, cam, x, y, r, aim, arcDeg) {
    const half = (arcDeg * Math.PI) / 360;
    const pts = [[x, y]];
    for (let i = 0; i <= 28; i++) {
      const a = aim - half + (i / 28) * half * 2;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    this.path(ctx, cam, pts);
  },

  /** Retângulo orientado: começa em (x,y), comprimento len na direção aim. */
  lane(ctx, cam, x, y, aim, len, width) {
    const c = Math.cos(aim), s = Math.sin(aim);
    const px = -s * width / 2, py = c * width / 2;
    this.path(ctx, cam, [
      [x + px, y + py], [x + c * len + px, y + s * len + py],
      [x + c * len - px, y + s * len - py], [x - px, y - py],
    ]);
  },

  /**
   * Telegráfo de ataque (estilo Hades): área vermelha translúcida que se
   * "enche" conforme o golpe se aproxima. progress: 0..1.
   */
  telegraph(ctx, cam, shapeFn, progress) {
    ctx.save();
    shapeFn();
    ctx.fillStyle = `rgba(200, 30, 20, ${0.12 + 0.22 * progress})`;
    ctx.fill();
    ctx.lineWidth = 1.5 * cam.scale;
    ctx.strokeStyle = `rgba(255, 80, 60, ${0.35 + 0.5 * progress})`;
    ctx.stroke();
    ctx.restore();
  },
};

/* ------------------------------- arco da espada ------------------------------- */

/**
 * Ângulo atual da lâmina de um golpe dado o tempo decorrido. Usado pelo rastro
 * visual e pela hitbox, garantindo que os dois fiquem sincronizados.
 */
function swingAngleAt(def, aimAngle, t) {
  const arc = (def.arcDeg * Math.PI) / 180;
  const start = aimAngle - (def.sweep * arc) / 2;
  const p = easeOutCubic(clamp((t - def.activeStart) / (def.activeEnd - def.activeStart), 0, 1));
  return start + def.sweep * arc * p;
}

class SlashEffect {
  constructor(owner, aimAngle, def) {
    this.owner = owner;
    this.aim = aimAngle;
    this.def = def;
    this.age = 0;
    this.life = def.activeEnd + 0.16;
  }

  get dead() { return this.age >= this.life; }

  update(dt) { this.age += dt; }

  draw(ctx, cam) {
    const d = this.def;
    if (this.age < d.activeStart) return;
    const arc = (d.arcDeg * Math.PI) / 180;
    const start = this.aim - (d.sweep * arc) / 2;
    const lead = swingAngleAt(d, this.aim, this.age);
    const swept = Math.abs(lead - start);
    if (swept < 0.01) return;
    const trailLen = Math.min(swept, arc * 0.75);
    const tail = lead - d.sweep * trailLen;
    const fadeT = clamp((this.age - d.activeEnd) / (this.life - d.activeEnd), 0, 1);
    const alpha = 1 - fadeT;
    const cx = this.owner.x, cy = this.owner.y;
    const z = d.z ?? 22;
    const N = 28;
    const outer = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = tail + (lead - tail) * t;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rIn = d.range - d.thickness * (0.15 + 0.85 * t);
      outer.push(cam.worldToScreen(cx + ca * d.range, cy + sa * d.range, z));
      inner.push(cam.worldToScreen(cx + ca * rIn, cy + sa * rIn, z));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const [r, g, b] = d.color;
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * alpha})`;
    ctx.fill();
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.lineWidth = 2.2 * cam.scale;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------------ gerenciador de FX ------------------------------ */

class Effects {
  constructor() {
    this.reset();
  }

  reset() {
    this.slashes = [];
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.puffs = [];
  }

  spawnSlash(owner, aimAngle, def) {
    this.slashes.push(new SlashEffect(owner, aimAngle, def));
  }

  /** Faíscas de impacto, espirrando na direção do golpe. */
  sparks(x, y, dirAngle, count, color, spread = 1.6) {
    for (let i = 0; i < count; i++) {
      const a = dirAngle + (Math.random() - 0.5) * spread;
      const s = 3 + Math.random() * 6;
      this.particles.push({
        x, y, z: 18 + Math.random() * 14,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 60 + Math.random() * 160,
        life: 0.25 + Math.random() * 0.25, max: 0.5, color, size: 1.4 + Math.random() * 2,
      });
    }
  }

  /** Respingo de "tinta" vermelha estilizada (anime), em vez de sangue realista. */
  ink(x, y, dirAngle, count) {
    this.sparks(x, y, dirAngle, count, '#d8312a', 1.2);
  }

  /** Poeira/fumaça: círculos que crescem e somem (spawn de ninja, dash, slam). */
  smoke(x, y, count, color = '200,200,200', size = 0.5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 1.6;
      this.puffs.push({
        x: x + Math.cos(a) * 0.2, y: y + Math.sin(a) * 0.2, z: Math.random() * 20,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 10 + Math.random() * 30,
        r: size * (0.6 + Math.random() * 0.6), life: 0.5 + Math.random() * 0.4, max: 0.9, color,
      });
    }
  }

  /** Onda de choque visual (o dano é calculado por quem a criou). */
  ring(x, y, maxR, dur, color = '255,190,120') {
    this.rings.push({ x, y, maxR, dur, t: 0, color });
  }

  text(x, y, text, color, big = false) {
    this.texts.push({ x, y, text, color, big, z: 40, age: 0, life: 0.75 });
  }

  update(dt) {
    for (const s of this.slashes) s.update(dt);
    this.slashes = this.slashes.filter((s) => !s.dead);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= 700 * dt;
      p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const p of this.puffs) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= Math.exp(-3 * dt); p.vy *= Math.exp(-3 * dt);
      p.r += dt * 0.5;
    }
    this.puffs = this.puffs.filter((p) => p.life > 0);

    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);

    for (const t of this.texts) { t.age += dt; t.z += 50 * dt; }
    this.texts = this.texts.filter((t) => t.age < t.life);
  }

  /** Camada do chão (antes dos personagens). */
  drawGround(ctx, cam) {
    for (const r of this.rings) {
      const k = r.t / r.dur;
      const rad = r.maxR * easeOutCubic(k);
      ctx.save();
      Ground.ring(ctx, cam, r.x, r.y, rad - 0.35, rad);
      ctx.fillStyle = `rgba(${r.color}, ${0.55 * (1 - k)})`;
      ctx.fill();
      ctx.restore();
    }
  }

  /** Camada de cima (depois dos personagens). */
  draw(ctx, cam) {
    for (const p of this.puffs) {
      const c = cam.worldToScreen(p.x, p.y, p.z);
      const a = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = `rgba(${p.color}, ${0.35 * a})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, p.r * Iso.HW * cam.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of this.slashes) s.draw(ctx, cam);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      const a = cam.worldToScreen(p.x, p.y, p.z);
      const b = cam.worldToScreen(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.z - p.vz * 0.02);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = clamp(p.life / p.max * 2, 0, 1);
      ctx.lineWidth = p.size * cam.scale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const p = cam.worldToScreen(t.x, t.y, t.z);
      const k = t.age / t.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `800 ${Math.round((t.big ? 22 : 15) * Math.min(cam.scale, 1.6))}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.text, p.x, p.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, p.x, p.y);
    }
    ctx.restore();
  }
}
