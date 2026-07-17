// tools/benchmarks/summary.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialPassed, aggregate } from './summary.mjs';

const okAssertions = [{ assertion: { type: 'file-exists' }, pass: true, detail: '' }];

test('trialPassed requires executed + unmodified + non-empty all-passing assertions', () => {
  assert.equal(trialPassed({ status: 'executed', sourcesUnmodified: true, assertions: okAssertions }), true);
  assert.equal(trialPassed({ status: 'skipped', sourcesUnmodified: true, assertions: okAssertions }), false);
  assert.equal(trialPassed({ status: 'executed', sourcesUnmodified: false, assertions: okAssertions }), false);
  assert.equal(trialPassed({ status: 'executed', sourcesUnmodified: true, assertions: [] }), false);
  assert.equal(trialPassed({ status: 'executed', sourcesUnmodified: true, assertions: [{ assertion: {}, pass: false, detail: 'x' }] }), false);
});

test('aggregate builds a single-arm summary with per-harness and overall pass rates', () => {
  const summary = aggregate({
    presetName: 'smoke',
    harnessIds: ['claude-code'],
    skillName: 'okf-docs-setup',
    caseName: 'okf-docs-setup',
    trialCount: 1,
    provenance: { timestamp: '2026-07-16T00:00:00.000Z', commit: 'abc123', dirty: false },
    legs: [{
      trial: 1, id: 'claude-code', status: 'executed',
      model: 'claude-opus-4.8', version: 'claude 1.0',
      sourcesUnmodified: true, assertions: okAssertions,
    }],
  });
  assert.deepEqual(summary.case, { skill: 'okf-docs-setup', name: 'okf-docs-setup' });
  assert.equal(summary.preset, 'smoke');
  assert.equal(summary.trials, 1);
  assert.equal(summary.commit, 'abc123');
  assert.equal(summary.dirty, false);
  assert.equal(summary.harnesses.length, 1);
  assert.equal(summary.harnesses[0].model, 'claude-opus-4.8');
  assert.equal(summary.harnesses[0].version, 'claude 1.0');
  assert.equal(summary.harnesses[0].passRate, 1);
  assert.equal(summary.harnesses[0].trials[0].pass, true);
  assert.equal(summary.overallPassRate, 1);
});

test('aggregate marks a skipped leg not-passing, keeps its model/version, has no without-skill data', () => {
  const summary = aggregate({
    presetName: 'full',
    harnessIds: ['claude-code', 'codex'],
    skillName: 'okf-docs-setup', caseName: 'okf-docs-setup', trialCount: 1,
    provenance: { timestamp: 'T', commit: 'c', dirty: true },
    legs: [
      { trial: 1, id: 'claude-code', status: 'executed', model: 'm1', version: 'v1', sourcesUnmodified: true, assertions: okAssertions },
      { trial: 1, id: 'codex', status: 'skipped', model: 'm2', version: 'v2', sourcesUnmodified: undefined, assertions: undefined },
    ],
  });
  assert.equal(summary.harnesses[1].id, 'codex');
  assert.equal(summary.harnesses[1].model, 'm2');       // from run.json, threaded through even on skip
  assert.equal(summary.harnesses[1].trials[0].pass, false);
  assert.equal(summary.harnesses[1].trials[0].sourcesUnmodified, null);
  assert.equal(summary.overallPassRate, 0.5);
  assert.ok(!('without' in summary) && !('delta' in summary));
});
