import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveRenderQuality} from '../src/game/quality.ts';

test('iPhone uses a bounded render budget while preserving 120 Hz simulation independence',()=>{
  const quality=new AdaptiveRenderQuality(true);
  const ratio=quality.configure(390,844,3);
  assert.ok(ratio>=1&&ratio<=2);
  assert.ok(390*844*ratio*ratio<=1_350_000);
  assert.equal(quality.shadowMapSize,512);
  assert.equal(quality.deformationInterval,1/30);
});

test('desktop has a larger pixel and shadow budget',()=>{
  const quality=new AdaptiveRenderQuality(false);
  const ratio=quality.configure(1440,900,2);
  assert.ok(ratio>1&&ratio<=2);
  assert.ok(1440*900*ratio*ratio<=2_500_000);
  assert.equal(quality.shadowMapSize,1024);
  assert.equal(quality.deformationInterval,1/60);
});

test('persistent slow frames reduce rendering resolution without affecting physics',()=>{
  const quality=new AdaptiveRenderQuality(true);
  const initial=quality.configure(390,844,3);
  for(let i=0;i<23;i++)assert.equal(quality.observe(30),false);
  assert.equal(quality.observe(30),true);
  assert.ok(quality.pixelRatio<initial);
});

test('quality can recover gradually after sustained smooth frames',()=>{
  const quality=new AdaptiveRenderQuality(true);
  quality.configure(390,844,3);
  for(let i=0;i<48;i++)quality.observe(30);
  const degraded=quality.pixelRatio;
  for(let i=0;i<180;i++)quality.observe(12);
  assert.ok(quality.pixelRatio>degraded);
  assert.ok(quality.pixelRatio<=quality.configure(390,844,3));
});

test('resize and invalid timings do not produce NaN or zero-sized render targets',()=>{
  const quality=new AdaptiveRenderQuality(true);
  quality.configure(0,0,NaN);
  assert.ok(Number.isFinite(quality.pixelRatio)&&quality.pixelRatio>0);
  assert.equal(quality.observe(400),false);
  assert.equal(quality.observe(NaN),false);
  quality.configure(428,926,3);
  assert.ok(quality.pixelRatio>0);
});
