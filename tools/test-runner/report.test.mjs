import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRunReport, exitCodeFor } from './report.mjs';

const passing = {
  skill: 'okf-docs-setup',
  runId: '1',
  harnesses: [{
    id: 'claude-code', status: 'executed', sourcesUnmodified: true, exitStatus: 0, harnessError: null, timedOut: false,
    model: 'claude-opus-4.8', harnessVersion: '2.1.209 (Claude Code)',
    assertions: [{ pass: true, detail: '' }],
  }],
};
const failing = {
  skill: 'okf-docs-setup',
  runId: '1',
  harnesses: [{
    id: 'claude-code', status: 'executed', sourcesUnmodified: true, exitStatus: 0, harnessError: null, timedOut: false,
    model: 'claude-opus-4.8', harnessVersion: '2.1.209 (Claude Code)',
    assertions: [{ pass: false, detail: 'missing docs/index.md' }],
  }],
};

test('exitCodeFor is 0 when every executed assertion passes', () => {
  assert.equal(exitCodeFor(passing), 0);
});

test('exitCodeFor is 1 when any executed assertion fails', () => {
  assert.equal(exitCodeFor(failing), 1);
});

test('exitCodeFor is 1 when sources were mutated', () => {
  const mutated = { ...passing, harnesses: [{ ...passing.harnesses[0], sourcesUnmodified: false }] };
  assert.equal(exitCodeFor(mutated), 1);
});

test('exitCodeFor is 1 when an executed harness has no assertions (never vacuous PASS)', () => {
  const empty = { ...passing, harnesses: [{ ...passing.harnesses[0], assertions: [] }] };
  assert.equal(exitCodeFor(empty), 1);
  assert.match(formatRunReport(empty), /claude-code: FAIL/);
});

test('exitCodeFor is 1 when no harness executed (all skipped)', () => {
  const allSkipped = { skill: 'x', runId: '1', harnesses: [{ id: 'codex', status: 'skipped', skipReason: 'not installed', fixtureRoot: '/tmp/fx' }] };
  assert.equal(exitCodeFor(allSkipped), 1);
});

test('exitCodeFor for a dry run is 0 when sources are unmodified', () => {
  const dry = {
    skill: 'x', runId: '1', dryRun: true,
    harnesses: [{
      id: 'codex', status: 'dry-run', closure: ['x'],
      invocation: { command: 'codex', args: ['exec', 'x'], env: { CODEX_HOME: '/p/codex' } },
      sourcesUnmodified: true, fixtureRoot: '/tmp/fx',
    }],
  };
  assert.equal(exitCodeFor(dry), 0);
});

test('formatRunReport surfaces failing assertion details', () => {
  const out = formatRunReport(failing);
  assert.match(out, /claude-code: FAIL/);
  assert.match(out, /missing docs\/index\.md/);
});

test('formatRunReport flags an abnormal harness exit distinctly from a content FAIL', () => {
  const timedOut = {
    skill: 'x', runId: '1',
    harnesses: [{
      id: 'codex', status: 'executed', sourcesUnmodified: true, exitStatus: null, harnessError: 'timed out', timedOut: true,
      model: 'gpt-5.6-sol', harnessVersion: 'codex-cli 0.139.0',
      assertions: [{ pass: false, detail: 'missing x' }],
    }],
  };
  assert.match(formatRunReport(timedOut), /harness exited abnormally/);
});

test('formatRunReport marks skipped harnesses', () => {
  const skipped = { skill: 'x', runId: '1', harnesses: [{ id: 'codex', status: 'skipped', skipReason: 'codex CLI not installed', fixtureRoot: '/tmp/fx' }] };
  assert.match(formatRunReport(skipped), /codex: SKIPPED \(codex CLI not installed\)/);
});

test('formatRunReport prints a provenance line per executed harness', () => {
  const out = formatRunReport(passing);
  assert.match(out, /provenance: model claude-opus-4.8, harness 2\.1\.209 \(Claude Code\)/);
});

test('formatRunReport shows the dry-run args and profile env', () => {
  const dry = {
    skill: 'x', runId: '1', dryRun: true,
    harnesses: [{
      id: 'codex', status: 'dry-run', closure: ['x'], sourcesUnmodified: true, fixtureRoot: '/tmp/fx',
      invocation: { command: 'codex', args: ['exec', '-m', 'gpt-5.6-sol', 'p'.repeat(200)], env: { CODEX_HOME: '/p/codex' } },
    }],
  };
  const out = formatRunReport(dry);
  assert.match(out, /would run `codex exec -m gpt-5\.6-sol p{77}\.\.\.`/); // long args truncated
  assert.match(out, /env CODEX_HOME=\/p\/codex/);
});
