---
type: Specification
title: Install contract
description: What a docs-setup install delivers into a target repo — the managed surfaces, the per-install substitutions, the claude/ rename, the audit/classify/approve/write/verify workflow, and what "done" means.
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
   existing memory is classified.

The canonical helper skills `docs-add` and `docs-validate` are depended on **by
discovery**, not copied: docs-setup installs no project-local `.claude/skills/` helper
copies.

Two **optional deletion-safe adapters** are delivered only on request and change no
required behaviour by their presence or absence:

- the pointer-only Claude rule `assets/claude/rules/docs-authoring.md`, installed with a
  leading-dot rename to `.claude/rules/docs-authoring.md`;
- the minimal GitHub Actions workflow (`assets/github/workflows/docs-validate.yml`,
  installed to `.github/workflows/docs-validate.yml`) that runs `docs:validate` on pull
  requests and fails the job on exit `1`.

Pre-push enforcement is never installed. The documented portable hook is `pre-push`
running the package-manager-neutral `docs:validate` script, named in the `docs-validate`
skill under "Enforcement wiring"; no concrete plain-Git or husky recipe ships in any
skill today. Setup adds no husky dependency and no `prepare` script.

## Per-install substitutions

The assets ship with intentional placeholders (never filled in this source repo — see the
byte-exact convention). At install time, exactly three substitutions happen:

- **Date** — `<YYYY-MM-DD>` becomes the install date in the policy, the OKF reference, and
  `log.md`.
- **Project name** — `<PROJECT>` in the root `docs/index.md` title (and the placeholder
  subsystem bullet is dropped when there are no subsystems).
- **Package manager** — the router block's `<pm>` becomes the invocation prefix
  (`npm run` / `yarn` / `bun run` / `pnpm`), and the full literal `pnpm docs:validate`
  becomes the target invocation in `documentation.md` and `okf.md`. The matching rule —
  full literal only, never the bare script name — is defined in
  [/docs-setup/conventions/byte-exact-assets.md](/docs-setup/conventions/byte-exact-assets.md).

Everything not listed above is copied byte-for-byte.

## Workflow — who writes what

Every run follows one conservative, state-derived workflow:

- **Audit read-only.** Parallel read-only audits recompute the actual state from the
  filesystem — never from a suite-version or state file. Nothing is written during the
  audit.
- **Classify.** The recomputed state is classified as fresh, no-change, partial repair, or
  upgrade/reinstall, and the dry-run plan is shown before any mutation. An
  upgrade/repair on a dirty worktree requires explicit approval.
- **Approve.** One explicit approval of the complete plan authorizes one write pass. A
  differing managed file is customized-until-reviewed and never blindly overwritten;
  ambiguous project-memory prose is preserved and blocks completion until resolved.
- **Write once.** After approval, one deterministic coordinator applies the plan with the
  shell (`cp` + `sed`) — there are no parallel writers and no regeneration from memory.
- **Verify.** A fresh verifier checks preservation of unrelated content, that
  `docs:validate:test` passes, the `docs:validate` exit classification, canonical helper
  discovery, and an idempotent rerun.

## Done criteria

Completion reports **two independent results**:

- **tooling installed successfully** — managed conflicts resolved, machinery tests pass,
  and setup introduced no validation error;
- **bundle validates cleanly** — current content has no validation error.

A **fresh** install requires validation exit `0`
(see [/docs-setup/specs/validator.md](/docs-setup/specs/validator.md)). An
**upgrade/repair** requires the validator tests to pass and validation **not to exit
`2`**; a pre-existing content error (exit `1`) that setup did not introduce is reported
for a separate `docs-sync` and does not misclassify tooling installation. The installed
`scripts/validate-docs.mjs` is byte-identical to the skill's asset copy — an empty `diff`
is the fidelity check.
