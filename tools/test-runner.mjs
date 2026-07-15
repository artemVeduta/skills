#!/usr/bin/env node
// Local, GATING skill test runner (issue #24 tracer bullet). Projects a skill +
// its `## Required skills` closure into a disposable per-harness fixture, drives
// each harness's headless CLI against the case's scenario prompt, and decides
// pass/fail from deterministic state assertions ONLY. Exits NONZERO on assertion
// failure or source mutation — deliberately unlike the always-advisory docs
// validator and skill linter. Runs LOCALLY ONLY; never invoked by CI.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DRIVERS, resolveDriver } from './test-runner/drivers.mjs';
import { profileDirFor } from './test-runner/profiles.mjs';
import { buildFixture, hashGuardedTrees } from './test-runner/fixture.mjs';
import { loadCase } from './test-runner/case-loader.mjs';
import { preflightHarness, runDriver } from './test-runner/runner.mjs';
import { evaluateAssertions } from './test-runner/oracle.mjs';
import { formatRunReport, exitCodeFor } from './test-runner/report.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

// skills/ is the ADR immutability AC; docs/ scripts/ .claude/ are the other
// committed trees a mis-targeted agent could clobber if it resolves the
// enclosing git root instead of honoring cwd. tools/ is excluded (tools/runs
// churns every run). Defense-in-depth atop the out-of-repo fixture.
const GUARDED_DIRS = ['skills', 'docs', 'scripts', '.claude'];

class UsageError extends Error {}

// One harness's full lifecycle, returning exactly one status-tagged
// HarnessResult. Extracted from runCase so a fake driver can exercise the
// executed branch in tests without inference (inject `preflight` — the real
// ladder checks profile dirs and process listings), and so the tagged union is
// built in ONE place (no producer/contract drift).
export async function runHarness(driver, {
  skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun, model,
  preflight = preflightHarness,
}) {
  const id = driver.id;
  const resolvedModel = model ?? driver.defaultModel;
  const profileDir = profileDirFor(id);
  // The harness spawn cwd MUST live OUTSIDE the repo tree: a headless CLI walks
  // up from cwd to discover project memory (CLAUDE.md/AGENTS.md) and project
  // skills, so an in-repo fixture would leak this repo's own memory + skills
  // into the skill under test. The profile env covers user scope only.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));

  const closure = await buildFixture({
    skillName, skillsRoot, driver, fixtureRoot, inputs: testCase.inputs,
  });
  const sourcesUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Built unconditionally: dry-run must record the FULL real invocation (args
  // including the model flag, plus the profile env), and run.json records
  // command+args even for skipped legs.
  const invocation = driver.buildInvocation({
    fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir,
  });

  if (dryRun) {
    return { id, status: 'dry-run', closure, invocation, model: resolvedModel, sourcesUnmodified, fixtureRoot };
  }

  const gate = await preflight(driver, profileDir);
  if (gate.skipReason) {
    await rm(fixtureRoot, { recursive: true, force: true });
    await writeRunJson(runsRoot, runId, id, {
      id, status: 'skipped', model: resolvedModel, harnessVersion: gate.version,
      invocation: { command: invocation.command, args: invocation.args },
      exitStatus: null, timedOut: false, skipReason: gate.skipReason,
    });
    return { id, status: 'skipped', skipReason: gate.skipReason, fixtureRoot };
  }

  const proc = runDriver(driver, { fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir });
  const assertions = await evaluateAssertions(testCase.assertions, {
    workdir: fixtureRoot, repoRoot: REPO_ROOT, output: proc.stdout,
  });
  const afterUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Raw artifacts land in the git-ignored in-repo runs area, created lazily so
  // a dry run leaves no empty dirs. The fixture itself stays ephemeral in tmpdir.
  const runDir = join(runsRoot, runId, id);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'transcript.json'), proc.stdout || proc.stderr || '');
  await writeFile(join(runDir, 'assertions.json'), JSON.stringify(assertions, null, 2));
  await writeRunJson(runsRoot, runId, id, {
    id, status: 'executed', model: resolvedModel, harnessVersion: gate.version,
    invocation: { command: invocation.command, args: invocation.args },
    exitStatus: proc.status, timedOut: proc.timedOut, skipReason: null,
  });

  return {
    id, status: 'executed', assertions, sourcesUnmodified: afterUnmodified,
    exitStatus: proc.status,
    harnessError: proc.timedOut ? 'harness timed out after the configured limit' : proc.error,
    timedOut: proc.timedOut,
    model: resolvedModel, harnessVersion: gate.version,
    fixtureRoot,
  };
}

// Structured per-leg provenance record (spec §7): run.json is written for
// executed AND skipped legs, so a verdict — or its absence — is always
// attributable to a model + harness version. transcript.json stays the raw
// output dump, unchanged in shape.
async function writeRunJson(runsRoot, runId, harnessId, record) {
  const runDir = join(runsRoot, runId, harnessId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'run.json'), JSON.stringify(record, null, 2));
}

export async function runCase(skillName, opts = {}) {
  const {
    skillsRoot = join(REPO_ROOT, 'skills'),
    casesRoot = join(REPO_ROOT, 'tools/tests'),
    runsRoot = join(REPO_ROOT, 'tools/runs'),
    harnessSelections = DRIVERS.map((d) => ({ id: d.id, model: null })),
    dryRun = false,
    runId = String(Date.now()),
  } = opts;

  const testCase = await loadCase(skillName, { casesRoot });
  const beforeHash = await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS);
  const harnesses = [];

  for (const { id, model } of harnessSelections) {
    const driver = resolveDriver(id);
    if (!driver) throw new UsageError(`unknown harness: ${id}`);
    harnesses.push(
      await runHarness(driver, { skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun, model }),
    );
  }

  return { skill: skillName, runId, dryRun, harnesses };
}

export function parseArgs(argv) {
  const opts = { dryRun: false, harnessSelections: undefined, runsRoot: undefined };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--harness') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --harness requires a value');
      const eq = v.indexOf('=');
      const sel = eq === -1 ? { id: v, model: null } : { id: v.slice(0, eq), model: v.slice(eq + 1) };
      if (sel.id === '' || sel.model === '') throw new UsageError('usage: --harness <id>[=<model>]');
      opts.harnessSelections ??= [];
      // Duplicate ids are a usage error: one run never executes the same
      // harness twice, and the artifact layout is keyed by driver id (spec §3).
      if (opts.harnessSelections.some((s) => s.id === sel.id)) {
        throw new UsageError(`duplicate --harness ${sel.id}`);
      }
      opts.harnessSelections.push(sel);
    } else if (a === '--runs') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --runs requires a value');
      opts.runsRoot = v;
    } else if (!a.startsWith('--')) positional.push(a);
  }
  return { opts, positional };
}

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2));
  const skillName = positional[0];
  if (!skillName) {
    throw new UsageError('usage: node tools/test-runner.mjs <skill-name> [--harness <id>[=<model>]]... [--dry-run] [--runs <dir>]');
  }
  const run = await runCase(skillName, opts);
  console.log(formatRunReport(run));
  const code = exitCodeFor(run);
  // The CLI owns cleanup of the ephemeral tmpdir fixtures it created (in-process
  // callers clean their own). Done after the report so fixture paths stay valid.
  for (const h of run.harnesses) {
    await rm(h.fixtureRoot, { recursive: true, force: true });
  }
  process.exit(code);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(err instanceof UsageError ? 2 : 1);
  });
}
