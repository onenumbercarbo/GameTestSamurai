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
    if (p.mods.iai) {
      ctx.fillStyle = p.heavyCd <= 0 ? '#a9d4ff' : 'rgba(169,212,255,0.3)';
      ctx.fillText(p.heavyCd <= 0 ? 'IAI ●' : 'IAI ○', 80, top + 48);
    }
    const weapon = [...p.items].reverse().map((id) => ITEMS[id]).find((it) => it && (it.icon === 'blade' || it.icon === 'wind'));
    ctx.fillStyle = 'rgba(243,233,216,0.6)';
    ctx.fillText(weapon ? weapon.name : 'Katana do Andarilho', 20, top + 66);

    // Nome da fase + objetivo
    ctx.textAlign = 'center';
    ctx.font = `700 15px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(243,233,216,0.85)';
    ctx.fillText(w.stage.name, cam.viewW / 2, top + 10);
    ctx.font = `500 12px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.65)';
    ctx.fillText(w.objectiveText(), cam.viewW / 2, top + 30);
    const danger = (w.villagers || []).filter((v) => !v.freed).length;
    if (danger) {
      ctx.fillStyle = `rgba(255,190,150,${0.7 + 0.3 * Math.sin(w.time * 4)})`;
      ctx.fillText(`Aldeões em perigo nesta vila: ${danger}`, cam.viewW / 2, top + 48);
    }

    // Combo
    const st = w.stats;
    if (st.combo > 1) {
      ctx.textAlign = 'right';
      ctx.globalAlpha = clamp(st.comboTimer / 0.4, 0, 1);
      ctx.font = `800 34px ${FONT_TITLE}`;
      ctx.fillStyle = '#ff6a50';
      const cxr = TOUCH.active ? cam.viewW - 170 : cam.viewW - 24;
      ctx.fillText(`${st.combo}`, cxr - 52, top + 30);
      ctx.font = `700 14px ${FONT_UI}`;
      ctx.fillStyle = '#f3e9d8';
      ctx.fillText('HITS', cxr, top + 28);
      ctx.globalAlpha = 1;
    }

    // Barra do boss
    const b = w.boss;
    if (b && w.bossFight && b.alive) {
      const bw = Math.min(560, cam.viewW - (TOUCH.active ? 380 : 80));
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

  /** "Clique ou Enter" no computador, "Toque" no celular. */
  tapWord() {
    return TOUCH.active ? 'Toque' : 'Clique ou Enter';
  },

  /** Botão retangular de menu (funciona com mouse e toque). */
  menuButton(ctx, r, label, primary, t) {
    ctx.save();
    ctx.fillStyle = primary ? `rgba(200,50,43,${0.85 + 0.1 * Math.sin(t * 3)})` : 'rgba(20,14,10,0.75)';
    ctx.strokeStyle = primary ? '#ffcf6a' : 'rgba(243,233,216,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(r.x, r.y, r.w, r.h, 6) : ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f3e9d8';
    ctx.font = `700 ${Math.round(r.h * 0.38)}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.restore();
  },

  title(ctx, cam, t, save) {
    this.panel(ctx, cam, 0.55);
    const cx = cam.viewW / 2;
    const s = clamp(Math.min(cam.viewW / 1100, cam.viewH / 700), 0.45, 1.2);
    const top = cam.viewH * (cam.viewH < 500 ? 0.2 : 0.27);
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(120 * s)}px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(200,50,43,0.9)';
    ctx.fillText('浪人', cx, top + 40 * s);
    ctx.font = `700 ${Math.round(54 * s)}px ${FONT_TITLE}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText('RŌNIN', cx, top + 106 * s);
    ctx.font = `400 ${Math.round(22 * s)}px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(243,233,216,0.8)';
    ctx.fillText('A Relíquia Roubada', cx, top + 140 * s);

    // Botões (mouse ou toque).
    const bw = Math.min(260, cam.viewW * 0.42), bh = Math.max(40, 46 * s);
    const by = top + 170 * s;
    const buttons = [{ id: 'new', label: 'Novo jogo', primary: true }];
    if (save > 0) buttons.push({ id: 'continue', label: `Continuar: ${STAGES[save].name}` });
    if (TOUCH.active && document.fullscreenEnabled) buttons.push({ id: 'fullscreen', label: 'Tela cheia' });
    const horizontal = cam.viewH < 520;
    this.titleButtons = buttons.map((b, i) => {
      const r = horizontal
        ? { x: cx - (buttons.length * (bw + 12) - 12) / 2 + i * (bw + 12), y: by, w: bw, h: bh }
        : { x: cx - bw / 2, y: by + i * (bh + 12), w: bw, h: bh };
      this.menuButton(ctx, r, b.label, b.primary, t);
      return { ...r, id: b.id };
    });

    const lines = TOUCH.active
      ? ['Joystick: arraste o polegar na metade esquerda da tela', 'CORTE (segure para combo) · DASH (esquiva) · AGIR (baús e reféns) · IAI (com o pergaminho)']
      : ['WASD / setas — mover      Mouse — mirar      Clique — corte (3 cliques = combo)',
        'Espaço / Shift — dash      Dash + clique — investida      Botão direito — iaijutsu (item)      E — baús e reféns',
        'Enter — novo jogo      C — continuar      Esc / P — pausa e tesouros      M — som'];
    ctx.font = `500 ${Math.round(clamp(13 * s, 10, 13))}px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.6)';
    const ly = Math.max(this.titleButtons[this.titleButtons.length - 1].y + bh + 28, cam.viewH * 0.8);
    lines.forEach((l, i) => ctx.fillText(l, cx, Math.min(cam.viewH - 12 - (lines.length - 1 - i) * 18, ly + i * 20)));
  },

  /** Aviso para girar o celular (o jogo fica pausado na vertical). */
  rotateHint(ctx, cam) {
    ctx.fillStyle = 'rgba(10,7,6,0.88)';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    const cx = cam.viewW / 2, cy = cam.viewH / 2;
    ctx.save();
    ctx.translate(cx, cy - 40);
    ctx.rotate(Math.sin(performance.now() / 500) * 0.5 - 0.5);
    ctx.strokeStyle = '#ffcf6a';
    ctx.lineWidth = 3;
    ctx.strokeRect(-22, -36, 44, 72);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f3e9d8';
    ctx.font = `700 18px ${FONT_UI}`;
    ctx.fillText('Gire o celular para jogar', cx, cy + 40);
    ctx.font = `500 14px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.7)';
    ctx.fillText('O jogo fica pausado na vertical', cx, cy + 64);
  },

  /** Posição dos botões de toque neste frame (também usada pelo Input). */
  touchLayout(w) {
    const cam = w.camera;
    const lb = cam.viewH * 0.1 * cam.letterbox;
    const s = clamp(Math.min(cam.viewW, cam.viewH) / 400, 0.8, 1.35);
    const R = cam.viewW - 24 * s, B = cam.viewH - 22 * s - lb;
    const b = [
      { id: 'attack', x: R - 48 * s, y: B - 50 * s, r: 46 * s, label: '斬', sub: 'CORTE' },
      { id: 'dash', x: R - 150 * s, y: B - 26 * s, r: 34 * s, label: '»', sub: 'DASH' },
      { id: 'pause', x: cam.viewW - 30 * s, y: 30 * s + lb, r: 20 * s, label: 'II' },
    ];
    const p = w.player;
    if (p.mods.iai) b.push({ id: 'heavy', x: R - 70 * s, y: B - 150 * s, r: 32 * s, label: '居', sub: 'IAI', off: p.heavyCd > 0 });
    const near = (w.chests || []).some((c) => !c.opened && c.near()) || (w.villagers || []).some((v) => !v.freed && v.near());
    if (near) b.push({ id: 'act', x: R - 165 * s, y: B - 120 * s, r: 32 * s, label: '手', sub: 'AGIR', glow: true });
    return b;
  },

  touchControls(ctx, w, input) {
    if (!TOUCH.active || w.cutscene) return;
    const s = clamp(Math.min(w.camera.viewW, w.camera.viewH) / 400, 0.8, 1.35);
    // Joystick (fantasma quando solto, para mostrar onde fica).
    const st = input.stick;
    const active = st.id !== null;
    const ox = active ? st.ox : 90 * s, oy = active ? st.oy : w.camera.viewH - 90 * s;
    const R = input.stickRadius;
    ctx.save();
    ctx.globalAlpha = active ? 0.55 : 0.22;
    ctx.fillStyle = 'rgba(20,14,10,0.6)';
    ctx.strokeStyle = 'rgba(243,233,216,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    let kx = ox, ky = oy;
    if (active) {
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      kx = ox + dx * k; ky = oy + dy * k;
    }
    ctx.globalAlpha = active ? 0.85 : 0.3;
    ctx.fillStyle = '#c8322b';
    ctx.beginPath(); ctx.arc(kx, ky, R * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    for (const b of input.buttons) {
      const held = [...input.held.values()].some((h) => h.id === b.id);
      ctx.save();
      ctx.globalAlpha = b.off ? 0.3 : held ? 0.95 : 0.7;
      ctx.fillStyle = b.id === 'attack' ? 'rgba(200,50,43,0.85)' : b.glow ? `rgba(200,150,40,${0.8 + 0.2 * Math.sin(w.time * 6)})` : 'rgba(20,14,10,0.7)';
      ctx.strokeStyle = 'rgba(243,233,216,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (held ? 0.92 : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f3e9d8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(b.r * (b.sub ? 0.75 : 0.6))}px ${b.id === 'dash' || b.id === 'pause' ? FONT_UI : FONT_TITLE}`;
      ctx.fillText(b.label, b.x, b.y - (b.sub ? b.r * 0.12 : 0));
      if (b.sub) {
        ctx.font = `700 ${Math.round(9 * s)}px ${FONT_UI}`;
        ctx.fillText(b.sub, b.x, b.y + b.r * 0.55);
      }
      ctx.restore();
    }
  },

  story(ctx, cam, stage, t, index, total) {
    this.panel(ctx, cam, 0.86);
    const cx = cam.viewW / 2;
    const k = clamp(cam.viewH / 720, 0.55, 1); // telas baixas (celular deitado) encolhem o texto
    const maxW = Math.min(640, cam.viewW - 64);
    let y = cam.viewH * 0.12;
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(13 * k + 1)}px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.5)';
    ctx.fillText(index < total ? `CAPÍTULO ${index + 1} DE ${total}` : 'EPÍLOGO', cx, y);
    y += 62 * k;
    ctx.font = `700 ${Math.round(Math.min(64, cam.viewW * 0.08) * k)}px ${FONT_TITLE}`;
    ctx.fillStyle = 'rgba(200,50,43,0.9)';
    ctx.fillText(stage.kanji, cx, y);
    y += 42 * k;
    ctx.font = `700 ${Math.round(Math.min(30, cam.viewW * 0.05) * k + 4)}px ${FONT_TITLE}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText(stage.name, cx, y);
    y += 50 * k;

    // Texto "datilografado"
    const fs = Math.round(18 * k + 2);
    ctx.font = `400 ${fs}px ${FONT_TITLE}`;
    let shown = Math.floor(t * 55);
    ctx.fillStyle = 'rgba(243,233,216,0.92)';
    for (const para of stage.story) {
      const lines = this.wrap(ctx, para, maxW);
      for (const l of lines) {
        if (shown <= 0) break;
        ctx.fillText(l.slice(0, shown), cx, y);
        shown -= l.length;
        y += fs * 1.5;
      }
      y += fs * 0.7;
    }
    if (shown > 0) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.font = `600 14px ${FONT_UI}`;
      ctx.fillStyle = '#ffcf6a';
      ctx.fillText(`${this.tapWord()} para ${index < total ? 'seguir' : 'voltar ao título'}`, cx, Math.min(cam.viewH - 16, y + 18));
      ctx.globalAlpha = 1;
    }
  },

  storyLength(stage) {
    return stage.story.reduce((s, p) => s + p.length, 0);
  },

  pause(ctx, cam, items) {
    this.panel(ctx, cam, 0.7);
    const cx = cam.viewW / 2;
    ctx.textAlign = 'center';
    ctx.font = `700 40px ${FONT_TITLE}`;
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText('Pausa', cx, cam.viewH * 0.3);
    ctx.font = `500 14px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(243,233,216,0.7)';
    ctx.fillText(TOUCH.active ? 'Toque na tela para continuar' : 'Esc / P para continuar  ·  M liga/desliga o som', cx, cam.viewH * 0.3 + 30);
    ctx.font = `700 16px ${FONT_TITLE}`;
    ctx.fillStyle = '#ffcf6a';
    ctx.fillText(`Tesouros encontrados (${items.length}/${Object.keys(ITEMS).length})`, cx, cam.viewH * 0.3 + 80);
    ctx.font = `500 14px ${FONT_UI}`;
    Object.entries(ITEMS).forEach(([id, it], i) => {
      const have = items.includes(id);
      ctx.fillStyle = have ? 'rgba(243,233,216,0.95)' : 'rgba(243,233,216,0.35)';
      ctx.fillText(have ? `${it.name}: ${it.desc}` : '???  (escondido em alguma vila)', cx, cam.viewH * 0.3 + 108 + i * 24);
    });
  },

  /**
   * Minimapa isométrico com névoa: só mostra o que o jogador já viu.
   * Tesouros e emboscadas aparecem quando entram na área explorada.
   */
  minimap(ctx, w) {
    if (w.cutscene) return;
    const cam = w.camera, L = w.level;
    const size = TOUCH.active ? Math.min(130, cam.viewW * 0.18) : Math.min(190, cam.viewW * 0.22);
    const hw = size / (L.W + L.H), hh = hw / 2;
    const ox = cam.viewW - 18 - size / 2;
    const oy = TOUCH.active
      ? 64 + cam.viewH * 0.1 * cam.letterbox // no celular: canto superior (os botões ocupam a parte de baixo)
      : cam.viewH - 18 - (L.W + L.H) * hh - cam.viewH * 0.1 * cam.letterbox;
    const pt = (x, y) => ({ x: ox + (x - y) * hw, y: oy + (x + y) * hh });
    // Base pré-desenhada uma vez por fase.
    if (!L.miniCanvas || L.miniHw !== hw) {
      const dpr = 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil(size * dpr) + 4;
      c.height = Math.ceil((L.W + L.H) * hh * dpr) + 4;
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      const lp = (x, y) => ({ x: size / 2 + (x - y) * hw, y: (x + y) * hh });
      for (let j = 0; j < L.H; j++) {
        for (let i = 0; i < L.W; i++) {
          const t = L.tiles[j * L.W + i];
          g.fillStyle = L.blocked[j * L.W + i] ? '#2b2620' : t === T_PATH ? '#8a6f4a' : t === T_STONE ? '#8d8a82' : '#3f5a2e';
          const a = lp(i, j), b = lp(i + 1, j), c2 = lp(i + 1, j + 1), d = lp(i, j + 1);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c2.x, c2.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
        }
      }
      L.miniCanvas = c;
      L.miniHw = hw;
    }
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(L.miniCanvas, ox - size / 2, oy, L.miniCanvas.width / 2, L.miniCanvas.height / 2);
    // Névoa nos tiles não explorados: canvas próprio, só "apaga" os tiles recém-vistos.
    if (!L.fogCanvas || L.fogHw !== hw) {
      const f = document.createElement('canvas');
      f.width = L.miniCanvas.width;
      f.height = L.miniCanvas.height;
      const g = f.getContext('2d');
      g.scale(2, 2);
      g.fillStyle = 'rgba(12,10,8,0.92)';
      g.fillRect(0, 0, f.width, f.height);
      L.fogCanvas = f;
      L.fogHw = hw;
      L.fogDone = new Uint8Array(L.W * L.H);
    }
    {
      const g = L.fogCanvas.getContext('2d');
      const lp = (x, y) => ({ x: size / 2 + (x - y) * hw, y: (x + y) * hh });
      g.save();
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      let any = false;
      for (let n = 0; n < w.explored.length; n++) {
        if (!w.explored[n] || L.fogDone[n]) continue;
        L.fogDone[n] = 1;
        any = true;
        const i = n % L.W, j = (n / L.W) | 0;
        const a = lp(i - 0.05, j - 0.05), b = lp(i + 1.05, j - 0.05), c2 = lp(i + 1.05, j + 1.05), d = lp(i - 0.05, j + 1.05);
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c2.x, c2.y); g.lineTo(d.x, d.y); g.closePath();
      }
      if (any) g.fill();
      g.restore();
    }
    ctx.drawImage(L.fogCanvas, ox - size / 2, oy, L.fogCanvas.width / 2, L.fogCanvas.height / 2);
    // Contorno
    const n = pt(0, 0), e = pt(L.W, 0), s2 = pt(L.W, L.H), wv = pt(0, L.H);
    ctx.strokeStyle = 'rgba(243,233,216,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(wv.x, wv.y); ctx.closePath(); ctx.stroke();
    const seen = (x, y) => w.explored[clamp(Math.floor(y), 0, L.H - 1) * L.W + clamp(Math.floor(x), 0, L.W - 1)];
    const dot = (x, y, r, color) => {
      const q = pt(x, y);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const enc of w.encounters) {
      if (enc.state === 'done' || !seen(enc.center[0], enc.center[1])) continue;
      const q = pt(enc.center[0], enc.center[1]);
      ctx.strokeStyle = '#ff5a4a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(q.x - 4, q.y - 4); ctx.lineTo(q.x + 4, q.y + 4); ctx.moveTo(q.x + 4, q.y - 4); ctx.lineTo(q.x - 4, q.y + 4); ctx.stroke();
    }
    for (const c of w.chests) {
      if (!c.opened && seen(c.x, c.y)) dot(c.x, c.y, 3.5 + Math.sin(w.time * 5), c.locked ? '#d08a50' : '#ffcf6a');
    }
    if (w.stage.exit) {
      const q = pt(w.stage.exit[0], w.stage.exit[1]);
      ctx.fillStyle = w.exitOpen ? '#ffcf6a' : '#c8322b';
      ctx.fillRect(q.x - 4, q.y - 5, 8, 2);
      ctx.fillRect(q.x - 3, q.y - 5, 1.5, 7);
      ctx.fillRect(q.x + 1.5, q.y - 5, 1.5, 7);
    }
    for (const v of w.villagers || []) if (!v.freed && seen(v.x, v.y)) dot(v.x, v.y, 2.6, '#7fd0ff');
    for (const en of w.enemies) if (en.alive && en.state !== 'camp') dot(en.x, en.y, 2, '#ff5a4a');
    if (w.boss && w.boss.alive) dot(w.boss.x, w.boss.y, 3.5, '#ff2a1a');
    dot(w.player.x, w.player.y, 3, '#ffffff');
    ctx.restore();
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
    ctx.fillText(`${this.tapWord()} para tentar esta vila de novo`, cam.viewW / 2, cam.viewH / 2 + 30);
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
    ctx.fillText(`Tempo ${mins}:${String(secs).padStart(2, '0')}   ·   Inimigos derrotados ${stats.kills}   ·   Aldeões salvos ${stats.rescued}/${stats.villagersTotal}   ·   Maior combo ${stats.maxCombo}`, cx, y + 20);
    if (t > 2) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
      ctx.fillStyle = '#ffcf6a';
      ctx.fillText(`${this.tapWord()} para voltar ao título`, cx, y + 56);
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
