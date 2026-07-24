// Deterministic recognition tests for the canonical docs-sync skill (issue #54,
// spec §docs-sync, BRANCH mode). docs-sync is the first end-to-end tracer for
// branch-scoped semantic reconciliation: it is top-level, declares docs-validate
// as its one Required skill (a canonical-name dep), asks for the sync mode and a
// target branch before writing anything, scopes from the target's merge-base
// through the complete working state, fans out to DISJOINT concept owners with
// ONE reconciler for indexes/logs/timestamps, verifies with a fresh checker,
// interprets the strict validator, and never touches Git state.
//
// Live behavioral evidence comes from the two sibling cases via the test-runner
// CLI: docs-sync proves the MODE/TARGET gate (nothing written before the user
// selects branch mode AND a target branch — git-unchanged), and
// docs-sync-reconcile proves the GENUINE reconcile write path — a branch whose
// source diverged from the docs gets its current truth updated to cite the new
// symbol and its nearest log gains one Update, all in the working tree only
// (git-uncommitted). These tests are the CI-reachable deterministic layer and
// never run a model. Bundle-wide reconciliation (#56), compaction nuance (#55),
// and the migration subflow (#57) are out of scope here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { loadCase } from './case-loader.mjs';
import { buildFixture } from './fixture.mjs';
import { checkPortableContract } from './static-contract.mjs';
import { discoverSkills, stripFrontmatter } from '../../scripts/install/discovery.mjs';
import { parseRequiredSkills, transitiveClosure } from '../skill-graph.mjs';
import { lintReadmeInventory } from '../lint-skills.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');
const skillsRoot = join(REPO_ROOT, 'skills');
const skillDir = join(skillsRoot, 'docs-sync');

test('docs-sync declares docs-validate as its one Required skill (canonical-name dep)', async () => {
  const skills = await discoverSkills(skillsRoot);
  const graph = new Map(skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]));
  assert.ok(graph.has('docs-sync'), 'docs-sync is not a library skill');
  assert.deepEqual([...graph.get('docs-sync')].sort(), ['docs-validate']);
  // The whole closure is discoverable — no missing dependency node.
  assert.deepEqual([...transitiveClosure(graph, 'docs-sync')].sort(), ['docs-sync', 'docs-validate']);
});

test('the root README inventory lists docs-sync', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  const { warnings } = lintReadmeInventory(['docs-sync'], readme);
  assert.deepEqual(warnings.filter((w) => !w.includes('but no such skill directory')), []);
});

test('the SKILL.md documents the v2 branch-sync contract (all ten acceptance criteria)', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');

  // AC1 — top-level, asks for the sync MODE and a TARGET BRANCH before any write.
  // Anchor on the specific two-mode ask (subsumes the bare "branch"/"bundle-wide"
  // word checks) and the actual no-write-before-gate clause, not any prose.
  assert.match(skill, /branch sync or bundle-wide/i);
  assert.match(skill, /target branch/i);
  assert.match(skill, /write nothing|no file is written/i);

  // AC2 — scope begins at the target's common ancestor (merge-base) and spans
  // committed, staged, unstaged, and relevant untracked state.
  assert.match(skill, /merge-base|common ancestor/i);
  assert.match(skill, /committed/i);
  assert.match(skill, /staged/i);
  assert.match(skill, /unstaged/i);
  assert.match(skill, /untracked/i);

  // AC3 — docs-only branches reconcile; ignored/temporary material is excluded.
  assert.match(skill, /docs-only/i);
  assert.match(skill, /ignored/i);
  assert.match(skill, /temporary/i);

  // AC4 — branch-affected current AND explanatory truth is reconciled; unrelated
  // target drift is reported SEPARATELY and byte-preserved.
  assert.match(skill, /current truth/i);
  assert.match(skill, /explanatory truth/i);
  assert.match(skill, /unrelated/i);
  assert.match(skill, /drift/i);
  assert.match(skill, /separate/i);
  assert.match(skill, /byte-preserv|preserv/i);

  // AC5 — dynamic fanout assigns DISJOINT concept ownership; ONE reconciler
  // writes indexes, logs, and timestamps.
  assert.match(skill, /fanout/i);
  assert.match(skill, /disjoint/i);
  assert.match(skill, /(one|single|sole)[^.\n]*reconciler/i);
  // Anchor the shared-bookkeeping writers on the concrete reserved filenames,
  // not any occurrence of the words "index"/"log".
  assert.match(skill, /index\.md|indexes/i);
  assert.match(skill, /log\.md|logs\b/i);
  assert.match(skill, /timestamp/i);

  // AC6 — contradictory authoritative sources stop only the affected claim and
  // produce a precise user blocker rather than a guess.
  assert.match(skill, /contradict/i);
  assert.match(skill, /block/i);
  assert.match(skill, /(never|not|no)[^.\n]*guess/i);

  // AC7 — a fresh verifier checks source truth, complete scope, ownership,
  // lifecycle bookkeeping, validation, and Git-state preservation.
  assert.match(skill, /verif/i);
  assert.match(skill, /complete scope/i);
  assert.match(skill, /ownership/i);
  assert.match(skill, /lifecycle/i);
  assert.match(skill, /validat/i);

  // AC8 — warning-only validation permits success; hard errors or validator
  // malfunction prevent success (the strict 0/1/2 contract).
  assert.match(skill, /warning/i);
  assert.match(skill, /hard error|exit\s*`?1`?/i);
  assert.match(skill, /malfunction|exit\s*`?2`?/i);

  // AC9 — idempotent: the same sync from the same boundary changes nothing after
  // the first successful run.
  assert.match(skill, /idempoten/i);
  assert.match(skill, /(twice|again|second run|recompute)/i);

  // AC10 — never stages, commits, pushes, opens a PR, or changes a remote.
  assert.match(skill, /stage|staging/i);
  assert.match(skill, /commit/i);
  assert.match(skill, /push/i);
  assert.match(skill, /pull request|PR/i);
  assert.match(skill, /remote/i);
});

test('the gate case loads, targets docs-sync, and proves no write before mode + target selection', async () => {
  const c = await loadCase('docs-sync', { casesRoot });
  assert.equal(c.skill, 'docs-sync');
  // Turn 1 asks for the mode and a target branch and pauses; the follow-up
  // withholds selection (cancels), so the gate is observable on a no-write path.
  assert.equal(c.followUpPrompts.length, 1);
  const types = c.assertions.map((a) => a.type);
  // git-unchanged is the headline: with no mode/target selected and the request
  // cancelled, nothing is written, staged, or committed (AC1 gate + AC10).
  assert.ok(types.includes('git-unchanged'), 'the gate case must assert git-unchanged');
  // The stale bait concept was not edited without a selection + reconcile run.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-not-contains'),
    'the gate case must prove the bundle was not edited before mode/target selection',
  );
  // Static shared-reader contract over the projected pack.
  assert.ok(types.includes('portable-contract'));
});

test('the reconcile case loads, targets docs-sync, and proves the genuine reconcile write path', async () => {
  const c = await loadCase('docs-sync-reconcile', { casesRoot });
  // The case directory is docs-sync-reconcile; the manifest projects the real
  // docs-sync skill so one skill carries both the gate case and this case.
  assert.equal(c.skill, 'docs-sync');
  // AC10 on the WRITE path: the reconcile legitimately dirties the tree, so this
  // case asserts git-uncommitted (HEAD at baseline, nothing staged, no remote) —
  // NOT git-unchanged, which the gate case owns. A genuine write that never
  // touches Git is the guarantee here.
  assert.ok(
    c.assertions.some((a) => a.type === 'git-uncommitted'),
    'the reconcile case must assert git-uncommitted (a genuine write that leaves Git untouched)',
  );
  // AC4 discriminator: a no-op / do-nothing / unresolved-merge-base run leaves
  // 'MAX_RETRIES' absent from the stale spec, so the reconcile case must assert
  // the reconciled Specification cites the new source symbol.
  assert.ok(
    c.assertions.some(
      (a) => a.type === 'file-contains' && /specs\/retries\.md$/.test(a.path) && a.value === 'MAX_RETRIES',
    ),
    'the reconcile case must prove the stale spec was updated to cite the new source symbol',
  );
  // AC5 discriminator: the single reconciler appended exactly one Update to the
  // NEAREST log — absent at baseline.
  assert.ok(
    c.assertions.some(
      (a) => a.type === 'file-contains' && a.path === 'docs/payments/log.md' && a.value === '**Update**',
    ),
    'the reconcile case must prove the nearest log gained one Update entry',
  );
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));
  // The declared skill is the real library skill; buildFixture projects it with
  // its docs-validate closure — exactly what the CLI would run for this case.
  // The fixture carries the branch's unstaged source bump (an `uncommitted`
  // input), so buildFixture leaves a genuinely dirty tree for the reconcile.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-'));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-sync', 'docs-validate']);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('the projected docs-sync pack passes the static portable contract', async () => {
  const c = await loadCase('docs-sync', { casesRoot });
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsync-static-'));
  try {
    const { closure } = await buildFixture({
      skillName: 'docs-sync',
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-sync', 'docs-validate'], 'docs-sync projects with its docs-validate closure');
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
