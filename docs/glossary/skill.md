---
type: Glossary
title: Skill
description: A directory-rooted capability bundle defined by a SKILL.md entry file — the unit this library stores, versions, and distributes to agent harnesses.
timestamp: 2026-07-10
---

# Skill

A **skill** is a self-contained capability bundle for an agent [harness](/glossary/harness.md):
a directory whose root holds a `SKILL.md` entry file (instructions the harness loads),
optionally alongside supporting material such as templates, scripts, or an `assets/`
tree. The `SKILL.md` at the directory root *defines* the skill; a nested `SKILL.md`
deeper inside (e.g. under `assets/`) is a child of its parent skill, not a skill of
its own.

The skill is this repository's unit of storage and distribution: skills live at
`skills/<name>/` (flat, no buckets) and are delivered to harnesses either by
symlinking the skill directory into a harness skill directory (see
[/specs/install-sh.md](/specs/install-sh.md)) or, for `docs-setup`, by the skill
itself copying its assets into a target repository (see
[/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md)).

Used in: [/specs/install-sh.md](/specs/install-sh.md),
[/docs-setup/index.md](/docs-setup/index.md),
[/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md).
