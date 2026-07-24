// Deterministic recognition tests for the docs-sync COMPACTION nuance (issue #55,
// spec §docs-sync "compaction", branch mode). #54 taught branch-scoped
// reconciliation; #55 extends the SAME docs-sync skill to preserve accepted
// semantic history while folding branch-local drafting residue down to the net
// state that should survive review and merge. These tests are the CI-reachable
// deterministic layer (run by `npm test`); they never run a model. The live
// behavioural evidence comes from three sibling cases via the test-runner CLI:
// docs-sync-compact (a docs-only branch whose drafting churn folds to one net
// Creation + one net Update, dated amendment heading folded into prose, no
// operational entry), docs-sync-supersede (a material reversal, after a bare
// confirmation, produces a linked supersession the skill DERIVES), and
// docs-sync-reversal-gate (a SINGLE-turn reconcile that names no supersession, so
// the skill must recognize the reversal on its own and refuse a silent edit —
// proving AC7's "requires confirmation" clause the write-path case cannot). All
// three project the real docs-sync skill, so they extend #54's cases without
// touching them.
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
    has((a) => a.type === 'git-uncommitted'),
    'the compaction case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );

  // AC1 discriminator: a run that appends rather than compacts leaves the
  // spurious branch-local follow-up Update in the log, so the case must assert it
  // is gone.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/log.md' && a.value === 'webhooks-branch-update'),
    'the compaction case must prove the spurious follow-up Update collapsed into one net Creation',
  );

  // AC1/AC2 POSITIVE discriminators: the weak `**Creation**`/`**Update**` markers
  // are satisfiable by the preserved target-side history alone, so an
  // over-deletion of the whole 2026-07-23 branch block would pass them falsely.
  // The case must pin the BRANCH's net entries positively — the webhooks net
  // Creation and the idempotency net Update — so "compacted to one Creation + one
  // Update" is distinguishable from "deleted all branch lifecycle entries".
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === 'webhooks-creation'),
    'the compaction case must positively prove the webhooks net Creation survived',
  );
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === 'idem-branch-update'),
    'the compaction case must positively prove the idempotency net Update survived',
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
  // concept while the dated old/new value fact is folded into the live prose that
  // PRECEDES `# Amendments` — `## 2026-07-23` must be absent, and the date, the
  // OLD value (16-char) and the NEW value (UUID) must each appear before the
  // `# Amendments` heading (ordered containment), proving "folded into canonical
  // prose" rather than orphaned in the now-heading-less Amendments region.
  assert.ok(
    has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/decisions/idempotency.md' && a.value === '## 2026-07-23'),
    'the compaction case must prove the branch-local amendment heading is removed',
  );
  const foldedBeforeAmendments = (value) =>
    has(
      (a) =>
        a.type === 'file-contains-ordered' &&
        a.path === 'docs/payments/decisions/idempotency.md' &&
        Array.isArray(a.values) &&
        a.values[0] === value &&
        a.values[a.values.length - 1] === '# Amendments',
    );
  assert.ok(foldedBeforeAmendments('2026-07-23'), 'the dated fact must be folded into prose above # Amendments');
  assert.ok(foldedBeforeAmendments('16-char'), 'the OLD value must survive the fold, above # Amendments');
  assert.ok(foldedBeforeAmendments('UUID'), 'the NEW value must survive the fold, above # Amendments');
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

  // The confirmation must be a BARE go-ahead: it may name the user-owned
  // replacement PATH but must NOT dictate the supersession MECHANISM, so the
  // linked-supersession assertions test what the skill DERIVED, not a procedure
  // the user spelled out. (Undoing the fixed-point wording that said "mark the
  // old one superseded and linked ... record the deprecation ... keep content
  // intact".)
  const confirm = c.followUpPrompts[0];
  assert.doesNotMatch(confirm, /supersed/i, 'confirm.md must not dictate the supersession mechanism');
  assert.doesNotMatch(confirm, /deprecat/i, 'confirm.md must not dictate logging a Deprecation');
  assert.doesNotMatch(confirm, /\blink/i, 'confirm.md must not dictate the supersede link');

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

test('the reversal-gate case loads single-turn and proves autonomous recognition without a silent edit', async () => {
  const c = await loadCase('docs-sync-reversal-gate', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  const has = (pred) => c.assertions.some(pred);

  // Autonomy: this case must be SINGLE-turn — no follow-up may script the pause.
  // The prompt must merely ask to reconcile (same framing as docs-sync-reconcile)
  // and must NOT name "supersede", "reversal", or ask the model to "wait"/pause,
  // so any supersession the run surfaces is the skill's own recognition.
  assert.equal(c.followUpPrompts.length, 0, 'the reversal gate must be a single autonomous turn');
  assert.doesNotMatch(c.prompt, /supersed/i, 'the gate prompt must not name supersession');
  assert.doesNotMatch(c.prompt, /reversal/i, 'the gate prompt must not name the reversal');
  assert.doesNotMatch(c.prompt, /wait for|go-ahead|do not change|confirm/i, 'the gate prompt must not script the pause');

  // Shares the write-path baseline (same accepted PostgreSQL decision + unstaged
  // Redis reversal), so the only difference is prompt + assertions.
  const storage = 'docs/payments/decisions/token-store.md';
  const replacement = 'docs/payments/decisions/token-store-redis.md';

  // AC7 (no silent edit) — the accepted decision is UNCHANGED without
  // confirmation: original selected alternative retained, not superseded.
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === storage && a.value === 'selected-postgres'),
    'the gate must prove the accepted decision was not silently rewritten',
  );
  assert.ok(has((a) => a.type === 'file-not-contains' && a.path === storage && a.value === 'status: superseded'));

  // AC7 (requires confirmation) — nothing belonging to the supersession is
  // written before the user confirms: no replacement decision, no Deprecation.
  assert.ok(
    has((a) => a.type === 'file-absent' && a.path === replacement),
    'the gate must prove no replacement is filed before confirmation',
  );
  assert.ok(has((a) => a.type === 'file-not-contains' && a.path === 'docs/payments/log.md' && a.value === '**Deprecation**'));

  // Autonomous recognition — single-turn output shows the skill surfaced the
  // supersession though the prompt never named it.
  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'supersed'));

  assert.ok(has((a) => a.type === 'portable-contract'));

  // buildFixture projects docs-sync with its docs-validate closure over the same
  // unstaged source reversal the write-path case uses.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-gate-'));
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
