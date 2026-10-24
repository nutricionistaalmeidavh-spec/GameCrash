# GameCrash — assets brasileiros

Esta branch adiciona assets ao **mesmo jogo web**, sem Godot e sem outro projeto.

Inclui gerador procedural de 10 carros brasileiros (Gol, Strada, Palio, Onix, Uno, HB20, Fiesta, Ka, Fox e Celta) e 3 cenários estilizados (Eixo Monumental, Imigrantes, Serra do Rio do Rastro), exportando **GLB** e um manifesto de jogabilidade.

- Saída: `public/assets/cars/*.glb`, `public/assets/maps/*.glb`, `public/assets/manifest.json`.
- Integração Three.js: `import {createBrasilAssetLoader} from './src/brasil-asset-loader.js'`; `const a = await createBrasilAssetLoader(); const carro = await a.loadCar('gol'); const mapa = await a.loadMap('brasilia-eixo-monumental');`.
- Modelos com escala em metros, eixo Y para cima, frente -Z e massas aproximadas para gameplay.
- **Não são modelos oficiais**. Cenários inspirados nos lugares, não reproduções geográficas.
- Core inteiramente local / open source / gratuito. O workflow GitHub Actions apenas automatiza a regeneração, que também pode ser feita localmente.

Gerar localmente:
```bash
python -m pip install numpy trimesh pytest
python tools/generate-assets.py
python -m pytest tests/test_assets.py -q
```

Branch para integração posterior, **sem merge na main**.
