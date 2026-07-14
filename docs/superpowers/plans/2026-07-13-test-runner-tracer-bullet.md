# Test-Runner Tracer Bullet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, gating-capable skill test runner that projects a real skill (plus its full `## Required skills` closure) unmodified into a disposable per-harness fixture, drives all three supported headless CLIs against a scenario prompt, and decides pass/fail from deterministic state assertions only — proven end-to-end by a first `okf-docs-setup` case.

**Architecture:** A CLI orchestrator (`tools/test-runner.mjs`) composes six focused modules under `tools/test-runner/`: harness **driver descriptors** (pure invocation shaping per harness), a **fixture builder** (copies the transitive closure — via the shared `tools/skill-graph.mjs` — into each harness's discovery path without mutating sources), a **deterministic oracle** (typed filesystem/output assertions), a **case loader**, an impure **driver executor** (the only inference boundary), and a **report/exit-code** module. Cases live centrally at `tools/tests/<skill-name>/`; the disposable per-harness fixture is built under `os.tmpdir()` (outside the repo, for discovery isolation) and raw artifacts land in a git-ignored `tools/runs/`. The skill linter gains one advisory WARN for skills lacking a central case directory. Every deterministic component is unit-tested under `npm test`; only the end-to-end run spends inference and runs locally only.

**Tech Stack:** Node.js 20, ES modules (`.mjs`), zero runtime dependencies, `node:test` + `node:assert/strict`. Reuses `tools/skill-graph.mjs` (closure) and `scripts/install/discovery.mjs` (skill enumeration).

## Revisions from review (2026-07-14)

This plan was revised after design review (`…-tracer-bullet.REVIEW.md`, findings re-verified against the repo before folding in). Load-bearing changes an implementer MUST respect (every runtime change carries matching test-block and "Expected" updates in its task):

- **Out-of-repo fixtures (BLOCKER, P1).** The harness spawn `cwd` is built under `os.tmpdir()`, not inside the repo, so a headless CLI's cwd-upward walk cannot discover this repo's own `CLAUDE.md`/`AGENTS.md`/`.claude/skills` and bias the skill under test. Raw artifacts still land in the git-ignored `tools/runs/`.
- **Verified tool-permission grants (BLOCKER, G1).** `buildInvocation` bakes a per-harness write grant (claude `--permission-mode bypassPermissions`, codex `-s workspace-write`, opencode `--auto`); without one a headless run writes nothing and every filesystem assertion fails. Grants are confirmed against each installed CLI at Task 8 Step 10 before a green is trusted.
- **Widened immutability proof (G2).** The before/after hash now covers `skills/`, `docs/`, `scripts/`, `.claude/` (via `hashGuardedTrees`), not just `skills/`.
- **Bounded executor (P4).** `runDriver` gains a `SIGKILL` timeout (default 600000ms, `TEST_RUNNER_TIMEOUT_MS`-overridable) and captures `error`/`timedOut`.
- **Reconciled result union (P5/P9a + gaps).** `HarnessResult` is ONE `status`-tagged union (`skipped`/`dry-run`/`executed`) carrying `fixtureRoot`, `exitStatus`, `harnessError`, `timedOut`; `runCase`, the report, and all tests switch on `status`. Four coordinated fixes (P1/P4/P5/P9a) mutate this one shape and MUST be applied together.
- **No vacuous PASS (P6).** `exitCodeFor` requires an executed harness to have ≥1 assertion, so an assertion-less case can never score a vacuous PASS. The guard lives only in the gate (SoC — `loadCase` stays a pure loader).
- **Removed dead surface (P9c/P9e).** `listDrivers` deleted (callers use `DRIVERS`); `oracle.allPassed` is the single pass check used by the report.
- **Extraction (P9b).** Per-harness lifecycle extracted into `runHarness`, unit-testable with a fake driver.
- **New Task 10** reconciles the docs bundle (dated ADR amendment).

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from `docs/specs/skills-platform.md`, `docs/decisions/skill-testing-architecture.md`, `docs/decisions/ci-and-automation-wiring.md`, and issue #24.

- **Deterministic oracle only.** "Pass/fail derives only from deterministic state assertions (filesystem, structured output, exact/containment/schema). Skill-selection evidence and LLM-judge rubric scores are recorded as advisory and never gate." No code path may derive an exit code from advisory signal.
- **Gating runner.** "The local test runner exits nonzero on assertion failure — deliberately unlike the always-advisory docs validator and skill linter." (`scripts/validate-docs.mjs` always `process.exit(0)`; `tools/lint-skills.mjs` exits 0 unless `--strict` + errors.)
- **Fixture immutability.** "Projects the canonical skill directory unmodified into a disposable fixture, including the transitive closure of `## Required skills` (via the shared graph module), shaped to each harness profile's discovery path. Sources are never mutated." Immutability is a *testable* property ("canonical sources verifiably unmodified"). The proof hashes not only `skills/` (the ADR AC) but also the other committed trees an agent could damage outbound — `docs/`, `scripts/`, `.claude/` — before and after each run (via `hashGuardedTrees`); any change flips `sourcesUnmodified` and gates the run FAIL. Defense-in-depth atop fixture relocation: even if an agent resolved the enclosing git root instead of honoring cwd, the clobber is caught rather than silently landing on committed files.
- **Out-of-repo fixture (isolation).** The disposable fixture the harness runs in (its spawn `cwd`) MUST be built OUTSIDE the repo tree, under `os.tmpdir()`. A headless CLI walks UP from `cwd` to discover project memory (`CLAUDE.md`/`AGENTS.md`) and project skills (`.claude/skills`); an in-repo fixture would leak this repo's own memory (AGENTS.md names the `docs/` OKF bundle) and its `docs-add`/`docs-validate` skills into the skill under test, biasing the `okf-docs-setup` case. Env isolation (`CLAUDE_CONFIG_DIR`/`HOME`/`CODEX_HOME`/XDG) redirects USER-level config only and does not affect the cwd-upward walk. Raw artifacts still land in the git-ignored `tools/runs/`; the fixture itself is ephemeral under tmpdir (reaped by the OS / cleaned by the CLI).
- **Single shared graph module.** The closure MUST come from `tools/skill-graph.mjs` (`transitiveClosure`). Do not reimplement graph logic.
- **Central cases, pure deliverables.** "Cases live in `tools/tests/<skill-name>/`, one directory per skill: each case is a scenario prompt, its fixture inputs, and its expected-state assertions. Skill directories stay pure deliverables — no test material ships to installs, no new role subdir enters the authoring conventions, and the byte-exact `assets/` contract is never touched by test placement."
- **Runs area.** Raw artifacts (transcripts, per-assertion results) go to a git-ignored runs directory under `tools/`. The fixture itself is NOT persisted here — it lives ephemerally under `os.tmpdir()` (out-of-repo isolation).
- **No inference in CI — ever.** "per-skill cases, per-harness contract tests, and benchmarks run only locally via the `tools/` runner; CI holds no model API keys and has no scheduled workflows." The runner's inference path is invoked locally only; `npm test` (which CI runs) must exercise only deterministic components.
- **Three harnesses.** Claude Code (`claude -p`), Codex (`codex exec`), OpenCode (`opencode run`). Each runs its OWN fixture.
- **Module style.** ESM `.mjs`, named exports, small single-responsibility modules with injected dependencies (mirror `scripts/install/*` and `tools/*`). Pure functions where possible; IO isolated to the CLI/executor.
- **Test style.** `node:test` + `node:assert/strict`; temp trees via `mkdtemp(join(tmpdir(), 'prefix-'))`; CLI tests via `spawnSync(process.execPath, [CLI, ...], { encoding: 'utf8' })` asserting `.status`/`.stdout`; clean up with `rm(root, { recursive: true, force: true })` in `finally`.
- **Commits.** Follow the observed history style `type: #24 <lowercase imperative subject>` (e.g. `feat: #24 …`, `test: #24 …`). Each commit ends with the standard trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: <session url>
  ```
  (`docs/conventions/git.md` says "descriptive prose … not conventional-commit prefixes"; the actual history uses the prefixed form — code/history is the source of truth. Do NOT edit `git.md` in this plan; note the mismatch if doing documentation work later.)

---

## File Structure

**New — runner (all under `tools/`, so `npm test`'s existing `tools/*.test.mjs` plus a one-line `tools/test-runner/*.test.mjs` glob addition cover the tests):**

- `tools/test-runner.mjs` — CLI orchestrator + `runCase()` (impure: spawn, fs, exit).
- `tools/test-runner/drivers.mjs` — three harness driver descriptors; pure `buildInvocation`.
- `tools/test-runner/fixture.mjs` — `buildFixture()` (copy closure per discovery path) + `hashTree()` (immutability proof).
- `tools/test-runner/oracle.mjs` — `evaluateAssertions()` typed deterministic checks.
- `tools/test-runner/case-loader.mjs` — `loadCase()` reads a central case directory.
- `tools/test-runner/runner.mjs` — `isHarnessAvailable()` + `runDriver()` (the inference boundary).
- `tools/test-runner/report.mjs` — `formatRunReport()` + `exitCodeFor()` (pure).
- `tools/test-runner/*.test.mjs` — colocated unit/integration tests.

**New — first case (data, no test material inside `skills/`):**

- `tools/tests/okf-docs-setup/case.mjs` — default-exports inputs + deterministic assertions.
- `tools/tests/okf-docs-setup/prompt.md` — scenario prompt (Phase-0 answers baked in; no fan-out).

**Modified:**

- `package.json` — extend the `test` script glob; add a `test:case` convenience script.
- `.gitignore` — ignore `tools/runs/`.
- `tools/lint-skills.mjs` + `tools/lint-skills.test.mjs` — new advisory WARN `lintTestCases`.

**New — docs reconciliation (Task 10, gated on material divergence):**

- `docs/decisions/skill-testing-architecture.md` + `docs/log.md` — dated `# Amendments` reconciliation of the ADR with what was actually built.

**Isolation note:** the per-harness fixture (the harness spawn `cwd`) is built under `os.tmpdir()` — OUTSIDE the repo tree — so a headless CLI's cwd-upward discovery walk cannot reach this repo's own memory/skills. Only raw artifacts (transcripts, per-assertion results) persist, under the git-ignored `tools/runs/`.

Each file has one responsibility; files that change together (a module + its test) live together. This decomposition is the task boundary set below.

---

## Task 1: Harness driver descriptors

**Files:**
- Create: `tools/test-runner/drivers.mjs`
- Create: `tools/test-runner/drivers.test.mjs`
- Modify: `package.json` (extend the `test` script glob to discover `tools/test-runner/*.test.mjs`)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `DRIVERS: Array<{ id: string, command: string, discoverySubdir: string, buildInvocation({ fixtureRoot: string, prompt: string }): { command: string, args: string[], env: Record<string,string> } }>`
  - `resolveDriver(id: string): (typeof DRIVERS)[number] | null`
  - The three ids are exactly `'claude-code'`, `'codex'`, `'opencode'` with discovery subdirs `.claude/skills`, `.codex/skills`, `.opencode/skills`.

**Design note — unverified discovery paths / invocation flags.** The Decision and issue mandate only the *bare* headless commands (`claude -p <prompt>`, `codex exec <prompt>`, `opencode run <prompt>`); `buildInvocation` uses exactly those. The install REGISTRY itself flags Codex's skill directory as unverified ("confirm Codex's actual skill directory before relying on it in anger"), and OpenCode is not modeled there at all. So the `.codex/skills` and `.opencode/skills` subdirs, and any *future* flags for structured output (`--output-format json`) or project-dir targeting (`--dir`), are best-guesses that MUST be confirmed against the actually installed CLI at the manual end-to-end step (Task 8, Step 10) before being relied on. Do not add SPECULATIVE flags (structured output `--output-format json`, project-dir `--dir`) to `buildInvocation` until verified — an unrecognized flag fails the whole run. A per-harness TOOL-PERMISSION grant is different: it is a verified PRECONDITION, not speculation. Headless runs cannot prompt for approval, so with no grant every harness DENIES file writes and all filesystem assertions fail regardless of skill correctness. The grants are verified present in the installed CLIs and baked into `buildInvocation` from the start: claude `--permission-mode bypassPermissions` (`claude --help` lists the mode; acceptEdits alone does NOT cover Bash); codex `-s workspace-write` (`codex exec --help`: read-only|workspace-write|danger-full-access, exec defaults to read-only which blocks writes — note `--full-auto` is NOT an `exec` flag); opencode `--auto` (`opencode run --help`: 'auto-approve permissions that are not explicitly denied'). WARNING: claude `bypassPermissions` removes write confinement, so it is safe ONLY because the fixture lives OUTSIDE the repo tree (see Task 8 `runCase`); its guard (`hashGuardedTrees`) covers only `skills/`/`docs/`/`scripts/`/`.claude/`, NOT `tools/` or non-repo paths — the real confinement is the disposable tmpdir. Codex `workspace-write` confines writes to cwd and is safe regardless. Two candidate codex discovery paths exist — the plan's `.codex/skills` vs the reference's cwd-relative `.agents/skills/<name>/SKILL.md` (`docs/references/agent-skill-testing-landscape.md:126-131`); verify which codex 0.139.0 actually reads at Step 10 before trusting its verdict.

- [ ] **Step 1: Extend the test glob so `tools/test-runner/*.test.mjs` runs under `npm test`**

Edit `package.json`, replacing the `test` script line:

```json
    "test": "node --test scripts/*.test.mjs tools/*.test.mjs tools/test-runner/*.test.mjs",
```

(Leave `lint:skills:test` and `docs:validate:test` unchanged. This adds no inference and no keys — CI stays deterministic.)

- [ ] **Step 2: Write the failing test**

Create `tools/test-runner/drivers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRIVERS, resolveDriver } from './drivers.mjs';

test('exactly the three supported harnesses are registered', () => {
  assert.deepEqual(
    DRIVERS.map((d) => d.id).sort(),
    ['claude-code', 'codex', 'opencode'],
  );
});

test('each driver declares its discovery subdir', () => {
  assert.equal(resolveDriver('claude-code').discoverySubdir, '.claude/skills');
  assert.equal(resolveDriver('codex').discoverySubdir, '.codex/skills');
  assert.equal(resolveDriver('opencode').discoverySubdir, '.opencode/skills');
});

test('resolveDriver returns null for an unknown id', () => {
  assert.equal(resolveDriver('nope'), null);
});

test('claude-code invocation grants headless write permission and isolates HOME/config', () => {
  const inv = resolveDriver('claude-code').buildInvocation({ fixtureRoot: '/fx', prompt: 'hello' });
  assert.equal(inv.command, 'claude');
  assert.deepEqual(inv.args, ['-p', 'hello', '--permission-mode', 'bypassPermissions']);
  assert.equal(inv.env.CLAUDE_CONFIG_DIR, '/fx/.claude-config');
  assert.equal(inv.env.HOME, '/fx/.home');
});

test('codex invocation enables workspace-write and isolates HOME and CODEX_HOME', () => {
  const inv = resolveDriver('codex').buildInvocation({ fixtureRoot: '/fx', prompt: 'hi' });
  assert.equal(inv.command, 'codex');
  assert.deepEqual(inv.args, ['exec', '--sandbox', 'workspace-write', 'hi']);
  assert.equal(inv.env.HOME, '/fx/.home');
  assert.equal(inv.env.CODEX_HOME, '/fx/.codex');
});

test('opencode invocation auto-approves permissions and isolates HOME', () => {
  const inv = resolveDriver('opencode').buildInvocation({ fixtureRoot: '/fx', prompt: 'yo' });
  assert.equal(inv.command, 'opencode');
  assert.deepEqual(inv.args, ['run', '--auto', 'yo']);
  assert.equal(inv.env.HOME, '/fx/.home');
});

test('every driver env value is scoped to the fixture root (no host path escapes)', () => {
  for (const d of DRIVERS) {
    const { env } = d.buildInvocation({ fixtureRoot: '/fx', prompt: 'x' });
    for (const v of Object.values(env)) {
      assert.ok(v.startsWith('/fx'), `${d.id}: ${v} escapes fixture`);
    }
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tools/test-runner/drivers.test.mjs`
Expected: FAIL — `Cannot find module './drivers.mjs'`.

- [ ] **Step 4: Write minimal implementation**

Create `tools/test-runner/drivers.mjs`:

```js
// Headless-CLI descriptors for the three supported test harnesses. PURE:
// buildInvocation returns the argv + extra env to spawn but never spawns, so
// the invocation shape is unit-testable without inference. The runner
// (runner.mjs) does the impure spawn; cwd is always the fixture root.
import { join } from 'node:path';

// Each descriptor:
//   id               stable harness id
//   command          the headless CLI binary (also used for availability probing)
//   discoverySubdir  where, under a fixture root, this harness discovers project skills
//   buildInvocation({ fixtureRoot, prompt }) -> { command, args, env }
//     env: extra vars merged over process.env by the runner.
// One shared isolation env for every harness: point HOME + all XDG roots at
// per-fixture dirs so no host-scoped config/cache/state leaks in. Each harness
// adds its own extra var. NOTE: emptying HOME strips file-based credentials, so
// file/OAuth-authenticated CLIs must rely on an API key exported into
// process.env (merged through by runDriver) — see Task 8 Step 10. XDG-isolation
// source: docs/references/agent-skill-testing-landscape.md:122.
function isolationEnv(fixtureRoot) {
  return {
    HOME: join(fixtureRoot, '.home'),
    XDG_CONFIG_HOME: join(fixtureRoot, '.config'),
    XDG_DATA_HOME: join(fixtureRoot, '.data'),
    XDG_CACHE_HOME: join(fixtureRoot, '.cache'),
    XDG_STATE_HOME: join(fixtureRoot, '.state'),
  };
}

// buildInvocation returns the documented bare command per harness
// (`claude -p`, `codex exec`, `opencode run`) PLUS a VERIFIED per-harness
// tool-permission grant (a precondition — headless runs cannot prompt, so with
// no grant every write is DENIED and all filesystem assertions fail) PLUS the
// isolation env. It still excludes speculative output-format / project-dir
// flags. Grants verified against each installed CLI's --help. Discovery subdirs
// for codex/opencode are best-guesses (the install REGISTRY flags Codex's path
// as unverified and does not model OpenCode; the reference names a different
// `.agents/skills` path for codex) — confirm at Task 8 Step 10.
export const DRIVERS = [
  {
    id: 'claude-code',
    command: 'claude',
    discoverySubdir: '.claude/skills',
    buildInvocation({ fixtureRoot, prompt }) {
      return {
        command: 'claude',
        // Headless `-p` cannot prompt; without a grant Write/Edit/Bash are all
        // denied. acceptEdits does NOT cover Bash, so bypassPermissions is used.
        // WARNING: bypassPermissions removes write confinement — safe ONLY
        // because the fixture lives outside the repo tree (see runCase).
        args: ['-p', prompt, '--permission-mode', 'bypassPermissions'],
        env: { ...isolationEnv(fixtureRoot), CLAUDE_CONFIG_DIR: join(fixtureRoot, '.claude-config') },
      };
    },
  },
  {
    id: 'codex',
    command: 'codex',
    discoverySubdir: '.codex/skills',
    buildInvocation({ fixtureRoot, prompt }) {
      return {
        command: 'codex',
        // `codex exec` defaults to a read-only sandbox that blocks writes;
        // workspace-write confines writes to cwd (safe regardless of location).
        // NB: `--full-auto` is NOT an exec flag in 0.139.0.
        args: ['exec', '--sandbox', 'workspace-write', prompt],
        // CODEX_HOME=<fixtureRoot>/.codex → discovery at $CODEX_HOME/skills.
        env: { ...isolationEnv(fixtureRoot), CODEX_HOME: join(fixtureRoot, '.codex') },
      };
    },
  },
  {
    id: 'opencode',
    command: 'opencode',
    discoverySubdir: '.opencode/skills',
    buildInvocation({ fixtureRoot, prompt }) {
      return {
        command: 'opencode',
        // `opencode run` does not auto-approve permissions by default; --auto
        // auto-approves permissions not explicitly denied.
        args: ['run', '--auto', prompt],
        env: { ...isolationEnv(fixtureRoot) },
      };
    },
  },
];

export function resolveDriver(id) {
  return DRIVERS.find((d) => d.id === id) || null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tools/test-runner/drivers.test.mjs`
Expected: PASS — all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/test-runner/drivers.mjs tools/test-runner/drivers.test.mjs package.json
git commit -m "feat: #24 add headless-CLI driver descriptors for the three test harnesses"
```

---

## Task 2: Fixture builder and source-immutability hash

**Files:**
- Create: `tools/test-runner/fixture.mjs`
- Create: `tools/test-runner/fixture.test.mjs`

**Interfaces:**
- Consumes:
  - `discoverSkills(skillsRoot): Promise<Array<{ name, srcDir, text }>>` and `stripFrontmatter(text): string` from `scripts/install/discovery.mjs`.
  - `parseRequiredSkills(body): string[]` and `transitiveClosure(graph: Map<string,string[]>, start: string): Set<string>` from `tools/skill-graph.mjs`. Note: `transitiveClosure` returns a Set that INCLUDES `start`.
  - A driver descriptor's `discoverySubdir` (Task 1).
- Produces:
  - `buildFixture({ skillName: string, skillsRoot: string, driver: { discoverySubdir: string }, fixtureRoot: string, inputs?: Array<{ path: string, content: string }> }): Promise<string[]>` — copies the closure into `<fixtureRoot>/<driver.discoverySubdir>/<name>/` and seeds `inputs` into `<fixtureRoot>`; returns the sorted closure names. Throws `Error('unknown skill: <name>')` if `skillName` is absent.
  - `hashTree(dir: string): Promise<string>` — stable sha256 of a directory tree (sorted rel-path + content).
  - `hashGuardedTrees(repoRoot: string, dirs: string[]): Promise<string>` — composes `hashTree` over each committed dir under `repoRoot`; ENOENT-tolerant (a missing dir hashes to `''`) so it works in any repo. Used by the runner to prove no committed tree (`skills/`, `docs/`, `scripts/`, `.claude/`) mutated during a run.

- [ ] **Step 1: Write the failing test**

Create `tools/test-runner/fixture.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture, hashTree, hashGuardedTrees } from './fixture.mjs';

// Build a temp skills/ tree: a -> b -> c (a requires b, b requires c).
async function makeSkills(root) {
  const skills = {
    a: '---\nname: a\ndescription: d\n---\nbody\n\n## Required skills\n\n- b\n',
    b: '---\nname: b\ndescription: d\n---\nbody\n\n## Required skills\n\n- c\n',
    c: '---\nname: c\ndescription: d\n---\nbody\n',
    z: '---\nname: z\ndescription: d\n---\nunrelated\n',
  };
  for (const [name, text] of Object.entries(skills)) {
    await mkdir(join(root, name), { recursive: true });
    await writeFile(join(root, name, 'SKILL.md'), text);
  }
}

test('buildFixture projects the full ## Required skills closure and nothing extra', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    const driver = { discoverySubdir: '.claude/skills' };
    const closure = await buildFixture({ skillName: 'a', skillsRoot, driver, fixtureRoot });
    assert.deepEqual(closure, ['a', 'b', 'c']); // sorted, includes start, excludes unrelated z
    const projected = await readdir(join(fixtureRoot, '.claude/skills'));
    assert.deepEqual(projected.sort(), ['a', 'b', 'c']);
    // The projected SKILL.md is byte-identical to the source.
    const src = await readFile(join(skillsRoot, 'a', 'SKILL.md'), 'utf8');
    const proj = await readFile(join(fixtureRoot, '.claude/skills/a/SKILL.md'), 'utf8');
    assert.equal(proj, src);
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('buildFixture leaves canonical sources unmodified (hashTree unchanged)', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    const before = await hashTree(skillsRoot);
    await buildFixture({ skillName: 'a', skillsRoot, driver: { discoverySubdir: '.codex/skills' }, fixtureRoot });
    const after = await hashTree(skillsRoot);
    assert.equal(after, before);
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('buildFixture seeds case inputs into the fixture working dir', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    await buildFixture({
      skillName: 'c',
      skillsRoot,
      driver: { discoverySubdir: '.opencode/skills' },
      fixtureRoot,
      inputs: [{ path: 'package.json', content: '{"name":"x"}\n' }],
    });
    assert.equal(await readFile(join(fixtureRoot, 'package.json'), 'utf8'), '{"name":"x"}\n');
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('buildFixture throws on an unknown skill', async () => {
  const skillsRoot = await mkdtemp(join(tmpdir(), 'tr-src-'));
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));
  try {
    await makeSkills(skillsRoot);
    await assert.rejects(
      () => buildFixture({ skillName: 'missing', skillsRoot, driver: { discoverySubdir: '.claude/skills' }, fixtureRoot }),
      /unknown skill: missing/,
    );
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('hashGuardedTrees changes when any guarded dir changes and ignores missing dirs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tr-guard-'));
  try {
    await mkdir(join(root, 'skills'), { recursive: true });
    await writeFile(join(root, 'skills', 'f.txt'), 'one');
    const dirs = ['skills', 'docs']; // docs/ absent → ENOENT-tolerant
    const h1 = await hashGuardedTrees(root, dirs);
    assert.equal(await hashGuardedTrees(root, dirs), h1); // stable
    await writeFile(join(root, 'skills', 'f.txt'), 'two');
    assert.notEqual(await hashGuardedTrees(root, dirs), h1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hashTree changes when a file changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tr-hash-'));
  try {
    await writeFile(join(root, 'f.txt'), 'one');
    const h1 = await hashTree(root);
    await writeFile(join(root, 'f.txt'), 'two');
    const h2 = await hashTree(root);
    assert.notEqual(h1, h2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test-runner/fixture.test.mjs`
Expected: FAIL — `Cannot find module './fixture.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/test-runner/fixture.mjs`:

```js
// Projects a skill + its transitive `## Required skills` closure UNMODIFIED
// into a disposable per-harness fixture, shaped to that harness's discovery
// path. Sources are only READ (copied out) — never mutated. Closure comes from
// the shared graph module (tools/skill-graph.mjs); skill enumeration + front-
// matter stripping are reused from scripts/install/discovery.mjs so "what is a
// skill and where does it live" has one implementation.
import { cp, mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { discoverSkills, stripFrontmatter } from '../../scripts/install/discovery.mjs';
import { parseRequiredSkills, transitiveClosure } from '../skill-graph.mjs';

// Copy the closure of `skillName` into <fixtureRoot>/<driver.discoverySubdir>/<name>/
// and seed any case `inputs` into the fixture working dir (fixtureRoot). Returns
// the sorted projected closure names. Throws if the skill is not in the library.
export async function buildFixture({ skillName, skillsRoot, driver, fixtureRoot, inputs = [] }) {
  const skills = await discoverSkills(skillsRoot);
  const srcByName = new Map(skills.map((s) => [s.name, s.srcDir]));
  if (!srcByName.has(skillName)) {
    throw new Error(`unknown skill: ${skillName}`);
  }
  const graph = new Map(
    skills.map((s) => [s.name, parseRequiredSkills(stripFrontmatter(s.text))]),
  );
  const closure = [...transitiveClosure(graph, skillName)].sort();

  const skillsDest = join(fixtureRoot, driver.discoverySubdir);
  await mkdir(skillsDest, { recursive: true });
  for (const name of closure) {
    await cp(srcByName.get(name), join(skillsDest, name), { recursive: true });
  }

  for (const input of inputs) {
    const dest = join(fixtureRoot, input.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, input.content);
  }
  return closure;
}

// Stable content hash of a directory tree: for each file (sorted by rel path)
// hash "<relPath>\0<sha256(content)>\n". Used to prove sources are unmodified.
export async function hashTree(dir) {
  const files = [];
  async function walk(rel) {
    const entries = await readdir(join(dir, rel), { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel ? join(rel, e.name) : e.name;
      if (e.isDirectory()) await walk(childRel);
      else files.push(childRel);
    }
  }
  await walk('');
  files.sort();
  const h = createHash('sha256');
  for (const rel of files) {
    const content = await readFile(join(dir, rel));
    h.update(rel);
    h.update('\0');
    h.update(createHash('sha256').update(content).digest('hex'));
    h.update('\n');
  }
  return h.digest('hex');
}

// Committed trees a run must never mutate (the fixture/runs area lives elsewhere).
// Composes hashTree over each; a missing dir hashes to '' so this works in any repo.
export async function hashGuardedTrees(repoRoot, dirs) {
  const parts = [];
  for (const d of dirs) {
    let h = '';
    try { h = await hashTree(join(repoRoot, d)); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
    parts.push(`${d}:${h}`);
  }
  return parts.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test-runner/fixture.test.mjs`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/fixture.mjs tools/test-runner/fixture.test.mjs
git commit -m "feat: #24 add fixture builder projecting the closure per harness discovery path"
```

---

## Task 3: Deterministic oracle

**Files:**
- Create: `tools/test-runner/oracle.mjs`
- Create: `tools/test-runner/oracle.test.mjs`

**Interfaces:**
- Consumes: nothing (reads files given paths).
- Produces:
  - `evaluateAssertions(assertions: Assertion[], ctx: { workdir: string, repoRoot: string, output: string }): Promise<Array<{ assertion: Assertion, pass: boolean, detail: string }>>`
  - `allPassed(results): boolean`
  - `Assertion` is one of: `{ type: 'file-exists', path }`, `{ type: 'file-absent', path }`, `{ type: 'file-contains', path, value }`, `{ type: 'file-not-contains', path, value }`, `{ type: 'file-equals', path, against }`, `{ type: 'output-contains', value }`. `path` resolves against `workdir`; `against` resolves against `repoRoot`. Unknown types fail with `detail` naming the type. (The `type` switch is the extension point for future `schema` checks — OCP; not built here per YAGNI.)

- [ ] **Step 1: Write the failing test**

Create `tools/test-runner/oracle.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateAssertions, allPassed } from './oracle.mjs';

async function withDirs(fn) {
  const workdir = await mkdtemp(join(tmpdir(), 'tr-wd-'));
  const repoRoot = await mkdtemp(join(tmpdir(), 'tr-rr-'));
  try {
    return await fn({ workdir, repoRoot });
  } finally {
    await rm(workdir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
}

test('file-exists / file-absent', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await writeFile(join(workdir, 'there.txt'), 'x');
    const r = await evaluateAssertions(
      [
        { type: 'file-exists', path: 'there.txt' },
        { type: 'file-exists', path: 'gone.txt' },
        { type: 'file-absent', path: 'gone.txt' },
      ],
      { workdir, repoRoot, output: '' },
    );
    assert.deepEqual(r.map((x) => x.pass), [true, false, true]);
    assert.match(r[1].detail, /missing gone\.txt/);
  });
});

test('file-contains / file-not-contains', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await writeFile(join(workdir, 'p.json'), '{"scripts":{"docs:validate":"x"}}');
    const r = await evaluateAssertions(
      [
        { type: 'file-contains', path: 'p.json', value: 'docs:validate' },
        { type: 'file-contains', path: 'p.json', value: 'nope' },
        { type: 'file-not-contains', path: 'p.json', value: '<PROJECT>' },
      ],
      { workdir, repoRoot, output: '' },
    );
    assert.deepEqual(r.map((x) => x.pass), [true, false, true]);
  });
});

test('file-equals compares workdir path to a repoRoot path byte-for-byte', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    await mkdir(join(repoRoot, 'assets'), { recursive: true });
    await writeFile(join(repoRoot, 'assets/base.mjs'), 'export const x = 1;\n');
    await writeFile(join(workdir, 'copy.mjs'), 'export const x = 1;\n');
    const ok = await evaluateAssertions(
      [{ type: 'file-equals', path: 'copy.mjs', against: 'assets/base.mjs' }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(ok[0].pass, true);
    await writeFile(join(workdir, 'copy.mjs'), 'export const x = 2;\n');
    const bad = await evaluateAssertions(
      [{ type: 'file-equals', path: 'copy.mjs', against: 'assets/base.mjs' }],
      { workdir, repoRoot, output: '' },
    );
    assert.equal(bad[0].pass, false);
    assert.match(bad[0].detail, /not byte-identical/);
  });
});

test('output-contains checks captured harness output; unknown type fails', async () => {
  await withDirs(async ({ workdir, repoRoot }) => {
    const r = await evaluateAssertions(
      [
        { type: 'output-contains', value: 'DONE' },
        { type: 'bogus', path: 'x' },
      ],
      { workdir, repoRoot, output: 'work DONE here' },
    );
    assert.equal(r[0].pass, true);
    assert.equal(r[1].pass, false);
    assert.match(r[1].detail, /unknown assertion type: bogus/);
    assert.equal(allPassed(r), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test-runner/oracle.test.mjs`
Expected: FAIL — `Cannot find module './oracle.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/test-runner/oracle.mjs`:

```js
// Deterministic oracle: pass/fail derives ONLY from deterministic state
// assertions (filesystem + structured-output containment). Advisory signal
// (skill-selection evidence, judge scores) is NEVER evaluated here — that is a
// hard rule of the testing architecture.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function readIf(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// ctx: { workdir, repoRoot, output }. Returns one { assertion, pass, detail }
// per assertion, in order.
export async function evaluateAssertions(assertions, ctx) {
  const results = [];
  for (const a of assertions) {
    results.push({ assertion: a, ...(await evaluateOne(a, ctx)) });
  }
  return results;
}

async function evaluateOne(a, { workdir, repoRoot, output }) {
  switch (a.type) {
    case 'file-exists': {
      const c = await readIf(join(workdir, a.path));
      return { pass: c !== null, detail: c !== null ? '' : `missing ${a.path}` };
    }
    case 'file-absent': {
      const c = await readIf(join(workdir, a.path));
      return { pass: c === null, detail: c === null ? '' : `unexpected ${a.path}` };
    }
    case 'file-contains': {
      const c = await readIf(join(workdir, a.path));
      const pass = c !== null && c.includes(a.value);
      return { pass, detail: pass ? '' : `${a.path} does not contain ${JSON.stringify(a.value)}` };
    }
    case 'file-not-contains': {
      const c = await readIf(join(workdir, a.path));
      const pass = c !== null && !c.includes(a.value);
      return { pass, detail: pass ? '' : `${a.path} still contains ${JSON.stringify(a.value)}` };
    }
    case 'file-equals': {
      const actual = await readIf(join(workdir, a.path));
      const expected = await readIf(join(repoRoot, a.against));
      const pass = actual !== null && expected !== null && actual === expected;
      return { pass, detail: pass ? '' : `${a.path} not byte-identical to ${a.against}` };
    }
    case 'output-contains': {
      const pass = typeof output === 'string' && output.includes(a.value);
      return { pass, detail: pass ? '' : `output does not contain ${JSON.stringify(a.value)}` };
    }
    default:
      return { pass: false, detail: `unknown assertion type: ${a.type}` };
  }
}

export function allPassed(results) {
  return results.every((r) => r.pass);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test-runner/oracle.test.mjs`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/oracle.mjs tools/test-runner/oracle.test.mjs
git commit -m "feat: #24 add deterministic assertion oracle"
```

---

## Task 4: Case loader

**Files:**
- Create: `tools/test-runner/case-loader.mjs`
- Create: `tools/test-runner/case-loader.test.mjs`

(The loader is named `case-loader.mjs` to avoid colliding with the per-skill data file `tools/tests/<skill>/case.mjs` it loads.)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `loadCase(skillName: string, { casesRoot: string }): Promise<{ skill: string, inputs: Array<{ path, content }>, assertions: Assertion[], prompt: string }>` — dynamic-imports `<casesRoot>/<skillName>/case.mjs` (an ES module: `export default { skill?, inputs?, assertions? }`, all optional) and reads `<casesRoot>/<skillName>/prompt.md`. `skill` defaults to `skillName`; `inputs`/`assertions` default to `[]`. A `.mjs` case (vs static JSON) lets a case compute expected values and keeps assertion kinds first-class.

- [ ] **Step 1: Write the failing test**

Create `tools/test-runner/case-loader.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCase } from './case-loader.mjs';

test('loadCase reads case.mjs and prompt.md from the skill case dir', async () => {
  const casesRoot = await mkdtemp(join(tmpdir(), 'tr-cases-'));
  try {
    const dir = join(casesRoot, 'demo');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'case.mjs'),
      `export default ${JSON.stringify({
        inputs: [{ path: 'package.json', content: '{}' }],
        assertions: [{ type: 'file-exists', path: 'docs/index.md' }],
      })};\n`,
    );
    await writeFile(join(dir, 'prompt.md'), 'do the thing\n');
    const c = await loadCase('demo', { casesRoot });
    assert.equal(c.skill, 'demo');
    assert.equal(c.prompt, 'do the thing\n');
    assert.equal(c.inputs.length, 1);
    assert.equal(c.assertions[0].type, 'file-exists');
  } finally {
    await rm(casesRoot, { recursive: true, force: true });
  }
});

test('loadCase defaults inputs/assertions to empty arrays', async () => {
  const casesRoot = await mkdtemp(join(tmpdir(), 'tr-cases-'));
  try {
    const dir = join(casesRoot, 'bare');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'case.mjs'), 'export default {};\n');
    await writeFile(join(dir, 'prompt.md'), 'x');
    const c = await loadCase('bare', { casesRoot });
    assert.deepEqual(c.inputs, []);
    assert.deepEqual(c.assertions, []);
  } finally {
    await rm(casesRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test-runner/case-loader.test.mjs`
Expected: FAIL — `Cannot find module './case-loader.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/test-runner/case-loader.mjs`:

```js
// Loads a central test case from <casesRoot>/<skill>/: a case.mjs manifest
// module (default-exports { skill, inputs, assertions }) plus a prompt.md
// scenario prompt. Cases live under tools/tests/ — never inside skills/ — so no
// test material ships to installs. Each case dir is a unique path so dynamic
// import caching never collides across cases.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadCase(skillName, { casesRoot }) {
  const dir = join(casesRoot, skillName);
  const mod = await import(pathToFileURL(join(dir, 'case.mjs')).href);
  const manifest = mod.default;
  const prompt = await readFile(join(dir, 'prompt.md'), 'utf8');
  return {
    skill: manifest.skill ?? skillName,
    inputs: manifest.inputs ?? [],
    assertions: manifest.assertions ?? [],
    prompt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test-runner/case-loader.test.mjs`
Expected: PASS — both tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/case-loader.mjs tools/test-runner/case-loader.test.mjs
git commit -m "feat: #24 add central test-case loader"
```

---

## Task 5: First central case for okf-docs-setup

**Files:**
- Create: `tools/tests/okf-docs-setup/case.mjs`
- Create: `tools/tests/okf-docs-setup/prompt.md`
- Create: `tools/test-runner/okf-case.test.mjs`

**Interfaces:**
- Consumes: `loadCase` (Task 4).
- Produces: the on-disk case that Task 8's end-to-end run and the linter WARN (Task 9) both key on. No new code exports.

**Design notes (why this case is deterministic):** `okf-docs-setup` has no `## Required skills` heading, so its closure is just itself (its Phase-2 dependency `/superpowers:dispatching-parallel-agents` is prose under `## Integration`, not a graph edge). Phase 0 asks six questions and STOPS for approval; Phase 2 fans out agents only when there are subsystems or existing docs. The prompt supplies all six answers and sets subsystems/existing-docs to none, reducing the run to Phase 1 plus a confirm-only Phase 3 (run the validator once, no warning-chasing, no file edits) and an explicitly skipped Phase 4 — the prompt bounds the Phase 3/4 tail because okf-docs-setup SKILL.md Phase 3 invites fixing cheap warnings and Phase 4 writes CLAUDE.md/AGENTS.md. The strongest assertions are byte-equality of BOTH installed verbatim validator files (`scripts/validate-docs.mjs` and `scripts/validate-docs.test.mjs`) against the skill's own `assets/scripts/` copies, so the oracle no longer hinges on a single file; the prompt explicitly forbids localizing `excludedTopLevelDirs` despite the installed docs-authoring rule inviting it (assertion count is now 16, still ≥10 for okf-case.test.mjs). Assertions use `file-contains` (not exact) for the package.json scripts because the skill writes a glob form that differs from this repo's narrower one.

- [ ] **Step 1: Write the scenario prompt**

Create `tools/tests/okf-docs-setup/prompt.md`:

```markdown
Set up an OKF (Open Knowledge Format) v0.1 documentation bundle in THIS repository using the okf-docs-setup skill.

All inputs are provided below — do NOT ask any questions and do NOT stop for approval. Proceed directly with the full installation:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm
- Source edit path glob: src/**
- Subsystems: none yet
- Where existing docs live: none

Install the complete machinery now: copy the verbatim asset files, apply the placeholder substitutions (project name, date, source-edit glob), and add the two package.json scripts. There are no subsystems and no existing documentation to convert, so there is nothing to fan out — perform only the mechanical installation, then stop.

Copy the verbatim asset files exactly as shipped: do NOT modify `scripts/validate-docs.mjs` or `scripts/validate-docs.test.mjs` in any way — leave them byte-identical to the skill's assets even though the installed docs-authoring rule mentions editing `excludedTopLevelDirs`. After copying and substituting you MAY run the docs validator once to confirm zero hard ERRORS, but do NOT chase or fix warnings and do NOT edit any installed file. Do NOT wire anything into CLAUDE.md or AGENTS.md — skip the project-memory step entirely.
```

- [ ] **Step 2: Write the case manifest**

Create `tools/tests/okf-docs-setup/case.mjs`:

```js
// Central test case for okf-docs-setup (skill-testing-architecture Decision 3).
// A case = scenario prompt (prompt.md) + fixture inputs + expected-state
// assertions. Deterministic assertions are the ONLY pass/fail oracle.
export default {
  skill: 'okf-docs-setup',
  inputs: [
    {
      path: 'package.json',
      content: `${JSON.stringify({ name: 'fixtureproj', private: true, scripts: {} }, null, 2)}\n`,
    },
  ],
  assertions: [
    { type: 'file-exists', path: 'docs/index.md' },
    { type: 'file-exists', path: 'docs/log.md' },
    { type: 'file-exists', path: 'docs/conventions/documentation.md' },
    { type: 'file-exists', path: 'docs/references/okf.md' },
    { type: 'file-exists', path: 'scripts/validate-docs.mjs' },
    { type: 'file-exists', path: 'scripts/validate-docs.test.mjs' },
    { type: 'file-exists', path: '.claude/rules/docs-authoring.md' },
    { type: 'file-exists', path: '.claude/rules/docs-maintenance.md' },
    { type: 'file-exists', path: '.claude/skills/docs-add/SKILL.md' },
    { type: 'file-exists', path: '.claude/skills/docs-validate/SKILL.md' },
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.mjs',
      against: 'skills/okf-docs-setup/assets/scripts/validate-docs.mjs',
    },
    {
      type: 'file-equals',
      path: 'scripts/validate-docs.test.mjs',
      against: 'skills/okf-docs-setup/assets/scripts/validate-docs.test.mjs',
    },
    { type: 'file-not-contains', path: 'docs/index.md', value: '<PROJECT>' },
    { type: 'file-not-contains', path: '.claude/rules/docs-maintenance.md', value: '<source-edit-path-glob>' },
    { type: 'file-contains', path: 'package.json', value: 'docs:validate' },
    { type: 'file-contains', path: 'package.json', value: 'docs:validate:test' },
  ],
};
```

- [ ] **Step 3: Write the test that validates the case is well-formed**

Create `tools/test-runner/okf-case.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadCase } from './case-loader.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');

test('the okf-docs-setup case loads and targets the right skill', async () => {
  const c = await loadCase('okf-docs-setup', { casesRoot });
  assert.equal(c.skill, 'okf-docs-setup');
  assert.ok(c.assertions.length >= 10);
});

test('the case includes the byte-identity assertion on validate-docs.mjs', async () => {
  const c = await loadCase('okf-docs-setup', { casesRoot });
  const eq = c.assertions.find((a) => a.type === 'file-equals');
  assert.equal(eq.path, 'scripts/validate-docs.mjs');
  assert.equal(eq.against, 'skills/okf-docs-setup/assets/scripts/validate-docs.mjs');
});

test('the prompt neutralizes Phase 0 (no asking) and Phase 2 (no fan-out)', async () => {
  const c = await loadCase('okf-docs-setup', { casesRoot });
  assert.match(c.prompt, /do NOT ask/i);
  assert.match(c.prompt, /Subsystems: none yet/);
  assert.match(c.prompt, /none/i);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test-runner/okf-case.test.mjs`
Expected: PASS — all 3 tests pass (case files exist and are well-formed).

- [ ] **Step 5: Verify the byte-identity baseline actually holds in the repo**

Run: `node -e "import('node:fs/promises').then(async fs => { const a = await fs.readFile('skills/okf-docs-setup/assets/scripts/validate-docs.mjs'); console.log('asset bytes:', a.length); })"`
Expected: prints a byte count > 0 (confirms the `against` target exists). The end-to-end run in Task 8 is where the installed copy is compared to it.

- [ ] **Step 6: Commit**

```bash
git add tools/tests/okf-docs-setup/case.mjs tools/tests/okf-docs-setup/prompt.md tools/test-runner/okf-case.test.mjs
git commit -m "test: #24 add the first central case for okf-docs-setup"
```

---

## Task 6: Driver executor (the inference boundary)

**Files:**
- Create: `tools/test-runner/runner.mjs`
- Create: `tools/test-runner/runner.test.mjs`

**Interfaces:**
- Consumes: a driver descriptor's `command` and `buildInvocation` (Task 1).
- Produces:
  - `isHarnessAvailable(command: string): boolean` — true iff `<command> --version` exits 0.
  - `runDriver(driver, { fixtureRoot: string, prompt: string, timeoutMs?: number }): { status: number|null, stdout: string, stderr: string, error: string|null, timedOut: boolean }` — spawns the harness with cwd = `fixtureRoot` (an out-of-repo tmpdir) and env = `{ ...process.env, ...invocation.env }`. Bounded by `timeoutMs` (default 600000ms, overridable via `TEST_RUNNER_TIMEOUT_MS`) with `killSignal: 'SIGKILL'`; a timeout or maxBuffer overflow yields `status: null` with `error`/`timedOut` set so a hung harness cannot block the runner. This is the ONLY function that spends inference; it is never invoked by `npm test`.

- [ ] **Step 1: Write the failing test** (availability probing is deterministic and CI-safe; runDriver's timeout is exercised via a fake sleeping subprocess — deterministic, no inference or network)

Create `tools/test-runner/runner.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHarnessAvailable, runDriver } from './runner.mjs';

test('isHarnessAvailable is true for a binary that answers --version', () => {
  // `node --version` always exits 0.
  assert.equal(isHarnessAvailable(process.execPath), true);
});

test('isHarnessAvailable is false for a non-existent binary', () => {
  assert.equal(isHarnessAvailable('definitely-not-a-real-binary-xyz-42'), false);
});

test('runDriver enforces a finite timeout and reports it (no inference)', () => {
  const sleeper = {
    buildInvocation: () => ({ command: process.execPath, args: ['-e', 'setTimeout(() => {}, 60000)'], env: {} }),
  };
  const r = runDriver(sleeper, { fixtureRoot: process.cwd(), prompt: 'x', timeoutMs: 200 });
  assert.equal(r.status, null);
  assert.equal(r.timedOut, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test-runner/runner.test.mjs`
Expected: FAIL — `Cannot find module './runner.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/test-runner/runner.mjs`:

```js
// Impure driver execution: availability probing + the headless spawn. runDriver
// is the ONLY inference boundary in the runner — it is never invoked by
// `npm test`/CI, only by the local test-runner CLI's end-to-end path.
import { spawnSync } from 'node:child_process';

// True iff the harness binary responds to `<command> --version` with exit 0.
export function isHarnessAvailable(command) {
  try {
    const r = spawnSync(command, ['--version'], { encoding: 'utf8' });
    return r.status === 0;
  } catch {
    return false;
  }
}

// Spawn the harness against its disposable fixture. cwd is the fixture root —
// built under os.tmpdir(), OUTSIDE the repo (see runCase) — so project-scope
// skill discovery (.claude/skills, .codex/skills, .opencode/skills) resolves to
// the fixture ONLY and the cwd-upward walk cannot reach this repo's own
// CLAUDE.md/AGENTS.md/.claude/skills. Bound the run so a hung CLI (a prompt
// awaiting approval, a stalled model) cannot block the runner forever; override
// via TEST_RUNNER_TIMEOUT_MS. On timeout or maxBuffer overflow spawnSync sets
// status=null and populates r.error — capture it so the caller can emit an
// explicit harness-level diagnostic instead of a bare content FAIL.
const DEFAULT_TIMEOUT_MS = 600_000;

export function runDriver(driver, { fixtureRoot, prompt, timeoutMs }) {
  const { command, args, env } = driver.buildInvocation({ fixtureRoot, prompt });
  const limit = timeoutMs ?? (Number(process.env.TEST_RUNNER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const r = spawnSync(command, args, {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
    timeout: limit,
    killSignal: 'SIGKILL',
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGKILL';
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error ? r.error.message : null,
    timedOut,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test-runner/runner.test.mjs`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/runner.mjs tools/test-runner/runner.test.mjs
git commit -m "feat: #24 add harness availability probe and headless driver executor"
```

---

## Task 7: Report and exit-code decision

**Files:**
- Create: `tools/test-runner/report.mjs`
- Create: `tools/test-runner/report.test.mjs`

**Interfaces:**
- Consumes: a run result object (produced by Task 8) of shape
  `{ skill: string, runId: string, dryRun?: boolean, harnesses: Array<HarnessResult> }`
  where `HarnessResult` is a `status`-tagged union — this ONE definition is mutated by four coordinated fixes (P1 `fixtureRoot`, P4 `timedOut`/`harnessError`, P5 numeric exit + error, P9a the `status` discriminator) and MUST stay in sync with `runCase` and every consuming switch:
  - skipped: `{ id, status: 'skipped', skipReason: string, fixtureRoot: string }`
  - dry run: `{ id, status: 'dry-run', closure: string[], invocation: { command, args, env }, sourcesUnmodified: boolean, fixtureRoot: string }`
  - executed: `{ id, status: 'executed', assertions: Array<{ pass, detail }>, sourcesUnmodified: boolean, exitStatus: number|null, harnessError: string|null, timedOut: boolean, fixtureRoot: string }`
  Note `status` (the discriminator) and `exitStatus` (the harness process exit code) are DISTINCT; `harnessError` has a single source (runDriver's `error`/`timedOut`).
- Produces:
  - `formatRunReport(run): string` — switches on `h.status`.
  - `exitCodeFor(run): 0 | 1` — dry run: 0 unless a fixture build mutated sources. Real run: 1 if no harness executed (cannot gate), else 0 iff every executed harness has a NON-EMPTY assertion list, all assertions passing, AND sources unmodified.

- [ ] **Step 1: Write the failing test**

Create `tools/test-runner/report.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRunReport, exitCodeFor } from './report.mjs';

const passing = {
  skill: 'okf-docs-setup',
  runId: '1',
  harnesses: [{ id: 'claude-code', status: 'executed', sourcesUnmodified: true, exitStatus: 0, harnessError: null, timedOut: false, assertions: [{ pass: true, detail: '' }] }],
};
const failing = {
  skill: 'okf-docs-setup',
  runId: '1',
  harnesses: [{ id: 'claude-code', status: 'executed', sourcesUnmodified: true, exitStatus: 0, harnessError: null, timedOut: false, assertions: [{ pass: false, detail: 'missing docs/index.md' }] }],
};

test('exitCodeFor is 0 when every executed assertion passes', () => {
  assert.equal(exitCodeFor(passing), 0);
});

test('exitCodeFor is 1 when any executed assertion fails', () => {
  assert.equal(exitCodeFor(failing), 1);
});

test('exitCodeFor is 1 when sources were mutated', () => {
  const mutated = { ...passing, harnesses: [{ ...passing.harnesses[0], sourcesUnmodified: false }] };
  assert.equal(exitCodeFor(mutated), 1);
});

test('exitCodeFor is 1 when an executed harness has no assertions (never vacuous PASS)', () => {
  const empty = { ...passing, harnesses: [{ ...passing.harnesses[0], assertions: [] }] };
  assert.equal(exitCodeFor(empty), 1);
  assert.match(formatRunReport(empty), /claude-code: FAIL/);
});

test('exitCodeFor is 1 when no harness executed (all skipped)', () => {
  const allSkipped = { skill: 'x', runId: '1', harnesses: [{ id: 'codex', status: 'skipped', skipReason: 'not installed', fixtureRoot: '/tmp/fx' }] };
  assert.equal(exitCodeFor(allSkipped), 1);
});

test('exitCodeFor for a dry run is 0 when sources are unmodified', () => {
  const dry = { skill: 'x', runId: '1', dryRun: true, harnesses: [{ id: 'codex', status: 'dry-run', closure: ['x'], invocation: { command: 'codex', args: [] }, sourcesUnmodified: true, fixtureRoot: '/tmp/fx' }] };
  assert.equal(exitCodeFor(dry), 0);
});

test('formatRunReport surfaces failing assertion details', () => {
  const out = formatRunReport(failing);
  assert.match(out, /claude-code: FAIL/);
  assert.match(out, /missing docs\/index\.md/);
});

test('formatRunReport flags an abnormal harness exit distinctly from a content FAIL', () => {
  const timedOut = { skill: 'x', runId: '1', harnesses: [{ id: 'codex', status: 'executed', sourcesUnmodified: true, exitStatus: null, harnessError: 'timed out', timedOut: true, assertions: [{ pass: false, detail: 'missing x' }] }] };
  assert.match(formatRunReport(timedOut), /harness exited abnormally/);
});

test('formatRunReport marks skipped harnesses', () => {
  const skipped = { skill: 'x', runId: '1', harnesses: [{ id: 'codex', status: 'skipped', skipReason: 'codex CLI not installed', fixtureRoot: '/tmp/fx' }] };
  assert.match(formatRunReport(skipped), /codex: SKIPPED \(codex CLI not installed\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test-runner/report.test.mjs`
Expected: FAIL — `Cannot find module './report.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `tools/test-runner/report.mjs`:

```js
// Pure human report + exit-code decision for a run result. The runner is
// GATING: the exit code is load-bearing and derives ONLY from deterministic
// assertion results and source immutability — never from advisory signal.
import { allPassed } from './oracle.mjs';

export function formatRunReport(run) {
  const lines = [`test-runner — case: ${run.skill}${run.dryRun ? ' (dry run)' : ''}`];
  for (const h of run.harnesses) {
    switch (h.status) {
      case 'skipped':
        lines.push(`  ${h.id}: SKIPPED (${h.skipReason})`);
        break;
      case 'dry-run':
        lines.push(`  ${h.id}: would run \`${h.invocation.command}\` with ${h.closure.length} skill(s): ${h.closure.join(', ')}`);
        if (!h.sourcesUnmodified) lines.push('    ! canonical sources were modified');
        break;
      case 'executed': {
        if (h.exitStatus !== 0) {
          lines.push(`    ! harness exited abnormally (status ${h.exitStatus}${h.timedOut ? ', timed out' : ''}${h.harnessError ? ': ' + h.harnessError : ''})`);
        }
        const failed = h.assertions.filter((r) => !r.pass);
        const pass = h.assertions.length > 0 && failed.length === 0 && h.sourcesUnmodified;
        lines.push(`  ${h.id}: ${pass ? 'PASS' : 'FAIL'} (${h.assertions.length - failed.length}/${h.assertions.length} assertions)`);
        if (!h.sourcesUnmodified) lines.push('    ! canonical sources were modified');
        for (const r of failed) lines.push(`    ✗ ${r.detail}`);
        break;
      }
    }
  }
  return lines.join('\n');
}

export function exitCodeFor(run) {
  if (run.dryRun) {
    return run.harnesses.every((h) => h.sourcesUnmodified) ? 0 : 1;
  }
  const executed = run.harnesses.filter((h) => h.status === 'executed');
  if (executed.length === 0) return 1; // nothing ran — cannot gate
  const ok = executed.every((h) => h.assertions.length > 0 && h.sourcesUnmodified && allPassed(h.assertions));
  return ok ? 0 : 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test-runner/report.test.mjs`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/report.mjs tools/test-runner/report.test.mjs
git commit -m "feat: #24 add gating exit-code decision and run report"
```

---

## Task 8: Gating runner CLI

**Files:**
- Create: `tools/test-runner.mjs`
- Create: `tools/test-runner.test.mjs`
- Modify: `.gitignore` (ignore `tools/runs/`)
- Modify: `package.json` (add `test:case` convenience script)

**Interfaces:**
- Consumes: `DRIVERS`/`resolveDriver` (Task 1), `buildFixture`/`hashGuardedTrees` (Task 2), `loadCase` (Task 4), `isHarnessAvailable`/`runDriver` (Task 6), `evaluateAssertions` (Task 3), `formatRunReport`/`exitCodeFor` (Task 7).
- Produces:
  - `runHarness(driver, { skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun }): Promise<HarnessResult>` — one harness's full lifecycle (build out-of-repo fixture, gate/execute, evaluate oracle, persist artifacts), returning exactly one `status`-tagged `HarnessResult` (Task 7). Exported so a fake driver exercises the executed branch without inference and the tagged union is built in ONE place.
  - `runCase(skillName: string, opts?: { skillsRoot?, casesRoot?, runsRoot?, harnessIds?: string[], dryRun?: boolean, runId?: string }): Promise<Run>` — loops `runHarness` per requested harness; each fixture is an out-of-repo `os.tmpdir()` dir, and raw artifacts land under `<runsRoot>/<runId>/<harness>/`. Immutability is proven via `hashGuardedTrees` before/after.
  - CLI: `node tools/test-runner.mjs <skill-name> [--harness <id>] [--dry-run] [--runs <dir>]`. Exit code = `exitCodeFor(run)`; usage error (missing skill, flag missing its value) exits 2 via `UsageError`; the CLI removes its ephemeral tmpdir fixtures after printing the report.

- [ ] **Step 1: Ignore the raw-artifacts runs area**

Edit `.gitignore`, appending under a new heading (keep the existing sections intact):

```gitignore

# Test-runner raw artifacts (transcripts, per-assertion results). Fixtures are
# ephemeral under os.tmpdir(), not here.
# Committed run summaries (issue #25) live elsewhere and are NOT ignored.
tools/runs/
```

- [ ] **Step 2: Add the convenience npm script**

Edit `package.json`, adding to `scripts` (after `readme:check`):

```json
    "test:case": "node tools/test-runner.mjs",
```

Usage will be `npm run test:case -- okf-docs-setup` (local, spends inference).

- [ ] **Step 3: Write the failing test** (dry-run integration + CLI wiring; no inference)

Create `tools/test-runner.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runCase, runHarness } from './test-runner.mjs';

const CLI = fileURLToPath(new URL('./test-runner.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('runCase --dry-run builds an out-of-repo fixture per harness and leaves sources unmodified', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', { dryRun: true, runsRoot });
    assert.equal(run.harnesses.length, 3);
    for (const h of run.harnesses) {
      assert.equal(h.status, 'dry-run');
      assert.ok(h.closure.includes('okf-docs-setup')); // closure includes the skill itself
      assert.equal(h.sourcesUnmodified, true);
      const s = await stat(h.fixtureRoot);
      assert.ok(s.isDirectory());
      assert.ok(!h.fixtureRoot.startsWith(REPO_ROOT), 'fixture must live outside the repo tree');
      await rm(h.fixtureRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('the harness fixture lives outside the repo tree (no ancestor memory/skills leak)', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', { dryRun: true, runsRoot });
    for (const h of run.harnesses) {
      // cwd is not under the repo, so the cwd-upward walk can never reach this
      // repo's CLAUDE.md / AGENTS.md / .claude/skills (docs-add, docs-validate).
      assert.ok(!h.fixtureRoot.startsWith(REPO_ROOT));
      await rm(h.fixtureRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('runCase --dry-run --harness selects a single harness', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', { dryRun: true, runsRoot, harnessIds: ['claude-code'] });
    assert.equal(run.harnesses.length, 1);
    assert.equal(run.harnesses[0].id, 'claude-code');
    await rm(run.harnesses[0].fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('runHarness runs a fake driver (no inference) and returns an executed, out-of-repo result', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = { inputs: [], prompt: 'x', assertions: [{ type: 'output-contains', value: 'HELLO' }] };
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      buildInvocation: () => ({ command: process.execPath, args: ['-e', 'process.stdout.write("HELLO")'], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't', beforeHash: '', dryRun: false,
    });
    assert.equal(r.status, 'executed');
    assert.ok(!r.fixtureRoot.startsWith(REPO_ROOT));
    assert.equal(r.assertions[0].pass, true);
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('CLI dry-run exits 0 and prints a report', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const r = spawnSync(process.execPath, [CLI, 'okf-docs-setup', '--dry-run', '--runs', runsRoot], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /test-runner — case: okf-docs-setup \(dry run\)/);
    assert.match(r.stdout, /claude-code/);
    assert.match(r.stdout, /codex/);
    assert.match(r.stdout, /opencode/);
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('CLI exits 2 with usage when no skill is given', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test('CLI exits 2 when --harness has no value', () => {
  const r = spawnSync(process.execPath, [CLI, 'okf-docs-setup', '--harness'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node --test tools/test-runner.test.mjs`
Expected: FAIL — `Cannot find module './test-runner.mjs'`.

- [ ] **Step 5: Write minimal implementation**

Create `tools/test-runner.mjs`:

```js
#!/usr/bin/env node
// Local, GATING skill test runner (issue #24 tracer bullet). Projects a skill +
// its `## Required skills` closure into a disposable per-harness fixture, drives
// each harness's headless CLI against the case's scenario prompt, and decides
// pass/fail from deterministic state assertions ONLY. Exits NONZERO on assertion
// failure or source mutation — deliberately unlike the always-advisory docs
// validator and skill linter. Runs LOCALLY ONLY; never invoked by CI.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DRIVERS, resolveDriver } from './test-runner/drivers.mjs';
import { buildFixture, hashGuardedTrees } from './test-runner/fixture.mjs';
import { loadCase } from './test-runner/case-loader.mjs';
import { isHarnessAvailable, runDriver } from './test-runner/runner.mjs';
import { evaluateAssertions } from './test-runner/oracle.mjs';
import { formatRunReport, exitCodeFor } from './test-runner/report.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

// skills/ is the ADR immutability AC; docs/ scripts/ .claude/ are the other
// committed trees a mis-targeted agent could clobber if it resolves the
// enclosing git root instead of honoring cwd. tools/ is excluded (tools/runs
// churns every run). Defense-in-depth atop the out-of-repo fixture.
const GUARDED_DIRS = ['skills', 'docs', 'scripts', '.claude'];

class UsageError extends Error {}

// One harness's full lifecycle, returning exactly one status-tagged
// HarnessResult (see Task 7). Extracted from runCase so a fake driver can
// exercise the executed branch in tests without inference, and so the tagged
// union is built in ONE place (no producer/contract drift).
export async function runHarness(driver, { skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun }) {
  const id = driver.id;
  // The harness spawn cwd MUST live OUTSIDE the repo tree: a headless CLI walks
  // up from cwd to discover project memory (CLAUDE.md/AGENTS.md) and project
  // skills (.claude/skills), so an in-repo fixture would leak this repo's own
  // memory + docs-add/docs-validate skills into the skill under test. Env
  // isolation covers user-level config only, not the cwd-upward walk.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));

  const closure = await buildFixture({
    skillName, skillsRoot, driver, fixtureRoot, inputs: testCase.inputs,
  });
  const sourcesUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  if (dryRun) {
    const invocation = driver.buildInvocation({ fixtureRoot, prompt: testCase.prompt });
    return { id, status: 'dry-run', closure, invocation, sourcesUnmodified, fixtureRoot };
  }
  if (!isHarnessAvailable(driver.command)) {
    await rm(fixtureRoot, { recursive: true, force: true });
    return { id, status: 'skipped', skipReason: `${driver.command} CLI not installed`, fixtureRoot };
  }

  const proc = runDriver(driver, { fixtureRoot, prompt: testCase.prompt });
  const assertions = await evaluateAssertions(testCase.assertions, {
    workdir: fixtureRoot, repoRoot: REPO_ROOT, output: proc.stdout,
  });
  const afterUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Raw artifacts land in the git-ignored in-repo runs area, created lazily so a
  // dry run leaves no empty dirs. The fixture itself stays ephemeral in tmpdir.
  const runDir = join(runsRoot, runId, id);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'transcript.json'), proc.stdout || proc.stderr || '');
  await writeFile(join(runDir, 'assertions.json'), JSON.stringify(assertions, null, 2));

  return {
    id, status: 'executed', assertions, sourcesUnmodified: afterUnmodified,
    exitStatus: proc.status,
    harnessError: proc.timedOut ? 'harness timed out after the configured limit' : proc.error,
    timedOut: proc.timedOut,
    fixtureRoot,
  };
}

export async function runCase(skillName, opts = {}) {
  const {
    skillsRoot = join(REPO_ROOT, 'skills'),
    casesRoot = join(REPO_ROOT, 'tools/tests'),
    runsRoot = join(REPO_ROOT, 'tools/runs'),
    harnessIds = DRIVERS.map((d) => d.id),
    dryRun = false,
    runId = String(Date.now()),
  } = opts;

  const testCase = await loadCase(skillName, { casesRoot });
  const beforeHash = await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS);
  const harnesses = [];

  for (const id of harnessIds) {
    const driver = resolveDriver(id);
    if (!driver) throw new UsageError(`unknown harness: ${id}`);
    harnesses.push(
      await runHarness(driver, { skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun }),
    );
  }

  return { skill: skillName, runId, dryRun, harnesses };
}

function parseArgs(argv) {
  const opts = { dryRun: false, harnessIds: undefined, runsRoot: undefined };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--harness') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --harness requires a value');
      opts.harnessIds = [v];
    } else if (a === '--runs') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --runs requires a value');
      opts.runsRoot = v;
    } else if (!a.startsWith('--')) positional.push(a);
  }
  return { opts, positional };
}

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2));
  const skillName = positional[0];
  if (!skillName) {
    throw new UsageError('usage: node tools/test-runner.mjs <skill-name> [--harness <id>] [--dry-run] [--runs <dir>]');
  }
  const run = await runCase(skillName, opts);
  console.log(formatRunReport(run));
  const code = exitCodeFor(run);
  // The CLI owns cleanup of the ephemeral tmpdir fixtures it created (in-process
  // callers clean their own). Done after the report so fixture paths stay valid.
  for (const h of run.harnesses) {
    await rm(h.fixtureRoot, { recursive: true, force: true });
  }
  process.exit(code);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(err instanceof UsageError ? 2 : 1);
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tools/test-runner.test.mjs`
Expected: PASS — all 7 tests pass.

- [ ] **Step 7: Run the full deterministic suite (this is what CI runs)**

Run: `npm test`
Expected: PASS — all `scripts/*`, `tools/*`, and `tools/test-runner/*` tests pass; no inference, no network.

- [ ] **Step 8: Confirm the runs area is git-ignored**

Run: `git check-ignore tools/runs/x && echo IGNORED`
Expected: prints `tools/runs/x` then `IGNORED`.

- [ ] **Step 9: Commit**

```bash
git add tools/test-runner.mjs tools/test-runner.test.mjs .gitignore package.json
git commit -m "feat: #24 add the gating test-runner CLI with a dry-run smoke path"
```

- [ ] **Step 10: Manual local end-to-end verification (LOCAL ONLY — spends inference; not part of CI)**

This exercises Acceptance Criterion #1 and #2. Requires at least the `claude` CLI installed and authenticated locally.

**Authentication precondition (a FAIL may be an env problem, not a skill regression).** The fixture points `CLAUDE_CONFIG_DIR`/`HOME`/`CODEX_HOME`/XDG roots at empty per-fixture dirs and never populates them. A CLI that authenticates from a config file (subscription/OAuth) finds no credentials; `isHarnessAvailable` only probes `--version`, so such a harness is NOT skipped — it runs, writes nothing, and every assertion FAILs, indistinguishable from a real skill failure. Before trusting any FAIL: export an API key (`ANTHROPIC_API_KEY` for `claude-code`, `OPENAI_API_KEY` for `codex`) — `runDriver` merges `process.env` through, so key auth survives isolation. On macOS (this dev host) `claude` reads OAuth from the Keychain, so the AC-#1 `claude-code` leg usually authenticates without a key; the `codex`/`opencode` legs (emptied `$HOME`) generally need it. A future hardening pass may reclassify a clean auth failure as SKIPPED once exit `status` is trusted; out of scope here.

**Permission verification (ran-but-wrote-nothing is a distinct diagnostic).** The grants baked into `buildInvocation` (claude `--permission-mode bypassPermissions`, codex `-s workspace-write`, opencode `--auto`) were verified via each CLI's `--help`. Confirm the agent actually WROTE files under `<fixtureRoot>` (e.g. `find <fixtureRoot>/docs -type f`). If a harness produced output but the fixture has no created files and every filesystem assertion FAILs, that is a TOOL-PERMISSION problem, not a skill failure. If a harness version rejects a flag, correct it in `drivers.mjs` (and its test). WARNING: claude `bypassPermissions` grants UNCONFINED writes — its only real confinement is the disposable out-of-repo tmpdir fixture (and running as an unprivileged user); the widened `hashGuardedTrees` guard covers only `skills/`/`docs/`/`scripts/`/`.claude/`, NOT `tools/` or non-repo paths. See the open question on preferring a seeded least-privilege `settings.json` allow-list.

**Discovery-path verification.** Before trusting the codex/opencode verdicts, confirm each installed CLI actually discovers skills from the subdir the fixture uses. Codex is ambiguous: the install REGISTRY flags `.codex/skills` as unverified, and `docs/references/agent-skill-testing-landscape.md:126-131` names a different cwd-relative `.agents/skills/<name>/SKILL.md`. Verify which path codex 0.139.0 reads; a codex leg that silently never discovers the skill FAILs for a reason unrelated to permissions or skill correctness. If a harness needs a different path or flag, fix `drivers.mjs` (and its test) and note it in `log.md` if doing documentation work.

Run (single harness, the minimum for AC #1):
```bash
npm run test:case -- okf-docs-setup --harness claude-code
```
Expected: the report shows `claude-code: PASS (16/16 assertions)` and exit 0. A 0/16 result with visible model output almost always means the permission grant was not honored (or auth failed), not that the skill failed — check for written files first. To prove gating, temporarily break one assertion in `tools/tests/okf-docs-setup/case.mjs` (e.g. change `docs/index.md` to `docs/nope.md`), rerun, confirm a `FAIL` line and nonzero exit (`echo $?` prints 1); then revert.

Run (all three drivers, each its own fixture — AC #2; absent CLIs report `SKIPPED`):
```bash
npm run test:case -- okf-docs-setup
```
Expected: each of `claude-code`, `codex`, `opencode` reports `PASS` or `SKIPPED (… CLI not installed)`; committed sources remain unmodified — confirm `git status --short skills docs scripts .claude` is empty. If the report shows `! canonical sources were modified`, the run gated FAIL because the agent wrote outside its fixture (likely resolved the enclosing git root instead of honoring cwd); the out-of-repo fixture is the primary mitigation and the widened `hashGuardedTrees` proof is the backstop.

---

## Task 9: Linter advisory WARN for missing central test-case directory

**Files:**
- Modify: `tools/lint-skills.mjs` (add `lintTestCases`; thread `caseDirNames` through `lintSkillTree`; read `tools/tests/` in `main()`)
- Modify: `tools/lint-skills.test.mjs` (import `lintTestCases`; add unit + integration coverage)

**Interfaces:**
- Consumes: the existing `lintSkillTree(skillsRoot, readmeText)` signature and `collect` helper.
- Produces:
  - `lintTestCases(skillNames: string[], caseDirNames: string[]): { errors: [], warnings: string[] }` — one advisory WARN per skill name absent from `caseDirNames`.
  - `lintSkillTree(skillsRoot, readmeText, caseDirNames = null)` — when `caseDirNames` is `null` the check is skipped (preserves existing 2-arg callers and their expected findings); when an array is passed the WARN runs after the per-skill loop, beside `lintReadmeInventory`.

**Design note:** the case directory is central (`tools/tests/<name>/`), NOT a per-skill subdir — so this is a repo-level check modeled on `lintReadmeInventory` (which takes `readmeText` as data), not on `lintSupportSubdirs`. Do NOT add anything to `ROLE_SUBDIRS`; no skill subdir is involved. It is advisory (pushes only to `warnings`) so it never affects the exit code, even under `--strict`.

- [ ] **Step 1: Write the failing test**

Add to `tools/lint-skills.test.mjs` — first extend the import block at the top to include `lintTestCases`:

```js
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
  lintTestCases,
  collectSkills,
  lintSkillTree,
  formatReport,
} from './lint-skills.mjs';
```

Then append these tests to the end of the file:

```js
test('lintTestCases warns for a skill with no central case directory', () => {
  const { errors, warnings } = lintTestCases(['okf-docs-setup', 'other'], ['okf-docs-setup']);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /other: skill has no central test-case directory \(tools\/tests\/other\/\)/);
});

test('lintTestCases is silent when every skill has a case directory', () => {
  const { warnings } = lintTestCases(['a', 'b'], ['a', 'b']);
  assert.equal(warnings.length, 0);
});

test('lintSkillTree skips the case-dir check when caseDirNames is null (default)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lint-'));
  try {
    await mkdir(join(root, 'a'), { recursive: true });
    await writeFile(join(root, 'a', 'SKILL.md'), '---\nname: a\ndescription: d\n---\nbody\n');
    const r = await lintSkillTree(root, ''); // 2-arg call → no test-case warnings
    assert.ok(!r.warnings.some((w) => /central test-case directory/.test(w)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lintSkillTree emits the advisory WARN (never an ERROR) when a case dir is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lint-'));
  try {
    await mkdir(join(root, 'a'), { recursive: true });
    await writeFile(join(root, 'a', 'SKILL.md'), '---\nname: a\ndescription: d\n---\nbody\n');
    const r = await lintSkillTree(root, '', []); // no case dirs exist
    assert.ok(r.warnings.some((w) => /a: skill has no central test-case directory/.test(w)));
    assert.ok(!r.errors.some((e) => /test-case/.test(e)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/lint-skills.test.mjs`
Expected: FAIL — `lintTestCases` is not exported / not a function.

- [ ] **Step 3: Add the check function** to `tools/lint-skills.mjs`

Insert after `lintReadmeInventory` (immediately before `export async function collectSkills`):

```js
// Advisory WARN: a skill with no central test-case directory under tools/tests/.
// The sibling of lintReadmeInventory's drift check — cases are central, so this
// is a repo-level check over directory names, not a per-skill subdir check.
export function lintTestCases(skillNames, caseDirNames) {
  const have = new Set(caseDirNames);
  const warnings = [];
  for (const name of skillNames) {
    if (!have.has(name)) {
      warnings.push(`${name}: skill has no central test-case directory (tools/tests/${name}/)`);
    }
  }
  return { errors: [], warnings };
}
```

- [ ] **Step 4: Thread the data through `lintSkillTree`**

Change the signature and add the guarded call. Replace:

```js
export async function lintSkillTree(skillsRoot, readmeText) {
```
with:
```js
export async function lintSkillTree(skillsRoot, readmeText, caseDirNames = null) {
```

And replace:
```js
  collect(lintReadmeInventory([...knownSkillNames], readmeText));
  return { errors, warnings };
```
with:
```js
  collect(lintReadmeInventory([...knownSkillNames], readmeText));
  if (caseDirNames !== null) {
    collect(lintTestCases([...knownSkillNames], caseDirNames));
  }
  return { errors, warnings };
```

- [ ] **Step 5: Read `tools/tests/` in `main()` and pass it**

`tools/lint-skills.mjs` already imports `{ readdir, readFile }` at line 1 (readdir is used by the existing skill enumeration), so no import change is needed — `readdir` is available.

Then in `main()`, replace:
```js
  const result = await lintSkillTree(skillsRoot, readmeText);
```
with:
```js
  let caseDirNames = [];
  try {
    const entries = await readdir('tools/tests', { withFileTypes: true });
    caseDirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // No tools/tests/ yet — every skill will be flagged (advisory only).
  }
  const result = await lintSkillTree(skillsRoot, readmeText, caseDirNames);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tools/lint-skills.test.mjs`
Expected: PASS — all existing tests plus the 4 new ones pass.

- [ ] **Step 7: Verify the real repo lints clean (WARN-free for okf-docs-setup, exit 0)**

Run: `npm run lint:skills`
Expected: no `central test-case directory` warning for `okf-docs-setup` (its case dir was created in Task 5), and the process exits 0.

Run: `npm run lint:skills:strict`
Expected: exits 0 (the new check is advisory and cannot fail `--strict`).

- [ ] **Step 8: Commit**

```bash
git add tools/lint-skills.mjs tools/lint-skills.test.mjs
git commit -m "feat: #24 warn (advisory) when a skill lacks a central test-case directory"
```

---

## Task 10: Reconcile the docs bundle

**Files:**
- Modify: `docs/decisions/skill-testing-architecture.md` (append ONE dated block under the existing `## Amendments` section — never rewrite the decisions above it — and bump the frontmatter `timestamp` to the amendment date)
- Modify: `docs/log.md` (prepend a `## YYYY-MM-DD` section, newest-first, with an `**Update**` entry)

**Gate — run this task ONLY if a decision materially changed vs the ADR.** This is a documentation-reconciliation task, not new code. It fires only when, at implementation time, the built runner materially diverged from a decision in `docs/decisions/skill-testing-architecture.md`. Two divergences are already known from the review and are expected to hold:
1. **Decision 2 (advisory recording) — DEFERRED.** The ADR states advisory signal (skill-selection evidence, LLM-judge scores) is "recorded as advisory signal and never gate." The tracer bullet implements only the deterministic oracle; `HarnessResult` (Task 7) reserves no advisory slot (finding G5).
2. **Decision 1 (disposable fixture) — REFINED.** The ADR left the fixture's physical location unspecified; the runner builds the spawn `cwd` outside the repo under `os.tmpdir()` for discovery isolation (finding P1), and widens the immutability proof beyond `skills/` (finding G2).
If, at implementation time, neither of these (nor any other decision) actually diverged — e.g. advisory recording ended up implemented, or the fixture stayed in-repo — SKIP this task and check the box with a note. Purely executable-truth changes (the tool-permission flags of finding G1, timeouts, exit-code plumbing) are NOT decision changes and MUST NOT trigger an amendment.

**Design note — reference executable truth, never paste it.** Per `docs/conventions/documentation.md` ("Code in concepts — separate truth by type") the runner is executable truth: it lives in `tools/` (outside `docs/`) and is verified by running it. The amendment therefore NAMES files and symbols (`tools/test-runner.mjs` `runCase`, `tools/test-runner/report.mjs` `HarnessResult`, `tools/test-runner/drivers.mjs`) and describes what changed and WHY — it copies no code, no assertion lists, no flags. Do NOT create a new `Specification` concept mirroring the runner mechanics: that would duplicate executable truth and drift (YAGNI + DRY). Both divergences are revisions to existing decisions in ONE ADR, so this is an amend, not a `docs-add`. This plan lives under `docs/superpowers/**`, which is EXCLUDED from the bundle, so editing the plan triggers no ceremony — the ceremony below applies to the real bundle files touched during THIS task.

- [ ] **Step 1: Confirm the gate**

Diff the built runner against the two decisions above. Confirm each divergence actually holds in the merged implementation (grep `HarnessResult` in `tools/test-runner/report.mjs` for any advisory-signal field; confirm `runCase`/`runHarness` in `tools/test-runner.mjs` builds `fixtureRoot` under `os.tmpdir()`). If NO decision materially diverged, check this task's boxes with the note "no material divergence — no amendment needed" and STOP. The `docs-authoring` rule fires automatically on the `docs/**` edits below and surfaces the ceremony.

- [ ] **Step 2: Amend the ADR (dated block, append-only)**

In `docs/decisions/skill-testing-architecture.md`, under the existing `## Amendments` marker, APPEND one dated entry — do not touch the Decision/Alternatives/Consequences text above it:

```markdown
## 2026-07-14 — Tracer-bullet reconciliation (#24)

- Decision 2 (advisory recording) is DEFERRED in the #24 tracer bullet: only the
  deterministic oracle is implemented; skill-selection evidence and LLM-judge
  scores are not recorded, and the run result shape
  (`HarnessResult` in `tools/test-runner/report.mjs`) reserves no slot for them.
  The "never gate" constraint is honored; recording is future work and will
  extend the report/exit union when added. Driven by #24.
- Decision 1 (disposable fixture): the ADR left the fixture's physical location
  open. Implementation builds the harness spawn `cwd` OUTSIDE the repo tree under
  `os.tmpdir()` (see `runCase`/`runHarness` in `tools/test-runner.mjs`), because a
  headless CLI walks up from `cwd` to discover project memory (`CLAUDE.md`/`AGENTS.md`)
  and project skills (`.claude/skills`); an in-repo fixture would leak this repo's own
  memory and skills into the skill under test. Raw artifacts still land in the
  git-ignored `tools/runs/`. The immutability proof is also widened beyond
  `skills/` to hash `docs/`, `scripts/`, `.claude/` (intent-aligned hardening,
  not an AC change). Driven by #24.
```

Reference files by path only; paste no runner code, flags, or assertion lists.

- [ ] **Step 3: Bump the ADR timestamp**

In the frontmatter of `docs/decisions/skill-testing-architecture.md`, set `timestamp` to the amendment date (`2026-07-14`).

- [ ] **Step 4: Append the log entry (update ceremony)**

Prepend a newest-first section to `docs/log.md`:

```markdown
## 2026-07-14

- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  reconciled the #24 test-runner tracer bullet — advisory-signal recording
  (Decision 2) deferred, and the disposable fixture (Decision 1) built outside
  the repo under `os.tmpdir()` for discovery isolation with the immutability
  proof widened to `docs/`/`scripts/`/`.claude/`.
```

- [ ] **Step 5: Run the advisory backstop**

Run: `npm run docs:validate`
Expected: exit 0, no NEW warnings for `docs/decisions/skill-testing-architecture.md` (frontmatter parses, `type` non-empty). The validator is advisory and never blocks; it is the backstop, not the gate.

- [ ] **Step 6: Commit**

```bash
git add docs/decisions/skill-testing-architecture.md docs/log.md
git commit -m "docs: #24 amend skill-testing ADR for tracer-bullet reconciliation"
```

---

## Final Verification

- [ ] **Run the complete deterministic suite (mirrors CI)**

Run: `npm test`
Expected: PASS across `scripts/*.test.mjs`, `tools/*.test.mjs`, `tools/test-runner/*.test.mjs`. No inference, no network, no API keys.

- [ ] **Run the CI gate locally**

Run: `npm run lint:skills:strict && npm run docs:validate && npm test`
Expected: all three succeed; this is exactly what `.github/workflows/ci.yml` runs (unchanged — no new inference step, no secrets).

- [ ] **Confirm no test material leaked into `skills/`**

Run: `git status --short skills/ && find skills -name case.mjs -o -name prompt.md`
Expected: `skills/` is clean and the `find` prints nothing (cases live only under `tools/tests/`).

- [ ] **Local end-to-end (AC #1/#2, LOCAL ONLY)**

Already covered by Task 8 Step 10. Re-run `npm run test:case -- okf-docs-setup` and confirm a deterministic PASS/FAIL with a gating exit code.

---

## Acceptance-Criteria Traceability

| Issue #24 acceptance criterion | Where satisfied |
|---|---|
| One command runs the okf-docs-setup case end-to-end on ≥1 harness; nonzero exit on assertion failure | Task 8 (CLI + `exitCodeFor`), Step 10 manual run |
| The same case runs through all three harness drivers, each against its own fixture | Task 1 (three drivers), Task 8 (`runCase` loops per harness, separate `fixtureRoot`) |
| Fixture contains the skill + full `## Required skills` closure; canonical sources verifiably unmodified | Task 2 (`buildFixture` via `transitiveClosure`; `hashGuardedTrees` over `skills/`/`docs/`/`scripts/`/`.claude/`), Task 8 (per-run before/after guard). Widened beyond the ADR skills-only AC to also detect outbound clobber of committed docs/scripts/.claude — intent-aligned hardening, not AC-mandated. |
| Raw run artifacts land in a git-ignored directory; nothing under `skills/` gains test material | Task 5 (cases under `tools/tests/`), Task 8 (`tools/runs/` + `.gitignore`), Final Verification |
| Linter WARNs on skills lacking a central test-case directory | Task 9 (`lintTestCases`, advisory) |
| CI unchanged: no inference, no API keys | Global Constraints; runner inference path is local-only; `npm test` runs only deterministic components; no `ci.yml` edit |
| ADR Decision 2 says advisory signal is "recorded as advisory signal"; the tracer bullet records none | DEFERRED (intentional, YAGNI) — #24 ACs need only the deterministic oracle; skill-selection evidence and LLM-judge scores are not implemented and `HarnessResult` (Task 7) reserves no slot. Adding it later extends the report/exit union. Reconciled by a dated `## Amendments` entry on `docs/decisions/skill-testing-architecture.md` (Task 10). |
| ADR Decision 1 left the disposable fixture's physical location unspecified; the runner builds the spawn `cwd` outside the repo (`os.tmpdir()`) and widens the immutability proof beyond `skills/` | Task 8 (`runHarness` builds `fixtureRoot` under `os.tmpdir()`; `hashGuardedTrees` over `skills/`/`docs/`/`scripts/`/`.claude/`), reconciled into the ADR via the dated `## Amendments` entry (Task 10). |
