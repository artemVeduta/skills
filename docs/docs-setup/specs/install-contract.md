---
type: Specification
title: Install contract
description: What a docs-setup install delivers into a target repo — the six managed surfaces including validation enforcement, the per-install substitutions and currency rule, retired-surface convergence, the separation from docs-sync, the audit/classify/approve/write/verify workflow, and what "done" means.
timestamp: 2026-07-25
---

# Install contract

What a target repo is guaranteed to receive when the `docs-setup` skill runs. The
procedural source of truth — the full manifest table, the step-by-step workflow, and the
common-mistakes list — is `skills/docs-setup/SKILL.md`; this concept states the contract
at the explanatory level. The rules for *editing* the shipped assets in this source repo
are a separate concern:
[/docs-setup/conventions/byte-exact-assets.md](/docs-setup/conventions/byte-exact-assets.md).

docs-setup covers a fresh target and one that already carries managed machinery
(current, differing, or incomplete): every run recomputes state from the repository,
classifies it, and proposes one plan before writing. It never converts existing project
documentation, renames a `specifications/` tree, or edits evolving concepts — that
semantic work belongs to `docs-sync`.

docs-setup is **user-invoked-only**: it runs when the user asks for it by name, nothing
self-selects it, no other skill invokes it, and it is never an implicit finishing step
([/decisions/okf-docs-skill-boundaries.md](/decisions/okf-docs-skill-boundaries.md)).

## What an install delivers

Everything comes from `skills/docs-setup/assets/`, copied into the target repo root. The
managed surfaces are:

1. **The validator** — `scripts/validate-docs.mjs` plus its test file
   `scripts/validate-docs.test.mjs`, both pure verbatim copies. Behaviour is specified in
   [/docs-setup/specs/validator.md](/docs-setup/specs/validator.md).
2. **Two `package.json` scripts** — `docs:validate` and `docs:validate:test`, wiring the
   validator into the target's package manager (the focused single-file form, not a glob).
3. **The seed policy and reference** — the documentation lifecycle policy
   (`docs/conventions/documentation.md`) and the OKF reference (`docs/references/okf.md`).
4. **The reserved bundle skeleton** — root `index.md` (with `okf_version`), `log.md`, and
   the reserved `index.md` files for `conventions/`, `glossary/`, and `references/`. The
   skeleton is created only on a fresh install; once it exists, the evolving project
   indexes, logs, and concepts are **not** upgrade-managed.
5. **Project-memory wiring** — one marked Documentation router spliced into `AGENTS.md`
   (from `assets/agents/documentation-block.md`, between stable markers, preserving every
   other line) and the exact `CLAUDE.md` import shim (`@AGENTS.md`), written only after
   existing memory is classified. This is the **only** documentation-policy surface the
   suite ships: portable project memory plus the lifecycle Convention are required on every
   supported harness, and **no harness-specific documentation-policy adapter is delivered**
   ([/decisions/okf-docs-portability-and-distribution.md](/decisions/okf-docs-portability-and-distribution.md)).
6. **Validation enforcement** — up to two surfaces, each installed only where the
   repository already carries the capability:
   - the managed GitHub Actions workflow
     (`assets/github/workflows/docs-validate.yml` → `.github/workflows/docs-validate.yml`),
     installed on **GitHub evidence** — a GitHub remote, existing GitHub workflow
     structure, or an explicit request — and only when **no equivalent strict-validation
     invocation is already present**. It runs on **both `push` and `pull_request`**, and
     exit `1` **or** `2` fails the job;
   - one **marked managed block** on an **already-active, repository-owned Husky
     `pre-push`** path, validating the **complete bundle on every push**.

   Absence of the capability is a **reported skip**, never a prompt or a guess. Neither
   surface is "delivered only on request": both are governed by the discovery and
   conformance rules, whose mechanics live with the skill that owns them
   (`skills/docs-setup/references/enforcement.md`). Setup owns enforcement **discovery,
   planning, installation, upgrade, and verification**; `docs-validate` owns **running and
   interpreting** the strict command and its `0` / `1` / `2` exit
   ([/decisions/okf-docs-strict-validation.md](/decisions/okf-docs-strict-validation.md)).

The canonical helper skills `docs-add` and `docs-validate` are depended on **by
discovery**, not copied: docs-setup installs no project-local `.claude/skills/` helper
copies.

### What enforcement never does

There is **no hook "recipe"** anywhere in the suite — the marked managed block *is* the
wiring, so there is no hook body to copy. Setup never installs, initializes, or upgrades
Husky, adds no `prepare` script, and never changes native Git hooks, the configured hooks
path, or any other Git state. Husky detection requires an **initialized hook manager** the
repository already owns; a dependency entry, a lockfile line, or a `prepare` script alone is
not evidence.

Existing hook commands stay **byte-preserved**, the managed block is **idempotent**
(repeated runs neither duplicate nor reorder it), and an **equivalent existing invocation** —
including one reached through a repository wrapper script — is a **no-op** for either
surface. The guard is never diff-scoped or path-filtered: merges, validator changes, and
errors inherited from another branch must not bypass it. Setup never modifies arbitrary CI
logic; the one dedicated workflow file is the whole of its CI surface.

Setup also never calls GitHub APIs or the GitHub CLI and never configures branch protection,
rulesets, or required checks. Making a check remotely mandatory is a repository
administrator's job — remote governance stays outside setup.

## Per-install substitutions

The assets ship with intentional placeholders (never filled in this source repo — see the
byte-exact convention). At install time, exactly three substitutions happen:

- **Date** — `<YYYY-MM-DD>` becomes the install date in the policy, the OKF reference, and
  `log.md`.
- **Project name** — `<PROJECT>` in the root `docs/index.md` title (and the placeholder
  subsystem bullet is dropped when there are no subsystems).
- **Package manager** — the `<pm>` in the router block **and in the marked pre-push
  block** becomes the invocation prefix (`npm run` / `yarn` / `bun run` / `pnpm`), and the
  full literal `pnpm docs:validate` becomes the target invocation in `documentation.md` and
  `okf.md`. The matching rule — full literal only, never the bare script name — is defined
  in
  [/docs-setup/conventions/byte-exact-assets.md](/docs-setup/conventions/byte-exact-assets.md).

Everything not listed above is copied byte-for-byte.

The three substitution slots are also **wildcards in the currency check**. Every audited
managed surface is classified as **absent**, **byte-current**, or **differing**, and a file
is byte-current when it equals its asset under *some* valid substitution — the install
date, project name, and package-manager prefix are never pinned to today's values.
Currency compares the surrounding bytes. A target carrying an earlier install date is
therefore still byte-current and stays a no-op rather than being reported as an upgrade,
which is what makes an already-current rerun a provable no-op
([/decisions/okf-docs-skill-boundaries.md](/decisions/okf-docs-skill-boundaries.md)). The
classifier itself is `skills/docs-setup/SKILL.md`.

## Workflow — who writes what

Every run follows one conservative, state-derived workflow:

- **Audit read-only.** Parallel read-only audits recompute the actual state from the
  filesystem — never from a suite-version or state file. The audit covers every managed
  surface, including **enforcement** (GitHub evidence, existing workflow conformance, and an
  active repository-owned Husky configuration with its effective pre-push path) and every
  **retired surface** in the tombstone list. Nothing is written during the audit.
- **Classify.** The recomputed state is classified as fresh, no-change, partial repair, or
  upgrade/reinstall, and the dry-run plan is shown before any mutation. An
  upgrade/repair on a dirty worktree requires explicit approval.
- **Approve.** One explicit approval of the complete plan authorizes one write pass. The
  plan states every action by class — create, replace, no-op, preserve, **skip**, delete —
  where **skip** is each enforcement surface the repository has no capability for, reported
  with what was looked for. A differing managed file is customized-until-reviewed and never
  blindly overwritten. Three things **block completion** identically: ambiguous
  project-memory prose, an **ambiguous enforcement surface** (a job or wrapper that might or
  might not reach the validator), and an **uncertain or customized retired surface**. Each is
  preserved and resolved by the user; none is ever guessed through.
- **Write once.** After approval, one deterministic coordinator applies the plan with the
  shell (`cp` + `sed`) — there are no parallel writers and no regeneration from memory.
- **Verify.** A fresh verifier checks preservation of unrelated content, that
  `docs:validate:test` passes, the `docs:validate` exit classification, each installed
  enforcement surface (and each reported skip), canonical helper discovery, unchanged Git
  state, and an idempotent rerun.

## Retired managed surfaces

Convergence is **versionless**. Setup installs **no suite-version marker** and carries **no
version-branched migration engine** — both are explicitly out of scope. A complete plan is
derived instead from four inputs: the current managed surfaces, the **durable
retired-surface tombstones**, **historical fingerprints or managed markers**, and actual
repository state. A historical fingerprint is byte-identity with a copy this suite shipped
for that path; a managed marker is an in-file marker naming the suite as owner. Either
proves suite ownership. The tombstone table with each entry's ownership proof lives with the
skill (`skills/docs-setup/references/enforcement.md`).

Tombstone coverage spans **tooling, wiring, adapters, workflows, managed router sections,
and legacy helper copies**, and includes `.claude/rules/docs-authoring.md` (the Claude-only
docs-authoring adapter, retired by this contract),
`.claude/rules/docs-maintenance.md` (an earlier retired adapter), project-local
`.claude/skills/docs-*` helper copies, superseded managed router sections in project memory,
and any retired managed tooling, wiring, or workflow surface the current manifest no longer
lists.

Classification has exactly three outcomes:

- **proven** obsolete (byte-identical to a historical fingerprint, or carrying a managed
  marker) → **a removal in the normal plan**, listed with every other action so cleanup is
  **visible and approved**;
- **customized or uncertain** → a **conflict** requiring an explicit **keep or remove**
  decision from the user; setup never guesses that user content is disposable;
- **missing** → a silent **no-op**.

**Every OKF knowledge file is preserved byte-for-byte by setup.** No concept, `index.md`,
`log.md`, `specifications/` tree, or subsystem content is ever a cleanup target — setup
never deletes project knowledge, and a planned removal that would touch bundle content is a
bug in the plan, not an approval question. Removing an obsolete project-local helper copy
additionally requires confirmed canonical `docs-add` / `docs-validate` discovery.

## Separation from docs-sync

Setup converges **managed installation surfaces plus the minimal policy substrate** and
performs **no semantic rewriting** of the bundle. The minimal managed policy substrate — the
seed lifecycle Convention, the OKF reference, and the marked router — may be upgraded
**conservatively**, so that a later semantic migration has current rules to follow;
customized policy content stays subject to the ordinary conflict-and-approval behaviour, and
the evolving concepts, indexes, and logs remain **not upgrade-managed**.

The upgrade order is two explicit stages: **explicit `docs-setup` first** establishes current
machinery, enforcement, and policy substrate; **optional, explicitly invoked bundle-wide
`docs-sync` second** performs semantic migration and reconciliation. **Setup never invokes
sync** — it may recommend it, and the user invokes it
([/decisions/okf-docs-knowledge-lifecycle.md](/decisions/okf-docs-knowledge-lifecycle.md)).

Skipping the second stage leaves a **current installation over a legacy or
validation-failing bundle**. That is an **allowed** state: it must be reported accurately,
and the newly installed enforcement may block pushes on it until the bundle is repaired.

## Done criteria

Completion reports **two independent results**:

- **tooling installed successfully** — managed conflicts resolved, machinery tests pass,
  planned enforcement **installed or explicitly skipped**, and setup introduced no
  validation error;
- **bundle validates cleanly** — current content has no validation error.

A **fresh** install requires validation exit `0`
(see [/docs-setup/specs/validator.md](/docs-setup/specs/validator.md)). An
**upgrade/repair** requires the validator tests to pass and validation **not to exit
`2`**; a pre-existing content error (exit `1`) that setup did not introduce is reported
for a separate `docs-sync` and does not misclassify tooling installation. The installed
`scripts/validate-docs.mjs` is byte-identical to the skill's asset copy — an empty `diff`
is the fidelity check.

Enforcement belongs to the **first** result and is installed **even when current content
fails validation** — that is precisely the case it exists for. When it is, the report states
plainly that **pushes remain blocked until the bundle is repaired**, and that repairing
content is a separate, explicitly invoked `docs-sync` run.
