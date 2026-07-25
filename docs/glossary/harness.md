---
type: Glossary
title: Harness
description: The agent runtime a skill is installed into — it discovers skills in its skill directory and loads their SKILL.md instructions.
timestamp: 2026-07-25
---

# Harness

A **harness** is the agent runtime that consumes a [skill](/glossary/skill.md): it
discovers skill directories in its own skill directory (e.g. `~/.claude/skills`),
reads each root `SKILL.md`, and makes the capability available to the agent. This
library exists to serve multiple harnesses from one working copy.

A **harness profile** is an independently configured instance of a harness, identified
by its configuration root. One harness can therefore have several profiles with
different installed skills and plugin state. For example, `~/.claude` is the personal
Claude Code profile and `~/.claude-work` is the work profile when Claude Code is launched
with the corresponding `CLAUDE_CONFIG_DIR`. Codex profiles that require isolated plugin
state use separate `CODEX_HOME` roots. The profile is the install target; the harness is
the product whose path rules the installer applies.

The gating test runner applies the same concept as a **test profile**: a persistent,
pre-authenticated harness profile at `~/.skills-test-profiles/<harness-id>/`, provisioned
once via `npm run test:auth -- <harness-id>` and used as the only user-scope state a live
skill-test run sees — never the developer's personal profiles above. See
[Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md).

The harness targets the installer supports are declared in one registry
(`scripts/install/registry.mjs` → `REGISTRY`), which models three harness products —
Claude Code, Codex, and OpenCode — each with a project-scoped and a global-scoped skill
directory, Claude Code's global configuration root selected by `CLAUDE_CONFIG_DIR`
(personal `.claude`, work `.claude-work`); any other location is reachable as a custom
install path. The resolved paths per product and scope are in
[/specs/install-sh.md](/specs/install-sh.md).

Used in: [/specs/install-sh.md](/specs/install-sh.md),
[/glossary/skill.md](/glossary/skill.md),
[/decisions/skill-distribution-channels.md](/decisions/skill-distribution-channels.md).
