import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHarnessAvailable, preflightHarness, probeHarness, runDriver } from './runner.mjs';

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

const LADDER_DEPS_ALL_GREEN = {
  probe: () => ({ ok: true, version: '9.9.9' }),
  isDirectory: async () => true,
  fileExists: async () => true,
  listProcesses: () => [],
};

test('preflight rung 1: missing binary yields the actionable install skip', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, probe: () => ({ ok: false, version: null }),
  });
  assert.deepEqual(r, {
    skipReason: 'harness binary `codex` not found — install `codex` or fix PATH',
    version: null,
  });
});

test('preflight rung 2: missing profile dir points at test:auth', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, isDirectory: async () => false,
  });
  assert.equal(r.skipReason, 'no test profile — run `npm run test:auth -- codex`');
  assert.equal(r.version, '9.9.9');
});

test('preflight rung 3: profile without auth material points at test:auth', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  let checked;
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, fileExists: async (p) => { checked = p; return false; },
  });
  assert.equal(r.skipReason, 'profile exists but is not authenticated — run `npm run test:auth -- codex`');
  assert.equal(checked, '/prof/codex/auth.json'); // the ladder checks authMaterialPath
});

test('preflight rung 4: a user-owned opencode process skips the leg', async () => {
  const d = { id: 'opencode', command: 'opencode', probe: { args: ['--version'] }, daemonBasename: 'opencode' };
  const r = await preflightHarness(d, '/prof/opencode', {
    ...LADDER_DEPS_ALL_GREEN, listProcesses: () => ['zsh', 'opencode', 'node'],
  });
  assert.equal(r.skipReason, 'kill the running opencode server first — `run` may attach to it and escape the fixture');
});

test('preflight rung 4 is skipped entirely for drivers without a daemonBasename', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, listProcesses: () => ['opencode'], // running daemon is irrelevant to codex
  });
  assert.deepEqual(r, { skipReason: null, version: '9.9.9' });
});

test('preflight passes all rungs and hands back the probe version for provenance', async () => {
  const d = { id: 'opencode', command: 'opencode', probe: { args: ['--version'] }, daemonBasename: 'opencode' };
  const r = await preflightHarness(d, '/prof/opencode', LADDER_DEPS_ALL_GREEN);
  assert.deepEqual(r, { skipReason: null, version: '9.9.9' });
});
