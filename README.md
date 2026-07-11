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

### Development links

For working on the library itself. Clone the repository and run the interactive
installer; it symlinks library skills from the working checkout into the harness
profiles you select, so edits and `git pull` reach every linked profile live:

```bash
git clone https://github.com/artemVeduta/skills.git
cd skills
./scripts/install.sh
```

Update path: `git pull` (no reinstall).

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

Claude Code and Codex each get a thin native plugin packaging the complete skill
tree; the harness CLI owns install, namespacing, enablement, and updates, per
configuration root (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`). The marketplace manifests
have not landed yet — until they do, use one of the two channels above.

## Warnings

- **Do not install this library through both the pure-skill and native-plugin
  channels in one harness profile.** The harness would expose duplicate namespaced
  and unnamespaced capabilities — pick one shape per profile.
- **`~/.agents/skills` doubles as the portable CLI's own storage.** It is both a
  development symlink target and where `npx skills` keeps its managed copies; do
  not point both channels at the same directory.
