import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const base = new URL('../public/assets/brazil/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));

test('catálogo cobre 10 carros e 3 cenários', () => {
  assert.equal(Object.keys(manifest.cars).length, 10);
  assert.deepEqual(Object.keys(manifest.maps).sort(), [
    'brasilia-eixo-monumental', 'imigrantes', 'serra-do-rio-do-rastro'
  ]);
  assert.equal(manifest.vehicleForward, '-Z');
  assert.equal(manifest.units, 'meters');
});

async function glb(path) {
  const buf = await readFile(new URL('../public/'+path, import.meta.url));
  assert.ok(buf.length > 1000, `GLB incompleto: ${path}`);
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  assert.equal(buf.readUInt32LE(4), 2);
  assert.equal(buf.readUInt32LE(8), buf.length);
  const len = buf.readUInt32LE(12);
  assert.equal(buf.toString('ascii', 16, 20), 'JSON');
  const model = JSON.parse(buf.toString('utf8', 20, 20 + len).trim());
  assert.equal(model.asset.version, '2.0');
  assert.ok(model.scenes[0].nodes.length > 10);
  assert.ok(model.meshes.length > 2);
  assert.ok(model.materials.length > 2);
  assert.ok(model.nodes.every(n => n.mesh === undefined || n.mesh < model.meshes.length));
  assert.ok(model.bufferViews.every(v => v.byteOffset % 4 === 0));
  const offset = 20 + len;
  assert.deepEqual([...buf.subarray(offset + 4, offset + 8)], [66, 73, 78, 0]);
  assert.ok(model.buffers[0].byteLength <= buf.readUInt32LE(offset));
  return model;
}

test('todos os 10 GLBs de veículos são válidos', async () => {
  for (const [id, car] of Object.entries(manifest.cars)) {
    assert.ok(car.massKg > 600 && car.massKg < 2300, id);
    assert.ok(car.collider.halfExtents.every(v => v > 0), id);
    const model = await glb(car.file);
    assert.ok(model.nodes.some(n => n.name.startsWith('body_')), id);
    assert.ok(model.nodes.filter(n => n.name.startsWith('wheel_tire_')).length === 4, id);
  }
});

test('os cenários possuem pistas, spawn, rota e obstáculos', async () => {
  for (const [id, map] of Object.entries(manifest.maps)) {
    assert.equal(map.spawn.position.length, 3, id);
    assert.ok(map.route.length >= 15, id);
    assert.ok(map.obstacles.length > 0, id);
    assert.equal(map.geographicallyExact, false);
    const model = await glb(map.file);
    assert.ok(model.nodes.some(n => n.name.startsWith('COLLIDER_road')), id);
    assert.ok(model.nodes.some(n => n.name.startsWith('COLLIDER_barrier') || n.name.startsWith('COLLIDER_obstacle') || n.name.startsWith('COLLIDER_ramp')), id);
  }
});
