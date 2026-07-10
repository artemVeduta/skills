---
type: Glossary
title: Harness
description: The agent runtime a skill is installed into — it discovers skills in its skill directory and loads their SKILL.md instructions.
timestamp: 2026-07-10
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

The harness targets supported by the installer today (the `DEFAULT_TARGETS` in
`scripts/install.sh` — see [/specs/install-sh.md](/specs/install-sh.md)) are Claude
Code's personal profile (`~/.claude/skills`), a Claude Code work profile
(`~/.claude-work/skills`), and the harness-neutral shared directory
(`~/.agents/skills`); any other harness is reachable as a custom install path.

Used in: [/specs/install-sh.md](/specs/install-sh.md),
[/glossary/skill.md](/glossary/skill.md),
[/decisions/skill-distribution-channels.md](/decisions/skill-distribution-channels.md).
