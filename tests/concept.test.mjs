import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {VEHICLES} from '../src/game/rules.ts';
import {wheelLayout} from '../src/game/driving.ts';

test('Concept is self-contained, optimized, licensed and has four independent wheel assemblies',()=>{
  const file=readFileSync('public/assets/concept/car.glb');
  const json=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
  assert.ok(file.length<5*1024*1024,'mobile download budget');
  assert.equal(json.buffers.length,1);
  assert.ok(!json.buffers[0].uri);
  assert.ok(json.images.every(image=>image.bufferView!==undefined&&!image.uri));
  for(let i=0;i<4;i++){
    const node=json.nodes.find(n=>n.name==='concept-wheel-'+i);
    assert.ok(node?.children?.length>=3,'rim, tire and brakes kept together');
  }
  assert.ok(json.nodes.some(n=>n.name==='BodyHood'));
  assert.ok(json.nodes.some(n=>n.name==='InteriorSeatsColor1'));
  const metadata=JSON.parse(readFileSync('src/game/concept.json','utf8'));
  assert.ok(metadata.triangles<110000);
  assert.ok(statSync('public/assets/concept/LICENSE.md').size>0);
  assert.match(readFileSync('public/assets/concept/CREDITS.html','utf8'),/Eric Chadwick/);
  assert.equal(metadata.parts.length,9);
  assert.deepEqual(metadata.parts.map(p=>p.id).sort(),['hood','door-left','door-right','front-bumper','rear-bumper','glass-front','glass-rear','glass-left','glass-right'].sort());
  for(const part of metadata.parts){assert.ok(part.mass>0);assert.ok(part.half.every(v=>v>0));assert.ok(json.nodes.some(n=>n.extras?.crashPart===part.id));}
  assert.ok(json.nodes.filter(n=>n.extras?.sheetThicknessM===.006).length>=10);
  assert.equal(json.nodes.filter(n=>n.name?.startsWith('BodyWheelwell')).length,4);
  assert.ok(metadata.wheelTrack>2&&metadata.wheelTrack<2.3);
  assert.ok(metadata.wheelRadius>.4&&metadata.wheelRadius<.45);
  const layout=wheelLayout(VEHICLES.concept);
  assert.equal(layout.radius,metadata.wheelRadius);
  assert.equal(layout.halfTrack,metadata.wheelTrack/2);
  assert.equal(layout.axleZ,metadata.wheelbase/2);
});
