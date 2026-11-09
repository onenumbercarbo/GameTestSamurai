/**
 * procgen.js — Geração procedural das vilas.
 *
 * Cada fase em stages.js é um MODELO: nome, história, clima, tipos de casa,
 * composição dos grupos de inimigos e o tesouro da vila. A cada vez que o
 * jogador entra na vila (ou tenta de novo após morrer), sorteamos uma
 * semente nova e geramos:
 *
 *   1. o CAMINHO: polilinha do canto oeste ao canto leste, com curvas aleatórias;
 *   2. as EMBOSCADAS: espalhadas ao longo do caminho;
 *   3. os ACAMPAMENTOS: dos dois lados do caminho, longe dele e uns dos outros,
 *      cada um ligado ao caminho por uma TRILHA estreita;
 *   4. os BAÚS: selo do portão num acampamento, tesouro em outro, comida nos demais;
 *   4b. a ARENA DO MINI-CHEFE: perto do fim do caminho, guardando o portão;
 *   5. as CASAS: encostadas no caminho, sem invadi-lo nem umas às outras;
 *   6. lanternas, caixas, fumaça e o ponto do plano de abertura.
 *
 * O resultado tem o mesmo formato das fases "feitas à mão", então Level e
 * main.js não precisam saber se a fase foi gerada ou desenhada.
 */
const ProcGen = (() => {
  /** Ponto e direção a uma fração t (0..1) do comprimento de uma polilinha. */
  function pointAt(path, t) {
    const lens = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      lens.push(l);
      total += l;
    }
    let d = t * total;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i] || i === lens.length - 1) {
        const k = lens[i] ? Math.min(1, d / lens[i]) : 0;
        const [ax, ay] = path[i], [bx, by] = path[i + 1];
        return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: (bx - ax) / (lens[i] || 1), dy: (by - ay) / (lens[i] || 1) };
      }
      d -= lens[i];
    }
    return { x: path[0][0], y: path[0][1], dx: 1, dy: 0 };
  }

  function distToPath(path, x, y) {
    let best = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      best = Math.min(best, distToSegment(x, y, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
    }
    return best;
  }

  function boxPathDist(path, b) {
    const pts = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2],
      [(b.x0 + b.x1) / 2, b.y0], [(b.x0 + b.x1) / 2, b.y1], [b.x0, (b.y0 + b.y1) / 2], [b.x1, (b.y0 + b.y1) / 2]];
    return Math.min(...pts.map(([x, y]) => distToPath(path, x, y)));
  }

  function boxGap(a, b) {
    const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
    const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
    return Math.hypot(dx, dy);
  }

  function generate(tpl, seed) {
    const rnd = makeRng(seed);
    const [W, H] = tpl.size;
    const A = (W * H) / 900; // fator de área em relação à vila original (30×30)
    const L = Math.sqrt(A);
    const between = (a, b) => a + rnd() * (b - a);
    const pick = (list) => list[Math.floor(rnd() * list.length)];

    // 1. Caminho com curvas: base na diagonal oeste→leste, desvios perpendiculares.
    const start = [between(2.2, 3.5), H - between(2.2, 3.5)];
    const end = [W - between(2.6, 3.4), between(2.6, 3.4)];
    const path = [[start[0] - 1.5, start[1] + 1.5], start];
    const n = Math.round(5 * L);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const off = (rnd() - 0.5) * 7.5 * Math.min(2.2, L); // desvio perpendicular (ao longo de (1,1)/√2)
      const x = start[0] + (end[0] - start[0]) * t + off * Math.SQRT1_2;
      const y = start[1] + (end[1] - start[1]) * t + off * Math.SQRT1_2;
      path.push([clamp(x, 3, W - 3), clamp(y, 3, H - 3)]);
    }
    path.push(end, [end[0] + 1.5, end[1] - 1.5]);
    const exit = [end[0], end[1] + 0.2];

    // 2. Emboscadas no caminho (grupos do modelo, em ciclo).
    const waves = [];
    const nAmb = tpl.ambushCount || tpl.ambushes.length;
    const tEnd = tpl.miniboss ? 0.78 : 0.82;
    for (let i = 0; i < nAmb; i++) {
      const groups = tpl.ambushes[i % tpl.ambushes.length];
      const t = 0.12 + (tEnd - 0.12) * (nAmb === 1 ? 0.5 : i / (nAmb - 1)) + (rnd() - 0.5) * 0.03;
      const p = pointAt(path, t);
      waves.push({ center: [p.x, p.y], r: groups.flat().length > 4 ? 6.3 : 5.8, groups });
    }

    // 2b. Arena do mini-chefe, perto do portão.
    let boss = null;
    if (tpl.miniboss) {
      const p = pointAt(path, 0.9);
      boss = { id: tpl.miniboss, mini: true, center: [p.x, p.y], spawn: [p.x + p.dx * 2.5, p.y + p.dy * 2.5], triggerR: 6.5, arenaR: 7.2, adds: tpl.bossAdds || [] };
    }

    // 3. Acampamentos: alternando os lados, longe do caminho e uns dos outros.
    const nCamps = tpl.campCount || tpl.camps.length;
    const camps = [];
    const campSpot = (north) => {
      let best = null, bestScore = -1;
      for (let k = 0; k < 160 * A; k++) {
        const x = between(4.5, W - 4.5), y = between(4.5, H - 4.5);
        const side = x + y < (W + H) / 2 - 2;
        if (side !== north) continue;
        if (waves.some((wv) => Math.hypot(wv.center[0] - x, wv.center[1] - y) < 9)) continue;
        if (boss && Math.hypot(boss.center[0] - x, boss.center[1] - y) < 12) continue;
        const d = distToPath(path, x, y);
        if (d < 7) continue;
        const sep = Math.min(99, ...camps.map((c) => Math.hypot(c[0] - x, c[1] - y)));
        const score = Math.min(d, 14) + Math.min(sep, 18) * 1.4;
        if (score > bestScore) { bestScore = score; best = [x, y]; }
      }
      return best || (north ? [5, 5] : [W - 5, H - 5]);
    };
    for (let i = 0; i < nCamps; i++) camps.push(campSpot(i % 2 === 0));
    camps.forEach((c, i) => waves.push({ center: c, r: 5, guard: true, groups: tpl.camps[i % tpl.camps.length] }));

    // Trilhas: do ponto mais próximo do caminho até cada acampamento.
    const trails = camps.map((c) => {
      let bt = 0, bd = Infinity;
      for (let t = 0; t <= 1; t += 0.01) {
        const q = pointAt(path, t);
        const d = Math.hypot(q.x - c[0], q.y - c[1]);
        if (d < bd) { bd = d; bt = t; }
      }
      const q = pointAt(path, bt);
      const pts = [[q.x, q.y]];
      for (const f of [0.35, 0.7]) {
        const x = q.x + (c[0] - q.x) * f, y = q.y + (c[1] - q.y) * f;
        const nx = -(c[1] - q.y) / bd, ny = (c[0] - q.x) / bd;
        const off = (rnd() - 0.5) * 3;
        pts.push([clamp(x + nx * off, 2, W - 2), clamp(y + ny * off, 2, H - 2)]);
      }
      // termina antes da fogueira (o acampamento fica numa clareira)
      pts.push([c[0] + (q.x - c[0]) * (2.2 / bd), c[1] + (q.y - c[1]) * (2.2 / bd)]);
      return pts;
    });

    // 4. Baús: selo num acampamento, tesouro em outro, comida nos demais.
    const order = camps.map((_, i) => i).sort(() => rnd() - 0.5);
    const chestAt = (c) => {
      const a = between(-Math.PI * 0.95, -Math.PI * 0.55); // atrás da fogueira (lado norte)
      return [c[0] + Math.cos(a) * 1.7, c[1] + Math.sin(a) * 1.7];
    };
    const loot = [];
    order.forEach((ci, k) => {
      const s = chestAt(camps[ci]);
      if (k === 0 && tpl.seal !== false) loot.push(['seal', s[0], s[1]]);
      else if (k === 1 && tpl.item) loot.push(['item', tpl.item, s[0], s[1]]);
      else loot.push(['food', s[0], s[1]]);
    });

    // Áreas que devem ficar livres de casas e vegetação.
    const clear = [
      [start[0], start[1], 3], [exit[0], exit[1], 3.4],
      ...camps.map((c) => [c[0], c[1], 4.4]),
      ...(boss ? [[boss.center[0], boss.center[1], 7.5]] : []),
    ];
    const keepOut = (x, y, r = 0) => clear.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] + r);

    // Praça de pedra numa das emboscadas (o "centro da vila").
    const plazas = [];
    if (tpl.plaza) {
      for (const k of [1, Math.floor(nAmb / 2) + 1]) {
        const wv = waves[Math.min(k, nAmb - 1)];
        plazas.push([wv.center[0] + between(-0.6, 0.6), wv.center[1] + between(-0.6, 0.6), between(2.1, 2.6)]);
      }
    }
    // Campo de duelo do mini-chefe.
    if (boss) plazas.push([boss.center[0], boss.center[1], 5.2]);

    // 5. Casas ao longo do caminho.
    const props = [];
    const boxes = [];
    const pw = 1.3;
    const tryPlace = (type, x, y, minPath, minGap) => {
      const pr = new Prop(type, x, y);
      const b = pr.box;
      if (b.x0 < 0.8 || b.y0 < 0.8 || b.x1 > W - 0.8 || b.y1 > H - 0.8) return false;
      if (boxPathDist(path, b) < pw + minPath) return false;
      if (boxes.some((o) => boxGap(o, b) < minGap)) return false;
      if (clear.some((c) => boxGap(b, { x0: c[0], y0: c[1], x1: c[0], y1: c[1] }) < c[2])) return false;
      if (waves.some((wv) => boxGap(b, { x0: wv.center[0], y0: wv.center[1], x1: wv.center[0], y1: wv.center[1] }) < 1.6)) return false;
      props.push([type, x, y]);
      boxes.push(b);
      return true;
    };
    let shrineAt = null;
    if (tpl.shrine) {
      // Santuário da aldeia: perto do começo, ao norte do caminho, com praça.
      for (let k = 0; k < 80 && !shrineAt; k++) {
        const p = pointAt(path, between(0.15, 0.4));
        const side = -1; // norte = (−1,−1)
        const d = between(4.5, 6.5);
        const x = p.x + side * d * Math.SQRT1_2 + 0.7, y = p.y + side * d * Math.SQRT1_2 + 0.7;
        if (tryPlace('shrine', x, y, 2.2, 2)) {
          shrineAt = [x, y];
          plazas.push([x + 1.1, y + 1.1, 2.1]);
          props.push(['lantern', x + 2.3, y + 0.6], ['lantern', x + 0.6, y + 2.3]);
        }
      }
    }
    const houseCount = Math.round(between(tpl.houses.count[0], tpl.houses.count[1] + 0.99) * A);
    let placed = 0;
    for (let k = 0; k < 500 * A && placed < houseCount; k++) {
      const type = pick(tpl.houses.types);
      const p = pointAt(path, between(0.08, 0.92));
      const side = rnd() < 0.5 ? -1 : 1;
      // perpendicular ao caminho (no plano do mundo)
      const nx = -p.dy * side, ny = p.dx * side;
      // a maioria colada no caminho; algumas mais afastadas (sítios e casas isoladas)
      const d = rnd() < 0.7 ? between(2.4, 5.2) : between(6, 14);
      // o apoio da casa é o canto SUL: empurra para que a caixa fique ao lado do caminho
      const x = p.x + nx * d + (side > 0 ? 1.8 : 0.4), y = p.y + ny * d + (side > 0 ? 1.8 : 0.4);
      if (trails.some((tr) => boxPathDist(tr, new Prop(type, x, y).box) < 1.6)) continue;
      if (tryPlace(type, x, y, 0.7, 1.4)) {
        placed++;
        // caixas encostadas na frente da casa
        const b = boxes[boxes.length - 1];
        if (rnd() < 0.6) props.push([pick(['crate', 'crate_small', 'crate_tied']), b.x1 + 0.55, b.y0 + between(0.3, b.y1 - b.y0)]);
      }
    }

    // 6. Lanternas ao longo do caminho e fumaça de casas queimadas.
    for (let k = 0; k < (tpl.lanterns || 0) * A; k++) {
      const p = pointAt(path, between(0.1, 0.9));
      const side = rnd() < 0.5 ? -1 : 1;
      const x = p.x - p.dy * side * 2.1, y = p.y + p.dx * side * 2.1;
      if (!keepOut(x, y) && boxes.every((b) => boxGap(b, { x0: x, y0: y, x1: x, y1: y }) > 0.8)) props.push(['lantern2', x, y]);
    }
    const smoke = [];
    for (let k = 0; k < (tpl.smoke || 0) * L && k < boxes.length; k++) {
      const b = boxes[Math.floor(rnd() * boxes.length)];
      smoke.push([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
    }

    const mid = pointAt(path, 0.5);
    return {
      ...tpl,
      seed,
      seal: tpl.seal !== false,
      boss,
      trails,
      decor: Math.round(26 * A),
      start,
      exit,
      path,
      plazas,
      props,
      waves,
      loot,
      smoke,
      clear: [...clear, ...waves.map((wv) => [wv.center[0], wv.center[1], wv.guard ? 4.2 : 2.4])],
      scatter: tpl.scatter ? { ...tpl.scatter, count: Math.round(tpl.scatter.count * A), seed: Math.floor(rnd() * 1e6) } : null,
      establish: shrineAt ? [shrineAt[0] + 1, shrineAt[1] + 1, 1.05] : [mid.x, mid.y, 1.1],
      shots: shrineAt ? [{ at: [shrineAt[0] + 1, shrineAt[1] + 1], r: 3.2, zoom: 1.8, lean: 0.4 }] : [],
    };
  }

  return { generate };
})();

/** Monta a fase `index`: gerada (com semente) ou a versão fixa (boss). */
function buildStage(index, seed) {
  const tpl = STAGES[index];
  if (tpl.procedural) return ProcGen.generate(tpl, seed);
  // Fase fixa (santuário do boss): só a vegetação muda a cada visita.
  return { ...tpl, seed, scatter: tpl.scatter ? { ...tpl.scatter, seed: seed % 100000 } : null };
}
