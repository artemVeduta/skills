---
type: Specification
title: OKF validator behaviour and invocation
description: The strict validator contract (0/1/2 exits, YAML frontmatter oracle, warning suite, uniform walk), how to run it and its tests, and how enforcement is wired.
timestamp: 2026-07-24
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
  `## YYYY-MM-DD — <non-empty title>`; equal dates are not stale).

The validator does not infer duplicate identities from basenames, compare index
blurbs, require log entries, recognize debt markers, weigh amendments, compare
code values, deduplicate reports, enforce retention, or inspect non-Markdown
sidecars.

## Walk

Every `.md` file under the bundle root is validated uniformly — there is no
excluded-directory set and no per-project exclusion or suppression
configuration. Non-Markdown files are ignored. Fenced code blocks (a closing
fence may be longer than its opener; an unclosed fence runs to end of file) and
inline code spans are stripped before link, index-coverage, and amendment
scanning, so illustrative example links and amendment-grammar examples inside
code do not warn.

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
- For target repos, the documented portable hook is `pre-push` running plain
  `npm run docs:validate`, with recipes for a plain Git hook, husky v4, and
  husky v8/v9 in the `docs-validate` skill. Setup never installs husky or adds
  package lifecycle (`prepare`) scripts.
- An optional minimal GitHub Actions asset
  (`skills/docs-setup/assets/github/workflows/docs-validate.yml`) runs the
  same command on pull requests; exit `1` fails the job.

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
