import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cageWeights,sheetOffsets} from '../src/game/skin.ts';
const nodes=[];
for(const z of [-2,-1.2,-.5,.5,1.2,2])for(const y of [0,1])for(const x of [-1,1])nodes.push({rest:{x,y,z},anchor:y===0&&Math.abs(z)<1});
function sample(p,offsets){const w=cageWeights(nodes,p);return w.indices.reduce((sum,n,i)=>sum+offsets[n].x*w.weights[i],0)}
test('sheet weights stay normalized and continuous across cage rings and corners',()=>{
  const offsets=nodes.map(n=>({x:Math.sin(n.rest.z),y:0,z:0}));
  for(const z of [-3,-2,-1.2,-.5,0,.5,1.2,2,3])for(const x of [-2,-1,0,1,2]){
    const w=cageWeights(nodes,{x,y:.6,z});
    assert.equal(w.indices.length,8);assert.ok(w.weights.every(v=>v>=0));
    assert.ok(Math.abs(w.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
    assert.ok(Math.abs(sample({x,y:.6,z:z-1e-7},offsets)-sample({x,y:.6,z:z+1e-7},offsets))<1e-5);
  }
});
test('a ruptured node flying far away cannot create long visual spikes or move cabin anchors',()=>{
  const raw=nodes.map((_,i)=>({x:i===0?1000:0,y:i===0?-1000:0,z:i===0?1000:0}));
  const result=sheetOffsets(nodes,raw,1.05);
  assert.ok(result.every(v=>Object.values(v).every(Number.isFinite)));
  assert.ok(result.every(v=>Math.hypot(v.x,v.y,v.z)<=1.1));
  nodes.forEach((n,i)=>{if(n.anchor)assert.deepEqual(result[i],{x:0,y:0,z:0})});
  assert.deepEqual(sheetOffsets(nodes,raw,1.05),result,'same physical state must produce the same visual pose');
});
