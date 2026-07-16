#!/usr/bin/env node
// Benchmark test + report flow (#25, rescoped). Wraps — and never modifies — #24's
// runCase (tools/test-runner.mjs): resolves a preset to (harness set, trial count),
// runs the case that many times, aggregates the run.json provenance #24 already
// writes into a committed summary JSON, and renders a deterministic markdown report.
// Single-arm (no without-skill leg), local-only, never in CI.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCase } from '../test-runner.mjs';
import { resolvePreset } from './presets.mjs';
import { modelFor } from './models.mjs';
import { gitProvenance } from './provenance.mjs';
import { aggregate } from './summary.mjs';
import { renderReport } from './report.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
// D3: aligned with scripts/release.mjs's SUMMARIES_DIR = 'tools/benchmarks/summaries'.
const SUMMARIES_DIR = join(REPO_ROOT, 'tools/benchmarks/summaries');
const REPORTS_DIR = join(REPO_ROOT, 'tools/benchmarks/reports');

class UsageError extends Error {}

export function parseBenchArgs(argv) {
  const opts = { skill: undefined, preset: undefined, trials: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--preset') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --preset requires a value');
      if (opts.preset !== undefined) throw new UsageError('usage: --preset may be given only once');
      opts.preset = v;
    } else if (a === '--trials') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --trials requires a value');
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) throw new UsageError('usage: --trials <n> must be a positive integer');
      opts.trials = n;
    } else if (!a.startsWith('--')) {
      if (opts.skill === undefined) opts.skill = a;
    }
  }
  return opts;
}

export async function runBench(skillName, {
  presetName, trials, runsRoot = join(REPO_ROOT, 'tools/runs'),
  summariesDir = SUMMARIES_DIR, reportsDir = REPORTS_DIR,
  runCase: runCaseFn = runCase, gitProvenance: gitProvenanceFn = gitProvenance,
  modelFor: modelForFn = modelFor,
  now = () => new Date(), baseRunId = String(Date.now()),
}) {
  const preset = resolvePreset(presetName);
  const trialCount = trials ?? preset.trials;
  const harnessSelections = preset.harnesses.map((id) => ({ id, model: modelForFn(id) }));

  const legs = [];
  for (let t = 1; t <= trialCount; t++) {
    // Explicit unique runId per trial: runCase's default (Date.now()) could
    // collide within a tight loop and overwrite a prior trial's run.json.
    const runId = `${baseRunId}-t${t}`;
    const run = await runCaseFn(skillName, { harnessSelections, runsRoot, runId });
    for (const h of run.harnesses) {
      const record = JSON.parse(
        await readFile(join(runsRoot, run.runId, h.id, 'run.json'), 'utf8'),
      );
      legs.push({
        trial: t, id: h.id, status: h.status,
        model: record.model, version: record.harnessVersion,
        sourcesUnmodified: h.sourcesUnmodified, assertions: h.assertions,
      });
      // In-process callers own fixture cleanup (tools/test-runner.mjs:176-179).
      await rm(h.fixtureRoot, { recursive: true, force: true });
    }
  }

  const provenance = gitProvenanceFn(REPO_ROOT, { now });
  const summary = aggregate({
    presetName, harnessIds: preset.harnesses, skillName,
    caseName: skillName, trialCount, provenance, legs,
  });

  const base = `${skillName}-${presetName}-${baseRunId}`;
  await mkdir(summariesDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  const summaryPath = join(summariesDir, `${base}.json`);
  const reportPath = join(reportsDir, `${base}.md`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(reportPath, `${renderReport(summary)}\n`);

  return { summary, summaryPath, reportPath };
}

async function main() {
  const opts = parseBenchArgs(process.argv.slice(2));
  if (!opts.skill) throw new UsageError('usage: node tools/benchmarks/run.mjs <skill-name> --preset smoke|full [--trials <n>]');
  if (!opts.preset) throw new UsageError('usage: --preset smoke|full is required');
  const { summary, summaryPath, reportPath } = await runBench(opts.skill, {
    presetName: opts.preset, trials: opts.trials,
  });
  console.log(`bench — case: ${summary.case.skill} (${summary.preset}), overall pass rate ${Math.round(summary.overallPassRate * 100)}%`);
  console.log(`summary: ${summaryPath}`);
  console.log(`report:  ${reportPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(err instanceof UsageError ? 2 : 1);
  });
}
