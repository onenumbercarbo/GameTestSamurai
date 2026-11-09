/**
 * config.js — Constantes globais de tuning.
 *
 * Unidades:
 *  - "Mundo" (world): medido em TILES. Um tile = 1.0 unidade. Toda a lógica
 *    (física, colisão, alcance de golpes) roda nesse espaço cartesiano "de cima".
 *  - "Tela" (screen): pixels CSS. Só a renderização conhece esse espaço.
 */
const CONFIG = {
  // Tamanho de UM tile isométrico na tela com zoom 1. Proporção 2:1 é o padrão
  // do "isométrico de jogos" (tecnicamente dimétrico, linhas a ~26.57°) — a
  // "câmera a 45°" de Hades/Diablo.
  TILE_W: 64,
  TILE_H: 32,

  // Escala dos sprites de personagem (PNG -> tela com zoom 1).
  SPRITE_SCALE: 0.56,
  BOSS_SCALE: 0.7,

  DT_MAX: 1 / 30,

  PLAYER: {
    maxHp: 100,
    speed: 5.0,          // tiles/s
    radius: 0.3,
    dashSpeed: 17,
    dashDuration: 0.16,
    dashCooldown: 0.45,
    accel: 22,
    hurtIFrames: 0.7,    // invulnerabilidade após levar dano
  },

  // Câmera cinematográfica: perto do jogador, com planos pré-definidos.
  CAMERA: {
    exploreZoom: 2.15,   // plano fechado durante a exploração
    lookAhead: 0.7,      // tiles de antecipação na direção da mira
    arenaZoom: 1.75,      // plano fixo de arena durante as ondas
    arenaLean: 0.22,
    safeArea: 0.3,      // o jogador nunca sai desta fração da tela (a partir do centro)
  },

  INPUT_BUFFER: 0.28,
  MAX_ATTACKERS: 2,      // quantos inimigos podem atacar ao mesmo tempo (estilo GoW)
};
