---
type: Specification
title: OKF validator behaviour and invocation
description: The strict validator contract (0/1/2 exits, YAML frontmatter oracle, warning suite, uniform walk), how to run it and its tests, and how enforcement is wired.
timestamp: 2026-07-25
---

# OKF validator behaviour and invocation

The validator's source of truth is
`skills/docs-setup/assets/scripts/validate-docs.mjs` (standalone Node ESM,
no dependencies). A copy is installed at `scripts/validate-docs.mjs` for this
repo's own bundle. Governing decision:
[Enforce minimal OKF errors through one strict validator contract](/decisions/okf-docs-strict-validation.md).

## Exit contract

`npm run docs:validate` is strict everywhere; it has no flags and no alternate
strict entrypoint:

- exit `0` — clean, or warnings only;
- exit `1` — one or more hard bundle errors;
- exit `2` — validator malfunction (e.g. missing or unreadable docs root),
  reported on stderr without an uncaught rejection.

## Hard errors — the OKF conformance floor

Exactly unparseable frontmatter and a missing/empty/non-scalar `type`. The
frontmatter oracle is a YAML 1.2 mapping delimited by standalone `---` lines
with the opening delimiter on the first line. Duplicate top-level keys
(`__proto__` included — keys are ordinary data, never prototype plumbing),
invalid YAML, missing delimiters, a non-mapping document, or an unterminated
block are unparseable. The oracle is dependency-free and accepts a documented
YAML 1.2 subset: block mappings and sequences, single-line flow collections,
plain scalars — a plain scalar may continue onto following more-deeply-indented
lines, folded with single spaces — and quoted and block scalars, with comments.
Outside the subset, and therefore also unparseable: anchors, aliases, tags,
multi-line quoted scalars, and multi-line flow collections. `type` itself must
be a non-empty scalar string. Reserved `index.md` and `log.md` files follow
their separate soft checks.

## Warnings (never block; no suppression grammar)

- missing recommended `title`, `description`, or `timestamp`;
- malformed timestamp;
- `status: superseded` without `superseded_by`;
- broken internal links;
- a non-root `index.md` with frontmatter, a root index whose present
  frontmatter does not declare string `okf_version: "0.1"`, or a `log.md`
  level-two heading that is not exact `## YYYY-MM-DD`;
- missing local `index.md`;
- non-reserved concepts absent by exact bundle-relative path from the same
  directory's index — aggregated once per directory with the total count and
  the first three omitted paths in lexicographic order (a cross-directory link
  to a same-basename concept does not satisfy coverage);
- a valid frontmatter `timestamp` older than the newest exact dated heading
  under `# Amendments` (region: from an exact level-one `# Amendments` to the
  next level-one heading or EOF; recognized entries: exact `## YYYY-MM-DD` or
  `## YYYY-MM-DD — <non-empty title>`; equal dates are not stale; inline code
  in the title is heading text, not stripped).

The validator does not infer duplicate identities from basenames, compare index
blurbs, require log entries, recognize debt markers, weigh amendments, compare
code values, deduplicate reports, enforce retention, or inspect non-Markdown
sidecars.

## Walk

Every `.md` file under the bundle root is validated uniformly — there is no
excluded-directory set and no per-project exclusion or suppression
configuration. Non-Markdown files are ignored. Two scanning views share one fence
pass. **Fenced code blocks** (a closing fence may be longer than its opener; an
unclosed fence runs to end of file) are stripped before all three of link,
index-coverage, and amendment scanning, so a fenced example link or a fenced
example amendment heading never warns. Link and index-coverage scanning
**additionally** strips **inline code spans**, because a span there may hold a
placeholder path. Amendment scanning does **not** strip them: an inline code span
is real heading text, so an amendment title containing code — say a backticked
function name — stays recognized rather than silently disappearing from the
stale-timestamp check.

## Invocation

- Validate this repo's bundle: `npm run docs:validate`
  (runs `node scripts/validate-docs.mjs`).
- Run the validator tests: `npm run docs:validate:test`
  (runs `node --test scripts/validate-docs.test.mjs`).
- Run the source-of-truth validator directly against any bundle (docs root
  defaults to `docs`):
  `node skills/docs-setup/assets/scripts/validate-docs.mjs <docs-root>`

## Enforcement wiring

- This repo's CI (`.github/workflows/ci.yml`) runs `npm run docs:validate` as a
  gating step — exit `1` or `2` fails the job.
- For target repos there are exactly two managed enforcement surfaces, both
  owned by docs-setup. Ownership splits cleanly: docs-setup owns enforcement
  discovery, planning, installation, upgrade, and verification; the
  `docs-validate` skill owns running and interpreting the strict command. The
  contract is
  [/docs-setup/specs/install-contract.md](/docs-setup/specs/install-contract.md);
  the mechanics live with the skill
  (`skills/docs-setup/references/enforcement.md`).
- **Local:** one marked managed block on an **already-active, repository-owned
  Husky `pre-push`** path, running the plain `docs:validate` script over the
  **complete bundle on every push** — never a diff-scoped subset. There is no
  hook **recipe** in any skill, because the marked block *is* the wiring.
  Detection needs an initialized hook manager; setup installs no hook manager,
  no husky dependency, and no package lifecycle (`prepare`) script, and never
  touches native Git hooks or the configured hooks path. No active Husky
  configuration → a reported skip.
- **Remote:** the managed GitHub Actions asset
  (`skills/docs-setup/assets/github/workflows/docs-validate.yml`) runs the same
  command on **both `push` and `pull_request`**; exit `1` **or** `2` fails the
  job. It is installed on GitHub evidence when no equivalent invocation already
  exists.

## Mirror enforcement

A repository-only Node test reached by `npm test`
(`scripts/validate-docs-mirror.test.mjs`) compares these pairs as raw buffers:

- `skills/docs-setup/assets/scripts/validate-docs.mjs` ↔
  `scripts/validate-docs.mjs`
- `skills/docs-setup/assets/scripts/validate-docs.test.mjs` ↔
  `scripts/validate-docs.test.mjs`

It fails on missing files and any byte difference (including newline-only
differences), names the authoritative asset, and never repairs. Editing rules
for the validator source live in
[/docs-setup/conventions/byte-exact-assets.md](/docs-setup/conventions/byte-exact-assets.md) —
the asset copy is the contract; the `scripts/` copy is an install.
