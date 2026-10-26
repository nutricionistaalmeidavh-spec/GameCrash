import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS, PHYSICS_STEP, SAMPLE_STEPS, exportBenchmark, summarizeFrames} from '../src/scenarios.mjs';

test('the benchmark has three repeatable scenarios shared by both engines', () => {
  assert.deepEqual(Object.keys(SCENARIOS), ['wall', 'ramp', 'bumps']);
  assert.equal(PHYSICS_STEP, 1 / 120);
  assert.equal(SAMPLE_STEPS, 480);
  for (const s of Object.values(SCENARIOS)) {
    assert.ok(s.initialKmh > 0);
    assert.ok(s.initialDistance > 0);
  }
});

test('metrics summarize measured durations without inventing FPS', () => {
  const result = summarizeFrames([2, 4, 8, 10], 480);
  assert.equal(result.steps, 4);
  assert.equal(result.totalMs, 24);
  assert.equal(result.avgStepMs, 6);
  assert.equal(result.p95StepMs, 10);
  assert.equal(result.simulatedSeconds, 4 / 120);
});

test('JSON benchmark includes reproducibility metadata', () => {
  const report = exportBenchmark('Rapier', 'wall', [1, 2, 3], {damage:0, distance:5});
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.engine, 'Rapier');
  assert.equal(report.scenario, 'wall');
  assert.ok(report.environment.userAgent);
  assert.equal(report.metrics.steps, 3);
  assert.equal(report.observations.distance, 5);
});

test('invalid benchmark durations are rejected', () => {
  assert.throws(() => summarizeFrames([1, -1, 2]), /invalid/i);
  assert.throws(() => summarizeFrames([]), /empty/i);
});
