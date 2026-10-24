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

## Publicação oficial no GitHub Pages

O GitHub Actions faz **testes + build Vite + QA Chromium/WebKit + publicação no Pages**. A publicação usa exclusivamente o artefato compilado `dist/`.

No primeiro deploy o workflow `ci.yml` configura o Pages para usar a fonte **GitHub Actions**, desativando o antigo processo Jekyll que publicava os arquivos-fonte (`src/main.ts`) incorretamente. Também faz smoke test do site publicado, conferindo os links JavaScript/CSS.

O jogo fica em https://nutricionistaalmeidavh-spec.github.io/GameCrash/ .

Se a conta não permitir a configuração automática, em **Settings → Pages → Build and deployment → Source** selecione **GitHub Actions** uma única vez. O workflow falhará explicitamente nesse caso, sem afirmar sucesso indevido.

Licença MIT.

## Controles atualizados

A simulação começa parada. No celular, pressione e mantenha **ACELERAR** para avançar; solte para reduzir a velocidade. **FREAR** desacelera o carro e as setas controlam a direção. No desktop, use **W/↑** para acelerar e **S/↓/espaço** para frear.

A publicação no GitHub Pages é realizada automaticamente pelo workflow de CI na `main`, somente após testes unitários, build e QA nos navegadores Chromium e WebKit aprovados.

## Turbo 600 km/h e 120 lombadas

- Acelerador por toque (segurar) e teclado (W/↑), com limite ajustável de **60 a 600 km/h**; padrão 600 km/h para todos os carros em modo arcade.
- Cenário **120 LOMBADAS**: pista estendida, 120 lombadas físicas renderizadas com instancing, contador de passagem e desgaste acumulado ficcional.
- A simulação continua depois de cada lombada; o relatório exibe quantas foram superadas.
- Sem dependências pagas, sem servidor obrigatório, testado na CI em Chromium e WebKit.
