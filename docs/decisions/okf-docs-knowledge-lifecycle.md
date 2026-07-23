---
type: Decision
title: Reconcile OKF knowledge by accepted state, not editing residue
description: Make executable sources authoritative for current behavior and use docs-sync to preserve accepted history while compacting branch-local churn.
timestamp: 2026-07-24
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
`docs-sync` owns finish-time reconciliation through two modes:

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

- The project router requires applicable concepts before non-trivial work, content
  changes with affected source, and `docs-sync` before source-changing work concludes.
- Quick fixes and long feature branches use the same lifecycle.
- Direct `docs-add` keeps its approval gate; invoking `docs-sync` authorizes all
  in-scope reconciliation, including concept creation.
- Temporary drafts are user-owned and removed before sync; ambiguous outside-bundle
  Markdown blocks automatic filing rather than being silently deleted.
- The retired `**Noted**` marker is not a debt queue: branch-unrelated drift is reported
  in branch mode and repaired only in bundle-wide mode.

## Amendments

<!-- Append dated entries; never rewrite accepted history. -->
