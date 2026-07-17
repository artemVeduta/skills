---
type: Decision
title: Declare skill dependencies in SKILL.md
description: Use a machine-readable Required skills section and a separate explanatory Integration section for runtime skill relationships.
timestamp: 2026-07-10
---

# Declare skill dependencies in SKILL.md

## Context

Skills in this library may build on other skills at runtime. The library must still
support selective portable installation, whole-library development links, and aggregate
native plugins across harnesses whose installation paths and namespacing rules differ.

A dependency therefore needs both a portable identity that installation tooling can
validate and human-readable guidance that tells an agent how the skills work together.
The convention must distinguish required invocation from comparison or authoring
commentary, preserve dependency closure when users install a subset, and avoid coupling
runtime instructions to repository or harness filesystem layouts.

## Decision

Every skill with runtime dependencies declares them in a dedicated
`## Required skills` section of its root `SKILL.md`. The section is the dependency
graph's machine-readable source of truth. Each list entry is a bare canonical skill name
without a slash:

```markdown
## Required skills

- skill-builder
- domain-modeling
```

A separate `## Integration` section explains the relationship in prose. It uses explicit
labels such as **Required sub-skill** and **Required background**, and workflow steps
repeat mandatory invocation at the point of use:

```markdown
## Integration

- **Required sub-skill:** Invoke `/skill-builder` to scaffold the new skill.
- **Required background:** Invoke `/domain-modeling` before defining domain terminology.
```

Slash-prefixed names are runtime invocation syntax. Every runtime `/skill-name`
invocation must have a matching bare entry in `## Required skills`. Comparisons and
authoring commentary that do not invoke another skill use its plain name without a
slash. Cross-skill filesystem paths are forbidden: installed paths vary by harness and
distribution channel, and another skill's files are not a supported runtime interface.

Installation is dependency-safe by default. Selecting a skill expands its full
transitive closure before any changes are made. A missing dependency or cycle rejects
the installation. Any installation mode that deliberately skips closure must expose a
separate, explicit unsafe option; selecting a named skill must not silently disable
dependency checks.

The three distribution channels apply the graph as follows:

- The development installer validates the graph and symlinks the whole library into
  each selected harness profile, so every dependency is present.
- Aggregate native plugins validate and package the whole skill tree.
- Selective portable installation must expand the chosen skills' dependency closure.
  The current upstream `skills` CLI does not parse this convention or offer a resolution
  hook. Until upstream support exists, `--skill '*'` is the safe whole-library fallback;
  selectively installed dependent skills cannot claim enforced closure.

The upstream-compatible target is for explicit and interactive skill selection to
resolve dependencies by default, with a distinct option such as `--no-deps` for an
intentional expert bypass. The current limitation and supporting source evidence are
captured in `research/issue-6-npx-dependency-resolution.md`.

## Alternatives

- **Namespaced frontmatter metadata.** Rejected because it duplicates the human-readable
  integration reference and hides a central workflow relationship from the skill body.
- **Parse every slash-prefixed mention.** Rejected because comparisons, examples, and
  incidental prose would create accidental graph edges. Only `## Required skills` is
  machine input.
- **Use `## Integration` as the dependency list.** Rejected because integration prose
  mixes relationship kinds and is intentionally optimized for readers rather than a
  stable parser.
- **Reference another skill's filesystem path.** Rejected because development links,
  portable copies, and namespaced plugins do not share a reliable relative layout.
- **Copy dependency content into the dependent skill.** Rejected because it duplicates
  capability logic, obscures ownership, and prevents independent evolution.
- **Treat `--skill` as an implicit dependency bypass.** Rejected because selection and
  safety are separate concerns; a common automation flag must not silently produce a
  broken installation.
- **Forbid runtime dependencies.** Rejected because composition between focused skills
  is an intentional capability of this library.

## Consequences

- A skill's required runtime relationships are visible to both agents and tooling while
  explanatory details remain readable and flexible.
- Validators must parse `## Required skills`, enforce canonical names, compare runtime
  slash invocations with declared dependencies, detect missing nodes and cycles, and
  compute transitive closure.
- Skill authors must invoke capabilities by canonical name instead of reading another
  skill's files or relying on an installation layout.
- Whole-library development and plugin installations remain simple, at the cost of
  installing skills a particular workflow may never invoke.
- Selective installation can remain small without becoming incomplete once its installer
  supports the graph.
- The portable channel cannot yet enforce this contract through the published upstream
  `skills` CLI. Documentation and tests must distinguish the target contract from the
  current fallback until upstream support lands.
- The convention adds a repo-specific structured Markdown section that upstream tooling
  must deliberately adopt; it is not part of the base Agent Skills specification.

## Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->
