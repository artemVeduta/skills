# okf-docs-setup

The `okf-docs-setup` skill bootstraps an OKF v0.1 docs bundle in a target repository. It
lives at `skills/okf-docs-setup/` — a `SKILL.md` entry plus an `assets/` directory holding
the verbatim bundle (validator, helper skills, rules, policy, OKF reference) that is
distributed by copy into target repos: the contract is copied byte-for-byte, and only
project-specific content is authored per install.

## Contents

- [Conventions](/okf-docs-setup/conventions/index.md) - rules governing this subsystem's assets and install contract
- [Specifications](/okf-docs-setup/specs/index.md) - behaviour of the shipped mechanisms (validator exit semantics, error classes, invocation)
