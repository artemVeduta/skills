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
import { compareOutcomes } from './test-runner/compare.mjs';
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

  const { closure, baselineSha } = await buildFixture({
    skillName, skillsRoot, driver, fixtureRoot, inputs: testCase.inputs,
  });
  const sourcesUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Built unconditionally: dry-run must record the FULL real invocation (args
  // including the model flag, plus the profile env), and run.json records
  // command+args even for skipped legs.
  const invocation = driver.buildInvocation({
    fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir,
  });

  // Plan/approval turns (v2 acceptance seam): the case's prompt is turn 1
  // (propose and pause — the headless turn ends on the pause); each follow-up
  // prompt resumes the SAME session (explicit approval or denial). A driver
  // without resume support cannot run a gated case — configuration error,
  // surfaced BEFORE the dry-run return so a misconfigured gated case cannot
  // dry-run green and only fail live.
  const followUps = testCase.followUpPrompts ?? [];
  if (followUps.length > 0 && typeof driver.buildResumeInvocation !== 'function') {
    await rm(fixtureRoot, { recursive: true, force: true });
    throw new Error(`harness ${id} does not implement buildResumeInvocation but the case declares follow-up turns`);
  }

  if (dryRun) {
    // Dry-run previews the WHOLE exchange that would execute: turn 1 plus one
    // resume invocation per follow-up turn.
    const resumeInvocations = followUps.map((prompt) =>
      driver.buildResumeInvocation({ fixtureRoot, prompt, model: resolvedModel, profileDir }));
    return { id, status: 'dry-run', closure, invocation, resumeInvocations, model: resolvedModel, sourcesUnmodified, fixtureRoot };
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

  const turns = [runDriver(driver, { fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir })];
  for (const prompt of followUps) {
    // A hung/killed turn ends the exchange — resuming a session that never
    // paused cleanly would only produce unattributable output.
    if (turns.at(-1).timedOut) break;
    turns.push(runDriver(driver, { fixtureRoot, prompt, model: resolvedModel, profileDir, resume: true }));
  }
  const lastTurn = turns.at(-1);
  const timedOut = turns.some((t) => t.timedOut);
  // The oracle judges the WHOLE exchange: state assertions read the fixture as
  // the final turn left it; output assertions see every turn's output.
  const output = turns.map((t) => t.stdout).join('\n');
  // baselineSha pins git-unchanged to the true fixture baseline; skillsSubdir
  // points portable-contract at THIS driver's projected pack.
  const assertions = await evaluateAssertions(testCase.assertions, {
    workdir: fixtureRoot, repoRoot: REPO_ROOT, output,
    baselineSha, skillsSubdir: driver.discoverySubdir,
  });
  const afterUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Raw artifacts land in the git-ignored in-repo runs area, created lazily so
  // a dry run leaves no empty dirs. The fixture itself stays ephemeral in
  // tmpdir. Turn 1 keeps the v1 transcript name; later turns are numbered.
  const runDir = join(runsRoot, runId, id);
  await mkdir(runDir, { recursive: true });
  for (let i = 0; i < turns.length; i++) {
    const name = i === 0 ? 'transcript.json' : `transcript-${i + 1}.json`;
    await writeFile(join(runDir, name), turns[i].stdout || turns[i].stderr || '');
  }
  await writeFile(join(runDir, 'assertions.json'), JSON.stringify(assertions, null, 2));
  await writeRunJson(runsRoot, runId, id, {
    id, status: 'executed', model: resolvedModel, harnessVersion: gate.version,
    invocation: { command: invocation.command, args: invocation.args },
    turnCount: turns.length,
    exitStatus: lastTurn.status, timedOut, skipReason: null,
  });

  return {
    id, status: 'executed', assertions, sourcesUnmodified: afterUnmodified,
    exitStatus: lastTurn.status,
    harnessError: timedOut ? 'harness timed out after the configured limit' : lastTurn.error,
    timedOut,
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
    // Injection seams for deterministic tests (fake drivers, green preflight);
    // production always uses the real registry and ladder.
    resolveDriverFn = resolveDriver,
    preflight,
  } = opts;

  const testCase = await loadCase(skillName, { casesRoot });
  const beforeHash = await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS);
  const harnesses = [];

  for (const { id, model } of harnessSelections) {
    const driver = resolveDriverFn(id);
    if (!driver) throw new UsageError(`unknown harness: ${id}`);
    harnesses.push(
      await runHarness(driver, {
        skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun, model,
        preflight,
      }),
    );
  }

  // Cross-harness outcome comparison (v2 acceptance seam): every executed
  // leg's fixture must hold an EQUIVALENT repository outcome for each
  // case-declared path. Computed while fixtures still exist (the CLI cleans
  // them up only after reporting). Persisted next to the per-leg records: the
  // EQUIVALENT/DIVERGED verdict gates the exit code, so it must be
  // attributable after the run like every other verdict (spec §7).
  const executed = harnesses.filter((h) => h.status === 'executed');
  const comparisons = !dryRun && testCase.compare?.paths?.length
    ? await compareOutcomes(testCase.compare.paths, executed)
    : [];
  if (comparisons.length > 0) {
    const runDir = join(runsRoot, runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'comparisons.json'), JSON.stringify(comparisons, null, 2));
  }

  return { skill: skillName, runId, dryRun, harnesses, comparisons };
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
