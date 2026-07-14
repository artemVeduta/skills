# Bundle change log

## 2026-07-14

- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  reconciled the #24 test-runner tracer bullet — advisory-signal recording
  (Decision 2) deferred, and the disposable fixture (Decision 1) built outside
  the repo under `os.tmpdir()` for discovery isolation with the immutability
  proof widened to `docs/`/`scripts/`/`.claude/`.

## 2026-07-11

- **Creation** of [Native aggregate plugins & release script](/specs/native-plugins-and-release.md)
  — implemented issue #21: Codex + Claude Code plugin/marketplace manifests, the
  `scripts/release.mjs` snapshot-release ritual, and the README native-channel
  instructions; resolves the platform PRD's release-script and `scripts/`↔`tools/`
  implementer-owned gaps.
- **Update** — rewrote [Skills library & building platform — PRD](/specs/skills-platform.md)

- **Update** — rewrote [Skills library & building platform — PRD](/specs/skills-platform.md)
  from the locked-spec format into the to-spec PRD template (problem/solution, user
  stories, per-area implementation decisions, testing seams, out-of-scope,
  implementer-owned notes); all normative Decision content preserved, no decisions
  reopened.
- **Update** — rewrote [install.sh — development-links install wizard](/specs/install-sh.md)
  from the current-script contract into the forward-looking PRD for the issue #16
  rebuild (registry-driven wizard, harness profiles, dependency-graph validation,
  whole-library symlinking), resolving the platform spec's precedence note.
- **Creation** of [Skills library & building platform — locked specification](/specs/skills-platform.md)
  — assembled the destination artifact of wayfinder map #1 from the eight governing
  Decisions: repository structure, three distribution channels, skill dependencies,
  authoring conventions, versioning/releases, testing/benchmark harness, and CI wiring,
  plus the implementer-owned gaps (wayfinder ticket #8; closes the map).
- **Creation** of [CI and automation wiring](/decisions/ci-and-automation-wiring.md)
  — decided static-only push/PR CI red on linter ERRORs, keeping all inference-bearing
  runs (skill cases, contract tests, benchmarks) local with no API keys or scheduled
  workflows, and an advisory staleness warning in the release script (wayfinder
  ticket #13).
- **Creation** of [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md)
  — decided smoke/full trial presets, the advisory ≥2-of-5-trial regression flag,
  committed summary JSON with git-ignored raw artifacts, release-promoted baselines,
  the identity-set provenance schema, and per-case no-blend reporting (wayfinder
  ticket #12).
- **Creation** of [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — decided the trimmed repo-owned test harness in tools/ (fixture builder + headless
  harness CLIs, Promptfoo/Harbor deferred), deterministic-first grading with advisory
  LLM judge, central tools/tests/<skill>/ case directories, and paired-trial benchmarks
  across harnesses, snapshots, and models with provenance (wayfinder ticket #5).
- **Creation** of [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md)
  — GitHub releases as semver-shaped snapshot tags with no compatibility contract,
  plugin manifest versions mirroring the tag, and a scripts/ release script owning the
  bump-commit-tag-release ritual; dev-symlink and npx channels keep tracking git.
- **Creation** of [Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md)
  — layered trigger-only descriptions, a minimal section skeleton with canonical
  optional headings, the invocation-axis frontmatter allowlist, role-named support
  subdirs, soft-200/hard-500 disclosure, and an advisory two-tier linter on top of the
  portable Agent Skills floor.
- **Creation** of [obra/superpowers skill library](/references/obra-superpowers.md)
  — recorded the example-reference project and the authoring/portability ideas this
  library borrows from it (trigger-only descriptions, actions-not-tools, strength-marked
  cross-references, baseline-fail testing).
- **Creation** of [mattpocock/skills skill library](/references/mattpocock-skills.md)
  — recorded the inspiration-baseline project and the ideas borrowed from it (minimal
  frontmatter, invocation axis, sibling-file progressive disclosure, meta-skill quality
  bar) plus the conscious divergences.

## 2026-07-10

- **Creation** of [Agent skill testing and benchmarking landscape](/references/agent-skill-testing-landscape.md)
  — surveyed deterministic validation, headless OpenCode/Codex/Claude runs, Promptfoo,
  Harbor, Anthropic evaluation workflows, and skills.sh signals to inform the
  testing-architecture decision.
- **Creation** of [Organize the library around flat, skill-owned directories](/decisions/skill-library-structure.md)
  — recorded the flat skill tree, tooling boundaries, skill-owned assets, README
  synchronization rule, and amended home for skill-specific contracts.
- **Creation** of [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md)
  — standardized cross-skill declarations, invocation, validation, and installation
  behavior.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — standardized separate
  machine-readable `## Required skills` and explanatory `## Integration` sections.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — separated plain
  canonical names in `## Required skills` from slash-prefixed runtime invocation syntax.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — replaced the proposed
  metadata declaration with a mandatory `## Required skills` section and canonical
  `/skill-name` entries.
- **Update** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
  — amended development installation to link the whole library and recorded the portable
  dependency-resolution constraint.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — chose namespaced
  `SKILL.md` metadata, canonical-name runtime references, safe default closure, and an
  explicit bypass.
- **Update** of [Skill dependency](/glossary/skill-dependency.md) — made transitive
  dependency closure mandatory and missing dependencies or cycles installation errors.
- **Creation** of [Skill dependency](/glossary/skill-dependency.md) — defined required
  runtime relationships between skills.
- **Update** of [/glossary/harness.md](/glossary/harness.md) — distinguished a harness
  product from independently configured harness profiles and recorded the
  `CLAUDE_CONFIG_DIR` and `CODEX_HOME` isolation boundaries.
- **Creation** of [Use three skill distribution channels](/decisions/skill-distribution-channels.md)
  — separated development symlinks, portable pure-skill installation, and native
  aggregate plugins; defined profile exclusivity and the registry-driven flow for
  adding harnesses. Adds the reserved [/decisions/index.md](/decisions/index.md).
- **Creation** of [/glossary/harness.md](/glossary/harness.md) — the term "harness":
  the agent runtime a skill is installed into, with today's supported install
  targets.
- **Creation** of [/glossary/skill.md](/glossary/skill.md) — the term "skill": a
  directory-rooted capability bundle defined by a root `SKILL.md`, the unit this
  library stores and distributes.
- **Creation** of [/specs/install-sh.md](/specs/install-sh.md) — contract of
  `scripts/install.sh`: SKILL.md discovery (and the current `skills/<name>/` layout
  mismatch, pending issue #4), the default harness targets (`~/.agents/skills`,
  `~/.claude/skills`, `~/.claude-work/skills`), symlink-not-copy mechanics, re-run
  safety, and exit semantics. Adds the reserved `/specs/index.md`.
- **Creation** of [/okf-docs-setup/specs/install-contract.md](/okf-docs-setup/specs/install-contract.md)
  — the okf-docs-setup install contract: what an install delivers (docs bundle, validator
  scripts, `.claude` rules and helper skills, package.json scripts), the per-install
  substitutions, the `claude/` → `.claude/` rename, the machinery-vs-content phase
  structure, and the zero-hard-errors done criteria.
- **Creation** Added the `okf-docs-setup` subsystem index node (`/okf-docs-setup/index.md`)
  covering the skill that bootstraps OKF v0.1 docs bundles in target repos.
- **Creation** of [/okf-docs-setup/conventions/byte-exact-assets.md](/okf-docs-setup/conventions/byte-exact-assets.md)
  — byte-exact assets contract, intentional placeholders, the `pnpm docs:validate`
  substitution target, and the `claude/` → `.claude/` install rename, converted from `AGENTS.md`.
- **Creation** of [/okf-docs-setup/specs/validator.md](/okf-docs-setup/specs/validator.md)
  — validator behaviour (advisory exit 0, hard errors vs soft warnings, `excludedTopLevelDirs`,
  the one benign policy-link warning) and repo invocation via `npm run docs:validate`,
  converted from `AGENTS.md`.
- **Creation** of [/conventions/git.md](/conventions/git.md) — repo-wide git convention
  (branch `main`, descriptive prose commit subjects), converted from `AGENTS.md`.
- **Initialization**: Established the OKF v0.1 bundle skeleton (root, conventions,
  glossary, references) and installed the validator, the `docs-authoring` rule, and the
  `docs-add` / `docs-validate` skills.
- **Creation**: Authored the governance concept
  [Documentation lifecycle policy](/conventions/documentation.md) and the
  [OKF reference](/references/okf.md).
