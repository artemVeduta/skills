import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from './report.mjs';

const summary = {
  case: { skill: 'docs-setup', name: 'docs-setup' },
  preset: 'smoke', trials: 1,
  timestamp: '2026-07-16T00:00:00.000Z', commit: 'abc123', dirty: false,
  harnesses: [{
    id: 'claude-code', model: 'claude-opus-4.8', version: 'claude 1.0',
    trials: [{ trial: 1, status: 'executed', pass: true, sourcesUnmodified: true }],
    passRate: 1,
  }],
  overallPassRate: 1,
};

test('renderReport is byte-identical across two runs from identical input (AC-3)', () => {
  assert.equal(renderReport(summary), renderReport(summary));
  // AC-3 wording: "from the same committed summary JSON, run twice" — a
  // serialize/parse round trip (the disk write-then-read the flow performs)
  // must not change the rendered bytes.
  const roundTripped = JSON.parse(JSON.stringify(summary));
  assert.equal(renderReport(roundTripped), renderReport(summary));
});

test('renderReport renders the case header, provenance, and per-harness table', () => {
  const md = renderReport(summary);
  assert.match(md, /^# Benchmark report — docs-setup \(smoke\)$/m);
  assert.match(md, /^- Case: docs-setup \/ docs-setup$/m);
  assert.match(md, /^- Preset: smoke \(1 trial\)$/m);
  assert.match(md, /^- Commit: abc123 \(clean\)$/m);
  assert.match(md, /^- Overall pass rate: 100% \(1\/1\)$/m);
  assert.match(md, /\| claude-code \| claude-opus-4\.8 \| claude 1\.0 \| pass \| 100% \(1\/1\) \|/);
});

test('renderReport marks a dirty tree and a failed skipped leg deterministically', () => {
  const dirty = {
    ...summary, dirty: true, overallPassRate: 0,
    harnesses: [{
      id: 'codex', model: 'gpt-5.6-sol', version: 'codex 2.0',
      trials: [{ trial: 1, status: 'skipped', pass: false, sourcesUnmodified: null }],
      passRate: 0,
    }],
  };
  const md = renderReport(dirty);
  assert.match(md, /^- Commit: abc123 \(dirty\)$/m);
  assert.match(md, /\| codex \| gpt-5\.6-sol \| codex 2\.0 \| skipped \| 0% \(0\/1\) \|/);
});
