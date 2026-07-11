---
type: Specification
title: Skills library & building platform — locked specification
description: The consolidated, buildable specification for the personal skills library and skills-building platform — repository structure, distribution channels, dependency and authoring conventions, versioning, testing/benchmark harness, and CI wiring — assembled from the governing Decisions.
timestamp: 2026-07-11
---

# Skills library & building platform — locked specification

This is the destination artifact of the wayfinder effort tracked in
[map #1](https://github.com/artemVeduta/skills/issues/1): the locked specification from
which implementation of the skills library and skills-building platform starts. Each
section consolidates the normative content of its governing `Decision`, which remains the
authority on rationale, alternatives, and amendments. Where this spec names a gap under
[Implementation notes](#implementation-notes-implementer-owned), the implementer decides —
nothing there reopens a decision.

**Precedence note:** [install.sh — library skill installer](/specs/install-sh.md)
documents the *current* script. Where it conflicts with the target installer behaviour
below (whole-library, registry-driven — per the amended
[distribution-channels Decision](/decisions/skill-distribution-channels.md)), the
Decision governs; that spec is revised when the new installer lands.

## Repository structure

Governed by [Organize the library around flat, skill-owned directories](/decisions/skill-library-structure.md).

- **Flat skill tree.** Canonical skills live directly under `skills/<name>/` — no
  category buckets, and no skill-count threshold that triggers them. Reorganization
  requires a fresh Decision motivated by real navigation pain.
- **Skill-owned support material.** Each skill owns its executable support material
  beneath its own directory (`skills/<name>/scripts|templates|assets/`). No top-level
  `shared/` or `templates/`; a concrete second consumer triggers a new Decision, not
  automatic shared storage.
- **`scripts/` vs `tools/`.** `scripts/` holds repository-operator entry points and
  workflow automation (today: `install.sh`, `validate-docs.mjs` + its test, later the
  release script). `tools/` is reserved for developer infrastructure — the test/benchmark
  harness and the skill linter (see [Testing and benchmark harness](#testing-and-benchmark-harness)) —
  and may legitimately be absent until that work lands.
- **README skill index + sync rule.** Root `README.md` is the public skill inventory and
  install entry point (one line per skill: name + purpose, plus install instructions).
  Adding or removing a skill updates `README.md`; root `AGENTS.md` carries that
  synchronization rule, and `CLAUDE.md` delegates to it (`@AGENTS.md`).
- **Knowledge home.** Explanatory truth (Decisions, conventions, glossary, references)
  lives in the `docs/` OKF bundle and is never copied into distributed skill payloads;
  executable truth outside `docs/` is referenced, not pasted.
- **Byte-exact contract material.** Everything under `skills/okf-docs-setup/assets/` is
  byte-exact contract material per the
  [byte-exact assets Convention](/okf-docs-setup/conventions/byte-exact-assets.md):
  copied verbatim into target repos, never regenerated or summarized, placeholders left
  unfilled in this repo, edited only to intentionally change the contract (keeping the
  validator test and `SKILL.md` manifest in sync). No restructuring below touches it.

## Distribution and installation

Governed by [Use three skill distribution channels](/decisions/skill-distribution-channels.md).

One canonical authoring tree (`skills/<name>/`) is delivered through exactly three
channels — alternative package shapes, not harness categories:

1. **Development links.** `scripts/install.sh` becomes a development-only interactive
   wizard: it selects harness types and one or more **harness profiles** (independently
   configured harness instances identified by their configuration roots — `~/.claude`,
   `~/.claude-work`, an isolated `CODEX_HOME`; see [Harness](/glossary/harness.md)),
   previews the plan, then symlinks **every** library skill from the working checkout
   (`ln -sfn`) so edits and `git pull` reach every linked profile live.
2. **Portable pure skills.** `npx skills@latest add artemVeduta/skills` is the supported
   package-like install. The upstream CLI owns skill/harness selection, project vs.
   global scope, its `.agents/skills` storage, lock state, and `skills update`; it may
   target any harness it supports.
3. **Native aggregate plugins.** Codex and Claude Code each get a thin native manifest
   and marketplace entry packaging the complete `skills/` tree as one plugin; the harness
   CLI owns install, caching, namespacing, enablement, and updates, per configuration
   root.

- A single harness profile must not install the library through both the pure-skill and
  native-plugin channels (duplicate namespaced/unnamespaced capabilities).
- **Declarative harness registry.** The wizard and generated README guidance share one
  declarative registry as their single source of truth — per harness: stable id + display
  name, project/global skill directories, configuration-root env var or profile-discovery
  rules, supported scopes and channels, custom-profile validation. Adding an ordinary
  pure-skill harness is a registry-entry-plus-contract-tests change, never a new wizard
  branch; behavioral adapters exist only where native plugin operations need more than
  path metadata (Codex, Claude Code). Unknown profiles stay reachable via a custom
  configuration-directory option.
- **Update semantics stay separated by channel:** repository pull (development),
  `skills update` (portable), harness plugin updater (native).

## Skill dependencies

Governed by [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md);
term: [Skill dependency](/glossary/skill-dependency.md).

- Every skill with runtime dependencies declares them in a `## Required skills` section
  of its root `SKILL.md` — one bare canonical skill name per list entry. This section is
  the only machine input to the dependency graph.
- A separate `## Integration` section explains each relationship in prose (labels:
  **Required sub-skill**, **Required background**); it is never parsed.
- Slash-prefixed `/skill-name` is runtime invocation syntax; every runtime slash
  invocation must have a matching bare entry in `## Required skills`. Non-invoking
  mentions use the plain name.
- **Cross-skill filesystem paths are forbidden** — installed paths vary by harness and
  channel; skills invoke capabilities by canonical name only.
- **Installation is dependency-safe by default:** selecting a skill expands its full
  transitive closure before any changes; a missing node or a cycle rejects the install.
  Any closure-skipping mode is a separate explicit unsafe option (e.g. `--no-deps`).
- Validators parse `## Required skills`, enforce canonical names, reconcile slash
  invocations against declarations, detect missing nodes and cycles, and compute closure.
  Channel application: the development installer validates the graph then symlinks the
  whole library (no per-skill closure needed); aggregate plugins validate and package the
  whole tree; selective portable installs expand the closure — until the upstream `skills`
  CLI supports the convention, `--skill '*'` is the safe whole-library fallback.

## Skill authoring conventions

Governed by [Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md).

- **Portable floor** (Agent Skills spec): `SKILL.md` at the skill root; frontmatter
  `name` equals the kebab-case directory name; `description` ≤ 1024 characters; body
  under 500 lines.
- **Trigger-only descriptions.** A model-invoked skill's `description` opens with the
  triggering condition ("Use when …") and enumerates concrete trigger situations; it
  never summarizes the workflow. A user-invoked skill's `description` is a human-facing
  one-liner.
- **Frontmatter allowlist.** Only `name`, `description` (required) and
  `disable-model-invocation`, `argument-hint` (optional) are permitted;
  `disable-model-invocation: true` marks a skill user-invoked. Unknown keys (including
  `version:`) are linter WARNs.
- **Minimal skeleton.** Required: `## Overview`, exactly one author-named workflow
  section, plus `## Required skills` / `## Integration` where dependencies exist.
  Canonical optional headings, used verbatim when covered: `## When to Use`,
  `## Common Mistakes`, `## Quick Reference`; near-miss names are WARNs.
- **Progressive disclosure.** Past 200 body lines → WARN; past 500 → ERROR. Heavy
  reference material moves into flat UPPERCASE sibling files (`GLOSSARY.md`,
  `REPORT-FORMAT.md`) linked by relative path; workflow steps stay inline.
- **Role-named support subdirs only:** `scripts/` (run), `templates/` (fill in),
  `assets/` (copy verbatim); other subdir names are WARNs.
- **Actions, not tools.** Bodies describe harness-agnostic actions ("dispatch a
  subagent"), never harness-specific tool names, so one canonical tree serves every
  channel.
- **Advisory two-tier linter** (lives in `tools/`): ERRORs are contract breaks
  (frontmatter outside the allowlist, `name` ≠ directory, undeclared runtime `/skill-name`
  invocation, required skill that is user-invoked, cross-skill filesystem paths,
  dependency cycles, body > 500 lines); WARNs are style drift. The default invocation
  always exits 0; CI derives red from ERROR presence via a strict mode (see
  [CI and automation](#ci-and-automation)).

## Versioning and releases

Governed by [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md).

- The library is checkpointed with semver-shaped `vX.Y.Z` tags published as GitHub
  releases. A tag is a snapshot — **no compatibility contract**; breaking-change
  detection stays with installer-time dependency validation.
- Native plugin manifest versions mirror the tag: cutting a release bumps the Codex and
  Claude manifests to the tag's value (tolerating manifests that don't exist yet).
- A `scripts/` release script owns the ritual — bump manifests, commit, tag, create the
  GitHub release — plus baseline promotion and the staleness warning from the benchmark
  design (below).
- The development-symlink and portable channels are unaffected: both keep tracking git.

## Testing and benchmark harness

Governed by [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
(shape) and [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md)
(numbers). The harness is repo-owned, under `tools/`; Promptfoo and Harbor are named
deferred upgrade layers only.

- **Fixture builder.** Projects the canonical `skills/<name>/` directory unmodified into
  a disposable fixture, including the transitive closure of `## Required skills`, shaped
  to each harness profile's discovery path. Sources are never mutated.
- **Headless drivers.** Each supported harness runs its own fixture through its headless
  CLI (Claude `-p`, Codex `exec`, OpenCode `run`) against a scenario prompt.
- **Deterministic oracle.** Pass/fail derives only from deterministic state assertions
  (filesystem, structured output, exact/containment/schema). Skill-selection evidence and
  LLM-judge rubric scores are recorded as advisory and never gate.
- **Gating-capable runner.** The local test runner exits nonzero on assertion failure —
  deliberately unlike the always-advisory docs validator and skill linter.
- **Central cases.** Cases live at `tools/tests/<skill-name>/` (scenario prompt + fixture
  inputs + expected-state assertions). Skill directories stay pure deliverables: no test
  material ships to installs.
- **Benchmarks are paired trials:** the same case with and without the skill installed,
  reporting the delta; additionally comparable across harnesses, release tags (trend
  only), and model ids.
- **Two presets:** `smoke` = 1 paired trial (wiring check); `full` = 5 paired trials —
  only `full` summaries are comparable and promotable to baseline. Every recorded score
  names its preset.
- **Regression flag (advisory):** a `full` run flags a case only when its with-skill pass
  rate falls ≥ 2-of-5 trials below baseline; a single stochastic failure never flags.
- **Retention:** per-run summary JSON (scores, per-trial marks, deltas, flags,
  provenance, preset) is committed; raw artifacts (transcripts, fixture state,
  per-assertion results) go to a git-ignored runs directory under `tools/`.
- **Baselines:** the cross-run baseline is a `full` summary promoted explicitly by the
  release script; the within-run baseline is the fresh without-skill arm of the same run.
- **Provenance (required identity set):** ISO timestamp; library commit SHA + dirty flag
  (+ release tag when on one); case id (skill + case name); preset + trial count; per arm
  the harness name + version and model id. Resource-usage fields are optional extras.
- **Reporting:** a deterministic generator renders per-case markdown from committed
  summaries (per-trial marks, with/without pass rates, delta, regression flag, advisory
  judge scores). No blended cross-case score exists.

## CI and automation

Governed by [CI and automation wiring](/decisions/ci-and-automation-wiring.md).

- Push/PR CI runs only the free static checks — skill linter + docs validator — and fails
  **only** on linter ERRORs; WARNs and all docs-validate output surface as advisory.
- **No inference in CI, ever:** per-skill cases, per-harness contract tests, and
  benchmarks run only locally via the `tools/` runner; CI holds no model API keys and has
  no scheduled workflows. "On-demand" means the developer invoking the local runner.
- **Release-time staleness guard (advisory):** before promoting the baseline, the release
  script verifies committed full-preset summaries exist and match the current commit or a
  recent ancestor; if missing or stale it warns and proceeds — the ritual never wedges.

## Implementation notes (implementer-owned)

Known gaps deliberately left to the build effort; none reopens a decision:

- `scripts/install.sh` must be rebuilt to the target wizard: its `find -maxdepth`
  discovery predates the flat `skills/<name>/` layout, it has no dependency-graph
  validation, and its `DEFAULT_TARGETS` menu predates the registry/profile model. Revise
  [/specs/install-sh.md](/specs/install-sh.md) when it lands.
- `~/.agents/skills` is both a development symlink target and the portable CLI's own
  storage; the installer should call out (or refuse) mixing channels in that directory.
- The exact `scripts/`↔`tools/` invocation boundary (how the release script locates the
  runner's committed summaries), the staleness guard's "recent ancestor" matching rule,
  the report generator's summary-selection scope, and the release script's preconditions
  (clean tree, branch, pre-flight checks) are implementation details.
- Once `tools/` exists, extend the `.claude` docs-maintenance rule's source glob to cover
  it.
