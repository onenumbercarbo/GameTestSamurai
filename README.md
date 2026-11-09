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

O golpe sai na direção em que você conduz o rōnin (WASD). Uma assistência de mira o vira para o inimigo mais próximo; parado e sem inimigos por perto, ele segue o mouse.

## Mapas procedurais

As quatro vilas são geradas a cada entrada, inclusive ao tentar de novo após morrer (`js/procgen.js`). O sorteio cobre o traçado do caminho, as casas, os pontos de emboscada, os dois acampamentos, qual deles guarda o selo, os reféns e a vegetação. Nome, história, tipos de casa, grupos de inimigos e tesouro de cada vila vêm do modelo em `js/stages.js`. O santuário do boss é fixo; só a vegetação muda.

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

1. **Aldeia de Kiriyama**: a aldeia incendiada (tutorial).
2. **Vila de Hanamura**: vila das cerejeiras, com batedores ágeis.
3. **Floresta de Bambu de Sagino**: assassinos que arremessam kunais, que podem ser rebatidas com a espada.
4. **Kurogane**: o acampamento do clã.
5. **Santuário de Kurokama**: luta contra **Gendō, o Ceifador**, em duas fases.
   - Fase 1: ceifada, giro 360°, salto com impacto e investida, todos telegrafados no chão.
   - Defesas: guarda frontal (arco azul) que bloqueia golpes e revida com contra-ataque. O golpe final do combo, o iaijutsu ou ataques pelas costas quebram a guarda. Postura: só cambaleia após acumular dano.
   - Fase 2 (50% da vida): combos encadeados, três saltos seguidos com onda de choque, três investidas, foice arremessada como bumerangue (ele fica desarmado enquanto ela voa), esquiva para trás seguida de investida, guarda mais frequente e reforços.

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
python3 tools/extract_sprites.py folha_boss.jpg folha_heroi.jpg folha_floresta.jpg folha_acampamento.jpg
```

Requer Pillow e NumPy. Os retângulos de cada quadro ficam em `FRAMES`, no topo do script.
