---
type: Specification
title: Skills library & building platform — PRD
description: Whole-platform PRD for the skills library and building platform — problem, solution, user stories, and implementation and testing decisions across repository structure, distribution channels, skill dependencies, authoring conventions, versioning, the test/benchmark harness, and CI — consolidated from the governing Decisions.
timestamp: 2026-07-11
---

# Skills library & building platform — PRD

This is the destination artifact of the wayfinder effort tracked in
[map #1](https://github.com/artemVeduta/skills/issues/1): the whole-platform PRD from
which implementation of the skills library and skills-building platform proceeds. Every
normative statement below consolidates its governing `Decision`, which remains the
authority on rationale, alternatives, and amendments; nothing here invents or reopens a
decision.

**Precedence note:** [install.sh — library skill installer](/specs/install-sh.md)
documents the *current* development installer script and is being rewritten as the
dev-installer PRD. Where it conflicts with the target installer behaviour below
(whole-library, registry-driven — per the amended
[distribution-channels Decision](/decisions/skill-distribution-channels.md)), the
Decision governs; that spec is revised when the new installer lands.

## Problem Statement

I maintain a personal library of agent [skills](/glossary/skill.md) that must serve
several [harnesses](/glossary/harness.md) (Claude Code, Codex, OpenCode) and several
consumption styles from one working copy, and today nothing beyond a single ad-hoc
install script supports that. Concretely:

- I author a skill once but need it live in multiple **harness profiles** (personal
  `~/.claude`, work `~/.claude-work`, isolated Codex roots) while I edit it, installable
  by other people as a managed package, and installable as a native harness plugin —
  without maintaining harness-specific copies that drift.
- Skills that build on other skills have no declared contract: a selective install can
  silently omit a required capability, and a skill that reads another skill's files
  breaks the moment a channel or harness lays skills out differently.
- There is no shared quality bar. The reference projects this library learns from
  ([obra/superpowers](/references/obra-superpowers.md),
  [mattpocock/skills](/references/mattpocock-skills.md)) prove that hand-maintained
  conventions drift — both exceed their own stated size targets and ship unlisted skills
  — and a description that summarizes a workflow demonstrably makes agents execute the
  summary instead of the skill.
- I cannot tell whether a skill actually helps. There is no way to run a skill headlessly
  against a scenario, no deterministic pass/fail, and no comparable record across
  harnesses, models, or points in the library's history — the
  [testing-landscape survey](/references/agent-skill-testing-landscape.md) found no
  single public tool that covers this.
- There is no way to checkpoint "this state of the library was good" that the native
  plugin channel can display as an installed version.
- CI is a dilemma: gating on agent sessions puts API keys, inference cost, and
  stochastic failures on every push; gating on nothing lets deterministic contract
  breaks (dependency cycles, undeclared invocations) land unnoticed.

## Solution

One canonical, flat authoring tree of self-contained skills, delivered unchanged through
exactly three distribution channels with separated update semantics; a machine-readable
[skill-dependency](/glossary/skill-dependency.md) contract that makes every install
dependency-safe by default; a layered authoring convention (portable Agent Skills floor
plus a repo layer) enforced by an advisory two-tier linter; snapshot releases whose tags
mirror into native plugin manifests via a one-command release script; a repo-owned
test-and-benchmark harness that drives each supported harness's headless CLI against
disposable fixtures and grades only on deterministic state assertions, with paired
with/without-skill benchmark trials recorded as committed, provenance-stamped summaries;
and CI that runs only the free static checks, going red solely on linter ERRORs, with
all inference kept local forever.

The maintainer authors in one place and links live everywhere; consumers pick a package
shape (portable CLI or native plugin) whose lifecycle its own tooling owns; agents get
skills that invoke capabilities by canonical name and behave identically on every
harness; and quality, behavior, and benefit are each checked by the cheapest mechanism
that can check them deterministically.

## User Stories

### Repository structure and discovery

1. As a library author, I want every canonical skill to live directly in one flat tree
   (one directory per skill, no category buckets), so that any skill's location is
   predictable without learning a taxonomy.
2. As a library author, I want each skill to own all of its executable support material
   beneath its own directory, so that the skill stays self-contained when symlinked,
   copied, or packaged individually.
3. As a skill consumer, I want the root README to be the public inventory — one line per
   skill (name + purpose) plus install instructions for all three channels — so that I
   can discover and install the library without reading the source tree.
4. As a future contributor, I want the rule "adding or removing a skill updates the
   README inventory" stated in the root repository guidance, so that the public
   inventory stays true without tribal knowledge.
5. As a library author, I want repository-operator automation and developer
   infrastructure kept in separate homes, so that install/release entry points and the
   test/lint machinery never blur into one pile of scripts.
6. As a library maintainer, I want explanatory knowledge (Decisions, conventions,
   glossary, references) to live only in the docs bundle and never be copied into
   distributed skill payloads, so that installed skills stay lean and knowledge keeps a
   single source of truth.
7. As a library maintainer, I want the okf-docs-setup byte-exact asset payload treated
   as untouchable contract material, so that no platform restructuring can break its
   copy-verbatim install contract.

### Distribution and installation

8. As a library author, I want a development-only interactive wizard that symlinks every
   library skill from my working checkout into each harness profile I select, so that
   edits and `git pull` reach every linked profile live with no reinstall.
9. As a library author, I want the wizard to let me select multiple harness profiles per
   harness in one run — including custom configuration roots it validates — so that
   personal, work, and isolated profiles are all first-class targets.
10. As a library author, I want the wizard to show an explicit installation preview and
    require confirmation before changing any links, so that no run mutates a profile by
    surprise.
11. As a skill consumer, I want to install pure skills with the upstream portable CLI
    (`npx skills@latest add artemVeduta/skills`), so that I get managed, updatable skill
    copies with project or global scope without cloning the repository.
12. As a skill consumer, I want to install the complete library as a native Codex or
    Claude Code aggregate plugin from a marketplace entry, so that my harness CLI owns
    install, caching, namespacing, enablement, and updates per configuration root.
13. As a skill consumer, I want a clear warning that one harness profile must not
    install the library through both the pure-skill and native-plugin channels, so that
    I never end up with duplicate namespaced and unnamespaced capabilities.
14. As a skill consumer, I want each channel's update semantics stated explicitly
    (repository pull, `skills update`, harness plugin updater), so that I always know
    how my installation refreshes.
15. As a future contributor, I want adding an ordinary pure-skill harness to be a
    registry-entry-plus-contract-tests change — never a new wizard branch — so that
    harness support grows through data, not control flow.
16. As a library author, I want the wizard and the README install guidance to share one
    declarative harness registry as their single source of truth, so that documentation
    and installer behavior cannot drift apart.
17. As a library author, I want the wizard to call out (or refuse) mixing channels in
    the harness-neutral shared skills directory that doubles as the portable CLI's own
    storage, so that the two channels' state never corrupts each other.

### Skill dependencies

18. As a library author, I want to declare a skill's runtime dependencies in a dedicated
    machine-readable `## Required skills` section (one bare canonical name per entry),
    so that installers and validators have exactly one dependency-graph input.
19. As a library author, I want a separate `## Integration` prose section with explicit
    relationship labels, so that readers understand why each dependency edge exists
    without any tooling parsing that prose.
20. As an agent executing a skill, I want every runtime `/skill-name` invocation to have
    a matching declared entry in `## Required skills`, so that any capability I am told
    to invoke is guaranteed to be installed.
21. As an agent executing a skill, I want skills to invoke capabilities by canonical
    name and never by cross-skill filesystem path, so that a skill behaves identically
    regardless of channel and harness layout.
22. As a skill consumer, I want selecting a skill to expand its full transitive
    dependency closure before any changes, rejecting on a missing node or a cycle, so
    that I can never receive a silently broken installation.
23. As a skill consumer, I want any closure-skipping install mode to be a separate,
    explicitly unsafe option, so that ordinary selection flags never silently disable
    dependency safety.
24. As a future contributor, I want one shared dependency-graph module (parse, reconcile
    slash invocations, detect missing nodes and cycles, compute closure) reused by the
    linter, the install wizard, and the test-fixture builder, so that the graph has a
    single implementation to trust.

### Authoring conventions and linting

25. As a library author, I want one checkable definition of done — the portable Agent
    Skills floor plus this repo's layer — so that every skill meets the same bar and
    review feedback accumulates in predictable places.
26. As an agent choosing skills, I want every model-invoked skill's `description` to
    open with its triggering condition and state triggers only — never a workflow
    summary — so that I dispatch the skill instead of executing the summary.
27. As a library author, I want a frontmatter allowlist with an invocation axis
    (`disable-model-invocation` marking user-invoked skills), so that slash-only intent
    is machine-readable and a user-invoked skill can never be another skill's required
    dependency.
28. As a library author, I want a minimal required body skeleton with a canonical
    optional heading vocabulary, so that reviewers and the linter have stable anchors
    while thin skills carry no noise sections.
29. As a library author, I want progressive-disclosure limits (soft 200 body lines, hard
    500) with heavy reference material moved to flat UPPERCASE sibling files, so that
    skills stay small enough for a harness to load usefully.
30. As a library author, I want executable and copyable support material confined to
    role-named subdirectories (run / fill-in / copy-verbatim), so that any file's
    purpose is evident from where it sits.
31. As an agent executing a skill, I want skill bodies to name harness-agnostic actions
    rather than harness-specific tool names, so that one canonical tree serves every
    harness and channel byte-identically.
32. As a future contributor, I want an advisory two-tier linter — ERRORs for contract
    breaks, WARNs for style drift, default invocation always exiting 0 — so that I get
    complete feedback while authoring without a premature blocking gate.
33. As a library maintainer, I want the linter to WARN on README-inventory drift and on
    skills lacking a test-case directory, so that the inventory sync rule and test
    coverage have a standing automated nudge.

### Versioning and releases

34. As a library maintainer, I want to checkpoint the library with semver-shaped
    snapshot tags published as GitHub releases, so that good states have durable,
    installable names.
35. As a skill consumer on the native channel, I want plugin manifest versions to mirror
    the release tag, so that one number answers "what version is installed".
36. As a library maintainer, I want one release command that bumps the manifests,
    commits, tags, and creates the GitHub release — tolerating manifests that do not
    exist yet — so that manifest versions can never drift from the tag.
37. As a skill consumer, I want it explicit that tags carry no compatibility contract
    and that breaking-change detection lives in installer-time dependency validation, so
    that a version delta never gives me a false safety signal.
38. As a library author, I want the development and portable channels unaffected by
    releases (both keep tracking git), so that cutting a release never disturbs live
    links or managed installs.

### Testing and benchmarks

39. As a library author, I want one local command that projects a skill plus its full
    `## Required skills` closure unmodified into a disposable fixture shaped for a
    harness profile's discovery path, so that I can exercise the real deliverable
    without ever mutating canonical sources.
40. As a library author, I want headless drivers for all three supported harnesses
    (Claude Code, Codex, OpenCode), each running its own fixture against a scenario
    prompt, so that portability is verified rather than assumed.
41. As a library author, I want pass/fail to derive only from deterministic state
    assertions (filesystem, structured output, exact/containment/schema), so that a red
    run always means a real behavioral break, never stochastic noise.
42. As a library author, I want skill-selection evidence and LLM-judge rubric scores
    recorded as advisory signal that never gates, so that semantic quality accumulates
    as data without making pass/fail stochastic.
43. As a library author, I want the local test runner to be gating-capable (nonzero exit
    on assertion failure), so that I can wire it into my own local workflows even though
    CI never runs it.
44. As a library author, I want test cases kept central, keyed by skill name, outside
    the skill directories, so that skill directories stay pure deliverables and no test
    material ships to any install.
45. As a library maintainer, I want benchmarks to be paired trials — the same case with
    and without the skill installed, reporting the delta — so that I measure whether a
    skill actually helps rather than how well a model does anyway.
46. As a library maintainer, I want named `smoke` and `full` presets with only `full`
    summaries comparable and promotable, so that case authoring stays cheap while every
    recorded score sits on a known trial count.
47. As a library maintainer, I want every recorded summary to carry a required
    provenance identity set (timestamp, library snapshot, case id, preset, per-arm
    harness and model identity), so that no score ever circulates without the identity
    that makes it comparable.
48. As a library maintainer, I want per-run summary JSON committed and raw artifacts
    kept in a git-ignored local runs area, so that cross-snapshot trends survive in
    history while transcripts and fixture state never bloat or leak into it.
49. As a library maintainer, I want an advisory regression flag that fires only when a
    `full` run's with-skill pass rate falls at least two of five trials below baseline,
    so that a single stochastic failure is never disguised as a regression.
50. As a library maintainer, I want the cross-run baseline to be a `full` summary
    promoted explicitly by the release script, so that no run silently becomes the
    yardstick future comparisons rebase onto.
51. As a future contributor, I want a deterministic report generator that renders
    per-case markdown from committed summaries with no blended cross-case score, so that
    comparisons are reproducible anywhere at zero inference cost and weak cases are
    never hidden by a mean.

### CI and automation

52. As a future contributor, I want push/PR CI to run only the free static checks — the
    skill linter and the docs validator — and to fail only on linter ERRORs, so that red
    is always deterministic, instant, and free.
53. As a library maintainer, I want CI to hold no model API keys and no scheduled
    workflows, ever, so that inference cost and credential surface stay entirely local.
54. As a library author, I want "on-demand" testing to mean me invoking the local runner
    (smoke while authoring, full for recorded scores), so that when and how inference is
    spent is always a deliberate local choice.
55. As a library maintainer, I want the release script to warn — and proceed — when
    committed full-preset summaries are missing or stale at baseline-promotion time, so
    that staleness is surfaced without the release ritual ever wedging.

## Implementation Decisions

### Repository structure

Governed by [Organize the library around flat, skill-owned directories](/decisions/skill-library-structure.md).

- **Flat skill tree.** Canonical skills live directly in the top-level skills tree, one
  directory per skill — no category buckets, and no skill-count threshold that triggers
  them. Reorganization requires a fresh Decision motivated by real navigation pain.
- **Skill-owned support material.** Each skill owns its executable support material
  beneath its own directory. No top-level shared or templates area; a concrete second
  consumer triggers a new Decision, not automatic shared storage.
- **Two automation homes.** `scripts/` holds repository-operator entry points and
  workflow automation (the development installer, the docs validator, later the release
  script). `tools/` is reserved for developer infrastructure — the skill linter and the
  test/benchmark harness — and may legitimately be absent until that work lands.
- **README skill index + sync rule.** Root `README.md` is the public skill inventory and
  install entry point (one line per skill: name + purpose, plus install instructions for
  all three channels). Adding or removing a skill updates `README.md`; root `AGENTS.md`
  carries that synchronization rule, and `CLAUDE.md` delegates to it.
- **Knowledge home.** Explanatory truth (Decisions, conventions, glossary, references)
  lives in the `docs/` OKF bundle and is never copied into distributed skill payloads;
  executable truth outside `docs/` is referenced, not pasted.
- **Byte-exact contract material.** The okf-docs-setup asset payload is byte-exact
  contract material per the
  [byte-exact assets Convention](/okf-docs-setup/conventions/byte-exact-assets.md):
  copied verbatim into target repos, never regenerated or summarized, placeholders left
  unfilled in this repo, edited only to intentionally change the contract (keeping the
  validator test and the skill's manifest in sync). No platform work touches it.

### Distribution and installation

Governed by [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
(as amended 2026-07-10: whole-library development installs). Terms:
[Harness](/glossary/harness.md) (and harness profile).

One canonical authoring tree is delivered through exactly three channels — alternative
package shapes, not harness categories:

1. **Development links.** The `scripts/` installer becomes a development-only
   interactive wizard: choose harness types → choose or add one or more harness profiles
   per harness (independently configured harness instances identified by their
   configuration roots) → review an explicit installation preview → confirm. On confirm
   it validates the dependency graph (reusing the shared graph module; a missing node or
   cycle rejects the install), then symlinks **every** library skill from the working
   checkout so edits and `git pull` reach every linked profile live. No per-skill
   selection.
2. **Portable pure skills.** `npx skills@latest add artemVeduta/skills` is the supported
   package-like install. The upstream CLI owns skill/harness selection, project vs.
   global scope, its own storage, lock state, and `skills update`; it may target any
   harness it supports.
3. **Native aggregate plugins.** Codex and Claude Code each get a thin native manifest
   and marketplace entry packaging the complete skill tree as one plugin; the harness
   CLI owns install, caching, namespacing, enablement, and updates, per configuration
   root.

- A single harness profile must not install the library through both the pure-skill and
  native-plugin channels (duplicate namespaced/unnamespaced capabilities).
- **Declarative harness registry.** The wizard and the generated README install guidance
  share one declarative registry as their single source of truth. Per-entry shape:

  ```
  harness registry entry:
    id, displayName
    skillDirs: { project?, global? }        # where the harness supports them
    configRoot: env var | profile-discovery rules
    supported: { scopes, channels }
    customProfileValidation
  ```

  Adding an ordinary pure-skill harness is a registry-entry-plus-contract-tests change,
  never a new wizard branch; behavioral adapters exist only where native plugin
  operations need more than path metadata (Codex, Claude Code). Unknown profiles stay
  reachable via a custom configuration-directory option, validated per the entry.
- Wizard presentation is replaceable; selection and path resolution depend only on the
  registry, never on the terminal UI.
- **Update semantics stay separated by channel:** repository pull (development),
  `skills update` (portable), harness plugin updater (native).

### Skill dependencies

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
- **One shared graph module** implements parsing `## Required skills`, canonical-name
  enforcement, reconciling slash invocations against declarations, missing-node and
  cycle detection, and closure computation; the linter, the install wizard, and the
  test-fixture builder all reuse it rather than reimplementing the graph.
- Channel application: the development installer validates the graph then symlinks the
  whole library (no per-skill closure needed); aggregate plugins validate and package
  the whole tree; selective portable installs expand the closure — until the upstream
  `skills` CLI supports the convention, `--skill '*'` is the safe whole-library
  fallback.

### Skill authoring conventions and the linter

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
  `disable-model-invocation: true` marks a skill user-invoked — and therefore never a
  valid entry in another skill's `## Required skills`. Unknown keys (including
  `version:`) are linter WARNs.
- **Minimal skeleton.** Required: `## Overview`, exactly one author-named workflow
  section, plus `## Required skills` / `## Integration` where dependencies exist.
  Canonical optional headings, used verbatim when the ground is covered:
  `## When to Use`, `## Common Mistakes`, `## Quick Reference`; near-miss names are
  WARNs.
- **Progressive disclosure.** Past 200 body lines → WARN; past 500 → ERROR. Heavy
  reference material moves into flat UPPERCASE sibling files named for their content,
  linked by relative path; workflow steps stay inline.
- **Role-named support subdirs only:** run helpers, fill-in templates, copy-verbatim
  assets; other subdir names are WARNs.
- **Actions, not tools.** Bodies describe harness-agnostic actions ("dispatch a
  subagent"), never harness-specific tool names, so one canonical tree serves every
  channel.
- **Advisory two-tier linter** (developer infrastructure in `tools/`): ERRORs are
  contract breaks — frontmatter outside the allowlist, `name` ≠ directory, undeclared
  runtime `/skill-name` invocation, a required skill that is user-invoked, cross-skill
  filesystem paths, dependency cycles, body over 500 lines. WARNs are style drift —
  body over 200 lines, near-miss canonical headings, non-role-named subdirs, unknown
  frontmatter keys, README-inventory drift, and a skill with no central test-case
  directory. The default invocation always exits 0; a strict mode exits nonzero on
  ERROR presence for CI (see [CI and automation](#ci-and-automation)).

### Versioning and releases

Governed by [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md).

- The library is checkpointed with semver-shaped `vX.Y.Z` tags published as GitHub
  releases. A tag is a snapshot — **no compatibility contract**; breaking-change
  detection stays with installer-time dependency validation.
- Native plugin manifest versions mirror the tag: cutting a release bumps the Codex and
  Claude manifests to the tag's value (tolerating manifests that don't exist yet).
- A release script in `scripts/` owns the ritual — bump manifests, commit, tag, create
  the GitHub release — plus baseline promotion and the advisory staleness warning from
  the benchmark design (below).
- The development-symlink and portable channels are unaffected: both keep tracking git.

### Testing and benchmark harness

Governed by [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
(shape) and [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md)
(numbers). The harness is repo-owned, under `tools/`; Promptfoo and Harbor are named
deferred upgrade layers only.

- **Fixture builder.** Projects the canonical skill directory unmodified into a
  disposable fixture, including the transitive closure of `## Required skills` (via the
  shared graph module), shaped to each harness profile's discovery path. Sources are
  never mutated.
- **Headless drivers.** Each supported harness runs its own fixture through its headless
  CLI (Claude `-p`, Codex `exec`, OpenCode `run`) against a scenario prompt.
- **Deterministic oracle.** Pass/fail derives only from deterministic state assertions
  (filesystem, structured output, exact/containment/schema). Skill-selection evidence
  and LLM-judge rubric scores are recorded as advisory and never gate.
- **Gating-capable runner.** The local test runner exits nonzero on assertion failure —
  deliberately unlike the always-advisory docs validator and skill linter.
- **Central cases.** Cases live in central, skill-named case directories under the
  runner's home in `tools/` (scenario prompt + fixture inputs + expected-state
  assertions). Skill directories stay pure deliverables: no test material ships to
  installs.
- **Benchmarks are paired trials:** the same case with and without the skill installed,
  reporting the delta; additionally comparable across harnesses, release tags (trend
  only), and model ids.
- **Two presets:** `smoke` = 1 paired trial (wiring check); `full` = 5 paired trials —
  only `full` summaries are comparable and promotable to baseline. Every recorded score
  names its preset.
- **Regression flag (advisory):** a `full` run flags a case only when its with-skill
  pass rate falls ≥ 2-of-5 trials below baseline; a single stochastic failure never
  flags.
- **Retention:** per-run summary JSON (scores, per-trial marks, deltas, flags,
  provenance, preset) is committed; raw artifacts (transcripts, fixture state,
  per-assertion results) go to a git-ignored runs area under `tools/`.
- **Baselines:** the cross-run baseline is a `full` summary promoted explicitly by the
  release script; the within-run baseline is the fresh without-skill arm of the same
  run.
- **Provenance — required identity set** on every recorded summary:

  ```
  provenance:
    timestamp (ISO)
    library: commit SHA + dirty flag (+ release tag when on one)
    case: skill + case name
    run: preset + trial count
    per arm: harness name + version, model id
  ```

  Resource-usage fields (tokens, durations, cost) are optional extras.
- **Reporting:** a deterministic generator renders per-case markdown from committed
  summaries (per-trial marks, with/without pass rates, delta, regression flag, advisory
  judge scores). No blended cross-case score exists.

### CI and automation

Governed by [CI and automation wiring](/decisions/ci-and-automation-wiring.md).

- Push/PR CI runs only the free static checks — skill linter + docs validator — and
  fails **only** on linter ERRORs; WARNs and all docs-validate output surface as
  advisory.
- **No inference in CI, ever:** per-skill cases, per-harness contract tests, and
  benchmarks run only locally via the `tools/` runner; CI holds no model API keys and
  has no scheduled workflows. "On-demand" means the developer invoking the local runner.
- **Release-time staleness guard (advisory):** before promoting the baseline, the
  release script verifies committed full-preset summaries exist and match the current
  commit or a recent ancestor; if missing or stale it warns and proceeds — the ritual
  never wedges.

## Testing Decisions

The platform's highest-value seams are its three CLIs, fixed by the
[testing-architecture](/decisions/skill-testing-architecture.md) and
[CI-wiring](/decisions/ci-and-automation-wiring.md) Decisions. A good test asserts only
external behavior at one of these seams — exit codes, emitted findings, and produced
artifacts — never internals:

1. **The skill-linter CLI.** Its default invocation always exits 0 and prints two-tier
   ERROR/WARN findings; its strict mode derives a nonzero exit from ERROR presence.
   Tests exercise every ERROR and WARN class against fixture skill trees and assert the
   classification and exit codes. This is the only gate CI ever has.
2. **The test-runner CLI** (developer infrastructure in `tools/`). Tested at the runner
   boundary: the fixture builder produces a fixture containing the skill plus its full
   dependency closure with canonical sources verifiably unmodified; each headless
   harness driver (Claude `-p`, Codex `exec`, OpenCode `run`) runs its own fixture; the
   deterministic state assertions (filesystem, structured output) alone decide pass/fail
   and the exit code. The runner is gating-capable locally and never runs in CI.
3. **The release-script CLI.** Tested on exit behavior and produced artifacts: manifest
   versions bumped to the tag value (tolerating absent manifests), commit + tag +
   release created in one invocation, baseline promotion of a chosen full-preset
   summary, and the advisory staleness warning that never blocks the ritual.

Cross-cutting rules for good tests here:

- Skill-selection evidence and LLM-judge scores are advisory signal in recorded output;
  no test may gate on them.
- Deterministic components (linter, graph module, fixture builder, report generator,
  release script plumbing) get cheap unit tests; only the runner's end-to-end path
  spends inference, and only locally.
- The report generator must be reproducible: identical markdown from identical committed
  summaries.
- Registry entries carry contract tests for their paths and selection rules, so adding a
  harness is testable without touching wizard code.

Prior art in this codebase: the docs validator's test suite
(`scripts/validate-docs.test.mjs`) — Node's built-in `node --test` runner, zero external
dependencies, asserting the CLI's external behavior over fixture inputs. New platform
tests follow that pattern.

## Out of Scope

- **Promptfoo and Harbor** are named deferred upgrade layers only; adopting either is an
  amendment to the testing-architecture Decision, not part of this build.
- **Inference in CI** in any form: per-skill test cases, per-harness contract tests, or
  benchmarks in Actions; model API keys in CI secrets; scheduled workflows;
  `workflow_dispatch` test triggers.
- **Compatibility contracts across release tags** — structural/strict semver, per-skill
  `version:` keys, changelog/changeset machinery. Tags stay no-contract snapshots.
- **Category buckets, shared asset/template directories, and cross-skill filesystem
  links** — each requires a fresh Decision motivated by concrete pain, and none is part
  of this platform.
- **Upstream `skills` CLI dependency support.** Making the upstream portable CLI parse
  `## Required skills` is out of this repo's hands; until it lands, `--skill '*'` is the
  documented whole-library fallback and selective portable installs cannot claim
  enforced closure.
- **Restructuring the okf-docs-setup byte-exact asset payload** or shipping any test
  material inside skill directories.
- **A blended cross-case benchmark score** or any gating use of LLM-judge output.
- **Per-harness wizard code branches** for harnesses expressible as registry data.

## Further Notes

Implementer-owned gaps deliberately left to the build effort; none reopens a decision:

- The current development installer must be rebuilt to the target wizard: its directory
  discovery predates the flat skill tree, it has no dependency-graph validation, and its
  hard-coded target menu predates the registry/profile model. Revise
  [/specs/install-sh.md](/specs/install-sh.md) when the new installer lands, per the
  precedence note above.
- The harness-neutral shared skills directory is both a development symlink target and
  the portable CLI's own storage; the installer should call out (or refuse) mixing
  channels there.
- The exact `scripts/`↔`tools/` invocation boundary (how the release script locates the
  runner's committed summaries), the staleness guard's "recent ancestor" matching rule,
  the report generator's summary-selection scope, and the release script's preconditions
  (clean tree, branch, pre-flight checks) are implementation details.
- Once `tools/` exists, extend the `.claude` docs-maintenance rule's source glob to
  cover it.
- The linter's strict mode may be a flag or an output parse in CI — an implementation
  detail of the `tools/` linter, so long as the default invocation stays advisory
  (exit 0).
