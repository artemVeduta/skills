import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runCase, runHarness } from './test-runner.mjs';

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
    const run = await runCase('okf-docs-setup', { dryRun: true, runsRoot, harnessIds: ['claude-code'] });
    assert.equal(run.harnesses.length, 1);
    assert.equal(run.harnesses[0].id, 'claude-code');
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
      buildInvocation: () => ({ command: process.execPath, args: ['-e', 'process.stdout.write("HELLO")'], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't', beforeHash: '', dryRun: false,
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
