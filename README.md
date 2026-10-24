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
- Colisões e gravidade 3D via Rapier WASM; carroceria deforma os vértices segundo a severidade do impacto.
- Interface responsiva para navegador de celular e desktop, controles por toque e teclado (W/↑, A/D, S/↓).
- Câmera alternativa, placar de dano, reinício e efeito sonoro opcional.
- Testes unitários + E2E Chromium e WebKit no GitHub Actions, com screenshots e relatório no artifact.

**Importante:** a porcentagem de sobrevivência é um elemento fictício de jogo, não uma avaliação de acidentes reais. Os amassados são deformações gráficas reativas, não um solver soft-body completo.

## CI e publicação opcional

O workflow de QA executa testes e build em toda PR e push em branch de feature. O build é publicado como artefato. Para publicar no GitHub Pages, selecione em Settings → Pages → Build and deployment o modo GitHub Actions e então execute manualmente o workflow Publish GitHub Pages (opt-in). O workflow de Pages roda na branch padrão.

Licença MIT.
