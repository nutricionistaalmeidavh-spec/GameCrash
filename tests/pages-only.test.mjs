import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';

test('one GitHub Pages publisher runs only after browser QA passes',async()=>{
  const workflow=await readFile('.github/workflows/ci.yml','utf8');
  assert.match(workflow,/publish-pages:/);
  assert.match(workflow,/needs:\s*\[unit-and-build,\s*browser-e2e\]/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/cp -a dist\/\. play\//);
  assert.match(workflow,/git push origin HEAD:main/);
  assert.match(workflow,/PAGE_URL: https:\/\/nutricionistaalmeidavh-spec\.github\.io\/GameCrash\/play\//);
  assert.doesNotMatch(workflow,/actions\/deploy-pages|setup-pages|scripts\/pages-source/);
  await assert.rejects(access('.github/workflows/publish-legacy-pages.yml',constants.F_OK),{code:'ENOENT'});
  await assert.rejects(access('.github/workflows/deploy-pages.yml',constants.F_OK),{code:'ENOENT'});
});

test('root GitHub Pages has synchronous redirect to compiled /play/ including query/hash',async()=>{
  const html=await readFile('index.html','utf8');
  assert.match(html,/<script>\s*\(function\(\)/);
  assert.match(html,/location\.replace/);
  assert.match(html,/GameCrash\/play\//);
  assert.doesNotMatch(html,/src\/pages-redirect\.mjs/);
});

test('AppDeploy is not used as repository deploy provider',async()=>{
  const workflow=await readFile('.github/workflows/ci.yml','utf8');
  assert.doesNotMatch(workflow,/appdeploy/i);
  assert.match(workflow,/github\.io\/GameCrash/);
});
