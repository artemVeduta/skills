---
type: Specification
title: Install contract
description: What an okf-docs-setup install delivers into a target repo — the manifest, the per-install substitutions, the claude/ rename, the phase structure, and what "done" means.
timestamp: 2026-07-10
---

# Install contract

What a target repo is guaranteed to receive when the `okf-docs-setup` skill runs.
The procedural source of truth — the full manifest table, the phase-by-phase steps,
and the common-mistakes list — is `skills/okf-docs-setup/SKILL.md`; this concept
states the contract at the explanatory level. The rules for *editing* the shipped
assets in this source repo are a separate concern:
[/okf-docs-setup/conventions/byte-exact-assets.md](/okf-docs-setup/conventions/byte-exact-assets.md).

## What an install delivers

Everything comes from `skills/okf-docs-setup/assets/`, copied into the target repo
root in four groups:

1. **The `docs/` bundle skeleton** — root `index.md` (with `okf_version`), `log.md`,
   the documentation lifecycle policy (`docs/conventions/documentation.md`), the OKF
   reference (`docs/references/okf.md`), and the reserved `index.md` files for
   `conventions/`, `glossary/`, and `references/`.
2. **The validator** — `scripts/validate-docs.mjs` plus its test file
   `scripts/validate-docs.test.mjs`, both pure verbatim copies. Behaviour is
   specified in [/okf-docs-setup/specs/validator.md](/okf-docs-setup/specs/validator.md).
3. **The `.claude/` machinery** — the always-on `docs-authoring` and
   `docs-maintenance` rules, and the `docs-add` (with its concept templates) and
   `docs-validate` helper skills. Shipped as `assets/claude/`, installed with a
   leading-dot rename to `.claude/`.
4. **Two `package.json` scripts** — `docs:validate` and `docs:validate:test`,
   wiring the validator into the target's package manager.

A partial install (skeleton plus a few concepts, without the tests, both rules,
both skills, and the scripts) does not satisfy the contract.

## Per-install substitutions

The assets ship with intentional placeholders (never filled in this source repo —
see the byte-exact convention). At install time, exactly four substitutions happen:

- **Date** — `<YYYY-MM-DD>` becomes the install date in the policy, the OKF
  reference, and `log.md` only. The same token inside the `docs-add` templates is
  left alone; it is filled per-concept, not per-install.
- **Project name** — `<PROJECT>` in the root `docs/index.md` title.
- **Source-edit paths** — `<source-edit-path-glob>` in the `docs-maintenance` rule's
  frontmatter `paths:` becomes the target repo's explicit source glob(s), gathered
  from the user. There is no default; the install stops and asks rather than invent one.
- **Package manager** — the human-facing invocation is rewritten from the shipped
  `pnpm` form to the target's (`npm run` / `yarn` / no-op). The matching rule —
  full literal only, never the bare script name — is defined in
  [/okf-docs-setup/conventions/byte-exact-assets.md](/okf-docs-setup/conventions/byte-exact-assets.md).

Everything not listed above is copied byte-for-byte.

## Phase structure — who writes what

The skill separates fixed machinery from authored content:

- **Machinery is copied by the orchestrator itself**, with the shell (`cp` + `sed`),
  never through a subagent and never regenerated from memory — subagents summarize
  and bytes drift. This covers groups 1–4 above and all substitutions.
- **Only project content is authored** — subsystem index nodes and concepts
  converted from the target's existing docs — and only that authoring fans out to
  parallel agents. Each agent writes solely its own files; every directory that
  gains a concept also gains a reserved `index.md`.
- **Shared files have a single writer**: agents return their `index.md` bullets and
  `log.md` lines, and the orchestrator alone merges them, so concurrent writes
  never race.
- The install ends by wiring a Documentation section into the target's
  `CLAUDE.md`/`AGENTS.md` pointing at the bundle's lifecycle policy.

## Done criteria

- The target's `docs:validate` reports **zero hard errors**. Soft warnings are
  triaged, not chased; a clean install validates with zero warnings (see
  [/okf-docs-setup/specs/validator.md](/okf-docs-setup/specs/validator.md)).
- The bundled test suite (`docs:validate:test`) passes.
- The installed `scripts/validate-docs.mjs` is byte-identical to the skill's
  asset copy — an empty `diff` is the fidelity check.
