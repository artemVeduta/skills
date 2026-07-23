# OpenCode configuration evidence for issue #38

Research date: 2026-07-23. The implementation evidence below is pinned to
[OpenCode v1.18.4](https://github.com/anomalyco/opencode/releases/tag/v1.18.4)
(`49c69c5ed3ccf706b61b3febb43c8aaff7f8325e`, released 2026-07-20). The
documentation pages were checked on 2026-07-23. Only official OpenCode
documentation, schema, release metadata, and source are used.

## Executive conclusion

The OpenCode adapter should be **thin and non-authoritative**:

- the portable contract is a project `AGENTS.md`, strict portable `SKILL.md`
  files, and repository scripts/CI;
- OpenCode already discovers `AGENTS.md` and `.agents/skills/` without an
  `opencode.json`, so neither `instructions` nor `skills.paths` is required for
  the core path;
- `opencode.json` instructions, `.opencode/agents/`, `.opencode/commands/`, and
  `.opencode/plugins/` may improve ergonomics, but they must only call or point
  to the portable core and must not contain unique policy or enforcement.

This boundary remains functional with Claude compatibility disabled and with
external plugins disabled. It also avoids making config precedence, user
environment flags, or OpenCode-only subagent routing part of the docs
lifecycle.

## 1. Instruction discovery: `AGENTS.md`, `CLAUDE.md`, and `instructions`

### Native and compatibility files

OpenCode's native project instruction file is `AGENTS.md`; its native global
file is `~/.config/opencode/AGENTS.md`. Claude compatibility is enabled by
default: project `CLAUDE.md` is a fallback only when no project `AGENTS.md` is
found, and `~/.claude/CLAUDE.md` is a global fallback only when
`~/.config/opencode/AGENTS.md` is absent.
([Rules documentation](https://opencode.ai/docs/rules/),
[v1.18.4 instruction loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/session/instruction.ts))

The release implementation is more precise than the short docs wording. It
tries project filename classes in this order: `AGENTS.md`, `CLAUDE.md`, then
deprecated `CONTEXT.md`. For the first class with any matches, it includes all
matches from the current directory up to the worktree root; it does not then
include the lower-priority filename classes. The independently selected global
file is also included. Therefore a project `AGENTS.md` does not suppress the
global OpenCode `AGENTS.md`, but any project `AGENTS.md` match suppresses all
project `CLAUDE.md` matches.
([v1.18.4 instruction loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/session/instruction.ts),
[filesystem walk implementation](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/core/src/fs-util.ts))

OpenCode does not interpret Claude's `@file` import syntax. Its official
alternatives are config-wired `instructions` for eager inclusion or prose in
`AGENTS.md` telling the model to read referenced files when relevant.
([Rules documentation](https://opencode.ai/docs/rules/))

### Config-wired custom instructions

`instructions` is an array of file paths, glob patterns, or HTTP(S) URLs. Its
matches are combined with the auto-discovered global/project instruction files;
remote content has a five-second fetch timeout. Local absolute paths and `~/`
paths are supported. Relative patterns are resolved by globbing from the
session directory upward to the worktree, **not relative to the config file
that declared them**.
([Rules documentation](https://opencode.ai/docs/rules/),
[config schema](https://opencode.ai/config.json),
[v1.18.4 instruction loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/session/instruction.ts))

When multiple config layers define `instructions`, v1.18.4 concatenates the
arrays and removes exact duplicates while preserving first-seen order. This is
a deliberate exception to the ordinary deep config merge. Consequently, a
higher-precedence project config cannot remove global instruction entries by
supplying a replacement array.
([v1.18.4 config merger](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/config.ts))

### Relevant environment switches

- `OPENCODE_DISABLE_CLAUDE_CODE=1` disables both Claude prompt and Claude skill
  compatibility.
- `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1` disables only `CLAUDE.md`
  compatibility.
- `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` disables only `.claude/skills`
  discovery.
- `OPENCODE_DISABLE_PROJECT_CONFIG=1` disables project `opencode.json`,
  project `.opencode` directories, and project instruction-file discovery; the
  native global `~/.config/opencode/AGENTS.md` still remains available.

The first three are documented; the project-config switch and exact boolean
composition are confirmed in release source.
([Rules documentation](https://opencode.ai/docs/rules/),
[runtime flags](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/effect/runtime-flags.ts),
[core flags](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/core/src/flag/flag.ts),
[instruction loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/session/instruction.ts))

## 2. Config locations, merge, and precedence

OpenCode accepts JSON or JSONC. Config layers are merged rather than replaced:
non-conflicting values survive and later layers override conflicting values.
The documented order from lowest to highest is remote organizational config,
global `~/.config/opencode/opencode.json`, the file named by
`OPENCODE_CONFIG`, project `opencode.json`, `.opencode` directory material,
inline `OPENCODE_CONFIG_CONTENT`, managed files, and macOS managed preferences.
Managed settings are intentionally not user-overridable.
([Config documentation](https://opencode.ai/docs/config/),
[v1.18.4 config loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/config.ts))

Project config discovery walks from the session directory up to the worktree
root and merges root-first, so nearer project files win. If both JSON and JSONC
variants exist at one location, JSONC is loaded later and wins. Object values
are deep-merged. `instructions` has the concatenate/deduplicate rule above;
plugin declarations are accumulated and deduplicated by plugin identity with
the later declaration winning.
([config paths](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/paths.ts),
[config merger](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/config.ts),
[plugin config merger](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/plugin.ts))

`OPENCODE_CONFIG_DIR` adds another config directory after the ordinary global
and project `.opencode` directories. It is scanned using the same directory
loaders for OpenCode JSON/JSONC, agents, commands, plugins, and skills.
`OPENCODE_CONFIG` names one config file between global and project precedence;
`OPENCODE_CONFIG_CONTENT` is an inline late override.
([Config documentation](https://opencode.ai/docs/config/),
[config paths](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/paths.ts),
[config loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/config.ts),
[skill loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/skill/index.ts))

Important separation: config precedence governs `opencode.json` values; it does
not turn `AGENTS.md` into an overrideable config key. Auto-discovered
instruction files are selected by the independent instruction loader, and
config `instructions` are added to them.
([instruction loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/session/instruction.ts))

## 3. Skill discovery and `skills.paths`

Without any config wiring, OpenCode searches:

- project `.opencode/skills/`, `.claude/skills/`, and `.agents/skills/` while
  walking from the current directory to the worktree;
- global `~/.config/opencode/skills/`, `~/.claude/skills/`, and
  `~/.agents/skills/`.

It advertises skill names and descriptions through the built-in `skill` tool,
then loads a selected skill body on demand.
([Skills documentation](https://opencode.ai/docs/skills/),
[v1.18.4 skill loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/skill/index.ts))

`skills.paths` and `skills.urls` are additional, config-wired discovery
channels. A `skills.paths` entry may be absolute, `~/`-relative, or relative;
relative entries resolve from the session directory, and every `SKILL.md`
recursively below the selected directory is scanned. These paths supplement,
not replace, auto-discovery.
([skills schema](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/core/src/v1/config/skills.ts),
[v1.18.4 skill loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/skill/index.ts))

`OPENCODE_DISABLE_EXTERNAL_SKILLS=1` disables both `.claude` and `.agents`
external discovery, but does not disable `.opencode` skills or
`skills.paths`/`skills.urls`. The Claude-specific switches only remove the
`.claude` side. Notably, `OPENCODE_DISABLE_PROJECT_CONFIG=1` removes project
`.opencode` discovery but the external `.agents`/`.claude` walk is controlled
by the separate external-skill flags.
([runtime flags](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/effect/runtime-flags.ts),
[v1.18.4 skill loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/skill/index.ts))

The docs require `name` and `description` and document strict name/length
rules. There is a release-source discrepancy: v1.18.4 accepts a string `name`
without enforcing those rules and accepts a missing `description`, but its
formatter omits descriptionless skills from the model-facing available-skills
list. The portable pack should obey the stricter documented contract; loader
leniency is not a usable compatibility guarantee.
([Skills documentation](https://opencode.ai/docs/skills/),
[v1.18.4 loader and formatter](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/skill/index.ts),
[release test covering a descriptionless skill](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/test/skill/skill.test.ts))

Duplicate skill names overwrite an earlier loaded entry and emit a warning.
Because v1.18.4 parses discovered files concurrently, no adapter should depend
on which duplicate path wins. This is especially relevant when one repository
contains both `.claude/skills/` and `.agents/skills/`: both may be discovered.
If dual placement is required for the three-harness pack, both paths must
symlink to the exact same canonical skill rather than carry harness-specific
variants.
([v1.18.4 skill loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/skill/index.ts))

## 4. Agents and subagents

OpenCode agents may be declared under the JSON `agent` key or as Markdown in
global `~/.config/opencode/agents/` and project `.opencode/agents/`. Markdown
filename becomes agent name and the body becomes its prompt. The loader scans
OpenCode config directories; it has no `.claude/agents/` compatibility path.
([Agents documentation](https://opencode.ai/docs/agents/),
[v1.18.4 agent loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/agent.ts))

An agent mode is `primary`, `subagent`, or `all` (default `all`). Subagents can
be selected by the model through the Task tool or invoked directly by the user
with `@name`; `permission.task` controls model routing, while a user may still
invoke a visible subagent directly. `subagent_depth` defaults to `1`: a primary
agent may launch a subagent, but that subagent may not launch another. `0`
disables launches and `2` allows one additional nested level.
([Agents documentation](https://opencode.ai/docs/agents/),
[Config documentation](https://opencode.ai/docs/config/),
[v1.18.4 Task tool](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/tool/task.ts))

These definitions are orchestration conveniences, not portable skills. A docs
workflow that requires a specifically named OpenCode subagent, its Task
permissions, or a depth greater than one will not have identical behavior in
Claude Code or Codex.

## 5. Plugins, hooks, and commands

OpenCode has no declarative Claude/Codex-style `hooks` config block in its
published config schema. Hook-equivalent behavior is code in JavaScript or
TypeScript plugins, auto-loaded from `.opencode/plugins/` or
`~/.config/opencode/plugins/`, or installed from npm entries in `plugin`.
Plugins can implement event handlers and hooks including
`tool.execute.before`, `tool.execute.after`, and `shell.env`.
([Published config schema](https://opencode.ai/config.json),
[Plugins documentation](https://opencode.ai/docs/plugins/))

Plugin order is global config, project config, global plugin directory, then
project plugin directory; hooks run sequentially. `opencode --pure` sets
`OPENCODE_PURE=1` and suppresses external plugins, although built-in OpenCode
plugins remain separate. Therefore plugin enforcement cannot be part of the
cross-harness correctness contract.
([Plugins documentation](https://opencode.ai/docs/plugins/),
[v1.18.4 CLI flag](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/index.ts),
[v1.18.4 plugin loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/plugin/index.ts))

OpenCode commands may be declared under JSON `command` or as Markdown in
`.opencode/commands/` and `~/.config/opencode/commands/`. They support
OpenCode-specific templating and agent/subtask routing. They are suitable
shortcuts for invoking portable scripts or skills, but not a delivery vehicle
for policy that must work in the other harnesses.
([Commands documentation](https://opencode.ai/docs/commands/),
[v1.18.4 command loader](https://github.com/anomalyco/opencode/blob/v1.18.4/packages/opencode/src/config/command.ts))

## 6. Recommended adapter boundary for the OKF docs suite

### Portable, load-bearing core

1. Put the complete always-on docs lifecycle wiring in root `AGENTS.md`.
   Required behavior must be self-contained prose or explicit lazy-read
   directions, not `@imports`.
2. Keep each workflow in a strict portable `SKILL.md` with valid `name` and
   `description`. Install/discover it through canonical harness paths; OpenCode
   needs no extra wiring for `.agents/skills/`.
3. Put validation and state-changing enforcement in repository scripts, package
   scripts, git hooks where appropriate, and CI. The same command is then
   callable by all three harnesses.
4. Phrase orchestration requirements by capability and outcome. Do not require
   an OpenCode agent name, Task-tool permission, nesting depth, command, or
   plugin.

### Optional OpenCode adapter

An optional, checked-in OpenCode adapter may contain:

- `opencode.json` `instructions` entries that eagerly load a small index or
  convention already reachable through `AGENTS.md`;
- `skills.paths` only for a development checkout outside normal discovery
  paths, never for the installed pack;
- `.opencode/commands/*.md` shortcuts that invoke canonical skills or repository
  scripts;
- `.opencode/agents/*.md` wrappers for a docs writer/reviewer, with all actual
  workflow rules remaining in the portable skill and docs;
- `.opencode/plugins/*.ts` notifications or pre/post-tool validation that call
  the same portable validator.

The adapter must contain no unique lifecycle rule, file-format rule, or
correctness check. Deleting `opencode.json` and `.opencode/plugins/` should
reduce convenience only, not change a correct docs outcome.

### Acceptance checks

- Run OpenCode with `OPENCODE_DISABLE_CLAUDE_CODE=1` to prove that native
  `AGENTS.md` plus `.agents/skills/` is sufficient.
- Run with `--pure` to prove that no external plugin is load-bearing.
- Exercise the workflow without OpenCode commands or custom agents.
- If both `.claude/skills/` and `.agents/skills/` exist, assert that they resolve
  to the same canonical content; never use duplicate-name precedence as an
  adapter seam.
- Separately document that `OPENCODE_DISABLE_PROJECT_CONFIG=1` intentionally
  disables the project instruction/config entry point, and
  `OPENCODE_DISABLE_EXTERNAL_SKILLS=1` intentionally disables portable external
  skill discovery. Those are explicit user kill-switches, not parity modes the
  pack can override.

## Risks to carry into the architecture decision

1. **`instructions` accumulation and cwd-relative globs.** Global and project
   entries accumulate, and relative patterns are session-relative. They can
   silently add context or match different files from different launch
   directories.
2. **Managed/config overrides.** Project OpenCode settings are not the highest
   possible layer. Anything correctness-critical in config can be changed by
   inline, account/managed, or environment-controlled state.
3. **Compatibility kill-switches.** Claude fallbacks, external skills, project
   config, and plugins can each be disabled independently.
4. **Duplicate skill names.** Dual `.claude`/`.agents` placement is visible to
   OpenCode, and the release loader does not provide a safe adapter precedence.
5. **Docs/source mismatch.** The v1.18.4 loader is more permissive than the
   published skill contract. Author to the strict contract, not observed
   leniency.
6. **Subagent and plugin non-portability.** Agent formats, Task routing/depth,
   and executable plugin hooks are OpenCode-specific. They may improve UX but
   cannot guarantee the shared lifecycle.
