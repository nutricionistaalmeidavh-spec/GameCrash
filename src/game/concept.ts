import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Bundled CC-BY model, already normalized to metres and +Z forward. */
export async function loadConcept():Promise<THREE.Group>{
  const base=new URL(import.meta.env.BASE_URL,document.baseURI);
  const {scene}=await new GLTFLoader().loadAsync(new URL('assets/concept/car.glb',base).href);
  scene.name='concept-car';
  scene.traverse(obj=>{
    if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;}
  });
  return scene;
}
