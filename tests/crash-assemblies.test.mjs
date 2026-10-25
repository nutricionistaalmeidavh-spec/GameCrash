import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import concept from '../src/game/concept.json' with {type:'json'};
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from '../src/game/driving.ts';
import {VEHICLES} from '../src/game/rules.ts';
import {createVehicle} from '../src/game/vehicle.ts';

before(async()=>{await RAPIER.init()});
const assemblyIds=['hood','door-left','door-right','front-bumper','rear-bumper','glass-front','glass-rear','glass-left','glass-right'];

test('Concept GLB contains separate Blender-authored physical assemblies with metadata',async()=>{
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const doc=await io.read('public/assets/concept/car.glb');
  const authored=doc.getRoot().listNodes().filter(n=>typeof n.getExtras().crashPart==='string');
  const ids=authored.map(n=>n.getExtras().crashPart);
  for(const id of assemblyIds)assert.equal(ids.filter(x=>x===id).length,1,'missing or duplicate '+id);
  for(const id of assemblyIds){
    const meta=concept.parts?.find(p=>p.id===id);
    assert.ok(meta,id+' has no physics assembly specification');
    assert.ok(meta.mass>0&&meta.threshold>0&&meta.threshold<1);
    assert.ok(meta.center.length===3&&meta.half.every(x=>x>0));
    const node=authored.find(n=>n.getExtras().crashPart===id);
    assert.ok(node?.listChildren().length>0,id+' must contain actual 3D geometry');
  }
});

test('gentle motion on ramp keeps Concept assembly fixed and before crashes releases none',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,200).setTranslation(0,-.025,90));
  const car=new VehicleDynamics(RAPIER,world,VEHICLES.concept);
  try{
    for(let i=0;i<360;i++){car.update(EMPTY_INPUT,600);world.step()}
    assert.equal(car.structure.fragments.length,0);
    assert.equal(car.structure.brokenBeams,0);
    assert.equal(car.structure.plasticWorkJ,0);
  }finally{world.free()}
});

test('real frontal high speed collision detaches only physically released assemblies, conserving mass',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,200).setTranslation(0,-.025,90));
  world.createCollider(RAPIER.ColliderDesc.cuboid(8,4,.6).setTranslation(0,2,16));
  const car=new VehicleDynamics(RAPIER,world,VEHICLES.concept);
  try{
    for(let i=0;i<120;i++){car.update(EMPTY_INPUT,600);world.step()}
    car.ensureForwardSpeed(150,600,true);
    for(let i=0;i<360;i++){car.update(EMPTY_INPUT,600);world.step()}
    const fragments=car.structure.fragments;
    assert.ok(fragments.length>0,'real crash should detach at least one piece');
    assert.ok(fragments.every(f=>assemblyIds.includes(f.id)||f.id.startsWith('wheel-')));
    assert.equal(new Set(fragments.map(f=>f.id)).size,fragments.length,'one rigid body per detached assembly');
    assert.ok(Math.abs(car.structure.totalMass-VEHICLES.concept.mass)<.25,'detachment must conserve mass');
  }finally{world.free()}
});

test('a single release moves the real mesh assembly, keeps parent shell, does not copy the debris',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  const car=new VehicleDynamics(RAPIER,world,VEHICLES.concept);
  const visual=createVehicle(VEHICLES.concept);
  visual.setStructure(car.structure);
  const asset=new THREE.Group(),part=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.6,.07,.3),new THREE.MeshStandardMaterial());
  part.userData.crashPart='hood';part.name='part-hood';part.add(mesh);asset.add(part);visual.root.add(asset);
  visual.addDamageMeshes(asset);
  try{
    const fragment=car.structure.releaseFragment('hood',{x:2,y:3,z:4},{x:.5,y:.05,z:.4},12);
    visual.updatePhysics(car,true);
    assert.ok(part.parent!==asset,'hood should be reparented into debris root on physical release');
    assert.ok(part.parent&&part.parent!==visual.root);
    const parent=part.parent;
    visual.updatePhysics(car,true);
    assert.equal(part.parent,parent,'must not duplicate on subsequent frames');
    fragment.body.setTranslation({x:5,y:6,z:7},true);
    visual.updatePhysics(car,true);
    assert.equal(parent.position.x,5);
  }finally{world.free()}
});
