---
type: Decision
title: Reconcile OKF knowledge by accepted state, not editing residue
description: Make executable sources authoritative for current behavior and use docs-sync to preserve accepted history while compacting branch-local churn.
timestamp: 2026-07-25
---

# Reconcile OKF knowledge by accepted state, not editing residue

## Context

Write-time discipline kept many concept bodies accurate, but per-edit timestamps,
indexes, logs, amendments, and temporary design artifacts accumulated or were skipped.
Copying current configuration values into docs created another authority whose drift
checks could themselves rot.

The suite needs one lifecycle that works for both small fixes and large branches,
preserves meaningful accepted history, and keeps operational exhaust out of durable
knowledge without naming any third-party tool.

## Decision

Code, tests, and configuration are authoritative for current behavior and values. The
bundle is authoritative for intent, terminology, constraints, rationale, and accepted
decision history. Live concept sections cite stable code symbols by backticked name and
do not copy current values. Dated accepted Decision history may retain historical
values. The suite adds no constant-sync checker and imposes no code-comment back-link
style.

Bundle membership, exclusions, naming, and semantic splitting are governed by
[Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md).

Whoever changes behavior updates the affected concept bodies in the same working step.
That obligation stands on its own. `docs-sync` is an **optional, user-invoked-only**
reconciliation workflow offering two modes. It is never selected implicitly and is not
tied to any lifecycle stage; the user chooses when its fanout cost is justified:

- **Branch sync** compares the selected target branch's common ancestor with the full
  current working state and reconciles only branch-affected knowledge.
- **Bundle-wide reconciliation** audits the whole bundle against the current
  repository and repairs all discovered semantic and bookkeeping drift.

Both modes use dynamic read/write fanout over disjoint concepts, one reconciler for
shared indexes, logs, and timestamps, a fresh verifier, and deterministic validation.
They edit the working tree only.

Ordinary sync invocation authorizes concept creation and non-destructive reconciliation.
Migrating existing ad-hoc sources adds a read-only classification proposal and explicit
approval before any source is moved or deleted. This migration is a `docs-sync`
responsibility, never a setup side effect.

Only drafting after the selected merge base is compacted to the canonical net state.
Target-side dated amendments, historical rationale/value facts, and lifecycle entries
remain protected while canonical live sections may receive ordinary refinements. A
dated value fact introduced by the accepted branch survives without its intermediate
draft heading in the canonical Context or Consequences prose. Branch-local lifecycle
entries for one concept collapse to one semantic `Creation`, `Update`, or `Deprecation`
entry; no operational “sync ran” entry is written. Changing the selected alternative,
ownership boundary, hard constraint, or material consequences requires user
confirmation and a replacement Decision that supersedes the old one.

## Alternatives

- **Docs as authority for current values.** Rejected because executable behavior can
  change independently and requires a second synchronization mechanism.
- **Validate copied constants against code.** Rejected because value shapes and
  locations vary, while the checker becomes another stale copy.
- **Append one amendment and log item per edit.** Rejected because it preserves drafting
  residue rather than accepted semantic history.
- **Rewrite all history to latest state.** Rejected because an accepted or implemented
  architectural choice remains important after reversal.

## Consequences

- The project router requires applicable concepts before non-trivial work and content
  changes with affected source. `docs-sync` is optional and user-invoked only — never
  required before source-changing work concludes, and never invoked automatically from
  implementation, review, validation, pull-request preparation, or inferred intent.
- Quick fixes and long feature branches use the same lifecycle.
- Direct `docs-add` keeps its approval gate; invoking `docs-sync` authorizes all
  in-scope reconciliation, including concept creation.
- Temporary drafts are user-owned and removed before sync; ambiguous outside-bundle
  Markdown blocks automatic filing rather than being silently deleted.
- The retired `**Noted**` marker is not a debt queue: branch-unrelated drift is reported
  in branch mode and repaired only in bundle-wide mode.

# Amendments

<!-- Append dated entries; never rewrite accepted history. -->

## 2026-07-25 — The finish-time docs-sync obligation is removed

Issue #65 removes the mandatory finish-time `docs-sync` obligation from this Decision, and
the Decision and Consequences above are edited in place to match. Two sentences are removed;
both are quoted here verbatim so the accepted history stays recoverable from the Decision
itself. The Decision dropped the framing sentence "`docs-sync` owns finish-time
reconciliation through two modes:" — introducing the Branch sync / Bundle-wide
reconciliation bullets, which remain unchanged — and now instead reads that `docs-sync` is an
**optional, user-invoked-only** reconciliation workflow offering the same two modes, never
selected implicitly and never tied to a lifecycle stage. The Consequences bullet dropped its
closing clause "and `docs-sync` before source-changing work concludes" and now instead states
that `docs-sync` is optional and user-invoked only, never required before source-changing
work concludes, and never invoked automatically from implementation, review, validation,
pull-request preparation, or inferred intent.

The removed router clause was already false when it was removed. The shipped router asset
`skills/docs-setup/assets/agents/documentation-block.md` has never carried a `docs-sync`
clause, and neither has this repository's own installed root `AGENTS.md`; both state only
the two obligations that remain. Code is authoritative for current behavior, so the
Consequence was describing a surface that does not exist. Removing it corrects the record
rather than narrowing a live guarantee.

**Amended rather than superseded, deliberately.** The rule above requires "user
confirmation and a replacement Decision that supersedes the old one" for a change to the
selected alternative, an ownership boundary, a hard constraint, or material consequences.
Issue #65 is the user confirmation, and it instructs this removal in place. The change is a
**narrowing of one obligation**, not a reversal of the selected alternative: executable
sources remain authoritative for current behavior, the bundle remains authoritative for
intent and accepted history, both sync modes survive with their scopes unchanged, and the
write-time rule that whoever changes behavior updates the affected concepts in the same
working step is untouched and now stands alone. Superseding would fragment accepted
rationale across two Decisions for a narrowing that reverses nothing, so this dated entry
carries the change and the reasoning instead.

Also settled by the same issue: `docs-setup` and `docs-sync` both declare user-only
invocation metadata, and setup never triggers sync — see
[/decisions/okf-docs-skill-boundaries.md](/decisions/okf-docs-skill-boundaries.md).

## 2026-07-25 — One approval per filing plan, across the suite

The Consequences above state that direct `docs-add` keeps its approval gate and that
invoking `docs-sync` authorizes in-scope reconciliation. The general rule the pair implies
is now explicit: a complete filing plan is gated exactly once. When a parent workflow —
`docs-sync`, `docs-autoresearch`, or a setup run — has already presented an equivalent
complete plan (frontmatter, body, path, local-index entry, lifecycle entry) and received
explicit approval, that approval satisfies `docs-add`, and the child does not re-gate the
same plan. Reuse requires equivalence: a plan the parent never presented is not covered.
The rule is stated at the point of use in `skills/docs-add/SKILL.md` ("Approval reuse"). No
authorization is widened — only double-gating is removed.
