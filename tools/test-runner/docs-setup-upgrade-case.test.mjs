// Deterministic recognition tests for the docs-setup UPGRADE / REINSTALL /
// PARTIAL-REPAIR slice (issue #53, spec §docs-setup). #52 shipped docs-setup for
// the FRESH path only; this slice extends the SAME skill to conservative tooling
// upgrades, reinstalls, and partial repairs — all derived ENTIRELY from the
// repository's recomputed state, with no suite-version/state file.
//
// These are the CI-reachable deterministic layer: they assert the SKILL.md
// contract documents every #53 behavior, and that the four sibling live cases
// load, project the real docs-setup skill, and carry the oracle assertions that
// WOULD prove each behavior when driven by a model via the test-runner CLI:
//   - docs-setup-upgrade        — clean-worktree upgrade; a differing managed file
//                                 is customized-until-reviewed then reinstalled;
//   - docs-setup-upgrade-dirty  — dirty-worktree GATE (deny): explicit approval
//                                 required; nothing managed written;
//   - docs-setup-repair         — partial repair: missing files created, current
//                                 files no-op, specifications/ preserved;
//   - docs-setup-noop           — current target: no-change plan, git-unchanged
//                                 (proves no-op classification AND idempotency).
// These tests never run a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { loadCase } from './case-loader.mjs';
import { buildFixture } from './fixture.mjs';
import { checkPortableContract } from './static-contract.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');
const skillsRoot = join(REPO_ROOT, 'skills');
const skillDir = join(skillsRoot, 'docs-setup');

test('the SKILL.md documents the upgrade / reinstall / partial-repair contract (#53)', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');

  // AC1: every run RECOMPUTES state — never reads or writes a suite-version /
  // state file.
  assert.match(skill, /recompute/i);
  assert.match(skill, /suite-version|state file/i);

  // AC2: fresh, upgrade, and partial-repair classifications derived from managed
  // surfaces and shown BEFORE any mutation. (reinstall is the same conservative
  // path as upgrade over already-present machinery.)
  assert.match(skill, /fresh/i);
  assert.match(skill, /upgrade/i);
  assert.match(skill, /reinstall/i);
  assert.match(skill, /partial[ -]repair|partial repair/i);
  assert.match(skill, /before (any )?(mutation|writ)/i);

  // AC3: upgrade is clean-worktree by DEFAULT and requires EXPLICIT approval when
  // the worktree is dirty.
  assert.match(skill, /clean[- ]?worktree/i);
  assert.match(skill, /dirty/i);
  assert.match(skill, /explicit approval/i);

  // AC4: exact current managed files are NO-OPS; MISSING files proposed for
  // creation; every DIFFERING file is customized-until-reviewed (never blindly
  // overwritten).
  assert.match(skill, /no-op/i);
  assert.match(skill, /missing/i);
  assert.match(skill, /differ/i);
  assert.match(skill, /customiz/i);
  assert.match(skill, /review/i);
  assert.match(skill, /blindly|never overwrite|not.*overwrit/i);

  // AC5: ambiguous project-memory content is preserved and BLOCKS completion
  // rather than being guessed through.
  assert.match(skill, /ambigu/i);
  assert.match(skill, /block/i);
  assert.match(skill, /guess/i);

  // AC6: recognized marked wiring is replaced IDEMPOTENTLY while unrelated
  // guidance is byte-preserved.
  assert.match(skill, /marked/i);
  assert.match(skill, /idempoten/i);
  assert.match(skill, /byte|preserv/i);

  // AC7: canonical helper discovery + conflict resolution PRECEDE any proposed
  // removal of obsolete project-local helper copies.
  assert.match(skill, /discover/i);
  assert.match(skill, /conflict/i);
  assert.match(skill, /remov/i);
  assert.match(skill, /project-local|local .*cop|helper cop/i);

  // AC8: existing specifications/ content and evolving indexes/logs/concepts
  // remain untouched (later semantic sync is docs-sync's job).
  assert.match(skill, /specifications\//);
  assert.match(skill, /indexes|logs|concepts/i);
  assert.match(skill, /untouched|not upgrade-managed|not .*managed/i);

  // AC9: tooling success and bundle validity reported INDEPENDENTLY, incl.
  // correct handling of pre-existing bundle errors (upgrade/repair requires
  // validator tests to pass and validation NOT to exit 2; pre-existing content
  // errors are reported for a separate sync, not misclassified as tooling).
  assert.match(skill, /tooling installed successfully/i);
  assert.match(skill, /bundle validates cleanly/i);
  assert.match(skill, /pre-existing/i);
  assert.match(skill, /exit\s*`?2`?|malfunction/i);

  // AC10: verification proves tests, preservation, validation classification,
  // idempotency, and absence of Git/remote side effects.
  assert.match(skill, /verif/i);
  assert.match(skill, /stage|staging/i);
  assert.match(skill, /commit/i);
  assert.match(skill, /remote/i);
  assert.match(skill, /pull request/i);
});

test('the clean-worktree upgrade case reinstalls a differing managed file after review', async () => {
  const c = await loadCase('docs-setup-upgrade', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  assert.equal(c.followUpPrompts.length, 1);
  // Classification shown before mutation (live AC2 evidence).
  assert.ok(c.assertions.some((a) => a.type === 'output-contains' && a.value === 'upgrade'));
  // The differing validator was reviewed then reinstalled byte-identical to the
  // canonical asset (AC4: customized-until-reviewed, nothing blindly overwritten).
  assert.ok(
    c.assertions.some(
      (a) =>
        a.type === 'file-equals' &&
        a.path === 'scripts/validate-docs.mjs' &&
        a.against === 'skills/docs-setup/assets/scripts/validate-docs.mjs',
    ),
    'upgrade case must assert the differing validator was reinstalled byte-identical to the asset',
  );
  // Its old customized content is gone.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-not-contains' && a.path === 'scripts/validate-docs.mjs'),
    'upgrade case must assert the old customized validator content was replaced',
  );
  // An already-current managed file stayed a no-op (byte-identical).
  assert.ok(
    c.assertions.some(
      (a) => a.type === 'file-equals' && a.path === 'scripts/validate-docs.test.mjs',
    ),
    'upgrade case must assert an already-current file stayed byte-identical (no-op)',
  );
  // AC8: an EVOLVED index that DIFFERS from the seed is byte-PRESERVED, never
  // reinstalled — the guard that a differing evolving index is NOT treated like a
  // differing machinery file (which would wipe accumulated project content).
  assert.ok(
    c.assertions.some(
      (a) => a.type === 'file-contains' && a.path === 'docs/index.md' && a.value === 'evolved-index-keep-me',
    ),
    'upgrade case must assert an evolved (differing) index is byte-preserved, not reinstalled',
  );
  // Marked wiring present (idempotent replace) + unrelated guidance byte-preserved (AC6).
  assert.ok(c.assertions.some((a) => a.type === 'file-contains' && a.path === 'AGENTS.md' && a.value === 'BEGIN OKF docs router'));
  assert.ok(c.assertions.some((a) => a.type === 'file-contains' && a.path === 'AGENTS.md' && a.value === 'house-rule-keep-me'));
  // AC10 write path: Git otherwise untouched.
  assert.ok(c.assertions.some((a) => a.type === 'git-uncommitted'), 'upgrade case must assert git-uncommitted');
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));
});

test('the dirty-worktree upgrade case proves the explicit-approval gate on denial', async () => {
  const c = await loadCase('docs-setup-upgrade-dirty', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  assert.equal(c.followUpPrompts.length, 1);
  // The dirty state is surfaced and the state classified upgrade before mutation.
  assert.ok(c.assertions.some((a) => a.type === 'output-contains' && a.value === 'upgrade'));
  assert.ok(
    c.assertions.some((a) => a.type === 'output-contains' && a.value === 'dirty'),
    'dirty case must assert the dirty worktree was surfaced',
  );
  // The gate HELD on denial: the differing validator kept its old content and the
  // canonical validator was NOT installed (AC3 — no proceed without explicit
  // dirty approval).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'scripts/validate-docs.mjs' && a.value.includes('OKF-OLD-VALIDATOR-SENTINEL')),
    'dirty case must prove the differing validator was not replaced on denial',
  );
  assert.ok(
    c.assertions.some(
      (a) =>
        a.type === 'file-not-contains' &&
        a.path === 'scripts/validate-docs.mjs' &&
        a.value.includes('Strict OKF v0.1 conformance validator'),
    ),
    'dirty case must prove the canonical validator was not installed on denial',
  );
  // The pre-existing uncommitted work is byte-preserved, and Git is otherwise
  // untouched. git-unchanged is unusable on a deliberately dirty fixture, so
  // git-uncommitted is the correct no-side-effects proof here.
  assert.ok(c.assertions.some((a) => a.type === 'file-contains' && a.path === 'WIP.txt'));
  assert.ok(c.assertions.some((a) => a.type === 'git-uncommitted'), 'dirty case must assert git-uncommitted');
  assert.ok(!c.assertions.some((a) => a.type === 'git-unchanged'), 'a dirty fixture cannot assert git-unchanged');
});

test('the partial-repair case creates missing files, no-ops current ones, and preserves specifications/', async () => {
  const c = await loadCase('docs-setup-repair', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  assert.equal(c.followUpPrompts.length, 1);
  assert.ok(c.assertions.some((a) => a.type === 'output-contains' && a.value === 'repair'));
  // The MISSING test file is created byte-identical to the canonical asset (AC4).
  assert.ok(c.assertions.some((a) => a.type === 'file-exists' && a.path === 'scripts/validate-docs.test.mjs'));
  assert.ok(
    c.assertions.some(
      (a) =>
        a.type === 'file-equals' &&
        a.path === 'scripts/validate-docs.test.mjs' &&
        a.against === 'skills/docs-setup/assets/scripts/validate-docs.test.mjs',
    ),
    'repair case must assert the missing test was created byte-identical to the asset',
  );
  // Missing package scripts added.
  assert.ok(c.assertions.some((a) => a.type === 'file-contains' && a.path === 'package.json' && a.value.includes('docs:validate')));
  // The already-current validator stayed byte-identical (no-op).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-equals' && a.path === 'scripts/validate-docs.mjs'),
    'repair case must assert the current validator stayed a byte-identical no-op',
  );
  // Existing specifications/ content preserved AND not renamed (AC8).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'docs/specifications/legacy.md'),
    'repair case must assert existing specifications/ content is preserved',
  );
  assert.ok(
    c.assertions.some((a) => a.type === 'file-exists' && a.path === 'docs/specifications/legacy.md'),
    'repair case must assert specifications/ was not renamed to specs/',
  );
  assert.ok(c.assertions.some((a) => a.type === 'git-uncommitted'));
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));
});

test('the no-op case proves a current-contract rerun is a git-unchanged no-change plan (idempotency)', async () => {
  const c = await loadCase('docs-setup-noop', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  // A current target is a no-op — a single read-only turn, no approval needed.
  assert.equal(c.followUpPrompts.length, 0);
  assert.ok(
    c.assertions.some((a) => a.type === 'output-contains' && a.value === 'no-change'),
    'no-op case must assert a no-change plan was reported',
  );
  // Headline: NOTHING is written — the fixture stays exactly at baseline. This is
  // the single proof of BOTH the no-op classification and idempotency.
  assert.ok(
    c.assertions.some((a) => a.type === 'git-unchanged'),
    'no-op case must assert git-unchanged (nothing written, no Git side effects, idempotent)',
  );
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));
});

test('every #53 case projects the full suite closure and passes the static portable contract', async () => {
  for (const name of ['docs-setup-upgrade', 'docs-setup-upgrade-dirty', 'docs-setup-repair', 'docs-setup-noop']) {
    const c = await loadCase(name, { casesRoot });
    const fixtureRoot = await mkdtemp(join(tmpdir(), `${name}-`));
    try {
      const { closure } = await buildFixture({
        skillName: c.skill,
        skillsRoot,
        driver: { discoverySubdir: '.claude/skills' },
        fixtureRoot,
        inputs: c.inputs,
      });
      // The whole suite closure is projected, exactly what the CLI would run.
      assert.deepEqual(closure, ['docs-add', 'docs-setup', 'docs-validate'], `${name}: closure`);
      const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
      assert.deepEqual(errors, [], `${name}: portable contract`);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
});
