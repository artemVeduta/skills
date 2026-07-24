---
name: docs-setup
description: Use when a repository's OKF (Open Knowledge Format) v0.1 documentation machinery needs to be stood up, upgraded, reinstalled, or repaired — "set up the docs bundle", "bootstrap OKF docs", "install or upgrade the docs validator and lifecycle policy here", "wire or update docs-add/docs-validate in this repo", "our docs tooling is out of date or partly missing, fix it". Covers a fresh target and a target that already carries managed docs machinery (current, differing, or incomplete). Not for adding one concept (docs-add), running the validator (docs-validate), or reconciling docs content against code changes (that is docs-sync).
---

# docs-setup

## Overview

Installs, upgrades, reinstalls, or repairs the OKF v0.1 documentation machinery in a
target repository: the strict validator and its test, the `docs:validate` /
`docs:validate:test` package scripts, the seed lifecycle policy and OKF reference, the
reserved bundle skeleton, an optional GitHub Actions asset, one marked Documentation
router in `AGENTS.md`, and the exact `CLAUDE.md` import shim. The fixed machinery lives
verbatim in this skill's `assets/` directory — it is copied byte-for-byte, never
regenerated from memory.

**Core principle:** _Audit read-only, recompute state, classify, present one plan, apply
once, verify._ Every run is state-derived: nothing is written until parallel read-only
audits have run, the actual state is **recomputed from the repository itself** (never from
a suite-version or state file — this skill neither reads nor writes one), the state is
classified, the complete plan is approved, and one deterministic writer applies it. The
same conservative workflow covers a fresh target and one that already carries managed
machinery.

## Required skills

- docs-add
- docs-validate

The two canonical helper skills are depended on by name and must be **discoverable** at
run time — docs-setup installs no project-local helper-skill copies (see Boundaries).

## When to Use

- "Set up OKF docs here", "bootstrap the docs bundle", "install the docs validator and
  policy" — on a repo with no bundle yet.
- "Upgrade / reinstall the docs tooling", "our validator is out of date", "the docs
  machinery is partly missing, repair it" — on a repo that already carries managed
  machinery (current, differing, or incomplete).
- NOT for adding one concept (that is docs-add), interpreting the validator (docs-validate),
  or reconciling concepts with source changes (that is docs-sync).

## Procedure

### 1. Audit (mandatory parallel read-only audits — write nothing)

Recompute actual state from the filesystem; never read or write a suite-version/state
file. Cover, in parallel, all six surfaces:

- **managed machinery** — `scripts/validate-docs.mjs` and its test, the seed policy and
  OKF reference, the reserved bundle skeleton;
- **package integration** — the `docs:validate` and `docs:validate:test` scripts in
  `package.json` and the detected package manager;
- **project memory** — `CLAUDE.md`, `AGENTS.md`, and any existing Documentation guidance
  (both the marked router and any un-delimited lookalike prose);
- **optional Claude adapters** — `.claude/rules/*` docs rules;
- **canonical-skill discovery** — whether `docs-add` and `docs-validate` resolve;
- **stale project-local helper copies** — obsolete v1 `.claude/skills/docs-*` copies.

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
- **No-change** — every managed surface present and byte-current → an idempotent no-op;
  report the no-change plan and write nothing. A current-v2 rerun always lands here.
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

- **create** — each **missing** managed file (from the manifest below);
- **replace** — a **differing** managed file, only after it is reviewed as
  customized-until-reviewed (never blindly overwritten — the review, then approval,
  authorizes the reinstall); plus the marked `AGENTS.md` router, swapped **idempotently**;
- **no-op** — each byte-current managed file, left exactly as found;
- **preserve** — every unrelated file, every block of un-delimited project guidance, the
  existing `specifications/` tree (never renamed to `specs/` — that is docs-sync's
  migration), and the evolving project indexes, logs, and concepts (once the skeleton
  exists they are **not upgrade-managed**), all **byte-preserved**;
- **delete** — an obsolete project-local v1 helper copy, **only after** canonical
  `docs-add`/`docs-validate` discovery is confirmed and any conflict is resolved (see
  below); nothing on a fresh install.

List every ambiguity and resolve it with the user before writing. **Ambiguous
project-memory content** — un-delimited prose that looks like Documentation guidance but
is not inside the router markers — is **preserved and BLOCKS completion**: never guess
whether to fold it into the router or drop it; ask. Ask plainly — **"Ready to apply this?
(yes / no)"** — and wait. Silence or "looks good" is not approval; only an explicit yes is.

#### Canonical helper discovery precedes any helper-copy removal

A differing project-local helper copy is a **conflict** and **remains** until the user
resolves it — it is never auto-deleted. Only an obsolete copy whose canonical
`docs-add`/`docs-validate` is confirmed discoverable, and which is not a customized
conflict, is proposed for removal.

### What the managed surfaces are (the manifest)

Source is this skill's `assets/`; destinations are the target repo root. Mind the
`assets/claude/` → `.claude/` rename (leading dot). On a **fresh** install every row is
created. On an upgrade/repair the **How** column governs each row. An **upgrade-managed**
row is created if missing, reviewed-then-reinstalled if differing, or a no-op if
byte-current. A **skeleton** row (marked _skeleton_) is created only if **missing** and is
otherwise **byte-preserved** — once the bundle exists its evolving indexes and logs are
not upgrade-managed and are **never** reinstalled from the seed (that would wipe
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
| `github/workflows/docs-validate.yml` _(opt)_ | `.github/workflows/docs-validate.yml` | verbatim, on request    |
| `claude/rules/docs-authoring.md` _(opt)_   | `.claude/rules/docs-authoring.md`      | verbatim, deletion-safe |

Plus add `"docs:validate": "node scripts/validate-docs.mjs"` and
`"docs:validate:test": "node --test scripts/validate-docs.test.mjs"` to `package.json`
(the focused single-file form — a glob would sweep the target's own `scripts/*.test.mjs`
into the docs test command).

The bundle **skeleton** (root/sub `index.md`, `log.md`, seed policy, OKF reference) is
created on a fresh install; once it exists, the evolving project indexes, logs, and
concepts are **not upgrade-managed**. The GitHub Actions asset and the pointer-only Claude
rule are **optional deletion-safe adapters**: installing or removing them changes no
required behavior. docs-setup installs **no `.claude/skills/` helper copies**.

### 5. Approve

Wait for one explicit approval of the complete plan. One approval authorizes one write
pass — nothing else. On a no-change plan there is nothing to apply.

### 6. Write (ONE deterministic writer — no parallel writers)

After the explicit yes, one deterministic coordinator applies the whole plan with the
shell. There are **no parallel writers** — the shared setup surfaces must not race. Copy
verbatim files with `cp`, substitute in place with `sed` (copying then editing in place
trips the read-gate; `sed` keeps verbatim files byte-exact). Create missing files,
reinstall each reviewed differing file from its asset, and touch no byte-current file.
Substitute:

- **date** — `<YYYY-MM-DD>` → today's date, in `documentation.md`, `okf.md`, and `log.md`;
- **project** — `<PROJECT>` → the project name in `docs/index.md`, and drop the
  placeholder subsystem bullet when there are no subsystems;
- **package manager** — the router block's `<pm>` → the invocation prefix (`npm run`,
  `yarn`, `bun run`, or `pnpm`), and the full literal `pnpm docs:validate` → the target
  invocation in `documentation.md` and `okf.md` (a no-op for a pnpm target, where the
  literal is already correct). Never touch the bare `docs:validate` script _definition_ in
  `package.json`.

Write `CLAUDE.md` as exactly `@AGENTS.md` only after existing memory is classified;
splice the router between its markers into `AGENTS.md` — **replacing a recognized marked
block idempotently** — creating the file if absent and preserving every other line.

### 7. Verify (a fresh verifier)

- **preservation** — every pre-existing unrelated file, un-delimited guidance block,
  `specifications/` tree, and evolving concept/index/log is byte-intact;
- **machinery tests** — `docs:validate:test` passes;
- **validation classification** — run `docs:validate` and classify the exit with
  docs-validate: `0` clean/warnings-only, `1` hard content errors, `2` malfunction;
- **canonical skill discovery** — `docs-add` and `docs-validate` resolve;
- **idempotent rerun** — a second audit over the just-applied target classifies it as
  current and produces a no-change plan.

Report **two independent results**:

- **tooling installed successfully** — managed conflicts resolved, machinery tests pass,
  and setup introduced no validation error;
- **bundle validates cleanly** — current content has no validation error.

A **fresh** install requires validation exit `0`. An **upgrade/repair** requires the
validator tests to pass and validation **not to exit `2`**; a **pre-existing** content
error (exit `1`) that setup did not introduce is reported for a separate docs-sync and
does **not** misclassify tooling installation — the two results are reported independently.

## Boundaries — never do these

- **Never write before approval** — audits and the plan produce no file, staging, or
  commit until an explicit yes.
- **Never touch Git** — do not stage, commit, push, or open a pull request; leave staging,
  commits, remotes, and pull-request state exactly as found.
- **Never proceed on a dirty worktree upgrade/repair without explicit approval** — show
  the dirty state and wait; clean-worktree is the default.
- **Never blindly overwrite a differing managed file** — it is customized-until-reviewed;
  review it, get approval, then reinstall from the asset.
- **Never guess through ambiguous project memory** — un-delimited lookalike guidance is
  preserved and blocks completion until the user resolves it.
- **Never rename `specifications/` or edit evolving concepts/indexes/logs** — that is
  docs-sync's semantic work, not setup's.
- **Never remove a project-local helper copy** before canonical discovery is confirmed and
  a differing (conflicting) copy is resolved by the user.
- **Never install helper-skill copies** under `.claude/skills/` — depend on discovery.
- **Never convert existing documentation** — no semantic conversion here; that is sync work.
- **Never install husky or a `prepare` script** — enforcement is the optional PR workflow
  plus the documented pre-push recipes owned by docs-validate.

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
- **Calling a pre-existing bundle content error a tooling failure** — report the two
  results independently; a pre-existing exit `1` goes to docs-sync.
- **Treating validator warnings as failures** — only exit `1` gates a fresh install; on
  upgrade/repair only exit `2` blocks. Warnings never block.

## Quick Reference

1. Parallel read-only audits over the six surfaces → recompute state (no state file).
2. Classify (fresh / no-change / partial repair / upgrade-reinstall) from managed surfaces, shown before any mutation.
3. Show the worktree; an upgrade/repair on a dirty tree needs explicit approval.
4. Present create / replace / no-op / preserve / delete + every ambiguity (ambiguous memory blocks); wait for an explicit yes.
5. One deterministic writer applies the plan (create missing, reinstall reviewed differing, no-op current) + substitutions.
6. Verify preservation, `docs:validate:test`, exit classification, discovery, idempotent rerun; report the two results independently.
7. Never stage, commit, push, or open a PR.
