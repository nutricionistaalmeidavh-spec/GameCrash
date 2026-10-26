# GameCrash — Crash Test Simulator

Jogo web 3D de colisões. Acelere, escolha seu carro, enfrente obstáculos e veja uma porcentagem **fictícia** de sobrevivência.

**Core R$ 0 / self-hosted / open source.** Three.js + Rapier WASM + TypeScript + Vite. Sem login, banco de dados, APIs pagas ou serviços externos.

## Execução

Requer Node.js 22.12 ou superior.

```bash
npm install
npm run dev
```

Para conferir testes e gerar o build:

```bash
npm test
npm run build
```

Para validar browsers desktop e Safari WebKit emulado no perfil de iPhone 13:

```bash
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

O build fica em `dist/` e pode ser hospedado em qualquer servidor estático.

## Recursos implementados

- Três veículos: sedan, hatch e SUV, gerados proceduralmente.
- Três cenários: parede, blocos e megarampa.
- Colisões e gravidade 3D via Rapier WASM; a carroceria acompanha uma estrutura física deformável de nós e ligações.
- Interface responsiva para navegador de celular e desktop, controles por toque e teclado (W/↑, A/D, S/↓).
- Câmera alternativa, placar de dano, reinício e efeito sonoro opcional.
- Testes unitários + E2E Chromium e WebKit no GitHub Actions, com screenshots e relatório no artifact.

**Importante:** a porcentagem de sobrevivência é um elemento fictício de jogo, não uma avaliação de acidentes reais. A estrutura usa um modelo elastoplástico simplificado, com cabine rígida central e uma malha deformável acoplada; seus parâmetros de jogo não são uma calibração de veículos reais nem uma análise estrutural por elementos finitos.

## Publicação oficial exclusivamente no GitHub Pages

**Jogar:** https://nutricionistaalmeidavh-spec.github.io/GameCrash/

**Link direto para o executável web compilado:** https://nutricionistaalmeidavh-spec.github.io/GameCrash/play/

Há **um único workflow de publicação**, `.github/workflows/ci.yml`, que executa os testes unitários, gera o build do Vite, roda QA no Chromium e WebKit, e **somente depois** copia o build aprovado para `play/` na branch `main`. A origem atual do GitHub Pages é `main`/`(root)`; o `index.html` do repositório redireciona diretamente para `/GameCrash/play/`, sem depender de módulos externos. `.nojekyll` desativa Jekyll para recursos compilados.

O job publica apenas por GitHub Pages, gratuitamente. Não há integrações de hospedagem de terceiros, nem tentativa de alterar a origem do Pages via API sem as permissões adequadas. O smoke test da CI valida a URL raiz, o caminho `/play/` e os recursos JavaScript/CSS publicados.

Se for necessário verificar a configuração no GitHub, use **Settings → Pages → Build and deployment → Source: Deploy from a branch → main → /(root)**. Não configure deploys alternativos para este projeto.

Licença MIT.

## Direção e física

- Chassi livre com massa do veículo e quatro rodas por raycast, suspensão, amortecimento e aderência via Rapier.
- Direção progressiva muda a orientação do carro; curvas, saltos e capotamentos não são anulados por reposicionamento a cada frame.
- Freio atua nas rodas e tem prioridade sobre o acelerador. O limitador reduz o torque e freia progressivamente ao baixar o limite.
- Física em passo fixo de 120 Hz e CCD no chassi; lombadas arredondadas compartilham a mesma geometria entre renderização e colisão.
- Garagem recolhida durante a partida, direção à esquerda e pedais à direita, botões para reiniciar e voltar à seleção.
- Dez modelos brasileiros com carrocerias e cabines moldadas, além dos três carros originais; rodas acompanham a suspensão e a direção.
- A estrutura tem 24 nós (20 massas dinâmicas e quatro apoios na cabine), molas amortecidas, mudança permanente do comprimento de repouso por escoamento e ruptura por limite de deformação. Nós e ligações externas possuem colisão física e acompanham o amassamento.
- A malha gráfica é vinculada aos nós físicos. O dano é medido pela alteração estrutural e pela intrusão; não aplica um amassado predeterminado a partir da velocidade.
- Danos próximos às rodas alteram pontos da suspensão, alinhamento, aderência, aceleração e frenagem; rodas, capô e para-choques podem se desprender como corpos físicos. A massa é transferida da cabine para cada peça e o número de fragmentos é limitado a sete.
- Rupturas acontecem no passo fixo da física, independentemente da frequência de renderização. Triângulos sem suporte podem se abrir, evitando esticar painéis entre fragmentos distantes.
- Após o impacto, é possível dispensar o relatório, arrastar a câmera para inspecionar, pausar ou alterar a velocidade da câmera lenta. O relatório reaberto acompanha o estado atual e mostra rupturas, peças soltas e trabalho de deformação aproximado em kJ.

O GitHub Actions valida também trajetórias físicas com o Rapier real (apoio dos 13 carros, curva, frenagem, voo, lombadas e impacto a 600 km/h). Os testes de navegador usam o build de produção e verificam controles em retrato e paisagem. O jogo e seus recursos são servidos pelo Pages; a simulação interativa roda no dispositivo de cada jogador, sem servidor obrigatório.

## Controles atualizados

A simulação começa parada. No celular, pressione e mantenha **ACELERAR** para avançar; solte para reduzir a velocidade. **FREAR** desacelera o carro e as setas controlam a direção. No desktop, use **W/↑** para acelerar e **S/↓/espaço** para frear.

A publicação no GitHub Pages é realizada automaticamente pelo workflow de CI na `main`, somente após testes unitários, build e QA nos navegadores Chromium e WebKit aprovados.

## Turbo 600 km/h e 120 lombadas

- Acelerador por toque (segurar) e teclado (W/↑), com limite ajustável de **60 a 600 km/h**; padrão 600 km/h para todos os carros em modo arcade.
- Cenário **120 LOMBADAS**: pista estendida, 120 lombadas físicas renderizadas com instancing, contador de passagem e danos calculados na estrutura. A velocidade escolhida pode causar colapso da suspensão; o teste de conclusão do trajeto usa velocidade moderada.
- A simulação continua depois de cada lombada; o relatório exibe quantas foram superadas.
- Sem dependências pagas, sem servidor obrigatório, testado na CI em Chromium e WebKit.

### Concept GT: modelo detalhado e destrutível

O veículo padrão usa **Car Concept**, de **Eric Chadwick / Darmstadt Graphics Group GmbH (2024)**, distribuído sob **CC BY 4.0** pelo [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept). Créditos e condições das marcas estão em `public/assets/concept/`. Não há endosso dos titulares das marcas.

A adaptação conserva interior, motor, materiais e quatro conjuntos de rodas. A carroceria externa se deforma com os nós físicos; o capô pode se soltar, e as rodas seguem a suspensão ou viram fragmentos físicos. Interior central e motor permanecem rígidos. Os parâmetros de massa e desempenho são aproximações para o jogo. A física continua sendo uma estrutura híbrida simplificada, não FEM completo.

O GLB foi reduzido de 213.347 para 66.216 triângulos, com texturas WebP de até 1024 px e tamanho inferior a 5 MB. Todos os recursos são hospedados junto ao jogo, sem serviços pagos. Para reproduzir a otimização, baixe o GLB original da fonte acima e rode `node tools/concept/prepare.mjs /caminho/CarConcept.glb` após `npm ci`. O script normaliza metros, eixo frontal, rodas e gera `src/game/concept.json`. Preserve a hierarquia para editar no Blender.
