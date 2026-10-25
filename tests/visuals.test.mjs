import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSurfaceTextures,createAtmosphere,ImpactParticles} from '../src/game/visuals.ts';
import {AdaptiveRenderQuality} from '../src/game/quality.ts';

test('realistic asphalt and roadside material uses repeatable lightweight PBR textures',()=>{
  const surfaces=createSurfaceTextures(600,'high');
  try{
    assert.ok(surfaces.road.map instanceof THREE.DataTexture);
    assert.ok(surfaces.road.roughnessMap instanceof THREE.DataTexture);
    assert.equal(surfaces.road.map.colorSpace,THREE.SRGBColorSpace);
    assert.equal(surfaces.road.map.wrapT,THREE.RepeatWrapping);
    assert.ok(surfaces.road.map.repeat.y>30,'road must be textured across full test track');
    assert.ok(surfaces.road.roughness>.7,'asphalt should be matte');
    assert.ok(surfaces.shoulder.map instanceof THREE.DataTexture);
    assert.ok(surfaces.grass.map instanceof THREE.DataTexture);
    assert.ok(surfaces.road.map.image.data.length<=256*256*4);
  }finally{surfaces.dispose()}
});

test('atmosphere is a single inward-facing sky mesh with no remote assets',()=>{
  const sky=createAtmosphere();
  try{
    assert.ok(sky instanceof THREE.Mesh);
    assert.ok(sky.material instanceof THREE.ShaderMaterial);
    assert.equal(sky.material.side,THREE.BackSide);
    assert.equal(sky.material.depthWrite,false);
  }finally{sky.geometry.dispose();(sky.material).dispose()}
});

test('crash particles do not alter physics and are recycled after impact',()=>{
  const effects=new ImpactParticles(30);
  try{
    assert.equal(effects.mesh.geometry.getAttribute('position').count,30);
    effects.emit({x:0,y:1,z:42},18);
    assert.ok(effects.activeCount>0);
    effects.update(.1);
    assert.ok(effects.activeCount>0);
    effects.update(4);
    assert.equal(effects.activeCount,0);
  }finally{effects.dispose()}
});

test('three selectable presets with dynamic GPU resolution and a bounded mobile ultra mode',()=>{
  const q=new AdaptiveRenderQuality(true);
  q.configure(390,844,3);
  const auto=q.pixelRatio;
  q.setProfile('eco');const eco=q.pixelRatio;
  q.setProfile('high');const high=q.pixelRatio;
  q.setProfile('ultra');const ultra=q.pixelRatio;
  assert.ok(eco<high&&high<=ultra);
  assert.ok(ultra>=auto);
  assert.ok(390*844*ultra*ultra<=2_100_000);
  assert.equal(q.shadowMapSize,1024);
  q.setProfile('auto');
  assert.equal(q.shadowMapSize,512);
});
