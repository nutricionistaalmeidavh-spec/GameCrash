# GameCrash — pesquisa prática de motores físicos (R$ 0)
Tudo neste diretório é experimental. O jogo publicado na main permanece intacto.
O material não usa serviços pagos nem chamadas de runtime a CDNs. O build inclui o WASM via dependências open source.

## Laboratório Rapier / Jolt (Fases 0, 1, 2)
```bash
cd experiments/physics-lab
npm install
npm test
npm run dev
npm run build
```
Abra a URL local exibida pelo Vite, selecione **Rapier (rígido)** ou **Jolt (soft-body)** e execute parede, rampa ou lombadas. **Comparar** executa 480 passos de 1/120s para cada motor. **Exportar JSON** fornece dispositivo, tempo total, tempo médio e p95 do custo de atualização física, além das observações do estado final.

A comparação usa dimensões, massa nominal (1.200 kg), velocidade inicial, distância ao obstáculo, gravidade e passo físico iguais. **Não é comparação direta com o GameCrash completo:** Rapier representa uma caixa rígida e Jolt uma estrutura elástica experimental de 36 nós. Não há material certificado, suspensão em 4 rodas ou deformação permanente calibrada. A porcentagem medida é **compressão geométrica máxima proxy**, não sobrevivência nem segurança veicular. O teste evita alegar uma vitória do motor sem medições no mesmo aparelho.

Rodar no iPhone real (Safari) continua obrigatório para a decisão final. O Playwright WebKit é automação de navegador, não um iPhone físico. Execute testes repetidos com mesmas configurações e verifique aquecimento e memória.

## Núcleo C++/WASM independente (Fase 3)
```bash
g++ -std=c++17 -O2 -DGC_PHYSICS_TEST experiments/ror-core/physics_core.cpp -o /tmp/physics-test
/tmp/physics-test
```
O arquivo `ror-core/physics_core.cpp` é um **experimento independente** implementando pontos de massa, molas, amortecimento, deformação plástica simplificada, ruptura e colisão com chão/parede. Usa passo de 0,5ms e exporta funções C, inclusive posições dos nós. A CI compila o mesmo arquivo em **Emscripten WebAssembly** e publica o artefato. Não utiliza arquivos, classes nem código GPL do Rigs of Rods e **não é um porte do RoR**. A extração do RoR foi descartada nesta etapa pelo acoplamento e pelas obrigações de licenciamento.

## Fase 4 — decisão de engine
Só decidir após: builds e testes verdes, três cenários executando, medições no mesmo hardware, e avaliação de estabilidade e deformação visual. Não há troca automática da engine do GameCrash. Nenhuma alteração é feita na main sem revisão. A lógica GPLv3 do RoR não deve ser copiada para o MIT GameCrash sem revisão de licença.

## Estado e comandos de QA
- CI de experimento: `.github/workflows/physics-lab.yml`
- Testes puros: `npm --prefix experiments/physics-lab test`
- Navegadores: `npx playwright test --config experiments/physics-lab/playwright.config.mjs` (após instalar dependências na raiz e no laboratório)
- Artefatos de build: `physics-lab-wasm-and-qa` e `isolated-node-beam-wasm`
