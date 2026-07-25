---
type: Decision
title: Skill authoring conventions and quality bar
description: Layer trigger-only descriptions, a minimal section skeleton, an invocation-axis frontmatter allowlist, role-named support subdirs, and an advisory two-tier linter on top of the portable Agent Skills floor.
timestamp: 2026-07-25
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
   (payloads copied verbatim, as in docs-setup). Other subdirectory names are lint
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

# Amendments

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

## 2026-07-25 — A fourth support role subdir, and docs-setup as the exemplar

Progressive disclosure has a second shipped target alongside a flat UPPERCASE sibling
file: a file under `references/`, the home for heavy reference material pulled out of
`SKILL.md`. It is a first-class support role, not a non-canonical subdir — the linter's
role set is a single declaration (`tools/lint-skills.mjs` → `ROLE_SUBDIRS`) and now
carries it, so `skills/docs-sync/references/migration.md` lints clean beside the flat
form `skills/docs-autoresearch/RESEARCH-DEFAULTS.md`. Decision 4's disclosure target
therefore reads "a flat UPPERCASE sibling file or a file under `references/`", and
decision 5's role set gains it. Nothing else in either decision moves: disclosed
reference documents may still sit flat, and any other subdir name is still a warning.

The Consequences bullet's exemplar identity and line count are superseded by the shipped
suite. `okf-docs-setup` was renamed completely to `docs-setup`
([Separate OKF documentation skills by lifecycle responsibility](/decisions/okf-docs-skill-boundaries.md)), and that skill is now 259
body lines. Three of the five shipped skills sit in the soft-200 WARN band
(`docs-autoresearch` 418, `docs-sync` 353, `docs-setup` 259) with none approaching the
hard 500 — see `npm run lint:skills`. The bar itself is unchanged; what changed is that
the WARN band is now the normal state for the library's larger workflow skills rather
than a single nudge on one exemplar.

## 2026-07-25 — WARN-band membership is a linter reading, not a documented number

The entry above pins three shipped body-line counts. Exact counts are executable truth:
they move with every edit, and all three were stale within days. This Decision therefore
stops carrying them. What is durable is the *membership*: three of the five shipped skills
— `docs-autoresearch`, `docs-sync`, and `docs-setup` — sit in decision 4's soft-200 WARN
band, none is near the hard-500 ERROR, and that band is the normal state for the library's
larger workflow skills rather than a nudge on one exemplar. The authority for the current
counts and classifications is `npm run lint:skills`; a reader who needs a number runs it
rather than reading one here. The numbers in the entry above stay intact as the dated
observation they were, and are not current values. Driven by #65.

## 2026-07-25 — A user-invoked description may keep its trigger phrases

Decision 1 says a user-invoked skill's `description` is "a human-facing one-liner instead,
since no model reads it for dispatch". Two shipped skills depart from the letter of that
and are right to: `docs-setup` and `docs-sync` each declare
`disable-model-invocation: true` and each carries a multi-sentence description enumerating
the concrete phrases a user says, plus explicit "not for X, that is Y" boundaries. The
reason is discovery rather than dispatch — a slash-command surface presents the
description to a human, so the user-said phrasings are what make the right skill findable
and the negative clauses are what keep it from being reached for the wrong job.

The rule is restated as a floor plus latitude. A user-invoked `description` **must not**
authorize implicit selection: it states up front that the skill runs only when the user
explicitly asks, and it never reads as a condition an agent may satisfy on its own. Given
that, it **may** carry concrete user-said trigger phrases and negative boundaries at
whatever length serves discovery. Decision 1's "one-liner" is guidance for the simple
case, not a rule. Nothing changes for a model-invoked `description`, which stays
trigger-first and triggers-only. Driven by #65.
