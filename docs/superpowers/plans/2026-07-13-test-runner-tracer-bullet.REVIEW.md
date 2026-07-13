# Review — Test-Runner Tracer Bullet Plan (issue #24)

> Adversarial multi-agent review of `2026-07-13-test-runner-tracer-bullet.md`.
> Method: 6 review dimensions fanned out in parallel → **every** finding
> independently verified against the real repo (misreadings refuted, severities
> re-graded) → synthesis. 20 findings raised, **16 confirmed, 4 refuted**.
> (Reviewers: 28 agents, ~1.18M tokens. The completeness-critic pass errored on an
> API disconnect *after* synthesis completed — worth re-running, see end.)

## Verdict: **REVISE FIRST**

The plan is well-structured, TDD-first, and its core instinct — *deterministic
assertions are the only pass/fail oracle, gating exits nonzero* — is right and is
faithfully implemented (`exitCodeFor` derives the code only from assertion results +
source immutability; no advisory signal can leak into it). The decomposition is clean:
seven small single-responsibility modules that genuinely reuse `skill-graph.mjs` and
`discovery.mjs` with no reimplemented logic, and every load-bearing claim about existing
code checks out.

**But two load-bearing defects must be settled before implementing:** (1) the "isolated,
disposable fixture" is not isolated (below), and (2) — surfaced by the second-pass
completeness critic — the headless agent is almost certainly **not permitted to write
files** at all, which would make *every* run fail regardless of skill correctness (see
[Completeness gaps](#completeness-gaps-second-pass-critic)). Everything else is hardening
and polish that can fold into the same revision.

---

## The dominant issue: the sandbox is not a sandbox

Two separately-raised findings (sandboxed-harnesses **HIGH**, determinism-oracle
**MEDIUM**) are the *same* root defect seen from two angles, plus a credential problem
that is its mirror image. Fix them together.

### 🔴 HIGH — Fixtures run *inside* the repo tree; the repo's own memory + skills leak into the agent under test
- **Where:** Task 8 `runsRoot = join(REPO_ROOT, 'tools/runs')` (~L1228, L1242–1243); Task 6 `runDriver` spawns with `cwd = fixtureRoot` (~L934).
- **Why it breaks:** the fixture lives at `<repo>/tools/runs/<runId>/<harness>/fixture`. Claude Code and Codex discover project memory by walking **up** the directory tree from `cwd` — that walk reaches the repo root's `CLAUDE.md` → `AGENTS.md`, which literally tells the model *"Repo knowledge lives in an OKF v0.1 bundle at `docs/`…"* — biasing the very `okf-docs-setup` case under test — and the repo's own `.claude/skills` (`docs-add`, `docs-validate`) sit on that same ancestor chain. The env isolation the plan *does* apply (`CLAUDE_CONFIG_DIR`/`HOME`/`CODEX_HOME`) only redirects **user-level** config; it does nothing about the `cwd`-upward project walk. Git-ignoring `tools/runs/` is irrelevant to filesystem discovery.
- **Consequence:** both a PASS and a FAIL of the end-to-end run are untrustworthy and non-reproducible across machines/checkouts — which defeats the tracer bullet's entire reason for existing (AC #1/#2). The deterministic `npm test` suite and CI are unaffected (dry-run never spawns), so the defect is invisible until the real Step-10 run.
- **Fix (priority 1):** build fixtures **outside** the repo — `mkdtemp(join(tmpdir(), 'tr-fx-'))` — keeping only committed run summaries under `tools/`. Add a test asserting the repo's own `docs-add`/`docs-validate` skills and any ancestor `CLAUDE.md`/`AGENTS.md` are **not** visible to the harness.

### 🟠 MEDIUM — Isolating config/HOME to empty dirs strips each harness's credentials → auth failure scored as a gating FAIL
- **Where:** Task 1 driver env (claude-code ~L175, codex ~L189, opencode ~L201); Task 6 `isHarnessAvailable` (~L922); Task 8 skip branch (~L1257).
- **Why it breaks:** the same overrides point config/`HOME` at empty fixture dirs the builder never populates, so a file-authenticated (subscription/OAuth) local CLI can't authenticate in headless mode. `isHarnessAvailable` only probes `--version`, so an installed-but-unauthenticated harness is **not** skipped — its empty output fails every `file-exists`/`file-equals` assertion and `exitCodeFor` returns 1. There is no "installed but unauthenticated" state distinct from FAIL.
- **Nuance from verification (why MEDIUM, not blocker):** `runDriver` merges `{...process.env, ...env}`, so `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` passthrough *survives* — env-key devs are fine. On macOS (this repo's dev host) Claude Code reads OAuth creds from the Keychain, not `CLAUDE_CONFIG_DIR`, so the AC-#1 minimum (`--harness claude-code`) likely works there. Failures are self-diagnosing auth errors on a local-only path, never CI.
- **Fix (priority 2):** seed real credentials into the isolated dir (or rely on API-key passthrough) **and** classify auth/onboarding failure — nonzero status with no skill-attributable assertions — as **SKIPPED**, not FAIL. At minimum, document in Task 8 Step 10 that OAuth-authed CLIs need `ANTHROPIC_API_KEY` exported.

### 🟢 LOW — Three ad-hoc isolation strategies (config-dir only / HOME+CODEX_HOME / HOME only)
Per-harness env selection leaves claude-code's real `$HOME` live while codex's is empty, so the "same case across three harnesses" comparison (AC #2) isn't apples-to-apples. **Fix (priority 3):** one isolation contract for all three (fresh `HOME` + relevant `XDG_*`/config vars under `fixtureRoot`, creds seeded), asserted by a test that no host-scoped path resolves outside `fixtureRoot`.

### 🟢 LOW — claude-code `CLAUDE_CONFIG_DIR` → empty dir can hide local creds (app-logic-fit view of the above)
Same mechanism as the MEDIUM, isolated to the claude-code leg. Note: the override does have a legitimate purpose (without it, the dev's global `~/.claude/skills` would pollute the run) — so don't just delete it; seed creds or document the `ANTHROPIC_API_KEY` precondition.

---

## Oracle / gating robustness — the gate is blind outside assertion content

The gate fails-**closed** on assertion content (good), but is blind elsewhere:

### 🟠 MEDIUM — `runDriver` `spawnSync` has no timeout → a hung headless CLI hangs the whole runner forever
- **Where:** Task 6 `runDriver` (L933–942).
- A stalled `claude -p` (expired token waiting on a prompt, slow model) blocks with no upper bound — the runner never returns, writes no artifacts, prints nothing; only Ctrl-C escapes. Separately, `r.error` is never inspected, so a `maxBuffer` overflow (`status: null`) is silently mislabeled. Local-only, one-keystroke recoverable → MEDIUM not HIGH.
- **Fix (priority 4):** add a finite `timeout` (e.g. 300000ms, opt/env-overridable) + `killSignal: 'SIGKILL'`, capture `r.error`, and surface timeout/error as an explicit harness-level failure so the run fails closed with a diagnostic.

### 🟢 LOW — Harness exit status is discarded → infra breakage masquerades as a content FAIL
`runDriver` returns `{status, stdout, stderr}` but `runCase` reads only `stdout`; `status` never reaches the report. A broken harness looks identical to a skill that ran and failed. **Fix (priority 5):** record `status`/error on the executed result and print an explicit "harness exited abnormally" line.

### 🟢 LOW — An executed harness with **zero assertions** scores PASS (exit 0)
`[].every(...)` is vacuously true; `loadCase` defaults `assertions` to `[]`. The only "cannot gate" guard is all-skipped. Harmless today (okf case ships 15 assertions) but a latent hole as the runner generalizes. **Fix (priority 6):** require `h.assertions.length > 0` in the pass condition (or refuse an assertion-less case).

### 🟢 LOW — `main()` has no error handler
Only the missing-positional path reaches the clean `exit(2)`; `--harness` with no value → `[undefined]` → `unknown harness: undefined` thrown → unhandled rejection, stack trace, exit 1 (not the documented usage exit 2). Same for `--runs` with no value and a missing case dir. **Fix (priority 7):** wrap `main()` in `.catch(err => { console.error(err.message); process.exit(2) })` and bounds-check flag values in `parseArgs`.

---

## Determinism of the case

### 🟢 LOW — Prompt neutralizes Phases 0 & 2 but not Phase 3 (self-validate) or Phase 4 (wire `CLAUDE.md`/`AGENTS.md`); "collapses to Phase 1" is inaccurate
`okf-docs-setup` SKILL.md Phase 3 runs the validator and invites fixing "cheap warnings"; Phase 4 creates memory files. The prompt (L766–779) silences only asking + fan-out, and no assertion pins the tail. The deterministic *oracle* is intact (assertion-based tests tolerate path variance by design), and the concrete "agent edits `docs/index.md`" scenario is near-nil for a no-subsystem fixture — hence LOW. **Fix (priority 8):** extend `prompt.md` to bound the tail ("Phase 3: confirm zero hard ERRORS only, don't chase warnings or edit installed files; skip Phase 4") and correct the Task 5 design-note wording.

---

## Code quality (thermo-nuclear + SOLID/DRY/KISS/YAGNI)

Decomposition is genuinely good; these are all LOW maintainability nits, best folded into **one** cleanup (priority 9):

- **Untagged 3-shape `HarnessResult` union** — correctness depends on the *absence* of fields (the `executed` branch is reached only because it omits `dryRun`); dry-run state is stored twice (`run.dryRun` **and** per-harness `h.dryRun`). Add an explicit `status: 'skipped' | 'dry-run' | 'executed'` tag and switch on it; drop the redundant per-harness flag.
- **`runCase` inlines the whole per-harness lifecycle** (setup, gating, execution, oracle, persistence, result-shaping) — the direct cause of the union shapes drifting. Extract `runHarness(driver, {...}): HarnessResult` so the union is built in one place and a fake driver can be injected in tests.
- **`listDrivers()` is an identity pass-through** over the already-exported `DRIVERS` (no copy/filter) — delete it, keep `DRIVERS` + `resolveDriver`.
- **`executed` result carries an unused `closure` field** the Task 7 union omits — producer/contract drift; drop it or add it to the union.
- **`oracle.allPassed` is exported + tested but never used** — dead surface duplicating the inline check in `report.mjs`; delete or wire it in as the single source of truth.

### 🟢 LOW — Task 9 Step 5 stale premise
It says "if the import is `import { readFile } from 'node:fs/promises'`… change it to `{ readFile, readdir }`", but `tools/lint-skills.mjs:1` **already** imports `{ readdir, readFile }`. Guarded by an `If`, so low risk — but the stated current state is simply wrong. **Fix (priority 10):** reword to note `readdir` is already available; no import change needed.

---

## Refuted findings (checked and dismissed — with one nugget to keep)

1. **"OpenCode is not modeled by the repo; `.opencode/skills` is an unverified guess"** — **REFUTED.** The docs bundle *does* model it: `references/agent-skill-testing-landscape.md:119` ("OpenCode discovers project skills in `.opencode/skills`, `.agents/skills`, and `.claude/skills`") and `research/issue-4-portable-agents.md:71`. The path is correct. **Keep:** the same reference (`:122`) says tests must also isolate XDG roots — worth a one-line hardening note (folds into priority 3), but not a blocker.
2. **"Codex skill-discovery is unverified → spurious gating FAIL"** — **REFUTED.** The uncertainty is real but already guarded in three places (registry comment, driver comment, Task 1 design note) *and* by the explicit Task 8 Step-10 "confirm discovery before trusting results" checkpoint; the codex leg never gates CI, and AC #1 is satisfied by claude-code alone.
3. **"`file-not-contains` treats an absent file as FAIL"** — **REFUTED.** Consistent with its sibling `file-contains` (both require the file to exist); existence is `file-exists`/`file-absent`'s job. Coherent, not a surprise.
4. **"`file-absent`/`output-contains` are built but unexercised"** — **REFUTED.** `output-contains` is spec-mandated (Decision 2 + #24 list structured-output containment); both are exercised by `oracle.test.mjs` (the actual regression guard), and the vocabulary is deliberately YAGNI-capped at `schema`.

---

## Completeness gaps (second-pass critic)

A dedicated critic pass asked "what did the six dimensions *not* check?" and surfaced
five coverage gaps — two of them arguably more serious than most of the confirmed
findings, because they were blind spots rather than judgment calls.

### 🔴 GAP 1 — Tool-permission gate: the agent is likely not allowed to write files (candidate 2nd blocker)
14 of the 15 okf assertions check files the agent must **create**, yet `buildInvocation`
emits only the bare `['-p', prompt]` / `['exec', prompt]` / `['run', prompt]`, and Task 6
spawns `claude` with a **fresh empty `CLAUDE_CONFIG_DIR`** containing no pre-approved
permissions. In headless/print mode with no settings and no
`--permission-mode acceptEdits` / `--allowedTools` / `--dangerously-skip-permissions`,
Claude Code denies permission-gated tools (Write/Edit/Bash); `codex exec` and
`opencode run` have their own default approval/sandbox posture. **Likely result: the agent
produces prose but writes nothing → all filesystem assertions FAIL on every run → AC #1 is
unreachable as written.** This is *distinct* from the credential/auth findings (auth =
"can it talk to the model"; permissions = "may it touch the disk"). The Task 1 note bans
"speculative flags," but a permission grant is a **precondition**, not speculation.
- **Fix:** at Task 8 Step 10, before trusting any verdict, confirm files actually appear
  under `fixtureRoot`; if not, add the minimal per-harness grant to `buildInvocation`
  (claude `--permission-mode acceptEdits` or a seeded `settings.json` granting Write/Edit/Bash;
  codex `--full-auto`/sandbox; opencode equivalent) and cover it in `drivers.test.mjs`.
  Treat "ran but wrote nothing" as a distinct diagnostic, not a generic assertion FAIL.

### 🟠 GAP 2 — Immutability proof guards only `skills/`, but the agent can damage the real repo *outbound*
The ADR AC is "canonical sources verifiably unmodified," proven by `hashTree(skillsRoot)`
before/after. But the fixture lives under `tools/runs/` **inside** the repo, `prompt.md`
tells the agent "Target repo root: the current working directory," and headless agents
commonly resolve the enclosing git root (`git rev-parse --show-toplevel`) as the project
root. If a run targets the real repo root, it writes real `docs/`,
`scripts/validate-docs.mjs`, `.claude/rules/…` — **clobbering committed files, invisible to
a `skills/`-only hash.** This is the inverse of the HIGH leak-*in* finding and equally
unguarded. Note: relocating fixtures to a temp dir (priority 1) mitigates but does not fully
close this unless the immutability check also widens or the fixture is a standalone git root.
- **Fix:** widen the immutability proof to assert `git status --short` is empty for
  `docs/ scripts/ .claude/` after a real run (or `git init` the fixture as its own root so
  git-root resolution lands inside `fixtureRoot`).

### 🟠 GAP 3 — The byte-equality anchor sits on a file the skill's own rule invites editing
The plan's strongest oracle is `file-equals scripts/validate-docs.mjs`. But the asset
hardcodes this repo's value `excludedTopLevelDirs = new Set(['superpowers'])`
(`assets/scripts/validate-docs.mjs:13`), and the skill installs `.claude/rules/docs-authoring.md`
which literally says *"edit `excludedTopLevelDirs` in `scripts/validate-docs.mjs` if your
bundle needs a different set."* A Phase-3 agent that just installed that rule may "helpfully"
localize it for FixtureProj (which has no `superpowers/` dir), silently breaking the one
assertion the whole tracer bullet leans on. Sharper than the general Phase-3 concern.
- **Fix:** in `prompt.md`, explicitly forbid editing `scripts/validate-docs.mjs` (copy
  byte-for-byte, do not localize `excludedTopLevelDirs`); consider adding a second `file-equals`
  on `validate-docs.test.mjs` so the anchor isn't a single fragile point.

### 🟢 GAP 4 — No retention/cleanup for `tools/runs/`
Each run mints a new `runId` dir and copies the full closure per harness; `runCase` only
`rm`s its own `fixtureRoot`, never prunes prior runs → unbounded growth (git-ignored, so it
won't dirty the tree, but nothing caps disk). **Fix:** a retention policy (keep last N /
`--clean` flag), or at minimum document manual cleanup.

### 🟢 GAP 5 — ADR Decision 2's advisory-signal recording is unimplemented and un-seamed
Decision 2 says advisory signal "is recorded as advisory and never gate." #24's ACs don't
require it, so omitting it is defensible YAGNI — but `HarnessResult`/artifacts reserve no
place for it, so adding it later means changing the union the report/exit modules switch on.
**Fix:** confirm this is a deliberate scope cut and note it in the traceability table (ADR
Decision 2 partially deferred), so a future reader doesn't assume it exists.

## Prioritized fix list

| # | Fix | Where | Resolves |
|---|-----|-------|----------|
| **1** | Build fixtures under `os.tmpdir()`, outside the repo tree; assert no ancestor memory/skills are visible | Task 8 `runsRoot` default; Task 6 `cwd` | 🔴 HIGH + 🟠 determinism MEDIUM |
| **2** | Seed creds / rely on API-key passthrough; classify auth failure as SKIPPED not FAIL | Task 1 env; Task 6 probe; Task 8 skip | 🟠 credential MEDIUM + 🟢 LOW |
| **3** | One uniform isolation contract for all 3 drivers (+ XDG), asserted by test | Task 1 env | 🟢 isolation LOW |
| **4** | `timeout` + `killSignal` on `spawnSync`; capture `r.error`; fail closed with diagnostic | Task 6 `runDriver` | 🟠 hang MEDIUM |
| **5** | Record + report harness `status`/error | Task 8 real-run branch; Task 7 report | 🟢 LOW |
| **6** | Require ≥1 assertion for an executed PASS | Task 7 `exitCodeFor` | 🟢 LOW |
| **7** | Wrap `main()` in `.catch`→exit 2; bounds-check flag values | Task 8 `main`/`parseArgs` | 🟢 LOW |
| **8** | Bound prompt tail (Phase 3 confirm-only, skip Phase 4); fix design-note wording | Task 5 `prompt.md` + note | 🟢 LOW |
| **9** | Tag the union + extract `runHarness()`; drop `listDrivers`, dead `closure`, unused `allPassed` | Tasks 1/3/7/8 | 5× 🟢 code-quality LOW |
| **10** | Correct Task 9 Step 5's stale import premise | Task 9 Step 5 | 🟢 LOW |
| **G1** | **Verify + grant tool permissions** so the agent can write files at all | Task 1 `buildInvocation`; Task 8 Step 10 | 🔴 candidate blocker |
| **G2** | Widen the immutability proof (guard `docs/ scripts/ .claude/`, not just `skills/`) | Task 8 `hashTree` guard | 🟠 damage-out |
| **G3** | Forbid editing `scripts/validate-docs.mjs` in `prompt.md`; add a 2nd `file-equals` anchor | Task 5 `prompt.md` | 🟠 anchor fragility |
| **G4** | Retention policy / `--clean` for `tools/runs/` | Task 8 `runCase` | 🟢 LOW |
| **G5** | Confirm advisory-recording is a deliberate scope cut; note in traceability table | plan traceability | 🟢 LOW |

**Bottom line:** the real gate is **priority 1 (fixture isolation) + G1 (tool permissions)** — together they decide whether the runner can produce *any* trustworthy signal; G1 in particular should be verified at Task 8 Step 10 before anyone trusts a green. Priority 2 (credentials) and priorities 3–4 / G2–G3 harden trust further; the rest (5–10, G4–G5) are cleanups that fold into the same revision. Once the isolation model is redesigned, tool-write permission is proven, and the oracle is hardened, the plan is sound and ready to build.
