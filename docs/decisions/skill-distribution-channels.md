---
type: Decision
title: Use three skill distribution channels
description: Keep development links, portable skill installation, and native plugin distribution as separate channels sharing one canonical skill tree.
timestamp: 2026-07-10
---

# Use three skill distribution channels

## Context

The library must serve several installation scenarios without duplicating skill
content or conflating their different lifecycle guarantees:

- authoring from a local checkout, where edits must reach selected harnesses
  immediately;
- installing pure skills on another machine or into a project, where users need
  interactive skill, harness, and scope selection;
- installing the library as a native Codex or Claude Code plugin, where the
  harness owns marketplace discovery, caching, namespacing, and updates;
- targeting multiple independently configured profiles of one harness, such as
  personal Claude Code under `~/.claude` and work Claude Code under
  `~/.claude-work`.

These scenarios cannot share one update mechanism. A live checkout changes as it is
edited, a portable installation is refreshed by the `skills` CLI, and a native plugin
is refreshed through its harness marketplace. Treating them as one installer would
couple this repository to external CLI behavior and obscure which copy a harness loads.

## Decision

`skills/<name>/` remains the one canonical authoring tree. No distribution channel
owns or generates a harness-specific copy of a skill in the repository.

The library supports three distinct channels:

1. **Development links.** `scripts/install.sh` is a development-only, interactive
   wizard. It selects individual skills, harnesses, and harness profiles, previews the
   resulting links, and then symlinks each selected skill directly from the working
   checkout. Editing the checkout therefore changes every linked profile immediately;
   pulling the repository updates them without a separate reinstall.
2. **Portable pure skills.** `npx skills@latest add artemVeduta/skills` is the supported
   package-like installation for pure skills. The upstream CLI owns skill selection,
   harness selection, project/global scope, its canonical `.agents/skills` storage,
   downstream links or copies, lock state, and explicit updates. This channel may target
   any harness supported by that CLI, including Claude Code and Codex. `.agents/skills`
   is a portable project convention, not a promise that every harness uses one universal
   global directory.
3. **Native aggregate plugins.** Codex and Claude Code each receive a thin native
   manifest and marketplace entry that packages the complete `skills/` tree as one
   plugin. Their own CLIs own installation, caching, namespacing, enablement, and updates.
   A Codex plugin is installed separately for each intended `CODEX_HOME`; a Claude Code
   plugin is installed separately for each intended `CLAUDE_CONFIG_DIR`.

A single harness profile must not install the same library through both the pure-skill
and native-plugin channels: the harness would expose duplicate unnamespaced and
namespaced capabilities. Users choose the package shape they want. Pure skills use
`npx skills`; the native aggregate package uses the corresponding marketplace.

### Harness registry

The development wizard and generated README installation guidance share one
declarative harness registry. Each entry owns only installation metadata:

- stable harness identifier and display name;
- project and global skill directories where the harness actually supports them;
- configuration-root environment variable or profile-discovery rules;
- supported scopes and distribution channels;
- any validation needed for a user-supplied custom profile directory.

The registry is the extension point for ordinary pure-skill harnesses. Adding one
consists of adding an entry, contract tests for its paths and selection behavior, and
regenerating or validating the installation guidance. The wizard must not accumulate
per-harness branches for data expressible in the registry.

A small harness adapter is permitted only when native plugin or marketplace operations
require behavior rather than path metadata. Codex and Claude Code are the initial native
adapter categories. Unknown or additional profiles remain reachable through a custom
configuration-directory option.

### Interaction contract

The development wizard uses a modern, step-by-step terminal flow: choose skills, choose
harness types, choose or add profiles/configuration roots for each harness, review an
explicit installation summary, then confirm before changing links. A harness may have
multiple selected profiles in one run. Presentation is replaceable; selection and path
resolution remain independent of the terminal UI and depend on the registry.

## Alternatives

- **One universal installer for every channel.** Rejected because it would reimplement
  and track the changing `skills`, Codex, and Claude CLI contracts, mixing remote package
  management with local development linking.
- **Use `npx skills` for every installation.** Rejected because it installs managed
  snapshots rather than live links to the authoring checkout, and it does not install
  native plugin manifests or marketplace state.
- **Use native plugins for Claude Code and Codex exclusively.** Rejected because users
  may deliberately want those harnesses to consume the same pure, individually selected
  skills as other harnesses.
- **Treat one global `.agents/skills` directory as universal.** Rejected because global
  discovery differs among harnesses and products even when they share the project-local
  `.agents/skills` convention.
- **Hard-code each harness into the shell wizard.** Rejected because every new harness
  would modify control flow, UI, and documentation independently instead of extending a
  single data contract.

## Consequences

- Skill content stays DRY while users can choose live development, portable pure skills,
  or a native aggregate plugin.
- Update semantics are explicit: repository pull for development links, `skills update`
  for portable installations, and the harness plugin updater for native plugins.
- Codex and Claude Code remain valid `npx skills` targets; native plugins are an optional
  package shape, not a mandatory harness classification.
- Multiple personal/work profiles are first-class targets rather than special directory
  constants embedded in installer logic.
- Adding a conventional harness should be a registry-and-tests change; only native
  marketplace integration earns a behavioral adapter.
- The README must explain three channels and warn against installing pure and plugin
  forms into the same profile.
- Supporting several channels adds documentation and validation work, but each external
  package manager remains responsible for its own installation lifecycle.

## Amendments

## 2026-07-10 — Link the whole library during development

[The skill-dependency decision](https://github.com/artemVeduta/skills/issues/6) revises
development installation from per-skill selection to whole-library installation. The
development wizard selects harness profiles and symlinks every library skill into each
selected profile, after validating the dependency graph. Because the whole canonical
skill tree is present, development installation does not need to resolve a selected
skill's closure.

Portable installation remains selective. Its target contract expands required
dependencies by default and permits bypass only through an explicit unsafe option. The
current upstream `skills` CLI does not yet implement dependency metadata or closure, so
safe selective portable installation of dependent skills remains contingent on upstream
support; `--skill '*'` is the current whole-library fallback.
