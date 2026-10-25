import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {VehicleDynamics,EMPTY_INPUT,PHYSICS_DT} from '../src/game/driving.ts';
import {createVehicle} from '../src/game/vehicle.ts';
import {VEHICLES} from '../src/game/rules.ts';
before(async()=>{await RAPIER.init()});

test('visible panels follow physical nodes and rendering neither detaches parts nor accumulates dents',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  const scene=new THREE.Scene(),car=new VehicleDynamics(RAPIER,world,VEHICLES.sedan),visual=createVehicle(VEHICLES.sedan);
  scene.add(visual.root,visual.debrisRoot);visual.setStructure(car.structure);
  world.createCollider(RAPIER.ColliderDesc.cuboid(20,.1,100).setTranslation(0,-.025,50));
  world.createCollider(RAPIER.ColliderDesc.cuboid(6,3,.5).setTranslation(0,3,15));
  const render=()=>{const p=car.body.translation(),q=car.body.rotation();visual.root.position.set(p.x,p.y,p.z);visual.root.quaternion.set(q.x,q.y,q.z,q.w);visual.updatePhysics(car)};
  try{
    for(let i=0;i<120;i++){car.update(EMPTY_INPUT,600);world.step()}render();
    const panel=visual.panels[0],topology=new Uint16Array(visual.panels[0].geometry.index.array),before=new Float32Array(panel.geometry.getAttribute('position').array);
    for(const body of [car.body,...car.structure.nodes.filter(n=>!n.anchor).map(n=>n.body)])body.setLinvel({x:0,y:0,z:120/3.6},true);
    // Physics runs at 120 Hz independently of the render loop.
    for(let i=0;i<360;i++){car.update(EMPTY_INPUT,600);world.step();if(i%4===0)render()}render();
    const after=new Float32Array(panel.geometry.getAttribute('position').array);
    assert.ok(after.some((value,i)=>Math.abs(value-before[i])>.15),'mesh must change after physical collision');
    assert.ok(car.structure.plasticWorkJ>0);
    assert.deepEqual(new Uint16Array(panel.geometry.index.array),topology,'rupture must not erase arbitrary triangles from the sheet');
    const partCount=car.structure.fragments.length,bodyCount=world.bodies.len();
    for(let i=0;i<60;i++)render();
    assert.deepEqual(new Float32Array(panel.geometry.getAttribute('position').array),after,'rendering same state must be idempotent');
    assert.equal(car.structure.fragments.length,partCount,'render loop must not create physical parts');
    assert.equal(world.bodies.len(),bodyCount);
    assert.ok(Math.abs(car.structure.totalMass-VEHICLES.sedan.mass)<.1);
  }finally{world.free();for(const root of [visual.root,visual.debrisRoot])root.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();for(const material of Array.isArray(obj.material)?obj.material:[obj.material])material.dispose()}})}
});
