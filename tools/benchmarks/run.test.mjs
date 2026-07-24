// tools/benchmarks/run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBench, parseBenchArgs } from './run.mjs';
// Canonical suite identity: the setup skill is `docs-setup` (issue #60).

const CLI = fileURLToPath(new URL('./run.mjs', import.meta.url));

test('parseBenchArgs reads skill, preset, and an optional --trials override', () => {
  assert.deepEqual(parseBenchArgs(['docs-setup', '--preset', 'full', '--trials', '3']),
    { skill: 'docs-setup', preset: 'full', trials: 3 });
});

test('parseBenchArgs leaves trials undefined when --trials is absent', () => {
  assert.deepEqual(parseBenchArgs(['docs-setup', '--preset', 'smoke']),
    { skill: 'docs-setup', preset: 'smoke', trials: undefined });
});

test('parseBenchArgs rejects a repeated --preset', () => {
  assert.throws(() => parseBenchArgs(['x', '--preset', 'smoke', '--preset', 'full']),
    /--preset may be given only once/);
});

test('parseBenchArgs rejects a non-positive --trials', () => {
  assert.throws(() => parseBenchArgs(['x', '--preset', 'smoke', '--trials', '0']),
    /--trials <n> must be a positive integer/);
});

test('runBench writes a committed summary JSON + report and cleans up fixtures (no inference)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bench-'));
  const runsRoot = join(root, 'runs');
  const summariesDir = join(root, 'summaries');
  const reportsDir = join(root, 'reports');
  const fixtures = [];
  try {
    const fakeRunCase = async (skillName, { harnessSelections, runsRoot: rr, runId }) => {
      const harnesses = [];
      for (const { id } of harnessSelections) {
        const fx = await mkdtemp(join(tmpdir(), 'bench-fx-'));
        fixtures.push(fx);
        await mkdir(join(rr, runId, id), { recursive: true });
        await writeFile(join(rr, runId, id, 'run.json'), JSON.stringify({
          id, status: 'executed', model: `m-${id}`, harnessVersion: `v-${id}`,
          invocation: { command: 'x', args: [] }, exitStatus: 0, timedOut: false, skipReason: null,
        }));
        harnesses.push({
          id, status: 'executed',
          assertions: [{ assertion: { type: 'file-exists' }, pass: true, detail: '' }],
          sourcesUnmodified: true, exitStatus: 0, harnessError: null, timedOut: false,
          model: `m-${id}`, harnessVersion: `v-${id}`, fixtureRoot: fx,
        });
      }
      return { skill: skillName, runId, dryRun: false, harnesses };
    };
    const res = await runBench('docs-setup', {
      presetName: 'smoke', runsRoot, summariesDir, reportsDir,
      runCase: fakeRunCase,
      gitProvenance: () => ({ timestamp: '2026-07-16T00:00:00.000Z', commit: 'abc', dirty: false }),
      baseRunId: 'RID',
    });
    assert.equal(res.summary.overallPassRate, 1);
    assert.equal(res.summary.harnesses[0].id, 'claude-code');
    assert.equal(res.summary.harnesses[0].model, 'm-claude-code');
    assert.equal(res.summaryPath, join(summariesDir, 'docs-setup-smoke-RID.json'));
    const onDisk = JSON.parse(await readFile(res.summaryPath, 'utf8'));
    assert.equal(onDisk.commit, 'abc');
    const md = await readFile(res.reportPath, 'utf8');
    assert.match(md, /# Benchmark report — docs-setup \(smoke\)/);
    for (const fx of fixtures) {
      await assert.rejects(stat(fx), 'fixture must be cleaned up by runBench');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    for (const fx of fixtures) await rm(fx, { recursive: true, force: true });
  }
});

test('CLI exits 2 when no skill is given', () => {
  const r = spawnSync(process.execPath, [CLI, '--preset', 'smoke'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test('CLI exits 2 when --preset is missing', () => {
  const r = spawnSync(process.execPath, [CLI, 'docs-setup'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--preset/);
});
