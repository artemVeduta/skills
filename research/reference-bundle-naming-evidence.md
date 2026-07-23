# Bundle naming evidence — docs/ vs wiki/, specs/ vs specifications/

> Evidence for wayfinder ticket [#30](https://github.com/artemVeduta/skills/issues/30), map "OKF docs skill-suite v2". Produced 2026-07-20 by a 3-agent survey workflow: this repo's rename blast radius, the live `ws-2026-fantasy-team` bundle's migration cost, and ecosystem conventions (web).

## This repo — rename blast radius

- Bundle-root `docs/` is **purely literal** everywhere except one spot: the validator takes the root as `argv[2]` with hardcoded default `'docs'` (`scripts/validate-docs.mjs:258`, byte-identical in assets). No substitution placeholder covers the bundle root — the skill's substitution classes are exactly `<PROJECT>`, `<YYYY-MM-DD>`, `<source-edit-path-glob>`, and the pm rewrite of `pnpm docs:validate`.
- A docs/→wiki/ rename would touch: 57 literal occurrences in `skills/okf-docs-setup/` (26 library-only in SKILL.md + 31 inside byte-exact `assets/` across 6 files, incl. the docs-authoring rule's trigger glob `docs/**/*.md`), 19 mirrored occurrences in this repo's installed `.claude/` copies, 3 in AGENTS.md, 5 assertion paths in `tools/tests/okf-docs-setup/case.mjs`, 1 entry in `tools/test-runner.mjs` GUARDED_DIRS.
- The repo's own bundle is rename-safe internally: all 174 internal links are bundle-root-relative (`](/specs/...` form), zero `/docs/...` links. 46 prose mentions of `docs/` inside the bundle would want cleanup but nothing breaks mechanically.
- `package.json` has zero path literals — `docs:validate` passes no root arg, leaning on the validator's `'docs'` default.
- **specs/ vs specifications/ drift is exactly one operative line**: `skills/okf-docs-setup/SKILL.md:158` (Phase 4 wiring snippet) says `specifications/`; everything else says `specs/` — root `AGENTS.md:18` (the snippet's installed twin), `documentation.md:73` path convention (asset + installed copies), the live dirs `docs/specs/` and `docs/okf-docs-setup/specs/`, ~50 `specs/` occurrences bundle-wide.
- Superpowers SDD: upstream obra/superpowers hardcodes `docs/superpowers/plans/` and `docs/superpowers/specs/` (confirmed in installed 5.1.0 and 6.1.1 caches — `writing-plans` and `brainstorming` SKILL.md). Its ephemeral SDD state already lives outside the bundle in a fully gitignored `.superpowers/sdd/`.
- The OKF spec itself never hardcodes `docs/` — the root name is an installation convention, not an OKF requirement.

## Live bundle (ws-2026-fantasy-team) — migration cost

- Markdown-link syntax is nearly rename-safe by design: exactly **1** link embeds the docs path; the bundle's 91 cross-links are bundle-root-relative.
- The real cost is plain-path mentions: **~830 literal `docs/` occurrences across ~150 files** — 545 inside `docs/` itself (archived prediction reports citing `docs/conventions/betting-policy.md`, self-referential `--report-path` CLI transcripts), 62 lines of agent wiring outside docs/ (7 SKILL.md files, `.claude/rules`, AGENTS.md, templates), 48 Python lines incl. one functional constant (`REPORTS_DIR = Path("docs/predictions/reports")`) and a drift test asserting the policy path verbatim, and **168 persisted `report_path` values in live state stores** (`state/bets.json`, `state/prediction-calibration.json`) that validation code cross-checks — a rename needs a state-data migration, not just text edits.
- Rule-glob trap: `.claude/rules/docs-authoring.md` is path-scoped `docs/**/*.md` — after a rename the rule silently stops attaching.
- No CI, no husky — zero workflow migration cost.
- Section name: the live layout is `specifications/` (`docs/predictions/specifications/`, AGENTS.md, log links) while its own convention doc says `specs/` — the Phase 4 snippet drift propagated into a real install.
- `docs/` is demonstrably a mixed namespace there: 216 of 262 files are a generated per-match report archive (incl. 93 machine JSON artifacts up to ~628 KB), plus 23 superpowers SDD files; only ~25 files are actual OKF knowledge concepts.

## Ecosystem conventions

- **OKF spec mandates no bundle root name.** "The directory structure is independent of the domain"; a bundle MAY be "a subdirectory within a larger repository". Reserved filenames are only `index.md`/`log.md`. Examples use domain-named roots (`ga4/`, `stackoverflow/`) and the placeholder `my_bundle/`. ([SPEC.md](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md))
- Three root-naming camps in practice: tool-branded (`openwiki/` — hardcoded `OPEN_WIKI_DIR` in [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki); `okf/` in claude-okf), generic (`wiki/` in [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian); `knowledge/` per the okf.md guide), and user-chosen (openknowledge CLI takes the root as an argument).
- **`specs/` is the universal short form** — github/spec-kit `specs/`, AWS Kiro `.kiro/specs/`, OpenSpec `openspec/specs/`, openknowledge seeds a `specs/` category. Nothing observed uses `specifications/`. (Convention of spec-driven-dev tooling; OKF reserves nothing here.)
- Tooling semantics of `docs/`: one of GitHub Pages' exactly two publishing-source options (root or `/docs`), and MkDocs' `docs_dir` default — an affordance if publishing is wanted, a collision if the dir must stay agent-only.
- Tooling semantics of `wiki/`: none — GitHub Wikis live in a separate `<repo>.wiki.git`; the only risk is human ambiguity between the directory and the Wiki feature.
