/**
 * config.js — Constantes globais de tuning.
 *
 * Unidades:
 *  - "Mundo" (world): medido em TILES. Um tile = 1.0 unidade. Toda a lógica
 *    (física, colisão, alcance de golpes) roda nesse espaço cartesiano "de cima".
 *  - "Tela" (screen): pixels CSS. Só a renderização conhece esse espaço.
 */
const CONFIG = {
  // Tamanho de UM tile isométrico na tela. Proporção 2:1 é o padrão do
  // "isométrico de jogos" (tecnicamente projeção dimétrica): a linha diagonal
  // de um tile sobe 1px a cada 2px na horizontal (~26.57°), o que dá bordas
  // sem serrilhado em pixel art. Visualmente é a "câmera a 45°" de Hades/Diablo.
  TILE_W: 64,
  TILE_H: 32,

  // Dimensões do mapa de teste em tiles.
  MAP_W: 28,
  MAP_H: 28,

  // Delta-time máximo por frame (s). Se a aba ficar em segundo plano, o
  // navegador pausa o rAF; ao voltar, dt seria enorme e o jogador "teleportaria".
  DT_MAX: 1 / 30,

  PLAYER: {
    speed: 5.2,          // tiles/segundo
    radius: 0.32,        // raio de colisão (tiles)
    dashSpeed: 19,       // tiles/segundo durante o dash
    dashDuration: 0.15,  // segundos
    dashCooldown: 0.42,  // segundos
    accel: 22,           // quão rápido a velocidade alcança o alvo (suaviza partidas/paradas)
  },

  // Janela de "input buffer": um clique feito um pouco ANTES do golpe atual
  // permitir encadear ainda é aceito. Essencial para combos fluidos.
  INPUT_BUFFER: 0.28,
};
