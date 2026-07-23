# Reference: claude-obsidian's autoresearch pattern

Research snapshot: **2026-07-22**. Primary source is
[AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) at commit
[`cb93ff6`](https://github.com/AgriciDaniel/claude-obsidian/commit/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b)
(2026-05-28), which reports itself as **v1.9.2** in `.claude-plugin/plugin.json`
([blob](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/.claude-plugin/plugin.json#L2-L3)).
All citations below are `path:line` in that tree and are pinned to that SHA so line numbers
stay stable; `main` may have moved on since. Two files carry most of the design and are
abbreviated throughout: **SKILL.md** =
[`skills/autoresearch/SKILL.md`](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/SKILL.md)
and **program.md** =
[`skills/autoresearch/references/program.md`](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/references/program.md).

Gathered for wayfinder ticket #35; §f is spec input for ticket #39 (shape of the OKF
autoresearch skill). It honors the locked map decisions: skills are pm/path-agnostic,
identical behavior across Claude Code / Codex CLI / OpenCode (no hooks or subagent
dependencies), bundle root stays `docs/`, code is config-value authority, plan-only.

## a. The mechanism

### Files and entry points

- **SKILL.md** is the whole loop: frontmatter `name: autoresearch`, trigger phrases
  embedded in `description` (`"/autoresearch"`, `"research [topic]"`, `"deep dive into
  [topic]"`, `"build a wiki on"`, …), and `allowed-tools: Read Write Edit Glob Grep
  WebFetch WebSearch` (SKILL.md:2-11). Framing self-instruction: "You are a research
  agent. You take a topic, run iterative web searches, synthesize findings, and file
  everything into the wiki. The user gets wiki pages, not a chat response."
  ([SKILL.md L16](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/SKILL.md#L16)).
  Pattern attribution: "Based on Karpathy's autoresearch pattern: program.md configures
  objectives and constraints, the loop runs until depth is reached, output goes directly
  into the knowledge base." (SKILL.md:6-7, :18).
- **program.md** is the user-editable research program, read "before every run"
  (program.md:3; SKILL.md:88-90). Full surface in §b.
- [`commands/autoresearch.md`](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/commands/autoresearch.md)
  is a thin Claude Code slash wrapper — "Read the `autoresearch` skill. Then run the
  research loop." (commands/autoresearch.md:5) — and carries exactly one thing the skill
  body does NOT: the vault-existence guard ("No wiki vault found. Run /wiki first to set
  one up.", :15). Its other instructions duplicate SKILL.md's own sections: the
  read-program.md-first instruction (:13 vs SKILL.md:88-90 "Before Starting"), the
  post-run index/log/hot bookkeeping reminder (:17 vs SKILL.md:230-243 "After Filing"),
  and the report instruction (:19 vs SKILL.md:246-267 "Report to User"). A bare-skill
  copy loses only the vault guard.

### Topic selection (pre-loop), three paths

- **A — explicit topic**: used "verbatim", skipping the other paths (SKILL.md:98-99).
- **B — boundary-first (opt-in)**: gated by `BOUNDARY_MODE=1` iff
  `./scripts/boundary-score.py` is executable AND `./.vault-meta` exists AND python3 is
  present (SKILL.md:108-114). Runs `boundary-score.py --json --top 5`, scoring frontier
  pages by `boundary_score = (out_degree - in_degree) * recency_weight`
  ([scripts/boundary-score.py L7](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/scripts/boundary-score.py#L7);
  SKILL.md:118). Hard rules: "No automatic selection happens without user confirmation"
  (commands/autoresearch.md:9); helper failure (non-zero exit, invalid JSON, empty) falls
  through to C — "do NOT improvise a topic" (SKILL.md:119). Picking 1-5 uses the selected
  page's title; free text is used as typed; cancel falls to C (SKILL.md:121-123). Stated
  epistemics: "The boundary score is a heuristic, not an objective measure of what SHOULD
  be researched." (SKILL.md:125). Known limitation: filename-stem wikilink resolution
  only, frontmatter `aliases:` not parsed (SKILL.md:127).
- **C — fallback**: ask "What topic should I research?" (SKILL.md:129-130).

### The loop, exact bounds

Given as a numbered pseudo-program
([SKILL.md L134-L155](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/SKILL.md#L134-L155)):

| Phase | Steps | Bounds |
|---|---|---|
| Round 1 — broad search | decompose topic into search angles; WebSearch per angle; WebFetch top results per angle; extract key claims, entities, concepts, open questions per source | **3-5 angles** (:140); **2-3 queries/angle** (:141); **top 2-3 fetches/angle** (:142) |
| Round 2 — gap fill | identify what's missing or contradicted from Round 1; targeted searches per gap; fetch top results | **max 5 gap queries** (:147) |
| Round 3 — synthesis check (optional) | only "if major contradictions or missing pieces still exist" | **one more targeted pass** (:150-151); otherwise skip to filing (:152) |

Other bounds:

- **Max rounds: 3** — stated at SKILL.md:154 as "(as set in program.md)"; the value lives
  in program.md:34, the round *semantics* do not (cap delegated, structure fixed).
- **Max pages filed per session: 15** (program.md:35); **max sources fetched per round: 5**
  (program.md:36).
- **No fetch cap exists.** SKILL.md:64 is explicit: the 15-page cap "limits FILING cost
  but does NOT cap FETCH count"; the only fetch bound is the structural estimate "up to
  **3 rounds × 5 sources × 3 angles ≈ 45 `WebFetch` calls**", metered through the
  Anthropic plan, with an instruction to "Surface the budget expectation to the user
  before kicking off research on a high-cost topic" (SKILL.md:64). (SKILL.md:64 also cites
  a `max_pages: 15` *key* that does not exist — program.md is pure prose; see §b.)
- Fetched bodies truncate to ~50KB (SKILL.md:62). Typical write volume "often 10-30 page
  writes per topic" (SKILL.md:74).

### Stop conditions

- Early stop: Round 3 skipped when no major contradictions/missing pieces remain
  (SKILL.md:152); general rule "Stop when depth is reached or max rounds hit"
  (SKILL.md:154) — **"depth" is never defined** in either file.
- Overflow: max pages reached before the loop completes → "file what you have, note what
  was skipped in Open Questions" (program.md:37).
- Constraint conflict: "If a constraint conflicts with completeness, respect the
  constraint and note what was left out in the Open Questions section." (SKILL.md:279).
- Fetch failure never aborts: "log the URL + reason to `wiki/log.md` and continue the
  loop. Do NOT abort the whole run. Do NOT silently swallow" (SKILL.md:66).
- Lock contention: losing `wiki-lock` acquire skips that page for the pass, logs
  `wiki/log.md`, picks it up next pass (SKILL.md:82).

### Self-instructions (epistemic scaffolding)

A "How to think" table maps a 10-principle framework onto the skill (SKILL.md:283-298).
Load-bearing rows: confirmation-bias check — "Am I steering the search toward what I
already expect to find? Confirmation bias kills research." (:290); seek "the
counter-position the user might NOT have considered" (:291); "credibility-weighted source
filter" (:292 — the only in-loop operationalization of program.md's source preferences);
synthesis "lives at the intersection, not in any single source" (:293); "30 pages of
low-signal noise wastes the user's time and Anthropic plan budget. Quality over volume."
(:295); "Missing sources are part of the synthesis — file them under Open Questions, don't
paper over." (:296); "full traceability per claim" (:297); "Open Questions feed the next
research cycle; the loop is incremental, not exhaustive." (:298).

### Source-quality hierarchy

There is **no ranked tier list and no tie-breaking rule** anywhere. Quality is three
overlapping soft mechanisms in program.md: a global prefer list ("prefer: .edu,
peer-reviewed papers, official documentation, primary sources, established publications",
program.md:11); per-domain "Prefer:" lists in Domain Notes (:56, :60, :64); and exclusions
demoted from high confidence (:71-75). Modifiers: prefer sources from the last 2 years
unless foundational (:16); mark sources older than 3 years potentially stale (:28).
Contradiction adjudication is judgment, not algorithm: the synthesis Contradictions
section asks for "[Brief note on which is more credible and why]" (SKILL.md:217).

### Confidence labels

Defined entirely in program.md — SKILL.md defers ("how to score confidence", SKILL.md:90,
:276). Three values, exact definitions
([program.md L22-L28](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/references/program.md#L22-L28)):
"**high**: multiple independent authoritative sources agree" / "**medium**: single good
source, or sources partially agree" / "**low**: speculation, opinion pieces, single
informal source, or claim not verified", applied per claim ("Label every claim with
confidence when filing", :22) plus the >3-year staleness flag (:28). The filing hook is a
`confidence` frontmatter key on every `wiki/sources/` page (SKILL.md:164).

### Open Questions handling

The loop's honesty channel; four intake routes and one outlet:

1. Extracted per source in Round 1 step 4 (SKILL.md:143).
2. Every failed/skipped fetch: "every skipped source is a fact the user needs in the
   synthesis page's 'Open Questions' section" (SKILL.md:66).
3. Page-cap overflow (program.md:37).
4. Constraint-truncated coverage (SKILL.md:279; restated :296).

Outlet: a required `## Open Questions` section on the synthesis page (SKILL.md:219-221),
counted in the user report ("Open questions filed: N", :266), and declared as fuel for
the next cycle (:298) — though no concrete re-ingestion mechanism exists beyond the
synthesis page living in `wiki/questions/` (:174) and boundary scoring's indirect signal.

### Filing and reporting

Four page classes per run (SKILL.md:161-177): `wiki/sources/` (one per major reference,
frontmatter `type, source_type, author, date_published, url, confidence, key_claims`),
`wiki/concepts/` and `wiki/entities/` (dedupe against the index first, update rather than
duplicate), and one `wiki/questions/` synthesis page "Research: [Topic]" — "the master
synthesis" with sections Overview, Key Findings, Entities, Concepts, Contradictions, Open
Questions, Sources (:174-177); inline template at
[SKILL.md L183-L226](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/SKILL.md#L183-L226)
(frontmatter `type: synthesis`, `status: developing`, `related:` = every page created this
session, per-claim `(Source: [[Source Page]])` citations). Destinations are rerouted per
vault methodology via `python3 scripts/wiki-mode.py route research "<topic>"`
(generic/LYT/PARA/Zettelkasten; absent `.vault-meta/mode.json` → generic;
SKILL.md:36-45). Post-filing: update `wiki/index.md`, prepend a `wiki/log.md` entry,
update `wiki/hot.md` (§d). Fixed report-to-user template with counters "Rounds: N |
Searches: N | Pages created: N", file list, 3 key findings, open-question count
(SKILL.md:246-267).

## b. The complete config surface (`references/program.md`, 75 lines)

program.md is **pure prose markdown — no YAML, no key/value syntax** — under six `##`
sections (program.md:7, 20, 32, 41, 51, 69). Self-description: "This file configures the
autoresearch loop. Edit it to match your domain and research style. The autoresearch
skill reads it before every run." (program.md:3).

| Section | Directive | Default |
|---|---|---|
| Search Objectives (:7-16) | prefer authoritative sources (.edu, peer-reviewed, official docs, primary, established publications) | :11 |
| | extract key entities; extract key concepts/frameworks; note contradictions; identify open questions | :12-15 |
| | prefer sources from last 2 years unless topic is foundational | :16 |
| Confidence Scoring (:20-28) | label every claim; high / medium / low definitions | :22-26 |
| | note source date; mark >3-year-old claims potentially stale | :28 |
| Loop Constraints (:32-37) | max search rounds per topic | **3** (:34) |
| | max wiki pages created per session | **15** (:35) |
| | max sources fetched per round | **5** (:36) |
| | overflow: file what you have, note skipped in Open Questions | :37 |
| Output Style (:41-47) | declarative, present tense; cite every non-obvious claim `(Source: [[Page]])`; pages under 200 lines, split if longer; no hedging language; flag uncertainty via `> [!gap]` callout | :43-47 |
| Domain Notes (:51-65) | "[Add domain-specific instructions here. Examples:]" — shipped examples: AI/tech (arXiv, official repos; "LLM benchmarks are often gamed: treat leaderboard claims as low confidence unless independently verified"), business (filings, Crunchbase; press releases low confidence), medical (PubMed, Cochrane; note sample size/study type/recency) | :53-65 |
| Exclusions (:69-75) | soft blocklist — "Do not cite as high-confidence sources:" Reddit/forums (pointers to primary only), social media, undated pages, sources that don't cite their own claims | :71-75 |

**Fixed-vs-editable split.** Everything in program.md is user-editable (declared at
program.md:3 and SKILL.md:90); SKILL.md's Constraints section calls the four deferred
categories "defaults" — max rounds, max pages, confidence rules, source-preference rules
(SKILL.md:274-277) — confirming overridability. Everything else is fixed in SKILL.md with
no invitation to edit: the round structure and per-round query/fetch counts
(SKILL.md:139-152), egress hygiene (:51-68), transport/mode/lock procedures (:22-84),
filing taxonomy and synthesis template (:159-226), bookkeeping and report formats
(:230-267), topic-selection paths (:94-130). No rationale for the split is stated beyond
program.md configuring "your domain and research style" (program.md:3).

**Two defects to not replicate:**

1. **Missing-file behavior is unspecified.** Nothing defines what happens if program.md
   is absent — in contrast to mode routing, which has an explicit absent-file fallback
   (SKILL.md:43).
2. **Phantom key.** SKILL.md:64 cites "`max_pages: 15` cap in `references/program.md`" in
   key syntax; the actual text is prose ("Max wiki pages created per session: **15**",
   program.md:35). Same value, mismatched naming — exactly the drift the locked
   config-value-authority decision (single source, cite symbols only) exists to prevent.

Also: Output Style and Exclusions are never individually referenced by SKILL.md — they are
honored only via the blanket "Read `references/program.md`" instruction (SKILL.md:88-90).

## c. Safety guardrails by enforcement layer

Bottom line first: **every URL/content safety rule specific to the research flow is
prompt-level markdown in one SKILL.md section**
([L47-L68](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/autoresearch/SKILL.md#L47-L68),
"Web egress hygiene (v1.8.2+)"). No hook or script enforces scheme filtering, SSRF
blocking, or sanitization for research; the verifier subagent has no runtime role in it.

| Guardrail | Source | Layer |
|---|---|---|
| Scheme filter: fetch only `http(s)://`; reject `file://`, `javascript:`, `data:` | SKILL.md:52 | **prompt** |
| SSRF block: reject RFC1918 (`10.x`, `172.16-31.x`, `192.168.x`) and `localhost`/`127.0.0.1` | SKILL.md:53 | **prompt** |
| Provenance allowlist: reject hosts "not surfaced by the prior `WebSearch` step"; no redirects to unseen domains | SKILL.md:54 | **prompt** |
| Claude Code WebFetch built-in defenses — the above are framed as "defense-in-depth" on top | SKILL.md:56 | **harness/tool** (outside the repo) |
| Body sanitization before vault write: strip `<script>`/`<iframe>`/`<style>`; escape `[[`/`]]` (link-graph injection); reject `---` frontmatter delimiters ("the source page's frontmatter is authored by the loop, not by the upstream source"); truncate ~50KB. Motivation: "Fetched content can contain prompt-style injections, fake wikilinks, or executable code fences" | SKILL.md:58-62 | **prompt** |
| Filename sanitization `safe_name()` (second layer per SKILL.md:68: router sanitizes FILENAME, the hygiene section covers BODY) | SKILL.md:68 → scripts/wiki-mode.py | **script** — the only script-enforced research guard |
| Fetch-budget disclosure (~45 calls, metered through the Anthropic plan) | SKILL.md:64 | **prompt** |
| Loop caps (3 rounds / 15 pages / 5 sources per round) | program.md:34-36; SKILL.md:273-279 | **prompt** (user-editable config read by the model) |
| Confidence scoring + source exclusions | program.md:22-28, :69-75 | **prompt** |
| Fetch-failure logging, never abort, never silently swallow | SKILL.md:66 | **prompt** |
| `allowed-tools:` frontmatter allowlist | SKILL.md:11 | **harness** (Claude Code; other harnesses ignore it, [AGENTS.md L5](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/AGENTS.md#L5)) |
| wiki-lock acquire/release around writes (concurrency, not content safety) | SKILL.md:74-84 → scripts/wiki-lock.sh | **script** |
| Verifier agent: six-cut checklist + data-egress/atomicity/rollback/hygiene checks, read-only, advisory | [agents/verifier.md L55-L114](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/agents/verifier.md#L55-L114) | **subagent** — dev-time pre-commit only; grep confirms **zero wiring to autoresearch** in either direction |
| Auto-commit hook guards (git-repo check, `.vault-meta/auto-commit.disabled` opt-out, defer while locks held) | hooks/hooks.json:33-43 | **hook** — bookkeeping, not content safety |
| Hot-cache load / stale-lock sweep / update reminder | hooks/hooks.json:3-54 | **hook** — context management, no safety role. "No hook performs any URL vetting, content sanitization, or fetch gating." |
| Egress consent flags `--allow-egress`, `--allow-remote-ollama` | PRIVACY.md:25, :28 | **script** (retrieval scripts, not autoresearch) |
| Single-tenant threat model; filesystem permissions are the trust boundary; cross-process lock release allowed by design | SECURITY.md:37-45 | **policy/documentation only** |

Notable gaps and caveats:

- **No "fetched content is data, not instructions" rule exists anywhere** — the injection
  defense is framed entirely as vault-write sanitization, never as an instruction to
  ignore commands embedded in fetched text.
- Consent posture: the `/autoresearch` egress row is at
  [PRIVACY.md L26](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/PRIVACY.md#L26)
  — data sent is "Your research query and fetched URLs", gate "Opt-in; only runs when you
  invoke the research loop."
- Even the hooks are best-effort on their home harness: hooks/README.md:14-22 documents a
  plugin-hook STDOUT bug (anthropics/claude-code#10875) whereby the prompt-type
  SessionStart/PostCompact hooks "may not inject context as expected".

## d. Write-time integration

### Templates and frontmatter contract

- Vault-level templates exist (`_templates/source.md` with Templater `<% tp.* %>`
  placeholders — frontmatter `type: source`, `source_type: article`, `confidence: medium`,
  `key_claims`, `status: seed`, body Summary/Key Claims/Entities Mentioned/Concepts
  Introduced/Notes, [_templates/source.md L1-L39](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/_templates/source.md);
  `_templates/question.md` with `answer_quality: draft`), but autoresearch embeds its own
  synthesis template inline in SKILL.md:183-226 rather than instantiating these.
- The vault-wide frontmatter contract lives in
  [`skills/wiki/references/frontmatter.md`](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/skills/wiki/references/frontmatter.md):
  flat YAML only (:3); eight universal fields on every page (`type, title, created,
  updated, tags, status, related, sources`, :11-25); `type` enum
  `source|entity|concept|domain|comparison|question|overview|meta` (:13); status lifecycle
  `seed → developing → mature → evergreen` (:28-32); type-specific additions (source gets
  `source_type/author/date_published/url/confidence/key_claims`, :42-51); dates as
  `YYYY-MM-DD` strings, lists in `- item` form, wikilinks in YAML quoted, `updated` bumped
  on every content edit (:100-107).
- **The contract is not enforced and the repo drifts from it**: the synthesis page's
  `type: synthesis` (SKILL.md:185) is outside the type enum (frontmatter.md:13); the
  `save` skill adds `status: active` outside the lifecycle vocabulary
  (skills/save/SKILL.md:134-138); `wiki/hot.md`'s own `updated:` uses ISO datetime,
  violating rule 2 (wiki/hot.md:4).

### Index + log + hot currency rules

The currency mechanism is **in-skill instruction text, not hooks** — "After Filing"
(SKILL.md:230-243), in order: (1) update `wiki/index.md`, adding all new pages to the
right sections (:232); (2) append to `wiki/log.md` **at the TOP** with the fixed entry
format `## [YYYY-MM-DD] autoresearch | [Topic]` + `Rounds: N` / `Sources found: N` /
`Pages created: [[…]]` / `Synthesis: [[Research: Topic]]` / `Key finding: [one sentence]`
(:233-241); (3) update `wiki/hot.md` with the research summary (:242). `wiki/log.md`
declares itself "Append-only. New entries go at the TOP. Never edit past entries."
(wiki/log.md:20-24) — but contains a malformed headerless entry region
(wiki/log.md:210-212), proving the format is convention, not enforcement. Fetch failures
and lock-contention skips are also log.md writes (SKILL.md:66, :82). "Atomicity" of
index+log+hot+frontmatter updates is stated discipline, not a mechanism ("all update
together — atomicity matters", skills/save/SKILL.md:183). `wiki/hot.md` is a
reverse-chronological session-state cache for post-compaction/next-session resumption
(wiki/hot.md:17-49), whose payoff depends on the SessionStart/PostCompact hooks (§c).

### Locking

Per-file advisory locks via
[`scripts/wiki-lock.sh`](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/scripts/wiki-lock.sh),
built for "safe multi-writer vault mutation" after a v1.6 bug where "two parallel
sub-agents writing to the same wiki page could silently trample each other"
(scripts/wiki-lock.sh:2-5). Mechanics: atomic lockfile creation with `set -o noclobber` +
epoch-age staleness (PID informational only; "The acquire decision considers AGE only",
:14-19); lockfiles at `.vault-meta/locks/<sha1(path)>.lock` (:28); `acquire` returns 75
(EX_TEMPFAIL) on contention and auto-reaps locks older than `STALE_AFTER_SEC` default 60s;
`release` is `rm -f`, unconditional, cross-process "by design" (:32-38); admin
`clear-stale` default 3600s — two deliberately distinct thresholds, "Do not unify the
defaults" (:52-61); path validation rejects absolute paths, `..`, control characters, and
symlink escapes (:110-139); mutating commands serialize under a real `flock` on a meta
lock (:150-159). Autoresearch wiring: "Every wiki page write MUST be preceded by
`wiki-lock acquire <path>`" with one retry after `sleep 2` (SKILL.md:74-80); losing a
race skips the page for the pass and logs it (:82). The PostToolUse auto-commit hook
defers `git add` while locks are held (hooks/hooks.json:39; CLAUDE.md:71).

### Transport

All writes go through a transport selected via `.vault-meta/transport.json` (auto-created
by `scripts/detect-transport.sh`, refreshed weekly — `STALE_AFTER_DAYS=7`,
scripts/detect-transport.sh:34): `cli` (obsidian-cli) → MCP write_note → `filesystem`
(the Write tool) as "ultimate floor" (scripts/detect-transport.sh:6-10; SKILL.md:22-30).
"Web fetches (`WebFetch`/`WebSearch`) are transport-agnostic." (SKILL.md:30).

## e. Harness-dependency inventory

| Dependency | Classification |
|---|---|
| SKILL.md body: loop, caps, filing schema, synthesis template, egress hygiene, report format | **(a) pure-markdown prompt content — fully portable** |
| program.md (all objectives/caps) | (a) pure-markdown |
| Cross-linked docs: `skills/wiki-cli/SKILL.md` (SKILL.md:26), `wiki/references/transport-fallback.md` (:30), `skills/wiki-ingest/SKILL.md` §Concurrency (:84), `skills/think/SKILL.md` (:285), `DragonScale Memory.md` (:102) | (a) markdown, but **dangling in a two-file copy** |
| `allowed-tools` frontmatter | (b) Claude-Code-specific; the repo's own newer convention forbids it — "Skills use only `name` and `description` in frontmatter" ([.github/copilot-instructions.md L31](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/.github/copilot-instructions.md#L31)); autoresearch's own list **omits Bash while the body demands bash calls** (SKILL.md:11 vs :36, :77-80, :108-114) |
| `commands/autoresearch.md`, `.claude-plugin/*` | (b) Claude Code packaging |
| `hooks/hooks.json` (SessionStart hot-cache + stale-lock sweep, PostCompact re-read, PostToolUse auto-commit, Stop reminder) | (b) Claude Code runtime; none autoresearch-specific; best-effort even natively (STDOUT bug) |
| MCP write transport (`mcp__obsidian-vault__write_note`) | (b) optional, never auto-detected (detection deferred, scripts/detect-transport.sh:198-207) |
| WebSearch/WebFetch | harness-provided; safety backstop assumed Claude-Code-grade (SKILL.md:56) |
| `scripts/detect-transport.sh`, `scripts/wiki-lock.sh` | (c) bash (+flock, sha1, python3 helpers) |
| `scripts/wiki-mode.py` (valid types at [scripts/wiki-mode.py L44](https://github.com/AgriciDaniel/claude-obsidian/blob/cb93ff6d82f9c35a08bf6010e7fac36dfddc827b/scripts/wiki-mode.py#L44)), `scripts/boundary-score.py` | (c) python3 stdlib |
| `obsidian-cli` | (c) external binary, optional |
| Subagents | **none** — the loop never dispatches Task/agents; `agents/verifier.md` is unwired to autoresearch |

Multi-harness support is symlink-based (`bin/setup-multi-agent.sh:64-77` links `skills/`
into `~/.codex/skills/`, `~/.opencode/skills/`, etc.; AGENTS.md:12-17), with the skill
inventory re-stated five times across per-harness instruction files with drifting counts
(harness-deps audit). Tests (`Makefile:13-18`: test-boundary "python, no prereqs";
test-lock/test-concurrent "shell, hermetic"; test-mode "python, hermetic") exercise only
the shell/python helpers, never the prompt flow.

**What degrades on a bare harness given only SKILL.md + program.md** (web search
available, no hooks/scripts/subagents):

- *Graceful by design* — absence is the fallback trigger: boundary-first gates fail →
  ask-the-user path; explicit-topic path unaffected (SKILL.md:108-130).
- *Silent losses*: `safe_name()` filename sanitization (delegated to the router,
  SKILL.md:68 — topic-derived path traversal becomes unmitigated); mode routing
  (generic paths survive in prose, SKILL.md:39-43); all locking (the MUST-lock protocol
  dead-ends); transport selection (filesystem floor must be inferred); auto-commit (pages
  land uncommitted); vault-existence guard (lives only in commands/autoresearch.md:15);
  five dangling cross-references; the WebFetch built-in-defense backstop (prompt guards
  become the only layer).

Net: the search→synthesize→file loop with all caps and the synthesis schema is fully
portable prompt content; everything that degrades does so **silently** — the single
biggest lesson for the OKF port.

## f. Adopt / adapt / drop for OKF bundles — spec input for ticket #39

One structural fact makes the OKF port easier than the wiki original: OKF's "point at,
never copy" rule (`docs/conventions/documentation.md` §Code in concepts) forbids verbatim
fetched bodies in concepts, and a `Reference` is "summary + `# Citations`" by convention —
so the 10-30-page, 50KB-body, wikilink-injection problem space shrinks by construction.

### Disposition table

| Component | Verdict | Notes |
|---|---|---|
| Topic path A (explicit, verbatim) + path C (ask) | **Adopt as-is** | zero dependencies |
| Topic path B (boundary scorer) | **Adapt** | drop the python scorer (wikilink-graph substrate doesn't exist in OKF); replace the signal with an OKF-native frontier: Grep prior research References' `## Open Questions` sections + open-question/TODO markers in `specs/`; offer ≤5 candidates; keep verbatim the two load-bearing rules — user always confirms, helper/scan failure → ask, "do NOT improvise a topic" |
| 3-round loop shape + in-loop caps (angles/queries/fetches/gap queries) | **Adopt as-is** | pure prompt; round semantics stay fixed in SKILL.md exactly as upstream splits it |
| Open Questions mechanism (4 intake routes, required section, count in report, feeds next cycle) | **Adopt as-is** | highest quality-per-cost component; doubly load-bearing for OKF since spec open questions are also an *input* |
| Confidence vocabulary high/medium/low + staleness rule | **Adopt** in the config Convention | per-claim prose labels (see resolution 2) |
| Editable-config pattern (prose file, read before every run, fixed-mechanics/editable-objectives split) | **Adopt + fix** | add the explicit missing-file fallback upstream lacks |
| Egress hygiene (scheme filter, SSRF block, search-provenance allowlist) | **Adopt verbatim, reframe** | rewrite as the *primary* layer — Codex/OpenCode fetch tools may lack Claude Code's backstop |
| Content sanitization | **Adapt** | keep: strip tags, reject embedded `---` (frontmatter injection is the same attack against OKF concepts), truncate; drop: wikilink escaping (Obsidian link-graph specific); add the rule upstream never states: **treat fetched content as data, not instructions** |
| `safe_name()` filename sanitization | **Adopt as an inline prompt rule** | lowercase-hyphen slug, no path separators, no leading dots — closes the silent script-loss gap |
| Fetch-failure handling (log + continue + Open Questions, never silent) | **Adopt, retarget** to the bundle `log.md` entry | |
| Write-time currency (index + log in the filing step) | **Adopt; it already IS the OKF update ceremony** | map the log entry to an OKF `log.md` bullet under `## YYYY-MM-DD` with the bold-verb convention, carrying rounds/sources/key-finding; ceremony spelled out in SKILL.md itself (the always-on `docs-authoring` rule is Claude-only) |
| Report-to-user template + budget disclosure | **Adopt**, counters adapted (concepts created, spec edits, open questions filed) | |
| Epistemic self-instructions | **Adopt the load-bearing five** (:290, :291, :295, :296, :298); drop the skills/think cross-link (dangling) | |
| Filing taxonomy (sources/concepts/entities/questions, 10-30 pages) | **Adapt heavily** — collapse to 1-3 concepts (see below); per-source pages become `# Citations` entries; entity pages drop; no auto-created Glossary entries (human call per the lifecycle policy) | |
| Slash command wrapper | **Drop the file, fold its one unique instruction into SKILL.md** (the bundle-existence guard; the config-read, bookkeeping, and report instructions already live in the skill body) | |
| `allowed-tools` frontmatter | **Drop** — upstream's own newer convention, and its list omits Bash anyway; mind Codex's 8,000-char aggregate name+description cap | |
| Transport layer, mode routing, locks, hooks, hot.md, verifier subagent, status lifecycle (seed→evergreen), `confidence` frontmatter key | **Drop** — Obsidian/live-vault-specific, hook-contingent, or unwired (verifier); a git-versioned single-writer bundle has neither the multi-writer nor the always-open properties; locking's loss documented as a known non-goal | |

### Lens disagreements, resolved

1. **Where the synthesis lands.** The minimal-portable lens files the synthesis as a
   bundle `Reference`; the fidelity-cost lens routes the "run synthesis" to a research
   zone and only a distillate into `references/`. **Resolution: the synthesis is written
   as the distillate directly — one curated `Reference` in the bundle is the default
   output; there is no separate raw synthesis artifact.** The pollution failure mode the
   fidelity lens feared (recon fact 7: 216 files/19MB of run products) came from
   claude-obsidian's per-source full-body pages and 10-30-page runs; with sources reduced
   to citation lines by OKF's point-don't-copy rule and filing capped at 3 concepts, a
   synthesis-as-Reference is curation, not pollution. Pre-work reconnaissance is the
   exception: it is not-yet-curated by definition and lands in the repo-root `research/`
   zone (this repo's live precedent), outside the bundle — no frontmatter, no ceremony,
   freely deletable.
2. **Confidence as a frontmatter key.** Fidelity-cost proposed a `confidence:` extension
   key (spec-safe under OKF's preserve-unknown-keys rule); minimal-portable preferred
   per-claim prose. **Resolution: per-claim prose labels only, no page-level key.** A
   single page-level label flattens exactly the per-claim distinctions program.md:24-26
   defines, and claude-obsidian's own vocabulary drift (`type: synthesis` outside its
   enum, `status: active` outside its lifecycle) is the cautionary tale for importing
   closed vocabularies without a consumer. This also matches the stay-minimal answer to
   recon open question 7.

All other points the lenses agree on and are adopted as stated.

### The #39 spec shape

- **Inputs (what it researches).** Three topic paths: explicit topic (verbatim); OKF
  frontier offer (open questions in `specs/` + prior References' `## Open Questions`,
  ≤5 candidates, user-confirmed, never auto-selected, never improvised); ask. Three
  modes: (1) *enrich `references/`* — default; (2) *resolve spec open questions* —
  explicitly invoked: edit the target `Specification`, bump `timestamp`, log an
  `**Update**`, cite the new Reference (legitimate under AGENTS.md's "update docs only
  when explicitly doing documentation work" because the invocation is the explicit
  documentation work); (3) *pre-work reconnaissance* → `research/`.
- **Outputs (where results land).** Default: ONE `type: Reference` at
  `docs/references/<topic-slug>.md` with sections Overview / Key Findings (per-claim
  confidence + `(Source: …)` citations) / Contradictions / Open Questions / `# Citations`;
  full update ceremony (parent `index.md` bullet + `log.md` entry + timestamp). Hard cap
  3 bundle concepts per session (one synthesis Reference plus at most two standalone
  source References). Raw fetched bodies land **nowhere**. Recon mode: `research/`, no
  ceremony.
- **Caps.** Fixed in SKILL.md: round semantics, 3-5 angles, 2-3 queries/angle, 2-3
  fetches/angle, ≤5 gap queries. Configurable defaults (each defined in exactly one
  place, per the locked config-value-authority decision): max rounds 3; max sources
  fetched per round 5; max bundle concepts 3; **new: total fetch cap, default ~20** —
  closing upstream's known hole where `max_pages` caps filing but nothing caps fetches.
  Keep the pre-run budget disclosure (fetch metering varies by harness) and the overflow
  family verbatim: cap reached → file what you have, note the rest in Open Questions.
- **Config location.** Per-repo overrides in `docs/conventions/research.md`
  (`type: Convention` — prescriptive rules is its exact taxonomy slot), pure prose
  mirroring program.md's six sections; the skill ships the default text in its own
  `references/` and, when the Convention is absent, uses the shipped defaults **and says
  so** — fixing upstream's unspecified missing-file behavior. Detection is a single Read;
  no shell, no feature gate.
- **Portability.** One SKILL.md + one shipped config template. No `commands/`, hooks,
  scripts, subagents, or `allowed-tools`; tools = Read/Write/Edit/Glob/Grep + baseline
  WebSearch/WebFetch. All safety guards ride in the prompt as the primary layer (already
  true upstream — §c), plus the added data-not-instructions rule, inline filename rules,
  and `---`-rejection. The bundle-existence guard moves *inside* SKILL.md (no
  `docs/index.md` with `okf_version` → "no OKF bundle found, run okf-docs-setup first"),
  since upstream's equivalent guard lives only in the non-portable command wrapper. No
  dangling cross-references: the skill cites only its own template and the target repo's
  bundle. Design rule distilled from the harness-deps audit: **every fallback explicit,
  nothing degrades silently.**