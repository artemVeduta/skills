---
type: Convention
title: Byte-exact assets contract
description: Rules for editing the docs-setup skill's assets, its intentional placeholders, the package-manager substitution target, and the claude/ install rename.
timestamp: 2026-07-24
---

# Byte-exact assets contract

- **Everything under `skills/docs-setup/assets/` is byte-exact contract
  material.** It is copied verbatim into target repos on install. Never
  regenerate it from memory; never route it through a subagent that summarizes.
- **Edit assets only when intentionally changing the contract.** Structural
  changes need a reason. When behaviour changes, update the matching test
  (`skills/docs-setup/assets/scripts/validate-docs.test.mjs`) and keep the
  manifest table in `skills/docs-setup/SKILL.md` in sync.
- **The two validator mirror pairs are mechanically enforced.** A focused
  repository-only test reached by `npm test`
  (`scripts/validate-docs-mirror.test.mjs`) compares the asset and installed
  copies of `validate-docs.mjs` and `validate-docs.test.mjs` as raw buffers; it
  fails on missing files and any byte difference and never repairs. When
  changing the validator, edit the asset and recopy it over `scripts/`.
- **`<YYYY-MM-DD>`, `<PROJECT>`, and `<pm>` are intentional
  placeholders** throughout `assets/` — they are filled per-install. Do not
  fill them in this source repo.
- **The literal `pnpm docs:validate` inside `assets/` is a substitution
  target**, not a command. When rewriting the package manager for a target
  repo, match the full literal `pnpm docs:validate`, never the bare
  `docs:validate` — the bare form is also a `package.json` script *definition*
  that must stay unchanged. (This repo's own bundle is validated with
  `npm run docs:validate`; see
  [/docs-setup/specs/validator.md](/docs-setup/specs/validator.md).)
- **`assets/claude/` ships as `claude/`** and is renamed to `.claude/` on
  install (leading-dot rename).

## Rationale

The assets are the distributed product: whatever bytes live in
`skills/docs-setup/assets/` land verbatim in every target repo. Any
"helpful" regeneration, summarization, or premature placeholder-filling
silently changes the contract for all future installs, and a bare
`docs:validate` match would corrupt the shipped `package.json` script
definitions.
