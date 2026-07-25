// Deterministic recognition tests for the SUITE-WIDE invocation and
// dependency-declaration contract (issue #65 Testing Decisions: "User-invocation
// contract tests prove that docs-setup and docs-sync carry user-only metadata and
// are not advertised as implicit completion steps"; "Dependency-bearing skills
// receive concise Integration sections").
//
// Every other recognition suite in this directory covers ONE case family. This
// one covers a contract that only exists ACROSS the five canonical skills: which
// of them a harness may self-select, and which must wait for the user to ask by
// name. Asserting it per-skill would leave the load-bearing property —
// that the user-only metadata sits on exactly two of five skills, so the contract
// is TARGETED rather than a blanket ban on model invocation — recorded nowhere.
//
// Live behavioral evidence is unaffected: the projected cases in
// tools/tests/docs-setup*/ and tools/tests/docs-sync*/ continue to exercise both
// user-invoked skills directly, by explicit prompt. These tests never run a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { discoverSkills } from '../../scripts/install/discovery.mjs';
import { parseFrontmatter } from '../lint-skills.mjs';
import { parseRequiredSkills } from '../skill-graph.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const skillsRoot = join(REPO_ROOT, 'skills');

// The two workflows whose cost and blast radius make implicit selection wrong:
// docs-setup makes repository-wide installation changes, docs-sync spends
// reconciliation fanout. Everything else in the suite stays model-invocable.
const USER_INVOKED = ['docs-setup', 'docs-sync'];
const MODEL_INVOCABLE = ['docs-add', 'docs-validate', 'docs-autoresearch'];

// Markdown emphasis and hard-wrapped lines are formatting, not contract. Flatten
// both before matching prose so an assertion pins the CLAIM and not the column a
// reflow happened to break at.
const flat = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ');

async function readSkills() {
  const skills = await discoverSkills(skillsRoot);
  const byName = new Map();
  for (const s of skills) {
    const fm = parseFrontmatter(s.text);
    assert.ok(fm.ok, `${s.name}/SKILL.md frontmatter did not parse: ${fm.reason}`);
    byName.set(s.name, { ...s, data: fm.data, body: fm.body });
  }
  for (const name of [...USER_INVOKED, ...MODEL_INVOCABLE]) {
    assert.ok(byName.has(name), `${name} is not a library skill — this contract has nothing to assert`);
  }
  return byName;
}

test('docs-setup and docs-sync carry the user-only invocation metadata', async () => {
  const skills = await readSkills();
  for (const name of USER_INVOKED) {
    assert.equal(
      skills.get(name).data['disable-model-invocation'],
      'true',
      `${name} must declare disable-model-invocation: true — nothing may self-select it`,
    );
  }
});

test('docs-add, docs-validate, and docs-autoresearch stay model-invocable (the user-only contract is targeted, not blanket)', async () => {
  const skills = await readSkills();
  for (const name of MODEL_INVOCABLE) {
    assert.notEqual(
      skills.get(name).data['disable-model-invocation'],
      'true',
      `${name} must remain model-invocable — #65 restricts implicit selection to setup and sync only`,
    );
  }
});

test('neither user-invoked description advertises implicit selection or a completion step', async () => {
  const skills = await readSkills();
  for (const name of USER_INVOKED) {
    const desc = flat(skills.get(name).data.description ?? '');
    assert.ok(desc.length > 0, `${name} must carry a description`);

    // The description is the routing surface. It must state explicit invocation
    // as the entry condition and refuse self-selection in its own words.
    assert.match(desc, /invoke only when the user explicitly asks/i, `${name}: description must require explicit invocation`);
    assert.match(desc, /never self-select|never self-selected/i, `${name}: description must refuse self-selection`);

    // The "Use when <situation>" opener is the router idiom the three
    // model-invocable siblings use — a description that opens with it is
    // advertising itself for implicit selection.
    assert.doesNotMatch(desc, /^use when/i, `${name}: description must not open with the "Use when" self-selection idiom`);

    // Completion-step framing in any of its shapes. "when work is wrapping up",
    // "as the closing step", "before you merge", "before opening a pull request"
    // all license a harness to fire the skill at the end of unrelated work.
    assert.doesNotMatch(
      desc,
      /wrapping up|work is (?:finishing|concluding)|closing step|as (?:the|a) (?:final|last|closing|finishing) step|before (?:opening|raising) a pull request|before (?:I|you|we) merge/i,
      `${name}: description must not advertise the skill as a completion step`,
    );
  }
});

test('the docs-sync description keeps the mode triggers its live cases parse', async () => {
  // Guard for two load-bearing assertions elsewhere in this directory that read
  // the docs-sync DESCRIPTION rather than its body: the bundle-wide recognition
  // test requires a bundle-wide trigger and the migration one requires a
  // migration trigger. Rewriting the description for #65's explicit-invocation
  // framing must not silently drop either mode from the routing surface.
  const skills = await readSkills();
  const desc = skills.get('docs-sync').data.description;
  assert.match(desc, /bundle-wide|whole[- ]bundle|entire bundle/i, 'docs-sync must still advertise bundle-wide mode');
  assert.match(desc, /migrat/i, 'docs-sync must still advertise the migration subflow');
});

test('docs-sync no longer carries the finish-time obligation', async () => {
  const skills = await readSkills();
  const doc = flat(skills.get('docs-sync').body);

  // The retired clause, in the exact shapes the suite contract used to state it:
  // "As the closing step of any branch that changed source or docs, before the
  // work concludes" and the "sync the bundle before I merge" trigger.
  assert.doesNotMatch(doc, /closing step/i, 'docs-sync must not be documented as a closing step');
  assert.doesNotMatch(doc, /before the work concludes|before the branch concludes/i, 'docs-sync must not be tied to a branch concluding');
  assert.doesNotMatch(doc, /before (?:I|you|we) merge/i, 'docs-sync must not be documented as a pre-merge step');

  // Any framing that makes sync REQUIRED before a pull request. The lookbehind
  // deliberately spares the contract's own negation ("is not a required
  // pre-pull-request step") while catching the affirmative form.
  assert.doesNotMatch(
    doc,
    /(?<!not )a required (?:pre-)?pull[- ]request step/i,
    'docs-sync must not be documented as a required pre-pull-request step',
  );
  assert.doesNotMatch(
    doc,
    /(?:must|should) (?:run|invoke) (?:docs-)?sync before/i,
    'docs-sync must not be documented as an obligatory step before anything',
  );
});

test('docs-sync documents reconciliation as optional, never automatic, and not tied to a lifecycle stage', async () => {
  const skills = await readSkills();
  const doc = flat(skills.get('docs-sync').body);

  assert.match(doc, /docs-sync is optional/i, 'the body must state plainly that docs-sync is optional');
  assert.match(doc, /never invoked automatically/i, 'the body must state that docs-sync is never invoked automatically');
  assert.match(doc, /not tied to a single lifecycle stage/i, 'the body must state that sync is not tied to a lifecycle stage');
  assert.match(doc, /at any point in the user's workflow/i, 'the body must state that sync is invocable at any point');
  assert.match(doc, /is not a required pre-pull-request step/i, 'the body must state that sync is not required before a pull request');

  // The obligation that REPLACES the retired finish-time step: whoever changes
  // behaviour updates the affected concepts in the same change, without sync.
  assert.match(
    doc,
    /directly in the same change/i,
    'the body must state that the same-change concept-update obligation stands without docs-sync',
  );
});

test('docs-setup documents itself as user-invoked only and never an implicit finishing step', async () => {
  const skills = await readSkills();
  const doc = flat(skills.get('docs-setup').body);
  assert.match(doc, /user-invoked only/i, 'the body must state that docs-setup is user-invoked only');
  assert.match(
    doc,
    /never an implicit (?:finishing|completion) step|never run it as an implicit (?:completion|finishing) step/i,
    'the body must refuse running docs-setup as an implicit completion step',
  );
  assert.match(doc, /(?:nothing self-selects it|never self-select)/i, 'the body must refuse self-selection');
});

test('every dependency-bearing skill carries an ## Integration section', async () => {
  // The library-level half of the dependency contract
  // (/decisions/skill-dependencies.md): a non-empty `## Required skills` list
  // needs a place that explains the relationship. PRESENCE ONLY — this asserts
  // the heading exists and never reads its prose, labels, or shape, because the
  // linter deliberately does not parse them either (#65: it "does not parse
  // labels or semantic prose"). The parser seam itself is covered by
  // tools/lint-skills.test.mjs.
  const skills = await readSkills();
  let checked = 0;
  for (const [name, skill] of skills) {
    if (parseRequiredSkills(skill.body).length === 0) continue;
    checked += 1;
    assert.match(
      skill.body,
      /^##\s+Integration\s*$/m,
      `${name} declares ## Required skills but carries no ## Integration section`,
    );
  }
  // No vacuous pass: the suite really does have dependency-bearing skills, so a
  // loader regression that returned nothing cannot look like a green contract.
  assert.ok(checked >= 3, `expected at least three dependency-bearing skills, checked ${checked}`);
});

test('the README inventory still lists exactly the five canonical suite skills', async () => {
  // #65 leaves the five-skill package identity UNCHANGED (Out of Scope: "Changing
  // the five-skill package identity or adding new documentation skills"), and the
  // README is the public inventory. Pin the set so a stray skill directory or a
  // dropped inventory line is caught here rather than in a release.
  const skills = await readSkills();
  assert.deepEqual([...skills.keys()].sort(), [...USER_INVOKED, ...MODEL_INVOCABLE].sort());
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  for (const name of skills.keys()) {
    assert.ok(
      readme.includes(`[\`${name}\`](skills/${name}/SKILL.md)`),
      `README inventory must link ${name}`,
    );
  }
});
