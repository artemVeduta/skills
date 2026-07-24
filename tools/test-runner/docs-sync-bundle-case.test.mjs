// Deterministic recognition tests for the docs-sync BUNDLE-WIDE mode (issue #56,
// spec §docs-sync "Bundle-wide reconciliation"). #54 taught branch-scoped
// reconciliation and #55 its compaction nuance; #56 extends the SAME docs-sync
// skill with the second mode alongside branch mode: instead of a branch diff from
// a merge-base, bundle-wide mode audits the COMPLETE current bundle against
// executable truth and still-valid explanatory truth, repairs every stale
// explanation / missing concept / omission / lifecycle-drift / shared-bookkeeping
// drift it finds (there is NO unrelated-drift category — the whole bundle is in
// scope), preserves accepted history unless branch-local provenance establishes a
// safe compaction boundary, and NEVER guesses through an unknown acceptance
// boundary (it blocks precisely instead). The shared execution / verification /
// validation / Git-state rules are REUSED from branch mode unchanged, not
// redefined. These tests are the CI-reachable deterministic layer (run by
// `npm test`); they never run a model. Live behavioural evidence comes from three
// sibling cases via the test-runner CLI: docs-sync-bundle (a fully-committed
// bundle whose whole-bundle drift only a bundle-wide audit catches — a stale
// explanation, a missing concept, and a bookkeeping omission — all repaired, with
// no concept reported-and-left), docs-sync-bundle-blocker (an ambiguous dated
// amendment whose acceptance boundary is unknown, which the skill must preserve
// and block on rather than compact through), and docs-sync-bundle-idempotent (an
// already-reconciled bundle a bundle-wide run leaves byte-for-byte unchanged — the
// second-run steady state). All three project the real docs-sync skill, so they
// extend #54/#55 without touching them.
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
const skillDir = join(skillsRoot, 'docs-sync');

test('the SKILL.md documents the v2 bundle-wide contract (all seven #56 criteria)', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');

  // There is a dedicated bundle-wide section — the second mode is a first-class
  // part of the docs-sync contract, not a stray sentence.
  assert.match(skill, /^#+.*bundle-wide/im, 'SKILL.md needs a dedicated bundle-wide section');

  // AC1 — the user selects bundle-wide mode before any write, and (unlike branch
  // sync) it needs NO target branch: its scope is the complete current bundle.
  assert.match(skill, /bundle-wide/i);
  assert.match(skill, /write nothing|no file is written/i);
  assert.match(skill, /no target branch|takes no target branch/i);

  // AC2 — the COMPLETE bundle is audited for every drift kind: stale
  // explanations, missing concepts, omissions, lifecycle drift, and
  // shared-bookkeeping drift.
  assert.match(skill, /complete bundle|whole bundle|entire bundle/i);
  assert.match(skill, /stale explanation/i);
  assert.match(skill, /missing concept/i);
  assert.match(skill, /omission/i);
  assert.match(skill, /lifecycle drift/i);
  assert.match(skill, /shared-bookkeeping|bookkeeping drift/i);

  // AC3 — all in-scope drift is repaired or reported as a precise blocker; there
  // is explicitly NO unrelated-drift category (the discriminator vs branch mode,
  // which reports unrelated target drift separately and leaves it byte-preserved).
  assert.match(skill, /no unrelated[- ]drift category/i);
  assert.match(skill, /repair/i);
  assert.match(skill, /blocker/i);

  // AC4 — accepted history is preserved unless branch-local provenance establishes
  // a safe compaction boundary.
  assert.match(skill, /accepted history/i);
  assert.match(skill, /branch-local provenance/i);
  assert.match(skill, /safe compaction boundary|compaction boundary/i);
  assert.match(skill, /preserv/i);

  // AC5 — an unknown acceptance boundary is NEVER guessed through; it becomes a
  // precise blocker.
  assert.match(skill, /unknown[^.\n]*boundary|boundary[^.\n]*unknown|acceptance boundary/i);
  assert.match(skill, /never guess|not guess|do not guess/i);
  assert.match(skill, /block/i);

  // AC6 — the shared ownership, sole-reconciler, semantic-size-review,
  // verification, validation, and Git-state rules MATCH branch mode: reused, not
  // redefined divergently.
  assert.match(skill, /same as branch/i);
  assert.match(skill, /sole reconciler/i);
  assert.match(skill, /reused|not redefined/i);

  // AC7 — bundle-wide reconciliation is idempotent: a second identical run
  // re-derives the same audit and writes nothing.
  assert.match(skill, /idempoten/i);
  assert.match(skill, /second identical bundle-wide|both modes[^.\n]*idempoten|bundle-wide[^.\n]*idempoten/i);
});

test('the bundle-wide audit case loads, targets docs-sync, and proves whole-bundle repair with no unrelated-drift category', async () => {
  const c = await loadCase('docs-sync-bundle', { casesRoot });
  // The directory is docs-sync-bundle; the manifest projects the real docs-sync
  // skill so one skill carries the #54/#55 cases and this #56 bundle-wide case.
  assert.equal(c.skill, 'docs-sync');

  const has = (pred) => c.assertions.some(pred);

  // AC (write path): the whole-bundle repair legitimately dirties the tree, so
  // git-uncommitted (not git-unchanged) proves HEAD still equals the baseline
  // commit, nothing is staged, and no remote/PR was created.
  assert.ok(
    has((a) => a.type === 'git-uncommitted'),
    'the bundle-wide audit case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );

  // Whole-bundle audit discriminator #1 — a STALE EXPLANATION is repaired. The
  // entire bundle is committed, so merge-base(master, HEAD) is the baseline and a
  // BRANCH sync would find an empty diff and repair nothing; only a bundle-wide
  // audit catches this committed-but-stale spec. 'MAX_RETRIES' is absent at
  // baseline, so its presence proves the stale spec was reconciled to the source.
  assert.ok(
    has((a) => a.type === 'file-contains' && /specs\/retries\.md$/.test(a.path) && a.value === 'MAX_RETRIES'),
    'the audit case must prove the stale explanation was repaired to cite the current symbol',
  );

  // Whole-bundle audit discriminator #2 — a MISSING CONCEPT is filed. refunds
  // source exists but no concept documents it; the audit creates one (absent at
  // baseline).
  assert.ok(
    has((a) => a.type === 'file-exists' && /specs\/refunds\.md$/.test(a.path)),
    'the audit case must prove a missing concept was filed for undocumented source',
  );

  // Whole-bundle audit discriminator #3 — an OMISSION / shared-bookkeeping drift
  // is repaired: a concept present on disk but unregistered in its parent index
  // gets registered. 'currency.md' is absent from the decisions index at baseline.
  assert.ok(
    has(
      (a) =>
        a.type === 'file-contains' &&
        a.path === 'docs/payments/decisions/index.md' &&
        a.value === 'currency.md',
    ),
    'the audit case must prove the unregistered concept was added to its parent index',
  );

  // Lifecycle-drift discriminator — the single reconciler recorded the repairs in
  // the nearest log (a net Update for the reconciled spec, net Creations for the
  // newly filed / newly registered concepts), and wrote no operational entry.
  assert.ok(has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === '**Update**'));
  assert.ok(has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === '**Creation**'));
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/log.md' && a.value === 'docs-sync ran'),
  );

  // NO-UNRELATED-DRIFT discriminator — the retries spec and the currency concept
  // were already wrong at baseline and untouched by any branch: BRANCH mode would
  // report them separately and leave them BYTE-PRESERVED. This case proves the
  // opposite (they are REPAIRED), so it must assert the stale sentinel is GONE —
  // a run that merely appended, or that deferred them as "unrelated", would leave
  // it behind.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && /specs\/retries\.md$/.test(a.path) && a.value === 'stale-retry-count'),
    'the audit case must prove the stale concept was repaired, not deferred as unrelated drift',
  );

  assert.ok(has((a) => a.type === 'portable-contract'));

  // buildFixture projects docs-sync with its docs-validate closure over the
  // fully-committed stale bundle.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-bundle-'));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-sync', 'docs-validate']);
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('the unknown-boundary case loads single-turn and proves a blocker without guessing', async () => {
  const c = await loadCase('docs-sync-bundle-blocker', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  const has = (pred) => c.assertions.some(pred);

  // Autonomy: this case must be SINGLE-turn — no follow-up may script the pause.
  // The prompt merely asks for a bundle-wide reconcile and must NOT name the
  // amendment, "provenance", "boundary", or ask the model to "block"/pause, so
  // the block the run surfaces is the skill's own recognition that it cannot
  // establish the acceptance boundary.
  assert.equal(c.followUpPrompts.length, 0, 'the unknown-boundary gate must be a single autonomous turn');
  assert.doesNotMatch(c.prompt, /provenance/i, 'the prompt must not name provenance');
  assert.doesNotMatch(c.prompt, /\bboundary\b/i, 'the prompt must not name the acceptance boundary');
  assert.doesNotMatch(c.prompt, /\bblock\b/i, 'the prompt must not script the block');

  // AC (never guessed through): with only an unknowable-provenance amendment and
  // an otherwise-current bundle, a correct run writes NOTHING — it preserves the
  // material and blocks. git-unchanged proves the tree sits EXACTLY at baseline
  // (nothing written, staged, or committed).
  assert.ok(
    has((a) => a.type === 'git-unchanged'),
    'the unknown-boundary case must assert git-unchanged (preserved and blocked, nothing written)',
  );

  // The ambiguous dated amendment HEADING survives byte-preserved — it was NOT
  // folded/compacted (which is exactly what a wrong guess would do). Its presence
  // proves accepted history was preserved across an unknown boundary.
  assert.ok(
    has(
      (a) =>
        a.type === 'file-contains' &&
        a.path === 'docs/payments/decisions/idempotency.md' &&
        a.value === '## 2026-07-22',
    ),
    'the unknown-boundary case must prove the ambiguous amendment heading was preserved, not folded',
  );

  // The skill surfaced a precise blocker rather than guessing.
  assert.ok(
    has((a) => a.type === 'output-contains' && a.value === 'block'),
    'the unknown-boundary case must prove the run surfaced a blocker',
  );

  assert.ok(has((a) => a.type === 'portable-contract'));

  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-bundle-blk-'));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-sync', 'docs-validate']);
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('the idempotent-steady-state case loads and proves a no-op bundle-wide rerun', async () => {
  const c = await loadCase('docs-sync-bundle-idempotent', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  const has = (pred) => c.assertions.some(pred);

  // Single-turn: idempotence is proven at the steady state (an already-reconciled
  // bundle IS the post-first-successful-run fixed point), so a bundle-wide run
  // over it must be a no-op. Like the #54 reconcile case treats AC9, idempotence
  // is a design property (recompute the whole-bundle audit from current state
  // every run); this case demonstrates its observable consequence — no second-run
  // residue — and the SKILL.md grep above is the primary contract proof.
  assert.equal(c.followUpPrompts.length, 0, 'the idempotence case is a single steady-state run');

  // The no-op leaves the tree EXACTLY at baseline: git-unchanged proves the second
  // (identical) bundle-wide reconciliation wrote nothing.
  assert.ok(
    has((a) => a.type === 'git-unchanged'),
    'the idempotence case must assert git-unchanged (a no-op bundle-wide rerun)',
  );

  // Anti-laziness / no-false-rewrite discriminator — the already-current concept
  // is left byte-preserved (a run that "helpfully" rewrote a correct concept would
  // lose the sentinel, and its edit would also break git-unchanged).
  assert.ok(
    has((a) => a.type === 'file-contains' && /specs\/retries\.md$/.test(a.path) && a.value === 'current-retry-spec'),
    'the idempotence case must prove the already-current concept was left intact',
  );

  // Live evidence the run engaged bundle-wide mode.
  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'bundle-wide'));

  assert.ok(has((a) => a.type === 'portable-contract'));

  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-bundle-idem-'));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-sync', 'docs-validate']);
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
