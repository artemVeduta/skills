# Reference: obra/superpowers skill-authoring conventions

Research snapshot: **2026-07-11**. Primary source is
[obra/superpowers](https://github.com/obra/superpowers), cloned fresh into the
scratchpad at commit
[`d884ae0`](https://github.com/obra/superpowers/commit/d884ae04edebef577e82ff7c4e143debd0bbec99)
(2026-07-02), which reports itself as **v6.1.1** in `.claude-plugin/plugin.json`
([blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.claude-plugin/plugin.json#L4)).
All citations below are pinned to that commit SHA so line numbers stay stable;
the `main` branch may have moved on since. A locally-installed copy exists at
`/Users/artem.veduta/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.3/`
reporting **v6.0.3** in its own `plugin.json` — three point releases behind the
cloned HEAD (6.0.3 → 6.1.0 → 6.1.1), confirmed by comparing the `version` field in
both files. The installed copy is used only for cross-checking; the GitHub repo
is the cited source of truth throughout.

This is being gathered as background for GitHub issue #11 in
`artemVeduta/skills`, to decide our own skill-authoring conventions and quality
bar for a personal, multi-harness skill library that uses the plain SKILL.md
format without adopting the Claude-Code-plugin/marketplace machinery.

## a. Repo / library structure

The repo root contains, besides `skills/`: `docs/` (prose guides, e.g.
`docs/porting-to-a-new-harness.md`, `docs/testing.md`, `docs/windows/`), `hooks/`
(shell-hook bootstrap scripts and per-harness hook configs), `scripts/`
(maintainer tooling: version bump, shell lint, Codex packaging/sync), `tests/`
(per-harness and per-subsystem test suites), `assets/` (icons), and one manifest
directory **per harness**: `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`,
`.kimi-plugin/`, `.opencode/`, `.pi/`
([repo root tree](https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99)).

`skills/` itself is flat — 14 top-level skill directories, no subcategories —
each holding a `SKILL.md` and, where needed, supporting files
([skills/ listing](https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99/skills)).
The skill directory names as of this commit: `brainstorming`,
`dispatching-parallel-agents`, `executing-plans`,
`finishing-a-development-branch`, `receiving-code-review`,
`requesting-code-review`, `subagent-driven-development`,
`systematic-debugging`, `test-driven-development`, `using-git-worktrees`,
`using-superpowers`, `verification-before-completion`, `writing-plans`,
`writing-skills`.

Root-level project files include `CLAUDE.md` (contributor rules — see §d),
`AGENTS.md` (a symlink to `CLAUDE.md`,
[blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/AGENTS.md)),
`README.md` (install instructions per harness), `RELEASE-NOTES.md` (hand-written
changelog, see §f), `package.json`, `.pre-commit-config.yaml`, and
`.version-bump.json` (a maintainer manifest listing every versioned file that
must be bumped together —
[blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.version-bump.json)).
`.github/` holds a `PULL_REQUEST_TEMPLATE.md` and issue templates including a
dedicated `platform_support.md` template
([listing](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.github/ISSUE_TEMPLATE/platform_support.md)),
but there is **no CI workflow file** under `.github/workflows/` in this tree —
the only automated gate found is the local pre-commit config (§d), which lints
an external `evals/` subproject, not the skills themselves.

Two directories are explicitly not "the skills" but per-harness delivery
machinery: `hooks/` (shell-hook bootstrap, used by Claude Code and Cursor) and
`.opencode/` / `.pi/` (in-process plugin/extension code). The porting guide
frames these as strictly separate from skill content — "skills name actions,
not tools," and a port must never edit `skills/*/SKILL.md` to fit a harness
([docs/porting-to-a-new-harness.md](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md#L59-L63)).

## b. Skill authoring conventions

The canonical spec for SKILL.md structure lives in the `writing-skills` skill
itself
([skills/writing-skills/SKILL.md](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md)).

**Frontmatter:** two required YAML fields, `name` and `description`, capped at
1024 characters total; `name` restricted to letters/numbers/hyphens (no
parentheses or special characters); the file explicitly defers to
[agentskills.io/specification](https://agentskills.io/specification) for the
full field list rather than restating it
([SKILL.md L95-L109](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L95-L109)).

**Description phrasing ("Skill Discovery Optimization" section):** must start
with "Use when…", describe ONLY triggering conditions, and explicitly must
**not** summarize the skill's workflow — the file cites a concrete regression
where a workflow-summarizing description ("code review between tasks") caused
an agent to skip half the skill's flowchart, and fixed it by trimming the
description to pure triggers
([SKILL.md L140-L172](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L140-L172)).
Descriptions must be third person, keep triggers technology-agnostic unless the
skill itself is tech-specific, and pack in keywords a searching agent would use
(error strings, symptom words, synonyms)
([SKILL.md L174-L206](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L174-L206)).
Live examples in the repo follow this exactly, e.g.
`using-superpowers`: "Use when starting any conversation - establishes how to
find and use skills, requiring skill invocation before ANY response including
clarifying questions"
([skills/using-superpowers/SKILL.md L3](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/using-superpowers/SKILL.md#L3))
and `test-driven-development`: "Use when implementing any feature or bugfix,
before writing implementation code"
([skills/test-driven-development/SKILL.md L3](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/test-driven-development/SKILL.md#L3)).

**Naming convention:** directory/skill names are gerund-first, active-voice,
verb-driven ("creating-skills" not "skill-creation"; "condition-based-waiting"
not "async-test-helpers"), justified as better for search/discovery
([SKILL.md L207-L276](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L207-L276)).
This matches the actual directory names listed in §a.

**Recommended body template** (from the same file, §"SKILL.md Structure"):
Overview → When to Use → Core Pattern → Quick Reference → Implementation →
Common Mistakes → optional Real-World Impact
([SKILL.md L93-L137](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L93-L137)).

**Note on divergence from Anthropic's own guidance:** the repo vendors a copy
of Anthropic's official skill-authoring doc verbatim at
`skills/writing-skills/anthropic-best-practices.md`
([blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/anthropic-best-practices.md)),
which independently recommends: naming skills in **gerund form** ("Processing
PDFs"), frontmatter descriptions that state both what the skill does and when
to use it (not purely triggers)
([anthropic-best-practices.md L185-L219](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/anthropic-best-practices.md#L185-L219)),
and keeping SKILL.md body under 500 lines
([anthropic-best-practices.md L239-L243](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/anthropic-best-practices.md#L239-L243)).
The root `CLAUDE.md` states the project deliberately diverges from this
official guidance and will reject "compliance" PRs that reformat skills to
match it without eval evidence: *"Our internal skill philosophy differs from
Anthropic's published guidance on writing skills... PRs that restructure,
reword, or reformat skills to 'comply' with Anthropic's skills documentation
will not be accepted without extensive eval evidence."*
([CLAUDE.md, "Compliance changes to skills"](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/CLAUDE.md#L41-L43)).
Concretely, their own description style (pure triggers, no "what it does") is
the point of divergence from the vendored Anthropic doc.

## c. Progressive disclosure rules

`writing-skills` states no hard word/line-count ceiling in its own body
template, but does give explicit **word-count targets** in the "Token
Efficiency" subsection: getting-started/always-loaded skills should be under
150 words each, other frequently-loaded skills under 200 words total, and
"other skills" under 500 words
([SKILL.md L213-L266](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L213-L266)).
It gives a concrete verification command, `wc -w skills/path/SKILL.md`
([SKILL.md L262-L266](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L262-L266)).
In practice these targets are aspirational rather than enforced: measuring the
shipped skills directly, `writing-skills/SKILL.md` itself is 689 lines and the
14 SKILL.md files range from 62 lines (`using-superpowers`) to 689 lines
(`writing-skills`), several well past any "under 200 words" guidance (raw line
counts via `wc -l skills/*/SKILL.md` against the cloned tree).

**Directory-structure rule:** "Flat namespace — all skills in one searchable
namespace." Separate supporting files are reserved for (1) heavy reference
material of 100+ lines and (2) reusable tools/scripts/templates; everything
else — principles, code under 50 lines — stays inline
([SKILL.md L72-L91](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L72-L91)).
Three named file-organization patterns are given: self-contained (SKILL.md
only), skill-with-reusable-tool (SKILL.md + one script), and skill-with-heavy-
reference (SKILL.md + multiple named reference docs + a `scripts/` dir)
([SKILL.md L347-L373](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L347-L373)).
`writing-skills` itself is the canonical example of the third pattern in this
repo, bundling `anthropic-best-practices.md`,
`testing-skills-with-subagents.md`, `persuasion-principles.md`,
`graphviz-conventions.dot`, `render-graphs.js`, and an `examples/` subdirectory
([skills/writing-skills listing](https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills)).

**How supporting files are referenced from SKILL.md:** always by a bare
relative filename/link in prose, e.g. *"Testing methodology: See
[testing-skills-with-subagents.md](testing-skills-with-subagents.md) for the
complete testing methodology"*
([SKILL.md L587](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L587))
— never Claude Code's `@file` force-load syntax. The file explicitly forbids
`@`-links for **cross-skill** references because they force-load content
immediately and burn 200k+ tokens of context before it's needed
([SKILL.md L278-L288](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L278-L288)) —
`@`-include is reserved for the one Shape-C harness bootstrap case (Gemini,
now removed — see §f) where the harness's own mechanism, not agent judgment,
controls loading
([docs/porting-to-a-new-harness.md L263-L279](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md#L263-L279)).

## d. Quality bar & testing

The `writing-skills` skill
([SKILL.md](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md))
is the load-bearing document for this. Its core claim: **"Writing skills IS
Test-Driven Development applied to process documentation"**
([SKILL.md L10](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L10)),
mapped onto an explicit RED-GREEN-REFACTOR cycle
([SKILL.md L30-L45](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L30-L45)):

- **RED:** run a "pressure scenario" with a subagent *without* the candidate
  skill present, and document the agent's exact rationalizations verbatim.
- **GREEN:** write the minimal skill content addressing those specific
  observed failures, then re-run the same scenario and confirm compliance.
- **REFACTOR:** find new rationalizations the agent invents against the new
  wording, add explicit counters, and repeat until "bulletproof."

The companion file `testing-skills-with-subagents.md` gives the full mechanics:
how to write pressure scenarios (combine 3+ pressure types — time, sunk cost,
authority, economic, exhaustion, social, pragmatic), how to run a "meta-test"
by asking the agent post-hoc how the skill could have been clearer, and how to
recognize a "bulletproof" skill (agent complies, cites the skill's own
section, and acknowledges the temptation rather than rationalizing around it)
([testing-skills-with-subagents.md](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/testing-skills-with-subagents.md)).
A cheaper pre-step is prescribed before full pressure-scenario runs: "micro-test"
wording with 5+ single-shot fresh-context reps plus a mandatory no-guidance
control, reading every flagged response manually rather than trusting automated
keyword counts
([SKILL.md L575-L586](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L575-L586)).

Different skill "types" get different test strategies — discipline-enforcing
skills need adversarial pressure scenarios, technique/pattern/reference skills
need application and retrieval scenarios instead
([SKILL.md L395-L442](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L395-L442)).
The file also codifies a "Match the Form to the Failure" table: prohibition
lists only fix discipline violations and actively backfire when the real
problem is wrong output shape or a missing structural element, in which case a
positive recipe/template is prescribed instead
([SKILL.md L459-L474](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L459-L474)).

A full **checklist for each skill** (RED / GREEN / REFACTOR / Quality Checks /
Deployment) is provided and marked as literally per-todo-item mandatory —
"IMPORTANT: Create a todo for EACH checklist item below"
([SKILL.md L627-L666](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L627-L666)).
Batching multiple skill edits without testing each is explicitly called out as
a violation ("STOP: Before Moving to Next Skill" section)
([SKILL.md L614-L625](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L614-L625)).

**No CI lint for skill content.** The only automated gate in the repo is
`.pre-commit-config.yaml`, and it only runs `ruff` (lint/format) and `ty`
(type-check) over the separate `evals/` Python subproject — it does not touch
`skills/*/SKILL.md` at all
([.pre-commit-config.yaml](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.pre-commit-config.yaml)).
Real skill-behavior evaluation instead lives in a **separate external repo**,
`superpowers-evals`, cloned into `evals/` on demand — the root `CLAUDE.md`
describes it as a harness that "drives real tmux sessions of Claude Code /
Codex and judges skill compliance with an LLM verifier," explicitly
distinguished from the plugin-infrastructure tests that do live in `tests/`
([CLAUDE.md, "Eval harness"](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/CLAUDE.md#L64-L66)).
`tests/` itself is large and per-subsystem (`tests/hooks`, `tests/opencode`,
`tests/pi`, `tests/kimi`, `tests/codex`, `tests/claude-code`,
`tests/explicit-skill-requests`, `tests/brainstorm-server`, …) but these are
plugin-wiring/integration tests (hook JSON shape, bootstrap injection,
dedup/caching), not skill-content quality tests
([tests/ listing](https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99/tests)).

The contributor guidelines in root `CLAUDE.md` layer a very high human-review
bar on top of this: a stated 94% PR rejection rate, a mandatory PR template
with a "Rigor" section requiring adversarial-pressure-testing evidence for any
skill-content change, an explicit requirement to disclose the authoring
model/harness/plugins, and an explicit checkbox that a human reviewed the
complete diff before submission
([CLAUDE.md L1-L20](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/CLAUDE.md#L1-L20),
[.github/PULL_REQUEST_TEMPLATE.md L118-L131](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.github/PULL_REQUEST_TEMPLATE.md#L118-L131)).

## e. Cross-skill references

Convention is a **namespaced bare-word reference**, `superpowers:<skill-name>`,
never a file path and never an `@`-link — explicitly to avoid force-loading
content that may not be needed
([SKILL.md L278-L288](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L278-L288)).
Two strength markers are used consistently: `**REQUIRED SUB-SKILL:**` for a
skill that must be invoked as part of executing the current one, and
`**REQUIRED BACKGROUND:**` for a skill whose concepts the reader must already
understand
(examples: `executing-plans` — *"**REQUIRED SUB-SKILL:** Use
superpowers:finishing-a-development-branch"*
[L36](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/executing-plans/SKILL.md#L36);
`writing-skills` — *"**REQUIRED BACKGROUND:** You MUST understand
superpowers:test-driven-development"*
[L18](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/writing-skills/SKILL.md#L18)).
Softer, optional pointers use plain prose without the bold marker, e.g.
`subagent-driven-development`'s "Related Skills" list
([SKILL.md L409-L418](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/subagent-driven-development/SKILL.md#L409-L418)).
Same-directory or sibling-file references (a skill pointing at another skill's
*non-SKILL.md* file, e.g. a code-reviewer template) use ordinary relative
markdown links instead of the namespace form, e.g.
`../requesting-code-review/code-reviewer.md`
([subagent-driven-development/SKILL.md L270](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/subagent-driven-development/SKILL.md#L270)).
The `superpowers:` prefix is the plugin name from `.claude-plugin/plugin.json`
([blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.claude-plugin/plugin.json#L2)),
i.e. it doubles as Claude Code's own plugin-qualified skill-invocation syntax,
not a bespoke convention invented for prose.

## f. Distribution

**Plugin manifest:** `.claude-plugin/plugin.json` carries `name`, `description`,
`version` (semver), `author`, `homepage`, `repository`, `license`, `keywords`
([blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.claude-plugin/plugin.json)).
It declares neither a `skills` path nor a `hooks` path field — Claude Code
auto-discovers `skills/` and `hooks/hooks.json` by convention when both are
absent
([docs/porting-to-a-new-harness.md L237-L243](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md#L237-L243)).

**Marketplace listing:** `.claude-plugin/marketplace.json` at repo root
declares a marketplace named `superpowers-dev` with one plugin entry
(`name`, `description`, `version`, `source: "./"`, `author`)
([blob](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.claude-plugin/marketplace.json)).
The README documents installing from **two different marketplaces**: Anthropic's
official one (`/plugin install superpowers@claude-plugins-official`) and a
separate community marketplace repo, `obra/superpowers-marketplace`, registered
via `/plugin marketplace add obra/superpowers-marketplace` then installed from
there
([README.md, "Claude Code" section](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/README.md#L34-L54)).
The porting guide states plainly that the external `superpowers-marketplace`
repo, not this one, is the actual source users install the Claude Code plugin
from
([docs/porting-to-a-new-harness.md L677](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md#L677)).

**Versioning:** semver in `plugin.json`'s `version` field, kept in lockstep
across *seven* per-harness manifests (`package.json`, `.claude-plugin/plugin.json`,
`.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`.kimi-plugin/plugin.json`, `.claude-plugin/marketplace.json`'s
`plugins.0.version`, `gemini-extension.json`) by a maintainer script,
`scripts/bump-version.sh`, driven off the `.version-bump.json` manifest that
lists every file+field to update together
([.version-bump.json](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/.version-bump.json)).
Git tags follow `vX.Y.Z` (`v6.0.0`, `v6.0.2`, `v6.0.3`, `v6.1.0`, `v6.1.1`, …,
confirmed via `git tag` on the cloned repo). `RELEASE-NOTES.md` is a
hand-written, dated changelog with one `## vX.Y.Z (YYYY-MM-DD)` section per
release and prose subsections per feature/fix area, not an auto-generated
`CHANGELOG.md`
([RELEASE-NOTES.md](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/RELEASE-NOTES.md#L1-L26)).

**Multi-harness distribution is itself a first-class concern**, distinct from
the plain-SKILL.md content: the repo ships six additional harness-specific
manifest directories (Codex, Cursor, Kimi, OpenCode, pi, plus Antigravity/Gemini
support that has since had parts removed — the v6.1.0 release notes record
Gemini CLI support being dropped entirely after Google EOL'd the Gemini CLI,
[RELEASE-NOTES.md](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/RELEASE-NOTES.md#L23)),
each with its own install channel: native marketplace (Claude Code), an
external-fork-sync script (`scripts/sync-to-codex-plugin.sh` for Codex), a
git-URL extension install (Kimi, OpenCode), or package-manifest fields (pi) —
enumerated in the porting guide's distribution table
([docs/porting-to-a-new-harness.md L670-L681](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md#L670-L681)).
The load-bearing design rule underpinning all of this: **skill bodies describe
actions, never harness-specific tool names**, so the identical `skills/` tree is
shared byte-for-byte across every harness; only a thin per-harness "tool
mapping" reference file and a "bootstrap" injector differ
([docs/porting-to-a-new-harness.md L31-L56](https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md#L31-L56)).

## Synthesis (opinion, not sourced)

The following is my own assessment of what's worth adapting for
`artemVeduta/skills` — a personal, plain-SKILL.md library not tied to the
Claude Code plugin/marketplace mechanism. None of this is a claim about
`obra/superpowers`; it's a judgment call about what transfers.

**Worth copying:**

1. **Trigger-only descriptions, written as "Use when…".** Their documented
   regression (a workflow-summarizing description caused an agent to skip half
   the skill's steps) is a concrete, falsifiable argument, not just style
   preference. This is cheap to adopt and directly testable against our own
   skills.
2. **Namespaced cross-skill references with strength markers**
   (`**REQUIRED SUB-SKILL:**` / `**REQUIRED BACKGROUND:**` vs. a plain optional
   mention) instead of file-path links. It communicates obligation level in a
   way a bare markdown link can't, and it degrades gracefully in a
   non-Claude-Code harness that has no `skill:name` resolution — it's still
   readable prose either way.
3. **"Skills name actions, not tools" as a portability discipline.** Since our
   library already needs to work across harnesses (per AGENTS.md's "harness
   profiles" framing elsewhere in this repo), writing skill bodies in terms of
   "read a file" / "dispatch a subagent" rather than a specific tool call name,
   with any harness-specific mapping pushed into a separate reference file, is
   the single highest-leverage idea in the whole repo for a multi-harness
   library — it is the mechanism that makes one skill tree work everywhere.
4. **The RED phase discipline of "run it without the skill first and write
   down the literal failure/rationalization before writing the skill."** Full
   adversarial pressure-scenario testing with subagents is heavy machinery we
   likely don't need for most of our skills (many are reference/technique
   skills, not discipline-enforcing ones — their own "Testing All Skill Types"
   section concedes reference skills need only retrieval/application testing,
   not pressure testing). But the underlying habit — don't guess what a skill
   needs to say, watch a baseline failure first — is cheap and generalizes to
   any skill type.
5. **A lightweight PR/contribution bar that requires stating the concrete
   problem and evidence of testing**, scaled down from their PR template. We
   don't need a 94%-rejection-rate posture, but "what problem does this solve,
   what did you test" as a couple of required lines in a skill's own commit
   message or PR description is a cheap gut-check against skill-for-skill's-sake.
6. **One-level-deep references + table of contents for long reference files**
   (this is actually from the vendored Anthropic doc, not superpowers' own
   voice, but both agree on it) — avoid nested "see X, which says see Y."

**Worth noting but not copying wholesale:**

- **Full pressure-scenario/subagent TDD-for-skills as a blanket mandate.**
  Appropriate for a widely-distributed library whose skills actively fight
  agent rationalization under pressure (TDD, verification-before-completion).
  Overkill as a universal gate for a personal library's reference-style
  skills; adopting their own tiered "match testing to skill type" table (only
  discipline-enforcing skills get pressure scenarios) is more proportionate
  than adopting the checklist as written.
- **Word-count/line-count targets (150/200/500 words).** Their own shipped
  skills routinely blow past these numbers (689-line `writing-skills.md`), so
  treat this as directional pressure toward conciseness, not a hard gate to
  replicate literally — and note it directly conflicts in spirit with
  Anthropic's own "under 500 lines" framing, which superpowers explicitly says
  it deviates from.
- **The seven-manifest, multi-marketplace distribution machinery** (plugin.json
  × 5 harnesses, marketplace.json, version-bump orchestration, fork-sync
  scripts). This is explicitly out of scope per the task's framing (we're not
  adopting plugin/marketplace machinery) and is a large, ongoing maintenance
  surface that only pays off at their scale of multi-harness official
  distribution.
- **"Your human partner" terminology and the extremely directive,
  rationalization-proofing tone** (`<EXTREMELY-IMPORTANT>` blocks, Red Flags
  tables, Iron Laws). This is a deliberate, tuned voice for steering an agent
  under adversarial pressure in a widely-shared library; it would read as
  over-engineered ceremony in a personal library where the "adversary" is just
  future-me forgetting context, not a stranger's agent rationalizing around a
  rule under production-outage pressure.
