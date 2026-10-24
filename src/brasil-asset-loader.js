import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function createBrasilAssetLoader(manifestUrl = '/assets/manifest.json') {
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error('Não foi possível carregar os assets brasileiros.');
  const manifest = await response.json();
  const loader = new GLTFLoader();
  const root = new URL('.', new URL(manifestUrl, location.href));
  const load = async (kind, id) => {
    const entry = manifest[kind]?.[id];
    if (!entry) throw new Error('Asset desconhecido: ' + id);
    const gltf = await loader.loadAsync(new URL(entry.file, root).href);
    gltf.scene.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
    return { object: gltf.scene, metadata: entry, animations: gltf.animations };
  };
  return {
    manifest, listCars: () => Object.values(manifest.cars),
    listMaps: () => Object.values(manifest.maps),
    loadCar: id => load('cars', id), loadMap: id => load('maps', id)
  };
}
