import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runCase, runHarness, parseArgs } from './test-runner.mjs';

const CLI = fileURLToPath(new URL('./test-runner.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('runCase --dry-run builds an out-of-repo fixture per harness and leaves sources unmodified', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', { dryRun: true, runsRoot });
    assert.equal(run.harnesses.length, 3);
    for (const h of run.harnesses) {
      assert.equal(h.status, 'dry-run');
      assert.ok(h.closure.includes('okf-docs-setup')); // closure includes the skill itself
      assert.equal(h.sourcesUnmodified, true);
      const s = await stat(h.fixtureRoot);
      assert.ok(s.isDirectory());
      assert.ok(!h.fixtureRoot.startsWith(REPO_ROOT), 'fixture must live outside the repo tree');
      await rm(h.fixtureRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('the harness fixture lives outside the repo tree (no ancestor memory/skills leak)', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', { dryRun: true, runsRoot });
    for (const h of run.harnesses) {
      // cwd is not under the repo, so the cwd-upward walk can never reach this
      // repo's CLAUDE.md / AGENTS.md / .claude/skills (docs-add, docs-validate).
      assert.ok(!h.fixtureRoot.startsWith(REPO_ROOT));
      await rm(h.fixtureRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('runCase --dry-run --harness selects a single harness', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', {
      dryRun: true, runsRoot, harnessSelections: [{ id: 'claude-code', model: null }],
    });
    assert.equal(run.harnesses.length, 1);
    assert.equal(run.harnesses[0].id, 'claude-code');
    assert.equal(run.harnesses[0].model, 'claude-opus-4.8'); // = the claude-code defaultModel pinned in drivers.mjs (Task 5) — keep in sync if that pin changed
    await rm(run.harnesses[0].fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('runHarness runs a fake driver (no inference) and returns an executed, out-of-repo result', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = { inputs: [], prompt: 'x', assertions: [{ type: 'output-contains', value: 'HELLO' }] };
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: ['-e', 'process.stdout.write("HELLO")'], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.status, 'executed');
    assert.ok(!r.fixtureRoot.startsWith(REPO_ROOT));
    assert.equal(r.assertions[0].pass, true);
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('CLI dry-run exits 0 and prints a report', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const r = spawnSync(process.execPath, [CLI, 'okf-docs-setup', '--dry-run', '--runs', runsRoot], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /test-runner — case: okf-docs-setup \(dry run\)/);
    assert.match(r.stdout, /claude-code/);
    assert.match(r.stdout, /codex/);
    assert.match(r.stdout, /opencode/);
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('CLI exits 2 with usage when no skill is given', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test('CLI exits 2 when --harness has no value', () => {
  const r = spawnSync(process.execPath, [CLI, 'okf-docs-setup', '--harness'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test('parseArgs accepts repeatable --harness with optional =model', () => {
  const { opts } = parseArgs(['okf-docs-setup', '--harness', 'claude-code=claude-haiku-4-5', '--harness', 'codex']);
  assert.deepEqual(opts.harnessSelections, [
    { id: 'claude-code', model: 'claude-haiku-4-5' },
    { id: 'codex', model: null },
  ]);
});

test('parseArgs leaves harnessSelections undefined when --harness is absent (default = all)', () => {
  const { opts } = parseArgs(['okf-docs-setup']);
  assert.equal(opts.harnessSelections, undefined);
});

test('parseArgs rejects duplicate harness ids', () => {
  assert.throws(
    () => parseArgs(['x', '--harness', 'codex=m1', '--harness', 'codex=m2']),
    /duplicate --harness codex/,
  );
});

test('parseArgs rejects an empty model after =', () => {
  assert.throws(() => parseArgs(['x', '--harness', 'codex=']), /--harness <id>\[=<model>\]/);
});

test('CLI exits 2 on duplicate --harness ids', () => {
  const r = spawnSync(process.execPath, [CLI, 'okf-docs-setup', '--harness', 'codex', '--harness', 'codex'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /duplicate --harness codex/);
});

test('runHarness resolves the model, threads preflight version, and writes run.json', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = { inputs: [], prompt: 'x', assertions: [{ type: 'output-contains', value: 'HELLO' }] };
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: ['-e', 'process.stdout.write("HELLO")'], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.status, 'executed');
    assert.equal(r.model, 'fake-model-1'); // defaultModel used when no override given
    assert.equal(r.harnessVersion, 'fake 9.9');
    const record = JSON.parse(await readFile(join(runsRoot, 't', 'fake', 'run.json'), 'utf8'));
    assert.equal(record.status, 'executed');
    assert.equal(record.model, 'fake-model-1');
    assert.equal(record.harnessVersion, 'fake 9.9');
    assert.equal(record.invocation.command, process.execPath);
    assert.equal(record.exitStatus, 0);
    assert.equal(record.timedOut, false);
    assert.equal(record.skipReason, null);
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('a failing preflight yields a skipped leg whose run.json carries the reason', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = { inputs: [], prompt: 'x', assertions: [] };
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: [], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't2', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: 'no test profile — run `npm run test:auth -- fake`', version: '9.9' }),
    });
    assert.equal(r.status, 'skipped');
    assert.equal(r.skipReason, 'no test profile — run `npm run test:auth -- fake`');
    const record = JSON.parse(await readFile(join(runsRoot, 't2', 'fake', 'run.json'), 'utf8'));
    assert.equal(record.status, 'skipped');
    assert.equal(record.skipReason, 'no test profile — run `npm run test:auth -- fake`');
    assert.equal(record.exitStatus, null);
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});
