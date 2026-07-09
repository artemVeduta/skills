# Bundle change log

## 2026-07-10

- **Creation** Added the `okf-docs-setup` subsystem index node (`/okf-docs-setup/index.md`)
  covering the skill that bootstraps OKF v0.1 docs bundles in target repos.
- **Creation** of [/okf-docs-setup/conventions/byte-exact-assets.md](/okf-docs-setup/conventions/byte-exact-assets.md)
  — byte-exact assets contract, intentional placeholders, the `pnpm docs:validate`
  substitution target, and the `claude/` → `.claude/` install rename, converted from `AGENTS.md`.
- **Creation** of [/okf-docs-setup/specs/validator.md](/okf-docs-setup/specs/validator.md)
  — validator behaviour (advisory exit 0, hard errors vs soft warnings, `excludedTopLevelDirs`,
  the one benign policy-link warning) and repo invocation via `npm run docs:validate`,
  converted from `AGENTS.md`.
- **Creation** of [/conventions/git.md](/conventions/git.md) — repo-wide git convention
  (branch `main`, descriptive prose commit subjects), converted from `AGENTS.md`.
- **Initialization**: Established the OKF v0.1 bundle skeleton (root, conventions,
  glossary, references) and installed the validator, the `docs-authoring` rule, and the
  `docs-add` / `docs-validate` skills.
- **Creation**: Authored the governance concept
  [Documentation lifecycle policy](/conventions/documentation.md) and the
  [OKF reference](/references/okf.md).
