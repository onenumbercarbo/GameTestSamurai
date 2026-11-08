/**
 * ui.js — HUD e telas (título, história, pausa, derrota, vitória).
 * Tudo em espaço de TELA (pixels CSS), desenhado por cima do mundo.
 */
const FONT_TITLE = '"Shippori Mincho B1", "Yu Mincho", "Hiragino Mincho ProN", Georgia, serif';
const FONT_UI = '"Segoe UI", system-ui, -apple-system, sans-serif';

const UI = {
  wrap(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  },

  bar(ctx, x, y, w, h, frac, fg, ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    if (ghost !== undefined) {
      ctx.fillStyle = 'rgba(255,230,200,0.55)';
      ctx.fillRect(x, y, w * clamp(ghost, 0, 1), h);
    }
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h * 0.35);
  },

  letterbox(ctx, cam) {
    if (cam.letterbox < 0.01) return;
    const h = cam.viewH * 0.1 * cam.letterbox;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cam.viewW, h);
    ctx.fillRect(0, cam.viewH - h, cam.viewW, h);
  },

  vignette(ctx, cam, hurt) {
    const g = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, Math.min(cam.viewW, cam.viewH) * 0.35, cam.viewW / 2, cam.viewH / 2, Math.max(cam.viewW, cam.viewH) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, hurt > 0 ? `rgba(150,0,0,${0.35 + 0.4 * hurt})` : 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
  },

  hud(ctx, w) {
    const cam = w.camera;
    if (w.cutscene) return;
    const p = w.player;
    const top = 18 + cam.viewH * 0.1 * cam.letterbox;
    // Vida e dash
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.textAlign = 'left';
    ctx.fillText('RŌNIN', 20, top + 10);
    w.hpGhost = damp(w.hpGhost ?? p.hp, p.hp, 3, 1 / 60);
    this.bar(ctx, 20, top + 18, 220, 12, p.hp / p.maxHp, '#c8322b', w.hpGhost / p.maxHp);
    const dashReady = p.dashCooldown <= 0;
    ctx.fillStyle = dashReady ? '#f3e9d8' : 'rgba(243,233,216,0.3)';
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillText(dashReady ? 'DASH ●' : 'DASH ○', 20, top + 48);

    // Nome da fase + objetivo
    ctx.textAlign = 'center';
    ctx.font = `700 15px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(243,233,216,0.85)';
    ctx.fillText(w.stage.name, cam.viewW / 2, top + 10);
    ctx.font = `500 12px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.65)';
    ctx.fillText(w.objectiveText(), cam.viewW / 2, top + 30);

    // Combo
    const st = w.stats;
    if (st.combo > 1) {
      ctx.textAlign = 'right';
      ctx.globalAlpha = clamp(st.comboTimer / 0.4, 0, 1);
      ctx.font = `800 34px ${FONT_TITLE}`;
      ctx.fillStyle = '#ff6a50';
      ctx.fillText(`${st.combo}`, cam.viewW - 76, top + 30);
      ctx.font = `700 14px ${FONT_UI}`;
      ctx.fillStyle = '#f3e9d8';
      ctx.fillText('HITS', cam.viewW - 24, top + 28);
      ctx.globalAlpha = 1;
    }

    // Barra do boss
    const b = w.boss;
    if (b && w.bossFight && b.alive) {
      const bw = Math.min(560, cam.viewW - 80);
      const x = (cam.viewW - bw) / 2, y = cam.viewH - 46 - cam.viewH * 0.1 * cam.letterbox;
      ctx.textAlign = 'center';
      ctx.font = `700 15px ${FONT_TITLE}`;
      ctx.fillStyle = '#f3e9d8';
      ctx.fillText(b.name + (b.phase === 2 ? '  — FÚRIA' : ''), cam.viewW / 2, y - 10);
      w.bossGhost = damp(w.bossGhost ?? b.hp, b.hp, 2.5, 1 / 60);
      this.bar(ctx, x, y, bw, 12, b.hp / b.maxHp, b.phase === 2 ? '#ff4a1a' : '#a8261f', w.bossGhost / b.maxHp);
      this.bar(ctx, x, y + 17, bw, 3, b.poise / b.maxPoise, '#ffd34d');
    }

    // Seta para o portão quando ele está fora da tela
    if (w.exitOpen && w.stage.exit) {
      const e = cam.worldToScreen(w.stage.exit[0], w.stage.exit[1], 40);
      const m = 60;
      if (e.x < m || e.x > cam.viewW - m || e.y < m || e.y > cam.viewH - m) {
        const cx = cam.viewW / 2, cy = cam.viewH / 2;
        const a = Math.atan2(e.y - cy, e.x - cx);
        const r = Math.min(cam.viewW, cam.viewH) * 0.42;
        const ax = cx + Math.cos(a) * r, ay = cy + Math.sin(a) * r;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(w.time * 5);
        ctx.fillStyle = '#ffcf6a';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-8, -10);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-8, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  },

  banner(ctx, w) {
    const b = w.banner;
    if (!b) return;
    const cam = w.camera;
    const k = b.t / b.dur;
    const a = Math.min(1, b.t / 0.25, (b.dur - b.t) / 0.4);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    const y = cam.viewH * (b.y ?? 0.3);
    if (b.kanji) {
      ctx.font = `700 ${Math.round(cam.viewH * 0.05)}px ${FONT_TITLE}`;
      ctx.fillStyle = 'rgba(200,50,43,0.85)';
      ctx.fillText(b.kanji, cam.viewW / 2, y - cam.viewH * 0.065);
    }
    ctx.font = `700 ${Math.round(Math.min(44, cam.viewW * 0.05))}px ${FONT_TITLE}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(b.text, cam.viewW / 2 + (1 - Math.min(1, k * 4)) * 30, y);
    ctx.fillStyle = b.color || '#f3e9d8';
    ctx.fillText(b.text, cam.viewW / 2 + (1 - Math.min(1, k * 4)) * 30, y);
    if (b.sub) {
      ctx.font = `500 16px ${FONT_UI}`;
      ctx.fillStyle = 'rgba(243,233,216,0.85)';
      ctx.fillText(b.sub, cam.viewW / 2, y + 30);
    }
    ctx.restore();
  },

  /** Painel escuro usado por título/história/fim. */
  panel(ctx, cam, alpha = 0.78) {
    ctx.fillStyle = `rgba(10,7,6,${alpha})`;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
  },

  title(ctx, cam, t, save) {
    this.panel(ctx, cam, 0.55);
    const cx = cam.viewW / 2;
    const s = clamp(cam.viewW / 1100, 0.6, 1.2);
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(120 * s)}px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(200,50,43,0.9)';
    ctx.fillText('浪人', cx, cam.viewH * 0.3);
    ctx.font = `700 ${Math.round(54 * s)}px ${FONT_TITLE}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText('RŌNIN', cx, cam.viewH * 0.3 + 66 * s);
    ctx.font = `400 ${Math.round(22 * s)}px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(243,233,216,0.8)';
    ctx.fillText('A Relíquia Roubada', cx, cam.viewH * 0.3 + 100 * s);

    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.font = `700 18px ${FONT_UI}`;
    ctx.fillStyle = '#ffcf6a';
    ctx.fillText('Clique ou Enter para começar', cx, cam.viewH * 0.62);
    ctx.globalAlpha = 1;
    if (save > 0) {
      ctx.font = `600 14px ${FONT_UI}`;
      ctx.fillStyle = 'rgba(243,233,216,0.85)';
      ctx.fillText(`C — continuar de: ${STAGES[save].name}`, cx, cam.viewH * 0.62 + 28);
    }
    const lines = [
      'WASD / setas — mover      Mouse — mirar      Clique — corte (3 cliques = combo)',
      'Espaço / Shift — dash (esquiva invulnerável)      Dash + clique — investida',
      'Esc / P — pausa      M — som      F3 — debug',
    ];
    ctx.font = `500 13px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.6)';
    lines.forEach((l, i) => ctx.fillText(l, cx, cam.viewH * 0.8 + i * 22));
  },

  story(ctx, cam, stage, t, index, total) {
    this.panel(ctx, cam, 0.86);
    const cx = cam.viewW / 2;
    const maxW = Math.min(640, cam.viewW - 64);
    ctx.textAlign = 'center';
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.5)';
    ctx.fillText(index < total ? `CAPÍTULO ${index + 1} DE ${total}` : 'EPÍLOGO', cx, cam.viewH * 0.18);
    ctx.font = `700 ${Math.round(Math.min(64, cam.viewW * 0.08))}px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(200,50,43,0.9)';
    ctx.fillText(stage.kanji, cx, cam.viewH * 0.18 + 66);
    ctx.font = `700 ${Math.round(Math.min(30, cam.viewW * 0.05))}px ${FONT_TITLE}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText(stage.name, cx, cam.viewH * 0.18 + 108);

    // Texto "datilografado"
    ctx.font = `400 18px ${FONT_TITLE}`;
    let shown = Math.floor(t * 55);
    let y = cam.viewH * 0.18 + 160;
    ctx.fillStyle = 'rgba(243,233,216,0.92)';
    for (const para of stage.story) {
      const lines = this.wrap(ctx, para, maxW);
      for (const l of lines) {
        if (shown <= 0) break;
        ctx.fillText(l.slice(0, shown), cx, y);
        shown -= l.length;
        y += 28;
      }
      y += 14;
    }
    if (shown > 0) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.font = `600 14px ${FONT_UI}`;
      ctx.fillStyle = '#ffcf6a';
      ctx.fillText(index < total ? 'Clique ou Enter para seguir' : 'Clique ou Enter para voltar ao título', cx, Math.min(cam.viewH - 40, y + 30));
      ctx.globalAlpha = 1;
    }
  },

  storyLength(stage) {
    return stage.story.reduce((s, p) => s + p.length, 0);
  },

  pause(ctx, cam) {
    this.panel(ctx, cam, 0.6);
    ctx.textAlign = 'center';
    ctx.font = `700 40px ${FONT_TITLE}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText('Pausa', cam.viewW / 2, cam.viewH / 2 - 10);
    ctx.font = `500 14px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.7)';
    ctx.fillText('Esc / P para continuar  ·  M liga/desliga o som', cam.viewW / 2, cam.viewH / 2 + 24);
  },

  gameOver(ctx, cam, t) {
    this.panel(ctx, cam, Math.min(0.75, t * 0.8));
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(t * 1.5, 0, 1);
    ctx.font = `700 ${Math.round(Math.min(60, cam.viewW * 0.08))}px ${FONT_TITLE}`;
    ctx.fillStyle = '#c8322b';
    ctx.fillText('Derrotado', cam.viewW / 2, cam.viewH / 2 - 10);
    ctx.font = `500 16px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.8)';
    ctx.fillText('Clique ou Enter para tentar esta vila de novo', cam.viewW / 2, cam.viewH / 2 + 30);
    ctx.globalAlpha = 1;
  },

  victory(ctx, cam, t, stats) {
    this.panel(ctx, cam, Math.min(0.85, t * 0.6));
    const cx = cam.viewW / 2;
    ctx.globalAlpha = clamp(t * 0.8, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(Math.min(64, cam.viewW * 0.08))}px ${FONT_TITLE}`;
    ctx.fillStyle = '#ffcf6a';
    ctx.fillText('A relíquia voltou para casa', cx, cam.viewH * 0.22);
    ctx.font = `400 18px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(243,233,216,0.9)';
    let y = cam.viewH * 0.22 + 60;
    for (const para of ENDING) {
      for (const l of this.wrap(ctx, para, Math.min(640, cam.viewW - 64))) {
        ctx.fillText(l, cx, y);
        y += 28;
      }
      y += 12;
    }
    const mins = Math.floor(stats.time / 60), secs = Math.floor(stats.time % 60);
    ctx.font = `600 15px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.75)';
    ctx.fillText(`Tempo ${mins}:${String(secs).padStart(2, '0')}   ·   Inimigos derrotados ${stats.kills}   ·   Maior combo ${stats.maxCombo}`, cx, y + 20);
    if (t > 2) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
      ctx.fillStyle = '#ffcf6a';
      ctx.fillText('Clique ou Enter para voltar ao título', cx, y + 56);
    }
    ctx.globalAlpha = 1;
  },

  loading(ctx, cam, frac) {
    ctx.fillStyle = '#0e0b09';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    ctx.textAlign = 'center';
    ctx.font = `600 14px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.7)';
    ctx.fillText('Afiando a lâmina…', cam.viewW / 2, cam.viewH / 2 - 16);
    this.bar(ctx, cam.viewW / 2 - 120, cam.viewH / 2, 240, 6, frac, '#c8322b');
  },
};
