# Bundle change log

## 2026-07-25

- **Update** of [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — amended for the acceptance-matrix parity gate (#63): the committed acceptance
  matrix (`tools/acceptance/matrix.mjs`) mapping every (channel × harness) cell to
  deterministic packaging evidence plus a genuine live behavioral attestation
  (`tools/acceptance/live-attestations.json`), the CI-gated `advertised == proven`
  invariant test that keeps OpenCode-native present-and-unsupported and withholds any
  cell missing either evidence class, the new dependency-completeness check in the
  static portable contract, and the reconciled Claude model default. No decision was
  reversed; the deterministic-only oracle and provenance rules are unchanged.

## 2026-07-24

- **Update** of [install.sh — development-links install wizard](/specs/install-sh.md) —
  reconciled the PRD with shipped three-harness behaviour (#61): added a supersession
  note pointing to the [v2 skill-suite spec](/specs/okf-docs-skill-suite-v2.md), and
  corrected the Channel-mixing guard and implementer-owned-gaps sections so they no
  longer describe the removed blanket `~/.agents/skills` warning or `CODEX_HOME`-based
  Codex resolution. Channel mixing is now a precise managed-shape refusal; Codex global
  resolves to a fixed `~/.agents/skills`.
- **Update** — completed the `docs-setup` identity migration (#60): retired the obsolete
  `okf-docs-setup` skill identity and renamed the subsystem to
  [docs-setup](/docs-setup/index.md). The skill now lives only at `skills/docs-setup/`,
  the subsystem bundle moved to `/docs-setup/`, and the
  [Install contract](/docs-setup/specs/install-contract.md),
  [Byte-exact assets contract](/docs-setup/conventions/byte-exact-assets.md), and
  [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) were
  reconciled to the canonical five-skill suite (`docs-setup`, `docs-add`,
  `docs-validate`, `docs-sync`, `docs-autoresearch`). The legacy skill tree, its central
  test fixture, project-local nested helper-skill copies, and stale benchmark artifacts
  were removed, and the tests, README inventory, and cross-references now use the
  canonical identities.
- **Update** of
  [OKF validator behaviour and invocation](/docs-setup/specs/validator.md) and
  [Documentation lifecycle policy](/conventions/documentation.md) —
  documented the frontmatter oracle's YAML 1.2 subset (multi-line plain-scalar
  folding accepted; anchors, aliases, tags, multi-line quoted scalars, and
  multi-line flow collections unparseable; `__proto__` an ordinary key) and
  extended code stripping to amendment scanning, per the #49 review pass.
- **Update** of
  [OKF validator behaviour and invocation](/docs-setup/specs/validator.md),
  [Install contract](/docs-setup/specs/install-contract.md),
  [Byte-exact assets contract](/docs-setup/conventions/byte-exact-assets.md),
  [Documentation lifecycle policy](/conventions/documentation.md), and
  [OKF v0.1 reference](/references/okf.md) — implemented the strict validator
  contract (#49): 0/1/2 exits, YAML 1.2 frontmatter oracle, exact-path index
  coverage, stale-amendment warning, uniform no-exclusion walk, raw-byte mirror
  test, gating CI step, documented pre-push recipes, and the optional PR
  workflow asset. Amended
  [CI and automation wiring](/decisions/ci-and-automation-wiring.md),
  [Skill authoring conventions](/decisions/skill-authoring-conventions.md), and
  [Skill testing architecture](/decisions/skill-testing-architecture.md) to
  retire their advisory-validator claims.
- **Creation** of [superpowers](/superpowers/index.md) subsystem index and
  [handoffs index](/superpowers/handoffs/index.md), and conversion of the
  [benchmark run flow handoff](/superpowers/handoffs/2026-07-17-benchmark-run-flow-handoff.md)
  into a conformant concept — the bundle is now validated uniformly with no
  exclusion grammar (#49).
- **Update** of
  [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md)
  — amended with the v2 acceptance-harness seam (#48): plan/approval turns,
  git-state and execution-trace oracles, cross-harness outcome comparison, and
  static portable-contract checks.
- **Creation** of [OKF documentation skill-suite v2](/specs/okf-docs-skill-suite-v2.md)
  — assembled the implementation-ready destination contract for setup, authoring,
  validation, synchronization, autoresearch, migration, distribution, and parity.
- **Creation** of
  [Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md)
  — assigned the five portable skills distinct responsibilities and one canonical
  library home.
- **Creation** of
  [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md)
  — fixed the shared semantic core, adapter boundary, and supported distribution
  matrix across Claude Code, Codex, and OpenCode.
- **Creation** of
  [Reconcile OKF knowledge by accepted state, not editing residue](/decisions/okf-docs-knowledge-lifecycle.md)
  — made executable sources authoritative for current behavior and defined
  synchronization and accepted-state compaction.
- **Creation** of
  [Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)
  — fixed strict process exits, the blocking error floor, warning boundaries, portable
  enforcement, and raw-byte mirror checks.
- **Creation** of
  [Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md)
  — retained the established bundle and section names while removing tool-specific and
  configurable validation exclusions.

## 2026-07-17

- **Update** — amended [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md):
  recorded the per-harness model knob — `tools/benchmarks/models.mjs` maps
  claude-code/codex/opencode to pinned model ids, threaded into `runCase` via
  `harnessSelections {id, model}`, overriding the plan's original `model: null`
  (which fell back to each driver's baked default, including claude-code's
  malformed dotted `claude-opus-4.8`) — and the claude-code test-profile auth
  check switching from a global macOS-Keychain existence check (false-positive)
  to the CLI's own `claude auth status --json` `loggedIn` verdict in
  `scripts/setup-test-profiles.sh` (#25).
- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  recorded the opencode fixture-escape fix — `run` resolves its project by a
  `.git` walk-up plus a persistent per-profile known-projects registry
  (`opencode.db`), not process cwd, so a non-git tmpdir fixture fell back to a
  stale real-repo project (seeded by a repo-root `opencode auth login`) and wrote
  into the real repo trees, undetectable by the live-daemon preflight since it is
  stale state, not a live process. Fixed with `run --dir <fixtureRoot>`
  (`tools/test-runner/drivers.mjs`), `git init`+baseline-committed fixtures
  (`tools/test-runner/fixture.mjs`), a throwaway-cwd login, and a new
  `check_opencode_no_repo_project` stale-state guard in
  `scripts/setup-test-profiles.sh` (#24, fixed during #25).
- **Creation** of [Benchmark run artifacts](/references/benchmark-run-artifacts.md)
  — the OKF Reference pointing at the committed `tools/benchmarks/summaries/` and
  `tools/benchmarks/reports/` artifacts produced by `npm run bench` (#25).

## 2026-07-16

- **Update** — amended [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md):
  recorded the #25 rescope to a single-arm run+report flow — with/without
  comparison arm, advisory regression flag, and baseline promotion deferred;
  `full` trial count 1 not 5; provenance identity set, commit-summary/local-raw
  retention split, and the deterministic no-cross-case-blend report principle
  carried over unchanged.
- **Update** — amended [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md):
  live-run isolation moved to persistent pre-authenticated test profiles under
  `~/.skills-test-profiles/`, resolved the codex HOME-derived skill-discovery
  leak (finding #4, Option A: relocate `HOME` into the profile), added the
  opencode daemon preflight and the four-rung actionable-skip ladder, and added
  per-run model/harness-version provenance (`run.json`, `--harness <id>[=<model>]`).
- **Update** — [Harness](/glossary/harness.md) gains the *test profile* usage of
  harness profile.
- **Update** — [Test-profile provisioning](/conventions/test-profile-provisioning.md):
  reframed the codex caveat now that `CODEX_HOME` + `HOME` together confine the
  HOME-derived `~/.agents/skills` leak (finding #4 resolved).

## 2026-07-15

- **Creation** of [Test-profile provisioning](/conventions/test-profile-provisioning.md)
  — provisioning the per-harness test profiles via `scripts/setup-test-profiles.sh` (fixed
  `~/.skills-test-profiles/<id>/` root, per-harness login/auth-marker, OAuth-pause flow,
  cross-machine setup), plus the codex `--skip-git-repo-check` and global `~/.agents/skills/`
  caveats.

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
- **Creation** of [/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md)
  — the docs-setup install contract: what an install delivers (docs bundle, validator
  scripts, `.claude` rules and helper skills, package.json scripts), the per-install
  substitutions, the `claude/` → `.claude/` rename, the machinery-vs-content phase
  structure, and the zero-hard-errors done criteria.
- **Creation** Added the `docs-setup` subsystem index node (`/docs-setup/index.md`)
  covering the skill that bootstraps OKF v0.1 docs bundles in target repos.
- **Creation** of [/docs-setup/conventions/byte-exact-assets.md](/docs-setup/conventions/byte-exact-assets.md)
  — byte-exact assets contract, intentional placeholders, the `pnpm docs:validate`
  substitution target, and the `claude/` → `.claude/` install rename, converted from `AGENTS.md`.
- **Creation** of [/docs-setup/specs/validator.md](/docs-setup/specs/validator.md)
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
