# Issue #38 — current Codex CLI configuration contract

Research date: 2026-07-23.

Scope: the Codex CLI side of “Harness parity architecture: one pack, same
behavior everywhere.” The published Codex manual was freshly fetched through
OpenAI's manual helper before this review. Published product behavior below is
sourced from the current OpenAI documentation; source-level clarifications are
pinned to `openai/codex` commit
[`74e9d7e`](https://github.com/openai/codex/tree/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29).

## Executive conclusion

The parity contract should put all normative OKF behavior in three
harness-neutral assets:

1. a self-contained `AGENTS.md` source of truth;
2. spec-strict `SKILL.md` workflows, deployed to each harness's discovered
   skill path without changing their semantics; and
3. shell/CI validators for mechanical enforcement.

Codex already discovers `AGENTS.md` and `.agents/skills` without project
configuration. Therefore `.codex/config.toml`, Codex hooks, and Codex custom
agents should be a thin, optional adapter for ergonomics, acceleration, and
extra checks. They must not carry requirements whose absence would change the
OKF workflow or artifact. This boundary follows Codex's own customization
model: `AGENTS.md` is durable project guidance, skills are reusable workflows,
and pre-commit hooks/linters/type checkers provide enforcement
([Customization](https://learn.chatgpt.com/docs/customization/overview)).

The most important current-version correction is that multi-agent tools are
enabled by default. The public setting is `[agents] enabled = true` (default);
the older advice to set `[features] multi_agent = true` is not the current
configuration contract
([Subagents — global settings](https://learn.chatgpt.com/docs/agent-configuration/subagents#global-settings),
[current schema](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/config.schema.json#L35-L65)).

## Auto-discovery versus config wiring

| Surface | What Codex auto-discovers | What requires explicit config wiring | Precedence, scope, and trust |
|---|---|---|---|
| Durable instructions | At Codex-home scope, `AGENTS.override.md` or else `AGENTS.md`; at project scope, one non-empty `AGENTS.override.md` or `AGENTS.md` per directory from project root through CWD. Files are concatenated root-to-leaf, so the closest file is later and overrides broader guidance. Default project-doc budget is 32 KiB. ([AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md#how-codex-discovers-guidance)) | Alternate names are ignored unless listed in `project_doc_fallback_filenames`; `project_doc_max_bytes` and `project_root_markers` are also config controls. `model_instructions_file` is a different mechanism: it explicitly replaces Codex's built-in model instructions and is strongly discouraged, not an include mechanism for `AGENTS.md`. ([fallback names](https://learn.chatgpt.com/docs/agent-configuration/agents-md#customize-fallback-filenames), [config schema](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/config.schema.json#L5432-L5439)) | At each directory `AGENTS.override.md` replaces that directory's `AGENTS.md`; it does not erase ancestor files. The instruction scan is separate from trusted `.codex/` config loading. Current source discovers project instructions without consulting project config layers, so repo guidance still enters context in an untrusted checkout; treat repository instructions as untrusted input operationally. ([loader](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/src/agents_md.rs#L51-L180)) |
| Project configuration | Codex automatically reads `.codex/config.toml` from project root through CWD. It also reads the user file at `~/.codex/config.toml` and the Unix system file at `/etc/codex/config.toml`. ([Config basics](https://learn.chatgpt.com/docs/config-file/config-basic#codex-configuration-file)) | A named profile is loaded only with `--profile name` from `~/.codex/name.config.toml`; one-run values use flags or `-c`/`--config`. Relative paths in project config resolve from the containing `.codex` directory. ([Profiles and CLI overrides](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles), [project config](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml)) | Effective value precedence is CLI/`--config` > closest trusted project config > selected profile > user config > system config > built-in default. Untrusted projects lose all project `.codex/` layers, including project config, hooks, rules, and project custom agents. Project files also cannot redirect credentials/providers or set notification/telemetry keys. ([Configuration precedence](https://learn.chatgpt.com/docs/config-file/config-basic#configuration-precedence), [project restrictions](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml)) |
| Skills | Codex scans `.agents/skills` at every directory from CWD to repo root, plus `$HOME/.agents/skills`, `/etc/codex/skills`, and bundled system skills. It follows symlinked skill directories. Full `SKILL.md` is loaded only after selection; initial context contains metadata and path. ([Build skills](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills)) | `[[skills.config]]` can disable a discovered skill by exact `SKILL.md` path; it is not a general path loader. Optional `agents/openai.yaml` supplies Codex UI, invocation-policy, and tool-dependency metadata, but portable behavior cannot depend on it. ([Enable/disable and metadata](https://learn.chatgpt.com/docs/build-skills#enable-or-disable-skills)) | Duplicate skill names are not merged and both may appear in selectors, so one profile must not receive both the pure-skill and plugin copies. Current source retains `$CODEX_HOME/skills`/`.codex/skills` as deprecated compatibility roots, but current docs advertise `.agents/skills`; new architecture should not target the deprecated path. ([duplicate behavior](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills), [current loader](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core-skills/src/loader.rs#L303-L383)) |
| Hooks | Codex auto-discovers `hooks.json` beside active config layers and default `hooks/hooks.json` in enabled plugins. ([Hooks discovery](https://learn.chatgpt.com/docs/hooks#where-codex-looks-for-hooks)) | Inline `[hooks]` tables in `config.toml`, non-default plugin manifest paths, and managed hooks in `requirements.toml` are explicitly wired. ([Hooks config](https://learn.chatgpt.com/docs/hooks#config-shape)) | Hooks are additive: higher-precedence config does not replace lower-layer hooks, and all matching handlers run. Project hooks require a trusted project layer. Every non-managed command-hook definition is hash-reviewed and skipped until trusted; managed hooks are policy-trusted. Only command handlers run today. ([Hook precedence and trust](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)) |
| Custom agents / subagents | Codex provides `default`, `worker`, and `explorer`, and auto-discovers standalone TOML agents under `~/.codex/agents/` and trusted project `.codex/agents/`. Each standalone file requires `name`, `description`, and `developer_instructions`. ([Custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)) | Roles can also be declared under `[agents.<role>]`; `config_file` points to a role file relative to the config file that declares it. Global controls live under `[agents]`. ([Subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents#global-settings)) | Agent-role layers follow normal config precedence; disabled/untrusted project layers are excluded, and later/higher layers replace matching fields while inheriting missing fields from lower ones. ([current loader](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/src/config/agent_roles.rs#L19-L104)) |

## Instruction and override semantics

`developer_instructions` is a public `config.toml` key inserted as a
developer-role message. It therefore uses the normal config-value precedence
above. Codex's skill catalog/invocation guidance is also assembled into the
developer message
([schema](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/config.schema.json#L4870-L4873),
[prompt assembly](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/src/session/mod.rs#L3314-L3366)).

By contrast, the Codex-home instruction file and project `AGENTS.md` chain are
combined into contextual **user-role** instructions, ahead of the task's own
user message. There is no documented public `user_instructions` config key;
the source uses that term for host/global guidance and the assembled
`AGENTS.md` state
([AGENTS state](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/src/context/world_state/agents_md.rs#L13-L50),
[assembly order](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/src/agents_md.rs#L250-L344)).

That role distinction matters: developer instructions outrank conflicting user
instructions, while the direct task prompt can specialize same-level project
guidance when there is no higher-level conflict
([OpenAI Model Spec — instruction authority](https://model-spec.openai.com/#instructions-and-levels-of-authority)).
Consequently, a repo-level `.codex/config.toml` `developer_instructions` block
is not an innocuous equivalent of `AGENTS.md`; it is stronger, Codex-only, and
trust-gated. It should not contain the OKF contract.

`model_instructions_file` is stronger still: it replaces the built-in model
instructions, and OpenAI's current schema explicitly warns that it may degrade
performance. It must not be used as an `AGENTS.md` import shim or an OKF loader
([configuration schema](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/config.schema.json#L5432-L5439)).

Managed `requirements.toml` is outside ordinary user/project precedence:
supported requirements constrain security-sensitive values so CLI, project,
profile, or user config cannot defeat them. Managed hooks and feature values
can likewise be pinned. This is another reason not to make local Codex config
load-bearing for portable behavior
([Managed configuration](https://learn.chatgpt.com/docs/enterprise/managed-configuration#admin-enforced-requirements-requirementstoml)).

## Multi-agent behavior

- Current local Codex releases expose subagent workflows by default.
  `agents.enabled` defaults to `true`; set it to `false` only to disable the
  tools. `agents.max_concurrent_threads_per_session`, default model, and
  default reasoning effort are optional controls
  ([Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents#global-settings)).
- Direct user requests, applicable `AGENTS.md`, or applicable skill
  instructions can ask Codex to delegate. This is steering, not a guarantee
  that a particular parallel topology is portable to another harness
  ([triggering subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents#triggering-subagent-workflows)).
- A custom agent file is a complete child-session config layer, not a portable
  Markdown agent definition. If it specifies model or reasoning effort, that
  value wins; otherwise Codex resolves explicit spawn value, `[agents]`
  default, then parent value. Omitted session settings inherit from the parent
  ([custom-agent inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)).
- Subagents inherit the parent's active sandbox/approval policy, including
  live runtime overrides. Parallel work also consumes more tokens and
  write-heavy parallelism increases conflict risk
  ([approvals and sandbox](https://learn.chatgpt.com/docs/agent-configuration/subagents#approvals-and-sandbox-controls),
  [workflow guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents#why-subagent-workflows-help)).

Parity rule: OKF workflows may say “delegate independent checks when the
harness supports it,” but must define a serial fallback and the same output
contract. Named Codex agents can accelerate research/review, but their
existence, count, model, or developer instructions must never be necessary for
correct OKF behavior.

## Risks for issue #38

1. **Config as hidden semantics.** `.codex/config.toml` is ignored until the
   repository is trusted and can be superseded by CLI flags, a closer nested
   project config, or managed requirements. Any OKF requirement stored only
   there will disappear in common execution modes
   ([configuration precedence](https://learn.chatgpt.com/docs/config-file/config-basic#configuration-precedence)).
2. **Developer-role drift.** Copying portable guidance into
   `developer_instructions` both duplicates the source of truth and gives the
   Codex copy a different authority than `AGENTS.md`
   ([schema](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/config.schema.json#L4870-L4873)).
3. **Duplicate skill installs.** Codex does not merge same-name skills; both
   can be advertised. This validates the existing decision not to install pure
   and plugin forms into one profile
   ([Build skills](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills)).
4. **Untrusted-repo exposure.** Project `.codex` config/hooks/agents are
   trust-gated, but `AGENTS.md` and `.agents/skills` are discovered outside
   that gate in current source. They must be concise, auditable, and must not
   imply that checked-in scripts are safe merely because Codex discovered
   them. Skill-script approvals remain a separate approval category
   ([instruction loader](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core/src/agents_md.rs#L83-L180),
   [skill roots](https://github.com/openai/codex/blob/74e9d7efc416b1cb9f3ad10c70a91afbcb6d6a29/codex-rs/core-skills/src/loader.rs#L389-L432),
   [approval categories](https://learn.chatgpt.com/docs/agent-approvals-security)).
5. **Hooks are not replacement semantics.** Hook layers accumulate and run
   concurrently, and non-managed changes require renewed trust. A hook may
   duplicate a validator for faster feedback, but CI/shell validation must
   remain authoritative
   ([Hooks](https://learn.chatgpt.com/docs/hooks#where-codex-looks-for-hooks)).
6. **Multi-agent version drift.** Requiring the legacy
   `[features] multi_agent = true` makes the pack version-sensitive. The
   current public surface is default-on `[agents].enabled`; omit an enablement
   stanza unless the pack explicitly needs to disable delegation
   ([Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents#global-settings)).

## Recommended adapter boundary

**Portable semantic core**

- `AGENTS.md`: concise, self-contained routing and invariant text; no Codex
  config indirection and no `@import` dependency. Keep the whole root-to-CWD
  chain below Codex's 32 KiB default
  ([AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md#how-codex-discovers-guidance)).
- Canonical skill directories: strict `name`/`description` frontmatter,
  plain-Markdown workflow, relative references/scripts, and identical body
  across harnesses. Deploy the canonical directory into `.agents/skills` for
  Codex; do not author a Codex-specific semantic fork
  ([Build skills](https://learn.chatgpt.com/docs/build-skills)).
- Shell commands and CI: the authority for validation and enforcement. Hooks
  may call the same commands but cannot replace them
  ([Customization](https://learn.chatgpt.com/docs/customization/overview)).

**Thin Codex adapter, all optional**

- `.codex/config.toml` may set convenience defaults such as agent concurrency
  or a read-only reviewer role, but should contain no `developer_instructions`,
  `model_instructions_file`, fallback-document alias, or rule required to
  understand or validate OKF.
- `.codex/agents/*.toml` may provide named accelerators whose developer
  instructions point back to the same portable skill/output contract. Every
  workflow must still work with built-in/default single-agent execution.
- `.codex/hooks.json` may invoke the same portable validator for earlier
  feedback. CI and an explicit skill step remain the pass/fail authority.
- `agents/openai.yaml` may improve display or suppress implicit invocation, but
  cannot change the workflow contract.

In short, the adapter may map **where Codex finds an asset** and add
**non-essential convenience**. It must not redefine **what the OKF process
means**, **which files are authoritative**, **what output is required**, or
**what constitutes success**.
