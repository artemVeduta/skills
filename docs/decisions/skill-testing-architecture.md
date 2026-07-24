---
type: Decision
title: Skill testing and benchmark architecture
description: Test skills with a repo-owned harness in tools/ driving headless harness CLIs, graded by deterministic state assertions, with central per-skill case dirs and paired with/without-skill benchmarks.
timestamp: 2026-07-24
---

# Skill testing and benchmark architecture

## Context

The library needs automated testing and benchmarking of skills. The survey
[Agent skill testing landscape](/references/agent-skill-testing-landscape.md) found no
single public tool covering all four needs — structural validity, skill
selection/routing, behavioral correctness, and comparative benchmarking — and
recommended a layered approach. The repo today holds exactly one installable skill
(`okf-docs-setup`), a hybrid of an agent-driven install procedure and byte-exact
`assets/` that are deterministically assertable.

Prior decisions bind the shape: `tools/` is reserved for exactly this harness
([Flat skill tree with skill-owned assets](/decisions/skill-library-structure.md));
the frontmatter allowlist forecloses per-skill test metadata and the advisory
ERROR/WARN linter already owns static contract checks
([Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md));
installers symlink or package whole skill directories, so anything inside
`skills/<name>/` ships to every install
([Use three skill distribution channels](/decisions/skill-distribution-channels.md));
`## Required skills` defines a machine-readable dependency closure
([Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md)); and
releases are no-contract snapshots
([Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md)).

## Decision

1. **Executor — a trimmed repo-owned harness in `tools/`, heavy layers deferred.**
   The test harness lives under `tools/` (creating the reserved directory). Its core
   is a fixture builder that projects the canonical `skills/<name>/` — plus the
   transitive closure of its `## Required skills` — unmodified into a disposable
   fixture directory shaped for each harness profile's discovery path, then drives
   that harness's headless CLI (`claude -p`, `codex exec`, `opencode run`) against a
   scenario prompt. Promptfoo (eval orchestration) and Harbor (containerized
   end-to-end tasks) are the designated upgrade path once the library has enough
   skills to need them; they are specified as future layers, not adopted now.

2. **Grader — deterministic-first; the LLM judge is advisory only.** Deterministic
   assertions on resulting state (filesystem, structured output, exact/containment/
   schema checks) are the only pass/fail oracle. Skill-selection evidence (native
   skill-call events where a harness emits them; inferred `SKILL.md` reads on Codex)
   and LLM-judge rubric scores are recorded as advisory signal and never gate.
   Test runs are gating-capable — the runner exits nonzero on assertion failure — a
   deliberate contrast to the always-advisory docs validator and skill linter. What
   CI actually runs, and when, is a separate undecided question.

3. **Per-skill test artifact — central, skill-named case directories.** Cases live
   in `tools/tests/<skill-name>/`, one directory per skill: each case is a scenario
   prompt, its fixture inputs, and its expected-state assertions. Skill directories
   stay pure deliverables — no test material ships to installs, no new role subdir
   enters the authoring conventions, and the byte-exact `assets/` contract is never
   touched by test placement.

4. **Benchmark — paired trials with provenance, four comparison axes.** A benchmark
   run is Anthropic's paired-trial pattern: the same case run with and without the
   skill installed, repeated across trials, reporting the delta. On top of that
   core, runs may compare across harnesses (portability), across release snapshot
   tags (trend data only — tags carry no compatibility contract), and across model
   ids. Every recorded score carries provenance: model id, harness and version, and
   the library snapshot. Trial counts, thresholds, retention, and reporting design
   are deferred to the benchmark-metrics decision; benchmarks are scheduled or
   on-demand work, never a per-change gate.

## Alternatives

- **Full six-layer survey stack now** (gates, adapter preflight, behavioral runs,
  Promptfoo, Harbor, scheduled evals): rejected — most machinery to build and
  version-pin for a one-skill library; the trimmed core keeps the same skeleton and
  names the upgrade path.
- **Claude Code as the only executor**: rejected — the distribution-channels
  decision already promises per-harness contract tests; single-harness testing
  leaves two of three channels unverified.
- **Promptfoo as the sole executor**: rejected — it cannot project skills into
  fixtures or isolate inherited harness config, so the repo-owned fixture builder
  is needed anyway.
- **LLM-judge verdicts that gate**: rejected — pass/fail becomes stochastic and
  every re-run costs inference; judge output keeps its value as advisory signal.
- **Deterministic-only with no judge at all**: rejected — semantic quality of prose
  outputs is real signal worth recording, as long as it never gates.
- **Per-skill `tests/` subdir inside `skills/<name>/`**: rejected — installers ship
  whole skill directories, so tests would reach every install unless the install
  contract and packaging were amended, and a new role subdir would have to enter
  the authoring conventions.
- **Single flat corpus file for all skills**: rejected — every skill edit contends
  on one shared file and it does not scale past a handful of skills.

## Consequences

- `tools/` comes into existence with a clear first occupant: the fixture builder,
  headless-CLI runners, and case runner are post-map implementation work.
- A skill and its tests move in two places (`skills/<name>/` and
  `tools/tests/<name>/`); the linter's README-inventory drift check has a natural
  sibling — flagging skills with no case directory.
- Deterministic gating gives trustworthy red/green on cheap runs, while stochastic
  and semantic signal accumulates without blocking anything.
- Benchmarks cost real inference (paired trials × harnesses × models) and are kept
  off the per-change path by design.
- Adopting Promptfoo or Harbor later is an amendment to this decision, not a new
  architecture: the case format and fixture builder are designed to be wrapped, not
  replaced.

## Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->

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

## 2026-07-16 — Profile-based isolation, daemon preflight, and run provenance (#24)

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
- **codex skill-discovery leak, resolved (finding #4 — Option A).** codex also
  reads a global, HOME-based `~/.agents/skills/` independent of `CODEX_HOME`, so
  `CODEX_HOME` alone does not confine codex's skill discovery. For codex, HOME
  is relocated into the profile so the HOME-derived `~/.agents/skills` (the
  developer's real global skills — the actual leak) resolves to an empty
  profile location. This confines the two HOME/CODEX_HOME-derived skill roots.
  Residual surfaces that no env relocation can close, and which are out of
  scope for this ticket: the system/managed config layer (`/etc/codex/*`, macOS
  `com.openai.codex` MDM) and any codex-relevant variables the developer has
  exported into the parent environment. codex auth survives the HOME
  relocation because it is file-based under `CODEX_HOME` (or in the
  HOME-independent Keychain). claude-code continues to omit `HOME` from its
  env map — its OAuth token lives in the macOS Keychain, reached via the real
  `HOME`.
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

## 2026-07-17 — opencode fixture-escape fix

- **Root cause.** opencode `run` resolves its project not by process `cwd` but by
  (a) walking up from `cwd` looking for a `.git` directory, and (b) a persistent
  per-profile known-projects registry (`opencode.db`). A non-git tmpdir fixture
  fails the walk-up, so opencode falls back to a stale registry entry for the
  real repo — seeded when `opencode auth login` was previously run with
  `cwd` = repo root — and binds the run to that real-repo project, WRITING INTO
  THE REAL REPO TREES. This is the 2026-07-14 fixture-escape class recorded in the
  prior amendment, but its actual mechanism: stale per-profile STATE, not a live
  process, so it is undetectable by the live-daemon preflight (rung 4), which only
  catches a resident `opencode` server.
- **Fix (a deliberate, justified change to the otherwise wrap-frozen #24 harness,
  made during #25 go-green because it is a genuine correctness/safety bug, not a
  scope change).** The opencode driver now invokes `run --dir <fixtureRoot>`
  (`tools/test-runner/drivers.mjs`), pinning the run to the fixture regardless of
  the walk-up/registry fallback. Every fixture is `git init`-ed and
  baseline-committed (`tools/test-runner/fixture.mjs`) so opencode's walk-up finds
  a real, pinned git repo at the fixture root and has no reason to fall back.
  `scripts/setup-test-profiles.sh` now runs `opencode auth login` from a
  throwaway, non-repo cwd (so login never seeds a real-repo project into the
  registry) and adds a `check_opencode_no_repo_project` guard — the state-level
  analogue of the live-daemon preflight, checking the profile's `opencode.db` for
  a stale real-repo project entry rather than a live process. Driven by #24, fixed
  during #25.

## 2026-07-24 — v2 acceptance-harness seam (#48)

The harness gains the machinery the
[OKF documentation skill-suite v2](/specs/okf-docs-skill-suite-v2.md) acceptance
contract needs, without changing the decisions above (deterministic-only oracle,
central cases, out-of-repo fixtures, provenance):

- **Plan/approval turns.** A case may declare `followUps` — prompt files sent as
  later turns of the SAME session. Turn 1 proposes a plan and pauses (the headless
  turn ends); each follow-up resumes with explicit approval or denial. Drivers add
  `buildResumeInvocation` (`claude -p --continue` cwd-scoped to the fixture,
  `codex exec resume --last` with the workspace-write posture re-asserted via
  `-c sandbox_mode`, `opencode run --continue --dir <fixture>`; flags verified
  against the installed CLIs 2026-07-24). A timed-out turn ends the exchange. Later
  turns write numbered transcripts; `run.json` records `turnCount`. A dry run
  previews the WHOLE exchange (turn 1 plus every resume invocation) and surfaces a
  missing-resume-support configuration error just like a live run.
- **Git-state oracle.** New `git-unchanged` assertion: empty `git status
  --porcelain --ignored` (gitignored writes count as changes) and `HEAD` equal to
  the baseline commit sha recorded when the fixture was built — the observable
  proof a denied approval changed nothing. Equality-with-baseline, not
  shape-of-history: a rewritten history (`commit --amend`) presenting one clean
  commit with changed content fails.
- **Execution-trace oracle.** `trace-field`, `trace-every`, and `trace-disjoint`
  assertions parse the last fenced `execution-trace` block from the harness output
  and check coordinator/worker ownership (sole-writer coordinator, read-only
  workers, pairwise-disjoint concept ownership) deterministically.
- **Cross-harness comparison.** A case may declare `compare.paths`; after all legs
  run, each path's content digest (file or tree, absence included) must be equal
  across every executed harness. Divergence gates the exit code; fewer than two
  executed legs records SKIPPED and never gates. Verdicts are persisted as
  `comparisons.json` alongside the per-leg records, keeping every gating verdict
  attributable after the run.
- **Static portable contract.** `tools/test-runner/static-contract.mjs` checks the
  strictest shared-reader skill metadata (name pattern/length/dir match,
  description length in characters), relative support references (inline,
  angle-bracket, and reference-style link targets), project-memory routing (root
  `CLAUDE.md` is exactly the `@AGENTS.md` shim), and the 32 KiB root-to-workdir
  `AGENTS.md` instruction-chain budget; cases reach it through the
  `portable-contract` assertion, which defaults to the EXECUTING driver's
  discovery subdir and fails loudly when that subdir was never projected (no
  vacuous pass).

  Driven by #48.

## 2026-07-24 — Docs validator no longer the advisory contrast

[Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)
(#49) made `docs:validate` strict (exits `0`/`1`/`2`), so decision 2's
"deliberate contrast to the always-advisory docs validator and skill linter"
now holds only for the skill linter's default invocation. The grading
architecture itself is unchanged.
