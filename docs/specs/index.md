# Specifications

Repo-wide specifications — contracts of utilities that belong to the whole
repository rather than to any one subsystem.

- [Skills library & building platform — PRD](/specs/skills-platform.md) - the whole-platform PRD consolidated from the governing Decisions: problem, solution, user stories, and implementation/testing decisions across structure, distribution, dependencies, authoring, versioning, testing/benchmarks, CI
- [install.sh — development-links install wizard](/specs/install-sh.md) - PRD for rebuilding the installer into the registry-driven interactive wizard that validates the skill dependency graph and symlinks the whole library into selected harness profiles
- [Native aggregate plugins & release script](/specs/native-plugins-and-release.md) - Implementation contract for the Codex and Claude Code native plugin manifests, their marketplace catalogs, and the scripts/release.mjs snapshot-release ritual.
- [OKF documentation skill-suite v2](/specs/okf-docs-skill-suite-v2.md) - implementation-ready contract for the portable five-skill suite, repository machinery, lifecycle, research, validation, distribution, migration, and cross-harness acceptance
