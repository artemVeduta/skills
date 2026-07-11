import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  lintFrontmatter,
  lintName,
  lintBody,
  lintHeadings,
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
