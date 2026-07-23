# Harness parity — verified portability contract (ticket #34)

Gathered 2026-07-22 by a 10-agent dynamic workflow (9 harvest/verify agents over the
official docs and source of Claude Code, Codex CLI, and OpenCode, plus adversarial
verdicts on five recon claims) for
[wayfinder ticket #34](https://github.com/artemVeduta/skills/issues/34) on
[map #28](https://github.com/artemVeduta/skills/issues/28). Working-tree asset, like
`reference-okf-docs-v2-recon.md`. Where a harvest and a refuter verdict disagree, the
refuter's evidence wins and the disagreement is noted inline.

## 1. Per-harness support matrix

Version pins (all sources fetched 2026-07-22):

- **Claude Code** v2.1.217 (anthropics/claude-code CHANGELOG.md latest entry; docs at code.claude.com/docs)
- **Codex CLI** rust-v0.145.0 (published 2026-07-21; docs at learn.chatgpt.com/docs via 308 from developers.openai.com/codex; repo docs are stubs, so source at main commit `66bd101` used as primary)
- **OpenCode** v1.18.4 (published 2026-07-20; docs at opencode.ai/docs, source anomalyco/opencode dev branch)

| Dimension | Claude Code v2.1.217 | Codex CLI rust-v0.145.0 | OpenCode v1.18.4 |
|---|---|---|---|
| **Skills (SKILL.md)** | Native; all frontmatter optional; extends agentskills.io spec | Native; `name`+`description` required (missing frontmatter = parse error) | Native (via built-in `skill` tool); enforces agentskills.io constraints exactly |
| Skill discovery | `~/.claude/skills/`, `.claude/skills/` (+parents, nested, `--add-dir`), plugins, enterprise. NOT `.agents/skills/` | `.codex/skills/`, `.agents/skills/` (root→cwd), `~/.agents/skills/`, `~/.codex/skills/` (deprecated), `/etc/codex/skills`. NOT `.claude/skills/` | `.opencode/skills/`, `~/.config/opencode/skills/`, **`.claude/skills/`**, `~/.claude/skills/`, **`.agents/skills/`**, `~/.agents/skills/`, + config `skills.paths`/`skills.urls` |
| **Instruction files** | `CLAUDE.md` only — "reads CLAUDE.md, not AGENTS.md"; `@import` expands | `AGENTS.override.md` → `AGENTS.md` (root→cwd + `~/.codex/`); CLAUDE.md NOT read by default; no `@import` | `AGENTS.md` native (walk-up + global); `CLAUDE.md` as default-on fallback; no `@import` |
| **Commands** | Merged into skills; `.claude/commands/*.md` still works | Custom prompts DEPRECATED; loader gone at main HEAD; skills replace them | `.opencode/commands/*.md` + global; `$ARGUMENTS`, `` !`cmd` ``, `@file` |
| **Subagents** | Markdown+YAML in `.claude/agents/` | TOML in `.codex/agents/` / `~/.codex/agents/` (+ `[agents.<role>]` in config.toml) | Markdown+YAML in `.opencode/agents/` (different fields) or opencode.json |
| **Hooks** | `settings.json` `hooks` key; 30 events, 5 handler types | `hooks.json` / `[hooks]` config.toml; same schema as Claude Code, 11 events, `command` handlers only | JS/TS plugin modules only; no declarative hook config |

### 1a. Claude Code (v2.1.217, docs fetched 2026-07-22)

- **Skills**: directory + `SKILL.md` (YAML frontmatter + Markdown). Docs state skills "follow the [Agent Skills](https://agentskills.io) open standard" and extend it (invocation control, `context: fork`, dynamic `` !`cmd` `` injection). All frontmatter fields optional (name defaults to dir name) — more lenient than the spec. Combined description+`when_to_use` truncated at 1,536 chars in the listing; listing budget 1% of context window; "under 500 lines" is guidance. Up to 6 stacked skill invocations per message. ([skills docs](https://code.claude.com/docs/en/skills))
- **Instruction files**: memory docs verbatim: "Claude Code reads `CLAUDE.md`, not `AGENTS.md`" — recommend a CLAUDE.md containing `@AGENTS.md` or a symlink. Zero AGENTS.md entries in the entire CHANGELOG through v2.1.217. Discovery: managed policy → `~/.claude/CLAUDE.md` → `./CLAUDE.md` / `./.claude/CLAUDE.md` (ancestors walk-up) → `CLAUDE.local.md`; plus `.claude/rules/*.md`. `@import` expands at launch, max 4 hops, skipped inside code spans/fences; project-scope imports outside the working dir trigger an approval dialog. Loaded in full regardless of length ("under 200 lines" is guidance only). ([memory docs](https://code.claude.com/docs/en/memory))
- **Commands**: merged into skills; `.claude/commands/*.md` keeps working with the same frontmatter; skill wins on name clash. ([slash-commands page now serves skills](https://code.claude.com/docs/en/slash-commands))
- **Subagents**: `.claude/agents/*.md`, frontmatter `name`+`description` required, body = system prompt; depth limit 5; 200 spawns/session, 20 concurrent (v2.1.212/217). ([sub-agents docs](https://code.claude.com/docs/en/sub-agents))
- **Hooks**: `hooks` key in settings files; 30 events; handler types command/http/mcp_tool/prompt/agent; exit 2 blocks; 10,000-char output cap. ([hooks docs](https://code.claude.com/docs/en/hooks))

### 1b. Codex CLI (rust-v0.145.0, source at main `66bd101`, fetched 2026-07-22)

- **Skills**: shipped v0.65.0 (2025-12-04), default-on since rust-v0.76.0. Frontmatter read: `name`, `description`, `metadata.short-description`; missing frontmatter is a parse error (`codex-rs/core-skills/src/loader.rs`). Optional `agents/openai.yaml` per skill adds display/policy metadata. Docs: "Skills build on the open agent skills standard." Skills index budget: 2% of context window in tokens when known; 8,000 chars only as fallback; per-description pre-cap 1,024 chars; three-tier overflow (shorten fairly → drop descriptions → omit skills, with injected warnings) (`codex-rs/core-skills/src/render.rs`, [build-skills docs](https://learn.chatgpt.com/docs/build-skills)).
- **Instruction files**: `AGENTS.override.md` then `AGENTS.md`, global `~/.codex/` + per-directory root→cwd concatenation (never past project root, default marker `.git`); total budget `project_doc_max_bytes` default 32 KiB. CLAUDE.md NOT read by default — `default_project_doc_fallback_filenames()` returns an empty list (`codex-rs/config/src/config_toml.rs:78`); opt-in via `project_doc_fallback_filenames = ["CLAUDE.md"]`. No `@import` expansion (raw concatenation, `codex-rs/core/src/agents_md.rs`; open issues #6038, #17401). A first-party one-way migrator (`codex-rs/external-agent-migration`) imports CLAUDE.md/hooks/subagents/commands into Codex equivalents.
- **Commands**: custom prompts (`~/.codex/prompts/*.md`) officially deprecated — "Use skills"; loader removed at main HEAD; external commands migrate into skills named `source-command-*`. ([custom-prompts docs](https://learn.chatgpt.com/docs/custom-prompts))
- **Subagents**: TOML role files under `<layer>/agents/` (`~/.codex/agents/`, `.codex/agents/`) + inline `[agents.<role>]`; required `name`/`description`/`developer_instructions`; built-ins default/worker/explorer. ([subagents docs](https://learn.chatgpt.com/docs/agent-configuration/subagents))
- **Hooks**: engine literally named `ClaudeHooksEngine` (`codex-rs/hooks/src/registry.rs`); 11 events, same JSON shape/stdin/exit-code contract as Claude Code; only `type: "command"` handlers run; non-managed hooks must be trusted (hash-recorded). Plugin manifests also discovered at `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json` (`codex-rs/exec-server-protocol/src/protocol.rs:46`). ([hooks docs](https://learn.chatgpt.com/docs/hooks))

### 1c. OpenCode (v1.18.4, docs + dev-branch source fetched 2026-07-22)

- **Skills**: shipped v1.0.186/v1.0.190 (2025-12-22). Loaded via a built-in `skill` tool whose description embeds the `<available_skills>` list. Frontmatter recognized: `name` (required), `description` (required), `license`, `compatibility`, `metadata`; unknown fields ignored — the spec's experimental `allowed-tools` is NOT honored. Constraints match agentskills.io exactly (name 1–64 `^[a-z0-9]+(-[a-z0-9]+)*$` matching dir name; description 1–1024). Discovery includes Claude-compatible `.claude/skills/` + `~/.claude/skills/` and `.agents/skills/` + `~/.agents/skills/` (disable via `OPENCODE_DISABLE_CLAUDE_CODE(_SKILLS)=1`). Note: OpenCode's docs/repo never cite agentskills.io — convergence is de facto (refuter caveat, claim 1). ([skills docs](https://opencode.ai/docs/skills/), `packages/opencode/src/skill/index.ts`)
- **Instruction files**: `AGENTS.md` native (walk-up from cwd; global `~/.config/opencode/AGENTS.md`); project `CLAUDE.md` and `~/.claude/CLAUDE.md` are fallbacks used only when no AGENTS.md exists. `instructions` key in opencode.json adds files/globs/remote URLs (5 s fetch timeout). No `@import` expansion — docs: "opencode doesn't automatically parse file references in AGENTS.md". ([rules docs](https://opencode.ai/docs/rules/))
- **Commands**: `.opencode/commands/*.md` + `~/.config/opencode/commands/`; frontmatter description/agent/model/subtask; `$ARGUMENTS`, `$1…`, `` !`cmd` ``, `@file`; no `.claude/commands` compatibility in the loader (`packages/opencode/src/config/command.ts`). ([commands docs](https://opencode.ai/docs/commands/))
- **Subagents**: primary vs subagent modes; Markdown in `.opencode/agents/` / global, or opencode.json `agent` key; fields description (required), mode, model, tools, permission, etc.; no `.claude/agents` compatibility (`packages/opencode/src/config/agent.ts`). ([agents docs](https://opencode.ai/docs/agents/))
- **Hooks**: none declarative — JS/TS plugins in `.opencode/plugins/` (or npm via config) export hook functions (`tool.execute.before/after`, event handlers, custom tools). ([plugins docs](https://opencode.ai/docs/plugins/))

### 1d. Agent Skills spec (agentskills.io)

Originally developed by Anthropic, released as an open standard; repo `agentskills/agentskills` is **unversioned** (no release tags) — pin by spec-source commit `6868401` (2026-05-16). Normative: directory + SKILL.md; `name` required (1–64, lowercase/digits/hyphens, must match directory name); `description` required (1–1024); optional `license`, `compatibility` (≤500), `metadata`, `allowed-tools` (experimental). Discovery paths are deliberately NOT mandated by the spec; the non-normative client guide recommends `.<client>/skills/` + the cross-client `.agents/skills/` convention. Official client showcase lists all three harnesses. ([specification](https://agentskills.io/specification), [client guide](https://agentskills.io/client-implementation/adding-skills-support.md))

## 2. Recon-claim verdicts

### Claim 1 — universal SKILL.md convergence: **CONFIRMED**

All three natively read directory+SKILL.md skills with name/description frontmatter per the agentskills.io shape; the spec's showcase lists all three. Two caveats that do not falsify the wording: (a) OpenCode's convergence is de facto — zero references to agentskills.io in its docs/repo (GitHub code search: 0 hits), while Claude Code and Codex cite the standard explicitly; (b) **no single directory is read by all three** — Claude Code reads `.claude/skills` but not `.agents/skills`; Codex the inverse; OpenCode both. One skill needs placement (or symlink) in `.claude/skills/` + `.agents/skills/` to reach all three. (Sources: code.claude.com/docs/en/skills; learn.chatgpt.com/docs/build-skills; opencode.ai/docs/skills/; agentskills.io.)

### Claim 2 — AGENTS.md the only universal instruction file: **PARTIAL**

Directionally right, wrong in the load-bearing detail: Claude Code does NOT discover AGENTS.md natively (memory docs verbatim; zero CHANGELOG entries through v2.1.217; the `/init`+`CLAUDE_CODE_NEW_INIT=1` read is a one-time generation aid, not session discovery). So strictly **no** instruction file is auto-discovered by all three. Corrected wording: *AGENTS.md is the unique single-source-of-truth instruction file reaching all three harnesses — natively in Codex (which checks `AGENTS.override.md` first) and OpenCode, and in Claude Code only via a `CLAUDE.md` shim containing `@AGENTS.md` (or a symlink); no other file comes closer (CLAUDE.md fails on Codex, whose default fallback list is empty).* (Sources: code.claude.com/docs/en/memory; codex-rs/config/src/config_toml.rs:78; opencode.ai/docs/rules/.)

### Claim 3 — @import expands only in Claude Code: **CONFIRMED**

Claude Code expands `@path` imports at launch (4-hop max, code spans skipped, out-of-dir approval dialog). Codex concatenates AGENTS.md files raw with no include mechanism (issues #6038 and #17401 requesting it remain open). OpenCode docs state verbatim it "doesn't automatically parse file references in AGENTS.md" — its `instructions` config key inlines files, but that is config, not @-syntax. Scope caveat: "ONLY" holds among these three harnesses; not evaluated beyond them (e.g., Gemini CLI has an import feature). (Sources: code.claude.com/docs/en/memory; openai/codex #6038, #17401; opencode.ai/docs/rules/.)

### Claim 4 — Codex 8,000-char skills-index cap: **PARTIAL**

The 8,000 figure is real but is only the **fallback**. Corrected wording: *Codex budgets the injected skills list at 2% of the model's context window in approximate tokens when the window is known (clamped to 4,000 tokens in the newer ext/skills renderer); 8,000 characters applies only when the window is unknown; the budget covers full rendered lines (name + description + source locator), not name+description alone. Overflow degrades in tiers: fair round-robin description shortening with a warning → descriptions dropped and skills omitted with a warning. Separately, each description is pre-capped at 1,024 chars.* (Sources: codex-rs/core-skills/src/render.rs at `66bd101` and tag rust-v0.145.0; PRs #18298, #18925; learn.chatgpt.com/docs/build-skills.)

### Claim 5 — hooks/subagents never portable; shell the only enforcement: **PARTIAL**

Two specifics fail. (a) "Each harness has its own incompatible format" is false for Claude Code↔Codex hooks: Codex deliberately adopted Claude Code's hook schema (engine named `ClaudeHooksEngine`; identical event names, JSON nesting, stdin contract, exit-0/2 semantics), making command hooks near-copy-portable between the two — only the file location differs, and Codex runs a subset (command handlers, 11 events). Codex also ships a first-party one-way migrator for Claude Code hooks and subagents. (b) "Lacks the feature entirely" is false: all three have both hooks and subagents. What survives: **no hook or subagent definition is natively consumed unchanged by all three** — OpenCode's JS/TS-plugin hooks are incompatible with both JSON systems, and subagents are three incompatible formats (Markdown+YAML vs TOML vs Markdown+YAML-with-different-fields; no harness reads another's agents dir). Corrected conclusion: shell commands remain the only *trio-wide* enforcement point, but Claude↔Codex pairs can share hook config, and skills are portable unchanged between Claude Code and OpenCode. (Sources: learn.chatgpt.com/docs/hooks; codex-rs/hooks/src/registry.rs; codex-rs/external-agent-migration; opencode.ai/docs/plugins/, /docs/agents/.)

## 3. The portability contract

What the portable skill-suite may rely on, must not depend on, and where per-harness shims attach. "All three" = Claude Code v2.1.217, Codex CLI rust-v0.145.0, OpenCode v1.18.4 as pinned above.

### 3a. ALLOWED — LCD mechanisms (identical or safely equivalent in all three)

1. **Spec-strict SKILL.md skills**: one directory per skill containing `SKILL.md` with YAML frontmatter carrying `name` (1–64 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, equal to the directory name) and `description` (1–1024 chars). This satisfies the strictest reader (OpenCode enforces the spec constraints exactly; Codex errors on missing frontmatter; Claude Code accepts anything looser). (Claim 1 CONFIRMED; §1a–1c.)
2. **Plain-Markdown skill bodies with relative-path progressive disclosure**: `scripts/`, `references/`, `assets/` subdirs and prose telling the model to read them on demand — the spec's core pattern, honored by all three. Keep SKILL.md under ~500 lines (guidance in spec + Claude Code docs, unenforced anywhere). ([spec](https://agentskills.io/specification))
3. **Short, trigger-front-loaded descriptions**: ≤1,024 chars hard (spec + Codex per-description cap + OpenCode validation), and lean in practice — the aggregate advertisement budget is scarce everywhere (Claude 1% of window; Codex 2%/8,000-char fallback with truncation tiers; OpenCode embeds the list in the `skill` tool description, no documented bound). (§1a–1c, claim 4.)
4. **AGENTS.md as the single instruction source of truth**, paired with a one-line `CLAUDE.md` shim containing exactly `@AGENTS.md` (or a symlink). Codex and OpenCode read AGENTS.md natively; Claude Code reads it through the shim. (Claim 2 PARTIAL — this is the corrected safe form.)
5. **Self-contained AGENTS.md content** — no include syntax of any kind; anything needed at session start goes in the file body. Lazy loading via explicit prose ("when doing X, read `docs/...`") works in all three because it is model-initiated, and is the mechanism OpenCode's docs themselves recommend. (Claim 3 CONFIRMED.)
6. **AGENTS.md under 32 KiB total** along the root→cwd chain — Codex's default `project_doc_max_bytes` budget is the binding constraint (Claude Code and OpenCode load in full). (§1b.)
7. **Shell commands as the enforcement layer**: npm/package scripts, git hooks, CI, and executable `scripts/` inside skills. The only trio-wide enforcement point. (Claim 5, surviving core.)
8. **Dual skill placement `.claude/skills/` + `.agents/skills/`** (copies or symlinks from a single source dir) to be discovered by all three simultaneously; project-over-user precedence is a safe assumption in all three (§1a–1c). Symlinked skill dirs are verified followed in all three harnesses: the prior Claude Code v2.1.217 check recorded by the parent research ticket, Codex CLI rust-v0.145.0 at `.agents/skills/`, and OpenCode v1.18.4 at both `.agents/skills/` and `.claude/skills/`. ([Empirical harness checks](https://github.com/artemVeduta/skills/issues/44); §4.)

### 3b. FORBIDDEN — harness-specific dependencies the portable suite must not rely on

1. **`@import` lines anywhere except the CLAUDE.md shim itself** — plain text in Codex and OpenCode. (Claim 3.)
2. **CLAUDE.md as a content carrier** — Codex never reads it by default (`default_project_doc_fallback_filenames` = empty), and OpenCode ignores it once AGENTS.md exists. The shim stays one line. (Claim 2; §1b, §1c.)
3. **Claude-only skill frontmatter semantics**: `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`/`disallowed-tools`, `context: fork`, `agent`, `hooks`, `model`, `effort`, `paths`, `shell`. OpenCode ignores unknown fields (including the spec's experimental `allowed-tools`); Codex reads only name/description/metadata.short-description. The three empirically tested extra fields may be present — Codex CLI rust-v0.145.0 accepted and invoked a skill carrying `when_to_use`, `context: fork`, and `argument-hint` — but portable behavior must not depend on their semantics. Other fields in this list were not exercised by the empirical check. ([Empirical harness checks](https://github.com/artemVeduta/skills/issues/44); §4.)
4. **Dynamic context injection in skills** — `` !`cmd` `` / ```` ```! ```` preprocessing is Claude Code only. (§1a.)
5. **String substitutions in skill bodies** — `$ARGUMENTS`, `$N`, `${CLAUDE_*}` are Claude Code skill features; OpenCode supports `$ARGUMENTS` only in commands, not skills; Codex skills have no substitution. (§1a–1c.)
6. **Custom slash commands as a delivery vehicle** — deprecated and loader-removed in Codex; three different formats elsewhere. Skills replaced them in both Claude Code and Codex. (§1a, §1b.)
7. **Declarative hooks as trio-wide enforcement** — OpenCode has no JSON hook config; its plugin API is code, not config. (Claim 5.)
8. **Subagent definitions of any format** — Markdown+YAML (Claude), TOML (Codex), Markdown+YAML-different-fields (OpenCode); no cross-reading. (Claim 5.)
9. **Skill discovery quirks**: parent/nested `.claude/skills` walking, `--add-dir`, plugin namespacing (Claude); `AGENTS.override.md` (Codex); `skills.urls` remote fetch (OpenCode). Portable skills live at the canonical two paths only. (§1a–1c.)
10. **Fat descriptions / large skill counts** without checking budgets — Codex silently shortens then omits skills over budget; Claude truncates listings at 1,536 chars per skill within a 1%-of-window budget. (Claim 4; §1a.)

### 3c. ADAPTER POINTS — where a thin harness-specific shim may attach

**Claude Code**
- `CLAUDE.md` containing `@AGENTS.md` (the mandatory instruction shim). (Claim 2.)
- `.claude/skills/` placement (copy or symlink of the canonical skill dirs). (§1a.)
- `.claude/settings.json` `hooks` block for enforcement beyond shell (30 events, 5 handler types); `.claude/rules/*.md` for path-scoped rules; `.claude/agents/*.md` for subagents. (§1a.)
- Optional Claude-only frontmatter enrichment using the tested fields `when_to_use`, `context: fork`, and `argument-hint` layered onto portable skills. Codex rust-v0.145.0 tolerates these fields, but portable behavior cannot depend on their semantics; the repository's authoring allowlist remains a separate policy (see FORBIDDEN 3, §4, and `docs/decisions/skill-authoring-conventions.md`).

**Codex CLI**
- `.agents/skills/` placement (cross-client convention; also read by OpenCode). (§1b.)
- `.codex/hooks.json` — near-copy of the Claude Code hook block (command handlers, 11 events; trust approval required on first run). (Claim 5.)
- `.codex/agents/*.toml` role files; `config.toml` knobs: `project_doc_fallback_filenames`, `project_doc_max_bytes`, `[skills]` enable/disable, `agents.max_concurrent_threads_per_session`. (§1b.)
- Optional per-skill `agents/openai.yaml` for display metadata / implicit-invocation policy. (§1b.)
- One-time: the first-party external-agent migrator can seed Codex config from existing `.claude/` assets. (Claim 5.)

**OpenCode**
- Usually **zero skill shim needed** — it natively reads both `.claude/skills/` and `.agents/skills/`. (§1c.)
- `opencode.json`: `instructions` array (extra files/globs), `permission.skill` map, `skills.paths`, per-agent `tools: {skill: false}`. (§1c.)
- `.opencode/plugins/*.ts` JS/TS plugin for hook-equivalent enforcement (`tool.execute.before/after`); `.opencode/agents/*.md` for subagents. (§1c.)
- Env kill-switches to be aware of (a user setting `OPENCODE_DISABLE_CLAUDE_CODE=1` silently drops `.claude/skills` discovery — the `.agents/skills` copy is the safety net). (§1c.)

## 4. Empirical harness checks

Run 2026-07-23 for
[Empirical harness checks: symlinked skill dirs and unknown frontmatter tolerance](https://github.com/artemVeduta/skills/issues/44).
Official release assets were checksum-verified before execution. The primary harnesses
were **Codex CLI rust-v0.145.0** and **OpenCode v1.18.4**; the same results were also
observed on the locally installed Codex CLI v0.144.5 and OpenCode v1.18.3.

| Check | Evidence | Result |
|---|---|---|
| Codex follows `.agents/skills/<name>` directory symlinks | An isolated project symlink pointed to a canonical skill elsewhere in the project. An ephemeral `codex exec` turn explicitly invoked it and returned its body-only marker `CODEX_01450_SYMLINK_SKILL_LOADED`. | **PASS** |
| OpenCode follows `.agents/skills/<name>` directory symlinks | Under isolated HOME/XDG paths, `opencode --pure debug skill` returned the parsed name, description, symlink-path location, and complete body including `OPENCODE_1184_AGENTS_SYMLINK_LOADED`. | **PASS** |
| OpenCode follows `.claude/skills/<name>` directory symlinks | The same isolated loader check returned the parsed metadata and complete body including `OPENCODE_1184_CLAUDE_SYMLINK_LOADED`. | **PASS** |
| Codex tolerates unknown top-level SKILL.md frontmatter | A valid skill also carried `when_to_use`, `context: fork`, and `argument-hint`. An ephemeral explicit invocation returned its body-only marker `CODEX_01450_UNKNOWN_FRONTMATTER_LOADED`; there was no parse error or skill drop. | **PASS** |

OpenCode's complete loader output is accepted as the compatibility-boundary proof: it
demonstrates discovery, symlink traversal, frontmatter parsing, and body loading. A
model-backed turn would additionally test orchestration, which is outside these
filesystem/loader questions. Codex used model-backed turns with body-only marker
oracles, making each observed invocation unambiguous.

Consequences for the later architecture decision: a canonical skill directory may be
dual-placed by symlink instead of physical copies, and the three tested Claude-only
frontmatter fields may coexist with portable fields without causing Codex to reject or
drop the skill. Neither finding makes harness-specific frontmatter semantics portable
or changes this repository's authoring allowlist.

## 5. Sources

Deduplicated; all fetched/verified 2026-07-22 unless noted.

- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/slash-commands
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/hooks
- https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md (latest v2.1.217)
- https://agentskills.io/home · https://agentskills.io/specification · https://agentskills.io/clients · https://agentskills.io/client-implementation/adding-skills-support.md
- https://github.com/agentskills/agentskills (spec source commit 6868401, 2026-05-16; no release tags)
- https://learn.chatgpt.com/docs/build-skills (308 from developers.openai.com/codex/skills)
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/custom-prompts
- https://learn.chatgpt.com/docs/developer-commands?surface=cli
- https://learn.chatgpt.com/docs/hooks
- https://learn.chatgpt.com/docs/build-plugins
- https://github.com/openai/codex (main @ 66bd101; release rust-v0.145.0 2026-07-21; skills origin rust-v0.65.0 / PR #7412, default-on PR #8297 / rust-v0.76.0)
- https://github.com/openai/codex/blob/main/codex-rs/core-skills/src/render.rs · loader.rs · loader/discovery.rs
- https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/render.rs
- https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs · codex-rs/core/src/session/mod.rs · codex-rs/core/src/config/agent_roles.rs
- https://github.com/openai/codex/blob/main/codex-rs/config/src/config_toml.rs
- https://github.com/openai/codex/blob/main/codex-rs/codex-home/src/instructions/mod.rs
- https://github.com/openai/codex/tree/main/codex-rs/external-agent-migration (hooks_cla.rs, subagents.rs)
- https://github.com/openai/codex/blob/main/codex-rs/hooks/src/lib.rs · hooks/src/registry.rs · hooks/src/engine/discovery.rs
- https://github.com/openai/codex/blob/main/codex-rs/exec-server-protocol/src/protocol.rs
- https://github.com/openai/codex/issues/6038 · https://github.com/openai/codex/issues/17401 · https://github.com/openai/codex/issues/19385
- https://github.com/openai/codex/pull/18298 · https://github.com/openai/codex/pull/18925
- https://opencode.ai/docs/skills/ · /docs/rules/ · /docs/commands/ · /docs/agents/ · /docs/plugins/ · /docs/config/
- https://opencode.ai/config.json (published config schema)
- https://github.com/anomalyco/opencode (dev branch; release v1.18.4 2026-07-20; skills in v1.0.186 PR #5921 + v1.0.190 PR #5930)
- https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/skill/index.ts · src/config/command.ts · src/config/agent.ts · src/config/paths.ts · src/session/instruction.ts
