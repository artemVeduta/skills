// Deterministic recognition tests for the canonical docs-setup skill (issue #52,
// spec §docs-setup, EXPAND phase). docs-setup is the v2 setup identity: it
// declares docs-add and docs-validate as Required skills (depending on the
// canonical identities, never on filesystem paths), audits a target read-only,
// classifies a fresh state, presents one create/preserve/replace/delete plan,
// applies it through ONE deterministic writer after ONE approval, and runs a
// fresh verifier. Scope here is FRESH install only (#53 owns upgrade/repair).
//
// Live behavioral evidence comes from the two sibling cases via the test-runner
// CLI: docs-setup proves the approval GATE (nothing written/staged/committed on
// denial) and docs-setup-approve proves the primary fresh install (validator +
// tests, package scripts, seed policy/reference, marked AGENTS.md router, exact
// CLAUDE.md shim). These tests are the CI-reachable deterministic layer and
// never run a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
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
const skillDir = join(skillsRoot, 'docs-setup');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('docs-setup declares docs-add and docs-validate as its Required skills', async () => {
  const skills = await discoverSkills(skillsRoot);
  const graph = new Map(skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]));
  assert.ok(graph.has('docs-setup'), 'docs-setup is not a library skill');
  assert.deepEqual([...graph.get('docs-setup')].sort(), ['docs-add', 'docs-validate']);
  // The whole suite closure is discoverable — no missing dependency node.
  assert.deepEqual(
    [...transitiveClosure(graph, 'docs-setup')].sort(),
    ['docs-add', 'docs-setup', 'docs-validate'],
  );
});

test('the root README inventory lists docs-setup', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  const { warnings } = lintReadmeInventory(['docs-setup'], readme);
  assert.deepEqual(warnings.filter((w) => !w.includes('but no such skill directory')), []);
});

test('docs-setup ships the verbatim validator machinery, byte-identical to the authoritative copy', async () => {
  const authoritative = await readFile(join(REPO_ROOT, 'scripts/validate-docs.mjs'), 'utf8');
  const authoritativeTest = await readFile(join(REPO_ROOT, 'scripts/validate-docs.test.mjs'), 'utf8');
  const asset = await readFile(join(skillDir, 'assets/scripts/validate-docs.mjs'), 'utf8');
  const assetTest = await readFile(join(skillDir, 'assets/scripts/validate-docs.test.mjs'), 'utf8');
  assert.equal(asset, authoritative, 'the shipped validator must be byte-identical to scripts/validate-docs.mjs');
  assert.equal(assetTest, authoritativeTest, 'the shipped validator test must be byte-identical to scripts/validate-docs.test.mjs');
});

test('docs-setup seeds the policy, reference, and bundle skeleton it installs', async () => {
  for (const rel of [
    'assets/docs/index.md',
    'assets/docs/log.md',
    'assets/docs/conventions/documentation.md',
    'assets/docs/conventions/index.md',
    'assets/docs/references/okf.md',
    'assets/docs/references/index.md',
  ]) {
    assert.ok(await exists(join(skillDir, rel)), `missing seed asset ${rel}`);
  }
});

test('docs-setup installs NO project-local helper-skill copies (AC6)', async () => {
  // v1 shipped assets/claude/skills/** and copied them into the target; v2
  // relies on the canonical docs-add / docs-validate being DISCOVERABLE, so no
  // helper-skill tree ships at all.
  assert.equal(await exists(join(skillDir, 'assets/claude/skills')), false, 'docs-setup must ship no helper-skill copies');
});

test('the SKILL.md documents the v2 fresh-setup contract', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  // Mandatory read-only audits covering the six surfaces (AC2).
  assert.match(skill, /read-only/i);
  assert.match(skill, /audit/i);
  assert.match(skill, /machinery/i);
  assert.match(skill, /package/i);
  assert.match(skill, /memory/i);
  assert.match(skill, /adapter|claude rule/i);
  assert.match(skill, /discover/i);
  assert.match(skill, /helper cop|local .* cop|stale/i);
  // Classify a fresh state and present every action class plus ambiguities (AC3).
  assert.match(skill, /fresh/i);
  assert.match(skill, /classif/i);
  for (const action of [/create/i, /preserve/i, /replace/i, /delete/i]) assert.match(skill, action);
  assert.match(skill, /ambigu/i);
  // Exactly one approval authorizes exactly one deterministic writer (AC4).
  assert.match(skill, /approval/i);
  assert.match(skill, /deterministic/i);
  assert.match(skill, /(one|single)[^.\n]*writer/i);
  assert.match(skill, /no parallel/i);
  // The fresh target receives the managed surfaces (AC5).
  assert.match(skill, /validator/i);
  assert.match(skill, /docs:validate/);
  assert.match(skill, /router|AGENTS\.md/);
  assert.match(skill, /@AGENTS\.md/);
  // No helper copies, no semantic conversion (AC6).
  assert.match(skill, /no .*(helper|conversion)|helper-skill|semantic conversion/i);
  assert.match(skill, /conversion/i);
  // A fresh verifier checks preservation, tests, validation, discovery, and an
  // idempotent no-change rerun (AC7).
  assert.match(skill, /verif/i);
  assert.match(skill, /idempoten/i);
  assert.match(skill, /preserv/i);
  // Leaves staging, commits, remotes, and pull requests unchanged (AC8).
  assert.match(skill, /stage|staging/i);
  assert.match(skill, /commit/i);
  assert.match(skill, /remote/i);
  assert.match(skill, /pull request/i);
  // A clean fresh install exits with validation success (AC8).
  assert.match(skill, /exit\s*`?0`?|validation success|validates clean/i);
});

test('the deny case loads, targets docs-setup, and proves the gate on the deny turn', async () => {
  const c = await loadCase('docs-setup', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  assert.equal(c.followUpPrompts.length, 1);
  const types = c.assertions.map((a) => a.type);
  // git-unchanged is the headline: on denial nothing is written, staged, or
  // committed (AC4 gate + AC8 leaves staging/commits/remotes/PRs unchanged).
  assert.ok(types.includes('git-unchanged'), 'the deny case must assert git-unchanged');
  // The managed machinery was never created without approval.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-absent' && a.path === 'scripts/validate-docs.mjs'),
    'the deny case must prove the validator was not installed on denial',
  );
  assert.ok(
    c.assertions.some((a) => a.type === 'file-absent' && a.path === 'docs/index.md'),
    'the deny case must prove the bundle skeleton was not created on denial',
  );
  assert.ok(types.includes('portable-contract'), 'the deny case must assert the static portable contract');
});

test('the approve case projects docs-setup and proves the fresh install produces the machinery', async () => {
  const c = await loadCase('docs-setup-approve', { casesRoot });
  assert.equal(c.skill, 'docs-setup');
  assert.equal(c.followUpPrompts.length, 1);
  // The fresh target received the verbatim validator, byte-identical to the
  // skill's own shipped asset (AC5 — the machinery fidelity headline).
  assert.ok(
    c.assertions.some(
      (a) =>
        a.type === 'file-equals' &&
        a.path === 'scripts/validate-docs.mjs' &&
        a.against === 'skills/docs-setup/assets/scripts/validate-docs.mjs',
    ),
    'the approve case must assert the installed validator is byte-identical to the docs-setup asset',
  );
  // Seed policy + reference + skeleton were installed.
  for (const p of ['docs/conventions/documentation.md', 'docs/references/okf.md', 'docs/index.md']) {
    assert.ok(
      c.assertions.some((a) => a.type === 'file-exists' && a.path === p),
      `the approve case must assert ${p} was installed`,
    );
  }
  // The two package scripts were wired in.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'package.json' && a.value.includes('docs:validate')),
    'the approve case must assert the docs:validate script was added',
  );
  // The exact Claude import shim was written after existing content was classified.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'CLAUDE.md' && a.value.includes('@AGENTS.md')),
    'the approve case must assert the CLAUDE.md shim was written',
  );
  // Unrelated pre-existing project guidance is preserved (the marked router
  // replaces idempotently and leaves everything else intact).
  assert.ok(
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'AGENTS.md'),
    'the approve case must assert AGENTS.md carries the router and/or preserved guidance',
  );
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));

  // AC8 on the WRITE path: the fresh install left staging, commits, and remotes
  // unchanged. git-unchanged is unusable here (the write dirties the tree), so
  // the case must carry its write-path counterpart, git-uncommitted.
  assert.ok(
    c.assertions.some((a) => a.type === 'git-uncommitted'),
    'the approve case must assert git-uncommitted (AC8: no staging/commit/remote on the write path)',
  );
  // AC8 validation success: the produced bundle validates fully clean. The
  // dropped `<subsystem>` placeholder removes the only broken-link warning
  // source, and the verifier reports the validator's "conformant" headline.
  assert.ok(
    c.assertions.some((a) => a.type === 'file-not-contains' && a.path === 'docs/index.md' && a.value === '<subsystem>'),
    'the approve case must assert the <subsystem> placeholder bullet was dropped',
  );
  assert.ok(
    c.assertions.some((a) => a.type === 'output-contains' && a.value === 'conformant'),
    'the approve case must assert the verifier reported a conformant bundle (AC8 validation success)',
  );

  // The declared skill projects with the full suite closure — exactly what the
  // CLI would run for this case.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'ds-approve-'));
  try {
    const { closure } = await buildFixture({
      skillName: c.skill,
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-add', 'docs-setup', 'docs-validate']);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('the projected docs-setup pack passes the static portable contract', async () => {
  const c = await loadCase('docs-setup', { casesRoot });
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'ds-static-'));
  try {
    const { closure } = await buildFixture({
      skillName: 'docs-setup',
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-add', 'docs-setup', 'docs-validate']);
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
