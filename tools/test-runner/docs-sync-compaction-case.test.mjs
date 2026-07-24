// Deterministic recognition tests for the docs-sync COMPACTION nuance (issue #55,
// spec §docs-sync "compaction", branch mode). #54 taught branch-scoped
// reconciliation; #55 extends the SAME docs-sync skill to preserve accepted
// semantic history while folding branch-local drafting residue down to the net
// state that should survive review and merge. These tests are the CI-reachable
// deterministic layer (run by `npm test`); they never run a model. The live
// behavioural evidence comes from two sibling cases via the test-runner CLI:
// docs-sync-compact (a docs-only branch whose drafting churn folds to one net
// Creation + one net Update, dated amendment heading folded into prose, no
// operational entry) and docs-sync-supersede (a material reversal gated behind
// confirmation that produces a linked supersession). Both project the real
// docs-sync skill, so they extend #54's cases without touching them.
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

test('the SKILL.md documents the v2 compaction contract (all eight #55 criteria)', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');

  // There is a dedicated compaction section — the nuance is a first-class part of
  // the branch-sync contract, not a stray sentence.
  assert.match(skill, /^#+.*compact/im, 'SKILL.md needs a dedicated compaction section');

  // AC1 — a Creation followed by branch-local edits collapses to ONE final
  // Creation entry; the concept stays a Creation rather than sprouting an Update.
  assert.match(skill, /remains\s+`?Creation`?|one (final |net )?`?Creation`?/i);

  // AC2 — an existing changed concept collapses to one net Update; a retired one
  // to one net Deprecation.
  assert.match(skill, /one[^.\n]*`?Update`?/i);
  assert.match(skill, /`?Deprecation`?/i);

  // AC3 — no operational `docs-sync ran`, debt-marker, or `Noted` lifecycle entry
  // is ever written.
  assert.match(skill, /docs-sync ran/i);
  assert.match(skill, /Noted/);
  assert.match(skill, /debt marker/i);
  assert.match(skill, /operational/i);

  // AC4 — target-side (already-merged) dated amendments, rationale/value facts,
  // and lifecycle entries remain unchanged; only drafting after the merge-base
  // boundary is eligible for compaction.
  assert.match(skill, /target-side|already[- ]merged|previously merged/i);
  assert.match(skill, /(amendment|value fact|rationale|lifecycle)[^.\n]*(unchanged|intact|preserv|protect)/i);
  assert.match(skill, /merge[- ]?base/i);

  // AC5 — a branch-local amendment HEADING is removed while the accepted dated
  // old/new value fact is folded into the canonical Context or Consequences prose.
  assert.match(skill, /amendment heading/i);
  assert.match(skill, /fold/i);
  assert.match(skill, /Context|Consequences/);
  assert.match(skill, /dated/i);

  // AC6 — ordinary refinements update the accepted live sections in place.
  assert.match(skill, /ordinary refinement/i);
  assert.match(skill, /in place/i);

  // AC7 — a change to a selected alternative, ownership boundary, hard
  // constraint, or material consequence is a reversal: it REQUIRES confirmation
  // and creates a linked supersession rather than a silent edit.
  assert.match(skill, /selected alternative|ownership boundary|hard constraint|material consequence/i);
  assert.match(skill, /reversal/i);
  assert.match(skill, /confirm/i);
  assert.match(skill, /supersession|supersede/i);
  assert.match(skill, /link/i);

  // AC8 — the compaction result is idempotent and lands the branch at the
  // accepted net state (validation + Git preservation are covered by the shared
  // branch-sync contract the #54 tests already assert).
  assert.match(skill, /idempoten/i);
  assert.match(skill, /accepted[- ]state|accepted net state|net state/i);
});

test('the compaction case loads, targets docs-sync, and proves the net-state fold', async () => {
  const c = await loadCase('docs-sync-compact', { casesRoot });
  // The directory is docs-sync-compact; the manifest projects the real docs-sync
  // skill so one skill carries the #54 cases and this #55 compaction case.
  assert.equal(c.skill, 'docs-sync');

  const has = (pred) => c.assertions.some(pred);

  // AC8 on the WRITE path: compaction legitimately dirties the tree, so the case
  // asserts git-uncommitted (HEAD at baseline, nothing staged, no remote), the
  // sibling of the gate case's git-unchanged.
  assert.ok(
    c.assertions.some((a) => a.type === 'git-uncommitted'),
    'the compaction case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );

  // AC1 discriminator: a run that appends rather than compacts leaves the
  // spurious branch-local follow-up Update in the log, so the case must assert it
  // is gone.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/log.md' && a.value === 'webhooks-branch-update'),
    'the compaction case must prove the spurious follow-up Update collapsed into one net Creation',
  );

  // AC3 discriminator: the operational `docs-sync ran`/`**Noted**` line must be
  // gone from the log.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/log.md' && a.value === 'operational-noted'),
    'the compaction case must prove no operational lifecycle entry survives',
  );
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/log.md' && a.value === 'docs-sync ran'),
  );

  // AC4 discriminator: the already-merged (target-side) log entries survive
  // byte-preserved.
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === 'target-log-update'),
    'the compaction case must prove already-merged history is preserved',
  );

  // AC5 discriminator: the branch-local amendment HEADING is removed from the
  // concept while the dated fact is folded into prose — `## 2026-07-23` must be
  // absent from the concept, yet the date and the new value must remain.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/decisions/idempotency.md' && a.value === '## 2026-07-23'),
    'the compaction case must prove the branch-local amendment heading is removed',
  );
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/decisions/idempotency.md' && a.value === '2026-07-23'),
    'the compaction case must prove the dated value fact is retained (folded into prose)',
  );
  // AC4 discriminator on the concept: the target-side amendment survives untouched.
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/decisions/idempotency.md' && a.value === 'target-amendment'),
  );

  assert.ok(has((a) => a.type === 'portable-contract'));

  // buildFixture projects docs-sync with its docs-validate closure and leaves the
  // branch's drafting residue as genuine working-tree drift for the reconcile.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-compact-'));
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

test('the supersession case loads, gates behind confirmation, and proves a linked supersession', async () => {
  const c = await loadCase('docs-sync-supersede', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  const has = (pred) => c.assertions.some(pred);

  // AC7 confirmation gate: turn 1 proposes and PAUSES; exactly one follow-up
  // (confirm.md) supplies the explicit go-ahead, so the supersession is only
  // written after confirmation (the plan/approval seam).
  assert.equal(c.followUpPrompts.length, 1, 'the supersession must be gated behind one confirmation turn');

  // AC8 on the write path: the confirmed supersession dirties the tree but leaves
  // Git otherwise untouched.
  assert.ok(c.assertions.some((a) => a.type === 'git-uncommitted'));

  // AC7 — the old decision is marked superseded and LINKED to the replacement,
  // and its original selected alternative is retained (not silently rewritten).
  const storage = 'docs/payments/decisions/token-store.md';
  assert.ok(has((a) => a.type === 'file-contains' && a.path === storage && a.value === 'status: superseded'));
  assert.ok(has((a) => a.type === 'file-contains' && a.path === storage && a.value === 'superseded_by'));
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === storage && a.value === 'selected-postgres'),
    'the supersession case must prove the old decision was retained, not silently edited',
  );

  // AC7 — a replacement Decision is created (a new linked concept, not an
  // in-place rewrite) and it is live.
  const replacement = 'docs/payments/decisions/token-store-redis.md';
  assert.ok(has((a) => a.type === 'file-exists' && a.path === replacement));
  assert.ok(has((a) => a.type === 'file-not-contains' && a.path === replacement && a.value === 'status: superseded'));

  // AC7 — the supersession is logged as one Deprecation.
  assert.ok(has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === '**Deprecation**'));

  assert.ok(has((a) => a.type === 'portable-contract'));

  // buildFixture projects docs-sync with its docs-validate closure over the
  // branch's unstaged source reversal.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-supersede-'));
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
