---
name: docs-setup
disable-model-invocation: true
description: Invoke only when the user explicitly asks for it — never self-select this skill and never run it as an implicit completion step. Run it when the user says "set up the docs bundle", "bootstrap OKF docs", "install or upgrade the docs validator and lifecycle policy here", "wire or update docs-add/docs-validate in this repo", "our docs tooling is out of date or partly missing, fix it", or "install the docs validation check / pre-push guard here". Covers a fresh target and a target that already carries managed docs machinery (current, differing, or incomplete). Not for adding one concept (docs-add), running the validator (docs-validate), or reconciling docs content against code changes (that is docs-sync).
---

# docs-setup

## Overview

Installs, upgrades, reinstalls, or repairs the OKF v0.1 documentation machinery in a
target repository: the strict validator and its test, the `docs:validate` /
`docs:validate:test` package scripts, the seed lifecycle policy and OKF reference, the
reserved bundle skeleton, repository validation **enforcement** where the repository
already carries the capability, one marked Documentation router in `AGENTS.md`, and the
exact `CLAUDE.md` import shim. The fixed machinery lives verbatim in this skill's
`assets/` directory — it is copied byte-for-byte, never regenerated from memory.

**User-invoked only.** This skill runs when the user asks for it by name. Nothing
self-selects it, no other skill invokes it, and it is never an implicit finishing step.

**Core principle:** _Audit read-only, recompute state, classify, present one plan, apply
once, verify._ Every run is state-derived and **versionless**: nothing is written until
parallel read-only audits have run, the actual state is **recomputed from the repository
itself** (never from a suite-version or state file — this skill neither reads nor writes
one), the state is classified, the complete plan is approved, and one deterministic writer
applies it. The same conservative workflow covers a fresh target and one that already
carries managed machinery.

## Required skills

- docs-add
- docs-validate

## Integration

- **Required sub-skill:** invoke `/docs-validate` for every validator run this skill
  needs — the verification pass and the enforcement check both read their result through
  it. Setup owns enforcement **discovery, planning, installation, upgrade, and
  verification**; docs-validate owns **running and interpreting** the strict command and
  its `0` / `1` / `2` exit.
- **Required background:** `/docs-add` is the concept-filing workflow the installed policy
  and router hand users; setup installs the reference to it and files no concept itself.
- Both are depended on by canonical name and must be **discoverable** at run time —
  docs-setup installs no project-local helper-skill copies (see Boundaries).
- **Not a dependency:** `docs-sync` is a separate, separately user-invoked run. Setup may
  recommend it but never invokes it (see **Separation from docs-sync**).

## When to Use

- "Set up OKF docs here", "bootstrap the docs bundle", "install the docs validator and
  policy" — on a repo with no bundle yet.
- "Upgrade / reinstall the docs tooling", "our validator is out of date", "the docs
  machinery is partly missing, repair it" — on a repo that already carries managed
  machinery (current, differing, or incomplete).
- "Install the docs validation check / the pre-push guard here" — enforcement discovery,
  installation, and verification are this skill's surface.
- NOT for adding one concept (that is docs-add), interpreting the validator (docs-validate),
  or reconciling concepts with source changes (that is docs-sync).
- Only on an explicit user request — never as a self-selected step inside other work.

## Procedure

### 1. Audit (mandatory parallel read-only audits — write nothing)

Recompute actual state from the filesystem; never read or write a suite-version/state
file. Cover, in parallel, every managed surface:

- **managed machinery** — `scripts/validate-docs.mjs` and its test, the seed policy and
  OKF reference, the reserved bundle skeleton;
- **package integration** — the `docs:validate` and `docs:validate:test` scripts in
  `package.json` and the detected package manager;
- **project memory** — `CLAUDE.md`, `AGENTS.md`, and any existing Documentation guidance
  (both the marked router and any un-delimited lookalike prose);
- **enforcement** — GitHub evidence and existing workflow conformance, plus an active,
  repository-owned Husky configuration and its effective pre-push path
  ([references/enforcement.md](references/enforcement.md));
- **canonical-skill discovery** — whether `docs-add` and `docs-validate` resolve;
- **retired surfaces** — each durable tombstone: the retired Claude-only adapters, stale
  project-local `.claude/skills/docs-*` helper copies, superseded managed router sections,
  and retired managed tooling/wiring/workflow surfaces.

For each managed surface the audit records one of: **absent**, **byte-current**, or
**differing**. A file is **byte-current** when it equals the asset under _some_ valid
per-install substitution — the substitution slots (date, `<PROJECT>`, `<pm>`) are
**wildcards**, never pinned to today's values. Currency compares the surrounding bytes,
never the slot fills: a bundle stamped with an _earlier_ install date is still current
(its `<YYYY-MM-DD>` was filled once, at install, and is never re-stamped on audit). This
is what keeps a correctly-installed bundle a no-op on every later run, whatever the
calendar says.

### 2. Classify (recomputed, shown BEFORE any mutation)

Consolidate one dry-run plan and classify the recomputed state. The classification is
derived entirely from the audited managed surfaces and is presented before anything is
written:

- **Fresh** — no managed machinery present → create the full manifest.
- **No-change** — every managed surface present and byte-current, every enforcement surface
  already conformant, and no retired surface present → an idempotent no-op; report the
  no-change plan and write nothing. A rerun over an already-current installation always
  lands here.
- **Partial repair** — machinery present but one or more managed files are **missing** →
  create the missing files; leave current ones as no-ops.
- **Upgrade / reinstall** — machinery present but one or more managed files **differ** from
  canonical → each differing file is treated as **customized-until-reviewed**; leave
  current files as no-ops; create any missing files.

A single run may combine these (some missing, some differing, most current); present every
action by class regardless of the one-word headline.

### 3. Worktree gate (upgrade/repair is clean-worktree by default)

Before proposing any change to an existing managed file, inspect `git status` and show the
worktree state. Fresh install and no-change need no gate. An **upgrade or partial repair
is clean-worktree by default**: when the worktree is **dirty**, say so plainly and require
**explicit approval** to proceed on a dirty tree — do not proceed on a dirty worktree
without it.

### 4. Plan (present every action + every ambiguity, then STOP)

Present one complete plan in a single message and wait. State every action by class:

- **create** — each **missing** managed file (from the manifest below), including a planned
  enforcement surface;
- **replace** — a **differing** managed file, only after it is reviewed as
  customized-until-reviewed (never blindly overwritten — the review, then approval,
  authorizes the reinstall); plus the marked `AGENTS.md` router and the marked pre-push
  block, both swapped **idempotently**;
- **no-op** — each byte-current managed file, each already-conformant enforcement surface,
  and each absent retired path, left exactly as found;
- **preserve** — every unrelated file, every block of un-delimited project guidance, every
  unrelated hook command, the existing `specifications/` tree (never renamed to `specs/` —
  that is docs-sync's migration), and the evolving project indexes, logs, and concepts
  (once the skeleton exists they are **not upgrade-managed**), all **byte-preserved**;
- **skip** — each enforcement surface the repository has no capability for, reported as a
  skip with what was looked for;
- **delete** — each **proven** retired surface, and an obsolete project-local helper copy
  **only after** canonical `docs-add`/`docs-validate` discovery is confirmed and any
  conflict is resolved; nothing on a fresh install.

List every ambiguity and resolve it with the user before writing. **Ambiguous
project-memory content** — un-delimited prose that looks like Documentation guidance but
is not inside the router markers — is **preserved and BLOCKS completion**: never guess
whether to fold it into the router or drop it; ask. A **customized or uncertain** retired
surface and an **ambiguous** enforcement surface block the same way. Ask plainly —
**"Ready to apply this? (yes / no)"** — and wait. Silence or "looks good" is not approval;
only an explicit yes is.

#### Canonical helper discovery precedes any helper-copy removal

A differing project-local helper copy is a **conflict** and **remains** until the user
resolves it — it is never auto-deleted. Only an obsolete copy whose canonical
`docs-add`/`docs-validate` is confirmed discoverable, and which is not a customized
conflict, is proposed for removal.

### What the managed surfaces are (the manifest)

Source is this skill's `assets/`; destinations are the target repo root. On a **fresh**
install every row is created. On an upgrade/repair the **How** column governs each row. An
**upgrade-managed** row is created if missing, reviewed-then-reinstalled if differing, or a
no-op if byte-current. A **skeleton** row (marked _skeleton_) is created only if **missing**
and is otherwise **byte-preserved** — once the bundle exists its evolving indexes and logs
are not upgrade-managed and are **never** reinstalled from the seed (that would wipe
accumulated project content). Only the machinery/policy/reference/wiring rows are
reinstall-if-differing.

| From `assets/`                             | To (target repo)                       | How                     |
| ------------------------------------------ | -------------------------------------- | ----------------------- |
| `scripts/validate-docs.mjs`                | `scripts/validate-docs.mjs`            | verbatim                |
| `scripts/validate-docs.test.mjs`           | `scripts/validate-docs.test.mjs`       | verbatim                |
| `docs/references/okf.md`                   | `docs/references/okf.md`               | verbatim + date + pm    |
| `docs/conventions/documentation.md`        | `docs/conventions/documentation.md`    | verbatim + date + pm    |
| `docs/index.md`                            | `docs/index.md`                        | _skeleton_: create-if-missing, fill `<PROJECT>` |
| `docs/log.md`                              | `docs/log.md`                          | _skeleton_: create-if-missing, fill date |
| `docs/{conventions,glossary,references}/index.md` | same paths               | _skeleton_: create-if-missing |
| `agents/documentation-block.md`            | `AGENTS.md` (between its markers)       | + pm; preserve the rest |
| _(the exact shim)_                         | `CLAUDE.md`                            | exactly `@AGENTS.md`    |
| `github/workflows/docs-validate.yml`       | `.github/workflows/docs-validate.yml`  | verbatim, on GitHub evidence, if no equivalent |
| _(the marked pre-push block)_              | the effective Husky pre-push path      | marked block, only if Husky is active |

Plus add `"docs:validate": "node scripts/validate-docs.mjs"` and
`"docs:validate:test": "node --test scripts/validate-docs.test.mjs"` to `package.json`
(the focused single-file form — a glob would sweep the target's own `scripts/*.test.mjs`
into the docs test command).

The bundle **skeleton** (root/sub `index.md`, `log.md`, seed policy, OKF reference) is
created on a fresh install; once it exists, the evolving project indexes, logs, and
concepts are **not upgrade-managed**. The two enforcement rows are governed by the
discovery and conformance rules below, not by "on request". docs-setup installs **no
`.claude/skills/` helper copies** and ships **no harness-specific documentation policy**:
portable project memory (the marked `AGENTS.md` router) plus the lifecycle Convention are
the **required** policy surfaces on Claude Code, Codex, and OpenCode alike.

### 5. Approve

Wait for one explicit approval of the complete plan. One approval authorizes one write
pass — nothing else. On a no-change plan there is nothing to apply.

### 6. Write (ONE deterministic writer — no parallel writers)

After the explicit yes, one deterministic coordinator applies the whole plan with the
shell. There are **no parallel writers** — the shared setup surfaces must not race. Copy
verbatim files with `cp`, substitute in place with `sed` (copying then editing in place
trips the read-gate; `sed` keeps verbatim files byte-exact). Create missing files,
reinstall each reviewed differing file from its asset, remove each approved proven retired
surface, and touch no byte-current file. Substitute:

- **date** — `<YYYY-MM-DD>` → today's date, in `documentation.md`, `okf.md`, and `log.md`;
- **project** — `<PROJECT>` → the project name in `docs/index.md`, and drop the
  placeholder subsystem bullet when there are no subsystems;
- **package manager** — the router block's and the pre-push block's `<pm>` → the invocation
  prefix (`npm run`, `yarn`, `bun run`, or `pnpm`), and the full literal
  `pnpm docs:validate` → the target invocation in `documentation.md` and `okf.md` (a no-op
  for a pnpm target, where the literal is already correct). Never touch the bare
  `docs:validate` script _definition_ in `package.json`.

Write `CLAUDE.md` as exactly `@AGENTS.md` only after existing memory is classified;
splice the router between its markers into `AGENTS.md` — **replacing a recognized marked
block idempotently** — creating the file if absent and preserving every other line. The
pre-push block is spliced the same way, leaving every unrelated hook command byte-intact.

### 7. Verify (a fresh verifier)

- **preservation** — every pre-existing unrelated file, un-delimited guidance block,
  unrelated hook command, `specifications/` tree, and evolving concept/index/log is
  byte-intact;
- **machinery tests** — `docs:validate:test` passes;
- **validation classification** — run `docs:validate` and classify the exit with
  docs-validate: `0` clean/warnings-only, `1` hard content errors, `2` malfunction;
- **enforcement** — each installed enforcement surface is present and runs the complete
  bundle (workflow triggers are `push` and `pull_request`; the pre-push block is the single
  marked block, appended once, with the existing commands intact), and each skipped surface
  is reported as a skip;
- **canonical skill discovery** — `docs-add` and `docs-validate` resolve;
- **Git state** — no staging, commit, push, remote, branch, hooks-path, or native-hook
  change;
- **idempotent rerun** — a second audit over the just-applied target classifies it as
  current and produces a no-change plan.

Report **two independent results**:

- **tooling installed successfully** — managed conflicts resolved, machinery tests pass,
  planned enforcement installed or explicitly skipped, and setup introduced no validation
  error;
- **bundle validates cleanly** — current content has no validation error.

A **fresh** install requires validation exit `0`. An **upgrade/repair** requires the
validator tests to pass and validation **not to exit `2`**; a **pre-existing** content
error (exit `1`) that setup did not introduce is reported for a separate docs-sync and
does **not** misclassify tooling installation — the two results are reported independently.
Enforcement belongs to the first result: it is installed **even when existing content
fails validation**, and the report then states plainly that **pushes remain blocked until
the bundle is repaired**.

## Validation enforcement (owned here; docs-validate runs the command)

Setup owns enforcement **discovery, planning, installation, upgrade, and verification**.
The mechanics — every detection signal, the full equivalence set, the marker block, and the
skip wording — are in **[references/enforcement.md](references/enforcement.md)**; read it
before planning enforcement. The rules themselves:

- **GitHub is detected from evidence or an explicit request** — a GitHub remote, existing
  GitHub workflow structure, or the user asking. Absence of evidence is a **reported
  skip**, never a prompt and never a guess.
- **An existing workflow that already invokes the repository's strict documentation
  validation is conformant** → a no-op; enforcement is **not duplicated**. Equivalence
  includes wrappers and repository-specific script names.
- Otherwise install this skill's **own dedicated** workflow, which runs on **both `push`
  and `pull_request`**. Never modify arbitrary CI logic.
- **Local push enforcement only through an active, recognizable Husky configuration the
  repository already owns.** A package dependency without active configuration is
  insufficient. No Husky → **skip** and report the skip.
- The effective pre-push path receives **one identifiable managed validation block**
  between stable markers. Existing hook commands stay **byte-preserved**; the block is
  **idempotent** (repeated runs neither duplicate nor reorder); an **equivalent existing
  invocation**, including one through a repository wrapper script, is a **no-op**.
- **The guard validates the complete bundle on every push** — never a diff-scoped subset,
  so merges, validator changes, and inherited errors cannot bypass enforcement.
- **Enforcement is installed even when the bundle currently fails**, with the blocked-pushes
  consequence stated plainly.
- **Never** call GitHub APIs or the GitHub CLI, and **never** configure branch protection,
  rulesets, or required checks — remote repository governance is out of scope.
- **Never** install, initialize, or upgrade Husky, and never change native Git hooks or the
  configured hooks path.

## Versionless convergence over retired surfaces

Setup stays **versionless**: it installs **no suite-version marker** and carries **no
version-branched migration engine**. A complete plan is derived from the current managed
surfaces, the **durable retired-surface tombstones**, **historical fingerprints or managed
markers**, and actual repository state.

The tombstones — the retired managed surfaces to converge away — cover **tooling, wiring,
adapters, workflows, managed router sections, and legacy helper copies**, and include:

- `.claude/rules/docs-authoring.md` — the Claude-only docs-authoring adapter, **retired by
  this contract**;
- `.claude/rules/docs-maintenance.md` — an earlier retired adapter;
- project-local `.claude/skills/docs-*` helper copies;
- legacy or superseded managed router sections in project memory;
- retired managed tooling, wiring, or workflow surfaces this manifest no longer lists.

The full table, with each tombstone's ownership proof, is in
[references/enforcement.md](references/enforcement.md). Classification:

- **Proven** obsolete — byte-identical to a historical fingerprint, or carrying a managed
  marker that proves suite ownership → a **removal in the normal plan**, so cleanup is
  **visible and approved**.
- **Customized or uncertain** → a **conflict** requiring an explicit keep/remove decision.
  Setup never guesses that user content is disposable.
- **Missing** retired path → a silent **no-op**.
- **Never** an evolving OKF concept, index, log, or any other repository knowledge — every
  OKF knowledge file is byte-preserved by setup.

The **minimal managed policy substrate** (the seed lifecycle Convention, the OKF reference,
and the marked router) may be upgraded **conservatively**, so that a later optional
semantic migration has current rules to follow. Customized policy content stays subject to
the ordinary conflict-and-approval behavior above, and the evolving concepts, indexes, and
logs remain **not upgrade-managed**.

## Separation from docs-sync

Setup converges **managed installation surfaces and the minimal policy substrate**. It
performs **no semantic bundle rewriting** — that is an optional, separately user-invoked
docs-sync run, and setup **never invokes it automatically**.

The upgrade order is two explicit stages: **explicit docs-setup first** establishes current
machinery, enforcement, and policy substrate; **optional explicit bundle-wide docs-sync
second** migrates semantic knowledge. Skipping the second stage may leave a **current
installation with a legacy or validation-failing bundle** — an allowed state that must be
reported accurately, and one the newly installed enforcement may block pushes on until it
is repaired.

## Boundaries — never do these

- **Never run unasked** — this skill is user-invoked only; never self-select it and never
  run it as an implicit completion step for other work.
- **Never write before approval** — audits and the plan produce no file, staging, or
  commit until an explicit yes.
- **Never touch Git** — do not stage, commit, push, or open a pull request; do not change
  remotes, branches, native `.git/hooks/*`, or the configured hooks path; leave staging,
  commits, remotes, and pull-request state exactly as found.
- **Never proceed on a dirty worktree upgrade/repair without explicit approval** — show
  the dirty state and wait; clean-worktree is the default.
- **Never blindly overwrite a differing managed file** — it is customized-until-reviewed;
  review it, get approval, then reinstall from the asset.
- **Never guess through ambiguous project memory** — un-delimited lookalike guidance is
  preserved and blocks completion until the user resolves it.
- **Never rename `specifications/` or edit evolving concepts/indexes/logs** — that is
  docs-sync's semantic work, not setup's.
- **Never delete a customized or uncertain retired surface** — it is a conflict needing an
  explicit keep/remove decision; only a proven one is planned for removal.
- **Never remove OKF knowledge** — no concept, index, log, or subsystem content is ever a
  cleanup target.
- **Never remove a project-local helper copy** before canonical discovery is confirmed and
  a differing (conflicting) copy is resolved by the user.
- **Never install helper-skill copies** under `.claude/skills/` — depend on discovery.
- **Never ship harness-specific documentation policy** — no Claude-only, Codex-only, or
  OpenCode-only documentation rule; the portable router and the lifecycle Convention are
  the required surfaces.
- **Never convert existing documentation** — no semantic conversion here; that is sync work.
- **Never invoke docs-sync** — recommend it; the user invokes it explicitly.
- **Never install, initialize, or upgrade Husky, add a `prepare` script, or modify
  arbitrary CI logic** — enforcement uses the capability the repository already has, plus
  this skill's own dedicated workflow.
- **Never touch remote governance** — no GitHub API or CLI call, no branch protection,
  rulesets, or required checks.

## Common Mistakes

- **Reading a suite-version file to decide the plan** — there is none; recompute state from
  the repository every run. Local customization makes a recorded version unreliable.
- **Re-stamping the date makes a current install "differ"** — install-time slots
  (date, `<PROJECT>`, `<pm>`) are wildcards in the currency check; a bundle carrying an
  earlier install date is still byte-current, so it stays a no-op, not an upgrade.
- **Reinstalling an evolving index/log from the seed** — index/log/sub-index rows are
  _skeleton_: create-if-missing, else byte-preserve. Only machinery/policy/reference/wiring
  rows are reinstall-if-differing; a differing index has simply accumulated project content.
- **Regenerating the validator from memory** instead of copying `assets/` — the #1 source
  of drift; the bundled assets exist for byte-for-byte fidelity.
- **Routing a verbatim file through a subagent** to "do the copy" — subagents summarize,
  bytes drift; the writer copies machinery itself with the shell.
- **Global-replacing `docs:validate`** — substitute only the full literal
  `pnpm docs:validate`; the bare `docs:validate` is also a package.json definition.
- **Treating a devDependency as an active hook manager** — enforcement needs an initialized,
  repository-owned configuration; a package line is not evidence.
- **Duplicating enforcement next to an equivalent invocation** — a wrapper or a
  repository-specific script name that reaches the validator is already conformant.
- **Waiting for a clean bundle before installing enforcement** — install it anyway and
  report that pushes stay blocked until the content is repaired.
- **Calling a pre-existing bundle content error a tooling failure** — report the two
  results independently; a pre-existing exit `1` goes to docs-sync.
- **Treating validator warnings as failures** — only exit `1` gates a fresh install; on
  upgrade/repair only exit `2` blocks. Warnings never block.

## Quick Reference

1. Parallel read-only audits over machinery, package wiring, project memory, enforcement,
   discovery, and retired surfaces → recompute state (no state file).
2. Classify (fresh / no-change / partial repair / upgrade-reinstall) from managed surfaces, shown before any mutation.
3. Show the worktree; an upgrade/repair on a dirty tree needs explicit approval.
4. Present create / replace / no-op / preserve / skip / delete + every ambiguity (ambiguous memory, uncertain retired surface, ambiguous enforcement all block); wait for an explicit yes.
5. One deterministic writer applies the plan (create missing, reinstall reviewed differing, remove proven retired, no-op current) + substitutions.
6. Enforcement: GitHub evidence → conformant workflow is a no-op, else the dedicated `push` + `pull_request` workflow; active Husky → one marked pre-push block over the complete bundle; otherwise skip and say so. Details: [references/enforcement.md](references/enforcement.md).
7. Verify preservation, `docs:validate:test`, exit classification, enforcement, discovery, Git state, idempotent rerun; report the two results independently.
8. Never stage, commit, push, open a PR, install Husky, touch remote governance, or invoke docs-sync.
