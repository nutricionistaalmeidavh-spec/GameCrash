/**
 * GameCrash Brazil content adapter.
 * Reuses the game's existing THREE renderer, scene and physics loop.
 * No separate app, subscriptions, or mandatory services.
 * npm dependency: three (MIT)
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function assetRoot(baseUrl) {
  const viteBase = import.meta.env?.BASE_URL;
  const root = baseUrl ?? viteBase ?? '/';
  const page = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
  return new URL('assets/brazil/', new URL(root, page));
}

export async function createBrazilContent({ baseUrl, loader = new GLTFLoader() } = {}) {
  const root = assetRoot(baseUrl);
  const res = await fetch(new URL('manifest.json', root));
  if (!res.ok) throw new Error(`GameCrash Brazil manifest: HTTP ${res.status}`);
  const manifest = await res.json();
  if (manifest.version !== 1 || !manifest.maps || !manifest.cars) {
    throw new Error('GameCrash Brazil: manifest incompatível');
  }

  async function load(group, id) {
    const metadata = manifest[group]?.[id];
    if (!metadata) throw new Error(`GameCrash Brazil: ${group}/${id} não existe`);
    const path = metadata.file ?? metadata.filename;
    if (typeof path !== 'string') throw new Error('Arquivo GLB ausente do catálogo');
    // Catalog paths are relative to Vite public/, not the manifest directory.
    const uri = new URL(path.replace(/^assets\/brazil\//, ''), root).href;
    const gltf = await loader.loadAsync(uri);
    const object = gltf.scene;
    object.name = id;
    object.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = !node.name.startsWith('COLLIDER_road');
      node.receiveShadow = true;
    });
    return { object, metadata: structuredClone(metadata), animations: gltf.animations };
  }

  return {
    manifest,
    listCars: () => Object.entries(manifest.cars).map(([id, data]) => ({ id, ...data })),
    listMaps: () => Object.entries(manifest.maps).map(([id, data]) => ({ id, ...data })),
    loadCar: (id) => load('cars', id),
    loadMap: (id) => load('maps', id),
    spawnCar: (carObject, mapMetadata) => {
      const { position, yawRad } = mapMetadata.spawn;
      carObject.position.set(...position);
      carObject.rotation.set(0, yawRad, 0);
      return carObject;
    }
  };
}
