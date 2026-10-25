import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {buildRampProfile,rampSegmentVertices} from '../src/game/ramp.ts';
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from '../src/game/driving.ts';
import {VEHICLES,SCENARIOS} from '../src/game/rules.ts';
import {sheetOffsets,cageWeights} from '../src/game/skin.ts';

before(async()=>{await RAPIER.init()});

test('megaramp begins seamlessly at road level without a vertical curb or physics speed bump',()=>{
  const profile=buildRampProfile(SCENARIOS.ramp.z);
  assert.ok(profile.length>=4);
  assert.ok(Math.abs(profile[0].y-.075)<.025,'first ramp vertex must be flush with road collider');
  assert.ok(profile.at(-1).y>2,'ramp must rise significantly');
  for(let i=1;i<profile.length;i++) {
    assert.ok(profile[i].z>profile[i-1].z);
    assert.ok(profile[i].y>=profile[i-1].y);
    assert.ok((profile[i].y-profile[i-1].y)/(profile[i].z-profile[i-1].z)<=.26,'transition to incline must be gradual');
  }
});
test('contact with ramp approach does not spawn debris or destroy the body before jump',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(260,.3,450).setTranslation(0,-.225,320));
  const profile=buildRampProfile(SCENARIOS.ramp.z);
  for(let i=1;i<profile.length;i++)world.createCollider(RAPIER.ColliderDesc.convexHull(rampSegmentVertices(profile[i-1],profile[i])).setFriction(1));
  const car=new VehicleDynamics(RAPIER,world,VEHICLES.sedan);
  try{
    for(let i=0;i<120;i++){car.update(EMPTY_INPUT,600);world.step()}
    const start=SCENARIOS.ramp.z-31;
    const position=car.body.translation();
    car.body.setTranslation({x:position.x,y:position.y,z:start},true);
    for(const node of car.structure.nodes)if(!node.anchor){const p=node.body.translation();node.body.setTranslation({x:p.x,y:p.y,z:p.z+start},true)}
    car.ensureForwardSpeed(200,600,true);
    let entered=false,highestBeforeTakeoff=0;
    for(let i=0;i<260;i++){
      car.update({...EMPTY_INPUT,throttle:true},600);
      world.step();
      const z=car.body.translation().z;
      if(z>SCENARIOS.ramp.z-11&&z<SCENARIOS.ramp.z+2){
        entered=true;
        highestBeforeTakeoff=Math.max(highestBeforeTakeoff,car.structure.brokenBeams);
      }
      if(z>SCENARIOS.ramp.z+6)break;
    }
    assert.ok(entered,'the vehicle must reach the ramp');
    assert.equal(highestBeforeTakeoff,0,'the approach must not tear the car apart before the jump');
  }finally{world.free()}
});
test('render-only cage displacement is bounded and continuous even when two nodes separate',()=>{
  const nodes=[];
  for(const z of [-2,-1.2,-.4,.4,1.2,2])for(const y of [-.5,.6])for(const x of [-1,1])nodes.push({rest:{x,y,z},anchor:false});
  const raw=nodes.map((n,i)=>i===19?{x:12,y:10,z:-8}:{x:0,y:0,z:0});
  const softened=sheetOffsets(nodes,raw,.95);
  assert.ok(Math.max(...softened.map(v=>Math.hypot(v.x,v.y,v.z)))<1.3);
  const weights=cageWeights(nodes,{x:0,y:0,z:.1});
  assert.equal(weights.indices.length,8);
  assert.ok(Math.abs(weights.weights.reduce((s,v)=>s+v,0)-1)<.0001);
});
