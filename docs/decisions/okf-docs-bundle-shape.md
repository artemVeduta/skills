---
type: Decision
title: Keep a tool-neutral docs bundle with specs as the canonical section
description: Retain docs/ and specs/, classify content by durable purpose, and validate every retained Markdown concept without tool-specific exclusions.
timestamp: 2026-07-25
---

# Keep a tool-neutral docs bundle with specs as the canonical section

## Context

OKF does not prescribe a bundle-root name, while this repository and live installs
already carry extensive `docs/` references in instructions, code, persisted state, and
path-scoped rules. Renaming the root to distinguish durable knowledge from workflow
scratch would impose a large, partly invisible migration without improving conformance.

The v1 suite also hardcodes a third-party `docs/superpowers/**` exclusion and contains
one `specifications/` wiring drift despite `specs/` being the repository and ecosystem
convention.

## Decision

The bundle root remains `docs/` and the canonical Specification directory name is
`specs/`.

The suite is tool-neutral. It names no third-party workflow and provides no
tool-specific or configurable excluded subtree. Every retained non-reserved Markdown
file below `docs/` is a concept and validates uniformly.

Bundle membership is determined by durable purpose, not producer or path. Content
intentionally retrieved later to understand the project belongs in the bundle;
operational output and temporary workflow material do not. Each repository owns the
storage and cleanup of material outside the bundle.

Conceptual identity, not size, decides splitting. A 300-physical-line candidate prompts
explicit semantic review but creates no limit or warning; a bounded event report remains
atomic when splitting would destroy its context.

Existing repositories may migrate `specifications/` to `specs/` on their own schedule
through semantic reconciliation. Setup never renames it as a tooling side effect.

## Alternatives

- **Rename the root to `wiki/`.** Rejected because OKF gives no conformance benefit and
  the migration would break plain-text paths, persisted state, code constants, and
  path-scoped rules that link checking cannot discover.
- **Keep a named third-party exclusion.** Rejected because the suite must work for
  repositories that never use that tool.
- **Add a generic ignore mechanism.** Rejected because retained content would cease to
  have one uniform contract and false-negative validation would become project policy.
- **Use `specifications/`.** Rejected because `specs/` is already canonical locally and
  across the surveyed ecosystem.

## Consequences

- Temporary Markdown placed under `docs/` must be removed or normalized before the
  publishable bundle validates cleanly.
- Open-taxonomy generated concepts are valid bundle members and receive the same
  frontmatter, index, link, and lifecycle checks as human-authored concepts.
- Migration tooling distinguishes an optional semantic content move from setup's
  repository-machinery responsibilities.
- The validator removes its hardcoded exclusion and no suppression replacement ships.

# Amendments

<!-- Append dated entries; never rewrite accepted history. -->

## 2026-07-25 — Length is not a deletion reason either

"Conceptual identity, not size, decides splitting" already settles that **line count alone
never mandates a split**, and "creates no limit or warning" already forbids a threshold. One
half was left unstated: length is not a reason to **delete** a concept either. A long concept
stays whole and stays in the bundle when it is cohesive; only **redundancy** — a durable fact
that a focused concept already owns — or genuinely **independent lifecycles** justify
splitting or removing one.

This is recorded because issue #65 removed two long Specifications and must not be read as a
length precedent. They were removed after a section-level coverage audit proved their durable
content was owned elsewhere, and in the same change a long cohesive `Decision`
([/decisions/skill-testing-architecture.md](/decisions/skill-testing-architecture.md)) was
explicitly retained with its amendments precisely because it is not redundant. The
300-physical-line figure stays what it was: a cue for explicit semantic review, never a
limit, never a warning, never an automatic split, and never a deletion rule.
