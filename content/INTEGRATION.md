# Integração do conteúdo brasileiro

Os arquivos ficam **somente nesta branch**. Não há app duplicado, alteração no GitHub Pages ou merge automático.

- `public/assets/brazil/cars/`: 10 GLB de carros low-poly
- `public/assets/brazil/maps/`: 3 GLB de pistas
- `public/assets/brazil/manifest.json`: posições de spawn, rotas e propriedades aproximadas dos carros
- `src/brazil/assets.mjs`: carregador Three.js para o jogo existente
- `src/brazil/rapier.mjs`: colisores de pista / chassi opcional para Rapier

## Integrar no jogo web existente (Three.js)

O carregador suporta `import.meta.env.BASE_URL` do Vite, inclusive o prefixo `/GameCrash/` do GitHub Pages:

```js
import { createBrazilContent } from './brazil/assets.mjs';

const content = await createBrazilContent();
const { object: map, metadata: level } = await content.loadMap('brasilia-eixo-monumental');
scene.add(map);

const { object: car, metadata: carData } = await content.loadCar('gol');
content.spawnCar(car, level);
scene.add(car);
// O loop de movimento/colisão permanece no jogo existente.
```

Se o jogo já tem física, utilize as dimensões/massa de `carData` e as posições de `level` sem criar outra engine física. Caso utilize Rapier, importe `attachBrazilRoadColliders` de `src/brazil/rapier.mjs` e use o `world` existente.

```sh
node --test tests/brazil-assets.test.mjs
```

## Limites desta entrega

GLBs reais e originais, mas estilizados: não são réplicas oficiais, não possuem logotipos, não reproduzem com exatidão a cartografia brasileira nem implementam direção ou deformação por si próprios. A física e a interface dependem do desenvolvimento paralelo do jogo. Solução 100% gratuita, self-hosted/open source no núcleo.
