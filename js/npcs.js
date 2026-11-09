/**
 * npcs.js — Moradores das vilas: o mundo vivo em volta do rōnin.
 *
 * Cada morador passeia entre pontos perto de casa, para, conversa sozinho
 * (balões de fala) e reage ao perigo: enquanto a vila está ocupada fica
 * acuado perto de casa e fala baixo; depois que o guardião cai, anda mais
 * longe e agradece ao passar pelo rōnin.
 *
 * O "anfitrião" de cada vila (greeter) é quem pede ajuda: ao ver o rōnin
 * chegar, ele vai até ele e abre o diálogo.
 */

const TOWN_LINES = {
  scared: ['Os bandidos ainda estão por aqui...', 'Shh! Eles podem ouvir.', 'Levaram todo o nosso arroz.', 'Não saia de perto de casa!', 'Que os deuses nos protejam...'],
  happy: ['Obrigado, rōnin!', 'A colheita vai ser boa este ano.', 'Chá fresco, quem quer?', 'Bom dia, viajante!', 'Finalmente podemos dormir em paz.', 'Viva o andarilho de kimono vermelho!'],
};

class Townsperson {
  constructor(world, x, y, kind, zone, opts = {}) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.home = { x, y };
    this.kind = kind;
    this.frames = TOWNSFOLK[kind] || TOWNSFOLK.farmer;
    this.zone = zone;
    this.greeter = !!opts.greeter;
    this.radius = 0.28;
    this.alive = true;
    this.target = null;
    this.wait = 1 + Math.random() * 3;
    this.stride = 0;
    this.vx = this.vy = 0;
    this.kx = this.ky = 0;
    this.flipX = Math.random() < 0.5;
    this.bubble = null;
    this.bubbleT = 3 + Math.random() * 8;
    this.approach = false;
    this.t = Math.random() * 10;
  }

  get box() {
    return { x0: this.x - 0.25, y0: this.y - 0.25, x1: this.x + 0.25, y1: this.y + 0.25 };
  }

  /** Há luta perto? (moradores param e se encolhem) */
  danger() {
    const w = this.world;
    if (w.activeArena && Math.hypot(w.activeArena.center[0] - this.x, w.activeArena.center[1] - this.y) < 12) return true;
    return !!(w.bossFight && w.fightBoss && Math.hypot(w.fightBoss.x - this.x, w.fightBoss.y - this.y) < 14);
  }

  say(text, dur = 2.6) {
    this.bubble = { text, t: dur };
  }

  update(dt) {
    const w = this.world, p = w.player, L = w.level;
    this.t += dt;
    if (this.bubble) {
      this.bubble.t -= dt;
      if (this.bubble.t <= 0) this.bubble = null;
    }
    let speed = 0, dir = null;
    const dp = Math.hypot(p.x - this.x, p.y - this.y);

    if (this.greeter && !this.zone.talked) {
      // O anfitrião vê o rōnin chegar e vai até ele pedir ajuda.
      if (!this.approach && dp < 9 && p.alive && !w.inCombat && !w.cutscene) this.approach = true;
      if (this.approach) {
        this.approachT = (this.approachT || 0) + dt;
        if (dp > 2.2 && this.approachT < 5) {
          dir = { x: (p.x - this.x) / dp, y: (p.y - this.y) / dp };
          speed = 2.4;
          if (!this.bubble) this.say('Senhor! Espere!', 1.2);
        } else if (!w.dialog && !w.cutscene) {
          this.approach = false;
          w.startDialog(this.zone.talk.ask, this, () => w.onTalked(this.zone));
        }
      }
    } else if (this.danger()) {
      this.target = null; // paralisado de medo
    } else {
      this.wait -= dt;
      if (!this.target && this.wait <= 0) {
        const R = this.zone.done ? 7 : 3;
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * R;
          const tx = this.home.x + Math.cos(a) * r, ty = this.home.y + Math.sin(a) * r;
          if (L.isFree(tx, ty, 0.3) && !L.blocked[Math.floor(ty) * L.W + Math.floor(tx)]) { this.target = { x: tx, y: ty }; break; }
        }
        this.wait = 1;
      }
      if (this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
        if (d < 0.2) {
          this.target = null;
          this.wait = 1.5 + Math.random() * 4;
        } else {
          dir = { x: dx / d, y: dy / d };
          speed = 1.1;
        }
      }
      // conversa sozinho de vez em quando; agradece quando o rōnin passa perto
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 6 + Math.random() * 10;
        if (dp < 10) {
          const lines = this.zone.done ? TOWN_LINES.happy : TOWN_LINES.scared;
          this.say(lines[Math.floor(Math.random() * lines.length)]);
        }
      }
    }

    this.vx = dir ? dir.x * speed : 0;
    this.vy = dir ? dir.y * speed : 0;
    if (dir && Math.abs(dir.x - dir.y) > 0.1) this.flipX = dir.x - dir.y < 0;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.stride += speed * dt;
    L.resolveCircle(this);
    if (dir && speed > 0 && Math.hypot(this.vx, this.vy) > 0 && this.target && Math.random() < dt * 0.4) this.target = null; // destrava se encostar
  }

  draw(ctx, cam) {
    const s = cam.scale;
    const moving = Math.hypot(this.vx, this.vy) > 0.1;
    const name = moving ? this.frames[Math.floor(this.stride * 3.2) % this.frames.length] : this.frames[0];
    const bob = moving ? Math.abs(Math.sin(this.stride * Math.PI * 1.6)) * 2 : 0;
    const g = cam.worldToScreen(this.x, this.y);
    const scared = this.danger() && !this.greeter;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, Iso.HW * 0.42 * s, Iso.HH * 0.42 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const shiver = scared ? Math.sin(this.t * 40) * 0.6 * s : 0;
    const top = cam.worldToScreen(this.x, this.y, bob);
    Sprites.draw(ctx, name, top.x + shiver, top.y, 0.78 * s, { flip: this.flipX });

    // "!" dourado sobre quem quer falar com o rōnin
    if (this.greeter && !this.zone.talked) {
      const q = cam.worldToScreen(this.x, this.y, 98 + Math.sin(this.t * 4) * 4);
      ctx.save();
      ctx.font = `900 ${Math.round(24 * Math.min(s, 1.5))}px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2a1a06';
      ctx.strokeText('!', q.x, q.y);
      ctx.fillStyle = '#ffcf6a';
      ctx.fillText('!', q.x, q.y);
      ctx.restore();
    }
    if (this.bubble) drawBubble(ctx, cam, this.x, this.y, 96, this.bubble.text, '#3a2a14');
  }
}

/** Balão de fala acima de um personagem. */
function drawBubble(ctx, cam, x, y, z, text, color) {
  const s = cam.scale;
  const t = cam.worldToScreen(x, y, z);
  ctx.save();
  ctx.font = `700 ${Math.round(12 * Math.min(s, 1.4))}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  const wd = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(250,244,230,0.94)';
  ctx.beginPath();
  ctx.moveTo(t.x - wd / 2, t.y - 16);
  ctx.lineTo(t.x + wd / 2, t.y - 16);
  ctx.lineTo(t.x + wd / 2, t.y + 6);
  ctx.lineTo(t.x + 6, t.y + 6);
  ctx.lineTo(t.x, t.y + 13);
  ctx.lineTo(t.x - 4, t.y + 6);
  ctx.lineTo(t.x - wd / 2, t.y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, t.x, t.y);
  ctx.restore();
}
