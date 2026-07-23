---
type: Decision
title: Deliver one portable OKF skill pack through deletion-safe adapters
description: Keep one byte-identical semantic core across Claude Code, Codex, and OpenCode while limiting harness adapters to discovery and presentation.
timestamp: 2026-07-24
---

# Deliver one portable OKF skill pack through deletion-safe adapters

## Context

Claude Code, Codex, and OpenCode all consume `SKILL.md` workflows, but they discover
project instructions, skills, hooks, and sub-agents differently. Harness-specific
copies could exploit every native feature, but would create three behavioral products
whose safety and outcomes drift. A single directory is also insufficient for discovery
across all three harnesses.

## Decision

The load-bearing product is one complete, byte-identical portable skill pack plus four
shared repository surfaces:

1. a concise, self-contained Documentation router in root `AGENTS.md`;
2. the canonical skill trees and their support files;
3. the progressively discovered `docs/` OKF bundle; and
4. repository-owned shell commands for deterministic validation.

Every portable skill satisfies the strictest shared reader: `name` is 1–64 characters,
matches `^[a-z0-9]+(-[a-z0-9]+)*$`, and equals its directory name; `description` is
1–1,024 characters and trigger-front-loaded; bodies are plain Markdown with
relative-path progressive disclosure. The self-contained `AGENTS.md` chain stays within
Codex's 32 KiB default project-instruction budget.

Parity means the same required process, permitted changes, consent and failure
behavior, dependency availability, and validated repository outcome. It does not mean
identical commands, paths, namespaces, prompt loading, installed versions, source
selection, or model prose.

Setup owns one marked, idempotently replaceable `AGENTS.md` block and preserves
unrelated guidance. Root `CLAUDE.md` is exactly `@AGENTS.md` after all pre-existing
content has an approved destination. Codex and OpenCode receive no duplicate
instruction configuration.

Claude Code may keep pointer-only, path-scoped rules as optional conveniences. They
contain no unique policy or procedure and are deletion-safe. Codex receives no required
project `.codex` configuration; OpenCode receives no required `opencode.json`, plugin,
command, or agent definition. Harness metadata may improve discovery or display only;
it cannot redefine workflow, safety, output, or success.

Skills refer to capabilities by canonical identity, such as `docs-add`, while
channel-specific guidance translates that identity into the invocation form exposed by
the harness. Required fanout uses each harness's default sub-agent or dynamic-workflow
capability; no shared custom-agent definition, enablement stanza, or inline fallback is
part of the portable contract.

Canonical checkout placements are:

- Claude Code project: `.claude/skills/`; global:
  `<CLAUDE_CONFIG_DIR>/skills/` (default `~/.claude/skills/`);
- Codex project: `.agents/skills/`; global: `~/.agents/skills/`;
- OpenCode project: `.agents/skills/`; global: `~/.agents/skills/`.

OpenCode also reads Claude's placements. The planner adds no extra OpenCode placement
when a selected Claude or Codex placement already makes the pack discoverable. If
Claude and Codex both require their distinct project placements, OpenCode's loader must
resolve each canonical skill identity once; the conformance test rejects duplicate
exposure.

The complete pack is distributed through these mutually exclusive package shapes:

| Channel | Claude Code | Codex | OpenCode |
| --- | --- | --- | --- |
| Portable whole-pack installation | supported | supported | supported |
| Native aggregate plugin | supported | supported | not offered |
| Checkout links | supported | supported | supported |

A harness profile uses exactly one package shape. There is no skill picker in the
supported suite journeys. Install, inspect, and update output identifies provenance;
each advertised cell remains unsupported until its deterministic packaging tests and
live outcome test pass.

## Alternatives

- **Harness-specific workflow forks.** Rejected because native convenience would become
  three independently drifting contracts.
- **One universal discovery directory.** Rejected because no single project skill path
  reaches all three harnesses.
- **Duplicate project configuration for every harness.** Rejected because it creates
  multiple policy authorities and makes adapter deletion change behavior.
- **A single distribution channel.** Rejected because managed portable installs,
  native marketplaces, and live checkout links have genuinely different ownership and
  update semantics.
- **Per-skill selection.** Rejected for the supported suite journeys because dependency
  completeness and cross-skill invocation are pack-level guarantees.

## Consequences

- The same canonical skill directory may be copied, packaged, or symlinked into the
  discovery paths required by each harness.
- Checkout-link installation treats Claude Code, Codex, and OpenCode as products, not
  shared directories as pseudo-harnesses, and deduplicates coincident filesystem plans.
- Rerunning the checkout installer reconciles added and stale checkout-owned links while
  preserving unrelated entries and managed-channel installs.
- Updating the installed pack never upgrades a configured repository; repository
  machinery changes only through an explicit later `docs-setup` run.
- Optional adapters are tested by deletion: removing them cannot change the required
  result.

## Amendments

<!-- Append dated entries; never rewrite accepted history. -->
