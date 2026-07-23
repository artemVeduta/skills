# Decisions

Durable repo-wide architectural choices and their trade-offs.

- [Declare skill dependencies in SKILL.md](/decisions/skill-dependencies.md) - define machine-readable dependency declarations, explanatory integration guidance, and installation closure
- [Skill authoring conventions and quality bar](/decisions/skill-authoring-conventions.md) - trigger-only descriptions, minimal skeleton with canonical optional headings, invocation-axis frontmatter, role-named support subdirs, and an advisory two-tier linter
- [Organize the library around flat, skill-owned directories](/decisions/skill-library-structure.md) - keep skills flat under `skills/`, separate repository automation from developer tooling, and give each skill ownership of its executable support material
- [Use three skill distribution channels](/decisions/skill-distribution-channels.md) - separate live development links, portable pure-skill installation, and native aggregate plugins while sharing one canonical skill tree
- [Snapshot releases with mirrored manifest versions](/decisions/versioning-and-release-policy.md) - tag no-contract snapshot releases, mirror the tag into plugin manifests, and run the release ritual through a script in scripts/
- [Skill testing and benchmark architecture](/decisions/skill-testing-architecture.md) - repo-owned tools/ harness driving headless harness CLIs, deterministic-first grading, central per-skill case directories, and paired with/without-skill benchmarks with provenance
- [Benchmark metrics and comparison design](/decisions/benchmark-metrics-and-comparison-design.md) - tiered smoke/full trial presets, advisory two-trial regression flag, committed summaries with release-promoted baselines, identity-set provenance, and per-case reporting without cross-case blending
- [CI and automation wiring](/decisions/ci-and-automation-wiring.md) - static-only push/PR checks red on linter ERRORs, no inference or API keys in CI, local-only test and benchmark runs, and an advisory release-time staleness warning
- [Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md) - make setup, authoring, validation, synchronization, and autoresearch distinct portable skills with one canonical library home
- [Deliver one portable OKF skill pack through deletion-safe adapters](/decisions/okf-docs-portability-and-distribution.md) - preserve one semantic core across Claude Code, Codex, and OpenCode while adapters provide discovery and presentation only
- [Reconcile OKF knowledge by accepted state, not editing residue](/decisions/okf-docs-knowledge-lifecycle.md) - keep executable sources authoritative and compact branch-local churn without erasing accepted history
- [Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md) - use stable 0/1/2 exits, block only on the OKF conformance floor, and enforce through portable shell wiring
- [Keep a tool-neutral docs bundle with specs as the canonical section](/decisions/okf-docs-bundle-shape.md) - retain docs/ and specs/, classify content by durable purpose, and validate all retained Markdown without exclusions
