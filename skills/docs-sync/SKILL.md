---
name: docs-sync
description: Use when source or docs work on a branch is wrapping up and the OKF docs/ bundle must be reconciled with it — "sync the docs", "reconcile docs with my branch", "bring the bundle up to date before I merge", "the docs are stale after this work", "make the docs match the code I changed". Covers branch-scoped reconciliation from a target branch's merge-base through the whole working state. Not for adding one concept (docs-add), running the validator (docs-validate), or standing up the machinery (docs-setup).
---

# docs-sync

## Overview

Reconciles an OKF v0.1 `docs/` bundle with the change a branch introduced: it
updates every concept the branch affected to the current repository state, does the
index/log/timestamp bookkeeping once, verifies the result, and runs the strict
validator — all in the working tree only, touching no Git state.

**Core principle:** _Ask the mode and target first, recompute scope from the
merge-base every run, reconcile only what the branch touched, write each concept
once through a disjoint owner, and never guess through a contradiction._ Reconciliation
is recomputed from a fixed boundary on every run, so a second sync from the same
boundary is a no-op — the flow is idempotent.

This skill covers **branch sync**. Bundle-wide reconciliation is a separate mode and
the existing-source migration subflow is a separate gated flow; neither is part of this
branch-scoped flow.

## Required skills

- docs-validate

The validator is the target repository's own; docs-validate runs it and interprets the
strict exit. docs-sync depends on it by canonical name — it must be discoverable at run
time. New concepts are filed following the bundle's lifecycle policy the same way the
docs-add skill files one; sync's own invocation authorizes that creation (see Boundaries).

## When to Use

- "Reconcile the docs with this branch", "sync the bundle before I merge", "the
  Specifications are stale after my change", "update the ADRs/glossary for this work".
- As the closing step of any branch that changed source or docs, before the work
  concludes — so the explanatory truth ships current with the code.
- NOT for filing one brand-new concept in isolation (that is docs-add), interpreting a
  validator run (docs-validate), or installing/repairing the machinery (docs-setup).

## First: ask for the mode and the target branch — write nothing yet

**MANDATORY gate. No file is written, and no worker is dispatched to write, until the
user has selected the sync mode AND (for branch sync) a target branch.**

1. Ask which **mode**: branch sync or bundle-wide reconciliation. Assume neither.
2. For branch sync, ask for the **target branch** every run. **Never assume a branch
   name** — not `main`, not the upstream, not the last one used.
3. Read the bundle's lifecycle policy — `docs/conventions/documentation.md` in the
   target repository — before proposing any reconciliation. It is the single source of
   truth for frontmatter, the taxonomy, reserved files, linking, and the
   create/update/supersede flow.

Only after the mode and target are settled does scope computation begin.

## Branch scope — recompute from the merge-base every run

Compute the **common ancestor** of the current branch and the target with
`git merge-base <target> HEAD`, and take that commit as the fixed boundary. The scope is
everything the branch changed from that boundary through the complete current working
state:

- **committed** changes since the merge-base;
- **staged** changes in the index;
- **unstaged** working-tree modifications; and
- **relevant untracked** files.

Recompute this from the same boundary on **every** run — never accumulate from a previous
sync — so repeated runs add no residue.

### In scope vs. excluded

- **Relevant untracked** state is unignored content inside a source or docs area the
  branch touched, or a file the branch work explicitly links to. It is in scope.
- **Ignored** material (anything matched by `.gitignore`) and user-designated
  **temporary** drafts are excluded. Temporary drafts remain user-owned and must be
  removed before invocation; sync does not file or delete them.
- Both source changes and docs changes are inspected. A **docs-only** branch is valid and
  reconciles successfully — it has no source diff, only bundle edits and their bookkeeping.

## Reconcile current and explanatory truth — report unrelated drift separately

Reconcile every concept the branch affected to the current repository state:

- **Current truth** — behaviour, mechanics, values, config that the branch changed:
  update the matching `Specification`/concept so it points at the new source (name the
  symbol/file; never paste executable truth verbatim) and bump its `timestamp`.
- **Explanatory truth** — intent, terminology, constraints, decisions the branch changed:
  amend the affected `Decision`/`Convention`/`Glossary` concept in place; a material
  reversal of a decision's chosen alternative, boundary, or hard constraint is a
  supersession, not an edit — if unclear, ask.

Content affected by a source change is updated in the **same** working step as the review
that found it.

**Unrelated target drift** — a stale or non-conformant concept that was already wrong on
the target branch, untouched by this branch — is **out of scope**. Report it **separately**
in the conversational summary and leave it **byte-preserved**. Do not fold unrelated
repairs into a branch sync; that is bundle-wide work.

## Execution — dynamic fanout with one reconciler

- **Dynamic fanout:** create one domain worker per independent affected area. Workers run
  in parallel and each returns proposed concept edits for its area.
- **Disjoint ownership:** each worker owns a **disjoint** set of concept files. No two
  workers touch the same concept. Partition the affected concepts before dispatch; if two
  areas would touch one concept, one owner takes it.
- **One reconciler writes the shared bookkeeping:** domain workers edit only their own
  concept's **body**; the `index.md`, `log.md`, and `timestamp`-frontmatter bookkeeping is
  deferred to a **single reconciler** that makes the final pass. That reconciler is the
  **sole writer** of indexes, logs, and timestamps — so no two workers race a shared file,
  and a concept's body edit (by its owning worker) never collides with its timestamp stamp
  (by the reconciler).
- **Lifecycle bookkeeping is one net entry per concept:** a concept created and then edited
  on the branch gets one `Creation` entry; an existing concept changed gets one `Update`;
  a retired one gets one `Deprecation`. Never write a `docs-sync ran` or `Noted`
  operational entry, and never rewrite previously merged lifecycle history.
- A concept reaching **300 physical lines** gets a semantic keep-or-split review in the
  conversational report; 300 is a review cue, not a validator rule or an automatic split.

## Contradictions block precisely — never guess

When two authoritative executable sources contradict each other about a claim (e.g. code
and a test assert different values), **do not guess** which is right. Let the independent
workers finish their other work, then stop **only the affected claim** and hand the user a
**precise blocker**: name the two sources, the exact conflicting values, and the concept
that cannot be reconciled until they resolve it. Everything not blocked by the
contradiction still reconciles and the run reports both the completed work and the precise
block.

## Verify — a fresh verifier

After the reconciler has written, dispatch a **fresh verifier** (not an author of the
edits) to check:

- **source truth** — each updated concept matches the current code/tests it describes and
  copies no executable truth verbatim;
- **complete scope** — every branch-affected concept was reconciled, nothing missed;
- **ownership** — each concept was written by exactly one owner and only the reconciler
  wrote indexes, logs, and timestamps;
- **lifecycle bookkeeping** — one net entry per concept, correct index bullets, no
  operational entry;
- **validation** — run `docs:validate` and classify the exit (below); and
- **Git-state preservation** — nothing was staged, committed, pushed, or sent to a remote.

Author→verifier correction repeats until the verifier is clean or the run is genuinely
blocked (a contradiction the user must resolve).

## Validation gates success

Run the repository's `docs:validate` through docs-validate and read the strict exit:

- **exit `0`** (clean, or warnings only) — success. Triage warnings in the report; a
  warning **never** blocks.
- **exit `1`** (one or more **hard errors** — unparseable frontmatter, missing/empty
  `type`) — the run does **not** succeed; repair the hard errors this sync introduced and
  re-run.
- **exit `2`** (validator **malfunction**) — the run does **not** succeed; nothing was
  validated. Report the tooling failure.

Warning-only validation permits success. Any hard error or a validator malfunction
prevents success.

## Idempotence

Because scope is recomputed from the same merge-base boundary on every run and each
concept is reconciled to current state (not appended to), running the **same** sync
**twice** from the same boundary leaves the bundle byte-for-byte **unchanged after the
first successful run**. A **second run** re-derives an empty change set and writes nothing.
If a re-run would rewrite timestamps, re-append log entries, or re-fold amendments, the
first run was not idempotent — fix the reconciler, do not re-run to "settle" it.

## Boundaries — never do these

- **Never write before the mode and target are selected** — no concept edit, no index or
  log change, no worker dispatched to write, until the user has chosen branch mode and a
  target branch.
- **Never touch Git** — do not stage, commit, push, open a pull request, or add/change a
  remote. Every reconciliation lives in the working tree only; leave staging, commits,
  remotes, and pull-request state exactly as found.
- **Never reconcile unrelated target drift** — report it separately and leave it
  byte-preserved; repairing the whole bundle is bundle-wide work, not branch sync.
- **Never let two workers write one concept or one shared file** — partition ownership
  first; only the single reconciler writes indexes, logs, and timestamps.
- **Never guess through a contradiction** — stop the affected claim and hand the user a
  precise blocker with both sources and values.
- **Never file or delete a user's temporary draft**, and never file ambiguous
  outside-bundle Markdown — block on it rather than guessing.
- **Never write an operational `docs-sync ran`/`Noted` entry** or rewrite merged lifecycle
  history — one net lifecycle entry per concept.
- **Never accumulate across runs** — recompute scope from the merge-base every time so the
  flow stays idempotent.

## Common Mistakes

These are the error-prone traps that the "Boundaries" list above does not already cover in
its own words; each never-rule has its one canonical home in Boundaries.

- **Assuming the target branch** — ask every run; the merge-base and therefore the entire
  scope depend on it.
- **Pasting the changed code into a Specification** — cite the symbol/file; copied
  executable truth drifts the moment the source changes and the validator cannot catch it.
- **Treating a warning as a failure** — only exit `1` (hard errors) or `2` (malfunction)
  prevents success; warnings never block.
- **Re-running to make repeated output "stabilise"** — a correct run is already idempotent;
  a changing re-run is a reconciler bug.

## Quick Reference

1. Ask the mode; for branch sync ask the target branch (never assume). Read
   `docs/conventions/documentation.md`. Write nothing yet.
2. `git merge-base <target> HEAD` → the boundary. Scope = committed + staged + unstaged +
   relevant untracked; exclude ignored and temporary material.
3. Reconcile current and explanatory truth for every branch-affected concept; report
   unrelated target drift separately and byte-preserved.
4. Fan out to disjoint concept owners; one reconciler alone writes indexes, logs,
   timestamps; one net lifecycle entry per concept.
5. Contradiction → block only that claim with a precise user blocker; finish the rest.
6. Fresh verifier checks source truth, scope, ownership, lifecycle, validation, and
   Git-state preservation.
7. `docs:validate`: `0` clean/warnings-only = success; `1` hard errors or `2` malfunction
   = not successful. Never stage, commit, push, or open a PR.
