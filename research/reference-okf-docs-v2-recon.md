# OKF docs skill-suite v2 — recon brief

> Charting input for the wayfinder map "OKF docs skill-suite v2". Produced 2026-07-20 by an 11-agent recon workflow over: Google OKF spec + blog, claude-obsidian, OpenWiki 0.2 blog, Medium OKF explainer, mattpocock obsidian-vault skill, obra/superpowers, harness docs (Claude Code / Codex / OpenCode), this repo, and ws-2026-fantasy-team/docs.

## Source summaries

- **okf-spec** (GoogleCloudPlatform/knowledge-catalog, okf/SPEC.md): OKF v0.1 (Draft) is the only published version — markdown + YAML frontmatter bundles where `type` is the sole required field, `index.md`/`log.md` are the only reserved filenames, types are unregistered strings, and consumers MUST tolerate unknown keys, broken links, and missing optional fields. Ships a Python BigQuery enrichment agent and a self-contained HTML graph visualizer; no official validator CLI.
- **okf-blog** (Google Cloud blog): Positions OKF as "format, not platform" — three principles (minimally opinionated, producer/consumer independence, no lock-in), six canonical frontmatter fields (type, title, description, resource, tags, timestamp), relationships as plain markdown links, dual human/agent audience with no translation layer.
- **claude-obsidian** (AgriciDaniel/claude-obsidian, ~9.7k stars): AI-maintained Obsidian wiki with 15 skills. Key patterns: bounded autoresearch loop (SKILL.md fixed mechanics + user-editable references/program.md config), layered read hierarchy (hot.md cache → index → sub-index → page), write-time currency (every page write updates index + log atomically), status lifecycle frontmatter (seed→evergreen), web-fetch safety guardrails, advisory file locks for concurrent agents.
- **openwiki** (LangChain blog, OpenWiki 0.2): npm CLI emitting OKF-conformant wikis; index.md blurbs derived from child files' `description` frontmatter; changelog named `logs.md` (plural — diverges from this repo's `log.md`); AGENTS.md/CLAUDE.md as the agent entry point is the emerging ecosystem convention.
- **okf-medium** (Tahir Balarabe explainer): Mostly derivative of the spec; confirms root-relative link convention and the producer/consumer framing; flags the "too simple to work" misconception. Low authority, thin additive value.
- **obsidian-vault-skill** (mattpocock/skills): Minimal counter-example — one SKILL.md, grep/find as the entire query layer, index notes as pure link lists, related-links-at-bottom convention, plus a portability anti-pattern (hardcoded absolute vault path) and an agents/openai.yaml cross-harness metadata stub.
- **superpowers-sdd** (obra/superpowers): Mandatory SDD flow brainstorm→plan→execute→review→finish with no skip path; writes dated spec/plan files to docs/superpowers/{specs,plans}/ that are never folded back into durable knowledge; brainstorming hard-gates the next skill, so docs integration must attach inside its phases or at finishing-a-development-branch, not between them.
- **harness-parity** (Claude Code / Codex CLI / OpenCode official docs): All three natively read SKILL.md skills (agentskills.io convergence); AGENTS.md is the only universally discovered instruction file; @imports don't expand in Codex/OpenCode; Codex caps aggregate skill name+description index at 8,000 chars; subagent definitions and hooks are NOT portable — shell commands (npm scripts, CI) are the portable enforcement point.
- **local-skills-repo** (this repo): okf-docs-setup is a meta-installer copying byte-exact assets/ (validator, docs skeleton, 2 rules, nested docs-add/docs-validate skills) with exactly four substitution classes; nested skills are invisible to the library installer by design; validator is 266 lines, advisory, always exits 0; known drifts: SKILL.md "one benign warning" vs validator.md "zero warnings", `docs:validate:test` glob mismatch, `specifications/` vs `specs/` in Phase 4 snippet.
- **fantasy-team-usage** (ws-2026-fantasy-team/docs): Month-old live bundle, 262 files, exposing the real churn patterns — ~10 dated amendments stacked on one Convention where only latest state matters; 9 iterative design specs for the same feature in 3 weeks; 216-file/19MB generated report archive inside the bundle with duplicate re-runs; deliberate code↔doc constant duplication (KELLY_FRACTION etc., currently in sync only by discipline); index drift (orphaned concept); log entries bloated to 100+ word narratives. Tiny Decisions, one-term glossary files, and defer-numbers Reference docs survived unchanged.

## Cross-cutting facts

1. **OKF v0.1 is the latest spec; validators must be lenient.** Only `type` is hard-required; consumers MUST NOT reject for missing optional fields, unknown types, or broken links (okf-spec, okf-blog, okf-medium). The current advisory always-exit-0 validator is exactly right; the five-type taxonomy is a house convention layered on OKF, not spec (okf-spec, local-skills-repo).
2. **AGENTS.md inline prose is the only portable wiring.** Codex reads AGENTS.md natively, OpenCode prefers it, Claude Code reaches it via CLAUDE.md→@AGENTS.md; @imports do not expand outside Claude Code (harness-parity). The wiring block propagates verbatim into target repos, so it must be right at the source (fantasy-team-usage).
3. **SKILL.md skills are portable across all three harnesses; hooks and subagent definitions are not.** Portable enforcement = shell commands (`npm run docs:validate`) wired into CI, not harness hooks (harness-parity). Phase 2's dependency on /superpowers:dispatching-parallel-agents is a Claude-only coupling (local-skills-repo, harness-parity).
4. **Codex constraint: 8,000-char aggregate cap on skill name+description index** — a large suite needs tight descriptions (harness-parity).
5. **The dominant real-world churn is amendment stacking and spec-iteration, not initial authoring.** ~10 amendments on one Convention with in-place body edits leaving parenthetical residue; 9 design specs for one feature; superpowers never folds plans/specs back into durable docs (fantasy-team-usage, superpowers-sdd).
6. **Code↔doc constant duplication breaks the "reference, don't copy" rule in practice** despite doc-to-doc referencing working; both sides restate KELLY_FRACTION, TIER_CAPS, MODEL_FLOOR, shrink anchors; code back-reference comments (`# betting-policy.md: …`) are the existing good pattern (fantasy-team-usage).
7. **Generated artifacts pollute the bundle**: 216 files/19MB of run reports + JSON sidecars + duplicate re-runs + hand-maintained 45-entry index; docs/superpowers/** exclusion is the existing precedent for a carve-out (fantasy-team-usage).
8. **Write-time currency beats review-time**: index.md + log.md updates as part of the atomic page write, plus periodic lint for orphans, is the proven maintenance model (claude-obsidian); index drift happened anyway in a disciplined project (fantasy-team-usage) so the validator needs an orphan check.
9. **The autoresearch pattern is well-established**: bounded rounds/pages/sources hardcoded in SKILL.md, source-quality hierarchy and domain prefs in an editable references file, confidence labels, Open Questions section, URL/content safety guardrails (claude-obsidian).
10. **The byte-exact assets contract is fragile by construction**: four substitution classes across ~6 files, three coupled governance docs, duplicate validator copies enforced only by a manual diff step; plus three known text drifts to fix (SKILL.md warning-count claim, test-glob quote, `specifications/` vs `specs/`) (local-skills-repo).
11. **Ecosystem naming collision**: OpenWiki emits `logs.md`, spec and this repo use `log.md` — spec says `log.md`, so this repo is conformant, but interop tools may vary (openwiki, okf-spec).
12. **Layout patterns proven durable**: tiny Decision files, one-term glossary files, index.md as thin link lists, defer-numbers Reference docs, root-relative `/a/b.md` links (fantasy-team-usage, okf-spec, obsidian-vault-skill).

## Open questions the human must decide

1. **Distribution model**: should docs-add/docs-validate stay nested payloads inside okf-docs-setup's assets (installed only into target repos), or be promoted to top-level library skills usable everywhere — changing installer discovery, README inventory, and the byte-exact contract?
2. **Harness scope**: is Claude Code the primary target with Codex/OpenCode as best-effort, or full first-class parity (which forbids the /superpowers:dispatching-parallel-agents dependency and Claude-only rules/hooks)?
3. **Superpowers coupling**: fork/wrap superpowers phases to redirect spec output into docs/, add a docs step only at finishing-a-development-branch, or keep okf-docs fully independent of any SDD workflow?
4. **Code-as-source-of-truth direction**: when code and docs both state a config value, which is the declared authority — and is a constant-sync validator check (grep constants against code) worth the false-positive risk?
5. **Compaction policy**: is folding amendments into a Decision/Convention body acceptable, given the current convention says Decisions are "amended under dated headings, never rewritten"? Where does the history go (log.md one-liners, git, nothing)?
6. **Autoresearch appetite and shape**: is a research skill in scope for v1, and does it write into the OKF bundle (references/) or a separate research zone? What are acceptable fetch-cost caps?
7. **Frontmatter extensions**: adopt a status lifecycle (seed/developing/mature/evergreen à la claude-obsidian) and/or hot.md-style entry cache, or stay minimal per OKF's spirit?
8. **Generated-artifact zone**: should the setup skill scaffold a canonical excluded "runs/archive" area, and how aggressive should the validator be about large/duplicate generated files?
9. **Canonical section names**: `specs/` or `specifications/` (installs already diverge) — pick one and migrate?
10. **PR-time enforcement strictness**: stay purely advisory everywhere, or allow an opt-in CI mode that fails on hard ERRORS (spec permits producer-side strictness even though consumers must be lenient)?
11. **Validator duplication**: enforce assets↔installed copy identity via a test/CI diff, or restructure so there is one physical file?

## Suggested decision areas for tickets

**Architecture & distribution**
- A1: Promote docs-add/docs-validate to top-level skills or keep them as nested setup payloads?
- A2: What is the harness-portability contract (skill dirs, frontmatter LCD, no hooks/subagent deps, 8k-char description budget)?
- A3: Split okf-docs-setup into machinery-install vs content-conversion phases, and how does parallel fan-out work without superpowers?
- A4: How is the byte-exact assets contract enforced mechanically (CI diff of validator copies, manifest sync test)?

**Spec conformance & conventions**
- B1: Which frontmatter schema does the suite scaffold and warn on (six canonical fields + which extension keys)?
- B2: Standardize section naming (`specs/` vs `specifications/`) and the migration path for existing installs?
- B3: Which upstream conventions to adopt or explicitly diverge from (`# Schema`/`# Examples`/`# Citations` sections, references/<slug>, index blurbs derived from child descriptions)?
- B4: Define the generated-artifacts exclusion zone and its validator treatment?

**Doc maintenance during dev flows**
- C1: What is the amendment-compaction skill/flow, and what supersession trail does it leave?
- C2: How does the suite detect and handle spec-iteration ("iteration N of feature X → update in place vs new dated file")?
- C3: Where do dev-flow docs hooks attach (superpowers phases, finishing choke point, always-on rules) per harness?
- C4: What is the log.md verbosity convention (entry length cap, per-subsystem logs, Creation/Update/Amendment verbs)?

**Validation**
- D1: Which new soft warnings ship (orphaned concepts, amendment-stack weight, duplicate-slug reports, non-root index frontmatter, missing tags/description)?
- D2: Is a code↔doc constant-sync check feasible, and what citation syntax does it key on?
- D3: What does PR-time validation look like portably (CI workflow template vs harness hooks), and is a strict mode offered?
- D4: Fix the three known text drifts (warning-count claim, test glob quote, specs/ snippet) — one cleanup ticket?

**Research & discovery**
- E1: Does an okf-autoresearch skill ship in v1, and with what caps, config split, and safety guardrails?
- E2: Should a hot.md-style cheap entry cache and codified read hierarchy be added to the bundle contract?
- E3: Is a no-backend visualizer (docs-view) in scope, or deferred to upstream/community tooling?
