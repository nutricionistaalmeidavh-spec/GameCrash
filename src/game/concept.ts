import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Bundled CC-BY model, already normalized to metres and +Z forward. */
export async function loadConcept():Promise<THREE.Group>{
  const base=new URL(import.meta.env.BASE_URL,document.baseURI);
  const {scene}=await new GLTFLoader().loadAsync(new URL('assets/concept/car.glb',base).href);
  scene.name='concept-car';
  // Static cabin details can share draw calls; doors, glass and physical assemblies stay separate.
  scene.updateMatrixWorld(true);
  const inverse=scene.matrixWorld.clone().invert(),batches=new Map<string,THREE.Mesh[]>();
  scene.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh)||Array.isArray(obj.material)||!/^Interior(?!Door)/.test(obj.name))return;
    const key=obj.material.uuid+'|'+Object.keys(obj.geometry.attributes).sort().join(',');
    const list=batches.get(key)??[];list.push(obj);batches.set(key,list);
  });
  for(const list of batches.values()){
    if(list.length<2)continue;
    const geometries=list.map(obj=>(obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone()).applyMatrix4(inverse.clone().multiply(obj.matrixWorld)));
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,list[0].material);mesh.name='CabinBatch';scene.add(mesh);
    for(const obj of list){obj.visible=false;obj.geometry.dispose();obj.geometry=new THREE.BufferGeometry();}
  }
  scene.traverse(obj=>{
    if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;}
  });
  return scene;
}
