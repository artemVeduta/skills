import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
    const run = await runCase('docs-setup', { dryRun: true, runsRoot });
    assert.equal(run.harnesses.length, 3);
    for (const h of run.harnesses) {
      assert.equal(h.status, 'dry-run');
      assert.ok(h.closure.includes('docs-setup')); // closure includes the skill itself
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
    const run = await runCase('docs-setup', { dryRun: true, runsRoot });
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
    const run = await runCase('docs-setup', {
      dryRun: true, runsRoot, harnessSelections: [{ id: 'claude-code', model: null }],
    });
    assert.equal(run.harnesses.length, 1);
    assert.equal(run.harnesses[0].id, 'claude-code');
    assert.equal(run.harnesses[0].model, 'claude-opus-4-8'); // = the claude-code defaultModel pinned in drivers.mjs (Task 5) — keep in sync if that pin changed
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
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
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
    const r = spawnSync(process.execPath, [CLI, 'docs-setup', '--dry-run', '--runs', runsRoot], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /test-runner — case: docs-setup \(dry run\)/);
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
  const r = spawnSync(process.execPath, [CLI, 'docs-setup', '--harness'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test('parseArgs accepts repeatable --harness with optional =model', () => {
  const { opts } = parseArgs(['docs-setup', '--harness', 'claude-code=claude-haiku-4-5', '--harness', 'codex']);
  assert.deepEqual(opts.harnessSelections, [
    { id: 'claude-code', model: 'claude-haiku-4-5' },
    { id: 'codex', model: null },
  ]);
});

test('parseArgs leaves harnessSelections undefined when --harness is absent (default = all)', () => {
  const { opts } = parseArgs(['docs-setup']);
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
  const r = spawnSync(process.execPath, [CLI, 'docs-setup', '--harness', 'codex', '--harness', 'codex'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /duplicate --harness codex/);
});

// --- v2 acceptance seam: plan/approval turns ---
// A fake driver whose turn 1 proposes a plan and pauses, and whose resume turn
// reacts to the follow-up prompt — real spawns of node, no inference.

function gatedFakeDriver({ applyOnResume }) {
  return {
    id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
    defaultModel: 'fake-model-1', probe: { args: ['--version'] },
    buildInvocation: () => ({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("PROPOSED-PLAN: create out.md — awaiting approval")'],
      env: {},
    }),
    buildResumeInvocation: ({ prompt }) => ({
      command: process.execPath,
      args: ['-e', applyOnResume
        ? `require('fs').writeFileSync('out.md', 'applied'); process.stdout.write('RESUMED: ' + ${JSON.stringify(prompt)})`
        : `process.stdout.write('RESUMED: ' + ${JSON.stringify(prompt)})`],
      env: {},
    }),
  };
}

test('runHarness pauses after the plan turn and resumes with the follow-up prompt', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = {
      inputs: [], prompt: 'propose a plan and wait',
      followUpPrompts: ['approved — apply the plan'],
      assertions: [
        { type: 'output-contains', value: 'PROPOSED-PLAN' },
        { type: 'output-contains', value: 'RESUMED: approved — apply the plan' },
        { type: 'file-exists', path: 'out.md' },
      ],
    };
    const r = await runHarness(gatedFakeDriver({ applyOnResume: true }), {
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 'turns', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.status, 'executed');
    assert.deepEqual(r.assertions.map((a) => a.pass), [true, true, true]);
    // Per-turn transcripts: turn 1 keeps the v1 name; later turns are numbered.
    const t1 = await readFile(join(runsRoot, 'turns', 'fake', 'transcript.json'), 'utf8');
    assert.match(t1, /PROPOSED-PLAN/);
    const t2 = await readFile(join(runsRoot, 'turns', 'fake', 'transcript-2.json'), 'utf8');
    assert.match(t2, /RESUMED/);
    const record = JSON.parse(await readFile(join(runsRoot, 'turns', 'fake', 'run.json'), 'utf8'));
    assert.equal(record.turnCount, 2);
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('a denied approval leaves the fixture working tree and Git state at the baseline', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = {
      inputs: [{ path: 'docs/index.md', content: '# existing\n' }],
      prompt: 'propose a plan and wait',
      followUpPrompts: ['denied — do not apply'],
      assertions: [
        { type: 'output-contains', value: 'RESUMED: denied — do not apply' },
        { type: 'file-absent', path: 'out.md' },
        { type: 'git-unchanged' },
      ],
    };
    const r = await runHarness(gatedFakeDriver({ applyOnResume: false }), {
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 'deny', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.status, 'executed');
    assert.deepEqual(r.assertions.map((a) => a.pass), [true, true, true],
      r.assertions.map((a) => a.detail).join(' | '));
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('git-unchanged catches a harness that mutates the fixture despite a denial', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = {
      inputs: [], prompt: 'propose a plan and wait',
      followUpPrompts: ['denied — do not apply'],
      assertions: [{ type: 'git-unchanged' }],
    };
    // Misbehaving harness: applies the plan anyway.
    const r = await runHarness(gatedFakeDriver({ applyOnResume: true }), {
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 'deny-bad', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.assertions[0].pass, false);
    assert.match(r.assertions[0].detail, /out\.md/);
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('follow-up turns against a driver without buildResumeInvocation are a configuration error', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: ['-e', ''], env: {} }),
    };
    const args = (dryRun, runId) => ({
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase: { inputs: [], prompt: 'x', followUpPrompts: ['approve'], assertions: [] },
      runsRoot, runId, beforeHash: '', dryRun,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    await assert.rejects(runHarness(fake, args(false, 'no-resume')), /buildResumeInvocation/);
    // Dry-run must surface the same configuration error — a misconfigured
    // gated case must not preview green and only fail when turns run live.
    await assert.rejects(runHarness(fake, args(true, 'no-resume-dry')), /buildResumeInvocation/);
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('a dry run of a gated case records the resume invocation for every follow-up turn', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const r = await runHarness(gatedFakeDriver({ applyOnResume: false }), {
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase: {
        inputs: [], prompt: 'propose a plan and wait',
        followUpPrompts: ['approved — apply the plan', 'and confirm'],
        assertions: [],
      },
      runsRoot, runId: 'dry-turns', beforeHash: '', dryRun: true,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.status, 'dry-run');
    // The FULL exchange is previewed: one resume invocation per follow-up,
    // each carrying its own prompt.
    assert.equal(r.resumeInvocations.length, 2);
    assert.ok(r.resumeInvocations[0].args.join(' ').includes('approved — apply the plan'));
    assert.ok(r.resumeInvocations[1].args.join(' ').includes('and confirm'));
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('a timed-out turn stops the sequence — later turns never run', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  const prev = process.env.TEST_RUNNER_TIMEOUT_MS;
  process.env.TEST_RUNNER_TIMEOUT_MS = '300';
  try {
    let resumed = false;
    const hanging = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: ['-e', 'setTimeout(() => {}, 60000)'], env: {} }),
      buildResumeInvocation: () => { resumed = true; return { command: process.execPath, args: ['-e', ''], env: {} }; },
    };
    const r = await runHarness(hanging, {
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase: { inputs: [], prompt: 'x', followUpPrompts: ['approve'], assertions: [] },
      runsRoot, runId: 'hang', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.timedOut, true);
    assert.equal(resumed, false, 'the resume turn must not run after a timeout');
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    if (prev === undefined) delete process.env.TEST_RUNNER_TIMEOUT_MS;
    else process.env.TEST_RUNNER_TIMEOUT_MS = prev;
    await rm(runsRoot, { recursive: true, force: true });
  }
});

// --- v2 acceptance seam: cross-harness outcome comparison ---

function writerFakeDriver(id, content) {
  return {
    id, command: process.execPath, discoverySubdir: '.claude/skills',
    defaultModel: 'fake-model-1', probe: { args: ['--version'] },
    buildInvocation: () => ({
      command: process.execPath,
      args: ['-e', `require('fs').writeFileSync('docs-out.md', ${JSON.stringify(content)})`],
      env: {},
    }),
  };
}

test('runCase compares declared outcome paths across executed harnesses', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  const casesRoot = await mkdtemp(join(tmpdir(), 'tr-cases-'));
  try {
    const caseDir = join(casesRoot, 'docs-setup');
    await mkdir(caseDir, { recursive: true });
    await writeFile(join(caseDir, 'case.mjs'),
      'export default { assertions: [{ type: "file-exists", path: "docs-out.md" }], compare: { paths: ["docs-out.md"] } };\n');
    await writeFile(join(caseDir, 'prompt.md'), 'write docs-out.md\n');

    const equalDrivers = new Map([
      ['fake-a', writerFakeDriver('fake-a', 'same\n')],
      ['fake-b', writerFakeDriver('fake-b', 'same\n')],
    ]);
    const equalRun = await runCase('docs-setup', {
      runsRoot, casesRoot, runId: 'cmp-equal',
      harnessSelections: [{ id: 'fake-a', model: null }, { id: 'fake-b', model: null }],
      resolveDriverFn: (id) => equalDrivers.get(id) ?? null,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(equalRun.comparisons.length, 1);
    assert.deepEqual(
      equalRun.comparisons[0],
      { path: 'docs-out.md', status: 'compared', pass: true, detail: '' },
    );

    const divergentDrivers = new Map([
      ['fake-a', writerFakeDriver('fake-a', 'one\n')],
      ['fake-b', writerFakeDriver('fake-b', 'two\n')],
    ]);
    const divergentRun = await runCase('docs-setup', {
      runsRoot, casesRoot, runId: 'cmp-div',
      harnessSelections: [{ id: 'fake-a', model: null }, { id: 'fake-b', model: null }],
      resolveDriverFn: (id) => divergentDrivers.get(id) ?? null,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(divergentRun.comparisons[0].pass, false);
    assert.match(divergentRun.comparisons[0].detail, /fake-a/);

    // The gating verdict is persisted alongside the per-leg records, so a
    // divergence stays attributable after the run (comparisons.json).
    const persisted = JSON.parse(await readFile(join(runsRoot, 'cmp-div', 'comparisons.json'), 'utf8'));
    assert.deepEqual(persisted, divergentRun.comparisons);
    for (const h of [...equalRun.harnesses, ...divergentRun.harnesses]) {
      await rm(h.fixtureRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
    await rm(casesRoot, { recursive: true, force: true });
  }
});

test('a case without a compare declaration produces no comparisons (v1 behavior intact)', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('docs-setup', { dryRun: true, runsRoot });
    assert.deepEqual(run.comparisons, []);
    for (const h of run.harnesses) await rm(h.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('a case projects the skill its manifest declares, not the case-directory name', async () => {
  // Sibling case variants (e.g. docs-add + docs-add-approve) share one skill:
  // the case directory names the case, the manifest `skill` names the skill to
  // project into the fixture.
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  const casesRoot = await mkdtemp(join(tmpdir(), 'tr-cases-'));
  try {
    const caseDir = join(casesRoot, 'alias-dir');
    await mkdir(caseDir, { recursive: true });
    await writeFile(join(caseDir, 'case.mjs'), 'export default { skill: "docs-setup", assertions: [] };\n');
    await writeFile(join(caseDir, 'prompt.md'), 'do a thing\n');
    const run = await runCase('alias-dir', {
      dryRun: true, runsRoot, casesRoot,
      harnessSelections: [{ id: 'claude-code', model: null }],
    });
    assert.equal(run.skill, 'alias-dir'); // label stays the case-directory name
    assert.ok(run.harnesses[0].closure.includes('docs-setup'), 'projected the manifest-declared skill');
    for (const h of run.harnesses) await rm(h.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
    await rm(casesRoot, { recursive: true, force: true });
  }
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
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
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
      skillName: 'docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
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
