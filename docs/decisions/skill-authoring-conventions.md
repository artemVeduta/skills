---
type: Decision
title: Skill authoring conventions and quality bar
description: Layer trigger-only descriptions, a minimal section skeleton, an invocation-axis frontmatter allowlist, role-named support subdirs, and an advisory two-tier linter on top of the portable Agent Skills floor.
timestamp: 2026-07-24
---

# Skill authoring conventions and quality bar

## Context

Every skill in this library must be discoverable by a harness, portable across
harnesses, and reviewable against one shared standard. The cross-skill dependency
contract is already fixed by
[the skill-dependency decision](/decisions/skill-dependencies.md), and directory
ownership by [the structure decision](/decisions/skill-library-structure.md); this
decision settles everything else an author must satisfy: `SKILL.md` structure,
description style, progressive disclosure, supporting-material layout, and the static
validation bar.

Two example-reference projects ground the choices:
[obra/superpowers](/references/obra-superpowers.md) and
[mattpocock/skills](/references/mattpocock-skills.md). Both maintain their bar entirely
by hand — neither lints skill content — so automated validation is a conscious
divergence, not an imitation.

The conventions distinguish two layers. The **portable floor** is what the Agent
Skills specification itself requires and applies to any skill anywhere: `SKILL.md` at
the skill root, frontmatter `name` matching the kebab-case directory name and a
`description` of at most 1024 characters, and a body kept under 500 lines. Everything
below is the **repo layer** this library adds on top.

## Decision

1. **Description: trigger-first, triggers only.** A model-invoked skill's
   `description` opens with the triggering condition ("Use when …"), enumerates
   concrete trigger situations and phrases, and never summarizes the skill's workflow —
   superpowers documents a regression where a workflow-summarizing description made
   agents execute the summary instead of the skill. A user-invoked skill's
   `description` is a human-facing one-liner instead, since no model reads it for
   dispatch.
2. **Frontmatter allowlist with an invocation axis.** Allowed keys: `name` and
   `description` (required); `disable-model-invocation` and `argument-hint` (optional,
   with mattpocock/skills semantics). `disable-model-invocation: true` marks a skill
   user-invoked: reachable only by slash command, and therefore never a valid entry in
   another skill's `## Required skills`. Unknown keys are lint warnings, not errors.
3. **Minimal body skeleton with a canonical optional vocabulary.** Required sections:
   `## Overview` (what the skill does, a few lines) and one workflow section whose
   heading the author chooses, plus `## Required skills` / `## Integration` exactly as
   the dependency decision prescribes. Canonical optional headings — skippable, but
   mandatory naming when the ground is covered: `## When to Use` (including when NOT
   to use), `## Common Mistakes`, `## Quick Reference`. Near-miss headings such as
   "Gotchas" are lint warnings. All other sections are free.
4. **Progressive disclosure: soft 200, hard 500 lines.** Past 200 lines the linter
   warns; past 500 it errors. Heavy reference material and formats move into flat
   UPPERCASE sibling files named for their content (`GLOSSARY.md`,
   `REPORT-FORMAT.md`), linked from `SKILL.md` by relative path. Workflow steps stay
   inline.
5. **Role-named support subdirectories.** Disclosed reference documents sit flat next
   to `SKILL.md`. Executable and copyable material lives only in role-named subdirs:
   `scripts/` (helpers the skill runs), `templates/` (material to fill in), `assets/`
   (payloads copied verbatim, as in okf-docs-setup). Other subdirectory names are lint
   warnings.
6. **Skills name actions, not tools.** Skill bodies describe harness-agnostic actions
   ("dispatch a subagent", "search the codebase"), never harness-specific tool names —
   the superpowers portability rule that lets one canonical tree serve every
   distribution channel.
7. **An advisory two-tier linter is the quality bar.** Contract breaks are ERRORs:
   frontmatter outside the allowlist contract, `name` ≠ directory, a runtime
   `/skill-name` invocation missing from `## Required skills`, a required skill that
   is user-invoked, cross-skill filesystem paths, dependency cycles, a body over 500
   lines. Style drift is WARN: over 200 lines, near-miss canonical headings,
   non-canonical subdirs, unknown frontmatter keys, README inventory drift. Like
   `docs:validate`, the run always exits 0; whether CI ever blocks on it belongs to
   the testing-architecture decision, as does the linter's home (`tools/` remains
   reserved). Naming style beyond the spec's kebab-case is deliberately unregulated.

## Alternatives

- **A full fixed section skeleton** (superpowers' Overview → When to Use → Core
  Pattern → Quick Reference → Common Mistakes for every skill). Rejected because thin
  wrapper skills and reference skills would carry noise sections; the canonical
  optional vocabulary keeps uniformity where the ground is actually covered.
- **Free-form bodies** (mattpocock's stance). Rejected because with no required
  Overview or workflow section there is nothing for a reviewer or linter to anchor on.
- **Descriptions that also summarize what the skill does** (Anthropic's published
  guidance). Rejected on superpowers' documented regression; the body's `## Overview`
  carries the "what".
- **Size guidance without lint** (both reference projects). Rejected because
  unenforced targets demonstrably drift — superpowers' own meta-skill is 689 lines
  against its stated 500-word target.
- **All support material under `assets/`** (generalizing okf-docs-setup's shape).
  Rejected because it buries disclosed reference docs a level deeper than either
  reference project and blurs the run/fill-in/copy-verbatim distinction.
- **A blocking linter (errors exit non-zero).** Rejected for now to match the
  `docs:validate` advisory precedent; the CI decision can revisit enforcement without
  changing the bar itself.
- **Spec-only frontmatter (no invocation axis).** Rejected because "slash-only" intent
  would live nowhere machine-readable, and the required-skills-must-be-model-invoked
  rule could not be checked.

## Consequences

- Authors get one checkable definition of done for a skill; review feedback accumulates
  in `## Common Mistakes` under a predictable heading.
- The linter must parse frontmatter, headings, line counts, subdir names, and the
  dependency contract, and cross-check the README inventory — its implementation and
  wiring are owed to the testing-architecture work.
- The library consciously diverges from both reference projects by having automated
  gates at all; their experience says hand-maintained conventions drift (mattpocock's
  `resolving-merge-conflicts` is published but unlisted in his own inventories).
- `okf-docs-setup` already conforms: 203 lines (one WARN nudge), trigger-first
  description, `assets/` payload. The invocation-axis and section conventions apply to
  every future skill.
- Portable installs of a single skill carry their UPPERCASE sibling files and role
  subdirs automatically because everything lives under the skill directory.

## Amendments

<!-- Append dated entries; never rewrite the decision above.
## YYYY-MM-DD — <short title>
<what changed and why; link the driving work>
-->

## 2026-07-24 — The docs:validate advisory precedent no longer exists

[Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md)
(#49) made `docs:validate` strict (exits `0`/`1`/`2`), so decision 7's "like
`docs:validate`, the run always exits 0" comparison and the rejected
"blocking linter" alternative's appeal to that precedent are historical. The
linter's own bar is unchanged: its default invocation stays advisory (always
exit 0) with `--strict` as the CI gate, per
[CI and automation wiring](/decisions/ci-and-automation-wiring.md).
