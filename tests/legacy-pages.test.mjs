import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {redirectToPublishedGame} from '../src/pages-redirect.mjs';

test('GitHub Pages root loads published compiled game, preserving URL parameters',()=>{
  assert.equal(redirectToPublishedGame('https://nutricionistaalmeidavh-spec.github.io/GameCrash/?v=1#intro'), 'https://nutricionistaalmeidavh-spec.github.io/GameCrash/play/?v=1#intro');
  assert.equal(redirectToPublishedGame('https://nutricionistaalmeidavh-spec.github.io/GameCrash/index.html'), 'https://nutricionistaalmeidavh-spec.github.io/GameCrash/play/');
});
test('never redirects Vite localhost or the already published play path',()=>{
  assert.equal(redirectToPublishedGame('http://127.0.0.1:4173/'),null);
  assert.equal(redirectToPublishedGame('https://nutricionistaalmeidavh-spec.github.io/GameCrash/play/'),null);
  assert.equal(redirectToPublishedGame('https://example.org/GameCrash/'),null);
});
test('legacy Pages workflow publishes Vite artifacts to a visible path and avoids recursive triggering',async()=>{
  const file=await readFile('.github/workflows/publish-legacy-pages.yml','utf8');
  assert.match(file,/branches:\s*\[main\]/);
  assert.match(file,/contents:\s*write/);
  assert.match(file,/paths-ignore:/);
  assert.match(file,/play\/\*\*/);
  assert.match(file,/npm run build/);
  assert.match(file,/cp -a dist\/\. play\//);
  assert.match(file,/git push origin HEAD:main/);
});
