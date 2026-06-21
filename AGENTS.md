# AGENTS.md

## What this repo is

Source-of-truth for the `okf-docs-setup` skill, which bootstraps an OKF v0.1 docs
bundle in a target repo. The skill is distributed by copy to
`~/.claude/skills/okf-docs-setup/`. There is no application code, no build, no
package.json — only the skill definition and its bundled assets.

## Layout

- `okf-docs-setup/SKILL.md` — skill entry. Frontmatter: `name`, `description`.
- `okf-docs-setup/assets/` — the verbatim bundle copied into target repos.
  - **`assets/claude/` → target `.claude/`** on install (leading-dot rename).
  - `assets/scripts/validate-docs.mjs` — OKF conformance validator (standalone
    Node ESM, no deps).
  - `assets/scripts/validate-docs.test.mjs` — Node built-in test runner.
  - `assets/docs/` — the OKF bundle template (root `index.md`, `log.md`,
    `conventions/`, `glossary/`, `references/`).
  - `assets/claude/skills/{docs-add,docs-validate}/` — helper skills installed
    alongside the bundle.
  - `assets/claude/rules/{docs-authoring,docs-maintenance}.md` — always-on rules.

## Commands (no package.json, no build/lint/typecheck)

- Tests: `node --test okf-docs-setup/assets/scripts/validate-docs.test.mjs`
- Run validator against a bundle (defaults to `docs`):
  `node okf-docs-setup/assets/scripts/validate-docs.mjs <docs-root>`
- There is **no `pnpm docs:validate` here** — that literal string appears
  throughout `assets/` as a package-manager substitution target for the target
  repo, not a command in this repo.

## Critical invariants

- **Assets under `okf-docs-setup/assets/` are byte-exact contract material.**
  Never regenerate from memory; never route through a subagent that summarizes.
  Edit only when intentionally changing the contract, and update the matching
  test if behaviour changes.
- **`<YYYY-MM-DD>`, `<PROJECT>`, `<source-edit-path-glob>` are intentional placeholders** in
  `assets/` — filled per-install. Do not fill them in this source repo.
- **The literal `pnpm docs:validate` is a substitution target.** When rewriting
  the package manager for a target, match the full literal `pnpm docs:validate`,
  never the bare `docs:validate` — the bare form is also a `package.json`
  script *definition* that must stay unchanged.
- **`assets/claude/` ships as `claude/`** and renames to `.claude/` on install.

## Validator quirks

- Advisory only — **always exits 0**. Read stdout, not the exit code.
- Hard errors = unparseable frontmatter or empty/missing `type`. Everything
  else is a soft warning.
- The set of excluded top-level dirs (`superpowers/`) is hardcoded as
  `excludedTopLevelDirs` in `validate-docs.mjs`. Edit there to change.
- A clean install emits exactly one benign warning: the policy file's own
  illustrative `/absolute/path.md` example link. Do not edit the policy to
  chase it.

## Git

- Branch `main`; remote `github.com/artemVeduta/skills.git`.
- Commit style: descriptive prose subjects (see `git log`).

## When editing this repo

- Treat `SKILL.md` and everything under `assets/` as the contract. Prose
  changes to `SKILL.md` are fine; structural changes to `assets/` need a
  reason and should keep the manifest table in `SKILL.md` in sync.
- New skill? Follow the existing `SKILL.md` frontmatter shape (`name`,
  `description`) and place under `okf-docs-setup/` (or a sibling skill dir).
