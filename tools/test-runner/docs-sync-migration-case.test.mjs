// Deterministic recognition tests for the docs-sync EXISTING-SOURCE MIGRATION
// subflow (issue #57, spec §docs-sync "Existing-source migration"). #54 taught
// branch-scoped reconciliation, #55 its compaction nuance, and #56 the
// bundle-wide mode; #57 extends the SAME docs-sync skill with the ONE extra
// approval gate inside sync — the migration subflow that converts durable
// documentation living OUTSIDE the OKF bundle into conformant concepts. Unlike
// ordinary reconciliation, migration can DESTRUCTIVELY change source paths
// (move/remove an imported file), so it is gated: read-only workers classify
// every candidate (keep / normalize / split / move / remove / ambiguous)
// WITHOUT writing, the coordinator presents one complete proposal (exact concept
// destinations, types, outlines, local-index entries, lifecycle entries, and
// source-path dispositions), and NOTHING is written, moved, or deleted until the
// complete proposal is approved and every ambiguity is resolved.
//
// The migration detail is factored OUT of SKILL.md into references/migration.md
// (progressive disclosure — SKILL.md was already past the 200-line soft warning;
// see superpowers:writing-skills). These tests therefore read the migration
// contract from the COMBINED SKILL.md + reference text, and separately assert
// that SKILL.md carries a migration section and points at the relative support
// file. They are the CI-reachable deterministic layer (run by `npm test`); they
// never run a model. Live behavioural evidence comes from five sibling cases via
// the test-runner CLI, all projecting the real docs-sync skill:
//   - docs-sync-migrate-classify: read-only classification, a complete proposal,
//     and a pause — NOTHING written before approval (git-unchanged);
//   - docs-sync-migrate-deny: a denied proposal leaves every source + bundle file
//     unchanged (git-unchanged);
//   - docs-sync-migrate: an approved import whose source KEEPS its pointer because
//     deletion was not approved (git-uncommitted, the note still present);
//   - docs-sync-migrate-split-overview: an approved split whose source stays as a
//     concise conformant overview / stable entry point (git-uncommitted, present);
//   - docs-sync-migrate-split-remove: an approved split whose source removal is
//     recorded as part of the migration (git-uncommitted, the note absent).
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

// buildFixture + portable-contract over a case's inputs, shared by every case
// check below: the migration subflow projects the SAME docs-sync + docs-validate
// closure as every other docs-sync case, and the projected pack must pass the
// static shared-reader contract (which now includes the references/ support file).
async function projectAndCheck(c, prefix) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), prefix));
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
}

test('SKILL.md carries a migration section and points at the relative reference file', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');

  // Discovery surface — the DESCRIPTION frontmatter must advertise migration, so a
  // request framed as "migrate my existing docs" / "convert these notes into the
  // bundle" (no branch/bundle framing) still surfaces docs-sync. Parse the
  // description explicitly so a body mention cannot vacuously satisfy this.
  const fm = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'SKILL.md must open with YAML frontmatter');
  const descLine = fm[1].match(/^description:\s*(.*)$/m);
  assert.ok(descLine, 'SKILL.md frontmatter must carry a description');
  assert.match(
    descLine[1],
    /migrat/i,
    'the description must advertise the migration subflow so a migrate-framed request surfaces docs-sync',
  );

  // A dedicated migration section exists — the subflow is a first-class part of
  // the docs-sync contract, not a stray sentence.
  assert.match(skill, /^#+.*migration/im, 'SKILL.md needs a dedicated migration section');

  // Progressive disclosure: the migration detail lives in a self-relative support
  // file SKILL.md points at (NOT an absolute path, which would break once the pack
  // is projected elsewhere — the static portable contract also enforces this).
  assert.match(
    skill,
    /references\/migration\.md/,
    'SKILL.md must point at the relative references/migration.md support file',
  );
  assert.doesNotMatch(
    skill,
    /\]\(\/[^)]*migration\.md\)/,
    'the migration reference must be linked relatively, never as an absolute path',
  );

  // The support file exists and is non-trivial (heavy reference factored out).
  const ref = await readFile(join(skillDir, 'references/migration.md'), 'utf8');
  assert.ok(ref.length > 400, 'references/migration.md must carry the migration contract detail');
});

test('the migration contract documents all nine #57 criteria (SKILL.md + reference)', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  const ref = await readFile(join(skillDir, 'references/migration.md'), 'utf8');
  // The contract may live in either file (SKILL.md summarizes, the reference
  // details); grep the combined text so factoring detail out does not fail a
  // criterion that legitimately moved into the reference.
  const doc = `${skill}\n${ref}`;

  // AC1 — read-only workers classify EVERY candidate as one of the six labels
  // WITHOUT writing.
  assert.match(doc, /read-only/i);
  assert.match(doc, /classif/i);
  assert.match(doc, /\bkeep\b/i);
  assert.match(doc, /normaliz/i);
  assert.match(doc, /\bsplit\b/i);
  assert.match(doc, /\bmove\b/i);
  assert.match(doc, /\bremove\b/i);
  assert.match(doc, /ambiguous/i);
  assert.match(doc, /write nothing|without writing|no (file|concept) is written/i);

  // AC2 — the proposal is COMPLETE: concept destinations, types, outlines,
  // local-index entries, lifecycle entries, and source-path dispositions.
  assert.match(doc, /destination/i);
  assert.match(doc, /\btype/i);
  assert.match(doc, /outline/i);
  assert.match(doc, /index entr|local[- ]index/i);
  assert.match(doc, /lifecycle entr/i);
  assert.match(doc, /source-path disposition|source disposition|disposition/i);

  // AC3 — NO concept write, move, or deletion begins until the COMPLETE proposal
  // is approved AND every ambiguity is resolved.
  assert.match(doc, /(no|nothing)[^.\n]*(write|move|deletion|delet)/i);
  assert.match(doc, /approv/i);
  assert.match(doc, /every ambiguit|all ambiguit|each ambiguit/i);
  assert.match(doc, /resolv/i);

  // AC4 — approved writers own NON-OVERLAPPING concepts; ONLY the reconciler
  // changes shared indexes, logs, and timestamps.
  assert.match(doc, /non-overlapping|disjoint/i);
  assert.match(doc, /reconciler/i);
  assert.match(doc, /index/i);
  assert.match(doc, /log/i);
  assert.match(doc, /timestamp/i);

  // AC5 — an imported source KEEPS its existing pointer unless deletion is
  // explicitly approved.
  assert.match(doc, /pointer/i);
  assert.match(doc, /unless[^.\n]*deletion|deletion[^.\n]*approved|explicitly approved/i);

  // AC6 — a split source remains a concise conformant OVERVIEW only when approved
  // as a stable entry point; otherwise its approved REMOVAL is recorded.
  assert.match(doc, /overview/i);
  assert.match(doc, /stable[^.\n]*entry point|entry point/i);
  assert.match(doc, /removal[^.\n]*record|record[^.\n]*removal|approved removal/i);

  // AC7 — verification checks every approved SOURCE DISPOSITION as well as the
  // resulting concepts and validation state.
  assert.match(doc, /verif/i);
  assert.match(doc, /disposition/i);
  assert.match(doc, /resulting concept|the resulting|concepts/i);
  assert.match(doc, /validat/i);

  // AC8 — denied approval leaves ALL source and bundle files unchanged; partial
  // write failure reports the EXACT state without destructive rollback.
  assert.match(doc, /denied|denial|declin/i);
  assert.match(doc, /unchanged/i);
  assert.match(doc, /partial/i);
  assert.match(doc, /(no|without|never)[^.\n]*(destructive )?rollback/i);

  // AC9 — the migration workflow NEVER stages, commits, pushes, or opens a PR.
  assert.match(doc, /stage|staging/i);
  assert.match(doc, /commit/i);
  assert.match(doc, /push/i);
  assert.match(doc, /pull request|PR/i);
});

test('the classify case loads single-turn and proves read-only classification with no writes', async () => {
  const c = await loadCase('docs-sync-migrate-classify', { casesRoot });
  // The directory is docs-sync-migrate-classify; the manifest projects the real
  // docs-sync skill so one skill carries the #54/#55/#56 cases and this #57 case.
  assert.equal(c.skill, 'docs-sync');

  // Read-only proof: this case is SINGLE-turn (no follow-up scripts an approval),
  // so a correct run classifies + proposes + PAUSES, writing nothing.
  assert.equal(c.followUpPrompts.length, 0, 'the classify case must be a single read-only turn');

  const has = (pred) => c.assertions.some(pred);

  // AC1/AC3 headline — with no approval, NOTHING is written: git-unchanged proves
  // the tree sits exactly at the baseline commit (no concept written, staged, or
  // committed) during classification.
  assert.ok(
    has((a) => a.type === 'git-unchanged'),
    'the classify case must assert git-unchanged (read-only classification, no writes)',
  );

  // The candidate ad-hoc doc is byte-preserved during classification (a read-only
  // worker must not touch it).
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'notes/retry-design.md' && a.value === 'note-retry-design'),
    'the classify case must prove the candidate source was left byte-preserved',
  );

  // No concept was filed before approval — the proposed destination is still
  // absent (a run that wrote during classification would create it).
  assert.ok(
    has((a) => a.type === 'file-absent' && a.path === 'docs/payments/specs/retries.md'),
    'the classify case must prove no concept was written before approval',
  );

  // Live evidence the run engaged the migration subflow (not branch/bundle mode).
  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'migrat'));
  assert.ok(has((a) => a.type === 'portable-contract'));

  await projectAndCheck(c, 'dsync-migrate-classify-');
});

test('the deny case gates behind one turn and proves a denied proposal leaves everything unchanged', async () => {
  const c = await loadCase('docs-sync-migrate-deny', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  // The proposal is presented in turn 1; exactly one follow-up DENIES it.
  assert.equal(c.followUpPrompts.length, 1, 'the deny case must present a proposal then take one denial turn');
  assert.match(c.followUpPrompts[0], /\b(no|don't|do not|deny|cancel|stop)\b/i, 'the follow-up must deny the proposal');

  const has = (pred) => c.assertions.some(pred);

  // AC8 — a denied proposal leaves ALL source and bundle files unchanged:
  // git-unchanged proves the tree sits exactly at the baseline commit.
  assert.ok(
    has((a) => a.type === 'git-unchanged'),
    'the deny case must assert git-unchanged (denied approval leaves everything unchanged)',
  );
  // Both a source file and a bundle file are byte-preserved after the denial.
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'notes/retry-design.md' && a.value === 'note-retry-design'),
    'the deny case must prove the candidate source is unchanged after denial',
  );
  assert.ok(
    has((a) => a.type === 'file-absent' && a.path === 'docs/payments/specs/retries.md'),
    'the deny case must prove no concept was written after denial',
  );
  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'migrat'));
  assert.ok(has((a) => a.type === 'portable-contract'));

  await projectAndCheck(c, 'dsync-migrate-deny-');
});

test('the import case gates behind approval and proves an imported source keeps its pointer', async () => {
  const c = await loadCase('docs-sync-migrate', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  // Turn 1 proposes and PAUSES; exactly one follow-up APPROVES the import without
  // approving deletion, so the write only happens after approval.
  assert.equal(c.followUpPrompts.length, 1, 'the import case must be gated behind one approval turn');
  // The approval must NOT dictate keeping the file (that is the skill's own AC5
  // rule): it may approve the import but must not spell out "keep the note".
  assert.doesNotMatch(
    c.followUpPrompts[0],
    /keep (the )?(note|source|file|pointer)/i,
    'the approval must not dictate keeping the source — that is the skill deriving AC5',
  );

  const has = (pred) => c.assertions.some(pred);

  // AC (write path): the approved import legitimately dirties the tree, so
  // git-uncommitted proves HEAD is still the baseline, nothing staged, no remote.
  assert.ok(
    has((a) => a.type === 'git-uncommitted'),
    'the import case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );

  // The concept was filed from the note (absent at baseline) and cites the source.
  assert.ok(
    has((a) => a.type === 'file-exists' && a.path === 'docs/payments/specs/retries.md'),
    'the import case must prove the concept was filed from the imported source',
  );
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/specs/retries.md' && a.value === 'type: Specification'),
  );
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/specs/retries.md' && a.value === 'MAX_RETRIES'),
    'the imported concept must cite the source symbol, not paste executable truth',
  );

  // AC5 discriminator — the imported source KEEPS its pointer: deletion was NOT
  // approved, so the note still exists at its original path (a run that deleted it
  // would break AC5). Its content is preserved (it remains a valid pointer target).
  assert.ok(
    has((a) => a.type === 'file-exists' && a.path === 'notes/retry-design.md'),
    'the import case must prove the imported source keeps its pointer (not deleted)',
  );

  // The single reconciler registered the concept in the subsystem index and logged
  // its lifecycle entry (retries absent from both at baseline).
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/index.md' && a.value === 'retries.md'),
    'the import case must prove the reconciler registered the concept in its parent index',
  );
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === '**Creation**'),
  );
  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'migrat'));
  assert.ok(has((a) => a.type === 'portable-contract'));

  await projectAndCheck(c, 'dsync-migrate-');
});

test('the split-overview case proves a split source kept as a stable overview entry point', async () => {
  const c = await loadCase('docs-sync-migrate-split-overview', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  // Gated behind one approval turn; the approval names keeping the source as an
  // entry point (the user's decision AC6 keys on), not the split MECHANISM.
  assert.equal(c.followUpPrompts.length, 1, 'the split-overview case must be gated behind one approval turn');

  const has = (pred) => c.assertions.some(pred);

  assert.ok(
    has((a) => a.type === 'git-uncommitted'),
    'the split-overview case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );

  // The multi-topic source is split into two concepts (both absent at baseline).
  assert.ok(has((a) => a.type === 'file-exists' && a.path === 'docs/payments/specs/retries.md'));
  assert.ok(has((a) => a.type === 'file-exists' && a.path === 'docs/payments/specs/refunds.md'));

  // AC6 (overview kept) — the source REMAINS at its path as a stable entry point
  // (a split that removed it would fail this), and it now points INTO the bundle
  // at one of the new concepts (it was a standalone note at baseline, so a link to
  // specs/retries.md proves it was rewritten into a conformant overview).
  assert.ok(
    has((a) => a.type === 'file-exists' && a.path === 'notes/payments-guide.md'),
    'the split-overview case must prove the source is kept as a stable entry point',
  );
  assert.ok(
    has((a) => a.type === 'file-contains' && a.path === 'notes/payments-guide.md' && /specs\/(retries|refunds)\.md/.test(a.value)),
    'the kept overview must point into the bundle at the new concepts',
  );

  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'migrat'));
  assert.ok(has((a) => a.type === 'portable-contract'));

  await projectAndCheck(c, 'dsync-migrate-split-ov-');
});

test('the split-remove case proves a split source removal is recorded as part of the migration', async () => {
  const c = await loadCase('docs-sync-migrate-split-remove', { casesRoot });
  assert.equal(c.skill, 'docs-sync');

  // Gated behind one approval turn that approves removing the source.
  assert.equal(c.followUpPrompts.length, 1, 'the split-remove case must be gated behind one approval turn');

  const has = (pred) => c.assertions.some(pred);

  assert.ok(
    has((a) => a.type === 'git-uncommitted'),
    'the split-remove case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );

  // Split into two concepts, same as the overview case.
  assert.ok(has((a) => a.type === 'file-exists' && a.path === 'docs/payments/specs/retries.md'));
  assert.ok(has((a) => a.type === 'file-exists' && a.path === 'docs/payments/specs/refunds.md'));

  // AC6 (approved removal) — the source is REMOVED (absent), the discriminator vs
  // the overview sibling, and its removal is recorded in the run's report.
  assert.ok(
    has((a) => a.type === 'file-absent' && a.path === 'notes/payments-guide.md'),
    'the split-remove case must prove the source was removed after approval',
  );
  assert.ok(
    has((a) => a.type === 'output-contains' && a.value === 'remov'),
    'the split-remove case must prove the removal was recorded as part of the migration',
  );

  assert.ok(has((a) => a.type === 'output-contains' && a.value === 'migrat'));
  assert.ok(has((a) => a.type === 'portable-contract'));

  await projectAndCheck(c, 'dsync-migrate-split-rm-');
});
