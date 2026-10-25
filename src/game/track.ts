import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type {ScenarioId} from './rules.ts';
import {SCENARIOS,SPEEDBUMPS} from './rules.ts';
import {bumpShape} from './bump.ts';
import {createSurfaceTextures,type GraphicsProfile} from './visuals';

/** The road collider top is y=0.075. A flat entry and easing slope prevent
 *  a physical kerb being mistaken for a wall at 200 km/h.
 */
export function buildRampProfile(centerZ:number):Array<{z:number;y:number}>{
  return [
    {z:centerZ-12,y:.075},
    {z:centerZ-8,y:.075},
    {z:centerZ-5,y:.26},
    {z:centerZ+8,y:3.36}
  ];
}
const mat=(color:number,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function addBox(root:THREE.Group,size:[number,number,number],pos:[number,number,number],material:THREE.Material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
export interface Track {root:THREE.Group; obstacleHandles:Set<number>; dispose():void}
export function buildTrack(scene:THREE.Scene, world:RAPIER.World,scenario:ScenarioId,profile:GraphicsProfile='auto'):Track{
  const root=new THREE.Group();scene.add(root);
  const obstacleHandles=new Set<number>();
  const roadEnd=scenario==='speedbumps'?SPEEDBUMPS.finishZ+100:675;
  const roadCenter=(roadEnd-65)/2;
  const roadLength=roadEnd+65;
  const surfaces=createSurfaceTextures(roadLength,profile);
  const {road,grass,shoulder}=surfaces;
  const stripe=mat(0xd4d5cf,.7),yellow=mat(0xe9c664,.73);
  addBox(root,[520,.12,roadLength],[0,-.1,roadCenter],grass).castShadow=false;
  addBox(root,[25,.08,roadLength],[0,.01,roadCenter],shoulder).castShadow=false;
  addBox(root,[19,.085,roadLength],[0,.03,roadCenter],road).castShadow=false;
  for(const side of [-1,1]){
    addBox(root,[.20,.035,roadLength-20],[side*9,.095,roadCenter],stripe).castShadow=false;
    addBox(root,[.14,.025,roadLength-20],[side*6.1,.1,roadCenter],yellow).castShadow=false;
  }
  const dashCount=Math.ceil((roadEnd+30)/13)*2;
  const dashes=new THREE.InstancedMesh(new THREE.BoxGeometry(.15,.025,6.1),stripe,dashCount);
  const dashTransform=new THREE.Object3D();let dashIndex=0;
  for(let z=-30;z<roadEnd;z+=13)for(const x of [-3.05,3.05]){
    dashTransform.position.set(x,.10,z);dashTransform.updateMatrix();dashes.setMatrixAt(dashIndex++,dashTransform.matrix);
  }
  root.add(dashes);
  world.createCollider(RAPIER.ColliderDesc.cuboid(260,.3,roadLength/2).setFriction(1),world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.225,roadCenter)));
  const trunk=mat(0x604735),leaf=mat(0x2b5643),leafAlt=mat(0x3b6b49);
  const trunkGeo=new THREE.CylinderGeometry(.17,.26,2.5,5),canopyGeo=new THREE.ConeGeometry(2.2,6.2,6);
  const trees=scenario==='speedbumps'?202:90;
  const trunkBatch=new THREE.InstancedMesh(trunkGeo,trunk,trees);
  const leafBatch=new THREE.InstancedMesh(canopyGeo,leaf,trees);
  const leafBatch2=new THREE.InstancedMesh(canopyGeo,leafAlt,trees);
  const dummy=new THREE.Object3D();
  for(let i=0;i<trees;i++){
    const z=-30+i*(scenario==='speedbumps'?7.6:7.75);
    const side=i%2===0?1:-1;
    const spread=15+((i*19)%17);
    const x=side*spread;
    const sc=.7+((i*31)%11)*.07;
    dummy.position.set(x,1.1*sc,z);dummy.scale.setScalar(sc);dummy.updateMatrix();trunkBatch.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,5.4*sc,z);dummy.updateMatrix();leafBatch.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,4.3*sc,z+1.8);dummy.scale.setScalar(sc*.75);dummy.updateMatrix();leafBatch2.setMatrixAt(i,dummy.matrix);
  }
  trunkBatch.castShadow=profile==='ultra';leafBatch.castShadow=profile==='ultra';
  root.add(trunkBatch,leafBatch,leafBatch2);
  // Instanced Brazilian roadside lighting columns: detail without dozens of draw calls.
  const poleCount=scenario==='speedbumps'?78:34;
  const poleMaterial=mat(0x89969a,.55,.37);
  const fixtureMaterial=mat(0xf2f0da,.28,.12);
  const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.075,.12,7.2,6),poleMaterial,poleCount);
  const lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1.3,.14,.36),fixtureMaterial,poleCount);
  for(let i=0;i<poleCount;i++){
    const side=i%2===0?1:-1,offset=side*15.7,z=26+i*(roadEnd/poleCount);
    dummy.scale.set(1,1,1);dummy.position.set(offset,3.6,z);dummy.rotation.set(0,0,0);dummy.updateMatrix();poles.setMatrixAt(i,dummy.matrix);
    dummy.position.set(offset-side*.5,7.15,z);dummy.updateMatrix();lamps.setMatrixAt(i,dummy.matrix);
  }
  poles.instanceMatrix.needsUpdate=true;lamps.instanceMatrix.needsUpdate=true;
  root.add(poles,lamps);
  const rock=mat(0x72837a);
  for(let i=0;i<13;i++){
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(44+i%3*12,40+i%4*8,5),rock);
    mountain.position.set(i%2===0?-88-(i%3)*18:88+(i%4)*20,10,-130+i*75);
    root.add(mountain);
  }
  const concrete=mat(0xc3ced5,.97),paint=mat(0xd6fd45,.67),block=mat(0xf0a75b,.9);
  function obstacle(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.MeshStandardMaterial,angle=0,collidable=true){
    const mesh=addBox(root,[w,h,d],[x,y,z],m);
    mesh.rotation.x=angle;
    const rotation={x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)};
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z).setRotation(rotation));
    const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setFriction(.8).setRestitution(.02),body);
    if(collidable)obstacleHandles.add(collider.handle);
    return mesh;
  }
  const z=SCENARIOS[scenario].z;
  if(scenario==='wall'){
    obstacle(0,2.5,z,12,5,1.8,concrete);
    for(let i=-5;i<=5;i+=2)addBox(root,[.08,4.9,.04],[i,2.5,z-1],mat(0x85969e));
    obstacle(0,.11,z-6,10,.13,3,paint,0,false);
    for(let i=0;i<6;i++)addBox(root,[1.3,.045,.3],[-5+i*2,.2,z-5],road);
  }
  if(scenario==='blocks'){
    obstacle(0,1.22,z,6,2.4,2.0,concrete);
    obstacle(-4.9,1.1,z+9,5.0,2.2,2.3,block);
    obstacle(4.6,1.2,z+18,5.4,2.3,2.3,concrete);
    for(let i=0;i<5;i++)addBox(root,[1,.055,2],[-5+i*2.5,.16,z-7],paint);
  }
  if(scenario==='ramp'){
    // Smooth approach: ground-level entry, then gradual incline. Each visible
    // wedge uses the *same* coordinates as its Rapier convex collider.
    const profile=buildRampProfile(z),width=9,bottom=-.19;
    for(let i=1;i<profile.length;i++){
      const a=profile[i-1],b=profile[i],half=width/2;
      const vertices=new Float32Array([
        -half,bottom,a.z,half,bottom,a.z,-half,a.y,a.z,half,a.y,a.z,
        -half,bottom,b.z,half,bottom,b.z,-half,b.y,b.z,half,b.y,b.z
      ]);
      const indices=[0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3];
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,paint);
      mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);
      const collider=RAPIER.ColliderDesc.convexHull(vertices);
      if(!collider)throw new Error('Rampa inválida');
      world.createCollider(collider.setFriction(1).setRestitution(0));
    }
    for(let i=0;i<8;i++)addBox(root,[9,.05,2.5],[0,.11,z+25+i*3.5],i%2===0?concrete:road);
    obstacle(0,1.3,z+68,11,2.6,1.6,concrete);
  }
  if(scenario==='speedbumps'){
    // Instancing shares two meshes for all 120 physical bumps, keeping WebKit draw calls low.
    const shape=bumpShape();
    const bumpGeo=new THREE.BufferGeometry();
    bumpGeo.setAttribute('position',new THREE.BufferAttribute(shape.vertices,3));bumpGeo.setIndex(shape.indices);bumpGeo.computeVertexNormals();
    const paintGeo=new THREE.BoxGeometry(18,.012,.35);
    const bumps=new THREE.InstancedMesh(bumpGeo,block,SPEEDBUMPS.count);
    const markings=new THREE.InstancedMesh(paintGeo,paint,SPEEDBUMPS.count);
    const instance=new THREE.Object3D();
    for(let i=0;i<SPEEDBUMPS.count;i++){
      const zBump=SPEEDBUMPS.firstZ+i*SPEEDBUMPS.spacing;
      instance.position.set(0,0,zBump);instance.updateMatrix();
      bumps.setMatrixAt(i,instance.matrix);
      instance.position.set(0,.283,zBump);instance.updateMatrix();
      markings.setMatrixAt(i,instance.matrix);
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,0,zBump));
      const collider=RAPIER.ColliderDesc.convexHull(shape.vertices);
      if(!collider)throw new Error('Geometria inválida da lombada');
      world.createCollider(collider.setFriction(.9).setRestitution(.03),body);
    }
    bumps.instanceMatrix.needsUpdate=true;markings.instanceMatrix.needsUpdate=true;
    bumps.receiveShadow=true;root.add(bumps,markings);
  }
  for(const zpos of [70,140,185]){
    addBox(root,[.25,3.5,.25],[-13.8,1.75,zpos],concrete);
    addBox(root,[.18,1.6,3.8],[-13.8,4.2,zpos],paint);
  }
  return {root,obstacleHandles,dispose(){
    scene.remove(root);
    surfaces.dispose();
    root.traverse((obj)=>{
      if(obj instanceof THREE.Mesh||obj instanceof THREE.InstancedMesh){obj.geometry.dispose();
        const mm=obj.material; if(Array.isArray(mm))mm.forEach(m=>m.dispose());else mm.dispose();}
    });
  }};
}
