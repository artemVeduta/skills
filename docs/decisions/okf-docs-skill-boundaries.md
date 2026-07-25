---
type: Decision
title: Separate OKF documentation skills by lifecycle responsibility
description: Make docs-setup, docs-add, docs-validate, docs-sync, and docs-autoresearch distinct portable skills with one canonical library home and non-overlapping responsibilities.
timestamp: 2026-07-25
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

# Amendments

<!-- Append dated entries; never rewrite accepted history. -->

## 2026-07-25 — User-invoked-only setup and sync, enforcement ownership, and the retired Claude adapter

Issue #65 sharpens four boundaries the Decision above left open, and corrects one
repository-machinery item that is no longer shipped. The five-skill split, the
one-canonical-copy rule, the no-project-local-helper-copies rule, and the conservative
audit → classify → approve → write → verify workflow are all unchanged.

**`docs-setup` and `docs-sync` are user-invoked-only.** Both declare the platform's
user-only invocation metadata (`disable-model-invocation: true` in their frontmatter), and
their `description` fields must not authorize implicit selection — each now opens by saying
so. Neither is ever invoked automatically: not from implementation, review, validation,
pull-request preparation, or inferred natural-language intent. The Decision already rejected
"Let setup invoke synchronization automatically"; this extends the same reasoning to the
agent's own selection of either skill, because both are repository-wide and expensive.

**`docs-setup` owns two responsibilities this Decision did not name.** First, repository
validation **enforcement** — its discovery, planning, installation, upgrade, and
verification — while `docs-validate` owns running and interpreting the strict command
([/decisions/okf-docs-strict-validation.md](/decisions/okf-docs-strict-validation.md)).
Second, **versionless retired-surface convergence**: setup derives a complete plan from the
current managed surfaces, durable retired-surface tombstones, historical fingerprints or
managed markers, and actual repository state, and it neither reads nor writes an installed
suite-version marker. Proven obsolete managed surfaces become removals in the normal plan;
customized or uncertain ones become conflicts needing an explicit keep/remove decision;
missing ones are no-ops. Evolving OKF knowledge is never a cleanup target. Both contracts
are stated at the explanatory level in
[/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md).

**"Deletion-safe Claude rule pointers" are no longer repository-carried machinery.** The
Decision's machinery list ends with them; the Claude-only docs-authoring adapter is retired
from the suite contract and its asset no longer exists under
`skills/docs-setup/assets/`. Portable project memory — the marked `AGENTS.md` router — plus
the lifecycle Convention are the required documentation-policy surfaces on every supported
harness ([/decisions/okf-docs-portability-and-distribution.md](/decisions/okf-docs-portability-and-distribution.md)).
The retired path stays in scope as a **tombstone**, not as a delivered surface. The rest of
the machinery list is unchanged.

**The two-stage upgrade order is explicit.** Explicit `docs-setup` converges managed
installation surfaces and the minimal policy substrate (the seed lifecycle Convention, the
OKF reference, and the marked router, upgraded conservatively so a later migration has
current rules to follow). Optional, explicitly invoked bundle-wide `docs-sync` then performs
semantic migration. **Setup never triggers sync** — it may recommend it, exactly as the
Decision already says. Skipping the second stage leaves a current installation over a legacy
or validation-failing bundle: an allowed state that must be reported accurately.

## 2026-07-25 — Where docs-autoresearch's defaults, mechanics, and safety floor each live

The decision above gives `docs-autoresearch` one responsibility line and left its internal
ownership unrecorded. The shipped skill splits it in two, and the split is load-bearing.
`skills/docs-autoresearch/RESEARCH-DEFAULTS.md` is the single home of every tunable default
value and of default research policy; `skills/docs-autoresearch/SKILL.md` owns the fixed
mechanics — orchestration, round barriers, fanout, safety, failure behavior, and filing. A
repository may add `docs/conventions/research.md` lazily through `docs-add` to carry
deviations only: it may refine objectives, source preferences, confidence definitions,
freshness, exclusions, and output style, and it may *lower* a budget, but it can never
raise one past a hard ceiling nor override fixed mechanics or the safety floor. A missing
override falls back to the shipped defaults and is announced; an invalid one falls back
field by field with every rejected value reported and every valid setting preserved;
missing or unreadable shipped defaults are a corrupt installation and stop the run.

The safety floor is part of the boundary, not an implementation detail. Research workers
are read-only and cannot delegate, and the coordinator is the sole writer. Fetching is
limited to user-supplied or search-discovered public HTTP(S) URLs, rejecting
credential-bearing URLs, localhost, private/link-local/metadata destinations, and
unvalidated redirects. Fetched content is untrusted data: its instructions are never
followed and its code never executed, secrets and private or personal material never enter
a query, and only summaries and citations persist — never raw bodies. Nothing above is
reversed; this records the ownership the responsibility line assumed.
