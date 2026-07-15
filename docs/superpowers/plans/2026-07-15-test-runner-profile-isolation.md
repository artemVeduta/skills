# Test-Runner Profile-Based Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live e2e skill-test runs execute against dedicated, persistent, pre-authenticated per-harness profiles under `~/.skills-test-profiles/`, with per-harness model pinning, a four-rung preflight skip ladder (including the opencode daemon guard), and model/version provenance in every run record.

**Architecture:** A new pure `profiles.mjs` module is the single source of truth for profile paths, per-harness env maps, and auth-material locations. The driver seam widens (each descriptor gains `defaultModel`, `probe`, and a `buildInvocation({fixtureRoot, prompt, model, profileDir})` signature); the impure runner gains a probe-with-version and a dependency-injected preflight ladder; the CLI gains repeatable `--harness <id>[=<model>]`, a `run.json` provenance artifact, and a `test:auth` provisioning helper.

**Tech Stack:** Node.js ESM (`.mjs`), zero npm dependencies, `node:test` + `node:assert/strict` for tests, `spawnSync` for CLI probes/spawns. Spec: `docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md`.

## Global Constraints

- Profiles live at exactly `~/.skills-test-profiles/<harness-id>/` (via `os.homedir()`); **no env-var override** (spec D1).
- The four skip reasons are **verbatim** (spec §7): rung 1 `` harness binary `<command>` not found — install `<id>` or fix PATH ``; rung 2 `` no test profile — run `npm run test:auth -- <id>` ``; rung 3 `` profile exists but is not authenticated — run `npm run test:auth -- <id>` ``; rung 4 `` kill the running opencode server first — `run` may attach to it and escape the fixture ``.
- Exit codes unchanged: 0 all-executed-green + sources clean; 1 any executed failure, source mutation, or nothing executed; 2 usage error.
- Verdicts derive **solely** from deterministic assertions + source immutability; harness exit status and timeout stay informational (spec non-goal 4). No vacuous PASS.
- `npm test` stays fully deterministic — no inference, no network, no login flows. Inference is only spent by the local `test:case` live path, `test:auth`, and the V1–V3/AC live checks. No CI changes.
- Guarded trees stay exactly `skills/ docs/ scripts/ .claude/`; fixture cwd stays an out-of-repo `os.tmpdir()` dir; profiles are outside the guard and expected to mutate (spec D6).
- Duplicate `--harness` ids are a usage error (exit 2). Default harness set: all three registered drivers with their `defaultModel`.
- opencode env always includes `OPENCODE_DISABLE_AUTOUPDATE=1`. claude and codex env maps intentionally **omit `HOME`** (inherited from `process.env` at spawn — macOS Keychain access, spec §5/§10).
- ADR decision text is never rewritten — only a dated `## Amendments` entry; every docs edit bumps `timestamp` and adds a newest-first `docs/log.md` entry.
- No new files inside `skills/<name>/` (everything there ships to installs). No strategy objects, no data-driven registry (spec D7) — plain data fields on driver descriptors.
- Commit message style follows branch history: `feat: #24 <what>` / `docs: #24 <what>` / `test: #24 <what>`.
- The pydantic-ai driver itself is OUT of scope (spec non-goal); only the structural readiness proof (Task 10) is in scope.

---

## Context primer (read first — assumes zero repo knowledge)

**What this repo is.** A personal library of agent skills (`skills/<name>/SKILL.md`) that can be installed into several agent CLIs ("harnesses": Claude Code, Codex, OpenCode). `tools/` holds a gating **skill test runner**: it copies a skill (plus its dependency closure) into a disposable fixture directory under `os.tmpdir()`, runs a harness CLI headlessly against a scenario prompt with the fixture as cwd, then checks deterministic filesystem/output assertions ("the oracle") and verifies the repo's committed trees were not mutated (the "immutability guard"). It exits nonzero on failure — unlike everything else in the repo, which is advisory.

**Vocabulary.** *Harness* = the agent CLI (`claude`, `codex`, `opencode`). *Driver* = the descriptor object in `tools/test-runner/drivers.mjs` that knows how to invoke one harness. *Fixture* = the throwaway tmpdir the harness runs in. *Case* = `tools/tests/<skill>/case.mjs` + `prompt.md` (16 assertions for the only current case, `okf-docs-setup`). *Test profile* = (new, this plan) a persistent pre-authenticated config root at `~/.skills-test-profiles/<harness-id>/`.

**Why this plan exists.** The previous design pointed each harness's `HOME`/config at *empty* fixture dirs. That hid OAuth credentials (claude/codex exited 1, wrote nothing) and never actually confined opencode (a pre-existing daemon served the run in the real repo and mutated 8 committed files — caught by the guard). The approved fix: isolation ≠ emptiness. Live runs get persistent, pre-authenticated, per-harness profiles, provisioned once by the developer.

**Key commands.**
- `npm test` — full deterministic suite (`node --test scripts/*.test.mjs tools/*.test.mjs tools/test-runner/*.test.mjs`). Must always pass; spends no inference.
- Single file: `node --test tools/test-runner/profiles.test.mjs`.
- `npm run test:case -- okf-docs-setup [--harness <id>[=<model>]]... [--dry-run]` — the runner CLI. **⚠ Without `--dry-run` this spends real inference and requires provisioned profiles.**
- `npm run lint:skills:strict`, `npm run docs:validate` — advisory gates that must exit 0 at the end.

**Execution ordering note.** Tasks 1–3 are **interactive verification probes** (spec §9 V1–V3): they need a human at the terminal (OAuth login flows in a browser) and the installed CLIs (`claude` 2.1.209, `codex` 0.139.0, `opencode` 1.18.0). If you are a subagent that cannot run interactive login flows, STOP and hand these tasks to the human, then resume at Task 4. Tasks 4–11 are fully deterministic. Task 12 (live ACs) again spends inference. Tasks 1–3 record their outcomes in a committed notes file that later tasks read; where a later task branches on an outcome, both branches are fully specified inline.

## File structure

```
tools/
  test-runner/
    profiles.mjs            CREATE  pure: profileDirFor / profileEnvFor / authMaterialPath
    profiles.test.mjs       CREATE  unit tests for the three functions
    drivers.mjs             REWRITE isolationEnv deleted; descriptors gain defaultModel/probe/
                                    daemonBasename; buildInvocation({fixtureRoot,prompt,model,profileDir})
    drivers.test.mjs        REWRITE invocation/env/invariant tests for the new seam
    runner.mjs              MODIFY  probeHarness (replaces isHarnessAvailable), preflightHarness
                                    ladder (DI for fs/process), runDriver threads {model, profileDir}
    runner.test.mjs         MODIFY  probe/preflight/threading tests + pydantic-ai readiness proof
    report.mjs              MODIFY  provenance line (executed), full-invocation dry-run display
    report.test.mjs         MODIFY  fixtures gain model/harnessVersion; new provenance/dry-run tests
    fixture.mjs             UNCHANGED (unless V3 forces the codex profile-staging fallback — Task 8)
  test-runner.mjs           MODIFY  parseArgs repeatable --harness id[=model]; runCase selections;
                                    runHarness preflight + run.json; parseArgs exported
  test-runner.test.mjs      MODIFY  parseArgs tests, fake-driver preflight injection, run.json test
  test-auth.mjs             CREATE  impure provisioning helper (npm run test:auth -- <id>)
  test-auth.test.mjs        CREATE  usage-error CLI tests (deterministic only)
package.json                MODIFY  add "test:auth" script
docs/decisions/skill-testing-architecture.md   MODIFY  dated amendment + timestamp bump
docs/glossary/harness.md                       MODIFY  test-profile paragraph + timestamp bump
docs/log.md                                    MODIFY  newest-first 2026-07-15 entry
docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md  CREATE  V1–V3 + AC evidence
```

Dependency direction: `profiles.mjs` (pure, no imports beyond node) ← `drivers.mjs` (pure) ← `runner.mjs` (impure spawn) ← `test-runner.mjs` (CLI). `test-auth.mjs` imports only `drivers.mjs` + `profiles.mjs`.

---

### Task 1: V1 — claude profile auth scoping probe (interactive, no inference)

**Files:**
- Create: `docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the recorded **V1 outcome** — either `LOGIN` (profile-scoped `claude login` works and lands `.claude.json` in the profile) or `SEED` (test-auth must copy `~/.claude.json` into the profile). Task 9 branches on this. In **both** outcomes `authMaterialPath('claude-code', profileDir)` is `<profileDir>/.claude.json` (Task 4 hardcodes that unconditionally).

- [ ] **Step 1: Create the notes file with the outcome template**

Write `docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md`:

```markdown
# Profile-isolation pre-wiring verification notes (#24)

> Evidence log for spec §9 (V1–V3) and §11 (AC-1…AC-4) of
> `docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md`.
> Appended as each verification runs; command output pasted verbatim.

## V1 — claude profile auth scoping

- Date/CLI version:
- Login subcommand found in `claude --help`:
- Where the OAuth pointer landed:
- Keychain entry observed:
- Main install auth intact afterwards (pointer + keychain checks):
- **Outcome: LOGIN | SEED** (circle one)

## V2 — opencode env honoring

- Date/CLI version:
- Real `~/.config/opencode` + `~/.local/share/opencode` mtimes unchanged: YES/NO
- Auth material created at `<profile>/xdg-data/opencode/auth.json`: YES/NO
- Pinned opencode default model id (from `opencode models`):
- **Outcome: CONFIRMED | BLOCKED**

## V3 — codex skill discovery under profile CODEX_HOME

- Date/CLI version:
- cwd-relative `.agents/skills` discovered: YES/NO
- `$CODEX_HOME/skills` discovered (only tested if the above was NO): YES/NO
- **Outcome: CWD (`discoverySubdir: '.agents/skills'`) | PROFILE-STAGING fallback**

## AC evidence (filled by Task 12)

### AC-1 — all three live green
### AC-2 — model pinning live
### AC-3 — preflight SKIPs live (rungs 2–4)
### AC-4 — deterministic gate
```

- [ ] **Step 2: Find the claude login subcommand (do not guess)**

Run: `claude --help 2>&1 | grep -iE 'login|auth|setup-token'`
Expected: a line naming the login entry point (candidates in 2.1.209: a `login` subcommand, or interactive-only `/login`). Record the exact form in the notes.

- [ ] **Step 3: Snapshot the main install's auth state (for the after-check)**

```bash
CLAUDE_TEST_PROFILE="$HOME/.skills-test-profiles/claude-code"
mkdir -p "$CLAUDE_TEST_PROFILE"
cp ~/.claude.json /tmp/claude-json-before.bak
security find-generic-password -s "Claude Code-credentials" >/dev/null 2>&1; echo "keychain-before rc=$?"
# If rc!=0, discover the real service name and use it in all later checks:
security dump-keychain 2>/dev/null | grep -i claude
```

- [ ] **Step 4: Run the login flow against the profile**

```bash
CLAUDE_CONFIG_DIR="$CLAUDE_TEST_PROFILE" claude login
```
If Step 2 showed no `login` subcommand: run `CLAUDE_CONFIG_DIR="$CLAUDE_TEST_PROFILE" claude`, type `/login`, complete the browser OAuth flow, then `/exit`. (Suggest the user runs this as `! CLAUDE_CONFIG_DIR=... claude login` if you cannot attach a TTY.)

- [ ] **Step 5: Check where the OAuth pointer landed and that the main install is untouched**

```bash
ls -la "$CLAUDE_TEST_PROFILE"
grep -c oauthAccount "$CLAUDE_TEST_PROFILE/.claude.json" 2>/dev/null   # expect: 1
cmp -s ~/.claude.json /tmp/claude-json-before.bak && echo "main pointer untouched"
security find-generic-password -s "Claude Code-credentials" >/dev/null 2>&1 && echo "keychain entry still present"
```
Expected (spec's expected outcome → **LOGIN**): `.claude.json` containing `oauthAccount` exists inside the profile; the main `~/.claude.json` is byte-identical to the snapshot; the Keychain entry still resolves. (Keychain-entry presence + intact pointer is the no-inference proxy for "main install still works" — V1 forbids spending inference.)

If instead login refused to run profile-scoped, or wrote the pointer to the real `~/.claude.json` only → **SEED**: verify the seed works by `cp ~/.claude.json "$CLAUDE_TEST_PROFILE/.claude.json"` — Task 9's claude branch then ships this copy step instead of a login spawn.

- [ ] **Step 6: Record the outcome in the notes file (fill every V1 line), then clean up**

```bash
rm /tmp/claude-json-before.bak
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md
git commit -m "docs: #24 record V1 claude profile auth-scoping outcome"
```

---

### Task 2: V2 — opencode env honoring probe (interactive, no inference)

**Files:**
- Modify: `docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md` (V2 section)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: **V2 outcome** (CONFIRMED expected — profile env confines opencode's fixed paths) and the **pinned opencode default model id** (a provider-prefixed string like `anthropic/claude-opus-4.8`) used by Task 5's `defaultModel`. Side effect: the opencode profile is provisioned (auth material in place), which Tasks 9/12 reuse.

- [ ] **Step 1: Ensure no opencode daemon is running (it would invalidate the probe AND is unsafe)**

Run: `pgrep -u "$USER" -x opencode; echo "rc=$?"`
Expected: no PIDs, `rc=1`. If any PID appears: `pkill -u "$USER" -x opencode` and re-check.

- [ ] **Step 2: Create the profile skeleton and snapshot real-home mtimes**

```bash
OC_PROFILE="$HOME/.skills-test-profiles/opencode"
mkdir -p "$OC_PROFILE"/{xdg-config,xdg-data,xdg-cache,xdg-state}
stat -f '%m %N' ~/.config/opencode ~/.local/share/opencode 2>/dev/null | tee /tmp/oc-mtimes-before.txt
```

- [ ] **Step 3: Run the login flow under the full profile env**

```bash
env HOME="$OC_PROFILE" \
    XDG_CONFIG_HOME="$OC_PROFILE/xdg-config" XDG_DATA_HOME="$OC_PROFILE/xdg-data" \
    XDG_CACHE_HOME="$OC_PROFILE/xdg-cache"  XDG_STATE_HOME="$OC_PROFILE/xdg-state" \
    OPENCODE_DISABLE_AUTOUPDATE=1 \
    opencode auth login
```
Complete the interactive provider auth (this is `opencode auth` per the spec; confirm the exact subcommand with `opencode --help` if it errors, and record it — Task 9's `LOGIN_ARGS` must match).

- [ ] **Step 4: Run a non-inference read command under the same env and pin the default model**

```bash
env HOME="$OC_PROFILE" XDG_CONFIG_HOME="$OC_PROFILE/xdg-config" XDG_DATA_HOME="$OC_PROFILE/xdg-data" \
    XDG_CACHE_HOME="$OC_PROFILE/xdg-cache" XDG_STATE_HOME="$OC_PROFILE/xdg-state" \
    OPENCODE_DISABLE_AUTOUPDATE=1 \
    opencode models | head -30
```
Expected: a model list including provider-prefixed Anthropic ids. Record the exact id you will pin as opencode's `defaultModel` (pick the current Sonnet, e.g. `anthropic/claude-opus-4.8` — record whatever the list actually prints).

- [ ] **Step 5: Verify confinement**

```bash
stat -f '%m %N' ~/.config/opencode ~/.local/share/opencode 2>/dev/null | tee /tmp/oc-mtimes-after.txt
diff /tmp/oc-mtimes-before.txt /tmp/oc-mtimes-after.txt && echo "real homes untouched"
ls -la "$OC_PROFILE/xdg-data/opencode/auth.json" && echo "auth material in profile"
```
Expected: `diff` silent (mtimes unchanged) and `auth.json` present under the profile's `xdg-data`. → **CONFIRMED**.

If the real dirs changed or auth landed outside the profile → **BLOCKED**: opencode ignores the env on this version. STOP — this invalidates spec §5's capability-probe result; record everything observed in the notes, commit, and escalate to the user before continuing (the spec has no in-scope fallback; D2's alternative is dropping the leg, a user decision).

- [ ] **Step 6: Fill the V2 section of the notes file; clean up `/tmp/oc-mtimes-*.txt`**

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md
git commit -m "docs: #24 record V2 opencode env-honoring outcome and pinned model"
```

---

### Task 3: V3 — codex skill discovery probe (interactive, ~one minimal inference probe)

**Files:**
- Modify: `docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md` (V3 section)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: **V3 outcome** — `CWD` (codex discovers cwd-relative `.agents/skills`; Task 5 sets codex `discoverySubdir: '.agents/skills'`) or `PROFILE-STAGING` (Task 5 keeps a profile-staging path and Task 8 adds the stage/cleanup steps). Also records the **pinned codex default model id** (candidate: `gpt-5.6-sol`). Side effect: the codex profile is provisioned, reused by Tasks 9/12.

- [ ] **Step 1: Provision the codex profile (login flow)**

```bash
CODEX_TEST_PROFILE="$HOME/.skills-test-profiles/codex"
mkdir -p "$CODEX_TEST_PROFILE"
codex --help 2>&1 | grep -iE 'login|auth'      # confirm the subcommand; record it for Task 9
CODEX_HOME="$CODEX_TEST_PROFILE" codex login
ls -la "$CODEX_TEST_PROFILE/auth.json"          # expect: present, mode 600
```

- [ ] **Step 2: Pin the codex default model id**

Run: `codex exec --help 2>&1 | grep -iE '\-m|--model'` and check `"$CODEX_TEST_PROFILE/config.toml"` (if the login created one) for a `model` line.
Expected: `-m, --model` exists. Record the model id to pin (candidate `gpt-5.6-sol`; if config.toml names the CLI's own default, record that exact string).

- [ ] **Step 3: Build the minimal discovery-probe fixture (cwd-relative `.agents/skills`)**

```bash
PROBE=$(mktemp -d)
mkdir -p "$PROBE/.agents/skills/probe-skill"
cat > "$PROBE/.agents/skills/probe-skill/SKILL.md" <<'EOF'
---
name: probe-skill
description: Discovery-path probe. Use when asked which skills are available.
---
When asked which skills are available, reply with exactly: PROBE-SKILL-DISCOVERED
EOF
```

- [ ] **Step 4: Run the one minimal live probe (⚠ spends a small amount of inference)**

```bash
cd "$PROBE" && CODEX_HOME="$CODEX_TEST_PROFILE" codex exec --sandbox workspace-write \
  "Which skills are available to you? If one is named probe-skill, follow its instruction exactly."
```
Expected (**CWD** outcome): output contains `PROBE-SKILL-DISCOVERED` (or lists `probe-skill`).

- [ ] **Step 5: Only if Step 4 did NOT discover it — test the profile-staging fallback**

```bash
mkdir -p "$CODEX_TEST_PROFILE/skills"
cp -R "$PROBE/.agents/skills/probe-skill" "$CODEX_TEST_PROFILE/skills/probe-skill"
cd "$PROBE" && CODEX_HOME="$CODEX_TEST_PROFILE" codex exec --sandbox workspace-write \
  "Which skills are available to you? If one is named probe-skill, follow its instruction exactly."
rm -rf "$CODEX_TEST_PROFILE/skills/probe-skill"
```
Expected: `PROBE-SKILL-DISCOVERED` → **PROFILE-STAGING** outcome. If neither location is discovered, record that and escalate (codex leg cannot see skills; AC-1's codex leg is blocked — a user decision, not an implementation choice).

- [ ] **Step 6: Clean up (`rm -rf "$PROBE"`), fill the V3 section of the notes file**

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md
git commit -m "docs: #24 record V3 codex discovery-path outcome and pinned model"
```

---
### Task 4: `profiles.mjs` — the profile single source of truth (pure, TDD)

**Files:**
- Create: `tools/test-runner/profiles.mjs`
- Test: `tools/test-runner/profiles.test.mjs`

**Interfaces:**
- Consumes: V1 outcome only as confirmation (`authMaterialPath('claude-code', p)` is `<p>/.claude.json` in both V1 branches, so this task never blocks on Task 1).
- Produces (exact signatures later tasks import):
  - `profileDirFor(harnessId: string): string` — `join(homedir(), '.skills-test-profiles', harnessId)`. Works for ANY id (pure path join, no validation) — dry-run and future drivers need no registry change.
  - `profileEnvFor(harnessId: string, profileDir: string): Record<string,string>` — the per-harness env map; throws `Error("profileEnvFor: unknown harness id: <id>")` for unknown ids.
  - `authMaterialPath(harnessId: string, profileDir: string): string` — the file whose existence means "authed"; throws `Error("authMaterialPath: unknown harness id: <id>")` for unknown ids.

- [ ] **Step 1: Write the failing tests**

Create `tools/test-runner/profiles.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { profileDirFor, profileEnvFor, authMaterialPath } from './profiles.mjs';

test('profileDirFor is the fixed per-harness convention under the real home', () => {
  assert.equal(profileDirFor('codex'), join(homedir(), '.skills-test-profiles', 'codex'));
  // Pure path computation — any id works (dry-run must not require a registry hit).
  assert.equal(profileDirFor('anything'), join(homedir(), '.skills-test-profiles', 'anything'));
});

test('claude-code env relocates only the config dir and omits HOME (Keychain access)', () => {
  assert.deepEqual(profileEnvFor('claude-code', '/p/claude-code'), {
    CLAUDE_CONFIG_DIR: '/p/claude-code',
  });
});

test('codex env relocates only CODEX_HOME and omits HOME', () => {
  assert.deepEqual(profileEnvFor('codex', '/p/codex'), { CODEX_HOME: '/p/codex' });
});

test('opencode env confines HOME plus all four XDG roots and disables autoupdate', () => {
  assert.deepEqual(profileEnvFor('opencode', '/p/opencode'), {
    HOME: '/p/opencode',
    XDG_CONFIG_HOME: '/p/opencode/xdg-config',
    XDG_DATA_HOME: '/p/opencode/xdg-data',
    XDG_CACHE_HOME: '/p/opencode/xdg-cache',
    XDG_STATE_HOME: '/p/opencode/xdg-state',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
  });
});

test('authMaterialPath names the per-harness authed marker file', () => {
  assert.equal(authMaterialPath('claude-code', '/p/c'), '/p/c/.claude.json'); // pinned by V1
  assert.equal(authMaterialPath('codex', '/p/x'), '/p/x/auth.json');
  assert.equal(authMaterialPath('opencode', '/p/o'), '/p/o/xdg-data/opencode/auth.json');
});

test('unknown harness ids are loud errors, not silent guesses', () => {
  assert.throws(() => profileEnvFor('nope', '/p'), /unknown harness id: nope/);
  assert.throws(() => authMaterialPath('nope', '/p'), /unknown harness id: nope/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/test-runner/profiles.test.mjs`
Expected: FAIL — `Cannot find module .../profiles.mjs`.

- [ ] **Step 3: Write the implementation**

Create `tools/test-runner/profiles.mjs`:

```js
// Single source of truth for live-run test profiles (spec: profile-based
// isolation, D1/D7). PURE — path/env computation only, no fs access, so the
// auth helper (tools/test-auth.mjs) and the runner build the profile env
// through the SAME functions and login state lands exactly where the runner
// later looks. Profiles are persistent, pre-authenticated, per-harness config
// roots OUTSIDE the repo and outside fixtures; they hold auth + harness state
// only and are expected to mutate across runs (no integrity guard, D6).
import { homedir } from 'node:os';
import { join } from 'node:path';

// Fixed convention — deliberately no env-var override (D1, YAGNI).
export function profileDirFor(harnessId) {
  return join(homedir(), '.skills-test-profiles', harnessId);
}

// Per-harness env map (capability probes 2026-07-15, spec §5):
// - claude-code: CLAUDE_CONFIG_DIR relocates config; HOME is intentionally NOT
//   set — the OAuth token lives in the macOS Keychain and the real HOME must
//   stay visible for keychain access.
// - codex: CODEX_HOME relocates everything (config.toml, auth.json, skills/,
//   AGENTS.md); HOME intentionally not set.
// - opencode: config/data roots derive from HOME/XDG, so HOME plus ALL four
//   XDG roots are confined to the profile; OPENCODE_DISABLE_AUTOUPDATE pins
//   the binary against mid-suite version drift.
export function profileEnvFor(harnessId, profileDir) {
  switch (harnessId) {
    case 'claude-code':
      return { CLAUDE_CONFIG_DIR: profileDir };
    case 'codex':
      return { CODEX_HOME: profileDir };
    case 'opencode':
      return {
        HOME: profileDir,
        XDG_CONFIG_HOME: join(profileDir, 'xdg-config'),
        XDG_DATA_HOME: join(profileDir, 'xdg-data'),
        XDG_CACHE_HOME: join(profileDir, 'xdg-cache'),
        XDG_STATE_HOME: join(profileDir, 'xdg-state'),
        OPENCODE_DISABLE_AUTOUPDATE: '1',
      };
    default:
      throw new Error(`profileEnvFor: unknown harness id: ${harnessId}`);
  }
}

// The file whose EXISTENCE means "this profile is authenticated" (preflight
// rung 3 checks presence only — no inference is spent probing auth).
// claude-code's .claude.json pointer location was pinned by verification V1.
export function authMaterialPath(harnessId, profileDir) {
  switch (harnessId) {
    case 'claude-code':
      return join(profileDir, '.claude.json');
    case 'codex':
      return join(profileDir, 'auth.json');
    case 'opencode':
      return join(profileDir, 'xdg-data', 'opencode', 'auth.json');
    default:
      throw new Error(`authMaterialPath: unknown harness id: ${harnessId}`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/test-runner/profiles.test.mjs`
Expected: PASS — 6/6.

- [ ] **Step 5: Run the full suite to prove nothing else broke**

Run: `npm test`
Expected: PASS (existing count + 6 new).

- [ ] **Step 6: Commit**

```bash
git add tools/test-runner/profiles.mjs tools/test-runner/profiles.test.mjs
git commit -m "feat: #24 add profiles.mjs — per-harness test-profile paths, env, auth material"
```

---

### Task 5: `drivers.mjs` — widen the driver seam (pure, TDD)

**Files:**
- Rewrite: `tools/test-runner/drivers.mjs`
- Rewrite: `tools/test-runner/drivers.test.mjs`

**Interfaces:**
- Consumes: `profileEnvFor(harnessId, profileDir)` from Task 4; V2's pinned opencode model id; V3's discovery outcome.
- Produces (relied on by Tasks 6–9):
  - `DRIVERS: Array<Descriptor>` and `resolveDriver(id): Descriptor|null` (names unchanged).
  - `Descriptor = { id, command, discoverySubdir, defaultModel, probe: {args: string[]}, daemonBasename?, buildInvocation({fixtureRoot, prompt, model, profileDir}) => {command, args, env} }`.
  - `isolationEnv` is DELETED — nothing may import it afterwards.
  - Pinned defaults (adjust ONLY to what Tasks 2–3 recorded / `--help` verification in Step 1): claude-code `claude-opus-4.8`, codex `gpt-5.6-sol`, opencode `anthropic/claude-opus-4.8`.

- [ ] **Step 1: Verify the pinned model ids and flags against the installed CLIs (no inference)**

```bash
claude --help 2>&1 | grep -iA1 -- '--model'
codex exec --help 2>&1 | grep -iA1 -- '--model'
opencode run --help 2>&1 | grep -iA1 -- '--model'
```
Expected: claude accepts `--model <model>`; codex `-m/--model`; opencode `-m/--model` with provider-prefixed ids. Cross-check the three default ids below against these help texts and the models recorded in the Task 2/3 notes; if an installed CLI names a different current id, use the recorded one consistently in BOTH the implementation and the tests below.

- [ ] **Step 2: Rewrite the test file (failing first)**

Replace the full contents of `tools/test-runner/drivers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { DRIVERS, resolveDriver } from './drivers.mjs';

test('exactly the three supported harnesses are registered', () => {
  assert.deepEqual(DRIVERS.map((d) => d.id).sort(), ['claude-code', 'codex', 'opencode']);
});

test('each driver declares its discovery subdir', () => {
  assert.equal(resolveDriver('claude-code').discoverySubdir, '.claude/skills');
  assert.equal(resolveDriver('codex').discoverySubdir, '.agents/skills'); // pinned by V3
  assert.equal(resolveDriver('opencode').discoverySubdir, '.opencode/skills');
});

test('resolveDriver returns null for an unknown id', () => {
  assert.equal(resolveDriver('nope'), null);
});

test('each driver pins a default model and a driver-owned probe', () => {
  assert.equal(resolveDriver('claude-code').defaultModel, 'claude-opus-4.8');
  assert.equal(resolveDriver('codex').defaultModel, 'gpt-5.6-sol');
  assert.equal(resolveDriver('opencode').defaultModel, 'anthropic/claude-opus-4.8');
  for (const d of DRIVERS) assert.deepEqual(d.probe, { args: ['--version'] });
});

test('only opencode declares a daemon guard', () => {
  assert.equal(resolveDriver('opencode').daemonBasename, 'opencode');
  assert.equal(resolveDriver('claude-code').daemonBasename, undefined);
  assert.equal(resolveDriver('codex').daemonBasename, undefined);
});

test('claude-code invocation threads the model and uses the profile config dir', () => {
  const inv = resolveDriver('claude-code').buildInvocation({
    fixtureRoot: '/fx', prompt: 'hello', model: 'claude-opus-4.8', profileDir: '/prof/claude-code',
  });
  assert.equal(inv.command, 'claude');
  assert.deepEqual(inv.args, ['-p', 'hello', '--permission-mode', 'bypassPermissions', '--model', 'claude-opus-4.8']);
  assert.deepEqual(inv.env, { CLAUDE_CONFIG_DIR: '/prof/claude-code' });
});

test('codex invocation keeps the workspace-write sandbox and threads -m', () => {
  const inv = resolveDriver('codex').buildInvocation({
    fixtureRoot: '/fx', prompt: 'hi', model: 'gpt-5.6-sol', profileDir: '/prof/codex',
  });
  assert.equal(inv.command, 'codex');
  assert.deepEqual(inv.args, ['exec', '--sandbox', 'workspace-write', '-m', 'gpt-5.6-sol', 'hi']);
  assert.deepEqual(inv.env, { CODEX_HOME: '/prof/codex' });
});

test('opencode invocation threads the provider-prefixed model and the confining env', () => {
  const inv = resolveDriver('opencode').buildInvocation({
    fixtureRoot: '/fx', prompt: 'yo', model: 'anthropic/claude-opus-4.8', profileDir: '/prof/opencode',
  });
  assert.equal(inv.command, 'opencode');
  assert.deepEqual(inv.args, ['run', '--auto', '-m', 'anthropic/claude-opus-4.8', 'yo']);
  assert.deepEqual(inv.env, {
    HOME: '/prof/opencode',
    XDG_CONFIG_HOME: '/prof/opencode/xdg-config',
    XDG_DATA_HOME: '/prof/opencode/xdg-data',
    XDG_CACHE_HOME: '/prof/opencode/xdg-cache',
    XDG_STATE_HOME: '/prof/opencode/xdg-state',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
  });
});

// Rewritten isolation invariant (spec §10): scoped to the env map
// buildInvocation RETURNS (not the effective child env). Every path-valued
// entry points at the fixture root or that harness's profile dir; the map
// never points HOME / CLAUDE_CONFIG_DIR / CODEX_HOME / any XDG root at the
// developer's real locations; claude and codex intentionally OMIT HOME.
test('every returned env entry targets the fixture or the profile — never the real home', () => {
  for (const d of DRIVERS) {
    const profileDir = `/prof/${d.id}`;
    const { env } = d.buildInvocation({ fixtureRoot: '/fx', prompt: 'x', model: d.defaultModel, profileDir });
    for (const [k, v] of Object.entries(env)) {
      if (!v.startsWith('/')) continue; // non-path values (e.g. OPENCODE_DISABLE_AUTOUPDATE=1)
      assert.ok(v === '/fx' || v.startsWith('/fx/') || v === profileDir || v.startsWith(`${profileDir}/`),
        `${d.id}: ${k}=${v} escapes fixture/profile`);
      assert.ok(!v.startsWith(homedir()), `${d.id}: ${k}=${v} points at the real home`);
    }
    if (d.id === 'claude-code' || d.id === 'codex') {
      assert.ok(!('HOME' in env), `${d.id} must inherit the real HOME (Keychain access)`);
    }
  }
});
```

- [ ] **Step 3: Run to verify the new tests fail**

Run: `node --test tools/test-runner/drivers.test.mjs`
Expected: FAIL — `defaultModel`/`probe` undefined, old args shapes.

- [ ] **Step 4: Rewrite the implementation**

Replace the full contents of `tools/test-runner/drivers.mjs`:

```js
// Headless-CLI descriptors for the three supported test harnesses. PURE:
// buildInvocation returns the argv + extra env to spawn but never spawns, so
// the invocation shape is unit-testable without inference. The runner
// (runner.mjs) does the impure spawn; cwd is always the fixture root.
import { profileEnvFor } from './profiles.mjs';

// Each descriptor:
//   id               stable harness id
//   command          the headless CLI binary
//   discoverySubdir  where, under a fixture root, this harness discovers project skills
//   defaultModel     pinned per driver against the installed CLIs (2026-07-15);
//                    overridden per run via --harness <id>=<model>
//   probe            driver-owned availability spec: `<command> <probe.args>`
//                    must exit 0; its stdout is the provenance version string.
//                    Driver-owned so a non-CLI-shaped harness (pydantic-ai
//                    follow-up) can declare its own probe.
//   daemonBasename   set only where a resident daemon can hijack the run
//                    (preflight rung 4); opencode's `run` may attach to a
//                    pre-existing server and escape the fixture cwd/env.
//   buildInvocation({ fixtureRoot, prompt, model, profileDir }) -> { command, args, env }
//     env comes from profileEnvFor — the profile is the ONLY user-scope state a
//     live run sees; project scope stays the out-of-repo fixture cwd. Every
//     flag emitted here was verified against the installed CLI's --help
//     (no speculative flags).
export const DRIVERS = [
  {
    id: 'claude-code',
    command: 'claude',
    discoverySubdir: '.claude/skills',
    defaultModel: 'claude-opus-4.8',
    probe: { args: ['--version'] },
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: 'claude',
        // Headless `-p` cannot prompt; without a grant Write/Edit/Bash are all
        // denied. acceptEdits does NOT cover Bash, so bypassPermissions is used.
        // WARNING: bypassPermissions removes write confinement — safe ONLY
        // because the fixture lives outside the repo tree (see runCase) and
        // config writes land in the test profile, not ~/.claude.
        args: ['-p', prompt, '--permission-mode', 'bypassPermissions', '--model', model],
        env: profileEnvFor('claude-code', profileDir),
      };
    },
  },
  {
    id: 'codex',
    command: 'codex',
    discoverySubdir: '.agents/skills', // cwd-relative discovery, pinned by verification V3
    defaultModel: 'gpt-5.6-sol',
    probe: { args: ['--version'] },
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: 'codex',
        // `codex exec` defaults to a read-only sandbox that blocks writes;
        // workspace-write confines writes to cwd (OS-enforced).
        args: ['exec', '--sandbox', 'workspace-write', '-m', model, prompt],
        env: profileEnvFor('codex', profileDir),
      };
    },
  },
  {
    id: 'opencode',
    command: 'opencode',
    discoverySubdir: '.opencode/skills',
    defaultModel: 'anthropic/claude-opus-4.8', // opencode takes provider-prefixed ids
    probe: { args: ['--version'] },
    daemonBasename: 'opencode',
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: 'opencode',
        // `opencode run` does not auto-approve permissions by default; --auto
        // auto-approves permissions not explicitly denied.
        args: ['run', '--auto', '-m', model, prompt],
        env: profileEnvFor('opencode', profileDir),
      };
    },
  },
];

export function resolveDriver(id) {
  return DRIVERS.find((d) => d.id === id) || null;
}
```

**V3 = PROFILE-STAGING branch only** (skip this paragraph in the CWD branch): keep the codex descriptor exactly as above — `discoverySubdir: '.agents/skills'` stays the fixture projection location (do NOT change it to `'skills'`; the fixture layout is unchanged, only an extra copy is staged) — and add one field to the codex descriptor: `stagesIntoProfile: true` (plus a test in `drivers.test.mjs`: `assert.equal(resolveDriver('codex').stagesIntoProfile, true);`). The staging block in Task 8 Step 3 consumes that flag.

- [ ] **Step 5: Run the driver tests**

Run: `node --test tools/test-runner/drivers.test.mjs`
Expected: PASS — 9/9.

- [ ] **Step 6: Thread the new signature through both call sites (same commit — keeps `npm test` green)**

`buildInvocation` now requires `model` and `profileDir`; its two callers still pass `{fixtureRoot, prompt}` and would throw (`join(undefined, …)` in `profileEnvFor('opencode', …)`). Make these mechanical edits now — the deeper runner changes (probe, preflight, run.json) stay in Tasks 6–8.

In `tools/test-runner/runner.mjs`, change only the `runDriver` head:

```js
export function runDriver(driver, { fixtureRoot, prompt, model, profileDir, timeoutMs }) {
  const { command, args, env } = driver.buildInvocation({ fixtureRoot, prompt, model, profileDir });
```
(the rest of the function body is unchanged).

In `tools/test-runner.mjs`:

1. Add to the imports block:
```js
import { profileDirFor } from './test-runner/profiles.mjs';
```
2. Change the `runHarness` signature line to accept a model:
```js
export async function runHarness(driver, { skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun, model }) {
```
3. Immediately after `const id = driver.id;` add:
```js
  const resolvedModel = model ?? driver.defaultModel;
  const profileDir = profileDirFor(id);
```
4. Change the dry-run invocation line to:
```js
    const invocation = driver.buildInvocation({ fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir });
```
5. Change the spawn line to:
```js
  const proc = runDriver(driver, { fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir });
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS (all files green — dry-run paths now build complete invocations; the fake-driver test's `buildInvocation` simply ignores the extra fields).

- [ ] **Step 8: Commit**

```bash
git add tools/test-runner/drivers.mjs tools/test-runner/drivers.test.mjs tools/test-runner/runner.mjs tools/test-runner.mjs
git commit -m "feat: #24 widen driver seam — profile env, pinned default models, driver-owned probes"
```

---
### Task 6: `runner.mjs` — probe with version capture (impure, TDD)

**Files:**
- Modify: `tools/test-runner/runner.mjs`
- Test: `tools/test-runner/runner.test.mjs`

**Interfaces:**
- Consumes: `Descriptor.probe` (`{args: string[]}`) and `Descriptor.command` from Task 5.
- Produces: `probeHarness(driver): { ok: boolean, version: string|null }` — `version` is the probe's trimmed stdout, used as the provenance "harness version string". `isHarnessAvailable` stays alive (still used by the not-yet-rewired `runHarness`) and is deleted in Task 8.

- [ ] **Step 1: Write the failing tests (append to `tools/test-runner/runner.test.mjs`)**

```js
test('probeHarness runs the driver-owned probe and captures the version string', () => {
  const fake = { id: 'fake', command: process.execPath, probe: { args: ['--version'] } };
  const r = probeHarness(fake);
  assert.equal(r.ok, true);
  assert.match(r.version, /^v\d+\./); // node --version prints e.g. v22.1.0
});

test('probeHarness is ok:false with a null version for a missing binary', () => {
  const fake = { id: 'fake', command: 'definitely-not-a-real-binary-xyz-42', probe: { args: ['--version'] } };
  assert.deepEqual(probeHarness(fake), { ok: false, version: null });
});

test('runDriver threads model and profileDir into buildInvocation', () => {
  let seen;
  const fake = {
    buildInvocation: (a) => { seen = a; return { command: process.execPath, args: ['-e', ''], env: {} }; },
  };
  runDriver(fake, { fixtureRoot: process.cwd(), prompt: 'x', model: 'm-1', profileDir: '/prof/fake' });
  assert.equal(seen.model, 'm-1');
  assert.equal(seen.profileDir, '/prof/fake');
});
```

Also extend the import line at the top of the file to:

```js
import { isHarnessAvailable, probeHarness, runDriver } from './runner.mjs';
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tools/test-runner/runner.test.mjs`
Expected: FAIL — `probeHarness` is not exported.

- [ ] **Step 3: Implement `probeHarness` (add to `tools/test-runner/runner.mjs`, directly below `isHarnessAvailable`)**

```js
// Driver-owned availability probe: `<command> <probe.args>` must exit 0. Its
// trimmed stdout is captured as the harness VERSION STRING for provenance —
// a verdict without model+version provenance is not attributable (spec goal 3;
// motivated by an observed mid-investigation opencode auto-update).
export function probeHarness(driver) {
  try {
    const r = spawnSync(driver.command, driver.probe.args, { encoding: 'utf8' });
    if (r.status !== 0) return { ok: false, version: null };
    return { ok: true, version: (r.stdout ?? '').trim() };
  } catch {
    return { ok: false, version: null };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass, then the full suite**

Run: `node --test tools/test-runner/runner.test.mjs` → PASS.
Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/runner.mjs tools/test-runner/runner.test.mjs
git commit -m "feat: #24 add probeHarness — driver-owned probe with version capture"
```

---

### Task 7: `runner.mjs` — the preflight ladder (impure with DI, TDD)

**Files:**
- Modify: `tools/test-runner/runner.mjs`
- Test: `tools/test-runner/runner.test.mjs`

**Interfaces:**
- Consumes: `probeHarness` (Task 6), `authMaterialPath` (Task 4), `Descriptor.daemonBasename` (Task 5).
- Produces: `preflightHarness(driver, profileDir, deps?): Promise<{ skipReason: string|null, version: string|null }>` — `skipReason: null` means "all rungs passed, execute"; `version` is the probe's version string (null only when rung 1 fails). `deps` (all optional, impure defaults): `{ probe(driver), isDirectory(path): Promise<boolean>, fileExists(path): Promise<boolean>, listProcesses(): string[] }`. Task 8 wires this as `runHarness`'s default gate.

- [ ] **Step 1: Write the failing tests (append to `tools/test-runner/runner.test.mjs`)**

Note the fake drivers reuse REAL harness ids (`codex`, `opencode`) with fake commands/deps — `authMaterialPath` only accepts registered ids, and the ladder must work without any real fs/process state (spec §10: "fake drivers and fake fs/process listing").

```js
const LADDER_DEPS_ALL_GREEN = {
  probe: () => ({ ok: true, version: '9.9.9' }),
  isDirectory: async () => true,
  fileExists: async () => true,
  listProcesses: () => [],
};

test('preflight rung 1: missing binary yields the actionable install skip', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, probe: () => ({ ok: false, version: null }),
  });
  assert.deepEqual(r, {
    skipReason: 'harness binary `codex` not found — install `codex` or fix PATH',
    version: null,
  });
});

test('preflight rung 2: missing profile dir points at test:auth', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, isDirectory: async () => false,
  });
  assert.equal(r.skipReason, 'no test profile — run `npm run test:auth -- codex`');
  assert.equal(r.version, '9.9.9');
});

test('preflight rung 3: profile without auth material points at test:auth', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  let checked;
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, fileExists: async (p) => { checked = p; return false; },
  });
  assert.equal(r.skipReason, 'profile exists but is not authenticated — run `npm run test:auth -- codex`');
  assert.equal(checked, '/prof/codex/auth.json'); // the ladder checks authMaterialPath
});

test('preflight rung 4: a user-owned opencode process skips the leg', async () => {
  const d = { id: 'opencode', command: 'opencode', probe: { args: ['--version'] }, daemonBasename: 'opencode' };
  const r = await preflightHarness(d, '/prof/opencode', {
    ...LADDER_DEPS_ALL_GREEN, listProcesses: () => ['zsh', 'opencode', 'node'],
  });
  assert.equal(r.skipReason, 'kill the running opencode server first — `run` may attach to it and escape the fixture');
});

test('preflight rung 4 is skipped entirely for drivers without a daemonBasename', async () => {
  const d = { id: 'codex', command: 'codex', probe: { args: ['--version'] } };
  const r = await preflightHarness(d, '/prof/codex', {
    ...LADDER_DEPS_ALL_GREEN, listProcesses: () => ['opencode'], // running daemon is irrelevant to codex
  });
  assert.deepEqual(r, { skipReason: null, version: '9.9.9' });
});

test('preflight passes all rungs and hands back the probe version for provenance', async () => {
  const d = { id: 'opencode', command: 'opencode', probe: { args: ['--version'] }, daemonBasename: 'opencode' };
  const r = await preflightHarness(d, '/prof/opencode', LADDER_DEPS_ALL_GREEN);
  assert.deepEqual(r, { skipReason: null, version: '9.9.9' });
});
```

Extend the runner.test.mjs import line to include `preflightHarness`.

- [ ] **Step 2: Run to verify failure**

Run: `node --test tools/test-runner/runner.test.mjs`
Expected: FAIL — `preflightHarness` is not exported.

- [ ] **Step 3: Implement the ladder (add to `tools/test-runner/runner.mjs`)**

Change the module's imports to:

```js
import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { basename } from 'node:path';
import { authMaterialPath } from './profiles.mjs';
```

Append at the end of the file:

```js
// --- Preflight ladder (spec §7): problems detectable BEFORE execution map to
// an actionable skip, never a silent failure. Stops at the first failing rung.
// Auth failures that only surface DURING execution (e.g. an expired token
// behind an existing auth.json) are consciously NOT detected here — they
// execute and are judged by the oracle like any run (spec D5).

async function isDirectoryDefault(p) {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

async function fileExistsDefault(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

// Basenames of every process owned by the current user. `ps -axo user=,comm=`
// works on both macOS and Linux; comm is the executable path, so a daemon
// started via any argv[0] alias is still seen.
function listProcessesDefault() {
  const me = userInfo().username;
  const r = spawnSync('ps', ['-axo', 'user=,comm='], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cut = line.indexOf(' ');
      return [line.slice(0, cut), line.slice(cut + 1).trim()];
    })
    .filter(([user]) => user === me)
    .map(([, comm]) => basename(comm));
}

// Rungs: 1 binary → 2 profile dir → 3 auth material → 4 daemon (only for
// drivers that declare daemonBasename — a resident opencode server can serve
// `run` in ITS project context, bypassing the client's cwd/env entirely).
// `version` is threaded out so the caller records provenance even for skips.
export async function preflightHarness(driver, profileDir, deps = {}) {
  const {
    probe = probeHarness,
    isDirectory = isDirectoryDefault,
    fileExists = fileExistsDefault,
    listProcesses = listProcessesDefault,
  } = deps;

  const probed = probe(driver);
  if (!probed.ok) {
    return { skipReason: `harness binary \`${driver.command}\` not found — install \`${driver.id}\` or fix PATH`, version: null };
  }
  if (!(await isDirectory(profileDir))) {
    return { skipReason: `no test profile — run \`npm run test:auth -- ${driver.id}\``, version: probed.version };
  }
  if (!(await fileExists(authMaterialPath(driver.id, profileDir)))) {
    return { skipReason: `profile exists but is not authenticated — run \`npm run test:auth -- ${driver.id}\``, version: probed.version };
  }
  if (driver.daemonBasename && listProcesses().includes(driver.daemonBasename)) {
    return { skipReason: 'kill the running opencode server first — `run` may attach to it and escape the fixture', version: probed.version };
  }
  return { skipReason: null, version: probed.version };
}
```

- [ ] **Step 4: Run the tests to verify they pass, then the full suite**

Run: `node --test tools/test-runner/runner.test.mjs` → PASS.
Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/test-runner/runner.mjs tools/test-runner/runner.test.mjs
git commit -m "feat: #24 add the four-rung preflight ladder with actionable skip reasons"
```

---
### Task 8: Wire the run surface — preflight, `run.json`, repeatable `--harness`, provenance report

**Files:**
- Modify: `tools/test-runner.mjs`
- Modify: `tools/test-runner/runner.mjs` (delete `isHarnessAvailable`)
- Modify: `tools/test-runner/report.mjs`
- Test: `tools/test-runner.test.mjs`, `tools/test-runner/runner.test.mjs`, `tools/test-runner/report.test.mjs`

**Interfaces:**
- Consumes: `preflightHarness` (Task 7), `probeHarness` version strings (Task 6), `profileDirFor` (Task 4), widened descriptors (Task 5).
- Produces (Tasks 9/12 rely on these):
  - `parseArgs(argv)` is EXPORTED; `--harness` is repeatable, accepts `<id>[=<model>]`, duplicates throw `UsageError` (CLI exit 2). Parsed shape: `opts.harnessSelections: Array<{id: string, model: string|null}> | undefined`.
  - `runCase(skillName, opts)` accepts `harnessSelections` (replaces `harnessIds`; default = all `DRIVERS` with `model: null`).
  - `runHarness(driver, {…, model, preflight?})` — `preflight` defaults to `preflightHarness`, injectable for tests. Skipped and executed legs both write `<runsRoot>/<runId>/<id>/run.json` with the shape `{ id, status, model, harnessVersion, invocation: {command, args}, exitStatus, timedOut, skipReason }`.
  - Executed `HarnessResult`s gain `model` and `harnessVersion` fields; `formatRunReport` prints `    provenance: model <model>, harness <version>` under each executed harness and prints the full args + env for dry-run legs.

- [ ] **Step 1: Write the failing tests**

**(a) Append to `tools/test-runner.test.mjs`** (and extend its import to `import { runCase, runHarness, parseArgs } from './test-runner.mjs';` plus add `readFile` to the `node:fs/promises` import):

```js
test('parseArgs accepts repeatable --harness with optional =model', () => {
  const { opts } = parseArgs(['okf-docs-setup', '--harness', 'claude-code=claude-haiku-4-5', '--harness', 'codex']);
  assert.deepEqual(opts.harnessSelections, [
    { id: 'claude-code', model: 'claude-haiku-4-5' },
    { id: 'codex', model: null },
  ]);
});

test('parseArgs leaves harnessSelections undefined when --harness is absent (default = all)', () => {
  const { opts } = parseArgs(['okf-docs-setup']);
  assert.equal(opts.harnessSelections, undefined);
});

test('parseArgs rejects duplicate harness ids', () => {
  assert.throws(
    () => parseArgs(['x', '--harness', 'codex=m1', '--harness', 'codex=m2']),
    /duplicate --harness codex/,
  );
});

test('parseArgs rejects an empty model after =', () => {
  assert.throws(() => parseArgs(['x', '--harness', 'codex=']), /--harness <id>\[=<model>\]/);
});

test('CLI exits 2 on duplicate --harness ids', () => {
  const r = spawnSync(process.execPath, [CLI, 'okf-docs-setup', '--harness', 'codex', '--harness', 'codex'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /duplicate --harness codex/);
});

test('runHarness resolves the model, threads preflight version, and writes run.json', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = { inputs: [], prompt: 'x', assertions: [{ type: 'output-contains', value: 'HELLO' }] };
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: ['-e', 'process.stdout.write("HELLO")'], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),
    });
    assert.equal(r.status, 'executed');
    assert.equal(r.model, 'fake-model-1'); // defaultModel used when no override given
    assert.equal(r.harnessVersion, 'fake 9.9');
    const record = JSON.parse(await readFile(join(runsRoot, 't', 'fake', 'run.json'), 'utf8'));
    assert.equal(record.status, 'executed');
    assert.equal(record.model, 'fake-model-1');
    assert.equal(record.harnessVersion, 'fake 9.9');
    assert.equal(record.invocation.command, process.execPath);
    assert.equal(record.exitStatus, 0);
    assert.equal(record.timedOut, false);
    assert.equal(record.skipReason, null);
    await rm(r.fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});

test('a failing preflight yields a skipped leg whose run.json carries the reason', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const testCase = { inputs: [], prompt: 'x', assertions: [] };
    const fake = {
      id: 'fake', command: process.execPath, discoverySubdir: '.claude/skills',
      defaultModel: 'fake-model-1', probe: { args: ['--version'] },
      buildInvocation: () => ({ command: process.execPath, args: [], env: {} }),
    };
    const r = await runHarness(fake, {
      skillName: 'okf-docs-setup', skillsRoot: join(REPO_ROOT, 'skills'),
      testCase, runsRoot, runId: 't2', beforeHash: '', dryRun: false,
      preflight: async () => ({ skipReason: 'no test profile — run `npm run test:auth -- fake`', version: '9.9' }),
    });
    assert.equal(r.status, 'skipped');
    assert.equal(r.skipReason, 'no test profile — run `npm run test:auth -- fake`');
    const record = JSON.parse(await readFile(join(runsRoot, 't2', 'fake', 'run.json'), 'utf8'));
    assert.equal(record.status, 'skipped');
    assert.equal(record.skipReason, 'no test profile — run `npm run test:auth -- fake`');
    assert.equal(record.exitStatus, null);
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});
```

Also update the existing single-harness selection test in place:

```js
test('runCase --dry-run --harness selects a single harness', async () => {
  const runsRoot = await mkdtemp(join(tmpdir(), 'tr-runs-'));
  try {
    const run = await runCase('okf-docs-setup', {
      dryRun: true, runsRoot, harnessSelections: [{ id: 'claude-code', model: null }],
    });
    assert.equal(run.harnesses.length, 1);
    assert.equal(run.harnesses[0].id, 'claude-code');
    assert.equal(run.harnesses[0].model, 'claude-opus-4.8'); // = the claude-code defaultModel pinned in drivers.mjs (Task 5) — keep in sync if that pin changed
    await rm(run.harnesses[0].fixtureRoot, { recursive: true, force: true });
  } finally {
    await rm(runsRoot, { recursive: true, force: true });
  }
});
```

And update the existing fake-driver test (`runHarness runs a fake driver …`): add `defaultModel: 'fake-model-1', probe: { args: ['--version'] },` to its fake descriptor and `preflight: async () => ({ skipReason: null, version: 'fake 9.9' }),` to its options — without an injected preflight it would now skip on the missing `~/.skills-test-profiles/fake` profile (and `authMaterialPath('fake', …)` would throw).

**(b) In `tools/test-runner/runner.test.mjs`:** delete the two `isHarnessAvailable` tests and drop it from the import (replaced by the `probeHarness` tests from Task 6).

**(c) In `tools/test-runner/report.test.mjs`:** add `model: 'claude-opus-4.8', harnessVersion: '2.1.209 (Claude Code)',` to the harness objects in BOTH the `passing` and `failing` fixtures (and to the inline `timedOut`/`empty`/`mutated` executed fixtures derived from them). Change the dry fixture's invocation to `invocation: { command: 'codex', args: ['exec', 'x'], env: { CODEX_HOME: '/p/codex' } }`. Then append:

```js
test('formatRunReport prints a provenance line per executed harness', () => {
  const out = formatRunReport(passing);
  assert.match(out, /provenance: model claude-opus-4.8, harness 2\.1\.209 \(Claude Code\)/);
});

test('formatRunReport shows the dry-run args and profile env', () => {
  const dry = {
    skill: 'x', runId: '1', dryRun: true,
    harnesses: [{
      id: 'codex', status: 'dry-run', closure: ['x'], sourcesUnmodified: true, fixtureRoot: '/tmp/fx',
      invocation: { command: 'codex', args: ['exec', '-m', 'gpt-5.6-sol', 'p'.repeat(200)], env: { CODEX_HOME: '/p/codex' } },
    }],
  };
  const out = formatRunReport(dry);
  assert.match(out, /would run `codex exec -m gpt-5\.2-codex p{77}\.\.\.`/); // long args truncated
  assert.match(out, /env CODEX_HOME=\/p\/codex/);
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node --test tools/test-runner.test.mjs tools/test-runner/report.test.mjs`
Expected: FAIL — `parseArgs` not exported, `harnessSelections` ignored, no `run.json`, no provenance/env lines.

- [ ] **Step 3: Rewire `tools/test-runner.mjs`**

Change the runner import line to:

```js
import { preflightHarness, runDriver } from './test-runner/runner.mjs';
```

Replace `runHarness` in full (the Task 5 threading edits are subsumed):

```js
// One harness's full lifecycle, returning exactly one status-tagged
// HarnessResult. Extracted from runCase so a fake driver can exercise the
// executed branch in tests without inference (inject `preflight` — the real
// ladder checks profile dirs and process listings), and so the tagged union is
// built in ONE place (no producer/contract drift).
export async function runHarness(driver, {
  skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun, model,
  preflight = preflightHarness,
}) {
  const id = driver.id;
  const resolvedModel = model ?? driver.defaultModel;
  const profileDir = profileDirFor(id);
  // The harness spawn cwd MUST live OUTSIDE the repo tree: a headless CLI walks
  // up from cwd to discover project memory (CLAUDE.md/AGENTS.md) and project
  // skills, so an in-repo fixture would leak this repo's own memory + skills
  // into the skill under test. The profile env covers user scope only.
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tr-fx-'));

  const closure = await buildFixture({
    skillName, skillsRoot, driver, fixtureRoot, inputs: testCase.inputs,
  });
  const sourcesUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Built unconditionally: dry-run must record the FULL real invocation (args
  // including the model flag, plus the profile env), and run.json records
  // command+args even for skipped legs.
  const invocation = driver.buildInvocation({
    fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir,
  });

  if (dryRun) {
    return { id, status: 'dry-run', closure, invocation, model: resolvedModel, sourcesUnmodified, fixtureRoot };
  }

  const gate = await preflight(driver, profileDir);
  if (gate.skipReason) {
    await rm(fixtureRoot, { recursive: true, force: true });
    await writeRunJson(runsRoot, runId, id, {
      id, status: 'skipped', model: resolvedModel, harnessVersion: gate.version,
      invocation: { command: invocation.command, args: invocation.args },
      exitStatus: null, timedOut: false, skipReason: gate.skipReason,
    });
    return { id, status: 'skipped', skipReason: gate.skipReason, fixtureRoot };
  }

  const proc = runDriver(driver, { fixtureRoot, prompt: testCase.prompt, model: resolvedModel, profileDir });
  const assertions = await evaluateAssertions(testCase.assertions, {
    workdir: fixtureRoot, repoRoot: REPO_ROOT, output: proc.stdout,
  });
  const afterUnmodified = (await hashGuardedTrees(REPO_ROOT, GUARDED_DIRS)) === beforeHash;

  // Raw artifacts land in the git-ignored in-repo runs area, created lazily so
  // a dry run leaves no empty dirs. The fixture itself stays ephemeral in tmpdir.
  const runDir = join(runsRoot, runId, id);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'transcript.json'), proc.stdout || proc.stderr || '');
  await writeFile(join(runDir, 'assertions.json'), JSON.stringify(assertions, null, 2));
  await writeRunJson(runsRoot, runId, id, {
    id, status: 'executed', model: resolvedModel, harnessVersion: gate.version,
    invocation: { command: invocation.command, args: invocation.args },
    exitStatus: proc.status, timedOut: proc.timedOut, skipReason: null,
  });

  return {
    id, status: 'executed', assertions, sourcesUnmodified: afterUnmodified,
    exitStatus: proc.status,
    harnessError: proc.timedOut ? 'harness timed out after the configured limit' : proc.error,
    timedOut: proc.timedOut,
    model: resolvedModel, harnessVersion: gate.version,
    fixtureRoot,
  };
}
```

Add the helper directly below `runHarness`:

```js
// Structured per-leg provenance record (spec §7): run.json is written for
// executed AND skipped legs, so a verdict — or its absence — is always
// attributable to a model + harness version. transcript.json stays the raw
// output dump, unchanged in shape.
async function writeRunJson(runsRoot, runId, harnessId, record) {
  const runDir = join(runsRoot, runId, harnessId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'run.json'), JSON.stringify(record, null, 2));
}
```

In `runCase`, replace the `harnessIds` default line and the loop:

```js
    harnessSelections = DRIVERS.map((d) => ({ id: d.id, model: null })),
```

```js
  for (const { id, model } of harnessSelections) {
    const driver = resolveDriver(id);
    if (!driver) throw new UsageError(`unknown harness: ${id}`);
    harnesses.push(
      await runHarness(driver, { skillName, skillsRoot, testCase, runsRoot, runId, beforeHash, dryRun, model }),
    );
  }
```

Replace `parseArgs` in full and export it:

```js
export function parseArgs(argv) {
  const opts = { dryRun: false, harnessSelections: undefined, runsRoot: undefined };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--harness') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --harness requires a value');
      const eq = v.indexOf('=');
      const sel = eq === -1 ? { id: v, model: null } : { id: v.slice(0, eq), model: v.slice(eq + 1) };
      if (sel.id === '' || sel.model === '') throw new UsageError('usage: --harness <id>[=<model>]');
      opts.harnessSelections ??= [];
      // Duplicate ids are a usage error: one run never executes the same
      // harness twice, and the artifact layout is keyed by driver id (spec §3).
      if (opts.harnessSelections.some((s) => s.id === sel.id)) {
        throw new UsageError(`duplicate --harness ${sel.id}`);
      }
      opts.harnessSelections.push(sel);
    } else if (a === '--runs') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError('usage: --runs requires a value');
      opts.runsRoot = v;
    } else if (!a.startsWith('--')) positional.push(a);
  }
  return { opts, positional };
}
```

Update the usage string in `main()` to:

```js
    throw new UsageError('usage: node tools/test-runner.mjs <skill-name> [--harness <id>[=<model>]]... [--dry-run] [--runs <dir>]');
```

**V3 = PROFILE-STAGING branch only** (skip this block entirely in the CWD branch): the codex leg must stage the skill closure into `<profile>/skills` for the duration of the run. This deliberately lands in `runHarness` *after* the preflight gate — NOT in `buildFixture` as the spec's fallback sentence sketches — because staging before rung 2 would `mkdir` the profile dir and make "no test profile" undetectable; the spec's own ladder ordering wins. Add `cp` to the `node:fs/promises` import, then insert between the `gate` block and the `runDriver` call:

```js
  // codex (V3 fallback): CODEX_HOME points at the profile, so $CODEX_HOME/skills
  // is the discovery path — stage the projected closure there for this run only.
  // Profile mutation is accepted by design (spec D6).
  const stagedSkillsDir = driver.stagesIntoProfile ? join(profileDir, 'skills') : null;
  if (stagedSkillsDir) {
    await cp(join(fixtureRoot, driver.discoverySubdir), stagedSkillsDir, { recursive: true });
  }
```

and immediately after the `runDriver` call line:

```js
  if (stagedSkillsDir) await rm(stagedSkillsDir, { recursive: true, force: true });
```

- [ ] **Step 4: Delete `isHarnessAvailable` from `tools/test-runner/runner.mjs`**

Remove the function and its comment block (lines defining `isHarnessAvailable`). `probeHarness` + the ladder are its replacement; nothing imports it after Step 3.

- [ ] **Step 5: Update `tools/test-runner/report.mjs`**

Replace the `dry-run` and `executed` cases of the `switch`:

```js
      case 'dry-run': {
        // Show exactly what WOULD execute: full args (long values elided for
        // readability — the prompt is a whole file) plus the profile env.
        const shownArgs = h.invocation.args.map((a) => (a.length > 80 ? `${a.slice(0, 77)}...` : a));
        lines.push(`  ${h.id}: would run \`${[h.invocation.command, ...shownArgs].join(' ')}\` with ${h.closure.length} skill(s): ${h.closure.join(', ')}`);
        for (const [k, v] of Object.entries(h.invocation.env)) lines.push(`    env ${k}=${v}`);
        if (!h.sourcesUnmodified) lines.push('    ! canonical sources were modified');
        break;
      }
      case 'executed': {
        if (h.exitStatus !== 0) {
          lines.push(`    ! harness exited abnormally (status ${h.exitStatus}${h.timedOut ? ', timed out' : ''}${h.harnessError ? ': ' + h.harnessError : ''})`);
        }
        const failed = h.assertions.filter((r) => !r.pass);
        const pass = h.assertions.length > 0 && failed.length === 0 && h.sourcesUnmodified;
        lines.push(`  ${h.id}: ${pass ? 'PASS' : 'FAIL'} (${h.assertions.length - failed.length}/${h.assertions.length} assertions)`);
        lines.push(`    provenance: model ${h.model}, harness ${h.harnessVersion}`);
        if (!h.sourcesUnmodified) lines.push('    ! canonical sources were modified');
        for (const r of failed) lines.push(`    ✗ ${r.detail}`);
        break;
      }
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all files green, including every pre-existing dry-run/CLI test.

- [ ] **Step 7: Smoke the CLI dry-run by hand (no inference)**

Run: `npm run test:case -- okf-docs-setup --harness claude-code=claude-haiku-4-5 --dry-run`
Expected: exit 0; the `would run` line shows `--model claude-haiku-4-5`; an `env CLAUDE_CONFIG_DIR=…/.skills-test-profiles/claude-code` line appears.

- [ ] **Step 8: Commit**

```bash
git add tools/test-runner.mjs tools/test-runner.test.mjs tools/test-runner/runner.mjs \
        tools/test-runner/runner.test.mjs tools/test-runner/report.mjs tools/test-runner/report.test.mjs
git commit -m "feat: #24 preflight-gated runs, repeatable --harness id[=model], run.json provenance"
```

---
### Task 9: `test-auth.mjs` — the provisioning helper

**Files:**
- Create: `tools/test-auth.mjs`
- Create: `tools/test-auth.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DRIVERS`/`resolveDriver` (Task 5), `profileDirFor`/`profileEnvFor`/`authMaterialPath` (Task 4), the login subcommands recorded in the Task 1–3 notes, and the **V1 outcome** (LOGIN vs SEED) for the claude branch.
- Produces: `npm run test:auth -- <harness-id>` — exit 0 authed, 1 not authed / spawn failure, 2 usage. Task 12 (AC-1) depends on it.

- [ ] **Step 1: Write the failing CLI tests**

Create `tools/test-auth.test.mjs` (deterministic — both cases exit before any login spawn):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('./test-auth.mjs', import.meta.url));

test('test:auth without a harness id exits 2 with usage', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: npm run test:auth -- <claude-code\|codex\|opencode>/);
});

test('test:auth with an unknown harness id exits 2 with usage', () => {
  const r = spawnSync(process.execPath, [CLI, 'nope'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tools/test-auth.test.mjs`
Expected: FAIL — cannot find `tools/test-auth.mjs`.

- [ ] **Step 3: Implement the helper**

Create `tools/test-auth.mjs`:

```js
#!/usr/bin/env node
// One-time, developer-run provisioning of a harness test profile (spec goal 2):
// creates ~/.skills-test-profiles/<id>, applies the SAME env map the runner
// uses (profileEnvFor — so login state lands exactly where the runner later
// looks), attaches the harness's interactive login flow to this terminal, then
// reports authed/not-authed by checking authMaterialPath. The runner itself
// never handles credentials. IMPURE + interactive — never run by npm test/CI.
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DRIVERS, resolveDriver } from './test-runner/drivers.mjs';
import { profileDirFor, profileEnvFor, authMaterialPath } from './test-runner/profiles.mjs';

// Login entry points, confirmed against the installed CLIs (see the V1–V3
// verification notes; adjust here if a CLI update renames them).
const LOGIN_ARGS = {
  'claude-code': ['login'],
  codex: ['login'],
  opencode: ['auth', 'login'],
};

async function main() {
  const id = process.argv[2];
  const driver = id ? resolveDriver(id) : null;
  if (!driver) {
    console.error(`usage: npm run test:auth -- <${DRIVERS.map((d) => d.id).join('|')}>`);
    process.exit(2);
  }

  const profileDir = profileDirFor(id);
  const env = profileEnvFor(id, profileDir);
  await mkdir(profileDir, { recursive: true });
  for (const value of Object.values(env)) {
    // Pre-create the profile-rooted dirs the env points at (e.g. opencode's
    // XDG subdirs); non-path values like OPENCODE_DISABLE_AUTOUPDATE=1 skip.
    if (value.startsWith(profileDir)) await mkdir(value, { recursive: true });
  }

  const authPath = authMaterialPath(id, profileDir);
  if (existsSync(authPath)) {
    console.log(`${id}: already authenticated — auth material at ${authPath}`);
    process.exit(0);
  }

  const r = spawnSync(driver.command, LOGIN_ARGS[id], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.error) {
    console.error(`${id}: could not spawn \`${driver.command}\` — ${r.error.message}`);
    process.exit(1);
  }

  if (existsSync(authPath)) {
    console.log(`${id}: authenticated — auth material at ${authPath}`);
    process.exit(0);
  }
  console.error(`${id}: NOT authenticated — expected auth material at ${authPath}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

**V1 = SEED branch only** (skip in the LOGIN branch): profile-scoped `claude login` was unworkable, so for claude the helper seeds the OAuth pointer copy instead of spawning a login (goal 2's helper-provisioning contract holds; only the pointer file is copied — the developer's global memory/skills stay unexposed). Add `import { copyFile } from 'node:fs/promises';`, `import { homedir } from 'node:os';`, `import { join } from 'node:path';`, delete the `'claude-code'` entry from `LOGIN_ARGS`, and replace the `spawnSync` block with:

```js
  if (id === 'claude-code') {
    // V1 outcome: seed the OAuth pointer; the token itself stays in the Keychain.
    await copyFile(join(homedir(), '.claude.json'), authPath);
  } else {
    const r = spawnSync(driver.command, LOGIN_ARGS[id], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    if (r.error) {
      console.error(`${id}: could not spawn \`${driver.command}\` — ${r.error.message}`);
      process.exit(1);
    }
  }
```

- [ ] **Step 4: Add the npm script**

In `package.json`, insert after the `"test:case"` line:

```json
    "test:auth": "node tools/test-auth.mjs",
```

- [ ] **Step 5: Run the tests, then the full suite**

Run: `node --test tools/test-auth.test.mjs` → PASS (2/2).
Run: `npm test` → PASS.

- [ ] **Step 6: Smoke it interactively against one harness (no repo effect)**

Run: `npm run test:auth -- opencode`
Expected: `opencode: already authenticated — auth material at …/xdg-data/opencode/auth.json` (provisioned in Task 2), exit 0.

- [ ] **Step 7: Commit**

```bash
git add tools/test-auth.mjs tools/test-auth.test.mjs package.json
git commit -m "feat: #24 add npm run test:auth — per-harness profile provisioning helper"
```

---

### Task 10: pydantic-ai structural readiness proof (pure test only)

**Files:**
- Test: `tools/test-runner/runner.test.mjs`

**Interfaces:**
- Consumes: `probeHarness` (Task 6), the descriptor shape (Task 5).
- Produces: nothing new — a regression guard proving a non-CLI-shaped harness (`uv run … shim.py`, API-key env auth) fits the widened descriptor **without interface changes** (spec goal 4 / §10). The real driver is a follow-up ticket.

- [ ] **Step 1: Write the test (append to `tools/test-runner/runner.test.mjs`)**

```js
test('a non-CLI-shaped driver fits the descriptor seam unchanged (pydantic-ai readiness)', () => {
  // Stands in for a future `uv run shim.py` harness with API-key env auth:
  // custom probe, pinned defaultModel, profile-scoped env — no seam changes.
  const shim = {
    id: 'pydantic-ai',
    command: process.execPath, // stands in for `uv`
    discoverySubdir: '.agents/skills',
    defaultModel: 'anthropic:claude-opus-4.8',
    probe: { args: ['--version'] },
    buildInvocation({ fixtureRoot, prompt, model, profileDir }) {
      return {
        command: this.command,
        args: ['run', 'shim.py', '--model', model, prompt],
        env: { PYDANTIC_AI_PROFILE: profileDir, ANTHROPIC_API_KEY_FILE: `${profileDir}/api-key` },
      };
    },
  };
  const probed = probeHarness(shim);
  assert.equal(probed.ok, true);
  assert.match(probed.version, /^v\d+\./);
  const inv = shim.buildInvocation({
    fixtureRoot: '/fx', prompt: 'p', model: shim.defaultModel, profileDir: '/prof/pydantic-ai',
  });
  assert.deepEqual(inv.args, ['run', 'shim.py', '--model', 'anthropic:claude-opus-4.8', 'p']);
  for (const v of Object.values(inv.env)) assert.ok(v.startsWith('/prof/pydantic-ai'));
});
```

- [ ] **Step 2: Run the test**

Run: `node --test tools/test-runner/runner.test.mjs`
Expected: PASS immediately (it asserts existing seams — a failure means Task 5/6 drifted from the spec'd interface; fix THOSE, not this test).

- [ ] **Step 3: Run the full suite (`npm test` → PASS) and commit**

```bash
git add tools/test-runner/runner.test.mjs
git commit -m "test: #24 prove a pydantic-ai-shaped driver fits the descriptor seam unchanged"
```

---

### Task 11: Docs ceremony — ADR amendment, glossary, log

**Files:**
- Modify: `docs/decisions/skill-testing-architecture.md`
- Modify: `docs/glossary/harness.md`
- Modify: `docs/log.md`

**Interfaces:**
- Consumes: the implemented behavior (Tasks 4–9) — docs reference it, never restate implementation detail.
- Produces: the spec §12 ceremony. Rules (repo convention): NEVER rewrite existing Decision/Amendment text; bump `timestamp` in frontmatter; `docs/log.md` entries are newest-first under a `## YYYY-MM-DD` heading.

- [ ] **Step 1: Append the dated amendment to `docs/decisions/skill-testing-architecture.md`**

After the existing `## 2026-07-14 — Tracer-bullet reconciliation (#24)` entry, append:

```markdown

## 2026-07-15 — Profile-based isolation, daemon preflight, and run provenance (#24)

- **Isolation model.** Live runs now execute against persistent, pre-authenticated
  **test profiles** at `~/.skills-test-profiles/<harness-id>/`, replacing the
  fixture-scoped empty homes of the tracer bullet (which conflated isolation with
  emptiness: emptied `HOME`/XDG hid OAuth credentials, so claude/codex could not
  run at all). Project scope is unchanged — the spawn cwd stays an out-of-repo
  `os.tmpdir()` fixture and the immutability guard still hashes
  `skills/ docs/ scripts/ .claude/`. Profiles are mutable harness state by design
  and sit outside the guard. Provisioning is developer-run
  (`npm run test:auth -- <harness-id>`, OAuth/subscription flows); the runner
  never handles credentials.
- **Preflight ladder.** Problems detectable before execution (missing binary,
  missing profile, missing auth material) map to `skipped` with an actionable
  reason. The opencode leg is additionally gated by a **daemon preflight** — any
  user-owned running `opencode` process skips the leg, because a pre-existing
  server can serve `run` in its own project context and bypass the client's
  cwd/env (observed 2026-07-15: 8 committed files mutated, caught by the guard).
  Verdicts still derive solely from deterministic assertions plus source
  immutability; harness exit status stays informational.
- **Provenance.** `--harness <id>[=<model>]` pins a model per harness (pinned
  per-driver default otherwise) and every leg writes a structured `run.json`
  (harness id, resolved model, harness version from the availability probe,
  exact invocation, exit status, timeout/skip data) — a verdict without model
  and version provenance is not attributable.
- The pydantic-ai harness-set extension remains deferred to its follow-up
  ticket's amendment. Design record:
  `docs/superpowers/specs/2026-07-15-test-runner-profile-isolation-design.md`.
  Driven by #24.
```

Then change the frontmatter `timestamp: 2026-07-14` to `timestamp: 2026-07-15`.

- [ ] **Step 2: Extend `docs/glossary/harness.md`**

Insert after the "A **harness profile** is …" paragraph:

```markdown
The gating test runner applies the same concept as a **test profile**: a persistent,
pre-authenticated harness profile at `~/.skills-test-profiles/<harness-id>/`, provisioned
once via `npm run test:auth -- <harness-id>` and used as the only user-scope state a live
skill-test run sees — never the developer's personal profiles above. See
[Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md).
```

Then change its frontmatter `timestamp: 2026-07-10` to `timestamp: 2026-07-15`.

- [ ] **Step 3: Add the newest-first `docs/log.md` entry**

Insert at the top of the file, directly under the `# Bundle change log` heading:

```markdown

## 2026-07-15

- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  live-run isolation moved to persistent pre-authenticated test profiles under
  `~/.skills-test-profiles/`, added the opencode daemon preflight and the
  four-rung actionable-skip ladder, and added per-run model/harness-version
  provenance (`run.json`, `--harness <id>[=<model>]`).
- **Update** — [Harness](/glossary/harness.md) gains the *test profile* usage of
  harness profile.
```

- [ ] **Step 4: Validate**

Run: `npm run docs:validate`
Expected: exit 0 (advisory output OK, no parse errors).
Run: `npm test` → PASS (docs changes touch no code).

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/skill-testing-architecture.md docs/glossary/harness.md docs/log.md
git commit -m "docs: #24 amend skill-testing ADR for profile isolation; glossary test-profile term"
```

---

### Task 12: Live acceptance verification (AC-1…AC-4) + evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md` (AC evidence sections)

**Interfaces:**
- Consumes: everything. **⚠ AC-1/AC-2 spend real inference** (three-harness live runs of the 16-assertion case). AC-3 spends none (all skips fire before execution).
- Produces: the done-bar evidence (spec D4: all three harnesses live green from pre-authed profiles).

- [ ] **Step 1: AC-3 — preflight rungs 2–4 fire live (no inference)**

Rung 2 (profile missing):
```bash
mv ~/.skills-test-profiles/claude-code ~/.skills-test-profiles/claude-code.bak
npm run test:case -- okf-docs-setup --harness claude-code; echo "exit=$?"
mv ~/.skills-test-profiles/claude-code.bak ~/.skills-test-profiles/claude-code
```
Expected output: `claude-code: SKIPPED (no test profile — run \`npm run test:auth -- claude-code\`)`; `exit=1` (nothing executed).

Rung 3 (auth material missing):
```bash
mv ~/.skills-test-profiles/codex/auth.json ~/.skills-test-profiles/codex/auth.json.bak
npm run test:case -- okf-docs-setup --harness codex; echo "exit=$?"
mv ~/.skills-test-profiles/codex/auth.json.bak ~/.skills-test-profiles/codex/auth.json
```
Expected: `codex: SKIPPED (profile exists but is not authenticated — run \`npm run test:auth -- codex\`)`; `exit=1`.

Rung 4 (daemon guard — a dummy user-owned process whose executable basename is `opencode`):
```bash
D=$(mktemp -d); cp "$(command -v sleep)" "$D/opencode"; "$D/opencode" 300 &
npm run test:case -- okf-docs-setup --harness opencode; echo "exit=$?"
pkill -u "$USER" -f "$D/opencode"; rm -rf "$D"   # pkill, not `kill %1` — works even without job control
```
Expected: `opencode: SKIPPED (kill the running opencode server first — \`run\` may attach to it and escape the fixture)`; `exit=1`.

Paste all three outputs into the notes file's AC-3 section. (Rung 1, missing binary, is unit-covered by Task 7 only — per AC-3.)

- [ ] **Step 2: AC-1 — re-provision via the helper, then all three live green (⚠ inference)**

To prove the helper's own provisioning contract end-to-end, re-provision from scratch:
```bash
rm -rf ~/.skills-test-profiles
npm run test:auth -- claude-code   # complete the flow; expect "authenticated" + exit 0
npm run test:auth -- codex
npm run test:auth -- opencode
pgrep -u "$USER" -x opencode; echo "rc=$?"   # MUST print rc=1 (no daemon) before the run
npm run test:case -- okf-docs-setup; echo "exit=$?"
```
Expected: report shows all three harnesses `PASS (16/16 assertions)`, each with a `provenance: model …, harness …` line, no `! canonical sources were modified`, and `exit=0`. Verify the repo is untouched: `git status --short` → empty. Paste the report into AC-1.

If any leg FAILs: this is a genuine finding, not a step to retry into submission — capture the report + `tools/runs/<runId>/<id>/run.json` + transcript, and debug per its failure class (assertion content vs abnormal exit; spec §7 taxonomy). A codex discovery miss here means the V3 outcome was mis-wired (recheck Task 5 `discoverySubdir` / staging block).

- [ ] **Step 3: AC-2 — non-default model pinning visible in run.json (⚠ inference)**

```bash
npm run test:case -- okf-docs-setup --harness claude-code=claude-haiku-4-5; echo "exit=$?"
RUN=$(ls -t tools/runs | head -1)
cat "tools/runs/$RUN/claude-code/run.json"
```
(`claude-haiku-4-5` must differ from the pinned default `claude-opus-4.8`; if the installed CLI rejects that id, pick any non-default id it accepts — check `claude --help` model examples — and use it consistently here.)
Expected: PASS 16/16, exit 0; `run.json` shows `"model": "claude-haiku-4-5"`, the `--model claude-haiku-4-5` args entry, a non-empty `"harnessVersion"`, and `"skipReason": null`. Paste both the report line and the `run.json` into AC-2.

- [ ] **Step 4: AC-4 — the deterministic gate**

```bash
npm run lint:skills:strict; echo "lint=$?"
npm run docs:validate; echo "docs=$?"
npm test; echo "test=$?"
```
Expected: all three print `…=0`. Record the three exit codes in AC-4.

- [ ] **Step 5: Commit the evidence**

```bash
git add docs/superpowers/plans/2026-07-15-profile-isolation-verification-notes.md
git commit -m "docs: #24 record AC-1..AC-4 live verification evidence for profile isolation"
```

- [ ] **Step 6: Finish the branch**

All ACs green ⇒ the feature is done. Use the superpowers:finishing-a-development-branch skill (or your harness's equivalent) to decide merge/PR handling — do not merge unilaterally.
