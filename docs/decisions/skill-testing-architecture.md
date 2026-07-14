---
type: Decision
title: Skill testing and benchmark architecture
description: Test skills with a repo-owned harness in tools/ driving headless harness CLIs, graded by deterministic state assertions, with central per-skill case dirs and paired with/without-skill benchmarks.
timestamp: 2026-07-14
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
