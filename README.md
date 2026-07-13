# skills

Personal library of agent skills. Each skill is a self-contained directory under
`skills/<name>/` (one flat tree, no category buckets) whose root `SKILL.md` defines
the capability.

## Skills

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
