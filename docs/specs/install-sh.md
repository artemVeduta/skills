---
type: Specification
title: install.sh — library skill installer
description: Contract of scripts/install.sh — how this library's skills are discovered and symlinked into agent-harness skill directories, which harness targets are supported, when re-running is safe, and how it fails.
timestamp: 2026-07-10
---

# install.sh — library skill installer

The executable source of truth is `scripts/install.sh`; this concept states its
contract at the explanatory level. It installs **this library's own skills into the
user's agent harnesses** — a different thing from the
[okf-docs-setup install contract](/okf-docs-setup/specs/install-contract.md), which
describes what that *skill* installs into **target repositories** when it runs.

## Discovery

- A skill is a directory whose root holds a `SKILL.md`. The script discovers only
  `<repo>/skills/<name>/SKILL.md` — at most three path levels below the repo root
  (`find -maxdepth 3`), excluding `.git/` and `node_modules/`.
- Nested `SKILL.md` files (e.g. inside a skill's `assets/`) are children of their
  parent skill and are never installed standalone.
- Discovering zero skills is a hard failure (exit 1).

## Supported harnesses (default targets)

The default target set — the harness skill directories the script offers — is the
`DEFAULT_TARGETS` array in `scripts/install.sh`:

| Target               | Harness                                        |
| -------------------- | ---------------------------------------------- |
| `~/.agents/skills`   | harness-neutral shared skills directory        |
| `~/.claude/skills`   | Claude Code, personal profile                  |
| `~/.claude-work/skills` | Claude Code, work profile (`~/.claude-work`) |

Any other harness is reachable as a **custom path** — via `--target <path>` or the
interactive `c` option (leading `~` is expanded). No other harness is a named
default today; the set may grow as the multi-harness story (issue #4) settles.

## Modes

- **No flags** — interactive: pick skills by comma-separated indices or `a` (all),
  then pick targets by indices, `a` (all defaults), or `c` (custom path).
- **`--list`** — print discovered skills and exit 0. No installation.
- **`--all`** — every discovered skill into every default target, no prompts.
- **`--target <path>`** (repeatable) — every discovered skill into the given
  path(s), no prompts.
- **`--help`** — usage text.

## Install mechanics — symlink, not copy

- The target directory is created if missing (`mkdir -p`).
- Each selected skill is installed as one symlink:
  `<target>/<name>` → `<repo>/<skill-dir>` (`ln -sfn`). Installed skills therefore
  **track the working copy live** — editing the repo updates every harness at once;
  nothing is copied.
- If `<target>/<name>` already exists and is *not* a symlink (a real directory or
  file), it is deleted (`rm -rf`) before linking — destructive to anything
  previously stored under that skill name.
- **Self-symlink guard:** if the target directory itself is a symlink resolving
  into this repo, the install refuses it with an error — otherwise per-skill links
  would be written back into the working copy. Remediation is printed: remove the
  symlink and re-run; the script recreates the target as a real directory.

## Re-run safety

Re-running is idempotent for the symlinked state: `ln -sfn` replaces an existing
link in place, so repeated runs converge on the same result. The one destructive
edge is a *non*-symlink entry at `<target>/<name>`, which is removed and replaced.

## Failure modes

The script runs under `set -euo pipefail`; any unhandled command failure aborts it.

- **Exit 2** — usage errors: unknown flag, `--target` without a path, an invalid
  skill/target menu selection, or an empty custom path.
- **Exit 1** — nothing to do: no skills discovered, no skills selected, or no
  targets selected.
- **Self-symlink guard trip** — aborts the whole run at that target (`set -e`);
  targets already processed keep their links, later targets are not attempted.
