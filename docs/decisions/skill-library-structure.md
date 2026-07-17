---
type: Decision
title: Organize the library around flat, skill-owned directories
description: Keep skills flat under `skills/`, separate repository automation from developer tooling, and give each skill ownership of its executable support material.
timestamp: 2026-07-10
---

# Organize the library around flat, skill-owned directories

## Context

The repository is becoming a library of independently distributable skills rather than
a home for one skill. It needs stable boundaries for skill organization, repository
automation, future developer tooling, supporting assets, public discovery, and
skill-specific knowledge without introducing a taxonomy or shared-file coupling before
either is needed.

Skill directories must remain self-contained when installed through symlinks or other
distribution channels. At the same time, the repository needs one durable place for
explanatory contracts that should not be copied into distributed skill payloads.

## Decision

1. Canonical skills live directly under `skills/<name>/`. The library has no category
   buckets and no predetermined skill-count threshold for adding them. Actual navigation
   or ownership problems must motivate any later reorganization.
2. Each skill owns its executable support material beneath its directory. The repository
   has no top-level shared assets or templates directory. A concrete multi-owner need
   triggers a new decision rather than automatically creating shared storage.
3. Skills do not consume another skill through filesystem paths. Capability reuse follows
   [the skill-dependency model](/decisions/skill-dependencies.md), so runtime composition
   does not depend on a repository or harness layout.
4. `scripts/` contains repository operator entry points and workflow automation. `tools/`
   is reserved for developer infrastructure that analyzes, tests, or benchmarks the
   library; its creation and contents remain deferred to the testing-architecture
   decision.
5. Root `README.md` is the public skill inventory and installation entry point. Adding or
   removing a skill must update that inventory. Root `AGENTS.md` provides repository
   guidance, and `CLAUDE.md` delegates to it.
6. The original decision placed the `okf-docs-setup` invariants in root `AGENTS.md`. This
   contract-home choice is superseded by the amendment below; the skill-owned location of
   its executable assets is unchanged.

Installation and update behavior belong to
[the distribution-channel decision](/decisions/skill-distribution-channels.md), not to
the repository structure.

## Alternatives

- **Category buckets such as `engineering/` and `misc/`.** Rejected because the library
  has no demonstrated navigation problem that justifies a taxonomy.
- **A fixed skill-count threshold for restructuring.** Rejected because observed
  operational pain, not an arbitrary count, should drive a future decision.
- **Top-level shared assets or templates.** Rejected because they obscure ownership and
  make independently installed skills depend on repository-relative files.
- **Cross-skill filesystem links.** Rejected because distribution channels and harnesses
  do not preserve one reliable relative layout.
- **Per-skill `AGENTS.md` files.** Rejected in favor of root repository guidance and
  subsystem-scoped knowledge in the OKF bundle.

## Consequences

- Skill paths and ownership boundaries remain predictable, and each skill can be
  distributed without copying support files from elsewhere in the repository.
- Runtime dependencies remain possible, but they use declared capabilities rather than
  cross-directory file coupling.
- Repository automation and developer infrastructure have separate homes. `tools/` may
  legitimately remain absent until testing or benchmarking work requires it.
- The public skill inventory introduces a synchronization obligation unless later
  automation enforces it.
- The flat tree may eventually become crowded. A future decision can reorganize it when
  concrete scale or ownership problems outweigh the simpler structure.
- Explanatory contracts can evolve in `docs/` without becoming part of a distributed
  skill payload.

## Amendments

## 2026-07-10 — Move skill invariants into the OKF bundle

After the OKF bundle's installation model was reviewed, the detailed
`okf-docs-setup` contract moved from root `AGENTS.md` to
[Byte-exact assets contract](/okf-docs-setup/conventions/byte-exact-assets.md). Root
`AGENTS.md` instead carries the standing requirement to consult the relevant bundle
concepts. This changes the explanatory home of the contract, not the skill-owned
location of its executable assets. The other repository-structure choices remain
unchanged.
