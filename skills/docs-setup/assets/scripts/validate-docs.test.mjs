import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter,
  validateConcept,
  validateReserved,
  checkLinks,
  indexCoverageWarnings,
  validateBundle,
} from './validate-docs.mjs';

const validatorPath = fileURLToPath(new URL('./validate-docs.mjs', import.meta.url));

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

async function makeBundle(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'okf-validate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, ...rel.split('/'));
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return root;
}

function runCli(root) {
  const r = spawnSync(process.execPath, [validatorPath, root], {
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const CONCEPT = [
  '---',
  'type: Decision',
  'title: X',
  'description: d',
  'timestamp: 2026-07-24',
  '---',
  'body',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Frontmatter oracle — YAML 1.2 mapping
// ---------------------------------------------------------------------------

test('parseFrontmatter reads a simple block', () => {
  const r = parseFrontmatter('---\ntype: Decision\ntitle: X\n---\nbody');
  assert.equal(r.ok, true);
  assert.equal(r.data.type, 'Decision');
  assert.equal(r.body.trim(), 'body');
});

test('parseFrontmatter accepts sequence and mapping values', () => {
  const text = [
    '---',
    'type: Decision',
    'tags: [a, b]',
    'links:',
    '  - /a.md',
    '  - /b.md',
    'meta:',
    '  owner: me',
    '  depth: 2',
    '---',
    'body',
  ].join('\n');
  const r = parseFrontmatter(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.tags, ['a', 'b']);
  assert.deepEqual(r.data.links, ['/a.md', '/b.md']);
  assert.deepEqual(r.data.meta, { owner: 'me', depth: 2 });
});

test('parseFrontmatter fails without an opening delimiter', () => {
  assert.equal(parseFrontmatter('no frontmatter here').ok, false);
});

test('parseFrontmatter requires the opening delimiter on the first line', () => {
  assert.equal(parseFrontmatter('\n---\ntype: Decision\n---\nbody').ok, false);
});

test('parseFrontmatter fails on an unterminated block', () => {
  assert.equal(parseFrontmatter('---\ntype: Decision\nbody with no close').ok, false);
});

test('parseFrontmatter rejects invalid YAML', () => {
  assert.equal(parseFrontmatter('---\ntitle: "unterminated\ntype: D\n---\nx').ok, false);
  assert.equal(parseFrontmatter('---\ntags: [a, b\ntype: D\n---\nx').ok, false);
  assert.equal(parseFrontmatter('---\n: no key\n---\nx').ok, false);
});

test('parseFrontmatter rejects duplicate top-level keys', () => {
  const r = parseFrontmatter('---\ntype: Decision\ntype: Reference\n---\nx');
  assert.equal(r.ok, false);
  assert.match(r.reason, /duplicate/i);
});

test('parseFrontmatter treats __proto__ as an ordinary key, so duplicates are caught', () => {
  const dup = parseFrontmatter('---\n__proto__: a\n__proto__: b\ntype: Decision\n---\nx');
  assert.equal(dup.ok, false);
  assert.match(dup.reason, /duplicate/i);
  const single = parseFrontmatter('---\n__proto__: a\ntype: Decision\n---\nx');
  assert.equal(single.ok, true);
  assert.equal(Object.getOwnPropertyDescriptor(single.data, '__proto__')?.value, 'a');
  assert.equal({}.a, undefined); // no prototype pollution
});

test('parseFrontmatter folds a multi-line plain scalar with single spaces', () => {
  const text = [
    '---',
    'type: Decision',
    'description: a long value',
    '  wrapped onto the next line',
    '  and a third',
    'title: X',
    '---',
    'body',
  ].join('\n');
  const r = parseFrontmatter(text);
  assert.equal(r.ok, true);
  assert.equal(r.data.description, 'a long value wrapped onto the next line and a third');
  assert.equal(r.data.title, 'X');
});

test('parseFrontmatter rejects forms outside the documented YAML subset', () => {
  const anchor = parseFrontmatter('---\ntype: Decision\ntitle: &a X\n---\nx');
  assert.equal(anchor.ok, false);
  assert.match(anchor.reason, /outside the supported YAML subset/);
  const tag = parseFrontmatter('---\ntype: Decision\ntitle: !!str X\n---\nx');
  assert.equal(tag.ok, false);
  const multiFlow = parseFrontmatter('---\ntype: Decision\ntags: [a,\n  b]\n---\nx');
  assert.equal(multiFlow.ok, false);
  assert.match(multiFlow.reason, /close on the same line/);
  const multiQuoted = parseFrontmatter('---\ntype: Decision\ntitle: "a\n  b"\n---\nx');
  assert.equal(multiQuoted.ok, false);
});

test('parseFrontmatter rejects a non-mapping document', () => {
  assert.equal(parseFrontmatter('---\n- a\n- b\n---\nx').ok, false);
  assert.equal(parseFrontmatter('---\njust a scalar\n---\nx').ok, false);
  assert.equal(parseFrontmatter('---\n---\nx').ok, false);
});

test('parseFrontmatter keeps a # inside quotes and strips a trailing comment', () => {
  const r = parseFrontmatter('---\ntitle: "a # b"\ntype: Decision # note\n---\nx');
  assert.equal(r.data.title, 'a # b');
  assert.equal(r.data.type, 'Decision');
});

test('parseFrontmatter tolerates CRLF line endings', () => {
  const r = parseFrontmatter('---\r\ntype: Decision\r\n---\r\nbody');
  assert.equal(r.ok, true);
  assert.equal(r.data.type, 'Decision');
});

test('parseFrontmatter resolves plain scalars per the YAML core schema', () => {
  const r = parseFrontmatter(
    '---\ntype: Decision\nokf_version: 0.1\nquoted: "0.1"\nflag: true\n---\nx'
  );
  assert.equal(r.ok, true);
  assert.equal(r.data.okf_version, 0.1);
  assert.equal(r.data.quoted, '0.1');
  assert.equal(r.data.flag, true);
});

// ---------------------------------------------------------------------------
// Hard errors — the OKF conformance floor
// ---------------------------------------------------------------------------

test('validateConcept flags missing type as a hard error', () => {
  const { errors } = validateConcept('a.md', '---\ntitle: X\n---\nbody');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /type/);
});

test('validateConcept flags an empty type as a hard error', () => {
  const { errors } = validateConcept('a.md', '---\ntype:   \n---\nbody');
  assert.equal(errors.length, 1);
});

test('validateConcept flags a non-scalar type as a hard error', () => {
  const seq = validateConcept('a.md', '---\ntype: [Decision]\n---\nbody');
  assert.equal(seq.errors.length, 1);
  const map = validateConcept('a.md', '---\ntype:\n  kind: Decision\n---\nbody');
  assert.equal(map.errors.length, 1);
  const num = validateConcept('a.md', '---\ntype: 42\n---\nbody');
  assert.equal(num.errors.length, 1);
});

// ---------------------------------------------------------------------------
// Warning suite
// ---------------------------------------------------------------------------

test('validateConcept warns (not errors) on missing recommended fields', () => {
  const { errors, warnings } = validateConcept('a.md', '---\ntype: Decision\n---\nbody');
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => /title/.test(w)));
  assert.ok(warnings.some((w) => /description/.test(w)));
  assert.ok(warnings.some((w) => /timestamp/.test(w)));
});

test('validateConcept warns on a malformed timestamp', () => {
  const { warnings } = validateConcept(
    'a.md',
    '---\ntype: Decision\ntitle: X\ndescription: d\ntimestamp: yesterday\n---\nb'
  );
  assert.ok(warnings.some((w) => /ISO/.test(w)));
});

test('validateConcept warns on status superseded without superseded_by', () => {
  const base = '---\ntype: Decision\ntitle: X\ndescription: d\ntimestamp: 2026-07-24\n';
  const bad = validateConcept('a.md', `${base}status: superseded\n---\nb`);
  assert.ok(bad.warnings.some((w) => /superseded_by/.test(w)));
  const good = validateConcept(
    'a.md',
    `${base}status: superseded\nsuperseded_by: /b.md\n---\nb`
  );
  assert.equal(good.warnings.length, 0);
});

test('validateConcept warns when the timestamp is older than the newest amendment', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    'body',
    '',
    '# Amendments',
    '',
    '## 2026-07-10',
    'entry',
    '## 2026-07-20 — later change',
    'entry',
  ].join('\n');
  const { warnings } = validateConcept('a.md', doc);
  assert.ok(warnings.some((w) => /2026-07-20/.test(w) && /older/.test(w)));
});

test('a timestamp equal to the newest amendment date is not stale', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-20',
    '---',
    '# Amendments',
    '## 2026-07-20',
    'entry',
  ].join('\n');
  assert.equal(validateConcept('a.md', doc).warnings.length, 0);
});

test('amendment scan ignores lookalike headings outside the # Amendments region', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    '## 2026-07-30',
    'not an amendment (before the region)',
    '',
    '# Amendments',
    '## 2026-06-01',
    'entry',
    '',
    '# Something else',
    '## 2026-07-31',
    'not an amendment (after the region)',
  ].join('\n');
  assert.equal(validateConcept('a.md', doc).warnings.length, 0);
});

test('amendment scan ignores amendment-lookalike headings inside a code fence', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    'An illustrative amendment grammar example:',
    '',
    '```md',
    '# Amendments',
    '## 2026-07-20',
    'entry',
    '```',
    '',
  ].join('\n');
  assert.equal(validateConcept('a.md', doc).warnings.length, 0);
});

test('amendment scan rejects non-exact heading forms', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    '# Amendments',
    '## 2026-07-20 no em dash separator',
    '## 2026-07-21 — ',
    '##  2026-07-22',
    'entries above are all unrecognized',
  ].join('\n');
  assert.equal(validateConcept('a.md', doc).warnings.length, 0);
});

// The amendment scan sees a fences-only view: a real inline code span in an
// amendment title survives, so the heading stays recognizable. Link and
// index scanning keep removing inline spans too.
test('an amendment title that is only an inline code span is recognized', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    '# Amendments',
    '## 2026-07-20 — `newestAmendmentDate()`',
    'entry',
  ].join('\n');
  const { warnings } = validateConcept('a.md', doc);
  assert.ok(warnings.some((w) => /2026-07-20/.test(w) && /older/.test(w)));
});

test('an amendment title beginning with an inline code span is recognized', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    '# Amendments',
    '## 2026-07-20 — `stripCode()` keeps fenced-only stripping for links',
    'entry',
  ].join('\n');
  const { warnings } = validateConcept('a.md', doc);
  assert.ok(warnings.some((w) => /2026-07-20/.test(w) && /older/.test(w)));
});

test('a timestamp equal to an inline-code amendment title date is not stale', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-20',
    '---',
    '# Amendments',
    '## 2026-07-20 — `newestAmendmentDate()`',
    'entry',
  ].join('\n');
  assert.equal(validateConcept('a.md', doc).warnings.length, 0);
});

test('a fenced amendment heading with an inline-code title stays ignored', () => {
  const doc = [
    '---',
    'type: Decision',
    'title: X',
    'description: d',
    'timestamp: 2026-07-01',
    '---',
    '```md',
    '# Amendments',
    '## 2026-07-20 — `newestAmendmentDate()`',
    'entry',
    '```',
    '',
  ].join('\n');
  assert.equal(validateConcept('a.md', doc).warnings.length, 0);
});

// ---------------------------------------------------------------------------
// Reserved files
// ---------------------------------------------------------------------------

test('validateReserved warns when a non-root index.md carries frontmatter', () => {
  const { warnings } = validateReserved(
    'client-gui/index.md',
    '---\ntype: X\n---\n',
    false
  );
  assert.ok(warnings.some((w) => /frontmatter/.test(w)));
});

test('validateReserved warns when root index frontmatter lacks string okf_version "0.1"', () => {
  const unquoted = validateReserved('index.md', '---\nokf_version: 0.1\n---\n# t', true);
  assert.ok(unquoted.warnings.some((w) => /okf_version/.test(w)));
  const quoted = validateReserved('index.md', '---\nokf_version: "0.1"\n---\n# t', true);
  assert.equal(quoted.warnings.length, 0);
  const absent = validateReserved('index.md', '# no frontmatter at all', true);
  assert.equal(absent.warnings.length, 0);
});

test('validateReserved warns on a log.md heading that is not exactly ## YYYY-MM-DD', () => {
  const { warnings } = validateReserved(
    'log.md',
    '# Log\n\n## June 2026\n* a\n## 2026-07-24 extra\n* b\n## 2026-07-24\n* ok\n',
    false
  );
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((w) => /YYYY-MM-DD/.test(w)));
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

test('checkLinks warns on a broken bundle-absolute .md link', () => {
  const warnings = checkLinks('a.md', 'see [x](/missing/x.md)', new Set(['a.md']));
  assert.equal(warnings.length, 1);
});

test('checkLinks passes a resolvable link and ignores directory links', () => {
  const warnings = checkLinks(
    'a.md',
    '[ok](/b.md) and [dir](/client-gui/)',
    new Set(['a.md', 'b.md'])
  );
  assert.equal(warnings.length, 0);
});

test('checkLinks ignores a link inside an inline code span', () => {
  const warnings = checkLinks(
    'a.md',
    'placeholder `[Title](/absolute/path.md)` and real [ok](/b.md)',
    new Set(['a.md', 'b.md'])
  );
  assert.equal(warnings.length, 0);
});

test('checkLinks ignores a link inside a fenced code block', () => {
  const text = '```\nsee [x](/missing/x.md)\n```\nand real [ok](/b.md)\n';
  const warnings = checkLinks('a.md', text, new Set(['a.md', 'b.md']));
  assert.equal(warnings.length, 0);
});

test('a closing fence longer than the opener still closes the block (CommonMark)', () => {
  const text = '```\nsee [x](/missing/x.md)\n````\nand real [ok](/b.md)\n';
  const warnings = checkLinks('a.md', text, new Set(['a.md', 'b.md']));
  assert.equal(warnings.length, 0);
});

test('an unclosed fence strips to EOF', () => {
  const text = 'real [ok](/b.md)\n```\nsee [x](/missing/x.md)\n';
  const warnings = checkLinks('a.md', text, new Set(['a.md', 'b.md']));
  assert.equal(warnings.length, 0);
});

// ---------------------------------------------------------------------------
// Local-index coverage — exact bundle-relative paths, aggregated per directory
// ---------------------------------------------------------------------------

test('a cross-directory same-basename link does not satisfy local-index coverage', () => {
  const idx = '- [Focus](/other/focus.md)';
  const warnings = indexCoverageWarnings('d/index.md', idx, ['d/focus.md']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /\/d\/focus\.md/);
});

test('exact-path coverage does not treat focus.md as covered by slide-focus.md', () => {
  const idx = '- [Slide Focus](/d/slide-focus.md)';
  const warnings = indexCoverageWarnings('d/index.md', idx, [
    'd/focus.md',
    'd/slide-focus.md',
  ]);
  assert.equal(warnings.length, 1);
  assert.ok(/\/d\/focus\.md/.test(warnings[0]) && !/slide-focus/.test(warnings[0]));
});

test('directory omissions aggregate once with total and first three lexicographic paths', () => {
  const warnings = indexCoverageWarnings('d/index.md', 'no links here', [
    'd/e.md',
    'd/a.md',
    'd/c.md',
    'd/b.md',
    'd/d.md',
  ]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /5 concept/);
  assert.match(warnings[0], /\/d\/a\.md, \/d\/b\.md, \/d\/c\.md/);
  assert.ok(!/\/d\/d\.md/.test(warnings[0]) && !/\/d\/e\.md/.test(warnings[0]));
});

test('an index linking every exact path yields no coverage warning', () => {
  const idx = '- [A](/d/a.md)\n- [B](/d/b.md)';
  assert.equal(indexCoverageWarnings('d/index.md', idx, ['d/a.md', 'd/b.md']).length, 0);
});

// ---------------------------------------------------------------------------
// Bundle walk — uniform validation, sidecars, no exclusion grammar
// ---------------------------------------------------------------------------

test('malformed Markdown under any docs/ subtree is validated uniformly', async (t) => {
  const root = await makeBundle(t, {
    'index.md': '- [A](/a.md)',
    'a.md': CONCEPT,
    'superpowers/handoffs/broken.md': 'no frontmatter at all\n',
  });
  const { errors } = await validateBundle(root);
  assert.ok(errors.some((e) => /superpowers\/handoffs\/broken\.md/.test(e)));
});

test('non-Markdown sidecars are ignored', async (t) => {
  const root = await makeBundle(t, {
    'index.md': '- [A](/a.md)',
    'a.md': CONCEPT,
    'a.png': 'not markdown',
    'diagram.json': '{"not": "markdown"}',
  });
  const { errors, warnings } = await validateBundle(root);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test('a directory with concepts but no local index.md warns', async (t) => {
  const root = await makeBundle(t, {
    'index.md': '- [A](/d/a.md)',
    'd/a.md': CONCEPT,
  });
  const { warnings } = await validateBundle(root);
  assert.ok(warnings.some((w) => /d.*no index\.md/.test(w)));
});

// Negative fixture: constructs that other validators warn about — duplicate
// basenames across directories, absent log.md, debt markers, a large amendment
// history, copied config values, generated-looking duplicates, non-Markdown
// sidecars, and a retained superseded concept (retention) — none of which is a
// warning class here. A fully-covered bundle containing all of them must
// validate with zero warnings.
test('explicitly rejected warning classes stay absent', async (t) => {
  const amendments = ['# Amendments'];
  for (let i = 1; i <= 12; i += 1) {
    amendments.push(`## 2026-06-${String(i).padStart(2, '0')}`, `entry ${i}`);
  }
  const concept = (title) =>
    [
      '---',
      'type: Decision',
      `title: ${title}`,
      'description: TODO revisit this HACK later', // debt markers: not a warning class
      'timestamp: 2026-07-24',
      '---',
      'The current config value is PORT = 3000 and MAX_RETRIES = 5.',
      ...amendments,
      '',
    ].join('\n');
  // Retention: a superseded concept kept in the bundle (still indexed, with a
  // valid superseded_by) is the documented deprecation flow, never a warning.
  const retained = [
    '---',
    'type: Decision',
    'title: Retired',
    'description: superseded but retained',
    'timestamp: 2026-07-24',
    'status: superseded',
    'superseded_by: /one/focus.md',
    '---',
    'body',
    '',
  ].join('\n');
  const root = await makeBundle(t, {
    'index.md': '- [One](/one/focus.md)\n- [Two](/two/focus.md)',
    'one/index.md': '- [Focus](/one/focus.md)\n- [Retired](/one/retired.md)',
    'one/focus.md': concept('One'), // duplicate basename with two/focus.md
    'one/retired.md': retained,
    'two/index.md': '- [Focus](/two/focus.md)\n- [Focus copy](/two/focus-generated.md)',
    'two/focus.md': concept('Two'),
    'two/focus-generated.md': concept('Two generated'),
    'two/focus.png': 'sidecar',
  });
  const { errors, warnings } = await validateBundle(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

// ---------------------------------------------------------------------------
// CLI exit contract — 0 clean/warnings-only, 1 hard errors, 2 malfunction
// ---------------------------------------------------------------------------

test('CLI exits 0 on a clean bundle', async (t) => {
  const root = await makeBundle(t, {
    'index.md': '- [A](/a.md)',
    'a.md': CONCEPT,
  });
  const { code, stdout } = runCli(root);
  assert.equal(code, 0);
  assert.match(stdout, /conformant/);
});

test('CLI exits 0 on a warnings-only bundle', async (t) => {
  const root = await makeBundle(t, {
    'index.md': '- [A](/a.md)',
    'a.md': '---\ntype: Decision\n---\nbody\n', // missing recommended fields
  });
  const { code, stdout } = runCli(root);
  assert.equal(code, 0);
  assert.match(stdout, /Warnings/);
});

test('CLI exits 1 on hard errors and on mixed errors plus warnings', async (t) => {
  const root = await makeBundle(t, {
    'index.md': '- [A](/a.md)\n- [B](/b.md)',
    'a.md': 'no frontmatter\n', // hard error
    'b.md': '---\ntype: Decision\n---\nbody\n', // warnings
  });
  const { code, stdout } = runCli(root);
  assert.equal(code, 1);
  assert.match(stdout, /ERRORS/);
  assert.match(stdout, /Warnings/);
});

test('CLI exits 1 for every frontmatter failure class', async (t) => {
  const cases = {
    'missing-delimiter.md': 'type: Decision\n',
    'unterminated.md': '---\ntype: Decision\n',
    'invalid-yaml.md': '---\ntags: [a, b\n---\nx\n',
    'duplicate-keys.md': '---\ntype: A\ntype: B\n---\nx\n',
    'non-mapping.md': '---\n- a\n---\nx\n',
    'missing-type.md': '---\ntitle: X\n---\nx\n',
    'empty-type.md': '---\ntype: ""\n---\nx\n',
    'non-scalar-type.md': '---\ntype: [Decision]\n---\nx\n',
  };
  for (const [name, content] of Object.entries(cases)) {
    const root = await makeBundle(t, { 'index.md': `- [C](/${name})`, [name]: content });
    const { code } = runCli(root);
    assert.equal(code, 1, `${name} must exit 1`);
  }
});

test('CLI exits 2 on a missing docs root without an uncaught rejection', async (t) => {
  const root = await makeBundle(t, {});
  const { code, stderr } = runCli(join(root, 'does-not-exist'));
  assert.equal(code, 2);
  assert.match(stderr, /malfunction/);
  assert.ok(!/Unhandled|ERR_UNHANDLED/i.test(stderr));
});

test('CLI exits 2 when the docs root is a file, not a directory', async (t) => {
  const root = await makeBundle(t, { 'not-a-dir': 'plain file' });
  const { code, stderr } = runCli(join(root, 'not-a-dir'));
  assert.equal(code, 2);
  assert.match(stderr, /malfunction/);
});
