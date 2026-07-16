// tools/benchmarks/presets.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, resolvePreset } from './presets.mjs';

test('smoke preset is claude-code only, 1 trial', () => {
  assert.deepEqual(resolvePreset('smoke'), { harnesses: ['claude-code'], trials: 1 });
});

test('full preset is all three harnesses, 1 trial (rescoped from 5)', () => {
  assert.deepEqual(resolvePreset('full'), {
    harnesses: ['claude-code', 'codex', 'opencode'], trials: 1,
  });
});

test('PRESETS is the single source: smoke and full are the only names', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), ['full', 'smoke']);
});

test('resolvePreset rejects an unknown preset name', () => {
  assert.throws(() => resolvePreset('turbo'), /unknown preset: turbo/);
});
