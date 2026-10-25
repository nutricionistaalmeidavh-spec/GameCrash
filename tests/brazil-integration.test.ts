import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {VEHICLES,BRAZIL_SCENERY} from '../src/game/rules.ts';
import {brazilAssetURL} from '../src/brazil/adapter.ts';

test('ten Brazilian cars can be selected alongside the existing four',()=>{
  assert.equal(Object.keys(VEHICLES).length,14);
  for(const id of ['gol','strada','palio','onix','uno','hb20','fiesta','ka','fox','celta']){
    assert.ok(VEHICLES[id as keyof typeof VEHICLES].modelFile?.endsWith(id+'.glb'));
  }
});
test('all three Brazilian landscapes have browser-safe paths',()=>{
  assert.equal(Object.keys(BRAZIL_SCENERY).length,3);
  for(const info of Object.values(BRAZIL_SCENERY)){
    assert.ok(existsSync(resolve('public',info.file)));
  }
  assert.equal(brazilAssetURL('assets/brazil/cars/gol.glb','/GameCrash/'),'/GameCrash/assets/brazil/cars/gol.glb');
  assert.equal(brazilAssetURL('assets/brazil/cars/gol.glb','./'),'/assets/brazil/cars/gol.glb');
});
test('source catalog and downloadable manifest stay identical',()=>{
  assert.deepEqual(JSON.parse(readFileSync('src/brazil/manifest.json','utf8')),JSON.parse(readFileSync('public/assets/brazil/manifest.json','utf8')));
});
