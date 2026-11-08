# Rōnin — A Relíquia Roubada

Hack and slash isométrico para navegador (HTML5 Canvas + JavaScript puro), ambientado no Japão da Era Meiji.
Um rōnin atravessa cinco locais para recuperar o Espelho da Lua, roubado pelo clã Kurokama, e enfrenta o líder do clã num duelo final.

## Como jogar

Abra `index.html` no navegador. Não precisa de build nem de servidor.

| Ação | Controle |
|---|---|
| Mover | `W` `A` `S` `D` / setas |
| Mirar | Mouse |
| Corte (combo de 3 golpes: Kesa-giri → Gyaku-kesa → giro Enten-giri) | Clique esquerdo |
| Dash (esquiva invulnerável, cancela ataques) | `Espaço` / `Shift` |
| Investida (ataque logo após o dash) | Dash + clique |
| Iaijutsu, golpe pesado (precisa do pergaminho) | Botão direito |
| Pausa e tesouros / Som / Debug | `Esc` ou `P` / `M` / `F3` |

O golpe sai na direção em que você conduz o rōnin (WASD). Uma assistência de mira o vira para o inimigo mais próximo; parado e sem inimigos por perto, ele segue o mouse.

## Exploração

Cada vila tem o **selo do portão** (ofuda) escondido num canto do mapa. O torii de saída fica selado até você achar o selo e vencer as emboscadas do caminho. No canto oposto há um **tesouro** protegido por guardiões:

| Vila | Tesouro | Efeito |
|---|---|---|
| Kiriyama | Katana Tamahagane | dano +30% |
| Hanamura | Omamori de Proteção | vida máxima +30 |
| Sagino | Nodachi do Vento | alcance +25%; o giro final lança ondas de vento |
| Kurogane | Pergaminho do Iaijutsu | botão direito: saque relâmpago |

O minimapa (canto inferior direito) mostra só o que você já explorou; tesouros e emboscadas aparecem nele quando você chega perto. Caixas soltas quebram com a espada e às vezes guardam onigiri.

## Jornada

1. **Aldeia de Kiriyama**: a aldeia incendiada (tutorial).
2. **Vila de Hanamura**: vila das cerejeiras, com batedores ágeis.
3. **Floresta de Bambu de Sagino**: assassinos que arremessam kunais, que podem ser rebatidas com a espada.
4. **Kurogane**: o acampamento do clã.
5. **Santuário de Kurokama**: luta contra **Gendō, o Ceifador**. Ataques telegrafados no chão (ceifada, giro 360°, salto com impacto, investida); fase 2 com fúria, onda de choque e reforços; sistema de postura.

## Câmera cinematográfica

A câmera é dirigida por planos pré-definidos (`directCamera` em `js/main.js`):

- **Exploração**: plano fechado, levemente à frente de onde o rōnin anda e mira.
- **Arena**: ao entrar num encontro, a câmera trava num plano fixo do centro da arena.
- **Duelo**: no boss, o plano enquadra os dois lutadores e aproxima quando eles chegam perto.
- **Cutscenes**: plano de estabelecimento de cada vila, apresentação do boss e final, com faixas de cinema.

Como a arte é isométrica fixa, "ângulo" aqui significa enquadramento, zoom e posição. Girar a câmera exigiria sprites desenhados em várias vistas.

## Estrutura

```
index.html                 canvas + ordem de carregamento dos scripts
assets/sprites/*.png       sprites recortados (gerados)
tools/extract_sprites.py   recorta as folhas com fundo verde → PNGs + js/atlas.js
tools/contact_sheet.py     prancha de conferência dos recortes e âncoras
js/config.js               tuning (velocidades, câmera, fichas de ataque)
js/atlas.js                tamanho e ponto de apoio (pés) de cada sprite (gerado)
js/iso.js                  projeção cartesiano ↔ isométrico (matemática comentada)
js/camera.js               câmera com zoom, alvo, shake, letterbox e área segura
js/level.js                chão, props com colisores tirados do sprite, campo de fluxo da IA, ordenação de profundidade
js/combat.js               ComboSystem, golpes como dados, ramo dash→investida, hitSector
js/player.js / enemies.js / boss.js   rōnin, ninjas (3 tipos), kunais, itens e o chefe
js/stages.js               as 5 fases como dados (caminho, casas, ondas, história)
js/ui.js / main.js         HUD, telas, cutscenes, diretor de câmera e game loop
```

### Regerar os sprites

```bash
python3 tools/extract_sprites.py caminho/folha_boss.jpg caminho/folha_heroi.jpg caminho/folha_floresta.jpg
```

Requer Pillow e NumPy. Os retângulos de cada quadro ficam em `FRAMES`, no topo do script.
