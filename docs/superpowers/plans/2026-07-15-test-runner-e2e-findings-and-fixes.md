# Test-Runner End-to-End Verification — Findings & Proposed Fixes (#24)

> **Status: hand-off for a fresh brainstorming session.** The deterministic build of the
> test runner is COMPLETE and green. The live end-to-end (inference-spending) leg surfaced
> one real defect and one design/auth issue. **No fixes have been applied** — they are
> documented here so the wiring/isolation model can be re-thought from scratch.
>
> - Branch: `feat/24-test-runner` (10 commits, atop `feat/docs`).
> - Companion doc: `2026-07-15-orchestrator-run-analytics.md` (how this run was orchestrated).
> - Source plan: `2026-07-13-test-runner-tracer-bullet.md`.
> - Date: 2026-07-15.

---

## 1. TL;DR

| Layer | Result |
|---|---|
| **Deterministic build (Tasks 1–10)** | ✅ Complete. `npm test` → **132/132 pass**; `lint:skills:strict` + `docs:validate` + `npm test` all exit 0. 10 commits. |
| **Live e2e (AC #1/#2 proof)** | ❌ Blocked. All three harnesses FAILed for two *different* reasons (below). The build itself is not implicated — the runner's guard and oracle behaved correctly. |
| **Fixes** | Proposed + user-decided (§6) but **not implemented** — deferred to a fresh session to reconsider the isolation model holistically. |

The two problems are independent:
1. **opencode escaped its fixture and mutated the real repo** (a genuine correctness + safety defect). The immutability guard *caught* it and gated FAIL; the files were reverted.
2. **claude & codex auth-failed under the runner's isolation** (they wrote nothing) — an environment/design issue, not a code defect.

---

## 2. What was built (recap, for context)

Ten commits on `feat/24-test-runner`, TDD, all deterministic components unit-tested:

| Commit | Task | Deliverable |
|---|---|---|
| `e1fadbe` | 1 | `tools/test-runner/drivers.mjs` — three harness descriptors, pure `buildInvocation`. |
| `2ba9fd3` | 2 | `tools/test-runner/fixture.mjs` — `buildFixture`, `hashTree`, `hashGuardedTrees`. |
| `7775d99` | 3 | `tools/test-runner/oracle.mjs` — `evaluateAssertions`, `allPassed`. |
| `727891c` | 4 | `tools/test-runner/case-loader.mjs` — `loadCase`. |
| `04bbd67` | 5 | `tools/tests/okf-docs-setup/{case.mjs,prompt.md}` — first central case (16 assertions). |
| `600ae75` | 6 | `tools/test-runner/runner.mjs` — `isHarnessAvailable`, `runDriver` (inference boundary). |
| `12dc838` | 7 | `tools/test-runner/report.mjs` — `formatRunReport`, `exitCodeFor` (gating). |
| `570e12c` | 8 | `tools/test-runner.mjs` — CLI + `runCase`/`runHarness`; `.gitignore`; `test:case` script. |
| `780bd81` | 9 | `tools/lint-skills.mjs` — advisory `lintTestCases` WARN. |
| `d5f14df` | 10 | `docs/decisions/skill-testing-architecture.md` amendment + `docs/log.md`. |

All of this is sound and CI-safe. **Nothing below asks you to change it** except the harness
`buildInvocation`s and the impure `runHarness` gating (§6).

---

## 3. Final-verification results

### Phase A — deterministic gate (✅ PASS, no inference)
- `npm run lint:skills:strict && npm run docs:validate && npm test` — all three succeeded.
- `npm test`: **132 tests, 132 pass, 0 fail** across `scripts/*`, `tools/*`, `tools/test-runner/*`.
- No test material leaked into `skills/` (`git status --short skills/` empty; no stray `case.mjs`/`prompt.md`).
- Only advisory lint WARN: `okf-docs-setup/SKILL.md` body 202 lines (> 200 soft limit) — pre-existing, unrelated.

### Phase B — live e2e (❌ FAIL, spent inference)
Command: `npm run test:case -- okf-docs-setup` (all three CLIs installed: `claude` 2.1.209, `codex` 0.139.0, `opencode` 1.17.20). Overall **exit 1**.

| Harness | Result | Reason |
|---|---|---|
| `claude-code` | FAIL 0/16, `! harness exited abnormally (status 1)`, no model output | Auth failure (§5) |
| `codex` | FAIL 0/16, `! harness exited abnormally (status 1)` | Auth failure (§5) |
| `opencode` | FAIL 0/16, **`! canonical sources were modified`** | Fixture escape (§4) |

**Gating proof (B3):** breaking one assertion (`docs/index.md` → `docs/nope.md`) produced the
expected `✗ missing docs/nope.md` line and **exit 1** (edit reverted). The clean/authoritative
gating proof, however, is the deterministic test `exitCodeFor is 1 when any executed assertion
fails` (green in Phase A), since claude also auth-failed during B3.

---

## 4. Issue #1 — opencode fixture escape (the real defect)

### Symptom
The `opencode run` leg applied `okf-docs-setup` to the **live repo checkout**, not its
`os.tmpdir()` fixture, modifying 8 committed files:
`.claude/rules/docs-maintenance.md`, `docs/conventions/documentation.md`, `docs/conventions/index.md`,
`docs/glossary/index.md`, `docs/index.md`, `docs/log.md`, `docs/references/index.md`,
`docs/references/okf.md`. (`docs/index.md` heading became "FixtureProj knowledge bundle";
`docs/log.md` lost ~125 lines of real history.)

**The safety net worked:** `hashGuardedTrees` detected the mutation → `! canonical sources were
modified` → run gated FAIL (exit 1). All 8 files were then reverted (`git checkout --`) and the
tree independently verified byte-identical to HEAD. A stray `opencode --auto` daemon (PID 27248)
left running was killed.

### Root cause (confirmed by read-only investigation)
opencode is a **client/server** application:
- A pre-existing `opencode --auto` daemon — started earlier in the **real repo** — was serving
  the request in the real repo's project context. The `opencode run` client the runner spawned
  (with `cwd` = fixture and XDG overrides) connected to / was served by that daemon, so the
  client-side `cwd` and env were **bypassed**; the daemon (real `HOME`, project = the real repo)
  performed the writes.
- **opencode ignores `XDG_DATA_HOME`/`XDG_CONFIG_HOME`.** It uses fixed paths: config at
  `~/.config/opencode`, data at `~/.local/share/opencode` (`opencode.db` ~22 MB, `auth.json`,
  `repos/`, `storage/project/`). `OPENCODE_CONFIG_DIR` relocates **config only** — there is **no
  documented env var to relocate the data dir**.
- Corroboration: `~/.local/share/opencode/opencode.db` had a fresh mtime in the *real* home
  despite the fixture XDG override.

### Consequence
opencode **cannot be guaranteed** confined to a fixture by env/flags alone. The runner's
XDG-based `isolationEnv` never actually isolated opencode (it ignores XDG). The repo's own
reference already warned this: `docs/references/agent-skill-testing-landscape.md:122`
("Tests must isolate HOME, all XDG roots, **OpenCode configuration**, project files, plugins,
and credentials") and `:124` ("OpenCode permissions are policy gates, not an operating-system
sandbox, so write-enabled tests still need a disposable workspace or container").

---

## 5. Issue #2 — claude & codex auth failure under isolation

### Symptom
Both exited 1 with no model output and 0 files written → every filesystem assertion FAILed
(0/16), indistinguishable at the assertion level from a skill failure but flagged via
`! harness exited abnormally`.

### Root cause
The driver's `isolationEnv` empties `HOME` + all XDG roots, and adds
`CLAUDE_CONFIG_DIR=<fixture>/.claude-config` / `CODEX_HOME=<fixture>/.codex`. This hides the
credentials both CLIs need:
- **claude subscription:** the `oauthAccount` pointer lives in `~/.claude.json` (under `$HOME`);
  the token is in the **macOS Keychain**. (`~/.claude/.credentials.json` does not exist here.)
  With `HOME`/`CLAUDE_CONFIG_DIR` pointed at empty fixture dirs, claude can't see the
  `oauthAccount` pointer, so it reports logged-out and never consults the Keychain.
  (`claude --help`: in `--bare` mode "OAuth and keychain are never read"; normal mode *does*
  read them.)
- **codex:** same class of failure — the emptied `HOME`/`CODEX_HOME` hides its credential source.

### Key asymmetry (drives the fix in §6)
- **claude & codex are cwd-safe.** claude honors `cwd`; codex honors `cwd` **and** its
  `--sandbox workspace-write` grant physically confines writes to `cwd` (the tmpdir fixture).
  → They can safely inherit host auth; the tmpdir fixture + guard still confine/verify writes.
- **opencode is not** (see §4). → It must be gated, not merely re-authed.

---

## 6. Proposed fixes (USER-DECIDED, not yet implemented)

These reflect decisions taken this session. Treat them as the current best plan, **revisitable
in the fresh brainstorm** (§7).

### 6a. claude-code — inherit host auth  *(DECIDED: "inherit host, simplest")*
`tools/test-runner/drivers.mjs`:
```js
buildInvocation({ fixtureRoot, prompt }) {
  return {
    command: 'claude',
    args: ['-p', prompt, '--permission-mode', 'bypassPermissions'],
    env: {},                       // was: { ...isolationEnv(fixtureRoot), CLAUDE_CONFIG_DIR: ... }
  };
}
```
`runDriver` spawns with `env: { ...process.env, ...env }`, so `{}` lets the real
`HOME`/`~/.claude`/`~/.claude.json`/Keychain resolve → subscription auth. Writes confined by
`cwd` = tmpdir + `bypassPermissions` + the immutability guard.

### 6b. codex — inherit host auth, keep the sandbox grant  *(DECIDED: "fix codex too")*
```js
buildInvocation({ fixtureRoot, prompt }) {
  return {
    command: 'codex',
    args: ['exec', '--sandbox', 'workspace-write', prompt],
    env: {},                       // was: { ...isolationEnv(fixtureRoot), CODEX_HOME: ... }
  };
}
```
`workspace-write` keeps writes confined to `cwd` (the fixture) regardless of host auth. Only
*helps* if codex/ChatGPT auth is configured locally, else it fails gracefully — but the code
becomes correct.

### 6c. opencode — gate + preflight + defense-in-depth  *(DECIDED: "gate + preflight + defense-in-depth")*
Pure part (`drivers.mjs`):
```js
args: ['run', '--auto', '--dir', fixtureRoot, prompt],
env: { ...isolationEnv(fixtureRoot), OPENCODE_CONFIG_DIR: join(fixtureRoot, '.config-opencode') },
```
- `--dir <fixtureRoot>` pins the working/project dir (belt-and-suspenders over spawn cwd).
- `OPENCODE_CONFIG_DIR` relocates config into the fixture (data dir still not relocatable).

Impure part — the *real* safety — in `runHarness`/`runCase` (`tools/test-runner.mjs`):
1. **Opt-in gate:** only run the opencode harness when `TEST_RUNNER_ENABLE_OPENCODE=1` is set;
   otherwise SKIP it with a clear reason.
2. **Daemon preflight:** before spawning opencode, scan `ps` for any running `opencode` process;
   if found, **abort** with a message ("kill the running opencode server first — `run` may
   attach to it and escape the fixture").

### 6d. Test changes (`tools/test-runner/drivers.test.mjs`)
- **claude test** — invert: `assert.deepEqual(inv.env, {})` (no `CLAUDE_CONFIG_DIR`/`HOME`).
- **codex test** — invert: `assert.deepEqual(inv.env, {})` (no `HOME`/`CODEX_HOME`); args unchanged.
- **opencode test** — `args: ['run','--auto','--dir','/fx','yo']`; `env.HOME === '/fx/.home'`;
  `env.OPENCODE_CONFIG_DIR === '/fx/.config-opencode'`.
- **"every driver env value is scoped to the fixture root" invariant** — MUST be relaxed to
  cover **only opencode** now (claude *and* codex intentionally return `env: {}`). Add explicit
  exception tests asserting claude/codex return no overrides. Consider unit-testing the
  opencode opt-in/skip logic with a fake driver; the `ps` preflight is impure.

---

## 7. Open questions for the fresh brainstorm (the important part)

The fixes above make AC #1 provable and the default path safe, but they expose a deeper design
question the tracer bullet punted on. **Re-decide these before wiring further cases:**

1. **The isolation model has collapsed.** After 6a–6c, `isolationEnv` is used by **only
   opencode** — the one harness we *can't* isolate. claude/codex now inherit the host. So the
   original "isolate every harness's HOME/XDG/config" design no longer holds. Decide the real
   model: host-inherit-with-cwd-confinement (pragmatic) vs. true per-harness isolation.
2. **Clean auth without contamination.** The inherit-host fix means the run sees your global
   `~/.claude/CLAUDE.md` (SOLID/DRY memory) and `~/.claude/skills` — mild contamination, and
   `bypassPermissions` gives a *theoretical* write path into `~/.claude` (outside the repo
   guard). A cleaner option (deferred per YAGNI): seed a fixture `HOME` with a **copy of just
   `~/.claude.json`** (the OAuth pointer) so subscription auth works *without* exposing your
   skills/memory. Worth it? Same idea could apply to codex.
3. **Does opencode belong in the default harness set at all?** Given it can't be confined by
   env/flags, options: (a) gate it (current decision), (b) drop it until it can run in a
   container/VM/disposable clone, (c) only ever run it against a throwaway `git init` scratch
   dir. `docs/references/agent-skill-testing-landscape.md:124` argues write-enabled opencode
   tests "need a disposable workspace or container."
4. **Codex discovery path is still unverified.** The plan flagged `.codex/skills` vs the
   reference's `.agents/skills/<name>/SKILL.md` (`agent-skill-testing-landscape.md:126-131`).
   Confirm what codex 0.139.0 actually reads before trusting a codex verdict.
5. **AC framing.** AC #2 ("each harness in its own fixture") is *structurally* proven by the
   deterministic dry-run test (3 out-of-repo fixtures). A live all-three green is blocked by
   codex auth availability + opencode gating — decide whether that matters for "done" or whether
   AC #1 (one harness, gating) + the structural AC #2 proof suffices for the tracer bullet.
6. **Auth story for a "local-only, CI-never" runner.** Document the expected local auth
   preconditions (subscription vs API key per harness) so a FAIL is never mistaken for a skill
   regression. Consider reclassifying a clean auth failure as SKIPPED (needs trusting the exit
   `status`, deferred in the plan).

---

## 8. Concrete state / references

- **Working tree:** clean; on `feat/24-test-runner`; no stashes; the 8 mutated files reverted
  to HEAD; stray opencode daemon killed.
- **Files the fix touches:** `tools/test-runner/drivers.mjs`, `tools/test-runner/drivers.test.mjs`,
  `tools/test-runner.mjs` (the impure `runHarness`/`runCase` gate + preflight).
- **Do NOT touch to fix this:** the six modules' internal logic, the oracle, the report/exit
  code, the case, the linter, the ADR — all verified correct.
- **Environment facts discovered:**
  - CLIs: `claude` 2.1.209, `codex` 0.139.0, `opencode` 1.17.20.
  - claude creds: `~/.claude.json` (has `oauthAccount`, `userID`) + macOS Keychain token; no
    `~/.claude/.credentials.json`. `CLAUDE_CONFIG_DIR` relocates the config dir (default `~/.claude`).
  - opencode: config `~/.config/opencode`, data `~/.local/share/opencode` (fixed; ignores XDG).
    `opencode run` flags of interest: `--dir`, `--attach <url>`, `--port`, `--format json`,
    `--print-logs`, `--pure`. Env: `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR` (config only).
  - Reference: `docs/references/agent-skill-testing-landscape.md` lines ~122, 124, 126–131.
- **Reproduce (⚠ spends inference; ⚠ do NOT run the opencode leg without the §6c gate — it can
  mutate the working tree):**
  - Safe once 6a lands: `npm run test:case -- okf-docs-setup --harness claude-code` → expect
    `PASS (16/16)`, exit 0.
  - The old all-three run (`npm run test:case -- okf-docs-setup`) is the one that caused the
    escape; only re-run after 6c is implemented.
