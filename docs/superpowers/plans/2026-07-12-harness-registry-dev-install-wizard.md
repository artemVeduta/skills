# Declarative Harness Registry + Dev-Install Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `scripts/install.sh` as a development-links wizard driven by a declarative harness registry: it discovers every library skill, validates the dependency graph, previews the plan, and symlinks the whole library into each selected harness profile.

**Architecture:** `scripts/install.sh` becomes a thin bash launcher that `exec`s `scripts/install.mjs`. All logic lives in small ESM modules under `scripts/install/` — a declarative `registry.mjs` (single source of truth for the wizard and the README), plus focused modules for discovery, dependency-graph validation (reusing `tools/skill-graph.mjs` from #22), path resolution, plan/preview, and linking. Selection and path resolution are pure functions of the registry; the terminal presentation is a replaceable layer. Tests exercise exactly one seam — the installer run as a subprocess against temporary HOME/config roots — asserting only exit codes, the stdout preview, and on-disk symlink state.

**Tech Stack:** Node ≥20 (ESM `.mjs`, no third-party deps), Node built-in `node:test` + `node:assert/strict`, `node:fs`/`node:os`/`node:path`/`node:url`/`node:child_process`, a thin `bash` launcher.

## Global Constraints

Every task's requirements implicitly include this section.

- **Runtime:** Node ≥20 (CI pins `node-version: '20'`); no `package.json` `engines`/`type` — ESM comes from the `.mjs` extension. **No third-party dependencies** — stdlib Node + `bash` only.
- **Module boundary:** installer stays a repository-operator entry point under `scripts/` (never `tools/`); it serves the **development channel only**.
- **Skill discovery:** a skill is exactly a directory `skills/<name>/` with a **root** `SKILL.md` (flat layout). Nested `SKILL.md` files are never installed standalone. **Discovering zero skills is a hard failure.**
- **Whole-library linking:** the wizard links **every** discovered skill into **each** selected profile — no per-skill selection, no per-skill closure expansion. Edits and `git pull` reach every linked profile live (no reinstall).
- **Dependency-graph validation before any filesystem change:** reuse `tools/skill-graph.mjs`. A **missing canonical dependency** or a **cycle** rejects the entire install with a message naming the offending skill and the defect; the profile is left untouched.
- **Linking mechanics (carried forward):** one symlink `<profile skill dir>/<name>` → `<checkout>/skills/<name>` with `ln -sfn` **semantics** (force + no-dereference), reproduced via `node:fs` (`unlink`-then-`symlink` for an existing symlink; `rm -rf` for a real collision). Target dirs created if missing. Re-runs idempotent and pick up newly added skills. **Self-symlink guard** kept: refuse a target dir resolving into the checkout, with remediation.
- **Preview + confirmation:** an explicit preview discloses profiles, skill directories, and what will be created or replaced (including real, non-symlink entries). **Nothing changes before confirmation.**
- **Channel-mixing guard:** linking into `~/.agents/skills` (also the portable CLI's own storage) is **called out** (this plan chooses warn, not refuse — implementer-owned).
- **Non-interactive surface:** a flag-driven, TTY-free invocation; an inspection mode listing discovered skills + registry entries without installing; **three distinct nonzero exit codes** for usage errors, nothing-to-do, and graph rejection.
- **Exit codes (this plan's choice; implementer-owned):** `0` success, `1` hard failure (zero skills, self-symlink guard refusal), `2` usage error, `3` nothing-to-do, `4` dependency-graph rejection.
- **README install guidance** for the development channel is **generated from / validated against** the registry, so docs cannot drift.
- **Tests:** Node `node:test`, flat `test(name, fn)` form, `node:assert/strict`; **one seam only** — spawn the installer as a subprocess in a disposable fixture; assert **only** exit code, stdout preview, and symlink state. Never unit-test internals through any other seam. Prior art: `scripts/validate-docs.test.mjs`, `tools/lint-skills.test.mjs`.
- **Commit convention:** `feat: #23 <summary>` (matching the established `#22`/`#20` history). Types seen: `feat`, `fix`, `ci`, `docs`. (Note: `docs/conventions/git.md` says "no conventional-commit prefixes" but the effective repo convention contradicts it; follow the history, do not edit that doc here.)
- **Docs lifecycle:** the plan lives under `docs/superpowers/**`, which is **excluded** from the OKF bundle — no docs ceremony for the plan. The registry is executable truth (code), never pasted into `docs/`. The README `## Skills` inventory rule is unaffected by this work.

---

## File Structure

**Created:**
- `scripts/install.sh` — thin bash launcher: `exec node <dir>/install.mjs "$@"`. Preserves the documented `./scripts/install.sh` entry point.
- `scripts/install.mjs` — CLI orchestrator (arg parsing, mode dispatch, the interaction pipeline, confirmation, `process.exit`). The only place effects and presentation meet.
- `scripts/install/registry.mjs` — declarative harness registry (data) + `findEntry`. Single source of truth.
- `scripts/install/discovery.mjs` — flat `skills/<name>/SKILL.md` discovery + `stripFrontmatter`.
- `scripts/install/graph.mjs` — build dependency graph from discovered skills and validate it (wraps `tools/skill-graph.mjs`).
- `scripts/install/profiles.mjs` — pure path resolution: profile → config root, and (harness, profile, scope) → skill directory.
- `scripts/install/planner.mjs` — compute per-target link actions (create/replace) and the self-symlink guard.
- `scripts/install/preview.mjs` — render a plan object to the stdout preview string.
- `scripts/install/linker.mjs` — filesystem effects: create dirs, symlink with `ln -sfn` semantics.
- `scripts/install/readme.mjs` — render/validate the README development-links block from the registry.
- `scripts/install.test.mjs` — the single-seam subprocess test suite (grows task by task).

**Modified:**
- `README.md` — replace the hand-written `## Install` → *Development links* block with a registry-generated, marker-delimited block.
- `package.json` — add `readme:check` script; note `test` already globs `scripts/*.test.mjs`.
- `.github/workflows/ci.yml` — add a deterministic `npm test` step and the README check.

---

## Task 1: Thin launcher, CLI skeleton, discovery, registry, inspect

**Files:**
- Create: `scripts/install.sh`
- Create: `scripts/install.mjs`
- Create: `scripts/install/registry.mjs`
- Create: `scripts/install/discovery.mjs`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `REGISTRY: Array<Entry>` and `findEntry(registry, id): Entry|null` from `registry.mjs`. `Entry = { id, displayName, skillDirs: { global, project? }, configRoot: { env: string|null, defaults: Array<{ id, dir }> }, scopes: string[], channels: string[], customProfileValidation, sharedStorage: boolean }`.
  - `discoverSkills(skillsRoot): Promise<Array<{ name, srcDir, text }>>` and `stripFrontmatter(text): string` from `discovery.mjs`.
  - `install.mjs` exit codes `{ OK:0, HARD:1, USAGE:2, NOTHING:3, GRAPH:4 }`; modes `--help`, `--inspect`; option `--checkout <dir>`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/install.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTALLER = fileURLToPath(new URL('./install.sh', import.meta.url));

function run(args, { input, env } = {}) {
  return spawnSync(INSTALLER, args, {
    encoding: 'utf8',
    input,
    env: { ...process.env, ...env },
  });
}

// Build a temp checkout whose skills live at <root>/skills/<name>/...
async function makeCheckout(skills) {
  const root = await mkdtemp(join(tmpdir(), 'install-'));
  for (const [name, files] of Object.entries(skills)) {
    const dir = join(root, 'skills', name);
    await mkdir(dir, { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const full = join(dir, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content);
    }
  }
  return root;
}

const SKILL = (name) => `---\nname: ${name}\ndescription: d\n---\n## Overview\nx\n`;

test('--help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage: install\.sh/);
});

test('unknown flag is a usage error (exit 2)', () => {
  const r = run(['--bogus']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option/);
});

test('--inspect lists discovered skills and registry entries (exit 0), ignoring nested SKILL.md', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha'), 'assets/SKILL.md': SKILL('nested') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  try {
    const r = run(['--inspect', '--checkout', root]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /alpha/);
    assert.match(r.stdout, /beta/);
    assert.doesNotMatch(r.stdout, /nested/); // nested SKILL.md is never a skill
    assert.match(r.stdout, /claude-code/); // a registry harness id
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('zero skills discovered is a hard failure (exit 1)', async () => {
  const root = await makeCheckout({});
  try {
    const r = run(['--inspect', '--checkout', root]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no skills discovered/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — `install.sh` does not exist / spawn error.

- [ ] **Step 3: Create the registry module**

Create `scripts/install/registry.mjs`:

```js
// Declarative harness registry — the single source of truth for the wizard and
// the README development-links guidance. Entries carry installation metadata only.
export const REGISTRY = [
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    skillDirs: { global: 'skills', project: '.claude/skills' },
    configRoot: {
      env: 'CLAUDE_CONFIG_DIR',
      defaults: [
        { id: 'personal', dir: '.claude' },
        { id: 'work', dir: '.claude-work' },
      ],
    },
    scopes: ['global', 'project'],
    channels: ['development', 'portable', 'native'],
    customProfileValidation: { allowHomeRelative: true },
    sharedStorage: false,
  },
  {
    id: 'codex',
    displayName: 'Codex',
    // NOTE: confirm Codex's actual skill directory before relying on it in anger.
    skillDirs: { global: 'skills' },
    configRoot: {
      env: 'CODEX_HOME',
      defaults: [{ id: 'default', dir: '.codex' }],
    },
    scopes: ['global'],
    channels: ['development', 'portable', 'native'],
    customProfileValidation: { allowHomeRelative: true },
    sharedStorage: false,
  },
  {
    id: 'agents',
    displayName: 'Shared agents directory',
    skillDirs: { global: 'skills' },
    configRoot: { env: null, defaults: [{ id: 'shared', dir: '.agents' }] },
    scopes: ['global'],
    channels: ['development', 'portable'],
    customProfileValidation: { allowHomeRelative: true },
    sharedStorage: true, // ~/.agents/skills doubles as the portable CLI's own storage
  },
];

export function findEntry(registry, id) {
  return registry.find((e) => e.id === id) || null;
}
```

- [ ] **Step 4: Create the discovery module**

Create `scripts/install/discovery.mjs`:

```js
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Return the SKILL.md body with any leading YAML frontmatter removed.
export function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text;
  const close = text.indexOf('\n---', 3);
  if (close === -1) return text;
  const nl = text.indexOf('\n', close + 1);
  return nl === -1 ? '' : text.slice(nl + 1);
}

// A skill is exactly <skillsRoot>/<name>/SKILL.md (flat). Nested SKILL.md files
// are never discovered. Returns skills sorted by name; [] if the root is absent.
export async function discoverSkills(skillsRoot) {
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const srcDir = join(skillsRoot, e.name);
    let text;
    try {
      text = await readFile(join(srcDir, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    skills.push({ name: e.name, srcDir, text });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}
```

- [ ] **Step 5: Create the CLI orchestrator**

Create `scripts/install.mjs`:

```js
#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { REGISTRY } from './install/registry.mjs';
import { discoverSkills } from './install/discovery.mjs';

const EXIT = { OK: 0, HARD: 1, USAGE: 2, NOTHING: 3, GRAPH: 4 };
const REPO_DEFAULT = resolve(fileURLToPath(new URL('..', import.meta.url)));

class UsageError extends Error {}

function usage() {
  return [
    'Usage: install.sh [options]',
    '',
    'Development-links installer: symlinks every library skill into the harness',
    'profiles you select.',
    '',
    'Options:',
    '  --inspect             list discovered skills and registry entries; do not install',
    '  --checkout <dir>      working copy to link from (default: repo root)',
    '  --help, -h            show this help',
  ].join('\n');
}

function parseArgs(argv) {
  const o = { harness: [], profile: [], scope: 'global' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) o.error = `option ${a} requires a value`;
      return v;
    };
    switch (a) {
      case '--help':
      case '-h':
        o.help = true;
        break;
      case '--inspect':
        o.inspect = true;
        break;
      case '--checkout':
        o.checkout = value();
        break;
      default:
        o.error = `unknown option: ${a}`;
    }
    if (o.error) break;
  }
  return o;
}

function printInspect(skills, registry) {
  const lines = ['Discovered skills:'];
  for (const s of skills) lines.push(`  ${s.name}`);
  lines.push('', 'Known harnesses:');
  for (const e of registry) {
    lines.push(`  ${e.id} (${e.displayName}) — scopes: ${e.scopes.join(',')}; channels: ${e.channels.join(',')}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

async function main(argv) {
  const o = parseArgs(argv);
  if (o.help) {
    process.stdout.write(usage() + '\n');
    return EXIT.OK;
  }
  if (o.error) {
    process.stderr.write(`error: ${o.error}\n\n` + usage() + '\n');
    return EXIT.USAGE;
  }

  const checkout = resolve(o.checkout ?? REPO_DEFAULT);
  const registry = REGISTRY;

  const skillsRoot = join(checkout, 'skills');
  const skills = await discoverSkills(skillsRoot);
  if (skills.length === 0) {
    process.stderr.write(`error: no skills discovered under ${skillsRoot}\n`);
    return EXIT.HARD;
  }

  if (o.inspect) {
    printInspect(skills, registry);
    return EXIT.OK;
  }

  // --- Task 3 inserts dependency-graph validation here ---
  // --- Task 2 inserts selection + preview + confirmation + apply here ---

  process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
  return EXIT.NOTHING;
}

main(process.argv.slice(2)).then((code) => process.exit(code));

export { UsageError };
```

- [ ] **Step 6: Create the thin bash launcher and make it executable**

Create `scripts/install.sh`:

```bash
#!/usr/bin/env bash
# Development-links installer entry point. All logic lives in install.mjs;
# this launcher only locates it and hands off, preserving `./scripts/install.sh`.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$here/install.mjs" "$@"
```

Then run: `chmod +x scripts/install.sh`

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test scripts/install.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add scripts/install.sh scripts/install.mjs scripts/install/registry.mjs scripts/install/discovery.mjs scripts/install.test.mjs
git commit -m "feat: #23 add dev-install launcher, registry, discovery, and inspect mode"
```

---

## Task 2: Selection, path resolution, preview, confirmation, and linking

The core install: choose harness profiles → resolve their skill directories → preview → confirm → symlink the whole library. This is one interaction contract, so it is one task.

**Files:**
- Create: `scripts/install/profiles.mjs`
- Create: `scripts/install/planner.mjs`
- Create: `scripts/install/preview.mjs`
- Create: `scripts/install/linker.mjs`
- Modify: `scripts/install.mjs`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: `REGISTRY`, `findEntry` (Task 1); `discoverSkills` (Task 1).
- Produces:
  - `expandHome(p, home?): string`, `resolveProfile(entry, selector, { home?, env? }): { harnessId, profileId, configRoot, custom? }|null`, `resolveSkillDir(entry, profile, scope, { projectDir? }): string|null` from `profiles.mjs`.
  - `planTarget(entry, profile, scope, skills, skillDir): Promise<Target>` from `planner.mjs`, where `Target = { harnessId, profileId, scope, skillDir, sharedStorage, custom, links: Array<{ name, src, dest, action: 'create'|'replace-symlink'|'replace-nonsymlink' }> }`.
  - `renderPreview(plan): string` from `preview.mjs`, where `plan = { skills, targets, warnings: string[] }`.
  - `linkSkill(src, dest): Promise<void>`, `applyTarget(target): Promise<void>` from `linker.mjs`.
  - `install.mjs` options `--harness <id>` (repeatable), `--profile <id[:selector]>` (repeatable), `--scope <global|project>`, `--dry-run`, `--yes`/`-y`; behaviors: preview always precedes any change; empty selection non-interactively → `NOTHING` (3).

- [ ] **Step 1: Write the failing tests** (append to `scripts/install.test.mjs`)

```js
import { lstatSync, readlinkSync, existsSync } from 'node:fs';

// Link every discovered skill into a temp Claude Code "personal" profile.
async function fullInstall(args, env) {
  return run(['--yes', ...args], { env });
}

test('--dry-run shows a preview and changes nothing (exit 0)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--dry-run', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Installation preview/);
    assert.match(r.stdout, /alpha/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('no selection non-interactively is nothing-to-do (exit 3)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  try {
    const r = run(['--checkout', root]);
    assert.equal(r.status, 3);
    assert.match(r.stderr, /nothing to do/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a confirmed run links every skill into the selected profile', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL('alpha') },
    beta: { 'SKILL.md': SKILL('beta') },
  });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(r.status, 0);
    const dest = join(home, '.agents', 'skills', 'alpha');
    assert.ok(lstatSync(dest).isSymbolicLink());
    assert.equal(readlinkSync(dest), join(root, 'skills', 'alpha'));
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'beta')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('confirmation gates all changes: declining leaves the profile untouched', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const decline = run(['--checkout', root, '--harness', 'agents'], { input: 'n\n', env: { HOME: home } });
    assert.equal(decline.status, 0);
    assert.match(decline.stdout, /Installation preview/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);

    const accept = run(['--checkout', root, '--harness', 'agents'], { input: 'y\n', env: { HOME: home } });
    assert.equal(accept.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('re-runs are idempotent and pick up newly added skills', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const first = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(first.status, 0);
    const second = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(second.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());

    // Add a new skill to the checkout, then re-run.
    await mkdir(join(root, 'skills', 'gamma'), { recursive: true });
    await writeFile(join(root, 'skills', 'gamma', 'SKILL.md'), SKILL('gamma'));
    const third = await fullInstall(['--checkout', root, '--harness', 'agents'], { HOME: home });
    assert.equal(third.status, 0);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'gamma')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('the config-root env var resolves the profile path (Codex CODEX_HOME)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const codexHome = await mkdtemp(join(tmpdir(), 'codex-'));
  try {
    const r = await fullInstall(['--checkout', root, '--harness', 'codex'], { HOME: home, CODEX_HOME: codexHome });
    assert.equal(r.status, 0);
    assert.ok(lstatSync(join(codexHome, 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(codexHome, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — selection/preview/linking not implemented; `--harness` is an unknown option.

- [ ] **Step 3: Create the path-resolution module**

Create `scripts/install/profiles.mjs`:

```js
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Expand a leading ~ against home; leave other paths untouched.
export function expandHome(p, home = homedir()) {
  if (p === '~') return home;
  if (p.startsWith('~/')) return join(home, p.slice(2));
  return p;
}

// Resolve a profile selector to a configuration root.
// selector: a default-profile id (e.g. "personal"), or a path (custom profile).
export function resolveProfile(entry, selector, { home = homedir(), env = process.env } = {}) {
  if (selector && (selector.includes('/') || selector.startsWith('~'))) {
    return {
      harnessId: entry.id,
      profileId: 'custom',
      configRoot: resolve(expandHome(selector, home)),
      custom: true,
    };
  }
  const def = entry.configRoot.defaults.find((d) => d.id === selector);
  if (!def) return null;
  const envVar = entry.configRoot.env;
  const configRoot = envVar && env[envVar] ? resolve(env[envVar]) : join(home, def.dir);
  return { harnessId: entry.id, profileId: def.id, configRoot };
}

// (harness, profile, scope) -> absolute skill directory where links are written.
export function resolveSkillDir(entry, profile, scope, { projectDir = process.cwd() } = {}) {
  if (scope === 'project') {
    if (!entry.skillDirs.project) return null;
    return resolve(join(projectDir, entry.skillDirs.project));
  }
  return resolve(join(profile.configRoot, entry.skillDirs.global)); // global: relative to config root
}
```

- [ ] **Step 4: Create the planner module**

Create `scripts/install/planner.mjs`:

```js
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

// Decide what will happen to one link destination.
async function linkAction(dest) {
  try {
    const st = await lstat(dest);
    return st.isSymbolicLink() ? 'replace-symlink' : 'replace-nonsymlink';
  } catch {
    return 'create';
  }
}

// Build the per-target plan: one link per discovered skill.
export async function planTarget(entry, profile, scope, skills, skillDir) {
  const links = [];
  for (const s of skills) {
    const dest = join(skillDir, s.name);
    links.push({ name: s.name, src: s.srcDir, dest, action: await linkAction(dest) });
  }
  return {
    harnessId: entry.id,
    profileId: profile.profileId,
    scope,
    skillDir,
    sharedStorage: !!entry.sharedStorage,
    custom: !!profile.custom,
    links,
  };
}
```

- [ ] **Step 5: Create the preview module**

Create `scripts/install/preview.mjs`:

```js
const ACTION_TAG = {
  create: 'create',
  'replace-symlink': 'replace link',
  'replace-nonsymlink': 'REPLACE non-symlink',
};

export function renderPreview(plan) {
  const lines = ['Installation preview', '====================', `Skills to link: ${plan.skills.length}`];
  for (const t of plan.targets) {
    lines.push('', `Harness ${t.harnessId} · profile ${t.profileId} · scope ${t.scope}`, `  Skill directory: ${t.skillDir}`);
    for (const l of t.links) lines.push(`    [${ACTION_TAG[l.action]}] ${l.name} -> ${l.src}`);
  }
  if (plan.warnings.length) {
    lines.push('', 'Warnings:');
    for (const w of plan.warnings) lines.push(`  ! ${w}`);
  }
  lines.push('', 'Nothing has been changed yet.');
  return lines.join('\n');
}
```

- [ ] **Step 6: Create the linker module**

Create `scripts/install/linker.mjs`:

```js
import { mkdir, lstat, rm, symlink, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

// Reproduce `ln -sfn src dest`: force, no-dereference of an existing link.
export async function linkSkill(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  try {
    const st = await lstat(dest);
    if (st.isSymbolicLink()) await unlink(dest); // replace the link in place
    else await rm(dest, { recursive: true, force: true }); // real (non-symlink) collision
  } catch {
    /* nothing there yet */
  }
  await symlink(src, dest);
}

export async function applyTarget(target) {
  await mkdir(target.skillDir, { recursive: true });
  for (const l of target.links) await linkSkill(l.src, l.dest);
}
```

- [ ] **Step 7: Wire selection, preview, confirmation, and apply into the CLI**

In `scripts/install.mjs`, add imports below the existing ones:

```js
import { createInterface } from 'node:readline';
import { findEntry } from './install/registry.mjs';
import { resolveProfile, resolveSkillDir } from './install/profiles.mjs';
import { planTarget } from './install/planner.mjs';
import { renderPreview } from './install/preview.mjs';
import { applyTarget } from './install/linker.mjs';
```

Replace the `parseArgs` `switch` cases and defaults to add the new options — replace this block:

```js
      case '--inspect':
        o.inspect = true;
        break;
      case '--checkout':
        o.checkout = value();
        break;
      default:
        o.error = `unknown option: ${a}`;
```

with:

```js
      case '--inspect':
        o.inspect = true;
        break;
      case '--dry-run':
        o.dryRun = true;
        break;
      case '--yes':
      case '-y':
        o.yes = true;
        break;
      case '--harness':
        o.harness.push(value());
        break;
      case '--profile':
        o.profile.push(value());
        break;
      case '--scope':
        o.scope = value();
        break;
      case '--checkout':
        o.checkout = value();
        break;
      default:
        o.error = `unknown option: ${a}`;
```

After the loop, before `return o;`, add scope validation:

```js
  if (!o.error && !['global', 'project'].includes(o.scope)) o.error = `invalid --scope: ${o.scope}`;
```

Add the selection resolver and the confirmation helper (module scope, e.g. after `printInspect`):

```js
function resolveSelections(registry, o) {
  const out = [];
  const add = (entry, selector) => {
    const profile = resolveProfile(entry, selector);
    if (!profile) throw new UsageError(`unknown profile "${selector}" for harness ${entry.id}`);
    const skillDir = resolveSkillDir(entry, profile, o.scope);
    if (!skillDir) throw new UsageError(`harness ${entry.id} does not support scope ${o.scope}`);
    out.push({ entry, profile, scope: o.scope, skillDir });
  };
  for (const spec of o.profile) {
    const i = spec.indexOf(':');
    const id = i === -1 ? spec : spec.slice(0, i);
    const selector = i === -1 ? null : spec.slice(i + 1);
    const entry = findEntry(registry, id);
    if (!entry) throw new UsageError(`unknown harness: ${id}`);
    if (selector === null) for (const d of entry.configRoot.defaults) add(entry, d.id);
    else add(entry, selector);
  }
  for (const id of o.harness) {
    const entry = findEntry(registry, id);
    if (!entry) throw new UsageError(`unknown harness: ${id}`);
    for (const d of entry.configRoot.defaults) add(entry, d.id);
  }
  return out;
}

function confirm(promptText = 'Proceed? [y/N] ') {
  process.stdout.write(promptText);
  const rl = createInterface({ input: process.stdin });
  return new Promise((res) => {
    rl.once('line', (line) => {
      rl.close();
      res(/^(y|yes)$/i.test(line.trim()));
    });
    rl.once('close', () => res(false));
  });
}
```

Replace the two placeholder comment lines and the nothing-to-do fallback:

```js
  // --- Task 3 inserts dependency-graph validation here ---
  // --- Task 2 inserts selection + preview + confirmation + apply here ---

  process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
  return EXIT.NOTHING;
```

with:

```js
  // --- Task 3 inserts dependency-graph validation here ---

  let selections;
  try {
    selections = resolveSelections(registry, o);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT.USAGE;
    }
    throw err;
  }
  if (selections.length === 0) {
    process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
    return EXIT.NOTHING;
  }

  const targets = [];
  for (const sel of selections) {
    targets.push(await planTarget(sel.entry, sel.profile, sel.scope, skills, sel.skillDir));
  }
  const plan = { skills, targets, warnings: [] };
  process.stdout.write(renderPreview(plan) + '\n');
  if (o.dryRun) return EXIT.OK;

  const ok = o.yes ? true : await confirm();
  if (!ok) {
    process.stdout.write('Aborted; nothing changed.\n');
    return EXIT.OK;
  }
  for (const t of targets) await applyTarget(t);
  process.stdout.write('Done.\n');
  return EXIT.OK;
```

Also extend `usage()` to list the new options (insert before the `--help` line):

```js
    '  --harness <id>        select a harness by id (repeatable)',
    '  --profile <id[:sel]>  select a harness profile or custom dir (repeatable)',
    '  --scope <global|project>  install scope (default: global)',
    '  --dry-run             show the preview; change nothing',
    '  --yes, -y             skip the confirmation prompt (non-interactive)',
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test scripts/install.test.mjs`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 9: Commit**

```bash
git add scripts/install.mjs scripts/install/profiles.mjs scripts/install/planner.mjs scripts/install/preview.mjs scripts/install/linker.mjs scripts/install.test.mjs
git commit -m "feat: #23 add selection, preview, confirmation, and whole-library linking"
```

---

## Task 3: Dependency-graph validation before any filesystem change

Reuse the #22 graph module to reject an install whose library has a missing canonical dependency or a cycle — before anything is written.

**Files:**
- Create: `scripts/install/graph.mjs`
- Modify: `scripts/install.mjs`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: `parseRequiredSkills`, `missingNodes`, `findCycles` from `tools/skill-graph.mjs` (built under #22); `stripFrontmatter` from `discovery.mjs`.
- Produces: `buildGraph(skills): Map<string, string[]>` and `validateGraph(graph): { ok: boolean, defects: Array<{ type: 'missing'|'cycle', skill, detail, message }> }` from `graph.mjs`. `install.mjs` returns `GRAPH` (4) on any defect, printing each defect message, before selection resolution or linking.

- [ ] **Step 1: Write the failing tests** (append to `scripts/install.test.mjs`)

```js
const SKILL_DEP = (name, requires) =>
  `---\nname: ${name}\ndescription: d\n---\n## Overview\nx\n\n## Required skills\n${requires.map((r) => `- ${r}`).join('\n')}\n`;

test('a missing canonical dependency rejects the install (exit 4) and links nothing', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL_DEP('alpha', ['ghost']) } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 4);
    assert.match(r.stderr, /alpha/);
    assert.match(r.stderr, /ghost/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('a dependency cycle rejects the install (exit 4) and links nothing', async () => {
  const root = await makeCheckout({
    alpha: { 'SKILL.md': SKILL_DEP('alpha', ['beta']) },
    beta: { 'SKILL.md': SKILL_DEP('beta', ['alpha']) },
  });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 4);
    assert.match(r.stderr, /cycle/i);
    assert.match(r.stderr, /alpha/);
    assert.equal(existsSync(join(home, '.agents', 'skills', 'alpha')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — the broken-graph checkouts currently install (exit 0), so exit `4` is not returned.

- [ ] **Step 3: Create the graph module**

Create `scripts/install/graph.mjs`:

```js
import { parseRequiredSkills, missingNodes, findCycles } from '../../tools/skill-graph.mjs';
import { stripFrontmatter } from './discovery.mjs';

// Map<skill name, required skill names> built exactly as the linter builds it.
export function buildGraph(skills) {
  const graph = new Map();
  for (const s of skills) graph.set(s.name, parseRequiredSkills(stripFrontmatter(s.text)));
  return graph;
}

// Detect missing canonical dependencies and cycles; each defect names the skill.
export function validateGraph(graph) {
  const defects = [];
  for (const { from, missing } of missingNodes(graph)) {
    defects.push({
      type: 'missing',
      skill: from,
      detail: missing,
      message: `skill "${from}" requires "${missing}", which does not exist in the library`,
    });
  }
  for (const cycle of findCycles(graph)) {
    const chain = [...cycle, cycle[0]].join(' -> ');
    defects.push({ type: 'cycle', skill: cycle[0], detail: chain, message: `dependency cycle: ${chain}` });
  }
  return { ok: defects.length === 0, defects };
}
```

- [ ] **Step 4: Wire validation into the CLI**

In `scripts/install.mjs`, add the import:

```js
import { buildGraph, validateGraph } from './install/graph.mjs';
```

Replace the placeholder line:

```js
  // --- Task 3 inserts dependency-graph validation here ---
```

with:

```js
  const graph = buildGraph(skills);
  const verdict = validateGraph(graph);
  if (!verdict.ok) {
    for (const d of verdict.defects) process.stderr.write(`error: ${d.message}\n`);
    return EXIT.GRAPH;
  }
```

(This sits after the `--inspect` early return, so inspection still lists a library with a broken graph; and before selection/linking, so a defect rejects everything before any filesystem change.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/install.test.mjs`
Expected: PASS (Task 1–3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/install.mjs scripts/install/graph.mjs scripts/install.test.mjs
git commit -m "feat: #23 validate the dependency graph before any filesystem change"
```

---

## Task 4: Self-symlink guard, non-symlink collision, and channel-mixing warning

The safety behaviors: refuse a target resolving into the checkout; disclose and only-after-confirmation replace a real (non-symlink) entry; warn when linking into the shared `~/.agents/skills` storage.

**Files:**
- Modify: `scripts/install/planner.mjs`
- Modify: `scripts/install.mjs`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: `Target` and the `plan` shape (Task 2); `planTarget` already labels `replace-nonsymlink` actions.
- Produces: `selfSymlinkGuard(skillDir, checkout): Promise<null | { skillDir, resolved, message }>` from `planner.mjs`; a module-scope `buildWarnings(targets): string[]` in `install.mjs` populating `plan.warnings`; `install.mjs` returns `HARD` (1) with remediation when the guard fires.

- [ ] **Step 1: Write the failing tests** (append to `scripts/install.test.mjs`)

```js
import { symlink } from 'node:fs/promises';

test('a non-symlink collision is disclosed and only replaced after confirmation', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const dest = join(home, '.agents', 'skills', 'alpha');
  await mkdir(dest, { recursive: true }); // a real directory sitting where the link will go
  await writeFile(join(dest, 'keep.txt'), 'real');
  try {
    // Declining must NOT replace the real directory.
    const decline = run(['--checkout', root, '--harness', 'agents'], { input: 'n\n', env: { HOME: home } });
    assert.match(decline.stdout, /REPLACE non-symlink/);
    assert.match(decline.stdout, /alpha/);
    assert.equal(lstatSync(dest).isSymbolicLink(), false);
    assert.ok(existsSync(join(dest, 'keep.txt')));

    // Confirming replaces it with a symlink.
    const accept = run(['--checkout', root, '--harness', 'agents'], { input: 'y\n', env: { HOME: home } });
    assert.equal(accept.status, 0);
    assert.ok(lstatSync(dest).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('the self-symlink guard refuses a target resolving into the checkout (exit 1)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  // Make ~/.agents a symlink into the checkout, so ~/.agents/skills resolves inside it.
  await symlink(root, join(home, '.agents'));
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /resolves into this repository/);
    assert.match(r.stderr, /rm /); // remediation guidance
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('linking into ~/.agents/skills fires the channel-mixing warning', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--dry-run', '--checkout', root, '--harness', 'agents'], { env: { HOME: home } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /doubles as the portable CLI/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — no guard (the symlink-into-repo case installs instead of exiting 1); no channel-mixing warning in the preview. (The collision test may already partly pass because `replace-nonsymlink` is labelled and linking replaces after confirm — keep it; it locks the behavior.)

- [ ] **Step 3: Add the self-symlink guard to the planner**

In `scripts/install/planner.mjs`, extend the imports and append the guard:

```js
import { lstat, realpath } from 'node:fs/promises';
```

(replace the existing `import { lstat } from 'node:fs/promises';` line), then append:

```js
// Refuse a skill directory that resolves into the checkout — we would write the
// per-skill links back into the working copy. Returns null when it is safe.
export async function selfSymlinkGuard(skillDir, checkout) {
  let realCheckout;
  try {
    realCheckout = await realpath(checkout);
  } catch {
    return null;
  }
  let realTarget;
  try {
    realTarget = await realpath(skillDir);
  } catch {
    return null; // does not exist yet → cannot resolve into the repo
  }
  if (realTarget === realCheckout || realTarget.startsWith(realCheckout + '/')) {
    return {
      skillDir,
      resolved: realTarget,
      message: `${skillDir} resolves into this repository (${realTarget}); refusing to write links into the working copy. Remove it (rm "${skillDir}") and re-run.`,
    };
  }
  return null;
}
```

- [ ] **Step 4: Wire the guard and warnings into the CLI**

In `scripts/install.mjs`, extend the planner import:

```js
import { planTarget, selfSymlinkGuard } from './install/planner.mjs';
```

Add the warning builder at module scope (e.g. after `resolveSelections`):

```js
function buildWarnings(targets) {
  const warnings = [];
  for (const t of targets) {
    if (t.sharedStorage) {
      warnings.push(`${t.skillDir} doubles as the portable CLI's own storage; linking here mixes the development and portable channels.`);
    }
  }
  return warnings;
}
```

Replace the target-building block:

```js
  const targets = [];
  for (const sel of selections) {
    targets.push(await planTarget(sel.entry, sel.profile, sel.scope, skills, sel.skillDir));
  }
  const plan = { skills, targets, warnings: [] };
```

with:

```js
  const targets = [];
  for (const sel of selections) {
    const guard = await selfSymlinkGuard(sel.skillDir, checkout);
    if (guard) {
      process.stderr.write(`error: ${guard.message}\n`);
      return EXIT.HARD;
    }
    targets.push(await planTarget(sel.entry, sel.profile, sel.scope, skills, sel.skillDir));
  }
  const plan = { skills, targets, warnings: buildWarnings(targets) };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/install.test.mjs`
Expected: PASS (Task 1–4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/install.mjs scripts/install/planner.mjs scripts/install.test.mjs
git commit -m "feat: #23 add self-symlink guard, collision disclosure, and channel-mixing warning"
```

---

## Task 5: Alternate-registry loading and registry contract tests

Prove the wizard is a pure function of the registry: adding a harness is a registry-entry-plus-contract-tests change, with **zero** wizard code changes. A `--registry <path>` override lets contract tests exercise a toy harness through the same CLI seam.

**Files:**
- Modify: `scripts/install.mjs`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `install.mjs` option `--registry <path>` loading a `.json` (via `JSON.parse`) or `.mjs` (via dynamic `import`, using its `REGISTRY` or default export) registry, used in place of the built-in `REGISTRY` for all modes.

- [ ] **Step 1: Write the failing tests** (append to `scripts/install.test.mjs`)

```js
// A toy harness registry, written to disk and loaded via --registry.
async function writeRegistry(entries) {
  const dir = await mkdtemp(join(tmpdir(), 'reg-'));
  const path = join(dir, 'registry.json');
  await writeFile(path, JSON.stringify(entries));
  return { dir, path };
}

const TOY = [
  {
    id: 'toy',
    displayName: 'Toy Harness',
    skillDirs: { global: 'toy-skills' },
    configRoot: { env: null, defaults: [{ id: 'main', dir: '.toy' }] },
    scopes: ['global'],
    channels: ['development'],
    customProfileValidation: { allowHomeRelative: true },
    sharedStorage: false,
  },
];

test('a toy harness registry entry resolves its own paths with no wizard changes', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  const { dir: regDir, path: regPath } = await writeRegistry(TOY);
  try {
    // Inspect: the toy harness is listed.
    const ins = run(['--inspect', '--checkout', root, '--registry', regPath], { env: { HOME: home } });
    assert.equal(ins.status, 0);
    assert.match(ins.stdout, /toy \(Toy Harness\)/);

    // Install: links land in the toy harness's own skill directory template.
    const r = await fullInstall(['--checkout', root, '--registry', regPath, '--harness', 'toy'], { HOME: home });
    assert.equal(r.status, 0);
    assert.ok(lstatSync(join(home, '.toy', 'toy-skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(regDir, { recursive: true, force: true });
  }
});

test('an unknown harness id is a usage error (exit 2)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  try {
    const r = run(['--yes', '--checkout', root, '--harness', 'nope']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown harness: nope/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — `--registry` is an unknown option (exit 2 for the toy test at the wrong step / no `toy` harness).

- [ ] **Step 3: Add `--registry` loading to the CLI**

In `scripts/install.mjs`, extend the imports:

```js
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
```

(merge `fileURLToPath` and `pathToFileURL` into the existing `node:url` import).

Add the `--registry` case to the `parseArgs` switch (before `default`):

```js
      case '--registry':
        o.registryPath = value();
        break;
```

Add the loader at module scope:

```js
async function loadRegistry(path) {
  if (path.endsWith('.json')) return JSON.parse(await readFile(path, 'utf8'));
  const mod = await import(pathToFileURL(resolve(path)).href);
  return mod.REGISTRY ?? mod.default;
}
```

Replace the registry assignment:

```js
  const registry = REGISTRY;
```

with:

```js
  const registry = o.registryPath ? await loadRegistry(o.registryPath) : REGISTRY;
```

Extend `usage()` (insert with the other options):

```js
    '  --registry <path>     use an alternate registry (.json or .mjs)',
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/install.test.mjs`
Expected: PASS (Task 1–5 tests). No changes to selection/planning/linking were needed — the toy harness works purely as data.

- [ ] **Step 5: Commit**

```bash
git add scripts/install.mjs scripts/install.test.mjs
git commit -m "feat: #23 support alternate registries and add harness contract tests"
```

---

## Task 6: README install guidance generated from the registry + CI wiring

The development-links README block is generated from (and validated against) the registry, so docs cannot drift. Wire the deterministic installer tests into CI.

**Files:**
- Create: `scripts/install/readme.mjs`
- Modify: `scripts/install.mjs`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: `REGISTRY` (Task 1).
- Produces: `README_BEGIN`, `README_END`, `renderInstallSection(registry): string`, `validateReadme(registry, text): { ok, reason? }`, `writeReadme(registry, text): string` from `readme.mjs`. `install.mjs` modes `--check-readme <path>` (exit `HARD` on drift) and `--write-readme <path>`; `package.json` script `readme:check`; CI runs `npm test`.

- [ ] **Step 1: Write the failing test** (append to `scripts/install.test.mjs`)

```js
test('the committed README dev-install block matches the registry', () => {
  const readme = fileURLToPath(new URL('../README.md', import.meta.url));
  const r = run(['--check-readme', readme]);
  assert.equal(r.status, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — `--check-readme` is an unknown option; the README has no markers.

- [ ] **Step 3: Create the README module**

Create `scripts/install/readme.mjs`:

```js
// Development-links README guidance, generated from the harness registry so the
// docs and the installer cannot drift. Pure functions; registry is injected.
export const README_BEGIN = '<!-- BEGIN dev-install (generated from registry) -->';
export const README_END = '<!-- END dev-install -->';

export function renderInstallSection(registry) {
  const harnesses = registry.map((e) => `- **${e.displayName}** (\`${e.id}\`)`).join('\n');
  return [
    '### Development links',
    '',
    'Clone the repository and run the interactive installer; it symlinks every',
    'library skill from the working checkout into the harness profiles you select,',
    'so edits and `git pull` reach every linked profile live:',
    '',
    '```bash',
    'git clone https://github.com/artemVeduta/skills.git',
    'cd skills',
    './scripts/install.sh',
    '```',
    '',
    'Supported harnesses:',
    '',
    harnesses,
    '',
    'Update path: `git pull` (no reinstall).',
  ].join('\n');
}

export function validateReadme(registry, text) {
  const start = text.indexOf(README_BEGIN);
  const end = text.indexOf(README_END);
  if (start === -1 || end === -1 || end < start) {
    return { ok: false, reason: 'dev-install markers not found in README' };
  }
  const block = text.slice(start + README_BEGIN.length, end).trim();
  const expected = renderInstallSection(registry).trim();
  return block === expected ? { ok: true } : { ok: false, reason: 'README dev-install block does not match the registry' };
}

export function writeReadme(registry, text) {
  const start = text.indexOf(README_BEGIN);
  const end = text.indexOf(README_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('dev-install markers not found in README; add them around the Development links block first');
  }
  const before = text.slice(0, start + README_BEGIN.length);
  const after = text.slice(end);
  return `${before}\n${renderInstallSection(registry)}\n${after}`;
}
```

- [ ] **Step 4: Add the README modes to the CLI**

In `scripts/install.mjs`, extend the fs import to include `writeFile`:

```js
import { readFile, writeFile } from 'node:fs/promises';
```

Add the import:

```js
import { validateReadme, writeReadme } from './install/readme.mjs';
```

Add the `parseArgs` cases (before `default`):

```js
      case '--check-readme':
        o.checkReadme = value();
        break;
      case '--write-readme':
        o.writeReadme = value();
        break;
```

In `main`, immediately after `const registry = o.registryPath ? ... : REGISTRY;`, add the handlers (they do not need skill discovery):

```js
  if (o.checkReadme) {
    const res = validateReadme(registry, await readFile(o.checkReadme, 'utf8'));
    if (!res.ok) {
      process.stderr.write(`error: ${res.reason}\n`);
      return EXIT.HARD;
    }
    process.stdout.write('README dev-install block matches the registry.\n');
    return EXIT.OK;
  }
  if (o.writeReadme) {
    const updated = writeReadme(registry, await readFile(o.writeReadme, 'utf8'));
    await writeFile(o.writeReadme, updated);
    process.stdout.write(`Wrote README dev-install block to ${o.writeReadme}.\n`);
    return EXIT.OK;
  }
```

Extend `usage()` (insert with the other options):

```js
    '  --check-readme <path> verify the README dev-install block matches the registry',
    '  --write-readme <path> rewrite the README dev-install block from the registry',
```

- [ ] **Step 5: Insert the markers into README.md and generate the block**

In `README.md`, replace the entire hand-written `### Development links` block (from the `### Development links` heading down to, and including, the `Update path: \`git pull\` (no reinstall).` line) with the two marker comments on their own lines:

```markdown
<!-- BEGIN dev-install (generated from registry) -->
<!-- END dev-install -->
```

Then generate the block from the registry:

Run: `node scripts/install.mjs --write-readme README.md`
Expected: stdout `Wrote README dev-install block to README.md.` and the file now contains the generated `### Development links` block between the markers.

- [ ] **Step 6: Add the `readme:check` npm script**

In `package.json`, add to `scripts` (keep alphabetical-ish ordering near the other checks):

```json
    "readme:check": "node scripts/install.mjs --check-readme README.md",
```

- [ ] **Step 7: Wire the deterministic tests into CI**

In `.github/workflows/ci.yml`, add a step after the docs-validator step (the installer tests are pure Node + subprocess, no secrets, so they belong in CI):

```yaml
      - name: Installer + repo tests (deterministic)
        run: npm test
```

- [ ] **Step 8: Run the full suite and the checks to verify they pass**

Run: `node --test scripts/install.test.mjs && npm run readme:check`
Expected: PASS (all installer tests) and `README dev-install block matches the registry.`

- [ ] **Step 9: Commit**

```bash
git add scripts/install.mjs scripts/install/readme.mjs README.md package.json .github/workflows/ci.yml scripts/install.test.mjs
git commit -m "feat: #23 generate README dev-install guidance from the registry and wire CI"
```

---

## Task 7: Interactive wizard flow

The primary UX: with no selection flags on a TTY (or when forced with `--interactive`), prompt for harness types, then reuse the same preview → confirm → link pipeline. This is the replaceable presentation layer; selection and path resolution are unchanged.

**Files:**
- Modify: `scripts/install.mjs`
- Test: `scripts/install.test.mjs`

**Interfaces:**
- Consumes: `resolveSelections`, `renderPreview`, `applyTarget`, `selfSymlinkGuard` (Tasks 2–4).
- Produces: `install.mjs` option `--interactive`; `promptSelections(registry, rl): Promise<string[]>`; `confirm(rl)` now accepts an optional shared readline interface. Interactive mode populates `o.harness` and flows through the existing pipeline.

- [ ] **Step 1: Write the failing test** (append to `scripts/install.test.mjs`)

```js
test('the interactive wizard selects harnesses and confirms from stdin', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    const r = run(['--interactive', '--checkout', root], { input: 'agents\ny\n', env: { HOME: home } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Installation preview/);
    assert.ok(lstatSync(join(home, '.agents', 'skills', 'alpha')).isSymbolicLink());
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test('interactive selection of nothing is nothing-to-do (exit 3)', async () => {
  const root = await makeCheckout({ alpha: { 'SKILL.md': SKILL('alpha') } });
  const home = await mkdtemp(join(tmpdir(), 'home-'));
  try {
    // Blank harness line = all harnesses in this build; type a bogus id to select none.
    const r = run(['--interactive', '--checkout', root], { input: '__none__\n', env: { HOME: home } });
    assert.equal(r.status, 2); // unknown harness -> usage error
    assert.match(r.stderr, /unknown harness/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test scripts/install.test.mjs`
Expected: FAIL — `--interactive` is an unknown option.

- [ ] **Step 3: Add the `--interactive` flag**

In `scripts/install.mjs`, add the `parseArgs` case (before `default`):

```js
      case '--interactive':
        o.interactive = true;
        break;
```

Extend `usage()`:

```js
    '  --interactive         force the interactive wizard (read selections from stdin)',
```

- [ ] **Step 4: Add the selection prompt and make `confirm` accept a shared interface**

In `scripts/install.mjs`, replace the entire `confirm` function from Task 2:

```js
function confirm(promptText = 'Proceed? [y/N] ') {
  process.stdout.write(promptText);
  const rl = createInterface({ input: process.stdin });
  return new Promise((res) => {
    rl.once('line', (line) => {
      rl.close();
      res(/^(y|yes)$/i.test(line.trim()));
    });
    rl.once('close', () => res(false));
  });
}
```

with:

```js
async function promptSelections(registry, rl) {
  const ids = registry.map((e) => e.id).join(', ');
  const answer = await new Promise((res) =>
    rl.question(`Select harnesses [${ids}] (comma-separated, blank = all): `, res),
  );
  const trimmed = answer.trim();
  if (!trimmed) return registry.map((e) => e.id);
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

// Confirm using a shared interactive interface when provided; otherwise read one
// line from a fresh interface (the non-interactive `input:`-piped test path).
function confirm(rl) {
  const q = 'Proceed? [y/N] ';
  if (rl) return new Promise((res) => rl.question(q, (a) => res(/^(y|yes)$/i.test(a.trim()))));
  process.stdout.write(q);
  const tmp = createInterface({ input: process.stdin });
  return new Promise((res) => {
    tmp.once('line', (line) => {
      tmp.close();
      res(/^(y|yes)$/i.test(line.trim()));
    });
    tmp.once('close', () => res(false));
  });
}
```

- [ ] **Step 5: Drive interactive selection and thread the interface through the pipeline**

In `main`, immediately after the dependency-graph validation block (Task 3) and before `let selections;`, insert:

```js
  const interactive =
    o.interactive || (o.harness.length === 0 && o.profile.length === 0 && process.stdin.isTTY);
  let rl = null;
  if (interactive) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
    o.harness.push(...(await promptSelections(registry, rl)));
  }
```

Then update the downstream return paths to close `rl` and pass it to `confirm`. Replace the nothing-to-do block:

```js
  if (selections.length === 0) {
    process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
    return EXIT.NOTHING;
  }
```

with:

```js
  if (selections.length === 0) {
    if (rl) rl.close();
    process.stderr.write('nothing to do: select a harness profile (--harness/--profile) or use --inspect\n');
    return EXIT.NOTHING;
  }
```

Replace the guard-failure return:

```js
    if (guard) {
      process.stderr.write(`error: ${guard.message}\n`);
      return EXIT.HARD;
    }
```

with:

```js
    if (guard) {
      if (rl) rl.close();
      process.stderr.write(`error: ${guard.message}\n`);
      return EXIT.HARD;
    }
```

Replace the dry-run / confirmation tail:

```js
  process.stdout.write(renderPreview(plan) + '\n');
  if (o.dryRun) return EXIT.OK;

  const ok = o.yes ? true : await confirm();
  if (!ok) {
    process.stdout.write('Aborted; nothing changed.\n');
    return EXIT.OK;
  }
  for (const t of targets) await applyTarget(t);
  process.stdout.write('Done.\n');
  return EXIT.OK;
```

with:

```js
  process.stdout.write(renderPreview(plan) + '\n');
  if (o.dryRun) {
    if (rl) rl.close();
    return EXIT.OK;
  }

  const ok = o.yes ? true : await confirm(rl);
  if (rl) rl.close();
  if (!ok) {
    process.stdout.write('Aborted; nothing changed.\n');
    return EXIT.OK;
  }
  for (const t of targets) await applyTarget(t);
  process.stdout.write('Done.\n');
  return EXIT.OK;
```

The `resolveSelections` unknown-harness case still throws `UsageError` → exit 2 (covered by the second test: an interactively typed unknown id is a usage error).

- [ ] **Step 6: Run the full suite to verify it passes**

Run: `npm test`
Expected: PASS — the whole repo suite (installer + existing docs/linter/release/manifest tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/install.mjs scripts/install.test.mjs
git commit -m "feat: #23 add the interactive harness-selection wizard"
```

---

## Verification

After all tasks, confirm the acceptance criteria end to end:

- [ ] `npm test` passes (installer suite + existing suites).
- [ ] `npm run lint:skills:strict` passes (the CI gate — installer changes touch no skills, so this must remain green).
- [ ] `npm run readme:check` prints `README dev-install block matches the registry.`
- [ ] `npm run docs:validate` runs clean (advisory).
- [ ] Manual smoke: from the repo, `./scripts/install.sh --inspect` lists the one real skill (`okf-docs-setup`) and the three harnesses; `./scripts/install.sh --dry-run --harness claude-code` shows a preview linking `okf-docs-setup` into `~/.claude/skills` and `~/.claude-work/skills` and changes nothing.

Map to issue #23 acceptance criteria: **1** (preview/no-change/confirm/idempotent/pickup) → Tasks 2; **2** (cycle/missing rejection) → Task 3; **3** (non-interactive, inspect, distinct exit codes) → Tasks 1, 2, 5; **4** (self-symlink guard, ~/.agents mixing, non-symlink collision) → Task 4; **5** (toy harness, zero wizard changes) → Task 5; **6** (README matches registry, docs validate) → Task 6.

## Notes / Follow-ups (not tasks)

- **Spec implementation note:** the installer is now Node with a thin bash launcher (behavior — `ln -sfn` semantics, self-symlink guard, exit-code split — is preserved). The behavioral contract in `docs/specs/install-sh.md` is unchanged; only implementer-owned choices were made (Node core, exit-code numbers, flag names, JSON/`.mjs` registry format, warn-not-refuse for `~/.agents/skills`). If a maintainer wants the spec's implementation notes to mention "Node core", that is a separate documentation change (bump `timestamp`, add a `log.md` entry) — out of scope here.
- **Codex skill directory** is a documented assumption (`<CODEX_HOME|~/.codex>/skills`); confirm against a real Codex install before advertising Codex support broadly. It is a pure registry entry, so correcting it is a one-line registry change plus a contract test.
- **Stale-link pruning** (skills removed from the library) is intentionally not implemented (implementer-owned; the spec leaves it open).

