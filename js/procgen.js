/**
 * procgen.js — Geração procedural das vilas.
 *
 * Cada fase em stages.js é um MODELO: nome, história, clima, tipos de casa,
 * composição dos grupos de inimigos e o tesouro da vila. A cada vez que o
 * jogador entra na vila (ou tenta de novo após morrer), sorteamos uma
 * semente nova e geramos:
 *
 *   1. o CAMINHO: polilinha do canto oeste ao canto leste, com curvas aleatórias;
 *   2. as EMBOSCADAS: em pontos sorteados ao longo do caminho (~28%, 52%, 76%);
 *   3. os ACAMPAMENTOS: um de cada lado do caminho (norte e sul), longe dele;
 *   4. os BAÚS: selo do portão num acampamento, tesouro no outro (lado sorteado);
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
    const between = (a, b) => a + rnd() * (b - a);
    const pick = (list) => list[Math.floor(rnd() * list.length)];

    // 1. Caminho com curvas: base na diagonal oeste→leste, desvios perpendiculares.
    const start = [between(2.2, 3.5), H - between(2.2, 3.5)];
    const end = [W - between(2.6, 3.4), between(2.6, 3.4)];
    const path = [[start[0] - 1.5, start[1] + 1.5], start];
    const n = 5;
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const off = (rnd() - 0.5) * 7.5; // desvio perpendicular (ao longo de (1,1)/√2)
      const x = start[0] + (end[0] - start[0]) * t + off * Math.SQRT1_2;
      const y = start[1] + (end[1] - start[1]) * t + off * Math.SQRT1_2;
      path.push([clamp(x, 3, W - 3), clamp(y, 3, H - 3)]);
    }
    path.push(end, [end[0] + 1.5, end[1] - 1.5]);
    const exit = [end[0], end[1] + 0.2];

    // 2. Emboscadas no caminho.
    const waves = [];
    const fracs = [0.28, 0.52, 0.76];
    tpl.ambushes.forEach((groups, i) => {
      const p = pointAt(path, fracs[i] + (rnd() - 0.5) * 0.06);
      waves.push({ center: [p.x, p.y], r: groups.flat().length > 4 ? 6.3 : 5.8, groups });
    });

    // 3. Acampamentos: o lugar mais afastado do caminho em cada lado.
    const campSpot = (north) => {
      let best = null, bestD = -1;
      for (let k = 0; k < 140; k++) {
        const x = between(4.5, W - 4.5), y = between(4.5, H - 4.5);
        const side = x + y < (W + H) / 2 - 2;
        if (side !== north) continue;
        const d = distToPath(path, x, y);
        if (waves.some((wv) => Math.hypot(wv.center[0] - x, wv.center[1] - y) < 9)) continue;
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      return best || (north ? [5, 5] : [W - 5, H - 5]);
    };
    const camps = [campSpot(true), campSpot(false)];
    tpl.camps.forEach((groups, i) => waves.push({ center: camps[i], r: 5, guard: true, groups }));

    // 4. Baús: selo num acampamento, tesouro no outro (sorteado).
    const sealFirst = rnd() < 0.5;
    const chestAt = (c) => {
      const a = between(-Math.PI * 0.95, -Math.PI * 0.55); // atrás da fogueira (lado norte)
      return [c[0] + Math.cos(a) * 1.7, c[1] + Math.sin(a) * 1.7];
    };
    const loot = [];
    if (tpl.seal !== false) {
      const s = chestAt(camps[sealFirst ? 0 : 1]);
      loot.push(['seal', s[0], s[1]]);
    }
    if (tpl.item) {
      const s = chestAt(camps[sealFirst ? 1 : 0]);
      loot.push(['item', tpl.item, s[0], s[1]]);
    }

    // Áreas que devem ficar livres de casas e vegetação.
    const clear = [
      [start[0], start[1], 3], [exit[0], exit[1], 3.4],
      ...camps.map((c) => [c[0], c[1], 4.4]),
    ];
    const keepOut = (x, y, r = 0) => clear.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] + r);

    // Praça de pedra numa das emboscadas (o "centro da vila").
    const plazas = [];
    if (tpl.plaza) {
      const wv = waves[1];
      plazas.push([wv.center[0] + between(-0.6, 0.6), wv.center[1] + between(-0.6, 0.6), between(2.1, 2.6)]);
    }

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
    const houseCount = Math.round(between(tpl.houses.count[0], tpl.houses.count[1] + 0.99));
    let placed = 0;
    for (let k = 0; k < 400 && placed < houseCount; k++) {
      const type = pick(tpl.houses.types);
      const p = pointAt(path, between(0.08, 0.92));
      const side = rnd() < 0.5 ? -1 : 1;
      // perpendicular ao caminho (no plano do mundo)
      const nx = -p.dy * side, ny = p.dx * side;
      const d = between(2.4, 5.2);
      // o apoio da casa é o canto SUL: empurra para que a caixa fique ao lado do caminho
      const x = p.x + nx * d + (side > 0 ? 1.8 : 0.4), y = p.y + ny * d + (side > 0 ? 1.8 : 0.4);
      if (tryPlace(type, x, y, 0.7, 1.4)) {
        placed++;
        // caixas encostadas na frente da casa
        const b = boxes[boxes.length - 1];
        if (rnd() < 0.6) props.push([pick(['crate', 'crate_small', 'crate_tied']), b.x1 + 0.55, b.y0 + between(0.3, b.y1 - b.y0)]);
      }
    }

    // 6. Lanternas ao longo do caminho e fumaça de casas queimadas.
    for (let k = 0; k < (tpl.lanterns || 0); k++) {
      const p = pointAt(path, between(0.1, 0.9));
      const side = rnd() < 0.5 ? -1 : 1;
      const x = p.x - p.dy * side * 2.1, y = p.y + p.dx * side * 2.1;
      if (!keepOut(x, y) && boxes.every((b) => boxGap(b, { x0: x, y0: y, x1: x, y1: y }) > 0.8)) props.push(['lantern2', x, y]);
    }
    const smoke = [];
    for (let k = 0; k < (tpl.smoke || 0) && k < boxes.length; k++) {
      const b = boxes[Math.floor(rnd() * boxes.length)];
      smoke.push([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
    }

    const mid = pointAt(path, 0.5);
    return {
      ...tpl,
      seed,
      seal: tpl.seal !== false,
      start,
      exit,
      path,
      plazas,
      props,
      waves,
      loot,
      smoke,
      clear: [...clear, ...waves.map((wv) => [wv.center[0], wv.center[1], wv.guard ? 4.2 : 2.4])],
      scatter: tpl.scatter ? { ...tpl.scatter, seed: Math.floor(rnd() * 1e6) } : null,
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
