# Claude Code configuration contract for harness parity

> Evidence for GitHub issue
> [#38](https://github.com/artemVeduta/skills/issues/38), “Harness parity
> architecture: one pack, same behavior everywhere.” Researched 2026-07-23
> against current first-party Anthropic documentation. This note covers only the
> Claude Code side of the three-harness contract. It does not change repository
> policy or GitHub state.

## Executive answer

Claude Code has one required adapter for an `AGENTS.md`-centred portable pack:
a root `CLAUDE.md` containing `@AGENTS.md`. Claude Code explicitly reads
`CLAUDE.md`, not `AGENTS.md`, and Anthropic recommends exactly that import or a
symlink for repositories shared with other coding agents. Relative imports resolve
from the importing file, so putting the shim at the repository root makes the
one-line import resolve to the root `AGENTS.md`.
[Memory: imports and AGENTS.md][memory-imports]

Everything else needed for parity should remain outside the Claude adapter:

1. `AGENTS.md` owns the short, universal OKF routing contract: when to consult
   `docs/`, how to find the governing convention and relevant concepts, and when
   documentation may be updated.
2. Spec-strict `SKILL.md` directories own reusable documentation procedures.
   Claude Code discovers the same content when it is placed or linked under
   `.claude/skills/`; this is a distribution-path adapter, not a content fork.
   Claude loads skill descriptions at startup and full bodies only on use.
   [Skills: locations and discovery][skills-discovery]
   [Extension loading model][extension-loading]
3. Repository scripts and CI own deterministic validation and enforcement. Anthropic
   says `CLAUDE.md` and memory are context, not enforced configuration; hooks can
   enforce inside Claude Code, but are harness-specific and can be blocked by managed
   policy. Therefore a Claude hook may call the same portable validation script as a
   convenience, but it cannot be the only place that enforces the invariant.
   [Memory is context, not enforcement][memory-context]
   [Hook scope and managed restrictions][hooks-locations]
4. `.claude/rules/`, `.claude/settings.json` hooks, and `.claude/agents/*.md` may
   improve Claude Code ergonomics, but must contain no unique OKF knowledge, required
   step, or only copy of an enforcement rule. Rules are Claude-specific prompt
   context; hooks are Claude-specific event wiring; agents are Claude-specific
   isolated workers with their own precedence and invocation semantics.
   [Extension comparison][extension-overview]

The architectural boundary is therefore:

```text
portable contract                Claude Code adapter
-------------------------------  -------------------------------------------
AGENTS.md                         CLAUDE.md -> @AGENTS.md       (required)
skills/<name>/SKILL.md            .claude/skills/<name>         (placement)
scripts + package tasks + CI      optional settings hook -> same script
docs/ OKF bundle                  optional rules/agents -> no unique behavior
```

“Same behavior” should mean the same required instructions, procedures, source
documents, and validation commands are available in every harness. It cannot mean
byte-identical model choices: Anthropic documents prompt instructions as advisory
context whose handling can vary, especially when instructions conflict.
[Memory guidance and conflicts][memory-writing]

## Auto-discovery versus explicit wiring

| Mechanism | Automatically discovered by Claude Code | Explicitly wired or selected | Scope / precedence |
|---|---|---|---|
| `CLAUDE.md` / `CLAUDE.local.md` | Yes. Claude walks from the filesystem root through the working directory at launch; nested files below the working directory load when Claude accesses that subtree. | `@path` imports inside a memory file are explicit includes. `AGENTS.md` has no native discovery. | Managed, user, project, then local content is additive; nearer project content is appended later. [Memory load order][memory-load] |
| `@AGENTS.md` | No. The target is loaded only because a discovered `CLAUDE.md` imports it. | The root shim explicitly imports it; a symlink is the other documented option. | Relative to the importing file; recursive imports stop after four hops. [Memory imports][memory-imports] |
| `.claude/rules/**/*.md` and `~/.claude/rules/**/*.md` | Yes, recursively. Rules without `paths` load at launch; path-scoped rules load when matching files are read. | `paths` frontmatter gates a rule to matching files. | User rules load before project rules. Unscoped project rules have the same priority as `.claude/CLAUDE.md`. [Rules][memory-rules] |
| Settings files | Yes: user `~/.claude/settings.json`, shared project `.claude/settings.json`, and local project `.claude/settings.local.json`; managed settings arrive through enterprise channels. | Individual keys configure behavior. `--settings` or other CLI arguments add a session layer. | Managed > CLI > local > project > user for ordinary scalar settings; arrays usually merge. [Settings scopes][settings-scopes] [Settings precedence][settings-precedence] |
| Skills | Yes from enterprise, `~/.claude/skills/`, project/ancestor `.claude/skills/`, nested `.claude/skills/` on demand, enabled plugins, and `.claude/skills/` inside `--add-dir`. | A user invokes `/name`, or Claude selects a skill from its description. Frontmatter can change invocation. | Enterprise > personal > project by name; plugin skills are namespaced. [Skills discovery][skills-discovery] |
| Hook scripts | No. Merely placing a script in `.claude/hooks/` does not register it; the official configuration surface is the `hooks` key in settings, plugin `hooks/hooks.json`, or skill/agent frontmatter. | The JSON/frontmatter names the event, matcher, handler type, and command/URL/prompt/agent. | Matching hooks merge and all fire; managed policy can suppress non-managed hooks. [Claude directory map][claude-directory] [Hook reference][hooks-locations] [Feature layering][feature-layering] |
| Agents / subagents | Yes from managed definitions, project and user `agents/` directories, and enabled plugins; project/user directories are scanned recursively. | `--agents` injects session-only definitions. Claude may delegate by description, `@`-mention guarantees one invocation, and `--agent` or the `agent` setting runs the whole session as that agent. | Managed > `--agents` > project > user > plugin. [Subagent scope][subagent-scope] [Subagent invocation][subagent-invocation] |

The current official `.claude` directory reference lists project and global
`CLAUDE.md`, `rules`, `settings`, `skills`, and `agents` as authored discovery
surfaces. It describes hook behavior under the `hooks` key of `settings.json`, not as
standalone script discovery. That distinction is why `.claude/hooks/validate.sh`
without a settings/frontmatter registration is inert.
[Claude directory map][claude-directory]

## `CLAUDE.md`, `@AGENTS.md`, and memory

### Scopes and load order

Claude supports managed-policy memory, user memory at `~/.claude/CLAUDE.md`, project
memory at either `./CLAUDE.md` or `./.claude/CLAUDE.md`, and private project memory at
`./CLAUDE.local.md`. The documented order is broadest to most specific. Files at and
above the working directory load in full at launch; files below it load when Claude
reads in their subdirectory.
[Memory locations][memory-locations]

Within the directory walk, memory is concatenated rather than overridden: filesystem
root to working directory, with `CLAUDE.local.md` after `CLAUDE.md` at the same level.
This is not settings-style precedence, and conflicting instructions are not resolved
by a deterministic client rule. Anthropic warns that Claude may choose arbitrarily
between contradictions.
[Memory load algorithm][memory-load]
[Memory writing guidance][memory-writing]

### Import behavior

`@path` imports are expanded into context at launch. Paths may be relative or
absolute; relative paths resolve from the file containing the import. Imports may
nest four hops, and import parsing ignores Markdown inline-code and fenced-code
regions. A project-memory import that resolves outside the working directory requires
one-time user approval; imports from user memory carry user-configuration trust and do
not show that dialog.
[Memory imports and trust][memory-imports]

The parity shim should consequently be the repository-root file:

```markdown
@AGENTS.md
```

Using `.claude/CLAUDE.md` would require `@../AGENTS.md`, because the import is relative
to `.claude/CLAUDE.md`. Keeping the root shim to one import also prevents Claude-only
instructions from silently becoming part of the required portable behavior.
[Memory imports and AGENTS.md][memory-imports]

The `/init` command's ability to read other agent configuration is generation-time
assistance, not native session discovery of `AGENTS.md`. The runtime contract remains
the explicit statement that Claude Code reads `CLAUDE.md`, not `AGENTS.md`.
[AGENTS.md guidance][memory-imports]

### `.claude/rules`

Claude recursively discovers Markdown rules under project `.claude/rules/`. A rule
without `paths` frontmatter loads unconditionally at launch; a rule with `paths`
frontmatter is injected when Claude reads a matching file. Personal rules at
`~/.claude/rules/` apply to every project and load before project rules. Rule
directories and files may be symlinked.
[Rules discovery and path gating][memory-rules]
[User rules and symlinks][memory-user-rules]

Rules remain advisory context, not enforcement. For parity, they may provide an
additional Claude-only reminder such as “for `docs/**`, use the portable docs skill,”
but the same requirement must already be reachable through `AGENTS.md`. A rule must
not be the sole location of an OKF lifecycle constraint, vocabulary definition,
update procedure, or validation command.
[Memory is context, not enforcement][memory-context]

## Settings: user, project, local, and managed

The authored settings locations are:

- user: `~/.claude/settings.json`, personal and cross-project;
- shared project: `.claude/settings.json`, normally committed;
- local project: `.claude/settings.local.json`, personal to one repository and
  gitignored when Claude Code creates it;
- managed: server, MDM/OS policy, or system-level managed settings.

Claude also accepts session CLI settings. Ordinary precedence is managed, CLI, local,
project, user. Managed settings cannot be overridden, including by CLI arguments.
Most arrays concatenate and de-duplicate across scopes rather than replacing one
another, so permissions and other array-valued policies can accumulate from several
layers.
[Settings files and scopes][settings-files]
[Settings precedence and array merge][settings-precedence]

This precedence must not be reused as a mental model for every Claude feature:

- memory files are additive;
- skills override by name using enterprise > personal > project;
- subagents override by name using managed > CLI > project > user > plugin;
- matching hooks merge and all run.

Anthropic documents these four distinct layering rules explicitly.
[Feature layering][feature-layering]

Settings are therefore an adapter configuration surface, not a portable content
surface. A shared project setting may register an optional hook that calls a portable
script, but the pack must remain correct if local or managed policy changes the
settings environment or if a malformed non-managed settings file is rejected.
Non-managed user, project, and local files are validated strictly and rejected as a
whole when invalid.
[Settings validation][settings-files]

## Skills

Claude Code skills use a directory with a required `SKILL.md`. The documented native
locations are personal `~/.claude/skills/<name>/SKILL.md`, project
`.claude/skills/<name>/SKILL.md`, enterprise-managed skills, and plugin
`skills/<name>/SKILL.md`. Claude also walks project `.claude/skills/` from the starting
directory to the repository root and discovers nested project skill directories on
demand. The official discovery list does not include `.agents/skills/`, so this pack
needs a `.claude/skills/` placement/link or a Claude plugin even if the canonical
portable installation also uses `.agents/skills/`.
[Skills locations and automatic discovery][skills-discovery]

Claude Code follows symlinked skill directories in enterprise, personal, and project
locations and de-duplicates the same target reached through more than one path. It
watches existing skill directories for `SKILL.md` changes during a session; creating a
previously absent top-level skill directory requires restart.
[Skill symlinks and live detection][skills-live]

By default both user and Claude may invoke a skill. Descriptions are advertised in
context at startup; the full `SKILL.md` body loads only when invoked and then remains
in conversation context. `disable-model-invocation: true` hides the description from
Claude and makes the skill user-only; `user-invocable: false` makes it model-only.
[Skill invocation and lifecycle][skills-invocation]

Claude adds non-portable features beyond the Agent Skills core, including invocation
frontmatter, subagent execution, argument substitution, and dynamic shell-context
injection. These may be tolerated by other readers but cannot define required pack
behavior unless every target harness implements the same semantics.
[Claude skill extensions][skills-intro]
[Skill frontmatter][skills-frontmatter]

Security consequence: project-skill `allowed-tools` grants become active only after
workspace trust, and Anthropic warns that a project skill can grant itself broad tool
access. Managed policy can disable inline skill shell execution. The portable core
should not need either mechanism.
[Skill permissions][skills-security]
[Settings hook and skill restrictions][settings-files]

## Hooks

Hooks are event registrations, not discovered shell scripts. A hook registration may
live in user, project, local, or managed settings; a plugin's `hooks/hooks.json`; or
skill/agent frontmatter while that component is active. Matching hooks from multiple
sources merge rather than overriding one another.
[Hooks locations][hooks-locations]
[Feature layering][feature-layering]

Claude supports command, HTTP, MCP-tool, prompt, and agent hook handlers. Some events
can block: for example, a synchronous command `PreToolUse` hook exiting with status 2
blocks the tool call. Other events occur too late to block, and asynchronous command
hooks cannot block or return decisions.
[Hook reference and exit behavior][hooks-reference]

Two constraints make hooks unsuitable as the trio-wide enforcement layer:

1. managed `allowManagedHooksOnly` can block user, project, and ordinary plugin hooks;
2. project configuration and executable actions live behind Claude Code's workspace
   trust and permission architecture.

[Managed hook restriction][settings-hook-policy]
[Claude security and trust][security]

The safe adapter pattern is an optional Claude hook that invokes a repository-owned
command such as `npm run docs:validate`. The command and CI job remain authoritative;
the hook only shortens feedback time. Do not encode OKF validation logic in hook JSON
or a Claude-only hook script.

## Agents and subagents

Custom subagents are Markdown files with YAML frontmatter and a Markdown body used as
their prompt. Claude recursively scans project `.claude/agents/` and personal
`~/.claude/agents/`; managed and plugin agents are additional sources, and `--agents`
provides session-only definitions. Same-name precedence is managed, CLI, project,
user, plugin. Among nested project agent directories, the definition nearest the
working directory wins.
[Subagent format and scope][subagent-scope]

Discovery does not guarantee execution. Claude may delegate based on the request,
current context, and the agent's `description`; an `@`-mention guarantees a single
invocation. `--agent <name>` or the project `agent` setting instead replaces the main
thread's system prompt and tool/model profile for the whole session, while the normal
`CLAUDE.md` message flow still loads.
[Subagent automatic and explicit invocation][subagent-invocation]

Most custom subagents receive the same loaded `CLAUDE.md` hierarchy and project rules
as the main conversation, but the built-in Explore and Plan agents explicitly skip
`CLAUDE.md` and git status. Non-fork subagents otherwise start with isolated context,
not the parent conversation or already-invoked skills. Agent `skills:` frontmatter can
preload full skill bodies, and subagents may discover skills through the Skill tool if
permitted.
[Subagent startup context][subagent-context]
[Subagent skill preload][subagent-skills]

Plugin agents have an additional security limitation: Claude ignores `hooks`,
`mcpServers`, and `permissionMode` fields in plugin-provided agent definitions.
[Plugin subagent restrictions][subagent-scope]

Architecture consequence: no required docs behavior should depend on Claude choosing
a named agent, on a `superpowers:dispatching-parallel-agents`-style capability, or on
agent-specific preloading. A Claude agent may accelerate research or review, but the
portable skill must be able to complete the same procedure in the main context and
without parallelism. If a task delegates to built-in Explore or Plan, any essential
file-selection constraint must be included in that task prompt because those agents
do not receive the `CLAUDE.md`/`AGENTS.md` import.
[Subagent startup exceptions][subagent-context]

## Recommended adapter boundary for the OKF suite

### Required portable core

1. **One concise root `AGENTS.md` wiring block.** It should identify
   `docs/conventions/documentation.md` as lifecycle authority, tell the agent to read
   applicable decisions/specs/subsystem index/glossary/references for non-trivial
   work, and state the update boundary. Use direct paths and ordinary prose, not
   `@import`, because the other harnesses do not share Claude's import expansion.
2. **One canonical skill tree.** Every docs procedure is a spec-strict skill whose
   behavior is entirely described by portable Markdown, relative supporting-file
   links, and repository commands. The Claude distribution layer links or packages
   the same directories under a documented Claude skill location.
3. **One executable validation surface.** Package scripts and CI validate OKF
   structure and repository policy. Skills and `AGENTS.md` tell every harness to call
   those commands; no harness-specific hook owns the logic.
4. **One docs bundle.** The OKF concepts remain the source of intent and terminology.
   Adapter files point into that bundle and never restate concept content.

### Required Claude adapter

- Commit root `CLAUDE.md` with exactly `@AGENTS.md`.
- Place or package the canonical skill directories under `.claude/skills/`,
  `~/.claude/skills/`, an enterprise location, or an enabled Claude plugin according
  to the chosen distribution channel.

These are compatibility attachments. The first makes Claude load the universal
instruction file; the second makes Claude discover the universal skills.
[AGENTS.md import guidance][memory-imports]
[Skills locations][skills-discovery]

### Allowed optional Claude conveniences

- **Path-scoped `.claude/rules/`:** a short reminder to use the portable docs skill
  when touching `docs/**`. It must be deletion-safe: removing the rule changes
  discoverability or timing, not the required process or result.
- **Project hook in `.claude/settings.json`:** call the same portable validator after
  relevant edits or before a tool action. CI must call it independently, and hook
  failure/absence must not make invalid documentation acceptable.
- **`.claude/agents/*.md`:** convenience research/review workers whose bodies point to
  portable skills and docs. The main-context skill must remain a complete fallback.
- **Claude-only skill hints:** invocation or UI metadata may be added only when the
  other target readers accept it and required semantics do not depend on it. Avoid
  `disable-model-invocation`, `context: fork`, dynamic shell injection, or tool grants
  as requirements for the shared workflow.

### Adapter acceptance test

For each optional Claude artifact, remove it and run the pack's cross-harness
scenario. If the agent can still:

1. learn from the universal entry that an OKF bundle exists;
2. locate and read the lifecycle convention plus applicable concepts;
3. invoke the same portable docs procedure;
4. make the same permitted update; and
5. pass the same repository validation command,

then the artifact is a convenience. If removal breaks any step, it has crossed the
adapter boundary and must be moved into `AGENTS.md`, a portable skill, the OKF bundle,
or the shared validation scripts.

## Risks to record in the architecture decision

1. **`AGENTS.md` is not auto-discovered in Claude Code.** Omitting, misplacing, or
   mis-resolving the root `CLAUDE.md` import removes the universal entry.
   [AGENTS.md guidance][memory-imports]
2. **Prompt context is not enforcement.** “Always validate” can guide Claude but
   cannot guarantee execution; deterministic acceptance belongs in scripts/CI.
   [Memory versus enforcement][memory-context]
3. **Layering is feature-specific.** Treating settings precedence as universal will
   produce wrong assumptions about memory concatenation, skill names, agent names, or
   hooks. [Feature layering][feature-layering]
4. **User configuration can alter a project pack.** Personal skills override project
   skills by name; local settings override shared project scalars; all matching hooks
   may run. Use distinctive skill names, keep the entry concise, and avoid assuming a
   pristine user profile. [Skills precedence][skills-discovery]
   [Settings precedence][settings-precedence]
5. **Managed policy can remove conveniences.** It can block non-managed hooks,
   constrain permissions, disable skill shell injection, or impose higher-priority
   configuration. This is another reason hooks and Claude-only execution features
   cannot be load-bearing. [Managed hook policy][settings-hook-policy]
6. **Workspace trust is a real boundary.** Project settings, skill tool grants,
   plugins, and executable conveniences may require user trust. The in-repository
   `@AGENTS.md` import does not cross the external-import boundary, but an import
   outside the working directory does and requires separate approval.
   [Import trust][memory-imports] [Claude security][security]
7. **Subagent context is not uniform.** Built-in Explore and Plan skip the imported
   project instructions; other agents start isolated from the parent conversation.
   Do not make a required phase depend on implicit delegation or on a particular
   Claude-only orchestrator. [Subagent context][subagent-context]
8. **Duplicate Claude convenience text will drift.** Anthropic warns that conflicting
   memory/rules can be handled inconsistently. Optional rules and agent prompts should
   reference portable authorities rather than copy them.
   [Memory consistency guidance][memory-writing]

## Source index

All product facts above come from official Anthropic documentation, accessed
2026-07-23.

- [Explore the `.claude` directory][claude-directory]
- [How Claude remembers your project][memory]
- [Claude Code settings][settings]
- [Extend Claude with skills][skills]
- [Create custom subagents][subagents]
- [Hooks reference][hooks-reference]
- [Automate workflows with hooks][hooks-guide]
- [Extend Claude Code][extension-overview]
- [Configure permissions][permissions]
- [Security][security]

[claude-directory]: https://code.claude.com/docs/en/claude-directory
[memory]: https://code.claude.com/docs/en/memory
[memory-context]: https://code.claude.com/docs/en/memory#claudemd-vs-auto-memory
[memory-locations]: https://code.claude.com/docs/en/memory#choose-where-to-put-claudemd-files
[memory-writing]: https://code.claude.com/docs/en/memory#write-effective-instructions
[memory-imports]: https://code.claude.com/docs/en/memory#import-additional-files
[memory-load]: https://code.claude.com/docs/en/memory#how-claudemd-files-load
[memory-rules]: https://code.claude.com/docs/en/memory#organize-rules-with-clauderules
[memory-user-rules]: https://code.claude.com/docs/en/memory#user-level-rules
[settings]: https://code.claude.com/docs/en/settings
[settings-scopes]: https://code.claude.com/docs/en/settings#configuration-scopes
[settings-files]: https://code.claude.com/docs/en/settings#settings-files
[settings-precedence]: https://code.claude.com/docs/en/settings#settings-precedence
[settings-hook-policy]: https://code.claude.com/docs/en/settings#hook-configuration
[skills]: https://code.claude.com/docs/en/skills
[skills-intro]: https://code.claude.com/docs/en/skills#extend-claude-with-skills
[skills-discovery]: https://code.claude.com/docs/en/skills#where-skills-live
[skills-live]: https://code.claude.com/docs/en/skills#live-change-detection
[skills-invocation]: https://code.claude.com/docs/en/skills#control-who-invokes-a-skill
[skills-frontmatter]: https://code.claude.com/docs/en/skills#frontmatter-reference
[skills-security]: https://code.claude.com/docs/en/skills#restrict-claudes-access-to-skills
[subagents]: https://code.claude.com/docs/en/sub-agents
[subagent-scope]: https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope
[subagent-invocation]: https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly
[subagent-context]: https://code.claude.com/docs/en/sub-agents#what-loads-at-startup
[subagent-skills]: https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents
[hooks-reference]: https://code.claude.com/docs/en/hooks
[hooks-guide]: https://code.claude.com/docs/en/hooks-guide
[hooks-locations]: https://code.claude.com/docs/en/hooks#hook-locations
[extension-overview]: https://code.claude.com/docs/en/features-overview
[extension-loading]: https://code.claude.com/docs/en/features-overview#understand-context-costs
[feature-layering]: https://code.claude.com/docs/en/features-overview#understand-how-features-layer
[permissions]: https://code.claude.com/docs/en/permissions
[security]: https://code.claude.com/docs/en/security
