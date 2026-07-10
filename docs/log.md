# Bundle change log

## 2026-07-10

- **Update** of [/glossary/harness.md](/glossary/harness.md) — distinguished a harness
  product from independently configured harness profiles and recorded the
  `CLAUDE_CONFIG_DIR` and `CODEX_HOME` isolation boundaries.
- **Creation** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
  — separated development symlinks, portable pure-skill installation, and native
  aggregate plugins; defined profile exclusivity and the registry-driven flow for
  adding harnesses. Adds the reserved [/decisions/index.md](/decisions/index.md).
- **Creation** of [/glossary/harness.md](/glossary/harness.md) — the term "harness":
  the agent runtime a skill is installed into, with today's supported install
  targets.
- **Creation** of [/glossary/skill.md](/glossary/skill.md) — the term "skill": a
  directory-rooted capability bundle defined by a root `SKILL.md`, the unit this
  library stores and distributes.
- **Creation** of [/specs/install-sh.md](/specs/install-sh.md) — contract of
  `scripts/install.sh`: SKILL.md discovery (and the current `skills/<name>/` layout
  mismatch, pending issue #4), the default harness targets (`~/.agents/skills`,
  `~/.claude/skills`, `~/.claude-work/skills`), symlink-not-copy mechanics, re-run
  safety, and exit semantics. Adds the reserved `/specs/index.md`.
- **Creation** of [/okf-docs-setup/specs/install-contract.md](/okf-docs-setup/specs/install-contract.md)
  — the okf-docs-setup install contract: what an install delivers (docs bundle, validator
  scripts, `.claude` rules and helper skills, package.json scripts), the per-install
  substitutions, the `claude/` → `.claude/` rename, the machinery-vs-content phase
  structure, and the zero-hard-errors done criteria.
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
