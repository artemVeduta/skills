// Deterministic recognition tests for the canonical docs-validate skill
// (issue #50, spec §docs-validate): the dependency graph, the static portable
// contract, the central case, and the README inventory must all recognize the
// skill. Live behavioral evidence comes from the case itself via the
// test-runner CLI; these tests are the CI-reachable deterministic layer.
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

test('the library dependency graph has docs-validate as a dependency-free node', async () => {
  const skills = await discoverSkills(skillsRoot);
  const graph = new Map(
    skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]),
  );
  assert.ok(graph.has('docs-validate'), 'docs-validate is not a library skill');
  assert.deepEqual(graph.get('docs-validate'), [], 'docs-validate must declare no required skills');
  assert.deepEqual([...transitiveClosure(graph, 'docs-validate')], ['docs-validate']);
});

test('the root README inventory lists docs-validate', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  const { warnings } = lintReadmeInventory(['docs-validate'], readme);
  assert.deepEqual(warnings.filter((w) => !w.includes('but no such skill directory')), []);
});

test('the docs-validate case loads and targets the right skill', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  assert.equal(c.skill, 'docs-validate');
  assert.ok(c.assertions.length >= 10);
});

test('the case declares the warning, error, and malfunction scenarios', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  const contains = (path, value) =>
    c.assertions.some((a) => a.type === 'file-contains' && a.path === path && a.value === value);
  assert.ok(contains('warn-repo/OUTCOME.md', 'RESULT: CLEAN-OR-WARNINGS'));
  assert.ok(contains('warn-repo/OUTCOME.md', 'EXIT: 0'));
  assert.ok(contains('error-repo/OUTCOME.md', 'RESULT: HARD-ERRORS'));
  assert.ok(contains('error-repo/OUTCOME.md', 'EXIT: 1'));
  assert.ok(contains('broken-repo/OUTCOME.md', 'RESULT: MALFUNCTION'));
  assert.ok(contains('broken-repo/OUTCOME.md', 'EXIT: 2'));
});

test('the error scenario reports both classes, errors and warnings', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  const contains = (value) =>
    c.assertions.some((a) => a.type === 'file-contains' && a.path === 'error-repo/OUTCOME.md' && a.value === value);
  assert.ok(contains('ERROR: '), 'error scenario must surface an ERROR line');
  assert.ok(contains('WARNING: '), 'error scenario must surface a WARNING line');
});

test('the case proves the skill never edits bundles or machinery', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  const byType = (type) => c.assertions.filter((a) => a.type === type);
  // The warning stays a warning: no recommended field gets "helpfully" added.
  assert.ok(byType('file-not-contains').some((a) => a.path === 'warn-repo/docs/notes.md' && a.value === 'title:'));
  // The hard error stays broken: no frontmatter fence gets added.
  assert.ok(byType('file-not-contains').some((a) => a.path === 'error-repo/docs/broken.md' && a.value === '---'));
  // The unindexed concept stays unindexed: no coverage "repair".
  assert.ok(byType('file-not-contains').some((a) => a.path === 'error-repo/docs/index.md' && a.value === 'extra.md'));
  // The malfunction stays a malfunction: no docs root gets created.
  assert.ok(byType('file-absent').some((a) => a.path === 'broken-repo/docs/index.md'));
});

test('the case gates the static portable contract on live legs', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  assert.ok(c.assertions.some((a) => a.type === 'portable-contract'));
});

test('the prompt drives all three scenarios and forbids repairs', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  assert.match(c.prompt, /warn-repo/);
  assert.match(c.prompt, /error-repo/);
  assert.match(c.prompt, /broken-repo/);
  assert.match(c.prompt, /do NOT edit/i);
});

test('the fixture runs the package-manager-neutral script with no flags', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  for (const repo of ['warn-repo', 'error-repo', 'broken-repo']) {
    const pkg = c.inputs.find((i) => i.path === `${repo}/package.json`);
    assert.ok(pkg, `${repo} has no package.json input`);
    assert.equal(JSON.parse(pkg.content).scripts['docs:validate'], 'node scripts/validate-docs.mjs');
    const validator = c.inputs.find((i) => i.path === `${repo}/scripts/validate-docs.mjs`);
    assert.ok(validator, `${repo} has no validator input`);
    assert.equal(
      validator.content,
      await readFile(join(REPO_ROOT, 'scripts/validate-docs.mjs'), 'utf8'),
      `${repo} fixture validator must be this repo's real validator bytes`,
    );
  }
});

test('the projected docs-validate pack passes the static portable contract', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dv-static-'));
  try {
    const { closure } = await buildFixture({
      skillName: 'docs-validate',
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-validate']);
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
