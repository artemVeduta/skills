---
type: Decision
title: Separate OKF documentation skills by lifecycle responsibility
description: Make docs-setup, docs-add, docs-validate, docs-sync, and docs-autoresearch distinct portable skills with one canonical library home and non-overlapping responsibilities.
timestamp: 2026-07-24
---

# Separate OKF documentation skills by lifecycle responsibility

## Context

The v1 `okf-docs-setup` skill owns setup, project-local helper-skill copies,
conversion, and validation guidance. That package shape duplicates `docs-add` and
`docs-validate` into every configured repository, couples updates to setup reruns, and
blurs installation with ongoing semantic maintenance.

The v2 suite needs one canonical copy of every workflow, conservative tooling upgrades,
and explicit ownership for authoring, validation, reconciliation, and research.

## Decision

The suite consists of five top-level library skills:

- `docs-setup` installs, upgrades, or repairs repository-carried machinery and wiring.
  It is the full replacement for `okf-docs-setup`; the old identity receives no alias,
  forwarding stub, or deprecation period.
- `docs-add` creates one approved OKF concept, including its index and lifecycle entry.
  Its templates are self-relative and live only with the canonical skill.
- `docs-validate` runs and interprets the repository's package-manager-neutral
  `docs:validate` command. It contains no validator implementation.
- `docs-sync` reconciles semantic knowledge with repository state, including concept
  creation, shared bookkeeping, and branch-local compaction.
- `docs-autoresearch` performs explicit, bounded research and files approved results.

`docs-setup` declares `docs-add` and `docs-validate` as required skills, but installs no
project-local skill copies. Repository machinery remains repository-carried: the bundle
skeleton, validator and tests, package scripts, the marked `AGENTS.md` router, the
one-line `CLAUDE.md` shim, and deletion-safe Claude rule pointers.

Setup never performs semantic reconciliation. It may recommend a later `docs-sync`
session, but does not invoke it, rename project concepts, compact history, relocate
artifacts, or rewrite evolving indexes and logs during an upgrade.

Every setup run derives its plan from current repository state. It stores no suite
version file and bundles no v1 snapshot. Mandatory read-only workers audit independent
managed surfaces; the coordinator consolidates one fresh/upgrade/repair dry run; the
user approves the complete plan; one deterministic writer applies it; and a fresh
verifier checks preservation, tests, validation, and idempotency. Existing differing
managed files are treated as customized until reviewed. Upgrade is clean-worktree by
default, and setup never stages, commits, pushes, or discards.

## Alternatives

- **Keep helper skills nested in setup.** Rejected because every project receives
  drifting copies and updates require setup to own another workflow's lifecycle.
- **Keep one all-purpose skill.** Rejected because installation, concept authoring,
  validation, synchronization, and research have different authorization and failure
  boundaries.
- **Retain an `okf-docs-setup` compatibility alias.** Rejected because two canonical
  identities would persist across inventories, dependencies, reports, and harness
  namespaces.
- **Let setup invoke synchronization automatically.** Rejected because a tooling
  upgrade should not silently broaden into semantic edits.
- **Track installed suite versions and replay v1 migrations.** Rejected because local
  customization makes recorded version an unreliable substitute for inspecting actual
  state.
- **Blindly overwrite managed paths.** Rejected because repository-carried policy and
  wiring may contain intentional local guidance.
- **Use parallel setup writers.** Rejected because machinery, package integration, and
  project memory are shared surfaces whose partial ordering must remain deterministic.

## Consequences

- The library, README inventory, dependency graph, tests, reports, distribution
  metadata, docs subsystem, and installed links migrate completely to `docs-setup`.
- v1 project-local copies of `docs-add` and `docs-validate` are removed only after
  canonical library discovery and explicit conflict resolution.
- Each skill can evolve and be tested at its own responsibility boundary.
- Repositories need the complete library pack available before setup wiring can refer
  imperatively to the canonical skills.
- Conservative upgrades cost an audit and approval round, but preserve local
  customization and make an already-current rerun a provable no-op.

## Amendments

<!-- Append dated entries; never rewrite accepted history. -->
