import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  lintFrontmatter,
  lintName,
  lintBody,
  lintHeadings,
  lintDependencies,
  lintCrossSkillPaths,
  lintSupportSubdirs,
  lintReadmeInventory,
} from './lint-skills.mjs';

test('parseFrontmatter reads a hyphenated key', () => {
  const r = parseFrontmatter('---\nname: x\ndisable-model-invocation: true\n---\nbody');
  assert.equal(r.ok, true);
  assert.equal(r.data['disable-model-invocation'], 'true');
  assert.equal(r.body.trim(), 'body');
});

test('parseFrontmatter fails without an opening fence', () => {
  assert.equal(parseFrontmatter('no frontmatter').ok, false);
});

test('lintFrontmatter errors on a missing required key', () => {
  const { errors } = lintFrontmatter('a/SKILL.md', { description: 'd' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /name/);
});

test('lintFrontmatter warns on an unknown key', () => {
  const { errors, warnings } = lintFrontmatter('a/SKILL.md', {
    name: 'a',
    description: 'd',
    version: '1.0',
  });
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => /version/.test(w)));
});

test('lintFrontmatter errors on a malformed disable-model-invocation value', () => {
  const { errors } = lintFrontmatter('a/SKILL.md', {
    name: 'a',
    description: 'd',
    'disable-model-invocation': 'yes',
  });
  assert.ok(errors.some((e) => /disable-model-invocation/.test(e)));
});

test('lintName errors when name does not equal the directory', () => {
  assert.equal(lintName('a/SKILL.md', 'b', 'a').errors.length, 1);
  assert.equal(lintName('a/SKILL.md', 'a', 'a').errors.length, 0);
});

test('lintBody errors past 500 lines and warns past 200', () => {
  assert.equal(lintBody('a/SKILL.md', 'x\n'.repeat(501)).errors.length, 1);
  const soft = lintBody('a/SKILL.md', 'x\n'.repeat(250));
  assert.equal(soft.errors.length, 0);
  assert.equal(soft.warnings.length, 1);
  assert.equal(lintBody('a/SKILL.md', 'x\n'.repeat(10)).warnings.length, 0);
});

test('lintHeadings warns on a near-miss canonical heading', () => {
  const { warnings } = lintHeadings('a/SKILL.md', '## When to use\n\ntext');
  assert.ok(warnings.some((w) => /When to Use/.test(w)));
});

test('lintHeadings accepts the exact canonical heading and free-form headings', () => {
  const body = '## When to Use\n\n## Verification\n';
  assert.equal(lintHeadings('a/SKILL.md', body).warnings.length, 0);
});

test('lintHeadings ignores headings inside a fenced code block', () => {
  const body = '```md\n## Common mistakes\n```\n';
  assert.equal(lintHeadings('a/SKILL.md', body).warnings.length, 0);
});

test('lintDependencies errors on an undeclared runtime invocation', () => {
  const { errors } = lintDependencies('a/SKILL.md', 'Invoke `/other`.', new Map());
  assert.ok(errors.some((e) => /\/other/.test(e) && /Required skills/.test(e)));
});

test('lintDependencies accepts a declared invocation', () => {
  const body = '## Required skills\n\n- other\n\n## Overview\n\nInvoke `/other`.';
  const known = new Map([['other', { userInvoked: false }]]);
  assert.equal(lintDependencies('a/SKILL.md', body, known).errors.length, 0);
});

test('lintDependencies errors when a required skill is user-invoked', () => {
  const body = '## Required skills\n\n- other\n';
  const known = new Map([['other', { userInvoked: true }]]);
  assert.ok(lintDependencies('a/SKILL.md', body, known).errors.some((e) => /user-invoked/.test(e)));
});

test('lintDependencies ignores namespaced invocations', () => {
  const { errors } = lintDependencies('a/SKILL.md', 'Invoke `/superpowers:brainstorming`.', new Map());
  assert.equal(errors.length, 0);
});

test('lintCrossSkillPaths errors on a path into another skill', () => {
  const { errors } = lintCrossSkillPaths(
    'a/SKILL.md',
    'a',
    'see skills/other/helper.md',
    new Set(['a', 'other'])
  );
  assert.equal(errors.length, 1);
});

test('lintCrossSkillPaths ignores same-skill and target-repo paths', () => {
  const { errors } = lintCrossSkillPaths(
    'a/SKILL.md',
    'a',
    'copy assets/scripts/x.mjs to scripts/x.mjs',
    new Set(['a', 'other'])
  );
  assert.equal(errors.length, 0);
});

test('lintSupportSubdirs warns on a non-role-named subdir', () => {
  const { warnings } = lintSupportSubdirs('a', ['assets', 'helpers']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /helpers/);
});

test('lintReadmeInventory warns on a skill missing from the inventory', () => {
  const readme = '## Skills\n\n- [`a`](skills/a/SKILL.md) — does a thing.';
  const { warnings } = lintReadmeInventory(['a', 'b'], readme);
  assert.ok(warnings.some((w) => /"b"/.test(w) && /missing/.test(w)));
});

test('lintReadmeInventory warns on a stale inventory entry', () => {
  const readme = '## Skills\n\n- [`a`](skills/a/SKILL.md) — a.\n- [`gone`](skills/gone/SKILL.md) — x.';
  const { warnings } = lintReadmeInventory(['a'], readme);
  assert.ok(warnings.some((w) => /"gone"/.test(w)));
});
