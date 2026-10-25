import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BRAZIL_CARS,BRAZIL_MAPS,type BrazilCarId,type BrazilMapId} from './catalog.ts';
export {BRAZIL_CARS,BRAZIL_MAPS};
export type {BrazilCarId,BrazilMapId};

export function brazilAssetURL(file:string,base:string=import.meta.env.BASE_URL):string {
  if(!file.startsWith('assets/brazil/') || file.includes('..'))throw new Error('Arquivo fora do catálogo brasileiro');
  const normalized=base.startsWith('/')
    ? base.replace(/\/?$/, '/')
    : typeof document==='undefined' ? '/' : new URL(base,document.baseURI).pathname;
  return normalized+file;
}

const loader=new GLTFLoader();
export async function loadBrazilCar(id:BrazilCarId):Promise<THREE.Group>{
  const file=BRAZIL_CARS[id].file;
  const gltf=await loader.loadAsync(brazilAssetURL(file));
  gltf.scene.name='brazil-car-'+id;
  gltf.scene.rotation.y=Math.PI; // GLB faces -Z, the arcade game drives +Z.
  gltf.scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;}});
  return gltf.scene;
}

export async function loadBrazilScenery(id:BrazilMapId):Promise<THREE.Group>{
  const gltf=await loader.loadAsync(brazilAssetURL(BRAZIL_MAPS[id].file));
  const scenery=gltf.scene;
  scenery.name='brazil-scenery-'+id;
  scenery.rotation.y=Math.PI;
  // Align the beginning of the GLB at the origin of the current +Z test track.
  scenery.position.set(0,id==='brasilia-eixo-monumental'?0:id==='imigrantes'?-17:-28,170);
  scenery.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    // The existing test track owns collision physics and obstacles.
    // The road and barriers in these GLBs are not active in this compatibility mode.
    if(obj.name.startsWith('COLLIDER_') || obj.name.startsWith('lane_') || obj.name.startsWith('central_')){
      obj.visible=false;
      return;
    }
    obj.castShadow=false;obj.receiveShadow=true;
  });
  return scenery;
}

export function disposeBrazilObject(group:THREE.Object3D){
  group.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    obj.geometry.dispose();
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    mats.forEach(m=>{for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose()});
  });
}
