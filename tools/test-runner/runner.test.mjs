import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHarnessAvailable, runDriver } from './runner.mjs';

test('isHarnessAvailable is true for a binary that answers --version', () => {
  // `node --version` always exits 0.
  assert.equal(isHarnessAvailable(process.execPath), true);
});

test('isHarnessAvailable is false for a non-existent binary', () => {
  assert.equal(isHarnessAvailable('definitely-not-a-real-binary-xyz-42'), false);
});

test('runDriver enforces a finite timeout and reports it (no inference)', () => {
  const sleeper = {
    buildInvocation: () => ({ command: process.execPath, args: ['-e', 'setTimeout(() => {}, 60000)'], env: {} }),
  };
  const r = runDriver(sleeper, { fixtureRoot: process.cwd(), prompt: 'x', timeoutMs: 200 });
  assert.equal(r.status, null);
  assert.equal(r.timedOut, true);
});
