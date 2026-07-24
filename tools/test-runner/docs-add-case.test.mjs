// Deterministic recognition tests for the canonical docs-add skill (issue #51,
// spec §docs-add). The dependency graph, the README inventory, the central
// case shape, the self-relative templates, and the strict validator must all
// recognize the skill and its guarantees. Live behavioral evidence (the
// approval gate; nothing written/staged/committed on denial) comes from the
// case itself via the test-runner CLI; these tests are the CI-reachable
// deterministic layer and never run a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { loadCase } from './case-loader.mjs';
import { buildFixture } from './fixture.mjs';
import { checkPortableContract } from './static-contract.mjs';
import { discoverSkills, stripFrontmatter } from '../../scripts/install/discovery.mjs';
import { parseRequiredSkills, transitiveClosure } from '../skill-graph.mjs';
import { lintReadmeInventory } from '../lint-skills.mjs';
import { parseFrontmatter, validateConcept } from '../../scripts/validate-docs.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');
const skillsRoot = join(REPO_ROOT, 'skills');
const skillDir = join(skillsRoot, 'docs-add');
const templatesDir = join(skillDir, 'templates');

// The five concept types docs-add scaffolds. subsystem-index is a reserved
// index node (validated separately — a non-root index carries no frontmatter).
const CONCEPT_TEMPLATES = ['decision', 'specification', 'convention', 'glossary', 'reference'];

// Turn every <placeholder> into a concrete value so a template becomes a
// filed concept. Timestamp first (needs a real ISO date), then any remaining
// single-line <...> placeholder; the multi-line HTML comment in decision.md
// has no closing `>` on its opening line, so `[^>\n]` leaves it intact.
function fill(text) {
  return text.replaceAll('<YYYY-MM-DD>', '2026-07-24').replace(/<[^>\n]+>/g, 'Sample');
}

test('the library dependency graph has docs-add as a dependency-free node', async () => {
  const skills = await discoverSkills(skillsRoot);
  const graph = new Map(skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]));
  assert.ok(graph.has('docs-add'), 'docs-add is not a library skill');
  assert.deepEqual(graph.get('docs-add'), [], 'docs-add must declare no required skills');
  assert.deepEqual([...transitiveClosure(graph, 'docs-add')], ['docs-add']);
});

test('the root README inventory lists docs-add', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  const { warnings } = lintReadmeInventory(['docs-add'], readme);
  assert.deepEqual(warnings.filter((w) => !w.includes('but no such skill directory')), []);
});

test('docs-add owns its templates self-relatively under templates/', async () => {
  const names = (await readdir(templatesDir)).sort();
  for (const t of [...CONCEPT_TEMPLATES, 'subsystem-index']) {
    assert.ok(names.includes(`${t}.md`), `missing template ${t}.md`);
  }
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  const { body } = parseFrontmatter(skill);
  // Self-relative reference (progressive disclosure); never a root-anchored path.
  assert.match(body, /templates\//);
  assert.doesNotMatch(body, /\]\(\/[^)]*\)/, 'SKILL.md must not use absolute Markdown link targets');
});

test('every scaffolded concept template validates as a conformant concept', async () => {
  for (const t of CONCEPT_TEMPLATES) {
    const text = fill(await readFile(join(templatesDir, `${t}.md`), 'utf8'));
    const { errors } = validateConcept(`${t}.md`, text);
    assert.deepEqual(errors, [], `${t}.md scaffolds a concept with hard errors: ${errors.join('; ')}`);
    const fm = parseFrontmatter(text);
    assert.ok(fm.ok && typeof fm.data.type === 'string' && fm.data.type.trim() !== '', `${t}.md lacks a non-empty type`);
  }
});

test('the subsystem-index template is a reserved index node (no frontmatter)', async () => {
  const text = await readFile(join(templatesDir, 'subsystem-index.md'), 'utf8');
  assert.equal(parseFrontmatter(text).ok, false, 'a non-root index.md must carry no frontmatter');
});

test('the 300-physical-line threshold is a review cue, not a validator rule', () => {
  // A conformant concept of 300+ physical lines must validate with NO hard
  // error and NO size/line warning: the keep-or-split review is semantic and
  // lives in the approval plan, never in the validator (spec §docs-add, AC6).
  const body = Array.from({ length: 320 }, (_, i) => `Line ${i + 1} of a long but atomic bounded report.`).join('\n');
  const text = `---\ntype: Reference\ntitle: Long report\ndescription: An atomic bounded report.\ntimestamp: 2026-07-24\n---\n\n# Long report\n\n${body}\n`;
  assert.ok(text.split('\n').length >= 300);
  const { errors, warnings } = validateConcept('long.md', text);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => /\bline\b|\bsize\b|\b300\b|too long|split/i.test(w)), []);
});

test('the SKILL.md documents the v2 direct-creation contract', async () => {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  // Reads the lifecycle policy before proposing (AC2).
  assert.match(skill, /documentation\.md/);
  // Accepts a prepared complete concept OR content to scaffold (AC3).
  assert.match(skill, /prepared/i);
  assert.match(skill, /scaffold/i);
  // The one approval plan carries all five elements (AC4).
  for (const part of [/frontmatter/i, /body/i, /path/i, /index/i, /log\.md|lifecycle/i]) {
    assert.match(skill, part);
  }
  // A parent workflow's equivalent approval is reused, not requested twice (AC5).
  assert.match(skill, /parent workflow/i);
  assert.match(skill, /(not|never)[^.]*(twice|again|re-?ask)/i);
  // The 300-line semantic keep-or-split review, recorded in the plan (AC6).
  assert.match(skill, /300/);
  assert.match(skill, /split/i);
  // Validates and reads back the result (AC8).
  assert.match(skill, /read[ -]?back/i);
  // Leaves staging, commits, remotes, and pull requests unchanged (AC8).
  assert.match(skill, /stage|staging/i);
  assert.match(skill, /commit/i);
});

test('the case loads, targets docs-add, and proves the gate on the deny turn', async () => {
  const c = await loadCase('docs-add', { casesRoot });
  assert.equal(c.skill, 'docs-add');
  // One follow-up turn: turn 1 proposes and pauses; the follow-up denies.
  assert.equal(c.followUpPrompts.length, 1);
  const types = c.assertions.map((a) => a.type);
  // git-unchanged is the headline: on denial nothing is written, staged, or
  // committed (AC7 gate + AC8 leaves staging/commits/remotes/PRs unchanged).
  assert.ok(types.includes('git-unchanged'), 'the deny case must assert git-unchanged');
  // The proposed concept must NOT have been created without approval.
  assert.ok(c.assertions.some((a) => a.type === 'file-absent'), 'the deny case must assert the concept is absent');
  // Static shared-reader contract over the projected pack (AC1).
  assert.ok(types.includes('portable-contract'));
});

test('the projected docs-add pack passes the static portable contract', async () => {
  const c = await loadCase('docs-add', { casesRoot });
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'da-static-'));
  try {
    const { closure } = await buildFixture({
      skillName: 'docs-add',
      skillsRoot,
      driver: { discoverySubdir: '.claude/skills' },
      fixtureRoot,
      inputs: c.inputs,
    });
    assert.deepEqual(closure, ['docs-add'], 'docs-add projects with no dependency closure');
    const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
    assert.deepEqual(errors, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
