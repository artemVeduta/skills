// Deterministic recognition tests for the canonical docs-validate skill
// (issue #50, spec §docs-validate): the dependency graph, the static portable
// contract, the central case, and the README inventory must all recognize the
// skill. Live behavioral evidence comes from the case itself via the
// test-runner CLI; these tests are the CI-reachable deterministic layer. The
// case's scenario matrix (SCENARIOS) is the single source of truth — nothing
// here mirrors individual case assertions.
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
import { SCENARIOS } from '../tests/docs-validate/case.mjs';

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

test('the case loads, targets the skill, and its matrix covers all three exits', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  assert.equal(c.skill, 'docs-validate');
  assert.ok(c.assertions.length >= 10);
  // The validator contract has exactly three outcome classes (exit 0/1/2);
  // the matrix must exercise every one, each in its own project.
  assert.deepEqual(SCENARIOS.map((s) => s.exit).sort(), [0, 1, 2]);
  assert.equal(new Set(SCENARIOS.map((s) => s.repo)).size, 3);
  assert.equal(new Set(SCENARIOS.map((s) => s.result)).size, 3);
});

test('the fixture runs the package-manager-neutral script with no flags', async () => {
  const c = await loadCase('docs-validate', { casesRoot });
  for (const { repo } of SCENARIOS) {
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
