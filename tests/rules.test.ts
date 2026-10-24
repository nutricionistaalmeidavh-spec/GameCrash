import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLES,SCENARIOS,fictionalImpact,progressFraction,kmh,clamp} from '../src/game/rules.ts';
test('configures three vehicles and three scenarios',()=>{
  assert.deepEqual(Object.keys(VEHICLES).sort(),['hatch','sedan','suv']);
  assert.deepEqual(Object.keys(SCENARIOS).sort(),['blocks','ramp','wall']);
  for (const v of Object.values(VEHICLES)){assert.ok(v.mass>0);assert.ok(v.maxSpeed>0)}
});
test('higher collision speed causes more damage',()=>{
  const low=fictionalImpact(45,VEHICLES.sedan,'wall');
  const high=fictionalImpact(160,VEHICLES.sedan,'wall');
  assert.ok(high.damage>low.damage);
  assert.ok(high.survival<low.survival);
  assert.ok(high.energyKJ>low.energyKJ);
});
test('vehicle resistance changes impact damage',()=>{
  const hatch=fictionalImpact(145,VEHICLES.hatch,'wall');
  const suv=fictionalImpact(145,VEHICLES.suv,'wall');
  assert.ok(hatch.damage>suv.damage);
});
test('all values stay bounded even with extreme inputs',()=>{
  for(const speed of [-100,0,35,130,1000])for(const s of Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>){
    const x=fictionalImpact(speed,VEHICLES.sedan,s);
    assert.ok(x.damage>=0&&x.damage<=100);
    assert.ok(x.survival>=1&&x.survival<=100);
  }
  assert.equal(progressFraction(-1,'wall'),0);
  assert.equal(progressFraction(999,'ramp'),1);
  assert.equal(kmh(-23),0);
  assert.equal(kmh(10),36);
  assert.equal(clamp(4,0,3),3);
});
