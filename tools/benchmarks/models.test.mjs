// tools/benchmarks/models.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, modelFor } from './models.mjs';

test('MODELS pins the confirmed per-harness model for all three harnesses', () => {
  assert.deepEqual(MODELS, {
    'claude-code': 'claude-opus-4-8',
    'codex': 'gpt-5.6-sol',
    'opencode': 'opencode-go/deepseek-v4-pro',
  });
});

test('claude-code resolves to the DASHED id, never the malformed dotted one', () => {
  assert.equal(modelFor('claude-code'), 'claude-opus-4-8');
  assert.notEqual(modelFor('claude-code'), 'claude-opus-4.8');
});

test('modelFor resolves the pinned model for the codex and opencode harnesses', () => {
  assert.equal(modelFor('codex'), 'gpt-5.6-sol');
  assert.equal(modelFor('opencode'), 'opencode-go/deepseek-v4-pro');
});

test('opencode model keeps its load-bearing opencode-go/ provider prefix', () => {
  assert.match(modelFor('opencode'), /^opencode-go\//);
});

test('modelFor falls back to null for an unmapped harness (driver default applies)', () => {
  assert.equal(modelFor('unknown-harness'), null);
});
