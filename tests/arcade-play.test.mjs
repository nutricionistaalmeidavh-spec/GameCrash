import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from '../src/game/driving.ts';
import {VEHICLES,SPEEDBUMPS} from '../src/game/rules.ts';
import {bumpRunOutcome} from '../src/game/arcade.ts';
import {bumpShape} from '../src/game/bump.ts';

before(async()=>{await RAPIER.init()});
function fixture(){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,2000).setTranslation(0,-.025,950));
  const car=new VehicleDynamics(RAPIER,world,VEHICLES.sedan);
  for(let i=0;i<120;i++){car.update(EMPTY_INPUT,600);world.step()}
  return {world,car};
}

test('throttle press launches the complete deformable vehicle at 200 km/h without waiting for acceleration',()=>{
  const {world,car}=fixture();try{
    const initialY=car.body.linvel().y;
    car.ensureForwardSpeed(200,600);
    assert.ok(car.signedSpeed*3.6>=199&&car.signedSpeed*3.6<=201);
    assert.ok(Math.abs(car.body.linvel().y-initialY)<.01,'keep real vertical motion');
    const nodes=car.structure.nodes.filter(n=>!n.anchor);
    assert.ok(nodes.every(n=>Math.abs(n.body.linvel().z-car.body.linvel().z)<2),'the cage must move together with the chassis');
    car.ensureForwardSpeed(200,600);
    assert.ok(car.signedSpeed*3.6<=201,'repeat boost must not stack up');
  }finally{world.free()}
});
test('instant speed respects the selected slider maximum and never lowers a faster moving vehicle',()=>{
  const {world,car}=fixture();try{
    car.ensureForwardSpeed(200,120);
    assert.ok(car.signedSpeed*3.6>119&&car.signedSpeed*3.6<121);
    car.ensureForwardSpeed(200,600);
    assert.ok(car.signedSpeed*3.6>=199);
    car.ensureForwardSpeed(200,100);
    assert.ok(car.signedSpeed*3.6>=199,'pressing the accelerator must not brake the car');
  }finally{world.free()}
});
test('long 120-bump mode ignores damage, rollovers, and elapsed time; ends only at the line or out of track',()=>{
  assert.equal(bumpRunOutcome({x:0,y:.7,z:SPEEDBUMPS.firstZ+SPEEDBUMPS.spacing*2,integrity:0,elapsed:1000,overturnedTime:100}),null);
  assert.equal(bumpRunOutcome({x:0,y:.7,z:SPEEDBUMPS.finishZ,integrity:10,elapsed:20,overturnedTime:0}),'complete');
  assert.equal(bumpRunOutcome({x:46,y:.7,z:100,integrity:100,elapsed:10,overturnedTime:0}),'out');
  assert.equal(bumpRunOutcome({x:0,y:-7,z:100,integrity:100,elapsed:10,overturnedTime:0}),'out');
});
test('holding arcade accelerator maintains forward motion through several physical bumps',()=>{
  const {world,car}=fixture();try{
    const shape=bumpShape();
    for(let i=0;i<5;i++)world.createCollider(RAPIER.ColliderDesc.convexHull(shape.vertices).setTranslation(0,0,15+i*11));
    for(let i=0;i<600&&car.body.translation().z<76;i++){
      car.update({...EMPTY_INPUT,throttle:true},600);
      car.ensureForwardSpeed(200,600);
      world.step();
    }
    assert.ok(car.body.translation().z>45,'should continue beyond second/third bump rather than stall at first');
  }finally{world.free()}
});
