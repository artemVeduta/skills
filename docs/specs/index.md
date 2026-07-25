# Specifications

Repo-wide specifications — contracts of utilities that belong to the whole
repository rather than to any one subsystem.

- [install.sh — development-links install wizard](/specs/install-sh.md) - contract for the shipped checkout installer: the registry-driven interactive wizard that validates the skill dependency graph and symlinks the whole library into selected harness profiles
- [Native aggregate plugins & release script](/specs/native-plugins-and-release.md) - Implementation contract for the Codex and Claude Code native plugin manifests, their marketplace catalogs, and the scripts/release.mjs snapshot-release ritual.
