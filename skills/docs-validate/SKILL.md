---
name: docs-validate
description: Use when asked to "validate docs", "check the docs bundle", or "find docs conformance issues", when interpreting docs:validate output or exit codes, when a docs-validate CI job or pre-push hook fails, or before concluding work that touched an OKF docs/ bundle. Not for creating concepts or setting up the bundle.
---

# docs-validate

## Overview

Runs the target repository's own strict OKF validator through its
package-manager-neutral `docs:validate` script and interprets the result:
clean or warnings-only, hard bundle errors, or validator malfunction. This
skill contains no validator implementation — the repository carries the
validator; this skill runs and explains it.

## When to Use

- "Validate docs", "check the docs bundle", "is the bundle conformant?",
  "why did docs-validate fail?"
- A `docs:validate` CI job or pre-push hook exited nonzero and someone needs
  the failure explained.
- As the verification backstop after any work that changed files under `docs/`.
- NOT for scaffolding a new concept (that is the `docs-add` skill) and NOT for
  installing or repairing the validator machinery (that is setup work).

## Run the validator

1. **Locate the repository root** — the directory holding the `package.json`
   whose `scripts` define `docs:validate`.
2. **Detect the package manager.** In order: the `packageManager` field in
   `package.json`; otherwise the lockfile (`pnpm-lock.yaml` → pnpm,
   `yarn.lock` → yarn, `bun.lock`/`bun.lockb` → bun, `package-lock.json` or
   none → npm).
3. **Run the script with no flags**, from the repository root, via the
   detected package manager: `npm run docs:validate`, `pnpm docs:validate`,
   `yarn docs:validate`, or `bun run docs:validate`. The script itself is
   package-manager-neutral (`"docs:validate": "node scripts/validate-docs.mjs"`);
   never append flags or arguments — there are none, and there is no alternate
   strict entrypoint.

## Interpret the exit code (strict everywhere)

| Exit | Meaning                                                                 | Report as                                                                          |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `0`  | Clean, or warnings only. Warnings never block.                          | Success. Triage any warnings; a warning is never a failure.                         |
| `1`  | One or more hard bundle errors (unparseable frontmatter; missing/empty/non-scalar `type`). | Failure of the bundle. The ERRORS section is the conformance bar.  |
| `2`  | Validator malfunction — e.g. a missing or unreadable docs root.         | Failure of the tooling, NOT a content verdict; nothing was validated.               |

Explain **errors before warnings**, always: hard errors are the conformance
floor and gate the result; warnings are advisory triage. On exit `2`, report
the malfunction (stderr says what broke) and do not classify the bundle at all.

For what each finding means, the repository's lifecycle policy is the
authority — read `docs/conventions/documentation.md` in the target repository
when it exists; this skill does not restate it.

## Authorization boundary

Running the validator and reporting is all this skill authorizes. **Never
edit concepts or repository machinery without separate authorization**: no
fixing frontmatter, no adding recommended fields, no repairing index coverage,
no creating a missing docs root or `index.md`, no touching the validator,
package scripts, hooks, or CI — however broken the report looks. Propose
fixes; apply them only after the user explicitly approves, then re-run the
script and confirm the new exit code.

## Enforcement wiring (owned by setup, not this skill)

The strict exit makes the plain `docs:validate` script hook- and CI-ready.
Ownership splits cleanly: **docs-setup owns enforcement discovery, planning,
installation, upgrade, and verification; this skill owns running and
interpreting the strict validation command.** Nothing more, in either
direction.

There are exactly two managed enforcement surfaces, both installed by
docs-setup: a managed **GitHub Actions workflow** that runs the same command on
**both `push` and `pull_request`** events, and one managed block on an
**already-active Husky `pre-push`** path that validates the **complete bundle**
on every push. No hook **recipe** ships or is documented anywhere in the suite
— the managed surfaces *are* the wiring, and there is no hook body to copy.
This skill only interprets the failures such wiring produces.

## Common Mistakes

- **Treating a warning as a failure** — warnings never block and there is no
  suppression grammar; broken links and missing optional fields are tolerated.
- **Treating exit `2` as a bundle verdict** — malfunction means nothing was
  validated; fix the invocation or report the tooling failure instead.
- **Inventing CLI flags** (`--fix`, `--json`, `--strict`) — there are none.
- **"Helpfully" repairing findings while reporting** — reporting authorizes no
  edits; every fix needs separate approval first.
- **Adding frontmatter to a non-root `index.md` to fix a warning** — that is
  itself a violation.
- **Hard-coding one package manager** — detect it; only the `docs:validate`
  script name is fixed.

## Quick Reference

- Detect package manager → run the bare `docs:validate` script → read the exit.
- `0` = clean/warnings-only (success), `1` = hard errors, `2` = malfunction.
- Errors first, then warnings, always.
- Report only; edits require separate authorization.
