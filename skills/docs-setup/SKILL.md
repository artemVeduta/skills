---
name: docs-setup
description: Use when a repository needs its OKF (Open Knowledge Format) v0.1 documentation machinery stood up from scratch — "set up the docs bundle", "bootstrap OKF docs", "install the docs validator and lifecycle policy here", "wire docs-add/docs-validate into this repo". For a fresh target with no managed docs machinery yet. Not for adding one concept (docs-add), running the validator (docs-validate), or reconciling docs against code changes (that is sync work).
---

# docs-setup

## Overview

Stands up the OKF v0.1 documentation machinery in a target repository: the strict
validator and its test, the `docs:validate` / `docs:validate:test` package scripts, the
seed lifecycle policy and OKF reference, the reserved bundle skeleton, an optional
GitHub Actions asset, one marked Documentation router in `AGENTS.md`, and the exact
`CLAUDE.md` import shim. The fixed machinery lives verbatim in this skill's `assets/`
directory — it is copied byte-for-byte, never regenerated from memory.

**Core principle:** _Audit read-only, classify, present one plan, apply once, verify._
Every run is state-derived: nothing is written until parallel read-only audits have run,
the state is classified, the complete plan is approved, and one deterministic writer
applies it. This slice fully specifies the **fresh install** — a target with no managed
docs machinery yet.

## Required skills

- docs-add
- docs-validate

The two canonical helper skills are depended on by name and must be **discoverable** at
run time. docs-setup installs **no project-local helper-skill copies** and performs **no
semantic conversion** of existing documentation — those are, respectively, never done and
sync work.

## When to Use

- "Set up OKF docs here", "bootstrap the docs bundle", "install the docs validator and
  policy", "standardize our docs into the OKF format" — on a repo with no bundle yet.
- NOT for adding one concept (that is docs-add), interpreting the validator (docs-validate),
  or reconciling concepts with source changes (sync work).
- Tooling upgrade, reinstall, and partial repair are the same skill's responsibility but a
  separate slice; this document specifies the fresh path.

## Procedure

### 1. Audit (mandatory parallel read-only audits — write nothing)

Recompute actual state from the filesystem; never read or write a suite-version/state
file. Cover, in parallel, all six surfaces:

- **managed machinery** — `scripts/validate-docs.mjs` and its test, the seed policy and
  OKF reference, the reserved bundle skeleton;
- **package integration** — the `docs:validate` and `docs:validate:test` scripts in
  `package.json` and the detected package manager;
- **project memory** — `CLAUDE.md`, `AGENTS.md`, and any existing Documentation guidance;
- **optional Claude adapters** — `.claude/rules/*` docs rules;
- **canonical-skill discovery** — whether `docs-add` and `docs-validate` resolve;
- **stale project-local helper copies** — obsolete v1 `.claude/skills/docs-*` copies.

### 2. Classify

Consolidate one dry-run plan and classify the state. **Fresh** = no managed machinery
present — the only path this slice performs. A target that already carries current managed
machinery produces a **no-change** plan (the idempotent rerun). Upgrade and partial repair
— a target whose managed machinery exists but differs — are the same skill's
responsibility in a separate slice (#53) and are out of scope here.

### 3. Plan (present every action + every ambiguity, then STOP)

Present one complete plan in a single message and wait. State every action by class:

- **create** — each managed file to add (the manifest below);
- **preserve** — every unrelated file and every block of existing project guidance left
  untouched;
- **replace** — recognized wiring to swap idempotently (the marked router only);
- **delete** — nothing, on a fresh install.

List every ambiguity (unclassifiable memory prose, an unexpected pre-existing file) and
resolve it with the user before writing. Ask plainly — **"Ready to apply this? (yes / no)"**
— and wait. Silence or "looks good" is not approval; only an explicit yes is.

### What a fresh install delivers (the manifest — install ALL of it)

Source is this skill's `assets/`; destinations are the target repo root. Mind the
`assets/claude/` → `.claude/` rename (leading dot).

| From `assets/`                             | To (target repo)                       | How                     |
| ------------------------------------------ | -------------------------------------- | ----------------------- |
| `scripts/validate-docs.mjs`                | `scripts/validate-docs.mjs`            | verbatim                |
| `scripts/validate-docs.test.mjs`           | `scripts/validate-docs.test.mjs`       | verbatim                |
| `docs/references/okf.md`                   | `docs/references/okf.md`               | verbatim + date + pm    |
| `docs/conventions/documentation.md`        | `docs/conventions/documentation.md`    | verbatim + date + pm    |
| `docs/index.md`                            | `docs/index.md`                        | fill `<PROJECT>`        |
| `docs/log.md`                              | `docs/log.md`                          | fill date               |
| `docs/{conventions,glossary,references}/index.md` | same paths                      | verbatim                |
| `agents/documentation-block.md`            | `AGENTS.md` (between its markers)       | + pm; preserve the rest |
| _(the exact shim)_                         | `CLAUDE.md`                            | exactly `@AGENTS.md`    |
| `github/workflows/docs-validate.yml` _(opt)_ | `.github/workflows/docs-validate.yml` | verbatim, on request    |
| `claude/rules/docs-authoring.md` _(opt)_   | `.claude/rules/docs-authoring.md`      | verbatim, deletion-safe |

Plus add `"docs:validate": "node scripts/validate-docs.mjs"` and
`"docs:validate:test": "node --test scripts/validate-docs.test.mjs"` to `package.json`
(the focused single-file form — a glob would sweep the target's own `scripts/*.test.mjs`
into the docs test command).

The GitHub Actions asset and the pointer-only Claude rule are **optional deletion-safe
adapters**: installing or removing them changes no required behavior. docs-setup installs
**no `.claude/skills/` helper copies** — `docs-add` and `docs-validate` are discovered as
canonical library skills.

### 4. Approve

Wait for one explicit approval of the complete plan. One approval authorizes one write
pass — nothing else.

### 5. Write (ONE deterministic writer — no parallel writers)

After the explicit yes, one deterministic coordinator applies the whole plan with the
shell. There are **no parallel writers** — nothing on a fresh install races on a shared
surface. Copy verbatim files with `cp`, substitute in place with `sed` (copying then
editing in place trips the read-gate; `sed` keeps verbatim files byte-exact). Substitute:

- **date** — `<YYYY-MM-DD>` → today's date, in `documentation.md`, `okf.md`, and `log.md`;
- **project** — `<PROJECT>` → the project name in `docs/index.md`, and drop the
  placeholder subsystem bullet when there are no subsystems;
- **package manager** — the router block's `<pm>` → the invocation prefix (`npm run`,
  `yarn`, `bun run`, or `pnpm`), and the full literal `pnpm docs:validate` → the target
  invocation in `documentation.md` and `okf.md` (a no-op for a pnpm target, where the
  literal is already correct). Never touch the bare `docs:validate` script _definition_ in
  `package.json`.

Write `CLAUDE.md` as exactly `@AGENTS.md` only after existing memory is classified;
splice the router between its markers into `AGENTS.md`, creating the file if absent and
preserving every other line.

### 6. Verify (a fresh verifier)

- **preservation** — every pre-existing unrelated file and guidance block is byte-intact;
- **machinery tests** — `docs:validate:test` passes;
- **validation** — `docs:validate` exits `0` (clean or warnings-only); a fresh install
  requires validation success. Use docs-validate to interpret exits;
- **canonical skill discovery** — `docs-add` and `docs-validate` resolve;
- **idempotent no-change rerun** — a second audit over the just-installed target
  classifies it as current and produces a no-change plan.

Report two independent results: **tooling installed successfully** (machinery in place,
tests pass, no validation error introduced) and **bundle validates cleanly**.

## Boundaries — never do these

- **Never write before approval** — audits and the plan produce no file, staging, or
  commit until an explicit yes.
- **Never touch Git** — do not stage, commit, push, or open a pull request; leave staging,
  commits, remotes, and pull-request state exactly as found. A clean fresh install exits
  with validation success and leaves all of them unchanged.
- **Never install helper-skill copies** under `.claude/skills/` — depend on discovery.
- **Never convert existing documentation** — no semantic conversion here; that is sync work.
- **Only ever create on a fresh install** — never overwrite pre-existing content. A
  differing managed file means the target is not fresh; upgrade/repair is a separate slice
  (#53), not this path.
- **Never install husky or a `prepare` script** — enforcement is the optional PR workflow
  plus the documented pre-push recipes owned by docs-validate.

## Common Mistakes

- **Regenerating the validator from memory** instead of copying `assets/` — the #1 source
  of drift; the bundled assets exist for byte-for-byte fidelity.
- **Routing a verbatim file through a subagent** to "do the copy" — subagents summarize,
  bytes drift; the writer copies machinery itself with the shell.
- **Global-replacing `docs:validate`** — substitute only the full literal
  `pnpm docs:validate`; the bare `docs:validate` is also a package.json definition.
- **Writing the `CLAUDE.md` shim before classifying** existing memory content.
- **A populated dir with no `index.md`** — the validator warns; every seeded dir carries
  its reserved index.
- **Treating validator warnings as failures** — only exit `1` gates; warnings never block.

## Quick Reference

1. Parallel read-only audits over the six surfaces → recompute state.
2. Classify (fresh / upgrade / partial repair); build one dry-run plan.
3. Present create / preserve / replace / delete + every ambiguity; wait for an explicit yes.
4. One deterministic writer applies the manifest + substitutions; no parallel writers.
5. Verify preservation, `docs:validate:test`, `docs:validate` exit `0`, discovery, and an
   idempotent no-change rerun.
6. Never stage, commit, push, or open a PR.
