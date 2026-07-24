# skills

Personal library of agent skills. Each skill is a self-contained directory under
`skills/<name>/` (one flat tree, no category buckets) whose root `SKILL.md` defines
the capability.

## Skills

- [`docs-add`](skills/docs-add/SKILL.md) — file one OKF concept (Decision,
  Specification, Convention, Glossary, Reference, or subsystem index) into a
  `docs/` bundle — frontmatter, body, parent `index.md` entry, and `log.md`
  lifecycle entry — under a single approval, then validate and read it back.
- [`docs-validate`](skills/docs-validate/SKILL.md) — run a repository's strict
  `docs:validate` script through its own package manager and interpret the
  result: clean/warnings-only, hard bundle errors, or validator malfunction.
- [`docs-sync`](skills/docs-sync/SKILL.md) — reconcile an OKF `docs/` bundle
  with a branch's work: pick the mode and a target branch, scope from the
  merge-base through the whole working state, fan out to disjoint concept
  owners with one reconciler for indexes/logs/timestamps, compact branch-local
  drafting down to the accepted net state (one net lifecycle entry per concept,
  merged history preserved, a material reversal gated behind a linked
  supersession), verify, and run the validator — all in the working tree, never
  touching Git state; declares `docs-validate` as a required skill.
- [`docs-setup`](skills/docs-setup/SKILL.md) — install, upgrade, reinstall, or
  repair the OKF v0.1 docs machinery in a repository (validator + tests, package
  scripts, seed policy/reference, marked `AGENTS.md` router, exact `CLAUDE.md`
  shim) — state recomputed from the repo every run, through read-only audits, one
  approved plan, and one deterministic writer; declares `docs-add` and
  `docs-validate` as required skills.
- [`okf-docs-setup`](skills/okf-docs-setup/SKILL.md) — set up or standardize a
  repository's documentation as an OKF (Open Knowledge Format) v0.1 bundle:
  validator, docs-add/docs-validate skills, rules, frontmatter taxonomy.

## Install

The library ships through three channels — alternative package shapes, not harness
categories. Pick one shape per harness profile (see the warnings below).

<!-- BEGIN dev-install (generated from registry) -->
### Development links

Clone the repository and run the interactive installer; it symlinks every
library skill from the working checkout into the harness profiles you select,
so edits and `git pull` reach every linked profile live:

```bash
git clone https://github.com/artemVeduta/skills.git
cd skills
./scripts/install.sh
```

Supported harnesses:

- **Claude Code** (`claude-code`)
- **Codex** (`codex`)
- **Shared agents directory** (`agents`)

Update path: `git pull` (no reinstall).
<!-- END dev-install -->

### Portable pure skills

Managed, updatable skill copies without cloning the repository, via the upstream
`skills` CLI:

```bash
npx skills@latest add artemVeduta/skills --skill '*'
```

The upstream CLI owns skill and harness selection, project vs. global scope, its
own storage, lock state, and updates (`skills update`). Until that CLI understands
the `## Required skills` dependency convention, install the whole library with
`--skill '*'`: selective installs cannot guarantee that a skill's dependencies
come along.

### Native aggregate plugins

Install the whole library as one native plugin; the harness CLI owns install,
namespacing, enablement, and updates, per configuration root
(`CLAUDE_CONFIG_DIR` / `CODEX_HOME`).

**Claude Code:**

```bash
claude plugin marketplace add artemVeduta/skills
claude plugin install skills@artemveduta
```

Skills install namespaced (e.g. `/skills:okf-docs-setup`). Update path:
`claude plugin marketplace update artemveduta` (the harness plugin updater).

**Codex:**

```bash
codex plugin marketplace add artemVeduta/skills
codex plugin add skills@artemveduta
```

Update path: `codex plugin marketplace upgrade artemveduta` (the harness
plugin updater).

## Warnings

- **Do not install this library through both the pure-skill and native-plugin
  channels in one harness profile.** The harness would expose duplicate namespaced
  and unnamespaced capabilities — pick one shape per profile.
- **`~/.agents/skills` doubles as the portable CLI's own storage.** It is both a
  development symlink target and where `npx skills` keeps its managed copies; do
  not point both channels at the same directory.
