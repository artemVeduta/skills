---
type: Specification
title: Native aggregate plugins & release script
description: Implementation contract for the Codex and Claude Code native plugin manifests, their marketplace catalogs, and the scripts/release.mjs snapshot-release ritual.
timestamp: 2026-07-25
---

# Native aggregate plugins & release script

Implements the "Distribution and installation" (native channel) and
"Versioning and releases" sections of the
[platform PRD](/specs/skills-platform.md); governed by
[Use three skill distribution channels](/decisions/skill-distribution-channels.md)
and [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md).
Terms: [harness](/glossary/harness.md), [skill](/glossary/skill.md).

## Manifest contract

The repository root is the plugin; the flat `skills/` tree is its payload. Four
hand-authored manifests live at the repo root:

- `.claude-plugin/plugin.json` — Claude Code plugin manifest. `skills/` is
  auto-discovered; skills namespace as `/skills:<skill>`.
- `.claude-plugin/marketplace.json` — Claude Code marketplace catalog; one
  plugin, `source: "./"`. The plugin entry carries no version.
- `.codex-plugin/plugin.json` — Codex plugin manifest; `skills: "./skills/"`.
- `.agents/plugins/marketplace.json` — Codex marketplace catalog; one plugin,
  repo-root source. Not the legacy `.claude-plugin/marketplace.json`, which
  would collide with the Claude catalog.

Marketplace id `artemveduta`, plugin id `skills`; installs read
`skills@artemveduta`.

The manifests stay hand-authored, but those ids and the documented install/update
operations have exactly one definition, and it lives in the harness registry:
`scripts/install/registry.mjs` → `MANAGED_PACKAGE` (repo slug, plugin id, marketplace id)
plus `nativeCommands()` over each entry's native adapter (CLI, install and update verbs,
manifest paths, namespacing). The generated README native block renders that one
definition (`scripts/install/readme.mjs` → `renderNativeSection()`), and
`scripts/manifests.test.mjs` verifies it against the committed manifests — so guidance,
manifests, and tests cannot drift apart. OpenCode carries no native adapter, and the
absence of native OpenCode packaging is asserted rather than merely unmentioned. The
native cells are additionally gated as advertised == proven by the acceptance matrix (see
[/decisions/skill-testing-architecture.md](/decisions/skill-testing-architecture.md)).
`.codex-plugin/plugin.json` also carries a display `interface` block, used for
presentation only.

## Version mirroring

The `version` field of both `plugin.json` files is bare semver `X.Y.Z` and
mirrors the release tag `vX.Y.Z`. The two versions are always equal. Marketplace
catalogs hold no plugin version.

## Release ritual

`scripts/release.mjs <vX.Y.Z> [--dry-run] [--force]` bumps both `plugin.json`
versions (tolerating an absent manifest), commits `Release <tag>`, creates an
annotated tag, pushes branch + tag, and creates a GitHub release. It is
idempotent on an existing tag/release and previews everything under `--dry-run`.
The development-symlink and portable channels are unaffected.

## Staleness guard (advisory)

Before the ritual, the script checks only whether `tools/benchmarks/summaries/`
holds any committed summary; when the directory is absent or empty it warns and
proceeds (`scripts/release.mjs` → `checkBenchmarkStaleness()`). The benchmark
harness has since shipped and writes its summaries into that same directory
(`tools/benchmarks/run.mjs`), so the guard now reads real output. Baseline
promotion, full-preset selection, and recent-ancestor matching are not awaiting
the harness: they are deferred by the 2026-07-16 amendment to the
[benchmark-metrics Decision](/decisions/benchmark-metrics-and-comparison-design.md),
which leaves this guard existence-only until a comparison arm makes a baseline
mean something.

## Resolved implementer gaps

From the platform PRD "Further Notes": the release-script preconditions
(git work tree, non-detached branch, a configured `origin` remote, clean tree
unless `--force`, `gh` installed + authenticated — `scripts/release.mjs` →
`preflight()`), the `scripts/`↔`tools/` boundary (the release script reads
`tools/benchmarks/summaries/`), and the existence-only, warn-and-proceed
staleness behavior are fixed here. That last was framed as day-one behavior; with
baseline promotion deferred it is the standing behavior. The benchmark work owns
the summary format.
