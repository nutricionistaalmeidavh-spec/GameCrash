# GameCrash — Crash Test Simulator

Jogo web 3D de colisões de veículos, inspirado no formato de vídeos curtos: acelere, escolha seu carro, enfrente obstáculos e veja um resultado **fictício** do impacto.

**Core R$ 0:** Three.js + Rapier WASM + TypeScript + Vite. Sem API, login, banco de dados, anúncios, chave secreta ou serviço de assinatura. Hospede o `dist/` em qualquer servidor estático ou no GitHub Pages.

## Como executar

Requer Node.js >= 22.12.

```bash
npm install
npm run dev
```

Abra a URL que o Vite mostrar. Para produção e testes:

```bash
npm test
npm run build
npm run preview
```

## QA nos navegadores (inclusive WebKit iPhone)

```bash
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

No GitHub Actions, a CI testa **Chromium desktop e WebKit emulado com viewport/UA/toque de iPhone 13** (não hardware físico de iPhone), captura evidências e só aprova se os testes passarem.

## Jogabilidade

- 3 carros com massa, aceleração, velocidade e resistência diferentes.
- 3 desafios: parede, blocos e rampa.
- Física real de corpos rígidos/colliders via Rapier 3D, gravidade e impactos.
- Deformação visual da carroceria proporcional ao impacto (não é soft-body de nós e vigas nem simulação de engenharia).
- Câmera de perseguição/cinematográfica, câmera lenta após impactos.
- Controles touch para iPhone/Android e WASD/setas/espaço no desktop.
- Simulação automática ao iniciar; use A/D ou botões para mudar a trajetória, S/espaço para frear.

O indicador de “chance de sobrevivência” é um **número inventado para o jogo**, não serve para avaliação médica ou de segurança veicular.

## Arquitetura

`src/game/rules.ts` — constantes e pontuação fictícia testadas sem navegador.

`src/game/vehicle.ts` — modelos 3D procedurais, animação das rodas e deformação geométrica.

`src/game/track.ts` — mundo 3D, pista e obstáculos com colliders Rapier.

`src/game/Game.ts` — loop de física em passos fixos, câmeras e estados de jogo.

`src/main.ts` — interface, seleção, controles por toque/teclado.

## CI e hospedagem opcional

O GitHub Actions executa testes unitários, build e testes reais em navegadores desktop/WebKit em pushes/PRs, disponibilizando `gamecrash-dist` como artefato. Para GitHub Pages, ative **Settings → Pages → Build and deployment → GitHub Actions**, depois execute manualmente **Publish GitHub Pages (opt-in)**. Não existe dependência de hospedagem paga.

## Roadmap

- v0.2: suspensão por raycast, múltiplos eixos e danos localizados por ponto de contato.
- v0.3: editor de rampas/obstáculos e compartilhamento de replay.
- v0.4: veículos GLB licenciados e efeitos sonoros.
- v1.0: simulador deformável por nós e vigas próprio em WASM, sob orçamento de desempenho móvel.

Licença: MIT.
