# docs-setup

The `docs-setup` skill installs, upgrades, reinstalls, or repairs the OKF v0.1
documentation machinery in a target repository. It lives at `skills/docs-setup/` — a
`SKILL.md` entry plus an `assets/` directory holding the verbatim machinery (the
validator and its test, the seed lifecycle policy and OKF reference, the reserved bundle
skeleton, the marked `AGENTS.md` router block, and the optional GitHub Actions workflow
and pointer-only Claude rule) that is distributed by copy into target repos: the fixed
machinery is copied byte-for-byte, and only project-specific content is authored per
install. The two canonical helper skills `docs-add` and `docs-validate` are depended on
by name and must be discoverable at run time — docs-setup installs no project-local
helper-skill copies.

## Contents

- [Conventions](/docs-setup/conventions/index.md) - rules governing this subsystem's assets and install contract
- [Specifications](/docs-setup/specs/index.md) - behaviour of the shipped mechanisms (install contract, validator exit semantics, error classes, invocation)
