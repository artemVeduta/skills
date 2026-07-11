# Reference research: mattpocock/skills (for issue #11 authoring conventions)

Research snapshot: **2026-07-11**. Primary source is a shallow clone of
[`mattpocock/skills`](https://github.com/mattpocock/skills) at commit
[`391a270`](https://github.com/mattpocock/skills/tree/391a2701dd948f94f56a39f7533f8eea9a859c87)
(merge of PR #505, dated 2026-07-10), cloned into
`/private/tmp/claude-501/-Users-artem-veduta-proj-skills/def20121-d232-461a-a06f-18d26ccd5cdb/scratchpad/mattpocock-skills`.
All paths below are repo-relative to that clone unless stated otherwise; every GitHub
link is pinned to this commit so line numbers stay stable. Where the README pointed at
other primary sources the same author owns (`aihero.dev` docs pages, the referenced
`smart-zone` glossary entry), those are cited directly. The `npx skills` installer CLI is
**not** owned by Matt Pocock — confirmed via `npm view skills repository` →
`git+https://github.com/vercel-labs/skills.git` — so CLI behavior is out of scope here
and is already covered by
[`research/issue-6-npx-dependency-resolution.md`](/research/issue-6-npx-dependency-resolution.md).

## 1. Repo/library structure

Skills live under `skills/<bucket>/<name>/SKILL.md`, split into six bucket folders
([`.agents/writing-docs.md:1-3`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md#L1-L3),
directory listing in the clone):

- `engineering/` — daily code work (17 skills)
- `productivity/` — daily non-code workflow tools (5 skills)
- `misc/` — kept around but rarely used, not promoted
- `personal/` — tied to the author's own setup, not promoted
- `in-progress/` — drafts not yet ready to ship
- `deprecated/` — no longer used

39 `SKILL.md` files total (`find skills -name SKILL.md | wc -l` in the clone). Only
`engineering/` and `productivity/` are **promoted**: every skill there must be listed in
the top-level `README.md` and in `.claude-plugin/plugin.json`
([`.agents/writing-docs.md:3`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md#L3)).
`.claude-plugin/plugin.json` lists 21 skills as a flat array of paths — 16 of the 17
`engineering/` folders plus all 5 `productivity/` folders
([`.claude-plugin/plugin.json`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.claude-plugin/plugin.json)),
making the repo installable as a native Claude Code plugin as well as via the CLI.
The stated rule is not fully self-consistent in this snapshot:
`skills/engineering/resolving-merge-conflicts/` has a `SKILL.md` and a published docs
page at `docs/engineering/resolving-merge-conflicts.md`, but is absent from both
`README.md` and `.claude-plugin/plugin.json` and from `skills/engineering/README.md`'s
own list (confirmed by grepping the clone for the name in those three files — zero
matches) — one concrete data point on how tightly the "promoted bucket → listed
everywhere" convention is actually maintained by hand, with no tooling to catch drift.

Each bucket has its own `README.md` listing every skill with a one-line description,
grouped into **User-invoked** / **Model-invoked** for the promoted buckets, and a flat
list for the rest
([`skills/engineering/README.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/engineering/README.md),
[`skills/misc/README.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/misc/README.md),
[`skills/personal/README.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/personal/README.md),
[`skills/in-progress/README.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/in-progress/README.md),
[`skills/deprecated/README.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/deprecated/README.md)).

Besides `skills/`, the repo carries:

- `docs/engineering/*.md` and `docs/productivity/*.md` — a **published, human-facing
  docs mirror** of the two promoted buckets, one page per promoted skill, deployed to
  `aihero.dev` (see §3/§4).
- `.agents/` — repo-internal authoring rules consumed by contributors/agents, not
  shipped as skills: `invocation.md` (model- vs user-invoked contract), `writing-docs.md`
  (docs-page template), `adr/0001-*.md` (a real ADR about hard vs soft skill
  dependencies).
- `.out-of-scope/` — three short "why we said no" notes (issue tracker scope, grilling
  question caps, a verify-mode feature request), each ending with a "Prior requests"
  list of issue numbers
  ([`.out-of-scope/mainstream-issue-trackers-only.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.out-of-scope/mainstream-issue-trackers-only.md)).
- `.changeset/` + `CHANGELOG.md` + `.github/workflows/release.yml` — Changesets-driven
  versioning (npm's `@changesets/cli`), auto-opening a "Version Packages" PR on every push
  to `main`
  ([`.github/workflows/release.yml`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.github/workflows/release.yml),
  [`package.json`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/package.json)).
- `scripts/link-skills.sh` and `scripts/list-skills.sh` — maintainer-only dev tooling
  (see §6).
- `CLAUDE.md` and `CONTEXT.md` at the repo root — `CONTEXT.md` is itself an instance of
  the `domain-modeling` skill's own glossary format, defining the repo's domain terms
  (Issue tracker, Issue, Triage role)
  ([`CONTEXT.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/CONTEXT.md)).

## 2. Skill authoring conventions

**Frontmatter fields observed**, counted across all 39 `SKILL.md` files in the clone:
`name` (39), `description` (39), `disable-model-invocation` (22), `argument-hint` (4).
No other frontmatter keys appear anywhere in the repo (no `allowed-tools`, no `version`,
no license/author fields) — the frontmatter surface is intentionally minimal.

**Naming**: `name` is always the dash-case directory name repeated
(`name: tdd`, `name: writing-great-skills`), i.e. redundant with the folder but present
in every file. There is no separate namespace prefix.

**The one binding axis is invocation**, formalized in
[`.agents/invocation.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/invocation.md):

- **User-invoked**: `disable-model-invocation: true` set. Reachable only by a human
  typing the slash command. `description` becomes a human-facing one-liner with trigger
  phrasing stripped.
- **Model-invoked** (the default, no flag): `description` is model-facing and carries
  rich trigger phrasing ("Use when the user wants…, mentions…, asks for…") so
  autonomous firing works. Also reachable by name and by other skills.
- Rule: because a user-invoked skill has no description, "no other skill can fire it" —
  a user-invoked skill may call a model-invoked one, never the reverse
  ([`.agents/invocation.md:8`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/invocation.md#L8)).

22 of 39 skills (56%) are user-invoked; the rest are model-invoked. Description-writing
guidance in the meta-skill: front-load the leading word, one trigger phrase per distinct
branch (collapse synonyms), and cut identity already stated in the body
([`skills/productivity/writing-great-skills/SKILL.md:22-28`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/SKILL.md#L22-L28)).

`argument-hint` appears only on 4 skills, all of them stateful, workspace-writing,
user-invoked skills that expect a specific kind of free-text argument (`teach`,
`handoff`, `claude-handoff`, `loop-me`) — e.g.
`argument-hint: "What would you like to learn about?"`
([`skills/productivity/teach/SKILL.md:5`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/teach/SKILL.md#L5)).

**Consistency**: every file follows the same YAML frontmatter → optional `# Title` →
body shape; several of the shortest ones skip the title entirely and go straight to one
or two sentences of prose (e.g.
[`skills/productivity/grill-me/SKILL.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/grill-me/SKILL.md),
7 lines total, body is just "Run a `/grilling` session."). There is no enforced section
skeleton (no mandatory "## Process" or "## Examples"); structure is left to what the
skill needs, consistent with the meta-skill's stated philosophy that "reference" content
can be "a legitimately flat peer-set" rather than an ordered runbook
([`skills/productivity/writing-great-skills/GLOSSARY.md:79`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/GLOSSARY.md#L79)).

## 3. Progressive disclosure

Line counts of all 39 `SKILL.md` files span 7 to 140 lines (total 2,749 lines; median
~76). Distribution from the clone (`wc -l`):

- Under 20 lines: 8 skills (mostly thin user-invoked wrappers like `grill-me`,
  `grill-with-docs`, `research`, `handoff`, `implement` that delegate to a
  model-invoked skill or describe one short loop)
- 20–79 lines: 17 skills
- 80–140 lines: 14 skills (the heaviest are `teach` at 140 and `diagnosing-bugs` at 134)

**Supporting files pattern**: several skills push reference material into sibling
`.md` files inside the same skill folder, linked with a relative Markdown link and named
for what they hold:

- `skills/engineering/domain-modeling/` — `SKILL.md` (74 lines) links to
  `CONTEXT-FORMAT.md` (60 lines) and `ADR-FORMAT.md` (47 lines) for the two artifact
  templates it produces
  ([`skills/engineering/domain-modeling/SKILL.md:62,74`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/engineering/domain-modeling/SKILL.md#L62)).
- `skills/productivity/teach/` — `SKILL.md` (140 lines) links out to four format files:
  `MISSION-FORMAT.md`, `RESOURCES-FORMAT.md`, `LEARNING-RECORD-FORMAT.md`,
  `GLOSSARY-FORMAT.md`
  ([`skills/productivity/teach/SKILL.md:14-17`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/teach/SKILL.md#L14-L17)).
- `skills/engineering/prototype/` — `SKILL.md` (26 lines) links to `LOGIC.md` (79 lines)
  and `UI.md` (112 lines), i.e. the disclosed reference is far longer than the top-level
  file.
- `skills/engineering/codebase-design/` — `SKILL.md` (114 lines) links to
  `DEEPENING.md` (37 lines) and `DESIGN-IT-TWICE.md` (44 lines).
- `skills/productivity/writing-great-skills/` — `SKILL.md` (83 lines) links to a single
  `GLOSSARY.md` (202 lines) holding every defined term, explicitly framed as "the
  disclosed reference for `writing-great-skills`"
  ([`skills/productivity/writing-great-skills/GLOSSARY.md:3`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/GLOSSARY.md#L3)).

The meta-skill names this move **progressive disclosure** explicitly: "moving reference
down the ladder — out of SKILL.md and behind a context pointer — so the top stays
legible... licensed by branching: disclose what only some branches need, inline what
every path needs"
([`skills/productivity/writing-great-skills/GLOSSARY.md:101-103`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/GLOSSARY.md#L101-L103)).
It draws a three-way distinction between **in-skill step**, **in-skill reference**, and
**external reference** (reference pushed fully outside the skill system, reachable by any
skill)
([`skills/productivity/writing-great-skills/SKILL.md:32-38`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/SKILL.md#L32-L38)).

Cross-skill links are deliberately **not** filesystem paths: dependencies between skills
are prose invocation ("Run the `/grilling` skill"), never `../other-skill/FILE.md`
references — "Shared reference docs live inside the skill that owns them; other skills
reach that material by invoking the skill, not by linking across folders"
([`.agents/invocation.md:12-14`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/invocation.md#L12-L14)).

## 4. Quality bar: linting, tests, CI, authoring guidance

**No automated skill linting, schema validation, or tests were found.** `package.json`'s
only `devDependencies` are `@changesets/cli` and `@changesets/changelog-github`; its only
scripts are `changeset` and `version`
([`package.json`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/package.json)).
The sole GitHub Actions workflow,
[`.github/workflows/release.yml`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.github/workflows/release.yml),
runs `changesets/action@v1` to open a version-bump PR on push to `main` — it does not
run any skill-content check. There is no `.github/workflows/ci.yml`, no markdown linter
config, and no test runner in the repo.

**The quality bar is entirely a written, human-applied standard**, carried by two
documents:

1. [`skills/productivity/writing-great-skills/SKILL.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/SKILL.md)
   (83 lines) + its
   [`GLOSSARY.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/GLOSSARY.md)
   (202 lines) — itself a skill in the repo (`productivity` bucket, user-invoked),
   stating the root principle as **Predictability**: "the agent taking the same
   *process* every run, not producing the same output"
   ([`SKILL.md:7`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/SKILL.md#L7)),
   and naming five named failure modes to diagnose against: **Premature completion**,
   **Duplication**, **Sediment**, **Sprawl**, **No-op**, **Negation**
   ([`SKILL.md:74-83`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/productivity/writing-great-skills/SKILL.md#L74-L83)).
2. [`.agents/writing-docs.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md)
   — a mandatory template and "Done when" checklist (8 bullets) for the published docs
   page every promoted skill must carry
   ([`.agents/writing-docs.md:72-82`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md#L72-L82)).

Enforcement is social/process, not tooling: `CHANGELOG.md` entries show the author
manually re-reviewing and rewriting skills against this standard over time — e.g. v1.1.0
notes bringing the `ask-matt` router "up to date," hardening `code-review`, and adding
two new failure-mode glossary entries to `writing-great-skills` itself
([`CHANGELOG.md:1-9`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/CHANGELOG.md#L1-L9)).
The `.out-of-scope/` notes function as a lightweight, precedent-based ADR log for feature
requests declined against this bar
([`.out-of-scope/question-limits.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.out-of-scope/question-limits.md)).

## 5. How skills reference/build on each other

Two explicit mechanisms, both documented in
[`.agents/invocation.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/invocation.md):

- **Prose invocation**, e.g. `domain-modeling`'s only cross-skill reference is
  conceptual ("Merely reading `CONTEXT.md`... is not this skill"); `tdd`'s `SKILL.md`
  tells the agent to "respect ADRs in the area you're touching" without linking any file
  ([`skills/engineering/tdd/SKILL.md:9`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/engineering/tdd/SKILL.md#L9)).
- A dedicated **router skill**, `ask-matt` (engineering) — 76 lines, user-invoked,
  `disable-model-invocation: true` — that maps every user-reachable skill into a
  **main flow** (`grill-with-docs → to-spec → to-tickets → implement → code-review`,
  with `tdd` as the engine `implement` drives internally), named **on-ramps**
  (`triage`, `diagnosing-bugs`, `wayfinder`), a **codebase health** pass
  (`improve-codebase-architecture`), two **vocabulary-underneath** references
  (`domain-modeling`, `codebase-design`), a session-crossing pair (`handoff` vs.
  built-in `/compact`), and a flat **standalone** list
  ([`skills/engineering/ask-matt/SKILL.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/engineering/ask-matt/SKILL.md)).
  The router's own context-hygiene guidance links to an external primary source the
  author also owns — the **smart zone** entry of his AI coding dictionary, "the window
  (~120k tokens on state-of-the-art models) within which the model still reasons
  sharply" — as the reason to `/handoff` before compacting a long grilling session
  ([`skills/engineering/ask-matt/SKILL.md:32`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/skills/engineering/ask-matt/SKILL.md#L32),
  linking to
  [`https://www.aihero.dev/ai-coding-dictionary/smart-zone`](https://www.aihero.dev/ai-coding-dictionary/smart-zone)).
  `ask-matt` is also a maintenance-triggering artifact: the repo's own convention says
  "whenever you add, rename, remove, or change how a user-reachable skill fits the
  flows, re-read `ask-matt`'s `SKILL.md` and update it"
  ([`.agents/writing-docs.md:20`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md#L20)),
  and `CHANGELOG.md` v1.1.0 documents exactly that re-sync happening in practice.
- A short **hard-vs-soft dependency ADR**
  ([`.agents/adr/0001-explicit-setup-pointer-only-for-hard-dependencies.md`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/adr/0001-explicit-setup-pointer-only-for-hard-dependencies.md))
  splits skills that need `setup-matt-pocock-skills`'s per-repo config into
  **hard-dependency** skills (`to-tickets`, `to-spec`, `triage` — output is *wrong*,
  not just fuzzy, without the config; each gets an explicit "run
  `/setup-matt-pocock-skills` if not" pointer) and **soft-dependency** skills (`tdd`,
  `improve-codebase-architecture` — reference "the project's domain glossary" in vague
  prose only, and degrade gracefully without it). No machine-readable dependency
  manifest (no `requires:` frontmatter field, no dependency-graph file) exists anywhere
  in the repo — the graph lives entirely in prose and in the `ask-matt` router.

## 6. Distribution/installation story

**Primary install path** is the `npx skills` CLI (owned by `vercel-labs`, not Matt
Pocock — see the confirmation note at the top):

```bash
npx skills@latest add mattpocock/skills
```

documented in the top-level Quickstart
([`README.md:25-40`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/README.md#L25-L40))
and repeated per-skill on every published docs page
(`npx skills add mattpocock/skills --skill=<name>` /
`npx skills update <name>`), e.g.
([`docs/engineering/tdd.md:4-8`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/docs/engineering/tdd.md#L4-L8)).
Step 2 of the Quickstart says the CLI lets the user "pick the skills you want, and which
coding agents you want to install them on," implying multi-harness targeting is the
CLI's job, not something this repo's own files configure
([`README.md:33`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/README.md#L33)).

**Native plugin path**: `.claude-plugin/plugin.json` lists the 21 promoted skills,
letting Claude Code install the whole set as one plugin
([`.claude-plugin/plugin.json`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.claude-plugin/plugin.json)).

**Maintainer/dev path**: `scripts/link-skills.sh`, explicitly marked "NOT a supported
installer" and off-limits to modification requests, symlinks every non-deprecated skill
folder into two local harness directories:

```
~/.claude/skills   — Claude Code
~/.agents/skills    — pi and other Agent-Skills-standard harnesses
```

so "a `git pull` is all that's needed to keep installed skills up to date"
([`scripts/link-skills.sh:1-16`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/scripts/link-skills.sh#L1-L16)).
This is the one place in the repo that names the `.agents/skills` convention as a
second, harness-agnostic install target alongside Claude Code's `.claude/skills` — a
direct primary-source data point for the "Agent-Skills-standard" convention our own
library also targets. `scripts/list-skills.sh` is a trivial companion that just lists
every `SKILL.md` path
([`scripts/list-skills.sh`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/scripts/list-skills.sh)).

**Published docs site**: every promoted skill's docs page is deployed to
`https://aihero.dev/skills-<name>` regardless of which bucket it lives in — "the docs
path is repo organisation only"
([`.agents/writing-docs.md:3`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md#L3)).
Because pages are published externally, every link on them must be absolute
(`https://aihero.dev/...` or `https://github.com/mattpocock/skills/...`), never a
repo-relative path
([`.agents/writing-docs.md:9`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/.agents/writing-docs.md#L9)).
The README also links a newsletter signup (`aihero.dev/s/skills-newsletter`, ~60,000
subscribers per the author's own claim) as the "keep up with changes" channel, separate
from the repo/CLI update mechanism
([`README.md:15-23`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/README.md#L15-L23)).

No `AGENTS.md`, `Codex`-specific docs, or Cursor-specific config were found anywhere in
the repo; Codex is named once, only in prose describing the failure modes these skills
fix ("Claude Code, Codex, and other coding agents,"
[`README.md:44`](https://github.com/mattpocock/skills/blob/391a2701dd948f94f56a39f7533f8eea9a859c87/README.md#L44)),
not as an installation target this repo configures directly — multi-harness support here
is delegated entirely to the external `npx skills` CLI and to the harness-agnostic
`~/.agents/skills` convention used by `link-skills.sh`.

## 7. Synthesis — shortlist worth copying (not primary-source fact; author's judgment)

Everything below is my own synthesis for issue #11, clearly separated from the cited
facts above.

1. **A meta-skill that is itself a skill.** `writing-great-skills` (+ its `GLOSSARY.md`)
   encodes the authoring bar as a first-class, invocable, versioned artifact rather than
   a wiki page — it gets reviewed and iterated the same way any other skill does (see
   the CHANGELOG entries adding new failure modes). Worth copying the *form*: our own
   authoring conventions should probably live as a skill (or at minimum a doc reachable
   the same way), not only as prose in `AGENTS.md`.
2. **Name the invocation axis explicitly in frontmatter**, and make the consequence a
   hard rule: user-invoked skills cannot be reached by other skills. This is a cheap,
   high-leverage convention (one boolean field) that resolves a whole class of "should
   this fire automatically" ambiguity up front.
3. **A single named failure-mode vocabulary** (Premature completion, Duplication,
   Sediment, Sprawl, No-op, Negation) gives reviewers a shared, compact checklist instead
   of vague "make it better" feedback — worth adopting the *vocabulary*, independent of
   whether we copy the exact six terms.
4. **Progressive disclosure via same-folder sibling files, linked by relative path and
   named for their content** (`GLOSSARY.md`, `*-FORMAT.md`, `LOGIC.md`/`UI.md`) is a
   simple, low-ceremony pattern worth keeping regardless of our bucket/flat-directory
   decision — it composes fine with our existing flat `skills/<name>/` layout
   (`docs/decisions/skill-library-structure.md`).
5. **Router skill for cognitive-load management once user-invoked skills multiply.**
   `ask-matt` is a good concrete pattern for "the human is the index" problem — worth
   copying once/if our library grows past a handful of user-invoked skills.
6. **A lightweight `.out-of-scope/` folder** as a decision log for declined feature
   requests, each with a "why" and a list of prior issue numbers, is a cheap and
   effective ADR-adjacent artifact — arguably redundant with our own `docs/decisions/`
   ADRs, but the *pattern* of citing declined-issue numbers for traceability is worth
   taking regardless of where we put it.
7. **Deliberately no linting/CI for skill content** is itself a data point, not
   necessarily a practice to copy: the entire quality bar there is social/manual. Given
   our repo is already investing in `docs-validate` and an OKF bundle, this is a place
   we may consciously diverge rather than converge — worth flagging in the issue #11
   discussion as "mattpocock's repo has zero automated skill-quality gates; we are
   choosing to have some."
8. **Prose-only, `/skill`-name cross-references — never cross-skill filesystem
   paths.** This matches (and is independent confirmation of) our own
   `docs/decisions/skill-dependencies.md` choice to forbid cross-skill filesystem paths;
   worth citing as external validation, not a new idea to adopt.
9. **Hard- vs. soft-dependency split**, expressed only as an ADR + prose convention (no
   machine-readable manifest), is a useful *cheaper alternative* to our own
   `## Required skills` machine-readable section if we ever want a lighter-weight tier
   for "improves output but doesn't require" relationships alongside our hard
   dependency declarations.
10. **Docs pages as a distributed router, one node per skill, all pointing back at a
    single hub** (`ask-matt` is the hub every docs page links to) is a clean way to keep
    a growing set of skill docs navigable without a central "everything" document going
    stale — worth considering if/when our OKF subsystem docs for skills grow past a
    handful of entries.
