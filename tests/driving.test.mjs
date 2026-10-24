import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from '../src/game/driving.ts';
import {VEHICLES} from '../src/game/rules.ts';
import {bumpShape} from '../src/game/bump.ts';

before(async()=>{await RAPIER.init()});
function fixture(spec=VEHICLES.sedan){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,2000).setTranslation(0,-.025,950));
  const car=new VehicleDynamics(RAPIER,world,spec);
  const run=(seconds,input=EMPTY_INPUT)=>{for(let i=0;i<seconds/PHYSICS_DT;i++){car.update(input,600);world.step()}};
  run(1);
  return {world,car,run};
}
test('all 13 chassis settle on four suspension contacts without moving',()=>{
  for(const spec of Object.values(VEHICLES)){
    const {world,car,run}=fixture(spec);
    try{
      run(2);assert.equal(car.groundedWheels,4,spec.id);
      assert.ok(Math.abs(car.body.translation().z)<.01,spec.id);
      assert.ok(car.body.translation().y>.35,spec.id);
      assert.ok(car.speed<.05,spec.id);
      assert.ok(Math.abs(car.body.mass()-spec.mass)<.1,spec.id);
    }finally{world.free()}
  }
});
test('wheel traction accelerates forward and braking stops before a coasting car',()=>{
  const braking=fixture(),coasting=fixture();
  try{
    for(const f of [braking,coasting])f.run(3,{...EMPTY_INPUT,throttle:true});
    assert.ok(braking.car.signedSpeed>15,'must drive along local +Z');
    braking.run(4,{...EMPTY_INPUT,brake:true});coasting.run(4);
    assert.ok(braking.car.speed<1,'brake must stop the chassis');
    assert.ok(coasting.car.speed>10,'releasing throttle must not stop instantly');
    assert.ok(braking.car.body.translation().z<coasting.car.body.translation().z-10);
  }finally{braking.world.free();coasting.world.free()}
});
test('steering changes heading with mirrored trajectories instead of sliding sideways',()=>{
  for(const side of ['left','right']){
    const {world,car,run}=fixture();
    try{
      run(1,{...EMPTY_INPUT,throttle:true});
      run(.7,{...EMPTY_INPUT,throttle:true,[side]:true});
      const p=car.body.translation(),q=car.body.rotation();
      assert.ok(side==='left'?p.x<-.2:p.x>.2,`${side}: x=${p.x}`);
      assert.ok(Math.abs(q.y)>.05,'chassis must turn');
      assert.ok(Math.abs(q.x)<.25&&Math.abs(q.z)<.25,'normal turn must not overturn');
    }finally{world.free()}
  }
});
test('accelerator and steering cannot propel or straighten an airborne chassis',()=>{
  const {world,car}=fixture();
  try{
    car.body.setTranslation({x:0,y:8,z:0},true);
    car.body.setRotation({x:Math.sin(.2),y:0,z:0,w:Math.cos(.2)},true);
    car.body.setLinvel({x:0,y:0,z:20},true);
    for(let i=0;i<30;i++){car.update({...EMPTY_INPUT,throttle:true,right:true},600);world.step()}
    assert.equal(car.groundedWheels,0);
    assert.ok(car.body.linvel().z<=20,'no wheel traction in midair');
    assert.ok(car.body.linvel().y< -2,'gravity must continue');
    assert.ok(Math.abs(car.body.rotation().x)>.15,'pitch must not be erased');
  }finally{world.free()}
});
test('a rounded bump compresses suspension without stopping a car at 50 km/h',()=>{
  const {world,car}=fixture();
  try{
    const shape=bumpShape();
    world.createCollider(RAPIER.ColliderDesc.convexHull(shape.vertices).setTranslation(0,0,12));
    car.body.setLinvel({x:0,y:0,z:50/3.6},true);
    let minLength=1,maxPitch=0;
    for(let i=0;i<240;i++){
      car.update(EMPTY_INPUT,600);world.step();
      minLength=Math.min(minLength,car.controller.wheelSuspensionLength(1));
      maxPitch=Math.max(maxPitch,Math.abs(car.body.rotation().x));
    }
    assert.ok(car.body.translation().z>20,'must cross the bump rather than hit a vertical wall');
    assert.ok(minLength<.20,'springs must compress on the bump');
    assert.ok(maxPitch>.005,'chassis must respond to the bump');
    assert.ok(car.body.translation().y>.35,'chassis must remain above the road');
  }finally{world.free()}
});
test('CCD prevents a 600 km/h chassis passing through a concrete wall',()=>{
  const {world,car}=fixture();
  try{
    world.createCollider(RAPIER.ColliderDesc.cuboid(9,3,.25).setTranslation(0,3,12));
    car.body.setLinvel({x:0,y:0,z:600/3.6},true);
    for(let i=0;i<30;i++){car.update(EMPTY_INPUT,600);world.step()}
    assert.ok(car.body.translation().z<12,'must remain on the incoming side of the wall');
    assert.ok(car.speed<10,'wall must dissipate forward velocity');
  }finally{world.free()}
});
test('physical accelerator governor holds the configured speed without teleporting velocity',()=>{
  const {world,car}=fixture();
  try{
    for(let i=0;i<1200;i++){car.update({...EMPTY_INPUT,throttle:true},120);world.step()}
    assert.ok(car.signedSpeed*3.6>110);
    assert.ok(car.signedSpeed*3.6<=120);
    car.update({...EMPTY_INPUT,throttle:true},60);world.step();
    assert.ok(car.signedSpeed*3.6>100,'changing the cap must brake progressively');
    for(let i=0;i<600;i++){car.update({...EMPTY_INPUT,throttle:true},60);world.step()}
    assert.ok(car.signedSpeed*3.6<=60);
    for(let i=0;i<1800;i++){car.update({...EMPTY_INPUT,throttle:true},600);world.step()}
    assert.ok(car.signedSpeed*3.6>585,'600 km/h turbo must be attainable with wheel traction');
    assert.ok(car.signedSpeed*3.6<=600);
  }finally{world.free()}
});
test('all 120 physical bumps can be crossed without a fabricated upward impulse',()=>{
  const {world,car}=fixture();
  try{
    const shape=bumpShape();
    for(let i=0;i<120;i++)world.createCollider(RAPIER.ColliderDesc.convexHull(shape.vertices).setTranslation(0,0,110+i*11));
    let maxY=0;
    for(let i=0;i<2400&&car.body.translation().z<1440;i++){
      car.update({...EMPTY_INPUT,throttle:true},600);world.step();maxY=Math.max(maxY,car.body.translation().y);
    }
    assert.ok(car.body.translation().z>=1440,'must cross the complete course');
    assert.ok(Math.abs(car.body.translation().x)<9,'must remain within the lane');
    assert.ok(maxY<3,'must not be launched by a counter-based impulse');
  }finally{world.free()}
});
