---
name: docs-sync
description: Use when source or docs work is wrapping up and the OKF docs/ bundle must be reconciled with the code, in one of two modes chosen before any write, or when documentation that lives outside the bundle must be migrated into it. Branch sync — "sync the docs", "reconcile docs with my branch", "make the docs match the code I changed". Bundle-wide audit — "audit the whole docs bundle", "the docs have drifted everywhere, repair them". Migration — "migrate my existing docs into the bundle", "convert these ad-hoc notes into concepts", "bring my README/design docs under docs/". Covers branch-scoped reconciliation from a target branch's merge-base through the working state, whole-bundle reconciliation of the complete current bundle, and a gated migration of durable outside-bundle documentation through explicit source disposition. Not for adding one concept (docs-add), running the validator (docs-validate), or standing up the machinery (docs-setup).
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

This skill covers two reconciliation modes that share **one** execution, verification,
and validation contract: **branch sync** (scope from a target branch's merge-base through
the working state) and **bundle-wide reconciliation** (audit and repair the complete
current bundle). The existing-source migration subflow is a separate gated flow, not part
of either reconciliation mode.

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

Only after the mode — and, for branch sync, the **target branch** — is settled does scope
computation begin. **Bundle-wide reconciliation takes no target branch**: its scope is the
complete current bundle (see **Bundle-wide reconciliation** below).

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
  amend the affected `Decision`/`Convention`/`Glossary` concept in place. A material
  reversal is not an ordinary edit — see **Compaction** below.

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
- **Lifecycle bookkeeping collapses to one concise net entry per concept** — the reconciler
  writes it during the compaction pass below (`Creation`/`Update`/`Deprecation`), never an
  operational entry.
- A concept reaching **300 physical lines** gets a semantic keep-or-split review in the
  conversational report; 300 is a review cue, not a validator rule or an automatic split.

## Compaction — fold branch drafting into the accepted net state

Branch work leaves **drafting residue** — many small edits, extra log lines, intermediate
amendment headings, a "the sync ran" note. Compaction folds that residue down to the
**accepted net state**: the durable knowledge that should survive review and merge. It is
not a separate mode — it is how branch sync writes lifecycle and history.

**The accepted-state boundary is the merge-base.** Only drafting introduced *after* the
merge-base is eligible for compaction. Everything present *at* the boundary is
already-merged history and is protected: target-side amendments remain **unchanged**,
historical rationale and dated value facts stay intact, and merged `log.md` entries are
never rewritten. Use the boundary to separate branch-local residue from accepted history;
never guess across it.

**Collapse lifecycle entries to one concise net entry per concept:**

- a created concept **remains `Creation`** after any number of later branch edits — never
  a `Creation` plus a follow-up `Update`;
- an existing changed concept becomes **one net `Update`**;
- a retired concept becomes **one net `Deprecation`**.

An **operational** line is never a lifecycle entry: a `docs-sync ran` note, a `**Noted**`
marker, or any debt marker is drafting exhaust. Compaction **removes** such residue and
never writes it.

**Fold branch-local amendment drafting into the canonical body.** A branch-local dated
`# Amendments` **heading** is residue: remove the amendment heading and **fold** its
accepted dated old/new value fact into the canonical `Context` or `Consequences` prose
(keep the date and the values; drop the heading). A target-side amendment present at the
merge-base is left exactly as it is. An **ordinary refinement** — a value or wording
change that does not cross the boundary — updates the accepted live section **in place**.

**A reversal is never a silent edit.** A change to a Decision's **selected alternative**,
an **ownership boundary**, a **hard constraint**, or a **material consequence** is a
reversal, not a refinement — and if it is unclear whether a change is a reversal, ask. A
reversal **requires explicit user confirmation**. On confirmation, create a **linked
supersession**: file a replacement Decision, mark the old one `status: superseded` with
`superseded_by:` linking the replacement, and log one `Deprecation`. Never rewrite or
delete the accepted choice in place.

Compaction is **idempotent** — it writes the net state rather than appending, so a re-run
from the same merge-base re-derives it and changes nothing (see **Idempotence** below).

## Bundle-wide reconciliation — audit and repair the complete bundle

The second mode reconciles the **entire current bundle** against executable truth (current
code, tests, configuration) and still-valid explanatory truth, in one pass. There is **no
target branch and no merge-base** — the scope is the **complete bundle** as it stands now,
not a branch diff. Everything above about branch scope, the merge-base, and unrelated
target drift is branch-mode only and does not apply here.

**Audit the whole bundle for every drift kind and repair each in place:**

- **Stale explanations** — a concept whose prose no longer matches the code/tests/config it
  describes: update it to cite the current symbol/file (never paste executable truth) and
  bump its `timestamp`.
- **Missing concepts** — durable knowledge that has source but no concept (an undocumented
  subsystem or symbol): file the concept following the bundle's lifecycle policy.
- **Omissions** — a concept present on disk but absent from its parent `index.md`, or
  otherwise unreferenced: register it.
- **Lifecycle drift** — a concept with no `log.md` entry, or a lifecycle entry that no
  longer reflects the concept's net state: repair the entry.
- **Shared-bookkeeping drift** — index bullets, `log.md` entries, and `timestamp`s that
  disagree with the concepts they track: reconcile them through the single reconciler.

**No unrelated-drift category.** Branch sync reports unrelated target drift *separately* and
leaves it byte-preserved; bundle-wide mode does the opposite — the **whole bundle is in
scope**, so every stale concept is **repaired** (or, when it cannot be, reported as a
precise **blocker**), never reported-and-left. There is nothing "unrelated" to defer.

**Preserve accepted history; never invent a boundary.** **Accepted history** is preserved
unless **branch-local provenance** establishes a **safe compaction boundary**. With no
target branch there is no merge-base to separate accepted history from drafting residue, so
compaction runs *only* where branch-local provenance makes the boundary certain. When the
**acceptance boundary is unknown** — you cannot tell whether an amendment, dated value fact,
or lifecycle entry is accepted history or branch-local drafting — **never guess through it**:
leave the material **byte-preserved** and hand the user a **precise blocker** naming the
concept and the provenance you need. Everything whose boundary is certain still reconciles.

**The shared contract is reused, not redefined.** Execution (dynamic fanout, disjoint
concept ownership, and one **sole reconciler** for indexes, logs, and timestamps), the
300-line semantic keep-or-split review, the fresh verifier, contradiction blocking,
validation gating, and Git-state preservation are **the same as branch sync** — reused
unchanged. Bundle-wide adds only the whole-bundle audit scope, the no-unrelated-drift rule,
and the unknown-boundary blocker above.

## Existing-source migration — a separate gated subflow

When the user asks to convert existing ad-hoc documentation into the bundle, or a
bundle-wide audit finds durable knowledge living **outside** `docs/`, sync runs a
**gated migration subflow**. It is the **only** extra approval inside sync, because
it authorizes **destructive source-path changes** (moving or removing an imported
file) rather than the ordinary non-destructive reconciliation of the two modes above.

The gate in one line: **read-only workers classify every candidate — `keep`,
`normalize`, `split`, `move`, `remove`, or `ambiguous` — without writing, and the
coordinator presents one complete proposal (every exact concept destination, type,
outline, local-index entry, lifecycle entry, AND source-path disposition); nothing
is written, moved, or deleted until that complete proposal is approved and every
ambiguity is resolved.** An imported source **keeps its existing pointer** unless
its deletion was explicitly approved.

The full contract — the six classification labels, proposal completeness, the
non-overlapping-writer / one-reconciler ownership rule, the keep-as-overview vs
recorded-removal fork for a split source, verification of every source disposition,
and the denied-approval and partial-failure behavior — lives in
[references/migration.md](references/migration.md). **Read it before proposing or
writing any migration.** The shared execution, contradiction-blocking, verification,
validation, and Git-state contract in the rest of this skill is **reused unchanged**;
migration adds only the read-only classification, the completed proposal, and the
source-path dispositions.

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

**Both modes are idempotent.** A **second identical bundle-wide reconciliation** re-derives
the same whole-bundle audit over the same current state and writes nothing — an
already-reconciled bundle is the fixed point, so two identical bundle-wide runs produce
identical docs after the first successful run.

## Boundaries — never do these

- **Never write before the mode is selected** — no concept edit, no index or log change,
  no worker dispatched to write, until the user has chosen a mode (and, for branch sync, a
  target branch).
- **Never invent a compaction boundary in bundle-wide mode** — with no merge-base, compact
  only where branch-local provenance makes the accepted-state boundary certain; when it is
  unknown, preserve the material byte-for-byte and block precisely rather than guessing.
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
- **Never move or delete an imported source without approval** — a migration write,
  move, or deletion begins only after the complete proposal is approved and every
  ambiguity resolved; an imported source keeps its existing pointer unless its
  deletion was explicitly approved (see [references/migration.md](references/migration.md)).
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

**Bundle-wide mode:** no target branch — audit the **complete bundle** and repair every
stale explanation, missing concept, omission, lifecycle drift, and shared-bookkeeping drift
(no unrelated-drift category); preserve accepted history and **block** on any unknown
acceptance boundary rather than guessing; steps 4–7 (execution, verify, validation, Git
state) apply **unchanged**.
