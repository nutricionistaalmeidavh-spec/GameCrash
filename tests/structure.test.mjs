import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from '../src/game/driving.ts';
import {VEHICLES} from '../src/game/rules.ts';
import {rotate} from '../src/game/structure.ts';
before(async()=>{await RAPIER.init()});
function fixture(spec=VEHICLES.sedan){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=PHYSICS_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,1000).setTranslation(0,-.025,500));
  const car=new VehicleDynamics(RAPIER,world,spec);
  const run=(seconds,input=EMPTY_INPUT)=>{for(let i=0;i<seconds/PHYSICS_DT;i++){car.update(input,600);world.step()}};
  run(1);
  const launch=(speed,angle=0)=>{
    const q={x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},origin=car.body.translation();
    car.body.setRotation(q,true);
    const velocity={x:0,y:0,z:speed/3.6};
    car.body.setLinvel(velocity,true);
    for(const node of car.structure.nodes)if(!node.anchor){
      const p=rotate(node.rest,q);node.body.setTranslation({x:origin.x+p.x,y:origin.y+p.y,z:origin.z+p.z},true);node.body.setLinvel(velocity,true);
    }
  };
  return {world,car,run,launch};
}
test('structural cage stays undamaged at rest and conserves authored vehicle mass',()=>{
  const {world,car,run}=fixture();try{
    run(3);assert.equal(car.structure.nodes.length,24);assert.equal(car.structure.damage,0);
    assert.equal(car.structure.brokenBeams,0);assert.equal(car.structure.plasticWorkJ,0);
    assert.ok(Math.abs(car.structure.totalMass-VEHICLES.sedan.mass)<.1);
  }finally{world.free()}
});
function crash(speed,angle=0,poleX){
  const f=fixture();
  f.world.createCollider(RAPIER.ColliderDesc.cuboid(poleX===undefined?6:.25,3,.5).setTranslation(poleX??0,3,15));
  f.launch(speed,angle);f.run(4);return f;
}
test('real impacts produce irreversible plastic work and stronger impacts crush the cage more',()=>{
  const gentle=crash(10),medium=crash(50),hard=crash(100);
  try{
    assert.equal(gentle.car.structure.plasticWorkJ,0);
    assert.ok(medium.car.structure.plasticWorkJ>1000);
    assert.ok(hard.car.structure.damage>medium.car.structure.damage+15);
    const front=hard.car.structure.nodes.filter(n=>n.rest.z>1.8);
    const before=front.reduce((sum,n)=>sum+hard.car.structure.localPosition(n).z,0)/front.length;
    hard.run(2);
    const after=front.reduce((sum,n)=>sum+hard.car.structure.localPosition(n).z,0)/front.length;
    assert.ok(before<1.8,'front collision nodes must physically move inward');
    assert.ok(after<1.8,'deformation must remain after unloading');
  }finally{gentle.world.free();medium.world.free();hard.world.free()}
});
test('front and rear damage follow the impacted side instead of a fixed front-only dent',()=>{
  const front=crash(80),rear=crash(80,Math.PI);
  try{
    assert.ok(front.car.structure.damageAt({x:0,y:0,z:2})>front.car.structure.damageAt({x:0,y:0,z:-2}));
    assert.ok(rear.car.structure.damageAt({x:0,y:0,z:-2})>rear.car.structure.damageAt({x:0,y:0,z:2}));
  }finally{front.world.free();rear.world.free()}
});
test('a pole hit damages the nearby suspension more than the opposite wheel',()=>{
  const {world,car}=crash(100,0,-.82);
  try{
    assert.ok(car.wheelHealth[1]<car.wheelHealth[3]-.05,JSON.stringify(car.wheelHealth));
    assert.ok(car.controller.wheelFrictionSlip(1)<car.controller.wheelFrictionSlip(3));
  }finally{world.free()}
});
test('a narrow central pole hits the structural skin between corner nodes',()=>{
  const {world,car}=crash(80,0,0);
  try{assert.ok(car.structure.plasticWorkJ>1000);assert.ok(car.structure.damage>10)}finally{world.free()}
});
test('600 km/h impacts stay finite and broken joints remain bounded',()=>{
  const {world,car,run}=crash(600);
  try{
    run(2);assert.ok(car.structure.brokenBeams>0);
    assert.ok(car.structure.brokenBeams<=car.structure.beams.length);
    assert.ok(car.structure.fragments.length<=7);
    for(const node of car.structure.nodes){const p=car.structure.worldPosition(node);assert.ok(Number.isFinite(p.x+p.y+p.z));assert.ok(Math.hypot(p.x,p.y,p.z)<10000)}
    assert.ok(Math.abs(car.structure.totalMass-VEHICLES.sedan.mass)<.1,'detaching wheels must not create mass');
  }finally{world.free()}
});


test('Concept impact releases authored panels and glass without creating vehicle mass',()=>{
  const {world,car,launch,run}=fixture(VEHICLES.concept);
  try{
    world.createCollider(RAPIER.ColliderDesc.cuboid(6,3,.5).setTranslation(0,3,15));
    launch(180);run(5);
    const ids=car.structure.fragments.map(f=>f.id);
    assert.ok(ids.includes('hood'));
    assert.ok(ids.includes('front-bumper'));
    assert.ok(ids.some(id=>id.startsWith('glass-')));
    assert.ok(ids.length<=13);
    assert.ok(Math.abs(car.structure.totalMass-VEHICLES.concept.mass)<.1);
  }finally{world.free()}
});


test('local side intrusion can release an authored Concept door',()=>{
  const {world,car}=fixture(VEHICLES.concept);
  try{
    // A side impact injects momentum into the left outer nodal masses.
    let peak=0;
    for(let i=0;i<3/PHYSICS_DT;i++){
      if(i<36)for(const node of car.structure.nodes)if(!node.anchor&&node.rest.x<0&&Math.abs(node.rest.z)<1.6)node.body.applyImpulse({x:node.body.mass()*20,y:0,z:0},true);
      car.structure.update(PHYSICS_DT);world.step();
      peak=Math.max(peak,car.structure.damageAt({x:-1.05,y:0,z:.08}));
    }
    assert.ok(car.structure.fragments.some(f=>f.id==='door-left'),JSON.stringify({ids:car.structure.fragments.map(f=>f.id),peak,work:car.structure.plasticWorkJ,broken:car.structure.brokenBeams}));
    assert.ok(Math.abs(car.structure.totalMass-VEHICLES.concept.mass)<.1);
  }finally{world.free()}
});
