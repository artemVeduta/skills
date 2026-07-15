import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHarnessAvailable, probeHarness, runDriver } from './runner.mjs';

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

test('probeHarness runs the driver-owned probe and captures the version string', () => {
  const fake = { id: 'fake', command: process.execPath, probe: { args: ['--version'] } };
  const r = probeHarness(fake);
  assert.equal(r.ok, true);
  assert.match(r.version, /^v\d+\./); // node --version prints e.g. v22.1.0
});

test('probeHarness is ok:false with a null version for a missing binary', () => {
  const fake = { id: 'fake', command: 'definitely-not-a-real-binary-xyz-42', probe: { args: ['--version'] } };
  assert.deepEqual(probeHarness(fake), { ok: false, version: null });
});

test('runDriver threads model and profileDir into buildInvocation', () => {
  let seen;
  const fake = {
    buildInvocation: (a) => { seen = a; return { command: process.execPath, args: ['-e', ''], env: {} }; },
  };
  runDriver(fake, { fixtureRoot: process.cwd(), prompt: 'x', model: 'm-1', profileDir: '/prof/fake' });
  assert.equal(seen.model, 'm-1');
  assert.equal(seen.profileDir, '/prof/fake');
});
