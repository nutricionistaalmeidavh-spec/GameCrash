import * as THREE from 'three';

/** Deterministic, bundled procedural asphalt. No network textures or per-frame work. */
export function asphaltMaterial(length:number){
  const size=128,color=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
  let seed=7413;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=(seed>>>24)/255,value=grain>.97?100:44+grain*22;
    color.set([value*.94,value*.98,value,255],i*4);
    const r=205+Math.round(grain*45);rough.set([r,r,r,255],i*4);
  }
  const map=new THREE.DataTexture(color,size,size),roughnessMap=new THREE.DataTexture(rough,size,size);
  map.colorSpace=THREE.SRGBColorSpace;
  for(const t of [map,roughnessMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(9.5,length/2);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;}
  return new THREE.MeshStandardMaterial({color:0xb5bcc3,map,roughnessMap,roughness:1,metalness:0});
}

export function roadDetails(root:THREE.Group,end:number){
  const metal=new THREE.MeshStandardMaterial({color:0x89969d,roughness:.46,metalness:.65});
  const curb=new THREE.MeshStandardMaterial({color:0x92928a,roughness:.95});
  const count=Math.ceil((end+50)/4)*2,dummy=new THREE.Object3D();
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.85,.14),metal,count);
  const rails=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.25,3.95),metal,count);
  const kerbs=new THREE.InstancedMesh(new THREE.BoxGeometry(.45,.14,3.9),curb,count);
  let index=0;
  for(let z=-50;z<end;z+=4)for(const side of [-1,1]){
    dummy.position.set(side*12.2,.45,z);dummy.updateMatrix();posts.setMatrixAt(index,dummy.matrix);
    dummy.position.set(side*12.1,.8,z);dummy.updateMatrix();rails.setMatrixAt(index,dummy.matrix);
    dummy.position.set(side*9.8,.09,z);dummy.updateMatrix();kerbs.setMatrixAt(index,dummy.matrix);index++;
  }
  for(const batch of [posts,rails,kerbs]){batch.count=index;batch.castShadow=false;batch.receiveShadow=true;batch.instanceMatrix.needsUpdate=true;root.add(batch);}
  // Decorative drainage slots stay outside the drivable lanes; track collision remains continuous.
  const drains=new THREE.InstancedMesh(new THREE.BoxGeometry(.25,.012,.8),new THREE.MeshStandardMaterial({color:0x333a3c,roughness:.8}),Math.ceil(end/18)*2);
  let drain=0;
  for(let z=0;z<end;z+=18)for(const side of [-1,1]){dummy.position.set(side*10.5,.06,z);dummy.updateMatrix();drains.setMatrixAt(drain++,dummy.matrix)}
  drains.count=drain;root.add(drains);
}
