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
