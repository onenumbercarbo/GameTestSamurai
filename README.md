# Rōnin — A Relíquia Roubada

Hack and slash isométrico para navegador (HTML5 Canvas + JavaScript puro), ambientado no Japão da Era Meiji.

## Como rodar

Abra `index.html` no navegador. Não precisa de build nem de servidor (os scripts são clássicos, não ES modules).

## Controles

| Ação | Tecla |
|---|---|
| Mover | `W` `A` `S` `D` / setas |
| Mirar | Mouse |
| Corte (combo de 3 golpes) | Clique esquerdo |
| Dash (esquiva, cancela ataque) | `Espaço` / `Shift` |
| Debug de hitboxes | `F3` |

## Estrutura

```
index.html        canvas + HUD e ordem de carregamento dos scripts
css/style.css     canvas em tela cheia, centralizado
js/config.js      constantes de tuning (tiles, velocidades, dash, buffer de input)
js/iso.js         projeção cartesiano <-> isométrico (com a matemática comentada)
js/input.js       teclado (event.code) e mouse; fila de cliques de ataque
js/camera.js      câmera seguindo o jogador + screen shake
js/effects.js     arco da espada projetado no mundo, faíscas, números de dano
js/combat.js      ComboSystem + COMBO_CHAIN (golpes como dados) e roadmap de combos
js/player.js      Rōnin placeholder: movimento, dash, afterimages, katana
js/dummy.js       bonecos de treino (alvo para testar ataque em área)
js/main.js        game loop (requestAnimationFrame), grid, ordenação por profundidade, hit-stop
```

## Próximos passos

- Saqueadores com IA (perseguir, cercar, atacar) usando a mesma interface de alvo dos bonecos.
- Árvore de combos (leve/pesado/ataque após dash), descrita no topo de `js/combat.js`.
- Sprites em 8 direções escolhidos por `player.facing` e `player.state`.
- Tilemap com obstáculos e colisão; cenários: vilarejo, floresta de bambu, acampamento.
