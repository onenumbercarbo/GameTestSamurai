/**
 * storm.js — Clima da arena do Gendō: piso de mosaico, braseiros e tempestade.
 *
 *  drawMosaic() — pinta (uma vez, no canvas do chão) o piso circular de pedra
 *                 com anéis vermelhos e dourados. Desenhado em coordenadas de
 *                 MUNDO: o canvas já está com a matriz isométrica, então os
 *                 círculos viram elipses em perspectiva sozinhos.
 *  Brazier      — braseiro de pedra e bronze com fogo, brasas e luz no chão.
 *  Storm        — chuva, respingos, nuvens, relâmpagos, trovão e a correção de
 *                 cor (dessaturada e quente). `calm()` faz a tempestade passar.
 */

/** Piso cerimonial: anéis concêntricos de pedra, faixas vermelhas e ornamentos dourados. */
function drawMosaic(g, cx, cy, R, rnd) {
  const ring = (r0, r1, fill) => {
    g.beginPath();
    g.arc(cx, cy, r1, 0, Math.PI * 2);
    g.arc(cx, cy, Math.max(0.001, r0), 0, Math.PI * 2, true);
    g.fillStyle = fill;
    g.fill();
  };
  const circle = (r, color, width) => {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.strokeStyle = color;
    g.lineWidth = width;
    g.stroke();
  };
  /** Anel dividido em blocos de pedra com tons levemente diferentes. */
  const blocks = (r0, r1, n, h, s, l, jitter) => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      g.beginPath();
      g.arc(cx, cy, r1, a0, a1);
      g.arc(cx, cy, r0, a1, a0, true);
      g.closePath();
      g.fillStyle = `hsl(${h}, ${s}%, ${l + (rnd() - 0.5) * jitter}%)`;
      g.fill();
      g.strokeStyle = 'rgba(10,8,8,0.55)';
      g.lineWidth = 0.05;
      g.stroke();
    }
  };

  // sombra/rejunte em volta
  g.filter = 'blur(6px)';
  ring(R - 0.2, R + 0.6, 'rgba(10,9,9,0.7)');
  g.filter = 'none';

  blocks(R - 0.75, R, 56, 28, 8, 30, 8);               // borda externa de pedra
  circle(R - 0.75, 'hsl(5, 55%, 32%)', 0.12);          // linha vermelha
  ring(R - 2.1, R - 0.8, 'hsl(10, 20%, 16%)');         // faixa escura
  // ornamento: losangos alternando vermelho e creme, com pontas douradas
  const n = 28;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rm = R - 1.45;
    const pts = [[rm + 0.55, a], [rm, a + Math.PI / n], [rm - 0.55, a], [rm, a - Math.PI / n]];
    g.beginPath();
    pts.forEach(([r, t], i) => {
      const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.fillStyle = k % 2 ? 'hsl(6, 50%, 34%)' : 'hsl(38, 30%, 66%)';
    g.fill();
    g.fillStyle = 'hsl(42, 70%, 52%)';
    g.beginPath();
    g.arc(cx + Math.cos(a + Math.PI / n) * rm, cy + Math.sin(a + Math.PI / n) * rm, 0.08, 0, Math.PI * 2);
    g.fill();
  }
  circle(R - 2.1, 'hsl(42, 60%, 45%)', 0.07);          // fio dourado
  blocks(R - 3.6, R - 2.15, 36, 25, 6, 24, 7);         // anel de pedra escura
  // raios vermelhos cruzando o anel (como os da imagem de referência)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R - 3.6), cy + Math.sin(a) * (R - 3.6));
    g.lineTo(cx + Math.cos(a) * (R - 2.15), cy + Math.sin(a) * (R - 2.15));
    g.strokeStyle = 'hsl(5, 55%, 34%)';
    g.lineWidth = 0.22;
    g.stroke();
  }
  circle(R - 3.65, 'hsl(5, 55%, 32%)', 0.12);
  blocks(R - 4.9, R - 3.7, 24, 36, 22, 64, 8);         // anel claro (creme)
  circle(R - 4.95, 'hsl(42, 60%, 45%)', 0.07);
  ring(0, R - 5.0, 'hsl(34, 16%, 50%)');               // centro claro (onde o duelo acontece)
  circle(Math.max(0.3, R - 5.6), 'hsl(20, 12%, 22%)', 0.16);
  circle(Math.max(0.15, R - 6.2), 'hsl(5, 55%, 34%)', 0.1);

  // pedra molhada: reflexo largo vindo do lado de cima (céu claro entre as nuvens)
  const gr = g.createRadialGradient(cx + 1.5, cy - 2.5, 0.5, cx + 1.5, cy - 2.5, R * 1.1);
  gr.addColorStop(0, 'rgba(255,235,210,0.16)');
  gr.addColorStop(1, 'rgba(255,235,210,0)');
  ring(0, R, gr);
  // poças
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI * 2, r = rnd() * (R - 0.6);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = 0.3 + rnd() * 0.6;
    const p = g.createRadialGradient(x, y, 0, x, y, s);
    p.addColorStop(0, 'rgba(200,205,220,0.18)');
    p.addColorStop(1, 'rgba(200,205,220,0)');
    g.fillStyle = p;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
}

/** Braseiro: coluna de pedra com bacia de bronze e fogo. */
class Brazier {
  constructor(world, x, y) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.t = Math.random() * 10;
    this.alive = true;
    this.box = { x0: x - 0.35, y0: y - 0.35, x1: x + 0.35, y1: y + 0.35 };
    this.emberT = 0;
    world.level.addPost(x, y, 0.35);
  }

  update(dt) {
    this.t += dt;
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = 0.12 + Math.random() * 0.15;
      this.world.effects.particles.push({
        x: this.x + (Math.random() - 0.5) * 0.3, y: this.y + (Math.random() - 0.5) * 0.3, z: 62,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: 70 + Math.random() * 60,
        life: 0.9, max: 1.4, color: '#ffb050', size: 1.6,
      });
    }
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const c = cam.worldToScreen(this.x, this.y);
    const flick = 1 + 0.08 * Math.sin(this.t * 17) + 0.05 * Math.sin(this.t * 31);
    // luz no chão molhado
    const gl = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 95 * s * flick);
    gl.addColorStop(0, 'rgba(255,150,60,0.4)');
    gl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 95 * s * flick, 48 * s * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    // coluna de pedra (cilindro)
    const w = 11 * s, h = 46 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 2 * s, w * 1.5, w * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    const col = ctx.createLinearGradient(c.x - w, 0, c.x + w, 0);
    col.addColorStop(0, '#3b3634');
    col.addColorStop(0.45, '#6a625c');
    col.addColorStop(1, '#2a2624');
    ctx.fillStyle = col;
    ctx.fillRect(c.x - w, c.y - h, w * 2, h);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, w, w * 0.5, 0, 0, Math.PI); ctx.fill();
    // anéis entalhados
    ctx.strokeStyle = 'rgba(20,16,14,0.6)';
    ctx.lineWidth = 1.2 * s;
    for (const f of [0.25, 0.75]) {
      ctx.beginPath(); ctx.ellipse(c.x, c.y - h * f, w, w * 0.5, 0, 0, Math.PI); ctx.stroke();
    }
    // bacia de bronze
    const by = c.y - h;
    const bw = 20 * s;
    ctx.fillStyle = '#6b4a22';
    ctx.beginPath();
    ctx.moveTo(c.x - bw, by - 8 * s);
    ctx.quadraticCurveTo(c.x, by + 10 * s, c.x + bw, by - 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8862e';
    ctx.beginPath(); ctx.ellipse(c.x, by - 8 * s, bw, bw * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1408';
    ctx.beginPath(); ctx.ellipse(c.x, by - 8 * s, bw * 0.82, bw * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    // chamas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const fh = (26 + 10 * Math.sin(this.t * 9 + k * 1.7)) * s * flick;
      const fw = (9 - Math.abs(k - 2) * 1.6) * s;
      const x = c.x + (k - 2) * 5.5 * s;
      ctx.fillStyle = k === 2 ? 'rgba(255,230,140,0.95)' : k % 2 ? 'rgba(255,140,40,0.8)' : 'rgba(255,90,30,0.7)';
      ctx.beginPath();
      ctx.moveTo(x - fw, by - 9 * s);
      ctx.quadraticCurveTo(x - fw * 0.9, by - 9 * s - fh * 0.6, x + Math.sin(this.t * 6 + k) * 3 * s, by - 9 * s - fh);
      ctx.quadraticCurveTo(x + fw * 0.9, by - 9 * s - fh * 0.6, x + fw, by - 9 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Brilho do fogo pintado DEPOIS da correção de cor (para o fogo "saltar" da cena). */
  glow(ctx, cam) {
    const s = cam.scale;
    const c = cam.worldToScreen(this.x, this.y, 62);
    const r = 70 * s * (1 + 0.08 * Math.sin(this.t * 17));
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r);
    g.addColorStop(0, 'rgba(255,170,80,0.45)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
  }
}

class Storm {
  constructor(world) {
    this.world = world;
    this.drops = [];
    this.splashes = [];
    this.clouds = [];
    this.flash = 0;
    this.bolt = null;
    this.boltT = 0;
    this.nextStrike = 2 + Math.random() * 3;
    this.intensity = 1;
    this.target = 1;
    this.t = 0;
    for (let k = 0; k < 7; k++) {
      this.clouds.push({ x: Math.random(), y: Math.random() * 0.22, r: 0.18 + Math.random() * 0.2, v: 0.004 + Math.random() * 0.008 });
    }
  }

  /** A tempestade passa (após derrotar o Gendō). */
  calm() {
    this.target = 0.15;
  }

  /** Relâmpago: clarão, raio no céu e trovão logo depois. */
  strike(big = false) {
    const cam = this.world.camera;
    this.flash = big ? 1 : 0.7 + Math.random() * 0.3;
    this.boltT = 0.22;
    const pts = [];
    let x = cam.viewW * (0.15 + Math.random() * 0.7), y = -10;
    const end = cam.viewH * (0.22 + Math.random() * 0.2);
    while (y < end) {
      pts.push([x, y]);
      x += (Math.random() - 0.5) * 46;
      y += 14 + Math.random() * 22;
    }
    pts.push([x, y]);
    const branches = [];
    for (let k = 0; k < 3; k++) {
      const i = 1 + Math.floor(Math.random() * (pts.length - 2));
      let [bx, by] = pts[i];
      const br = [[bx, by]];
      const dir = Math.random() < 0.5 ? -1 : 1;
      for (let q = 0; q < 4; q++) {
        bx += dir * (8 + Math.random() * 18);
        by += 10 + Math.random() * 14;
        br.push([bx, by]);
      }
      branches.push(br);
    }
    this.bolt = { pts, branches };
    cam.shake(big ? 6 : 2);
    Sfx.thunder(big ? 0.15 : 0.35 + Math.random() * 0.6);
  }

  update(dt) {
    this.t += dt;
    this.intensity = damp(this.intensity, this.target, 0.6, dt);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.boltT = Math.max(0, this.boltT - dt);
    // segundo clarão rápido (relâmpago "piscando")
    if (this.boltT > 0.1 && this.boltT - dt <= 0.1) this.flash = Math.max(this.flash, 0.55);
    this.nextStrike -= dt;
    if (this.nextStrike <= 0) {
      this.nextStrike = (4 + Math.random() * 6) / Math.max(0.3, this.intensity);
      if (this.intensity > 0.4) this.strike();
    }
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x - c.r > 1.1) c.x = -c.r;
    }
    const cam = this.world.camera;
    const want = Math.round(260 * this.intensity * clamp(cam.viewW * cam.viewH / (1280 * 720), 0.4, 1.5));
    while (this.drops.length < want) {
      this.drops.push({ x: Math.random() * (cam.viewW + 200), y: Math.random() * cam.viewH, v: 900 + Math.random() * 500, l: 12 + Math.random() * 16 });
    }
    if (this.drops.length > want) this.drops.length = want;
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.22 * dt;
      if (d.y > cam.viewH) {
        if (Math.random() < 0.35) this.splashes.push({ x: d.x, y: cam.viewH * (0.2 + Math.random() * 0.8), t: 0 });
        d.y = -d.l;
        d.x = Math.random() * (cam.viewW + 200);
      }
    }
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter((s) => s.t < 0.3);
  }

  /** Desenha o céu em 1/4 da resolução (gradientes grandes são caros em tela cheia). */
  renderSky(W, H, I) {
    const w = Math.ceil(W / 4), h = Math.ceil((H * 0.5) / 4);
    if (!this.sky || this.sky.width !== w) {
      this.sky = document.createElement('canvas');
      this.sky.width = w;
      this.sky.height = h;
    }
    const g = this.sky.getContext('2d');
    g.clearRect(0, 0, w, h);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.9);
    sky.addColorStop(0, `rgba(25,22,26,${0.7 * I})`);
    sky.addColorStop(1, 'rgba(25,22,26,0)');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const lit = Math.min(1, this.flash * 1.5);
    for (const c of this.clouds) {
      const x = c.x * w, y = (c.y * H) / 4, r = c.r * w * 0.8;
      const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
      gr.addColorStop(0, `rgba(${40 + 140 * lit},${36 + 130 * lit},${42 + 120 * lit},${0.55 * I})`);
      gr.addColorStop(1, 'rgba(30,28,32,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // luz quente rasgando as nuvens, somada no mesmo canvas
    g.globalCompositeOperation = 'lighter';
    const sun = g.createRadialGradient(w * 0.72, -h * 0.1, 2, w * 0.72, -h * 0.1, h * 1.2);
    sun.addColorStop(0, `rgba(255,220,180,${0.22 + 0.25 * (1 - I)})`);
    sun.addColorStop(1, 'rgba(255,220,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  /** Camadas por cima do mundo (antes do HUD). */
  draw(ctx, cam) {
    const W = cam.viewW, H = cam.viewH, I = this.intensity;
    ctx.save();
    // correção de cor: dessaturada e quente, mais forte durante a tempestade
    // (no celular pula a dessaturação, que é a camada mais cara)
    if (!TOUCH.active) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${0.45 * I})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${Math.round(255 - 40 * I)},${Math.round(255 - 62 * I)},${Math.round(255 - 82 * I)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // céu (nuvens + luz rasgando as nuvens): canvas pequeno, refeito a cada 0,15 s
    const flashKey = Math.round(this.flash * 6);
    if (!this.sky || this.skyAge-- <= 0 || flashKey !== this.skyFlash || this.sky.width !== Math.ceil(W / 4)) {
      this.renderSky(W, H, I);
      this.skyAge = 9;
      this.skyFlash = flashKey;
    }
    ctx.drawImage(this.sky, 0, 0, W, H * 0.5);
    ctx.globalCompositeOperation = 'lighter';

    // fogo dos braseiros por cima da correção de cor
    for (const b of this.world.braziers || []) b.glow(ctx, cam);

    // chuva
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(205,215,235,${0.32 + 0.25 * this.flash})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.l * 0.22, d.y - d.l);
    }
    ctx.stroke();
    // respingos no chão
    ctx.strokeStyle = 'rgba(210,220,240,0.35)';
    for (const s of this.splashes) {
      const k = s.t / 0.3;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 2 + k * 7, 1 + k * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // relâmpago
    if (this.bolt && this.boltT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const line = (pts, w, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      };
      const a = Math.min(1, this.boltT / 0.12);
      line(this.bolt.pts, 9, `rgba(160,180,255,${0.25 * a})`);
      line(this.bolt.pts, 2.5, `rgba(240,245,255,${0.95 * a})`);
      for (const br of this.bolt.branches) line(br, 1.4, `rgba(220,230,255,${0.7 * a})`);
    }
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(200,210,255,${0.45 * this.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
