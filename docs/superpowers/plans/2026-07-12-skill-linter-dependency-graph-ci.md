# Skill Linter, Dependency Graph, Conformance Fixes, and Static CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a contributor pushing a branch a deterministic, zero-inference verdict on skill quality — an advisory two-tier skill linter, a shared dependency-graph module, conformance fixes to `okf-docs-setup`, and a static push/PR CI workflow.

**Architecture:** Two new pure-Node ES modules live under `tools/`: `skill-graph.mjs` (the single shared dependency-graph implementation the installer wizard and test-fixture builder will later reuse) and `lint-skills.mjs` (a CLI that walks the flat `skills/` tree, wires in the graph module, and emits two-tier ERROR/WARN findings). The linter mirrors the existing docs validator (`scripts/validate-docs.mjs`): pure functions with hermetic string-based unit tests, a thin filesystem orchestrator, and a default invocation that always exits 0. A `--strict` flag derives a nonzero exit from ERROR presence for CI. One GitHub Actions workflow runs the linter (strict, the only gate) and the docs validator (advisory).

**Tech Stack:** Node.js (ES modules, `.mjs`), Node's built-in `node --test` runner, zero external dependencies. GitHub Actions for CI. No TypeScript, no bundler, no test framework.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `docs/specs/skills-platform.md` and the governing Decisions (`skill-dependencies`, `skill-authoring-conventions`, `ci-and-automation-wiring`).

- **Zero external dependencies.** `package.json` gains no `dependencies`/`devDependencies`. Every module uses only Node built-ins (`node:fs/promises`, `node:path`, `node:url`, `node:test`, `node:assert/strict`, `node:child_process`, `node:os`).
- **Node's built-in test runner.** Tests are `*.test.mjs` run with `node --test`. No jest/mocha/vitest, no config file.
- **All new source lives in `tools/`** as ES modules (`.mjs`). `tools/` did not exist before this work.
- **Frontmatter allowlist (exact):** `name`, `description` (required); `disable-model-invocation`, `argument-hint` (optional). A missing required key is an ERROR. A key outside the allowlist (including `version:`) is a WARN.
- **Canonical headings (exact casing):** `## Overview`, `## Required skills`, `## Integration`, `## When to Use`, `## Common Mistakes`, `## Quick Reference`. A level-2 heading that matches one case-insensitively but not exactly is a near-miss WARN.
- **Body line limits (exact):** body (content after the closing frontmatter fence) over 200 lines is a WARN; over 500 lines is an ERROR.
- **Role-named support subdirs (exact):** `scripts/`, `templates/`, `assets/`. Any other immediate-child directory of a skill is a WARN. The check inspects only the skill directory's immediate children — it never recurses into a role-named payload (e.g. the internals of `assets/`).
- **`## Required skills` is the only machine input to the graph.** Each list entry is one bare canonical skill name (kebab-case, no leading slash), one per line.
- **Runtime invocation syntax:** a backtick-wrapped slash command, `` `/skill-name` ``. Every bare runtime invocation must have a matching bare entry in `## Required skills`. Namespaced external invocations (`` `/plugin:skill` ``) belong to other libraries, are documented in `## Integration` prose only, and never enter this library's graph — the linter excludes them from reconciliation.
- **Cross-skill filesystem paths are forbidden.** A `SKILL.md` that references another skill's files by path (`skills/<other>/…` or `../<other>/…`) is an ERROR; skills invoke capabilities by canonical name only.
- **Exit codes:** the default linter invocation always exits 0 (advisory). `--strict` exits 1 when any ERROR is present, else 0.
- **CI:** exactly one push/PR workflow. It runs the skill linter (strict — the only gate) and the docs validator (advisory). The job fails only on linter ERRORs. No model API keys in Actions. No scheduled workflows, no `workflow_dispatch`.
- **`okf-docs-setup/assets/` stays byte-identical.** Only `skills/okf-docs-setup/SKILL.md` may change in the conformance task.
- **Node version:** the spec sets no floor; CI pins `actions/setup-node` to Node 20 (LTS; stable `node --test`).

**Blocked-by note:** Issue #22 is blocked by #20 (README inventory). That inventory already exists at `README.md` under `## Skills`, so this work is unblocked.

---

## File Structure

New and modified files, each with a single clear responsibility:

- **Create `tools/skill-graph.mjs`** — the shared dependency-graph module. Pure, no filesystem access. Exports: `parseRequiredSkills`, `parseRuntimeInvocations`, `reconcileInvocations`, `missingNodes`, `findCycles`, `transitiveClosure`. Reused verbatim by the future install wizard and test-fixture builder.
- **Create `tools/skill-graph.test.mjs`** — hermetic unit tests for every graph export.
- **Create `tools/lint-skills.mjs`** — the linter. A small frontmatter parser, one pure check function per ERROR/WARN class, a thin filesystem orchestrator (`collectSkills`, `lintSkillTree`), a `formatReport`, and a CLI `main()` with `--strict`. Imports the graph module.
- **Create `tools/lint-skills.test.mjs`** — hermetic unit tests for every check function, a fixture-tree test for the orchestrator, and a spawned CLI test for the strict/default exit codes.
- **Modify `skills/okf-docs-setup/SKILL.md`** — conformance fixes only (add `## Integration`, fix two heading casings, replace three harness-specific tool-name references). `assets/` untouched.
- **Modify `package.json`** — add `lint:skills`, `lint:skills:strict`, `lint:skills:test`; extend the aggregate `test` script to cover `tools/`.
- **Modify `.claude/rules/docs-maintenance.md`** — extend the `paths:` glob to cover `tools/**/*`.
- **Create `.github/workflows/ci.yml`** — the single static-checks workflow.

---

### Task 1: Shared dependency-graph module

**Files:**
- Create: `tools/skill-graph.mjs`
- Test: `tools/skill-graph.test.mjs`

**Interfaces:**
- Consumes: nothing (pure module; all inputs are strings and `Map` objects passed by callers).
- Produces (relied on by Tasks 3–4 and future installer/fixture-builder):
  - `parseRequiredSkills(body: string): string[]` — bare canonical names listed under a `## Required skills` section, in order; `[]` if the section is absent.
  - `parseRuntimeInvocations(body: string): string[]` — de-duplicated bare skill names from backtick-wrapped `` `/name` `` runtime invocations; namespaced `` `/plugin:skill` `` are excluded.
  - `reconcileInvocations(declared: string[], invoked: string[]): string[]` — names in `invoked` with no matching entry in `declared`.
  - `missingNodes(graph: Map<string,string[]>): Array<{from: string, missing: string}>` — declared dependencies naming a skill absent from the graph.
  - `findCycles(graph: Map<string,string[]>): string[][]` — each cycle as an ordered list of node names (edges to missing nodes are not followed).
  - `transitiveClosure(graph: Map<string,string[]>, start: string): Set<string>` — `start` plus every skill reachable through its edges (missing deps included in the set).

- [ ] **Step 1: Write the failing tests**

Create `tools/skill-graph.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRequiredSkills,
  parseRuntimeInvocations,
  reconcileInvocations,
  missingNodes,
  findCycles,
  transitiveClosure,
} from './skill-graph.mjs';

test('parseRequiredSkills reads bare names and stops at the next heading', () => {
  const body = [
    '## Required skills',
    '',
    '- domain-modeling',
    '- skill-builder',
    '',
    '## Integration',
    '- not-a-dependency',
  ].join('\n');
  assert.deepEqual(parseRequiredSkills(body), ['domain-modeling', 'skill-builder']);
});

test('parseRequiredSkills returns [] when the section is absent', () => {
  assert.deepEqual(parseRequiredSkills('## Overview\n\nno deps here'), []);
});

test('parseRuntimeInvocations captures bare invocations and excludes namespaced ones', () => {
  const body = 'Invoke `/domain-modeling` then `/skill-builder`. See `/superpowers:brainstorming`.';
  assert.deepEqual(parseRuntimeInvocations(body).sort(), ['domain-modeling', 'skill-builder']);
});

test('parseRuntimeInvocations de-duplicates repeated invocations', () => {
  assert.deepEqual(parseRuntimeInvocations('`/a` and again `/a`'), ['a']);
});

test('reconcileInvocations returns invocations that lack a declaration', () => {
  assert.deepEqual(reconcileInvocations(['a'], ['a', 'b']), ['b']);
  assert.deepEqual(reconcileInvocations(['a', 'b'], ['a']), []);
});

test('missingNodes flags a declared dependency absent from the graph', () => {
  const graph = new Map([['a', ['b']], ['b', []]]);
  assert.deepEqual(missingNodes(graph), []);
  const dangling = new Map([['a', ['ghost']]]);
  assert.deepEqual(missingNodes(dangling), [{ from: 'a', missing: 'ghost' }]);
});

test('findCycles detects a direct cycle', () => {
  const graph = new Map([['a', ['b']], ['b', ['a']]]);
  const cycles = findCycles(graph);
  assert.equal(cycles.length >= 1, true);
  assert.deepEqual([...cycles[0]].sort(), ['a', 'b']);
});

test('findCycles returns no cycles for a DAG', () => {
  const graph = new Map([['a', ['b']], ['b', ['c']], ['c', []]]);
  assert.deepEqual(findCycles(graph), []);
});

test('findCycles ignores edges to missing nodes', () => {
  const graph = new Map([['a', ['ghost']]]);
  assert.deepEqual(findCycles(graph), []);
});

test('transitiveClosure includes start and all reachable dependencies', () => {
  const graph = new Map([['a', ['b']], ['b', ['c']], ['c', []]]);
  assert.deepEqual([...transitiveClosure(graph, 'a')].sort(), ['a', 'b', 'c']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/skill-graph.test.mjs`
Expected: FAIL — `Cannot find module './skill-graph.mjs'` (file does not exist yet).

- [ ] **Step 3: Write the module**

Create `tools/skill-graph.mjs`:

```js
// Shared skill dependency-graph module. Pure — no filesystem access.
// The linter, the install wizard, and the test-fixture builder all reuse this
// module; none reimplements the graph.
//
// A graph is a Map<name, string[]>: each skill name maps to the bare canonical
// names listed in its `## Required skills` section.

// Bare canonical skill names from a `## Required skills` section, in order.
// One bare name per list item (no leading slash). `[]` if the section is absent.
export function parseRequiredSkills(body) {
  const names = [];
  let inSection = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+Required skills\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+`?([a-z0-9][a-z0-9-]*)`?\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

// Bare runtime skill invocations in the body. Runtime invocation syntax is a
// backtick-wrapped slash command, e.g. `/skill-name`. Namespaced external
// invocations (`/plugin:skill`) belong to other libraries, are documented in
// `## Integration` prose only, and never enter this library's graph — the
// pattern's lack of a `:` excludes them here.
export function parseRuntimeInvocations(body) {
  const names = new Set();
  for (const m of body.matchAll(/`\/([a-z0-9][a-z0-9-]*)`/g)) {
    names.add(m[1]);
  }
  return [...names];
}

// Invocations with no matching bare entry in `## Required skills`.
export function reconcileInvocations(declared, invoked) {
  const declaredSet = new Set(declared);
  return invoked.filter((name) => !declaredSet.has(name));
}

// Declared dependencies that name a skill absent from the graph.
export function missingNodes(graph) {
  const out = [];
  for (const [from, requires] of graph) {
    for (const dep of requires) {
      if (!graph.has(dep)) out.push({ from, missing: dep });
    }
  }
  return out;
}

// All directed cycles in the graph. Each cycle is the ordered list of node
// names on it. Edges to missing nodes are not followed (missingNodes reports
// those separately).
export function findCycles(graph) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map([...graph.keys()].map((n) => [n, WHITE]));
  const stack = [];
  const cycles = [];

  function visit(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of graph.get(node) || []) {
      if (!graph.has(dep)) continue;
      if (color.get(dep) === GRAY) {
        cycles.push(stack.slice(stack.indexOf(dep)));
      } else if (color.get(dep) === WHITE) {
        visit(dep);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const name of graph.keys()) {
    if (color.get(name) === WHITE) visit(name);
  }
  return cycles;
}

// The full set of skills pulled in by selecting `start`: start plus every skill
// reachable through its edges. Missing deps are included so callers can reject
// them.
export function transitiveClosure(graph, start) {
  const closure = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (closure.has(node)) continue;
    closure.add(node);
    for (const dep of graph.get(node) || []) {
      if (!closure.has(dep)) queue.push(dep);
    }
  }
  return closure;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/skill-graph.test.mjs`
Expected: PASS — 10 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add tools/skill-graph.mjs tools/skill-graph.test.mjs
git commit -m "feat: #22 add shared skill dependency-graph module"
```

---

### Task 2: Linter core — frontmatter parser and structural checks

**Files:**
- Create: `tools/lint-skills.mjs`
- Test: `tools/lint-skills.test.mjs`

**Interfaces:**
- Consumes: nothing yet (these functions are pure string checks).
- Produces (relied on by Tasks 3–4):
  - `parseFrontmatter(text: string): {ok: true, data: object, body: string} | {ok: false, reason: string}` — `data` holds scalar frontmatter keys (hyphenated keys supported); `body` is the text after the closing `---`.
  - `ALLOWED_KEYS: Set<string>`, `CANONICAL_HEADINGS: string[]`, `ROLE_SUBDIRS: Set<string>` — shared constants.
  - `lintFrontmatter(relPath, data): {errors, warnings}` — missing `name`/`description` → ERROR; malformed `disable-model-invocation` → ERROR; unknown key → WARN.
  - `lintName(relPath, name, dirName): {errors, warnings}` — `name` ≠ directory → ERROR.
  - `lintBody(relPath, body): {errors, warnings}` — > 500 lines → ERROR; > 200 → WARN.
  - `lintHeadings(relPath, body): {errors, warnings}` — near-miss canonical heading → WARN.
  - Every check returns `{errors: string[], warnings: string[]}` with each message prefixed by `relPath`.

- [ ] **Step 1: Write the failing tests**

Create `tools/lint-skills.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/lint-skills.test.mjs`
Expected: FAIL — `Cannot find module './lint-skills.mjs'`.

- [ ] **Step 3: Write the module**

Create `tools/lint-skills.mjs`:

```js
// Advisory two-tier skill linter. Walks the flat skills/ tree and reports
// contract-break ERRORs and style-drift WARNs. Mirrors scripts/validate-docs.mjs:
// pure check functions, a thin filesystem orchestrator, and a default run that
// always exits 0. `--strict` derives a nonzero exit from ERROR presence for CI.

export const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'disable-model-invocation',
  'argument-hint',
]);

export const CANONICAL_HEADINGS = [
  '## Overview',
  '## Required skills',
  '## Integration',
  '## When to Use',
  '## Common Mistakes',
  '## Quick Reference',
];

export const ROLE_SUBDIRS = new Set(['scripts', 'templates', 'assets']);

// Parse a leading YAML-ish frontmatter block. Captures scalar `key: value`
// pairs only (all skill frontmatter keys are scalar); hyphenated keys such as
// `disable-model-invocation` are supported. Deliberately tolerant, like the
// docs validator — but tailored to skills rather than shared with it, since
// skill linting and docs validation are unrelated domains.
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    return { ok: false, reason: 'no opening --- frontmatter fence' };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, reason: 'unterminated frontmatter (no closing ---)' };
  }
  const data = {};
  for (let i = 1; i < end; i += 1) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    data[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { ok: true, data, body: lines.slice(end + 1).join('\n') };
}

// Strip fenced code blocks so illustrative headings inside examples are not
// mistaken for real sections.
function stripFences(text) {
  return text.replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?\n[ \t]*\1[ \t]*$/gm, '');
}

export function lintFrontmatter(relPath, data) {
  const errors = [];
  const warnings = [];
  for (const req of ['name', 'description']) {
    if (typeof data[req] !== 'string' || data[req].trim() === '') {
      errors.push(`${relPath}: missing or empty required frontmatter key \`${req}\``);
    }
  }
  if ('disable-model-invocation' in data) {
    const v = data['disable-model-invocation'];
    if (v !== 'true' && v !== 'false') {
      errors.push(`${relPath}: \`disable-model-invocation\` must be true or false, got "${v}"`);
    }
  }
  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) {
      warnings.push(
        `${relPath}: unknown frontmatter key \`${key}\` (allowed: name, description, disable-model-invocation, argument-hint)`
      );
    }
  }
  return { errors, warnings };
}

export function lintName(relPath, name, dirName) {
  const errors = [];
  if (name !== dirName) {
    errors.push(`${relPath}: frontmatter name "${name}" != directory name "${dirName}"`);
  }
  return { errors, warnings: [] };
}

export function lintBody(relPath, body) {
  const errors = [];
  const warnings = [];
  const count = body.split('\n').length;
  if (count > 500) {
    errors.push(`${relPath}: body is ${count} lines (> 500 hard limit)`);
  } else if (count > 200) {
    warnings.push(`${relPath}: body is ${count} lines (> 200 soft limit)`);
  }
  return { errors, warnings };
}

export function lintHeadings(relPath, body) {
  const warnings = [];
  const canonicalByLower = new Map(
    CANONICAL_HEADINGS.map((h) => [h.toLowerCase(), h])
  );
  for (const line of stripFences(body).split(/\r?\n/)) {
    if (!/^##\s+\S/.test(line)) continue;
    const heading = line.trim();
    const canonical = canonicalByLower.get(heading.toLowerCase());
    if (canonical && canonical !== heading) {
      warnings.push(`${relPath}: heading "${heading}" is a near-miss of canonical "${canonical}"`);
    }
  }
  return { errors: [], warnings };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/lint-skills.test.mjs`
Expected: PASS — 10 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add tools/lint-skills.mjs tools/lint-skills.test.mjs
git commit -m "feat: #22 add skill-linter frontmatter and structural checks"
```

---

### Task 3: Linter dependency, cross-skill, subdir, and README checks

**Files:**
- Modify: `tools/lint-skills.mjs` (add graph-module import + four check functions)
- Test: `tools/lint-skills.test.mjs` (append tests)

**Interfaces:**
- Consumes (from Task 1): `parseRequiredSkills`, `parseRuntimeInvocations`, `reconcileInvocations` from `./skill-graph.mjs`.
- Produces (relied on by Task 4):
  - `lintDependencies(relPath, body, knownSkills): {errors, warnings}` — `knownSkills` is `Map<string, {userInvoked: boolean}>`. Undeclared runtime invocation → ERROR; a declared dependency that exists and is user-invoked → ERROR. (Missing-node and cycle detection are performed at tree level in Task 4 via the graph module.)
  - `lintCrossSkillPaths(relPath, skillName, body, knownSkillNames): {errors, warnings}` — `knownSkillNames` is `Set<string>`. A path into another skill → ERROR.
  - `lintSupportSubdirs(relPath, subdirNames): {errors, warnings}` — `subdirNames` is `string[]` of the skill directory's immediate child directory names. Non-role-named → WARN.
  - `lintReadmeInventory(skillNames, readmeText): {errors, warnings}` — a skill dir missing from the README, or a README entry with no matching dir → WARN.

- [ ] **Step 1: Write the failing tests**

Append to `tools/lint-skills.test.mjs`:

```js
import {
  lintDependencies,
  lintCrossSkillPaths,
  lintSupportSubdirs,
  lintReadmeInventory,
} from './lint-skills.mjs';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/lint-skills.test.mjs`
Expected: FAIL — `lintDependencies`/`lintCrossSkillPaths`/`lintSupportSubdirs`/`lintReadmeInventory` are not exported.

- [ ] **Step 3: Add the graph-module import**

At the very top of `tools/lint-skills.mjs`, before the `export const ALLOWED_KEYS` line, insert:

```js
import {
  parseRequiredSkills,
  parseRuntimeInvocations,
  reconcileInvocations,
} from './skill-graph.mjs';
```

- [ ] **Step 4: Add the four check functions**

Append to `tools/lint-skills.mjs` (after `lintHeadings`):

```js
// knownSkills: Map<name, { userInvoked: boolean }>. Missing-node and cycle
// detection are done at tree level (Task 4) with the shared graph module.
export function lintDependencies(relPath, body, knownSkills) {
  const errors = [];
  const declared = parseRequiredSkills(body);
  const invoked = parseRuntimeInvocations(body);
  for (const name of reconcileInvocations(declared, invoked)) {
    errors.push(`${relPath}: runtime invocation \`/${name}\` is not declared in ## Required skills`);
  }
  for (const dep of declared) {
    if (knownSkills.has(dep) && knownSkills.get(dep).userInvoked) {
      errors.push(
        `${relPath}: required skill "${dep}" is user-invoked (disable-model-invocation: true) and cannot be a dependency`
      );
    }
  }
  return { errors, warnings: [] };
}

export function lintCrossSkillPaths(relPath, skillName, body, knownSkillNames) {
  const errors = [];
  for (const other of knownSkillNames) {
    if (other === skillName) continue;
    if (new RegExp(`(?:skills/|\\.\\./)${other}/`).test(body)) {
      errors.push(
        `${relPath}: references another skill's files by path (skills/${other}/ …); invoke by canonical name instead`
      );
    }
  }
  return { errors, warnings: [] };
}

// subdirNames: the skill directory's immediate child directory names only.
export function lintSupportSubdirs(relPath, subdirNames) {
  const warnings = [];
  for (const name of subdirNames) {
    if (!ROLE_SUBDIRS.has(name)) {
      warnings.push(`${relPath}: support subdir "${name}/" is not role-named (scripts/, templates/, assets/)`);
    }
  }
  return { errors: [], warnings };
}

export function lintReadmeInventory(skillNames, readmeText) {
  const warnings = [];
  const listed = new Set();
  for (const m of readmeText.matchAll(/\]\(skills\/([^/)]+)\/SKILL\.md\)/g)) {
    listed.add(m[1]);
  }
  const actual = new Set(skillNames);
  for (const name of actual) {
    if (!listed.has(name)) {
      warnings.push(`README.md: skill "${name}" is missing from the inventory`);
    }
  }
  for (const name of listed) {
    if (!actual.has(name)) {
      warnings.push(`README.md: inventory lists "${name}" but no such skill directory exists`);
    }
  }
  return { errors: [], warnings };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tools/lint-skills.test.mjs`
Expected: PASS — 19 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add tools/lint-skills.mjs tools/lint-skills.test.mjs
git commit -m "feat: #22 add dependency, cross-skill, subdir, and README linter checks"
```

---

### Task 4: Linter orchestrator, report, and CLI with strict mode

**Files:**
- Modify: `tools/lint-skills.mjs` (add filesystem imports, `collectSkills`, `lintSkillTree`, `formatReport`, `main`)
- Test: `tools/lint-skills.test.mjs` (append fixture-tree + spawned-CLI tests)

**Interfaces:**
- Consumes (from Task 1): `missingNodes`, `findCycles`, `parseRequiredSkills` from `./skill-graph.mjs`; all check functions from Tasks 2–3.
- Produces:
  - `collectSkills(skillsRoot): Promise<Map<name, {relPath, dirName, text, data, body, fmOk, fmReason, subdirNames}>>` — one entry per immediate child directory of `skillsRoot` that contains a `SKILL.md`.
  - `lintSkillTree(skillsRoot, readmeText): Promise<{errors, warnings}>` — runs every check, plus tree-level `missingNodes` and `findCycles`, plus README drift.
  - `formatReport({errors, warnings}): string` — two-tier report; a clean tree returns a single conformant line.
  - CLI: `node tools/lint-skills.mjs [--strict] [skillsRoot] [readmePath]`. Default exits 0 always; `--strict` exits 1 iff `errors.length > 0`.

- [ ] **Step 1: Write the failing tests**

Append to `tools/lint-skills.test.mjs`:

```js
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectSkills, lintSkillTree, formatReport } from './lint-skills.mjs';

const CLI = fileURLToPath(new URL('./lint-skills.mjs', import.meta.url));

async function makeTree(skills) {
  const root = await mkdtemp(join(tmpdir(), 'skill-lint-'));
  for (const [name, files] of Object.entries(skills)) {
    await mkdir(join(root, name), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, name, rel);
      await mkdir(join(full, '..'), { recursive: true });
      await writeFile(full, content);
    }
  }
  return root;
}

test('formatReport returns a single line for a clean tree', () => {
  assert.match(formatReport({ errors: [], warnings: [] }), /all skills conform/);
});

test('formatReport shows both tiers and a summary', () => {
  const out = formatReport({ errors: ['e1'], warnings: ['w1'] });
  assert.match(out, /ERRORS/);
  assert.match(out, /Warnings/);
  assert.match(out, /1 error\(s\), 1 warning\(s\)/);
});

test('collectSkills picks up only directories with a SKILL.md', async () => {
  const root = await makeTree({
    good: { 'SKILL.md': '---\nname: good\ndescription: d\n---\nbody' },
    notaskill: { 'notes.md': 'x' },
  });
  try {
    const skills = await collectSkills(root);
    assert.deepEqual([...skills.keys()], ['good']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lintSkillTree classifies a clean skill with no findings', async () => {
  const root = await makeTree({
    alpha: { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\n## Overview\n\nok' },
  });
  try {
    const readme = '## Skills\n\n- [`alpha`](skills/alpha/SKILL.md) — a.';
    const { errors, warnings } = await lintSkillTree(root, readme);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lintSkillTree reports a name mismatch as an ERROR', async () => {
  const root = await makeTree({
    alpha: { 'SKILL.md': '---\nname: beta\ndescription: d\n---\n## Overview\n' },
  });
  try {
    const { errors } = await lintSkillTree(root, '');
    assert.ok(errors.some((e) => /!= directory name/.test(e)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lintSkillTree reports a dependency cycle as an ERROR', async () => {
  const root = await makeTree({
    a: { 'SKILL.md': '---\nname: a\ndescription: d\n---\n## Required skills\n\n- b\n' },
    b: { 'SKILL.md': '---\nname: b\ndescription: d\n---\n## Required skills\n\n- a\n' },
  });
  try {
    const { errors } = await lintSkillTree(root, '');
    assert.ok(errors.some((e) => /cycle/.test(e)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lintSkillTree reports a missing required skill as an ERROR', async () => {
  const root = await makeTree({
    a: { 'SKILL.md': '---\nname: a\ndescription: d\n---\n## Required skills\n\n- ghost\n' },
  });
  try {
    const { errors } = await lintSkillTree(root, '');
    assert.ok(errors.some((e) => /ghost/.test(e) && /does not exist/.test(e)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI exits 0 by default even with errors, and 1 under --strict', async () => {
  const root = await makeTree({
    a: { 'SKILL.md': '---\nname: mismatch\ndescription: d\n---\n## Overview\n' },
  });
  try {
    const plain = spawnSync(process.execPath, [CLI, root, '/dev/null'], { encoding: 'utf8' });
    assert.equal(plain.status, 0);
    assert.match(plain.stdout, /ERRORS/);

    const strict = spawnSync(process.execPath, [CLI, '--strict', root, '/dev/null'], { encoding: 'utf8' });
    assert.equal(strict.status, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/lint-skills.test.mjs`
Expected: FAIL — `collectSkills`/`lintSkillTree`/`formatReport` are not exported.

- [ ] **Step 3: Add the filesystem imports**

Replace the graph-module import block at the top of `tools/lint-skills.mjs` (added in Task 3) with this expanded version:

```js
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRequiredSkills,
  parseRuntimeInvocations,
  reconcileInvocations,
  missingNodes,
  findCycles,
} from './skill-graph.mjs';
```

- [ ] **Step 4: Add the orchestrator, report, and CLI**

Append to `tools/lint-skills.mjs` (after `lintReadmeInventory`):

```js
// One entry per immediate child directory of skillsRoot that contains a SKILL.md.
export async function collectSkills(skillsRoot) {
  const skills = new Map();
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return skills;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dirName = e.name;
    const skillDir = join(skillsRoot, dirName);
    let text;
    try {
      text = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
    } catch {
      continue; // not a skill directory
    }
    const fm = parseFrontmatter(text);
    const children = await readdir(skillDir, { withFileTypes: true });
    const subdirNames = children.filter((c) => c.isDirectory()).map((c) => c.name);
    skills.set(dirName, {
      relPath: dirName,
      dirName,
      text,
      data: fm.ok ? fm.data : {},
      body: fm.ok ? fm.body : '',
      fmOk: fm.ok,
      fmReason: fm.ok ? null : fm.reason,
      subdirNames,
    });
  }
  return skills;
}

export async function lintSkillTree(skillsRoot, readmeText) {
  const errors = [];
  const warnings = [];
  const skills = await collectSkills(skillsRoot);
  const knownSkillNames = new Set(skills.keys());
  const knownSkills = new Map();
  for (const [name, s] of skills) {
    knownSkills.set(name, { userInvoked: s.data['disable-model-invocation'] === 'true' });
  }

  const collect = (r) => {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  };

  for (const [name, s] of skills) {
    const rel = `${s.relPath}/SKILL.md`;
    if (!s.fmOk) {
      errors.push(`${rel}: ${s.fmReason}`);
      continue;
    }
    collect(lintFrontmatter(rel, s.data));
    collect(lintName(rel, s.data.name, s.dirName));
    collect(lintBody(rel, s.body));
    collect(lintHeadings(rel, s.body));
    collect(lintDependencies(rel, s.body, knownSkills));
    collect(lintCrossSkillPaths(rel, name, s.body, knownSkillNames));
    collect(lintSupportSubdirs(s.relPath, s.subdirNames));
  }

  // Graph-level checks use the shared module over the whole tree.
  const graph = new Map();
  for (const [name, s] of skills) {
    graph.set(name, s.fmOk ? parseRequiredSkills(s.body) : []);
  }
  for (const { from, missing } of missingNodes(graph)) {
    errors.push(`${from}/SKILL.md: required skill "${missing}" does not exist in the library`);
  }
  for (const cycle of findCycles(graph)) {
    errors.push(`dependency cycle: ${cycle.join(' -> ')} -> ${cycle[0]}`);
  }

  collect(lintReadmeInventory([...knownSkillNames], readmeText));
  return { errors, warnings };
}

export function formatReport({ errors, warnings }) {
  if (errors.length === 0 && warnings.length === 0) {
    return 'lint:skills — all skills conform; no findings.';
  }
  const lines = [];
  if (errors.length > 0) {
    lines.push(`ERRORS — contract breaks (${errors.length}):`);
    for (const e of errors) lines.push(`  ${e}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`Warnings — style drift (${warnings.length}):`);
    for (const w of warnings) lines.push(`  ${w}`);
    lines.push('');
  }
  lines.push(`${errors.length} error(s), ${warnings.length} warning(s).`);
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const skillsRoot = positional[0] || 'skills';
  const readmePath = positional[1] || 'README.md';
  let readmeText = '';
  try {
    readmeText = await readFile(readmePath, 'utf8');
  } catch {
    // README drift is advisory; a missing README simply yields no drift signal.
  }
  const result = await lintSkillTree(skillsRoot, readmeText);
  console.log(formatReport(result));
  process.exit(strict && result.errors.length > 0 ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tools/lint-skills.test.mjs`
Expected: PASS — 27 tests, 0 failures.

- [ ] **Step 6: Run the linter against the real tree**

Run: `node tools/lint-skills.mjs`
Expected: exit 0. Output lists findings for `okf-docs-setup` in two-tier format. At this point `okf-docs-setup/SKILL.md` still has two near-miss heading WARNs (`## When to use`, `## Common mistakes`) and possibly a body-over-200 WARN — but **zero ERRORs**. Confirm no `ERRORS —` section appears. (If it does, stop and reconcile before Task 5.)

- [ ] **Step 7: Commit**

```bash
git add tools/lint-skills.mjs tools/lint-skills.test.mjs
git commit -m "feat: #22 add skill-linter orchestrator, report, and strict CLI"
```

---

### Task 5: Conformance fixes for `okf-docs-setup`

**Files:**
- Modify: `skills/okf-docs-setup/SKILL.md`

**Interfaces:**
- Consumes: the linter from Task 4 (used only for verification).
- Produces: an `okf-docs-setup` skill that lints with zero ERRORs, with `assets/` byte-identical to before.

Read `skills/okf-docs-setup/SKILL.md` first (the Edit tool requires it). The four edits below are exact-match against the current bytes.

- [ ] **Step 1: Add `## Integration`, remove the inline note, and fix the `When to Use` casing**

This single edit removes the inline `REQUIRED SUB-SKILL` note from `## Overview`, adds a dedicated `## Integration` section for the external namespaced sub-skill (`superpowers:dispatching-parallel-agents`, which belongs to another library and so is declared in prose, never in `## Required skills`), and corrects `## When to use` → `## When to Use`.

Edit — replace:

```md
**REQUIRED SUB-SKILL:** Use superpowers:dispatching-parallel-agents for the fan-out in
Phase 2.

## When to use
```

with:

```md
## Integration

- **Required sub-skill:** Invoke `/superpowers:dispatching-parallel-agents` for the Phase 2
  fan-out — the parallel authoring of subsystem index nodes and existing-doc conversions.

## When to Use
```

- [ ] **Step 2: Fix the `Common Mistakes` casing**

Edit — replace `## Common mistakes` with `## Common Mistakes`.

- [ ] **Step 3: Replace the harness-specific tool name in the Phase 1 heading**

Edit — replace:

```md
### Phase 1 — Install the machinery (orchestrator, via the shell — NOT agents, NOT the Edit tool)
```

with:

```md
### Phase 1 — Install the machinery (orchestrator, via the shell — NOT agents, NOT in-place edits)
```

- [ ] **Step 4: Replace the harness-specific tool names in the Phase 1 body**

Edit — replace:

```md
Copy with the shell and substitute in place with `sed`/a script. Copying a file and then
`Edit`-ing it trips the harness read-gate (the copy was never Read at its new path); `cp`
```

with:

```md
Copy with the shell and substitute in place with `sed`/a script. Copying a file and then
editing it in place trips the harness read-gate (the copy was never read at its new path); `cp`
```

- [ ] **Step 5: Verify the skill lints with zero ERRORs**

Run: `node tools/lint-skills.mjs`
Expected: exit 0, and **no `ERRORS —` section** in the output. A `Warnings —` section may still list a body-over-200 soft WARN for `okf-docs-setup` — that is acceptable (WARNs never fail the gate). The two near-miss heading WARNs must be **gone**.

- [ ] **Step 6: Verify `assets/` is byte-identical**

Run: `git diff --stat -- skills/okf-docs-setup && git diff --quiet -- skills/okf-docs-setup/assets/ && echo "ASSETS UNCHANGED"`
Expected: the stat shows only `skills/okf-docs-setup/SKILL.md` changed, and the command prints `ASSETS UNCHANGED`.

- [ ] **Step 7: Commit**

```bash
git add skills/okf-docs-setup/SKILL.md
git commit -m "fix: #22 bring okf-docs-setup SKILL.md to zero linter ERRORs"
```

---

### Task 6: npm scripts, docs-maintenance glob, and static CI

**Files:**
- Modify: `package.json`
- Modify: `.claude/rules/docs-maintenance.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the linter (Task 4) and the existing `docs:validate` script.
- Produces: `npm run lint:skills`, `npm run lint:skills:strict`, `npm run lint:skills:test`; an aggregate `npm test` that also covers `tools/`; a docs-maintenance rule that watches `tools/`; and one CI workflow whose only gate is the strict linter.

- [ ] **Step 1: Add the linter npm scripts and extend the aggregate test script**

The current `package.json` scripts block is:

```json
  "scripts": {
    "docs:validate": "node scripts/validate-docs.mjs",
    "docs:validate:test": "node --test scripts/validate-docs.test.mjs",
    "release": "node scripts/release.mjs",
    "test": "node --test scripts/*.test.mjs"
  }
```

Edit — replace it with:

```json
  "scripts": {
    "docs:validate": "node scripts/validate-docs.mjs",
    "docs:validate:test": "node --test scripts/validate-docs.test.mjs",
    "lint:skills": "node tools/lint-skills.mjs",
    "lint:skills:strict": "node tools/lint-skills.mjs --strict",
    "lint:skills:test": "node --test tools/*.test.mjs",
    "release": "node scripts/release.mjs",
    "test": "node --test scripts/*.test.mjs tools/*.test.mjs"
  }
```

- [ ] **Step 2: Verify the scripts run**

Run: `npm run lint:skills:test && npm test && npm run lint:skills`
Expected: the `tools/` tests pass; the aggregate suite (scripts + tools) passes; `lint:skills` prints findings and exits 0.

- [ ] **Step 3: Extend the docs-maintenance glob to cover `tools/`**

The current frontmatter of `.claude/rules/docs-maintenance.md` is:

```yaml
---
paths:
  - "skills/**/*"
  - "scripts/**/*"
---
```

Edit — replace:

```yaml
  - "scripts/**/*"
---
```

with:

```yaml
  - "scripts/**/*"
  - "tools/**/*"
---
```

- [ ] **Step 4: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  static-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Skill linter (strict — the only gate)
        run: npm run lint:skills:strict
      - name: Docs validator (advisory — never fails the job)
        run: npm run docs:validate
```

There is no dependency-install step: the project has zero dependencies, so `npm run` executes the Node scripts directly. There are no Actions secrets and no scheduled triggers, per the CI decision.

- [ ] **Step 5: Verify the gate goes green on a clean tree and red on an introduced ERROR**

Run (green case): `npm run lint:skills:strict; echo "exit=$?"`
Expected: `exit=0` (the tree is clean after Task 5).

Now prove the gate can go red without committing the break. Temporarily rename a skill directory so its `name` no longer matches:

```bash
git mv skills/okf-docs-setup skills/okf-docs-setup-temp
npm run lint:skills:strict; echo "exit=$?"
```

Expected: the output shows an `ERRORS —` section with a `name … != directory name` finding **and** a README-drift WARN, and `exit=1`.

Restore immediately:

```bash
git mv skills/okf-docs-setup-temp skills/okf-docs-setup
npm run lint:skills:strict; echo "exit=$?"
```

Expected: `exit=0`. Confirm `git status` is clean of the temporary rename before proceeding.

- [ ] **Step 6: Commit**

```bash
git add package.json .claude/rules/docs-maintenance.md .github/workflows/ci.yml
git commit -m "ci: #22 wire skill-linter scripts, docs-maintenance glob, and static CI"
```

---

## Acceptance Criteria Mapping

Each issue #22 acceptance criterion, and where the plan satisfies it:

- **Linter default run exits 0 with two-tier output; strict mode exits nonzero on ERRORs** — Task 4 Steps 3–6 (`formatReport`, `main` exit logic); Task 4 Step 1 spawned-CLI test.
- **All ERROR and WARN classes covered by unit tests (Node built-in runner, zero deps)** — Tasks 2–4: frontmatter-allowlist, name≠dir, undeclared invocation, required-skill-user-invoked, cross-skill path, dependency cycle, missing node, body>500 (ERRORs); body>200, near-miss heading, non-role-named subdir, unknown key, README drift (WARNs).
- **Graph module exposed for reuse: parse, reconcile, missing-node/cycle detection, closure — with its own tests** — Task 1 (`tools/skill-graph.mjs` + `tools/skill-graph.test.mjs`).
- **`okf-docs-setup` lints with zero ERRORs; `assets/` byte-identical** — Task 5 Steps 5–6.
- **CI green on a clean branch, red when an ERROR is introduced; docs-validate visible but never failing** — Task 6 Steps 4–5.
- **npm scripts wired for linter run + tests; docs-maintenance rule glob covers `tools/`** — Task 6 Steps 1, 3.

**Deliberately out of scope** (per the ticket): the "skill with no central test-case directory" WARN arrives with the test-runner ticket that creates the central `tools/` case layout. The linter does not check for a missing required section, `description` ≤ 1024 chars, or naming style beyond kebab-case — none are in the ticket's ERROR/WARN class list (YAGNI).
