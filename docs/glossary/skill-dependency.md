---
type: Glossary
title: Skill dependency
description: A runtime requirement that permits one skill to rely on another skill being available.
timestamp: 2026-07-25
---

# Skill dependency

A **skill dependency** is a directed runtime requirement from a dependent skill to
another skill. The dependent skill may assume that dependency is available when it
runs.

Every supported distribution channel delivers the complete pack, so a dependent skill's
closure is present by construction rather than by per-skill selection (see
[/decisions/okf-docs-portability-and-distribution.md](/decisions/okf-docs-portability-and-distribution.md)).
An installer must still reject the installation when any required dependency cannot be
satisfied or when the dependency graph contains a cycle (`scripts/install/graph.mjs` →
`validateGraph`); closure resolution itself stays live where a genuine subset is
projected — the test runner's fixture builder (`tools/test-runner/fixture.mjs`). Bypassing
resolution must be an explicit, visibly unsafe operation rather than an implicit effect
of selecting a named skill.

The dependent skill declares dependencies in a dedicated `## Required skills` section
of its `SKILL.md`. Each entry is a plain canonical skill name without a slash, such as
`domain-modeling`. The section is the machine-readable source of truth for dependency
resolution. Runtime instructions invoke the dependency using its slash name, such as
`/domain-modeling`, rather than an installation path, because harnesses place skills
differently.

A separate `## Integration` section explains each dependency's role. Its *presence* is
required and machine-checked whenever `## Required skills` is non-empty
(`tools/lint-skills.mjs` → `lintDependencies`); its prose is never parsed. Explicit
relationship labels — **Required sub-skill**, **Required background** — are the prescribed
authoring convention inside it, upheld by review rather than by the linter. Every runtime
`/skill-name` invocation must match an entry in `## Required skills`. Installers parse only
`## Required skills`.
Cross-skill filesystem paths are forbidden, and non-invoking comparisons use plain names
without a slash.

Used in: [Skill](/glossary/skill.md)
