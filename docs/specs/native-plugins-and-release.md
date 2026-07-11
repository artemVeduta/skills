---
type: Specification
title: Native aggregate plugins & release script
description: Implementation contract for the Codex and Claude Code native plugin manifests, their marketplace catalogs, and the scripts/release.mjs snapshot-release ritual.
timestamp: 2026-07-11
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

Before the ritual, the script checks for committed full-preset benchmark
summaries under `tools/benchmarks/summaries/`; when absent it warns and
proceeds. Baseline promotion and full-preset/recent-ancestor matching arrive
with the benchmark harness.

## Resolved implementer gaps

From the platform PRD "Further Notes": the release-script preconditions
(git work tree, non-detached branch, clean tree unless `--force`, `gh`
installed + authenticated), the `scripts/`↔`tools/` boundary (the release
script reads `tools/benchmarks/summaries/`), and the day-one staleness
behavior (existence-only, warn-and-proceed) are fixed here. The benchmark
ticket owns baseline promotion and the summary format.
