# Test-Runner Profile-Based Isolation — Design

> **Status:** approved design, 2026-07-15. Follow-up to the #24 tracer bullet.
> Supersedes the §6 "inherit host auth" fixes in
> `docs/superpowers/plans/2026-07-15-test-runner-e2e-findings-and-fixes.md` — those were
> provisional decisions, re-decided in this brainstorm.
>
> - Branch: `feat/24-test-runner`.
> - Inputs: the findings doc above; `docs/decisions/skill-testing-architecture.md`;
>   `docs/references/agent-skill-testing-landscape.md`; read-only CLI capability probes
>   (claude 2.1.209, codex 0.139.0, opencode 1.18.0) run 2026-07-15.

## 1. Problem

The tracer bullet's live e2e failed for two independent reasons:

1. **opencode escaped its fixture** — a pre-existing `opencode --auto` daemon served the
   run in the real repo's project context, bypassing the client's cwd/env. The immutability
   guard caught it (gated FAIL), but 8 committed files were mutated and reverted.
2. **claude & codex auth-failed under isolation** — the runner emptied `HOME`/XDG and pointed
   `CLAUDE_CONFIG_DIR`/`CODEX_HOME` at empty fixture dirs, hiding the OAuth credentials both
   CLIs need. They exited 1 with nothing written; every assertion failed 0/16.

The root design flaw: *isolation* was conflated with *emptiness*. Live runs need harness
homes that are isolated from the developer's real config **and** carry working auth.

## 2. Goals

1. Live e2e runs use **dedicated, persistent, pre-authenticated per-harness profiles** —
   never the developer's real `~/.claude`, `~/.claude.json`, `~/.codex`,
   `~/.config/opencode`, `~/.local/share/opencode`, global CLAUDE.md memory, or user skills.
2. Auth is **OAuth/subscription-based**, provisioned once per harness by the developer via a
   helper command; the runner itself never handles credentials.
3. **Per-harness model selection** on the CLI, with a pinned default model per driver —
   and run records that state which model and harness version produced each verdict
   (motivated by the observed mid-investigation opencode auto-update: a verdict without
   provenance is not attributable).
4. The driver interface is **structurally ready for a pydantic-ai-harness driver**
   (implementation is a follow-up ticket).
5. Every hard invariant survives unchanged: out-of-repo fixture cwd, deterministic-only
   gating, no vacuous PASS, repo immutability guard, local-only inference, no inference in
   CI or `npm test`.

## 3. Non-goals (this ticket)

- Implementing the pydantic-ai driver, its Python shim, or its skills-loading capability
  (follow-up ticket, which also carries the ADR amendment extending the harness set).
- Containerized/VM execution (documented escalation path only).
- Advisory-signal recording (still deferred per the 2026-07-14 ADR amendment).
- Making harness exit status or timeout a gating input. Today a verdict derives **solely**
  from deterministic assertions plus source immutability (the ADR's oracle decision); the
  `! harness exited abnormally` line is informational. This spec consciously keeps that:
  a harness that exits non-zero after writing everything still PASSes if the oracle passes.
- Running the same harness under multiple models within a single run (duplicate `--harness`
  ids are a usage error; artifact layout stays keyed by driver id).

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Where do pre-authed dirs live; who provisions? | Fixed convention `~/.skills-test-profiles/<harness-id>/`, provisioned by a new `npm run test:auth -- <harness-id>` helper. No env-var override (YAGNI). |
| D2 | opencode participation? | Stays in the default harness set. A **daemon preflight** is the gate: any running `opencode` process ⇒ SKIP the leg. No opt-in env var. |
| D3 | Per-harness model selection surface? | Repeatable `--harness <id>[=<model>]` CLI flag; omitted model ⇒ driver's pinned `defaultModel`. No config file; no per-case model coupling. |
| D4 | Done bar for live verification? | **All three harnesses live green** on `okf-docs-setup` from pre-authed profiles. |
| D5 | Auth/profile problems? | Problems **detectable before execution** (missing binary, missing profile dir, missing auth material) map to `skipped` with an actionable reason — never silent. Auth failures that surface only during execution (e.g. an expired token behind an existing `auth.json`) execute and are judged by the oracle like any run, with the abnormal-exit marker as the diagnostic (see non-goal 4). Existing "exit 1 if nothing executed" prevents vacuous passes. |
| D6 | Profile integrity guarding? | None — profiles are mutable harness state by design (sessions/history land there). The repo guard is unchanged and does not cover profiles. |
| D7 | Architecture shape? | Profile module + widened driver seam (no strategy objects, no data-driven registry). |

## 5. Isolation model

Two independent axes, both explicit:

- **Project scope (unchanged):** harness cwd is a disposable out-of-repo `os.tmpdir()`
  fixture; the cwd-upward discovery walk only ever reaches fixture content.
  `hashGuardedTrees` over `skills/ docs/ scripts/ .claude/` stays exactly as is.
- **User scope (redesigned):** each harness runs against a persistent pre-authenticated
  **test profile** (the repo glossary's *harness profile*: an independently configured
  instance identified by its configuration root):

```
~/.skills-test-profiles/
  claude-code/    CLAUDE_CONFIG_DIR → this dir
  codex/          CODEX_HOME → this dir (auth.json, config.toml, skills/ live inside)
  opencode/       HOME + XDG_CONFIG_HOME/XDG_DATA_HOME/XDG_CACHE_HOME/XDG_STATE_HOME
                  → subdirs of this dir; plus OPENCODE_DISABLE_AUTOUPDATE=1
```

Profiles live outside the repo and outside fixtures: fixture teardown and the guard never
touch them. They are expected to mutate across runs and hold auth + harness state only.
The auth helper and the driver build the profile env through the **same function**, so
login state lands exactly where the runner later looks.

Env-map rationale (from the capability probes):

- **claude:** `CLAUDE_CONFIG_DIR` is supported (binary evidence; absent from `--help`).
  Real `HOME` is kept — the OAuth token lives in the macOS Keychain and keychain access
  should not be disturbed. Global `~/.claude/CLAUDE.md`, skills, and settings are not read
  because the config dir is relocated. See §9 verification V1 for the `.claude.json`
  pointer and Keychain scoping.
- **codex:** `CODEX_HOME` relocates everything wholesale — config, `auth.json` (plain file,
  mode 600), `skills/`, `AGENTS.md`. Real `HOME` kept. **Skill discovery is the open
  point:** the current driver assumed `$CODEX_HOME/skills`, which only worked because
  `CODEX_HOME` pointed into the fixture; with `CODEX_HOME` on the profile, the fixture's
  staged skills are no longer at that path. Verification V3 (§9) pins the resolution
  before wiring. claude and opencode are unaffected — their discovery paths are
  cwd-relative and stay inside the fixture.
- **opencode:** config and data roots derive from `HOME`/XDG; auth is a plain file at
  `<XDG_DATA_HOME>/opencode/auth.json`. Overriding `HOME` **and** all four XDG roots
  confines its fixed paths; `OPENCODE_DISABLE_AUTOUPDATE=1` prevents mid-suite version
  drift (it already auto-updated 1.17.20 → 1.18.0 once during this investigation).

## 6. Components

**New — `tools/test-runner/profiles.mjs` (pure).** Single source of truth:

- `profileDirFor(harnessId)` → `~/.skills-test-profiles/<harness-id>` (via `os.homedir()`).
- `profileEnvFor(harnessId, profileDir)` → the per-harness env map above.
- `authMaterialPath(harnessId, profileDir)` → the file whose existence means "authed"
  (codex: `<profile>/auth.json`; opencode: `<profile>/<xdg-data>/opencode/auth.json`;
  claude: pinned by verification V1).

**Changed — `tools/test-runner/drivers.mjs`.** `isolationEnv` is deleted. Descriptors gain:

- `defaultModel` — pinned per driver at implementation time against the installed CLIs.
- `probe` — driver-owned availability spec (`{args: ['--version']}` for all three today);
  exists so a non-CLI-shaped harness can declare its own probe later.
- `buildInvocation({fixtureRoot, prompt, model, profileDir})` — still pure, still returns
  `{command, args, env}`. Env comes from `profileEnvFor`. Model translation per driver:
  claude `--model <m>`; codex `-m <m>`; opencode `-m <provider/model>` (caller supplies the
  provider-prefixed form; documented). No speculative flags: everything emitted was
  verified against installed `--help` output. codex's `discoverySubdir` is pinned by
  verification V3 (cwd-relative `.agents/skills` preferred; `$CODEX_HOME/skills`
  profile-staging fallback).

**Changed — `tools/test-runner/runner.mjs` and `tools/test-runner.mjs`.**

- `runDriver` and both `buildInvocation` call sites (execute + dry-run) thread
  `{model, profileDir}` through.
- `isHarnessAvailable` uses the descriptor's `probe` instead of hardcoded `--version`, and
  captures the probe's stdout as the harness **version string** for provenance.
- `runHarness` gains the preflight ladder (§7).
- `parseArgs`: `--harness` becomes repeatable and accepts `<id>[=<model>]`; duplicate ids
  ⇒ usage error (exit 2). Default remains all registered harnesses with default models.

**New — `tools/test-auth.mjs`** (`npm run test:auth -- <harness-id>`, impure): creates the
profile dir, applies `profileEnvFor`, spawns the harness's interactive login flow attached
to the developer's terminal, then reports authed/not-authed by checking `authMaterialPath`.
Exact login subcommands are confirmed at implementation time (claude and codex expose
login/auth subcommands; opencode has `opencode auth`).

**Untouched:** fixture builder (unless V3 forces the codex profile-staging fallback),
oracle, case loader, case format (`{skill, inputs, assertions}` + `prompt.md`), exit-code
semantics, linter. **Extended additively:** the per-harness artifact set gains a structured
`run.json` (§7); `formatRunReport` gains a one-line provenance note per harness; the ADR
gains a dated amendment (§12) — existing decision text is never rewritten.

## 7. Runtime flow

```
npm run test:case -- okf-docs-setup                                   # all three, defaults
npm run test:case -- okf-docs-setup --harness claude-code             # one, default model
npm run test:case -- okf-docs-setup --harness claude-code=claude-sonnet-5 \
                                    --harness codex=gpt-5.2-codex     # subset, pinned
npm run test:auth -- codex                                            # one-time provisioning
```

Per harness: build fixture → **preflight ladder** → execute → oracle → report. The ladder
stops at the first failing rung, yielding `status: 'skipped'` + actionable `skipReason`:

1. **Binary** — descriptor `probe` exits 0, else
   *"harness binary `<command>` not found — install `<id>` or fix PATH"*.
2. **Profile exists** — `profileDirFor(id)` is a directory, else
   *"no test profile — run `npm run test:auth -- <id>`"*.
3. **Auth material present** — `authMaterialPath` exists (file presence only; no inference
   spent probing auth), else
   *"profile exists but is not authenticated — run `npm run test:auth -- <id>`"*.
4. **opencode only: daemon scan** — any process owned by the current user whose executable
   basename is `opencode` ⇒
   *"kill the running opencode server first — `run` may attach to it and escape the fixture"*.

Dry-run short-circuits before the ladder (unchanged) but records the full real invocation —
args including the model flag, and the profile env — so `--dry-run` shows exactly what
would execute.

**Provenance:** each harness's artifact dir gains a structured `run.json` recording the
harness id, resolved model, harness version string (captured from the probe), the exact
invocation (command + args), exit status, `timedOut`, and — for skipped legs — the skip
reason. `transcript.json` stays the raw output dump, unchanged in shape. `formatRunReport`
prints a one-line provenance note (model + harness version) per executed harness.

**Failure taxonomy:**

| Condition | Result |
|---|---|
| Binary missing / no profile / unauthed / opencode daemon running | `skipped` + reason |
| Harness ran, exit ≠ 0 | executed; `! harness exited abnormally` diagnostic line — the verdict still derives solely from assertions + source immutability (existing behavior, consciously kept per non-goal 4) |
| Assertion failures | executed FAIL per assertion (existing) |
| Guarded trees mutated | FAIL `! canonical sources were modified` (existing) |
| Timeout | SIGKILL + `timedOut` recorded; same oracle-only verdict (existing) |

Exit codes unchanged: 0 all-executed-green + sources clean; 1 any executed failure, source
mutation, or nothing executed; 2 usage error.

## 8. Safety model

Layers for the opencode leg (the one that escaped): daemon preflight (skip, never attach) →
profile env (`HOME`+XDG confine its fixed paths) → `--auto` scoped by fixture cwd →
`OPENCODE_DISABLE_AUTOUPDATE=1` → repo immutability guard as last-resort detection.

claude keeps `--permission-mode bypassPermissions`: its real confinement was always the
out-of-repo tmpdir + guard, and its config writes now land in the test profile rather than
`~/.claude`. codex keeps `--sandbox workspace-write` (OS-enforced cwd confinement).

Residual, documented risk: no OS sandbox prevents an arbitrary write outside cwd; the guard
detects repo damage, and profile env redirection removes the developer's real homes from
the blast radius. Containers (per the landscape reference) remain the escalation path and
are out of scope.

## 9. Required pre-wiring verifications

- **V1 — claude profile auth scoping** *(no inference)*. With `CLAUDE_CONFIG_DIR=<profile>`,
  run the login flow and confirm: (a) where the `.claude.json`/`oauthAccount` pointer lands
  (expected: inside the profile), (b) what Keychain entry is created and whether the main
  install's auth still works afterwards. Outcome pins `authMaterialPath('claude-code')`.
  Fallback if profile-scoped OAuth is unworkable: `test-auth.mjs` itself seeds the profile
  with a copy of the OAuth pointer file and re-checks `authMaterialPath` (Goal 2's
  helper-provisioning contract holds; still no exposure of global memory/skills).
- **V2 — opencode env honoring** *(no inference)*. With the profile env applied and no
  daemon running, confirm non-inference commands read/write only under the profile (file
  mtime checks on the real `~/.config/opencode` and `~/.local/share/opencode`).
- **V3 — codex skill discovery** *(may spend one minimal live probe)*. Determine where
  codex 0.139.0 actually discovers skills once `CODEX_HOME` points at the profile. The
  landscape reference documents cwd-relative `.agents/skills/<name>/SKILL.md`; the current
  driver assumed `$CODEX_HOME/skills` (worked only because `CODEX_HOME` was inside the
  fixture). Preferred outcome: a working cwd-relative path — update codex's
  `discoverySubdir` to it and the fixture stays self-contained. Fallback: the codex leg
  stages the skill closure into `<profile>/skills` before the run and removes it after
  (profile mutation, accepted per D6; the fixture builder gains that step and leaves the
  Untouched list). AC-1's codex leg depends on this resolution.

## 10. Testing

- **Rewritten invariant** (scoped to the env map `buildInvocation` returns, not the
  effective child env): every entry in the returned map points at the fixture root or that
  harness's profile dir; the map never sets `HOME`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or
  any XDG root to the developer's real locations. claude and codex intentionally **omit**
  `HOME` from the map — it is inherited from `process.env` at spawn (Keychain access, §5).
- **New unit tests:** `profiles.mjs` path/env/auth-material mapping per harness; model
  threading (explicit vs `defaultModel` → correct per-CLI flag); repeatable and duplicate
  `--harness` parsing; preflight ladder with fake drivers and fake fs/process listing (each
  rung yields its exact skip reason); provenance fields present in the report.
- **pydantic-ai readiness proof (structural):** a fake non-CLI-shaped driver exercises a
  custom `probe`, a `defaultModel`, and profile-env construction — demonstrating a
  `uv run … shim.py`-style harness with API-key env auth fits the descriptor without
  interface changes.
- `npm test` stays fully deterministic; no CI changes.

## 11. Acceptance criteria

- **AC-1:** with all three profiles provisioned via `npm run test:auth`,
  `npm run test:case -- okf-docs-setup` executes all three harnesses live, each
  **PASS 16/16**, sources unmodified, exit 0.
- **AC-2:** per-harness model pinning shown live on ≥1 harness
  (`--harness claude-code=<non-default>`), with the model visible in that run's `run.json`
  (invocation args + provenance fields).
- **AC-3:** preflight rungs 2–4 demonstrably yield their actionable SKIPs in a live check
  (rename a profile dir; move its auth material; a dummy user-owned `opencode` process for
  the daemon rung), with the run output kept as verification evidence. Rung 1 (missing
  binary) is covered by the §10 unit tests only.
- **AC-4:** deterministic gate green: `lint:skills:strict`, `docs:validate`, `npm test`
  all exit 0.

## 12. Docs ceremony

New dated amendment to `docs/decisions/skill-testing-architecture.md`: isolation model is
now persistent pre-authenticated test profiles (not fixture-scoped empty homes), the
opencode daemon preflight, and model/version provenance in run records. Timestamp bump +
newest-first `docs/log.md` entry. `docs/glossary/harness.md` gains the test-profile usage
of *harness profile*. The pydantic-ai harness-set extension is explicitly deferred to its
follow-up ticket's amendment.
