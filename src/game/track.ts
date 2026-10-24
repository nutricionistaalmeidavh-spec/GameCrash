import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type {ScenarioId} from './rules';
import {SCENARIOS} from './rules';

const mat=(color:number,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function addBox(root:THREE.Group,size:[number,number,number],pos:[number,number,number],material:THREE.Material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
export interface Track {root:THREE.Group; obstacleHandles:Set<number>; dispose():void}
export function buildTrack(scene:THREE.Scene, world:RAPIER.World,scenario:ScenarioId):Track{
  const root=new THREE.Group();scene.add(root);
  const obstacleHandles=new Set<number>();
  const grass=mat(0x566c4d),road=mat(0x333a42),shoulder=mat(0x667078),stripe=mat(0xd5dce0),yellow=mat(0xe5c468);
  addBox(root,[520,.12,920],[0,-.1,245],grass).castShadow=false;
  addBox(root,[25,.08,880],[0,.01,235],shoulder).castShadow=false;
  addBox(root,[19,.085,880],[0,.03,235],road).castShadow=false;
  for(const side of [-1,1]){
    addBox(root,[.20,.035,860],[side*9,.095,235],stripe).castShadow=false;
    addBox(root,[.14,.025,860],[side*6.1,.1,235],yellow).castShadow=false;
  }
  for(let z=-30;z<650;z+=13)for(const x of [-3.05,3.05]) addBox(root,[.15,.025,6.1],[x,.10,z],stripe).castShadow=false;
  world.createCollider(RAPIER.ColliderDesc.cuboid(260,.3,470).setFriction(1),world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.33,245)));
  const trunk=mat(0x604735),leaf=mat(0x2b5643),leafAlt=mat(0x3b6b49);
  const trunkGeo=new THREE.CylinderGeometry(.17,.26,2.5,5),canopyGeo=new THREE.ConeGeometry(2.2,6.2,6);
  const trees=90;
  const trunkBatch=new THREE.InstancedMesh(trunkGeo,trunk,trees);
  const leafBatch=new THREE.InstancedMesh(canopyGeo,leaf,trees);
  const leafBatch2=new THREE.InstancedMesh(canopyGeo,leafAlt,trees);
  const dummy=new THREE.Object3D();
  for(let i=0;i<trees;i++){
    const z=-30+i*7.75;
    const side=i%2===0?1:-1;
    const spread=15+((i*19)%17);
    const x=side*spread;
    const sc=.7+((i*31)%11)*.07;
    dummy.position.set(x,1.1*sc,z);dummy.scale.setScalar(sc);dummy.updateMatrix();trunkBatch.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,5.4*sc,z);dummy.updateMatrix();leafBatch.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,4.3*sc,z+1.8);dummy.scale.setScalar(sc*.75);dummy.updateMatrix();leafBatch2.setMatrixAt(i,dummy.matrix);
  }
  trunkBatch.castShadow=true;leafBatch.castShadow=true;root.add(trunkBatch,leafBatch,leafBatch2);
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
    const angle=-.24;
    obstacle(0,1.65,z,9,.85,15,paint,angle,false);
    for(let i=0;i<8;i++)addBox(root,[9,.05,2.5],[0,.11,z+25+i*3.5],i%2===0?concrete:road);
    obstacle(0,1.3,z+68,11,2.6,1.6,concrete);
  }
  for(const zpos of [70,140,185]){
    addBox(root,[.25,3.5,.25],[-13.8,1.75,zpos],concrete);
    addBox(root,[.18,1.6,3.8],[-13.8,4.2,zpos],paint);
  }
  return {root,obstacleHandles,dispose(){
    scene.remove(root);
    root.traverse((obj)=>{
      if(obj instanceof THREE.Mesh||obj instanceof THREE.InstancedMesh){obj.geometry.dispose();
        const mm=obj.material; if(Array.isArray(mm))mm.forEach(m=>m.dispose());else mm.dispose();}
    });
  }};
}
