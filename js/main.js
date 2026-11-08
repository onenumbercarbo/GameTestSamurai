/**
 * main.js — Bootstrap, game loop e renderização do mundo.
 */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const input = new Input(canvas);
  const camera = new Camera();

  // "world" é o contexto compartilhado que sistemas recebem (combate, efeitos...).
  // Cresce para um ECS / gerenciador de cenas quando houver vilarejo, floresta etc.
  const world = {
    camera,
    effects: new Effects(),
    player: new Player(CONFIG.MAP_W / 2, CONFIG.MAP_H / 2),
    enemies: [],
    hitStop: 0,     // segundos restantes de congelamento (impacto)
    comboHits: 0,   // contador de hits seguidos (estilo GoW)
    comboTimer: 0,
    debug: false,
  };

  // Um grupo de bonecos próximo, para testar acertos múltiplos num só arco.
  const cx = CONFIG.MAP_W / 2;
  const cy = CONFIG.MAP_H / 2;
  [[3, 0], [3.6, 0.9], [3.4, -1], [0, 3.2], [-0.9, 3.5], [-3, -3], [-3.5, -2.2], [4.5, 4.5]]
    .forEach(([dx, dy]) => world.enemies.push(new TrainingDummy(cx + dx, cy + dy)));

  camera.snapTo(world.player.x, world.player.y);

  /* ---------------------------- resize / HiDPI ---------------------------- */
  // O canvas tem resolução interna = tamanho CSS × devicePixelRatio, para ficar
  // nítido em telas retina. Depois escalamos o contexto e desenhamos em px CSS.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  /* --------------------------------- grid --------------------------------- */

  // Hash determinístico por tile para variar levemente a cor da grama.
  const tileNoise = (i, j) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /**
   * Desenha o grid isométrico.
   *
   * O tile (i, j) ocupa no mundo o quadrado [i, i+1] × [j, j+1]. Projetando os
   * 4 cantos com Iso.toScreen obtemos um losango (diamante):
   *
   *            topo (i, j)
   *              /\
   *  esq (i,j+1)    dir (i+1, j)
   *              \/
   *          base (i+1, j+1)
   *
   * Ordem de desenho: linha por linha de i+j crescente não é necessária para
   * tiles planos (não se sobrepõem), mas será para tiles com altura/paredes.
   */
  function drawGrid() {
    const margin = CONFIG.TILE_W;
    for (let j = 0; j < CONFIG.MAP_H; j++) {
      for (let i = 0; i < CONFIG.MAP_W; i++) {
        const top = camera.worldToScreen(i, j);
        // Culling: pula tiles fora da tela (diamante cabe numa caixa TILE_W × TILE_H).
        if (top.x < -margin || top.x > camera.viewW + margin ||
            top.y < -margin || top.y > camera.viewH + margin) continue;

        const right = camera.worldToScreen(i + 1, j);
        const bottom = camera.worldToScreen(i + 1, j + 1);
        const left = camera.worldToScreen(i, j + 1);

        const n = tileNoise(i, j);
        const checker = (i + j) % 2 === 0 ? 0 : 6;
        const edge = i === 0 || j === 0 || i === CONFIG.MAP_W - 1 || j === CONFIG.MAP_H - 1;
        const l = (edge ? 20 : 30) + checker + n * 6;
        ctx.fillStyle = edge ? `hsl(30, 25%, ${l}%)` : `hsl(${78 + n * 14}, 28%, ${l}%)`;

        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(left.x, left.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  /** Destaca o tile sob o cursor — prova visual de que a inversa iso->mundo funciona. */
  function drawCursorTile() {
    if (!input.mouse.inside) return;
    const w = camera.screenToWorld(input.mouse.x, input.mouse.y);
    const i = Math.floor(w.x);
    const j = Math.floor(w.y);
    if (i < 0 || j < 0 || i >= CONFIG.MAP_W || j >= CONFIG.MAP_H) return;
    const pts = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([x, y]) => camera.worldToScreen(x, y));
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 240, 200, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.55)';
    ctx.stroke();

    // Linha tracejada no chão do jogador até a mira.
    const p = world.player;
    const a = camera.worldToScreen(p.x, p.y);
    const b = camera.worldToScreen(w.x, w.y);
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255, 90, 70, 0.35)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawOverlay(fps) {
    const p = world.player;
    // Contador de combo (feedback estilo hack and slash)
    if (world.comboHits > 1) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ff6a50';
      ctx.globalAlpha = clamp(world.comboTimer / 0.4, 0, 1);
      ctx.fillText(`${world.comboHits} HITS`, camera.viewW - 24, 56);
      ctx.restore();
    }

    if (!world.debug) return;
    const c = p.combo.current;
    const lines = [
      `FPS ${fps.toFixed(0)}`,
      `mundo (${p.x.toFixed(2)}, ${p.y.toFixed(2)})  estado: ${p.state}`,
      `mira ${((p.aimAngle * 180) / Math.PI).toFixed(0)}°  golpe: ${c ? c.def.name : '-'}  step ${p.combo.step}`,
    ];
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(16, camera.viewH - 70, 380, 56);
    ctx.fillStyle = '#9fe';
    lines.forEach((l, k) => ctx.fillText(l, 24, camera.viewH - 52 + k * 16));
  }

  /* ------------------------------- update -------------------------------- */

  function update(dt) {
    world.player.update(dt, input, world);
    for (const e of world.enemies) e.update(dt);
    world.effects.update(dt);
    camera.follow(world.player.x, world.player.y, dt);

    if (world.comboTimer > 0) {
      world.comboTimer -= dt;
      if (world.comboTimer <= 0) world.comboHits = 0;
    }
  }

  /* ------------------------------- render -------------------------------- */

  function render(fps) {
    ctx.fillStyle = '#120d0a';
    ctx.fillRect(0, 0, camera.viewW, camera.viewH);

    drawGrid();
    drawCursorTile();

    // Ordenação por profundidade (painter's algorithm): no isométrico, o que
    // está mais "ao sul" (maior x + y) fica na frente.
    const drawables = [world.player, ...world.enemies].sort((a, b) => a.depth - b.depth);
    for (const d of drawables) d.draw(ctx, camera, world.debug);

    world.effects.draw(ctx, camera);
    drawOverlay(fps);
  }

  /* ------------------------------ game loop ------------------------------ */
  /**
   * Loop com requestAnimationFrame e delta-time variável (limitado a DT_MAX).
   *
   * Hit-stop: quando um golpe conecta, `world.hitStop` > 0 e a SIMULAÇÃO para
   * (dt = 0), mas continuamos renderizando e tremendo a câmera. Os inputs não
   * são descartados nesse período — ficam guardados até a simulação voltar.
   *
   * Evolução futura: trocar por passo fixo (ex.: 120 Hz com acumulador) para
   * física/combate determinísticos — útil para replays e balanceamento.
   */
  let last = performance.now();
  let fps = 60;

  function frame(now) {
    const rawDt = Math.min((now - last) / 1000, CONFIG.DT_MAX);
    last = now;
    fps = damp(fps, 1 / Math.max(rawDt, 1e-4), 5, rawDt);

    if (input.consumeDebugToggle()) world.debug = !world.debug;

    camera.updateShake(rawDt);

    if (world.hitStop > 0) {
      world.hitStop -= rawDt;
    } else {
      update(rawDt);
      input.endFrame();
    }

    render(fps);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Exposto apenas para depuração no console do navegador.
  window.__game = world;
})();
