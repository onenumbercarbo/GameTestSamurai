# Rōnin — A Relíquia Roubada

Hack and slash isométrico para navegador (HTML5 Canvas + JavaScript puro), ambientado no Japão da Era Meiji.
Um rōnin atravessa cinco locais para recuperar o Espelho da Lua, roubado pelo clã Kurokama, e enfrenta o líder do clã num duelo final.

## Como jogar

Abra `index.html` no navegador do computador ou do celular.

**No celular** (de preferência na horizontal):
- **Mover:** arraste o polegar na metade esquerda da tela; o joystick aparece onde você tocar.
- **Botões:** CORTE (segure para combo contínuo), DASH, AGIR (aparece perto de baús e reféns), IAI (com o pergaminho) e pausa.
- **Menus:** na tela de título, *Tela cheia* trava a orientação na horizontal (Android). No iPhone, use Compartilhar → *Adicionar à Tela de Início* para jogar em tela cheia como app.
- **Na vertical:** o jogo pausa e pede para girar o aparelho.

## Teclado e mouse

| Ação | Controle |
|---|---|
| Mover | `W` `A` `S` `D` / setas |
| Mirar | Mouse |
| Corte (combo de 3 golpes: Kesa-giri → Gyaku-kesa → giro Enten-giri) | Clique esquerdo |
| Dash (esquiva invulnerável, cancela ataques) | `Espaço` / `Shift` |
| Investida (ataque logo após o dash) | Dash + clique |
| Iaijutsu, golpe pesado (precisa do pergaminho) | Botão direito |
| Abrir baú / libertar aldeão | `E` |
| Pausa e tesouros / Som / Debug | `Esc` ou `P` / `M` / `F3` |
| Alternar 2.5D (perspectiva) / isométrico | `V` |

O golpe sai na direção em que você conduz o rōnin (WASD). Uma assistência de mira o vira para o inimigo mais próximo; parado e sem inimigos por perto, ele segue o mouse.

## Animação

- **Poses de costas:** o oni, o rōnin de palha, a kunoichi e os bandidos usam a pose de costas ao andar ou atacar para longe da câmera (`BACK_SPRITES` em `js/actor.js`). Reféns podem estar ajoelhados de costas, e os libertados vão embora caminhando.
- **Movimento fluido:** o rōnin anda com ciclos de 8 quadros por direção (costas, diagonal de costas, perfil e frente), escolhidos por setor da tela com histerese. Mini-chefes, soldados e bandidos têm ciclos de caminhada próprios (o rōnin de palha e a kunoichi também de costas). Os quadros avançam pela distância percorrida e trocam secos dentro do ciclo; a fusão curta fica só para mudanças de pose ou direção.

## Arena do Gendō

O santuário final tem clima de tempestade (`js/storm.js`): piso cerimonial de mosaico com anéis vermelhos e dourados, braseiros acesos em volta, chuva com respingos, relâmpagos e trovões, nuvens escuras e cores dessaturadas e quentes. A fase abre com um plano fechado atrás do rōnin que recua revelando a arena. Quando o Gendō cai, a tempestade passa.

## Guardiões das vilas (mini-chefes)

Cada vila tem um guardião na arena de pedra antes do portão. O torii só abre depois que ele cai. Todos têm duas fases, ataques telegrafados no chão, defesa e postura, como o chefe final (`js/miniboss.js`):

| Vila | Guardião | Estilo |
|---|---|---|
| Kiriyama | Gōriki, o Oni do Kanabō | golpes pesados, salto com impacto, investida; fase 2: três impactos com onda de choque |
| Hanamura | Kagerō, a Garra Sombria | kunoichi rápida que se esquiva em vez de bloquear; fase 2: some na fumaça e reaparece atrás de você |
| Sagino | Jōkai, o Monge Renegado | estocadas de naginata, ceifada e giro; guarda em oração |
| Kurogane | Kasa no Jūrō, o Rōnin de Palha | duas espadas, investida-relâmpago, golpe do céu; fase 2 chama soldados com rifle |

Em Kurogane também há **soldados com rifle** nas emboscadas: miram (linha vermelha no chão), atiram de longe e usam a baioneta de perto. A bala pode ser rebatida com a espada.

## Mapas procedurais

Cada vila (62×60 tiles) é gerada por `js/procgen.js` a partir do modelo em `js/stages.js`, a cada jogo novo. O sorteio cobre o traçado do caminho, as casas, as 7–8 emboscadas, os 5 acampamentos (ligados ao caminho por trilhas), os baús (um com o selo, um com o tesouro, os demais com comida), os reféns, a arena do guardião e a vegetação. Nome, história, tipos de casa, grupos de inimigos e tesouro de cada vila vêm do modelo em `js/stages.js`. O santuário do boss é fixo; só a vegetação muda.

## Exploração

Os inimigos já estão no mapa desde o início, em grupos. Nos acampamentos, bandidos bebem, riem, dançam ou dormem em volta da fogueira, entre tenda, caldeirão e barris de saquê, e brigam com as mãos nuas. Nas emboscadas do caminho, ninjas ficam escondidos atrás de casas e árvores. Quando você chega perto (ou acerta um deles), o grupo inteiro é alertado (aparece um "!" sobre cada um) e parte para o ataque.

Cada vila tem dois acampamentos nos cantos do mapa, cada um guardando um **baú**. O baú fica trancado até você derrotar os bandidos acampados; depois, chegue perto e aperte **E** para abrir. Um baú guarda o **selo do portão** (ofuda): o torii de saída só abre com o selo e com as emboscadas do caminho vencidas. O outro guarda um **tesouro**:

| Vila | Tesouro | Efeito |
|---|---|---|
| Kiriyama | Katana Tamahagane | dano +30% |
| Hanamura | Omamori de Proteção | vida máxima +30 |
| Sagino | Nodachi do Vento | alcance +25%; o giro final lança ondas de vento |
| Kurogane | Pergaminho do Iaijutsu | botão direito: saque relâmpago |

Em cada vila há aldeões feitos reféns junto das emboscadas do caminho, amarrados a um poste ou ajoelhados com as mãos atadas, pedindo socorro. Derrote os bandidos e aperte **E** perto do aldeão para libertá-lo (+20 de vida). O total de aldeões salvos aparece no final.

O minimapa (canto inferior direito) mostra só o que você já explorou; baús e emboscadas aparecem nele quando você chega perto. Caixas soltas quebram com a espada e às vezes guardam onigiri.

## Jornada

A região é um mapa contínuo (`js/region.js`): as quatro vilas ficam lado a lado, ligadas por estradas na mata, e o santuário do Gendō fecha o caminho no alto da montanha. Não há portal nem tela de carregamento entre vilas: o rōnin anda de uma à outra.

```
Kiriyama ─ Estrada do Leste ─ Hanamura ─ Trilha dos Bambus ─ Sagino ─ Estrada Mineira ─ Kurogane ─ Subida ─ Santuário
```

- O jogo começa em Kiriyama: o Ancião Sōbei vem até o rōnin e pede ajuda.
- Em cada vila, um morador (marcado com "!") conta o problema. O guardião da vila protege a saída leste; quando ele cai, a barricada dos bandidos na estrada é derrubada e o morador agradece.
- As estradas têm emboscadas próprias e reféns (mercadores amarrados).
- Moradores andam pelas vilas, conversam sozinhos e reagem ao perigo: acuados enquanto a vila está ocupada, alegres depois.
- O progresso (vilas libertadas, tesouros e a semente do mundo) fica salvo. Ao morrer ou continuar, o rōnin volta para a vila em que estava, no mesmo mundo; um jogo novo sorteia outro mundo.

## Câmera cinematográfica

A câmera é dirigida por planos pré-definidos (`directCamera` em `js/main.js`):

- **Exploração**: plano fechado, levemente à frente de onde o rōnin anda e mira.
- **Arena**: ao entrar num encontro, a câmera trava num plano fixo do centro da arena.
- **Duelo**: no boss, o plano enquadra os dois lutadores e aproxima quando eles chegam perto.
- **Cutscenes**: plano de estabelecimento de cada vila, apresentação do boss e final, com faixas de cinema.

Como a arte é isométrica fixa, "ângulo" aqui significa enquadramento, zoom e posição. Girar a câmera exigiria sprites desenhados em várias vistas.

### 2.5D (perspectiva)

Por padrão o plano isométrico é inclinado em perspectiva (`Camera.worldToScreen`, em `js/camera.js`). Um ponto a `fy` px do centro da tela no plano isométrico vai para `fy·s`, com `s = D/(D − fy)`. O fundo fica menor e a frente maior, e o chão converge.

- **Chão**: é renderizado plano num buffer com margem (refeito só quando a câmera sai dela) e deitado na tela em faixas horizontais, como no Mode 7 (`Level.drawGroundPerspective`).
- **Sprites**: personagens, casas e árvores ficam em pé, como cartões, na escala da sua profundidade (`cam.focus`).
- **Ajuste**: a intensidade fica em `CONFIG.CAMERA.perspFocal`, e a tecla `V` alterna com o isométrico puro.

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
python3 tools/extract_sprites.py folha_boss.jpg folha_heroi.jpg folha_floresta.jpg folha_acampamento.jpg folha_minichefes.jpg costas_oni_ronin.jpg costas_kunoichi.jpg costas_aldeoes.jpg floresta2.jpg
```

Requer Pillow, NumPy e SciPy (a SciPy remove o chão pintado sob as árvores). Os retângulos de cada quadro ficam em `FRAMES`, no topo do script.
