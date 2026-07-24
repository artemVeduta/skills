---
name: docs-add
description: Use when adding ONE concept to an OKF docs/ bundle — a Decision/ADR, Specification, Convention, Glossary term, Reference, or a new subsystem index node — from either a prepared complete concept or content to scaffold from a template, and when a filing must produce its frontmatter, body, path, parent index.md entry, and log.md lifecycle entry together under a single approval. Also when invoked as /docs-add. Not for validating a bundle (that is docs-validate) or bootstrapping/repairing one (that is docs-setup).
---

# docs-add

## Overview

Files exactly one conformant concept into an OKF v0.1 `docs/` bundle: the concept
itself, its parent `index.md` entry, and the nearest `log.md` lifecycle entry — planned
as a unit, written only after explicit approval, then validated and read back. This
skill applies the bundle's lifecycle policy; it does not restate it, and it owns the
scaffolding templates under `templates/`.

## When to Use

- Adding a Decision/ADR, Specification, Convention, Glossary term, or Reference to an
  existing `docs/` bundle, or creating a new subsystem `index.md` node.
- Filing a concept a parent workflow (docs-sync, docs-autoresearch, a setup run) already
  drafted and approved — this skill performs the write, index, and log bookkeeping.
- NOT for validating a bundle (use docs-validate) and NOT for installing or repairing
  the validator, scripts, or rules (that is setup work).

## First: read the target bundle's lifecycle policy

**MANDATORY, before proposing anything.** Read the target repository's
`docs/conventions/documentation.md` — the single source of truth for the frontmatter
standard, the open taxonomy, reserved-file rules, linking, and the create/update/
supersede flow. Everything below applies that policy to one filing.

## Inputs

A filing is defined by three things:

1. **Type** — one taxonomy value (`Decision`, `Specification`, `Convention`, `Glossary`,
   `Reference`, an open-taxonomy type, or a Subsystem index node).
2. **Destination** — the bundle-relative concept path (kebab-case filename; repo-wide
   knowledge at the top level, subsystem knowledge nested under the subsystem). The
   concept ID is that path minus `.md`.
3. **Content** — EITHER a **prepared complete concept** (final frontmatter + body,
   supplied verbatim by the user or a parent workflow — file it as given, do not
   re-draft it) OR **content to scaffold**, in which case copy the matching
   `templates/<type>.md` (or `templates/subsystem-index.md`) and fill every
   `<placeholder>`: a real `title`, one-sentence `description`, today's ISO `timestamp`,
   and a non-empty `type` from the taxonomy.

## Size review at 300 physical lines

When the proposed concept reaches **300 physical lines**, run a semantic keep-or-split
review and record the reasoning **in the approval plan, never in the bundle**. This is
**not a size limit** and never a validator finding:

- **Split** when the file carries independently useful concepts with distinct
  lifecycles — propose the separate concepts instead.
- **Keep whole** when it is one atomic bounded report where separating evidence,
  assumptions, reasoning, and conclusions would destroy context.

## Approval gate — STOP before writing

Analyse first, then present **one complete plan** in a single message, then wait. The
plan states, in full:

- the concept's **final frontmatter**;
- its **body**;
- the exact bundle **path**;
- the parent **local `index.md` entry** — a `[Title](…) - description` bullet under the
  right section heading, its link target the bundle-relative absolute path the policy
  specifies; and
- the **nearest `log.md` lifecycle entry** — a `* **Creation**: <one line>` line linking
  the new concept, under today's `## YYYY-MM-DD` heading, newest first — including the
  300-line keep/split reasoning if it applied.

Ask plainly — **"Ready to apply this? (yes / no)"** — and wait. Silence or "looks good"
is not approval; only an explicit yes is.

**Approval reuse:** when a parent workflow has already presented and received explicit
approval for an equivalent complete filing plan, that approval satisfies this skill —
apply it directly. Do not gate the same plan twice or re-ask.

## Apply, then verify

After an explicit (or reused) approval, and only then:

1. Write the concept file at the approved path.
2. Update the **exact** parent `index.md` — add the one planned bullet.
3. Append the **one** planned entry to the nearest `log.md` (create today's
   `## YYYY-MM-DD` heading if absent).
4. Write nothing else; make each of the three edits once.
5. **Validate and read back:** run the repository's `docs:validate` script (the
   docs-validate skill interprets exits: `0` clean/warnings-only, `1` hard errors, `2`
   malfunction) and re-read the written concept to confirm it landed as planned. Fix a
   hard error introduced by this filing; triage warnings (they never block).

## Boundaries — never do these

- **Never write before approval** — no file is created, modified, or deleted until an
  explicit yes (or a reused parent approval).
- **Never touch Git** — do not stage, commit, push, or open a pull request; leave
  staging, commits, remotes, and pull-request state exactly as found. The filing lives
  in the working tree only.
- Never put frontmatter in a non-root `index.md`, or omit `okf_version` from the root one.
- Never rewrite a `Decision`'s history — append a dated `# Amendments` entry instead.
- Never skip the `index.md` + `log.md` bookkeeping — an unlinked concept is invisible.
- Never treat 300 lines as a hard limit or emit a size warning; the review is semantic.

## Quick Reference

1. Read `docs/conventions/documentation.md`.
2. Settle type + destination + content (prepared concept, or scaffold from `templates/`).
3. At 300+ lines, do the keep/split review; record it in the plan.
4. Present the one plan (frontmatter, body, path, index entry, log entry); wait for yes
   — unless a parent workflow already approved the equivalent plan.
5. Write the concept + one index bullet + one log entry; nothing else.
6. Run `docs:validate`, read the concept back. Never stage or commit.
