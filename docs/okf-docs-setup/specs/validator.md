---
type: Specification
title: OKF validator behaviour and invocation
description: How the docs validator behaves (advisory exit, error classes, exclusions) and how to run it and its tests in this repo.
timestamp: 2026-07-10
---

# OKF validator behaviour and invocation

The validator's source of truth is
`skills/okf-docs-setup/assets/scripts/validate-docs.mjs` (standalone Node ESM,
no dependencies). A copy is installed at `scripts/validate-docs.mjs` for this
repo's own bundle.

## Behaviour

- **Advisory only — always exits 0.** Read stdout, not the exit code.
- **Hard errors** are limited to unparseable frontmatter or an empty/missing
  `type`. Everything else (missing recommended fields, broken links) is a soft
  warning.
- The set of excluded top-level dirs (default: `superpowers/`) is hardcoded as
  `excludedTopLevelDirs` in `validate-docs.mjs`. Edit it there to change the
  set.
- Fenced code blocks and inline code spans are stripped before link checking,
  so illustrative example links (like the policy's own `/absolute/path.md`)
  do not warn. A clean install validates with zero warnings.

## Invocation

- Validate this repo's bundle: `npm run docs:validate`
  (runs `node scripts/validate-docs.mjs`).
- Run the validator tests: `npm run docs:validate:test`
  (runs `node --test scripts/*.test.mjs`).
- Run the source-of-truth validator directly against any bundle (docs root
  defaults to `docs`):
  `node skills/okf-docs-setup/assets/scripts/validate-docs.mjs <docs-root>`

Editing rules for the validator source live in
[/okf-docs-setup/conventions/byte-exact-assets.md](/okf-docs-setup/conventions/byte-exact-assets.md) —
the asset copy is the contract; the `scripts/` copy is an install.
